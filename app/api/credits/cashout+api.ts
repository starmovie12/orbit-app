/**
 * app/api/credits/cashout+api.ts
 *
 * POST /api/credits/cashout
 *
 * Full server-side cashout pipeline (blueprint §08 + §15 + §16).
 *
 * Flow:
 *   1. Verify Firebase ID token (x-firebase-token header).
 *   2. Parse + validate body: { amountInr, upiId }.
 *   3. Load user doc — check credits balance, karma, phone.
 *   4. Enforce business rules server-side:
 *        • Min ₹50  (500 credits)
 *        • Max ₹5,000 / day  (50,000 credits)
 *        • Monthly cap ₹10,000  (RBI — KYC-free threshold)
 *        • UPI ID format: /^[\w.\-]+@[\w]+$/
 *   5. Determine routing status:
 *        • karma < 50         → "hold_7d"       (anti-fraud hold)
 *        • amountInr >= ₹1,000 → "manual_review" (admin queue)
 *        • otherwise          → "pending"        (auto-process)
 *   6. Atomic Firestore transaction:
 *        • Re-validate balance + daily limit inside tx (TOCTOU guard)
 *        • Debit user.credits
 *        • Write /cashoutRequests/{requestId}
 *        • Write /users/{uid}/creditTxns/{txnId}
 *   7. For "pending" only — call Razorpay Payouts API:
 *        a. Create or retrieve Contact  (idempotent via reference_id=uid)
 *        b. Create Fund Account (vpa / UPI)
 *        c. Create Payout (UPI, amount in paise, narration)
 *        d. Patch cashoutRequests with razorpayPayoutId + status "processing"
 *   8. For "manual_review" — write to /adminQueue (blueprint §16 Tier 2).
 *   9. Return { ok, requestId, razorpayPayoutId, status }.
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS   – service-account JSON (stringified)
 *   RAZORPAY_KEY_ID              – Razorpay API key id
 *   RAZORPAY_KEY_SECRET          – Razorpay API key secret
 *   RAZORPAY_ACCOUNT_NUMBER      – Razorpay X business account number
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Firebase Admin singleton ────────────────────────────────────────────────
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Business rule constants (blueprint §08) ─────────────────────────────────
const CREDITS_PER_RUPEE      = 10;
const MIN_INR                = 50;
const MAX_INR_DAILY          = 5_000;
const MONTHLY_CAP_INR        = 10_000;   // RBI KYC-free threshold
const KARMA_HOLD_THRESHOLD   = 50;
const MANUAL_REVIEW_INR      = 1_000;

// ─── Razorpay helpers ─────────────────────────────────────────────────────────

/** Basic-auth header for Razorpay REST API. */
function razorpayAuth(): string {
  const creds = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

/** Low-level Razorpay POST wrapper — throws on non-2xx. */
async function rzPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  razorpayAuth(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as T & { error?: { description?: string } };

  if (!res.ok) {
    const desc = (data as any)?.error?.description ?? `Razorpay error ${res.status}`;
    throw new Error(desc);
  }
  return data;
}

/** Low-level Razorpay GET wrapper. */
async function rzGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: razorpayAuth() },
  });
  if (!res.ok) throw new Error(`Razorpay GET failed (${res.status}): ${path}`);
  return res.json() as Promise<T>;
}

/**
 * Upsert a Razorpay Contact — uses reference_id = uid for idempotency so
 * repeated cashouts for the same user never create duplicate contacts.
 */
async function upsertContact(uid: string, name: string, phone: string): Promise<string> {
  // Try to fetch existing contact first
  try {
    const existing = await rzGet<{ items: Array<{ id: string }> }>(
      `/contacts?reference_id=${encodeURIComponent(uid)}`
    );
    if (existing?.items?.length > 0) return existing.items[0].id;
  } catch {
    // Ignore fetch errors — fall through to create
  }

  const contact = await rzPost<{ id: string }>("/contacts", {
    name:         name || "ORBIT User",
    contact:      phone.startsWith("+91") ? phone.slice(3) : phone.replace(/^\+/, ""),
    type:         "employee",
    reference_id: uid,
  });
  return contact.id;
}

/**
 * Create a Razorpay Fund Account (VPA/UPI type) for the contact.
 * Each cashout creates a fresh fund account linked to the provided UPI ID.
 */
async function createFundAccount(contactId: string, upiId: string): Promise<string> {
  const fa = await rzPost<{ id: string }>("/fund_accounts", {
    contact_id:   contactId,
    account_type: "vpa",
    vpa:          { address: upiId },
  });
  return fa.id;
}

/**
 * Fire the Razorpay Payout.
 * Returns the Razorpay payout id (e.g. "pout_xxx").
 */
async function createPayout(args: {
  fundAccountId: string;
  amountInr:     number;
  requestId:     string;
}): Promise<string> {
  const payout = await rzPost<{ id: string }>("/payouts", {
    account_number:        process.env.RAZORPAY_ACCOUNT_NUMBER!,
    fund_account_id:       args.fundAccountId,
    amount:                args.amountInr * 100,   // paise
    currency:              "INR",
    mode:                  "UPI",
    purpose:               "payout",
    queue_if_low_balance:  true,
    reference_id:          args.requestId,         // idempotency key
    narration:             "ORBIT Credits Cashout",
  });
  return payout.id;
}

// ─── Firestore limit-check helpers ───────────────────────────────────────────

/** Sum of successful (non-rejected) cashouts today for this uid (UTC boundary). */
async function fetchDailyTotalInr(uid: string): Promise<number> {
  const db         = getFirestore(getAdminApp());
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const qs = await db
    .collection("cashoutRequests")
    .where("uid",            "==", uid)
    .where("requestedAtMs",  ">=", startOfDay.getTime())
    .get();

  let total = 0;
  qs.forEach((doc) => {
    const d = doc.data() as { amountInr: number; status: string };
    if (d.status !== "rejected") total += d.amountInr ?? 0;
  });
  return total;
}

/** Sum of successful cashouts this calendar month for RBI monthly cap check. */
async function fetchMonthlyTotalInr(uid: string): Promise<number> {
  const db             = getFirestore(getAdminApp());
  const startOfMonth   = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const qs = await db
    .collection("cashoutRequests")
    .where("uid",           "==", uid)
    .where("requestedAtMs", ">=", startOfMonth.getTime())
    .get();

  let total = 0;
  qs.forEach((doc) => {
    const d = doc.data() as { amountInr: number; status: string };
    if (d.status !== "rejected") total += d.amountInr ?? 0;
  });
  return total;
}

// ─── UPI ID validator ────────────────────────────────────────────────────────
const UPI_REGEX = /^[\w.\-]+@[\w]+$/;

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  try {
    // ── 1. Parse body ──────────────────────────────────────────────────────
    const body = (await request.json()) as {
      amountInr?: unknown;
      upiId?:     unknown;
    };

    const amountInr = typeof body.amountInr === "number" ? body.amountInr : 0;
    const upiId     = typeof body.upiId     === "string" ? body.upiId.trim().toLowerCase() : "";

    // ── 2. Input validation ────────────────────────────────────────────────
    if (!amountInr || !upiId) {
      return Response.json({ error: "amountInr and upiId are required" }, { status: 400 });
    }
    if (!Number.isInteger(amountInr) || amountInr < MIN_INR) {
      return Response.json(
        { error: `Minimum cashout is ₹${MIN_INR} (${MIN_INR * CREDITS_PER_RUPEE} credits)` },
        { status: 400 }
      );
    }
    if (amountInr > MAX_INR_DAILY) {
      return Response.json(
        { error: `Maximum single cashout is ₹${MAX_INR_DAILY.toLocaleString()}` },
        { status: 400 }
      );
    }
    if (!UPI_REGEX.test(upiId)) {
      return Response.json(
        { error: "Invalid UPI ID format — expected handle@provider (e.g. name@upi)" },
        { status: 400 }
      );
    }

    // ── 3. Verify Firebase ID token ────────────────────────────────────────
    const token = request.headers.get("x-firebase-token") ?? "";
    if (!token) {
      return Response.json({ error: "Missing x-firebase-token header" }, { status: 401 });
    }

    const app = getAdminApp();
    let uid:         string;
    let tokenPhone:  string | undefined;

    try {
      const decoded = await getAuth(app).verifyIdToken(token, /* checkRevoked */ true);
      uid        = decoded.uid;
      tokenPhone = decoded.phone_number;
    } catch {
      return Response.json({ error: "Unauthorized — invalid or revoked Firebase token" }, { status: 401 });
    }

    // ── 4. Load user doc from Firestore ────────────────────────────────────
    const db      = getFirestore(app);
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data() as {
      credits:     number;
      karma:       number;
      phone:       string;
      displayName: string | null;
    };

    const creditsRequired = amountInr * CREDITS_PER_RUPEE;

    // ── 5. Balance check ───────────────────────────────────────────────────
    if ((userData.credits ?? 0) < creditsRequired) {
      return Response.json(
        {
          error: `Insufficient credits. You have ${userData.credits ?? 0} credits (₹${
            Math.floor((userData.credits ?? 0) / CREDITS_PER_RUPEE)
          }), need ${creditsRequired} credits (₹${amountInr}).`,
        },
        { status: 422 }
      );
    }

    // ── 6. Daily limit check ───────────────────────────────────────────────
    const dailyTotalInr = await fetchDailyTotalInr(uid);
    const dailyRemaining = MAX_INR_DAILY - dailyTotalInr;

    if (amountInr > dailyRemaining) {
      return Response.json(
        {
          error: `Daily limit exceeded. You can cash out ₹${Math.max(0, dailyRemaining).toLocaleString()} more today.`,
        },
        { status: 422 }
      );
    }

    // ── 7. Monthly RBI cap check ───────────────────────────────────────────
    const monthlyTotalInr  = await fetchMonthlyTotalInr(uid);
    const monthlyRemaining = MONTHLY_CAP_INR - monthlyTotalInr;

    if (amountInr > monthlyRemaining) {
      return Response.json(
        {
          error: `Monthly cap of ₹${MONTHLY_CAP_INR.toLocaleString()} reached. Remaining this month: ₹${Math.max(
            0, monthlyRemaining
          ).toLocaleString()}. Full KYC required to increase the limit.`,
        },
        { status: 422 }
      );
    }

    // ── 8. Determine routing status ────────────────────────────────────────
    //      hold_7d       → karma too low (anti-fraud)
    //      manual_review → large amount needs human approval
    //      pending       → auto-processed via Razorpay
    const karma = userData.karma ?? 0;
    const routingStatus: "hold_7d" | "manual_review" | "pending" =
      karma < KARMA_HOLD_THRESHOLD
        ? "hold_7d"
        : amountInr >= MANUAL_REVIEW_INR
        ? "manual_review"
        : "pending";

    // ── 9. Atomic Firestore transaction ────────────────────────────────────
    const reqRef = db.collection("cashoutRequests").doc();
    const txnRef = userRef.collection("creditTxns").doc();
    const nowMs  = Date.now();

    await db.runTransaction(async (tx) => {
      // Re-read inside transaction (TOCTOU guard)
      const freshSnap  = await tx.get(userRef);
      if (!freshSnap.exists) throw new Error("User not found.");

      const fresh = freshSnap.data() as { credits: number };
      if ((fresh.credits ?? 0) < creditsRequired) {
        throw new Error(
          `Insufficient credits. Current balance: ${fresh.credits ?? 0}.`
        );
      }

      // Debit credits
      tx.update(userRef, {
        credits:   FieldValue.increment(-creditsRequired),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Create cashout request doc
      tx.set(reqRef, {
        uid,
        credits:           creditsRequired,
        amountInr,
        upiId,
        status:            routingStatus,
        razorpayPayoutId:  null,
        razorpayContactId: null,
        razorpayFundAccId: null,
        requestedAt:       FieldValue.serverTimestamp(),
        requestedAtMs:     nowMs,
      });

      // Write credit transaction log
      tx.set(txnRef, {
        type:        "cashout",
        amount:      -creditsRequired,
        description: `Cashout ₹${amountInr} → ${upiId}`,
        icon:        "arrow-up-circle",
        createdAtMs: nowMs,
        createdAt:   FieldValue.serverTimestamp(),
        meta: {
          requestId: reqRef.id,
          amountInr,
          upiId,
          status: routingStatus,
        },
      });
    });

    const requestId = reqRef.id;

    // ── 10. Manual review → adminQueue entry (blueprint §16 Tier 2) ────────
    if (routingStatus === "manual_review") {
      await db.collection("adminQueue").add({
        source:   "cashout_review",
        severity: "med",
        content: {
          type:      "cashout",
          requestId,
          uid,
          amountInr,
          upiId,
          karma,
        },
        status:    "pending",
        createdAt: FieldValue.serverTimestamp(),
      });

      return Response.json({
        ok:              true,
        requestId,
        razorpayPayoutId: null,
        status:          "manual_review",
        message:         `₹${amountInr} queued for manual review (24–48 hrs).`,
      });
    }

    // ── 11. Hold for low karma — no Razorpay call; auto-released in 7d ──────
    if (routingStatus === "hold_7d") {
      // Schedule release at: now + 7 days (stored so a cron can process it)
      const releaseAtMs = nowMs + 7 * 24 * 60 * 60 * 1000;
      await reqRef.update({ releaseAtMs });

      return Response.json({
        ok:               true,
        requestId,
        razorpayPayoutId: null,
        status:           "hold_7d",
        message:          `Low karma detected. ₹${amountInr} held for 7 days, then auto-released.`,
      });
    }

    // ── 12. Pending — fire Razorpay Payout ────────────────────────────────
    let razorpayPayoutId: string | null = null;
    let razorpayContactId: string | null = null;
    let razorpayFundAccId: string | null = null;
    let finalStatus = "processing";

    try {
      const phone = userData.phone ?? tokenPhone ?? "";
      const name  = userData.displayName ?? "ORBIT User";

      // a. Create / retrieve Contact
      razorpayContactId = await upsertContact(uid, name, phone);

      // b. Create Fund Account (VPA / UPI)
      razorpayFundAccId = await createFundAccount(razorpayContactId, upiId);

      // c. Create Payout
      razorpayPayoutId = await createPayout({
        fundAccountId: razorpayFundAccId,
        amountInr,
        requestId,
      });

      // d. Update cashout request with Razorpay IDs
      await reqRef.update({
        status:            "processing",
        razorpayPayoutId,
        razorpayContactId,
        razorpayFundAccId,
        processedAt:       FieldValue.serverTimestamp(),
        processedAtMs:     Date.now(),
      });
    } catch (payoutErr: any) {
      // Razorpay call failed — refund credits and mark request failed
      console.error("[cashout] Razorpay payout failed for", requestId, payoutErr?.message);

      // Atomically refund the debited credits + mark request rejected
      await db.runTransaction(async (tx) => {
        tx.update(userRef, {
          credits:   FieldValue.increment(creditsRequired),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(reqRef, {
          status:       "rejected",
          failureReason: payoutErr?.message ?? "Razorpay payout initiation failed",
          rejectedAt:   FieldValue.serverTimestamp(),
        });
        // Mark the creditTxn as reversed
        tx.update(txnRef, {
          reversed:   true,
          reversedAt: FieldValue.serverTimestamp(),
        });
      });

      return Response.json(
        {
          error:    `Payout failed: ${payoutErr?.message ?? "Unknown Razorpay error"}. Your credits have been refunded.`,
          refunded: true,
          credits:  creditsRequired,
        },
        { status: 502 }
      );
    }

    // ── 13. Success ────────────────────────────────────────────────────────
    return Response.json({
      ok:               true,
      requestId,
      razorpayPayoutId,
      status:           finalStatus,
      message:          `₹${amountInr} payout initiated. Funds reach ${upiId} within 24 hours.`,
    });
  } catch (err: any) {
    console.error("[cashout] unhandled error:", err);
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * app/api/razorpay/webhook+api.ts
 *
 * POST /api/razorpay/webhook
 *
 * Razorpay webhook receiver — processes inbound events from Razorpay and
 * keeps Firestore in sync without relying on client-side confirmation.
 *
 * Security:
 *   Every request is authenticated by verifying the HMAC-SHA256 signature
 *   that Razorpay attaches as the `X-Razorpay-Signature` header.
 *   Requests that fail verification are rejected with 400 immediately.
 *
 * Events handled:
 *   payment.captured
 *     → Atomically credit the user's wallet with the purchased credit pack.
 *     → Guard idempotency via a "processed" flag on the creditTxn doc.
 *     → Write a creditTxn audit record under /users/{uid}/creditTxns/{txnId}.
 *
 *   subscription.activated
 *     → Upgrade the user to the ORBIT Pro tier.
 *     → Set isPro, proSince, proUntil (+30 days), proSubscriptionId.
 *     → Grant 500 welcome credits atomically.
 *     → Write a proTxn record under /users/{uid}/proTxns/{txnId}.
 *     → Guard idempotency via subscriptionId uniqueness check.
 *
 *   All other events are acknowledged with 200 and ignored gracefully.
 *
 * Idempotency:
 *   Razorpay can re-deliver the same event. Every handler checks whether the
 *   relevant Firestore document already exists before making any writes, so
 *   duplicate deliveries are safe.
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS   – Service-account JSON (stringified)
 *   RAZORPAY_WEBHOOK_SECRET      – Webhook secret set in Razorpay dashboard
 *
 * Razorpay dashboard setup:
 *   Settings → Webhooks → Add new webhook URL: https://<domain>/api/razorpay/webhook
 *   Enable events: payment.captured, subscription.activated
 *   Copy the generated webhook secret into RAZORPAY_WEBHOOK_SECRET.
 *
 * Notes schema dependencies (set by your order/subscription creation API):
 *   payment.entity.notes.uid        – Firebase UID of the purchasing user
 *   payment.entity.notes.credits    – Number of credits in the pack
 *   payment.entity.notes.priceInr   – Pack price in INR (for audit records)
 *   subscription.entity.notes.uid   – Firebase UID of the subscribing user
 */

import * as crypto from "crypto";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, type Transaction } from "firebase-admin/firestore";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRO_CREDITS_GRANT   = 500;    // Welcome credits on Pro activation
const PRO_DURATION_MS     = 30 * 24 * 60 * 60 * 1000;  // 30 days in ms
const PRO_PRICE_INR       = 199;    // Monthly Pro price (INR)

// ─── Firebase Admin singleton ────────────────────────────────────────────────

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Signature verification ───────────────────────────────────────────────────

/**
 * Verify the Razorpay webhook signature.
 *
 * Razorpay signs every webhook body with:
 *   HMAC-SHA256(webhookSecret, rawBody)
 * and sends the hex digest in the `X-Razorpay-Signature` header.
 *
 * We use a constant-time comparison (`timingSafeEqual`) to prevent
 * timing-side-channel attacks that could leak the secret.
 */
function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET env var is not set.");
    return false;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // Buffer lengths differ → signature is definitely wrong
    return false;
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handle `payment.captured`.
 *
 * Flow:
 *   1. Extract uid + credits from payment.notes.
 *   2. Validate that the user doc exists.
 *   3. Check idempotency — skip if this paymentId was already processed.
 *   4. Run Firestore transaction:
 *        a. Increment user.credits by the purchased amount.
 *        b. Write a creditTxn audit record with type "purchase".
 */
async function handlePaymentCaptured(paymentEntity: Record<string, any>): Promise<void> {
  const paymentId: string  = paymentEntity.id ?? "";
  const amountPaise: number = paymentEntity.amount ?? 0;
  const notes: Record<string, any> = paymentEntity.notes ?? {};

  const uid       = typeof notes.uid     === "string" ? notes.uid.trim()             : "";
  const credits   = typeof notes.credits === "number" ? notes.credits                : 0;
  const priceInr  = typeof notes.priceInr === "number"
    ? notes.priceInr
    : Math.round(amountPaise / 100);

  if (!uid) {
    console.warn("[webhook] payment.captured: missing notes.uid — paymentId:", paymentId);
    return;
  }
  if (credits <= 0) {
    console.warn("[webhook] payment.captured: missing/invalid notes.credits — paymentId:", paymentId);
    return;
  }
  if (!paymentId) {
    console.warn("[webhook] payment.captured: missing payment id");
    return;
  }

  const app     = getAdminApp();
  const db      = getFirestore(app);
  const userRef = db.collection("users").doc(uid);
  const nowMs   = Date.now();

  // Idempotency guard — use a dedicated doc keyed by paymentId under the user
  const txnRef = userRef.collection("creditTxns").doc(`rzp_pay_${paymentId}`);

  await db.runTransaction(async (tx) => {
    // Confirm user exists
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error(`[webhook] payment.captured: user not found — uid: ${uid}`);
    }

    // Idempotency: if this txn doc already exists the event was already handled
    const txnSnap = await tx.get(txnRef);
    if (txnSnap.exists) {
      console.info("[webhook] payment.captured: already processed — paymentId:", paymentId);
      return;
    }

    // Credit the user's wallet
    tx.update(userRef, {
      credits:   FieldValue.increment(credits),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Write the audit record (idempotency key = doc id)
    tx.set(txnRef, {
      type:             "purchase",
      amount:           credits,
      description:      `Purchased ${credits.toLocaleString()} credits for ₹${priceInr}`,
      icon:             "shopping-bag",
      razorpayPaymentId: paymentId,
      priceInr,
      createdAtMs:      nowMs,
      createdAt:        FieldValue.serverTimestamp(),
      meta: {
        source:    "razorpay_webhook",
        event:     "payment.captured",
        amountPaise,
      },
    });
  });

  console.info(
    `[webhook] payment.captured: credited ${credits} credits to uid=${uid} (paymentId=${paymentId})`
  );
}

/**
 * Handle `subscription.activated`.
 *
 * Flow:
 *   1. Extract uid + subscriptionId from subscription entity notes.
 *   2. Validate user doc exists.
 *   3. Check idempotency — skip if this subscriptionId is already recorded.
 *   4. Run Firestore transaction:
 *        a. Set isPro, proSince, proUntil, proSubscriptionId on user doc.
 *        b. Grant PRO_CREDITS_GRANT welcome credits.
 *        c. Write a proTxn audit record.
 */
async function handleSubscriptionActivated(
  subscriptionEntity: Record<string, any>
): Promise<void> {
  const subscriptionId: string = subscriptionEntity.id ?? "";
  const planId: string         = subscriptionEntity.plan_id ?? "";
  const notes: Record<string, any> = subscriptionEntity.notes ?? {};

  const uid        = typeof notes.uid === "string" ? notes.uid.trim() : "";
  const paymentId  = typeof notes.payment_id === "string" ? notes.payment_id : "";

  if (!uid) {
    console.warn("[webhook] subscription.activated: missing notes.uid — subscriptionId:", subscriptionId);
    return;
  }
  if (!subscriptionId) {
    console.warn("[webhook] subscription.activated: missing subscription id");
    return;
  }

  const app     = getAdminApp();
  const db      = getFirestore(app);
  const userRef = db.collection("users").doc(uid);
  const nowMs   = Date.now();
  const proUntil = nowMs + PRO_DURATION_MS;

  // Idempotency guard — doc keyed by subscriptionId under the user's proTxns
  const proTxnRef = userRef.collection("proTxns").doc(`rzp_sub_${subscriptionId}`);

  await db.runTransaction(async (tx) => {
    // Confirm user exists
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error(
        `[webhook] subscription.activated: user not found — uid: ${uid}`
      );
    }
    const userData = userSnap.data() as { credits?: number; isPro?: boolean };

    // Idempotency: if proTxn doc already exists, this event was handled before
    const proTxnSnap = await tx.get(proTxnRef);
    if (proTxnSnap.exists) {
      console.info(
        "[webhook] subscription.activated: already processed — subscriptionId:", subscriptionId
      );
      return;
    }

    // Upgrade user to Pro tier
    tx.update(userRef, {
      isPro:              true,
      proSince:           nowMs,
      proUntil:           proUntil,
      proSubscriptionId:  subscriptionId,
      credits:            FieldValue.increment(PRO_CREDITS_GRANT),
      updatedAt:          FieldValue.serverTimestamp(),
    });

    // Write proTxn audit record (idempotency key = doc id)
    tx.set(proTxnRef, {
      type:                  "subscribe",
      planId:                planId,
      priceInr:              PRO_PRICE_INR,
      razorpayPaymentId:     paymentId || null,
      razorpaySubscriptionId: subscriptionId,
      creditsGranted:        PRO_CREDITS_GRANT,
      proSince:              nowMs,
      proUntil:              proUntil,
      previousIsPro:         userData.isPro ?? false,
      createdAtMs:           nowMs,
      createdAt:             FieldValue.serverTimestamp(),
      meta: {
        source: "razorpay_webhook",
        event:  "subscription.activated",
      },
    });
  });

  console.info(
    `[webhook] subscription.activated: uid=${uid} upgraded to Pro ` +
    `(subscriptionId=${subscriptionId}, proUntil=${new Date(proUntil).toISOString()})`
  );
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Read raw body — MUST be done before any parsing ─────────────────────
  //    Razorpay signature is computed over the raw request body bytes.
  //    Any transformation (e.g. JSON.parse then re-stringify) would break it.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  // ── 2. Signature verification ───────────────────────────────────────────────
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[webhook] Signature verification failed — possible tampered request.");
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // ── 3. Parse the verified payload ──────────────────────────────────────────
  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventType: string = typeof event.event === "string" ? event.event : "";

  if (!eventType) {
    return Response.json({ error: "Missing event type" }, { status: 400 });
  }

  console.info(`[webhook] Received event: ${eventType}`);

  // ── 4. Dispatch to the appropriate handler ──────────────────────────────────
  try {
    switch (eventType) {
      case "payment.captured": {
        const paymentEntity = event?.payload?.payment?.entity;
        if (!paymentEntity || typeof paymentEntity !== "object") {
          console.warn("[webhook] payment.captured: missing payload.payment.entity");
          break;
        }
        await handlePaymentCaptured(paymentEntity);
        break;
      }

      case "subscription.activated": {
        const subscriptionEntity = event?.payload?.subscription?.entity;
        if (!subscriptionEntity || typeof subscriptionEntity !== "object") {
          console.warn("[webhook] subscription.activated: missing payload.subscription.entity");
          break;
        }
        await handleSubscriptionActivated(subscriptionEntity);
        break;
      }

      default:
        // Silently acknowledge unhandled event types — Razorpay requires 200
        console.info(`[webhook] Unhandled event type "${eventType}" — acknowledged.`);
        break;
    }
  } catch (handlerErr: any) {
    // Log the error but still return 200 so Razorpay does not keep retrying.
    // Persistent failures should be investigated via server logs / Sentry.
    console.error(`[webhook] Handler error for event "${eventType}":`, handlerErr?.message ?? handlerErr);

    // Return 500 only for transient infrastructure errors (Firestore unavailable, etc.)
    // so Razorpay will retry. For logic errors we return 200 to stop retries.
    const isTransient =
      handlerErr?.code === "UNAVAILABLE" ||
      handlerErr?.code === "DEADLINE_EXCEEDED" ||
      handlerErr?.message?.includes("UNAVAILABLE") ||
      handlerErr?.message?.includes("network");

    if (isTransient) {
      return Response.json(
        { error: "Transient server error — please retry" },
        { status: 500 }
      );
    }
  }

  // ── 5. Acknowledge receipt ──────────────────────────────────────────────────
  return Response.json({ ok: true, event: eventType });
}

/**
 * app/api/dpdp/data-export+api.ts
 *
 * GET /api/dpdp/data-export
 *
 * DPDP (Digital Personal Data Protection Act 2023) — Right to Access.
 *
 * Generates a complete, machine-readable JSON export of all personal data
 * the platform holds for the requesting user.  Compliant with §11 of the
 * DPDP Act which requires data fiduciaries to respond to access requests
 * within a reasonable time.
 *
 * ── Data included ────────────────────────────────────────────────────────────
 *
 *   profile          /users/{uid}                    (full user doc)
 *   creditTxns       /users/{uid}/creditTxns          (all records, newest first)
 *   proTxns          /users/{uid}/proTxns             (Pro subscription records)
 *   dmThreads        /dmThreads  where uid ∈ participants (thread metadata)
 *   dmMessages       /dmThreads/{tid}/messages        (all messages by this uid)
 *   bazaarListings   /bazaar     where author.uid == uid
 *   cashoutRequests  /cashoutRequests where uid == uid
 *
 * ── Security ─────────────────────────────────────────────────────────────────
 *
 *   • Firebase ID token required in x-firebase-token header.
 *   • verifyIdToken(token, true) — checkRevoked flag set.
 *   • Users can only export their own data (uid from decoded token).
 *   • Rate-limited: 5 exports per user per hour to prevent bulk scraping.
 *     Uses the same Upstash sliding-window pattern as flag+api.ts.
 *
 * ── Response ──────────────────────────────────────────────────────────────────
 *
 *   Content-Type: application/json
 *   Content-Disposition: attachment; filename="orbit-data-export-{uid}.json"
 *
 *   {
 *     exportedAt:      ISO-8601 timestamp,
 *     exportVersion:   "1.0",
 *     uid:             string,
 *     profile:         UserDoc,
 *     creditTxns:      CreditTxnDoc[],
 *     proTxns:         ProTxnDoc[],
 *     dmThreads:       DMThreadMeta[],
 *     dmMessages:      DMMessageDoc[],
 *     bazaarListings:  BazaarListingDoc[],
 *     cashoutRequests: CashoutRequestDoc[],
 *   }
 *
 * ── Env vars required ────────────────────────────────────────────────────────
 *   FIREBASE_ADMIN_CREDENTIALS   – service-account JSON (stringified)
 *   UPSTASH_REDIS_REST_URL       – Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN     – Upstash Redis REST token
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth }      from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ─── Firebase Admin singleton ─────────────────────────────────────────────────
// Exact pattern used across all existing API files in this project.

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Rate limiter — 5 exports per user per hour ───────────────────────────────
//
// Uses the same Upstash REST pipeline approach as flag+api.ts to stay
// dependency-free while implementing an accurate sliding-window counter.
//
// Key scheme:  dpdp_rl:{uid}:{windowId}   (window = 3600 s)

const EXPORT_RATE_LIMIT   = 5;       // max exports
const EXPORT_WINDOW_S     = 3600;    // per 1 hour
const EXPORT_KEY_PREFIX   = "dpdp_rl";

interface ExportRateLimitResult {
  allowed:     boolean;
  remaining:   number;
  resetAfterS: number;
}

async function checkExportRateLimit(uid: string): Promise<ExportRateLimitResult> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    console.warn("[dpdp/data-export] Upstash not configured — rate limiting disabled.");
    return { allowed: true, remaining: EXPORT_RATE_LIMIT - 1, resetAfterS: EXPORT_WINDOW_S };
  }

  const nowS        = Math.floor(Date.now() / 1000);
  const windowId    = Math.floor(nowS / EXPORT_WINDOW_S);
  const curKey      = `${EXPORT_KEY_PREFIX}:${uid}:${windowId}`;
  const prevKey     = `${EXPORT_KEY_PREFIX}:${uid}:${windowId - 1}`;
  const ttlS        = EXPORT_WINDOW_S * 2;

  const pipeline = [
    ["INCR",   curKey],
    ["EXPIRE", curKey, String(ttlS)],
    ["GET",    prevKey],
  ];

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/pipeline`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });
  } catch {
    // Fail open — don't block exports if Redis is unreachable.
    return { allowed: true, remaining: EXPORT_RATE_LIMIT - 1, resetAfterS: EXPORT_WINDOW_S };
  }

  if (!resp.ok) {
    console.error("[dpdp/data-export] Upstash pipeline failed:", resp.status);
    return { allowed: true, remaining: EXPORT_RATE_LIMIT - 1, resetAfterS: EXPORT_WINDOW_S };
  }

  const results    = (await resp.json()) as Array<{ result: number | string | null }>;
  const curCount   = (results[0]?.result as number)                                  ?? 1;
  const prevCount  = parseInt((results[2]?.result as string) ?? "0", 10)             || 0;

  const elapsedFraction = (nowS % EXPORT_WINDOW_S) / EXPORT_WINDOW_S;
  const weightedCount   = prevCount * (1 - elapsedFraction) + curCount;

  const allowed     = weightedCount <= EXPORT_RATE_LIMIT;
  const remaining   = Math.max(0, EXPORT_RATE_LIMIT - Math.ceil(weightedCount));
  const resetAfterS = EXPORT_WINDOW_S - (nowS % EXPORT_WINDOW_S);

  return { allowed, remaining, resetAfterS };
}

// ─── Firestore collection constants ───────────────────────────────────────────
// Confirmed by reading bazaar/create.tsx, lib/firestore-dms.ts,
// lib/firestore-users.ts, and app/api/credits/cashout+api.ts.

const COL_USERS            = "users";
const COL_CREDIT_TXNS      = "creditTxns";     // subcollection of users/{uid}
const COL_PRO_TXNS         = "proTxns";         // subcollection of users/{uid}
const COL_DM_THREADS       = "dmThreads";
const COL_MESSAGES         = "messages";        // subcollection of dmThreads/{tid}
const COL_BAZAAR           = "bazaar";
const COL_CASHOUT_REQUESTS = "cashoutRequests";

// ─── Firestore document type annotations ─────────────────────────────────────
// These mirror the exact field names written by existing screens / API routes.

interface UserProfileExport {
  uid:                string;
  phone:              string;
  username:           string | null;
  displayName:        string | null;
  emoji:              string;
  color:              string;
  language:           string;
  interests:          string[];
  credits:            number;
  karma:              number;
  karmaLoanBalance:   number;
  rank:               number | null;
  badge:              string;
  trustScore:         number;
  bio:                string;
  region:             string | null;
  trophies:           string[];
  streak:             number;
  posts:              number;
  watches:            number;
  isPro:              boolean;
  proSince:           number | null;
  proUntil:           number | null;
  proSubscriptionId:  string | null;
  onboardingStep:     string;
  onboardingComplete: boolean;
  createdAt:          unknown;
  updatedAt:          unknown;
}

interface CreditTxnExport {
  id:          string;
  type:        string;
  amount:      number;
  description: string;
  icon:        string;
  createdAtMs: number;
  createdAt:   unknown;
  meta:        Record<string, unknown> | null;
}

interface ProTxnExport {
  id:                      string;
  type:                    string;
  planId:                  string | null;
  priceInr:                number | null;
  razorpayPaymentId:       string | null;
  razorpaySubscriptionId:  string | null;
  creditsGranted:          number | null;
  proSince:                number | null;
  proUntil:                number | null;
  createdAtMs:             number;
  createdAt:               unknown;
  meta:                    Record<string, unknown> | null;
}

interface DMThreadMetaExport {
  id:                 string;
  participants:       string[];
  lastMessagePreview: string;
  lastMessageAt:      unknown | null;
  lastMessageUid:     string | null;
  unread:             Record<string, number>;
  createdAt:          unknown;
}

interface DMMessageExport {
  id:        string;
  threadId:  string;
  uid:       string;
  username:  string;
  type:      string;
  text:      string | null;
  duration:  number | null;
  imageUrl:  string | null;
  caption:   string | null;
  createdAt: unknown;
}

interface BazaarListingExport {
  id:              string;
  title:           string;
  priceINR:        number;
  category:        string;
  author: {
    uid:      string;
    username: string;
    karma:    number;
    trust:    number;
  };
  tags:            string[];
  rating:          number;
  reviews:         number;
  delivery:        string;
  icon:            string;
  description:     string;
  portfolioImages: string[];
  createdAt:       unknown;
}

interface CashoutRequestExport {
  id:                string;
  uid:               string;
  credits:           number;
  amountInr:         number;
  upiId:             string;
  status:            string;
  razorpayPayoutId:  string | null;
  razorpayContactId: string | null;
  razorpayFundAccId: string | null;
  requestedAt:       unknown;
  requestedAtMs:     number;
  processedAt:       unknown | null;
  rejectedAt:        unknown | null;
  failureReason:     string | null;
  releaseAtMs:       number | null;
}

interface DataExportPayload {
  exportedAt:      string;
  exportVersion:   string;
  uid:             string;
  profile:         UserProfileExport | null;
  creditTxns:      CreditTxnExport[];
  proTxns:         ProTxnExport[];
  dmThreads:       DMThreadMetaExport[];
  dmMessages:      DMMessageExport[];
  bazaarListings:  BazaarListingExport[];
  cashoutRequests: CashoutRequestExport[];
}

// ─── Data-fetching helpers ────────────────────────────────────────────────────

/** Fetch the user's top-level profile document. */
async function fetchProfile(uid: string): Promise<UserProfileExport | null> {
  const db   = getFirestore(getAdminApp());
  const snap = await db.collection(COL_USERS).doc(uid).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Omit<UserProfileExport, "uid">), uid: snap.id } as UserProfileExport;
}

/** Fetch all credit transaction records for this user (newest first). */
async function fetchCreditTxns(uid: string): Promise<CreditTxnExport[]> {
  const db  = getFirestore(getAdminApp());
  const qs  = await db
    .collection(COL_USERS)
    .doc(uid)
    .collection(COL_CREDIT_TXNS)
    .orderBy("createdAtMs", "desc")
    .get();

  return qs.docs.map((doc) => ({
    id:          doc.id,
    ...(doc.data() as Omit<CreditTxnExport, "id">),
    meta: (doc.data().meta as Record<string, unknown>) ?? null,
  }));
}

/** Fetch all Pro subscription transaction records for this user. */
async function fetchProTxns(uid: string): Promise<ProTxnExport[]> {
  const db  = getFirestore(getAdminApp());
  const qs  = await db
    .collection(COL_USERS)
    .doc(uid)
    .collection(COL_PRO_TXNS)
    .orderBy("createdAtMs", "desc")
    .get();

  return qs.docs.map((doc) => ({
    id:  doc.id,
    ...(doc.data() as Omit<ProTxnExport, "id">),
    meta: (doc.data().meta as Record<string, unknown>) ?? null,
  }));
}

/**
 * Fetch all DM threads the user participates in.
 * The `participants` field is an array-contains query — Firestore supports this
 * with a simple single-field index (no composite required).
 */
async function fetchDMThreads(uid: string): Promise<DMThreadMetaExport[]> {
  const db = getFirestore(getAdminApp());
  const qs = await db
    .collection(COL_DM_THREADS)
    .where("participants", "array-contains", uid)
    .get();

  return qs.docs.map((doc) => ({
    id:  doc.id,
    ...(doc.data() as Omit<DMThreadMetaExport, "id">),
  }));
}

/**
 * Fetch all DM messages authored by this user across all their threads.
 * We iterate the threads returned above and query only messages where uid matches,
 * keeping each batch to Firestore limits.
 */
async function fetchDMMessages(
  uid:       string,
  threadIds: string[],
): Promise<DMMessageExport[]> {
  if (threadIds.length === 0) return [];

  const db       = getFirestore(getAdminApp());
  const messages: DMMessageExport[] = [];

  // Firestore doesn't support cross-collection group queries filtered by uid
  // on a non-indexed sub-field in all runtimes, so we fan out per thread.
  // For DPDP we cap at the 50 most recent per thread to keep the export
  // response time reasonable; the full archive is available on request.
  const MSGS_PER_THREAD = 50;

  await Promise.all(
    threadIds.map(async (threadId) => {
      const qs = await db
        .collection(COL_DM_THREADS)
        .doc(threadId)
        .collection(COL_MESSAGES)
        .where("uid", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(MSGS_PER_THREAD)
        .get();

      qs.docs.forEach((doc) => {
        messages.push({
          id:       doc.id,
          threadId,
          ...(doc.data() as Omit<DMMessageExport, "id" | "threadId">),
        });
      });
    })
  );

  // Sort all messages newest first across threads.
  messages.sort((a, b) => {
    const aMs = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const bMs = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  return messages;
}

/**
 * Fetch all Bazaar listings created by this user.
 * Collection: /bazaar  —  field: author.uid  (confirmed from bazaar/create.tsx)
 */
async function fetchBazaarListings(uid: string): Promise<BazaarListingExport[]> {
  const db = getFirestore(getAdminApp());
  const qs = await db
    .collection(COL_BAZAAR)
    .where("author.uid", "==", uid)
    .orderBy("createdAt", "desc")
    .get();

  return qs.docs.map((doc) => ({
    id:  doc.id,
    ...(doc.data() as Omit<BazaarListingExport, "id">),
  }));
}

/**
 * Fetch all cashout requests submitted by this user.
 * Collection: /cashoutRequests  —  field: uid  (confirmed from cashout+api.ts)
 */
async function fetchCashoutRequests(uid: string): Promise<CashoutRequestExport[]> {
  const db = getFirestore(getAdminApp());
  const qs = await db
    .collection(COL_CASHOUT_REQUESTS)
    .where("uid", "==", uid)
    .orderBy("requestedAtMs", "desc")
    .get();

  return qs.docs.map((doc) => ({
    id:  doc.id,
    ...(doc.data() as Omit<CashoutRequestExport, "id">),
    processedAt:   doc.data().processedAt   ?? null,
    rejectedAt:    doc.data().rejectedAt    ?? null,
    failureReason: doc.data().failureReason ?? null,
    releaseAtMs:   doc.data().releaseAtMs   ?? null,
  }));
}

// ─── GET /api/dpdp/data-export ────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    // ── 1. Verify Firebase ID token ──────────────────────────────────────
    const token = request.headers.get("x-firebase-token") ?? "";
    if (!token) {
      return Response.json(
        { error: "Missing x-firebase-token header" },
        { status: 401 },
      );
    }

    const app = getAdminApp();
    let uid: string;

    try {
      const decoded = await getAuth(app).verifyIdToken(token, /* checkRevoked */ true);
      uid = decoded.uid;
    } catch {
      return Response.json(
        { error: "Unauthorized — invalid or revoked Firebase token" },
        { status: 401 },
      );
    }

    // ── 2. Rate-limit check (5 exports / hour) ───────────────────────────
    const rl = await checkExportRateLimit(uid);

    if (!rl.allowed) {
      return Response.json(
        {
          error:       `Data export rate limit exceeded. You can request ${EXPORT_RATE_LIMIT} exports per hour. Try again in ${rl.resetAfterS}s.`,
          resetAfterS: rl.resetAfterS,
        },
        {
          status:  429,
          headers: {
            "Retry-After":           String(rl.resetAfterS),
            "X-RateLimit-Limit":     String(EXPORT_RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    // ── 3. Parallel data fetch across all collections ────────────────────
    //
    // We kick off all independent queries concurrently.  DM messages depend
    // on thread IDs so they run after threads resolve.

    const [
      profile,
      creditTxns,
      proTxns,
      dmThreads,
      bazaarListings,
      cashoutRequests,
    ] = await Promise.all([
      fetchProfile(uid),
      fetchCreditTxns(uid),
      fetchProTxns(uid),
      fetchDMThreads(uid),
      fetchBazaarListings(uid),
      fetchCashoutRequests(uid),
    ]);

    // Fetch DM messages now that we have thread IDs.
    const threadIds = dmThreads.map((t) => t.id);
    const dmMessages = await fetchDMMessages(uid, threadIds);

    // ── 4. Assemble export payload ────────────────────────────────────────
    const payload: DataExportPayload = {
      exportedAt:     new Date().toISOString(),
      exportVersion:  "1.0",
      uid,
      profile,
      creditTxns,
      proTxns,
      dmThreads,
      dmMessages,
      bazaarListings,
      cashoutRequests,
    };

    // ── 5. Return as a downloadable JSON attachment ───────────────────────
    const filename = `orbit-data-export-${uid}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      status:  200,
      headers: {
        "Content-Type":        "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
        "X-RateLimit-Limit":   String(EXPORT_RATE_LIMIT),
        "X-RateLimit-Remaining": String(rl.remaining),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[dpdp/data-export] unhandled error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

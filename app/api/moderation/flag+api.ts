/**
 * app/api/moderation/flag+api.ts
 *
 * POST /api/moderation/flag
 *
 * Server-side content moderation endpoint (blueprint §16 — Tier 1 auto-handle).
 *
 * Flow:
 *   1. Verify Firebase ID token (x-firebase-token header).
 *   2. Enforce per-user rate limiting via Upstash Redis (sliding window).
 *   3. Validate and normalise request body: { text, type, contentId, uid? }.
 *   4. Call the OpenAI Moderation API (free, no quota limit) on the text.
 *   5. If not flagged → return { flagged: false } immediately.
 *   6. If flagged:
 *        a. Compute severity from the triggered categories.
 *        b. Write a document to /adminQueue for human review (Tier 2)
 *           OR auto-hide if confidence is very high (Tier 1).
 *        c. Optionally write a user-facing report record if the content
 *           belongs to another user (reports/{reportId}).
 *   7. Return { flagged, categories, severity, adminQueueId? }.
 *
 * Severity mapping (blueprint §16):
 *   "crit" → sexual/minors, CSAM-adjacent → Tier 3 immediate action
 *   "high" → violence, threats, hate/threatening → Tier 3 priority
 *   "med"  → harassment, hate, self-harm, illicit → Tier 2 queue (24h SLA)
 *   "low"  → remaining flags → Tier 2 queue (low priority)
 *
 * Rate limiting:
 *   10 moderation requests per user per minute (sliding window).
 *   Requests over the limit receive HTTP 429 with Retry-After header.
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS      – Service-account JSON (stringified)
 *   OPENAI_API_KEY                  – OpenAI API key (Moderation API is free)
 *   UPSTASH_REDIS_REST_URL          – Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN        – Upstash Redis REST token
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth }      from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ─── Firebase Admin singleton ────────────────────────────────────────────────

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Upstash rate limiter (sliding window) ────────────────────────────────────
//
// Uses Upstash Redis REST API directly (no Node SDK needed) for maximum
// compatibility with edge / serverless runtimes.
//
// Implementation: sliding window counter via two Redis keys per user:
//   mod_rl:{uid}:cur   – count in the current window
//   mod_rl:{uid}:prev  – count in the previous window
// We approximate the sliding window using the weighted sum approach that
// @upstash/ratelimit uses internally, but without the npm dependency.

const RATE_LIMIT_REQUESTS = 10;    // max requests
const RATE_LIMIT_WINDOW_S = 60;    // per 60 seconds

interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
  resetAfterS: number;
}

async function checkRateLimit(uid: string): Promise<RateLimitResult> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fallback: if Upstash is not configured, allow all requests
  if (!baseUrl || !token) {
    console.warn("[moderation/flag] Upstash not configured — rate limiting disabled.");
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetAfterS: RATE_LIMIT_WINDOW_S };
  }

  const nowS     = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(nowS / RATE_LIMIT_WINDOW_S);
  const curKey   = `mod_rl:${uid}:${windowId}`;
  const prevKey  = `mod_rl:${uid}:${windowId - 1}`;

  // Pipeline: INCR curKey, EXPIRE curKey, GET prevKey
  const pipeline = [
    ["INCR", curKey],
    ["EXPIRE", curKey, String(RATE_LIMIT_WINDOW_S * 2)],
    ["GET", prevKey],
  ];

  const resp = await fetch(`${baseUrl}/pipeline`, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pipeline),
  });

  if (!resp.ok) {
    // Fail open — don't block requests if Redis is down
    console.error("[moderation/flag] Upstash pipeline failed:", resp.status);
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetAfterS: RATE_LIMIT_WINDOW_S };
  }

  const results = (await resp.json()) as Array<{ result: number | string | null }>;
  const curCount  = (results[0]?.result as number) ?? 1;
  const prevCount = parseInt((results[2]?.result as string) ?? "0", 10) || 0;

  // Sliding window approximation: weight previous window by elapsed fraction
  const elapsedFraction = (nowS % RATE_LIMIT_WINDOW_S) / RATE_LIMIT_WINDOW_S;
  const weightedCount   = prevCount * (1 - elapsedFraction) + curCount;

  const allowed   = weightedCount <= RATE_LIMIT_REQUESTS;
  const remaining = Math.max(0, RATE_LIMIT_REQUESTS - Math.ceil(weightedCount));
  const resetAfterS = RATE_LIMIT_WINDOW_S - (nowS % RATE_LIMIT_WINDOW_S);

  return { allowed, remaining, resetAfterS };
}

// ─── OpenAI Moderation API ────────────────────────────────────────────────────

interface OpenAIModerationCategory {
  harassment:               boolean;
  "harassment/threatening": boolean;
  hate:                     boolean;
  "hate/threatening":       boolean;
  "self-harm":              boolean;
  "self-harm/instructions": boolean;
  "self-harm/intent":       boolean;
  sexual:                   boolean;
  "sexual/minors":          boolean;
  violence:                 boolean;
  "violence/graphic":       boolean;
  illicit:                  boolean;
  "illicit/violent":        boolean;
}

interface OpenAIModerationScore {
  [category: string]: number;
}

interface OpenAIModerationResult {
  flagged:          boolean;
  categories:       OpenAIModerationCategory;
  category_scores:  OpenAIModerationScore;
}

interface OpenAIModerationResponse {
  id:      string;
  model:   string;
  results: OpenAIModerationResult[];
}

async function callOpenAIModeration(text: string): Promise<OpenAIModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY env var is not set.");

  const resp = await fetch("https://api.openai.com/v1/moderations", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI Moderation API error (${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as OpenAIModerationResponse;
  const result = data?.results?.[0];
  if (!result) throw new Error("OpenAI Moderation API returned empty results.");

  return result;
}

// ─── Severity computation ─────────────────────────────────────────────────────

type Severity = "crit" | "high" | "med" | "low";

function computeSeverity(
  categories: OpenAIModerationCategory,
  scores: OpenAIModerationScore
): Severity {
  // CRIT — any sexual content involving minors
  if (categories["sexual/minors"]) return "crit";

  // HIGH — violence, graphic violence, hate threats, illicit violence
  if (
    categories["violence/graphic"]      ||
    categories["hate/threatening"]      ||
    categories["illicit/violent"]       ||
    (categories.violence && (scores["violence"] ?? 0) > 0.85)
  ) {
    return "high";
  }

  // MED — harassment, hate, self-harm, illicit
  if (
    categories.harassment               ||
    categories["harassment/threatening"] ||
    categories.hate                     ||
    categories["self-harm"]             ||
    categories["self-harm/instructions"]||
    categories["self-harm/intent"]      ||
    categories.illicit
  ) {
    return "med";
  }

  // LOW — everything else that is still flagged
  return "low";
}

// Whether the confidence is high enough to auto-hide (Tier 1 — no human needed)
function shouldAutoHide(
  categories: OpenAIModerationCategory,
  scores: OpenAIModerationScore
): boolean {
  if (categories["sexual/minors"])                       return true;
  if (categories["violence/graphic"] && (scores["violence/graphic"] ?? 0) > 0.95) return true;
  if (categories["hate/threatening"]  && (scores["hate/threatening"]  ?? 0) > 0.95) return true;
  return false;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    // ── 1. Verify Firebase ID token ────────────────────────────────────────
    const token = request.headers.get("x-firebase-token") ?? "";
    if (!token) {
      return Response.json({ error: "Missing x-firebase-token header" }, { status: 401 });
    }

    const app = getAdminApp();
    let callerUid: string;

    try {
      const decoded = await getAuth(app).verifyIdToken(token, /* checkRevoked */ true);
      callerUid = decoded.uid;
    } catch {
      return Response.json({ error: "Unauthorized — invalid or revoked Firebase token" }, { status: 401 });
    }

    // ── 2. Rate limiting ───────────────────────────────────────────────────
    const rl = await checkRateLimit(callerUid);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
        {
          status: 429,
          headers: {
            "Content-Type":  "application/json",
            "Retry-After":   String(rl.resetAfterS),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset":     String(Math.floor(Date.now() / 1000) + rl.resetAfterS),
          },
        }
      );
    }

    // ── 3. Parse and validate request body ────────────────────────────────
    let body: {
      text?:      unknown;
      type?:      unknown;
      contentId?: unknown;
      uid?:       unknown;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const text      = typeof body.text      === "string" ? body.text.trim()      : "";
    const type      = typeof body.type      === "string" ? body.type.trim()      : "unknown";
    const contentId = typeof body.contentId === "string" ? body.contentId.trim() : "";
    // uid of the content author (may differ from caller when reporting someone else's content)
    const authorUid = typeof body.uid === "string" ? body.uid.trim() : callerUid;

    if (!text) {
      return Response.json({ error: "text field is required and must be non-empty" }, { status: 400 });
    }
    if (text.length > 4096) {
      return Response.json({ error: "text exceeds 4096 character limit" }, { status: 400 });
    }

    // ── 4. Call OpenAI Moderation API ─────────────────────────────────────
    let moderationResult: OpenAIModerationResult;
    try {
      moderationResult = await callOpenAIModeration(text);
    } catch (modErr: any) {
      console.error("[moderation/flag] OpenAI API error:", modErr?.message);
      return Response.json(
        { error: "Moderation service unavailable. Please try again." },
        { status: 503 }
      );
    }

    // ── 5. Not flagged — return clean result ──────────────────────────────
    if (!moderationResult.flagged) {
      return Response.json({
        flagged:   false,
        categories: {},
        severity:  null,
        adminQueueId: null,
      });
    }

    // ── 6. Content is flagged — compute severity and persist ──────────────
    const severity  = computeSeverity(moderationResult.categories, moderationResult.category_scores);
    const autoHide  = shouldAutoHide(moderationResult.categories, moderationResult.category_scores);

    // Collect which categories were triggered
    const triggeredCategories = Object.entries(moderationResult.categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    const db    = getFirestore(app);
    const nowMs = Date.now();

    // Write to /adminQueue (blueprint §16 — Tier 2 queue)
    const queueRef = db.collection("adminQueue").doc();

    await queueRef.set({
      source:    "openai_mod",
      severity,
      autoHide,
      content: {
        type,
        contentId:  contentId || null,
        authorUid,
        reporterUid: callerUid !== authorUid ? callerUid : null,
        // Store a truncated excerpt (never the full text for CRIT content)
        textExcerpt: severity === "crit"
          ? "[REDACTED — CRIT severity]"
          : text.slice(0, 500),
        categories:  triggeredCategories,
        scores: moderationResult.category_scores,
      },
      status:       "pending",
      tier:         severity === "crit" || severity === "high" ? 3 : 2,
      createdAtMs:  nowMs,
      createdAt:    FieldValue.serverTimestamp(),
    });

    const adminQueueId = queueRef.id;

    // For CRIT/HIGH auto-hide: write a flag onto the content doc if contentId known
    if (autoHide && contentId && type) {
      try {
        const collectionMap: Record<string, string> = {
          message:  "messages",
          room:     "rooms",
          bazaar:   "bazaar",
          profile:  "users",
          dm:       "dmMessages",
        };
        const collectionName = collectionMap[type];
        if (collectionName) {
          await db.collection(collectionName).doc(contentId).update({
            hidden:       true,
            hiddenReason: "auto_moderation",
            hiddenAt:     FieldValue.serverTimestamp(),
          });
        }
      } catch (hideErr: any) {
        // Non-fatal — content may not exist or we may lack the field path
        console.warn("[moderation/flag] auto-hide write failed:", hideErr?.message);
      }
    }

    console.info(
      `[moderation/flag] Flagged content — uid=${authorUid}, type=${type}, ` +
      `severity=${severity}, autoHide=${autoHide}, queueId=${adminQueueId}, ` +
      `categories=${triggeredCategories.join(",")}`
    );

    // ── 7. Return result ─────────────────────────────────────────────────
    return Response.json({
      flagged:      true,
      categories:   triggeredCategories,
      severity,
      autoHide,
      adminQueueId,
      remaining:    rl.remaining,
    });
  } catch (err: any) {
    console.error("[moderation/flag] Unhandled error:", err?.message ?? err);
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

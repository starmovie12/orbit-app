/**
 * app/api/rate-limit+api.ts
 *
 * Upstash Redis sliding-window rate limiter — reusable middleware + standalone
 * API health/status endpoint.
 *
 * ── Dual purpose ─────────────────────────────────────────────────────────────
 *
 * 1. EXPORTED UTILITY — `checkRateLimit(uid, limitReqs?, windowS?)`
 *    Other API files import this to enforce per-user rate limits without
 *    duplicating the Upstash pipeline logic.  The default limit is 100 req/min.
 *
 * 2. GET /api/rate-limit
 *    Returns the caller's current rate-limit status (remaining requests and
 *    reset time) without consuming a request slot.  Useful for client-side
 *    throttle indicators.
 *
 * POST /api/rate-limit
 *    Consumes one request slot and returns the updated status, or HTTP 429
 *    with a Retry-After header if the limit has been exceeded.  Other API
 *    routes can proxy here or — more efficiently — import checkRateLimit()
 *    directly to avoid an extra HTTP hop.
 *
 * ── Sliding-window algorithm ─────────────────────────────────────────────────
 *
 * Mirrors the @upstash/ratelimit sliding-window implementation but uses only
 * the Upstash REST API, keeping this file compatible with every serverless /
 * edge runtime without an extra npm dependency.
 *
 * Per-user Redis keys (TTL = 2× window so Redis GC handles cleanup):
 *   rl:{prefix}:{uid}:{windowId}      ← count of requests in current window
 *   rl:{prefix}:{uid}:{windowId - 1}  ← count in previous window
 *
 * Weighted approximation:
 *   weighted = prevCount × (1 − elapsedFraction) + curCount
 *   allowed  = weighted ≤ limit
 *
 * ── Env vars required ────────────────────────────────────────────────────────
 *   FIREBASE_ADMIN_CREDENTIALS   – service-account JSON (stringified)
 *   UPSTASH_REDIS_REST_URL       – Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN     – Upstash Redis REST token
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// ─── Firebase Admin singleton ─────────────────────────────────────────────────
// Exact pattern used by cashout+api.ts, flag+api.ts, pusher/auth+api.ts, etc.

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default per-user request limit per window. */
export const DEFAULT_RATE_LIMIT_REQUESTS = 100;

/** Default window size in seconds. */
export const DEFAULT_RATE_LIMIT_WINDOW_S = 60;

/** Redis key prefix to namespace these limits away from other uses. */
const KEY_PREFIX = "rl:global";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  /** Whether this request is permitted. */
  allowed:     boolean;
  /** Remaining slots in the current sliding window (floored). */
  remaining:   number;
  /** Seconds until the window fully resets. */
  resetAfterS: number;
  /** Approximate total weighted count so far in this window. */
  current:     number;
  /** The hard limit in effect. */
  limit:       number;
}

// ─── Core sliding-window function ────────────────────────────────────────────

/**
 * Check (and optionally consume) a rate-limit slot for the given uid.
 *
 * @param uid        Firebase UID of the caller.
 * @param limitReqs  Max requests allowed per window (default 100).
 * @param windowS    Window size in seconds (default 60).
 * @param consume    If true (default), increment the counter.
 *                   Pass false for a read-only peek (GET handler).
 * @param prefix     Optional key namespace override.
 *
 * Fails open — if Upstash is unreachable, the request is allowed so a Redis
 * outage never causes a service-wide outage.
 */
export async function checkRateLimit(
  uid:       string,
  limitReqs: number  = DEFAULT_RATE_LIMIT_REQUESTS,
  windowS:   number  = DEFAULT_RATE_LIMIT_WINDOW_S,
  consume:   boolean = true,
  prefix:    string  = KEY_PREFIX,
): Promise<RateLimitResult> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fail open when Upstash is not configured (local dev / CI without Redis).
  if (!baseUrl || !token) {
    console.warn("[rate-limit] Upstash not configured — rate limiting disabled.");
    return {
      allowed:     true,
      remaining:   limitReqs - 1,
      resetAfterS: windowS,
      current:     1,
      limit:       limitReqs,
    };
  }

  const nowS        = Math.floor(Date.now() / 1000);
  const windowId    = Math.floor(nowS / windowS);
  const curKey      = `${prefix}:${uid}:${windowId}`;
  const prevKey     = `${prefix}:${uid}:${windowId - 1}`;
  // TTL = 2× window so the previous-window key is available for the full next
  // window before Redis evicts it.
  const ttlS        = windowS * 2;

  // Build Upstash pipeline depending on whether we want to consume a slot.
  const pipeline: string[][] = consume
    ? [
        ["INCR",   curKey],
        ["EXPIRE", curKey, String(ttlS)],
        ["GET",    prevKey],
      ]
    : [
        // Read-only peek: GET both keys without incrementing.
        ["GET", curKey],
        ["GET", prevKey],
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
  } catch (fetchErr) {
    // Network error — fail open.
    console.error("[rate-limit] Upstash fetch error:", fetchErr);
    return {
      allowed:     true,
      remaining:   limitReqs - 1,
      resetAfterS: windowS,
      current:     1,
      limit:       limitReqs,
    };
  }

  if (!resp.ok) {
    // Non-2xx from Upstash — fail open.
    console.error("[rate-limit] Upstash pipeline responded:", resp.status);
    return {
      allowed:     true,
      remaining:   limitReqs - 1,
      resetAfterS: windowS,
      current:     1,
      limit:       limitReqs,
    };
  }

  const results = (await resp.json()) as Array<{ result: number | string | null }>;

  // In consume mode:  results[0] = INCR (new curCount),  results[2] = GET prevKey
  // In peek mode:     results[0] = GET curKey,            results[1] = GET prevKey
  const curCount = consume
    ? ((results[0]?.result as number) ?? 1)
    : (parseInt((results[0]?.result as string) ?? "0", 10) || 0);

  const prevIndex  = consume ? 2 : 1;
  const prevCount  = parseInt((results[prevIndex]?.result as string) ?? "0", 10) || 0;

  // Weighted sliding window approximation.
  const elapsedFraction = (nowS % windowS) / windowS;
  const weightedCount   = prevCount * (1 - elapsedFraction) + curCount;

  const allowed     = weightedCount <= limitReqs;
  const remaining   = Math.max(0, limitReqs - Math.ceil(weightedCount));
  const resetAfterS = windowS - (nowS % windowS);

  return {
    allowed,
    remaining,
    resetAfterS,
    current: Math.ceil(weightedCount),
    limit:   limitReqs,
  };
}

// ─── Auth helper — shared by GET and POST handlers ────────────────────────────

async function verifyToken(request: Request): Promise<{ uid: string } | Response> {
  const token = request.headers.get("x-firebase-token") ?? "";
  if (!token) {
    return Response.json(
      { error: "Missing x-firebase-token header" },
      { status: 401 },
    );
  }
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token, /* checkRevoked */ true);
    return { uid: decoded.uid };
  } catch {
    return Response.json(
      { error: "Unauthorized — invalid or revoked Firebase token" },
      { status: 401 },
    );
  }
}

// ─── GET /api/rate-limit ──────────────────────────────────────────────────────
//
// Returns the caller's current sliding-window status without consuming a slot.
// Response shape: { ok, uid, remaining, resetAfterS, current, limit }

export async function GET(request: Request): Promise<Response> {
  try {
    const authResult = await verifyToken(request);

    // If verifyToken returned a Response it means auth failed — return it.
    if (authResult instanceof Response) return authResult;

    const { uid } = authResult;

    const status = await checkRateLimit(
      uid,
      DEFAULT_RATE_LIMIT_REQUESTS,
      DEFAULT_RATE_LIMIT_WINDOW_S,
      /* consume */ false,
    );

    return Response.json({
      ok:          true,
      uid,
      remaining:   status.remaining,
      resetAfterS: status.resetAfterS,
      current:     status.current,
      limit:       status.limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[rate-limit] GET unhandled error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

// ─── POST /api/rate-limit ─────────────────────────────────────────────────────
//
// Consumes one slot.  Returns HTTP 429 with Retry-After header when the limit
// is exceeded; HTTP 200 with remaining count when allowed.
//
// Request body (optional): { prefix?: string }  — allows callers to target a
//   named namespace bucket (e.g. "rl:smart-replies") if they route through
//   this endpoint instead of importing checkRateLimit() directly.
//
// Response shapes:
//   200  { ok: true,  uid, remaining, resetAfterS, current, limit }
//   429  { error: "Rate limit exceeded. …", remaining: 0, resetAfterS, limit }

export async function POST(request: Request): Promise<Response> {
  try {
    const authResult = await verifyToken(request);
    if (authResult instanceof Response) return authResult;

    const { uid } = authResult;

    // Optional custom prefix from request body.
    let prefix = KEY_PREFIX;
    try {
      const body = (await request.json()) as { prefix?: unknown };
      if (typeof body?.prefix === "string" && body.prefix.trim().length > 0) {
        prefix = body.prefix.trim();
      }
    } catch {
      // Body is optional — ignore parse errors.
    }

    const result = await checkRateLimit(
      uid,
      DEFAULT_RATE_LIMIT_REQUESTS,
      DEFAULT_RATE_LIMIT_WINDOW_S,
      /* consume */ true,
      prefix,
    );

    if (!result.allowed) {
      return Response.json(
        {
          error:       `Rate limit exceeded. You have sent ${result.current} requests in the last ${DEFAULT_RATE_LIMIT_WINDOW_S}s (limit: ${result.limit}). Try again in ${result.resetAfterS}s.`,
          remaining:   0,
          resetAfterS: result.resetAfterS,
          limit:       result.limit,
        },
        {
          status:  429,
          headers: {
            "Retry-After":              String(result.resetAfterS),
            "X-RateLimit-Limit":        String(result.limit),
            "X-RateLimit-Remaining":    "0",
            "X-RateLimit-Reset":        String(Math.floor(Date.now() / 1000) + result.resetAfterS),
          },
        },
      );
    }

    return Response.json(
      {
        ok:          true,
        uid,
        remaining:   result.remaining,
        resetAfterS: result.resetAfterS,
        current:     result.current,
        limit:       result.limit,
      },
      {
        headers: {
          "X-RateLimit-Limit":     String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset":     String(Math.floor(Date.now() / 1000) + result.resetAfterS),
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[rate-limit] POST unhandled error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

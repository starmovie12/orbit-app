/**
 * app/api/notifications/send+api.ts
 *
 * POST /api/notifications/send
 *
 * FCM push notification sender — server-side fanout to all of a user's
 * registered devices (blueprint §11 — FCM + APNs).
 *
 * The user schema stores push tokens as a flat map on the user document:
 *   users/{uid}.fcmTokens: { "<deviceKey>": "<fcmToken>", ... }
 *
 * Flow:
 *   1. Authenticate the caller via x-firebase-token OR x-server-secret.
 *      - Firebase token: any authenticated user may send to themselves.
 *      - Server secret: internal callers (other API routes) may target any UID.
 *   2. Validate and parse request body: { targetUid, title, body, data?, imageUrl? }.
 *   3. Fetch the target user's fcmTokens map from Firestore.
 *      - Return 404 if user doesn't exist, 200 (noop) if no tokens registered.
 *   4. Send the notification to all tokens via Firebase Admin SDK
 *      `messaging().sendEachForMulticast()`.
 *   5. Inspect per-token results:
 *      - Remove tokens that Razorpay/FCM reports as invalid or unregistered
 *        from the user doc atomically (prevents accumulation of dead tokens).
 *   6. Return a summary: { sent, failed, removedTokens }.
 *
 * Notification anatomy:
 *   notification.title   – Short heading (e.g. "👋 New message from ghost_player")
 *   notification.body    – Expanded text (e.g. "bhai sad lag raha...")
 *   data                 – Arbitrary key-value pairs for in-app routing
 *                          (e.g. { screen: "dm", chatId: "abc_def" })
 *   android.priority     – "high" to wake the device immediately
 *   apns                 – Badge + sound for iOS
 *   fcmOptions.imageUrl  – Optional rich push image
 *
 * Token cleanup:
 *   Firebase returns specific error codes for dead tokens:
 *     messaging/registration-token-not-registered
 *     messaging/invalid-registration-token
 *   We atomically delete those token keys from the user doc so subsequent
 *   sends don't waste quota on ghost devices.
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS   – Service-account JSON (stringified)
 *   SERVER_SECRET                – Shared secret for internal API-to-API calls
 *                                  (optional — only needed for server-side fanout)
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth }       from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging }  from "firebase-admin/messaging";
import type {
  MulticastMessage,
  SendResponse,
} from "firebase-admin/messaging";

// ─── Firebase Admin singleton ────────────────────────────────────────────────

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** FCM error codes that indicate the token is permanently dead. */
const DEAD_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
  "messaging/mismatched-credential",
]);

/** Maximum number of tokens FCM accepts in a single multicast call. */
const FCM_MULTICAST_BATCH_LIMIT = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendResult {
  sent:          number;
  failed:        number;
  removedTokens: string[];
  skippedNoTokens: boolean;
}

// ─── Helper: split array into chunks ─────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Core send logic ──────────────────────────────────────────────────────────

/**
 * Fetch a user's FCM tokens from Firestore and send a multicast notification.
 * Removes any dead tokens from the user doc as a side effect.
 */
async function sendToUser(args: {
  targetUid:  string;
  title:      string;
  body:       string;
  data?:      Record<string, string>;
  imageUrl?:  string;
  badge?:     number;
}): Promise<SendResult> {
  const app = getAdminApp();
  const db  = getFirestore(app);

  // ── Fetch user doc ────────────────────────────────────────────────────────
  const userRef  = db.collection("users").doc(args.targetUid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw Object.assign(
      new Error(`User not found: ${args.targetUid}`),
      { statusCode: 404 }
    );
  }

  const userData = userSnap.data() as {
    fcmTokens?: Record<string, string>;
    displayName?: string;
  };

  const fcmTokensMap: Record<string, string> = userData.fcmTokens ?? {};
  const tokenEntries = Object.entries(fcmTokensMap).filter(
    ([, token]) => typeof token === "string" && token.length > 0
  );

  // No registered devices — nothing to do
  if (tokenEntries.length === 0) {
    return { sent: 0, failed: 0, removedTokens: [], skippedNoTokens: true };
  }

  // ── Build notification payload ────────────────────────────────────────────
  const tokenList = tokenEntries.map(([, token]) => token);
  const deviceKeyByToken = Object.fromEntries(
    tokenEntries.map(([key, token]) => [token, key])
  );

  const baseMessage: Omit<MulticastMessage, "tokens"> = {
    notification: {
      title: args.title,
      body:  args.body,
      ...(args.imageUrl ? { imageUrl: args.imageUrl } : {}),
    },
    android: {
      priority: "high",
      notification: {
        sound:       "default",
        channelId:   "orbit_default",
        ...(args.imageUrl ? { imageUrl: args.imageUrl } : {}),
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: args.badge ?? 1,
          "content-available": 1,
          "mutable-content":   1,
        },
      },
      ...(args.imageUrl
        ? {
            fcmOptions: { imageUrl: args.imageUrl },
          }
        : {}),
    },
    // Arbitrary data for in-app routing — all values must be strings
    data: {
      ...(args.data ?? {}),
      sentAt: String(Date.now()),
    },
  };

  // ── Batch and send (FCM limit: 500 tokens per multicast) ──────────────────
  const messaging = getMessaging(app);
  const batches   = chunkArray(tokenList, FCM_MULTICAST_BATCH_LIMIT);

  let totalSent    = 0;
  let totalFailed  = 0;
  const deadTokens: string[] = [];  // token strings
  const deadDeviceKeys: string[] = []; // Firestore map keys to delete

  for (const batch of batches) {
    const multicastMsg: MulticastMessage = {
      ...baseMessage,
      tokens: batch,
    };

    let batchResponse: Awaited<ReturnType<typeof messaging.sendEachForMulticast>>;

    try {
      batchResponse = await messaging.sendEachForMulticast(multicastMsg);
    } catch (fcmErr: any) {
      // Whole batch failed (network or auth error) — log and continue to next batch
      console.error(
        `[notifications/send] FCM multicast batch error for uid=${args.targetUid}:`,
        fcmErr?.message
      );
      totalFailed += batch.length;
      continue;
    }

    // Inspect per-token results
    batchResponse.responses.forEach((resp: SendResponse, idx: number) => {
      if (resp.success) {
        totalSent++;
      } else {
        totalFailed++;
        const errorCode = resp.error?.code ?? "";
        const token     = batch[idx];

        if (DEAD_TOKEN_ERRORS.has(errorCode)) {
          deadTokens.push(token);
          const deviceKey = deviceKeyByToken[token];
          if (deviceKey) deadDeviceKeys.push(deviceKey);

          console.info(
            `[notifications/send] Stale token detected — uid=${args.targetUid}, ` +
            `deviceKey=${deviceKey}, error=${errorCode}`
          );
        } else {
          console.warn(
            `[notifications/send] Non-fatal FCM error — uid=${args.targetUid}, ` +
            `error=${errorCode}`
          );
        }
      }
    });
  }

  // ── Prune dead tokens from Firestore ─────────────────────────────────────
  if (deadDeviceKeys.length > 0) {
    try {
      const updates: Record<string, FieldValue> = {};
      for (const deviceKey of deadDeviceKeys) {
        updates[`fcmTokens.${deviceKey}`] = FieldValue.delete();
      }
      await userRef.update(updates as any);

      console.info(
        `[notifications/send] Removed ${deadDeviceKeys.length} stale token(s) ` +
        `for uid=${args.targetUid}: ${deadDeviceKeys.join(", ")}`
      );
    } catch (cleanupErr: any) {
      // Non-fatal — token will be pruned on the next delivery attempt
      console.warn(
        "[notifications/send] Failed to remove stale tokens:",
        cleanupErr?.message
      );
    }
  }

  return {
    sent:          totalSent,
    failed:        totalFailed,
    removedTokens: deadDeviceKeys,
    skippedNoTokens: false,
  };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve caller identity.
 *
 * Priority:
 *   1. x-server-secret header → internal service-to-service call → full access
 *   2. x-firebase-token header → user token → can only target themselves
 */
async function resolveCallerUid(
  request: Request
): Promise<{ callerUid: string; isInternal: boolean } | null> {
  const serverSecret = process.env.SERVER_SECRET;
  const incomingSecret = request.headers.get("x-server-secret") ?? "";

  // Internal server-to-server call (e.g. another API route calling this one)
  if (serverSecret && incomingSecret && incomingSecret === serverSecret) {
    return { callerUid: "__internal__", isInternal: true };
  }

  // Firebase user token
  const firebaseToken = request.headers.get("x-firebase-token") ?? "";
  if (!firebaseToken) return null;

  try {
    const app     = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(firebaseToken, /* checkRevoked */ true);
    return { callerUid: decoded.uid, isInternal: false };
  } catch {
    return null;
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    // ── 1. Authenticate caller ─────────────────────────────────────────────
    const caller = await resolveCallerUid(request);

    if (!caller) {
      return Response.json(
        { error: "Unauthorized — provide x-firebase-token or x-server-secret" },
        { status: 401 }
      );
    }

    // ── 2. Parse and validate body ─────────────────────────────────────────
    let body: {
      targetUid?: unknown;
      title?:     unknown;
      body?:      unknown;
      data?:      unknown;
      imageUrl?:  unknown;
      badge?:     unknown;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetUid = typeof body.targetUid === "string" ? body.targetUid.trim() : "";
    const title     = typeof body.title     === "string" ? body.title.trim()     : "";
    const bodyText  = typeof body.body      === "string" ? body.body.trim()      : "";
    const imageUrl  = typeof body.imageUrl  === "string" ? body.imageUrl.trim()  : undefined;
    const badge     = typeof body.badge     === "number" ? body.badge            : undefined;

    // Validate data map: all values must be strings (FCM requirement)
    let data: Record<string, string> | undefined;
    if (body.data !== undefined && body.data !== null) {
      if (typeof body.data !== "object" || Array.isArray(body.data)) {
        return Response.json({ error: "data must be a flat key-value object" }, { status: 400 });
      }
      const rawData = body.data as Record<string, unknown>;
      data = {};
      for (const [k, v] of Object.entries(rawData)) {
        if (typeof v !== "string") {
          return Response.json(
            { error: `data.${k} must be a string (FCM requires string values)` },
            { status: 400 }
          );
        }
        data[k] = v;
      }
    }

    // Required fields
    if (!targetUid) {
      return Response.json({ error: "targetUid is required" }, { status: 400 });
    }
    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }
    if (!bodyText) {
      return Response.json({ error: "body is required" }, { status: 400 });
    }

    // Length guards
    if (title.length > 200) {
      return Response.json({ error: "title exceeds 200 character limit" }, { status: 400 });
    }
    if (bodyText.length > 1000) {
      return Response.json({ error: "body exceeds 1000 character limit" }, { status: 400 });
    }

    // ── 3. Authorization — non-internal callers can only target themselves ──
    if (!caller.isInternal && caller.callerUid !== targetUid) {
      return Response.json(
        { error: "Forbidden — you can only send notifications to yourself" },
        { status: 403 }
      );
    }

    // ── 4. Send notification ───────────────────────────────────────────────
    const result = await sendToUser({
      targetUid,
      title,
      body:     bodyText,
      data,
      imageUrl,
      badge,
    });

    // ── 5. Return summary ──────────────────────────────────────────────────
    if (result.skippedNoTokens) {
      return Response.json({
        ok:              true,
        sent:            0,
        failed:          0,
        removedTokens:   [],
        message:         "User has no registered FCM tokens — nothing sent.",
      });
    }

    console.info(
      `[notifications/send] uid=${targetUid} — sent=${result.sent}, ` +
      `failed=${result.failed}, removed=${result.removedTokens.length}`
    );

    return Response.json({
      ok:            true,
      sent:          result.sent,
      failed:        result.failed,
      removedTokens: result.removedTokens,
    });
  } catch (err: any) {
    if (err?.statusCode === 404) {
      return Response.json({ error: err.message }, { status: 404 });
    }

    console.error("[notifications/send] Unhandled error:", err?.message ?? err);
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * app/api/pusher/auth+api.ts
 *
 * POST /api/pusher/auth
 *
 * Pusher private / presence channel authentication endpoint.
 *
 * The Pusher JS client sends an application/x-www-form-urlencoded body:
 *   socket_id    – the active Pusher socket identifier
 *   channel_name – the channel name requesting authorization
 *
 * The Firebase ID token travels in the custom request header
 * `x-firebase-token` (set via Pusher's `channelAuthorization.headers`
 * option on the client side) to keep it completely separate from the
 * Pusher-signed payload.
 *
 * Channel naming convention (blueprint §10):
 *   public rooms    → "room-{roomId}"                 no server auth
 *   presence rooms  → "presence-room-{roomId}"        online member list
 *   private DMs     → "private-dm-{uidA}---{uidB}"   triple-dash separator
 *                     (UIDs are sorted alphabetically by the client so
 *                      the server can verify deterministically)
 *
 * Authorization rules:
 *   presence-room-* → any authenticated user may subscribe; room
 *                     membership gates are enforced in Firestore rules.
 *   private-dm-*    → only the two UID participants may subscribe;
 *                     the dmThreads doc must already exist.
 *
 * Env vars required:
 *   FIREBASE_ADMIN_CREDENTIALS  – service account JSON (stringified)
 *   PUSHER_APP_ID               – Pusher application id
 *   PUSHER_KEY                  – Pusher publishable key
 *   PUSHER_SECRET               – Pusher secret
 *   PUSHER_CLUSTER              – Pusher cluster (default: "ap2" Mumbai)
 */

import Pusher from "pusher";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ─── Firebase Admin singleton ────────────────────────────────────────────────
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)),
  });
}

// ─── Pusher server singleton ─────────────────────────────────────────────────
let _pusher: Pusher | null = null;
function getPusherServer(): Pusher {
  if (!_pusher) {
    _pusher = new Pusher({
      appId:   process.env.PUSHER_APP_ID!,
      key:     process.env.PUSHER_KEY!,
      secret:  process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER ?? "ap2",
      useTLS:  true,
    });
  }
  return _pusher;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the two participant UIDs from a DM channel name.
 *
 * Supports both separator conventions:
 *   "private-dm-{uidA}---{uidB}"  (triple-dash — preferred, handles UIDs
 *                                   that may contain single hyphens)
 *   "private-dm-{uidA}-{uidB}"    (single-dash legacy, only works for
 *                                   UIDs without internal hyphens)
 */
function parseDmParticipants(channelName: string): [string, string] | null {
  const withoutPrefix = channelName.slice("private-dm-".length);

  // Preferred: triple-dash separator
  if (withoutPrefix.includes("---")) {
    const idx = withoutPrefix.indexOf("---");
    return [
      withoutPrefix.slice(0, idx),
      withoutPrefix.slice(idx + 3),
    ];
  }

  // Legacy: single-dash (only safe when UIDs are alphanumeric, e.g. Firebase UIDs)
  const idx = withoutPrefix.indexOf("-");
  if (idx < 0) return null;
  return [
    withoutPrefix.slice(0, idx),
    withoutPrefix.slice(idx + 1),
  ];
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  try {
    // ── 1. Parse x-www-form-urlencoded body (Pusher client format) ──────────
    const rawBody     = await request.text();
    const params      = new URLSearchParams(rawBody);
    const socketId    = params.get("socket_id")    ?? "";
    const channelName = params.get("channel_name") ?? "";

    // Firebase token travels in a custom header so it is never included in
    // the Pusher-signed string and never logged by Pusher infrastructure.
    const token =
      request.headers.get("x-firebase-token") ??
      params.get("token") ??
      "";

    // ── 2. Input validation ─────────────────────────────────────────────────
    if (!socketId || !channelName || !token) {
      return Response.json(
        { error: "socket_id, channel_name, and firebase token are required" },
        { status: 400 }
      );
    }

    // Pusher socket_id must be in the "digits.digits" format
    if (!/^\d+\.\d+$/.test(socketId)) {
      return Response.json(
        { error: "Invalid socket_id format" },
        { status: 400 }
      );
    }

    const isPrivate  = channelName.startsWith("private-");
    const isPresence = channelName.startsWith("presence-");

    if (!isPrivate && !isPresence) {
      return Response.json(
        { error: "Only private- and presence- channels require server auth" },
        { status: 400 }
      );
    }

    // ── 3. Verify Firebase ID token ─────────────────────────────────────────
    const app = getAdminApp();
    let uid:         string;
    let displayName: string | undefined;
    let photoURL:    string | undefined;

    try {
      const decoded = await getAuth(app).verifyIdToken(token, /* checkRevoked */ true);
      uid         = decoded.uid;
      displayName = decoded.name;
      photoURL    = decoded.picture;
    } catch {
      return Response.json(
        { error: "Unauthorized — invalid or revoked Firebase token" },
        { status: 401 }
      );
    }

    // ── 4. Channel-level authorization ──────────────────────────────────────
    if (isPrivate && channelName.startsWith("private-dm-")) {
      // Parse participants from channel name
      const participants = parseDmParticipants(channelName);
      if (!participants) {
        return Response.json(
          { error: "Malformed DM channel name — expected private-dm-{uidA}---{uidB}" },
          { status: 400 }
        );
      }
      const [dmUidA, dmUidB] = participants;

      // Caller must be one of the two participants
      if (uid !== dmUidA && uid !== dmUidB) {
        return Response.json(
          { error: "Forbidden — you are not a participant in this DM channel" },
          { status: 403 }
        );
      }

      // Verify the DM thread actually exists in Firestore
      // chatId convention (matches lib/firestore-dms.ts): sorted(uid1,uid2).join("_")
      const db     = getFirestore(app);
      const chatId = [dmUidA, dmUidB].sort().join("_");
      const dmSnap = await db.collection("dmThreads").doc(chatId).get();
      if (!dmSnap.exists) {
        return Response.json(
          { error: "DM thread not found — start a conversation first" },
          { status: 404 }
        );
      }
    }

    // presence-room-* and other private-* channels (future extension):
    // any authenticated user is permitted at the channel level; finer-grained
    // room membership is enforced by Firestore Security Rules.

    // ── 5. Sign the Pusher auth payload ─────────────────────────────────────
    const pusher = getPusherServer();
    let authPayload: object;

    if (isPresence) {
      // Presence channels carry user metadata so every subscriber can
      // display an online-members list (blueprint §10 — presence layer).
      authPayload = pusher.authorizeChannel(socketId, channelName, {
        user_id:   uid,
        user_info: {
          displayName: displayName ?? uid,
          avatar:      photoURL    ?? "",
        },
      });
    } else {
      // Private channel — sign socket_id + channel_name only
      authPayload = pusher.authorizeChannel(socketId, channelName);
    }

    return Response.json(authPayload);
  } catch (err: any) {
    console.error("[pusher/auth] unhandled error:", err);
    return Response.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

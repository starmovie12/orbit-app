/**
 * lib/firestore-dms.ts
 *
 * Single source of truth for all Direct Message reads/writes in CROWD WORLD.
 *
 * Paths
 * ─────
 * Thread document : /dms/{threadId}
 * DM messages     : /dms/{threadId}/messages/{messageId}
 *
 * Thread ID convention
 * ────────────────────
 * threadId = [uid1, uid2].sort().join('_')
 *
 * The sort guarantees a single canonical document for any pair of users
 * regardless of who initiates. Generating it client-side means no Firestore
 * round-trip to check for an existing thread — the ID is always the same.
 * buildThreadId() is the single place this formula lives; use it everywhere.
 *
 * Blueprint §07 — denormalization
 * ────────────────────────────────
 * The thread document stores lastMessagePreview + lastMessageAt so the DM
 * inbox list renders with a single collection query, zero sub-reads.
 * participantProfiles is stored alongside CWDMConversation fields (it is not
 * in the canonical type because it's a display-layer concern, not a business
 * entity). It is written once at thread creation and read by the inbox card.
 *
 * ─── snap.exists — BOOLEAN PROPERTY, NEVER A FUNCTION CALL ────────────────
 * DocumentSnapshot.exists is a boolean property in both firebase/compat (web)
 * and @react-native-firebase (native). The old v2 helper branched on
 * typeof snap.exists === "function" — that branch was incorrect because
 * @react-native-firebase never exposed .exists as a function. On web the
 * branch caused silent wrong-truthy results (a function reference is always
 * truthy). The snapExists() helper below reads the property unconditionally.
 *   snap.exists   ✅  correct — boolean property on both SDKs
 *   snap.exists() ❌  never use
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── Collection path — dms, NOT dmThreads ────────────────────────────────
 * CWDMConversation (types/cw.ts §9) specifies /dms/{id} as the collection.
 * The old codebase used "dmThreads" — this file corrects that to "dms".
 * If migrating from an existing "dmThreads" dataset, run a one-time migration
 * script before deploying. Do NOT use both collection names simultaneously.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── Composite index required ─────────────────────────────────────────────
 * subscribeToDMs() and subscribeToDMThread() query:
 *   participants array-contains + orderBy lastMessageAt DESC
 * Deploy this composite index before going to production:
 *
 *   Collection: dms
 *   Fields:     participants (Arrays) · lastMessageAt (Descending)
 *
 * Add to firestore.indexes.json or create via Firebase Console.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exported surface (public API)
 * ─────────────────────────────
 * Types     : Unsubscribe · CWDMMessage · CWDMParticipantProfile · SendDMPayload
 * Utilities : buildThreadId
 * Reads     : getDMThread
 * Realtime  : subscribeToDMs · subscribeToDMThread
 * Writes    : ensureDMThread · sendDM · markDMThreadRead · muteDMThread · unmuteDMThread
 * Deprecated: getThread · subscribeThread · subscribeMyThreads · ensureThread ·
 *             touchThreadLastMessage · markThreadRead · DMThreadDoc
 */

import { firestore, serverTimestamp, increment } from '@/lib/firebase';
import type { CWDMConversation } from '@/types/cw';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Return type of all realtime subscriptions. Call to stop listening. */
export type Unsubscribe = () => void;

/**
 * Public profile shard stored once per participant inside the thread document.
 * Used by the DM inbox card to render avatars + handles without extra reads.
 * Not part of CWDMConversation (display-layer concern) — stored alongside it.
 */
export type CWDMParticipantProfile = {
  /** @username at thread creation time. */
  username: string;
  /** Single emoji avatar (fallback when photoURL is null). */
  emoji: string;
  /** Hex accent color for avatar ring. */
  color: string;
  /** Cloudflare R2 WebP URL, or null for emoji fallback. */
  photoURL: string | null;
  /** displayName at thread creation time. */
  displayName: string | null;
};

/**
 * A single message inside /dms/{threadId}/messages/{id}.
 *
 * Intentionally lighter than CWMessage (no roomId, no variant, no isMicDrop)
 * because DM bubbles have simpler render logic. reactions and replyToId are
 * included for Phase 1.5 parity with room messages.
 */
export type CWDMMessage = {
  id: string;
  threadId: string;
  fromUid: string;
  text: string | null;
  imageURL: string | null;
  reactions: Record<string, number>;
  replyToId: string | null;
  isDeleted: boolean;
  timestamp: unknown;   // Firestore Timestamp — typed as unknown for compat layer
};

/**
 * Caller-facing payload for sendDM().
 * At least one of text or imageURL must be present.
 */
export type SendDMPayload = {
  text?: string;
  imageURL?: string;
  replyToId?: string;
};

// ─── Collection + subcollection paths ────────────────────────────────────────

/** /dms — per CWDMConversation spec (types/cw.ts §9). NOT "dmThreads". */
const DMS      = 'dms';
const MESSAGES = 'messages';

// ─── snap.exists boolean helper ───────────────────────────────────────────────

/**
 * Reads DocumentSnapshot.exists as a boolean property.
 * Never calls it as a function — see file header note.
 */
function snapExists(snap: { exists: boolean }): boolean {
  return !!snap.exists;
}

// ─── Collection refs ──────────────────────────────────────────────────────────

function dmsRef() {
  return firestore().collection(DMS);
}

function threadRef(threadId: string) {
  return firestore().collection(DMS).doc(threadId);
}

function messagesRef(threadId: string) {
  return firestore().collection(DMS).doc(threadId).collection(MESSAGES);
}

/** Generates a Firestore-compatible client-side document ID (no DB round-trip). */
function newDocId(): string {
  return firestore().collection('_').doc().id;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 1 — THREAD ID
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic thread ID for any ordered pair of UIDs.
 *
 * Sorting before joining guarantees that buildThreadId(A, B) === buildThreadId(B, A).
 * This is the single canonical formula — use this function everywhere rather
 * than inlining the sort-join pattern.
 *
 * @example
 * buildThreadId('uid_alice', 'uid_bob') // → "uid_alice_uid_bob" (or reversed, whichever sorts first)
 */
export function buildThreadId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

// ═════════════════════════════════════════════════════════════════════════════
// § 2 — GET DM THREAD
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Fetch a DM thread document by the two participant UIDs.
 *
 * Derives the threadId internally so callers never need to call buildThreadId
 * separately. Returns null when the two users have never exchanged a DM.
 *
 * @param uid1  First participant UID (any order — internally sorted).
 * @param uid2  Second participant UID.
 * @returns     CWDMConversation with id injected, or null if no thread exists.
 */
export async function getDMThread(
  uid1: string,
  uid2: string,
): Promise<CWDMConversation | null> {
  if (!uid1 || !uid2) return null;

  const threadId = buildThreadId(uid1, uid2);
  const snap = await threadRef(threadId).get();

  if (!snapExists(snap)) return null;

  return { id: snap.id, ...(snap.data() as Omit<CWDMConversation, 'id'>) };
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3 — REALTIME DM THREADS LIST SUBSCRIPTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Live subscription to all DM threads for a user, sorted newest-active first.
 *
 * Used by the DM inbox screen. The query uses `array-contains` on participants
 * so it returns exactly the threads this user belongs to — Firestore security
 * rules enforce that participants can only read their own threads.
 *
 * ⚠️  Requires composite index: participants (Arrays) + lastMessageAt (DESC).
 *     See file header for the index definition.
 *
 * Emits an empty array on error (auth revoked, offline) rather than throwing —
 * the inbox screen handles the empty state.
 *
 * @param currentUid  The authenticated user's UID.
 * @param cb          Called with the full sorted thread list on every change.
 * @returns           Unsubscribe — call inside useEffect cleanup.
 *
 * @example
 * useEffect(() => subscribeToDMs(currentUser.uid, setThreads), [currentUser.uid]);
 */
export function subscribeToDMs(
  currentUid: string,
  cb: (threads: CWDMConversation[]) => void,
): Unsubscribe {
  if (!currentUid) {
    cb([]);
    return () => {};
  }

  return dmsRef()
    .where('participants', 'array-contains', currentUid)
    .orderBy('lastMessageAt', 'desc')
    .onSnapshot(
      (qs) => {
        const list: CWDMConversation[] = [];
        qs.forEach((doc) => {
          list.push({
            id: doc.id,
            ...(doc.data() as Omit<CWDMConversation, 'id'>),
          });
        });
        cb(list);
      },
      (_err) => cb([]),
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// § 4 — REALTIME SINGLE THREAD SUBSCRIPTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Live subscription to a single DM thread document.
 *
 * Used by the DM chat screen header to reflect live unreadCountByUid resets
 * and mute state changes without polling.
 *
 * @param threadId  Canonical thread ID from buildThreadId().
 * @param cb        Called with CWDMConversation on change, or null on error/deletion.
 * @returns         Unsubscribe — call inside useEffect cleanup.
 */
export function subscribeToDMThread(
  threadId: string,
  cb: (thread: CWDMConversation | null) => void,
): Unsubscribe {
  if (!threadId) {
    cb(null);
    return () => {};
  }

  return threadRef(threadId).onSnapshot(
    (snap) => {
      if (!snapExists(snap)) {
        cb(null);
        return;
      }
      cb({ id: snap.id, ...(snap.data() as Omit<CWDMConversation, 'id'>) });
    },
    (_err) => cb(null),
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// § 5 — ENSURE DM THREAD (create if missing)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Create a DM thread document the first time two users start a conversation.
 *
 * Idempotent — if the thread already exists the existing doc is left unchanged
 * and the threadId is returned immediately (single get, no write).
 *
 * participantProfiles is stored alongside the canonical CWDMConversation fields
 * so the inbox card can render without extra user-doc reads. It is a snapshot
 * at thread creation time; profile changes after this point do not update it
 * (Phase 2 will refresh on next open).
 *
 * @param me     Calling user's identity shards.
 * @param other  Recipient's identity shards.
 * @returns      The canonical threadId for the pair.
 */
export async function ensureDMThread(args: {
  me: CWDMParticipantProfile & { uid: string };
  other: CWDMParticipantProfile & { uid: string };
}): Promise<string> {
  const { me, other } = args;
  const threadId = buildThreadId(me.uid, other.uid);
  const ref = threadRef(threadId);

  const snap = await ref.get();
  if (snapExists(snap)) return threadId;

  // participants tuple: sorted so it matches the threadId sort order.
  const participants = [me.uid, other.uid].sort() as [string, string];

  const threadDoc: Omit<CWDMConversation, 'id'> & {
    participantProfiles: Record<string, CWDMParticipantProfile>;
  } = {
    participants,
    lastMessagePreview:  '',
    lastMessageAt:       serverTimestamp() as any,
    unreadCountByUid:    { [me.uid]: 0, [other.uid]: 0 },
    mutedBy:             [],
    // Display-layer shard — not in CWDMConversation type but stored in Firestore
    participantProfiles: {
      [me.uid]: {
        username:    me.username,
        emoji:       me.emoji,
        color:       me.color,
        photoURL:    me.photoURL,
        displayName: me.displayName,
      },
      [other.uid]: {
        username:    other.username,
        emoji:       other.emoji,
        color:       other.color,
        photoURL:    other.photoURL,
        displayName: other.displayName,
      },
    },
  };

  await ref.set(threadDoc);
  return threadId;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 6 — SEND DM
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Send a direct message from one user to another.
 *
 * Execution order (atomic where possible):
 *   1. Ensure the thread doc exists (create if first message).
 *   2. Write the message to /dms/{threadId}/messages/{id}.
 *   3. Update the thread: lastMessagePreview, lastMessageAt, recipient's
 *      unreadCountByUid counter incremented by 1.
 *
 * Steps 2 + 3 run as a Firestore batch so the thread metadata and the message
 * are always consistent — partial writes are not possible.
 *
 * The caller can pre-generate payload.id (a UUID) for optimistic UI rendering
 * before the batch commits. If omitted, a Firestore-compatible ID is generated.
 *
 * @param fromUid    Sender UID.
 * @param toUid      Recipient UID.
 * @param payload    At least one of text or imageURL must be present.
 * @returns          The written message ID (useful for optimistic UI anchoring).
 * @throws           Never swallows write failures — caller surfaces retry UI.
 */
export async function sendDM(
  fromUid: string,
  toUid: string,
  payload: SendDMPayload,
): Promise<string> {
  const text     = payload.text?.trim() ?? null;
  const imageURL = payload.imageURL ?? null;

  if (!text && !imageURL) {
    throw new Error('sendDM: payload must have text or imageURL');
  }

  // Step 1 — ensure thread doc exists (no-op if already created)
  const threadId = buildThreadId(fromUid, toUid);
  const tRef = threadRef(threadId);
  const tSnap = await tRef.get();
  if (!snapExists(tSnap)) {
    // Minimal thread bootstrap when called without the full profile shards.
    // The caller should preferably call ensureDMThread() first for a complete doc.
    await tRef.set({
      participants:       [fromUid, toUid].sort() as [string, string],
      lastMessagePreview: '',
      lastMessageAt:      serverTimestamp(),
      unreadCountByUid:   { [fromUid]: 0, [toUid]: 0 },
      mutedBy:            [],
    } satisfies Omit<CWDMConversation, 'id'>);
  }

  // Step 2 + 3 — message write + thread metadata update in one batch
  const messageId = newDocId();
  const mRef = messagesRef(threadId).doc(messageId);

  const messageDoc: Omit<CWDMMessage, 'id'> = {
    threadId,
    fromUid,
    text,
    imageURL,
    reactions:  {},
    replyToId:  payload.replyToId ?? null,
    isDeleted:  false,
    timestamp:  serverTimestamp(),
  };

  const preview = (text ?? '📷 Photo').slice(0, 140);

  const batch = firestore().batch();

  batch.set(mRef, messageDoc);

  batch.update(tRef, {
    lastMessagePreview:              preview,
    lastMessageAt:                   serverTimestamp(),
    [`unreadCountByUid.${toUid}`]:   increment(1),
  });

  await batch.commit();

  return messageId;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 7 — MARK THREAD READ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Reset the unread counter to 0 for the given user.
 *
 * Call when the user opens a DM thread (screen mount) or returns to foreground
 * with the thread open. Uses an explicit 0 write — never decrement — because
 * new messages can arrive between the last read event and this update.
 *
 * @param threadId  Canonical thread ID.
 * @param uid       The user whose counter should be reset.
 */
export async function markDMThreadRead(
  threadId: string,
  uid: string,
): Promise<void> {
  if (!threadId || !uid) return;

  await threadRef(threadId).update({
    [`unreadCountByUid.${uid}`]: 0,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 8 — MUTE / UNMUTE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Add uid to the thread's mutedBy array.
 *
 * Muted threads still receive messages but suppress FCM push notifications
 * for that user. The UI shows a mute icon in the inbox card.
 * Uses arrayUnion to avoid duplicate entries and concurrent-write races.
 *
 * @param threadId  Canonical thread ID.
 * @param uid       UID of the user who wants to mute.
 */
export async function muteDMThread(
  threadId: string,
  uid: string,
): Promise<void> {
  if (!threadId || !uid) return;

  await threadRef(threadId).update({
    mutedBy: firestore.FieldValue.arrayUnion(uid),
  });
}

/**
 * Remove uid from the thread's mutedBy array.
 *
 * Uses arrayRemove — safe to call even if uid is not currently in the array.
 *
 * @param threadId  Canonical thread ID.
 * @param uid       UID of the user who wants to unmute.
 */
export async function unmuteDMThread(
  threadId: string,
  uid: string,
): Promise<void> {
  if (!threadId || !uid) return;

  await threadRef(threadId).update({
    mutedBy: firestore.FieldValue.arrayRemove(uid),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 9 — DEPRECATED LEGACY API
// Kept for backward compat — do not use in new code.
// All old functions delegate to their canonical replacements.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use getDMThread(uid1, uid2) — derives threadId internally.
 * getThread() requires callers to build threadId manually; getDMThread() does not.
 */
export async function getThread(
  threadId: string,
): Promise<CWDMConversation | null> {
  if (!threadId) return null;
  const snap = await threadRef(threadId).get();
  if (!snapExists(snap)) return null;
  return { id: snap.id, ...(snap.data() as Omit<CWDMConversation, 'id'>) };
}

/**
 * @deprecated Use subscribeToDMThread(threadId, cb).
 */
export function subscribeThread(
  threadId: string,
  onChange: (t: CWDMConversation | null) => void,
): Unsubscribe {
  return subscribeToDMThread(threadId, onChange);
}

/**
 * @deprecated Use subscribeToDMs(currentUid, cb).
 */
export function subscribeMyThreads(
  uid: string,
  onChange: (threads: CWDMConversation[]) => void,
): Unsubscribe {
  return subscribeToDMs(uid, onChange);
}

/**
 * @deprecated Use ensureDMThread({ me, other }) — requires full profile shards.
 * The old ensureThread() signature is kept for callers not yet migrated.
 */
export async function ensureThread(args: {
  me: { uid: string; username: string; emoji: string; color: string };
  other: { uid: string; username: string; emoji: string; color: string };
}): Promise<string> {
  return ensureDMThread({
    me: {
      uid:         args.me.uid,
      username:    args.me.username,
      emoji:       args.me.emoji,
      color:       args.me.color,
      photoURL:    null,
      displayName: null,
    },
    other: {
      uid:         args.other.uid,
      username:    args.other.username,
      emoji:       args.other.emoji,
      color:       args.other.color,
      photoURL:    null,
      displayName: null,
    },
  });
}

/**
 * @deprecated Use sendDM() — handles ensureThread, message write, and thread
 * metadata update atomically in a single batch. touchThreadLastMessage()
 * was a second write that callers had to coordinate manually.
 */
export async function touchThreadLastMessage(
  threadId: string,
  args: { preview: string; senderUid: string; recipientUid: string },
): Promise<void> {
  if (!threadId) return;

  await threadRef(threadId).update({
    lastMessagePreview:                        args.preview.slice(0, 140),
    lastMessageAt:                             serverTimestamp(),
    [`unreadCountByUid.${args.recipientUid}`]: increment(1),
  });
}

/**
 * @deprecated Use markDMThreadRead(threadId, uid).
 */
export async function markThreadRead(
  threadId: string,
  uid: string,
): Promise<void> {
  return markDMThreadRead(threadId, uid);
}

// ─── Legacy type alias ────────────────────────────────────────────────────────

/**
 * @deprecated Use CWDMConversation from @/types/cw.
 * Field mapping: unread → unreadCountByUid, participantProfiles shape expanded.
 */
export type DMThreadDoc = {
  id: string;
  participants: string[];
  participantProfiles: Record<
    string,
    { username: string; emoji: string; color: string }
  >;
  lastMessagePreview: string;
  lastMessageAt: unknown | null;
  lastMessageUid: string | null;
  unread: Record<string, number>;
  createdAt: unknown;
};

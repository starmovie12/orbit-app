/**
 * lib/firestore-messages.ts
 *
 * Single source of truth for all message reads/writes in CROWD WORLD.
 *
 * Paths
 * ─────
 * Room messages : /rooms/{roomId}/messages/{messageId}
 * DM messages   : /dmThreads/{threadId}/messages/{messageId}
 * Saved messages: /users/{uid}/saved/{savedId}
 *
 * Blueprint §07: sender username is denormalized onto the message doc so
 * bubbles render with a single read. If a user renames later, old messages
 * retain the handle at post-time — intentional for Phase 1.
 *
 * ─── snap.exists — BOOLEAN PROPERTY, NEVER A FUNCTION CALL ────────────────
 * DocumentSnapshot.exists is a boolean property in both firebase/compat (web)
 * and @react-native-firebase (native). Calling snap.exists() is a TypeError
 * on native and produces wrong values on web. All snapshot existence checks
 * in this file use snapExists(snap) which reads the property, never calls it.
 *   snap.exists   ✅  correct — boolean property
 *   snap.exists() ❌  never use — was root cause of April 21 incident
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exported surface (public API)
 * ─────────────────────────────
 * Types     : Unsubscribe · SaveMessageSnapshot
 * Realtime  : subscribeToMessages
 * Writes    : sendMessage · deleteMessage · addReaction · saveMessage
 * Deprecated: subscribeMessages · sendTextMessage · sendVoiceMessage · sendImageMessage
 */

import { firestore, serverTimestamp, increment } from '@/lib/firebase';
import type {
  CWMessage,
  CWMessageVariant,
  CWMessageStatus,
  CWMessageType,
  CWSavedMessage,
} from '@/types/cw';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Return type of all realtime subscriptions. Call to stop listening. */
export type Unsubscribe = () => void;

/**
 * Snapshot fields required by CWSavedMessage that the caller already holds
 * from the rendered message bubble. Passed as the 5th arg to saveMessage().
 *
 * Keeping these separate from the 4 core identifiers (uid/messageId/roomId/text)
 * avoids extra Firestore reads inside saveMessage — the UI already has them.
 */
export type SaveMessageSnapshot = {
  /** displayName of the message sender at save time. */
  senderName: string;
  /** @username of the message sender at save time. */
  senderHandle: string;
  /** Human-readable room label, e.g. "Sector 17 · City Center". */
  sectorName: string;
  /** Message attachment type — defaults to "text". */
  messageType?: CWMessageType;
  /** Only present when messageType === "voice". */
  voiceDurationSec?: number;
};

// ─── Collection paths ─────────────────────────────────────────────────────────

const ROOMS = 'rooms';
const DM_THREADS = 'dmThreads';
const MESSAGES = 'messages';
const SAVED = 'saved';
const USERS = 'users';

// ─── snap.exists boolean helper ───────────────────────────────────────────────
/**
 * Reads DocumentSnapshot.exists as a boolean property.
 * Never calls it as a function — see file header note.
 */
function snapExists(snap: any): boolean {
  return !!snap.exists;
}

// ─── Internal: parent collection ref ─────────────────────────────────────────

type ParentKind = 'room' | 'dm';

function parentRef(kind: ParentKind, parentId: string) {
  return firestore()
    .collection(kind === 'room' ? ROOMS : DM_THREADS)
    .doc(parentId);
}

/** Returns the messages subcollection ref for a room. */
function roomMessagesRef(roomId: string) {
  return firestore().collection(ROOMS).doc(roomId).collection(MESSAGES);
}

/** Generates a Firestore-compatible client-side document ID (no DB round-trip). */
function newDocId(): string {
  return firestore().collection('_').doc().id;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 1 — REALTIME SUBSCRIPTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Live subscription to a room's messages.
 *
 * Query: ordered by `timestamp` DESC, capped at `limit` documents.
 * The result list is reversed to oldest-first before being emitted so
 * a standard (non-inverted) FlatList can render it naturally.
 *
 * The listener emits an empty array on any Firestore error (permissions
 * revoked, offline) rather than throwing — the chat screen handles the
 * empty state.
 *
 * @param roomId  Firestore room document ID, e.g. "chandigarh_sector-17".
 * @param limit   Max messages to load (pass a larger value for pagination preview).
 * @param cb      Called with the current message list on every change.
 * @returns       Unsubscribe — call inside useEffect cleanup.
 *
 * @example
 * useEffect(() => subscribeToMessages(roomId, 60, setMessages), [roomId]);
 */
export function subscribeToMessages(
  roomId: string,
  limit: number,
  cb: (messages: CWMessage[]) => void,
): Unsubscribe {
  if (!roomId) {
    cb([]);
    return () => {};
  }

  return roomMessagesRef(roomId)
    .where('isDeleted', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .onSnapshot(
      (qs) => {
        const msgs: CWMessage[] = [];
        qs.forEach((doc) => {
          msgs.push({ id: doc.id, ...(doc.data() as Omit<CWMessage, 'id'>) });
        });
        // Flip desc → asc so oldest message is at index 0 (standard FlatList order).
        msgs.reverse();
        cb(msgs);
      },
      (_err) => cb([]),
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// § 2 — SEND MESSAGE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Write a message to /rooms/{roomId}/messages/{id}.
 *
 * The caller should pre-generate `message.id` (a UUID) before calling so the
 * message can be rendered optimistically in the UI before the write confirms.
 * If `message.id` is omitted, a Firestore-compatible ID is generated here.
 *
 * Required fields in `message`: uid, variant.
 * At least one of `text` or `imageURL` must be non-null.
 *
 * System and AI messages may omit uid (it defaults to an empty string per
 * the CWMessage spec — the empty uid signals a non-user sender to the UI).
 *
 * @param roomId   Firestore room document ID.
 * @param message  Partial<CWMessage> — id/roomId/timestamp/reactions/isMicDrop/
 *                 isDeleted/editedAt/status are set/defaulted automatically.
 * @throws         Never swallows errors — Firestore write failures propagate.
 */
export async function sendMessage(
  roomId: string,
  message: Partial<CWMessage>,
): Promise<void> {
  const text = message.text?.trim() ?? null;
  const imageURL = message.imageURL ?? null;

  // Reject empty messages (no text and no image)
  if (!text && !imageURL) return;

  const id = message.id ?? newDocId();

  const doc: Omit<CWMessage, 'id'> = {
    roomId,
    uid:        message.uid ?? '',
    text,
    imageURL,
    variant:    message.variant ?? 'right',
    reactions:  {},
    replyToId:  message.replyToId ?? null,
    isMicDrop:  false,
    isDeleted:  false,
    editedAt:   null,
    timestamp:  serverTimestamp() as any,
    status:     (message.status ?? 'sent') as CWMessageStatus,
  };

  await roomMessagesRef(roomId).doc(id).set(doc);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3 — DELETE MESSAGE (soft)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Soft-delete a message.
 *
 * Sets `isDeleted: true` — the document remains in Firestore. The UI renders
 * a "message deleted" shell bubble instead of the original content (per
 * CWMessage spec). Hard deletes are handled server-side by moderation
 * Cloud Functions only.
 *
 * The `subscribeToMessages` query filters `isDeleted == false`, so soft-deleted
 * messages are automatically excluded from new listeners. Existing listeners
 * will receive a change event and re-render with the deleted shell.
 *
 * @param roomId     Firestore room document ID.
 * @param messageId  Firestore message document ID.
 */
export async function deleteMessage(
  roomId: string,
  messageId: string,
): Promise<void> {
  if (!roomId || !messageId) return;

  await roomMessagesRef(roomId).doc(messageId).update({
    isDeleted: true,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 4 — ADD REACTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Increment the aggregate reaction count for `emoji` on a message.
 *
 * Uses Firestore dot-notation + FieldValue.increment() for an atomic,
 * concurrent-safe counter update: `reactions.${emoji}` incremented by 1
 * with no read-then-write race.
 *
 * MicDrop threshold check (PRD §10.5 — isMicDrop when total reactions ≥ 50):
 * A transaction reads the current reactions map, computes the new total,
 * and sets `isMicDrop: true` once the threshold is crossed. After that
 * the flag is never unset (reactions are never decremented in Phase 1).
 *
 * Deduplication: Phase 1 counts aggregate reactions only — the `uid` param
 * is accepted for API compatibility and future per-user dedup (Phase 2 will
 * write a `/rooms/{roomId}/messages/{id}/reactors/{uid}` presence doc).
 *
 * @param roomId     Firestore room document ID.
 * @param messageId  Firestore message document ID.
 * @param emoji      Emoji string, e.g. "🔥", "❤️".
 * @param uid        UID of the reacting user (reserved for Phase 2 dedup).
 */
export async function addReaction(
  roomId: string,
  messageId: string,
  emoji: string,
  uid: string,
): Promise<void> {
  if (!roomId || !messageId || !emoji) return;

  const db  = firestore();
  const ref = roomMessagesRef(roomId).doc(messageId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snapExists(snap)) return;

    const data = snap.data() as CWMessage;

    // Compute what the new total will be after this increment
    const currentReactions = data.reactions ?? {};
    const currentCount     = currentReactions[emoji] ?? 0;
    const newTotal         = Object.values(currentReactions).reduce(
      (sum, n) => sum + n,
      0,
    ) - currentCount + (currentCount + 1);

    const update: Record<string, any> = {
      [`reactions.${emoji}`]: increment(1),
    };

    // Promote to MicDrop once total crosses the threshold (latch — never unset)
    if (!data.isMicDrop && newTotal >= 50) {
      update.isMicDrop = true;
    }

    tx.update(ref, update);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 5 — SAVE MESSAGE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Save a message to the current user's saved collection.
 *
 * Writes a CWSavedMessage snapshot to /users/{uid}/saved/{autoId}.
 * All snapshot fields are captured at save time — if the original message
 * is later deleted or edited, the saved copy is unaffected.
 *
 * `savedAtMs` uses `Date.now()` (Unix ms) as specified in CWSavedMessage.
 * This is stored as a plain number (not a Firestore Timestamp) so it can
 * be sorted client-side without deserialization.
 *
 * @param uid        UID of the user saving the message (the collection owner).
 * @param messageId  Original CWMessage document ID.
 * @param roomId     Room the message belongs to (stored as sectorId for nav).
 * @param text       Message text — caller passes directly from rendered bubble,
 *                   avoiding an extra Firestore read inside this function.
 * @param snapshot   Display-layer values the UI already holds: senderName,
 *                   senderHandle, sectorName, messageType, voiceDurationSec.
 */
export async function saveMessage(
  uid: string,
  messageId: string,
  roomId: string,
  text: string,
  snapshot: SaveMessageSnapshot,
): Promise<void> {
  if (!uid || !messageId || !roomId) return;

  const saved: Omit<CWSavedMessage, 'id'> = {
    uid,
    messageId,
    sectorId:        roomId,
    sectorName:      snapshot.sectorName,
    text:            text ?? '',
    senderName:      snapshot.senderName,
    senderHandle:    snapshot.senderHandle,
    messageType:     snapshot.messageType ?? 'text',
    savedAtMs:       Date.now(),
    ...(snapshot.voiceDurationSec !== undefined && {
      voiceDurationSec: snapshot.voiceDurationSec,
    }),
  };

  await firestore()
    .collection(USERS)
    .doc(uid)
    .collection(SAVED)
    .add(saved);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 6 — DEPRECATED LEGACY API (kept for backward compat — do not use in new code)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use subscribeToMessages() — room-specific, typed with CWMessage.
 * subscribeMessages() will be removed when DM chat is migrated to its own service.
 */
export function subscribeMessages(
  kind: ParentKind,
  parentId: string,
  onChange: (messages: MessageDoc[]) => void,
  limit = 100,
): Unsubscribe {
  return parentRef(kind, parentId)
    .collection(MESSAGES)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      (qs) => {
        const list: MessageDoc[] = [];
        qs.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as Omit<MessageDoc, 'id'>) });
        });
        list.reverse();
        onChange(list);
      },
      () => onChange([]),
    );
}

/**
 * @deprecated Use sendMessage() with Partial<CWMessage> instead.
 */
export async function sendTextMessage(
  kind: ParentKind,
  parentId: string,
  args: { uid: string; username: string; text: string },
): Promise<void> {
  const trimmed = args.text.trim();
  if (!trimmed) return;

  await parentRef(kind, parentId)
    .collection(MESSAGES)
    .add({
      uid:       args.uid,
      username:  args.username,
      type:      'text' as MessageType,
      text:      trimmed,
      duration:  null,
      imageUrl:  null,
      caption:   null,
      createdAt: serverTimestamp(),
    });
}

/**
 * @deprecated Voice messages: use sendMessage() with imageURL set to the
 * storage URL and variant: 'right'. Full voice support in Phase 3.
 */
export async function sendVoiceMessage(
  kind: ParentKind,
  parentId: string,
  args: { uid: string; username: string; durationSec: number; url: string },
): Promise<void> {
  await parentRef(kind, parentId)
    .collection(MESSAGES)
    .add({
      uid:       args.uid,
      username:  args.username,
      type:      'voice' as MessageType,
      text:      null,
      duration:  args.durationSec,
      imageUrl:  args.url,
      caption:   null,
      createdAt: serverTimestamp(),
    });
}

/**
 * @deprecated Use sendMessage() with imageURL populated instead.
 */
export async function sendImageMessage(
  kind: ParentKind,
  parentId: string,
  args: { uid: string; username: string; url: string; caption?: string },
): Promise<void> {
  await parentRef(kind, parentId)
    .collection(MESSAGES)
    .add({
      uid:       args.uid,
      username:  args.username,
      type:      'image' as MessageType,
      text:      null,
      duration:  null,
      imageUrl:  args.url,
      caption:   args.caption ?? null,
      createdAt: serverTimestamp(),
    });
}

// ─── Legacy types (used by deprecated functions only) ─────────────────────────

/** @deprecated Replaced by CWMessage from @/types/cw. */
export type MessageType = 'text' | 'voice' | 'image' | 'system';

/** @deprecated Replaced by CWMessage from @/types/cw. */
export type MessageDoc = {
  id: string;
  uid: string;
  username: string;
  type: MessageType;
  text: string | null;
  duration: number | null;
  imageUrl: string | null;
  caption: string | null;
  createdAt: unknown;
};

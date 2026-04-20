/**
 * DM Threads CRUD + live subscription.
 *
 * Collection: /dmThreads/{threadId}
 * Sub-collection: /dmThreads/{threadId}/messages/{msgId} (uses firestore-messages.ts)
 *
 * Design decisions:
 *   - threadId is deterministic: sorted participant uids joined by "_"
 *     so we never create two threads for the same pair of users.
 *   - participants[] is an array of exactly 2 uids. Firestore rule
 *     restricts reads to users in that array.
 *   - Each side carries their counterpart's username/emoji/color so the
 *     inbox list renders in a single read — blueprint §07 denormalization.
 *
 * Phase 1 keeps it 1:1 only. Group DMs (> 2 participants) ship in Phase 2.
 */

import { firestore, increment, serverTimestamp } from "@/lib/firebase";

export type DMThreadDoc = {
  id: string;
  participants: string[];          // always sorted + length 2
  /** uid -> small public profile shard (avoids a second read per thread) */
  participantProfiles: Record<
    string,
    { username: string; emoji: string; color: string }
  >;
  lastMessagePreview: string;
  lastMessageAt: unknown | null;
  lastMessageUid: string | null;
  /** uid -> unread count. Resettable when that user opens the thread. */
  unread: Record<string, number>;
  createdAt: unknown;
};

const DM = "dmThreads";

/** Build the canonical thread id from any two uids. */
export function buildThreadId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

/** Fetch one thread. */
export async function getThread(threadId: string): Promise<DMThreadDoc | null> {
  const snap = await firestore().collection(DM).doc(threadId).get();
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<DMThreadDoc, "id">) };
}

/** Subscribe to a single thread — used by the DM chat header. */
export function subscribeThread(
  threadId: string,
  onChange: (t: DMThreadDoc | null) => void
): () => void {
  return firestore()
    .collection(DM)
    .doc(threadId)
    .onSnapshot(
      (snap) =>
        onChange(
          snap.exists()
            ? { id: snap.id, ...(snap.data() as Omit<DMThreadDoc, "id">) }
            : null
        ),
      () => onChange(null)
    );
}

/**
 * Subscribe to all threads that include `uid`, newest activity first.
 * Used by the Rooms tab to render the DIRECT MESSAGES section.
 */
export function subscribeMyThreads(
  uid: string,
  onChange: (threads: DMThreadDoc[]) => void
): () => void {
  return firestore()
    .collection(DM)
    .where("participants", "array-contains", uid)
    .orderBy("lastMessageAt", "desc")
    .onSnapshot(
      (qs) => {
        const list: DMThreadDoc[] = [];
        qs.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as Omit<DMThreadDoc, "id">) });
        });
        onChange(list);
      },
      () => onChange([])
    );
}

/**
 * Create a thread the first time two users DM each other.
 * Idempotent — if the doc already exists, we leave it alone.
 */
export async function ensureThread(args: {
  me: { uid: string; username: string; emoji: string; color: string };
  other: { uid: string; username: string; emoji: string; color: string };
}): Promise<string> {
  const threadId = buildThreadId(args.me.uid, args.other.uid);
  const ref = firestore().collection(DM).doc(threadId);
  const snap = await ref.get();
  if (snap.exists()) return threadId;

  const participants = [args.me.uid, args.other.uid].sort();
  await ref.set({
    participants,
    participantProfiles: {
      [args.me.uid]: {
        username: args.me.username,
        emoji: args.me.emoji,
        color: args.me.color,
      },
      [args.other.uid]: {
        username: args.other.username,
        emoji: args.other.emoji,
        color: args.other.color,
      },
    },
    lastMessagePreview: "",
    lastMessageAt: serverTimestamp(),
    lastMessageUid: null,
    unread: { [args.me.uid]: 0, [args.other.uid]: 0 },
    createdAt: serverTimestamp(),
  });
  return threadId;
}

/**
 * Bump denormalized preview + unread counter for the recipient.
 * Called after sendTextMessage / sendVoiceMessage.
 */
export async function touchThreadLastMessage(
  threadId: string,
  args: { preview: string; senderUid: string; recipientUid: string }
): Promise<void> {
  await firestore()
    .collection(DM)
    .doc(threadId)
    .update({
      lastMessagePreview: args.preview.slice(0, 140),
      lastMessageAt: serverTimestamp(),
      lastMessageUid: args.senderUid,
      [`unread.${args.recipientUid}`]: increment(1),
    });
}

/** Mark the thread as read for the given user. */
export async function markThreadRead(
  threadId: string,
  uid: string
): Promise<void> {
  await firestore()
    .collection(DM)
    .doc(threadId)
    .update({ [`unread.${uid}`]: 0 });
}

/**
 * Messages CRUD + live subscription.
 *
 * Path templates:
 *   /rooms/{roomId}/messages/{msgId}
 *   /dmThreads/{threadId}/messages/{msgId}
 *
 * Both paths share the same message shape, so we parametrize the parent
 * ref and use this helper from both RoomChatScreen and DMChatScreen.
 *
 * Blueprint §07: denormalize sender username on the message so we never
 * need a second read to render a bubble. If a user renames later, old
 * messages still show the old handle — acceptable for Phase 1.
 */

import { firestore, serverTimestamp } from "@/lib/firebase";

export type MessageType = "text" | "voice" | "image" | "system";

export type MessageDoc = {
  id: string;
  uid: string;
  username: string;
  type: MessageType;
  text: string | null;
  /** Voice note duration in seconds */
  duration: number | null;
  /** Remote URL (Firebase Storage / R2 later) */
  imageUrl: string | null;
  caption: string | null;
  createdAt: unknown; // Firestore Timestamp
};

type ParentKind = "room" | "dm";

function parentRef(kind: ParentKind, parentId: string) {
  const collection = kind === "room" ? "rooms" : "dmThreads";
  return firestore().collection(collection).doc(parentId);
}

/**
 * Live subscription to messages, oldest first, capped at `limit` (default 100).
 * Returns unsubscribe fn. The chat screen can call `loadMoreOlder()` separately
 * once we add pagination in Batch 2.
 */
export function subscribeMessages(
  kind: ParentKind,
  parentId: string,
  onChange: (messages: MessageDoc[]) => void,
  limit = 100
): () => void {
  return parentRef(kind, parentId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .onSnapshot(
      (qs) => {
        const list: MessageDoc[] = [];
        qs.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as Omit<MessageDoc, "id">) });
        });
        // Flip to oldest-first for normal (non-inverted) FlatList.
        list.reverse();
        onChange(list);
      },
      () => onChange([])
    );
}

/**
 * Send a text message. The caller is responsible for calling the
 * appropriate `touchParentLastMessage` helper on the same tick to
 * keep the list preview fresh.
 */
export async function sendTextMessage(
  kind: ParentKind,
  parentId: string,
  args: { uid: string; username: string; text: string }
): Promise<void> {
  const trimmed = args.text.trim();
  if (!trimmed) return;

  await parentRef(kind, parentId)
    .collection("messages")
    .add({
      uid: args.uid,
      username: args.username,
      type: "text" as MessageType,
      text: trimmed,
      duration: null,
      imageUrl: null,
      caption: null,
      createdAt: serverTimestamp(),
    });
}

/**
 * Voice / image senders — wired in Batch 3 once Firebase Storage uploads
 * are in place. Exposed here as stubs so screen code can import a stable API.
 */
export async function sendVoiceMessage(
  kind: ParentKind,
  parentId: string,
  args: { uid: string; username: string; durationSec: number; url: string }
): Promise<void> {
  await parentRef(kind, parentId)
    .collection("messages")
    .add({
      uid: args.uid,
      username: args.username,
      type: "voice" as MessageType,
      text: null,
      duration: args.durationSec,
      imageUrl: args.url,
      caption: null,
      createdAt: serverTimestamp(),
    });
}

export async function sendImageMessage(
  kind: ParentKind,
  parentId: string,
  args: { uid: string; username: string; url: string; caption?: string }
): Promise<void> {
  await parentRef(kind, parentId)
    .collection("messages")
    .add({
      uid: args.uid,
      username: args.username,
      type: "image" as MessageType,
      text: null,
      duration: null,
      imageUrl: args.url,
      caption: args.caption ?? null,
      createdAt: serverTimestamp(),
    });
}

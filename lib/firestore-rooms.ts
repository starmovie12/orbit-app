/**
 * Rooms CRUD + live subscription.
 *
 * Collection: /rooms/{roomId}
 * Sub-collection: /rooms/{roomId}/messages/{msgId}  (messages helper in separate file)
 *
 * Blueprint §07: denormalized lastMessage fields so the rooms list
 * can render without a per-room sub-query. memberCount is bumped via
 * Cloud Functions later — for Phase 1 it's just a manual/seeded number.
 *
 * ─── FIX v2 ────────────────────────────────────────────────────────────
 * Added `snapExists()` helper to handle cross-platform `.exists` difference:
 *   - @react-native-firebase  →  snap.exists()  (function)
 *   - firebase/compat (web)   →  snap.exists    (boolean property)
 * All previous `snap.exists()` calls replaced with `snapExists(snap)`.
 * ────────────────────────────────────────────────────────────────────────
 */

import { firestore, serverTimestamp } from "@/lib/firebase";

export type RoomKind = "public" | "mood" | "skill" | "live";

export type RoomDoc = {
  id: string;
  name: string;
  /** Feather icon name (e.g. "moon", "target") */
  icon: string;
  /** Hex color used as icon tint (no neon backgrounds) */
  accent: string;
  description: string;
  kind: RoomKind;
  memberCount: number;
  /** Denormalized preview fields for the rooms list */
  lastMessagePreview: string;
  lastMessageAt: unknown | null; // Firestore Timestamp
  lastMessageUid: string | null;
  lastMessageUsername: string | null;
  isLive: boolean;
  /** Host uid when isLive */
  liveHostUid: string | null;
  createdAt: unknown;
  createdBy: string;
};

const ROOMS = "rooms";

/* ─────────────────────────────────────────────────────────────────────
   Cross-platform .exists helper
   @react-native-firebase  → snap.exists() is a function
   firebase/compat (web)   → snap.exists  is a boolean property
   Calling snap.exists() on web throws TypeError — this helper fixes it.
───────────────────────────────────────────────────────────────────── */
function snapExists(snap: any): boolean {
  if (typeof snap.exists === "function") return snap.exists();
  return !!snap.exists;
}

/** Fetch one room by id. */
export async function getRoom(roomId: string): Promise<RoomDoc | null> {
  const snap = await firestore().collection(ROOMS).doc(roomId).get();
  if (!snapExists(snap)) return null;
  return { id: snap.id, ...(snap.data() as Omit<RoomDoc, "id">) };
}

/**
 * Subscribe to the full rooms list, newest-active first.
 * Returns unsubscribe fn. Fine for Phase 1 with <100 rooms;
 * swap to paginated query when the catalog grows.
 */
export function subscribeRooms(
  onChange: (rooms: RoomDoc[]) => void
): () => void {
  return firestore()
    .collection(ROOMS)
    .orderBy("lastMessageAt", "desc")
    .onSnapshot(
      (qs) => {
        const list: RoomDoc[] = [];
        qs.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as Omit<RoomDoc, "id">) });
        });
        onChange(list);
      },
      () => onChange([])
    );
}

/**
 * Subscribe to a single room doc. Used by the chat screen so the header
 * reflects live membership changes and go-live toggles.
 */
export function subscribeRoom(
  roomId: string,
  onChange: (room: RoomDoc | null) => void
): () => void {
  return firestore()
    .collection(ROOMS)
    .doc(roomId)
    .onSnapshot(
      (snap) =>
        onChange(
          snapExists(snap)
            ? { id: snap.id, ...(snap.data() as Omit<RoomDoc, "id">) }
            : null
        ),
      () => onChange(null)
    );
}

/**
 * Bump the denormalized lastMessage* fields after a new message is sent.
 * Called by messages helper in the same batch as the message create.
 */
export async function touchRoomLastMessage(
  roomId: string,
  args: { preview: string; uid: string; username: string }
): Promise<void> {
  await firestore().collection(ROOMS).doc(roomId).update({
    lastMessagePreview: args.preview.slice(0, 140),
    lastMessageAt: serverTimestamp(),
    lastMessageUid: args.uid,
    lastMessageUsername: args.username,
  });
}

/**
 * Seeded default for new rooms created by an admin or the seed script.
 * Kept here so the shape stays in one place.
 */
export function defaultRoom(args: {
  id: string;
  name: string;
  icon: string;
  accent: string;
  description: string;
  kind: RoomKind;
  createdBy: string;
}): Omit<RoomDoc, "id"> {
  return {
    name: args.name,
    icon: args.icon,
    accent: args.accent,
    description: args.description,
    kind: args.kind,
    memberCount: 0,
    lastMessagePreview: "",
    lastMessageAt: serverTimestamp(),
    lastMessageUid: null,
    lastMessageUsername: null,
    isLive: false,
    liveHostUid: null,
    createdAt: serverTimestamp(),
    createdBy: args.createdBy,
  };
}

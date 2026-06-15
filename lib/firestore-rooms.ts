/**
 * lib/firestore-rooms.ts
 *
 * Single source of truth for all Room reads/writes in CROWD WORLD.
 *
 * Collection paths
 * ────────────────
 * /rooms/{roomId}               — chat rooms
 * /cities/{cityId}              — city directory
 * /cities/{cityId}/sectors/{sectorId} — sectors per city
 *
 * Room ID convention: `${cityId}_${sectorId}`, e.g. "chandigarh_sector-17".
 * This composite key is intentional — it makes hyper-local queries instant
 * (no index scan required when cityId is already embedded in the doc ID).
 *
 * Blueprint §07: CWRoom stores denormalized lastMessageAt for feed sort, and
 * onlineCount / heatScore for real-time heat ring rendering in the rooms list.
 * Both fields are written atomically — never with a read-then-overwrite pattern.
 *
 * ─── snap.exists — BOOLEAN PROPERTY, NEVER A FUNCTION CALL ────────────────
 * DocumentSnapshot.exists is a boolean property in both firebase/compat (web)
 * and @react-native-firebase (native). The old firestore-rooms.ts (v2) had a
 * branching helper that called snap.exists() for native — this is incorrect.
 * @react-native-firebase exposes .exists as a plain boolean; calling it as a
 * function was never valid on that SDK and caused silent truthy results on web
 * (a function reference is always truthy). All existence checks use the
 * snapExists() helper below which reads the property, never calls it.
 *   snap.exists   ✅  correct
 *   snap.exists() ❌  never use
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── onlineCount — increment(), NEVER overwrite ───────────────────────────
 * incrementOnlineCount / decrementOnlineCount use FieldValue.increment() for
 * atomic, concurrent-safe counter updates. The previous pattern of read →
 * compute → set is a race condition in a hyper-local room where 50 users can
 * join simultaneously.
 *
 * decrementOnlineCount guards against underflow (count < 0) with a transaction
 * that reads the current value and skips the decrement when already at zero.
 * Firestore has no native "decrement with floor" operation, so the transaction
 * is the correct tool for this specific case.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── Composite indexes required ───────────────────────────────────────────
 * getRoomsByCitySector() queries (cityId == x AND sectorId == y):
 *   Collection: rooms
 *   Fields:     cityId ASC, sectorId ASC, lastMessageAt DESC
 *
 * getCities() queries (is_active == true, orderBy name):
 *   Collection: cities
 *   Fields:     is_active ASC, name ASC
 *
 * subscribeSectorsByCity() queries (is_active == true, orderBy sectorName):
 *   Collection group: sectors
 *   Fields:           is_active ASC, sectorName ASC
 *
 * Add to firestore.indexes.json or create via Firebase Console.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exported surface (public API)
 * ─────────────────────────────
 * Types     : Unsubscribe · SectorRow
 * Reads     : getRoom · getRoomsByCitySector
 * Realtime  : subscribeToRoom · subscribeRooms · getCities · subscribeSectorsByCity
 * Writes    : incrementOnlineCount · decrementOnlineCount · touchRoomLastMessage
 * Utility   : defaultRoom
 * Deprecated: subscribeRoom (renamed to subscribeToRoom)
 */

import { firestore, serverTimestamp, increment } from '@/lib/firebase';
import type { CWRoom } from '@/types/cw';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Return type of all realtime subscriptions. Call to stop listening. */
export type Unsubscribe = () => void;

// ─── Collection paths ─────────────────────────────────────────────────────────

const ROOMS   = 'rooms';
const CITIES  = 'cities';
const SECTORS = 'sectors';

// ─── snap.exists boolean helper ───────────────────────────────────────────────

/**
 * Reads DocumentSnapshot.exists as a boolean property.
 *
 * The old v2 helper branched on `typeof snap.exists === "function"` and called
 * snap.exists() for native. This was incorrect — @react-native-firebase has
 * always exposed .exists as a plain boolean. The branch caused silent bugs on
 * web (function reference is always truthy regardless of document existence).
 *
 * Correct approach: read the property unconditionally. Both SDKs agree on the
 * boolean property shape. Never call it as a function anywhere in this file.
 */
function snapExists(snap: { exists: boolean }): boolean {
  return !!snap.exists;
}

// ─── Typed collection refs ────────────────────────────────────────────────────

function roomsRef() {
  return firestore().collection(ROOMS);
}

function roomRef(roomId: string) {
  return firestore().collection(ROOMS).doc(roomId);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 1 — SINGLE ROOM READ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Fetch one room by its composite ID.
 *
 * The room ID is always `${cityId}_${sectorId}`, e.g. "chandigarh_sector-17".
 * Returns null when the room does not exist (new city onboarding guard).
 *
 * @param roomId  Composite Firestore room document ID.
 * @returns       CWRoom with id injected, or null if not found.
 */
export async function getRoom(roomId: string): Promise<CWRoom | null> {
  if (!roomId) return null;

  const snap = await roomRef(roomId).get();
  if (!snapExists(snap)) return null;

  return { id: snap.id, ...(snap.data() as Omit<CWRoom, 'id'>) };
}

// ═════════════════════════════════════════════════════════════════════════════
// § 2 — REALTIME ROOM SUBSCRIPTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Live subscription to a single room document.
 *
 * Used by the chat screen header and the rooms list card to reflect real-time
 * changes to `onlineCount`, `heatScore`, `isLive`, and election/war state
 * without a page refresh.
 *
 * The listener emits null on any Firestore error (permissions revoked, room
 * deleted) — the chat screen should redirect to /rooms on null emission.
 *
 * Naming: replaces the deprecated subscribeRoom() — see § 8.
 *
 * @param roomId  Composite Firestore room document ID.
 * @param cb      Called with the current CWRoom on every change, or null on error.
 * @returns       Unsubscribe — call inside useEffect cleanup.
 *
 * @example
 * useEffect(() => subscribeToRoom(roomId, setRoom), [roomId]);
 */
export function subscribeToRoom(
  roomId: string,
  cb: (room: CWRoom | null) => void,
): Unsubscribe {
  if (!roomId) {
    cb(null);
    return () => {};
  }

  return roomRef(roomId).onSnapshot(
    (snap) => {
      if (!snapExists(snap)) {
        cb(null);
        return;
      }
      cb({ id: snap.id, ...(snap.data() as Omit<CWRoom, 'id'>) });
    },
    (_err) => cb(null),
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3 — ROOMS LIST SUBSCRIPTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Live subscription to the full rooms list, sorted by most-recently active.
 *
 * Used by the /rooms discovery screen. Fine for Phase 1 with < 100 rooms in
 * Chandigarh. Swap to cursor-paginated query when the catalog grows.
 *
 * @param cb  Called with the current room list on every change.
 * @returns   Unsubscribe.
 */
export function subscribeRooms(
  cb: (rooms: CWRoom[]) => void,
): Unsubscribe {
  return roomsRef()
    .orderBy('lastMessageAt', 'desc')
    .onSnapshot(
      (qs) => {
        const list: CWRoom[] = [];
        qs.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as Omit<CWRoom, 'id'>) });
        });
        cb(list);
      },
      (_err) => cb([]),
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// § 4 — QUERY BY CITY + SECTOR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all rooms that belong to a specific city and sector.
 *
 * In Phase 1 most cities have one room per sector, but the data model supports
 * multiple rooms per sector (e.g. public + skill + mood rooms within Sector 17).
 * Results are sorted newest-active first.
 *
 * ⚠️  Requires a composite index:
 *     Collection: rooms
 *     Fields:     cityId ASC · sectorId ASC · lastMessageAt DESC
 * Deploy via firestore.indexes.json before calling this in production.
 *
 * @param cityId    e.g. "chandigarh"
 * @param sectorId  e.g. "sector-17"
 * @returns         Array of CWRoom — empty array when no rooms found.
 */
export async function getRoomsByCitySector(
  cityId: string,
  sectorId: string,
): Promise<CWRoom[]> {
  if (!cityId || !sectorId) return [];

  const qs = await roomsRef()
    .where('cityId', '==', cityId)
    .where('sectorId', '==', sectorId)
    .orderBy('lastMessageAt', 'desc')
    .get();

  const list: CWRoom[] = [];
  qs.forEach((doc) => {
    list.push({ id: doc.id, ...(doc.data() as Omit<CWRoom, 'id'>) });
  });
  return list;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 5 — ONLINE COUNT (atomic — never overwrite)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Atomically increment the room's online presence counter by 1.
 *
 * Call when a user opens the chat screen (presence join).
 * Uses FieldValue.increment(1) — concurrent joins from 50 users are safe with
 * no read-then-write race condition.
 *
 * Pair with decrementOnlineCount() in the screen's useEffect cleanup and on
 * app backgrounding (AppState change handler). For Phase 2, replace with a
 * Realtime Database presence tree for sub-second accuracy.
 *
 * @param roomId  Composite Firestore room document ID.
 */
export async function incrementOnlineCount(roomId: string): Promise<void> {
  if (!roomId) return;

  await roomRef(roomId).update({
    onlineCount: increment(1),
  });
}

/**
 * Atomically decrement the room's online presence counter by 1.
 *
 * Uses a transaction to guard against underflow: if onlineCount is already
 * 0 (e.g. caused by a prior crash or missed decrement), the update is skipped.
 * Firestore has no native "decrement with floor" FieldValue, so a transaction
 * is the correct tool for this specific guard.
 *
 * Call when:
 *   1. Chat screen unmounts (useEffect cleanup)
 *   2. App moves to background (AppState 'background' | 'inactive')
 *   3. User signs out
 *
 * @param roomId  Composite Firestore room document ID.
 */
export async function decrementOnlineCount(roomId: string): Promise<void> {
  if (!roomId) return;

  const db  = firestore();
  const ref = roomRef(roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    // snapExists reads the boolean property — never calls it as a function.
    if (!snapExists(snap)) return;

    const data = snap.data() as CWRoom;
    const current = data.onlineCount ?? 0;

    // Floor guard — never write a negative count.
    if (current <= 0) return;

    tx.update(ref, { onlineCount: increment(-1) });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 6 — LAST MESSAGE DENORMALIZATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Bump the denormalized lastMessage* fields after a new message is sent.
 *
 * Called by firestore-messages.ts → sendMessage() in the same logical write
 * batch so the rooms list reflects the latest activity without a sub-query.
 * Preview is capped at 140 chars — sufficient for a two-line bubble preview
 * at any font scale.
 *
 * @param roomId  Composite Firestore room document ID.
 * @param args    Preview text, sender uid and username at post time.
 */
export async function touchRoomLastMessage(
  roomId: string,
  args: { preview: string; uid: string; username: string },
): Promise<void> {
  if (!roomId) return;

  await roomRef(roomId).update({
    lastMessagePreview:    args.preview.slice(0, 140),
    lastMessageAt:         serverTimestamp(),
    lastMessageUid:        args.uid,
    lastMessageUsername:   args.username,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 7 — DEFAULT ROOM FACTORY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Canonical default shape for a new room document.
 *
 * Used by the seed script (scripts/seed-rooms.ts) and admin tooling to ensure
 * every room is born with all required CWRoom fields. Keeping the factory here
 * means the shape stays in sync with the CWRoom interface automatically.
 *
 * @param args  Required identity fields — all other fields are defaulted.
 * @returns     Omit<CWRoom, 'id'> ready to pass to .set().
 */
export function defaultRoom(args: {
  cityId: string;
  sectorId: string;
  colonyTag: string | null;
  mayorUid?: string | null;
  createdBy: string;
}): Omit<CWRoom, 'id'> {
  return {
    cityId:                  args.cityId,
    sectorId:                args.sectorId,
    colonyTag:               args.colonyTag,
    onlineCount:             0,
    heatScore:               0,
    mayorUid:                args.mayorUid ?? null,
    pinnedAnnouncementId:    null,
    totalMembers:            0,
    aiCompanionsActive:      false,   // enabled by Cloud Function when users < threshold
    activeWar:               null,
    activeElection:          null,
    createdAt:               serverTimestamp() as any,
    lastMessageAt:           serverTimestamp() as any,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// § A — SECTOROW TYPE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Shape of one document inside /cities/{cityId}/sectors subcollection.
 * SectorPickerSheet imports this type directly from firestore-rooms.
 *
 * Firestore document ID = sectorId (e.g. "sector-17").
 * sectorId is injected at read time — not stored as a field in Firestore.
 */
export interface SectorRow {
  /** Firestore document ID — injected on read (e.g. "sector-17") */
  sectorId:    string;
  /** Display name shown in picker (e.g. "Sector 17") */
  sectorName:  string;
  /** 0–100 heat score — pill shown when ≥ 30 */
  heatScore:   number;
  /** Current online users in this sector's room */
  onlineCount: number;
  /** Optional sub-area label (e.g. "Elante Mall Area") */
  colonyTag:   string | null;
  /** false = hidden from picker but data retained */
  is_active:   boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// § B — getCities
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Shape of a /cities document as expected by CityPickerSheet.
 * NOT exported — CityPickerSheet.tsx defines and exports its own identical
 * CityDoc interface. TypeScript structural typing ensures they stay compatible.
 * If you want a single source of truth later, move this to @/types/cw.ts.
 */
interface CityDoc {
  id:           string;
  name:         string;
  state?:       string;
  online_count: number;
  sector_count: number;
  is_active:    boolean;
}

/**
 * Real-time subscription to the /cities collection.
 *
 * Filter:  country_code == "IN"  — uses existing world-cities data in Firestore.
 * Sort:    client-side A→Z       — avoids composite index requirement.
 *
 * NOTE: .where() + .orderBy() on DIFFERENT fields requires a Firestore
 * composite index. Since that index doesn't exist, the previous version was
 * throwing a Firebase error → cb([]) → FALLBACK_CITIES every time.
 * Fix: remove orderBy from the Firestore query; sort the result client-side.
 * A single .where() on one field never needs a composite index.
 */
export function getCities(cb: (cities: CityDoc[]) => void): Unsubscribe {
  return firestore()
    .collection(CITIES)
    .where('country_code', '==', 'IN')
    // ✅ NO .orderBy() here — avoids the composite index requirement that
    //    was causing Firebase to throw and return 0 results.
    //    Sorting is done client-side below (same A→Z result, zero config).
    .onSnapshot(
      (qs) => {
        const list: CityDoc[] = [];
        qs.forEach((doc) => {
          const d = doc.data();
          if (!d.name) return;

          list.push({
            id:           doc.id,
            name:         d.name as string,
            // world-cities datasets use different field names for state/region
            state:        (d.state_name ?? d.admin_name ?? d.state ?? undefined) as string | undefined,
            online_count: (d.online_count as number) ?? 0,
            sector_count: (d.sector_count as number) ?? 0,
            is_active:    true,
          });
        });

        // Sort A→Z client-side — identical result to .orderBy('name','asc')
        list.sort((a, b) => a.name.localeCompare(b.name));
        cb(list);
      },
      (err) => {
        console.error('[getCities] Firestore onSnapshot error:', err);
        cb([]);
      },
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// § C — subscribeSectorsByCity
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Real-time subscription to /cities/{cityId}/sectors subcollection.
 *
 * Filters: is_active == true
 * Order:   sectorName ASC (alphabetical)
 *
 * SectorPickerSheet calls this whenever cityId changes or the sheet opens.
 * Returns an Unsubscribe function for useEffect cleanup.
 *
 * Firestore index required:
 *   Collection group: sectors
 *   Fields:           is_active ASC, sectorName ASC
 * Firebase Console will prompt automatically — click the link in error logs.
 *
 * @param cityId  e.g. "chandigarh" — must match /cities document ID exactly
 * @param cb      Called with SectorRow[] on every change.
 * @returns       Unsubscribe — call in useEffect cleanup.
 */
export function subscribeSectorsByCity(
  cityId: string,
  cb: (sectors: SectorRow[]) => void,
): Unsubscribe {
  if (!cityId) {
    cb([]);
    return () => {};
  }

  return firestore()
    .collection(CITIES)
    .doc(cityId)
    .collection(SECTORS)
    .where('is_active', '==', true)
    .orderBy('sectorName', 'asc')
    .onSnapshot(
      (qs) => {
        const list: SectorRow[] = [];
        qs.forEach((doc) => {
          list.push({
            sectorId: doc.id,
            ...(doc.data() as Omit<SectorRow, 'sectorId'>),
          });
        });
        cb(list);
      },
      (_err) => {
        console.error('[subscribeSectorsByCity] Firestore error:', _err);
        cb([]);
      },
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// § 8 — DEPRECATED LEGACY API
// Kept for backward compat — do not use in new code.
// subscribeRoom() is renamed subscribeToRoom() — see § 2.
// RoomDoc / RoomKind replaced by CWRoom from @/types/cw.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use subscribeToRoom() — typed with CWRoom, handles null emission.
 * Will be removed in the DM-chat migration sprint (Phase 2).
 */
export function subscribeRoom(
  roomId: string,
  onChange: (room: CWRoom | null) => void,
): Unsubscribe {
  return subscribeToRoom(roomId, onChange);
}

// ─── Legacy type aliases (used by deprecated callers only) ───────────────────

/** @deprecated Use CWRoom from @/types/cw. */
export type RoomKind = 'public' | 'mood' | 'skill' | 'live';

/**
 * @deprecated Use CWRoom from @/types/cw.
 * Kept only until all callers migrate off the old shape.
 */
export type RoomDoc = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  description: string;
  kind: RoomKind;
  memberCount: number;
  lastMessagePreview: string;
  lastMessageAt: unknown | null;
  lastMessageUid: string | null;
  lastMessageUsername: string | null;
  isLive: boolean;
  liveHostUid: string | null;
  createdAt: unknown;
  createdBy: string;
};

/**
 * @file crown-rank/api/invasions.ts
 * @module CROWN — Invasions API Layer
 * @description Firestore listener + writes for City Invasion events (PRD §7,
 *   conditional Invasion Card). An invasion is a coordinated, scheduled push by
 *   one city against another's leaderboard during a Battle Hour.
 *
 * Uses the @react-native-firebase NAMESPACED API. `snap.exists` is a boolean
 * PROPERTY. RSVP counters are kept with atomic increments via FieldValue.
 *
 * @security Reads are limited to invasions targeting the user's city or planned
 *   by the user. RSVP writes are restricted to the authenticated user's own doc.
 */

import { firestore, serverTimestamp, increment } from '@/lib/firebase';
import type { InvasionData, InvasionRole } from '../types';

type FsTimestamp = { toMillis: () => number; toDate: () => Date };
type DocumentData = Record<string, any>;
export type Unsubscribe = () => void;
export type RsvpChoice = 'going' | 'maybe' | 'skip';

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

function toIso(val: FsTimestamp | number | string | null | undefined): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (typeof (val as FsTimestamp).toDate === 'function') {
    return (val as FsTimestamp).toDate().toISOString();
  }
  return null;
}

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / 1000));
}

function resolveRole(raw: DocumentData, userId: string): InvasionRole {
  if (raw.planner_id && raw.planner_id === userId) return 'planner';
  const invitees: string[] = Array.isArray(raw.invitee_ids) ? raw.invitee_ids : [];
  if (invitees.includes(userId)) return 'invitee';
  return null;
}

function mapInvasion(id: string, r: DocumentData, userId: string): InvasionData {
  const startIso = toIso(r.start_time) ?? new Date().toISOString();
  return {
    invasionId: id,
    plannerHandle: r.planner_handle ?? '',
    targetCityId: r.target_city_id ?? '',
    targetCityLabel: r.target_city_label ?? '',
    banner: r.banner ?? '',
    startTime: startIso,
    startsIn: secondsUntil(startIso),
    rsvpGoing: r.rsvp_going ?? 0,
    rsvpMaybe: r.rsvp_maybe ?? 0,
    rsvpSkip: r.rsvp_skip ?? 0,
    warCry: r.war_cry ?? null,
    role: resolveRole(r, userId),
  };
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: Active Invasion for the user's city
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to the single active invasion relevant to the user's city.
 * Returns the soonest upcoming invasion targeting `cityId`, or null if none.
 *
 * Path: /invasions  (filtered by target_city_id + status == 'scheduled')
 */
export function subscribeToActiveInvasion(
  cityId: string,
  userId: string,
  onUpdate: (invasion: InvasionData | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const query = firestore()
    .collection('invasions')
    .where('target_city_id', '==', cityId)
    .where('status', '==', 'scheduled')
    .orderBy('start_time', 'asc')
    .limit(1);

  return query.onSnapshot(
    (snap) => {
      if (snap.empty) {
        onUpdate(null);
        return;
      }
      const d = snap.docs[0];
      onUpdate(mapInvasion(d.id, d.data() ?? {}, userId));
    },
    (err: Error) => onError(new Error(err.message)),
  );
}

// ──────────────────────────────────────────────────────────────
// WRITE: Create an invasion (planner)
// ──────────────────────────────────────────────────────────────

export interface CreateInvasionParams {
  plannerId: string;
  plannerHandle: string;
  targetCityId: string;
  targetCityLabel: string;
  banner: string;
  /** ISO timestamp for when the invasion begins. */
  startTime: string;
  warCry?: string | null;
}

export interface CreateInvasionResult {
  invasionId: string;
}

/** Creates a scheduled invasion and registers the planner as "going". */
export async function createInvasion(
  params: CreateInvasionParams,
): Promise<CreateInvasionResult> {
  const {
    plannerId,
    plannerHandle,
    targetCityId,
    targetCityLabel,
    banner,
    startTime,
    warCry = null,
  } = params;

  const docRef = firestore().collection('invasions').doc();

  await docRef.set({
    planner_id: plannerId,
    planner_handle: plannerHandle,
    target_city_id: targetCityId,
    target_city_label: targetCityLabel,
    banner,
    start_time: new Date(startTime),
    war_cry: warCry,
    status: 'scheduled',
    invitee_ids: [],
    rsvp_going: 1,
    rsvp_maybe: 0,
    rsvp_skip: 0,
    created_at: serverTimestamp(),
  });

  // Planner's own RSVP record.
  await docRef.collection('rsvps').doc(plannerId).set({
    choice: 'going',
    handle: plannerHandle,
    updated_at: serverTimestamp(),
  });

  return { invasionId: docRef.id };
}

// ──────────────────────────────────────────────────────────────
// WRITE: RSVP to an invasion (join / change response)
// ──────────────────────────────────────────────────────────────

const CHOICE_FIELD: Record<RsvpChoice, string> = {
  going: 'rsvp_going',
  maybe: 'rsvp_maybe',
  skip: 'rsvp_skip',
};

/**
 * Records (or updates) the user's RSVP to an invasion. Adjusts aggregate
 * counters atomically: decrements the previous choice (if any) and increments
 * the new one, so totals stay consistent across response changes.
 */
export async function joinInvasion(
  invasionId: string,
  userId: string,
  userHandle: string,
  choice: RsvpChoice,
): Promise<void> {
  const invasionRef = firestore().collection('invasions').doc(invasionId);
  const rsvpRef = invasionRef.collection('rsvps').doc(userId);

  await firestore().runTransaction(async (tx) => {
    const existing = await tx.get(rsvpRef);
    const prevChoice: RsvpChoice | null =
      existing.exists ? ((existing.data() ?? {}).choice ?? null) : null;

    if (prevChoice === choice) return; // no change

    const counterUpdates: DocumentData = {
      [CHOICE_FIELD[choice]]: increment(1),
    };
    if (prevChoice) {
      counterUpdates[CHOICE_FIELD[prevChoice]] = increment(-1);
    }

    tx.set(
      rsvpRef,
      { choice, handle: userHandle, updated_at: serverTimestamp() },
      { merge: true },
    );
    tx.update(invasionRef, counterUpdates);
  });
}

// ──────────────────────────────────────────────────────────────
// WRITE: Cancel an invasion (planner only)
// ──────────────────────────────────────────────────────────────

/** Cancels a scheduled invasion. Server rules enforce planner-only access. */
export async function cancelInvasion(invasionId: string): Promise<void> {
  await firestore().collection('invasions').doc(invasionId).update({
    status: 'cancelled',
    cancelled_at: serverTimestamp(),
  });
}

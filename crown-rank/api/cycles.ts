/**
 * @file crown-rank/api/cycles.ts
 * @module CROWN — Cycles API Layer
 * @description Firebase Firestore real-time listeners for cycle phase data.
 *   Implements PRD §17.2 — Active cycle phase listener (fires on every phase change).
 *   A "cycle" is one 5-hour round (Phases 1–5) per geography per tier.
 *
 * Uses the @react-native-firebase NAMESPACED API. `snap.exists` is a boolean
 * PROPERTY. All document/collection paths use a valid even/odd segment count.
 *
 * @security All reads are city-scoped. No cross-user or cross-city data exposed.
 */

import { firestore } from '@/lib/firebase';
import type { RankTier } from './rank';

type FsTimestamp = { toMillis: () => number };
type DocumentData = Record<string, any>;
export type Unsubscribe = () => void;

// ──────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────

const MAX_CYCLE_HISTORY = 10 as const;

/** Duration of each phase in milliseconds — used for local phase progress bar */
export const PHASE_DURATIONS_MS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 3 * 60 * 60_000 + 30 * 60_000, // 3h 30m — Dark Tunnel
  2: 60 * 60_000, // 60m — Battle Hour
  3: 30_000, // 30s — Merit Freeze (instant)
  4: 20 * 60_000, // 20m — BOLI Auction
  5: 10 * 60_000, // 10m — Decision Window
} as const;

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────

export type CyclePhase = 1 | 2 | 3 | 4 | 5;

export interface HighestBid {
  amount: number;
  bidderId: string;
  bidderHandle: string;
  bidderTrustScore: number;
}

export interface ActiveCycle {
  cycleId: string;
  tier: RankTier;
  geographyId: string;
  geographyName: string;
  phase: CyclePhase;
  phaseStartedAtMs: number;
  freezeAtMs: number;
  auctionEndsAtMs: number | null;
  decisionEndsAtMs: number | null;
  meritWinnerId: string | null;
  meritWinnerHandle: string | null;
  meritWinnerScore: number | null;
  highestBid: HighestBid | null;
  baseBidPrice: number | null;
  totalCycleMs: number; // sum of all phases = 5h
}

export interface CyclePhaseProgress {
  phase: CyclePhase;
  phaseName: string;
  phaseEmoji: string;
  progressFraction: number; // 0.0 → 1.0 within current phase
  totalCycleProgressFraction: number; // 0.0 → 1.0 across entire 5h cycle
  msUntilNextPhase: number;
}

export interface CycleHistoryEntry {
  cycleId: string;
  tier: RankTier;
  geographyId: string;
  startedAtMs: number;
  endedAtMs: number;
  meritWinnerId: string | null;
  meritWinnerHandle: string | null;
  finalHighBidAmount: number | null;
  outcome: 'accepted' | 'kept' | 'no_bid' | null;
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

function toMs(val: FsTimestamp | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof (val as FsTimestamp).toMillis === 'function') {
    return (val as FsTimestamp).toMillis();
  }
  return null;
}

const PHASE_NAMES: Record<CyclePhase, string> = {
  1: 'Dark Tunnel',
  2: 'Battle Hour',
  3: 'Merit Freeze',
  4: 'BOLI Auction',
  5: 'Decision',
};

const PHASE_EMOJIS: Record<CyclePhase, string> = {
  1: '🌒',
  2: '⚔️',
  3: '🔒',
  4: '💰',
  5: '⚔️',
};

/** Base ref for a tier + geography: /cycles/{tier}/geos/{geographyId} (valid 4-seg doc). */
function geoBaseRef(tier: RankTier, geographyId: string) {
  return firestore()
    .collection('cycles')
    .doc(tier)
    .collection('geos')
    .doc(geographyId);
}

/** The active-cycle doc: /cycles/{tier}/geos/{geographyId}/state/active_cycle (valid 6-seg doc). */
function activeCycleRef(tier: RankTier, geographyId: string) {
  return geoBaseRef(tier, geographyId).collection('state').doc('active_cycle');
}

function mapActiveCycle(
  tier: RankTier,
  geographyId: string,
  snap: DocumentData,
  docId: string,
): ActiveCycle {
  const hb = snap.highest_bid;
  return {
    cycleId: snap.cycle_id ?? docId,
    tier,
    geographyId,
    geographyName: snap.geography_name ?? '',
    phase: (snap.phase ?? 1) as CyclePhase,
    phaseStartedAtMs: toMs(snap.phase_started_at) ?? Date.now(),
    freezeAtMs: toMs(snap.freeze_at) ?? Date.now(),
    auctionEndsAtMs: toMs(snap.auction_ends_at),
    decisionEndsAtMs: toMs(snap.decision_ends_at),
    meritWinnerId: snap.merit_winner_id ?? null,
    meritWinnerHandle: snap.merit_winner_handle ?? null,
    meritWinnerScore: snap.merit_winner_score ?? null,
    highestBid: hb
      ? {
          amount: hb.amount ?? 0,
          bidderId: hb.bidder_id ?? '',
          bidderHandle: hb.bidder_handle ?? '',
          bidderTrustScore: hb.bidder_trust_score ?? 0,
        }
      : null,
    baseBidPrice: snap.base_bid_price ?? null,
    totalCycleMs: Object.values(PHASE_DURATIONS_MS).reduce((a, b) => a + b, 0),
  };
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: Active Cycle Phase (§17.2 — fires on phase changes only)
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to the active cycle document for a tier + geography.
 * Fires immediately with current data, then on every phase transition.
 *
 * @security Firestore rule: `allow read: if isAuthenticated();` (city members only)
 */
export function subscribeToActiveCycle(
  tier: RankTier,
  geographyId: string,
  onUpdate: (cycle: ActiveCycle | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const ref = activeCycleRef(tier, geographyId);

  return ref.onSnapshot(
    (snap) => {
      if (!snap.exists) {
        onUpdate(null);
        return;
      }
      onUpdate(mapActiveCycle(tier, geographyId, snap.data() ?? {}, snap.id));
    },
    (err: Error) => onError(new Error(err.message)),
  );
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: Multiple Active Cycles (all 4 tiers for a user)
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to active cycles for all active tiers simultaneously.
 * Each listener is independent. Returns one cleanup function that stops all.
 */
export function subscribeToAllActiveCycles(
  tierGeographies: Partial<Record<RankTier, string>>,
  onUpdate: (tier: RankTier, cycle: ActiveCycle | null) => void,
  onError: (tier: RankTier, err: Error) => void,
): () => void {
  const unsubs: Unsubscribe[] = [];

  for (const [tier, geographyId] of Object.entries(tierGeographies)) {
    if (!geographyId) continue;
    const t = tier as RankTier;
    const unsub = subscribeToActiveCycle(
      t,
      geographyId,
      (cycle) => onUpdate(t, cycle),
      (err) => onError(t, err),
    );
    unsubs.push(unsub);
  }

  return () => unsubs.forEach((u) => u());
}

// ──────────────────────────────────────────────────────────────
// COMPUTE: Phase Progress (client-side, from ActiveCycle data)
// ──────────────────────────────────────────────────────────────

/**
 * Computes progress within the current cycle phase and across the full 5h cycle.
 * Purely client-side — no additional network calls.
 */
export function computeCycleProgress(
  cycle: ActiveCycle,
  nowMs: number = Date.now(),
): CyclePhaseProgress {
  const phaseElapsedMs = nowMs - cycle.phaseStartedAtMs;
  const phaseDurationMs = PHASE_DURATIONS_MS[cycle.phase];
  const progressFraction = Math.min(1, Math.max(0, phaseElapsedMs / phaseDurationMs));
  const msUntilNextPhase = Math.max(0, phaseDurationMs - phaseElapsedMs);

  // Total cycle progress: sum of completed phases + fraction of current
  const totalCycleMs = cycle.totalCycleMs;
  let elapsedBeforeCurrentPhaseMs = 0;
  for (let p = 1; p < cycle.phase; p++) {
    elapsedBeforeCurrentPhaseMs += PHASE_DURATIONS_MS[p as CyclePhase];
  }
  const totalElapsedMs = elapsedBeforeCurrentPhaseMs + phaseElapsedMs;
  const totalCycleProgressFraction = Math.min(
    1,
    Math.max(0, totalElapsedMs / totalCycleMs),
  );

  return {
    phase: cycle.phase,
    phaseName: PHASE_NAMES[cycle.phase],
    phaseEmoji: PHASE_EMOJIS[cycle.phase],
    progressFraction,
    totalCycleProgressFraction,
    msUntilNextPhase,
  };
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: Highest Bid (§17.2 — real-time during Phase 4)
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to the highest bid on a cycle's BOLI auction.
 * The highest_bid is embedded in the active_cycle document (updated atomically).
 */
export function subscribeToHighestBid(
  tier: RankTier,
  geographyId: string,
  _cycleId: string,
  onUpdate: (bid: HighestBid | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const ref = activeCycleRef(tier, geographyId);

  return ref.onSnapshot(
    (snap) => {
      if (!snap.exists) {
        onUpdate(null);
        return;
      }
      const hb = (snap.data() ?? {}).highest_bid;
      onUpdate(
        hb
          ? {
              amount: hb.amount ?? 0,
              bidderId: hb.bidder_id ?? '',
              bidderHandle: hb.bidder_handle ?? '',
              bidderTrustScore: hb.bidder_trust_score ?? 0,
            }
          : null,
      );
    },
    (err: Error) => onError(new Error(err.message)),
  );
}

// ──────────────────────────────────────────────────────────────
// READ: Cycle History (past cycles for a geography)
// ──────────────────────────────────────────────────────────────

/**
 * Fetches the 10 most recent settled cycles for a tier + geography.
 * Used to show historical context in RankDetailSheet.
 */
export async function fetchCycleHistory(
  tier: RankTier,
  geographyId: string,
): Promise<CycleHistoryEntry[]> {
  try {
    const snap = await geoBaseRef(tier, geographyId)
      .collection('history')
      .orderBy('ended_at', 'desc')
      .limit(MAX_CYCLE_HISTORY)
      .get();

    return snap.docs.map((d) => {
      const r = (d.data() ?? {}) as DocumentData;
      return {
        cycleId: d.id,
        tier,
        geographyId,
        startedAtMs: toMs(r.started_at) ?? 0,
        endedAtMs: toMs(r.ended_at) ?? 0,
        meritWinnerId: r.merit_winner_id ?? null,
        meritWinnerHandle: r.merit_winner_handle ?? null,
        finalHighBidAmount: r.final_high_bid_amount ?? null,
        outcome: r.outcome ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// READ: One-time active cycle fetch (for initial mount)
// ──────────────────────────────────────────────────────────────

/**
 * One-time fetch of the active cycle. Use for initial screen mount
 * before the real-time listener kicks in.
 */
export async function getActiveCycleOnce(
  tier: RankTier,
  geographyId: string,
): Promise<ActiveCycle | null> {
  try {
    const snap = await activeCycleRef(tier, geographyId).get();
    if (!snap.exists) return null;
    return mapActiveCycle(tier, geographyId, snap.data() ?? {}, snap.id);
  } catch {
    return null;
  }
}

/**
 * @crown/core/rank — Rank Score formula & Base Bidding Price
 *
 * Per PRD §8.3 (Rank Score) and §8.4 (Base Bidding Price).
 * These functions are pure — no side effects, fully testable.
 *
 * @security Auth required on all caller routes. No client-trusted inputs.
 */

import { Tier } from '../types';

// ── RANK SCORE EVENT TYPES (§8.3) ────────────────────────────────────────────

export type RankScoreEventType =
  | 'message_sent'
  | 'reaction_received'
  | 'reply_received'
  | 'new_follower'
  | 'message_pinned_by_mayor'
  | 'pin_view'
  | 'invasion_participation';

export interface RankScoreEvent {
  type: RankScoreEventType;
  /** Count of this event type in the cycle */
  count: number;
  /** Optional scope multiplier (e.g., within target city during invasion) */
  multiplier?: number;
}

/** Points awarded per event type (from §8.3) */
const RANK_SCORE_WEIGHTS: Record<RankScoreEventType, number> = {
  message_sent: 1,
  reaction_received: 2,
  reply_received: 3,
  new_follower: 5,
  message_pinned_by_mayor: 10,
  pin_view: 0.5,
  invasion_participation: 4,
} as const;

/**
 * Calculates total rank score for a user in a given cycle.
 * Per PRD §8.3.
 *
 * @param events - Array of scored events in the cycle
 * @returns Total rank score (always non-negative integer)
 *
 * @example
 *   calculateRankScore([
 *     { type: 'message_sent', count: 45 },
 *     { type: 'reaction_received', count: 120 },
 *   ]) → 285
 */
export function calculateRankScore(events: RankScoreEvent[]): number {
  return Math.max(
    0,
    Math.round(
      events.reduce((total, event) => {
        const weight = RANK_SCORE_WEIGHTS[event.type];
        const multiplier = event.multiplier ?? 1;
        return total + weight * event.count * multiplier;
      }, 0),
    ),
  );
}

// ── BASE BIDDING PRICE (§8.4) ─────────────────────────────────────────────────

/** Minimum bid multipliers per tier */
const BASE_BID_TIER_MULTIPLIER: Record<Tier, number> = {
  baron: 1.0,
  viceroy: 5.0,
  sovereign: 20.0,
  imperator: 100.0,
} as const;

/** Minimum base price per tier (floor, even if score is 0) */
const BASE_BID_FLOOR: Record<Tier, number> = {
  baron: 100,
  viceroy: 500,
  sovereign: 2000,
  imperator: 10000,
} as const;

/** Active users activity multiplier breakpoints */
const ACTIVE_USERS_MULTIPLIER = (activeUsers: number): number => {
  if (activeUsers >= 10000) return 3.0;
  if (activeUsers >= 5000) return 2.5;
  if (activeUsers >= 1000) return 2.0;
  if (activeUsers >= 500) return 1.5;
  if (activeUsers >= 100) return 1.2;
  return 1.0;
};

/**
 * Computes the Base Bidding Price for a BOLI auction.
 * Per PRD §8.4.
 *
 * Formula: floor(rank_score × tier_multiplier × activity_multiplier)
 *          clamped to minimum floor per tier.
 *
 * @param rankScore - Merit Winner's rank score this cycle
 * @param tier - Geographic tier of the title
 * @param activeUsers - Active users in this geography this cycle
 * @returns Base bidding price in Credits
 */
export function computeBasePrice(
  rankScore: number,
  tier: Tier,
  activeUsers: number,
): number {
  const tierMult = BASE_BID_TIER_MULTIPLIER[tier];
  const activityMult = ACTIVE_USERS_MULTIPLIER(activeUsers);
  const computed = Math.floor(rankScore * tierMult * activityMult);
  return Math.max(computed, BASE_BID_FLOOR[tier]);
}

// ── ACCEPT AMOUNT CALCULATION ─────────────────────────────────────────────────

/** Platform fee on BOLI auction: 8% per PRD */
const CROWN_FEE_PERCENT = 0.08;

/**
 * Calculates the Credits the Merit Winner receives if they ACCEPT MONEY.
 * 92% of the highest bid after 8% CROWN fee.
 *
 * @example computeAcceptAmount(14500) → 13340
 */
export function computeAcceptAmount(highestBid: number): number {
  return Math.floor(highestBid * (1 - CROWN_FEE_PERCENT));
}

// ── PROGRESS PERCENTAGE ───────────────────────────────────────────────────────

/**
 * Computes the progress percentage toward a rank milestone.
 * Clamped to [0, 1].
 *
 * @param score - Current rank score
 * @param milestoneScore - Score required to reach milestone
 * @returns Float in [0, 1]
 *
 * @example getProgressPercent(80, 100) → 0.80
 * @example getProgressPercent(120, 100) → 1.0  (clamped)
 */
export function getProgressPercent(score: number, milestoneScore: number): number {
  if (milestoneScore <= 0) return 1;
  return Math.min(1, Math.max(0, score / milestoneScore));
}

// ── MILESTONE LABEL ───────────────────────────────────────────────────────────

/**
 * Generates a human-readable milestone label based on rank position.
 *
 * @param rankPosition - Current rank (null during Phase 1)
 * @param score - Current rank score
 * @param scoreNeeded - Points until next milestone
 * @param milestoneHeld - Currently held milestone string, or null
 * @param milestoneHeldSince - Minutes held at current milestone
 * @returns Display string for progress bar label
 */
export function getMilestoneLabel(
  rankPosition: number | null,
  score: number,
  scoreNeeded: number,
  milestoneHeld: string | null,
  milestoneHeldSince: number | null,
): string {
  if (milestoneHeld && milestoneHeldSince !== null) {
    const hours = Math.floor(milestoneHeldSince / 60);
    const mins = milestoneHeldSince % 60;
    const duration =
      hours > 0
        ? `${hours}h ${mins}m`
        : `${mins}m`;
    return `${milestoneHeld} — held for ${duration}`;
  }

  if (rankPosition === null) {
    // Phase 1: show score only
    return `${score} pts this cycle`;
  }

  if (scoreNeeded <= 0) {
    return 'Milestone reached!';
  }

  return `Need ${new Intl.NumberFormat('en-US').format(scoreNeeded)} more reactions`;
}

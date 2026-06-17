/**
 * @crown/core/cycle — Cycle Phase Detection & Progress
 *
 * Per PRD §8.1:
 *   Phase 1 — Dark Tunnel:    3h 30m  (rankings HIDDEN)
 *   Phase 2 — Battle Hour:    60 min  (live leaderboard visible)
 *   Phase 3 — Merit Freeze:   5 min   (winner locked)
 *   Phase 4 — BOLI Auction:   20 min  (open bidding)
 *   Phase 5 — Decision Window: 10 min (Merit Winner decides)
 *
 * Total cycle: 5 hours.
 */

import { CyclePhase, CyclePhaseInfo } from '../types';
import { PHASE_META } from '../constants/titles';

// ── PHASE DURATIONS (ms) ──────────────────────────────────────────────────────

export const PHASE_DURATIONS_MS = {
  1: 3 * 60 * 60 * 1000 + 30 * 60 * 1000, // 3h 30m = 12,600,000ms
  2: 60 * 60 * 1000,                        // 60 min = 3,600,000ms
  3: 5 * 60 * 1000,                         // 5 min  = 300,000ms
  4: 20 * 60 * 1000,                        // 20 min = 1,200,000ms
  5: 10 * 60 * 1000,                        // 10 min = 600,000ms
} as const;

export const TOTAL_CYCLE_MS = Object.values(PHASE_DURATIONS_MS).reduce(
  (sum, v) => sum + v,
  0,
); // 5h = 18,000,000ms

// ── PHASE BOUNDARIES ─────────────────────────────────────────────────────────

/** Cumulative ms offsets from cycle start at which each phase begins */
const PHASE_START_OFFSETS: Record<CyclePhase, number> = {
  1: 0,
  2: PHASE_DURATIONS_MS[1],
  3: PHASE_DURATIONS_MS[1] + PHASE_DURATIONS_MS[2],
  4: PHASE_DURATIONS_MS[1] + PHASE_DURATIONS_MS[2] + PHASE_DURATIONS_MS[3],
  5:
    PHASE_DURATIONS_MS[1] +
    PHASE_DURATIONS_MS[2] +
    PHASE_DURATIONS_MS[3] +
    PHASE_DURATIONS_MS[4],
};

// ── PHASE DETECTION ───────────────────────────────────────────────────────────

/**
 * Determines the current cycle phase based on cycle start time and now.
 *
 * @param cycleStartMs - Cycle start in Unix ms
 * @param nowMs - Current time in Unix ms (default: Date.now())
 * @returns Phase 1–5, or phase 1 of next cycle if current is over
 *
 * @example
 *   // 2 hours into a cycle → Phase 1 (Dark Tunnel)
 *   getCyclePhase(cycleStart, cycleStart + 2 * 3600 * 1000) → 1
 *
 *   // 4 hours 10 minutes in → Phase 3 (after Battle Hour and Merit Freeze)
 *   getCyclePhase(cycleStart, cycleStart + (3.5 + 1 + 0.1) * 3600000) → 3 → actually 4
 */
export function getCyclePhase(cycleStartMs: number, nowMs: number = Date.now()): CyclePhase {
  const elapsed = nowMs - cycleStartMs;

  if (elapsed < 0) return 1; // Not started yet
  if (elapsed >= TOTAL_CYCLE_MS) return 1; // Cycle over, new cycle starts

  for (let phase = 5; phase >= 1; phase--) {
    if (elapsed >= PHASE_START_OFFSETS[phase as CyclePhase]) {
      return phase as CyclePhase;
    }
  }

  return 1;
}

/**
 * Returns the progress through the current phase as a fraction [0, 1].
 *
 * @param cycleStartMs - Cycle start in Unix ms
 * @param nowMs - Current time in Unix ms
 */
export function getCycleProgress(cycleStartMs: number, nowMs: number = Date.now()): number {
  const phase = getCyclePhase(cycleStartMs, nowMs);
  const phaseStart = cycleStartMs + PHASE_START_OFFSETS[phase];
  const phaseDuration = PHASE_DURATIONS_MS[phase];
  const phaseElapsed = nowMs - phaseStart;

  return Math.min(1, Math.max(0, phaseElapsed / phaseDuration));
}

/**
 * Returns seconds remaining in the current phase.
 *
 * @param cycleStartMs - Cycle start in Unix ms
 * @param nowMs - Current time in Unix ms
 */
export function getSecondsUntilNextPhase(
  cycleStartMs: number,
  nowMs: number = Date.now(),
): number {
  const phase = getCyclePhase(cycleStartMs, nowMs);
  const phaseStart = cycleStartMs + PHASE_START_OFFSETS[phase];
  const phaseEnd = phaseStart + PHASE_DURATIONS_MS[phase];
  return Math.max(0, Math.floor((phaseEnd - nowMs) / 1000));
}

/**
 * Returns seconds until Phase 2 (Battle Hour) starts, specifically.
 * Used for the Phase 1 "Battle Hour in XX:XX:XX" countdown.
 *
 * @returns Seconds until Battle Hour, or 0 if already in Phase 2+
 */
export function getSecondsUntilBattleHour(
  cycleStartMs: number,
  nowMs: number = Date.now(),
): number {
  const phase = getCyclePhase(cycleStartMs, nowMs);
  if (phase >= 2) return 0;

  const battleHourStart = cycleStartMs + PHASE_START_OFFSETS[2];
  return Math.max(0, Math.floor((battleHourStart - nowMs) / 1000));
}

// ── FULL PHASE INFO ───────────────────────────────────────────────────────────

/**
 * Builds the complete CyclePhaseInfo object from a Firestore cycle document.
 * Call this when constructing state from Firestore data.
 */
export function buildCyclePhaseInfo(firestoreDoc: {
  cycleId: string;
  phase: CyclePhase;
  phaseStartedAt: { toMillis: () => number };
  freezeAt: { toMillis: () => number };
  auctionEndsAt: { toMillis: () => number } | null;
  decisionEndsAt: { toMillis: () => number } | null;
  meritWinnerId: string | null;
  highestBid: { amount: number; bidderId: string } | null;
  baseBidPrice: number | null;
}): CyclePhaseInfo {
  const phase = firestoreDoc.phase;
  const phaseStartedAt = new Date(firestoreDoc.phaseStartedAt.toMillis()).toISOString();
  const cycleStartMs = firestoreDoc.phaseStartedAt.toMillis() - PHASE_START_OFFSETS[phase];
  const nextPhaseAt = new Date(
    cycleStartMs + PHASE_START_OFFSETS[phase] + PHASE_DURATIONS_MS[phase],
  ).toISOString();

  return {
    phase,
    phaseName: PHASE_META[phase].name,
    phaseEmoji: PHASE_META[phase].emoji,
    phaseStartedAt,
    nextPhaseAt,
    freezeAt: new Date(firestoreDoc.freezeAt.toMillis()).toISOString(),
    auctionEndsAt: firestoreDoc.auctionEndsAt
      ? new Date(firestoreDoc.auctionEndsAt.toMillis()).toISOString()
      : null,
    decisionEndsAt: firestoreDoc.decisionEndsAt
      ? new Date(firestoreDoc.decisionEndsAt.toMillis()).toISOString()
      : null,
    meritWinnerId: firestoreDoc.meritWinnerId,
    highestBid: firestoreDoc.highestBid,
    baseBidPrice: firestoreDoc.baseBidPrice,
  };
}

// ── COUNTDOWN FORMATTING ──────────────────────────────────────────────────────

/**
 * Formats seconds into HH:MM:SS display string.
 * Per PRD: "02:47:13" format.
 *
 * @example formatCountdown(10033) → "02:47:13"
 * @example formatCountdown(583) → "00:09:43"
 */
export function formatCountdown(totalSeconds: number): {
  hours: string;
  minutes: string;
  seconds: string;
  display: string;
} {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return {
    hours: hh,
    minutes: mm,
    seconds: ss,
    display: `${hh}:${mm}:${ss}`,
  };
}

/**
 * Short format: "2h 47m" for Battle Schedule rows.
 * If > 24h: "2 days 3h".
 *
 * @example formatDuration(10033) → "2h 47m"
 * @example formatDuration(90000) → "1 day 1h"
 */
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ── SLEEP WINDOW DETECTION ────────────────────────────────────────────────────

/**
 * Determines if a given Unix ms timestamp falls in the user's sleep window
 * (11pm–7am local time per §8.8 Layer 3).
 *
 * @param timestampMs - Unix ms of the freeze time
 * @returns true if the time falls in sleep window
 */
export function isSleepWindow(timestampMs: number): boolean {
  const date = new Date(timestampMs);
  const localHour = date.getHours(); // device local time
  return localHour >= 23 || localHour < 7;
}

/**
 * Formats a freeze timestamp into:
 * - Date label: "TODAY" | "TOMORROW" | "MON" | "+2 DAYS"
 * - Local time: "8:00 PM IST"
 */
export function formatFreezeTime(
  freezeMs: number,
  nowMs: number = Date.now(),
): { dateLabel: string; localTime: string } {
  const date = new Date(freezeMs);
  const diffMs = freezeMs - nowMs;
  const diffDays = Math.floor(diffMs / 86400000);

  let dateLabel: string;
  if (diffDays === 0) {
    dateLabel = 'TODAY';
  } else if (diffDays === 1) {
    dateLabel = 'TOMORROW';
  } else if (diffDays < 7) {
    dateLabel = date
      .toLocaleDateString('en-US', { weekday: 'short' })
      .toUpperCase();
  } else {
    dateLabel = `+${diffDays} DAYS`;
  }

  const localTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  return { dateLabel, localTime };
}

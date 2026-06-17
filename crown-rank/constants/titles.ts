/**
 * TITLES — LAW 5 of CROWN PRD
 * NEVER hardcode title strings in component code.
 * ALL title strings come exclusively from this file.
 *
 * The contract: TITLES.CITY === "Mayor (VICEROY)" — always with brackets.
 * NEVER: "VICEROY", "Mayor", "Mayor VICEROY" separately.
 */

import { Tier } from '../types';

// ── TITLE STRINGS ─────────────────────────────────────────────────────────────

export const TITLES = {
  /** Sector-level title */
  SECTOR: 'BARON',
  /** City-level title — ALWAYS this exact string with brackets */
  CITY: 'Mayor (VICEROY)',
  /** Country-level title */
  COUNTRY: 'SOVEREIGN',
  /** World-level title */
  WORLD: 'IMPERATOR',
} as const;

// ── TIER → TITLE MAPPING ─────────────────────────────────────────────────────

export const TIER_TO_TITLE: Record<Tier, string> = {
  baron: TITLES.SECTOR,
  viceroy: TITLES.CITY,
  sovereign: TITLES.COUNTRY,
  imperator: TITLES.WORLD,
} as const;

// ── FULL TITLE STRINGS (for display) ─────────────────────────────────────────

/**
 * Generates the full title string for a given tier and geography.
 * @example getTitleString('baron', 'Sector 35, Chandigarh')
 *   → "BARON of Sector 35, Chandigarh"
 * @example getTitleString('viceroy', 'Mumbai')
 *   → "Mayor (VICEROY) of Mumbai"
 */
export function getTitleString(tier: Tier, geographyLabel: string): string {
  return `${TIER_TO_TITLE[tier]} of ${geographyLabel}`;
}

/**
 * Generates the Decision Prompt header (two-line format).
 * @example getDecisionHeader('viceroy', 'Mumbai')
 *   → { city: 'MUMBAI', title: 'MAYOR (VICEROY)' }
 */
export function getDecisionHeader(
  tier: Tier,
  geographyLabel: string,
): { city: string; title: string } {
  return {
    city: geographyLabel.toUpperCase(),
    title: TIER_TO_TITLE[tier].toUpperCase(),
  };
}

// ── PHASE NAMES ───────────────────────────────────────────────────────────────

export const PHASE_META = {
  1: { name: 'Dark Tunnel', emoji: '🌒', shortName: 'DARK TUNNEL' },
  2: { name: 'Battle Hour', emoji: '⚔️', shortName: 'BATTLE HOUR' },
  3: { name: 'Merit Freeze', emoji: '🔒', shortName: 'MERIT FREEZE' },
  4: { name: 'BOLI Auction', emoji: '💰', shortName: 'BOLI AUCTION' },
  5: { name: 'Decision Window', emoji: '⚔️', shortName: 'DECISION TIME' },
} as const;

// ── BADGE TYPES ───────────────────────────────────────────────────────────────

export const BADGE_TYPES = {
  HEARD_TODAY: 'Heard Today',
  RISING: 'Rising',
  TOP_10: 'Top 10',
  TOP_50: 'Top 50',
  TOP_100: 'Top 100',
} as const;

// ── TIER ORDERING (highest = index 0) ────────────────────────────────────────

export const TIER_PRIORITY: Record<Tier, number> = {
  imperator: 0,
  sovereign: 1,
  viceroy: 2,
  baron: 3,
} as const;

/**
 * Returns the highest-priority tier from a list of held titles.
 * Used to determine which title to show in the Hero Card compact view.
 */
export function getHighestTier(tiers: Tier[]): Tier {
  return tiers.reduce((highest, current) =>
    TIER_PRIORITY[current] < TIER_PRIORITY[highest] ? current : highest,
  );
}

// ── CREDITS FORMATTING ────────────────────────────────────────────────────────

/**
 * Formats a credit amount with comma separators.
 * Per LAW 2: "13,340 Credits" NOT "13340Cr" NOT "₹13,340"
 * Indian number formatting for amounts > 1 lakh.
 */
export function formatCredits(amount: number): string {
  // Indian number formatting: 1,00,000 style for large amounts
  if (amount >= 100000) {
    return new Intl.NumberFormat('en-IN').format(amount) + ' Credits';
  }
  return new Intl.NumberFormat('en-US').format(amount) + ' Credits';
}

/**
 * Formats a credit amount without the "Credits" suffix (for compact display).
 */
export function formatCreditAmount(amount: number): string {
  if (amount >= 100000) {
    return new Intl.NumberFormat('en-IN').format(amount) + ' Cr';
  }
  return new Intl.NumberFormat('en-US').format(amount) + ' Cr';
}

/**
 * Formats a leaderboard score with M/K abbreviation.
 * @example formatScore(227500000) → "227.5M"
 * @example formatScore(12500) → "12.5K"
 */
export function formatScore(score: number): string {
  if (score >= 1_000_000) {
    return (score / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (score >= 1_000) {
    return (score / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return score.toString();
}

/**
 * Formats a rank position with # prefix and comma separator.
 * @example formatRank(8) → "#8"
 * @example formatRank(1247) → "#1,247"
 * @example formatRank(18994) → "#18,994"
 */
export function formatRank(position: number): string {
  return '#' + new Intl.NumberFormat('en-US').format(position);
}

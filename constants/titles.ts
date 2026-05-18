/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Title Hierarchy Constants                                       ║
 * ║  Phase 1.4 · §1.4.9 Phase C — Single Source of Truth                    ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ENGINEERING ENFORCEMENT (PR BLOCK RULE):                                ║
 * ║  Hardcoding "Mayor", "VICEROY", "BARON", "SOVEREIGN", or "IMPERATOR"     ║
 * ║  anywhere else in the codebase is a PR-block.                            ║
 * ║  Future renames (e.g., "Mayor (VICEROY)" → "VICEROY" at Year 4)         ║
 * ║  happen via ONE change in this file only.                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CROWN CONSTITUTION §1.2.1 Law 7 — Title Power Is Ceremonial:           ║
 * ║  No title-holder can ban, mute, kick, or DM-flood.                       ║
 * ║  Power = corruption = lawsuits = death.                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   import { TITLES } from '@/constants/titles';
 *   <Text>{TITLES.CITY}</Text>              // "Mayor (VICEROY)"
 *   <Text>{TITLES.SECTOR}</Text>            // "BARON"
 */

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — THE 4-TIER TITLE HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════

export const TITLES = Object.freeze({
  /**
   * 🌍 WORLD title — #1 globally across all CROWN users on Earth.
   * Earned by: most reactions in World scope across a 5-hour cycle.
   * Crown type: Prismatic gradient (spectrum) — multi-jewel crown.
   * Cycle: World Imperator Hour daily at 23:30 IST.
   * Bid: highest bidder wins if tie in reactions.
   */
  WORLD: 'IMPERATOR' as const,

  /**
   * 🇮🇳 COUNTRY title — #1 in a specific country.
   * Earned by: most reactions in Country scope across a 5-hour cycle.
   * Crown type: Country flag gradient — fleur-de-lis crown.
   * One per country (195 countries at global launch).
   * Open World: any user can compete for any country title.
   */
  COUNTRY: 'SOVEREIGN' as const,

  /**
   * 🏙️ CITY title — #1 in a specific city.
   * ALWAYS rendered as "Mayor (VICEROY)" — never "Mayor" alone, never "VICEROY" alone.
   * Earned by: most reactions in City scope across a 5-hour cycle.
   * Crown type: Amber Gold #F59E0B — golden bubble border on message bubbles.
   * Open World: Patna ka banda Mumbai ka Mayor (VICEROY) ban sakta hai.
   */
  CITY: 'Mayor (VICEROY)' as const,

  /**
   * 🏘️ SECTOR title — #1 in a specific sector/neighborhood.
   * Earned by: most reactions in Sector scope across a 5-hour cycle.
   * Crown type: Emerald #10B981 — emerald shield border on message bubbles.
   * Entry-level title — the first rung on the ladder.
   */
  SECTOR: 'BARON' as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — TITLE DISPLAY LABELS (for UI chips, badges, leaderboards)
// ═══════════════════════════════════════════════════════════════════════════

export const TITLE_LABELS = Object.freeze({
  /**
   * Short display label for leaderboard rows and profile chips.
   * Used when full title + scope name is too long for the space.
   */
  WORLD_SHORT:   'IMPERATOR' as const,
  COUNTRY_SHORT: 'SOVEREIGN' as const,
  CITY_SHORT:    'Mayor' as const,  // Only place "Mayor" alone is acceptable (space-constrained labels)
  SECTOR_SHORT:  'BARON' as const,

  /**
   * Prefix label for "of" constructions.
   * E.g., "Mayor (VICEROY) of Mumbai"
   * E.g., "BARON of Sector 17"
   */
  WITH_SCOPE: {
    WORLD:   (scope: string) => `${TITLES.WORLD} of ${scope}`,
    COUNTRY: (scope: string) => `${TITLES.COUNTRY} of ${scope}`,
    CITY:    (scope: string) => `${TITLES.CITY} of ${scope}`,
    SECTOR:  (scope: string) => `${TITLES.SECTOR} of ${scope}`,
  },

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — TITLE COLORS (aligned with §1.4.2 Tier-Specific Color Accents)
// ═══════════════════════════════════════════════════════════════════════════

export const TITLE_COLORS = Object.freeze({
  /**
   * 🌍 IMPERATOR — Prismatic gradient (spectrum)
   * World #1 — multi-jewel crown.
   * Applied to: message bubble border, profile badge background, crown icon.
   * Implementation: LinearGradient with spectrum colors.
   */
  WORLD: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'] as const,

  /**
   * 🇮🇳 SOVEREIGN — Country flag gradient
   * Country #1 — fleur-de-lis crown.
   * Applied dynamically based on user's competing country flag colors.
   * Fallback: saffron-white-green for India.
   */
  COUNTRY_INDIA: ['#FF9933', '#FFFFFF', '#138808'] as const,

  /**
   * 🏙️ Mayor (VICEROY) — Amber Gold
   * City #1 — golden bubble border.
   * Token: fg.brand (gold[600] / #C9A227 light, #F59E0B dark)
   */
  CITY: '#F59E0B' as const,

  /**
   * 🏘️ BARON — Emerald
   * Sector #1 — emerald shield border.
   * Token: fg.success (emerald[600] / #1A7A4A light, #34D399 dark)
   */
  SECTOR: '#10B981' as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — CYCLE TIMING (5-Hour Cycle)
// ═══════════════════════════════════════════════════════════════════════════

export const CYCLE = Object.freeze({
  /**
   * Duration of each cycle in milliseconds.
   * 5 hours = 18,000 seconds = 18,000,000ms
   */
  DURATION_MS: 18_000_000 as const,

  /**
   * Duration of Boli (auction) window that opens when cycle freezes.
   * Default: 30 minutes after cycle freeze.
   */
  BOLI_WINDOW_MS: 1_800_000 as const,

  /**
   * Daily World Imperator Hour in IST (hours).
   * Cycle freezes at 23:30 IST daily for world-scope.
   */
  WORLD_FREEZE_HOUR_IST: 23 as const,
  WORLD_FREEZE_MINUTE_IST: 30 as const,

  /**
   * Cycle label — used in earnings display.
   */
  LABEL: 'cycle' as const,
  LABEL_PLURAL: 'cycles' as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 5 — TITLE POWER LIMITS (§1.2.1 Law 7 — Ceremonial Only)
// ═══════════════════════════════════════════════════════════════════════════

export const TITLE_POWERS = Object.freeze({
  /**
   * What a title holder CAN do (exhaustive list):
   * - Pin ONE message per day (BroadcastComposer)
   * - Receive a share of cycle bid fees
   * - Display their title badge on all messages
   * - Access title-holder profile frame
   */
  CAN_PIN_MESSAGE: true as const,
  CAN_RECEIVE_BID_FEES: true as const,
  PINS_PER_DAY: 1 as const,

  /**
   * What a title holder CANNOT do (exhaustive list).
   * These are ZERO. Permanently. No exceptions.
   * §1.2.1 Law 7 · Anti-Drift Lock #7.
   */
  CAN_BAN_USER:    false as const,
  CAN_MUTE_USER:   false as const,
  CAN_KICK_USER:   false as const,
  CAN_DM_FLOOD:    false as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 6 — TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type TitleTier     = keyof typeof TITLES;
export type TitleString   = typeof TITLES[TitleTier];
export type CycleMs       = typeof CYCLE.DURATION_MS;

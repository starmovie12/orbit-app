/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Branding Constants                                              ║
 * ║  Phase 1.4 · §1.4.9 Phase C — Brand Migration: ORBIT/CROWD → CROWN      ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SINGLE SOURCE OF TRUTH for all brand strings.                           ║
 * ║  Anti-Drift Lock: using legacy brand strings anywhere in app = PR BLOCK  ║
 * ║  ESLint rule 'crown/no-legacy-brand-names' enforces this at every PR.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   import { BRAND } from '@/constants/branding';
 *   <Text>{BRAND.NAME}</Text>                    // "CROWN"
 *   <Text>{BRAND.TAGLINE_EN}</Text>              // "Your City Is Live. Walk In. Speak."
 */

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — CORE BRAND IDENTITY
// ═══════════════════════════════════════════════════════════════════════════

export const BRAND = Object.freeze({
  /**
   * App name — always uppercase, single word.
   * Used in: header wordmark, splash screen, app store, push notifications.
   * Font: Syne 800ExtraBold · size 22px · letter-spacing -0.4px · gold-600
   * NEVER abbreviate as "Cr", "Crwn", or any variant.
   */
  NAME: 'CROWN' as const,

  /**
   * Wordmark font family — Syne 800ExtraBold.
   * Must be loaded before any screen renders.
   * Package: @expo-google-fonts/syne
   */
  WORDMARK_FONT: 'Syne_800ExtraBold' as const,

  /**
   * App tagline — English.
   * Used in: onboarding splash, marketing, app store description.
   * DO NOT TRUNCATE. Display in full.
   */
  TAGLINE_EN: 'Your City Is Live. Walk In. Speak.' as const,

  /**
   * App tagline — Hindi/Hinglish.
   * Used in: onboarding splash (when language = Hindi/Hinglish),
   *          in-app banners, marketing to Indian users.
   */
  TAGLINE_HI: 'Tumhara Shahar Live Hai. Andar Aao. Bolo.' as const,

  /**
   * App scheme — for deep links and URL routing.
   * Deep link format: crown-app://path/to/screen
   * Migration: orbit-app:// → crown-app://
   */
  SCHEME: 'crown-app' as const,

  /**
   * Bundle identifier — iOS.
   * Migration: com.nooralam.orbit → com.nooralam.crown
   * Requires new App Store submission — coordinate with Day 1 launch.
   */
  BUNDLE_ID_IOS: 'com.nooralam.crown' as const,

  /**
   * Bundle identifier — Android.
   * Migration: com.nooralam.orbit → com.nooralam.crown
   * Requires new Google Play Console submission.
   */
  BUNDLE_ID_ANDROID: 'com.nooralam.crown' as const,

  /**
   * npm package name.
   * Migration: orbit-app → crown-app
   */
  PACKAGE_NAME: 'crown-app' as const,

  /**
   * Legacy brand names — for analytics migration scripts ONLY.
   * DO NOT use these strings anywhere in UI or logic.
   * This array is here so analytics pipelines can map old event names → new.
   * ESLint rule blocks any use of these strings outside this file and
   * CHANGELOG.md / docs/migration.md.
   */
  LEGACY_NAMES: ['ORBIT', 'CROWD WORLD', 'CROWD', 'orbit-app', 'crowd-world'] as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — FOUNDING RESIDENT BADGE
// The first real user in a sector gets this badge (badge-only, ZERO credits)
// ═══════════════════════════════════════════════════════════════════════════

export const BADGES = Object.freeze({
  /**
   * Founding Resident badge label.
   * Awarded to: first real user in a sector (permanent, non-transferable).
   * Reward: badge only — ZERO credits (Zero-Credit Founder Rule §1.2.1 Law 2).
   * Display: small shield icon + "Founding Resident" label in profile.
   */
  FOUNDING_RESIDENT: 'Founding Resident' as const,

  /**
   * Day 1 Founder Pass badge label.
   * Awarded to: Day 1 Founder Pass purchasers ONLY.
   * Non-purchasable by any other means. Permanent.
   */
  FOUNDER_DAY1: 'Day 1 Founder' as const,

  /**
   * AI Companion message marker.
   * Anti-Drift Lock #5: EVERY AI message, EVERY AI Companion post,
   * EVERY AI-translated string carries this label. ALWAYS.
   * Zero exceptions. Never remove. Never hide.
   */
  AI_LABEL: '🤖 AI' as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — PROMISE COPY (1-Lakh Reach Promise — Anti-Drift Lock #1)
// The marketing copy that communicates the core value prop.
// ═══════════════════════════════════════════════════════════════════════════

export const PROMISE_COPY = Object.freeze({
  /**
   * The 1-Lakh Reach Promise — displayed to new users on first message.
   * Anti-Drift Lock #1: every message reaches every active user in the room.
   * No algorithm. No follower gate. Equal voice ALWAYS.
   */
  LAKH_REACH_EN: 'Your message reaches every active user in this room. No algorithm. No follower gate.' as const,
  LAKH_REACH_HI: 'Tumhari line is room ke har active user tak jaati hai. Algorithm nahi. Followers ki zaroorat nahi.' as const,

  /**
   * Trust anchor text — shown in OnlineCountStrip (Row 3 of header).
   * Visible only on first session of the day, auto-hides after 60s or first scroll.
   */
  TRUST_ANCHOR: '📍 1.2 Lakh+' as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — PSS STAGE CONSTANTS (Platform Scaling Stages)
// Anti-Drift Lock #9: PSS Stage is the ONLY rollout vector.
// ═══════════════════════════════════════════════════════════════════════════

export const PSS = Object.freeze({
  /** Current live stage — Day 1 Chandigarh launch */
  CURRENT_STAGE: 2 as const,

  /** Stage names */
  STAGES: {
    0: 'Internal Alpha',
    1: 'Chandigarh Closed Beta',
    2: 'Chandigarh Open Launch',
    3: 'Punjab Expansion',
    4: 'India North Launch',
    5: 'India Full Launch',
    6: 'Global Launch',
  } as const,

  /** Day 1 city */
  DAY1_CITY: 'Chandigarh' as const,
  DAY1_CITY_ID: 'IN:PB:CHD' as const,

} as const);

// ═══════════════════════════════════════════════════════════════════════════
// § 5 — TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type BrandName     = typeof BRAND.NAME;
export type LegacyBrand   = typeof BRAND.LEGACY_NAMES[number];
export type BadgeKey      = keyof typeof BADGES;
export type PssStage      = typeof PSS.CURRENT_STAGE;

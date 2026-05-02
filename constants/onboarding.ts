/**
 * CROWD WORLD — Onboarding Constants
 *
 * Single source of truth for the 5-step signup funnel.
 * Blueprint: Part 3 §3 (Splash) · §4 (Phone) · §5 (OTP)
 *                               · §6 (Profile) · §7 (Location) · §8 (Welcome Burst)
 *
 * Scope: avatar palette + typed step metadata + analytics events.
 * Out of scope (intentional): language lists, interest chips, username rules.
 *   → Those belong in constants/data.ts (profile-edit features, NOT onboarding funnel).
 *   → Blueprint §6 is strictly "Display Name + Profile Photo Setup" — no feature bloat.
 *
 * Color rule: ALL colors come from the Premium Token System (Part 3 §2).
 *   NO raw hex outside this file. NO neon / Material-Design colors.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR PALETTE  (Premium Token System · Part 3 §2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 8-color palette for generated initials avatars.
 *
 * Every color is sourced directly from the Premium Token System — Champagne Gold,
 * Forest Emerald, Crimson Rose, Burnished Amber, and their darker press-state
 * variants. NO neon, NO Material-Design primaries.
 *
 * Usage: hash displayName → stable index → pick color. Renders as circle bg
 * behind 1–2 character initials in white/warm-ink.
 */
export const AVATAR_COLORS: ReadonlyArray<string> = [
  '#C9A227', // gold[600]    Champagne Gold       — primary brand
  '#1A7A4A', // emerald[600] Forest Emerald       — success / trust
  '#C4294F', // crimson[600] Crimson Rose         — energy / bold
  '#D4651A', // amber[600]   Burnished Amber      — warmth / celebration
  '#6B5B47', // ink[600]     Espresso Brown       — grounded / neutral
  '#A88A24', // gold[700]    Pressed Champagne    — depth variant
  '#047857', // emerald[700] Deep Forest          — depth variant
  '#8B5A18', // amber[800]   Deep Burnished       — depth variant
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING STEP TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** 1-indexed step position in the funnel  (1 = Phone Entry → 5 = Welcome Burst). */
export type OnboardingStepIndex = 1 | 2 | 3 | 4 | 5;

/**
 * Analytics conversion events fired on successful step completion.
 * Source: Blueprint Part 3 §14 Analytics Gates.
 *
 * `user_onboarded` = KEY acquisition metric.
 * Carries: { city_id, sector_id, total_funnel_time_seconds, used_gps: boolean }
 */
export type OnboardingCompletionEvent =
  | 'phone_entry_to_otp_conversion'
  | 'otp_to_profile_setup_conversion'
  | 'profile_to_location_conversion'
  | 'location_to_complete_conversion'
  | 'user_onboarded';

export interface OnboardingStep {
  /** 1-indexed position in the 5-step funnel. */
  readonly index: OnboardingStepIndex;
  /**
   * Expo Router path for this screen.
   * Steps 1-2 use the (auth) group   (unauthenticated · no JWT yet).
   * Steps 3-5 use the (onboarding) group  (short-lived JWT → full session at step 5).
   */
  readonly route: string;
  /**
   * Fractional progress for animated bars  (step / 5).
   * Values: 0.2 · 0.4 · 0.6 · 0.8 · 1.0
   */
  readonly progress: number;
  /**
   * Hinglish step headline — verbatim from Blueprint §4-§8 HEADLINE copy.
   *
   * Runtime interpolation required on these steps:
   *   Step 2 subtitle: replace {phone}  with masked number "+91 98XXX XX210"
   *   Step 5 title:    replace {name}   with user displayName
   *   Step 5 subtitle: replace {sector} and {city} with chosen values
   */
  readonly title: string;
  /** Hinglish subhead — verbatim from Blueprint §4-§8 SUBHEAD copy. */
  readonly subtitle: string;
  /** English alternate title (i18n fallback). */
  readonly titleEn: string;
  /** English alternate subtitle (i18n fallback). */
  readonly subtitleEn: string;
  /**
   * Step indicator accessibility label — Blueprint §4-§8 [1.C] STEP INDICATOR.
   * Rendered as: "Step N of 5"
   */
  readonly stepLabel: string;
  /**
   * Analytics event fired when user successfully completes this step and
   * navigates forward. Fire ONCE per step, after server confirms success.
   */
  readonly completionEvent: OnboardingCompletionEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING_STEPS  (Blueprint Part 3 §4-§8 · 5 steps · 60-90 s target)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical ordered array of all 5 funnel steps.
 *
 * @example Screen usage
 *   const step = ONBOARDING_STEPS[0];          // Phone Entry
 *   step.stepLabel   // "Step 1 of 5"  → accessibility label
 *   step.progress    // 0.2            → progress bar width
 *   step.completionEvent               → fire to analytics on Continue tap
 *
 * @example Analytics usage
 *   analytics.track(ONBOARDING_STEP_MAP[currentIndex].completionEvent, payload);
 */
export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [

  // ── §4 — Phone Number Entry ────────────────────────────────────────────────
  {
    index: 1,
    route: '/(auth)/phone',
    progress: 0.2,
    title: 'Apna phone number daalo',
    subtitle: 'OTP bhejenge verify karne ke liye',
    titleEn: 'Enter your phone number',
    subtitleEn: "We'll send an OTP to verify",
    stepLabel: 'Step 1 of 5',
    completionEvent: 'phone_entry_to_otp_conversion',
  },

  // ── §5 — OTP Verification ─────────────────────────────────────────────────
  // subtitle: screen replaces {phone} with masked number at render time.
  {
    index: 2,
    route: '/(auth)/otp',
    progress: 0.4,
    title: 'Verify karo',
    subtitle: '{phone} par OTP bheji hai',
    titleEn: 'Verify',
    subtitleEn: 'OTP sent to {phone}',
    stepLabel: 'Step 2 of 5',
    completionEvent: 'otp_to_profile_setup_conversion',
  },

  // ── §6 — Profile Setup (Display Name + Photo ONLY · Blueprint is explicit) ─
  {
    index: 3,
    route: '/(onboarding)/profile',
    progress: 0.6,
    title: 'Apne baare mein batao',
    subtitle: 'Aapka sector aapko jaane is naam se',
    titleEn: 'Tell us about yourself',
    subtitleEn: 'Your sector will know you by this name',
    stepLabel: 'Step 3 of 5',
    completionEvent: 'profile_to_location_conversion',
  },

  // ── §7 — Location & Sector Setup ──────────────────────────────────────────
  {
    index: 4,
    route: '/(onboarding)/location',
    progress: 0.8,
    title: 'Apna sector chuno',
    subtitle: 'Yahin se tum apne neighbours se baat karoge',
    titleEn: 'Choose your sector',
    subtitleEn: "This is where you'll connect with your neighbours",
    stepLabel: 'Step 4 of 5',
    completionEvent: 'location_to_complete_conversion',
  },

  // ── §8 — Welcome Burst ────────────────────────────────────────────────────
  // title:    screen replaces {name} with displayName.
  // subtitle: screen replaces {sector} and {city} with selected values.
  {
    index: 5,
    route: '/(onboarding)/complete',
    progress: 1.0,
    title: 'Swagat, {name}!',
    subtitle: 'Tum ab {sector}, {city} ka hissa ho',
    titleEn: 'Welcome, {name}!',
    subtitleEn: "You're now part of {sector}, {city}",
    stepLabel: 'Step 5 of 5',
    completionEvent: 'user_onboarded',
  },

] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Total steps — avoids the magic number 5 anywhere in the codebase. */
export const ONBOARDING_TOTAL_STEPS: 5 = 5;

/**
 * O(1) step lookup by 1-based index.
 * @example  ONBOARDING_STEP_MAP[3].completionEvent  // 'profile_to_location_conversion'
 */
export const ONBOARDING_STEP_MAP: Readonly<
  Record<OnboardingStepIndex, OnboardingStep>
> = Object.fromEntries(
  ONBOARDING_STEPS.map((s) => [s.index, s]),
) as Record<OnboardingStepIndex, OnboardingStep>;

/**
 * O(1) step lookup by Expo Router route path.
 * Useful in layout files and the RouteGuard to resolve current step metadata.
 * @example  ONBOARDING_STEP_BY_ROUTE['/(auth)/otp']  // step 2
 */
export const ONBOARDING_STEP_BY_ROUTE: Readonly<
  Record<string, OnboardingStep>
> = Object.fromEntries(ONBOARDING_STEPS.map((s) => [s.route, s]));

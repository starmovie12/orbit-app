/**
 * CROWD WORLD — Animation Tokens, Configs & Hooks  v2.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all motion values. NO hardcoded durations,
 * easings, or spring params outside this file.
 *
 * Architecture constraints honoured here:
 *   LAW 13  → Glass Island hide/show uses springBouncy (tension:180·friction:12,
 *             per §5.N token) + reduced-motion fallback via glassIslandFadeConfig.
 *             NOTE: The G.2.2 Reanimated worklet (useGlassIslandHide.ts) uses
 *             { stiffness:180, damping:20 } directly — as specified in the natural-
 *             language scroll-behavior spec (§ Screen [8] lines 857/1177).
 *             The §5.N design token (this config) uses tension:180, friction:12.
 *             • Animated.spring callers   → use springBouncy from this file
 *             • Reanimated withSpring     → use { stiffness:180, damping:20 } directly
 *   Rule 04 → Input area never animates independently of Glass Island.
 *
 * Motion philosophy:
 *   • easeOut for ALL enters / expands / reveals (fast exit from origin)
 *   • spring/bounce ONLY on content delight moments — NEVER on UI chrome
 *     (Glass Island, headers, navigation elements)
 *   • Every animated component must check useReducedMotion() and fall back
 *     to opacity-only per blueprint Reduced Motion Variants table
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { durations, easings, springSnap, fadeConfig }             from '@/constants/animations';
 *   import { useReducedMotion, reducedMotionConfig, useButtonPress }  from '@/constants/animations';
 *   import { getEffectiveDuration, LAW13_GLASS_ISLAND_HIDE_OFFSET }  from '@/constants/animations';
 */

import { useRef, useState, useEffect } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DURATIONS (ms)
//
// Canonical scale — use `durations` in all new code.
// Blueprint refs: § 5.N animation.duration · § A.1.6 motion.duration
//
//   instant  : 100  — card press, skeleton appear, snap feedback
//   fast     : 160  — tab switch, button release, Glass Island tab active
//   normal   : 240  — modal open, toast appear, opacity fade, page enter
//   slow     : 360  — sheet dismiss, page exit, long transitions
//   spring   : 480  — badge earn, multi-step delight sequences (≈ §5.N badgeEarn:500)
//   ripple   : 600  — golden glow / mayor crown ripple expand
//   spin     : 800  — pull-to-refresh full rotation cycle
//   countUp  : 1500 — balance / stat count-up reveal
//   toast    : 4000 — toast auto-dismiss hold duration
//
// ⚠️  Legacy `Duration` object preserved below for backward compat.
//     New code uses `durations`. Do NOT add keys to `Duration`.
// ─────────────────────────────────────────────────────────────────────────────

export const durations = {
  /** 100ms — card press, skeleton appear, instant snap feedback */
  instant:  100,
  /** 160ms — tab switch, button release, Glass Island tab active scale */
  fast:     160,
  /** 240ms — modal open, toast appear, opacity fade, standard page enter */
  normal:   240,
  /** 360ms — sheet dismiss, page exit, slower content reveals */
  slow:     360,
  /** 480ms — badge earn, mayor crown, multi-step delight sequences */
  spring:   480,
  /** 600ms — golden glow / mayor crown ripple expand · §5.N ripple:600 */
  ripple:   600,
  /** 800ms — pull-to-refresh full rotation cycle · §5.N pullToRefresh:400ms per half */
  spin:     800,
  /** 1500ms — balance / stat count-up reveal · §5.N countUp:1500 */
  countUp:  1500,
  /** 4000ms — toast auto-dismiss hold duration · §5.N toastHold:4000 */
  toast:    4000,
} as const;

export type DurationsKey   = keyof typeof durations;
export type DurationsValue = (typeof durations)[DurationsKey];

/** Typed interface for the canonical duration scale */
export interface DurationScale {
  readonly instant:  100;
  readonly fast:     160;
  readonly normal:   240;
  readonly slow:     360;
  readonly spring:   480;
  readonly ripple:   600;
  readonly spin:     800;
  readonly countUp:  1500;
  readonly toast:    4000;
}

// ── Legacy Duration (backward compat — do NOT reference in new code) ─────────

/**
 * @deprecated Use `durations` instead.
 *
 * Key differences vs canonical `durations`:
 *   micro : 80   → §5.N buttonPress:80 (closest: durations.instant=100 for cards)
 *   fast  : 120  → durations.fast = 160  (intentionally different —
 *                  changing would break useTabFade / usePageTransition hooks)
 *   base  : 180  → no canonical equiv (between fast:160 and normal:240)
 *   sheet : 240  → identical to durations.normal
 *   page  : 320  → §5.N sheetOpen:320 / screenTransition:300
 */
export const Duration = {
  /** 80ms  — button press scale-down (§5.N buttonPress:80) */
  micro:  80,
  /**
   * 120ms — legacy tab fade-out.
   * Note: canonical fast = 160ms (durations.fast). Kept as-is to avoid
   * breaking existing useTabFade / usePageTransition hooks.
   */
  fast:   120,
  /** 180ms — micro-interactions, tab fade-in */
  base:   180,
  /** 240ms — bottom sheets, page transitions (≡ durations.normal) */
  sheet:  240,
  /** 320ms — full-page enter / exit (§5.N sheetOpen:320) */
  page:   320,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. EASING PRESETS
//
// All values are (t: number) => number functions from React Native Easing.
// Blueprint refs: § 5.N easing table · § A.1.6 motion.easing
//
// ┌──────────────┬──────────────────────────────────────────────────────────┐
// │ easeOut      │ cubic-bezier(0.0,0.0,0.2,1.0)   Primary enter/expand    │
// │ easeIn       │ cubic-bezier(0.4,0.0,1.0,1.0)   Exit / dismiss          │
// │ easeInOut    │ cubic-bezier(0.4,0.0,0.2,1.0)   Cross-screen moves      │
// │ spring       │ Easing.out(Easing.back(1.7))     Content overshoot       │
// │ bounce       │ Easing.out(Easing.bounce)        Delight moments only    │
// └──────────────┴──────────────────────────────────────────────────────────┘
//
// ⚠️  `spring` and `bounce` MUST NEVER be used on UI chrome:
//     Glass Island, header rows, input area, navigation tabs.
//     Chrome motion is always easeOut. Violations break LAW 13 trust.
// ─────────────────────────────────────────────────────────────────────────────

export const easings = {
  /**
   * easeOut — cubic-bezier(0.0, 0.0, 0.2, 1.0)
   * Fast exit from origin, smooth deceleration into resting position.
   * Use for ALL enter / reveal / expand motions across the app.
   * Blueprint §5.N: `easeOut: [0.0, 0.0, 0.2, 1.0]`
   */
  easeOut: Easing.bezier(0.0, 0.0, 0.2, 1.0),

  /**
   * easeIn — cubic-bezier(0.4, 0.0, 1.0, 1.0)
   * Fast acceleration into exit. Use for dismiss / slide-down motions.
   * Blueprint §5.N: `easeIn: [0.4, 0.0, 1.0, 1.0]`
   *
   * Used by: slideDownConfig (sheet dismiss), Interaction [12] chip exit (180ms easeIn).
   */
  easeIn: Easing.bezier(0.4, 0.0, 1.0, 1.0),

  /**
   * easeInOut — cubic-bezier(0.4, 0.0, 0.2, 1.0)
   * Smooth acceleration and deceleration. Use for elements that
   * move from one position to another (not enters or exits).
   * Blueprint §5.N: `easeInOut: [0.4, 0.0, 0.2, 1.0]`
   */
  easeInOut: Easing.bezier(0.4, 0.0, 0.2, 1.0),

  /**
   * spring — Easing.out(Easing.back(1.7))
   * Gentle cubic overshoot → settles with premium feel.
   * Use for content elements: cards entering, chips snapping in,
   * message bubbles, pill selections (Interaction [1]).
   *
   * ⚠️  NOT for UI chrome. For physics-based spring, use springConfigs +
   *     Animated.spring() — this easing is for Animated.timing() only.
   */
  spring: Easing.out(Easing.back(1.7)),

  /**
   * bounce — Easing.out(Easing.bounce)
   * Physical multi-bounce at end of motion. High-delight only:
   * Spark Gift heart burst (Interaction [9]), Mayor crown (Interaction [11]),
   * Heat Score threshold cross (Interaction [6]).
   *
   * ⚠️  ALWAYS check useReducedMotion() before using — reduced motion
   *     users must get opacity-only fallback (no scale, no translate).
   * ⚠️  NOT for UI chrome.
   */
  bounce: Easing.out(Easing.bounce),
} as const;

export type EasingsKey = keyof typeof easings;

/** Typed interface for easing presets */
export interface EasingPresets {
  readonly easeOut:   (t: number) => number;
  readonly easeIn:    (t: number) => number;
  readonly easeInOut: (t: number) => number;
  readonly spring:    (t: number) => number;
  readonly bounce:    (t: number) => number;
}

/**
 * Standalone backward-compat export.
 * @deprecated Prefer `easings.easeOut`. Kept for existing hooks below.
 *
 * Note: original file used bezier(0.16, 1, 0.3, 1). Preserved here so
 * existing hooks behave identically. New code uses easings.easeOut which is
 * the blueprint-canonical bezier(0.0, 0.0, 0.2, 1.0).
 */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// ─────────────────────────────────────────────────────────────────────────────
// 3. SPRING CONFIGS  (Animated.spring)
//
// Uses the tension/friction API (Animated.spring "old API") for React Native's
// built-in Animated library. Reanimated worklets in hooks/*.ts use
// stiffness/damping directly with withSpring() — equivalent values noted.
//
// Tension/friction → physical feel:
//   Higher tension  = faster / snappier spring
//   Higher friction = more damped (less oscillation)
//   Lower friction  = more wobble / bounce
//
// Blueprint refs: § 5.N animation.easing · § G.2 Reanimated worklets
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of an Animated.spring config (toValue supplied at call site) */
export interface SpringConfig {
  readonly useNativeDriver: true;
  readonly tension:         number;
  readonly friction:        number;
}

export const springConfigs = {
  /**
   * springSnap — task spec anchor config. Medium snap, subtle settle.
   * tension:80 · friction:8
   * Use for: Glass Island tab active scale, chip selection, card press release.
   * Blueprint §5.N Reanimated equiv: { stiffness:80, damping:8 }
   */
  springSnap: {
    useNativeDriver: true,
    tension:         80,
    friction:        8,
  },

  /**
   * springStiff — fast, crisp, minimal overshoot.
   * tension:200 · friction:18
   * Use for: button release (onPressOut), send button pop, pill release.
   * Blueprint §5.N: springStiff { stiffness:200, damping:18 }
   * Matches Interaction [1] pill release + Interaction [8] send button release.
   */
  springStiff: {
    useNativeDriver: true,
    tension:         200,
    friction:        18,
  },

  /**
   * springGentle — slow settle, no perceptible bounce.
   * tension:100 · friction:15
   * Use for: idle→active icon scale (0.9→1.0), presence dot appear,
   *          Interaction [7] send button activation scale.
   * Blueprint §5.N: springGentle { stiffness:100, damping:15 }
   */
  springGentle: {
    useNativeDriver: true,
    tension:         100,
    friction:        15,
  },

  /**
   * springBouncy — Glass Island hide/show spring (LAW 13) for Animated.spring.
   * tension:180 · friction:12
   * Blueprint §5.N token: springBouncy { stiffness:180, damping:12 }
   *
   * ⚠️  DUAL-VALUE NOTICE (LAW 13 / G.2.2):
   *     Natural-language scroll spec (§ Screen [8] lines 857/1177) says
   *     "spring stiffness 180 · damping 20 · 280ms perceived".
   *     G.2.2 Reanimated worklet (useGlassIslandHide.ts) uses damping:20.
   *     §5.N design token (this config) uses damping:12.
   *     • Animated.spring callers   → this config (tension:180, friction:12)
   *     • Reanimated withSpring     → { stiffness:180, damping:20 } in worklet
   *
   * Use for: Glass Island translateY enter/exit, new-message chip slide.
   *
   * Canonical Animated.spring usage for LAW 13:
   *   Animated.spring(translateY, {
   *     toValue: LAW13_GLASS_ISLAND_HIDE_OFFSET,
   *     ...springConfigs.springBouncy,
   *   }).start();
   */
  springBouncy: {
    useNativeDriver: true,
    tension:         180,
    friction:        12,
  },

  /**
   * springWobbly — loose, visible wobble. Highest delight level.
   * tension:80 · friction:8
   * Use for: bottom sheet open (Interaction [10] · 320ms spring wobbly),
   *          reaction heart, Mayor crown arrival (Interaction [11]).
   * Blueprint §5.N: springWobbly { stiffness:80, damping:8 }
   *
   * ✅ friction:8 — matches §5.N damping:8 exactly.
   * ⚠️  Always provide reduced-motion fallback (opacity fade only).
   */
  springWobbly: {
    useNativeDriver: true,
    tension:         80,
    friction:        8,   // §5.N damping:8 — NOT 6
  },
} as const satisfies Record<string, SpringConfig>;

export type SpringConfigKey = keyof typeof springConfigs;

/**
 * Top-level named export per task spec.
 * Identical to springConfigs.springSnap — alias for direct destructuring.
 *
 * Usage:
 *   Animated.spring(scale, { toValue: 1, ...springSnap }).start();
 */
export const springSnap = springConfigs.springSnap;

// ─────────────────────────────────────────────────────────────────────────────
// 4. TIMING CONFIGS  (Animated.timing partials)
//
// Reusable config objects WITHOUT `toValue` — supply it at call site.
// Pattern: Animated.timing(animValue, { toValue: X, ...fadeConfig }).start()
//
// useNativeDriver: true — we animate only transform/opacity,
// never layout properties (width, height, padding, margin).
// ─────────────────────────────────────────────────────────────────────────────

/** Partial Animated.timing config — toValue supplied at call site */
export interface TimingConfig {
  readonly duration:        number;
  readonly easing:          (t: number) => number;
  readonly useNativeDriver: true;
}

/**
 * fadeConfig — standard opacity fade in / fade out.
 * duration: normal (240ms) · easeOut
 * Blueprint §5.N: modalOpen:240 · toastAppear:240
 *
 * Usage:
 *   Animated.timing(opacity, { toValue: 1, ...fadeConfig }).start();  // fade in
 *   Animated.timing(opacity, { toValue: 0, ...fadeConfig }).start();  // fade out
 */
export const fadeConfig: TimingConfig = {
  duration:        durations.normal,   // 240ms
  easing:          easings.easeOut,
  useNativeDriver: true,
};

/**
 * slideUpConfig — bottom sheet / modal enter (slide up from below).
 * duration: slow (360ms) · easeOut
 * Blueprint §5.N: sheetOpen:320ms. Rounded to slow:360ms for premium feel.
 *
 * Usage:
 *   translateY.setValue(sheetHeight);   // position below screen
 *   Animated.timing(translateY, { toValue: 0, ...slideUpConfig }).start();
 *
 * Reduced motion: replace entirely with fadeConfig (opacity only, no translate).
 */
export const slideUpConfig: TimingConfig = {
  duration:        durations.slow,     // 360ms
  easing:          easings.easeOut,
  useNativeDriver: true,
};

/**
 * slideDownConfig — bottom sheet / modal dismiss (exit is faster than enter).
 * duration: normal (240ms) · easeIn
 * Blueprint §5.N: sheetClose:250ms ≈ normal:240ms · easeIn:[0.4,0.0,1.0,1.0]
 *
 * Uses easings.easeIn — fast acceleration into exit, no lingering.
 *
 * Usage:
 *   Animated.timing(translateY, { toValue: sheetHeight, ...slideDownConfig })
 *     .start(() => onDismiss());
 */
export const slideDownConfig: TimingConfig = {
  duration:        durations.normal,   // 240ms
  easing:          easings.easeIn,
  useNativeDriver: true,
};

/**
 * glassIslandFadeConfig — reduced-motion fallback for LAW 13 hide/show.
 * duration: fast (160ms) · easeOut · opacity only (no translate).
 *
 * Blueprint Reduced Motion Variants table:
 *   "Glass Island hide : Opacity fade out (no translate)" [reduced motion]
 *
 * Usage (only when useReducedMotion() returns true):
 *   Animated.timing(opacity, { toValue: 0, ...glassIslandFadeConfig }).start();
 *   Animated.timing(opacity, { toValue: 1, ...glassIslandFadeConfig }).start();
 */
export const glassIslandFadeConfig: TimingConfig = {
  duration:        durations.fast,     // 160ms — quick opacity swap
  easing:          easings.easeOut,
  useNativeDriver: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. REDUCED MOTION
//
// 5a. reducedMotionConfig    — canonical behaviour constants (blueprint § A.1.6)
// 5b. useReducedMotion()     — hook that reads system accessibility setting
// 5c. getEffectiveDuration() — helper to scale any duration safely
//
// Every animated component MUST call useReducedMotion() and provide a
// fallback as specified in the blueprint Reduced Motion Variants table:
//
//   Pill press scale          → opacity 1.0 → 0.7 → 1.0 (no scale)
//   Own message slide-in      → opacity fade only (no translate)
//   Other user slide-in       → opacity fade only
//   Online count pulse dot    → static dot (no opacity cycle)
//   Heat Score threshold      → color flash only (no scale)
//   Send button activation    → color + opacity only (no scale)
//   Send button press         → opacity only (no scale, no glow)
//   Spark Gift heart burst    → static heart fade (no scale)
//   Long-press bubble scale   → opacity 1.0 → 0.8 → 1.0
//   Bottom sheet slide-up     → opacity fade-in (no translate)
//   Mayor crown arrival       → crown static · ripple omitted · border applied
//   New messages chip slide   → opacity fade only
//   Glass Island hide         → opacity fade (glassIslandFadeConfig)
//   Skeleton shimmer          → static skeleton (no shimmer loop)
//   Confetti / celebration    → omitted entirely
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reduced-motion behaviour constants per blueprint § A.1.6 motion.reduced.
 *
 * Usage:
 *   const reducedMotion = useReducedMotion();
 *   const effectiveDuration = getEffectiveDuration(durations.normal, reducedMotion);
 *   // → 120ms when reducedMotion=true, 240ms when false
 */
export const reducedMotionConfig = {
  /**
   * Multiply all animation durations by this factor when reduced motion is on.
   * Blueprint § A.1.6: `duration_factor: 0.5`
   */
  durationFactor:   0.5,
  /**
   * When true, all scale and translate animations must be replaced with
   * opacity-only transitions. Blueprint § A.1.6: `use_opacity_only: true`
   */
  useOpacityOnly:   true,
  /**
   * When true, skip confetti, Lottie celebrations, ripples, and golden bursts.
   * Blueprint § A.1.6: `skip_celebrations: true`
   */
  skipCelebrations: true,
} as const;

export type ReducedMotionConfig = typeof reducedMotionConfig;

/**
 * Returns true when the user has enabled "Reduce Motion" in system settings.
 * Re-renders automatically when the setting changes at runtime (no restart needed).
 *
 * Blueprint detection:
 *   iOS    : UIAccessibility.isReduceMotionEnabled
 *   Android: Settings.Global.TRANSITION_ANIMATION_SCALE (via AccessibilityInfo)
 *   Fallback: AccessibilityInfo.isReduceMotionEnabled() from React Native
 *
 * Usage:
 *   const reducedMotion = useReducedMotion();
 *   if (reducedMotion) {
 *     // opacity-only fallback — blueprint Reduced Motion Variants table
 *     Animated.timing(opacity, { toValue: 1, ...fadeConfig }).start();
 *   } else {
 *     // full spring / slide animation
 *   }
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Read current value on mount
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);

    // Subscribe to live changes — user can toggle without restarting app
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => subscription.remove();
  }, []);

  return reducedMotion;
}

/**
 * Returns the correct animation duration accounting for the user's
 * reduced-motion preference.
 *
 * Eliminates manual `baseDuration * 0.5` math scattered across components.
 * Blueprint § A.1.6: `duration_factor: 0.5`
 *
 * Usage:
 *   const reducedMotion = useReducedMotion();
 *   Animated.timing(opacity, {
 *     toValue:         1,
 *     duration:        getEffectiveDuration(durations.normal, reducedMotion),
 *     easing:          easings.easeOut,
 *     useNativeDriver: true,
 *   }).start();
 *
 * @param baseDuration - The full-motion duration from `durations.*`
 * @param isReducedMotion - Value from useReducedMotion()
 * @returns Scaled duration in milliseconds (integer, Math.round applied)
 */
export function getEffectiveDuration(
  baseDuration: number,
  isReducedMotion: boolean,
): number {
  return isReducedMotion
    ? Math.round(baseDuration * reducedMotionConfig.durationFactor)
    : baseDuration;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. LAW 13 — GLASS ISLAND GEOMETRY TOKEN
//
// LAW 13: Glass Island hides on scroll-up by translating off the bottom edge.
// The exact translateY toValue must account for:
//   • Glass Island height  : 56px  (§ 5.N glassIsland.height)
//   • Bottom safe padding  : 16px  (§ 5.N spacing.safeBottom.base)
//   • Dynamic inset        : insets.bottom  (useSafeAreaInsets — varies per device)
//
// WHY A TOKEN:
//   Without this, every caller independently calculates 56 + 16 + insets.bottom,
//   creating drift risk if the Glass Island height ever changes.
//   With this constant, only one number changes everywhere.
//
// USAGE with Reanimated (preferred — G.2.2 worklet in useGlassIslandHide.ts):
//   const insets = useSafeAreaInsets();
//   const hideOffset = LAW13_GLASS_ISLAND_HIDE_OFFSET + insets.bottom;
//   translateY.value = withSpring(hideOffset, { stiffness:180, damping:20 });
//
// USAGE with Animated.spring (LAW 13 Animated.spring callers):
//   const insets = useSafeAreaInsets();
//   const hideOffset = LAW13_GLASS_ISLAND_HIDE_OFFSET + insets.bottom;
//   Animated.spring(translateY, {
//     toValue: hideOffset,
//     ...springConfigs.springBouncy,
//   }).start();
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Static portion of the Glass Island hide translateY offset (px).
 * Add `insets.bottom` from useSafeAreaInsets() at call site.
 *
 * Breakdown:
 *   56px = Glass Island bar height  (§ 5.N glassIsland.height)
 *   16px = bottom safe padding      (§ 5.N spacing.safeBottom.base)
 *   ──────────────────────────────
 *   72px = LAW13_GLASS_ISLAND_HIDE_OFFSET
 *
 * Full offset = LAW13_GLASS_ISLAND_HIDE_OFFSET + insets.bottom
 *
 * Blueprint ref: § Screen [8] · LAW 13 scroll-hide behavior.
 */
export const LAW13_GLASS_ISLAND_HIDE_OFFSET = 72 as const;

// ─────────────────────────────────────────────────────────────────────────────
// 7. ANIMATION HOOKS
//
// ⚠️  All Animated.Value instances are created ONCE via useRef.current.
//     Without useRef, a new Animated.Value is created on every re-render,
//     which silently resets the animation to its initial value mid-flight
//     and causes subtle bugs (values jump, springs restart, loops break).
//
//     Correct pattern inside every hook:
//       const value = useRef(new Animated.Value(initial)).current;
//
//     All hook signatures are backward-compatible — no external API changes.
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Button Press ───────────────────────────────────────────────────────────
   Generic button tactile press. Covers most non-pill, non-send buttons.
   Press  : scale 1.0 → 0.97 in Duration.micro (80ms) · easeOut
   Release: scale 0.97 → 1.0 via springStiff (tension:200 · friction:18)

   Blueprint scale targets per component type:
     Interaction [1] Pill press   : scale to 0.95
     Interaction [8] Send press   : scale to 0.92
     This hook (generic button)   : scale to 0.97 — softer, more conservative

   Usage:
     const { scale, handlers } = useButtonPress();
     <Animated.View style={{ transform: [{ scale }] }} {...handlers}>
─────────────────────────────────────────────────────────────────────────────── */
export function useButtonPress() {
  // ✅ useRef — Animated.Value created once, survives re-renders
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(scale, {
      toValue:         0.97,
      duration:        Duration.micro,   // 80ms — §5.N buttonPress:80
      easing:          easeOut,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    // springStiff — crisp confident release per §5.N stiffness:200 · damping:18
    Animated.spring(scale, {
      toValue: 1,
      ...springConfigs.springStiff,
    }).start();
  };

  return { scale, handlers: { onPressIn, onPressOut } };
}

/* ─── Page Transition ────────────────────────────────────────────────────────
   Fade + 8px slide-up on mount. Exit is faster than enter.
   Blueprint §5.N: modalOpen:240ms · easeOut.

   Usage:
     const { opacity, translateY, enter, exit } = usePageTransition();
     useEffect(() => { enter(); }, []);
     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
       {children}
     </Animated.View>
─────────────────────────────────────────────────────────────────────────────── */
export function usePageTransition() {
  // ✅ useRef — values survive re-renders, animations don't reset
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  const enter = () =>
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, ...fadeConfig }),
      Animated.timing(translateY, { toValue: 0, ...slideUpConfig }),
    ]).start();

  const exit = (callback?: () => void) =>
    Animated.parallel([
      Animated.timing(opacity,    {
        toValue:         0,
        duration:        durations.fast,   // 160ms — faster exit
        easing:          easings.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue:         8,
        duration:        durations.fast,
        easing:          easings.easeOut,
        useNativeDriver: true,
      }),
    ]).start(callback);

  return { opacity, translateY, enter, exit };
}

/* ─── Tab Switch Fade ────────────────────────────────────────────────────────
   Content fades out then back in. No horizontal slide per blueprint.
   Blueprint: tabSwitch:160ms · easeOut.

   Legacy timing intentionally preserved:
     Fade-out: Duration.fast (120ms) — original value, changing breaks compat.
     Fade-in : Duration.base (180ms) — original value, changing breaks compat.

   Usage:
     const tabFade = useTabFade();
     tabFade.switch(() => setActiveTab(newTab));
     <Animated.View style={{ opacity: tabFade.opacity }}>
─────────────────────────────────────────────────────────────────────────────── */
export function useTabFade() {
  // ✅ useRef — opacity value persists across re-renders
  const opacity = useRef(new Animated.Value(1)).current;

  const switchTab = (onMidpoint: () => void) => {
    Animated.timing(opacity, {
      toValue:         0,
      duration:        Duration.fast,    // 120ms legacy — kept intentionally
      easing:          easeOut,
      useNativeDriver: true,
    }).start(() => {
      onMidpoint();
      Animated.timing(opacity, {
        toValue:         1,
        duration:        Duration.base,  // 180ms legacy — kept intentionally
        easing:          easeOut,
        useNativeDriver: true,
      }).start();
    });
  };

  return { opacity, switch: switchTab };
}

/* ─── Skeleton Shimmer ───────────────────────────────────────────────────────
   Looping opacity pulse. Blueprint §5.N: skeleton:1200ms per cycle.
   Blueprint Reduced Motion: static skeleton — no shimmer loop.

   ⚠️  MUST be guarded by useReducedMotion() at the call site:
         const reducedMotion  = useReducedMotion();
         const shimmerOpacity = reducedMotion
           ? useRef(new Animated.Value(0.5)).current  // static
           : useSkeletonShimmer();                     // animated loop

   The loop is started inside useEffect and correctly cleaned up on unmount.

   Usage:
     const shimmerOpacity = useSkeletonShimmer();
     <Animated.View style={[styles.skeleton, { opacity: shimmerOpacity }]} />
─────────────────────────────────────────────────────────────────────────────── */
export function useSkeletonShimmer(): Animated.Value {
  // ✅ useRef — value persists; loop is NOT restarted on re-render
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue:         0.7,
          duration:        700,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue:         0.4,
          duration:        700,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // ✅ Cleanup on unmount — prevents memory leak and orphaned animations
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

/* ─── Pull-to-Refresh Rotation ───────────────────────────────────────────────
   RefreshCw icon rotates with pull progress. No rubber-band overshoot.
   Blueprint §5.N: pullToRefresh:400ms per half-cycle = 800ms full cycle.

   Usage:
     const { rotation, setProgress, animateSpin, stopSpin } = usePullRotation();
     // On scroll event: setProgress(pullDistance / maxPullDistance)
     <Animated.View style={{ transform: [{ rotate: rotation }] }}>
       <RefreshIcon />
     </Animated.View>
─────────────────────────────────────────────────────────────────────────────── */
export function usePullRotation() {
  // ✅ useRef — progress value survives re-renders
  const progress = useRef(new Animated.Value(0)).current;

  const rotation = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'clamp',
  });

  const setProgress = (value: number) => {
    progress.setValue(Math.min(1, Math.max(0, value)));
  };

  const animateSpin = () => {
    progress.setValue(0);
    Animated.loop(
      Animated.timing(progress, {
        toValue:         1,
        duration:        durations.spin,   // ✅ 800ms — was hardcoded, now token
        easing:          Easing.linear,
        useNativeDriver: true,
      }),
      { iterations: -1 },
    ).start();
  };

  const stopSpin = () => {
    progress.stopAnimation();
    progress.setValue(0);
  };

  return { rotation, setProgress, animateSpin, stopSpin };
}

/* ─── Toast Slide-Up ─────────────────────────────────────────────────────────
   Slides up from below with opacity. Auto-dismiss at durations.toast (4s).
   Blueprint §5.N: toastAppear:240ms · toastDisappear:200ms · toastHold:4000ms.

   Usage:
     const { translateY, opacity, show, hide } = useToastAnimation();
     show(() => setVisible(false));   // callback fires after auto-dismiss
     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
       <Toast message="..." />
     </Animated.View>
─────────────────────────────────────────────────────────────────────────────── */
export function useToastAnimation() {
  // ✅ useRef — values survive re-renders, show/hide won't reset mid-animation
  const translateY = useRef(new Animated.Value(16)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const show = (autoDismissCallback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, ...fadeConfig }),   // 240ms
      Animated.timing(opacity,    { toValue: 1, ...fadeConfig }),
    ]).start(() => {
      if (autoDismissCallback) {
        // ✅ durations.toast (4000ms) — was hardcoded, now token
        setTimeout(() => hide(autoDismissCallback), durations.toast);
      }
    });
  };

  const hide = (callback?: () => void) => {
    // §5.N toastDisappear:200ms — Duration.base (180ms) is the closest legacy value
    Animated.parallel([
      Animated.timing(translateY, {
        toValue:         16,
        duration:        Duration.base,
        easing:          easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        Duration.base,
        easing:          easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => callback?.());
  };

  return { translateY, opacity, show, hide };
}

/**
 * CROWD WORLD — Animation Tokens, Configs & Hooks  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all motion values. NO hardcoded durations,
 * easings, or spring params outside this file.
 *
 * Architecture constraints honoured here:
 *   LAW 13  → Glass Island hide/show uses springBouncy (tension:180·friction:12) +
 *             reduced-motion fallback via glassIslandFadeConfig
 *   Rule 04 → Input area never animates independently of Glass Island
 *
 * Motion philosophy:
 *   • easeOut for ALL enters / expands / reveals (fast exit from origin)
 *   • spring/bounce ONLY on content delight moments — NEVER on UI chrome
 *     (Glass Island, headers, navigation elements)
 *   • Every animated component must check useReducedMotion() and fall back
 *     to opacity-only
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { durations, easings, springSnap, fadeConfig } from '@/constants/animations';
 *   import { useReducedMotion, useButtonPress }           from '@/constants/animations';
 */

import { useState, useEffect } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DURATIONS (ms)
//
// Canonical scale — use `durations` in all new code.
//
//   instant : 100  — card press, skeleton appear, snap feedback
//   fast    : 160  — tab switch, button release, Glass Island tab active
//   normal  : 240  — modal open, toast appear, opacity fade, page enter
//   slow    : 360  — sheet dismiss, page exit, long transitions
//   spring  : 480  — badge earn, multi-step delight sequences
//
// ⚠️  Legacy `Duration` object preserved below for backward compat.
//     New code uses `durations`. Do NOT add keys to `Duration`.
// ─────────────────────────────────────────────────────────────────────────────

export const durations = {
  /** 100ms — card press, skeleton appear, instant snap feedback */
  instant: 100,
  /** 160ms — tab switch, button release, Glass Island tab active scale */
  fast:    160,
  /** 240ms — modal open, toast appear, opacity fade, standard page enter */
  normal:  240,
  /** 360ms — sheet dismiss, page exit, slower content reveals */
  slow:    360,
  /** 480ms — badge earn, mayor crown, multi-step delight sequences */
  spring:  480,
} as const;

export type DurationsKey   = keyof typeof durations;
export type DurationsValue = (typeof durations)[DurationsKey];

/** Typed interface for the canonical duration scale */
export interface DurationScale {
  readonly instant: 100;
  readonly fast:    160;
  readonly normal:  240;
  readonly slow:    360;
  readonly spring:  480;
}

// ── Legacy Duration (backward compat — do NOT reference in new code) ─────────

/**
 * @deprecated Use `durations` instead.
 *
 * Duration differences vs durations:
 *   micro : 80   → no canonical equiv (closest: durations.instant=100)
 *   fast  : 120  → durations.fast = 160  (intentionally differs — kept as-is
 *                  to avoid breaking useTabFade / usePageTransition hooks)
 *   base  : 180  → no canonical equiv (between fast:160 and normal:240)
 *   sheet : 240  → durations.normal = 240  (identical)
 *   page  : 320  → between durations.normal and durations.slow
 */
export const Duration = {
  /** 80ms  — button press scale-down */
  micro:  80,
  /** 120ms — legacy tab fade-out (note: canonical fast = 160ms) */
  fast:   120,
  /** 180ms — micro-interactions, tab fade-in */
  base:   180,
  /** 240ms — bottom sheets, page transitions (≡ durations.normal) */
  sheet:  240,
  /** 320ms — full-page enter / exit */
  page:   320,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. EASING PRESETS
//
// All values are (t: number) => number functions from React Native Easing.
//
// ┌──────────────┬──────────────────────────────────────────────────────────┐
// │ easeOut      │ cubic-bezier(0.0,0.0,0.2,1.0)   Primary enter/expand    │
// │ easeInOut    │ cubic-bezier(0.4,0.0,0.2,1.0)   Cross-screen moves      │
// │ spring       │ Easing.out(Easing.back(1.7))     Content overshoot       │
// │ bounce       │ Easing.out(Easing.bounce)        Delight moments only    │
// └──────────────┴──────────────────────────────────────────────────────────┘
//
// ⚠️  `spring` and `bounce` MUST NEVER be used on UI chrome:
//     Glass Island, header rows, input area, navigation tabs.
//     Chrome motion is always easeOut.
// ─────────────────────────────────────────────────────────────────────────────

export const easings = {
  /**
   * easeOut — cubic-bezier(0.0, 0.0, 0.2, 1.0)
   * Fast exit from origin, smooth deceleration into resting position.
   * Use for ALL enter / reveal / expand motions across the app.
   */
  easeOut: Easing.bezier(0.0, 0.0, 0.2, 1.0),

  /**
   * easeInOut — cubic-bezier(0.4, 0.0, 0.2, 1.0)
   * Smooth acceleration and deceleration. Use for elements that
   * travel from one position to another (not enters or exits).
   */
  easeInOut: Easing.bezier(0.4, 0.0, 0.2, 1.0),

  /**
   * spring — Easing.out(Easing.back(1.7))
   * Gentle cubic overshoot → settles with premium feel.
   * Use for content elements: cards entering, chips snapping in,
   * message bubbles, pill selections.
   *
   * ⚠️  NOT for UI chrome. For physics-based spring, use springConfigs
   *     with Animated.spring() instead — this easing is timing() only.
   */
  spring: Easing.out(Easing.back(1.7)),

  /**
   * bounce — Easing.out(Easing.bounce)
   * Physical multi-bounce at end of motion. High-delight only:
   * Spark Gift heart burst, Mayor crown arrival, badge earn.
   *
   * ⚠️  ALWAYS check useReducedMotion() before using — reduced motion
   *     users must receive opacity-only fallback (no scale, no translate).
   * ⚠️  NOT for UI chrome.
   */
  bounce: Easing.out(Easing.bounce),
} as const;

export type EasingsKey = keyof typeof easings;

/** Typed interface for easing presets */
export interface EasingPresets {
  readonly easeOut:   (t: number) => number;
  readonly easeInOut: (t: number) => number;
  readonly spring:    (t: number) => number;
  readonly bounce:    (t: number) => number;
}

/**
 * Standalone backward-compat export matching the original file's easeOut.
 * @deprecated Prefer `easings.easeOut`. Kept for existing hooks below.
 *
 * Note: original easeOut used bezier(0.16, 1, 0.3, 1) — that curve is
 * preserved here so nothing breaks. easings.easeOut uses the blueprint
 * canonical bezier(0.0, 0.0, 0.2, 1.0) for new code.
 */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// ─────────────────────────────────────────────────────────────────────────────
// 3. SPRING CONFIGS  (Animated.spring)
//
// Uses the tension/friction API. Reanimated worklets use stiffness/damping
// directly with withSpring() — equivalent values noted in comments.
//
// Tension/friction → feel:
//   Higher tension  = faster / snappier spring
//   Higher friction = more damped (less bounce)
//   Lower friction  = more oscillation / wobble
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
   * Reanimated equiv: { stiffness:80, damping:8 }
   */
  springSnap: {
    useNativeDriver: true,
    tension:         80,
    friction:        8,
  },

  /**
   * springStiff — fast, crisp, minimal overshoot.
   * tension:200 · friction:18
   * Use for: button release (onPressOut), send button pop, pill confirm.
   * Reanimated equiv: { stiffness:200, damping:18 }
   */
  springStiff: {
    useNativeDriver: true,
    tension:         200,
    friction:        18,
  },

  /**
   * springGentle — slow settle, no perceptible bounce.
   * tension:100 · friction:15
   * Use for: idle→active icon scale (0.9→1.0), presence dot appear.
   * Reanimated equiv: { stiffness:100, damping:15 }
   */
  springGentle: {
    useNativeDriver: true,
    tension:         100,
    friction:        15,
  },

  /**
   * springBouncy — Glass Island hide/show spring (LAW 13).
   * tension:180 · friction:12
   * Use for: Glass Island translateY enter/exit, new-message chip slide.
   * Blueprint: "spring stiffness 180 · damping 20 · 280ms perceived"
   * Reanimated equiv: { stiffness:180, damping:12 }
   *
   * Canonical usage:
   *   Animated.spring(translateY, { toValue: 0, ...springConfigs.springBouncy })
   */
  springBouncy: {
    useNativeDriver: true,
    tension:         180,
    friction:        12,
  },

  /**
   * springWobbly — loose, visible wobble. Highest delight level.
   * tension:80 · friction:6
   * Use for: bottom sheet open, reaction heart, Mayor crown arrival.
   * Reanimated equiv: { stiffness:80, damping:6 }
   * ⚠️  Always provide reduced-motion fallback (opacity fade only).
   */
  springWobbly: {
    useNativeDriver: true,
    tension:         80,
    friction:        6,
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
// useNativeDriver: true — we animate only transform/opacity, never layout.
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
 *
 * Usage:
 *   Animated.timing(opacity, { toValue: 1, ...fadeConfig }).start();  // fade in
 *   Animated.timing(opacity, { toValue: 0, ...fadeConfig }).start();  // fade out
 */
export const fadeConfig: TimingConfig = {
  duration:        durations.normal,
  easing:          easings.easeOut,
  useNativeDriver: true,
};

/**
 * slideUpConfig — bottom sheet / modal enter (slide up from below).
 * duration: slow (360ms) · easeOut
 *
 * Usage:
 *   translateY.setValue(sheetHeight);  // start below screen
 *   Animated.timing(translateY, { toValue: 0, ...slideUpConfig }).start();
 *
 * Reduced motion: replace with fadeConfig (opacity only, no translate).
 */
export const slideUpConfig: TimingConfig = {
  duration:        durations.slow,
  easing:          easings.easeOut,
  useNativeDriver: true,
};

/**
 * slideDownConfig — bottom sheet / modal dismiss (exit faster than enter).
 * duration: normal (240ms) · easeIn
 *
 * Usage:
 *   Animated.timing(translateY, { toValue: sheetHeight, ...slideDownConfig })
 *     .start(() => onDismiss());
 */
export const slideDownConfig: TimingConfig = {
  duration:        durations.normal,
  easing:          Easing.bezier(0.4, 0.0, 1.0, 1.0), // easeIn — fast exit
  useNativeDriver: true,
};

/**
 * glassIslandFadeConfig — reduced-motion fallback for LAW 13 hide/show.
 * duration: fast (160ms) · easeOut · opacity only (no translate).
 *
 * Usage (only when useReducedMotion() returns true):
 *   Animated.timing(opacity, { toValue: 0, ...glassIslandFadeConfig }).start();
 *   Animated.timing(opacity, { toValue: 1, ...glassIslandFadeConfig }).start();
 */
export const glassIslandFadeConfig: TimingConfig = {
  duration:        durations.fast,
  easing:          easings.easeOut,
  useNativeDriver: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. REDUCED MOTION HOOK
//
// Every animated component MUST call this and provide an opacity-only fallback.
// Re-renders automatically when the system setting changes.
//
// Reduced-motion rules:
//   - All scale/translate animations → opacity fade only
//   - Skeleton shimmer               → static (no loop)
//   - Bottom sheet slide-up          → opacity fade-in (no translate)
//   - Glass Island hide              → opacity fade (glassIslandFadeConfig)
//   - Spark Gift heart burst         → static heart fade (no scale)
//   - Duration factor                → 0.5× (half all durations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the user has enabled "Reduce Motion" in system settings.
 *
 * Usage:
 *   const reducedMotion = useReducedMotion();
 *   if (reducedMotion) {
 *     Animated.timing(opacity, { toValue: 1, ...fadeConfig }).start();
 *   } else {
 *     // full spring/slide animation
 *   }
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Read current setting
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);

    // Subscribe to live changes (user can toggle without restarting)
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => subscription.remove();
  }, []);

  return reducedMotion;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ANIMATION HOOKS
//
// Backward-compatible hooks from v1.  New components should compose
// durations / easings / springConfigs tokens directly with
// Animated.timing() / Animated.spring() for readability.
//
// Note: Animated.Value created inside hooks should be wrapped in useRef
// in functional components to prevent recreation on every render:
//   const scale = useRef(new Animated.Value(1)).current;
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Button Press ───────────────────────────────────────────────────────────
   Usage:
     const { scale, handlers } = useButtonPress();
     <Animated.View style={{ transform: [{ scale }] }} {...handlers}>
─────────────────────────────────────────────────────────────────────────────── */
export function useButtonPress() {
  const scale = new Animated.Value(1);

  const onPressIn = () => {
    Animated.timing(scale, {
      toValue:         0.97,
      duration:        Duration.micro,
      easing:          easeOut,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    // springStiff for crisp, confident release — matches blueprint button spec
    Animated.spring(scale, {
      toValue: 1,
      ...springConfigs.springStiff,
    }).start();
  };

  return { scale, handlers: { onPressIn, onPressOut } };
}

/* ─── Page Transition ────────────────────────────────────────────────────────
   Fade + 8px slide-up on mount.

   Usage:
     const { opacity, translateY, enter, exit } = usePageTransition();
     useEffect(() => { enter(); }, []);
     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
       {children}
     </Animated.View>
─────────────────────────────────────────────────────────────────────────────── */
export function usePageTransition() {
  const opacity    = new Animated.Value(0);
  const translateY = new Animated.Value(8);

  const enter = () =>
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, ...fadeConfig }),
      Animated.timing(translateY, { toValue: 0, ...slideUpConfig }),
    ]).start();

  const exit = (callback?: () => void) =>
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: durations.fast, easing: easings.easeOut, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 8, duration: durations.fast, easing: easings.easeOut, useNativeDriver: true }),
    ]).start(callback);

  return { opacity, translateY, enter, exit };
}

/* ─── Tab Switch Fade ────────────────────────────────────────────────────────
   Content fades out (120ms legacy) then back in (180ms legacy).
   No horizontal slide.

   Usage:
     const tabFade = useTabFade();
     tabFade.switch(() => setActiveTab(newTab));
     <Animated.View style={{ opacity: tabFade.opacity }}>
─────────────────────────────────────────────────────────────────────────────── */
export function useTabFade() {
  const opacity = new Animated.Value(1);

  const switchTab = (onMidpoint: () => void) => {
    Animated.timing(opacity, {
      toValue:         0,
      duration:        Duration.fast,   // 120ms legacy value — kept intentionally
      easing:          easeOut,
      useNativeDriver: true,
    }).start(() => {
      onMidpoint();
      Animated.timing(opacity, {
        toValue:         1,
        duration:        Duration.base,
        easing:          easeOut,
        useNativeDriver: true,
      }).start();
    });
  };

  return { opacity, switch: switchTab };
}

/* ─── Skeleton Shimmer ───────────────────────────────────────────────────────
   Looping opacity pulse at ~700ms per half-cycle. Reduce-motion aware.
   Caller should check useReducedMotion() and skip this hook if true
   (return a static Animated.Value(0.5) instead).

   Usage:
     const reducedMotion   = useReducedMotion();
     const shimmerOpacity  = reducedMotion
       ? new Animated.Value(0.5)   // static — no loop
       : useSkeletonShimmer();
     <Animated.View style={[styles.skeleton, { opacity: shimmerOpacity }]} />
─────────────────────────────────────────────────────────────────────────────── */
export function useSkeletonShimmer(): Animated.Value {
  const opacity = new Animated.Value(0.4);

  Animated.loop(
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
  ).start();

  return opacity;
}

/* ─── Pull-to-Refresh Rotation ───────────────────────────────────────────────
   RefreshCw icon rotates with pull progress. No rubber-band overshoot.

   Usage:
     const { rotation, setProgress, animateSpin, stopSpin } = usePullRotation();
     // On scroll: setProgress(pullDistance / maxPullDistance)
     <Animated.View style={{ transform: [{ rotate: rotation }] }}>
       <RefreshIcon />
     </Animated.View>
─────────────────────────────────────────────────────────────────────────────── */
export function usePullRotation() {
  const progress = new Animated.Value(0);

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
        duration:        800,
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
   Slides up from bottom with opacity. Auto-dismiss at 4s.

   Usage:
     const { translateY, opacity, show, hide } = useToastAnimation();
     show(() => setVisible(false));  // callback fires after dismiss
     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
       <Toast message="..." />
     </Animated.View>
─────────────────────────────────────────────────────────────────────────────── */
export function useToastAnimation() {
  const translateY = new Animated.Value(16);
  const opacity    = new Animated.Value(0);

  const show = (autoDismissCallback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, ...fadeConfig }),
      Animated.timing(opacity,    { toValue: 1, ...fadeConfig }),
    ]).start(() => {
      if (autoDismissCallback) {
        setTimeout(() => hide(autoDismissCallback), 4000);
      }
    });
  };

  const hide = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 16, duration: Duration.base, easing: easeOut, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,  duration: Duration.base, easing: easeOut, useNativeDriver: true }),
    ]).start(() => callback?.());
  };

  return { translateY, opacity, show, hide };
}

/**
 * ORBIT — Animation Utilities
 *
 * Centralized animation constants and helpers aligned with design tokens.
 *
 * Easing: cubic-bezier(0.16, 1, 0.3, 1) — smooth out, never bouncy.
 * Durations: 80ms micro → 120ms fast → 180ms base → 240ms sheet → 320ms page.
 *
 * Rules:
 * - NEVER use spring/bounce on UI chrome.
 * - Button press: scale 0.97 in 80ms.
 * - Tab switch: fade-out 120ms → fade-in 180ms (no horizontal slide).
 * - Page transition: 8px Y slide-up + fade, 240ms.
 * - Bottom sheet: slide-up 240ms from bottom.
 */

import { Animated, Easing } from "react-native";

/* ─────────────────────────────────────────────────────────────────────────────
   EASING
───────────────────────────────────────────────────────────────────────────── */

/**
 * Approximates CSS cubic-bezier(0.16, 1, 0.3, 1) — smooth, fast exit.
 * Use for all UI motion. Never use Easing.bounce or Easing.elastic.
 */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/* ─────────────────────────────────────────────────────────────────────────────
   DURATIONS (ms)
───────────────────────────────────────────────────────────────────────────── */
export const Duration = {
  micro:  80,    // Button press scale
  fast:   120,   // Tab fade-out
  base:   180,   // Micro-interactions, tab fade-in
  sheet:  240,   // Bottom sheets, page transitions
  page:   320,   // Full-page enter/exit
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
   BUTTON PRESS
   Usage: const { scale, handlers } = useButtonPress();
          <Animated.View style={{ transform: [{ scale }] }} {...handlers}>
───────────────────────────────────────────────────────────────────────────── */
export function useButtonPress() {
  const scale = new Animated.Value(1);

  const onPressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: Duration.micro,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: Duration.micro,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  };

  return { scale, handlers: { onPressIn, onPressOut } };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE TRANSITION
   Fade + 8px slide-up on mount. Use with useEffect + Animated.parallel.
   
   Usage:
     const { opacity, translateY } = usePageTransition();
     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
       {children}
     </Animated.View>
───────────────────────────────────────────────────────────────────────────── */
export function usePageTransition() {
  const opacity     = new Animated.Value(0);
  const translateY  = new Animated.Value(8);

  const enter = () =>
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Duration.sheet,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: Duration.sheet,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();

  const exit = (callback?: () => void) =>
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: Duration.fast,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 8,
        duration: Duration.fast,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(callback);

  return { opacity, translateY, enter, exit };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAB SWITCH FADE
   Content fades out (120ms) then back in (180ms). No horizontal slide.

   Usage:
     const tabFade = useTabFade();
     // on tab change:
     tabFade.switch(() => setActiveTab(newTab));
     // wrap content:
     <Animated.View style={{ opacity: tabFade.opacity }}>
───────────────────────────────────────────────────────────────────────────── */
export function useTabFade() {
  const opacity = new Animated.Value(1);

  const switchTab = (onMidpoint: () => void) => {
    Animated.sequence([
      // Fade out
      Animated.timing(opacity, {
        toValue: 0,
        duration: Duration.fast,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onMidpoint();
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: Duration.base,
        easing: easeOut,
        useNativeDriver: true,
      }).start();
    });
  };

  return { opacity, switch: switchTab };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SKELETON SHIMMER
   Looping shimmer at 1.4s, very low contrast. Almost invisible.

   Usage:
     const shimmerOpacity = useSkeletonShimmer();
     <Animated.View style={[styles.skeleton, { opacity: shimmerOpacity }]} />
───────────────────────────────────────────────────────────────────────────── */
export function useSkeletonShimmer(): Animated.Value {
  const opacity = new Animated.Value(0.4);

  Animated.loop(
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.4,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ])
  ).start();

  return opacity;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PULL-TO-REFRESH ROTATION
   RefreshCw icon rotates with pull progress, no rubber-band overshoot.

   Usage:
     const { rotation, setProgress } = usePullRotation();
     // On scroll event: setProgress(pullDistance / maxPullDistance)
     <Animated.View style={{ transform: [{ rotate: rotation }] }}>
       <Feather name="refresh-cw" size={24} />
     </Animated.View>
───────────────────────────────────────────────────────────────────────────── */
export function usePullRotation() {
  const progress = new Animated.Value(0);

  const rotation = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "360deg"],
    extrapolate: "clamp",
  });

  const setProgress = (value: number) => {
    progress.setValue(Math.min(1, Math.max(0, value)));
  };

  const animateSpin = () => {
    progress.setValue(0);
    Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { iterations: -1 }
    ).start();
  };

  const stopSpin = () => {
    progress.stopAnimation();
    progress.setValue(0);
  };

  return { rotation, setProgress, animateSpin, stopSpin };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOAST SLIDE-UP
   Slides up from bottom with shadow, auto-dismiss at 4s.

   Usage:
     const { translateY, opacity, show, hide } = useToastAnimation();
     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
       <Toast message="..." />
     </Animated.View>
     // trigger: show(() => setVisible(false)) — callback fires after dismiss
───────────────────────────────────────────────────────────────────────────── */
export function useToastAnimation() {
  const translateY  = new Animated.Value(16);
  const opacity     = new Animated.Value(0);

  const show = (autoDismissCallback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: Duration.sheet,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: Duration.sheet,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (autoDismissCallback) {
        setTimeout(() => hide(autoDismissCallback), 4000);
      }
    });
  };

  const hide = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 16,
        duration: Duration.base,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: Duration.base,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => callback?.());
  };

  return { translateY, opacity, show, hide };
}

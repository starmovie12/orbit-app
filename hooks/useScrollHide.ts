/**
 * hooks/useScrollHide.ts
 * CROWD WORLD — Glass Island Scroll-Hide Engine (LAW 13)
 *
 * Drives the hide/show behaviour of the Floating Glass Island Navigation
 * per LAW 13 (Blueprint v5.0 § Screen [8]).
 *
 * ─── PRD behaviour spec (§ Screen [8] · lines 856–861 / 1169–1177) ──────────
 *
 * Trigger 1 — Scroll toward older messages (offset.y increases):
 *   translateY → +scrollHideOffset  (72px + insets.bottom)
 *   spring: stiffness 180 · damping 20 · ~280ms perceived
 *
 * Trigger 2 — Scroll back toward newest messages (offset.y decreases):
 *   translateY → 0  (Glass Island springs back in)
 *
 * Trigger 3 — Keyboard opens:
 *   translateY → +120px  (fully off-screen · PRD explicit)
 *   Overrides any scroll state · fires before scroll can react
 *
 * Trigger 4 — Keyboard closes:
 *   translateY → 0  (always restores · user can re-scroll to hide again)
 *
 * ─── Animation choices ───────────────────────────────────────────────────────
 *
 * Full motion (default):
 *   Animated.spring → springConfigs.springBouncy (tension:180 · friction:12)
 *   Note: animations.ts explicitly specifies that Animated.spring callers
 *   use springBouncy. The stiffness:180/damping:20 values in the natural-
 *   language PRD spec are for the Reanimated withSpring worklet path only.
 *
 * Reduced motion (AccessibilityInfo.isReduceMotionEnabled = true):
 *   Blueprint Reduced Motion table: "Glass Island hide → opacity fade (no translate)"
 *   translateY snaps immediately · opacity animates via glassIslandFadeConfig (160ms)
 *   Consumers MUST apply both translateY and opacity styles.
 *
 * ─── Scroll threshold ────────────────────────────────────────────────────────
 *   SCROLL_THRESHOLD = 10px  (task spec · prevents flickering on micro-scrolls)
 *
 * ─── Consumers ───────────────────────────────────────────────────────────────
 *   Glass Island (LAW 13)     — primary consumer
 *   HomeScreen FlatList       — passes scrollHandler to onScroll
 *   Discover ScrollView       — same pattern
 *   Wallet ScrollView         — same pattern
 *
 * Required on the ScrollView / FlatList:
 *   scrollEventThrottle={16}   ← needed for 60fps scroll events on iOS
 *
 * Layer : hook  |  STATUS: ✅ new  |  PRIORITY: P1
 * Deps  : constants/animations.ts · react-native-safe-area-context
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  springConfigs,
  glassIslandFadeConfig,
  LAW13_GLASS_ISLAND_HIDE_OFFSET,
  useReducedMotion,
} from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PRD § Screen [8] line 860: "Keyboard opens → translateY +120px (fully hidden)".
 * This is larger than scrollHideOffset to ensure the Glass Island clears the
 * keyboard accessory bar on all devices.
 */
const KEYBOARD_HIDE_OFFSET = 120 as const;

/**
 * Minimum scroll delta (px) required to trigger a hide/show transition.
 * Prevents flickering on micro-scrolls and momentum deceleration noise.
 * Task spec: 10px threshold.
 */
const SCROLL_THRESHOLD = 10 as const;

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export type ScrollHideResult = {
  /**
   * Attach to ScrollView / FlatList onScroll prop.
   * Also set `scrollEventThrottle={16}` on the scroll container.
   *
   * @example
   * <FlatList
   *   onScroll={scrollHandler}
   *   scrollEventThrottle={16}
   * />
   */
  readonly scrollHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

  /**
   * Wire to the Glass Island container's transform style.
   * Always apply this — in reduced motion mode it snaps instead of animating.
   *
   * @example
   * <Animated.View style={{ transform: [{ translateY }], opacity }} />
   */
  readonly translateY: Animated.Value;

  /**
   * Wire to the Glass Island container's opacity style.
   * In full-motion mode this stays at 1 (translateY does the work).
   * In reduced-motion mode this animates 1 → 0 while translateY snaps.
   *
   * @example
   * <Animated.View style={{ transform: [{ translateY }], opacity }} />
   */
  readonly opacity: Animated.Value;

  /**
   * True when the Glass Island is in its visible (resting) position.
   * Use for accessibility state, conditional rendering, or sibling layout.
   */
  readonly isVisible: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drives Glass Island hide/show per LAW 13.
 *
 * Returns animated values and a scroll handler that work together to slide
 * the Glass Island off-screen on upward scroll and keyboard open events,
 * and spring it back on downward scroll and keyboard close.
 *
 * @example Full wiring (GlassIsland + FlatList)
 * ```tsx
 * const { scrollHandler, translateY, opacity, isVisible } = useScrollHide();
 *
 * // On the Glass Island:
 * <Animated.View
 *   style={[
 *     styles.glassIsland,
 *     { transform: [{ translateY }], opacity },
 *   ]}
 * />
 *
 * // On the FlatList:
 * <FlatList
 *   onScroll={scrollHandler}
 *   scrollEventThrottle={16}
 *   ...
 * />
 * ```
 */
export function useScrollHide(): ScrollHideResult {
  const insets        = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // ── Animated values (useRef — created once, never reset on re-render) ──────

  /**
   * Glass Island vertical translation.
   * 0 = visible at resting position · positive = translated off-screen below.
   * useRef ensures this Animated.Value is created exactly once — never reset
   * mid-flight when a parent re-renders.
   */
  const translateY = useRef(new Animated.Value(0)).current;

  /**
   * Glass Island opacity.
   * Full-motion mode: always stays at 1 (translateY carries all the motion).
   * Reduced-motion mode: animates 1 → 0 on hide, 0 → 1 on show.
   * Consumers MUST wire this — the hook produces no side-effects on the view.
   */
  const opacity = useRef(new Animated.Value(1)).current;

  // ── Internal refs (mutable, no re-render on change) ─────────────────────

  /** Last captured scroll offset — compared against the current value each event. */
  const lastScrollY = useRef<number>(0);

  /**
   * Tracks whether the Glass Island is currently in a hidden position.
   * Guards hide() / show() from firing redundant animations on every event.
   * Using a ref (not state) keeps these checks outside React's render cycle.
   */
  const isHiddenRef = useRef<boolean>(false);

  /**
   * True while the on-screen keyboard is open.
   * Scroll events are ignored while this is true — keyboard controls translateY.
   */
  const keyboardOpenRef = useRef<boolean>(false);

  // ── Public visible state ─────────────────────────────────────────────────

  /**
   * React state mirror of isHiddenRef — triggers re-renders for consumers
   * that need to read visibility (accessibility, conditional sibling layout).
   */
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // ── Derived geometry ─────────────────────────────────────────────────────

  /**
   * Full scroll-hide translate offset in px.
   *
   * LAW13_GLASS_ISLAND_HIDE_OFFSET = 72  (56px bar height + 16px bottom padding)
   * insets.bottom = device-specific safe-area bottom inset (0 on most Android,
   * 34px on iPhone 14, etc.)
   *
   * Adding the dynamic inset ensures the Glass Island clears the home indicator
   * on notch/punch-hole devices.
   *
   * PRD § Screen [8]: "translateY +80px" is this value on a typical Android device
   * (insets.bottom ≈ 8px). On iPhone 14 (insets.bottom = 34px) the offset = 106px.
   */
  const scrollHideOffset = LAW13_GLASS_ISLAND_HIDE_OFFSET + insets.bottom;

  // ── Animation drivers ────────────────────────────────────────────────────

  /**
   * Core animation dispatcher.
   *
   * Full motion path:
   *   Animated.spring using springConfigs.springBouncy (tension:180 · friction:12).
   *   animations.ts § 3 explicitly states Animated.spring callers use springBouncy.
   *   The natural-language PRD spec (§ Screen [8]) says "stiffness 180 · damping 20"
   *   — those values apply to the separate Reanimated withSpring worklet path in
   *   useGlassIslandHide.ts. This hook uses the Animated.spring path.
   *
   * Reduced motion path:
   *   translateY snaps instantly (setValue, no animation).
   *   Opacity fades in/out via glassIslandFadeConfig (160ms · easeOut).
   *   Blueprint Reduced Motion table: "Glass Island hide → opacity fade (no translate)".
   *
   * @param toTranslateY - Target translateY value. 0 = visible · positive = hidden.
   */
  const animateTo = useCallback(
    (toTranslateY: number): void => {
      const hiding = toTranslateY > 0;

      if (reducedMotion) {
        // ── Reduced motion: snap translate · fade opacity ─────────────────
        // Blueprint requirement: no translate animation. Snap to target instantly.
        translateY.setValue(toTranslateY);
        // Opacity carries the perceived transition (160ms easeOut fade).
        Animated.timing(opacity, {
          toValue: hiding ? 0 : 1,
          ...glassIslandFadeConfig,   // duration: 160ms · easing: easeOut
        }).start();
      } else {
        // ── Full motion: spring translate · opacity stays at 1 ───────────
        // Restore opacity to 1 in case a prior reduced-motion session faded it.
        opacity.setValue(1);
        Animated.spring(translateY, {
          toValue: toTranslateY,
          ...springConfigs.springBouncy, // tension:180 · friction:12
        }).start();
      }
    },
    // reducedMotion can change at runtime without an app restart.
    // translateY / opacity are stable Animated.Value refs — safe to list.
    [reducedMotion, translateY, opacity],
  );

  /**
   * Slides the Glass Island off-screen by animating to `offset`.
   * No-op when already hidden — prevents animation restarts on rapid scroll events.
   *
   * @param offset - translateY target in px (scrollHideOffset or KEYBOARD_HIDE_OFFSET).
   */
  const hide = useCallback(
    (offset: number): void => {
      if (isHiddenRef.current) return;
      isHiddenRef.current = true;
      setIsVisible(false);
      animateTo(offset);
    },
    [animateTo],
  );

  /**
   * Springs the Glass Island back to translateY 0 (fully visible).
   * No-op when already visible.
   */
  const show = useCallback((): void => {
    if (!isHiddenRef.current) return;
    isHiddenRef.current = false;
    setIsVisible(true);
    animateTo(0);
  }, [animateTo]);

  // ── Keyboard listeners ───────────────────────────────────────────────────

  useEffect(() => {
    // iOS:     keyboardWillShow fires before the keyboard appears → instant response.
    // Android: keyboardDidShow fires after the keyboard is visible → slight delay,
    //          which is acceptable on Android and matches platform convention.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (): void => {
      keyboardOpenRef.current = true;

      // PRD § Screen [8] line 860: keyboard forces translateY +120px (fully off-screen).
      // Reset isHiddenRef so hide() executes even if already at scrollHideOffset —
      // the keyboard needs a deeper hide (120px vs scroll's ~80–106px).
      isHiddenRef.current = false;
      hide(KEYBOARD_HIDE_OFFSET);
    };

    const onKeyboardHide = (): void => {
      keyboardOpenRef.current = false;

      // PRD § Screen [8] line 861: "Keyboard closes → translateY 0".
      // Always restore on keyboard dismiss regardless of prior scroll state.
      // User can scroll again to re-hide after typing.
      isHiddenRef.current = true; // force show() to run
      show();
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [hide, show]);

  // ── Scroll handler ────────────────────────────────────────────────────────

  /**
   * ScrollView / FlatList `onScroll` handler.
   *
   * ─── Scroll direction semantics for CROWD WORLD (inverted FlatList) ──────
   * The Home FlatList is inverted so latest messages appear at the bottom.
   * In an inverted list, scrolling toward older messages increases offset.y.
   *
   *   offset.y INCREASES  →  scrolling toward older messages  →  HIDE Island
   *   offset.y DECREASES  →  scrolling back to latest          →  SHOW Island
   *
   * ─── Threshold guard (10px) ──────────────────────────────────────────────
   * Prevents triggering on momentum deceleration noise and micro-jitter that
   * occurs at the very start/end of a scroll gesture. The threshold must be
   * crossed in a single event interval (not cumulatively) — this is intentional
   * to give a crisp, intentional-feeling trigger.
   *
   * ─── Keyboard guard ──────────────────────────────────────────────────────
   * While the keyboard is open the keyboard listener owns translateY. Scroll
   * events from the visible content behind the keyboard must not interfere.
   *
   * ─── lastScrollY update strategy ─────────────────────────────────────────
   * lastScrollY is only updated when a threshold-crossing event triggers an
   * action. This means minor sub-threshold scrolls accumulate until a single
   * event crosses the threshold, ensuring the threshold is directionally stable
   * and not prone to flickering from accumulated tiny deltas.
   */
  const scrollHandler = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      // Keyboard has exclusive control — ignore all scroll events while open.
      if (keyboardOpenRef.current) return;

      const currentY = event.nativeEvent.contentOffset.y;
      const dy       = currentY - lastScrollY.current;

      if (dy > SCROLL_THRESHOLD) {
        // Scrolling toward older messages → translate Glass Island off-screen.
        hide(scrollHideOffset);
        lastScrollY.current = currentY;
      } else if (dy < -SCROLL_THRESHOLD) {
        // Scrolling back toward newest messages → spring Glass Island back in.
        show();
        lastScrollY.current = currentY;
      }
      // |dy| ≤ SCROLL_THRESHOLD → ignore; no state change, lastScrollY unchanged.
    },
    [hide, show, scrollHideOffset],
  );

  // ── Return ────────────────────────────────────────────────────────────────

  return { scrollHandler, translateY, opacity, isVisible };
}

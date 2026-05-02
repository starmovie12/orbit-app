/**
 * PullIndicator — components/atoms/PullIndicator.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P2
 *
 * Custom pull-to-refresh indicator: gold spinning arc ring + "Refreshing…" label.
 * Wraps React Native's RefreshControl with Champagne Gold brand colors so every
 * FlatList across all tab screens matches the design system.
 *
 * Usage
 * ─────
 *   import PullIndicator from '@/components/atoms/PullIndicator';
 *
 *   <FlatList
 *     refreshControl={<PullIndicator refreshing={isRefreshing} onRefresh={load} />}
 *     ...
 *   />
 *
 * Props
 * ─────
 *   refreshing  boolean   Whether the list is currently refreshing (required).
 *   onRefresh   () => void  Callback to trigger refresh (forwarded to RefreshControl).
 *
 * Architecture notes
 * ──────────────────
 * • RefreshControl handles the native pull gesture + spinner infrastructure.
 *   We pass our brand colors so even the native spinner (visible on older OS
 *   versions that ignore the custom overlay) respects the design system.
 * • On top of RefreshControl we mount our own Animated overlay: a gold conic
 *   arc (via border trick) that rotates at 900ms/rev + a "Refreshing…" caption.
 * • The overlay is absolutely positioned and pointer-events-less — it doesn't
 *   interfere with the pull gesture.
 * • Reduced-motion: animation is a static icon; text still shows.
 * • React.memo — re-renders only when `refreshing` changes.
 *
 * Deps: constants/colors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing, typography } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DESIGN TOKENS (no hardcoded values below this block)
// ─────────────────────────────────────────────────────────────────────────────

/** One full rotation in ms — brisk but not frantic. */
const SPIN_DURATION = 900 as const;

/** Diameter of the custom arc ring in logical pixels. */
const RING_SIZE = 28 as const;

/** Arc border width — matches the weight of other atom borders in the system. */
const RING_STROKE = 3 as const;

// Brand palette shortcuts — never inline hex in component code.
const GOLD        = colors.fg.brand;           // #C9A227 Champagne Gold
const GOLD_SOFT   = 'rgba(201, 162, 39, 0.20)' as const; // arc track
const TEXT_COLOR  = colors.fg.secondary;       // #6B5B47 Espresso Brown
const BG_COLOR    = colors.bg.surface;         // white — native spinner bg

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface PullIndicatorProps {
  /**
   * Whether the list is actively refreshing.
   * Controls both the native RefreshControl and the custom overlay visibility.
   */
  refreshing: boolean;

  /**
   * Callback invoked when the user completes a pull gesture.
   * Forwarded directly to RefreshControl.
   */
  onRefresh?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — SUB-COMPONENT: SpinningRing
// Isolated so it can be memoised independently and avoids prop drilling.
// ─────────────────────────────────────────────────────────────────────────────

interface SpinningRingProps {
  reducedMotion: boolean;
}

const SpinningRing: React.FC<SpinningRingProps> = ({ reducedMotion }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  const startSpin = useCallback(() => {
    rotation.setValue(0);
    Animated.loop(
      Animated.timing(rotation, {
        toValue:         1,
        duration:        SPIN_DURATION,
        easing:          Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotation]);

  useEffect(() => {
    if (reducedMotion) {
      rotation.setValue(0);
      return;
    }
    startSpin();
    return () => {
      rotation.stopAnimation();
      rotation.setValue(0);
    };
  }, [reducedMotion, startSpin, rotation]);

  const spin = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.ringWrapper,
        !reducedMotion && { transform: [{ rotate: spin }] },
      ]}
      accessible={false}
      importantForAccessibility="no"
    >
      {/* Track ring (soft gold) */}
      <View style={styles.ringTrack} />
      {/* Active arc — top-right quadrant visible via border color trick */}
      <View style={styles.ringArc} />
    </Animated.View>
  );
};

const MemoSpinningRing = React.memo(SpinningRing);

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PullIndicator
 *
 * Drop-in RefreshControl with Champagne Gold brand treatment.
 * Use as the `refreshControl` prop of every FlatList / ScrollView in the app.
 *
 * @example
 * <FlatList
 *   data={items}
 *   refreshControl={
 *     <PullIndicator refreshing={refreshing} onRefresh={handleRefresh} />
 *   }
 * />
 */
const PullIndicator: React.FC<PullIndicatorProps> = ({
  refreshing,
  onRefresh,
}) => {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // ── Reduced-motion detection ───────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      if (mounted) setReducedMotion(val);
    });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (val) => { if (mounted) setReducedMotion(val); },
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // ── Fade overlay in/out on refresh state change ────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:         refreshing ? 1 : 0,
      duration:        reducedMotion ? 0 : 200,
      easing:          Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [refreshing, reducedMotion, fadeAnim]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      // Brand tint for native spinner (visible on some Android versions)
      tintColor={GOLD}
      colors={[GOLD]}           // Android progress ring color
      progressBackgroundColor={BG_COLOR}
      // Hide the default title — our overlay label replaces it
      title=""
      titleColor="transparent"
      accessibilityLabel={refreshing ? 'Refreshing content' : undefined}
      accessibilityLiveRegion="polite"
    >
      {/*
        The overlay sits at 0-height so it does not push content down.
        It is always rendered (opacity controls visibility) to avoid
        layout jitter from conditional mounting.
      */}
      <Animated.View
        style={[styles.overlay, { opacity: fadeAnim }]}
        pointerEvents="none"
        importantForAccessibility="no"
        aria-hidden
      >
        <View style={styles.pill}>
          {/* Gold spinning arc ring */}
          <MemoSpinningRing reducedMotion={reducedMotion} />

          {/* "Refreshing…" caption */}
          <Text
            style={styles.label}
            numberOfLines={1}
            allowFontScaling={false}
          >
            Refreshing…
          </Text>
        </View>
      </Animated.View>
    </RefreshControl>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — STYLES
// Tokens only — zero hardcoded colors or spacing values.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Overlay ──────────────────────────────────────────────────────────────
  overlay: {
    // height: 0 so content list is not shifted; pill floats via negative margin
    height:         0,
    alignItems:     'center',
    // Pull pill visually above the list content area
    marginTop:      -spacing.xl - RING_SIZE,
    overflow:       'visible',
  },

  // ── Pill container ───────────────────────────────────────────────────────
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing.sm,
    paddingVertical:  spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor:  BG_COLOR,
    borderRadius:     999,           // full-pill — blueprint radii.full
    borderWidth:      1,
    borderColor:      GOLD_SOFT,
    // Tier-1 gold shadow for subtle elevation
    shadowColor:      GOLD,
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.14,
    shadowRadius:     8,
    elevation:        4,
  },

  // ── Ring wrapper ─────────────────────────────────────────────────────────
  ringWrapper: {
    width:          RING_SIZE,
    height:         RING_SIZE,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Track — the background full circle ───────────────────────────────────
  ringTrack: {
    position:        'absolute',
    width:           RING_SIZE,
    height:          RING_SIZE,
    borderRadius:    RING_SIZE / 2,
    borderWidth:     RING_STROKE,
    borderColor:     GOLD_SOFT,       // soft gold track
  },

  // ── Active arc — top-right transparent, rest is gold ─────────────────────
  // Technique: a full circle whose border is gold on 3 sides and transparent
  // on 1 side (top border). Rotating the wrapper then spins the gap around.
  ringArc: {
    position:        'absolute',
    width:           RING_SIZE,
    height:          RING_SIZE,
    borderRadius:    RING_SIZE / 2,
    borderWidth:     RING_STROKE,
    borderTopColor:  'transparent',   // gap — leading edge of spin
    borderRightColor: GOLD,
    borderBottomColor: GOLD,
    borderLeftColor:  GOLD,
  },

  // ── Label ────────────────────────────────────────────────────────────────
  label: {
    ...typography.caption,
    color:        TEXT_COLOR,
    fontWeight:   '600',
    letterSpacing: 0.2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — EXPORT
// React.memo: re-renders only when `refreshing` or `onRefresh` change.
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(PullIndicator);

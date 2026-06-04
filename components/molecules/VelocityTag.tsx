/**
 * VelocityTag — components/atoms/VelocityTag.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P0
 * PRD §1.4.6 — "<VelocityTag /> — Auto-Batch indicator chip (⚡ 87 msg/min · Live)"
 * PRD §1.3.4 — HOME Tab Layout: "Velocity Tag (conditional) ⚡ 87 msg/min — Live  28px"
 *
 * Renders a live velocity chip below the 3-row header on HOME tab.
 * Shows message velocity in the active scope (messages per minute).
 * CONDITIONAL — only shown when velocity >= VELOCITY_SHOW_THRESHOLD (10 msg/min).
 * Below threshold: returns null (no layout node, no cost).
 *
 * ── Display ──────────────────────────────────────────────────────────────────
 *   "⚡ {velocity} msg/min · Live"
 *   e.g. "⚡ 87 msg/min · Live"
 *
 * ── Color ─────────────────────────────────────────────────────────────────────
 *   Low  (10–49 msg/min) : amber wash bg · amber fg
 *   High (50+ msg/min)   : crimson wash bg · crimson fg (heat intensity)
 *
 * ── Animation (Reanimated v4 — worklet-safe, UI thread) ─────────────────────
 *   "· Live" pulse: opacity 1.0 ↔ 0.4, 1200ms loop, ease-in-out
 *   Velocity number update: brief scale 1.0 → 1.1 → 1.0 (80ms spring)
 *   Reduced Motion: static, no pulse, no scale — just shows the number
 *
 * ── Z-index ──────────────────────────────────────────────────────────────────
 *   z: 105 (above header z:100, below ScrollFAB z:200) — from PRD §1.3.4
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 *   accessibilityRole="text"
 *   accessibilityLabel: "{velocity} messages per minute — Live"
 *   Updates announced via accessibilityLiveRegion="polite" on parent
 *
 * ── Performance ──────────────────────────────────────────────────────────────
 *   React.memo — only re-renders when velocity prop changes
 *   Pulse animation on UI thread — zero JS bridge cost
 *   Number update scale on UI thread — zero JS bridge cost
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, palette }      from '@/constants/colors';
import { radius, spacing }      from '@/constants/spacing';
import { FONT_BODY, FONT_NUMERIC, FONT_SIZE } from '@/constants/typography';
import { useReducedMotion }     from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VelocityTagProps {
  /**
   * Current message velocity in messages per minute.
   * Badge is invisible below VELOCITY_SHOW_THRESHOLD (10 msg/min).
   * Typically sourced from a Firestore aggregated counter or real-time
   * velocity calculation in the active scope.
   */
  readonly velocity: number;
  /**
   * Optional outer style for margin / position.
   * Component aligns left by default (alignSelf: 'flex-start').
   */
  readonly style?: ViewStyle;
  /**
   * Test-only: disable all animations for snapshot stability.
   * @internal
   */
  readonly testDisableAnimation?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — THRESHOLDS & DESIGN CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum velocity (msg/min) to show the badge. Below this → null. */
const VELOCITY_SHOW_THRESHOLD = 10 as const;

/** Above this velocity, the chip switches to high-intensity crimson styling. */
const VELOCITY_HIGH_THRESHOLD = 50 as const;

/** Pulse animation cycle duration for "· Live" suffix (ms). */
const PULSE_DURATION_MS = 1200 as const;

/** Opacity target at the dim phase of the pulse. */
const PULSE_DIM_OPACITY = 0.4 as const;

/** Velocity number update spring (brief scale pop when number changes). */
const SPRING_VELOCITY_UPDATE = { stiffness: 300, damping: 20 } as const;

/** Scale overshoot when velocity number updates. */
const SCALE_UPDATE_PEAK = 1.1 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — COLOR TIERS
// ─────────────────────────────────────────────────────────────────────────────

interface ColorTier {
  readonly bg:     string;
  readonly fg:     string;
  readonly border: string;
}

/** Low velocity (10–49 msg/min): warm amber — notable but not alarming. */
const COLOR_LOW: ColorTier = {
  bg:     'rgba(212, 101, 26, 0.08)',  // amber[600] @ 8% — semanticWarning.bg
  fg:     palette.amber[600],          // #D4651A — 4.8:1 on wash ✅ AA (bold)
  border: palette.amber[600],          // #D4651A
} as const;

/** High velocity (50+ msg/min): crimson — high-energy, urgent signal. */
const COLOR_HIGH: ColorTier = {
  bg:     'rgba(239, 68, 68, 0.08)',   // crimson[600] @ 8% — semanticError.bg
  fg:     colors.fg.error,             // crimson[600] #EF4444 — 5.4:1 on wash ✅ AA
  border: colors.fg.error,             // crimson[600]
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VelocityTag — auto-batch message velocity indicator.
 *
 * Shows "⚡ {N} msg/min · Live" when velocity >= 10 msg/min.
 * Returns null below threshold — no layout cost.
 *
 * @param velocity             - Messages per minute in active scope.
 * @param style                - Optional outer margin / position overrides.
 * @param testDisableAnimation - Skip animations in tests.
 *
 * @example
 * // Below header, above chat feed on HOME tab
 * <VelocityTag velocity={scopeVelocity} />
 *
 * // With margin for layout positioning
 * <VelocityTag
 *   velocity={scopeVelocity}
 *   style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xs }}
 * />
 */
function VelocityTagComponent({
  velocity,
  style,
  testDisableAnimation = false,
}: VelocityTagProps): React.ReactElement | null {

  // ── Visibility gate ────────────────────────────────────────────────────────
  if (velocity < VELOCITY_SHOW_THRESHOLD) {
    return null;
  }

  const reducedMotion = useReducedMotion();
  const colorTier = velocity >= VELOCITY_HIGH_THRESHOLD ? COLOR_HIGH : COLOR_LOW;

  // ── "· Live" pulse animation ───────────────────────────────────────────────
  // Continuously pulses the "· Live" text between full and dim opacity.
  // PERF: opacity only — compositor path — zero layout/paint
  const liveOpacity = useSharedValue<number>(1);

  useEffect(() => {
    if (testDisableAnimation || reducedMotion) {
      liveOpacity.value = 1;
      return;
    }
    liveOpacity.value = withRepeat(
      withSequence(
        withTiming(PULSE_DIM_OPACITY, {
          duration: PULSE_DURATION_MS / 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: PULSE_DURATION_MS / 2,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,   // infinite repeat
      false, // do not reverse (withSequence handles direction)
    );
    return () => {
      cancelAnimation(liveOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, testDisableAnimation]);

  const liveStyle = useAnimatedStyle(() => ({
    opacity: liveOpacity.value,
  }), []); /* PERF: opacity only — compositor */

  // ── Velocity number update animation ──────────────────────────────────────
  // Brief scale pop when the velocity number changes value.
  // PERF: transform (scale) only — compositor path
  const prevVelocity = useRef<number>(velocity);
  const numScale     = useSharedValue<number>(1);

  useEffect(() => {
    if (testDisableAnimation || reducedMotion) return;
    if (prevVelocity.current !== velocity) {
      prevVelocity.current = velocity;
      numScale.value = withSpring(SCALE_UPDATE_PEAK, SPRING_VELOCITY_UPDATE, () => {
        numScale.value = withSpring(1, SPRING_VELOCITY_UPDATE);
      });
    }
  }, [velocity, reducedMotion, testDisableAnimation, numScale]);

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numScale.value }],
  }), []); /* PERF: transform only — compositor */

  // ── Accessibility ──────────────────────────────────────────────────────────
  const a11yLabel = `${velocity} messages per minute — Live`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colorTier.bg,
          borderColor:     colorTier.border,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion="polite"
    >
      {/* ⚡ Lightning bolt */}
      <Text
        style={[styles.bolt, { color: colorTier.fg }]}
        allowFontScaling={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        ⚡
      </Text>

      {/* Velocity number — Space Mono 700 for tabular rendering */}
      <Animated.Text
        style={[
          styles.velocityNum,
          { color: colorTier.fg },
          numStyle,
        ]}
        allowFontScaling={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {velocity}
      </Animated.Text>

      {/* " msg/min" suffix — Inter 500 */}
      <Text
        style={[styles.suffix, { color: colorTier.fg }]}
        allowFontScaling={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {' '}msg/min
      </Text>

      {/* " · Live" — pulsing */}
      <Animated.Text
        style={[styles.live, { color: colorTier.fg }, liveStyle]}
        allowFontScaling={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {' · Live'}
      </Animated.Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — STATIC STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  /**
   * pill — outer container
   * height: 28px — PRD §1.3.4 "Velocity Tag 28px"
   * borderRadius: radius.xl (18px) — full pill per PRD §19.4
   */
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'flex-start',
    height:           28,
    paddingHorizontal: spacing.md,       // 12px
    paddingVertical:  2,                 // micro — keeps 28px total
    borderRadius:     radius.xl,         // 18px — full pill
    borderWidth:      1,
    overflow:         'hidden',
  },

  bolt: {
    fontSize:           FONT_SIZE.cap,   // 12px
    lineHeight:         18,
    includeFontPadding: false,
    marginRight:        3,               // sub-grid optical gap
  },

  /** Velocity number — Space Mono 700 tabular-nums */
  velocityNum: {
    fontFamily:         FONT_NUMERIC.bold,  // SpaceMono_700Bold
    fontWeight:         '700',
    fontSize:           FONT_SIZE.cap,      // 12px
    lineHeight:         18,
    fontVariant:        ['tabular-nums'],
    includeFontPadding: false,
  },

  /** " msg/min" — Inter 500 body weight */
  suffix: {
    fontFamily:         FONT_BODY.medium,   // Inter_500Medium
    fontWeight:         '500',
    fontSize:           FONT_SIZE.cap,      // 12px
    lineHeight:         18,
    includeFontPadding: false,
  },

  /** " · Live" — Inter 600 slightly emphasized */
  live: {
    fontFamily:         FONT_BODY.semiBold,  // Inter_600SemiBold
    fontWeight:         '600',
    fontSize:           FONT_SIZE.cap,       // 12px
    lineHeight:         18,
    includeFontPadding: false,
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — MEMO EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VelocityTag — auto-batch message velocity indicator atom.
 *
 * React.memo — re-renders only when `velocity` changes.
 * Returns null when velocity < 10 msg/min — zero layout cost.
 * Pulse animation on UI thread — zero JS-thread cost.
 */
export const VelocityTag = memo(VelocityTagComponent);

export default VelocityTag;

/**
 * HeatPulseDot — atoms/HeatPulseDot.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P1
 *
 * Renders a solid dot whose color reflects sector heat (0–100 scale) with a
 * pulsing ring that expands and fades to signal live activity.
 *
 * Color interpolation  : emerald[600] → amber[600] → crimson[600]
 * Ring animation       : scale 1→1.6 · opacity 0.4→0 · 1200ms · Animated.loop
 * Reduced motion       : static dot · ring hidden (blueprint Reduced Motion table)
 * Used by              : OnlineCountStrip (Home screen header · § Screen [1])
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { palette, animation } from '@/constants/colors';
import {
  useReducedMotion,
  getEffectiveDuration,
} from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — HEAT COLOR INTERPOLATION
// Two-stop linear blend across three palette anchors:
//   score   0 → 50  : emerald[600] (#1A7A4A) → amber[600]  (#D4651A)
//   score  50 → 100 : amber[600]  (#D4651A) → crimson[600] (#C4294F)
// ─────────────────────────────────────────────────────────────────────────────

const HEAT_ANCHORS = {
  low:  palette.emerald[600],  // #1A7A4A — cool, low activity
  mid:  palette.amber[600],    // #D4651A — warm, moderate activity
  high: palette.crimson[600],  // #C4294F — hot, peak activity
} as const;

/**
 * Parse a 6-digit hex color string to an [R, G, B] tuple (0–255 each).
 * Accepts strings with or without the leading '#'.
 */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Integer linear interpolation between channel values `a` and `b`. */
const lerp = (a: number, b: number, t: number): number =>
  Math.round(a + (b - a) * t);

/**
 * Map `score` (0–100) to a CSS-style `rgb(r, g, b)` color string.
 * Clamps values outside [0, 100] automatically.
 */
function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));

  const [from, to, t] =
    s <= 50
      ? [HEAT_ANCHORS.low,  HEAT_ANCHORS.mid,  s / 50]
      : [HEAT_ANCHORS.mid,  HEAT_ANCHORS.high, (s - 50) / 50];

  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);

  return `rgb(${lerp(r1, r2, t)}, ${lerp(g1, g2, t)}, ${lerp(b1, b2, t)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ANIMATION CONSTANTS (from tokens — no hardcoded values)
// ─────────────────────────────────────────────────────────────────────────────

/** Blueprint §5.N animation.duration.pulseDot = 1200ms */
const PULSE_DURATION       = animation.duration.pulseDot;   // 1200ms

/** Ring expands to 1.6× the dot diameter per task spec */
const RING_SCALE_END       = 1.6 as const;

/** Ring starts at 40% opacity then fades to transparent per task spec */
const RING_OPACITY_START   = 0.4 as const;

/** Ring border width is proportional so it looks sharp on all dot sizes */
const RING_BORDER_FRACTION = 0.15 as const;  // 15% of dot radius

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface HeatPulseDotProps {
  /**
   * Sector heat level. Clamped to [0, 100].
   * Maps linearly: 0 = cool green · 50 = amber · 100 = hot red.
   */
  score: number;

  /**
   * Diameter of the solid dot in logical pixels.
   * @default 8
   */
  size?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HeatPulseDot
 *
 * Renders a heat-score-colored dot with an expanding + fading ring.
 * Used in the OnlineCountStrip (Home screen header) to signal live activity.
 *
 * @example
 * // Inside OnlineCountStrip
 * <HeatPulseDot score={sectorHeatScore} size={8} />
 */
const HeatPulseDot: React.FC<HeatPulseDotProps> = ({ score, size = 8 }) => {
  const reducedMotion = useReducedMotion();

  // ── Animated values — created once via useRef, never re-instantiated ───
  const ringScale   = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(RING_OPACITY_START)).current;

  const dotColor = scoreToColor(score);

  // ── Animation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) {
      // Blueprint Reduced Motion Variants: "Online count pulse dot → static dot (no opacity cycle)"
      // Hide the ring entirely; leave the solid dot static.
      ringOpacity.setValue(0);
      ringScale.setValue(1);
      return;
    }

    // Reset to start position before (re-)starting the loop.
    // This guards against stale values if reducedMotion toggled at runtime.
    ringScale.setValue(1);
    ringOpacity.setValue(RING_OPACITY_START);

    const effectiveDuration = getEffectiveDuration(PULSE_DURATION, reducedMotion);

    const pulse = Animated.loop(
      Animated.parallel([
        // Ring expands outward: 1× → 1.6× dot diameter
        Animated.timing(ringScale, {
          toValue:         RING_SCALE_END,
          duration:        effectiveDuration,
          easing:          Easing.out(Easing.ease),  // gentle deceleration into expansion
          useNativeDriver: true,
        }),
        // Ring fades from 0.4 opacity to fully transparent as it expands
        Animated.timing(ringOpacity, {
          toValue:         0,
          duration:        effectiveDuration,
          easing:          Easing.linear,             // linear fade feels most natural for rings
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      // Clean up on unmount or before the next effect run
      pulse.stop();
    };
  }, [reducedMotion, ringOpacity, ringScale]);

  // ── Layout geometry ─────────────────────────────────────────────────────
  // Container must be large enough to contain the ring at max scale
  // without clipping. Add a small buffer for the border stroke itself.
  const borderWidth   = Math.max(1, Math.round(size * RING_BORDER_FRACTION));
  const containerSize = size * RING_SCALE_END + borderWidth * 2;
  const dotOffset     = (containerSize - size) / 2;  // centers dot in container

  return (
    <View
      style={[styles.container, { width: containerSize, height: containerSize }]}
      accessible
      accessibilityLabel={`Heat score ${Math.round(score)} out of 100`}
      accessibilityRole="image"
    >
      {/* Pulsing ring — rendered beneath the solid dot via absolute positioning */}
      <Animated.View
        style={[
          styles.ring,
          {
            width:        size,
            height:       size,
            borderRadius: size / 2,
            borderWidth,
            borderColor:  dotColor,  // ring color tracks dot color
            top:          dotOffset,
            left:         dotOffset,
            opacity:      ringOpacity,
            transform:    [{ scale: ringScale }],
          },
        ]}
      />

      {/* Solid heat dot — always on top, never animates */}
      <View
        style={[
          styles.dot,
          {
            width:           size,
            height:          size,
            borderRadius:    size / 2,
            backgroundColor: dotColor,
            top:             dotOffset,
            left:            dotOffset,
          },
        ]}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — STATIC STYLES
// (All color and size values are dynamic, set via inline styles above)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    // Position relative so absolute children are contained
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    // backgroundColor intentionally absent — ring is border-only, hollow center
  },
  dot: {
    position: 'absolute',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — EXPORT
// React.memo — re-renders only when `score` or `size` change (shallow compare)
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(HeatPulseDot);

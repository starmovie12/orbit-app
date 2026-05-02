/**
 * LiveDot — components/atoms/LiveDot.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P1
 *
 * A simple pulsing presence dot. Signals "live / online / active" state across
 * the app — Online Count Strip, avatar overlays, LIVE badges, etc.
 *
 * Animation   : opacity 0.5 → 1.0 → 0.5 · 1400ms · ease-in-out · infinite loop
 * Default color: colors.fg.success (Forest Emerald #1A7A4A)
 * Reduced motion: static dot at opacity 1.0 (blueprint Reduced Motion Variants table)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — ANIMATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Full cycle duration in ms. Task spec: 1400ms. */
const PULSE_DURATION  = 1400 as const;

/** Opacity floor — dot is always at least dimly visible */
const OPACITY_LOW     = 0.5 as const;

/** Opacity peak — fully opaque at the top of each pulse */
const OPACITY_HIGH    = 1.0 as const;

/** Half-cycle — each ease-in-out leg is half the full period */
const HALF_DURATION   = PULSE_DURATION / 2;   // 700ms

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveDotProps {
  /**
   * Fill color of the dot.
   * Accepts any valid React Native color string (hex · rgb · named).
   * @default colors.fg.success — Forest Emerald (#1A7A4A)
   */
  color?: string;

  /**
   * Diameter of the dot in logical pixels.
   * @default 8
   */
  size?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LiveDot
 *
 * A single-color pulsing dot that signals live presence or activity.
 *
 * @example
 * // Default — green presence indicator
 * <LiveDot />
 *
 * @example
 * // Amber — inside LIVE badge or WhatsApp CTA row
 * <LiveDot color={colors.fg.warning} size={6} />
 *
 * @example
 * // Brand gold — Typing indicator prefix dot
 * <LiveDot color={colors.fg.brand} size={6} />
 */
const LiveDot: React.FC<LiveDotProps> = ({
  color = colors.fg.success,
  size  = 8,
}) => {
  // ── Reduced-motion detection (mirrors useReducedMotion in animations.ts) ──
  // Implemented inline so this atom stays dep-free beyond constants/colors.ts.
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => subscription.remove();
  }, []);

  // ── Animated value — created once, never re-instantiated ─────────────────
  const opacity = useRef(new Animated.Value(OPACITY_LOW)).current;

  // ── Pulse loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) {
      // Blueprint Reduced Motion Variants: static dot — no opacity cycle
      opacity.setValue(OPACITY_HIGH);
      return;
    }

    // Reset to floor before (re-)starting — safe for runtime toggles
    opacity.setValue(OPACITY_LOW);

    const pulse = Animated.loop(
      Animated.sequence([
        // Low → High (ease-in: slow start, fast finish into peak brightness)
        Animated.timing(opacity, {
          toValue:         OPACITY_HIGH,
          duration:        HALF_DURATION,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // High → Low (ease-out: fast start, slow deceleration back to dim)
        Animated.timing(opacity, {
          toValue:         OPACITY_LOW,
          duration:        HALF_DURATION,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
      opacity.setValue(OPACITY_LOW);
    };
  }, [reducedMotion, opacity]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width:           size,
          height:          size,
          borderRadius:    size / 2,
          backgroundColor: color,
          opacity,
        },
      ]}
      accessible
      accessibilityLabel="Live"
      accessibilityRole="image"
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — STYLES
// (All sizing + color is dynamic — only structural styles live here)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dot: {
    // No margin/padding — caller controls layout and spacing
    // backgroundColor, width, height, borderRadius all set inline
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — EXPORT
// React.memo — re-renders only when `color` or `size` change
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(LiveDot);

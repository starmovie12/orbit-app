/**
 * RankProgressBar — Animated gold progress bar
 *
 * Per PRD §16.2:
 * - Fill animation: 600ms ease-out-quart (cubic-bezier(0.25, 0.46, 0.45, 0.94))
 * - Milestone reached: bar fills 100% → glow pulse × 2 → confetti burst → label crossfade
 * - Held milestone: continuous shimmer (lighter-gold highlight) 2.5s/pass, infinite
 * - Reduced-motion: instant fill, no shimmer
 *
 * Per LAW 6 (CROWN PRD): rank number update must not jump/flash (no layout shift).
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS_DARK, FONTS, FONT_SIZES, SPACING, RADIUS, MOTION } from '../tokens';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface RankProgressBarProps {
  /** Progress fraction in [0, 1] */
  progress: number;
  /** Human-readable label below bar: "Need 192 more reactions" */
  label: string;
  /** True when user currently holds a milestone (triggers shimmer) */
  milestoneHeld: boolean;
  /** True when a milestone was JUST reached (triggers glow + confetti) */
  milestoneJustReached?: boolean;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

const RankProgressBar: React.FC<RankProgressBarProps> = ({
  progress,
  label,
  milestoneHeld,
  milestoneJustReached = false,
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  const fillAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // ── Fill animation on progress change
  useEffect(() => {
    if (reducedMotion) {
      fillAnim.setValue(progress);
      return;
    }

    Animated.timing(fillAnim, {
      toValue: progress,
      duration: MOTION.slow, // 600ms
      // cubic-bezier(0.25, 0.46, 0.45, 0.94) ≈ Easing.out(Easing.quad)
      useNativeDriver: false, // width change requires layout update
    }).start();
  }, [progress, fillAnim, reducedMotion]);

  // ── Shimmer animation when milestone is held
  useEffect(() => {
    if (!milestoneHeld || reducedMotion) {
      shimmerAnim.setValue(-1);
      return;
    }

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: MOTION.progressShimmer, // 2500ms
        useNativeDriver: false,
      }),
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [milestoneHeld, shimmerAnim, reducedMotion]);

  // ── Glow pulse when milestone just reached
  useEffect(() => {
    if (!milestoneJustReached || reducedMotion) return;

    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [milestoneJustReached, glowAnim, reducedMotion]);

  const onLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  // Derive fill width
  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Derive shimmer position
  const shimmerLeft =
    barWidth > 0
      ? shimmerAnim.interpolate({
          inputRange: [-1, 2],
          outputRange: [-barWidth * 0.3, barWidth],
        })
      : new Animated.Value(0);

  // Derive glow
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(245,158,11,0)', 'rgba(245,158,11,0.6)'],
  });

  const accessibilityLabel = `Progress: ${Math.round(progress * 100)}%. ${label}`;

  return (
    <View style={styles.wrapper}>
      {/* Track */}
      <View
        style={styles.track}
        onLayout={onLayout}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        {/* Fill */}
        <Animated.View
          style={[
            styles.fill,
            { width: fillWidth },
          ]}
        >
          {/* Shimmer highlight — only when milestone held */}
          {milestoneHeld && !reducedMotion && barWidth > 0 && (
            <Animated.View
              style={[
                styles.shimmer,
                { left: shimmerLeft, width: barWidth * 0.3 },
              ]}
            />
          )}
        </Animated.View>

        {/* Glow overlay on milestone reached */}
        {!reducedMotion && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              styles.glowOverlay,
              { backgroundColor: glowColor },
            ]}
            pointerEvents="none"
          />
        )}
      </View>

      {/* Label */}
      <Text
        style={styles.label}
        numberOfLines={1}
        accessibilityElementsHidden
      >
        {label}
      </Text>
    </View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: SPACING.xs,
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,200,50,0.4)',
    borderRadius: RADIUS.pill,
  },
  glowOverlay: {
    borderRadius: RADIUS.pill,
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 18,
  },
});

export default React.memo(RankProgressBar);

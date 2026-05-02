/**
 * Skeleton — components/atoms/Skeleton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P1
 *
 * A warm-ivory shimmer skeleton used while content loads. A LinearGradient
 * sweeps left-to-right inside an overflow:hidden container, driven by a single
 * Animated.Value (0 → 1) loop over 1400ms.
 *
 * Shimmer colors
 *   base     : colors.bg.skeleton      (cream[200]  #F7ECD0) — at-rest surface
 *   highlight: colors.bg.skeletonShimmer (white     #FFFFFF) — light sweep peak
 *
 * Reduced motion: static cream rectangle · no shimmer loop (blueprint table)
 *
 * Exports
 *   Skeleton       — single loading bar / block (React.memo)
 *   SkeletonGroup  — vertical stack wrapper with consistent gap (React.memo)
 *
 * Used by: message list · discover feed · wallet transaction rows
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, radii } from '@/constants/colors';
import {
  useReducedMotion,
  getEffectiveDuration,
} from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Full shimmer sweep duration in ms. Task spec: 1400ms. */
const SHIMMER_DURATION = 1400 as const;

/**
 * The shimmer gradient is rendered at this multiple of the container's
 * measured width. It needs to be wider than the container so the highlight
 * never clips at either edge during the sweep.
 *
 * 3× means: the gradient covers [left_edge - W, left_edge + 2W] at start.
 * After a full translateX of +2W, its right edge just clears the container.
 */
const GRADIENT_WIDTH_MULTIPLIER = 3 as const;

/**
 * Gradient color stops (left → center → right).
 *
 * Using the skeleton token pair from the design system:
 *   colors.bg.skeleton        → warm cream base   (#F7ECD0 · cream[200])
 *   colors.bg.skeletonShimmer → white highlight   (#FFFFFF)
 *
 * The 5-stop shape (base · soft · peak · soft · base) produces a smooth
 * bell-curve highlight instead of a hard-edged slash.
 */
const SHIMMER_COLORS: readonly [string, string, string, string, string] = [
  colors.bg.skeleton,                       // far left  — base
  blendToWhite(colors.bg.skeleton, 0.4),    // shoulder  — 40% toward white
  colors.bg.skeletonShimmer,                // center    — full white peak
  blendToWhite(colors.bg.skeleton, 0.4),    // shoulder  — 40% toward white
  colors.bg.skeleton,                       // far right — base
] as const;

/** Color-stop positions matching the 5-stop gradient array above. */
const SHIMMER_LOCATIONS: readonly [number, number, number, number, number] = [
  0, 0.3, 0.5, 0.7, 1,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linearly blend a hex color toward pure white by `factor` (0–1).
 * Used to build the shimmer gradient shoulders so the transition is smooth.
 *
 * @param hex    — source hex color, 6-digit, with or without '#'
 * @param factor — 0 = source unchanged · 1 = pure white
 */
function blendToWhite(hex: string, factor: number): string {
  const n   = parseInt(hex.replace('#', ''), 16);
  const r   = (n >> 16) & 0xff;
  const g   = (n >> 8)  & 0xff;
  const b   = n         & 0xff;
  const rr  = Math.round(r + (255 - r) * factor);
  const gg  = Math.round(g + (255 - g) * factor);
  const bb  = Math.round(b + (255 - b) * factor);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface SkeletonProps {
  /**
   * Width of the skeleton block.
   * Pass a number for a fixed logical-pixel width, or a string like `'100%'`,
   * `'80%'`, `'60%'` for flex-driven widths.
   */
  width: number | string;

  /** Height of the skeleton block in logical pixels. */
  height: number;

  /**
   * Border radius of the block in logical pixels.
   * @default radii.sm — 6px (matches most text-line skeletons)
   */
  radius?: number;

  /** Additional styles applied to the outer container View. */
  style?: ViewStyle;
}

export interface SkeletonGroupProps {
  /** One or more Skeleton elements to stack vertically. */
  children: React.ReactNode;

  /**
   * Vertical gap between children in logical pixels.
   * @default spacing.sm — 8px (tight, dense loading layouts)
   */
  gap?: number;

  /** Additional styles applied to the wrapper View. */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — SKELETON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Skeleton
 *
 * Single loading placeholder block with a left-to-right shimmer sweep.
 *
 * @example
 * // Fixed-width text line skeleton
 * <Skeleton width={200} height={14} />
 *
 * @example
 * // Full-width avatar + text row
 * <View style={{ flexDirection: 'row', gap: 12 }}>
 *   <Skeleton width={40} height={40} radius={20} />   // avatar circle
 *   <View style={{ flex: 1, gap: 6 }}>
 *     <Skeleton width="70%" height={14} />             // name line
 *     <Skeleton width="50%" height={12} />             // subtitle line
 *   </View>
 * </View>
 *
 * @example
 * // Message bubble skeleton (right-aligned own message)
 * <Skeleton width="55%" height={48} radius={radii.lg} style={{ alignSelf: 'flex-end' }} />
 */
const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  radius = radii.sm,
  style,
}) => {
  const reducedMotion = useReducedMotion();

  // ── Measured container width ─────────────────────────────────────────────
  // We need the actual rendered px width to calculate the gradient translateX.
  // `width` can be a % string, so onLayout is the only reliable source.
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0) {
      setContainerWidth(measured);
    }
  }, []);

  // ── Shimmer animation ────────────────────────────────────────────────────
  // A single value travels 0 → 1. We interpolate it into a translateX that
  // moves the gradient from fully off-screen left to fully off-screen right.
  //
  // Gradient layout:
  //   width:  containerWidth × 3
  //   left:   -containerWidth          (starts 1× off to the left)
  //
  // translateX journey:
  //   0    → gradient left edge at -containerWidth  (hidden, left)
  //   1    → gradient left edge at +containerWidth  (hidden, right)
  //          (traveled 2× containerWidth — full sweep)
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion || containerWidth === 0) {
      // Static cream block — no shimmer
      progress.setValue(0);
      return;
    }

    // Reset before each start so runtime reduceMotion toggles work cleanly
    progress.setValue(0);

    const duration = getEffectiveDuration(SHIMMER_DURATION, reducedMotion);

    const shimmer = Animated.loop(
      Animated.timing(progress, {
        toValue:         1,
        duration,
        easing:          Easing.linear,   // linear sweep — consistent speed across full width
        useNativeDriver: true,
      }),
    );

    shimmer.start();

    return () => {
      shimmer.stop();
      progress.setValue(0);
    };
  }, [reducedMotion, containerWidth, progress]);

  // ── translateX interpolation ─────────────────────────────────────────────
  // Geometry (W = containerWidth, gradient width = 3W):
  //
  //   left = -2W  →  gradient initially spans [-2W … +1W]
  //                  peak (at 1.5W into gradient) = -2W + 1.5W = -0.5W  ← off-screen ✓
  //
  //   translateX travels 0 → 3W:
  //   At end: gradient spans [+1W … +4W]
  //           peak = -2W + 1.5W + 3W = +2.5W  ← off-screen right ✓
  //
  // This ensures the highlight ENTERS fully from off-screen left and EXITS
  // fully off-screen right — no flash at frame 0, no clipped tail at frame N.
  const gradientWidth = containerWidth * GRADIENT_WIDTH_MULTIPLIER;  // 3W
  const sweepDistance = containerWidth * 3;   // full 3W travel

  const translateX = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, sweepDistance],
    extrapolate: 'clamp',
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {/*
       * The shimmer gradient is only rendered after layout — before that,
       * the container shows the plain base color (colors.bg.skeleton) via
       * its backgroundColor, which is seamless.
       */}
      {!reducedMotion && containerWidth > 0 && (
        <Animated.View
          style={[
            styles.shimmerTrack,
            {
              width:     gradientWidth,
              height,
              left:      -containerWidth * 2,   // start 2× off-screen left — peak enters clean
              transform: [{ translateX }],
            },
          ]}
        >
          <LinearGradient
            colors={SHIMMER_COLORS}
            locations={SHIMMER_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — SKELETON GROUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SkeletonGroup
 *
 * Vertical stack wrapper that adds uniform spacing between Skeleton children.
 * Keeps loading layout consistent without manually adding marginBottom.
 *
 * @example
 * // Transaction row loading state
 * <SkeletonGroup gap={12}>
 *   <Skeleton width="100%" height={64} radius={radii.md} />
 *   <Skeleton width="100%" height={64} radius={radii.md} />
 *   <Skeleton width="100%" height={64} radius={radii.md} />
 * </SkeletonGroup>
 *
 * @example
 * // Discover feed card loading state
 * <SkeletonGroup gap={spacing.base}>
 *   <Skeleton width="100%" height={144} radius={radii.lg} />
 *   <Skeleton width="100%" height={144} radius={radii.lg} />
 * </SkeletonGroup>
 */
const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  children,
  gap = spacing.sm,
  style,
}) => {
  const count = React.Children.count(children);

  return (
    <View style={[styles.group, style]}>
      {React.Children.map(children, (child, index) => {
        const isLast = index === count - 1;
        return (
          <View style={isLast ? undefined : { marginBottom: gap }}>
            {child}
          </View>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.skeleton,   // cream[200] #F7ECD0 — base warm ivory
    overflow:        'hidden',             // clips the sweeping gradient
  },
  shimmerTrack: {
    position: 'absolute',
    top:      0,
    // `left` and `width` set inline; `transform` is animated
  },
  group: {
    // No flex or padding — callers own their layout context
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORTS
// React.memo on both — neither needs to re-render unless props change
// ─────────────────────────────────────────────────────────────────────────────

const MemoSkeleton      = React.memo(Skeleton);
const MemoSkeletonGroup = React.memo(SkeletonGroup);

export { MemoSkeleton as Skeleton, MemoSkeletonGroup as SkeletonGroup };
export default MemoSkeleton;

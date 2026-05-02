/**
 * Skeleton — components/atoms/Skeleton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: final · P1
 *
 * Base shimmer block. Building block for ALL loading states in the app.
 *
 * Shimmer strategy
 * ────────────────
 *   • Reanimated 3 (react-native-reanimated) — animation runs entirely on the
 *     UI thread; zero JS-thread jank even during heavy Firestore writes.
 *   • Container width measured via onLayout so shimmer sweeps precisely from
 *     off-screen left → off-screen right regardless of flex/percent widths.
 *   • 5-stop gradient: base → shoulder → white peak → shoulder → base.
 *     Produces a smooth bell-curve highlight instead of a hard-edged slash.
 *   • Colors: cream[200] #F7ECD0 → blended shoulder → white → blended → cream[200]
 *
 * Blueprint animation table
 * ─────────────────────────
 *   animation.duration.skeleton = 1200ms  (§ 5.N pulseDot: 1200ms — matched)
 *   Reduced Motion → static cream rectangle, shimmer loop stopped
 *
 * Reduced-motion
 * ──────────────
 *   Reads useReducedMotion() from @/constants/animations (already subscribed to
 *   system AccessibilityInfo changes — no duplication needed here).
 *   iOS  : UIAccessibility.isReduceMotionEnabled
 *   Android: Settings.Global.TRANSITION_ANIMATION_SCALE
 *
 * Sizing
 * ──────
 *   width  — pixels or percent string ('60%') — resolved against parent
 *   height — always logical pixels
 *
 * Color
 * ─────
 *   Default baseColor = colors.bg.skeleton (cream[200] · #F7ECD0)
 *   Bubble shells     = colors.bg.subtle   (cream[50]  · #FEFAF1 — lighter
 *   so the line bones inside pop against the shell)
 *
 * Exports
 * ───────
 *   Skeleton        (default + named) — single loading block
 *   SkeletonGroup   (named)           — vertical stack wrapper with uniform gap
 *
 * Re-used by: SkeletonBubble · HeatScoreSkeleton · AvatarSkeleton · PickerSkeleton
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { animation, colors, radii, spacing } from '@/constants/colors';
import { useReducedMotion } from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — ANIMATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shimmer duration from Blueprint § animation.duration.skeleton = 1200ms.
 * Matches pulseDot duration for perceptual rhythm consistency.
 */
const SHIMMER_DURATION_MS: number = animation.duration.skeleton; // 1200

/**
 * The shimmer gradient renders at this multiple of the container's measured
 * pixel width. Must be wide enough that the highlight never clips at either
 * edge during the full left-to-right sweep.
 *
 * Layout geometry (W = containerWidth):
 *   Gradient width  = 3W   (GRADIENT_WIDTH_MULTIPLIER)
 *   Initial left    = -2W  → gradient spans [-2W … +W]  (peak off-screen left ✓)
 *   translateX end  = +3W  → gradient spans [+W … +4W]  (peak off-screen right ✓)
 *
 * This guarantees the shimmer ENTERS from fully off-screen and EXITS fully
 * off-screen — no flash at frame 0, no clipped tail at frame N.
 */
const GRADIENT_WIDTH_MULTIPLIER = 3 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — GRADIENT HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linearly blend a hex color toward pure white by `factor` (0–1).
 * Produces the smooth shoulder blends in the shimmer bell-curve.
 *
 * @param hex    6-digit hex color with or without '#'
 * @param factor 0 = source unchanged · 1 = pure white
 */
function blendToWhite(hex: string, factor: number): string {
  const n  = parseInt(hex.replace('#', ''), 16);
  const r  = (n >> 16) & 0xff;
  const g  = (n >> 8)  & 0xff;
  const b  =  n        & 0xff;
  const rr = Math.round(r + (255 - r) * factor);
  const gg = Math.round(g + (255 - g) * factor);
  const bb = Math.round(b + (255 - b) * factor);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

/**
 * 5-stop shimmer gradient:  base · shoulder · white peak · shoulder · base
 * Built at module init — no per-render allocation.
 *
 * colors.bg.skeleton        = cream[200]  #F7ECD0  (at-rest fill)
 * colors.bg.skeletonShimmer = white       #FFFFFF  (peak highlight)
 */
const SHIMMER_COLORS: readonly [string, string, string, string, string] = [
  colors.bg.skeleton,                        // [0.0] far left  — base
  blendToWhite(colors.bg.skeleton, 0.4),     // [0.3] shoulder  — 40% toward white
  colors.bg.skeletonShimmer,                 // [0.5] center    — full white peak
  blendToWhite(colors.bg.skeleton, 0.4),     // [0.7] shoulder  — 40% toward white
  colors.bg.skeleton,                        // [1.0] far right — base
] as const;

const SHIMMER_LOCATIONS: readonly [number, number, number, number, number] = [
  0, 0.3, 0.5, 0.7, 1,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface SkeletonProps {
  /**
   * Width of the skeleton block.
   * • number → logical pixels (fixed)
   * • string → CSS percent, e.g. '60%' (resolved against parent content width)
   */
  width: number | `${number}%`;

  /**
   * Height of the skeleton block in logical pixels.
   * Text line bones: 12. Timestamps: 11. Avatars: same as width (circle).
   */
  height: number;

  /**
   * Border radius in logical pixels.
   * • Text line bones : radii.xs = 4
   * • Bubble shell    : radii.lg = 16
   * • Avatar circle   : half of the size (e.g. 18 for 36×36)
   * @default radii.xs — 4px
   */
  radius?: number;

  /**
   * Base fill color.
   * • Default (lines, avatar) : colors.bg.skeleton  — cream[200] #F7ECD0
   * • Bubble shell containers : colors.bg.subtle    — cream[50]  #FFF9EC
   *
   * Shell is lighter → line bones inside it are visible (darker cream[200]).
   */
  baseColor?: string;

  /** Additional styles applied to the outer container View. */
  style?: ViewStyle;

  testID?: string;
}

export interface SkeletonGroupProps {
  /** One or more Skeleton elements to stack vertically. */
  children: React.ReactNode;

  /**
   * Vertical gap between children in logical pixels.
   * @default spacing.sm — 8px
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
 * Rectangular or circular shimmer placeholder. Use wherever a UI element is
 * loading and its final shape is known in advance.
 *
 * @example
 * // Text bone — 2 lines
 * <Skeleton width="80%" height={12} radius={radii.xs} />
 * <Skeleton width="55%" height={12} radius={radii.xs} style={{ marginTop: 8 }} />
 *
 * @example
 * // Circular avatar
 * <Skeleton width={36} height={36} radius={18} />
 *
 * @example
 * // Bubble shell (lighter bg so inner lines contrast)
 * <Skeleton
 *   width="60%"
 *   height={56}
 *   radius={radii.lg}
 *   baseColor={colors.bg.subtle}
 * />
 *
 * @example
 * // Heat Score pill
 * <Skeleton width={60} height={22} radius={radii.xl} />
 */
const SkeletonBase: React.FC<SkeletonProps> = ({
  width,
  height,
  radius    = radii.xs,
  baseColor,
  style,
  testID,
}) => {
  const fillColor    = baseColor ?? colors.bg.skeleton;
  const reducedMotion = useReducedMotion();

  // ── Container width measurement ───────────────────────────────────────────
  // Required to compute exact translateX sweep distance.
  // `width` can be a percent string, so onLayout is the only reliable source.
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0) setContainerWidth(measured);
  }, []);

  // ── Shimmer animation (Reanimated 3 — UI thread) ─────────────────────────
  // Shared value drives translateX of the gradient track.
  // Value range: 0 → 3W (one full sweep across the 3× wide gradient).
  //
  // Initial gradient position: left = -2W
  //   At progress 0 (translateX = 0)  : gradient spans [-2W …  +W]  — peak hidden left  ✓
  //   At progress 1 (translateX = +3W): gradient spans [+W  … +4W]  — peak hidden right ✓
  const translateX = useSharedValue<number>(0);

  // Start / stop shimmer based on reduced-motion setting and measured width
  React.useEffect(() => {
    if (reducedMotion || containerWidth === 0) {
      cancelAnimation(translateX);
      translateX.value = 0;
      return;
    }

    const sweepDistance = containerWidth * GRADIENT_WIDTH_MULTIPLIER; // 3W

    translateX.value = withRepeat(
      withTiming(sweepDistance, {
        duration: SHIMMER_DURATION_MS,
        easing:   Easing.linear, // constant velocity → natural sweep
      }),
      -1,    // repeat infinitely
      false, // no reverse — restart from left each cycle
    );

    return () => {
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [reducedMotion, containerWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // ── Derived gradient geometry ─────────────────────────────────────────────
  const gradientWidth = containerWidth * GRADIENT_WIDTH_MULTIPLIER; // 3W

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius:    radius,
          backgroundColor: fillColor,
        },
        style,
      ]}
    >
      {/*
       * Shimmer track — rendered only after layout (containerWidth > 0) and
       * only when animation is active. Before layout, the plain baseColor
       * backgroundColor of the container is shown seamlessly.
       */}
      {!reducedMotion && containerWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmerTrack,
            {
              width:  gradientWidth,
              height,
              // Start 2W to the left so the peak enters clean from off-screen
              left:   -(containerWidth * 2),
            },
            animatedStyle,
          ]}
        >
          <LinearGradient
            /**
             * Blueprint shimmer: cream[200] → white → cream[200]
             * 5-stop bell-curve: smooth shoulder transitions, no hard edges.
             */
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
 * Eliminates manual marginBottom scattered across loading layouts.
 *
 * @example
 * // Transaction row loading state
 * <SkeletonGroup gap={spacing.md}>
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
const SkeletonGroupBase: React.FC<SkeletonGroupProps> = ({
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
    // overflow MUST be hidden — clips the shimmer band to the skeleton's bounds
    overflow: 'hidden',
  },
  shimmerTrack: {
    position: 'absolute',
    top:      0,
    // `left`, `width`, and `transform` are all set inline / via Reanimated
  },
  group: {
    // No flex or padding — callers own their layout context
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORTS
// React.memo on both — props are primitives or stable refs; shallow compare
// is sufficient to prevent unnecessary re-renders.
// ─────────────────────────────────────────────────────────────────────────────

const Skeleton      = React.memo(SkeletonBase);
const SkeletonGroup = React.memo(SkeletonGroupBase);

export { Skeleton, SkeletonGroup };
export default Skeleton;

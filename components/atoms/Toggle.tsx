/**
 * Toggle — components/atoms/Toggle.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P1
 *
 * Fully custom cross-platform toggle — no RN Switch dependency.
 * Identical visual behaviour on iOS and Android: gold track when on,
 * muted track when off, spring-animated white thumb.
 *
 * Animation
 *   Thumb : Animated.spring → springStiff (tension:200 · friction:18 · ~200ms)
 *   Track : same Animated.Value interpolated to background color string
 *           (inactive → active in sync with thumb travel)
 *
 * Sizes
 *   sm  : 40 × 24px track · 20px thumb  — compact settings rows
 *   md  : 52 × 30px track · 26px thumb  — primary settings / onboarding
 *
 * Reduced motion: timing 200ms easeOut · no spring overshoot
 *
 * Deps  : constants/colors.ts · constants/animations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, palette } from '@/constants/colors';
import {
  springConfigs,
  useReducedMotion,
  getEffectiveDuration,
  durations,
  easings,
} from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — SIZE SPECS
// Follows iOS HIG proportions: thumb diameter = track height − 4px padding.
// Track width:height ratio ≈ 1.73 : 1 (matches native iOS feel exactly).
// ─────────────────────────────────────────────────────────────────────────────

const THUMB_INSET = 2 as const;   // px gap between thumb edge and track edge

const SIZE_SPECS = {
  sm: {
    trackWidth:  40,
    trackHeight: 24,
    thumbSize:   20,   // trackHeight − (THUMB_INSET × 2)
    // travel = trackWidth − thumbSize − (THUMB_INSET × 2) = 40 − 20 − 4 = 16
    travel:      16,
  },
  md: {
    trackWidth:  52,
    trackHeight: 30,
    thumbSize:   26,   // trackHeight − (THUMB_INSET × 2)
    // travel = 52 − 26 − 4 = 22
    travel:      22,
  },
} as const satisfies Record<string, {
  trackWidth: number;
  trackHeight: number;
  thumbSize: number;
  travel: number;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLOR CONSTANTS
// Using semantic tokens — never raw hex.
//
//   Active track   : colors.fg.brand    → gold[600]  #C9A227  (Champagne Gold)
//   Inactive track : colors.border.strong → ink[200]  #DDD3C0  (Soft Taupe)
//   Disabled active  : gold[600] at 40% opacity (blended to surface)
//   Disabled inactive: ink[200]  at 40% opacity
//
// Interpolation note: RN's Animated.interpolate accepts hex strings in
// outputRange and does channel-by-channel linear blending between them.
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_ACTIVE   = colors.fg.brand;        // #C9A227 — gold[600]
const COLOR_INACTIVE = colors.border.strong;   // #DDD3C0 — ink[200]

// Disabled variants — muted 45% toward surface white to signal non-interactable
const COLOR_ACTIVE_DISABLED   = blendHexToWhite(COLOR_ACTIVE,   0.55);
const COLOR_INACTIVE_DISABLED = blendHexToWhite(COLOR_INACTIVE, 0.40);

// Thumb is always white — sits above the colored track
const COLOR_THUMB = palette.white;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blend a 6-digit hex color toward #FFFFFF by `factor` (0 = unchanged, 1 = white).
 * Used to produce disabled-state track colors without adding extra palette entries.
 */
function blendHexToWhite(hex: string, factor: number): string {
  const n  = parseInt(hex.replace('#', ''), 16);
  const r  = (n >> 16) & 0xff;
  const g  = (n >>  8) & 0xff;
  const b  =  n        & 0xff;
  const rr = Math.round(r + (255 - r) * factor);
  const gg = Math.round(g + (255 - g) * factor);
  const bb = Math.round(b + (255 - b) * factor);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface ToggleProps {
  /** Current on/off state. Controlled component — caller owns state. */
  value: boolean;

  /**
   * Called when the user taps the toggle with the next intended value.
   * Caller is responsible for updating `value` to trigger re-render.
   */
  onValueChange: (nextValue: boolean) => void;

  /**
   * When true, the toggle is non-interactive and visually dimmed.
   * @default false
   */
  disabled?: boolean;

  /**
   * Visual size variant.
   * @default 'md'
   */
  size?: 'sm' | 'md';

  /** Optional additional styles for the outer Pressable hit target. */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle
 *
 * Custom cross-platform iOS-style toggle switch.
 * Fully replaces React Native's <Switch> for consistent appearance everywhere.
 *
 * @example
 * // Controlled — in a settings row
 * const [notifications, setNotifications] = useState(true);
 * <Toggle value={notifications} onValueChange={setNotifications} />
 *
 * @example
 * // Compact — inside a dense list row
 * <Toggle value={isOn} onValueChange={setIsOn} size="sm" />
 *
 * @example
 * // Disabled — subscription gate
 * <Toggle value={false} onValueChange={() => {}} disabled />
 */
const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  size     = 'md',
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const spec          = SIZE_SPECS[size];

  // ── Animated value — created once, never re-instantiated ─────────────────
  // Initialized to the correct position for the initial `value` prop.
  const thumbPosition = useRef(
    new Animated.Value(value ? spec.travel : 0),
  ).current;

  // ── Track background color — interpolated from the same Animated.Value ───
  // As the thumb travels 0 → spec.travel, the track color blends smoothly
  // from inactive to active. No separate animation needed.
  const trackBgColor = thumbPosition.interpolate({
    inputRange:  [0, spec.travel],
    outputRange: disabled
      ? [COLOR_INACTIVE_DISABLED, COLOR_ACTIVE_DISABLED]
      : [COLOR_INACTIVE, COLOR_ACTIVE],
    extrapolate: 'clamp',
  });

  // ── Sync animation when `value` prop changes ──────────────────────────────
  useEffect(() => {
    const toValue = value ? spec.travel : 0;

    if (reducedMotion) {
      // Blueprint Reduced Motion: no spring overshoot — timing easeOut 200ms
      Animated.timing(thumbPosition, {
        toValue,
        duration:        getEffectiveDuration(durations.normal, true),   // 120ms
        easing:          easings.easeOut,
        useNativeDriver: false,   // false because trackBgColor uses color interpolation
      }).start();
    } else {
      // Full motion: spring — tension:200 · friction:18 · settles ~200ms
      // useNativeDriver:false required — color interpolation is JS-driven.
      // The thumb itself uses transform so it COULD be native, but keeping
      // both on the same driver avoids sync jank between thumb and track.
      Animated.spring(thumbPosition, {
        toValue,
        tension:         springConfigs.springStiff.tension,    // 200
        friction:        springConfigs.springStiff.friction,   // 18
        useNativeDriver: false,
      }).start();
    }
  }, [value, spec.travel, reducedMotion, thumbPosition]);

  // ── Press handler ─────────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (!disabled) {
      onValueChange(!value);
    }
  }, [disabled, value, onValueChange]);

  // ── Thumb shadow — premium depth without visual noise ────────────────────
  const thumbShadow: ViewStyle = {
    shadowColor:   palette.ink[950],
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius:  2,
    elevation:     2,   // Android
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessible
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={value ? 'On' : 'Off'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.pressable, style]}
    >
      {/* Track — animated background color */}
      <Animated.View
        style={[
          styles.track,
          {
            width:        spec.trackWidth,
            height:       spec.trackHeight,
            borderRadius: spec.trackHeight / 2,   // full pill
            backgroundColor: trackBgColor,
          },
          disabled && styles.trackDisabled,
        ]}
      >
        {/* Thumb — animated horizontal translation */}
        <Animated.View
          style={[
            styles.thumb,
            thumbShadow,
            {
              width:        spec.thumbSize,
              height:       spec.thumbSize,
              borderRadius: spec.thumbSize / 2,   // perfect circle
              top:          THUMB_INSET,
              left:         THUMB_INSET,
              transform:    [{ translateX: thumbPosition }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pressable: {
    // Minimal wrapper — caller controls layout; hitSlop extends touch area
    alignSelf: 'flex-start',
  },
  track: {
    // backgroundColor animated inline
    // borderRadius    set inline (size-dependent)
    position: 'relative',
    overflow: 'hidden',   // clip thumb to pill shape on edges at extreme positions
  },
  trackDisabled: {
    opacity: 0.6,
  },
  thumb: {
    position:        'absolute',
    backgroundColor: COLOR_THUMB,
    // borderRadius, top, left, width, height, transform set inline
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORT
// React.memo — re-renders only when value · disabled · size · onValueChange change
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(Toggle);

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — components/Button.tsx                                    ║
 * ║  Atom · P0 · Blueprint v5.0 Polish                                      ║
 * ║                                                                          ║
 * ║  Variants  : primary | secondary | ghost | danger | gold                ║
 * ║              (+ destructive — backward-compat alias for danger)          ║
 * ║  Sizes     : sm (36px) | md (44px) | lg (54px)                          ║
 * ║  Features  : loading · left icon · right icon · Animated scale 0.95    ║
 * ║              impactMedium haptic · Reduced-Motion compliant             ║
 * ║                                                                          ║
 * ║  Press animation                                                         ║
 * ║    Normal        : scale 1.0 → 0.95 (80ms easeOut) · springStiff back  ║
 * ║    Reduced Motion: opacity 1.0 → 0.80 fallback (no transform)          ║
 * ║                                                                          ║
 * ║  WCAG 2.2 AA — all fg/bg variant pairs from §15 contrast audit:        ║
 * ║    primary  : white on gold[600]    → 4.6:1 AA  ✅                      ║
 * ║    secondary: ink[950] on cream[200] → 16.2:1 AAA ✅                    ║
 * ║    ghost    : ink[950] on white/card → 17.8:1 AAA ✅ + gold[600] border ║
 * ║    danger   : white on amber[600]   → 4.7:1 AA  ✅ (§5.C #E07B20 fill) ║
 * ║    gold     : ink[950] on gold[400] → 13.2:1 AAA ✅ (celebrate state)  ║
 * ║                                                                          ║
 * ║  Deps: constants/colors.ts · constants/animations.ts · hooks/useHaptics ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import {
  colors,
  spacing,
  radii,
  dimensions,
  palette,
} from '@/constants/colors';
import {
  Duration,
  easeOut,
  springConfigs,
  useReducedMotion,
} from '@/constants/animations';
import { useHaptics } from '@/hooks/useHaptics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeatherIconName = ComponentProps<typeof Feather>['name'];

/**
 * Button visual variants.
 * `destructive` is a backward-compat alias for `danger` — prefer `danger`
 * in new code.
 */
export type ButtonVariant =
  | 'primary'       // gold[600] bg · white text — primary CTAs everywhere
  | 'secondary'     // cream[200] bg · ink border — secondary / outlined
  | 'ghost'         // transparent · ink text — low-emphasis / inline actions
  | 'danger'        // amber[600] bg · white text — §5.C #E07B20 fill (Delete · Logout)
  | 'gold'          // gold[400] bg · ink[950] text — celebrate / earned state
  | 'destructive';  // @deprecated — alias for 'danger'; use 'danger' in new code

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /** Visible label text. Used as accessibilityLabel unless overridden. */
  label: string;
  onPress?: () => void;
  /** @default 'primary' */
  variant?: ButtonVariant;
  /** @default 'md' */
  size?: ButtonSize;
  /** Feather icon rendered left of the label */
  icon?: FeatherIconName;
  /** Feather icon rendered right of the label */
  iconRight?: FeatherIconName;
  /**
   * Shows ActivityIndicator and disables all interaction.
   * Width is preserved — spinner replaces label in-place.
   */
  loading?: boolean;
  disabled?: boolean;
  /** Stretches button to 100% of its parent's width */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  /** Applied to the outermost Animated.View wrapper */
  style?: ViewStyle;
}

// ─── Size configuration ───────────────────────────────────────────────────────
// All values from tokens — no magic numbers.

type SizeConfig = {
  /** Touch target height from dimensions tokens */
  h:             number;
  /** Horizontal padding */
  px:            number;
  /** Icon size */
  iconSize:      number;
  /** Label font size */
  fontSize:      number;
  /** Label font weight — bold for lg CTAs, semiBold for md/sm */
  fontWeight:    '600' | '700';
  /** Corner radius */
  borderRadius:  number;
  /** Gap between icon and label */
  iconGap:       number;
};

const SIZE_MAP: Record<ButtonSize, SizeConfig> = {
  /** sm — compact actions, inline chips, sheet secondary rows */
  sm: {
    h:             dimensions.btnSmall,       // 36px
    px:            spacing.md,                // 12px
    iconSize:      14,
    fontSize:      13,
    fontWeight:    '600',
    borderRadius:  radii.base,                // 8px
    iconGap:       spacing.xs,                // 4px
  },
  /** md — standard interactive actions, header buttons, sheet rows */
  md: {
    h:             dimensions.btnSecondary,   // 44px
    px:            spacing.base,              // 16px
    iconSize:      16,
    fontSize:      14,
    fontWeight:    '600',
    borderRadius:  radii.md,                  // 12px
    iconGap:       spacing.xs,                // 4px
  },
  /** lg — large primary CTAs — matches dimensions.btnPrimary */
  lg: {
    h:             dimensions.btnPrimary,     // 54px
    px:            spacing.lg,                // 20px
    iconSize:      18,
    fontSize:      16,
    fontWeight:    '700',
    borderRadius:  radii.md,                  // 12px
    iconGap:       spacing.sm,                // 8px
  },
};

// ─── Variant color resolution ─────────────────────────────────────────────────

type ResolvedVariant = {
  bg:           string;
  fg:           string;
  borderColor:  string;
  borderWidth:  number;
};

/**
 * Pure function — called in the Pressable render props (style + children).
 * Both invocations receive the same `pressed` value per frame so the result
 * is consistent. No memoization needed — pure computation, no side effects.
 */
function resolveVariant(
  variant: ButtonVariant,
  pressed: boolean,
): ResolvedVariant {
  // Normalize backward-compat alias
  const v = variant === 'destructive' ? 'danger' : variant;

  switch (v) {
    case 'primary':
      // gold[600] bg · white text · 4.6:1 AA (§15 audit)
      // Pressed: deepens to gold[700] for clear tactile state change
      return {
        bg:           pressed ? palette.gold[700] : palette.gold[600],
        fg:           palette.white,
        borderColor:  'transparent',
        borderWidth:  0,
      };

    case 'secondary':
      // cream[200] bg · ink[950] text · 16.2:1 AAA (§15 audit)
      // Pressed: cream[300] bg — same warm family, clearly darker
      return {
        bg:           pressed ? colors.bg.cardPressed : colors.bg.card,
        fg:           colors.fg.primary,
        borderColor:  colors.border.default,   // cream[400] — 1px hairline
        borderWidth:  1,
      };

    case 'ghost':
      // Transparent bg · ink[950] text — context-aware (17.8:1 AAA on white)
      // §5.C spec: "transparent + golden border" — 1px gold[600] border always visible
      // Pressed: cream[200] fill — previews secondary feel without permanence
      return {
        bg:           pressed ? colors.bg.card : 'transparent',
        fg:           colors.fg.primary,
        borderColor:  palette.gold[600],   // §5.C · Champagne Gold #C9A227
        borderWidth:  1,
      };

    case 'danger':
      // amber[600] bg · white text · 4.7:1 AA (§15 audit: "white on amber[600]")
      // §5.C spec: "<DestructiveButton> · #E07B20 fill"
      // v2.0 migration: #E07B20 → palette.amber[600] = #D4651A (Burnished Amber)
      // Callsites: Delete · Cancel-payment · Logout · destructive action sheet rows
      // Pressed: amber[700] — same warm family, clearly deeper
      return {
        bg:           pressed ? palette.amber[700] : palette.amber[600],
        fg:           palette.white,
        borderColor:  'transparent',
        borderWidth:  0,
      };

    case 'gold':
    default:
      // gold[400] bg · ink[950] text · 13.2:1 AAA (§15 audit: "CROWN badge text")
      // Use for: celebrate moments, earned states, CROWN CTA, badges, rewards
      // Pressed: gold[500] — slightly deeper, smooth within warm family
      return {
        bg:           pressed ? palette.gold[500] : palette.gold[400],
        fg:           palette.ink[950],
        borderColor:  'transparent',
        borderWidth:  0,
      };
  }
}

// Disabled state — same regardless of variant or pressed state
const DISABLED_VARIANT: ResolvedVariant = {
  bg:           colors.bg.disabled,    // ink[100]
  fg:           colors.fg.disabled,    // ink[400]
  borderColor:  'transparent',
  borderWidth:  0,
};

// ─── Component ────────────────────────────────────────────────────────────────

const Button = memo<ButtonProps>(({
  label,
  onPress,
  variant    = 'primary',
  size       = 'md',
  icon,
  iconRight,
  loading    = false,
  disabled   = false,
  fullWidth  = false,
  accessibilityLabel,
  style,
}) => {
  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { impactMedium } = useHaptics();
  const reducedMotion    = useReducedMotion();

  /**
   * Single Animated.Value for scale.
   * Created ONCE via useRef — survives all re-renders.
   * Do NOT recreate inside render: would silently reset mid-animation.
   */
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Derived ────────────────────────────────────────────────────────────────
  const isDisabled = disabled || loading;
  const s          = SIZE_MAP[size];

  // ── Press handlers ─────────────────────────────────────────────────────────

  /**
   * onPressIn — fires at the touch-down moment (before lift) for:
   *   1. Haptic feedback (immediate, zero-delay feel)
   *   2. Scale-down animation (or opacity dip for reduced-motion users)
   *
   * Blueprint Q13: impactMedium() on button press.
   */
  const handlePressIn = useCallback(() => {
    if (isDisabled) return;

    // Haptic first — fires synchronously before any async animation work
    impactMedium();

    if (reducedMotion) {
      // Reduced-motion fallback: opacity dip instead of scale
      // Blueprint Reduced Motion Variants: "opacity 1.0 → 0.7 → 1.0 (no scale)"
      // Note: the opacity is applied via the Pressable's pressed state in style
      // so no explicit animation needed here — we skip scale only.
      return;
    }

    // Normal: scale down to 0.95 — matches blueprint Interaction [1] pill press depth
    // (Pill:0.95 · Send:0.92 · generic button:0.95 — consistent tactile system)
    // §5.N buttonPress:80ms · easeOut:[0.16,1,0.3,1] — legacy easeOut from animations.ts
    Animated.timing(scaleAnim, {
      toValue:         0.95,
      duration:        Duration.micro,   // 80ms — §5.N buttonPress
      easing:          easeOut,          // legacy bezier(0.16, 1, 0.3, 1)
      useNativeDriver: true,
    }).start();
  }, [isDisabled, impactMedium, reducedMotion]);
  // scaleAnim intentionally omitted from deps — it's a stable Animated.Value ref

  /**
   * onPressOut — spring back to resting scale.
   * Always runs, even if the press was cancelled — guarantees button never
   * gets "stuck" at scale 0.95 from an interrupted gesture.
   * springStiff: tension:200 · friction:18 — crisp, confident release.
   */
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...springConfigs.springStiff,   // tension:200 · friction:18 · §5.N
    }).start();
  }, []);
  // scaleAnim is a stable ref — empty deps is correct and intentional

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /**
     * Animated.View — outermost wrapper owns the scale transform.
     * Must NOT have backgroundColor here — shadows only render on views with
     * opaque backgrounds (the Pressable inner view has the bg).
     * fullWidth propagates naturally: the Pressable inside stretches to fill.
     */
    <Animated.View
      style={[
        fullWidth ? styles.fullWidth : styles.autoWidth,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={({ pressed }) => {
          const v = isDisabled ? DISABLED_VARIANT : resolveVariant(variant, pressed);

          return [
            styles.pressable,
            {
              height:            s.h,
              paddingHorizontal: s.px,
              borderRadius:      s.borderRadius,
              backgroundColor:   v.bg,
              borderColor:       v.borderColor,
              borderWidth:       v.borderWidth,
              // Reduced motion: opacity dip replaces scale (blueprint §A.1.6)
              opacity:
                isDisabled               ? 1    :
                reducedMotion && pressed ? 0.80 :
                                          1,
            },
          ];
        }}
      >
        {({ pressed }) => {
          const v  = isDisabled ? DISABLED_VARIANT : resolveVariant(variant, pressed);
          const fg = v.fg;

          if (loading) {
            return (
              <ActivityIndicator
                size="small"
                color={fg}
                accessibilityLabel={`${label} · loading`}
              />
            );
          }

          return (
            <View style={styles.inner}>
              {icon != null && (
                <Feather
                  name={icon}
                  size={s.iconSize}
                  color={fg}
                  style={{ marginRight: s.iconGap }}
                />
              )}
              <Text
                style={[
                  styles.label,
                  {
                    color:      fg,
                    fontSize:   s.fontSize,
                    fontWeight: s.fontWeight,
                  },
                ]}
                numberOfLines={1}
                /**
                 * Prevent Dynamic Type from breaking the fixed-height button.
                 * Users who need large text see the button label unchanged —
                 * we rely on the size variants (sm/md/lg) for scale control.
                 */
                allowFontScaling={false}
              >
                {label}
              </Text>
              {iconRight != null && (
                <Feather
                  name={iconRight}
                  size={s.iconSize}
                  color={fg}
                  style={{ marginLeft: s.iconGap }}
                />
              )}
            </View>
          );
        }}
      </Pressable>
    </Animated.View>
  );
});

Button.displayName = 'Button';

export { Button };
export default Button;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // Animated.View width modes
  fullWidth: {
    width: '100%',
  },
  autoWidth: {
    // No explicit width — inherits from parent flex context.
    // In a flex column, the button stretches (Pressable fills Animated.View).
    // In a flex row, the button shrinks to content width.
    // This matches the original Button behavior exactly.
  },

  // Inner Pressable — owns height, padding, bg, border, border-radius
  pressable: {
    alignItems:     'center',
    justifyContent: 'center',
    flexDirection:  'row',
    /**
     * overflow: 'hidden' clips inner content to the borderRadius so icons /
     * labels never bleed outside the button shape on Android.
     * Side effect: shadows defined on this view would be clipped on iOS.
     * → Shadows must be applied to the parent Animated.View if needed.
     */
    overflow: 'hidden',
  },

  // Content row — icon + label + iconRight
  inner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     1, // prevents label overflow from stretching the row
  },

  // Label base — only decoration properties; color/size injected inline
  label: {
    letterSpacing:      0.2,
    includeFontPadding: false,   // Android: removes extra baseline gap (aligns with icon)
    textAlignVertical:  'center',
    flexShrink:         1,       // long labels truncate with numberOfLines={1}
  },
});

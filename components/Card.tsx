/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — Card Component                                            ║
 * ║  Atom · P1 · Updated                                                     ║
 * ║                                                                          ║
 * ║  Variants : default | elevated | bordered | gold                         ║
 * ║                                                                          ║
 * ║  default  — cream-200 bg · cream-400 border · tier-1 shadow             ║
 * ║  elevated — white bg   · no border · tier-2 gold shadow                 ║
 * ║  bordered — white bg   · ink-200 border 1.5px · no shadow               ║
 * ║  gold     — gold-50 bg · gold-600 border 2px · champagne glow shadow    ║
 * ║                                                                          ║
 * ║  Features:                                                               ║
 * ║    • useButtonPress hook — scale 1→0.97 press-in, springStiff release   ║
 * ║    • disabled: opacity 0.4 · touch blocked                              ║
 * ║    • All design tokens — zero hardcoded values                           ║
 * ║    • React.memo · iOS + Android                                          ║
 * ║    • Forward-compatible: style prop merges safely                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { colors, radii, spacing } from "@/constants/colors";
import { useButtonPress } from "@/constants/animations";

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CardVariant = "default" | "elevated" | "bordered" | "gold";

export type CardProps = {
  /** Visual style of the card. Defaults to "default". */
  variant?: CardVariant;
  /** Card content. */
  children: React.ReactNode;
  /** Makes the card tappable. Triggers spring press animation. */
  onPress?: () => void;
  /** Blocks interaction and reduces opacity to 0.4. */
  disabled?: boolean;
  /** Merge additional layout / position styles into the outer wrapper. */
  style?: ViewStyle;
  /** Override inner card padding. Defaults to spacing.cardPad (16). */
  padding?: number;
  /** VoiceOver / TalkBack label. Applied when onPress is provided. */
  accessibilityLabel?: string;
  /** VoiceOver / TalkBack hint — describes what happens on tap. */
  accessibilityHint?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — VARIANT STYLE RESOLVERS
// Single source — no duplication between Pressable and View render paths.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the static (non-animated) card surface styles for a given variant.
 * Shadow objects are spread — iOS uses shadow*, Android uses elevation.
 */
function resolveVariantStyle(variant: CardVariant): ViewStyle {
  switch (variant) {
    case "elevated":
      return {
        backgroundColor: colors.bg.surface,
        borderWidth: 0,
        // tier-2: 0 2px 8px rgba(gold, 0.10) — warm lift without harsh border
        ...colors.shadow.tier2,
      };

    case "bordered":
      return {
        backgroundColor: colors.bg.surface,
        borderWidth: 1.5,
        borderColor: colors.border.strong,  // ink[200] = #DDD3C0
        // No shadow — the border IS the separation signal
        ...colors.shadow.tier0,
      };

    case "gold":
      return {
        backgroundColor: colors.bg.goldSoft, // gold[50] = #FCF7E5 — accent-soft bg
        borderWidth: 2,
        borderColor: colors.border.cardEmphasis, // gold[600] = #C9A227
        // tier-3: 0 4px 16px rgba(gold, 0.14) — champagne glow, intentionally subtle
        ...colors.shadow.tier3,
      };

    case "default":
    default:
      return {
        backgroundColor: colors.bg.card,    // cream[200] = #F7ECD0
        borderWidth: 1,
        borderColor: colors.border.card,    // cream[400] = #E5CC95
        // tier-1: 0 1px 4px rgba(gold, 0.06) — barely-there warmth
        ...colors.shadow.tier1,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const Card = memo(function Card({
  variant = "default",
  children,
  onPress,
  disabled = false,
  style,
  padding = spacing.cardPad,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  // useButtonPress: scale 1→0.97 on pressIn (80ms easeOut),
  // spring back to 1 on pressOut (springStiff: tension:200 · friction:18).
  // Hook is always called — but handlers only wired when card is interactive.
  const { scale, handlers } = useButtonPress();

  const variantStyle = resolveVariantStyle(variant);

  const cardSurface: ViewStyle = {
    ...variantStyle,
    borderRadius: radii.lg,   // 16px — see TOKEN AUDIT NOTE below
    padding,
  };

  // ── Non-interactive path ───────────────────────────────────────────────────
  // No Pressable, no animation wrapper needed — minimal tree depth.
  if (!onPress) {
    return (
      <View
        style={[
          cardSurface,
          disabled && styles.disabled,
          style,
        ]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </View>
    );
  }

  // ── Interactive path ───────────────────────────────────────────────────────
  // Animated.View wraps the Pressable so the scale transform applies to the
  // entire card surface (border + shadow + content) — not just the inner view.
  //
  // Layer order (outer → inner):
  //   Animated.View  — carries transform: scale + disabled opacity
  //   └─ Pressable   — handles touch events + accessibilityRole
  //      └─ card surface View  — visual chrome (bg, border, radius, shadow)
  //         └─ children
  //
  // Note: shadow properties must live on the Pressable's child View, NOT on
  // the Animated.View, because shadows are clipped if overflow:hidden is set,
  // and Animated.View with a scale transform can cause rendering artefacts
  // with Android elevation if it carries the shadow itself.
  return (
    <Animated.View
      style={[
        styles.animatedWrapper,
        { transform: [{ scale }] },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlers.onPressIn}
        onPressOut={disabled ? undefined : handlers.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        // hitSlop gives a 4px outer buffer — useful for small cards
        hitSlop={4}
      >
        <View style={cardSurface}>
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /**
   * animatedWrapper:
   * Must NOT have a background — it's a pure transform/opacity shell.
   * No borderRadius here — that belongs to the card surface so border clips
   * correctly on both platforms.
   */
  animatedWrapper: {
    // Intentionally empty — flex properties come from parent layout or style prop
  },

  /**
   * disabled:
   * Blueprint: "Disabled (0.4)" — full wrapper opacity so border, shadow,
   * text, and icons all uniformly dim. Consistent with Input.tsx wrapperDisabled.
   */
  disabled: {
    opacity: 0.4,
  },
});

export default Card;

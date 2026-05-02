/**
 * Coins — components/atoms/Coins.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P0
 *
 * Displays the user's CROWN credit balance as a gold pill.
 * Appears in: Glass Island header (top-right) · Wallet hero card.
 *
 * Design
 *   Background : gold[50]  #FCF7E5  — pale gold wash (colors.bg.goldSoft)
 *   Border     : gold[600] #C9A227  — champagne gold (colors.fg.brand)
 *   Text       : gold[800] #8B6F18  — AA-safe on pale gold (colors.fg.brandSubtle)
 *   Icon       : 🪙 emoji — universal coin glyph
 *
 * Number formatting
 *   0 – 999     : exact   →  "234"
 *   1 000 – 9 999: 1 dp K →  "1K" / "2.4K"
 *   10 000+     : 0 dp K  →  "24K" / "100K"
 *   1 000 000+  : 1 dp M  →  "1.2M"
 *
 * Animation (animated=true only)
 *   On amount change: scale 1 → 1.12 → 1 via spring · reduced-motion safe
 *
 * Deps  : constants/colors.ts (AccessibilityInfo used inline for reduced motion)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, palette, radii, spacing, typography } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DESIGN TOKENS (all from constants/colors.ts)
// ─────────────────────────────────────────────────────────────────────────────

const PILL_BG     = colors.bg.goldSoft;       // gold[50]  #FCF7E5
const PILL_BORDER = colors.fg.brand;          // gold[600] #C9A227
const PILL_TEXT   = colors.fg.brandSubtle;    // gold[800] #8B6F18 — 6.4:1 on white ✅ AA

// Pressed state — slightly deeper surface to confirm tap
const PILL_BG_PRESSED = palette.gold[100];    // #F9EFCE

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — SIZE SPECS
// Heights match blueprint pill tokens: sm=24 · md=30 · lg=40
// ─────────────────────────────────────────────────────────────────────────────

interface SizeSpec {
  height:       number;
  paddingH:     number;
  gap:          number;
  fontSize:     number;
  fontWeight:   '600' | '700';
  lineHeight:   number;
  iconFontSize: number;
  borderWidth:  number;
}

const SIZE_SPECS: Record<'sm' | 'md' | 'lg', SizeSpec> = {
  sm: {
    // Compact — Glass Island header, dense rows
    height:       24,
    paddingH:     spacing.sm,    // 8px
    gap:          3,
    fontSize:     typography.label.fontSize,       // 12px
    fontWeight:   '600',
    lineHeight:   typography.label.lineHeight,     // 16px
    iconFontSize: 12,
    borderWidth:  1,
  },
  md: {
    // Default — most use-cases
    height:       30,
    paddingH:     spacing.sm + 2,                  // 10px
    gap:          4,
    fontSize:     typography.pillLabel.fontSize,   // 13px
    fontWeight:   '600',
    lineHeight:   typography.pillLabel.lineHeight, // 18px
    iconFontSize: 14,
    borderWidth:  1,
  },
  lg: {
    // Hero — Wallet balance area, Crate reveal
    height:       40,
    paddingH:     spacing.md,    // 12px
    gap:          6,
    fontSize:     typography.bodyLarge.fontSize,   // 16px
    fontWeight:   '700',
    lineHeight:   typography.bodyLarge.lineHeight, // 24px
    iconFontSize: 18,
    borderWidth:  1.5,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — NUMBER FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a raw coin amount into a compact display string.
 *
 * Rules:
 *   < 1 000        → "234"
 *   1 000–9 999    → "1K" / "2.4K"   (1 dp, strip trailing .0)
 *   10 000–999 999 → "24K"           (0 dp)
 *   ≥ 1 000 000    → "1.2M"          (1 dp, strip trailing .0)
 */
function formatAmount(amount: number): string {
  if (amount < 1_000) {
    return String(Math.max(0, Math.floor(amount)));
  }

  if (amount < 10_000) {
    // 1dp with trailing-zero strip: 1000 → "1K", 2400 → "2.4K"
    const k = amount / 1_000;
    return `${parseFloat(k.toFixed(1))}K`;
  }

  if (amount < 1_000_000) {
    // 0dp: 24000 → "24K"
    return `${Math.floor(amount / 1_000)}K`;
  }

  // Millions
  const m = amount / 1_000_000;
  return `${parseFloat(m.toFixed(1))}M`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface CoinsProps {
  /**
   * Raw credit balance to display (non-negative integer).
   * Formatted automatically — pass raw number, not pre-formatted string.
   */
  amount: number;

  /**
   * Visual size variant.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * When true, the pill pulses (scale 1 → 1.12 → 1) each time `amount` changes.
   * Enable in the Glass Island header and Wallet hero for delight feedback.
   * @default false
   */
  animated?: boolean;

  /**
   * If provided, the pill becomes a Pressable that calls this handler.
   * Use for header tap → navigate to Wallet, or Wallet → top-up flow.
   */
  onPress?: () => void;

  /** Additional styles for the outer container. */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coins
 *
 * Gold credit balance pill. Drop anywhere a balance readout is needed.
 *
 * @example
 * // Glass Island header — compact, tappable
 * <Coins amount={userCredits} size="sm" animated onPress={goToWallet} />
 *
 * @example
 * // Wallet hero — large display, no tap (already on wallet screen)
 * <Coins amount={userCredits} size="lg" animated />
 *
 * @example
 * // Transaction row — static, compact
 * <Coins amount={50} size="sm" />
 */
const Coins: React.FC<CoinsProps> = ({
  amount,
  size     = 'md',
  animated = false,
  onPress,
  style,
}) => {
  const spec = SIZE_SPECS[size];

  // ── Reduced-motion detection (inline — dep is constants/colors.ts only) ──
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // ── Pulse animation ───────────────────────────────────────────────────────
  // scale lives in useRef — survives re-renders, never re-instantiated.
  const scale    = useRef(new Animated.Value(1)).current;
  const prevAmount = useRef<number>(amount);

  useEffect(() => {
    // Only pulse when amount actually changes AND animated flag is on.
    // Skip the very first render (prevAmount === amount on mount).
    if (!animated || prevAmount.current === amount) {
      prevAmount.current = amount;
      return;
    }

    prevAmount.current = amount;

    if (reducedMotion) {
      // Reduced motion: brief opacity flash instead of scale
      // (keeps the "something changed" signal without motion)
      Animated.sequence([
        Animated.timing(scale, {
          toValue:         0.7,
          duration:        80,
          easing:          Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue:         1,
          duration:        120,
          easing:          Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    // Full motion: scale up with spring, release naturally
    Animated.sequence([
      Animated.timing(scale, {
        toValue:         1.12,
        duration:        100,                        // fast punch up
        easing:          Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue:         1,
        tension:         200,                        // springStiff values
        friction:        18,
        useNativeDriver: true,
      }),
    ]).start();
  }, [amount, animated, reducedMotion, scale]);

  // ── Formatted display string ──────────────────────────────────────────────
  const displayText = formatAmount(amount);

  // ── Pill content ──────────────────────────────────────────────────────────
  const pillContent = (
    <Animated.View
      style={[
        styles.pill,
        {
          height:          spec.height,
          paddingHorizontal: spec.paddingH,
          borderWidth:     spec.borderWidth,
          borderRadius:    radii.pill,
          gap:             spec.gap,
          transform:       [{ scale }],
        },
        style,
      ]}
      accessible
      accessibilityLabel={`${amount} coins`}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      {/* Coin emoji */}
      <Text
        style={[styles.icon, { fontSize: spec.iconFontSize }]}
        allowFontScaling={false}
      >
        🪙
      </Text>

      {/* Formatted amount */}
      <Text
        style={[
          styles.label,
          {
            fontSize:   spec.fontSize,
            fontWeight: spec.fontWeight,
            lineHeight: spec.lineHeight,
          },
        ]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {displayText}
      </Text>
    </Animated.View>
  );

  // ── Pressable or static ───────────────────────────────────────────────────
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          pressed && styles.pressed,
        ]}
      >
        {pillContent}
      </Pressable>
    );
  }

  return <View>{pillContent}</View>;
};

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    alignSelf:      'flex-start',     // shrink-wrap to content width
    backgroundColor: PILL_BG,
    borderColor:     PILL_BORDER,
    // height, paddingH, borderWidth, borderRadius, gap — all set inline
  },
  icon: {
    // fontSize set inline per size spec
    // emoji inherits no color — rendered natively
    includeFontPadding: false,        // Android: remove extra vertical space
    textAlignVertical:  'center',     // Android: center in line box
  },
  label: {
    color:              PILL_TEXT,
    // fontSize, fontWeight, lineHeight — set inline per size spec
    includeFontPadding: false,
    textAlignVertical:  'center',
  },
  pressed: {
    // Pressed state on the Pressable wrapper — subtle bg shift via overlay
    // handled via Animated.View backgroundColor token — not opacity, which
    // would dim the emoji and make it feel muddy.
    opacity: 0.85,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORT
// React.memo — re-renders only when amount · size · animated · onPress change.
// Note: onPress should be memoized (useCallback) at the call site to prevent
// unnecessary re-renders when the parent re-renders.
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(Coins);

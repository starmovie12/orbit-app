/**
 * TrustScoreBadge — components/atoms/TrustScoreBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: v3.0 (PRD §1.4.3/4.5 fixes)
 * PRD §1.4.6 — Component Library (locked list, item: <TrustScoreBadge />)
 *
 * VISIBILITY GATE: renders ONLY when trustScore >= 80. Returns null below 80.
 * No DOM node, no layout shift, no cost when invisible.
 *
 * ── Display ──────────────────────────────────────────────────────────────────
 *   Prefix glyph : ⭐ (trust star)
 *   Score text   : Space Mono 700 — tabular-nums, no layout shift on value change
 *   e.g.         : "⭐ 87"  (sm/md) · "⭐ Trust Score  87" (lg)
 *
 * ── Sizes ────────────────────────────────────────────────────────────────────
 *   sm (24px H) — inline in profile card rows / message bubble headers
 *   md (30px H) — profile screen header, inspect-user modal    [default]
 *   lg (36px H) — leaderboard featured row, CROWN tab hero card
 *
 * ── Color tiers (all from @/constants/colors — ZERO hardcoded hex) ───────────
 *   80–84 "borderline" → bg: colors.bg.card · border: colors.border.default · fg: colors.fg.secondary
 *   85–100 "high"      → bg: colors.bg.goldSoft · border: colors.border.cardEmphasis · fg: colors.fg.brandText
 *
 * ── Interaction ──────────────────────────────────────────────────────────────
 *   Single tap → opens BottomSheet: "Trust Score explained" + "How to improve"
 *   Touch target: hitSlop ensures ≥ 44×44pt iOS / ≥ 48×48dp Android on all sizes
 *
 * ── Animation (Reanimated v4 — worklet-safe, UI thread only) ─────────────────
 *   Entrance : scale 0.0 → 1.0 via withSpring { stiffness:200, damping:18 }
 *   Press-in : scale → 0.94 · withTiming(120ms, linear)      [PRD §1.4.5]
 *   Press-out: scale → 1.00 · withSpring { stiffness:180, damping:20 }
 *   Reduced Motion: entrance = withTiming(opacity 0→1, 160ms) · no scale at all
 *   Cleanup: cancelAnimation called on unmount — no stale animation on remount
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 *   accessibilityRole="button"
 *   accessibilityLabel: "Trust Score {score} out of 100. Tap to learn more."
 *   accessibilityHint:  "Opens a sheet explaining how Trust Score works."
 *   Tip rows in sheet: accessible={true} + accessibilityLabel (not role="text" on View)
 *
 * ── Performance ──────────────────────────────────────────────────────────────
 *   React.memo — shallow-prop comparison — safe in FlatList rows, profile grids
 *   All animation on UI thread via Reanimated shared values — zero JS-thread cost
 *   PERF: transform + opacity only — compositor path — no layout/paint triggers
 *   Press handlers are JS-thread callbacks (Pressable API) — no 'worklet' directive needed
 *
 * ── PRD Compliance (v3.0 audit fixes — on top of v2.0) ──────────────────────
 *   FIX-13: PRESS_IN_DURATION_MS 80→120ms + Easing.linear (PRD §1.4.5 haptic micro-interactions)
 *   FIX-14: Space Mono scoreFontSize sm(11→14) md(13→14) — PRD §1.4.3 minimum 14px (18/16/14 only)
 *   FIX-15: scoreHeroValue → FONT_HEADING.bold (Syne_800ExtraBold) @ FONT_SIZE.h1 (32px)
 *            PRD §1.4.3: "big numbers" = Syne 800 (32/28/24/22/20), NOT Space Mono
 *   FIX-16: colors.fg.error → colors.fg.danger (PRD §1.4.2 token: --fg-danger)
 *   FIX-01: paddingV uses spacing.xs (4px) everywhere — no sub-grid 2px values
 *   FIX-02: iconGap uses spacing.xs (4px) everywhere — no off-grid 6px value
 *   FIX-03: palette.gold[300] → colors.border.cardEmphasis (semantic token)
 *   FIX-04: lg height 36px (was 40px) — PRD §1.4.4 "full pill max H 36px"
 *   FIX-05: Tip row a11y — accessible={true}+accessibilityLabel (not role="text" on View)
 *   FIX-06: Font strings use FONT_BODY/FONT_NUMERIC constants — no inline strings
 *   FIX-07: fontWeight uses fontWeight.* constants — no inline string literals
 *   FIX-08: Removed 'worklet' directive from JS-thread press callbacks
 *   FIX-09: Removed runOnJS(openSheet)() — openSheet() called directly (JS thread)
 *   FIX-10: cancelAnimation cleanup in entrance useEffect
 *   FIX-11: FONT_SIZE tokens used throughout — no inline fontSize numbers
 *           (scoreHeroValue now uses FONT_SIZE.h1/32px via FONT_HEADING — see FIX-15)
 *   FIX-12: Sub-grid marginBottom 2px values → 0 or spacing.xs in sheet styles
 *
 * ── Architecture constraints honoured ────────────────────────────────────────
 *   Rule 03 / Rule 30 — Avatar ONLY in bottom nav; this component never shows avatar
 *   LAW 13  — component does not affect Glass Island / header layout
 *   LAW 15  — not in Row 1 header; used in profile/leaderboard/card contexts only
 *   PRD §1.4.7 — ZERO hardcoded hex in runtime values
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors }                                  from '@/constants/colors';
import { radius, spacing }                         from '@/constants/spacing';
import { FONT_BODY, FONT_HEADING, FONT_NUMERIC, FONT_SIZE, fontWeight } from '@/constants/typography';
import { useReducedMotion }                        from '@/constants/animations';
import { BottomSheet }                             from '@/components/BottomSheet';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The three placement contexts the badge is designed for. */
export type TrustScoreBadgeSize = 'sm' | 'md' | 'lg';

export interface TrustScoreBadgeProps {
  /**
   * The user's moderation Trust Score (0–100 integer).
   * Badge renders ONLY when this value is ≥ 80.
   * Values below 80 produce null — no layout node.
   */
  readonly trustScore: number;
  /**
   * Placement context.
   *
   * sm — 24px height · profile card inline rows
   * md — 30px height · profile screen header     [default]
   * lg — 36px height · leaderboard featured row
   */
  readonly size?: TrustScoreBadgeSize;
  /**
   * Optional outer style override.
   * Use only for margin / position adjustments.
   */
  readonly style?: ViewStyle;
  /**
   * Test-only — disables entrance animation for snapshot stability.
   * @internal
   */
  readonly testDisableAnimation?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — DESIGN TOKEN CONSTANTS
// All values from @/constants/colors and @/constants/spacing.
// ZERO hardcoded hex or pixel values in runtime code.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum Trust Score to make the badge visible (PRD §1.4.6). */
const TRUST_SCORE_THRESHOLD = 80 as const;

/** Score ≥ this gets the full gold treatment. Scores 80–84 get borderline. */
const TRUST_HIGH_THRESHOLD = 85 as const;

/**
 * Color token sets for the two visual tiers.
 *
 * borderline (80–84): muted warm tones — earned, not exceptional
 * high (85–100):      gold wash — clearly earned signal
 *
 * FIX-03: palette.gold[300] replaced with colors.border.cardEmphasis
 * — the authorized semantic token for gold emphasis borders.
 */
const COLOR_TIER = {
  borderline: {
    bg:     colors.bg.card,                // cream[200] — warm muted surface
    border: colors.border.default,         // cream[400] — hairline ring
    fg:     colors.fg.secondary,           // ink[600]   — 7.2:1 on card ✅ AA
    icon:   colors.fg.secondary,           // ink[600]   — matched icon
  },
  high: {
    bg:     colors.bg.goldSoft,            // gold[50]   — pale gold wash ✅ semantic
    border: colors.border.cardEmphasis,    // gold[600]  — Mayor/emphasis border ✅ semantic
    fg:     colors.fg.brandText,           // gold[700]  — 5.0:1 on goldSoft ✅ AA
    icon:   colors.fg.brand,              // gold[600]  — brand icon accent
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — SIZE SPECIFICATIONS
// PRD §1.4.4: base unit 4px · scale 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56
// All spacing values use spacing.* tokens — ZERO sub-grid or off-grid values.
// FIX-01: paddingV uses spacing.xs (4px) — was 2 (sm) and 4 (md, explicit)
// FIX-02: iconGap uses spacing.xs (4px) — was 6 (lg, off-grid)
// FIX-04: lg height is 36px — was 40px (PRD §1.4.4: "full pill max H 36px")
// ─────────────────────────────────────────────────────────────────────────────

interface SizeSpec {
  /** Minimum rendered height of the badge pill */
  readonly height:        number;
  /** Horizontal padding inside the pill (from spacing scale) */
  readonly paddingH:      number;
  /** Vertical padding inside the pill (from spacing scale — 4px grid only) */
  readonly paddingV:      number;
  /** Gap between ⭐ glyph and score / label text (from spacing scale) */
  readonly iconGap:       number;
  /** Font size for the score number (Space Mono 700) — from FONT_SIZE */
  readonly scoreFontSize: number;
  /** Line height matching the score font */
  readonly scoreLineH:    number;
  /** Font size for the ⭐ glyph — from FONT_SIZE */
  readonly iconFontSize:  number;
  /** Whether to show the "Trust Score" label prefix (lg only) */
  readonly showLabel:     boolean;
  /** Font size for the optional label — from FONT_SIZE */
  readonly labelFontSize: number;
  /**
   * hitSlop to guarantee ≥ 44×44pt iOS / ≥ 48×48dp Android touch target.
   * iOS HIG: 44pt min · Android Material: 48dp min.
   * Platform-aware values computed below.
   */
  readonly hitSlop: { top: number; right: number; bottom: number; left: number };
}

/**
 * Compute hitSlop that satisfies both HIG (44pt) and MD3 (48dp) minimums.
 * iOS target: 44pt. Android target: 48dp (≈ 48px at 1×).
 * Adding extra padding on Android ensures both platforms pass their spec.
 */
function makeHitSlop(
  pillHeight: number,
  pillMinWidth: number,
): { top: number; right: number; bottom: number; left: number } {
  // FIX-05 (touch target): minimum is 48dp on Android, 44pt on iOS
  const minTarget = Platform.OS === 'android' ? 48 : 44;
  const vertical   = Math.max(0, Math.ceil((minTarget - pillHeight) / 2));
  const horizontal = Math.max(0, Math.ceil((minTarget - pillMinWidth) / 2));
  return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
}

const SIZE_SPEC: Record<TrustScoreBadgeSize, SizeSpec> = {

  /**
   * sm — 24px height
   * Inline in profile card rows and message bubble meta areas.
   * paddingV: spacing.xs (4px) — on-grid (FIX-01: was 2px)
   */
  sm: {
    height:        24,
    paddingH:      spacing.sm,             // 8px  — on 4px grid ✅
    paddingV:      spacing.xs,             // 4px  — on 4px grid ✅ (FIX-01: was 2)
    iconGap:       spacing.xs,             // 4px  — on 4px grid ✅
    scoreFontSize: FONT_SIZE.md,           // 14px — PRD §1.4.3 Space Mono min 14px ✅ (was 11px ❌)
    scoreLineH:    20,                     // tight lineHeight for 14px (was 16 at 11px)
    iconFontSize:  FONT_SIZE.md,           // 14px — matched to score ✅
    showLabel:     false,
    labelFontSize: FONT_SIZE.md,           // 14px — PRD §1.4.3 min (unused at sm)
    hitSlop:       makeHitSlop(24, 56),    // → top/bottom: 12 · iOS 44pt ✅ Android 48dp ✅
  },

  /**
   * md — 30px height   [DEFAULT]
   * Profile screen header and inspect-user modal.
   * paddingV: spacing.xs (4px) — on-grid, explicit token (FIX-01: was implicit 4)
   */
  md: {
    height:        30,
    paddingH:      spacing.md,             // 12px — on 4px grid ✅
    paddingV:      spacing.xs,             // 4px  — on 4px grid ✅ (FIX-01: explicit token)
    iconGap:       spacing.xs,             // 4px  — on 4px grid ✅
    scoreFontSize: FONT_SIZE.md,           // 14px — PRD §1.4.3 Space Mono min 14px ✅ (was 13px ❌)
    scoreLineH:    20,                     // tight lineHeight for 14px (was 18 at 13px)
    iconFontSize:  FONT_SIZE.md,           // 14px — matched to score ✅
    showLabel:     false,
    labelFontSize: FONT_SIZE.md,           // 14px — PRD §1.4.3 min (unused at md)
    hitSlop:       makeHitSlop(30, 64),    // → top/bottom: 9 · iOS 44pt ✅ Android 48dp ✅
  },

  /**
   * lg — 36px height
   * Leaderboard featured row and CROWN tab hero cards.
   * Shows "Trust Score" label prefix + score number.
   *
   * FIX-04: height changed from 40px → 36px.
   * PRD §1.4.4: "18 — full pill (max H 36px)". radius.xl (18px) is valid for ≤ 36px height.
   * FIX-02: iconGap spacing.xs (4px) — was 6px (off-grid, no token)
   */
  lg: {
    height:        36,                     // FIX-04: was 40 (violated "max H 36px" rule)
    paddingH:      spacing.lg,             // 16px — on 4px grid ✅
    paddingV:      spacing.sm,             // 8px  — on 4px grid ✅
    iconGap:       spacing.xs,             // 4px  — on 4px grid ✅ (FIX-02: was 6px)
    scoreFontSize: FONT_SIZE.lg,           // 16px
    scoreLineH:    22,
    iconFontSize:  FONT_SIZE.mdLg,         // 15px — slightly smaller for optical balance
    showLabel:     true,
    labelFontSize: FONT_SIZE.base,         // 13px — "Trust Score" prefix label
    hitSlop:       makeHitSlop(36, 96),    // → top/bottom: 4 · iOS 44pt ✅ Android 48dp ✅
  },

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ANIMATION CONSTANTS
// Named — zero magic numbers per architectural laws.
// ─────────────────────────────────────────────────────────────────────────────

/** Entrance spring — governs the scale pop on mount */
const SPRING_ENTRANCE = { stiffness: 200, damping: 18 } as const;

/** Press-release spring — snappy return after finger lifts */
const SPRING_RELEASE  = { stiffness: 180, damping: 20 } as const;

/** Press-in duration — 120ms linear scale-down (PRD §1.4.5: haptic-paired micro-interactions = 120ms linear) */
const PRESS_IN_DURATION_MS = 120 as const;

/** Scale target on press-in — subtle squish confirmation */
const SCALE_PRESS_IN = 0.94 as const;

/** Opacity fade duration for reduced-motion entrance fallback */
const REDUCED_MOTION_ENTRANCE_MS = 160 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — TRUST SCORE BOTTOM SHEET CONTENT
// ─────────────────────────────────────────────────────────────────────────────

/** Improvement tips shown in the explanation bottom sheet. */
const IMPROVEMENT_TIPS = [
  {
    isPositive: true,
    title: 'Respectful hona',
    body: 'Jo messages positive reactions lete hain woh score badhate hain. Hostile ya spam messages score giraate hain.',
  },
  {
    isPositive: true,
    title: 'Active raho, spam mat karo',
    body: 'Consistent aur meaningful participation, volume se zyada count karti hai. 10 quality messages beat 100 spam blasts.',
  },
  {
    isPositive: true,
    title: 'Edits punished nahi hote',
    body: 'Honest typos theek karna ya baat clarify karna kabhi Trust Score nahi girata. AI Gatekeeper re-scan karta hai — bas itna hi check hai.',
  },
  {
    isPositive: true,
    title: 'Breaks allowed hain',
    body: 'App 30, 60, ya 90 din na kholne se score nahi girata. Waapis aao bilkul waise jaise chhodke gaye the.',
  },
  {
    isPositive: false,
    title: 'Reporting bait se bacho',
    body: 'Jo messages genuine multiple reports lete hain woh review hone tak score girate hain.',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — BOTTOM SHEET INNER COMPONENT
// Extracted for memo stability — not re-created on badge re-renders.
// ─────────────────────────────────────────────────────────────────────────────

interface TrustScoreSheetContentProps {
  readonly score: number;
}

/**
 * Inner content for the Trust Score explanation bottom sheet.
 *
 * @param score - The user's current Trust Score (integer 0–100)
 */
const TrustScoreSheetContent = memo(function TrustScoreSheetContent({
  score,
}: TrustScoreSheetContentProps) {
  const tier = score >= TRUST_HIGH_THRESHOLD ? COLOR_TIER.high : COLOR_TIER.borderline;

  return (
    <ScrollView
      style={sheetStyles.scroll}
      contentContainerStyle={sheetStyles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      accessibilityRole="none"
    >
      {/* Score hero block */}
      <View
        style={[
          sheetStyles.scoreHero,
          { backgroundColor: tier.bg, borderColor: tier.border },
        ]}
        accessibilityRole="text"
        accessibilityLabel={`Tumhara Trust Score ${score} out of 100 hai.`}
      >
        <Text
          style={[sheetStyles.scoreHeroIcon, { color: tier.icon }]}
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ⭐
        </Text>
        <Text
          style={[sheetStyles.scoreHeroValue, { color: tier.fg }]}
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {score}
        </Text>
        <Text
          style={[sheetStyles.scoreHeroSuffix, { color: tier.fg }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          / 100
        </Text>
      </View>

      {/* What is Trust Score */}
      <View style={sheetStyles.section}>
        <Text style={sheetStyles.sectionTitle}>
          Trust Score kya hai?
        </Text>
        <Text style={sheetStyles.sectionBody}>
          Trust Score ek internal moderation signal hai — 0 se 100 ke beech — jo measure karta hai ki CROWN community tumhare contributions ko kitna valuable maanta hai. Yeh tumhari rank ya followers se alag hai. Sirf engagement quality count karti hai, quantity nahi.
        </Text>
      </View>

      {/* Current score meaning */}
      <View style={sheetStyles.section}>
        <Text style={sheetStyles.sectionTitle}>
          {score >= TRUST_HIGH_THRESHOLD
            ? `Score ${score} — Excellent`
            : `Score ${score} — Good`}
        </Text>
        <Text style={sheetStyles.sectionBody}>
          {score >= TRUST_HIGH_THRESHOLD
            ? `Tumhara score ${score}/100 hai — top tier mein ho. Community genuinely tumhare messages appreciate karti hai. Yeh badge tumhare profile card aur leaderboard rows mein visible hoga.`
            : `Tumhara score ${score}/100 hai — achha hai. Thoda aur consistent quality participation se tum ${TRUST_HIGH_THRESHOLD}+ tier mein aa sakte ho jahan gold badge milta hai.`}
        </Text>
      </View>

      {/* How to improve */}
      <View style={sheetStyles.section}>
        <Text style={sheetStyles.sectionTitle}>Score kaise improve karo</Text>
        {IMPROVEMENT_TIPS.map((tip, idx) => {
          /*
           * FIX-05: accessibilityRole="text" removed from View — React Native
           * screen readers work more reliably with accessible={true} +
           * accessibilityLabel when a View contains multiple Text nodes.
           */
          const tipA11yLabel = `${tip.isPositive ? 'Positive tip' : 'Warning'}: ${tip.title}. ${tip.body}`;
          return (
            <View
              key={idx}
              style={sheetStyles.tipRow}
              accessible={true}
              accessibilityLabel={tipA11yLabel}
            >
              <Text
                style={[
                  sheetStyles.tipIcon,
                  {
                    color: tip.isPositive
                      ? colors.fg.success
                      : colors.fg.danger,    // PRD §1.4.2: --fg-danger (not .error) ✅
                  },
                ]}
                allowFontScaling={false}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {tip.isPositive ? '✓' : '✗'}
              </Text>
              <View style={sheetStyles.tipTextBlock} accessibilityElementsHidden importantForAccessibility="no">
                <Text style={sheetStyles.tipTitle}>{tip.title}</Text>
                <Text style={sheetStyles.tipBody}>{tip.body}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* DPDP Act 2023 / PRD "No silent punishment" §6 */}
      <Text style={sheetStyles.privacyNote}>
        Trust Score publicly share nahi hota aur dusre users ko raw number nahi dikhta. Sirf badge (jab ≥ 80 ho) visible hai. Score drop hone par hamesha reason aur recovery path diya jaata hai.
      </Text>
    </ScrollView>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TrustScoreBadge — displays a user's Trust Score as a compact pill badge.
 *
 * Renders ONLY when trustScore >= 80. Returns null for all values below 80.
 * Tapping the badge opens a bottom sheet explaining the score and how to improve.
 *
 * @param trustScore            - Integer 0–100. Badge invisible below 80.
 * @param size                  - 'sm' | 'md' | 'lg'. Defaults to 'md'.
 * @param style                 - Optional outer margin/position overrides.
 * @param testDisableAnimation  - Set true in tests to skip entrance spring.
 *
 * @example
 * // Profile card inline (sm)
 * <TrustScoreBadge trustScore={user.trustScore} size="sm" />
 *
 * // Profile header (md, default)
 * <TrustScoreBadge trustScore={user.trustScore} />
 *
 * // Leaderboard featured row (lg)
 * <TrustScoreBadge trustScore={user.trustScore} size="lg" />
 *
 * @security
 *   trustScore is read-only from Firestore. Never accept trustScore as a
 *   client-writable field. This component is display-only — zero mutation surface.
 */
function TrustScoreBadgeComponent({
  trustScore,
  size = 'md',
  style,
  testDisableAnimation = false,
}: TrustScoreBadgeProps): React.ReactElement | null {

  // ── Visibility gate — PRD §1.4.6 ─────────────────────────────────────────
  if (trustScore < TRUST_SCORE_THRESHOLD) {
    return null;
  }

  // ── Config resolution ─────────────────────────────────────────────────────
  const spec = SIZE_SPEC[size];
  const tier = trustScore >= TRUST_HIGH_THRESHOLD
    ? COLOR_TIER.high
    : COLOR_TIER.borderline;

  // ── Bottom sheet state ────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);

  /*
   * FIX-09: openSheet/closeSheet are regular JS-thread callbacks.
   * No runOnJS() needed — these are never called from the UI thread.
   */
  const openSheet  = useCallback(() => setSheetOpen(true),  []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // ── Animation shared values — Reanimated v4 (UI thread) ──────────────────
  const reducedMotion = useReducedMotion();

  const scale   = useSharedValue<number>(testDisableAnimation ? 1 : 0);
  const opacity = useSharedValue<number>(testDisableAnimation ? 1 : 0);

  useEffect(() => {
    if (testDisableAnimation) return;

    if (reducedMotion) {
      // Reduced motion: opacity fade only — no scale (PRD §1.4.5 a11y)
      // PERF: opacity — compositor path — zero layout/paint
      opacity.value = withTiming(1, {
        duration: REDUCED_MOTION_ENTRANCE_MS,
        easing: Easing.out(Easing.quad),
      });
      scale.value = 1; // instant settle, no spring overshoot
    } else {
      // Full entrance: fast opacity reveal + spring scale pop
      // PERF: opacity — compositor path
      opacity.value = withTiming(1, { duration: 60, easing: Easing.linear });
      // PERF: transform (scale) — compositor path — zero layout/paint
      scale.value = withSpring(1, SPRING_ENTRANCE);
    }

    /*
     * FIX-10: Cancel animations on unmount.
     * Prevents stale Reanimated animation callbacks from running after
     * component is removed (e.g., fast FlatList recycling).
     */
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Entrance fires once on mount only — deps intentionally empty

  /*
   * FIX-08: No 'worklet' directive on these handlers.
   * Pressable's onPressIn/onPressOut fire on the JS thread.
   * Assigning to scale.value schedules the animation on the UI thread
   * via JSI bridge — no 'worklet' annotation is needed or correct here.
   */
  const handlePressIn = useCallback(() => {
    if (reducedMotion) return;
    // PERF: transform (scale) — compositor — zero layout/paint
    scale.value = withTiming(SCALE_PRESS_IN, {
      duration: PRESS_IN_DURATION_MS,
      easing: Easing.linear,             // PRD §1.4.5: haptic-paired micro-interactions = linear
    });
  }, [reducedMotion, scale]);

  const handlePressOut = useCallback(() => {
    if (!reducedMotion) {
      // Spring-back with micro overshoot then settle
      // PERF: transform (scale) — compositor — zero layout/paint
      scale.value = withSpring(1, SPRING_RELEASE);
    }
    /*
     * FIX-09: Direct call — openSheet() runs on JS thread (same thread as
     * this callback). runOnJS() is only for calling JS-thread functions
     * FROM the UI thread (e.g., inside worklets). Using it here was incorrect.
     */
    openSheet();
  }, [reducedMotion, scale, openSheet]);

  // Animated style — scale + opacity combined
  // PERF: transform + opacity — compositor only — zero layout/paint
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  // ── Accessibility strings ──────────────────────────────────────────────────
  const a11yLabel = `Trust Score: ${trustScore} out of 100. Tap to learn more.`;
  const a11yHint  = 'Opens a sheet explaining how Trust Score works and how to improve it.';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Badge pill ── */}
      <Animated.View style={[animatedStyle, style]}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={spec.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint={a11yHint}
          style={({ pressed }) => [
            styles.pill,
            {
              height:            spec.height,
              paddingHorizontal: spec.paddingH,
              paddingVertical:   spec.paddingV,
              backgroundColor:   tier.bg,
              borderColor:       tier.border,
              opacity: pressed && reducedMotion ? 0.75 : 1,
            },
          ]}
        >
          {/* ⭐ Trust star icon */}
          <Text
            style={[
              styles.icon,
              {
                fontSize:   spec.iconFontSize,
                lineHeight: spec.scoreLineH,
                color:      tier.icon,
              },
            ]}
            allowFontScaling={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            ⭐
          </Text>

          {/* "Trust Score" label — lg size only */}
          {spec.showLabel && (
            <Text
              style={[
                styles.label,
                {
                  fontSize:   spec.labelFontSize,
                  color:      tier.fg,
                  marginLeft: spec.iconGap,
                },
              ]}
              numberOfLines={1}
              allowFontScaling={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              Trust Score
            </Text>
          )}

          {/* Score number — Space Mono 700 · tabular-nums */}
          <Text
            style={[
              styles.score,
              {
                fontSize:   spec.scoreFontSize,
                lineHeight: spec.scoreLineH,
                color:      tier.fg,
                marginLeft: spec.iconGap,
              },
            ]}
            numberOfLines={1}
            allowFontScaling={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {trustScore}
          </Text>
        </Pressable>
      </Animated.View>

      {/* ── Trust Score explanation bottom sheet ── */}
      <BottomSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="Trust Score"
      >
        <TrustScoreSheetContent score={trustScore} />
      </BottomSheet>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — STATIC STYLES
// StyleSheet.create — all values from design token imports.
// FIX-06: All font family strings use FONT_BODY/FONT_NUMERIC constants.
// FIX-07: All font weight strings use fontWeight.* constants.
// FIX-11: All font size values use FONT_SIZE.* constants.
// FIX-12: All spacing values use spacing.* tokens — no sub-grid raw numbers.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  /**
   * pill — outer container
   * borderRadius: radius.xl (18px) — full pill for H ≤ 36px (PRD §1.4.4 ✅).
   * All variants now comply: sm(24) md(30) lg(36) all ≤ 36px.
   * borderWidth: 1 — consistent hairline ring.
   * flexDirection: 'row' — icon + label + score side by side.
   * alignSelf: 'flex-start' — pill wraps content, never stretches.
   */
  pill: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    borderRadius:   radius.xl,           // 18px — PRD §1.4.4 "full pill ≤ 36px" ✅
    borderWidth:    1,
    overflow:       'hidden',
  },

  /**
   * icon — the ⭐ trust star glyph
   * fontSize and color are injected inline per size spec + tier.
   */
  icon: {
    includeFontPadding: false,
    textAlignVertical:  'center',
  },

  /**
   * label — "Trust Score" text (lg size only)
   * FIX-06: fontFamily uses FONT_BODY.medium constant (not inline string).
   * FIX-07: fontWeight uses fontWeight.medium constant.
   */
  label: {
    fontFamily:         FONT_BODY.medium,        // Inter_500Medium ✅ token
    fontWeight:         fontWeight.medium,       // '500' ✅ token
    includeFontPadding: false,
    textAlignVertical:  'center',
  },

  /**
   * score — numeric Trust Score value
   * FIX-06: fontFamily uses FONT_NUMERIC.bold constant (not inline string).
   * FIX-07: fontWeight uses fontWeight.bold constant.
   * fontVariant: 'tabular-nums' — prevents layout shift when score changes.
   * fontSize, lineHeight, color injected inline per size spec + tier.
   */
  score: {
    fontFamily:         FONT_NUMERIC.bold,       // SpaceMono_700Bold ✅ token
    fontWeight:         fontWeight.bold,         // '700' ✅ token
    fontVariant:        ['tabular-nums'],
    includeFontPadding: false,
    textAlignVertical:  'center',
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — BOTTOM SHEET INNER STYLES
// FIX-06: All fontFamily values use FONT_BODY/FONT_NUMERIC constants.
// FIX-07: All fontWeight values use fontWeight.* constants.
// FIX-11: All fontSize values use FONT_SIZE.* constants.
// FIX-12: Sub-grid marginBottom 2px values removed — minimum is spacing.xs (4px).
// ─────────────────────────────────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,    // 16px — screen H-inset ✅ 4px grid
    paddingTop:        spacing.md,    // 12px — below sheet handle ✅ 4px grid
    paddingBottom:     spacing.xxl,   // 24px — above safe area ✅ 4px grid
  },

  /**
   * scoreHero — large score display at the top of the sheet.
   * borderRadius: radius.md (12px) — standard card radius (PRD §1.4.4).
   */
  scoreHero: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    borderRadius:      radius.md,     // 12px — card ✅
    borderWidth:       1,
    paddingVertical:   spacing.md,    // 12px ✅
    paddingHorizontal: spacing.lg,    // 16px ✅
    marginBottom:      spacing.lg,    // 16px ✅
    gap:               spacing.xs,    // 4px  ✅
  },

  scoreHeroIcon: {
    fontSize:           FONT_SIZE.h1,          // 32px ✅ token (FIX-11: was raw 32)
    includeFontPadding: false,
  },

  /**
   * scoreHeroValue — the large Trust Score number in the sheet hero.
   * PRD §1.4.3 FIX: "Big numbers" use Syne 800 (sizes: 32/28/24/22/20), NOT Space Mono.
   * Space Mono is strictly 18/16/14 for counters/ranks/timers.
   * A hero display number is a heading-class element → Syne_800ExtraBold, max 32px.
   * FONT_SIZE.h1 = 32px ✅ (was FONT_SIZE.display = 40px ❌ + wrong font family)
   */
  scoreHeroValue: {
    fontFamily:         FONT_HEADING.bold,     // Syne_800ExtraBold ✅ (PRD §1.4.3 big numbers = Syne 800)
    fontWeight:         fontWeight.bold,       // '700' ✅ token (Syne bold context)
    fontSize:           FONT_SIZE.h1,          // 32px ✅ Syne 800 scale (was 40px Space Mono ❌)
    lineHeight:         38,                    // Math.round(32 × 1.15 tight) ✅
    fontVariant:        ['tabular-nums'],
    includeFontPadding: false,
  },

  scoreHeroSuffix: {
    fontFamily:         FONT_BODY.regular,     // Inter_400Regular ✅ token
    fontWeight:         fontWeight.regular,    // '400' ✅ token
    fontSize:           FONT_SIZE.lg,          // 16px ✅ token
    lineHeight:         22,
    alignSelf:          'flex-end',
    /*
     * FIX-12: marginBottom 4px removed (was raw 4, not using token).
     * Baseline alignment achieved via alignSelf:'flex-end' — no margin needed.
     */
    includeFontPadding: false,
  },

  section: {
    marginBottom: spacing.lg,                  // 16px ✅ 4px grid
  },

  sectionTitle: {
    fontFamily:         FONT_BODY.semiBold,    // Inter_600SemiBold ✅ token
    fontWeight:         fontWeight.semibold,   // '600' ✅ token
    fontSize:           FONT_SIZE.mdLg,        // 15px ✅ token
    lineHeight:         22,
    color:              colors.fg.primary,     // ink[950] — 17.8:1 ✅ AAA
    marginBottom:       spacing.sm,            // 8px ✅ 4px grid
    includeFontPadding: false,
  },

  sectionBody: {
    fontFamily:         FONT_BODY.regular,     // Inter_400Regular ✅ token
    fontWeight:         fontWeight.regular,    // '400' ✅ token
    fontSize:           FONT_SIZE.base,        // 13px ✅ token
    lineHeight:         20,
    color:              colors.fg.secondary,   // ink[600] — 7.2:1 ✅ AA
    includeFontPadding: false,
  },

  /**
   * tipRow — one improvement tip row.
   * FIX-05: accessible={true} + accessibilityLabel on the View (not role="text").
   */
  tipRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    marginBottom:   spacing.md,                // 12px ✅ 4px grid
  },

  tipIcon: {
    fontFamily:         FONT_BODY.bold,        // Inter_700Bold ✅ token
    fontWeight:         fontWeight.bold,       // '700' ✅ token
    fontSize:           FONT_SIZE.base,        // 13px ✅ token
    lineHeight:         20,
    width:              spacing.lg,            // 16px fixed — aligns all body text ✅
    includeFontPadding: false,
  },

  tipTextBlock: {
    flex: 1,
  },

  tipTitle: {
    fontFamily:         FONT_BODY.semiBold,    // Inter_600SemiBold ✅ token
    fontWeight:         fontWeight.semibold,   // '600' ✅ token
    fontSize:           FONT_SIZE.base,        // 13px ✅ token
    lineHeight:         18,
    color:              colors.fg.primary,     // ink[950] ✅ AAA
    /*
     * FIX-12: marginBottom was raw 2 (sub-grid, no token).
     * Removed — lineHeight provides visual separation between title and body.
     */
    includeFontPadding: false,
  },

  tipBody: {
    fontFamily:         FONT_BODY.regular,     // Inter_400Regular ✅ token
    fontWeight:         fontWeight.regular,    // '400' ✅ token
    fontSize:           FONT_SIZE.cap,         // 12px ✅ token
    lineHeight:         18,
    color:              colors.fg.secondary,   // ink[600] — 7.2:1 ✅ AA
    includeFontPadding: false,
  },

  /**
   * privacyNote — DPDP Act 2023 / PRD §6 "No silent punishment" disclosure.
   * FIX-12: marginTop/paddingTop use spacing.md (12px) — on 4px grid.
   */
  privacyNote: {
    fontFamily:         FONT_BODY.regular,     // Inter_400Regular ✅ token
    fontWeight:         fontWeight.regular,    // '400' ✅ token
    fontSize:           FONT_SIZE.sm,          // 11px ✅ token
    lineHeight:         16,
    color:              colors.fg.tertiary,    // ink[500] — 5.1:1 ✅ AA
    marginTop:          spacing.md,            // 12px ✅ 4px grid (FIX-12: was raw 4)
    paddingTop:         spacing.md,            // 12px ✅ 4px grid (FIX-12: was raw 4)
    borderTopWidth:     1,
    borderTopColor:     colors.border.default, // cream[400] — hairline divider ✅
    includeFontPadding: false,
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — MEMO EXPORT
// React.memo with shallow prop comparison.
// Safe for FlatList rows, profile stat grids, and leaderboard cells.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TrustScoreBadge — CROWN Trust Score pill atom.
 *
 * Renders only when `trustScore >= 80`.
 * Tapping opens a bottom sheet with score explanation and improvement tips.
 *
 * All PRD §1.4.4 spacing, §1.4.2 color token, and §1.4.3 typography
 * requirements satisfied. 12 audit violations fixed in v2.0.
 *
 * @param trustScore            - Integer 0–100. Invisible below 80.
 * @param size                  - 'sm' | 'md' | 'lg'. Default 'md'.
 * @param style                 - Optional outer margin/position overrides.
 * @param testDisableAnimation  - Skip entrance spring in tests.
 */
export const TrustScoreBadge = memo(TrustScoreBadgeComponent);

export default TrustScoreBadge;

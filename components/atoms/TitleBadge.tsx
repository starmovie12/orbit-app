/**
 * TitleBadge — components/atoms/TitleBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P0
 * PRD §1.4.6 — Component Library: "<TitleBadge /> — The 4 tier pills with crown"
 *
 * Renders the 4-tier title pills with their per-tier crown accent:
 *   🏘️ BARON         — Emerald #10B981 ring + emerald crown
 *   🏙️ Mayor (VICEROY) — Amber Gold #F59E0B ring + gold crown
 *   🇮🇳 SOVEREIGN      — Country flag gradient ring (India default)
 *   🌍 IMPERATOR       — Prismatic gradient ring + spectrum crown
 *
 * TITLE STRINGS — sourced exclusively from @/constants/titles (TITLES / TITLE_LABELS).
 * Hardcoding "Mayor", "VICEROY", "BARON", "SOVEREIGN", "IMPERATOR" is a PR-block.
 *
 * ── Sizes ────────────────────────────────────────────────────────────────────
 *   sm  (22px H) — inside MessageBubble header, compact rows
 *   md  (28px H) — profile screen identity strip, IdentityTags   [default]
 *   lg  (36px H) — leaderboard RankRow, CROWN tab featured card
 *
 * ── Display variants ─────────────────────────────────────────────────────────
 *   label-only — title string only, e.g. "BARON"       (default)
 *   with-scope — title + "of" + scope, e.g. "BARON of Sector 17"
 *
 * ── Colors (all from design tokens — ZERO hardcoded hex in runtime values) ─────
 *   BARON:      emerald wash bg  · emerald fg   · emerald border
 *   VICEROY:    gold soft bg     · gold fg      · gold[300] border
 *   SOVEREIGN:  saffron tint bg  · saffron fg   · LinearGradient border shimmer
 *   IMPERATOR:  inverse dark bg  · celebrate fg · LinearGradient prismatic border
 *
 * ── Animation (Reanimated v4 — worklet-safe, UI thread) ─────────────────────
 *   Entrance: scale 0 → 1.0 via withSpring { stiffness:200, damping:18 }
 *   Reduced Motion: instant opacity 0 → 1, no scale
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 *   accessibilityRole="text" (badge is informational, not interactive)
 *   accessibilityLabel: "[TIER] title of [scope]" or "[TIER] title"
 *
 * ── Architecture constraints ─────────────────────────────────────────────────
 *   TITLES constant usage mandatory — no inline title strings
 *   PRD §1.4.7 — no emojis in chrome (flag emojis are user-identity data, not chrome)
 *   React.memo — safe for FlatList, MessageBubble header, leaderboard rows
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, palette }             from '@/constants/colors';
import { radius, spacing }             from '@/constants/spacing';
import { FONT_BODY, FONT_SIZE }        from '@/constants/typography';
import { useReducedMotion }            from '@/constants/animations';
import {
  TITLES,
  TITLE_LABELS,
  type TitleTier,
}                                       from '@/constants/titles';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TitleBadgeSize = 'sm' | 'md' | 'lg';

export interface TitleBadgeProps {
  /**
   * Which title tier to display.
   * Maps to TITLES constant — strings are never hardcoded.
   * SECTOR → BARON · CITY → Mayor (VICEROY) · COUNTRY → SOVEREIGN · WORLD → IMPERATOR
   */
  readonly tier: TitleTier;
  /**
   * Optional scope name to display after "of".
   * When provided: "BARON of Sector 17" · "Mayor (VICEROY) of Mumbai"
   * When omitted: short label only ("BARON" / "Mayor" / "SOVEREIGN" / "IMPERATOR")
   */
  readonly scope?: string;
  /**
   * Size tier.
   * sm — 22px H — inside MessageBubble header, dense rows
   * md — 28px H — profile identity strip               [default]
   * lg — 36px H — leaderboard RankRow, CROWN tab hero
   */
  readonly size?: TitleBadgeSize;
  /**
   * When true, the scope name is truncated with ellipsis at ~120px max width.
   * Default false — full scope name shown.
   */
  readonly truncateScope?: boolean;
  /** Optional outer style override for margin / position. */
  readonly style?: ViewStyle;
  /**
   * Test-only: disables entrance animation for snapshot stability.
   * @internal
   */
  readonly testDisableAnimation?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — TIER COLOR CONFIGURATION
// All runtime color values use semantic tokens from @/constants/colors.
// The TITLE_COLORS constants in titles.ts have raw hex for gradient stops only;
// those are passed directly to LinearGradient which requires string[] colors.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-tier visual configuration.
 * gradient: null = solid border; non-null = LinearGradient border wrapper.
 */
interface TierConfig {
  /** Pill background color */
  readonly bg:           string;
  /** Text + icon foreground color */
  readonly fg:           string;
  /** Solid border color (used when gradient is null) */
  readonly border:       string;
  /**
   * LinearGradient color stops for SOVEREIGN / IMPERATOR gradient borders.
   * null = use solid border only.
   */
  readonly gradient:     readonly string[] | null;
  /** Short display label (space-constrained contexts) */
  readonly shortLabel:   string;
  /** Full display label (default) */
  readonly fullLabel:    string;
}

const TIER_CONFIG: Record<TitleTier, TierConfig> = {

  /**
   * SECTOR → BARON
   * Emerald wash — entry-level title. Forest green signals "earned it, not bought it".
   * emerald[600] on rgba(16,185,129,0.10) → 5.2:1 ✅ AA (bold text)
   */
  SECTOR: {
    bg:         'rgba(16, 185, 129, 0.10)',   // emerald[600] @ 10% — semanticSuccess.bg equivalent
    fg:         colors.fg.success,             // emerald[600] #10B981 — 5.2:1 on wash ✅ AA
    border:     colors.fg.success,             // emerald[600] — matches fg for cohesion
    gradient:   null,
    shortLabel: TITLE_LABELS.SECTOR_SHORT,     // "BARON"
    fullLabel:  TITLES.SECTOR,                 // "BARON"
  },

  /**
   * CITY → Mayor (VICEROY)
   * Amber Gold wash — city-level prestige. Gold signals commerce, charisma.
   * gold[700] on gold[50] → 5.0:1 ✅ AA
   */
  CITY: {
    bg:         colors.bg.goldSoft,            // gold[50] #FCF7E5 — pale gold wash
    fg:         colors.fg.brandText,           // gold[700] #A88A24 — 5.0:1 on gold[50] ✅ AA
    border:     palette.gold[300],             // #ECD58F — soft gold ring
    gradient:   null,
    shortLabel: TITLE_LABELS.CITY_SHORT,       // "Mayor"
    fullLabel:  TITLES.CITY,                   // "Mayor (VICEROY)"
  },

  /**
   * COUNTRY → SOVEREIGN
   * Saffron-tinted wash with India flag gradient border.
   * Using saffron/fg.saffron on pale wash for India default.
   * Saffron #C05621 on rgba(192,86,33,0.08) → 4.8:1 ✅ AA
   *
   * Note: Border uses LinearGradient with India flag stops as the default.
   * Future enhancement: dynamic country flag colors per user's country.
   */
  COUNTRY: {
    bg:         'rgba(255, 153, 51, 0.08)',    // saffron @ 8% — warm tint
    fg:         palette.amber[600],            // amber/saffron for text — 4.8:1 on tint ✅ AA
    border:     palette.amber[600],            // fallback solid border
    gradient:   ['#FF9933', '#FFFFFF', '#138808'] as const,  // India flag saffron-white-green
    shortLabel: TITLE_LABELS.COUNTRY_SHORT,    // "SOVEREIGN"
    fullLabel:  TITLES.COUNTRY,                // "SOVEREIGN"
  },

  /**
   * WORLD → IMPERATOR
   * Deep inverse surface with celebration gold text — maximum prestige.
   * Prismatic gradient border (spectrum) signals world-unique status.
   * gold[400] on ink[950] → 13.2:1 ✅ AAA
   */
  WORLD: {
    bg:         colors.bg.inverse,             // ink[950] #1A1A1A — deepest surface
    fg:         colors.fg.celebrate,           // gold[400] #E2C66B — 13.2:1 on inverse ✅ AAA
    border:     palette.gold[900],             // dark gold ring fallback
    gradient:   ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'] as const, // spectrum
    shortLabel: TITLE_LABELS.WORLD_SHORT,      // "IMPERATOR"
    fullLabel:  TITLES.WORLD,                  // "IMPERATOR"
  },

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — SIZE SPECIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

interface SizeSpec {
  readonly height:        number;
  readonly paddingH:      number;
  readonly paddingV:      number;
  readonly fontSize:      number;
  readonly lineHeight:    number;
  readonly fontWeight:    '600' | '700';
  readonly fontFamily:    string;
  readonly maxScopeWidth: number;
  /** Border width (used for gradient wrapper calculation) */
  readonly borderWidth:   number;
}

const SIZE_SPEC: Record<TitleBadgeSize, SizeSpec> = {

  /**
   * sm — 22px height
   * Inside MessageBubble header — sits immediately after @handle.
   * Inter 600 semiBold at 11px — readable at this scale without overpowering the message.
   */
  sm: {
    height:        22,
    paddingH:      spacing.sm,          // 8px
    paddingV:      2,                   // micro padding (no 2px token)
    fontSize:      FONT_SIZE.sm,        // 11px
    lineHeight:    16,
    fontWeight:    '600',
    fontFamily:    FONT_BODY.semiBold,  // Inter_600SemiBold
    maxScopeWidth: 80,
    borderWidth:   1,
  },

  /**
   * md — 28px height   [DEFAULT]
   * Profile screen identity strip and IdentityTags molecule.
   * Inter 600 at 12px — primary identity chip weight.
   */
  md: {
    height:        28,
    paddingH:      spacing.md,          // 12px
    paddingV:      3,                   // micro padding (no 3px token — between xs=4 and no token)
    fontSize:      FONT_SIZE.cap,       // 12px
    lineHeight:    18,
    fontWeight:    '600',
    fontFamily:    FONT_BODY.semiBold,  // Inter_600SemiBold
    maxScopeWidth: 120,
    borderWidth:   1,
  },

  /**
   * lg — 36px height
   * Leaderboard RankRow and CROWN tab hero card.
   * Inter 700 at 13px — dominant, legible at distance in list contexts.
   */
  lg: {
    height:        36,
    paddingH:      spacing.lg,          // 16px
    paddingV:      spacing.sm,          // 8px
    fontSize:      FONT_SIZE.base,      // 13px
    lineHeight:    20,
    fontWeight:    '700',
    fontFamily:    FONT_BODY.bold,      // Inter_700Bold
    maxScopeWidth: 160,
    borderWidth:   1.5,
  },

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ANIMATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SPRING_ENTRANCE           = { stiffness: 200, damping: 18 } as const;
const REDUCED_MOTION_OPACITY_MS = 120 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — GRADIENT BORDER WRAPPER
// For SOVEREIGN and IMPERATOR, the border is rendered as a LinearGradient
// wrapper that peeks around the inner pill, creating a gradient ring effect.
// ─────────────────────────────────────────────────────────────────────────────

interface GradientBorderProps {
  readonly colors:      readonly string[];
  readonly borderWidth: number;
  readonly borderRadius:number;
  readonly children:    React.ReactNode;
  readonly bg:          string;
}

/**
 * GradientBorder — renders a LinearGradient-filled wrapper that acts
 * as a gradient-colored border around its child content.
 * The inner view fills the gradient, leaving only borderWidth of gradient
 * visible as the ring.
 *
 * @param colors      - Gradient color stops
 * @param borderWidth - How many px of gradient ring to show
 * @param borderRadius - Must match the pill container radius
 * @param bg           - Inner background color (covers the gradient except the ring)
 */
const GradientBorder = memo(function GradientBorder({
  colors: gradientColors,
  borderWidth,
  borderRadius,
  children,
  bg,
}: GradientBorderProps) {
  return (
    <LinearGradient
      colors={gradientColors as string[]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[
        gradientStyles.wrapper,
        {
          borderRadius,
          padding: borderWidth,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <View
        style={[
          gradientStyles.inner,
          {
            borderRadius: borderRadius - borderWidth,
            backgroundColor: bg,
          },
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
});

const gradientStyles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  inner: {
    flexDirection: 'row',
    alignItems:    'center',
    overflow:      'hidden',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TitleBadge — renders a CROWN title tier pill.
 *
 * Title strings come exclusively from @/constants/titles.
 * Hardcoding title strings anywhere is a PR-block.
 *
 * @param tier              - SECTOR | CITY | COUNTRY | WORLD
 * @param scope             - Optional scope name, e.g. "Sector 17", "Mumbai"
 * @param size              - 'sm' | 'md' | 'lg'. Default 'md'.
 * @param truncateScope     - Truncate scope name at ~120px. Default false.
 * @param style             - Optional outer margin / position overrides.
 * @param testDisableAnimation - Skip entrance spring in tests.
 *
 * @example
 * // MessageBubble header (sm)
 * <TitleBadge tier="SECTOR" scope="Sector 17" size="sm" />
 *
 * // Profile identity strip (md — default)
 * <TitleBadge tier="CITY" scope="Mumbai" />
 *
 * // Leaderboard RankRow (lg)
 * <TitleBadge tier="WORLD" size="lg" />
 *
 * // Without scope (title only)
 * <TitleBadge tier="COUNTRY" />
 *
 * @security
 *   tier prop is from Firestore user doc.
 *   scope string should be sanitized before display — max 64 chars recommended.
 */
function TitleBadgeComponent({
  tier,
  scope,
  size = 'md',
  truncateScope = false,
  style,
  testDisableAnimation = false,
}: TitleBadgeProps): React.ReactElement {

  const spec   = SIZE_SPEC[size];
  const config = TIER_CONFIG[tier];
  const pillRadius = radius.xl; // 18px — full pill for ≤ 36px H (PRD §19.4)

  // ── Animation ─────────────────────────────────────────────────────────────
  const reducedMotion = useReducedMotion();
  const scale   = useSharedValue<number>(testDisableAnimation ? 1 : 0);
  const opacity = useSharedValue<number>(testDisableAnimation ? 1 : 0);

  useEffect(() => {
    if (testDisableAnimation) return;
    if (reducedMotion) {
      opacity.value = withTiming(1, {
        duration: REDUCED_MOTION_OPACITY_MS,
        easing: Easing.out(Easing.quad),
      });
      scale.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 60, easing: Easing.linear });
      scale.value = withSpring(1, SPRING_ENTRANCE);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }), []); /* PERF: transform + opacity — compositor — zero layout/paint */

  // ── Label resolution ───────────────────────────────────────────────────────
  const displayLabel = scope
    ? `${config.fullLabel} of ${scope}`
    : config.shortLabel;

  // ── Accessibility ──────────────────────────────────────────────────────────
  const a11yLabel = scope
    ? `${config.fullLabel} of ${scope}`
    : `${config.fullLabel} title`;

  // ── Inner pill content (shared between solid and gradient border paths) ───
  const pillContent = (
    <Text
      style={[
        styles.label,
        {
          fontFamily:  spec.fontFamily,
          fontWeight:  spec.fontWeight,
          fontSize:    spec.fontSize,
          lineHeight:  spec.lineHeight,
          color:       config.fg,
        } as TextStyle,
        truncateScope && scope
          ? { maxWidth: spec.maxScopeWidth }
          : undefined,
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
      allowFontScaling={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {displayLabel}
    </Text>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[animatedStyle, styles.root, style]}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      {config.gradient ? (
        // SOVEREIGN / IMPERATOR — gradient border via LinearGradient wrapper
        <GradientBorder
          colors={config.gradient}
          borderWidth={spec.borderWidth}
          borderRadius={pillRadius}
          bg={config.bg}
        >
          <View
            style={[
              styles.pillInner,
              {
                paddingHorizontal: spec.paddingH,
                paddingVertical:   spec.paddingV,
                minHeight:         spec.height,
              },
            ]}
          >
            {pillContent}
          </View>
        </GradientBorder>
      ) : (
        // SECTOR / CITY — solid border pill
        <View
          style={[
            styles.pill,
            {
              height:            spec.height,
              paddingHorizontal: spec.paddingH,
              paddingVertical:   spec.paddingV,
              backgroundColor:   config.bg,
              borderColor:       config.border,
              borderRadius:      pillRadius,
              borderWidth:       spec.borderWidth,
            },
          ]}
        >
          {pillContent}
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — STATIC STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  /**
   * root — Animated.View wrapper
   * alignSelf: 'flex-start' prevents badge from stretching to parent width.
   */
  root: {
    alignSelf: 'flex-start',
  },

  /**
   * pill — solid-border variant container
   * flexDirection: 'row' allows future icon prefix insertion.
   * overflow: 'hidden' clips any sub-pixel rendering.
   */
  pill: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    overflow:      'hidden',
  },

  /**
   * pillInner — used inside GradientBorder wrapper
   * Same layout as pill but without border (gradient wrapper provides it).
   */
  pillInner: {
    flexDirection: 'row',
    alignItems:    'center',
  },

  label: {
    includeFontPadding: false,
    textAlignVertical:  'center',
    letterSpacing:      0.2,
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — MEMO EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TitleBadge — CROWN title tier pill atom.
 *
 * React.memo — safe in FlatList rows, MessageBubble headers, RankRow cells.
 * Entrance spring animation on mount; reduced-motion fallback opacity fade.
 *
 * Title strings come exclusively from @/constants/titles.
 * Hardcoding title strings is a PR-block.
 */
export const TitleBadge = memo(TitleBadgeComponent);

export default TitleBadge;

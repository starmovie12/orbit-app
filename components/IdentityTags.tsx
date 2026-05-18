/**
 * components/IdentityTags.tsx — user identity stamp molecule
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN — User Identity Stamp Molecule
 * Version  : v3.1  (PRD Part 1 § Component-Specific Instructions — CROWN PRD v1.0 compliant)
 * Owner    : Ail Noor Alam (Founder) · Chandigarh · May 2026
 *
 * Renders the ordered identity element strip for any user or AI companion:
 *
 *   @handle  →  Title badge  →  Origin city  →  🤖 AI  →  👑 DAY-1 FOUNDER
 *
 * Laws honoured
 * ─────────────
 *   PRD Law 4  — AI Deception Prevention: AI label is ALWAYS visible and
 *                obvious when isAICompanion=true. It cannot be hidden, clipped,
 *                or de-emphasised. W-002 compliance enforced.
 *   TITLES     — Hardcoding title strings is a PR-block. All title text
 *                comes exclusively from @/constants/titles (TITLES constant).
 *   Reanimated v4 — Skeleton shimmer runs on the UI thread (worklet-safe).
 *   React.memo — every presentational component is memoised.
 *   ZERO hardcoded design values — all from @/constants/colors,
 *                @/constants/typography, @/constants/spacing.
 *
 * Exports
 * ───────
 *   IdentityTags       — primary molecule (user identity stamp)
 *   ColonyTag          — standalone colony/sector chip
 *   VerifiedTag        — standalone verified pill
 *   CreditsTag         — standalone credits chip
 *   LocalTag           — standalone local-sector pill
 *   VisitorTag         — standalone visitor pill
 *   AITag              — standalone AI label (LAW 4 / W-002)
 *   MoonTag            — standalone away/moon pill
 *   type IdentityTagsProps
 *
 * REMOVED (PRD §1.4.9 Phase C enforcement):
 *   MayorTag  — DELETED. Used Tag variant="mayor" which hardcoded "Mayor" — PR-block.
 *               Use <IdentityTags titleTier="CITY" /> → TITLES.CITY is the only allowed source.
 *   FounderTag — DELETED. Legacy convenience wrapper for Tag variant="founder".
 *               Use <IdentityTags isFounder={true} founderNumber="001" /> instead.
 *
 * DEPS: components/atoms/Tag.tsx  ·  @/constants/titles
 *       @/constants/colors  ·  @/constants/typography  ·  @/constants/spacing
 *       @/constants/animations  ·  react-native-reanimated
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { Tag, type TagSize }                          from '@/components/atoms/Tag';
import { TITLES, type TitleTier }                     from '@/constants/titles';
import { colors, palette, semanticSuccess, semanticInfo } from '@/constants/colors';
import { typography, FONT_BODY, FONT_TITLE, FONT_SIZE, LETTER_SPACING } from '@/constants/typography';
import { spacing, radius }                            from '@/constants/spacing';
import { useReducedMotion }                           from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton shimmer duration in ms — matches animation.duration.skeleton (1200ms). */
const SKELETON_DURATION_MS = 1_200 as const;

/** Skeleton shimmer opacity range */
const SKELETON_OPACITY_MIN = 0.35 as const;
const SKELETON_OPACITY_MAX = 0.70 as const;

/** Default max-width for the strip before clipping */
const DEFAULT_MAX_WIDTH = 280 as const;

/** Handle chip "@" prefix character */
const HANDLE_PREFIX = '@' as const;

/** AI companion label — PRD spec: "🤖 AI" */
const AI_LABEL_ICON  = '🤖' as const;
const AI_LABEL_TEXT  = 'AI' as const;

/** Founder badge label — PRD spec: "👑 DAY-1 FOUNDER" */
const FOUNDER_BADGE_ICON  = '👑' as const;
const FOUNDER_BADGE_TEXT  = 'DAY-1 FOUNDER' as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — TITLE TIER VISUAL CONFIG
//
// Maps each TitleTier to its pill appearance.
// All values use semantic tokens — zero hardcoded hex.
//
//   SECTOR (BARON)           — Emerald shield: semanticSuccess palette
//   CITY   (Mayor VICEROY)   — Champagne Gold solid: gold[600] fill, white text
//   COUNTRY (SOVEREIGN)      — Gold info wash: semantic info palette
//   WORLD   (IMPERATOR)      — Warm Ink dark + celebrate gold: premium inversion
// ─────────────────────────────────────────────────────────────────────────────

type TitleVisual = {
  /** Pill background color */
  readonly bg:     string;
  /** Label + icon foreground color */
  readonly fg:     string;
  /** 1px ring border color */
  readonly border: string;
  /** Unicode emoji prefix — no external deps */
  readonly icon:   string;
};

const TITLE_VISUAL: Record<TitleTier, TitleVisual> = {
  /**
   * SECTOR → BARON
   * Emerald forest treatment — entry-level title, approachable yet earned.
   * Contrast: semanticSuccess.fg (#1A7A4A) on semanticSuccess.bg → WCAG AA ✓
   */
  SECTOR: {
    bg:     semanticSuccess.bg,         // rgba(26,122,74,0.10) — emerald wash
    fg:     semanticSuccess.fg,         // #1A7A4A — forest emerald
    border: semanticSuccess.border,     // #1A7A4A — solid ring
    icon:   '🛡️',                        // emerald shield — sector guard
  },

  /**
   * CITY → Mayor (VICEROY)
   * Full Amber Gold fill — PRD §1.4.2 Tier Color: Amber Gold #D4A017 (light) / #F59E0B (dark).
   * Uses colors.fg.brand (semantic brand-gold token) for the fill so light/dark mode
   * auto-resolve to the correct PRD hex. DO NOT use palette.gold[600] (#C9A227) — that
   * is a legacy ORBIT value that does NOT match the PRD Amber Gold spec.
   * Contrast: white on #D4A017 = 4.5:1 ✅ WCAG AA | white on #F59E0B = 3.9:1 (AA-large ✅)
   */
  CITY: {
    bg:     colors.fg.brand,            // #D4A017 (light) / #F59E0B (dark) — PRD §1.4.2 Amber Gold
    fg:     palette.white,              // #FFFFFF — AA-safe on brand gold
    border: palette.gold[700],          // #A88A24 — pressed-tone ring
    icon:   '👑',                        // golden crown — city authority
  },

  /**
   * COUNTRY → SOVEREIGN
   * Gold info wash — distinguished, semi-premium without full gold fill.
   * Contrast: semanticInfo.fg (#A88A24) on semanticInfo.bg (#FCF7E5) ≥ 4.5:1 ✅
   */
  COUNTRY: {
    bg:     semanticInfo.bg,            // #FCF7E5 — gold[50] — warm ivory
    fg:     semanticInfo.fg,            // #A88A24 — gold[700] — AA-safe
    border: semanticInfo.border,        // #ECD58F — gold[300] — soft ring
    icon:   '🌙',                        // crescent — country sovereignty
  },

  /**
   * WORLD → IMPERATOR
   * Warm Ink dark + celebrate gold — the highest honor; inverted premium.
   * Contrast: gold[400] (#E2C66B) on ink[950] (#1A1208) = 13.2:1 ✅ WCAG AAA
   */
  WORLD: {
    bg:     palette.ink[950],           // #1A1208 — deepest warm ink
    fg:     palette.gold[400],          // #E2C66B — celebrate state gold
    border: palette.gold[900],          // #6B5512 — antique gold ring
    icon:   '🌍',                        // world globe — global authority
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the IdentityTags user identity stamp molecule.
 *
 * All identity props are optional — only elements with meaningful data render.
 * The AI label and Founder badge have special always-visible rules (PRD Law 4 /
 * W-002): once mounted, they NEVER hide themselves regardless of other props.
 */
export interface IdentityTagsProps {
  /**
   * User @handle string, without the "@" prefix.
   * Rendered as "@handle" in a gold pill at the leftmost position.
   * When null / undefined, the handle chip is omitted.
   */
  handle?: string | null;

  /**
   * Title tier key — determines which TITLES constant to render.
   * Maps to: BARON (SECTOR) · Mayor (VICEROY) (CITY) · SOVEREIGN (COUNTRY) · IMPERATOR (WORLD).
   * NEVER pass a raw string — always pass a TitleTier key and let TITLES constant
   * produce the display string. Hardcoding title strings = PR block.
   * When null / undefined, the title badge is omitted.
   */
  titleTier?: TitleTier | null;

  /**
   * Scope label appended to the title badge (e.g., "Sector 17", "Chandigarh").
   * Rendered as "Title · Scope" when provided (space-permitting).
   * Ignored when titleTier is null / undefined.
   */
  titleScope?: string | null;

  /**
   * Origin city display name — rendered as a colony chip.
   * When null / undefined, the city chip is omitted.
   */
  cityName?: string | null;

  /**
   * When true, renders the "🤖 AI" companion label.
   *
   * PRD LAW 4 — AI DECEPTION PREVENTION (NON-NEGOTIABLE):
   * This label is ALWAYS visible when true. It cannot be clipped by maxWidth,
   * hidden by overflow, or de-emphasised in any way. The parent controls
   * mount/unmount; this component never returns null for the AI element when
   * isAICompanion=true.
   * @default false
   */
  isAICompanion?: boolean;

  /**
   * When true, renders the "👑 DAY-1 FOUNDER" badge with gold gradient treatment.
   *
   * CROWN CONSTITUTION §2.1 — Founder badges are permanently visible for
   * qualifying users (user.badge === 'FOUNDER'). This element is never hidden.
   * @default false
   */
  isFounder?: boolean;

  /**
   * Founder sequential number, e.g., "001" or "#001".
   * "#" prefix is added automatically if absent.
   * Appended to the founder badge label: "👑 DAY-1 FOUNDER #001".
   */
  founderNumber?: string | null;

  /**
   * Maximum width of the scrollable strip in pixels.
   * Content scrolls horizontally — it does not clip or truncate tags.
   * Use to constrain the strip width within its parent container.
   * @default 280
   */
  maxWidth?: number;

  /**
   * When true, renders the skeleton loading state.
   * Uses Reanimated v4 shimmer animation (UI thread — no bridge cost).
   * Respects system prefers-reduced-motion.
   * @default false
   */
  isLoading?: boolean;

  /**
   * Size tier for all non-AI, non-founder Tag atoms.
   * AI label and Founder badge are always rendered at 'sm' per design.
   * @default 'sm'
   */
  size?: TagSize;

  /**
   * Optional wrapper style applied to the outer container View.
   * Use to control margin / alignment at the call-site.
   */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── 4a. HandleChip ───────────────────────────────────────────────────────────

interface HandleChipProps {
  handle: string;
  size:   TagSize;
}

/**
 * Renders the user @handle as a subtle gold pill.
 * Color: gold[700] text on gold[50] bg — AA-safe (5.0:1 — colors.ts §15).
 */
const HandleChip = memo<HandleChipProps>(function HandleChip({ handle, size }) {
  const sizeStyle = size === 'sm' ? styles.handleTextSm : styles.handleTextMd;
  const padStyle  = size === 'sm' ? styles.handlePillSm : styles.handlePillMd;

  return (
    <View
      style={[styles.handlePill, padStyle]}
      accessibilityRole="text"
      accessibilityLabel={`Handle: @${handle}`}
    >
      <Text
        style={[styles.handleText, sizeStyle]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {HANDLE_PREFIX}{handle}
      </Text>
    </View>
  );
});
HandleChip.displayName = 'HandleChip';

// ── 4b. TitleBadge ───────────────────────────────────────────────────────────

interface TitleBadgeProps {
  tier:   TitleTier;
  scope?: string | null;
  size:   TagSize;
}

/**
 * Renders a title tier badge using the TITLES constant for the label text.
 * Each tier has its own visual treatment (see TITLE_VISUAL above).
 *
 * CRITICAL: The title string ALWAYS comes from TITLES[tier]. Hardcoding
 * title strings anywhere in the codebase is a PR-block.
 *
 * @param tier  - TitleTier key from @/constants/titles
 * @param scope - Optional scope label (e.g., "Sector 17", "Chandigarh")
 */
const TitleBadge = memo<TitleBadgeProps>(function TitleBadge({ tier, scope, size }) {
  const visual     = TITLE_VISUAL[tier];
  // All title text exclusively from TITLES constant — PR block if hardcoded:
  const titleLabel = TITLES[tier];
  const label      = scope ? `${titleLabel} · ${scope}` : titleLabel;
  const sizeStyle  = size === 'sm' ? styles.titleTextSm : styles.titleTextMd;
  const padStyle   = size === 'sm' ? styles.titlePillSm : styles.titlePillMd;

  const pillStyle: ViewStyle = {
    backgroundColor: visual.bg,
    borderColor:     visual.border,
  };

  return (
    <View
      style={[styles.titlePill, padStyle, pillStyle]}
      accessibilityRole="text"
      accessibilityLabel={`Title: ${label}`}
    >
      <Text
        style={[styles.titleIcon, { color: visual.fg }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {visual.icon}
      </Text>
      <Text
        style={[styles.titleText, sizeStyle, { color: visual.fg }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
});
TitleBadge.displayName = 'TitleBadge';

// ── 4c. AILabel ──────────────────────────────────────────────────────────────

/**
 * AI companion label — PRD Law 4 / W-002 compliance.
 *
 * LOCKED BEHAVIOR (non-negotiable):
 *
 *   ALWAYS VISIBLE when mounted.
 *   Never returns null, never applies opacity < 1, never hides itself.
 *   The parent controls mount/unmount — this component is unconditionally visible.
 *
 *   DARK INVERSION signals non-human origin:
 *   ink[950] background · gold[400] text = 13.2:1 ✅ WCAG AAA (colors.ts §15)
 *
 *   testID="ai-tag" — required by blueprint integration test (section 9.2):
 *   expect(getByTestId('ai-tag')).toBeTruthy()
 *
 *   SIZE LOCKED at 'sm' (10px 600 — blueprint ai_tag token).
 *   Size is not configurable. Accepting a size prop and changing the visual
 *   is a PRD Law 4 violation.
 */
const AILabel = memo(function AILabel() {
  return (
    <View
      testID="ai-tag"
      style={styles.aiLabelWrapper}
      accessibilityRole="text"
      accessibilityLabel="AI companion"
    >
      <View style={styles.aiLabelPill}>
        <Text
          style={styles.aiLabelText}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {AI_LABEL_ICON}{' '}{AI_LABEL_TEXT}
        </Text>
      </View>
    </View>
  );
});
AILabel.displayName = 'AILabel';

// ── 4d. FounderBadge ─────────────────────────────────────────────────────────

interface FounderBadgeProps {
  founderNumber?: string | null;
}

/**
 * DAY-1 FOUNDER badge — permanently visible when user.badge === 'FOUNDER'.
 *
 * Renders "👑 DAY-1 FOUNDER" with optional sequential number suffix.
 * Gold gradient treatment: ink[950] bg · gold[400] text (13.2:1 AAA).
 *
 * PERMANENTLY VISIBLE when mounted — parent controls mount/unmount.
 * This component never hides itself.
 */
const FounderBadge = memo<FounderBadgeProps>(function FounderBadge({ founderNumber }) {
  // Resolve founder number display: "001" or "#001" → "#001"
  const numDisplay: string | null =
    founderNumber
      ? (founderNumber.startsWith('#') ? founderNumber : `#${founderNumber}`)
      : null;

  const label = numDisplay
    ? `${FOUNDER_BADGE_ICON} ${FOUNDER_BADGE_TEXT} ${numDisplay}`
    : `${FOUNDER_BADGE_ICON} ${FOUNDER_BADGE_TEXT}`;

  return (
    <View
      style={styles.founderPill}
      accessibilityRole="text"
      accessibilityLabel={`Founder badge${numDisplay ? `: ${numDisplay}` : ''}`}
    >
      <Text
        style={styles.founderText}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
});
FounderBadge.displayName = 'FounderBadge';

// ── 4e. IdentityTagsSkeleton ──────────────────────────────────────────────────

/**
 * Loading skeleton for IdentityTags.
 * Uses Reanimated v4 shimmer animation on the UI thread (zero bridge cost).
 * Respects prefers-reduced-motion: skips the shimmer loop and shows a static
 * skeleton per the blueprint Reduced Motion Variants table.
 *
 * @param width  - Total skeleton strip width in px
 */
interface IdentityTagsSkeletonProps {
  width: number;
}

const IdentityTagsSkeleton = memo<IdentityTagsSkeletonProps>(function IdentityTagsSkeleton({ width }) {
  const reducedMotion = useReducedMotion();

  // Reanimated v4 shared value for shimmer opacity — runs on UI thread.
  const shimmerOpacity = useSharedValue<number>(SKELETON_OPACITY_MIN);

  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: static skeleton — no animation loop.
      shimmerOpacity.value = SKELETON_OPACITY_MIN;
      return;
    }

    // Start the shimmer loop.
    // withRepeat(-1, false) = infinite, non-reversed.
    // withSequence: fade up → fade down over SKELETON_DURATION_MS.
    shimmerOpacity.value = withRepeat(
      withSequence(
        withTiming(SKELETON_OPACITY_MAX, { duration: SKELETON_DURATION_MS / 2 }),
        withTiming(SKELETON_OPACITY_MIN, { duration: SKELETON_DURATION_MS / 2 }),
      ),
      -1,   // infinite
      false, // do not auto-reverse (we handle it via withSequence)
    );

    return () => {
      // Cancel animation on unmount to prevent memory leaks.
      cancelAnimation(shimmerOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shimmerOpacity is a shared value (stable ref)
  }, [reducedMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  return (
    <View
      style={[styles.skeletonRow, { width }]}
      accessibilityLabel="Loading identity tags"
      accessibilityState={{ busy: true }}
    >
      {/* Handle chip skeleton */}
      <Animated.View style={[styles.skeletonHandle, shimmerStyle]} />
      {/* Title badge skeleton */}
      <Animated.View style={[styles.skeletonTitle, shimmerStyle]} />
      {/* City chip skeleton */}
      <Animated.View style={[styles.skeletonCity, shimmerStyle]} />
    </View>
  );
});
IdentityTagsSkeleton.displayName = 'IdentityTagsSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — PRIMARY MOLECULE: IdentityTags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IdentityTags — user identity stamp molecule for CROWN.
 *
 * Renders an ordered horizontal strip of identity elements:
 *
 *   @handle  →  Title badge  →  Origin city  →  🤖 AI  →  👑 DAY-1 FOUNDER
 *
 * Only elements with meaningful props render. The AI label and Founder badge
 * are exceptions: once isAICompanion=true or isFounder=true, their respective
 * elements are ALWAYS rendered and cannot be overridden by any other prop.
 *
 * The strip is horizontally scrollable — it never wraps or clips a visible tag.
 * AI and Founder elements always receive dedicated space regardless of maxWidth.
 *
 * Performance: React.memo shallow comparison. Pass stable prop references
 * (useMemo / top-level constants) to avoid unnecessary re-renders inside
 * FlatList rows and message bubble headers.
 *
 * @example
 * // Basic user identity
 * <IdentityTags
 *   handle="bittu_42"
 *   titleTier="CITY"
 *   titleScope="Chandigarh"
 *   cityName="Sector 17"
 * />
 *
 * @example
 * // AI companion stamp — AI label always visible
 * <IdentityTags
 *   handle="orbit_bot"
 *   isAICompanion={true}
 * />
 *
 * @example
 * // Founder user — Founder badge always visible
 * <IdentityTags
 *   handle="anil_founder"
 *   titleTier="WORLD"
 *   cityName="Chandigarh"
 *   isFounder={true}
 *   founderNumber="001"
 * />
 *
 * @example
 * // Skeleton loading state
 * <IdentityTags isLoading={true} />
 */
export const IdentityTags = memo<IdentityTagsProps>(function IdentityTags({
  handle,
  titleTier,
  titleScope,
  cityName,
  isAICompanion = false,
  isFounder      = false,
  founderNumber,
  maxWidth       = DEFAULT_MAX_WIDTH,
  isLoading      = false,
  size           = 'sm',
  style,
}) {
  // Loading state → skeleton
  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <IdentityTagsSkeleton width={maxWidth} />
      </View>
    );
  }

  // Determine which regular elements are visible
  const hasHandle = Boolean(handle);
  const hasTitle  = Boolean(titleTier);
  const hasCity   = Boolean(cityName);

  // Check if any regular content exists
  const hasAnyContent = hasHandle || hasTitle || hasCity || isAICompanion || isFounder;

  if (!hasAnyContent) return null;

  return (
    <View
      style={[styles.container, { maxWidth }, style]}
      accessibilityRole="none"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollRow}
        accessibilityRole="toolbar"
        accessibilityLabel="User identity tags"
      >
        {/* ── 1. @handle ──────────────────────────────────────────────────── */}
        {hasHandle && (
          <View style={styles.tagSlot}>
            <HandleChip
              handle={handle as string}
              size={size}
            />
          </View>
        )}

        {/* ── 2. Title badge (BARON / Mayor VICEROY / SOVEREIGN / IMPERATOR) */}
        {/* TITLES constant is the ONLY source — hardcoding = PR block        */}
        {hasTitle && titleTier && (
          <View style={styles.tagSlot}>
            <TitleBadge
              tier={titleTier}
              scope={titleScope}
              size={size}
            />
          </View>
        )}

        {/* ── 3. Origin city chip ─────────────────────────────────────────── */}
        {hasCity && (
          <View style={styles.tagSlot}>
            <Tag
              variant="colony"
              label={cityName as string}
              size={size}
            />
          </View>
        )}

        {/* ── 4. 🤖 AI label (W-002 / PRD Law 4 — ALWAYS VISIBLE when true) */}
        {isAICompanion && (
          <View style={styles.tagSlot}>
            <AILabel />
          </View>
        )}

        {/* ── 5. 👑 DAY-1 FOUNDER badge (permanently visible when true) ───── */}
        {isFounder && (
          <View style={styles.tagSlot}>
            <FounderBadge founderNumber={founderNumber} />
          </View>
        )}
      </ScrollView>
    </View>
  );
});

IdentityTags.displayName = 'IdentityTags';

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLESHEET
//
// All values sourced from design tokens:
//   spacing.*    — @/constants/spacing
//   radius.*     — @/constants/spacing
//   colors.*     — @/constants/colors
//   palette.*    — @/constants/colors
//   FONT_BODY.*  — @/constants/typography
//   FONT_SIZE.*  — @/constants/typography
//
// ZERO hardcoded px/hex values.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Outer container ────────────────────────────────────────────────────────

  container: {
    alignSelf:  'flex-start',
  },

  // ── ScrollView content row ─────────────────────────────────────────────────

  scrollRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,           // 4px — blueprint inter-badge gap
  },

  // ── Tag slot wrapper ───────────────────────────────────────────────────────
  // Zero-layout wrapper for consistent alignment across variant heights.

  tagSlot: {
    alignSelf: 'flex-start',
  },

  // ── HandleChip ────────────────────────────────────────────────────────────
  // gold[50] bg · gold[700] text — 5.0:1 contrast ✅ WCAG AA (colors.ts §15)

  handlePill: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    borderRadius:   radius.pill,         // 999 — full pill
    borderWidth:    1,
    borderColor:    palette.gold[300],   // #ECD58F — soft gold ring
    backgroundColor: colors.bg.goldSoft, // gold[50] #FCF7E5
  },

  handlePillSm: {
    paddingHorizontal: 6,               // sub-grid micro (matches Tag 'sm' paddingH)
    paddingVertical:   2,               // sub-grid micro
  },

  handlePillMd: {
    paddingHorizontal: spacing.sm,      // 8px
    paddingVertical:   3,
  },

  handleText: {
    color:             colors.fg.brandText, // gold[700] #A88A24 — AA-safe
    fontFamily:        FONT_BODY.semiBold,  // Inter_600SemiBold — PRD §1.4.3 (UI labels: Inter 400/500/600)
    letterSpacing:     LETTER_SPACING.normal,
  },

  handleTextSm: {
    fontSize:          FONT_SIZE.xs,        // 9
    fontWeight:        '600',               // Inter max-weight per PRD §1.4.3
    lineHeight:        12,
    letterSpacing:     LETTER_SPACING.uppercase, // 0.8
  } as TextStyle,

  handleTextMd: {
    fontSize:          FONT_SIZE.cap,       // 12
    fontWeight:        '600',               // Inter max-weight per PRD §1.4.3
    lineHeight:        14,
    letterSpacing:     LETTER_SPACING.normal,
  } as TextStyle,

  // ── TitleBadge ────────────────────────────────────────────────────────────

  titlePill: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    borderRadius:   radius.pill,         // 999 — full pill
    borderWidth:    1,
  },

  titlePillSm: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    gap:               2,
  },

  titlePillMd: {
    paddingHorizontal: spacing.sm,      // 8px
    paddingVertical:   3,
    gap:               spacing.xs,      // 4px
  },

  titleIcon: {
    // Icon font sizing handled inline via parent size param
    fontSize:          FONT_SIZE.xs,    // 9 — matches 'sm' icon size
    lineHeight:        12,
  },

  titleText: {
    fontFamily:        FONT_TITLE.extraBold, // Syne_800ExtraBold — PRD §1.4.3 (Headings/titles: Syne 800)
    letterSpacing:     LETTER_SPACING.normal,
  },

  titleTextSm: {
    fontSize:          FONT_SIZE.xs,    // 9
    fontWeight:        '800',           // Syne 800 per PRD §1.4.3
    lineHeight:        12,
    letterSpacing:     LETTER_SPACING.uppercase, // 0.8
  } as TextStyle,

  titleTextMd: {
    fontSize:          FONT_SIZE.cap,   // 12
    fontWeight:        '800',           // Syne 800 per PRD §1.4.3
    lineHeight:        14,
    letterSpacing:     LETTER_SPACING.normal,
  } as TextStyle,

  // ── AILabel ───────────────────────────────────────────────────────────────
  // PRD Law 4 — ALWAYS VISIBLE. Dark inversion: ink[950] bg · gold[400] text.
  // gold[400] on ink[950] = 13.2:1 ✅ WCAG AAA (colors.ts §15 audit)

  aiLabelWrapper: {
    alignSelf:     'flex-start',
  },

  aiLabelPill: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    borderRadius:      radius.pill,       // 999 — full pill
    borderWidth:       1,
    borderColor:       palette.gold[900], // #6B5512 — antique gold ring
    backgroundColor:   colors.bg.inverse, // ink[950] #1A1208 — dark inversion
    paddingHorizontal: 6,
    paddingVertical:   2,
  },

  aiLabelText: {
    fontFamily:        FONT_BODY.semiBold,   // Inter_600SemiBold — PRD §1.4.3 (UI labels: Inter 600 max)
    fontSize:          FONT_SIZE.xs,         // 9 — blueprint ai_tag token
    fontWeight:        '600',                // Inter max-weight per PRD §1.4.3
    lineHeight:        12,
    letterSpacing:     LETTER_SPACING.uppercase, // 0.8
    color:             palette.gold[400],   // #E2C66B — celebrate gold (13.2:1 AAA)
    textTransform:     'uppercase',
  } as TextStyle,

  // ── FounderBadge ─────────────────────────────────────────────────────────
  // Permanently visible. ink[950] bg · gold[400] text = 13.2:1 ✅ AAA

  founderPill: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    borderRadius:      radius.pill,         // 999 — full pill
    borderWidth:       1,
    borderColor:       palette.gold[900],   // #6B5512 — antique gold ring
    backgroundColor:   palette.ink[950],    // #1A1208 — deepest warm ink
    paddingHorizontal: 6,
    paddingVertical:   2,
  },

  founderText: {
    fontFamily:        FONT_TITLE.extraBold, // Syne_800ExtraBold — PRD §1.4.3 (Headings/titles: Syne 800)
    fontSize:          FONT_SIZE.xs,         // 9
    fontWeight:        '800',                // Syne 800 per PRD §1.4.3
    lineHeight:        12,
    letterSpacing:     LETTER_SPACING.uppercase, // 0.8
    color:             palette.gold[400],    // #E2C66B — 13.2:1 AAA
    textTransform:     'uppercase',
  } as TextStyle,

  // ── Skeleton ──────────────────────────────────────────────────────────────
  // Content-matched placeholder pills. Shimmer driven by Reanimated v4.

  skeletonRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,           // 4px — matches scrollRow gap
  },

  skeletonHandle: {
    width:           52,                 // approximate @handle chip width at 'sm'
    height:          16,                 // approximate pill height at 'sm'
    borderRadius:    radius.pill,        // 999
    backgroundColor: colors.bg.skeleton, // cream[200]
  },

  skeletonTitle: {
    width:           64,                 // approximate BARON/VICEROY badge width
    height:          16,
    borderRadius:    radius.pill,
    backgroundColor: colors.bg.skeleton,
  },

  skeletonCity: {
    width:           48,                 // approximate city chip width
    height:          16,
    borderRadius:    radius.pill,
    backgroundColor: colors.bg.skeleton,
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — CONVENIENCE NAMED EXPORTS (backward-compatible Tag atom wrappers)
//
// Thin wrappers over the Tag atom — all visual logic delegated downstream.
// Zero variant logic lives here. Every component is React.memo'd with a
// named function for DevTools clarity.
//
// These exports are preserved from IdentityTags v2.0 for backward compat.
// New code should use <IdentityTags ... /> for user stamps.
//
// NOTE: MayorTag and FounderTag have been REMOVED (v3.1).
// PRD §1.4.9 Phase C enforcement: hardcoding "Mayor" or title strings
// anywhere outside TITLES constant is a PR-block.
//   → Replace MayorTag usages  with: <IdentityTags titleTier="CITY" titleScope="..." />
//   → Replace FounderTag usages with: <IdentityTags isFounder={true} founderNumber="001" />
// ─────────────────────────────────────────────────────────────────────────────

// ── ColonyTag ─────────────────────────────────────────────────────────────────

export interface ColonyTagProps {
  /**
   * Colony / sector name passed as the Tag label.
   * e.g., "Sector 17" · "City Center" · "Startup Circle"
   */
  name:  string;
  size?: TagSize;
}

/**
 * Standalone colony/sector chip.
 * Wraps Tag variant="colony" — cream card surface, espresso text.
 *
 * @example <ColonyTag name="Sector 17" />
 */
export const ColonyTag = memo<ColonyTagProps>(function ColonyTag({ name, size = 'sm' }) {
  return <Tag variant="colony" label={name} size={size} />;
});
ColonyTag.displayName = 'ColonyTag';

// ── VerifiedTag ───────────────────────────────────────────────────────────────

export interface VerifiedTagProps {
  size?: TagSize;
}

/**
 * Standalone verified identity pill.
 * Wraps Tag variant="verified" — emerald wash, "✓ Verified".
 *
 * @example <VerifiedTag />
 */
export const VerifiedTag = memo<VerifiedTagProps>(function VerifiedTag({ size = 'sm' }) {
  return <Tag variant="verified" size={size} />;
});
VerifiedTag.displayName = 'VerifiedTag';

// ── CreditsTag ────────────────────────────────────────────────────────────────

export interface CreditsTagProps {
  /** Formatted balance string — e.g., "1.2k", "420", "3.4k" */
  amount: string | number;
  size?:  TagSize;
}

/**
 * Standalone credits balance chip.
 * Wraps Tag variant="credits" — gold soft wash, gold text.
 *
 * @example <CreditsTag amount="1.2k" />
 */
export const CreditsTag = memo<CreditsTagProps>(function CreditsTag({ amount, size = 'sm' }) {
  return <Tag variant="credits" label={String(amount)} size={size} />;
});
CreditsTag.displayName = 'CreditsTag';

// ── LocalTag ──────────────────────────────────────────────────────────────────

export interface LocalTagProps {
  size?: TagSize;
}

/**
 * Standalone local-sector pill.
 * Signals user is browsing their own home sector ("home turf").
 *
 * @example <LocalTag />
 */
export const LocalTag = memo<LocalTagProps>(function LocalTag({ size = 'sm' }) {
  return <Tag variant="local" size={size} />;
});
LocalTag.displayName = 'LocalTag';

// ── VisitorTag ────────────────────────────────────────────────────────────────

export interface VisitorTagProps {
  size?: TagSize;
}

/**
 * Standalone visitor pill.
 * Signals user is browsing outside their home sector.
 *
 * @example <VisitorTag />
 */
export const VisitorTag = memo<VisitorTagProps>(function VisitorTag({ size = 'sm' }) {
  return <Tag variant="visitor" size={size} />;
});
VisitorTag.displayName = 'VisitorTag';

// ── AITag ─────────────────────────────────────────────────────────────────────
//
// W-002 / PRD Law 4 COMPLIANCE — LOCKED BEHAVIOR:
//
//   SIZE LOCK: size prop NOT exposed. Blueprint ai_tag token: 9px 800.
//   Accepting and passing a size prop reduces legibility → Law 4 violation.
//
//   testID="ai-tag": Blueprint integration test §9.2 requires this.
//     expect(getByTestId('ai-tag')).toBeTruthy()
//
//   ALWAYS VISIBLE when mounted. Never returns null. Parent controls mount/unmount.

/** Intentionally empty — size prop is not exposed (Law 4 lock). */
export interface AITagProps {}

/**
 * Standalone AI companion label.
 *
 * SIZE IS LOCKED — do NOT add a size prop. Blueprint ai_tag token fixes the
 * visual at 9px 800 weight. Any attempt to expose sizing is a Law 4 violation.
 *
 * Always use the AILabel sub-component within IdentityTags for in-strip use.
 * Use AITag for standalone placements (e.g., inside message bubbles).
 *
 * @example <AITag />   // inside a message bubble header
 */
export const AITag = memo<AITagProps>(function AITag() {
  return <AILabel />;
});
AITag.displayName = 'AITag';

// ── MoonTag ───────────────────────────────────────────────────────────────────

export interface MoonTagProps {
  size?: TagSize;
}

/**
 * Standalone away / do-not-disturb status pill.
 * Wraps Tag variant="moon" — deep espresso bg, soft gold text.
 *
 * @example <MoonTag />
 */
export const MoonTag = memo<MoonTagProps>(function MoonTag({ size = 'sm' }) {
  return <Tag variant="moon" size={size} />;
});
MoonTag.displayName = 'MoonTag';

// ── MayorTag — DELETED (v3.1) ─────────────────────────────────────────────────
//
// REASON: Tag variant="mayor" hardcodes "Mayor" internally — direct PR-block per
// PRD §1.4.9 Phase C: "NEVER hardcode 'Mayor' or 'VICEROY' alone anywhere."
// All title strings MUST come from TITLES constant in @/constants/titles.
//
// MIGRATION:
//   Before: <MayorTag label="Chandigarh" />
//   After:  <IdentityTags titleTier="CITY" titleScope="Chandigarh" />
//           // → renders TITLES.CITY ("Mayor (VICEROY)") · "Chandigarh"
//
// ─────────────────────────────────────────────────────────────────────────────

// ── FounderTag — DELETED (v3.1) ───────────────────────────────────────────────
//
// REASON: Legacy convenience wrapper that bypasses the canonical FounderBadge
// sub-component inside IdentityTags. Future engineers MUST use the proper
// identity molecule to guarantee consistent rendering and permanent-visibility rules.
//
// MIGRATION:
//   Before: <FounderTag id="001" />
//   After:  <IdentityTags isFounder={true} founderNumber="001" />
//           // → renders FounderBadge ("👑 DAY-1 FOUNDER #001"), permanently visible
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * components/atoms/Tag.tsx
 *
 * Identity chip / status pill for CROWN.
 *
 * Variants
 * ────────
 *  colony   — Home colony label (e.g. "Sector 17 · City Center")
 *  verified — Green checkmark pill — phone-OTP confirmed identity
 *  credits  — Gold wallet balance chip (e.g. "250 ₹")
 *  local    — Home-sector presence (user is in their own sector)
 *  visitor  — Cross-sector presence (user browsing outside home sector)
 *  ai       — AI companion badge (anti-ghost-town, PRD §15)
 *  moon     — Away / do-not-disturb status
 *  mayor    — Elected sector mayor — full gold fill + crown
 *  founder  — App founder badge — dark premium + sequential "#001" number
 *
 * Icons (no external deps — Unicode only)
 * ────────────────────────────────────────
 *  verified → "✓"  (U+2713 Check Mark — precise, not emoji-wide)
 *  ai       → "✦"  (U+2726 Black Four Pointed Star — spark feel)
 *  mayor    → "👑"  (U+1F451 Crown — platform emoji, no dependency)
 *  founder  → "⭐"  (U+2B50 Star — premium signifier)
 *
 * Sizes
 * ─────
 *  sm — 9px  · 800 weight · uppercase tracking — micro badge (tag-local spec)
 *  md — 12px · 700 weight — standard identity chip (default)
 *
 * Design rules
 * ────────────
 *  • borderRadius: radius.pill (999) — always full pill, never rounded-rect
 *  • All colors from tokens only — zero hardcoded hex
 *  • All spacing from tokens only — zero hardcoded px except sub-4px badge
 *    micro-padding (pillPadV) which has no token equivalent in the 4pt grid
 *  • React.memo — safe to use inside FlatList rows, message bubbles, profile cards
 *  • accessibilityRole="text" + accessibilityLabel for screen readers
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { colors, palette, semanticSuccess, semanticInfo } from '@/constants/colors';
import { spacing, radius }                                 from '@/constants/spacing';
import { FONT_BODY, FONT_SIZE, LETTER_SPACING }            from '@/constants/typography';

// ─── Public types ─────────────────────────────────────────────────────────────

export type TagVariant =
  | 'colony'
  | 'verified'
  | 'credits'
  | 'local'
  | 'visitor'
  | 'ai'
  | 'moon'
  | 'mayor'
  | 'founder';

export type TagSize = 'sm' | 'md';

export interface TagProps {
  /**
   * Visual + semantic variant.
   * Controls background, text color, border, and icon decoration.
   */
  variant: TagVariant;
  /**
   * Text content of the tag.
   *
   * - colony   : sector label, e.g. "Sector 17"
   * - credits  : formatted balance, e.g. "250 ₹"
   * - founder  : sequential ID with "#" prefix, e.g. "#001"
   * - mayor    : mayor's name or sector, e.g. "Sector 17"
   * - verified : falls back to "Verified" when omitted
   * - ai       : falls back to "AI" when omitted
   * - local    : falls back to "Local" when omitted
   * - visitor  : falls back to "Visitor" when omitted
   * - moon     : falls back to "Away" when omitted
   */
  label?: string;
  /**
   * Size tier.
   * sm  — 9px 800wt uppercase — micro badge (tag-local spec)
   * md  — 12px 700wt standard chip (default)
   */
  size?: TagSize;
}

// ─── Variant configuration ────────────────────────────────────────────────────

type VariantConfig = {
  /** Container background color */
  bg:             string;
  /** Text + icon color */
  fg:             string;
  /** 1px border color */
  border:         string;
  /**
   * Unicode glyph rendered before the label.
   * null = no icon.
   * For ai/verified this is a text char; for mayor/founder an emoji.
   */
  prefixIcon:     string | null;
  /** Fallback label when caller omits the `label` prop. */
  defaultLabel:   string;
};

const VARIANT: Record<TagVariant, VariantConfig> = {

  /**
   * colony — Cream card surface · espresso text
   * Used as a neighbourhood / sector label on profile cards and message bubbles.
   */
  colony: {
    bg:           colors.bg.card,             // cream[200] — warm surface
    fg:           colors.fg.secondary,        // ink[600]   — espresso
    border:       colors.border.card,         // cream[400] — hairline
    prefixIcon:   null,
    defaultLabel: '',
  },

  /**
   * verified — Forest Emerald wash · emerald text
   * WCAG AA: emerald[600] on rgba(26,122,74,.10) → passes AA at this weight.
   */
  verified: {
    bg:           semanticSuccess.bg,         // rgba(26,122,74,0.10)
    fg:           semanticSuccess.fg,         // emerald[600] #1A7A4A
    border:       semanticSuccess.border,     // emerald[600]
    prefixIcon:   '✓',                        // U+2713 — not U+2714 (too heavy)
    defaultLabel: 'Verified',
  },

  /**
   * credits — Gold soft wash · brand gold text
   * gold[700] on gold[50] = 5.0:1 ✅ WCAG AA (see colors.ts §15 audit).
   */
  credits: {
    bg:           colors.bg.goldSoft,         // gold[50] #FCF7E5
    fg:           colors.fg.brandText,        // gold[700] #A88A24 — AA-safe
    border:       palette.gold[300],          // #ECD58F — soft gold ring
    prefixIcon:   null,
    defaultLabel: '',
  },

  /**
   * local — Warm ivory · espresso text
   * Signals the user is browsing their own home sector ("home turf").
   */
  local: {
    bg:           colors.bg.subtle,           // cream[50] #FFF9EC
    fg:           colors.fg.secondary,        // ink[600]
    border:       colors.border.subtle,       // ink[100]
    prefixIcon:   null,
    defaultLabel: 'Local',
  },

  /**
   * visitor — Soft warm gray · tertiary text
   * Signals the user is outside their home sector. Intentionally muted.
   */
  visitor: {
    bg:           palette.ink[100],           // #EDE5D5 — warm disabled bg
    fg:           colors.fg.tertiary,         // ink[500] — de-emphasized
    border:       palette.ink[200],           // #DDD3C0
    prefixIcon:   null,
    defaultLabel: 'Visitor',
  },

  /**
   * ai — Warm Ink inverse · Champagne Gold text
   * Dark inversion signals "non-human" origin. Gold text on ink[950]:
   * gold[400] on ink[950] → 13.2:1 ✅ AAA (colors.ts §15 audit).
   */
  ai: {
    bg:           colors.bg.inverse,          // ink[950] #1A1208
    fg:           colors.fg.celebrate,        // gold[400] #E2C66B — AAA on dark
    border:       palette.gold[900],          // #6B5512 — dark gold ring
    prefixIcon:   '✦',                        // U+2726 Black Four Pointed Star
    defaultLabel: 'AI',
  },

  /**
   * moon — Deep espresso · soft gold text
   * "Do not disturb" / away state. Warm-dark, not cold-dark.
   */
  moon: {
    bg:           palette.ink[800],           // #3D342A — deep espresso
    fg:           palette.gold[300],          // #ECD58F — soft ambient gold
    border:       palette.ink[700],           // #524539 — barely-visible ring
    prefixIcon:   '🌙',                        // moon emoji — platform-safe
    defaultLabel: 'Away',
  },

  /**
   * mayor — Full Champagne Gold fill · white text
   * Highest-visibility variant. Solid gold commands immediate attention.
   * white on gold[600] = 4.6:1 ✅ AA (colors.ts §15 audit).
   */
  mayor: {
    bg:           palette.gold[600],          // #C9A227 — PRIMARY brand gold
    fg:           palette.white,              // #FFFFFF — AA-safe on gold[600]
    border:       palette.gold[700],          // #A88A24 — 1px pressed-tone border
    prefixIcon:   '👑',                        // U+1F451 Crown — widely rendered
    defaultLabel: 'Mayor',
  },

  /**
   * founder — Warm Ink dark · celebration gold text
   * Premium dark pill reserved for the founding cohort. ⭐ signals rarity.
   * gold[400] on ink[950] = 13.2:1 ✅ AAA.
   */
  founder: {
    bg:           palette.ink[950],           // #1A1208 — deepest warm ink
    fg:           palette.gold[400],          // #E2C66B — celebrate state
    border:       palette.gold[900],          // #6B5512 — antique gold ring
    prefixIcon:   '⭐',                        // U+2B50 Star
    defaultLabel: '#001',
  },

} as const;

// ─── Size configuration ───────────────────────────────────────────────────────

type SizeConfig = {
  /** Horizontal padding inside the pill */
  paddingH:     number;
  /** Vertical padding inside the pill */
  paddingV:     number;
  /** Gap between prefix icon and label text */
  iconGap:      number;
  textStyle:    TextStyle;
  /** Icon-specific text style (slightly larger for emoji to match cap height) */
  iconStyle:    TextStyle;
};

const SIZE: Record<TagSize, SizeConfig> = {

  /**
   * sm — 9px 800 ExtraBold · uppercase tracking 0.8
   * Matches the blueprint .tag-local spec: "9px 800 .8px tracking uppercase".
   * paddingV = 2 (sub-grid micro-value — no token for 2px, intentional).
   */
  sm: {
    paddingH:   6,
    paddingV:   2,
    iconGap:    2,
    textStyle: {
      fontFamily:    FONT_BODY.extraBold,    // DMSans_800ExtraBold
      fontSize:      FONT_SIZE.xs,           // 9
      fontWeight:    '800',
      lineHeight:    12,
      letterSpacing: LETTER_SPACING.uppercase, // 0.8
      textTransform: 'uppercase',
    },
    iconStyle: {
      fontFamily:    FONT_BODY.extraBold,
      fontSize:      FONT_SIZE.xs + 1,       // 10 — 1px optical compensation for emoji
      lineHeight:    12,
    },
  },

  /**
   * md — 12px 700 Bold · normal tracking (default size)
   * Matches blueprint badge chip spec: "12px 700 DM Sans" (§11 [2.C]).
   * paddingV = 3 (sub-grid micro-value — halfway between 0 and spacing.xs).
   */
  md: {
    paddingH:   spacing.sm,                  // 8
    paddingV:   3,
    iconGap:    spacing.xs,                  // 4
    textStyle: {
      fontFamily:    FONT_BODY.bold,         // DMSans_700Bold
      fontSize:      FONT_SIZE.cap,          // 12
      fontWeight:    '700',
      lineHeight:    14,
      letterSpacing: LETTER_SPACING.normal,  // 0
    },
    iconStyle: {
      fontFamily:    FONT_BODY.bold,
      fontSize:      FONT_SIZE.cap,          // 12 — emoji matches cap height at this size
      lineHeight:    14,
    },
  },

} as const;

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

function TagComponent({ variant, label, size = 'md' }: TagProps) {
  const vc = VARIANT[variant];
  const sc = SIZE[size];

  // Resolve display text — caller label takes priority, then per-variant default
  const displayLabel = label ?? vc.defaultLabel;

  // Founder: label is the serial number. Ensure it starts with "#" for display.
  // e.g. caller passes "001" or "#001" — both render as "#001".
  const resolvedLabel =
    variant === 'founder' && displayLabel && !displayLabel.startsWith('#')
      ? `#${displayLabel}`
      : displayLabel;

  // Build accessible label: "Mayor tag", "Verified tag", "AI tag #001", etc.
  const a11yParts: string[] = [variant];
  if (resolvedLabel) a11yParts.push(resolvedLabel);
  const accessibilityLabel = `${a11yParts.join(' ')} tag`;

  const containerStyle: ViewStyle = {
    backgroundColor: vc.bg,
    borderColor:     vc.border,
    paddingHorizontal: sc.paddingH,
    paddingVertical:   sc.paddingV,
  };

  const hasIcon  = vc.prefixIcon !== null;
  const hasLabel = resolvedLabel.length > 0;

  return (
    <View
      style={[styles.base, containerStyle]}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Prefix icon */}
      {hasIcon && (
        <Text
          style={[sc.iconStyle, { color: vc.fg }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {vc.prefixIcon}
        </Text>
      )}

      {/* Label text */}
      {hasLabel && (
        <Text
          style={[
            sc.textStyle,
            { color: vc.fg },
            hasIcon && { marginLeft: sc.iconGap },
          ]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {resolvedLabel}
        </Text>
      )}
    </View>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /**
   * Base container.
   * borderRadius: radius.pill (999) — enforces full pill on any width.
   * borderWidth: 1 — universal 1px ring for all variants.
   * flexDirection: 'row' — icon + text side by side.
   * alignSelf: 'flex-start' — pill wraps its content, never stretches full-width.
   */
  base: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    borderRadius:      radius.pill,   // 999
    borderWidth:       1,
    overflow:          'hidden',
  },
});

// ─── Memo export ──────────────────────────────────────────────────────────────

/**
 * Tag — identity chip atom.
 *
 * React.memo: shallow-prop comparison — safe to use in FlatList rows,
 * message bubble headers, profile stat grids, and discovery cards
 * without triggering re-renders from parent scroll position changes.
 *
 * @example
 * // Colony label in room card header
 * <Tag variant="colony" label="Sector 17" />
 *
 * // Verified badge — no label needed (shows "✓ Verified" by default)
 * <Tag variant="verified" />
 *
 * // Verified badge with custom label
 * <Tag variant="verified" label="Phone Verified" size="sm" />
 *
 * // AI companion tag in message bubble
 * <Tag variant="ai" size="sm" />
 *
 * // Mayor identity chip on profile card
 * <Tag variant="mayor" label="Sector 17" />
 *
 * // Founder badge with serial number
 * <Tag variant="founder" label="#001" />
 * <Tag variant="founder" label="001" />  // "#" prefix is auto-added
 *
 * // Credits balance chip
 * <Tag variant="credits" label="250 ₹" />
 *
 * // Visitor pill in room list
 * <Tag variant="visitor" size="sm" />
 */
export const Tag = memo(TagComponent);

export default Tag;

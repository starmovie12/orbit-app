/**
 * TitleBadge — Tier title pill (atom)
 *
 * A compact, premium pill that renders a held title for any of the four tiers
 * (Baron / Mayor-Viceroy / Sovereign / Imperator). Used in the Crown Hero Card,
 * the "See all titles" list, and the Crown Journey timeline detail.
 *
 * Visual language matches the home screen: cream surface, dark-gold border and
 * text, burnished-amber accent for the active/primary title. No black, no dark
 * surfaces. Zero raw hex — every colour comes from tokens.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Tier } from '../types';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TIER_META,
  TOUCH_TARGET,
} from '../tokens';
import { TIER_TO_TITLE } from '../constants/titles';

// ── PROPS ─────────────────────────────────────────────────────────────────────

export type TitleBadgeSize = 'sm' | 'md' | 'lg';

interface TitleBadgeProps {
  tier: Tier;
  /** Optional geography label appended after the title ("· Mumbai"). */
  geographyLabel?: string;
  size?: TitleBadgeSize;
  /** Primary / currently-active title gets the amber-accented treatment. */
  active?: boolean;
  /** Optional tap handler — when set the badge becomes a button. */
  onPress?: () => void;
}

// ── SIZE TABLE ────────────────────────────────────────────────────────────────

const SIZE_MAP: Record<
  TitleBadgeSize,
  { padV: number; padH: number; emoji: number; text: number; gap: number }
> = {
  sm: { padV: 3, padH: SPACING.sm, emoji: 12, text: FONT_SIZES.micro, gap: 4 },
  md: { padV: 5, padH: SPACING.md, emoji: 14, text: FONT_SIZES.chip, gap: 6 },
  lg: { padV: 8, padH: SPACING.base, emoji: 18, text: FONT_SIZES.sub, gap: SPACING.sm },
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────

const TitleBadge: React.FC<TitleBadgeProps> = ({
  tier,
  geographyLabel,
  size = 'md',
  active = false,
  onPress,
}) => {
  const meta = TIER_META[tier];
  const title = TIER_TO_TITLE[tier];
  const dims = SIZE_MAP[size];

  const borderColor = active ? COLORS_DARK.fgAccentOrange : COLORS_DARK.borderGold;
  const textColor = active ? COLORS_DARK.fgAccentOrange : COLORS_DARK.fgBrand;
  const bgColor = active ? 'rgba(212,101,26,0.10)' : COLORS_DARK.bgElevated;

  const label = geographyLabel ? `${title} · ${geographyLabel}` : title;
  const a11yLabel = geographyLabel
    ? `${title} title of ${geographyLabel}`
    : `${title} title`;

  const content = (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: bgColor,
          borderColor,
          paddingVertical: dims.padV,
          paddingHorizontal: dims.padH,
          gap: dims.gap,
        },
      ]}
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
    >
      <Text style={{ fontSize: dims.emoji, lineHeight: dims.emoji + 4 }} aria-hidden>
        {meta.emoji}
      </Text>
      <Text
        style={[styles.label, { color: textColor, fontSize: dims.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {content}
    </Pressable>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    minHeight: 0,
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default React.memo(TitleBadge);

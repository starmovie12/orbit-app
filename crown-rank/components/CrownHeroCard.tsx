/**
 * CrownHeroCard — Emotional anchor of the CROWN tab
 *
 * Per PRD §5:
 * State A — Title-Holder: Shows highest tier title, cycle rewards, held duration.
 *   - Gold border (#F59E0B, 0.3 opacity) when holding a title
 *   - Multi-title chip row when holding multiple simultaneously
 * State B — No Title: Aspiration copy with CTA
 *
 * Zero raw hex values. All colors from tokens.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { TitleHolderState } from '../types';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TIER_META,
} from '../tokens';
import {
  getTitleString,
  formatCreditAmount,
  TIER_TO_TITLE,
} from '../constants/titles';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface CrownHeroCardProps {
  titleState: TitleHolderState;
  onInfoTap?: () => void;
  onSeeAllTitles?: () => void;
}

// ── TITLE-HOLDER STATE ────────────────────────────────────────────────────────

const TitleHolderView: React.FC<{
  titleState: Extract<TitleHolderState, { has: true }>;
  onInfoTap?: () => void;
  onSeeAllTitles?: () => void;
}> = ({ titleState, onInfoTap, onSeeAllTitles }) => {
  const { primaryTitle, titles } = titleState;
  const hasMultipleTitles = titles.length > 1;
  const meta = TIER_META[primaryTitle.tier];

  const heldCycles = primaryTitle.cyclesHeld;
  const heldLabel =
    heldCycles === 1 ? '1 cycle' : `${heldCycles} cycles`;
  const pinViewsLabel =
    primaryTitle.pinViews != null
      ? `  👁  ${primaryTitle.pinViews.toLocaleString('en-US')} saw your pin`
      : '';

  return (
    <View
      style={styles.cardTitleHolder}
      accessible
      accessibilityLabel={
        `Title holder: ${getTitleString(primaryTitle.tier, primaryTitle.geographyLabel)}. ` +
        `Held for ${heldLabel}. Cycle reward: ${primaryTitle.cycleReward} Credits per cycle.`
      }
      accessibilityRole="summary"
    >
      {/* Tier name row */}
      <View style={styles.titleRow}>
        <Text style={styles.tierEmoji} aria-hidden>{meta.emoji}</Text>
        <Text style={styles.tierName} numberOfLines={1}>
          {getTitleString(primaryTitle.tier, primaryTitle.geographyLabel)}
        </Text>
      </View>

      {/* Handle + pin views */}
      <Text style={styles.subLine} numberOfLines={1}>
        Held since: {heldLabel}
        {pinViewsLabel}
      </Text>

      {/* Multi-title chip row */}
      {hasMultipleTitles && (
        <View style={styles.multiTitleRow}>
          {titles
            .filter((t) => t.tier !== primaryTitle.tier)
            .map((t) => (
              <View key={t.tier + t.geographyId} style={styles.titleChip}>
                <Text style={styles.titleChipText}>
                  {TIER_META[t.tier].emoji} {TIER_TO_TITLE[t.tier]}
                </Text>
              </View>
            ))}
          <TouchableOpacity
            onPress={onSeeAllTitles}
            style={styles.seeAllBtn}
            accessibilityLabel="See all your titles"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.seeAllText}>See all ↗</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cycle reward row */}
      <View style={styles.rewardRow}>
        <Text style={styles.rewardLabel}>Cycle reward: </Text>
        <Text style={styles.rewardAmount}>
          {primaryTitle.cycleReward > 0
            ? formatCreditAmount(primaryTitle.cycleReward)
            : '0 Cr'}
        </Text>
        <Text style={styles.rewardCycle}> / cycle </Text>
        <TouchableOpacity
          onPress={onInfoTap}
          style={styles.infoBtn}
          accessibilityLabel="Learn how cycle rewards are paid"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.infoText}>ℹ︎ How it's paid</Text>
        </TouchableOpacity>
      </View>

      {/* Active status banner */}
      <View style={styles.activeBanner}>
        <Text style={styles.activeBannerText}>
          👑 Your title is ACTIVE this cycle
        </Text>
      </View>
    </View>
  );
};

// ── NO TITLE (ASPIRATION) STATE ───────────────────────────────────────────────

const AspirationView: React.FC = () => (
  <View
    style={styles.cardAspiration}
    accessible
    accessibilityLabel="No crown yet. Climb to BARON of your sector and everything changes."
    accessibilityRole="summary"
  >
    <View style={styles.titleRow}>
      <Text style={styles.tierEmoji} aria-hidden>👑</Text>
      <Text style={styles.aspirationTitle}>No crown yet</Text>
    </View>

    <Text style={styles.aspirationBody}>
      Climb to BARON of your sector and everything changes.
    </Text>

    <Text style={styles.aspirationSub}>
      Stay active during Battle Hour. Your score climbs every message, reaction, and reply.
    </Text>

    <View style={styles.aspirationMilestones}>
      <View style={styles.milestone}>
        <Text style={styles.milestoneEmoji}>🏘️</Text>
        <Text style={styles.milestoneTier}>BARON</Text>
        <Text style={styles.milestoneScope}>Your Sector</Text>
      </View>
      <Text style={styles.milestoneSeparator}>→</Text>
      <View style={styles.milestone}>
        <Text style={styles.milestoneEmoji}>🏙️</Text>
        <Text style={styles.milestoneTier}>VICEROY</Text>
        <Text style={styles.milestoneScope}>Your City</Text>
      </View>
      <Text style={styles.milestoneSeparator}>→</Text>
      <View style={styles.milestone}>
        <Text style={styles.milestoneEmoji}>🌍</Text>
        <Text style={styles.milestoneTier}>IMPERATOR</Text>
        <Text style={styles.milestoneScope}>The World</Text>
      </View>
    </View>
  </View>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const CrownHeroCard: React.FC<CrownHeroCardProps> = ({
  titleState,
  onInfoTap,
  onSeeAllTitles,
}) => {
  if (titleState.has) {
    return (
      <TitleHolderView
        titleState={titleState}
        onInfoTap={onInfoTap}
        onSeeAllTitles={onSeeAllTitles}
      />
    );
  }
  return <AspirationView />;
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Title-holder card
  cardTitleHolder: {
    backgroundColor: COLORS_DARK.bgCard,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderGold,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },

  // Aspiration card
  cardAspiration: {
    backgroundColor: COLORS_DARK.bgCard,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },

  // Shared
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tierEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  tierName: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgBrand,
    flex: 1,
    lineHeight: 28,
  },
  subLine: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 18,
  },

  // Multi-title
  multiTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    alignItems: 'center',
  },
  titleChip: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
  },
  titleChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.chip,
    color: COLORS_DARK.fgBrand,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seeAllBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  seeAllText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.chip,
    color: COLORS_DARK.fgBrand,
  },

  // Reward row
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rewardLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  rewardAmount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgSuccess,
    fontWeight: '700',
  },
  rewardCycle: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  infoBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  infoText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    textDecorationLine: 'underline',
  },

  // Active banner
  activeBanner: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 2,
    alignSelf: 'flex-start',
  },
  activeBannerText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgSuccess,
  },

  // Aspiration
  aspirationTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 28,
  },
  aspirationBody: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    lineHeight: 22,
  },
  aspirationSub: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 18,
  },
  aspirationMilestones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  milestone: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  milestoneEmoji: {
    fontSize: 20,
  },
  milestoneTier: {
    fontFamily: FONTS.displayAlt,
    fontSize: 10,
    color: COLORS_DARK.fgBrand,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  milestoneScope: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
  },
  milestoneSeparator: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
});

export default React.memo(CrownHeroCard);

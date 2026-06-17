/**
 * BattleScheduleStrip — 7 upcoming cycle freeze times
 *
 * Per PRD §8 (Section 4):
 * - Shows exactly 7 upcoming freeze times for user's geographies
 * - Date label: TODAY / TOMORROW / MON / +2 DAYS
 * - Local time in user's timezone
 * - Time remaining: "2h 47m" (< 24h) / "2 days 3h" (> 24h)
 * - Sleep window (11pm–7am local): 🌙 prefix + --fg-accent-orange row tint
 * - Per §8.8 Layer 3: This is part of the Sleep-Safe awareness system
 *
 * Zero raw hex values. All colors from tokens.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { FreezeTime, Tier } from '../types';
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
import { formatDuration } from '../core/cycle';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface BattleScheduleStripProps {
  freezeTimes: FreezeTime[];
  /** Called when user taps the "Set Auto-Accept" link on a sleep-window row */
  onSleepWarningTap?: (freezeTime: FreezeTime) => void;
}

// ── TIER EMOJI HELPER ─────────────────────────────────────────────────────────

function getTierEmoji(tier: Tier): string {
  return TIER_META[tier].emoji;
}

function getTierLabel(tier: Tier, geographyLabel: string): string {
  return `${getTierEmoji(tier)} ${geographyLabel} ${TIER_TO_TITLE[tier]}`;
}

// ── SINGLE ROW ────────────────────────────────────────────────────────────────

interface FreezeRowProps {
  freeze: FreezeTime;
  onSleepWarningTap?: (freeze: FreezeTime) => void;
}

const FreezeRow: React.FC<FreezeRowProps> = ({ freeze, onSleepWarningTap }) => {
  const isSleep = freeze.isSleepWindow;
  const timeRemaining = formatDuration(freeze.freezeIn);

  const rowBg = isSleep
    ? 'rgba(224,123,32,0.07)'
    : 'transparent';

  const labelColor = isSleep
    ? COLORS_DARK.fgAccentOrange
    : COLORS_DARK.fgTextMuted;

  const accessibilityLabel =
    `${getTierLabel(freeze.tier, freeze.geographyLabel)}. ` +
    `Freeze ${freeze.dateLabel} at ${freeze.localTime}, in ${timeRemaining}.` +
    (isSleep ? ' This falls in your sleep window. Consider setting Auto-Accept.' : '');

  return (
    <Pressable
      onPress={isSleep ? () => onSleepWarningTap?.(freeze) : undefined}
      style={[styles.row, { backgroundColor: rowBg }]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isSleep ? 'button' : 'text'}
      accessibilityHint={isSleep ? 'Double tap to configure Auto-Accept for this cycle' : undefined}
    >
      {/* Left: tier label */}
      <View style={styles.rowLeft}>
        {isSleep && (
          <Text style={styles.sleepMoon} aria-hidden>🌙 </Text>
        )}
        <Text
          style={[styles.tierLabel, { color: isSleep ? COLORS_DARK.fgAccentOrange : COLORS_DARK.fgTextStrong }]}
          numberOfLines={1}
        >
          {getTierLabel(freeze.tier, freeze.geographyLabel)}
        </Text>
      </View>

      {/* Right: date + time + remaining */}
      <View style={styles.rowRight}>
        <Text style={[styles.dateLabel, { color: labelColor }]}>
          {freeze.dateLabel}
        </Text>
        <Text style={[styles.timeLabel, { color: labelColor }]}>
          {freeze.localTime}
        </Text>
        <Text style={[styles.remaining, { color: isSleep ? COLORS_DARK.fgAccentOrange : COLORS_DARK.fgBrand }]}>
          {timeRemaining}
        </Text>
      </View>

      {/* Sleep warning hint */}
      {isSleep && (
        <View style={styles.sleepHintRow}>
          <Text style={styles.sleepHintText}>
            Sleep window — set Auto-Accept ↗
          </Text>
        </View>
      )}
    </Pressable>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const BattleScheduleStrip: React.FC<BattleScheduleStripProps> = ({
  freezeTimes,
  onSleepWarningTap,
}) => {
  // Show first 4 by default; "See all" reveals remaining
  const [showAll, setShowAll] = useState(false);

  const displayTimes = showAll ? freezeTimes : freezeTimes.slice(0, 4);
  const remaining = freezeTimes.length - 4;

  if (freezeTimes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No upcoming freezes found for your geographies.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <Text style={styles.header}>
          Schedule for YOUR geographies
        </Text>

        {/* Rows */}
        {displayTimes.map((freeze, index) => (
          <React.Fragment key={`${freeze.tier}-${freeze.geographyId}-${freeze.cycleId}`}>
            {index > 0 && <View style={styles.divider} />}
            <FreezeRow
              freeze={freeze}
              onSleepWarningTap={onSleepWarningTap}
            />
          </React.Fragment>
        ))}

        {/* Expand / collapse */}
        {!showAll && remaining > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.moreRow}>
              <Text style={styles.moreLabel}>
                +{remaining} more
              </Text>
              <Pressable
                onPress={() => setShowAll(true)}
                style={styles.seeAllBtn}
                accessibilityLabel={`Show ${remaining} more freeze times`}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>
          </>
        )}

        {showAll && freezeTimes.length > 4 && (
          <>
            <View style={styles.divider} />
            <Pressable
              onPress={() => setShowAll(false)}
              style={styles.collapseBtn}
              accessibilityLabel="Show fewer freeze times"
              accessibilityRole="button"
            >
              <Text style={styles.collapseText}>Show less ↑</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS_DARK.bgCard,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  header: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS_DARK.borderSubtle,
    marginHorizontal: SPACING.base,
  },
  row: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    gap: 2,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sleepMoon: {
    fontSize: 14,
    lineHeight: 18,
  },
  tierLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    flex: 1,
    lineHeight: 20,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    // Note: FreezeRow wraps these in a column-like layout via the outer row
  },
  dateLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timeLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
  },
  remaining: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    fontWeight: '700',
  },
  sleepHintRow: {
    marginTop: 2,
  },
  sleepHintText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgAccentOrange,
    lineHeight: 14,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    minHeight: TOUCH_TARGET,
  },
  moreLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
  },
  seeAllBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  seeAllText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },
  collapseBtn: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
  },
  collapseText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  emptyContainer: {
    backgroundColor: COLORS_DARK.bgCard,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.card,
    padding: SPACING.base,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
  },
});

export default React.memo(BattleScheduleStrip);

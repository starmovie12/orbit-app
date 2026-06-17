/**
 * RankDetailSheet — Rank + score-breakdown bottom sheet
 *
 * Opens when a RankCard is tapped (PRD §6 → §16.1 detail view). Shows the full
 * picture for one tier + geography: the held title, current rank and score,
 * a per-signal breakdown of how that score was earned, milestone progress, and
 * the most recent settled cycles for context.
 *
 * Light cream/gold surface matching the home screen — no black, no dark panels.
 * Every colour comes from tokens.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { RankCardData } from '../types';
import type { ScoreBreakdown } from '../api/rank';
import type { CycleHistoryEntry } from '../api/cycles';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TIER_META,
  TOUCH_TARGET,
  MOTION,
} from '../tokens';
import { TIER_TO_TITLE, formatRank, formatScore } from '../constants/titles';
import RankProgressBar from './RankProgressBar';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface RankDetailSheetProps {
  visible: boolean;
  data: RankCardData | null;
  breakdown: ScoreBreakdown | null;
  history?: CycleHistoryEntry[];
  onClose: () => void;
}

// ── SCORE SIGNAL TABLE ────────────────────────────────────────────────────────

interface SignalRow {
  key: keyof ScoreBreakdown;
  label: string;
  weight: number;
}

/** Mirrors the weighting in api/rank.ts → mapScoreBreakdown. */
const SIGNAL_ROWS: SignalRow[] = [
  { key: 'reactionsReceived', label: 'Reactions received', weight: 1 },
  { key: 'repliesReceived', label: 'Replies received', weight: 3 },
  { key: 'repliesSent', label: 'Replies sent', weight: 1 },
  { key: 'newFollowers', label: 'New followers', weight: 8 },
  { key: 'dmsReceived', label: 'DMs received', weight: 2 },
  { key: 'reportsAgainst', label: 'Reports against you', weight: -50 },
  { key: 'aiRejections', label: 'AI rejections', weight: -20 },
];

// ── OUTCOME LABELS ────────────────────────────────────────────────────────────

const OUTCOME_LABEL: Record<NonNullable<CycleHistoryEntry['outcome']>, string> = {
  accepted: 'Sold',
  kept: 'Kept',
  no_bid: 'No bids',
};

function formatHistoryDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

const RankDetailSheet: React.FC<RankDetailSheetProps> = ({
  visible,
  data,
  breakdown,
  history = [],
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reducedMotionRef.current = v;
    });
  }, []);

  useEffect(() => {
    if (visible) {
      if (reducedMotionRef.current) {
        slideAnim.setValue(1);
      } else {
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: MOTION.base,
          useNativeDriver: true,
        }).start();
      }
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  if (!data) return null;

  const meta = TIER_META[data.tier];
  const title = TIER_TO_TITLE[data.tier];

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Animated.View
          style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
          // Stop backdrop taps from closing when interacting with the sheet body.
          onStartShouldSetResponder={() => true}
        >
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji} aria-hidden>
              {meta.emoji}
            </Text>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerGeo} numberOfLines={1}>
                {data.geographyLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close rank details"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Rank + score summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>RANK</Text>
                <Text style={styles.summaryValue}>
                  {data.rankPosition !== null ? formatRank(data.rankPosition) : '—'}
                </Text>
                {data.rankPosition === null && (
                  <Text style={styles.summaryHint}>Hidden in Dark Tunnel</Text>
                )}
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>SCORE</Text>
                <Text style={styles.summaryValue}>{formatScore(data.rankScore)}</Text>
                <Text style={styles.summaryHint}>{data.rankScore} pts this cycle</Text>
              </View>
            </View>

            {/* Milestone progress */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Milestone progress</Text>
              <RankProgressBar
                progress={data.progressPercent}
                label={data.milestoneLabel}
                milestoneHeld={data.milestoneHeld !== null}
              />
              {data.milestoneHeld && (
                <Text style={styles.milestoneNote}>
                  {data.milestoneHeld} currently held
                </Text>
              )}
            </View>

            {/* Score breakdown */}
            {breakdown && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>How your score was earned</Text>
                <View style={styles.breakdownCard}>
                  {SIGNAL_ROWS.map((row, idx) => {
                    const count = breakdown[row.key] as number;
                    const points = count * row.weight;
                    const isNeg = points < 0;
                    return (
                      <View
                        key={row.key}
                        style={[
                          styles.breakdownRow,
                          idx < SIGNAL_ROWS.length - 1 && styles.breakdownRowBorder,
                        ]}
                      >
                        <Text style={styles.breakdownLabel}>{row.label}</Text>
                        <View style={styles.breakdownRight}>
                          <Text style={styles.breakdownCount}>×{count}</Text>
                          <Text
                            style={[
                              styles.breakdownPoints,
                              { color: isNeg ? COLORS_DARK.fgDanger : COLORS_DARK.fgBrand },
                            ]}
                          >
                            {isNeg ? '' : '+'}
                            {points}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <View style={styles.breakdownTotalRow}>
                    <Text style={styles.breakdownTotalLabel}>Total</Text>
                    <Text style={styles.breakdownTotalValue}>
                      {breakdown.totalScore} pts
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recent cycles */}
            {history.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent cycles</Text>
                <View style={styles.breakdownCard}>
                  {history.map((h, idx) => (
                    <View
                      key={h.cycleId}
                      style={[
                        styles.historyRow,
                        idx < history.length - 1 && styles.breakdownRowBorder,
                      ]}
                    >
                      <Text style={styles.historyDate}>
                        {formatHistoryDate(h.endedAtMs)}
                      </Text>
                      <Text style={styles.historyWinner} numberOfLines={1}>
                        {h.meritWinnerHandle ?? '—'}
                      </Text>
                      <Text style={styles.historyOutcome}>
                        {h.outcome ? OUTCOME_LABEL[h.outcome] : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS_DARK.bgSurface,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    maxHeight: '86%',
    borderTopWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS_DARK.borderSubtle,
    marginBottom: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextStrong,
    letterSpacing: 0.2,
  },
  headerGeo: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 18,
    color: COLORS_DARK.fgTextMuted,
  },

  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: SPACING.md,
    gap: SPACING.lg,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS_DARK.bgCard,
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS_DARK.borderSubtle,
  },
  summaryLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgTextMuted,
    letterSpacing: 1,
  },
  summaryValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.rankBig,
    color: COLORS_DARK.fgBrand,
  },
  summaryHint: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgTextDisabled,
  },

  // Section
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.chip,
    color: COLORS_DARK.fgTextMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  milestoneNote: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },

  // Breakdown
  breakdownCard: {
    backgroundColor: COLORS_DARK.bgCard,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  breakdownRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS_DARK.borderSubtle,
  },
  breakdownLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    flex: 1,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  breakdownCount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  breakdownPoints: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    minWidth: 48,
    textAlign: 'right',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS_DARK.borderGold,
  },
  breakdownTotalLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
  },
  breakdownTotalValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.credits,
    color: COLORS_DARK.fgBrand,
  },

  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  historyDate: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    width: 56,
  },
  historyWinner: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    flex: 1,
  },
  historyOutcome: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },
});

export default React.memo(RankDetailSheet);

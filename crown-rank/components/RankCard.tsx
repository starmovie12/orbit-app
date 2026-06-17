/**
 * RankCard — Per-tier rank display card
 *
 * Per PRD §6 and §16.1:
 * - Shows RANK POSITION in Phase 2–5 (hidden during Phase 1 per LAW 1)
 * - Always shows RANK SCORE (even in Phase 1)
 * - Rank tick animation: old number slides out up, new slides in from below
 * - Rank improvement: brief --fg-success flash on new number (150ms)
 * - Rank drop: brief --fg-danger flash on new number (150ms)
 * - Movement chip: ▲2, ▼1, or — below score
 * - Battle Hour: Phase 2 triggers orange border + glow per §12.1
 * - Tap → RankDetailSheet
 *
 * Per LAW 6: uses Reanimated shared value, no immediate state update → no layout shift.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { RankCardData } from '../types';
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
import { formatRank } from '../constants/titles';
import RankProgressBar from './RankProgressBar';
import CountdownTimer from './CountdownTimer';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface RankCardProps {
  data: RankCardData;
  /** Called when card is tapped — opens RankDetailSheet */
  onPress?: () => void;
}

// ── RANK NUMBER TICK ──────────────────────────────────────────────────────────

interface RankTickProps {
  value: string | null; // null during Phase 1
  prevValue: string | null;
  movement: 'up' | 'down' | 'same';
  reducedMotion: boolean;
}

const RankTick: React.FC<RankTickProps> = ({
  value,
  prevValue,
  movement,
  reducedMotion,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [flashColor, setFlashColor] = useState<string | null>(null);

  const slideOut = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(8)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (value === prevValue || value === null) {
      setDisplayValue(value);
      return;
    }

    if (reducedMotion) {
      setDisplayValue(value);
      // Still do color flash even in reduced motion (it's informational, not decorative)
      const color =
        movement === 'up'
          ? COLORS_DARK.fgSuccess
          : movement === 'down'
          ? COLORS_DARK.fgDanger
          : null;
      if (color) {
        setFlashColor(color);
        setTimeout(() => setFlashColor(null), 150);
      }
      return;
    }

    // Phase 1: exit animation for old number
    Animated.parallel([
      Animated.timing(slideOut, {
        toValue: -8,
        duration: MOTION.micro, // 150ms
        useNativeDriver: true,
      }),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: MOTION.micro,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDisplayValue(value);

      // Flash color for movement feedback
      const color =
        movement === 'up'
          ? COLORS_DARK.fgSuccess
          : movement === 'down'
          ? COLORS_DARK.fgDanger
          : null;
      if (color) {
        setFlashColor(color);
        setTimeout(() => setFlashColor(null), 150);
      }

      // Reset slide positions
      slideOut.setValue(0);
      fadeOut.setValue(1);
      slideIn.setValue(8);
      fadeIn.setValue(0);

      // Phase 2: enter animation for new number (50ms stagger after exit)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideIn, {
            toValue: 0,
            duration: MOTION.micro,
            useNativeDriver: true,
          }),
          Animated.timing(fadeIn, {
            toValue: 1,
            duration: MOTION.micro,
            useNativeDriver: true,
          }),
        ]).start();
      }, 50);
    });
  }, [value, prevValue, movement, reducedMotion, slideOut, slideIn, fadeOut, fadeIn]);

  if (displayValue === null) {
    return (
      <View style={styles.rankHidden}>
        <Text style={styles.rankHiddenText}>—</Text>
      </View>
    );
  }

  return (
    <Animated.Text
      style={[
        styles.rankNumber,
        { color: flashColor ?? COLORS_DARK.fgBrand },
        !reducedMotion && {
          transform: [{ translateY: displayValue === value ? slideIn : slideOut }],
          opacity: displayValue === value ? fadeIn : fadeOut,
        },
      ]}
    >
      {displayValue}
    </Animated.Text>
  );
};

// ── MOVEMENT CHIP ─────────────────────────────────────────────────────────────

const MovementChip: React.FC<{
  movement: 'up' | 'down' | 'same';
  delta: number;
}> = ({ movement, delta }) => {
  const label =
    movement === 'up'
      ? `▲${delta}`
      : movement === 'down'
      ? `▼${delta}`
      : '—';

  const color =
    movement === 'up'
      ? COLORS_DARK.fgSuccess
      : movement === 'down'
      ? COLORS_DARK.fgDanger
      : COLORS_DARK.fgTextDisabled;

  return (
    <Text
      style={[styles.movementChip, { color }]}
      accessibilityLabel={
        movement === 'up'
          ? `Rank improved by ${delta}`
          : movement === 'down'
          ? `Rank dropped by ${delta}`
          : 'No rank change'
      }
    >
      {label}
    </Text>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const RankCard: React.FC<RankCardProps> = ({ data, onPress }) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevRankRef = useRef<string | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  const {
    tier,
    geographyLabel,
    rankPosition,
    rankScore,
    progressPercent,
    milestoneLabel,
    milestoneHeld,
    milestoneHeldSince,
    movement,
    movementDelta,
    cyclePhase,
  } = data;

  const meta = TIER_META[tier];
  const isBattleHour = cyclePhase.phase === 2;
  const isPhase1 = cyclePhase.phase === 1;

  const currentRankDisplay =
    rankPosition !== null ? formatRank(rankPosition) : null;
  const prevRankDisplay = prevRankRef.current;

  useEffect(() => {
    prevRankRef.current = currentRankDisplay;
  });

  const cardBorderColor = isBattleHour
    ? COLORS_DARK.borderBattleHour
    : COLORS_DARK.borderSubtle;

  const cardBorderWidth = isBattleHour ? 2 : 1;

  // Countdown: Phase 1 shows "Battle Hour in XX:XX:XX"
  const battleHourTargetMs =
    isPhase1 && cyclePhase.nextPhaseAt
      ? new Date(cyclePhase.nextPhaseAt).getTime()
      : null;

  const accessibilityLabel =
    `${meta.label} tier. ${geographyLabel}. ` +
    (rankPosition !== null
      ? `Your rank: ${rankPosition}. `
      : 'Rank hidden during Dark Tunnel. ') +
    `Score this cycle: ${rankScore} points. ` +
    `Cycle phase: ${cyclePhase.phaseName}.`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: cardBorderColor,
          borderWidth: cardBorderWidth,
        },
        // Battle Hour subtle glow via shadow
        isBattleHour && styles.cardBattleHourGlow,
        pressed && styles.cardPressed,
      ]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to see rank details and score breakdown"
    >
      {/* Tier header */}
      <View style={styles.headerRow}>
        <Text style={styles.tierEmoji} aria-hidden>{meta.emoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.tierName}>{meta.label}</Text>
          <Text style={styles.geoLabel} numberOfLines={1}>{geographyLabel}</Text>
        </View>

        {/* Phase 2+ LIVE indicator */}
        {isBattleHour && (
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Rank number + movement chip */}
      <View style={styles.rankRow}>
        <View>
          <Text style={styles.rankLabel}>RANK</Text>
          <RankTick
            value={currentRankDisplay}
            prevValue={prevRankDisplay}
            movement={movement}
            reducedMotion={reducedMotion}
          />
        </View>

        <View style={styles.rankRight}>
          {/* Score always visible */}
          <Text style={styles.scoreText}>{rankScore} pts</Text>
          <MovementChip movement={movement} delta={movementDelta} />
        </View>
      </View>

      {/* Progress bar */}
      <RankProgressBar
        progress={progressPercent}
        label={milestoneLabel}
        milestoneHeld={milestoneHeld !== null}
      />

      {/* Phase 1: Battle Hour countdown */}
      {isPhase1 && battleHourTargetMs !== null && (
        <View style={styles.battleHourCountdown}>
          <Text style={styles.battleHourLabel}>Battle Hour in </Text>
          <CountdownTimer
            targetMs={battleHourTargetMs}
            accessibilityPrefix="Battle Hour countdown"
          />
        </View>
      )}

      {/* Phase 2: Stay in milestone label with held time */}
      {!isPhase1 && milestoneHeld && milestoneHeldSince !== null && (
        <View style={styles.milestoneHeldRow}>
          <Text style={styles.milestoneHeldText}>
            {milestoneHeld} held — {Math.floor(milestoneHeldSince / 60)}h{' '}
            {milestoneHeldSince % 60}m more to lock
          </Text>
        </View>
      )}
    </Pressable>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS_DARK.bgCard,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET * 2.2, // ≥ 96px
  },
  cardBattleHourGlow: {
    // Android elevation for glow effect
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.92,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tierEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  headerText: {
    flex: 1,
  },
  tierName: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.chip,
    color: COLORS_DARK.fgTextMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  geoLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    lineHeight: 20,
  },

  // LIVE chip
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(224,123,32,0.15)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS_DARK.fgAccentOrange,
  },
  liveText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgAccentOrange,
    letterSpacing: 0.6,
  },

  // Rank
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  rankLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgTextMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    lineHeight: 14,
    marginBottom: 2,
  },
  rankNumber: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.rankBig,
    fontWeight: '700',
    color: COLORS_DARK.fgBrand,
    lineHeight: 38,
  },
  rankHidden: {
    paddingVertical: SPACING.xs,
  },
  rankHiddenText: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.rankBig,
    color: COLORS_DARK.fgTextDisabled,
  },
  rankRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scoreText: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    fontWeight: '700',
  },
  movementChip: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
  },

  // Battle Hour countdown
  battleHourCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  battleHourLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // Milestone held
  milestoneHeldRow: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 2,
  },
  milestoneHeldText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },
});

export default React.memo(RankCard);

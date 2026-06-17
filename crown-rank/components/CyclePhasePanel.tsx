/**
 * CyclePhasePanel — 5-state phase-aware panel
 *
 * Per PRD §7 and §12:
 * Phase 1 — Dark Tunnel: standard border, calm
 * Phase 2 — Battle Hour: 2px orange border + glow, energized
 * Phase 3 — Merit Freeze: 1px gold border, announcement
 * Phase 4 — BOLI Auction: 2px gold border + slow pulse, transactional
 * Phase 5 — Decision: full-screen overlay fires (handled by parent)
 *
 * Phase transition animations per §12.2:
 * Phase 1→2: border animates 600ms, chip crossfades 300ms
 * Phase 4→5: scrim fires + Decision Prompt slides up (parent responsibility)
 *
 * Also shows:
 * - Current phase name + emoji
 * - Countdown to next phase
 * - Cycle progress bar (5 phases)
 * - Rank Score this cycle: "247 pts"
 * - If Phase 2 (Battle Hour): leaderboard top 7 rows per LAW 8
 * - If Phase 3 (Merit Freeze): merit winner announcement
 * - If Phase 4 (BOLI Auction): base bid price + timer + bid CTA
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { CyclePhaseInfo } from '../types';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  MOTION,
} from '../tokens';
import { PHASE_META } from '../constants/titles';
import { getCycleProgress } from '../core/cycle';
import CountdownTimer from './CountdownTimer';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface CyclePhasePanelProps {
  cyclePhase: CyclePhaseInfo;
  geographyLabel: string;
  tierLabel: string;
  rankScore: number;
  /** Called when user taps "Place Bid" in Phase 4 */
  onPlaceBid?: (baseBidPrice: number) => void;
}

// ── PHASE BORDER COLORS ───────────────────────────────────────────────────────

const PHASE_BORDER: Record<number, string> = {
  1: COLORS_DARK.borderSubtle,
  2: COLORS_DARK.borderBattleHour,
  3: COLORS_DARK.fgBrand,
  4: COLORS_DARK.fgBrand,
  5: COLORS_DARK.fgBrand,
};

const PHASE_BORDER_WIDTH: Record<number, number> = {
  1: 1,
  2: 2,
  3: 1,
  4: 2,
  5: 2,
};

const PHASE_COUNTDOWN_COLOR: Record<number, string> = {
  1: COLORS_DARK.fgTextMuted,
  2: COLORS_DARK.fgAccentOrange,
  3: COLORS_DARK.fgBrand,
  4: COLORS_DARK.fgBrand,
  5: COLORS_DARK.fgTextStrong,
};

// ── MERIT FREEZE BANNER ───────────────────────────────────────────────────────

const MeritFreezeBanner: React.FC<{ meritWinnerId: string | null }> = ({
  meritWinnerId,
}) => (
  <View style={styles.meritBanner}>
    <Text style={styles.meritIcon}>🔒</Text>
    <View style={styles.meritText}>
      <Text style={styles.meritTitle}>Battle Hour locked</Text>
      <Text style={styles.meritSub}>
        {meritWinnerId ? 'Merit Winner determined — Auction starting soon' : 'Rankings frozen'}
      </Text>
    </View>
  </View>
);

// ── BOLI AUCTION ROW ─────────────────────────────────────────────────────────

const BoliAuctionRow: React.FC<{
  highestBid: { amount: number; bidderId: string } | null;
  baseBidPrice: number | null;
  auctionEndsAt: string | null;
  onPlaceBid?: (baseBidPrice: number) => void;
}> = ({ highestBid, baseBidPrice, auctionEndsAt, onPlaceBid }) => {
  const auctionTargetMs = auctionEndsAt
    ? new Date(auctionEndsAt).getTime()
    : null;

  return (
    <View style={styles.boliRow}>
      <View style={styles.boliInfo}>
        <Text style={styles.boliLabel}>💰 BOLI AUCTION</Text>
        <Text style={styles.boliSub}>
          {highestBid
            ? `Current high bid: ${highestBid.amount.toLocaleString('en-US')} Cr`
            : `Starting bid: ${baseBidPrice?.toLocaleString('en-US') ?? '—'} Cr`}
        </Text>
        {auctionTargetMs && (
          <View style={styles.boliTimer}>
            <Text style={styles.boliTimerLabel}>Ends in </Text>
            <CountdownTimer
              targetMs={auctionTargetMs}
              accessibilityPrefix="Auction ends in"
            />
          </View>
        )}
      </View>
      {baseBidPrice != null && (
        <TouchableOpacity
          onPress={() => onPlaceBid?.(baseBidPrice)}
          style={styles.placeBidBtn}
          accessibilityLabel={`Place a bid. Minimum bid: ${baseBidPrice.toLocaleString('en-US')} Credits`}
          accessibilityRole="button"
        >
          <Text style={styles.placeBidText}>Place Bid</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const CyclePhasePanel: React.FC<CyclePhasePanelProps> = ({
  cyclePhase,
  geographyLabel,
  tierLabel,
  rankScore,
  onPlaceBid,
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevPhaseRef = useRef(cyclePhase.phase);

  const borderColorAnim = useRef(
    new Animated.Value(cyclePhase.phase),
  ).current;

  const phaseLabelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // ── Phase transition animation (§12.2)
  useEffect(() => {
    if (prevPhaseRef.current === cyclePhase.phase) return;
    prevPhaseRef.current = cyclePhase.phase;

    if (reducedMotion) return;

    // Phase chip crossfade: opacity 1→0→1, 400ms total
    Animated.sequence([
      Animated.timing(phaseLabelOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(phaseLabelOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cyclePhase.phase, phaseLabelOpacity, reducedMotion]);

  // ── Phase 4 BOLI pulse animation
  const boliPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cyclePhase.phase !== 4 || reducedMotion) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(boliPulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(boliPulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cyclePhase.phase, boliPulseAnim, reducedMotion]);

  const phaseMeta = PHASE_META[cyclePhase.phase];
  const borderColor = PHASE_BORDER[cyclePhase.phase];
  const borderWidth = PHASE_BORDER_WIDTH[cyclePhase.phase];

  // Countdown target
  const countdownTargetMs = cyclePhase.nextPhaseAt
    ? new Date(cyclePhase.nextPhaseAt).getTime()
    : null;

  const accessibilityLabel =
    `Cycle phase panel. ${tierLabel} Cycle for ${geographyLabel}. ` +
    `Current phase: ${phaseMeta.name}. ` +
    `Rank score this cycle: ${rankScore} points.`;

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor:
            cyclePhase.phase === 4
              ? COLORS_DARK.fgBrand
              : borderColor,
          borderWidth,
        },
      ]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="region"
    >
      {/* Phase header row */}
      <View style={styles.phaseHeaderRow}>
        <Animated.View
          style={[styles.phaseChip, { opacity: phaseLabelOpacity }]}
        >
          <Text style={styles.phaseEmoji} aria-hidden>{phaseMeta.emoji}</Text>
          <Text style={styles.phaseName}>{phaseMeta.shortName}</Text>
        </Animated.View>

        {/* BOLI pulse indicator on phase chip */}
        {cyclePhase.phase === 4 && !reducedMotion && (
          <Animated.View
            style={[styles.boliPulseDot, { opacity: boliPulseAnim }]}
          />
        )}

        <Text style={styles.cycleContext}>
          {tierLabel} Cycle · {geographyLabel}
        </Text>
      </View>

      {/* Countdown row — depends on phase */}
      {cyclePhase.phase === 1 && countdownTargetMs && (
        <View style={styles.countdownRow}>
          <Text style={styles.countdownLabel}>Battle Hour in </Text>
          <CountdownTimer
            targetMs={countdownTargetMs}
            showLiveDot={false}
            accessibilityPrefix="Battle Hour countdown"
          />
        </View>
      )}

      {cyclePhase.phase === 2 && countdownTargetMs && (
        <View style={styles.countdownRow}>
          <Text style={[styles.countdownLabel, { color: COLORS_DARK.fgAccentOrange }]}>
            Freeze in{' '}
          </Text>
          <CountdownTimer
            targetMs={countdownTargetMs}
            showLiveDot
            accessibilityPrefix="Battle Hour ends in"
          />
        </View>
      )}

      {cyclePhase.phase === 3 && (
        <MeritFreezeBanner meritWinnerId={cyclePhase.meritWinnerId} />
      )}

      {cyclePhase.phase === 4 && (
        <BoliAuctionRow
          highestBid={cyclePhase.highestBid}
          baseBidPrice={cyclePhase.baseBidPrice}
          auctionEndsAt={cyclePhase.auctionEndsAt}
          onPlaceBid={onPlaceBid}
        />
      )}

      {/* Phase 5 is handled by DecisionPromptOverlay in the parent */}

      {/* Progress indicator */}
      <View style={styles.phaseProgressRow}>
        {([1, 2, 3, 4, 5] as const).map((p) => (
          <View
            key={p}
            style={[
              styles.phaseSegment,
              {
                backgroundColor:
                  p < cyclePhase.phase
                    ? COLORS_DARK.fgBrand
                    : p === cyclePhase.phase
                    ? COLORS_DARK.fgBrand
                    : 'rgba(255,255,255,0.12)',
                opacity: p === cyclePhase.phase ? 1 : p < cyclePhase.phase ? 0.7 : 0.3,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.phaseProgressLabel}>
        Phase {cyclePhase.phase} of 5
      </Text>

      {/* Score row — always visible */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Your Rank Score this cycle: </Text>
        <Text style={styles.scoreValue}>{rankScore} pts</Text>
      </View>
    </View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS_DARK.bgCard,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },

  // Phase header
  phaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  phaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  phaseEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  phaseName: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  boliPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS_DARK.fgBrand,
  },
  cycleContext: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    flex: 1,
  },

  // Countdown
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  countdownLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // Merit Freeze
  meritBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  meritIcon: {
    fontSize: 18,
  },
  meritText: {
    flex: 1,
  },
  meritTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextStrong,
  },
  meritSub: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // BOLI
  boliRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  boliInfo: {
    flex: 1,
    gap: 2,
  },
  boliLabel: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  boliSub: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  boliTimer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boliTimerLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  placeBidBtn: {
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeBidText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },

  // Phase progress
  phaseProgressRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    height: 3,
  },
  phaseSegment: {
    flex: 1,
    borderRadius: 1.5,
  },
  phaseProgressLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgTextDisabled,
    textAlign: 'right',
  },

  // Score
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  scoreLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  scoreValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
    fontWeight: '700',
  },
});

export default React.memo(CyclePhasePanel);

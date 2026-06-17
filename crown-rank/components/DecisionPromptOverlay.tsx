/**
 * DecisionPromptOverlay — Full-screen Phase 5 Decision Window
 *
 * Per PRD §13 (Section 13) + §16.4:
 * - ONLY appears when user is Merit Winner in Phase 5
 * - Full-screen modal — non-dismissible (Android back blocked)
 * - Two choices: ACCEPT MONEY | KEEP TITLE
 * - Timer: 10 min countdown → auto KEEP TITLE on expiry
 * - If no bids: simplified "no bid" state
 * - Entry: heavy haptic × 3, slide-up spring, section stagger
 *
 * Decision flow:
 *   ACCEPT MONEY → confirmation sheet → Firestore tx → confetti → toast
 *   KEEP TITLE → immediate Firestore write → toast (no confirmation)
 *   Timer expires → auto KEEP TITLE → toast
 *
 * Per PRD §13.4: Zero bids → simplified celebration state (no money choice)
 *
 * Zero raw hex values. All from tokens.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Pressable,
  BackHandler,
  AccessibilityInfo,
  Platform,
  ScrollView,
} from 'react-native';
import { DecisionPromptData } from '../types';
import { UseDecisionReturn } from '../hooks/useDecision';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TOUCH_TARGET,
  MOTION,
  SPRING_PRESETS,
} from '../tokens';
import { getDecisionHeader } from '../constants/titles';
import CountdownTimer from './CountdownTimer';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface DecisionPromptOverlayProps {
  decision: UseDecisionReturn;
}

// ── CONFIRMATION SHEET ────────────────────────────────────────────────────────

interface ConfirmSheetProps {
  data: DecisionPromptData;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  data,
  onConfirm,
  onBack,
  isSubmitting,
}) => {
  const bidderHandle = data.highestBid?.bidderHandle ?? 'someone';

  return (
    <View style={styles.confirmSheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.confirmTitle}>Confirm: Sell your title?</Text>
      <Text style={styles.confirmBody}>
        @{bidderHandle} will become {getDecisionHeader(data.tier, data.geographyLabel).title}.
      </Text>
      <View style={styles.confirmAmountRow}>
        <Text style={styles.confirmAmountLabel}>You receive: </Text>
        <Text style={styles.confirmAmount}>
          +{new Intl.NumberFormat('en-US').format(data.acceptAmount)} Credits
        </Text>
      </View>
      <Text style={styles.confirmFeeNote}>
        (92% of bid after 8% CROWN platform fee)
      </Text>

      <View style={styles.confirmActions}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.confirmBackBtn,
            pressed && styles.confirmBackBtnPressed,
          ]}
          disabled={isSubmitting}
          accessibilityLabel="Go back, do not sell"
          accessibilityRole="button"
        >
          <Text style={styles.confirmBackBtnText}>← Back</Text>
        </Pressable>

        <TouchableOpacity
          onPress={onConfirm}
          style={[styles.confirmAcceptBtn, isSubmitting && styles.btnDisabled]}
          disabled={isSubmitting}
          accessibilityLabel={`Yes, accept money — receive ${data.acceptAmount} Credits`}
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <Text style={styles.confirmAcceptBtnText}>Confirming...</Text>
          ) : (
            <Text style={styles.confirmAcceptBtnText}>Yes, Accept Money</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── NO BIDS STATE ─────────────────────────────────────────────────────────────

interface NoBidsStateProps {
  data: DecisionPromptData;
  onClose: () => void;
}

const NoBidsState: React.FC<NoBidsStateProps> = ({ data, onClose }) => {
  const { city, title } = getDecisionHeader(data.tier, data.geographyLabel);

  return (
    <View style={styles.noBidsContainer}>
      <Text style={styles.headerIcon} aria-hidden>👑</Text>
      <Text style={styles.headerCity}>{city}</Text>
      <Text style={styles.headerTitle}>{title}</Text>

      <View style={styles.divider} />

      <Text style={styles.noBidsHeadline}>
        You earned Rank #1 this cycle.
      </Text>
      <Text style={styles.noBidsBody}>
        No one placed a bid — the title is yours.
      </Text>
      <Text style={styles.noBidsSub}>
        You're now {title} of {data.geographyLabel}{'\n'}for the next cycle.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.noBidsReward}>
        Cycle reward: 0 Credits (no bid pool)
      </Text>
      <Text style={styles.noBidsRewardNote}>
        You get the title and all title powers.
      </Text>

      <TouchableOpacity
        onPress={onClose}
        style={styles.closeNoBidsBtn}
        accessibilityLabel="Close — you've won the title"
        accessibilityRole="button"
      >
        <Text style={styles.closeNoBidsBtnText}>Close 👑</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── MAIN OVERLAY ──────────────────────────────────────────────────────────────

const DecisionPromptOverlay: React.FC<DecisionPromptOverlayProps> = ({
  decision,
}) => {
  const { phase, data, countdown, onAcceptTap, onAcceptConfirm, onAcceptCancel, onKeepTitle, submitState } =
    decision;

  const [reducedMotion, setReducedMotion] = useState(false);

  // Animated values for entry
  const slideAnim = useRef(new Animated.Value(600)).current;
  const scrimAnim = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const bidOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;

  const isVisible = phase === 'active' || phase === 'confirming_accept' || phase === 'submitting';
  const isConfirming = phase === 'confirming_accept';
  const isSubmitting = phase === 'submitting';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // Block Android back button — non-dismissible per LAW 3
  useEffect(() => {
    if (!isVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [isVisible]);

  // Entry animation sequence per §16.4
  useEffect(() => {
    if (!isVisible) {
      // Reset all animations
      slideAnim.setValue(600);
      scrimAnim.setValue(0);
      headerOpacity.setValue(0);
      bidOpacity.setValue(0);
      buttonsOpacity.setValue(0);
      timerOpacity.setValue(0);
      return;
    }

    if (reducedMotion) {
      // Instant show
      slideAnim.setValue(0);
      scrimAnim.setValue(0.5);
      headerOpacity.setValue(1);
      bidOpacity.setValue(1);
      buttonsOpacity.setValue(1);
      timerOpacity.setValue(1);
      return;
    }

    // T+0ms: Scrim fade in
    Animated.timing(scrimAnim, {
      toValue: 0.5,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // T+150ms: Modal slide up (spring)
    setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 0,
        ...SPRING_PRESETS.decisionEntry,
        useNativeDriver: true,
      }).start();
    }, 150);

    // T+450ms: Header fade in
    setTimeout(() => {
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 450);

    // T+600ms: Bid amount
    setTimeout(() => {
      Animated.timing(bidOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 600);

    // T+750ms: Buttons slide in
    setTimeout(() => {
      Animated.timing(buttonsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 750);

    // T+900ms: Timer
    setTimeout(() => {
      Animated.timing(timerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 900);
  }, [isVisible, reducedMotion]);

  if (!data || (!isVisible && phase !== 'complete')) return null;

  const hasBid = data.highestBid != null;
  const { city, title } = getDecisionHeader(data.tier, data.geographyLabel);
  const decisionTargetMs = Date.now() + countdown.secondsRemaining * 1000;

  const accessibilityLabel =
    `Decision required. You won ${title} of ${data.geographyLabel}. ` +
    (hasBid && data.highestBid
      ? `Highest bid: ${data.highestBid.amount} Credits by @${data.highestBid.bidderHandle}. `
      : 'No bids placed. ') +
    `You have ${countdown.formatted.minutes} minutes and ${countdown.formatted.seconds} seconds to decide. ` +
    `Two options: Accept Money (receive ${data.acceptAmount} Credits), or Keep Title. Default is Keep Title.`;

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={() => {}} // Blocked — non-dismissible
      accessibilityViewIsModal
    >
      {/* Scrim */}
      <Animated.View
        style={[styles.scrim, { opacity: scrimAnim }]}
        pointerEvents="none"
      />

      {/* Modal container */}
      <View style={styles.modalWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.modal,
            { transform: [{ translateY: slideAnim }] },
          ]}
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityLiveRegion="assertive"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* No-bid alternate state */}
            {!hasBid ? (
              <NoBidsState
                data={data}
                onClose={() => {
                  if (!isSubmitting) onKeepTitle();
                }}
              />
            ) : (
              <>
                {/* Header */}
                <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
                  <Text style={styles.headerIcon} aria-hidden>⚔️</Text>
                  <Text style={styles.headerCity}>{city}</Text>
                  <Text style={styles.headerTitle}>{title}</Text>
                  <Text style={styles.headerTagline}>
                    The decision is yours.{'\n'}No one can take this title without your permission.
                  </Text>
                </Animated.View>

                <View style={styles.divider} />

                {/* Bid info */}
                <Animated.View style={[styles.bidSection, { opacity: bidOpacity }]}>
                  <Text style={styles.bidSectionLabel}>HIGHEST BID</Text>
                  <Text style={styles.bidAmount}>
                    {new Intl.NumberFormat('en-US').format(data.highestBid!.amount)} Credits
                  </Text>
                  <Text style={styles.bidder}>
                    by @{data.highestBid!.bidderHandle}
                    {'  '}
                    <Text style={styles.trustScore}>
                      (Trust Score: {data.highestBid!.bidderTrustScore} ⭐)
                    </Text>
                  </Text>
                </Animated.View>

                <View style={styles.divider} />

                {/* Choice buttons */}
                <Animated.View style={[styles.choiceRow, { opacity: buttonsOpacity }]}>
                  {/* ACCEPT MONEY */}
                  <TouchableOpacity
                    onPress={onAcceptTap}
                    style={[styles.choiceCard, styles.choiceCardAccept]}
                    disabled={isSubmitting || isConfirming}
                    accessibilityLabel={`Accept Money — receive ${data.acceptAmount} Credits. Bidder becomes ${title}.`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.choiceTitle}>ACCEPT MONEY</Text>
                    <Text style={styles.choiceAmount}>
                      +{new Intl.NumberFormat('en-US').format(data.acceptAmount)} Credits
                    </Text>
                    <Text style={styles.choiceSub}>to your wallet</Text>
                    <Text style={styles.choiceSub}>
                      (92% of bid, after{'\n'}8% CROWN fee)
                    </Text>
                    <View style={styles.choiceDivider} />
                    <Text style={styles.choiceFooter}>
                      Bidder becomes {title}
                    </Text>
                  </TouchableOpacity>

                  {/* KEEP TITLE */}
                  <TouchableOpacity
                    onPress={() => { if (!isSubmitting && !isConfirming) onKeepTitle(); }}
                    style={[styles.choiceCard, styles.choiceCardKeep]}
                    disabled={isSubmitting || isConfirming}
                    accessibilityLabel={`Keep Title — remain ${title} for another cycle. Earn ${data.keepCycleReward} Credits from cycle pool.`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.choiceTitleKeep}>KEEP TITLE</Text>
                    <Text style={styles.choiceAmountKeep}>
                      {title}{'\n'}for 1 more cycle
                    </Text>
                    <Text style={styles.choiceSub}>
                      +{new Intl.NumberFormat('en-US').format(data.keepCycleReward)} Credits
                    </Text>
                    <Text style={styles.choiceSub}>from cycle pool</Text>
                    <View style={styles.choiceDivider} />
                    <Text style={styles.choiceFooter}>
                      Bidder refunded.
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <View style={styles.divider} />

                {/* Auto-decide timer */}
                <Animated.View style={[styles.timerSection, { opacity: timerOpacity }]}>
                  <View style={styles.timerRow}>
                    <Text style={styles.timerLabel}>Auto-decision in: </Text>
                    <CountdownTimer
                      targetMs={decisionTargetMs}
                      variant="decision"
                      accessibilityPrefix="Auto-decision countdown"
                    />
                  </View>
                  <Text style={styles.timerDefault}>
                    → Auto: KEEP TITLE (the safe default)
                  </Text>
                  <Pressable
                    style={styles.whyLink}
                    accessibilityLabel="Learn why Keep Title is the default"
                    accessibilityRole="button"
                    accessibilityHint="Opens explainer"
                  >
                    <Text style={styles.whyLinkText}>
                      Why is KEEP TITLE the default? ↗
                    </Text>
                  </Pressable>
                </Animated.View>
              </>
            )}
          </ScrollView>

          {/* Error state */}
          {submitState.status === 'error' && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                ⚠️ {submitState.error} — Tap to retry
              </Text>
            </View>
          )}

          {/* Confirming sheet */}
          {isConfirming && data && (
            <ConfirmSheet
              data={data}
              onConfirm={onAcceptConfirm}
              onBack={onAcceptCancel}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Submitting overlay */}
          {isSubmitting && (
            <View style={styles.submittingOverlay}>
              <Text style={styles.submittingText}>Processing...</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS_DARK.bgElevated,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.xl,
    gap: 0,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.base,
  },
  headerIcon: {
    fontSize: 48,
    lineHeight: 56,
    textAlign: 'center',
  },
  headerCity: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.hero,
    color: COLORS_DARK.fgTextStrong,
    textAlign: 'center',
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.heroSub,
    color: COLORS_DARK.fgBrand,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerTagline: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: SPACING.xs,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS_DARK.borderSubtle,
    marginVertical: SPACING.md,
  },

  // Bid section
  bidSection: {
    gap: SPACING.xs,
    alignItems: 'center',
  },
  bidSectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bidAmount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.bidDisplay,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
    textAlign: 'center',
  },
  bidder: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
  },
  trustScore: {
    color: COLORS_DARK.fgBrand,
  },

  // Choice buttons
  choiceRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  choiceCard: {
    flex: 1,
    borderRadius: RADIUS.card,
    padding: SPACING.base,
    gap: SPACING.xs,
    minHeight: TOUCH_TARGET * 3,
  },
  choiceCardAccept: {
    borderWidth: 2,
    borderColor: COLORS_DARK.fgBrand,
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  choiceCardKeep: {
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    backgroundColor: COLORS_DARK.bgCard,
  },
  choiceTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.chip + 2,
    color: COLORS_DARK.fgBrand,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  choiceTitleKeep: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.chip + 2,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  choiceAmount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.credits,
    color: COLORS_DARK.fgSuccess,
    fontWeight: '700',
  },
  choiceAmountKeep: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextStrong,
    lineHeight: 18,
  },
  choiceSub: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 17,
  },
  choiceDivider: {
    height: 1,
    backgroundColor: COLORS_DARK.borderSubtle,
    marginVertical: SPACING.xs,
  },
  choiceFooter: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
    lineHeight: 17,
  },

  // Timer
  timerSection: {
    gap: SPACING.xs,
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timerLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
  timerDefault: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
  },
  whyLink: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whyLinkText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    textDecorationLine: 'underline',
  },

  // Error banner
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderTopWidth: 1,
    borderTopColor: COLORS_DARK.fgDanger,
    padding: SPACING.base,
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgDanger,
    textAlign: 'center',
  },

  // Confirm sheet
  confirmSheet: {
    backgroundColor: COLORS_DARK.bgElevated,
    borderTopWidth: 1,
    borderTopColor: COLORS_DARK.borderSubtle,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.pill,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextStrong,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmAmountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmAmountLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
  confirmAmount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgSuccess,
    fontWeight: '700',
  },
  confirmFeeNote: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  confirmBackBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBackBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  confirmBackBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
  confirmAcceptBtn: {
    flex: 2,
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmAcceptBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Submitting overlay
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,16,24,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgBrand,
  },

  // No bids state
  noBidsContainer: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  noBidsHeadline: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextStrong,
    textAlign: 'center',
  },
  noBidsBody: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  noBidsSub: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgBrand,
    textAlign: 'center',
    lineHeight: 22,
  },
  noBidsReward: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
  },
  noBidsRewardNote: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
    textAlign: 'center',
  },
  closeNoBidsBtn: {
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  closeNoBidsBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },
});

export default React.memo(DecisionPromptOverlay);

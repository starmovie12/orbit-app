/**
 * BidSheet — Place / raise a bid in the BOLI Auction (Phase 4)
 *
 * Opens from the Active Cycle Phase Panel's "Place Bid" action during Phase 4
 * (PRD §9). Shows the live high bid, the minimum next bid, the user's available
 * credits, quick-increment chips, and a validated amount entry. The actual write
 * is delegated to the parent via onPlaceBid (which calls api/bids.placeBid).
 *
 * Light cream/gold surface matching the home screen. No black, no dark panels.
 * Every colour comes from tokens.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  AccessibilityInfo,
  Keyboard,
} from 'react-native';
import { Tier } from '../types';
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
import { TIER_TO_TITLE, formatCredits } from '../constants/titles';
import { computeAcceptAmount } from '../core/rank';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface BidSheetProps {
  visible: boolean;
  tier: Tier;
  geographyLabel: string;
  /** Auction floor — minimum allowed first bid. */
  basePrice: number;
  /** Live highest bid, or null if no bids placed yet. */
  currentHighBid: number | null;
  /** Credits the user has available to bid. */
  userCredits: number;
  submitting?: boolean;
  onPlaceBid: (amount: number) => void | Promise<void>;
  onClose: () => void;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const QUICK_INCREMENTS = [500, 1000, 5000] as const;

/** Minimum step above the current high bid (≥100, else 2%). */
function minStep(highBid: number): number {
  return Math.max(100, Math.ceil(highBid * 0.02));
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

const BidSheet: React.FC<BidSheetProps> = ({
  visible,
  tier,
  geographyLabel,
  basePrice,
  currentHighBid,
  userCredits,
  submitting = false,
  onPlaceBid,
  onClose,
}) => {
  const meta = TIER_META[tier];
  const title = TIER_TO_TITLE[tier];

  const minNextBid = useMemo(() => {
    if (currentHighBid != null && currentHighBid > 0) {
      return currentHighBid + minStep(currentHighBid);
    }
    return Math.max(1, basePrice);
  }, [currentHighBid, basePrice]);

  const [amount, setAmount] = useState<string>(String(minNextBid));

  const slideAnim = useRef(new Animated.Value(0)).current;
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reducedMotionRef.current = v;
    });
  }, []);

  // Reset the input to the current minimum whenever the sheet (re)opens.
  useEffect(() => {
    if (visible) {
      setAmount(String(minNextBid));
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
  }, [visible, minNextBid, slideAnim]);

  const numericAmount = useMemo(() => {
    const parsed = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [amount]);

  const belowMin = numericAmount < minNextBid;
  const overCredits = numericAmount > userCredits;
  const isValid = !belowMin && !overCredits && numericAmount > 0;

  const acceptPreview = numericAmount > 0 ? computeAcceptAmount(numericAmount) : 0;

  const handleQuickAdd = useCallback(
    (delta: number) => {
      const base = numericAmount > 0 ? numericAmount : minNextBid;
      setAmount(String(base + delta));
    },
    [numericAmount, minNextBid],
  );

  const handleSetMin = useCallback(() => {
    setAmount(String(minNextBid));
  }, [minNextBid]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    Keyboard.dismiss();
    await onPlaceBid(numericAmount);
  }, [isValid, submitting, onPlaceBid, numericAmount]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  const ctaLabel = currentHighBid != null ? 'Place higher bid' : 'Place bid';

  let helperText: string = `Minimum bid is ${formatCredits(minNextBid)}.`;
  let helperColor: string = COLORS_DARK.fgTextMuted;
  if (belowMin && numericAmount > 0) {
    helperText = `Bid must be at least ${formatCredits(minNextBid)}.`;
    helperColor = COLORS_DARK.fgDanger;
  } else if (overCredits) {
    helperText = `You only have ${formatCredits(userCredits)}.`;
    helperColor = COLORS_DARK.fgDanger;
  }

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
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji} aria-hidden>
              {meta.emoji}
            </Text>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Bid for {title}</Text>
              <Text style={styles.headerGeo} numberOfLines={1}>
                {geographyLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close bid sheet"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Live high bid */}
          <View style={styles.highBidRow}>
            <View style={styles.highBidCell}>
              <Text style={styles.highBidLabel}>CURRENT HIGH BID</Text>
              <Text style={styles.highBidValue}>
                {currentHighBid != null ? formatCredits(currentHighBid) : 'No bids yet'}
              </Text>
            </View>
            <View style={styles.highBidCell}>
              <Text style={styles.highBidLabel}>YOUR CREDITS</Text>
              <Text style={styles.highBidValue}>{formatCredits(userCredits)}</Text>
            </View>
          </View>

          {/* Amount input */}
          <View
            style={[
              styles.inputWrap,
              (belowMin && numericAmount > 0) || overCredits
                ? styles.inputWrapError
                : null,
            ]}
          >
            <Text style={styles.inputPrefix}>Cr</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              style={styles.input}
              placeholder={String(minNextBid)}
              placeholderTextColor={COLORS_DARK.fgTextDisabled}
              maxLength={12}
              accessibilityLabel="Bid amount in credits"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              onPress={handleSetMin}
              style={styles.minChip}
              accessibilityRole="button"
              accessibilityLabel="Set minimum bid"
            >
              <Text style={styles.minChipText}>MIN</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.helperText, { color: helperColor }]}>{helperText}</Text>

          {/* Quick increments */}
          <View style={styles.quickRow}>
            {QUICK_INCREMENTS.map((inc) => (
              <TouchableOpacity
                key={inc}
                style={styles.quickChip}
                onPress={() => handleQuickAdd(inc)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${inc} credits`}
              >
                <Text style={styles.quickChipText}>+{inc.toLocaleString('en-US')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Accept preview */}
          {numericAmount > 0 && (
            <View style={styles.previewRow}>
              <Text style={styles.previewText}>
                If the title-holder accepts, they receive
              </Text>
              <Text style={styles.previewValue}>{formatCredits(acceptPreview)}</Text>
              <Text style={styles.previewSub}>(after the 8% CROWN fee)</Text>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.cta, !isValid && styles.ctaDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValid || submitting }}
            accessibilityLabel={ctaLabel}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS_DARK.bgSurface} />
            ) : (
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            )}
          </TouchableOpacity>
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
    paddingBottom: SPACING.base,
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

  // High bid
  highBidRow: {
    flexDirection: 'row',
    backgroundColor: COLORS_DARK.bgCard,
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    marginBottom: SPACING.base,
  },
  highBidCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  highBidLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgTextMuted,
    letterSpacing: 0.6,
  },
  highBidValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.credits,
    color: COLORS_DARK.fgBrand,
  },

  // Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS_DARK.bgElevated,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderColor: COLORS_DARK.borderGold,
    paddingHorizontal: SPACING.base,
    height: 60,
    gap: SPACING.sm,
  },
  inputWrapError: {
    borderColor: COLORS_DARK.fgDanger,
  },
  inputPrefix: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.credits,
    color: COLORS_DARK.fgTextMuted,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.bidDisplay,
    color: COLORS_DARK.fgTextStrong,
    padding: 0,
  },
  minChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(212,160,23,0.14)',
  },
  minChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgBrand,
    letterSpacing: 0.6,
  },
  helperText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    marginTop: SPACING.sm,
  },

  // Quick increments
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderGold,
    backgroundColor: COLORS_DARK.bgElevated,
  },
  quickChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },

  // Accept preview
  previewRow: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    gap: 2,
  },
  previewText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  previewValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.heroSub,
    color: COLORS_DARK.fgAccentOrange,
  },
  previewSub: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgTextDisabled,
  },

  // CTA
  cta: {
    marginTop: SPACING.lg,
    height: TOUCH_TARGET + 8,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS_DARK.fgBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: COLORS_DARK.fgTextDisabled,
  },
  ctaText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.credits,
    color: COLORS_DARK.bgSurface,
    letterSpacing: 0.4,
  },
});

export default React.memo(BidSheet);

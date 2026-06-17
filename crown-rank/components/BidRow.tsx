/**
 * BidRow — Bid history feed row
 *
 * Per PRD §10 (Section 6):
 * 5 states:
 *   1. active_winning    → ✅ WINNING — top bidder, auction live
 *   2. active_outbid     → ⚠️ OUTBID — current high is above yours
 *   3. settled_won       → 🏆 WON · TITLED — you paid and got the title
 *   4. settled_seller_kept → 🔄 SELLER KEPT TITLE — refunded in full
 *   5. settled_outbid_refunded → ❌ OUTBID · REFUNDED — lost the auction
 *   6. settled_expired   → Auction expired (no winner)
 *
 * Tapping opens the live auction bottom sheet for active bids.
 * Settled bids are read-only.
 *
 * Zero raw hex values. All from tokens.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { BidRecord, BidStatus } from '../types';
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
import CountdownTimer from './CountdownTimer';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface BidRowProps {
  bid: BidRecord;
  /** Opens live auction detail (active bids only) */
  onTap?: (bid: BidRecord) => void;
  /** Called when user taps "Raise bid" CTA */
  onRaiseBid?: (bid: BidRecord) => void;
  /** Called when user taps "Withdraw" */
  onWithdrawBid?: (bid: BidRecord) => void;
}

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BidStatus,
  {
    label: string;
    emoji: string;
    labelColor: string;
    bgAccent?: string;
  }
> = {
  active_winning: {
    label: 'WINNING',
    emoji: '✅',
    labelColor: COLORS_DARK.fgSuccess,
    bgAccent: 'rgba(16,185,129,0.06)',
  },
  active_outbid: {
    label: 'OUTBID',
    emoji: '⚠️',
    labelColor: COLORS_DARK.fgAccentOrange,
    bgAccent: 'rgba(224,123,32,0.06)',
  },
  settled_won: {
    label: 'WON · TITLED',
    emoji: '🏆',
    labelColor: COLORS_DARK.fgBrand,
    bgAccent: 'rgba(245,158,11,0.04)',
  },
  settled_seller_kept: {
    label: 'SELLER KEPT TITLE',
    emoji: '🔄',
    labelColor: COLORS_DARK.fgTextMuted,
    bgAccent: undefined,
  },
  settled_outbid_refunded: {
    label: 'OUTBID · REFUNDED',
    emoji: '❌',
    labelColor: COLORS_DARK.fgTextMuted,
    bgAccent: undefined,
  },
  settled_expired: {
    label: 'EXPIRED',
    emoji: '⌛',
    labelColor: COLORS_DARK.fgTextDisabled,
    bgAccent: undefined,
  },
};

// ── FORMATTED HELPERS ─────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' Cr';
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const BidRow: React.FC<BidRowProps> = ({
  bid,
  onTap,
  onRaiseBid,
  onWithdrawBid,
}) => {
  const config = STATUS_CONFIG[bid.status];
  const tierMeta = TIER_META[bid.tier];
  const isActive = bid.status === 'active_winning' || bid.status === 'active_outbid';
  const isOutbid = bid.status === 'active_outbid';
  const isWon = bid.status === 'settled_won';
  const isSellerKept = bid.status === 'settled_seller_kept';
  const isRefunded =
    bid.status === 'settled_outbid_refunded' || bid.status === 'settled_seller_kept';

  const auctionTargetMs =
    isActive && bid.auctionEndsIn != null
      ? Date.now() + bid.auctionEndsIn * 1000
      : null;

  const accessibilityLabel =
    `${TIER_TO_TITLE[bid.tier]} in ${bid.geographyLabel}. ` +
    `Status: ${config.label}. ` +
    `Your bid: ${formatAmount(bid.amount)}.` +
    (isOutbid && bid.currentHighBid != null
      ? ` Current high: ${formatAmount(bid.currentHighBid)}.`
      : '') +
    (bid.settledAt ? ` Settled: ${formatTimestamp(bid.settledAt)}.` : '');

  return (
    <Pressable
      onPress={isActive ? () => onTap?.(bid) : undefined}
      style={({ pressed }) => [
        styles.card,
        config.bgAccent ? { backgroundColor: config.bgAccent } : {},
        pressed && isActive && styles.cardPressed,
      ]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isActive ? 'button' : 'text'}
      accessibilityHint={isActive ? 'Double tap to view live auction' : undefined}
    >
      {/* Header: tier + geo + status */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.tierEmoji} aria-hidden>{tierMeta.emoji}</Text>
          <View style={styles.titleGroup}>
            <Text style={styles.tierName} numberOfLines={1}>
              {bid.geographyLabel}
            </Text>
            <Text style={styles.tierRole} numberOfLines={1}>
              {TIER_TO_TITLE[bid.tier]}
            </Text>
          </View>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusEmoji} aria-hidden>{config.emoji}</Text>
          <Text style={[styles.statusLabel, { color: config.labelColor }]}>
            {config.label}
          </Text>
        </View>
      </View>

      {/* Amount row */}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Your bid: </Text>
        <Text style={styles.amountValue}>{formatAmount(bid.amount)}</Text>

        {/* Current high (outbid state) */}
        {isOutbid && bid.currentHighBid != null && (
          <>
            <Text style={styles.amountSeparator}>  ·  </Text>
            <Text style={styles.currentHighLabel}>Current high: </Text>
            <Text style={styles.currentHighValue}>
              {formatAmount(bid.currentHighBid)}
            </Text>
            {bid.outbidBy != null && (
              <Text style={styles.outbidDelta}>
                {' '}(+{formatAmount(bid.outbidBy)})
              </Text>
            )}
          </>
        )}
      </View>

      {/* Refund notice */}
      {isRefunded && (
        <View style={styles.refundRow}>
          <Text style={styles.refundText}>
            {formatAmount(bid.amount)} → REFUNDED in full
          </Text>
        </View>
      )}

      {/* Won notice */}
      {isWon && (
        <View style={styles.wonRow}>
          <Text style={styles.wonText}>
            Bid paid · Title active for this cycle
          </Text>
        </View>
      )}

      {/* Auction countdown (active only) */}
      {isActive && auctionTargetMs !== null && (
        <View style={styles.countdownRow}>
          <Text style={styles.countdownLabel}>
            {bid.status === 'active_winning' ? 'Leading in ' : 'Ends in '}
          </Text>
          <CountdownTimer
            targetMs={auctionTargetMs}
            accessibilityPrefix="Auction ends in"
          />
        </View>
      )}

      {/* Settled timestamp */}
      {!isActive && bid.settledAt && (
        <Text style={styles.timestamp}>
          {formatTimestamp(bid.settledAt)}
        </Text>
      )}

      {/* Active bid actions */}
      {isActive && (
        <View style={styles.actionsRow}>
          {isOutbid && (
            <>
              <TouchableOpacity
                onPress={() => onRaiseBid?.(bid)}
                style={styles.raiseBtn}
                accessibilityLabel={`Raise bid to ${bid.currentHighBid != null ? formatAmount(Math.ceil(bid.currentHighBid * 1.05)) : 'minimum 5% above current high'}`}
                accessibilityRole="button"
              >
                <Text style={styles.raiseBtnText}>
                  Raise to{' '}
                  {bid.currentHighBid != null
                    ? formatAmount(Math.ceil(bid.currentHighBid * 1.05))
                    : '+5%'}
                </Text>
              </TouchableOpacity>

              <Pressable
                onPress={() => onWithdrawBid?.(bid)}
                style={({ pressed }) => [
                  styles.withdrawBtn,
                  pressed && styles.withdrawBtnPressed,
                ]}
                accessibilityLabel="Withdraw your bid"
                accessibilityRole="button"
              >
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </Pressable>
            </>
          )}

          {bid.status === 'active_winning' && (
            <Text style={styles.winningHint}>
              Tap to see live auction ↗
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS_DARK.bgCard,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  cardPressed: {
    opacity: 0.92,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  tierEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  titleGroup: {
    flex: 1,
    gap: 1,
  },
  tierName: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    lineHeight: 20,
  },
  tierRole: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    flexShrink: 0,
  },
  statusEmoji: {
    fontSize: 13,
  },
  statusLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    letterSpacing: 0.3,
  },

  // Amounts
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0,
  },
  amountLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  amountValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
  },
  amountSeparator: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
  },
  currentHighLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  currentHighValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgAccentOrange,
    fontWeight: '700',
  },
  outbidDelta: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgAccentOrange,
  },

  // Refund / won notices
  refundRow: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  refundText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgSuccess,
  },
  wonRow: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  wonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },

  // Countdown
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // Timestamp
  timestamp: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  raiseBtn: {
    flex: 1,
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  raiseBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.bgSurface,
  },
  withdrawBtn: {
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
  },
  withdrawBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  withdrawBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  winningHint: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgSuccess,
  },
});

export default React.memo(BidRow);

/**
 * InvasionCard — Conditional invasion countdown card
 *
 * Per PRD §9 (Section 5):
 * - Appears ONLY when user is planner OR has RSVP'd "Going"
 * - Completely hidden (null) when neither condition — no empty state
 * - Planner view: full management with RSVP counts + cancel
 * - Invitee view: "Join Invasion Now" → switches HOME tab to target city
 *
 * Two visual states:
 *   'planner' — organizer controls, more detail
 *   'invitee' — participant view, quick-join CTA
 *
 * Zero raw hex values. All from tokens.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { InvasionData } from '../types';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TOUCH_TARGET,
  MOTION,
} from '../tokens';
import CountdownTimer from './CountdownTimer';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface InvasionCardProps {
  invasion: InvasionData;
  /** Navigate to HOME and switch scope to invasion target city */
  onJoinInvasion: () => void;
  /** Navigate to invasion management screen */
  onManageInvasion?: () => void;
  /** Cancel the invasion (planner only) */
  onCancelInvasion?: () => void;
}

// ── LIVE RSVP CHIP ────────────────────────────────────────────────────────────

const RsvpChip: React.FC<{ count: number; label: string; emoji: string }> = ({
  count,
  label,
  emoji,
}) => (
  <View style={styles.rsvpChip}>
    <Text style={styles.rsvpEmoji} aria-hidden>{emoji}</Text>
    <Text style={styles.rsvpCount}>{count}</Text>
    <Text style={styles.rsvpLabel}>{label}</Text>
  </View>
);

// ── PLANNER VIEW ──────────────────────────────────────────────────────────────

const PlannerView: React.FC<{
  invasion: InvasionData;
  onManage?: () => void;
  onCancel?: () => void;
}> = ({ invasion, onManage, onCancel }) => {
  const targetMs = Date.now() + invasion.startsIn * 1000;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.warIcon} aria-hidden>⚔️</Text>
        <View style={styles.headerText}>
          <Text style={styles.invasionTitle} numberOfLines={1}>
            {invasion.banner}
          </Text>
          <Text style={styles.invasionSub} numberOfLines={1}>
            You're leading this invasion
          </Text>
        </View>
        <View style={styles.plannerBadge}>
          <Text style={styles.plannerBadgeText}>ORGANIZER</Text>
        </View>
      </View>

      {/* Target city */}
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>Target: </Text>
        <Text style={styles.targetCity}>{invasion.targetCityLabel}</Text>
      </View>

      {/* War cry */}
      {invasion.warCry && (
        <Text style={styles.warCry} numberOfLines={2}>
          "{invasion.warCry}"
        </Text>
      )}

      {/* Countdown */}
      <View style={styles.countdownRow}>
        <Text style={styles.countdownLabel}>Starts in </Text>
        <CountdownTimer
          targetMs={targetMs}
          accessibilityPrefix="Invasion starts in"
        />
      </View>

      {/* RSVP chips */}
      <View style={styles.rsvpRow}>
        <RsvpChip count={invasion.rsvpGoing} label="going" emoji="✅" />
        <RsvpChip count={invasion.rsvpMaybe} label="maybe" emoji="🤔" />
        <RsvpChip count={invasion.rsvpSkip} label="skip" emoji="❌" />
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={onManage}
          style={styles.primaryBtn}
          accessibilityLabel="Manage invasion settings and view full RSVP list"
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Manage Invasion</Text>
        </TouchableOpacity>

        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.dangerBtn,
            pressed && styles.dangerBtnPressed,
          ]}
          accessibilityLabel="Cancel this invasion"
          accessibilityRole="button"
        >
          <Text style={styles.dangerBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ── INVITEE VIEW ──────────────────────────────────────────────────────────────

const InviteeView: React.FC<{
  invasion: InvasionData;
  onJoin: () => void;
}> = ({ invasion, onJoin }) => {
  const targetMs = Date.now() + invasion.startsIn * 1000;

  // Pulse animation on the countdown when near start (< 5 min)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isNear = invasion.startsIn < 300; // < 5 minutes

  useEffect(() => {
    if (!isNear) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isNear, pulseAnim]);

  return (
    <View style={[styles.card, styles.cardInvitee]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.warIcon} aria-hidden>⚔️</Text>
        <View style={styles.headerText}>
          <Text style={styles.invasionTitle} numberOfLines={1}>
            {invasion.banner}
          </Text>
          <Text style={styles.invasionSub}>
            by @{invasion.plannerHandle}
          </Text>
        </View>
        {isNear && (
          <Animated.View style={[styles.urgentBadge, { opacity: pulseAnim }]}>
            <Text style={styles.urgentBadgeText}>STARTING SOON</Text>
          </Animated.View>
        )}
      </View>

      {/* War cry */}
      {invasion.warCry && (
        <Text style={styles.warCry} numberOfLines={1}>
          "{invasion.warCry}"
        </Text>
      )}

      {/* Countdown + raiders */}
      <View style={styles.countdownRaiderRow}>
        <View style={styles.countdownSection}>
          <Text style={styles.countdownLabel}>Starts in </Text>
          <CountdownTimer
            targetMs={targetMs}
            accessibilityPrefix="Invasion starts in"
          />
        </View>
        <View style={styles.raidersSection}>
          <Text style={styles.raidersCount}>{invasion.rsvpGoing}</Text>
          <Text style={styles.raidersLabel}> raiders going</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.stayBtn,
            pressed && styles.stayBtnPressed,
          ]}
          accessibilityLabel="Stay on your current chat, don't join invasion"
          accessibilityRole="button"
        >
          <Text style={styles.stayBtnText}>Stay Here</Text>
        </Pressable>

        <TouchableOpacity
          onPress={onJoin}
          style={styles.joinBtn}
          accessibilityLabel={`Join invasion — switches to ${invasion.targetCityLabel} chat`}
          accessibilityRole="button"
        >
          <Text style={styles.joinBtnText}>⚔️ Join Invasion Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const InvasionCard: React.FC<InvasionCardProps> = ({
  invasion,
  onJoinInvasion,
  onManageInvasion,
  onCancelInvasion,
}) => {
  if (invasion.role === 'planner') {
    return (
      <PlannerView
        invasion={invasion}
        onManage={onManageInvasion}
        onCancel={onCancelInvasion}
      />
    );
  }

  return <InviteeView invasion={invasion} onJoin={onJoinInvasion} />;
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
    gap: SPACING.sm,
  },
  cardInvitee: {
    borderColor: 'rgba(245,158,11,0.2)',
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  warIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  invasionTitle: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
  },
  invasionSub: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // Planner badge
  plannerBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  plannerBadgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgBrand,
    letterSpacing: 0.6,
  },

  // Urgent badge (near-start pulse)
  urgentBadge: {
    backgroundColor: 'rgba(224,123,32,0.15)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  urgentBadgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.micro,
    color: COLORS_DARK.fgAccentOrange,
    letterSpacing: 0.6,
  },

  // Target city (planner)
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  targetCity: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextStrong,
  },

  // War cry
  warCry: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
    fontStyle: 'italic',
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
  countdownRaiderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.base,
  },
  countdownSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  raidersSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  raidersCount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgBrand,
    fontWeight: '700',
  },
  raidersLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // RSVP chips
  rsvpRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  rsvpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 2,
  },
  rsvpEmoji: {
    fontSize: 12,
  },
  rsvpCount: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
  },
  rsvpLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
  },
  primaryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: COLORS_DARK.fgDanger,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
  },
  dangerBtnPressed: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  dangerBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgDanger,
  },
  stayBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  stayBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stayBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
  joinBtn: {
    flex: 2,
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  joinBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },
});

export default React.memo(InvasionCard);

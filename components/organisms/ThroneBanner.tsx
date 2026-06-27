/**
 * components/organisms/ThroneBanner.tsx
 * CROWN — The Throne Banner (HOME centerpiece)
 * ────────────────────────────────────────────────────────────────────────────
 * The luxury status card that sits at the top of HOME, above the chat. Shows
 * the current title-holder for the active scope (World IMPERATOR / Country
 * SOVEREIGN / City Mayor(VICEROY) / Sector BARON), their pinned message, and
 * the live cycle. Designed to make people WANT a title.
 *
 * Pure presentational — the parent resolves the holder from the room
 * (CWRoom.mayorUid + CWRoom.pinnedAnnouncementId + CWRoom.heatScore) and passes
 * it in. This component never reads Firestore, so it is data-source agnostic.
 *
 * Premium recipe (CROWN-DESIGNER §4.10 — four elevations, never one flat plane):
 *   E0 page surface · E1 cream→gold gradient body (+3px gold accent bar, +2px
 *   gold border) · E2 inner pinned-message plate · E3 avatar gold ring + glow ·
 *   Overlay royal shine (diagonal white-alpha sweep).
 * Two-shadow-colour law: CONTENT shadow is GOLD (colors.fg.brand); ordinary
 * chrome would be INK. The throne hand-rolls its gold content shadow.
 *
 * Motion: chrome entrance = easeOut; a one-shot gold SHIMMER sweeps on mount and
 * whenever the holder changes (a fresh crowning). useReducedMotion() → opacity
 * only, no transform. (LAW — every animated piece has the opacity fallback.)
 *
 * Copy: all chrome strings are ENGLISH (global product lock). holder.pinnedMessage
 * is user content and is rendered verbatim.
 *
 * Tokens only — no raw hex except the decorative white-alpha shine overlay.
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, palette, radii, spacing } from '@/constants/colors';
import {
  FONT_HEADING,
  FONT_BODY,
  FONT_NUMERIC,
  FONT_CORMORANT,
} from '@/constants/typography';
import { durations, useReducedMotion } from '@/constants/animations';
import { TITLE_LABELS, type TitleTier } from '@/constants/titles';
import Avatar from '@/components/atoms/Avatar';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ThroneHolder {
  /** User id of the holder (CWRoom.mayorUid resolved). */
  uid: string;
  /** Display handle, with or without a leading '@' — normalized for render. */
  handle: string;
  /** Avatar emoji (CWUser.emoji). */
  emoji?: string | null;
  /** Avatar circle colour (CWUser.color). */
  color?: string | null;
  /** The holder's 24h pinned broadcast (CWMessage.text of pinnedAnnouncementId). */
  pinnedMessage?: string | null;
  /** Heat Score 0–100 (CWRoom.heatScore). */
  heat: number;
  /** How many cycles the holder has held this throne. */
  cyclesHeld?: number;
  /** Human label for last activity, e.g. '1h ago'. */
  lastActiveLabel?: string | null;
}

export interface ThroneCycle {
  /** Phase label, e.g. 'Battle Hour'. */
  label: string;
  /** Countdown label, e.g. '18m'. */
  endsInLabel: string;
  /** Optional phase glyph, e.g. '🌒'. */
  phaseGlyph?: string;
}

export interface ThroneBannerProps {
  /** Active scope tier — drives the title string. */
  tier: TitleTier;
  /** Geography label rendered in the title, e.g. 'Chandigarh' / 'India' / 'Earth'. */
  scopeLabel: string;
  /** The current holder, or null when the throne is vacant. */
  holder: ThroneHolder | null;
  /** Live cycle info, or null when no cycle is running. */
  cycle?: ThroneCycle | null;
  /** Tap the holder row → open their profile. */
  onPressHolder?: () => void;
  /** Tap the pinned message → expand it. */
  onPressPin?: () => void;
  /** Empty-seat CTA → ranks / climb flow. */
  onPressClimb?: () => void;
  /** Label for the empty-seat countdown, e.g. '2h 14m'. */
  nextBattleLabel?: string | null;
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bespoke shadows (tuned to the elevation ladder — not the canned tiers)
// ─────────────────────────────────────────────────────────────────────────────

/** E1 — the gold CONTENT shadow that gives the throne its premium lift. */
const THRONE_SHADOW = {
  shadowColor:   colors.fg.brand, // #D4A017 — gold content shadow (CROWN signature)
  shadowOffset:  { width: 0, height: 8 },
  shadowOpacity: 0.22,
  shadowRadius:  22,
  elevation:     12,
} as const;

/** E2 — the etched micro-shadow under the inner pinned-message plate. */
const PLATE_SHADOW = {
  shadowColor:   colors.fg.brand,
  shadowOffset:  { width: 0, height: 1 },
  shadowOpacity: 0.07,
  shadowRadius:  4,
  elevation:     1,
} as const;

/** Gradient stops for the body (cream → pale gold) — from palette, never raw hex. */
const BODY_GRADIENT = [palette.cream[100], palette.cream[200], palette.gold[200]] as const;
/** Royal-shine sweep — decorative white-alpha (allowed; not a brand surface). */
const SHINE_GRADIENT = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.30)', 'rgba(255,255,255,0)'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHandle(handle: string): string {
  const h = handle.trim();
  return h.startsWith('@') ? h : `@${h}`;
}

/** Title with the mandatory bracket form, e.g. 'Mayor (VICEROY) of Chandigarh'. */
function titleFor(tier: TitleTier, scopeLabel: string): string {
  return TITLE_LABELS.WITH_SCOPE[tier](scopeLabel);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ThroneBanner({
  tier,
  scopeLabel,
  holder,
  cycle,
  onPressHolder,
  onPressPin,
  onPressClimb,
  nextBattleLabel,
  style,
}: ThroneBannerProps) {
  const reducedMotion = useReducedMotion();

  // ── One-shot shimmer: runs on mount and on every new crowning (holder change).
  const shimmerX = useRef(new Animated.Value(0)).current; // 0 → 1 sweeps left→right
  const enter    = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      enter.setValue(1);
      return;
    }
    // gentle chrome entrance (easeOut) + a single gold shimmer sweep
    enter.setValue(0);
    shimmerX.setValue(0);
    Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: durations.normal, // ~240ms
        easing: Easing.bezier(0, 0, 0.2, 1), // easeOut (chrome)
        useNativeDriver: true,
      }),
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 900,
        delay: 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // re-run when the holder identity changes (a fresh crowning)
  }, [holder?.uid, reducedMotion, enter, shimmerX]);

  const enterStyle = {
    opacity: enter,
    transform: reducedMotion
      ? []
      : [
          {
            scale: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1],
            }),
          },
        ],
  };

  // shimmer band translate across the card width (approx — overflow hidden clips it)
  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 360],
  });

  // ── EMPTY SEAT ──────────────────────────────────────────────────────────────
  if (!holder) {
    return (
      <Animated.View style={[styles.wrap, style, enterStyle]}>
        <View style={[styles.card, THRONE_SHADOW]}>
          <View style={styles.accentBar} />
          <LinearGradient colors={BODY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.body}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {`✦ THE THRONE OF ${scopeLabel.toUpperCase()}`}
            </Text>
            <Text style={styles.emptyTitle}>{`👑 The throne of ${scopeLabel} is empty`}</Text>
            {nextBattleLabel ? (
              <Text style={styles.emptyMeta}>
                {'Next Battle Hour in '}
                <Text style={styles.emptyMetaNum}>{nextBattleLabel}</Text>
              </Text>
            ) : null}
            <Pressable
              onPress={onPressClimb}
              accessibilityRole="button"
              accessibilityLabel={`Climb the ranks in ${scopeLabel}`}
              style={({ pressed }) => [styles.climbBtn, pressed && styles.pressed]}
            >
              <Text style={styles.climbLabel}>Climb the ranks</Text>
            </Pressable>
          </LinearGradient>
          {!reducedMotion && (
            <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX: shimmerTranslate }, { rotate: '18deg' }] }]}>
              <LinearGradient colors={SHINE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          )}
        </View>
      </Animated.View>
    );
  }

  // ── HELD THRONE ─────────────────────────────────────────────────────────────
  const handle = normalizeHandle(holder.handle);
  const title = titleFor(tier, scopeLabel);

  return (
    <Animated.View style={[styles.wrap, style, enterStyle]}>
      <View style={[styles.card, THRONE_SHADOW]}>
        {/* 3px gold top-accent bar */}
        <View style={styles.accentBar} />

        {/* E1 — cream→gold gradient body */}
        <LinearGradient colors={BODY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.body}>
          {/* eyebrow + live cycle chip */}
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {`✦ THE THRONE OF ${scopeLabel.toUpperCase()}`}
            </Text>
            {cycle ? (
              <View style={styles.cycleChip}>
                <Text style={styles.cycleText} numberOfLines={1}>
                  {`${cycle.phaseGlyph ?? '🌒'} ${cycle.label} `}
                  <Text style={styles.cycleNum}>{cycle.endsInLabel}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* holder row — avatar (E3 gold ring + glow) + handle + title */}
          <Pressable
            onPress={onPressHolder}
            accessibilityRole="button"
            accessibilityLabel={`${handle}, ${title}`}
            style={({ pressed }) => [styles.holderRow, pressed && styles.pressed]}
          >
            <View style={styles.avatarRing}>
              <Avatar name={holder.handle} emoji={holder.emoji} color={holder.color} size={44} />
            </View>
            <View style={styles.holderText}>
              <Text style={styles.handle} numberOfLines={1}>{handle}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {`${title} `}
                <Text style={styles.crownGlyph}>👑</Text>
              </Text>
            </View>
          </Pressable>

          {/* E2 — inner pinned-message plate */}
          {holder.pinnedMessage ? (
            <Pressable
              onPress={onPressPin}
              accessibilityRole="button"
              accessibilityLabel="Expand pinned message"
              style={({ pressed }) => [styles.plate, PLATE_SHADOW, pressed && styles.pressed]}
            >
              <Text style={styles.pinText} numberOfLines={2}>{holder.pinnedMessage}</Text>
            </Pressable>
          ) : null}

          {/* footer — Heat · cycles · last active (numbers in Space Mono) */}
          <View style={styles.footer}>
            <Text style={styles.heat}>
              {'🔥 Heat '}
              <Text style={styles.heatNum}>{String(holder.heat)}</Text>
            </Text>
            {typeof holder.cyclesHeld === 'number' ? (
              <Text style={styles.footerMeta}>
                {' · held '}
                <Text style={styles.footerNum}>{String(holder.cyclesHeld)}</Text>
                {' cycles'}
              </Text>
            ) : null}
            {holder.lastActiveLabel ? (
              <Text style={styles.footerMeta}>{` · ${holder.lastActiveLabel}`}</Text>
            ) : null}
          </View>
        </LinearGradient>

        {/* Overlay — royal shine sweep (decorative; clipped by overflow hidden) */}
        {!reducedMotion && (
          <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX: shimmerTranslate }, { rotate: '18deg' }] }]}>
            <LinearGradient colors={SHINE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (tokens only)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.base, // 16
  },
  card: {
    borderRadius: radii.lg, // 16
    borderWidth: 2,
    borderColor: colors.border.cardEmphasis, // gold[600] — the throne border
    backgroundColor: colors.bg.card,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    backgroundColor: colors.fg.brand, // gold fill accent bar
  },
  body: {
    paddingHorizontal: spacing.base, // 16
    paddingTop: spacing.md, // 12
    paddingBottom: spacing.base, // 16
  },

  // eyebrow + cycle
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: FONT_HEADING.semiBold, // Syne 700
    fontSize: 11,
    letterSpacing: 1,
    color: colors.fg.brandText, // gold text on light (large/bold rule met)
  },
  cycleChip: {
    marginLeft: spacing.sm, // 8
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: palette.gold[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cycleText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: 11,
    color: colors.fg.brandText,
  },
  cycleNum: {
    fontFamily: FONT_NUMERIC.bold, // Space Mono
    color: colors.fg.warning, // burnished amber for the countdown
  },

  // holder row
  holderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md, // 12
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.fg.brand, // gold ring
    backgroundColor: colors.bg.surface,
    // soft celebrate glow
    shadowColor: colors.fg.celebrate,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  holderText: {
    flex: 1,
    marginLeft: spacing.md, // 12
  },
  handle: {
    fontFamily: FONT_BODY.semiBold, // Inter 600
    fontSize: 16,
    color: colors.fg.primary,
  },
  title: {
    marginTop: 2,
    fontFamily: FONT_BODY.medium, // Inter 500
    fontSize: 13,
    color: colors.fg.brandText, // gold text on light
  },
  crownGlyph: {
    fontSize: 13,
  },

  // E2 pinned-message plate
  plate: {
    marginTop: spacing.md, // 12
    padding: spacing.md, // 12
    borderRadius: radii.md, // 12
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.bg.surface,
  },
  pinText: {
    fontFamily: FONT_CORMORANT.medium, // Cormorant — quotes only
    fontSize: 16,
    lineHeight: 22,
    color: colors.fg.primary,
  },

  // footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.md, // 12
  },
  heat: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: 13,
    color: colors.fg.warning, // LIVE/Heat colour
  },
  heatNum: {
    fontFamily: FONT_NUMERIC.bold, // Space Mono
    color: colors.fg.warning,
  },
  footerMeta: {
    fontFamily: FONT_BODY.regular,
    fontSize: 13,
    color: colors.fg.secondary,
  },
  footerNum: {
    fontFamily: FONT_NUMERIC.regular, // Space Mono
    color: colors.fg.secondary,
  },

  // empty seat
  emptyTitle: {
    marginTop: spacing.md, // 12
    fontFamily: FONT_HEADING.bold, // Syne 800
    fontSize: 18,
    color: colors.fg.primary,
  },
  emptyMeta: {
    marginTop: spacing.xs, // 4
    fontFamily: FONT_BODY.regular,
    fontSize: 13,
    color: colors.fg.secondary,
  },
  emptyMetaNum: {
    fontFamily: FONT_NUMERIC.bold, // Space Mono
    color: colors.fg.primary,
  },
  climbBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.base, // 16
    paddingHorizontal: spacing.lg, // 20
    paddingVertical: spacing.md, // 12
    borderRadius: radii.md, // 12
    backgroundColor: colors.fg.brand, // gold fill
  },
  climbLabel: {
    fontFamily: FONT_BODY.bold,
    fontSize: 14,
    color: palette.ink[950], // #1A1A1A — dark text on gold (white-on-gold is banned)
  },

  // shine overlay band
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 90,
  },

  // shared press feedback
  pressed: {
    opacity: 0.85,
  },
});

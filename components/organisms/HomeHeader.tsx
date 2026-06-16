/**
 * CROWN — Home Header (organism)  ·  components/organisms/HomeHeader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 *   Row 1 — gold crown glyph + "CROWN" wordmark · 🔔 · 💬
 *   Row 2 — 4-scope switcher (World / Country / City / Sector)
 *   Row 3 — live online strip (always names the active geography)
 *
 * PREMIUM REDESIGN + SCROLL BEHAVIOUR:
 *   • Wordmark now uses the brand gold (#D4A017) so it matches the gold message
 *     bubbles — large bold logo type, passes large-text AA.
 *   • On scroll the brand row + scope switcher slide up and fade out, but the
 *     ONLINE STRIP stays pinned at the top (so you always see who's online).
 *   • Copy is English (global product): "0 online worldwide", and counts use
 *     international units (K / M / B), not Lakh / Cr.
 *
 * Public API unchanged (headerScrollAnim, hideHeader, showHeader, HomeHeader).
 */

import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, palette, spacing, radii } from '@/constants/colors';
import { FONT_BODY } from '@/constants/typography';
import { FourScopeSwitcher, type ChatScope } from '@/components/molecules/FourScopeSwitcher';
import HeatPulseDot from '@/components/atoms/HeatPulseDot';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const HDR = {
  ROW1_H: 50 as const,
  ROW2_H: 44 as const,
  ROW3_H: 30 as const,
  TOTAL_H: 124 as const,

  WORDMARK_SIZE: 23 as const,
  WORDMARK_TRACKING: 2.5 as const,

  ACTION_TOUCH: 44 as const,
  ACTION_CIRCLE: 38 as const,
  ACTION_ICON: 19 as const,

  HEAT_VISIBLE_THRESHOLD: 30 as const,
  HIDE_DURATION: 220 as const,
  SHOW_SPRING_TENSION: 160 as const,
  SHOW_SPRING_FRICTION: 20 as const,

  PAD_H: spacing.base as const, // 16
  BADGE_MAX: 99 as const,
} as const;

/** Distance the top block travels (and the online strip rises) on scroll. */
const COLLAPSE_DISTANCE = HDR.ROW1_H + HDR.ROW2_H;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — shared with CrownBottomNav  (0 = visible, 1 = hidden)
// ─────────────────────────────────────────────────────────────────────────────

export const headerScrollAnim = new Animated.Value(0);

export function hideHeader(): void {
  Animated.timing(headerScrollAnim, {
    toValue: 1,
    duration: HDR.HIDE_DURATION,
    useNativeDriver: true,
  }).start();
}

export function showHeader(): void {
  Animated.spring(headerScrollAnim, {
    toValue: 0,
    tension: HDR.SHOW_SPRING_TENSION,
    friction: HDR.SHOW_SPRING_FRICTION,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatOnlineCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString('en-US');
}

function buildScopePhrase(scope: ChatScope, geoName: string): string {
  switch (scope) {
    case 'sector':
    case 'city':
    case 'country':
      return `online in ${geoName}`;
    case 'world':
      return 'online worldwide';
  }
}

function badgeLabel(count: number): string {
  return count > HDR.BADGE_MAX ? `${HDR.BADGE_MAX}+` : String(count);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeLabels {
  readonly country: string;
  readonly city: string;
  readonly sector: string;
  readonly countryEmoji: string;
}

interface HomeHeaderProps {
  readonly activeScope: ChatScope;
  readonly scopeLabels: ScopeLabels;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen: (scope: ChatScope) => void;

  readonly onlineCount: number;
  readonly heatScore: number;

  readonly onNotificationPress: () => void;
  readonly onDmPress: () => void;

  readonly showTrustAnchor: boolean;

  readonly unreadNotifications: number;
  readonly unreadDms: number;

  readonly composerFocused: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — Action icon (bell / DM) in a soft-gold circle
// ─────────────────────────────────────────────────────────────────────────────

interface ActionIconProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  unread: number;
  onPress: () => void;
  a11yLabel: string;
  a11yHint: string;
}

function ActionIcon({ icon, unread, onPress, a11yLabel, a11yHint }: ActionIconProps) {
  const hasUnread = unread > 0;
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.actionButton}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, hasUnread && styles.iconCircleActive]}>
        <Feather
          name={icon}
          size={HDR.ACTION_ICON}
          color={hasUnread ? colors.fg.brand : colors.fg.secondary}
        />
      </View>

      {hasUnread ? (
        <View
          style={[styles.actionBadge, unread > 9 ? styles.actionBadgeWide : null]}
          accessibilityElementsHidden
        >
          <Text style={styles.badgeText} allowFontScaling={false}>
            {badgeLabel(unread)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function HomeHeader({
  activeScope,
  scopeLabels,
  onScopeChange,
  onPickerOpen,
  onlineCount,
  heatScore,
  onNotificationPress,
  onDmPress,
  showTrustAnchor,
  unreadNotifications,
  unreadDms,
  composerFocused,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  // Top block (brand + switcher) slides fully off-screen and fades.
  const collapsibleTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -(insets.top + COLLAPSE_DISTANCE)],
        extrapolate: 'clamp',
      }),
    [insets.top],
  );
  const collapsibleOpacity = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange: [0, 0.55, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      }),
    [],
  );
  // Online strip rises by the top-block height → pins just under the safe area.
  const onlineTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -COLLAPSE_DISTANCE],
        extrapolate: 'clamp',
      }),
    [],
  );

  useEffect(() => {
    if (composerFocused) showHeader();
  }, [composerFocused]);

  const geoName = (() => {
    switch (activeScope) {
      case 'world':
        return '';
      case 'country':
        return scopeLabels.country;
      case 'city':
        return scopeLabels.city;
      case 'sector':
        return scopeLabels.sector;
    }
  })();

  const scopePhrase = buildScopePhrase(activeScope, geoName);
  const showHeat = heatScore >= HDR.HEAT_VISIBLE_THRESHOLD;

  return (
    <View style={[styles.root, { height: insets.top + HDR.TOTAL_H }]} pointerEvents="box-none">
      {/* Safe-area cap — keeps the notch area opaque when collapsed (native). */}
      {insets.top > 0 ? <View style={[styles.safeCap, { height: insets.top }]} /> : null}

      {/* ── COLLAPSIBLE BLOCK (Row 1 + Row 2) — hides on scroll ───────────────── */}
      <Animated.View
        style={[
          styles.collapsible,
          {
            top: insets.top,
            transform: [{ translateY: collapsibleTranslateY }],
            opacity: collapsibleOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Row 1 — Brand + Actions */}
        <View style={styles.row1} pointerEvents="box-none">
          <View style={styles.wordmarkRow} accessibilityRole="header" accessibilityLabel="CROWN">
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="m2 4 4 7 6-8 6 8 4-7-3 14H5z"
                stroke={colors.fg.brand}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M2 20h20"
                stroke={colors.fg.brand}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.wordmark} allowFontScaling={false}>
              CROWN
            </Text>
          </View>

          <View style={styles.actions}>
            <ActionIcon
              icon="bell"
              unread={unreadNotifications}
              onPress={onNotificationPress}
              a11yLabel="Notifications"
              a11yHint={
                unreadNotifications > 0
                  ? `${unreadNotifications} unread notifications`
                  : 'No new notifications'
              }
            />
            <ActionIcon
              icon="message-circle"
              unread={unreadDms}
              onPress={onDmPress}
              a11yLabel="Direct Messages"
              a11yHint={unreadDms > 0 ? `${unreadDms} unread messages` : 'No unread messages'}
            />
          </View>
        </View>

        {/* Row 2 — 4-Scope Switcher */}
        <View style={styles.row2}>
          <FourScopeSwitcher
            activeScope={activeScope}
            onScopeChange={onScopeChange}
            onPickerOpen={onPickerOpen}
            labels={scopeLabels}
          />
        </View>
      </Animated.View>

      {/* ── ONLINE STRIP (Row 3) — stays pinned on scroll ────────────────────── */}
      <Animated.View
        style={[
          styles.onlineLayer,
          {
            top: insets.top + HDR.ROW1_H + HDR.ROW2_H,
            transform: [{ translateY: onlineTranslateY }],
          },
        ]}
      >
        <View style={styles.row3} accessibilityLiveRegion="polite">
          <View style={styles.row3Left}>
            <HeatPulseDot size={8} score={heatScore} />
            <Text style={styles.onlineText} numberOfLines={1} allowFontScaling={false}>
              {formatOnlineCount(onlineCount)}{' '}
              <Text style={styles.scopeNameText}>{scopePhrase}</Text>
            </Text>
          </View>

          <View style={styles.row3Right}>
            {showHeat ? (
              <View style={styles.heatPill}>
                <Text style={styles.heatText} allowFontScaling={false}>
                  🔥 Heat {heatScore}
                </Text>
              </View>
            ) : null}

            {showTrustAnchor ? (
              <View style={styles.trustPill}>
                <Text style={styles.trustText} allowFontScaling={false}>
                  📍 120K+
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
  },

  safeCap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.surface,
    zIndex: 3,
  },

  // Collapsible top block — opaque so chat never shows behind the brand/switcher
  collapsible: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.bg.surface,
    zIndex: 1,
  },

  // Online strip — pinned bar, carries the header's bottom border + lift
  onlineLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HDR.ROW3_H,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: palette.ink[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 2,
  },

  // ── ROW 1 ─────────────────────────────────────────────────────────────────
  row1: {
    height: HDR.ROW1_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HDR.PAD_H,
  },

  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Brand gold (#D4A017) — matches the gold message bubbles. Logo type.
  wordmark: {
    fontFamily: FONT_BODY.bold, // Inter_700Bold — the loaded weight
    fontSize: HDR.WORDMARK_SIZE,
    color: colors.fg.brand,
    letterSpacing: HDR.WORDMARK_TRACKING,
    lineHeight: 28,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  actionButton: {
    width: HDR.ACTION_TOUCH,
    height: HDR.ACTION_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  iconCircle: {
    width: HDR.ACTION_CIRCLE,
    height: HDR.ACTION_CIRCLE,
    borderRadius: HDR.ACTION_CIRCLE / 2,
    backgroundColor: colors.bg.goldSoft, // gold[50]
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: palette.gold[100],
  },

  actionBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.fg.error,
    borderWidth: 1.5,
    borderColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  actionBadgeWide: { minWidth: 20 },
  badgeText: {
    fontFamily: FONT_BODY.bold,
    fontSize: 9,
    color: palette.white,
    lineHeight: 11,
  },

  // ── ROW 2 ─────────────────────────────────────────────────────────────────
  row2: {
    height: HDR.ROW2_H,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },

  // ── ROW 3 ─────────────────────────────────────────────────────────────────
  row3: {
    height: HDR.ROW3_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HDR.PAD_H,
  },
  row3Left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  onlineText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: 12,
    color: colors.fg.secondary,
    lineHeight: 16,
  },
  scopeNameText: {
    fontFamily: FONT_BODY.regular,
    color: colors.fg.tertiary,
  },
  row3Right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatText: {
    fontFamily: FONT_BODY.bold,
    fontSize: 12,
    color: colors.fg.warning,
    lineHeight: 16,
  },
  trustPill: {
    backgroundColor: colors.bg.goldSoft,
    borderRadius: radii.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trustText: {
    fontFamily: FONT_BODY.medium,
    fontSize: 11,
    color: colors.fg.brandText,
    lineHeight: 15,
  },
});

export default HomeHeader;

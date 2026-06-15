/**
 * CROWN — Home Header (organism)  ·  components/organisms/HomeHeader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 3 rows (120px + safe area), hides as one block on scroll-down.
 *   Row 1 (48) — gold crown glyph + "CROWN" wordmark · 🔔 · 💬
 *   Row 2 (44) — 4-Scope switcher
 *   Row 3 (28) — live online strip (always names active geography)
 *
 * PREMIUM PASS:
 *   • Wordmark now uses Inter_700Bold (the ONLY loaded weight) — was
 *     Inter_800ExtraBold which is NOT in the font loader, so it silently
 *     fell back to a system font and looked off. Fixed → renders crisp.
 *   • Wordmark colour = gold[700] (#A88A24) — WCAG AA (5.0:1) on white.
 *     gold[600] is 3.8:1 and BANNED for text per colors.ts §15.
 *   • Right-side action icons no longer sit in flat grey circles (which
 *     clashed with the gold brand). They now live in soft-gold circles
 *     (gold[50]) with warm espresso icons → cohesive, branded, premium.
 *     Unread state flips the icon to brand gold for an at-a-glance cue.
 *   • Header gains a soft lift shadow.
 *
 * Public API unchanged — drop-in replacement.
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
  ROW1_H: 48 as const,
  ROW2_H: 44 as const,
  ROW3_H: 28 as const,
  TOTAL_H: 120 as const,

  WORDMARK_SIZE: 21 as const,
  WORDMARK_TRACKING: 2 as const,

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
  if (count >= 10_000_000) return `${(count / 10_000_000).toFixed(1)} Cr`;
  if (count >= 100_000) return `${(count / 100_000).toFixed(1)} Lakh`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString('en-IN');
}

function buildScopePhrase(scope: ChatScope, geoName: string): string {
  switch (scope) {
    case 'sector':
    case 'city':
    case 'country':
      return `${geoName} mein online`;
    case 'world':
      return 'duniya bhar mein online';
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
      <View style={styles.iconCircle}>
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

  const containerTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -(HDR.TOTAL_H + insets.top)],
        extrapolate: 'clamp',
      }),
    [insets.top],
  );

  useEffect(() => {
    if (composerFocused) showHeader();
  }, [composerFocused]);

  const geoName = (() => {
    switch (activeScope) {
      case 'world':
        return 'Duniya';
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
    <Animated.View
      style={[
        styles.headerContainer,
        { paddingTop: insets.top },
        { transform: [{ translateY: containerTranslateY }] },
      ]}
      pointerEvents="box-none"
    >
      {/* ── ROW 1 — Brand + Actions ───────────────────────────────────────── */}
      <View style={styles.row1} pointerEvents="box-none">
        {/* Crown glyph + wordmark */}
        <View style={styles.wordmarkRow} accessibilityRole="header" accessibilityLabel="CROWN">
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
            <Path
              d="M2 20h20"
              stroke={colors.fg.brand}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="m2 4 4 7 6-8 6 8 4-7-3 14H5z"
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

        {/* Action icons — NO avatar (§1.3.3) */}
        <View style={styles.actions}>
          <ActionIcon
            icon="bell"
            unread={unreadNotifications}
            onPress={onNotificationPress}
            a11yLabel="Notifications"
            a11yHint={
              unreadNotifications > 0
                ? `${unreadNotifications} unread notifications hain`
                : 'Koi notification nahi'
            }
          />
          <ActionIcon
            icon="message-circle"
            unread={unreadDms}
            onPress={onDmPress}
            a11yLabel="Direct Messages"
            a11yHint={unreadDms > 0 ? `${unreadDms} unread DMs hain` : 'Koi unread DM nahi'}
          />
        </View>
      </View>

      {/* ── ROW 2 — 4-Scope Switcher ──────────────────────────────────────── */}
      <View style={styles.row2}>
        <FourScopeSwitcher
          activeScope={activeScope}
          onScopeChange={onScopeChange}
          onPickerOpen={onPickerOpen}
          labels={scopeLabels}
        />
      </View>

      {/* ── ROW 3 — Online strip ──────────────────────────────────────────── */}
      <View style={styles.row3} accessibilityLiveRegion="polite">
        <View style={styles.row3Left}>
          <HeatPulseDot size={8} score={heatScore} />
          <Text style={styles.onlineText} numberOfLines={1} allowFontScaling={false}>
            {formatOnlineCount(onlineCount)} <Text style={styles.scopeNameText}>{scopePhrase}</Text>
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
                📍 1.2 Lakh+
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    // Soft premium lift
    shadowColor: palette.ink[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
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
    gap: 7,
  },

  wordmark: {
    fontFamily: FONT_BODY.bold, // Inter_700Bold — the loaded weight
    fontSize: HDR.WORDMARK_SIZE,
    color: colors.fg.brandText, // gold[700] — AA on white
    letterSpacing: HDR.WORDMARK_TRACKING,
    lineHeight: 26,
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

  // Soft-gold circle ties the icons into the brand (was flat grey)
  iconCircle: {
    width: HDR.ACTION_CIRCLE,
    height: HDR.ACTION_CIRCLE,
    borderRadius: HDR.ACTION_CIRCLE / 2,
    backgroundColor: colors.bg.goldSoft, // gold[50]
    alignItems: 'center',
    justifyContent: 'center',
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

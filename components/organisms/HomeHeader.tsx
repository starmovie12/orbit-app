/**
 * components/organisms/HomeHeader.tsx
 * CROWN — Home Header (organism) · premium Plaza ⇄ Chat morph
 * ────────────────────────────────────────────────────────────────────────────
 * PLAZA (at bottom / newest): CROWN + home line · 4-scope tabs · Throne Banner ·
 *   City Pulse + Live toggle.
 * CHAT (scrolled into older): a compact WhatsApp-style header cross-fades in —
 *   ← back · city crest · Name ▾ · online · Heat · Live · ⋮.
 *
 * Driven by the module-level `headerScrollAnim` singleton (0 = Plaza, 1 = Chat),
 * shared with CrownBottomNav; index.tsx calls hideHeader()/showHeader() on scroll.
 * The Plaza block is measured (onLayout) so the slide distance always fits.
 *
 * Logic reused from the repo: FourScopeSwitcher, HeatPulseDot, ThroneBanner,
 * the scroll singleton, semantic tokens. All chrome copy is ENGLISH.
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, palette, radii, spacing } from '@/constants/colors';
import { FONT_BODY, FONT_HEADING, FONT_NUMERIC } from '@/constants/typography';
import { FourScopeSwitcher, type ChatScope } from '@/components/molecules/FourScopeSwitcher';
import HeatPulseDot from '@/components/atoms/HeatPulseDot';
import ThroneBanner, {
  type ThroneHolder,
  type ThroneCycle,
} from '@/components/organisms/ThroneBanner';

// ─────────────────────────────────────────────────────────────────────────────
// Scroll animation singleton (0 = Plaza visible · 1 = collapsed to Chat)
//   API preserved so CrownBottomNav + index.tsx coordination is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export const headerScrollAnim = new Animated.Value(0);

const HIDE_DURATION = 220;
const SHOW_TENSION = 160;
const SHOW_FRICTION = 20;

export function hideHeader(): void {
  Animated.timing(headerScrollAnim, {
    toValue: 1,
    duration: HIDE_DURATION,
    useNativeDriver: true,
  }).start();
}

export function showHeader(): void {
  Animated.spring(headerScrollAnim, {
    toValue: 0,
    tension: SHOW_TENSION,
    friction: SHOW_FRICTION,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────

const ROW1_H = 64; // brand + home line (Plaza)
const TABS_H = 48;
const PULSE_H = 56;
const COMPACT_H = 56; // chat-mode header
const PAD_H = spacing.base; // 16
const BADGE_MAX = 99;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Full count with Indian grouping, e.g. 240118 → "2,40,118". */
function formatCount(n: number): string {
  try {
    return n.toLocaleString('en-IN');
  } catch {
    return String(n);
  }
}

function badgeLabel(n: number): string {
  return n > BADGE_MAX ? `${BADGE_MAX}+` : String(n);
}

function buildHomeLine(scope: ChatScope, l: ScopeLabels): string {
  switch (scope) {
    case 'world':
      return 'Worldwide';
    case 'country':
      return l.country;
    case 'city':
      return `${l.city} · ${l.country}`;
    case 'sector':
      return `${l.sector} · ${l.city} · ${l.country}`;
  }
}

function activeGeoLabel(scope: ChatScope, l: ScopeLabels): string {
  switch (scope) {
    case 'world':
      return 'World';
    case 'country':
      return l.country;
    case 'city':
      return l.city;
    case 'sector':
      return l.sector;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────────────────────────

function CrownCrest({ size = 18, color = colors.fg.celebrate }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m2 4 4 7 6-8 6 8 4-7-3 14H5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 20h20" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface ActionIconProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  unread: number;
  onPress: () => void;
  a11yLabel: string;
}

function ActionIcon({ icon, unread, onPress, a11yLabel }: ActionIconProps) {
  const hasUnread = unread > 0;
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, hasUnread && styles.iconCircleActive]}>
        <Feather name={icon} size={19} color={hasUnread ? colors.fg.brand : colors.fg.secondary} />
      </View>
      {hasUnread ? (
        <View style={[styles.badge, unread > 9 && styles.badgeWide]} accessibilityElementsHidden>
          <Text style={styles.badgeText} allowFontScaling={false}>
            {badgeLabel(unread)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Live ⇄ Top 30 pill — opens the Live popup; parent owns viewMode. */
function LiveToggle({ viewMode, onPress }: { viewMode: 'live' | 'top30'; onPress: () => void }) {
  const live = viewMode === 'live';
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={live ? 'View mode: Live. Tap to change.' : 'View mode: Top 30. Tap to change.'}
      style={({ pressed }) => [styles.liveToggle, live && styles.liveToggleOn, pressed && styles.pressed]}
    >
      <View style={[styles.liveDot, { backgroundColor: live ? colors.fg.warning : colors.fg.tertiary }]} />
      <Text style={[styles.liveLabel, live && styles.liveLabelOn]} allowFontScaling={false}>
        {live ? 'Live' : 'Top 30'}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ScopeLabels {
  readonly country: string;
  readonly city: string;
  readonly sector: string;
  readonly countryEmoji: string;
}

export interface HomeHeaderProps {
  // scope
  readonly activeScope: ChatScope;
  readonly scopeLabels: ScopeLabels;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen: (scope: ChatScope) => void;

  // live room stats
  readonly onlineCount: number;
  readonly heatScore: number;

  // header-right actions
  readonly onNotificationPress: () => void;
  readonly onDmPress: () => void;
  readonly unreadNotifications: number;
  readonly unreadDms: number;
  readonly composerFocused: boolean;

  // throne
  readonly throneHolder: ThroneHolder | null;
  readonly throneCycle?: ThroneCycle | null;
  readonly nextBattleLabel?: string | null;
  readonly onPressHolder?: () => void;
  readonly onPressPin?: () => void;
  readonly onPressClimb?: () => void;

  // live view mode
  readonly viewMode: 'live' | 'top30';
  readonly onToggleLive: () => void;

  // chat-mode header actions
  readonly onOpenCityInfo: () => void;
  readonly onOpenOverflow: () => void;
  readonly onBack?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
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
  unreadNotifications,
  unreadDms,
  composerFocused,
  throneHolder,
  throneCycle,
  nextBattleLabel,
  onPressHolder,
  onPressPin,
  onPressClimb,
  viewMode,
  onToggleLive,
  onOpenCityInfo,
  onOpenOverflow,
  onBack,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  // Measured height of the Plaza chrome (so the slide distance always fits).
  const [plazaH, setPlazaH] = useState(ROW1_H + TABS_H + 200 + PULSE_H);
  const onPlazaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && Math.abs(h - plazaH) > 1) setPlazaH(h);
  }, [plazaH]);

  // Plaza chrome: slide up + fade out as we collapse.
  const plazaTranslateY = useMemo(
    () => headerScrollAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -plazaH], extrapolate: 'clamp' }),
    [plazaH],
  );
  const plazaOpacity = useMemo(
    () => headerScrollAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0], extrapolate: 'clamp' }),
    [],
  );

  // Compact chat header: cross-fade + small settle in.
  const compactOpacity = useMemo(
    () => headerScrollAnim.interpolate({ inputRange: [0.55, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    [],
  );
  const compactTranslateY = useMemo(
    () => headerScrollAnim.interpolate({ inputRange: [0.55, 1], outputRange: [-6, 0], extrapolate: 'clamp' }),
    [],
  );

  // Composer focus → snap header back to Plaza.
  useEffect(() => {
    if (composerFocused) showHeader();
  }, [composerFocused]);

  const tier = activeScope.toUpperCase() as Uppercase<ChatScope>;
  const geo = activeGeoLabel(activeScope, scopeLabels);
  const homeLine = buildHomeLine(activeScope, scopeLabels);
  const countStr = formatCount(onlineCount);

  const handleHomeLine = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPickerOpen(activeScope);
  }, [onPickerOpen, activeScope]);

  return (
    <View style={[styles.root, { height: insets.top + plazaH }]} pointerEvents="box-none">
      {/* opaque notch fill */}
      {insets.top > 0 ? <View style={[styles.safeCap, { height: insets.top }]} /> : null}

      {/* ════ PLAZA CHROME ════ */}
      <Animated.View
        onLayout={onPlazaLayout}
        style={[styles.plaza, { top: insets.top, transform: [{ translateY: plazaTranslateY }], opacity: plazaOpacity }]}
        pointerEvents="box-none"
      >
        {/* Row 1 — brand + home line + bell + DM */}
        <View style={styles.row1} pointerEvents="box-none">
          <Pressable
            onPress={handleHomeLine}
            accessibilityRole="button"
            accessibilityLabel={`CROWN. Your location ${homeLine}. Tap to change.`}
            style={({ pressed }) => [styles.brandBlock, pressed && styles.pressed]}
          >
            <CrownCrest size={22} color={colors.fg.brand} />
            <View style={styles.brandText}>
              <Text style={styles.wordmark} allowFontScaling={false}>
                CROWN
              </Text>
              <View style={styles.homeLineRow}>
                <Text style={styles.homeLine} numberOfLines={1} allowFontScaling={false}>
                  {homeLine}
                </Text>
                <Feather name="chevron-down" size={12} color={colors.fg.secondary} />
              </View>
            </View>
          </Pressable>

          <View style={styles.actions}>
            <ActionIcon icon="bell" unread={unreadNotifications} onPress={onNotificationPress} a11yLabel="Notifications" />
            <ActionIcon icon="message-circle" unread={unreadDms} onPress={onDmPress} a11yLabel="Direct Messages" />
          </View>
        </View>

        {/* Row 2 — 4-scope switcher */}
        <View style={styles.tabs}>
          <FourScopeSwitcher activeScope={activeScope} onScopeChange={onScopeChange} onPickerOpen={onPickerOpen} labels={scopeLabels} />
        </View>

        {/* Throne Banner — the luxury centerpiece */}
        <View style={styles.bannerWrap}>
          <ThroneBanner
            tier={tier}
            scopeLabel={geo}
            holder={throneHolder}
            cycle={throneCycle ?? null}
            nextBattleLabel={nextBattleLabel ?? null}
            onPressHolder={onPressHolder}
            onPressPin={onPressPin}
            onPressClimb={onPressClimb}
          />
        </View>

        {/* City Pulse + Live toggle */}
        <View style={styles.pulseRow}>
          <View style={styles.pulseChip} accessibilityLiveRegion="polite">
            <HeatPulseDot size={8} score={heatScore} />
            <Text style={styles.pulseText} numberOfLines={1} allowFontScaling={false}>
              <Text style={styles.pulseNum}>{countStr}</Text>
              {` ${geo} online · 🔥 Heat `}
              <Text style={styles.pulseNum}>{String(heatScore)}</Text>
            </Text>
          </View>
          <LiveToggle viewMode={viewMode} onPress={onToggleLive} />
        </View>
      </Animated.View>

      {/* ════ COMPACT CHAT HEADER (cross-fades in) ════ */}
      <Animated.View
        style={[styles.compact, { top: insets.top, opacity: compactOpacity, transform: [{ translateY: compactTranslateY }] }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to latest"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Feather name="chevron-down" size={22} color={colors.fg.primary} />
        </TouchableOpacity>

        <View style={styles.compactCrest}>
          <CrownCrest size={18} color={colors.fg.celebrate} />
        </View>

        <Pressable
          onPress={onOpenCityInfo}
          style={({ pressed }) => [styles.compactTitleBlock, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${geo} info`}
        >
          <View style={styles.compactTitleRow}>
            <Text style={styles.compactTitle} numberOfLines={1} allowFontScaling={false}>
              {geo}
            </Text>
            <Feather name="chevron-down" size={14} color={colors.fg.secondary} />
          </View>
          <Text style={styles.compactSub} numberOfLines={1} allowFontScaling={false}>
            <Text style={styles.compactSubNum}>{countStr}</Text>
            {` online · 🔥 Heat `}
            <Text style={styles.compactSubNum}>{String(heatScore)}</Text>
          </Text>
        </Pressable>

        <LiveToggle viewMode={viewMode} onPress={onToggleLive} />

        <TouchableOpacity
          onPress={onOpenOverflow}
          style={styles.overflowBtn}
          accessibilityRole="button"
          accessibilityLabel="Chat options"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Feather name="more-vertical" size={22} color={colors.fg.primary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default HomeHeader;

// ─────────────────────────────────────────────────────────────────────────────
// Styles (tokens only)
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

  // ── Plaza chrome ──
  plaza: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.bg.surface,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    zIndex: 1,
  },

  // Row 1
  row1: {
    height: ROW1_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_H,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.sm,
  },
  brandText: {
    flexShrink: 1,
  },
  wordmark: {
    fontFamily: FONT_HEADING.bold, // Syne 800
    fontSize: 18,
    letterSpacing: -0.4,
    color: colors.fg.brandSubtle, // #8B6F18 — WCAG-safe gold wordmark
    lineHeight: 22,
  },
  homeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  homeLine: {
    flexShrink: 1,
    fontFamily: FONT_BODY.medium,
    fontSize: 12,
    color: colors.fg.secondary,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: { backgroundColor: palette.gold[100] },
  badge: {
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
  badgeWide: { minWidth: 20 },
  badgeText: {
    fontFamily: FONT_BODY.bold,
    fontSize: 9,
    color: palette.white,
    lineHeight: 11,
  },

  // Row 2 tabs
  tabs: {
    height: TABS_H,
    paddingHorizontal: 10,
  },

  // Throne
  bannerWrap: {
    marginTop: spacing.sm,
  },

  // Pulse
  pulseRow: {
    height: PULSE_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_H,
    gap: spacing.sm,
  },
  pulseChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    // tier1 gold micro-shadow
    shadowColor: colors.fg.brand,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  pulseText: {
    flexShrink: 1,
    fontFamily: FONT_BODY.semiBold,
    fontSize: 12,
    color: colors.fg.secondary,
    lineHeight: 16,
  },
  pulseNum: {
    fontFamily: FONT_NUMERIC.bold, // Space Mono
    color: colors.fg.primary,
  },

  // Live toggle
  liveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
  },
  liveToggleOn: {
    backgroundColor: palette.gold[100],
    borderColor: colors.border.cardEmphasis,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveLabel: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: 12,
    color: colors.fg.secondary,
  },
  liveLabelOn: {
    color: colors.fg.brandText,
  },

  // ── Compact chat header ──
  compact: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: COMPACT_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    zIndex: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCrest: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.goldSoft,
  },
  compactTitleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  compactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactTitle: {
    flexShrink: 1,
    fontFamily: FONT_BODY.bold,
    fontSize: 16,
    color: colors.fg.primary,
    lineHeight: 20,
  },
  compactSub: {
    fontFamily: FONT_BODY.regular,
    fontSize: 11,
    color: colors.fg.secondary,
    lineHeight: 14,
  },
  compactSubNum: {
    fontFamily: FONT_NUMERIC.regular,
    color: colors.fg.secondary,
  },
  overflowBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    opacity: 0.85,
  },
});

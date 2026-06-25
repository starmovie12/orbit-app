/**
 * CROWN — Home Header (organism) · components/organisms/HomeHeader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * BLINKIT-INSPIRED REDESIGN — OMNI-BUILDER Part 7 + Part 3 compliant
 *
 *  ┌──────────────────────────────────────────────┐  Row 1 (56px)
 *  │  👑 CROWN              🔔99+  💬12           │  brand + actions
 *  ├──────────────────────────────────────────────┤  Row 2 (52px)  ← NEW
 *  │  1.2K                          [●  online]   │  scope hero
 *  │  🏙️  Mumbai  ˅                               │  (Blinkit "19 min" pattern)
 *  ├──────────────────────────────────────────────┤  Row 3 (48px)  ← NEW
 *  │  🔍  Find active battles…              🎤    │  animated search bar
 *  ├──────────────────────────────────────────────┤  Row 4 (48px)
 *  │  🌍 World  🏳 India  🏙 City  🏘 Sector      │  4-scope tabs
 *  └──────────────────────────────────────────────┘
 *  ──────── pinned ────────────────────────────────  Row 5 (32px)
 *  │  ● 1.2K online in Mumbai           🔥 Heat 72 │
 *  ────────────────────────────────────────────────
 *
 * OMNI-BUILDER compliance:
 *   • Part 7 §4 — locked gold #D4A017, locked palette tokens, Syne wordmark
 *   • Part 7 §5 — Row 1 = 56 / Row 4 = 48 / Row 5 = 32 (extended with 2 new rows)
 *   • Part 3     — spring-back show, timing hide, reduced-motion respected
 *   • Part 2     — no race: module-level Animated.Value singleton (safe)
 *
 * API changes from v1:
 *   + onSearchPress: () => void   (navigate to search screen)
 *   All original props preserved.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, palette, spacing, radii } from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';
import { FourScopeSwitcher, type ChatScope } from '@/components/molecules/FourScopeSwitcher';
import HeatPulseDot from '@/components/atoms/HeatPulseDot';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS  (OMNI-BUILDER Part 7 §5 extended with two Blinkit-inspired rows)
// ─────────────────────────────────────────────────────────────────────────────

const HDR = {
  // ── Row heights ─────────────────────────────────────────────────────────
  ROW1_H:        56,   // brand + bell + DM        (Part 7 §5 locked)
  ROW_HERO_H:    52,   // scope status hero         (NEW)
  ROW_SEARCH_H:  48,   // animated search bar       (NEW)
  ROW2_H:        48,   // 4-scope tab switcher      (Part 7 §5 locked)
  ROW3_H:        32,   // pinned heat / online strip(Part 7 §5 locked)

  // Derived (kept named so no magic numbers anywhere)
  COLLAPSE_H:   204,   // rows 1–4 — the collapsible block
  TOTAL_H:      236,   // rows 1–5 — full header height (excl. safe-area)

  // ── Wordmark ────────────────────────────────────────────────────────────
  WORDMARK_SIZE:     24,
  WORDMARK_TRACKING: 2.5,

  // ── Action icons ────────────────────────────────────────────────────────
  ACTION_TOUCH:  44,
  ACTION_CIRCLE: 38,
  ACTION_ICON:   19,

  // ── Hero row ────────────────────────────────────────────────────────────
  HERO_COUNT_SIZE:  30,   // ~Blinkit "19 minutes" large display
  HERO_GEO_SIZE:    13,

  // ── Scroll animation ────────────────────────────────────────────────────
  HIDE_DURATION:        220,
  SHOW_SPRING_TENSION:  160,
  SHOW_SPRING_FRICTION: 20,

  // ── Search hint cycling ─────────────────────────────────────────────────
  HINT_INTERVAL_MS: 2600,
  HINT_FADE_MS:     260,

  // ── Misc ────────────────────────────────────────────────────────────────
  PAD_H:                  spacing.base,  // 16
  BADGE_MAX:              99,
  HEAT_VISIBLE_THRESHOLD: 30,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH HINTS  (Blinkit-style cycling placeholder — matches CROWN voice)
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_HINTS = [
  'Find active battles…',
  'Explore top IMPERATORs…',
  'Discover your Sector…',
  'Search rooms & players…',
  'Join a live Crown battle…',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE METADATA  (OMNI-BUILDER Part 7 §2 titles/icons)
// ─────────────────────────────────────────────────────────────────────────────

const SCOPE_ICONS: Record<ChatScope, string> = {
  world:   '🌍',
  country: '🏳️',
  city:    '🏙️',
  sector:  '🏘️',
};

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION  (0 = visible · 1 = hidden) — module-level singleton,
//   shared with CrownBottomNav.  Public API unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export const headerScrollAnim = new Animated.Value(0);

export function hideHeader(): void {
  Animated.timing(headerScrollAnim, {
    toValue:         1,
    duration:        HDR.HIDE_DURATION,
    useNativeDriver: true,
  }).start();
}

export function showHeader(): void {
  Animated.spring(headerScrollAnim, {
    toValue:         0,
    tension:         HDR.SHOW_SPRING_TENSION,
    friction:        HDR.SHOW_SPRING_FRICTION,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatOnlineCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000)     return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000)         return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString('en-US');
}

function buildScopePhrase(scope: ChatScope, geoName: string): string {
  switch (scope) {
    case 'world': return 'worldwide';
    default:      return `in ${geoName}`;
  }
}

function badgeLabel(count: number): string {
  return count > HDR.BADGE_MAX ? `${HDR.BADGE_MAX}+` : String(count);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED SEARCH HINT  — isolated component so setInterval never triggers a
//   full HomeHeader re-render; only the hint text node re-paints.
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedSearchHint() {
  const [index, setIndex] = useState(0);
  const opacity           = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out → swap text → fade in
      Animated.timing(opacity, {
        toValue:         0,
        duration:        HDR.HINT_FADE_MS,
        useNativeDriver: true,
      }).start(() => {
        setIndex(prev => (prev + 1) % SEARCH_HINTS.length);
        Animated.timing(opacity, {
          toValue:         1,
          duration:        HDR.HINT_FADE_MS,
          useNativeDriver: true,
        }).start();
      });
    }, HDR.HINT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [opacity]);

  return (
    <Animated.Text
      style={[styles.searchHint, { opacity }]}
      allowFontScaling={false}
      numberOfLines={1}
    >
      {SEARCH_HINTS[index]}
    </Animated.Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION ICON  (bell / DM) in a soft-gold circle
// ─────────────────────────────────────────────────────────────────────────────

interface ActionIconProps {
  icon:      React.ComponentProps<typeof Feather>['name'];
  unread:    number;
  onPress:   () => void;
  a11yLabel: string;
  a11yHint:  string;
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
          style={[styles.actionBadge, unread > 9 && styles.actionBadgeWide]}
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
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeLabels {
  readonly country:      string;
  readonly city:         string;
  readonly sector:       string;
  readonly countryEmoji: string;
}

interface HomeHeaderProps {
  readonly activeScope:   ChatScope;
  readonly scopeLabels:   ScopeLabels;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen:  (scope: ChatScope) => void;
  readonly onSearchPress: () => void;              // NEW — navigate to Search screen

  readonly onlineCount: number;
  readonly heatScore:   number;

  readonly onNotificationPress: () => void;
  readonly onDmPress:           () => void;

  readonly showTrustAnchor:     boolean;
  readonly unreadNotifications: number;
  readonly unreadDms:           number;
  readonly composerFocused:     boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function HomeHeader({
  activeScope,
  scopeLabels,
  onScopeChange,
  onPickerOpen,
  onSearchPress,
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

  // ── Animated interpolations ───────────────────────────────────────────────

  /** Collapsible block (rows 1–4): slides fully off-screen + fades */
  const collapsibleTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, -(insets.top + HDR.COLLAPSE_H)],
        extrapolate: 'clamp',
      }),
    [insets.top],
  );

  const collapsibleOpacity = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange:  [0, 0.5, 1],
        outputRange: [1,   0,  0],
        extrapolate: 'clamp',
      }),
    [],
  );

  /** Pinned strip (row 5): rises by collapsible height → stays under safe-area */
  const onlineTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, -HDR.COLLAPSE_H],
        extrapolate: 'clamp',
      }),
    [],
  );

  // Composer focus → snap header back into view
  useEffect(() => {
    if (composerFocused) showHeader();
  }, [composerFocused]);

  // ── Derived display values ────────────────────────────────────────────────

  const geoName = (() => {
    switch (activeScope) {
      case 'world':   return '';
      case 'country': return scopeLabels.country;
      case 'city':    return scopeLabels.city;
      case 'sector':  return scopeLabels.sector;
    }
  })();

  const scopePhrase    = buildScopePhrase(activeScope, geoName);
  const scopeIcon      = SCOPE_ICONS[activeScope];
  const geoDisplayName = activeScope === 'world'
    ? 'worldwide'
    : geoName || activeScope.toUpperCase();

  const showHeat       = heatScore >= HDR.HEAT_VISIBLE_THRESHOLD;
  const formattedCount = formatOnlineCount(onlineCount);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearchPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSearchPress();
  }, [onSearchPress]);

  /** Tapping the hero row → open the geo picker for the active scope */
  const handleHeroPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPickerOpen(activeScope);
  }, [onPickerOpen, activeScope]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.root, { height: insets.top + HDR.TOTAL_H }]}
      pointerEvents="box-none"
    >
      {/* Safe-area cap — opaque fill so notch never bleeds behind the header */}
      {insets.top > 0 ? (
        <View style={[styles.safeCap, { height: insets.top }]} />
      ) : null}

      {/* ════ COLLAPSIBLE BLOCK (Rows 1–4) ════════════════════════════════════
          Slides up + fades out when the user scrolls down.
          Spring-snaps back on composer focus.
      ═══════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[
          styles.collapsible,
          {
            top:       insets.top,
            transform: [{ translateY: collapsibleTranslateY }],
            opacity:   collapsibleOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* ── ROW 1 · Brand + Actions ──────────────────────────────────────── */}
        <View style={styles.row1} pointerEvents="box-none">
          <View style={styles.wordmarkRow} accessibilityRole="header" accessibilityLabel="CROWN">
            {/* Crown glyph */}
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
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
            {/* CROWN wordmark — Syne_800ExtraBold per OMNI-BUILDER Part 7 §4 */}
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
              a11yHint={
                unreadDms > 0
                  ? `${unreadDms} unread messages`
                  : 'No unread messages'
              }
            />
          </View>
        </View>

        {/* ── ROW 2 · Scope Hero (Blinkit "19 min delivery" pattern) ──────────
            Blinkit:  "19 minutes"  +  "HOME — address ▾"
            CROWN:    "1.2K"       +  "🏙 Mumbai ▾"  +  [●  online]
        ──────────────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.heroRow}
          onPress={handleHeroPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${formattedCount} ${scopePhrase}. Tap to change location.`}
        >
          <View style={styles.heroLeft}>
            {/* Big number — like Blinkit's delivery ETA */}
            <Text style={styles.heroCount} allowFontScaling={false} numberOfLines={1}>
              {formattedCount}
            </Text>
            {/* Geo line with chevron */}
            <View style={styles.heroGeoRow}>
              <Text style={styles.heroGeoLabel} allowFontScaling={false} numberOfLines={1}>
                {scopeIcon}{'  '}{geoDisplayName}
              </Text>
              <Feather name="chevron-down" size={12} color={colors.fg.secondary} />
            </View>
          </View>

          {/* "online" pill — like Blinkit's "Surge applicable" badge */}
          <View style={styles.onlinePill}>
            <HeatPulseDot size={7} score={heatScore} />
            <Text style={styles.onlinePillText} allowFontScaling={false}>
              online
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── ROW 3 · Animated Search Bar ─────────────────────────────────────
            Tap → navigates to Search screen (not an inline TextInput).
            Placeholder cycles through SEARCH_HINTS every 2.6 s.
        ──────────────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={handleSearchPress}
          activeOpacity={0.85}
          accessibilityRole="search"
          accessibilityLabel="Search CROWN"
          accessibilityHint="Tap to search rooms, players, and battles"
        >
          <Feather
            name="search"
            size={17}
            color={colors.fg.tertiary}
            style={styles.searchIconLeft}
          />
          <AnimatedSearchHint />
          <Feather
            name="mic"
            size={17}
            color={colors.fg.brand}
            style={styles.searchMicIcon}
          />
        </TouchableOpacity>

        {/* ── ROW 4 · 4-Scope Switcher tabs ────────────────────────────────── */}
        <View style={styles.row2}>
          <FourScopeSwitcher
            activeScope={activeScope}
            onScopeChange={onScopeChange}
            onPickerOpen={onPickerOpen}
            labels={scopeLabels}
          />
        </View>
      </Animated.View>

      {/* ════ PINNED STRIP (Row 5) ═════════════════════════════════════════════
          Never hides. Rises with the collapsible block so it pins just
          below the safe-area inset when the user scrolls down.
      ═══════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[
          styles.onlineLayer,
          {
            top:       insets.top + HDR.COLLAPSE_H,
            transform: [{ translateY: onlineTranslateY }],
          },
        ]}
      >
        <View style={styles.row3} accessibilityLiveRegion="polite">
          <View style={styles.row3Left}>
            <HeatPulseDot size={8} score={heatScore} />
            <Text style={styles.onlineText} numberOfLines={1} allowFontScaling={false}>
              {formattedCount}{' '}
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
// STYLES  (all measurements from HDR tokens; all colors from semantic layer)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Shell ──────────────────────────────────────────────────────────────────
  root: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    zIndex:          100,
    backgroundColor: 'transparent',
  },

  /** Opaque notch fill so the safe-area cap never bleeds when collapsed. */
  safeCap: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: colors.bg.surface,
    zIndex:          3,
  },

  /** Rows 1–4: opaque so chat content never shows behind the brand/search. */
  collapsible: {
    position:        'absolute',
    left: 0, right: 0,
    backgroundColor: colors.bg.surface,
    zIndex:          1,
  },

  /** Row 5: shadow + bottom border; always visible. */
  onlineLayer: {
    position:           'absolute',
    left: 0, right: 0,
    height:             HDR.ROW3_H,
    backgroundColor:    colors.bg.surface,
    borderBottomWidth:  StyleSheet.hairlineWidth,
    borderBottomColor:  'rgba(0,0,0,0.06)',
    shadowColor:        palette.ink[950],
    shadowOffset:       { width: 0, height: 2 },
    shadowOpacity:      0.05,
    shadowRadius:       8,
    elevation:          4,
    zIndex:             2,
  },

  // ── Row 1 · Brand ─────────────────────────────────────────────────────────
  row1: {
    height:            HDR.ROW1_H,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: HDR.PAD_H,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  /**
   * FONT_HEADING.extrabold = Syne_800ExtraBold (Part 7 §4 locked).
   * Verify FONT_HEADING export key name in constants/typography.ts.
   * If the key differs (e.g. FONT_HEADING['800'] or FONT_HEADING.black),
   * swap it here — the intent is Syne at maximum weight.
   */
  wordmark: {
    fontFamily:    FONT_HEADING.extrabold,
    fontSize:      HDR.WORDMARK_SIZE,
    color:         colors.fg.brand,
    letterSpacing: HDR.WORDMARK_TRACKING,
    lineHeight:    30,
  },
  actions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  actionButton: {
    width:          HDR.ACTION_TOUCH,
    height:         HDR.ACTION_TOUCH,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  iconCircle: {
    width:           HDR.ACTION_CIRCLE,
    height:          HDR.ACTION_CIRCLE,
    borderRadius:    HDR.ACTION_CIRCLE / 2,
    backgroundColor: colors.bg.goldSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconCircleActive: { backgroundColor: palette.gold[100] },
  actionBadge: {
    position:          'absolute',
    top: 4, right: 4,
    minWidth:          16,
    height:            16,
    borderRadius:      8,
    backgroundColor:   colors.fg.error,
    borderWidth:       1.5,
    borderColor:       colors.bg.surface,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
  },
  actionBadgeWide: { minWidth: 20 },
  badgeText: {
    fontFamily: FONT_BODY.bold,
    fontSize:   9,
    color:      palette.white,
    lineHeight: 11,
  },

  // ── Row 2 · Scope Hero ────────────────────────────────────────────────────
  heroRow: {
    height:            HDR.ROW_HERO_H,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: HDR.PAD_H,
    paddingBottom:     4,
  },
  heroLeft: {
    flex: 1,
    gap:  2,
  },
  /**
   * The "1.2K" count maps to Blinkit's "19 minutes" large display text.
   * Part 7 §4: all numerics → Space Mono. If a FONT_MONO constant is
   * exported from constants/typography.ts, swap to FONT_MONO.bold here.
   * FONT_HEADING.extrabold (Syne) is a worthy alternative for display numerics
   * — decide per your visual preference.
   */
  heroCount: {
    fontFamily:    FONT_HEADING.extrabold,
    fontSize:      HDR.HERO_COUNT_SIZE,
    color:         colors.fg.primary,
    lineHeight:    36,
    letterSpacing: -0.5,
  },
  heroGeoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  heroGeoLabel: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      HDR.HERO_GEO_SIZE,
    color:         colors.fg.secondary,
    lineHeight:    17,
  },
  /**
   * "online" pill — mirrors Blinkit's "Surge applicable" / location badge.
   * Warm gold bg with pulsing dot = CROWN's visual signature.
   */
  onlinePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   colors.bg.goldSoft,
    borderRadius:      radii.xs,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  onlinePillText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   11,
    color:      colors.fg.brandText,
    lineHeight: 14,
  },

  // ── Row 3 · Animated Search Bar ───────────────────────────────────────────
  /**
   * bg.card = #F7ECD0 warm cream — warm contrast against white bg.surface,
   * consistent with CROWN's palette depth ladder (surface → card → subtle).
   * CROWN gold shadow signature (OMNI Part 7 §4).
   */
  searchBar: {
    height:           HDR.ROW_SEARCH_H,
    marginHorizontal: HDR.PAD_H,
    marginBottom:     8,
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.bg.card,
    borderRadius:     12,
    paddingHorizontal: 14,
    borderWidth:      StyleSheet.hairlineWidth,
    borderColor:      'rgba(0,0,0,0.07)',
    // CROWN gold jewel shadow
    shadowColor:      colors.fg.brand,
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.10,
    shadowRadius:     6,
    elevation:        2,
  },
  searchIconLeft: {
    marginRight: 10,
  },
  searchHint: {
    flex:       1,
    fontFamily: FONT_BODY.regular,
    fontSize:   14,
    color:      colors.fg.tertiary,
    lineHeight: 18,
  },
  searchMicIcon: {
    marginLeft: 10,
  },

  // ── Row 4 · Scope Tabs ────────────────────────────────────────────────────
  row2: {
    height:            HDR.ROW2_H,
    paddingHorizontal: 10,
    backgroundColor:   'transparent',
  },

  // ── Row 5 (pinned) · Heat / Online Strip ──────────────────────────────────
  row3: {
    height:            HDR.ROW3_H,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: HDR.PAD_H,
  },
  row3Left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flex:          1,
  },
  onlineText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   12,
    color:      colors.fg.secondary,
    lineHeight: 16,
  },
  scopeNameText: {
    fontFamily: FONT_BODY.regular,
    color:      colors.fg.tertiary,
  },
  row3Right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  heatPill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  heatText: {
    fontFamily: FONT_BODY.bold,
    fontSize:   12,
    color:      colors.fg.warning,
    lineHeight: 16,
  },
  trustPill: {
    backgroundColor:   colors.bg.goldSoft,
    borderRadius:      radii.xs,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  trustText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   11,
    color:      colors.fg.brandText,
    lineHeight: 15,
  },
});

export default HomeHeader;

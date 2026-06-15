/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Three-Row Header (HOME tab)                                     ║
 * ║  §1.3.3 — Founder-Locked Architecture                                    ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  3 ROWS (total: 120px):                                                  ║
 * ║    Row 1 — Brand & Quick Actions (48px)   ← was 56px, −8px              ║
 * ║    Row 2 — 4-Scope Switcher     (44px)   ← was 48px, −4px              ║
 * ║    Row 3 — Online Count Strip   (28px)   ← was 32px, −4px              ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v5.0 — Premium Header Refresh:                               ║
 * ║    [1] Crown icon REMOVED from wordmark — text-only wordmark now        ║
 * ║        • Cleaner, more editorial — no icon competing with the type      ║
 * ║    [2] CROWN wordmark elevated to luxury-brand tier:                    ║
 * ║        • Font size 24px → 28px — stronger visual mass                  ║
 * ║        • Letter-spacing −1px → +4px — wide luxury tracking (CHANEL     ║
 * ║          style) reads as ultra-premium on display-weight Syne 800       ║
 * ║        • Subtle gold text-shadow glow (radius 8px, 25% opacity)        ║
 * ║    [3] Action icons upgraded — Ionicons → MaterialCommunityIcons:       ║
 * ║        • Notifications: "bell-ring" (unread) / "bell-outline" (none)   ║
 * ║          bell-ring has dynamic vibration strokes = alerts-in-progress  ║
 * ║        • DM: "message-text" (unread) / "message-text-outline" (none)   ║
 * ║          message-text has ruled lines inside bubble = DM content feel  ║
 * ║        • Active icon colour flips to brand gold (fg.brand) for         ║
 * ║          unmissable at-a-glance status communication                   ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v5.1 — Wordmark Hardcode Fix:                                ║
 * ║    [1] {BRAND.NAME} → literal "CROWN" string                            ║
 * ║        • Guarantees correct wordmark during/after branding migration    ║
 * ║        • Removed @/constants/branding import (now unused)              ║
 * ║        • Left-side gold font unchanged — Syne 800 28px +4px tracking   ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ROW 1 SPEC (v5.0):                                                      ║
 * ║    Left: "CROWN" wordmark only — Syne 800, 28px, gold, +4px tracking   ║
 * ║    Right: 🔔 bell-ring/bell-outline (44×44) + 💬 message-text (44×44)  ║
 * ║    Active icon colour = brand gold; inactive = fg.primary              ║
 * ║    NO AVATAR IN ROW 1 — avatar lives in Profile tab (§1.3.3 mandate)    ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ROW 3 SPEC (§1.3.3):                                                   ║
 * ║    Left:  🟡 Pulsing dot + live count + scope name                       ║
 * ║    Right: 🔥 Heat score (≥30) + Trust anchor "📍 1.2 Lakh+"             ║
 * ║    CRITICAL: Row 3 ALWAYS names the active geography.                    ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SCROLL BEHAVIOR:                                                         ║
 * ║    Full header (120px + safe-area) hides on scroll-down as ONE BLOCK     ║
 * ║    Reappears on scroll-up (280ms spring(160, 20))                         ║
 * ║    Exception: Row 2 NEVER hides when composer focused (keyboard open)     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg'; // Crown logo SVG
import { Feather } from '@expo/vector-icons'; // §design-rule: Feather-only (1.5px stroke, clean outline)
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, zIndex, dimensions } from '@/constants/colors';
import { FourScopeSwitcher, type ChatScope } from '@/components/molecules/FourScopeSwitcher';
import HeatPulseDot from '@/components/atoms/HeatPulseDot';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — all traces to §1.3.3 paragraph-level spec
// ─────────────────────────────────────────────────────────────────────────────

const HDR = {
  /**
   * [v5.4] Row 1: 48px — breathing room for wordmark + icon circles.
   */
  ROW1_H: 48 as const,

  /**
   * [v4.0 CHANGE] Row 2 compressed 48px → 44px.
   * Saves 4px. Matches FourScopeSwitcher v3.3 HEIGHT token.
   */
  ROW2_H: 44 as const,

  /**
   * [v4.0 CHANGE] Row 3 compressed 32px → 28px.
   * Saves 4px. Online strip still legible at 12px text.
   */
  ROW3_H: 28 as const,

  /**
   * [v5.4] Total: 48 + 44 + 28 = 120px. Safe-area added at runtime.
   */
  TOTAL_H: 120 as const,

  /**
   * [v5.6] Wordmark text 20px — matches HTML prototype spec (text-[20px]).
   */
  WORDMARK_SIZE: 20 as const,

  /**
   * [v5.6] Letter spacing 3px — matches HTML tracking-[0.15em] @ 20px font.
   * (0.15 × 20 = 3px). Gives the logo text breathing room next to SVG icon.
   */
  WORDMARK_LETTER_SPACING: 3 as const,

  /** §1.3.3 Row 1 action icons: "44×44 touch target" */
  ACTION_TOUCH: 44 as const,

  /**
   * [v5.4] Icon 24px → 18px — fits neatly inside the 36px circle background.
   * Feather at 18px is crisp; circle gives the visual mass.
   */
  ACTION_ICON: 18 as const,

  /** §1.3.3 Row 3 Heat: "visible when ≥ 30" */
  HEAT_VISIBLE_THRESHOLD: 30 as const,

  /** §1.3.3 Trust anchor: "auto-hides after 60s or first scroll" */
  TRUST_ANCHOR_VISIBLE_MS: 60_000 as const,

  /** §1.3.3 Scroll coordination: "hides on scroll-down (220ms easeInQuad)" */
  HIDE_DURATION: 220 as const,

  /** §1.3.3 Scroll coordination: "reappears on scroll-up (280ms spring(160, 20))" */
  SHOW_DURATION:        280 as const,
  SHOW_SPRING_TENSION:  160 as const,
  SHOW_SPRING_FRICTION: 20  as const,

  /** §1.3.3 Row 3 count update: "<200ms animated count-up" */
  COUNT_UPDATE_MS: 200 as const,

  /** Horizontal screen padding */
  PAD_H: spacing.base as const, // 16px

  /** Badge max count before "99+" label */
  BADGE_MAX: 99 as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — shared with CrownBottomNav
// headerScrollAnim: 0 = visible, 1 = hidden
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
    tension:         HDR.SHOW_SPRING_TENSION,  // 160
    friction:        HDR.SHOW_SPRING_FRICTION, // 20
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE COUNT — formatted with Indian number convention
// ─────────────────────────────────────────────────────────────────────────────

function formatOnlineCount(count: number): string {
  if (count >= 10_000_000) return `${(count / 10_000_000).toFixed(1)} Cr`;
  if (count >= 100_000)    return `${(count / 100_000).toFixed(1)} Lakh`;
  if (count >= 1_000)      return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE LABEL BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildScopePhrase(scope: ChatScope, geoName: string): string {
  switch (scope) {
    case 'sector':  return `${geoName} mein online`;
    case 'city':    return `${geoName} mein online`;
    case 'country': return `${geoName} mein online`;
    case 'world':   return 'duniya bhar mein online';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE COUNT LABEL
// ─────────────────────────────────────────────────────────────────────────────

function badgeLabel(count: number): string {
  return count > HDR.BADGE_MAX ? `${HDR.BADGE_MAX}+` : String(count);
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
  // ── Scope switcher state ─────────────────────────────────────────────────
  readonly activeScope:   ChatScope;
  readonly scopeLabels:   ScopeLabels;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen:  (scope: ChatScope) => void;

  // ── Online strip data ────────────────────────────────────────────────────
  readonly onlineCount:   number;
  readonly heatScore:     number;

  // ── Action handlers ──────────────────────────────────────────────────────
  readonly onNotificationPress: () => void;
  readonly onDmPress:           () => void;

  // ── Trust anchor visibility ───────────────────────────────────────────────
  readonly showTrustAnchor: boolean;

  // ── Notification / DM badges ─────────────────────────────────────────────
  readonly unreadNotifications: number;
  readonly unreadDms:           number;

  // ── Composer focused (Row 2 never hides when true) ─────────────────────
  readonly composerFocused: boolean;
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

  // ── containerTranslateY drives ALL THREE ROWS as one block ─────────────────
  const containerTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, -(HDR.TOTAL_H + insets.top)],
        extrapolate: 'clamp',
      }),
    [insets.top],
  );

  // ── composerFocused → always show header ─────────────────────────────────
  useEffect(() => {
    if (composerFocused) {
      showHeader();
    }
  }, [composerFocused]);

  // ── Active scope name for Row 3 ─────────────────────────────────────────
  const geoName = (() => {
    switch (activeScope) {
      case 'world':   return 'Duniya';
      case 'country': return scopeLabels.country;
      case 'city':    return scopeLabels.city;
      case 'sector':  return scopeLabels.sector;
    }
  })();

  const scopePhrase = buildScopePhrase(activeScope, geoName);
  const showHeat    = heatScore >= HDR.HEAT_VISIBLE_THRESHOLD;

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        { paddingTop: insets.top },
        { transform: [{ translateY: containerTranslateY }] },
      ]}
      pointerEvents="box-none"
    >

      {/* ── ROW 1: Brand + Actions (48px) ──────────────────────────────────── */}
      <View style={styles.row1} pointerEvents="box-none">

        {/* LEFT: Crown logo — SVG crown icon (gold) + CROWN text (dark) */}
        {/* Matches HTML prototype: icon #C5A059 stroke + dark extrabold text  */}
        <View
          style={styles.wordmarkRow}
          accessibilityRole="header"
          accessibilityLabel="Crown"
        >
          {/* Crown SVG icon — Lucide crown path, brand gold stroke */}
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
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

          {/* CROWN wordmark text — dark, extrabold, tracked */}
          <Text
            style={styles.wordmark}
            allowFontScaling={false}
          >
            CROWN
          </Text>
        </View>

        {/* RIGHT: Action icons (NO AVATAR — §1.3.3 mandate) */}
        <View style={styles.actions}>

          {/* 🔔 Notifications — [v5.0] MaterialCommunityIcons "bell-ring" */}
          {/* Reason: "bell-ring" has dynamic vibration arc strokes that visually
               communicate "active alert in progress" — far more expressive than
               a static bell. Gold colour when unread = instant status read. */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onNotificationPress();
            }}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            accessibilityHint={
              unreadNotifications > 0
                ? `${unreadNotifications} unread notifications hain`
                : 'Koi notification nahi'
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.iconBg}>
              <Feather
                name="bell"
                size={HDR.ACTION_ICON}
                color={colors.fg.brand}
              />
            </View>

            {unreadNotifications > 0 ? (
              <View
                style={[
                  styles.actionBadge,
                  unreadNotifications > 9 ? styles.actionBadgeWide : null,
                ]}
                accessibilityElementsHidden
              >
                <Text style={styles.badgeText} allowFontScaling={false}>
                  {badgeLabel(unreadNotifications)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* 💬 DM inbox — [v5.0] MaterialCommunityIcons "message-text" */}
          {/* Reason: "message-text" shows a chat bubble with ruled content lines
               inside — reads unmistakably as "messages with content waiting".
               Filled gold variant on unread = premium status signal. "message-text-outline"
               is the clean inactive state — minimal, architectural. */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDmPress();
            }}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Direct Messages"
            accessibilityHint={
              unreadDms > 0
                ? `${unreadDms} unread DMs hain`
                : 'Koi unread DM nahi'
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.iconBg}>
              <Feather
                name="message-square"
                size={HDR.ACTION_ICON}
                color={colors.fg.brand}
              />
            </View>

            {unreadDms > 0 ? (
              <View
                style={[
                  styles.actionBadge,
                  unreadDms > 9 ? styles.actionBadgeWide : null,
                ]}
                accessibilityElementsHidden
              >
                <Text style={styles.badgeText} allowFontScaling={false}>
                  {badgeLabel(unreadDms)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

        </View>
      </View>

      {/* ── ROW 2: 4-Scope Switcher (44px) ─────────────────────────────────── */}
      <View style={styles.row2}>
        <FourScopeSwitcher
          activeScope={activeScope}
          onScopeChange={onScopeChange}
          onPickerOpen={onPickerOpen}
          labels={scopeLabels}
        />
      </View>

      {/* ── ROW 3: Online Count Strip (28px) ────────────────────────────────── */}
      <View style={styles.row3} accessibilityLiveRegion="polite">

        {/* LEFT: Pulsing dot + count + scope name */}
        <View style={styles.row3Left}>
          <HeatPulseDot size={8} score={heatScore} />
          <Text
            style={styles.onlineText}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {formatOnlineCount(onlineCount)}{' '}
            <Text style={styles.scopeNameText}>{scopePhrase}</Text>
          </Text>
        </View>

        {/* RIGHT: Heat score + Trust anchor */}
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

  // ── Header wrapper ─────────────────────────────────────────────────────────
  headerContainer: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    zIndex:            100,
    backgroundColor:   colors.bg.surface,
    // Subtle separator — lifts header off content without hard line
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },

  // ── ROW 1 — 48px (v4.0: was 56px) ─────────────────────────────────────────
  row1: {
    height:            HDR.ROW1_H,             // 48px
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: HDR.PAD_H,              // 16px
  },

  // ── wordmarkRow — icon + text side by side ────────────────────────────────
  // gap-2 from HTML prototype = 8px in React Native
  wordmarkRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },

  // ── CROWN wordmark text ───────────────────────────────────────────────────
  // HTML spec: font-extrabold · text-[20px] · tracking-[0.15em] · text-gray-900
  // Icon is gold; text is dark — creates icon-color / text contrast like Telegram.
  wordmark: {
    fontFamily:    'Inter_800ExtraBold',        // extrabold = font-extrabold
    fontSize:      HDR.WORDMARK_SIZE,           // 20px
    letterSpacing: HDR.WORDMARK_LETTER_SPACING, // 3px (0.15em × 20)
    color:         colors.fg.primary,           // dark gray (#111827 equiv)
    lineHeight:    26,
  },

  // ── Right action group ────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },

  // ── Each action button — 44×44 touch target ───────────────────────────────
  actionButton: {
    width:          HDR.ACTION_TOUCH,           // 44px touch area
    height:         HDR.ACTION_TOUCH,           // 44px touch area
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  // ── Icon circle background — 36×36 behind each Feather icon ───────────────
  // Subtle dark-on-light scrim. Modern app pattern (Notion, Linear, Arc).
  // Background gives visual mass so the smaller 18px icon reads at a glance.
  iconBg: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)', // near-invisible on white
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Action badge — sits on top-right edge of the icon circle ─────────────
  actionBadge: {
    position:          'absolute',
    top:               3,
    right:             3,
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

  // ── Wider badge for two-digit counts (10–99+) ────────────────────────────
  actionBadgeWide: {
    minWidth: 20,
  },

  // ── Badge count text ──────────────────────────────────────────────────────
  badgeText: {
    fontSize:   9,
    fontWeight: '700',
    color:      '#FFFFFF',
    lineHeight: 11,
  },

  // ── ROW 2 — 44px (v4.0: was 48px) ─────────────────────────────────────────
  row2: {
    height:            HDR.ROW2_H,              // 44px
    paddingHorizontal: 10,                      // 10px left (World) + 10px right (Sector)
    backgroundColor:   'transparent',
  },

  // ── ROW 3 — 28px (v4.0: was 32px) ─────────────────────────────────────────
  row3: {
    height:            HDR.ROW3_H,              // 28px
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: HDR.PAD_H,              // 16px
  },

  // ── Row 3 left — dot + count + scope ─────────────────────────────────────
  row3Left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flex:          1,
  },

  // ── Online count text — §1.3.3 "12px Inter 600" ──────────────────────────
  onlineText: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.fg.secondary,
    lineHeight: 16,
  },

  // ── Scope name (slightly lighter) ────────────────────────────────────────
  scopeNameText: {
    fontWeight: '400',
    color:      colors.fg.tertiary,
  },

  // ── Row 3 right — heat + trust ───────────────────────────────────────────
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
    fontSize:   12,
    fontWeight: '700',
    color:      colors.fg.warning,             // amber-600
    lineHeight: 16,
  },

  // ── Trust anchor chip ─────────────────────────────────────────────────────
  trustPill: {
    backgroundColor:   colors.bg.goldSoft,
    borderRadius:      radii.xs,               // 4px
    paddingHorizontal: 6,
    paddingVertical:   2,
  },

  trustText: {
    fontSize:   11,
    fontWeight: '500',
    color:      colors.fg.brandText,           // gold-700
    lineHeight: 15,
  },

});

export default HomeHeader;

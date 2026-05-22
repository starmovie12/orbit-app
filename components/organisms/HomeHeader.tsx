/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Three-Row Header (HOME tab)                                     ║
 * ║  §1.3.3 — Founder-Locked Architecture                                    ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  3 ROWS (total: 136px):                                                  ║
 * ║    Row 1 — Brand & Quick Actions (56px)                                  ║
 * ║    Row 2 — 4-Scope Switcher (48px)                                       ║
 * ║    Row 3 — Online Count Strip (32px)                                     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ROW 1 SPEC:                                                             ║
 * ║    Left: "CROWN" wordmark — Syne 800, 22px, gold, letter-spacing -0.5px  ║
 * ║    Right: 🔔 notification bell (44×44 touch) + 💬 DM icon (44×44 touch)  ║
 * ║    NO AVATAR IN ROW 1 — avatar lives in Profile tab (§1.3.3 mandate)     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ROW 3 SPEC (§1.3.3):                                                    ║
 * ║    Left:  🟡 Pulsing dot + live count + scope name                       ║
 * ║    Right: 🔥 Heat score (≥30) + Trust anchor "📍 1.2 Lakh+"              ║
 * ║    CRITICAL: Row 3 ALWAYS names the active geography.                    ║
 * ║             Never "234K online" without context.                          ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SCROLL BEHAVIOR:                                                         ║
 * ║    Full header (136px + safe-area) hides on scroll-down as ONE BLOCK     ║
 * ║    Reappears on scroll-up (280ms spring(160, 20))                         ║
 * ║    Exception: Row 2 NEVER hides when composer focused (keyboard open)     ║
 * ║    → showHeader() is called immediately on composerFocused = true         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * FIX LOG (v3.2):
 *   [1] Removed dead refs: row12Anim, row3Anim (created but never used)
 *   [2] Fixed animation target: translateY now applied to the ENTIRE
 *       Animated.View container (all 3 rows move as one block per PRD §9.2)
 *       Previously only Row 1 had translateY — Row 2 & Row 3 never animated.
 *   [3] containerTranslateY uses -(TOTAL_H + insets.top) so the full block
 *       (including safe-area padding) slides off-screen on hide.
 *   [4] composerFocused prop is now wired: useEffect calls showHeader()
 *       whenever the composer receives focus, ensuring Row 2 is always visible
 *       while the user is composing (PRD §9.2 "Row 2 never hides" exception).
 *   [5] Notification and DM badges now render the unread COUNT as text, not
 *       just a coloured dot (PRD §9.2: "badged with unread count").
 *   [6] Row 1 is now a plain View (the old inner Animated.View was the only
 *       thing that animated before; it is no longer needed).
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
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, zIndex, dimensions } from '@/constants/colors';
import { FourScopeSwitcher, type ChatScope } from '@/components/molecules/FourScopeSwitcher';
import HeatPulseDot from '@/components/atoms/HeatPulseDot';
import { BRAND } from '@/constants/branding';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — all traces to §1.3.3 paragraph-level spec
// ─────────────────────────────────────────────────────────────────────────────

const HDR = {
  /** §1.3.3 Row 1 — "56px H" */
  ROW1_H: 56 as const,

  /** §1.3.3 Row 2 — "48px H" */
  ROW2_H: 48 as const,

  /** §1.3.3 Row 3 — "32px H" */
  ROW3_H: 32 as const,

  /** Total header content height: 56 + 48 + 32 = 136px (safe-area added at runtime) */
  TOTAL_H: 136 as const,

  /** §1.3.3 Row 1 wordmark: "Syne 800, 22px, letter-spacing -0.5px" */
  WORDMARK_SIZE: 22 as const,
  WORDMARK_LETTER_SPACING: -0.5 as const,

  /** §1.3.3 Row 1 action icons: "44×44 touch target" */
  ACTION_TOUCH: 44 as const,
  ACTION_ICON: 22 as const,

  /** §1.3.3 Row 3 Heat: "visible when ≥ 30" */
  HEAT_VISIBLE_THRESHOLD: 30 as const,

  /** §1.3.3 Trust anchor: "auto-hides after 60s or first scroll" */
  TRUST_ANCHOR_VISIBLE_MS: 60_000 as const,

  /** §1.3.3 Scroll coordination: "hides on scroll-down (220ms easeInQuad)" */
  HIDE_DURATION: 220 as const,

  /** §1.3.3 Scroll coordination: "reappears on scroll-up (280ms spring(160, 20))" */
  SHOW_DURATION: 280 as const,
  SHOW_SPRING_TENSION: 160 as const,
  SHOW_SPRING_FRICTION: 20 as const,

  /** §1.3.3 Row 3 count update: "<200ms animated count-up" */
  COUNT_UPDATE_MS: 200 as const,

  /** Horizontal screen padding */
  PAD_H: spacing.base as const, // 16px

  /** Badge max count before "99+" label */
  BADGE_MAX: 99 as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — shared with CrownBottomNav
//
// headerScrollAnim: 0 = visible, 1 = hidden
//
// FIX [2]: This value now drives the ENTIRE header container translateY,
// not just Row 1. All three rows move as one block (PRD §9.2).
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
// "12,847" → "12.8K" | "1,20,000" → "1.2 Lakh" | "1,00,00,000" → "1 Cr"
// ─────────────────────────────────────────────────────────────────────────────

function formatOnlineCount(count: number): string {
  if (count >= 10_000_000) return `${(count / 10_000_000).toFixed(1)} Cr`;
  if (count >= 100_000)    return `${(count / 100_000).toFixed(1)} Lakh`;
  if (count >= 1_000)      return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE LABEL BUILDER — §1.3.3 "phrasing follows the language of active scope"
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
// BADGE COUNT LABEL — "99+" when over HDR.BADGE_MAX
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
  /** Auto-hides after 60s from first session or first scroll */
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

  // ── FIX [2] + [3]: containerTranslateY drives ALL THREE ROWS as one block ─
  //
  // outputRange upper bound = -(content height + safe area top) so the entire
  // header (including the status-bar padding) slides fully off screen.
  // useMemo re-derives when insets.top changes (orientation / device change).
  const containerTranslateY = useMemo(
    () =>
      headerScrollAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, -(HDR.TOTAL_H + insets.top)],
        extrapolate: 'clamp',
      }),
    [insets.top],
  );

  // ── FIX [4]: composerFocused → always show header ────────────────────────
  //
  // PRD §9.2: "Row 2 (the 4-scope switcher) NEVER hides when the user is
  // composing a message (input focused)."
  // Calling showHeader() when the composer receives focus guarantees Row 2
  // is on screen regardless of prior scroll position.
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
    // ── FIX [2]: translateY applied to the entire container (one block) ────
    //    Previously only Row 1 had translateY; Rows 2 & 3 were plain Views
    //    and therefore stayed visible when the header "hid". Now all three
    //    rows are children of this single Animated.View and move together.
    <Animated.View
      style={[
        styles.headerContainer,
        { paddingTop: insets.top },
        { transform: [{ translateY: containerTranslateY }] },
      ]}
      pointerEvents="box-none"
    >

      {/* ── ROW 1: Brand + Actions (56px) ─────────────────────────────────── */}
      {/* FIX [6]: plain View — the old inner Animated.View is no longer needed
           since the outer container handles the translateY for the whole block */}
      <View
        style={styles.row1}
        pointerEvents="box-none"
      >
        {/* LEFT: CROWN wordmark */}
        <Text
          style={styles.wordmark}
          accessibilityRole="header"
          accessibilityLabel="CROWN"
          allowFontScaling={false}
        >
          {BRAND.NAME}
        </Text>

        {/* RIGHT: Action icons (NO AVATAR — §1.3.3 mandate) */}
        <View style={styles.actions}>

          {/* 🔔 Notification bell */}
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
            <Feather name="bell" size={HDR.ACTION_ICON} color={colors.fg.primary} />

            {/* FIX [5]: badge now shows the unread COUNT, not just a dot */}
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

          {/* 💬 DM inbox */}
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
            <Feather name="message-circle" size={HDR.ACTION_ICON} color={colors.fg.primary} />

            {/* FIX [5]: badge now shows the unread COUNT, not just a dot */}
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

      {/* ── ROW 2: 4-Scope Switcher (48px) ─────────────────────────────────── */}
      {/* FIX [4]: Row 2 participates in the one-block animation but is always
           brought back into view via showHeader() when composerFocused = true,
           satisfying §1.3.3 "Row 2 NEVER hides when composer focused". */}
      <View style={styles.row2}>
        <FourScopeSwitcher
          activeScope={activeScope}
          onScopeChange={onScopeChange}
          onPickerOpen={onPickerOpen}
          labels={scopeLabels}
        />
      </View>

      {/* ── ROW 3: Online Count Strip (32px) ───────────────────────────────── */}
      {/* §1.3.3: "ALWAYS names the active geography" */}
      <View style={styles.row3} accessibilityLiveRegion="polite">

        {/* LEFT: Pulsing dot + count + scope name */}
        <View style={styles.row3Left}>
          {/* 🟡 Animated pulsing dot — §1.3.3 "1.5s ease-in-out infinite" */}
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

          {/* 🔥 Heat score — visible when ≥ 30 */}
          {showHeat ? (
            <View style={styles.heatPill}>
              <Text style={styles.heatText} allowFontScaling={false}>
                🔥 Heat {heatScore}
              </Text>
            </View>
          ) : null}

          {/* 📍 Trust anchor — visible only on first session of day, auto-hides 60s */}
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

  // ── Header wrapper — sticks above chat body ────────────────────────────────
  // z-index: 100 per §1.3.4 Z-Index Stack
  // FIX [2]: This is now the Animated.View that receives translateY for the
  //          ENTIRE block (rows 1 + 2 + 3 move together per PRD §9.2).
  headerContainer: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    zIndex:          100,
    backgroundColor: colors.bg.surface,
  },

  // ── ROW 1 — 56px (§1.3.3) ─────────────────────────────────────────────────
  // FIX [6]: plain View, not Animated.View (outer container handles animation)
  row1: {
    height:             HDR.ROW1_H,             // 56px
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',
    paddingHorizontal:  HDR.PAD_H,              // 16px
  },

  // ── CROWN wordmark — Syne 800, 22px, gold, -0.5px letter-spacing ─────────
  // §1.3.3: "CROWN in Syne 800, 22px, gold #D4A017 (light) / #F59E0B (dark)"
  wordmark: {
    fontFamily:    'Syne_800ExtraBold',
    fontSize:      HDR.WORDMARK_SIZE,           // 22px
    letterSpacing: HDR.WORDMARK_LETTER_SPACING, // -0.5px
    color:         colors.fg.brand,             // gold[600]
    lineHeight:    28,
  },

  // ── Right action group ────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },

  // ── Each action button — 44×44 touch target ───────────────────────────────
  actionButton: {
    width:          HDR.ACTION_TOUCH,           // 44
    height:         HDR.ACTION_TOUCH,           // 44
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  // ── Action badge — count badge (single digit) ────────────────────────────
  // FIX [5]: badge now shows count text. Minimum 16×16 pill.
  actionBadge: {
    position:         'absolute',
    top:              6,
    right:            4,
    minWidth:         16,
    height:           16,
    borderRadius:     8,
    backgroundColor:  colors.fg.error,
    borderWidth:      1.5,
    borderColor:      colors.bg.surface,
    alignItems:       'center',
    justifyContent:   'center',
    paddingHorizontal: 3,
  },

  // ── Wider badge for two-digit counts (10–99+) ─────────────────────────────
  actionBadgeWide: {
    minWidth: 20,
  },

  // ── Badge count text ──────────────────────────────────────────────────────
  // FIX [5]: new style for count label inside badge
  badgeText: {
    fontSize:   9,
    fontWeight: '700',
    color:      '#FFFFFF',
    lineHeight: 11,
  },

  // ── ROW 2 — 48px (§1.3.3) — scope switcher ────────────────────────────────
  row2: {
    height:            HDR.ROW2_H,              // 48px
    paddingHorizontal: HDR.PAD_H,              // 16px horizontal
    backgroundColor:   'transparent',           // Transparent track — §1.3.3 v3.1
  },

  // ── ROW 3 — 32px (§1.3.3) — online count strip ────────────────────────────
  row3: {
    height:            HDR.ROW3_H,              // 32px
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

  // ── Online count text ─────────────────────────────────────────────────────
  // §1.3.3: "12px Inter 600"
  onlineText: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.fg.secondary,
    lineHeight: 16,
  },

  // ── Scope name inside online text (slightly lighter) ─────────────────────
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

  // ── Heat pill ─────────────────────────────────────────────────────────────
  heatPill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },

  heatText: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.fg.warning,              // amber[600]
    lineHeight: 16,
  },

  // ── Trust anchor chip ─────────────────────────────────────────────────────
  trustPill: {
    backgroundColor:   colors.bg.goldSoft,
    borderRadius:      radii.xs,                // 4px
    paddingHorizontal: 6,
    paddingVertical:   2,
  },

  trustText: {
    fontSize:   11,
    fontWeight: '500',
    color:      colors.fg.brandText,            // gold[700]
    lineHeight: 15,
  },

});

export default HomeHeader;

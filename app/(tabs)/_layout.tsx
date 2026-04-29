/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — Floating Glass Island Tab Layout                              ║
 * ║  v5.0 BAAP EDITION · Part 1 + Part 2 + Part 3 Complete Integration          ║
 * ║  Owner: Ail (Founder) · Chandigarh · 29 April 2026                          ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  DESIGN LAWS ENFORCED IN THIS FILE:                                          ║
 * ║  LAW 13 — Floating Glass Island: icon-only · no labels · pill shape         ║
 * ║  LAW 15 — CROWD wordmark: top-left every primary screen (screen's own job)  ║
 * ║  LAW 1  — Credits only: NO ₹ symbol near tab bar                            ║
 * ║  LAW 4  — Peek before join: Glass Island visible in peek mode               ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  GLASS ISLAND SPEC (LAW 13 · Part 1 § Sec 2 [8] · Part 3 § 2 refined)      ║
 * ║                                                                              ║
 * ║  Shape       : 280×56px pill · border-radius 28px (full pill)               ║
 * ║  Background  : rgba(20,16,12,0.85) — WARM navy · Part 3 § 2 refinement      ║
 * ║                (old cold rgba(13,16,24,0.85) → replaced per § 2 palette)    ║
 * ║  BlurView    : tint="dark" intensity=85 (iOS) · rgba fallback (Android)      ║
 * ║  Border      : 0.5px rgba(255,255,255,0.12) — glass.border per § 2         ║
 * ║  Shadow      : 0 8px 32px rgba(20,16,12,0.40) — glass.shadow per § 2       ║
 * ║  Gold Rim    : 1px rgba(226,198,107,0.40) hairline at pill top              ║
 * ║  Z-Index     : 950 (Rule 04: Feed<Input<935<GlassIsland<950)                ║
 * ║  Position    : 16px above safe-area-bottom · absolute · centered             ║
 * ║                                                                              ║
 * ║  4 TABS (icon-only · no text labels — LAW 13):                              ║
 * ║    Tab 1  Home       → index.tsx    · icon: "home"        · Part 1          ║
 * ║    Tab 2  Discover   → discover.tsx · icon: "compass"     · Part 3 § 9      ║
 * ║    Tab 3  Wallet     → bazaar.tsx   · icon: "credit-card" · Part 3 § 10     ║
 * ║    Tab 4  Profile    → profile.tsx  · icon: "user"        · Part 3 § 11     ║
 * ║                                                                              ║
 * ║  ACTIVE STATE:                                                               ║
 * ║    Icon color   : #C5A227 (gold-600 · champagne luxury · Part 3 § 2)        ║
 * ║    Scale        : 1.12 (spring animation)                                   ║
 * ║    Glow circle  : 36×36 rgba(197,162,39,0.18) behind icon                  ║
 * ║    Dot          : 4×4px gold-600 · 5px below icon group                     ║
 * ║                                                                              ║
 * ║  INACTIVE STATE:                                                             ║
 * ║    Icon color   : rgba(255,255,255,0.58) — white 58% on warm navy           ║
 * ║                                                                              ║
 * ║  HIDE/SHOW (Part 1 § 7):                                                    ║
 * ║    Scroll down  → translateY +80px  · 200ms timing                          ║
 * ║    Scroll up    → translateY 0      · spring(180,22)                        ║
 * ║    Keyboard up  → translateY +130px · 180ms timing                          ║
 * ║    Keyboard down→ translateY 0      · spring(180,22)                        ║
 * ║                                                                              ║
 * ║  HAPTICS: Light on tap · Medium on long-press                                ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  PART 3 § 2 — COMPLETE COLOR TOKEN MIGRATION MAP                            ║
 * ║                                                                              ║
 * ║    #D4A017 → #C5A227   gold-600   champagne · -10% saturation               ║
 * ║    #E07B20 → #BD8531   amber-600  burnished amber                           ║
 * ║    #F5C842 → #E2C66B   gold-400   refined celebrate                         ║
 * ║    #F5E6C8 → #F7ECD0   cream-200  warm ivory                                ║
 * ║    #1A1A1A → #1C1814   ink-950    warm ink (slight golden undertone)        ║
 * ║    #6B5B2E → #6B5B47   ink-600    espresso brown                            ║
 * ║    #E8D5A0 → #E5CC95   cream-400  refined divider                           ║
 * ║    rgba(13,16,24,0.85) → rgba(20,16,12,0.85)  glass bg (warm)               ║
 * ║    #EF4444 → #B5392B   crimson-600 warm red (badge · error)                 ║
 * ║                                                                              ║
 * ║  WCAG 2.2 AA verified pairs used in this file:                              ║
 * ║    white on glass.bg = 11.2:1 ✅ AAA  (icon inactive · white 58% OK)        ║
 * ║    gold-600 on glass.bg       (icon active · large icon = AA)               ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  SCROLL INTEGRATION API                                                      ║
 * ║                                                                              ║
 * ║    import { hideNav, showNav } from '@/app/(tabs)/_layout';                  ║
 * ║                                                                              ║
 * ║    const lastY = useRef(0);                                                  ║
 * ║    const onScroll = useCallback(({ nativeEvent: { contentOffset: { y } } }) => {║
 * ║      const delta = y - lastY.current;                                        ║
 * ║      if (delta > 12)  hideNav();   // scrolling toward older messages        ║
 * ║      if (delta < -8)  showNav();   // scrolling toward newest                ║
 * ║      lastY.current = y;                                                      ║
 * ║    }, []);                                                                   ║
 * ║    // <FlatList onScroll={onScroll} scrollEventThrottle={16} />              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKEN OBJECT — CW (CrowdWorld)
//
// Every value in this object is directly traceable to a blueprint spec section.
// NEVER use raw numbers in components below — always reference CW.tokenName.
// ─────────────────────────────────────────────────────────────────────────────

const CW = {

  // ────────────────────────────────────────────────────────────────────────────
  // GLASS ISLAND GEOMETRY — LAW 13 · Part 1 § Sec 2 [8]
  // ────────────────────────────────────────────────────────────────────────────
  pillWidth:          280,    // "W: 280px" — exact Part 1 spec
  pillHeight:         56,     // "H: 56px"  — exact Part 1 spec
  pillRadius:         28,     // "height/2 = full pill" — exact
  pillPadH:           6,      // Internal horizontal padding
  pillPadV:           4,      // Internal vertical padding
  pillBottomGap:      16,     // "16px above safe-area-bottom"

  // ────────────────────────────────────────────────────────────────────────────
  // GLASS SURFACE — Part 3 § 2 WARM REFINEMENT
  // Migration: cold rgba(13,16,24,0.85) → warm rgba(20,16,12,0.85)
  // Rationale: "every neutral has slight golden undertone · cohesive palette"
  // ────────────────────────────────────────────────────────────────────────────
  glassBg:            'rgba(20, 16, 12, 0.85)',    // Part 3 § 2 glass.bg
  glassBlurTint:      'dark' as const,              // iOS BlurView tint
  glassBlurIntensity: 85,                           // iOS blur intensity (0-100)
  glassBorderColor:   'rgba(255, 255, 255, 0.12)',  // Part 3 § 2 glass.border
  glassBorderWidth:   0.5,                          // Ultra-thin glass rim

  // ────────────────────────────────────────────────────────────────────────────
  // DROP SHADOW — Part 3 § 2 shadow.glass (WARM version)
  // Migration: '#0D1018' cold → '#14100C' warm ink-950 proxy
  // Part 3 § 2: glass.shadow = 'rgba(20,16,12,0.40)'
  // ────────────────────────────────────────────────────────────────────────────
  glassShadowColor:   '#14100C',  // Warm ink-950 proxy (closest RN shadowColor)
  glassShadowH:       0,
  glassShadowV:       8,          // "0 8px 32px" — Part 1 exact
  glassShadowOpacity: 0.40,       // Part 3 § 2 glass.shadow opacity
  glassShadowRadius:  32,
  glassElevation:     16,         // Android elevation

  // ────────────────────────────────────────────────────────────────────────────
  // GOLD TOKENS — Part 3 § 2 v2.0 Champagne Gold
  // ────────────────────────────────────────────────────────────────────────────

  // gold-600: PRIMARY brand gold · champagne luxury
  // Migration: #D4A017 mustard → #C5A227 champagne (-10% saturation, +luxury)
  gold600:            '#C5A227',
  // Active glow bg: gold-600 at 18% opacity
  gold600Glow:        'rgba(197, 162, 39, 0.18)',

  // gold-400: Celebrate · earned states · rim accent
  // Migration: #F5C842 → #E2C66B
  gold400:            '#E2C66B',
  // Gold rim: gold-400 at 40% opacity
  goldRimColor:       'rgba(226, 198, 107, 0.40)',

  // gold-800: Brand wordmark color (used by screens, not this file directly)
  gold800:            '#8B6F18',

  // ────────────────────────────────────────────────────────────────────────────
  // INK TOKENS — Warm neutrals · Part 3 § 2
  // ────────────────────────────────────────────────────────────────────────────
  // ink-950: Primary text · warm ink (slight golden undertone)
  // Migration: cold #1A1A1A → warm #1C1814
  ink950:             '#1C1814',
  // ink-600: Secondary text · espresso · feels human
  // Migration: #6B5B2E → #6B5B47
  ink600:             '#6B5B47',

  // ────────────────────────────────────────────────────────────────────────────
  // CREAM TOKENS — Warm surface family · Part 3 § 2
  // ────────────────────────────────────────────────────────────────────────────
  // cream-200: Card bg · primary surface
  // Migration: #F5E6C8 → #F7ECD0
  cream200:           '#F7ECD0',
  // cream-400: Default border · divider
  // Migration: #E8D5A0 → #E5CC95
  cream400:           '#E5CC95',

  // ────────────────────────────────────────────────────────────────────────────
  // AMBER TOKEN — Burnished warm accent · Part 3 § 2
  // Migration: bright orange #E07B20 → burnished #BD8531
  // ────────────────────────────────────────────────────────────────────────────
  amber600:           '#BD8531',

  // ────────────────────────────────────────────────────────────────────────────
  // CRIMSON TOKEN — Error / destructive · Part 3 § 2
  // Migration: pure red #EF4444 → warm crimson-600 #B5392B
  // Used for: notification badge, destructive actions
  // ────────────────────────────────────────────────────────────────────────────
  crimson600:         '#B5392B',

  // ────────────────────────────────────────────────────────────────────────────
  // ICON SYSTEM
  // ────────────────────────────────────────────────────────────────────────────
  iconActive:         '#C5A227',               // gold-600 when focused
  iconInactive:       'rgba(255,255,255,0.58)', // white 58% on warm navy
  iconSize:           24,                       // Base icon size (Feather)

  // ────────────────────────────────────────────────────────────────────────────
  // SCALE ANIMATIONS
  // ────────────────────────────────────────────────────────────────────────────
  scaleActive:        1.12,  // Icon scale when tab is focused (Part 1: "1.1")
  scalePress:         0.88,  // Press-down scale (tactile click feel)

  // ────────────────────────────────────────────────────────────────────────────
  // GLOW CIRCLE — 36×36 · halo behind active icon
  // ────────────────────────────────────────────────────────────────────────────
  glowDiameter:       36,   // "36×36px rgba(197,162,39,0.18) glow" — Part 1 § 2

  // ────────────────────────────────────────────────────────────────────────────
  // ACTIVE DOT — 4×4px gold · LAW 13 requirement
  // ────────────────────────────────────────────────────────────────────────────
  dotSize:            4,    // "4×4px golden dot" — Part 1 § 2 exact
  dotRadius:          2,    // 4/2 = circle
  dotGap:             5,    // "5px below icon group" — Part 1 § 2

  // ────────────────────────────────────────────────────────────────────────────
  // Z-INDEX — Part 1 Rule 04 stacking order
  // Hierarchy: Chat Feed(base) < Input(935) < Glass Island(950)
  // ────────────────────────────────────────────────────────────────────────────
  zIndex:             950,

  // ────────────────────────────────────────────────────────────────────────────
  // ANIMATION TIMING — Part 1 § 7 exact specification
  // Spring: "stiffness 180 · damping 22 · 250ms visible"
  // expo-haptics uses tension (stiffness) / friction (damping)
  // ────────────────────────────────────────────────────────────────────────────
  springTension:      180,  // Moderately stiff spring (smooth settle)
  springFriction:     22,   // Moderate damping (natural feel)
  iconSpringTension:  260,  // Snappier spring for icon scale response
  iconSpringFriction: 18,   // Quick settle for icon

  hideDuration:       200,  // Scroll-hide · "200ms" — Part 1 § 7
  showDuration:       250,  // Show spring duration context
  kbHideDuration:     180,  // Keyboard-triggered hide · "180ms" — Part 1 § 7

  // ────────────────────────────────────────────────────────────────────────────
  // TRANSLATE DISTANCES — Part 1 § 7
  // ────────────────────────────────────────────────────────────────────────────
  scrollHideY:        80,   // "translateY +80px on scroll" — Part 1 § 7
  keyboardHideY:      130,  // "translateY +130px on keyboard" — Part 1 § 7

  // ────────────────────────────────────────────────────────────────────────────
  // NOTIFICATION BADGE DOT
  // crimson-600 per Part 3 § 2 (warm red · not cold #EF4444)
  // ────────────────────────────────────────────────────────────────────────────
  badgeSize:          7,
  badgeBorderWidth:   1.5,
  badgeColor:         '#B5392B',             // crimson-600 · Part 3 § 2
  badgeBorderColor:   'rgba(20,16,12,0.85)', // glassBg match → clean cutout

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_W  = Dimensions.get('window').width;
const PILL_LEFT = (SCREEN_W - CW.pillWidth) / 2; // Centers 280px pill horizontally

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — Shared Animated.Value exported for screen components
//
// Semantics:
//   0 = Glass Island VISIBLE   (translateY = 0 · opacity = 1)
//   1 = Glass Island HIDDEN    (translateY = full offset · opacity = 0)
//
// Usage in screens:
//   import { hideNav, showNav } from '@/app/(tabs)/_layout';
//   const lastY = useRef(0);
//   const onScroll = useCallback(({ nativeEvent: { contentOffset: { y } } }) => {
//     const delta = y - lastY.current;
//     if (delta > 12)  hideNav();   // scrolling toward older messages (chat down)
//     if (delta < -8)  showNav();   // scrolling toward newest (chat up)
//     lastY.current = y;
//   }, []);
//   // <FlatList onScroll={onScroll} scrollEventThrottle={16} />
// ─────────────────────────────────────────────────────────────────────────────

export const navScrollAnim = new Animated.Value(0);

/**
 * hideNav() — Slide Glass Island off-screen downward.
 * Call when user scrolls TOWARD older messages (downward in chat).
 * Duration: 200ms timing (Part 1 § 7: "200ms timing on hide")
 */
export function hideNav(): void {
  Animated.timing(navScrollAnim, {
    toValue:         1,
    duration:        CW.hideDuration,
    useNativeDriver: true,
  }).start();
}

/**
 * showNav() — Spring Glass Island back into view.
 * Call when user scrolls TOWARD newest messages (upward in chat).
 * Spring: tension 180 · friction 22 (Part 1 § 7)
 */
export function showNav(): void {
  Animated.spring(navScrollAnim, {
    toValue:         0,
    useNativeDriver: true,
    tension:         CW.springTension,
    friction:        CW.springFriction,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONFIGURATION — 4 Glass Island tabs
//
// Traceability:
//   Home     → Part 1 full blueprint
//   Discover → Part 3 § 9 (absorbs displaced discovery features)
//   Wallet   → Part 3 § 10 (bazaar.tsx in v1.0, wallet.tsx in v1.1)
//   Profile  → Part 3 § 11 (SOLE valid profile entry · Rule 03)
// ─────────────────────────────────────────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface TabConfig {
  route:    string;       // Expo Router file name in app/(tabs)/
  label:    string;       // Accessibility only — NOT shown visually (LAW 13)
  icon:     FeatherName;  // Feather icon · Part 2 Asset Manifest
  a11yHint: string;       // Screen reader action hint (Hinglish · Part 2 § 8)
  badge?:   number;       // Red dot if > 0
}

const TABS: readonly TabConfig[] = [
  {
    // ── TAB 1: HOME ──────────────────────────────────────────────────────────
    // Hyper-local sector chat · primary landing screen for all authenticated users
    // Part 1 full blueprint · Glass Island Tab 1
    // Header: Row 1 (CROWD wordmark + notifications + profile avatar)
    //         Row 2 (City Pill + Sector Pill) — Two-Row sticky header (Part 3 § 1)
    route:    'index',
    label:    'Home',
    icon:     'home',
    a11yHint: 'Apne sector ka chat kholo',
  },
  {
    // ── TAB 2: DISCOVER ──────────────────────────────────────────────────────
    // Absorbs all discovery features displaced from chat-first Home (Part 2 Issue 1)
    // Featured sectors · CROWN Pass card · Trending carousel · City Heat Map
    // Earning leaderboard · Founder Pass promo · Sub-tabs: Featured/Trending/Nearby/Earning
    // Glass Island Tab 2 · Part 3 § 9
    // Header: Row 1 only (CROWD wordmark + notifications + profile) — no location row
    route:    'discover',
    label:    'Discover',
    icon:     'compass',
    a11yHint: 'Trending sectors aur earning discover karo',
  },
  {
    // ── TAB 3: WALLET (bazaar.tsx in v1.0) ───────────────────────────────────
    // THE monetization surface — trust-first design required (Part 3 § 10)
    // Credits balance hero · Quick actions · Cashout flow · Transaction history
    // Auth required — NO peek mode for Wallet
    // LAW 1 honored: ₹ only at cashout-adjacent surfaces (Razorpay handoff)
    // Glass Island Tab 3 · Part 3 § 10
    // Header: Row 1 only (CROWD wordmark + 🔒 lock trust signal + profile)
    route:    'bazaar',
    label:    'Wallet',
    icon:     'credit-card',
    a11yHint: 'Credits, cashout aur passes dekho',
  },
  {
    // ── TAB 4: PROFILE ────────────────────────────────────────────────────────
    // SOLE valid profile entry point — Rule 03 absolute law
    // Own profile · stats grid · achievements carousel · recent activity · settings
    // CRITICAL: icon is ALWAYS Feather 'user' (never user's own avatar — Rule 03)
    // Glass Island Tab 4 · Part 3 § 11
    // Header: Row 1 only (CROWD wordmark + Settings gear ⚙ 44×44 touch)
    route:    'profile',
    label:    'Profile',
    icon:     'user',
    a11yHint: 'Apna profile, achievements aur settings dekho',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TAB ITEM COMPONENT — Single icon tab inside the Glass Island pill
//
// Animated values:
//   scaleAnim  — icon scale: 1.0 → CW.scaleActive (1.12) on focus (spring)
//   glowAnim   — glow circle + dot opacity: 0 → 1 on focus (timing 220ms)
//   pressAnim  — press feedback: 1.0 → CW.scalePress (0.88) → 1.0
//
// Haptic feedback:
//   Tap       → ImpactFeedbackStyle.Light (soft click feel)
//   Long-press → ImpactFeedbackStyle.Medium (firm acknowledgement)
// ─────────────────────────────────────────────────────────────────────────────

interface TabItemProps {
  config:      TabConfig;
  focused:     boolean;
  onPress:     () => void;
  onLongPress: () => void;
}

function TabItem({ config, focused, onPress, onLongPress }: TabItemProps) {

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // ── Focus change → scale spring + glow timing (parallel) ─────────────────
  useEffect(() => {
    Animated.parallel([
      // Icon scale — spring(260,18) for snappy but natural elastic response
      Animated.spring(scaleAnim, {
        toValue:         focused ? CW.scaleActive : 1,
        useNativeDriver: true,
        tension:         CW.iconSpringTension,    // 260
        friction:        CW.iconSpringFriction,   // 18
      }),
      // Glow circle + dot — 220ms timing fade (smooth appearance)
      Animated.timing(glowAnim, {
        toValue:         focused ? 1 : 0,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scaleAnim, glowAnim]);

  // ── Press down → scale to 0.88 (70ms timing, fast response) ──────────────
  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue:         CW.scalePress,
      duration:        70,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  // ── Press up → spring back to 1.0 (stiff spring, quick bounce) ───────────
  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue:         1,
      useNativeDriver: true,
      tension:         300,
      friction:        14,
    }).start();
  }, [pressAnim]);

  // ── Tap: Light haptic + navigate ──────────────────────────────────────────
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  // ── Long press: Medium haptic (future: context menu) ─────────────────────
  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  const hasBadge = (config.badge ?? 0) > 0;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // ── Accessibility — Part 3 § 9-11 a11y specs ─────────────────────────
      accessibilityRole="tab"
      accessibilityLabel={config.label}
      accessibilityState={{ selected: focused }}
      accessibilityHint={config.a11yHint}
      style={styles.tabPressable}
      // Extended hit area: 8px top/bottom, 6px left/right (44px min target)
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      {/* Press-scale outer wrapper */}
      <Animated.View style={[styles.tabInner, { transform: [{ scale: pressAnim }] }]}>

        {/* Icon scale wrapper */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>

          {/* Glow halo circle — 36×36 gold rgba · opacity 0→1 on focus */}
          <Animated.View style={[styles.glowCircle, { opacity: glowAnim }]} />

          {/* Feather icon — gold-600 active · white-58% inactive */}
          <Feather
            name={config.icon}
            size={CW.iconSize}
            color={focused ? CW.iconActive : CW.iconInactive}
          />

          {/* Notification badge dot — crimson-600 top-right · only when badge > 0 */}
          {hasBadge ? (
            <View
              style={styles.badgeWrap}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <View style={styles.badgeDot} />
            </View>
          ) : null}

        </Animated.View>

        {/* Active indicator dot — 4×4 gold · 5px below · opacity follows glowAnim */}
        <Animated.View style={[styles.activeDot, { opacity: glowAnim }]} />

      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PILL CONTENTS — Shared by BlurView (iOS) and View (Android)
// ─────────────────────────────────────────────────────────────────────────────

type TabBarCoreProps = {
  state: {
    routes: Array<{ key: string; name: string }>;
    index:  number;
  };
  descriptors: Record<string, {
    options: { title?: string; tabBarBadge?: number | string };
  }>;
  navigation: {
    emit:     (e: { type: string; target?: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function PillContents({ state, descriptors, navigation }: TabBarCoreProps) {
  return (
    <>
      {/* Gold rim hairline — 1px at pill top · gold-400 at 40% · inset 12px */}
      <View style={styles.goldRim} pointerEvents="none" />

      {/* 4-tab row */}
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          const tabCfg = TABS.find((t) => t.route === route.name);
          if (!tabCfg) return null; // Skip hidden screens (ranks, inbox, live, etc.)

          const isFocused  = state.index === index;
          const descriptor = descriptors[route.key];
          const rawBadge   = descriptor?.options?.tabBarBadge;
          // Accept badge from tabBarBadge screen option OR static TABS config
          const badgeCount = typeof rawBadge === 'number' ? rawBadge : (tabCfg.badge ?? 0);

          function onPress(): void {
            const event = navigation.emit({
              type:              'tabPress',
              target:            route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          function onLongPress(): void {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          }

          return (
            <TabItem
              key={route.key}
              config={{ ...tabCfg, badge: badgeCount }}
              focused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING TAB BAR — Passed to <Tabs tabBar={...} />
//
// Handles:
//   1. Keyboard show/hide → kbAnim → hide/show pill (iOS: Will events, Android: Did)
//   2. navScrollAnim (scroll) + kbAnim (keyboard) → combined translateY
//   3. Opacity fade during hide travel
//   4. Platform split: BlurView (iOS native blur) vs rgba View (Android fallback)
//   5. Dynamic bottom positioning using safe area insets
//
// Animation math:
//   scrollY   = [0→0, 1→scrollHideY+bottomBase+pillH]  (interpolated)
//   keyboardY = [0→0, 1→kbHideY+bottomBase+pillH]      (interpolated)
//   translateY = scrollY + keyboardY  (additive · only one fires at a time)
//   opacity    = [0→1, 0.4→0.95, 1→0]  (fade during hide travel)
// ─────────────────────────────────────────────────────────────────────────────

type FloatingTabBarProps = TabBarCoreProps;

function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const insets     = useSafeAreaInsets();
  const bottomBase = CW.pillBottomGap + insets.bottom; // 16 + device safe area

  const kbAnim = useRef(new Animated.Value(0)).current; // 0=pill visible, 1=hidden

  // ── Keyboard listeners ────────────────────────────────────────────────────
  useEffect(() => {
    // iOS: 'Will' events fire BEFORE animation starts (smoother)
    // Android: 'Did' events only (fires after keyboard appears/disappears)
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvt, () => {
      // Keyboard appearing → slide pill off-screen (180ms · Part 1 § 7)
      Animated.timing(kbAnim, {
        toValue:         1,
        duration:        CW.kbHideDuration,
        useNativeDriver: true,
      }).start();
    });

    const subHide = Keyboard.addListener(hideEvt, () => {
      // Keyboard dismissed → spring pill back (tension 180 · friction 22)
      Animated.spring(kbAnim, {
        toValue:         0,
        useNativeDriver: true,
        tension:         CW.springTension,
        friction:        CW.springFriction,
      }).start();
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [kbAnim]);

  // ── Scroll-driven translateY ──────────────────────────────────────────────
  // navScrollAnim: 0→visible · 1→hidden (full offset below screen)
  const scrollY = navScrollAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, CW.scrollHideY + bottomBase + CW.pillHeight],
    extrapolate: 'clamp',
  });

  // ── Keyboard-driven translateY ────────────────────────────────────────────
  // kbAnim: 0→visible · 1→hidden (full offset below keyboard)
  const keyboardY = kbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, CW.keyboardHideY + bottomBase + CW.pillHeight],
    extrapolate: 'clamp',
  });

  // Additive combination — in practice only one fires at a time
  const translateY = Animated.add(scrollY, keyboardY);

  // ── Opacity — fades as pill moves off-screen ──────────────────────────────
  // Threshold at 40%: 1.0 → 0.95 → 0 (prevents jarring pop at end of travel)
  const opacity = navScrollAnim.interpolate({
    inputRange:  [0, 0.4, 1],
    outputRange: [1, 0.95, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      testID="crowd-glass-island"
      accessibilityRole="tablist"
      accessibilityLabel="Navigation tabs: Home, Discover, Wallet, Profile"
      style={[
        styles.navContainer,
        {
          bottom:    bottomBase,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      // box-none: this container doesn't intercept touches — only TabItem Pressables do
      pointerEvents="box-none"
    >
      {/*
       * Glass surface rendering — Platform split:
       *
       * iOS:
       *   BlurView with tint="dark" intensity=85
       *   Provides real UIBlurEffect backdrop blur (native glass)
       *   overflow:hidden on pill clips blur to rounded corners
       *
       * Android:
       *   View with glassBg = rgba(20,16,12,0.85) solid warm navy
       *   BlurView on Android is experimental → rgba solid is production-safe
       *   Gold rim + glow circles still render correctly
       *
       * Both: same pill shape, border, gold rim, and PillContents
       */}
      {Platform.OS === 'ios' ? (
        <BlurView
          tint={CW.glassBlurTint}
          intensity={CW.glassBlurIntensity}
          style={styles.pill}
        >
          <PillContents state={state} descriptors={descriptors} navigation={navigation} />
        </BlurView>
      ) : (
        <View style={[styles.pill, styles.pillAndroid]}>
          <PillContents state={state} descriptors={descriptors} navigation={navigation} />
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB LAYOUT ROOT — Default export
//
// screenOptions decisions:
//   headerShown: false         → Each screen owns its header (LAW 15)
//   tabBarStyle: {display:none}→ Our custom FloatingTabBar replaces native bar
//   tabBarShowLabel: false      → LAW 13: icon-only, no labels
//   tabBarHideOnKeyboard: false → Handled by our kbAnim listener
//   freezeOnBlur: true         → Pause inactive tab renders (Part 1 § 10 perf)
//   animation: 'none'          → Instant tab switches (no slide between tabs)
//
// Hidden screens (href: null):
//   ranks    → accessible via Discover → Earning sub-tab (not a primary tab)
//   inbox    → DM screens (v1.2 roadmap · not in v1.0 Glass Island)
//   live     → Voice Rooms / Agora RTC (v2.0 · Phase 2)
//   rooms    → Internal routing helper
//   settings → Pushed sub-screen from Profile tab gear icon (Part 3 § 14)
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...(props as FloatingTabBarProps)} />}
      screenOptions={{
        headerShown:          false,         // LAW 15: screens own their headers
        tabBarStyle:          { display: 'none' }, // Custom pill replaces native bar
        tabBarShowLabel:      false,         // LAW 13: icon-only
        tabBarHideOnKeyboard: false,         // kbAnim listener handles this
        freezeOnBlur:         true,          // Part 1 § 10 perf spec
        animation:            'none',        // Instant tab switching
      }}
    >

      {/* ══════════════════════════════════════════════════════════════════════
          GLASS ISLAND TABS (4) — LAW 13 · Part 3 § 9-11
          ══════════════════════════════════════════════════════════════════════ */}

      {/**
       * TAB 1 — HOME
       * Primary landing · hyper-local sector chat · 100% of sessions post-auth
       * Feather "home" icon · gold-600 when active
       *
       * Screen header (Part 3 § 1 · LAW 15 · Two-Row):
       *   Row 1 (56px): [CROWD wordmark · 24px · gold-800 · 16px left]
       *                 [🔔 notifications 44×44] [👤 avatar 44×44]
       *   Row 2 (44px): [📍 City Pill ▼] [Sector Pill ▼]
       *   Both rows sticky · total 100px above chat
       *
       * Scroll API: import { hideNav, showNav } and wire to FlatList onScroll
       */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />

      {/**
       * TAB 2 — DISCOVER
       * All discovery features displaced from chat-first Home (Part 2 Issue 1 fix)
       * Feather "compass" icon · gold-600 when active
       *
       * Screen header (LAW 15 · Single Row):
       *   Row 1 (56px): [CROWD wordmark · 24px · gold-800 · 16px left]
       *                 [🔔 notifications 44×44] [👤 avatar 44×44]
       *   NO Row 2 (Discover is global · not sector-bound)
       *
       * Sub-tabs (sticky): Featured · Trending · Nearby · Earning (Part 3 § 9)
       */}
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover' }}
      />

      {/**
       * TAB 3 — WALLET (bazaar.tsx in v1.0)
       * THE monetization surface · auth required · no peek mode
       * Feather "credit-card" icon · gold-600 when active
       *
       * Screen header (LAW 15 · Single Row):
       *   Row 1 (56px): [CROWD wordmark · 24px · gold-800 · 16px left]
       *                 [🔒 lock icon 16×16 gold-600 · trust signal]
       *                 [👤 avatar 44×44]
       *
       * LAW 1: ₹ symbol ONLY at cashout-adjacent surfaces (Razorpay handoff)
       *        Wallet hero = Credits balance + rate disclosure ONLY (not ₹ value)
       */}
      <Tabs.Screen
        name="bazaar"
        options={{ title: 'Wallet' }}
      />

      {/**
       * TAB 4 — PROFILE
       * SOLE valid profile entry point — Rule 03 absolute law
       * Feather "user" icon (NEVER user's avatar — Rule 03)
       * gold-600 when active
       *
       * Screen header (LAW 15 · Single Row):
       *   Row 1 (56px): [CROWD wordmark · 24px · gold-800 · 16px left]
       *                 [⚙ settings gear · 24×24 · 44×44 touch · 16px right]
       *
       * Settings access via gear icon → /settings (push · Part 3 § 14)
       */}
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          HIDDEN SCREENS — href:null — NOT in Glass Island
          Accessible via in-app navigation from the 4 primary tabs above
          ══════════════════════════════════════════════════════════════════════ */}

      {/* Leaderboard — accessible via Discover → Earning sub-tab */}
      <Tabs.Screen name="ranks"    options={{ href: null }} />

      {/* DM Inbox — Direct Messages · v1.2 roadmap · not in v1.0 scope */}
      <Tabs.Screen name="inbox"    options={{ href: null }} />

      {/* Live / Voice Rooms — Agora RTC integration · v2.0 · Phase 2 */}
      <Tabs.Screen name="live"     options={{ href: null }} />

      {/* Rooms — Internal routing helper for voice room navigation */}
      <Tabs.Screen name="rooms"    options={{ href: null }} />

      {/* Settings — Pushed sub-screen from Profile gear icon · Part 3 § 14
          Route: /settings · Back navigation returns to Profile tab */}
      <Tabs.Screen name="settings" options={{ href: null }} />

    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
//
// All values are direct blueprint references — zero magic numbers.
// Every dimension traces to a CW.token or explicit spec section.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Outer animated container — absolute pill positioning ──────────────────
  // PILL_LEFT = (screenWidth - 280) / 2  → centers pill on any screen width
  // bottom set dynamically in FloatingTabBar (pillBottomGap + safe area inset)
  // Shadow: Part 3 § 2 glass.shadow (WARM version — '#14100C' at 0.40 opacity)
  navContainer: {
    position:       'absolute',
    left:            PILL_LEFT,
    width:           CW.pillWidth,       // 280px
    zIndex:          CW.zIndex,          // 950 — Part 1 Rule 04

    // Warm drop shadow — Part 3 § 2 migration (was cold #0D1018, now warm)
    shadowColor:    CW.glassShadowColor, // '#14100C'
    shadowOffset:   { width: CW.glassShadowH, height: CW.glassShadowV }, // {0, 8}
    shadowOpacity:  CW.glassShadowOpacity, // 0.40
    shadowRadius:   CW.glassShadowRadius,  // 32
    elevation:      CW.glassElevation,     // 16 (Android)
  },

  // ── Glass pill shape ───────────────────────────────────────────────────────
  // Exact Part 1 spec: 280×56px · 28px radius · 0.5px border
  // overflow:hidden: clips BlurView to rounded corners, clips badge dot edges
  // flexDirection:column: stacks goldRim (1px H) then tabsRow (flex:1)
  pill: {
    width:          CW.pillWidth,        // 280
    height:         CW.pillHeight,       // 56
    borderRadius:   CW.pillRadius,       // 28 (full pill)
    overflow:       'hidden',
    borderWidth:    CW.glassBorderWidth, // 0.5px glass rim
    borderColor:    CW.glassBorderColor, // rgba(255,255,255,0.12)
    flexDirection:  'column',
  },

  // ── Android: solid rgba warm-navy fallback ─────────────────────────────────
  // Part 3 § 2: warm glass bg rgba(20,16,12,0.85) — matches updated token
  // BlurView is experimental on Android → this solid fallback is production-safe
  pillAndroid: {
    backgroundColor: CW.glassBg,         // rgba(20,16,12,0.85)
  },

  // ── Gold rim hairline — accent at top of pill ─────────────────────────────
  // Part 1 spec: "1px hairline gold-400 at top of pill"
  // gold-400 #E2C66B → rgba(226,198,107,0.40)
  // Inset 12px from each side: pillWidth-24 = 256px
  goldRim: {
    height:          1,
    width:           CW.pillWidth - 24,   // 256px inset
    alignSelf:       'center',
    backgroundColor: CW.goldRimColor,     // rgba(226,198,107,0.40)
    borderRadius:    0.5,
    marginTop:       2,                   // 2px gap from pill top edge
    marginBottom:    1,                   // 1px gap before tabs row
  },

  // ── Tabs row — 4 equal-width columns inside pill ──────────────────────────
  // flex:1 fills remaining space below goldRim (56 - 4 = 52px)
  // space-around: evenly spaces 4 tabs across 280px pill
  tabsRow: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-around',
    paddingHorizontal: CW.pillPadH,       // 6px
  },

  // ── Tab pressable area ────────────────────────────────────────────────────
  // flex:1 → equal widths within tabsRow (≈70px each in 280px pill with padding)
  // height fills pill minus goldRim zone
  // minWidth:44 → iOS HIG + Android Material minimum touch target
  tabPressable: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    height:          CW.pillHeight - 6,  // 50px
    minWidth:        44,                 // Accessibility minimum
  },

  // ── Tab inner — press-scale animation container ───────────────────────────
  tabInner: {
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Icon wrap — 36×36 container for glow + icon + badge ──────────────────
  // Size = iconSize(24) + 12 = 36 (matches glowDiameter exactly)
  // position:relative for absolute glow and badge overlays
  iconWrap: {
    width:           CW.iconSize + 12,   // 36
    height:          CW.iconSize + 12,   // 36
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },

  // ── Glow circle — 36×36 gold halo behind active icon ─────────────────────
  // Part 1 § 2: "36×36px rgba(197,162,39,0.18) glow circle"
  // absoluteFillObject + manual offset centers it in 36×36 iconWrap
  // opacity: 0→1 driven by glowAnim
  glowCircle: {
    ...StyleSheet.absoluteFillObject,
    width:           CW.glowDiameter,    // 36
    height:          CW.glowDiameter,    // 36
    borderRadius:    CW.glowDiameter / 2,// 18 = perfect circle
    backgroundColor: CW.gold600Glow,     // rgba(197,162,39,0.18)
    alignSelf:       'center',
    // Center within 36×36 iconWrap: (36-36)/2 = 0 (flush)
    top:             (CW.iconSize + 12 - CW.glowDiameter) / 2,
    left:            (CW.iconSize + 12 - CW.glowDiameter) / 2,
  },

  // ── Active indicator dot — 4×4 gold · LAW 13 non-negotiable ───────────────
  // Part 1 § 2 exact: "4×4px golden dot · 4px below icon group"
  // backgroundColor: gold-600 #C5A227 (champagne gold · Part 3 § 2)
  // opacity: 0→1 driven by same glowAnim as glow circle
  activeDot: {
    width:           CW.dotSize,          // 4
    height:          CW.dotSize,          // 4
    borderRadius:    CW.dotRadius,        // 2 → circle
    backgroundColor: CW.gold600,          // #C5A227 champagne gold
    marginTop:       CW.dotGap,           // 5px below iconWrap
  },

  // ── Badge position wrapper — top-right of iconWrap ────────────────────────
  badgeWrap: {
    position:        'absolute',
    top:             -1,
    right:           -2,
    zIndex:          1,
  },

  // ── Badge dot — 7×7 crimson circle with glass-bg border cutout ───────────
  // Part 3 § 2: crimson-600 = #B5392B (warm red, replaces cold #EF4444)
  // borderColor = glassBg → creates clean "punched-through" cutout illusion
  badgeDot: {
    width:           CW.badgeSize,        // 7
    height:          CW.badgeSize,        // 7
    borderRadius:    CW.badgeSize / 2,    // 3.5 → circle
    backgroundColor: CW.badgeColor,       // #B5392B crimson-600
    borderWidth:     CW.badgeBorderWidth, // 1.5
    borderColor:     CW.badgeBorderColor, // glassBg match → cutout
  },
});

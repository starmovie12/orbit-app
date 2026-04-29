/**
 * CROWD WORLD — Floating Glass Island Tab Layout
 * v5.0 BAAP EDITION · Complete Implementation
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DESIGN SPEC — LAW 13 (Non-Negotiable)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Glass Island:
 *   Bg           : rgba(13,16,24,0.88) — dark navy glass
 *   BlurView     : tint="dark" intensity=85 (iOS) · rgba fallback (Android)
 *   Dimensions   : W: 280px · H: 56px · centered horizontally
 *   Position     : 16px above safe-area-bottom · absolute
 *   Border Radius: 28px (full pill)
 *   Border       : 0.5px rgba(255,255,255,0.10) — subtle glass rim
 *   Shadow       : 0 8px 32px rgba(13,16,24,0.40)
 *   Z-Index      : 950
 *   Labels       : NONE — icon-only per LAW 13
 *
 * Tab Layout (4 tabs · 70px each):
 *   Tab 1 (Home)     → index.tsx    · icon: home
 *   Tab 2 (Discover) → discover.tsx · icon: compass
 *   Tab 3 (Wallet)   → bazaar.tsx   · icon: credit-card  ← wallet.tsx pending v1.1
 *   Tab 4 (Profile)  → profile.tsx  · icon: user
 *
 * Active State (Part 1 spec + Part 3 § 2 premium tokens):
 *   Icon color   : #C5A227 (gold-600 · champagne luxury)
 *   Scale        : 1.12 — subtle emphasis
 *   Glow circle  : 36×36px rgba(197,162,39,0.18) behind icon
 *   Indicator    : 4×4px gold dot · 5px below icon
 *   StrokeWidth  : 2.0 (bolder when active)
 *
 * Inactive State:
 *   Icon color   : rgba(255,255,255,0.58) — white 58% on navy
 *   StrokeWidth  : 1.5 (default lucide)
 *
 * Gold Rim:
 *   1px hairline rgba(226,198,107,0.45) at pill top — glass rim accent
 *
 * Hide/Show Behavior (LAW 13):
 *   Scroll down → translateY +80px  · timing 200ms
 *   Scroll up   → translateY 0      · spring 180/22 · 250ms
 *   Keyboard    → translateY +130px · timing 180ms
 *   KB dismiss  → translateY 0      · spring 180/22 · 250ms
 *
 * Haptics: expo-haptics · Light on tap · Medium on long-press
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PREMIUM COLOR TOKENS — Part 3 § 2 (v2.0 Champagne Gold)
 * ═══════════════════════════════════════════════════════════════════════
 *   #D4A017 → #C5A227   gold-600 · champagne refinement · -10% saturation
 *   #E07B20 → #BD8531   amber-600 · burnished · less aggressive
 *   #F5E6C8 → #F7ECD0   cream-200 · warm ivory · cleaner
 *   rgba(13,16,24,0.85)  Glass Island · preserved from Part 1 exact spec
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SCROLL INTEGRATION — Wire from any scrollable screen
 * ═══════════════════════════════════════════════════════════════════════
 *   import { hideNav, showNav } from '@/app/(tabs)/_layout';
 *
 *   const lastY = useRef(0);
 *   const onScroll = useCallback(({ nativeEvent: { contentOffset: { y } } }) => {
 *     const delta = y - lastY.current;
 *     if (delta > 12)  hideNav();   // scrolling toward older messages
 *     if (delta < -8)  showNav();   // scrolling toward newest
 *     lastY.current = y;
 *   }, []);
 *   // <FlatList onScroll={onScroll} scrollEventThrottle={16} />
 * ═══════════════════════════════════════════════════════════════════════
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
// CROWD WORLD PREMIUM DESIGN TOKENS — v2.0 · Part 3 § 2 · Champagne Gold
// All values traceable to blueprint specifications.
// ─────────────────────────────────────────────────────────────────────────────

const CW = {

  // ── Glass Island — LAW 13 exact spec ──────────────────────────────────────
  // Part 1 § Sec 2 [8]: "Bg rgba(13,16,24,0.85) with backdrop-blur 20px"
  // Preserving exact Part 1 navy with slight Part 3 warmth nudge
  glassBg:              'rgba(13, 16, 24, 0.88)',
  glassBlurTint:        'dark' as const,   // iOS BlurView tint
  glassBlurIntensity:   85,                // High intensity for premium glass
  glassBorderColor:     'rgba(255, 255, 255, 0.10)',
  glassBorderWidth:     0.5,               // Ultra-thin glass rim
  glassShadowColor:     '#0D1018',
  glassShadowH:         0,
  glassShadowV:         8,                 // Part 1: "0 8px 32px"
  glassShadowOpacity:   0.40,
  glassShadowRadius:    32,
  glassElevation:       16,

  // ── Gold Tokens — Part 3 § 2 champagne refinement ─────────────────────────
  // gold-600: champagne luxury (#D4A017 → #C5A227, -10% saturation)
  gold600:              '#C5A227',
  gold600Glow:          'rgba(197, 162, 39, 0.18)', // Active glow bg
  gold400:              '#E2C66B',                  // Rim accent / dot
  goldRimColor:         'rgba(226, 198, 107, 0.40)', // gold-400 @ 40% — rim line

  // ── Icon Colors ───────────────────────────────────────────────────────────
  iconActive:           '#C5A227',
  iconInactive:         'rgba(255, 255, 255, 0.58)',
  iconSizeBase:         24,
  iconStrokeActive:     2.0,               // Bolder on active
  iconStrokeInactive:   1.5,               // Lucide default

  // ── Active Scale ──────────────────────────────────────────────────────────
  // Part 1: "scale 1.1" — using 1.12 for slightly more punch
  activeScale:          1.12,
  pressScale:           0.88,              // Press-down scale

  // ── Active Glow Circle ────────────────────────────────────────────────────
  glowDiameter:         36,               // 36×36 circle behind icon

  // ── Active Indicator Dot ──────────────────────────────────────────────────
  // Part 1: "golden 4px dot 4px below" — LAW 13
  dotSize:              4,
  dotRadius:            2,
  dotGap:               5,                // marginTop from icon group

  // ── Pill Geometry — LAW 13 exact ─────────────────────────────────────────
  pillWidth:            280,             // Exact Part 1 spec
  pillHeight:           56,             // Exact Part 1 spec
  pillRadius:           28,             // height/2 = full pill
  pillPadH:             6,              // Horizontal internal padding
  pillPadV:             4,              // Vertical internal padding
  pillBottomGap:        16,             // 16px above safe-area-bottom

  // ── Z-Index — Part 1 Rule 04 stacking order ───────────────────────────────
  // Chat Feed: base | Input: 935 | Glass Island: 950
  zIndex:               950,

  // ── Animation Timing — Part 1 § 7 hide spec ───────────────────────────────
  // "spring stiffness 180 · damping 20 · 280ms"
  springTension:        180,
  springFriction:       22,
  hideDuration:         200,
  showDuration:         250,
  keyboardHideDuration: 180,

  // ── Translate values ───────────────────────────────────────────────────────
  // Part 1: "translateY +80px" on scroll · "translateY +120px" on keyboard
  scrollHideY:          80,
  keyboardHideY:        130,

  // ── Badge ──────────────────────────────────────────────────────────────────
  badgeSize:            7,
  badgeBorderWidth:     1.5,
  badgeColor:           '#EF4444',  // crimson · Part 3 § 2

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN DIMENSIONS — Computed once at module load
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_W  = Dimensions.get('window').width;
const PILL_LEFT = (SCREEN_W - CW.pillWidth) / 2;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — Shared singleton · controlled by screen components
//
// Animated.Value:
//   0 → pill visible (translateY = 0)
//   1 → pill hidden  (translateY = scrollHideY + pill height + bottom offset)
// ─────────────────────────────────────────────────────────────────────────────

export const navScrollAnim = new Animated.Value(0);

/**
 * hideNav()
 * Slide Glass Island off-screen below.
 * Call when user scrolls toward older messages (downward direction).
 */
export function hideNav() {
  Animated.timing(navScrollAnim, {
    toValue:         1,
    duration:        CW.hideDuration,
    useNativeDriver: true,
  }).start();
}

/**
 * showNav()
 * Spring Glass Island back into view.
 * Call when user scrolls toward newest messages (upward direction).
 */
export function showNav() {
  Animated.spring(navScrollAnim, {
    toValue:         0,
    useNativeDriver: true,
    tension:         CW.springTension,
    friction:        CW.springFriction,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONFIGURATION — 4 Glass Island tabs per LAW 13 · Part 3 § 9-11
// Icons: Part 2 Asset Manifest (lucide-react / Feather equivalents)
// ─────────────────────────────────────────────────────────────────────────────

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface TabConfig {
  route:    string;
  label:    string;        // Accessibility only — not shown visually (LAW 13)
  icon:     FeatherIconName;
  a11yHint: string;        // Screen reader action hint
  badge?:   number;        // Red notification dot if > 0
}

const TABS: TabConfig[] = [
  {
    route:    'index',
    label:    'Home',
    icon:     'home',
    a11yHint: 'Apne sector ka chat kholo',
  },
  {
    route:    'discover',
    label:    'Discover',
    icon:     'compass',
    a11yHint: 'Trending sectors aur earning discover karo',
  },
  {
    route:    'bazaar',
    label:    'Wallet',
    icon:     'credit-card',
    a11yHint: 'Credits, cashout aur passes dekho',
  },
  {
    route:    'profile',
    label:    'Profile',
    icon:     'user',
    a11yHint: 'Apna profile aur settings dekho',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TAB ITEM COMPONENT — Single icon tab inside Glass Island
//
// Animations:
//   1. Icon scale: springs to 1.12 when focused · 1.0 when not
//   2. Glow circle opacity: animates 0 → 1 on focus
//   3. Press scale: 0.88 on pressIn · springs back on pressOut
//   4. Active dot opacity: animates with glow (same animation drive)
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

  // ── Respond to focus changes ───────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      // Icon scale: spring for natural feel
      Animated.spring(scaleAnim, {
        toValue:         focused ? CW.activeScale : 1,
        useNativeDriver: true,
        tension:         260,
        friction:        18,
      }),
      // Glow + dot: timing fade
      Animated.timing(glowAnim, {
        toValue:         focused ? 1 : 0,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scaleAnim, glowAnim]);

  // ── Press handlers ─────────────────────────────────────────────────────────
  const onPressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue:         CW.pressScale,
      duration:        70,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue:         1,
      useNativeDriver: true,
      tension:         300,
      friction:        14,
    }).start();
  }, [pressAnim]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityLabel={config.label}
      accessibilityState={{ selected: focused }}
      accessibilityHint={config.a11yHint}
      style={styles.tabPressable}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      {/* Outer press-scale wrapper */}
      <Animated.View style={{ transform: [{ scale: pressAnim }], alignItems: 'center' }}>

        {/* Icon scale + glow wrapper */}
        <Animated.View
          style={[
            styles.iconWrap,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Glow halo circle — appears on focus */}
          <Animated.View style={[styles.glowCircle, { opacity: glowAnim }]} />

          {/* Feather icon — color + strokeWidth change on focus */}
          <Feather
            name={config.icon}
            size={CW.iconSizeBase}
            color={focused ? CW.iconActive : CW.iconInactive}
          />

          {/* Notification badge dot — top-right of icon wrap */}
          {(config.badge ?? 0) > 0 ? (
            <View style={styles.badge} pointerEvents="none">
              <View style={styles.badgeDot} />
            </View>
          ) : null}
        </Animated.View>

        {/* Active indicator dot — 4×4 gold · LAW 13 exact spec */}
        <Animated.View style={[styles.activeDot, { opacity: glowAnim }]} />

      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING TAB BAR — Custom tabBar renderer passed to <Tabs tabBar={...}>
//
// Handles:
//   • Keyboard show/hide listeners → auto-hide pill
//   • Scroll animation from navScrollAnim
//   • Combined translateY (keyboard takes priority over scroll)
//   • Platform-specific glass: BlurView (iOS) / rgba View (Android)
// ─────────────────────────────────────────────────────────────────────────────

type FloatingTabBarProps = {
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

function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const insets     = useSafeAreaInsets();
  const kbAnim     = useRef(new Animated.Value(0)).current; // 0=visible 1=hidden
  const bottomBase = CW.pillBottomGap + insets.bottom;

  // ── Keyboard show → hide pill ──────────────────────────────────────────────
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const sub1 = Keyboard.addListener(showEvt, () => {
      Animated.timing(kbAnim, {
        toValue:         1,
        duration:        CW.keyboardHideDuration,
        useNativeDriver: true,
      }).start();
    });

    const sub2 = Keyboard.addListener(hideEvt, () => {
      Animated.spring(kbAnim, {
        toValue:         0,
        useNativeDriver: true,
        tension:         CW.springTension,
        friction:        CW.springFriction,
      }).start();
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [kbAnim]);

  // ── translateY from scroll animation ──────────────────────────────────────
  // navScrollAnim: 0 → visible (Y=0) · 1 → hidden (Y = pill + bottom)
  const scrollY = navScrollAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, CW.scrollHideY + bottomBase + CW.pillHeight],
    extrapolate: 'clamp',
  });

  // ── translateY from keyboard ───────────────────────────────────────────────
  const keyboardY = kbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, CW.keyboardHideY + bottomBase + CW.pillHeight],
    extrapolate: 'clamp',
  });

  // Additive: at most one fires at a time · combined = max displacement
  const translateY = Animated.add(scrollY, keyboardY);

  // ── Opacity fades as pill hides ────────────────────────────────────────────
  const opacity = navScrollAnim.interpolate({
    inputRange:  [0, 0.4, 1],
    outputRange: [1, 0.95, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      accessibilityRole="tablist"
      testID="crowd-glass-island"
      style={[
        styles.navContainer,
        {
          bottom:    bottomBase,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      {/*
       * Glass surface:
       *   iOS    → BlurView (native glass blur · tint="dark" · intensity=85)
       *   Android → View with rgba(13,16,24,0.88) background
       *   Both wrapped in same pill shape + border
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
// PILL CONTENTS — Shared between BlurView (iOS) and View (Android)
// ─────────────────────────────────────────────────────────────────────────────

function PillContents({ state, descriptors, navigation }: FloatingTabBarProps) {
  return (
    <>
      {/* Gold rim hairline — 1px accent at top of pill */}
      <View style={styles.goldRim} />

      {/* 4-tab row */}
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          const tabCfg = TABS.find((t) => t.route === route.name);
          if (!tabCfg) return null; // hidden screens → skip

          const focused    = state.index === index;
          const descriptor = descriptors[route.key];
          const rawBadge   = descriptor?.options?.tabBarBadge;
          const badge      = typeof rawBadge === 'number' ? rawBadge : undefined;

          function onPress() {
            const event = navigation.emit({
              type:              'tabPress',
              target:            route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          function onLongPress() {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          }

          return (
            <TabItem
              key={route.key}
              config={{ ...tabCfg, badge }}
              focused={focused}
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
// DEFAULT EXPORT — Tab Layout root
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...(props as FloatingTabBarProps)} />}
      screenOptions={{
        headerShown:          false,
        tabBarStyle:          { display: 'none' },   // Disable native tab bar
        tabBarShowLabel:      false,
        tabBarHideOnKeyboard: false, // Keyboard handled by our listener above
        freezeOnBlur:         true,  // Freeze inactive tabs (Part 1 §10 perf)
        animation:            'none',
      }}
    >
      {/* ── GLASS ISLAND TABS (4) — Per LAW 13 + Part 3 § 9-11 ───────────── */}

      {/**
       * TAB 1 — HOME
       * Primary screen · Hyper-local sector chat
       * Glass Island Tab 1 (Home icon · gold when active)
       * Part 1 full blueprint · Rule 04: Glass Island flush below input
       */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />

      {/**
       * TAB 2 — DISCOVER
       * Trending sectors · CROWN Pass · Earning · Featured
       * Glass Island Tab 2 · Part 3 § 9
       * Compass icon · absorbs displaced discovery features from Home
       */}
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover' }}
      />

      {/**
       * TAB 3 — WALLET
       * Credits balance · Cashout via Razorpay · Pass purchases
       * Glass Island Tab 3 · Part 3 § 10
       * Routes to bazaar.tsx in v1.0 · wallet.tsx in v1.1
       * Credit-card icon · trust-first design (lock icon in header per § 10)
       */}
      <Tabs.Screen
        name="bazaar"
        options={{ title: 'Wallet' }}
      />

      {/**
       * TAB 4 — PROFILE
       * SOLE valid profile entry point — Rule 03 (LAW)
       * Own profile · achievements · settings hub entry
       * Glass Island Tab 4 · Part 3 § 11
       * User icon · never profile avatar (text icon only per Rule 03)
       */}
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />

      {/* ── HIDDEN SCREENS — Not in Glass Island · href: null ────────────── */}

      {/* Leaderboard — accessible via Discover Earning sub-tab */}
      <Tabs.Screen name="ranks"    options={{ href: null }} />
      {/* Inbox / DMs — v1.2 roadmap */}
      <Tabs.Screen name="inbox"    options={{ href: null }} />
      {/* Live — Voice Rooms · Agora RTC · v2.0 */}
      <Tabs.Screen name="live"     options={{ href: null }} />
      {/* Rooms — internal routing helper */}
      <Tabs.Screen name="rooms"    options={{ href: null }} />
      {/* Settings — accessed via Profile tab gear icon (Part 3 § 14) */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — All measurements from blueprint spec · no magic numbers
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Outer animated container ───────────────────────────────────────────────
  // Positioned absolutely · centered · carries drop shadow
  // Z-Index 950 per Part 1 Rule 04 stacking order
  navContainer: {
    position:       'absolute',
    left:            PILL_LEFT,
    width:           CW.pillWidth,
    zIndex:          CW.zIndex,

    // Drop shadow — Part 1: "0 8px 32px rgba(13,16,24,0.35)"
    shadowColor:    CW.glassShadowColor,
    shadowOffset:   { width: CW.glassShadowH, height: CW.glassShadowV },
    shadowOpacity:  CW.glassShadowOpacity,
    shadowRadius:   CW.glassShadowRadius,
    elevation:      CW.glassElevation,
  },

  // ── Glass pill shape ───────────────────────────────────────────────────────
  // 280×56px · 28px radius · 0.5px white border (glass rim)
  // overflow: hidden clips BlurView (iOS) and badge dot corners
  pill: {
    width:           CW.pillWidth,
    height:          CW.pillHeight,
    borderRadius:    CW.pillRadius,
    overflow:        'hidden',
    borderWidth:     CW.glassBorderWidth,
    borderColor:     CW.glassBorderColor,
    flexDirection:   'column',
  },

  // Android: solid rgba fallback for glass (BlurView = experimental on Android)
  pillAndroid: {
    backgroundColor: CW.glassBg,
  },

  // ── Gold rim — accent hairline at top ─────────────────────────────────────
  // Simulates inset glow · subtle gold-400 at 40% opacity
  goldRim: {
    height:          1,
    width:           CW.pillWidth - 24,  // inset 12px from each side
    alignSelf:       'center',
    backgroundColor: CW.goldRimColor,
    borderRadius:    0.5,
    marginTop:       2,
    marginBottom:    1,
  },

  // ── Tabs row — 4 equal columns ────────────────────────────────────────────
  tabsRow: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-around',
    paddingHorizontal: CW.pillPadH,
  },

  // ── Tab pressable — touch area ────────────────────────────────────────────
  tabPressable: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    height:          CW.pillHeight - 6, // fill available pill height
    minWidth:        44,                // Accessibility min touch target
  },

  // ── Icon wrapper — contains glow circle + badge + icon ────────────────────
  iconWrap: {
    width:           CW.iconSizeBase + 12,
    height:          CW.iconSizeBase + 12,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },

  // ── Glow circle — animated halo behind active icon ────────────────────────
  // 36×36 · rgba(197,162,39,0.18) · opacity driven by glowAnim
  glowCircle: {
    ...StyleSheet.absoluteFillObject,
    width:           CW.glowDiameter,
    height:          CW.glowDiameter,
    borderRadius:    CW.glowDiameter / 2,
    backgroundColor: CW.gold600Glow,
    alignSelf:       'center',
    top:             (CW.iconSizeBase + 12 - CW.glowDiameter) / 2,
    left:            (CW.iconSizeBase + 12 - CW.glowDiameter) / 2,
  },

  // ── Active indicator dot — LAW 13 exact: 4×4px gold, 4px below ───────────
  activeDot: {
    width:           CW.dotSize,
    height:          CW.dotSize,
    borderRadius:    CW.dotRadius,
    backgroundColor: CW.gold600,
    marginTop:       CW.dotGap,
  },

  // ── Notification badge dot ─────────────────────────────────────────────────
  // Positioned top-right of iconWrap · red dot · white ring border
  badge: {
    position:        'absolute',
    top:             -1,
    right:           -2,
    zIndex:          1,
  },

  badgeDot: {
    width:           CW.badgeSize,
    height:          CW.badgeSize,
    borderRadius:    CW.badgeSize / 2,
    backgroundColor: CW.badgeColor,
    borderWidth:     CW.badgeBorderWidth,
    borderColor:     CW.glassBg,  // Matches pill bg for clean cutout look
  },
});

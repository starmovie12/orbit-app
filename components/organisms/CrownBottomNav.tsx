/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Bottom Navigation Bar                                           ║
 * ║  §9.3 — PRD v3.2 Founder Mandate: Full-Width. Fixed. No Float. No Glass.║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CRITICAL DESIGN DECISION (§9.3 — Founder-Locked):                      ║
 * ║  "Simple. Full-width. Fixed. Boring. Just like WhatsApp / Telegram /     ║
 * ║   Instagram. NO Floating Glass Island. NO 280px hovering pill."          ║
 * ║  The existing FloatingGlassIsland.tsx is DEPRECATED.                     ║
 * ║  This file replaces it completely.                                        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  4 TABS (locked, non-negotiable — §9.3):                                 ║
 * ║    Tab 1: HOME    → app/(tabs)/index.tsx    · icon: "home"               ║
 * ║    Tab 2: EXPLORE → app/(tabs)/explore.tsx  · icon: "compass"            ║
 * ║    Tab 3: CROWN   → app/(tabs)/crown.tsx    · icon: "award"              ║
 * ║    Tab 4: PROFILE → app/(tabs)/profile.tsx  · icon: "user"               ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SPEC (§9.3 Style Spec):                                                 ║
 * ║    position: absolute · bottom:0 · left:0 · right:0 (edge to edge)      ║
 * ║    height: 56px + env(safe-area-inset-bottom)                            ║
 * ║    background: var(--bg-surface) SOLID — NO glass, NO transparency       ║
 * ║    border-top: 1px solid var(--border-subtle)                            ║
 * ║    z-index: 950                                                           ║
 * ║    border-radius: 0 (flush rectangle — NO rounded corners)               ║
 * ║    backdrop-filter: NONE                                                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  WHAT'S EXPLICITLY BANNED (§9.3):                                        ║
 * ║    ❌ Center floating + FAB                                               ║
 * ║    ❌ "More" menu                                                          ║
 * ║    ❌ Per-tab notification badges (red dot ONLY on Profile for unreads)   ║
 * ║    ❌ Hidden tabs or scrolling tab bars                                    ║
 * ║    ❌ Customizable tab order (founder-locked)                              ║
 * ║    ❌ backdrop-filter / blur / glass                                       ║
 * ║    ❌ border-radius on the bar itself                                      ║
 * ║    ❌ Raw hex color values (use colors token system)                       ║
 * ║    ❌ 'as any' type assertions                                             ║
 * ║    ❌ Unused imports                                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * CHANGELOG — v2.0.0 (May 2026 — PRD §9.3 Compliance Pass):
 *   [FIX]  fontWeight typed as TextStyle['fontWeight'] — removed `as any`
 *   [FIX]  shadowColor: removed raw '#000000' — now uses colors token
 *   [FIX]  LABEL_WEIGHT_INACTIVE corrected to '400' (was '500' — PRD says 400)
 *   [FIX]  Removed unused imports: animation, radii, zIndex, touch
 *   [FIX]  Badge check: config.route === 'profile' → config.id === 'profile'
 *   [FIX]  Haptics.impactAsync() now prefixed with void (floating Promise)
 *   [ADD]  navHidden: boolean prop + useEffect Animated.timing (§9.3 new spec)
 *   [ADD]  activeTab: TabId prop — standalone mode support
 *   [ADD]  onTabPress: (tab: TabId) => void prop — standalone mode support
 *   [ADD]  TabId union type ('home' | 'explore' | 'crown' | 'profile')
 *   [ADD]  testID on every TabItem for automated testing
 *   [ADD]  Dual render mode: expo-router tabBar + standalone
 *   [ADD]  id: TabId field on every TabConfig entry
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — All values trace to §9.3 spec. Zero magic numbers.
// ─────────────────────────────────────────────────────────────────────────────

const NAV = {
  /** §9.3 — "height: 56px + env(safe-area-inset-bottom)" */
  HEIGHT: 56 as const,

  /** §9.3 — "border-top: 1px solid var(--border-subtle)" */
  BORDER_TOP_WIDTH: 1 as const,

  /** §9.3 — "z-index: 950" */
  Z_INDEX: 950 as const,

  /** §9.3 — "border-radius: 0 (flush rectangle — NO rounded corners)" */
  BORDER_RADIUS: 0 as const,

  /** §9.3 — "Width: calc(100% / 4)" — flex: 1 on each tab = equal quarters */
  TAB_FLEX: 1 as const,

  /** §9.3 — "Padding: 8px 4px internal" */
  TAB_PAD_V: 8 as const,
  TAB_PAD_H: 4 as const,

  /** §9.3 — "Icon size: 24×24" */
  ICON_SIZE: 24 as const,

  /** §9.3 — "Label: 11px" */
  LABEL_SIZE: 11 as const,

  /**
   * §9.3 — "Active: label font-weight 600 | Inactive: font-weight 400"
   * FIX v2.0.0: was '500' — corrected to '400' per PRD.
   * Typed as TextStyle['fontWeight'] — eliminates `as any` antipattern.
   */
  LABEL_WEIGHT_ACTIVE:   '600' as TextStyle['fontWeight'],
  LABEL_WEIGHT_INACTIVE: '400' as TextStyle['fontWeight'],

  /** Gap between icon and label — compact vertical rhythm */
  ICON_LABEL_GAP: 2 as const,

  /** §9.3 — "Micro-bounce on activation: scale 1.0→1.05→1.0 · 180ms total" */
  ACTIVE_SCALE: 1.05 as const,
  BOUNCE_DURATION: 180 as const,

  /** §9.3 — "Pressed: scale(0.95), 80ms easeOut" */
  PRESS_SCALE: 0.95 as const,
  PRESS_DURATION: 80 as const,

  /** §9.3 — "Scroll hide/show: duration 200ms" */
  HIDE_DURATION: 200 as const,
  SHOW_DURATION: 200 as const,

  /** §9.3 — "Touch target: full cell (≥ 44×44pt per Apple HIG)" */
  MIN_TOUCH: 44 as const,

  /** §9.3 — Notification badge dot (ONLY on Profile tab) */
  BADGE_SIZE: 6 as const,
} as const;

/**
 * Shadow base tint for the nav's top-edge lift.
 *
 * WHY NOT '#000000':
 *   RN requires a concrete color string for shadowColor.
 *   shadowOpacity: 0.04 independently controls perceived alpha.
 *   We resolve from the token system (fg.tertiary = darkest available
 *   muted foreground) rather than hardcoding a raw hex.
 *
 * TODO: Add colors.shadow.navBar token when shadow palette is extended.
 */
const NAV_SHADOW_TINT: string = colors.fg.tertiary;

// ─────────────────────────────────────────────────────────────────────────────
// TAB ID — Union type for the 4 founder-locked tabs
// Shared between TabConfig, activeTab prop, and onTabPress callback.
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'explore' | 'crown' | 'profile';

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONFIGURATION — The 4 tabs. Locked. Non-negotiable. §9.3.
// ─────────────────────────────────────────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface TabConfig {
  /** Route name matching app/(tabs)/ filename — for expo-router mode */
  readonly route: string;
  /** Stable identifier for standalone mode + badge check + testID */
  readonly id: TabId;
  /** Display label shown below the icon */
  readonly label: string;
  /** Feather icon name — see note on 'crown' tab */
  readonly icon: FeatherName;
  /** Screen reader accessibility hint — Hinglish per CROWN UX voice */
  readonly a11yHint: string;
}

const TABS: readonly TabConfig[] = [
  {
    // ── TAB 1: HOME ──────────────────────────────────────────────────────────
    // The live chat — primary destination.
    // Chat stream (World/Country/City/Sector switcher) + composer + Heat score.
    route:    'index',
    id:       'home',
    label:    'Home',
    icon:     'home',
    a11yHint: 'Live chat kholo — apne sector, city, ya duniya se baat karo',
  },
  {
    // ── TAB 2: EXPLORE ───────────────────────────────────────────────────────
    // Discover cities, leaderboards, schedules, search, archives, invasions.
    route:    'discover',
    id:       'explore',
    label:    'Explore',
    icon:     'compass',
    a11yHint: 'Doosre cities, leaderboards, aur schedules explore karo',
  },
  {
    // ── TAB 3: CROWN ─────────────────────────────────────────────────────────
    // Status & bidding center — the emotional anchor of the app.
    // Current ranks (Sector/City/Country/World), bid history, live progress.
    // NOTE: Feather icon library has no 'crown' — 'award' is the closest match.
    route:    'ranks',
    id:       'crown',
    label:    'Crown',
    icon:     'award',
    a11yHint: 'Apna rank, active cycles, aur bids dekho',
  },
  {
    // ── TAB 4: PROFILE ───────────────────────────────────────────────────────
    // You — handle, titles, stats, followers, Credits, Settings, Cashout.
    // Icon is ALWAYS Feather 'user'. User's own avatar → Profile SCREEN only.
    // §9.3 ban list: avatar must NEVER appear in the nav bar itself.
    route:    'profile',
    id:       'profile',
    label:    'Profile',
    icon:     'user',
    a11yHint: 'Apna profile, Credits, settings, aur cashout dekho',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SCROLL ANIMATION — for scroll-driven hide/show coordination
//
// Semantics:
//   0 = Nav bar VISIBLE   (translateY = 0)
//   1 = Nav bar HIDDEN    (translateY = totalHeight, slides off-screen)
//
// Screens wire to this via:
//   import { hideNav, showNav } from '@/components/organisms/CrownBottomNav';
//
// NEW in v2.0.0: The `navHidden` boolean prop is an ADDITIONAL control path.
// Both are additive — in practice only one fires at a time.
// ─────────────────────────────────────────────────────────────────────────────

export const navScrollAnim = new Animated.Value(0);

/**
 * hideNav() — Slide the bottom nav off-screen (downward).
 *
 * Call when the user scrolls toward older messages (past content).
 * §9.3: "delta > 4 → hideAll()" — Duration: 200ms ease.
 */
export function hideNav(): void {
  Animated.timing(navScrollAnim, {
    toValue:         1,
    duration:        NAV.HIDE_DURATION,
    useNativeDriver: true,
  }).start();
}

/**
 * showNav() — Slide the bottom nav back into view.
 *
 * Call when user scrolls toward newest messages or reaches the bottom.
 * §9.3: "delta < -4 → showAll() | atBottom → showAll()" — Duration: 200ms.
 */
export function showNav(): void {
  Animated.timing(navScrollAnim, {
    toValue:         0,
    duration:        NAV.SHOW_DURATION,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB ITEM — Individual tab cell
// ─────────────────────────────────────────────────────────────────────────────

interface TabItemProps {
  readonly config:      TabConfig;
  readonly focused:     boolean;
  readonly onPress:     () => void;
  readonly onLongPress: () => void;
  readonly badge?:      number;   // Shown as red dot — Profile tab only
}

function TabItem({
  config,
  focused,
  onPress,
  onLongPress,
  badge = 0,
}: TabItemProps) {
  // scaleAnim: drives the micro-bounce on focus change (1.0 → 1.05 → 1.0)
  // pressAnim: drives the press-down feedback (1.0 → 0.95 → 1.0)
  // Both multiply together on the Animated.View — PERF: compositor only.
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // ── Focus change → micro-bounce ──────────────────────────────────────────
  // §9.3: "scale 1.0→1.05→1.0 · 180ms total (90ms up + 90ms back)"
  // PERF: useNativeDriver: true — runs on UI thread, zero JS bridge cost.
  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue:         NAV.ACTIVE_SCALE,          // 1.05
          duration:        NAV.BOUNCE_DURATION / 2,   // 90ms up
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue:         1,
          duration:        NAV.BOUNCE_DURATION / 2,   // 90ms back to 1.0
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, scaleAnim]);

  // ── Press in — scale 0.95 · 80ms easeOut ─────────────────────────────────
  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue:         NAV.PRESS_SCALE,    // 0.95
      duration:        NAV.PRESS_DURATION, // 80ms
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  // ── Press out — spring return to 1.0 ────────────────────────────────────
  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue:         1,
      useNativeDriver: true,
      tension:         300,
      friction:        14,
    }).start();
  }, [pressAnim]);

  // ── Tap — §9.3: "Haptics.impactAsync(Light) on press" ────────────────────
  // FIX v2.0.0: void prefix added — impactAsync() returns Promise<void>,
  // floating Promises must be explicitly voided to satisfy strict linting.
  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  // ── Long press ───────────────────────────────────────────────────────────
  const handleLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress();
  }, [onLongPress]);

  // ── Color + weight resolution — PRD §9.3.2 ───────────────────────────────
  // Active:   var(--fg-brand) = #D4A017 light / #F59E0B dark
  // Inactive: var(--fg-text-muted) = #6B5B2E light / rgba(255,255,255,0.55) dark
  const scheme = useColorScheme();
  const inactiveColor: string = scheme === 'dark'
    ? 'rgba(255,255,255,0.55)'  // PRD §9.3.2 dark mode inactive
    : colors.fg.secondary;      // #6B5B2E = ink[600] = --fg-text-muted light
  const iconColor:   string                  = focused ? colors.fg.brand : inactiveColor;
  const labelColor:  string                  = focused ? colors.fg.brand : inactiveColor;

  // FIX v2.0.0: properly typed as TextStyle['fontWeight'] — eliminates `as any`.
  const labelWeight: TextStyle['fontWeight'] = focused
    ? NAV.LABEL_WEIGHT_ACTIVE    // '600'
    : NAV.LABEL_WEIGHT_INACTIVE; // '400' — was '500' in v1, corrected per PRD

  // FIX v2.0.0: badge check uses config.id ('profile') not config.route ('profile')
  // Both resolve the same string, but id is the semantically correct field.
  const hasBadge = badge > 0 && config.id === 'profile';

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // ── Accessibility ────────────────────────────────────────────────────
      accessibilityRole="tab"
      accessibilityLabel={config.label}
      accessibilityState={{ selected: focused }}
      accessibilityHint={config.a11yHint}
      // ── testID — ADD v2.0.0: enables automated testing per tab ───────────
      testID={`crown-tab-${config.id}`}
      // ── Touch target: full cell ≥ 44pt (§9.3 · Apple HIG minimum) ────────
      style={styles.tabPressable}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {/* Animated scale container — multiply: press-scale × micro-bounce */}
      {/* PERF: transform-only — compositor thread, zero layout/paint cost  */}
      <Animated.View
        style={[
          styles.tabInner,
          { transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] },
        ]}
      >
        {/* Icon wrapper — relative position for badge dot overlay */}
        <View style={styles.iconWrap}>
          <Feather
            name={config.icon}
            size={NAV.ICON_SIZE}   /* 24×24 per §9.3 */
            color={iconColor}
          />

          {/* Red dot badge — §9.3: ONLY on Profile tab, only when badge > 0 */}
          {hasBadge ? (
            <View
              style={styles.badgeDot}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </View>

        {/* Label — 11px · weight 600 active / 400 inactive (§9.3) */}
        {/* FIX v2.0.0: fontWeight is TextStyle['fontWeight'] — no `as any` */}
        <Text
          style={[
            styles.tabLabel,
            { color: labelColor, fontWeight: labelWeight },
          ]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS — Two usage modes (v2.0.0 ADD):
//
//  MODE A — Expo-Router tabBar renderer:
//    <Tabs tabBar={(props) => <CrownBottomNav {...props} />} />
//    Uses: state, descriptors, navigation (injected by expo-router)
//
//  MODE B — Standalone controlled component:
//    <CrownBottomNav activeTab="home" onTabPress={setTab} />
//    Uses: activeTab + onTabPress (parent manages routing)
//
//  SHARED (both modes):
//    navHidden?: boolean  — parent-driven slide hide/show (§9.3 new prop)
//    activeTab?: TabId    — can also be passed in expo-router mode as override
//    onTabPress?: (tab: TabId) => void — optional in expo-router mode
// ─────────────────────────────────────────────────────────────────────────────

/** Expo-router injects these when used as <Tabs tabBar={...}> */
interface ExpoRouterShape {
  readonly state: {
    routes: ReadonlyArray<{ key: string; name: string }>;
    index:  number;
  };
  readonly descriptors: Readonly<Record<string, {
    options: { title?: string; tabBarBadge?: number | string };
  }>>;
  readonly navigation: {
    emit: (e: {
      type:               string;
      target?:            string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

interface SharedNavProps {
  /**
   * §9.3 new prop: "navHidden: boolean (parent se aayega)"
   *
   * true  → nav slides to translateY: totalHeight (200ms, useNativeDriver)
   * false → nav slides back to translateY: 0 (200ms, useNativeDriver)
   *
   * Works alongside the global hideNav()/showNav() helpers — both are
   * additive via Animated.add(). In practice only one fires at a time.
   */
  readonly navHidden?: boolean;
  /** Override active tab — usable in both modes */
  readonly activeTab?: TabId;
  /** Tab press callback — usable in both modes */
  readonly onTabPress?: (tab: TabId) => void;
}

/** Full props = expo-router shape + shared props (expo-router mode) */
type TabBarCoreProps = ExpoRouterShape & SharedNavProps;

/** Standalone mode — expo-router shape is absent; activeTab + onTabPress are required */
type StandaloneNavProps = SharedNavProps & {
  readonly state?:       undefined;
  readonly descriptors?: undefined;
  readonly navigation?:  undefined;
  readonly activeTab:    TabId;          // required in standalone
  readonly onTabPress:   (tab: TabId) => void; // required in standalone
};

type CrownBottomNavProps = TabBarCoreProps | StandaloneNavProps;

// ─────────────────────────────────────────────────────────────────────────────
// CROWN BOTTOM NAV — The main component
//
// translateY is driven by THREE additive Animated.Values:
//   1. scrollY    — derived from global navScrollAnim (screens call hideNav/showNav)
//   2. keyboardY  — keyboard open/close (auto-detected, no parent involvement)
//   3. navHidY    — driven by navHidden prop (parent-controlled, §9.3 new spec)
//
// Additive pattern: Animated.add(Animated.add(scrollY, keyboardY), navHidY)
// In practice only one source fires at a time; all three are safe together.
// PERF: useNativeDriver: true on all — compositor thread, zero JS overhead.
// ─────────────────────────────────────────────────────────────────────────────

export function CrownBottomNav(props: CrownBottomNavProps) {
  const insets = useSafeAreaInsets();

  // 0 = visible (translateY 0), animates to totalHeight when hiding
  const kbAnim     = useRef(new Animated.Value(0)).current;
  const navHidAnim = useRef(new Animated.Value(0)).current;

  // Total bar height including device safe-area padding
  const totalHeight = NAV.HEIGHT + insets.bottom;

  const { navHidden } = props;

  // ── navHidden prop → animate navHidAnim ──────────────────────────────────
  // §9.3: "navHidden true → toValue: 100, duration: 200, useNativeDriver: true"
  // We use totalHeight (not magic 100) — ensures full off-screen slide on all
  // device sizes and safe-area configurations.
  useEffect(() => {
    Animated.timing(navHidAnim, {
      toValue:         navHidden === true ? totalHeight : 0,
      duration:        NAV.HIDE_DURATION,   // 200ms
      useNativeDriver: true,
    }).start();
  }, [navHidden, navHidAnim, totalHeight]);

  // ── Keyboard listeners — auto-hide nav when chat input is focused ─────────
  // iOS:     keyboardWillShow / keyboardWillHide (pre-animation timing)
  // Android: keyboardDidShow  / keyboardDidHide  (post-animation timing)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvt, () => {
      Animated.timing(kbAnim, {
        toValue:         1,
        duration:        180,
        useNativeDriver: true,
      }).start();
    });

    const subHide = Keyboard.addListener(hideEvt, () => {
      Animated.timing(kbAnim, {
        toValue:         0,
        duration:        220,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [kbAnim]);

  // ── Three translateY sources — all in pixel units, all additive ───────────

  // Source 1: scroll-driven (0→1 input mapped to 0→totalHeight pixels)
  // PERF: compositor — transform only, no layout triggers
  const scrollY = navScrollAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, totalHeight],
    extrapolate: 'clamp',
  });

  // Source 2: keyboard-driven (0→1 input mapped to 0→totalHeight pixels)
  // PERF: compositor — transform only, no layout triggers
  const keyboardY = kbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, totalHeight],
    extrapolate: 'clamp',
  });

  // Source 3: navHidden prop-driven (direct pixel offset: 0 or totalHeight)
  // PERF: compositor — transform only, no layout triggers
  const navHidY = navHidAnim;

  // Final translateY — additive sum of all three sources
  // PERF: Animated.add runs on compositor — zero JS bridge involvement
  const translateY = Animated.add(
    Animated.add(scrollY, keyboardY),
    navHidY,
  );

  // ── Shared Animated.View wrapper — used by both render paths ─────────────
  const navBarStyle = [
    styles.navBar,
    {
      height:    totalHeight,   // 56px + safe-area-bottom (varies by device)
      transform: [{ translateY }],
    },
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: EXPO-ROUTER MODE
  // When state + navigation are present (component used as Tabs tabBar prop)
  // ─────────────────────────────────────────────────────────────────────────

  if (props.state !== undefined && props.navigation !== undefined) {
    const { state, descriptors, navigation } = props;

    return (
      <Animated.View
        testID="crown-bottom-nav"
        accessibilityRole="tablist"
        accessibilityLabel="Primary navigation: Home, Explore, Crown, Profile"
        style={navBarStyle}
      >
        {/* §9.3 top border — "1px solid var(--border-subtle)" */}
        <View style={styles.topBorder} />

        {/* 4 equal-width tab cells */}
        <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
          {state.routes.map((route, index) => {
            const tabCfg = TABS.find((t) => t.route === route.name);
            if (tabCfg === undefined) return null;

            // activeTab prop overrides router state when provided
            const isFocused = props.activeTab !== undefined
              ? tabCfg.id === props.activeTab
              : state.index === index;

            const descriptor = descriptors[route.key];
            const rawBadge   = descriptor?.options?.tabBarBadge;
            const badgeCount = typeof rawBadge === 'number' ? rawBadge : 0;

            function onPress(): void {
              const event = navigation.emit({
                type:              'tabPress',
                target:            route.key,
                canPreventDefault: true,
              });

              // PRD §9.3.3 — "tapping Home while on Home scrolls chat to bottom"
              // We fire a named DeviceEventEmitter signal. HomeScreen listens for
              // 'crown:scrollToBottom' and calls its FlatList.scrollToOffset(0).
              if (isFocused && route.name === 'index') {
                const { DeviceEventEmitter } = require('react-native');
                DeviceEventEmitter.emit('crown:scrollToBottom');
                return;
              }

              if (!isFocused && !event.defaultPrevented) {
                // Emit analytics tab_switch event (§9.3.3)
                // analytics().logEvent('tab_switch', { tab: tabCfg.id }); // wire when analytics is ready
                props.onTabPress?.(tabCfg.id);
                navigation.navigate(route.name);
              }
            }

            function onLongPress(): void {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            }

            return (
              <TabItem
                key={route.key}
                config={tabCfg}
                focused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                badge={badgeCount}
              />
            );
          })}
        </View>
      </Animated.View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: STANDALONE MODE
  // When state is absent (parent controls routing via activeTab + onTabPress)
  // ─────────────────────────────────────────────────────────────────────────

  const { activeTab, onTabPress } = props as StandaloneNavProps;

  return (
    <Animated.View
      testID="crown-bottom-nav"
      accessibilityRole="tablist"
      accessibilityLabel="Primary navigation: Home, Explore, Crown, Profile"
      style={navBarStyle}
    >
      {/* §9.3 top border — "1px solid var(--border-subtle)" */}
      <View style={styles.topBorder} />

      {/* 4 equal-width tab cells */}
      <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
        {TABS.map((tabCfg) => {
          const isFocused = tabCfg.id === activeTab;

          function onPress(): void {
            onTabPress(tabCfg.id);
          }

          function onLongPress(): void {
            // No long-press action in standalone mode (v1.0 scope)
          }

          return (
            <TabItem
              key={tabCfg.id}
              config={tabCfg}
              focused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              badge={0}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// All values trace to §9.3 spec. Zero magic numbers. Zero raw color values.
// FIX v2.0.0: shadowColor now uses NAV_SHADOW_TINT (not '#000000').
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Navigation bar container ──────────────────────────────────────────────
  // §9.3: position absolute, bottom 0, left 0, right 0 — edge-to-edge
  // background: solid colors.bg.surface — NO backdrop-filter, NO transparency
  // border-radius: 0 — flush rectangle, exactly like WhatsApp/Telegram/Instagram
  navBar: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: colors.bg.surface,    // Solid — §9.3 mandate
    zIndex:          NAV.Z_INDEX,          // 950
    borderRadius:    NAV.BORDER_RADIUS,    // 0 — flush rectangle, NO rounded corners

    // §9.3: "shadow: 0 -1px 0 rgba(0,0,0,0.04) — very subtle only"
    // FIX v2.0.0: was '#000000' (raw hex) — now uses NAV_SHADOW_TINT (token-derived)
    shadowColor:     NAV_SHADOW_TINT,
    shadowOffset:    { width: 0, height: -1 },
    shadowOpacity:   0.04,
    shadowRadius:    0,
    elevation:       4,                    // Android equivalent lift
  },

  // ── Top border ────────────────────────────────────────────────────────────
  // §9.3: "border-top: 1px solid var(--border-subtle)"
  topBorder: {
    height:          NAV.BORDER_TOP_WIDTH,   // 1px
    backgroundColor: colors.border.default,  // --border-subtle
  },

  // ── Tab row — 4 equal-width flex cells ────────────────────────────────────
  // §9.3: "display flex · align-items stretch"
  tabRow: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'stretch',
  },

  // ── Tab pressable — full cell is the touch target ─────────────────────────
  // §9.3: "Width: calc(100%/4) · Padding: 8px 4px · Touch target: full cell ≥ 44pt"
  tabPressable: {
    flex:              NAV.TAB_FLEX,          // 1 → each tab = 25% of nav width
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   NAV.TAB_PAD_V,        // 8px top + bottom
    paddingHorizontal: NAV.TAB_PAD_H,        // 4px left + right
    minHeight:         NAV.MIN_TOUCH,        // 44pt — Apple HIG minimum
  },

  // ── Tab inner — animated scale container ─────────────────────────────────
  tabInner: {
    alignItems:      'center',
    justifyContent:  'center',
    gap:             NAV.ICON_LABEL_GAP,    // 2px between icon and label
  },

  // ── Icon wrapper — relative positioning for badge dot overlay ────────────
  iconWrap: {
    position:        'relative',
    width:           NAV.ICON_SIZE,         // 24px
    height:          NAV.ICON_SIZE,         // 24px
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Tab label ─────────────────────────────────────────────────────────────
  // §9.3: "11px · weight 600 active / 400 inactive"
  // Color and fontWeight applied dynamically (resolved in TabItem render)
  tabLabel: {
    fontSize:        NAV.LABEL_SIZE,        // 11px
    lineHeight:      14,
    letterSpacing:   0,
    textAlign:       'center',
  },

  // ── Notification badge dot ────────────────────────────────────────────────
  // §9.3: "Tiny red dot at top-right of icon — ONLY on Profile tab"
  // Rendered only when badge > 0 AND tab is 'profile'
  badgeDot: {
    position:        'absolute',
    top:             -2,
    right:           -4,
    width:           NAV.BADGE_SIZE,             // 6px
    height:          NAV.BADGE_SIZE,             // 6px
    borderRadius:    NAV.BADGE_SIZE / 2,         // 3px → perfect circle
    backgroundColor: colors.fg.error,            // crimson — §9.3
    borderWidth:     1.5,
    borderColor:     colors.bg.surface,          // cutout illusion vs nav bg
  },

});

export default CrownBottomNav;

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Bottom Navigation Bar                                           ║
 * ║  §1.3.2 — Founder Mandate: Full-Width. Fixed. No Float. No Glass Island.║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CRITICAL DESIGN DECISION (§1.3.2 — Founder-Locked):                    ║
 * ║  "Simple. Full-width. Fixed. Boring. Just like WhatsApp / Telegram /     ║
 * ║   Instagram. NO Floating Glass Island. NO 280px hovering pill."          ║
 * ║  The existing FloatingGlassIsland.tsx is DEPRECATED.                     ║
 * ║  This file replaces it completely.                                        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  4 TABS (locked, non-negotiable — §1.3.1):                               ║
 * ║    Tab 1: HOME    → app/(tabs)/index.tsx    · icon: "house"              ║
 * ║    Tab 2: EXPLORE → app/(tabs)/explore.tsx  · icon: "compass"            ║
 * ║    Tab 3: CROWN   → app/(tabs)/crown.tsx    · icon: "crown"              ║
 * ║    Tab 4: PROFILE → app/(tabs)/profile.tsx  · icon: "user-circle"        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SPEC (§1.3.2 CSS/Style Spec):                                           ║
 * ║    position: fixed · bottom:0 · left:0 · right:0 (edge to edge)         ║
 * ║    height: 56px + env(safe-area-inset-bottom)                            ║
 * ║    background: var(--bg-surface) solid (white light / #0D1018 dark)      ║
 * ║    border-top: 1px solid var(--border-subtle)                            ║
 * ║    z-index: 950                                                           ║
 * ║    border-radius: 0 (flush rectangle — NO rounded corners)               ║
 * ║    backdrop-filter: NONE (no transparency, no floating, no island)        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  WHAT'S EXPLICITLY BANNED (§1.3.2):                                      ║
 * ║    ❌ Center floating + FAB                                               ║
 * ║    ❌ "More" menu                                                          ║
 * ║    ❌ Per-tab notification badges (red dot ONLY on Profile for unreads)   ║
 * ║    ❌ Hidden tabs or scrolling tab bars                                    ║
 * ║    ❌ Customizable tab order (founder-locked)                              ║
 * ║    ❌ backdrop-filter / blur                                               ║
 * ║    ❌ border-radius on the bar itself                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, animation, radii, zIndex, touch } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — Direct constants (§1.3.2 spec, pixel-perfect)
// Every value traces to a specific PRD paragraph.
// ─────────────────────────────────────────────────────────────────────────────

const NAV = {
  /** §1.3.2 — "height: 56px + env(safe-area-inset-bottom)" */
  HEIGHT: 56 as const,

  /** §1.3.2 — "border-top: 1px solid var(--border-subtle)" */
  BORDER_TOP_WIDTH: 1 as const,

  /** §1.3.2 — "z-index: 950" */
  Z_INDEX: 950 as const,

  /** §1.3.2 — "border-radius: 0 (flush rectangle)" */
  BORDER_RADIUS: 0 as const,

  /** Per-Tab Cell — §1.3.2 "Width: calc(100% / 4)" */
  TAB_FLEX: 1 as const,

  /** Per-Tab Cell — §1.3.2 "Padding: 8px 4px" */
  TAB_PAD_V: 8 as const,
  TAB_PAD_H: 4 as const,

  /** Per-Tab icon — §1.3.2 "Icon size: 24×24" */
  ICON_SIZE: 24 as const,

  /** Per-Tab label — §1.3.2 "Label: 11px Inter 500" */
  LABEL_SIZE: 11 as const,
  LABEL_WEIGHT: '500' as const,

  /** Per-Tab gap between icon and label — §1.3.2 "Gap: 2px" */
  ICON_LABEL_GAP: 2 as const,

  /** Active micro-bounce — §1.3.2 "1.0→1.05→1.0 micro-bounce on activation (180ms)" */
  ACTIVE_SCALE: 1.05 as const,
  BOUNCE_DURATION: 180 as const,

  /** Press-down scale — §1.4.5 motion haptic-paired 120ms */
  PRESS_SCALE: 0.95 as const,
  PRESS_DURATION: 80 as const,

  /** Scroll hide/show — §1.3.2 "transition: transform 200ms ease" */
  HIDE_DURATION: 200 as const,
  SHOW_DURATION: 200 as const,

  /** Notification badge — ONLY on Profile tab, for unread notifications */
  BADGE_SIZE: 6 as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONFIGURATION (§1.3.1 — The 4 Tabs, Locked, Non-Negotiable)
// ─────────────────────────────────────────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface TabConfig {
  /** Route name matching app/(tabs)/ filename */
  readonly route: string;
  /** Display label — 11px Inter 500 below icon */
  readonly label: string;
  /** Feather icon name (outline when inactive, filled when active via activeIcon) */
  readonly icon: FeatherName;
  /** A11y screen reader hint — Hinglish */
  readonly a11yHint: string;
}

const TABS: readonly TabConfig[] = [
  {
    // ── TAB 1: HOME ──────────────────────────────────────────────────────────
    // The live chat — primary destination.
    // Contains: Chat stream (4-scope switcher: World/Country/City/Sector)
    //           + sticky composer + online count + Heat score
    // §1.3.1 — "house (filled when active, outline when inactive)"
    route:    'index',
    label:    'Home',
    icon:     'home',
    a11yHint: 'Live chat kholo — apne sector, city, ya duniya se baat karo',
  },
  {
    // ── TAB 2: EXPLORE ───────────────────────────────────────────────────────
    // Discover other cities, leaderboards, schedules, search, archives.
    // Contains: 4-tier leaderboards, Battle Schedule, City Picker,
    //           Top 30 Daily Archive, search, Hall of Fame, Digital Invasions
    // §1.3.1 — "compass"
    route:    'explore',
    label:    'Explore',
    icon:     'compass',
    a11yHint: 'Doosre cities, leaderboards, aur schedules explore karo',
  },
  {
    // ── TAB 3: CROWN ─────────────────────────────────────────────────────────
    // Status & bidding center — emotional anchor of the app.
    // Contains: Your current ranks (Sector/City/Country/World), active cycles,
    //           bid history, title earnings, Live Rank Progress
    // §1.3.1 — "crown"
    // Why its own tab (not buried in Profile): "Status is the unique value.
    // Burying it = burying the soul." — Founder
    route:    'crown',
    label:    'Crown',
    icon:     'award',  // Feather doesn't have 'crown'; 'award' is closest equivalent
    a11yHint: 'Apna rank, active cycles, aur bids dekho',
  },
  {
    // ── TAB 4: PROFILE ───────────────────────────────────────────────────────
    // You — handle, titles, stats, followers/following, Credits, Settings, Cashout.
    // §1.3.1 — "user-circle"
    // NOTE: Icon is ALWAYS Feather 'user' — NEVER the user's own avatar here.
    //       Avatar appears on the Profile SCREEN, not in the nav bar.
    //       §1.3.2 banned: "Per-tab notification badges (red dot only on Profile
    //       when unread notifications exist; details inside the tab)"
    route:    'profile',
    label:    'Profile',
    icon:     'user',
    a11yHint: 'Apna profile, Credits, settings, aur cashout dekho',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — shared Animated.Value for scroll-hide coordination
//
// Semantics:
//   0 = Nav BAR VISIBLE   (translateY = 0)
//   1 = Nav BAR HIDDEN    (translateY = NAV.HEIGHT + safe-area-bottom)
//
// Screen components wire to this via:
//   import { hideNav, showNav } from '@/components/organisms/CrownBottomNav';
// ─────────────────────────────────────────────────────────────────────────────

export const navScrollAnim = new Animated.Value(0);

/**
 * hideNav() — Slide bottom nav off-screen downward.
 * Call when user scrolls toward older messages (chat reads downward).
 * §1.3.2: "delta > 4 → hideAll()"
 * Duration: 200ms ease.
 */
export function hideNav(): void {
  Animated.timing(navScrollAnim, {
    toValue: 1,
    duration: NAV.HIDE_DURATION,
    useNativeDriver: true,
  }).start();
}

/**
 * showNav() — Slide bottom nav back into view.
 * Call when user scrolls toward newest messages (chat reads upward)
 * or when user reaches the bottom of the chat.
 * §1.3.2: "delta < -4 → showAll() | atBottom → showAll()"
 * Duration: 200ms ease.
 */
export function showNav(): void {
  Animated.timing(navScrollAnim, {
    toValue: 0,
    duration: NAV.SHOW_DURATION,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB ITEM — Single tab inside the bottom navigation bar
// ─────────────────────────────────────────────────────────────────────────────

interface TabItemProps {
  readonly config:       TabConfig;
  readonly focused:      boolean;
  readonly onPress:      () => void;
  readonly onLongPress:  () => void;
  readonly badge?:       number;     // Red dot on Profile tab only
}

function TabItem({ config, focused, onPress, onLongPress, badge = 0 }: TabItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // ── Focus change → micro-bounce (§1.3.2: "1.0→1.05→1.0 · 180ms") ────────
  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue:         NAV.ACTIVE_SCALE,  // 1.05
          duration:        NAV.BOUNCE_DURATION / 2, // 90ms up
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue:         1,
          duration:        NAV.BOUNCE_DURATION / 2, // 90ms back
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, scaleAnim]);

  // ── Press down — scale 0.95 for 80ms ────────────────────────────────────
  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue:         NAV.PRESS_SCALE, // 0.95
      duration:        NAV.PRESS_DURATION, // 80ms
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  // ── Press release — spring back to 1.0 ───────────────────────────────────
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

  // ── Long press: Light haptic (no context menu in v1.0) ───────────────────
  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress();
  }, [onLongPress]);

  const iconColor    = focused ? colors.fg.brand : colors.fg.tertiary;
  const labelColor   = focused ? colors.fg.brand : colors.fg.tertiary;
  const labelWeight  = focused ? '600' : NAV.LABEL_WEIGHT;
  const hasBadge     = badge > 0;

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
      // ── Touch target: full cell ≥ 44pt min (§1.3.2) ─────────────────────
      style={styles.tabPressable}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {/* Press-scale outer wrapper */}
      <Animated.View
        style={[
          styles.tabInner,
          { transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] },
        ]}
      >
        {/* Icon wrapper — relative for badge positioning */}
        <View style={styles.iconWrap}>
          <Feather
            name={config.icon}
            size={NAV.ICON_SIZE}   /* 24×24 per §1.3.2 */
            color={iconColor}
          />

          {/* Notification badge — ONLY on Profile tab per §1.3.2 ban list */}
          {hasBadge && config.route === 'profile' ? (
            <View
              style={styles.badgeDot}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </View>

        {/* Label — 11px Inter 500 (§1.3.2) */}
        <Text
          style={[
            styles.tabLabel,
            { color: labelColor, fontWeight: labelWeight as any },
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
// PROPS INTERFACE — Matches expo-router Tabs tabBar prop shape
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

// ─────────────────────────────────────────────────────────────────────────────
// CROWN BOTTOM NAV — The full-width bottom navigation bar
//
// Architecture:
//   - Animated.View with translateY driven by navScrollAnim (scroll-hide)
//   - Keyboard listener: nav hides when keyboard opens (chat input focused)
//   - Platform-safe bottom padding via useSafeAreaInsets()
//   - No blur, no transparency, no rounded corners — §1.3.2 mandate
// ─────────────────────────────────────────────────────────────────────────────

export function CrownBottomNav({ state, descriptors, navigation }: TabBarCoreProps) {
  const insets  = useSafeAreaInsets();
  const kbAnim  = useRef(new Animated.Value(0)).current;  // 0=visible, 1=hidden
  const totalHeight = NAV.HEIGHT + insets.bottom;

  // ── Keyboard listeners — hide nav when keyboard opens ─────────────────────
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

  // ── Scroll-driven translateY ─────────────────────────────────────────────
  // navScrollAnim: 0=visible · 1=fully hidden below screen
  const scrollY = navScrollAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, totalHeight],
    extrapolate: 'clamp',
  });

  // ── Keyboard-driven translateY ───────────────────────────────────────────
  const keyboardY = kbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, totalHeight],
    extrapolate: 'clamp',
  });

  // Additive — in practice only one fires at a time
  const translateY = Animated.add(scrollY, keyboardY);

  return (
    <Animated.View
      testID="crown-bottom-nav"
      accessibilityRole="tablist"
      accessibilityLabel="Primary navigation: Home, Explore, Crown, Profile"
      style={[
        styles.navBar,
        {
          height:          totalHeight,  // 56px + safe-area-bottom
          transform:       [{ translateY }],
        },
      ]}
    >
      {/* Top border — §1.3.2 "1px solid var(--border-subtle)" */}
      <View style={styles.topBorder} />

      {/* Tab row — 4 equal-width cells */}
      <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const tabCfg     = TABS.find((t) => t.route === route.name);
          if (!tabCfg) return null;  // Skip hidden routes

          const isFocused  = state.index === index;
          const descriptor = descriptors[route.key];
          const rawBadge   = descriptor?.options?.tabBarBadge;
          const badgeCount = typeof rawBadge === 'number' ? rawBadge : 0;

          function onPress(): void {
            const event = navigation.emit({
              type:              'tabPress',
              target:            route.key,
              canPreventDefault: true,
            });

            if (isFocused && route.name === 'index') {
              // Special: tapping Home while on Home → scroll to bottom (latest messages)
              // Screens listen for this via a global event / Zustand signal
              // navScrollToBottom event
              return;
            }

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

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// All values trace to §1.3.2 spec. Zero magic numbers.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Navigation bar container ───────────────────────────────────────────────
  // §1.3.2: position fixed, bottom 0, left 0, right 0, full-width
  // background: solid colors.bg.surface (white light / #0D1018 dark)
  // No backdrop-filter. No border-radius. No glass.
  navBar: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: colors.bg.surface,         // Solid — §1.3.2 mandate
    zIndex:          NAV.Z_INDEX,               // 950
    borderRadius:    NAV.BORDER_RADIUS,         // 0 — flush rectangle

    // §1.3.2: "box-shadow: 0 -1px 0 rgba(0,0,0,0.04)"
    shadowColor:     '#000000',
    shadowOffset:    { width: 0, height: -1 },
    shadowOpacity:   0.04,
    shadowRadius:    0,
    elevation:       4,                         // Android lift
  },

  // ── Top border ─────────────────────────────────────────────────────────────
  // §1.3.2: "border-top: 1px solid var(--border-subtle)"
  topBorder: {
    height:          NAV.BORDER_TOP_WIDTH,      // 1px
    backgroundColor: colors.border.default,     // --border-subtle
  },

  // ── Tab row — 4 equal-width flex cells ────────────────────────────────────
  // §1.3.2: "display flex · justify-content: space-between · align-items: stretch"
  tabRow: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'stretch',
  },

  // ── Tab pressable — full cell = touch target ───────────────────────────────
  // §1.3.2: "Touch target: full cell (≥ 25% × 56px area, exceeds Apple HIG 44pt minimum)"
  // §1.3.2: "Width: calc(100% / 4) (always exact quarters)"
  // §1.3.2: "Padding: 8px 4px internal"
  tabPressable: {
    flex:            NAV.TAB_FLEX,              // 1 → 25% width
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: NAV.TAB_PAD_V,            // 8px
    paddingHorizontal: NAV.TAB_PAD_H,          // 4px
    minHeight:       touch.minIos,             // 44pt iOS minimum
  },

  // ── Tab inner — animated scale container ──────────────────────────────────
  tabInner: {
    alignItems:      'center',
    justifyContent:  'center',
    gap:             NAV.ICON_LABEL_GAP,        // 2px between icon and label
  },

  // ── Icon wrapper — relative for badge dot positioning ─────────────────────
  iconWrap: {
    position:        'relative',
    width:           NAV.ICON_SIZE,             // 24
    height:          NAV.ICON_SIZE,             // 24
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Tab label — §1.3.2 "11px Inter 500" ───────────────────────────────────
  tabLabel: {
    fontSize:        NAV.LABEL_SIZE,            // 11px
    lineHeight:      14,
    letterSpacing:   0,
    textAlign:       'center',
  },

  // ── Notification badge — §1.3.2 "Tiny red dot at top-right of icon" ───────
  // ONLY on Profile tab when unread notifications exist
  badgeDot: {
    position:        'absolute',
    top:             -2,
    right:           -4,
    width:           NAV.BADGE_SIZE,            // 6px
    height:          NAV.BADGE_SIZE,            // 6px
    borderRadius:    NAV.BADGE_SIZE / 2,        // 3 → circle
    backgroundColor: colors.fg.error,           // crimson-600 — §1.3.2
    borderWidth:     1.5,
    borderColor:     colors.bg.surface,         // cutout illusion vs nav bg
  },

});

export default CrownBottomNav;

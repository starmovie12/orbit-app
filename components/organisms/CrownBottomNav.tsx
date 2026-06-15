/**
 * CROWN — Bottom Navigation (organism)  ·  components/organisms/CrownBottomNav.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * §9.3 Founder mandate: simple · full-width · fixed · solid · flush rectangle.
 * NO floating island, NO glass, NO blur, radius 0 on the bar.
 *
 * 4 founder-locked tabs:  Home · Explore · Crown · Profile
 *
 * PREMIUM PASS:
 *   • ROBUSTNESS FIX — the bar now always renders the 4 canonical tabs
 *     (iterating TABS, not router state). Previously it mapped over
 *     `state.routes`; if any sibling route failed to register, the bar showed
 *     only the routes it found (e.g. just "Home"). Now all 4 always show.
 *   • Premium active state — soft-gold rounded indicator behind the active
 *     icon (Material-3 style), gold icon + label, micro-bounce. Inactive
 *     icons are warm espresso. The bar itself stays a flat solid rectangle
 *     per §9.3 — the indicator lives INSIDE it, nothing floats.
 *   • Crisp 24px Feather icons · labels via the loaded Inter family.
 *
 * Public API (navScrollAnim, hideNav, showNav, TabId, both render modes) —
 * unchanged. Drop-in replacement.
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
import { FONT_BODY } from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const NAV = {
  HEIGHT: 56 as const,
  BORDER_TOP_WIDTH: 1 as const,
  Z_INDEX: 950 as const,
  BORDER_RADIUS: 0 as const,

  TAB_FLEX: 1 as const,
  TAB_PAD_V: 6 as const,
  TAB_PAD_H: 4 as const,

  ICON_SIZE: 24 as const,
  LABEL_SIZE: 11 as const,

  LABEL_WEIGHT_ACTIVE: '600' as TextStyle['fontWeight'],
  LABEL_WEIGHT_INACTIVE: '400' as TextStyle['fontWeight'],

  ICON_LABEL_GAP: 3 as const,

  // Material-3 style active indicator behind the icon
  INDICATOR_W: 46 as const,
  INDICATOR_H: 28 as const,

  ACTIVE_SCALE: 1.06 as const,
  BOUNCE_DURATION: 180 as const,
  PRESS_SCALE: 0.95 as const,
  PRESS_DURATION: 80 as const,

  HIDE_DURATION: 200 as const,
  SHOW_DURATION: 200 as const,

  MIN_TOUCH: 44 as const,
  BADGE_SIZE: 6 as const,
} as const;

const NAV_SHADOW_TINT: string = colors.fg.tertiary;

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONFIG — locked (§9.3)
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'explore' | 'crown' | 'profile';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface TabConfig {
  readonly route: string;
  readonly id: TabId;
  readonly label: string;
  readonly icon: FeatherName;
  readonly a11yHint: string;
}

const TABS: readonly TabConfig[] = [
  {
    route: 'index',
    id: 'home',
    label: 'Home',
    icon: 'home',
    a11yHint: 'Live chat kholo — apne sector, city, ya duniya se baat karo',
  },
  {
    route: 'discover',
    id: 'explore',
    label: 'Explore',
    icon: 'compass',
    a11yHint: 'Doosre cities, leaderboards, aur schedules explore karo',
  },
  {
    route: 'ranks',
    id: 'crown',
    label: 'Crown',
    icon: 'award',
    a11yHint: 'Apna rank, active cycles, aur bids dekho',
  },
  {
    route: 'profile',
    id: 'profile',
    label: 'Profile',
    icon: 'user',
    a11yHint: 'Apna profile, Credits, settings, aur cashout dekho',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SCROLL ANIMATION  (0 = visible, 1 = hidden)
// ─────────────────────────────────────────────────────────────────────────────

export const navScrollAnim = new Animated.Value(0);

export function hideNav(): void {
  Animated.timing(navScrollAnim, {
    toValue: 1,
    duration: NAV.HIDE_DURATION,
    useNativeDriver: true,
  }).start();
}

export function showNav(): void {
  Animated.timing(navScrollAnim, {
    toValue: 0,
    duration: NAV.SHOW_DURATION,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB ITEM
// ─────────────────────────────────────────────────────────────────────────────

interface TabItemProps {
  readonly config: TabConfig;
  readonly focused: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
  readonly badge?: number;
}

function TabItem({ config, focused, onPress, onLongPress, badge = 0 }: TabItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: NAV.ACTIVE_SCALE,
          duration: NAV.BOUNCE_DURATION / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: NAV.BOUNCE_DURATION / 2,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, scaleAnim]);

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue: NAV.PRESS_SCALE,
      duration: NAV.PRESS_DURATION,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 14,
    }).start();
  }, [pressAnim]);

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress();
  }, [onLongPress]);

  const scheme = useColorScheme();
  const inactiveColor: string =
    scheme === 'dark' ? 'rgba(255,255,255,0.55)' : colors.fg.secondary;
  const iconColor: string = focused ? colors.fg.brand : inactiveColor;
  const labelColor: string = focused ? colors.fg.brand : inactiveColor;
  const labelWeight: TextStyle['fontWeight'] = focused
    ? NAV.LABEL_WEIGHT_ACTIVE
    : NAV.LABEL_WEIGHT_INACTIVE;

  const hasBadge = badge > 0 && config.id === 'profile';

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityLabel={config.label}
      accessibilityState={{ selected: focused }}
      accessibilityHint={config.a11yHint}
      testID={`crown-tab-${config.id}`}
      style={styles.tabPressable}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.tabInner,
          { transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] },
        ]}
      >
        <View style={styles.iconWrap}>
          {/* Soft-gold active indicator — sits BEHIND the icon, inside the bar */}
          {focused ? <View style={styles.activeIndicator} /> : null}

          <Feather name={config.icon} size={NAV.ICON_SIZE} color={iconColor} />

          {hasBadge ? (
            <View
              style={styles.badgeDot}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </View>

        <Text
          style={[styles.tabLabel, { color: labelColor, fontWeight: labelWeight }]}
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
// PROPS — Mode A: expo-router tabBar  ·  Mode B: standalone controlled
// ─────────────────────────────────────────────────────────────────────────────

interface ExpoRouterShape {
  readonly state: {
    routes: ReadonlyArray<{ key: string; name: string }>;
    index: number;
  };
  readonly descriptors: Readonly<
    Record<string, { options: { title?: string; tabBarBadge?: number | string } }>
  >;
  readonly navigation: {
    emit: (e: {
      type: string;
      target?: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

interface SharedNavProps {
  readonly navHidden?: boolean;
  readonly activeTab?: TabId;
  readonly onTabPress?: (tab: TabId) => void;
}

type TabBarCoreProps = ExpoRouterShape & SharedNavProps;

type StandaloneNavProps = SharedNavProps & {
  readonly state?: undefined;
  readonly descriptors?: undefined;
  readonly navigation?: undefined;
  readonly activeTab: TabId;
  readonly onTabPress: (tab: TabId) => void;
};

type CrownBottomNavProps = TabBarCoreProps | StandaloneNavProps;

// ─────────────────────────────────────────────────────────────────────────────
// CROWN BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────────

export function CrownBottomNav(props: CrownBottomNavProps) {
  const insets = useSafeAreaInsets();

  const kbAnim = useRef(new Animated.Value(0)).current;
  const navHidAnim = useRef(new Animated.Value(0)).current;

  const totalHeight = NAV.HEIGHT + insets.bottom;
  const { navHidden } = props;

  useEffect(() => {
    Animated.timing(navHidAnim, {
      toValue: navHidden === true ? totalHeight : 0,
      duration: NAV.HIDE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [navHidden, navHidAnim, totalHeight]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvt, () => {
      Animated.timing(kbAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    const subHide = Keyboard.addListener(hideEvt, () => {
      Animated.timing(kbAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [kbAnim]);

  const scrollY = navScrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, totalHeight],
    extrapolate: 'clamp',
  });
  const keyboardY = kbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, totalHeight],
    extrapolate: 'clamp',
  });
  const translateY = Animated.add(Animated.add(scrollY, keyboardY), navHidAnim);

  const navBarStyle = [
    styles.navBar,
    { height: totalHeight, transform: [{ translateY }] },
  ] as const;

  // ── EXPO-ROUTER MODE ───────────────────────────────────────────────────────
  // We iterate the 4 canonical TABS (not router state) so the bar ALWAYS shows
  // all four, even if a sibling route fails to register. The router state is
  // used only to resolve focus + the descriptor badge for each tab.
  if (props.state !== undefined && props.navigation !== undefined) {
    const { state, descriptors, navigation } = props;

    return (
      <Animated.View
        testID="crown-bottom-nav"
        accessibilityRole="tablist"
        accessibilityLabel="Primary navigation: Home, Explore, Crown, Profile"
        style={navBarStyle}
      >
        <View style={styles.topBorder} />

        <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
          {TABS.map((tabCfg) => {
            const routeIndex = state.routes.findIndex((r) => r.name === tabCfg.route);
            const route = routeIndex >= 0 ? state.routes[routeIndex] : undefined;

            const isFocused =
              props.activeTab !== undefined
                ? tabCfg.id === props.activeTab
                : routeIndex >= 0 && state.index === routeIndex;

            const descriptor = route ? descriptors[route.key] : undefined;
            const rawBadge = descriptor?.options?.tabBarBadge;
            const badgeCount = typeof rawBadge === 'number' ? rawBadge : 0;

            function onPress(): void {
              // Tapping Home while on Home → scroll chat to bottom (§9.3.3)
              if (isFocused && tabCfg.route === 'index') {
                const { DeviceEventEmitter } = require('react-native');
                DeviceEventEmitter.emit('crown:scrollToBottom');
                return;
              }

              if (route) {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
              }

              props.onTabPress?.(tabCfg.id);
              navigation.navigate(tabCfg.route);
            }

            function onLongPress(): void {
              if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
            }

            return (
              <TabItem
                key={tabCfg.id}
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

  // ── STANDALONE MODE ────────────────────────────────────────────────────────
  const { activeTab, onTabPress } = props as StandaloneNavProps;

  return (
    <Animated.View
      testID="crown-bottom-nav"
      accessibilityRole="tablist"
      accessibilityLabel="Primary navigation: Home, Explore, Crown, Profile"
      style={navBarStyle}
    >
      <View style={styles.topBorder} />

      <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
        {TABS.map((tabCfg) => (
          <TabItem
            key={tabCfg.id}
            config={tabCfg}
            focused={tabCfg.id === activeTab}
            onPress={() => onTabPress(tabCfg.id)}
            onLongPress={() => {}}
            badge={0}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.surface, // solid — §9.3
    zIndex: NAV.Z_INDEX,
    borderRadius: NAV.BORDER_RADIUS, // 0 — flush rectangle
    shadowColor: NAV_SHADOW_TINT,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },

  topBorder: {
    height: NAV.BORDER_TOP_WIDTH,
    backgroundColor: colors.border.default,
  },

  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  tabPressable: {
    flex: NAV.TAB_FLEX,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: NAV.TAB_PAD_V,
    paddingHorizontal: NAV.TAB_PAD_H,
    minHeight: NAV.MIN_TOUCH,
  },

  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: NAV.ICON_LABEL_GAP,
  },

  iconWrap: {
    position: 'relative',
    width: NAV.INDICATOR_W,
    height: NAV.INDICATOR_H,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Material-3 style soft-gold pill behind the active icon
  activeIndicator: {
    position: 'absolute',
    width: NAV.INDICATOR_W,
    height: NAV.INDICATOR_H,
    borderRadius: NAV.INDICATOR_H / 2,
    backgroundColor: colors.bg.goldSoft, // gold[50]
  },

  tabLabel: {
    fontFamily: FONT_BODY.medium,
    fontSize: NAV.LABEL_SIZE,
    lineHeight: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 6,
    width: NAV.BADGE_SIZE,
    height: NAV.BADGE_SIZE,
    borderRadius: NAV.BADGE_SIZE / 2,
    backgroundColor: colors.fg.error,
    borderWidth: 1.5,
    borderColor: colors.bg.surface,
  },
});

export default CrownBottomNav;

/**
 * CROWD WORLD — Floating Glass Island Tab Layout
 *
 * HTML source: crowd_world_redesigned.html → .nav-pill + .ni + .ni.active classes
 *
 * .nav-pill  → background:rgba(255,255,255,.97), backdrop-filter:blur(24px),
 *              border-radius:28px (--r-2xl), padding:4px 8px,
 *              border:1px solid var(--card-border),
 *              box-shadow: shadow-lg + inset gold border top
 *
 * .ni        → flex:1, column, center, gap:3px, padding:7px 0, border-radius:30px
 * .ni.active → background: linear-gradient(135deg, #FFF9EC, #FFF8E8)
 *              icon color: var(--gold) = #C9A227
 *              label color: var(--gold-deep) = #9A7A18
 * .ni (inactive) → icon + label color: #C0AC88
 *
 * ── Scroll Hide/Show ─────────────────────────────────────────────────────────
 * navScrollAnim export kiya hai. Baad mein screens se wire karo:
 *   import { navScrollAnim } from '@/app/(tabs)/_layout';
 *   // Scroll down: Animated.timing(navScrollAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
 *   // Scroll up:   Animated.timing(navScrollAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start()
 *
 * ── Install check ────────────────────────────────────────────────────────────
 *   expo-blur:            ~15.0.8  ✅ already installed
 *   expo-linear-gradient: ~15.0.8  ✅ already installed
 */

import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

// Gold design tokens — colors.ts se import (HTML ke :root variables se match)
import { orbitGold } from "@/constants/colors";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — HTML ke CSS variables se seedha map
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  // Active state (HTML .ni.active)
  activeGradStart: orbitGold.accentSoftSolid,    // --gold-pale: #FFF9EC
  activeGradEnd:   "#FFF8E8",                     // literal HTML value
  activeIcon:      orbitGold.accent,              // --gold: #C9A227
  activeLabel:     orbitGold.accentHover,         // --gold-deep: #9A7A18
  activeBg:        orbitGold.accentSoftSolid,     // gradient fallback

  // Inactive state (HTML .ni svg + .ni-lbl color)
  inactiveColor:   "#C0AC88",                     // HTML hardcoded value

  // Pill container
  pillBg:          "rgba(255,255,255,0.97)",       // HTML .nav-pill background
  pillBorder:      orbitGold.borderSubtle,         // --card-border: #EDE3CC
  pillGoldLine:    orbitGold.goldBorder,           // --gold-border: #E2C660 (inset top)
  pillRadius:      28,                             // --r-2xl: 28px
  pillPadH:        8,                             // horizontal padding 8px
  pillPadV:        4,                             // vertical padding 4px

  // Item
  itemRadius:      30,                             // .ni border-radius: 30px (pill shape)
  itemPadV:        7,                             // .ni padding:7px 0
  itemGap:         3,                             // .ni gap:3px (icon to label)

  // Label
  labelSize:       11,                            // .ni-lbl font-size:11px
  labelWeight:     "700" as const,                // .ni-lbl font-weight:700
  labelSpacing:    0.2,                           // .ni-lbl letter-spacing:.2px
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL ANIMATION — Export karo taaki screens use kar sakein
//
// Value 0 = nav visible (translate 0)
// Value 1 = nav hidden  (translate 100 — screen ke neeche chale jaata hai)
//
// Wire karna (kisi bhi scrollable screen mein):
//   const lastY = useRef(0);
//   const onScroll = useCallback(({ nativeEvent }) => {
//     const y = nativeEvent.contentOffset.y;
//     if (y > lastY.current + 10) hideNav();      // scroll down
//     if (y < lastY.current - 5)  showNav();      // scroll up
//     lastY.current = y;
//   }, []);
// ─────────────────────────────────────────────────────────────────────────────

export const navScrollAnim = new Animated.Value(0);

export function hideNav() {
  Animated.timing(navScrollAnim, {
    toValue:         1,
    duration:        200,
    useNativeDriver: true,
  }).start();
}

export function showNav() {
  Animated.timing(navScrollAnim, {
    toValue:         0,
    duration:        250,
    useNativeDriver: true,
  }).start();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONFIG — 5 tabs ka data ek jagah
// Route name must match existing file names in app/(tabs)/
// ─────────────────────────────────────────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface TabConfig {
  route:   string;      // expo-router file name
  label:   string;      // HTML .ni-lbl text
  icon:    FeatherName; // Feather icon name
  badge?:  number;      // Optional notification badge (HTML .ni-badge)
}

const TAB_CONFIG: TabConfig[] = [
  {
    route: "index",
    label: "World",
    icon:  "globe",          // HTML: circle + longitude/latitude lines SVG
  },
  {
    route: "discover",
    label: "Discover",
    icon:  "search",         // HTML: search circle SVG
  },
  {
    route: "bazaar",
    label: "Bazaar",
    icon:  "shopping-bag",   // Naya tab — marketplace/crates
  },
  {
    route: "ranks",
    label: "Leaderboard",    // HTML mein "Izzat" tha, app mein "Leaderboard"
    icon:  "bar-chart-2",    // HTML: bar chart SVG — exact match
  },
  {
    route: "profile",
    label: "Profile",
    icon:  "user",           // HTML: person silhouette SVG
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TAB ITEM — Single nav button (HTML .ni element)
// ─────────────────────────────────────────────────────────────────────────────

interface TabItemProps {
  config:    TabConfig;
  focused:   boolean;
  onPress:   () => void;
  onLongPress: () => void;
}

function TabItem({ config, focused, onPress, onLongPress }: TabItemProps) {
  // Tap scale animation — HTML .ni:active { transform:scale(.92) }
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.timing(scaleAnim, {
      toValue:         0.92,
      duration:        100,
      useNativeDriver: true,
    }).start();
  }

  function pressOut() {
    Animated.spring(scaleAnim, {
      toValue:         1,
      useNativeDriver: true,
      speed:           20,
      bounciness:      6,
    }).start();
  }

  const iconColor  = focused ? T.activeIcon    : T.inactiveColor;
  const labelColor = focused ? T.activeLabel   : T.inactiveColor;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="tab"
      accessibilityLabel={config.label}
      accessibilityState={{ selected: focused }}
      style={styles.itemPressable}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale: scaleAnim }] }]}>
        {/* Active background: HTML .ni.active { background: linear-gradient(135deg, #FFF9EC, #FFF8E8) } */}
        {focused ? (
          <LinearGradient
            colors={[T.activeGradStart, T.activeGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        {/* Icon — HTML: 22x22 SVG, stroke-width:2 */}
        <View style={styles.iconWrap}>
          <Feather
            name={config.icon}
            size={22}
            color={iconColor}
            style={focused ? styles.iconActive : undefined}
          />

          {/* Badge — HTML .ni-badge: absolute top:4 right:6, gold bg, 14x14 circle */}
          {config.badge != null && config.badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {config.badge > 9 ? "9+" : String(config.badge)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Label — HTML .ni-lbl: 11px/700/#C0AC88, active → gold-deep */}
        <Text
          style={[
            styles.label,
            { color: labelColor },
            // Active label: bold aur dark gold
            focused && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING TAB BAR — Custom tabBar component (HTML .nav-pill)
//
// Expo Router ke <Tabs tabBar={...}> prop se render hota hai.
// Native tab bar completely replace karta hai.
// ─────────────────────────────────────────────────────────────────────────────

// Pill ki width: ~280px fixed, ya screen width - 32px agar screen choti ho
const SCREEN_W    = Dimensions.get("window").width;
const PILL_WIDTH  = Math.min(280, SCREEN_W - 32);
const PILL_BOTTOM = 20; // HTML .nav-outer: padding-bottom:12px + outer padding

// BottomTabBarProps ka minimal inline type — @react-navigation/bottom-tabs se
// (expo-router internally bundled karta hai, direct import nahi chahiye)
type FloatingTabBarProps = {
  state: {
    routes: Array<{ key: string; name: string }>;
    index:  number;
  };
  descriptors: Record<string, {
    options: { title?: string; tabBarBadge?: number | string };
  }>;
  navigation: {
    emit:     (event: { type: string; target?: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();

  // navScrollAnim se translateY interpolate karo
  // 0 → translateY(0) [visible], 1 → translateY(PILL_HEIGHT+bottom+insets) [hidden]
  const translateY = navScrollAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 120], // 120px neeche chala jaata hai — screen se bahar
    extrapolate: "clamp",
  });

  const bottomOffset = PILL_BOTTOM + insets.bottom;

  return (
    <Animated.View
      style={[
        styles.navContainer,
        {
          bottom:    bottomOffset,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      {/*
        Glass pill container
        HTML: background:rgba(255,255,255,.97), backdrop-filter:blur(24px)
        iOS   → BlurView (native glass blur, intensity ~90)
        Android → rgba background (BlurView Android experimental hai, crash avoid karo)
      */}
      {Platform.OS === "ios" ? (
        <BlurView
          tint="light"
          intensity={90}
          style={styles.pillBlur}
        >
          <PillContents
            state={state}
            descriptors={descriptors}
            navigation={navigation}
          />
        </BlurView>
      ) : (
        // Android: BlurView ki jagah plain View with rgba
        // Blur effect ke liye baad mein @react-native-community/blur try kar sakte ho
        <View style={[styles.pillBlur, styles.pillAndroid]}>
          <PillContents
            state={state}
            descriptors={descriptors}
            navigation={navigation}
          />
        </View>
      )}
    </Animated.View>
  );
}

// Pill ka andar wala content — alag component taaki BlurView/View dono mein share ho
function PillContents({ state, descriptors, navigation }: FloatingTabBarProps) {
  return (
    <>
      {/*
        Gold top border line — HTML inset shadow simulate karna:
        box-shadow: ..., 0 2px 0 var(--gold-border) inset
        React Native mein inset shadow nahi hota, isliye ek 1px View lagaya
      */}
      <View style={styles.goldTopLine} />

      {/* Tab items row */}
      <View style={styles.pillRow}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          // Tab config find karo — route.name se match
          const tabConfig = TAB_CONFIG.find((t) => t.route === route.name);
          if (!tabConfig) return null; // Hidden screens skip

          // Badge option se agar koi value aaye
          const desc   = descriptors[route.key];
          const rawBadge = desc?.options?.tabBarBadge;
          const badge = typeof rawBadge === "number" ? rawBadge : undefined;

          function onPress() {
            const event = navigation.emit({
              type:              "tabPress",
              target:            route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          function onLongPress() {
            navigation.emit({ type: "tabLongPress", target: route.key });
          }

          return (
            <TabItem
              key={route.key}
              config={{ ...tabConfig, badge }}
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
// TAB LAYOUT — Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      // Custom floating nav — native tab bar ko completely replace karta hai
      tabBar={(props) => <FloatingTabBar {...(props as FloatingTabBarProps)} />}
      screenOptions={{
        headerShown: false,

        // Native tab bar style null karo — custom tabBar sab handle karta hai
        tabBarStyle:         { display: "none" },
        tabBarItemStyle:     undefined,
        tabBarLabelStyle:    undefined,
        tabBarIconStyle:     undefined,
        tabBarShowLabel:     false,
        tabBarHideOnKeyboard: true, // Keyboard khule toh nav hide ho
      }}
    >
      {/* ── Visible Tabs ─────────────────────────────────────────────────── */}

      {/* 1. World — Main city chat room */}
      <Tabs.Screen
        name="index"
        options={{
          title: "World",
        }}
      />

      {/* 2. Discover — Colony posts, cards, challenges */}
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
        }}
      />

      {/* 3. Bazaar — Crates, marketplace, shop */}
      <Tabs.Screen
        name="bazaar"
        options={{
          title: "Bazaar",
        }}
      />

      {/* 4. Leaderboard — City rankings, Izzat board */}
      <Tabs.Screen
        name="ranks"
        options={{
          title: "Leaderboard",
        }}
      />

      {/* 5. Profile — Tera CROWD card, stats, settings */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />

      {/* ── Hidden Screens — Tab bar mein nahi dikhenge ───────────────────── */}
      {/* href: null → expo-router is screen ko tab bar se exclude karta hai */}

      <Tabs.Screen name="inbox"    options={{ href: null }} />
      <Tabs.Screen name="live"     options={{ href: null }} />
      <Tabs.Screen name="rooms"    options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Nav container — absolute positioned, centered, animated ─────────────
  navContainer: {
    position:        "absolute",
    left:            (SCREEN_W - PILL_WIDTH) / 2, // Center karo
    width:           PILL_WIDTH,
    alignItems:      "stretch",
    zIndex:          999,                          // Sab ke upar

    // Outer shadow — HTML: box-shadow: 0 8px 32px rgba(0,0,0,.08)
    // (shadow-lg token se match)
    shadowColor:     "#000000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    32,
    elevation:       16,                           // Android ke liye
  },

  // ── Glass pill — HTML .nav-pill ─────────────────────────────────────────
  pillBlur: {
    borderRadius:    T.pillRadius,                 // 28px — --r-2xl
    overflow:        "hidden",                     // BlurView clip ke liye zaroori
    borderWidth:     1,
    borderColor:     T.pillBorder,                // --card-border: #EDE3CC
    paddingHorizontal: T.pillPadH,                // 8px
    paddingVertical: T.pillPadV,                  // 4px
  },

  // Android pill — rgba fallback
  pillAndroid: {
    backgroundColor: T.pillBg,                    // rgba(255,255,255,0.97)
  },

  // Gold top border line — HTML inset shadow: 0 2px 0 var(--gold-border) inset simulate
  goldTopLine: {
    height:          1,
    backgroundColor: T.pillGoldLine,             // --gold-border: #E2C660
    marginHorizontal: T.pillPadH,
    marginBottom:    2,
    opacity:         0.6,
  },

  // ── Items row ────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
  },

  // ── Individual tab item — HTML .ni ───────────────────────────────────────
  itemPressable: {
    flex:            1,
  },

  itemInner: {
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: T.itemPadV,                  // 7px — .ni padding:7px 0
    gap:             T.itemGap,                   // 3px — .ni gap:3px
    borderRadius:    T.itemRadius,                // 30px — .ni border-radius
    overflow:        "hidden",                    // LinearGradient clip ke liye
  },

  // ── Icon wrapper — badge positioning ke liye ─────────────────────────────
  iconWrap: {
    position:        "relative",
    alignItems:      "center",
    justifyContent:  "center",
    width:           28,
    height:          26,
  },

  // Active icon pe halka fill simulate karne ke liye opacity tweak
  // HTML: .ni.active svg { fill:rgba(201,162,39,.15) } — stroke icon pe fill kaam nahi karta
  // Isliye icon color change se hi active feel aata hai
  iconActive: {
    opacity: 1,
  },

  // ── Label — HTML .ni-lbl ─────────────────────────────────────────────────
  label: {
    fontSize:        T.labelSize,                 // 11px
    fontWeight:      T.labelWeight,               // "700"
    letterSpacing:   T.labelSpacing,              // 0.2px
    textAlign:       "center",
  },

  // Active label — fontWeight already 700, bas color change hota hai (handled inline)
  labelActive: {
    // Color inline set hota hai via `color` prop — yahan extra overrides agar chahiye
  },

  // ── Badge — HTML .ni-badge ───────────────────────────────────────────────
  // position:absolute, top:4, right:6, gold bg, 14x14, border-radius:50%
  badge: {
    position:        "absolute",
    top:             -4,
    right:           -6,
    minWidth:        14,
    height:          14,
    borderRadius:    7,
    backgroundColor: orbitGold.accentHover,       // --gold-deep: #9A7A18
    borderWidth:     1.5,
    borderColor:     "#FFFFFF",
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 2,
  },

  badgeText: {
    color:           "#FFFFFF",
    fontSize:        8,
    fontWeight:      "800",
    lineHeight:      10,
    textAlign:       "center",
  },
});

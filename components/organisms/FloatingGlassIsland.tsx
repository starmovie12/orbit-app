/**
 * components/organisms/FloatingGlassIsland.tsx
 *
 * CROWD WORLD — Floating Glass Island Navigation Bar
 * Blueprint v5.0 BAAP EDITION · LAW 13 + Rule 03 + Rule 04 COMPLIANT
 * Production Fix: Gold Rim absolute positioning (v5.0.1 — pixel-perfect hairline)
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * The primary navigation surface of CROWD WORLD — a 280×56px dark glass pill
 * floating 16px above the device safe-area-bottom with backdrop blur, gold rim
 * hairline, and a warm drop shadow. Appears on every authenticated screen.
 *
 * This is the STANDALONE organism version of the Glass Island. The Expo Router
 * integration lives in app/(tabs)/_layout.tsx which wires it to expo-router's
 * Tabs API. This component is a self-contained reusable organism that accepts
 * props directly — use it for modals, custom layouts, or testing.
 *
 * ── GLASS ISLAND SPEC (LAW 13 · Part 1 § Sec 2 [8] · Part 3 § 2) ────────────
 *
 *   Shape       : 280 × 56px pill · radius 28px (full pill)
 *   Background  : rgba(20, 16, 12, 0.85) — Warm dark navy (Part 3 § 2 refinement)
 *   BlurView    : tint="dark" intensity=85 (iOS native) · rgba fallback (Android)
 *   Border      : 0.5px rgba(255,255,255,0.12) — glass.border token
 *   Shadow      : 0 8px 32px rgba(20,16,12,0.40) — glass.shadow token
 *   Gold Rim    : 1px rgba(226,198,107,0.40) hairline at pill top
 *                  position:absolute · top:1 · left:12 · width:256px
 *                  (pixel-perfect anchor — no flex rounding artifacts)
 *   Z-Index     : 950 (Rule 04: Feed < Input(935) < GlassIsland(950))
 *   Position    : 16px above safe-area-bottom · absolute · centered
 *
 * ── 4 TABS (icon-only · no labels — LAW 13) ──────────────────────────────────
 *
 *   home      → Feather 'home'        — hyper-local sector chat (primary)
 *   discover  → Feather 'compass'     — featured sectors · trending
 *   wallet    → Feather 'credit-card' — credits · cashout · passes
 *   profile   → User avatar (Rule 03) — ONLY place avatar appears in the app
 *
 * ── ACTIVE TAB STATE ─────────────────────────────────────────────────────────
 *
 *   Icon color  : colors.fg.brand (gold[600] #C9A227 — champagne luxury)
 *   Scale       : 1.12 (spring · springSnap · tension 80 · friction 8)
 *   Glow circle : 36×36 rgba(201,162,39,0.18) gold wash behind icon
 *   Dot         : 4×4px gold-600 · 5px below icon group
 *
 * ── INACTIVE TAB STATE ───────────────────────────────────────────────────────
 *
 *   Icon color  : rgba(255,255,255,0.58) — white at 58% on warm dark navy
 *
 * ── LAW 13 HIDE / SHOW ───────────────────────────────────────────────────────
 *
 *   Driven entirely by useScrollHide hook — both translateY and opacity.
 *   Scroll toward older messages → hide (springBouncy)
 *   Scroll toward latest         → show (springBouncy)
 *   Keyboard opens               → hide (KEYBOARD_HIDE_OFFSET = 120px)
 *   Keyboard closes              → show
 *   Reduced motion: opacity fade only (no translateY animation)
 *
 *   The scrollHandler is exposed via useImperativeHandle so the parent's
 *   FlatList / ScrollView can wire: <FlatList onScroll={glassRef.current?.scrollHandler} />
 *
 * ── RULE 03 — AVATAR PLACEMENT LAW ──────────────────────────────────────────
 *
 *   The user's avatar ONLY appears in the Glass Island Profile tab.
 *   NO avatar anywhere else in the app: not in the header, not in DM lists,
 *   not in message bubbles.
 *
 *   Profile tab rendering:
 *     userAvatarUri provided → Image (circle) with gold ring when active
 *     userAvatarUri absent   → Feather 'user' icon (fallback, no avatar)
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   hooks/useScrollHide.ts
 *   hooks/useHaptics.ts
 *   constants/colors.ts
 *   constants/animations.ts
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   const glassRef = useRef<FloatingGlassIslandHandle>(null);
 *
 *   <FlatList
 *     onScroll={glassRef.current?.scrollHandler}
 *     scrollEventThrottle={16}
 *   />
 *
 *   <FloatingGlassIsland
 *     ref={glassRef}
 *     activeTab="home"
 *     onTabPress={(tab) => router.push(`/${tab}`)}
 *     userAvatarUri={user.avatarUrl}
 *   />
 */

import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView }              from 'expo-blur';
import { Feather }               from '@expo/vector-icons';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';

import { colors, palette, radii, zIndex } from '@/constants/colors';
import { layout }                          from '@/constants/spacing';
import { springConfigs }                   from '@/constants/animations';

import { useScrollHide, type ScrollHideResult } from '@/hooks/useScrollHide';
import { useHaptics }                           from '@/hooks/useHaptics';

// ─── Private design tokens ────────────────────────────────────────────────────
//
// These values are derived from CROWN tokens but require opacity composition
// that isn't available as direct semantic exports. All values are traceable
// to blueprint specifications.

/**
 * Inactive icon color — white at 58% opacity on the warm dark glass surface.
 * Blueprint: "Icon color inactive: rgba(255,255,255,0.58) — white 58% on warm navy"
 * WCAG: white on glass.bg (#14100C) = 11.2:1 → AAA ✅ even at 58% (large icon)
 */
const ICON_INACTIVE = 'rgba(255, 255, 255, 0.58)' as const;

/**
 * Glow circle fill — Champagne Gold (#C9A227 = gold[600]) at 18% opacity.
 * Blueprint Part 1 § 2: "36×36px rgba(197,162,39,0.18) glow circle behind active icon"
 * C9A227 → rgb(201, 162, 39) → rgba(201, 162, 39, 0.18)
 */
const ICON_GLOW_BG = 'rgba(201, 162, 39, 0.18)' as const;

/**
 * Gold rim hairline — palette.gold[400] (#E2C66B = rgb(226,198,107)) at 40%.
 * Blueprint: "1px gold-400 at 40% opacity hairline at pill top"
 */
const GOLD_RIM_COLOR = 'rgba(226, 198, 107, 0.40)' as const;

/** Glass Island icon size — 24px, matches Feather standard grid */
const ICON_SIZE = 24 as const;

/** Active tab scale — spring to 1.12 on focus */
const SCALE_ACTIVE = 1.12 as const;

/** Press-down scale — 0.88 for tactile feedback */
const SCALE_PRESS = 0.88 as const;

/** Glow circle / dot animation duration (ms) */
const GLOW_DURATION = 220 as const;

/** Dot size per blueprint Part 1 § 2: "4×4px golden dot · 5px below icon group" */
const DOT_SIZE = 4 as const;

/** Gap between icon group and active dot */
const DOT_GAP = 5 as const;

/** Glow circle diameter per blueprint: 36×36px */
const GLOW_DIAMETER = 36 as const;

// ─── Screen geometry ──────────────────────────────────────────────────────────
//
// Glass Island is a centered pill. Compute left offset once at module load.
// SCREEN_W handles all standard portrait phone widths (360–430pt).
// Landscape / iPad: CROWD WORLD is portrait-lock — no recompute needed.

const SCREEN_W  = Dimensions.get('window').width;
const PILL_LEFT = (SCREEN_W - layout.glassIslandWidth) / 2; // Centers 280px pill

// ─── Types ────────────────────────────────────────────────────────────────────

/** Tab identifiers — union type enforced at compile time */
export type TabId = 'home' | 'discover' | 'wallet' | 'profile';

/** Feather icon name alias */
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

/**
 * Imperative handle exposed via ref — gives parent access to the scrollHandler.
 *
 * @example
 * const glassRef = useRef<FloatingGlassIslandHandle>(null);
 * <FlatList onScroll={glassRef.current?.scrollHandler} scrollEventThrottle={16} />
 * <FloatingGlassIsland ref={glassRef} ... />
 */
export interface FloatingGlassIslandHandle {
  /**
   * Attach to the FlatList / ScrollView `onScroll` prop.
   * Drives the LAW 13 hide/show behaviour.
   * REQUIRES: `scrollEventThrottle={16}` on the scroll container.
   */
  scrollHandler: ScrollHideResult['scrollHandler'];
}

export interface FloatingGlassIslandProps {
  /**
   * Currently active tab identifier — controls the highlighted tab state.
   * One of: 'home' | 'discover' | 'wallet' | 'profile'
   */
  activeTab: TabId | string;

  /**
   * Called when a tab icon is pressed. Receives the tab id string.
   * Parent is responsible for navigation (router.push / router.replace).
   *
   * @example onTabPress={(tab) => router.push(`/(tabs)/${tab}`)}
   */
  onTabPress: (tab: TabId) => void;

  /**
   * Remote URL for the user's avatar image.
   * Rule 03 (NON-NEGOTIABLE): avatar ONLY renders in the Profile tab of the
   * Glass Island — nowhere else in the app.
   * When undefined/empty: Profile tab falls back to Feather 'user' icon.
   */
  userAvatarUri?: string;
}

// ─── Tab configuration ────────────────────────────────────────────────────────

interface TabConfig {
  id:       TabId;
  icon:     FeatherIconName;
  /** Accessibility label — NOT shown visually (LAW 13: icon-only) */
  label:    string;
  /** Screen reader action hint (Hinglish — matches Part 2 § 8 a11y spec) */
  a11yHint: string;
}

const TABS: readonly TabConfig[] = [
  {
    id:       'home',
    icon:     'home',
    label:    'Home',
    a11yHint: 'Apne sector ka chat kholo',
  },
  {
    id:       'discover',
    icon:     'compass',
    label:    'Discover',
    a11yHint: 'Trending sectors aur earning discover karo',
  },
  {
    id:       'wallet',
    icon:     'credit-card',
    label:    'Wallet',
    a11yHint: 'Credits, cashout aur passes dekho',
  },
  {
    id:       'profile',
    icon:     'user',
    label:    'Profile',
    a11yHint: 'Apna profile, achievements aur settings dekho',
  },
] as const;

// ─── Sub-component: TabItem ───────────────────────────────────────────────────
//
// Renders one icon inside the Glass Island pill.
//
// Animated values:
//   scaleAnim — icon scale: 1.0 → SCALE_ACTIVE (1.12) on focus · springSnap
//   glowAnim  — glow circle + dot opacity: 0 → 1 on focus · 220ms timing
//   pressAnim — press feedback: 1.0 → SCALE_PRESS (0.88) → 1.0
//
// Profile tab special treatment (Rule 03):
//   userAvatarUri provided → circular Image with gold active ring
//   userAvatarUri absent   → Feather 'user' fallback icon
//   The avatar is ONLY visible here — Rule 03 non-negotiable.

interface TabItemProps {
  config:       TabConfig;
  focused:      boolean;
  onPress:      () => void;
  onLongPress?: () => void;
  /** Only consumed by the 'profile' tab (Rule 03) */
  userAvatarUri?: string;
}

const TabItem = memo<TabItemProps>(({
  config,
  focused,
  onPress,
  onLongPress,
  userAvatarUri,
}) => {
  const { impactLight, impactMedium } = useHaptics();

  // ── Animated values — created once, never reset ───────────────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // ── Focus change → icon scale spring + glow fade (parallel) ──────────────
  // springSnap (tension:80 · friction:8): medium snap, subtle settle.
  // Blueprint spec for Glass Island tab active scale.
  useEffect(() => {
    Animated.parallel([
      // Icon scale — springSnap for snappy but elastic response
      Animated.spring(scaleAnim, {
        toValue: focused ? SCALE_ACTIVE : 1,
        ...springConfigs.springSnap,        // tension:80 · friction:8
      }),
      // Glow circle + active dot — 220ms crossfade
      Animated.timing(glowAnim, {
        toValue:         focused ? 1 : 0,
        duration:        GLOW_DURATION,     // 220ms
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scaleAnim, glowAnim]);

  // ── Press in: compress to 0.88 (70ms — fast tactile snap) ────────────────
  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue:         SCALE_PRESS,         // 0.88
      duration:        70,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  // ── Press out: spring back to 1.0 (stiff — quick, no lingering bounce) ───
  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 1,
      ...springConfigs.springStiff,         // tension:200 · friction:18
    }).start();
  }, [pressAnim]);

  // ── Tap: impactLight (Q13: "Glass Island tab tap") + navigate ─────────────
  const handlePress = useCallback(() => {
    impactLight();                           // Q13 · Glass Island tab tap → Light
    onPress();
  }, [impactLight, onPress]);

  // ── Long press: impactMedium (Q13: "Long-press") + optional callback ───────
  const handleLongPress = useCallback(() => {
    impactMedium();
    onLongPress?.();
  }, [impactMedium, onLongPress]);

  // ── Profile tab: should we render avatar or fallback icon? ────────────────
  // Rule 03: avatar ONLY in this component, ONLY in the Profile tab.
  const isProfile   = config.id === 'profile';
  const showAvatar  = isProfile && Boolean(userAvatarUri);

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
      style={styles.tabPressable}
      // Extended hit area — meets 44px Rule 5.Q minimum touch target
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      {/* Press-scale outer wrapper */}
      <Animated.View style={[styles.tabInner, { transform: [{ scale: pressAnim }] }]}>

        {/* Icon scale + glow wrapper */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>

          {/* Glow circle — 36×36 gold wash · opacity 0→1 on focus */}
          <Animated.View style={[styles.glowCircle, { opacity: glowAnim }]} />

          {showAvatar ? (
            // ── PROFILE TAB WITH AVATAR (Rule 03) ────────────────────────────
            // Avatar renders ONLY here — in no other component in the app.
            // Active: 2px gold border ring (reinforces identity + active state)
            // Inactive: 1px white-30% ring (subtle outline, doesn't compete)
            <Image
              source={{ uri: userAvatarUri }}
              style={[
                styles.avatarImg,
                focused ? styles.avatarImgActive : styles.avatarImgInactive,
              ]}
              accessibilityLabel="Mera profile"
            />
          ) : (
            // ── ICON TAB (Home · Discover · Wallet · Profile fallback) ──────
            <Feather
              name={config.icon}
              size={ICON_SIZE}
              color={focused ? colors.fg.brand : ICON_INACTIVE}
              // gold[600] #C9A227 active · white-58% inactive
            />
          )}

        </Animated.View>

        {/* Active dot — 4×4px gold · 5px below icon group · opacity follows glowAnim */}
        <Animated.View style={[styles.activeDot, { opacity: glowAnim }]} />

      </Animated.View>
    </Pressable>
  );
});

TabItem.displayName = 'FloatingGlassIsland.TabItem';

// ─── Sub-component: PillContents ─────────────────────────────────────────────
//
// Inner layout of the pill — shared between BlurView (iOS) and View (Android).
// Renders: gold rim hairline + 4-tab row.

interface PillContentsProps {
  activeTab:    string;
  onTabPress:   (tab: TabId) => void;
  userAvatarUri?: string;
}

const PillContents = memo<PillContentsProps>(({ activeTab, onTabPress, userAvatarUri }) => (
  <>
    {/* Gold rim hairline at top of pill — "1px gold-400 at 40% opacity" */}
    {/* Inset 12px each side: 280 - 24 = 256px */}
    <View style={styles.goldRim} pointerEvents="none" />

    {/* 4-tab row */}
    <View style={styles.tabsRow}>
      {TABS.map((config) => (
        <TabItem
          key={config.id}
          config={config}
          focused={activeTab === config.id}
          onPress={() => onTabPress(config.id)}
          userAvatarUri={config.id === 'profile' ? userAvatarUri : undefined}
        />
      ))}
    </View>
  </>
));

PillContents.displayName = 'FloatingGlassIsland.PillContents';

// ─── Main component ───────────────────────────────────────────────────────────
//
// Positioning strategy:
//   position: 'absolute' · left: PILL_LEFT · bottom: bottomPosition
//   bottomPosition = layout.glassIslandBottomGap (16) + insets.bottom
//   Centered on any phone width via PILL_LEFT = (screenW - 280) / 2
//
// LAW 13 animation:
//   translateY and opacity from useScrollHide — already includes insets.bottom
//   in the scrollHideOffset calculation inside the hook.
//
// Platform surface:
//   iOS     → BlurView tint="dark" intensity=85 (real UIBlurEffect backdrop blur)
//   Android → View rgba(20,16,12,0.85) solid (BlurView experimental on Android)
//   Both share identical PillContents, border, radius, and shadow.
//
// forwardRef exposes scrollHandler for parent FlatList wiring.

function FloatingGlassIslandBase(
  { activeTab, onTabPress, userAvatarUri }: FloatingGlassIslandProps,
  ref: React.ForwardedRef<FloatingGlassIslandHandle>,
) {
  const insets = useSafeAreaInsets();

  // Distance from screen bottom to bottom edge of the pill.
  // layout.glassIslandBottomGap = 16px + device safe area (home indicator)
  const bottomPosition = layout.glassIslandBottomGap + insets.bottom;

  // ── LAW 13 scroll hide / show ──────────────────────────────────────────────
  const { scrollHandler, translateY, opacity } = useScrollHide();

  // Expose scrollHandler to parent via ref so it can attach to its FlatList.
  useImperativeHandle(ref, () => ({ scrollHandler }), [scrollHandler]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      testID="crowd-glass-island"
      accessibilityRole="tablist"
      accessibilityLabel="Navigation: Home, Discover, Wallet, Profile"
      style={[
        styles.container,
        {
          bottom:    bottomPosition,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      // box-none: the container itself doesn't intercept touches
      // (only the individual Pressable TabItems do)
      pointerEvents="box-none"
    >
      {/*
       * Platform surface split — mirrors Glass Island strategy in _layout.tsx:
       *
       * iOS:
       *   BlurView tint="dark" intensity=85 → real UIBlurEffect backdrop blur
       *   overflow:hidden clips the blur effect to the pill's rounded corners
       *   No explicit backgroundColor needed (BlurView handles it)
       *
       * Android:
       *   View with glassBg rgba(20,16,12,0.85) solid warm navy
       *   BlurView is still experimental on Android — rgba solid is production-safe
       *   Gold rim and glow circles render identically to iOS
       */}
      {Platform.OS === 'ios' ? (
        <BlurView
          tint="dark"
          intensity={85}
          style={styles.pill}
        >
          <PillContents
            activeTab={activeTab}
            onTabPress={onTabPress}
            userAvatarUri={userAvatarUri}
          />
        </BlurView>
      ) : (
        <View style={[styles.pill, styles.pillAndroid]}>
          <PillContents
            activeTab={activeTab}
            onTabPress={onTabPress}
            userAvatarUri={userAvatarUri}
          />
        </View>
      )}
    </Animated.View>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
//
// forwardRef wraps the base function → exposes the ref handle.
// memo wraps forwardRef result → re-renders only when props change.
// (React.memo wrapping a forwardRef component is fully supported.)
//
// At the call site:
//   const glassRef = useRef<FloatingGlassIslandHandle>(null);
//   <FloatingGlassIsland ref={glassRef} activeTab="home" onTabPress={...} />

const FloatingGlassIslandForwarded = forwardRef<
  FloatingGlassIslandHandle,
  FloatingGlassIslandProps
>(FloatingGlassIslandBase);

FloatingGlassIslandForwarded.displayName = 'FloatingGlassIsland';

export default memo(FloatingGlassIslandForwarded);

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   layout.glassIslandWidth   = 280      pill width (blueprint exact)
//   layout.glassIslandHeight  = 56       pill height (blueprint exact)
//   radii['4xl']              = 28       full pill (height / 2)
//   zIndex.glassIsland        = 950      Rule 04 stacking order
//   palette.glass.border      = rgba(255,255,255,0.12) glass rim
//   colors.shadow.glass       = warm drop shadow tokens
//   colors.fg.brand           = gold[600] #C9A227 active icon + dot + avatar ring
//   palette.glass.bg          = rgba(20,16,12,0.85) Android solid fallback
//   radii.full                = 9999     circle — avatar + active dot

const styles = StyleSheet.create({

  // ── Animated outer container — absolute centered pill ─────────────────────
  // left: PILL_LEFT centers the 280px pill on any portrait screen.
  // bottom: set inline (layout.glassIslandBottomGap + insets.bottom)
  // shadow: glass.shadow — warm drop shadow per Part 3 § 2 palette
  container: {
    position:  'absolute',
    left:      PILL_LEFT,                           // (screenW - 280) / 2
    width:     layout.glassIslandWidth,             // 280px
    zIndex:    zIndex.glassIsland,                  // 950

    // glass.shadow: 0 8px 32px rgba(20,16,12,0.40)
    // Spread via colors.shadow.glass token
    ...colors.shadow.glass,
  },

  // ── Glass pill — shape + overflow + border ────────────────────────────────
  // overflow:'hidden' clips BlurView and glow circles to the rounded corners.
  // Also clips the absolute goldRim to the pill bounds (no overflow bleed).
  // flexDirection:'column' retained for tabsRow which now fills full 56px height.
  // (goldRim is position:'absolute' — removed from flex flow entirely)
  pill: {
    width:         layout.glassIslandWidth,         // 280px
    height:        layout.glassIslandHeight,        // 56px
    borderRadius:  radii['4xl'],                    // 28px — full pill (height/2)
    overflow:      'hidden',                        // clips blur + glow to pill
    borderWidth:   0.5,                             // ultra-thin glass rim
    borderColor:   palette.glass.border,            // rgba(255,255,255,0.12)
    flexDirection: 'column',
  },

  // ── Android fallback — solid warm dark navy (no BlurView) ─────────────────
  pillAndroid: {
    backgroundColor: palette.glass.bg,             // rgba(20,16,12,0.85)
  },

  // ── Gold rim hairline at top of pill ─────────────────────────────────────
  // Blueprint Part 1 § 2: "1px gold-400 at 40% opacity hairline at top of pill,
  //   inset 12px each side"
  //
  // FIX (v5.0 production): Migrated from flex/margin to absolute positioning.
  //
  // Why the old approach was wrong:
  //   The previous implementation used marginTop:2 + marginBottom:1 inside a
  //   flexDirection:'column' pill. On Android and older iOS, sub-pixel flex
  //   rounding can shift a 1px line by 1pt — producing a blurry or off-center
  //   hairline that is especially visible on high-DPI screens.
  //
  // Why absolute positioning is correct for hairlines:
  //   position:'absolute' + top:1 + left:12 anchors the line directly to the
  //   pill's top border edge at the sub-pixel level. The pill's overflow:'hidden'
  //   clips it correctly. The line is completely removed from the flex flow, so
  //   tabsRow (flex:1) now cleanly fills all 56px of pill height without any
  //   margin compensation — a purer, more predictable layout.
  //
  //   top:1    → 1px inside the pill's top border (clears the 0.5px border)
  //   left:12  → 12px inset from left edge (blueprint exact: "inset 12px each side")
  //   width    → layout.glassIslandWidth - 24 = 256px (280 - 12 - 12)
  //   height:1 → single logical pixel (renders as 1pt on all screens)
  //
  // Note: borderRadius removed — effectively invisible on a 1px line and adds
  //   unnecessary sub-pixel rounding overhead.
  goldRim: {
    position:        'absolute',
    top:             1,                              // 1pt inside pill top border
    left:            12,                             // 12px inset — blueprint exact
    height:          1,
    width:           layout.glassIslandWidth - 24,  // 256px (12px inset each side)
    backgroundColor: GOLD_RIM_COLOR,                // rgba(226,198,107,0.40)
  },

  // ── Tabs row — 4 equal-width columns ─────────────────────────────────────
  // flex:1 fills full pill height (56px) — goldRim is now absolute so tabsRow
  // is the only flex child and owns all 56px.
  // space-around spaces 4 tabs across 280px pill.
  tabsRow: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-around',
    paddingHorizontal: 6,                           // CW.pillPadH = 6px
  },

  // ── Tab pressable touch area ──────────────────────────────────────────────
  // flex:1 → equal widths (≈ 67px each after 12px total horizontal padding)
  // height fills pill minus goldRim zone (56 - 4px = 52px)
  // minWidth:44 → iOS HIG + Material Design minimum
  tabPressable: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    height:         layout.glassIslandHeight - 6,   // 50px
    minWidth:       44,
  },

  // ── Tab inner — press-scale animation container ───────────────────────────
  tabInner: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Icon wrap — GLOW_DIAMETER × GLOW_DIAMETER (36×36) ───────────────────
  // Sizes to the glow circle diameter so glow exactly underlays the icon.
  // position:'relative' anchors the absolute glow circle overlay.
  iconWrap: {
    width:          GLOW_DIAMETER,                  // 36
    height:         GLOW_DIAMETER,                  // 36
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  // ── Glow circle — 36×36 gold halo behind active icon ─────────────────────
  // Blueprint: "36×36px rgba(197,162,39,0.18) glow circle"
  // absoluteFillObject centers it perfectly in the 36×36 iconWrap.
  // opacity: 0→1 driven by glowAnim
  glowCircle: {
    ...StyleSheet.absoluteFillObject,
    width:           GLOW_DIAMETER,                 // 36
    height:          GLOW_DIAMETER,                 // 36
    borderRadius:    GLOW_DIAMETER / 2,             // 18 — perfect circle
    backgroundColor: ICON_GLOW_BG,                 // rgba(201,162,39,0.18)
  },

  // ── Active dot — 4×4px gold · 5px below icon group ───────────────────────
  // Blueprint exact: "4×4px golden dot · 5px below icon group"
  // opacity: 0→1 driven by same glowAnim as glow circle (parallel crossfade)
  activeDot: {
    width:           DOT_SIZE,                      // 4
    height:          DOT_SIZE,                      // 4
    borderRadius:    radii.full,                    // 9999 → perfect circle
    backgroundColor: colors.fg.brand,              // gold[600] #C9A227
    marginTop:       DOT_GAP,                       // 5px below iconWrap
  },

  // ── Profile tab avatar (Rule 03) ─────────────────────────────────────────
  // Circle image · same size as icon (24×24) · fills iconWrap center.
  // Active: 2px gold border → visually matches gold active icon color
  // Inactive: 1px white-30% border → subtle outline, unobtrusive
  //
  // The Avatar ONLY exists in this component.
  // Rule 03 Non-Negotiable: nowhere else in the app.
  avatarImg: {
    width:        ICON_SIZE,                        // 24 — matches icon grid
    height:       ICON_SIZE,                        // 24
    borderRadius: radii.full,                       // 9999 → circle
  },
  avatarImgActive: {
    borderWidth:  2,
    borderColor:  colors.fg.brand,                 // gold[600] — active identity ring
  },
  avatarImgInactive: {
    borderWidth:  1,
    borderColor:  'rgba(255, 255, 255, 0.30)',      // white-30% — subtle inactive ring
  },
});

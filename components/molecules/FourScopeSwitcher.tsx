/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.9  COMPLETE LAYOUT REWRITE               ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                    ║
 * ║  Phase 1.3 · App Architecture                                           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.9 ROOT CAUSE FIXES (3 asli bugs):                                   ║
 * ║                                                                         ║
 * ║  BUG-A  gap + overflow:hidden = tabs overflow ho rahe the               ║
 * ║         RN mein gap property + overflow:hidden = tabs bahar nikalte     ║
 * ║         hain. Fix: gap hata diya, tabs pe marginRight se TAB_GAP.       ║
 * ║                                                                         ║
 * ║  BUG-B  Animated.View pe width:'100%' kaam nahi karta                   ║
 * ║         Chevron bahar nikal rahi thi kyunki Animated.View tab width     ║
 * ║         se bind nahi tha. Fix: Pressable full flex:1, Animated.View     ║
 * ║         sirf scale transform ke liye, tabContent regular View hai.      ║
 * ║                                                                         ║
 * ║  BUG-C  Capsule X position galat tha                                    ║
 * ║         capsuleX = index*(tw+GAP) → H_PAD ignore ho raha tha.          ║
 * ║         Fix: capsuleX = H_PAD + CAPSULE_H_INSET + index*(tw+GAP).      ║
 * ║         Aur capsule left:0 kiya (translateX mein offset hai).           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.8 — minWidth:0 on tab + label                                       ║
 * ║  v7.7 — gap: 3→2                                                        ║
 * ║  v7.6 — capsule left fix, World hasPicker:false                         ║
 * ║  v7.5 — width:100%, capsuleW SharedValue, ellipsizeMode                 ║
 * ║  v7.4 — HTML pixel-sync (38px, 6px radius, brand colors)               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { FONT_BODY } from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ChatScope = 'world' | 'country' | 'city' | 'sector';

interface ScopeConfig {
  readonly key: ChatScope;
  readonly emoji: string;
  readonly defaultLabel: string;
  readonly hasPicker: boolean;
  readonly a11yLabel: string;
}

export interface ScopeLabel {
  readonly country: string;
  readonly city: string;
  readonly sector: string;
  readonly countryEmoji: string;
}

export interface FourScopeSwitcherProps {
  readonly activeScope: ChatScope;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen: (scope: ChatScope) => void;
  readonly labels: ScopeLabel;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPES
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES: readonly ScopeConfig[] = [
  {
    key: 'world',
    emoji: '🌍',
    defaultLabel: 'World',
    hasPicker: false,
    a11yLabel: 'World chat scope. Tap to select.',
  },
  {
    key: 'country',
    emoji: '🇮🇳',
    defaultLabel: 'India',
    hasPicker: true,
    a11yLabel: 'Country chat scope. Tap to select or change.',
  },
  {
    key: 'city',
    emoji: '🏙️',
    defaultLabel: 'Mumbai',
    hasPicker: true,
    a11yLabel: 'City chat scope. Tap to select or change.',
  },
  {
    key: 'sector',
    emoji: '📍',
    defaultLabel: 'Bandra W',
    hasPicker: true,
    a11yLabel: 'Sector chat scope. Tap to select or change.',
  },
] as const;

const N_TABS = SCOPES.length;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_HEIGHT    = 38 as const;
const H_PAD           = 5  as const;
const TAB_GAP         = 2  as const;
const CAPSULE_INSET   = 3  as const;
const CAPSULE_H_INSET = 2  as const;

const SPRING_SLIDE: WithSpringConfig = {
  mass: 1,
  stiffness: 250,
  damping: 24,
  overshootClamping: false,
} as const;

const SPRING_PRESS: WithSpringConfig = {
  mass: 1,
  stiffness: 400,
  damping: 25,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHEVRON
// ─────────────────────────────────────────────────────────────────────────────

const Chevron = memo(({ isActive }: { readonly isActive: boolean }) => (
  <View
    style={[
      styles.chevron,
      { borderTopColor: isActive ? '#C8960C' : '#7A5C2E' },
    ]}
  />
));
Chevron.displayName = 'Chevron';

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE TAB
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeTabProps {
  readonly scopeCfg: ScopeConfig;
  readonly index: number;
  readonly isActive: boolean;
  readonly isLast: boolean;
  readonly label: string;
  readonly emoji: string;
  readonly onPress: (scope: ChatScope, index: number) => void;
}

const ScopeTab = memo(({
  scopeCfg,
  index,
  isActive,
  isLast,
  label,
  emoji,
  onPress,
}: ScopeTabProps): React.JSX.Element => {

  const scale = useSharedValue<number>(1);

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), []);

  const handlePressIn  = useCallback(() => { scale.value = withSpring(0.95, SPRING_PRESS); }, [scale]);
  const handlePressOut = useCallback(() => { scale.value = withSpring(1,    SPRING_PRESS); }, [scale]);
  const handlePress    = useCallback(() => { onPress(scopeCfg.key, index); }, [onPress, scopeCfg.key, index]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      // BUG-A FIX: gap hata ke marginRight diya — overflow:hidden ke saath safe
      style={[styles.tab, !isLast && styles.tabGap]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={scopeCfg.a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      {/*
        BUG-B FIX: 2-layer approach
        Layer 1 — Animated.View: sirf scale transform, flex:1 se Pressable fill karta hai
        Layer 2 — Regular View (tabContent): emoji+label+chevron row, overflow:hidden yahan kaam karta hai
      */}
      <Animated.View style={[styles.tabInner, pressAnimStyle]}>
        <View style={styles.tabContent}>
          <Text
            style={styles.emoji}
            allowFontScaling={false}
            selectable={false}
          >
            {emoji}
          </Text>

          <Text
            style={[
              styles.label,
              isActive ? styles.labelActive : styles.labelInactive,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling={false}
            selectable={false}
          >
            {label}
          </Text>

          {scopeCfg.hasPicker && <Chevron isActive={isActive} />}
        </View>
      </Animated.View>
    </Pressable>
  );
});
ScopeTab.displayName = 'ScopeTab';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope,
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [tabWidth, setTabWidth] = useState<number>(0);
  const tabWidthRef    = useRef<number>(0);
  const isFirstRender  = useRef<boolean>(true);
  const userInitiated  = useRef<boolean>(false);

  const capsuleX = useSharedValue<number>(0);
  const capsuleW = useSharedValue<number>(0);

  const activeIndex = Math.max(0, SCOPES.findIndex((s) => s.key === activeScope));

  const capsuleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
    width: capsuleW.value,
  }), []);

  /**
   * BUG-C FIX: Capsule X
   * track mein paddingHorizontal: H_PAD hai
   * absolute element content-area se count karta hai (padding ke andar se)
   * tab 0 ki left edge = 0 (content-area mein)
   * tab n ki left edge = n * (tw + TAB_GAP)
   * capsule = tab left edge + CAPSULE_H_INSET (2px andar se)
   */
  const calcCapsuleX = useCallback(
    (index: number, tw: number): number => index * (tw + TAB_GAP) + CAPSULE_H_INSET,
    [],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const totalW = e.nativeEvent.layout.width;
    // totalW includes H_PAD on each side
    const tw = (totalW - H_PAD * 2 - TAB_GAP * (N_TABS - 1)) / N_TABS;

    tabWidthRef.current = tw;
    setTabWidth(tw);
    capsuleW.value = tw - CAPSULE_H_INSET * 2;
    capsuleX.value = calcCapsuleX(activeIndex, tw);
  }, [capsuleX, capsuleW, activeIndex, calcCapsuleX]);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (userInitiated.current)  { userInitiated.current  = false; return; }

    const tw = tabWidthRef.current;
    if (tw > 0) {
      capsuleX.value = withSpring(calcCapsuleX(activeIndex, tw), SPRING_SLIDE);
    }
  }, [activeScope, activeIndex, capsuleX, calcCapsuleX]);

  const handleTabPress = useCallback((scope: ChatScope, index: number): void => {
    void Haptics.selectionAsync();

    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    userInitiated.current = true;
    capsuleX.value = withSpring(calcCapsuleX(index, tabWidthRef.current), SPRING_SLIDE);
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen, capsuleX, calcCapsuleX]);

  const getLabel = useCallback((scope: ChatScope, fallback: string): string => {
    switch (scope) {
      case 'country': return labels.country || fallback;
      case 'city':    return labels.city    || fallback;
      case 'sector':  return labels.sector  || fallback;
      default:        return fallback;
    }
  }, [labels]);

  const getEmoji = useCallback((scope: ChatScope, fallback: string): string =>
    scope === 'country' ? (labels.countryEmoji || fallback) : fallback,
  [labels]);

  return (
    <View
      style={styles.track}
      onLayout={handleLayout}
      accessibilityRole="tablist"
      accessibilityLabel="CROWN Chat scope selector"
    >
      {tabWidth > 0 && (
        <Animated.View
          style={[styles.capsule, capsuleAnimStyle]}
          pointerEvents="none"
        />
      )}

      {SCOPES.map((scopeCfg, index) => (
        <ScopeTab
          key={scopeCfg.key}
          scopeCfg={scopeCfg}
          index={index}
          isActive={scopeCfg.key === activeScope}
          isLast={index === N_TABS - 1}
          label={getLabel(scopeCfg.key, scopeCfg.defaultLabel)}
          emoji={getEmoji(scopeCfg.key, scopeCfg.emoji)}
          onPress={handleTabPress}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: TRACK_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    // BUG-A FIX: gap yahan nahi — tabs ke marginRight se spacing
    overflow: 'hidden',
  },

  capsule: {
    position: 'absolute',
    // BUG-C FIX: left:0 — translateX mein already offset calculate hai
    // (H_PAD padding ke andar absolute start hota hai, sirf CAPSULE_H_INSET chahiye)
    left: 0,
    top: CAPSULE_INSET,
    bottom: CAPSULE_INSET,
    backgroundColor: 'rgba(200,150,12,0.18)',
    borderRadius: 6,
    zIndex: 0,
  },

  tab: {
    flex: 1,
    minWidth: 0,        // flex shrink sahi kaam kare
    height: '100%',
    zIndex: 1,
    backgroundColor: 'transparent',
  },

  // BUG-A FIX: gap ki jagah marginRight (last tab pe nahi lagega)
  tabGap: {
    marginRight: TAB_GAP,
  },

  // BUG-B FIX: Animated.View — sirf scale, layout nahi
  tabInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // BUG-B FIX: Regular View — overflow:hidden yahan properly kaam karta hai
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,             // emoji ↔ label ↔ chevron = 2px
    paddingHorizontal: 2,
    maxWidth: '100%',
    overflow: 'hidden',
  },

  emoji: {
    fontSize: 13,
    lineHeight: 16,
    flexShrink: 0,
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    flexShrink: 1,
    minWidth: 0,        // label shrink ho, chevron andar rahe
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  labelInactive: {
    fontWeight: '400',
    fontFamily: FONT_BODY.regular,
    color: '#7A5C2E',
  },

  labelActive: {
    fontWeight: '600',
    fontFamily: FONT_BODY.semiBold,
    color: '#1A1208',
  },

  chevron: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopWidth: 4.5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    flexShrink: 0,
    marginTop: 1,
  },
});

export default FourScopeSwitcher;

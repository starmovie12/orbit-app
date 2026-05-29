/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.8  TAB OVERFLOW + CHEVRON FIX             ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                    ║
 * ║  Phase 1.3 · App Architecture                                           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.8 FIXES (2 bugs resolved):                                          ║
 * ║  FIX-7  Tab overflow: tab ko minWidth:0 diya — flex:1 tab bina          ║
 * ║          minWidth:0 ke shrink nahi karta, tabs overflow ho rahe the.     ║
 * ║  FIX-8  Chevron andar aane ke liye: tabContent width:'100%' kiya,       ║
 * ║          label minWidth:0 diya, Animated.View style fix — chevron ab     ║
 * ║          hamesha tab ke andar rahega, bahar nahi niklega.                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.7 FIXES (1 change):                                                 ║
 * ║  FIX-6  tabContent gap: 3 → 2  (emoji ↔ label ↔ chevron ke beech       ║
 * ║          exactly 2px space — user request)                              ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.6 FIXES (2 bugs resolved):                                          ║
 * ║  FIX-4  capsule left: H_PAD + CAPSULE_H_INSET → CAPSULE_H_INSET only   ║
 * ║          Yoga mein position:absolute content-area se count hota hai,     ║
 * ║          border se nahi. H_PAD add karne se capsule 5px right shift     ║
 * ║          hota tha → last tab pe 3px overflow → chipka dikhta tha.       ║
 * ║          Fix: left:2 → 2px inset har side pe correctly lagta hai.       ║
 * ║  FIX-5  World tab: hasPicker:false → chevron nahi dikhega               ║
 * ║          World ki koi list nahi khulti, arrow misleading tha.            ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.5 FIXES (3 bugs resolved):                                          ║
 * ║  FIX-1  track: width:'100%' → was not filling row2; tabs centered       ║
 * ║  FIX-2  capsuleW: useSharedValue (was tabWidthRef.current in worklet    ║
 * ║          → UI thread always read 0 → capsule invisible → overflow)      ║
 * ║  FIX-3  tabContent: maxWidth:'100%' + ellipsizeMode="tail" on label     ║
 * ║          → long city names truncate: "Chandigarh"→"Chandigar…"          ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.4 CHANGES (HTML crown-scope-switcher v7.1 pixel-sync):              ║
 * ║  1. TRACK_HEIGHT: 44 → 38px  (HTML token --row-height: 38px)            ║
 * ║  2. Track bg: colors.bg.surface → transparent (parent bg shows)         ║
 * ║  3. Track radius: 12 → 6px  (HTML token --radius-md: 6px)               ║
 * ║  4. Capsule bg: fixed → rgba(200,150,12,0.18) (HTML --brand-subtle)     ║
 * ║  5. Capsule radius: 8 → 6px  (flat pill, no shadow — HTML spec)         ║
 * ║  6. Inactive text: #7A5C2E  (HTML --fg-text-muted)                      ║
 * ║  7. Active text: #1A1208    (HTML --fg-text-strong)                     ║
 * ║  8. Active chevron: #C8960C (HTML --fg-brand)                           ║
 * ║  9. Font: Inter (FONT_BODY.regular / .semiBold) — DM Sans equiv         ║
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

// ── V5 SEMANTIC TOKENS ───────────────────────────────────────────────────────
import { FONT_BODY } from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
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
// SCOPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES: readonly ScopeConfig[] = [
  {
    key: 'world',
    emoji: '🌍',
    defaultLabel: 'World',
    hasPicker: false,                          // FIX: World ka koi picker nahi — arrow hata diya
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
// V5 CONSTANTS (Optical & Physics)
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 38 as const; // PRD §1.3.3 Row 2 — 38px locked
const H_PAD = 5 as const;         // 5px outer padding — World tab left / Sector tab right (was 15)
const TAB_GAP = 2 as const;       // 2px gap between each tab
const CAPSULE_INSET = 3 as const; // Capsule vertical inset (top: 3, bottom: 3)
const CAPSULE_H_INSET = 2 as const; // 2px horizontal inset — capsule tab edge se chipka na lage

// Liquid Spring for Capsule Sliding
const SPRING_SLIDE: WithSpringConfig = {
  mass: 1,
  stiffness: 250,
  damping: 24,
  overshootClamping: false,
} as const;

// Haptic-synced press squish
const SPRING_PRESS: WithSpringConfig = {
  mass: 1,
  stiffness: 400,
  damping: 25,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optical CSS Border Triangle Chevron
 */
const Chevron = memo(({ isActive }: { readonly isActive: boolean }) => (
  <View
    style={[
      styles.chevron,
      { borderTopColor: isActive ? '#C8960C' : '#7A5C2E' },
    ]}
  />
));
Chevron.displayName = 'Chevron';

/**
 * Individual Scope Tab Button
 */
interface ScopeTabProps {
  readonly scopeCfg: ScopeConfig;
  readonly index: number;
  readonly isActive: boolean;
  readonly label: string;
  readonly emoji: string;
  readonly onPress: (scope: ChatScope, index: number) => void;
}

const ScopeTab = memo(({
  scopeCfg,
  index,
  isActive,
  label,
  emoji,
  onPress,
}: ScopeTabProps): React.JSX.Element => {
  
  const scale = useSharedValue<number>(1);

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), []);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(scopeCfg.key, index);
  }, [onPress, scopeCfg.key, index]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={scopeCfg.a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      <Animated.View style={[styles.tabContent, pressAnimStyle]}>
        <Text style={styles.emoji} allowFontScaling={false} selectable={false}>
          {emoji}
        </Text>

        <Text
          style={[
            styles.label,
            isActive ? styles.labelActive : styles.labelInactive,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"     // FIX-3: "Chandigarh" → "Chandigar…" (was missing!)
          allowFontScaling={false}
          selectable={false}
        >
          {label}
        </Text>

        {scopeCfg.hasPicker && <Chevron isActive={isActive} />}
      </Animated.View>
    </Pressable>
  );
});
ScopeTab.displayName = 'ScopeTab';

/**
 * Main Switcher Component
 */
export function FourScopeSwitcher({
  activeScope,
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {
  
  const [tabWidth, setTabWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);

  const isFirstRender = useRef<boolean>(true);
  const userInitiatedRef = useRef<boolean>(false);

  const capsuleX = useSharedValue<number>(0);
  // FIX-2: capsuleW must be SharedValue — tabWidthRef.current inside a
  //         Reanimated worklet (UI thread) always read 0 (initial value),
  //         making the capsule invisible and content overflow out of it.
  const capsuleW = useSharedValue<number>(0);

  const activeIndex = Math.max(
    0,
    SCOPES.findIndex((s) => s.key === activeScope),
  );

  const capsuleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
    width: capsuleW.value,   // FIX-2: SharedValue — readable on UI thread
  }), []);

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const totalW = e.nativeEvent.layout.width;
    
    // NEW MATH: Account for horizontal padding AND the gaps between tabs
    const availableWidth = totalW - (H_PAD * 2) - (TAB_GAP * (N_TABS - 1));
    const tw = availableWidth / N_TABS;

    tabWidthRef.current = tw;
    setTabWidth(tw);
    capsuleW.value = tw - CAPSULE_H_INSET * 2;   // 2px inset each side — chipka nahi lagega
    
    // Position includes the tab width plus the gap for each previous tab
    capsuleX.value = activeIndex * (tw + TAB_GAP); 
  }, [capsuleX, capsuleW, activeIndex]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (userInitiatedRef.current) {
      userInitiatedRef.current = false;
      return;
    }
    
    const tw = tabWidthRef.current;
    if (tw > 0) {
      capsuleX.value = withSpring(activeIndex * (tw + TAB_GAP), SPRING_SLIDE);
    }
  }, [activeScope, activeIndex, capsuleX]);

  const handleTabPress = useCallback((scope: ChatScope, index: number): void => {
    void Haptics.selectionAsync();

    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    userInitiatedRef.current = true;
    capsuleX.value = withSpring(index * (tabWidthRef.current + TAB_GAP), SPRING_SLIDE);
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen, capsuleX]);

  const getLabel = useCallback((scope: ChatScope, fallback: string): string => {
    switch (scope) {
      case 'country': return labels.country || fallback;
      case 'city':    return labels.city || fallback;
      case 'sector':  return labels.sector || fallback;
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
    width: '100%',                     // FIX-1: fills row2's inner width; was centering before
    height: TRACK_HEIGHT,
    backgroundColor: 'transparent',       // No track bg — parent layout color shows through
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,             // 15px left (World) + 15px right (Sector)
    gap: TAB_GAP,                         // 2px between each tab
    overflow: 'hidden',
  },
  capsule: {
    position: 'absolute',
    left: CAPSULE_H_INSET,                       // FIX-4: sirf 2px — Yoga mein absolute, content-area se count hota hai, H_PAD mat jodo
    top: CAPSULE_INSET,
    bottom: CAPSULE_INSET,
    
    // HTML token: --brand-subtle rgba(200,150,12,0.18) — flat gold pill, no shadow
    backgroundColor: 'rgba(200,150,12,0.18)',
    
    borderRadius: 6,                       // HTML token: --radius-md 6px
    zIndex: 0,
  },
  tab: {
    flex: 1,
    minWidth: 0,          // FIX-7: flex:1 bina minWidth:0 ke shrink nahi karta → overflow
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,                                // icon ↔ label ↔ chevron = 2px gap
    paddingHorizontal: 2,                  // 2px breathing room
    width: '100%',                         // FIX-8: maxWidth→width, Animated.View fills tab
    overflow: 'hidden',                    // clip overflow
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
    minWidth: 0,          // FIX-8: label shrink ho sake — chevron ko tab ke andar rakhta hai
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },
  labelInactive: {
    fontWeight: '400',
    fontFamily: FONT_BODY.regular,        // Inter_400Regular
    color: '#7A5C2E',                     // HTML token: --fg-text-muted
  },
  labelActive: {
    fontWeight: '600',
    fontFamily: FONT_BODY.semiBold,       // Inter_600SemiBold
    color: '#1A1208',                     // HTML token: --fg-text-strong
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

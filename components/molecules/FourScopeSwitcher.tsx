/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v8.0  SEPARATOR VIEW — PIXEL-PERFECT        ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                    ║
 * ║  Phase 1.3 · App Architecture                                           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v8.0 — ROOT CAUSE FIX (v7.9 ka asli bug):                             ║
 * ║                                                                         ║
 * ║  v7.9 mein `marginRight: TAB_GAP` approach use kiya tha.               ║
 * ║  Yeh WRONG tha kyunki:                                                  ║
 * ║                                                                         ║
 * ║  flex:1 + marginRight ke saath:                                         ║
 * ║    Tab 0,1,2 inner width = S/4 - 2  (margin flex space se khaata hai)  ║
 * ║    Tab 3     inner width = S/4      (no margin → 2px WIDER!)            ║
 * ║                                                                         ║
 * ║  → Tabs unequal width hote hain                                         ║
 * ║  → capsuleX math off hota hai (last tab pe 1.5px shift)                ║
 * ║  → Screenshot mein Sector 17 ka capsule slightly misaligned tha        ║
 * ║                                                                         ║
 * ║  v8.0 FIX: Separator View approach                                      ║
 * ║    Fixed-width `View` (width: TAB_GAP) between each pair of tabs.      ║
 * ║    Flex:1 distributes ONLY remaining space (after 3 × 2px separators). ║
 * ║    Each tab gets exactly (S - 6) / 4 — guaranteed equal.               ║
 * ║    Capsule math: index * (tw + TAB_GAP)  — exact, no rounding error.   ║
 * ║                                                                         ║
 * ║  RETAINED FROM v7.9:                                                    ║
 * ║    2-layer render: Animated.View (scale only) + View (content+clip)    ║
 * ║    tab: flex:1, minWidth:0                                              ║
 * ║    label: flexShrink:1, minWidth:0                                      ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  v7.9 — marginRight approach (wrong — tabs unequal)                    ║
 * ║  v7.8 — minWidth:0 on tab + label                                       ║
 * ║  v7.7 — gap: 3→2 in tabContent                                         ║
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

const N_TABS = SCOPES.length; // 4

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_HEIGHT    = 38 as const; // PRD §1.3.3 locked
const H_PAD           = 5  as const; // track ke andar horizontal padding
const TAB_GAP         = 2  as const; // separator View ki width (tabs ke beech)
const CAPSULE_INSET   = 3  as const; // top/bottom inset for capsule
const CAPSULE_H_INSET = 2  as const; // left/right inset (capsule tab se 2px chota)

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
// NOTE: isLast prop hataya — separator View approach mein zarurat nahi
// ─────────────────────────────────────────────────────────────────────────────

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

  const handlePressIn  = useCallback(() => {
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
      style={styles.tab}           // flex:1 only — no marginRight needed anymore
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={scopeCfg.a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      {/*
        2-layer render approach (v7.9 se retain kiya):

        Layer 1 — Animated.View (tabInner):
          Sirf scale transform handle karta hai (press animation).
          flex:1 se Pressable ka poora area fill karta hai.
          Animated.View pe width constraints reliable nahi hote RN mein.

        Layer 2 — Regular View (tabContent):
          emoji + label + chevron ka row yahaan hai.
          overflow:'hidden' regular View pe sahi kaam karta hai.
          maxWidth:'100%' bhi regular View pe properly constrain karta hai.
          Chevron hamesha andar rahegi — bahar nahi niklegi.
      */}
      <Animated.View style={[styles.tabInner, pressAnimStyle]}>
        <View style={styles.tabContent}>

          {/* Emoji — fixed size, never shrinks */}
          <Text
            style={styles.emoji}
            allowFontScaling={false}
            selectable={false}
          >
            {emoji}
          </Text>

          {/* Label — shrinks when needed, chevron ko push nahi karta */}
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

          {/* Chevron — only for tabs with picker, never shrinks */}
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
  const tabWidthRef   = useRef<number>(0);
  const isFirstRender = useRef<boolean>(true);
  const userInitiated = useRef<boolean>(false);

  const capsuleX = useSharedValue<number>(0);
  const capsuleW = useSharedValue<number>(0);

  const activeIndex = Math.max(
    0,
    SCOPES.findIndex((s) => s.key === activeScope),
  );

  const capsuleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
    width: capsuleW.value,
  }), []);

  /**
   * Capsule X calculation — separator View approach ke saath exact math:
   *
   * Content area (track ke andar H_PAD ke baad):
   *   Tab 0 starts: x = 0
   *   Sep 0 starts: x = tw
   *   Tab 1 starts: x = tw + TAB_GAP
   *   Sep 1 starts: x = 2*tw + TAB_GAP
   *   Tab 2 starts: x = 2*tw + 2*TAB_GAP = 2*(tw + TAB_GAP)
   *   ...
   *   Tab n starts: x = n * (tw + TAB_GAP)    ← exact formula
   *
   * Capsule = tab left edge + CAPSULE_H_INSET (2px andar se)
   * `capsule` style has `left: 0` (absolute, content area se count)
   * translateX does all the work
   */
  const calcCapsuleX = useCallback(
    (index: number, tw: number): number =>
      index * (tw + TAB_GAP) + CAPSULE_H_INSET,
    [],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const totalW = e.nativeEvent.layout.width;

    /**
     * Separator View math:
     *   totalW = H_PAD*2 + N_TABS*tw + (N_TABS-1)*TAB_GAP
     *   tw     = (totalW - H_PAD*2 - (N_TABS-1)*TAB_GAP) / N_TABS
     *          = (totalW - 10 - 6) / 4
     *
     * All 4 tabs get identical width. No rounding issues.
     */
    const tw = (totalW - H_PAD * 2 - TAB_GAP * (N_TABS - 1)) / N_TABS;

    tabWidthRef.current  = tw;
    setTabWidth(tw);

    // capsuleW = tab width - 2px inset on each side
    capsuleW.value = tw - CAPSULE_H_INSET * 2;

    // Initial capsule position — no animation (first render)
    capsuleX.value = calcCapsuleX(activeIndex, tw);

  }, [capsuleX, capsuleW, activeIndex, calcCapsuleX]);

  // Animate capsule when activeScope changes from outside (not user tap)
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

    // Same tab tap — open picker if available
    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    // New tab — animate capsule, update scope
    // Flag prevents useEffect double-animating
    userInitiated.current = true;
    capsuleX.value = withSpring(
      calcCapsuleX(index, tabWidthRef.current),
      SPRING_SLIDE,
    );
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
      {/* Animated capsule — behind tabs (zIndex:0), shown after layout fires */}
      {tabWidth > 0 && (
        <Animated.View
          style={[styles.capsule, capsuleAnimStyle]}
          pointerEvents="none"
        />
      )}

      {/*
        SEPARATOR VIEW APPROACH:
        Tabs ke beech fixed-width View (2px) lagaya.

        WHY NOT marginRight:
          marginRight + flex:1 → tabs 0,1,2 width = S/4-2, tab3 width = S/4
          Unequal widths → capsule math off → misaligned highlight

        WHY NOT gap property in track:
          RN mein gap + overflow:hidden = sometimes children overflow

        WHY SEPARATOR VIEW WORKS:
          View width:TAB_GAP is a fixed element, not part of flex:1 distribution.
          Flex algorithm: available = content - 3*TAB_GAP = content - 6
          Each flex:1 tab = (content - 6) / 4 — EXACTLY EQUAL.
          Capsule math: n*(tw+TAB_GAP) — EXACTLY CORRECT.
      */}
      {SCOPES.map((scopeCfg, index) => (
        <React.Fragment key={scopeCfg.key}>
          <ScopeTab
            scopeCfg={scopeCfg}
            index={index}
            isActive={scopeCfg.key === activeScope}
            label={getLabel(scopeCfg.key, scopeCfg.defaultLabel)}
            emoji={getEmoji(scopeCfg.key, scopeCfg.emoji)}
            onPress={handleTabPress}
          />
          {/* Separator between tabs — last tab ke baad nahi */}
          {index < N_TABS - 1 && (
            <View style={styles.tabSeparator} pointerEvents="none" />
          )}
        </React.Fragment>
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
    // No gap property — separator Views handle spacing (gap+overflow:hidden can cause issues in RN)
    overflow: 'hidden',
  },

  capsule: {
    position: 'absolute',
    left: 0,              // absolute: content area se (H_PAD ke baad) start hota hai
    top: CAPSULE_INSET,
    bottom: CAPSULE_INSET,
    backgroundColor: 'rgba(200,150,12,0.18)',
    borderRadius: 6,
    zIndex: 0,            // tabs ke peeche
  },

  // Fixed-width spacer between tabs
  // flex:1 tabs ke beech fixed element → equal tab width guaranteed
  tabSeparator: {
    width: TAB_GAP,       // 2px
    flexShrink: 0,        // kabhi nahi shrink hoga
    alignSelf: 'stretch', // full track height
    zIndex: 0,
  },

  tab: {
    flex: 1,
    minWidth: 0,          // flex shrink properly kaam kare
    height: '100%',
    zIndex: 1,            // capsule ke upar
    backgroundColor: 'transparent',
    // NO marginRight — separator View handles spacing
  },

  // Animated.View — ONLY for press scale transform
  // flex:1 se Pressable ka poora area fill karta hai
  tabInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Regular View — emoji + label + chevron ka row
  // overflow:hidden regular View pe sahi kaam karta hai
  // maxWidth:'100%' yahan reliably constrain karta hai
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,               // emoji ↔ label ↔ chevron = 2px space
    paddingHorizontal: 2, // left/right breathing room
    maxWidth: '100%',
    overflow: 'hidden',
  },

  emoji: {
    fontSize: 13,
    lineHeight: 16,
    flexShrink: 0,        // emoji kabhi nahi shrink hoga
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    flexShrink: 1,        // label shrinkable — pehle yahi shrink hoga
    minWidth: 0,          // flex shrink ke liye zaruri
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
    flexShrink: 0,        // chevron kabhi nahi shrink/clip hogi
    marginTop: 1,
  },

});

export default FourScopeSwitcher;

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.0  EXACT HTML MATCH                       ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.0 — EXTRACTED FROM index.html (IMPERIAL COURT GOLD):       ║
 * ║    [1] Backgrounds: Active pill uses rgba(200, 150, 12, 0.18).           ║
 * ║    [2] Typography: Active text is #1A1208 (Deep Onyx, 600 weight).       ║
 * ║        Inactive text is #7A5C2E (Antique Bronze, 400 weight).            ║
 * ║    [3] Chevrons: Active chevron turns Brand Gold (#C8960C).              ║
 * ║    [4] Dimensions: Row height 38px, Tab height 26px, Radius 6px.         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  type WithSpringConfig,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// HTML EXACT COLORS (Extracted from index.html CSS)
// ─────────────────────────────────────────────────────────────────────────────
const HTML_TOKENS = {
  bgSurface:    '#FFF8F0',             // --bg-surface (Parchment White)
  bgSelected:   'rgba(200,150,12,0.18)', // Selected tab background formula
  textStrong:   '#1A1208',             // --fg-text-strong (Deep Onyx)
  textMuted:    '#7A5C2E',             // --fg-text-muted (Antique Bronze)
  brandGold:    '#C8960C',             // --fg-brand (Royal Saffron Gold)
};

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ChatScope = 'world' | 'country' | 'city' | 'sector';

interface ScopeConfig {
  readonly key:          ChatScope;
  readonly emoji:        string;
  readonly defaultLabel: string;
  readonly hasPicker:    boolean;
  readonly a11yLabel:    string;
}

const SCOPES: readonly ScopeConfig[] = [
  {
    key:          'world',
    emoji:        '🌍',
    defaultLabel: 'World',
    hasPicker:    true,
    a11yLabel:    'World chat',
  },
  {
    key:          'country',
    emoji:        '🇮🇳',
    defaultLabel: 'India',
    hasPicker:    true,
    a11yLabel:    'Country chat',
  },
  {
    key:          'city',
    emoji:        '🏙️',
    defaultLabel: 'Mumbai',
    hasPicker:    true,
    a11yLabel:    'City chat',
  },
  {
    key:          'sector',
    emoji:        '📍',
    defaultLabel: 'Bandra W',
    hasPicker:    true,
    a11yLabel:    'Sector chat',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (MATCHED STRICTLY TO index.html)
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  HEIGHT:         38 as const, // Matches --height-row2
  TRACK_PAD:      12 as const, // Matches --sp-3
  
  CAPSULE_H:      26 as const, // Matches .scope-tab height
  CAPSULE_RADIUS: 6  as const, // Matches --radius-md
  
  LABEL_SIZE:     12 as const, // Matches .scope-tab-label font-size
  EMOJI_SIZE:     14 as const, 
  CHEVRON_SIZE:   16 as const, 
  
  ITEM_GAP:       3  as const, // Matches HTML gap: 3px
  TAB_COUNT:      4  as const,

  SPRING_SLIDE: { mass: 1, stiffness: 280, damping: 28 } as const satisfies WithSpringConfig,
  SPRING_PRESS: { mass: 1, stiffness: 450, damping: 30 } as const satisfies WithSpringConfig,

  HAPTIC: Haptics.ImpactFeedbackStyle.Light,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeLabel {
  readonly country:      string;
  readonly city:         string;
  readonly sector:       string;
  readonly countryEmoji: string;
}

export interface FourScopeSwitcherProps {
  readonly activeScope:   ChatScope;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen:  (scope: ChatScope) => void;
  readonly labels?:       Partial<ScopeLabel>;
}

interface ScopeTabProps {
  readonly scopeCfg:    ScopeConfig;
  readonly index:       number;
  readonly isActive:    boolean;
  readonly label:       string;
  readonly emoji:       string;
  readonly onPress:     (scope: ChatScope, index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const ScopeTab = memo(({
  scopeCfg,
  index,
  isActive,
  label,
  emoji,
  onPress,
}: ScopeTabProps): React.JSX.Element => {

  const scale = useSharedValue<number>(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), []);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.94, SWITCHER.SPRING_PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SWITCHER.SPRING_PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(scopeCfg.key, index);
  }, [onPress, scopeCfg.key, index]);

  // Apply specific colors from HTML based on active state
  const textColor = isActive ? HTML_TOKENS.textStrong : HTML_TOKENS.textMuted;
  const textWeight = isActive ? '600' : '400';
  const chevronColor = isActive ? HTML_TOKENS.brandGold : HTML_TOKENS.textMuted;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.scopeButton}
      accessibilityRole="tab"
      accessibilityLabel={scopeCfg.a11yLabel}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        
        {/* Emoji */}
        <Text style={styles.scopeEmoji} allowFontScaling={false}>
          {emoji}
        </Text>

        {/* Text Label */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.scopeLabel,
              { color: textColor, fontWeight: textWeight }
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>

        {/* Chevron Dropdown */}
        {scopeCfg.hasPicker && (
          <MaterialIcons
            name="arrow-drop-down"
            size={SWITCHER.CHEVRON_SIZE}
            color={chevronColor}
            style={styles.chevron}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        )}
        
      </Animated.View>
    </Pressable>
  );
});

ScopeTab.displayName = 'ScopeTab';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope = 'city', 
  onScopeChange,
  onPickerOpen,
  labels = {},
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);
  const isFirstRender = useRef<boolean>(true);

  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope) || 0;
  const capsuleX = useSharedValue<number>(0);

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }), []);

  const slideCapsule = useCallback((toIndex: number, instant: boolean = false): void => {
    const tw = tabWidthRef.current;
    if (tw <= 0) return;
    
    if (instant) {
      capsuleX.value = toIndex * tw;
    } else {
      capsuleX.value = withSpring(toIndex * tw, SWITCHER.SPRING_SLIDE);
    }
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w  = e.nativeEvent.layout.width;
    const tw = (w - (SWITCHER.TRACK_PAD * 2)) / SWITCHER.TAB_COUNT;
    tabWidthRef.current = tw;
    setTrackWidth(w);
    
    capsuleX.value = activeIndex * tw;
  }, [capsuleX, activeIndex]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (userInitiatedRef.current) {
      userInitiatedRef.current = false;
      return;
    }
    
    slideCapsule(activeIndex, false);
  }, [activeScope, activeIndex, slideCapsule]);

  const handleTabPress = useCallback((scope: ChatScope, index: number): void => {
    void Haptics.impactAsync(SWITCHER.HAPTIC);

    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    userInitiatedRef.current = true;
    slideCapsule(index, false);
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen, slideCapsule]);

  const getLabel = useCallback((scope: ChatScope, defaultLabel: string): string => {
    switch (scope) {
      case 'country': return labels.country || defaultLabel;
      case 'city':    return labels.city    || defaultLabel;
      case 'sector':  return labels.sector  || defaultLabel;
      default:        return defaultLabel;
    }
  }, [labels]);

  const getEmoji = useCallback((scope: ChatScope, defaultEmoji: string): string => {
    if (scope === 'country') return labels.countryEmoji || defaultEmoji;
    return defaultEmoji;
  }, [labels]);

  const tabWidth = trackWidth > 0
    ? (trackWidth - (SWITCHER.TRACK_PAD * 2)) / SWITCHER.TAB_COUNT
    : 0;

  return (
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
    >
      <View style={styles.trackInner}>
        
        {/* THE PILL (Direct match to HTML rgba formula) */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.capsule,
              { width: tabWidth, height: SWITCHER.CAPSULE_H },
              animatedCapsuleStyle,
            ]}
            pointerEvents="none"
          />
        )}

        {/* SCOPE TABS */}
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
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES 
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    height:           SWITCHER.HEIGHT,
    backgroundColor:  HTML_TOKENS.bgSurface, // Exactly #FFF8F0 as per HTML #row2
  },
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD,
    position:         'relative',
    gap:              1, 
  },
  capsule: {
    position:         'absolute',
    left:             0,
    top:              (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2,
    borderRadius:     SWITCHER.CAPSULE_RADIUS, // 6px radius from HTML
    backgroundColor:  HTML_TOKENS.bgSelected, // rgba(200,150,12,0.18)
    shadowOpacity:    0,
    elevation:        0, 
    zIndex:           0,
  },
  scopeButton: {
    flex:           1,
    height:         '100%',
    justifyContent: 'center',
    zIndex:         1, 
  },
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SWITCHER.ITEM_GAP, // 3px gap exactly like HTML
    paddingHorizontal: 2,
  },
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 18, 
  },
  textContainer: {
    flexShrink: 1,
  },
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE, // 12px exactly like HTML
    lineHeight: 16,
    textAlign:  'center',
    letterSpacing: 0.2, // Match HTML slightly spaced look
  },
  chevron: {
    marginTop: 1, 
  },
});

export default FourScopeSwitcher;

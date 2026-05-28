/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.2  SPACIOUS & AUTO-SCALING FIX            ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.2 — LONG NAME TRUNCATION FIX ("CHANDIGARH"):               ║
 * ║    [1] Spacing Optimization: Reduced track padding and internal gaps to  ║
 * ║        give the text container maximum horizontal breathing room.        ║
 * ║    [2] Auto-Scaling: Dropped minimumFontScale to 0.5 and applied         ║
 * ║        flexShrink strictly so long names (e.g., Chandigarh) scale down   ║
 * ║        gracefully instead of clipping to "Chand...".                     ║
 * ║    [3] Background: Confirmed main track background is transparent.       ║
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
// HTML EXACT COLORS 
// ─────────────────────────────────────────────────────────────────────────────
const HTML_TOKENS = {
  bgSelected:   'rgba(200,150,12,0.18)', // Selected Pill Color
  textStrong:   '#1A1208',               // Active Text 
  textMuted:    '#7A5C2E',               // Inactive Text 
  brandGold:    '#C8960C',               // Active Arrow 
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
    defaultLabel: 'Chandigarh', // Testing with long name
    hasPicker:    true,
    a11yLabel:    'City chat',
  },
  {
    key:          'sector',
    emoji:        '📍',
    defaultLabel: 'Sector 17',
    hasPicker:    true,
    a11yLabel:    'Sector chat',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  HEIGHT:         40 as const, 
  
  // Reduced from 8 to 4 to give tabs more horizontal width for long names
  TRACK_PAD:      4  as const, 
  
  CAPSULE_H:      28 as const, 
  CAPSULE_RADIUS: 6  as const, 
  
  // Base text size (will auto-shrink if name is too long like Chandigarh)
  LABEL_SIZE:     12.5 as const, 
  EMOJI_SIZE:     13 as const, 
  CHEVRON_SIZE:   16 as const, 
  
  // Reduced item gap to save horizontal pixels for text
  ITEM_GAP:       2  as const, 
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
    scale.value = withSpring(0.92, SWITCHER.SPRING_PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SWITCHER.SPRING_PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(scopeCfg.key, index);
  }, [onPress, scopeCfg.key, index]);

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

        {/* Text Container with Auto-Scaling (Allows full width for Chandigarh) */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.scopeLabel,
              { color: textColor, fontWeight: textWeight }
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true} 
            minimumFontScale={0.5} // Allow 50% shrinking so 10-letter words fit perfectly
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
        
        {/* THE PILL (Active Background) */}
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
    backgroundColor:  'transparent', // Entire background is completely transparent
  },
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD,
    position:         'relative',
  },
  capsule: {
    position:         'absolute',
    left:             0,
    top:              (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2,
    borderRadius:     SWITCHER.CAPSULE_RADIUS, 
    backgroundColor:  HTML_TOKENS.bgSelected, 
    shadowOpacity:    0,
    elevation:        0, 
    zIndex:           0,
  },
  scopeButton: {
    flex:           1, // 4 tabs exactly divide the space 25% each
    height:         '100%',
    justifyContent: 'center',
    zIndex:         1, 
  },
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SWITCHER.ITEM_GAP,
    paddingHorizontal: 0, // Set to 0 so text utilizes the full 25% width box
  },
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 18, 
  },
  textContainer: {
    flexShrink: 1, // MAGIC FIX: Ensures Android lets the text squeeze instead of clipping
    justifyContent: 'center', 
  },
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE, 
    textAlign:  'center',
  },
  chevron: {
    marginTop: 1, 
  },
});

export default FourScopeSwitcher;

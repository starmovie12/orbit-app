/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v6.0  INVISIBLE TRACK (FLOATING PILL)        ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v6.0 — THE "FLOATING MINIMALIST" UPGRADE:                     ║
 * ║    [1] Aesthetics: Completely removed the outer track background and     ║
 * ║        borders. Tabs now float cleanly on the app's native background.   ║
 * ║    [2] Capsule Shape: Changed from a full pill (50% radius) to a refined ║
 * ║        rounded rectangle (10px radius) to perfectly match the reference. ║
 * ║    [3] Iconography: Replaced line-based chevrons with solid triangles    ║
 * ║        (MaterialIcons arrow-drop-down) for that exact premium look.      ║
 * ║    [4] Typography & Color: Replaced faded greys with rich, dark solid    ║
 * ║        colors for all labels, active or inactive, ensuring legibility.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * * * AESTHETIC DIRECTION: Floating Minimalist (Reference 50812.png)
 * Rationale: The cleanest, most modern approach. No unnecessary boxes or 
 * lines. The selected state is indicated solely by a soft pale-gold rounded 
 * rectangle sliding behind the text.
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
import { MaterialIcons } from '@expo/vector-icons'; // UPGRADED: For solid triangle chevron
import { colors } from '@/constants/colors';

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
    hasPicker:    true,  // Assuming world has a dropdown based on screenshot
    a11yLabel:    'World chat — duniya bhar ke users se baat karo',
  },
  {
    key:          'country',
    emoji:        '🇮🇳',
    defaultLabel: 'India',
    hasPicker:    true,
    a11yLabel:    'Country chat. Tap to change country.',
  },
  {
    key:          'city',
    emoji:        '🏙️',
    defaultLabel: 'City',
    hasPicker:    true,
    a11yLabel:    'City chat. Tap to change city.',
  },
  {
    key:          'sector',
    emoji:        '📍',
    defaultLabel: 'Sector',
    hasPicker:    true,
    a11yLabel:    'Sector chat. Tap to change sector.',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS v6.0 (FLOATING MINIMALIST)
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** Overall container height */
  HEIGHT: 44 as const,

  /** Padding around the entire track */
  TRACK_PAD:      4  as const,
  
  /** Capsule Height (slightly smaller than track to float nicely) */
  CAPSULE_H:      36 as const, 
  
  /** * MATCHING REFERENCE: This is no longer a full pill. 
   * It is a rounded rectangle with a 10px radius.
   */
  CAPSULE_RADIUS: 10 as const, 

  /** Typography (Scaled for inline row harmony) */
  LABEL_SIZE:   14 as const,
  EMOJI_SIZE:   16 as const,
  CHEVRON_SIZE: 18 as const, // Larger size for the solid triangle
  
  /** Gap between Emoji, Text, and Chevron */
  ITEM_GAP:     4  as const,

  TAB_COUNT: 4 as const,

  /** Premium fluid springs */
  SPRING_SLIDE: { mass: 1, stiffness: 240, damping: 26 } as const satisfies WithSpringConfig,
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
  readonly labels:        ScopeLabel;
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
// SUB-COMPONENTS (Premium Tactile Feedback)
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

  const showChevron = scopeCfg.hasPicker;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.scopeButton}
      accessibilityRole="tab"
      accessibilityLabel={scopeCfg.a11yLabel}
      accessibilityState={{ selected: isActive }}
      accessibilityHint={
        scopeCfg.hasPicker
          ? isActive
            ? 'Double-tap to open picker'
            : 'Double-tap to switch scope'
          : undefined
      }
      /* Expands touchable area to meet strict HIG minimums */
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        
        {/* Emoji */}
        <Text style={styles.scopeEmoji} allowFontScaling={false}>
          {emoji}
        </Text>

        {/* Text Container */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.scopeLabel,
              isActive ? styles.scopeLabelActive : styles.scopeLabelInactive,
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>

        {/* Solid Triangle Chevron (Matches reference exactly) */}
        {showChevron && (
          <MaterialIcons
            name="arrow-drop-down"
            size={SWITCHER.CHEVRON_SIZE}
            /* Chevron color matches text color for uniform look */
            color={isActive ? colors.fg.brand : colors.fg.primary}
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
  activeScope,
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);

  const capsuleX = useSharedValue<number>(0);
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope);

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }), []);

  const slideCapsule = useCallback((toIndex: number): void => {
    const tw = tabWidthRef.current;
    if (tw <= 0) return;
    capsuleX.value = withSpring(toIndex * tw, SWITCHER.SPRING_SLIDE);
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w  = e.nativeEvent.layout.width;
    const tw = (w - SWITCHER.TRACK_PAD * 2) / SWITCHER.TAB_COUNT;
    tabWidthRef.current = tw;
    setTrackWidth(w);
    
    capsuleX.value = activeIndex * tw;
  }, [capsuleX, activeIndex]);

  useEffect(() => {
    if (userInitiatedRef.current) {
      userInitiatedRef.current = false;
      return;
    }
    slideCapsule(activeIndex);
  }, [activeScope, activeIndex, slideCapsule]);

  const handleTabPress = useCallback((scope: ChatScope, index: number): void => {
    void Haptics.impactAsync(SWITCHER.HAPTIC);

    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    userInitiatedRef.current = true;
    slideCapsule(index);
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
    ? (trackWidth - SWITCHER.TRACK_PAD * 2) / SWITCHER.TAB_COUNT
    : 0;

  return (
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope switcher"
    >
      <View style={styles.trackInner}>
        
        {/* Animated Pale Gold Capsule Background */}
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
// STYLES v6.0 (FLOATING MINIMALIST)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    height:           SWITCHER.HEIGHT,
    /* * INVISIBLE TRACK: 
     * No background color. No borders. No shadow.
     * The track completely blends into the app's native background.
     */
    backgroundColor:  'transparent', 
  },
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD,
    position:         'relative',
  },
  /** * THE FLOATING PILL:
   * A soft pale-gold rounded rectangle sliding behind the active text.
   */
  capsule: {
    position:         'absolute',
    left:             0,
    
    /* Center the 36px capsule vertically within the 44px track */
    top:              (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2,
    
    /* Rounded rectangle radius, exactly matching reference image */
    borderRadius:     SWITCHER.CAPSULE_RADIUS,
    
    /* Pale Gold matching the badge */
    backgroundColor:  colors.bg.brandSubtle, 
    
    /* Subtle depth to lift it slightly off the page */
    shadowColor:      colors.shadow.gold, 
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.05,
    shadowRadius:     2,
    elevation:        1, 
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
    gap:            SWITCHER.ITEM_GAP,
    paddingHorizontal: 2,
  },
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 18, // Adjusted for larger emojis
  },
  textContainer: {
    flexShrink: 1,
  },
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE,
    lineHeight: 16,
    textAlign:  'center',
  },
  scopeLabelActive: {
    /* Bold, rich dark text on top of the pale gold pill */
    color:      colors.fg.brand,
    fontWeight: '700', 
  },
  scopeLabelInactive: {
    /* * NO FADED TEXT. 
     * Inactive tabs use solid dark text to match the reference exactly. 
     */
    color:      colors.fg.primary,
    fontWeight: '500',
  },
  chevron: {
    /* Slight negative margin to pull the solid triangle closer to text */
    marginLeft: -2,
    marginTop: 1, 
  },
});

export default FourScopeSwitcher;

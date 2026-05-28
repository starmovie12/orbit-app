/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v6.2  EXACT MATCH (PALE GOLD PILL)           ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v6.2 — THE "SIKKA COLOR" & INITIAL MOUNT FIX:                 ║
 * ║    [1] Aesthetics: Background color strictly mapped to brandSubtle to    ║
 * ║        render the pale gold ("sikka") color flatly behind the text.      ║
 * ║    [2] Initial State: App guarantees "World" is highlighted instantly    ║
 * ║        on open without any sliding animation delay.                      ║
 * ║    [3] Text & Icons: Solid MaterialIcons used for the drop-down chevron. ║
 * ║        Text is universally dark (colors.fg.primary) for legibility,      ║
 * ║        matching the photo exactly (no faded inactive states).            ║
 * ║    [4] Layout: Snug 34px height capsule with 8px radius. Zero shadows.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * * * AESTHETIC DIRECTION: Flat Minimalist (Reference 50812.png)
 * Rationale: The track is entirely invisible. The active state is simply a 
 * flat, colored rounded-rectangle sliding behind the text.
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
    hasPicker:    true,  // Screenshot shows a dropdown for World as well
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
// DESIGN TOKENS v6.2 (EXACT MATCH & SIKKA COLOR)
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** Overall container height */
  HEIGHT: 44 as const,

  /** Padding around the entire track */
  TRACK_PAD:      2  as const,
  
  /** * MATCHING REFERENCE: Snug capsule height and slight border radius.
   * Flat 2D look, tightly wrapping the text. Height is 34px.
   */
  CAPSULE_H:      34 as const, 
  CAPSULE_RADIUS: 8  as const, 

  /** Typography (Scaled for inline row harmony) */
  LABEL_SIZE:   14 as const,
  EMOJI_SIZE:   16 as const,
  CHEVRON_SIZE: 18 as const, // Perfect size for solid MaterialIcons triangle
  
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
      /* Expands touchable area to meet strict HIG minimums despite flat UI */
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
            color={colors.fg.primary} /* Always dark to match photo */
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
  activeScope = 'world', // Default fallback just in case
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);
  const isFirstRender = useRef<boolean>(true);

  const capsuleX = useSharedValue<number>(0);
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope) || 0; // Default to 0 (World)

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }), []);

  const slideCapsule = useCallback((toIndex: number, instant: boolean = false): void => {
    const tw = tabWidthRef.current;
    if (tw <= 0) return;
    
    if (instant) {
      // Instantly snap to position (used for initial App Open)
      capsuleX.value = toIndex * tw;
    } else {
      // Smooth slide for user taps
      capsuleX.value = withSpring(toIndex * tw, SWITCHER.SPRING_SLIDE);
    }
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w  = e.nativeEvent.layout.width;
    const tw = (w - SWITCHER.TRACK_PAD * 2) / SWITCHER.TAB_COUNT;
    tabWidthRef.current = tw;
    setTrackWidth(w);
    
    // GUARANTEE INSTANT MOUNT AT ACTIVE SCOPE ("WORLD" BY DEFAULT)
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
    slideCapsule(index, false); // Smooth slide on tap
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
        
        {/* PALE GOLD FLAT CAPSULE (The Sikka Background) */}
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

        {/* Scope Tabs (Sit on top of the capsule) */}
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
// STYLES v6.2 (EXACT MATCH FLAT MINIMALIST)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    height:           SWITCHER.HEIGHT,
    /* * INVISIBLE TRACK: 
     * Matches screenshot perfectly. No background, no outline.
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
  /** * THE FLAT 'SIKKA' PILL (Pale Gold):
   * A snug, completely flat rounded rectangle sliding strictly behind the text.
   */
  capsule: {
    position:         'absolute',
    left:             0,
    
    /* Vertically center the 34px capsule within the 44px track */
    top:              (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2,
    
    /* Small rounded rectangle radius, exactly matching reference image */
    borderRadius:     SWITCHER.CAPSULE_RADIUS,
    
    /* THE PALE GOLD / SIKKA COLOR:
     * This token MUST be set to a pale gold (#F3E9CD or similar) in your colors.ts
     * to perfectly replicate the background in 50812.png.
     */
    backgroundColor:  colors.bg.brandSubtle, 
    
    /* Zero shadow for that exact 2D flat minimalist look */
    shadowOpacity:    0,
    elevation:        0, 
    
    /* Ensure capsule strictly sits underneath the text layer */
    zIndex:           0,
  },
  scopeButton: {
    flex:           1,
    height:         '100%',
    justifyContent: 'center',
    zIndex:         1, // Text Layer sits above background capsule
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
    lineHeight: 18, 
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
    color:      colors.fg.primary, // Dark brown/black as per photo
    fontWeight: '700', 
  },
  scopeLabelInactive: {
    /* Rich muted text for unselected tabs (Not faded out) */
    color:      colors.fg.primary, // Dark brown/black as per photo
    fontWeight: '500',
  },
  chevron: {
    /* Pull the solid triangle slightly closer to text for optical balance */
    marginLeft: -2,
    marginTop: 1, 
  },
});

export default FourScopeSwitcher;

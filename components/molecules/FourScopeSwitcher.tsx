/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v5.1  ULTRA-PREMIUM (COMPACT)                ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v5.1 — PROFESSIONAL REDESIGN:                                 ║
 * ║    [1] Layout: Stacked (Emoji over Text) → Inline Row (Emoji + Text).    ║
 * ║        Saves massive vertical space, looks infinitely more professional. ║
 * ║    [2] Height Reduction: Overall track reduced from 44px to 38px.        ║
 * ║        Touch target remains compliant via hitSlop.                       ║
 * ║    [3] Borders Removed: Eliminated the wireframe capsule border. Depth   ║
 * ║        is now created entirely through pure shadow and surface contrast. ║
 * ║    [4] Typography: Tuned to 11px/12px for perfect inline harmony.        ║
 * ║    [5] Overflow: Flex-shrink applied so long city names gracefully       ║
 * ║        truncate instead of breaking the layout.                          ║
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
import { Feather } from '@expo/vector-icons';
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
    hasPicker:    false,
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
    emoji:        '🏘️',
    defaultLabel: 'Sector',
    hasPicker:    true,
    a11yLabel:    'Sector chat. Tap to change sector.',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS v5.1 (ULTRA-COMPACT PREMIUM)
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** Visual height reduced significantly for a sleeker header */
  HEIGHT: 38 as const,

  /** Tighter inset (2px) creates a more modern, thin-bezel look */
  TRACK_PAD:      2  as const,
  TRACK_RADIUS:   19 as const, // 38 / 2
  CAPSULE_H:      34 as const, // 38 - (2 * 2)
  CAPSULE_RADIUS: 17 as const, // 34 / 2

  /** Typography (Scaled down for inline row layout) */
  LABEL_SIZE:   11 as const,
  EMOJI_SIZE:   12 as const,
  CHEVRON_SIZE: 10 as const,
  
  /** Gap between Emoji and Text */
  ITEM_GAP:     4  as const,

  TAB_COUNT: 4 as const,

  /** Premium fluid springs */
  SPRING_SLIDE: { mass: 1, stiffness: 220, damping: 24 } as const satisfies WithSpringConfig,
  SPRING_PRESS: { mass: 1, stiffness: 450, damping: 30 } as const satisfies WithSpringConfig,

  HAPTIC: Haptics.ImpactFeedbackStyle.Light,

  /** Contrast Opacities */
  OPACITY_EMOJI_INACTIVE:   0.60 as const,
  OPACITY_LABEL_INACTIVE:   0.65 as const,
  OPACITY_CHEVRON_INACTIVE: 0.40 as const,

  /** Diffused shadow (Zero borders) */
  SHADOW_CAPSULE_OPACITY: 0.10 as const,
  SHADOW_CAPSULE_RADIUS:  6    as const,
  SHADOW_CAPSULE_OFFSET:  { width: 0, height: 2 } as const,
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
      /* Expand hit area to meet HIG 44px minimum despite 38px visual height */
      hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        
        {/* Emoji */}
        <Text
          style={[styles.scopeEmoji, !isActive && styles.scopeEmojiInactive]}
          allowFontScaling={false}
        >
          {emoji}
        </Text>

        {/* Text Area (Flex-shrink protects against overflow) */}
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

        {/* Chevron */}
        {showChevron && (
          <Feather
            name="chevron-down"
            size={SWITCHER.CHEVRON_SIZE}
            color={isActive ? colors.fg.brand : colors.fg.tertiary}
            style={[styles.chevron, !isActive && styles.chevronInactive]}
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
// STYLES v5.1 (COMPACT & SLEEK)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    height:           SWITCHER.HEIGHT,
    borderRadius:     SWITCHER.TRACK_RADIUS,
    backgroundColor:  colors.bg.surfaceMuted,
    overflow:         'hidden',
    /* Border completely removed for cleaner look */
  },
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD,
    marginVertical:   SWITCHER.TRACK_PAD,
    position:         'relative',
  },
  capsule: {
    position:         'absolute',
    left:             0,
    top:              0,
    borderRadius:     SWITCHER.CAPSULE_RADIUS,
    backgroundColor:  colors.bg.surface, // Pure white
    
    /* Elegant, diffused shadow instead of wireframe border */
    shadowColor:      colors.shadow.strong,
    shadowOffset:     SWITCHER.SHADOW_CAPSULE_OFFSET,
    shadowOpacity:    SWITCHER.SHADOW_CAPSULE_OPACITY,
    shadowRadius:     SWITCHER.SHADOW_CAPSULE_RADIUS,
    elevation:        3, 
  },
  scopeButton: {
    flex:           1,
    height:         '100%',
    justifyContent: 'center',
    zIndex:         1,
  },
  tabContent: {
    /* * HORIZONTAL LAYOUT (Row) 
     * This makes it vastly more professional and compact 
     */
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SWITCHER.ITEM_GAP,
    paddingHorizontal: 4,
  },
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 14, // Tightened line-height
    opacity:    1.0,
  },
  scopeEmojiInactive: {
    opacity: SWITCHER.OPACITY_EMOJI_INACTIVE,
  },
  textContainer: {
    flexShrink: 1, // Prevents long city names from pushing chevron off-screen
  },
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE,
    lineHeight: 14,
    textAlign:  'center',
    letterSpacing: -0.2, // Premium tracking
  },
  scopeLabelActive: {
    color:      colors.fg.brand,
    fontWeight: '700', 
  },
  scopeLabelInactive: {
    color:      colors.fg.tertiary,
    fontWeight: '500',
    opacity:    SWITCHER.OPACITY_LABEL_INACTIVE,
  },
  chevron: {
    marginTop: 1, // Optical alignment
  },
  chevronInactive: {
    opacity: SWITCHER.OPACITY_CHEVRON_INACTIVE,
  },
});

export default FourScopeSwitcher;

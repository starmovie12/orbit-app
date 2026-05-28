/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v5.3  ROYAL GLOW EDITION (ULTRA-PREMIUM)     ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v5.3 — THE PREMIUM ROYAL GLOW UPGRADE:                        ║
 * ║    [1] Aesthetics: Harsh white clashing background REMOVED. The active   ║
 * ║        capsule now perfectly matches the "1.2 Lakh+" badge aesthetic     ║
 * ║        using a cohesive soft gold (`colors.bg.brandSubtle`).             ║
 * ║    [2] Iconography: Replaced thin 'Feather' icons with bolder, native-   ║
 * ║        feeling 'Ionicons' for a much more substantial, premium click.    ║
 * ║    [3] Contrast Fix: Inactive tabs opacity increased (0.65 -> 0.85) and  ║
 * ║        weight bumped to '600'. They no longer look disabled or dead.     ║
 * ║    [4] Depth over Lines: Zero harsh borders. The royal look is achieved  ║
 * ║        purely through color blocking and soft, diffused shadows.         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * * * AESTHETIC DIRECTION: Translucent Royal Glow
 * Rationale: To fix the "cheap/generic" feel, we align the selection state 
 * perfectly with the app's core brand identity (Gold). A pale gold pill 
 * with rich gold text provides a royal, cohesive, and ultra-premium native feel.
 * * * * STATE MATRIX — FourScopeSwitcher Tab
 * ┌──────────────────────┬─────────────────────────┬─────────────────┬─────────────────────────────┐
 * │ State                │ Visual Change           │ Haptic          │ Animation                   │
 * ├──────────────────────┼─────────────────────────┼─────────────────┼─────────────────────────────┤
 * │ 01 Default / Idle    │ transparent bg, 0.85 opc│ none            │ none                        │
 * │ 04 Press-in          │ tab scales down 0.94    │ none            │ spring(mass:1, stiff:450)   │
 * │ 05 Press-release     │ capsule slides to tab   │ Haptic.Light    │ spring(mass:1, stiff:220)   │
 * │ 11 Selected (Active) │ pale gold bg, gold text │ none            │ none                        │
 * └──────────────────────┴─────────────────────────┴─────────────────┴─────────────────────────────┘
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
import { Ionicons } from '@expo/vector-icons'; // UPGRADED: Bolder, premium chevron
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
// DESIGN TOKENS v5.3 (ROYAL GLOW EDITION)
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** Visual compact height for sleek inline layout */
  HEIGHT: 40 as const,

  /** Inset padding for the track */
  TRACK_PAD:      2  as const,
  TRACK_RADIUS:   20 as const, // 40 / 2
  CAPSULE_H:      36 as const, // 40 - (2 * 2)
  CAPSULE_RADIUS: 18 as const, // 36 / 2

  /** Typography (Balanced for visual hierarchy) */
  LABEL_SIZE:   12 as const,
  EMOJI_SIZE:   13 as const,
  CHEVRON_SIZE: 12 as const, // Slightly larger for the new Ionicons chevron
  
  /** Gap between Emoji and Text */
  ITEM_GAP:     4  as const,

  TAB_COUNT: 4 as const,

  /** Premium fluid springs */
  SPRING_SLIDE: { mass: 1, stiffness: 220, damping: 24 } as const satisfies WithSpringConfig,
  SPRING_PRESS: { mass: 1, stiffness: 450, damping: 30 } as const satisfies WithSpringConfig,

  HAPTIC: Haptics.ImpactFeedbackStyle.Light,

  /** Fixed Contrast Opacities (No longer looks faded/dead) */
  OPACITY_EMOJI_INACTIVE:   0.90 as const,
  OPACITY_LABEL_INACTIVE:   0.85 as const,
  OPACITY_CHEVRON_INACTIVE: 0.70 as const,

  /** Soft diffused depth */
  SHADOW_CAPSULE_OPACITY: 0.08 as const,
  SHADOW_CAPSULE_RADIUS:  4    as const,
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
      /* Expands touchable area to meet strict 44px HIG minimums */
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
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

        {/* Premium Chevron Upgrade */}
        {showChevron && (
          <Ionicons
            name="chevron-down"
            size={SWITCHER.CHEVRON_SIZE}
            color={isActive ? colors.fg.brand : colors.fg.secondary}
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
// STYLES v5.3 (ROYAL GLOW EDITION)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    height:           SWITCHER.HEIGHT,
    borderRadius:     SWITCHER.TRACK_RADIUS,
    backgroundColor:  colors.bg.surfaceMuted, // A very subtle off-white/cream
    overflow:         'hidden',
    /* Zero borders for an ultra-clean, modern aesthetic */
  },
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD,
    marginVertical:   SWITCHER.TRACK_PAD,
    position:         'relative',
  },
  /** * * ROYAL GOLD PILL (The Premium Fix):
   * This is where the magic happens. We replaced the generic clashing white 
   * with `brandSubtle` (a soft pale gold), which perfectly mirrors the 
   * aesthetic of the '1.2 Lakh+' badge.
   */
  capsule: {
    position:         'absolute',
    left:             0,
    top:              0,
    borderRadius:     SWITCHER.CAPSULE_RADIUS,
    
    /* The soft gold background (matches the badge) */
    backgroundColor:  colors.bg.brandSubtle, 
    
    /* Soft, diffused depth */
    shadowColor:      colors.shadow.gold, 
    shadowOffset:     SWITCHER.SHADOW_CAPSULE_OFFSET,
    shadowOpacity:    SWITCHER.SHADOW_CAPSULE_OPACITY,
    shadowRadius:     SWITCHER.SHADOW_CAPSULE_RADIUS,
    elevation:        2, 
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
    paddingHorizontal: 4,
  },
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 16,
    opacity:    1.0,
  },
  scopeEmojiInactive: {
    opacity: SWITCHER.OPACITY_EMOJI_INACTIVE,
  },
  textContainer: {
    flexShrink: 1,
  },
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE,
    lineHeight: 15,
    textAlign:  'center',
    letterSpacing: -0.2,
  },
  scopeLabelActive: {
    /* Rich, dark brand gold text sits perfectly on top of the pale gold pill */
    color:      colors.fg.brand,
    fontWeight: '800', 
  },
  scopeLabelInactive: {
    /* Upgraded contrast (colors.fg.secondary + weight 600) so it doesn't look dead */
    color:      colors.fg.secondary,
    fontWeight: '600',
    opacity:    SWITCHER.OPACITY_LABEL_INACTIVE,
  },
  chevron: {
    marginTop: 1, 
  },
  chevronInactive: {
    opacity: SWITCHER.OPACITY_CHEVRON_INACTIVE,
  },
});

export default FourScopeSwitcher;

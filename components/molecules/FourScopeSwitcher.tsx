/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.0  MINI-PRD STRICT EDITION                ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.0 — MINI-PRD COMPLIANCE UPGRADE:                           ║
 * ║    [1] Layout: Track height locked to 38px. Horizontal padding set to    ║
 * ║        var(--sp-3) eqv. Item gap set to var(--sp-1) eqv.                 ║
 * ║    [2] Background: Container uses base surface color (colors.bg.surface) ║
 * ║    [3] Chevron: Icon fonts REMOVED. Implemented PRD CSS Triangle trick   ║
 * ║        using transparent borders (borderTopWidth: 5, borderLeft: 4).     ║
 * ║    [4] Typography: Exact PRD weights applied -> Inactive 400, Active 600.║
 * ║    [5] Accessibility: Mapped pure HTML roles (tablist, tab, aria-select) ║
 * ║        to React Native accessibility props strictly.                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * * * STATE MATRIX — FourScopeSwitcher Tab
 * ┌──────────────────────┬─────────────────────────┬─────────────────┬─────────────────────────────┐
 * │ State                │ Visual Change           │ Haptic          │ Animation                   │
 * ├──────────────────────┼─────────────────────────┼─────────────────┼─────────────────────────────┤
 * │ 01 Default / Idle    │ transparent bg, 400 wght│ none            │ none                        │
 * │ 04 Press-in          │ tab scales down 0.94    │ none            │ spring(mass:1, stiff:450)   │
 * │ 05 Press-release     │ capsule slides to tab   │ Haptic.Light    │ spring(mass:1, stiff:220)   │
 * │ 11 Selected (Active) │ light tinted pill, 600 w│ none            │ none                        │
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
import { colors } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE TYPES & CONSTANTS
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
    defaultLabel: 'City',
    hasPicker:    true,
    a11yLabel:    'City chat',
  },
  {
    key:          'sector',
    emoji:        '📍',
    defaultLabel: 'Sector',
    hasPicker:    true,
    a11yLabel:    'Sector chat',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS v7.0 (PRD MAPPED)
// ─────────────────────────────────────────────────────────────────────────────

const PRD_TOKENS = {
  /** PRD: Fixed height set karni hai (e.g., var(--height-row2) jo lagbhag 38px hoti hai) */
  HEIGHT_ROW2: 38 as const,

  /** PRD: left/right padding var(--sp-3), approx 12px */
  SP_3: 12 as const,
  
  /** PRD: Tabs ke beech mein gap var(--sp-1), approx 4px */
  SP_1: 4 as const,

  /** PRD: Border radius medium var(--radius-md), approx 6-8px */
  RADIUS_MD: 8 as const,

  /** Typography from PRD */
  FONT_SIZE:  12 as const,
  WEIGHT_REG: '400' as const,
  WEIGHT_BLD: '600' as const,

  /** Premium fluid springs for sliding and pressing */
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
// CSS TRIANGLE CHEVRON (PRD Strict)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PRD: Chevron (Arrow): Iske liye koi alag se icon use nahi karna hai. 
 * CSS ke ::after pseudo-element ka use karke ek chhota sa CSS triangle banana hai.
 */
const CssChevron = memo(({ isActive }: { isActive: boolean }) => {
  return (
    <View
      style={[
        styles.cssTriangle,
        {
          // PRD: Active chevron color = var(--fg-brand), Inactive = var(--fg-text-muted)
          borderTopColor: isActive ? colors.fg.brand : colors.fg.tertiary,
        },
      ]}
    />
  );
});
CssChevron.displayName = 'CssChevron';

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: SCOPE TAB
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
    scale.value = withSpring(0.94, PRD_TOKENS.SPRING_PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, PRD_TOKENS.SPRING_PRESS);
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
      // PRD: Screen readers ke liye tab roles aur aria-selected attribute
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={scopeCfg.a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
              isActive ? styles.scopeLabelActive : styles.scopeLabelInactive,
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>

        {/* CSS Triangle Chevron */}
        {showChevron && <CssChevron isActive={isActive} />}
        
      </Animated.View>
    </Pressable>
  );
});

ScopeTab.displayName = 'ScopeTab';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope = 'world',
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);
  const isFirstRender = useRef<boolean>(true);

  const capsuleX = useSharedValue<number>(0);
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope) || 0;

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }), []);

  const slideCapsule = useCallback((toIndex: number, instant: boolean = false): void => {
    const tw = tabWidthRef.current;
    if (tw <= 0) return;
    
    if (instant) {
      capsuleX.value = toIndex * tw;
    } else {
      capsuleX.value = withSpring(toIndex * tw, PRD_TOKENS.SPRING_SLIDE);
    }
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w  = e.nativeEvent.layout.width;
    // Track width minus total horizontal padding
    const activeSpace = w - (PRD_TOKENS.SP_3 * 2);
    const tw = activeSpace / PRD_TOKENS.TAB_COUNT;
    
    tabWidthRef.current = tw;
    setTrackWidth(activeSpace);
    
    // Mount instantly at correct position
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
    void Haptics.impactAsync(PRD_TOKENS.HAPTIC);

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

  const tabWidth = trackWidth > 0 ? trackWidth / PRD_TOKENS.TAB_COUNT : 0;

  return (
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope selector"
    >
      <View style={styles.trackInner}>
        
        {/* ACTIVE PILL (Background Indicator) */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.capsule,
              { width: tabWidth },
              animatedCapsuleStyle,
            ]}
            pointerEvents="none"
          />
        )}

        {/* TABS */}
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
// STYLES v7.0 (PRD MAPPED VARIABLES)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    /* PRD: Height: Fixed height set karni hai (var(--height-row2) ~ 38px) */
    height: PRD_TOKENS.HEIGHT_ROW2,
    
    /* PRD: Background: Container ka background base surface color (var(--bg-surface)) hona chahiye. */
    backgroundColor: colors.bg.surface,
    
    /* PRD: Container ke left/right mein padding (var(--sp-3)) */
    paddingHorizontal: PRD_TOKENS.SP_3,
    
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackInner: {
    flex: 1,
    flexDirection: 'row',
    /* PRD: Alignment: Items ko vertically center aur horizontally evenly distribute */
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  capsule: {
    position: 'absolute',
    left: 0,
    height: '100%',
    
    /* PRD: Border radius medium (var(--radius-md)) */
    borderRadius: PRD_TOKENS.RADIUS_MD,
    
    /* PRD: Active State Background: Ek light tinted background pill dikhna chahiye */
    backgroundColor: colors.bg.brandSubtle, 
    
    zIndex: 0,
  },
  scopeButton: {
    /* PRD: Sizing: Har tab ko equal width milni chahiye (flex: 1). */
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    zIndex: 1, 
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    /* PRD: Spacing: Tabs ke beech mein thoda gap (var(--sp-1)) */
    gap: PRD_TOKENS.SP_1,
  },
  scopeEmoji: {
    fontSize: 14,
  },
  textContainer: {
    flexShrink: 1,
  },
  scopeLabel: {
    /* PRD: Text Style: Font size chhota (approx 12px) */
    fontSize: PRD_TOKENS.FONT_SIZE,
    textAlign: 'center',
  },
  scopeLabelInactive: {
    /* PRD: Default Color: Unselected text ka color muted hona chahiye */
    color: colors.fg.tertiary, // Maps to --fg-text-muted
    
    /* PRD: font weight regular (400) */
    fontWeight: PRD_TOKENS.WEIGHT_REG,
  },
  scopeLabelActive: {
    /* PRD: Active Text: Font weight bold (600) aur color strong */
    color: colors.fg.primary, // Maps to --fg-text-strong
    fontWeight: PRD_TOKENS.WEIGHT_BLD,
  },
  
  /**
   * PRD: CSS Trick: border-left: 4px solid transparent, 
   * border-right: 4px solid transparent, border-top: 5px solid var(--fg-text-muted).
   */
  cssTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor is set dynamically in the component based on isActive
    marginTop: 2, // Optical alignment
  },
});

export default FourScopeSwitcher;

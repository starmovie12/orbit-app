/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.0  MINI-PRD COMPLIANT EDITION             ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Noor Aalam (Founder) · Chandigarh · May 2026                     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.0 — STRICT PRD IMPLEMENTATION:                             ║
 * ║    [1] Layout: 38px fixed height, specific left/right padding,           ║
 * ║        and evenly distributed tabs per PRD section 1.                    ║
 * ║    [2] Icons Removed: Dropped external icon libraries. Chevron is now    ║
 * ║        purely rendered using the CSS triangle border trick.              ║
 * ║    [3] Typography: 12px base size. Weight 400 (muted) for inactive,      ║
 * ║        Weight 600 (strong) for active per PRD section 3.                 ║
 * ║    [4] Accessibility: Strict role="tablist", role="tab", and             ║
 * ║        aria-selected mapping to match the provided DOM structure.        ║
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
// NOTE: No external icon libraries imported. Chevron uses CSS trick.
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
    emoji:        '📍',
    defaultLabel: 'Sector',
    hasPicker:    true,
    a11yLabel:    'Sector chat. Tap to change sector.',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (Mapped exactly to Mini-PRD semantics)
// ─────────────────────────────────────────────────────────────────────────────

const PRD = {
  HEIGHT:     38 as const,
  RADIUS_MD:  8  as const, // Standard medium border radius
  SPACING_1:  4  as const, // Gap between elements
  SPACING_3:  12 as const, // Padding for container

  FONT_SIZE:  12 as const,
  WEIGHT_REG: '400' as const,
  WEIGHT_BLD: '600' as const,

  TAB_COUNT:  4 as const,

  SPRING_SLIDE: { mass: 1, stiffness: 240, damping: 26 } as const satisfies WithSpringConfig,
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

  const handlePress = useCallback(() => {
    onPress(scopeCfg.key, index);
  }, [onPress, scopeCfg.key, index]);

  const showChevron = scopeCfg.hasPicker;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.scopeButton,
        // PRD State: Subtle highlight on hover/press
        pressed && !isActive && { backgroundColor: colors.bg.surfaceMuted },
      ]}
      role="tab"
      aria-selected={isActive} // Mapped directly from PRD HTML structure
      aria-label={scopeCfg.a11yLabel}
    >
      <View style={styles.tabContent}>
        <Text style={styles.scopeEmoji} allowFontScaling={false}>
          {emoji}
        </Text>

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

        {/* CSS TRIANGLE TRICK: Replaces Icon library */}
        {showChevron && (
          <View 
            style={[
              styles.cssTriangle, 
              isActive ? styles.cssTriangleActive : styles.cssTriangleInactive
            ]} 
          />
        )}
      </View>
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
      capsuleX.value = withSpring(toIndex * tw, PRD.SPRING_SLIDE);
    }
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w  = e.nativeEvent.layout.width;
    // Account for padding left/right (SPACING_3 * 2)
    const availableWidth = w - (PRD.SPACING_3 * 2);
    const tw = availableWidth / PRD.TAB_COUNT;
    
    tabWidthRef.current = tw;
    setTrackWidth(availableWidth);
    
    capsuleX.value = activeIndex * tw;
  }, [capsuleX, activeIndex]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    slideCapsule(activeIndex, false);
  }, [activeScope, activeIndex, slideCapsule]);

  const handleTabPress = useCallback((scope: ChatScope, index: number): void => {
    void Haptics.impactAsync(PRD.HAPTIC);

    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

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

  const tabWidth = trackWidth > 0 ? trackWidth / PRD.TAB_COUNT : 0;

  return (
    <View
      id="row2"
      style={styles.container}
      onLayout={onTrackLayout}
      role="tablist"
      aria-label="Chat scope selector"
    >
      {/* Sliding Active Pill (Maintains premium feel while adhering to DOM structure) */}
      {tabWidth > 0 && (
        <Animated.View
          style={[
            styles.activeBackgroundPill,
            { width: tabWidth },
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES (Strictly using semantic mapping)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    height:           PRD.HEIGHT,
    paddingHorizontal: PRD.SPACING_3, // var(--sp-3)
    backgroundColor:  colors.bg.surface, // var(--bg-surface)
    position:         'relative',
  },
  activeBackgroundPill: {
    position:         'absolute',
    left:             PRD.SPACING_3, // Offset by container padding
    height:           PRD.HEIGHT - 4, // Slightly smaller than container for padding illusion
    borderRadius:     PRD.RADIUS_MD, // var(--radius-md)
    backgroundColor:  colors.bg.brandSubtle, // var(--fg-brand-subtle) tinted background
    zIndex:           0,
  },
  scopeButton: {
    flex:           1,
    height:         '100%',
    justifyContent: 'center',
    alignItems:     'center',
    borderRadius:   PRD.RADIUS_MD,
    backgroundColor: 'transparent',
    zIndex:         1,
  },
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            PRD.SPACING_1, // var(--sp-1)
  },
  scopeEmoji: {
    fontSize:       PRD.FONT_SIZE,
  },
  scopeLabel: {
    fontSize:       PRD.FONT_SIZE,
    textAlign:      'center',
  },
  scopeLabelInactive: {
    fontWeight:     PRD.WEIGHT_REG as any,
    color:          colors.fg.tertiary, // var(--fg-text-muted)
  },
  scopeLabelActive: {
    fontWeight:     PRD.WEIGHT_BLD as any,
    color:          colors.fg.primary, // var(--fg-text-strong)
  },
  
  /* * THE CSS TRIANGLE TRICK
   * Mapped directly from: 
   * border-left: 4px solid transparent, 
   * border-right: 4px solid transparent, 
   * border-top: 5px solid color 
   */
  cssTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 0,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    marginTop: 2, // Optical alignment
  },
  cssTriangleInactive: {
    borderTopColor: colors.fg.tertiary, // var(--fg-text-muted)
  },
  cssTriangleActive: {
    borderTopColor: colors.fg.brand, // var(--fg-brand)
  },
});

export default FourScopeSwitcher;

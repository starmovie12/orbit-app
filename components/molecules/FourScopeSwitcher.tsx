/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.2  HTML EXACT VISUAL REPLICATION          ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Noor Aalam (Founder) · Chandigarh · May 2026                     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.2 — EXACT HTML/CSS INTEGRATION:                            ║
 * ║    [1] Dimensions Matched: Tabs exactly 26px high, centered inside 38px  ║
 * ║        row, perfectly matching the HTML layout.                          ║
 * ║    [2] Tab Gap & Sliding Math: Calculated 4px (SP_1) gap between tabs    ║
 * ║        with updated Reanimated spring logic for seamless sliding.        ║
 * ║    [3] Premium Borders: Radius set strictly to 6px (var(--radius-md)).   ║
 * ║    [4] Semantic Colors Maintained: No hardcoded hex values; relying on   ║
 * ║        the dynamic `colors` palette for an elite, themeable UI.          ║
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
    hasPicker:    true,
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
    defaultLabel: 'Mumbai',
    hasPicker:    true,
    a11yLabel:    'City chat. Tap to change city.',
  },
  {
    key:          'sector',
    emoji:        '📍',
    defaultLabel: 'Bandra W',
    hasPicker:    true,
    a11yLabel:    'Sector chat. Tap to change sector.',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (HTML STRICT MATCH)
// ─────────────────────────────────────────────────────────────────────────────

const PRD_TOKENS = {
  HEIGHT_ROW2: 38 as const,
  TAB_HEIGHT:  26 as const, // Exactly as per HTML
  TAB_COUNT:   4 as const,
  SP_3:        12 as const, // Padding
  SP_1:        4 as const,  // Gap between tabs
  RADIUS_MD:   6 as const,  // Exact border radius from HTML
  FONT_SIZE:   12 as const,
  WEIGHT_REG:  '400' as const,
  WEIGHT_BLD:  '600' as const,

  SPRING_SLIDE: { mass: 1, stiffness: 240, damping: 26 } as const satisfies WithSpringConfig,
  SPRING_PRESS: { mass: 1, stiffness: 450, damping: 30 } as const satisfies WithSpringConfig,

  HAPTIC: Haptics.ImpactFeedbackStyle.Light,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS INTERFACES
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
// PURE NATIVE CSS-TRIANGLE ARROW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const CssTriangleChevron = memo(({ isActive }: { isActive: boolean }) => {
  return (
    <View
      style={[
        styles.cssTriangle,
        {
          borderTopColor: isActive ? colors.fg.brand : colors.fg.tertiary,
        },
      ]}
    />
  );
});

CssTriangleChevron.displayName = 'CssTriangleChevron';

// ─────────────────────────────────────────────────────────────────────────────
// TAB BUTTON COMPONENT
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
    scale.value = withSpring(0.95, PRD_TOKENS.SPRING_PRESS);
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
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={scopeCfg.a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        
        <Text style={styles.scopeEmoji} allowFontScaling={false}>
          {emoji}
        </Text>

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

        {showChevron && <CssTriangleChevron isActive={isActive} />}
        
      </Animated.View>
    </Pressable>
  );
});

ScopeTab.displayName = 'ScopeTab';

// ─────────────────────────────────────────────────────────────────────────────
// CORE MAIN LAYER
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope = 'world', 
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [tabWidthState, setTabWidthState] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);
  const isFirstRender = useRef<boolean>(true);

  const capsuleX = useSharedValue<number>(0);
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope) !== -1 
    ? SCOPES.findIndex((s) => s.key === activeScope) 
    : 0;

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }), []);

  const slideCapsule = useCallback((toIndex: number, instant: boolean = false): void => {
    const tw = tabWidthRef.current;
    if (tw <= 0) return;
    
    // Position includes the width of the tabs PLUS the gaps between them
    const targetX = toIndex * (tw + PRD_TOKENS.SP_1);
    
    if (instant) {
      capsuleX.value = targetX;
    } else {
      capsuleX.value = withSpring(targetX, PRD_TOKENS.SPRING_SLIDE);
    }
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    const usableSpace = w - (PRD_TOKENS.SP_3 * 2);
    
    // Calculate tab width accounting for the 4px gaps
    const totalGapSpace = (PRD_TOKENS.TAB_COUNT - 1) * PRD_TOKENS.SP_1;
    const computedTabWidth = (usableSpace - totalGapSpace) / PRD_TOKENS.TAB_COUNT;
    
    tabWidthRef.current = computedTabWidth;
    setTabWidthState(computedTabWidth);
    
    capsuleX.value = activeIndex * (computedTabWidth + PRD_TOKENS.SP_1);
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

  return (
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope selector"
    >
      <View style={styles.trackInner}>
        
        {tabWidthState > 0 && (
          <Animated.View
            style={[
              styles.capsule,
              { width: tabWidthState },
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
// STYLES MATRIX (EXACT HTML/CSS REPLICATION)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    height: PRD_TOKENS.HEIGHT_ROW2,
    backgroundColor: colors.bg.surface, 
    paddingHorizontal: PRD_TOKENS.SP_3,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', // Vertically centers the 26px tabs inside 38px
    gap: PRD_TOKENS.SP_1, // The 4px gap exactly as in HTML
    position: 'relative',
  },
  capsule: {
    position: 'absolute',
    left: 0,
    top: (PRD_TOKENS.HEIGHT_ROW2 - PRD_TOKENS.TAB_HEIGHT) / 2, // Centering math: (38 - 26) / 2 = 6px
    height: PRD_TOKENS.TAB_HEIGHT, // 26px
    borderRadius: PRD_TOKENS.RADIUS_MD, // 6px
    backgroundColor: colors.bg.brandSubtle, 
    zIndex: 0,
  },
  scopeButton: {
    flex: 1,
    height: PRD_TOKENS.TAB_HEIGHT, // 26px
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 1, 
    padding: 0,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3, // HTML specifically uses 3px gap for text content and arrow
  },
  scopeEmoji: {
    fontSize: 12,
  },
  textContainer: {
    flexShrink: 1,
  },
  scopeLabel: {
    fontSize: PRD_TOKENS.FONT_SIZE,
    textAlign: 'center',
    letterSpacing: 0.01,
  },
  scopeLabelInactive: {
    color: colors.fg.tertiary, 
    fontWeight: PRD_TOKENS.WEIGHT_REG,
  },
  scopeLabelActive: {
    color: colors.fg.primary, 
    fontWeight: PRD_TOKENS.WEIGHT_BLD,
  },
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
    marginTop: 1, // Matched from HTML margin-top
    marginLeft: 0, 
  },
});

export default FourScopeSwitcher;

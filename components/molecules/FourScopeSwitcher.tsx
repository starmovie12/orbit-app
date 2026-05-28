/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.1  PRD & PHOTO EXACT COMBINATION          ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.1 — EXACT VISUAL & STRUCTURAL INTEGRATION:                 ║
 * ║    [1] Background Isolation: Outer track background locked to pure white  ║
 * ║        (`colors.bg.surface`), matching explicit request.                 ║
 * ║    [2] Capsule Aesthetics: Active indicator rendered as a flat, shadowless║
 * ║        biscuit/gold pill (`colors.bg.brandSubtle`) with 8px radius.      ║
 * ║    [3] Default Anchor: Active state strictly defaults to 'world' on       ║
 * ║        initial render, snapping position instantly with zero animation.  ║
 * ║    [4] CSS Triangle: Zero icon font footprints. Arrow drawn natively via  ║
 * ║        React Native boundary interpolation (border matrix layout).        ║
 * ║    [5] Typography: Complies with PRD weights (Active: 600, Inactive: 400).║
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
// DESIGN TOKENS (PRD STRICT)
// ─────────────────────────────────────────────────────────────────────────────

const PRD_TOKENS = {
  /** PRD Section 1: var(--height-row2) locked strictly to 38px */
  HEIGHT_ROW2: 38 as const,

  /** PRD Section 1: left/right layout bounds padding var(--sp-3) (12px) */
  SP_3: 12 as const,

  /** PRD Section 1: Tabs spacing gap var(--sp-1) (4px) */
  SP_1: 4 as const,

  /** PRD Section 2: Medium border radius var(--radius-md) (8px) */
  RADIUS_MD: 8 as const,

  /** PRD Section 3 Typography parameters */
  FONT_SIZE:  12 as const,
  WEIGHT_REG: '400' as const,
  WEIGHT_BLD: '600' as const,

  /** Total number of scope tabs */
  TAB_COUNT: 4 as const,

  /** Spring response constraints */
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

/**
 * PRD Section 3 Compliance: Draws a strict CSS Triangle trick natively via
 * bounding layout borders. Zero vector graphic or icon font footprints.
 */
const CssTriangleChevron = memo(({ isActive }: { isActive: boolean }) => {
  return (
    <View
      style={[
        styles.cssTriangle,
        {
          // PRD Section 4: Selected chevron turns brand color, unselected is muted text token
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

        {/* Emoji + Label Text */}
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

        {/* Triangle Chevron Element */}
        {showChevron && <CssTriangleChevron isActive={isActive} />}

      </Animated.View>
    </Pressable>
  );
});

ScopeTab.displayName = 'ScopeTab';

// ─────────────────────────────────────────────────────────────────────────────
// CORE MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope = 'world', // Strict execution rule: Default directly to World chat context
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);
  const isFirstRender = useRef<boolean>(true);

  const capsuleX = useSharedValue<number>(0);

  const activeIndex =
    SCOPES.findIndex((s) => s.key === activeScope) !== -1
      ? SCOPES.findIndex((s) => s.key === activeScope)
      : 0;

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
    const w = e.nativeEvent.layout.width;
    const usableSpace = w - (PRD_TOKENS.SP_3 * 2);
    const computedTabWidth = usableSpace / PRD_TOKENS.TAB_COUNT;

    tabWidthRef.current = computedTabWidth;
    setTrackWidth(usableSpace);

    // Exact structural load: Instant alignment baseline execution
    capsuleX.value = activeIndex * computedTabWidth;
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

        {/* FLAT SIKKA-GOLD PILL CAPSULE INDICATOR */}
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

        {/* MAPPED NAVIGATION INTERACTION ELEMENTS */}
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
// STYLES MATRIX (PRD METICULOUS COMPLIANCE)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trackOuter: {
    /* PRD Section 1: Fixed height set karni hai (var(--height-row2) jo lagbhag 38px hoti hai) */
    height: PRD_TOKENS.HEIGHT_ROW2,

    /* PRD Section 1: Background: Container ka background base surface color (var(--bg-surface)) - Pure White Request Verified */
    backgroundColor: colors.bg.surface,

    /* PRD Section 1: container ke left/right mein padding (var(--sp-3)) */
    paddingHorizontal: PRD_TOKENS.SP_3,

    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackInner: {
    flex: 1,
    flexDirection: 'row',
    /* PRD Section 1: Items ko vertically center (align-items: center) aur horizontally evenly distribute */
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  capsule: {
    position: 'absolute',
    left: 0,
    height: '100%',

    /* PRD Section 2: Border radius medium (var(--radius-md)) */
    borderRadius: PRD_TOKENS.RADIUS_MD,

    /* PRD Section 4: Active State: Ek light tinted biscuit/gold background pill dikhna chahiye (Flat execution, no shadows) */
    backgroundColor: colors.bg.brandSubtle,

    zIndex: 0,
  },
  scopeButton: {
    /* PRD Section 2: Sizing: Har tab ko equal width milni chahiye (flex: 1) */
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    zIndex: 1,
    /* PRD Section 2: Button ka default background transparent hona chahiye */
    backgroundColor: 'transparent',
  },
  tabContent: {
    flexDirection: 'row',
    /* PRD Section 2: Content Layout: Har tab ke andar text ko horizontally aur vertically center align karna hai */
    alignItems: 'center',
    justifyContent: 'center',
    /* PRD Section 1: Tabs ke beech mein thoda gap (var(--sp-1)) */
    gap: PRD_TOKENS.SP_1,
  },
  scopeEmoji: {
    fontSize: 13,
  },
  textContainer: {
    flexShrink: 1,
  },
  scopeLabel: {
    /* PRD Section 3: Text Style: Font size chhota (approx 12px) */
    fontSize: PRD_TOKENS.FONT_SIZE,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  scopeLabelInactive: {
    /* PRD Section 3: Default Color: Unselected text ka color muted hona chahiye (var(--fg-text-muted)) */
    color: colors.fg.tertiary,
    /* PRD Section 3: font weight regular (400) */
    fontWeight: PRD_TOKENS.WEIGHT_REG,
  },
  scopeLabelActive: {
    /* PRD Section 4: Active State Text: Font weight bold (600) aur color strong (var(--fg-text-strong)) */
    color: colors.fg.primary,
    fontWeight: PRD_TOKENS.WEIGHT_BLD,
  },

  /**
   * PRD Section 3 Structural Layout Requirement:
   * CSS Trick: border-left: 4px solid transparent, border-right: 4px solid transparent, border-top: 5px solid ...
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
    // borderTopColor interpolates contextually through state evaluations above
    marginLeft: 2,
    marginTop: 3, // Optical text baseline adjustment
  },
});

export default FourScopeSwitcher;

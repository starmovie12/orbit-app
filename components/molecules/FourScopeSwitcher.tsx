/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v5.0  OMEGA-REANIMATED (PREMIUM EDITION)     ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher (44px)                              ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v5.0 — PREMIUM UPGRADE:                                       ║
 * ║    [1] Aesthetics: Harsh borders removed. Converted to iOS-style         ║
 * ║        "sunken track" with a floating, shadow-elevated capsule.          ║
 * ║    [2] Micro-interactions: Added tactile press-in scale animation        ║
 * ║        to individual tabs (Phase 4 interactive feedback).                ║
 * ║    [3] Radii: Perfect semi-circles (Height 44 → Radius 22).              ║
 * ║    [4] Typography: Enhanced contrast (Active: 800, Inactive: 500).       ║
 * ║    [5] Performance: All animations locked to UI thread via JSI.          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * * * AESTHETIC DIRECTION: Glass Island / Apple HIG Premium
 * Rationale: Removing harsh strokes and relying on subtle background contrast 
 * (muted track vs pure surface capsule) paired with soft shadows creates a 
 * significantly more premium, tactile experience.
 * * * STATE MATRIX — FourScopeSwitcher Tab
 * ┌──────────────────────┬─────────────────────────┬─────────────────┬─────────────────────────────┐
 * │ State                │ Visual Change           │ Haptic          │ Animation                   │
 * ├──────────────────────┼─────────────────────────┼─────────────────┼─────────────────────────────┤
 * │ 01 Default / Idle    │ transparent bg, 0.7 opac│ none            │ none                        │
 * │ 02 Hover (web)       │ N/A (Mobile Native)     │ N/A             │ N/A                         │
 * │ 03 Focus (keyboard)  │ a11y focus outline      │ none            │ none                        │
 * │ 04 Press-in          │ tab content scales 0.92 │ none            │ spring(mass:1, stiff:400)   │
 * │ 05 Press-release     │ capsule slides to tab   │ Haptic.Light    │ spring(mass:1, stiff:200)   │
 * │ 06 Long-press        │ N/A                     │ none            │ none                        │
 * │ 07 Drag-active       │ N/A                     │ none            │ none                        │
 * │ 08 Loading           │ N/A                     │ none            │ none                        │
 * │ 11 Success           │ gold text, 1.0 opacity  │ none            │ color transition            │
 * │ 15 Banned (V5)       │ disabled, opacity 0.3   │ none            │ none                        │
 * │ 16 Disabled          │ opacity 0.3             │ none            │ none                        │
 * └──────────────────────┴─────────────────────────┴─────────────────┴─────────────────────────────┘
 * * * INTERACTION: Tap on Tab
 * ─────────────────────────────────────────────────────────────────────
 * 1. TRIGGER
 * Type: tap
 * Touch target: 44x44px minimum (iOS HIG enforced via minHeight)
 * 2. HAPTIC
 * Type: Haptic.Light
 * Fire timing: at gesture start (onPress evaluation)
 * 3. ANIMATION PHASES
 * Phase 1 (press-in): scale [1.0 → 0.92], spring: {mass:1 stiffness:400 damping:32}
 * Phase 2 (release): scale [0.92 → 1.0], spring: {mass:1 stiffness:400 damping:32}
 * Phase 3 (capsule): translateX [prev → new], spring: {mass:1 stiffness:200 damping:24}
 * 4. VISUAL FEEDBACK
 * Token before: colors.fg.tertiary
 * Token after: colors.fg.brand
 * 5. PERFORMANCE PATH
 * Render thread: UI thread via JSI (Reanimated worklet)
 * Annotation: /* PERF: compositor only, zero layout/paint cost *\/
 * ─────────────────────────────────────────────────────────────────────
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
    a11yLabel:    'Country chat — apne desh ke users se baat karo. Tap to change country.',
  },
  {
    key:          'city',
    emoji:        '🏙️',
    defaultLabel: 'City',
    hasPicker:    true,
    a11yLabel:    'City chat — apne shahar ke users se baat karo. Tap to change city.',
  },
  {
    key:          'sector',
    emoji:        '🏘️',
    defaultLabel: 'Sector',
    hasPicker:    true,
    a11yLabel:    'Sector chat — apne sector ke users se baat karo. Tap to change sector.',
  },
] as const satisfies ReadonlyArray<ScopeConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS v5.0 (PREMIUM)
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** Row height — perfectly sized for human touch targets */
  HEIGHT: 44 as const,

  /**
   * Premium inset handling.
   * A 3px inset on a 44px track gives a 38px tall capsule.
   * Perfect semi-circle radii:
   * Track: 44 / 2 = 22
   * Capsule: 38 / 2 = 19
   */
  TRACK_PAD:      3  as const,
  TRACK_RADIUS:   22 as const,
  CAPSULE_H:      38 as const,
  CAPSULE_RADIUS: 19 as const,

  /** Typography */
  LABEL_SIZE:   12 as const,
  EMOJI_SIZE:   14 as const,
  CHEVRON_SIZE: 10 as const,
  CHEVRON_GAP:  2  as const,

  TAB_COUNT: 4 as const,

  /**
   * Capsule slide spring — smooth, glassy settle.
   */
  SPRING_SLIDE: {
    mass:      1,
    stiffness: 200,
    damping:   24,
  } as const satisfies WithSpringConfig,

  /**
   * Press-in scale spring — rigid, immediate tactile response.
   */
  SPRING_PRESS: {
    mass:      1,
    stiffness: 400,
    damping:   32,
  } as const satisfies WithSpringConfig,

  HAPTIC: Haptics.ImpactFeedbackStyle.Light,

  /** Refined Opacities for Premium Contrast */
  OPACITY_EMOJI_INACTIVE:   0.50 as const,
  OPACITY_LABEL_INACTIVE:   0.60 as const,
  OPACITY_CHEVRON_INACTIVE: 0.40 as const,

  /** Diffused premium shadows (no harsh borders) */
  SHADOW_CAPSULE_OPACITY: 0.12 as const,
  SHADOW_CAPSULE_RADIUS:  8    as const,
  SHADOW_CAPSULE_OFFSET:  { width: 0, height: 3 } as const,
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

/**
 * Extracted memoized tab.
 * V5 Upgrade: Implements individual press-scale mechanics on the UI thread.
 */
const ScopeTab = memo(({
  scopeCfg,
  index,
  isActive,
  label,
  emoji,
  onPress,
}: ScopeTabProps): React.JSX.Element => {

  /* PERF: UI thread scaling value for press interactions */
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
            ? 'Double-tap to open location picker'
            : 'Double-tap to switch to this scope'
          : undefined
      }
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        {/* Emoji */}
        <Text
          style={[styles.scopeEmoji, !isActive && styles.scopeEmojiInactive]}
          allowFontScaling={false}
        >
          {emoji}
        </Text>

        {/* Label + Optional Chevron */}
        <View style={styles.labelRow}>
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
        </View>
      </Animated.View>
    </Pressable>
  );
});

ScopeTab.displayName = 'ScopeTab';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Four-scope chat switcher (Premium Edition).
 *
 * @param activeScope   - Currently selected scope key
 * @param onScopeChange - Called when user taps a different scope
 * @param onPickerOpen  - Called when user taps an already-active picker scope
 * @param labels        - Resolved location labels shown inside each tab
 */
export function FourScopeSwitcher({
  activeScope,
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth] = useState<number>(0);
  const tabWidthRef = useRef<number>(0);
  const userInitiatedRef = useRef<boolean>(false);

  /* PERF: useSharedValue — UI thread context, zero bridge cost */
  const capsuleX = useSharedValue<number>(0);

  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope);

  /* PERF: UI thread compositor rendering only */
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
    
    /* Initialize position instantly, bypassing spring on mount */
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope switcher"
    >
      <View style={styles.trackInner}>
        {/* Animated Premium Floating Capsule */}
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

        {/* Mapped Scope Tabs */}
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
// STYLES v5.0 (PREMIUM EDITION)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /** * The Sunken Track: 
   * Uses a subtle muted background without borders to create inward depth.
   */
  trackOuter: {
    height:           SWITCHER.HEIGHT,
    borderRadius:     SWITCHER.TRACK_RADIUS,
    backgroundColor:  colors.bg.surfaceMuted,
    overflow:         'hidden',
    /* Premium execution: removed harsh border, relying on color contrast */
  },
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD,
    marginVertical:   SWITCHER.TRACK_PAD,
    position:         'relative',
  },
  /** * The Floating Capsule:
   * Pure surface color with a diffused drop shadow. No harsh strokes.
   */
  capsule: {
    position:         'absolute',
    left:             0,
    top:              0,
    borderRadius:     SWITCHER.CAPSULE_RADIUS,
    backgroundColor:  colors.bg.surface,
    shadowColor:      colors.shadow.strong,
    shadowOffset:     SWITCHER.SHADOW_CAPSULE_OFFSET,
    shadowOpacity:    SWITCHER.SHADOW_CAPSULE_OPACITY,
    shadowRadius:     SWITCHER.SHADOW_CAPSULE_RADIUS,
    elevation:        4, 
  },
  scopeButton: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      44, /* HIG Touch Target Minimum */
    zIndex:         1,
  },
  tabContent: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap:            2, /* Slightly increased gap for premium breathing room */
  },
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 16,
    opacity:    1.0,
  },
  scopeEmojiInactive: {
    opacity: SWITCHER.OPACITY_EMOJI_INACTIVE,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SWITCHER.CHEVRON_GAP,
  },
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE,
    lineHeight: 15,
    textAlign:  'center',
    letterSpacing: -0.2, /* Tighter tracking for premium feel */
  },
  scopeLabelActive: {
    color:      colors.fg.brand,
    fontWeight: '800', /* Maximum dominance */
  },
  scopeLabelInactive: {
    color:      colors.fg.tertiary,
    fontWeight: '500',
    opacity:    SWITCHER.OPACITY_LABEL_INACTIVE,
  },
  chevron: {
    marginTop: 0.5,
  },
  chevronInactive: {
    opacity: SWITCHER.OPACITY_CHEVRON_INACTIVE,
  },
});

export default FourScopeSwitcher;

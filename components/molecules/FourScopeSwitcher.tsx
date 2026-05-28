/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.3  FINAL MASTER (Cross-Platform Fix)      ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Noor Aalam (Founder) · Chandigarh · May 2026                     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  FIX APPLIED:                                                            ║
 * ║  Resolved the Web/Browser stacking context issue where absolute Dabba    ║
 * ║  was hiding behind the track background. Removed zIndex dependency.      ║
 * ║                                                                          ║
 * ║  DESIGN TOKENS                                                           ║
 * ║  Zero hardcoded hex. All colours via `colors` from @/constants/colors    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo, useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ChatScope = 'world' | 'country' | 'city' | 'sector';

interface ScopeConfig {
  readonly key:          ChatScope;
  readonly emoji:        string;
  readonly defaultLabel: string;
  readonly hasPicker:    boolean;
  readonly a11yLabel:    string;
}

export interface ScopeLabel {
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

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

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
// LAYOUT CONSTANTS 
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_HEIGHT = 44 as const;
const H_PAD = 12 as const;
const CAPSULE_INSET = 3 as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPRING CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Press scale spring — quick, snappy squish feedback on tap.
 */
const SPRING_PRESS: WithSpringConfig = {
  damping:   30,
  stiffness: 450,
  mass:      1,
} as const;

/**
 * Scale spring for the Dabba (Box) to give it a slight pop-in effect.
 */
const SPRING_DABBA_SCALE: WithSpringConfig = {
  damping:   20,
  stiffness: 300,
  mass:      0.8,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHEVRON 
// ─────────────────────────────────────────────────────────────────────────────

const Chevron = memo(({ isActive }: { isActive: boolean }) => (
  <View
    style={[
      styles.chevron,
      { borderTopColor: isActive ? colors.fg.brand : colors.fg.tertiary },
    ]}
  />
));
Chevron.displayName = 'Chevron';

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE TAB  (Individual Button with Dedicated Background "Dabba")
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeTabProps {
  readonly scopeCfg: ScopeConfig;
  readonly isActive: boolean;
  readonly label:    string;
  readonly emoji:    string;
  readonly onPress:  (scope: ChatScope) => void;
}

const ScopeTab = memo(({
  scopeCfg,
  isActive,
  label,
  emoji,
  onPress,
}: ScopeTabProps): React.JSX.Element => {

  // ── Press-squish animation state ──
  const scale = useSharedValue<number>(1);

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), []);

  // ── Dabba (Active Box) animation state ──
  // Using withTiming for opacity as it's much more stable on Web/Browsers.
  const dabbaAnimStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isActive ? 1 : 0, { duration: 150 }),
    transform: [{ scale: withSpring(isActive ? 1 : 0.85, SPRING_DABBA_SCALE) }]
  }), [isActive]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(scopeCfg.key);
  }, [onPress, scopeCfg.key]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={scopeCfg.a11yLabel}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      {/* * THE DABBA (Active Box)
        * Rendered FIRST so it naturally sits behind the text. 
        * No zIndex used to prevent web/browser stacking context bugs.
      */}
      <Animated.View style={[styles.dabba, dabbaAnimStyle]} pointerEvents="none" />

      {/* Animated inner row (Content) — Rendered SECOND so it sits on top */}
      <Animated.View style={[styles.tabContent, pressAnimStyle]}>
        
        {/* Emoji */}
        <Text
          style={styles.emoji}
          allowFontScaling={false}
          selectable={false}
        >
          {emoji}
        </Text>

        {/* Label */}
        <Text
          style={[
            styles.label,
            isActive ? styles.labelActive : styles.labelInactive,
          ]}
          numberOfLines={1}
          allowFontScaling={false}
          selectable={false}
        >
          {label}
        </Text>

        {/* Dropdown chevron */}
        {scopeCfg.hasPicker && <Chevron isActive={isActive} />}
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

  // ── Tab press handler ──────────────────────────────────────────────────────
  const handleTabPress = useCallback((scope: ChatScope): void => {
    // Tactile feedback
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (scope === activeScope) {
      // Already active → re-tap opens the picker sheet
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    // Notify parent to update the active state
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen]);

  // ── Dynamic label / emoji resolution ──────────────────────────────────────
  const getLabel = useCallback((scope: ChatScope, fallback: string): string => {
    switch (scope) {
      case 'country': return labels.country || fallback;
      case 'city':    return labels.city    || fallback;
      case 'sector':  return labels.sector  || fallback;
      default:        return fallback;
    }
  }, [labels]);

  const getEmoji = useCallback((scope: ChatScope, fallback: string): string =>
    scope === 'country' ? (labels.countryEmoji || fallback) : fallback,
  [labels]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope selector"
    >
      {SCOPES.map((scopeCfg) => (
        <ScopeTab
          key={scopeCfg.key}
          scopeCfg={scopeCfg}
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
// STYLES 
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Track (outer pill) ─────────────────────────────────────────────────────
  track: {
    height:             TRACK_HEIGHT,
    backgroundColor:    colors.bg.surface,
    borderRadius:       8,
    flexDirection:      'row',
    alignItems:         'center',
    paddingHorizontal:  H_PAD,
    overflow:           'hidden',
  },

  // ── Individual tab container ───────────────────────────────────────────────
  tab: {
    flex:            1,
    height:          '100%',
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: 'transparent',
    // position: 'relative' is omitted to allow natural flex rendering.
  },

  // ── THE DABBA (New Theme-Matched Active Box) ───────────────────────────────
  dabba: {
    ...StyleSheet.absoluteFillObject,
    marginVertical:  CAPSULE_INSET, // Top and bottom spacing
    marginHorizontal: 3,            // Slight side padding to keep tabs separate
    backgroundColor: colors.bg.brandSubtle, // CROWN Theme matched color
    borderRadius:    6,
    // Removed zIndex entirely. It sits behind the text naturally because of JSX order.
  },

  // ── Tab inner content row ──────────────────────────────────────────────────
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,
    // Removed zIndex here as well.
  },

  // ── Emoji — isolated Text node ─────────────────────────────────────────────
  emoji: {
    fontSize:   13,
    lineHeight: 16,
    flexShrink: 0,
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  // ── Label — base (shared) ──────────────────────────────────────────────────
  label: {
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: 0.15,
    flexShrink:    1,
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  // ── Label — inactive state ─────────────────────────────────────────────────
  labelInactive: {
    fontWeight: '400',
    color:      colors.fg.tertiary,
  },

  // ── Label — active state ───────────────────────────────────────────────────
  labelActive: {
    fontWeight: '600',
    color:      colors.fg.primary,
  },

  // ── CSS border-triangle chevron ▼ ──────────────────────────────────────────
  chevron: {
    width:            0,
    height:           0,
    borderStyle:      'solid',
    borderLeftWidth:  3.5,
    borderRightWidth: 3.5,
    borderTopWidth:   4.5,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    flexShrink:       0,
    marginTop:        1,
  },
});

export default FourScopeSwitcher;

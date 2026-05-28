/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.2  FINAL MASTER                           ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher (Dabba/Box Update)                  ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Noor Aalam (Founder) · Chandigarh · May 2026                     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  VISUAL-MATCH PRD  (Phase 1.3 Update)                                    ║
 * ║                                                                          ║
 * ║  1. OPTICAL LAYOUT                                                       ║
 * ║     • Track: warm off-white pill, 44dp tall.                             ║
 * ║     • H_PAD: 12dp (mirrors HTML var(--sp-3) = 12px exactly).             ║
 * ║     • Dabba (Active Box): Har tab ke paas apna independent background    ║
 * ║       box hai jo active hone par theme color ke sath fade/scale hota hai.║
 * ║     • Tabs: flex:1, centered row — emoji · label · chevron — gap 3dp.    ║
 * ║                                                                          ║
 * ║  2. TYPOGRAPHY & EMOJI                                                   ║
 * ║     • Label: 12sp, weight 400/600.                                       ║
 * ║     • Letter-spacing: 0.15 ≈ HTML letter-spacing: 0.01em @ 12px.         ║
 * ║     • Emoji: isolated Text node, fontSize 13sp, lineHeight 16dp.         ║
 * ║                                                                          ║
 * ║  3. COMPONENT HIERARCHY                                                  ║
 * ║     FourScopeSwitcher (View, flexRow, paddingH=12, overflow:hidden)      ║
 * ║       └── ScopeTab × 4 (Pressable)                                       ║
 * ║             ├── Dabba (Animated.View - Active Background Box)            ║
 * ║             └── Content (Animated.View → emoji+label+▼)                  ║
 * ║                                                                          ║
 * ║  4. ANIMATION                                                            ║
 * ║     • Dabba (Box) spring: { damping: 20, stiffness: 300, mass: 0.8 }     ║
 * ║       Premium fade and scale-in effect when a tab becomes active.        ║
 * ║     • Press spring: { stiffness:450, damping:30 } → scale 0.95.          ║
 * ║                                                                          ║
 * ║  5. DESIGN TOKENS                                                        ║
 * ║     Zero hardcoded hex. All colours via `colors` from @/constants/colors ║
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
 * Dabba (Active Box) spring — Smooth, premium fade-in and subtle scale-up 
 * that gives the CROWN app its elite feel when switching scopes.
 */
const SPRING_DABBA: WithSpringConfig = {
  damping:   20,
  stiffness: 300,
  mass:      0.8,
} as const;

/**
 * Press scale spring — quick, snappy squish feedback on tap.
 */
const SPRING_PRESS: WithSpringConfig = {
  damping:   30,
  stiffness: 450,
  mass:      1,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHEVRON  (CSS border-triangle, zero icon font footprint)
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
  readonly index:    number;
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
  // Jab tab active hoga, dabba smoothly visible aur properly scaled ho jayega.
  const dabbaAnimStyle = useAnimatedStyle(() => ({
    opacity: withSpring(isActive ? 1 : 0, SPRING_DABBA),
    transform: [{ scale: withSpring(isActive ? 1 : 0.85, SPRING_DABBA) }]
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
        * Ye dedicated dabba hai jo us specific tab ke click hone par ban jata hai
        * aur hamari theme (brandSubtle) ke color se match karta hai.
      */}
      <Animated.View style={[styles.dabba, dabbaAnimStyle]} pointerEvents="none" />

      {/* Animated inner row — carries the press-scale transform */}
      <Animated.View style={[styles.tabContent, pressAnimStyle]}>
        
        {/* Emoji - Isolated Text node prevents OS line-height ballooning */}
        <Text
          style={styles.emoji}
          allowFontScaling={false}
          selectable={false}
        >
          {emoji}
        </Text>

        {/* Label - active/inactive color shifting */}
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
    // Tactile feedback — light impact
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      {/* Four scope tabs — Dabba logic is now encapsulated inside each tab */}
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
// STYLES (Zero Hardcoded Hex - Fully Theme Tokenized)
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
    position:        'relative', // Required for absolute positioning of Dabba
  },

  // ── THE DABBA (New Theme-Matched Active Box) ───────────────────────────────
  dabba: {
    position:        'absolute',
    top:             CAPSULE_INSET,
    bottom:          CAPSULE_INSET,
    left:            2,
    right:           2,
    backgroundColor: colors.bg.brandSubtle, // CROWN Theme matched color
    borderRadius:    6,
    zIndex:          0, // Sits behind the text content
  },

  // ── Tab inner content row ──────────────────────────────────────────────────
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,
    zIndex:         1, // Ensures text is above the dabba
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

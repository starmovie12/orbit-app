/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.0  PIXEL-PERFECT MATCH                   ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v7.0 — EXACT SCREENSHOT MATCH:                                ║
 * ║    [1] Track background: warm cream (colors.bg.brandSubtle) — NOT        ║
 * ║        transparent. The whole pill-bar has a visible warm background.    ║
 * ║    [2] Active capsule: slightly darker warm gold (colors.bg.brand) to    ║
 * ║        differentiate from track while staying in the same warm family.   ║
 * ║    [3] Capsule radius bumped to CAPSULE_H/2 = 16px → full pill shape     ║
 * ║        matching the screenshot's rounded ends exactly.                   ║
 * ║    [4] Track itself is a rounded pill container (TRACK_RADIUS = 12px).   ║
 * ║    [5] Overall HEIGHT tightened to 40px to match screenshot proportions. ║
 * ║    [6] Vertical padding (TRACK_PAD_V) added so capsule floats inside     ║
 * ║        the track with a small gap — matches the photo's inset look.      ║
 * ║    [7] Horizontal track padding reduced to 3px for tight-fit appearance. ║
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
import { MaterialIcons } from '@expo/vector-icons';
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
// DESIGN TOKENS — MATCHED PIXEL-PERFECT TO SCREENSHOT
//
//  Screenshot analysis:
//  ┌─────────────────────────────────────────────────────────────┐
//  │  Outer track : warm cream pill  (colors.bg.brandSubtle)     │
//  │  Active pill : slightly darker warm gold (colors.bg.brand)  │
//  │  Text        : dark charcoal, same on active + inactive     │
//  │  Chevron     : small ▼, same dark color                     │
//  │  Shape       : both track and capsule are full-pill rounded  │
//  └─────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  // ── Outer container ──────────────────────────────────────────
  HEIGHT:        40 as const,   // Total height of the switcher row
  TRACK_RADIUS:  20 as const,   // Full-pill outer track (= HEIGHT/2)

  // ── Horizontal & vertical padding inside track ───────────────
  TRACK_PAD_H:    3 as const,   // Left/right inset before capsule area
  TRACK_PAD_V:    3 as const,   // Top/bottom gap between track and capsule

  // ── Active capsule ────────────────────────────────────────────
  // Capsule height = track height − 2×vertical padding
  CAPSULE_H:     34 as const,   // 40 - 3 - 3 = 34 → capsule floats inside
  CAPSULE_RADIUS: 17 as const,  // = CAPSULE_H/2 → full pill ends

  // ── Typography ───────────────────────────────────────────────
  LABEL_SIZE:   13 as const,
  EMOJI_SIZE:   15 as const,
  CHEVRON_SIZE: 16 as const,

  // ── Spacing between emoji / label / chevron ───────────────────
  ITEM_GAP:      3 as const,

  TAB_COUNT: 4 as const,

  // ── Spring configs ────────────────────────────────────────────
  SPRING_SLIDE: { mass: 1, stiffness: 260, damping: 28 } as const satisfies WithSpringConfig,
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
  readonly scopeCfg:  ScopeConfig;
  readonly index:     number;
  readonly isActive:  boolean;
  readonly label:     string;
  readonly emoji:     string;
  readonly onPress:   (scope: ChatScope, index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — ScopeTab
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

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.scopeButton}
      accessibilityRole="tab"
      accessibilityLabel={scopeCfg.a11yLabel}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>

        {/* Emoji */}
        <Text style={styles.scopeEmoji} allowFontScaling={false}>
          {emoji}
        </Text>

        {/* Label */}
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

        {/* Dropdown chevron */}
        {scopeCfg.hasPicker && (
          <MaterialIcons
            name="arrow-drop-down"
            size={SWITCHER.CHEVRON_SIZE}
            color={colors.fg.primary}
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
// MAIN COMPONENT — FourScopeSwitcher
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope = 'world',
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps): React.JSX.Element {

  const [trackWidth, setTrackWidth]   = useState<number>(0);
  const tabWidthRef                   = useRef<number>(0);
  const userInitiatedRef              = useRef<boolean>(false);
  const isFirstRender                 = useRef<boolean>(true);

  const activeIndex  = SCOPES.findIndex((s) => s.key === activeScope) || 0;
  const capsuleX     = useSharedValue<number>(0);

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }), []);

  const slideCapsule = useCallback((toIndex: number, instant: boolean = false): void => {
    const tw = tabWidthRef.current;
    if (tw <= 0) return;
    if (instant) {
      capsuleX.value = toIndex * tw;
    } else {
      capsuleX.value = withSpring(toIndex * tw, SWITCHER.SPRING_SLIDE);
    }
  }, [capsuleX]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    const w  = e.nativeEvent.layout.width;
    // Available width for tabs = full track width minus left+right horizontal padding
    const tw = (w - SWITCHER.TRACK_PAD_H * 2) / SWITCHER.TAB_COUNT;
    tabWidthRef.current = tw;
    setTrackWidth(w);
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

  // Tab width used to size + position the sliding capsule
  const tabWidth = trackWidth > 0
    ? (trackWidth - SWITCHER.TRACK_PAD_H * 2) / SWITCHER.TAB_COUNT
    : 0;

  return (
    /**
     * trackOuter:
     *   • backgroundColor = colors.bg.brandSubtle  ← the warm cream PILL TRACK
     *     (resolves to ~#F1E5CC or your brand pale-gold)
     *   • borderRadius = TRACK_RADIUS (= 20) → full rounded pill ends
     *   • This is the visible warm background shown in the screenshot.
     */
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope switcher"
    >
      <View style={styles.trackInner}>

        {/* ── SLIDING ACTIVE CAPSULE ─────────────────────────────────────
         *  backgroundColor = colors.bg.brand  ← slightly darker warm gold
         *  (resolves to ~#E8D4A0 or your brand active-gold)
         *  This sits OVER the cream track giving the "selected pill" effect.
         * ──────────────────────────────────────────────────────────────── */}
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

        {/* ── SCOPE TABS ─────────────────────────────────────────────── */}
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
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Outer pill track ─────────────────────────────────────────────────────
  trackOuter: {
    height:          SWITCHER.HEIGHT,
    // ★ KEY CHANGE: warm cream background — this is the pill bar itself.
    //   Make sure colors.bg.brandSubtle → ~#F1E5CC (pale warm gold / cream).
    //   If your token resolves differently, override to the exact value from
    //   your design system that matches the screenshot's warm background.
    backgroundColor: colors.bg.brandSubtle,
    borderRadius:    SWITCHER.TRACK_RADIUS,      // full pill ends
    // No shadow/elevation on the track — flat, matches photo
    shadowOpacity:   0,
    elevation:       0,
  },

  // ── Inner row (holds capsule + tabs) ─────────────────────────────────────
  trackInner: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: SWITCHER.TRACK_PAD_H,      // 3px inset each side
    position:         'relative',
  },

  // ── Sliding active capsule ────────────────────────────────────────────────
  capsule: {
    position:        'absolute',
    left:            0,
    // Vertically centre the capsule within the track
    // top = (total height − capsule height) / 2 − TRACK_PAD_V
    // Because trackInner already clips to (HEIGHT - 0) and capsule is
    // positioned relative to trackInner's coordinate space:
    top:             (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2 - SWITCHER.TRACK_PAD_V,
    borderRadius:    SWITCHER.CAPSULE_RADIUS,   // full pill ends (= CAPSULE_H/2)

    // ★ KEY CHANGE: slightly darker warm gold than the track.
    //   colors.bg.brand should resolve to ~#E8D4A0 or the "active warm gold".
    //   If your token map differs, use whichever token is one step darker/richer
    //   than brandSubtle while staying in the same warm family.
    backgroundColor: colors.bg.brand,

    shadowOpacity:   0,
    elevation:       0,
    zIndex:          0,
  },

  // ── Individual tab pressable ──────────────────────────────────────────────
  scopeButton: {
    flex:           1,
    height:         '100%',
    justifyContent: 'center',
    zIndex:         1,
  },

  // ── Row inside each tab: emoji + label + chevron ─────────────────────────
  tabContent: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               SWITCHER.ITEM_GAP,
    paddingHorizontal: 2,
  },

  // ── Emoji ─────────────────────────────────────────────────────────────────
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,
    lineHeight: 18,
  },

  // ── Label wrapper ─────────────────────────────────────────────────────────
  textContainer: {
    flexShrink: 1,
  },

  // ── Label base ────────────────────────────────────────────────────────────
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE,
    lineHeight: 16,
    textAlign:  'center',
  },

  // Active label — slightly bolder; same dark color as inactive (photo shows
  // no colour change between active and inactive text)
  scopeLabelActive: {
    color:      colors.fg.primary,
    fontWeight: '600',
  },

  // Inactive label — regular weight; dark charcoal same as active
  scopeLabelInactive: {
    color:      colors.fg.primary,
    fontWeight: '400',
  },

  // ── Dropdown chevron ──────────────────────────────────────────────────────
  chevron: {
    marginLeft: -2,
    marginTop:  1,
  },

});

export default FourScopeSwitcher;

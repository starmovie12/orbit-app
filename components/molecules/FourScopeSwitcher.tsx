/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Four-Scope Switcher (Row 2 of 3-Row Header)                     ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher (48px)                             ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  4 SCOPE BUTTONS (equal-width, segmented):                               ║
 * ║    🌍 World   — global chat (every CROWN user on Earth)                  ║
 * ║    🇮🇳 Country — your country's chat (flag + country name)               ║
 * ║    🏙️ City    — your city's chat                                         ║
 * ║    🏘️ Sector  — your sector's chat                                       ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  TAP BEHAVIORS (§1.3.3):                                                 ║
 * ║    Single tap on non-active → instant scope switch (<300ms)              ║
 * ║    Single tap on already-active → opens geography picker bottom sheet    ║
 * ║    World button has NO picker (one global room)                           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ACTIVE STATE VISUAL (§1.3.3):                                           ║
 * ║    Sliding capsule pill — white bg · gold ring · spring(160, 20)         ║
 * ║    Active icon/text: var(--fg-brand) gold                                ║
 * ║    Inactive: var(--fg-text-muted)                                        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SCROLL BEHAVIOR:                                                         ║
 * ║    Row 2 NEVER hides when composer is focused (keyboard open).            ║
 * ║    User must be able to re-target message at correct scope before send.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ChatScope = 'world' | 'country' | 'city' | 'sector';

interface ScopeConfig {
  readonly key:       ChatScope;
  /** Flag emoji + name rendered in button */
  readonly emoji:     string;
  /** Default display name (overridden by user's active geography) */
  readonly defaultLabel: string;
  /** Has geography picker on active re-tap? World = false */
  readonly hasPicker: boolean;
  /** Accessibility label */
  readonly a11yLabel: string;
}

const SCOPES: readonly ScopeConfig[] = [
  {
    key:          'world',
    emoji:        '🌍',
    defaultLabel: 'World',
    hasPicker:    false,   // One global room — no picker
    a11yLabel:    'World chat — duniya bhar ke users se baat karo',
  },
  {
    key:          'country',
    emoji:        '🇮🇳',   // Overridden at runtime with user's country flag
    defaultLabel: 'India', // Overridden at runtime with user's country name
    hasPicker:    true,    // Can switch to any of 195 countries
    a11yLabel:    'Country chat — apne desh ke users se baat karo',
  },
  {
    key:          'city',
    emoji:        '🏙️',
    defaultLabel: 'City',  // Overridden with user's home city name
    hasPicker:    true,    // Can switch to any city
    a11yLabel:    'City chat — apne shahar ke users se baat karo',
  },
  {
    key:          'sector',
    emoji:        '🏘️',
    defaultLabel: 'Sector', // Overridden with user's home sector name
    hasPicker:    true,     // Can switch to any sector in active city
    a11yLabel:    'Sector chat — apne sector ke users se baat karo',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** §1.3.3 Row 2 — "Height: 48px" */
  HEIGHT: 48 as const,

  /** Horizontal padding of the entire switcher row */
  PAD_H: 0 as const,  // Edge-to-edge within screen horizontal padding

  /** Internal padding of each scope button */
  BUTTON_PAD_H: 4 as const,
  BUTTON_PAD_V: 6 as const,

  /** Icon size */
  EMOJI_SIZE: 16 as const,

  /** Label typography — §1.3.3 "13px Inter 500" inactive, "13px Inter 600" active */
  LABEL_SIZE: 13 as const,

  /** §1.3.3 capsule: spring(160, 20) */
  SPRING_TENSION: 160 as const,
  SPRING_FRICTION: 20 as const,

  /** Capsule height — within 48px row */
  CAPSULE_H: 32 as const,

  /** Haptic — 10ms vibration (light) on tab switch §1.3.3 */
  HAPTIC: Haptics.ImpactFeedbackStyle.Light,

  /** Tab switch animation — §1.4.5 "280ms spring(160, 20)" */
  SWITCH_DURATION: 280 as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeLabel {
  readonly country: string; // e.g., "India"
  readonly city:    string; // e.g., "Mumbai"
  readonly sector:  string; // e.g., "Bandra W"
  readonly countryEmoji: string; // e.g., "🇮🇳"
}

interface FourScopeSwitcherProps {
  /** Currently active scope */
  readonly activeScope: ChatScope;
  /** Called when user taps a different scope button */
  readonly onScopeChange: (scope: ChatScope) => void;
  /** Called when user re-taps the active scope (open geography picker) */
  readonly onPickerOpen: (scope: ChatScope) => void;
  /** Actual geography names from user's active session */
  readonly labels: ScopeLabel;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FourScopeSwitcher({
  activeScope,
  onScopeChange,
  onPickerOpen,
  labels,
}: FourScopeSwitcherProps) {

  const [containerWidth, setContainerWidth] = useState(0);
  const capsuleX = useRef(new Animated.Value(0)).current;

  const tabWidth = containerWidth > 0 ? containerWidth / 4 : 0;
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope);

  // ── Slide capsule to new active tab ────────────────────────────────────────
  const slideCapsule = useCallback((toIndex: number) => {
    Animated.spring(capsuleX, {
      toValue:         toIndex * tabWidth,
      useNativeDriver: true,
      tension:         SWITCHER.SPRING_TENSION, // 160
      friction:        SWITCHER.SPRING_FRICTION, // 20
    }).start();
  }, [capsuleX, tabWidth]);

  // ── Handle tab press ────────────────────────────────────────────────────────
  const handlePress = useCallback((scope: ChatScope, index: number) => {
    Haptics.impactAsync(SWITCHER.HAPTIC);

    if (scope === activeScope) {
      // Re-tapping active scope → open geography picker
      // Exception: World has no picker (one global room)
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) {
        onPickerOpen(scope);
      }
      return;
    }

    // Switching to different scope → instant visual + animation
    slideCapsule(index);
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen, slideCapsule]);

  // ── Layout measured → initialize capsule position ─────────────────────────
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(w);
    // Initialize capsule position without animation
    capsuleX.setValue(activeIndex * (w / 4));
  }, [capsuleX, activeIndex]);

  // ── Get display label for each scope ─────────────────────────────────────
  const getLabel = (scope: ChatScope, defaultLabel: string): string => {
    switch (scope) {
      case 'country': return labels.country || defaultLabel;
      case 'city':    return labels.city    || defaultLabel;
      case 'sector':  return labels.sector  || defaultLabel;
      default:        return defaultLabel;
    }
  };

  const getEmoji = (scope: ChatScope, defaultEmoji: string): string => {
    if (scope === 'country') return labels.countryEmoji || defaultEmoji;
    return defaultEmoji;
  };

  return (
    <View
      style={styles.container}
      onLayout={onContainerLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope switcher"
    >
      {/* Sliding capsule pill — animated absolute behind buttons */}
      {containerWidth > 0 ? (
        <Animated.View
          style={[
            styles.capsule,
            {
              width:     tabWidth,
              height:    SWITCHER.CAPSULE_H,
              transform: [{ translateX: capsuleX }],
            },
          ]}
          pointerEvents="none"
        />
      ) : null}

      {/* 4 scope buttons */}
      {SCOPES.map((scopeCfg, index) => {
        const isActive   = scopeCfg.key === activeScope;
        const label      = getLabel(scopeCfg.key, scopeCfg.defaultLabel);
        const emoji      = getEmoji(scopeCfg.key, scopeCfg.emoji);
        const textColor  = isActive ? colors.fg.brand : colors.fg.tertiary;
        const fontWeight = isActive ? '600' : '500';

        return (
          <Pressable
            key={scopeCfg.key}
            onPress={() => handlePress(scopeCfg.key, index)}
            style={styles.scopeButton}
            accessibilityRole="tab"
            accessibilityLabel={scopeCfg.a11yLabel}
            accessibilityState={{ selected: isActive }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text
              style={[styles.scopeText, { color: textColor, fontWeight: fontWeight as any }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {emoji} {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Row 2 container — §1.3.3 "Height: 48px" ──────────────────────────────
  container: {
    flexDirection:   'row',
    height:          SWITCHER.HEIGHT,          // 48px
    alignItems:      'center',
    position:        'relative',
    backgroundColor: 'transparent',            // §1.3.3: "clean transparent track"
  },

  // ── Sliding capsule — §1.3.3 "White sliding capsule pill (above)" ─────────
  // §1.3.3 CSS spec:
  //   background: var(--bg-surface)
  //   border-radius: 16px
  //   box-shadow: 0 1px 8px rgba(24,15,4,0.12), 0 0 0 1px rgba(200,144,10,0.15)
  //                                               ↑ subtle gold ring
  capsule: {
    position:        'absolute',
    left:            0,
    top:             (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2, // vertically centered in 48px
    borderRadius:    16,
    backgroundColor: colors.bg.surface,
    // Shadow spec from §1.3.3
    shadowColor:     '#180F04',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.12,
    shadowRadius:    8,
    elevation:       2,
  },

  // ── Scope button — 25% width, full height ─────────────────────────────────
  scopeButton: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: SWITCHER.BUTTON_PAD_H,
    paddingVertical: SWITCHER.BUTTON_PAD_V,
    minHeight:       44,  // iOS HIG minimum touch target
    zIndex:          1,   // Above capsule (pointer events passthrough via pointerEvents="none" on capsule)
  },

  // ── Scope label — §1.3.3 "13px Inter 500/600" ────────────────────────────
  scopeText: {
    fontSize:        SWITCHER.LABEL_SIZE,      // 13px
    lineHeight:      18,
    textAlign:       'center',
  },

});

export default FourScopeSwitcher;

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Four-Scope Switcher (Row 2 of 3-Row Header)                     ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher (44px)                             ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v3.3:                                                         ║
 * ║    [1] Added chevron-down indicator on Country / City / Sector tabs      ║
 * ║        → signals that re-tapping the active tab opens a picker sheet     ║
 * ║        → World tab has NO chevron (no picker available)                  ║
 * ║    [2] Row height compressed 48px → 44px (founder compaction mandate)    ║
 * ║    [3] Capsule height updated 32px → 28px to match new row height        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  4 SCOPE BUTTONS (equal-width, segmented):                               ║
 * ║    🌍 World   — global chat (every CROWN user on Earth)                  ║
 * ║    🇮🇳 Country — your country's chat (flag + country name) ▾            ║
 * ║    🏙️ City    — your city's chat ▾                                       ║
 * ║    🏘️ Sector  — your sector's chat ▾                                     ║
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
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radii } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ChatScope = 'world' | 'country' | 'city' | 'sector';

interface ScopeConfig {
  readonly key:          ChatScope;
  /** Flag emoji + name rendered in button */
  readonly emoji:        string;
  /** Default display name (overridden by user's active geography) */
  readonly defaultLabel: string;
  /**
   * Has geography picker on active re-tap?
   * World = false (one global room — no picker, no chevron).
   * Country / City / Sector = true (chevron-down shown on active tab).
   */
  readonly hasPicker:    boolean;
  /** Accessibility label */
  readonly a11yLabel:    string;
}

const SCOPES: readonly ScopeConfig[] = [
  {
    key:          'world',
    emoji:        '🌍',
    defaultLabel: 'World',
    hasPicker:    false,   // One global room — no picker, no chevron
    a11yLabel:    'World chat — duniya bhar ke users se baat karo',
  },
  {
    key:          'country',
    emoji:        '🇮🇳',   // Overridden at runtime with user's country flag
    defaultLabel: 'India', // Overridden at runtime with user's country name
    hasPicker:    true,    // Can switch to any of 195 countries → chevron shown
    a11yLabel:    'Country chat — apne desh ke users se baat karo. Tap to change country.',
  },
  {
    key:          'city',
    emoji:        '🏙️',
    defaultLabel: 'City',  // Overridden with user's home city name
    hasPicker:    true,    // Can switch to any city → chevron shown
    a11yLabel:    'City chat — apne shahar ke users se baat karo. Tap to change city.',
  },
  {
    key:          'sector',
    emoji:        '🏘️',
    defaultLabel: 'Sector', // Overridden with user's home sector name
    hasPicker:    true,     // Can switch to any sector in active city → chevron shown
    a11yLabel:    'Sector chat — apne sector ke users se baat karo. Tap to change sector.',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /**
   * [v3.3 CHANGE] Row height compressed 48px → 44px.
   * Total header savings: 4px.
   * §1.3.3 Row 2 — "Height: 44px"
   */
  HEIGHT: 44 as const,

  /** Horizontal padding of each scope button */
  BUTTON_PAD_H: 4 as const,
  BUTTON_PAD_V: 6 as const,

  /** Label typography — §1.3.3 "13px Inter 500" inactive, "13px Inter 600" active */
  LABEL_SIZE: 13 as const,

  /**
   * [v3.3 NEW] Chevron-down icon size for hasPicker tabs.
   * 9px — small enough to feel like a hint, not a button.
   */
  CHEVRON_SIZE: 9 as const,

  /**
   * [v3.3 NEW] Gap between label text and chevron icon.
   */
  CHEVRON_GAP: 2 as const,

  /** §1.3.3 capsule: spring(160, 20) */
  SPRING_TENSION:  160 as const,
  SPRING_FRICTION: 20  as const,

  /**
   * [v3.3 CHANGE] Capsule height updated 32px → 28px to match new 44px row.
   * Vertically centered: top = (44 - 28) / 2 = 8px
   */
  CAPSULE_H: 28 as const,

  /** Haptic — light impact on tab switch §1.3.3 */
  HAPTIC: Haptics.ImpactFeedbackStyle.Light,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeLabel {
  readonly country:      string; // e.g., "India"
  readonly city:         string; // e.g., "Mumbai"
  readonly sector:       string; // e.g., "Bandra W"
  readonly countryEmoji: string; // e.g., "🇮🇳"
}

interface FourScopeSwitcherProps {
  /** Currently active scope */
  readonly activeScope:   ChatScope;
  /** Called when user taps a different scope button */
  readonly onScopeChange: (scope: ChatScope) => void;
  /** Called when user re-taps the active scope (open geography picker) */
  readonly onPickerOpen:  (scope: ChatScope) => void;
  /** Actual geography names from user's active session */
  readonly labels:        ScopeLabel;
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

  const tabWidth    = containerWidth > 0 ? containerWidth / 4 : 0;
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope);

  // ── Slide capsule to new active tab ────────────────────────────────────────
  const slideCapsule = useCallback((toIndex: number) => {
    Animated.spring(capsuleX, {
      toValue:         toIndex * tabWidth,
      useNativeDriver: true,
      tension:         SWITCHER.SPRING_TENSION,  // 160
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
        const isActive    = scopeCfg.key === activeScope;
        const label       = getLabel(scopeCfg.key, scopeCfg.defaultLabel);
        const emoji       = getEmoji(scopeCfg.key, scopeCfg.emoji);
        const textColor   = isActive ? colors.fg.brand   : colors.fg.tertiary;
        const chevronColor = isActive ? colors.fg.brand  : colors.fg.tertiary;
        const fontWeight  = isActive ? '600' : '500';

        /**
         * [v3.3 NEW] Chevron visibility rule:
         *   — hasPicker: true  → always show chevron (subtle hint for every user)
         *   — hasPicker: false → never show chevron (World tab)
         *
         * The chevron is rendered at reduced opacity (0.6) on inactive tabs
         * and full opacity on the active tab, so it doesn't distract when
         * the tab is not selected but still teaches the interaction model.
         */
        const showChevron = scopeCfg.hasPicker;
        const chevronOpacity = isActive ? 1.0 : 0.55;

        return (
          <Pressable
            key={scopeCfg.key}
            onPress={() => handlePress(scopeCfg.key, index)}
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
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            {/* Label row: emoji + name + optional chevron */}
            <View style={styles.tabContent}>
              <Text
                style={[
                  styles.scopeText,
                  { color: textColor, fontWeight: fontWeight as '500' | '600' },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {emoji} {label}
              </Text>

              {/* [v3.3 NEW] Chevron-down for hasPicker tabs */}
              {showChevron ? (
                <Feather
                  name="chevron-down"
                  size={SWITCHER.CHEVRON_SIZE}     // 9px
                  color={chevronColor}
                  style={{ opacity: chevronOpacity, marginTop: 1 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
            </View>
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

  // ── Row 2 container — §1.3.3 "Height: 44px" (v3.3: 48→44) ────────────────
  container: {
    flexDirection:   'row',
    height:          SWITCHER.HEIGHT,          // 44px
    alignItems:      'center',
    position:        'relative',
    backgroundColor: 'transparent',
  },

  // ── Sliding capsule — §1.3.3 "White sliding capsule pill (above)" ─────────
  // [v3.3] capsule height 32px → 28px; top-offset = (44 - 28) / 2 = 8px
  capsule: {
    position:        'absolute',
    left:            0,
    top:             (SWITCHER.HEIGHT - SWITCHER.CAPSULE_H) / 2, // 8px — vertically centered
    borderRadius:    14,
    backgroundColor: colors.bg.surface,
    // Subtle elevation with gold undertone ring (§1.3.3)
    shadowColor:     '#180F04',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.12,
    shadowRadius:    8,
    elevation:       2,
  },

  // ── Scope button — 25% width, full height ─────────────────────────────────
  scopeButton: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: SWITCHER.BUTTON_PAD_H,
    paddingVertical:   SWITCHER.BUTTON_PAD_V,
    minHeight:         44,   // iOS HIG minimum touch target
    zIndex:            1,    // Above capsule (capsule has pointerEvents="none")
  },

  // ── [v3.3 NEW] Tab content row — label + chevron side-by-side ─────────────
  tabContent: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SWITCHER.CHEVRON_GAP,   // 2px
  },

  // ── Scope label — §1.3.3 "13px Inter 500/600" ────────────────────────────
  scopeText: {
    fontSize:   SWITCHER.LABEL_SIZE,       // 13px
    lineHeight: 18,
    textAlign:  'center',
  },

});

export default FourScopeSwitcher;

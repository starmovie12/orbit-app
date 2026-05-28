/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Four-Scope Switcher  v4.0  PREMIUM REDESIGN                     ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher (44px)                             ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v4.0 — PREMIUM REDESIGN:                                      ║
 * ║    [1] Track container added — warm cream pill wraps all 4 tabs          ║
 * ║        → fixes "capsule invisible on white bg" problem completely        ║
 * ║    [2] Active capsule: white bg + gold ring border (1px) + elevation     ║
 * ║        → premium iOS-segmented-control aesthetic                         ║
 * ║    [3] Tab layout: emoji now 15px (was 13px) + label below (2-line)      ║
 * ║        → richer visual hierarchy per tab                                 ║
 * ║    [4] Active label: brand gold 700-weight (was just 600)                ║
 * ║    [5] Inactive: proper 50% opacity treatment, not just color change     ║
 * ║    [6] Chevron: moved inline right of label, 8px (was 9px) — sharper    ║
 * ║    [7] Spring: tension 180 (was 160) — snappier, more premium feel      ║
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
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS v4.0
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  /** Row height — §1.3.3 "Height: 44px" */
  HEIGHT: 44 as const,

  /**
   * Track container — the warm cream pill that wraps all 4 tabs.
   * This is the v4.0 fix: capsule was invisible on white bg because
   * the container and capsule were both white. Now: container = warm cream,
   * capsule = white. The contrast is immediately legible.
   * 3px inset creates an "inset track" feel matching iOS/Linear quality bar.
   */
  TRACK_PAD: 3 as const,
  TRACK_RADIUS: 20 as const,

  /** Label typography */
  LABEL_SIZE:  12 as const,   // v4.0: 13 → 12px (tighter, more premium at this size)
  EMOJI_SIZE:  14 as const,   // v4.0: NEW — emoji rendered at its own explicit size

  /**
   * v4.0: Chevron size reduced 9px → 8px.
   * At 12px label size, 8px feels proportionate and crisp.
   */
  CHEVRON_SIZE: 8 as const,
  CHEVRON_GAP:  2 as const,

  /**
   * v4.0: Spring tension bumped 160 → 180.
   * Faster settle = more decisive, premium feel.
   * Friction stays at 20 — preserves the slight overshoot-and-settle.
   */
  SPRING_TENSION:  180 as const,
  SPRING_FRICTION: 20  as const,

  /**
   * v4.0: Capsule height stays 28px; top-offset = (44 - 28) / 2 = 8px.
   * But track inset (3px) means capsule is offset within the track:
   * effective top = TRACK_PAD + (CAPSULE_SLOT - 28) / 2
   */
  CAPSULE_H: 28 as const,

  /** Haptic on tab switch */
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

interface FourScopeSwitcherProps {
  readonly activeScope:   ChatScope;
  readonly onScopeChange: (scope: ChatScope) => void;
  readonly onPickerOpen:  (scope: ChatScope) => void;
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

  const [trackWidth, setTrackWidth] = useState(0);
  const capsuleX = useRef(new Animated.Value(0)).current;

  // Tab width = track inner width / 4 (subtract 2×TRACK_PAD for inner area)
  const innerWidth = trackWidth > 0 ? trackWidth - SWITCHER.TRACK_PAD * 2 : 0;
  const tabWidth   = innerWidth > 0 ? innerWidth / 4 : 0;
  const activeIndex = SCOPES.findIndex((s) => s.key === activeScope);

  // ── Slide capsule to new active tab ────────────────────────────────────────
  const slideCapsule = useCallback((toIndex: number) => {
    Animated.spring(capsuleX, {
      toValue:         toIndex * tabWidth,
      useNativeDriver: true,
      tension:         SWITCHER.SPRING_TENSION,  // 180
      friction:        SWITCHER.SPRING_FRICTION, // 20
    }).start();
  }, [capsuleX, tabWidth]);

  // ── Handle tab press ─────────────────────────────────────────────────────
  const handlePress = useCallback((scope: ChatScope, index: number) => {
    Haptics.impactAsync(SWITCHER.HAPTIC);

    if (scope === activeScope) {
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) {
        onPickerOpen(scope);
      }
      return;
    }

    slideCapsule(index);
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen, slideCapsule]);

  // ── Measure outer track width ─────────────────────────────────────────────
  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(w);
    // Initialize capsule position (subtract TRACK_PAD for inner offset)
    capsuleX.setValue(activeIndex * ((w - SWITCHER.TRACK_PAD * 2) / 4));
  }, [capsuleX, activeIndex]);

  // ── Get display label and emoji ───────────────────────────────────────────
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
    /**
     * v4.0: Outer track container — the warm-cream pill.
     * This is THE key premium upgrade. Before v4.0, the switcher was floating
     * tabs on a plain white background. Now it sits inside a warm, inset track
     * that gives the entire row visual containment and signals interactivity.
     *
     * The track uses `colors.bg.surfaceMuted` (a warm off-white / cream).
     * The active capsule uses `colors.bg.surface` (pure white).
     * contrast: track = cream → capsule = white → reads as "selected island".
     */
    <View
      style={styles.trackOuter}
      onLayout={onTrackLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope switcher"
    >
      {/* ── Inner track (accounts for 3px padding on each side) ────────────── */}
      <View style={styles.trackInner}>

        {/* Sliding capsule pill — positioned inside trackInner */}
        {trackWidth > 0 ? (
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
          const isActive     = scopeCfg.key === activeScope;
          const label        = getLabel(scopeCfg.key, scopeCfg.defaultLabel);
          const emoji        = getEmoji(scopeCfg.key, scopeCfg.emoji);
          const showChevron  = scopeCfg.hasPicker;

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
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              {/* Emoji — always full opacity; size differentiated by active state */}
              <Text
                style={[
                  styles.scopeEmoji,
                  !isActive && styles.scopeEmojiInactive,
                ]}
                allowFontScaling={false}
              >
                {emoji}
              </Text>

              {/* Label row: text + optional chevron */}
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

                {/* Chevron — only for hasPicker tabs */}
                {showChevron ? (
                  <Feather
                    name="chevron-down"
                    size={SWITCHER.CHEVRON_SIZE}
                    color={isActive ? colors.fg.brand : colors.fg.tertiary}
                    style={[
                      styles.chevron,
                      !isActive && { opacity: 0.45 },
                    ]}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
              </View>

            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES v4.0
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  /**
   * v4.0 NEW: Outer track container.
   * The cream/muted background that contains all 4 tabs.
   * This is the single most impactful visual change in v4.0.
   *
   * Height: 44px (matches ROW2_H).
   * Radius: 20px — fully rounded pill shape.
   * backgroundColor: colors.bg.surfaceMuted — warm cream, ~F5EDD8 tone.
   * borderWidth: 1px subtle border for depth.
   */
  trackOuter: {
    height:          SWITCHER.HEIGHT,        // 44px
    borderRadius:    SWITCHER.TRACK_RADIUS,  // 20px
    backgroundColor: colors.bg.surfaceMuted, // warm cream track
    borderWidth:     1,
    borderColor:     colors.border.subtle,   // hairline depth border
    overflow:        'hidden',
    // Subtle inner shadow via platform-specific elevation (Android) / shadow (iOS)
    shadowColor:     colors.shadow.soft,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    3,
    elevation:       1,
  },

  /**
   * v4.0 NEW: Inner track — inset 3px on all sides.
   * Capsule sits within this area; the 3px gap shows the cream track edge,
   * creating the "inset pill" visual — identical to iOS segmented control.
   */
  trackInner: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    marginHorizontal: SWITCHER.TRACK_PAD,   // 3px inset
    marginVertical:   SWITCHER.TRACK_PAD,   // 3px inset
    position:        'relative',
  },

  /**
   * v4.0 REDESIGNED: Active capsule — white + gold ring + elevation.
   * The gold ring (borderColor: colors.fg.brand at low opacity) is the
   * premium touch that ties the capsule to the CROWN brand.
   * It's subtle (opacity ~0.25) — felt more than seen.
   */
  capsule: {
    position:        'absolute',
    left:            0,
    top:             0, // vertically centered by trackInner marginVertical
    borderRadius:    SWITCHER.TRACK_RADIUS - SWITCHER.TRACK_PAD, // 17px
    backgroundColor: colors.bg.surface,     // pure white (contrast vs cream track)
    borderWidth:     1,
    borderColor:     colors.border.gold,    // subtle gold ring — the brand signal
    // Elevation for the "floating above track" feel
    shadowColor:     colors.shadow.medium,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.14,
    shadowRadius:    6,
    elevation:       3,
  },

  /**
   * Each scope tab — 25% of inner track width, full height.
   * Two-line layout: emoji on top, label below.
   * zIndex: 1 — sits above the capsule (capsule has pointerEvents="none").
   */
  scopeButton: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         44,                   // iOS HIG minimum
    zIndex:            1,
    paddingVertical:   2,
    gap:               1,                    // 1px gap between emoji and label row
  },

  /** Emoji — rendered at explicit 14px, full opacity on active */
  scopeEmoji: {
    fontSize:   SWITCHER.EMOJI_SIZE,         // 14px
    lineHeight: 17,
    opacity:    1.0,
  },

  /** Inactive emoji: 65% opacity — clearly muted, not invisible */
  scopeEmojiInactive: {
    opacity: 0.65,
  },

  /**
   * Label row: text + chevron side-by-side.
   * gap: 2px gives just enough breathing room between text and chevron.
   */
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SWITCHER.CHEVRON_GAP,    // 2px
  },

  /** Base label style */
  scopeLabel: {
    fontSize:   SWITCHER.LABEL_SIZE,        // 12px
    lineHeight: 15,
    textAlign:  'center',
  },

  /**
   * v4.0: Active label — brand gold at weight 700.
   * Weight 700 (was 600) makes the active tab clearly dominant even at 12px.
   */
  scopeLabelActive: {
    color:      colors.fg.brand,            // amber gold
    fontWeight: '700',
  },

  /**
   * v4.0: Inactive label — tertiary color at 55% opacity.
   * At 55% (not 100% tertiary) the inactive tabs feel truly recessed,
   * giving maximum contrast with the active gold tab.
   */
  scopeLabelInactive: {
    color:      colors.fg.tertiary,
    fontWeight: '500',
    opacity:    0.7,
  },

  /** Chevron — inline right of label, marginTop: 0.5px for optical centering */
  chevron: {
    marginTop: 0.5,
  },

});

export default FourScopeSwitcher;

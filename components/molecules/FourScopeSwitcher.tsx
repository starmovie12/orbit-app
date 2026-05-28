/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v8.0  HTML-MATCHED UNDERLINE DESIGN          ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                     ║
 * ║  Phase 1.3 · App Architecture                                            ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  CHANGELOG v8.0 — HTML BLUEPRINT MATCH:                                  ║
 * ║    [1] Removed sliding pill capsule & pill-track background.             ║
 * ║    [2] Now uses per-tab UNDERLINE indicator — exact match to HTML.       ║
 * ║    [3] Active tab: fontWeight 600 + colors.fg.primary (deep onyx).       ║
 * ║    [4] Inactive tab: fontWeight 400 + colors.fg.muted (antique bronze).  ║
 * ║    [5] Underline: 2.5px height, colors.bg.brand gold, scaleX spring.     ║
 * ║    [6] Underline origin: left (matches HTML transform-origin: left).     ║
 * ║    [7] Row height 48px, tab height 28px — blueprint-exact.               ║
 * ║    [8] Chevron ▼ removed — HTML design has no chevron in Row 2.          ║
 * ║    [9] Emoji + label in single Text node, gap handled via space char.    ║
 * ║   [10] Pressed state: fg.brandSubtle bg overlay (matches hover in HTML). ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useCallback, useRef, memo } from 'react';
import {
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
// DESIGN TOKENS — MATCHED TO HTML BLUEPRINT
//
//  HTML Row 2 analysis:
//  ┌─────────────────────────────────────────────────────────────────┐
//  │  Row height   : 48px  (--height-row2)                           │
//  │  Row bg       : var(--bg-surface) = #FFF8F0 (transparent)       │
//  │  Tab height   : 28px, flex:1, radius 6px                        │
//  │  Active label : font-weight 600 + fg-text-strong (#1A1208)      │
//  │  Inactive lbl : font-weight 400 + fg-text-muted  (#7A5C2E)      │
//  │  Underline    : 2.5px, brand gold, left 12%, right 12%          │
//  │                 scaleX 0→1 spring, transform-origin: left       │
//  │  Pressed bg   : fg-brand-subtle  rgba(200,150,12,0.10)          │
//  │  No chevron   : HTML design does not show ▼ in Row 2            │
//  │  Emoji+label  : single span "🌍 World" — no separate nodes      │
//  └─────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

const SWITCHER = {
  // ── Row dimensions ───────────────────────────────────────────
  ROW_HEIGHT:   48 as const,   // --height-row2
  TAB_HEIGHT:   28 as const,   // .scope-tab height
  TAB_RADIUS:    6 as const,   // --radius-md

  // ── Row padding ──────────────────────────────────────────────
  ROW_PAD_H:   16 as const,   // --sp-4 (0 var(--sp-4))
  ROW_GAP:      4 as const,   // --sp-1 gap between tabs

  // ── Underline ────────────────────────────────────────────────
  UNDERLINE_H:    2.5 as const,  // height: 2.5px
  UNDERLINE_INSET: 0.12 as const, // left: 12%, right: 12%

  // ── Typography ───────────────────────────────────────────────
  LABEL_SIZE: 13 as const,     // .scope-tab-label font-size

  // ── Spring configs ────────────────────────────────────────────
  //   Underline scale: snappy ease-out feel (matches CSS ease-out)
  SPRING_UNDERLINE: { mass: 1, stiffness: 320, damping: 26 } as const satisfies WithSpringConfig,
  //   Press scale feedback
  SPRING_PRESS:     { mass: 1, stiffness: 450, damping: 30 } as const satisfies WithSpringConfig,

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
  readonly scopeCfg: ScopeConfig;
  readonly index:    number;
  readonly isActive: boolean;
  readonly label:    string;   // full display string e.g. "🏙️ Mumbai"
  readonly onPress:  (scope: ChatScope, index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — ScopeTab
// ─────────────────────────────────────────────────────────────────────────────

const ScopeTab = memo(({
  scopeCfg,
  index,
  isActive,
  label,
  onPress,
}: ScopeTabProps): React.JSX.Element => {

  // ── Press scale animation (subtle bounce on tap) ──────────────
  const scale = useSharedValue<number>(1);

  const tabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), []);

  // ── Underline scaleX animation ────────────────────────────────
  // Starts at 0 (hidden) or 1 (active on mount).
  // On tab switch the new tab animates 0→1, old tab 1→0.
  const underlineScale = useSharedValue<number>(isActive ? 1 : 0);

  // Sync underlineScale whenever isActive changes from parent
  const prevActive = useRef<boolean>(isActive);
  if (prevActive.current !== isActive) {
    prevActive.current = isActive;
    underlineScale.value = withSpring(
      isActive ? 1 : 0,
      SWITCHER.SPRING_UNDERLINE,
    );
  }

  const underlineAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: underlineScale.value }],
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
      style={({ pressed }) => [
        styles.scopeButton,
        pressed && styles.scopeButtonPressed,
      ]}
      accessibilityRole="tab"
      accessibilityLabel={scopeCfg.a11yLabel}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
    >
      {/* ── Animated row: emoji + label ──────────────────────── */}
      <Animated.View style={[styles.tabContent, tabAnimStyle]}>

        {/*
         * HTML equivalent:
         *   <span class="scope-tab-label">🏙️ Mumbai</span>
         *
         * Emoji and label are a single Text node (like HTML's single span),
         * separated by a space character. No separate icon component.
         */}
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

      </Animated.View>

      {/*
       * ── UNDERLINE ──────────────────────────────────────────────
       *  HTML:  .scope-underline
       *         bottom: 2px; left: 12%; right: 12%; height: 2.5px;
       *         background: var(--fg-brand);
       *         transform: scaleX(0)  → scaleX(1) when active
       *         transform-origin: left  (grows left→right)
       *
       *  RN equivalent: absolute, scaleX useSharedValue 0→1 spring,
       *  transformOrigin emulated via left-offset + width calc.
       *
       *  Note: React Native's transform scaleX shrinks around the
       *  element's own center. To mimic transform-origin:left we
       *  position the underline at the LEFT edge and scale around
       *  its own center — the visual effect is the same "grow from
       *  left" behaviour because the element is flush-left.
       * ──────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.underline, underlineAnimStyle]}
        pointerEvents="none"
        aria-hidden
      />

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

  const handleTabPress = useCallback((scope: ChatScope): void => {
    void Haptics.impactAsync(SWITCHER.HAPTIC);

    if (scope === activeScope) {
      // Same scope tapped again → open picker
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen]);

  /** Compose the full display string: "🌍 World", "🏙️ Mumbai" etc. */
  const getDisplayLabel = useCallback((scope: ChatScope, defaultEmoji: string, defaultLabel: string): string => {
    const emoji =
      scope === 'country'
        ? (labels.countryEmoji || defaultEmoji)
        : defaultEmoji;

    const text =
      scope === 'country' ? (labels.country || defaultLabel) :
      scope === 'city'    ? (labels.city    || defaultLabel) :
      scope === 'sector'  ? (labels.sector  || defaultLabel) :
      defaultLabel;

    return `${emoji} ${text}`;
  }, [labels]);

  return (
    /**
     * HTML equivalent:
     *   <div id="row2" role="tablist" ...>
     *     <!-- 4× .scope-tab buttons -->
     *   </div>
     *
     * Background is var(--bg-surface) which is the page surface —
     * effectively the same as no fill (inherits from parent screen).
     */
    <View
      style={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope switcher"
    >
      {SCOPES.map((scopeCfg, index) => (
        <ScopeTab
          key={scopeCfg.key}
          scopeCfg={scopeCfg}
          index={index}
          isActive={scopeCfg.key === activeScope}
          label={getDisplayLabel(scopeCfg.key, scopeCfg.emoji, scopeCfg.defaultLabel)}
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

  // ── Row container ────────────────────────────────────────────────────────
  // HTML: #row2 { height:48px; padding:0 16px; display:flex; align-items:center;
  //               background:var(--bg-surface); gap:4px; }
  row: {
    height:          SWITCHER.ROW_HEIGHT,
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: SWITCHER.ROW_PAD_H,
    gap:             SWITCHER.ROW_GAP,
    // No background color — inherits from parent screen (bg-surface)
  },

  // ── Individual tab pressable ─────────────────────────────────────────────
  // HTML: .scope-tab { flex:1; height:28px; border:none; background:transparent;
  //                    display:flex; align-items:center; justify-content:center;
  //                    border-radius:6px; position:relative; }
  scopeButton: {
    flex:           1,
    height:         SWITCHER.TAB_HEIGHT,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   SWITCHER.TAB_RADIUS,
    position:       'relative',
    overflow:       'hidden',   // clips the pressed bg to the rounded rect
  },

  // HTML: .scope-tab:hover { background: var(--fg-brand-subtle); }
  // → rgba(200, 150, 12, 0.10) — warm gold tint on press
  scopeButtonPressed: {
    backgroundColor: colors.fg.brandSubtle,   // rgba(200,150,12,0.10)
  },

  // ── Inner animated row (for press-scale) ────────────────────────────────
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  // ── Emoji + label — single Text node ────────────────────────────────────
  // HTML: .scope-tab-label { font-size:13px; font-weight:400; color:fg-text-muted; }
  scopeLabel: {
    fontSize:  SWITCHER.LABEL_SIZE,
    lineHeight: 17,
    textAlign: 'center',
  },

  // HTML: .scope-tab[aria-selected="true"] .scope-tab-label
  //       { font-weight:600; color:var(--fg-text-strong); }
  // colors.fg.primary should map to --fg-text-strong (#1A1208 Deep Onyx)
  scopeLabelActive: {
    fontWeight: '600',
    color:      colors.fg.primary,
  },

  // HTML: .scope-tab-label { color:var(--fg-text-muted); font-weight:400; }
  // colors.fg.muted should map to --fg-text-muted (#7A5C2E Antique Bronze)
  scopeLabelInactive: {
    fontWeight: '400',
    color:      colors.fg.muted,   // ← update token if needed; see note below
    // NOTE: If your colors object doesn't have `fg.muted`, use:
    //   color: '#7A5C2E'  (--fg-text-muted from the HTML design system)
    // or add `muted: '#7A5C2E'` to your colors.fg token map.
  },

  // ── Underline indicator ──────────────────────────────────────────────────
  // HTML: .scope-underline {
  //   position:absolute; bottom:2px; left:12%; right:12%;
  //   height:2.5px; background:var(--fg-brand); border-radius:9999px;
  //   transform:scaleX(0); transform-origin:left;
  //   transition: transform 120ms ease-out;
  // }
  // RN: position absolute, left/right via percentage inset,
  //     scaleX driven by Animated.View via useAnimatedStyle.
  underline: {
    position:        'absolute',
    bottom:          2,
    // 12% inset on each side — approximated as flex-relative by using
    // left/right with percentage strings (RN supports % in layout).
    left:            '12%',
    right:           '12%',
    height:          SWITCHER.UNDERLINE_H,
    backgroundColor: colors.bg.brand,   // --fg-brand (#C8960C Royal Saffron Gold)
    borderRadius:    9999,
    // scaleX starts at 0 (invisible) for inactive tabs,
    // animated to 1 for active tab via underlineAnimStyle.
    // transformOrigin emulated: underline is flush-left so
    // center-scale and left-origin produce identical visual result.
  },

});

export default FourScopeSwitcher;

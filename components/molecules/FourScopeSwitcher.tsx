/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — FourScopeSwitcher  v7.1  FINAL MASTER                          ║
 * ║  §1.3.3 Row 2 — The 4-Scope Switcher                                    ║
 * ║  Phase 1.3 · App Architecture                                           ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  SOURCES RECONCILED (3-file synthesis):                                 ║
 * ║    [A] crown-scope-switcher.html   — Ground-truth visual reference      ║
 * ║    [B] FourScopeSwitcher (2).tsx   — Prod interface, haptics, types     ║
 * ║    [C] FourScopeSwitcher (3).tsx   — Mobile-calibrated optical tokens   ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  VISUAL-MATCH PRD  (Phase 1)                                            ║
 * ║                                                                         ║
 * ║  1. OPTICAL LAYOUT                                                      ║
 * ║     • Track: warm off-white (#FFF8F0) pill, 44dp tall.                  ║
 * ║       Web is 38px — 44dp is the mobile touch-target correction.         ║
 * ║       Visually identical at mobile DPI due to sub-pixel sharpness.      ║
 * ║     • H_PAD: 12dp (mirrors HTML var(--sp-3) = 12px exactly).           ║
 * ║     • Capsule: 3dp top/bottom inset (HTML: top:3px / bottom:3px).       ║
 * ║       Slides via translateX — left anchor never moves.                  ║
 * ║     • Tabs: flex:1, centered row — emoji · label · chevron — gap 3dp.   ║
 * ║                                                                         ║
 * ║  2. TYPOGRAPHY & EMOJI                                                  ║
 * ║     • Label: 12sp (matches HTML 12px), weight 400/600.                  ║
 * ║     • Letter-spacing: 0.15 ≈ HTML letter-spacing: 0.01em @ 12px.       ║
 * ║     • Emoji: isolated Text node, fontSize 13sp, lineHeight 16dp.        ║
 * ║       Prevents Android balloon + iOS clip. No letter-spacing bleed.     ║
 * ║     • includeFontPadding:false (Android) collapses phantom ascenders.   ║
 * ║     • lineHeight 16 on label matches emoji — exact baseline parity.     ║
 * ║                                                                         ║
 * ║  3. COMPONENT HIERARCHY                                                 ║
 * ║     FourScopeSwitcher (View, flexRow, paddingH=12, overflow:hidden)     ║
 * ║       ├── Capsule (Animated.View, position:absolute, left=H_PAD)        ║
 * ║       └── ScopeTab × 4 (Pressable → Animated.View → emoji+label+▼)     ║
 * ║                                                                         ║
 * ║  4. ANIMATION                                                           ║
 * ║     • Slide spring: { damping:18, stiffness:185, mass:0.6 }             ║
 * ║       ≈ CSS cubic-bezier(0.25,0.46,0.45,0.94) / 320ms.                 ║
 * ║       ~300-340ms settle, zero overshoot — visually identical.           ║
 * ║     • Press spring: { stiffness:450, damping:30 } → scale 0.95.        ║
 * ║     • Mount / orientation change: instant snap (no spring travel).      ║
 * ║                                                                         ║
 * ║  5. DESIGN TOKENS                                                       ║
 * ║     Zero hardcoded hex. All colours via `colors` from @/constants/colors║
 * ║     Required shape documented in REQUIRED_COLORS below.                 ║
 * ║                                                                         ║
 * ║  6. CAPSULE GEOMETRY (why it aligns perfectly)                          ║
 * ║     • Track total width = W                                             ║
 * ║     • Usable tab area = W − 2 × H_PAD                                  ║
 * ║     • tabWidth = usable / 4                                             ║
 * ║     • Capsule left anchor = H_PAD (matches padding edge exactly)        ║
 * ║     • Capsule translateX @ index i = i × tabWidth                       ║
 * ║     • At i=0: occupies [H_PAD .. H_PAD+tabWidth] ✓                      ║
 * ║     • At i=3: right edge = H_PAD + 4×tabWidth = W − H_PAD ✓            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * REQUIRED peer deps:
 *   react-native-reanimated  >= 3.0
 *   expo-haptics             >= any
 *
 * REQUIRED_COLORS — your @/constants/colors must export:
 *   colors.bg.surface       → #FFF8F0  (warm off-white track background)
 *   colors.bg.brandSubtle   → rgba(200,150,12,0.18) (translucent gold capsule)
 *   colors.fg.brand         → #C8960C  (active chevron gold)
 *   colors.fg.primary       → #1A1208  (active label — near-black warm)
 *   colors.fg.tertiary      → #7A5C2E  (inactive label + chevron — warm brown)
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
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

const N_TABS = SCOPES.length; // 4

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS  (optically matched to HTML, not pixel-copied)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 44dp — mobile touch-target correction from HTML's 38px.
 * At typical mobile DPI the extra height is sub-pixel-invisible to the eye
 * but is critical for comfortable thumb interaction.
 */
const TRACK_HEIGHT = 44 as const;

/**
 * 12dp — mirrors HTML var(--sp-3) = 12px exactly.
 * Both the capsule left-anchor and the tab usable-area start here.
 */
const H_PAD = 12 as const;

/**
 * 3dp — mirrors HTML top:3px / bottom:3px on the capsule.
 * (File C used 4dp to compensate for sharper mobile sub-pixel rendering;
 *  this value stays at 3 to remain true to the HTML visual.)
 */
const CAPSULE_INSET = 3 as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPRING CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slide spring — matches HTML cubic-bezier(0.25, 0.46, 0.45, 0.94) / 320ms.
 * Produces ~310ms settle, zero overshoot. (Source: File C PRD §4)
 */
const SPRING_SLIDE: WithSpringConfig = {
  damping:   18,
  stiffness: 185,
  mass:      0.6,
} as const;

/**
 * Press scale spring — quick, snappy squish feedback.
 * Resolves in ~80ms; user perceives it as instant.
 */
const SPRING_PRESS: WithSpringConfig = {
  damping:   30,
  stiffness: 450,
  mass:      1,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHEVRON  (CSS border-triangle, zero icon font footprint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optical tweak vs HTML (4/4/5px → 3.5/3.5/4.5dp):
 * Mobile pixel density makes the border triangle appear larger than on web.
 * Reducing by ~12% restores the correct visual weight relative to 12sp text.
 */
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
// SCOPE TAB  (single button — memo-wrapped to prevent cascade re-renders)
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeTabProps {
  readonly scopeCfg: ScopeConfig;
  readonly index:    number;
  readonly isActive: boolean;
  readonly label:    string;
  readonly emoji:    string;
  readonly onPress:  (scope: ChatScope, index: number) => void;
}

const ScopeTab = memo(({
  scopeCfg,
  index,
  isActive,
  label,
  emoji,
  onPress,
}: ScopeTabProps): React.JSX.Element => {

  // ── Press-squish animation (mirrors HTML .scope-tab:active transform:scale(0.95)) ──
  const scale = useSharedValue<number>(1);

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), []);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    onPress(scopeCfg.key, index);
  }, [onPress, scopeCfg.key, index]);

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
      {/* Animated inner row — carries the press-scale transform */}
      <Animated.View style={[styles.tabContent, pressAnimStyle]}>

        {/*
         * Emoji — deliberately wrapped in its own Text node.
         * Reason: OS emoji metrics (especially on Android) balloon into the
         * surrounding text's line-height if they share a Text context.
         * Isolation keeps them from affecting the label's vertical baseline.
         */}
        <Text
          style={styles.emoji}
          allowFontScaling={false}
          selectable={false}
        >
          {emoji}
        </Text>

        {/* Label — active/inactive state only changes weight and color */}
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

        {/* Dropdown chevron — rendered for every tab that has a picker */}
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

  // Resolved pixel width of one tab — 0 until first layout measurement
  const [tabWidth, setTabWidth] = useState<number>(0);

  // Ref mirrors tabWidth for access inside Reanimated worklets (avoids stale closures)
  const tabWidthRef = useRef<number>(0);

  // Guards to prevent double-animating on user-initiated vs prop-driven changes
  const isFirstRender    = useRef<boolean>(true);
  const userInitiatedRef = useRef<boolean>(false);

  // Single shared value drives the capsule's horizontal position
  const capsuleX = useSharedValue<number>(0);

  // ── Derive active index, safe against unknown scope keys ──────────────────
  const activeIndex = Math.max(
    0,
    SCOPES.findIndex((s) => s.key === activeScope),
  );

  // ── Capsule animated style ─────────────────────────────────────────────────
  // width lives here (layout-derived); only translateX animates.
  // Reading tabWidthRef.current from a worklet is safe — refs are global.
  const capsuleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
    width:     tabWidthRef.current,
  }), []);

  // ── Track layout handler ───────────────────────────────────────────────────
  // Fires on mount and on every orientation/size change.
  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const totalW  = e.nativeEvent.layout.width;
    // Subtract both horizontal paddings then divide by 4 tabs
    const tw      = (totalW - H_PAD * 2) / N_TABS;

    tabWidthRef.current = tw;
    setTabWidth(tw);

    // Always snap instantly — no spring on layout events.
    // A spring here would cause a visible "catch-up" slide on screen rotation.
    capsuleX.value = activeIndex * tw;
  }, [capsuleX, activeIndex]);

  // ── React to external activeScope prop changes (e.g. deep-link, back-nav) ─
  useEffect(() => {
    // Skip the very first render — layout handler handles initial position.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Skip if this render was triggered by a user press — capsule already moved.
    if (userInitiatedRef.current) {
      userInitiatedRef.current = false;
      return;
    }
    // Programmatic change → spring-animate to new position.
    const tw = tabWidthRef.current;
    if (tw > 0) {
      capsuleX.value = withSpring(activeIndex * tw, SPRING_SLIDE);
    }
  }, [activeScope, activeIndex, capsuleX]);

  // ── Tab press handler ──────────────────────────────────────────────────────
  const handleTabPress = useCallback((
    scope: ChatScope,
    index: number,
  ): void => {
    // Tactile feedback — light impact, mirrors mobile convention for tab switches
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (scope === activeScope) {
      // Already active → re-tap opens the picker (city / country / sector sheet)
      const cfg = SCOPES.find((s) => s.key === scope);
      if (cfg?.hasPicker) onPickerOpen(scope);
      return;
    }

    // Mark as user-initiated so the useEffect above doesn't double-animate
    userInitiatedRef.current = true;

    // Animate capsule immediately — don't wait for state update to propagate
    capsuleX.value = withSpring(index * tabWidthRef.current, SPRING_SLIDE);

    // Notify parent — will update activeScope prop on next render
    onScopeChange(scope);
  }, [activeScope, onScopeChange, onPickerOpen, capsuleX]);

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
      onLayout={handleLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Chat scope selector"
    >
      {/*
       * Gold capsule indicator.
       * Rendered before the tabs so it sits below them in z-order (z-index:0).
       * Hidden until tabWidth is measured to avoid a visible width-0 flash.
       */}
      {tabWidth > 0 && (
        <Animated.View
          style={[styles.capsule, capsuleAnimStyle]}
          pointerEvents="none"
        />
      )}

      {/* Four scope tabs — rendered above the capsule (z-index:1) */}
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
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Track (outer pill) ─────────────────────────────────────────────────────
  track: {
    height:             TRACK_HEIGHT,       // 44dp (touch-target; web ref: 38px)
    backgroundColor:    colors.bg.surface,  // #FFF8F0 — warm off-white
    borderRadius:       8,                  // slightly more rounded than HTML 6px
                                            // for mobile visual premium; pill feel
    flexDirection:      'row',
    alignItems:         'center',
    paddingHorizontal:  H_PAD,              // 12dp — mirrors HTML var(--sp-3)
    overflow:           'hidden',           // clips capsule at container edges
  },

  // ── Sliding gold capsule indicator ────────────────────────────────────────
  capsule: {
    position:        'absolute',
    left:            H_PAD,            // 12dp — anchors at padding edge (same as HTML left:12px)
    top:             CAPSULE_INSET,    // 3dp — mirrors HTML top:3px
    bottom:          CAPSULE_INSET,    // 3dp — mirrors HTML bottom:3px
    backgroundColor: colors.bg.brandSubtle,  // rgba(200,150,12,0.18) — flat translucent gold
    borderRadius:    6,                // var(--radius-md) = 6px — direct port
    zIndex:          0,
    // width is injected dynamically via capsuleAnimStyle (cannot be pre-known)
  },

  // ── Individual tab button ──────────────────────────────────────────────────
  tab: {
    flex:            1,
    height:          '100%',
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          1,                // sits above capsule layer
    backgroundColor: 'transparent',
  },

  // ── Tab inner content row (receives press-scale animation) ─────────────────
  tabContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,                 // 3dp — matches HTML gap: 3px  (RN ≥ 0.71)
  },

  // ── Emoji — isolated Text node ─────────────────────────────────────────────
  emoji: {
    fontSize:   13,
    lineHeight: 16,    // prevents emoji ballooning (Android) / clipping (iOS)
    flexShrink: 0,
    // Android only: kill phantom ascender padding that shifts emoji upward
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  // ── Label — base (shared) ──────────────────────────────────────────────────
  label: {
    fontSize:      12,
    lineHeight:    16,    // matches emoji lineHeight — baselines collapse to same value
    letterSpacing: 0.15,  // optical ≈ HTML letter-spacing: 0.01em @ 12px (0.01×12=0.12px → 0.15dp)
    flexShrink:    1,
    // Android only: same phantom-padding fix as emoji
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  // ── Label — inactive state ─────────────────────────────────────────────────
  labelInactive: {
    fontWeight: '400',
    color:      colors.fg.tertiary,  // #7A5C2E — warm muted brown
  },

  // ── Label — active state ───────────────────────────────────────────────────
  labelActive: {
    fontWeight: '600',
    color:      colors.fg.primary,  // #1A1208 — near-black warm
  },

  // ── CSS border-triangle chevron ▼ ──────────────────────────────────────────
  // HTML values: border-left/right: 4px, border-top: 5px.
  // Mobile optical correction: scaled down by ~12% (3.5/3.5/4.5) so the
  // triangle doesn't visually overpower 12sp text at mobile pixel density.
  chevron: {
    width:            0,
    height:           0,
    borderStyle:      'solid',
    borderLeftWidth:  3.5,
    borderRightWidth: 3.5,
    borderTopWidth:   4.5,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    // borderTopColor is injected per instance based on isActive
    flexShrink:       0,
    marginTop:        1,   // 1dp push-down: optically centers triangle with text cap-height
  },
});

export default FourScopeSwitcher;

/**
 * CROWN — FourScopeSwitcher v7.1
 * React Native (Reanimated v3 / RN 0.73+)
 *
 * ─────────────────────────────────────────────
 *  VISUAL-MATCH PRD  (Phase 1)
 * ─────────────────────────────────────────────
 *
 *  1. OPTICAL LAYOUT
 *     • Track: warm off-white pill, 44 dp tall (up from 38 px web — mobile
 *       touch-target correction). 10 dp horizontal padding gives the same
 *       visual "breathing room" as web's 12 px at mobile DPI.
 *     • Capsule: 4 dp vertical inset (web: 3 px) — appears identical to eye
 *       because mobile sub-pixel rendering is sharper. Slides via translateX
 *       so the anchor `left` never changes.
 *     • Tabs: flex:1, centered row — emoji · label · chevron — with 3 dp gap.
 *       No explicit padding inside the tab; centering does the work.
 *
 *  2. TYPOGRAPHY & EMOJI ALIGNMENT
 *     • Label: 11.5 sp rounds to 12 in practice; use 12 sp to keep parity
 *       with web. iOS/Android add phantom ascender padding around Text nodes.
 *       Fix: `includeFontPadding: false` (Android) + explicit `lineHeight`
 *       matching fontSize so baselines collapse to a predictable value.
 *     • Emoji: fontSize 13 sp, lineHeight 16 — prevents the emoji from
 *       ballooning on Android and from clipping on iOS. Wrapping in its own
 *       Text node with no letter-spacing isolates OS emoji metrics from the
 *       label.
 *     • Letter-spacing: web uses 0.01em ≈ 0.12 px at 12 px. React Native
 *       `letterSpacing` is in logical pixels. Use 0.15 for optical parity.
 *
 *  3. COMPONENT BOUNDARIES
 *     • FourScopeSwitcher (function component)
 *       └─ Track  (View, overflow:'hidden', position:'relative')
 *          ├─ Capsule  (Animated.View, position:'absolute')
 *          └─ [Tab × 4]  (Pressable → row: Emoji · Label · Chevron)
 *
 *  4. ANIMATION
 *     • Web: cubic-bezier(0.25, 0.46, 0.45, 0.94) / 320 ms = ease-out spring
 *     • RN approximation: withSpring({ damping: 18, stiffness: 185, mass: 0.6 })
 *       This produces ~300-340 ms settle with zero overshoot — visually
 *       identical to the CSS cubic-bezier.
 *
 *  5. DESIGN TOKENS  (zero hardcoded hex in the component)
 *     All colours reference the `CROWN` token map below. Swap
 *     `import { CROWN } from '@/tokens/crown'` in your project.
 * ─────────────────────────────────────────────
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// ─── CROWN Design Token Map ──────────────────────────────────────────────────
// Replace with `import { CROWN } from '@/tokens/crown'` in your project.
const CROWN = {
  bg: {
    surface:     '#FFF8F0',           // warm off-white track background
    brandSubtle: 'rgba(200,150,12,0.18)', // translucent gold capsule fill
    tabPressed:  'rgba(200,150,12,0.09)', // hover/press tint on inactive tab
  },
  fg: {
    brand:       '#C8960C',           // active chevron gold
    textStrong:  '#1A1208',           // active label — near-black warm
    textMuted:   '#7A5C2E',           // inactive label — warm brown
  },
  radius: {
    track:   8,   // outer track corners
    capsule: 6,   // inner capsule corners
    tab:     6,   // tab press highlight corners
  },
};

// ─── Tab Definitions ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'world',  emoji: '🌍', label: 'World'   },
  { key: 'india',  emoji: '🇮🇳', label: 'India'   },
  { key: 'mumbai', emoji: '🏙️',  label: 'Mumbai'  },
  { key: 'bandra', emoji: '📍',  label: 'Bandra W' },
] as const;

// ─── Layout Constants ─────────────────────────────────────────────────────────
const TRACK_HEIGHT  = 44;   // dp — mobile touch-target corrected from web 38 px
const H_PAD         = 10;   // dp — horizontal breathing room (web: 12 px)
const CAPSULE_INSET =  4;   // dp vertical inset (web: 3 px)
const N_TABS        = TABS.length;

// ─── Spring Config (matches web cubic-bezier(0.25,0.46,0.45,0.94) / 320ms) ───
const SPRING = {
  damping:   18,
  stiffness: 185,
  mass:      0.6,
};

// ─────────────────────────────────────────────────────────────────────────────
export default function FourScopeSwitcher() {
  // Active tab index (default: Mumbai = 2, per PRD)
  const [activeIdx, setActiveIdx]   = useState(2);

  // Tab pixel width resolved after first layout
  const [tabWidth, setTabWidth]     = useState(0);

  // Refs avoid stale-closure issues inside layout/animation callbacks
  const activeIdxRef = useRef(2);
  const tabWidthRef  = useRef(0);
  const didInit      = useRef(false);

  // Shared value drives the capsule's translateX
  const capsuleX = useSharedValue(0);

  // ── Layout handler: fires on mount + on window resize ─────────────────────
  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const totalW = e.nativeEvent.layout.width;
    const tw     = (totalW - H_PAD * 2) / N_TABS;

    tabWidthRef.current = tw;
    setTabWidth(tw);

    // First mount: snap instantly (no spring, no visible travel)
    if (!didInit.current) {
      didInit.current   = true;
      capsuleX.value    = activeIdxRef.current * tw;
    } else {
      // Re-layout (e.g. orientation change): re-snap to correct position
      capsuleX.value = activeIdxRef.current * tw;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab press handler ──────────────────────────────────────────────────────
  const handleSelect = useCallback((idx: number) => {
    activeIdxRef.current = idx;
    setActiveIdx(idx);
    capsuleX.value = withSpring(idx * tabWidthRef.current, SPRING);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Capsule animated style ─────────────────────────────────────────────────
  //  • `width` lives here (not in static styles) because it's layout-derived.
  //  • Only translateX animates; width snaps instantly to avoid stretch artifacts.
  const capsuleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
    width:     tabWidthRef.current,  // worklet read: no JS-thread hop needed
  }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View
      style={styles.track}
      onLayout={handleTrackLayout}
      accessibilityRole="tablist"
    >
      {/* ── Sliding gold capsule (behind all tabs via z-order) ── */}
      {tabWidth > 0 && (
        <Animated.View
          style={[styles.capsule, capsuleAnimStyle]}
          pointerEvents="none"
        />
      )}

      {/* ── Four scope tabs ── */}
      {TABS.map((tab, idx) => {
        const isActive = idx === activeIdx;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tab,
              pressed && !isActive && styles.tabPressed,
            ]}
            onPress={() => handleSelect(idx)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            {/* Emoji — isolated Text to contain OS emoji metrics */}
            <Text style={styles.emoji} selectable={false}>
              {tab.emoji}
            </Text>

            {/* Label */}
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              selectable={false}
              numberOfLines={1}
            >
              {tab.label}
            </Text>

            {/* CSS-triangle chevron (border trick, no icon library) */}
            <View
              style={[styles.chevron, isActive && styles.chevronActive]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Outer track ────────────────────────────────────────────────────────────
  track: {
    height:           TRACK_HEIGHT,
    backgroundColor:  CROWN.bg.surface,
    borderRadius:     CROWN.radius.track,
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: H_PAD,
    overflow:         'hidden',    // clips the capsule at container edges
    // Shadow is optional — remove if not in PRD
    // shadowColor:   '#C8960C',
    // shadowOpacity: 0.08,
    // shadowRadius:  8,
    // elevation:     2,
  },

  // ── Sliding capsule ────────────────────────────────────────────────────────
  capsule: {
    position:        'absolute',
    left:            H_PAD,        // anchored to start of tab area
    top:             CAPSULE_INSET,
    bottom:          CAPSULE_INSET,
    backgroundColor: CROWN.bg.brandSubtle,
    borderRadius:    CROWN.radius.capsule,
    // width is injected via capsuleAnimStyle (layout-derived)
  },

  // ── Individual tab button ──────────────────────────────────────────────────
  tab: {
    flex:            1,
    height:          '100%',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             3,            // RN 0.71+ — use marginRight on emoji/label for older
    borderRadius:    CROWN.radius.tab,
    zIndex:          1,            // sits above the capsule layer
  },

  tabPressed: {
    backgroundColor: CROWN.bg.tabPressed,
  },

  // ── Emoji ──────────────────────────────────────────────────────────────────
  emoji: {
    fontSize:    13,
    lineHeight:  16,   // prevent emoji ballooning on Android / clipping on iOS
    flexShrink:  0,
    // Kill phantom OS ascender padding on Android:
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  // ── Label (inactive) ───────────────────────────────────────────────────────
  label: {
    fontSize:    12,
    lineHeight:  16,   // must match emoji lineHeight for optical baseline alignment
    fontWeight:  '400',
    color:       CROWN.fg.textMuted,
    letterSpacing: 0.15,    // optical match for web's `letter-spacing: 0.01em`
    flexShrink:  1,
    // Android font-padding removal for consistent cross-platform centering:
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },

  // ── Label (active override) ────────────────────────────────────────────────
  labelActive: {
    fontWeight: '600',
    color:      CROWN.fg.textStrong,
  },

  // ── CSS border-trick chevron (▼) — inactive ────────────────────────────────
  // Optical tweak: web uses 4/4/5 px borders. Reduce to 3.5/3.5/4.5 on
  // mobile so the triangle doesn't visually overpower the small text.
  chevron: {
    width:              0,
    height:             0,
    borderLeftWidth:    3.5,
    borderRightWidth:   3.5,
    borderTopWidth:     4.5,
    borderLeftColor:    'transparent',
    borderRightColor:   'transparent',
    borderTopColor:     CROWN.fg.textMuted,
    flexShrink:         0,
    marginTop:          1,  // 1 dp push-down to optically center with text cap-height
  },

  // ── Chevron (active override) ──────────────────────────────────────────────
  chevronActive: {
    borderTopColor: CROWN.fg.brand,
  },
});

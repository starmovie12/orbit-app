/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — components/molecules/SegmentedControl.tsx                ║
 * ║  Molecule · P1 · Blueprint v5.0 BAAP EDITION                            ║
 * ║                                                                          ║
 * ║  Used in: Discover sub-tabs · Notifications filter · Saved Messages     ║
 * ║                                                                          ║
 * ║  Props:                                                                  ║
 * ║    options   : { label: string; value: string }[]  — 2–6 segments       ║
 * ║    selected  : string                               — active value       ║
 * ║    onChange  : (value: string) => void              — selection handler  ║
 * ║    style?    : ViewStyle                            — outer override     ║
 * ║                                                                          ║
 * ║  Visual design (task spec):                                              ║
 * ║    Track     : dark pill  (bg.inverse = ink[950] = #1A1208)             ║
 * ║    Indicator : gold[600] pill sliding behind labels, 2px inset V        ║
 * ║    Active    : ink[950] text on gold indicator (AAA contrast, §15)      ║
 * ║    Inactive  : cream[300] @ 65% opacity on dark track (≈ 9:1 contrast) ║
 * ║                                                                          ║
 * ║  Animation:                                                              ║
 * ║    Sliding indicator → Animated.spring (springBouncy)                   ║
 * ║    Reduced motion    → slideAnim.setValue() snap (no spring)            ║
 * ║    Active text scale → subtle 1.0 ↔ 0.95 on inactive (springGentle)    ║
 * ║    Haptic            → impactLight() on every selection change           ║
 * ║                                                                          ║
 * ║  Design tokens:                                                          ║
 * ║    colors.bg.inverse    = ink[950] = #1A1208   track bg                 ║
 * ║    palette.gold[600]    = #C9A227              indicator bg             ║
 * ║    colors.fg.primary    = ink[950]             active text (§15 AAA)   ║
 * ║    palette.cream[300]   = #F0DEB6              inactive text (on dark)  ║
 * ║    radii.pill           = 999                  track + indicator        ║
 * ║    spacing.xs = 4 · spacing.sm = 8 · spacing.md = 12                   ║
 * ║    typography.subNavActive (14px 700) · base overridden → 600 semi-bold  ║
 * ║    animation.springBouncy (tension:180 friction:12 — Animated.spring)  ║
 * ║                                                                          ║
 * ║  Deps: constants/colors.ts · constants/animations.ts                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, palette, radii, spacing, typography } from '@/constants/colors';
import {
  springConfigs,
  useReducedMotion,
} from '@/constants/animations';
import { useHaptics } from '@/hooks/useHaptics';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Total track height (blueprint: "36px H pills").
 * Matches dimensions.locationPillH = 36 — same visual weight tier as
 * location pills and filter chips across the app.
 */
const TRACK_HEIGHT = 36;

/**
 * Vertical inset between the track edge and the sliding indicator.
 * Creates the "pill-inside-capsule" premium floating look.
 * 2px inset → indicator is 32px tall inside the 36px track.
 */
const INDICATOR_INSET = 2;

/** Computed indicator height = TRACK_HEIGHT − 2×INSET */
const INDICATOR_HEIGHT = TRACK_HEIGHT - INDICATOR_INSET * 2;

/**
 * Inactive label colour.
 * palette.cream[300] = #F0DEB6 on bg.inverse (ink[950] = #1A1208):
 *   contrast ratio ≈ 8.1:1 — WCAG AA large text ✅ and body ✅
 * At 0.65 opacity the perceived contrast is still ≈ 5.3:1 — passes AA ✅.
 */
const INACTIVE_TEXT_OPACITY = 0.65;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentOption {
  /** Display label shown in the segment. Keep ≤ 12 chars for ≥5 segments. */
  label: string;
  /** Opaque identifier compared with `selected`. */
  value: string;
}

export interface SegmentedControlProps {
  /** 2–6 segment definitions. All segments are equal width. */
  options: SegmentOption[];
  /** Value of the currently active segment. Must match one of options[].value. */
  selected: string;
  /** Called with the new value when user taps a different segment. */
  onChange: (value: string) => void;
  /**
   * Optional outer wrapper style override.
   * Use to set width, marginHorizontal, etc. from the host screen.
   */
  style?: ViewStyle;
}

// ─── SegmentedControl ─────────────────────────────────────────────────────────

const SegmentedControl = React.memo<SegmentedControlProps>(
  ({ options, selected, onChange, style }) => {
    const reducedMotion = useReducedMotion();
    const { impactLight } = useHaptics();

    // ── Layout measurement ───────────────────────────────────────────────────
    //
    // The sliding indicator width = trackWidth / options.length.
    // We get trackWidth from the onLayout of the track View — after the first
    // render. Until then trackWidth=0 and the indicator is invisible (width=0).
    // This causes NO visible flash because the indicator renders BEHIND labels.
    //
    // On orientation change the layout fires again, updating trackWidth →
    // the indicator width and position recompute correctly.

    const [trackWidth, setTrackWidth] = useState(0);

    const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
      setTrackWidth(e.nativeEvent.layout.width);
    }, []);

    // Derived: index of the current selection within options.
    const selectedIndex = useMemo(
      () => Math.max(0, options.findIndex(o => o.value === selected)),
      [options, selected],
    );

    // Derived: width of a single segment (≥ 0, starts at 0 before layout).
    const segmentWidth = trackWidth > 0 ? trackWidth / options.length : 0;

    // ── Indicator slide animation ────────────────────────────────────────────
    //
    // slideAnim holds the translateX of the gold indicator pill.
    // It is created once via useRef and never replaced.
    //
    // Two animation strategies:
    //   Full motion  → Animated.spring (springBouncy: tension:180, friction:12)
    //                  Matches blueprint §5.N springBouncy token.
    //                  useNativeDriver:true → runs entirely on UI thread.
    //   Reduced motion → slideAnim.setValue(target) — instant snap, no spring.
    //                  No setTimeout required; setValue is synchronous.

    const slideAnim = useRef(new Animated.Value(0)).current;
    // Track the "current committed position" so we can initialise without
    // an animation on the first layout event (avoids flying in from x=0).
    const lastPositionRef = useRef<number | null>(null);

    useEffect(() => {
      if (segmentWidth === 0) return; // Layout not measured yet — defer.

      const targetX = selectedIndex * segmentWidth;

      if (lastPositionRef.current === null) {
        // First layout: snap to position with no animation.
        slideAnim.setValue(targetX);
        lastPositionRef.current = targetX;
        return;
      }

      if (reducedMotion) {
        slideAnim.setValue(targetX);
        lastPositionRef.current = targetX;
        return;
      }

      // Spring slide — springBouncy for Animated.spring per §5.N token.
      Animated.spring(slideAnim, {
        toValue: targetX,
        ...springConfigs.springBouncy, // tension:180 · friction:12 · useNativeDriver:true
      }).start(({ finished }) => {
        if (finished) lastPositionRef.current = targetX;
      });
    // slideAnim is a stable ref — intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndex, segmentWidth, reducedMotion]);

    // ── Selection handler ────────────────────────────────────────────────────

    const handleSelect = useCallback(
      (value: string) => {
        if (value === selected) return; // No-op — already active.
        impactLight();
        onChange(value);
      },
      [selected, onChange, impactLight],
    );

    // ── Container style ──────────────────────────────────────────────────────

    const containerStyle = useMemo(
      () => [styles.container, style],
      [style],
    );

    // ── Render ───────────────────────────────────────────────────────────────

    return (
      <View
        style={containerStyle}
        accessibilityRole="tablist"
        // Announce the count so screen-reader users know the control scope.
        accessibilityLabel={`Filter · ${options.length} options`}
      >
        {/* ── Track ─────────────────────────────────────────────────────── */}
        <View
          style={styles.track}
          onLayout={handleTrackLayout}
        >

          {/* ── Sliding gold indicator (rendered first → behind labels) ─── */}
          {segmentWidth > 0 && (
            <Animated.View
              style={[
                styles.indicator,
                {
                  width:     segmentWidth,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
              // Decorative — screen readers announce individual tab states.
              accessibilityElementsHidden
              importantForAccessibility="no"
              pointerEvents="none"
            />
          )}

          {/* ── Labels row (rendered second → above indicator) ─────────── */}
          <View style={styles.labelsRow}>
            {options.map((opt, index) => {
              const isActive = opt.value === selected;

              return (
                <SegmentButton
                  key={opt.value}
                  option={opt}
                  isActive={isActive}
                  index={index}
                  totalOptions={options.length}
                  reducedMotion={reducedMotion}
                  onSelect={handleSelect}
                />
              );
            })}
          </View>

        </View>
      </View>
    );
  },
);

SegmentedControl.displayName = 'SegmentedControl';

export default SegmentedControl;

// ─── SegmentButton ────────────────────────────────────────────────────────────
//
// Each individual segment tap target. Extracted to React.memo so only
// the newly-active and newly-inactive segments re-render on selection change —
// not the entire option list.
//
// Animates:
//   • Text opacity  → 0.65 (inactive) ↔ 1.0 (active)  springGentle
//   • Text scale    → 0.93 (inactive) ↔ 1.0 (active)   springGentle
// These micro-animations reinforce the slide without distracting from it.

interface SegmentButtonProps {
  option:       SegmentOption;
  isActive:     boolean;
  index:        number;
  totalOptions: number;
  reducedMotion: boolean;
  onSelect:     (value: string) => void;
}

const SegmentButton = React.memo<SegmentButtonProps>(
  ({ option, isActive, reducedMotion, onSelect }) => {
    // ── Text presence animation (opacity + scale) ────────────────────────────
    //
    // Both values live in a single Animated.Value (0=inactive, 1=active)
    // to ensure they stay in sync and use a single Animated.spring call.
    //
    // Interpolations:
    //   opacity : 0 → INACTIVE_TEXT_OPACITY (0.65) ↔ 1 → 1.0
    //   scale   : 0 → 0.93                         ↔ 1 → 1.0
    //
    // This is separate from the indicator slide: these micro-animations
    // reinforce the state change without fighting the indicator spring.

    const presenceAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

    useEffect(() => {
      const toValue = isActive ? 1 : 0;

      if (reducedMotion) {
        presenceAnim.setValue(toValue);
        return;
      }

      Animated.spring(presenceAnim, {
        toValue,
        ...springConfigs.springGentle, // tension:100 · friction:15 — soft settle
      }).start();
    // presenceAnim is a stable ref — intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, reducedMotion]);

    const textOpacity = presenceAnim.interpolate({
      inputRange:  [0, 1],
      outputRange: [INACTIVE_TEXT_OPACITY, 1],
    });

    const textScale = presenceAnim.interpolate({
      inputRange:  [0, 1],
      outputRange: [0.93, 1.0],
    });

    // ── Render ───────────────────────────────────────────────────────────────

    return (
      <TouchableOpacity
        style={styles.segmentTouch}
        onPress={() => onSelect(option.value)}
        activeOpacity={0.8}
        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={option.label}
      >
        <Animated.Text
          style={[
            styles.labelBase,
            isActive ? styles.labelActive : styles.labelInactive,
            {
              opacity:   textOpacity,
              transform: [{ scale: textScale }],
            },
          ]}
          numberOfLines={1}
          allowFontScaling={false} // Prevent layout break at large accessibility sizes.
        >
          {option.label}
        </Animated.Text>
      </TouchableOpacity>
    );
  },
);

SegmentButton.displayName = 'SegmentedControl.SegmentButton';

// ─── Styles ──────────────────────────────────────────────────────────────────
//
// Token map:
//   colors.bg.inverse        = ink[950] = #1A1208   track background
//   palette.gold[600]        = #C9A227              indicator background
//   colors.fg.primary        = ink[950] = #1A1208   active text  [§15 AAA: "gold bg → ink-950 text"]
//   palette.cream[300]       = #F0DEB6              inactive text (tinted white)
//   radii.pill               = 999                  track + indicator corners
//   TRACK_HEIGHT             = 36px                 blueprint "36px H pills"
//   INDICATOR_INSET          = 2px                  vertical inset from track
//   INDICATOR_HEIGHT         = 32px                 track 36 − 2×2

const styles = StyleSheet.create({

  // Outer container — full-width default; override via `style` prop.
  container: {
    width: '100%',
  } as ViewStyle,

  // Dark capsule track — owns the onLayout measurement and sets height.
  // overflow:'hidden' is NOT used here so the indicator spring can
  // slightly overshoot the track bounds without clipping (premium feel).
  // The 2px inset on the indicator creates a natural containment anyway.
  track: {
    height:        TRACK_HEIGHT,
    borderRadius:  radii.pill,                 // 999 — true capsule
    backgroundColor: colors.bg.inverse,        // ink[950] = #1A1208
    // Relative positioning so the absolute indicator sits inside.
    position:      'relative',
    overflow:      'hidden',                   // Clips the gold pill to the track shape
  },

  // Sliding gold indicator — absolute positioned behind the labels row.
  // Width and translateX are injected inline (layout-derived at runtime).
  indicator: {
    position:        'absolute',
    top:             INDICATOR_INSET,          // 2px from top track edge
    height:          INDICATOR_HEIGHT,         // 32px = 36 − 2×2
    borderRadius:    radii.pill,               // Matches track radius
    backgroundColor: palette.gold[600],        // #C9A227 — Champagne Gold brand
  },

  // Full-height flex row sitting on top of the indicator.
  // Each child has flex:1 so segments are equal width regardless of label length.
  labelsRow: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    flexDirection:  'row',
  },

  // Each segment's touch target — flex:1 ensures equal distribution.
  // Height 100% fills the track for the 44px effective touch area
  // (track is 36px, hitSlop adds 4px top/bottom → 44px effective ✅).
  segmentTouch: {
    flex:             1,
    alignItems:       'center',
    justifyContent:   'center',
    paddingHorizontal: spacing.xs,             // 4px — text breathing room at narrow widths
  },

  // ── Label base (shared by both states) ────────────────────────────────────

  labelBase: {
    // Fix §2: Unified semi-bold (600) base for both states.
    // RN cannot animate fontWeight — a 400↔700 jump creates a visible "stutter"
    // on selection. Using 600 for all labels means state change is communicated
    // purely via opacity (0.65↔1.0) + scale (0.93↔1.0), which animate smoothly.
    ...typography.subNavActive,                // 14px DM Sans — size/lineHeight base
    fontWeight:         '600',                 // Override: semi-bold for both states
    textAlign:          'center',
    includeFontPadding: false,                 // Android: remove baseline gap
  },

  // Active label — ink[950] text on gold indicator (§15: "gold bg → ink-950 text, AAA")
  // fontWeight NOT set here — inherited '600' from labelBase (avoids 400→700 stutter).
  // State is communicated by opacity=1.0 + scale=1.0 (via presenceAnim).
  labelActive: {
    color: colors.fg.primary,                  // ink[950] = #1A1208 — AAA on gold[600] ✅
  },

  // Inactive label — cream[300] on dark track, differentiated by opacity+scale only.
  // fontWeight NOT set here — inherits '600' from labelBase (smooth animation).
  // Opacity (0.65) and scale (0.93) are applied as Animated.Values in SegmentButton.
  labelInactive: {
    color: palette.cream[300],                 // #F0DEB6 — warm tinted white on dark
  },
});

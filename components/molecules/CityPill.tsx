/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — components/molecules/CityPill.tsx                        ║
 * ║  Molecule · P0 · Blueprint v5.0                                         ║
 * ║                                                                          ║
 * ║  Purpose:                                                                ║
 * ║    Home Screen header — left pill (LAW 15 two-row header architecture). ║
 * ║    Displays the active city name + dropdown chevron. Tapping opens the  ║
 * ║    city/sector bottom sheet (parent's responsibility — this component   ║
 * ║    is a pure presentational trigger with haptic + animation).            ║
 * ║                                                                          ║
 * ║  Props:                                                                  ║
 * ║    city    : string — display name of the active city ("Chandigarh")    ║
 * ║    onPress : () => void — opens city-picker bottom sheet in parent      ║
 * ║                                                                          ║
 * ║  Glass surface strategy (mirrors _layout.tsx Glass Island):             ║
 * ║    iOS     → BlurView tint="light" intensity=18 (UIBlurEffect native)   ║
 * ║              Gives real frosted glass on the warm ivory header.          ║
 * ║    Android → View rgba(255,255,255,0.10) solid (BlurView is             ║
 * ║              experimental on Android — rgba is production-safe).         ║
 * ║    Both    → same border, radius, and inner PillContent layout.         ║
 * ║                                                                          ║
 * ║  Press animation:                                                        ║
 * ║    Down : scale 1.0 → 0.94 · Duration.micro (80ms) · easeOut           ║
 * ║    Up   : Animated.spring · springStiff (tension:200 · friction:18)     ║
 * ║    Reduced motion: opacity 1.0 → 0.70 fallback (no scale)              ║
 * ║                                                                          ║
 * ║  Haptic: impactLight() on pressIn (Q13: "Tap city / sector pill")      ║
 * ║                                                                          ║
 * ║  Design tokens:                                                          ║
 * ║    dimensions.locationPillH = 36 · radii.xl = 18                        ║
 * ║    colors.border.subtle (ink[100]) · colors.fg.primary / secondary      ║
 * ║    typography.pillLabel (13px · 600 · lh18)                             ║
 * ║    spacing.sm (8 — gap icon↔text) · spacing.md (12 — horizontal pad)  ║
 * ║                                                                          ║
 * ║  Deps: constants/colors.ts · constants/animations.ts · hooks/useHaptics ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';

import {
  colors,
  typography,
  spacing,
  radii,
  dimensions,
  palette,
} from '@/constants/colors';
import {
  Duration,
  easeOut,
  springConfigs,
  useReducedMotion,
} from '@/constants/animations';
import { useHaptics } from '@/hooks/useHaptics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CityPillProps {
  /** Display name of the currently active city, e.g. "Chandigarh" */
  city: string;
  /** Called when the pill is pressed — parent opens city-picker sheet */
  onPress: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * iOS BlurView configuration.
 * "light" tint — correct for pills that sit on the warm ivory (white) header.
 * The dark Glass Island uses tint="dark" intensity=85; this pill is much
 * more subtle — frosted shimmer, not a full glass panel.
 *
 * intensity=18:
 *   • Enough to show a visible frost on content scrolling beneath the header.
 *   • Low enough not to compete with the Gold brand or city name text.
 *   • Matches the rgba(255,255,255,0.10) target from the task spec.
 */
const IOS_BLUR_TINT    = 'light' as const;
const IOS_BLUR_INTENSITY = 18;

/**
 * Android glass fallback.
 * rgba(255,255,255,0.10) — task spec's exact target, applied as a solid
 * semi-transparent surface since BlurView is still experimental on Android.
 */
const ANDROID_GLASS_BG_LIGHT = 'rgba(255, 255, 255, 0.10)';
const ANDROID_GLASS_BG_DARK  = 'rgba(0,   0,   0,   0.10)';

// ─── Inner layout — shared between iOS BlurView and Android View ──────────────
//
// Extracted as a standalone component so the Platform split above renders
// identical content regardless of which surface hosts it.

interface PillContentProps {
  city:      string;
  textColor: string;
  iconColor: string;
}

const PillContent = memo<PillContentProps>(({ city, textColor, iconColor }) => (
  <View style={styles.content}>
    {/* Map-pin marker — subtle location cue left of the city name */}
    <Feather
      name="map-pin"
      size={11}
      color={iconColor}
      strokeWidth={2}
      style={styles.mapPin}
    />

    {/* Active city name */}
    <Text
      style={[styles.label, { color: textColor }]}
      numberOfLines={1}
    >
      {city}
    </Text>

    {/* Dropdown chevron — signals this is a picker, not just a label */}
    <Feather
      name="chevron-down"
      size={13}
      color={iconColor}
      strokeWidth={2.5}
    />
  </View>
));

PillContent.displayName = 'CityPill.PillContent';

// ─── Component ────────────────────────────────────────────────────────────────

const CityPill = memo<CityPillProps>(({ city, onPress }) => {
  // ── Theme resolution ──────────────────────────────────────────────────────
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // ── Haptics (Q13: "Tap city / sector pill" → impactLight) ─────────────────
  const { impactLight } = useHaptics();

  // ── Reduced motion ────────────────────────────────────────────────────────
  const reducedMotion = useReducedMotion();

  // ── Press animation ───────────────────────────────────────────────────────
  //
  // scaleAnim is created ONCE via useRef.current — never reset mid-animation.
  //
  // Scale targets per blueprint:
  //   Pill press (Interaction [1]) → scale to 0.95
  //   This pill is in the header (not a content chip), so 0.94 gives a
  //   slightly firmer press that signals "this is a real navigation control".
  //
  // Note: The Pressable's pressed visual (borderColor, bg opacity) is handled
  // separately in the render so both surface variants (BlurView + View) pick
  // up the pressed colour change consistently.

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    // Haptic fires at touch-down — before any animation frame — for zero-delay feel.
    // Q13: "Tap city / sector pill" → impactLight
    impactLight();

    if (reducedMotion) return; // Reduced motion: opacity-only via Pressable style below

    Animated.timing(scaleAnim, {
      toValue:         0.94,
      duration:        Duration.micro,  // 80ms — §5.N buttonPress:80
      easing:          easeOut,
      useNativeDriver: true,
    }).start();
  }, [impactLight, reducedMotion]);
  // scaleAnim is a stable ref — intentionally omitted from deps

  const handlePressOut = useCallback(() => {
    // springStiff: tension:200 · friction:18 — crisp, confident release.
    // Guarantees the pill never gets "stuck" at 0.94 from an interrupted gesture.
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...springConfigs.springStiff,
    }).start();
  }, []);
  // scaleAnim is a stable ref — intentionally omitted from deps

  // ── Color resolution ──────────────────────────────────────────────────────
  //
  // Dark mode: primary text + secondary icon on dark glass surface.
  // Light mode: primary text + secondary icon on light glass surface.
  // The border uses border.subtle (ink[100]) in light, slightly darker in dark.

  const textColor   = isDark ? palette.white        : colors.fg.primary;
  const iconColor   = isDark ? palette.ink[300]     : colors.fg.secondary;
  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.14)'   // Subtle white rim on dark surface
    : colors.border.subtle;         // ink[100] — blueprint border-subtle token

  const androidBg   = isDark ? ANDROID_GLASS_BG_DARK : ANDROID_GLASS_BG_LIGHT;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${city} — city badlo`}
        accessibilityHint="Double-tap to open city picker"
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={({ pressed }) => [
          // Reduced motion: opacity dip replaces scale (blueprint §A.1.6)
          reducedMotion && pressed && styles.pressedOpacity,
        ]}
      >
        {/*
         * Surface split:
         *   iOS  → BlurView with real UIBlurEffect
         *   Android → solid rgba View
         * Both carry the same borderRadius, border, and height.
         * The borderColor is injected inline so dark mode works on both.
         */}
        {Platform.OS === 'ios' ? (
          <BlurView
            tint={IOS_BLUR_TINT}
            intensity={IOS_BLUR_INTENSITY}
            style={[
              styles.pill,
              {
                borderColor,
                // BlurView on iOS needs backgroundColor for the tinted wash
                // that shows through the blur — rgba at 10% per task spec.
                backgroundColor: ANDROID_GLASS_BG_LIGHT,
              },
            ]}
          >
            <PillContent
              city={city}
              textColor={textColor}
              iconColor={iconColor}
            />
          </BlurView>
        ) : (
          <View
            style={[
              styles.pill,
              {
                borderColor,
                backgroundColor: androidBg,
              },
            ]}
          >
            <PillContent
              city={city}
              textColor={textColor}
              iconColor={iconColor}
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

CityPill.displayName = 'CityPill';

export { CityPill };
export default CityPill;

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   dimensions.locationPillH = 36   Pill touch target height
//   radii.xl                 = 18   Full pill corner radius
//   spacing.md               = 12   Horizontal padding inside pill
//   spacing.xs               =  4   Gap between map-pin and label
//   spacing.sm               =  8   Gap between label and chevron

const styles = StyleSheet.create({

  // Animated.View — outermost wrapper owns the scale transform.
  // No backgroundColor here — shadows only render on views with opaque bg.
  wrapper: {
    // alignSelf: 'flex-start' prevents the wrapper from stretching in a flex
    // row header — the pill should hug its content width.
    alignSelf: 'flex-start',
  },

  // The pill surface — height and radius from dimension tokens.
  // borderWidth: 1 — border-subtle as per spec.
  // overflow: 'hidden' — clips BlurView and content to the rounded corners.
  // backgroundColor and borderColor injected inline (theme-dependent).
  pill: {
    height:         dimensions.locationPillH,    // 36px — §9 locationPillH
    borderRadius:   radii.xl,                    // 18px — full pill feel
    borderWidth:    1,
    overflow:       'hidden',                    // Clips BlurView to border-radius on iOS
    justifyContent: 'center',
  },

  // Inner row: map-pin · city name · chevron
  content: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: spacing.md,               // 12px — §4 horizontal pad
  },

  mapPin: {
    marginRight: spacing.xs,                     // 4px — tight gap to label
  },

  // City name label — pillLabel: 13px · 600 · lh18
  label: {
    ...typography.pillLabel,                     // fontSize:13 · fontWeight:'600' · lineHeight:18
    marginRight: spacing.sm,                     // 8px — LAW 15: spacing.sm (gap icon↔text)
    // Constrain width so very long city names don't push chevron off-screen.
    // maxWidth gives ~3 chars of buffer for the longest expected city name.
    maxWidth: 120,
    flexShrink: 1,
  },

  // Reduced-motion press feedback — opacity dip, no scale (blueprint §A.1.6)
  pressedOpacity: {
    opacity: 0.70,
  },
});

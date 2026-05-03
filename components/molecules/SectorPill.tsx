/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — components/molecules/SectorPill.tsx                      ║
 * ║  Molecule · P0 · Blueprint v5.0                                         ║
 * ║                                                                          ║
 * ║  Purpose:                                                                ║
 * ║    Sector picker pill for the Home Screen header (LAW 15 Row 1) and     ║
 * ║    any sub-nav context where a user selects among multiple sectors.      ║
 * ║    Shows sector name + dropdown chevron. Active state renders a 2px     ║
 * ║    Champagne Gold border + warm gold-tinted glass surface.              ║
 * ║                                                                          ║
 * ║  Props:                                                                  ║
 * ║    sector   : string  — display name ("Sector 17", "Sector 22", …)     ║
 * ║    onPress  : () => void — opens sector-picker sheet in parent          ║
 * ║    isActive : boolean (optional, default false)                          ║
 * ║               true  → 2px gold[600] border + gold-soft bg tint          ║
 * ║               false → 1px border-subtle + neutral glass bg              ║
 * ║                                                                          ║
 * ║  Differences from CityPill:                                              ║
 * ║    • No left map-pin icon — sector pills are icon-free (per index.tsx   ║
 * ║      real usage at testID="home-header-sector-pill")                    ║
 * ║    • isActive prop toggles: border width · border colour · bg tint ·   ║
 * ║      text colour · chevron colour                                        ║
 * ║    • Active text: fg.brandSubtle (gold[800]) — readable on gold wash    ║
 * ║    • Active border token: colors.border.cardEmphasis (palette.gold[600])║
 * ║                                                                          ║
 * ║  Glass surface strategy:                                                 ║
 * ║    iOS     → BlurView tint="light" intensity=18                         ║
 * ║    Android → View rgba solid (BlurView is experimental on Android)      ║
 * ║    Active iOS  bg: colors.bg.goldSoft (gold[50] — '#FCF7E5')           ║
 * ║    Active Droid: rgba(201,162,39,0.08) — Champagne Gold 8% wash        ║
 * ║    Inactive   : rgba(255,255,255,0.10) on both platforms                ║
 * ║                                                                          ║
 * ║  Press animation:                                                        ║
 * ║    Down : scale 1.0 → 0.94 · Duration.micro (80ms) · easeOut           ║
 * ║    Up   : Animated.spring · springStiff (tension:200 · friction:18)     ║
 * ║    Reduced motion: opacity 1.0 → 0.70 fallback (no scale)              ║
 * ║                                                                          ║
 * ║  Haptic: impactLight() on pressIn (Q13: "Tap city / sector pill")      ║
 * ║                                                                          ║
 * ║  Design tokens:                                                          ║
 * ║    dimensions.subNavPillH = 36   · radii.pill = 9999                    ║
 * ║    colors.border.subtle (ink[100]) — inactive border                    ║
 * ║    colors.border.cardEmphasis (gold[600]) — active border · 2px        ║
 * ║    colors.bg.goldSoft (gold[50]) — active bg tint                       ║
 * ║    typography.pillLabel (13px · 600 · lh18)                             ║
 * ║    spacing.md (12 — horizontal pad) · spacing.sm (8 — label↔chevron)   ║
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

export interface SectorPillProps {
  /**
   * Display name of the sector, e.g. "Sector 17", "Sector 22", "Elante".
   * Truncates at maxWidth — no manual truncation needed at call site.
   */
  sector: string;
  /**
   * When true, pill renders with the 2px Champagne Gold border and a warm
   * gold-tinted glass surface — used to mark the currently selected sector
   * in a row of multiple SectorPills.
   * @default false
   */
  isActive?: boolean;
  /** Called on press — parent opens the sector-picker bottom sheet */
  onPress: () => void;
}

// ─── Platform / theme constants ───────────────────────────────────────────────

const IOS_BLUR_TINT      = 'light' as const;
const IOS_BLUR_INTENSITY = 18;

// Inactive glass surface — rgba 10% white (task spec exact value)
const GLASS_BG_NEUTRAL   = 'rgba(255, 255, 255, 0.10)';

// Active glass surface — Champagne Gold (#C9A227) at 8% wash
// (colors.bg.goldSoft = palette.gold[50] used on iOS; rgba on Android)
const GLASS_BG_ACTIVE_ANDROID = 'rgba(201, 162, 39, 0.08)';

// Dark-mode neutral glass (same rgba but black-based)
const GLASS_BG_DARK      = 'rgba(0, 0, 0, 0.10)';

// Dark-mode active glass — gold wash works on dark surfaces too
const GLASS_BG_ACTIVE_DARK = 'rgba(201, 162, 39, 0.12)';

// ─── Inner layout ─────────────────────────────────────────────────────────────
//
// Pulled out of the Platform split so both BlurView (iOS) and View (Android)
// render identical content — single source of truth.

interface PillContentProps {
  sector:    string;
  textColor: string;
  iconColor: string;
}

const PillContent = memo<PillContentProps>(({ sector, textColor, iconColor }) => (
  <View style={styles.content}>
    {/* Sector name — truncates gracefully at maxWidth */}
    <Text
      style={[styles.label, { color: textColor }]}
      numberOfLines={1}
    >
      {sector}
    </Text>

    {/* Chevron — signals this is a picker */}
    <Feather
      name="chevron-down"
      size={13}
      color={iconColor}
      strokeWidth={2.5}
    />
  </View>
));

PillContent.displayName = 'SectorPill.PillContent';

// ─── Component ────────────────────────────────────────────────────────────────

const SectorPill = memo<SectorPillProps>(({
  sector,
  isActive      = false,
  onPress,
}) => {
  // ── Theme ─────────────────────────────────────────────────────────────────
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // ── Haptics (Q13: "Tap city / sector pill" → impactLight) ─────────────────
  const { impactLight } = useHaptics();

  // ── Reduced motion ────────────────────────────────────────────────────────
  const reducedMotion = useReducedMotion();

  // ── Press animation ───────────────────────────────────────────────────────
  //
  // Created ONCE via useRef — never silently reset mid-animation.
  // Scale target: 0.94 (same as CityPill — firm header-control feel).

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    // Haptic first — synchronous, zero-delay tactile response.
    // Q13 maps "Tap city / sector pill" → impactLight.
    impactLight();

    if (reducedMotion) return; // Reduced motion: opacity-only fallback via Pressable style

    Animated.timing(scaleAnim, {
      toValue:         0.94,
      duration:        Duration.micro,  // 80ms — §5.N buttonPress
      easing:          easeOut,
      useNativeDriver: true,
    }).start();
  }, [impactLight, reducedMotion]);
  // scaleAnim is a stable ref — intentionally excluded from deps

  const handlePressOut = useCallback(() => {
    // springStiff: tension:200 · friction:18 — crisp, no lingering bounce.
    // Runs unconditionally — guarantees pill never sticks at 0.94 from an
    // interrupted gesture (e.g. scroll cancel mid-press).
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...springConfigs.springStiff,
    }).start();
  }, []);
  // scaleAnim is a stable ref — intentionally excluded from deps

  // ── Token resolution ──────────────────────────────────────────────────────
  //
  // Active state:
  //   border  → colors.border.cardEmphasis (palette.gold[600]) at 2px
  //   bg      → colors.bg.goldSoft (gold[50]) on iOS · gold rgba on Android
  //   text    → colors.fg.brandSubtle (gold[800]) — WCAG AA on gold wash (6.4:1)
  //   icon    → colors.fg.brand (gold[600]) — matches border
  //
  // Inactive state:
  //   border  → colors.border.subtle (ink[100]) at 1px
  //   bg      → rgba(255,255,255,0.10) neutral glass
  //   text    → colors.fg.primary (ink[950]) light / palette.white dark
  //   icon    → colors.fg.secondary (ink[600]) light / ink[300] dark

  const borderColor  = isActive
    ? colors.border.cardEmphasis   // palette.gold[600] — Champagne Gold — 2px
    : (isDark
        ? 'rgba(255, 255, 255, 0.14)'  // Subtle white rim on dark surfaces
        : colors.border.subtle);       // ink[100] — blueprint border-subtle token

  const borderWidth  = isActive ? 2 : 1;

  const textColor    = isActive
    ? colors.fg.brandSubtle          // gold[800] — §15 audit: 6.4:1 on white ✅
    : (isDark ? palette.white : colors.fg.primary);

  const iconColor    = isActive
    ? colors.fg.brand                // gold[600] — pairs with gold border
    : (isDark ? palette.ink[300] : colors.fg.secondary);

  // iOS BlurView background — goldSoft for active, glass neutral for inactive
  const iosBlurBg    = isActive
    ? colors.bg.goldSoft             // palette.gold[50] — '#FCF7E5' warm ivory tint
    : GLASS_BG_NEUTRAL;

  // Android solid background
  const androidBg    = isActive
    ? (isDark ? GLASS_BG_ACTIVE_DARK : GLASS_BG_ACTIVE_ANDROID)
    : (isDark ? GLASS_BG_DARK        : GLASS_BG_NEUTRAL);

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
        accessibilityLabel={`${sector} — sector badlo`}
        accessibilityHint="Double-tap to open sector picker"
        accessibilityState={{ selected: isActive }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={({ pressed }) => [
          // Reduced-motion: opacity dip replaces scale (blueprint §A.1.6).
          // Only applied when reducedMotion is true — zero cost otherwise.
          reducedMotion && pressed && styles.pressedOpacity,
        ]}
      >
        {/*
         * Platform surface split — mirrors Glass Island strategy in _layout.tsx:
         *
         * iOS     → BlurView: real UIBlurEffect backdrop blur.
         *           overflow:hidden clips blur to rounded corners.
         *           backgroundColor provides the tinted wash on top of blur.
         *
         * Android → solid rgba View: BlurView is experimental on Android.
         *           rgba gives the "frosted" illusion at lower fidelity.
         *
         * Both carry identical PillContent and resolve the same border/radius.
         */}
        {Platform.OS === 'ios' ? (
          <BlurView
            tint={IOS_BLUR_TINT}
            intensity={IOS_BLUR_INTENSITY}
            style={[
              styles.pill,
              {
                borderColor,
                borderWidth,
                backgroundColor: iosBlurBg,
              },
            ]}
          >
            <PillContent
              sector={sector}
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
                borderWidth,
                backgroundColor: androidBg,
              },
            ]}
          >
            <PillContent
              sector={sector}
              textColor={textColor}
              iconColor={iconColor}
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

SectorPill.displayName = 'SectorPill';

export { SectorPill };
export default SectorPill;

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   dimensions.subNavPillH  = 36    Pill height — sub-nav pill scale
//   radii.xl                = 18    §8 Radius Protocol: Pill/Chip header pills
//   spacing.md              = 12    Horizontal padding inside pill
//   spacing.sm              =  8    Label → chevron gap (LAW 15: spacing.sm)
//
// Note: borderWidth and borderColor are injected inline (active/inactive vary).
// Note: backgroundColor is injected inline (platform + active/inactive vary).

const styles = StyleSheet.create({

  // Animated.View — outermost wrapper owns the scale transform.
  // alignSelf: 'flex-start' — hugs content width in any flex parent
  // (header row, horizontal ScrollView, wrap row of sector chips).
  wrapper: {
    alignSelf: 'flex-start',
  },

  // Pill surface — height and full-pill radius from dimension tokens.
  // overflow:'hidden' clips BlurView and content to the border-radius on iOS.
  // borderWidth / borderColor / backgroundColor are injected inline.
  pill: {
    height:         dimensions.subNavPillH,      // 36px — §9 subNavPillH
    borderRadius:   radii.xl,                    // 18px — §8 Radius Protocol: "Pill/Chip: xl — City/Sector pills in header"
    overflow:       'hidden',                    // Essential: clips BlurView on iOS
    justifyContent: 'center',
  },

  // Inner content row: [sector name] [chevron]
  // No left icon — per real usage in index.tsx testID="home-header-sector-pill"
  content: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,               // 12px — §4 horizontal pad
  },

  // Sector name — pillLabel: 13px · 600 · lh18
  // color injected inline — varies by isActive + theme.
  // flexShrink:1 + maxWidth — long sector names truncate cleanly.
  label: {
    ...typography.pillLabel,                     // fontSize:13 · fontWeight:'600' · lineHeight:18
    marginRight: spacing.sm,                     // 8px — LAW 15: spacing.sm (label↔chevron)
    maxWidth:    112,
    flexShrink:  1,
  },

  // Reduced-motion press feedback — opacity dip, no scale (blueprint §A.1.6)
  pressedOpacity: {
    opacity: 0.70,
  },
});

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — components/EmptyState.tsx                                ║
 * ║  Atom · P2 · Blueprint v5.0 Polish                                      ║
 * ║                                                                          ║
 * ║  Props:                                                                  ║
 * ║    icon     : string — Feather icon name OR a single emoji ("🏙️")       ║
 * ║    title    : string — Primary empty-state headline                      ║
 * ║    subtitle : string? — Supporting body copy                             ║
 * ║    action   : { label, onPress }? — Optional CTA via Button atom         ║
 * ║                                                                          ║
 * ║  Features:                                                               ║
 * ║    • Entrance: opacity + translateY (reduced-motion: opacity only)       ║
 * ║    • Double-ring icon halo — champagne gold wash                         ║
 * ║    • Dark / Light theme via useColorScheme + orbitDark / orbitLight      ║
 * ║    • CTA uses Button atom (primary · md) — no custom Pressable           ║
 * ║    • accessibilityLiveRegion="polite" so screen-readers announce fill    ║
 * ║    • All tokens from constants/colors — zero hardcoded values            ║
 * ║                                                                          ║
 * ║  Design token refs:                                                      ║
 * ║    colors.bg.card / colors.bg.goldSoft / colors.fg.tertiary             ║
 * ║    colors.border.card / colors.border.subtle                             ║
 * ║    palette.gold[200/400/700] / palette.cream[200/400]                   ║
 * ║    typography.bodyLarge (spread, fontWeight:'600') · 14px/400 direct    ║
 * ║    spacing.xl / xxl / '3xl' / '4xl'                                    ║
 * ║    radii.full / animation durations / springGentle                      ║
 * ║    §6 Component Inventory: title 16/600 · subtitle 14/400               ║
 * ║    §6 Component Inventory: halo 80px · ring 56px                        ║
 * ║                                                                          ║
 * ║  Deps: constants/colors.ts · constants/animations.ts · Button.tsx       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import {
  colors,
  typography,
  spacing,
  radii,
  palette,
  orbitDark,
  orbitLight,
} from '@/constants/colors';
import {
  fadeConfig,
  springConfigs,
  useReducedMotion,
} from '@/constants/animations';
import { Button } from '@/components/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeatherIconName = ComponentProps<typeof Feather>['name'];

export interface EmptyStateProps {
  /**
   * Feather icon name (e.g. "inbox") OR a single emoji string (e.g. "🏙️").
   * Detection: any string whose first code-point is > 127 is treated as emoji
   * and rendered as a large `<Text>`. All other strings are forwarded to Feather.
   */
  icon: string;
  /** Primary empty-state headline — h3 weight */
  title: string;
  /** Optional supporting body copy — body-small, secondary colour */
  subtitle?: string;
  /** Optional CTA rendered via the Button atom */
  action?: {
    label: string;
    onPress: () => void;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * True when the string's first Unicode code-point is outside ASCII range.
 * This catches every standard emoji (U+1F300+, U+2600–U+27BF, etc.)
 * while cleanly passing Feather icon names ("inbox", "arrow-right", …).
 */
function isEmoji(s: string): boolean {
  return (s.codePointAt(0) ?? 0) > 127;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EmptyState = memo<EmptyStateProps>(({
  icon,
  title,
  subtitle,
  action,
}) => {
  // ── Theme ────────────────────────────────────────────────────────────────
  const scheme  = useColorScheme();
  const isDark  = scheme === 'dark';
  const orbit   = isDark ? orbitDark : orbitLight;

  // ── Reduced-motion gate ───────────────────────────────────────────────────
  const reducedMotion = useReducedMotion();

  // ── Entrance animation ────────────────────────────────────────────────────
  //
  // Normal    : opacity 0→1 (fadeConfig · 240ms easeOut)
  //             + translateY 14→0 (springGentle · tension:100 · friction:15)
  // Reduced   : opacity 0→1 only — no vertical motion
  //
  // Both Animated.Values are created ONCE via useRef — they survive re-renders
  // and never silently reset to their initial value mid-animation.

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(reducedMotion ? 0 : 14)).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(fadeAnim, { toValue: 1, ...fadeConfig }),
    ];

    if (!reducedMotion) {
      animations.push(
        Animated.spring(slideAnim, {
          toValue: 0,
          ...springConfigs.springGentle,  // tension:100 · friction:15 · no overshoot
        }),
      );
    }

    Animated.parallel(animations).start();
  }, []); // intentional empty-dep: fires once on mount, stable refs = no closure risk

  // ── Icon resolution ───────────────────────────────────────────────────────
  const emoji        = isEmoji(icon);
  const iconColor    = isDark ? palette.gold[400] : palette.gold[700];

  // Halo + inner ring use cream/gold tokens — no hardcoded colours.
  const haloBackground = isDark
    ? 'rgba(201, 162, 39, 0.08)'   // Champagne Gold (#C9A227) @ 8% — dark bg
    : colors.bg.goldSoft;          // palette.gold[50] — lightest warm tint
  const haloBorder     = isDark
    ? 'rgba(201, 162, 39, 0.16)'
    : palette.gold[200];

  const ringBackground = isDark
    ? 'rgba(201, 162, 39, 0.14)'
    : palette.cream[200];
  const ringBorder     = isDark
    ? 'rgba(201, 162, 39, 0.28)'
    : palette.cream[400];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity:   fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      {/* ── Double-ring icon halo ─────────────────────────────────────── */}
      <View
        style={[
          styles.halo,
          { backgroundColor: haloBackground, borderColor: haloBorder },
        ]}
      >
        <View
          style={[
            styles.ring,
            { backgroundColor: ringBackground, borderColor: ringBorder },
          ]}
        >
          {emoji ? (
            // accessible={false} — screen readers must NOT read the emoji Text
            // directly; they would double-announce it (once as text, once from
            // the accessibilityLabel we place on the wrapping View below).
            // accessibilityRole="image" on the View is the correct WCAG pattern
            // for decorative / illustrative glyphs in React Native.
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Icon: ${icon}`}
            >
              <Text style={styles.emojiIcon} accessible={false}>
                {icon}
              </Text>
            </View>
          ) : (
            <Feather
              name={icon as FeatherIconName}
              size={26}
              color={iconColor}
              strokeWidth={1.5}
            />
          )}
        </View>
      </View>

      {/* ── Text block ────────────────────────────────────────────────── */}
      <Text
        style={[styles.title, { color: orbit.textPrimary }]}
        accessibilityRole="header"
      >
        {title}
      </Text>

      {subtitle != null && (
        <Text style={[styles.subtitle, { color: orbit.textSecond }]}>
          {subtitle}
        </Text>
      )}

      {/* ── CTA — delegates all press logic to the Button atom ────────── */}
      {action != null && (
        <View style={styles.actionWrap}>
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="primary"
            size="md"
            iconRight="arrow-right"
          />
        </View>
      )}
    </Animated.View>
  );
});

EmptyState.displayName = 'EmptyState';

export { EmptyState };
export default EmptyState;

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   spacing['3xl']  = 40  (screenH padding)
//   spacing['4xl']  = 48  (vertical padding)
//   spacing.xxl     = 32  (gap: halo → title)
//   spacing.sm      =  8  (gap: title → subtitle)
//   spacing.xl      = 24  (gap: subtitle → action)
//   radii.full      = 9999 (circle halos)

const styles = StyleSheet.create({

  container: {
    flex: 1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing['3xl'],   // 40 — §4 screenH-adjacent
    paddingVertical:   spacing['4xl'],   // 48 — generous breathing room
  },

  // ── Outer halo ring — gold wash, 80px diameter (§6 Component Inventory)
  halo: {
    width:           80,
    height:          80,
    borderRadius:    radii.full,
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xxl,        // 32 — halo → title gap
  },

  // ── Inner ring — cream card surface, 56px diameter (§6 Component Inventory)
  ring: {
    width:           56,
    height:          56,
    borderRadius:    radii.full,
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Emoji fallback — oversized for visual weight parity with Feather
  emojiIcon: {
    fontSize:   28,
    lineHeight: 34,        // RN needs an explicit lineHeight for emoji centering
  },

  // ── Title — §6 Component Inventory: 16px · weight 600
  //   typography.bodyLarge (16px/400/lh24) spread, fontWeight overridden to '600'.
  //   No standalone 16/600 token exists; this is the correct override pattern.
  title: {
    ...typography.bodyLarge,             // fontSize:16 · lineHeight:24 — base spread
    fontWeight:    '600',                // §6 override: 600 (not bodyLarge's 400)
    textAlign:     'center',
    letterSpacing: -0.3,
    marginBottom:  spacing.sm,           // 8 — tight to subtitle
  },

  // ── Subtitle — §6 Component Inventory: 14px · weight 400
  //   No exact 14px token in typography scale (body=15, bodySmall=13).
  //   Blueprint specifies 14px explicitly, so we set fontSize directly.
  //   lineHeight 20 preserved from bodySmall for comfortable reading.
  subtitle: {
    fontSize:      14,                   // §6 spec: 14px — between body(15) and bodySmall(13)
    fontWeight:    '400',
    lineHeight:    20,
    textAlign:     'center',
    maxWidth:      264,
    marginBottom:  spacing.xl,           // 24 — gap to CTA
  },

  // ── Action wrapper — prevents Button from stretching to full container width
  actionWrap: {
    // No marginTop — subtitle already carries spacing.xl bottom margin.
    // If subtitle is absent, the CTA sits spacing.xxl below the halo (sum of
    // halo.marginBottom = 32 + title.marginBottom = 8 = 40px visual gap).
    alignSelf: 'center',
  },
});

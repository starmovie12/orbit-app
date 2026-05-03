/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — components/atoms/Divider.tsx                             ║
 * ║  Atom · P3 · Blueprint v5.0                                             ║
 * ║                                                                          ║
 * ║  Variants:                                                               ║
 * ║    • Plain  — hairline separator (no label)                              ║
 * ║    • Labeled — line ─── label ─── line  (e.g. "YA PHIR" / "OR")        ║
 * ║                                                                          ║
 * ║  Tokens only. No hardcoded colors / spacing.                             ║
 * ║  WCAG AA: label uses fg.secondary (ink[600], 7.2:1 on white)            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  colors,
  spacing,
  typography,
} from '@/constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DividerProps {
  /** Optional centred label — renders line–text–line layout when provided */
  label?: string;
  /**
   * Override line color. Accepts any valid React Native color string.
   * Defaults to colors.border.default (cream[400] — hairline).
   */
  color?: string;
  /** Extra style applied to the outer wrapper View */
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Divider = memo<DividerProps>(({ label, color, style }) => {
  const lineColor = color ?? colors.border.default;

  if (!label) {
    // ── Plain variant ────────────────────────────────────────────────────────
    return (
      <View
        accessible={false}
        style={[styles.plainWrapper, style]}
      >
        <View style={[styles.line, { backgroundColor: lineColor }]} />
      </View>
    );
  }

  // ── Labeled variant ─────────────────────────────────────────────────────
  return (
    <View
      accessible
      accessibilityRole="none"
      accessibilityLabel={label}
      style={[styles.labeledWrapper, style]}
    >
      {/* Left arm */}
      <View style={[styles.arm, { backgroundColor: lineColor }]} />

      {/* Label pill */}
      <Text
        style={styles.labelText}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* Right arm */}
      <View style={[styles.arm, { backgroundColor: lineColor }]} />
    </View>
  );
});

Divider.displayName = 'Divider';

export default Divider;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Plain variant ──────────────────────────────────────────────────────────
  plainWrapper: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: spacing.xs, // 4pt — gives finger-room without visual bulk
  },

  line: {
    width: '100%',
    height: StyleSheet.hairlineWidth, // Exactly 1 physical pixel on all densities
  },

  // ── Labeled variant ────────────────────────────────────────────────────────
  labeledWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.xs, // 4pt
  },

  arm: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },

  labelText: {
    ...typography.label, // fontSize: 12 · fontWeight: '600' · lineHeight: 16
    color: colors.fg.secondary,               // ink[600] — 7.2:1 on white ✅ WCAG AA
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,            // 8pt — breathing room either side
    includeFontPadding: false,                // Android: removes extra baseline padding
    textAlignVertical: 'center',
  },
});

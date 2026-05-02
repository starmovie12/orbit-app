/**
 * IconBox — components/atoms/IconBox.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: fixed · P2
 *
 * A square container wrapping a single Lucide icon. The building block for
 * settings rows, wallet quick-action cells, and mayor power pills.
 *
 * Container size  = icon size (22px default) + horizontal padding (8px × 2)
 *                 = 38 × 38px at defaults
 *
 * Design defaults (all overridable via props)
 *   bg      : colors.bg.goldSoft   — gold[50]  #FCF7E5  — warm pale gold
 *   color   : colors.fg.secondary  — ink[600]  #6B5B47  — espresso icon
 *   radius  : radii.lg = 12px      — rounded square (Addendum § A.1.3)
 *   padding : 8px                  — fits 8pt grid (Blueprint § 5.L)
 *
 * Icon naming convention: pass Lucide PascalCase names (e.g. "Bell", "Send").
 * Kebab-case input (e.g. "message-square") is also accepted and auto-converted.
 *
 * Re-exported from components/shared.tsx for backward compat.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, radii } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All valid Lucide icon keys (PascalCase, e.g. "Bell", "MessageSquare").
 * Kebab-case aliases (e.g. "bell", "message-square") are accepted via
 * the `toPascal` helper and resolved at runtime.
 */
export type LucideName = keyof typeof LucideIcons;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a kebab-case Feather/Lucide name to the PascalCase key used
 * by lucide-react-native exports.
 *
 * Examples:
 *   "bell"           → "Bell"
 *   "message-square" → "MessageSquare"
 *   "trash-2"        → "Trash2"
 */
function toPascal(name: string): string {
  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Resolve an icon component from lucide-react-native.
 * Accepts both PascalCase ("Bell") and kebab-case ("bell") names.
 * Returns `null` when the name is not found so the caller can handle gracefully.
 */
function resolveIcon(name: string): LucideIcon | null {
  // Try the name as-is first (PascalCase) then try converting from kebab-case.
  const direct  = (LucideIcons as Record<string, unknown>)[name];
  const pascal  = (LucideIcons as Record<string, unknown>)[toPascal(name)];
  const resolved = direct ?? pascal;

  if (typeof resolved !== 'function') return null;
  return resolved as LucideIcon;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface IconBoxProps {
  /**
   * Lucide icon name. Accepts both PascalCase ("Bell") and kebab-case ("bell").
   * Full list: https://lucide.dev/icons
   *
   * Kebab-case support exists for migration from Feather — prefer PascalCase
   * in new code to avoid runtime name-conversion overhead.
   */
  name: string;

  /**
   * Icon glyph size in logical pixels.
   * Container = size + padding × 2 (auto-sizes to content).
   * @default 22
   */
  size?: number;

  /**
   * Container background color. Accepts any RN color string.
   * @default colors.bg.goldSoft — gold[50] #FCF7E5
   */
  bg?: string;

  /**
   * Icon glyph color. Accepts any RN color string.
   * @default colors.fg.secondary — ink[600] #6B5B47
   */
  color?: string;

  /**
   * Symmetric padding inside the container (applied on all four sides).
   * MUST be a value on the 8pt grid: 0 · 4 · 8 · 12 · 16 · 20 · 24 …
   * Banned values: 5 · 6 · 7 · 9 · 10 · 11 · 13 · 14 · 15 (Blueprint § 5.L)
   * @default 8  (xs — 8pt grid)
   */
  padding?: number;

  /**
   * Border radius of the square container.
   * Use `radii.circle` (9999) or `radii.full` for a circular variant.
   * @default radii.lg — 12px (Addendum § A.1.3)
   */
  radius?: number;

  /** Optional border color. When omitted, no border is rendered. */
  borderColor?: string;

  /** Optional border width in logical pixels. Ignored when borderColor is absent. */
  borderWidth?: number;

  /**
   * Lucide stroke width.
   * Blueprint mandates 1.5 — NEVER override unless design explicitly permits.
   * @default 1.5
   */
  strokeWidth?: number;

  /** Additional styles applied to the outer View. */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — DEFAULT VALUES
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BG           = colors.bg.goldSoft;      // gold[50]  #FCF7E5
const DEFAULT_COLOR        = colors.fg.secondary;     // ink[600]  #6B5B47
const DEFAULT_SIZE         = 22  as const;
const DEFAULT_PADDING      = 8   as const;             // 8pt grid — NOT 10 (banned)
const DEFAULT_RADIUS       = radii.lg as number;       // 12px — Addendum § A.1.3
const DEFAULT_STROKE_WIDTH = 1.5 as const;             // Blueprint mandate — never override

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IconBox
 *
 * Square container + Lucide icon (1.5 stroke · Blueprint § 5.L).
 * Sizing is additive: the container grows automatically with the icon —
 * callers never need to calculate container sizes.
 *
 * @example
 * // Settings row — default warm gold bg
 * <IconBox name="Bell" />
 *
 * @example
 * // Wallet quick-action cell — brand gold icon on soft gold bg
 * <IconBox name="Send" color={colors.fg.brand} bg={colors.bg.goldSoft} size={20} />
 *
 * @example
 * // Mayor power pill — gold border emphasis
 * <IconBox
 *   name="Shield"
 *   color={colors.fg.brand}
 *   borderColor={colors.fg.brand}
 *   borderWidth={1}
 *   size={18}
 *   padding={8}
 *   radius={radii.xl}
 * />
 *
 * @example
 * // Circular avatar-style icon (e.g., notification type)
 * <IconBox name="Check" radius={radii.circle} bg={colors.bg.successSoft} color={colors.fg.success} />
 *
 * @example
 * // Destructive action — error-tinted
 * <IconBox name="Trash2" bg={colors.bg.errorSoft} color={colors.fg.error} />
 *
 * @example
 * // Kebab-case compat (migration from Feather) — auto-converts at runtime
 * <IconBox name="message-square" />
 */
const IconBox: React.FC<IconBoxProps> = ({
  name,
  size        = DEFAULT_SIZE,
  bg          = DEFAULT_BG,
  color       = DEFAULT_COLOR,
  padding     = DEFAULT_PADDING,
  radius      = DEFAULT_RADIUS,
  borderColor,
  borderWidth,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  style,
}) => {
  // Resolve Lucide component — log a dev warning on unknown names.
  const Icon = resolveIcon(name);

  if (__DEV__ && Icon === null) {
    console.warn(
      `[IconBox] Unknown Lucide icon: "${name}". ` +
      `Check https://lucide.dev/icons for valid names.`,
    );
  }

  // Container is a perfect square — size + padding on all four sides.
  const containerSize = size + padding * 2;

  return (
    <View
      style={[
        styles.container,
        {
          width:           containerSize,
          height:          containerSize,
          borderRadius:    radius,
          backgroundColor: bg,
          // Border is optional — only applied when borderColor is provided.
          ...(borderColor
            ? {
                borderColor,
                borderWidth: borderWidth ?? 1,
              }
            : undefined),
        },
        style,
      ]}
    >
      {Icon !== null && (
        <Icon
          size={size}
          color={color}
          strokeWidth={strokeWidth}
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    // All sizing + color is dynamic (inline) — only layout here.
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORT
// React.memo — all props are primitives; shallow compare is sufficient.
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(IconBox);

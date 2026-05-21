/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  @/constants/crown  — design-token shorthand for Crown / Spotlight       ║
 * ║                                                                          ║
 * ║  Exports three compact aliases consumed by app/spotlight/index.tsx       ║
 * ║  (and any other Crown-family screen that needs a single import):         ║
 * ║                                                                          ║
 * ║    t  — colour tokens  (bg / fg / border / shadow / scrim / white)       ║
 * ║    r  — radius tokens  (button / chip / modal / pill)                    ║
 * ║    sp — spacing tokens (xs / sm / md / lg / xl / xxl)                   ║
 * ║                                                                          ║
 * ║  All values are derived from the single-source-of-truth files:           ║
 * ║    @/constants/colors   → palette, orbitGold, colors                    ║
 * ║    @/constants/spacing  → spacing, radius, shadows                       ║
 * ║                                                                          ║
 * ║  ZERO hardcoded hex values. ZERO raw numbers. ZERO ₹ symbols.            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { orbitGold, colors } from '@/constants/colors';
import { spacing, radius, shadows } from '@/constants/spacing';

// ─────────────────────────────────────────────────────────────────────────────
// t — Colour tokens
// ─────────────────────────────────────────────────────────────────────────────

export const t = {
  // Backgrounds
  bgSurface:       orbitGold.bg,              // main screen background
  bgCard:          orbitGold.surface1,        // standard card surface
  bgCardElevated:  orbitGold.surface2,        // elevated / highlighted card
  bgBrandSubtle:   orbitGold.accentSoftSolid, // soft brand wash (gold[50])
  bgSuccessSubtle: orbitGold.successSoft,     // soft success wash

  // Foreground / text
  fgTextStrong:    orbitGold.textPrimary,     // headings, high-emphasis labels
  fgTextSubtle:    orbitGold.textSecond,      // secondary labels
  fgTextMuted:     orbitGold.textTertiary,    // captions, placeholders
  fgBrand:         orbitGold.fgBrand,         // brand gold (#D4A017 light)
  fgSuccess:       orbitGold.success,         // success green
  fgDanger:        orbitGold.danger,          // danger red

  // Borders
  borderSubtle:    orbitGold.borderSubtle,    // card / input idle border
  borderStrong:    orbitGold.borderStrong,    // prominent / focus border

  // Scrim & overlay
  scrim:           colors.bg.scrim,           // modal backdrop — warm rgba

  // Shadows (spread-friendly objects: { shadowColor, shadowOffset, … })
  shadow: {
    md: shadows.md,
    lg: shadows.lg,
  },

  // Absolute
  white:           orbitGold.white,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// r — Radius tokens
// ─────────────────────────────────────────────────────────────────────────────

export const r = {
  chip:   radius.xs,   //  4px — chip, tiny badge
  button: radius.sm,   //  8px — buttons, inputs
  modal:  radius.lg,   // 16px — modals, bottom sheets
  pill:   radius.pill, // 999  — fully rounded pill / avatar
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// sp — Spacing tokens
// ─────────────────────────────────────────────────────────────────────────────

export const sp = {
  xs:  spacing.xs,   //  4px
  sm:  spacing.sm,   //  8px
  md:  spacing.md,   // 12px
  lg:  spacing.lg,   // 16px
  xl:  spacing.xl,   // 20px
  xxl: spacing.xxl,  // 24px
} as const;

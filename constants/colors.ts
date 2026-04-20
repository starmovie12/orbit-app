/**
 * ORBIT — Design Tokens v2
 *
 * Single source of truth. Do NOT inline hex values anywhere else.
 *
 * Philosophy: Quiet luxury. ONE accent. Hierarchy by space and weight,
 * not by competing colors. Beat Telegram by being simpler, beat Discord
 * by being calmer, beat WhatsApp by being more capable.
 *
 * Both dark (default) and light themes are defined here.
 * CSS equivalents live in tokens.css / globals.css for web/preview use.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   DARK THEME (app default)
───────────────────────────────────────────────────────────────────────────── */
const orbitDark = {
  bg:           "#0A0A0B",
  surface1:     "#131316",
  surface2:     "#1C1C20",
  surface3:     "#26262C",
  borderSubtle: "#1F1F24",
  borderStrong: "#2E2E35",
  textPrimary:  "#F5F5F7",
  textSecond:   "#A1A1AA",
  textTertiary: "#6B6B73",
  textInverse:  "#0A0A0B",
  accent:          "#5B7FFF",
  accentHover:     "#4A6FF0",
  accentSoft:      "rgba(91, 127, 255, 0.10)",
  accentSoftSolid: "#16193A",
  success:      "#2BB673",
  successSoft:  "rgba(43, 182, 115, 0.12)",
  warning:      "#E8A33D",
  warningSoft:  "rgba(232, 163, 61, 0.12)",
  danger:       "#E5484D",
  dangerSoft:   "rgba(229, 72, 77, 0.12)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
   LIGHT THEME
───────────────────────────────────────────────────────────────────────────── */
const orbitLight = {
  bg:           "#F7F7F8",
  surface1:     "#FFFFFF",
  surface2:     "#F0F0F2",
  surface3:     "#E8E8EC",
  borderSubtle: "#E4E4E8",
  borderStrong: "#CBCBD2",
  textPrimary:  "#0A0A0B",
  textSecond:   "#52525B",
  textTertiary: "#A1A1AA",
  textInverse:  "#FFFFFF",
  accent:          "#5B7FFF",
  accentHover:     "#4A6FF0",
  accentSoft:      "rgba(91, 127, 255, 0.10)",
  accentSoftSolid: "#E8ECFF",
  success:      "#1DA360",
  successSoft:  "rgba(29, 163, 96, 0.10)",
  warning:      "#C97D1A",
  warningSoft:  "rgba(201, 125, 26, 0.10)",
  danger:       "#D93025",
  dangerSoft:   "rgba(217, 48, 37, 0.10)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const orbit = orbitDark;

function makePalette(o: typeof orbitDark) {
  return {
    text:                o.textPrimary,
    tint:                o.accent,
    background:          o.bg,
    foreground:          o.textPrimary,
    card:                o.surface1,
    cardForeground:      o.textPrimary,
    primary:             o.accent,
    primaryForeground:   o.textInverse,
    secondary:           o.surface2,
    secondaryForeground: o.textSecond,
    muted:               o.surface2,
    mutedForeground:     o.textTertiary,
    accent:              o.surface2,
    accentForeground:    o.textPrimary,
    destructive:         o.danger,
    destructiveForeground: o.white,
    border:              o.borderSubtle,
    input:               o.borderStrong,
    surface:             o.surface1,
    surface2:            o.surface2,
    surface3:            o.surface3,
    sub:                 o.textSecond,
    blueLight:           o.accent,
    green:               o.success,
    red:                 o.danger,
    gold:                o.warning,
    yellow:              o.warning,
    purple:              o.accent,
    orbit:               o,
  } as const;
}

const colors = {
  dark:   makePalette(orbitDark),
  light:  makePalette(orbitLight),
  radius: 12,
} as const;

export default colors;
export { orbitDark, orbitLight };

export type OrbitTokens  = typeof orbitDark;
export type ColorPalette = ReturnType<typeof makePalette>;

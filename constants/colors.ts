/**
 * ORBIT — Design Tokens v3 (Golden Edition)
 *
 * White + Gold premium theme — matching the CROWN HTML design.
 * Background: warm white (#FDF8F2), Accent: rich gold (#C8871A)
 */

const orbitGold = {
  bg:           "#FDF8F2",
  surface1:     "#FFFFFF",
  surface2:     "#FFF8ED",
  surface3:     "#F5EDE0",
  borderSubtle: "#E8D9C8",
  borderStrong: "#D4BFA0",
  textPrimary:  "#1A1208",
  textSecond:   "#5C4A2E",
  textTertiary: "#8B6D4A",
  textInverse:  "#FFFFFF",
  accent:          "#C8871A",
  accentHover:     "#A0620A",
  accentSoft:      "rgba(200, 135, 26, 0.10)",
  accentSoftSolid: "#FDF3E1",
  success:      "#2BB673",
  successSoft:  "rgba(43, 182, 115, 0.12)",
  warning:      "#E8A93A",
  warningSoft:  "rgba(232, 169, 58, 0.12)",
  danger:       "#E5484D",
  dangerSoft:   "rgba(229, 72, 77, 0.12)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

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
  accent:          "#C8871A",
  accentHover:     "#A0620A",
  accentSoft:      "rgba(200, 135, 26, 0.10)",
  accentSoftSolid: "#2A1F0A",
  success:      "#2BB673",
  successSoft:  "rgba(43, 182, 115, 0.12)",
  warning:      "#E8A93A",
  warningSoft:  "rgba(232, 169, 58, 0.12)",
  danger:       "#E5484D",
  dangerSoft:   "rgba(229, 72, 77, 0.12)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

const orbitLight = orbitGold;

// Golden white theme is now the default
export const orbit = orbitGold;

function makePalette(o: typeof orbitGold) {
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
export { orbitDark, orbitLight, orbitGold };

export type OrbitTokens  = typeof orbitGold;
export type ColorPalette = ReturnType<typeof makePalette>;

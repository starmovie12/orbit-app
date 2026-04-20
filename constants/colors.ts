/**
 * ORBIT — Design Tokens v2
 *
 * Single source of truth. Do NOT inline hex values anywhere else.
 *
 * Philosophy: Quiet luxury. ONE accent. Hierarchy by space and weight,
 * not by competing colors. Beat Telegram by being simpler, beat Discord
 * by being calmer, beat WhatsApp by being more capable.
 */

const orbit = {
  // Surfaces (background, card, elevated)
  bg:           "#0A0A0B",  // App background — near-black with slight warmth
  surface1:     "#131316",  // Cards, list items
  surface2:     "#1C1C20",  // Hovered/elevated, input fields, icon boxes
  surface3:     "#26262C",  // Modals, sheets

  // Borders / dividers
  borderSubtle: "#1F1F24",  // Hairlines (1px)
  borderStrong: "#2E2E35",  // Input borders, defined edges

  // Text
  textPrimary:  "#F5F5F7",  // Headings, key labels
  textSecond:   "#A1A1AA",  // Body, meta info
  textTertiary: "#6B6B73",  // Timestamps, hints, disabled
  textInverse:  "#0A0A0B",  // Text on accent buttons

  // Accent (the ONE Orbit blue)
  accent:       "#5B7FFF",
  accentHover:  "#4A6FF0",
  accentSoft:   "rgba(91, 127, 255, 0.10)",
  accentSoftSolid: "#16193A", // Pre-blended for places that can't render rgba over bg

  // Semantic
  success:      "#2BB673",
  successSoft:  "rgba(43, 182, 115, 0.12)",
  warning:      "#E8A33D",
  warningSoft:  "rgba(232, 163, 61, 0.12)",
  danger:       "#E5484D",
  dangerSoft:   "rgba(229, 72, 77, 0.12)",
};

/**
 * The legacy `colors.light/dark` object is kept for compatibility with files
 * that still import `useColors()`. Each old key maps to its new Orbit token
 * so existing code keeps compiling while the redesign rolls out screen-by-screen.
 */
const palette = {
  // ── Backgrounds ──────────────────────────────────────────────
  text:                orbit.textPrimary,
  tint:                orbit.accent,
  background:          orbit.bg,
  foreground:          orbit.textPrimary,
  card:                orbit.surface1,
  cardForeground:      orbit.textPrimary,

  // ── Primary ──────────────────────────────────────────────────
  primary:             orbit.accent,
  primaryForeground:   orbit.textInverse,

  // ── Secondary / Muted / Accent (legacy slots) ────────────────
  secondary:           orbit.surface2,
  secondaryForeground: orbit.textSecond,
  muted:               orbit.surface2,
  mutedForeground:     orbit.textTertiary,
  accent:              orbit.surface2,
  accentForeground:    orbit.textPrimary,

  // ── Semantic ─────────────────────────────────────────────────
  destructive:         orbit.danger,
  destructiveForeground: "#FFFFFF",

  // ── Borders / inputs ─────────────────────────────────────────
  border:              orbit.borderSubtle,
  input:               orbit.borderStrong,

  // ── Surface ladder ───────────────────────────────────────────
  surface:             orbit.surface1,
  surface2:            orbit.surface2,
  surface3:            orbit.surface3,

  // ── Convenience aliases used throughout the app ──────────────
  sub:                 orbit.textSecond,
  blueLight:           orbit.accent,
  green:               orbit.success,
  red:                 orbit.danger,
  gold:                orbit.warning,
  yellow:              orbit.warning,
  purple:              orbit.accent,

  // ── Direct Orbit tokens (preferred for new code) ─────────────
  orbit,
};

const colors = {
  light: palette,
  dark:  palette,
  radius: 12,
  orbit,
};

export default colors;

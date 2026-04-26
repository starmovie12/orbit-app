/**
 * CROWD WORLD — Design Tokens v4 (Golden Edition)
 *
 * Ye file HTML prototype ke :root CSS variables ke saath 100% sync hai.
 * Agar HTML mein koi color change karo toh yahaan bhi update karna.
 *
 * Source of truth: crowd_world_redesigned.html → :root { ... }
 * Theme: White + Gold premium — CROWN UI ke liye banaya gaya hai.
 */

// ─────────────────────────────────────────────────────────────────────────────
// orbitGold — HTML ke :root variables se seedha match karta hai
// Har key ke saath HTML variable name comment mein diya hai.
// ─────────────────────────────────────────────────────────────────────────────
const orbitGold = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  // --bg: Pure white, main page background
  bg:           "#FFFFFF",

  // --bg-warm: Halka warm white, cards ke peeche use hota hai
  bgWarm:       "#FFFDF8",

  // surface1 ab bgWarm ke saath match karta hai (warm cards)
  surface1:     "#FFFDF8",

  // surface2 = --gold-pale: Gold ka bahut halka tint, highlighted sections mein
  surface2:     "#FFF9EC",

  // surface3: Thoda aur dark warm surface (existing, HTML mein explicit nahi tha)
  surface3:     "#F5EDE0",

  // ── Borders ─────────────────────────────────────────────────────────────────
  // --card-border: Default card border, subtle warm beige
  borderSubtle: "#EDE3CC",

  // --gold-border: Gold ke saath koi bhi highlighted border/divider ke liye
  goldBorder:   "#E2C660",

  // borderStrong: Inputs aur strong dividers ke liye (HTML explicit nahi, kept)
  borderStrong: "#D4BFA0",

  // ── Text ────────────────────────────────────────────────────────────────────
  // --text: Sabse dark, primary headings aur main content
  textPrimary:  "#0D0800",

  // --text-mid: Mid-level text, subtitles, secondary labels
  textSecond:   "#6B5330",

  // --text-soft: Soft hints, placeholders, captions
  textTertiary: "#A0875A",

  // Inverse text: Dark backgrounds par white text
  textInverse:  "#FFFFFF",

  // ── Gold Accent — Primary Brand Color ───────────────────────────────────────
  // --gold: Main brand gold, buttons, highlights, active states
  accent:          "#C9A227",

  // --gold-deep: Hover/pressed state ka darker gold
  accentHover:     "#9A7A18",

  // --gold-light: Shimmer, badge glow, decorative gold text
  goldLight:       "#E8CC6A",

  // --gold-pale → accentSoftSolid: Gold ka bahut pale solid tint
  // Chip backgrounds, selected state ke liye perfect
  accentSoftSolid: "#FFF9EC",

  // Transparent gold: Overlays, icon backgrounds (10% opacity)
  // Note: rgba mein --gold (#C9A227 = rgb(201, 162, 39)) use kiya
  accentSoft:      "rgba(201,162,39,0.10)",

  // ── Shadows ─────────────────────────────────────────────────────────────────
  // --shadow-gold: Gold glow shadow, CTAs aur premium cards ke neeche
  shadowGold:   "0 4px 16px rgba(201,162,39,0.40)",

  // ── Semantic Colors ─────────────────────────────────────────────────────────
  // HTML mein --success, --danger, --live diye hain — exactly same rakhe
  // Online dots, cashout success
  success:      "#22C55E",
  successSoft:  "rgba(34,197,94,0.12)",

  // Warnings (in-app alerts)
  warning:      "#E8A93A",
  warningSoft:  "rgba(232,169,58,0.12)",

  // --danger: Errors, unread badges, destructive actions
  danger:       "#EF4444",
  dangerSoft:   "rgba(239,68,68,0.12)",

  // ── Absolute Colors ──────────────────────────────────────────────────────────
  // Kuch jagah pe hard-coded white/black chahiye hota hai
  white: "#FFFFFF",
  black: "#000000",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// orbitDark — Dark mode ke liye (HTML prototype dark mode nahi deta,
// toh existing dark tokens preserve kiye hain)
// ─────────────────────────────────────────────────────────────────────────────
const orbitDark = {
  bg:           "#0A0A0B",
  bgWarm:       "#0D0900",    // Dark mein warm tint
  surface1:     "#131316",
  surface2:     "#1C1C20",
  surface3:     "#26262C",
  borderSubtle: "#1F1F24",
  goldBorder:   "#3A2E00",    // Dark surface pe gold border
  borderStrong: "#2E2E35",
  textPrimary:  "#F5F5F7",
  textSecond:   "#A1A1AA",
  textTertiary: "#6B6B73",
  textInverse:  "#0A0A0B",
  accent:          "#C9A227",  // Same gold, dark mein bhi brand consistent
  accentHover:     "#9A7A18",
  goldLight:       "#E8CC6A",
  accentSoftSolid: "#2A1F0A",
  accentSoft:      "rgba(201,162,39,0.10)",
  shadowGold:      "0 4px 16px rgba(201,162,39,0.40)",
  success:      "#2BB673",
  successSoft:  "rgba(43,182,115,0.12)",
  warning:      "#E8A93A",
  warningSoft:  "rgba(232,169,58,0.12)",
  danger:       "#EF4444",
  dangerSoft:   "rgba(239,68,68,0.12)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

// orbitLight ab orbitGold ko point karta hai (same hi hai dono)
const orbitLight = orbitGold;

// Default export — app ka default theme = golden white
export const orbit = orbitGold;

// ─────────────────────────────────────────────────────────────────────────────
// makePalette — OrbitTokens ko flat React Navigation / Themed hook format mein
// convert karta hai. orbitGold ke naye keys yahaan map kiye.
// ─────────────────────────────────────────────────────────────────────────────
function makePalette(o: typeof orbitGold) {
  return {
    // Core layout
    text:                o.textPrimary,
    tint:                o.accent,
    background:          o.bg,
    foreground:          o.textPrimary,

    // Cards
    card:                o.surface1,
    cardForeground:      o.textPrimary,

    // Primary action (buttons, FABs)
    primary:             o.accent,
    primaryForeground:   o.textInverse,

    // Secondary elements
    secondary:           o.surface2,
    secondaryForeground: o.textSecond,

    // Muted / disabled
    muted:               o.surface2,
    mutedForeground:     o.textTertiary,

    // Accent chip backgrounds
    accent:              o.surface2,
    accentForeground:    o.textPrimary,

    // Destructive
    destructive:         o.danger,
    destructiveForeground: o.white,

    // Borders & inputs
    border:              o.borderSubtle,
    goldBorder:          o.goldBorder,   // HTML --gold-border directly accessible
    input:               o.borderStrong,

    // Surfaces
    surface:             o.surface1,
    surface2:            o.surface2,
    surface3:            o.surface3,

    // Shadows
    shadowGold:          o.shadowGold,   // HTML --shadow-gold directly accessible

    // Text aliases
    sub:                 o.textSecond,

    // Semantic color shorthands
    blueLight:           o.accent,
    green:               o.success,
    red:                 o.danger,
    gold:                o.accent,        // --gold direct alias
    goldDeep:            o.accentHover,   // --gold-deep direct alias
    goldLight:           o.goldLight,     // --gold-light direct alias
    goldPale:            o.accentSoftSolid, // --gold-pale direct alias
    yellow:              o.warning,
    purple:              o.accent,

    // Full token object access chahiye toh
    orbit:               o,
  } as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main colors export — useColors() hook is ko use karta hai
// ─────────────────────────────────────────────────────────────────────────────
const colors = {
  dark:   makePalette(orbitDark),
  light:  makePalette(orbitLight),
  radius: 12,
} as const;

export default colors;
export { orbitDark, orbitLight, orbitGold };

// ── TypeScript Types ─────────────────────────────────────────────────────────
// Ye types preserve kiye hain — koi bhi key add ho toh yahan automatic aayega
export type OrbitTokens  = typeof orbitGold;
export type ColorPalette = ReturnType<typeof makePalette>;

/**
 * CROWN Tab / Rank Screen — Design Tokens  (LIGHT · CIVIC GOLD CREAM)
 * ────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the CROWN-tab visual system. Every value here is
 * lifted directly from the app's home-screen palette (`@/constants/colors`)
 * so the CROWN tab matches the Home screen 1:1.
 *
 *   • Screen background : WHITE  (#FFFFFF)            — colors.bg.surface
 *   • Card / surface    : CREAM  (#F7ECD0)            — colors.bg.card (cream[200])
 *   • Brand             : DARK GOLD (#D4A017)         — colors.fg.brand (gold[600])
 *   • Accent            : BURNISHED AMBER (#D4651A)   — colors.fg.warning (amber[600])
 *   • Text              : WARM INK (#1A1A1A)          — colors.fg.primary (ink[950])
 *
 * NO pure black. NO OLED/navy dark surfaces. NO raw hex in component code —
 * every component imports from this file exclusively (CROWN LAW 2).
 *
 * Export names are kept stable (`COLORS_DARK`, `FONTS`, …) so the component
 * layer needs no edits; only the VALUES changed (dark → light/cream).
 * `COLORS` and `COLORS_LIGHT` are provided as aliases of the same object.
 */

// ── TYPOGRAPHY ────────────────────────────────────────────────────────────────
// Font family strings MUST match the families loaded via useFonts() in
// app/_layout.tsx (Inter + Syne + Space Mono). See @/constants/typography.

export const FONTS = {
  /** Syne 700 — Screen titles, tier names, Decision Prompt headers */
  display: 'Syne_700Bold',
  /** Syne 800 — Heaviest display (large rank / leaderboard numerals fallback) */
  displayAlt: 'Syne_800ExtraBold',
  /** Space Mono 700 — ALL numbers: rank positions, credits, bids, countdowns */
  numeric: 'SpaceMono_700Bold',
  /** Inter 400 — Body text, labels, sub-labels */
  body: 'Inter_400Regular',
  /** Inter 500 — Slightly emphasised body */
  bodyMedium: 'Inter_500Medium',
  /** Inter 600 — Labels, meta, captions */
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const FONT_SIZES = {
  /** 28px — CROWN wordmark, screen title */
  hero: 28,
  /** 24px — Decision Prompt tier sub-header */
  heroSub: 24,
  /** 20px — Tier name: "BARON of Sector 35, Chandigarh" */
  title: 20,
  /** 36px — Decision Prompt bid amount */
  bidDisplay: 36,
  /** 32px — Primary rank number in CROWN tab rank cards */
  rankBig: 32,
  /** 22px — Secondary tier rank number */
  rankSecondary: 22,
  /** 18px — Countdown timer digits */
  countdown: 18,
  /** 16px — Credits amounts */
  credits: 16,
  /** 15px — Card body text */
  body: 15,
  /** 13px — Sub-labels, timestamps, secondary info */
  sub: 13,
  /** 12px — Chip / badge labels, section-header caps */
  chip: 12,
  /** 11px — Micro labels */
  micro: 11,
} as const;

// ── COLOR TOKENS (LIGHT · CREAM — sourced from home palette) ──────────────────
// Kept under the name COLORS_DARK so the component layer is untouched; the
// values are the LIGHT home-screen palette. Use COLORS / COLORS_LIGHT aliases
// in new code for clarity.

export const COLORS_LIGHT = {
  /** #FFFFFF — Page background / scroll area (white) · colors.bg.surface */
  bgSurface: '#FFFFFF',
  /** #F7ECD0 — Cards, panels, bid rows (cream) · colors.bg.card · cream[200] */
  bgCard: '#F7ECD0',
  /** #FFF9EC — Decision Prompt, bottom sheets (warm ivory, elevated) · cream[50] */
  bgElevated: '#FFF9EC',

  /** #D4A017 — Brand dark gold: rank numbers, progress fill, active badges, CTA bg · gold[600] */
  fgBrand: '#D4A017',
  /** #E2C66B — Lighter gold: glow rings on title-holder, decorative highlights · gold[400] */
  fgBrandLight: '#E2C66B',

  /** #1A1A1A — Primary labels, rank position numbers, tier names (warm ink, NOT pure black) · ink[950] */
  fgTextStrong: '#1A1A1A',
  /** #6B5B2E — Sub-labels, timestamps, secondary text (espresso) · ink[600] */
  fgTextMuted: '#6B5B2E',
  /** #A89A85 — Quaternary text, disabled labels · ink[400] */
  fgTextDisabled: '#A89A85',

  /** #D4651A — Battle Hour pulse dot, heat indicator, urgency labels, sleep warnings (Burnished Amber) · amber[600] */
  fgAccentOrange: '#D4651A',

  /** #10B981 — Positive delta arrows, credits earned, success states · emerald[600] */
  fgSuccess: '#10B981',
  /** #EF4444 — Report penalties, Trust Score drop, danger timer · crimson[600] */
  fgDanger: '#EF4444',

  /** #E8D5A0 — Card borders, dividers (subtle cream hairline) · cream[400] */
  borderSubtle: '#E8D5A0',
  /** rgba(212,160,23,0.4) — Gold card border for title-holder hero · gold[600] @ 40% */
  borderGold: 'rgba(212,160,23,0.4)',
  /** #D4651A — Battle Hour card border (2px + glow) · amber[600] */
  borderBattleHour: '#D4651A',

  /** Shimmer gradient stops for skeleton / held-milestone shimmer (warm gold sweep on cream) */
  shimmerBase: 'rgba(212,160,23,0.08)',
  shimmerPeak: 'rgba(212,160,23,0.22)',
} as const;

/** Primary export consumed by every component. LIGHT values (name kept stable). */
export const COLORS_DARK = COLORS_LIGHT;

/** Clear alias for new code. */
export const COLORS = COLORS_LIGHT;

// ── SPACING (4px base grid — aligns with home 8pt grid) ───────────────────────

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16, // standard card padding L/R
  lg: 20,
  xl: 24, // section-to-section gap
  xxl: 32, // screen top padding
} as const;

// ── BORDER RADIUS ─────────────────────────────────────────────────────────────

export const RADIUS = {
  xs: 2,
  sm: 4,
  md: 6,
  base: 8,
  card: 12, // standard cards, phase panel (home radii.md)
  modal: 16, // decision prompt, bottom sheets (home radii.lg)
  xl: 24,
  dais: 28,
  pill: 999, // progress bar track, avatars, badges
} as const;

// ── MOTION (ms) ───────────────────────────────────────────────────────────────

export const MOTION = {
  /** 150ms — rank tick animation, digit exit/enter */
  micro: 150,
  /** 200ms — tab slide, base transitions */
  fast: 200,
  /** 300ms — modal entry, phase chip crossfade */
  base: 300,
  /** 400ms — stagger total for 4 rank cards appearing */
  medium: 400,
  /** 600ms — progress bar fill, border phase change */
  slow: 600,
  /** 1500ms — shimmer loop */
  shimmer: 1500,
  /** 2500ms — progress bar shimmer on held milestone */
  progressShimmer: 2500,
  /** 6000ms — leader ring rotation */
  ringRotation: 6000,
} as const;

export const EASING = {
  rankTick: [0.4, 0, 0.6, 1] as [number, number, number, number],
  progressFill: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  flipIn: [0.55, 0.055, 0.675, 0.19] as [number, number, number, number],
  flipOut: [0.215, 0.61, 0.355, 1] as [number, number, number, number],
  springOvershoot: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
} as const;

export const SPRING_PRESETS = {
  /** Decision Prompt modal entry */
  decisionEntry: { mass: 1, stiffness: 280, damping: 25 },
  /** Rank cards Battle Hour reveal */
  rankReveal: { mass: 1, stiffness: 200, damping: 20 },
  /** Tab indicator */
  glassIsland: { mass: 1, stiffness: 200, damping: 24 },
} as const;

// ── Z-INDEX SCALE ─────────────────────────────────────────────────────────────

export const Z_INDEX = {
  base: 0,
  raised: 10,
  stickyHeader: 20,
  yourRankCard: 30,
  glassIsland: 50,
  modal: 400,
  decisionPrompt: 500,
  toast: 600,
} as const;

// ── LAYOUT ────────────────────────────────────────────────────────────────────

/** Primary design viewport (px). */
export const VIEWPORT_BASE = 380;

/** Min touch target — Apple HIG / Material. */
export const TOUCH_TARGET = 44;

export const SCREEN_HEADER_HEIGHT = 56;
export const BOTTOM_NAV_HEIGHT = 56;
export const BOTTOM_NAV_OFFSET = 20;

// ── TIER META ─────────────────────────────────────────────────────────────────

export const TIER_META = {
  baron: {
    emoji: '🏘️',
    label: 'BARON',
    scope: 'Sector',
  },
  viceroy: {
    emoji: '🏙️',
    label: 'Mayor (VICEROY)',
    scope: 'City',
  },
  sovereign: {
    emoji: '🇮🇳',
    label: 'SOVEREIGN',
    scope: 'Country',
  },
  imperator: {
    emoji: '🌍',
    label: 'IMPERATOR',
    scope: 'World',
  },
} as const;

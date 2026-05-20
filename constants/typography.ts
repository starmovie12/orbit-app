/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   CROWN — Typography Token System                                        ║
 * ║   Version: v3.0  (PRD §19.3 — Syne / Inter / Space Mono triple stack)  ║
 * ║   Philosophy: Champagne Gold · Warm Ivory · Refined Espresso            ║
 * ║                                                                          ║
 * ║   Generated: 29 April 2026 · Chandigarh · Owner: Ail (Founder)         ║
 * ║   Companion to: Part 1 + Part 2 + Part 3 Blueprints                    ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║   FONT FAMILIES (PRD §19.3 exact)                                        ║
 * ║     Syne (800 · 700 · 600 · 400) — Headings, wordmark, display          ║
 * ║       Syne_800ExtraBold — CROWN wordmark, H1, hero display              ║
 * ║       Syne_700Bold      — H2 section headings                           ║
 * ║       Syne_600SemiBold  — H3 sub-headings                               ║
 * ║       Syne_400Regular   — Light brand contexts                          ║
 * ║     Inter (400 · 500 · 600 · 700) — All body, UI text, chat messages    ║
 * ║     Space Mono (400 · 700) — Credits, ranks, timers, scores (numerics)  ║
 * ║                                                                          ║
 * ║   INSTALL (run once):                                                    ║
 * ║     npx expo install                                                     ║
 * ║       @expo-google-fonts/syne                                           ║
 * ║       @expo-google-fonts/inter                                          ║
 * ║       @expo-google-fonts/space-mono                                     ║
 * ║                                                                          ║
 * ║   COMPLETE SIZE SCALE (px) — all 18 values per blueprint audit:         ║
 * ║     9  10  11  12  13  14  15  16  17  18  20  22  24  26  28  32  36  40 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║   SEMANTIC STYLE GROUPS                                                  ║
 * ║     A — Display / Hero     : splash, celebration, welcome burst         ║
 * ║     B — Syne Headings      : H1/H2/H3 brand Syne premium moments        ║
 * ║     C — Inter Titles       : screen-level Inter headings                ║
 * ║     D — Body Text          : paragraphs, chat bubbles, descriptions     ║
 * ║     E — Caption            : helper text, disclosures, card subtitles   ║
 * ║     F — Micro / Meta       : timestamps, badges, meta labels            ║
 * ║     G — Input / Form       : field text, OTP, cashout, placeholder      ║
 * ║     H — CTA / Interactive  : button labels, inline links                ║
 * ║     I — Badge / Pill       : status chips, heat score, LIVE badge       ║
 * ║     J — Number / Balance   : wallet hero, stats, counters (Space Mono)  ║
 * ║     K — Chat-specific      : bubbles, sender name, timestamps           ║
 * ║     L — Navigation         : sub-nav tabs, step indicator               ║
 * ║     M — Profile            : display name, handle, bio, stats           ║
 * ║     N — Settings           : rows, section headers, destructive         ║
 * ║     O — Bottom Sheets      : sheet title, row types, cancel             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { TextStyle as RNTextStyle } from "react-native";
import { useFonts as useExpoFonts } from "expo-font";

// ── Syne imports (headings · wordmark · display) ────────────────────────────
import {
  Syne_800ExtraBold,
  Syne_700Bold,
  Syne_600SemiBold,
  Syne_400Regular,
} from '@expo-google-fonts/syne';

// ── Inter imports (body · UI · chat messages) ────────────────────────────────
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

// ── Space Mono imports (credits · ranks · timers · scores) ───────────────────
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — FONT FAMILY CONSTANTS
// fontFamily = exact loaded Google Font identifier string.
// Always pass fontWeight too — some RN bridge versions need both.
// ═══════════════════════════════════════════════════════════════════════════

/** Syne — brand headings, wordmark, display text (PRD §19.3 exact)
 *
 *  bold      → Syne_800ExtraBold — CROWN wordmark, H1, hero display
 *  semiBold  → Syne_700Bold      — H2 section headings, prominent labels
 *  medium    → Syne_600SemiBold  — H3 sub-headings
 *  regular   → Syne_400Regular   — Light brand contexts
 */
export const FONT_HEADING = {
  bold:     "Syne_800ExtraBold",   // weight 800 — CROWN wordmark, H1, hero
  semiBold: "Syne_700Bold",        // weight 700 — H2 headings
  medium:   "Syne_600SemiBold",    // weight 600 — H3 sub-headings
  regular:  "Syne_400Regular",     // weight 400 — light brand contexts
} as const;

/** Inter — all body copy, UI labels, captions, CTAs, inputs, chat messages (PRD §19.3 exact) */
export const FONT_BODY = {
  regular:  "Inter_400Regular",   // weight 400 — default readable body
  medium:   "Inter_500Medium",    // weight 500 — slightly emphasized
  semiBold: "Inter_600SemiBold",  // weight 600 — labels, meta, captions
  bold:     "Inter_700Bold",      // weight 700 — strong UI, headlines
} as const;

/** Space Mono — credits, ranks, timers, scores, numeric displays (PRD §19.3 exact) */
export const FONT_NUMERIC = {
  regular: "SpaceMono_400Regular", // weight 400 — numeric body
  bold:    "SpaceMono_700Bold",    // weight 700 — wallet balance, stats, cashout amounts
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 1.5 — WORDMARK SPEC (PRD §19.3 — CROWN wordmark)
// Syne_800ExtraBold · 22px · letter-spacing -0.5px
// Use for the "CROWN" logotype string in headers, splash, and Glass Island.
// ═══════════════════════════════════════════════════════════════════════════

export const WORDMARK = {
  fontFamily:    FONT_HEADING.bold,     // Syne_800ExtraBold
  fontSize:      22,
  fontWeight:    "800" as const,
  letterSpacing: -0.5,
  lineHeight:    26,                    // Math.round(22 × 1.15 tight)
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — FONT SIZE SCALE
// 18 discrete sizes derived from blueprint audit of all screens.
// Most-used sizes: 11px (132×) · 12px (112×) · 13px (101×) · 14px (82×) · 15px (62×).
// Naming: xs → xxs → sm → cap → base → md → mdLg → lg → lgPlus → xl
//         → h4 → h3 → h2lg → h2 → hero → h1 → inputGiant → display
// ═══════════════════════════════════════════════════════════════════════════

export const FONT_SIZE = {
  /** 9  — Tiny uppercase badge, tag-local, LIVE dot (.tag-local exact) */
  xs:         9,

  /** 10 — Version footer ("CROWD WORLD v1.0.0"), "Made with 💛" micro note */
  xxs:        10,

  /** 11 — Meta labels, timestamps, badge text, step indicator, online counts,
   *       stat labels, heat-pill emoji+number, chat read receipt, Glass Island
   *       tab label. Most-used size in codebase (132 occurrences). */
  sm:         11,

  /** 12 — Helper text, form field captions, privacy disclosure, chat sender name,
   *       "Optional" label, counter "{N}/20", badge chip text, sheet section
   *       headers (uppercase), OTP error messages, settings section headers,
   *       step indicator (blueprint: 12px 600). 2nd most used (112 occurrences). */
  cap:        12,

  /** 13 — Body small: confirmation previews, form field labels (13px 600),
   *       stat banner body, message action sheet preview text, featured subtitle,
   *       settings row value, activity description. 3rd most used (101 occurrences). */
  base:       13,

  /** 14 — Body default: chat bubbles (legacy), ghost CTAs, transaction titles,
   *       profile bio, @username handle, "See All →" links, earning card name,
   *       sub-nav tabs. 4th most used (82 occurrences). */
  md:         14,

  /** 15 — Body medium: settings row label, city/sector names in pickers,
   *       Featured/Trending card titles, mini-card display name, onboarding
   *       subheads, auto-detect card title, action sheet row labels, home-sector
   *       value, sheet row primary. 5th most used (62 occurrences). */
  mdLg:       15,

  /** 16 — Primary CTA button label, bodyXl subheads, cashout "Credits" suffix,
   *       Username input (UPI / Edit Profile), default large input text. */
  lg:         16,

  /** 17 — Intermediate heading (17px used 11× in app screens) */
  lgPlus:     17,

  /** 18 — Section headers ("Abhi Trending", "Recent", "Achievements"),
   *       sheet title ("City chuno"), sub-screen centered title ("Cashout"),
   *       CROWN Pass card title, phone/name input prominence. */
  xl:         18,

  /** 20 — Profile stats value (Credits · Sparks · Days · Sectors count-up) */
  h4:         20,

  /** 22 — Screen primary headlines ("Apna phone number daalo", "Verify karo"),
   *       profile display name, OTP digit boxes, titleLg. */
  h3:         22,

  /** 24 — Cashout success headline "Cashout successful!" (blueprint: 24px 700) */
  h2lg:       24,

  /** 26 — Syne H2: .streak-days exact, premium section titles */
  h2:         26,

  /** 28 — Display / hero headlines: Splash ("Apne sector se zindagi mein rang bharo"),
   *       Welcome Burst ("Welcome, {displayName}!"), Celebration screen. */
  hero:       28,

  /** 32 — Syne H1: large brand geometric hero titles */
  h1:         32,

  /** 36 — Cashout amount input (large number-pad entry "1000") */
  inputGiant: 36,

  /** 40 — Wallet balance hero "12,500" — count-up animation on mount */
  display:    40,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — LINE HEIGHT
// React Native takes absolute pixels, NOT CSS em/multipliers.
// Use the lh() helper to compute: Math.round(fontSize × ratio).
// ═══════════════════════════════════════════════════════════════════════════

export const LINE_HEIGHT_RATIO = {
  /** 1.15 — Headings, numeric displays, badge compact */
  tight:   1.15,
  /** 1.25 — Section titles, CTA buttons, sheet titles */
  snug:    1.25,
  /** 1.45 — Standard body text, chat bubbles (HTML prototype match) */
  normal:  1.45,
  /** 1.5  — Long readable text, help text, bio, privacy disclosure */
  relaxed: 1.5,
  /** 1.6  — Maximum readability, multi-line captions */
  loose:   1.6,
} as const;

/**
 * Compute line height in absolute pixels. Rounds to nearest integer.
 * @param fontSize  — px value
 * @param ratio     — key of LINE_HEIGHT_RATIO (default "normal" = 1.45)
 *
 * @example  lh(16, "relaxed") → 24
 * @example  lh(28, "snug")    → 35
 */
export function lh(
  fontSize: number,
  ratio: keyof typeof LINE_HEIGHT_RATIO = "normal"
): number {
  return Math.round(fontSize * LINE_HEIGHT_RATIO[ratio]);
}

/**
 * @deprecated Multiplier object — kept for backward compat.
 *             Use lh() helper or inline lineHeight in new styles.
 */
export const LINE_HEIGHT = LINE_HEIGHT_RATIO;

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — LETTER SPACING SCALE
// Values in points (React Native). Negative = tighter, Positive = wider.
// ═══════════════════════════════════════════════════════════════════════════

export const LETTER_SPACING = {
  /** -0.5 — Balance hero, cashout input, large numeric displays */
  tightest:  -0.5,
  /** -0.2 — Sub-headings slight tightening */
  tight:     -0.2,
  /** 0    — Default for all body text, CTAs, inputs */
  normal:     0,
  /** 0.3  — City pill labels, card tags (.screen-sub-txt: letter-spacing .3px) */
  wide:       0.3,
  /** 0.5  — Phone number input, brand title (.app-title: .5px, streak labels: .5px) */
  wider:      0.5,
  /** 0.5  — Phone/number input explicit alias (blueprint §4: letter-spacing 0.5) */
  phone:      0.5,
  /** 0.8  — Uppercase badge text (.vd-badge, .flash-badge: letter-spacing .8px) */
  uppercase:  0.8,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 4.5 — FONT WEIGHT MAP
// Named map of fontWeight string values — mirrors the weight keys in FONT_BODY
// and FONT_HEADING. Use for inline fontWeight overrides or style composition.
//
// USAGE:
//   import { fontWeight } from '@/constants/typography';
//   <Text style={{ fontFamily: FONT_BODY.bold, fontWeight: fontWeight.bold }}>
// ═══════════════════════════════════════════════════════════════════════════

export const fontWeight = {
  /** "400" — Default readable body, input placeholder, inactive labels */
  regular:   "400" as const,
  /** "500" — Slightly emphasized text, captions, meta labels, row values */
  medium:    "500" as const,
  /** "600" — Form field labels, section headers, CTA secondary, sheetRow */
  semibold:  "600" as const,
  /** "700" — Strong UI text, screen headlines, primary CTA labels, chat sender */
  bold:      "700" as const,
  /** "800" — Badge text, numeric counts, hero numbers, Syne impact moments */
  extrabold: "800" as const,
} as const;

/**
 * letterSpacing — lowercase camelCase alias of LETTER_SPACING.
 * Exported for API symmetry with `fontWeight` — both are now available
 * in camelCase. The uppercase LETTER_SPACING constant is also retained.
 *
 * @example
 *   import { letterSpacing } from '@/constants/typography';
 *   <Text style={{ letterSpacing: letterSpacing.uppercase }}>LIVE</Text>
 */
export const letterSpacing = LETTER_SPACING;

// ═══════════════════════════════════════════════════════════════════════════
// § 5 — SEMANTIC TYPOGRAPHY STYLES
//
// Every style is a complete React Native TextStyle-compatible object with:
//   { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing }
//
// USAGE:
//   import { typography } from '@/constants/typography';
//   import { t }          from '@/constants/typography';  // shorthand
//
//   <Text style={[typography.titleLg, { color: colors.fg.primary }]}>
//     Apna phone number daalo
//   </Text>
//
//   <Text style={{ ...t.ctaPrimary, color: colors.fg.onBrand }}>
//     Shuru Karo
//   </Text>
// ═══════════════════════════════════════════════════════════════════════════

export const typography = {

  // ══════════════════════════════════════════════════════════════════════════
  // A — DISPLAY / HERO HEADLINES
  // Big emotional moments: Splash · Welcome Burst · Celebration
  // Font: Inter (sans-serif for modern impact on mobile)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * displayHero — 28px 700 Inter · lineHeight 35px
   * Splash headline ("Apne sector se zindagi mein rang bharo"),
   * Welcome Burst headline ("Welcome, {name}!"), any hero-level copy.
   * Blueprint ref: §3 [4.A] 28px 700 Display line-height 36px ·
   *                §8 [1.B] 28px 700 Display ink-950 centered
   */
  displayHero: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.hero,          // 28
    fontWeight:    "700" as const,
    lineHeight:    lh(28, "snug"),           // 35
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * displayCelebration — 28px 700 Inter · tight leading
   * Welcome Burst "Welcome, Bittu!" — tight leading maximises visual punch.
   * Blueprint ref: §8 [1.B] 28px 700 Display ink-950 centered
   */
  displayCelebration: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.hero,          // 28
    fontWeight:    "700" as const,
    lineHeight:    lh(28, "tight"),          // 32
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * displaySm — 24px 700 Inter · lineHeight 30px
   * Cashout success screen headline "Cashout successful!",
   * any mid-level celebratory copy.
   * Blueprint ref: §10 Cashout [6] headline 24px 700 ink-950 centered
   */
  displaySm: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.h2lg,          // 24
    fontWeight:    "700" as const,
    lineHeight:    lh(24, "snug"),           // 30
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // B — SYNE HEADINGS (brand geometric sans · premium moments)
  // Use sparingly: CROWN Pass cards, streak widgets, key brand titles.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * h1 — 32px 800 Syne · lineHeight 40px
   * Hero brand titles, large CROWN Pass name, high-impact Syne display moments.
   * PRD §19.3: Syne_800ExtraBold — headings/wordmark/display.
   */
  h1: {
    fontFamily:    FONT_HEADING.bold,            // Syne_800ExtraBold
    fontSize:      FONT_SIZE.h1,                // 32
    fontWeight:    "800" as const,
    lineHeight:    lh(32, "snug"),              // 40
    letterSpacing: LETTER_SPACING.wide,         // 0.3 — brand title tracking
  },

  /**
   * h2 — 26px 700 Syne · lineHeight 33px
   * Premium section headings, streak-days (.streak-days: 26px exact match).
   * PRD §19.3: Syne_700Bold.
   */
  h2: {
    fontFamily:    FONT_HEADING.semiBold,
    fontSize:      FONT_SIZE.h2,            // 26
    fontWeight:    "700" as const,
    lineHeight:    lh(26, "snug"),           // 33
    letterSpacing: LETTER_SPACING.wide,      // 0.3
  },

  /**
   * h3 — 22px 600 Syne · lineHeight 28px
   * Card titles, modal headers, tertiary Syne headings.
   * PRD §19.3: Syne_600SemiBold.
   */
  h3: {
    fontFamily:    FONT_HEADING.medium,
    fontSize:      FONT_SIZE.h3,            // 22
    fontWeight:    "600" as const,
    lineHeight:    lh(22, "snug"),           // 28
    letterSpacing: LETTER_SPACING.wide,      // 0.3
  },

  // ══════════════════════════════════════════════════════════════════════════
  // C — INTER SCREEN TITLES
  // All primary screen-level headings — Inter for native mobile feel.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * titleLg — 22px 700 Inter · lineHeight 28px
   * Primary onboarding screen headlines:
   *   "Apna phone number daalo" · "Verify karo" ·
   *   "Apne baare mein batao" · "Apna sector chuno"
   * Blueprint ref: §4 [2.A] 22px 700 Title line-height 28px
   */
  titleLg: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.h3,            // 22
    fontWeight:    "700" as const,
    lineHeight:    lh(22, "snug"),           // 28 — blueprint exact
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * titleMd — 18px 700 Inter · lineHeight 23px
   * Section headers ("Abhi Trending", "Recent", "Achievements"),
   * bottom-sheet titles ("City chuno"), sub-screen push titles ("Cashout",
   * "Edit Profile"), CROWN Pass card primary title.
   * Blueprint ref: §9 [3.C] · §10 [4] · §16 [2] · §10 Cashout [1] · §13 [1]
   */
  titleMd: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.xl,            // 18
    fontWeight:    "700" as const,
    lineHeight:    lh(18, "snug"),           // 23
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * titleSm — 16px 700 Inter · lineHeight 20px
   * Small sub-headings, minor card heading emphasis.
   * Blueprint ref: Various 16px 700 usages across screens
   */
  titleSm: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.lg,            // 16
    fontWeight:    "700" as const,
    lineHeight:    lh(16, "snug"),           // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * titleProfile — 22px 700 Inter · lineHeight 25px (tighter for names)
   * Profile display name on Own Profile / Other User Profile.
   * Blueprint ref: §11 [2.B] "Bittu" 22px 700 ink-950 ·
   *                §12 [2.B] "Aman" 22px 700 ink-950
   */
  titleProfile: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.h3,            // 22
    fontWeight:    "700" as const,
    lineHeight:    lh(22, "tight"),          // 25 — names look tighter
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // D — BODY TEXT (Inter · reading-optimised)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * bodyXl — 16px 400 Inter · lineHeight 24px
   * Large subheadlines: Splash subhead, Welcome subhead, section intros.
   * Blueprint ref: §3 [4.B] 16px 400 Body Large line-height 24px ·
   *                §8 [1.C] 16px 400 ink-600 max 2 lines
   */
  bodyXl: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.lg,            // 16
    fontWeight:    "400" as const,
    lineHeight:    lh(16, "relaxed"),        // 24 — blueprint exact
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodyLg — 15px 400 Inter · lineHeight 23px
   * Settings row body, onboarding subhead ("OTP bhejenge verify karne ke liye"),
   * sector description text, auto-detect card subtitle.
   * Blueprint ref: §4 [2.B] 15px 400 line-height 22px ·
   *                §14 row label (regular weight variant)
   */
  bodyLg: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "400" as const,
    lineHeight:    lh(15, "relaxed"),        // 23
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodyLgMedium — 15px 500 Inter · lineHeight 22px
   * Featured card subtitle (meta) variant, inline row descriptions.
   * Blueprint ref: §9 [3.A] card subtitle 12px 500 → use for 15px weight variant
   */
  bodyLgMedium: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "500" as const,
    lineHeight:    lh(15, "normal"),         // 22
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodyLgBold — 15px 700 Inter · lineHeight 22px
   * Auto-detect card primary title ("Auto-detect karo"),
   * Featured/Trending card sector name, sheet row primary name variant.
   * Blueprint ref: §7 [3.A] auto-detect title 15px 700 ·
   *                §9 [3.A] featured card "Sector 17, Chandigarh" 15px 700
   */
  bodyLgBold: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "700" as const,
    lineHeight:    lh(15, "normal"),         // 22
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * body — 14px 400 Inter · lineHeight 20px
   * Default body text, profile bio, standard readable text blocks.
   * Legacy chat bubble size (v1 HTML prototype).
   * Blueprint ref: §11 [2.D] bio 14px 400 ink-600
   */
  body: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "400" as const,
    lineHeight:    lh(14, "normal"),         // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodyMedium — 14px 500 Inter · lineHeight 20px
   * Profile @username handle, card subtitles (medium weight),
   * input placeholder text, cashout quick chip labels.
   * Blueprint ref: §11 [2.B] "@bittu_42" 14px 500 ink-500
   */
  bodyMedium: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "500" as const,
    lineHeight:    lh(14, "normal"),         // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodyBold — 14px 700 Inter · lineHeight 20px
   * Transaction titles, earning display name, strong row text,
   * heat map sector names.
   * Blueprint ref: §10 [5] transaction title 14px 600/700 ·
   *                §9 [3.F] heat map 14px 600 ink-950
   */
  bodyBold: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "700" as const,
    lineHeight:    lh(14, "normal"),         // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodySm — 13px 400 Inter · lineHeight 20px
   * Confirmation preview ("Tum Sector 17 mein hoge"), small descriptions,
   * message action sheet preview text (italic applied inline via fontStyle).
   * Blueprint ref: §7 [5.C] 13px 400 ink-600 centered · §18 [2] preview 13px
   */
  bodySm: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.base,          // 13
    fontWeight:    "400" as const,
    lineHeight:    lh(13, "relaxed"),        // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodySmMedium — 13px 500 Inter · lineHeight 20px
   * Earning text "1,250 Credits earned today!", featured card subtitle,
   * security strip text, settings row value.
   * Blueprint ref: §9 [3.H] earning 13px 500 amber-600 ·
   *                §10 Cashout [4] security text 12px 500 (use captionMedium)
   */
  bodySmMedium: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.base,          // 13
    fontWeight:    "500" as const,
    lineHeight:    lh(13, "relaxed"),        // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * bodySmBold — 13px 600 Inter · lineHeight 19px
   * Form field label (the most-used pattern in entire app: 13px 600 ink-600),
   * stat banner body "234 yahan abhi online · jaake hi karo!".
   * Blueprint ref: §4 [3.A] "Phone number" label 13px 600 ink-600 ·
   *                §6 [4.A] "Aapka naam" 13px 600 · §8 [1.D] 13px 600 ink-950
   */
  bodySmBold: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.base,          // 13
    fontWeight:    "600" as const,
    lineHeight:    lh(13, "normal"),         // 19
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // E — CAPTION TEXT (12px · small support text · Inter)
  // Form helpers · privacy notes · card subtitles · sheet section headers
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * caption — 12px 400 Inter · lineHeight 18px
   * Helper text below inputs, privacy disclosure, "Optional" avatar label,
   * OTP error message, masked phone display, step context labels.
   * Blueprint ref: §4 [3.C] helper 12px 400 ink-500 ·
   *                §3 [5.C] peek link 12px 500 (use captionMedium) ·
   *                §5 [3.B] error 12px 400 crimson-600
   */
  caption: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "400" as const,
    lineHeight:    lh(12, "relaxed"),        // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * captionMedium — 12px 500 Inter · lineHeight 18px
   * Card subtitles ("City Center · 234 online"), sector count in city picker
   * ("56 sectors"), colony tag, UPI helper text, transaction timestamp,
   * settings mini-card @username, masked phone in OTP screen.
   * Blueprint ref: §9 [3.A] subtitle 12px 500 ink-600 ·
   *                §16 [5] sector count 12px 500 ink-500 ·
   *                §10 [5] transaction timestamp 12px 400 → 500 preferred
   */
  captionMedium: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "500" as const,
    lineHeight:    lh(12, "relaxed"),        // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * captionBold — 12px 600 Inter · lineHeight 17px · wide tracking
   * Settings section category headers ("PRIVACY & SAFETY", "ACCOUNT"),
   * sheet alphabetical section headers ("A" "B" "C"),
   * step indicator "1 / 5" in onboarding header.
   * Blueprint ref: §14 [3.A] section header 12px 600 uppercase ·
   *                §16 [5] alphabetical header 12px 600 uppercase ·
   *                §4 [1.C] step indicator 12px 600 ink-600
   */
  captionBold: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "600" as const,
    lineHeight:    lh(12, "normal"),         // 17
    letterSpacing: LETTER_SPACING.wide,      // 0.3 — uppercase context
  },

  /**
   * captionStrong — 12px 700 Inter · lineHeight 14px (badge tight)
   * Profile badge chip text ("👑 Mayor of Sector 17", "Founder", "CROWN"),
   * heat pill text ("🔥 87" in gradient pill).
   * Blueprint ref: §11 [2.C] badge chip 12px 700 ·
   *                §17 [5] heat pill 12px 700 white
   */
  captionStrong: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "700" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // F — MICRO / META TEXT (11px and 10px · Inter · smallest readable text)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * meta — 11px 600 Inter · lineHeight 17px · wide tracking
   * Meta labels, pill tag labels, city status bar, quick action labels
   * (wallet 4-column quick actions: "Cashout" / "History" / "CROWN Pass" / "Earn"),
   * wallet min-cashout note ("Min 500 Credits = ₹50 cashout").
   * Blueprint ref: §10 [3] quick action label 11px 600 ink-950 ·
   *                HTML .meta = 11px/600, .screen-sub-txt = 11px/600/.3px
   */
  meta: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "600" as const,
    lineHeight:    lh(11, "relaxed"),        // 17
    letterSpacing: LETTER_SPACING.wide,      // 0.3 — .screen-sub-txt exact
  },

  /**
   * metaMedium — 11px 500 Inter · lineHeight 17px
   * Status badge text ("Completed" / "Pending" / "Failed"),
   * stat labels below value ("Credits" · "Sparks" · "Days" · "Sectors"),
   * wallet min note, online count in heat-map rows ("234 online"),
   * achievements progress fraction "{N}/{Total}".
   * Blueprint ref: §10 [5] status badge 11px 500 · §11 [3] stat label 11px 500
   */
  metaMedium: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "500" as const,
    lineHeight:    lh(11, "relaxed"),        // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * metaRegular — 11px 400 Inter · lineHeight 17px
   * Activity timestamps ("2 hours ago", "Yesterday"),
   * auto-redirect countdown ("Auto-redirect in 3s…"),
   * online count in raw text contexts,
   * chat read-receipt text, Glass Island tab label (inactive).
   * Blueprint ref: §8 [1.E] "Auto-redirect in 3s…" 11px 400 ·
   *                §11 [6] activity timestamp 11px 400 ink-500
   */
  metaRegular: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "400" as const,
    lineHeight:    lh(11, "relaxed"),        // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * metaBold — 11px 700 Inter · tight leading · uppercase tracking
   * LIVE badge text ("🔴 LIVE" inside amber pill),
   * Glass Island active tab label (when text is shown alongside icon).
   * Blueprint ref: §9 [3.A] LIVE badge "11px 600 white" → 700 for impact
   */
  metaBold: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "700" as const,
    lineHeight:    lh(11, "tight"),          // 13
    letterSpacing: LETTER_SPACING.uppercase, // 0.8 — badge caps tracking
  },

  /**
   * label — 11px 700 Inter · lineHeight 16px · wider tracking
   * Nav tab labels, city status bar text, uppercase nav labels.
   * ⚠️ LEGACY (v1.0) — kept for backward compatibility with existing components.
   *    Prefer metaBold (badges) or meta (labels) for new code.
   * Blueprint ref: §2 nav tab labels · HTML .city-status-bar (11px/700/0.5px)
   */
  label: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "700" as const,
    lineHeight:    lh(11, "normal"),         // 16
    letterSpacing: LETTER_SPACING.wider,     // 0.5 — uppercase labels
  },

  /**
   * footerNote — 10px 400 Inter · lineHeight 16px
   * Settings version footer ("CROWD WORLD v1.0.0 (build 123)"),
   * "Made with 💛 in Chandigarh" tagline.
   * Blueprint ref: §14 [4] app footer 11px → 10px for non-critical micro text
   */
  footerNote: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.xxs,           // 10
    fontWeight:    "400" as const,
    lineHeight:    lh(10, "relaxed"),        // 15
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // G — INPUT / FORM TEXT (Inter · form field optimised)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * inputXl — 18px 600 Inter · tight leading · phone letter-spacing
   * Phone number entry input (18px 600 ink-950, letterSpacing 0.5).
   * Blueprint ref: §4 [3.B] "font: 18px 600 ink-950 · letter-spacing 0.5"
   */
  inputXl: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.xl,            // 18
    fontWeight:    "600" as const,
    lineHeight:    lh(18, "tight"),          // 21
    letterSpacing: LETTER_SPACING.phone,     // 0.5 — phone number readability
  },

  /**
   * inputXlName — 18px 600 Inter · tight leading · no extra tracking
   * Display name input — same weight as phone but without phone tracking.
   * Bio textarea input.
   * Blueprint ref: §6 [4.B] 18px 600 ink-950 (no letter-spacing spec'd)
   */
  inputXlName: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.xl,            // 18
    fontWeight:    "600" as const,
    lineHeight:    lh(18, "tight"),          // 21
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * inputOtp — 22px 700 Inter · tight leading
   * OTP digit boxes — 6 × 52×52 boxes, one digit each, centered.
   * Blueprint ref: §5 [3.A] "22px 700 ink-950 centered"
   */
  inputOtp: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.h3,            // 22
    fontWeight:    "700" as const,
    lineHeight:    lh(22, "tight"),          // 25
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * inputGiant — 36px 700 Space Mono · tight leading · tightest tracking
   * Cashout amount input ("1000"), primary large number-pad entry.
   * PRD §19.3: Space Mono for numeric inputs (credits/amounts).
   * Blueprint ref: §10 Cashout [2] "Input field: 36px 700 ink-950"
   */
  inputGiant: {
    fontFamily:    FONT_NUMERIC.bold,
    fontSize:      FONT_SIZE.inputGiant,    // 36
    fontWeight:    "700" as const,
    lineHeight:    lh(36, "tight"),          // 41
    letterSpacing: LETTER_SPACING.tightest,  // -0.5
  },

  /**
   * inputPlaceholder — 15px 400 Inter · tight leading
   * Most input placeholders ("98765 43210" in phone field).
   * NOTE: Name/bio field placeholder uses 18px 400 — apply inputXlName with
   *       reduced opacity instead for those.
   * Blueprint ref: §4 [3.B] placeholder "15px 400 ink-500"
   */
  inputPlaceholder: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "400" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * inputUpi — 16px 600 Inter · tight leading
   * UPI handle input ("yourname@upi"), username field in Edit Profile.
   * Blueprint ref: §10 Cashout [3] "16px 600 ink-950" UPI input
   */
  inputUpi: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.lg,            // 16
    fontWeight:    "600" as const,
    lineHeight:    lh(16, "tight"),          // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * inputCounter — 11px 400 Inter · tight leading
   * In-field character counter "{N}/20", visible while typing,
   * turns gold-600 when approaching limit (18-20 chars).
   * Blueprint ref: §6 [4.B] "{N}/20" 11px 400 ink-500
   */
  inputCounter: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "400" as const,
    lineHeight:    lh(11, "tight"),          // 13 — compact inside input
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // H — CTA / BUTTON / INTERACTIVE TEXT (Inter)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * ctaPrimary — 16px 700 Inter · tight leading
   * Large Primary CTA label (54px-tall 100%-width buttons):
   *   "Shuru Karo" · "Continue" · "Chalo · Sector mein le chalo!" ·
   *   "Confirm Cashout · ₹{amount}" · "Wapas Wallet" · "Let's Go"
   * Blueprint ref: §3 [5.A] 16px 700 · §4 [5.A] 16px 700 · all 54px CTAs
   */
  ctaPrimary: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.lg,            // 16
    fontWeight:    "700" as const,
    lineHeight:    lh(16, "tight"),          // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * ctaSecondary — 14px 600 Inter · tight leading
   * Secondary ghost CTA labels: "Account hai? Sign In karo",
   * medium secondary buttons (36px tall).
   * Blueprint ref: §3 [5.B] 14px 600 · §7 [3.A] "Use Location" variant
   */
  ctaSecondary: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "600" as const,
    lineHeight:    lh(14, "tight"),          // 16
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * ctaLink — 14px 600 Inter · tight leading
   * Gold inline links: "See All →", resend OTP (active state),
   * "See All Activity", "See All Sectors", Help link.
   * Blueprint ref: §9/10 "See All →" 14px 600 gold-700 ·
   *                §5 [4.A] resend active 14px 600 gold-700 underlined
   */
  ctaLink: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "600" as const,
    lineHeight:    lh(14, "tight"),          // 16
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * ctaLinkLg — 15px 600 Inter · tight leading
   * Header text-buttons: "Cancel" (left) · "Save" (right gold-700)
   * in Edit Profile sub-screen header.
   * Blueprint ref: §13 [1.A/C] "Cancel" / "Save" 15px 600 in header
   */
  ctaLinkLg: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "600" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * ctaLinkSm — 12px 500 Inter · lineHeight 18px
   * Small inline links: "Pehle Chandigarh dekho · sign up baad mein" (peek),
   * privacy "Terms & Privacy" tappable within caption text.
   * Blueprint ref: §3 [5.C] 12px 500 ink-500 · §4 [5.B] privacy 12px 400
   */
  ctaLinkSm: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "500" as const,
    lineHeight:    lh(12, "relaxed"),        // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // I — BADGE / PILL / CHIP TEXT (Inter · compact label styles)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * badge — 9px 700 Inter · uppercase tracking
   * Tiny uppercase badges: tag-local, flash-badge, vd-badge (HTML 9px exact).
   * Blueprint ref: §2 badge pattern (.tag-local: 9px 800 .8px tracking)
   * Note: Inter max in FONT_BODY is 700Bold — use bold for impact.
   */
  badge: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.xs,            // 9
    fontWeight:    "700" as const,
    lineHeight:    lh(9, "relaxed"),         // 14
    letterSpacing: LETTER_SPACING.uppercase, // 0.8
  },

  /**
   * badgeMd — 11px 700 Inter · tight leading · uppercase tracking
   * LIVE badge text ("🔴 LIVE" in amber pill),
   * Heat badge label ("🔥 87"),
   * active indicator badge text.
   * Blueprint ref: §9 [3.A] LIVE badge "11px 600 white" → 700 for punch
   */
  badgeMd: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "700" as const,
    lineHeight:    lh(11, "tight"),          // 13
    letterSpacing: LETTER_SPACING.uppercase, // 0.8
  },

  /**
   * badgeLg — 12px 700 Inter · tight leading
   * Transaction status badge text ("Completed" · "Pending" · "Failed"),
   * profile identity chip text ("👑 Mayor", "Founder", "CROWN").
   * Blueprint ref: §10 [5] status badge 11px 500 (at 11px use metaMedium) ·
   *                §11 [2.C] badge chip 12px 700
   */
  badgeLg: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "700" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * heatBadge — 12px 700 Inter · tight (semantic alias for heat pill)
   * Heat Score pill text ("🔥 87"), rendered in white on gold→amber gradient pill.
   * Blueprint ref: §17 [5] heat pill "🔥 {N}" 12px 700 white
   */
  heatBadge: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "700" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // J — NUMBER / BALANCE / COUNTER DISPLAYS (Space Mono — PRD §19.3)
  // Credits · Ranks · Timers · Scores · Wallet amounts · Stat counts
  // PRD §19.3: "Numbers (credits, ranks, timers, scores): Space Mono 700"
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * wordmark — 22px 800 Syne · letter-spacing -0.5px (PRD §19.3 exact)
   * CROWN logotype string: "CROWN" in headers, splash, Glass Island.
   * Matches WORDMARK constant exported below the typography object.
   * PRD §19.3: Syne_800ExtraBold · 22px · letter-spacing -0.5px
   */
  wordmark: {
    fontFamily:    FONT_HEADING.bold,       // Syne_800ExtraBold
    fontSize:      22,
    fontWeight:    "800" as const,
    lineHeight:    26,                      // Math.round(22 × 1.15 tight)
    letterSpacing: LETTER_SPACING.tightest, // -0.5 — PRD §19.3 exact
  },

  /**
   * numbers — 18px 700 Space Mono · 1:1 line-height · tightest tracking
   * Legacy live counts, credit amounts, scores, streak counters.
   * ⚠️ LEGACY (v1.0) — kept for backward compat with existing components.
   *    Prefer balanceHero for wallet, statValue for profile, numbers for misc counts.
   * PRD §19.3: Space Mono 700 for all numeric displays.
   */
  numbers: {
    fontFamily:    FONT_NUMERIC.bold,
    fontSize:      FONT_SIZE.xl,            // 18
    fontWeight:    "700" as const,
    lineHeight:    FONT_SIZE.xl,             // 18 — 1:1 for numeric displays
    letterSpacing: LETTER_SPACING.tightest,  // -0.5
  },

  /**
   * balanceHero — 40px 700 Space Mono · tight leading · tightest tracking
   * Wallet balance hero ("12,500") — count-up animation on screen mount.
   * PRD §19.3: Space Mono 700 for credit/balance numbers.
   * Blueprint ref: §10 [2] "Balance: '12,500' (40px 700 white · counts up)"
   */
  balanceHero: {
    fontFamily:    FONT_NUMERIC.bold,
    fontSize:      FONT_SIZE.display,       // 40
    fontWeight:    "700" as const,
    lineHeight:    lh(40, "tight"),          // 46
    letterSpacing: LETTER_SPACING.tightest,  // -0.5
  },

  /**
   * statValue — 20px 700 Space Mono · tight leading · tightest tracking
   * Profile stats count-up values: Credits · Sparks · Days · Sectors.
   * PRD §19.3: Space Mono 700 for ranks/scores/stat numbers.
   * Blueprint ref: §11 [3] "20px 700 ink-950 · count-up animation on mount"
   */
  statValue: {
    fontFamily:    FONT_NUMERIC.bold,
    fontSize:      FONT_SIZE.h4,            // 20
    fontWeight:    "700" as const,
    lineHeight:    lh(20, "tight"),          // 23
    letterSpacing: LETTER_SPACING.tightest,  // -0.5
  },

  /**
   * statLabel — 11px 500 Inter · lineHeight 17px
   * Stat label text below value: "Credits" · "Sparks" · "Days" · "Sectors".
   * Blueprint ref: §11 [3] stat label "11px 500 ink-600" below the value
   */
  statLabel: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "500" as const,
    lineHeight:    lh(11, "relaxed"),        // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * walletRate — 14px 500 Inter · lineHeight 20px
   * Wallet hero conversion rate ("100 Credits = ₹10 conversion"),
   * cashout conversion preview ("= ₹95 (after 5% fee)").
   * Blueprint ref: §10 [2] subtitle 14px 500 white opacity 0.85 ·
   *                §10 Cashout [2] conversion preview 14px 500 ink-600
   */
  walletRate: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "500" as const,
    lineHeight:    lh(14, "normal"),         // 20
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * walletCashoutInput — 36px 700 Space Mono (PRD §19.3 — numeric input)
   * Explicit semantic name for the cashout amount input context.
   * PRD §19.3: Space Mono 700 for credit/amount numbers.
   * Blueprint ref: §10 Cashout [2] "Input field: 36px 700 ink-950"
   */
  walletCashoutInput: {
    fontFamily:    FONT_NUMERIC.bold,
    fontSize:      FONT_SIZE.inputGiant,    // 36
    fontWeight:    "700" as const,
    lineHeight:    lh(36, "tight"),          // 41
    letterSpacing: LETTER_SPACING.tightest,
  },

  /**
   * walletCashoutSuffix — 16px 500 Inter · tight leading
   * "Credits" suffix next to cashout input, "₹{amount}" suffix.
   * Blueprint ref: §10 Cashout [2] "Suffix: 'Credits' 16px 500 ink-600"
   */
  walletCashoutSuffix: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.lg,            // 16
    fontWeight:    "500" as const,
    lineHeight:    lh(16, "tight"),          // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // K — CHAT-SPECIFIC STYLES (Inter)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * chatBubble — 15px 400 Inter · relaxed leading (reading optimised)
   * Chat message bubble text. PRD §19.3: Inter for chat messages.
   * Blueprint ref: §11 Home Chat body text · Inter 400 reading optimisation
   * NOTE: Use body (14px) for legacy screens; chatBubble (15px) for new Home Chat.
   */
  chatBubble: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "400" as const,
    lineHeight:    lh(15, "relaxed"),        // 23 — chat reading comfort
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * chatSender — 12px 700 Inter · tight leading (above bubble)
   * Sender display name shown above message bubble in sector chat.
   * Blueprint ref: §11 chat sender name pattern 12px 700 above bubble
   */
  chatSender: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "700" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * chatMeta — 11px 400 Inter · tight leading (below bubble)
   * Chat timestamp ("2 min ago", "14:32"), read receipt text ("✓✓"),
   * reaction count text.
   * Blueprint ref: §11 chat time/read-receipt 11px 400 ink-500
   */
  chatMeta: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.sm,            // 11
    fontWeight:    "400" as const,
    lineHeight:    lh(11, "tight"),          // 13
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * chatAnnouncement — 15px 700 Inter · snug leading
   * Mayor announcement bubble header / "📌 Mayor Announcement" label.
   * Blueprint ref: §9 Mayor announcement emphasis 15px 700 ink-950
   */
  chatAnnouncement: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "700" as const,
    lineHeight:    lh(15, "snug"),           // 19
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // L — NAVIGATION / STEP INDICATORS (Inter)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * stepIndicator — 12px 600 Inter · tight leading
   * Onboarding step indicator "1 / 5" in top-right of onboarding headers.
   * Blueprint ref: §4 [1.C] "1 / 5" 12px 600 ink-600
   */
  stepIndicator: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "600" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * subNavActive — 14px 700 Inter · tight leading
   * Discover sub-nav active tab label ("Featured" when selected).
   * Blueprint ref: §9 [2] active tab "text gold-700 · 2px gold-600 underline · light bold"
   */
  subNavActive: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "700" as const,
    lineHeight:    lh(14, "tight"),          // 16
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * subNavInactive — 14px 400 Inter · tight leading
   * Discover sub-nav inactive tab labels ("Trending" · "Nearby" · "Earning").
   * Blueprint ref: §9 [2] inactive tabs "text ink-600 · regular weight"
   */
  subNavInactive: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "400" as const,
    lineHeight:    lh(14, "tight"),          // 16
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // M — PROFILE SCREEN STYLES (Inter)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * profileHandle — 14px 500 Inter · tight leading
   * @username handle below display name on all profile views.
   * Blueprint ref: §11 [2.B] "@bittu_42" 14px 500 ink-500
   */
  profileHandle: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "500" as const,
    lineHeight:    lh(14, "tight"),          // 16
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * profileBio — 14px 400 Inter · relaxed leading
   * Bio text on own/other profile (up to 200 chars, max 2-3 lines).
   * Blueprint ref: §11 [2.D] bio 14px 400 ink-600 · §12 [2.D] same
   */
  profileBio: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.md,            // 14
    fontWeight:    "400" as const,
    lineHeight:    lh(14, "relaxed"),        // 20 — bio reading comfort
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * profileBioHint — 12px 500 Inter · italic · relaxed
   * Empty bio hint: "Bio add karo · apne sector ko batao kaun ho".
   * Blueprint ref: §11 [2.D] empty state "12px 500 ink-500 italic"
   */
  profileBioHint: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "500" as const,
    lineHeight:    lh(12, "relaxed"),        // 18
    letterSpacing: LETTER_SPACING.normal,
    fontStyle:     "italic" as const,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // N — SETTINGS SCREEN STYLES (Inter)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * settingsRow — 15px 500 Inter · tight leading
   * Primary settings row label text: "Privacy Settings", "Push Notifications",
   * "Language", "Phone Number", "Logout".
   * Blueprint ref: §14 [3.A–F] row label "15px 500 ink-950"
   */
  settingsRow: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "500" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * settingsRowValue — 13px 500 Inter · tight leading
   * Right-side row value text: "Hinglish", "+91 98XXX XX210", "@bittu_42".
   * Blueprint ref: §14 [3.A–F] row value "13px 500 ink-500"
   */
  settingsRowValue: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.base,          // 13
    fontWeight:    "500" as const,
    lineHeight:    lh(13, "tight"),          // 15
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * settingsSectionHeader — 12px 600 Inter · uppercase tracking
   * Settings section category headers (apply textTransform:"uppercase" inline):
   *   "PRIVACY & SAFETY" · "NOTIFICATIONS" · "ACCOUNT" · "DANGER ZONE"
   * Blueprint ref: §14 [3.A] section header "32px H · 12px 600 ink-600 uppercase"
   */
  settingsSectionHeader: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "600" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.uppercase, // 0.8 — uppercase categories
  },

  /**
   * settingsDestructive — 15px 500 Inter · tight leading
   * Destructive action row labels: "Logout", "Account Delete karo".
   * Apply color: colors.fg.error (crimson-600) inline — style defines font only.
   * Blueprint ref: §14 [3.D] Logout "15px 500 crimson-600" · §15.D.4 delete
   */
  settingsDestructive: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "500" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * settingsMiniCard — 15px 700 Inter · tight leading
   * Settings hub user mini-card display name.
   * Blueprint ref: §14 [2] mini-card "Display name 15px 700 ink-950"
   */
  settingsMiniCard: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "700" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // O — BOTTOM SHEET STYLES (Inter)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * sheetTitle — 18px 700 Inter · snug leading · centered
   * Bottom-sheet title text: "City chuno", "Sector chuno · {City} mein".
   * Blueprint ref: §16 [2] "City chuno" 18px 700 ink-950 centered ·
   *                §17 [2] "Sector chuno" 18px 700 centered
   */
  sheetTitle: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      FONT_SIZE.xl,            // 18
    fontWeight:    "700" as const,
    lineHeight:    lh(18, "snug"),           // 23
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * sheetSubtitle — 12px 500 Inter · relaxed leading
   * Sheet subtitle below title: "{City} ke {N} sectors".
   * Blueprint ref: §17 [2] subtitle "12px 500 ink-500"
   */
  sheetSubtitle: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "500" as const,
    lineHeight:    lh(12, "relaxed"),        // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * sheetRowPrimary — 15px 600 Inter · tight leading
   * City/sector row primary name in all pickers.
   * Blueprint ref: §16 [5] city name "15px 600 ink-950" ·
   *                §17 [5] sector name "15px 600 ink-950"
   */
  sheetRowPrimary: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "600" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * sheetRowSecondary — 12px 500 Inter · relaxed leading
   * Secondary row info: "56 sectors", colony tag "City Center", online count.
   * Blueprint ref: §16 [5] count "12px 500 ink-500" ·
   *                §17 [5] colony tag "12px 500 ink-500"
   */
  sheetRowSecondary: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "500" as const,
    lineHeight:    lh(12, "relaxed"),        // 18
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * sheetSectionHeader — 12px 600 Inter · uppercase tracking
   * Sheet alphabetical section separators "A" "B" "C" in city picker.
   * Apply textTransform:"uppercase" inline.
   * Blueprint ref: §16 [5] alphabetical headers "12px 600 ink-600 uppercase"
   */
  sheetSectionHeader: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.cap,           // 12
    fontWeight:    "600" as const,
    lineHeight:    lh(12, "tight"),          // 14
    letterSpacing: LETTER_SPACING.uppercase, // 0.8
  },

  /**
   * sheetAction — 15px 500 Inter · tight leading
   * Message action sheet row labels:
   *   "React karo" · "Copy karo" · "WhatsApp pe Share" · "Delete karo" · "Report karo"
   * Blueprint ref: §18 [3] action row "15px 500 ink-950"
   */
  sheetAction: {
    fontFamily:    FONT_BODY.medium,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "500" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

  /**
   * sheetCancel — 15px 600 Inter · tight leading · centered
   * "Cancel karo" row at the bottom of all action sheets.
   * Blueprint ref: §18 [4] "15px 600 ink-950 centered"
   */
  sheetCancel: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      FONT_SIZE.mdLg,          // 15
    fontWeight:    "600" as const,
    lineHeight:    lh(15, "tight"),          // 17
    letterSpacing: LETTER_SPACING.normal,
  },

} as const;

// ═══════════════════════════════════════════════════════════════════════════
// § 5.5 — NAMED SIZE SCALE
// 7 named style presets keyed by semantic role + size.
// "Quick-grab" styles for new screens — one import covers 90% of text needs
// without hunting through the full semantic set.
//
// Rules:
//   • display32  → Syne (FONT_HEADING) — all others → Inter (FONT_BODY)
//   • Zero hardcoded family strings — every fontFamily via FONT_BODY.* / FONT_HEADING.*
//   • fontWeight references fontWeight.* map — no raw string literals
//   • lineHeight computed via lh() — no magic numbers
//
// Blueprint Part 1 § 3: "Syne for CROWN wordmark and hero display" → display32
//
// USAGE:
//   import { scale } from '@/constants/typography';
//   <Text style={[scale.body15, { color: colors.fg.primary }]}>Hello</Text>
//   <Text style={[scale.display32, { color: colors.fg.brand }]}>CROWN</Text>
// ═══════════════════════════════════════════════════════════════════════════

export const scale = {

  /**
   * display32 — 32px 800 Syne · snug leading · wide tracking
   *
   * The ONLY Syne entry in the named scale.
   * Use for: CROWN wordmark hero, hero display titles,
   *          large branded geometric moments (e.g. CROWN Pass title).
   *
   * PRD §19.3: "Syne_800ExtraBold — headings/wordmark/display."
   * Semantic equivalent: typography.h1
   */
  display32: {
    fontFamily:    FONT_HEADING.bold,               // Syne_800ExtraBold
    fontSize:      FONT_SIZE.h1,                    // 32
    fontWeight:    fontWeight.extrabold,            // "800"
    lineHeight:    lh(32, "snug"),                  // 40
    letterSpacing: LETTER_SPACING.wide,             // 0.3 — brand heading tracking
  },

  /**
   * heading24 — 24px 700 Inter · snug leading
   *
   * Use for: screen-level headings, cashout success headline ("Cashout successful!"),
   *          sub-screen push titles, prominent card headers.
   *
   * Semantic equivalent: typography.displaySm
   */
  heading24: {
    fontFamily:    FONT_BODY.bold,                   // Inter_700Bold
    fontSize:      FONT_SIZE.h2lg,                   // 24
    fontWeight:    fontWeight.bold,                  // "700"
    lineHeight:    lh(24, "snug"),                   // 30
    letterSpacing: LETTER_SPACING.normal,            // 0
  },

  /**
   * heading20 — 20px 700 Inter · tight leading
   *
   * Use for: profile stat values (Credits · Sparks · Days · Sectors),
   *          section numeric heroes, sub-section strong headings.
   *
   * Semantic equivalent: typography.statValue
   */
  heading20: {
    fontFamily:    FONT_BODY.bold,                   // Inter_700Bold
    fontSize:      FONT_SIZE.h4,                     // 20
    fontWeight:    fontWeight.bold,                  // "700"
    lineHeight:    lh(20, "tight"),                  // 23
    letterSpacing: LETTER_SPACING.normal,            // 0
  },

  /**
   * subhead17 — 17px 600 Inter · snug leading
   *
   * Use for: intermediate subheadings, elevated section labels, step titles,
   *          any copy that sits between a heading and body text.
   * Size 17px is used 11× across app screens (blueprint size audit).
   */
  subhead17: {
    fontFamily:    FONT_BODY.semiBold,               // Inter_600SemiBold
    fontSize:      FONT_SIZE.lgPlus,                 // 17
    fontWeight:    fontWeight.semibold,              // "600"
    lineHeight:    lh(17, "snug"),                   // 21
    letterSpacing: LETTER_SPACING.normal,            // 0
  },

  /**
   * body15 — 15px 400 Inter · relaxed leading (reading-optimised)
   *
   * Use for: chat bubbles, primary body copy, sector descriptions,
   *          card body text, onboarding paragraph text.
   * v5.0 preferred body size (upgraded from 14px for legibility).
   *
   * Semantic equivalent: typography.chatBubble / typography.bodyLg
   */
  body15: {
    fontFamily:    FONT_BODY.regular,                // Inter_400Regular
    fontSize:      FONT_SIZE.mdLg,                   // 15
    fontWeight:    fontWeight.regular,               // "400"
    lineHeight:    lh(15, "relaxed"),                // 23
    letterSpacing: LETTER_SPACING.normal,            // 0
  },

  /**
   * caption13 — 13px 400 Inter · relaxed leading
   *
   * Use for: form context, confirmation previews, small body text,
   *          activity descriptions, card secondary copy.
   *
   * Semantic equivalent: typography.bodySm
   */
  caption13: {
    fontFamily:    FONT_BODY.regular,                // Inter_400Regular
    fontSize:      FONT_SIZE.base,                   // 13
    fontWeight:    fontWeight.regular,               // "400"
    lineHeight:    lh(13, "relaxed"),                // 20
    letterSpacing: LETTER_SPACING.normal,            // 0
  },

  /**
   * micro11 — 11px 400 Inter · relaxed leading
   *
   * Use for: timestamps, read-receipts, auto-redirect countdowns,
   *          Glass Island inactive tab labels, online counts in meta contexts.
   *
   * Semantic equivalent: typography.metaRegular
   */
  micro11: {
    fontFamily:    FONT_BODY.regular,                // Inter_400Regular
    fontSize:      FONT_SIZE.sm,                     // 11
    fontWeight:    fontWeight.regular,               // "400"
    lineHeight:    lh(11, "relaxed"),                // 17
    letterSpacing: LETTER_SPACING.normal,            // 0
  },

} as const;

/** Union of named scale keys */
export type NamedScaleKey = keyof typeof scale;

// ═══════════════════════════════════════════════════════════════════════════
// § 6 — useCrowdFonts HOOK
//
// Loads all three font families simultaneously (PRD §19.3: Syne + Inter + Space Mono).
//
// Usage in app/_layout.tsx:
//   const [fontsLoaded, fontError] = useCrowdFonts();
//   if (!fontsLoaded && !fontError) return null; // or keep SplashScreen visible
//
// Pairs with: SplashScreen.preventAutoHideAsync()
// ═══════════════════════════════════════════════════════════════════════════

export function useCrowdFonts() {
  return useExpoFonts({
    // ── Syne (headings · wordmark · display) ─────────────────────────────
    Syne_800ExtraBold,
    Syne_700Bold,
    Syne_600SemiBold,
    Syne_400Regular,

    // ── Inter (body · UI · chat messages) ────────────────────────────────
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,

    // ── Space Mono (credits · ranks · timers · scores) ───────────────────
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// § 7 — HELPER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * createTextStyle — build a one-off RN text style not in the semantic set.
 *
 * @param fontFamily          — use FONT_BODY.* / FONT_HEADING.* / FONT_NUMERIC.*
 * @param fontSize            — px number
 * @param fontWeight          — RN fontWeight string (default "400")
 * @param lineHeightMultiplier— multiply by fontSize (default 1.45 = "normal")
 * @param letterSpacing       — pts (default 0)
 *
 * @example
 *   const custom = createTextStyle(FONT_BODY.semiBold, 13, "600", 1.4, 0.2);
 */
export function createTextStyle(
  fontFamily: string,
  fontSize: number,
  fontWeight: RNTextStyle["fontWeight"] = "400",
  lineHeightMultiplier = 1.45,
  letterSpacing = 0,
): Pick<RNTextStyle, "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing"> {
  return {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight: Math.round(fontSize * lineHeightMultiplier),
    letterSpacing,
  };
}

/**
 * withSize — override fontSize (and recalculate lineHeight) on any semantic style.
 *
 * @example
 *   <Text style={withSize(typography.ctaPrimary, 14)}>Smaller CTA</Text>
 */
export function withSize<T extends { fontSize: number; lineHeight: number }>(
  style: T,
  fontSize: number,
  lineHeightRatio: keyof typeof LINE_HEIGHT_RATIO = "normal",
): T {
  return { ...style, fontSize, lineHeight: lh(fontSize, lineHeightRatio) };
}

/**
 * withWeight — swap fontFamily + fontWeight on any Inter body style.
 * Only works for Inter (FONT_BODY) styles — heading (Syne) and numeric
 * (Space Mono) families are not mapped here; set fontFamily directly.
 * Inter in FONT_BODY tops out at 700Bold — "800" falls back to bold.
 *
 * @example
 *   <Text style={withWeight(typography.body, "700")}>Bold body</Text>
 */
export function withWeight<T extends { fontFamily: string; fontWeight: RNTextStyle["fontWeight"] }>(
  style: T,
  weight: "400" | "500" | "600" | "700",
): T {
  const map: Record<string, string> = {
    "400": FONT_BODY.regular,
    "500": FONT_BODY.medium,
    "600": FONT_BODY.semiBold,
    "700": FONT_BODY.bold,
  };
  return { ...style, fontFamily: map[weight] ?? FONT_BODY.regular, fontWeight: weight };
}

// ═══════════════════════════════════════════════════════════════════════════
// § 8 — SCREEN → STYLE QUICK-REFERENCE
//
//   SPLASH (/onboarding)
//     Headline         → displayHero         (28px 700)
//     Subhead          → bodyXl              (16px 400 lh 24)
//     Primary CTA      → ctaPrimary          (16px 700)
//     Secondary CTA    → ctaSecondary        (14px 600)
//     Peek link        → ctaLinkSm           (12px 500)
//
//   PHONE ENTRY (/onboarding/phone)
//     Headline         → titleLg             (22px 700)
//     Subhead          → bodyLg              (15px 400)
//     Field label      → bodySmBold          (13px 600)
//     Phone input      → inputXl             (18px 600 ls:0.5)
//     Placeholder      → inputPlaceholder    (15px 400)
//     Helper / error   → caption             (12px 400)
//     Step indicator   → stepIndicator       (12px 600)
//     Continue CTA     → ctaPrimary          (16px 700)
//     Privacy note     → ctaLinkSm           (12px 500)
//
//   OTP (/onboarding/otp)
//     OTP digit        → inputOtp            (22px 700)
//     Resend timer     → metaRegular         (11px 400)
//     Resend active    → ctaLink             (14px 600)
//     Error message    → caption             (12px 400)
//
//   PROFILE SETUP (/onboarding/profile)
//     Name input       → inputXlName         (18px 600)
//     Optional label   → caption             (12px 400)
//     Counter          → inputCounter        (11px 400)
//
//   LOCATION (/onboarding/location)
//     Card title       → bodyLgBold          (15px 700)
//     Card subtitle    → bodySm              (13px 400)
//     Selector value   → bodyLgBold          (15px 600)
//     Confirmation     → bodySm             (13px 400)
//
//   WELCOME BURST (/onboarding/complete)
//     "Welcome, N!"    → displayCelebration  (28px 700)
//     Subhead          → bodyXl              (16px 400)
//     Stat banner      → bodySmBold          (13px 600)
//     Auto-redirect    → metaRegular         (11px 400)
//     CTA              → ctaPrimary          (16px 700)
//
//   DISCOVER (/(tabs)/discover)
//     Section header   → titleMd             (18px 700)
//     "See All →"      → ctaLink             (14px 600)
//     Sub-nav active   → subNavActive        (14px 700)
//     Sub-nav inactive → subNavInactive      (14px 400)
//     Card title       → bodyLgBold          (15px 700)
//     Card subtitle    → captionMedium       (12px 500)
//     LIVE badge       → metaBold            (11px 700)
//     Heat badge       → heatBadge           (12px 700)
//     CROWN card title → titleMd             (18px 700)
//     CROWN sub-text   → bodySmMedium        (13px 500)
//     Online count     → metaRegular         (11px 400)
//
//   WALLET (/(tabs)/wallet)
//     "Total Credits"  → meta                (11px 600)
//     Balance amount   → balanceHero         (40px 700)
//     Rate disclosure  → walletRate          (14px 500)
//     Min cashout note → metaMedium          (11px 500)
//     Section header   → titleMd             (18px 700)
//     "See All →"      → ctaLink             (14px 600)
//     Tx title         → bodyBold            (14px 700)
//     Tx timestamp     → captionMedium       (12px 500)
//     Tx amount        → bodyBold            (14px 700)
//     Tx status badge  → metaMedium          (11px 500)
//     Cashout input    → walletCashoutInput  (36px 700)
//     Cashout suffix   → walletCashoutSuffix (16px 500)
//     Conversion text  → walletRate          (14px 500)
//
//   OWN PROFILE (/(tabs)/profile)
//     Display name     → titleProfile        (22px 700)
//     @handle          → profileHandle       (14px 500)
//     Badge chip       → badgeLg             (12px 700)
//     Bio text         → profileBio          (14px 400)
//     Bio empty hint   → profileBioHint      (12px 500 italic)
//     Stat value       → statValue           (20px 700)
//     Stat label       → statLabel           (11px 500)
//     Section header   → titleMd             (18px 700)
//     Activity desc    → bodySm              (13px 400)
//     Activity time    → metaRegular         (11px 400)
//
//   SETTINGS (/settings)
//     Mini-card name   → settingsMiniCard    (15px 700)
//     Mini-card handle → captionMedium       (12px 500)
//     Section header   → settingsSectionHeader (12px 600 + textTransform uppercase)
//     Row label        → settingsRow         (15px 500)
//     Row value        → settingsRowValue    (13px 500)
//     Destructive row  → settingsDestructive (15px 500 + crimson color)
//     Footer version   → footerNote          (10px 400)
//
//   CITY PICKER SHEET (§16)
//     Sheet title      → sheetTitle          (18px 700)
//     Row name         → sheetRowPrimary     (15px 600)
//     Row count        → sheetRowSecondary   (12px 500)
//     Section header   → sheetSectionHeader  (12px 600 + uppercase)
//
//   SECTOR PICKER SHEET (§17)
//     Sheet title      → sheetTitle          (18px 700)
//     Subtitle         → sheetSubtitle       (12px 500)
//     Sector name      → sheetRowPrimary     (15px 600)
//     Colony tag       → sheetRowSecondary   (12px 500)
//     Heat badge       → heatBadge           (12px 700)
//
//   MESSAGE ACTION SHEET (§18)
//     Action row       → sheetAction         (15px 500)
//     Cancel row       → sheetCancel         (15px 600)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// § 9 — TYPESCRIPT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** All semantic typography style keys (type-safe object spread) */
export type TypographyKey = keyof typeof typography;

/** Shape of one typography style object */
export type TextStyleDef = {
  fontFamily:    string;
  fontSize:      number;
  fontWeight:    RNTextStyle["fontWeight"];
  lineHeight:    number;
  letterSpacing: number;
  fontStyle?:    RNTextStyle["fontStyle"];
};

/** Union of all semantic style values */
export type TextStyle = (typeof typography)[TypographyKey];

/** fontFamily string unions — type-safe fontFamily prop */
export type HeadingFont  = (typeof FONT_HEADING)[keyof typeof FONT_HEADING];
export type BodyFont     = (typeof FONT_BODY)[keyof typeof FONT_BODY];
export type NumericFont  = (typeof FONT_NUMERIC)[keyof typeof FONT_NUMERIC];
export type AppFont      = HeadingFont | BodyFont | NumericFont;

/** FONT_SIZE key union */
export type FontSizeKey = keyof typeof FONT_SIZE;

/** LETTER_SPACING key union */
export type LetterSpacingKey = keyof typeof LETTER_SPACING;

/** LINE_HEIGHT_RATIO key union */
export type LineHeightKey = keyof typeof LINE_HEIGHT_RATIO;

/** fontWeight key union */
export type FontWeightKey = keyof typeof fontWeight;

/**
 * TypographyScale — interface for one complete, renderable typography style entry.
 *
 * Every entry in both `typography` (semantic set) and `scale` (named size set)
 * conforms to this interface. Use it as a prop type when a component accepts
 * a typography style injected from the outside.
 *
 * @example
 *   interface LabelProps {
 *     textStyle?: TypographyScale;
 *   }
 *   function Label({ textStyle = scale.caption13 }: LabelProps) {
 *     return <Text style={textStyle} />;
 *   }
 */
export interface TypographyScale {
  fontFamily:    string;
  fontSize:      number;
  fontWeight:    RNTextStyle["fontWeight"];
  lineHeight:    number;
  letterSpacing: number;
  fontStyle?:    RNTextStyle["fontStyle"];
}

/**
 * ScaleMap — strongly-typed map of all 7 named size scale entries.
 * Use when you need to accept or pass the full scale object as a value.
 *
 * @example
 *   function resolveStyle(key: NamedScaleKey): TypographyScale {
 *     return (scale as ScaleMap)[key];
 *   }
 */
export type ScaleMap = Record<NamedScaleKey, TypographyScale>;

// ═══════════════════════════════════════════════════════════════════════════
// § 10 — EXPORTS
//
// Named exports from this file:
//
//   FONT CONFIG (Expo):
//     useCrowdFonts()    — hook for app/_layout.tsx · loads all three font families
//     FONT_HEADING       — Syne family constant strings
//     FONT_BODY          — Inter family constant strings
//
//   PRIMITIVE SCALES:
//     FONT_SIZE          — 18-step size scale (xs → display)
//     LINE_HEIGHT_RATIO  — multiplier presets (tight → loose)
//     LETTER_SPACING     — spacing map (tightest → uppercase)
//     letterSpacing      — lowercase alias of LETTER_SPACING
//     fontWeight         — weight map { regular · medium · semibold · bold · extrabold }
//
//   STYLE HELPERS:
//     lh()               — compute absolute lineHeight from fontSize + ratio key
//     createTextStyle()  — build one-off style not in the semantic set
//     withSize()         — override fontSize on any semantic style
//     withWeight()       — swap fontFamily + fontWeight on any Inter style
//
//   SEMANTIC STYLES:
//     typography / t     — full semantic style map (A–O groups, 60+ entries)
//
//   NAMED SCALE (NEW v2.0):
//     scale              — 7 named presets: display32 · heading24 · heading20 ·
//                          subhead17 · body15 · caption13 · micro11
//
//   TYPESCRIPT TYPES:
//     TypographyScale    — interface for any single style entry (use as prop type)
//     ScaleMap           — Record<NamedScaleKey, TypographyScale>
//     TypographyKey      — keyof typeof typography
//     NamedScaleKey      — keyof typeof scale
//     TextStyleDef       — shape of a style object
//     HeadingFont / BodyFont / AppFont  — fontFamily string unions
//     FontSizeKey / LetterSpacingKey / LineHeightKey / FontWeightKey
// ═══════════════════════════════════════════════════════════════════════════

/** Shorthand alias — import { t } from '@/constants/typography' */
export const t = typography;

export default typography;

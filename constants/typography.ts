/**
 * CROWD WORLD — Typography Tokens v1
 *
 * HTML prototype crowd_world_redesigned.html ke :root fonts se exactly match karta hai:
 *   @import url('https://fonts.googleapis.com/css2?
 *     family=Cormorant+Garamond:wght@600;700;800
 *     &family=DM+Sans:wght@400;500;600;700;800
 *     &display=swap')
 *
 * INSTALL (ek baar run karo):
 *   npx expo install @expo-google-fonts/cormorant-garamond @expo-google-fonts/dm-sans
 *
 * ── Font Roles ──────────────────────────────────────────────────────────────
 *   Cormorant Garamond  →  Headings, brand titles, premium numbers
 *   DM Sans             →  Body copy, UI labels, meta text, badges
 */

import { useFonts as useExpoFonts } from "expo-font";

// ── Cormorant Garamond imports ───────────────────────────────────────────────
// HTML mein: font-family:'Cormorant Garamond',serif; wght@600;700;800
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
  CormorantGaramond_800ExtraBold,
} from "@expo-google-fonts/cormorant-garamond";

// ── DM Sans imports ──────────────────────────────────────────────────────────
// HTML mein: font-family:'DM Sans',sans-serif; wght@400;500;600;700;800
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
} from "@expo-google-fonts/dm-sans";

// ─────────────────────────────────────────────────────────────────────────────
// FONT FAMILY CONSTANTS
// React Native mein fontFamily = loaded font ka exact naam hota hai.
// fontWeight alag se specify karna padta hai fallback ke liye.
// ─────────────────────────────────────────────────────────────────────────────

/** Cormorant Garamond — heading serif family */
export const FONT_HEADING = {
  semiBold:   "CormorantGaramond_600SemiBold",  // weight 600
  bold:       "CormorantGaramond_700Bold",       // weight 700
  extraBold:  "CormorantGaramond_800ExtraBold",  // weight 800
} as const;

/** DM Sans — body + UI sans-serif family */
export const FONT_BODY = {
  regular:    "DMSans_400Regular",   // weight 400 — default readable body
  medium:     "DMSans_500Medium",    // weight 500 — slightly emphasized
  semiBold:   "DMSans_600SemiBold",  // weight 600 — labels, meta
  bold:       "DMSans_700Bold",      // weight 700 — strong UI elements
  extraBold:  "DMSans_800ExtraBold", // weight 800 — badges, counts, CTA
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FONT SIZE SCALE
// HTML prototype ke observed sizes se derived (most frequent: 11, 13, 14, 24, 26px)
// ─────────────────────────────────────────────────────────────────────────────

export const FONT_SIZE = {
  // Micro — badges, timestamps, tags (HTML mein 9-10px: .dm-badge, .tag-local)
  xs:   9,
  sm:   11,  // Most common — .meta, .screen-sub-txt, .city-status-bar

  // Body — main readable text
  base: 13,  // .m-text, .top-city-tag, .txt-in
  md:   14,  // .bubble, .ai-companion-msg, .cw-teams (body default)

  // UI — section titles, chips
  lg:   16,
  xl:   18,

  // Headings — Cormorant territory
  h3:   22,
  h2:   26,  // .streak-days uses 26px Cormorant
  h1:   32,  // Large brand/hero titles

  // Display — numbers widget, CROWN pass big numbers
  display: 40,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LINE HEIGHT SCALE (pixels mein — React Native multipliers nahi leta)
// HTML prototype ke line-height multipliers se calculate kiya:
//   1.45 × 14px ≈ 20, 1.5 × 13px ≈ 20, 1.5 × 14px = 21
// ─────────────────────────────────────────────────────────────────────────────

export const LINE_HEIGHT = {
  tight:    1,    // Headings jahan space compress chahiye (.streak-days: line-height:1)
  snug:     1.2,
  normal:   1.45, // Body default (.bubble, .ai-companion-msg use 1.45)
  relaxed:  1.5,  // Long read text (.m-text: line-height:1.5)
  loose:    1.6,  // Max readability
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LETTER SPACING SCALE (React Native mein pts — HTML ke px values se match)
// ─────────────────────────────────────────────────────────────────────────────

export const LETTER_SPACING = {
  tightest: -0.5, // Big display numbers ke liye
  tight:    -0.2,
  normal:    0,
  wide:      0.3, // .screen-sub-txt: letter-spacing:.3px
  wider:     0.5, // .app-title: letter-spacing:0.5px, .streak-days-lbl: .5px
  widest:    0.8, // .vd-badge, .flash-badge: letter-spacing:.8px (uppercase tags)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY OBJECT — Main export
//
// Har style mein ye saare keys hain:
//   fontFamily    → loaded Google Font ka exact identifier
//   fontSize      → px size (number)
//   fontWeight    → string — '400' | '500' | '600' | '700' | '800'
//   lineHeight    → pixels mein (fontSize × multiplier)
//   letterSpacing → pts mein
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  // ── Cormorant Garamond — Headings ─────────────────────────────────────────
  // HTML mein: .app-title, .screen-name-txt = 24px/700
  //            .streak-days = 26px/700
  //            .sr-title = 14px/800
  // App mein hum consistent semantic scale use karte hain.

  /** H1 — Hero titles, CROWN pass naam, onboarding screens */
  h1: {
    fontFamily:    FONT_HEADING.extraBold,  // Cormorant 800
    fontSize:      FONT_SIZE.h1,            // 32px
    fontWeight:    "800" as const,
    lineHeight:    FONT_SIZE.h1 * LINE_HEIGHT.snug,     // 38.4 ≈ 38
    letterSpacing: LETTER_SPACING.wide,     // 0.3 — HTML .app-title jaisa
  },

  /** H2 — Section headers, room titles, profile name */
  h2: {
    fontFamily:    FONT_HEADING.bold,       // Cormorant 700
    fontSize:      FONT_SIZE.h2,            // 26px — matches .streak-days exactly
    fontWeight:    "700" as const,
    lineHeight:    FONT_SIZE.h2 * LINE_HEIGHT.snug,     // 31.2 ≈ 32
    letterSpacing: LETTER_SPACING.wide,     // 0.3
  },

  /** H3 — Card titles, modal headers, tab screen names */
  h3: {
    fontFamily:    FONT_HEADING.semiBold,   // Cormorant 600
    fontSize:      FONT_SIZE.h3,            // 22px
    fontWeight:    "600" as const,
    lineHeight:    FONT_SIZE.h3 * LINE_HEIGHT.snug,     // 26.4 ≈ 26
    letterSpacing: LETTER_SPACING.wide,     // 0.3
  },

  // ── DM Sans — Body & UI ───────────────────────────────────────────────────
  // HTML mein: .bubble = 14px/400/1.45, .ai-companion-msg = 14px/400/1.45
  //            .m-text = 13px/400/1.5

  /** body — Default readable text, chat bubbles, card descriptions */
  body: {
    fontFamily:    FONT_BODY.regular,       // DM Sans 400
    fontSize:      FONT_SIZE.md,            // 14px — .bubble exact match
    fontWeight:    "400" as const,
    lineHeight:    FONT_SIZE.md * LINE_HEIGHT.normal,   // ~20.3 ≈ 20
    letterSpacing: LETTER_SPACING.normal,   // 0
  },

  /** bodyMedium — Slightly emphasized body, input placeholder, captions */
  bodyMedium: {
    fontFamily:    FONT_BODY.medium,        // DM Sans 500
    fontSize:      FONT_SIZE.md,            // 14px
    fontWeight:    "500" as const,
    lineHeight:    FONT_SIZE.md * LINE_HEIGHT.normal,   // ~20
    letterSpacing: LETTER_SPACING.normal,   // 0
  },

  /** bodyBold — Strong body copy, .sponsored-title (13px/700), .m-text bold variant */
  bodyBold: {
    fontFamily:    FONT_BODY.bold,          // DM Sans 700
    fontSize:      FONT_SIZE.md,            // 14px
    fontWeight:    "700" as const,
    lineHeight:    FONT_SIZE.md * LINE_HEIGHT.normal,   // ~20
    letterSpacing: LETTER_SPACING.normal,   // 0
  },

  /** meta — Labels, tags, timestamps, city bar (HTML .meta = 11px/600, .screen-sub-txt = 11px/600) */
  meta: {
    fontFamily:    FONT_BODY.semiBold,      // DM Sans 600
    fontSize:      FONT_SIZE.sm,            // 11px — exact .meta match
    fontWeight:    "600" as const,
    lineHeight:    FONT_SIZE.sm * LINE_HEIGHT.relaxed,  // 16.5 ≈ 16
    letterSpacing: LETTER_SPACING.wide,     // 0.3 — .screen-sub-txt: letter-spacing:.3px
  },

  /** numbers — Live counts, credit amounts, scores, streak counters */
  // HTML: .dm-badge = 10px/800, .flash-timer-pill = 13px/800, .cw-teams = 14px/800
  // App mein bade amounts/scores ke liye 20px extraBold use karte hain.
  numbers: {
    fontFamily:    FONT_BODY.extraBold,     // DM Sans 800 — punchy, high impact
    fontSize:      FONT_SIZE.xl,            // 18px — wallet balance, live count
    fontWeight:    "800" as const,
    lineHeight:    FONT_SIZE.xl * LINE_HEIGHT.tight,    // 18 — tight for numeric displays
    letterSpacing: LETTER_SPACING.tightest, // -0.5 — numbers paas paas dikhte hain
  },

  // ── Bonus: Frequently used mini styles ───────────────────────────────────
  // HTML prototype mein bahut zyada use hone wale patterns

  /** badge — .flash-badge, .vd-badge, .tag-local: 9px/800/uppercase/.8 tracking */
  badge: {
    fontFamily:    FONT_BODY.extraBold,     // DM Sans 800
    fontSize:      FONT_SIZE.xs,            // 9px — .tag-local exact match
    fontWeight:    "800" as const,
    lineHeight:    FONT_SIZE.xs * LINE_HEIGHT.relaxed,  // ~13.5
    letterSpacing: LETTER_SPACING.widest,   // 0.8 — uppercase badge tracking
  },

  /** label — .city-status-bar (11px/700/uppercase/.6), nav tab labels */
  label: {
    fontFamily:    FONT_BODY.bold,          // DM Sans 700
    fontSize:      FONT_SIZE.sm,            // 11px
    fontWeight:    "700" as const,
    lineHeight:    FONT_SIZE.sm * LINE_HEIGHT.normal,   // ~16
    letterSpacing: LETTER_SPACING.wider,    // 0.5 — uppercase labels
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// useCrowdFonts — Custom hook: dono families ek saath load karta hai
//
// Usage (app/_layout.tsx mein):
//   const [fontsLoaded, fontError] = useCrowdFonts();
//   if (!fontsLoaded && !fontError) return <SplashScreen />;
//
// Yeh hook SplashScreen.preventAutoHideAsync() ke saath kaam karta hai.
// ─────────────────────────────────────────────────────────────────────────────

export function useCrowdFonts() {
  return useExpoFonts({
    // ── Cormorant Garamond ─────────────────────────────────────────────────
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CormorantGaramond_800ExtraBold,

    // ── DM Sans ───────────────────────────────────────────────────────────
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

/** typography object ke saare top-level keys */
export type TypographyKey = keyof typeof typography;

/** Ek individual text style ka shape */
export type TextStyle = (typeof typography)[TypographyKey];

/** fontFamily string union — type-safe fontFamily prop ke liye */
export type HeadingFont = (typeof FONT_HEADING)[keyof typeof FONT_HEADING];
export type BodyFont    = (typeof FONT_BODY)[keyof typeof FONT_BODY];
export type AppFont     = HeadingFont | BodyFont;

export default typography;

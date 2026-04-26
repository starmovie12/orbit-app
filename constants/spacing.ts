/**
 * CROWD WORLD — Spacing, Radius & Shadow Tokens v1
 *
 * Source: crowd_world_redesigned.html → :root CSS variables
 *   --r-xs:4px  --r-sm:8px  --r-md:12px  --r-lg:16px  --r-xl:20px  --r-2xl:28px
 *   --shadow-sm / --shadow-md / --shadow-lg / --shadow-gold
 *
 * Padding/margin patterns HTML se observe karke scale banaya:
 *   Most frequent px values → 4, 8, 10, 12, 14, 16, 20, 28
 *   Yeh tokens un patterns ko normalize karte hain.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { spacing, radius, shadows } from '@/constants/spacing';
 *
 *   style={{ padding: spacing.md, borderRadius: radius.lg, ...shadows.gold }}
 */

import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// SPACING
// HTML padding/gap analysis se derived 8-point grid (4px base unit):
//   gap:4 → xs | gap:8 → sm | padding:12 → md | padding:16 → lg
//   padding:20 → xl | --r-2xl:28px → xxl
//
// Note: inline paddings (e.g. "6px 13px") = vertical/horizontal mix.
// Inke liye spacing values combine karo, e.g. { paddingVertical: spacing.xs+2, paddingHorizontal: spacing.sm+5 }
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  /** 4px — Icon gap, micro padding, tight badge inner space
   *  HTML: gap:4, padding:0 4px (.tag-verified), margin:4px */
  xs:  4,

  /** 8px — Default gap, chip padding, list item spacing
   *  HTML: gap:8 (.app-title), padding:8px, margin:8px (most frequent gap value) */
  sm:  8,

  /** 12px — Card inner padding, button vertical, input padding
   *  HTML: padding:12px (2nd most common), gap:10-12 */
  md:  12,

  /** 16px — Section padding, screen horizontal inset
   *  HTML: padding:16px (.city-status-bar: padding:0 18px ~ lg), margin:16px */
  lg:  16,

  /** 20px — Large card padding, modal inner padding, screen vertical
   *  HTML: padding:20px (11 occurrences), border-radius:20px for pills */
  xl:  20,

  /** 28px — Nav island padding, bottom sheet top padding, hero sections
   *  HTML: --r-2xl:28px, margin:0 auto 20px (section gap) */
  xxl: 28,

  // ── Derived helpers — commonly needed combos ────────────────────────────
  /** Screen horizontal padding — left/right standard inset (matches HTML 18px padding) */
  screenH: 18,

  /** Screen vertical padding — top/bottom standard inset */
  screenV: 16,

  /** Card inner padding — cards ke andar standard padding */
  card:    14,

  /** Chip/pill padding — horizontal (e.g. "6px 13px" → vertical=xs, horizontal=chip) */
  chip:    13,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RADIUS
// HTML ke :root CSS variables se 1:1 match:
//   --r-xs:4px   → xs   (message bubble corner)
//   --r-sm:8px   → sm   (chips, pills)
//   --r-md:12px  → md   (buttons, inputs)
//   --r-lg:16px  → lg   (cards)
//   --r-xl:20px  → xl   (major cards, modals)
//   --r-2xl:28px → xxl  (nav island, large sheets)
//   --r-full:50% → round → React Native mein 50% kaam nahi karta,
//                          9999 use karte hain (avatars, dots, pills)
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  /** 4px — --r-xs: Message bubble corner, tiny badge radius */
  xs:    4,

  /** 8px — --r-sm: Chips, filter pills, small tags (.city-btn: 20px → xl, .rp: 12px → md) */
  sm:    8,

  /** 12px — --r-md: Buttons, input fields, gift buttons (.rp border-radius:12px exact match) */
  md:    12,

  /** 16px — --r-lg: Standard cards, discover post cards */
  lg:    16,

  /** 20px — --r-xl: Major cards, bottom sheet tops, Flash Blast cards */
  xl:    20,

  /** 28px — --r-2xl: Nav island, large modals, CROWN pass card */
  xxl:   28,

  /** 9999 — --r-full equivalent: Avatars, online dots, circular buttons
   *  React Native mein 50% sirf square views pe kaam karta hai,
   *  9999 hamesha safe rahta hai */
  round: 9999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SHADOWS
// HTML ke :root se:
//   --shadow-sm:   0 1px  4px  rgba(0,0,0,.04)          → subtle neutral
//   --shadow-md:   0 3px  12px rgba(201,162,39,.15)      → gold tint, cards
//   --shadow-lg:   0 8px  32px rgba(0,0,0,.08)           → deep neutral, modals
//   --shadow-gold: 0 4px  16px rgba(201,162,39,.40)      → strong gold glow, CTAs
//
// React Native mein CSS box-shadow seedha kaam nahi karta:
//   iOS   → shadowColor, shadowOffset, shadowOpacity, shadowRadius
//   Android → elevation (aur React Native 0.76+ pe shadowColor bhi partial)
//
// Dono platforms ke liye saare properties ek hi object mein daal diye hain.
// iOS shadow* properties Android pe ignore hote hain, elevation iOS pe ignore hota hai.
// Bas spread karo: style={{ ...shadows.gold }}
//
// Note: Shadow sirf opaque background wale views pe dikhta hai.
// Transparent/overflow:hidden views pe shadow nahi aata.
// ─────────────────────────────────────────────────────────────────────────────

/** CSS shadow color → hex constants (rgba opacity alag rakhi hai shadowOpacity mein) */
const SHADOW_BLACK = "#000000";
const SHADOW_GOLD  = "#C9A227"; // --gold exact value (from colors.ts accent)

export const shadows = {
  /**
   * sm — --shadow-sm: 0 1px 4px rgba(0,0,0,.04)
   * Bahut halka neutral shadow. List items, input fields, subtle cards.
   * Android elevation:2 → gentle lift without harsh line.
   */
  sm: Platform.select({
    ios: {
      shadowColor:   SHADOW_BLACK,
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius:  4,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor:   SHADOW_BLACK,
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius:  4,
      elevation:     2,
    },
  }),

  /**
   * md — --shadow-md: 0 3px 12px rgba(201,162,39,.15)
   * Gold tint wala medium shadow. Standard cards, discover feed posts,
   * room cards. Warm premium feel deta hai.
   * Android elevation:5 → visible lift.
   */
  md: Platform.select({
    ios: {
      shadowColor:   SHADOW_GOLD,
      shadowOffset:  { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius:  12,
    },
    android: {
      elevation: 5,
    },
    default: {
      shadowColor:   SHADOW_GOLD,
      shadowOffset:  { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius:  12,
      elevation:     5,
    },
  }),

  /**
   * lg — --shadow-lg: 0 8px 32px rgba(0,0,0,.08)
   * Deep neutral shadow. Modals, bottom sheets, floating action buttons.
   * Neutral black → content ke upar layered feel ke liye.
   * Android elevation:12 → strong modal-level lift.
   */
  lg: Platform.select({
    ios: {
      shadowColor:   SHADOW_BLACK,
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius:  32,
    },
    android: {
      elevation: 12,
    },
    default: {
      shadowColor:   SHADOW_BLACK,
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius:  32,
      elevation:     12,
    },
  }),

  /**
   * gold — --shadow-gold: 0 4px 16px rgba(201,162,39,.40)
   * Strong brand gold glow. Primary CTA buttons, CROWN Pass card,
   * Flash Blast cards, active nav indicator. Sabse impactful shadow.
   * Android elevation:16 → premium feel, high-priority elements.
   *
   * HTML mein 7 jagah use hua (most repeated custom shadow).
   */
  gold: Platform.select({
    ios: {
      shadowColor:   SHADOW_GOLD,
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.40,
      shadowRadius:  16,
    },
    android: {
      elevation: 16,
    },
    default: {
      shadowColor:   SHADOW_GOLD,
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.40,
      shadowRadius:  16,
      elevation:     16,
    },
  }),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

export type SpacingKey = keyof typeof spacing;
export type RadiusKey  = keyof typeof radius;
export type ShadowKey  = keyof typeof shadows;

/** Spacing value type — always number */
export type SpacingValue = (typeof spacing)[SpacingKey];

/** Radius value type — always number */
export type RadiusValue = (typeof radius)[RadiusKey];

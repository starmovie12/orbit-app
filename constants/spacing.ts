/**
 * CROWD WORLD — Design Tokens: Spacing · Radius · Shadows · Layout  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every numeric dimension in the app.
 * NO hardcoded values outside this file — always import and reference tokens.
 *
 * Grid base  : 4 px
 * Brand color: Gold #C9A227  ·  Warm Ivory #FFF9EC  ·  Warm Ink #1A1208
 *
 * Architecture constraints honoured here:
 *   Rule 04   → inputAreaHeight + glassIslandHeight are NON-NEGOTIABLE (flush, zero gap)
 *   LAW 13    → glassIslandHeight drives hide/show translateY offset
 *   LAW 15    → headerHeight is the two-row header anchor
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { spacing, radius, shadows, layout } from '@/constants/spacing';
 *   import type { SpacingScale, RadiusScale, ShadowStyle, LayoutConstants } from '@/constants/spacing';
 *
 *   style={{ padding: spacing.md, borderRadius: radius.lg, ...shadows.gold }}
 */

import { Platform, type ViewStyle } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// 1. SPACING  —  strict 4-pt grid
//
//   xs  :  4px  →  icon gap, micro padding, tight badge inner space
//   sm  :  8px  →  chip padding, default gap, list item margin
//   md  : 12px  →  card inner padding, button vertical, input padding
//   lg  : 16px  →  section padding, screen horizontal inset
//   xl  : 20px  →  large card padding, modal inner padding
//   xxl : 24px  →  nav island padding, bottom-sheet top, hero sections
//   xxxl: 32px  →  screen-level section gap, large modal top padding
//
//   Derived helpers remain for backward compatibility; they do NOT appear in
//   SpacingScale — use named tokens in new code whenever possible.
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  /** 4px  — micro gap, badge inner, icon spacing */
  xs:   4,
  /** 8px  — chip H-padding, list gap, default gutter */
  sm:   8,
  /** 12px — card inner, button V-padding, input padding */
  md:   12,
  /** 16px — screen H-inset, section padding, card gap */
  lg:   16,
  /** 20px — large card, modal inner, screen V-padding */
  xl:   20,
  /** 24px — nav island, bottom-sheet top, hero section gap */
  xxl:  24,
  /** 32px — screen-level section separation, large modal top */
  xxxl: 32,

  // ── Derived helpers (not part of the strict scale) ─────────────────────
  /** 18px — screen horizontal inset (matches HTML 18px padding pattern) */
  screenH: 18,
  /** 16px — screen vertical inset (alias for lg, explicit intent) */
  screenV: 16,
  /** 14px — standard card inner padding */
  card:    14,
  /** 13px — chip/pill horizontal padding ("6px 13px" pattern from design HTML) */
  chip:    13,
} as const;

/** Strict 4-pt scale keys — excludes derived helpers */
export type SpacingScaleKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';

/** All exported spacing keys (includes derived helpers) */
export type SpacingKey = keyof typeof spacing;

/** Numeric spacing value */
export type SpacingValue = (typeof spacing)[SpacingKey];

/** Typed interface for the strict spacing scale */
export interface SpacingScale {
  readonly xs:   4;
  readonly sm:   8;
  readonly md:   12;
  readonly lg:   16;
  readonly xl:   20;
  readonly xxl:  24;
  readonly xxxl: 32;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RADIUS  —  component-semantic scale
//
//   xs   :   4px  →  message bubble corner, tiny badge
//   sm   :   6px  →  chips, filter pills, small tags
//   md   :  10px  →  buttons, input fields
//   lg   :  14px  →  standard cards
//   xl   :  20px  →  major cards, bottom-sheet tops, Flash Blast cards
//   pill : 999px  →  avatars, online dots, circular buttons
//                    (9999 is unnecessarily large; 999 is safe on all RN versions
//                     and avoids the occasional clipping artifact on old Android)
//
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  /** 4px  — message bubble corner, tiny badge radius */
  xs:   4,
  /** 6px  — chips, filter pills, small tags */
  sm:   6,
  /** 10px — buttons, input fields */
  md:   10,
  /** 14px — standard cards, discover post cards */
  lg:   14,
  /** 20px — major cards, bottom-sheet tops, Flash Blast cards */
  xl:   20,
  /**
   * 28px — Glass Island nav bar (exact capsule: glassIslandHeight 56px ÷ 2 = 28px).
   * Math: border-radius must equal exactly half the height to produce a true
   * capsule. Any value below 28 renders a rounded rectangle — the premium
   * floating-pill silhouette is lost. Any value above is redundant.
   * Blueprint ref: § Glass Island — "Border Radius : 28px (full pill)"
   */
  xxl:  28,
  /**
   * 999px — fully rounded pill / circular.
   * Use on any view where width/height differ or are dynamic — it always resolves
   * to a perfect pill/circle. (React Native: 50% only works on square views.)
   */
  pill: 999,
} as const;

/** All radius scale keys */
export type RadiusKey = keyof typeof radius;

/** Numeric radius value */
export type RadiusValue = (typeof radius)[RadiusKey];

/** Typed interface for the radius scale */
export interface RadiusScale {
  readonly xs:   4;
  readonly sm:   6;
  readonly md:   10;
  readonly lg:   14;
  readonly xl:   20;
  /** 28px — Glass Island capsule (glassIslandHeight 56 ÷ 2) */
  readonly xxl:  28;
  readonly pill: 999;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHADOWS
//
// Source CSS variables (crowd_world_redesigned.html → :root):
//   --shadow-sm  : 0 1px  4px  rgba(0,0,0,.04)
//   --shadow-md  : 0 3px  12px rgba(201,162,39,.15)   ← gold tint
//   --shadow-lg  : 0 8px  32px rgba(0,0,0,.08)
//   --shadow-gold: 0 4px  16px rgba(201,162,39,.40)   ← strong brand glow
//
// React Native shadow model:
//   iOS     → shadowColor · shadowOffset · shadowOpacity · shadowRadius
//   Android → elevation  (+ shadowColor honoured on RN 0.76+ / React Native New Arch)
//
// Both sets of properties live in every shadow object.
// iOS ignores elevation; Android ignores shadow* (except shadowColor on New Arch).
// Usage: style={{ ...shadows.gold }}
//
// ⚠️  Shadows only render on views with an opaque background.
//     Transparent or overflow:hidden views will clip/drop the shadow.
// ─────────────────────────────────────────────────────────────────────────────

/** Reusable shadow color constants (keep aligned with colors.ts) */
const SHADOW_BLACK = '#000000';
const SHADOW_GOLD  = '#C9A227'; // --gold — matches colors.accent

/**
 * Shadow style subset — only the properties that RN shadow APIs accept.
 * Typed as Partial<ViewStyle> so objects spread cleanly into StyleSheet.
 */
export interface ShadowStyle {
  readonly shadowColor?:   string;
  readonly shadowOffset?:  { readonly width: number; readonly height: number };
  readonly shadowOpacity?: number;
  readonly shadowRadius?:  number;
  readonly elevation?:     number;
}

/**
 * Returns a platform-correct shadow object.
 * Internal helper — use `shadows.*` named exports below.
 */
function makeShadow(
  color:   string,
  offsetY: number,
  opacity: number,
  blur:    number,
  elev:    number,
): ShadowStyle {
  return Platform.select<ShadowStyle>({
    ios: {
      shadowColor:   color,
      shadowOffset:  { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius:  blur,
    },
    android: {
      elevation: elev,
    },
    default: {
      shadowColor:   color,
      shadowOffset:  { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius:  blur,
      elevation:     elev,
    },
  }) ?? {};
}

export const shadows = {
  /**
   * sm — --shadow-sm: 0 1px 4px rgba(0,0,0,.04)
   * Subtle neutral lift. List items, input fields, lightly elevated cards.
   * Android elevation 2 → barely-there shadow, no harsh line.
   */
  sm: makeShadow(SHADOW_BLACK, 1, 0.04, 4, 2),

  /**
   * md — --shadow-md: 0 3px 12px rgba(201,162,39,.15)
   * Gold-tinted medium shadow. Standard cards, discover feed posts, room cards.
   * Warm premium tone without overpowering content.
   * Android elevation 5 → visible lift.
   */
  md: makeShadow(SHADOW_GOLD, 3, 0.15, 12, 5),

  /**
   * lg — --shadow-lg: 0 8px 32px rgba(0,0,0,.08)
   * Deep neutral shadow. Modals, bottom sheets, floating action buttons.
   * Neutral black maintains layer clarity over coloured backgrounds.
   * Android elevation 12 → modal-level lift.
   */
  lg: makeShadow(SHADOW_BLACK, 8, 0.08, 32, 12),

  /**
   * gold — --shadow-gold: 0 4px 16px rgba(201,162,39,.40)
   * Strong brand gold glow. Primary CTA buttons, CROWN Pass card,
   * Flash Blast cards, active nav indicator. Most impactful shadow.
   * Android elevation 16 → premium high-priority elevation.
   * (Most-used custom shadow in HTML source — 7 occurrences.)
   */
  gold: makeShadow(SHADOW_GOLD, 4, 0.40, 16, 16),

  /**
   * glass — 0px 8px 32px rgba(20,16,12,0.40)
   * Exclusive to the Glass Island nav bar.
   *
   * Color: #14100C (warm-tinted navy · Part 3 palette update from original
   *   rgba(13,16,24) → rgba(20,16,12) to harmonise with Warm Ink #1A1208).
   * Opacity 0.40 → stronger than lg (0.08) to lift the island distinctly above
   *   both the chat content AND the 64px input area below it.
   *
   * Blueprint refs:
   *   § Glass Island Shadow : "0px 8px 32px rgba(13,16,24,0.35)"
   *   § Part 3 color update : rgba(13,16,24) → rgba(20,16,12) (warm-tinted)
   *   § Design token map    : glass_island_shadow = rgba(13,16,24,0.35)
   *
   * Android elevation 20 → highest elevation in the app, matching z-index 950.
   *
   * Usage: style={{ ...shadows.glass }}
   * ⚠️  Only spread onto views with an opaque/translucent background —
   *     the Glass Island uses rgba(20,16,12,0.85) so this renders correctly.
   */
  glass: makeShadow('#14100C', 8, 0.40, 32, 20),
} as const;

/** All shadow keys */
export type ShadowKey = keyof typeof shadows;

// ─────────────────────────────────────────────────────────────────────────────
// 4. LAYOUT CONSTANTS  —  safe-area-aware structural heights
//
// NON-NEGOTIABLE values per:
//   LAW 15   → TWO-ROW sticky header (Row 1 brand 56px + Row 2 location 44px)
//              headerHeight is the TOTAL (100px) used for scroll insets.
//              Never use headerRow1Height alone as a content offset — content
//              will hide behind the location pills row.
//   Rule 04  → inputAreaHeight (64px) flush above glassIslandHeight (56px) · ZERO gap
//   LAW 13   → glassIslandHeight (56px) is the translateY target for hide animation
//
// These are BASE heights (content zone only — safe-area NOT included).
// Add useSafeAreaInsets() values at runtime:
//
//   Top inset for scroll content  = layout.headerHeight + insets.top
//                                 = 100 + 47  = 147px  (iPhone 14 with safe-area)
//   Input full on-screen height   = layout.inputAreaHeight + insets.bottom
//                                 = 64  + 34  = 98px   (iPhone 14)
//   Glass Island footprint        = layout.glassIslandHeight + layout.glassIslandBottomGap + insets.bottom
//                                 = 56  + 16  + 34     = 106px (iPhone 14)
//   Glass Island bottom position  = layout.glassIslandBottomGap + insets.bottom
//                                 = 16  + 34  = 50px   from screen bottom (iPhone 14)
//
// ─── Full screen stack (6.1" iPhone 14 · 390pt · safe-area-top 47px) ────────
//
//    [0–47px]         safe-area-top (status bar · device-reported)
//    ─────────────────────────────────────────────────────────────────────────
//    [47–103px]       headerRow1Height 56  │ CROWN wordmark · 🔔 · Avatar
//                                         │ z-index 900
//    [103–147px]      headerRow2Height 44  │ 📍 City pill · Sector pill  (LAW 15)
//                                         │ z-index 900  (same sticky layer)
//    ─────────────────────────────────────────────────────────────────────────
//                     ← headerHeight: 100 covers both rows above ────────────
//    ─────────────────────────────────────────────────────────────────────────
//    [147–579px]      Scrollable content  (~400px · 8–10 messages visible)
//    ─────────────────────────────────────────────────────────────────────────
//    [579–643px]      inputAreaHeight 64  │ Chat input · send button
//                                         │ z-index 935  (Rule 04)
//    [643–699px]      glassIslandHeight 56 │ Glass Island (glassIslandWidth 280px · centered)
//                                         │ z-index 950  ← flush above input (Rule 04)
//    [699–715px]      glassIslandBottomGap │ 16px · gap above safe-area-bottom
//    [715–751px]      safe-area-bottom (~34px · home indicator)
//    ─────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  /**
   * 56px — Row 1: Brand Header (LAW 15).
   * Contains CROWN wordmark (left) + Notifications + Profile avatar (right).
   * Add useSafeAreaInsets().top for the full on-screen footprint.
   *
   * ⚠️  Do NOT use this alone as a scroll content inset — use headerHeight (100)
   *     which accounts for both sticky rows.
   */
  headerRow1Height: 56,

  /**
   * 44px — Row 2: Location Row (LAW 15).
   * Contains City picker pill + Sector picker pill.
   * Sticky directly below Row 1 · same z-index 900 · hairline divider below.
   */
  headerRow2Height: 44,

  /**
   * 100px — Total two-row sticky header height (56 + 44 · LAW 15).
   *
   * USE THIS value everywhere a content offset is needed:
   *   scrollIndicatorInsets={{ top: layout.headerHeight }}
   *   contentInset={{ top: layout.headerHeight }}
   *   paddingTop: layout.headerHeight + insets.top
   *
   * Using headerRow1Height (56) alone causes content to be obscured
   * behind the location pills row — a critical layout violation.
   */
  headerHeight: 100,

  /**
   * 280px — Glass Island exact fixed width (LAW 13).
   * Blueprint: "W: 280px (centered) · H: 56px" / "280×56px · 28px radius"
   *
   * This is NOT full-width — the island is a centered floating pill.
   * Without this token, the component stretches to screen width and loses its
   * capsule silhouette, or a developer hardcodes 280 inline (token violation).
   *
   * Usage:
   *   style={{ width: layout.glassIslandWidth, alignSelf: 'center' }}
   */
  glassIslandWidth: 280,

  /**
   * 56px — Glass Island nav bar height (LAW 13).
   * NON-NEGOTIABLE per Rule 04: sits flush directly below inputAreaHeight.
   * This is the translateY target for the LAW 13 hide animation:
   *   Animated.timing(slideY, { toValue: layout.glassIslandHeight, ... })
   */
  glassIslandHeight: 56,

  /**
   * 16px — Gap between the Glass Island and the device safe-area-bottom (LAW 13).
   * Blueprint: "16px above device bottom safe-area" / "16px above safe-area"
   *
   * Positions the island above the iOS home indicator and Android gesture bar.
   * NON-NEGOTIABLE: removing this gap causes the island to overlap the
   * system gesture area and fail tap-target HIG requirements.
   *
   * Usage (absolute bottom positioning):
   *   bottom: layout.glassIslandBottomGap + insets.bottom
   *         = 16 + 34 = 50px from screen bottom (iPhone 14)
   */
  glassIslandBottomGap: 16,

  /**
   * 64px — Sticky chat input area height (Rule 04).
   * NON-NEGOTIABLE: flush above glassIslandHeight with ZERO gap.
   * Absorb useSafeAreaInsets().bottom inside paddingBottom of the input
   * so the text field clears the home indicator.
   */
  inputAreaHeight: 64,
} as const;

/** All layout constant keys */
export type LayoutKey = keyof typeof layout;

/** Numeric layout constant value */
export type LayoutValue = (typeof layout)[LayoutKey];

/** Typed interface for structural layout constants */
export interface LayoutConstants {
  /** 56px — Row 1 brand header: CROWN wordmark · notifications · avatar */
  readonly headerRow1Height: 56;
  /** 44px — Row 2 location row: city pill · sector pill (LAW 15) */
  readonly headerRow2Height: 44;
  /**
   * 100px — Combined two-row sticky header (56 + 44).
   * Use for all scroll content insets and padding calculations.
   * ⚠️  Never substitute headerRow1Height — content will hide under Row 2.
   */
  readonly headerHeight: 100;
  /** 280px — Glass Island fixed width; floating centered pill (not full-width) */
  readonly glassIslandWidth: 280;
  /** 56px — Glass Island height; LAW 13 translateY hide target */
  readonly glassIslandHeight: 56;
  /** 16px — gap between Glass Island bottom and safe-area-bottom (LAW 13) */
  readonly glassIslandBottomGap: 16;
  /** 64px — sticky chat input height; flush above Glass Island per Rule 04 */
  readonly inputAreaHeight: 64;
}

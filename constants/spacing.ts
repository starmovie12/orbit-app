/**
 * CROWN — Design Tokens: Spacing · Radius · Shadows · Layout  v2.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every numeric dimension in the app.
 * NO hardcoded values outside this file — always import and reference tokens.
 *
 * Grid base  : 4 px
 * Brand palette : palette.gold (--color-gold)  ·  palette.warmIvory (--color-warm-ivory)  ·  palette.warmInk (--color-warm-ink)
 *
 * Architecture constraints honoured here:
 *   Rule 04   → inputAreaHeight (64px) sits at bottom: bottomNavHeight (56px); zero gap between input and nav top
 *   LAW 13    → bottomNavHeight (56px) drives the translateY hide/show animation target
 *   LAW 15    → headerHeight (136px) is the three-row header anchor (Row 1 + Row 2 + Row 3)
 *
 * ── v2.1 Changes (PRD v5.1-rev2 compliance) ─────────────────────────────────
 *   FIX 01 — headerRow2Height: 44 → 48  (Row 2 = 4-Scope Chat Switcher, PRD §9.2)
 *   FIX 02 — headerHeight: 100 → 136    (56+48+32 = 136px total, PRD §9.2)
 *   FIX 03 — headerRow3Height: 32 added (Row 3 = Online Count Strip, PRD §9.2)
 *   FIX 04 — glassIslandWidth removed   (Glass Island dead, PRD v5.1-rev2)
 *   FIX 05 — glassIslandHeight renamed → bottomNavHeight (simple fixed full-width nav, PRD §9.3)
 *   FIX 06 — glassIslandBottomGap removed (bottom nav sits at bottom: 0, not floating, PRD §9.3)
 *   FIX 07 — radius.sm: 6 → 8          (button, PRD §19.4)
 *   FIX 08 — radius.md: 10 → 12        (card,   PRD §19.4)
 *   FIX 09 — radius.lg: 14 → 16        (modal,  PRD §19.4)
 *   FIX 10 — radius.xl: 20 → 18        (full pill ≤ 36px H, PRD §19.4)
 *   FIX 11 — radius.xxl: 28 removed    ("28px Glass Island" entry deleted, PRD §19.4 + v5.1-rev2)
 *   FIX 12 — spacing.screenH: 18 → 16  (off 4px grid → lg = 16px, PRD §19.4)
 *   FIX 13 — spacing.card: 14 → 12     (off 4px grid → md = 12px, PRD §19.4)
 *   FIX 14 — spacing.chip: 13 → 12     (off 4px grid → md = 12px, PRD §19.4)
 *   FIX 15 — spacing.xxxxl: 40 added   (PRD §19.4 standard scale: .../32/40/56)
 *   FIX 16 — spacing.xxxxxl: 56 added  (PRD §19.4 standard scale: .../32/40/56)
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   import { spacing, radius, shadows, layout } from '@/constants/spacing';
 *   import type { SpacingScale, RadiusScale, ShadowStyle, LayoutConstants } from '@/constants/spacing';
 *
 *   style={{ padding: spacing.md, borderRadius: radius.lg, ...shadows.gold }}
 */

import { Platform, type ViewStyle } from 'react-native';
import { palette } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// 1. SPACING  —  strict 4-pt grid  (PRD §19.4 base unit: 4px)
//
//   xs    :  4px  →  icon gap, micro padding, tight badge inner space
//   sm    :  8px  →  chip padding, default gap, list item margin
//   md    : 12px  →  card inner padding, button vertical, input padding
//   lg    : 16px  →  section padding, screen horizontal inset
//   xl    : 20px  →  large card padding, modal inner padding
//   xxl   : 24px  →  nav padding, bottom-sheet top, hero sections
//   xxxl  : 32px  →  screen-level section gap, large modal top padding
//   xxxxl : 40px  →  extra-large section gap
//   xxxxxl: 56px  →  matches bottomNavHeight / headerRow1Height
//
//   Standard scale from PRD §19.4: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56
//
//   Derived helpers remain for backward compatibility; they do NOT appear in
//   SpacingScale — use named tokens in new code whenever possible.
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  /** 4px  — micro gap, badge inner, icon spacing */
  xs:     4,
  /** 8px  — chip H-padding, list gap, default gutter */
  sm:     8,
  /** 12px — card inner, button V-padding, input padding */
  md:     12,
  /** 16px — screen H-inset, section padding, card gap */
  lg:     16,
  /** 20px — large card, modal inner, screen V-padding */
  xl:     20,
  /** 24px — nav padding, bottom-sheet top, hero section gap */
  xxl:    24,
  /** 32px — screen-level section separation, large modal top */
  xxxl:   32,
  /** 40px — extra-large section gap (PRD §19.4 standard scale) */
  xxxxl:  40,
  /** 56px — matches bottomNavHeight / headerRow1Height (PRD §19.4 standard scale) */
  xxxxxl: 56,

  // ── Derived helpers (not part of the strict scale) ─────────────────────
  /** 16px — screen horizontal inset (4px-grid aligned; PRD §19.4 base unit: 4px) */
  screenH: 16,
  /** 16px — screen vertical inset (alias for lg, explicit intent) */
  screenV: 16,
  /** 12px — standard card inner padding (4px-grid aligned) */
  card:    12,
  /** 12px — chip/pill horizontal padding (4px-grid aligned) */
  chip:    12,
} as const;

/** Strict 4-pt scale keys — excludes derived helpers */
export type SpacingScaleKey =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | 'xxxl'
  | 'xxxxl'
  | 'xxxxxl';

/** All exported spacing keys (includes derived helpers) */
export type SpacingKey = keyof typeof spacing;

/** Numeric spacing value */
export type SpacingValue = (typeof spacing)[SpacingKey];

/** Typed interface for the strict spacing scale */
export interface SpacingScale {
  readonly xs:     4;
  readonly sm:     8;
  readonly md:     12;
  readonly lg:     16;
  readonly xl:     20;
  readonly xxl:    24;
  readonly xxxl:   32;
  /** 40px — extra-large section gap (PRD §19.4 standard scale) */
  readonly xxxxl:  40;
  /** 56px — matches bottomNavHeight / headerRow1Height (PRD §19.4 standard scale) */
  readonly xxxxxl: 56;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RADIUS  —  component-semantic scale  (PRD §19.4)
//
//   PRD §19.4 mandates: 4 (chip) · 8 (button) · 12 (card) · 16 (modal) · 18 (full pill ≤ 36px H) · 999 (avatar)
//   Bottom nav radius: 0 — flush rectangle (PRD §9.3 · §19.4)
//
//   xs   :   4px  →  chip, tiny badge
//   sm   :   8px  →  buttons, input fields
//   md   :  12px  →  standard cards
//   lg   :  16px  →  modals, bottom sheets, large cards
//   xl   :  18px  →  full pill for components ≤ 36px tall (scope switcher buttons, chips)
//   pill : 999px  →  avatars, online dots, circular buttons
//
//   NOTE: The 28px "Glass Island" radius entry has been deleted (PRD v5.1-rev2 §19.4).
//         Bottom nav has border-radius: 0 — flush rectangle (PRD §9.3).
//
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  /** 4px  — chip, tiny badge, hairline corner (PRD §19.4: "4 (chip)") */
  xs:   4,
  /** 8px  — buttons, input fields (PRD §19.4: "8 (button)") */
  sm:   8,
  /** 12px — standard cards, discover post cards (PRD §19.4: "12 (card)") */
  md:   12,
  /**
   * 16px — modals, bottom sheets, large cards (PRD §19.4: "16 (modal)").
   * Use on any surface that overlays the main content layer.
   */
  lg:   16,
  /**
   * 18px — full pill for components ≤ 36px tall (PRD §19.4: "18 (full pill ≤ 36px H)").
   * Use on scope-switcher buttons, filter chips, and any row-like element whose
   * height is ≤ 36px. Value equals half of 36px — produces a true capsule end-cap.
   * For dynamic or taller components use pill (999) instead.
   */
  xl:   18,
  /**
   * 999px — fully rounded pill / circular.
   * Use on avatars, online-status dots, and any view where width/height differ
   * or are dynamic — it always resolves to a perfect pill/circle.
   * (React Native: 50% only works on square views. 999 is universally safe.)
   * PRD §19.4: "999 (avatar)"
   */
  pill: 999,
} as const;

/** All radius scale keys */
export type RadiusKey = keyof typeof radius;

/** Numeric radius value */
export type RadiusValue = (typeof radius)[RadiusKey];

/** Typed interface for the radius scale (PRD §19.4) */
export interface RadiusScale {
  /** 4px  — chip, tiny badge (PRD §19.4: "4 (chip)") */
  readonly xs:   4;
  /** 8px  — buttons, input fields (PRD §19.4: "8 (button)") */
  readonly sm:   8;
  /** 12px — standard cards (PRD §19.4: "12 (card)") */
  readonly md:   12;
  /** 16px — modals, bottom sheets, large cards (PRD §19.4: "16 (modal)") */
  readonly lg:   16;
  /** 18px — full pill for components ≤ 36px tall (PRD §19.4: "18 (full pill ≤ 36px H)") */
  readonly xl:   18;
  /** 999px — avatars, fully circular elements (PRD §19.4: "999 (avatar)") */
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

/** Reusable shadow color constants — sourced from palette (keep aligned with colors.ts) */
const SHADOW_BLACK = palette.black;           // pure black  — neutral shadows
const SHADOW_GOLD  = palette.gold;            // brand gold  — matches --color-gold

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
      elevation:   elev,
      shadowColor: color,  // honoured on RN 0.76+ / React Native New Architecture
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
   * navDivider — box-shadow: 0 -1px 0 rgba(0,0,0,0.04)
   * Exclusive to the full-width bottom navigation bar (PRD §9.3.1).
   *
   * A hair-thin upward shadow that separates the nav bar from the chat
   * content during scroll-up reveal. Works in tandem with the component's
   * `borderTopWidth: 1` / `borderTopColor: colors.border.subtle`.
   *
   * iOS:     shadowOffset { height: -1 } casts the shadow above the nav bar.
   * Android: elevation: 0 — the `borderTopWidth` in the component handles
   *          separation visually (Android elevation only casts downward).
   *
   * Blueprint ref: §9.3.1 `box-shadow: 0 -1px 0 rgba(0,0,0,.04)` (the only divider)
   * Bottom nav: simple, full-width, fixed. No backdrop-filter. No transparency. No floating.
   *
   * Usage: style={{ ...shadows.navDivider }}
   */
  navDivider: makeShadow(SHADOW_BLACK, -1, 0.04, 0, 0),
} as const;

/** All shadow keys */
export type ShadowKey = keyof typeof shadows;

// ─────────────────────────────────────────────────────────────────────────────
// 4. LAYOUT CONSTANTS  —  safe-area-aware structural heights
//
// NON-NEGOTIABLE values per:
//   LAW 15   → THREE-ROW sticky header (Row 1 brand 56px + Row 2 scope-switcher 48px + Row 3 online strip 32px)
//              headerHeight is the TOTAL (136px) used for scroll insets.
//              Never use headerRow1Height (56) or headerRow2Height (48) alone as a content
//              offset — content will hide behind one or more of the remaining rows.
//   Rule 04  → inputAreaHeight (64px) flush above bottomNavHeight (56px) · ZERO gap
//   LAW 13   → bottomNavHeight (56px) is the translateY(100%) target for the hide animation
//
// NOTE: Glass Island has been removed from the design (PRD v5.1-rev2, Founder-locked).
//       The bottom nav is now a simple, full-width, fixed bar at bottom: 0.
//       No floating offset. No rounded corners. No backdrop-filter.
//       See PRD §9.3 — §9.3.7 for the full spec and rationale.
//
// These are BASE heights (content zone only — safe-area NOT included).
// Add useSafeAreaInsets() values at runtime:
//
//   Top inset for scroll content  = layout.headerHeight + insets.top
//                                 = 136 + 47  = 183px  (iPhone 14 with safe-area)
//   Input full on-screen height   = layout.inputAreaHeight + insets.bottom
//                                 = 64  + 34  = 98px   (iPhone 14)
//   Bottom nav full height        = layout.bottomNavHeight + insets.bottom
//                                 = 56  + 34  = 90px   (iPhone 14, via padding-bottom)
//   Input bottom (nav visible)    = layout.bottomNavHeight + insets.bottom
//                                 = 56  + 34  = 90px   (chat input sits above nav)
//   Input bottom (nav hidden)     = insets.bottom
//                                 = 34px      (input fills vacated nav space, PRD §9.3.5)
//
// ─── Full screen stack (6.1" iPhone 14 · 390pt · safe-area-top 47px) ────────
//
//    [0–47px]          safe-area-top (status bar · device-reported)
//    ─────────────────────────────────────────────────────────────────────────
//    [47–103px]        headerRow1Height 56  │ CROWN wordmark · 🔔 Bell · 💬 DM
//                                          │ z-index 900
//    [103–151px]       headerRow2Height 48  │ 4-scope switcher (🌍 World · 🇮🇳 India · 🏙️ City · 🏘️ Sector)
//                                          │ z-index 900  (same sticky layer)
//    [151–183px]       headerRow3Height 32  │ Online count strip (PRD §9.2 Row 3)
//                                          │ z-index 900  (same sticky layer)
//    ─────────────────────────────────────────────────────────────────────────
//                      ← headerHeight: 136 covers all three rows above ───────
//    ─────────────────────────────────────────────────────────────────────────
//    [183–690px]       Scrollable content  (~507px · 10–13 messages visible)
//    ─────────────────────────────────────────────────────────────────────────
//    [690–754px]       inputAreaHeight 64  │ Chat input · send button
//                                         │ z-index 935  (Rule 04)
//    [754–810px]       bottomNavHeight 56  │ Bottom nav (full-width, edge-to-edge)
//                                         │ z-index 950  ← flush above input (Rule 04)
//    [810–844px]       safe-area-bottom (~34px · home indicator via padding-bottom)
//    ─────────────────────────────────────────────────────────────────────────
//    Total: 47 + 136 + 507 + 64 + 56 + 34 = 844px ✓ (iPhone 14 screen height)
//
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  /**
   * 56px — Row 1: Brand Header (LAW 15 · PRD §9.2 "Row 1 — Brand & Quick Actions (56px H)").
   * Contains CROWN wordmark (left) + Notification bell + DM icon (right).
   * ⚠️  PRD Rule 03: User avatar is NEVER in the header — it lives exclusively in the
   *     bottom nav's Profile tab (rightmost cell). Placing avatar here is a
   *     constitutional violation.
   * Add useSafeAreaInsets().top for the full on-screen footprint.
   *
   * ⚠️  Do NOT use this alone as a scroll content inset — use headerHeight (136)
   *     which accounts for all three sticky rows.
   */
  headerRow1Height: 56,

  /**
   * 48px — Row 2: 4-Scope Chat Switcher (LAW 15 · PRD §9.2 "Row 2 — The 4-Scope Chat Switcher (48px H)").
   * Contains four equal-width segmented buttons: 🌍 World · 🇮🇳 India · 🏙️ City · 🏘️ Sector.
   * Sticky directly below Row 1 · same z-index 900 · moves as one block with Row 1 and Row 3.
   *
   * Exception (PRD §9.2): Row 2 NEVER hides when the user is composing a message (input
   * focused) — so users can re-target their message scope without scrolling up.
   */
  headerRow2Height: 48,

  /**
   * 32px — Row 3: Online Count Strip (LAW 15 · PRD §9.2 "Row 3 — Online Count Strip (32px H)").
   * Displays live online count for the currently-active scope, e.g. "🟡 12.4M India mein online".
   * Always names the active scope's geography (PRD §9.2 Founder mandate).
   * Sticky directly below Row 2 · same z-index 900 · part of the unified three-row header block.
   */
  headerRow3Height: 32,

  /**
   * 136px — Total three-row sticky header height (56 + 48 + 32 · LAW 15 · PRD §9.2).
   *
   * USE THIS value everywhere a content offset is needed:
   *   scrollIndicatorInsets={{ top: layout.headerHeight }}
   *   contentInset={{ top: layout.headerHeight }}
   *   paddingTop: layout.headerHeight + insets.top
   *
   * Using headerRow1Height (56) or headerRow2Height (48) alone causes content to be
   * obscured behind one or more of the remaining sticky rows — a critical layout violation.
   */
  headerHeight: 136,

  /**
   * 56px — Bottom navigation bar height (LAW 13 · PRD §9.3.1).
   *
   * The bottom nav is a SIMPLE, FULL-WIDTH, FIXED BAR (PRD v5.1-rev2, Founder-locked).
   * - position: fixed · bottom: 0 · left: 0 · right: 0 · width: 100vw
   * - border-radius: 0 (flush rectangle — no rounded corners)
   * - No backdrop-filter. No transparency. No floating.
   * - Safe-area handled via padding-bottom: env(safe-area-inset-bottom)
   *   (total visible height = 56px + ~34px = 90px on iPhone 14)
   *
   * This is the translateY(100%) target for the LAW 13 hide animation:
   *   Animated.timing(slideY, { toValue: layout.bottomNavHeight, ... })
   *
   * Chat input positioning (PRD §9.3.5 gap-fill trick):
   *   Nav visible  → input bottom: layout.bottomNavHeight + insets.bottom
   *   Nav hidden   → input bottom: insets.bottom   (fills the vacated space)
   */
  bottomNavHeight: 56,

  /**
   * 64px — Sticky chat input area height (Rule 04).
   * NON-NEGOTIABLE: flush above bottomNavHeight with ZERO gap.
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
  /**
   * 56px — Row 1 brand header: CROWN wordmark · bell · DM icon.
   * Avatar lives in the bottom nav Profile tab — NEVER in the header (PRD Rule 03).
   */
  readonly headerRow1Height: 56;
  /**
   * 48px — Row 2 four-scope chat switcher: World · India · City · Sector (PRD §9.2).
   * Never hidden when input is focused (PRD §9.2 exception).
   */
  readonly headerRow2Height: 48;
  /** 32px — Row 3 online count strip; always names the active scope's geography (PRD §9.2) */
  readonly headerRow3Height: 32;
  /**
   * 136px — Combined three-row sticky header (56 + 48 + 32).
   * Use for all scroll content insets and padding calculations.
   * ⚠️  Never substitute any individual row height — content will hide under the remaining rows.
   */
  readonly headerHeight: 136;
  /**
   * 56px — Simple fixed full-width bottom nav height (PRD §9.3.1).
   * LAW 13 translateY(100%) hide target.
   * Chat input sits at bottom: bottomNavHeight (nav visible) or bottom: 0 (nav hidden).
   */
  readonly bottomNavHeight: 56;
  /** 64px — sticky chat input height; flush above bottom nav per Rule 04 */
  readonly inputAreaHeight: 64;
}

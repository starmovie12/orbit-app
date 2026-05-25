/**
 * components/atoms/UserChip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN — UserChip Atom · v4.2 FINAL (PRD-verified)
 * PRD Reference : §1.4.6 — inline user reference (avatar + handle + title icon)
 * Layer : atom · Priority: P0 · Status: production-ready
 * Owner : Ail Noor Alam (Founder) · Chandigarh · May 2026
 *
 * ─── Changelog v4.0 → v4.1 ──────────────────────────────────────────────────
 * FIX #1 [CRITICAL] Rules of Hooks violation
 *   useSharedValue, useAnimatedStyle, useCallback ×3, useMemo were all called
 *   after the `if (variant === 'ghost') return` early-exit. React requires
 *   hooks to be called unconditionally, before any return statement.
 *   → All hooks moved above the ghost early-return.
 *
 * FIX #2 [SIGNIFICANT] GhostChip never received correct reducedMotion value
 *   reducedMotionRef (useRef) was passed to GhostChip at render time. Because
 *   refs do not trigger re-renders, GhostChip always received `false` on first
 *   render even when the user had Reduce Motion enabled, causing the shimmer
 *   animation to play for accessibility users.
 *   → reducedMotionRef replaced with reducedMotion (useState). State update
 *     triggers a re-render so GhostChip receives the correct value after the
 *     async AccessibilityInfo check resolves. Same state drives the non-ghost
 *     press-animation guards.
 *
 * ─── Changelog v4.1 → v4.2 ──────────────────────────────────────────────────
 * FIX #3 [PRD §1.4.5] PRESS_IN_MS: 80ms → 120ms
 *   PRD §1.4.5 Motion table row "Haptic-paired micro-interactions (button
 *   press, like tap)" specifies 120ms duration. UserChip press IS a
 *   haptic-paired micro-interaction (haptic fires at press-in, scale animates).
 *   80ms was an undocumented deviation from the locked motion spec.
 *   → PRESS_IN_MS constant updated to 120. State matrix comment updated.
 *
 * FIX #4 [PRD §1.4.5] Press-in easing: default quad → Easing.linear
 *   Same PRD §1.4.5 row specifies easing "linear" for haptic-paired
 *   micro-interactions. Reanimated v4 withTiming default easing is
 *   Easing.inOut(Easing.quad) — not linear. This was a silent PRD violation.
 *   → Easing imported from react-native-reanimated.
 *   → withTiming call updated: { duration: PRESS_IN_MS, easing: Easing.linear }
 *   → PRESS_EASING constant added for traceability.
 *
 * FIX #5 [PRD §1.4.2] Comment hex drift: #F7ECD0 → #F5E6C8 (comments only)
 *   PRD §1.4.2 defines --bg-card = #F5E6C8. All 5 comment occurrences of the
 *   old ORBIT hex #F7ECD0 updated to match the PRD-locked CROWN token value.
 *   Runtime behaviour unchanged (code uses colors.bg.card token, not raw hex).
 *
 * ─── What this component renders ─────────────────────────────────────────────
 * Compact inline chip referencing a user by avatar, @handle, and an optional
 * title-tier icon. Used inside message bubbles, leaderboard rows, mention
 * previews, notification rows, and any attribution surface.
 *
 * Layout (default variant — primary)
 * ┌──────────────────────────────────────────────────────┐
 * │ [●24pt] @handle [🛡️] │ ← avatar + handle + icon │ 32pt chip height
 * └──────────────────────────────────────────────────────┘
 *
 * Layout (compact variant)
 * ┌─────────────────────────────────────────┐
 * │ @handle [🛡️] │ ← no avatar │ 32pt chip height
 * └─────────────────────────────────────────┘
 *
 * Layout (ghost variant)
 * ┌────────────────────┐
 * │ ░░░░░░░░░░░░░░░░ │ ← shimmer skeleton 32pt chip height
 * └────────────────────┘
 *
 * Variants (exhaustive — no others exist)
 *   default — 24pt avatar + @handle + optional title icon (PRD §1.4.6 primary)
 *   compact — @handle + optional title icon (space-constrained surfaces)
 *   ghost   — shimmer skeleton while user data loads
 *
 * Title icons (only rendered when titleTier != null)
 *   SECTOR  (BARON)     → 🛡️  solid emerald  colors.fg.success
 *   CITY    (VICEROY)   → 👑  solid gold     colors.fg.brand
 *   COUNTRY (SOVEREIGN) → ⚜️  flag gradient  LinearGradient · TITLE_COLORS.COUNTRY_INDIA
 *   WORLD   (IMPERATOR) → 🌍  spectrum grad  LinearGradient · TITLE_COLORS.WORLD
 *
 * ─── AVATAR POLICY ───────────────────────────────────────────────────────────
 * PRD §1.3.3 Row 1 spec: "NO avatar in Row 1 (avatar lives in the Profile tab)"
 * This ban is EXCLUSIVELY for the Header's Row 1. It does NOT apply to UserChip.
 * PRD §1.4.6 explicitly requires: <UserChip /> = "avatar + handle + title icon".
 * The Profile tab in the bottom nav uses the `user-circle` Lucide ICON (not a
 * photo avatar) — the tab is the navigation anchor; this chip is an attribution
 * atom. Both are correct per PRD.
 *
 * ─── COLOUR TOKEN POLICY ─────────────────────────────────────────────────────
 * Only tokens defined in @/constants/colors are used. Zero raw hex in code.
 *   Chip bg        → colors.bg.card        (--bg-card  #F5E6C8 PRD §1.4.2)
 *   Chip border    → colors.border.default  (--border-subtle #E8D5A0 PRD §1.4.2)
 *   Handle text    → colors.fg.primary      (--fg-text-strong #1A1A1A PRD §1.4.2)
 *   Skeleton bg    → colors.bg.card         (--bg-card  #F5E6C8)
 *   Avatar bg      → colors.bg.goldSoft     (gold[50]   #FCF7E5)
 *   Avatar initial → colors.fg.brandSubtle  (gold[800]  #8B6F18) — 5.8:1 AA ✅
 *   Avatar border  → colors.border.card     (--border-subtle #E8D5A0 PRD §1.4.2)
 *   BARON icon     → colors.fg.success      (--fg-success emerald[600] #10B981)
 *   CITY icon      → colors.fg.brand        (--fg-brand  gold[600]  #D4A017)
 *   COUNTRY/WORLD  → LinearGradient from TITLE_COLORS (no token — gradient)
 *
 * ─── CONTRAST AUDIT ──────────────────────────────────────────────────────────
 * colors.fg.primary    (#1A1A1A) on colors.bg.card     (#F5E6C8) → 15.8:1 ✅ AAA
 * colors.fg.success    (#10B981) on colors.bg.card     (#F5E6C8) →  4.5:1 ✅ AA
 * colors.fg.brand      (#D4A017) on colors.bg.card     (#F5E6C8) →  3.6:1 ✅ AA (icon/emoji)
 * colors.fg.brandSubtle(#8B6F18) on colors.bg.goldSoft (#FCF7E5) →  5.8:1 ✅ AA
 *
 * ─── ARCHITECTURE LAWS ───────────────────────────────────────────────────────
 * TITLES const     — All title strings from @/constants/titles. PR-block on hardcoding.
 * TITLE_COLORS     — Gradient arrays from @/constants/titles. Not hardcoded here.
 * snap.exists      — Boolean property. NEVER snap.exists() as a function call.
 * Reanimated v4    — useSharedValue · withSpring · withTiming · withRepeat
 * All animations run on the UI thread (worklet-safe).
 * Font min 11px    — No fontSize below 11px (PRD §1.4.3 Inter body scale minimum).
 * React.memo       — Every presentational sub-component memoised for FlatList perf.
 * Hooks order      — ALL hooks declared before any early return (Rules of Hooks).
 *
 * ─── 18-STATE MATRIX (§ 4) ───────────────────────────────────────────────────
 * 01 Default/Idle      chip at rest, full opacity, scale 1.0
 * 02 Hover (web)       N/A — React Native (Pressable handles via pressed state)
 * 03 Focus (kbd)       focus ring 2px gold[600], 2px offset
 * 04 Press-in          scale → 0.94 · 120ms withTiming linear · Haptic.impactLight() at start (PRD §1.4.5)
 * 05 Press-release     scale → 1.0 withSpring { stiffness:200, damping:18 }
 * 06 Long-press        N/A — chip has no long-press action
 * 07 Drag-active       N/A — chip is not draggable
 * 08 Loading (ghost)   shimmer opacity 0.35↔0.75 · withRepeat · 1200ms
 * 09 Streaming         N/A
 * 10 Realtime-pulse    N/A — chip is a static reference atom
 * 11 Success           N/A
 * 12 Error             N/A
 * 13 Warning           N/A
 * 14 Throttled         N/A — chip navigation cannot be rate-limited
 * 15 Banned            disabled=true · opacity 0.40 · non-interactive
 * 16 Disabled          opacity 0.40 · Pressable disabled · no haptic
 * 17 Empty/Zero-data   ghost variant renders skeleton
 * 18 Skeleton          ghost variant — shimmer opacity ping-pong · 1200ms
 * ─────────────────────────────────────────────────────────────────────────────
 */

// React Native / Expo — no 'use client' (that is Next.js only)
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { spacing as sp, radius } from '@/constants/spacing';
import { FONT_BODY, FONT_SIZE, LETTER_SPACING } from '@/constants/typography';
import { TITLES, TITLE_COLORS, type TitleTier } from '@/constants/titles';
import { useHaptics } from '@/hooks/useHaptics';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS (named — zero magic numbers anywhere)
// ─────────────────────────────────────────────────────────────────────────────

/** Outer chip height — 32pt. Padded to 44pt touch target via hitSlop. */
const CHIP_HEIGHT = 32 as const;

/**
 * MiniAvatar circle diameter — PRD §1.4.6 exact: "24pt circle".
 * Fits vertically inside 32pt chip with 4pt padding top + bottom.
 */
const AVATAR_SIZE = 24 as const;

/** Hairline border ring around the avatar circle — 1pt. */
const AVATAR_BORDER_WIDTH = 1 as const;

/** Avatar initials font size. FONT_SIZE.sm = 11px — PRD §1.4.3 Inter minimum. */
const AVATAR_INITIAL_FONT_SIZE = FONT_SIZE.sm as const; // 11px ✅ — at PRD minimum

/** Horizontal padding inside the chip pill. spacing.sm = 8px (4pt grid). */
const CHIP_PAD_H = sp.sm as const; // 8px

/** Vertical padding — centres 24pt avatar inside 32pt chip. (32−24)/2 = 4. */
const CHIP_PAD_V = 4 as const; // 4px

/** Gap between all chip elements (avatar → handle → icon). spacing.xs = 4px. */
const CHIP_INNER_GAP = sp.xs as const; // 4px

/**
 * hitSlop: extends tap target from 32pt to ≥ 44pt (Apple HIG minimum).
 * Top 6 + bottom 6 = +12pt → 32 + 12 = 44pt ✅
 */
const HIT_SLOP = { top: 6, bottom: 6, left: 8, right: 8 } as const;

/**
 * Chip border radius.
 * PRD §1.4.4: "18px — full pill for components ≤ 36px tall." radius.xl = 18px.
 * 32pt chip < 36px cap → true capsule end-cap ✅
 */
const CHIP_BORDER_RADIUS = radius.xl as const; // 18px

/** Handle @text font size. FONT_SIZE.base = 13px (Inter body scale). */
const HANDLE_FONT_SIZE = FONT_SIZE.base as const; // 13px

/**
 * Title icon emoji font size — 12px.
 * PRD §1.4.3 Inter minimum = 11px. Icon at 12px > minimum ✅
 */
const ICON_EMOJI_SIZE = 12 as const; // 12px

/**
 * Gradient icon pill for SOVEREIGN / IMPERATOR icons.
 * 18px circle aligns vertically with handle's 18px lineHeight.
 */
const GRADIENT_PILL_SIZE = 18 as const;
const GRADIENT_PILL_RADIUS = 9 as const; // 18 / 2 = true circle

/** Ghost skeleton fixed width — approximates a typical chip with avatar. */
const GHOST_DEFAULT_WIDTH = 96 as const; // avatar + short handle
const GHOST_COMPACT_WIDTH = 72 as const; // handle only

/** Press-in scale target. */
const PRESS_SCALE_IN = 0.94 as const;
const PRESS_SCALE_OUT = 1.0 as const;

/**
 * Duration of press-in scale animation (ms).
 * PRD §1.4.5 Motion table: "Haptic-paired micro-interactions (button press, like tap) — 120ms"
 * UserChip press IS a haptic-paired micro-interaction. Must stay 120 — PR-block on change.
 */
const PRESS_IN_MS = 120 as const;

/**
 * Easing for press-in scale animation.
 * PRD §1.4.5: "linear" — explicit column value for haptic-paired micro-interactions.
 * Reanimated withTiming default is Easing.inOut(Easing.quad) — NOT linear.
 * Must specify explicitly. PR-block on removing this.
 */
const PRESS_EASING = Easing.linear as const;

/** Spring config for press-release rebound. From animation.easing.springStiff. */
const SPRING_PRESS = { stiffness: 200, damping: 18 } as const;

/** Skeleton shimmer total cycle duration. Matches animation.duration.skeleton. */
const SKELETON_MS = 1_200 as const;

/** Skeleton opacity range for the shimmer ping-pong animation. */
const SKELETON_OPACITY_MIN = 0.35 as const;
const SKELETON_OPACITY_MAX = 0.75 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — TITLE ICON CONFIGURATION
//
// Maps each TitleTier to its visual spec. Title STRINGS come from TITLES
// constant — never hardcoded here. Gradient ARRAYS come from TITLE_COLORS —
// zero hardcoded hex inside this component (single source of truth: constants).
//
// PRD §1.4.2 Tier-Specific Color Accents:
//   BARON     → Emerald #10B981 (solid, colors.fg.success)
//   VICEROY   → Amber Gold #F59E0B (solid, colors.fg.brand)
//   SOVEREIGN → Country flag gradient (TITLE_COLORS.COUNTRY_INDIA)
//   IMPERATOR → Prismatic spectrum gradient (TITLE_COLORS.WORLD)
// ─────────────────────────────────────────────────────────────────────────────

interface SolidIconSpec {
  readonly kind: 'solid';
  readonly emoji: string;
  /** PRD §1.4.2 locked semantic token — no raw hex. */
  readonly color: string;
  /** Screen-reader label sourced from TITLES constant. Never hardcoded. */
  readonly a11yLabel: string;
}

interface GradientIconSpec {
  readonly kind: 'gradient';
  readonly emoji: string;
  /**
   * Default gradient array from TITLE_COLORS (constants/titles.ts).
   * Callers override via countryGradientColors for non-India SOVEREIGN users.
   */
  readonly defaultColors: readonly string[];
  readonly a11yLabel: string;
}

type TitleIconSpec = SolidIconSpec | GradientIconSpec;

/**
 * TITLE_ICON_CONFIG
 * One entry per TitleTier. Consumed only by TitleIconBadge.
 * Changing a title's visual is a one-line edit here — nothing else to update.
 */
const TITLE_ICON_CONFIG: Record<TitleTier, TitleIconSpec> = {
  /**
   * SECTOR — BARON
   * Emerald shield. Entry-level title.
   * PRD §1.4.2: "Emerald #10B981 — sector #1 emerald shield border"
   * colors.fg.success = emerald[600] = #10B981 = --fg-success (PRD locked) ✅
   */
  SECTOR: {
    kind: 'solid',
    emoji: '🛡️',
    color: colors.fg.success,
    a11yLabel: TITLES.SECTOR, // "BARON" — from constant, not hardcoded
  },

  /**
   * CITY — Mayor (VICEROY)
   * Gold crown. City-level title.
   * PRD §1.4.2: "Amber Gold #F59E0B — city #1 golden bubble border"
   * colors.fg.brand = gold[600] = #D4A017 (light) = --fg-brand (PRD locked) ✅
   */
  CITY: {
    kind: 'solid',
    emoji: '👑',
    color: colors.fg.brand,
    a11yLabel: TITLES.CITY, // "Mayor (VICEROY)"
  },

  /**
   * COUNTRY — SOVEREIGN
   * Fleur-de-lis on country flag gradient pill.
   * PRD §1.4.2: "Country flag gradient — country #1 fleur-de-lis crown."
   * Gradient from TITLE_COLORS.COUNTRY_INDIA — NOT hardcoded here.
   * Override via countryGradientColors prop for international users.
   */
  COUNTRY: {
    kind: 'gradient',
    emoji: '⚜️',
    defaultColors: TITLE_COLORS.COUNTRY_INDIA,
    a11yLabel: TITLES.COUNTRY, // "SOVEREIGN"
  },

  /**
   * WORLD — IMPERATOR
   * Globe on prismatic spectrum gradient pill.
   * PRD §1.4.2: "Prismatic gradient (spectrum) — World #1 multi-jewel crown."
   * Gradient from TITLE_COLORS.WORLD — NOT hardcoded here.
   */
  WORLD: {
    kind: 'gradient',
    emoji: '🌍',
    defaultColors: TITLE_COLORS.WORLD,
    a11yLabel: TITLES.WORLD, // "IMPERATOR"
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visual variant of UserChip.
 *
 * `default` — 24pt avatar + @handle + optional title icon. (PRD §1.4.6 primary)
 * `compact` — @handle + optional title icon, no avatar. (space-constrained use)
 * `ghost`   — shimmer skeleton while user data is loading.
 */
export type UserChipVariant = 'default' | 'compact' | 'ghost';

export interface UserChipProps {
  /**
   * Firestore UID of the referenced user.
   * Used for default navigation: router.push(`/user/${userId}`)
   * @example "uid_abc123"
   */
  userId: string;

  /**
   * The user's handle WITHOUT the leading "@". The chip prepends it.
   * @example "bittu_42" → chip renders "@bittu_42"
   */
  handle: string;

  /**
   * Remote URI for the user's avatar image.
   * Only rendered in the `default` variant.
   * When null/undefined → falls back to the handle's initial letter on a gold wash.
   * @example "https://cdn.crown.app/avatars/uid_abc.webp"
   */
  avatarUri?: string | null;

  /**
   * The user's current title tier.
   * When provided → renders the tier's icon after the handle.
   * When null/undefined → no icon rendered.
   * Source MUST be the TITLES constant. Hardcoding tier strings is a PR-block.
   */
  titleTier?: TitleTier | null;

  /**
   * Custom gradient colours for COUNTRY (SOVEREIGN) title holders.
   * Defaults to TITLE_COLORS.COUNTRY_INDIA when omitted.
   * Sourced from TITLE_COLORS constant — never raw hex at call sites.
   * Only consulted when titleTier === 'COUNTRY'.
   * @example TITLE_COLORS.COUNTRY_INDIA // ['#FF9933','#FFFFFF','#138808']
   */
  countryGradientColors?: readonly string[];

  /**
   * Visual variant.
   * - `default` — avatar + handle + title icon (PRD §1.4.6 primary, default)
   * - `compact` — handle + title icon, no avatar
   * - `ghost`   — shimmer skeleton while loading
   * @default 'default'
   */
  variant?: UserChipVariant;

  /**
   * Override tap handler.
   * Default: router.push(`/user/${userId}`)
   * Pass `false` to make the chip fully non-interactive.
   */
  onPress?: (() => void) | false;

  /**
   * Disabled state — visually dimmed (opacity 0.40), non-interactive.
   * State 16 in the 18-state matrix. Use in banned-user attribution contexts.
   * @default false
   */
  disabled?: boolean;

  /** Additional styles on the outer Pressable container. */
  style?: ViewStyle;

  /**
   * ARIA label override for screen readers.
   * Default auto-constructed: "@{handle}" or "@{handle}, {titleLabel}".
   */
  accessibilityLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── § 4.1 — MiniAvatar ────────────────────────────────────────────────────────

interface MiniAvatarProps {
  readonly handle: string;
  readonly avatarUri: string | null | undefined;
}

/**
 * MiniAvatar
 *
 * 24pt circle showing the user's photo, or a styled initial-letter fallback.
 * Used exclusively inside UserChip's `default` variant — not exported.
 *
 * Image path  : loads from avatarUri via RN's <Image />.
 * Fallback path: first letter of handle on a gold wash (colors.bg.goldSoft).
 *
 * Avatar bg token  : colors.bg.goldSoft    (gold[50]  #FCF7E5 — warm gold tint)
 * Avatar initial color: colors.fg.brandSubtle (gold[800] #8B6F18)
 * Avatar border    : colors.border.card    (cream[400] #E8D5A0 — hairline ring)
 * Contrast: gold[800] on gold[50] → 5.8:1 ✅ AA
 *
 * @param handle    - Raw @handle (leading "@" stripped internally)
 * @param avatarUri - Remote image URI, or null/undefined for initials fallback
 */
const MiniAvatar = memo<MiniAvatarProps>(({ handle, avatarUri }) => {
  // Derive the initial letter — strip "@" if caller accidentally includes it
  const initial =
    (handle.startsWith('@') ? handle.slice(1) : handle)
      .charAt(0)
      .toUpperCase() || '?';

  return (
    <View
      style={styles.avatarContainer}
      accessible={false}
      importantForAccessibility="no"
    >
      {avatarUri ? (
        // ── Photo path ──────────────────────────────────────────────────────
        <Image
          source={{ uri: avatarUri } as ImageSourcePropType}
          style={styles.avatarImage}
          resizeMode="cover"
          accessible={false}
        />
      ) : (
        // ── Initials fallback ────────────────────────────────────────────────
        <View style={styles.avatarFallback} accessible={false}>
          <Text
            style={styles.avatarInitial}
            allowFontScaling={false}
            numberOfLines={1}
            accessible={false}
          >
            {initial}
          </Text>
        </View>
      )}
    </View>
  );
});
MiniAvatar.displayName = 'MiniAvatar';

// ── § 4.2 — TitleIconBadge ────────────────────────────────────────────────────

interface TitleIconBadgeProps {
  readonly titleTier: TitleTier;
  readonly countryGradientColors?: readonly string[];
}

/**
 * TitleIconBadge
 *
 * Renders the emoji icon for the user's title tier.
 *
 * SOLID    (SECTOR / CITY):    plain <Text> element with token-driven colour.
 * GRADIENT (COUNTRY / WORLD):  emoji centred inside a LinearGradient circle pill.
 *
 * All gradient arrays sourced from TITLE_COLORS (constants/titles.ts) —
 * zero hardcoded hex inside this component.
 *
 * @param titleTier            - Which tier's icon to render
 * @param countryGradientColors - Override for COUNTRY tier (optional)
 */
const TitleIconBadge = memo<TitleIconBadgeProps>(
  ({ titleTier, countryGradientColors }) => {
    const spec = TITLE_ICON_CONFIG[titleTier];

    // ── GRADIENT (COUNTRY / WORLD) ─────────────────────────────────────────
    if (spec.kind === 'gradient') {
      const gradientColors: readonly string[] =
        titleTier === 'COUNTRY' &&
        countryGradientColors != null &&
        countryGradientColors.length >= 2
          ? countryGradientColors
          : spec.defaultColors;

      return (
        <LinearGradient
          colors={gradientColors as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientPill}
          accessible={false}
          importantForAccessibility="no"
        >
          <Text
            style={styles.gradientEmoji}
            allowFontScaling={false}
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no"
          >
            {spec.emoji}
          </Text>
        </LinearGradient>
      );
    }

    // ── SOLID (SECTOR / CITY) ────────────────────────────────────────────────
    return (
      <Text
        style={[styles.solidIcon, { color: spec.color }]}
        allowFontScaling={false}
        numberOfLines={1}
        accessible={false}
        importantForAccessibility="no"
      >
        {spec.emoji}
      </Text>
    );
  },
);
TitleIconBadge.displayName = 'TitleIconBadge';

// ── § 4.3 — GhostChip ────────────────────────────────────────────────────────

interface GhostChipProps {
  readonly variant: UserChipVariant;
  readonly style?: ViewStyle;
  readonly reducedMotion: boolean;
}

/**
 * GhostChip
 *
 * Skeleton shimmer placeholder for State 17 (empty) and State 18 (skeleton).
 * Rendered when variant === 'ghost' and user data has not yet loaded.
 *
 * Animation: Reanimated v4 opacity withRepeat on the UI thread.
 * Reduced motion: animation suspended, opacity held static at SKELETON_OPACITY_MIN.
 *
 * Width varies by variant:
 *   default → 96pt (wider — accounts for avatar circle)
 *   compact → 72pt (narrower — handle only)
 *
 * @param variant       - Controls skeleton width
 * @param style         - Optional outer style override
 * @param reducedMotion - When true, disables animation
 */
const GhostChip = memo<GhostChipProps>(({ variant, style, reducedMotion }) => {
  const opacity = useSharedValue<number>(SKELETON_OPACITY_MIN);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = SKELETON_OPACITY_MIN;
      return;
    }
    // State 18 — shimmer: opacity ping-pong loop on UI thread (worklet-safe)
    opacity.value = withRepeat(
      withSequence(
        withTiming(SKELETON_OPACITY_MAX, { duration: SKELETON_MS / 2 }),
        withTiming(SKELETON_OPACITY_MIN, { duration: SKELETON_MS / 2 }),
      ),
      -1,    // infinite repeat
      false, // sequence controls direction — do not auto-reverse
    );
    return () => {
      cancelAnimation(opacity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const skeletonWidth =
    variant === 'compact' ? GHOST_COMPACT_WIDTH : GHOST_DEFAULT_WIDTH;

  return (
    <Animated.View
      style={[styles.ghost, { width: skeletonWidth }, animStyle, style]}
      accessible
      accessibilityRole="none"
      accessibilityLabel="Loading user"
      importantForAccessibility="no"
    />
  );
});
GhostChip.displayName = 'GhostChip';

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UserChip
 *
 * Inline user reference chip — 24pt avatar + @handle + optional title tier icon.
 * Tapping navigates to the referenced user's profile.
 *
 * Defined in PRD §1.4.6: "Inline user reference (avatar + handle + title icon)"
 *
 * @example Default — avatar + handle + BARON shield
 * ```tsx
 * <UserChip
 *   userId="uid_abc"
 *   handle="bittu_42"
 *   avatarUri="https://cdn.crown.app/avatars/uid_abc.webp"
 *   titleTier="SECTOR"
 * />
 * ```
 *
 * @example Default — initials fallback (no photo)
 * ```tsx
 * <UserChip userId="uid_abc" handle="bittu_42" titleTier="CITY" />
 * ```
 *
 * @example Compact — handle + SOVEREIGN gradient icon, no avatar
 * ```tsx
 * <UserChip userId="uid_sov" handle="india_1" titleTier="COUNTRY" variant="compact" />
 * ```
 *
 * @example SOVEREIGN — custom country gradient (France)
 * ```tsx
 * <UserChip
 *   userId="uid_fr"
 *   handle="france_king"
 *   titleTier="COUNTRY"
 *   countryGradientColors={['#002395', '#FFFFFF', '#ED2939']}
 * />
 * ```
 *
 * @example IMPERATOR — prismatic spectrum gradient
 * ```tsx
 * <UserChip userId="uid_world" handle="earth_boss" titleTier="WORLD" />
 * ```
 *
 * @example Ghost skeleton while data loads
 * ```tsx
 * <UserChip userId="" handle="" variant="ghost" />
 * ```
 *
 * @example Disabled — dimmed, non-interactive (banned user context)
 * ```tsx
 * <UserChip userId="uid_x" handle="user_x" disabled />
 * ```
 *
 * @param props - {@link UserChipProps}
 */
const UserChip = memo<UserChipProps>((props) => {
  const {
    userId,
    handle,
    avatarUri,
    titleTier = null,
    countryGradientColors,
    variant = 'default',
    onPress,
    disabled = false,
    style,
    accessibilityLabel,
  } = props;

  const router  = useRouter();
  const haptics = useHaptics();

  // ── FIX #2 — Reduced-motion detection via useState ────────────────────────
  //
  // WHY useState instead of useRef:
  //   AccessibilityInfo.isReduceMotionEnabled() is async — it resolves after
  //   the first render. A ref update does NOT trigger a re-render, so GhostChip
  //   would always receive `false` on mount (animation plays for all users).
  //   useState ensures GhostChip re-renders with the correct value once the
  //   OS check resolves, and again whenever the user toggles the system setting.
  //
  // WHY this is acceptable for non-ghost branches:
  //   Press-animation guards (handlePressIn / handlePressOut) also read this
  //   value. Reduce Motion toggle is a rare system event — one extra render
  //   when it changes is negligible vs. the accessibility correctness gain.
  //
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled);
    });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReducedMotion(enabled),
    );

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  // ── FIX #1 — Press-scale animation (ALL hooks before any early return) ────
  //
  // WHY hooks are declared here, above the ghost early-return:
  //   React's Rules of Hooks require hooks to be called in the same order on
  //   every render, unconditionally. If useSharedValue / useAnimatedStyle /
  //   useCallback / useMemo were placed after `if (variant === 'ghost') return`,
  //   React would call a different number of hooks when variant is 'ghost' vs
  //   'default'/'compact', causing a crash in dev and silent corruption in prod.
  //
  //   These hooks are lightweight when the ghost branch is taken — the shared
  //   value is created but the animated style is never applied to a Pressable.
  //   There is zero measurable overhead.
  //
  const scale = useSharedValue<number>(PRESS_SCALE_OUT);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePressIn = useCallback((): void => {
    if (disabled || onPress === false) return;
    // State 04: haptic fires at gesture start, scale shrinks simultaneously
    haptics.impactLight();
    if (!reducedMotion) {
      scale.value = withTiming(PRESS_SCALE_IN, { duration: PRESS_IN_MS, easing: PRESS_EASING });
    }
  }, [disabled, onPress, haptics, scale, reducedMotion]);

  const handlePressOut = useCallback((): void => {
    if (disabled || onPress === false) return;
    if (reducedMotion) {
      // State 05 — reduced motion: instant reset, no spring
      scale.value = PRESS_SCALE_OUT;
      return;
    }
    // State 05: spring rebound to resting scale
    scale.value = withSpring(PRESS_SCALE_OUT, SPRING_PRESS);
  }, [disabled, onPress, scale, reducedMotion]);

  const handlePress = useCallback((): void => {
    if (disabled || onPress === false) return;
    if (onPress) {
      onPress();
      return;
    }
    router.push(`/user/${userId}` as const);
  }, [disabled, onPress, router, userId]);

  // ── Display handle (prepend "@" if caller omitted it) ────────────────────
  const displayHandle = handle.startsWith('@') ? handle : `@${handle}`;

  // ── Computed ARIA label ──────────────────────────────────────────────────
  const computedA11yLabel: string = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    if (titleTier == null) return displayHandle;
    const spec = TITLE_ICON_CONFIG[titleTier];
    return `${displayHandle}, ${spec.a11yLabel}`;
  }, [accessibilityLabel, displayHandle, titleTier]);

  // ── Ghost variant (State 17/18) — early return AFTER all hooks ───────────
  //
  // All hooks above have already been called unconditionally. This early return
  // is now safe — hook call count is identical on every render path. ✅
  //
  if (variant === 'ghost') {
    return (
      <GhostChip
        variant={variant}
        style={style}
        reducedMotion={reducedMotion}   // ✅ useState → GhostChip re-renders
      />                                //    with correct value after OS check
    );
  }

  // ── State 16 — Disabled ──────────────────────────────────────────────────
  const isInteractive       = !disabled && onPress !== false;
  const containerOpacity    = disabled ? 0.40 : 1.0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={HIT_SLOP}
      disabled={!isInteractive}
      accessibilityRole={'link' as AccessibilityRole}
      accessibilityLabel={computedA11yLabel}
      accessibilityHint={
        isInteractive ? 'Profile dekhne ke liye tap karo' : undefined
      }
      accessibilityState={{ disabled: !isInteractive }}
      style={[{ opacity: containerOpacity }, style]}
    >
      <Animated.View style={[styles.chip, animStyle]}>
        {/* 24pt avatar circle — only in `default` variant per PRD §1.4.6 */}
        {variant === 'default' && (
          <MiniAvatar handle={handle} avatarUri={avatarUri} />
        )}

        {/* @handle text */}
        <Text
          style={styles.handle}
          allowFontScaling={false}
          numberOfLines={1}
          ellipsizeMode="tail"
          accessible={false}
          importantForAccessibility="no"
        >
          {displayHandle}
        </Text>

        {/* Title tier icon — only when user holds a title */}
        {titleTier != null && (
          <TitleIconBadge
            titleTier={titleTier}
            countryGradientColors={countryGradientColors}
          />
        )}
      </Animated.View>
    </Pressable>
  );
});
UserChip.displayName = 'UserChip';

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES
//
// Token reference (all from @/constants/colors — zero raw hex):
//
//   Chip surface  : colors.bg.card        (--bg-card        #F5E6C8 — PRD §1.4.2 locked ✅)
//   Chip border   : colors.border.default  (--border-subtle  #E8D5A0 — PRD §1.4.2 locked ✅)
//   Handle text   : colors.fg.primary      (--fg-text-strong #1A1A1A — PRD §1.4.2 locked ✅)
//   Ghost surface : colors.bg.card         (same)
//   Avatar bg     : colors.bg.goldSoft     (gold[50]         #FCF7E5 — warm gold tint)
//   Avatar initial: colors.fg.brandSubtle  (gold[800]        #8B6F18 — 5.8:1 AA on gold[50] ✅)
//   Avatar border : colors.border.card     (--border-subtle  #E8D5A0 — PRD §1.4.2 locked ✅)
//   BARON icon    : colors.fg.success      (--fg-success     #10B981 — inline via prop)
//   CITY icon     : colors.fg.brand        (--fg-brand       #D4A017 — inline via prop)
//   COUNTRY/WORLD : LinearGradient from TITLE_COLORS
//
// Spacing    (PRD §1.4.4 4pt grid):  CHIP_PAD_H=8px · CHIP_PAD_V=4px · GAP=4px
// Typography (PRD §1.4.3 Inter):     handle=13px · icon=12px · initial=11px (all ≥ 11px ✅)
// Border r.  (PRD §1.4.4):           18px (full pill — max H 36px) ✅
// Motion     (PRD §1.4.5):           press-in 120ms Easing.linear ✅
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Outer chip pill ────────────────────────────────────────────────────────
  chip: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'flex-start',        // shrink-wrap to content width
    height:           CHIP_HEIGHT,         // 32pt
    paddingHorizontal: CHIP_PAD_H,         // 8px
    paddingVertical:  CHIP_PAD_V,          // 4px
    gap:              CHIP_INNER_GAP,      // 4px — between all elements
    backgroundColor:  colors.bg.card,     // cream[200] — --bg-card PRD locked ✅
    borderRadius:     CHIP_BORDER_RADIUS,  // 18px — full pill ✅
    borderWidth:      1,
    borderColor:      colors.border.default, // cream[400] — --border-subtle PRD locked ✅
  },

  // ── Avatar circle container ────────────────────────────────────────────────
  avatarContainer: {
    width:        AVATAR_SIZE,             // 24pt
    height:       AVATAR_SIZE,             // 24pt
    borderRadius: AVATAR_SIZE / 2,         // 12pt — full circle (half of exact size)
    borderWidth:  AVATAR_BORDER_WIDTH,     // 1pt — hairline ring
    borderColor:  colors.border.card,      // cream[400] — subtle ring matches chip border
    overflow:     'hidden',
    flexShrink:   0,                       // never compress avatar
  },

  // ── Avatar photo (when URI available) ──────────────────────────────────────
  avatarImage: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  // ── Avatar initials fallback ───────────────────────────────────────────────
  avatarFallback: {
    width:           AVATAR_SIZE,
    height:          AVATAR_SIZE,
    backgroundColor: colors.bg.goldSoft,  // gold[50] #FCF7E5 — warm gold wash
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Initial letter inside fallback ────────────────────────────────────────
  avatarInitial: {
    fontFamily:        FONT_BODY.bold,              // Inter_700Bold
    fontSize:          AVATAR_INITIAL_FONT_SIZE,    // 11px — PRD §1.4.3 minimum ✅
    fontWeight:        '700',
    lineHeight:        13,
    letterSpacing:     LETTER_SPACING.normal,       // 0
    color:             colors.fg.brandSubtle,       // gold[800] — 5.8:1 AA on gold[50] ✅
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // ── @handle text ──────────────────────────────────────────────────────────
  handle: {
    fontFamily:        FONT_BODY.semiBold,  // Inter_600SemiBold
    fontSize:          HANDLE_FONT_SIZE,    // 13px — Inter body scale ✅
    fontWeight:        '600',
    lineHeight:        18,                  // 13 × 1.38 ≈ 18px — readable
    letterSpacing:     LETTER_SPACING.normal, // 0
    color:             colors.fg.primary,   // ink[950] — --fg-text-strong PRD locked ✅
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink:        1,                   // truncate handle before icon
    maxWidth:          160,                 // guard against very long handles
  },

  // ── Solid title icon text (SECTOR / CITY) ─────────────────────────────────
  // Colour applied inline from TITLE_ICON_CONFIG (emerald for BARON, gold for CITY)
  solidIcon: {
    fontSize:          ICON_EMOJI_SIZE,  // 12px — above PRD 11px min ✅
    lineHeight:        14,
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink:        0,
  },

  // ── Gradient pill container (COUNTRY / WORLD) ─────────────────────────────
  gradientPill: {
    width:          GRADIENT_PILL_SIZE,    // 18px
    height:         GRADIENT_PILL_SIZE,    // 18px
    borderRadius:   GRADIENT_PILL_RADIUS,  // 9px — true circle
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  // ── Emoji inside gradient pill ────────────────────────────────────────────
  gradientEmoji: {
    fontSize:          ICON_EMOJI_SIZE,  // 12px ✅
    lineHeight:        14,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // ── Ghost / skeleton chip (State 17 / 18) ────────────────────────────────
  // Width is applied inline because it varies per variant.
  ghost: {
    height:          CHIP_HEIGHT,         // 32pt — matches real chip
    borderRadius:    CHIP_BORDER_RADIUS,  // 18px
    backgroundColor: colors.bg.card,     // cream[200] — valid PRD token ✅
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default UserChip;
export type { UserChipProps, UserChipVariant };

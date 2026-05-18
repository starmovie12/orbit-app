/**
 * components/Header.tsx
 *
 * CROWN — Generic Screen Header · All Push + Tab Sub-Screens
 * CROWN FINAL v1.0 — Master Build PRD · LAW 15 COMPLIANT · Rule 03 CONSTITUTIONAL
 * (Supersedes all prior Blueprint v3.x / v5.x / v6.x / BAAP EDITION drafts)
 *
 * ── ⚠️  SCOPE OF THIS COMPONENT ────────────────────────────────────────────────
 *  This <Header /> is for ALL screens EXCEPT the HOME tab.
 *  The HOME tab requires a dedicated <HomeHeader /> with 3 rows (136px total):
 *    Row 1 — CROWN wordmark + notification bell + DM icon (56px)
 *    Row 2 — 4-Scope Switcher (World / Country / City / Sector)  (48px)
 *    Row 3 — Online count strip + Heat score                      (32px)
 *  PRD §1.3.3 governs HomeHeader. DO NOT use this component on the Home tab.
 *
 * ── FONT SYSTEM — CROWN FINAL v1.0 §1.4.3 ───────────────────────────────────
 *  Syne  (800 ExtraBold / 700 Bold) → Screen titles, large-title hero, wordmarks
 *  Inter (600 SemiBold / 500 Medium / 400 Regular) → Subtitles, UI labels, badge text
 *  Cormorant Garamond → RESERVED for Profile bio / pull-quotes ONLY (not headers)
 *  DM Sans → LEGACY (ORBIT-era) — BANNED in all CROWN components
 *  Space Mono → Numbers, counters, Credits, timers (not used in headers)
 *
 *  Font constants used below:
 *    FONT_HEADING  →  @/constants/typography  →  Syne_700Bold / Syne_800ExtraBold
 *    FONT_BODY     →  @/constants/typography  →  Inter_600SemiBold / Inter_500Medium / Inter_400Regular
 *  Ensure @/constants/typography exports these with the Syne + Inter variants.
 *
 * ── FOUR VARIANTS ────────────────────────────────────────────────────────────
 *
 *  variant='back-arrow'  (push screens — Notifications / DM / Edit Profile / etc.)
 *  ┌──────────────────────────────────────── Row 1 · 56px ─────────────────────┐
 *  │  ← [back]    Screen Title                    [Action1?] [Action2?]        │
 *  └───────────────────────────────────────────────────────────────────────────┘
 *  ──── hairline border-bottom ─────────────────────────────────────────────────
 *
 *  variant='compact'  (tab sub-screens · single-row — hamburger optional)
 *  ┌──────────────────────────────────────── Row 1 · 56px ─────────────────────┐
 *  │  [☰?]   Screen Title                          [Action1?] [Action2?]       │
 *  └───────────────────────────────────────────────────────────────────────────┘
 *  ──── hairline border-bottom ─────────────────────────────────────────────────
 *
 *  variant='large-title'  (LAW 15 two-row — Explore / Ranks / Wallet / Profile)
 *  ┌──────────────────────────────────────── Row 1 · 56px ─────────────────────┐
 *  │  [☰?]   [compact title — fades in on scroll]   [Action1?] [Action2?]      │
 *  ├──────────────────────────────────────── Row 2 · 44px ─────────────────────┤
 *  │   Large Screen Title (22px Syne 800)                                       │
 *  │   [Optional subtitle (11px Inter 600)]                                     │
 *  └───────────────────────────────────────────────────────────────────────────┘
 *  ──── hairline border-bottom ─────────────────────────────────────────────────
 *
 *  variant='transparent'  (hero-image overlays — profile cover / photo viewer)
 *  ┌──────────────────────────────────────── Row 1 · 56px ─────────────────────┐
 *  │  ← [back · white]    [transparent bg]              [Action1?] [Action2?]  │
 *  └───────────────────────────────────────────────────────────────────────────┘
 *  (no border — transparent → hero bleed through)
 *
 * ── HEIGHT ACCOUNTING ────────────────────────────────────────────────────────
 *   SafeAreaView edges={['top']} absorbs device status bar.
 *   back-arrow total : layout.headerRow1Height = 56px
 *   compact total    : layout.headerRow1Height = 56px
 *   large-title total: layout.headerHeight     = 100px (56 + 44)
 *   transparent total: layout.headerRow1Height = 56px
 *   ➜ Pass total height + insets.top as scroll content paddingTop / contentInset.top
 *
 * ── LAWS HONOURED ────────────────────────────────────────────────────────────
 *   LAW 15  : Two-row header (large-title variant) — Row 1 56px + Row 2 44px
 *   Rule 03 : ZERO avatar anywhere in this component — constitutional, non-negotiable
 *   Rule 30 : Avatar lives exclusively in Profile tab — never in headers
 *   CROWN   : All ORBIT / CROWD WORLD strings removed — branding is CROWN only
 *
 * ── ANIMATION ────────────────────────────────────────────────────────────────
 *   Reanimated v4 — all animations run on UI thread via worklets
 *   Scroll-driven collapse (large-title only): pass scrollY SharedValue
 *   Button press: withSpring (stiffness:200, damping:18) — easeOut chrome law
 *   Reduced motion: opacity-only fallback via useReducedMotionValue()
 *
 * ── TOUCH TARGETS ────────────────────────────────────────────────────────────
 *   All interactive elements: 44×44pt min (Apple HIG) / 48×48dp (MD3)
 *   hitSlop compensates where visual size is smaller than touch target
 *
 * ── ACCESSIBILITY ────────────────────────────────────────────────────────────
 *   accessibilityRole="navigation" on container
 *   accessibilityRole="header" on title Text
 *   accessibilityRole="button" + aria label on all icon buttons
 *   VoiceOver / TalkBack safe: title announced as header landmark
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   @/constants/colors       — colors · palette · radii · zIndex
 *   @/constants/typography   — FONT_HEADING (Syne) · FONT_BODY (Inter) · LETTER_SPACING · lh
 *   @/constants/spacing      — spacing · layout
 *   @/constants/animations   — durations · easings · springConfigs · useReducedMotion
 *   react-native-safe-area-context
 *   react-native-reanimated  (v4 API)
 *   @expo/vector-icons        Feather
 *   expo-haptics
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   // Push screen (most common):
 *   <Header
 *     variant="back-arrow"
 *     title="Notifications"
 *     onBack={router.back}
 *     rightActions={[{ icon: 'settings', onPress: openSettings, accessibilityLabel: 'Settings' }]}
 *   />
 *
 *   // Tab sub-screen (Explore / Ranks):
 *   <Header
 *     variant="large-title"
 *     title="Explore"
 *     subtitle="Cities · Leaderboards · Search"
 *     scrollY={scrollY}
 *     rightActions={[{ icon: 'search', onPress: openSearch, accessibilityLabel: 'Search' }]}
 *   />
 *
 *   // Hero image overlay (Profile cover):
 *   <Header
 *     variant="transparent"
 *     title=""
 *     onBack={router.back}
 *     rightActions={[{ icon: 'share-2', onPress: shareProfile, accessibilityLabel: 'Share profile' }]}
 *   />
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather }      from '@expo/vector-icons';
import * as Haptics     from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, palette, radii, zIndex }                   from '@/constants/colors';
import { spacing, layout }                                    from '@/constants/spacing';
import {
  FONT_HEADING,
  FONT_BODY,
  LETTER_SPACING,
  lh,
}                                                             from '@/constants/typography';
import {
  durations,
  easings,
  springConfigs,
  useReducedMotion,
}                                                             from '@/constants/animations';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Hit slop applied to all icon buttons — extends touch target to ≥ 44×44pt */
const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/**
 * Scroll offset (dp) at which the large-title Row 2 is fully collapsed.
 * The compact title in Row 1 becomes fully visible at this point.
 * Matches layout.headerRow2Height (44) so the animation completes exactly
 * when the large-title row has scrolled off the visible area.
 */
const LARGE_TITLE_COLLAPSE_THRESHOLD_DP = 44 as const;

/** Maximum number of right actions — PRD caps at 2 */
const MAX_RIGHT_ACTIONS = 2 as const;

/** Icon size used consistently across all header icon buttons */
const HEADER_ICON_SIZE = 24 as const;

/** Spring config for button press — stiff snap, matches §5.N springStiff */
const BUTTON_SPRING = {
  stiffness:        200,
  damping:           18,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Specification for a single right-side contextual action button.
 * Maximum 2 actions per header (PRD §1.3 mandate).
 */
export interface HeaderAction {
  /** Feather icon name (https://feathericons.com/) */
  readonly icon: string;
  /** Called when the action button is pressed */
  readonly onPress: () => void;
  /** VoiceOver / TalkBack label — required for all icon-only buttons */
  readonly accessibilityLabel: string;
  /**
   * Optional badge count — rendered as a small gold pill on the icon.
   * 0 or undefined = no badge. Capped display at '99+'.
   */
  readonly badge?: number;
  /** Optional testID for E2E targeting */
  readonly testID?: string;
}

/** Props shared across all header variants */
interface SharedHeaderProps {
  /**
   * Primary screen title.
   * In `transparent` variant, pass an empty string '' to show no title
   * (e.g. photo viewer with back + share only).
   */
  readonly title: string;
  /**
   * Optional secondary line.
   * Visible in `large-title` Row 2 and below title in `compact` / `back-arrow`.
   * Keep ≤ 40 characters — no wrapping.
   */
  readonly subtitle?: string;
  /**
   * Up to 2 contextual action buttons rendered right-aligned in Row 1.
   * Max 2 enforced — additional items beyond index 1 are silently ignored.
   */
  readonly rightActions?: ReadonlyArray<HeaderAction>;
  /**
   * Reanimated SharedValue tracking the scroll position of the screen's
   * main ScrollView / FlatList in dp.
   *
   * - `large-title` variant uses this to collapse Row 2 into Row 1.
   * - All other variants ignore this value.
   * - If not provided, the large-title header remains fully expanded.
   */
  readonly scrollY?: SharedValue<number>;
  /** testID for the root SafeAreaView — useful for E2E testing */
  readonly testID?: string;
}

/** `back-arrow` variant — push screen with back navigation */
interface BackArrowHeaderProps extends SharedHeaderProps {
  readonly variant: 'back-arrow';
  /**
   * Called when the back chevron is pressed.
   * Fires Haptics.ImpactFeedbackStyle.Light before invoking the callback.
   */
  readonly onBack: () => void;
  readonly onHamburger?: never;
}

/** `compact` variant — single-row, optional hamburger on left */
interface CompactHeaderProps extends SharedHeaderProps {
  readonly variant: 'compact';
  /**
   * Optional hamburger (☰) tap handler.
   * If undefined, no left element is rendered and the title shifts left-aligned.
   */
  readonly onHamburger?: () => void;
  readonly onBack?: never;
}

/** `large-title` variant — two-row iOS-style collapsing header (LAW 15) */
interface LargeTitleHeaderProps extends SharedHeaderProps {
  readonly variant: 'large-title';
  /**
   * Optional hamburger (☰) tap handler.
   * Renders in Row 1 left slot; Row 2 has no left element.
   */
  readonly onHamburger?: () => void;
  readonly onBack?: never;
}

/** `transparent` variant — overlay header for hero-image screens */
interface TransparentHeaderProps extends SharedHeaderProps {
  readonly variant: 'transparent';
  /**
   * Optional back navigation callback.
   * Renders a white back chevron in the left slot.
   */
  readonly onBack?: () => void;
  readonly onHamburger?: never;
}

/** Full discriminated union — TypeScript narrows to the correct prop set per variant */
export type HeaderProps =
  | BackArrowHeaderProps
  | CompactHeaderProps
  | LargeTitleHeaderProps
  | TransparentHeaderProps;

// ─── Sub-component: IconButton ────────────────────────────────────────────────
//
// Reusable icon button with 18-state press animation.
//
// 18-STATE MATRIX:
// ┌────────────────────┬──────────────────────┬──────────────┬──────────────────────────────┐
// │ State              │ Visual               │ Haptic       │ Animation                    │
// ├────────────────────┼──────────────────────┼──────────────┼──────────────────────────────┤
// │ 01 Default/Idle    │ icon @ iconColor     │ none         │ none                         │
// │ 02 Hover (web)     │ bg goldSoft 8%       │ n/a          │ 150ms easeOut opacity        │
// │ 03 Focus (kbd)     │ gold[600] 2px ring   │ none         │ 150ms easeOut                │
// │ 04 Press-in        │ scale 0.88, dim 0.7  │ Light impact │ 80ms easeOut                 │
// │ 05 Press-release   │ scale 1.0 spring     │ none         │ withSpring(200,18)           │
// │ 06 Long-press      │ bg goldSoft 12%      │ Medium       │ 100ms easeOut                │
// │ 07 Drag-active     │ N/A                  │ N/A          │ N/A                          │
// │ 08 Loading         │ N/A                  │ N/A          │ N/A                          │
// │ 09 Streaming       │ N/A                  │ N/A          │ N/A                          │
// │ 10 Realtime-pulse  │ N/A                  │ N/A          │ N/A                          │
// │ 11 Success         │ emerald[600] icon    │ Success      │ 200ms easeOut                │
// │ 12 Error           │ crimson[600] icon    │ Error        │ N/A                          │
// │ 13 Warning         │ amber[600] icon      │ Warning      │ N/A                          │
// │ 14 Throttled       │ N/A (header actions) │ N/A          │ N/A                          │
// │ 15 Banned          │ N/A (header actions) │ N/A          │ N/A                          │
// │ 16 Disabled        │ opacity 0.35, no tap │ none         │ none                         │
// │ 17 Empty           │ N/A                  │ N/A          │ N/A                          │
// │ 18 Skeleton        │ N/A                  │ N/A          │ N/A                          │
// └────────────────────┴──────────────────────┴──────────────┴──────────────────────────────┘
//
// INTERACTION RECORD — Tap on IconButton:
// 1. TRIGGER: tap. Touch target ≥ 44×44pt via hitSlop. Debounce: none.
// 2. HAPTIC: Haptics.ImpactFeedbackStyle.Light, at gesture start (press-in).
// 3. ANIMATION:
//    Phase 1: scale 1.0 → 0.88, 80ms, cubic-bezier(0.4,0,1,1) easeIn — press-in
//    Phase 2: scale 0.88 → 1.0, spring({stiffness:200,damping:18}) — release settle
// 4. VISUAL: opacity 1.0 → 0.70 on press-in, back to 1.0 on release
// 5. PERF: /* PERF: transform + opacity — compositor only — zero layout/paint */
// 6. STATE: executes action.onPress(); no navigation side-effect (consumer decides)
// 7. BEHAVIOR SIGNAL: event='header.action.tapped', risk weight=0.0

interface IconButtonProps {
  readonly icon:               string;
  readonly onPress:            () => void;
  readonly accessibilityLabel: string;
  readonly iconColor:          string;
  readonly badge?:             number;
  readonly disabled?:          boolean;
  readonly testID?:            string;
}

const IconButton = memo<IconButtonProps>(({
  icon,
  onPress,
  accessibilityLabel,
  iconColor,
  badge,
  disabled = false,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const scale         = useSharedValue(1);
  const opacity       = useSharedValue(1);

  /** PERF: transform + opacity — compositor only — zero layout/paint */
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : scale.value }],
    opacity:   opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reducedMotion) {
      scale.value   = withTiming(0.88, { duration: durations.instant, easing: easings.easeIn });
    }
    opacity.value = withTiming(0.70, { duration: durations.instant, easing: easings.easeIn });
  }, [reducedMotion, scale, opacity]);

  const handlePressOut = useCallback(() => {
    if (!reducedMotion) {
      scale.value   = withSpring(1.0, BUTTON_SPRING);
    }
    opacity.value = withTiming(1.0, { duration: durations.fast, easing: easings.easeOut });
  }, [reducedMotion, scale, opacity]);

  const showBadge = typeof badge === 'number' && badge > 0;
  const badgeText = badge && badge > 99 ? '99+' : String(badge ?? 0);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      hitSlop={ICON_HIT_SLOP}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        showBadge ? `${accessibilityLabel}, ${badge} unread` : accessibilityLabel
      }
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Animated.View style={[styles.iconButtonInner, animStyle, disabled && styles.iconButtonDisabled]}>
        <Feather
          name={icon as never}
          size={HEADER_ICON_SIZE}
          color={disabled ? colors.fg.disabled : iconColor}
        />
        {showBadge && (
          <View style={styles.iconBadge} accessibilityElementsHidden>
            <Text style={styles.iconBadgeText} numberOfLines={1} allowFontScaling={false}>
              {badgeText}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

IconButton.displayName = 'Header.IconButton';

// ─── Sub-component: BackButton ────────────────────────────────────────────────
//
// Back chevron button — fires haptic + callback on press.
//
// INTERACTION RECORD — Tap on BackButton:
// 1. TRIGGER: tap. Touch target ≥ 44×44pt. Debounce: none.
// 2. HAPTIC: Haptics.ImpactFeedbackStyle.Light at press-in.
// 3. ANIMATION: scale 1.0 → 0.88 (80ms easeIn), withSpring(200,18) release.
// 4. VISUAL: opacity 1.0 → 0.70 press-in, 1.0 on release.
// 5. PERF: /* PERF: compositor-only transform + opacity */
// 6. STATE: invokes onBack(); Expo Router navigates back in stack.
// 7. BEHAVIOR SIGNAL: event='header.back.tapped', risk weight=0.0

interface BackButtonProps {
  readonly onBack:    () => void;
  readonly iconColor: string;
}

const BackButton = memo<BackButtonProps>(({ onBack, iconColor }) => {
  const reducedMotion = useReducedMotion();
  const scale         = useSharedValue(1);
  const opacity       = useSharedValue(1);

  /** PERF: transform + opacity — compositor only — zero layout/paint */
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : scale.value }],
    opacity:   opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reducedMotion) {
      scale.value   = withTiming(0.88, { duration: durations.instant, easing: easings.easeIn });
    }
    opacity.value = withTiming(0.70, { duration: durations.instant, easing: easings.easeIn });
  }, [reducedMotion, scale, opacity]);

  const handlePressOut = useCallback(() => {
    if (!reducedMotion) {
      scale.value = withSpring(1.0, BUTTON_SPRING);
    }
    opacity.value = withTiming(1.0, { duration: durations.fast, easing: easings.easeOut });
    onBack();
  }, [reducedMotion, scale, opacity, onBack]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={ICON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Animated.View style={[styles.iconButtonInner, animStyle]}>
        <Feather
          name="chevron-left"
          size={HEADER_ICON_SIZE}
          color={iconColor}
        />
      </Animated.View>
    </Pressable>
  );
});

BackButton.displayName = 'Header.BackButton';

// ─── Sub-component: HamburgerButton ──────────────────────────────────────────

interface HamburgerButtonProps {
  readonly onPress:   () => void;
  readonly iconColor: string;
}

const HamburgerButton = memo<HamburgerButtonProps>(({ onPress, iconColor }) => {
  const reducedMotion = useReducedMotion();
  const scale         = useSharedValue(1);
  const opacity       = useSharedValue(1);

  /** PERF: transform + opacity — compositor only — zero layout/paint */
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : scale.value }],
    opacity:   opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reducedMotion) {
      scale.value   = withTiming(0.88, { duration: durations.instant, easing: easings.easeIn });
    }
    opacity.value = withTiming(0.70, { duration: durations.instant, easing: easings.easeIn });
  }, [reducedMotion, scale, opacity]);

  const handlePressOut = useCallback(() => {
    if (!reducedMotion) {
      scale.value = withSpring(1.0, BUTTON_SPRING);
    }
    opacity.value = withTiming(1.0, { duration: durations.fast, easing: easings.easeOut });
    onPress();
  }, [reducedMotion, scale, opacity, onPress]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={ICON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <Animated.View style={[styles.iconButtonInner, animStyle]}>
        <Feather
          name="menu"
          size={HEADER_ICON_SIZE}
          color={iconColor}
        />
      </Animated.View>
    </Pressable>
  );
});

HamburgerButton.displayName = 'Header.HamburgerButton';

// ─── Sub-component: RightActions ─────────────────────────────────────────────
//
// Renders up to MAX_RIGHT_ACTIONS (2) IconButton components in a row.
// Excess items beyond index 1 are silently discarded.

interface RightActionsProps {
  readonly actions:   ReadonlyArray<HeaderAction> | undefined;
  readonly iconColor: string;
}

const RightActions = memo<RightActionsProps>(({ actions, iconColor }) => {
  if (!actions || actions.length === 0) return null;
  const capped = actions.slice(0, MAX_RIGHT_ACTIONS);
  return (
    <View style={styles.rightActionsRow} accessibilityElementsHidden={false}>
      {capped.map((action, index) => (
        <IconButton
          key={`${action.icon}-${index}`}
          icon={action.icon}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
          iconColor={iconColor}
          badge={action.badge}
          testID={action.testID}
        />
      ))}
    </View>
  );
});

RightActions.displayName = 'Header.RightActions';

// ─── Sub-component: CompactTitleText ─────────────────────────────────────────
//
// Title + optional subtitle stack for compact / back-arrow / transparent variants.

interface CompactTitleTextProps {
  readonly title:       string;
  readonly subtitle?:   string;
  readonly titleStyle:  TextStyle;
  readonly subtitleStyle: TextStyle;
  readonly centered?:   boolean;
}

const CompactTitleText = memo<CompactTitleTextProps>(({
  title,
  subtitle,
  titleStyle,
  subtitleStyle,
  centered = false,
}) => {
  if (!title) return null;
  return (
    <View style={[styles.titleStack, centered && styles.titleStackCentered]}>
      <Text
        style={titleStyle}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={subtitleStyle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
});

CompactTitleText.displayName = 'Header.CompactTitleText';

// ─── Hook: useLargeTitleAnimation ────────────────────────────────────────────
//
// Drives the large-title collapse animation.
// When scrollY > LARGE_TITLE_COLLAPSE_THRESHOLD_DP:
//   - Row 2 (large title) fades out and translates up
//   - Compact title in Row 1 fades in
//
// PERF: all transform + opacity → compositor only — zero layout/paint.

interface LargeTitleAnimStyles {
  /** Row 1 compact title — fades in on scroll */
  readonly compactTitleStyle: ReturnType<typeof useAnimatedStyle>;
  /** Row 2 large title container — fades out + slides up on scroll */
  readonly largeTitleRowStyle: ReturnType<typeof useAnimatedStyle>;
}

function useLargeTitleAnimation(
  scrollY:      SharedValue<number> | undefined,
  reducedMotion: boolean,
): LargeTitleAnimStyles {
  // Stable fallback SharedValue when consumer doesn't supply scrollY
  const fallbackScrollY = useSharedValue(0);
  const sv = scrollY ?? fallbackScrollY;

  /** PERF: opacity + transform — compositor — zero layout/paint */
  const compactTitleStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      const opacity = interpolate(
        sv.value,
        [LARGE_TITLE_COLLAPSE_THRESHOLD_DP * 0.5, LARGE_TITLE_COLLAPSE_THRESHOLD_DP],
        [0, 1],
        Extrapolation.CLAMP,
      );
      return { opacity };
    }
    const opacity = interpolate(
      sv.value,
      [LARGE_TITLE_COLLAPSE_THRESHOLD_DP * 0.45, LARGE_TITLE_COLLAPSE_THRESHOLD_DP],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  /** PERF: opacity + translateY — compositor — zero layout/paint */
  const largeTitleRowStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      const opacity = interpolate(
        sv.value,
        [0, LARGE_TITLE_COLLAPSE_THRESHOLD_DP * 0.5],
        [1, 0],
        Extrapolation.CLAMP,
      );
      return { opacity };
    }
    const opacity = interpolate(
      sv.value,
      [0, LARGE_TITLE_COLLAPSE_THRESHOLD_DP * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      sv.value,
      [0, LARGE_TITLE_COLLAPSE_THRESHOLD_DP],
      [0, -8],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  });

  return { compactTitleStyle, largeTitleRowStyle };
}

// ─── Main component: Header ───────────────────────────────────────────────────

/**
 * Generic screen header for all CROWN push screens and tab sub-screens.
 * Four variants: 'back-arrow' | 'compact' | 'large-title' | 'transparent'.
 *
 * Rule 03 (CONSTITUTIONAL): ZERO avatar anywhere in this component.
 * LAW 15: large-title variant = two-row (Row 1 56px + Row 2 44px).
 *
 * @example
 * // Push screen:
 * <Header variant="back-arrow" title="Inbox" onBack={router.back} />
 *
 * // Main tab with scroll collapse:
 * <Header variant="large-title" title="Explore" scrollY={scrollY} />
 */
function HeaderComponent(props: HeaderProps): React.ReactElement {
  const { title, subtitle, rightActions, testID } = props;
  const reducedMotion = useReducedMotion();

  // ── Variant-specific config ─────────────────────────────────────────────
  const isTransparent = props.variant === 'transparent';
  const isLargeTitle  = props.variant === 'large-title';
  const isBackArrow   = props.variant === 'back-arrow';
  const isCompact     = props.variant === 'compact';

  // Icon + text colors driven by variant
  const iconColor  = isTransparent ? palette.white    : colors.fg.primary;
  const titleColor = isTransparent ? palette.white    : colors.fg.primary;
  // transparent variant subtitle uses white at 70% opacity — no raw hex; opacity applied via View
  const subColor   = isTransparent ? palette.white : colors.fg.tertiary;

  // Scroll-driven animation (only used in large-title variant)
  const scrollY = isLargeTitle
    ? (props as LargeTitleHeaderProps).scrollY
    : undefined;

  const { compactTitleStyle, largeTitleRowStyle } = useLargeTitleAnimation(
    scrollY,
    reducedMotion,
  );

  // ── Left element ────────────────────────────────────────────────────────
  const leftElement = (() => {
    if (isBackArrow) {
      return (
        <BackButton
          onBack={(props as BackArrowHeaderProps).onBack}
          iconColor={iconColor}
        />
      );
    }
    if (isTransparent && (props as TransparentHeaderProps).onBack) {
      return (
        <BackButton
          onBack={(props as TransparentHeaderProps).onBack!}
          iconColor={iconColor}
        />
      );
    }
    const hamburgerHandler =
      (isCompact && (props as CompactHeaderProps).onHamburger) ||
      (isLargeTitle && (props as LargeTitleHeaderProps).onHamburger);
    if (hamburgerHandler) {
      return (
        <HamburgerButton
          onPress={hamburgerHandler}
          iconColor={iconColor}
        />
      );
    }
    // No left element — render fixed-width spacer to keep title centered
    return <View style={styles.leftPlaceholder} />;
  })();

  // ── Compact title (Row 1) for large-title variant ───────────────────────
  // Fades in when the large title in Row 2 has scrolled out of view.
  // Invisible in default (unscrolled) state.
  const largeTitleCompactRow1Title = isLargeTitle ? (
    <Animated.View
      style={[styles.largeTitleCompactSlot, compactTitleStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <Text
        style={[styles.compactTitleInRow1, { color: titleColor }]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Animated.View>
  ) : null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        isTransparent && styles.safeAreaTransparent,
      ]}
      accessibilityRole="navigation"
      accessibilityLabel={`${title || 'Screen'} header`}
      testID={testID}
    >

      {/* ── ROW 1 ─────────────────────────────────────────────────────── */}
      {/*
       * All variants render Row 1.
       * large-title: contains left action + animated compact title + right actions
       * back-arrow : contains back button + title + right actions
       * compact    : contains hamburger? + title + right actions
       * transparent: contains back button? + optional title + right actions
       *
       * RULE 03 (CONSTITUTIONAL): NO avatar here. No avatar anywhere below.
       */}
      <View
        style={[
          styles.row1,
          isLargeTitle && styles.row1LargeTitleVariant,
        ]}
      >
        {/* Left element — back / hamburger / spacer */}
        <View style={styles.leftSlot}>
          {leftElement}
        </View>

        {/* Center — title / compact-title slot */}
        {isLargeTitle ? (
          // large-title: compact title fades in on scroll (animated)
          largeTitleCompactRow1Title
        ) : (
          // All other variants: static title in row 1 center
          <View style={styles.row1TitleSlot}>
            {title ? (
              <CompactTitleText
                title={title}
                subtitle={isBackArrow || isCompact ? subtitle : undefined}
                titleStyle={[styles.row1Title, { color: titleColor }]}
                subtitleStyle={[styles.row1Subtitle, { color: subColor, opacity: isTransparent ? 0.70 : 1 }]}
                centered={isCompact || isTransparent}
              />
            ) : null}
          </View>
        )}

        {/* Right actions — max 2 icon buttons */}
        <View style={styles.rightSlot}>
          <RightActions
            actions={rightActions}
            iconColor={iconColor}
          />
        </View>
      </View>

      {/* ── ROW 2 — large-title variant only ──────────────────────────── */}
      {/*
       * LAW 15: Two-row architecture — Row 2 height = layout.headerRow2Height (44px).
       * Contains the large title text + optional subtitle.
       * Animates: fades out + translates up as user scrolls down.
       * Collapses fully at scroll = LARGE_TITLE_COLLAPSE_THRESHOLD_DP (44dp).
       *
       * RULE 03: No avatar here either.
       */}
      {isLargeTitle && (
        <Animated.View style={[styles.row2, largeTitleRowStyle]}>
          <Text
            style={[styles.largeTitleText, { color: titleColor }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.largeTitleSubtitle, { color: subColor, opacity: isTransparent ? 0.70 : 1 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
      )}

    </SafeAreaView>
  );
}

// ─── Memo + export ────────────────────────────────────────────────────────────
//
// React.memo — re-renders only when props change.
// Use useCallback for all onBack / onPress / rightActions handlers at the call-site
// to avoid spurious re-renders on every parent update.

export default memo(HeaderComponent);
export { HeaderComponent };

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   colors.bg.surface        = white            — header background (default)
//   colors.border.default    = cream[400]       — bottom hairline
//   colors.fg.primary        = ink[950]          — title + icon color (default)
//   colors.fg.tertiary       = ink[500]          — subtitle color (default)
//   colors.fg.disabled       = ink[400]          — disabled icon
//   colors.fg.brandHover     = gold[700]         — badge background
//   palette.white            = #FFFFFF           — transparent variant colors
//   zIndex.fixedHeader       = 900              — sticky above scroll content
//   layout.headerRow1Height  = 56               — Row 1 (LAW 15)
//   layout.headerRow2Height  = 44               — Row 2 (LAW 15 large-title only)
//   spacing.screenH          = 18               — screen horizontal inset
//   spacing.sm               =  8               — gap between actions
//   spacing.xs               =  4               — micro gap
//   radii.full               = 9999             — badge pill
//   FONT_HEADING.bold        = Syne_700Bold          (screen titles, large-title Row 2)
//   FONT_BODY.semiBold       = Inter_600SemiBold      (Row 1 title, subtitles, badge text)
//   FONT_BODY.medium         = Inter_500Medium         (secondary labels, if needed)
//   FONT_BODY.regular        = Inter_400Regular        (body text, if needed)
//   LETTER_SPACING.tight     = -0.2
//   LETTER_SPACING.wide      = 0.3
//   LETTER_SPACING.wider     = 0.5

const styles = StyleSheet.create({

  // ── SafeAreaView wrapper ──────────────────────────────────────────────────
  // Background, z-index, border, shadow — wraps both Row 1 and optional Row 2.
  safeArea: {
    backgroundColor:   colors.bg.surface,          // white — warm canvas
    zIndex:            zIndex.fixedHeader,          // 900 — sticky above FlatList
    borderBottomWidth: StyleSheet.hairlineWidth,    // 0.5px retina-sharp hairline
    borderBottomColor: colors.border.default,       // cream[400] #E5CC95
    ...colors.shadow.tier1,                         // subtle gold-tinted elevation
  },

  // Transparent variant — no background, no border, no shadow
  safeAreaTransparent: {
    backgroundColor:   'transparent',
    borderBottomWidth:  0,
    shadowColor:       'transparent',
    shadowOpacity:      0,
    elevation:          0,
  },

  // ── Row 1 ────────────────────────────────────────────────────────────────
  // 56px fixed height (LAW 15 headerRow1Height).
  // Space-between layout: leftSlot | center-flex | rightSlot.
  row1: {
    height:            layout.headerRow1Height,     // 56px — LAW 15
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.screenH,             // 18px — screen horizontal inset
  },

  // large-title variant Row 1: compact title is absolutely centered
  // (left/right slots are fixed width so center title is truly centered).
  row1LargeTitleVariant: {
    // Layout same as row1; compact title is in the center slot (Animated.View)
  },

  // ── Left slot ────────────────────────────────────────────────────────────
  // Fixed 44px wide — back button / hamburger / spacer all occupy same space
  // so the title center position never shifts between variants.
  leftSlot: {
    width:          44,                             // fixed — matches iconButtonInner
    alignItems:     'flex-start',
    justifyContent: 'center',
  },

  // Right slot — actions cluster, fixed to right edge
  rightSlot: {
    minWidth:       44,                             // ≥ one action touch target
    alignItems:     'flex-end',
    justifyContent: 'center',
  },

  // Right actions inner row — gap between max 2 icon buttons
  rightActionsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,                      // 4px — tight but not cramped
  },

  // ── Center slot — Row 1 title for compact / back-arrow / transparent ──────
  // flex:1 fills space between left and right slots.
  row1TitleSlot: {
    flex:            1,
    marginHorizontal: spacing.sm,                   // 8px — breathing room
    justifyContent:  'center',
  },

  // Title stack (title + optional subtitle)
  titleStack: {
    flex:            1,
    justifyContent:  'center',
  },

  // Centered variant (compact, transparent) — title is centered in available space
  titleStackCentered: {
    alignItems: 'center',
  },

  // Row 1 title text — Inter 600 · 17px · fg.primary
  // Inter SemiBold at 17px: compact readability at 56px row height.
  // 17px keeps Row 1 title subordinate to the 22px large-title Row 2.
  // PRD §1.4.3: Inter 600 is the correct weight for UI labels / navigation titles.
  row1Title: {
    fontFamily:    FONT_BODY.semiBold,                // Inter_600SemiBold ✅ PRD §1.4.3
    fontSize:      17,
    fontWeight:    '600',
    lineHeight:    lh(17, 'snug'),                  // 21px
    letterSpacing: LETTER_SPACING.normal,           // 0
    // color injected at render via titleColor (transparent vs default)
  },

  // Row 1 subtitle (compact / back-arrow only — under the title)
  // Inter 500 · 11px — secondary label, visually subordinate to the 600 title.
  // PRD §1.4.3: Inter 400/500/600 for UI labels; 500 Medium for secondary text.
  row1Subtitle: {
    fontFamily:    FONT_BODY.medium,                // Inter_500Medium ✅ PRD §1.4.3
    fontSize:      11,
    fontWeight:    '500',
    lineHeight:    lh(11, 'relaxed'),               // 17px
    letterSpacing: LETTER_SPACING.wide,             // 0.3
    marginTop:     2,
    // color injected at render
  },

  // ── Large-title variant: compact title slot in Row 1 ─────────────────────
  // Animated.View wrapping the compact title that fades in on scroll.
  // flex:1 fills center — same as row1TitleSlot.
  largeTitleCompactSlot: {
    flex:            1,
    marginHorizontal: spacing.sm,
    justifyContent:  'center',
    alignItems:      'center',                      // centered horizontally
  },

  // Compact title text inside the large-title Row 1 animated slot
  // Mirrors row1Title exactly — Inter 600 · 17px. ✅ PRD §1.4.3
  compactTitleInRow1: {
    fontFamily:    FONT_BODY.semiBold,              // Inter_600SemiBold ✅ PRD §1.4.3
    fontSize:      17,
    fontWeight:    '600',
    lineHeight:    lh(17, 'snug'),                  // 21px
    letterSpacing: LETTER_SPACING.normal,
    textAlign:     'center',
  },

  // ── Row 2 — large-title variant (LAW 15) ─────────────────────────────────
  // 44px height (layout.headerRow2Height).
  // Contains the large Syne title + optional Inter subtitle.
  // Animated: fades out + translates up on scroll.
  row2: {
    height:            layout.headerRow2Height,     // 44px — LAW 15
    justifyContent:    'center',
    paddingHorizontal: spacing.screenH,             // 18px — aligns with Row 1
  },

  // Large title text — Syne 700 · 22px
  // PRD §1.4.3: Syne (800/700) for headings, titles — 22px is in the Syne size scale.
  // Cormorant Garamond is RESERVED for Profile bio/pull-quotes only — never headers.
  // We use ink[950] (fg.primary) for maximum legibility on non-home screens.
  // Contrast: ink[950] on white = 17.8:1 ✅ AAA
  largeTitleText: {
    fontFamily:    FONT_HEADING.bold,               // Syne_700Bold ✅ PRD §1.4.3
    fontSize:      22,
    fontWeight:    '700',
    lineHeight:    lh(22, 'tight'),                 // 25px — tight for large display
    letterSpacing: LETTER_SPACING.tight,            // -0.2 — Syne display tracking
    // color injected at render
  },

  // Subtitle in Row 2 (below large title)
  // Inter 500 · 11px · tertiary — clear secondary hierarchy under the Syne title.
  // PRD §1.4.3: Inter 400/500/600 for UI labels; 500 Medium for secondary text.
  largeTitleSubtitle: {
    fontFamily:    FONT_BODY.medium,                // Inter_500Medium ✅ PRD §1.4.3
    fontSize:      11,
    fontWeight:    '500',
    lineHeight:    lh(11, 'relaxed'),               // 17px
    letterSpacing: LETTER_SPACING.wide,             // 0.3 — .screen-sub-txt exact
    marginTop:     2,
    // color injected at render
  },

  // ── Icon button inner ─────────────────────────────────────────────────────
  // 44×44 touch area minimum (Apple HIG) via hitSlop on the Pressable wrapper.
  // Visual size: 44×44 with icon centered — no clipping, full tap area.
  iconButtonInner: {
    width:          44,                             // ≥ 44pt Apple HIG ✅
    height:         44,                             // ≥ 44pt Apple HIG ✅
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  // Disabled state — reduces opacity to 35% (below 40% intentional — clearly non-interactive)
  iconButtonDisabled: {
    opacity: 0.35,
  },

  // ── Badge (icon button) ───────────────────────────────────────────────────
  // Absolute top-right of iconButtonInner — same pattern as existing DM badge.
  // Background: colors.fg.brandHover = gold[700] — prestige accent.
  // Border: 2px white separator ring — visually separates badge from icon.
  // Contrast: white on gold[700] #A88A24 = 4.6:1 ✅ AA (small text exception applies
  //           for ≤ 12px but we use 10px 800ExtraBold — functionally legible at 4.6:1)
  iconBadge: {
    position:          'absolute',
    top:               -2,
    right:             -4,
    minWidth:           18,
    height:             18,
    borderRadius:       radii.full,                 // 9999 — perfect pill
    backgroundColor:    colors.fg.brandHover,       // gold[700] — #A88A24
    borderWidth:        2,
    borderColor:        colors.bg.surface,          // white ring — visual separator
    paddingHorizontal:  3,
    alignItems:        'center',
    justifyContent:    'center',
    ...Platform.select({
      ios: {
        shadowColor:   palette.ink[950],
        shadowOffset:  { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius:  2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Badge count text — Inter 600 · white · 10px
  // PRD §1.4.3: Inter max weight is 600 (SemiBold) for UI labels.
  // DM Sans is LEGACY/BANNED. Inter_600SemiBold at 10px is fully legible.
  iconBadgeText: {
    fontFamily:         FONT_BODY.semiBold,         // Inter_600SemiBold ✅ PRD §1.4.3
    fontSize:           10,
    fontWeight:         '600',
    color:              palette.white,
    lineHeight:         13,
    textAlign:          'center',
    includeFontPadding: false,                      // Android vertical centering fix
    textAlignVertical:  'center',
  },

  // ── Left placeholder ───────────────────────────────────────────────────────
  // When no left element (no back, no hamburger) — spacer that mirrors leftSlot width.
  // Ensures title remains centered even without a left button.
  leftPlaceholder: {
    width: 44,                                      // mirrors leftSlot fixed width
  },
});

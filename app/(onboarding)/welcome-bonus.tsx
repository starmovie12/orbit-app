/**
 * app/(onboarding)/welcome-bonus.tsx
 *
 * CROWN — Welcome Quest Briefing · Final Onboarding Step (Step 4 of 4)
 * CROWN FINAL v1.0 · LAW 2 COMPLIANT · Rule 03 CONSTITUTIONAL · §1.4.3 COMPLIANT
 *
 * ── ⚠️  LAW 2 — ZERO-CREDIT FOUNDER RULE (ABSOLUTE) ─────────────────────────
 *  This screen MUST NOT award Credits for any action — ever.
 *  The Founder NEVER gives Credits to users under any circumstances.
 *  Every Credit in CROWN was purchased by a real user or transferred between
 *  users. This screen only awards BADGES for completing Welcome Quest tasks.
 *  Violating this rule = legal + financial risk (RBI/SEBI/FinCEN licensing).
 *
 * ── SCREEN PURPOSE ───────────────────────────────────────────────────────────
 *  Briefs new users on the 5 Welcome Quest tasks they'll complete inside the
 *  app. Shows badge rewards only. Explains the First-Reaction Guarantee (AI
 *  auto-react, clearly labeled 🤖, lifetime cap: 3). Ends onboarding and
 *  navigates to the main app.
 *
 * ── 5 WELCOME QUEST TASKS ────────────────────────────────────────────────────
 *  1. Send your first message          → "First Words" badge
 *  2. Get your first reaction          → "First Spark" badge
 *     (🤖 AI auto-reacts once, clearly labeled, lifetime cap: 3)
 *  3. Visit another sector             → "Explorer" badge
 *  4. Check your ranks                 → "Rank Watcher" badge
 *  5. Set your profile photo           → "Crowned" badge
 *
 * ── RULE 03 (CONSTITUTIONAL) ─────────────────────────────────────────────────
 *  ZERO avatar anywhere in this component. Avatar lives exclusively in the
 *  Glass Island bottom navigation — not in onboarding screens.
 *
 * ── ANIMATION ────────────────────────────────────────────────────────────────
 *  Reanimated v4 — all UI-thread worklets.
 *  • Staggered entrance: 5 task cards fade-in + slide-up (60ms stagger, 280ms each)
 *  • CTA button entrance: 360ms delay, then fade-in
 *  • Button press: scale 1.0 → 0.96 (80ms easeIn), spring release (stiffness:200, damping:18)
 *  • Reduced-motion: opacity-only fallback (no translateY, no scale)
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *  @/constants/colors     — colors · palette · radii · zIndex
 *  @/constants/spacing    — spacing · radius · shadows · layout
 *  @/constants/typography — FONT_SIZE · LETTER_SPACING · lh
 *  @/constants/animations — durations · easings · useReducedMotion
 *  Syne_800ExtraBold      — screen headings (§1.4.3)
 *  Inter_400/500/600      — body + UI labels (§1.4.3)
 *  @/components/OnboardingStepper
 *  @/contexts/AuthContext
 *  @/lib/firestore-users  — setOnboardingStep
 *  react-native-safe-area-context
 *  react-native-reanimated (v4 API)
 *  @expo/vector-icons Feather
 *  expo-haptics
 */

import React, { memo, useCallback, useEffect } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter }          from 'expo-router';
import { Feather }            from '@expo/vector-icons';
import * as Haptics           from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { OnboardingStepper }               from '@/components/OnboardingStepper';
import { useAuth }                         from '@/contexts/AuthContext';
import { setOnboardingStep }               from '@/lib/firestore-users';
import { colors, palette, radii, zIndex }  from '@/constants/colors';
import { spacing, radius, shadows }        from '@/constants/spacing';
import {
  FONT_SIZE,
  LETTER_SPACING,
  lh,
}                                          from '@/constants/typography';

// ─── PRD §1.4.3 — Typography constants (CROWN FINAL v1.0) ────────────────────
// DM Sans is BANNED (legacy ORBIT font). Cormorant is reserved for Profile
// bio / quotes only. Screen headings → Syne 800. UI labels/body → Inter ≤600.
//
// Required in your font loader (app/_layout.tsx or similar):
//   @expo-google-fonts/syne   → Syne_800ExtraBold
//   @expo-google-fonts/inter  → Inter_400Regular, Inter_500Medium, Inter_600SemiBold
//
// @/constants/typography must also be updated:
//   FONT_HEADING.display → 'Syne_800ExtraBold'
//   FONT_BODY.regular    → 'Inter_400Regular'
//   FONT_BODY.medium     → 'Inter_500Medium'
//   FONT_BODY.semiBold   → 'Inter_600SemiBold'
const SYNE_800          = 'Syne_800ExtraBold'   as const;
const INTER_400         = 'Inter_400Regular'    as const;
const INTER_500         = 'Inter_500Medium'     as const;
const INTER_600         = 'Inter_600SemiBold'   as const;
import { durations, useReducedMotion }     from '@/constants/animations';

// ─── Animation constants (named — zero magic numbers) ─────────────────────────

/** Duration of each task card entrance animation, ms */
const CARD_ENTER_DURATION_MS = 280 as const;

/** Stagger delay between consecutive card entrances, ms */
const CARD_STAGGER_MS = 60 as const;

/** Delay before the CTA button fades in (after last card + buffer), ms */
const CTA_ENTER_DELAY_MS = (CARD_STAGGER_MS * 4 + CARD_ENTER_DURATION_MS + 60) as const;

/** Vertical translation (dp) of task cards at entrance start → rest */
const CARD_ENTER_TRANSLATE_Y_DP = 12 as const;

/** Duration of button press-in scale animation, ms */
const BUTTON_PRESS_IN_DURATION_MS = 80 as const;

/** Scale factor when button is pressed in */
const BUTTON_PRESS_SCALE = 0.96 as const;

/** Spring config for button press-release — stiff snap, minimal bounce */
const BUTTON_RELEASE_SPRING = {
  stiffness: 200,
  damping:   18,
} as const;

/** Hit-slop for all icon buttons */
const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Onboarding step number this screen occupies (1-indexed) */
const ONBOARDING_STEP = 4 as const;

// ─── Task definitions (badge-only rewards — ZERO credits — LAW 2) ─────────────

interface WelcomeTask {
  readonly id:        string;
  readonly icon:      string;
  readonly title:     string;
  readonly detail:    string;
  readonly badge:     string;
  /**
   * Optional AI note — rendered with "🤖 AI" prefix when present.
   * Required by Anti-Drift Lock #5 (AI always labeled).
   */
  readonly aiNote?:   string;
}

/**
 * The 5 CROWN Welcome Quest tasks.
 * Rewards are badges ONLY — no Credits. (LAW 2 / Anti-Drift Lock #2)
 * Task IDs are stable — do NOT change after ship (used in analytics).
 */
const WELCOME_TASKS: ReadonlyArray<WelcomeTask> = [
  {
    id:     'wq_first_message',
    icon:   'message-circle',
    title:  'Send your first message',
    detail: 'Say anything. Your words reach everyone in the room instantly.',
    badge:  '"First Words" badge',
  },
  {
    id:     'wq_first_reaction',
    icon:   'heart',
    title:  'Get your first reaction',
    detail: 'Your message lands and someone reacts to it.',
    badge:  '"First Spark" badge',
    aiNote: 'AI auto-reacts to your very first message so you never wait alone. Lifetime cap: 3 times.',
  },
  {
    id:     'wq_visit_sector',
    icon:   'compass',
    title:  'Visit another sector',
    detail: 'Switch scope to explore a different neighbourhood.',
    badge:  '"Explorer" badge',
  },
  {
    id:     'wq_check_ranks',
    icon:   'award',
    title:  'Check your ranks',
    detail: 'Open the CROWN tab and see where you stand in your sector.',
    badge:  '"Rank Watcher" badge',
  },
  {
    id:     'wq_profile_photo',
    icon:   'camera',
    title:  'Set your profile photo',
    detail: 'Put a face to your handle. Stands out in every room.',
    badge:  '"Crowned" badge',
  },
] as const satisfies ReadonlyArray<WelcomeTask>;

// ─── Async state — discriminated union (LAW 10.2) ─────────────────────────────

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'error'; readonly message: string };

// ─── Sub-component: TaskCard ──────────────────────────────────────────────────

interface TaskCardProps {
  readonly task:         WelcomeTask;
  readonly index:        number;
  readonly enterProgress: Animated.SharedValue<number>;
  readonly reducedMotion: boolean;
}

/**
 * Animated task card showing icon, title, detail, and badge reward.
 * Entrance: fade-in + slide-up driven by `enterProgress` SharedValue.
 * Reduced-motion: opacity-only (no translateY per blueprint).
 * Rule 03: NO avatar in this component.
 */
const TaskCard = memo<TaskCardProps>(({
  task,
  index: _index,
  enterProgress,
  reducedMotion,
}) => {
  /** PERF: opacity + translateY — compositor — zero layout/paint */
  const cardStyle = useAnimatedStyle(() => {
    const opacity = enterProgress.value;
    if (reducedMotion) return { opacity };
    const translateY = interpolate(
      enterProgress.value,
      [0, 1],
      [CARD_ENTER_TRANSLATE_Y_DP, 0],
    );
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <Animated.View
      style={[styles.taskCard, cardStyle]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Task: ${task.title}. Reward: ${task.badge}`}
    >
      {/* Icon badge */}
      <View style={styles.taskIconCircle} accessibilityElementsHidden>
        <Feather
          name={task.icon as never}
          size={18}
          color={colors.fg.brand}
        />
      </View>

      {/* Text content */}
      <View style={styles.taskContent}>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={styles.taskDetail} numberOfLines={2}>
          {task.detail}
        </Text>

        {/* AI note — always prefixed with 🤖 AI (Anti-Drift Lock #5) */}
        {task.aiNote ? (
          <Text style={styles.taskAiNote} numberOfLines={2}>
            {'🤖 AI: '}
            {task.aiNote}
          </Text>
        ) : null}

        {/* Badge reward */}
        <View style={styles.badgeRow} accessibilityElementsHidden>
          <Feather name="award" size={11} color={colors.fg.success} />
          <Text style={styles.badgeLabel}>{task.badge}</Text>
        </View>
      </View>
    </Animated.View>
  );
});

TaskCard.displayName = 'WelcomeQuest.TaskCard';

// ─── Sub-component: ZeroCreditNote ────────────────────────────────────────────

/**
 * Prominently explains the Zero-Credit Founder Rule to the user.
 * Transparent, honest, trust-building — per §1.2.1 Law 2 + Law 4 (Respect Rule).
 * Animated in with the same enterProgress as the button.
 */
interface ZeroCreditNoteProps {
  readonly enterProgress: Animated.SharedValue<number>;
  readonly reducedMotion: boolean;
}

const ZeroCreditNote = memo<ZeroCreditNoteProps>(({ enterProgress, reducedMotion }) => {
  /** PERF: opacity only — compositor — zero layout/paint */
  const noteStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? enterProgress.value : enterProgress.value,
  }));

  return (
    <Animated.View style={[styles.zeroCreditNote, noteStyle]}>
      <Feather
        name="shield"
        size={14}
        color={colors.fg.brandText}
        style={styles.zeroCreditIcon}
      />
      <Text style={styles.zeroCreditText}>
        {'Founding rule: CROWN never gives you Credits. Every Credit in this app was paid for by another user — not us.'}
      </Text>
    </Animated.View>
  );
});

ZeroCreditNote.displayName = 'WelcomeQuest.ZeroCreditNote';

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Welcome Quest briefing screen — final step of CROWN onboarding.
 *
 * Shows the 5 tasks users will complete in the app (badge rewards only).
 * Explains the First-Reaction Guarantee (AI auto-react, 🤖 labeled, cap: 3).
 * States the Zero-Credit Founder Rule clearly (LAW 2).
 *
 * On "Enter CROWN" press: marks onboarding complete → navigates to /(tabs).
 *
 * @security No Credits are awarded. No financial operations. Low-risk route.
 * @see LAW 2 — Zero-Credit Founder Rule (lib/anti-drift-constants.ts)
 * @see Anti-Drift Lock #5 — AI always labeled
 * @see Rule 03 — avatar NEVER in headers or onboarding screens
 */
function WelcomeBonusScreen(): React.ReactElement {
  const insets      = useSafeAreaInsets();
  const router      = useRouter();
  const { firebaseUser, user } = useAuth();
  const reducedMotion = useReducedMotion();

  // ── Async submit state (discriminated union) ──────────────────────────────
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: 'idle' });

  // ── Entrance animation SharedValues — 5 task cards + CTA + zero-credit note
  // Named individually — React hooks cannot be called in loops.
  const card0Enter = useSharedValue(0);
  const card1Enter = useSharedValue(0);
  const card2Enter = useSharedValue(0);
  const card3Enter = useSharedValue(0);
  const card4Enter = useSharedValue(0);
  const ctaEnter   = useSharedValue(0);

  // ── Button press animation ────────────────────────────────────────────────
  const buttonScale   = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);

  // ── Trigger staggered entrance on mount ──────────────────────────────────
  useEffect(() => {
    const timingCfg = {
      duration: CARD_ENTER_DURATION_MS,
      easing:   Easing.out(Easing.cubic),
    };

    if (reducedMotion) {
      // Reduced-motion: instant opacity reveal, no position animation
      card0Enter.value = 1;
      card1Enter.value = 1;
      card2Enter.value = 1;
      card3Enter.value = 1;
      card4Enter.value = 1;
      ctaEnter.value   = 1;
      return;
    }

    // Staggered fade-in + slide-up: 60ms between each card
    /* PERF: UI-thread worklet — zero bridge cost */
    card0Enter.value = withDelay(CARD_STAGGER_MS * 0, withTiming(1, timingCfg));
    card1Enter.value = withDelay(CARD_STAGGER_MS * 1, withTiming(1, timingCfg));
    card2Enter.value = withDelay(CARD_STAGGER_MS * 2, withTiming(1, timingCfg));
    card3Enter.value = withDelay(CARD_STAGGER_MS * 3, withTiming(1, timingCfg));
    card4Enter.value = withDelay(CARD_STAGGER_MS * 4, withTiming(1, timingCfg));
    ctaEnter.value   = withDelay(CTA_ENTER_DELAY_MS,  withTiming(1, {
      duration: durations.normal,
      easing:   Easing.out(Easing.cubic),
    }));
  }, [
    reducedMotion,
    card0Enter, card1Enter, card2Enter, card3Enter, card4Enter,
    ctaEnter,
  ]);

  // ── Button animated style ─────────────────────────────────────────────────
  /** PERF: scale + opacity — compositor — zero layout/paint */
  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity:   buttonOpacity.value,
  }));

  /** PERF: opacity — compositor — zero layout/paint */
  const ctaWrapStyle = useAnimatedStyle(() => ({
    opacity: ctaEnter.value,
  }));

  // ── Button press handlers ─────────────────────────────────────────────────
  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reducedMotion) {
      buttonScale.value = withTiming(BUTTON_PRESS_SCALE, {
        duration: BUTTON_PRESS_IN_DURATION_MS,
        easing:   Easing.in(Easing.cubic),
      });
    }
    buttonOpacity.value = withTiming(0.85, {
      duration: BUTTON_PRESS_IN_DURATION_MS,
      easing:   Easing.in(Easing.cubic),
    });
  }, [reducedMotion, buttonScale, buttonOpacity]);

  const handlePressOut = useCallback(() => {
    if (!reducedMotion) {
      buttonScale.value = withSpring(1.0, BUTTON_RELEASE_SPRING);
    }
    buttonOpacity.value = withTiming(1.0, {
      duration: durations.fast,
      easing:   Easing.out(Easing.cubic),
    });
  }, [reducedMotion, buttonScale, buttonOpacity]);

  // ── Finish onboarding: mark step 'done' → navigate to tabs ───────────────
  const handleEnterCrown = useCallback(async (): Promise<void> => {
    if (!firebaseUser || submitState.status === 'submitting') return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitState({ status: 'submitting' });

    try {
      await setOnboardingStep(firebaseUser.uid, 'done');
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const message = e instanceof Error
        ? e.message
        : 'Something went wrong. Please try again.';
      setSubmitState({ status: 'error', message });
    }
  }, [firebaseUser, submitState.status, router]);

  // ── Parallelize enter SharedValue refs for TaskCard ───────────────────────
  const cardEnterValues: ReadonlyArray<Animated.SharedValue<number>> = [
    card0Enter,
    card1Enter,
    card2Enter,
    card3Enter,
    card4Enter,
  ] as const;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View
      style={[styles.root, { backgroundColor: colors.bg.surface }]}
      accessibilityRole="none"
    >

      {/* ── Safe-area head: stepper ─────────────────────────────────────── */}
      <View style={[styles.head, { paddingTop: insets.top + spacing.md }]}>
        <OnboardingStepper step={ONBOARDING_STEP} />
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Crown icon */}
        <View
          style={styles.crownCircle}
          accessibilityElementsHidden
        >
          <Feather name="award" size={28} color={colors.fg.brand} />
        </View>

        {/* Screen title */}
        <Text
          style={styles.headline}
          accessibilityRole="header"
        >
          {'Your Welcome Quest'}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subheadline}>
          {
            '5 tasks inside the app. Complete them to earn exclusive badges. '
          }
          <Text style={styles.subheadlineStrong}>
            {'Zero Credits from us — ever.'}
          </Text>
        </Text>

        {/* ── 5 Task cards (staggered entrance) ─────────────────────────── */}
        <View
          style={styles.taskList}
          accessibilityRole="list"
          accessibilityLabel="Welcome Quest tasks"
        >
          {WELCOME_TASKS.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              enterProgress={cardEnterValues[index]!}
              reducedMotion={reducedMotion}
            />
          ))}
        </View>

        {/* ── Zero-Credit Founder Rule note ─────────────────────────────── */}
        <ZeroCreditNote
          enterProgress={ctaEnter}
          reducedMotion={reducedMotion}
        />

        {/* Bottom scroll padding */}
        <View style={styles.scrollPadBottom} />
      </ScrollView>

      {/* ── Footer: CTA button ──────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.footer,
          ctaWrapStyle,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
      >

        {/* Error message */}
        {submitState.status === 'error' ? (
          <Text
            style={styles.errorText}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {submitState.message}
          </Text>
        ) : null}

        <Pressable
          onPress={handleEnterCrown}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={submitState.status === 'submitting'}
          hitSlop={ICON_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={
            submitState.status === 'submitting'
              ? 'Entering CROWN, please wait'
              : user?.displayName
                ? `Enter CROWN as @${user.displayName}`
                : 'Enter CROWN'
          }
          accessibilityState={{ disabled: submitState.status === 'submitting' }}
          accessibilityHint="Finishes onboarding and opens the main app"
        >
          <Animated.View style={[styles.ctaInner, buttonAnimStyle]}>
            {submitState.status === 'submitting' ? (
              /* Submitting state — spinner via animated dot */
              <View style={styles.ctaLoadingRow} accessibilityElementsHidden>
                <Feather name="loader" size={16} color={colors.fg.onBrand} />
                <Text style={styles.ctaText}>{'Entering…'}</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>
                {user?.displayName
                  ? `Enter CROWN, @${user.displayName}`
                  : 'Enter CROWN'}
              </Text>
            )}
          </Animated.View>
        </Pressable>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Typography mapping (PRD §1.4.3 — CROWN FINAL v1.0):
//   SYNE_800  = 'Syne_800ExtraBold'   — screen headings (was: CormorantGaramond_700Bold — BANNED here)
//   INTER_400 = 'Inter_400Regular'    — body text       (was: DMSans_400Regular — BANNED)
//   INTER_500 = 'Inter_500Medium'     — UI emphasis      (was: DMSans_500Medium  — BANNED)
//   INTER_600 = 'Inter_600SemiBold'   — UI labels/CTA   (was: DMSans_600/700Bold — BANNED; 600 is max)
//   Cormorant Garamond: Profile bio + quotes ONLY — never for headings/screen titles
//   DM Sans: BANNED in all CROWN components (legacy ORBIT font)
//
// Color token mapping:
//   colors.bg.surface          = white — screen bg
//   colors.bg.card             = cream[200] — card fill
//   colors.bg.goldSoft         = gold[50] — icon circle bg
//   colors.fg.primary          = ink[950] — primary text
//   colors.fg.secondary        = ink[600] — secondary text
//   colors.fg.tertiary         = ink[500] — tertiary / de-emphasized
//   colors.fg.brand            = gold[600] — brand accent (icons, CTA)
//   colors.fg.brandText        = gold[700] — brand text on white
//   colors.fg.success          = #1A7A4A emerald — badge label
//   colors.fg.onBrand          = white — text on gold CTA
//   colors.border.card         = cream[400] — card borders
//   colors.border.default      = cream[400] — dividers
//   radii.md                   = 12px — cards
//   radii.lg                   = 16px — major card
//   radii.full                 = 9999px — icon circle
//   spacing.xs                 = 4px
//   spacing.sm                 = 8px
//   spacing.md                 = 12px
//   spacing.lg                 = 16px
//   spacing.xl                 = 20px
//   spacing.screenH            = 18px

const styles = StyleSheet.create({

  // ── Root ─────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
  },

  // ── Head ─────────────────────────────────────────────────────────────────
  head: {
    paddingHorizontal: spacing.screenH,  // 18px
    paddingBottom:     spacing.sm,       // 8px
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.screenH,  // 18px
    paddingTop:        spacing.sm,       // 8px
    alignItems:        'center',
  },

  scrollPadBottom: {
    height: spacing.xl,                  // 20px — breathing room above footer
  },

  // ── Crown circle icon ─────────────────────────────────────────────────────
  // Rule 03: this is the CROWN icon (award/crown), NOT an avatar.
  crownCircle: {
    width:           64,
    height:          64,
    borderRadius:    radii.full,         // 9999 — full circle
    backgroundColor: colors.bg.goldSoft, // gold[50] — light gold tint
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.lg,         // 16px
    ...Platform.select({
      ios: {
        shadowColor:   palette.gold[600],
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius:  8,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // ── Headline ──────────────────────────────────────────────────────────────
  headline: {
    fontFamily:    SYNE_800,                     // §1.4.3: Syne 800 for screen headings
    fontSize:      FONT_SIZE.h3,                // 24px
    fontWeight:    '800',
    lineHeight:    lh(FONT_SIZE.h3, 'tight'),   // 29px
    letterSpacing: LETTER_SPACING.tight,        // -0.2
    color:         colors.fg.primary,           // ink[950]
    textAlign:     'center',
    marginBottom:  spacing.sm,                  // 8px
  },

  // ── Subheadline ───────────────────────────────────────────────────────────
  subheadline: {
    fontFamily:    INTER_400,                    // §1.4.3: Inter 400 for body/UI text
    fontSize:      FONT_SIZE.base,              // 15px
    fontWeight:    '400',
    lineHeight:    lh(FONT_SIZE.base, 'relaxed'), // 23px
    letterSpacing: LETTER_SPACING.normal,       // 0
    color:         colors.fg.secondary,         // ink[600]
    textAlign:     'center',
    marginBottom:  spacing.xl,                  // 20px
    maxWidth:      320,
  },

  subheadlineStrong: {
    fontFamily:    INTER_600,                    // §1.4.3: Inter 600 for UI emphasis
    fontWeight:    '600',
    color:         colors.fg.primary,           // ink[950]
  },

  // ── Task list ─────────────────────────────────────────────────────────────
  taskList: {
    width:         '100%',
    gap:           spacing.sm,                  // 8px between cards
    marginBottom:  spacing.lg,                  // 16px
  },

  // ── Task card ─────────────────────────────────────────────────────────────
  taskCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: colors.bg.card,            // cream[200]
    borderWidth:     1,
    borderColor:     colors.border.card,        // cream[400]
    borderRadius:    radii.md,                  // 12px
    padding:         spacing.md,                // 12px
    gap:             spacing.sm,                // 8px
    ...Platform.select({
      ios: {
        shadowColor:   palette.gold[600],
        shadowOffset:  { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius:  4,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  // ── Task icon circle ──────────────────────────────────────────────────────
  // Touch target N/A — decorative (not interactive)
  taskIconCircle: {
    width:           36,
    height:          36,
    borderRadius:    radii.base,                // 8px — matches radii.xs alias
    backgroundColor: colors.bg.goldSoft,        // gold[50]
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  // ── Task content ──────────────────────────────────────────────────────────
  taskContent: {
    flex: 1,
  },

  taskTitle: {
    fontFamily:    INTER_600,                    // §1.4.3: Inter 600 for UI labels
    fontSize:      FONT_SIZE.md,                // 14px
    fontWeight:    '600',
    lineHeight:    lh(FONT_SIZE.md, 'snug'),    // 18px
    letterSpacing: LETTER_SPACING.normal,       // 0
    color:         colors.fg.primary,           // ink[950]
    marginBottom:  2,
  },

  taskDetail: {
    fontFamily:    INTER_400,                    // §1.4.3: Inter 400 for body text
    fontSize:      FONT_SIZE.sm,                // 13px
    fontWeight:    '400',
    lineHeight:    lh(FONT_SIZE.sm, 'relaxed'), // 20px
    letterSpacing: LETTER_SPACING.normal,       // 0
    color:         colors.fg.secondary,         // ink[600]
    marginBottom:  4,
  },

  // ── AI note — always prefixed "🤖 AI:" (Anti-Drift Lock #5) ──────────────
  taskAiNote: {
    fontFamily:    INTER_400,                    // §1.4.3: Inter 400 for body text
    fontSize:      FONT_SIZE.cap,               // 12px
    fontWeight:    '400',
    lineHeight:    lh(FONT_SIZE.cap, 'relaxed'), // 18px
    letterSpacing: LETTER_SPACING.normal,       // 0
    color:         colors.fg.tertiary,          // ink[500]
    fontStyle:     'italic',
    marginBottom:  4,
  },

  // ── Badge reward row ──────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,                  // 4px
    marginTop:     2,
  },

  badgeLabel: {
    fontFamily:    INTER_600,                    // §1.4.3: Inter 600 for UI labels
    fontSize:      FONT_SIZE.cap,               // 12px
    fontWeight:    '600',
    letterSpacing: LETTER_SPACING.wide,         // 0.3
    color:         colors.fg.success,           // emerald #1A7A4A
  },

  // ── Zero-Credit Founder Rule note ─────────────────────────────────────────
  zeroCreditNote: {
    width:           '100%',
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,                // 8px
    backgroundColor: colors.bg.goldSoft,        // gold[50] — warm trust bg
    borderWidth:     1,
    borderColor:     colors.border.card,        // cream[400]
    borderRadius:    radii.md,                  // 12px
    padding:         spacing.md,                // 12px
    marginBottom:    spacing.sm,                // 8px
  },

  zeroCreditIcon: {
    marginTop: 1,                               // optical alignment with first line
  },

  zeroCreditText: {
    flex:          1,
    fontFamily:    INTER_400,                    // §1.4.3: Inter 400 for body text
    fontSize:      FONT_SIZE.cap,               // 12px
    fontWeight:    '400',
    lineHeight:    lh(FONT_SIZE.cap, 'relaxed'), // 18px
    letterSpacing: LETTER_SPACING.normal,       // 0
    color:         colors.fg.brandText,         // gold[700] — brand trust color
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.screenH,         // 18px
    paddingTop:        spacing.sm,              // 8px
  },

  // ── Error text ────────────────────────────────────────────────────────────
  errorText: {
    fontFamily:    INTER_500,                    // §1.4.3: Inter 500 for UI labels
    fontSize:      FONT_SIZE.sm,                // 13px
    fontWeight:    '500',
    lineHeight:    lh(FONT_SIZE.sm, 'snug'),    // 17px
    color:         colors.fg.error,             // crimson[600] #C4294F
    textAlign:     'center',
    marginBottom:  spacing.sm,                  // 8px
  },

  // ── CTA button inner (Animated.View — receives scale/opacity) ─────────────
  // Min height 56px — ≥ 44pt Apple HIG touch target on a full-width button.
  // Using full-width + 16px padding = easily exceeds 44pt minimum.
  ctaInner: {
    backgroundColor:  colors.fg.brand,          // gold[600] — primary brand CTA
    borderRadius:     radii.md,                 // 12px
    height:           56,
    alignItems:       'center',
    justifyContent:   'center',
    ...Platform.select({
      ios: {
        shadowColor:   palette.gold[600],
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.30,
        shadowRadius:  12,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  ctaText: {
    fontFamily:    INTER_600,                    // §1.4.3: Inter 600 — max allowed weight for UI labels
    fontSize:      FONT_SIZE.md,                // 14px — compact but clear
    fontWeight:    '600',                        // 700 is banned — Inter UI label cap is 600 per §1.4.3
    letterSpacing: LETTER_SPACING.wide,         // 0.3 — slight spread for CTA legibility
    color:         colors.fg.onBrand,           // white — on gold bg
  },

  ctaLoadingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,                  // 8px
  },

});

export default WelcomeBonusScreen;

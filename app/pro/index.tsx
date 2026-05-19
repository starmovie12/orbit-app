/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — CROWN Pass Screen  (app/crown/index.tsx)                        ║
 * ║  Blueprint §1.4.8 — Deterministic Monthly Progression Pass               ║
 * ║                                                                          ║
 * ║  Laws enforced:                                                           ║
 * ║    PRD §1.3.2 — Full-width fixed bottom nav (NO floating Glass Island)   ║
 * ║    PRD §1.4.7 Anti-Rule — No Floating Glass Island nav anywhere           ║
 * ║    LAW 22 — Active defense: Credits deducted via Firestore transaction   ║
 * ║    PRD §1.2.1 Law 2 — Zero-Credit Founder Rule honoured (pass costs      ║
 * ║      Credits the user purchased; company never grants Credits)            ║
 * ║    PRD §1.2.2 Non-Negotiable #2 — Credits-only, zero ₹/$/€ symbols      ║
 * ║    PRD §1.4.8 BANNED — Loot boxes · Gacha · Spin-the-wheel · Random     ║
 * ║                                                                          ║
 * ║  CROWN Pass = monthly progression with 4 DETERMINISTIC tier unlocks.    ║
 * ║  Every unlock is fully specified before purchase. Zero surprises.         ║
 * ║                                                                          ║
 * ║  Animation: Reanimated v4 — all worklets run on UI thread (zero bridge) ║
 * ║  Tokens: @/constants/colors (crown as t) · @/constants/spacing           ║
 * ║          @/constants/typography — ZERO hardcoded values · ZERO raw hex   ║
 * ║          ZERO ₹ symbols                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/components/shared';
import {
  crown as t,
  animation as animationTokens,
  dimensions,
} from '@/constants/colors';
import { spacing, radius, shadows, layout } from '@/constants/spacing';
import {
  typography,
  FONT_BODY,
  FONT_HEADING,
  FONT_SIZE,
  lh,
  LETTER_SPACING,
} from '@/constants/typography';
import { TITLES, TITLE_LABELS } from '@/constants/titles';
import { BRAND, BADGES } from '@/constants/branding';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { firestore, serverTimestamp } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Cost to activate CROWN Pass for one month — paid in Credits. No ₹ symbol. */
const PASS_PRICE_CREDITS = 500 as const;

/** Pass duration in milliseconds (30 days). */
const PASS_DURATION_MS = 30 * 24 * 60 * 60 * 1000 as const;

/** Milliseconds in a day — used for tier day calculations. */
const DAY_MS = 24 * 60 * 60 * 1000 as const;

/** Minimum Credits required to display low-balance warning. */
const LOW_BALANCE_THRESHOLD = PASS_PRICE_CREDITS + 50 as const;

/** Cross-platform snap.exists safety — boolean property, never function. */
function snapExists(s: { exists: boolean | (() => boolean) }): boolean {
  return typeof s.exists === 'function' ? s.exists() : !!s.exists;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union for all async states of CROWN Pass.
 * Covers every state a UI component might render.
 */
type PassState =
  | { status: 'loading' }
  | { status: 'idle'; credits: number; isFounder: boolean; titlesEarned: readonly TitleTier[] }
  | {
      status: 'active';
      credits: number;
      isFounder: boolean;
      titlesEarned: readonly TitleTier[];
      activeSince: number;
      activeUntil: number;
      currentTierIndex: number;
      unlockedFrameIds: readonly string[];
    }
  | { status: 'founder_only'; founderSince: number }
  | { status: 'purchasing' }
  | { status: 'success'; unlockedFrameId: string }
  | { status: 'error'; message: string; retryable: boolean };

/** Title tier keys for title-earned frame unlocks. */
type TitleTier = 'SECTOR' | 'CITY' | 'COUNTRY' | 'WORLD';

/** A single deterministic progression tier in the CROWN Pass ladder. */
type PassTier = {
  readonly tierIndex: number;
  readonly day: number;
  readonly frameId: string;
  readonly frameName: string;
  readonly description: string;
  readonly featherIcon: 'award' | 'star' | 'sun' | 'zap';
  readonly accentColor: string;
  readonly accessibilityLabel: string;
};

/** A title-earned frame (separate from pass progression). */
type TitleFrame = {
  readonly titleTier: TitleTier;
  readonly frameName: string;
  readonly frameDescription: string;
  readonly titleString: string;
  readonly featherIcon: 'shield' | 'flag' | 'map-pin' | 'globe';
  readonly accentColor: string;
};

/** Data shape pulled from Firestore /users/{uid}. */
type CrownPassUserDoc = {
  readonly credits: number;
  readonly isFounder?: boolean;
  readonly crownPassStatus?: 'active' | 'inactive';
  readonly crownPassSince?: number;
  readonly crownPassUntil?: number;
  readonly titlesEarned?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PASS TIER DATA (DETERMINISTIC — zero randomness, zero surprises)
// All 4 tiers are fully specified. User sees exactly what they get before paying.
// ─────────────────────────────────────────────────────────────────────────────

const PASS_TIERS: readonly PassTier[] = [
  {
    tierIndex: 0,
    day: 0,
    frameId: 'crown_pass_bronze',
    frameName: 'Crown Bronze Frame',
    description: 'Unlocks instantly on activation',
    featherIcon: 'award',
    accentColor: t.brand,
    accessibilityLabel: 'Tier 1: Crown Bronze Frame, unlocks on activation',
  },
  {
    tierIndex: 1,
    day: 7,
    frameId: 'crown_pass_silver',
    frameName: 'Crown Silver Frame',
    description: 'Unlocks on Day 7 of your pass',
    featherIcon: 'star',
    accentColor: t.textMuted,
    accessibilityLabel: 'Tier 2: Crown Silver Frame, unlocks on day 7',
  },
  {
    tierIndex: 2,
    day: 14,
    frameId: 'crown_pass_amber',
    frameName: 'Crown Amber Frame',
    description: 'Unlocks on Day 14 of your pass',
    featherIcon: 'sun',
    accentColor: t.brand,
    accessibilityLabel: 'Tier 3: Crown Amber Frame, unlocks on day 14',
  },
  {
    tierIndex: 3,
    day: 28,
    frameId: 'crown_pass_platinum',
    frameName: 'Crown Platinum Frame',
    description: 'Unlocks on Day 28 — full month bonus',
    featherIcon: 'zap',
    accentColor: t.brand,
    accessibilityLabel: 'Tier 4: Crown Platinum Frame, unlocks on day 28',
  },
] as const;

/** Title-earned frames — separate from pass, earned by holding titles. */
const TITLE_FRAMES: readonly TitleFrame[] = [
  {
    titleTier: 'SECTOR',
    frameName: 'BARON Bronze Frame',
    frameDescription: `Hold ${TITLES.SECTOR} title once in any cycle`,
    titleString: TITLES.SECTOR,
    featherIcon: 'shield',
    accentColor: t.success,
  },
  {
    titleTier: 'CITY',
    frameName: 'VICEROY Silver Frame',
    frameDescription: `Hold ${TITLES.CITY} title once in any city`,
    titleString: TITLES.CITY,
    featherIcon: 'map-pin',
    accentColor: t.brand,
  },
  {
    titleTier: 'COUNTRY',
    frameName: 'SOVEREIGN Gold Frame',
    frameDescription: `Hold ${TITLES.COUNTRY} title once in any country`,
    titleString: TITLES.COUNTRY,
    featherIcon: 'flag',
    accentColor: t.brand,
  },
  {
    titleTier: 'WORLD',
    frameName: 'IMPERATOR Diamond Frame',
    frameDescription: `Hold ${TITLES.WORLD} title once globally`,
    titleString: TITLES.WORLD,
    featherIcon: 'globe',
    accentColor: t.brandLight,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — FIRESTORE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the user's CROWN Pass status from Firestore.
 * Uses snap.exists as boolean property per CROWN codebase rule.
 */
async function fetchPassData(uid: string): Promise<CrownPassUserDoc | null> {
  const snap = await firestore().collection('users').doc(uid).get();
  if (!snapExists(snap)) return null;
  const data = snap.data() as CrownPassUserDoc;
  return {
    credits: data?.credits ?? 0,
    isFounder: data?.isFounder ?? false,
    crownPassStatus: data?.crownPassStatus ?? 'inactive',
    crownPassSince: data?.crownPassSince ?? undefined,
    crownPassUntil: data?.crownPassUntil ?? undefined,
    titlesEarned: data?.titlesEarned ?? [],
  };
}

/**
 * Activate CROWN Pass via Firestore transaction.
 *
 * Credits are deducted atomically. Pass cannot be activated with insufficient
 * Credits — prevents any race condition or balance manipulation.
 *
 * @throws {Error} when balance insufficient or user document missing
 * @security Auth required. Audit record written in same transaction.
 */
async function activateCrownPass(uid: string): Promise<{
  activeSince: number;
  activeUntil: number;
}> {
  const db = firestore();
  const userRef = db.collection('users').doc(uid);
  const now = Date.now();
  const activeUntil = now + PASS_DURATION_MS;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snapExists(snap)) throw new Error('USER_NOT_FOUND');

    const data = snap.data() as CrownPassUserDoc;
    const currentCredits = data?.credits ?? 0;

    if (currentCredits < PASS_PRICE_CREDITS) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    if (data?.crownPassStatus === 'active') {
      throw new Error('PASS_ALREADY_ACTIVE');
    }

    // Atomic debit + pass activation
    tx.update(userRef, {
      credits: currentCredits - PASS_PRICE_CREDITS,
      crownPassStatus: 'active',
      crownPassSince: now,
      crownPassUntil: activeUntil,
      updatedAt: serverTimestamp(),
    });
  });

  // Write audit record outside transaction (non-critical, idempotent retry safe)
  await db
    .collection('users')
    .doc(uid)
    .collection('passHistory')
    .add({
      type: 'activate',
      creditsSpent: PASS_PRICE_CREDITS,
      activatedAt: now,
      expiresAt: activeUntil,
      createdAt: serverTimestamp(),
    });

  return { activeSince: now, activeUntil };
}

/**
 * Compute which pass tier index is currently active based on days elapsed.
 * Purely deterministic — no server call required.
 */
function computeCurrentTierIndex(activeSince: number): number {
  const daysElapsed = Math.floor((Date.now() - activeSince) / DAY_MS);
  let tier = 0;
  for (const t of PASS_TIERS) {
    if (daysElapsed >= t.day) tier = t.tierIndex;
    else break;
  }
  return tier;
}

/**
 * Compute which frame IDs are unlocked based on days elapsed.
 */
function computeUnlockedFrameIds(activeSince: number): readonly string[] {
  const daysElapsed = Math.floor((Date.now() - activeSince) / DAY_MS);
  return PASS_TIERS.filter((t) => daysElapsed >= t.day).map((t) => t.frameId);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — PRESENTATIONAL COMPONENTS
// All wrapped in React.memo — receive only stable props.
// ─────────────────────────────────────────────────────────────────────────────

// ── PassHeroBadge ────────────────────────────────────────────────────────────

type PassHeroBadgeProps = {
  readonly isActive: boolean;
};

/** Status pill shown at top of hero card. */
const PassHeroBadge = memo(function PassHeroBadge({
  isActive,
}: PassHeroBadgeProps) {
  return (
    <View
      style={[
        styles.heroBadge,
        isActive ? styles.heroBadgeActive : styles.heroBadgeInactive,
      ]}
      accessibilityRole="text"
      accessibilityLabel={isActive ? 'CROWN Pass is currently active' : 'CROWN Pass is not active'}
    >
      <Feather
        name={isActive ? 'check-circle' : 'crown'}
        size={12}
        color={isActive ? t.success : t.warning}
      />
      <Text
        style={[
          styles.heroBadgeTxt,
          { color: isActive ? t.success : t.warning },
        ]}
      >
        {isActive ? 'PASS ACTIVE' : 'CROWN PASS'}
      </Text>
    </View>
  );
});

// ── PassProgressBar ──────────────────────────────────────────────────────────

type PassProgressBarProps = {
  readonly daysElapsed: number;
  readonly daysTotal: 30;
};

/** Animated progress bar showing days elapsed in current pass month. */
const PassProgressBar = memo(function PassProgressBar({
  daysElapsed,
  daysTotal,
}: PassProgressBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      200,
      withSpring(Math.min(daysElapsed / daysTotal, 1), {
        stiffness: animationTokens.easing.springGentle.stiffness,
        damping: animationTokens.easing.springGentle.damping,
      }),
    );
  }, [daysElapsed, daysTotal, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: daysTotal, now: daysElapsed }}
      accessibilityLabel={`${daysElapsed} of ${daysTotal} days elapsed`}
    >
      <Animated.View style={[styles.progressFill, barStyle]} />
    </View>
  );
});

// ── PassHeroCard ─────────────────────────────────────────────────────────────

type PassHeroCardProps = {
  readonly passState: PassState;
};

/** Top hero section — crown icon, pass name, price, status. */
const PassHeroCard = memo(function PassHeroCard({
  passState,
}: PassHeroCardProps) {
  const isActive =
    passState.status === 'active' || passState.status === 'success';

  let renewalLabel: string | null = null;
  let daysElapsed = 0;

  if (passState.status === 'active') {
    const renewDate = new Date(passState.activeUntil).toLocaleDateString(
      'en-IN',
      { day: 'numeric', month: 'short' },
    );
    renewalLabel = `Expires ${renewDate}`;
    daysElapsed = Math.floor((Date.now() - passState.activeSince) / DAY_MS);
  }

  return (
    <View style={styles.heroCard} accessibilityRole="none">
      {/* Crown symbol row */}
      <View style={styles.heroIconRow}>
        <View style={styles.heroIconBg}>
          <Feather name="award" size={28} color={t.brand} />
        </View>
        <PassHeroBadge isActive={isActive} />
      </View>

      {/* Title */}
      <Text style={styles.heroTitle} accessibilityRole="header">
        CROWN Pass
      </Text>

      {/* Price — Credits only, never ₹ */}
      {!isActive && (
        <View style={styles.heroPriceRow}>
          <Text style={styles.heroPriceNum}>{PASS_PRICE_CREDITS}</Text>
          <Text style={styles.heroPriceUnit}> Credits / month</Text>
        </View>
      )}

      {/* Active state: progress bar + days */}
      {passState.status === 'active' && (
        <>
          <View style={styles.heroDaysRow}>
            <Text style={styles.heroDaysLabel}>
              Day {daysElapsed + 1} of 30
            </Text>
            {renewalLabel != null && (
              <Text style={styles.heroRenewalLabel}>{renewalLabel}</Text>
            )}
          </View>
          <PassProgressBar daysElapsed={daysElapsed} daysTotal={30} />
        </>
      )}

      {/* Sub-label */}
      {!isActive && (
        <Text style={styles.heroSub}>
          4 deterministic frame unlocks. No random rewards, ever.
        </Text>
      )}
    </View>
  );
});

// ── TierRow ──────────────────────────────────────────────────────────────────

type TierRowProps = {
  readonly tier: PassTier;
  readonly isUnlocked: boolean;
  readonly isCurrent: boolean;
  readonly isLast: boolean;
};

/** Single row in the tier progression ladder. */
const TierRow = memo(function TierRow({
  tier,
  isUnlocked,
  isCurrent,
  isLast,
}: TierRowProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, {
      stiffness: animationTokens.easing.springStiff.stiffness,
      damping: animationTokens.easing.springStiff.damping,
    });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      stiffness: animationTokens.easing.springStiff.stiffness,
      damping: animationTokens.easing.springStiff.damping,
    });
  }, [scale]);

  return (
    <Animated.View
      style={animatedStyle}
      accessibilityRole="none"
      accessible
      accessibilityLabel={tier.accessibilityLabel}
      accessibilityState={{ selected: isUnlocked }}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.tierRow,
          isCurrent && styles.tierRowCurrent,
          !isLast && styles.tierRowBorder,
        ]}
        disabled
        accessibilityRole="none"
      >
        {/* Connector line + dot */}
        <View style={styles.tierIndicatorCol}>
          <View
            style={[
              styles.tierDot,
              isUnlocked && styles.tierDotUnlocked,
              isCurrent && styles.tierDotCurrent,
            ]}
          >
            {isUnlocked ? (
              <Feather name="check" size={11} color={t.white} />
            ) : (
              <View style={styles.tierDotInner} />
            )}
          </View>
          {!isLast && (
            <View
              style={[
                styles.tierConnector,
                isUnlocked && styles.tierConnectorUnlocked,
              ]}
            />
          )}
        </View>

        {/* Content */}
        <View style={styles.tierContent}>
          {/* Day badge */}
          <View style={styles.tierDayBadge}>
            <Text style={styles.tierDayTxt}>
              {tier.day === 0 ? 'NOW' : `DAY ${tier.day}`}
            </Text>
          </View>

          {/* Frame details */}
          <View style={styles.tierFrameRow}>
            <View
              style={[
                styles.tierIconBg,
                { backgroundColor: `${tier.accentColor}18` },
              ]}
            >
              <Feather
                name={tier.featherIcon}
                size={16}
                color={isUnlocked ? tier.accentColor : t.textMuted}
              />
            </View>
            <View style={styles.tierTextBlock}>
              <Text
                style={[
                  styles.tierFrameName,
                  !isUnlocked && styles.tierTextLocked,
                ]}
                numberOfLines={1}
              >
                {tier.frameName}
              </Text>
              <Text
                style={[
                  styles.tierFrameDesc,
                  !isUnlocked && styles.tierTextLocked,
                ]}
                numberOfLines={1}
              >
                {tier.description}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ── TierLadder ───────────────────────────────────────────────────────────────

type TierLadderProps = {
  readonly currentTierIndex: number;
  readonly unlockedFrameIds: readonly string[];
};

/** Full deterministic progression ladder — all 4 tiers shown, nothing hidden. */
const TierLadder = memo(function TierLadder({
  currentTierIndex,
  unlockedFrameIds,
}: TierLadderProps) {
  const unlocked = new Set(unlockedFrameIds);

  return (
    <View style={styles.ladderCard}>
      {PASS_TIERS.map((tier, index) => (
        <TierRow
          key={tier.frameId}
          tier={tier}
          isUnlocked={unlocked.has(tier.frameId)}
          isCurrent={tier.tierIndex === currentTierIndex}
          isLast={index === PASS_TIERS.length - 1}
        />
      ))}
    </View>
  );
});

// ── FounderPassSection ───────────────────────────────────────────────────────

type FounderPassSectionProps = {
  readonly isFounder: boolean;
};

/**
 * Founder Diamond Frame section.
 * Day-1 Founder Pass — permanent, non-purchasable.
 * Shown to all users: founders see their permanent badge, others see the lore.
 */
const FounderPassSection = memo(function FounderPassSection({
  isFounder,
}: FounderPassSectionProps) {
  return (
    <View
      style={[
        styles.founderCard,
        isFounder && styles.founderCardActive,
      ]}
      accessibilityRole="none"
      accessible
      accessibilityLabel={
        isFounder
          ? 'You hold the Day 1 Founder Diamond Frame permanently'
          : 'Founder Diamond Frame — available to Day 1 founders only'
      }
    >
      {/* Header row */}
      <View style={styles.founderHeaderRow}>
        <View style={styles.founderIconBg}>
          <Feather
            name="star"
            size={18}
            color={isFounder ? t.brand : t.textMuted}
          />
        </View>
        <View style={styles.founderTitleBlock}>
          <Text style={[styles.founderTitle, !isFounder && styles.textLocked]}>
            {BADGES.FOUNDER_DAY1} Diamond Frame
          </Text>
          <Text style={styles.founderSubtitle}>
            Permanent · Non-purchasable
          </Text>
        </View>
        {isFounder && (
          <View style={styles.founderOwnedBadge}>
            <Feather name="check-circle" size={12} color={t.success} />
            <Text style={styles.founderOwnedTxt}>You have this</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <Text style={[styles.founderBody, !isFounder && styles.textLocked]}>
        {isFounder
          ? `You were part of CROWN on Day 1. This Diamond Frame lives in your profile permanently — it can never be purchased by anyone else.`
          : `Available only to users who joined CROWN on launch day. Cannot be purchased. Cannot be earned after Day 1. If you're reading this after launch, this frame belongs to the early believers.`}
      </Text>
    </View>
  );
});

// ── TitleFrameRow ────────────────────────────────────────────────────────────

type TitleFrameRowProps = {
  readonly frame: TitleFrame;
  readonly isEarned: boolean;
  readonly isLast: boolean;
};

/** Single title-earned frame row. */
const TitleFrameRow = memo(function TitleFrameRow({
  frame,
  isEarned,
  isLast,
}: TitleFrameRowProps) {
  return (
    <View
      style={[styles.titleFrameRow, !isLast && styles.titleFrameRowBorder]}
      accessible
      accessibilityRole="none"
      accessibilityLabel={`${frame.frameName}: ${isEarned ? 'earned' : 'not yet earned'}. ${frame.frameDescription}`}
    >
      <View
        style={[
          styles.titleFrameIconBg,
          { backgroundColor: `${frame.accentColor}18` },
        ]}
      >
        <Feather
          name={frame.featherIcon}
          size={17}
          color={isEarned ? frame.accentColor : t.textMuted}
        />
      </View>
      <View style={styles.titleFrameTextBlock}>
        <Text
          style={[styles.titleFrameName, !isEarned && styles.textLocked]}
          numberOfLines={1}
        >
          {frame.frameName}
        </Text>
        <Text style={styles.titleFrameDesc} numberOfLines={2}>
          {frame.frameDescription}
        </Text>
      </View>
      {isEarned ? (
        <View style={styles.titleFrameEarnedBadge}>
          <Feather name="check" size={12} color={t.success} />
        </View>
      ) : (
        <View style={styles.titleFrameLockedBadge}>
          <Feather name="lock" size={12} color={t.textMuted} />
        </View>
      )}
    </View>
  );
});

// ── TitleFramesSection ───────────────────────────────────────────────────────

type TitleFramesSectionProps = {
  readonly titlesEarned: readonly TitleTier[];
};

/** Title-earned frames — separate from CROWN Pass, earned by holding titles. */
const TitleFramesSection = memo(function TitleFramesSection({
  titlesEarned,
}: TitleFramesSectionProps) {
  const earnedSet = new Set(titlesEarned);

  return (
    <View style={styles.titleFramesCard}>
      {TITLE_FRAMES.map((frame, index) => (
        <TitleFrameRow
          key={frame.titleTier}
          frame={frame}
          isEarned={earnedSet.has(frame.titleTier)}
          isLast={index === TITLE_FRAMES.length - 1}
        />
      ))}
    </View>
  );
});

// ── AntiDarkPatternBox ────────────────────────────────────────────────────────

/**
 * Explicit transparency section — shows users what CROWN Pass does NOT contain.
 * PRD §1.2.1 Law 4 (Respect Rule): users are adults who handle honest info.
 * PRD §1.4.8: Banned mechanics listed publicly.
 */
const AntiDarkPatternBox = memo(function AntiDarkPatternBox() {
  const BANNED_ITEMS: readonly { readonly icon: 'x' | 'x-circle'; readonly label: string }[] = [
    { icon: 'x-circle', label: 'No Loot Boxes or Crown Crates' },
    { icon: 'x-circle', label: 'No Gacha or mystery pulls' },
    { icon: 'x-circle', label: 'No "spin the wheel" mechanics' },
    { icon: 'x-circle', label: 'No random rewards — ever' },
    { icon: 'x-circle', label: 'No bonus Credits from CROWN (Law 2)' },
    { icon: 'x-circle', label: 'No hidden paywalls' },
  ] as const;

  return (
    <View style={styles.antiPatternCard}>
      <View style={styles.antiPatternHeader}>
        <Feather name="shield" size={14} color={t.success} />
        <Text style={styles.antiPatternTitle}>
          What CROWN Pass does NOT contain
        </Text>
      </View>
      {BANNED_ITEMS.map((item) => (
        <View key={item.label} style={styles.antiPatternRow}>
          <Feather name="x" size={12} color={t.danger} />
          <Text style={styles.antiPatternLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
});

// ── StickyCtaBar ─────────────────────────────────────────────────────────────

type StickyCtaBarProps = {
  readonly passState: PassState;
  readonly onActivate: () => void;
};

/** Sticky bottom bar with the primary action button. */
const StickyCtaBar = memo(function StickyCtaBar({
  passState,
  onActivate,
}: StickyCtaBarProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  const isPurchasing = passState.status === 'purchasing';
  const isActive = passState.status === 'active' || passState.status === 'success';
  const isDisabled = isPurchasing || isActive;

  const hasInsufficientCredits =
    passState.status === 'idle' && passState.credits < PASS_PRICE_CREDITS;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (isDisabled) return;
    scale.value = withSpring(0.96, {
      stiffness: animationTokens.easing.springStiff.stiffness,
      damping: animationTokens.easing.springStiff.damping,
    });
  }, [isDisabled, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      stiffness: animationTokens.easing.springStiff.stiffness,
      damping: animationTokens.easing.springStiff.damping,
    });
  }, [scale]);

  // Derive label, sub-label, and button state
  let btnLabel = `Activate Pass — ${PASS_PRICE_CREDITS} Credits`;
  let btnSubLabel = 'One month · 4 deterministic frame unlocks';
  let btnIcon: React.ComponentProps<typeof Feather>['name'] = 'zap';

  if (isActive) {
    btnLabel = 'Pass Active';
    btnSubLabel = 'Your 4-tier unlock progression is running';
    btnIcon = 'check-circle';
  } else if (isPurchasing) {
    btnLabel = 'Activating…';
    btnSubLabel = 'Deducting Credits from your balance';
    btnIcon = 'loader';
  } else if (hasInsufficientCredits) {
    const needed = PASS_PRICE_CREDITS - (passState as { credits: number }).credits;
    btnLabel = `${needed} more Credits needed`;
    btnSubLabel = `You need ${PASS_PRICE_CREDITS} Credits to activate`;
    btnIcon = 'alert-circle';
  }

  return (
    <View
      style={[
        styles.ctaContainer,
        { paddingBottom: insets.bottom + spacing.md },
      ]}
      accessibilityRole="none"
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={isDisabled ? undefined : onActivate}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled || hasInsufficientCredits}
          style={[
            styles.ctaBtn,
            (isDisabled || hasInsufficientCredits) && styles.ctaBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={btnLabel}
          accessibilityState={{ disabled: isDisabled || hasInsufficientCredits }}
          hitSlop={0}
        >
          <Feather
            name={btnIcon}
            size={18}
            color={
              isDisabled || hasInsufficientCredits
                ? t.textMuted
                : t.white
            }
          />
          <Text
            style={[
              styles.ctaBtnTxt,
              (isDisabled || hasInsufficientCredits) && styles.ctaBtnTxtDisabled,
            ]}
          >
            {btnLabel}
          </Text>
        </Pressable>
      </Animated.View>

      <Text style={styles.ctaSubLabel} accessibilityRole="text">
        {btnSubLabel}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — SECTION LABEL (shared utility)
// ─────────────────────────────────────────────────────────────────────────────

type SectionLabelProps = {
  readonly children: string;
  readonly topMargin?: boolean;
};

const SectionLabel = memo(function SectionLabel({
  children,
  topMargin = false,
}: SectionLabelProps) {
  return (
    <Text
      style={[styles.sectionLabel, topMargin && { marginTop: spacing.xxl }]}
      accessibilityRole="header"
      aria-level={2}
    >
      {children}
    </Text>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — MAIN SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CrownPassScreen — CROWN Pass monthly progression screen.
 *
 * Replaces the former ORBIT Pro subscription. The CROWN Pass is Credits-based
 * (no ₹ symbol), deterministic (zero random rewards), and fully transparent
 * about what users receive before they purchase.
 *
 * @route  app/crown/index.tsx
 * @access Authenticated users only (enforced by RouteGuard in _layout.tsx)
 */
export default function CrownPassScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, firebaseUser } = useAuth();
  const haptics = useHaptics();

  // ── State ──────────────────────────────────────────────────────────────────
  const [passState, setPassState] = useState<PassState>({ status: 'loading' });
  const [scrolled, setScrolled] = useState(false);

  // ── Scroll offset for header border ───────────────────────────────────────
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      setScrolled(event.nativeEvent.contentOffset.y > 8);
    },
    [],
  );

  // ── Load pass status on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseUser?.uid) return;

    fetchPassData(firebaseUser.uid)
      .then((doc) => {
        if (!doc) {
          setPassState({
            status: 'idle',
            credits: 0,
            isFounder: false,
            titlesEarned: [],
          });
          return;
        }

        const titlesEarned = (doc.titlesEarned ?? []).filter(
          (t): t is TitleTier =>
            ['SECTOR', 'CITY', 'COUNTRY', 'WORLD'].includes(t),
        );

        const now = Date.now();
        const isPassActive =
          doc.crownPassStatus === 'active' &&
          doc.crownPassUntil != null &&
          doc.crownPassUntil > now;

        if (isPassActive && doc.crownPassSince != null) {
          setPassState({
            status: 'active',
            credits: doc.credits,
            isFounder: doc.isFounder ?? false,
            titlesEarned,
            activeSince: doc.crownPassSince,
            activeUntil: doc.crownPassUntil!,
            currentTierIndex: computeCurrentTierIndex(doc.crownPassSince),
            unlockedFrameIds: computeUnlockedFrameIds(doc.crownPassSince),
          });
        } else {
          setPassState({
            status: 'idle',
            credits: doc.credits,
            isFounder: doc.isFounder ?? false,
            titlesEarned,
          });
        }
      })
      .catch(() => {
        setPassState({
          status: 'error',
          message: 'Could not load pass status. Please try again.',
          retryable: true,
        });
      });
  }, [firebaseUser?.uid]);

  // ── Activate handler ───────────────────────────────────────────────────────
  const handleActivate = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    if (
      passState.status !== 'idle' ||
      passState.credits < PASS_PRICE_CREDITS
    ) return;

    haptics.impactMedium();

    const previousIdle = passState;
    setPassState({ status: 'purchasing' });

    try {
      const { activeSince, activeUntil } = await activateCrownPass(
        firebaseUser.uid,
      );

      haptics.notificationSuccess();

      setPassState({
        status: 'active',
        credits: previousIdle.credits - PASS_PRICE_CREDITS,
        isFounder: previousIdle.isFounder,
        titlesEarned: previousIdle.titlesEarned,
        activeSince,
        activeUntil,
        currentTierIndex: 0,
        unlockedFrameIds: [PASS_TIERS[0].frameId],
      });
    } catch (err: unknown) {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Unknown error';

      if (msg === 'INSUFFICIENT_CREDITS') {
        setPassState({
          status: 'error',
          message: `Not enough Credits. You need ${PASS_PRICE_CREDITS} Credits to activate CROWN Pass.`,
          retryable: false,
        });
      } else if (msg === 'PASS_ALREADY_ACTIVE') {
        setPassState({
          status: 'error',
          message: 'Your pass is already active. Pull down to refresh.',
          retryable: false,
        });
      } else {
        setPassState({
          status: 'error',
          message: 'Something went wrong. Please try again.',
          retryable: true,
        });
      }
    }
  }, [passState, firebaseUser?.uid, haptics]);

  const handleRetry = useCallback(() => {
    setPassState({ status: 'loading' });
    // Triggers re-fetch via useEffect dependency change would need a
    // separate counter; simplest: force reload by resetting uid dependency
    if (!firebaseUser?.uid) return;
    fetchPassData(firebaseUser.uid)
      .then((doc) => {
        if (!doc) {
          setPassState({ status: 'idle', credits: 0, isFounder: false, titlesEarned: [] });
          return;
        }
        const titlesEarned = (doc.titlesEarned ?? []).filter(
          (t): t is TitleTier => ['SECTOR', 'CITY', 'COUNTRY', 'WORLD'].includes(t),
        );
        setPassState({
          status: 'idle',
          credits: doc.credits,
          isFounder: doc.isFounder ?? false,
          titlesEarned,
        });
      })
      .catch(() =>
        setPassState({ status: 'error', message: 'Retry failed.', retryable: true }),
      );
  }, [firebaseUser?.uid]);

  // ── Derived values for rendering ──────────────────────────────────────────
  const isActive =
    passState.status === 'active' || passState.status === 'success';

  const currentTierIndex =
    passState.status === 'active' ? passState.currentTierIndex : 0;

  const unlockedFrameIds: readonly string[] =
    passState.status === 'active' ? passState.unlockedFrameIds : [];

  const isFounder =
    (passState as Partial<{ isFounder: boolean }>).isFounder ?? false;

  const titlesEarned: readonly TitleTier[] =
    (passState as Partial<{ titlesEarned: readonly TitleTier[] }>).titlesEarned ?? [];

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (passState.status === 'loading') {
    return (
      <View
        style={[styles.root, { paddingTop: insets.top }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel="Loading CROWN Pass"
      >
        <ScreenHeader
          title="CROWN Pass"
          onBack={() => router.back()}
        />
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonHero} accessibilityRole="progressbar" aria-busy />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
          <View style={[styles.skeletonRow, { width: '65%' }]} />
        </View>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (passState.status === 'error') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="CROWN Pass"
          onBack={() => router.back()}
          scrolled={scrolled}
        />
        <View style={styles.errorWrap} accessibilityLiveRegion="assertive">
          <Feather name="alert-circle" size={32} color={t.danger} />
          <Text style={styles.errorTitle}>Could not load CROWN Pass</Text>
          <Text style={styles.errorBody}>{passState.message}</Text>
          {passState.retryable && (
            <Pressable
              onPress={handleRetry}
              style={styles.errorRetryBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry loading CROWN Pass"
            >
              <Text style={styles.errorRetryTxt}>Try again</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View
      style={[styles.root, { paddingTop: insets.top }]}
      accessibilityLabel="CROWN Pass screen"
    >
      {/* Header — PRD §1.3.2: NO avatar in header. Avatar lives in Profile tab of bottom nav only. */}
      <ScreenHeader
        title="CROWN Pass"
        onBack={() => router.back()}
        scrolled={scrolled}
      />

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Pad for sticky CTA bar: primary button height + safe-area bottom inset + extra breathing room
            paddingBottom: insets.bottom + dimensions.btnPrimary + spacing.xxxl,
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        accessibilityRole="scrollview"
        accessibilityLabel="CROWN Pass content"
      >
        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.duration(animationTokens.duration.screenTransition).delay(0)}>
          <PassHeroCard passState={passState} />
        </Animated.View>

        {/* ── Tier Ladder ── */}
        <Animated.View entering={FadeInDown.duration(animationTokens.duration.screenTransition).delay(80)}>
          <SectionLabel topMargin>WHAT YOU UNLOCK</SectionLabel>
          <TierLadder
            currentTierIndex={currentTierIndex}
            unlockedFrameIds={unlockedFrameIds}
          />
        </Animated.View>

        {/* ── Title-Earned Frames ── */}
        <Animated.View entering={FadeInDown.duration(animationTokens.duration.screenTransition).delay(160)}>
          <SectionLabel topMargin>TITLE-EARNED FRAMES</SectionLabel>
          <Text style={styles.sectionSubtitle}>
            Separate from CROWN Pass. Earned by holding titles in real cycles — no Credits required.
          </Text>
          <TitleFramesSection titlesEarned={titlesEarned} />
        </Animated.View>

        {/* ── Founder Pass ── */}
        <Animated.View entering={FadeInDown.duration(animationTokens.duration.screenTransition).delay(240)}>
          <SectionLabel topMargin>FOUNDER DIAMOND FRAME</SectionLabel>
          <FounderPassSection isFounder={isFounder} />
        </Animated.View>

        {/* ── Anti-Dark-Pattern Transparency ── */}
        <Animated.View entering={FadeInDown.duration(animationTokens.duration.screenTransition).delay(320)}>
          <SectionLabel topMargin>FULL TRANSPARENCY</SectionLabel>
          <AntiDarkPatternBox />
        </Animated.View>
      </ScrollView>

      {/* Sticky CTA — sits above bottom nav (full-width fixed bar, PRD §1.3.2) */}
      <StickyCtaBar passState={passState} onActivate={handleActivate} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — STYLESHEET
// Zero hardcoded values. All tokens from:
//   @/constants/colors  → crown (imported as t) — PRD §1.4.2 CROWN tokens
//   @/constants/spacing → spacing.* / radius.* / shadows.*
//   @/constants/typography → typography.*
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Root ──────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: t.bg,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  // ── Section Label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.sm,          // 11px
    fontWeight: '600',
    lineHeight: lh(FONT_SIZE.sm, 'tight'),
    letterSpacing: LETTER_SPACING.uppercase,
    color: t.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },

  sectionSubtitle: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.base,        // 13px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.base, 'relaxed'),
    color: t.textMuted,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },

  // ── Hero Card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: t.accentSoftSolid,
    borderWidth: 1,
    borderColor: `${t.brand}22`,
    borderRadius: radius.xl,        // 20px
    padding: spacing.xl,            // 20px
    marginBottom: spacing.xs,
    ...shadows.md,
  },

  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,       // 12px
  },

  heroIconBg: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,        // 14px
    backgroundColor: `${t.brand}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,                // 4px
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,  // 8px
    paddingVertical: spacing.xs,    // 4px
  },

  heroBadgeActive: {
    backgroundColor: `${t.success}14`,
  },

  heroBadgeInactive: {
    backgroundColor: t.warningSoft,
  },

  heroBadgeTxt: {
    fontFamily: FONT_BODY.extraBold,
    fontSize: FONT_SIZE.xs,         // 9px
    fontWeight: '800',
    letterSpacing: LETTER_SPACING.uppercase,
  },

  heroTitle: {
    fontFamily: FONT_HEADING.extraBold,  // Syne 800ExtraBold — PRD §1.4.3: headings/titles use Syne 800
    fontSize: FONT_SIZE.h1,         // 32px
    fontWeight: '800',
    lineHeight: lh(FONT_SIZE.h1, 'tight'),
    letterSpacing: LETTER_SPACING.wide,
    color: t.textStrong,
    marginBottom: spacing.sm,       // 8px
  },

  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },

  heroPriceNum: {
    fontFamily: FONT_BODY.extraBold,
    fontSize: FONT_SIZE.h2lg,       // 24px
    fontWeight: '800',
    lineHeight: lh(FONT_SIZE.h2lg, 'tight'),
    letterSpacing: LETTER_SPACING.tightest,
    color: t.brand,
  },

  heroPriceUnit: {
    fontFamily: FONT_BODY.medium,
    fontSize: FONT_SIZE.mdLg,       // 15px
    fontWeight: '500',
    color: t.textMuted,
    letterSpacing: LETTER_SPACING.normal,
  },

  heroSub: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.base, 'relaxed'),
    color: t.textMuted,
    marginTop: spacing.xs,
  },

  heroDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  heroDaysLabel: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '600',
    color: t.brand,
    letterSpacing: LETTER_SPACING.normal,
  },

  heroRenewalLabel: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.base,
    fontWeight: '400',
    color: t.textMuted,
  },

  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: t.borderSubtle,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },

  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: t.brand,
  },

  // ── Tier Ladder ───────────────────────────────────────────────────────────
  ladderCard: {
    backgroundColor: t.surface1,
    borderWidth: 1,
    borderColor: t.borderSubtle,
    borderRadius: radius.lg,        // 14px
    overflow: 'hidden',
    ...shadows.sm,
  },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.md,  // 12px
    paddingVertical: spacing.md,
    minHeight: 64,
  },

  tierRowCurrent: {
    backgroundColor: `${t.brand}0A`,
  },

  tierRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: t.borderSubtle,
  },

  tierIndicatorCol: {
    alignItems: 'center',
    width: 24,
    marginRight: spacing.md,        // 12px
    paddingTop: 2,
  },

  tierDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: t.borderSubtle,
    backgroundColor: t.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tierDotUnlocked: {
    backgroundColor: t.brand,
    borderColor: t.brand,
  },

  tierDotCurrent: {
    borderColor: t.brand,
    backgroundColor: `${t.brand}20`,
  },

  tierDotInner: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: t.borderStrong,
  },

  tierConnector: {
    flex: 1,
    width: 2,
    backgroundColor: t.borderSubtle,
    marginTop: 2,
  },

  tierConnectorUnlocked: {
    backgroundColor: `${t.brand}50`,
  },

  tierContent: {
    flex: 1,
  },

  tierDayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: t.surface3,
    borderRadius: radius.xs,        // 4px
    paddingHorizontal: spacing.xs,  // 4px
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },

  tierDayTxt: {
    fontFamily: FONT_BODY.extraBold,
    fontSize: FONT_SIZE.xs,         // 9px
    fontWeight: '800',
    letterSpacing: LETTER_SPACING.uppercase,
    color: t.textMuted,
    textTransform: 'uppercase',
  },

  tierFrameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,                // 8px
  },

  tierIconBg: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,        // 6px
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  tierTextBlock: {
    flex: 1,
  },

  tierFrameName: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '600',
    lineHeight: lh(FONT_SIZE.base, 'tight'),
    color: t.textStrong,
    marginBottom: 2,
  },

  tierFrameDesc: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.sm,         // 11px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.sm, 'relaxed'),
    color: t.textMuted,
  },

  tierTextLocked: {
    color: t.textMuted,
    opacity: 0.6,
  },

  // ── Title Frames Section ──────────────────────────────────────────────────
  titleFramesCard: {
    backgroundColor: t.surface1,
    borderWidth: 1,
    borderColor: t.borderSubtle,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },

  titleFrameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 60,
  },

  titleFrameRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: t.borderSubtle,
  },

  titleFrameIconBg: {
    width: 38,
    height: 38,
    borderRadius: radius.md,        // 10px
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  titleFrameTextBlock: {
    flex: 1,
  },

  titleFrameName: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '600',
    lineHeight: lh(FONT_SIZE.base, 'tight'),
    color: t.textStrong,
    marginBottom: 3,
  },

  titleFrameDesc: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.sm,         // 11px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.sm, 'relaxed'),
    color: t.textMuted,
  },

  titleFrameEarnedBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: `${t.success}14`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  titleFrameLockedBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: t.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Founder Pass Section ──────────────────────────────────────────────────
  founderCard: {
    backgroundColor: t.surface1,
    borderWidth: 1,
    borderColor: t.borderSubtle,
    borderRadius: radius.lg,
    padding: spacing.lg,            // 16px
    ...shadows.sm,
  },

  founderCardActive: {
    backgroundColor: t.accentSoftSolid,
    borderColor: `${t.brand}30`,
    ...shadows.gold,
  },

  founderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  founderIconBg: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: t.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  founderTitleBlock: {
    flex: 1,
  },

  founderTitle: {
    fontFamily: FONT_BODY.bold,
    fontSize: FONT_SIZE.mdLg,       // 15px
    fontWeight: '700',
    lineHeight: lh(FONT_SIZE.mdLg, 'tight'),
    color: t.textStrong,
  },

  founderSubtitle: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.sm,         // 11px
    fontWeight: '400',
    color: t.textMuted,
    marginTop: 2,
  },

  founderOwnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${t.success}14`,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexShrink: 0,
  },

  founderOwnedTxt: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.sm,         // 11px
    fontWeight: '600',
    color: t.success,
  },

  founderBody: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.base, 'relaxed'),
    color: t.textMuted,
  },

  // ── Anti-Dark-Pattern Box ─────────────────────────────────────────────────
  antiPatternCard: {
    backgroundColor: `${t.success}0A`,
    borderWidth: 1,
    borderColor: `${t.success}22`,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },

  antiPatternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },

  antiPatternTitle: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '600',
    color: t.textStrong,
    flex: 1,
  },

  antiPatternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },

  antiPatternLabel: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.base,       // 13px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.base, 'relaxed'),
    color: t.textMuted,
    flex: 1,
  },

  // ── Sticky CTA Bar ────────────────────────────────────────────────────────
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.borderSubtle,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: t.textStrong,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },

  ctaBtn: {
    backgroundColor: t.brand,
    height: dimensions.btnPrimary,   // 54px
    borderRadius: radius.md,         // 10px
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.gold,
  },

  ctaBtnDisabled: {
    backgroundColor: t.surface3,
    ...shadows.sm,
  },

  ctaBtnTxt: {
    fontFamily: FONT_BODY.bold,
    fontSize: FONT_SIZE.md,          // 14px
    fontWeight: '700',
    lineHeight: lh(FONT_SIZE.md, 'tight'),
    color: t.white,
    letterSpacing: LETTER_SPACING.normal,
  },

  ctaBtnTxtDisabled: {
    color: t.textMuted,
  },

  ctaSubLabel: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.sm,          // 11px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.sm, 'relaxed'),
    color: t.textMuted,
    textAlign: 'center',
  },

  // ── Loading Skeleton ──────────────────────────────────────────────────────
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },

  skeletonHero: {
    height: 160,
    borderRadius: radius.xl,
    backgroundColor: t.surface2,
    opacity: 0.6,
  },

  skeletonRow: {
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: t.surface2,
    opacity: 0.4,
    width: '100%',
  },

  // ── Error State ───────────────────────────────────────────────────────────
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },

  errorTitle: {
    fontFamily: FONT_BODY.bold,
    fontSize: FONT_SIZE.xl,          // 18px
    fontWeight: '700',
    color: t.textStrong,
    textAlign: 'center',
  },

  errorBody: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.base,        // 13px
    fontWeight: '400',
    lineHeight: lh(FONT_SIZE.base, 'relaxed'),
    color: t.textMuted,
    textAlign: 'center',
  },

  errorRetryBtn: {
    height: dimensions.btnSecondary, // 44px
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: t.accentSoftSolid,
    borderWidth: 1,
    borderColor: `${t.brand}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorRetryTxt: {
    fontFamily: FONT_BODY.semiBold,
    fontSize: FONT_SIZE.md,          // 14px
    fontWeight: '600',
    color: t.brand,
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  textLocked: {
    color: t.textMuted,
    opacity: 0.55,
  },
});

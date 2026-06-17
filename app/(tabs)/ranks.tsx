/**
 * CROWN — Crown Tab Screen (app/(tabs)/ranks.tsx)
 *
 * The status & bidding center. Opens to the user's current standing in big type,
 * then the four tier rank cards, the live cycle phase panel, the battle schedule,
 * a conditional city-invasion card, the bid-history feed, and the crown-journey
 * timeline. A non-dismissible Decision Prompt overlay (LAW 3) takes over during
 * Phase 5 if the user is the Merit Winner. Sleep-Safe Auto-Accept settings open
 * from the header.
 *
 * Implements CROWN-TAB PRD §4.1 (wireframe order) and §18 (laws). Visual language
 * is lifted from the home screen: WHITE page, CREAM cards, DARK-GOLD + AMBER
 * accents. No black, no dark panels. Every colour comes from tokens.
 *
 * Data layer: @react-native-firebase namespaced listeners (crown-rank/api/*),
 * scoped strictly to the authenticated user.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { firestore, serverTimestamp } from '@/lib/firebase';

import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  Z_INDEX,
  TOUCH_TARGET,
  SCREEN_HEADER_HEIGHT,
  BOTTOM_NAV_HEIGHT,
  MOTION,
} from '@/crown-rank/tokens';
import type {
  Tier,
  RankCardData,
  CyclePhaseInfo,
  TitleHolderState,
  UserTitle,
  FreezeTime,
  TimelineNode,
  BidRecord,
  InvasionData,
  DecisionPromptData,
  SleepSafeSettings,
} from '@/crown-rank/types';
import {
  TIER_TO_TITLE,
  getTitleString,
  formatScore,
  PHASE_META,
} from '@/crown-rank/constants/titles';
import {
  getProgressPercent,
  getMilestoneLabel,
  computeAcceptAmount,
} from '@/crown-rank/core/rank';

import {
  subscribeToUserCrownData,
  subscribeToRankScore,
  pollRankPosition,
  fetchBattleSchedule,
  fetchCrownJourney,
  clearRankCaches,
  type UserCrownData,
  type RankTier,
  type JourneyEntry,
} from '@/crown-rank/api/rank';
import {
  subscribeToAllActiveCycles,
  PHASE_DURATIONS_MS,
  type ActiveCycle,
} from '@/crown-rank/api/cycles';
import { subscribeToUserBids, placeBid, withdrawBid } from '@/crown-rank/api/bids';
import { subscribeToActiveInvasion, joinInvasion } from '@/crown-rank/api/invasions';

import CrownHeroCard from '@/crown-rank/components/CrownHeroCard';
import RankCard from '@/crown-rank/components/RankCard';
import CyclePhasePanel from '@/crown-rank/components/CyclePhasePanel';
import BattleScheduleStrip from '@/crown-rank/components/BattleScheduleStrip';
import InvasionCard from '@/crown-rank/components/InvasionCard';
import BidRow from '@/crown-rank/components/BidRow';
import CrownJourneyTimeline from '@/crown-rank/components/CrownJourneyTimeline';
import DecisionPromptOverlay from '@/crown-rank/components/DecisionPromptOverlay';
import SleepSafeSheet from '@/crown-rank/components/SleepSafeSheet';
import RankDetailSheet from '@/crown-rank/components/RankDetailSheet';
import BidSheet from '@/crown-rank/components/BidSheet';

import { useDecision } from '@/crown-rank/hooks/useDecision';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Display order: local → global. */
const TIER_ORDER: Tier[] = ['baron', 'viceroy', 'sovereign', 'imperator'];

const TIER_TO_SCOPE: Record<Tier, 'sector' | 'city' | 'country' | 'world'> = {
  baron: 'sector',
  viceroy: 'city',
  sovereign: 'country',
  imperator: 'world',
};

const TIER_PRIORITY: Record<Tier, number> = {
  imperator: 0,
  sovereign: 1,
  viceroy: 2,
  baron: 3,
};

const MIN_REFRESH_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface Geo {
  id: string;
  label: string;
}

function capitalize(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Resolve a geography per tier from the crown doc, with profile/default fallbacks. */
function resolveGeographies(
  crown: UserCrownData | null,
  regionCity: string | null,
): Record<Tier, Geo> {
  const ct = crown?.currentTitles;
  return {
    baron: {
      id: ct?.sector?.geographyId || '_sector_',
      label: ct?.sector?.geographyName || 'Your Sector',
    },
    viceroy: {
      id: ct?.city?.geographyId || regionCity || '_city_',
      label: ct?.city?.geographyName || capitalize(regionCity) || 'Your City',
    },
    sovereign: {
      id: ct?.country?.geographyId || '_country_',
      label: ct?.country?.geographyName || 'India',
    },
    imperator: {
      id: ct?.world?.geographyId || '_world_',
      label: ct?.world?.geographyName || 'World',
    },
  };
}

function defaultPhaseInfo(): CyclePhaseInfo {
  const now = Date.now();
  const next = now + PHASE_DURATIONS_MS[1];
  return {
    phase: 1,
    phaseName: PHASE_META[1].name,
    phaseEmoji: PHASE_META[1].emoji,
    phaseStartedAt: new Date(now).toISOString(),
    nextPhaseAt: new Date(next).toISOString(),
    freezeAt: new Date(next).toISOString(),
    auctionEndsAt: null,
    decisionEndsAt: null,
    meritWinnerId: null,
    highestBid: null,
    baseBidPrice: null,
  };
}

/** Convert an api ActiveCycle to the typed CyclePhaseInfo the UI consumes. */
function toPhaseInfo(cycle: ActiveCycle | null | undefined): CyclePhaseInfo {
  if (!cycle) return defaultPhaseInfo();
  const phase = cycle.phase;
  const nextPhaseAtMs = cycle.phaseStartedAtMs + PHASE_DURATIONS_MS[phase];
  return {
    phase,
    phaseName: PHASE_META[phase].name,
    phaseEmoji: PHASE_META[phase].emoji,
    phaseStartedAt: new Date(cycle.phaseStartedAtMs).toISOString(),
    nextPhaseAt: new Date(nextPhaseAtMs).toISOString(),
    freezeAt: new Date(cycle.freezeAtMs).toISOString(),
    auctionEndsAt:
      cycle.auctionEndsAtMs != null
        ? new Date(cycle.auctionEndsAtMs).toISOString()
        : null,
    decisionEndsAt:
      cycle.decisionEndsAtMs != null
        ? new Date(cycle.decisionEndsAtMs).toISOString()
        : null,
    meritWinnerId: cycle.meritWinnerId,
    highestBid: cycle.highestBid
      ? { amount: cycle.highestBid.amount, bidderId: cycle.highestBid.bidderId }
      : null,
    baseBidPrice: cycle.baseBidPrice,
  };
}

/** Next round-number milestone target for the progress bar. */
function nextMilestoneTarget(score: number): number {
  if (score < 100) return 100;
  if (score < 500) return 500;
  if (score < 1000) return 1000;
  if (score < 5000) return 5000;
  return Math.ceil((score + 1) / 5000) * 5000;
}

/** Top-N milestone label from a rank position, or null. */
function milestoneFromPosition(position: number | null): string | null {
  if (position == null || position < 1) return null;
  if (position <= 10) return 'Top 10';
  if (position <= 50) return 'Top 50';
  if (position <= 100) return 'Top 100';
  return null;
}

function buildTitleState(crown: UserCrownData | null): TitleHolderState {
  if (!crown) return { has: false };
  const titles: UserTitle[] = [];
  (Object.keys(TIER_TO_SCOPE) as Tier[]).forEach((tier) => {
    const scope = TIER_TO_SCOPE[tier];
    const t = crown.currentTitles[scope];
    if (t && t.active) {
      titles.push({
        tier,
        geographyId: t.geographyId,
        geographyLabel: t.geographyName,
        cyclesHeld: t.cyclesHeld,
        cycleReward: t.cycleReward,
        pinViews: null,
        heldSince:
          t.heldSinceTs != null
            ? new Date(t.heldSinceTs).toISOString()
            : new Date().toISOString(),
      });
    }
  });
  if (titles.length === 0) return { has: false };
  const primaryTitle = titles.reduce((best, cur) =>
    TIER_PRIORITY[cur.tier] < TIER_PRIORITY[best.tier] ? cur : best,
  );
  return { has: true, titles, primaryTitle };
}

function dayLabel(targetMs: number): string {
  const now = new Date();
  const target = new Date(targetMs);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
  if (diffDays <= 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  if (diffDays < 7) {
    return target.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  }
  return '+' + diffDays + ' DAYS';
}

function localTimeLabel(targetMs: number): string {
  try {
    return new Date(targetMs).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function journeyToNodes(entries: JourneyEntry[]): TimelineNode[] {
  return entries.map((e) => {
    const label =
      e.type === 'title'
        ? e.tier
          ? TIER_TO_TITLE[e.tier as Tier]
          : 'Title'
        : e.type === 'first_title'
        ? 'First Title'
        : e.badgeType ?? 'Badge';
    return {
      nodeId: e.entryId,
      type: e.type,
      tier: (e.tier as Tier) ?? null,
      label,
      geographyLabel: e.geographyName || null,
      earnedAt: new Date(e.earnedAtMs).toISOString(),
      detail: {
        rankScore: e.rankScore,
        bidReceived: e.bidReceived,
        userDecision:
          e.keptTitle === true ? 'kept' : e.keptTitle === false ? 'accepted' : null,
        cycleDurationHeld: null,
        cycleNumber: 0,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON (loading shimmer) — PRD §19.1
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{ height: number; radius?: number }> = ({
  height,
  radius = RADIUS.card,
}) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: MOTION.shimmer / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: MOTION.shimmer / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        height,
        width: '100%',
        borderRadius: radius,
        backgroundColor: COLORS_DARK.shimmerPeak,
        opacity,
      }}
    />
  );
};

const ScreenSkeleton: React.FC = () => (
  <View style={styles.skeletonWrap}>
    <SkeletonBlock height={148} radius={RADIUS.dais} />
    {TIER_ORDER.map((t) => (
      <SkeletonBlock key={t} height={108} />
    ))}
    <SkeletonBlock height={120} />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; caption?: string }> = ({
  title,
  caption,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function CrownScreen() {
  const insets = useSafeAreaInsets();
  const { firebaseUser, user } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const regionCity = user?.region ?? null;
  const myHandle = user?.username ?? user?.displayName ?? 'you';

  // ── Remote state ────────────────────────────────────────────────────────────
  const [crown, setCrown] = useState<UserCrownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Partial<Record<Tier, ActiveCycle | null>>>({});
  const [scores, setScores] = useState<Partial<Record<Tier, number>>>({});
  const [positions, setPositions] = useState<
    Partial<Record<Tier, { position: number; delta: number }>>
  >({});
  const [freezeTimes, setFreezeTimes] = useState<FreezeTime[]>([]);
  const [journey, setJourney] = useState<TimelineNode[]>([]);
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [invasion, setInvasion] = useState<InvasionData | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [, setRefreshKey] = useState(0);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [detailTier, setDetailTier] = useState<Tier | null>(null);
  const [bidSheetTier, setBidSheetTier] = useState<Tier | null>(null);
  const [placingBid, setPlacingBid] = useState(false);

  const geographies = useMemo(
    () => resolveGeographies(crown, regionCity),
    [crown, regionCity],
  );

  const geoKey = useMemo(
    () => TIER_ORDER.map((t) => geographies[t].id).join('|'),
    [geographies],
  );

  // ── Subscribe: user crown document ────────────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToUserCrownData(
      uid,
      (data) => {
        setCrown(data);
        setLoading(false);
      },
      () => {
        setCrown(null);
        setLoading(false);
      },
    );
    return () => {
      unsub();
      clearRankCaches();
    };
  }, [uid]);

  // ── Subscribe: all active cycles (per tier) ───────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const tierGeo: Partial<Record<RankTier, string>> = {};
    TIER_ORDER.forEach((t) => {
      tierGeo[t] = geographies[t].id;
    });
    const stop = subscribeToAllActiveCycles(
      tierGeo,
      (tier, cycle) => setCycles((prev) => ({ ...prev, [tier]: cycle })),
      (tier) => setCycles((prev) => ({ ...prev, [tier]: null })),
    );
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, geoKey]);

  // ── Subscribe: rank scores + poll positions (per tier, when cycle known) ──────
  useEffect(() => {
    if (!uid) return;
    const unsubs: Array<() => void> = [];

    TIER_ORDER.forEach((tier) => {
      const geo = geographies[tier];
      const cycle = cycles[tier];
      const cycleId = cycle?.cycleId;
      if (!geo.id || !cycleId) return;

      unsubs.push(
        subscribeToRankScore(
          uid,
          tier,
          geo.id,
          cycleId,
          (data) =>
            setScores((prev) => ({ ...prev, [tier]: data.breakdown.totalScore })),
          () => {},
        ),
      );

      unsubs.push(
        pollRankPosition(
          uid,
          tier,
          geo.id,
          cycleId,
          (pos) =>
            setPositions((prev) => ({
              ...prev,
              [tier]: { position: pos.position, delta: pos.delta },
            })),
          () => {},
        ),
      );
    });

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, geoKey, cycles]);

  // ── Subscribe: user bid history ───────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToUserBids(
      uid,
      (list) => setBids(list),
      () => setBids([]),
    );
    return unsub;
  }, [uid]);

  // ── Subscribe: active city invasion ───────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const cityId = geographies.viceroy.id;
    if (!cityId || cityId === '_city_') {
      setInvasion(null);
      return;
    }
    const unsub = subscribeToActiveInvasion(
      cityId,
      uid,
      (inv) => setInvasion(inv),
      () => setInvasion(null),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, geographies.viceroy.id]);

  // ── Fetch: battle schedule + crown journey (on load + refresh) ────────────────
  const loadAsyncData = useCallback(async () => {
    if (!uid) return;
    const tierGeo: Partial<Record<RankTier, string>> = {};
    TIER_ORDER.forEach((t) => {
      tierGeo[t] = geographies[t].id;
    });

    const [items, entries] = await Promise.all([
      fetchBattleSchedule(tierGeo),
      fetchCrownJourney(uid),
    ]);

    const mapped: FreezeTime[] = items.map((it) => ({
      tier: it.tier,
      geographyId: it.geographyId,
      geographyLabel: it.geographyName,
      cycleId: it.cycleId,
      freezeAt: new Date(it.freezeAtMs).toISOString(),
      freezeIn: Math.max(0, Math.round((it.freezeAtMs - Date.now()) / 1000)),
      dateLabel: dayLabel(it.freezeAtMs),
      localTime: localTimeLabel(it.freezeAtMs),
      isSleepWindow: it.isSleepWindow,
    }));

    setFreezeTimes(mapped);
    setJourney(journeyToNodes(entries));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, geoKey]);

  useEffect(() => {
    loadAsyncData();
  }, [loadAsyncData]);

  // ── Derived: rank card data per tier ──────────────────────────────────────────
  const rankCards = useMemo<RankCardData[]>(() => {
    return TIER_ORDER.map((tier) => {
      const geo = geographies[tier];
      const phaseInfo = toPhaseInfo(cycles[tier]);
      const score = scores[tier] ?? 0;
      const posData = positions[tier];
      const rawPosition =
        posData && posData.position > 0 ? posData.position : null;
      const rankPosition = phaseInfo.phase === 1 ? null : rawPosition;
      const delta = posData?.delta ?? 0;
      const movement: 'up' | 'down' | 'same' =
        delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';

      const target = nextMilestoneTarget(score);
      const scoreNeeded = Math.max(0, target - score);
      const milestoneHeld = milestoneFromPosition(rankPosition);
      const milestoneLabel = getMilestoneLabel(
        rankPosition,
        score,
        scoreNeeded,
        milestoneHeld,
        null,
      );

      return {
        tier,
        geographyId: geo.id,
        geographyLabel: geo.label,
        rankPosition,
        rankScore: score,
        progressPercent: getProgressPercent(score, target),
        milestoneLabel,
        milestoneHeld,
        milestoneHeldSince: null,
        movement,
        movementDelta: Math.abs(delta),
        cyclePhase: phaseInfo,
      };
    });
  }, [geographies, cycles, scores, positions]);

  const titleState = useMemo(() => buildTitleState(crown), [crown]);

  // ── Derived: primary cycle for the phase panel (highest-tier the user touches)
  const primaryTier = useMemo<Tier>(() => {
    if (titleState.has) return titleState.primaryTitle.tier;
    return 'viceroy';
  }, [titleState]);

  const primaryCard = useMemo(
    () => rankCards.find((c) => c.tier === primaryTier) ?? rankCards[1],
    [rankCards, primaryTier],
  );

  // ── Derived: Decision Prompt data (Phase 5 + user is Merit Winner) ────────────
  const decisionData = useMemo<DecisionPromptData | null>(() => {
    if (!uid) return null;
    for (const tier of TIER_ORDER) {
      const cycle = cycles[tier];
      if (
        cycle &&
        cycle.phase === 5 &&
        cycle.meritWinnerId === uid &&
        cycle.decisionEndsAtMs != null
      ) {
        const geo = geographies[tier];
        const hb = cycle.highestBid;
        const scope = TIER_TO_SCOPE[tier];
        const keepReward = crown?.currentTitles[scope]?.cycleReward ?? 0;
        return {
          tier,
          geographyId: geo.id,
          geographyLabel: geo.label,
          titleString: getTitleString(tier, geo.label),
          highestBid: hb
            ? {
                amount: hb.amount,
                bidderId: hb.bidderId,
                bidderHandle: hb.bidderHandle,
                bidderTrustScore: hb.bidderTrustScore,
              }
            : null,
          acceptAmount: hb ? computeAcceptAmount(hb.amount) : 0,
          keepCycleReward: keepReward,
          decisionEndsIn: Math.max(
            0,
            Math.round((cycle.decisionEndsAtMs - Date.now()) / 1000),
          ),
        };
      }
    }
    return null;
  }, [uid, cycles, geographies, crown]);

  // ── Decision execution callbacks ──────────────────────────────────────────────
  const executeAccept = useCallback(
    async (geographyId: string, tier: string) => {
      const amount = decisionData?.highestBid?.amount ?? 0;
      if (uid) {
        await firestore()
          .collection('users')
          .doc(uid)
          .collection('crown_decisions')
          .doc(tier + '_' + geographyId)
          .set(
            {
              choice: 'accept',
              tier,
              geography_id: geographyId,
              decided_at: serverTimestamp(),
            },
            { merge: true },
          );
      }
      return { creditsReceived: computeAcceptAmount(amount) };
    },
    [uid, decisionData],
  );

  const executeKeep = useCallback(
    async (geographyId: string, tier: string) => {
      if (!uid) return;
      await firestore()
        .collection('users')
        .doc(uid)
        .collection('crown_decisions')
        .doc(tier + '_' + geographyId)
        .set(
          {
            choice: 'keep',
            tier,
            geography_id: geographyId,
            decided_at: serverTimestamp(),
          },
          { merge: true },
        );
    },
    [uid],
  );

  const decision = useDecision(decisionData, executeAccept, executeKeep);

  // ── Sleep-Safe settings ───────────────────────────────────────────────────────
  const sleepSettings = useMemo<SleepSafeSettings>(() => {
    const ss = crown?.sleepSafe;
    return {
      baronThreshold: ss?.baronThreshold ?? null,
      viceroyThreshold: ss?.viceroyThreshold ?? null,
      sovereignThreshold: ss?.sovereignThreshold ?? null,
      imperatorThreshold: ss?.imperatorThreshold ?? null,
      wakeForAny: ss?.wakeForAny ?? false,
      minWakeAmount: ss?.minWakeAmount ?? 0,
    };
  }, [crown]);

  const handleSaveSleepSafe = useCallback(
    async (settings: SleepSafeSettings) => {
      if (!uid) return;
      await firestore()
        .collection('users')
        .doc(uid)
        .set(
          {
            sleep_safe: {
              baron_threshold: settings.baronThreshold,
              viceroy_threshold: settings.viceroyThreshold,
              sovereign_threshold: settings.sovereignThreshold,
              imperator_threshold: settings.imperatorThreshold,
              wake_for_any: settings.wakeForAny,
              min_wake_amount: settings.minWakeAmount,
            },
          },
          { merge: true },
        );
      setSleepSheetOpen(false);
    },
    [uid],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const started = Date.now();
    clearRankCaches();
    try {
      await loadAsyncData();
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed < MIN_REFRESH_MS) {
        await new Promise<void>((r) => setTimeout(r, MIN_REFRESH_MS - elapsed));
      }
      setRefreshKey((k) => k + 1);
      setRefreshing(false);
    }
  }, [loadAsyncData]);

  const handlePlaceBid = useCallback(
    async (amount: number) => {
      if (!uid || !bidSheetTier) return;
      const geo = geographies[bidSheetTier];
      const cycle = cycles[bidSheetTier];
      if (!cycle) return;
      setPlacingBid(true);
      try {
        await placeBid({
          userId: uid,
          userHandle: myHandle,
          userTrustScore: crown?.trustScore ?? 0,
          tier: bidSheetTier,
          geographyId: geo.id,
          geographyLabel: geo.label,
          cycleId: cycle.cycleId,
          amount,
        });
        setBidSheetTier(null);
      } catch {
        // Surface handled by sheet remaining open; no crash.
      } finally {
        setPlacingBid(false);
      }
    },
    [uid, bidSheetTier, geographies, cycles, myHandle, crown],
  );

  const handleWithdrawBid = useCallback(async (bid: BidRecord) => {
    try {
      await withdrawBid({
        tier: bid.tier,
        geographyId: bid.geographyId,
        bidId: bid.bidId,
      });
    } catch {
      // no-op on failure
    }
  }, []);

  const handleJoinInvasion = useCallback(async () => {
    if (!uid || !invasion) return;
    try {
      await joinInvasion(invasion.invasionId, uid, myHandle, 'going');
    } catch {
      // no-op
    }
  }, [uid, invasion, myHandle]);

  const detailCard = useMemo(
    () => (detailTier ? rankCards.find((c) => c.tier === detailTier) ?? null : null),
    [detailTier, rankCards],
  );

  const bidSheetCycle = bidSheetTier ? cycles[bidSheetTier] : null;

  // ── No-auth fallback ──────────────────────────────────────────────────────────
  if (!uid) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS_DARK.bgSurface} />
        <Text style={styles.emptyTitle}>Your Crown</Text>
        <Text style={styles.emptyBody}>
          Sign in to see your rank, titles and the live battle cycle.
        </Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS_DARK.bgSurface} />

      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Text style={styles.wordmark}>👑 CROWN</Text>
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={() => setSleepSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Auto-Accept settings"
            hitSlop={8}
          >
            <Text style={styles.gearIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !crown ? (
        <ScreenSkeleton />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + BOTTOM_NAV_HEIGHT + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS_DARK.fgBrand}
              colors={[COLORS_DARK.fgBrand]}
            />
          }
        >
          {/* [1] Crown Hero */}
          <CrownHeroCard
            titleState={titleState}
            onSeeAllTitles={() => {}}
          />

          {/* [2] Four tier rank cards */}
          <View style={styles.section}>
            <SectionHeader title="Your standings" caption="Tap a tier for the full breakdown" />
            <View style={styles.cardStack}>
              {rankCards.map((card) => (
                <RankCard
                  key={card.tier}
                  data={card}
                  onPress={() => setDetailTier(card.tier)}
                />
              ))}
            </View>
          </View>

          {/* [3] Active cycle phase panel */}
          {primaryCard ? (
            <View style={styles.section}>
              <CyclePhasePanel
                cyclePhase={primaryCard.cyclePhase}
                geographyLabel={primaryCard.geographyLabel}
                tierLabel={TIER_TO_TITLE[primaryCard.tier]}
                rankScore={primaryCard.rankScore}
                onPlaceBid={() => setBidSheetTier(primaryCard.tier)}
              />
            </View>
          ) : null}

          {/* [4] Battle schedule strip */}
          {freezeTimes.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Battle schedule" caption="Next freeze times" />
              <BattleScheduleStrip
                freezeTimes={freezeTimes}
                onSleepWarningTap={() => setSleepSheetOpen(true)}
              />
            </View>
          ) : null}

          {/* [5] Conditional invasion card */}
          {invasion ? (
            <View style={styles.section}>
              <SectionHeader title="City under siege" />
              <InvasionCard invasion={invasion} onJoinInvasion={handleJoinInvasion} />
            </View>
          ) : null}

          {/* [6] Bid history feed */}
          <View style={styles.section}>
            <SectionHeader title="Your bids" />
            {bids.length > 0 ? (
              <View style={styles.cardStack}>
                {bids.map((bid) => (
                  <BidRow
                    key={bid.bidId}
                    bid={bid}
                    onRaiseBid={(b) => setBidSheetTier(b.tier)}
                    onWithdrawBid={handleWithdrawBid}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>
                  No bids yet. When an auction opens, your bids appear here.
                </Text>
              </View>
            )}
          </View>

          {/* [7] Crown journey timeline */}
          {journey.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Crown journey" caption="Every title and badge you've earned" />
              <CrownJourneyTimeline nodes={journey} />
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ── Sheets ── */}
      <SleepSafeSheet
        visible={sleepSheetOpen}
        initialSettings={sleepSettings}
        onSave={handleSaveSleepSafe}
        onClose={() => setSleepSheetOpen(false)}
      />

      <RankDetailSheet
        visible={detailTier !== null}
        data={detailCard}
        breakdown={null}
        onClose={() => setDetailTier(null)}
      />

      {bidSheetTier ? (
        <BidSheet
          visible={bidSheetTier !== null}
          tier={bidSheetTier}
          geographyLabel={geographies[bidSheetTier].label}
          basePrice={bidSheetCycle?.baseBidPrice ?? 0}
          currentHighBid={bidSheetCycle?.highestBid?.amount ?? null}
          userCredits={crown?.credits ?? 0}
          submitting={placingBid}
          onPlaceBid={handlePlaceBid}
          onClose={() => setBidSheetTier(null)}
        />
      ) : null}

      {/* ── Decision Prompt overlay (LAW 3 — non-dismissible, Phase 5) ── */}
      <DecisionPromptOverlay decision={decision} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS_DARK.bgSurface,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },

  // Header
  header: {
    backgroundColor: COLORS_DARK.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS_DARK.borderSubtle,
    zIndex: Z_INDEX.stickyHeader,
  },
  headerRow: {
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
  },
  wordmark: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextStrong,
    letterSpacing: 1,
  },
  gearBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 20,
    color: COLORS_DARK.fgTextMuted,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.base,
    gap: SPACING.xl,
  },

  // Sections
  section: {
    gap: SPACING.md,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.heroSub,
    color: COLORS_DARK.fgTextStrong,
    letterSpacing: 0.2,
  },
  sectionCaption: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  cardStack: {
    gap: SPACING.md,
  },

  // Empty states
  emptyCard: {
    backgroundColor: COLORS_DARK.bgCard,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
    padding: SPACING.lg,
  },
  emptyCardText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyTitle: {
    fontFamily: FONTS.displayAlt,
    fontSize: FONT_SIZES.hero,
    color: COLORS_DARK.fgTextStrong,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Skeleton
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.base,
    gap: SPACING.md,
  },
});

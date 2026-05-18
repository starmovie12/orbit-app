/**
 * CROWN — Crown Tab  (app/(tabs)/live.tsx)
 *
 * Status & bidding center — the emotional anchor of CROWN.
 * PRD §1.3.5 · Blueprint FINAL v1.0 · Part 1
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * LAYOUT STACK (top → bottom):
 *   [1]  Header Row — "CROWN" wordmark + share icon           (56px)
 *   [2]  ScrollView
 *        ├── CycleCountdown — 5-hour live timer per scope
 *        ├── RankSection × 4 — SECTOR / CITY / COUNTRY / WORLD
 *        │    └── progress bar · rank number · need-to-advance label
 *        ├── TitleHoldersSection — current BARON / VICEROY / SOVEREIGN / IMPERATOR
 *        ├── RecentBidsSection  — bids this user placed
 *        └── CycleEarningsSection — monthly title earnings
 *   [3]  BidModal — Boli bottom sheet (opens on cycle freeze or user tap)
 *
 * LAWS ENFORCED:
 *   Rule 03 / LAW 30 — Avatar NEVER in this header — only in bottom nav
 *   LAW 21  — City-sharded data: /cities/{cityId}/cycles/...
 *   §1.2.2  — Credits displayed (no ₹/$/€ symbol)
 *   §1.4.9  — All title strings from @/constants/titles ONLY
 *   §1.3.2  — Full-width bottom nav (no Glass Island)
 *
 * FIRESTORE:
 *   /cities/{cityId}/cycles/current — active cycle metadata
 *   /cities/{cityId}/leaderboards/{scope} — live rank maps
 *   /users/{uid}/bids — recent bids placed by this user
 *
 * ANIMATION: Reanimated v4 — useSharedValue · withSpring · withTiming
 *   All worklets run on UI thread (zero bridge cost).
 *
 * STACK: Expo SDK 54 · React Native 0.81.5 · React 19 · Expo Router v6
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { orbit, colors }      from '@/constants/colors';
import { spacing, radius }    from '@/constants/spacing';
import {
  TITLES,
  TITLE_COLORS,
  TITLE_LABELS,
  CYCLE,
  type TitleTier,
}                              from '@/constants/titles';
import { useAuth }             from '@/contexts/AuthContext';
import { firestore, serverTimestamp } from '@/lib/firebase';

// ─── snap.exists — boolean property, NEVER a function call ──────────────────
/** Reads DocumentSnapshot.exists as a boolean property (never call it). */
function snapExists(snap: { exists: boolean | (() => boolean) }): boolean {
  return !!snap.exists;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Scope order for display (bottom-up: local → global) */
const SCOPE_ORDER: TitleTier[] = ['SECTOR', 'CITY', 'COUNTRY', 'WORLD'] as const;

/** Scope display emoji per tier */
const SCOPE_EMOJI: Record<TitleTier, string> = {
  SECTOR:  '🏘️',
  CITY:    '🏙️',
  COUNTRY: '🇮🇳',
  WORLD:   '🌍',
} as const;

/** Icon size used for Feather icons throughout */
const ICON_SM  = 16 as const;
const ICON_MD  = 20 as const;
const ICON_LG  = 24 as const;

/** Spring config — standard Glass-Era responsive feel */
const SPRING_BASE = { mass: 1, stiffness: 200, damping: 24 } as const;

/** Spring config — bouncy for BidModal entry (Reanimated v4 withSpring) */
const SPRING_BOUNCE = { mass: 1, stiffness: 180, damping: 14 } as const;

/** Shimmer loop duration ms */
const SHIMMER_DURATION_MS = 1_200 as const;

/** Progress bar max width fraction (set in layout callbacks) */
const PROGRESS_BAR_HEIGHT = 6 as const;

/** Number of recent bids shown */
const MAX_RECENT_BIDS = 5 as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** A user's rank in one scope during the active cycle. */
interface ScopeRank {
  scope:        TitleTier;
  scopeName:    string;   // e.g. "Sector 17", "Chandigarh", "India", "World"
  rank:         number;   // 1-based rank position (0 = unranked)
  reactionsHeld: number;  // current reaction count
  reactionsNeeded: number; // to advance to next milestone
  nextMilestone: number;  // e.g. 100, 1000, 10000
  progressFraction: number; // 0.0 – 1.0 toward next milestone
  isTopTen:     boolean;
}

/** A title holder for a given scope. */
interface TitleHolder {
  scope:    TitleTier;
  handle:   string;   // e.g. "@AyeshaT"
  cycles:   number;   // cycles held (can be 0 if newly earned)
  scopeName: string;  // city/country/sector name
}

/** A bid this user placed in any cycle. */
interface RecentBid {
  id:         string;
  scope:      TitleTier;
  scopeName:  string;
  targetHandle: string;
  amountCredits: number;
  status:     'pending' | 'winning' | 'outbid' | 'refunded' | 'won';
  cycleLabel: string;  // e.g. "Cycle 14 · Sector 17"
}

/** Async state discriminated union (no `any`) */
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

/** Monthly earnings summary for this user (CROWN tab §1.3.5). */
interface CycleEarnings {
  /** Number of days user held Sector top-10 this calendar month */
  sectorHeroDays:   number;
  /** Number of days user appeared in City top-100 this month */
  cityTop100Days:   number;
  /** Number of full title wins (any scope) this month */
  titlesEarned:     number;
  /** Total Credits earned from title bid-fee shares this month */
  earnedCredits:    number;
}

/** Active cycle metadata (Firestore /cities/{cityId}/cycles/current) */
interface ActiveCycle {
  cityId:          string;
  cityName:        string;
  sectorName:      string;
  cycleStartMs:    number;  // epoch ms when this 5-hour cycle began
  cycleDurationMs: number;  // always CYCLE.DURATION_MS
  isFrozen:        boolean; // true = Boli (auction) window open
  boliOpenMs:      number | null; // when Boli opened (null if not frozen)
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribes to the active cycle for a city.
 * Uses /cities/{cityId}/cycles/current (city-sharded per LAW 21).
 *
 * @param cityId - The user's current city shard key
 * @param onChange - Callback with latest cycle or null if not found
 * @returns Unsubscribe function
 */
function subscribeActiveCycle(
  cityId: string,
  onChange: (cycle: ActiveCycle | null) => void,
): () => void {
  return firestore()
    .collection('cities')
    .doc(cityId)
    .collection('cycles')
    .doc('current')
    .onSnapshot(
      snap => {
        if (!snapExists(snap)) { onChange(null); return; }
        onChange(snap.data() as ActiveCycle);
      },
      () => onChange(null),
    );
}

/**
 * Subscribes to the current user's ranks across all scopes.
 * Reads /cities/{cityId}/leaderboards/{scope} (city-sharded).
 *
 * @param cityId - The user's current city shard key
 * @param uid    - The authenticated user's UID
 * @param onChange - Callback with latest ranks
 * @returns Unsubscribe function
 */
function subscribeUserRanks(
  cityId: string,
  uid: string,
  onChange: (ranks: ScopeRank[]) => void,
): () => void {
  const unsubs: Array<() => void> = [];

  const ranks: Partial<Record<TitleTier, ScopeRank>> = {};

  function emit(): void {
    const ordered = SCOPE_ORDER
      .map(s => ranks[s])
      .filter((r): r is ScopeRank => r !== undefined);
    onChange(ordered);
  }

  for (const scope of SCOPE_ORDER) {
    const unsub = firestore()
      .collection('cities')
      .doc(cityId)
      .collection('leaderboards')
      .doc(scope)
      .onSnapshot(
        snap => {
          if (!snapExists(snap)) {
            ranks[scope] = buildUnrankedScopeRank(scope, cityId);
            emit();
            return;
          }
          const raw = snap.data() as Record<string, unknown>;
          ranks[scope] = parseScopeRank(scope, raw, uid, cityId);
          emit();
        },
        () => {
          ranks[scope] = buildUnrankedScopeRank(scope, cityId);
          emit();
        },
      );
    unsubs.push(unsub);
  }

  return () => unsubs.forEach(u => u());
}

/**
 * Subscribes to recent bids placed by this user.
 * Reads /users/{uid}/bids ordered by time (newest first).
 *
 * @param uid - The authenticated user's UID
 * @param onChange - Callback with latest bids list
 * @returns Unsubscribe function
 */
function subscribeRecentBids(
  uid: string,
  onChange: (bids: RecentBid[]) => void,
): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('bids')
    .orderBy('placedAt', 'desc')
    .limit(MAX_RECENT_BIDS)
    .onSnapshot(
      qs => {
        const list: RecentBid[] = [];
        qs.forEach(doc => {
          list.push({ id: doc.id, ...(doc.data() as Omit<RecentBid, 'id'>) });
        });
        onChange(list);
      },
      () => onChange([]),
    );
}

/**
 * Subscribes to current title holders for a city (all 4 scopes).
 * Reads /cities/{cityId}/titles/current.
 *
 * @param cityId - The user's current city shard key
 * @param onChange - Callback with latest title holders
 * @returns Unsubscribe function
 */
function subscribeTitleHolders(
  cityId: string,
  onChange: (holders: TitleHolder[]) => void,
): () => void {
  return firestore()
    .collection('cities')
    .doc(cityId)
    .collection('titles')
    .doc('current')
    .onSnapshot(
      snap => {
        if (!snapExists(snap)) { onChange([]); return; }
        const raw = snap.data() as Record<TitleTier, unknown>;
        const holders: TitleHolder[] = [];
        for (const scope of SCOPE_ORDER) {
          const entry = raw[scope] as
            | { handle: string; cycles: number; scopeName: string }
            | null
            | undefined;
          if (entry?.handle) {
            holders.push({
              scope,
              handle:    entry.handle,
              cycles:    entry.cycles ?? 0,
              scopeName: entry.scopeName ?? '',
            });
          }
        }
        onChange(holders);
      },
      () => onChange([]),
    );
}

/**
 * Subscribes to monthly earnings summary for this user.
 * Reads /users/{uid}/earningsMonthly/current.
 *
 * @param uid      - The authenticated user's UID
 * @param onChange - Callback with latest earnings or null
 * @returns Unsubscribe function
 */
function subscribeCycleEarnings(
  uid: string,
  onChange: (earnings: CycleEarnings | null) => void,
): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('earningsMonthly')
    .doc('current')
    .onSnapshot(
      snap => {
        if (!snapExists(snap)) { onChange(null); return; }
        const raw = snap.data() as Partial<CycleEarnings> | undefined;
        onChange({
          sectorHeroDays: raw?.sectorHeroDays  ?? 0,
          cityTop100Days: raw?.cityTop100Days   ?? 0,
          titlesEarned:   raw?.titlesEarned     ?? 0,
          earnedCredits:  raw?.earnedCredits    ?? 0,
        });
      },
      () => onChange(null),
    );
}

/** Builds a fallback unranked ScopeRank when a leaderboard doc is absent. */
function buildUnrankedScopeRank(scope: TitleTier, cityId: string): ScopeRank {
  return {
    scope,
    scopeName:        getScopeDisplayName(scope, cityId),
    rank:             0,
    reactionsHeld:    0,
    reactionsNeeded:  100,
    nextMilestone:    100,
    progressFraction: 0,
    isTopTen:         false,
  };
}

/** Parses raw Firestore leaderboard data for a single user entry. */
function parseScopeRank(
  scope: TitleTier,
  raw: Record<string, unknown>,
  uid: string,
  cityId: string,
): ScopeRank {
  const userEntry = (raw[uid] as
    | { rank: number; reactions: number }
    | null
    | undefined);

  const reactionsHeld    = userEntry?.reactions ?? 0;
  const rank             = userEntry?.rank ?? 0;
  const nextMilestone    = computeNextMilestone(reactionsHeld);
  const isMaxed          = nextMilestone === null;
  const effectiveNext    = isMaxed ? 1_00_000 : nextMilestone;
  const prevMilestone    = computePrevMilestone(effectiveNext);
  const progressFraction = isMaxed
    ? 1
    : prevMilestone >= effectiveNext
      ? 1
      : Math.min((reactionsHeld - prevMilestone) / (effectiveNext - prevMilestone), 1);

  return {
    scope,
    scopeName:        (raw['scopeName'] as string | undefined) ?? getScopeDisplayName(scope, cityId),
    rank,
    reactionsHeld,
    reactionsNeeded:  isMaxed ? 0 : Math.max(0, effectiveNext - reactionsHeld),
    nextMilestone:    effectiveNext,
    progressFraction: Math.max(0, progressFraction),
    isTopTen:         rank > 0 && rank <= 10,
  };
}

/** Next reaction-count milestone for rank progress display.
 *  Returns null when user has surpassed the highest milestone (1 Lakh+). */
function computeNextMilestone(current: number): number | null {
  const milestones = [100, 500, 1_000, 5_000, 10_000, 50_000, 1_00_000];
  return milestones.find(m => m > current) ?? null;
}

/** Previous milestone (floor for progress bar). */
function computePrevMilestone(next: number): number {
  const milestones = [0, 100, 500, 1_000, 5_000, 10_000, 50_000];
  const idx = milestones.findIndex(m => m >= next);
  return idx > 0 ? (milestones[idx - 1] ?? 0) : 0;
}

/** Human-readable scope name fallback. */
function getScopeDisplayName(scope: TitleTier, cityId: string): string {
  switch (scope) {
    case 'SECTOR':  return 'Your Sector';
    case 'CITY':    return cityId || 'Your City';
    case 'COUNTRY': return 'India';
    case 'WORLD':   return 'World';
  }
}

/** Format milliseconds remaining as HH:MM:SS. */
function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1_000));
  const h     = Math.floor(total / 3_600);
  const m     = Math.floor((total % 3_600) / 60);
  const s     = total % 60;
  return [h, m, s]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

/** Format a Credits amount (no ₹/$). */
function formatCredits(amount: number): string {
  return `${amount.toLocaleString('en-IN')} Cr`;
}

/** Bid status badge label. */
function bidStatusLabel(status: RecentBid['status']): string {
  switch (status) {
    case 'pending':  return 'Pending';
    case 'winning':  return 'Winning ✓';
    case 'outbid':   return 'Outbid';
    case 'refunded': return 'Refunded';
    case 'won':      return 'Won 🎉';
  }
}

/** Bid status color. */
function bidStatusColor(status: RecentBid['status']): string {
  switch (status) {
    case 'winning': return orbit.success;
    case 'won':     return orbit.success;
    case 'outbid':  return orbit.danger;
    case 'refunded':return orbit.warning;
    default:        return orbit.textTertiary;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Skeleton ────────────────────────────────────────────────────────────────

/**
 * Animated shimmer skeleton block.
 * Runs on UI thread via Reanimated v4 worklet.
 *
 * @param width  - Explicit width (number) or undefined for flex-1
 * @param height - Block height in dp
 * @param borderRadius - Optional corner radius
 */
const SkeletonBlock = React.memo(function SkeletonBlock({
  width,
  height,
  borderRadius = radius.sm,
}: {
  width?: number;
  height: number;
  borderRadius?: number;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: SHIMMER_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: SHIMMER_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  /* PERF: opacity — compositor only — zero layout/paint */
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Reanimated.View
      style={[
        {
          width:        width ?? '100%',
          height,
          borderRadius,
          backgroundColor: orbit.accentSoftSolid,
        },
        animStyle,
      ]}
      accessibilityRole="none"
      importantForAccessibility="no"
    />
  );
});

// ─── CycleCountdown ──────────────────────────────────────────────────────────

interface CycleCountdownProps {
  /** Epoch ms when this 5-hour cycle started */
  cycleStartMs:    number;
  /** Total cycle duration — defaults to CYCLE.DURATION_MS */
  cycleDurationMs?: number;
  /** Whether the cycle is currently frozen (Boli window) */
  isFrozen:        boolean;
  /** Called when user taps "Boli karo →" in frozen state */
  onBoliTap:       () => void;
}

/**
 * Live 5-hour countdown timer for the active cycle.
 * Ticks every second via setInterval on JS thread;
 * only the final display update triggers a re-render (minimal).
 *
 * Displays HH:MM:SS in Space Mono for precision.
 * When frozen: shows gold "BOLI CHAL RAHI HAI" banner with CTA.
 *
 * @param cycleStartMs    - Epoch ms when cycle started
 * @param cycleDurationMs - Total cycle length (default 5h)
 * @param isFrozen        - Whether Boli auction window is open
 * @param onBoliTap       - Tap handler for the Boli CTA
 */
const CycleCountdown = React.memo(function CycleCountdown({
  cycleStartMs,
  cycleDurationMs = CYCLE.DURATION_MS,
  isFrozen,
  onBoliTap,
}: CycleCountdownProps) {

  const [displayTime, setDisplayTime] = useState<string>('--:--:--');
  const [progressFraction, setProgressFraction] = useState(0);

  /* Reanimated progress bar — UI thread */
  const barWidth = useSharedValue(0);

  /* PERF: transform(scaleX) — compositor only — zero layout/paint */
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  useEffect(() => {
    function tick(): void {
      const now       = Date.now();
      const elapsed   = now - cycleStartMs;
      const remaining = cycleDurationMs - elapsed;
      const frac      = Math.min(1, Math.max(0, elapsed / cycleDurationMs));

      setDisplayTime(formatCountdown(remaining));
      setProgressFraction(frac);
      barWidth.value = withTiming(frac, { duration: 900 });
    }

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [cycleStartMs, cycleDurationMs, barWidth]);

  if (isFrozen) {
    return (
      <View style={styles.cycleCountdownFrozen} accessibilityLiveRegion="polite">
        <View style={styles.cycleCountdownFrozenInner}>
          <Feather name="lock" size={ICON_SM} color={orbit.accent} />
          <Text style={styles.cycleCountdownFrozenTitle}>BOLI CHAL RAHI HAI</Text>
        </View>
        <Text style={styles.cycleCountdownFrozenSub}>
          Cycle frozen · Auction window open
        </Text>
        <TouchableOpacity
          style={styles.cycleBoliCta}
          onPress={onBoliTap}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Boli karo — place your bid"
          hitSlop={8}
        >
          <Text style={styles.cycleBoliCtaText}>Boli karo →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cycleCountdownCard} accessibilityLiveRegion="polite">
      <View style={styles.cycleCountdownRow}>
        <View style={styles.cycleCountdownLeft}>
          <Text style={styles.cycleCountdownLabel}>CYCLE FREEZES IN</Text>
          <Text style={styles.cycleCountdownTime}>{displayTime}</Text>
        </View>
        <View style={styles.cycleCountdownProgressCol}>
          <Text style={styles.cycleCountdownPercent}>
            {Math.round(progressFraction * 100)}%
          </Text>
          <View style={styles.cycleProgressTrack}>
            <Reanimated.View
              style={[styles.cycleProgressBar, barStyle]}
              /* PERF: width — triggers layout, kept small (single row) */
            />
          </View>
        </View>
      </View>
      <Text style={styles.cycleSub}>
        5-hour cycle · top reactor per scope earns the title
      </Text>
    </View>
  );
});

// ─── RankCard ────────────────────────────────────────────────────────────────

interface RankCardProps {
  rankData: ScopeRank;
}

/**
 * Displays a user's rank within one scope (SECTOR / CITY / COUNTRY / WORLD).
 * Shows rank number, progress bar toward next milestone, and
 * "need N more reactions" label.
 *
 * @param rankData - Parsed ScopeRank for this scope
 */
const RankCard = React.memo(function RankCard({ rankData }: RankCardProps) {
  const {
    scope,
    scopeName,
    rank,
    reactionsHeld,
    reactionsNeeded,
    progressFraction,
    isTopTen,
  } = rankData;

  const titleColor = useMemo((): string => {
    switch (scope) {
      case 'SECTOR':  return TITLE_COLORS.SECTOR;
      case 'CITY':    return TITLE_COLORS.CITY;
      case 'COUNTRY': return TITLE_COLORS.COUNTRY_INDIA[0]; // saffron
      case 'WORLD':   return TITLE_COLORS.WORLD[3];          // royal blue
    }
  }, [scope]);

  /* Reanimated progress bar */
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withSpring(progressFraction, SPRING_BASE);
  }, [progressFraction, barWidth]);

  /* PERF: width — layout-triggering; kept to single-row short bar */
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  const rankLabel = rank === 0 ? 'Unranked' : `#${rank.toLocaleString('en-IN')}`;
  const isActive  = rank > 0;

  return (
    <View
      style={[styles.rankCard, isTopTen && { borderColor: titleColor }]}
      accessibilityRole="none"
      accessible
      accessibilityLabel={`${SCOPE_EMOJI[scope]} ${TITLES[scope]} · ${scopeName} · Rank ${rankLabel}`}
    >
      {/* Scope header */}
      <View style={styles.rankCardHeader}>
        <Text style={styles.rankCardEmoji}>{SCOPE_EMOJI[scope]}</Text>
        <View style={styles.rankCardHeaderText}>
          <Text style={styles.rankCardScope}>{TITLES[scope]}</Text>
          <Text style={styles.rankCardScopeName} numberOfLines={1}>{scopeName}</Text>
        </View>
        <Text style={[
          styles.rankCardRankNum,
          { color: isActive ? titleColor : orbit.textTertiary },
        ]}>
          {rankLabel}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.rankProgressTrack}>
        <Reanimated.View
          style={[
            styles.rankProgressBar,
            { backgroundColor: titleColor },
            barStyle,
          ]}
        />
      </View>

      {/* Need-to-advance label */}
      <Text style={styles.rankNeedLabel}>
        {rank === 0
          ? 'Start chatting to enter the leaderboard'
          : isTopTen
            ? `Top 10 — held for ${reactionsHeld.toLocaleString('en-IN')} reactions`
            : reactionsNeeded === 0
              ? `1 Lakh+ reactions — legendary status!`
              : `Need ${reactionsNeeded.toLocaleString('en-IN')} more reactions for Top 100`
        }
      </Text>
    </View>
  );
});

// ─── TitleHolderRow ───────────────────────────────────────────────────────────

interface TitleHolderRowProps {
  holder: TitleHolder;
}

/**
 * Displays a single current title holder (one row in the "Current Holders" list).
 *
 * @param holder - TitleHolder data for this scope
 */
const TitleHolderRow = React.memo(function TitleHolderRow({ holder }: TitleHolderRowProps) {
  const { scope, handle, cycles, scopeName } = holder;

  const titleColor = useMemo((): string => {
    switch (scope) {
      case 'SECTOR':  return TITLE_COLORS.SECTOR;
      case 'CITY':    return TITLE_COLORS.CITY;
      case 'COUNTRY': return TITLE_COLORS.COUNTRY_INDIA[0];
      case 'WORLD':   return TITLE_COLORS.WORLD[3];
    }
  }, [scope]);

  return (
    <View style={styles.titleHolderRow} accessible accessibilityRole="text"
      accessibilityLabel={`${TITLES[scope]} of ${scopeName}: ${handle}, ${cycles} cycles`}
    >
      <Text style={styles.titleHolderEmoji}>{SCOPE_EMOJI[scope]}</Text>
      <View style={styles.titleHolderMeta}>
        <Text style={[styles.titleHolderTitle, { color: titleColor }]}>
          {TITLE_LABELS.WITH_SCOPE[scope](scopeName)}
        </Text>
        <Text style={styles.titleHolderHandle} numberOfLines={1}>
          {handle}
          {cycles > 0 && (
            <Text style={styles.titleHolderCycles}> · {cycles} {CYCLE.LABEL_PLURAL}</Text>
          )}
        </Text>
      </View>
    </View>
  );
});

// ─── BidStatusChip ───────────────────────────────────────────────────────────

interface BidStatusChipProps {
  status: RecentBid['status'];
}

/** Small inline chip showing bid status with color. */
const BidStatusChip = React.memo(function BidStatusChip({ status }: BidStatusChipProps) {
  const color = bidStatusColor(status);
  return (
    <View style={[styles.bidStatusChip, { borderColor: color }]}>
      <Text style={[styles.bidStatusChipText, { color }]}>
        {bidStatusLabel(status)}
      </Text>
    </View>
  );
});

// ─── RecentBidRow ─────────────────────────────────────────────────────────────

interface RecentBidRowProps {
  bid: RecentBid;
}

/**
 * Displays a single recent bid placed by this user.
 *
 * @param bid - RecentBid data
 */
const RecentBidRow = React.memo(function RecentBidRow({ bid }: RecentBidRowProps) {
  return (
    <View style={styles.bidRow} accessible accessibilityRole="text"
      accessibilityLabel={`Bid of ${formatCredits(bid.amountCredits)} on ${bid.targetHandle} for ${TITLES[bid.scope]} of ${bid.scopeName}, status: ${bidStatusLabel(bid.status)}`}
    >
      <View style={styles.bidRowLeft}>
        <Text style={styles.bidRowEmoji}>{SCOPE_EMOJI[bid.scope]}</Text>
        <View style={styles.bidRowMeta}>
          <Text style={styles.bidRowTarget} numberOfLines={1}>
            {bid.targetHandle}
            <Text style={styles.bidRowScopeName}> · {bid.scopeName}</Text>
          </Text>
          <Text style={styles.bidRowCycleLabel} numberOfLines={1}>{bid.cycleLabel}</Text>
        </View>
      </View>
      <View style={styles.bidRowRight}>
        <Text style={styles.bidRowAmount}>{formatCredits(bid.amountCredits)}</Text>
        <BidStatusChip status={bid.status} />
      </View>
    </View>
  );
});

// ─── BidModal (Boli Sheet) ───────────────────────────────────────────────────

interface BidModalProps {
  visible:   boolean;
  onClose:   () => void;
  cityId:    string;
  cityName:  string;
  uid:       string | undefined;
}

/**
 * Boli (Auction) bottom sheet.
 * Opens when cycle freezes OR user taps "Place a bid".
 * Allows selecting a scope and entering a bid amount in Credits.
 * No ₹ symbol anywhere — Credits only (Anti-Drift Lock #3).
 *
 * ANIMATION: Reanimated v4 — useSharedValue + withSpring + withTiming.
 * placedAt uses serverTimestamp() — never client new Date().
 *
 * @param visible  - Whether this sheet is visible
 * @param onClose  - Called to dismiss
 * @param cityId   - Current city shard (for Firestore write target)
 * @param cityName - Display name for city
 * @param uid      - Current user UID (required to bid)
 */
const BidModal = React.memo(function BidModal({
  visible,
  onClose,
  cityId,
  cityName,
  uid,
}: BidModalProps) {
  const insets  = useSafeAreaInsets();

  /* PERF: transform — compositor only — zero layout/paint */
  const slideY  = useSharedValue(700);

  const [selectedScope, setSelectedScope] = useState<TitleTier>('CITY');
  const [targetHandle,  setTargetHandle]  = useState('');
  const [bidAmount,     setBidAmount]     = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  /* Reanimated v4 slide-up / slide-down animation (SPRING_BOUNCE) */
  useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, SPRING_BOUNCE);
    } else {
      slideY.value = withTiming(700, {
        duration: 220,
        easing:   Easing.in(Easing.ease),
      });
      setTargetHandle('');
      setBidAmount('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, slideY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const parsedAmount = useMemo((): number | null => {
    const n = parseInt(bidAmount.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) || n <= 0 ? null : n;
  }, [bidAmount]);

  const canSubmit = Boolean(uid) && Boolean(targetHandle.trim()) && parsedAmount !== null && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || parsedAmount === null || !uid) return;
    setSubmitting(true);
    setError(null);
    try {
      await firestore()
        .collection('cities')
        .doc(cityId)
        .collection('bids')
        .add({
          scope:         selectedScope,
          cityId,
          cityName,
          bidderUid:     uid,
          targetHandle:  targetHandle.trim(),
          amountCredits: parsedAmount,
          status:        'pending',
          placedAt:      serverTimestamp(), // server-authoritative — never client new Date()
        });
      onClose();
    } catch {
      setError('Bid place nahi ho saka — dobara try karo.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, parsedAmount, uid, cityId, cityName, selectedScope, targetHandle, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.sheetBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close Boli sheet"
      >
        <Reanimated.View
          style={[
            styles.sheetContainer,
            { paddingBottom: insets.bottom + 24 },
            sheetAnimStyle,
          ]}
        >
          {/* Stop backdrop dismissal inside sheet */}
          <Pressable>
            <View style={styles.sheetHandle} />

            {/* Title */}
            <Text style={styles.sheetTitle}>Boli (Auction)</Text>
            <Text style={styles.sheetSub}>
              Cycle frozen · Highest bidder wins the title for next cycle.
              Credits refunded if outbid.
            </Text>

            {/* Scope selector */}
            <Text style={styles.fieldLabel}>SCOPE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
            >
              {SCOPE_ORDER.map(scope => {
                const isActive = scope === selectedScope;
                return (
                  <TouchableOpacity
                    key={scope}
                    style={[
                      styles.scopeChip,
                      isActive && { backgroundColor: orbit.accentSoft, borderColor: orbit.accent },
                    ]}
                    onPress={() => setSelectedScope(scope)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={TITLES[scope]}
                    accessibilityState={{ selected: isActive }}
                    hitSlop={4}
                  >
                    <Text style={styles.scopeChipEmoji}>{SCOPE_EMOJI[scope]}</Text>
                    {/* Render full title from constants — no dead ternary */}
                    <Text style={[
                      styles.scopeChipText,
                      isActive && { color: orbit.accent },
                    ]}>
                      {TITLES[scope]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Target handle */}
            <Text style={styles.fieldLabel}>BID FOR HANDLE</Text>
            <View style={styles.fieldInputWrap}>
              <Text style={styles.fieldInputAt}>@</Text>
              <TextInput
                style={styles.fieldInput}
                value={targetHandle}
                onChangeText={t => setTargetHandle(t.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="handle"
                placeholderTextColor={orbit.textTertiary}
                maxLength={32}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                accessibilityLabel="Target user handle"
              />
            </View>

            {/* Bid amount */}
            <Text style={styles.fieldLabel}>BID AMOUNT (CREDITS)</Text>
            <TextInput
              style={styles.fieldInputStandalone}
              value={bidAmount}
              onChangeText={v => setBidAmount(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 500"
              placeholderTextColor={orbit.textTertiary}
              keyboardType="number-pad"
              maxLength={7}
              returnKeyType="done"
              accessibilityLabel="Bid amount in Credits"
            />
            <Text style={styles.creditNote}>
              No ₹ — Credits only. Refunded automatically if outbid.
            </Text>

            {/* Error */}
            {error !== null && (
              <Text style={styles.fieldError} accessibilityLiveRegion="assertive">
                {error}
              </Text>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[
                styles.boliSubmitBtn,
                !canSubmit && { opacity: 0.45 },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={submitting ? 'Placing bid…' : 'Place Boli'}
              accessibilityState={{ disabled: !canSubmit }}
            >
              {submitting
                ? <ActivityIndicator size="small" color={orbit.textInverse} />
                : <Text style={styles.boliSubmitBtnText}>Place Boli</Text>
              }
            </TouchableOpacity>
          </Pressable>
        </Reanimated.View>
      </Pressable>
    </Modal>
  );
});

// ─── CycleEarningsSection ────────────────────────────────────────────────────

interface CycleEarningsSectionProps {
  earnings: CycleEarnings | null;
  loading:  boolean;
}

/**
 * Monthly title earnings summary for the current user.
 * PRD §1.3.5 CROWN Tab layout — "CYCLE EARNINGS (this month)".
 * Shows: Sector Hero days · City Top-100 days · Titles earned · Credits earned.
 * No ₹ symbol — Credits only (Anti-Drift Lock #3).
 *
 * @param earnings - Parsed CycleEarnings, or null if no data yet
 * @param loading  - Whether data is loading
 */
const CycleEarningsSection = React.memo(function CycleEarningsSection({
  earnings,
  loading,
}: CycleEarningsSectionProps) {
  return (
    <View
      style={styles.earningsCard}
      accessible
      accessibilityLabel="Cycle earnings this month"
    >
      {loading ? (
        <>
          <SkeletonBlock height={16} width={140} borderRadius={radius.sm} />
          <View style={{ height: 8 }} />
          <SkeletonBlock height={14} borderRadius={radius.sm} />
        </>
      ) : earnings === null ? (
        <Text style={styles.earningsEmpty}>
          Koi earnings nahi abhi tak is mahine — title jeeto aur Credits kamao!
        </Text>
      ) : (
        <View style={styles.earningsGrid}>
          <View style={styles.earningsStat}>
            <Text style={styles.earningsStatValue}>
              {earnings.sectorHeroDays}
            </Text>
            <Text style={styles.earningsStatLabel}>Sector{'\n'}Hero Days</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsStat}>
            <Text style={styles.earningsStatValue}>
              {earnings.cityTop100Days}
            </Text>
            <Text style={styles.earningsStatLabel}>City Top-100{'\n'}Days</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsStat}>
            <Text style={styles.earningsStatValue}>
              {earnings.titlesEarned}
            </Text>
            <Text style={styles.earningsStatLabel}>Titles{'\n'}Won</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsStat}>
            <Text style={[styles.earningsStatValue, { color: orbit.accent }]}>
              {formatCredits(earnings.earnedCredits)}
            </Text>
            <Text style={styles.earningsStatLabel}>Earned{'\n'}This Month</Text>
          </View>
        </View>
      )}
    </View>
  );
});

// ─── SectionHeader ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label:      string;
  action?:    { label: string; onPress: () => void };
}

/** Reusable section header row with optional right-side action. */
const SectionHeader = React.memo(function SectionHeader({
  label,
  action,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderLabel}>{label}</Text>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.sectionHeaderAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─── EmptyBids ────────────────────────────────────────────────────────────────

/** Shown when user hasn't placed any bids yet. */
const EmptyBids = React.memo(function EmptyBids() {
  return (
    <View style={styles.emptyState}>
      <Feather name="award" size={28} color={orbit.textTertiary} />
      <Text style={styles.emptyStateText}>
        Koi bid nahi li abhi tak
      </Text>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CrownScreen — the CROWN tab.
 *
 * Status & bidding center: shows the user's rank across all 4 scopes,
 * live cycle countdown, current title holders, recent bids, and
 * earnings. Entry point for Boli (auction) when cycle freezes.
 *
 * LAW 30 / Rule 03: NO avatar in this header.
 * §1.4.9 / titles.ts: all title strings via constants, ZERO hardcoded.
 * Anti-Drift Lock #3: Credits only — no ₹/$/€ anywhere on this screen.
 */
export default function CrownScreen() {
  const insets      = useSafeAreaInsets();
  const { firebaseUser, user } = useAuth();

  const uid     = firebaseUser?.uid;
  const cityId  = (user as unknown as { cityId?: string } | null)?.cityId ?? 'CHD';
  const cityName= (user as unknown as { cityName?: string } | null)?.cityName ?? 'Chandigarh';

  const topPad  = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

  // ── State ──────────────────────────────────────────────────────────────
  const [cycleState, setCycleState]       = useState<AsyncState<ActiveCycle>>({ status: 'loading' });
  const [ranksState, setRanksState]       = useState<AsyncState<ScopeRank[]>>({ status: 'loading' });
  const [holdersState, setHoldersState]   = useState<AsyncState<TitleHolder[]>>({ status: 'loading' });
  const [bidsState, setBidsState]         = useState<AsyncState<RecentBid[]>>({ status: 'loading' });
  const [earningsState, setEarningsState] = useState<AsyncState<CycleEarnings>>({ status: 'loading' });
  const [showBoli, setShowBoli]           = useState(false);

  /**
   * Tracks whether we've already auto-opened Boli for the current freeze.
   * Prevents Firestore snapshot re-fires from re-opening a dismissed sheet.
   */
  const hasAutoOpenedBoliRef = useRef(false);

  // ── Subscriptions ──────────────────────────────────────────────────────
  useEffect(() => {
    hasAutoOpenedBoliRef.current = false; // reset on city change
    const unsub = subscribeActiveCycle(cityId, cycle => {
      setCycleState(cycle
        ? { status: 'success', data: cycle }
        : { status: 'error', message: 'Cycle data unavailable' },
      );
      // Auto-open Boli only ONCE per freeze — not on every snapshot update
      if (cycle?.isFrozen && !hasAutoOpenedBoliRef.current) {
        hasAutoOpenedBoliRef.current = true;
        setShowBoli(true);
      }
      // Reset the auto-open gate when cycle unfreezes
      if (!cycle?.isFrozen) {
        hasAutoOpenedBoliRef.current = false;
      }
    });
    return unsub;
  }, [cityId]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeUserRanks(cityId, uid, ranks => {
      setRanksState({ status: 'success', data: ranks });
    });
    return unsub;
  }, [cityId, uid]);

  useEffect(() => {
    const unsub = subscribeTitleHolders(cityId, holders => {
      setHoldersState({ status: 'success', data: holders });
    });
    return unsub;
  }, [cityId]);

  useEffect(() => {
    if (!uid) {
      setBidsState({ status: 'success', data: [] });
      return;
    }
    const unsub = subscribeRecentBids(uid, bids => {
      setBidsState({ status: 'success', data: bids });
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setEarningsState({ status: 'success', data: {
        sectorHeroDays: 0, cityTop100Days: 0, titlesEarned: 0, earnedCredits: 0,
      }});
      return;
    }
    const unsub = subscribeCycleEarnings(uid, earnings => {
      setEarningsState(earnings
        ? { status: 'success', data: earnings }
        : { status: 'success', data: {
            sectorHeroDays: 0, cityTop100Days: 0, titlesEarned: 0, earnedCredits: 0,
          }},
      );
    });
    return unsub;
  }, [uid]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleBoliTap = useCallback(() => { setShowBoli(true); }, []);
  const handleBoliClose = useCallback(() => { setShowBoli(false); }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const activeCycle      = cycleState.status === 'success' ? cycleState.data : null;
  const ranks            = ranksState.status === 'success' ? ranksState.data : null;
  const titleHolders     = holdersState.status === 'success' ? holdersState.data : null;
  const recentBids       = bidsState.status === 'success' ? bidsState.data : null;
  const earningsData     = earningsState.status === 'success' ? earningsState.data : null;
  const isCycleLoading   = cycleState.status === 'loading';
  const isRanksLoading   = ranksState.status === 'loading';
  const isEarningsLoading= earningsState.status === 'loading';

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>

      {/* ── HEADER ── LAW 30: NO AVATAR HERE ────────────────────────────
          Avatar lives ONLY in bottom navigation (full-width bar §1.3.2). */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={styles.headerTitle}>CROWN</Text>
        <View style={styles.headerRight}>
          {activeCycle?.isFrozen && (
            <View style={styles.frozenBadge} accessibilityLabel="Cycle frozen — Boli open">
              <Feather name="lock" size={10} color={orbit.accent} />
              <Text style={styles.frozenBadgeText}>BOLI OPEN</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.headerIconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Place a bid"
            onPress={handleBoliTap}
          >
            <Feather name="trending-up" size={ICON_MD} color={orbit.textSecond} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SCROLLABLE BODY ──────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 88 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── CYCLE COUNTDOWN ──────────────────────────────────────── */}
        {isCycleLoading ? (
          <View style={styles.cardSkeletonWrap}>
            <SkeletonBlock height={80} borderRadius={radius.md} />
          </View>
        ) : activeCycle ? (
          <CycleCountdown
            cycleStartMs={activeCycle.cycleStartMs}
            cycleDurationMs={activeCycle.cycleDurationMs}
            isFrozen={activeCycle.isFrozen}
            onBoliTap={handleBoliTap}
          />
        ) : (
          <View style={styles.cycleUnavailable}>
            <Text style={styles.cycleUnavailableText}>Cycle data loading…</Text>
          </View>
        )}

        {/* ── YOUR RANKS — 4 scopes ────────────────────────────────── */}
        <SectionHeader label="YOUR RANKS" />

        {isRanksLoading ? (
          <>
            <View style={{ marginBottom: 12 }}><SkeletonBlock height={96} borderRadius={radius.md} /></View>
            <View style={{ marginBottom: 12 }}><SkeletonBlock height={96} borderRadius={radius.md} /></View>
            <View style={{ marginBottom: 12 }}><SkeletonBlock height={96} borderRadius={radius.md} /></View>
            <View style={{ marginBottom: 12 }}><SkeletonBlock height={96} borderRadius={radius.md} /></View>
          </>
        ) : ranks && ranks.length > 0 ? (
          ranks.map(r => (
            <RankCard key={r.scope} rankData={r} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Chat karo aur reactions lo to appear on the leaderboard.
            </Text>
          </View>
        )}

        {/* ── CURRENT TITLE HOLDERS ────────────────────────────────── */}
        <SectionHeader
          label="CURRENT TITLE HOLDERS"
          action={{ label: 'See all →', onPress: handleBoliTap }}
        />

        <View style={styles.titleHoldersCard}>
          {holdersState.status === 'loading' ? (
            <>
              <SkeletonBlock height={44} borderRadius={radius.sm} />
              <View style={{ height: 8 }} />
              <SkeletonBlock height={44} borderRadius={radius.sm} />
            </>
          ) : titleHolders && titleHolders.length > 0 ? (
            titleHolders.map(h => (
              <TitleHolderRow key={h.scope} holder={h} />
            ))
          ) : (
            <Text style={styles.titleHoldersEmpty}>
              No title holders yet this cycle — be the first!
            </Text>
          )}
        </View>

        {/* ── RECENT BIDS ──────────────────────────────────────────── */}
        <SectionHeader
          label="RECENT BIDS (YOU)"
          action={recentBids && recentBids.length > 0
            ? { label: 'Place bid →', onPress: handleBoliTap }
            : undefined}
        />

        <View style={styles.bidsCard}>
          {bidsState.status === 'loading' ? (
            <>
              <SkeletonBlock height={48} borderRadius={radius.sm} />
              <View style={{ height: 8 }} />
              <SkeletonBlock height={48} borderRadius={radius.sm} />
            </>
          ) : recentBids && recentBids.length > 0 ? (
            recentBids.map(b => (
              <RecentBidRow key={b.id} bid={b} />
            ))
          ) : (
            <EmptyBids />
          )}
        </View>

        {/* ── PLACE BID CTA (if no bids yet) ───────────────────────── */}
        {recentBids !== null && recentBids.length === 0 && (
          <TouchableOpacity
            style={styles.placeBidCta}
            onPress={handleBoliTap}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Place a bid in the current auction"
          >
            <Feather name="award" size={ICON_SM} color={orbit.textInverse} />
            <Text style={styles.placeBidCtaText}>Place a Boli</Text>
          </TouchableOpacity>
        )}

        {/* ── CYCLE EARNINGS (THIS MONTH) ──────────────────────────── */}
        <SectionHeader label="CYCLE EARNINGS (THIS MONTH)" />
        <CycleEarningsSection
          earnings={earningsData}
          loading={isEarningsLoading}
        />

      </ScrollView>

      {/* ── BOLI MODAL (AUCTION SHEET) ──────────────────────────────── */}
      <BidModal
        visible={showBoli}
        onClose={handleBoliClose}
        cityId={cityId}
        cityName={cityName}
        uid={uid}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — all values from design tokens (ZERO hardcoded hex/px literals)
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({

  // ── Screen ───────────────────────────────────────────────────────────────
  screen: {
    flex: 1,
  },

  // ── Header (LAW 30 — NO AVATAR HERE) ─────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,   // 16px
    paddingBottom:     spacing.md,   // 12px
  },
  headerTitle: {
    color:         orbit.accent,     // Brand Gold — CROWN wordmark
    fontSize:      24,
    fontFamily:    'Syne_800ExtraBold', // §1.4.3 — Syne 800 for wordmark, loaded at root _layout
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,       // 8px
  },
  headerIconBtn: {
    width:           44,             // ≥ 44pt touch target (Apple HIG)
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  frozenBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:    99,
    backgroundColor: orbit.accentSoftSolid,
    borderWidth:     1,
    borderColor:     orbit.accent,
  },
  frozenBadgeText: {
    color:       orbit.accent,
    fontSize:    10,
    fontWeight:  '700',
    letterSpacing: 0.6,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,   // 16px
    paddingTop:        spacing.xs,   // 4px
    gap:               4,
  },

  // ── CycleCountdown ────────────────────────────────────────────────────────
  cycleCountdownCard: {
    backgroundColor: orbit.surface1,
    borderRadius:    radius.md,      // 12px
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         spacing.lg,     // 16px
    marginBottom:    spacing.md,     // 12px
  },
  cycleCountdownRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,       // 12px
  },
  cycleCountdownLeft: {
    flex: 1,
  },
  cycleCountdownLabel: {
    color:         orbit.textTertiary,
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  cycleCountdownTime: {
    color:      orbit.textPrimary,
    fontSize:   28,
    fontFamily: 'SpaceMono_700Bold', // §1.4.3 — Space Mono 700 for numeric countdown
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  cycleCountdownProgressCol: {
    alignItems: 'flex-end',
    gap:        6,
  },
  cycleCountdownPercent: {
    color:      orbit.accent,
    fontSize:   14,
    fontFamily: 'SpaceMono_700Bold', // §1.4.3 — numeric display
    fontWeight: '700',
  },
  cycleProgressTrack: {
    width:           80,
    height:          PROGRESS_BAR_HEIGHT,
    borderRadius:    99,
    backgroundColor: orbit.accentSoftSolid,
    overflow:        'hidden',
  },
  cycleProgressBar: {
    height:       '100%',
    borderRadius: 99,
    backgroundColor: orbit.accent,
    /* PERF: width change triggers layout — contained within small bar */
  },
  cycleSub: {
    color:      orbit.textTertiary,
    fontSize:   12,
    marginTop:  spacing.sm,         // 8px
  },

  cycleCountdownFrozen: {
    backgroundColor: orbit.accentSoftSolid,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     orbit.accent,
    padding:         spacing.lg,
    marginBottom:    spacing.md,
  },
  cycleCountdownFrozenInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  4,
  },
  cycleCountdownFrozenTitle: {
    color:         orbit.accent,
    fontSize:      14,
    fontWeight:    '700',
    letterSpacing: 0.6,
  },
  cycleCountdownFrozenSub: {
    color:       orbit.textSecond,
    fontSize:    13,
    marginBottom: spacing.md,
  },
  cycleBoliCta: {
    alignSelf:     'flex-start',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:  99,
    backgroundColor: orbit.accent,
    minWidth:      44,
    minHeight:     44,
    alignItems:    'center',
    justifyContent:'center',
  },
  cycleBoliCtaText: {
    color:      orbit.textInverse,
    fontSize:   14,
    fontWeight: '700',
  },

  cycleUnavailable: {
    padding:      spacing.lg,
    marginBottom: spacing.md,
  },
  cycleUnavailableText: {
    color:    orbit.textTertiary,
    fontSize: 13,
  },

  cardSkeletonWrap: {
    marginBottom: spacing.md,
  },

  // ── Section Header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingTop:     spacing.lg,      // 16px
    paddingBottom:  spacing.sm,      // 8px
  },
  sectionHeaderLabel: {
    color:         orbit.textTertiary,
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.6,
  },
  sectionHeaderAction: {
    color:      orbit.accent,
    fontSize:   13,
    fontWeight: '600',
  },

  // ── RankCard ──────────────────────────────────────────────────────────────
  rankCard: {
    backgroundColor: orbit.surface1,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
  },
  rankCardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.md,
    gap:           spacing.sm,
  },
  rankCardEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  rankCardHeaderText: {
    flex: 1,
  },
  rankCardScope: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rankCardScopeName: {
    color:    orbit.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  rankCardRankNum: {
    fontSize:   18,
    fontFamily: 'SpaceMono_700Bold', // §1.4.3 — rank numbers in Space Mono
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  rankProgressTrack: {
    height:          PROGRESS_BAR_HEIGHT,
    borderRadius:    99,
    backgroundColor: orbit.accentSoftSolid,
    overflow:        'hidden',
    marginBottom:    spacing.sm,
  },
  rankProgressBar: {
    height:       '100%',
    borderRadius: 99,
    /* PERF: width change — layout-triggering; minimal cost in small bar */
  },
  rankNeedLabel: {
    color:    orbit.textTertiary,
    fontSize: 12,
  },

  // ── Title Holders ─────────────────────────────────────────────────────────
  titleHoldersCard: {
    backgroundColor: orbit.surface1,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
    gap:             spacing.sm,
  },
  titleHolderRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    paddingVertical: 4,
  },
  titleHolderEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  titleHolderMeta: {
    flex: 1,
  },
  titleHolderTitle: {
    fontSize:   13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  titleHolderHandle: {
    color:    orbit.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 1,
  },
  titleHolderCycles: {
    color:    orbit.textTertiary,
    fontSize: 12,
    fontWeight: '400',
  },
  titleHoldersEmpty: {
    color:    orbit.textTertiary,
    fontSize: 13,
  },

  // ── Recent Bids ───────────────────────────────────────────────────────────
  bidsCard: {
    backgroundColor: orbit.surface1,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
    gap:             spacing.sm,
  },
  bidRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  bidRowLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  bidRowEmoji: {
    fontSize: 16,
  },
  bidRowMeta: {
    flex: 1,
  },
  bidRowTarget: {
    color:      orbit.textPrimary,
    fontSize:   14,
    fontWeight: '600',
  },
  bidRowScopeName: {
    color:      orbit.textTertiary,
    fontSize:   13,
    fontWeight: '400',
  },
  bidRowCycleLabel: {
    color:    orbit.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  bidRowRight: {
    alignItems: 'flex-end',
    gap:        4,
  },
  bidRowAmount: {
    color:      orbit.accent,
    fontSize:   14,
    fontFamily: 'SpaceMono_700Bold', // §1.4.3 — credit amounts in Space Mono
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bidStatusChip: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      4,
    borderWidth:       1,
  },
  bidStatusChipText: {
    fontSize:   10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems:    'center',
    paddingVertical: spacing.xl,      // 20px
    gap:           spacing.sm,
  },
  emptyStateText: {
    color:     orbit.textTertiary,
    fontSize:  13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Place Bid CTA ─────────────────────────────────────────────────────────
  placeBidCta: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    height:         52,
    borderRadius:   radius.lg,
    backgroundColor: orbit.accent,
    marginBottom:   spacing.md,
    // Shadow — elevation for Android, shadow for iOS
    elevation: 4,
    shadowColor:    orbit.accent,
    shadowOpacity:  0.35,
    shadowRadius:   12,
    shadowOffset:   { width: 0, height: 4 },
  },
  placeBidCtaText: {
    color:      orbit.textInverse,
    fontSize:   16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // ── Boli Bottom Sheet ─────────────────────────────────────────────────────
  sheetBackdrop: {
    flex:             1,
    backgroundColor:  colors.bg.scrim,              // Warm Ink scrim — token from colors.bg
    justifyContent:   'flex-end',
  },
  sheetContainer: {
    backgroundColor: orbit.surface1,
    borderTopLeftRadius:  radius.xl,   // 24px
    borderTopRightRadius: radius.xl,
    paddingTop:       spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sheetHandle: {
    width:         36,
    height:        4,
    borderRadius:  2,
    backgroundColor: orbit.borderStrong,
    alignSelf:     'center',
    marginBottom:  spacing.lg,
  },
  sheetTitle: {
    color:         orbit.textPrimary,
    fontSize:      20,
    fontWeight:    '700',
    letterSpacing: -0.3,
    marginBottom:  4,
  },
  sheetSub: {
    color:        orbit.textSecond,
    fontSize:     13,
    marginBottom: spacing.lg,
    lineHeight:   19,
  },

  // ── Form fields ───────────────────────────────────────────────────────────
  fieldLabel: {
    color:         orbit.textTertiary,
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.5,
    marginBottom:  spacing.sm,
  },
  fieldInputWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: orbit.surface2,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     orbit.borderStrong,
    paddingHorizontal: spacing.md,
    marginBottom:    spacing.lg,
    minHeight:       48,
  },
  fieldInputAt: {
    color:      orbit.textTertiary,
    fontSize:   16,
    marginRight: 4,
  },
  fieldInput: {
    flex:     1,
    color:    orbit.textPrimary,
    fontSize: 15,
    paddingVertical: 11,
  },
  fieldInputStandalone: {
    backgroundColor:  orbit.surface2,
    borderRadius:     radius.md,
    borderWidth:      1,
    borderColor:      orbit.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical:   11,
    color:            orbit.textPrimary,
    fontSize:         16,
    fontFamily:       'SpaceMono_700Bold', // §1.4.3 — numeric input in Space Mono
    fontWeight:       '600',
    marginBottom:     4,
    minHeight:        48,
  },
  creditNote: {
    color:        orbit.textTertiary,
    fontSize:     11,
    marginBottom: spacing.md,
  },
  fieldError: {
    color:        orbit.danger,
    fontSize:     13,
    marginBottom: spacing.sm,
  },

  scopeChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    paddingHorizontal: 13,
    paddingVertical:   9,
    borderRadius:    99,
    backgroundColor: orbit.surface2,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    minHeight:       44,
    minWidth:        44,
  },
  scopeChipEmoji: {
    fontSize: 14,
  },
  scopeChipText: {
    color:      orbit.textSecond,
    fontSize:   13,
    fontWeight: '500',
  },

  boliSubmitBtn: {
    alignItems:      'center',
    justifyContent:  'center',
    height:          52,
    borderRadius:    radius.lg,
    backgroundColor: orbit.accent,
    marginTop:       spacing.sm,
  },
  boliSubmitBtnText: {
    color:      orbit.textInverse,
    fontSize:   16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // ── Cycle Earnings Section ────────────────────────────────────────────────
  earningsCard: {
    backgroundColor: orbit.surface1,
    borderRadius:    radius.md,      // 12px
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         spacing.lg,     // 16px
    marginBottom:    spacing.sm,
  },
  earningsEmpty: {
    color:    orbit.textTertiary,
    fontSize: 13,
    lineHeight: 20,
  },
  earningsGrid: {
    flexDirection:  'row',
    alignItems:     'stretch',
    justifyContent: 'space-between',
  },
  earningsStat: {
    flex:       1,
    alignItems: 'center',
    gap:        spacing.xs,          // 4px
  },
  earningsStatValue: {
    color:      orbit.textPrimary,
    fontSize:   17,
    fontFamily: 'SpaceMono_700Bold', // §1.4.3 — numeric display
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  earningsStatLabel: {
    color:     orbit.textTertiary,
    fontSize:  10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  earningsDivider: {
    width:           1,
    backgroundColor: orbit.borderSubtle,
    marginVertical:  spacing.xs,     // 4px
    alignSelf:       'stretch',
  },
});

/**
 * @file crown-rank/api/rank.ts
 * @module CROWN — Rank API Layer
 * @description Firebase Firestore real-time listeners and polling for user rank data.
 *   Implements PRD §17.2 (Real-Time Listeners) and §17.3 (Polling) exactly.
 *   All listeners return cleanup Unsubscribe functions — call on component unmount.
 *   Polling uses drift-corrected intervals per LAW 9.
 *
 * Uses the @react-native-firebase NAMESPACED API (firestore().collection()…),
 * `snap.exists` is a boolean PROPERTY (never a method), and works identically
 * on iOS, Android and web via lib/firebase(.web).
 *
 * @security Firestore rules restrict every read to the authenticated owner.
 *   No cross-user data ever crosses this API boundary.
 */

import { firestore } from '@/lib/firebase';

type FsTimestamp = FirebaseFirestoreTimestampLike;
type DocumentData = Record<string, any>;
export type Unsubscribe = () => void;

/** Minimal structural type for a Firestore Timestamp (cross-platform safe). */
interface FirebaseFirestoreTimestampLike {
  toMillis: () => number;
}

// ──────────────────────────────────────────────────────────────
// CONSTANTS  (LAW 19 — zero magic numbers)
// ──────────────────────────────────────────────────────────────

const RANK_POLL_INTERVAL_MS = 30_000 as const;             // §17.3 — poll every 30 s
const RANK_CACHE_TTL_MS = 30_000 as const;                 // §17.4 — rank position cache 30 s
const BATTLE_SCHEDULE_CACHE_TTL_MS = 60 * 60_000; // §17.4 — schedule cache 60 min
const MAX_JOURNEY_ENTRIES = 50 as const;                   // Timeline — 50 most recent items

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────

export type RankTier = 'baron' | 'viceroy' | 'sovereign' | 'imperator';

export interface ActiveTitle {
  tierId: string;
  geographyId: string;
  geographyName: string;
  geographyEmoji: string;
  cyclesHeld: number;
  cycleReward: number;
  active: boolean;
  heldSinceTs: number | null;
}

export interface SleepSafeConfig {
  baronThreshold: number | null;
  viceroyThreshold: number | null;
  sovereignThreshold: number | null;
  imperatorThreshold: number | null;
  wakeForAny: boolean;
  minWakeAmount: number;
}

export interface UserBadge {
  type: string;
  scopeId: string;
  expiresAt: number;
}

export interface UserCrownData {
  userId: string;
  currentTitles: {
    sector?: ActiveTitle;
    city?: ActiveTitle;
    country?: ActiveTitle;
    world?: ActiveTitle;
  };
  trustScore: number;
  credits: number;
  sleepSafe: SleepSafeConfig;
  activeBadges: UserBadge[];
}

export interface ScoreBreakdown {
  reactionsReceived: number;
  repliesReceived: number;
  repliesSent: number;
  newFollowers: number;
  dmsReceived: number;
  reportsAgainst: number;
  aiRejections: number;
  totalScore: number;
}

export interface TierScoreData {
  tier: RankTier;
  geographyId: string;
  geographyName: string;
  breakdown: ScoreBreakdown;
  lastUpdatedMs: number;
}

export interface RankPosition {
  tier: RankTier;
  geographyId: string;
  position: number;
  delta: number;
  fetchedAtMs: number;
}

export interface FreezeScheduleItem {
  tier: RankTier;
  geographyId: string;
  geographyName: string;
  geographyEmoji: string;
  freezeAtMs: number;
  cycleId: string;
  isSleepWindow: boolean;
}

export interface JourneyEntry {
  entryId: string;
  type: 'badge' | 'title' | 'first_title';
  tier: RankTier | null;
  geographyId: string;
  geographyName: string;
  earnedAtMs: number;
  cycleId: string;
  rankScore: number;
  bidReceived: number | null;
  keptTitle: boolean | null;
  badgeType: string | null;
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

/** Convert Firestore Timestamp or millis number to Unix ms safely (cross-platform). */
function toMs(val: FsTimestamp | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof (val as FsTimestamp).toMillis === 'function') {
    return (val as FsTimestamp).toMillis();
  }
  return null;
}

/**
 * Detect sleep window: freeze time falls between 11pm–7am local device time.
 * PRD §8.2 sleep warning spec.
 */
function isSleepWindowLocal(freezeAtMs: number): boolean {
  const d = new Date(freezeAtMs);
  const localHour = d.getHours();
  return localHour >= 23 || localHour < 7;
}

/** Map Firestore raw tier counter doc to ScoreBreakdown */
function mapScoreBreakdown(raw: DocumentData): ScoreBreakdown {
  const reactions = raw.reactions_received ?? 0;
  const repliesRcv = raw.replies_received ?? 0;
  const repliesSent = raw.replies_sent ?? 0;
  const followers = raw.new_followers ?? 0;
  const dms = raw.dms_received ?? 0;
  const reports = raw.reports_against ?? 0;
  const aiRej = raw.ai_rejections ?? 0;
  const total =
    reactions * 1 +
    repliesRcv * 3 +
    repliesSent * 1 +
    followers * 8 +
    dms * 2 -
    reports * 50 -
    aiRej * 20;
  return {
    reactionsReceived: reactions,
    repliesReceived: repliesRcv,
    repliesSent,
    newFollowers: followers,
    dmsReceived: dms,
    reportsAgainst: reports,
    aiRejections: aiRej,
    totalScore: Math.max(0, total),
  };
}

/** Build an ActiveTitle from a raw current_titles.<scope> sub-object. */
function mapActiveTitle(
  raw: DocumentData | undefined,
  defaultTier: string,
  defaultEmoji: string,
): ActiveTitle | undefined {
  if (!raw) return undefined;
  return {
    tierId: raw.tier_id ?? defaultTier,
    geographyId: raw.geography_id ?? '',
    geographyName: raw.geography_name ?? '',
    geographyEmoji: raw.geography_emoji ?? defaultEmoji,
    cyclesHeld: raw.cycles_held ?? 0,
    cycleReward: raw.cycle_reward ?? 0,
    active: raw.active ?? false,
    heldSinceTs: toMs(raw.held_since_at),
  };
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: User Crown Document (§17.2 — always real-time)
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to the user's crown document in real-time.
 * Fires immediately with cached value, then on every change.
 *
 * @security Firestore rule: `allow read: if isOwner(userId);`
 */
export function subscribeToUserCrownData(
  userId: string,
  onUpdate: (data: UserCrownData) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const ref = firestore().collection('users').doc(userId);

  return ref.onSnapshot(
    (snap) => {
      if (!snap.exists) {
        onError(new Error('user-not-found'));
        return;
      }
      const r = (snap.data() ?? {}) as DocumentData;
      const raw_ss = (r.sleep_safe ?? {}) as DocumentData;
      const titles = (r.current_titles ?? {}) as DocumentData;

      const data: UserCrownData = {
        userId: snap.id,
        currentTitles: {
          sector: mapActiveTitle(titles.sector, 'baron', '🏘️'),
          city: mapActiveTitle(titles.city, 'viceroy', '🏙️'),
          country: mapActiveTitle(titles.country, 'sovereign', '🇮🇳'),
          world: mapActiveTitle(titles.world, 'imperator', '🌍'),
        },
        trustScore: r.trust_score ?? 0,
        credits: r.credits ?? 0,
        sleepSafe: {
          baronThreshold: raw_ss.baron_threshold ?? null,
          viceroyThreshold: raw_ss.viceroy_threshold ?? null,
          sovereignThreshold: raw_ss.sovereign_threshold ?? null,
          imperatorThreshold: raw_ss.imperator_threshold ?? null,
          wakeForAny: raw_ss.wake_for_any ?? false,
          minWakeAmount: raw_ss.min_wake_amount ?? 0,
        },
        activeBadges: Array.isArray(r.active_badges)
          ? r.active_badges.map((b: DocumentData) => ({
              type: b.type ?? '',
              scopeId: b.scope_id ?? '',
              expiresAt: toMs(b.expires_at) ?? 0,
            }))
          : [],
      };

      onUpdate(data);
    },
    (err: Error) => onError(new Error(err.message)),
  );
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: Rank Score Counters (§17.2 — real-time during Battle Hour)
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to the rank score counter document for a specific
 * tier + geography + cycle. Path (valid even-segment doc ref):
 *   /rank_counters/{tier}/{geographyId}/{userId}/cycles/{cycleId}
 */
export function subscribeToRankScore(
  userId: string,
  tier: RankTier,
  geographyId: string,
  cycleId: string,
  onUpdate: (data: TierScoreData) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const counterDocRef = firestore()
    .collection('rank_counters')
    .doc(tier)
    .collection(geographyId)
    .doc(userId)
    .collection('cycles')
    .doc(cycleId);

  return counterDocRef.onSnapshot(
    (snap) => {
      const raw = (snap.exists ? snap.data() : {}) as DocumentData;
      const breakdown = mapScoreBreakdown(raw);
      onUpdate({
        tier,
        geographyId,
        geographyName: raw.geography_name ?? '',
        breakdown,
        lastUpdatedMs: Date.now(),
      });
    },
    (err: Error) => onError(new Error(err.message)),
  );
}

// ──────────────────────────────────────────────────────────────
// POLLING: Rank Position — every 30 seconds (§17.3)
// LAW 9: drift-corrected setTimeout, not plain setInterval
// ──────────────────────────────────────────────────────────────

interface RankPositionCache {
  data: RankPosition;
  fetchedAtMs: number;
}

const rankPositionCache = new Map<string, RankPositionCache>();

/**
 * Polls rank position for a given tier + geography, with 30 s drift-corrected interval.
 * Caches results per §17.4 (30s cache for rank positions).
 *
 * @returns Stop function — call on unmount.
 */
export function pollRankPosition(
  userId: string,
  tier: RankTier,
  geographyId: string,
  cycleId: string,
  onUpdate: (pos: RankPosition) => void,
  onError: (err: Error) => void,
): () => void {
  let stopped = false;
  const cacheKey = `${userId}:${tier}:${geographyId}:${cycleId}`;

  async function fetchOnce(): Promise<void> {
    // Check cache first (30 s TTL)
    const cached = rankPositionCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAtMs < RANK_CACHE_TTL_MS) {
      if (!stopped) onUpdate(cached.data);
      return;
    }

    try {
      // /rank_positions/{tier}/{geographyId}/cycles/{cycleId}/positions/{userId}
      const posRef = firestore()
        .collection('rank_positions')
        .doc(tier)
        .collection(geographyId)
        .doc('cycles')
        .collection(cycleId)
        .doc('positions')
        .collection('users')
        .doc(userId);

      const snap = await posRef.get();

      if (!snap.exists) {
        // User has no position yet in this cycle — not ranked yet
        const pos: RankPosition = {
          tier,
          geographyId,
          position: -1, // -1 = unranked
          delta: 0,
          fetchedAtMs: Date.now(),
        };
        rankPositionCache.set(cacheKey, { data: pos, fetchedAtMs: Date.now() });
        if (!stopped) onUpdate(pos);
        return;
      }

      const raw = (snap.data() ?? {}) as DocumentData;
      const pos: RankPosition = {
        tier,
        geographyId,
        position: raw.position ?? -1,
        delta: raw.delta ?? 0,
        fetchedAtMs: Date.now(),
      };
      rankPositionCache.set(cacheKey, { data: pos, fetchedAtMs: Date.now() });
      if (!stopped) onUpdate(pos);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'rank-position-fetch-failed';
      if (!stopped) onError(new Error(msg));
    }
  }

  // Drift-corrected polling — LAW 9
  let expected = Date.now() + RANK_POLL_INTERVAL_MS;
  let timeoutId: ReturnType<typeof setTimeout>;

  function tick(): void {
    void fetchOnce();
    const drift = Date.now() - expected;
    expected += RANK_POLL_INTERVAL_MS;
    const nextDelay = Math.max(0, RANK_POLL_INTERVAL_MS - drift);
    if (!stopped) {
      timeoutId = setTimeout(tick, nextDelay);
    }
  }

  // Immediate first fetch, then start polling loop
  void fetchOnce();
  timeoutId = setTimeout(tick, RANK_POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearTimeout(timeoutId);
  };
}

// ──────────────────────────────────────────────────────────────
// READ: Battle Schedule — 7 upcoming freeze times (§8.2, §17.3)
// ──────────────────────────────────────────────────────────────

const TIER_EMOJI: Record<RankTier, string> = {
  baron: '🏘️',
  viceroy: '🏙️',
  sovereign: '🇮🇳',
  imperator: '🌍',
};

interface ScheduleCache {
  items: FreezeScheduleItem[];
  fetchedAtMs: number;
}

const scheduleCache = new Map<string, ScheduleCache>();

/**
 * Fetches upcoming freeze schedule for the user's active geographies.
 * Returns up to 7 entries per PRD §8.2. Cached for 60 minutes per §17.4.
 */
export async function fetchBattleSchedule(
  tierGeographies: Partial<Record<RankTier, string>>,
): Promise<FreezeScheduleItem[]> {
  const cacheKey = JSON.stringify(tierGeographies);
  const cached = scheduleCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAtMs < BATTLE_SCHEDULE_CACHE_TTL_MS) {
    return cached.items;
  }

  const allItems: FreezeScheduleItem[] = [];

  // Fetch schedule for each active tier in parallel
  const fetchPromises = Object.entries(tierGeographies).map(
    async ([tier, geographyId]) => {
      if (!geographyId) return;
      try {
        // /schedule/{tier}/{geographyId}/freeze_times  (4 segments → valid doc)
        const schedRef = firestore()
          .collection('schedule')
          .doc(tier)
          .collection(geographyId)
          .doc('freeze_times');

        const snap = await schedRef.get();
        if (!snap.exists) return;

        const raw = (snap.data() ?? {}) as DocumentData;
        const upcoming: Array<{
          freeze_at: FsTimestamp | number;
          cycle_id: string;
          geography_name?: string;
        }> = raw.upcoming ?? [];

        for (const item of upcoming) {
          const freezeAtMs = toMs(item.freeze_at);
          if (!freezeAtMs) continue;
          allItems.push({
            tier: tier as RankTier,
            geographyId,
            geographyName: item.geography_name ?? '',
            geographyEmoji: TIER_EMOJI[tier as RankTier] ?? '📍',
            freezeAtMs,
            cycleId: item.cycle_id,
            isSleepWindow: isSleepWindowLocal(freezeAtMs),
          });
        }
      } catch {
        // Non-fatal: schedule unavailable for this tier
      }
    },
  );

  await Promise.all(fetchPromises);

  // Sort by freeze time ascending, take next 7
  allItems.sort((a, b) => a.freezeAtMs - b.freezeAtMs);
  const next7 = allItems.slice(0, 7);

  scheduleCache.set(cacheKey, { items: next7, fetchedAtMs: Date.now() });
  return next7;
}

// ──────────────────────────────────────────────────────────────
// READ: Crown Journey Timeline (§11 — up to 50 most recent entries)
// ──────────────────────────────────────────────────────────────

/**
 * Fetches the user's crown journey entries — all titles and badges earned.
 * Returns up to 50 most recent entries, sorted oldest → newest.
 */
export async function fetchCrownJourney(userId: string): Promise<JourneyEntry[]> {
  try {
    const snap = await firestore()
      .collection('users')
      .doc(userId)
      .collection('crown_journey')
      .orderBy('earned_at', 'desc')
      .limit(MAX_JOURNEY_ENTRIES)
      .get();

    const entries: JourneyEntry[] = snap.docs.map((d) => {
      const r = (d.data() ?? {}) as DocumentData;
      return {
        entryId: d.id,
        type: r.type ?? 'badge',
        tier: r.tier ?? null,
        geographyId: r.geography_id ?? '',
        geographyName: r.geography_name ?? '',
        earnedAtMs: toMs(r.earned_at) ?? 0,
        cycleId: r.cycle_id ?? '',
        rankScore: r.rank_score ?? 0,
        bidReceived: r.bid_received ?? null,
        keptTitle: r.kept_title ?? null,
        badgeType: r.badge_type ?? null,
      };
    });
    // Reverse so oldest is first (timeline reads left → right)
    return entries.reverse();
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// UTILITY: Clear all caches (useful on logout / user change)
// ──────────────────────────────────────────────────────────────

export function clearRankCaches(): void {
  rankPositionCache.clear();
  scheduleCache.clear();
}

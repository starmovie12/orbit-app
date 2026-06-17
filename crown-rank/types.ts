/**
 * CrowdWorld — Shared TypeScript Types
 * Zero 'any'. Every shape derived from Zod schemas in production.
 * This file is the source of truth for component props and API shapes.
 */

// ── TIER ─────────────────────────────────────────────────────────────────────

export type Tier = 'baron' | 'viceroy' | 'sovereign' | 'imperator';

export const TIER_ORDER: Tier[] = ['baron', 'viceroy', 'sovereign', 'imperator'];

// ── CYCLE PHASE ───────────────────────────────────────────────────────────────

export type CyclePhase = 1 | 2 | 3 | 4 | 5;

export interface CyclePhaseInfo {
  phase: CyclePhase;
  phaseName: string;
  phaseEmoji: string;
  /** ISO timestamp when current phase started */
  phaseStartedAt: string;
  /** ISO timestamp when next phase begins (Battle Hour for phase 1, etc.) */
  nextPhaseAt: string;
  /** ISO timestamp when cycle freeze happens (end of Phase 2) */
  freezeAt: string;
  /** Null until Phase 4 starts */
  auctionEndsAt: string | null;
  /** Null until Phase 5 starts */
  decisionEndsAt: string | null;
  /** Null until Phase 3+ */
  meritWinnerId: string | null;
  /** Null until Phase 4 */
  highestBid: { amount: number; bidderId: string } | null;
  /** Null until Phase 4 */
  baseBidPrice: number | null;
}

// ── RANK ──────────────────────────────────────────────────────────────────────

export type RankMovement = 'up' | 'down' | 'same';

export interface RankCardData {
  tier: Tier;
  geographyId: string;
  /** Human-readable: "Sector 35, Chandigarh" */
  geographyLabel: string;
  /**
   * Null during Phase 1 — rank position is HIDDEN per LAW 1.
   * Always available during Phases 2–5.
   */
  rankPosition: number | null;
  /** Always available — shown even in Phase 1 */
  rankScore: number;
  /** Progress toward next milestone (0–1) */
  progressPercent: number;
  /** Human-readable milestone text */
  milestoneLabel: string;
  /** Current milestone held (if any): "Top 10" | "Top 50" | null */
  milestoneHeld: string | null;
  /** Minutes held at current milestone, or null */
  milestoneHeldSince: number | null;
  /** Movement direction compared to last update */
  movement: RankMovement;
  /** Delta number: ±N positions */
  movementDelta: number;
  cyclePhase: CyclePhaseInfo;
}

// ── USER TITLE ────────────────────────────────────────────────────────────────

export interface UserTitle {
  tier: Tier;
  geographyId: string;
  geographyLabel: string;
  /** Cycles held (consecutive) */
  cyclesHeld: number;
  /** Credits earned per cycle from this title */
  cycleReward: number;
  /** Views on pinned message this cycle */
  pinViews: number | null;
  /** Timestamp ISO of when this title was first acquired in current streak */
  heldSince: string;
}

export type TitleHolderState =
  | { has: true; titles: UserTitle[]; primaryTitle: UserTitle }
  | { has: false };

// ── BID ───────────────────────────────────────────────────────────────────────

export type BidStatus =
  | 'active_winning'
  | 'active_outbid'
  | 'settled_won'
  | 'settled_seller_kept'
  | 'settled_outbid_refunded'
  | 'settled_expired';

export interface BidRecord {
  bidId: string;
  tier: Tier;
  geographyId: string;
  geographyLabel: string;
  cycleId: string;
  amount: number;
  status: BidStatus;
  /** Only for outbid state */
  currentHighBid: number | null;
  /** Only for outbid state: amount above user's bid */
  outbidBy: number | null;
  /** ISO timestamp */
  placedAt: string;
  settledAt: string | null;
  /** Seconds until auction ends (for active bids) */
  auctionEndsIn: number | null;
}

// ── DECISION PROMPT ───────────────────────────────────────────────────────────

export interface DecisionPromptData {
  tier: Tier;
  geographyId: string;
  geographyLabel: string;
  /** Full title string from TITLES constants */
  titleString: string;
  highestBid: {
    amount: number;
    bidderId: string;
    bidderHandle: string;
    bidderTrustScore: number;
  } | null;
  /** Credits user receives if they ACCEPT (92% of bid after 8% fee) */
  acceptAmount: number;
  /** Credits user receives next cycle if they KEEP */
  keepCycleReward: number;
  /** Seconds remaining in Decision Window */
  decisionEndsIn: number;
}

// ── INVASION ──────────────────────────────────────────────────────────────────

export type InvasionRole = 'planner' | 'invitee' | null;

export interface InvasionData {
  invasionId: string;
  plannerHandle: string;
  targetCityId: string;
  targetCityLabel: string;
  banner: string;
  /** ISO timestamp */
  startTime: string;
  /** Seconds until start */
  startsIn: number;
  rsvpGoing: number;
  rsvpMaybe: number;
  rsvpSkip: number;
  warCry: string | null;
  role: InvasionRole;
}

// ── BATTLE SCHEDULE ───────────────────────────────────────────────────────────

export interface FreezeTime {
  tier: Tier;
  geographyId: string;
  geographyLabel: string;
  cycleId: string;
  /** ISO timestamp */
  freezeAt: string;
  /** Seconds until freeze */
  freezeIn: number;
  /** Date label: "TODAY" | "TOMORROW" | "MON" | "+2 DAYS" */
  dateLabel: string;
  /** User's local time string: "8:00 PM IST" */
  localTime: string;
  /** True if freeze falls between 11pm–7am local */
  isSleepWindow: boolean;
}

// ── TIMELINE NODE ─────────────────────────────────────────────────────────────

export type TimelineNodeType = 'badge' | 'title' | 'first_title' | 'current';

export interface TimelineNode {
  nodeId: string;
  type: TimelineNodeType;
  tier: Tier | null;
  label: string;
  geographyLabel: string | null;
  /** ISO date string */
  earnedAt: string;
  /** For tapping — detail sheet data */
  detail: TimelineNodeDetail;
}

export interface TimelineNodeDetail {
  rankScore: number;
  bidReceived: number | null;
  userDecision: 'kept' | 'accepted' | null;
  cycleDurationHeld: number | null; // minutes
  cycleNumber: number;
}

// ── SLEEP SAFE SETTINGS ───────────────────────────────────────────────────────

export interface SleepSafeSettings {
  baronThreshold: number | null;
  viceroyThreshold: number | null;
  sovereignThreshold: number | null;
  imperatorThreshold: number | null;
  wakeForAny: boolean;
  minWakeAmount: number;
}

// ── LEADERBOARD (Rank Screen) ──────────────────────────────────────────────────

export type LeaderboardTab = 'city' | 'city_wars' | 'all_india';
export type ScoreType = 'mayor_score' | 'message_quality';

export interface LeaderboardEntry {
  userId: string;
  handle: string;
  displayName: string;
  /** URL string */
  avatarUrl: string | null;
  /** Initial fallback hash (used to generate consistent gradient) */
  avatarHash: string;
  rankPosition: number;
  score: number;
  /** Formatted: "227.5M" */
  scoreFormatted: string;
  neighbourhood: string;
  level: number;
  vipTier: number | null;
  isCurrentUser: boolean;
  isMysteryVisitor: boolean;
  movement: RankMovement;
  movementDelta: number;
}

export interface LeaderboardState {
  tab: LeaderboardTab;
  scoreType: ScoreType;
  entries: LeaderboardEntry[];
  top3: [LeaderboardEntry, LeaderboardEntry, LeaderboardEntry] | null;
  selfEntry: LeaderboardEntry | null;
  settlementCountdown: number; // seconds
  isLoading: boolean;
  hasError: boolean;
}

// ── ASYNC STATE ───────────────────────────────────────────────────────────────

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T; cachedAt: number }
  | { status: 'error'; error: string; retryable: boolean };

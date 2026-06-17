/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — app/(tabs)/ranks.tsx                                          ║
 * ║  The CROWN tab · Live rank standings, battle cycle, journey timeline   ║
 * ║  Layer: Tab Root Screen (Expo Router)                                  ║
 * ║                                                                        ║
 * ║  States handled:                                                       ║
 * ║    loading   → skeleton cards (shimmer)                                ║
 * ║    aspiring  → "Claim Your Crown" hero + zeroed cards                  ║
 * ║    title-held → golden glow hero (THE signature moment) + live cards   ║
 * ║    error     → inline banner + one-tap retry                           ║
 * ║    offline   → amber banner, stale data shown                          ║
 * ║                                                                        ║
 * ║  Design: LIGHT default — bg.surface white · bg.card cream #F7ECD0 ·   ║
 * ║           fg.brand gold #D4A017 fills · fg.brandText gold[700] text   ║
 * ║           Space Mono on ALL numeric data (rank, score, countdown, %)   ║
 * ║  Signature moment: CrownHeroBanner gold pulse — bold ONLY here        ║
 * ║  WCAG AA: gold text via fg.brandText (gold[700], 5.0:1 on white)      ║
 * ║  Motion: easeOut enters · spring release · reduced-motion opacity-only ║
 * ║                                                                        ║
 * ║  Deps: @/constants/colors · @/constants/animations · AuthContext       ║
 * ║         @/hooks/useHaptics · react-native-reanimated v4               ║
 * ║         lucide-react-native · react-native-safe-area-context           ║
 * ║                                                                        ║
 * ║  Replace path: app/(tabs)/ranks.tsx                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  FadeIn,
  FadeInUp,
  Easing,
} from 'react-native-reanimated';
import {
  Bell,
  Crown,
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  AlertCircle,
  RefreshCw,
  WifiOff,
} from 'lucide-react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  colors,
  typography,
  spacing,
  radii,
  dimensions,
  semanticSuccess,
  semanticError,
} from '@/constants/colors';
import { durations, springConfigs, useReducedMotion } from '@/constants/animations';
import { useHaptics } from '@/hooks/useHaptics';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Tier = 'baron' | 'viceroy' | 'sovereign' | 'imperator';
type Movement = 'up' | 'down' | 'same';
type CyclePhase = 1 | 2 | 3 | 4 | 5 | 6;

interface RankStanding {
  tier: Tier;
  position: number | null;   // null = unranked
  score: number;
  progressPercent: number;   // 0–100 toward milestone
  movement: Movement;
  movementDelta: number;
  geographyLabel: string;
  ptsToNextMilestone: number;
  milestoneLabel: string;
  cyclePhase: CyclePhase;
  freezeInMs: number;        // milliseconds until freeze
  titleHeld: boolean;
  cyclesHeld: number;
}

interface JourneyNode {
  id: string;
  type: 'first_title' | 'title' | 'badge';
  tier?: Tier;
  label: string;
  geographyLabel?: string;
  earnedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — never hardcode these in components
// ═══════════════════════════════════════════════════════════════════════════

const TIER_ORDER: Tier[] = ['baron', 'viceroy', 'sovereign', 'imperator'];

const TIER_META: Record<Tier, { emoji: string; name: string }> = {
  baron:     { emoji: '🏘️', name: 'BARON' },
  viceroy:   { emoji: '🏙️', name: 'VICEROY' },
  sovereign: { emoji: '🏳️', name: 'SOVEREIGN' },
  imperator: { emoji: '🌍', name: 'IMPERATOR' },
};

const CYCLE_PHASES: Record<CyclePhase, { label: string; emoji: string }> = {
  1: { label: 'Dark Tunnel', emoji: '🌑' },
  2: { label: 'Merit War',   emoji: '⚔️' },
  3: { label: 'Spotlight',   emoji: '🔦' },
  4: { label: 'Freeze',      emoji: '🧊' },
  5: { label: 'Auction',     emoji: '🔨' },
  6: { label: 'Decision',    emoji: '⚡' },
};

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA — swap these for real Firestore subscriptions in production
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_STANDINGS: RankStanding[] = [
  {
    tier: 'baron',
    position: 3,
    score: 1240,
    progressPercent: 67,
    movement: 'up',
    movementDelta: 2,
    geographyLabel: 'Sector 7, Delhi',
    ptsToNextMilestone: 180,
    milestoneLabel: 'BARON threshold',
    cyclePhase: 2,
    freezeInMs: (4 * 3600 + 23 * 60) * 1000,
    titleHeld: true,
    cyclesHeld: 3,
  },
  {
    tier: 'viceroy',
    position: 12,
    score: 480,
    progressPercent: 22,
    movement: 'same',
    movementDelta: 0,
    geographyLabel: 'Delhi',
    ptsToNextMilestone: 920,
    milestoneLabel: 'VICEROY threshold',
    cyclePhase: 2,
    freezeInMs: (4 * 3600 + 23 * 60) * 1000,
    titleHeld: false,
    cyclesHeld: 0,
  },
  {
    tier: 'sovereign',
    position: null,
    score: 120,
    progressPercent: 4,
    movement: 'up',
    movementDelta: 1,
    geographyLabel: 'India',
    ptsToNextMilestone: 3200,
    milestoneLabel: 'SOVEREIGN threshold',
    cyclePhase: 1,
    freezeInMs: 6 * 3600 * 1000,
    titleHeld: false,
    cyclesHeld: 0,
  },
  {
    tier: 'imperator',
    position: null,
    score: 40,
    progressPercent: 1,
    movement: 'same',
    movementDelta: 0,
    geographyLabel: 'The World',
    ptsToNextMilestone: 12000,
    milestoneLabel: 'IMPERATOR threshold',
    cyclePhase: 1,
    freezeInMs: 6 * 3600 * 1000,
    titleHeld: false,
    cyclesHeld: 0,
  },
];

const MOCK_JOURNEY: JourneyNode[] = [
  {
    id: 'j1',
    type: 'title',
    tier: 'baron',
    label: 'BARON',
    geographyLabel: 'Sector 7, Delhi',
    earnedAt: new Date(Date.now() - 3 * 86400000),
  },
  {
    id: 'j2',
    type: 'first_title',
    tier: 'baron',
    label: 'First Crown',
    geographyLabel: 'Sector 7, Delhi',
    earnedAt: new Date(Date.now() - 15 * 86400000),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

function fmtScore(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS — all memo'd for list performance
// ═══════════════════════════════════════════════════════════════════════════

// ── LiveCountdown ──────────────────────────────────────────────────────────
// Ticks every second. Space Mono (timer = numeric data, CROWN law).
const LiveCountdown = memo(({ initialMs }: { initialMs: number }) => {
  const [remaining, setRemaining] = useState(initialMs);
  useEffect(() => {
    const id = setInterval(() => setRemaining((p) => Math.max(0, p - 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text style={styles.countdown} allowFontScaling={false}>
      {fmtCountdown(remaining)}
    </Text>
  );
});

// ── MovementBadge ──────────────────────────────────────────────────────────
const MovementBadge = memo(
  ({ movement, delta }: { movement: Movement; delta: number }) => {
    const neutral = movement === 'same' || delta === 0;
    const isUp = movement === 'up' && !neutral;
    const isDown = movement === 'down' && !neutral;

    return (
      <View
        style={[
          styles.movBadge,
          isUp && styles.movUp,
          isDown && styles.movDown,
          neutral && styles.movNeutral,
        ]}
      >
        {isUp   && <TrendingUp   size={10} color={colors.fg.success} strokeWidth={2.5} />}
        {isDown && <TrendingDown size={10} color={colors.fg.error}   strokeWidth={2.5} />}
        {neutral && <Minus       size={10} color={colors.fg.secondary} strokeWidth={2.5} />}
        {!neutral && (
          <Text
            style={[styles.movText, { color: isUp ? colors.fg.success : colors.fg.error }]}
            allowFontScaling={false}
          >
            {delta}
          </Text>
        )}
      </View>
    );
  },
);

// ── ProgressBar ────────────────────────────────────────────────────────────
// Animates fill width from 0 → percent on mount. Gold fill + soft sheen.
const ProgressBar = memo(({ percent }: { percent: number }) => {
  const reduced = useReducedMotion();
  const pct = useSharedValue(0);

  useEffect(() => {
    pct.value = reduced
      ? percent
      : withDelay(
          280,
          withTiming(percent, {
            duration: durations.slow,
            easing: Easing.out(Easing.cubic),
          }),
        );
  }, [percent, reduced]);

  const fillStyle  = useAnimatedStyle(() => ({ width: `${pct.value}%` as any }));
  const sheenStyle = useAnimatedStyle(() => ({
    width: `${pct.value}%` as any,
    opacity: pct.value > 5 ? 0.3 : 0,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
      <Animated.View style={[styles.progressSheen, sheenStyle]} />
    </View>
  );
});

// ── SkeletonCard ───────────────────────────────────────────────────────────
const SkeletonCard = memo(({ index }: { index: number }) => {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 650, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [reduced]);

  const skelStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      entering={FadeIn.delay(index * 55).duration(180)}
      style={[styles.cardWrap]}
    >
      <Animated.View style={[styles.rankCard, styles.skeletonCard, skelStyle]}>
        <View style={[styles.skelRow, { width: '45%' }]} />
        <View style={[styles.skelRow, { width: '25%', marginTop: spacing.md }]} />
        <View style={[styles.skelRow, { width: '70%', marginTop: spacing.xs }]} />
        <View style={[styles.skelRow, { width: '90%', marginTop: spacing.md }]} />
      </Animated.View>
    </Animated.View>
  );
});

// ── TierRankCard ───────────────────────────────────────────────────────────
// One per tier (Baron → Imperator). Press → scale 0.97, spring back.
const TierRankCard = memo(
  ({ standing, index }: { standing: RankStanding; index: number }) => {
    const haptics  = useHaptics();
    const reduced  = useReducedMotion();
    const scale    = useSharedValue(1);
    const meta     = TIER_META[standing.tier];
    const phase    = CYCLE_PHASES[standing.cyclePhase];

    const pressStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const onPressIn = useCallback(() => {
      haptics.impactLight();
      scale.value = reduced
        ? 1
        : withTiming(0.97, { duration: durations.instant, easing: Easing.out(Easing.quad) });
    }, [reduced, haptics]);

    const onPressOut = useCallback(() => {
      scale.value = withSpring(1, springConfigs.springStiff);
    }, []);

    return (
      <Animated.View
        entering={
          reduced
            ? FadeIn.duration(200)
            : FadeInUp.delay(index * 75).springify().damping(20).stiffness(200)
        }
        style={pressStyle}
      >
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${meta.name} standings — ${standing.geographyLabel}`}
          style={[styles.rankCard, standing.titleHeld && styles.rankCardHeld]}
        >
          {/* ── Header: tier chip + geography ────────────────────────────── */}
          <View style={styles.cardHeader}>
            <View style={styles.tierChip}>
              <Text style={styles.tierEmoji}>{meta.emoji}</Text>
              <Text style={styles.tierName} allowFontScaling={false}>
                {meta.name}
              </Text>
              {standing.titleHeld && (
                <Crown size={11} color={colors.fg.brand} strokeWidth={2.5} />
              )}
            </View>
            <Text style={styles.geoText} numberOfLines={1}>
              {standing.geographyLabel}
            </Text>
          </View>

          {/* ── Rank number + score + movement ───────────────────────────── */}
          <View style={styles.rankRow}>
            <View>
              <View style={styles.rankNumRow}>
                {standing.position != null ? (
                  <>
                    <Text style={styles.rankHash} allowFontScaling={false}>#</Text>
                    <Text style={styles.rankNum} allowFontScaling={false}>
                      {standing.position}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.rankUnranked}>Unranked</Text>
                )}
              </View>
              <Text style={styles.scoreText} allowFontScaling={false}>
                {fmtScore(standing.score)} pts
              </Text>
            </View>
            <View style={styles.rankRight}>
              <MovementBadge movement={standing.movement} delta={standing.movementDelta} />
              <ChevronRight size={18} color={colors.fg.tertiary} strokeWidth={1.5} />
            </View>
          </View>

          {/* ── Progress bar + labels ─────────────────────────────────────── */}
          <View style={styles.progressBlock}>
            <ProgressBar percent={standing.progressPercent} />
            <View style={styles.progressMeta}>
              <Text style={styles.progressPct} allowFontScaling={false}>
                {standing.progressPercent}%
              </Text>
              <Text style={styles.progressNote} numberOfLines={1}>
                {standing.ptsToNextMilestone.toLocaleString()} pts → {standing.milestoneLabel}
              </Text>
            </View>
          </View>

          {/* ── Phase footer: emoji · label · live countdown ─────────────── */}
          <View style={styles.phaseFooter}>
            <Text style={styles.phaseEmoji}>{phase.emoji}</Text>
            <Text style={styles.phaseLabel} numberOfLines={1}>
              Phase {standing.cyclePhase} · {phase.label}
            </Text>
            <View style={styles.freezeInfo}>
              <Clock size={11} color={colors.fg.secondary} strokeWidth={1.5} />
              <LiveCountdown initialMs={standing.freezeInMs} />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

// ── CrownHeroBanner ───────────────────────────────────────────────────────
// ★ THE SIGNATURE MOMENT on this screen.
//   title-held  → cream card + golden glow pulse, title name large in Syne
//   aspiring    → quiet call-to-action with best standing info
const CrownHeroBanner = memo(({ standings }: { standings: RankStanding[] }) => {
  const reduced    = useReducedMotion();
  const heldTitles = useMemo(() => standings.filter((s) => s.titleHeld), [standings]);
  const hasTitle   = heldTitles.length > 0;

  // Gold glow — breathes when title held, stays off otherwise
  const glowOpacity = useSharedValue(0);
  useEffect(() => {
    if (!hasTitle) { glowOpacity.value = withTiming(0, { duration: durations.normal }); return; }
    if (reduced)   { glowOpacity.value = 0.14; return; }
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.22, { duration: durations.ripple, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.08, { duration: durations.ripple, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [hasTitle, reduced]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // ── Aspiration state ────────────────────────────────────────────────────
  if (!hasTitle) {
    if (standings.length === 0) return null;
    const best = standings.reduce((b, s) => (s.score > b.score ? s : b), standings[0]);
    const meta = TIER_META[best.tier];
    return (
      <Animated.View entering={FadeIn.duration(300)} style={[styles.hero, styles.heroAspire]}>
        <Text style={styles.heroAspireEmoji}>⚔️</Text>
        <Text style={styles.heroAspireTitle} allowFontScaling={false}>Claim Your Crown</Text>
        <Text style={styles.heroAspireSub}>
          {best.position != null
            ? `You're #${best.position} in ${best.geographyLabel}`
            : `You're unranked in ${best.geographyLabel}`}
        </Text>
        <View style={styles.heroAspireHint}>
          <Text style={styles.heroAspireHintText}>
            {best.ptsToNextMilestone.toLocaleString()} more pts →{' '}
            <Text style={styles.heroAspireHintBold}>{meta.name}</Text>
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Title-held state (the golden moment) ────────────────────────────────
  const primary = heldTitles[0];
  const meta    = TIER_META[primary.tier];

  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(300) : FadeInUp.springify().damping(22).stiffness(180)}
      style={[styles.hero, styles.heroHeld]}
    >
      {/* Breathing glow — absolute, behind content, rounded to match card */}
      <Animated.View
        pointerEvents="none"
        style={[styles.heroGlow, glowStyle]}
      />

      <View style={styles.heroContent}>
        <Text style={styles.heroEmoji}>{meta.emoji}</Text>

        <Text style={styles.heroEyebrow} allowFontScaling={false}>
          YOU HOLD THE CROWN
        </Text>

        <Text style={styles.heroTitleName} allowFontScaling={false}>
          {meta.name}
        </Text>

        <Text style={styles.heroGeo}>{primary.geographyLabel}</Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal} allowFontScaling={false}>
              {primary.cyclesHeld}
            </Text>
            <Text style={styles.heroStatLbl}>cycles held</Text>
          </View>
          {heldTitles.length > 1 && (
            <>
              <View style={styles.heroStatDiv} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal} allowFontScaling={false}>
                  {heldTitles.length}
                </Text>
                <Text style={styles.heroStatLbl}>active titles</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

// ── JourneyTimeline ────────────────────────────────────────────────────────
const JourneyTimeline = memo(({ nodes }: { nodes: JourneyNode[] }) => {
  if (nodes.length === 0) return null;
  return (
    <View>
      <Text style={styles.secTitle}>Crown Journey</Text>
      <Text style={styles.secSub}>Your milestones, permanently recorded</Text>

      <View style={styles.timeline}>
        {nodes.map((node, i) => {
          const isLast  = i === nodes.length - 1;
          const isFirst = node.type === 'first_title';
          const meta    = node.tier ? TIER_META[node.tier] : null;

          return (
            <View key={node.id} style={styles.tlRow}>
              {/* Connector column */}
              <View style={styles.tlLeft}>
                <View style={[styles.tlDot, isFirst && styles.tlDotFirst]}>
                  {isFirst ? (
                    <Crown size={11} color={colors.bg.surface} strokeWidth={2.5} />
                  ) : (
                    <Star size={8} color={colors.fg.brandText} fill={colors.fg.brandText} />
                  )}
                </View>
                {!isLast && <View style={styles.tlLine} />}
              </View>

              {/* Content column */}
              <View style={styles.tlBody}>
                <View style={styles.tlTopRow}>
                  <Text style={styles.tlLabel}>
                    {meta ? `${meta.emoji} ${meta.name}` : node.label}
                    {node.geographyLabel ? ` · ${node.geographyLabel}` : ''}
                  </Text>
                  <Text style={styles.tlDate}>{fmtDate(node.earnedAt)}</Text>
                </View>
                {isFirst && (
                  <Text style={styles.tlFirstTag}>🏆 First title earned</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ── HeaderBar ──────────────────────────────────────────────────────────────
function HeaderBar() {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <Text style={styles.crownGlyph} accessibilityElementsHidden>
          👑
        </Text>
        <Text style={styles.wordmark} allowFontScaling={false}>
          CROWN
        </Text>
      </View>
      <Pressable
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={8}
      >
        <Bell size={20} color={colors.fg.secondary} strokeWidth={1.5} />
      </Pressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function RanksScreen() {
  const { user } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [offline,    setOffline]    = useState(false);
  const [standings,  setStandings]  = useState<RankStanding[]>([]);
  const [journey,    setJourney]    = useState<JourneyNode[]>([]);

  // ── Load data (replace timeout with real Firestore subscription) ─────────
  const loadData = useCallback(async (silent = false) => {
    try {
      setError(null);
      if (!silent) setLoading(true);

      // ─ TODO: subscribeToUserRankStandings(user.uid, setStandings) ─────────
      await new Promise<void>((r) => setTimeout(r, 900));
      setStandings(MOCK_STANDINGS);
      setJourney(MOCK_JOURNEY);
    } catch {
      setError("Couldn't load your standings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <HeaderBar />
        <View style={styles.loadingWrap}>
          {/* Hero skeleton */}
          <View style={[styles.skeletonHero]}>
            <View style={[styles.skelRow, { width: '30%', alignSelf: 'center' }]} />
            <View style={[styles.skelRow, { width: '50%', alignSelf: 'center', marginTop: spacing.sm }]} />
            <View style={[styles.skelRow, { width: '40%', alignSelf: 'center', marginTop: spacing.xs }]} />
          </View>
          {/* Card skeletons */}
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} index={i} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HeaderBar />

      {/* ── Offline banner ────────────────────────────────────────────────── */}
      {offline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color={colors.fg.warning} strokeWidth={2} />
          <Text style={styles.offlineText}>
            You're offline · Showing last known standings
          </Text>
        </View>
      )}

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={14} color={colors.fg.error} strokeWidth={2} />
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
          <Pressable
            onPress={() => loadData()}
            style={styles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Retry loading standings"
            hitSlop={8}
          >
            <RefreshCw size={13} color={colors.fg.brandText} strokeWidth={2} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.fg.brand}
            colors={[colors.fg.brand]}
          />
        }
      >
        {/* 🌟 Signature moment — must be the only loud element on screen */}
        <View style={styles.heroWrap}>
          <CrownHeroBanner standings={standings} />
        </View>

        {/* ── Standings section ─────────────────────────────────────────── */}
        <View style={styles.secHeaderWrap}>
          <Text style={styles.secTitle}>Your Standings</Text>
          <Text style={styles.secSub}>All 4 scopes · tap for full breakdown</Text>
        </View>

        {standings.map((s, i) => (
          <View key={s.tier} style={styles.cardWrap}>
            <TierRankCard standing={s} index={i} />
          </View>
        ))}

        {/* ── Crown Journey ─────────────────────────────────────────────── */}
        {journey.length > 0 && (
          <View style={styles.journeySection}>
            <JourneyTimeline nodes={journey} />
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — tokens only · zero raw hex (CROWN LAW 2)
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({

  // ── Screen ────────────────────────────────────────────────────────────────
  safe: {
    flex: 1,
    backgroundColor: colors.bg.surface,
  },

  // ── Header (56px, hairline bottom) ───────────────────────────────────────
  header: {
    height: dimensions.headerHeight,   // 56
    paddingHorizontal: spacing.base,   // 16
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crownGlyph: {
    fontSize: 22,
  },
  wordmark: {
    ...typography.title,       // 22/700 Syne
    letterSpacing: -0.4,
    color: colors.fg.brandSubtle,  // gold[800] — 6.4:1 on white, AA
  },
  iconBtn: {
    width: dimensions.btnIcon,    // 44
    height: dimensions.btnIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Banners ───────────────────────────────────────────────────────────────
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.subtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  offlineText: {
    ...typography.bodySmall,
    color: colors.fg.warning,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.subtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.fg.error,
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg.card,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border.default,
    minWidth: dimensions.touch?.minIos ?? 44,
    minHeight: dimensions.touch?.minIos ?? 44,
    justifyContent: 'center',
  },
  retryText: {
    ...typography.label,
    color: colors.fg.brandText,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  // ── Hero Banner ───────────────────────────────────────────────────────────
  heroWrap: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  hero: {
    borderRadius: radii.lg,       // 16
    borderWidth: 1,
    overflow: 'visible',
  },
  // Aspiration (no title yet) — calm, motivating
  heroAspire: {
    backgroundColor: colors.bg.subtle,
    borderColor: colors.border.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  heroAspireEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  heroAspireTitle: {
    ...typography.headline,    // 18/700 Syne
    color: colors.fg.primary,
    marginBottom: spacing.xs,
  },
  heroAspireSub: {
    ...typography.body,
    color: colors.fg.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  heroAspireHint: {
    backgroundColor: colors.bg.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  heroAspireHintText: {
    ...typography.bodySmall,
    color: colors.fg.secondary,
  },
  heroAspireHintBold: {
    color: colors.fg.brandText,
    fontWeight: '700',
  },

  // Title-held (signature moment) — cream base, gold glow on top
  heroHeld: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.cardEmphasis,  // gold[600] 2px emphasis
    ...colors.shadow.tier2,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.fg.brand,
    borderRadius: radii.lg,  // rounds the glow to match card
    zIndex: 0,
  },
  heroContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    zIndex: 1,
    position: 'relative',
  },
  heroEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  heroEyebrow: {
    ...typography.label,    // 12/600
    color: colors.fg.brandText,
    letterSpacing: 2.5,
    marginBottom: spacing.xs,
  },
  heroTitleName: {
    ...typography.display,  // 28/700 Syne — override size below
    fontSize: 34,
    letterSpacing: -0.6,
    color: colors.fg.brandSubtle,   // gold[800] — 6.4:1, AA
    marginBottom: spacing.xs,
  },
  heroGeo: {
    ...typography.body,
    color: colors.fg.secondary,
    marginBottom: spacing.lg,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatVal: {
    ...typography.statValue,    // Space Mono numeric token
    fontSize: 26,
    color: colors.fg.primary,
  },
  heroStatLbl: {
    ...typography.caption,
    color: colors.fg.secondary,
    marginTop: spacing.xs,
  },
  heroStatDiv: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.default,
  },

  // ── Section headers ───────────────────────────────────────────────────────
  secHeaderWrap: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  secTitle: {
    ...typography.title,    // 22/700 Syne
    color: colors.fg.primary,
  },
  secSub: {
    ...typography.bodySmall,
    color: colors.fg.secondary,
    marginTop: spacing.xs,
  },

  // ── Rank Cards ────────────────────────────────────────────────────────────
  cardWrap: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  rankCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.md,      // 12
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: spacing.base,
    ...colors.shadow.tier1,
  },
  rankCardHeld: {
    borderColor: colors.border.cardEmphasis,
    ...colors.shadow.tier2,
  },

  // Card header row (tier chip + geo label)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xl,      // pill
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tierEmoji: {
    fontSize: 14,
  },
  tierName: {
    ...typography.label,          // 12/600
    color: colors.fg.brandText,   // gold[700] — AA on white
    letterSpacing: 0.8,
  },
  geoText: {
    ...typography.bodySmall,
    color: colors.fg.secondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },

  // Rank number + score
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rankNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  rankHash: {
    ...typography.bodySmall,
    color: colors.fg.tertiary,
    fontWeight: '600',
  },
  rankNum: {
    ...typography.statValue,     // Space Mono
    fontSize: 30,
    color: colors.fg.primary,
    lineHeight: 34,
  },
  rankUnranked: {
    ...typography.body,
    color: colors.fg.tertiary,
    fontStyle: 'italic',
  },
  scoreText: {
    ...typography.caption,
    color: colors.fg.secondary,
    marginTop: 2,
  },
  rankRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  // Movement badge
  movBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.sm,
    minHeight: 22,
    minWidth: 22,
    justifyContent: 'center',
  },
  movUp:      { backgroundColor: semanticSuccess.bg },
  movDown:    { backgroundColor: semanticError.bg },
  movNeutral: { backgroundColor: colors.bg.subtle },
  movText: {
    ...typography.caption,
    fontWeight: '700',
  },

  // Progress bar
  progressBlock: {
    marginBottom: spacing.md,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    backgroundColor: colors.fg.brand,    // gold fill
    borderRadius: radii.pill,
  },
  progressSheen: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    backgroundColor: colors.fg.celebrate, // gold[400] sheen
    borderRadius: radii.pill,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPct: {
    ...typography.label,
    color: colors.fg.brandText,
  },
  progressNote: {
    ...typography.caption,
    color: colors.fg.secondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },

  // Phase footer
  phaseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  phaseEmoji: {
    fontSize: 13,
  },
  phaseLabel: {
    ...typography.caption,
    color: colors.fg.secondary,
    flex: 1,
  },
  freezeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    ...typography.caption,
    fontFamily: 'SpaceMono_400Regular',  // Space Mono (timer = numeric data)
    color: colors.fg.warning,
    letterSpacing: 0.5,
  },

  // ── Journey Timeline ──────────────────────────────────────────────────────
  journeySection: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xl,
  },
  timeline: {
    marginTop: spacing.lg,
  },
  tlRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tlLeft: {
    width: 28,
    alignItems: 'center',
  },
  tlDot: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.cardEmphasis,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotFirst: {
    backgroundColor: colors.fg.brand,
    borderColor: colors.fg.brand,
  },
  tlLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.xs,
    minHeight: spacing.lg,
  },
  tlBody: {
    flex: 1,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
  tlTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tlLabel: {
    ...typography.body,
    color: colors.fg.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  tlDate: {
    ...typography.caption,
    color: colors.fg.secondary,
  },
  tlFirstTag: {
    ...typography.caption,
    color: colors.fg.brandText,
    marginTop: spacing.xs,
  },

  // ── Loading / Skeleton ────────────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    padding: spacing.base,
    paddingTop: spacing.lg,
  },
  skeletonHero: {
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.lg,
    height: 140,
    marginBottom: spacing.xl,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  skeletonCard: {
    minHeight: 130,
    gap: spacing.sm,
  },
  skelRow: {
    height: 13,
    backgroundColor: colors.bg.surface,
    borderRadius: radii.base,
    opacity: 0.7,
  },
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NEXT STEPS (for the founder):
 *
 * 1. Replace MOCK_STANDINGS + MOCK_JOURNEY with real Firestore subscriptions
 *    from your crown-rank/api layer. The types (RankStanding, JourneyNode)
 *    are already defined — write adapter functions like the old ranks.tsx did.
 *
 * 2. Wire offline detection:
 *    import NetInfo from '@react-native-community/netinfo';
 *    useEffect(() => {
 *      return NetInfo.addEventListener(s => setOffline(!s.isConnected));
 *    }, []);
 *
 * 3. The font families (Syne_700Bold, SpaceMono_400Regular) must be loaded
 *    in app/_layout.tsx via useFonts(). If not already done:
 *    npx expo install @expo-google-fonts/syne @expo-google-fonts/space-mono
 *    and add them to your useFonts() call.
 * ─────────────────────────────────────────────────────────────────────────────
 */

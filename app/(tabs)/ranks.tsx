// app/(tabs)/crown.tsx
/*
╔═════════════════════════════════════════════════════════════════════════════════════════╗
║ COMPONENT: CrownScreen (CROWN Tab - Live Rank Progress, Status & Bidding Center)        ║
║ LAYER: Screen / Tab Root                                                                ║
║ VARIANTS: Default, Loading, Error, Offline, Empty                                       ║
║ DEPENDENCIES: Reanimated, lucide-react-native, expo-haptics, @/constants/* ║
║ PRD ALIGNMENT: v5.1 (Rank System, 5h Cycle, Open World Migration, Digital Invasions,    ║
║                Triple Tier, Sleep-Safe Bidding)                                         ║
║ DESIGN SYSTEM: OMEGA V5.2 Pixel-Sovereign (Light cream, Gold accent, Space Mono)        ║
╚═════════════════════════════════════════════════════════════════════════════════════════╝
*/

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  RefreshControl,
  Platform
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Trophy,
  Swords,
  Timer,
  ChevronDown,
  Info,
  History,
  TrendingUp,
  ShieldAlert,
  WifiOff,
  AlertCircle,
  Crown,
  Shield,
  Zap,
  Globe,
  MapPin,
  Clock
} from 'lucide-react-native';

// --- DESIGN TOKENS ---
// Assuming these exist in @/constants/colors and animations per Designer Prompt
import {
  colors,
  typography,
  spacing,
  radii,
  dimensions,
  semanticSuccess,
  semanticError,
  semanticWarning,
  semanticInfo,
} from '@/constants/colors';
import {
  durations,
  springConfigs,
  useReducedMotion,
  useHaptics,
} from '@/constants/animations';
import { TITLES } from '@/constants/titles';

// --- SHARED COMPONENTS ---
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { ListItem } from '@/components/ListItem';
import { EmptyState } from '@/components/EmptyState';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPES & MOCK DATA ENGINE (Simulating Production Backend)
// ─────────────────────────────────────────────────────────────────────────────

type CyclePhase = 'DARK_TUNNEL' | 'BATTLE_HOUR' | 'MERIT_FREEZE' | 'AUCTION' | 'DECISION';

interface RankData {
  id: string;
  tier: 'Sector' | 'City' | 'Country' | 'World';
  location: string;
  rank: number | null;
  targetRank: string;
  progress: number; // 0 to 1
  score: number;
  targetScore: number;
  statusText: string;
  actionText: string;
  isSecured: boolean;
  colorHex: string;
}

interface BidData {
  id: string;
  title: string;
  amount: number;
  status: 'WON' | 'LOST' | 'PENDING' | 'REFUNDED';
  opponent?: string;
  timeAgo: string;
}

interface InvasionData {
  id: string;
  targetCity: string;
  role: 'PLANNER' | 'INVITEE' | 'DEFENDER';
  startTime: Date;
  status: 'COUNTDOWN' | 'ACTIVE';
  participantCount: number;
}

// Personalized Mock Data for user (Location: Chandigarh, Name: Noor Aalam)
const MOCK_RANKS: RankData[] = [
  {
    id: 'sector_35',
    tier: 'Sector',
    location: 'Sector 35',
    rank: 3,
    targetRank: 'Rank 1 (BARON)',
    progress: 0.92,
    score: 412,
    targetScore: 450,
    statusText: 'In striking distance of BARON',
    actionText: 'Need ~38 reactions to overtake #1',
    isSecured: false,
    colorHex: '#CD7F32', // Bronze for Sector
  },
  {
    id: 'city_chandigarh',
    tier: 'City',
    location: 'Chandigarh',
    rank: 84,
    targetRank: 'Top 50',
    progress: 0.65,
    score: 1240,
    targetScore: 1800,
    statusText: 'Top 100 Secured',
    actionText: 'Need 560 more points for Top 50',
    isSecured: true,
    colorHex: '#C0C0C0', // Silver for City
  },
  {
    id: 'country_india',
    tier: 'Country',
    location: 'India',
    rank: 14205,
    targetRank: 'Top 10K',
    progress: 0.3,
    score: 8400,
    targetScore: 25000,
    statusText: 'Climbing steadily',
    actionText: 'Top 10K requires major viral push',
    isSecured: false,
    colorHex: '#FFD700', // Gold for Country
  },
  {
    id: 'world_global',
    tier: 'World',
    location: 'Global',
    rank: null,
    targetRank: 'Top 100K',
    progress: 0.05,
    score: 12500,
    targetScore: 250000,
    statusText: 'Keep going!',
    actionText: 'Not ranked yet. Every reaction counts.',
    isSecured: false,
    colorHex: '#E5E4E2', // Platinum for World
  },
];

const MOCK_BIDS: BidData[] = [
  {
    id: 'b1',
    title: 'Chandigarh — Mayor (VICEROY) Seat',
    amount: 12500,
    status: 'LOST',
    opponent: '@Rahul_C',
    timeAgo: '2h ago',
  },
  {
    id: 'b2',
    title: 'Sector 35 — BARON Seat',
    amount: 800,
    status: 'WON',
    timeAgo: 'Yesterday',
  },
  {
    id: 'b3',
    title: 'Mumbai — Mayor (VICEROY) Seat',
    amount: 45000,
    status: 'REFUNDED',
    timeAgo: '3 days ago',
  },
];

const MOCK_INVASIONS: InvasionData[] = [
  {
    id: 'inv1',
    targetCity: 'London',
    role: 'INVITEE',
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours from now
    status: 'COUNTDOWN',
    participantCount: 42,
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. CUSTOM HOOKS (Logic & State Management)
// ─────────────────────────────────────────────────────────────────────────────

function useCycleTimer() {
  const [phase, setPhase] = useState<CyclePhase>('BATTLE_HOUR');
  const [timeLeft, setTimeLeft] = useState(47 * 60); // 47 minutes in seconds

  // Simulate real-time countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          setPhase('MERIT_FREEZE');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return { phase, timeLeft, formattedTime: formatTime(timeLeft) };
}

function useCrownData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [data, setData] = useState<any>(null);

  // Simulate network fetch
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    setOffline(false);
    
    setTimeout(() => {
      // Simulate success
      setData({ ranks: MOCK_RANKS, bids: MOCK_BIDS, invasions: MOCK_INVASIONS });
      setLoading(false);
    }, 1200);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, error, offline, data, refetch: fetchData };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SUBCOMPONENTS (Building the UI blocks)
// ─────────────────────────────────────────────────────────────────────────────

// --- 3A. STATE BANNERS (Offline / Error) ---
const StateBanner = ({ type, message, onRetry }: { type: 'offline' | 'error', message: string, onRetry?: () => void }) => {
  const isError = type === 'error';
  return (
    <Animated.View entering={SlideInDown} exiting={FadeOut} style={[styles.bannerContainer, isError ? styles.bannerError : styles.bannerOffline]}>
      {isError ? <AlertCircle size={20} color={colors.bg.surface} /> : <WifiOff size={20} color={colors.bg.surface} />}
      <Text style={styles.bannerText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.bannerRetry}>
          <Text style={styles.bannerRetryText}>Retry</Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

// --- 3B. LOADING SKELETON (5 States Design Rule) ---
const CrownSkeleton = () => {
  const pulse = useSharedValue(0.5);
  
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View style={[styles.skeletonHero, animatedStyle]} />
      <View style={{ height: spacing.xl }} />
      <Animated.View style={[styles.skeletonTitle, animatedStyle]} />
      <Animated.View style={[styles.skeletonCard, animatedStyle]} />
      <Animated.View style={[styles.skeletonCard, animatedStyle]} />
      <Animated.View style={[styles.skeletonCard, animatedStyle]} />
    </View>
  );
};

// --- 3C. SIGNATURE MOMENT: Battle Cycle Hero ---
const BattleCycleHero = ({ phase, formattedTime }: { phase: CyclePhase, formattedTime: string }) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (phase === 'BATTLE_HOUR') {
      pulse.value = withRepeat(withSequence(
        withTiming(1.2, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ), -1, true);
    }
  }, [phase]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.2], [1, 0.5]),
  }));

  const getPhaseText = () => {
    switch (phase) {
      case 'DARK_TUNNEL': return '🌒 DARK TUNNEL';
      case 'BATTLE_HOUR': return '⚔️ BATTLE HOUR';
      case 'MERIT_FREEZE': return '❄️ MERIT FREEZE';
      case 'AUCTION': return '🔨 AUCTION LIVE';
      case 'DECISION': return '⚖️ DECISION PENDING';
    }
  };

  const getSubText = () => {
    if (phase === 'BATTLE_HOUR') return 'Ranks are live. React, reply, climb.';
    if (phase === 'DARK_TUNNEL') return 'Ranks hidden. Build your score in the dark.';
    return 'Cycle frozen. Bidding determines the Crown.';
  };

  return (
    <View style={styles.heroContainer}>
      <View style={styles.heroHeader}>
        <Animated.View style={[styles.liveIndicator, dotStyle]} />
        <Text style={styles.heroPhaseText}>{getPhaseText()}</Text>
      </View>
      <Text style={styles.heroTimerText}>{formattedTime}</Text>
      <Text style={styles.heroSubText}>{getSubText()}</Text>
      
      {/* Visual Progress Bar for Cycle */}
      <View style={styles.heroProgressBarContainer}>
        <View style={[styles.heroProgressBarFill, { width: '85%' }]} />
        <View style={[styles.heroProgressMarker, { left: '85%' }]} />
      </View>
    </View>
  );
};

// --- 3D. RANK TIER CARD (Expandable Formula & Progress) ---
const RankTierCard = React.memo(({ data }: { data: RankData }) => {
  const [expanded, setExpanded] = useState(false);
  const haptics = useHaptics();
  const reducedMotion = useReducedMotion();

  const toggleExpand = useCallback(() => {
    haptics.impactLight();
    setExpanded((prev) => !prev);
  }, [haptics]);

  const expandStyle = useAnimatedStyle(() => {
    return {
      height: expanded ? withSpring(110, springConfigs.springStiff) : withTiming(0, { duration: durations.fast }),
      opacity: expanded ? withTiming(1, { duration: durations.fast }) : withTiming(0, { duration: durations.instant }),
      marginTop: expanded ? spacing.md : 0,
      overflow: 'hidden',
    };
  }, [expanded]);

  const chevronStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    return {
      transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: 200 }) }],
    };
  }, [expanded, reducedMotion]);

  return (
    <Pressable
      onPress={toggleExpand}
      style={({ pressed }) => [
        styles.cardContainer,
        pressed && !reducedMotion && { transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.tierColorIndicator, { backgroundColor: data.colorHex }]} />
          <Text style={styles.tierTitle}>{data.tier} — {data.location}</Text>
        </View>
        <View style={styles.rankBadge}>
          <Text style={styles.rankLabel}>Rank</Text>
          <Text style={styles.rankValue}>
            {data.rank ? `#${data.rank.toLocaleString()}` : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${data.progress * 100}%` },
            data.isSecured && { backgroundColor: semanticSuccess.bg },
          ]}
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.actionText}>{data.actionText}</Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={colors.fg.tertiary} />
        </Animated.View>
      </View>

      {/* Expandable Formula Breakdown per PRD §11A.12 */}
      <Animated.View style={expandStyle}>
        <View style={styles.formulaBox}>
          <View style={styles.formulaHeaderRow}>
            <Info size={14} color={colors.fg.brandText} />
            <Text style={styles.formulaBold}>Rank Score Formula</Text>
          </View>
          <View style={styles.formulaGrid}>
            <View style={styles.formulaCol}>
              <Text style={styles.formulaItem}>Reaction: <Text style={styles.formulaNum}>+1</Text></Text>
              <Text style={styles.formulaItem}>Reply given: <Text style={styles.formulaNum}>+1</Text></Text>
            </View>
            <View style={styles.formulaCol}>
              <Text style={styles.formulaItem}>Reply rcvd: <Text style={styles.formulaNum}>+3</Text></Text>
              <Text style={styles.formulaItem}>New follower: <Text style={styles.formulaNum}>+8</Text></Text>
            </View>
          </View>
          <View style={styles.formulaCurrentScore}>
            <Text style={styles.formulaItem}>Current Score: <Text style={styles.formulaNumHero}>{data.score}</Text></Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

// --- 3E. DIGITAL INVASION BANNER (PRD §11A.13.2) ---
const InvasionBanner = ({ invasion }: { invasion: InvasionData }) => {
  return (
    <View style={styles.invasionContainer}>
      <View style={styles.invasionHeader}>
        <ShieldAlert size={20} color={semanticWarning.fg} />
        <Text style={styles.invasionTitle}>Active Invasion Plan</Text>
      </View>
      <Text style={styles.invasionText}>
        Squad targeting <Text style={styles.invasionTarget}>{invasion.targetCity}</Text> chat.
      </Text>
      <View style={styles.invasionFooter}>
        <Text style={styles.invasionTime}>T-minus 2h 14m</Text>
        <Text style={styles.invasionCount}>{invasion.participantCount} raiders ready</Text>
      </View>
    </View>
  );
};

// --- 3F. TRIPLE TIER DISPLAY (PRD §11A.10) ---
const TripleTierStatus = () => {
  return (
    <View style={styles.tripleTierContainer}>
      <Text style={styles.sectionTitle}>Triple Tier Status</Text>
      <Text style={styles.sectionSubtitle}>Hold Sector, City, and Country simultaneously.</Text>
      
      <View style={styles.tierCircles}>
        <View style={[styles.tierCircle, styles.tierCircleActive]}>
          <Text style={styles.tierCircleText}>BARON</Text>
        </View>
        <View style={styles.tierLine} />
        <View style={styles.tierCircle}>
          <Text style={styles.tierCircleText}>MAYOR</Text>
        </View>
        <View style={styles.tierLine} />
        <View style={styles.tierCircle}>
          <Text style={styles.tierCircleText}>SOVEREIGN</Text>
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CrownScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const { loading, error, offline, data, refetch } = useCrownData();
  const { phase, formattedTime } = useCycleTimer();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const renderContent = () => {
    if (loading) return <CrownSkeleton />;
    
    if (error || offline || !data) {
      return (
        <EmptyState 
          icon="alert-circle" 
          title="Data Unavailable" 
          message="Could not load your live rank data. Check connection." 
          actionLabel="Retry" 
          onAction={refetch} 
        />
      );
    }

    return (
      <View style={styles.contentWrapper}>
        
        {/* HERO: The Signature Moment - Battle Cycle Timer */}
        <BattleCycleHero phase={phase} formattedTime={formattedTime} />

        {/* INVASION TRACKER (Only shows if active plans exist) */}
        {data.invasions && data.invasions.length > 0 && (
          <View style={styles.section}>
            {data.invasions.map((inv: InvasionData) => (
              <InvasionBanner key={inv.id} invasion={inv} />
            ))}
          </View>
        )}

        {/* SECTION: LIVE RANK PROGRESS */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <TrendingUp size={20} color={colors.fg.primary} />
            <Text style={styles.sectionTitle}>Live Rank Progress</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Your standing in the current 5h cycle. Only #1 claims the title.
          </Text>

          <View style={styles.cardsWrapper}>
            {data.ranks.map((tierData: RankData) => (
              <RankTierCard key={tierData.id} data={tierData} />
            ))}
          </View>
        </View>

        {/* SECTION: TRIPLE TIER (The ultimate achievable goal) */}
        <View style={styles.section}>
          <TripleTierStatus />
        </View>

        {/* SECTION: BIDDING HUB / RECENT BIDS */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <History size={20} color={colors.fg.primary} />
            <Text style={styles.sectionTitle}>Recent Bids</Text>
          </View>
          
          <View style={styles.listContainer}>
            {data.bids.map((bid: BidData) => (
              <ListItem
                key={bid.id}
                title={bid.title}
                subtitle={`${bid.status === 'LOST' ? `Outbid by ${bid.opponent}` : bid.status === 'REFUNDED' ? 'Auction ended' : 'Decision Pending'} · ${bid.timeAgo}`}
                trailing={
                  <Text style={[
                    styles.bidAmount,
                    bid.status === 'WON' && { color: semanticSuccess.fg },
                    bid.status === 'LOST' && { color: semanticError.fg },
                    bid.status === 'REFUNDED' && { color: colors.fg.tertiary },
                  ]}>
                    {bid.amount.toLocaleString()} Cr
                  </Text>
                }
                onPress={() => {}}
              />
            ))}
          </View>
          
          <View style={styles.actionWrapper}>
            <Button variant="secondary" size="md" label="View Full History" fullWidth onPress={() => {}} />
          </View>
          
          {/* Sleep-Safe Bidding Settings link */}
          <Pressable style={styles.sleepSafeLink}>
            <Shield size={14} color={colors.fg.secondary} />
            <Text style={styles.sleepSafeText}>Configure Sleep-Safe Auto-Accept</Text>
          </Pressable>
        </View>
        
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {offline && <StateBanner type="offline" message="You are offline. Showing cached ranks." />}
      {error && <StateBanner type="error" message={error} onRetry={refetch} />}

      {/* HEADER: Large title variant, collapses on scroll, built per Designer Prompt */}
      <Header variant="large-title" title="Crown" scrollY={scrollY} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.fg.brand} />}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: dimensions.bottomNavH + insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STYLES (Enforcing OMEGA V5.2 Visual Rubric: Whitespace, Contrast, Depth)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.surface, // Pure white light mode base
  },
  scrollContent: {
    paddingHorizontal: spacing.base, // 16px horizontal breathing room
    paddingTop: spacing.base,
  },
  contentWrapper: {
    gap: spacing.xl, // Generous section spacing (24px)
  },
  section: {
    // Container for sections
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs, // 4px
  },
  sectionTitle: {
    ...typography.headline, // Syne 18/700
    color: colors.fg.primary,
    marginLeft: spacing.sm, // 8px
  },
  sectionSubtitle: {
    ...typography.bodySmall, // Inter 13/400
    color: colors.fg.secondary,
    marginBottom: spacing.md, // 12px
    marginLeft: 28, // Visually aligns with text after icon
  },
  cardsWrapper: {
    gap: spacing.md, // 12px between cards
  },

  // --- STATE BANNERS ---
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingTop: Platform.OS === 'ios' ? 40 : spacing.sm, // Rough safe area handle for absolute banner
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  bannerOffline: {
    backgroundColor: semanticWarning.bg,
  },
  bannerError: {
    backgroundColor: semanticError.bg,
  },
  bannerText: {
    ...typography.caption,
    color: colors.bg.surface,
    marginLeft: spacing.sm,
    flex: 1,
  },
  bannerRetry: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.sm,
  },
  bannerRetryText: {
    ...typography.label,
    color: colors.bg.surface,
  },

  // --- SKELETON LOADER ---
  skeletonContainer: {
    gap: spacing.xl,
  },
  skeletonHero: {
    height: 140,
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.lg,
  },
  skeletonTitle: {
    height: 24,
    width: 150,
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  skeletonCard: {
    height: 90,
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },

  // --- BATTLE CYCLE HERO (Signature Moment) ---
  heroContainer: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    alignItems: 'center',
    ...colors.shadow.tier2, // Soft depth
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: semanticWarning.fg, // Amber for LIVE
    marginRight: spacing.sm,
  },
  heroPhaseText: {
    ...typography.label, // Inter 12/600 uppercase
    color: semanticWarning.fg,
    letterSpacing: 1,
  },
  heroTimerText: {
    ...typography.balanceHero, // Space Mono 40/700
    color: colors.fg.primary,
    marginVertical: spacing.xs,
  },
  heroSubText: {
    ...typography.bodySmall,
    color: colors.fg.secondary,
    marginBottom: spacing.lg,
  },
  heroProgressBarContainer: {
    height: 6,
    width: '100%',
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.pill,
    position: 'relative',
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.fg.brand,
    borderRadius: radii.pill,
  },
  heroProgressMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.bg.surface,
  },

  // --- RANK TIER CARD STYLES ---
  cardContainer: {
    backgroundColor: colors.bg.card, // Cream background per DNA
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: spacing.base, // 16px internal padding
    ...colors.shadow.tier1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierColorIndicator: {
    width: 4,
    height: 16,
    borderRadius: radii.pill,
    marginRight: spacing.sm,
  },
  tierTitle: {
    ...typography.label,
    color: colors.fg.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rankBadge: {
    alignItems: 'flex-end',
  },
  rankLabel: {
    ...typography.micro,
    color: colors.fg.secondary,
    textTransform: 'uppercase',
  },
  rankValue: {
    ...typography.statValue, // Space Mono 18/700
    color: colors.fg.primary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.05)', // subtle track on cream
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.fg.brand, // Brand gold fill
    borderRadius: radii.pill,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionText: {
    ...typography.caption,
    color: colors.fg.secondary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  formulaBox: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: radii.sm,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  formulaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  formulaBold: {
    ...typography.label,
    color: colors.fg.brandText, // Contrast-safe gold on light
    marginLeft: spacing.xs,
  },
  formulaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  formulaCol: {
    flex: 1,
    gap: 4,
  },
  formulaItem: {
    ...typography.caption,
    color: colors.fg.secondary,
  },
  formulaNum: {
    ...typography.statValue,
    fontSize: 12,
    color: colors.fg.primary,
  },
  formulaCurrentScore: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  formulaNumHero: {
    ...typography.statValue,
    fontSize: 14,
    color: colors.fg.brandText,
  },

  // --- DIGITAL INVASION BANNER ---
  invasionContainer: {
    backgroundColor: '#FFF5F5', // Pale crimson tint
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FED7D7',
    padding: spacing.base,
  },
  invasionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  invasionTitle: {
    ...typography.label,
    color: semanticWarning.fg,
    marginLeft: spacing.sm,
    textTransform: 'uppercase',
  },
  invasionText: {
    ...typography.body,
    color: colors.fg.primary,
    marginBottom: spacing.sm,
  },
  invasionTarget: {
    fontWeight: '700',
  },
  invasionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invasionTime: {
    ...typography.statValue,
    fontSize: 14,
    color: semanticWarning.fg,
  },
  invasionCount: {
    ...typography.caption,
    color: colors.fg.secondary,
  },

  // --- TRIPLE TIER UI ---
  tripleTierContainer: {
    backgroundColor: colors.bg.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  tierCircles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    width: '100%',
  },
  tierCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bg.subtle,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierCircleActive: {
    backgroundColor: '#FFF9EC',
    borderColor: colors.fg.brand,
  },
  tierCircleText: {
    ...typography.micro,
    fontSize: 8,
    fontWeight: '800',
    color: colors.fg.tertiary,
  },
  tierLine: {
    width: 30,
    height: 2,
    backgroundColor: colors.border.default,
  },

  // --- BID LIST STYLES ---
  listContainer: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  bidAmount: {
    ...typography.statValue, // Space Mono 14/700
    fontSize: 14,
  },
  actionWrapper: {
    // Container for View Full History button
  },
  sleepSafeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  sleepSafeText: {
    ...typography.caption,
    color: colors.fg.secondary,
    marginLeft: spacing.xs,
    textDecorationLine: 'underline',
  },
});

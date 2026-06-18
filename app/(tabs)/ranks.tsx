// app/(tabs)/ranks.tsx
/*
╔═════════════════════════════════════════════════════════════════════════════════════════╗
║ COMPONENT: CrownScreen (CROWN Tab - Live Rank Progress, Status & Bidding Center)        ║
║ LAYER: Screen / Tab Root                                                                ║
║ PLATFORM: React Native (Expo) - Universal Web/Mobile Safe                               ║
║ PRD ALIGNMENT: v3.2 (Rank System, 5h Cycle, Triple Tier, Chandigarh Sector Ecosystem)   ║
║ DESIGN SYSTEM: OMEGA V5.2 Pixel-Sovereign (Light cream, Gold accent, Space Mono)        ║
╚═════════════════════════════════════════════════════════════════════════════════════════╝
*/

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Platform,
  Dimensions,
  ActivityIndicator,
  LayoutChangeEvent
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
  Easing
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
  Clock,
  ArrowRight,
  Gavel
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 1. OMEGA V5.2 DESIGN TOKENS (INLINED TO PREVENT IMPORT ERRORS)
// ─────────────────────────────────────────────────────────────────────────────

const colors = {
  bg: {
    surface: '#FFFFFF', // Pure white base
    card: '#F7ECD0',    // Cream cards per designer prompt
    subtle: '#F4F4F5',
    overlay: 'rgba(0,0,0,0.4)',
  },
  fg: {
    primary: '#18181B',
    secondary: '#52525B',
    tertiary: '#A1A1AA',
    brand: '#D4A017',   // Strict brand gold
    brandText: '#B8860B', // Darker gold for text accessibility (WCAG AA)
    inverse: '#FFFFFF',
    error: '#EF4444',
  },
  border: {
    default: '#E4E4E7',
    card: '#E8DFB8',
    subtle: '#F4F4F5',
  },
  shadow: {
    tier1: Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }
    }),
    tier2: Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 6 },
      web: { boxShadow: '0px 8px 16px rgba(0,0,0,0.08)' }
    }),
  }
};

const typography = {
  headline: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 30 },
  title: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '700' as const, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }, // Space Mono fallback
  balanceHero: { fontSize: 36, fontWeight: '800' as const, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: -1 },
};

const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48 };
const radii = { sm: 8, md: 12, lg: 16, pill: 999 };
const dimensions = { bottomNavH: 80, headerH: 60 };

// ─────────────────────────────────────────────────────────────────────────────
// 2. MOCK DATA ENGINE (Simulating Real-Time Chandigarh Ecosystem)
// ─────────────────────────────────────────────────────────────────────────────

type CyclePhase = 'DARK_TUNNEL' | 'BATTLE_HOUR' | 'MERIT_FREEZE' | 'AUCTION' | 'DECISION';

const MOCK_RANKS = [
  {
    id: 'sec_35',
    tier: 'Sector',
    location: 'Sector 35',
    rank: 2,
    targetRank: 'Rank 1 (BARON)',
    progress: 0.94,
    score: 842,
    targetScore: 900,
    statusText: 'In striking distance of BARON',
    actionText: 'Need ~58 reactions to overtake Noor Aalam',
    isSecured: false,
    colorHex: '#CD7F32',
  },
  {
    id: 'city_chd',
    tier: 'City',
    location: 'Chandigarh',
    rank: 12,
    targetRank: 'Top 10 (VICEROY)',
    progress: 0.85,
    score: 14500,
    targetScore: 18000,
    statusText: 'Top 20 Secured',
    actionText: 'Push required for Mayor Seat eligibility',
    isSecured: true,
    colorHex: '#C0C0C0',
  },
  {
    id: 'country_in',
    tier: 'Country',
    location: 'India',
    rank: 8405,
    targetRank: 'Top 1000',
    progress: 0.15,
    score: 45000,
    targetScore: 300000,
    statusText: 'Climbing steadily',
    actionText: 'Need mass viral push across cities',
    isSecured: false,
    colorHex: '#FFD700',
  }
];

const MOCK_BIDS = [
  { id: 'b1', title: 'Sector 35 — BARON Seat', amount: 1500, status: 'WON', opponent: '', timeAgo: '2h ago' },
  { id: 'b2', title: 'Chandigarh — VICEROY Seat', amount: 85000, status: 'PENDING', opponent: '@Aman_7', timeAgo: 'Live Now' },
  { id: 'b3', title: 'Mohali — BARON Seat', amount: 1200, status: 'LOST', opponent: '@SimranK', timeAgo: '1d ago' },
];

const MOCK_INVASIONS = [
  { id: 'inv1', targetCity: 'Panchkula', role: 'PLANNER', startTime: new Date(Date.now() + 1000 * 60 * 60 * 2), status: 'COUNTDOWN', participantCount: 128 }
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. INLINE COMPONENT SYSTEM (Fixes the "Undefined" Component Errors)
// ─────────────────────────────────────────────────────────────────────────────

// --- INLINE HEADER ---
const InlineHeader = ({ title, scrollY }: { title: string, scrollY: Animated.SharedValue<number> }) => {
  const insets = useSafeAreaInsets();
  
  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 50], [10, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
      borderBottomWidth: interpolate(scrollY.value, [40, 50], [0, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={[styles.inlineHeaderContainer, { paddingTop: insets.top || 20 }]}>
      <Animated.View style={[styles.inlineHeaderBg, headerStyle]} />
      <Text style={styles.inlineHeaderTitle}>{title}</Text>
    </View>
  );
};

// --- INLINE BUTTON ---
const InlineButton = ({ label, onPress, variant = 'primary', icon: Icon }: any) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.96); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
    >
      <Animated.View style={[
        styles.inlineBtn,
        variant === 'primary' ? styles.inlineBtnPrimary : styles.inlineBtnSecondary,
        animatedStyle
      ]}>
        {Icon && <Icon size={16} color={variant === 'primary' ? colors.fg.inverse : colors.fg.primary} style={{ marginRight: 8 }} />}
        <Text style={[
          styles.inlineBtnText,
          variant === 'primary' ? { color: colors.fg.inverse } : { color: colors.fg.primary }
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

// --- INLINE LIST ITEM ---
const InlineListItem = ({ title, subtitle, trailing, onPress }: any) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.inlineListItem,
      pressed && { backgroundColor: colors.bg.subtle }
    ]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.inlineListItemTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.inlineListItemSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={{ marginLeft: spacing.base }}>
        {trailing}
      </View>
    </Pressable>
  );
};

// --- INLINE EMPTY STATE ---
const InlineEmptyState = ({ title, message, onAction }: any) => (
  <View style={styles.inlineEmptyContainer}>
    <View style={styles.inlineEmptyIconBox}>
      <AlertCircle size={32} color={colors.fg.tertiary} />
    </View>
    <Text style={styles.inlineEmptyTitle}>{title}</Text>
    <Text style={styles.inlineEmptyMessage}>{message}</Text>
    {onAction && <InlineButton label="Retry Connection" onPress={onAction} />}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. CUSTOM HOOKS (Timer & Data Simulation)
// ─────────────────────────────────────────────────────────────────────────────

function useCycleTimer() {
  const [phase, setPhase] = useState<CyclePhase>('BATTLE_HOUR');
  const [timeLeft, setTimeLeft] = useState(47 * 60);

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

  return { phase, formattedTime: formatTime(timeLeft), rawSeconds: timeLeft };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CROWN-SPECIFIC SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const BattleCycleHero = ({ phase, formattedTime, rawSeconds }: any) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 800, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) })
      ), -1, true
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.3], [1, 0.4]),
  }));

  const progressWidth = `${Math.min(100, ((47 * 60 - rawSeconds) / (47 * 60)) * 100)}%`;

  return (
    <View style={styles.heroContainer}>
      <View style={styles.heroHeader}>
        <Animated.View style={[styles.liveIndicator, dotStyle]} />
        <Text style={styles.heroPhaseText}>⚔️ {phase.replace('_', ' ')}</Text>
      </View>
      <Text style={styles.heroTimerText}>{formattedTime}</Text>
      <Text style={styles.heroSubText}>Ranks are live. React, reply, climb.</Text>
      
      <View style={styles.heroProgressBarContainer}>
        <View style={[styles.heroProgressBarFill, { width: progressWidth as any }]} />
        <View style={[styles.heroProgressMarker, { left: '85%' }]} />
      </View>
    </View>
  );
};

const RankTierCard = React.memo(({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(false);
  const expandHeight = useSharedValue(0);

  const toggleExpand = useCallback(() => {
    setExpanded(!expanded);
    expandHeight.value = withSpring(expanded ? 0 : 120, { damping: 15, stiffness: 100 });
  }, [expanded]);

  const expandStyle = useAnimatedStyle(() => ({
    height: expandHeight.value,
    opacity: interpolate(expandHeight.value, [0, 100], [0, 1]),
    marginTop: expandHeight.value > 10 ? spacing.md : 0,
    overflow: 'hidden',
  }));

  return (
    <Pressable onPress={toggleExpand} style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.tierColorIndicator, { backgroundColor: data.colorHex }]} />
          <Text style={styles.tierTitle}>{data.tier} — {data.location}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.rankLabel}>Rank</Text>
          <Text style={styles.rankValue}>#{data.rank}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${data.progress * 100}%` }]} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.actionText}>{data.actionText}</Text>
        <ChevronDown size={18} color={colors.fg.tertiary} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </View>

      <Animated.View style={expandStyle}>
        <View style={styles.formulaBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Info size={14} color={colors.fg.brandText} />
            <Text style={styles.formulaBold}>Rank Score Formula</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.formulaItem}>Reaction: <Text style={styles.formulaNum}>+1</Text></Text>
              <Text style={styles.formulaItem}>Reply given: <Text style={styles.formulaNum}>+1</Text></Text>
            </View>
            <View>
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. MAIN SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CrownScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [loading, setLoading] = useState(true);
  const { phase, formattedTime, rawSeconds } = useCycleTimer();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.fg.brand} />
        <Text style={{ marginTop: 16, color: colors.fg.secondary, ...typography.label }}>Connecting to CROWN Servers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <InlineHeader title="Crown" scrollY={scrollY} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: dimensions.bottomNavH + insets.bottom + spacing.xxl, paddingTop: insets.top + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          
          <BattleCycleHero phase={phase} formattedTime={formattedTime} rawSeconds={rawSeconds} />

          {/* INVASION BANNER */}
          <View style={styles.invasionContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <ShieldAlert size={18} color="#EF4444" />
              <Text style={styles.invasionTitle}>Active Digital Invasion</Text>
            </View>
            <Text style={styles.invasionText}>Squad targeting <Text style={{ fontWeight: '800' }}>Panchkula</Text> ecosystem.</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ ...typography.statValue, fontSize: 13, color: '#EF4444' }}>T-MINUS 2H 14M</Text>
              <Text style={{ ...typography.caption, color: '#EF4444' }}>128 Raiders Ready</Text>
            </View>
          </View>

          {/* RANK PROGRESS */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <TrendingUp size={20} color={colors.fg.primary} />
              <Text style={styles.sectionTitle}>Live Rank Progress</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Your standing in the current 5h cycle. Only #1 claims the title.</Text>
            <View style={{ gap: spacing.md }}>
              {MOCK_RANKS.map((tierData) => (
                <RankTierCard key={tierData.id} data={tierData} />
              ))}
            </View>
          </View>

          {/* TRIPLE TIER VISUALIZATION */}
          <View style={styles.tripleTierContainer}>
            <Text style={styles.sectionTitle}>Triple Tier Status</Text>
            <Text style={styles.sectionSubtitle}>Hold Sector, City, and Country simultaneously.</Text>
            <View style={styles.tierCircles}>
              <View style={[styles.tierCircle, styles.tierCircleActive]}><Text style={styles.tierCircleText}>BARON</Text></View>
              <View style={styles.tierLine} />
              <View style={styles.tierCircle}><Text style={styles.tierCircleText}>MAYOR</Text></View>
              <View style={styles.tierLine} />
              <View style={styles.tierCircle}><Text style={styles.tierCircleText}>SOV</Text></View>
            </View>
          </View>

          {/* BIDDING HUB */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Gavel size={20} color={colors.fg.primary} />
              <Text style={styles.sectionTitle}>Bidding Hub</Text>
            </View>
            <View style={styles.listContainer}>
              {MOCK_BIDS.map((bid) => (
                <InlineListItem
                  key={bid.id}
                  title={bid.title}
                  subtitle={`${bid.status} ${bid.opponent ? `· vs ${bid.opponent}` : ''}`}
                  trailing={<Text style={{ ...typography.statValue, color: bid.status === 'WON' ? '#10B981' : bid.status === 'LOST' ? '#EF4444' : colors.fg.brand }}>{bid.amount} Cr</Text>}
                  onPress={() => {}}
                />
              ))}
            </View>
            <InlineButton label="View Full Auction History" variant="secondary" />
          </View>

        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROBUST STYLESHEET
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.surface },
  scrollContent: { paddingHorizontal: spacing.base },
  contentWrapper: { gap: spacing.xl },
  section: { paddingBottom: spacing.sm },
  
  // Header
  inlineHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, height: 100, justifyContent: 'flex-end', paddingBottom: 12, paddingHorizontal: 20 },
  inlineHeaderBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.95)', borderBottomColor: colors.border.default },
  inlineHeaderTitle: { ...typography.headline, zIndex: 101 },

  // Typography
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { ...typography.title, color: colors.fg.primary, marginLeft: 8 },
  sectionSubtitle: { ...typography.bodySmall, color: colors.fg.secondary, marginLeft: 28, marginBottom: 16 },

  // Hero
  heroContainer: { backgroundColor: colors.bg.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border.default, padding: spacing.xl, alignItems: 'center', ...colors.shadow.tier2 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
  heroPhaseText: { ...typography.label, color: '#EF4444', letterSpacing: 1 },
  heroTimerText: { ...typography.balanceHero, color: colors.fg.primary, marginVertical: 4 },
  heroSubText: { ...typography.bodySmall, color: colors.fg.secondary, marginBottom: 24 },
  heroProgressBarContainer: { height: 6, width: '100%', backgroundColor: colors.bg.subtle, borderRadius: radii.pill, overflow: 'hidden' },
  heroProgressBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.fg.brand, borderRadius: radii.pill },
  heroProgressMarker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.bg.surface },

  // Cards
  cardContainer: { backgroundColor: colors.bg.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.card, padding: spacing.base, ...colors.shadow.tier1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  tierColorIndicator: { width: 4, height: 16, borderRadius: radii.pill, marginRight: 8 },
  tierTitle: { ...typography.label, color: colors.fg.primary },
  rankLabel: { fontSize: 10, fontWeight: '700', color: colors.fg.secondary, textTransform: 'uppercase' },
  rankValue: { ...typography.statValue, color: colors.fg.primary },
  progressTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: radii.pill, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: colors.fg.brand, borderRadius: radii.pill },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { ...typography.caption, color: colors.fg.secondary, flex: 1, paddingRight: 8 },
  
  // Formula Expanded Box
  formulaBox: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: radii.sm, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  formulaBold: { ...typography.label, color: colors.fg.brandText, marginLeft: 6 },
  formulaItem: { fontSize: 12, color: colors.fg.secondary, marginBottom: 4 },
  formulaNum: { ...typography.statValue, fontSize: 12, color: colors.fg.primary },
  formulaCurrentScore: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  formulaNumHero: { ...typography.statValue, fontSize: 14, color: colors.fg.brandText },

  // Invasion Banner
  invasionContainer: { backgroundColor: '#FEF2F2', borderRadius: radii.md, borderWidth: 1, borderColor: '#FECACA', padding: 16 },
  invasionTitle: { ...typography.label, color: '#EF4444', marginLeft: 8 },
  invasionText: { ...typography.body, color: '#991B1B' },

  // Triple Tier
  tripleTierContainer: { backgroundColor: colors.bg.surface, padding: 24, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center' },
  tierCircles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, width: '100%' },
  tierCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.bg.subtle, borderWidth: 2, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  tierCircleActive: { backgroundColor: '#FFF9EC', borderColor: colors.fg.brand },
  tierCircleText: { fontSize: 10, fontWeight: '800', color: colors.fg.tertiary },
  tierLine: { width: 30, height: 2, backgroundColor: colors.border.default },

  // Bidding Hub
  listContainer: { backgroundColor: colors.bg.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, overflow: 'hidden', marginBottom: 16 },

  // Inline Components
  inlineBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  inlineBtnPrimary: { backgroundColor: colors.fg.brand },
  inlineBtnSecondary: { backgroundColor: colors.bg.subtle, borderWidth: 1, borderColor: colors.border.default },
  inlineBtnText: { ...typography.label, letterSpacing: 0.5 },
  
  inlineListItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, alignItems: 'center' },
  inlineListItemTitle: { ...typography.body, fontWeight: '600', color: colors.fg.primary, marginBottom: 2 },
  inlineListItemSub: { ...typography.bodySmall, color: colors.fg.secondary },
  
  inlineEmptyContainer: { padding: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.subtle, borderRadius: radii.md },
  inlineEmptyIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  inlineEmptyTitle: { ...typography.title, color: colors.fg.primary, marginBottom: 8 },
  inlineEmptyMessage: { ...typography.bodySmall, color: colors.fg.secondary, textAlign: 'center', marginBottom: 24 },
});

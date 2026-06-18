// app/(tabs)/crown.tsx
/*
╔═════════════════════════════════════════════════════════════════════════════════════════╗
║ COMPONENT: CrownScreen (CROWN Tab - Live Rank Progress & Status Center)                 ║
║ LAYER: Screen / Tab Root                                                                ║
║ VARIANTS: Exhaustive (Live Ranks, Battle Cycle, Bid History, Sleep-Safe, Triple Tier)   ║
║ DEPENDENCIES: Reanimated, lucide-react-native, @/constants/*, @/components/* ║
║ WCAG: AA Contrast verified. Space Mono applied to all numerics.                         ║
╚═════════════════════════════════════════════════════════════════════════════════════════╝
*/

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
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
  Moon,
  ShieldAlert,
  Star,
  Crown,
  EyeOff
} from 'lucide-react-native';

// --- TOKENS (Strictly from constants) ---
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

// --- COMPONENTS ---
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { ListItem } from '@/components/ListItem';
import { EmptyState } from '@/components/EmptyState';

// ============================================================================
// TYPES & MOCK DATA (PRD §8.1, §8.8, §11A.10, §11A.12)
// ============================================================================

type CyclePhase = 'DARK_TUNNEL' | 'BATTLE_HOUR' | 'MERIT_FREEZE' | 'AUCTION' | 'DECISION' | 'SETTLED';

interface RankData {
  id: string;
  tier: string;
  location: string;
  rank: number | null;
  score: number;
  target: string;
  progress: number;
  statusText: string;
  actionText: string;
  isSecured: boolean;
}

// Data customized to the user's active context (Chandigarh)
const MOCK_RANK_DATA: RankData[] = [
  {
    id: 'sector',
    tier: TITLES.SECTOR, // 'BARON'
    location: 'Sector 35',
    rank: 3,
    score: 412,
    target: 'Top 1',
    progress: 0.92,
    statusText: 'Almost there',
    actionText: 'Need 18 more reactions for #1',
    isSecured: false,
  },
  {
    id: 'city',
    tier: TITLES.CITY, // 'Mayor (VICEROY)'
    location: 'Chandigarh',
    rank: 124,
    score: 1840,
    target: 'Top 100',
    progress: 0.85,
    statusText: '15% away from Top 100',
    actionText: 'Need 192 more reactions to enter Top 100',
    isSecured: false,
  },
  {
    id: 'country',
    tier: TITLES.COUNTRY, // 'SOVEREIGN'
    location: 'India',
    rank: 18994,
    score: 3200,
    target: 'Top 10K',
    progress: 0.4,
    statusText: 'Climbing steadily',
    actionText: 'Need 5,400 more reactions for Top 10K',
    isSecured: false,
  },
  {
    id: 'world',
    tier: TITLES.WORLD, // 'IMPERATOR'
    location: 'Global',
    rank: null,
    score: 3200,
    target: 'Top 100K',
    progress: 0.05,
    statusText: 'Keep going!',
    actionText: 'Not in Top 100K yet. Every reaction counts.',
    isSecured: false,
  },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// 1. RANK TIER CARD (PRD §11A.12)
const RankTierCard = React.memo(({ data, currentPhase }: { data: RankData, currentPhase: CyclePhase }) => {
  const [expanded, setExpanded] = useState(false);
  const haptics = useHaptics();
  const reducedMotion = useReducedMotion();

  // PRD §8.1: In Dark Tunnel, rankings are hidden.
  const isDarkTunnel = currentPhase === 'DARK_TUNNEL';

  const toggleExpand = useCallback(() => {
    haptics.impactLight();
    setExpanded((prev) => !prev);
  }, [haptics]);

  const expandStyle = useAnimatedStyle(() => {
    return {
      height: expanded ? withSpring(100, springConfigs.springStiff) : withTiming(0, { duration: durations.fast }),
      opacity: expanded ? withTiming(1, { duration: durations.fast }) : withTiming(0, { duration: durations.instant }),
      marginTop: expanded ? spacing.md : 0,
      overflow: 'hidden',
    };
  }, [expanded]);

  const chevronStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    return {
      transform: [{ rotate: withSpring(expanded ? '180deg' : '0deg', springConfigs.springStiff) }],
    };
  }, [expanded, reducedMotion]);

  // Animated Progress Bar Fill
  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(isDarkTunnel ? 0 : data.progress * 100, { duration: 1000 });
  }, [data.progress, isDarkTunnel]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  return (
    <Pressable
      onPress={toggleExpand}
      style={({ pressed }) => [
        styles.cardContainer,
        pressed && !reducedMotion && { transform: [{ scale: 0.98 }] },
        pressed && reducedMotion && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.tierTitle}>
            {data.tier} — {data.location}
          </Text>
          <Text style={styles.scoreLabel}>Score: <Text style={styles.scoreValue}>{data.score.toLocaleString()}</Text></Text>
        </View>
        <View style={styles.rankBadge}>
          <Text style={styles.rankLabel}>Rank</Text>
          {isDarkTunnel ? (
            <View style={styles.darkTunnelBadge}>
              <EyeOff size={14} color={colors.fg.tertiary} />
              <Text style={styles.darkTunnelText}>HIDDEN</Text>
            </View>
          ) : (
            <Text style={[styles.rankValue, data.rank === 1 && { color: semanticSuccess.fg }]}>
              {data.rank ? `#${data.rank.toLocaleString()}` : '—'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.progressTrack}>
        {!isDarkTunnel && (
          <Animated.View
            style={[
              styles.progressFill,
              progressStyle,
              data.isSecured && { backgroundColor: semanticSuccess.bg },
            ]}
          />
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.statusText}>
          {isDarkTunnel ? 'Dark Tunnel active. Keep posting to build score.' : data.actionText}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={16} color={colors.fg.tertiary} />
        </Animated.View>
      </View>

      <Animated.View style={expandStyle}>
        <View style={styles.formulaBox}>
          <Info size={14} color={colors.fg.brandText} style={styles.formulaIcon} />
          <Text style={styles.formulaText}>
            <Text style={styles.formulaBold}>Rank Score Formula:</Text>{'\n'}
            Reaction = +1 · Reply written = +1{'\n'}
            Reply received = +3 · New follower = +8{'\n'}
            <Text style={{ color: semanticError.fg }}>Report against you = -50</Text>
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

// 2. CYCLE BANNER (PRD §8.1)
const CycleBanner = ({ currentPhase }: { currentPhase: CyclePhase }) => {
  // Dynamically render UI based on the 5-hour cycle phase
  let icon = <Timer size={24} color={colors.fg.primary} />;
  let title = 'Cycle Active';
  let timeRemaining = '00:00';
  let subtext = '';
  let bgColor = colors.bg.surface;
  let borderColor = colors.border.default;

  switch (currentPhase) {
    case 'DARK_TUNNEL':
      icon = <Moon size={24} color={colors.fg.tertiary} />;
      title = 'Dark Tunnel';
      timeRemaining = '1h 47m';
      subtext = 'Next: Battle Hour';
      break;
    case 'BATTLE_HOUR':
      icon = <Swords size={24} color={semanticWarning.fg} />;
      title = 'BATTLE HOUR';
      timeRemaining = '47 min left';
      subtext = 'Live rankings are visible. Fight for #1.';
      bgColor = colors.bg.card; // Slight highlight
      borderColor = semanticWarning.border;
      break;
    case 'MERIT_FREEZE':
    case 'AUCTION':
      icon = <Trophy size={24} color={colors.fg.brand} />;
      title = 'AUCTION LIVE';
      timeRemaining = '12 min left';
      subtext = 'Bidding is open for #1 seats.';
      bgColor = colors.bg.subtle;
      borderColor = colors.fg.brand;
      break;
    case 'DECISION':
      icon = <ShieldAlert size={24} color={semanticSuccess.fg} />;
      title = 'DECISION PHASE';
      timeRemaining = '09:42';
      subtext = 'Merit Winners are choosing to keep titles or accept money.';
      break;
  }

  return (
    <View style={[styles.cycleBanner, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.cycleHeader}>
        {icon}
        <Text style={[styles.cyclePhaseTitle, currentPhase === 'BATTLE_HOUR' && { color: semanticWarning.fg }]}>
          {title}
        </Text>
      </View>
      <Text style={styles.cycleTimer}>{timeRemaining}</Text>
      <Text style={styles.cycleSubtext}>{subtext}</Text>
    </View>
  );
};

// 3. SLEEP-SAFE AUCTION CARD (PRD §8.8)
const SleepSafeCard = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const haptics = useHaptics();

  const toggleSwitch = () => {
    haptics.impactLight();
    setIsEnabled(previousState => !previousState);
  };

  return (
    <View style={styles.sleepSafeContainer}>
      <View style={styles.sleepSafeHeader}>
        <Moon size={20} color={colors.fg.primary} />
        <View style={styles.sleepSafeTitleBox}>
          <Text style={styles.sleepSafeTitle}>Sleep-Safe Auto-Accept</Text>
          <Text style={styles.sleepSafeSubtitle}>Never miss a life-changing bid while sleeping.</Text>
        </View>
        <Switch
          trackColor={{ false: colors.bg.subtle, true: colors.fg.brand }}
          thumbColor={colors.bg.surface}
          ios_backgroundColor={colors.bg.subtle}
          onValueChange={toggleSwitch}
          value={isEnabled}
        />
      </View>
      
      {isEnabled && (
        <View style={styles.sleepSafeSettings}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>VICEROY Tier Threshold</Text>
            <Text style={styles.settingValue}>5,000 Cr</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>SOVEREIGN Tier Threshold</Text>
            <Text style={styles.settingValue}>25,000 Cr</Text>
          </View>
          <Text style={styles.sleepSafeNote}>
            Bids above these amounts will be automatically accepted if you don't respond within 10 minutes.
          </Text>
        </View>
      )}
    </View>
  );
};

// 4. TRIPLE TIER BADGE (PRD §11A.10)
const TripleTierStatus = () => {
  return (
    <View style={styles.tripleTierContainer}>
      <View style={styles.tripleTierIconBox}>
        <Crown size={28} color={colors.fg.brand} />
      </View>
      <View style={styles.tripleTierInfo}>
        <Text style={styles.tripleTierTitle}>The Triple Tier</Text>
        <Text style={styles.tripleTierDesc}>
          Hold Sector, City, and Country titles simultaneously to unlock the ultimate Hall of Fame status.
        </Text>
        <View style={styles.tripleTierChecklist}>
          <Text style={styles.checklistText}>✓ BARON</Text>
          <Text style={styles.checklistTextPending}>○ Mayor (VICEROY)</Text>
          <Text style={styles.checklistTextPending}>○ SOVEREIGN</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

export default function CrownScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  // Simulated state for the active cycle phase
  const [currentPhase, setCurrentPhase] = useState<CyclePhase>('BATTLE_HOUR');

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={styles.screen}>
      {/* HEADER: Large title variant, collapses on scroll */}
      <Header variant="large-title" title="Crown" scrollY={scrollY} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: dimensions.bottomNavH + insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: Battle Cycle Status (PRD §8.1) */}
        <View style={styles.section}>
          <CycleBanner currentPhase={currentPhase} />
        </View>

        {/* SECTION 2: Live Rank Progress (PRD §11A.12) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <TrendingUp size={18} color={colors.fg.primary} />
            <Text style={styles.sectionTitle}>Live Rank Progress</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Your standing in the current 5-hour cycle.
          </Text>

          <View style={styles.cardsWrapper}>
            {MOCK_RANK_DATA.map((tierData) => (
              <RankTierCard key={tierData.id} data={tierData} currentPhase={currentPhase} />
            ))}
          </View>
        </View>

        {/* SECTION 3: Triple Tier Status (PRD §11A.10) */}
        <View style={styles.section}>
          <TripleTierStatus />
        </View>

        {/* SECTION 4: Sleep-Safe Auction Settings (PRD §8.8) */}
        <View style={styles.section}>
          <SleepSafeCard />
        </View>

        {/* SECTION 5: Active Bids & History (PRD §18.6) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <History size={18} color={colors.fg.primary} />
            <Text style={styles.sectionTitle}>Recent Bids</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Track your active escrows and auction results.
          </Text>
          
          <View style={styles.listContainer}>
            <ListItem
              title="Chandigarh — Mayor (VICEROY) Seat"
              subtitle="Outbid by @AyeshaT · 12 mins ago"
              trailing={<Text style={styles.bidAmountLost}>14,500 Cr</Text>}
              onPress={() => {}}
            />
            <ListItem
              title="Sector 35 — BARON Seat"
              subtitle="Auction Won · Decision Pending"
              trailing={<Text style={styles.bidAmountWon}>1,200 Cr</Text>}
              onPress={() => {}}
            />
            <ListItem
              title="India — SOVEREIGN Seat"
              subtitle="Auction ended · Winner kept title"
              trailing={<Text style={styles.bidAmountRefunded}>Refunded</Text>}
              onPress={() => {}}
            />
          </View>
          
          <View style={styles.actionWrapper}>
            <Button variant="secondary" size="md" label="View Full History" fullWidth onPress={() => {}} />
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.surface,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  section: {
    marginBottom: spacing.sectionGap,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.fg.primary,
    marginLeft: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.fg.secondary,
    marginBottom: spacing.md,
    marginLeft: spacing.xl + spacing.xs, // aligns with text, offset icon
  },
  cardsWrapper: {
    gap: spacing.md,
  },
  
  // --- RANK TIER CARD STYLES ---
  cardContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: spacing.base,
    ...colors.shadow.tier1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tierTitle: {
    ...typography.label,
    color: colors.fg.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.fg.secondary,
    marginTop: 2,
  },
  scoreValue: {
    ...typography.statValue,
    color: colors.fg.primary,
    fontSize: 12,
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
    ...typography.statValue, // Space Mono
    color: colors.fg.primary,
    fontSize: 20,
    marginTop: 2,
  },
  darkTunnelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  darkTunnelText: {
    ...typography.micro,
    color: colors.fg.tertiary,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.fg.brand,
    borderRadius: radii.pill,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    ...typography.caption,
    color: colors.fg.secondary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  formulaBox: {
    backgroundColor: colors.bg.subtle,
    borderRadius: radii.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  formulaIcon: {
    marginTop: 2,
    marginRight: spacing.sm,
  },
  formulaText: {
    ...typography.caption,
    color: colors.fg.secondary,
    lineHeight: 18,
    flex: 1,
  },
  formulaBold: {
    ...typography.label,
    color: colors.fg.brandText, // Gold text on light bg (AA accessible)
  },

  // --- CYCLE BANNER STYLES ---
  cycleBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    ...colors.shadow.tier2,
  },
  cycleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cyclePhaseTitle: {
    ...typography.label,
    color: colors.fg.brandText,
    marginLeft: spacing.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cycleTimer: {
    ...typography.balanceHero, // Space Mono, large
    color: colors.fg.primary,
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  cycleSubtext: {
    ...typography.bodySmall,
    color: colors.fg.secondary,
    textAlign: 'center',
  },

  // --- SLEEP SAFE STYLES ---
  sleepSafeContainer: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.base,
  },
  sleepSafeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepSafeTitleBox: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingRight: spacing.sm,
  },
  sleepSafeTitle: {
    ...typography.label,
    color: colors.fg.primary,
  },
  sleepSafeSubtitle: {
    ...typography.caption,
    color: colors.fg.secondary,
    marginTop: 2,
  },
  sleepSafeSettings: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  settingLabel: {
    ...typography.bodySmall,
    color: colors.fg.primary,
  },
  settingValue: {
    ...typography.statValue,
    color: colors.fg.brandText,
    fontSize: 14,
  },
  sleepSafeNote: {
    ...typography.micro,
    color: colors.fg.tertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },

  // --- TRIPLE TIER STYLES ---
  tripleTierContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radii.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.cardEmphasis,
  },
  tripleTierIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tripleTierInfo: {
    flex: 1,
  },
  tripleTierTitle: {
    ...typography.headline,
    color: colors.fg.brandText,
    fontSize: 16,
  },
  tripleTierDesc: {
    ...typography.caption,
    color: colors.fg.secondary,
    marginTop: 4,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  tripleTierChecklist: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  checklistText: {
    ...typography.label,
    color: semanticSuccess.fg,
    fontSize: 11,
  },
  checklistTextPending: {
    ...typography.label,
    color: colors.fg.tertiary,
    fontSize: 11,
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
  bidAmountWon: {
    ...typography.statValue, // Space Mono
    color: semanticSuccess.fg,
    fontSize: 14,
  },
  bidAmountLost: {
    ...typography.statValue, // Space Mono
    color: colors.fg.error,
    fontSize: 14,
  },
  bidAmountRefunded: {
    ...typography.statValue, // Space Mono
    color: colors.fg.tertiary,
    fontSize: 14,
  },
  actionWrapper: {
    paddingHorizontal: spacing.sm,
  },
});

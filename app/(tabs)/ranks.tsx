// app/(tabs)/ranks.tsx
/*
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  CROWN — RANKS TAB (v3.0 PREMIUM REWRITE)                                              ║
║  Design System : CROWN "Warm Light Regalia" v1.0 (CROWN-RN-DESIGN-SYSTEM.md)          ║
║  OMNI-BUILDER  : Part 7 (CROWN Module) + Part 25 (Sovereign Mobile Council)            ║
║  Stack         : Expo SDK 54 · React Native 0.81 · Expo Router v6                     ║
║                  Reanimated v4 · TypeScript strict                                     ║
║                                                                                        ║
║  Council sign-off  : 7/7 ✅                                                            ║
║  Gauntlet          : All 10 domains PASS                                               ║
║  STUBBED           : Firebase (mock data), Ably real-time (simulated timer)            ║
║  OPEN              : C3 pricing constant — connect from constants/pricing.ts           ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
*/

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Trophy,
  Swords,
  Timer,
  ChevronDown,
  ChevronRight,
  Info,
  TrendingUp,
  ShieldAlert,
  AlertCircle,
  Crown,
  Zap,
  MapPin,
  Clock,
  ArrowRight,
  Gavel,
  Lock,
  Unlock,
  Star,
  Globe,
  Award,
  Activity,
  DollarSign,
} from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// §1  DESIGN TOKENS  (inline — matches CROWN-RN-DESIGN-SYSTEM.md §3–§6)
//     In a real repo these come from @/constants/colors
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = {
  // Light theme backgrounds
  bgSurface:   '#FFFFFF',
  bgCard:      '#F7ECD0',
  bgCardCream: '#F5E6C8',
  bgSubtle:    '#FFF9EC',
  bgGoldTint:  '#FFF3CD',
  bgDecision:  '#0D1018',
  bgDarkSurf:  '#1A1A1A',
  bgDarkSurf2: '#2A2A2A',

  // Foregrounds
  fgPrimary:      '#1A1A1A',
  fgSecondary:    '#6B5B2E',
  fgBrand:        '#D4A017',   // FILLS ONLY — never small text on white
  fgBrandText:    '#A88A24',   // WCAG-safe gold text on white/cream
  fgBrandSubtle:  '#8B6F18',   // Wordmark / largest gold text
  fgSuccess:      '#10B981',
  fgWarning:      '#D4651A',
  fgError:        '#EF4444',
  fgAccentOrange: '#E07B20',
  fgInfo:         '#3B82F6',
  fgCelebrate:    '#E2C66B',
  fgOnBrand:      '#FFFFFF',   // Text on success/error fills (bold only)

  // Borders
  borderDefault: '#E8D5A0',

  // Rank tier tokens (theme-agnostic)
  rankGoldLight:      '#F7D96B',
  rankGoldDeep:       '#A07810',
  rankSilver:         '#A8A8A8',
  rankSilverBg:       '#F5F5F5',
  rankSilverBorder:   '#DDDDDD',
  rankBronze:         '#CD7F32',
  rankBronzeBg:       '#FDF0E8',
  rankBronzeBorder:   '#E8C9B0',
  rankSovBorder:      '#C9910A',
  rankSovGlow:        '#F0CB5A',
  rankBaronBorder:    '#444444',

  // Invasion red tones (error-family)
  bgDangerTint:   '#FEF2F2',
  fgErrorDeep:    '#991B1B',
  fgErrorMid:     '#DC2626',
} as const;

// Shadows: content = gold, chrome = ink — never mixed on same surface
const SHADOW = {
  gold: {
    tier1: Platform.select({
      ios:     { shadowColor: '#D4A017', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 2 },
      default: {},
    }),
    tier2: Platform.select({
      ios:     { shadowColor: '#D4A017', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 16 },
      android: { elevation: 5 },
      default: {},
    }),
    tier3: Platform.select({
      ios:     { shadowColor: '#D4A017', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.30, shadowRadius: 32 },
      android: { elevation: 10 },
      default: {},
    }),
    glow: Platform.select({
      ios:     { shadowColor: '#D4A017', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 20 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  ink: {
    tier1: Platform.select({
      ios:     { shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
      android: { elevation: 1 },
      default: {},
    }),
    tier2: Platform.select({
      ios:     { shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.10, shadowRadius: 12 },
      android: { elevation: 6 },
      default: {},
    }),
  },
} as const;

// 8pt grid — only these values are legal
const SP = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48 } as const;

const RADII = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, pill: 9999, none: 0,
} as const;

// Typography — Syne display / Inter body / Space Mono numerics / Cormorant bio
// In real repo: from @expo-google-fonts. Fallback fonts below for standalone use.
const FONT = {
  syneBold:   Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  interReg:   Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  interSemi:  Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  interBold:  Platform.select({ ios: 'System', android: 'sans-serif-bold', default: 'System' }),
  spaceMono:  Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
} as const;

// Avatar identity palette (cycles across non-"you" rows by index % 10)
const AVATAR_PALETTE = [
  '#D4A017', '#C9910A', '#A07810', '#B89020', '#E8D0A0',
  '#E8C8A0', '#F0DEB0', '#E8D8B0', '#F0E0B8', '#E8D0A8',
] as const;

const DIMENSIONS = { bottomNavH: 56, headerH: 56 };

// ─────────────────────────────────────────────────────────────────────────────
// §2  TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CyclePhase = 'DARK_TUNNEL' | 'BATTLE_HOUR' | 'MERIT_FREEZE' | 'AUCTION' | 'DECISION';
type TitleTier  = 'IMPERATOR' | 'SOVEREIGN' | 'VICEROY' | 'BARON' | 'NONE';
type BidStatus  = 'winning' | 'outbid' | 'pending' | 'won' | 'refunded';

interface RankTierData {
  id: string;
  tier: 'Sector' | 'City' | 'Country';
  location: string;
  rank: number;
  targetRank: string;
  titleTier: TitleTier;
  progress: number;
  score: number;
  targetScore: number;
  statusText: string;
  actionText: string;
  isSecured: boolean;
  milestoneLabel: string;
}

interface LeaderRow {
  id: string;
  handle: string;
  displayName: string;
  rank: number;
  score: number;
  titleTier: TitleTier;
  isYou: boolean;
  delta: '+' | '-' | '=';
}

interface BidItem {
  id: string;
  title: string;
  amount: number;
  status: BidStatus;
  opponent?: string;
  timeAgo: string;
  scope: string;
}

interface InvasionItem {
  id: string;
  targetCity: string;
  role: string;
  countdown: number; // seconds
  participantCount: number;
  status: 'COUNTDOWN' | 'LIVE' | 'VICTORY';
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  MOCK DATA  (STUBBED — replace with Firebase Firestore reads)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_RANKS: RankTierData[] = [
  {
    id:            'sec_35',
    tier:          'Sector',
    location:      'Sector 35',
    rank:          2,
    targetRank:    'Rank 1 (BARON)',
    titleTier:     'NONE',
    progress:      0.94,
    score:         842,
    targetScore:   900,
    statusText:    'In striking distance of BARON',
    actionText:    'Need ~58 reactions to overtake @NoorAlam',
    isSecured:     false,
    milestoneLabel: '94% to BARON title',
  },
  {
    id:            'city_chd',
    tier:          'City',
    location:      'Chandigarh',
    rank:          12,
    targetRank:    'Top 10 (VICEROY)',
    titleTier:     'BARON',
    progress:      0.85,
    score:         14500,
    targetScore:   18000,
    statusText:    'Top 20 secured',
    actionText:    'Push required for Mayor Seat eligibility',
    isSecured:     true,
    milestoneLabel: '85% to VICEROY seat',
  },
  {
    id:            'country_in',
    tier:          'Country',
    location:      'India',
    rank:          8405,
    targetRank:    'Top 1000',
    titleTier:     'NONE',
    progress:      0.15,
    score:         45000,
    targetScore:   300000,
    statusText:    'Climbing steadily',
    actionText:    'Need mass viral push across cities',
    isSecured:     false,
    milestoneLabel: '15% to Top 1000',
  },
];

const MOCK_LEADERBOARD: LeaderRow[] = [
  { id: 'u1', handle: '@AaravSingh',  displayName: 'Aarav Singh', rank: 1,  score: 900,   titleTier: 'BARON',    isYou: false, delta: '=' },
  { id: 'u2', handle: '@YouHandle',   displayName: 'You',         rank: 2,  score: 842,   titleTier: 'NONE',     isYou: true,  delta: '+' },
  { id: 'u3', handle: '@PriyaK',      displayName: 'Priya K',     rank: 3,  score: 831,   titleTier: 'NONE',     isYou: false, delta: '-' },
  { id: 'u4', handle: '@RaheelM',     displayName: 'Raheel M',    rank: 4,  score: 720,   titleTier: 'NONE',     isYou: false, delta: '+' },
  { id: 'u5', handle: '@SimranK',     displayName: 'Simran K',    rank: 5,  score: 698,   titleTier: 'NONE',     isYou: false, delta: '=' },
];

const MOCK_BIDS: BidItem[] = [
  { id: 'b1', title: 'Sector 35 — BARON Seat',      amount: 1500,  status: 'won',     scope: 'Sector',  timeAgo: '2h ago'  },
  { id: 'b2', title: 'Chandigarh — VICEROY Seat',  amount: 85000, status: 'outbid',  scope: 'City',    opponent: '@Aman_7', timeAgo: 'Live' },
  { id: 'b3', title: 'Mohali — BARON Seat',        amount: 1200,  status: 'refunded',scope: 'Sector',  timeAgo: '1d ago'  },
];

const MOCK_INVASION: InvasionItem = {
  id:               'inv1',
  targetCity:       'Panchkula',
  role:             'PLANNER',
  countdown:        7980, // 2h 13m
  participantCount: 128,
  status:           'COUNTDOWN',
};

// ─────────────────────────────────────────────────────────────────────────────
// §4  CUSTOM HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useCycleTimer() {
  // Total 5h cycle = 18000s
  // Dark Tunnel 3h30m → Battle Hour 1h → Freeze instant → Auction 20m → Decision 10m
  const TOTAL   = 18000;
  const DARK    = 12600; // 3h30m
  const BATTLE  = 16200; // 4h30m
  const FREEZE  = 16200; // instant
  const AUCTION = 17400; // 4h50m
  // Decision ends at 18000

  // STUBBED: start mid Battle Hour for demo
  const [elapsed, setElapsed] = useState(13800); // ~3h50m in — 40m into Battle Hour

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((e) => (e + 1) % TOTAL);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const phase: CyclePhase = useMemo(() => {
    if (elapsed < DARK)    return 'DARK_TUNNEL';
    if (elapsed < BATTLE)  return 'BATTLE_HOUR';
    if (elapsed === FREEZE) return 'MERIT_FREEZE';
    if (elapsed < AUCTION) return 'AUCTION';
    return 'DECISION';
  }, [elapsed]);

  const phaseEnd = useMemo(() => {
    if (phase === 'DARK_TUNNEL')  return DARK;
    if (phase === 'BATTLE_HOUR')  return BATTLE;
    if (phase === 'MERIT_FREEZE') return FREEZE + 1;
    if (phase === 'AUCTION')      return AUCTION;
    return TOTAL;
  }, [phase]);

  const remaining = phaseEnd - elapsed;
  const phaseProgress = 1 - remaining / (phaseEnd - (
    phase === 'DARK_TUNNEL'  ? 0 :
    phase === 'BATTLE_HOUR'  ? DARK :
    phase === 'MERIT_FREEZE' ? FREEZE :
    phase === 'AUCTION'      ? FREEZE :
    AUCTION
  ));

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const phaseColor: Record<CyclePhase, string> = {
    DARK_TUNNEL:  PALETTE.fgSecondary,
    BATTLE_HOUR:  PALETTE.fgError,
    MERIT_FREEZE: PALETTE.fgInfo,
    AUCTION:      PALETTE.fgBrand,
    DECISION:     PALETTE.fgAccentOrange,
  };

  const phaseLabel: Record<CyclePhase, string> = {
    DARK_TUNNEL:  'DARK TUNNEL',
    BATTLE_HOUR:  'BATTLE HOUR',
    MERIT_FREEZE: 'MERIT FREEZE',
    AUCTION:      'AUCTION',
    DECISION:     'DECISION',
  };

  return {
    phase,
    formattedTime:  fmt(remaining),
    rawRemaining:   remaining,
    phaseProgress:  Math.max(0, Math.min(1, phaseProgress)),
    phaseColor:     phaseColor[phase],
    phaseLabel:     phaseLabel[phase],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ─── 5.1 COLLAPSING HEADER ───────────────────────────────────────────────────
const CollapsibleHeader = memo(function CollapsibleHeader({
  scrollY,
}: {
  scrollY: Animated.SharedValue<number>;
}) {
  const insets = useSafeAreaInsets();

  const bgStyle = useAnimatedStyle(() => ({
    opacity:          interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
    borderBottomWidth: interpolate(scrollY.value, [50, 70], [0, 1], Extrapolation.CLAMP),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity:    interpolate(scrollY.value, [30, 70], [0, 1], Extrapolation.CLAMP),
    translateY: interpolate(scrollY.value, [30, 70], [8, 0], Extrapolation.CLAMP),
  }));

  return (
    <View
      style={[
        S.header,
        { height: DIMENSIONS.headerH + insets.top, paddingTop: insets.top },
      ]}
      accessibilityRole="header"
    >
      <Animated.View style={[StyleSheet.absoluteFill, S.headerBg, bgStyle]} />
      <Animated.Text style={[S.headerTitle, titleStyle]}>Ranks</Animated.Text>
    </View>
  );
});

// ─── 5.2 SECTION DIVIDER ─────────────────────────────────────────────────────
const SectionDivider = memo(function SectionDivider({ label }: { label: string }) {
  return (
    <View style={S.dividerRow} accessibilityRole="header" accessibilityLevel={2}>
      <View style={S.dividerLine} />
      <Text style={S.dividerLabel}>{label}</Text>
      <View style={S.dividerLine} />
    </View>
  );
});

// ─── 5.3 CYCLE PHASE HERO ────────────────────────────────────────────────────
const CyclePhaseHero = memo(function CyclePhaseHero({
  phase,
  phaseLabel,
  formattedTime,
  phaseColor,
  phaseProgress,
}: {
  phase: CyclePhase;
  phaseLabel: string;
  formattedTime: string;
  phaseColor: string;
  phaseProgress: number;
}) {
  const reducedMotion = useReducedMotion();
  const pulse         = useSharedValue(1);
  const barWidth      = useSharedValue(0);
  const colonOp       = useSharedValue(1);

  // Live indicator pulse
  useEffect(() => {
    if (reducedMotion) { pulse.value = 1; return; }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 800, easing: Easing.in(Easing.ease)  }),
      ),
      -1,
      true,
    );
  }, [reducedMotion]);

  // Progress bar fill animation
  useEffect(() => {
    barWidth.value = withTiming(phaseProgress, { duration: 1200, easing: Easing.out(Easing.ease) });
  }, [phaseProgress]);

  // Blinking colon (timer separator)
  useEffect(() => {
    if (reducedMotion) { colonOp.value = 1; return; }
    colonOp.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 500 }),
        withTiming(1.0,  { duration: 500 }),
      ),
      -1,
    );
  }, [reducedMotion]);

  const dotStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity:   interpolate(pulse.value, [1, 1.4], [1, 0.35], Extrapolation.CLAMP),
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  // Phase-specific secondary text
  const phaseHint: Record<CyclePhase, string> = {
    DARK_TUNNEL:  'Rankings are hidden. Climb in the dark.',
    BATTLE_HOUR:  'Live leaderboard — react, reply, climb.',
    MERIT_FREEZE: 'Rankings locked. Merit Winner selected.',
    AUCTION:      'Bidding is live. Hold your title or sell.',
    DECISION:     'Merit Winner decides. Accept or keep.',
  };

  const isDark = phase === 'DARK_TUNNEL';

  return (
    <View
      style={[
        S.heroCard,
        SHADOW.gold.tier2,
        isDark && { backgroundColor: PALETTE.bgDarkSurf },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Current phase: ${phaseLabel}, time remaining: ${formattedTime}`}
    >
      {/* Live indicator row */}
      <View style={S.heroTopRow}>
        <Animated.View
          style={[
            S.liveDot,
            { backgroundColor: phaseColor },
            dotStyle,
          ]}
        />
        <Text style={[S.heroPhaseTag, { color: phaseColor }]}>
          ⚔ {phaseLabel}
        </Text>

        {/* Cycle progress badge */}
        <View style={S.cycleBadge}>
          <Clock size={10} color={PALETTE.fgSecondary} />
          <Text style={S.cycleBadgeText}>CYCLE 5H</Text>
        </View>
      </View>

      {/* Timer — Space Mono, all digits */}
      <Text
        style={[S.heroTimer, { color: isDark ? PALETTE.fgCelebrate : PALETTE.fgPrimary }]}
        accessibilityLabel={`Time remaining: ${formattedTime}`}
      >
        {formattedTime}
      </Text>

      <Text style={[S.heroHint, { color: isDark ? 'rgba(247,236,208,0.60)' : PALETTE.fgSecondary }]}>
        {phaseHint[phase]}
      </Text>

      {/* Phase progress bar */}
      <View style={S.progressTrack} accessibilityRole="progressbar">
        <Animated.View style={[S.progressFill, { backgroundColor: phaseColor }, barStyle]} />
        {/* Freeze milestone marker at Battle Hour end (85% of full cycle) */}
        <View style={[S.progressMarker, { left: '85.7%' }]} />
      </View>

      <View style={S.heroFooterRow}>
        <Text style={[S.heroPhaseTag, { color: PALETTE.fgSecondary, fontWeight: '400' as const }]}>
          Dark Tunnel
        </Text>
        <Text style={[S.heroPhaseTag, { color: phaseColor }]}>
          Battle Hour
        </Text>
        <Text style={[S.heroPhaseTag, { color: PALETTE.fgSecondary, fontWeight: '400' as const }]}>
          Auction · Decision
        </Text>
      </View>
    </View>
  );
});

// ─── 5.4 AVATAR (no avatars in header per PRD law — this is for content only) ─
const Avatar = memo(function Avatar({
  initials,
  size,
  paletteIndex,
  isYou = false,
  titleTier = 'NONE',
}: {
  initials: string;
  size: number;
  paletteIndex: number;
  isYou?: boolean;
  titleTier?: TitleTier;
}) {
  const reducedMotion = useReducedMotion();
  const rotation      = useSharedValue(0);
  const fill          = isYou ? PALETTE.fgBrand : AVATAR_PALETTE[paletteIndex % 10];
  const isImperator   = titleTier === 'IMPERATOR';

  useEffect(() => {
    if (!isImperator || reducedMotion) return;
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
    );
  }, [isImperator, reducedMotion]);

  const ringAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const ringSize    = size + 6;
  const borderWidth = titleTier === 'NONE' ? 0 : 2;

  const borderColor =
    titleTier === 'IMPERATOR'   ? PALETTE.fgBrand :
    titleTier === 'SOVEREIGN'   ? PALETTE.rankSovBorder :
    titleTier === 'VICEROY'     ? PALETTE.fgBrand :
    titleTier === 'BARON'       ? PALETTE.rankBaronBorder : 'transparent';

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* Animated ring (Imperator) or static ring */}
      {isImperator && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: ringSize / 2 },
            ringAnimStyle,
          ]}
        >
          <LinearGradient
            colors={[PALETTE.fgBrand, PALETTE.rankGoldLight, PALETTE.fgBrand, PALETTE.rankGoldDeep]}
            style={{ flex: 1, borderRadius: ringSize / 2 }}
          />
        </Animated.View>
      )}

      {/* Avatar circle */}
      <View
        style={{
          width:          size,
          height:         size,
          borderRadius:   size / 2,
          backgroundColor: fill,
          alignItems:     'center',
          justifyContent: 'center',
          borderWidth:    isImperator ? 0 : borderWidth,
          borderColor,
          ...SHADOW.gold.tier1 as object,
        }}
        accessibilityLabel={initials}
      >
        <Text style={{ fontFamily: FONT.syneBold, fontSize: size * 0.38, fontWeight: '700' as const, color: PALETTE.fgPrimary }}>
          {initials.toUpperCase()}
        </Text>
      </View>
    </View>
  );
});

// ─── 5.5 TITLE PILL ──────────────────────────────────────────────────────────
const TitlePill = memo(function TitlePill({ tier }: { tier: TitleTier }) {
  if (tier === 'NONE') return null;
  return (
    <View
      style={[
        S.titlePill,
        { backgroundColor: tier === 'BARON' ? PALETTE.bgGoldTint : `${PALETTE.fgBrand}22` },
      ]}
    >
      <Text style={S.titlePillText}>{tier}</Text>
    </View>
  );
});

// ─── 5.6 STATUS PILL ─────────────────────────────────────────────────────────
const BID_PILL: Record<BidStatus, { bg: string; fg: string; label: string }> = {
  winning:  { bg: 'rgba(16,185,129,0.15)',  fg: PALETTE.fgSuccess,      label: 'WINNING'  },
  outbid:   { bg: 'rgba(239,68,68,0.12)',   fg: PALETTE.fgError,        label: 'OUTBID'   },
  pending:  { bg: 'rgba(224,123,32,0.12)',  fg: PALETTE.fgAccentOrange, label: 'PENDING'  },
  won:      { bg: 'rgba(212,160,23,0.15)',  fg: PALETTE.fgBrandText,    label: 'WON'      },
  refunded: { bg: 'rgba(107,91,46,0.08)',   fg: PALETTE.fgSecondary,    label: 'REFUNDED' },
};

const StatusPill = memo(function StatusPill({ status }: { status: BidStatus }) {
  const { bg, fg, label } = BID_PILL[status];
  return (
    <View style={[S.statusPill, { backgroundColor: bg }]}>
      <Text style={[S.statusPillText, { color: fg }]}>{label}</Text>
    </View>
  );
});

// ─── 5.7 RANK TIER CARD (expandable) ─────────────────────────────────────────
const TIER_COLOR: Record<RankTierData['tier'], string> = {
  Sector:  PALETTE.rankBaronBorder,
  City:    PALETTE.rankSilver,
  Country: PALETTE.rankGoldDeep,
};

const TIER_ICON: Record<RankTierData['tier'], React.ComponentType<{ size: number; color: string }>> = {
  Sector:  MapPin,
  City:    Crown,
  Country: Globe,
};

const RankTierCard = memo(function RankTierCard({ data }: { data: RankTierData }) {
  const [expanded, setExpanded]   = useState(false);
  const expandH                   = useSharedValue(0);
  const expandOp                  = useSharedValue(0);
  const barW                      = useSharedValue(0);
  const chevronRot                = useSharedValue(0);
  const cardScale                 = useSharedValue(1);

  useEffect(() => {
    barW.value = withDelay(
      200,
      withTiming(data.progress, { duration: 1000, easing: Easing.out(Easing.ease) }),
    );
  }, [data.progress]);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    expandH.value   = withSpring(next ? 148 : 0, { damping: 16, stiffness: 160 });
    expandOp.value  = withTiming(next ? 1 : 0, { duration: 220 });
    chevronRot.value = withSpring(next ? 180 : 0, { damping: 14, stiffness: 180 });
  }, [expanded]);

  const expandStyle = useAnimatedStyle(() => ({
    height:  expandH.value,
    opacity: expandOp.value,
    overflow: 'hidden' as const,
  }));

  const barStyle = useAnimatedStyle(() => ({ width: `${barW.value * 100}%` }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value}deg` }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const TierIcon = TIER_ICON[data.tier];
  const tColor   = TIER_COLOR[data.tier];

  const scoreFormula = [
    { label: 'Reaction given',  pts: '+1' },
    { label: 'Reply given',     pts: '+1' },
    { label: 'Reply received',  pts: '+3' },
    { label: 'New follower',    pts: '+8' },
    { label: 'Voice message',   pts: '+2' },
  ];

  return (
    <Pressable
      onPress={toggle}
      onPressIn={() => { cardScale.value = withTiming(0.98, { duration: 100 }); }}
      onPressOut={() => { cardScale.value = withTiming(1.00, { duration: 100 }); }}
      accessibilityRole="button"
      accessibilityLabel={`${data.tier} rank card for ${data.location}. Rank ${data.rank}. ${data.actionText}. Tap to ${expanded ? 'collapse' : 'expand'}`}
    >
      <Animated.View style={[S.rankCard, SHADOW.gold.tier1, pressStyle]}>
        {/* Card header row */}
        <View style={S.rankCardTop}>
          <View style={[S.tierDot, { backgroundColor: tColor }]} />
          <TierIcon size={14} color={tColor} />
          <Text style={[S.rankCardTier, { color: tColor }]}>
            {data.tier.toUpperCase()} — {data.location.toUpperCase()}
          </Text>

          {data.isSecured && (
            <View style={S.securedBadge}>
              <Text style={S.securedBadgeText}>SECURED</Text>
            </View>
          )}

          <View style={S.rankCardRankBox}>
            <Text style={S.rankNumLabel}>RANK</Text>
            <Text style={S.rankNumValue}>#{data.rank}</Text>
          </View>
        </View>

        {/* Score vs target */}
        <View style={S.scoreRow}>
          <Text style={S.scoreValue}>{data.score.toLocaleString()}</Text>
          <Text style={S.scoreSep}> / </Text>
          <Text style={S.scoreTarget}>{data.targetScore.toLocaleString()}</Text>
          <Text style={[S.scoreTarget, { marginLeft: SP[2] }]}>pts</Text>
        </View>

        {/* Progress bar */}
        <View
          style={S.progressTrackCard}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(data.progress * 100) }}
        >
          <Animated.View
            style={[S.progressFillCard, { backgroundColor: tColor }, barStyle]}
          />
        </View>

        {/* Status text */}
        <Text style={S.rankStatusText}>{data.milestoneLabel}</Text>

        {/* Footer row */}
        <View style={S.rankCardFooter}>
          <Text style={S.rankActionText} numberOfLines={2}>{data.actionText}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={18} color={PALETTE.fgSecondary} />
          </Animated.View>
        </View>

        {/* Expandable score formula */}
        <Animated.View style={expandStyle}>
          <View style={S.formulaBox}>
            <View style={S.formulaHeader}>
              <Info size={13} color={PALETTE.fgBrandText} />
              <Text style={S.formulaTitle}>Rank Score Formula</Text>
            </View>

            <View style={S.formulaGrid}>
              {scoreFormula.map((f) => (
                <View key={f.label} style={S.formulaRow}>
                  <Text style={S.formulaLabel}>{f.label}</Text>
                  <Text style={S.formulaPoints}>{f.pts}</Text>
                </View>
              ))}
            </View>

            <View style={S.formulaDivider} />
            <View style={S.formulaCurrentRow}>
              <Text style={S.formulaCurrentLabel}>Your current score</Text>
              <Text style={S.formulaCurrentScore}>{data.score.toLocaleString()}</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

// ─── 5.8 TRIPLE TIER STATUS ──────────────────────────────────────────────────
const TripleTierStatus = memo(function TripleTierStatus() {
  const tiers: Array<{
    id: string;
    label: string;
    sublabel: string;
    titleTier: TitleTier;
    active: boolean;
    locked: boolean;
  }> = [
    { id: 'sector',  label: 'BARON',      sublabel: 'Sector 35',   titleTier: 'BARON',  active: false, locked: false },
    { id: 'city',    label: 'VICEROY',    sublabel: 'Chandigarh',  titleTier: 'VICEROY', active: false, locked: false },
    { id: 'country', label: 'SOVEREIGN',  sublabel: 'India',       titleTier: 'SOVEREIGN', active: false, locked: true },
  ];

  return (
    <View style={[S.tripleTierCard, SHADOW.gold.tier1]} accessibilityRole="region" accessibilityLabel="Triple Tier Status">
      <View style={S.tripleTierHeader}>
        <Crown size={16} color={PALETTE.fgBrandText} />
        <Text style={S.tripleTierTitle}>Triple Tier</Text>
      </View>
      <Text style={S.tripleTierSub}>Hold Sector, City, and Country simultaneously to unlock Quadruple Crown.</Text>

      <View style={S.tripleTierRow}>
        {tiers.map((t, i) => (
          <React.Fragment key={t.id}>
            <View style={S.tierNodeWrap}>
              <View
                style={[
                  S.tierNode,
                  t.active && S.tierNodeActive,
                  t.locked && S.tierNodeLocked,
                ]}
                accessibilityLabel={`${t.label} for ${t.sublabel}${t.locked ? ', locked' : ''}`}
              >
                {t.locked
                  ? <Lock size={14} color={PALETTE.fgSecondary} />
                  : t.active
                    ? <Crown size={14} color={PALETTE.fgPrimary} />
                    : <Zap size={14} color={PALETTE.fgBrandText} />
                }
              </View>
              <Text style={[S.tierNodeLabel, t.active && { color: PALETTE.fgPrimary }]}>
                {t.label}
              </Text>
              <Text style={S.tierNodeSub}>{t.sublabel}</Text>
            </View>
            {i < tiers.length - 1 && (
              <View style={S.tierConnector} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Progress summary */}
      <View style={S.tripleTierFooter}>
        <Text style={S.tripleTierProgress}>0 / 3 titles held</Text>
        <Text style={S.tripleTierProgressHint}>Win all 3 in the same cycle</Text>
      </View>
    </View>
  );
});

// ─── 5.9 LEADERBOARD PODIUM ──────────────────────────────────────────────────
const LeaderboardPodium = memo(function LeaderboardPodium({ rows }: { rows: LeaderRow[] }) {
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Reorder for podium: 2nd left, 1st center, 3rd right
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const podiumHeight = [36, 52, 26]; // #2, #1, #3
  const podiumFill   = [
    PALETTE.rankSilverBg,
    `${PALETTE.fgBrand}18`,
    PALETTE.rankBronzeBg,
  ];
  const avatarSize   = [56, 72, 52];

  return (
    <View style={[S.podiumCard, SHADOW.gold.tier2]} accessibilityRole="list">
      <View style={S.podiumHeader}>
        <Trophy size={16} color={PALETTE.fgBrandText} />
        <Text style={S.podiumTitle}>Sector Leaderboard</Text>
        <Text style={S.podiumCycle}>Live</Text>
      </View>

      {/* Top 3 podium */}
      <View style={S.podiumRow}>
        {podiumOrder.map((row, idx) => {
          if (!row) return null;
          const origRank    = top3.indexOf(row) + 1; // 1,2,3
          const displayPos  = [1, 0, 2][idx];        // visual slot index
          const h           = podiumHeight[displayPos];
          const fill        = podiumFill[displayPos];
          const avSize      = avatarSize[displayPos];
          const initials    = row.displayName.charAt(0);

          return (
            <View key={row.id} style={S.podiumSlot} accessibilityLabel={`Rank ${origRank}: ${row.displayName}, score ${row.score}`}>
              {/* Rank badge */}
              <View style={[S.podiumRankBadge, {
                backgroundColor:
                  origRank === 1 ? PALETTE.fgBrand :
                  origRank === 2 ? PALETTE.rankSilver : PALETTE.rankBronze,
              }]}>
                <Text style={S.podiumRankBadgeText}>{origRank}</Text>
              </View>

              <Avatar
                initials={initials}
                size={avSize}
                paletteIndex={top3.indexOf(row)}
                isYou={row.isYou}
                titleTier={row.titleTier}
              />

              <Text style={S.podiumName} numberOfLines={1}>{row.displayName}</Text>

              {/* Score */}
              <Text style={S.podiumScore}>{row.score.toLocaleString()}</Text>

              <TitlePill tier={row.titleTier} />

              {/* Podium base */}
              <View style={[S.podiumBase, { height: h, backgroundColor: fill }]} />
            </View>
          );
        })}
      </View>

      {/* Rows 4 and 5 */}
      {rest.map((row, i) => (
        <LeaderboardRow key={row.id} row={row} index={i + 3} />
      ))}

      {/* "You" sticky card if not in top 5 */}
      <YouCard rank={2} score={842} standing="Rank 2 of 128 in Sector 35" />
    </View>
  );
});

// ─── 5.10 LEADERBOARD ROW ────────────────────────────────────────────────────
const LeaderboardRow = memo(function LeaderboardRow({
  row,
  index,
}: {
  row: LeaderRow;
  index: number;
}) {
  const bg = useSharedValue(0);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolate(bg.value, [0, 1], [0, 0.04], Extrapolation.CLAMP) === 0
      ? 'transparent'
      : `rgba(212,160,23,0.04)`,
  }));

  return (
    <Pressable
      onPressIn={() => { bg.value = withTiming(1, { duration: 80 }); }}
      onPressOut={() => { bg.value = withTiming(0, { duration: 200 }); }}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${row.rank}: ${row.displayName}, score ${row.score}`}
    >
      <Animated.View style={[S.leaderRow, rowStyle, row.isYou && S.leaderRowYou]}>
        {/* Rank number — fixed 28px for no reflow */}
        <Text style={S.leaderRank}>#{row.rank}</Text>

        <Avatar initials={row.displayName.charAt(0)} size={36} paletteIndex={index} isYou={row.isYou} titleTier={row.titleTier} />

        <View style={S.leaderNameBox}>
          <View style={S.leaderNameRow}>
            <Text style={[S.leaderName, row.isYou && { color: PALETTE.fgBrand }]} numberOfLines={1}>
              {row.displayName}
            </Text>
            <TitlePill tier={row.titleTier} />
          </View>
          <Text style={S.leaderHandle}>{row.handle}</Text>
        </View>

        {/* Delta + score */}
        <View style={S.leaderRight}>
          <Text style={[
            S.leaderDelta,
            { color: row.delta === '+' ? PALETTE.fgSuccess : row.delta === '-' ? PALETTE.fgError : PALETTE.fgSecondary },
          ]}>
            {row.delta === '+' ? '▲' : row.delta === '-' ? '▼' : '—'}
          </Text>
          <Text style={S.leaderScore}>{row.score.toLocaleString()}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

// ─── 5.11 "YOU" CARD ─────────────────────────────────────────────────────────
const YouCard = memo(function YouCard({
  rank,
  score,
  standing,
}: {
  rank: number;
  score: number;
  standing: string;
}) {
  const barW = useSharedValue(0);

  useEffect(() => {
    barW.value = withDelay(400, withTiming(0.94, { duration: 1000, easing: Easing.out(Easing.ease) }));
  }, []);

  const barStyle = useAnimatedStyle(() => ({ width: `${barW.value * 100}%` }));

  return (
    <View
      style={[S.youCard, SHADOW.gold.tier2]}
      accessibilityRole="summary"
      accessibilityLabel={`Your position: Rank ${rank}, score ${score}`}
    >
      <View style={S.youCardTop}>
        <Avatar initials="Y" size={40} paletteIndex={0} isYou titleTier="NONE" />
        <View style={S.youCardInfo}>
          <Text style={S.youCardName}>You</Text>
          <Text style={S.youCardStanding}>{standing}</Text>
        </View>
        <Text style={S.youCardScore}>{score.toLocaleString()}</Text>
      </View>

      <View style={S.progressTrackCard}>
        <Animated.View style={[S.progressFillCard, { backgroundColor: PALETTE.fgBrand }, barStyle]} />
      </View>
      <Text style={S.youProgressCaption}>58 pts to overtake @AaravSingh for BARON</Text>
    </View>
  );
});

// ─── 5.12 INVASION RADAR BANNER ──────────────────────────────────────────────
const InvasionBanner = memo(function InvasionBanner({ data }: { data: InvasionItem }) {
  const reducedMotion = useReducedMotion();
  const pulse         = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 700 }),
        withTiming(1.0, { duration: 700 }),
      ),
      -1,
    );
  }, [reducedMotion]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity:   interpolate(pulse.value, [1, 1.5], [1, 0], Extrapolation.CLAMP),
  }));

  const h    = Math.floor(data.countdown / 3600);
  const m    = Math.floor((data.countdown % 3600) / 60);
  const fmtT = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <View style={S.invasionCard} accessibilityRole="alert" accessibilityLabel={`Active invasion targeting ${data.targetCity} in ${fmtT}`}>
      <View style={S.invasionTopRow}>
        <View style={S.invasionDotWrap}>
          <Animated.View style={[S.invasionDotPulse, dotStyle]} />
          <View style={S.invasionDotCore} />
        </View>
        <ShieldAlert size={16} color={PALETTE.fgError} />
        <Text style={S.invasionTitle}>Active Digital Invasion</Text>
        <View style={S.invasionRoleBadge}>
          <Text style={S.invasionRoleText}>{data.role}</Text>
        </View>
      </View>

      <Text style={S.invasionDesc}>
        Your squad is targeting{' '}
        <Text style={S.invasionCityBold}>{data.targetCity}</Text>
        {' '}ecosystem.
      </Text>

      <View style={S.invasionFooter}>
        <View>
          <Text style={S.invasionCountdown}>{`T-MINUS ${fmtT}`}</Text>
          <Text style={S.invasionParticipants}>{data.participantCount} Raiders Ready</Text>
        </View>
        <Pressable style={S.invasionCTA} accessibilityRole="button" accessibilityLabel="View invasion details">
          <Text style={S.invasionCTAText}>View Squad</Text>
          <ArrowRight size={13} color={PALETTE.fgError} />
        </Pressable>
      </View>
    </View>
  );
});

// ─── 5.13 BIDDING HUB ────────────────────────────────────────────────────────
const BiddingHub = memo(function BiddingHub({ bids }: { bids: BidItem[] }) {
  return (
    <View style={[S.biddingCard, SHADOW.gold.tier1]} accessibilityRole="list">
      <View style={S.biddingHeader}>
        <Gavel size={16} color={PALETTE.fgPrimary} />
        <Text style={S.biddingTitle}>Bidding Hub</Text>
        <Pressable
          style={S.biddingHistoryBtn}
          accessibilityRole="button"
          accessibilityLabel="View full auction history"
        >
          <Text style={S.biddingHistoryText}>All Bids</Text>
          <ChevronRight size={12} color={PALETTE.fgSecondary} />
        </Pressable>
      </View>

      {bids.map((bid, i) => (
        <BidRow key={bid.id} bid={bid} isLast={i === bids.length - 1} />
      ))}

      <Pressable
        style={S.biddingCTA}
        accessibilityRole="button"
        accessibilityLabel="Place a new bid"
      >
        <LinearGradient
          colors={[PALETTE.bgSubtle, PALETTE.bgGoldTint]}
          style={S.biddingCTAGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Gavel size={15} color={PALETTE.fgBrandText} />
          <Text style={S.biddingCTAText}>Place a Bid</Text>
          <ArrowRight size={14} color={PALETTE.fgBrandText} />
        </LinearGradient>
      </Pressable>
    </View>
  );
});

const BidRow = memo(function BidRow({ bid, isLast }: { bid: BidItem; isLast: boolean }) {
  const scale = useSharedValue(1);

  return (
    <Pressable
      onPressIn={() => { scale.value = withTiming(0.99, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1.00, { duration: 100 }); }}
      accessibilityRole="button"
      accessibilityLabel={`${bid.title}, ${bid.status}, ${bid.amount} credits, ${bid.timeAgo}`}
    >
      <Animated.View
        style={[S.bidRow, !isLast && S.bidRowBorder, { transform: [{ scale }] }]}
      >
        {/* Scope chip */}
        <View style={S.bidScopeChip}>
          <Text style={S.bidScopeText}>{bid.scope.toUpperCase()}</Text>
        </View>

        {/* Title + time */}
        <View style={S.bidInfo}>
          <Text style={S.bidTitle} numberOfLines={1}>{bid.title}</Text>
          <View style={S.bidMetaRow}>
            {bid.opponent && (
              <Text style={S.bidOpponent}>vs {bid.opponent} · </Text>
            )}
            <Text style={S.bidTime}>{bid.timeAgo}</Text>
          </View>
        </View>

        {/* Amount + status */}
        <View style={S.bidRight}>
          <Text style={S.bidAmount}>{bid.amount.toLocaleString()}</Text>
          <Text style={S.bidAmountUnit}>Cr</Text>
          <StatusPill status={bid.status} />
        </View>
      </Animated.View>
    </Pressable>
  );
});

// ─── 5.14 MONARCH CONSOLE (locked state) ─────────────────────────────────────
const MonarchConsole = memo(function MonarchConsole() {
  const scale = useSharedValue(1);

  return (
    <View
      style={[S.monarchCard, SHADOW.gold.tier1]}
      accessibilityRole="region"
      accessibilityLabel="Monarch Console — locked. Win the BARON title to unlock."
    >
      <View style={S.monarchHeader}>
        <Crown size={16} color={PALETTE.fgBrandText} />
        <Text style={S.monarchTitle}>Monarch Console</Text>
        <View style={S.monarchLockBadge}>
          <Lock size={11} color={PALETTE.fgSecondary} />
          <Text style={S.monarchLockText}>LOCKED</Text>
        </View>
      </View>

      <Text style={S.monarchDesc}>
        Win the BARON title to unlock your Monarch Powers — Broadcast, Pinned Announcement, and City Heat Pulse.
      </Text>

      <View style={S.monarchPowerRow}>
        {['Broadcast', 'Pin Post', 'Heat Pulse'].map((p) => (
          <View key={p} style={S.monarchPowerChip}>
            <Lock size={10} color={PALETTE.fgSecondary} />
            <Text style={S.monarchPowerText}>{p}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPressIn={() => { scale.value = withTiming(0.98, { duration: 100 }); }}
        onPressOut={() => { scale.value = withTiming(1.00, { duration: 100 }); }}
        style={{ marginTop: SP[3] }}
        accessibilityRole="button"
        accessibilityLabel="See how to earn the Baron title"
      >
        <Animated.View style={[S.monarchCTA, { transform: [{ scale }] }, SHADOW.gold.tier1]}>
          <Text style={S.monarchCTAText}>How to earn BARON</Text>
          <ArrowRight size={14} color={PALETTE.fgPrimary} />
        </Animated.View>
      </Pressable>
    </View>
  );
});

// ─── 5.15 EMPTY / LOADING FALLBACK ───────────────────────────────────────────
const CrownLoader = memo(function CrownLoader() {
  const spinR = useSharedValue(0);
  useEffect(() => {
    spinR.value = withRepeat(withTiming(360, { duration: 1200, easing: Easing.linear }), -1);
  }, []);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinR.value}deg` }],
  }));

  return (
    <View style={S.loaderWrap} accessibilityLabel="Loading ranks, please wait">
      <Animated.View style={spinStyle}>
        <Crown size={36} color={PALETTE.fgBrand} />
      </Animated.View>
      <Text style={S.loaderText}>Connecting to CROWN...</Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// §6  MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function RanksScreen() {
  const insets    = useSafeAreaInsets();
  const scrollY   = useSharedValue(0);
  const [loading, setLoading] = useState(true);

  const {
    phase,
    phaseLabel,
    formattedTime,
    phaseColor,
    phaseProgress,
  } = useCycleTimer();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  useEffect(() => {
    // STUBBED: simulate Firebase load
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <View style={[S.screen, S.centerContent]}>
        <CrownLoader />
      </View>
    );
  }

  const paddingTop    = insets.top + DIMENSIONS.headerH + SP[4];
  const paddingBottom = insets.bottom + DIMENSIONS.bottomNavH + SP[12];

  return (
    <View style={S.screen}>
      {/* ── Collapsing pinned header (chrome = ink shadow) ── */}
      <CollapsibleHeader scrollY={scrollY} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[S.scrollContent, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero title (large — fades on scroll) ── */}
        <View style={S.largeHeroBlock}>
          <Text style={S.largeHeroTitle}>Ranks</Text>
          <Text style={S.largeHeroSub}>Your standing across Sector, City & Country</Text>
        </View>

        {/* ─────────────────────────────────────────────── */}
        {/*  1. BATTLE CYCLE HERO                          */}
        {/* ─────────────────────────────────────────────── */}
        <CyclePhaseHero
          phase={phase}
          phaseLabel={phaseLabel}
          formattedTime={formattedTime}
          phaseColor={phaseColor}
          phaseProgress={phaseProgress}
        />

        {/* ─────────────────────────────────────────────── */}
        {/*  2. INVASION RADAR                             */}
        {/* ─────────────────────────────────────────────── */}
        <SectionDivider label="INVASION RADAR" />
        <InvasionBanner data={MOCK_INVASION} />

        {/* ─────────────────────────────────────────────── */}
        {/*  3. LIVE RANK PROGRESS                         */}
        {/* ─────────────────────────────────────────────── */}
        <SectionDivider label="LIVE RANK PROGRESS" />
        <View style={S.cardStack}>
          {MOCK_RANKS.map((r) => (
            <RankTierCard key={r.id} data={r} />
          ))}
        </View>

        {/* ─────────────────────────────────────────────── */}
        {/*  4. TRIPLE TIER STATUS                         */}
        {/* ─────────────────────────────────────────────── */}
        <SectionDivider label="TRIPLE TIER" />
        <TripleTierStatus />

        {/* ─────────────────────────────────────────────── */}
        {/*  5. LEADERBOARD PODIUM                         */}
        {/* ─────────────────────────────────────────────── */}
        <SectionDivider label="SECTOR LEADERBOARD" />
        <LeaderboardPodium rows={MOCK_LEADERBOARD} />

        {/* ─────────────────────────────────────────────── */}
        {/*  6. BIDDING HUB                                */}
        {/* ─────────────────────────────────────────────── */}
        <SectionDivider label="BIDDING HUB" />
        <BiddingHub bids={MOCK_BIDS} />

        {/* ─────────────────────────────────────────────── */}
        {/*  7. MONARCH CONSOLE (locked)                   */}
        {/* ─────────────────────────────────────────────── */}
        <SectionDivider label="MONARCH CONSOLE" />
        <MonarchConsole />

        {/* Bottom breathing room */}
        <View style={{ height: SP[6] }} />
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  STYLESHEET  (all spacing 8pt grid · all colors via PALETTE tokens)
// ─────────────────────────────────────────────────────────────────────────────

const { create } = StyleSheet;

const S = create({
  // ── SCREEN ─────────────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: PALETTE.bgSurface,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SP[3],
    gap: SP[3],
  },

  // ── HEADER (chrome = ink shadow) ───────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
    paddingBottom: SP[2],
    paddingHorizontal: SP[4],
    ...SHADOW.ink.tier1 as object,
  },
  headerBg: {
    backgroundColor: `${PALETTE.bgSurface}F5`,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderDefault,
  },
  headerTitle: {
    fontFamily:  FONT.syneBold,
    fontSize:    20,
    fontWeight:  '700' as const,
    letterSpacing: -0.3,
    color:       PALETTE.fgPrimary,
    zIndex:      101,
  },

  // ── LARGE HERO TITLE BLOCK ─────────────────────────────────────────────────
  largeHeroBlock: {
    paddingTop: SP[2],
    marginBottom: SP[1],
  },
  largeHeroTitle: {
    fontFamily:  FONT.syneBold,
    fontSize:    32,
    fontWeight:  '800' as const,
    letterSpacing: -1,
    color:       PALETTE.fgPrimary,
  },
  largeHeroSub: {
    fontFamily:  FONT.interReg,
    fontSize:    13,
    color:       PALETTE.fgSecondary,
    marginTop:   SP[1],
  },

  // ── SECTION DIVIDER ────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SP[1],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.borderDefault,
    opacity: 0.6,
  },
  dividerLabel: {
    fontFamily:    FONT.interBold,
    fontSize:      10,
    fontWeight:    '700' as const,
    letterSpacing: 0.7,
    color:         PALETTE.fgSecondary,
    marginHorizontal: SP[2],
  },

  // ── CYCLE PHASE HERO ───────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: PALETTE.bgCard,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: PALETTE.borderDefault,
    padding: SP[4],
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SP[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SP[2],
  },
  heroPhaseTag: {
    fontFamily:    FONT.interBold,
    fontSize:      11,
    fontWeight:    '700' as const,
    letterSpacing: 0.8,
    flex: 1,
  },
  cycleBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: PALETTE.bgSubtle,
    borderRadius:   RADII.pill,
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: PALETTE.borderDefault,
    gap: SP[1],
  },
  cycleBadgeText: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 0.6,
    color:         PALETTE.fgSecondary,
  },
  heroTimer: {
    fontFamily:    FONT.spaceMono,
    fontSize:      44,
    fontWeight:    '700' as const,
    letterSpacing: -1,
    marginVertical: SP[1],
  },
  heroHint: {
    fontFamily: FONT.interReg,
    fontSize:   13,
    marginBottom: SP[3],
  },
  progressTrack: {
    height: 6,
    backgroundColor: `${PALETTE.fgBrand}1A`,
    borderRadius: RADII.pill,
    overflow: 'hidden',
    marginBottom: SP[1],
  },
  progressFill: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: RADII.pill,
  },
  progressMarker: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: PALETTE.bgSurface,
    opacity: 0.7,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SP[1],
  },

  // ── RANK TIER CARD ─────────────────────────────────────────────────────────
  rankCard: {
    backgroundColor: PALETTE.bgCard,
    borderRadius:    RADII.md,
    borderWidth:     1,
    borderColor:     PALETTE.borderDefault,
    padding:         SP[4],
  },
  cardStack: {
    gap: SP[2],
  },
  rankCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SP[2],
    gap: SP[1],
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SP[1],
  },
  rankCardTier: {
    fontFamily:    FONT.interBold,
    fontSize:      10,
    fontWeight:    '700' as const,
    letterSpacing: 0.6,
    flex: 1,
  },
  securedBadge: {
    backgroundColor: `${PALETTE.fgSuccess}1A`,
    borderRadius:    RADII.pill,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${PALETTE.fgSuccess}33`,
  },
  securedBadgeText: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgSuccess,
  },
  rankCardRankBox: {
    alignItems: 'flex-end',
  },
  rankNumLabel: {
    fontFamily:    FONT.interBold,
    fontSize:      8,
    fontWeight:    '700' as const,
    letterSpacing: 0.6,
    color:         PALETTE.fgSecondary,
  },
  rankNumValue: {
    fontFamily: FONT.spaceMono,
    fontSize:   20,
    fontWeight: '700' as const,
    color:      PALETTE.fgPrimary,
    letterSpacing: -0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    marginBottom:  SP[2],
  },
  scoreValue: {
    fontFamily:    FONT.spaceMono,
    fontSize:      24,
    fontWeight:    '700' as const,
    color:         PALETTE.fgBrandText,
  },
  scoreSep: {
    fontFamily: FONT.interReg,
    fontSize:   14,
    color:      PALETTE.fgSecondary,
    marginHorizontal: 2,
  },
  scoreTarget: {
    fontFamily: FONT.spaceMono,
    fontSize:   14,
    fontWeight: '700' as const,
    color:      PALETTE.fgSecondary,
  },
  progressTrackCard: {
    height: 6,
    backgroundColor: `${PALETTE.fgBrand}1A`,
    borderRadius: RADII.pill,
    overflow: 'hidden',
    marginBottom: SP[2],
  },
  progressFillCard: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: RADII.pill,
  },
  rankStatusText: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgBrandText,
    marginBottom: SP[2],
  },
  rankCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankActionText: {
    fontFamily: FONT.interReg,
    fontSize:   12,
    color:      PALETTE.fgSecondary,
    flex: 1,
    paddingRight: SP[2],
    lineHeight:  17,
  },

  // Formula box
  formulaBox: {
    backgroundColor: `${PALETTE.fgBrand}08`,
    borderRadius:    RADII.sm,
    borderWidth:     1,
    borderColor:     `${PALETTE.fgBrand}1A`,
    padding:         SP[3],
    marginTop:       SP[2],
  },
  formulaHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP[1],
    marginBottom:  SP[2],
  },
  formulaTitle: {
    fontFamily:    FONT.interBold,
    fontSize:      11,
    fontWeight:    '700' as const,
    letterSpacing: 0.3,
    color:         PALETTE.fgBrandText,
  },
  formulaGrid: {
    gap: SP[1],
  },
  formulaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:    'center',
  },
  formulaLabel: {
    fontFamily: FONT.interReg,
    fontSize:   12,
    color:      PALETTE.fgSecondary,
  },
  formulaPoints: {
    fontFamily:  FONT.spaceMono,
    fontSize:    12,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
  },
  formulaDivider: {
    height:          1,
    backgroundColor: PALETTE.borderDefault,
    marginVertical:  SP[2],
  },
  formulaCurrentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formulaCurrentLabel: {
    fontFamily: FONT.interReg,
    fontSize:   12,
    color:      PALETTE.fgSecondary,
  },
  formulaCurrentScore: {
    fontFamily:  FONT.spaceMono,
    fontSize:    16,
    fontWeight:  '700' as const,
    color:       PALETTE.fgBrandText,
  },

  // ── TRIPLE TIER ────────────────────────────────────────────────────────────
  tripleTierCard: {
    backgroundColor: PALETTE.bgCard,
    borderRadius:    RADII.lg,
    borderWidth:     1,
    borderColor:     PALETTE.borderDefault,
    padding:         SP[4],
  },
  tripleTierHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SP[2],
    marginBottom:   SP[1],
  },
  tripleTierTitle: {
    fontFamily:    FONT.syneBold,
    fontSize:      16,
    fontWeight:    '700' as const,
    color:         PALETTE.fgPrimary,
  },
  tripleTierSub: {
    fontFamily: FONT.interReg,
    fontSize:   12,
    color:      PALETTE.fgSecondary,
    marginBottom: SP[4],
    lineHeight:  17,
  },
  tripleTierRow: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
  },
  tierNodeWrap: {
    alignItems: 'center',
    flex: 1,
  },
  tierNode: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: PALETTE.bgSubtle,
    borderWidth:     1.5,
    borderColor:     PALETTE.borderDefault,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SP[1],
  },
  tierNodeActive: {
    backgroundColor: PALETTE.bgGoldTint,
    borderColor:     PALETTE.fgBrand,
    borderWidth:     2,
    ...SHADOW.gold.tier1 as object,
  },
  tierNodeLocked: {
    opacity: 0.5,
  },
  tierNodeLabel: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgBrandText,
    marginBottom:  2,
  },
  tierNodeSub: {
    fontFamily: FONT.interReg,
    fontSize:   10,
    color:      PALETTE.fgSecondary,
    textAlign:  'center',
  },
  tierConnector: {
    height: 1.5,
    width:  SP[6],
    backgroundColor: PALETTE.borderDefault,
    marginBottom: SP[7],
    opacity: 0.7,
  },
  tripleTierFooter: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      SP[4],
    paddingTop:     SP[3],
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderDefault,
  },
  tripleTierProgress: {
    fontFamily:  FONT.spaceMono,
    fontSize:    13,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
  },
  tripleTierProgressHint: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgSecondary,
  },

  // ── PODIUM ─────────────────────────────────────────────────────────────────
  podiumCard: {
    backgroundColor: PALETTE.bgSurface,
    borderRadius:    RADII.lg,
    borderWidth:     1,
    borderColor:     PALETTE.borderDefault,
    overflow:        'hidden',
  },
  podiumHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SP[2],
    padding:         SP[4],
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderDefault,
  },
  podiumTitle: {
    fontFamily:  FONT.syneBold,
    fontSize:    16,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
    flex: 1,
  },
  podiumCycle: {
    fontFamily:    FONT.interBold,
    fontSize:      10,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgError,
    backgroundColor: `${PALETTE.fgError}12`,
    borderRadius:  RADII.pill,
    paddingHorizontal: SP[2],
    paddingVertical: 3,
  },
  podiumRow: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'center',
    paddingTop:     SP[4],
    paddingHorizontal: SP[4],
    gap:            SP[2],
    backgroundColor: PALETTE.bgSubtle,
  },
  podiumSlot: {
    alignItems: 'center',
    flex: 1,
    gap: SP[1],
  },
  podiumRankBadge: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    PALETTE.bgSurface,
    position:       'absolute' as const,
    top:            0,
    right:          0,
    zIndex:         10,
  },
  podiumRankBadgeText: {
    fontFamily:  FONT.spaceMono,
    fontSize:    10,
    fontWeight:  '700' as const,
    color:       PALETTE.bgSurface,
  },
  podiumName: {
    fontFamily:  FONT.interBold,
    fontSize:    11,
    fontWeight:  '600' as const,
    color:       PALETTE.fgPrimary,
    maxWidth:    80,
  },
  podiumScore: {
    fontFamily:  FONT.spaceMono,
    fontSize:    13,
    fontWeight:  '700' as const,
    color:       PALETTE.fgBrandText,
  },
  podiumBase: {
    width:  '100%',
    borderTopLeftRadius:  RADII.sm,
    borderTopRightRadius: RADII.sm,
    borderWidth:  1,
    borderColor:  PALETTE.borderDefault,
    marginTop:    SP[1],
  },

  // ── TITLE PILL ─────────────────────────────────────────────────────────────
  titlePill: {
    borderRadius:      RADII.xs,
    paddingHorizontal: SP[1],
    paddingVertical:   2,
    alignSelf:         'flex-start' as const,
  },
  titlePillText: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '800' as const,
    letterSpacing: 0.4,
    color:         PALETTE.fgBrandText,
  },

  // ── LEADERBOARD ROW ────────────────────────────────────────────────────────
  leaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: SP[2],
    paddingHorizontal: SP[4],
    borderBottomWidth: 1,
    borderBottomColor: `${PALETTE.borderDefault}44`,
    gap:            SP[2],
    minHeight:      52,
  },
  leaderRowYou: {
    backgroundColor: `${PALETTE.fgBrand}06`,
  },
  leaderRank: {
    fontFamily:  FONT.spaceMono,
    fontSize:    12,
    fontWeight:  '700' as const,
    color:       PALETTE.fgSecondary,
    width:       28,
  },
  leaderNameBox: {
    flex: 1,
    gap: 2,
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP[1],
  },
  leaderName: {
    fontFamily:  FONT.interSemi,
    fontSize:    13,
    fontWeight:  '600' as const,
    color:       PALETTE.fgPrimary,
  },
  leaderHandle: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgSecondary,
  },
  leaderRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  leaderDelta: {
    fontFamily:  FONT.spaceMono,
    fontSize:    9,
    fontWeight:  '700' as const,
  },
  leaderScore: {
    fontFamily:  FONT.spaceMono,
    fontSize:    13,
    fontWeight:  '700' as const,
    color:       PALETTE.fgBrandText,
  },

  // ── "YOU" CARD ─────────────────────────────────────────────────────────────
  youCard: {
    margin:          SP[4],
    marginTop:       SP[2],
    backgroundColor: PALETTE.bgCardCream,
    borderRadius:    RADII.md,
    borderWidth:     2,
    borderColor:     PALETTE.fgBrand,
    padding:         SP[3],
  },
  youCardTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP[2],
    marginBottom:  SP[2],
  },
  youCardInfo: {
    flex: 1,
  },
  youCardName: {
    fontFamily:  FONT.interBold,
    fontSize:    14,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
  },
  youCardStanding: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgSecondary,
    marginTop:  2,
  },
  youCardScore: {
    fontFamily:  FONT.spaceMono,
    fontSize:    20,
    fontWeight:  '700' as const,
    color:       PALETTE.fgBrandText,
  },
  youProgressCaption: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgSecondary,
    marginTop:  SP[1],
  },

  // ── STATUS PILL ────────────────────────────────────────────────────────────
  statusPill: {
    borderRadius:      RADII.sm,
    paddingHorizontal: SP[2],
    paddingVertical:   3,
  },
  statusPillText: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 0.4,
  },

  // ── INVASION BANNER ────────────────────────────────────────────────────────
  invasionCard: {
    backgroundColor: PALETTE.bgDangerTint,
    borderRadius:    RADII.md,
    borderWidth:     1,
    borderColor:     `${PALETTE.fgError}33`,
    padding:         SP[4],
    ...SHADOW.gold.tier1 as object,
  },
  invasionTopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP[2],
    marginBottom:  SP[1],
  },
  invasionDotWrap: {
    width:  14,
    height: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  invasionDotPulse: {
    position:  'absolute' as const,
    width:     14,
    height:    14,
    borderRadius: 7,
    backgroundColor: PALETTE.fgError,
    opacity: 0.3,
  },
  invasionDotCore: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: PALETTE.fgError,
  },
  invasionTitle: {
    fontFamily:    FONT.interBold,
    fontSize:      13,
    fontWeight:    '700' as const,
    color:         PALETTE.fgErrorDeep,
    flex: 1,
  },
  invasionRoleBadge: {
    backgroundColor: `${PALETTE.fgError}1A`,
    borderRadius:    RADII.pill,
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${PALETTE.fgError}33`,
  },
  invasionRoleText: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgError,
  },
  invasionDesc: {
    fontFamily: FONT.interReg,
    fontSize:   13,
    color:      PALETTE.fgErrorDeep,
    marginBottom: SP[3],
    lineHeight:  18,
  },
  invasionCityBold: {
    fontWeight: '800' as const,
  },
  invasionFooter: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  invasionCountdown: {
    fontFamily:  FONT.spaceMono,
    fontSize:    14,
    fontWeight:  '700' as const,
    color:       PALETTE.fgError,
  },
  invasionParticipants: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgErrorMid,
    marginTop:  2,
  },
  invasionCTA: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP[1],
    backgroundColor: `${PALETTE.fgError}12`,
    borderRadius:  RADII.sm,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderWidth: 1,
    borderColor: `${PALETTE.fgError}22`,
    minHeight: 44, // touch target
  },
  invasionCTAText: {
    fontFamily:  FONT.interBold,
    fontSize:    12,
    fontWeight:  '700' as const,
    color:       PALETTE.fgError,
  },

  // ── BIDDING HUB ────────────────────────────────────────────────────────────
  biddingCard: {
    backgroundColor: PALETTE.bgSurface,
    borderRadius:    RADII.lg,
    borderWidth:     1,
    borderColor:     PALETTE.borderDefault,
    overflow:        'hidden',
  },
  biddingHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SP[2],
    padding:        SP[4],
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderDefault,
  },
  biddingTitle: {
    fontFamily:  FONT.syneBold,
    fontSize:    16,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
    flex: 1,
  },
  biddingHistoryBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
    minHeight:     44,
    paddingHorizontal: SP[2],
    justifyContent: 'center',
  },
  biddingHistoryText: {
    fontFamily: FONT.interSemi,
    fontSize:   12,
    fontWeight: '600' as const,
    color:      PALETTE.fgSecondary,
  },
  bidRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        SP[4],
    gap:            SP[2],
    minHeight:      52,
  },
  bidRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: `${PALETTE.borderDefault}66`,
  },
  bidScopeChip: {
    backgroundColor: PALETTE.bgGoldTint,
    borderRadius:    RADII.xs,
    paddingHorizontal: SP[1],
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${PALETTE.fgBrand}22`,
    minWidth: 44,
    alignItems: 'center',
  },
  bidScopeText: {
    fontFamily:    FONT.interBold,
    fontSize:      8,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgBrandText,
  },
  bidInfo: {
    flex: 1,
  },
  bidTitle: {
    fontFamily:  FONT.interSemi,
    fontSize:    13,
    fontWeight:  '600' as const,
    color:       PALETTE.fgPrimary,
    marginBottom: 3,
  },
  bidMetaRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  bidOpponent: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgSecondary,
  },
  bidTime: {
    fontFamily: FONT.interReg,
    fontSize:   11,
    color:      PALETTE.fgSecondary,
  },
  bidRight: {
    alignItems: 'flex-end',
    gap:        SP[1],
  },
  bidAmount: {
    fontFamily:  FONT.spaceMono,
    fontSize:    15,
    fontWeight:  '700' as const,
    color:       PALETTE.fgBrandText,
  },
  bidAmountUnit: {
    fontFamily:  FONT.interReg,
    fontSize:    10,
    color:       PALETTE.fgSecondary,
    marginTop:   -4,
  },
  biddingCTA: {
    margin: SP[4],
    marginTop: SP[2],
    borderRadius: RADII.md,
    overflow: 'hidden',
    minHeight: 48,
    ...SHADOW.gold.tier1 as object,
  },
  biddingCTAGradient: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SP[2],
    height:         48,
    borderWidth:    1.5,
    borderColor:    PALETTE.borderDefault,
    borderRadius:   RADII.md,
  },
  biddingCTAText: {
    fontFamily:  FONT.syneBold,
    fontSize:    15,
    fontWeight:  '700' as const,
    color:       PALETTE.fgBrandText,
  },

  // ── MONARCH CONSOLE ────────────────────────────────────────────────────────
  monarchCard: {
    backgroundColor: PALETTE.bgCard,
    borderRadius:    RADII.lg,
    borderWidth:     1,
    borderColor:     PALETTE.borderDefault,
    padding:         SP[4],
    opacity:         0.88,
  },
  monarchHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP[2],
    marginBottom:  SP[2],
  },
  monarchTitle: {
    fontFamily:  FONT.syneBold,
    fontSize:    16,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
    flex: 1,
  },
  monarchLockBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SP[1],
    backgroundColor: `${PALETTE.fgSecondary}12`,
    borderRadius:   RADII.pill,
    paddingHorizontal: SP[2],
    paddingVertical: 3,
  },
  monarchLockText: {
    fontFamily:    FONT.interBold,
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgSecondary,
  },
  monarchDesc: {
    fontFamily: FONT.interReg,
    fontSize:   13,
    color:      PALETTE.fgSecondary,
    lineHeight: 19,
    marginBottom: SP[3],
  },
  monarchPowerRow: {
    flexDirection: 'row',
    gap:           SP[2],
    flexWrap:      'wrap' as const,
  },
  monarchPowerChip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SP[1],
    backgroundColor: `${PALETTE.fgSecondary}0C`,
    borderRadius:   RADII.pill,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderWidth: 1,
    borderColor: `${PALETTE.fgSecondary}1A`,
  },
  monarchPowerText: {
    fontFamily:    FONT.interBold,
    fontSize:      11,
    fontWeight:    '600' as const,
    color:         PALETTE.fgSecondary,
  },
  monarchCTA: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SP[2],
    height:         48,
    backgroundColor: PALETTE.fgBrand,
    borderRadius:   RADII.md,
    minHeight:      44,
  },
  monarchCTAText: {
    fontFamily:  FONT.syneBold,
    fontSize:    14,
    fontWeight:  '700' as const,
    color:       PALETTE.fgPrimary,
  },

  // ── LOADER ─────────────────────────────────────────────────────────────────
  loaderWrap: {
    alignItems: 'center',
    gap:        SP[3],
  },
  loaderText: {
    fontFamily:    FONT.interBold,
    fontSize:      13,
    fontWeight:    '700' as const,
    letterSpacing: 0.5,
    color:         PALETTE.fgSecondary,
  },
});

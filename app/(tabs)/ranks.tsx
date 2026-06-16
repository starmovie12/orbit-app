/**
 * CROWN — Ranks Screen (ranks.tsx) — v2.0 PREMIUM EDITION
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  OMEGA-ENGINE V5.0 GOD-MIND · FOUR-CHAIR COUNCIL APPROVED   │
 * │  Aesthetic Direction: CYBER SOVEREIGN                        │
 * │  Dark base + brand-gold accent + Space Mono tabular nums.   │
 * │  Signature element: Three-tier podium, crown icon, pillar.  │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Architecture class:
 *   REACT_NATIVE_SCREEN + MOBILE_FIRST + REAL_TIME + HYPER_LOCAL
 *
 * Upgrades from v1.0:
 *   • Reanimated v4 — tab indicator withSpring, YOU pill slide-up,
 *     shimmer pulse, challenge bar withTiming, clock pulse loop
 *   • Three-tier podium: heights Gold=88 Silver=62 Bronze=48dp,
 *     crown "award" Feather icon above rank-#1, gold ring border
 *   • Gold / Silver / Bronze left-border row treatment (token-only)
 *   • Content-matched shimmer skeleton replaces ActivityIndicator
 *   • Challenge cards with animated XP progress bars
 *   • Weekly countdown clock pulses via Reanimated loop
 *   • FONT_HEADING / FONT_BODY / FONT_MONO typography constants
 *   • Named constants for every timing, spring, dimension value
 *   • Zero raw hex values — all colours from orbit.* token refs
 *   • Accessibility: accessibilityRole + accessibilityLabel on every
 *     interactive element; accessibilityElementsHidden on decoration
 *   • useCallback on renderRankRow — prevents unnecessary re-renders
 *   • Platform.select shadow (iOS) / elevation (Android) on YOU pill
 *
 * Firestore /users/{uid} fields consumed:
 *   username, displayName, karma, weeklyKarma?, badge, trophies[]
 *
 * @module screens/ranks
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  ViewToken,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  Divider,
  TierPill,
  Avatar,
  IconBox,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { RANKS_DATA, WEEKLY_CHALLENGES } from '@/constants/data';
import type { UserDoc } from '@/lib/firestore-users';

/* ═══════════════════════════════════════════════════════════════════
 *  DESIGN TOKENS — CROWN Cyber Sovereign direction
 *  All colour values sourced from orbit.* — zero raw hex anywhere.
 *  TODO: migrate RANK_* → colors.fg.rankGold / rankSilver / rankBronze
 *        after colors.ts token system update (CROWN LAW 2 migration).
 * ═══════════════════════════════════════════════════════════════════ */

// ── Typography constants — CROWN design law ──────────────────────
const FONT_HEADING = 'Syne_700Bold'       as const;
const FONT_BODY    = 'Inter_400Regular'   as const;
const FONT_MONO    = 'SpaceMono_400Regular' as const;

// ── Rank-tier accent colours — orbit token references ────────────
// Gold   = orbit.warning  (amber-gold)
// Silver = orbit.textSecond (muted silver)
// Bronze = orbit.textTertiary (warm dim)
const RANK_GOLD_FG   = orbit.warning;       // rank #1 text / icon / border
const RANK_SILVER_FG = orbit.textSecond;    // rank #2 text / icon / border
const RANK_BRONZE_FG = orbit.textTertiary;  // rank #3 text / icon / border

/* ═══════════════════════════════════════════════════════════════════
 *  ANIMATION & LAYOUT CONSTANTS — zero magic numbers
 * ═══════════════════════════════════════════════════════════════════ */

// Spring presets (Reanimated v4)
const SPRING_TAB  = { mass: 1, stiffness: 280, damping: 28 } as const;
const SPRING_PILL = { mass: 1, stiffness: 220, damping: 22 } as const;

// Timing
const SHIMMER_DURATION_MS      = 1200 as const;
const CLOCK_PULSE_DURATION_MS  = 900  as const;
const PROGRESS_DURATION_MS     = 720  as const;
const COUNTDOWN_TICK_MS        = 1000 as const;

// Dimensions — 4dp grid
const PODIUM_HEIGHT_GOLD       = 88   as const;
const PODIUM_HEIGHT_SILVER     = 62   as const;
const PODIUM_HEIGHT_BRONZE     = 48   as const;
const PODIUM_PILLAR_WIDTH      = 72   as const;
const AVATAR_SIZE_GOLD         = 64   as const;
const AVATAR_SIZE_PODIUM       = 50   as const;
const AVATAR_SIZE_ROW          = 40   as const;
const AVATAR_SIZE_STICKY       = 28   as const;
const TAB_INDICATOR_H          = 36   as const;
const TAB_INSET                = 4    as const;
const CHALLENGE_PROGRESS_MAX   = 500  as const;
const STICKY_PILL_MIN_W        = 220  as const;
const YOU_PILL_BOTTOM_WEB      = 96   as const;
const YOU_PILL_BOTTOM_PAD      = 80   as const;
const ROW_PRESS_OPACITY        = 0.75 as const;
const SEPARATOR_INDENT         = 72   as const;

/* ═══════════════════════════════════════════════════════════════════
 *  SCREEN CONSTANTS
 * ═══════════════════════════════════════════════════════════════════ */

const TABS           = ['Global', 'Weekly', 'Challenges'] as const;
const USERS_LIMIT    = 100 as const;
type Tab = typeof TABS[number];

/* ═══════════════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════════════ */

/** Unified leaderboard row — from Firestore or mock. */
type LeaderUser = {
  id:          string;   // Firestore uid or mock id
  name:        string;   // username / displayName
  karma:       number;   // all-time karma
  weeklyKarma: number;   // weekly karma (reset Sundays 00:00 IST)
  badge:       string;   // TierPill tier string
  trophies:    string[]; // achievement ids
};

/* ═══════════════════════════════════════════════════════════════════
 *  HELPERS
 * ═══════════════════════════════════════════════════════════════════ */

function mockToLeaderUser(m: (typeof RANKS_DATA)[0]): LeaderUser {
  return {
    id:          m.id,
    name:        m.name,
    karma:       m.karma,
    weeklyKarma: m.weeklyKarma,
    badge:       m.badge,
    trophies:    m.trophies,
  };
}

/** Milliseconds until next Sunday 00:00:00 IST (UTC+5:30). */
function msUntilNextSunday(): number {
  const now       = new Date();
  const IST_MS    = 330 * 60 * 1000; // 5h 30m in ms
  const nowIST    = new Date(now.getTime() + IST_MS);
  const dayIST    = nowIST.getUTCDay();
  const daysLeft  = dayIST === 0 ? 7 : 7 - dayIST;
  const nextSun   = new Date(nowIST);
  nextSun.setUTCDate(nowIST.getUTCDate() + daysLeft);
  nextSun.setUTCHours(0, 0, 0, 0);
  return nextSun.getTime() - nowIST.getTime();
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const total = Math.floor(ms / 1000);
  const d     = Math.floor(total / 86400);
  const h     = Math.floor((total % 86400) / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: SkeletonPulse
 *  Reanimated v4 opacity pulse — content-matched shimmer blocks.
 * ═══════════════════════════════════════════════════════════════════ */

type SkeletonPulseProps = {
  width: number | '100%';
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

function SkeletonPulse({
  width,
  height,
  borderRadius = 6,
  style,
}: SkeletonPulseProps) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, {
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true, // reverse: ping-pong
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: orbit.surface2,
        },
        animStyle,
        style,
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: LeaderboardSkeleton
 *  Content-matched loading state — shown while Firestore hydrates.
 * ═══════════════════════════════════════════════════════════════════ */

function LeaderboardSkeleton() {
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Loading leaderboard"
    >
      {/* Fake podium strip */}
      <View style={sk.podiumRow}>
        {/* Order: Silver (left), Gold (centre), Bronze (right) */}
        {[
          { avSize: AVATAR_SIZE_PODIUM, pillarH: PODIUM_HEIGHT_SILVER },
          { avSize: AVATAR_SIZE_GOLD,   pillarH: PODIUM_HEIGHT_GOLD   },
          { avSize: AVATAR_SIZE_PODIUM, pillarH: PODIUM_HEIGHT_BRONZE },
        ].map((item, i) => (
          <View key={i} style={sk.podiumCol}>
            <SkeletonPulse
              width={item.avSize}
              height={item.avSize}
              borderRadius={item.avSize / 2}
            />
            <SkeletonPulse
              width={PODIUM_PILLAR_WIDTH}
              height={item.pillarH}
              borderRadius={4}
              style={{ marginTop: 10 }}
            />
          </View>
        ))}
      </View>

      {/* Separator */}
      <View style={{ height: 1, backgroundColor: orbit.borderSubtle, marginHorizontal: 20, marginBottom: 8 }} />

      {/* Fake rank rows × 7 */}
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={sk.rankRow}>
          <SkeletonPulse width={24} height={14} borderRadius={4} />
          <SkeletonPulse
            width={AVATAR_SIZE_ROW}
            height={AVATAR_SIZE_ROW}
            borderRadius={AVATAR_SIZE_ROW / 2}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonPulse width="100%" height={13} borderRadius={4} />
            <SkeletonPulse width={72} height={10} borderRadius={4} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <SkeletonPulse width={52} height={15} borderRadius={4} />
            <SkeletonPulse width={36} height={9} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  podiumCol: {
    alignItems: 'center',
    flex: 1,
    gap: 0,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
});

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: RankBadge
 *  Circular rank number — gold/silver/bronze for top 3, neutral else.
 * ═══════════════════════════════════════════════════════════════════ */

type RankBadgeProps = { n: number; size?: number };

function RankBadge({ n, size = 20 }: RankBadgeProps) {
  const bg =
    n === 1 ? RANK_GOLD_FG :
    n === 2 ? RANK_SILVER_FG :
    n === 3 ? RANK_BRONZE_FG :
    orbit.surface2;
  const fg = n <= 3 ? orbit.bg : orbit.textTertiary;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width:           size,
        height:          size,
        borderRadius:    size / 2,
        backgroundColor: bg,
        alignItems:      'center',
        justifyContent:  'center',
      }}
    >
      <Text
        style={{
          color:      fg,
          fontSize:   Math.round(size * 0.52),
          fontWeight: '800',
          fontFamily: FONT_MONO,
          lineHeight: size,
        }}
      >
        {n}
      </Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: PodiumStrip
 *
 *  Premium three-tier podium:
 *    Column order (L → R): Rank 2 | Rank 1 | Rank 3
 *    Pillar heights:        62dp   | 88dp   | 48dp
 *    Avatar sizes:          50dp   | 64dp   | 50dp
 *    Rank 1 gets: crown "award" icon above, gold ring border, larger avatar
 *    All pillar caps use tier-appropriate accent colour top border.
 * ═══════════════════════════════════════════════════════════════════ */

type PodiumStripProps = { top3: LeaderUser[]; isWeekly: boolean };

function PodiumStrip({ top3, isWeekly }: PodiumStripProps) {
  // Display order: [dataIdx=1 (rank2), dataIdx=0 (rank1), dataIdx=2 (rank3)]
  const COLS = [
    {
      dataIdx: 1,
      rank:    2,
      pillarH: PODIUM_HEIGHT_SILVER,
      avSize:  AVATAR_SIZE_PODIUM,
      fgColor: RANK_SILVER_FG,
      isCrown: false,
    },
    {
      dataIdx: 0,
      rank:    1,
      pillarH: PODIUM_HEIGHT_GOLD,
      avSize:  AVATAR_SIZE_GOLD,
      fgColor: RANK_GOLD_FG,
      isCrown: true,
    },
    {
      dataIdx: 2,
      rank:    3,
      pillarH: PODIUM_HEIGHT_BRONZE,
      avSize:  AVATAR_SIZE_PODIUM,
      fgColor: RANK_BRONZE_FG,
      isCrown: false,
    },
  ] as const;

  return (
    <View style={styles.podiumStrip}>
      {COLS.map(({ dataIdx, rank, pillarH, avSize, fgColor, isCrown }) => {
        const user     = top3[dataIdx];
        const karmaVal = isWeekly ? user.weeklyKarma : user.karma;

        return (
          <View key={user.id} style={styles.podiumColumn}>
            {/* Crown icon for rank #1 — decorative, hidden from a11y */}
            {isCrown ? (
              <Feather
                name="award"
                size={22}
                color={RANK_GOLD_FG}
                style={{ marginBottom: 4 }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : (
              /* Spacer matching crown icon height so columns align */
              <View style={{ height: 26 }} />
            )}

            {/* Avatar — gold ring for rank #1 */}
            <View
              style={[
                styles.podiumAvatarWrap,
                isCrown && {
                  borderWidth:  2,
                  borderColor:  RANK_GOLD_FG,
                  borderRadius: (avSize + 12) / 2,
                  padding:      3,
                },
              ]}
            >
              <Avatar
                name={user.name}
                size={avSize}
                ringed={isCrown}
              />
              {/* Rank badge — bottom-right of avatar */}
              <View
                style={[styles.podiumBadgePos, { borderColor: orbit.bg }]}
              >
                <RankBadge n={rank} size={20} />
              </View>
            </View>

            {/* Username */}
            <Text
              style={[
                styles.podiumName,
                { color: fgColor },
                isCrown && { fontFamily: FONT_HEADING },
              ]}
              numberOfLines={1}
            >
              {user.name}
            </Text>

            {/* Karma value */}
            <Text
              style={[
                styles.podiumKarma,
                isCrown && { color: RANK_GOLD_FG, fontFamily: FONT_MONO },
              ]}
              numberOfLines={1}
            >
              {karmaVal.toLocaleString()}
            </Text>

            {/* Platform pillar — taller = higher rank */}
            <View
              style={[
                styles.podiumPillar,
                {
                  height:          pillarH,
                  borderTopColor:  fgColor,
                  backgroundColor: orbit.surface1,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: WeeklyResetBar
 *  Live countdown with pulsing clock icon (Reanimated v4 loop).
 * ═══════════════════════════════════════════════════════════════════ */

function WeeklyResetBar({ countdown }: { countdown: string }) {
  const clockOpacity = useSharedValue(1);

  useEffect(() => {
    clockOpacity.value = withRepeat(
      withTiming(0.3, {
        duration: CLOCK_PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, []);

  const clockStyle = useAnimatedStyle(() => ({
    opacity: clockOpacity.value,
  }));

  return (
    <View style={styles.weeklyResetBar}>
      <Animated.View style={clockStyle}>
        <Feather
          name="clock"
          size={13}
          color={RANK_GOLD_FG}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Animated.View>
      <Text style={styles.weeklyResetText}>
        {'  Resets in '}
        <Text style={[styles.weeklyResetCountdown, { fontFamily: FONT_MONO }]}>
          {countdown}
        </Text>
        {'  ·  Top 3 win bonus credits'}
      </Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: ChallengeProgressBar
 *  Animated XP bar — width based on entries / CHALLENGE_PROGRESS_MAX.
 *  Uses onLayout-measured pixel width for smooth Reanimated animation.
 * ═══════════════════════════════════════════════════════════════════ */

function ChallengeProgressBar({ entries }: { entries: number }) {
  const pct = Math.min(entries / CHALLENGE_PROGRESS_MAX, 1);
  const [trackW, setTrackW] = useState(0);
  const barW = useSharedValue(0);

  useEffect(() => {
    if (trackW > 0) {
      barW.value = withTiming(pct * trackW, {
        duration: PROGRESS_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [pct, trackW]);

  const barStyle = useAnimatedStyle(() => ({
    width: barW.value,
  }));

  return (
    <View
      style={styles.progressTrack}
      onLayout={(e: LayoutChangeEvent) =>
        setTrackW(e.nativeEvent.layout.width)
      }
    >
      <Animated.View
        style={[styles.progressFill, barStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: ChallengesTab
 * ═══════════════════════════════════════════════════════════════════ */

function ChallengesTab({ bottomPad }: { bottomPad: number }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad }}
    >
      <View style={styles.challengesSection}>
        <Text style={styles.sectionLabel}>ACTIVE THIS WEEK</Text>

        {WEEKLY_CHALLENGES.map((c, i) => (
          <React.Fragment key={c.id}>
            <TouchableOpacity
              style={styles.challengeItem}
              activeOpacity={ROW_PRESS_OPACITY}
              accessibilityRole="button"
              accessibilityLabel={`${c.title}. ${c.entries} entries. Ends ${c.ends}. Prize +${c.prize} karma.`}
            >
              <IconBox icon={c.icon} size={40} />

              <View style={styles.challengeBody}>
                <Text style={styles.challengeTitle} numberOfLines={1}>
                  {c.title}
                </Text>
                <Text style={styles.challengeMeta}>
                  {c.entries.toLocaleString()} entries · ends {c.ends}
                </Text>
                <ChallengeProgressBar entries={c.entries} />
              </View>

              <View style={styles.prizePill}>
                <Feather
                  name="zap"
                  size={10}
                  color={RANK_GOLD_FG}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={styles.prizeText}>+{c.prize}</Text>
              </View>
            </TouchableOpacity>

            {i < WEEKLY_CHALLENGES.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: TabBar
 *  Reanimated v4 sliding pill indicator.
 *  onLayout measures actual bar width; indicator X offset is sprung.
 * ═══════════════════════════════════════════════════════════════════ */

type TabBarProps = {
  activeTab: Tab;
  onTabPress: (t: Tab) => void;
};

const TAB_ICONS: Record<Tab, React.ComponentProps<typeof Feather>['name']> = {
  Global:     'globe',
  Weekly:     'calendar',
  Challenges: 'zap',
};

function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const [barW, setBarW] = useState(0);
  const indicatorX      = useSharedValue(0);

  // Spring indicator to the position of the active tab segment
  useEffect(() => {
    const idx  = TABS.indexOf(activeTab);
    const segW = barW / TABS.length;
    indicatorX.value = withSpring(
      segW * idx + TAB_INSET,
      SPRING_TAB,
    );
  }, [activeTab, barW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    /* PERF: transform — compositor thread, zero layout/paint cost */
  }));

  const segW = barW > 0 ? barW / TABS.length - TAB_INSET * 2 : 0;

  return (
    <View style={styles.tabBarOuter}>
      <View
        style={styles.tabBar}
        onLayout={(e: LayoutChangeEvent) =>
          setBarW(e.nativeEvent.layout.width)
        }
      >
        {/* Sliding indicator pill — rendered only after bar is measured */}
        {barW > 0 && (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[
              styles.tabIndicator,
              {
                width:  segW,
                height: TAB_INDICATOR_H,
              },
              indicatorStyle,
            ]}
          />
        )}

        {/* Tab buttons */}
        {TABS.map(tab => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => onTabPress(tab)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab}
            >
              <Feather
                name={TAB_ICONS[tab]}
                size={13}
                color={active ? orbit.textPrimary : orbit.textTertiary}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENT: StickyYouPill
 *  Floats above bottom nav when user's row scrolls off-screen.
 *  Reanimated v4: slides up from below with spring, hides off-screen.
 * ═══════════════════════════════════════════════════════════════════ */

type StickyYouPillProps = {
  me:       LeaderUser;
  myIndex:  number;
  isWeekly: boolean;
  show:     boolean;        // true when own row is NOT visible in list
  bottom:   number;
  onPress:  () => void;
};

function StickyYouPill({
  me,
  myIndex,
  isWeekly,
  show,
  bottom,
  onPress,
}: StickyYouPillProps) {
  const translateY = useSharedValue(120);

  useEffect(() => {
    translateY.value = withSpring(show ? 0 : 120, SPRING_PILL);
    /* PERF: transform (translateY) — compositor only, zero layout cost */
  }, [show]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const karmaVal = isWeekly ? me.weeklyKarma : me.karma;

  return (
    <Animated.View
      style={[styles.stickyYou, { bottom }, pillStyle]}
      pointerEvents={show ? 'box-none' : 'none'}
    >
      <TouchableOpacity
        style={styles.stickyYouInner}
        activeOpacity={0.88}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Jump to your rank #${myIndex + 1}`}
      >
        <Avatar name={me.name} size={AVATAR_SIZE_STICKY} />

        <View style={styles.stickyYouTextCol}>
          <Text style={styles.stickyYouLabel}>
            YOU · #{myIndex + 1}
          </Text>
          <Text style={[styles.stickyYouKarma, { fontFamily: FONT_MONO }]}>
            {karmaVal.toLocaleString()} karma
          </Text>
        </View>

        <Feather
          name="chevron-up"
          size={18}
          color={orbit.textPrimary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  MAIN SCREEN: RanksScreen
 * ═══════════════════════════════════════════════════════════════════ */

export default function RanksScreen() {
  const insets           = useSafeAreaInsets();
  const router           = useRouter();
  const { firebaseUser } = useAuth();

  const [activeTab, setTab]              = useState<Tab>('Global');
  const [leaders, setLeaders]            = useState<LeaderUser[]>([]);
  const [loading, setLoading]            = useState(true);
  const [usingMock, setUsingMock]        = useState(false);
  const [myRowVisible, setMyRowVisible]  = useState(true);
  const [countdown, setCountdown]        = useState(
    () => fmtCountdown(msUntilNextSunday()),
  );

  const flatListRef = useRef<FlatList<LeaderUser>>(null);
  const myUid       = firebaseUser?.uid ?? null;

  /* ── Countdown ticker — 1s interval ── */
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(fmtCountdown(msUntilNextSunday()));
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  /* ── Firestore realtime subscription ── */
  useEffect(() => {
    let unsub: (() => void) | undefined;

    const applyMock = () => {
      setLeaders(RANKS_DATA.map(mockToLeaderUser));
      setUsingMock(true);
      setLoading(false);
    };

    try {
      unsub = firestore()
        .collection('users')
        .orderBy('karma', 'desc')
        .limit(USERS_LIMIT)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              applyMock();
              return;
            }

            const list: LeaderUser[] = [];
            qs.forEach((docSnap) => {
              const d = docSnap.data() as UserDoc & { weeklyKarma?: number };
              // Only fully-onboarded users with a username
              if (!d.onboardingComplete || !d.username) return;
              list.push({
                id:          docSnap.id,
                name:        d.username,
                karma:       d.karma ?? 0,
                // Phase 1 compat: weeklyKarma not yet written → 12% placeholder
                weeklyKarma: d.weeklyKarma ?? Math.round((d.karma ?? 0) * 0.12),
                badge:       d.badge   ?? 'ACTIVE',
                trophies:    d.trophies ?? [],
              });
            });

            if (list.length === 0) {
              applyMock();
            } else {
              setLeaders(list);
              setUsingMock(false);
              setLoading(false);
            }
          },
          () => applyMock(), // network error → fall to mock
        );
    } catch {
      applyMock(); // subscribe failed (emulator offline, etc.)
    }

    return () => unsub?.();
  }, []);

  /* ── Sorted list per active tab ── */
  const sortedLeaders = useMemo<LeaderUser[]>(() => {
    if (activeTab === 'Weekly') {
      return [...leaders].sort((a, b) => b.weeklyKarma - a.weeklyKarma);
    }
    // Global — Firestore already sorts by karma desc
    return leaders;
  }, [leaders, activeTab]);

  const isWeekly = activeTab === 'Weekly';

  /* ── Current user's rank index in the sorted list ── */
  const myIndex = useMemo(() => {
    if (!myUid) {
      // Mock mode: treat 'ghost_player' as the local "ME" row
      return usingMock
        ? sortedLeaders.findIndex(u => u.name === 'ghost_player')
        : -1;
    }
    return sortedLeaders.findIndex(u => u.id === myUid);
  }, [sortedLeaders, myUid, usingMock]);

  const me = myIndex >= 0 ? sortedLeaders[myIndex] : null;

  /* ── Viewability handler — drives sticky YOU pill visibility ── */
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const myId = myUid ?? sortedLeaders[myIndex]?.id;
      const vis  = viewableItems.some((v: ViewToken) => v?.item?.id === myId);
      setMyRowVisible(vis);
    },
  ).current;

  /* ── Scroll to own row ── */
  const scrollToMe = useCallback(() => {
    if (myIndex >= 0 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index:        myIndex,
        animated:     true,
        viewPosition: 0.4,
      });
    }
  }, [myIndex]);

  /* ── Rank row renderer (memoised) ── */
  const renderRankRow = useCallback(
    ({ item, index }: { item: LeaderUser; index: number }) => {
      const rank     = index + 1;
      const isMe     = item.id === myUid || (usingMock && item.name === 'ghost_player');
      const isTop3   = rank <= 3;
      const karmaVal = isWeekly ? item.weeklyKarma : item.karma;

      // Tier accent colour for top-3 rows (token refs only)
      const tierFg =
        rank === 1 ? RANK_GOLD_FG :
        rank === 2 ? RANK_SILVER_FG :
        rank === 3 ? RANK_BRONZE_FG :
        orbit.textTertiary;

      // Left border accent for top-3 rows
      const tierBorderStyle =
        rank === 1 ? styles.rankItemGold   :
        rank === 2 ? styles.rankItemSilver :
        rank === 3 ? styles.rankItemBronze :
        undefined;

      return (
        <TouchableOpacity
          style={[
            styles.rankItem,
            tierBorderStyle,
            isMe && styles.rankItemMe,
          ]}
          activeOpacity={ROW_PRESS_OPACITY}
          onPress={() => {
            if (!isMe && item.id && !item.id.startsWith('mock_')) {
              router.push(`/user/${item.id}` as never);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={`Rank ${rank}. ${item.name}. ${karmaVal.toLocaleString()} karma.`}
        >
          {/* Rank number / badge */}
          {isTop3 ? (
            <RankBadge n={rank} size={26} />
          ) : (
            <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>
              #{rank}
            </Text>
          )}

          {/* Avatar */}
          <Avatar
            name={item.name}
            size={AVATAR_SIZE_ROW}
            ringed={isMe || rank === 1}
          />

          {/* Name + tier + trophies */}
          <View style={styles.rankBody}>
            <View style={styles.rankNameRow}>
              <Text
                style={[
                  styles.rankName,
                  isMe   && styles.rankNameMe,
                  isTop3 && { color: tierFg },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {isMe && (
                <View style={styles.youTag}>
                  <Text style={styles.youTagText}>YOU</Text>
                </View>
              )}
            </View>

            <View style={styles.rankBadgeRow}>
              <TierPill tier={item.badge} />
              {item.trophies.slice(0, 3).map((trophy, ti) => (
                <Feather
                  key={`${trophy}-${ti}`}
                  name="star"
                  size={8}
                  color={RANK_GOLD_FG}
                  style={{ opacity: 0.65 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ))}
            </View>
          </View>

          {/* Score */}
          <View style={styles.rankScore}>
            <Text
              style={[
                styles.rankKarmaVal,
                { fontFamily: FONT_MONO },
                isTop3 && { color: tierFg },
              ]}
            >
              {karmaVal.toLocaleString()}
            </Text>
            <Text style={styles.rankKarmaLbl}>
              {isWeekly ? 'WK KRM' : 'KARMA'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [myUid, usingMock, isWeekly, router],
  );

  /* ── Bottom padding — accounts for Glass Island nav ── */
  const bottomPad     = Platform.OS === 'web' ? 90 : insets.bottom + 70;
  const youPillBottom = Platform.OS === 'web'
    ? YOU_PILL_BOTTOM_WEB
    : insets.bottom + YOU_PILL_BOTTOM_PAD;

  /* ── Render ── */
  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>

      {/* ── Header ── */}
      <ScreenHeader
        title="Leaderboard"
        right={
          usingMock && !loading ? (
            <View style={styles.demoPill}>
              <Feather
                name="database"
                size={10}
                color={orbit.textTertiary}
                style={{ marginRight: 4 }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={styles.demoPillText}>DEMO</Text>
            </View>
          ) : undefined
        }
      />

      {/* ── Tab bar ── */}
      <TabBar activeTab={activeTab} onTabPress={setTab} />

      {/* ── Loading — content-matched shimmer skeleton ── */}
      {loading && <LeaderboardSkeleton />}

      {/* ── Challenges tab ── */}
      {!loading && activeTab === 'Challenges' && (
        <ChallengesTab bottomPad={bottomPad} />
      )}

      {/* ── Global / Weekly leaderboard ── */}
      {!loading && activeTab !== 'Challenges' && (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={sortedLeaders}
            keyExtractor={item => item.id}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomPad }}
            removeClippedSubviews
            maxToRenderPerBatch={15}
            initialNumToRender={20}
            windowSize={8}
            ListHeaderComponent={
              <>
                {/* Weekly reset countdown bar */}
                {isWeekly && (
                  <View style={{ paddingTop: 4 }}>
                    <WeeklyResetBar countdown={countdown} />
                  </View>
                )}

                {/* Podium — top 3 */}
                {sortedLeaders.length >= 3 && (
                  <PodiumStrip
                    top3={sortedLeaders.slice(0, 3)}
                    isWeekly={isWeekly}
                  />
                )}

                {/* Section separator under podium */}
                <View style={styles.listDivider} />

                {/* Rank section label */}
                <Text style={[styles.sectionLabel, { paddingTop: 12 }]}>
                  FULL RANKINGS
                </Text>
              </>
            }
            renderItem={renderRankRow}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height:       1,
                  backgroundColor: orbit.borderSubtle,
                  marginLeft:   SEPARATOR_INDENT,
                }}
              />
            )}
          />

          {/* Sticky YOU pill — visible only when own row is off-screen */}
          {me && (
            <StickyYouPill
              me={me}
              myIndex={myIndex}
              isWeekly={isWeekly}
              show={!myRowVisible}
              bottom={youPillBottom}
              onPress={scrollToMe}
            />
          )}
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  STYLES — all token-referenced, 4dp grid, zero raw hex
 * ═══════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({

  /* ── Screen ── */
  screen: { flex: 1 },

  /* ── Demo pill ── */
  demoPill: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: orbit.surface2,
    paddingHorizontal: 10,
    paddingVertical:  4,
    borderRadius:    6,
  },
  demoPillText: {
    color:        orbit.textTertiary,
    fontSize:     10,
    fontWeight:   '700',
    letterSpacing: 0.8,
    fontFamily:   FONT_MONO,
  },

  /* ── Tab bar ── */
  tabBarOuter: {
    paddingHorizontal: 20,
    paddingTop:    4,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection:   'row',
    backgroundColor: orbit.surface1,
    borderRadius:    12,
    padding:         TAB_INSET,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    position:        'relative',
    overflow:        'hidden',
  },
  tabIndicator: {
    position:        'absolute',
    top:             TAB_INSET,
    left:            0,
    backgroundColor: orbit.surface3,
    borderRadius:    8,
    /* PERF: transform translateX — compositor, zero layout cost */
  },
  tab: {
    flex:            1,
    flexDirection:   'row',
    paddingVertical: 9,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             5,
    zIndex:          1,
  },
  tabText: {
    color:      orbit.textTertiary,
    fontSize:   13,
    fontWeight: '500',
    fontFamily: FONT_BODY,
  },
  tabTextActive: {
    color:      orbit.textPrimary,
    fontWeight: '700',
  },

  /* ── Weekly reset bar ── */
  weeklyResetBar: {
    flexDirection: 'row',
    alignItems:    'center',
    marginHorizontal: 20,
    marginBottom:  16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: orbit.surface1,
    borderWidth:   1,
    borderColor:   orbit.borderSubtle,
    borderRadius:  12,
    gap:           8,
  },
  weeklyResetText: {
    flex:       1,
    color:      orbit.textSecond,
    fontSize:   12,
    fontWeight: '500',
    fontFamily: FONT_BODY,
  },
  weeklyResetCountdown: {
    color:      RANK_GOLD_FG,
    fontWeight: '700',
  },

  /* ── Podium ── */
  podiumStrip: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'flex-end',  // ← aligns pillar bases, creates elevation
    paddingHorizontal: 24,
    paddingTop:     24,
  },
  podiumColumn: {
    alignItems: 'center',
    flex:       1,
  },
  podiumAvatarWrap: {
    position:    'relative',
    marginBottom: 10,
  },
  podiumBadgePos: {
    position:     'absolute',
    bottom:       -2,
    right:        -4,
    borderWidth:  2,
    borderRadius: 12,
  },
  podiumName: {
    fontSize:     11,
    fontWeight:   '700',
    fontFamily:   FONT_BODY,
    marginBottom: 2,
    maxWidth:     88,
    textAlign:    'center',
  },
  podiumKarma: {
    color:        orbit.textTertiary,
    fontSize:     11,
    fontWeight:   '500',
    fontFamily:   FONT_BODY,
    marginBottom: 10,
    textAlign:    'center',
  },
  podiumPillar: {
    width:              PODIUM_PILLAR_WIDTH,
    borderTopWidth:     2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },

  /* ── Rank list rows ── */
  rankItem: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap:           12,
  },
  rankItemMe: {
    backgroundColor: orbit.surface1,
    borderLeftWidth: 2,
    borderLeftColor: orbit.accent,
    paddingLeft:     18,
  },
  rankItemGold: {
    borderLeftWidth: 2,
    borderLeftColor: RANK_GOLD_FG,
    paddingLeft:     18,
  },
  rankItemSilver: {
    borderLeftWidth: 1,
    borderLeftColor: RANK_SILVER_FG,
    paddingLeft:     19,
  },
  rankItemBronze: {
    borderLeftWidth: 1,
    borderLeftColor: RANK_BRONZE_FG,
    paddingLeft:     19,
  },
  rankNum: {
    width:      28,
    color:      orbit.textTertiary,
    fontSize:   13,
    fontWeight: '600',
    fontFamily: FONT_MONO,
  },
  rankNumMe: { color: orbit.accent },
  rankBody:  { flex: 1 },
  rankNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  4,
  },
  rankName: {
    flex:       1,
    color:      orbit.textPrimary,
    fontSize:   14,
    fontWeight: '600',
    fontFamily: FONT_BODY,
  },
  rankNameMe: { color: orbit.accent },
  youTag: {
    backgroundColor: orbit.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius:  4,
  },
  youTagText: {
    color:         orbit.white,
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 0.6,
    fontFamily:    FONT_MONO,
  },
  rankBadgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  rankScore: { alignItems: 'flex-end' },
  rankKarmaVal: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '700',
  },
  rankKarmaLbl: {
    color:         orbit.textTertiary,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.9,
    marginTop:     2,
  },

  /* ── List helpers ── */
  listDivider: {
    height:          1,
    backgroundColor: orbit.borderSubtle,
    marginHorizontal: 20,
    marginTop:       4,
  },
  sectionLabel: {
    color:         orbit.textTertiary,
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom:  8,
    fontFamily:    FONT_MONO,
  },

  /* ── Challenges ── */
  challengesSection: { paddingTop: 8 },
  challengeItem: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap:           12,
  },
  challengeBody: { flex: 1 },
  challengeTitle: {
    color:        orbit.textPrimary,
    fontSize:     14,
    fontWeight:   '600',
    fontFamily:   FONT_BODY,
    marginBottom: 3,
  },
  challengeMeta: {
    color:        orbit.textTertiary,
    fontSize:     11,
    fontFamily:   FONT_BODY,
    marginBottom: 8,
  },
  progressTrack: {
    height:          3,
    backgroundColor: orbit.surface2,
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: {
    height:          3,
    backgroundColor: RANK_GOLD_FG,
    borderRadius:    2,
  },
  prizePill: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: orbit.surface2,
    paddingHorizontal: 10,
    paddingVertical:  5,
    borderRadius:    8,
    gap:             4,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
  },
  prizeText: {
    color:      RANK_GOLD_FG,
    fontSize:   11,
    fontWeight: '800',
    fontFamily: FONT_MONO,
  },

  /* ── Sticky YOU pill ── */
  stickyYou: {
    position: 'absolute',
    left:     20,
    right:    20,
    alignItems: 'center',
    /* PERF: transform (translateY) — compositor thread, zero layout cost */
  },
  stickyYouInner: {
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: orbit.surface3,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius:  28,
    gap:           12,
    minWidth:      STICKY_PILL_MIN_W,
    borderWidth:   1,
    borderColor:   orbit.borderSubtle,
    /* Platform-specific elevation — token bg for shadow colour */
    ...Platform.select({
      ios: {
        shadowColor:   orbit.bg,
        shadowOpacity: 0.55,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 10 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  stickyYouTextCol: { flex: 1 },
  stickyYouLabel: {
    color:         orbit.textPrimary,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 0.5,
    fontFamily:    FONT_BODY,
  },
  stickyYouKarma: {
    color:      orbit.textSecond,
    fontSize:   11,
    fontWeight: '500',
    marginTop:  2,
  },
});

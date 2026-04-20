/**
 * ORBIT — Ranks Tab (ranks.tsx)
 *
 * Upgraded: mock RANKS_DATA → live Firestore /users collection.
 *
 * Changes:
 *   • Global tab: subscribes to /users orderBy('karma','desc').limit(100)
 *   • Weekly tab: same snapshot, sorted by weeklyKarma field (falls back
 *     to karma if weeklyKarma not present — Phase 1 compat)
 *   • Live weekly reset countdown — ticks every second, shows d/h/m/s
 *     until next Sunday 00:00 IST. Shown in Weekly tab header bar.
 *   • Challenges tab: WEEKLY_CHALLENGES mock preserved (Firestore
 *     /challenges collection wired in Phase 2)
 *   • My row: identified by firebaseUser.uid matching doc.id
 *   • Sticky "YOU" pill: shows when own row scrolls off-screen
 *   • Falls back to RANKS_DATA mock when Firestore returns empty / offline
 *
 * Firestore /users/{uid} fields consumed (subset of UserDoc):
 *   username, displayName, karma, weeklyKarma?, badge, trophies[]
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
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

/* ─── Constants ─────────────────────────────────────────────────────────── */

const TABS          = ['Global', 'Weekly', 'Challenges'] as const;
type Tab            = typeof TABS[number];
const USERS_LIMIT   = 100;
const USERS_COLL    = 'users';

/* ─── Types ──────────────────────────────────────────────────────────────── */

/** Unified leaderboard row — from Firestore or mock. */
type LeaderUser = {
  id:          string;    // uid
  name:        string;    // username
  karma:       number;
  weeklyKarma: number;
  badge:       string;
  trophies:    string[];
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function mockToLeaderUser(m: typeof RANKS_DATA[0]): LeaderUser {
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
  const now      = new Date();
  // IST offset = +5h 30m = 330 min
  const istOffset = 330 * 60 * 1000;
  const nowIST   = new Date(now.getTime() + istOffset);
  const dayIST   = nowIST.getUTCDay(); // 0 = Sunday
  const daysLeft = dayIST === 0 ? 7 : 7 - dayIST;

  const nextSunIST = new Date(nowIST);
  nextSunIST.setUTCDate(nowIST.getUTCDate() + daysLeft);
  nextSunIST.setUTCHours(0, 0, 0, 0);

  return nextSunIST.getTime() - nowIST.getTime();
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const total = Math.floor(ms / 1000);
  const d     = Math.floor(total / 86400);
  const h     = Math.floor((total % 86400) / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = total % 60;
  if (d > 0)  return `${d}d ${h}h ${m}m`;
  if (h > 0)  return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Numeric rank circle — gold/silver/bronze for top 3, neutral otherwise. */
function RankBadge({ n, size = 18 }: { n: number; size?: number }) {
  const bg =
    n === 1 ? '#E8A33D' :
    n === 2 ? '#B0B0B5' :
    n === 3 ? '#C8896B' :
    orbit.surface2;
  const fg = n <= 3 ? '#0A0A0B' : orbit.textSecond;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: size * 0.55, fontWeight: '700' }}>{n}</Text>
    </View>
  );
}

/** Top-3 podium strip — always rendered as ListHeaderComponent. */
function PodiumStrip({ top3, isWeekly }: { top3: LeaderUser[]; isWeekly: boolean }) {
  return (
    <View style={styles.podiumStrip}>
      {top3.map((u, i) => {
        const rank = i + 1;
        return (
          <View key={u.id} style={styles.podiumColumn}>
            <View style={styles.podiumAvatarWrap}>
              <Avatar name={u.name} size={56} />
              <View style={styles.podiumBadgePos}>
                <RankBadge n={rank} size={22} />
              </View>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{u.name}</Text>
            <Text style={styles.podiumKarma}>
              {(isWeekly ? u.weeklyKarma : u.karma).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Live countdown bar shown in Weekly header. */
function WeeklyResetBar({ countdown }: { countdown: string }) {
  return (
    <View style={styles.weeklyResetBar}>
      <Feather name="clock" size={13} color={orbit.warning} style={{ marginRight: 8 }} />
      <Text style={styles.weeklyResetText}>
        Resets in{' '}
        <Text style={styles.weeklyResetCountdown}>{countdown}</Text>
        {'  ·  '}Top 3 win bonus credits
      </Text>
    </View>
  );
}

/** Challenges tab content. */
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
            <TouchableOpacity style={styles.challengeItem} activeOpacity={0.7}>
              <IconBox icon={c.icon} size={40} />
              <View style={styles.challengeBody}>
                <Text style={styles.challengeTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.challengeMeta}>
                  {c.entries} entries · ends {c.ends}
                </Text>
              </View>
              <View style={styles.prizePill}>
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

/* ─── Main Screen ────────────────────────────────────────────────────────── */

export default function RanksScreen() {
  const insets         = useSafeAreaInsets();
  const router         = useRouter();
  const { firebaseUser } = useAuth();

  const [activeTab, setTab]        = useState<Tab>('Global');
  const [leaders, setLeaders]      = useState<LeaderUser[]>([]);
  const [loading, setLoading]      = useState(true);
  const [usingMock, setUsingMock]  = useState(false);
  const [myRowVisible, setMyRowVisible] = useState(true);
  const [countdown, setCountdown]  = useState(() => fmtCountdown(msUntilNextSunday()));

  const flatListRef = useRef<FlatList<LeaderUser>>(null);
  const myUid       = firebaseUser?.uid ?? null;

  /* ── Live countdown — ticks every second ── */
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(fmtCountdown(msUntilNextSunday()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Subscribe to Firestore /users orderBy karma ── */
  useEffect(() => {
    let unsub: (() => void) | undefined;

    try {
      unsub = firestore()
        .collection(USERS_COLL)
        .orderBy('karma', 'desc')
        .limit(USERS_LIMIT)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              setLeaders(RANKS_DATA.map(mockToLeaderUser));
              setUsingMock(true);
            } else {
              const list: LeaderUser[] = [];
              qs.forEach((doc) => {
                const d = doc.data() as UserDoc & { weeklyKarma?: number };
                // Only include onboarding-complete users with a username
                if (!d.onboardingComplete || !d.username) return;
                list.push({
                  id:          doc.id,
                  name:        d.username,
                  karma:       d.karma ?? 0,
                  // weeklyKarma is a denormalized counter reset by Cloud Function
                  // Phase 1: not yet written → fallback to 12% of karma as placeholder
                  weeklyKarma: d.weeklyKarma ?? Math.round((d.karma ?? 0) * 0.12),
                  badge:       d.badge ?? 'ACTIVE',
                  trophies:    d.trophies ?? [],
                });
              });

              if (list.length === 0) {
                // Real users exist but all still onboarding — show mock
                setLeaders(RANKS_DATA.map(mockToLeaderUser));
                setUsingMock(true);
              } else {
                setLeaders(list);
                setUsingMock(false);
              }
            }
            setLoading(false);
          },
          () => {
            setLeaders(RANKS_DATA.map(mockToLeaderUser));
            setUsingMock(true);
            setLoading(false);
          }
        );
    } catch {
      setLeaders(RANKS_DATA.map(mockToLeaderUser));
      setUsingMock(true);
      setLoading(false);
    }

    return () => unsub?.();
  }, []);

  /* ── Sorted list per active tab ── */
  const sortedLeaders: LeaderUser[] = useMemo(() => {
    if (activeTab === 'Weekly') {
      return [...leaders].sort((a, b) => b.weeklyKarma - a.weeklyKarma);
    }
    // Global — already sorted by karma from Firestore; keep order
    return leaders;
  }, [leaders, activeTab]);

  const isWeekly = activeTab === 'Weekly';

  /* ── My rank ── */
  const myIndex = useMemo(() => {
    if (!myUid) {
      // Mock mode: use 'ghost_player' as the "me" marker
      return usingMock ? sortedLeaders.findIndex(u => u.name === 'ghost_player') : -1;
    }
    return sortedLeaders.findIndex(u => u.id === myUid);
  }, [sortedLeaders, myUid, usingMock]);

  const me = myIndex >= 0 ? sortedLeaders[myIndex] : null;

  /* ── Viewability (for sticky YOU pill) ── */
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: any) => {
      const visible = viewableItems.some(
        (v: any) => v?.item?.id === (myUid ?? sortedLeaders[myIndex]?.id)
      );
      setMyRowVisible(visible);
    }
  ).current;

  const scrollToMe = () => {
    if (myIndex >= 0 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: myIndex,
        animated: true,
        viewPosition: 0.4,
      });
    }
  };

  /* ── Rank row renderer ── */
  const renderRankRow = ({ item, index }: { item: LeaderUser; index: number }) => {
    const displayRank = index + 1;
    const isMe        = item.id === myUid || (usingMock && item.name === 'ghost_player');
    const karmaValue  = isWeekly ? item.weeklyKarma : item.karma;

    return (
      <TouchableOpacity
        style={[styles.rankItem, isMe && styles.rankItemMe]}
        activeOpacity={0.7}
        onPress={() => {
          if (!isMe && item.id && !item.id.startsWith('mock_')) {
            router.push(`/user/${item.id}` as never);
          }
        }}
      >
        <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>
          #{displayRank}
        </Text>

        <Avatar name={item.name} size={40} ringed={isMe} />

        <View style={styles.rankBody}>
          <View style={styles.rankNameRow}>
            <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
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
            {item.trophies.slice(0, 2).map(t => (
              <View key={t} style={styles.trophyDot} />
            ))}
          </View>
        </View>

        <View style={styles.rankScore}>
          <Text style={styles.rankKarmaVal}>
            {karmaValue.toLocaleString()}
          </Text>
          <Text style={styles.rankKarmaLbl}>
            {isWeekly ? 'wk karma' : 'karma'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Leaderboard"
        right={
          usingMock && !loading ? (
            <View style={styles.demoPill}>
              <Text style={styles.demoPillText}>DEMO</Text>
            </View>
          ) : undefined
        }
      />

      {/* Segmented tab control */}
      <View style={styles.tabBarOuter}>
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(tab)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Loading state */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={orbit.textTertiary} />
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        </View>
      )}

      {/* Challenges tab */}
      {!loading && activeTab === 'Challenges' && (
        <ChallengesTab bottomPad={bottomPad} />
      )}

      {/* Global / Weekly tabs */}
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
            windowSize={8}
            ListHeaderComponent={
              <>
                {/* Weekly reset countdown */}
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
                <Divider />
              </>
            }
            renderItem={renderRankRow}
            ItemSeparatorComponent={() => <Divider />}
          />

          {/* Sticky YOU pill — visible when own row is off-screen */}
          {me && !myRowVisible && (
            <TouchableOpacity
              style={[
                styles.stickyYou,
                { bottom: Platform.OS === 'web' ? 96 : insets.bottom + 80 },
              ]}
              activeOpacity={0.85}
              onPress={scrollToMe}
              accessibilityRole="button"
              accessibilityLabel={`Jump to your rank #${myIndex + 1}`}
            >
              <View style={styles.stickyYouInner}>
                <Avatar name={me.name} size={28} />
                <View style={styles.stickyYouTextCol}>
                  <Text style={styles.stickyYouLabel}>
                    YOU · #{myIndex + 1}
                  </Text>
                  <Text style={styles.stickyYouKarma}>
                    {(isWeekly ? me.weeklyKarma : me.karma).toLocaleString()} karma
                  </Text>
                </View>
                <Feather name="chevron-up" size={18} color={orbit.white} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Demo pill */
  demoPill: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  demoPillText: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  /* Segmented tab bar */
  tabBarOuter: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: orbit.surface1,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  tabActive: {
    backgroundColor: orbit.surface3,
  },
  tabText: {
    color: orbit.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: orbit.textPrimary,
    fontWeight: '600',
  },

  /* Weekly reset bar */
  weeklyResetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
  },
  weeklyResetText: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  weeklyResetCountdown: {
    color: orbit.warning,
    fontWeight: '700',
  },

  /* Podium */
  podiumStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  podiumColumn: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  podiumAvatarWrap: {
    position: 'relative',
  },
  podiumBadgePos: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderWidth: 2,
    borderColor: orbit.bg,
    borderRadius: 12,
  },
  podiumName: {
    color: orbit.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  podiumKarma: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },

  /* Rank list row */
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  rankItemMe: {
    backgroundColor: 'rgba(91, 127, 255, 0.08)',
    borderLeftWidth: 2,
    borderLeftColor: orbit.accent,
    paddingLeft: 18,
  },
  rankNum: {
    width: 28,
    color: orbit.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  rankNumMe: {
    color: orbit.accent,
  },
  rankBody: { flex: 1 },
  rankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rankName: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  rankNameMe: {
    color: orbit.accent,
  },
  youTag: {
    backgroundColor: orbit.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youTagText: {
    color: orbit.white,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rankBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trophyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.warning,
    opacity: 0.7,
  },
  rankScore: { alignItems: 'flex-end' },
  rankKarmaVal: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  rankKarmaLbl: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  /* Challenges tab */
  challengesSection: { paddingTop: 8 },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  challengeBody: { flex: 1 },
  challengeTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  challengeMeta: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  prizePill: {
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prizeText: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: '700',
  },

  /* Sticky YOU pill */
  stickyYou: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  stickyYouInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 28,
    gap: 12,
    minWidth: 240,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  stickyYouTextCol: { flex: 1 },
  stickyYouLabel: {
    color: orbit.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stickyYouKarma: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  /* Loading */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: orbit.textTertiary,
    fontSize: 13,
  },
});

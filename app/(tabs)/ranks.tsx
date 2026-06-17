/**
 * CROWN — Ranks Tab (ranks.tsx)
 * Premium UI / Apple-Level Minimal / CROWN Tokens
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ViewToken,
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
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { RANKS_DATA, WEEKLY_CHALLENGES } from '@/constants/data';
import type { UserDoc } from '@/lib/firestore-users';

// Import CROWN specific tokens instead of old orbit colors
import { COLORS_DARK, FONTS, FONT_SIZES, SPACING, RADIUS } from '@/crown-rank/tokens';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const TABS          = ['Global', 'Weekly', 'Challenges'] as const;
type Tab            = typeof TABS[number];
const USERS_LIMIT   = 100;
const USERS_COLL    = 'users';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type LeaderUser = {
  id:          string;
  name:        string;
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

function msUntilNextSunday(): number {
  const now      = new Date();
  const istOffset = 330 * 60 * 1000;
  const nowIST   = new Date(now.getTime() + istOffset);
  const dayIST   = nowIST.getUTCDay();
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

function RankBadge({ n, size = 20 }: { n: number; size?: number }) {
  // Premium metallic tones instead of flat colors
  const bg =
    n === 1 ? COLORS_DARK.fgBrand : // Gold
    n === 2 ? '#B0B0B5' : // Silver
    n === 3 ? '#C8896B' : // Bronze
    COLORS_DARK.bgElevated;
  const fg = n <= 3 ? COLORS_DARK.bgSurface : COLORS_DARK.fgTextMuted;
  
  return (
    <View style={[styles.rankBadge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.rankBadgeText, { color: fg, fontSize: size * 0.55 }]}>{n}</Text>
    </View>
  );
}

function PodiumStrip({ top3, isWeekly }: { top3: LeaderUser[]; isWeekly: boolean }) {
  return (
    <View style={styles.podiumStrip}>
      {top3.map((u, i) => {
        const rank = i + 1;
        const isFirst = rank === 1;
        return (
          <View key={u.id} style={[styles.podiumColumn, isFirst && { transform: [{ translateY: -10 }] }]}>
            <View style={styles.podiumAvatarWrap}>
              <Avatar name={u.name} size={isFirst ? 68 : 56} />
              <View style={[styles.podiumBadgePos, { top: isFirst ? -6 : -4, right: isFirst ? -6 : -4 }]}>
                <RankBadge n={rank} size={isFirst ? 24 : 20} />
              </View>
            </View>
            <Text style={[styles.podiumName, isFirst && { fontSize: FONT_SIZES.body }]} numberOfLines={1}>{u.name}</Text>
            <Text style={styles.podiumKarma}>
              {(isWeekly ? u.weeklyKarma : u.karma).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function WeeklyResetBar({ countdown }: { countdown: string }) {
  return (
    <View style={styles.weeklyResetBar}>
      <Feather name="clock" size={14} color={COLORS_DARK.fgAccentOrange} style={{ marginRight: 8 }} />
      <Text style={styles.weeklyResetText}>
        Resets in <Text style={styles.weeklyResetCountdown}>{countdown}</Text>
      </Text>
      <Text style={styles.weeklyBonusText}>Top 3 win bonus</Text>
    </View>
  );
}

function ChallengesTab({ bottomPad }: { bottomPad: number }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
      <View style={styles.challengesSection}>
        <Text style={styles.sectionLabel}>ACTIVE THIS WEEK</Text>
        {WEEKLY_CHALLENGES.map((c, i) => (
          <React.Fragment key={c.id}>
            <TouchableOpacity style={styles.challengeItem} activeOpacity={0.7}>
              <IconBox icon={c.icon} size={44} />
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

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(fmtCountdown(msUntilNextSunday()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
                if (!d.onboardingComplete || !d.username) return;
                list.push({
                  id:          doc.id,
                  name:        d.username,
                  karma:       d.karma ?? 0,
                  weeklyKarma: d.weeklyKarma ?? Math.round((d.karma ?? 0) * 0.12),
                  badge:       d.badge ?? 'ACTIVE',
                  trophies:    d.trophies ?? [],
                });
              });
              if (list.length === 0) {
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

  const sortedLeaders: LeaderUser[] = useMemo(() => {
    if (activeTab === 'Weekly') {
      return [...leaders].sort((a, b) => b.weeklyKarma - a.weeklyKarma);
    }
    return leaders;
  }, [leaders, activeTab]);

  const isWeekly = activeTab === 'Weekly';

  const myIndex = useMemo(() => {
    if (!myUid) {
      return usingMock ? sortedLeaders.findIndex(u => u.name === 'ghost_player') : -1;
    }
    return sortedLeaders.findIndex(u => u.id === myUid);
  }, [sortedLeaders, myUid, usingMock]);

  const me = myIndex >= 0 ? sortedLeaders[myIndex] : null;

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.some(
        (v: ViewToken) => v?.item?.id === (myUid ?? sortedLeaders[myIndex]?.id)
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

  const renderRankRow = ({ item, index }: { item: LeaderUser; index: number }) => {
    const displayRank = index + 1;
    const isMe        = item.id === myUid || (usingMock && item.name === 'ghost_player');
    const karmaValue  = isWeekly ? item.weeklyKarma : item.karma;

    return (
      <TouchableOpacity
        style={[styles.rankItem, isMe && styles.rankItemMe]}
        activeOpacity={0.8}
        onPress={() => {
          if (!isMe && item.id && !item.id.startsWith('mock_')) {
            router.push(`/user/${item.id}` as never);
          }
        }}
      >
        <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>
          #{displayRank}
        </Text>

        <Avatar name={item.name} size={42} ringed={isMe} />

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
          <Text style={[styles.rankKarmaVal, isMe && styles.rankKarmaValMe]}>
            {karmaValue.toLocaleString()}
          </Text>
          <Text style={styles.rankKarmaLbl}>
            {isWeekly ? 'WK KARMA' : 'KARMA'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={styles.screen}>
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

      {/* Sleek Tab Bar */}
      <View style={styles.tabBarOuter}>
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(tab)}
                activeOpacity={0.9}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS_DARK.fgBrand} />
          <Text style={styles.loadingText}>Loading ranks…</Text>
        </View>
      )}

      {!loading && activeTab === 'Challenges' && (
        <ChallengesTab bottomPad={bottomPad} />
      )}

      {!loading && activeTab !== 'Challenges' && (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={sortedLeaders}
            keyExtractor={item => item.id}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[{ paddingBottom: bottomPad }, styles.listContainer]}
            removeClippedSubviews
            maxToRenderPerBatch={15}
            windowSize={8}
            ListHeaderComponent={
              <>
                {isWeekly && (
                  <View style={{ paddingTop: 4, paddingHorizontal: 20 }}>
                    <WeeklyResetBar countdown={countdown} />
                  </View>
                )}
                {sortedLeaders.length >= 3 && (
                  <PodiumStrip
                    top3={sortedLeaders.slice(0, 3)}
                    isWeekly={isWeekly}
                  />
                )}
              </>
            }
            renderItem={renderRankRow}
          />

          {me && !myRowVisible && (
            <TouchableOpacity
              style={[
                styles.stickyYou,
                { bottom: Platform.OS === 'web' ? 96 : insets.bottom + 80 },
              ]}
              activeOpacity={0.9}
              onPress={scrollToMe}
              accessibilityRole="button"
            >
              <View style={styles.stickyYouInner}>
                <Avatar name={me.name} size={32} />
                <View style={styles.stickyYouTextCol}>
                  <Text style={styles.stickyYouLabel}>
                    YOUR RANK · #{myIndex + 1}
                  </Text>
                  <Text style={styles.stickyYouKarma}>
                    {(isWeekly ? me.weeklyKarma : me.karma).toLocaleString()} karma
                  </Text>
                </View>
                <Feather name="chevron-up" size={20} color={COLORS_DARK.bgSurface} />
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
  // CORE: White Background
  screen: { 
    flex: 1,
    backgroundColor: COLORS_DARK.bgSurface,
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },

  /* Demo pill */
  demoPill: {
    backgroundColor: COLORS_DARK.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS_DARK.borderSubtle,
  },
  demoPillText: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.numeric,
    fontSize: 10,
    letterSpacing: 0.8,
  },

  /* Sleek Tab Bar (Pill Shape, Cream/White) */
  tabBarOuter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS_DARK.bgCard, // Cream background
    borderRadius: RADIUS.pill,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.pill,
  },
  tabActive: {
    backgroundColor: COLORS_DARK.bgSurface, // White active pill
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
  },
  tabTextActive: {
    color: COLORS_DARK.fgPrimary, // Ink text
    fontFamily: FONTS.bodySemiBold,
  },

  /* Weekly reset bar */
  weeklyResetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF8E7', // Soft warm tint
    borderWidth: 1,
    borderColor: COLORS_DARK.borderGold, // Gold border
    borderRadius: RADIUS.card,
  },
  weeklyResetText: {
    flex: 1,
    color: COLORS_DARK.fgPrimary,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
  },
  weeklyResetCountdown: {
    color: COLORS_DARK.fgAccentOrange,
    fontFamily: FONTS.numeric,
  },
  weeklyBonusText: {
    color: COLORS_DARK.fgBrand,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Podium (Top 3) */
  podiumStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingVertical: 24,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  podiumColumn: {
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  podiumAvatarWrap: {
    position: 'relative',
    shadowColor: COLORS_DARK.fgBrand,
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
  podiumBadgePos: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: COLORS_DARK.bgSurface,
    borderRadius: 20,
  },
  rankBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rankBadgeText: {
    fontFamily: FONTS.numeric,
  },
  podiumName: {
    color: COLORS_DARK.fgPrimary,
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    marginTop: 4,
  },
  podiumKarma: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
  },

  /* Premium Rank Card (Replaced flat row with Glass Card) */
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS_DARK.bgCard, // Cream surface
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.card,
    gap: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rankItemMe: {
    backgroundColor: COLORS_DARK.bgSurface, // White for user
    borderColor: COLORS_DARK.fgBrand, // Gold border
    shadowColor: COLORS_DARK.fgBrand,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  rankNum: {
    width: 30,
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
  },
  rankNumMe: {
    color: COLORS_DARK.fgBrand,
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
    color: COLORS_DARK.fgPrimary,
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
  },
  rankNameMe: {
    color: COLORS_DARK.fgBrand,
  },
  youTag: {
    backgroundColor: COLORS_DARK.fgBrand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  youTagText: {
    color: COLORS_DARK.bgSurface,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 9,
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
    backgroundColor: COLORS_DARK.fgAccentOrange,
    opacity: 0.8,
  },
  rankScore: { alignItems: 'flex-end' },
  rankKarmaVal: {
    color: COLORS_DARK.fgPrimary,
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
  },
  rankKarmaValMe: {
    color: COLORS_DARK.fgBrand,
  },
  rankKarmaLbl: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: 4,
  },

  /* Challenges tab */
  challengesSection: { 
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionLabel: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS_DARK.bgCard,
    padding: 16,
    borderRadius: RADIUS.card,
    gap: 14,
  },
  challengeBody: { flex: 1 },
  challengeTitle: {
    color: COLORS_DARK.fgPrimary,
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    marginBottom: 4,
  },
  challengeMeta: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
  },
  prizePill: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: COLORS_DARK.borderGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  prizeText: {
    color: COLORS_DARK.fgBrand,
    fontFamily: FONTS.numeric,
    fontSize: 12,
  },

  /* Sticky YOU pill (Ink & Gold theme instead of blue) */
  stickyYou: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  stickyYouInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS_DARK.fgPrimary, // Ink background
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 14,
    minWidth: 260,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stickyYouTextCol: { flex: 1 },
  stickyYouLabel: {
    color: COLORS_DARK.bgSurface,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  stickyYouKarma: {
    color: COLORS_DARK.fgBrand, // Gold text for karma
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.sub,
    marginTop: 2,
  },

  /* Loading */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS_DARK.fgTextMuted,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
  },
});

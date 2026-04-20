import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { RANKS_DATA, WEEKLY_CHALLENGES } from '@/constants/data';
import {
  ScreenHeader,
  Divider,
  TierPill,
  Avatar,
  IconBox,
} from '@/components/shared';
import { orbit } from '@/constants/colors';

const TABS = ['Global', 'Weekly', 'Challenges'];

/* Numbered badge (replaces 🥇🥈🥉 emojis) */
function RankBadge({ n, size = 18 }: { n: number; size?: number }) {
  const bg =
    n === 1 ? '#E8A33D' :
    n === 2 ? '#B0B0B5' :
    n === 3 ? '#C8896B' :
    orbit.surface2;
  const fg = n <= 3 ? '#0A0A0B' : orbit.textSecond;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontSize: 10, fontWeight: '700' }}>{n}</Text>
    </View>
  );
}

function PodiumColumn({ user, rank, isWeekly }: { user: typeof RANKS_DATA[0]; rank: number; isWeekly: boolean }) {
  return (
    <View style={styles.podiumColumn}>
      <View style={styles.podiumAvatarWrap}>
        <Avatar name={user.name} size={56} />
        <View style={styles.podiumBadgePos}>
          <RankBadge n={rank} size={22} />
        </View>
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>{user.name}</Text>
      <Text style={styles.podiumKarma}>
        {isWeekly ? user.weeklyKarma.toLocaleString() : user.karma.toLocaleString()}
      </Text>
    </View>
  );
}

function ActiveChallenges() {
  return (
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
              <Text style={styles.prizeText}>{c.prize}</Text>
            </View>
          </TouchableOpacity>
          {i < WEEKLY_CHALLENGES.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function RanksScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setTab] = useState('Global');
  const [myRowVisible, setMyRowVisible] = useState(true);
  const flatListRef = React.useRef<FlatList<typeof RANKS_DATA[0]>>(null);

  const isWeekly = activeTab === 'Weekly';
  const sortedAll = [...RANKS_DATA].sort((a, b) =>
    isWeekly ? b.weeklyKarma - a.weeklyKarma : a.rank - b.rank
  );

  const myIndex = sortedAll.findIndex(u => u.name === 'ghost_player');
  const me = myIndex >= 0 ? sortedAll[myIndex] : null;

  const handleViewableItemsChanged = React.useRef(
    ({ viewableItems }: any) => {
      const visible = viewableItems.some(
        (v: any) => v?.item?.name === 'ghost_player'
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

  const renderRank = ({ item, index }: { item: typeof RANKS_DATA[0]; index: number }) => {
    const displayRank = index + 1;
    const isMe = item.name === 'ghost_player';

    return (
      <TouchableOpacity
        style={[styles.rankItem, isMe && styles.rankItemMe]}
        activeOpacity={0.7}
      >
        <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>
          #{displayRank}
        </Text>

        <Avatar name={item.name} size={40} ringed={isMe} />

        <View style={styles.rankBody}>
          <View style={styles.rankNameRow}>
            <Text style={[styles.rankName, isMe && styles.rankNameMe]}>
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
          </View>
        </View>

        <View style={styles.rankScore}>
          <Text style={styles.rankKarmaVal}>
            {isWeekly ? item.weeklyKarma.toLocaleString() : item.karma.toLocaleString()}
          </Text>
          <Text style={styles.rankKarmaLbl}>karma</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader title="Leaderboard" />

      {/* Segmented control tabs */}
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

      {activeTab === 'Challenges' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          <ActiveChallenges />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={sortedAll}
            keyExtractor={i => i.id}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            ListHeaderComponent={
              <>
                {isWeekly && (
                  <View style={styles.weeklyResetBar}>
                    <Feather name="clock" size={13} color={orbit.warning} style={{ marginRight: 8 }} />
                    <Text style={styles.weeklyResetText}>
                      Resets in 2d 14h · Top 3 win bonus credits
                    </Text>
                  </View>
                )}
                <View style={styles.podiumStrip}>
                  {[1, 2, 3].map(r => {
                    const u = sortedAll[r - 1];
                    if (!u) return null;
                    return (
                      <PodiumColumn key={r} user={u} rank={r} isWeekly={isWeekly} />
                    );
                  })}
                </View>
                <Divider indent={false} />
              </>
            }
            renderItem={renderRank}
            ItemSeparatorComponent={() => <Divider indent />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomPad }}
          />

          {/* Sticky YOU pill — shows when user's own row is offscreen */}
          {me && !myRowVisible && (
            <TouchableOpacity
              style={[styles.stickyYou, { bottom: (Platform.OS === 'web' ? 96 : insets.bottom + 80) }]}
              activeOpacity={0.85}
              onPress={scrollToMe}
              accessibilityRole="button"
              accessibilityLabel={`Jump to your rank, #${myIndex + 1}`}
            >
              <View style={styles.stickyYouInner}>
                <Avatar name={me.name} size={28} />
                <View style={styles.stickyYouTextCol}>
                  <Text style={styles.stickyYouLabel}>YOU · #{myIndex + 1}</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },

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
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
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

  /* Rank list item */
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  rankItemMe: {
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    borderLeftWidth: 2,
    borderLeftColor: orbit.accent,
    paddingLeft: 18, // compensate so content alignment stays consistent
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
  rankBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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

  /* Challenges section */
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
    fontWeight: '600',
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
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  stickyYouTextCol: {
    flex: 1,
  },
  stickyYouLabel: {
    color: orbit.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stickyYouKarma: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});

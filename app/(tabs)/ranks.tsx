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
import { useColors } from '@/hooks/useColors';
import { RANKS_DATA, WEEKLY_CHALLENGES } from '@/constants/data';
import { ScreenHeader, Divider, KarmaBadge } from '@/components/shared';

const PODIUM_COLORS: Record<number, string> = { 1: '#F4A522', 2: '#C0C0C0', 3: '#CD7F32' };
const PODIUM_EMOJIS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const TABS = ['Global', 'Weekly', 'Challenges'];

function WeeklyChallengeWinners() {
  const colors = useColors();
  const winners = [
    { emoji: '🎤', challenge: 'Best Desi Rap Verse',      winner: 'ghost_player',   prize: '1000 Credits', badge: '🏆' },
    { emoji: '📷', challenge: 'Street Photography Delhi', winner: 'lens_wala',       prize: '750 Credits',  badge: '🥇' },
    { emoji: '🎮', challenge: 'Clutch Play of the Week',  winner: 'aimgod_47',       prize: '500 Credits',  badge: '⭐' },
  ];
  return (
    <View style={styles.winnersSection}>
      <View style={[styles.weeklyBanner, { backgroundColor: colors.gold + '18', borderColor: colors.gold + '33' }]}>
        <Text style={[styles.weeklyBannerTitle, { color: colors.gold }]}>🏆 Last Week's Winners</Text>
        <Text style={[styles.weeklyBannerSub, { color: colors.sub }]}>Week 16 · Apr 2026</Text>
      </View>
      {winners.map((w, i) => (
        <React.Fragment key={i}>
          <TouchableOpacity style={[styles.winnerItem, { backgroundColor: colors.background }]} activeOpacity={0.75}>
            <View style={[styles.winnerEmoji, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 22 }}>{w.emoji}</Text>
            </View>
            <View style={styles.winnerBody}>
              <Text style={[styles.winnerChallenge, { color: colors.sub }]} numberOfLines={1}>{w.challenge}</Text>
              <Text style={[styles.winnerName, { color: colors.text }]}>@{w.winner}</Text>
            </View>
            <View style={styles.winnerRight}>
              <Text style={styles.winnerBadge}>{w.badge}</Text>
              <Text style={[styles.winnerPrize, { color: colors.gold }]}>{w.prize}</Text>
            </View>
          </TouchableOpacity>
          {i < winners.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

function ActiveChallenges() {
  const colors = useColors();
  return (
    <View style={styles.challengesSection}>
      <Text style={[styles.challengesSectionTitle, { color: colors.text }]}>⚡ Active This Week</Text>
      {WEEKLY_CHALLENGES.map((c, i) => (
        <React.Fragment key={c.id}>
          <TouchableOpacity style={[styles.challengeItem, { backgroundColor: colors.background }]} activeOpacity={0.75}>
            <View style={[styles.challengeEmoji, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
            </View>
            <View style={styles.challengeBody}>
              <Text style={[styles.challengeTitle, { color: colors.text }]} numberOfLines={1}>{c.title}</Text>
              <Text style={[styles.challengeMeta, { color: colors.sub }]}>
                {c.entries} entries · ends {c.ends}
              </Text>
            </View>
            <View style={[styles.prizePill, { backgroundColor: colors.gold + '22', borderColor: colors.gold + '44' }]}>
              <Text style={[styles.prizeText, { color: colors.gold }]}>{c.prize}</Text>
            </View>
          </TouchableOpacity>
          {i < WEEKLY_CHALLENGES.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function RanksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setTab] = useState('Global');

  const renderRank = ({ item }: { item: typeof RANKS_DATA[0] }) => {
    const isTop3 = item.rank <= 3;
    const isMe = item.name === 'ghost_player';

    return (
      <TouchableOpacity
        style={[
          styles.rankItem,
          { backgroundColor: colors.background },
          isTop3 && { backgroundColor: colors.surface + 'CC' },
          isMe && { backgroundColor: colors.primary + '20', borderLeftWidth: 3, borderLeftColor: colors.primary },
        ]}
        activeOpacity={0.75}
      >
        <View style={styles.rankNumWrap}>
          {isTop3 ? (
            <Text style={styles.rankMedal}>{PODIUM_EMOJIS[item.rank]}</Text>
          ) : (
            <Text style={[styles.rankNum, { color: isMe ? colors.blueLight : colors.mutedForeground }]}>
              #{item.rank}
            </Text>
          )}
        </View>

        <View style={[
          styles.avatarSmall,
          {
            backgroundColor: colors.surface2,
            borderColor: isTop3 ? PODIUM_COLORS[item.rank] + '66' : colors.border,
          },
        ]}>
          <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
        </View>

        <View style={styles.rankBody}>
          <View style={styles.rankNameRow}>
            <Text style={[styles.rankName, { color: isMe ? colors.blueLight : colors.text }]}>
              {item.name}
            </Text>
            {isMe && (
              <View style={[styles.youTag, { backgroundColor: colors.blueLight + '22' }]}>
                <Text style={[styles.youTagText, { color: colors.blueLight }]}>YOU</Text>
              </View>
            )}
          </View>
          <View style={styles.rankBadgeRow}>
            <KarmaBadge badge={item.badge} />
            {item.trophies.length > 0 && (
              <Text style={styles.rankTrophies}>{item.trophies.slice(0, 3).join(' ')}</Text>
            )}
          </View>
        </View>

        <View style={styles.rankScore}>
          <Text style={[
            styles.rankKarmaVal,
            { color: isTop3 ? PODIUM_COLORS[item.rank] : colors.text },
          ]}>
            {activeTab === 'Weekly' ? item.weeklyKarma.toLocaleString() : item.karma.toLocaleString()}
          </Text>
          <Text style={[styles.rankKarmaLbl, { color: colors.mutedForeground }]}>
            {activeTab === 'Weekly' ? 'this week' : 'karma'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Leaderboard" />

      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab ? colors.primary : colors.mutedForeground },
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Challenges' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        >
          <WeeklyChallengeWinners />
          <Divider indent={false} />
          <ActiveChallenges />
        </ScrollView>
      ) : (
        <FlatList
          data={[...RANKS_DATA].sort((a, b) =>
            activeTab === 'Weekly' ? b.weeklyKarma - a.weeklyKarma : a.rank - b.rank
          )}
          keyExtractor={i => i.id}
          ListHeaderComponent={
            <>
              {activeTab === 'Weekly' && (
                <View style={[styles.weeklyResetBar, { backgroundColor: colors.red + '18', borderColor: colors.red + '33' }]}>
                  <Text style={[styles.weeklyResetText, { color: colors.red }]}>
                    🔄 Weekly reset in 2d 14h · Top 3 win bonus credits
                  </Text>
                </View>
              )}
              <View style={[styles.podiumStrip, { backgroundColor: colors.surface }]}>
                {[1, 2, 3].map(r => {
                  const sorted = [...RANKS_DATA].sort((a, b) =>
                    activeTab === 'Weekly' ? b.weeklyKarma - a.weeklyKarma : a.rank - b.rank
                  );
                  const u = sorted[r - 1];
                  if (!u) return null;
                  return (
                    <View key={r} style={styles.podiumCard}>
                      <Text style={{ fontSize: 24 }}>{PODIUM_EMOJIS[r]}</Text>
                      <Text style={[styles.podiumName, { color: PODIUM_COLORS[r] }]}>{u.name}</Text>
                      <Text style={[styles.podiumKarma, { color: colors.sub }]}>
                        {activeTab === 'Weekly' ? u.weeklyKarma.toLocaleString() : u.karma.toLocaleString()}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Divider indent={false} />
            </>
          }
          renderItem={renderRank}
          ItemSeparatorComponent={Divider}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  weeklyResetBar: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weeklyResetText: { fontSize: 12, fontWeight: '600' },
  podiumStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  podiumCard: { alignItems: 'center', gap: 4 },
  podiumName: { fontSize: 11, fontWeight: '700' },
  podiumKarma: { fontSize: 11 },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rankNumWrap: { width: 42, alignItems: 'center' },
  rankMedal: { fontSize: 22 },
  rankNum: { fontSize: 13, fontWeight: '700' },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankBody: { flex: 1, marginLeft: 4 },
  rankNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankName: { fontSize: 14, fontWeight: '600' },
  youTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youTagText: { fontSize: 10, fontWeight: '800' },
  rankBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rankTrophies: { fontSize: 13, marginTop: 1 },
  rankScore: { alignItems: 'flex-end' },
  rankKarmaVal: { fontSize: 15, fontWeight: '800' },
  rankKarmaLbl: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  winnersSection: { paddingTop: 8 },
  weeklyBanner: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  weeklyBannerTitle: { fontSize: 14, fontWeight: '700' },
  weeklyBannerSub: { fontSize: 11, marginTop: 2 },
  winnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  winnerEmoji: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerBody: { flex: 1 },
  winnerChallenge: { fontSize: 11, marginBottom: 2 },
  winnerName: { fontSize: 14, fontWeight: '700' },
  winnerRight: { alignItems: 'flex-end', gap: 2 },
  winnerBadge: { fontSize: 18 },
  winnerPrize: { fontSize: 11, fontWeight: '700' },
  challengesSection: { paddingTop: 14 },
  challengesSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  challengeEmoji: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeBody: { flex: 1 },
  challengeTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  challengeMeta: { fontSize: 11 },
  prizePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  prizeText: { fontSize: 10, fontWeight: '700' },
});

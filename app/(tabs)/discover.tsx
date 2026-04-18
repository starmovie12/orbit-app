import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { DISCOVER_POSTS, MOOD_ROOMS, WEEKLY_CHALLENGES, MY_PROFILE } from '@/constants/data';
import { ScreenHeader, SearchBar, Divider, CreditPill, WalletDrawer } from '@/components/shared';

const FILTERS = ['All', 'Gaming', 'Music', 'Business', 'Art'];

function MoodRoomsSection() {
  const colors = useColors();
  return (
    <View style={styles.moodSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🌙 Mood Rooms</Text>
        <TouchableOpacity>
          <Text style={[styles.seeAll, { color: colors.blueLight }]}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 10, paddingVertical: 4 }}
      >
        {MOOD_ROOMS.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[styles.moodCard, { backgroundColor: m.color + '22', borderColor: m.color + '55' }]}
            activeOpacity={0.75}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text style={[styles.moodName, { color: colors.text }]} numberOfLines={1}>{m.name}</Text>
            <Text style={[styles.moodMembers, { color: colors.sub }]}>{m.members} online</Text>
            <View style={[styles.moodTag, { backgroundColor: m.color + '33' }]}>
              <Text style={[styles.moodTagText, { color: m.color }]}>{m.tag}</Text>
            </View>
            <TouchableOpacity style={[styles.joinBtn, { backgroundColor: m.color }]} activeOpacity={0.8}>
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function WeeklyChallengesSection() {
  const colors = useColors();
  return (
    <View style={styles.challengeSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🏆 Weekly Challenges</Text>
        <View style={[styles.resetBadge, { backgroundColor: colors.red + '22', borderColor: colors.red + '44' }]}>
          <Text style={[styles.resetText, { color: colors.red }]}>Resets Sun</Text>
        </View>
      </View>
      {WEEKLY_CHALLENGES.map((c, i) => (
        <React.Fragment key={c.id}>
          <TouchableOpacity
            style={[styles.challengeItem, { backgroundColor: colors.background }]}
            activeOpacity={0.75}
          >
            <View style={[styles.challengeEmoji, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
            </View>
            <View style={styles.challengeBody}>
              <Text style={[styles.challengeTitle, { color: colors.text }]} numberOfLines={1}>{c.title}</Text>
              <View style={styles.challengeMeta}>
                <Text style={[styles.challengeEntries, { color: colors.sub }]}>{c.entries} entries</Text>
                <Text style={[styles.challengeEnds, { color: colors.mutedForeground }]}>· ends in {c.ends}</Text>
              </View>
            </View>
            <View style={styles.challengeRight}>
              <Text style={[styles.challengePrize, { color: colors.gold }]}>{c.prize}</Text>
              <TouchableOpacity style={[styles.enterBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
                <Text style={styles.enterBtnText}>Enter</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          {i < WEEKLY_CHALLENGES.length - 1 && <Divider indent={false} />}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeFilter, setFilter] = useState('All');
  const [walletVisible, setWallet] = useState(false);
  const [watchedIds, setWatched] = useState<Record<string, boolean>>({});

  const filtered = DISCOVER_POSTS.filter(p => {
    const matchFilter = activeFilter === 'All' || p.category === activeFilter;
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.author.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleWatch = (id: string) => {
    setWatched(prev => ({ ...prev, [id]: true }));
  };

  const renderPost = ({ item }: { item: typeof DISCOVER_POSTS[0] }) => (
    <View style={[styles.discoverItem, { backgroundColor: colors.background }]}>
      <View style={[styles.discoverThumb, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
        <Text style={styles.discoverThumbEmoji}>{item.emoji}</Text>
      </View>

      <View style={styles.discoverBody}>
        <Text style={[styles.discoverTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.discoverSub, { color: colors.sub }]} numberOfLines={1}>
          by {item.author} {item.tag} · {item.room} · {item.views} views
        </Text>

        <View style={styles.discoverActions}>
          <TouchableOpacity
            style={[
              styles.btnWatch,
              { backgroundColor: watchedIds[item.id] ? colors.green : colors.primary },
            ]}
            onPress={() => handleWatch(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnWatchText}>
              {watchedIds[item.id] ? '✓ Watched' : `▶ Watch (${item.duration})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnMsg, { borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnMsgText, { color: colors.sub }]}>✉ Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Discover"
        right={<CreditPill credits={MY_PROFILE.watchCredits} onPress={() => setWallet(true)} />}
      />
      <SearchBar
        placeholder="Search posts, rooms, creators..."
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
      >
        <MoodRoomsSection />

        <Divider indent={false} />

        <WeeklyChallengesSection />

        <Divider indent={false} />

        <View style={[styles.feedHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.feedTitle, { color: colors.text }]}>📡 Spotlight Feed</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterPill,
                  { backgroundColor: colors.surface2, borderColor: colors.border },
                  activeFilter === f && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.filterPillText,
                  { color: colors.sub },
                  activeFilter === f && { color: '#fff' },
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {filtered.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderPost({ item })}
            {index < filtered.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </ScrollView>

      <WalletDrawer
        visible={walletVisible}
        onClose={() => setWallet(false)}
        credits={MY_PROFILE.watchCredits}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  moodSection: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '600',
  },
  moodCard: {
    width: 130,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  moodEmoji: { fontSize: 28, marginBottom: 2 },
  moodName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  moodMembers: { fontSize: 11 },
  moodTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginVertical: 4,
  },
  moodTagText: { fontSize: 10, fontWeight: '700' },
  joinBtn: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 2,
  },
  joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  challengeSection: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  resetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  resetText: { fontSize: 10, fontWeight: '700' },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  challengeTitle: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  challengeMeta: { flexDirection: 'row', alignItems: 'center' },
  challengeEntries: { fontSize: 11 },
  challengeEnds: { fontSize: 11 },
  challengeRight: { alignItems: 'flex-end', gap: 6 },
  challengePrize: { fontSize: 12, fontWeight: '700' },
  enterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  enterBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  feedHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  feedTitle: { fontSize: 16, fontWeight: '700' },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 12, fontWeight: '600' },
  discoverItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  discoverThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  discoverThumbEmoji: { fontSize: 26 },
  discoverBody: { flex: 1 },
  discoverTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 3,
  },
  discoverSub: { fontSize: 12, marginBottom: 8 },
  discoverActions: { flexDirection: 'row', gap: 8 },
  btnWatch: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnWatchText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnMsg: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnMsgText: { fontSize: 12, fontWeight: '600' },
});

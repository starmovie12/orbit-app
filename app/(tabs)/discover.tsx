import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { DISCOVER_POSTS, MOOD_ROOMS, WEEKLY_CHALLENGES, MY_PROFILE } from '@/constants/data';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  CreditPill,
  WalletDrawer,
  IconBox,
  Avatar,
  TierPill,
} from '@/components/shared';
import { orbit } from '@/constants/colors';

const FILTERS = ['All', 'Gaming', 'Music', 'Business', 'Art'];

function MoodRoomsSection() {
  return (
    <View style={styles.moodSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Mood Rooms</Text>
        <TouchableOpacity hitSlop={6} accessibilityRole="link" accessibilityLabel="See all mood rooms">
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 4 }}
      >
        {MOOD_ROOMS.map(m => (
          <TouchableOpacity key={m.id} style={styles.moodCard} activeOpacity={0.85}>
            {/* 3px accent stripe — single subtle category cue */}
            <View style={[styles.moodStripe, { backgroundColor: m.accent }]} />
            <View style={styles.moodInner}>
              <View style={styles.moodIconBox}>
                <Feather name={m.icon as any} size={20} color={orbit.textPrimary} />
              </View>
              <Text style={styles.moodName} numberOfLines={2}>{m.name}</Text>
              <Text style={styles.moodMembers}>{m.members} online</Text>
              <View style={styles.moodTagPill}>
                <Text style={styles.moodTagText}>{m.tag}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function WeeklyChallengesSection() {
  return (
    <View style={styles.challengeSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Weekly Challenges</Text>
        <Text style={styles.resetText}>Resets Sun</Text>
      </View>
      {WEEKLY_CHALLENGES.map((c, i) => (
        <React.Fragment key={c.id}>
          <TouchableOpacity style={styles.challengeItem} activeOpacity={0.7}>
            <IconBox icon={c.icon} size={40} />
            <View style={styles.challengeBody}>
              <Text style={styles.challengeTitle} numberOfLines={1}>{c.title}</Text>
              <Text style={styles.challengeMeta}>
                {c.entries} entries · ends in {c.ends}
              </Text>
            </View>
            <View style={styles.challengeRight}>
              <Text style={styles.challengePrize}>{c.prize}</Text>
              <Feather name="chevron-right" size={18} color={orbit.textTertiary} />
            </View>
          </TouchableOpacity>
          {i < WEEKLY_CHALLENGES.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function DiscoverScreen() {
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

  const renderPost = (item: typeof DISCOVER_POSTS[0]) => (
    <View style={styles.discoverItem}>
      <IconBox icon={item.icon} size={48} />
      <View style={styles.discoverBody}>
        <Text style={styles.discoverTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.discoverMetaRow}>
          <Text style={styles.discoverAuthor}>@{item.author}</Text>
          <Text style={styles.discoverDot}>·</Text>
          <Text style={styles.discoverMeta}>{item.views} views</Text>
        </View>
        <View style={styles.discoverActions}>
          <TouchableOpacity
            style={[
              styles.btnWatch,
              watchedIds[item.id] && styles.btnWatchDone,
            ]}
            onPress={() => handleWatch(item.id)}
            activeOpacity={0.85}
          >
            <Feather
              name={watchedIds[item.id] ? 'check' : 'play'}
              size={13}
              color={orbit.white}
            />
            <Text style={styles.btnWatchText}>
              {watchedIds[item.id] ? 'Watched' : `Watch · ${item.duration}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnMsg} activeOpacity={0.8}>
            <Feather name="message-circle" size={13} color={orbit.textSecond} />
            <Text style={styles.btnMsgText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
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
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <MoodRoomsSection />
        <WeeklyChallengesSection />

        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>Spotlight Feed</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 8 }}
        >
          {FILTERS.map(f => {
            const active = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterPill,
                  active && styles.filterPillActive,
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.filterPillText,
                  active && styles.filterPillTextActive,
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filtered.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderPost(item)}
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
  sectionTitle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  seeAll: {
    color: orbit.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  resetText: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },

  /* Mood Rooms — single shared surface, accent stripe instead of neon bg */
  moodSection: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  moodCard: {
    width: 152,
    height: 180,
    borderRadius: 16,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  moodStripe: {
    width: 3,
    height: '100%',
    opacity: 0.7,
  },
  moodInner: {
    flex: 1,
    padding: 14,
  },
  moodIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  moodName: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  moodMembers: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 4,
  },
  moodTagPill: {
    alignSelf: 'flex-start',
    backgroundColor: orbit.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 'auto',
  },
  moodTagText: {
    color: orbit.textSecond,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* Weekly challenges */
  challengeSection: {
    paddingTop: 16,
    paddingBottom: 8,
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
  challengeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengePrize: {
    color: orbit.accent,
    fontSize: 14,
    fontWeight: '600',
  },

  /* Feed */
  feedHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    borderColor: orbit.accent,
  },
  filterPillText: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: orbit.accent,
    fontWeight: '600',
  },

  /* Discover post */
  discoverItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  discoverBody: { flex: 1 },
  discoverTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
  },
  discoverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  discoverAuthor: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  discoverDot: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  discoverMeta: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  discoverActions: { flexDirection: 'row', gap: 8 },
  btnWatch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  btnWatchDone: {
    backgroundColor: orbit.success,
  },
  btnWatchText: {
    color: orbit.white,
    fontSize: 12,
    fontWeight: '600',
  },
  btnMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.surface2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  btnMsgText: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
});

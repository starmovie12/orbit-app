/**
 * ORBIT — Discover Tab (discover.tsx)
 *
 * Upgraded from mock → live Firestore.
 *
 * Changes:
 *   • Subscribes to /posts collection (orderBy views desc, limit 30)
 *   • Spotlight winner = post with highest `spotlightBid` credit in current
 *     hour slot — rendered as a special hero card at the top of the feed.
 *   • Falls back to DISCOVER_POSTS when Firestore returns zero docs
 *     (development / seeding phase).
 *   • Filter pills + search still work on the live list.
 *   • Mood Rooms + Weekly Challenges sections preserved.
 *
 * Firestore schema expected for /posts/{postId}:
 *   title: string
 *   authorUid: string
 *   authorUsername: string     ← denormalized (blueprint §07)
 *   category: string           ← one of FILTERS
 *   views: number
 *   duration: string           ← "15s" | "30s"
 *   icon: string               ← Feather icon name
 *   accent: string             ← hex tint (not used as bg fill)
 *   tier: string               ← "PRO" | "MASTER" | "CHAMPION" | "LEGEND"
 *   room: string               ← room name (display only)
 *   spotlightBid: number       ← 0 if not in auction; winner = max bid
 *   createdAt: Timestamp
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  CreditPill,
  WalletDrawer,
  IconBox,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import {
  DISCOVER_POSTS,
  MOOD_ROOMS,
  WEEKLY_CHALLENGES,
  MY_PROFILE,
} from '@/constants/data';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type PostDoc = {
  id: string;
  title: string;
  authorUid: string;
  authorUsername: string;
  category: string;
  views: number;           // raw number for sorting
  viewsLabel: string;      // "1.2K" display string
  duration: string;
  icon: string;
  accent: string;
  tier: string;
  room: string;
  spotlightBid: number;
  createdAt: unknown;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

const FILTERS = ['All', 'Gaming', 'Music', 'Business', 'Art'];
const POSTS_COLLECTION = 'posts';
const POSTS_LIMIT = 30;

/* ─── Firestore helpers ─────────────────────────────────────────────── */

/** Convert DISCOVER_POSTS mock → PostDoc shape so feed renderer is unified. */
function mockToPostDoc(m: typeof DISCOVER_POSTS[0], idx: number): PostDoc {
  const viewsNum = parseFloat(m.views.replace('K', '')) * (m.views.includes('K') ? 1000 : 1);
  return {
    id: m.id,
    title: m.title,
    authorUid: `mock_${m.author}`,
    authorUsername: m.author,
    category: m.category,
    views: Math.round(viewsNum),
    viewsLabel: m.views,
    duration: m.duration,
    icon: m.icon,
    accent: m.accent,
    tier: m.tier,
    room: m.room,
    spotlightBid: idx === 0 ? 42 : 0,   // first mock post = mock spotlight winner
    createdAt: null,
  };
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ─── Sub-components ────────────────────────────────────────────────── */

/** Top-of-feed Spotlight Winner card — distinct "hero" treatment. */
function SpotlightCard({
  post,
  watched,
  onWatch,
}: {
  post: PostDoc;
  watched: boolean;
  onWatch: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.spotlightWrapper}>
      {/* Header row */}
      <View style={styles.spotlightHeaderRow}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={styles.spotlightDot} />
        </Animated.View>
        <Text style={styles.spotlightLabel}>SPOTLIGHT · TOP BID</Text>
        <View style={styles.spotlightBidPill}>
          <Feather name="zap" size={11} color={orbit.warning} />
          <Text style={styles.spotlightBidText}>{post.spotlightBid} credits</Text>
        </View>
      </View>

      {/* Card body */}
      <TouchableOpacity style={styles.spotlightCard} activeOpacity={0.88}>
        <View style={[styles.spotlightAccentBar, { backgroundColor: post.accent }]} />
        <View style={styles.spotlightInner}>
          <View style={styles.spotlightIconRow}>
            <IconBox icon={post.icon} size={52} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.spotlightTitle} numberOfLines={2}>
                {post.title}
              </Text>
              <View style={styles.spotlightMetaRow}>
                <Avatar name={post.authorUsername} size={18} />
                <Text style={styles.spotlightAuthor}>@{post.authorUsername}</Text>
                {post.tier ? (
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>{post.tier}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.spotlightStatsRow}>
            <View style={styles.spotlightStat}>
              <Feather name="eye" size={12} color={orbit.textTertiary} />
              <Text style={styles.spotlightStatText}>{post.viewsLabel} views</Text>
            </View>
            <View style={styles.spotlightStat}>
              <Feather name="hash" size={12} color={orbit.textTertiary} />
              <Text style={styles.spotlightStatText}>{post.room}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.spotlightWatchBtn, watched && styles.spotlightWatchBtnDone]}
            onPress={onWatch}
            activeOpacity={0.85}
          >
            <Feather
              name={watched ? 'check' : 'play'}
              size={14}
              color={orbit.white}
            />
            <Text style={styles.spotlightWatchText}>
              {watched ? 'Watched' : `Watch now · ${post.duration}`}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

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
              <Text style={styles.challengePrize}>+{c.prize}</Text>
              <Feather name="chevron-right" size={18} color={orbit.textTertiary} />
            </View>
          </TouchableOpacity>
          {i < WEEKLY_CHALLENGES.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Standard post row — used for every post below the Spotlight hero. */
function PostRow({
  item,
  watched,
  onWatch,
}: {
  item: PostDoc;
  watched: boolean;
  onWatch: () => void;
}) {
  return (
    <View style={styles.discoverItem}>
      <IconBox icon={item.icon} size={48} />
      <View style={styles.discoverBody}>
        <Text style={styles.discoverTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.discoverMetaRow}>
          <Text style={styles.discoverAuthor}>@{item.authorUsername}</Text>
          <Text style={styles.discoverDot}>·</Text>
          <Text style={styles.discoverMeta}>{item.viewsLabel} views</Text>
        </View>
        <View style={styles.discoverActions}>
          <TouchableOpacity
            style={[styles.btnWatch, watched && styles.btnWatchDone]}
            onPress={onWatch}
            activeOpacity={0.85}
          >
            <Feather name={watched ? 'check' : 'play'} size={13} color={orbit.white} />
            <Text style={styles.btnWatchText}>
              {watched ? 'Watched' : `Watch · ${item.duration}`}
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
}

/* ─── Main Screen ───────────────────────────────────────────────────── */

export default function DiscoverScreen() {
  const insets        = useSafeAreaInsets();
  const { user }      = useAuth();

  const [search, setSearch]         = useState('');
  const [activeFilter, setFilter]   = useState('All');
  const [walletVisible, setWallet]  = useState(false);
  const [watchedIds, setWatched]    = useState<Record<string, boolean>>({});

  /* Firestore state */
  const [posts, setPosts]           = useState<PostDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [usingMock, setUsingMock]   = useState(false);

  const credits = user?.credits ?? MY_PROFILE.watchCredits;

  /* ── Subscribe to /posts ── */
  useEffect(() => {
    let unsub: (() => void) | undefined;

    try {
      unsub = firestore()
        .collection(POSTS_COLLECTION)
        .orderBy('views', 'desc')
        .limit(POSTS_LIMIT)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              // Collection not seeded yet — use mock data
              setPosts(DISCOVER_POSTS.map(mockToPostDoc));
              setUsingMock(true);
            } else {
              const list: PostDoc[] = [];
              qs.forEach((doc) => {
                const d = doc.data() as Omit<PostDoc, 'id' | 'viewsLabel'>;
                list.push({
                  id: doc.id,
                  ...d,
                  viewsLabel: fmtViews(d.views ?? 0),
                });
              });
              setPosts(list);
              setUsingMock(false);
            }
            setLoading(false);
          },
          (_err) => {
            // Firestore error (permissions / offline) — fall back to mock
            setPosts(DISCOVER_POSTS.map(mockToPostDoc));
            setUsingMock(true);
            setLoading(false);
          }
        );
    } catch {
      // firestore() not available (e.g. web without init) — use mock
      setPosts(DISCOVER_POSTS.map(mockToPostDoc));
      setUsingMock(true);
      setLoading(false);
    }

    return () => unsub?.();
  }, []);

  /* ── Derived: spotlight winner + filtered feed ── */

  /** Spotlight winner = highest spotlightBid in current posts list. */
  const spotlightWinner: PostDoc | null =
    posts.length > 0
      ? posts.reduce((best, p) => (p.spotlightBid > best.spotlightBid ? p : best), posts[0])
      : null;

  const feedPosts = posts
    .filter(p => p.id !== spotlightWinner?.id)   // winner shown separately at top
    .filter(p => {
      const matchFilter = activeFilter === 'All' || p.category === activeFilter;
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.authorUsername.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });

  const handleWatch = (id: string) =>
    setWatched(prev => ({ ...prev, [id]: true }));

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Discover"
        right={<CreditPill count={credits} onPress={() => setWallet(true)} />}
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
        {/* ── Mood Rooms ── */}
        <MoodRoomsSection />

        {/* ── Weekly Challenges ── */}
        <WeeklyChallengesSection />

        {/* ── Spotlight Feed header ── */}
        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>Spotlight Feed</Text>
          {usingMock && (
            <Text style={styles.demoLabel}>DEMO</Text>
          )}
        </View>

        {/* ── Category filter pills ── */}
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
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Loading skeleton ── */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={orbit.textTertiary} />
            <Text style={styles.loadingText}>Loading posts…</Text>
          </View>
        )}

        {/* ── Spotlight winner hero card (only visible in "All" or matching category) ── */}
        {!loading && spotlightWinner && (spotlightWinner.spotlightBid > 0) &&
          (activeFilter === 'All' || activeFilter === spotlightWinner.category) &&
          (search === '' ||
            spotlightWinner.title.toLowerCase().includes(search.toLowerCase()) ||
            spotlightWinner.authorUsername.toLowerCase().includes(search.toLowerCase())) && (
          <SpotlightCard
            post={spotlightWinner}
            watched={watchedIds[spotlightWinner.id] ?? false}
            onWatch={() => handleWatch(spotlightWinner.id)}
          />
        )}

        {/* ── Feed rows ── */}
        {!loading && feedPosts.map((item, index) => (
          <React.Fragment key={item.id}>
            <PostRow
              item={item}
              watched={watchedIds[item.id] ?? false}
              onWatch={() => handleWatch(item.id)}
            />
            {index < feedPosts.length - 1 && <Divider />}
          </React.Fragment>
        ))}

        {/* ── Empty state ── */}
        {!loading && feedPosts.length === 0 && !spotlightWinner && (
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={32} color={orbit.textTertiary} />
            <Text style={styles.emptyText}>No posts found</Text>
            <Text style={styles.emptySubtext}>Try a different filter or search term</Text>
          </View>
        )}
      </ScrollView>

      <WalletDrawer
        visible={walletVisible}
        onClose={() => setWallet(false)}
        credits={credits}
      />
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
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

  /* ── Spotlight hero ── */
  spotlightWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 12,
  },
  spotlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  spotlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: orbit.warning,
  },
  spotlightLabel: {
    color: orbit.warning,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    flex: 1,
  },
  spotlightBidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,163,61,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  spotlightBidText: {
    color: orbit.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  spotlightCard: {
    borderRadius: 16,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  spotlightAccentBar: {
    width: 4,
    height: '100%',
    opacity: 0.8,
  },
  spotlightInner: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  spotlightIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  spotlightTitle: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 6,
  },
  spotlightMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spotlightAuthor: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  tierBadge: {
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tierBadgeText: {
    color: orbit.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spotlightStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  spotlightStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotlightStatText: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  spotlightWatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: orbit.accent,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  spotlightWatchBtnDone: {
    backgroundColor: orbit.success,
  },
  spotlightWatchText: {
    color: orbit.white,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Mood Rooms ── */
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

  /* ── Weekly Challenges ── */
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

  /* ── Feed ── */
  feedHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoLabel: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    backgroundColor: orbit.surface2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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

  /* ── Post rows ── */
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

  /* ── States ── */
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: orbit.textTertiary,
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: orbit.textSecond,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    color: orbit.textTertiary,
    fontSize: 13,
  },
});

/**
 * ORBIT — Home Tab (index.tsx)
 *
 * Real home screen replacing the old rooms.tsx re-export.
 *
 * Features:
 *   • Greeting header + Credits pill (live from UserDoc)
 *   • Daily Challenge hero card (top challenge from WEEKLY_CHALLENGES)
 *   • Mood Rooms horizontal scroll (from MOOD_ROOMS mock, navigates to rooms tab)
 *   • Trending Rooms (live Firestore /rooms, top 4 by memberCount)
 *
 * Wiring:
 *   • useAuth() → user.credits + user.username for personalisation
 *   • subscribeRooms() → trending list (falls back gracefully while loading)
 *   • Navigation: expo-router useRouter
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  CreditPill,
  WalletDrawer,
  IconBox,
  Divider,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { MOOD_ROOMS, WEEKLY_CHALLENGES, MY_PROFILE } from '@/constants/data';
import { subscribeRooms, type RoomDoc } from '@/lib/firestore-rooms';

/* ─── Time helper (same pattern as rooms.tsx) ──────────────────────── */
function fmtTime(ts: any): string {
  if (!ts) return '';
  const d: Date | null =
    typeof ts?.toDate === 'function' ? ts.toDate() :
    ts instanceof Date ? ts : null;
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function LivePill() {
  return (
    <View style={styles.livePill}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

function DailyChallengeCard({ onPress }: { onPress: () => void }) {
  const challenge = WEEKLY_CHALLENGES[0];
  return (
    <TouchableOpacity
      style={styles.challengeCard}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Daily challenge: ${challenge.title}`}
    >
      {/* Left content */}
      <View style={styles.challengeLeft}>
        <View style={styles.dailyBadge}>
          <Text style={styles.dailyBadgeText}>DAILY</Text>
        </View>
        <Text style={styles.challengeTitle} numberOfLines={2}>
          {challenge.title}
        </Text>
        <Text style={styles.challengeMeta}>
          {challenge.entries} entries · ends in {challenge.ends}
        </Text>
        <View style={styles.challengeEnterBtn}>
          <Feather name="arrow-right" size={13} color={orbit.white} />
          <Text style={styles.challengeEnterText}>Enter challenge</Text>
        </View>
      </View>

      {/* Right — prize */}
      <View style={styles.challengeRight}>
        <View style={styles.prizeCircle}>
          <Feather name={challenge.icon as any} size={22} color={orbit.accent} />
        </View>
        <Text style={styles.prizeAmount}>+{challenge.prize}</Text>
        <Text style={styles.prizeLabel}>credits</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────── */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [walletVisible, setWallet] = useState(false);
  const [trending, setTrending] = useState<RoomDoc[]>([]);
  const [loadingTrending, setLoading] = useState(true);

  /* Live from Firestore — top 4 by memberCount */
  useEffect(() => {
    const unsub = subscribeRooms((rooms) => {
      const sorted = [...rooms]
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 4);
      setTrending(sorted);
      setLoading(false);
    });
    return unsub;
  }, []);

  const credits      = user?.credits      ?? MY_PROFILE.credits;
  const rawName      = user?.username     ?? MY_PROFILE.name;
  const firstName    = rawName.replace(/_/g, ' ').split(' ')[0];

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title={`Hey, ${firstName}`}
        right={
          <CreditPill count={credits} onPress={() => setWallet(true)} />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Daily Challenge ── */}
        <View style={styles.sectionPad}>
          <DailyChallengeCard onPress={() => router.push('/(tabs)/discover' as never)} />
        </View>

        {/* ── Mood Rooms ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mood Rooms</Text>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => router.push('/(tabs)/discover' as never)}
            accessibilityRole="link"
            accessibilityLabel="See all mood rooms"
          >
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 4 }}
        >
          {MOOD_ROOMS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.moodCard}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/rooms' as never)}
            >
              {/* Accent stripe — category cue, never a neon background */}
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

        {/* ── Trending ── */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => router.push('/(tabs)/rooms' as never)}
            accessibilityRole="link"
          >
            <Text style={styles.seeAll}>All rooms</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trendingCard}>
          {loadingTrending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={orbit.textTertiary} />
            </View>
          ) : (
            trending.map((room, i) => (
              <React.Fragment key={room.id}>
                <TouchableOpacity
                  style={styles.trendingRow}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/room/${room.id}` as never)}
                >
                  <Text style={styles.trendingRank}>#{i + 1}</Text>
                  <IconBox icon={room.icon} size={40} />
                  <View style={styles.trendingBody}>
                    <View style={styles.trendingNameRow}>
                      <Text style={styles.trendingName} numberOfLines={1}>
                        {room.name}
                      </Text>
                      {room.isLive && <LivePill />}
                    </View>
                    <Text style={styles.trendingMeta}>
                      {room.memberCount.toLocaleString()} online
                      {room.lastMessagePreview
                        ? ` · ${room.lastMessagePreview.slice(0, 28)}…`
                        : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={orbit.textTertiary} />
                </TouchableOpacity>
                {i < trending.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </View>
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

  sectionPad: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  seeAll: {
    color: orbit.accent,
    fontSize: 14,
    fontWeight: '500',
  },

  /* Daily Challenge card */
  challengeCard: {
    flexDirection: 'row',
    backgroundColor: orbit.accentSoftSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.accent,
    padding: 20,
    overflow: 'hidden',
  },
  challengeLeft: {
    flex: 1,
    gap: 6,
    marginRight: 16,
  },
  dailyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: orbit.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  dailyBadgeText: {
    color: orbit.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  challengeTitle: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  challengeMeta: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  challengeEnterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: orbit.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 6,
  },
  challengeEnterText: {
    color: orbit.white,
    fontSize: 12,
    fontWeight: '600',
  },
  challengeRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
  },
  prizeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: orbit.accentSoft,
    borderWidth: 1,
    borderColor: orbit.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeAmount: {
    color: orbit.accent,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  prizeLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '500',
  },

  /* Mood Rooms */
  moodCard: {
    width: 148,
    height: 176,
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
    opacity: 0.75,
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
    marginBottom: 10,
  },
  moodName: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  moodMembers: {
    color: orbit.textTertiary,
    fontSize: 11,
    marginTop: 3,
  },
  moodTagPill: {
    alignSelf: 'flex-start',
    backgroundColor: orbit.surface2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 'auto',
  },
  moodTagText: {
    color: orbit.textSecond,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Trending */
  trendingCard: {
    marginHorizontal: 20,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  trendingRank: {
    width: 24,
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  trendingBody: { flex: 1 },
  trendingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  trendingName: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  trendingMeta: {
    color: orbit.textTertiary,
    fontSize: 12,
  },

  /* Live pill */
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,72,77,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: orbit.danger,
  },
  liveText: {
    color: orbit.danger,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  loadingRow: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});

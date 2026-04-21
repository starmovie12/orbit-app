/**
 * ORBIT — Weekly Challenges Screen (app/challenges/index.tsx)
 *
 * Features:
 *   • 5 active weekly challenges from Firestore /challenges collection
 *     (falls back to WEEKLY_CHALLENGES mock when offline / empty)
 *   • Challenge leaderboard — top 5 entrants by votes across all challenges
 *   • Prize credits display per challenge
 *   • Live countdown timer to next Sunday 00:00 IST (weekly reset)
 *   • Tap a challenge row → /challenges/[id]
 *
 * Firestore schema consumed:
 *   /challenges/{weekId}  e.g. "2026-W16"
 *     category, prompt/title, prizeCredits, endsAt, icon, entries (subcol count)
 *   /challenges/{weekId}/entries/{entryId}
 *     author{uid, username}, votes, createdAt
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Avatar, Divider, IconBox, ScreenHeader, TierPill } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { WEEKLY_CHALLENGES, RANKS_DATA } from '@/constants/data';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const CHALLENGES_COL  = 'challenges';
const ENTRIES_COL     = 'entries';
const LEADERBOARD_CAP = 5;

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ChallengeDoc = {
  id:           string;
  title:        string;
  category:     string;
  icon:         string;
  prizeCredits: number;
  endsAt:       number; // epoch ms
  entryCount:   number;
};

type LeaderEntry = {
  id:       string;
  username: string;
  votes:    number;
  challenge: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** ISO week string for current week, e.g. "2026-W16" */
function currentWeekId(): string {
  const now   = new Date();
  const year  = now.getFullYear();
  // ISO week number
  const jan4  = new Date(year, 0, 4);
  const week  = Math.ceil(((now.getTime() - jan4.getTime()) / 86_400_000 + jan4.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Milliseconds until next Sunday 00:00:00 IST (UTC+5:30). */
function msUntilNextSunday(): number {
  const istOffset = 330 * 60 * 1000;
  const nowIST    = new Date(Date.now() + istOffset);
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

/** Build challenges from mock data as fallback */
function buildMockChallenges(): ChallengeDoc[] {
  return WEEKLY_CHALLENGES.map((c) => ({
    id:           c.id,
    title:        c.title,
    category:     c.category,
    icon:         c.icon,
    prizeCredits: c.prize,
    endsAt:       Date.now() + parseMockEnds(c.ends),
    entryCount:   c.entries,
  }));
}

function parseMockEnds(ends: string): number {
  // e.g. "2d 14h" → ms
  let ms = 0;
  const dm = ends.match(/(\d+)d/);
  const hm = ends.match(/(\d+)h/);
  if (dm) ms += parseInt(dm[1], 10) * 86_400_000;
  if (hm) ms += parseInt(hm[1], 10) * 3_600_000;
  return ms;
}

function fmtTimeLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  return fmtCountdown(Math.max(0, ms));
}

function snapExists(s: any): boolean {
  return typeof s.exists === 'function' ? s.exists() : !!s.exists;
}

/* ─── Mock leaderboard from RANKS_DATA ──────────────────────────────────── */

function buildMockLeader(): LeaderEntry[] {
  return RANKS_DATA.slice(0, LEADERBOARD_CAP).map((u, i) => ({
    id:        u.id,
    username:  u.name,
    votes:     Math.max(10, Math.round(u.weeklyKarma / 4) - i * 12),
    challenge: WEEKLY_CHALLENGES[i % WEEKLY_CHALLENGES.length]?.title ?? 'Challenge',
  }));
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function CountdownBanner({ countdown }: { countdown: string }) {
  return (
    <View style={styles.countdownBanner}>
      <View style={styles.countdownLeft}>
        <Feather name="clock" size={15} color={orbit.warning} />
        <Text style={styles.countdownLabel}>Weekly Reset</Text>
      </View>
      <View style={styles.countdownRight}>
        <Text style={styles.countdownValue}>{countdown}</Text>
        <Text style={styles.countdownSub}>until reset</Text>
      </View>
    </View>
  );
}

function PrizeSummaryRow() {
  return (
    <View style={styles.prizeSummaryRow}>
      {[
        { icon: 'award'  as const, label: 'Winner gets', value: '1,000 credits' },
        { icon: 'star'   as const, label: 'Discover boost', value: 'Top of feed' },
        { icon: 'shield' as const, label: 'Verified badge', value: 'This week' },
      ].map((item, i) => (
        <View key={item.icon} style={[styles.prizeSummaryItem, i === 1 && styles.prizeSummaryCenter]}>
          <Feather name={item.icon} size={16} color={orbit.accent} />
          <Text style={styles.prizeSummaryValue}>{item.value}</Text>
          <Text style={styles.prizeSummaryLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ChallengeRow({
  challenge,
  rank,
  onPress,
}: {
  challenge: ChallengeDoc;
  rank: number;
  onPress: () => void;
}) {
  const timeLeft = fmtTimeLeft(challenge.endsAt);
  const urgent   = challenge.endsAt - Date.now() < 86_400_000; // < 1 day

  return (
    <TouchableOpacity
      style={styles.challengeRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Open challenge: ${challenge.title}`}
    >
      {/* Rank number */}
      <View style={styles.challengeRankWrap}>
        <Text style={styles.challengeRank}>{rank}</Text>
      </View>

      {/* Icon */}
      <IconBox icon={challenge.icon as any} size={44} tint={orbit.accent} />

      {/* Body */}
      <View style={styles.challengeBody}>
        <Text style={styles.challengeTitle} numberOfLines={1}>
          {challenge.title}
        </Text>
        <View style={styles.challengeMeta}>
          <Text style={styles.challengeMetaText}>
            {challenge.entryCount} entries
          </Text>
          <Text style={styles.challengeMetaDot}> · </Text>
          <Feather
            name="clock"
            size={11}
            color={urgent ? orbit.danger : orbit.textTertiary}
          />
          <Text
            style={[
              styles.challengeMetaText,
              urgent && styles.challengeMetaUrgent,
            ]}
          >
            {' '}{timeLeft}
          </Text>
        </View>
        <View style={styles.challengeCategoryRow}>
          <Text style={styles.challengeCategory}>{challenge.category}</Text>
        </View>
      </View>

      {/* Prize pill */}
      <View style={styles.prizePill}>
        <Feather name="zap" size={11} color={orbit.accent} />
        <Text style={styles.prizeText}>+{challenge.prizeCredits}</Text>
      </View>

      <Feather name="chevron-right" size={16} color={orbit.textTertiary} />
    </TouchableOpacity>
  );
}

function LeaderboardSection({ leaders }: { leaders: LeaderEntry[] }) {
  if (leaders.length === 0) return null;

  return (
    <View style={styles.leaderSection}>
      <Text style={styles.sectionLabel}>TOP ENTRIES THIS WEEK</Text>
      {leaders.map((entry, i) => {
        const rankColor =
          i === 0 ? '#E8A33D' :
          i === 1 ? '#B0B0B5' :
          i === 2 ? '#C8896B' :
          orbit.textTertiary;

        return (
          <React.Fragment key={entry.id}>
            <View style={styles.leaderRow}>
              {/* Rank number */}
              <View
                style={[
                  styles.leaderRankCircle,
                  { backgroundColor: i < 3 ? rankColor : orbit.surface2 },
                ]}
              >
                <Text
                  style={[
                    styles.leaderRankNum,
                    { color: i < 3 ? orbit.bg : orbit.textTertiary },
                  ]}
                >
                  {i + 1}
                </Text>
              </View>

              {/* Avatar */}
              <Avatar name={entry.username} size={36} />

              {/* Body */}
              <View style={styles.leaderBody}>
                <Text style={styles.leaderName} numberOfLines={1}>
                  {entry.username}
                </Text>
                <Text style={styles.leaderChallenge} numberOfLines={1}>
                  {entry.challenge}
                </Text>
              </View>

              {/* Votes */}
              <View style={styles.leaderVoteWrap}>
                <Feather name="thumbs-up" size={12} color={orbit.textTertiary} />
                <Text style={styles.leaderVotes}>{entry.votes}</Text>
              </View>
            </View>
            {i < leaders.length - 1 && <Divider inset={60} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */

export default function ChallengesScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { firebaseUser } = useAuth();

  const [challenges, setChallenges] = useState<ChallengeDoc[]>([]);
  const [leaders,    setLeaders]    = useState<LeaderEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [countdown,  setCountdown]  = useState(() => fmtCountdown(msUntilNextSunday()));

  const weekId = currentWeekId();

  /* ── Live countdown ── */
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(fmtCountdown(msUntilNextSunday()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Subscribe to challenges ── */
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = firestore()
        .collection(CHALLENGES_COL)
        .where('weekId', '==', weekId)
        .orderBy('prizeCredits', 'desc')
        .limit(5)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              setChallenges(buildMockChallenges());
              setLeaders(buildMockLeader());
              setLoading(false);
              return;
            }
            const list: ChallengeDoc[] = [];
            qs.forEach((doc) => {
              const d = doc.data();
              list.push({
                id:           doc.id,
                title:        d.title ?? d.prompt ?? 'Untitled',
                category:     d.category ?? 'General',
                icon:         d.icon ?? 'target',
                prizeCredits: d.prizeCredits ?? d.prizeKarma ?? 500,
                endsAt:       typeof d.endsAt?.toMillis === 'function'
                                ? d.endsAt.toMillis()
                                : (d.endsAt ?? Date.now() + 86_400_000 * 3),
                entryCount:   d.entryCount ?? 0,
              });
            });
            setChallenges(list.length > 0 ? list : buildMockChallenges());
            setLoading(false);
          },
          () => {
            setChallenges(buildMockChallenges());
            setLeaders(buildMockLeader());
            setLoading(false);
          },
        );
    } catch {
      setChallenges(buildMockChallenges());
      setLeaders(buildMockLeader());
      setLoading(false);
    }
    return () => unsub?.();
  }, [weekId]);

  /* ── Subscribe to top entries (leaderboard) ── */
  useEffect(() => {
    if (challenges.length === 0) return;

    let unsub: (() => void) | undefined;
    try {
      // Query top entries across first challenge as proxy leaderboard
      // Full cross-challenge leaderboard would require a Cloud Function aggregation
      const firstId = challenges[0]?.id;
      if (!firstId) {
        setLeaders(buildMockLeader());
        return;
      }

      unsub = firestore()
        .collection(CHALLENGES_COL)
        .doc(firstId)
        .collection(ENTRIES_COL)
        .orderBy('votes', 'desc')
        .limit(LEADERBOARD_CAP)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              setLeaders(buildMockLeader());
              return;
            }
            const list: LeaderEntry[] = [];
            qs.forEach((doc) => {
              const d = doc.data();
              list.push({
                id:        doc.id,
                username:  d.author?.username ?? 'user',
                votes:     d.votes ?? 0,
                challenge: challenges[0]?.title ?? 'Challenge',
              });
            });
            setLeaders(list.length > 0 ? list : buildMockLeader());
          },
          () => setLeaders(buildMockLeader()),
        );
    } catch {
      setLeaders(buildMockLeader());
    }
    return () => unsub?.();
  }, [challenges]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Challenges" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={orbit.accent} />
          <Text style={styles.loadingText}>Loading challenges…</Text>
        </View>
      </View>
    );
  }

  const bottomPad = insets.bottom + 24;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Challenges"
        onBack={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* Countdown banner */}
        <CountdownBanner countdown={countdown} />

        {/* Prize summary strip */}
        <PrizeSummaryRow />

        {/* Section header */}
        <Text style={styles.sectionLabel}>ACTIVE THIS WEEK</Text>

        {/* Challenge list */}
        <View style={styles.challengesCard}>
          {challenges.map((c, i) => (
            <React.Fragment key={c.id}>
              <ChallengeRow
                challenge={c}
                rank={i + 1}
                onPress={() => router.push(`/challenges/${c.id}` as any)}
              />
              {i < challenges.length - 1 && <Divider inset={20} />}
            </React.Fragment>
          ))}
        </View>

        {/* Leaderboard */}
        <LeaderboardSection leaders={leaders} />

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Winners announced Sunday midnight IST. Top 3 earn bonus credits.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: orbit.bg,
  },

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

  /* Countdown banner */
  countdownBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(232, 163, 61, 0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.20)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownLabel: {
    color: orbit.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  countdownRight: {
    alignItems: 'flex-end',
  },
  countdownValue: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  countdownSub: {
    color: orbit.textTertiary,
    fontSize: 11,
    marginTop: 1,
  },

  /* Prize summary */
  prizeSummaryRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: orbit.surface1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
  },
  prizeSummaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  prizeSummaryCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  prizeSummaryValue: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  prizeSummaryLabel: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  /* Section label */
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  /* Challenges card */
  challengesCard: {
    marginHorizontal: 20,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
    marginBottom: 24,
  },

  /* Challenge row */
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  challengeRankWrap: {
    width: 20,
    alignItems: 'center',
  },
  challengeRank: {
    color: orbit.textTertiary,
    fontSize: 13,
    fontWeight: '700',
  },
  challengeBody: {
    flex: 1,
  },
  challengeTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  challengeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  challengeMetaText: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  challengeMetaDot: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  challengeMetaUrgent: {
    color: orbit.danger,
  },
  challengeCategoryRow: {
    flexDirection: 'row',
  },
  challengeCategory: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },

  /* Prize pill */
  prizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  prizeText: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Leaderboard */
  leaderSection: {
    marginHorizontal: 20,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
    marginBottom: 16,
    paddingTop: 12,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  leaderRankCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderRankNum: {
    fontSize: 11,
    fontWeight: '700',
  },
  leaderBody: {
    flex: 1,
  },
  leaderName: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  leaderChallenge: {
    color: orbit.textTertiary,
    fontSize: 11,
  },
  leaderVoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderVotes: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  footerNote: {
    color: orbit.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginHorizontal: 40,
    lineHeight: 18,
    marginBottom: 8,
  },
});

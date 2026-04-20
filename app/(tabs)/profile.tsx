/**
 * ORBIT — Profile Tab (v2 — Firestore-wired)
 *
 * Changes from v1 (mock MY_PROFILE) → v2 (live auth user):
 *   • All data comes from useAuth() — real Firestore UserDoc.
 *   • Achievements are derived from real stats (karma, streak, posts,
 *     watches, trophies) so the section is always populated.
 *   • OrbitCard uses real bio, interests (as skills), karma, rank, posts.
 *   • Stats strip shows real karma / posts / watches / credits.
 *   • TrustScore is real from Firestore.
 *   • Log Out calls signOut() — triggers route guard redirect.
 *   • Edit Profile navigates to /edit-profile.
 *
 * Visual design: 100% preserved from v1 — quiet luxury, orbit tokens only.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  ScreenHeader,
  TierPill,
  Avatar,
  IconBox,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import type { UserDoc } from '@/lib/firestore-users';
import type { FeatherIconName } from '@/components/shared';

/* ─────────────────────────────────────────────────────────────────────
   Achievement derivation
   Generates a rich achievement list from the user's live Firestore stats.
   Works for any user — new (shows "Getting Started") or veteran.
───────────────────────────────────────────────────────────────────── */

type Achievement = { icon: FeatherIconName; label: string; desc: string };

function deriveAchievements(user: UserDoc): Achievement[] {
  const list: Achievement[] = [];

  // Rank achievements
  if (user.rank != null && user.rank <= 1)    list.push({ icon: 'award',    label: 'First Place',   desc: 'Top #1 on the Global Leaderboard' });
  else if (user.rank != null && user.rank <= 10) list.push({ icon: 'award', label: 'Top 10',        desc: `Ranked #${user.rank} globally` });

  // Karma milestones
  const karma = user.karma ?? 0;
  if (karma >= 5000)       list.push({ icon: 'hexagon',  label: 'Diamond',      desc: '5000+ Karma points earned' });
  else if (karma >= 1000)  list.push({ icon: 'zap',      label: '1K Karma',     desc: 'Earned your first 1000 Karma' });
  else if (karma >= 100)   list.push({ icon: 'trending-up', label: 'Rising',    desc: 'Earned your first 100 Karma' });

  // Streak
  const streak = user.streak ?? 0;
  if (streak >= 30)        list.push({ icon: 'activity', label: '30-Day Streak', desc: '30 days of continuous activity' });
  else if (streak >= 7)    list.push({ icon: 'activity', label: 'On Fire',       desc: '7-day posting streak' });
  else if (streak >= 3)    list.push({ icon: 'activity', label: 'Consistent',    desc: '3-day posting streak' });

  // Posts
  const posts = user.posts ?? 0;
  if (posts >= 100)        list.push({ icon: 'star',    label: 'Star Creator',  desc: '100+ Discover posts uploaded' });
  else if (posts >= 10)    list.push({ icon: 'edit',    label: 'Creator',       desc: 'Published 10+ posts' });

  // Watches
  const watches = user.watches ?? 0;
  if (watches >= 500)      list.push({ icon: 'eye',     label: 'Watcher',       desc: 'Watched 500+ posts' });

  // Trophy badges (from trophies[] string array on doc)
  const TROPHY_MAP: Record<string, Achievement> = {
    top1:    { icon: 'award',   label: 'Champion',   desc: 'Won a weekly challenge' },
    streak:  { icon: 'zap',     label: 'Streak King', desc: 'Longest streak in the room' },
    star:    { icon: 'star',    label: 'Star',        desc: 'Star badge awarded' },
    diamond: { icon: 'hexagon', label: 'Diamond',     desc: 'Diamond tier reached' },
  };
  const alreadyLabels = new Set(list.map(a => a.label));
  (user.trophies ?? []).forEach(t => {
    const mapped = TROPHY_MAP[t];
    if (mapped && !alreadyLabels.has(mapped.label)) {
      list.push(mapped);
      alreadyLabels.add(mapped.label);
    }
  });

  // Joined Orbit milestone — always shown for new users
  if (list.length === 0) {
    list.push({ icon: 'home',      label: 'Welcome',    desc: 'Joined the Orbit community' });
    list.push({ icon: 'message-circle', label: 'First Step', desc: 'Profile complete — start chatting!' });
  }

  return list.slice(0, 6); // max 6 achievements shown
}

/* ─────────────────────────────────────────────────────────────────────
   StatBox
───────────────────────────────────────────────────────────────────── */

function StatBox({ val, lbl }: { val: string | number; lbl: string }) {
  const display = typeof val === 'number' ? val.toLocaleString('en-IN') : val;
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{display}</Text>
      <Text style={styles.statLbl}>{lbl}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   TrustScoreBlock
───────────────────────────────────────────────────────────────────── */

function TrustScoreBlock({ score }: { score: number }) {
  const color =
    score >= 90 ? orbit.success :
    score >= 70 ? orbit.warning :
    orbit.danger;

  return (
    <View style={styles.trustCard}>
      <View style={styles.trustHeader}>
        <View style={styles.trustHeaderLeft}>
          <Feather name="shield" size={14} color={orbit.textSecond} />
          <Text style={styles.trustLabel}>TRUST SCORE</Text>
        </View>
        <Text style={[styles.trustVal, { color }]}>{score}</Text>
      </View>
      <View style={styles.trustTrack}>
        <View
          style={[
            styles.trustFill,
            { width: `${Math.min(100, score)}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.trustHint}>
        Improves with daily activity, positive reports, and low violations.
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   OrbitCard
───────────────────────────────────────────────────────────────────── */

function OrbitCard({ user }: { user: UserDoc }) {
  const displayName = user.displayName || user.username || 'You';
  const handle      = user.username ? `@${user.username}` : '—';
  // interests serve as the "skills" shown on the card
  const skills      = user.interests ?? [];

  return (
    <View style={styles.orbitCard}>
      <View style={styles.orbitCardHeader}>
        <Avatar name={displayName} size={56} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.orbitCardName}>{displayName}</Text>
          <Text style={styles.orbitCardHandle}>{handle}</Text>
        </View>
      </View>

      {!!user.bio && (
        <Text style={styles.orbitCardBio} numberOfLines={2}>
          {user.bio}
        </Text>
      )}

      {skills.length > 0 && (
        <View style={styles.orbitCardSkills}>
          {skills.slice(0, 5).map((s, i) => (
            <View key={i} style={styles.skillTag}>
              <Text style={styles.skillTagText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.orbitCardFooter}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>
            {(user.karma ?? 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.cardStatLbl}>KARMA</Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>
            {user.rank != null ? `#${user.rank}` : '—'}
          </Text>
          <Text style={styles.cardStatLbl}>RANK</Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>{user.posts ?? 0}</Text>
          <Text style={styles.cardStatLbl}>POSTS</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardShareBtn} activeOpacity={0.85}>
          <Feather name="share-2" size={14} color={orbit.white} />
          <Text style={styles.cardShareText}>Share Card</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardQrBtn} activeOpacity={0.85}>
          <Feather name="grid" size={16} color={orbit.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Settings rows
───────────────────────────────────────────────────────────────────── */

const SETTINGS_ROWS: {
  icon: FeatherIconName;
  label: string;
  danger?: boolean;
  routeKey: string;
}[] = [
  { icon: 'edit-2',      label: 'Edit Profile',         routeKey: 'editProfile' },
  { icon: 'bell',        label: 'Notifications',        routeKey: 'settings' },
  { icon: 'lock',        label: 'Privacy & Security',   routeKey: 'settings' },
  { icon: 'shield',      label: 'DPDP Privacy Controls',routeKey: 'settings' },
  { icon: 'zap',         label: 'Top Up Credits',       routeKey: 'settings' },
  { icon: 'credit-card', label: 'Payment Methods',      routeKey: 'settings' },
  { icon: 'globe',       label: 'Language & Region',    routeKey: 'settings' },
  { icon: 'download',    label: 'Export My Data',       routeKey: 'settings' },
  { icon: 'help-circle', label: 'Help & Support',       routeKey: 'settings' },
  { icon: 'log-out',     label: 'Log Out',              routeKey: 'logout',   danger: true },
  { icon: 'trash-2',     label: 'Delete Account',       routeKey: 'delete',   danger: true },
];

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function ProfileScreen() {
  const router             = useRouter();
  const insets             = useSafeAreaInsets();
  const { user, signOut, loading } = useAuth();

  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  /* Loading / unauthenticated guard */
  if (loading || !user) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  const displayName  = user.displayName || user.username || 'You';
  const handle       = user.username ? `@${user.username}` : '—';
  const tier         = user.badge as 'LEGEND' | 'MASTER' | 'PRO' | 'RISING' | 'ACTIVE';
  const achievements = deriveAchievements(user);

  /* Action handlers */
  const handleLogOut = () =>
    Alert.alert(
      'Log Out',
      'Kya tum log out karna chahte ho?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: signOut },
      ]
    );

  const handleDelete = () =>
    Alert.alert(
      'Delete Account',
      'Yeh permanent action hai. Sab data delete ho jayega.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Contact Support', 'Account delete karne ke liye email karo: grievance@orbitapp.in'),
        },
      ]
    );

  const handleSettingsPress = (routeKey: string) => {
    switch (routeKey) {
      case 'editProfile': router.push('/edit-profile'       as never); break;
      case 'logout':      handleLogOut();                               break;
      case 'delete':      handleDelete();                               break;
      default:            router.push('/(tabs)/settings'    as never); break;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="You"
        right={
          <TouchableOpacity
            hitSlop={8}
            onPress={() => router.push('/(tabs)/settings' as never)}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Feather name="settings" size={20} color={orbit.textSecond} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Hero ──────────────────────────────────────────────── */}
        <View style={styles.profileHero}>
          <Avatar name={displayName} size={96} />
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileHandle}>{handle}</Text>
          {!!user.bio && (
            <Text style={styles.profileBio}>{user.bio}</Text>
          )}
          <View style={styles.profileBadgeRow}>
            <TierPill tier={tier} />
            {user.rank != null && (
              <>
                <Text style={styles.profileDot}>·</Text>
                <Text style={styles.profileRank}>
                  #{user.rank.toLocaleString('en-IN')} Global
                </Text>
              </>
            )}
            {(user.streak ?? 0) > 0 && (
              <>
                <Text style={styles.profileDot}>·</Text>
                <View style={styles.streakRow}>
                  <Feather name="zap" size={11} color={orbit.warning} />
                  <Text style={styles.streakText}>{user.streak}d streak</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Stats strip ──────────────────────────────────────── */}
        <View style={styles.statsStrip}>
          <StatBox val={user.karma   ?? 0} lbl="KARMA"   />
          <View style={styles.statDivider} />
          <StatBox val={user.posts   ?? 0} lbl="POSTS"   />
          <View style={styles.statDivider} />
          <StatBox val={user.watches ?? 0} lbl="WATCHES" />
          <View style={styles.statDivider} />
          <StatBox val={user.credits ?? 0} lbl="CREDITS" />
        </View>

        {/* ── Trust Score ──────────────────────────────────────── */}
        <View style={styles.section}>
          <TrustScoreBlock score={user.trustScore ?? 50} />
        </View>

        {/* ── Orbit Card ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ORBIT CARD</Text>
          <OrbitCard user={user} />
        </View>

        {/* ── Achievements ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
          <View style={styles.achievementsCard}>
            {achievements.map((a, i) => (
              <React.Fragment key={i}>
                <View style={styles.achievementItem}>
                  <IconBox icon={a.icon} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.achievementLabel}>{a.label}</Text>
                    <Text style={styles.achievementDesc}>{a.desc}</Text>
                  </View>
                </View>
                {i < achievements.length - 1 && (
                  <View style={styles.achievementDivider} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Settings shortcut ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SETTINGS</Text>
          <View style={styles.settingsCard}>
            {SETTINGS_ROWS.map((opt, i) => (
              <React.Fragment key={opt.label}>
                <TouchableOpacity
                  style={styles.settingsRow}
                  activeOpacity={0.7}
                  onPress={() => handleSettingsPress(opt.routeKey)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <View style={styles.settingsIconBox}>
                    <Feather
                      name={opt.icon}
                      size={16}
                      color={opt.danger ? orbit.danger : orbit.textSecond}
                    />
                  </View>
                  <Text
                    style={[
                      styles.settingsLabel,
                      opt.danger && { color: orbit.danger },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Feather name="chevron-right" size={18} color={orbit.textTertiary} />
                </TouchableOpacity>
                {i < SETTINGS_ROWS.length - 1 && (
                  <View style={styles.settingsDivider} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.versionFooter}>
          <Text style={styles.versionText}>Orbit v7.0 · Built in Chandigarh</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES — identical to v1, no tokens removed or changed
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  /* ── Hero ──────────────────────────────────────────── */
  profileHero: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  profileName: {
    color: orbit.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 16,
  },
  profileHandle: {
    color: orbit.textSecond,
    fontSize: 14,
    marginTop: 2,
  },
  profileBio: {
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    maxWidth: 280,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  profileDot:  { color: orbit.textTertiary, fontSize: 12 },
  profileRank: { color: orbit.accent, fontSize: 12, fontWeight: '600' },
  streakRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText:  { color: orbit.textSecond, fontSize: 12, fontWeight: '500' },

  /* ── Stats strip ───────────────────────────────────── */
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
  },
  statBox:     { flex: 1, alignItems: 'center' },
  statVal:     { color: orbit.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  statLbl:     { color: orbit.textTertiary, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },
  statDivider: { width: 1, height: 28, backgroundColor: orbit.borderSubtle },

  /* ── Generic section ───────────────────────────────── */
  section:      { paddingHorizontal: 20, paddingTop: 24 },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11, fontWeight: '600', letterSpacing: 0.6,
    marginBottom: 12,
  },

  /* ── Trust card ────────────────────────────────────── */
  trustCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1, borderColor: orbit.borderSubtle,
    borderRadius: 16, padding: 16,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  trustHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustLabel:      { color: orbit.textSecond, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  trustVal:        { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  trustTrack: {
    height: 6, backgroundColor: orbit.surface2,
    borderRadius: 3, overflow: 'hidden', marginBottom: 10,
  },
  trustFill:  { height: '100%', borderRadius: 3 },
  trustHint:  { color: orbit.textTertiary, fontSize: 12, lineHeight: 17 },

  /* ── Orbit card ────────────────────────────────────── */
  orbitCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1, borderColor: orbit.borderSubtle,
    borderRadius: 16, padding: 16,
  },
  orbitCardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  orbitCardName:    { color: orbit.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  orbitCardHandle:  { color: orbit.textSecond, fontSize: 14, marginTop: 2 },
  orbitCardBio:     { color: orbit.textSecond, fontSize: 14, lineHeight: 18, marginBottom: 14 },
  orbitCardSkills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  skillTag:         { backgroundColor: orbit.surface2, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  skillTagText:     { color: orbit.textSecond, fontSize: 11, fontWeight: '500' },
  orbitCardFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, backgroundColor: orbit.surface2,
    borderRadius: 12, marginBottom: 14,
  },
  cardStat:         { flex: 1, alignItems: 'center' },
  cardStatVal:      { color: orbit.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  cardStatLbl:      { color: orbit.textTertiary, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },
  cardStatDivider:  { width: 1, height: 24, backgroundColor: orbit.borderSubtle },
  cardActions:      { flexDirection: 'row', gap: 10 },
  cardShareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: orbit.accent, paddingVertical: 12, borderRadius: 10,
  },
  cardShareText: { color: orbit.white, fontSize: 14, fontWeight: '600' },
  cardQrBtn: {
    width: 44, height: 44, backgroundColor: orbit.surface2,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },

  /* ── Achievements card ─────────────────────────────── */
  achievementsCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1, borderColor: orbit.borderSubtle,
    borderRadius: 16, overflow: 'hidden',
  },
  achievementItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  achievementLabel:   { color: orbit.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  achievementDesc:    { color: orbit.textTertiary, fontSize: 12, lineHeight: 17 },
  achievementDivider: { height: 1, backgroundColor: orbit.borderSubtle, marginLeft: 64 },

  /* ── Settings card ─────────────────────────────────── */
  settingsCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1, borderColor: orbit.borderSubtle,
    borderRadius: 16, overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 12,
  },
  settingsIconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: orbit.surface2, alignItems: 'center', justifyContent: 'center',
  },
  settingsLabel: { flex: 1, color: orbit.textPrimary, fontSize: 14, fontWeight: '500' },
  settingsDivider: { height: 1, backgroundColor: orbit.borderSubtle, marginLeft: 58 },

  /* ── Version footer ────────────────────────────────── */
  versionFooter: { paddingVertical: 24, alignItems: 'center' },
  versionText:   { color: orbit.textTertiary, fontSize: 11, fontWeight: '500' },
});

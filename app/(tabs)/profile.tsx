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
import { useColors } from '@/hooks/useColors';
import { MY_PROFILE } from '@/constants/data';
import { ScreenHeader, Divider, KarmaBadge } from '@/components/shared';

function StatBox({ val, lbl }: { val: string; lbl: string }) {
  const colors = useColors();
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statVal, { color: colors.text }]}>{val}</Text>
      <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
    </View>
  );
}

function TrustScoreBar({ score }: { score: number }) {
  const colors = useColors();
  const color = score >= 90 ? colors.green : score >= 70 ? colors.gold : colors.red;
  return (
    <View style={styles.trustContainer}>
      <View style={styles.trustHeader}>
        <Text style={[styles.trustLabel, { color: colors.sub }]}>Trust Score</Text>
        <Text style={[styles.trustVal, { color }]}>{score}</Text>
      </View>
      <View style={[styles.trustTrack, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <View style={[styles.trustFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ORBITCard() {
  const colors = useColors();
  const p = MY_PROFILE;
  return (
    <View style={[styles.orbitCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.orbitCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.orbitCardName, { color: colors.text }]}>{p.displayName}</Text>
          <Text style={[styles.orbitCardHandle, { color: colors.sub }]}>{p.handle}</Text>
          <Text style={[styles.orbitCardBio, { color: colors.sub }]} numberOfLines={2}>{p.bio}</Text>
        </View>
        <View style={[styles.orbitCardAvatar, { backgroundColor: p.color + '22', borderColor: p.color + '66' }]}>
          <Text style={{ fontSize: 32 }}>{p.emoji}</Text>
        </View>
      </View>

      <View style={styles.orbitCardSkills}>
        {p.skills.map((s, i) => (
          <View key={i} style={[styles.skillTag, { backgroundColor: colors.blueLight + '22', borderColor: colors.blueLight + '44' }]}>
            <Text style={[styles.skillTagText, { color: colors.blueLight }]}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.orbitCardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.cardStatRow}>
          <View style={styles.cardStat}>
            <Text style={[styles.cardStatVal, { color: colors.text }]}>{p.karma.toLocaleString()}</Text>
            <Text style={[styles.cardStatLbl, { color: colors.sub }]}>Karma</Text>
          </View>
          <View style={[styles.cardStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.cardStat}>
            <Text style={[styles.cardStatVal, { color: colors.text }]}>#{p.rank}</Text>
            <Text style={[styles.cardStatLbl, { color: colors.sub }]}>Global</Text>
          </View>
          <View style={[styles.cardStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.cardStat}>
            <Text style={[styles.cardStatVal, { color: colors.text }]}>{p.posts}</Text>
            <Text style={[styles.cardStatLbl, { color: colors.sub }]}>Posts</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.cardShareBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={styles.cardShareText}>Share Card</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cardQrBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]} activeOpacity={0.8}>
            <Text style={[styles.cardQrText, { color: colors.text }]}>📱 QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const p = MY_PROFILE;
  const [darkMode, setDarkMode] = useState(true);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const SETTINGS = [
    { icon: '🔔', label: 'Notifications',             danger: false },
    { icon: '🔒', label: 'Privacy & Security',        danger: false },
    { icon: '🛡️', label: 'DPDP Privacy Controls',    danger: false },
    { icon: '⚡', label: 'Top Up Credits',            danger: false },
    { icon: '💳', label: 'Payment Methods',           danger: false },
    { icon: '🌐', label: 'Language & Region',         danger: false },
    { icon: '📤', label: 'Export My Data',            danger: false },
    { icon: '🚪', label: 'Log Out',                   danger: true  },
    { icon: '🗑️', label: 'Delete Account',           danger: true  },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="You" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
      >
        {/* Hero */}
        <View style={[styles.profileHero, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: p.color + '22', borderColor: p.color + '66' }]}>
            <Text style={styles.profileAvatarEmoji}>{p.emoji}</Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{p.displayName}</Text>
          <Text style={[styles.profileHandle, { color: colors.sub }]}>{p.handle}</Text>
          <Text style={[styles.profileBio, { color: colors.sub }]}>{p.bio}</Text>
          <View style={styles.profileBadgeRow}>
            <KarmaBadge badge={p.badge} />
            <Text style={[styles.profileRank, { color: colors.blueLight }]}>#{p.rank} Global</Text>
            <View style={[styles.streakBadge, { backgroundColor: colors.red + '22', borderColor: colors.red + '44' }]}>
              <Text style={[styles.streakText, { color: colors.red }]}>🔥 {p.streak}d streak</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsStrip, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <StatBox val={p.karma.toLocaleString()} lbl="Karma" />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatBox val={p.posts.toString()} lbl="Posts" />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatBox val={p.watches.toLocaleString()} lbl="Watches" />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatBox val={`🪙 ${p.credits}`} lbl="Credits" />
        </View>

        {/* Trust Score */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.sub }]}>✅ Trust Score</Text>
          <TrustScoreBar score={p.trustScore} />
          <Text style={[styles.trustHint, { color: colors.mutedForeground }]}>
            Score improves with daily activity, positive reports, and low violations.
          </Text>
        </View>

        <Divider indent={false} />

        {/* ORBIT Card */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sub }]}>💳 ORBIT Card</Text>
          <ORBITCard />
        </View>

        <Divider indent={false} />

        {/* Trophy Room */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sub }]}>🏆 Trophy Room</Text>
          <View style={styles.trophyRow}>
            {p.trophies.map((t, i) => (
              <View key={i} style={[styles.trophyBadge, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Text style={{ fontSize: 28 }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <Divider indent={false} />

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sub }]}>⭐ Achievements</Text>
          {p.achievements.map((a, i) => (
            <View key={i} style={styles.achievementItem}>
              <View style={[styles.achievementIcon, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Text style={{ fontSize: 22 }}>{a.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.achievementLabel, { color: colors.text }]}>{a.label}</Text>
                <Text style={[styles.achievementDesc, { color: colors.sub }]}>{a.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Divider indent={false} />

        {/* Appearance Toggle */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sub }]}>🎨 Appearance</Text>
          <View style={[styles.themeToggleRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.themeBtn, darkMode && { backgroundColor: colors.primary }]}
              onPress={() => setDarkMode(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeBtnText, { color: darkMode ? '#fff' : colors.sub }]}>🌙 Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeBtn, !darkMode && { backgroundColor: colors.blueLight }]}
              onPress={() => setDarkMode(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeBtnText, { color: !darkMode ? '#fff' : colors.sub }]}>☀️ Light</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Divider indent={false} />

        {/* Settings */}
        <View style={styles.section}>
          {SETTINGS.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.settingsRow, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsIcon}>{opt.icon}</Text>
              <Text style={[styles.settingsLabel, { color: opt.danger ? colors.red : colors.text }]}>
                {opt.label}
              </Text>
              <Text style={[styles.settingsChevron, { color: colors.mutedForeground }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.versionFooter]}>
          <Text style={[styles.versionText, { color: colors.mutedForeground }]}>ORBIT v7.0 · Built in Chandigarh 🇮🇳</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  profileHero: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileAvatarEmoji: { fontSize: 38 },
  profileName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  profileHandle: { fontSize: 13 },
  profileBio: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  profileBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  profileRank: { fontSize: 12, fontWeight: '600' },
  streakBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  streakText: { fontSize: 11, fontWeight: '700' },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLbl: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: { width: 1, height: 32 },
  section: { paddingHorizontal: 16, paddingVertical: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  trustContainer: { gap: 6 },
  trustHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trustLabel: { fontSize: 14 },
  trustVal: { fontSize: 22, fontWeight: '800' },
  trustTrack: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trustFill: {
    height: '100%',
    borderRadius: 4,
  },
  trustHint: { fontSize: 11, marginTop: 6, lineHeight: 16 },
  orbitCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  orbitCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  orbitCardAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitCardName: { fontSize: 18, fontWeight: '800', marginBottom: 1 },
  orbitCardHandle: { fontSize: 12, marginBottom: 4 },
  orbitCardBio: { fontSize: 12, lineHeight: 16 },
  orbitCardSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  skillTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  skillTagText: { fontSize: 11, fontWeight: '600' },
  orbitCardFooter: {
    borderTopWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  cardStat: { alignItems: 'center', flex: 1 },
  cardStatVal: { fontSize: 16, fontWeight: '800' },
  cardStatLbl: { fontSize: 10, marginTop: 1 },
  cardStatDivider: { width: 1, height: 28 },
  cardActions: { flexDirection: 'row', gap: 10 },
  cardShareBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cardShareText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardQrBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cardQrText: { fontSize: 13, fontWeight: '600' },
  trophyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trophyBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  achievementIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementLabel: { fontSize: 14, fontWeight: '600' },
  achievementDesc: { fontSize: 12, marginTop: 1 },
  themeToggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 4,
    gap: 4,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  themeBtnText: { fontSize: 13, fontWeight: '700' },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  settingsIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  settingsLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  settingsChevron: { fontSize: 20 },
  versionFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  versionText: { fontSize: 11 },
});

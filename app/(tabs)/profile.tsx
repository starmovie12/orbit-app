import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MY_PROFILE } from '@/constants/data';
import {
  ScreenHeader,
  Divider,
  TierPill,
  Avatar,
  IconBox,
} from '@/components/shared';
import { orbit } from '@/constants/colors';

function StatBox({ val, lbl }: { val: string; lbl: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{val}</Text>
      <Text style={styles.statLbl}>{lbl}</Text>
    </View>
  );
}

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
        <View style={[styles.trustFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.trustHint}>
        Improves with daily activity, positive reports, and low violations.
      </Text>
    </View>
  );
}

function OrbitCard() {
  const p = MY_PROFILE;
  return (
    <View style={styles.orbitCard}>
      <View style={styles.orbitCardHeader}>
        <Avatar name={p.avatarSeed} size={56} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.orbitCardName}>{p.displayName}</Text>
          <Text style={styles.orbitCardHandle}>{p.handle}</Text>
        </View>
      </View>

      <Text style={styles.orbitCardBio} numberOfLines={2}>{p.bio}</Text>

      <View style={styles.orbitCardSkills}>
        {p.skills.map((s, i) => (
          <View key={i} style={styles.skillTag}>
            <Text style={styles.skillTagText}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={styles.orbitCardFooter}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>{p.karma.toLocaleString()}</Text>
          <Text style={styles.cardStatLbl}>KARMA</Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>#{p.rank}</Text>
          <Text style={styles.cardStatLbl}>RANK</Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>{p.posts}</Text>
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

const SETTINGS: { icon: any; label: string; danger?: boolean }[] = [
  { icon: 'edit-2',     label: 'Edit Profile' },
  { icon: 'bell',       label: 'Notifications' },
  { icon: 'lock',       label: 'Privacy & Security' },
  { icon: 'shield',     label: 'DPDP Privacy Controls' },
  { icon: 'zap',        label: 'Top Up Credits' },
  { icon: 'credit-card',label: 'Payment Methods' },
  { icon: 'globe',      label: 'Language & Region' },
  { icon: 'download',   label: 'Export My Data' },
  { icon: 'help-circle',label: 'Help & Support' },
  { icon: 'log-out',    label: 'Log Out',                       danger: true },
  { icon: 'trash-2',    label: 'Delete Account',                danger: true },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = MY_PROFILE;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

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
        {/* Hero — calm, centered, no neon orange "LEGEND" tag */}
        <View style={styles.profileHero}>
          <Avatar name={p.avatarSeed} size={96} />
          <Text style={styles.profileName}>{p.displayName}</Text>
          <Text style={styles.profileHandle}>{p.handle}</Text>
          <Text style={styles.profileBio}>{p.bio}</Text>
          <View style={styles.profileBadgeRow}>
            <TierPill tier={p.badge} />
            <Text style={styles.profileDot}>·</Text>
            <Text style={styles.profileRank}>#{p.rank} Global</Text>
            <Text style={styles.profileDot}>·</Text>
            <View style={styles.streakRow}>
              <Feather name="zap" size={11} color={orbit.warning} />
              <Text style={styles.streakText}>{p.streak}d streak</Text>
            </View>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <StatBox val={p.karma.toLocaleString()} lbl="KARMA" />
          <View style={styles.statDivider} />
          <StatBox val={p.posts.toString()} lbl="POSTS" />
          <View style={styles.statDivider} />
          <StatBox val={p.watches.toLocaleString()} lbl="WATCHES" />
          <View style={styles.statDivider} />
          <StatBox val={p.credits.toString()} lbl="CREDITS" />
        </View>

        {/* Trust Score */}
        <View style={styles.section}>
          <TrustScoreBlock score={p.trustScore} />
        </View>

        {/* Orbit Card */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ORBIT CARD</Text>
          <OrbitCard />
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
          <View style={styles.achievementsCard}>
            {p.achievements.map((a, i) => (
              <React.Fragment key={i}>
                <View style={styles.achievementItem}>
                  <IconBox icon={a.icon} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.achievementLabel}>{a.label}</Text>
                    <Text style={styles.achievementDesc}>{a.desc}</Text>
                  </View>
                </View>
                {i < p.achievements.length - 1 && <View style={styles.achievementDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Settings shortcut */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SETTINGS</Text>
          <View style={styles.settingsCard}>
            {SETTINGS.map((opt, i) => (
              <React.Fragment key={i}>
                <TouchableOpacity
                  style={styles.settingsRow}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/settings' as never)}
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
                {i < SETTINGS.length - 1 && <View style={styles.settingsDivider} />}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Hero */
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
  profileDot: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  profileRank: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },

  /* Stats strip */
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
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLbl: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: orbit.borderSubtle,
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
  },

  /* Trust score card */
  trustCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 16,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trustHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustLabel: {
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  trustVal: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  trustTrack: {
    height: 6,
    backgroundColor: orbit.surface2,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  trustFill: {
    height: '100%',
    borderRadius: 3,
  },
  trustHint: {
    color: orbit.textTertiary,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Orbit card */
  orbitCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 16,
  },
  orbitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  orbitCardName: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  orbitCardHandle: {
    color: orbit.textSecond,
    fontSize: 14,
    marginTop: 2,
  },
  orbitCardBio: {
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 14,
  },
  orbitCardSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  skillTag: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  skillTagText: {
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: '500',
  },
  orbitCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    marginBottom: 14,
  },
  cardStat: {
    flex: 1,
    alignItems: 'center',
  },
  cardStatVal: {
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardStatLbl: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  cardStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: orbit.borderSubtle,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cardShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: orbit.accent,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cardShareText: {
    color: orbit.white,
    fontSize: 14,
    fontWeight: '600',
  },
  cardQrBtn: {
    width: 44,
    height: 44,
    backgroundColor: orbit.surface2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Achievements card */
  achievementsCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: 'hidden',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  achievementLabel: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  achievementDesc: {
    color: orbit.textTertiary,
    fontSize: 12,
    lineHeight: 17,
  },
  achievementDivider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
    marginLeft: 64,
  },

  /* Settings card */
  settingsCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  settingsIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
    marginLeft: 58,
  },

  versionFooter: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  versionText: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '500',
  },
});

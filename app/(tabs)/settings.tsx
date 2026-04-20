/**
 * ORBIT — Settings Screen (v2 — wired to auth)
 *
 * Changes from v1:
 *   • Log Out row calls signOut() from AuthContext.
 *   • Edit Profile row navigates to /edit-profile.
 *   • Phone number shows real number from firebaseUser.
 *   • Toggle state is local (will sync to Firestore in Phase 2).
 *   • Delete Account shows a warning + contact email.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader, SearchBar } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

type SettingRow = {
  icon: any;
  label: string;
  hint?: string;
  danger?: boolean;
  toggle?: boolean;
  value?: boolean;
  onPress?: () => void;
};
type Group = { title: string; rows: SettingRow[] };

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, user, signOut } = useAuth();

  const [search,      setSearch]      = useState('');
  const [notifPush,   setNotifPush]   = useState(true);
  const [notifSound,  setNotifSound]  = useState(true);
  const [analytics,   setAnalytics]   = useState(true);

  // Display phone with masking: +91 ••••• 43210
  const maskedPhone = (() => {
    const p = firebaseUser?.phoneNumber ?? '';
    if (!p.startsWith('+91') || p.length < 12) return p || 'Not set';
    const last4 = p.slice(-4);
    return `+91 ••••• ${last4.slice(0, 2)} ${last4.slice(2)}`;
  })();

  const handleLogOut = () => {
    Alert.alert(
      'Log Out',
      'Kya tum log out karna chahte ho?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Yeh permanent action hai. Apna data recover nahi hoga.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'Account delete karne ke liye email karo: support@orbitapp.in'
            );
          },
        },
      ]
    );
  };

  const groups: Group[] = [
    {
      title: 'ACCOUNT',
      rows: [
        {
          icon: 'user',
          label: 'Edit Profile',
          hint: 'Name, handle, bio',
          onPress: () => router.push('/edit-profile' as never),
        },
        {
          icon: 'phone',
          label: 'Phone Number',
          hint: maskedPhone,
        },
        {
          icon: 'mail',
          label: 'Email',
          hint: 'Not set',
        },
        {
          icon: 'key',
          label: 'Change PIN / Password',
        },
      ],
    },
    {
      title: 'NOTIFICATIONS',
      rows: [
        {
          icon: 'bell',
          label: 'Push notifications',
          toggle: true,
          value: notifPush,
          onPress: () => setNotifPush(v => !v),
        },
        {
          icon: 'volume-2',
          label: 'Sounds',
          toggle: true,
          value: notifSound,
          onPress: () => setNotifSound(v => !v),
        },
        {
          icon: 'moon',
          label: 'Do not disturb',
          hint: 'Off',
        },
      ],
    },
    {
      title: 'PRIVACY & SECURITY',
      rows: [
        { icon: 'lock',   label: 'Privacy controls',        hint: 'Who can DM you' },
        { icon: 'shield', label: 'DPDP Privacy Settings',   hint: 'Data rights (India)' },
        { icon: 'user-x', label: 'Blocked accounts' },
        { icon: 'eye',    label: 'Active sessions',         hint: '1 device' },
      ],
    },
    {
      title: 'WALLET',
      rows: [
        {
          icon: 'credit-card',
          label: 'Credits Balance',
          hint: `${user?.credits ?? 0} credits`,
        },
        { icon: 'zap',       label: 'Top up credits' },
        { icon: 'file-text', label: 'Transaction history' },
      ],
    },
    {
      title: 'APP',
      rows: [
        { icon: 'globe',        label: 'Language',       hint: user?.language?.toUpperCase() ?? 'EN' },
        { icon: 'map-pin',      label: 'Region',         hint: user?.region ?? 'India' },
        { icon: 'droplet',      label: 'Appearance',     hint: 'Dark' },
        {
          icon: 'bar-chart-2',
          label: 'Usage analytics',
          toggle: true,
          value: analytics,
          onPress: () => setAnalytics(v => !v),
        },
      ],
    },
    {
      title: 'DATA',
      rows: [
        { icon: 'download',     label: 'Export my data' },
        { icon: 'upload-cloud', label: 'Backup' },
      ],
    },
    {
      title: 'SUPPORT',
      rows: [
        { icon: 'help-circle',    label: 'Help & FAQs' },
        { icon: 'message-square', label: 'Contact support' },
        { icon: 'file-text',      label: 'Terms of Service' },
        { icon: 'shield',         label: 'Privacy Policy' },
        { icon: 'star',           label: 'Rate Orbit' },
      ],
    },
    {
      title: 'ACCOUNT ACTIONS',
      rows: [
        {
          icon: 'log-out',
          label: 'Log Out',
          danger: true,
          onPress: handleLogOut,
        },
        {
          icon: 'trash-2',
          label: 'Delete Account',
          danger: true,
          onPress: handleDeleteAccount,
        },
      ],
    },
  ];

  const filtered = search.trim()
    ? groups
        .map(g => ({
          ...g,
          rows: g.rows.filter(r =>
            r.label.toLowerCase().includes(search.toLowerCase()) ||
            r.hint?.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter(g => g.rows.length > 0)
    : groups;

  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Settings"
        showBack
        onBack={() => router.back()}
      />
      <SearchBar
        placeholder="Search settings…"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {filtered.map((group) => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{group.title}</Text>
            <View style={styles.groupCard}>
              {group.rows.map((row, i) => (
                <React.Fragment key={row.label}>
                  <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={row.onPress}
                    disabled={!row.onPress && !row.toggle}
                    accessibilityRole={row.toggle ? 'switch' : 'button'}
                    accessibilityLabel={row.label}
                    accessibilityState={row.toggle ? { checked: !!row.value } : undefined}
                  >
                    <View style={styles.iconBox}>
                      <Feather
                        name={row.icon}
                        size={16}
                        color={row.danger ? orbit.danger : orbit.textSecond}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowLabel, row.danger && { color: orbit.danger }]}>
                        {row.label}
                      </Text>
                      {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
                    </View>
                    {row.toggle ? (
                      <View style={[styles.switch, { backgroundColor: row.value ? orbit.accent : orbit.surface3 }]}>
                        <View style={[styles.switchKnob, { transform: [{ translateX: row.value ? 16 : 0 }] }]} />
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={18} color={orbit.textTertiary} />
                    )}
                  </TouchableOpacity>
                  {i < group.rows.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.versionFooter}>
          <Text style={styles.versionText}>Orbit v7.0</Text>
          <Text style={styles.versionSub}>Built in Chandigarh</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  section:      { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: { color: orbit.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10 },
  groupCard: {
    backgroundColor: orbit.surface1, borderWidth: 1,
    borderColor: orbit.borderSubtle, borderRadius: 16, overflow: 'hidden',
  },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: orbit.surface2, alignItems: 'center', justifyContent: 'center',
  },
  rowBody:  { flex: 1 },
  rowLabel: { color: orbit.textPrimary, fontSize: 14, fontWeight: '500' },
  rowHint:  { color: orbit.textTertiary, fontSize: 12, marginTop: 2 },
  divider:  { height: 1, backgroundColor: orbit.borderSubtle, marginLeft: 58 },
  switch: {
    width: 38, height: 22, borderRadius: 11, padding: 3, justifyContent: 'center',
  },
  switchKnob: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: orbit.white,
  },
  versionFooter: { paddingVertical: 32, alignItems: 'center' },
  versionText:   { color: orbit.textSecond, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  versionSub:    { color: orbit.textTertiary, fontSize: 11, marginTop: 4 },
});

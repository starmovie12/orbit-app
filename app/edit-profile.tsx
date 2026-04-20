/**
 * ORBIT — Edit Profile Screen (NEW)
 *
 * Route: /edit-profile
 * Access: Profile tab → Edit Profile row / Settings → Edit Profile
 *
 * Fields editable:
 *   • Display Name (max 30 chars)
 *   • Bio (max 120 chars)
 *   • Region (free text, max 40 chars)
 *   • Avatar color picker (from AVATAR_COLORS)
 *
 * Username is NOT editable here (claim is permanent in Phase 1).
 * Language change redirects back to the onboarding language screen.
 *
 * On save → updateUser() writes to Firestore. The live subscription in
 * AuthContext will push the fresh doc back automatically.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { orbit } from '@/constants/colors';
import { AVATAR_COLORS } from '@/constants/onboarding';
import { useAuth } from '@/contexts/AuthContext';
import { updateUser } from '@/lib/firestore-users';

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.replace(/[@_]/g, ' ').split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CharCount({ value, max }: { value: string; max: number }) {
  const n      = value.length;
  const near   = n >= max * 0.85;
  const atMax  = n >= max;
  return (
    <Text style={[styles.charCount, near && { color: orbit.warning }, atMax && { color: orbit.danger }]}>
      {n}/{max}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, user } = useAuth();

  /* Local form state */
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio,         setBio]         = useState(user?.bio         ?? '');
  const [region,      setRegion]      = useState(user?.region      ?? '');
  const [color,       setColor]       = useState(user?.color       ?? AVATAR_COLORS[0]);
  const [saving,      setSaving]      = useState(false);
  const [dirty,       setDirty]       = useState(false);

  /* Track dirty state */
  useEffect(() => {
    const hasChanged =
      displayName !== (user?.displayName ?? '') ||
      bio         !== (user?.bio         ?? '') ||
      region      !== (user?.region      ?? '') ||
      color       !== (user?.color       ?? AVATAR_COLORS[0]);
    setDirty(hasChanged);
  }, [displayName, bio, region, color, user]);

  const avatarSeed    = displayName.trim() || user?.username || 'you';
  const initials      = initialsOf(avatarSeed);
  const previewHandle = user?.username ? `@${user.username}` : '—';

  const handleSave = async () => {
    if (!firebaseUser || saving) return;
    setSaving(true);
    try {
      await updateUser(firebaseUser.uid, {
        displayName: displayName.trim() || null,
        bio:         bio.trim(),
        region:      region.trim() || null,
        color,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Kuch issue hai. Dobara try karo.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty) {
      Alert.alert(
        'Discard changes?',
        'Changes save nahi honge.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard',      style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + 16;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: orbit.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit Profile</Text>

        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!dirty || saving}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
        >
          {saving
            ? <ActivityIndicator size="small" color={orbit.white} />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Avatar preview ──────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: color }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.avatarHandle}>{previewHandle}</Text>
          <Text style={styles.avatarNote}>
            Username change nahi ho sakta.
          </Text>
        </View>

        {/* ── Display Name ────────────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            <CharCount value={displayName} max={30} />
          </View>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name (optional)"
            placeholderTextColor={orbit.textTertiary}
            maxLength={30}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={styles.fieldHint}>
            Shown on your Orbit Card and profile header.
          </Text>
        </View>

        {/* ── Bio ─────────────────────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>BIO</Text>
            <CharCount value={bio} max={120} />
          </View>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Thoda apne baare mein batao…"
            placeholderTextColor={orbit.textTertiary}
            maxLength={120}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* ── Region ──────────────────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>CITY / REGION</Text>
            <CharCount value={region} max={40} />
          </View>
          <TextInput
            style={styles.input}
            value={region}
            onChangeText={setRegion}
            placeholder="e.g. Chandigarh, Delhi, Mumbai"
            placeholderTextColor={orbit.textTertiary}
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* ── Avatar color ─────────────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>AVATAR COLOR</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => {
              const active = c === color;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    active && styles.colorDotActive,
                  ]}
                >
                  {active && (
                    <Feather name="check" size={14} color={orbit.white} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Readonly info ────────────────────────────────────── */}
        <View style={styles.readonlyCard}>
          <View style={styles.readonlyRow}>
            <Feather name="phone" size={14} color={orbit.textTertiary} />
            <Text style={styles.readonlyLabel}>Phone</Text>
            <Text style={styles.readonlyValue}>
              {firebaseUser?.phoneNumber ?? 'Not set'}
            </Text>
          </View>
          <View style={styles.readonlyDivider} />
          <View style={styles.readonlyRow}>
            <Feather name="user" size={14} color={orbit.textTertiary} />
            <Text style={styles.readonlyLabel}>Username</Text>
            <Text style={styles.readonlyValue}>
              {user?.username ? `@${user.username}` : '—'}
            </Text>
          </View>
          <View style={styles.readonlyDivider} />
          <View style={styles.readonlyRow}>
            <Feather name="zap" size={14} color={orbit.textTertiary} />
            <Text style={styles.readonlyLabel}>Credits</Text>
            <Text style={styles.readonlyValue}>{user?.credits ?? 0}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root:   { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: orbit.borderSubtle,
  },
  headerBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: orbit.textPrimary, fontSize: 16, fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: orbit.accent, borderRadius: 8, minWidth: 60, alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: orbit.surface2,
  },
  saveBtnText: {
    color: orbit.white, fontSize: 14, fontWeight: '600',
  },

  /* Avatar preview */
  avatarSection: {
    alignItems: 'center', paddingVertical: 28,
    borderBottomWidth: 1, borderBottomColor: orbit.borderSubtle,
  },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarInitials: {
    color: orbit.white, fontSize: 34, fontWeight: '700', letterSpacing: -1,
  },
  avatarHandle: {
    color: orbit.textSecond, fontSize: 15, fontWeight: '500',
  },
  avatarNote: {
    color: orbit.textTertiary, fontSize: 11, marginTop: 4,
  },

  /* Field groups */
  fieldGroup: {
    paddingHorizontal: 20, paddingTop: 22,
  },
  fieldLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  fieldLabel: {
    color: orbit.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.6,
  },
  charCount: {
    color: orbit.textTertiary, fontSize: 11, fontWeight: '500',
  },
  input: {
    backgroundColor: orbit.surface1,
    borderWidth: 1, borderColor: orbit.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: orbit.textPrimary, fontSize: 15, fontWeight: '400',
  },
  inputMultiline: {
    minHeight: 80, maxHeight: 120,
  },
  fieldHint: {
    color: orbit.textTertiary, fontSize: 12, marginTop: 8, lineHeight: 16,
  },

  /* Color picker */
  colorRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10,
  },
  colorDot: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 2.5, borderColor: orbit.white,
    shadowColor: '#000', shadowOpacity: 0.35,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  /* Readonly info card */
  readonlyCard: {
    marginHorizontal: 20, marginTop: 28,
    backgroundColor: orbit.surface1,
    borderWidth: 1, borderColor: orbit.borderSubtle,
    borderRadius: 14, overflow: 'hidden',
  },
  readonlyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14, gap: 10,
  },
  readonlyLabel: {
    flex: 1, color: orbit.textSecond, fontSize: 14, fontWeight: '500',
  },
  readonlyValue: {
    color: orbit.textTertiary, fontSize: 14,
  },
  readonlyDivider: {
    height: 1, backgroundColor: orbit.borderSubtle, marginLeft: 38,
  },
});

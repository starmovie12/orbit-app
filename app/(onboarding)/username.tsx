import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingStepper } from "@/components/OnboardingStepper";
import { AVATAR_COLORS } from "@/constants/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import {
  claimUsername,
  setOnboardingStep,
  updateUser,
} from "@/lib/firestore-users";
import { orbit } from "@/constants/colors";

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.replace(/[@_]/g, " ").split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UsernameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [handle, setHandle] = useState(user?.username ?? "");
  const [color, setColor] = useState(user?.color ?? AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  const normalized = useMemo(
    () => handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20),
    [handle]
  );
  const valid = /^[a-z0-9_]{3,20}$/.test(normalized);

  const next = async () => {
    if (!firebaseUser || !valid || saving) return;
    setSaving(true);
    try {
      // Persist color only — initials are derived from username at render time.
      await updateUser(firebaseUser.uid, { color });
      await claimUsername(firebaseUser.uid, normalized);
      await setOnboardingStep(firebaseUser.uid, "welcome-bonus");
      router.replace("/(onboarding)/welcome-bonus");
    } catch (e) {
      const code = (e as Error)?.message;
      if (code === "USERNAME_TAKEN") {
        Alert.alert(
          "Username taken",
          "Try another — letters, numbers, and underscore only."
        );
      } else if (code === "USERNAME_INVALID") {
        Alert.alert(
          "Invalid username",
          "3-20 characters: lowercase letters, numbers, or underscore."
        );
      } else {
        Alert.alert("Couldn't save", "Please wait a moment and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = initialsOf(normalized || "you");

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: orbit.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={3} />
        <Text style={styles.title}>Pick your handle</Text>
        <Text style={styles.sub}>
          Your username is how people find you on Orbit.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Preview card */}
        <View style={styles.preview}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.previewHandle}>
            @{normalized || "your_handle"}
          </Text>
          <Text style={styles.previewMeta}>50 credits · 0 karma · Just joined</Text>
        </View>

        {/* Username input */}
        <Text style={styles.section}>USERNAME</Text>
        <View
          style={[
            styles.inputRow,
            { borderColor: focused ? orbit.accent : orbit.borderStrong },
            focused && { backgroundColor: orbit.surface2 },
          ]}
        >
          <Text style={styles.at}>@</Text>
          <TextInput
            value={handle}
            onChangeText={setHandle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your_handle"
            placeholderTextColor={orbit.textTertiary}
            style={styles.input}
            maxLength={20}
          />
        </View>
        <Text style={styles.hint}>
          3-20 characters · lowercase · letters, numbers, _
        </Text>

        {/* Color picker (avatar tint) */}
        <Text style={[styles.section, { marginTop: 24 }]}>AVATAR COLOR</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((c) => {
            const active = c === color;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                activeOpacity={0.85}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: c,
                    borderColor: active ? orbit.textPrimary : "transparent",
                    transform: [{ scale: active ? 1.05 : 1 }],
                  },
                ]}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[
            styles.cta,
            {
              backgroundColor: valid ? orbit.accent : orbit.surface2,
              opacity: saving ? 0.7 : 1,
            },
          ]}
          disabled={!valid || saving}
          activeOpacity={0.9}
          onPress={next}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.ctaText, { color: valid ? "#FFFFFF" : orbit.textTertiary }]}>
              Continue
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 8 },
  title: {
    color: orbit.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  sub: {
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 20,
  },
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },

  /* Preview */
  preview: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  previewHandle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  previewMeta: {
    color: orbit.textTertiary,
    fontSize: 12,
  },

  /* Section labels */
  section: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  /* Input */
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  at: {
    color: orbit.textTertiary,
    fontSize: 16,
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },
  hint: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },

  /* Color picker */
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cta: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

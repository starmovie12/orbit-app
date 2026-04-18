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
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
} from "@/constants/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  claimUsername,
  setOnboardingStep,
  updateUser,
} from "@/lib/firestore-users";

export default function UsernameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [handle, setHandle] = useState(user?.username ?? "");
  const [emoji, setEmoji] = useState(user?.emoji ?? AVATAR_EMOJIS[0]);
  const [color, setColor] = useState(user?.color ?? AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const normalized = useMemo(
    () => handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20),
    [handle]
  );
  const valid = /^[a-z0-9_]{3,20}$/.test(normalized);

  const next = async () => {
    if (!firebaseUser || !valid || saving) return;
    setSaving(true);
    try {
      await updateUser(firebaseUser.uid, { emoji, color });
      await claimUsername(firebaseUser.uid, normalized);
      await setOnboardingStep(firebaseUser.uid, "welcome-bonus");
      router.replace("/(onboarding)/welcome-bonus");
    } catch (e) {
      const code = (e as Error)?.message;
      if (code === "USERNAME_TAKEN") {
        Alert.alert(
          "Username already taken",
          "Koi aur try karo — letters, numbers, aur _ use kar sakte ho."
        );
      } else if (code === "USERNAME_INVALID") {
        Alert.alert(
          "Username invalid",
          "3-20 characters, lowercase letters / numbers / underscore only."
        );
      } else {
        Alert.alert("Save nahi hua", "Thoda wait karke try karo.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={3} />
        <Text style={[styles.title, { color: colors.text }]}>Apna ORBIT Card</Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          Yeh username public hai aur permanent. Avatar baad mein change kar sakte ho.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Preview card */}
        <View
          style={[
            styles.preview,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: color + "30", borderColor: color }]}>
            <Text style={styles.avatarEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.previewHandle, { color: colors.text }]}>
            @{normalized || "your_handle"}
          </Text>
          <Text style={[styles.previewMeta, { color: colors.sub }]}>
            🪙 50 · 🏆 0 · Just joined
          </Text>
        </View>

        {/* Input */}
        <Text style={[styles.section, { color: colors.sub }]}>USERNAME</Text>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.at, { color: colors.sub }]}>@</Text>
          <TextInput
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your_handle"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.text }]}
            maxLength={20}
          />
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          3-20 chars · lowercase · letters, numbers, _
        </Text>

        {/* Emoji picker */}
        <Text style={[styles.section, { color: colors.sub, marginTop: 20 }]}>AVATAR</Text>
        <View style={styles.chipWrap}>
          {AVATAR_EMOJIS.map((e) => {
            const active = e === emoji;
            return (
              <TouchableOpacity
                key={e}
                onPress={() => setEmoji(e)}
                style={[
                  styles.emojiChip,
                  {
                    backgroundColor: active ? colors.primary + "25" : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Color picker */}
        <Text style={[styles.section, { color: colors.sub, marginTop: 20 }]}>COLOR</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((c) => {
            const active = c === color;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: c,
                    borderColor: active ? "#fff" : "transparent",
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
              backgroundColor: valid ? colors.primary : colors.surface2,
              opacity: saving ? 0.6 : 1,
            },
          ]}
          disabled={!valid || saving}
          activeOpacity={0.85}
          onPress={next}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Claim @{normalized || "handle"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 24, gap: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", marginTop: 16 },
  sub: { fontSize: 13, lineHeight: 19 },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  preview: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    marginTop: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 38 },
  previewHandle: { fontSize: 20, fontWeight: "800" },
  previewMeta: { fontSize: 12, marginTop: 6 },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  at: { fontSize: 18, fontWeight: "700", marginRight: 4 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  hint: { fontSize: 11, marginTop: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiChip: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 22 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  footer: { paddingHorizontal: 24, paddingTop: 10 },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

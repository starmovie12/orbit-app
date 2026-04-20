import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingStepper } from "@/components/OnboardingStepper";
import { LANGUAGES } from "@/constants/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { setOnboardingStep, updateUser } from "@/lib/firestore-users";
import { orbit } from "@/constants/colors";

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [picked, setPicked] = useState<string>(user?.language ?? "hi");
  const [saving, setSaving] = useState(false);

  const next = async () => {
    if (!firebaseUser || saving) return;
    setSaving(true);
    try {
      await updateUser(firebaseUser.uid, { language: picked });
      await setOnboardingStep(firebaseUser.uid, "interests");
      router.replace("/(onboarding)/interests");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: orbit.bg }]}>
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={1} />
        <Text style={styles.title}>Choose your language</Text>
        <Text style={styles.sub}>
          You'll see Rooms and DMs in this language by default — you can always change later.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((lang) => {
          const active = picked === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              activeOpacity={0.85}
              onPress={() => setPicked(lang.code)}
              style={[
                styles.card,
                {
                  backgroundColor: active ? "rgba(91, 127, 255, 0.10)" : orbit.surface1,
                  borderColor: active ? orbit.accent : orbit.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.langLabel,
                  { color: active ? orbit.accent : orbit.textPrimary },
                ]}
              >
                {lang.label}
              </Text>
              <Text style={styles.langSub}>{lang.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[styles.cta, { opacity: saving ? 0.7 : 1 }]}
          disabled={saving}
          activeOpacity={0.9}
          onPress={next}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, gap: 12, paddingBottom: 16 },
  title: {
    color: orbit.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    letterSpacing: -0.4,
  },
  sub: {
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  langLabel: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  langSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 3,
  },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  cta: {
    backgroundColor: orbit.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

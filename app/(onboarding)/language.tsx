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
import { useColors } from "@/hooks/useColors";
import { setOnboardingStep, updateUser } from "@/lib/firestore-users";

export default function LanguageScreen() {
  const colors = useColors();
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={1} />
        <Text style={[styles.title, { color: colors.text }]}>
          Tumhari pehli language?
        </Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          App sab languages support karta hai — yeh default hai jo rooms aur DMs mein dikhega.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((lang) => {
          const active = picked === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              activeOpacity={0.8}
              onPress={() => setPicked(lang.code)}
              style={[
                styles.card,
                {
                  backgroundColor: active ? colors.primary + "20" : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.langEmoji}>{lang.emoji}</Text>
              <Text style={[styles.langLabel, { color: colors.text }]}>{lang.label}</Text>
              <Text style={[styles.langSub, { color: colors.sub }]}>{lang.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          disabled={saving}
          activeOpacity={0.85}
          onPress={next}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 24, gap: 12, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", marginTop: 16 },
  sub: { fontSize: 13, lineHeight: 19 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  langEmoji: { fontSize: 28, marginBottom: 6 },
  langLabel: { fontSize: 18, fontWeight: "700" },
  langSub: { fontSize: 11, marginTop: 2 },
  footer: { paddingHorizontal: 24, paddingTop: 10 },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

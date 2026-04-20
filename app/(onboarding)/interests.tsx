import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { orbit } from "@/constants/colors";

import { OnboardingStepper } from "@/components/OnboardingStepper";
import { INTERESTS, MIN_INTERESTS } from "@/constants/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { setOnboardingStep, updateUser } from "@/lib/firestore-users";

export default function InterestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [picked, setPicked] = useState<string[]>(user?.interests ?? []);
  const [saving, setSaving] = useState(false);

  const canContinue = picked.length >= MIN_INTERESTS;

  const toggle = (id: string) => {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  };

  const next = async () => {
    if (!firebaseUser || !canContinue || saving) return;
    setSaving(true);
    try {
      await updateUser(firebaseUser.uid, { interests: picked });
      await setOnboardingStep(firebaseUser.uid, "username");
      router.replace("/(onboarding)/username");
    } finally {
      setSaving(false);
    }
  };

  const remaining = useMemo(
    () => Math.max(0, MIN_INTERESTS - picked.length),
    [picked.length]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={2} />
        <Text style={[styles.title, { color: colors.text }]}>
          Kya interest karta hai?
        </Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          {MIN_INTERESTS} ya zyada choose karo — issi se rooms aur Discover feed curate hoga.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {INTERESTS.map((it) => {
          const active = picked.includes(it.id);
          return (
            <TouchableOpacity
              key={it.id}
              activeOpacity={0.85}
              onPress={() => toggle(it.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? "rgba(91, 127, 255, 0.10)" : orbit.surface1,
                  borderColor: active ? orbit.accent : orbit.borderSubtle,
                },
              ]}
            >
              <Feather
                name={it.icon}
                size={18}
                color={active ? orbit.accent : orbit.textSecond}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? orbit.accent : orbit.textPrimary },
                ]}
              >
                {it.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={[styles.counter, { color: colors.sub }]}>
          {picked.length} selected
          {remaining > 0 ? ` · ${remaining} aur choose karo` : " ✓"}
        </Text>
        <TouchableOpacity
          style={[
            styles.cta,
            {
              backgroundColor: canContinue ? colors.primary : colors.surface2,
              opacity: saving ? 0.6 : 1,
            },
          ]}
          disabled={!canContinue || saving}
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
  title: { fontSize: 24, fontWeight: "700", marginTop: 16, letterSpacing: -0.4 },
  sub: { fontSize: 14, lineHeight: 19 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipLabel: { fontSize: 14, fontWeight: "600" },
  footer: { paddingHorizontal: 24, paddingTop: 10, gap: 8 },
  counter: { fontSize: 12, textAlign: "center" },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

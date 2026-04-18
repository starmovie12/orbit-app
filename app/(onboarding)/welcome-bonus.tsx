import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingStepper } from "@/components/OnboardingStepper";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { setOnboardingStep } from "@/lib/firestore-users";

export default function WelcomeBonusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [going, setGoing] = useState(false);

  const finish = async () => {
    if (!firebaseUser || going) return;
    setGoing(true);
    try {
      await setOnboardingStep(firebaseUser.uid, "done");
      // RouteGuard will push us to (tabs) as soon as the user doc flips.
      router.replace("/(tabs)");
    } finally {
      setGoing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#34B46122", "#2481CC22", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={4} />
      </View>

      <View style={styles.body}>
        <View style={[styles.coinRing, { borderColor: colors.green + "55" }]}>
          <Text style={styles.coinEmoji}>🪙</Text>
        </View>
        <Text style={[styles.amount, { color: colors.green }]}>+50</Text>
        <Text style={[styles.title, { color: colors.text }]}>Welcome Karma Loan</Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          Bhai, pehla <Text style={{ color: colors.text, fontWeight: "700" }}>50 Credits</Text>{" "}
          hum tumhe udhaar de rahe hain — ab tum rooms join kar sakte ho, DM bhej sakte ho,
          aur posts unlock kar sakte ho.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Repayment kaise?</Text>
          {[
            { e: "👁️", t: "15s promo dekho", d: "+1 Credit (max 20/day)" },
            { e: "❤️", t: "Helpful reply karo", d: "+Karma → auto adjust" },
            { e: "🎯", t: "Challenges jeeto", d: "Bonus Credits" },
          ].map((row) => (
            <View key={row.t} style={styles.row}>
              <Text style={styles.rowEmoji}>{row.e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{row.t}</Text>
                <Text style={[styles.rowDesc, { color: colors.sub }]}>{row.d}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.small, { color: colors.mutedForeground }]}>
          Loan auto-pay hota hai tumhari activity se. Koi deadline nahi, koi interest nahi.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.primary, opacity: going ? 0.6 : 1 }]}
          activeOpacity={0.85}
          disabled={going}
          onPress={finish}
        >
          {going ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              Let&apos;s go, {user?.displayName ? `@${user.displayName}` : "friend"} →
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 24, paddingBottom: 10 },
  body: { flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  coinRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  coinEmoji: { fontSize: 56 },
  amount: { fontSize: 56, fontWeight: "800", letterSpacing: -1 },
  title: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  sub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10, letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  rowEmoji: { fontSize: 20 },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowDesc: { fontSize: 12, marginTop: 2 },
  small: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 10 },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

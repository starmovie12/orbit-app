import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function Welcome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#2481CC22", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.top, { paddingTop: insets.top + 40 }]}>
        <View style={[styles.logoRing, { borderColor: colors.primary + "55" }]}>
          <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.brand, { color: colors.text }]}>ORBIT</Text>
        <Text style={[styles.tagline, { color: colors.sub }]}>
          Your digital neighborhood. Rooms, rep, rewards.
        </Text>
      </View>

      <View style={styles.middle}>
        {[
          { emoji: "💬", title: "Mood Rooms", desc: "Vent, celebrate, connect — har mood ke liye ek room." },
          { emoji: "🏆", title: "Karma & Ranks", desc: "Help karo, points kamao, top leaderboard pe chadho." },
          { emoji: "💼", title: "Skill Bazaar", desc: "Talent bech ke, real Credits earn karo." },
        ].map((f) => (
          <View key={f.title} style={[styles.feat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.featEmoji}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featTitle, { color: colors.text }]}>{f.title}</Text>
              <Text style={[styles.featDesc, { color: colors.sub }]}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => router.push("/(auth)/phone")}
        >
          <Text style={styles.ctaText}>📱  Continue with Phone</Text>
        </TouchableOpacity>
        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          Continue karke tum hamari <Text style={{ color: colors.primary }}>Terms</Text> aur{" "}
          <Text style={{ color: colors.primary }}>Privacy Policy</Text> accept karte ho.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  top: { alignItems: "center", paddingBottom: 30 },
  logoRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  logoDot: { width: 28, height: 28, borderRadius: 14 },
  brand: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 2,
    fontFamily: "Inter_700Bold",
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  middle: { flex: 1, justifyContent: "center", gap: 12 },
  feat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  featEmoji: { fontSize: 26 },
  featTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featDesc: { fontSize: 12, lineHeight: 17 },
  bottom: { paddingTop: 20, gap: 14 },
  cta: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  legal: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});

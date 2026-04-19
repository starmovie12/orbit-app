import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const FEATURES = [
  {
    emoji: "💬",
    title: "Mood Rooms",
    desc: "Vent, celebrate, connect — a room for every mood.",
  },
  {
    emoji: "🏆",
    title: "Karma & Ranks",
    desc: "Help others, earn points, climb the leaderboard.",
  },
  {
    emoji: "💼",
    title: "Skill Bazaar",
    desc: "Sell your talent, earn real Credits.",
  },
];

export default function Welcome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#2481CC33", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.top, { paddingTop: insets.top + 56 }]}>
        <View style={[styles.logoOuter, { borderColor: colors.primary + "33" }]}>
          <View style={[styles.logoRing, { borderColor: colors.primary }]}>
            <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
          </View>
        </View>
        <Text style={[styles.brand, { color: colors.text }]}>ORBIT</Text>
        <Text style={[styles.tagline, { color: colors.sub }]}>
          Your digital neighborhood.{"\n"}Rooms, reputation, rewards.
        </Text>
      </View>

      <View style={styles.middle}>
        {FEATURES.map((f) => (
          <View
            key={f.title}
            style={[
              styles.feat,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.featIcon,
                { backgroundColor: colors.background },
              ]}
            >
              <Text style={styles.featEmoji}>{f.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featTitle, { color: colors.text }]}>
                {f.title}
              </Text>
              <Text style={[styles.featDesc, { color: colors.sub }]}>
                {f.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => router.push("/(auth)/phone")}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={styles.ctaText}>Continue with Phone</Text>
        </Pressable>
        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          By continuing, you agree to our{" "}
          <Text style={{ color: colors.primary }}>Terms</Text> and{" "}
          <Text style={{ color: colors.primary }}>Privacy Policy</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  top: { alignItems: "center", paddingBottom: 24 },
  logoOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoDot: { width: 28, height: 28, borderRadius: 14 },
  brand: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 4,
    fontFamily: "Inter_700Bold",
  },
  tagline: {
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 21,
  },
  middle: { flex: 1, justifyContent: "center", gap: 12 },
  feat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  featEmoji: { fontSize: 22 },
  featTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featDesc: { fontSize: 12.5, lineHeight: 17 },
  bottom: { paddingTop: 20, gap: 14 },
  cta: {
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  legal: { fontSize: 11.5, textAlign: "center", lineHeight: 16 },
});

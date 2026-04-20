import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";
import colors from "@/constants/colors";

const FEATURES: { icon: any; title: string; desc: string }[] = [
  {
    icon: "message-square",
    title: "Mood Rooms",
    desc: "Vent, celebrate, connect — a room for every mood.",
  },
  {
    icon: "award",
    title: "Karma & Ranks",
    desc: "Help others, earn points, climb the leaderboard.",
  },
  {
    icon: "briefcase",
    title: "Skill Bazaar",
    desc: "Sell your talent, earn real Credits.",
  },
];

/**
 * OrbitMark — minimal geometric brand mark (a circle with a small offset orbit dot).
 * accent passed as prop so it's never read at module-init time.
 */
function OrbitMark({ size = 56, accent }: { size?: number; accent: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <G>
        <Circle cx="28" cy="28" r="20" stroke={accent} strokeWidth={1.5} opacity={0.35} />
        <Circle cx="28" cy="28" r="8" fill={accent} />
        <Circle cx="46" cy="22" r="3" fill={accent} />
      </G>
    </Svg>
  );
}

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Orbit tokens accessed at render-time, not module-init ──────
  const orbit = useMemo(() => colors.orbit, []);

  // ── Styles created lazily after orbit tokens are available ─────
  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, paddingHorizontal: 20 },
    top: { alignItems: "center", paddingBottom: 32 },
    brand: {
      color: orbit.textPrimary,
      fontSize: 32,
      fontWeight: "700",
      letterSpacing: -0.8,
      marginTop: 20,
    },
    tagline: {
      color: orbit.textSecond,
      marginTop: 8,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
    middle: { flex: 1, justifyContent: "center", gap: 12 },
    feat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: 16,
      backgroundColor: orbit.surface1,
      borderWidth: 1,
      borderColor: orbit.borderSubtle,
    },
    featIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: orbit.surface2,
      alignItems: "center",
      justifyContent: "center",
    },
    featTitle: {
      color: orbit.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 4,
    },
    featDesc: {
      color: orbit.textSecond,
      fontSize: 13,
      lineHeight: 18,
    },
    bottom: { paddingTop: 20, gap: 14 },
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
    legal: {
      color: orbit.textTertiary,
      fontSize: 11,
      textAlign: "center",
      lineHeight: 17,
    },
    legalLink: {
      color: orbit.textSecond,
      fontWeight: "500",
    },
  }), [orbit]);

  return (
    <View style={[styles.root, { backgroundColor: orbit.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 64 }]}>
        <OrbitMark size={56} accent={orbit.accent} />
        <Text style={styles.brand}>Orbit</Text>
        <Text style={styles.tagline}>
          Your digital neighborhood.
        </Text>
      </View>

      <View style={styles.middle}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.feat}>
            <View style={styles.featIcon}>
              <Feather name={f.icon} size={20} color={orbit.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featTitle}>{f.title}</Text>
              <Text style={styles.featDesc}>{f.desc}</Text>
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
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={styles.ctaText}>Continue with Phone</Text>
        </Pressable>
        <Text style={styles.legal}>
          By continuing, you agree to our{" "}
          <Text style={styles.legalLink}>Terms</Text>
          {"  ·  "}
          <Text style={styles.legalLink}>Privacy</Text>
          {"\n"}Protected by reCAPTCHA.
        </Text>
      </View>
    </View>
  );
}

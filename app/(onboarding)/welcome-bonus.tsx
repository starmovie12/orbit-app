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
import { Feather } from "@expo/vector-icons";

import { OnboardingStepper } from "@/components/OnboardingStepper";
import { useAuth } from "@/contexts/AuthContext";
import { setOnboardingStep } from "@/lib/firestore-users";
import { orbit } from "@/constants/colors";

const REPAY_ROWS: { icon: any; title: string; desc: string }[] = [
  { icon: "play-circle",   title: "Watch a 15s promo",   desc: "+1 Credit (max 20/day)" },
  { icon: "message-circle",title: "Helpful reply",        desc: "+Karma → auto-adjust"   },
  { icon: "target",        title: "Win challenges",       desc: "Bonus Credits"          },
];

export default function WelcomeBonusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const [going, setGoing] = useState(false);

  const finish = async () => {
    if (!firebaseUser || going) return;
    setGoing(true);
    try {
      await setOnboardingStep(firebaseUser.uid, "done");
      router.replace("/(tabs)");
    } finally {
      setGoing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: orbit.bg }]}>
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <OnboardingStepper step={4} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Feather name="gift" size={28} color={orbit.accent} />
        </View>

        <Text style={styles.amount}>+50</Text>
        <Text style={styles.amountLbl}>CREDITS</Text>
        <Text style={styles.title}>Welcome bonus</Text>
        <Text style={styles.sub}>
          Your starting{" "}
          <Text style={styles.subStrong}>50 Credits</Text>
          {" "}— join rooms, send DMs, and unlock posts right away.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>EARN MORE</Text>
          {REPAY_ROWS.map((row, i) => (
            <React.Fragment key={row.title}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Feather name={row.icon} size={16} color={orbit.textSecond} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowDesc}>{row.desc}</Text>
                </View>
              </View>
              {i < REPAY_ROWS.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.small}>
          No deadline. No interest. Activity covers it automatically.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[styles.cta, { opacity: going ? 0.7 : 1 }]}
          activeOpacity={0.9}
          disabled={going}
          onPress={finish}
        >
          {going ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              Let's go{user?.displayName ? `, @${user.displayName}` : ""}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 10 },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(91, 127, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  amount: {
    color: orbit.accent,
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1.5,
    marginBottom: 2,
  },
  amountLbl: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  title: {
    color: orbit.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  sub: {
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 28,
    paddingHorizontal: 4,
    maxWidth: 320,
  },
  subStrong: {
    color: orbit.textPrimary,
    fontWeight: "600",
  },

  card: {
    width: "100%",
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  rowDesc: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
    marginLeft: 44,
  },

  small: {
    color: orbit.textTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
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

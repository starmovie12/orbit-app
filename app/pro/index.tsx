/**
 * ORBIT — Pro Subscription Screen (app/pro/index.tsx)
 *
 * Features:
 *   • Display ₹199/mo plan (ad-free, 2x credit earn, priority support)
 *   • Razorpay Subscription payment flow (react-native-razorpay)
 *   • Creates Razorpay subscription → opens native checkout → activates Pro on success
 *   • Firestore: sets user.proStatus, user.proSince, writes proTxn
 *   • Current subscription status shown if user is already Pro
 *
 * Razorpay setup required:
 *   npm install react-native-razorpay
 *   Create a subscription plan on Razorpay dashboard → get PLAN_ID
 *   Provide RAZORPAY_KEY_ID via env / remote config
 *   Backend (Cloud Function) needed for subscription creation — see createSubscription()
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { firestore, serverTimestamp } from "@/lib/firebase";

/* ─────────────────────────────────────────────────────────────────────
   Razorpay type declaration
   Install: npm install react-native-razorpay @types/react-native-razorpay
───────────────────────────────────────────────────────────────────── */

declare module "react-native-razorpay" {
  interface RazorpaySubscriptionOptions {
    description: string;
    image?: string;
    currency: string;
    key: string;
    amount?: number;
    name: string;
    subscription_id: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: { color?: string };
    retry?: { enabled: boolean };
    send_sms_hash?: boolean;
    remember_customer?: boolean;
  }

  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }

  interface RazorpayErrorResponse {
    code: number;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { subscription_id?: string; payment_id?: string };
  }

  export default class RazorpayCheckout {
    static open(options: RazorpaySubscriptionOptions): Promise<RazorpaySuccessResponse>;
  }
}

// Stub — remove once package is installed
const RazorpayCheckout = {
  open: async (_opts: any): Promise<any> => {
    throw Object.assign(
      new Error("Razorpay not installed. Run: npm install react-native-razorpay"),
      { code: -1, description: "Package not installed" }
    );
  },
};

// Cross-platform Firestore .exists helper
function snapExists(s: any): boolean {
  return typeof s.exists === "function" ? s.exists() : !!s.exists;
}

/* ─────────────────────────────────────────────────────────────────────
   Config — replace with real keys / Cloud Function URL
───────────────────────────────────────────────────────────────────── */

const RAZORPAY_KEY_ID        = "rzp_test_YOUR_KEY_HERE";
const SUBSCRIPTION_API_URL   =
  "https://us-central1-YOUR_PROJECT.cloudfunctions.net/createRazorpaySubscription";
const PRO_PLAN_ID            = "plan_YOUR_PLAN_ID"; // from Razorpay dashboard

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type ProFeature = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  desc: string;
  accent: string;
};

type ProStatus = {
  isPro: boolean;
  subscriptionId?: string;
  proSince?: number;
  proUntil?: number;
};

/* ─────────────────────────────────────────────────────────────────────
   Feature definitions
───────────────────────────────────────────────────────────────────── */

const PRO_FEATURES: ProFeature[] = [
  {
    icon: "slash",
    title: "Ad-Free Experience",
    desc: "No banner ads, no rewarded video interruptions. Pure ORBIT.",
    accent: orbit.accent,
  },
  {
    icon: "zap",
    title: "2× Credit Earn Rate",
    desc: "Double credits on every watch, challenge win, and referral.",
    accent: orbit.warning,
  },
  {
    icon: "headphones",
    title: "Priority Support",
    desc: "Jump the queue. Issues resolved within 4 hours, not 48.",
    accent: orbit.success,
  },
  {
    icon: "check-circle",
    title: "Verified Badge",
    desc: "Stand out with a blue checkmark across rooms, DMs, and Bazaar.",
    accent: orbit.accent,
  },
  {
    icon: "gift",
    title: "500 Credits / Month",
    desc: "Credited on the 1st of every month, auto-renewing with your plan.",
    accent: orbit.warning,
  },
  {
    icon: "eye-off",
    title: "Hide Last Seen",
    desc: "Control your presence. Browse incognito from the activity feed.",
    accent: orbit.textTertiary,
  },
];

const COMPARE_ROWS = [
  { label: "Ads in feed",        free: "Yes",      pro: "Never"    },
  { label: "Credit earn rate",   free: "1×",       pro: "2×"       },
  { label: "Monthly credits",    free: "Earn only", pro: "+500/mo" },
  { label: "Support SLA",        free: "48 hrs",   pro: "4 hrs"    },
  { label: "Verified badge",     free: "—",        pro: "✓"        },
  { label: "Hide last seen",     free: "—",        pro: "✓"        },
];

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

async function fetchProStatus(uid: string): Promise<ProStatus> {
  const snap = await firestore().collection("users").doc(uid).get();
  if (!snapExists(snap)) return { isPro: false };
  const data = snap.data() as any;
  return {
    isPro: !!data?.isPro,
    subscriptionId: data?.proSubscriptionId ?? undefined,
    proSince: data?.proSince ?? undefined,
    proUntil: data?.proUntil ?? undefined,
  };
}

async function activatePro(args: {
  uid: string;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
}): Promise<void> {
  const db = firestore();
  const userRef = db.collection("users").doc(args.uid);
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snapExists(snap)) throw new Error("User not found.");
    const userData = snap.data() as any;

    tx.update(userRef, {
      isPro: true,
      proSubscriptionId: args.razorpaySubscriptionId,
      proSince: now,
      proUntil: now + thirtyDaysMs,
      credits: (userData.credits ?? 0) + 500, // welcome Pro credits
      updatedAt: serverTimestamp(),
    });
  });

  // Write pro transaction record
  await db
    .collection("users")
    .doc(args.uid)
    .collection("proTxns")
    .doc()
    .set({
      type: "subscribe",
      planId: PRO_PLAN_ID,
      priceInr: 199,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySubscriptionId: args.razorpaySubscriptionId,
      creditsGranted: 500,
      createdAtMs: now,
      createdAt: serverTimestamp(),
    });
}

/* ─────────────────────────────────────────────────────────────────────
   Backend: create Razorpay subscription
───────────────────────────────────────────────────────────────────── */

async function createRazorpaySubscription(uid: string): Promise<string> {
  const res = await fetch(SUBSCRIPTION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, planId: PRO_PLAN_ID, totalCount: 12 }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `Subscription creation failed (${res.status})`);
  }
  const data = await res.json();
  if (!data?.subscriptionId) throw new Error("Invalid subscription response.");
  return data.subscriptionId as string;
}

/* ─────────────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────────────── */

export default function ProScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user, firebaseUser } = useAuth();

  const [proStatus, setProStatus] = useState<ProStatus>({ isPro: false });
  const [statusLoading, setStatusLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  /* Fetch live pro status */
  useEffect(() => {
    if (!firebaseUser) return;
    fetchProStatus(firebaseUser.uid)
      .then(setProStatus)
      .catch(() => {})
      .finally(() => {
        setStatusLoading(false);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 340, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 340, useNativeDriver: true }),
        ]).start();
      });
  }, [firebaseUser]);

  const handleSubscribe = useCallback(async () => {
    if (!firebaseUser) return;
    if (proStatus.isPro) {
      Alert.alert("Already Pro", "Your ORBIT Pro subscription is active.");
      return;
    }

    setPurchasing(true);
    try {
      const subscriptionId = await createRazorpaySubscription(firebaseUser.uid);

      const paymentData = await RazorpayCheckout.open({
        description: "ORBIT Pro — Monthly Subscription",
        currency: "INR",
        key: RAZORPAY_KEY_ID,
        name: "ORBIT",
        subscription_id: subscriptionId,
        prefill: {
          contact: user?.phone ?? "",
          name: user?.displayName ?? user?.username ?? "",
        },
        theme: { color: orbit.accent },
        retry: { enabled: false },
        send_sms_hash: true,
        remember_customer: true,
      });

      await activatePro({
        uid: firebaseUser.uid,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySubscriptionId: paymentData.razorpay_subscription_id,
      });

      setProStatus({
        isPro: true,
        subscriptionId: paymentData.razorpay_subscription_id,
        proSince: Date.now(),
        proUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      Alert.alert(
        "Welcome to ORBIT Pro",
        "Your subscription is active. 500 credits added to your wallet.",
        [{ text: "Let's go", onPress: () => router.back() }]
      );
    } catch (err: any) {
      if (err?.code === 0 || err?.description?.toLowerCase().includes("cancel")) {
        // User dismissed — no alert
      } else {
        Alert.alert(
          "Payment Failed",
          err?.description ?? err?.message ?? "Kuch issue hua. Dobara try karo.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setPurchasing(false);
    }
  }, [firebaseUser, user, proStatus.isPro]);

  /* ── Loading state ── */
  if (statusLoading) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <ScreenHeader title="ORBIT Pro" onBack={() => router.back()} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={orbit.accent} />
        </View>
      </View>
    );
  }

  const proUntilStr = proStatus.proUntil
    ? new Date(proStatus.proUntil).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="ORBIT Pro" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Hero Banner ── */}
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Feather name="star" size={13} color={orbit.warning} />
              <Text style={styles.heroBadgeTxt}>PRO MEMBERSHIP</Text>
            </View>
            <Text style={styles.heroPrice}>
              ₹199
              <Text style={styles.heroPriceSub}>/month</Text>
            </Text>
            <Text style={styles.heroSub}>
              Cancel anytime. Billed monthly via Razorpay.
            </Text>
            {proStatus.isPro && proUntilStr && (
              <View style={styles.activeChip}>
                <Feather name="check-circle" size={13} color={orbit.success} />
                <Text style={styles.activeChipTxt}>Active · Renews {proUntilStr}</Text>
              </View>
            )}
          </View>

          {/* ── Feature List ── */}
          <Text style={styles.sectionLabel}>WHAT YOU GET</Text>
          <View style={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: `${f.accent}18` }]}>
                  <Feather name={f.icon} size={17} color={f.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Free vs Pro Comparison ── */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>FREE VS PRO</Text>
          <View style={styles.compareCard}>
            {/* Header */}
            <View style={styles.compareHeader}>
              <View style={{ flex: 1 }} />
              <Text style={[styles.compareHeadTxt, { flex: 1, textAlign: "center" }]}>Free</Text>
              <View style={[styles.compareProHead, { flex: 1 }]}>
                <Feather name="star" size={11} color={orbit.warning} />
                <Text style={styles.compareProHeadTxt}>Pro</Text>
              </View>
            </View>
            {COMPARE_ROWS.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.compareRow,
                  i === COMPARE_ROWS.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={[styles.compareLabel, { flex: 1 }]}>{row.label}</Text>
                <Text style={[styles.compareVal, { flex: 1, textAlign: "center", color: orbit.textTertiary }]}>
                  {row.free}
                </Text>
                <Text style={[styles.compareVal, { flex: 1, textAlign: "center", color: orbit.success }]}>
                  {row.pro}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Trust Row ── */}
          <View style={styles.trustRow}>
            {([
              { icon: "shield" as const, label: "Secured by Razorpay" },
              { icon: "refresh-cw" as const, label: "Cancel anytime" },
              { icon: "lock" as const, label: "PCI-DSS compliant" },
            ] as const).map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <Feather name={t.icon} size={12} color={orbit.textTertiary} />
                <Text style={styles.trustLabel}>{t.label}</Text>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View
        style={[
          styles.ctaContainer,
          { paddingBottom: insets.bottom + 12 },
        ]}
      >
        <TouchableOpacity
          style={[styles.ctaBtn, (purchasing || proStatus.isPro) && styles.ctaBtnDisabled]}
          onPress={handleSubscribe}
          disabled={purchasing || proStatus.isPro}
          activeOpacity={0.82}
        >
          {purchasing ? (
            <ActivityIndicator color={orbit.white} size="small" />
          ) : proStatus.isPro ? (
            <View style={styles.ctaBtnInner}>
              <Feather name="check-circle" size={18} color={orbit.white} />
              <Text style={styles.ctaBtnTxt}>Pro Active</Text>
            </View>
          ) : (
            <View style={styles.ctaBtnInner}>
              <Feather name="star" size={18} color={orbit.white} />
              <Text style={styles.ctaBtnTxt}>Subscribe for ₹199/mo</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.ctaHint}>
          Recurring subscription. Cancel anytime from Settings.
        </Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: orbit.bg,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: orbit.bg,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  /* Hero */
  hero: {
    backgroundColor: orbit.accentSoftSolid,
    borderWidth: 1,
    borderColor: orbit.accent + "30",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    marginBottom: 28,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: orbit.warningSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  heroBadgeTxt: {
    color: orbit.warning,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroPrice: {
    color: orbit.textPrimary,
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 52,
  },
  heroPriceSub: {
    fontSize: 18,
    fontWeight: "400",
    color: orbit.textSecond,
    letterSpacing: 0,
  },
  heroSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 17,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: orbit.successSoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 14,
  },
  activeChipTxt: {
    color: orbit.success,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Section label */
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },

  /* Features */
  featureList: {
    gap: 4,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: "hidden",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  featureText: { flex: 1 },
  featureTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  featureDesc: {
    color: orbit.textTertiary,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Compare */
  compareCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: "hidden",
  },
  compareHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
    backgroundColor: orbit.surface2,
  },
  compareHeadTxt: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  compareProHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  compareProHeadTxt: {
    color: orbit.warning,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
  },
  compareLabel: {
    color: orbit.textSecond,
    fontSize: 13,
  },
  compareVal: {
    fontSize: 13,
    fontWeight: "500",
  },

  /* Trust */
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 20,
    flexWrap: "wrap",
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trustLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
  },

  /* CTA */
  ctaContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: orbit.bg,
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 8,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  ctaBtn: {
    backgroundColor: orbit.accent,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnDisabled: {
    backgroundColor: orbit.surface3,
  },
  ctaBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaBtnTxt: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  ctaHint: {
    color: orbit.textTertiary,
    fontSize: 11,
    textAlign: "center",
  },
});

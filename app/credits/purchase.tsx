/**
 * ORBIT — Buy Credits Screen (app/credits/purchase.tsx)
 *
 * Features:
 *   • Three credit packs: ₹99/1000cr · ₹299/3500cr · ₹999/15000cr
 *   • Razorpay native checkout (react-native-razorpay)
 *   • Creates Razorpay order → opens native checkout → credits on success
 *   • Firestore: credits incremented + purchase txn written atomically
 *   • UPI / Cards / NetBanking all supported via Razorpay checkout
 *
 * Razorpay setup required:
 *   npm install react-native-razorpay
 *   Provide RAZORPAY_KEY_ID via env / remote config
 *   Backend (Cloud Function) needed for order creation — see createOrder()
 */

import React, {
  useCallback,
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
   (or add "react-native-razorpay": "^3.x" to package.json)
───────────────────────────────────────────────────────────────────── */

// Inline type declaration so the file compiles without the package installed.
// Remove this block once the package is added to package.json.
declare module "react-native-razorpay" {
  interface RazorpayOptions {
    description: string;
    image?: string;
    currency: string;
    key: string;
    amount: number;         // in paise
    name: string;
    order_id: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: {
      color?: string;
    };
    retry?: { enabled: boolean };
    send_sms_hash?: boolean;
    remember_customer?: boolean;
  }

  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  interface RazorpayErrorResponse {
    code: number;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  }

  export default class RazorpayCheckout {
    static open(
      options: RazorpayOptions
    ): Promise<RazorpaySuccessResponse>;
  }
}

// react-native-razorpay stub — remove this block once you run:
//   npm install react-native-razorpay
// and rebuild the dev client.
const RazorpayCheckout = {
  open: async (_opts: any): Promise<any> => {
    throw Object.assign(
      new Error("Razorpay not installed. Run: npm install react-native-razorpay"),
      { code: -1, description: "Package not installed" }
    );
  },
};

// Cross-platform Firestore .exists helper (web compat vs native SDK)
function snapExists(s: any): boolean { return typeof s.exists === 'function' ? s.exists() : !!s.exists; }

/* ─────────────────────────────────────────────────────────────────────
   Config — replace with your real key / Cloud Function URL
───────────────────────────────────────────────────────────────────── */

const RAZORPAY_KEY_ID = "rzp_test_YOUR_KEY_HERE";   // ← swap for live key
const ORDER_API_URL  =
  "https://us-central1-YOUR_PROJECT.cloudfunctions.net/createRazorpayOrder";

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type Pack = {
  id: string;
  credits: number;
  priceInr: number;
  label: string;
  tag?: string;
  tagColor?: string;
  savingPct?: number;
};

/* ─────────────────────────────────────────────────────────────────────
   Credit packs (blueprint §08 — credit pack sales)
   ₹99 = 1,000 credits | ₹299 = 3,500 credits | ₹999 = 15,000 credits
───────────────────────────────────────────────────────────────────── */

const PACKS: Pack[] = [
  {
    id: "pack_99",
    credits: 1_000,
    priceInr: 99,
    label: "Starter",
  },
  {
    id: "pack_299",
    credits: 3_500,
    priceInr: 299,
    label: "Popular",
    tag: "BEST VALUE",
    tagColor: orbit.accent,
    savingPct: 18,
  },
  {
    id: "pack_999",
    credits: 15_000,
    priceInr: 999,
    label: "Pro",
    tag: "MAX CREDITS",
    tagColor: orbit.warning,
    savingPct: 52,
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

/**
 * Called AFTER Razorpay confirms payment.
 * Atomically: credit user + write purchase txn.
 * Note: in production, also verify signature on the backend before crediting.
 */
async function recordPurchase(args: {
  uid: string;
  credits: number;
  priceInr: number;
  packId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
}): Promise<void> {
  const db = firestore();
  const userRef = db.collection("users").doc(args.uid);
  const txnRef  = userRef.collection("creditTxns").doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snapExists(snap)) throw new Error("User not found.");
    const userData = snap.data() as { credits: number };

    tx.update(userRef, {
      credits: (userData.credits ?? 0) + args.credits,
      updatedAt: serverTimestamp(),
    });

    tx.set(txnRef, {
      type: "purchase",
      amount: args.credits,
      description: `Purchased ${args.credits.toLocaleString()} credits for ₹${args.priceInr}`,
      icon: "shopping-bag",
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
      meta: {
        packId: args.packId,
        priceInr: args.priceInr,
        razorpayPaymentId: args.razorpayPaymentId,
        razorpayOrderId: args.razorpayOrderId,
      },
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Backend: create Razorpay order
   Replace ORDER_API_URL with your real Cloud Function / backend endpoint.
   The function should create an order via Razorpay server SDK and return
   { orderId: "order_xxx" }.
───────────────────────────────────────────────────────────────────── */

async function createRazorpayOrder(
  amountInr: number,
  uid: string
): Promise<string> {
  const res = await fetch(ORDER_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountInr, uid }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `Order creation failed (${res.status})`);
  }
  const data = await res.json();
  if (!data?.orderId) throw new Error("Invalid order response.");
  return data.orderId as string;
}

/* ─────────────────────────────────────────────────────────────────────
   PackCard component
───────────────────────────────────────────────────────────────────── */

type PackCardProps = {
  pack: Pack;
  selected: boolean;
  onSelect: () => void;
};

function PackCard({ pack, selected, onSelect }: PackCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 4,
      }),
    ]).start();
    onSelect();
  };

  const creditsPerRupee = (pack.credits / pack.priceInr).toFixed(1);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.packCard,
          selected && styles.packCardSelected,
        ]}
        activeOpacity={0.85}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${pack.label} pack — ${pack.credits.toLocaleString()} credits for ₹${pack.priceInr}`}
        accessibilityState={{ selected }}
      >
        {/* Tag badge */}
        {pack.tag && (
          <View
            style={[
              styles.packTag,
              { backgroundColor: `${pack.tagColor}22`, borderColor: `${pack.tagColor}55` },
            ]}
          >
            <Text style={[styles.packTagTxt, { color: pack.tagColor }]}>
              {pack.tag}
            </Text>
          </View>
        )}

        <View style={styles.packRow}>
          {/* Left: icon + credits */}
          <View style={styles.packLeft}>
            <View
              style={[
                styles.packIconWrap,
                selected
                  ? { backgroundColor: orbit.accentSoft }
                  : { backgroundColor: orbit.surface2 },
              ]}
            >
              <Feather
                name="zap"
                size={22}
                color={selected ? orbit.accent : orbit.textSecond}
              />
            </View>
            <View style={styles.packInfo}>
              <Text style={styles.packLabel}>{pack.label}</Text>
              <Text style={styles.packCredits}>
                {pack.credits.toLocaleString()}
                <Text style={styles.packCreditsTxt}> credits</Text>
              </Text>
              <Text style={styles.packRate}>
                {creditsPerRupee} cr/₹1
              </Text>
            </View>
          </View>

          {/* Right: price + saving */}
          <View style={styles.packRight}>
            <Text style={styles.packPrice}>₹{pack.priceInr}</Text>
            {pack.savingPct && (
              <View style={styles.savingBadge}>
                <Text style={styles.savingTxt}>
                  Save {pack.savingPct}%
                </Text>
              </View>
            )}
          </View>

          {/* Selection indicator */}
          <View
            style={[
              styles.radioOuter,
              selected && { borderColor: orbit.accent },
            ]}
          >
            {selected && <View style={styles.radioInner} />}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function PurchaseCreditsScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { user, firebaseUser } = useAuth();

  const [selectedId, setSelectedId] = useState<string>(PACKS[1].id);
  const [loading, setLoading]       = useState(false);

  const selectedPack = PACKS.find((p) => p.id === selectedId) ?? PACKS[1];
  const uid    = firebaseUser?.uid ?? "";
  const phone  = firebaseUser?.phoneNumber ?? "";
  const name   = user?.displayName ?? user?.username ?? "Orbit User";

  /* ── Payment flow ─────────────────────────────────────────────── */

  const handleBuy = useCallback(async () => {
    if (!uid || loading) return;

    setLoading(true);
    try {
      // 1. Create server-side Razorpay order
      const orderId = await createRazorpayOrder(selectedPack.priceInr, uid);

      // 2. Open Razorpay native checkout
      const paymentData = await RazorpayCheckout.open({
        description: `${selectedPack.credits.toLocaleString()} Orbit Credits`,
        currency: "INR",
        key: RAZORPAY_KEY_ID,
        amount: selectedPack.priceInr * 100,  // Razorpay expects paise
        name: "ORBIT",
        order_id: orderId,
        prefill: {
          contact: phone.replace("+91", ""),
          name,
        },
        theme: { color: orbit.accent },
        retry: { enabled: true },
        send_sms_hash: true,
        remember_customer: false,
      });

      // 3. Record purchase in Firestore (atomically credit user)
      await recordPurchase({
        uid,
        credits: selectedPack.credits,
        priceInr: selectedPack.priceInr,
        packId: selectedPack.id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpayOrderId: paymentData.razorpay_order_id,
      });

      // 4. Success
      Alert.alert(
        "Payment Successful",
        `${selectedPack.credits.toLocaleString()} credits added to your wallet!`,
        [{ text: "Great!", onPress: () => router.back() }]
      );
    } catch (e: any) {
      // Razorpay dismissal (user pressed back) has code 0
      if (e?.code === 0 || e?.description === "Payment cancelled.") {
        return; // silent — user backed out
      }
      Alert.alert(
        "Payment Failed",
        e?.description ?? e?.message ?? "Try again or use a different method."
      );
    } finally {
      setLoading(false);
    }
  }, [uid, phone, name, selectedPack, loading, router]);

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Buy Credits"
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ─────────────────────────────────────────────── */}
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Feather name="zap" size={18} color={orbit.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>
              Your balance:{" "}
              <Text style={{ color: orbit.accent }}>
                {(user?.credits ?? 0).toLocaleString()} cr
              </Text>
            </Text>
            <Text style={styles.introSub}>
              Credits kharcho: DMs, rooms, spotlights, gifts.
            </Text>
          </View>
        </View>

        {/* ── Pack selection ────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>CHOOSE A PACK</Text>

        <View style={styles.packList}>
          {PACKS.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              selected={selectedId === pack.id}
              onSelect={() => setSelectedId(pack.id)}
            />
          ))}
        </View>

        {/* ── What you get ──────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>YOUR PACK</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Pack</Text>
            <Text style={styles.summaryVal}>{selectedPack.label}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: orbit.borderSubtle }]}>
            <Text style={styles.summaryKey}>Credits</Text>
            <View style={styles.summaryCreditsRow}>
              <Feather name="zap" size={13} color={orbit.accent} />
              <Text style={[styles.summaryVal, { color: orbit.accent }]}>
                {selectedPack.credits.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: orbit.borderSubtle }]}>
            <Text style={styles.summaryKey}>Price</Text>
            <Text style={styles.summaryVal}>₹{selectedPack.priceInr}</Text>
          </View>
          {selectedPack.savingPct && (
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: orbit.borderSubtle }]}>
              <Text style={styles.summaryKey}>You save</Text>
              <Text style={[styles.summaryVal, { color: orbit.success }]}>
                {selectedPack.savingPct}% vs Starter
              </Text>
            </View>
          )}
        </View>

        {/* ── How credits are used ──────────────────────────────── */}
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>HOW CREDITS WORK</Text>
          {[
            { icon: "send",          label: "Send DM",            cost: "2 cr"  },
            { icon: "radio",         label: "Join premium room",   cost: "10 cr/day" },
            { icon: "award",         label: "Spotlight bid (min)", cost: "20 cr" },
            { icon: "gift",          label: "Send gift sticker",   cost: "5 cr"  },
            { icon: "skip-forward",  label: "Skip ads (1 week)",   cost: "200 cr" },
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.usageRow}>
                <View style={styles.usageIconBox}>
                  <Feather
                    name={row.icon as any}
                    size={13}
                    color={orbit.textSecond}
                  />
                </View>
                <Text style={styles.usageLabel}>{row.label}</Text>
                <Text style={styles.usageCost}>{row.cost}</Text>
              </View>
              {i < arr.length - 1 && (
                <View style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── Trust row ─────────────────────────────────────────── */}
        <View style={styles.trustRow}>
          {[
            { icon: "shield", label: "Secure" },
            { icon: "credit-card", label: "UPI / Card" },
            { icon: "lock", label: "Encrypted" },
          ].map((item) => (
            <View key={item.label} style={styles.trustItem}>
              <Feather
                name={item.icon as any}
                size={14}
                color={orbit.textTertiary}
              />
              <Text style={styles.trustLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Sticky CTA ────────────────────────────────────────────── */}
      <View
        style={[
          styles.ctaContainer,
          { paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.ctaInner}>
          <View style={styles.ctaMeta}>
            <Text style={styles.ctaMetaCredits}>
              <Feather name="zap" size={13} color={orbit.accent} />
              {"  "}
              {selectedPack.credits.toLocaleString()} credits
            </Text>
            <Text style={styles.ctaMetaPrice}>₹{selectedPack.priceInr}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.ctaBtn,
              loading && { opacity: 0.7 },
            ]}
            activeOpacity={0.88}
            disabled={loading}
            onPress={handleBuy}
            accessibilityRole="button"
            accessibilityLabel={`Pay ₹${selectedPack.priceInr} via Razorpay`}
          >
            {loading ? (
              <ActivityIndicator color={orbit.white} />
            ) : (
              <View style={styles.ctaBtnInner}>
                <Feather name="credit-card" size={16} color={orbit.white} />
                <Text style={styles.ctaBtnTxt}>
                  Pay ₹{selectedPack.priceInr} via Razorpay
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.ctaHint}>
            UPI · Cards · NetBanking · Wallets — powered by Razorpay
          </Text>
        </View>
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  /* Intro */
  introRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
    padding: 14,
    marginBottom: 22,
  },
  introIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: orbit.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 3,
  },
  introSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Section label */
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  /* Pack list */
  packList: {
    gap: 10,
    marginBottom: 22,
  },
  packCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1.5,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    padding: 14,
  },
  packCardSelected: {
    borderColor: orbit.accent,
    backgroundColor: orbit.accentSoftSolid,
  },
  packTag: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 10,
  },
  packTagTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  packRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  packLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  packIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  packInfo: { flex: 1 },
  packLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  packCredits: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  packCreditsTxt: {
    fontSize: 13,
    fontWeight: "400",
    color: orbit.textSecond,
  },
  packRate: {
    color: orbit.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  packRight: {
    alignItems: "flex-end",
    marginRight: 10,
  },
  packPrice: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  savingBadge: {
    backgroundColor: orbit.successSoft,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 4,
  },
  savingTxt: {
    color: orbit.success,
    fontSize: 10,
    fontWeight: "600",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: orbit.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: orbit.accent,
  },

  /* Summary card */
  summaryCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  summaryTitle: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.7,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  summaryKey: {
    color: orbit.textSecond,
    fontSize: 13,
  },
  summaryVal: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryCreditsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  /* Usage card */
  usageCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  usageTitle: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  usageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  usageIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  usageLabel: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 13,
  },
  usageCost: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
    marginLeft: 38,
  },

  /* Trust row */
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 4,
    marginBottom: 8,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trustLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
  },

  /* Sticky CTA */
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
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  ctaInner: { gap: 8 },
  ctaMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaMetaCredits: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: "500",
  },
  ctaMetaPrice: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  ctaBtn: {
    backgroundColor: orbit.accent,
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
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
    letterSpacing: 0.1,
  },
});

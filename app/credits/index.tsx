/**
 * ORBIT — Credits Wallet Screen (app/credits/index.tsx)
 *
 * Features:
 *   • Live balance from Firestore (real-time subscription via useAuth)
 *   • Transaction history from /users/{uid}/creditTxns subcollection
 *   • Ways to earn: Watch Ad (+5), Win Challenge (+50), Refer Friend (+20)
 *   • Cashout flow: 500 credits = ₹50 UPI (via Razorpay Payout)
 *   • Buy Credits CTA → navigates to /credits/purchase
 *
 * Cashout rules (blueprint §RBI):
 *   Min ₹50 (500 credits) | Max ₹5,000/day | Karma < 50 → 7-day hold
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
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
   Types
───────────────────────────────────────────────────────────────────── */

type TxType = "earn" | "spend" | "purchase" | "cashout" | "referral";

type CreditTx = {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  icon: string;
  createdAtMs: number;
  createdAt: unknown;
};

type EarnCard = {
  icon: string;
  label: string;
  desc: string;
  reward: string;
  accent: string;
};

/* ─────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────── */

const CREDITS_PER_RUPEE = 10;         // 500 credits = ₹50
const MIN_CASHOUT_CREDITS = 500;
const MAX_CASHOUT_DAILY_INR = 5000;

const EARN_CARDS: EarnCard[] = [
  {
    icon: "play-circle",
    label: "Watch an Ad",
    desc: "Watch a 30s sponsored post",
    reward: "+5 credits",
    accent: orbit.accent,
  },
  {
    icon: "target",
    label: "Win a Challenge",
    desc: "Submit your best this week",
    reward: "+50 credits",
    accent: orbit.success,
  },
  {
    icon: "user-plus",
    label: "Refer a Friend",
    desc: "Share your referral code",
    reward: "+20 credits",
    accent: orbit.warning,
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

function subscribeTxns(
  uid: string,
  cb: (txns: CreditTx[]) => void
): () => void {
  return firestore()
    .collection("users")
    .doc(uid)
    .collection("creditTxns")
    .orderBy("createdAtMs", "desc")
    .limit(40)
    .onSnapshot(
      (qs) => {
        const list: CreditTx[] = [];
        qs.forEach((doc) =>
          list.push({ id: doc.id, ...(doc.data() as Omit<CreditTx, "id">) })
        );
        cb(list);
      },
      () => cb([])
    );
}

async function submitCashoutRequest(
  uid: string,
  credits: number,
  upiId: string
): Promise<void> {
  const amountInr = Math.floor(credits / CREDITS_PER_RUPEE);
  const db = firestore();
  const userRef = db.collection("users").doc(uid);
  const txnRef = userRef.collection("creditTxns").doc();
  const cashoutRef = db.collection("cashoutRequests").doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("User not found.");
    const userData = snap.data() as { credits: number; karma: number };
    if ((userData.credits ?? 0) < credits)
      throw new Error("Insufficient credits.");

    const nowMs = Date.now();
    tx.update(userRef, {
      credits: (userData.credits ?? 0) - credits,
      updatedAt: serverTimestamp(),
    });
    tx.set(txnRef, {
      type: "cashout" as TxType,
      amount: -credits,
      description: `Cashout ₹${amountInr} → ${upiId}`,
      icon: "arrow-up-circle",
      createdAtMs: nowMs,
      createdAt: serverTimestamp(),
    });
    tx.set(cashoutRef, {
      uid,
      credits,
      amountInr,
      upiId,
      status: (userData.karma ?? 0) < 50 ? "hold_7d" : "pending",
      requestedAt: serverTimestamp(),
      requestedAtMs: nowMs,
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / 3_600_000;
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function txColor(type: TxType): string {
  if (type === "earn" || type === "purchase" || type === "referral")
    return orbit.success;
  if (type === "cashout") return orbit.warning;
  return orbit.danger;
}

function txSign(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`;
}

/* ─────────────────────────────────────────────────────────────────────
   Cashout Bottom Sheet
───────────────────────────────────────────────────────────────────── */

type CashoutSheetProps = {
  visible: boolean;
  onClose: () => void;
  credits: number;
  karma: number;
  uid: string;
};

function CashoutSheet({
  visible,
  onClose,
  credits,
  karma,
  uid,
}: CashoutSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const maxCredits = Math.min(
    credits,
    MAX_CASHOUT_DAILY_INR * CREDITS_PER_RUPEE
  );
  const [creditsToRedeem, setCreditsToRedeem] = useState(
    MIN_CASHOUT_CREDITS.toString()
  );

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 400,
      duration: visible ? 260 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const parsedCredits = parseInt(creditsToRedeem, 10) || 0;
  const inrAmount = Math.floor(parsedCredits / CREDITS_PER_RUPEE);
  const canSubmit =
    parsedCredits >= MIN_CASHOUT_CREDITS &&
    parsedCredits <= maxCredits &&
    upiId.trim().length > 4;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await submitCashoutRequest(uid, parsedCredits, upiId.trim());
      onClose();
      Alert.alert(
        karma < 50
          ? "Cashout Queued (7-Day Hold)"
          : "Cashout Requested",
        karma < 50
          ? `₹${inrAmount} request received. Due to low karma, it's held for 7 days.`
          : `₹${inrAmount} will be sent to ${upiId.trim()} within 24 hours.`
      );
      setUpiId("");
      setCreditsToRedeem(MIN_CASHOUT_CREDITS.toString());
    } catch (e: any) {
      Alert.alert("Cashout Failed", e?.message ?? "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.handle} />

            <Text style={styles.sheetTitle}>Cash Out</Text>
            <Text style={styles.sheetSub}>
              {CREDITS_PER_RUPEE} credits = ₹1 • Min {MIN_CASHOUT_CREDITS} credits (₹
              {MIN_CASHOUT_CREDITS / CREDITS_PER_RUPEE})
            </Text>

            <View style={styles.sheetBalance}>
              <Feather name="zap" size={16} color={orbit.accent} />
              <Text style={styles.sheetBalanceTxt}>
                {credits.toLocaleString()} credits available
              </Text>
            </View>

            <Text style={styles.inputLabel}>Credits to redeem</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputField}
                value={creditsToRedeem}
                onChangeText={setCreditsToRedeem}
                keyboardType="number-pad"
                placeholderTextColor={orbit.textTertiary}
                placeholder="500"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.maxBtn}
                onPress={() => setCreditsToRedeem(maxCredits.toString())}
              >
                <Text style={styles.maxBtnTxt}>MAX</Text>
              </TouchableOpacity>
            </View>

            {parsedCredits > 0 && (
              <Text style={styles.inrPreview}>
                You receive:{" "}
                <Text style={styles.inrAmount}>₹{inrAmount}</Text>
              </Text>
            )}

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>
              UPI ID
            </Text>
            <TextInput
              style={[styles.inputField, { marginBottom: 0 }]}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              placeholderTextColor={orbit.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {karma < 50 && (
              <View style={styles.holdNotice}>
                <Feather name="info" size={13} color={orbit.warning} />
                <Text style={styles.holdNoticeTxt}>
                  Low karma — payout held 7 days for verification.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.sheetCta,
                { opacity: canSubmit && !loading ? 1 : 0.45 },
              ]}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator color={orbit.white} />
              ) : (
                <Text style={styles.sheetCtaTxt}>
                  Request ₹{inrAmount || 0} via UPI
                </Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function CreditsWalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, firebaseUser } = useAuth();

  const [txns, setTxns] = useState<CreditTx[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [cashoutVisible, setCashoutVisible] = useState(false);

  const credits = user?.credits ?? 0;
  const karma = user?.karma ?? 0;
  const uid = firebaseUser?.uid ?? "";

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeTxns(uid, (list) => {
      setTxns(list);
      setTxLoading(false);
    });
    return unsub;
  }, [uid]);

  const handleEarnPress = useCallback((card: EarnCard) => {
    if (card.label === "Win a Challenge") {
      router.push("/(tabs)/ranks" as never);
    } else if (card.label === "Refer a Friend") {
      Alert.alert(
        "Referral",
        `Share your handle @${user?.username ?? "you"} with friends. They join → you both earn 20 credits.`
      );
    } else {
      Alert.alert(
        "Watch Ad",
        "Sponsored post dekhne ke baad +5 credits milenge. Discover tab mein jao."
      );
    }
  }, [router, user]);

  const handleCashout = useCallback(() => {
    if (credits < MIN_CASHOUT_CREDITS) {
      Alert.alert(
        "Not Enough Credits",
        `Minimum ${MIN_CASHOUT_CREDITS} credits needed to cash out. You have ${credits}.`
      );
      return;
    }
    setCashoutVisible(true);
  }, [credits]);

  /* ── Render helpers ───────────────────────────────────────────── */

  const renderTx = useCallback(
    ({ item }: { item: CreditTx }) => (
      <View style={styles.txRow}>
        <View
          style={[
            styles.txIcon,
            {
              backgroundColor:
                item.amount >= 0 ? orbit.successSoft : orbit.dangerSoft,
            },
          ]}
        >
          <Feather
            name={item.icon as any}
            size={15}
            color={txColor(item.type)}
          />
        </View>
        <View style={styles.txMeta}>
          <Text style={styles.txDesc} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.txDate}>{fmtDate(item.createdAtMs)}</Text>
        </View>
        <Text
          style={[
            styles.txAmount,
            { color: txColor(item.type) },
          ]}
        >
          {txSign(item.amount)}
        </Text>
      </View>
    ),
    []
  );

  const renderEmpty = () => {
    if (txLoading) {
      return (
        <View style={styles.emptyBox}>
          <ActivityIndicator color={orbit.accent} />
        </View>
      );
    }
    return (
      <View style={styles.emptyBox}>
        <Feather name="inbox" size={28} color={orbit.textTertiary} />
        <Text style={styles.emptyTxt}>No transactions yet</Text>
        <Text style={styles.emptyHint}>
          Watch ads, win challenges, or buy credits to get started.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Credits"
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={() => router.push("/credits/purchase" as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Buy credits"
          >
            <Feather name="plus-circle" size={22} color={orbit.accent} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance Hero ──────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Feather name="zap" size={26} color={orbit.accent} />
          </View>
          <Text style={styles.heroBalance}>
            {credits.toLocaleString()}
          </Text>
          <Text style={styles.heroLabel}>CREDITS</Text>
          <Text style={styles.heroRate}>
            {CREDITS_PER_RUPEE} credits = ₹1 · Min cashout ₹
            {MIN_CASHOUT_CREDITS / CREDITS_PER_RUPEE}
          </Text>
        </View>

        {/* ── Action Buttons ────────────────────────────────────── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/credits/purchase" as never)}
            accessibilityRole="button"
            accessibilityLabel="Buy credits"
          >
            <Feather name="plus" size={18} color={orbit.white} />
            <Text style={styles.actionBtnTxt}>Buy Credits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtnOutline,
              credits < MIN_CASHOUT_CREDITS && { opacity: 0.45 },
            ]}
            activeOpacity={0.8}
            onPress={handleCashout}
            accessibilityRole="button"
            accessibilityLabel="Cash out"
          >
            <Feather name="arrow-up-circle" size={18} color={orbit.accent} />
            <Text style={styles.actionBtnOutlineTxt}>Cash Out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Earn More ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>EARN MORE</Text>
        <View style={styles.earnGrid}>
          {EARN_CARDS.map((card) => (
            <TouchableOpacity
              key={card.label}
              style={styles.earnCard}
              activeOpacity={0.75}
              onPress={() => handleEarnPress(card)}
              accessibilityRole="button"
              accessibilityLabel={card.label}
            >
              <View
                style={[
                  styles.earnIconWrap,
                  { backgroundColor: `${card.accent}18` },
                ]}
              >
                <Feather
                  name={card.icon as any}
                  size={20}
                  color={card.accent}
                />
              </View>
              <Text style={styles.earnLabel}>{card.label}</Text>
              <Text style={styles.earnDesc}>{card.desc}</Text>
              <View style={styles.earnRewardRow}>
                <Feather name="zap" size={11} color={orbit.accent} />
                <Text style={styles.earnReward}>{card.reward}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Earning Rate Reference ────────────────────────────── */}
        <View style={styles.rateCard}>
          <Text style={styles.rateCardTitle}>EARNING RATES</Text>
          {[
            { icon: "play-circle", label: "Watch ad (30s)",  val: "+5"  },
            { icon: "sun",         label: "Daily login",      val: "+2"  },
            { icon: "target",      label: "Challenge win",    val: "+50" },
            { icon: "user-plus",   label: "Refer friend",     val: "+20" },
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.rateRow}>
                <View style={styles.rateIconBox}>
                  <Feather
                    name={row.icon as any}
                    size={14}
                    color={orbit.textSecond}
                  />
                </View>
                <Text style={styles.rateLabel}>{row.label}</Text>
                <Text style={styles.rateVal}>{row.val}</Text>
              </View>
              {i < arr.length - 1 && (
                <View style={styles.rowDivider} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── Transaction History ───────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
          HISTORY
        </Text>

        {txLoading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator color={orbit.accent} />
          </View>
        ) : txns.length === 0 ? (
          renderEmpty()
        ) : (
          <View style={styles.txList}>
            {txns.map((item, i) => (
              <React.Fragment key={item.id}>
                {renderTx({ item })}
                {i < txns.length - 1 && (
                  <View style={[styles.rowDivider, { marginLeft: 52 }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Cashout Sheet ─────────────────────────────────────── */}
      <CashoutSheet
        visible={cashoutVisible}
        onClose={() => setCashoutVisible(false)}
        credits={credits}
        karma={karma}
        uid={uid}
      />
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
  content: { paddingHorizontal: 16 },

  /* Hero */
  hero: {
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 4,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: orbit.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroBalance: {
    color: orbit.textPrimary,
    fontSize: 52,
    fontWeight: "700",
    letterSpacing: -2,
    lineHeight: 56,
  },
  heroLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: 4,
  },
  heroRate: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },

  /* Action buttons */
  actions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: orbit.accent,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionBtnTxt: {
    color: orbit.white,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: orbit.accentSoft,
    borderWidth: 1,
    borderColor: orbit.accent,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionBtnOutlineTxt: {
    color: orbit.accent,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  /* Section label */
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  /* Earn cards */
  earnGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  earnCard: {
    flex: 1,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  earnIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  earnLabel: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  earnDesc: {
    color: orbit.textTertiary,
    fontSize: 11,
    lineHeight: 15,
  },
  earnRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  earnReward: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Rate card */
  rateCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  rateCardTitle: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  rateIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  rateLabel: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 13,
  },
  rateVal: {
    color: orbit.success,
    fontSize: 13,
    fontWeight: "600",
  },
  rowDivider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
  },

  /* Transaction list */
  txList: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    overflow: "hidden",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  txMeta: { flex: 1 },
  txDesc: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  txDate: {
    color: orbit.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  /* Empty */
  emptyBox: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyTxt: {
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyHint: {
    color: orbit.textTertiary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },

  /* Cashout sheet */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: orbit.surface1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetTitle: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  sheetSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  sheetBalance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  sheetBalanceTxt: {
    color: orbit.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  inputLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  inputField: {
    flex: 1,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  maxBtn: {
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  maxBtnTxt: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inrPreview: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginBottom: 4,
  },
  inrAmount: {
    color: orbit.success,
    fontWeight: "700",
  },
  holdNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: orbit.warningSoft,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  holdNoticeTxt: {
    flex: 1,
    color: orbit.warning,
    fontSize: 12,
    lineHeight: 17,
  },
  sheetCta: {
    backgroundColor: orbit.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  sheetCtaTxt: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

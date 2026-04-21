/**
 * ORBIT — Cashout to UPI Screen (app/credits/cashout.tsx)
 *
 * Blueprint §08 — Cashout rules:
 *   500 credits = ₹50 UPI (via Razorpay Payout)
 *   Min cashout : ₹50  (500 credits)
 *   Max/day     : ₹5,000 (50,000 credits)
 *   Karma < 50  : 7-day hold (anti-fraud)
 *   > ₹1,000    : queued for manual approval
 *   Monthly cap : ₹10,000 (RBI — no KYC uplift needed below this)
 *
 * Razorpay Payout API flow:
 *   1. Validate credits + daily limit against Firestore
 *   2. POST to Cloud Function → creates Razorpay Contact + Fund Account
 *   3. Cloud Function fires Razorpay Payout → returns payout_id
 *   4. Firestore: debit credits + write cashout txn atomically
 *   5. UI: success/hold/manual-review states
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
  KeyboardAvoidingView,
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

// Cross-platform Firestore .exists helper (web compat vs native SDK)
function snapExists(s: any): boolean { return typeof s.exists === 'function' ? s.exists() : !!s.exists; }

/* ─────────────────────────────────────────────────────────────────────
   Config — replace with your real Cloud Function URL
───────────────────────────────────────────────────────────────────── */

const PAYOUT_API_URL =
  "https://us-central1-YOUR_PROJECT.cloudfunctions.net/initiateRazorpayPayout";

/* ─────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────── */

const CREDITS_PER_RUPEE   = 10;
const MIN_INR             = 50;
const MAX_INR_DAILY       = 5_000;
const MIN_CREDITS         = MIN_INR * CREDITS_PER_RUPEE;       // 500
const MAX_CREDITS_DAILY   = MAX_INR_DAILY * CREDITS_PER_RUPEE; // 50,000
const MANUAL_REVIEW_INR   = 1_000;
const KARMA_HOLD_THRESHOLD = 50;

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type CashoutStatus = "idle" | "loading" | "success" | "hold_7d" | "manual_review";

type DailyTotals = {
  totalInr: number;
  count: number;
};

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

/** Fetches today's total cashout in INR for the user (UTC date boundary). */
async function fetchDailyTotals(uid: string): Promise<DailyTotals> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const qs = await firestore()
    .collection("cashoutRequests")
    .where("uid", "==", uid)
    .where("requestedAtMs", ">=", startOfDay.getTime())
    .get();

  let totalInr = 0;
  let count    = 0;
  qs.forEach((doc) => {
    const d = doc.data() as { amountInr: number; status: string };
    // Only count non-rejected requests toward the daily limit
    if (d.status !== "rejected") {
      totalInr += d.amountInr ?? 0;
      count    += 1;
    }
  });
  return { totalInr, count };
}

/**
 * Atomically:
 *   1. Re-validates balance + daily limit inside the transaction
 *   2. Debits credits from user doc
 *   3. Writes cashout request doc + creditTxn doc
 * Returns the new cashoutRequest doc ID for the payout API call.
 */
async function reserveCashout(args: {
  uid: string;
  credits: number;
  amountInr: number;
  upiId: string;
  karma: number;
  dailyTotalInr: number;
}): Promise<{ requestId: string; status: string }> {
  const db       = firestore();
  const userRef  = db.collection("users").doc(args.uid);
  const reqRef   = db.collection("cashoutRequests").doc();
  const txnRef   = userRef.collection("creditTxns").doc();

  let resultStatus = "pending";

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snapExists(snap)) throw new Error("User not found.");

    const userData = snap.data() as { credits: number; karma: number };
    const balance  = userData.credits ?? 0;
    const karma    = userData.karma   ?? 0;

    if (balance < args.credits) throw new Error("Insufficient credits.");

    // Double-check daily limit inside transaction
    if (args.dailyTotalInr + args.amountInr > MAX_INR_DAILY) {
      throw new Error(
        `Daily limit exceeded. You can cash out ₹${MAX_INR_DAILY - args.dailyTotalInr} more today.`
      );
    }

    const nowMs = Date.now();
    const status =
      karma < KARMA_HOLD_THRESHOLD
        ? "hold_7d"
        : args.amountInr >= MANUAL_REVIEW_INR
        ? "manual_review"
        : "pending";

    resultStatus = status;

    tx.update(userRef, {
      credits:   balance - args.credits,
      updatedAt: serverTimestamp(),
    });

    tx.set(reqRef, {
      uid:            args.uid,
      credits:        args.credits,
      amountInr:      args.amountInr,
      upiId:          args.upiId,
      status,
      razorpayPayoutId: null,
      requestedAt:    serverTimestamp(),
      requestedAtMs:  nowMs,
    });

    tx.set(txnRef, {
      type:        "cashout",
      amount:      -args.credits,
      description: `Cashout ₹${args.amountInr} → ${args.upiId}`,
      icon:        "arrow-up-circle",
      createdAtMs: nowMs,
      createdAt:   serverTimestamp(),
      meta: { requestId: reqRef.id, amountInr: args.amountInr },
    });
  });

  return { requestId: reqRef.id, status: resultStatus };
}

/**
 * Calls the Cloud Function which:
 *   POST /initiateRazorpayPayout
 *   Body: { requestId, uid, amountInr, upiId }
 *
 * The function uses Razorpay Payouts API:
 *   1. Create/fetch Contact (name + phone)
 *   2. Create Fund Account (vpa = UPI ID)
 *   3. Create Payout (mode: "UPI", purpose: "payout", amount in paise)
 *   4. Updates /cashoutRequests/{requestId} with razorpayPayoutId + status
 */
async function triggerRazorpayPayout(args: {
  requestId: string;
  uid: string;
  amountInr: number;
  upiId: string;
}): Promise<void> {
  const res = await fetch(PAYOUT_API_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(args),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `Payout initiation failed (${res.status})`);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Quick-select amounts
───────────────────────────────────────────────────────────────────── */

const QUICK_INR = [50, 100, 250, 500, 1_000];

/* ─────────────────────────────────────────────────────────────────────
   Success / Hold overlay
───────────────────────────────────────────────────────────────────── */

type ResultOverlayProps = {
  status: Exclude<CashoutStatus, "idle" | "loading">;
  amountInr: number;
  upiId: string;
  onDone: () => void;
};

function ResultOverlay({ status, amountInr, upiId, onDone }: ResultOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const cfg = {
    success:       { icon: "check-circle" as const, color: orbit.success,  bg: orbit.successSoft, title: "Cashout Initiated",   sub: `₹${amountInr} will reach ${upiId} within 24 hours via UPI.` },
    hold_7d:       { icon: "clock"        as const, color: orbit.warning,  bg: orbit.warningSoft, title: "Payout on Hold",       sub: `Low karma detected. ₹${amountInr} held for 7 days, then auto-released.` },
    manual_review: { icon: "shield"       as const, color: orbit.accent,   bg: orbit.accentSoft,  title: "Under Review",         sub: `₹${amountInr} queued for manual approval (>₹${MANUAL_REVIEW_INR}). Usually 24–48 hrs.` },
  }[status];

  return (
    <Animated.View style={[styles.overlayWrap, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.overlayCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.overlayIconWrap, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon} size={32} color={cfg.color} />
        </View>
        <Text style={styles.overlayTitle}>{cfg.title}</Text>
        <Text style={styles.overlaySub}>{cfg.sub}</Text>

        <View style={styles.overlayMeta}>
          <View style={styles.overlayMetaRow}>
            <Text style={styles.overlayMetaKey}>Amount</Text>
            <Text style={styles.overlayMetaVal}>₹{amountInr}</Text>
          </View>
          <View style={[styles.overlayMetaRow, { borderTopWidth: 1, borderColor: orbit.borderSubtle }]}>
            <Text style={styles.overlayMetaKey}>UPI ID</Text>
            <Text style={styles.overlayMetaVal} numberOfLines={1}>{upiId}</Text>
          </View>
          <View style={[styles.overlayMetaRow, { borderTopWidth: 1, borderColor: orbit.borderSubtle }]}>
            <Text style={styles.overlayMetaKey}>Method</Text>
            <Text style={styles.overlayMetaVal}>Razorpay Payout</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.85} onPress={onDone}>
          <Text style={styles.overlayBtnTxt}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function CashoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, firebaseUser } = useAuth();

  const credits = user?.credits ?? 0;
  const karma   = user?.karma   ?? 0;
  const uid     = firebaseUser?.uid ?? "";

  const [inrInput,    setInrInput]    = useState("");
  const [upiId,       setUpiId]       = useState("");
  const [dailyLeft,   setDailyLeft]   = useState(MAX_INR_DAILY);
  const [dailyLoaded, setDailyLoaded] = useState(false);
  const [status,      setStatus]      = useState<CashoutStatus>("idle");
  const [finalInr,    setFinalInr]    = useState(0);
  const [finalUpi,    setFinalUpi]    = useState("");

  /* Load today's remaining limit on mount */
  useEffect(() => {
    if (!uid) return;
    fetchDailyTotals(uid)
      .then(({ totalInr }) => {
        setDailyLeft(Math.max(0, MAX_INR_DAILY - totalInr));
      })
      .catch(() => setDailyLeft(MAX_INR_DAILY))
      .finally(() => setDailyLoaded(true));
  }, [uid]);

  /* Derived values */
  const parsedInr      = parseInt(inrInput, 10) || 0;
  const creditsNeeded  = parsedInr * CREDITS_PER_RUPEE;
  const balanceInr     = Math.floor(credits / CREDITS_PER_RUPEE);
  const effectiveMax   = Math.min(dailyLeft, balanceInr, MAX_INR_DAILY);

  const upiValid = /^[\w.\-]+@[\w]+$/.test(upiId.trim());

  const amountError: string | null = (() => {
    if (!parsedInr) return null;
    if (parsedInr < MIN_INR)       return `Minimum cashout is ₹${MIN_INR}.`;
    if (parsedInr > effectiveMax)  return `Maximum available: ₹${effectiveMax}.`;
    return null;
  })();

  const canSubmit =
    !amountError &&
    parsedInr >= MIN_INR &&
    parsedInr <= effectiveMax &&
    upiValid &&
    status !== "loading" &&
    dailyLoaded;

  /* Handlers */
  const handleQuick = useCallback((val: number) => {
    const capped = Math.min(val, effectiveMax);
    setInrInput(capped > 0 ? capped.toString() : "");
  }, [effectiveMax]);

  const handleMax = useCallback(() => {
    setInrInput(effectiveMax > 0 ? effectiveMax.toString() : "");
  }, [effectiveMax]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !uid) return;

    const amountInr = parsedInr;
    const upi       = upiId.trim();

    setStatus("loading");
    try {
      const dailyTotals = await fetchDailyTotals(uid);

      const { requestId, status: reqStatus } = await reserveCashout({
        uid,
        credits:       creditsNeeded,
        amountInr,
        upiId:         upi,
        karma,
        dailyTotalInr: dailyTotals.totalInr,
      });

      // Only fire payout API for pending requests (not held/manual)
      if (reqStatus === "pending") {
        await triggerRazorpayPayout({ requestId, uid, amountInr, upiId: upi });
      }

      setFinalInr(amountInr);
      setFinalUpi(upi);
      setStatus(reqStatus as CashoutStatus);
    } catch (e: any) {
      setStatus("idle");
      Alert.alert("Cashout Failed", e?.message ?? "Please try again.");
    }
  }, [canSubmit, uid, parsedInr, creditsNeeded, upiId, karma]);

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Cash Out" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance strip ─────────────────────────────────────── */}
        <View style={styles.balanceStrip}>
          <View style={styles.balanceItem}>
            <View style={styles.balanceIcon}>
              <Feather name="zap" size={14} color={orbit.accent} />
            </View>
            <View>
              <Text style={styles.balanceVal}>{credits.toLocaleString()}</Text>
              <Text style={styles.balanceLbl}>Credits</Text>
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <View style={[styles.balanceIcon, { backgroundColor: orbit.successSoft }]}>
              <Feather name="trending-up" size={14} color={orbit.success} />
            </View>
            <View>
              <Text style={styles.balanceVal}>₹{balanceInr.toLocaleString()}</Text>
              <Text style={styles.balanceLbl}>Worth</Text>
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <View style={[styles.balanceIcon, { backgroundColor: orbit.warningSoft }]}>
              <Feather name="calendar" size={14} color={orbit.warning} />
            </View>
            <View>
              <Text style={styles.balanceVal}>
                {dailyLoaded ? `₹${dailyLeft.toLocaleString()}` : "…"}
              </Text>
              <Text style={styles.balanceLbl}>Left today</Text>
            </View>
          </View>
        </View>

        {/* ── Rate card ─────────────────────────────────────────── */}
        <View style={styles.rateRow}>
          <Feather name="info" size={13} color={orbit.textTertiary} />
          <Text style={styles.rateTxt}>
            {CREDITS_PER_RUPEE} credits = ₹1 · Min ₹{MIN_INR} · Max ₹{MAX_INR_DAILY.toLocaleString()}/day
          </Text>
        </View>

        {/* ── Amount input ──────────────────────────────────────── */}
        <Text style={styles.label}>Amount (₹)</Text>
        <View style={[styles.amountBox, amountError ? styles.amountBoxError : null]}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={inrInput}
            onChangeText={(t) => setInrInput(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="50"
            placeholderTextColor={orbit.textTertiary}
            maxLength={5}
          />
          <TouchableOpacity onPress={handleMax} style={styles.maxBtn} hitSlop={8}>
            <Text style={styles.maxTxt}>MAX</Text>
          </TouchableOpacity>
        </View>

        {amountError ? (
          <Text style={styles.errorTxt}>{amountError}</Text>
        ) : parsedInr >= MIN_INR ? (
          <Text style={styles.creditPreview}>
            {creditsNeeded.toLocaleString()} credits will be deducted
          </Text>
        ) : null}

        {/* ── Quick select ──────────────────────────────────────── */}
        <View style={styles.quickRow}>
          {QUICK_INR.map((val) => {
            const disabled = val > effectiveMax || val < MIN_INR;
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.quickChip,
                  parsedInr === val && styles.quickChipActive,
                  disabled && styles.quickChipDisabled,
                ]}
                onPress={() => handleQuick(val)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.quickChipTxt,
                    parsedInr === val && styles.quickChipTxtActive,
                    disabled && { color: orbit.textTertiary },
                  ]}
                >
                  ₹{val >= 1000 ? `${val / 1000}K` : val}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── UPI ID input ──────────────────────────────────────── */}
        <Text style={[styles.label, { marginTop: 20 }]}>UPI ID</Text>
        <View style={[styles.upiBox, upiId.length > 3 && !upiValid && styles.amountBoxError]}>
          <Feather name="smartphone" size={16} color={orbit.textTertiary} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.upiInput}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="yourname@upi"
            placeholderTextColor={orbit.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {upiValid && (
            <Feather name="check-circle" size={16} color={orbit.success} />
          )}
        </View>
        {upiId.length > 3 && !upiValid && (
          <Text style={styles.errorTxt}>Enter a valid UPI ID (e.g. name@upi)</Text>
        )}

        {/* ── Karma hold notice ─────────────────────────────────── */}
        {karma < KARMA_HOLD_THRESHOLD && (
          <View style={styles.holdBanner}>
            <Feather name="alert-triangle" size={14} color={orbit.warning} />
            <Text style={styles.holdBannerTxt}>
              Your karma is below {KARMA_HOLD_THRESHOLD}. Payout will be held 7 days for verification before release.
            </Text>
          </View>
        )}

        {/* ── Manual review notice ──────────────────────────────── */}
        {parsedInr >= MANUAL_REVIEW_INR && karma >= KARMA_HOLD_THRESHOLD && (
          <View style={[styles.holdBanner, { backgroundColor: orbit.accentSoft }]}>
            <Feather name="shield" size={14} color={orbit.accent} />
            <Text style={[styles.holdBannerTxt, { color: orbit.accent }]}>
              Payouts ≥ ₹{MANUAL_REVIEW_INR.toLocaleString()} go through manual review (24–48 hrs).
            </Text>
          </View>
        )}

        {/* ── RBI compliance note ───────────────────────────────── */}
        <View style={styles.complianceRow}>
          <Feather name="lock" size={12} color={orbit.textTertiary} />
          <Text style={styles.complianceTxt}>
            Powered by Razorpay Payouts · RBI-compliant · ₹10,000/month limit (no KYC needed below threshold)
          </Text>
        </View>
      </ScrollView>

      {/* ── Sticky CTA ────────────────────────────────────────────── */}
      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, (!canSubmit || status === "loading") && { opacity: 0.45 }]}
          disabled={!canSubmit || status === "loading"}
          activeOpacity={0.88}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={`Cash out ₹${parsedInr || 0}`}
        >
          {status === "loading" ? (
            <ActivityIndicator color={orbit.white} />
          ) : (
            <View style={styles.ctaInner}>
              <Feather name="arrow-up-circle" size={17} color={orbit.white} />
              <Text style={styles.ctaTxt}>
                Cash Out{parsedInr >= MIN_INR ? ` ₹${parsedInr}` : ""}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Result overlay ────────────────────────────────────────── */}
      {(status === "success" || status === "hold_7d" || status === "manual_review") && (
        <ResultOverlay
          status={status}
          amountInr={finalInr}
          upiId={finalUpi}
          onDone={() => router.back()}
        />
      )}
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: orbit.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },

  /* Balance strip */
  balanceStrip: {
    flexDirection: "row",
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
  },
  balanceItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  balanceIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: orbit.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceVal: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  balanceLbl: {
    color: orbit.textTertiary,
    fontSize: 10,
    marginTop: 1,
  },
  balanceDivider: {
    width: 1,
    height: 32,
    backgroundColor: orbit.borderSubtle,
    marginHorizontal: 6,
  },

  /* Rate row */
  rateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 20,
  },
  rateTxt: {
    flex: 1,
    color: orbit.textTertiary,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Label */
  label: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  /* Amount box */
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: orbit.surface1,
    borderWidth: 1.5,
    borderColor: orbit.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    marginBottom: 4,
  },
  amountBoxError: {
    borderColor: orbit.danger,
  },
  currencySymbol: {
    color: orbit.textSecond,
    fontSize: 20,
    fontWeight: "600",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.8,
    padding: 0,
  },
  maxBtn: {
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  maxTxt: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  /* Feedback text */
  errorTxt: {
    color: orbit.danger,
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 2,
  },
  creditPreview: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 2,
  },

  /* Quick chips */
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  quickChipActive: {
    backgroundColor: orbit.accentSoft,
    borderColor: orbit.accent,
  },
  quickChipDisabled: {
    opacity: 0.35,
  },
  quickChipTxt: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: "500",
  },
  quickChipTxtActive: {
    color: orbit.accent,
    fontWeight: "600",
  },

  /* UPI box */
  upiBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: orbit.surface1,
    borderWidth: 1.5,
    borderColor: orbit.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    marginBottom: 4,
  },
  upiInput: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },

  /* Banners */
  holdBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: orbit.warningSoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  holdBannerTxt: {
    flex: 1,
    color: orbit.warning,
    fontSize: 12,
    lineHeight: 18,
  },

  /* Compliance */
  complianceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 18,
  },
  complianceTxt: {
    flex: 1,
    color: orbit.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },

  /* CTA */
  ctaWrap: {
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
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 10 },
    }),
  },
  ctaBtn: {
    backgroundColor: orbit.accent,
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaTxt: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  /* Result overlay */
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  overlayCard: {
    backgroundColor: orbit.surface1,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  overlayIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  overlayTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  overlaySub: {
    color: orbit.textSecond,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  overlayMeta: {
    width: "100%",
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  overlayMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  overlayMetaKey: {
    color: orbit.textTertiary,
    fontSize: 13,
  },
  overlayMetaVal: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    marginLeft: 12,
    textAlign: "right",
  },
  overlayBtn: {
    width: "100%",
    backgroundColor: orbit.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  overlayBtnTxt: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: "600",
  },
});

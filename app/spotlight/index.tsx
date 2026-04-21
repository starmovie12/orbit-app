/**
 * ORBIT — Spotlight Auction Screen  (app/spotlight/index.tsx)
 *
 * Blueprint §08 Engine 4: Top of Discover feed auctioned every hour.
 * Highest credit bid wins the 1-hour slot.
 *
 * Auction mechanics (blueprint):
 *   • Runs every hour, 24×7
 *   • Slot duration: 1 hour (top of Discover)
 *   • Min bid: 20 credits
 *   • Bid increments: +5 credits
 *   • Max concurrent bids: 50 users/hour
 *   • Karma ≥ 200 required to be spotlight eligible
 *
 * Firestore schema:
 *   /spotlights/{hourlyId}   — e.g. "2026-04-21-14"
 *     winnerUid, winnerUsername, bidCredits, content, startedAt, endsAt
 *   /spotlights/{hourlyId}/bids/{uid}
 *     uid, username, amount, placedAt
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
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
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Avatar, ScreenHeader, CreditPill, WalletDrawer } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { firestore, serverTimestamp, increment } from "@/lib/firebase";
import { MY_PROFILE } from "@/constants/data";

// Cross-platform Firestore .exists helper (web compat vs native SDK)
function snapExists(s: any): boolean { return typeof s.exists === 'function' ? s.exists() : !!s.exists; }

/* ─────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────── */

const MIN_BID = 20;
const BID_INCREMENT = 5;
const MAX_BIDS_PER_HOUR = 50;
const KARMA_THRESHOLD = 200;
const SPOTLIGHTS_COL = "spotlights";

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type SpotlightDoc = {
  winnerUid: string | null;
  winnerUsername: string | null;
  bidCredits: number;
  startedAt: number; // epoch ms
  endsAt: number;    // epoch ms
  bidCount: number;
};

type BidDoc = {
  uid: string;
  username: string;
  amount: number;
  placedAt: unknown; // Firestore Timestamp
  placedAtMs: number;
};

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

/** Builds the document ID for the current hour's slot: "YYYY-MM-DD-HH" */
function currentHourlyId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}`;
}

/** Epoch ms when the current hour ends (top of next hour). */
function currentHourEndsAt(): number {
  const now = new Date();
  now.setMinutes(60, 0, 0);
  return now.getTime();
}

/** Epoch ms when the current hour started. */
function currentHourStartedAt(): number {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.getTime();
}

/** Format mm:ss countdown from ms remaining. */
function fmtCountdown(msLeft: number): string {
  if (msLeft <= 0) return "00:00";
  const totalSeconds = Math.floor(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Format "HH:00 – HH:00" slot label. */
function slotLabel(startedAt: number): string {
  const s = new Date(startedAt);
  const e = new Date(startedAt + 3_600_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(s)} – ${fmt(e)}`;
}

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

async function getOrCreateSpotlight(hourlyId: string): Promise<SpotlightDoc> {
  const db = firestore();
  const ref = db.collection(SPOTLIGHTS_COL).doc(hourlyId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snapExists(snap)) {
      tx.set(ref, {
        winnerUid: null,
        winnerUsername: null,
        bidCredits: 0,
        startedAt: currentHourStartedAt(),
        endsAt: currentHourEndsAt(),
        bidCount: 0,
      } as SpotlightDoc);
    }
  });

  const snap = await ref.get();
  return snap.data() as SpotlightDoc;
}

function subscribeSpotlight(
  hourlyId: string,
  cb: (doc: SpotlightDoc | null) => void
): () => void {
  return firestore()
    .collection(SPOTLIGHTS_COL)
    .doc(hourlyId)
    .onSnapshot(
      (snap) => cb(snapExists(snap) ? (snap.data() as SpotlightDoc) : null),
      () => cb(null)
    );
}

function subscribeBids(
  hourlyId: string,
  cb: (bids: BidDoc[]) => void
): () => void {
  return firestore()
    .collection(SPOTLIGHTS_COL)
    .doc(hourlyId)
    .collection("bids")
    .orderBy("placedAtMs", "desc")
    .limit(50)
    .onSnapshot(
      (qs) => {
        const list: BidDoc[] = [];
        qs.forEach((doc) => list.push(doc.data() as BidDoc));
        cb(list);
      },
      () => cb([])
    );
}

/**
 * Place a bid. Uses a Firestore transaction to:
 *   1. Verify user has enough credits.
 *   2. Verify bid > current winner bid.
 *   3. Refund previous winner if outbid.
 *   4. Debit new bidder.
 *   5. Update spotlight winner.
 *   6. Write bid doc.
 */
async function placeBid(args: {
  hourlyId: string;
  uid: string;
  username: string;
  amount: number;
  karma: number;
}): Promise<{ success: boolean; reason?: string }> {
  const db = firestore();
  const spotRef = db.collection(SPOTLIGHTS_COL).doc(args.hourlyId);
  const bidRef = spotRef.collection("bids").doc(args.uid);
  const userRef = db.collection("users").doc(args.uid);

  let result: { success: boolean; reason?: string } = { success: false };

  await db.runTransaction(async (tx) => {
    const [spotSnap, userSnap] = await Promise.all([
      tx.get(spotRef),
      tx.get(userRef),
    ]);

    const spot = spotSnap.exists()
      ? (spotSnap.data() as SpotlightDoc)
      : null;

    const userData = userSnap.exists()
      ? (userSnap.data() as { credits: number; karma: number })
      : null;

    if (!userData) {
      result = { success: false, reason: "User not found." };
      return;
    }

    // Karma gate
    if ((userData.karma ?? 0) < KARMA_THRESHOLD) {
      result = {
        success: false,
        reason: `You need at least ${KARMA_THRESHOLD} karma to bid on Spotlight.`,
      };
      return;
    }

    // Min bid
    if (args.amount < MIN_BID) {
      result = {
        success: false,
        reason: `Minimum bid is ${MIN_BID} credits.`,
      };
      return;
    }

    // Must beat current winner
    const currentTopBid = spot?.bidCredits ?? 0;
    if (args.amount <= currentTopBid) {
      result = {
        success: false,
        reason: `Your bid must be higher than the current top bid (${currentTopBid} credits).`,
      };
      return;
    }

    // Credits check
    if ((userData.credits ?? 0) < args.amount) {
      result = {
        success: false,
        reason: "Not enough credits. Earn more by being active!",
      };
      return;
    }

    // Max bids cap
    const bidCount = spot?.bidCount ?? 0;
    if (bidCount >= MAX_BIDS_PER_HOUR) {
      result = {
        success: false,
        reason: "This hour's auction has reached max participants (50). Try next hour!",
      };
      return;
    }

    // Refund previous winner (if exists and different user)
    const prevWinnerUid = spot?.winnerUid;
    const prevBid = spot?.bidCredits ?? 0;
    if (prevWinnerUid && prevWinnerUid !== args.uid && prevBid > 0) {
      const prevUserRef = db.collection("users").doc(prevWinnerUid);
      tx.update(prevUserRef, {
        credits: (await tx.get(prevUserRef)).data()?.credits ?? 0 + prevBid,
        updatedAt: serverTimestamp(),
      });
    }

    // Debit new bidder
    tx.update(userRef, {
      credits: (userData.credits ?? 0) - args.amount,
      updatedAt: serverTimestamp(),
    });

    // Update spotlight
    tx.set(
      spotRef,
      {
        winnerUid: args.uid,
        winnerUsername: args.username,
        bidCredits: args.amount,
        startedAt: spot?.startedAt ?? currentHourStartedAt(),
        endsAt: spot?.endsAt ?? currentHourEndsAt(),
        bidCount: (bidCount === 0 ? 1 : increment(1)) as any,
      },
      { merge: true }
    );

    // Write bid record
    tx.set(bidRef, {
      uid: args.uid,
      username: args.username,
      amount: args.amount,
      placedAt: serverTimestamp(),
      placedAtMs: Date.now(),
    } as BidDoc);

    result = { success: true };
  });

  return result;
}

/* ─────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────── */

function CountdownRing({ msLeft, totalMs }: { msLeft: number; totalMs: number }) {
  const progress = Math.max(0, Math.min(1, msLeft / totalMs));
  const isUrgent = msLeft < 5 * 60 * 1000; // < 5 min

  return (
    <View style={styles.ringWrap}>
      <View
        style={[
          styles.ringOuter,
          { borderColor: isUrgent ? orbit.danger : orbit.accent },
        ]}
      >
        <Text style={[styles.ringTime, { color: isUrgent ? orbit.danger : orbit.textPrimary }]}>
          {fmtCountdown(msLeft)}
        </Text>
        <Text style={styles.ringLabel}>remaining</Text>
      </View>
      {isUrgent && (
        <View style={styles.urgentBadge}>
          <Feather name="zap" size={10} color={orbit.white} />
          <Text style={styles.urgentText}>ENDING SOON</Text>
        </View>
      )}
    </View>
  );
}

function WinnerCard({
  winnerUsername,
  bidCredits,
  slotTime,
}: {
  winnerUsername: string | null;
  bidCredits: number;
  slotTime: string;
}) {
  if (!winnerUsername) {
    return (
      <View style={styles.winnerCard}>
        <View style={styles.winnerNoWinnerWrap}>
          <View style={styles.winnerEmptyIcon}>
            <Feather name="award" size={28} color={orbit.textTertiary} />
          </View>
          <Text style={styles.winnerEmptyTitle}>No bids yet</Text>
          <Text style={styles.winnerEmptySub}>
            Be the first to claim this hour's Spotlight slot!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.winnerCard}>
      <View style={styles.winnerTopRow}>
        <View style={styles.winnerCrownWrap}>
          <Feather name="award" size={14} color={orbit.warning} />
          <Text style={styles.winnerCrownLabel}>CURRENT WINNER</Text>
        </View>
        <View style={styles.slotPill}>
          <Text style={styles.slotPillText}>{slotTime}</Text>
        </View>
      </View>

      <View style={styles.winnerBody}>
        <Avatar name={winnerUsername} size={56} ringed />
        <View style={styles.winnerInfo}>
          <Text style={styles.winnerName}>{winnerUsername}</Text>
          <Text style={styles.winnerSub}>Leading with highest bid</Text>
          <View style={styles.winnerBidRow}>
            <Feather name="zap" size={14} color={orbit.warning} />
            <Text style={styles.winnerBidAmount}>{bidCredits} credits</Text>
            <Text style={styles.winnerBidLabel}>top bid</Text>
          </View>
        </View>
      </View>

      <View style={styles.winnerFooter}>
        <Feather name="trending-up" size={12} color={orbit.success} />
        <Text style={styles.winnerFooterText}>
          Winner's post appears at top of Discover feed
        </Text>
      </View>
    </View>
  );
}

function BidRow({ bid, isMe }: { bid: BidDoc; isMe: boolean }) {
  return (
    <View style={[styles.bidRow, isMe && styles.bidRowMe]}>
      <Avatar name={bid.username} size={32} />
      <View style={styles.bidRowInfo}>
        <Text style={[styles.bidRowName, isMe && { color: orbit.accent }]}>
          {isMe ? "You" : bid.username}
        </Text>
        <Text style={styles.bidRowTime}>
          {new Date(bid.placedAtMs).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </Text>
      </View>
      <View style={styles.bidRowAmountWrap}>
        <Feather name="zap" size={12} color={isMe ? orbit.warning : orbit.textTertiary} />
        <Text style={[styles.bidRowAmount, isMe && { color: orbit.warning }]}>
          {bid.amount}
        </Text>
      </View>
    </View>
  );
}

function PlaceBidModal({
  visible,
  currentTopBid,
  myCredits,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  currentTopBid: number;
  myCredits: number;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const minRequired = Math.max(MIN_BID, currentTopBid + BID_INCREMENT);
  const [amount, setAmount] = useState(String(minRequired));
  const [submitting, setSubmitting] = useState(false);
  const parsedAmount = parseInt(amount, 10);
  const isValid =
    !isNaN(parsedAmount) &&
    parsedAmount >= minRequired &&
    parsedAmount <= myCredits;

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setAmount(String(minRequired));
      setSubmitting(false);
    }
  }, [visible, minRequired]);

  const handleConfirm = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onConfirm(parsedAmount);
    setSubmitting(false);
  }, [isValid, submitting, parsedAmount, onConfirm]);

  const canAfford = parsedAmount <= myCredits;
  const beats = parsedAmount > currentTopBid;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Place a Bid</Text>
          <Text style={styles.sheetSub}>
            Outbid the current winner to claim this hour's Spotlight slot.
          </Text>

          {/* Rules */}
          <View style={styles.rulesRow}>
            <View style={styles.rulePill}>
              <Feather name="arrow-up" size={11} color={orbit.accent} />
              <Text style={styles.rulePillText}>Min {MIN_BID} credits</Text>
            </View>
            <View style={styles.rulePill}>
              <Feather name="chevrons-up" size={11} color={orbit.accent} />
              <Text style={styles.rulePillText}>+{BID_INCREMENT} increment</Text>
            </View>
            <View style={styles.rulePill}>
              <Feather name="users" size={11} color={orbit.accent} />
              <Text style={styles.rulePillText}>Max 50/hr</Text>
            </View>
          </View>

          {/* Current top bid */}
          <View style={styles.currentBidCard}>
            <Text style={styles.currentBidLabel}>Current top bid</Text>
            <View style={styles.currentBidAmountRow}>
              <Feather name="zap" size={16} color={orbit.warning} />
              <Text style={styles.currentBidAmount}>
                {currentTopBid === 0 ? "None" : `${currentTopBid} credits`}
              </Text>
            </View>
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Your bid (min {minRequired} credits)</Text>
          <View style={styles.bidInputRow}>
            <TouchableOpacity
              style={styles.bidStepBtn}
              onPress={() => {
                const cur = parseInt(amount, 10) || minRequired;
                setAmount(String(Math.max(minRequired, cur - BID_INCREMENT)));
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Decrease bid"
            >
              <Feather name="minus" size={16} color={orbit.textPrimary} />
            </TouchableOpacity>

            <View style={styles.bidInputWrap}>
              <Feather name="zap" size={14} color={orbit.warning} />
              <TextInput
                style={styles.bidInput}
                value={amount}
                onChangeText={(v) => {
                  const stripped = v.replace(/[^0-9]/g, "");
                  setAmount(stripped);
                }}
                keyboardType="number-pad"
                maxLength={6}
                accessibilityLabel="Bid amount"
                selectTextOnFocus
              />
              <Text style={styles.bidInputSuffix}>credits</Text>
            </View>

            <TouchableOpacity
              style={styles.bidStepBtn}
              onPress={() => {
                const cur = parseInt(amount, 10) || minRequired;
                setAmount(String(cur + BID_INCREMENT));
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Increase bid"
            >
              <Feather name="plus" size={16} color={orbit.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Validation hints */}
          {!isNaN(parsedAmount) && (
            <View style={styles.validationRow}>
              <View style={styles.validationItem}>
                <Feather
                  name={beats ? "check-circle" : "x-circle"}
                  size={13}
                  color={beats ? orbit.success : orbit.danger}
                />
                <Text style={[styles.validationText, { color: beats ? orbit.success : orbit.danger }]}>
                  {beats ? "Beats current bid" : `Must beat ${currentTopBid} credits`}
                </Text>
              </View>
              <View style={styles.validationItem}>
                <Feather
                  name={canAfford ? "check-circle" : "x-circle"}
                  size={13}
                  color={canAfford ? orbit.success : orbit.danger}
                />
                <Text style={[styles.validationText, { color: canAfford ? orbit.success : orbit.danger }]}>
                  {canAfford
                    ? `You have ${myCredits} credits`
                    : `Not enough (have ${myCredits})`}
                </Text>
              </View>
            </View>
          )}

          {/* Your balance */}
          <View style={styles.balanceRow}>
            <Feather name="zap" size={13} color={orbit.accent} />
            <Text style={styles.balanceText}>
              Your balance: {myCredits} credits
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!isValid || submitting) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValid || submitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Confirm bid"
          >
            {submitting ? (
              <ActivityIndicator color={orbit.white} size="small" />
            ) : (
              <>
                <Feather name="award" size={16} color={orbit.white} />
                <Text style={styles.confirmBtnText}>
                  Bid {isNaN(parsedAmount) ? "—" : parsedAmount} credits
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.refundNote}>
            If you're outbid, your credits are automatically refunded.
          </Text>

          <View style={{ height: 8 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function SpotlightScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const myUid = firebaseUser?.uid ?? "";
  const myUsername = user?.username ?? MY_PROFILE.name;
  const myCredits = user?.credits ?? MY_PROFILE.credits;
  const myKarma = user?.karma ?? MY_PROFILE.karma;

  const [hourlyId, setHourlyId] = useState(() => currentHourlyId());
  const [spotDoc, setSpotDoc] = useState<SpotlightDoc | null>(null);
  const [bids, setBids] = useState<BidDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);
  const [walletVisible, setWalletVisible] = useState(false);
  const [msLeft, setMsLeft] = useState(0);

  /* Init: get or create current hour's spotlight */
  useEffect(() => {
    const id = currentHourlyId();
    setHourlyId(id);
    getOrCreateSpotlight(id)
      .then((doc) => {
        setSpotDoc(doc);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* Subscribe to spot doc */
  useEffect(() => {
    if (!hourlyId) return;
    const unsub = subscribeSpotlight(hourlyId, (doc) => {
      if (doc) setSpotDoc(doc);
    });
    return unsub;
  }, [hourlyId]);

  /* Subscribe to bids */
  useEffect(() => {
    if (!hourlyId) return;
    const unsub = subscribeBids(hourlyId, setBids);
    return unsub;
  }, [hourlyId]);

  /* Countdown timer — ticks every second */
  useEffect(() => {
    const tick = () => {
      const endsAt = spotDoc?.endsAt ?? currentHourEndsAt();
      const left = Math.max(0, endsAt - Date.now());
      setMsLeft(left);

      // Hour rolled over — reload
      if (left === 0) {
        const newId = currentHourlyId();
        if (newId !== hourlyId) {
          setHourlyId(newId);
          setLoading(true);
          getOrCreateSpotlight(newId)
            .then((doc) => {
              setSpotDoc(doc);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [spotDoc, hourlyId]);

  /* Place bid handler */
  const handlePlaceBid = useCallback(
    async (amount: number) => {
      if (!myUid || !firebaseUser) {
        Alert.alert("Sign in required", "Please sign in to place a bid.");
        setShowBidModal(false);
        return;
      }

      const result = await placeBid({
        hourlyId,
        uid: myUid,
        username: myUsername,
        amount,
        karma: myKarma,
      });

      setShowBidModal(false);

      if (!result.success) {
        Alert.alert("Bid failed", result.reason ?? "Something went wrong. Try again.");
      } else {
        Alert.alert(
          "Bid placed!",
          `You're now the top bidder with ${amount} credits. If you win, your post appears at the top of Discover!`,
          [{ text: "Got it", style: "default" }]
        );
      }
    },
    [hourlyId, myUid, myUsername, myKarma, firebaseUser]
  );

  const currentTopBid = spotDoc?.bidCredits ?? 0;
  const isWinning = spotDoc?.winnerUid === myUid;
  const karmaGated = myKarma < KARMA_THRESHOLD;
  const totalMs = 3_600_000; // 1 hour
  const slot = spotDoc ? slotLabel(spotDoc.startedAt) : slotLabel(currentHourStartedAt());

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={orbit.accent} size="large" />
        <Text style={styles.loadingText}>Loading Spotlight…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <ScreenHeader
        title="Spotlight"
        onBack={() => router.back()}
        right={
          <CreditPill count={myCredits} onPress={() => setWalletVisible(true)} />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
      >
        {/* ── HERO: Countdown + slot ──────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Feather name="zap" size={12} color={orbit.warning} />
              <Text style={styles.heroBadgeText}>HOURLY AUCTION</Text>
            </View>
            <Text style={styles.heroSlot}>{slot}</Text>
          </View>

          <Text style={styles.heroTitle}>
            Win the top of{"\n"}Discover feed
          </Text>
          <Text style={styles.heroSub}>
            Highest bidder's post is pinned at the top of Discover for 1 full hour.
          </Text>

          <CountdownRing msLeft={msLeft} totalMs={totalMs} />
        </View>

        {/* ── WINNER CARD ────────────────────────────────────────── */}
        <WinnerCard
          winnerUsername={spotDoc?.winnerUsername ?? null}
          bidCredits={currentTopBid}
          slotTime={slot}
        />

        {/* ── WINNING BANNER (if I'm winning) ─────────────────────── */}
        {isWinning && (
          <View style={styles.winningBanner}>
            <Feather name="award" size={18} color={orbit.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.winningTitle}>You're the top bidder!</Text>
              <Text style={styles.winningSub}>
                Stay ahead — someone might outbid you before the hour ends.
              </Text>
            </View>
          </View>
        )}

        {/* ── KARMA GATE ─────────────────────────────────────────── */}
        {karmaGated && (
          <View style={styles.karmaGateCard}>
            <Feather name="lock" size={16} color={orbit.textTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.karmaGateTitle}>
                {KARMA_THRESHOLD} karma required
              </Text>
              <Text style={styles.karmaGateSub}>
                You have {myKarma} karma. Keep posting to unlock Spotlight bidding!
              </Text>
            </View>
            <View style={styles.karmaProgress}>
              <View
                style={[
                  styles.karmaProgressFill,
                  {
                    width: `${Math.min(100, (myKarma / KARMA_THRESHOLD) * 100)}%` as any,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How Spotlight works</Text>
          <View style={styles.howStep}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>1</Text></View>
            <Text style={styles.howStepText}>
              Place a bid of at least {MIN_BID} credits. Must beat the current top bid.
            </Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>2</Text></View>
            <Text style={styles.howStepText}>
              If you win the hour, your selected post appears at the top of Discover.
            </Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>3</Text></View>
            <Text style={styles.howStepText}>
              If outbid, your credits are automatically refunded. Raise your bid anytime!
            </Text>
          </View>
          <View style={[styles.howStep, { borderBottomWidth: 0 }]}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>✓</Text></View>
            <Text style={styles.howStepText}>
              Requires {KARMA_THRESHOLD}+ karma. A new slot opens every hour, 24×7.
            </Text>
          </View>
        </View>

        {/* ── BID HISTORY ──────────────────────────────────────────── */}
        {bids.length > 0 && (
          <View style={styles.bidsSection}>
            <Text style={styles.sectionLabel}>This hour's bids · {bids.length}</Text>
            {bids.map((bid) => (
              <BidRow key={bid.uid} bid={bid} isMe={bid.uid === myUid} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── STICKY BID CTA ───────────────────────────────────────── */}
      <View
        style={[
          styles.ctaBar,
          { paddingBottom: Math.max(insets.bottom, 12) + 4 },
        ]}
      >
        {karmaGated ? (
          <View style={styles.ctaGated}>
            <Feather name="lock" size={16} color={orbit.textTertiary} />
            <Text style={styles.ctaGatedText}>
              Need {KARMA_THRESHOLD} karma to bid · You have {myKarma}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.ctaBtn, isWinning && styles.ctaBtnWinning]}
            onPress={() => setShowBidModal(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isWinning ? "Raise your bid" : "Place a bid"}
          >
            <Feather
              name={isWinning ? "trending-up" : "award"}
              size={18}
              color={orbit.white}
            />
            <Text style={styles.ctaBtnText}>
              {isWinning
                ? `Raise bid (currently ${currentTopBid} credits)`
                : currentTopBid === 0
                ? `Place first bid (min ${MIN_BID} credits)`
                : `Outbid ${currentTopBid} credits to win`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── MODALS ──────────────────────────────────────────────── */}
      <PlaceBidModal
        visible={showBidModal}
        currentTopBid={currentTopBid}
        myCredits={myCredits}
        onClose={() => setShowBidModal(false)}
        onConfirm={handlePlaceBid}
      />

      <WalletDrawer
        visible={walletVisible}
        onClose={() => setWalletVisible(false)}
        credits={myCredits}
      />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: orbit.bg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },

  /* Hero */
  heroSection: {
    backgroundColor: orbit.surface1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    padding: 20,
    alignItems: "center",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 14,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: orbit.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  heroBadgeText: {
    color: orbit.warning,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  heroSlot: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
  },
  heroTitle: {
    color: orbit.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 28,
  },
  heroSub: {
    color: orbit.textSecond,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  /* Countdown ring */
  ringWrap: {
    alignItems: "center",
  },
  ringOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: orbit.surface2,
  },
  ringTime: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  ringLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: orbit.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginTop: 10,
  },
  urgentText: {
    color: orbit.white,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  /* Winner card */
  winnerCard: {
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: "hidden",
  },
  winnerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
  },
  winnerCrownWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  winnerCrownLabel: {
    color: orbit.warning,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  slotPill: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  slotPillText: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
  },
  winnerBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  winnerInfo: { flex: 1 },
  winnerName: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  winnerSub: {
    color: orbit.textSecond,
    fontSize: 12,
    marginBottom: 8,
  },
  winnerBidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  winnerBidAmount: {
    color: orbit.warning,
    fontSize: 16,
    fontWeight: "800",
  },
  winnerBidLabel: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
  winnerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: orbit.successSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
  },
  winnerFooterText: {
    color: orbit.success,
    fontSize: 12,
    fontWeight: "600",
  },
  winnerNoWinnerWrap: {
    alignItems: "center",
    padding: 28,
    gap: 8,
  },
  winnerEmptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  winnerEmptyTitle: {
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  winnerEmptySub: {
    color: orbit.textSecond,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  /* Winning banner */
  winningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: orbit.warningSoft,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `rgba(232,163,61,0.25)`,
  },
  winningTitle: {
    color: orbit.warning,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  winningSub: {
    color: orbit.textSecond,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Karma gate */
  karmaGateCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  karmaGateTitle: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  karmaGateSub: {
    color: orbit.textSecond,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  karmaProgress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.surface3,
    overflow: "hidden",
  },
  karmaProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.accent,
  },

  /* How it works */
  howCard: {
    backgroundColor: orbit.surface1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    padding: 16,
  },
  howTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 14,
    letterSpacing: -0.1,
  },
  howStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
  },
  howStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: orbit.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  howStepNumText: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  howStepText: {
    color: orbit.textSecond,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  /* Bids */
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  bidsSection: {
    gap: 2,
  },
  bidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: orbit.surface1,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  bidRowMe: {
    borderColor: orbit.accent,
    backgroundColor: orbit.accentSoftSolid,
  },
  bidRowInfo: { flex: 1 },
  bidRowName: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  bidRowTime: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  bidRowAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  bidRowAmount: {
    color: orbit.textSecond,
    fontSize: 15,
    fontWeight: "700",
  },

  /* CTA bar */
  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: orbit.bg,
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: orbit.warning,
    shadowColor: orbit.warning,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  ctaBtnWinning: {
    backgroundColor: orbit.success,
    shadowColor: orbit.success,
  },
  ctaBtnText: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  ctaGated: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  ctaGatedText: {
    color: orbit.textTertiary,
    fontSize: 13,
    fontWeight: "600",
  },

  /* Place bid modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: orbit.surface1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSub: {
    color: orbit.textSecond,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 19,
  },
  rulesRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  rulePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  rulePillText: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: "600",
  },
  currentBidCard: {
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  currentBidLabel: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: "500",
  },
  currentBidAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  currentBidAmount: {
    color: orbit.warning,
    fontSize: 16,
    fontWeight: "800",
  },
  inputLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  bidInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  bidStepBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  bidInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  bidInput: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    padding: 0,
  },
  bidInputSuffix: {
    color: orbit.textTertiary,
    fontSize: 13,
    fontWeight: "500",
  },
  validationRow: {
    gap: 6,
    marginBottom: 10,
  },
  validationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  validationText: {
    fontSize: 12,
    fontWeight: "500",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 16,
  },
  balanceText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: "500",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 52,
    borderRadius: 26,
    backgroundColor: orbit.warning,
    shadowColor: orbit.warning,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    marginBottom: 10,
  },
  confirmBtnDisabled: {
    backgroundColor: orbit.surface3,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    color: orbit.white,
    fontSize: 16,
    fontWeight: "700",
  },
  refundNote: {
    color: orbit.textTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});

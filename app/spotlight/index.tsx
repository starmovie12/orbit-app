/**
 * CROWN — Boli (Auction) Screen  (app/spotlight/index.tsx)
 *
 * CROWN §Boli Mechanic:
 *   "Boli" = the auction mechanic. Every 5-hour cycle, the title contest freezes.
 *   The current title holder then has a 30-minute window to accept the top bid
 *   (transfer title) or keep it (reject all bids → everyone refunded).
 *   If the holder takes no action, the top bidder auto-wins at window close.
 *
 * Bid escrow:
 *   Bids are held in escrow (credits deducted atomically on bid, refunded
 *   atomically when outbid). Only the TOP bid is held at any time; lower bids
 *   are refunded inside the same Firestore transaction that places the new
 *   higher bid. This prevents currency generation and eliminates race conditions.
 *
 * Firestore schema (LAW 21 — city-sharded):
 *   /cities/{cityId}/boli/{cycleId}
 *     titleHolderUid: string | null
 *     titleHolderUsername: string | null
 *     titleTier: 'SECTOR' | 'CITY' | 'COUNTRY' | 'WORLD'
 *     scopeLabel: string             — e.g. "Sector 17", "Chandigarh"
 *     topBidUid: string | null
 *     topBidUsername: string | null
 *     topBidAmount: number           — credits in escrow (0 = no bids)
 *     status: 'active' | 'frozen' | 'accepted' | 'rejected' | 'settled'
 *     cycleStartsAt: number          — epoch ms
 *     cycleEndsAt: number            — epoch ms (cycleStartsAt + 18_000_000)
 *     boliStartsAt: number | null    — epoch ms when freeze happens
 *     boliEndsAt: number | null      — epoch ms (boliStartsAt + 1_800_000)
 *     bidCount: number
 *
 *   /cities/{cityId}/boli/{cycleId}/bids/{uid}
 *     uid, username, amount, placedAt, placedAtMs
 *     status: 'escrowed' | 'refunded' | 'won' | 'rejected'
 *
 * Laws enforced: 03 · 04 · 13 · 15 · 21 · 22 · 30
 * Design system: CROWN Design System v1.0 — PRD §1.4.2 tokens (Light/Dark)
 *   Palette: Brand Gold · Warm Ivory · Deep Navy · Off-White
 *   Fonts:   Syne_800ExtraBold (titles) · SpaceMono_700Bold (numbers/timers)
 *            Inter_400Regular / 500Medium / 600SemiBold (body)
 * Animation: Reanimated v4 — worklet-safe, UI thread only
 * PRD ref:   §1.3.3 (Boli mechanic) · §1.4.2 (Color tokens) · §1.4.3 (Typography)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  Avatar,
  CreditPill,
  ScreenHeader,
  TitleBadge,
  WalletDrawer,
} from '@/components/shared';
// CROWN design tokens — PRD §1.4.2 (inlined; no separate crown.ts required)
// t  = color tokens  (fgBrand, bgSurface, bgCard, fgSuccess, fgDanger …)
// r  = radius scale  (chip 4 · button 8 · card 12 · modal 16 · pill 999)
// sp = spacing scale (xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24)
import { orbitGold, colors as _colors } from '@/constants/colors';
import { spacing as _spacing, radius as _radius, shadows as _shadows } from '@/constants/spacing';

const t = {
  bgSurface:       orbitGold.bg,
  bgCard:          orbitGold.surface1,
  bgCardElevated:  orbitGold.surface2,
  bgBrandSubtle:   orbitGold.accentSoftSolid,
  bgSuccessSubtle: orbitGold.successSoft,
  fgTextStrong:    orbitGold.textPrimary,
  fgTextSubtle:    orbitGold.textSecond,
  fgTextMuted:     orbitGold.textTertiary,
  fgBrand:         orbitGold.fgBrand,
  fgSuccess:       orbitGold.success,
  fgDanger:        orbitGold.danger,
  borderSubtle:    orbitGold.borderSubtle,
  borderStrong:    orbitGold.borderStrong,
  scrim:           _colors.bg.scrim,
  shadow:          { md: _shadows.md, lg: _shadows.lg },
  white:           orbitGold.white,
} as const;

const r = {
  chip:   _radius.xs,
  button: _radius.sm,
  modal:  _radius.lg,
  pill:   _radius.pill,
} as const;

const sp = {
  xs:  _spacing.xs,
  sm:  _spacing.sm,
  md:  _spacing.md,
  lg:  _spacing.lg,
  xl:  _spacing.xl,
  xxl: _spacing.xxl,
} as const;
// TITLES.CITY = 'Mayor (VICEROY)' · TITLES.SECTOR = 'BARON' · etc — PRD §1.4.9
import { CYCLE, TITLES, TITLE_COLORS, type TitleTier } from '@/constants/titles';
import { useAuth } from '@/contexts/AuthContext';
import { firestore, serverTimestamp, increment } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — all named, zero magic numbers
// ─────────────────────────────────────────────────────────────────────────────

const MIN_BID_CREDITS = 50 as const;
const BID_INCREMENT_CREDITS = 10 as const;
const MAX_BIDS_PER_CYCLE = 100 as const;
const BOLI_COL = 'boli' as const;

/** Reanimated v4 spring preset — "glass" overshoot-then-settle */
const SPRING_GLASS = { mass: 1, stiffness: 200, damping: 24 } as const;
/** Reanimated v4 spring preset — "rigid" utility actions */
const SPRING_RIGID = { mass: 1, stiffness: 400, damping: 32 } as const;

/** Initial translateY for the bid sheet when hidden below screen (approx full sheet height) */
const SHEET_TRANSLATE_Y_HIDDEN = 420 as const;
/** Height of the CTA bar above the safe-area inset */
const CTA_BAR_HEIGHT = 52 as const;
/** Border-radius for pill-shaped CTA buttons (half of 52px height) */
const RADIUS_PILL_BTN = 26 as const;
/** Minimum padding above safe-area inset for the CTA bar */
const CTA_BAR_MIN_SAFE_PADDING = 12 as const;
/** Minimum padding below scrollview for CTA bar + Glass Island clearance */
const SCROLL_BOTTOM_EXTRA = 88 as const;
/** Countdown ring size */
const COUNTDOWN_RING_SIZE = 120 as const;
/** Countdown ring border width */
const COUNTDOWN_RING_BORDER = 3 as const;
/** Font size for the large countdown number */
const COUNTDOWN_FONT_SIZE = 24 as const;
/** Font size for the bid amount input field */
const BID_INPUT_FONT_SIZE = 20 as const;
/** Hero title font size */
const HERO_TITLE_FONT_SIZE = 22 as const;
/** Step badge size (diameter) */
const HOW_STEP_BADGE_SIZE = 22 as const;

/** CROWN Typography scale — PRD §1.4.3 */
const FONT_SIZE = {
  /** 11px — micro labels, cycle IDs, sub-badges */
  micro:     11,
  /** 12px — captions, timestamps, pill text */
  caption:   12,
  /** 13px — UI labels, validation hints */
  label:     13,
  /** 14px — secondary body text */
  bodySmall: 14,
  /** 15px — primary body text */
  body:      15,
  /** 16px — emphasized body, numeric labels */
  bodyLarge: 16,
  /** 20px — section titles, sheet titles */
  title:     20,
  /** 22px — hero headlines, screen titles (Syne_800ExtraBold) */
  headline:  22,
} as const;

/** CROWN Font families — PRD §1.4.3 (must match expo-google-fonts variants loaded in _layout) */
const FONT_FAMILY = {
  /** Syne ExtraBold — headings, hero titles, holder names */
  displayBold:  'Syne_800ExtraBold',
  /** Space Mono Bold — numbers, credits, countdown timers */
  monoNum:      'SpaceMono_700Bold',
  /** Inter Regular — body text (default system fallback) */
  bodyRegular:  'Inter_400Regular',
  /** Inter SemiBold — emphasized body, buttons */
  bodySemiBold: 'Inter_600SemiBold',
} as const;

/**
 * Thin opacity suffixes for tier accent colors — appended to hex strings only where
 * a full design token doesn't cover the case (e.g. dynamic tier-colored tints).
 * PRD §1.4.2 note: CROWN tokens cover static colors; tier tints are dynamic.
 */
const ALPHA_10 = '1A' as const; // 10% opacity hex suffix
const ALPHA_25 = '40' as const; // 25% opacity hex suffix
const ALPHA_19 = '30' as const; // ~19% opacity hex suffix — rule pill borders

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — full discriminated unions, zero 'any'
// ─────────────────────────────────────────────────────────────────────────────

type BoliStatus = 'active' | 'frozen' | 'accepted' | 'rejected' | 'settled';

interface BoliDoc {
  titleHolderUid: string | null;
  titleHolderUsername: string | null;
  titleTier: TitleTier;
  scopeLabel: string;
  topBidUid: string | null;
  topBidUsername: string | null;
  topBidAmount: number;
  status: BoliStatus;
  cycleStartsAt: number;
  cycleEndsAt: number;
  boliStartsAt: number | null;
  boliEndsAt: number | null;
  bidCount: number;
}

interface BidDoc {
  uid: string;
  username: string;
  amount: number;
  placedAt: unknown; // Firestore Timestamp
  placedAtMs: number;
  status: 'escrowed' | 'refunded' | 'won' | 'rejected';
}

type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
  | { status: 'submitting' };

type PhaseKind = 'active' | 'frozen' | 'settled';

interface CyclePhase {
  kind: PhaseKind;
  msLeft: number;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build the Firestore cycle document ID: "YYYY-MM-DD-HHHHH" (5h bucket). */
function currentCycleId(): string {
  const now = Date.now();
  const bucketIndex = Math.floor(now / CYCLE.DURATION_MS);
  return `cycle-${bucketIndex}`;
}

/** Returns epoch ms when the current 5-hour cycle ends. */
function currentCycleEndsAt(): number {
  const now = Date.now();
  const bucketIndex = Math.floor(now / CYCLE.DURATION_MS);
  return (bucketIndex + 1) * CYCLE.DURATION_MS;
}

/** Returns epoch ms when the current 5-hour cycle started. */
function currentCycleStartsAt(): number {
  const now = Date.now();
  const bucketIndex = Math.floor(now / CYCLE.DURATION_MS);
  return bucketIndex * CYCLE.DURATION_MS;
}

/** Format mm:ss from milliseconds remaining (≤60min) or HH:mm:ss for longer. */
function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return '00:00';
  const totalSeconds = Math.floor(msLeft / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Derive the current CyclePhase from a BoliDoc and current time. */
function deriveCyclePhase(doc: BoliDoc | null): CyclePhase {
  const now = Date.now();
  if (!doc) {
    return { kind: 'active', msLeft: currentCycleEndsAt() - now, label: 'Next freeze in' };
  }
  if (doc.status === 'accepted' || doc.status === 'rejected' || doc.status === 'settled') {
    return { kind: 'settled', msLeft: 0, label: 'Settled' };
  }
  if (doc.status === 'frozen' && doc.boliEndsAt !== null) {
    const msLeft = Math.max(0, doc.boliEndsAt - now);
    return { kind: 'frozen', msLeft, label: 'Boli window closes in' };
  }
  const msLeft = Math.max(0, doc.cycleEndsAt - now);
  return { kind: 'active', msLeft, label: 'Next freeze in' };
}

/**
 * Returns the CROWN tier accent color for a given title tier — PRD §1.4.2.
 * IMPERATOR → Prismatic (first gradient stop for solid contexts)
 * SOVEREIGN → Saffron (country flag gradient start)
 * Mayor (VICEROY) → Brand Gold (t.fgBrand)
 * BARON       → Emerald (t.fgSuccess)
 */
function titleAccentColor(tier: TitleTier): string {
  switch (tier) {
    case 'WORLD':   return TITLE_COLORS.WORLD[0];         // Prismatic — first stop
    case 'COUNTRY': return TITLE_COLORS.COUNTRY_INDIA[0]; // Saffron #FF9933
    case 'CITY':    return t.fgBrand;                     // Brand Gold PRD §1.4.2
    case 'SECTOR':  return t.fgSuccess;                   // Emerald PRD §1.4.2
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE HELPERS (LAW 21 city-sharded, LAW 8.1 transactions)
// ─────────────────────────────────────────────────────────────────────────────

/** Get or create the BoliDoc for the current cycle under a city shard. */
async function getOrCreateBoliDoc(
  cityId: string,
  cycleId: string,
  tier: TitleTier,
  scopeLabel: string,
): Promise<BoliDoc> {
  const db = firestore();
  const ref = db.collection('cities').doc(cityId).collection(BOLI_COL).doc(cycleId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // snap.exists is a boolean property (never call it as a function — LAW)
    if (!snap.exists) {
      const now = Date.now();
      tx.set(ref, {
        titleHolderUid: null,
        titleHolderUsername: null,
        titleTier: tier,
        scopeLabel,
        topBidUid: null,
        topBidUsername: null,
        topBidAmount: 0,
        status: 'active',
        cycleStartsAt: currentCycleStartsAt(),
        cycleEndsAt: currentCycleEndsAt(),
        boliStartsAt: null,
        boliEndsAt: null,
        bidCount: 0,
      } satisfies BoliDoc);
    }
  });

  const snap = await ref.get();
  const data = snap.data();
  if (!data) {
    throw new Error('Boli doc missing after creation — this should not happen.');
  }
  return data as BoliDoc;
}

/** Live subscription to the BoliDoc. Returns unsubscribe fn. */
function subscribeBoliDoc(
  cityId: string,
  cycleId: string,
  cb: (doc: BoliDoc | null) => void,
): () => void {
  return firestore()
    .collection('cities')
    .doc(cityId)
    .collection(BOLI_COL)
    .doc(cycleId)
    .onSnapshot(
      (snap) => cb(snap.exists ? (snap.data() as BoliDoc) : null),
      () => cb(null),
    );
}

/** Live subscription to the bid sub-collection. Returns unsubscribe fn. */
function subscribeBids(
  cityId: string,
  cycleId: string,
  cb: (bids: BidDoc[]) => void,
): () => void {
  return firestore()
    .collection('cities')
    .doc(cityId)
    .collection(BOLI_COL)
    .doc(cycleId)
    .collection('bids')
    .orderBy('placedAtMs', 'desc')
    .limit(50)
    .onSnapshot(
      (qs) => {
        const list: BidDoc[] = [];
        qs.forEach((d) => list.push(d.data() as BidDoc));
        cb(list);
      },
      () => cb([]),
    );
}

/**
 * Place a bid atomically via Firestore transaction.
 *
 * Steps inside the transaction (LAW 8.1 — no getDoc→updateDoc sequence):
 *   1. Verify user credits ≥ amount
 *   2. Verify amount > current topBidAmount
 *   3. Refund previous top bidder (if any, different user)
 *   4. Debit new bidder
 *   5. Update boli doc topBid fields
 *   6. Write bid sub-doc
 *
 * @param cityId   - City shard key (LAW 21)
 * @param cycleId  - Current cycle document ID
 * @param uid      - Authenticated bidder UID
 * @param username - Bidder display handle
 * @param amount   - Positive integer credits to bid
 *
 * @throws Never — errors are returned as typed result objects.
 */
async function placeBid(args: {
  cityId: string;
  cycleId: string;
  uid: string;
  username: string;
  amount: number;
}): Promise<{ success: true } | { success: false; reason: string }> {
  const db = firestore();
  const boliRef = db
    .collection('cities')
    .doc(args.cityId)
    .collection(BOLI_COL)
    .doc(args.cycleId);
  const bidRef = boliRef.collection('bids').doc(args.uid);
  const userRef = db.collection('users').doc(args.uid);

  let result: { success: true } | { success: false; reason: string } = {
    success: false,
    reason: 'Transaction failed. Try again.',
  };

  try {
    await db.runTransaction(async (tx) => {
      const [boliSnap, userSnap] = await Promise.all([
        tx.get(boliRef),
        tx.get(userRef),
      ]);

      // Guard: boli doc must exist
      if (!boliSnap.exists) {
        result = { success: false, reason: 'Boli cycle not found. Please refresh.' };
        return;
      }
      const boli = boliSnap.data() as BoliDoc;

      // Guard: only accept bids during 'active' or 'frozen' status
      if (boli.status !== 'active' && boli.status !== 'frozen') {
        result = { success: false, reason: 'This cycle has already been settled.' };
        return;
      }

      // Guard: user doc must exist
      if (!userSnap.exists) {
        result = { success: false, reason: 'User account not found.' };
        return;
      }
      const userData = userSnap.data() as { credits: number };

      // Guard: minimum bid
      if (args.amount < MIN_BID_CREDITS) {
        result = { success: false, reason: `Minimum bid is ${MIN_BID_CREDITS} credits.` };
        return;
      }

      // Guard: must beat current top bid
      if (args.amount <= boli.topBidAmount) {
        result = {
          success: false,
          reason: `Your bid must exceed the current top bid of ${boli.topBidAmount} credits.`,
        };
        return;
      }

      // Guard: sufficient balance
      if ((userData.credits ?? 0) < args.amount) {
        result = { success: false, reason: 'Not enough credits. Earn more by being active!' };
        return;
      }

      // Guard: participation cap
      if (boli.bidCount >= MAX_BIDS_PER_CYCLE) {
        result = {
          success: false,
          reason: `This cycle has reached the max of ${MAX_BIDS_PER_CYCLE} bids. Join next cycle!`,
        };
        return;
      }

      // Step 3 — Refund previous top bidder if different user
      const prevWinnerUid = boli.topBidUid;
      const prevBidAmount = boli.topBidAmount;
      if (prevWinnerUid && prevWinnerUid !== args.uid && prevBidAmount > 0) {
        const prevUserRef = db.collection('users').doc(prevWinnerUid);
        const prevUserSnap = await tx.get(prevUserRef);
        if (prevUserSnap.exists) {
          tx.update(prevUserRef, {
            credits: increment(prevBidAmount),
            updatedAt: serverTimestamp(),
          });
          // Mark previous bid as refunded
          tx.update(boliRef.collection('bids').doc(prevWinnerUid), {
            status: 'refunded',
          });
        }
      }

      // Step 4 — Debit new bidder
      tx.update(userRef, {
        credits: increment(-args.amount),
        updatedAt: serverTimestamp(),
      });

      // Step 5 — Update boli doc
      tx.update(boliRef, {
        topBidUid: args.uid,
        topBidUsername: args.username,
        topBidAmount: args.amount,
        bidCount: increment(1),
      });

      // Step 6 — Write bid sub-doc
      tx.set(bidRef, {
        uid: args.uid,
        username: args.username,
        amount: args.amount,
        placedAt: serverTimestamp(),
        placedAtMs: Date.now(),
        status: 'escrowed',
      } satisfies Omit<BidDoc, 'placedAt'> & { placedAt: unknown });

      result = { success: true };
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Transaction error';
    result = { success: false, reason: message };
  }

  return result;
}

/**
 * Title holder accepts the top bid — transfers title atomically.
 *
 * Steps: debit escrow already held; update boli status to 'accepted';
 * mark winning bid doc. Reverse-escrow for loser bids already done at
 * bid-placement time so no loop needed here.
 */
async function acceptTopBid(args: {
  cityId: string;
  cycleId: string;
  holderUid: string;
}): Promise<{ success: true } | { success: false; reason: string }> {
  const db = firestore();
  const boliRef = db
    .collection('cities')
    .doc(args.cityId)
    .collection(BOLI_COL)
    .doc(args.cycleId);

  let result: { success: true } | { success: false; reason: string } = {
    success: false,
    reason: 'Transaction failed.',
  };

  try {
    await db.runTransaction(async (tx) => {
      const boliSnap = await tx.get(boliRef);
      if (!boliSnap.exists) {
        result = { success: false, reason: 'Cycle not found.' };
        return;
      }
      const boli = boliSnap.data() as BoliDoc;

      if (boli.titleHolderUid !== args.holderUid) {
        result = { success: false, reason: 'You are not the current title holder.' };
        return;
      }
      if (boli.status !== 'frozen') {
        result = { success: false, reason: 'Boli window is not currently open.' };
        return;
      }
      if (!boli.topBidUid || boli.topBidAmount === 0) {
        result = { success: false, reason: 'No bids to accept.' };
        return;
      }

      // Step A — Credit the current title holder with the bid amount (escrow transfer)
      const holderUserRef = db.collection('users').doc(args.holderUid);
      tx.update(holderUserRef, {
        credits: increment(boli.topBidAmount),
        updatedAt: serverTimestamp(),
      });

      // Step B — Mark boli as accepted, promote top bidder to new title holder
      tx.update(boliRef, {
        status: 'accepted',
        titleHolderUid: boli.topBidUid,
        titleHolderUsername: boli.topBidUsername,
        updatedAt: serverTimestamp(),
      });

      // Step C — Mark winning bid doc
      tx.update(boliRef.collection('bids').doc(boli.topBidUid), {
        status: 'won',
        updatedAt: serverTimestamp(),
      });

      result = { success: true };
    });
  } catch (e: unknown) {
    result = { success: false, reason: e instanceof Error ? e.message : 'Error' };
  }

  return result;
}

/**
 * Title holder rejects all bids — refunds top bidder.
 *
 * Note: only the top bidder's credits are in escrow at any point (lower bids
 * are refunded at bid-placement time), so we only need to refund topBidUid.
 */
async function rejectAllBids(args: {
  cityId: string;
  cycleId: string;
  holderUid: string;
}): Promise<{ success: true } | { success: false; reason: string }> {
  const db = firestore();
  const boliRef = db
    .collection('cities')
    .doc(args.cityId)
    .collection(BOLI_COL)
    .doc(args.cycleId);

  let result: { success: true } | { success: false; reason: string } = {
    success: false,
    reason: 'Transaction failed.',
  };

  try {
    await db.runTransaction(async (tx) => {
      const boliSnap = await tx.get(boliRef);
      if (!boliSnap.exists) {
        result = { success: false, reason: 'Cycle not found.' };
        return;
      }
      const boli = boliSnap.data() as BoliDoc;

      if (boli.titleHolderUid !== args.holderUid) {
        result = { success: false, reason: 'You are not the current title holder.' };
        return;
      }
      if (boli.status !== 'frozen') {
        result = { success: false, reason: 'Boli window is not currently open.' };
        return;
      }

      // Refund top bidder if exists
      if (boli.topBidUid && boli.topBidAmount > 0) {
        const topUserRef = db.collection('users').doc(boli.topBidUid);
        const topUserSnap = await tx.get(topUserRef);
        if (topUserSnap.exists) {
          tx.update(topUserRef, {
            credits: increment(boli.topBidAmount),
            updatedAt: serverTimestamp(),
          });
        }
        tx.update(boliRef.collection('bids').doc(boli.topBidUid), {
          status: 'rejected',
        });
      }

      tx.update(boliRef, {
        status: 'rejected',
        topBidAmount: 0,
        topBidUid: null,
        topBidUsername: null,
        updatedAt: serverTimestamp(),
      });

      result = { success: true };
    });
  } catch (e: unknown) {
    result = { success: false, reason: e instanceof Error ? e.message : 'Error' };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (React.memo on every presentational component — LAW)
// ─────────────────────────────────────────────────────────────────────────────

// ── CycleCountdown ────────────────────────────────────────────────────────

interface CycleCountdownProps {
  phase: CyclePhase;
  tier: TitleTier;
}

/**
 * Displays the animated countdown ring for the current cycle phase.
 * Ring color and label adapt to 'active' | 'frozen' | 'settled'.
 *
 * @param phase - Current derived cycle phase
 * @param tier  - Title tier (drives accent color)
 */
const CycleCountdown = React.memo(function CycleCountdown({
  phase,
  tier,
}: CycleCountdownProps) {
  const accent = titleAccentColor(tier);
  const isUrgent = phase.kind === 'frozen' && phase.msLeft < 5 * 60 * 1_000;
  const isSettled = phase.kind === 'settled';

  // Pulse animation for frozen/urgent state — Reanimated v4 worklet-safe
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (phase.kind === 'frozen') {
      // Trigger pulse loop — Reanimated v4 worklet-safe recursive spring
      let cancelled = false;
      const loop = (): void => {
        if (cancelled) return;
        pulseScale.value = withSpring(1.06, SPRING_GLASS, () => {
          if (cancelled) return;
          pulseScale.value = withSpring(1, SPRING_GLASS, () => {
            if (!cancelled) runOnJS(loop)();
          });
        });
        pulseOpacity.value = withTiming(0.6, { duration: 700 }, () => {
          if (!cancelled) {
            pulseOpacity.value = withTiming(1, { duration: 700 });
          }
        });
      };
      loop();
      // Cleanup: cancel on unmount or phase change
      return () => {
        cancelled = true;
        // Reset to resting state without animation (cancelled = true guards callbacks)
        pulseScale.value = withSpring(1, SPRING_RIGID);
        pulseOpacity.value = withTiming(1, { duration: 200 });
      };
    } else {
      pulseScale.value = withSpring(1, SPRING_RIGID);
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  const ringAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const ringColor = isSettled
    ? t.fgTextSubtle
    : isUrgent
    ? t.fgDanger
    : phase.kind === 'frozen'
    ? t.fgBrand
    : accent;

  return (
    <View style={styles.countdownWrap}>
      <Animated.View style={[styles.countdownRingOuter, { borderColor: ringColor }, ringAnimStyle]}>
        <View style={styles.countdownRingInner}>
          {isSettled ? (
            <Feather name="check-circle" size={28} color={t.fgSuccess} />
          ) : (
            <Text
              style={[styles.countdownTime, { color: ringColor }]}
              accessibilityLabel={`${phase.label}: ${formatCountdown(phase.msLeft)}`}
            >
              {formatCountdown(phase.msLeft)}
            </Text>
          )}
          <Text style={styles.countdownLabel}>{isSettled ? 'Settled' : phase.label}</Text>
        </View>
      </Animated.View>

      {phase.kind === 'frozen' && (
        <View style={styles.boliOpenBadge}>
          <Feather name="zap" size={10} color={t.white} />
          <Text style={styles.boliOpenText}>BOLI OPEN</Text>
        </View>
      )}
    </View>
  );
});

// ── TitleHolderCard ───────────────────────────────────────────────────────

interface TitleHolderCardProps {
  doc: BoliDoc | null;
  myUid: string;
  onAccept: () => void;
  onReject: () => void;
  submitting: boolean;
}

/**
 * Displays the current title holder (or empty state) and, if the
 * cycle is frozen and the current user is the holder, shows Accept/Keep CTAs.
 */
const TitleHolderCard = React.memo(function TitleHolderCard({
  doc,
  myUid,
  onAccept,
  onReject,
  submitting,
}: TitleHolderCardProps) {
  const isFrozen = doc?.status === 'frozen';
  const isHolder = doc?.titleHolderUid === myUid;
  const hasTopBid = (doc?.topBidAmount ?? 0) > 0;
  const tier = doc?.titleTier ?? 'CITY';
  const accent = titleAccentColor(tier);
  const titleLabel = TITLES[tier];
  const scopeLabel = doc?.scopeLabel ?? '—';

  // Entrance animation
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(16);

  useEffect(() => {
    cardOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    cardTranslateY.value = withDelay(100, withSpring(0, SPRING_GLASS));
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  if (!doc?.titleHolderUid) {
    return (
      <Animated.View style={[styles.holderCard, cardAnimStyle]}>
        <View style={styles.holderEmpty}>
          <View style={[styles.holderEmptyIcon, { borderColor: accent }]}>
            <Feather name="award" size={28} color={accent} />
          </View>
          <Text style={styles.holderEmptyTitle}>No title holder yet</Text>
          <Text style={styles.holderEmptySub}>
            Place the first bid to compete for{' '}
            <Text style={{ color: accent }}>{titleLabel}</Text> of {scopeLabel}!
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.holderCard, cardAnimStyle]}>
      {/* Header row */}
      <View style={styles.holderTopRow}>
        <View style={styles.holderCrownRow}>
          <Feather name="award" size={13} color={accent} />
          <Text style={[styles.holderCrownLabel, { color: accent }]}>
            CURRENT {titleLabel.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.scopePill, { borderColor: accent + ALPHA_25 }]}>
          <Text style={[styles.scopePillText, { color: accent }]}>{scopeLabel}</Text>
        </View>
      </View>

      {/* Holder identity — PRD: TitleBadge shows tier-specific accent (§1.4.6) */}
      <View style={styles.holderBody}>
        <View style={styles.holderAvatarWrap}>
          <Avatar name={doc.titleHolderUsername ?? '?'} size={56} />
          <TitleBadge tier={tier} style={styles.holderTitleBadge} />
        </View>
        <View style={styles.holderInfo}>
          <Text style={styles.holderName}>{doc.titleHolderUsername}</Text>
          <Text style={styles.holderSub}>Holds the {titleLabel} title</Text>
          {hasTopBid && (
            <View style={styles.holderTopBidRow}>
              <Feather name="trending-up" size={13} color={t.fgBrand} />
              <Text style={styles.holderTopBidText}>
                Top bid: {doc.topBidAmount} credits
              </Text>
              {doc.topBidUsername ? (
                <Text style={styles.holderTopBidBy}>by @{doc.topBidUsername}</Text>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {/* Holder action bar — visible only during freeze window for holder */}
      {isFrozen && isHolder && hasTopBid && (
        <View style={styles.holderActionBar}>
          <Text style={styles.holderActionTitle}>
            Someone bid {doc.topBidAmount} credits for your title
          </Text>
          <Text style={styles.holderActionSub}>
            Accept to transfer the {titleLabel} to @{doc.topBidUsername} and receive the credits.
            Keep to reject the bid and refund them.
          </Text>
          <View style={styles.holderActionBtns}>
            <TouchableOpacity
              style={[styles.holderAcceptBtn, submitting && styles.holderBtnDisabled]}
              onPress={onAccept}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={`Accept bid of ${doc.topBidAmount} credits`}
              accessibilityState={{ disabled: submitting }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="check" size={15} color={t.white} />
              <Text style={styles.holderAcceptBtnText}>Accept bid</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.holderRejectBtn, submitting && styles.holderBtnDisabled]}
              onPress={onReject}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Keep title and reject all bids"
              accessibilityState={{ disabled: submitting }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="shield" size={15} color={t.fgTextStrong} />
              <Text style={styles.holderRejectBtnText}>Keep title</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Frozen state — holder doesn't respond message */}
      {isFrozen && isHolder && !hasTopBid && (
        <View style={styles.holderNoBidsBar}>
          <Feather name="info" size={14} color={t.fgTextSubtle} />
          <Text style={styles.holderNoBidsText}>No bids placed yet this cycle.</Text>
        </View>
      )}

      {/* Settled footer */}
      {(doc.status === 'accepted' || doc.status === 'settled') && (
        <View style={styles.holderSettledBar}>
          <Feather name="check-circle" size={13} color={t.fgSuccess} />
          <Text style={styles.holderSettledText}>
            Title transferred — new cycle begins soon
          </Text>
        </View>
      )}
      {doc.status === 'rejected' && (
        <View style={styles.holderRejectedBar}>
          <Feather name="shield" size={13} color={t.fgBrand} />
          <Text style={styles.holderRejectedText}>
            Holder kept the title — all bids refunded
          </Text>
        </View>
      )}
    </Animated.View>
  );
});

// ── BidRow ───────────────────────────────────────────────────────────────

interface BidRowProps {
  bid: BidDoc;
  isMe: boolean;
  isTopBid: boolean;
}

/** Single row in the bid history list. */
const BidRow = React.memo(function BidRow({ bid, isMe, isTopBid }: BidRowProps) {
  const statusColor =
    bid.status === 'won'
      ? t.fgSuccess
      : bid.status === 'refunded' || bid.status === 'rejected'
      ? t.fgTextSubtle
      : isTopBid
      ? t.fgBrand
      : t.fgTextMuted;

  const rowBg = isMe ? t.bgBrandSubtle : t.bgCard;
  const rowBorder = isTopBid ? t.fgBrand : isMe ? t.fgBrand : t.borderSubtle;

  return (
    <View
      style={[styles.bidRow, { backgroundColor: rowBg, borderColor: rowBorder }]}
      accessibilityRole="text"
      accessibilityLabel={`${isMe ? 'Your bid' : bid.username}: ${bid.amount} credits`}
    >
      <Avatar name={bid.username} size={32} />
      <View style={styles.bidRowInfo}>
        <Text style={[styles.bidRowName, isMe && { color: t.fgBrand }]}>
          {isMe ? 'You' : `@${bid.username}`}
        </Text>
        <Text style={styles.bidRowTime}>
          {new Date(bid.placedAtMs).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </Text>
      </View>
      <View style={styles.bidRowRight}>
        {isTopBid && (
          <View style={styles.topBidPill}>
            <Text style={styles.topBidPillText}>TOP</Text>
          </View>
        )}
        <Feather name="zap" size={12} color={statusColor} />
        <Text style={[styles.bidRowAmount, { color: statusColor }]}>{bid.amount}</Text>
        {bid.status === 'refunded' || bid.status === 'rejected' ? (
          <Text style={styles.bidRowStatusLabel}>refunded</Text>
        ) : bid.status === 'won' ? (
          <Text style={[styles.bidRowStatusLabel, { color: t.fgSuccess }]}>won</Text>
        ) : null}
      </View>
    </View>
  );
});

// ── BidSheet ─────────────────────────────────────────────────────────────────

interface BidSheetProps {
  visible: boolean;
  currentTopBid: number;
  myCredits: number;
  tier: TitleTier;
  scopeLabel: string;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}

/**
 * Bottom sheet for entering and confirming a bid amount.
 * Renders an increment/decrement stepper with real-time validation.
 */
const BidSheet = React.memo(function BidSheet({
  visible,
  currentTopBid,
  myCredits,
  tier,
  scopeLabel,
  onClose,
  onConfirm,
}: BidSheetProps) {
  const minRequired = Math.max(MIN_BID_CREDITS, currentTopBid + BID_INCREMENT_CREDITS);
  const [amount, setAmount] = useState(String(minRequired));
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseInt(amount, 10);
  const isValid =
    !isNaN(parsedAmount) &&
    parsedAmount >= minRequired &&
    parsedAmount <= myCredits;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setAmount(String(minRequired));
      setSubmitting(false);
    }
  }, [visible, minRequired]);

  // Sheet slide-up animation — Reanimated v4
  const sheetTranslateY = useSharedValue(SHEET_TRANSLATE_Y_HIDDEN);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 240 });
      sheetTranslateY.value = withSpring(0, SPRING_GLASS);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      sheetTranslateY.value = withTiming(SHEET_TRANSLATE_Y_HIDDEN, { duration: 220 });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleConfirm = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onConfirm(parsedAmount);
    setSubmitting(false);
  }, [isValid, submitting, parsedAmount, onConfirm]);

  const accent = titleAccentColor(tier);
  const beats = parsedAmount > currentTopBid;
  const canAfford = parsedAmount <= myCredits;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.sheetBackdrop, backdropAnimStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetKAV}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheetContainer, sheetAnimStyle]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Place a Bid</Text>
          <Text style={styles.sheetSub}>
            Win the{' '}
            <Text style={{ color: accent, fontWeight: '700' }}>
              {TITLES[tier]}
            </Text>{' '}
            title of {scopeLabel} for this cycle.
          </Text>

          {/* Rule pills */}
          <View style={styles.rulePillsRow}>
            <View style={[styles.rulePill, { borderColor: accent + ALPHA_19 }]}>
              <Feather name="arrow-up" size={11} color={accent} />
              <Text style={[styles.rulePillText, { color: accent }]}>
                Min {MIN_BID_CREDITS} credits
              </Text>
            </View>
            <View style={[styles.rulePill, { borderColor: accent + ALPHA_19 }]}>
              <Feather name="chevrons-up" size={11} color={accent} />
              <Text style={[styles.rulePillText, { color: accent }]}>
                +{BID_INCREMENT_CREDITS} increment
              </Text>
            </View>
            <View style={[styles.rulePill, { borderColor: accent + ALPHA_19 }]}>
              <Feather name="refresh-cw" size={11} color={accent} />
              <Text style={[styles.rulePillText, { color: accent }]}>Auto-refund if outbid</Text>
            </View>
          </View>

          {/* Current top bid */}
          <View style={styles.currentBidCard}>
            <Text style={styles.currentBidLabel}>Current top bid</Text>
            <View style={styles.currentBidRight}>
              <Feather name="zap" size={15} color={t.fgBrand} />
              <Text style={styles.currentBidAmount}>
                {currentTopBid === 0 ? 'No bids' : `${currentTopBid} credits`}
              </Text>
            </View>
          </View>

          {/* Bid input + stepper */}
          <Text style={styles.bidInputLabel}>
            Your bid (min {minRequired} credits)
          </Text>
          <View style={styles.bidInputRow}>
            <TouchableOpacity
              style={styles.bidStepBtn}
              onPress={() => {
                const cur = parseInt(amount, 10) || minRequired;
                setAmount(String(Math.max(minRequired, cur - BID_INCREMENT_CREDITS)));
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Decrease bid amount"
            >
              <Feather name="minus" size={16} color={t.fgTextStrong} />
            </TouchableOpacity>

            <View style={styles.bidInputWrap}>
              <Feather name="zap" size={14} color={t.fgBrand} />
              <TextInput
                style={styles.bidInputField}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={7}
                selectTextOnFocus
                accessibilityLabel="Bid amount in credits"
                placeholderTextColor={t.fgTextSubtle}
              />
              <Text style={styles.bidInputSuffix}>credits</Text>
            </View>

            <TouchableOpacity
              style={styles.bidStepBtn}
              onPress={() => {
                const cur = parseInt(amount, 10) || minRequired;
                setAmount(String(cur + BID_INCREMENT_CREDITS));
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Increase bid amount"
            >
              <Feather name="plus" size={16} color={t.fgTextStrong} />
            </TouchableOpacity>
          </View>

          {/* Validation hints */}
          {!isNaN(parsedAmount) && (
            <View style={styles.validationRow}>
              <View style={styles.validationItem}>
                <Feather
                  name={beats ? 'check-circle' : 'x-circle'}
                  size={13}
                  color={beats ? t.fgSuccess : t.fgDanger}
                />
                <Text style={[styles.validationText, { color: beats ? t.fgSuccess : t.fgDanger }]}>
                  {beats ? 'Beats current top bid' : `Must exceed ${currentTopBid} credits`}
                </Text>
              </View>
              <View style={styles.validationItem}>
                <Feather
                  name={canAfford ? 'check-circle' : 'x-circle'}
                  size={13}
                  color={canAfford ? t.fgSuccess : t.fgDanger}
                />
                <Text style={[styles.validationText, { color: canAfford ? t.fgSuccess : t.fgDanger }]}>
                  {canAfford
                    ? `You have ${myCredits} credits`
                    : `Need ${parsedAmount - myCredits} more credits`}
                </Text>
              </View>
            </View>
          )}

          {/* Escrow note */}
          <View style={styles.escrowNote}>
            <Feather name="lock" size={12} color={t.fgTextSubtle} />
            <Text style={styles.escrowNoteText}>
              Credits held in escrow — automatically refunded if you're outbid or boli ends
            </Text>
          </View>

          {/* Confirm CTA */}
          <TouchableOpacity
            style={[
              styles.sheetConfirmBtn,
              { backgroundColor: accent },
              (!isValid || submitting) && styles.sheetConfirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValid || submitting}
            accessibilityRole="button"
            accessibilityLabel={`Confirm bid of ${isNaN(parsedAmount) ? 'unknown' : parsedAmount} credits`}
            accessibilityState={{ disabled: !isValid || submitting }}
          >
            {submitting ? (
              <Feather name="loader" size={18} color={t.white} />
            ) : (
              <>
                <Feather name="award" size={16} color={t.white} />
                <Text style={styles.sheetConfirmBtnText}>
                  Bid {isNaN(parsedAmount) ? '—' : parsedAmount} credits
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 8 }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
});

// ── HowItWorksCard ────────────────────────────────────────────────────────

interface HowItWorksCardProps {
  tier: TitleTier;
  scopeLabel: string;
}

/** Static explainer card for the Boli mechanic. */
const HowItWorksCard = React.memo(function HowItWorksCard({
  tier,
  scopeLabel,
}: HowItWorksCardProps) {
  const accent = titleAccentColor(tier);
  const steps: Array<{ num: string; text: string }> = [
    {
      num: '1',
      text: `Every 5 hours, the cycle freezes and the Boli window opens for 30 minutes.`,
    },
    {
      num: '2',
      text: `Place a bid of at least ${MIN_BID_CREDITS} credits — must beat the current top bid.`,
    },
    {
      num: '3',
      text: `The current ${TITLES[tier]} of ${scopeLabel} chooses to Accept (transfer title) or Keep (reject bids).`,
    },
    {
      num: '4',
      text: `If accepted, the top bidder becomes the new title holder. If rejected or no response, all bids are refunded.`,
    },
  ];

  return (
    <View style={styles.howCard}>
      <Text style={styles.howCardTitle}>How Boli works</Text>
      {steps.map((step, idx) => (
        <View
          key={step.num}
          style={[styles.howStep, idx === steps.length - 1 && { borderBottomWidth: 0 }]}
        >
          <View style={[styles.howStepBadge, { backgroundColor: accent + ALPHA_10 }]}>
            <Text style={[styles.howStepBadgeText, { color: accent }]}>{step.num}</Text>
          </View>
          <Text style={styles.howStepText}>{step.text}</Text>
        </View>
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BoliScreen (app/spotlight/index.tsx)
 *
 * Renders the 5-hour cycle auction (Boli) mechanic for title competition.
 * Provides:
 *   - Live cycle countdown (CycleCountdown)
 *   - Title holder card with accept/reject controls during freeze window
 *   - Bid placement sheet with escrow confirmation
 *   - Scrollable bid history
 *   - Sticky CTA bar (hidden when keyboard or Glass Island overlaps)
 *
 * @see CYCLE in constants/titles.ts for timing constants
 */
export default function BoliScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const myUid = firebaseUser?.uid ?? '';
  const myUsername = user?.username ?? 'You';
  const myCredits = user?.credits ?? 0;

  // City shard — default to user's registered city, fall back to 'chandigarh'
  const cityId = user?.cityId ?? 'chandigarh';
  /** Display label for the user's home city — drives BoliDoc.scopeLabel */
  const cityLabel = user?.cityLabel ?? 'Chandigarh';

  // Title tier — default CITY for the spotlight/boli screen
  const tier: TitleTier = 'CITY';

  // ── State ───────────────────────────────────────────────────────────────
  const [cycleId, setCycleId] = useState(() => currentCycleId());
  const [boliDocState, setBoliDocState] = useState<AsyncState<BoliDoc>>({
    status: 'loading',
  });
  const [bids, setBids] = useState<BidDoc[]>([]);
  const [phase, setPhase] = useState<CyclePhase>({
    kind: 'active',
    msLeft: currentCycleEndsAt() - Date.now(),
    label: 'Next freeze in',
  });
  const [showBidSheet, setShowBidSheet] = useState(false);
  const [walletVisible, setWalletVisible] = useState(false);
  const [holderSubmitting, setHolderSubmitting] = useState(false);

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init / Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = currentCycleId();
    setCycleId(id);

    getOrCreateBoliDoc(cityId, id, tier, cityLabel)
      .then((doc) => setBoliDocState({ status: 'success', data: doc }))
      .catch((e: unknown) =>
        setBoliDocState({
          status: 'error',
          message: e instanceof Error ? e.message : 'Failed to load Boli',
        }),
      );
  }, [cityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live BoliDoc subscription ────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeBoliDoc(cityId, cycleId, (doc) => {
      if (doc) {
        setBoliDocState({ status: 'success', data: doc });
      }
    });
    return unsub;
  }, [cityId, cycleId]);

  // ── Live bids subscription ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeBids(cityId, cycleId, setBids);
    return unsub;
  }, [cityId, cycleId]);

  // ── Countdown tick ───────────────────────────────────────────────────────
  useEffect(() => {
    const boliDoc =
      boliDocState.status === 'success' ? boliDocState.data : null;

    const tick = (): void => {
      const derived = deriveCyclePhase(boliDoc);
      setPhase(derived);

      // Cycle rolled over — reload
      if (derived.kind === 'active' && derived.msLeft === 0) {
        const newId = currentCycleId();
        if (newId !== cycleId) {
          setCycleId(newId);
          setBoliDocState({ status: 'loading' });
          getOrCreateBoliDoc(cityId, newId, tier, cityLabel)
            .then((doc) => setBoliDocState({ status: 'success', data: doc }))
            .catch(() =>
              setBoliDocState({ status: 'error', message: 'Failed to load next cycle' }),
            );
        }
      }
    };

    tick();
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(tick, 1_000);
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [boliDocState, cycleId, cityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ────────────────────────────────────────────────────────
  const boliDoc =
    boliDocState.status === 'success' ? boliDocState.data : null;
  const currentTopBid = boliDoc?.topBidAmount ?? 0;
  const isMyTopBid = boliDoc?.topBidUid === myUid;
  const isFrozen = boliDoc?.status === 'frozen';
  const isSettled =
    boliDoc?.status === 'accepted' ||
    boliDoc?.status === 'rejected' ||
    boliDoc?.status === 'settled';
  const canBid = !isSettled && !!myUid;
  const accent = titleAccentColor(tier);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePlaceBid = useCallback(
    async (amount: number) => {
      if (!myUid) {
        Alert.alert('Sign in required', 'Please sign in to place a bid.');
        setShowBidSheet(false);
        return;
      }

      const result = await placeBid({
        cityId,
        cycleId,
        uid: myUid,
        username: myUsername,
        amount,
      });

      setShowBidSheet(false);

      if (!result.success) {
        Alert.alert('Bid failed', result.reason);
      } else {
        Alert.alert(
          'Bid placed!',
          `You're now the top bidder with ${amount} credits. ${amount} credits held in escrow.`,
          [{ text: 'OK' }],
        );
      }
    },
    [cityId, cycleId, myUid, myUsername],
  );

  const handleAcceptBid = useCallback(async () => {
    if (!myUid || !boliDoc?.topBidAmount) return;
    Alert.alert(
      'Accept bid?',
      `Transfer the ${TITLES[tier]} title to @${boliDoc.topBidUsername} and receive ${boliDoc.topBidAmount} credits?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            setHolderSubmitting(true);
            const result = await acceptTopBid({ cityId, cycleId, holderUid: myUid });
            setHolderSubmitting(false);
            if (!result.success) {
              Alert.alert('Error', result.reason);
            }
          },
        },
      ],
    );
  }, [myUid, boliDoc, cityId, cycleId, tier]);

  const handleRejectBids = useCallback(async () => {
    if (!myUid) return;
    Alert.alert(
      'Keep title?',
      'Reject all bids and keep your title. All bidders will be refunded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep title',
          style: 'destructive',
          onPress: async () => {
            setHolderSubmitting(true);
            const result = await rejectAllBids({ cityId, cycleId, holderUid: myUid });
            setHolderSubmitting(false);
            if (!result.success) {
              Alert.alert('Error', result.reason);
            }
          },
        },
      ],
    );
  }, [myUid, cityId, cycleId]);

  // ── CTA label ─────────────────────────────────────────────────────────────
  const ctaLabel = useMemo(() => {
    if (isSettled) return `Cycle settled — ${TITLES[tier]} title assigned`;
    if (isFrozen && isMyTopBid) return `Your bid is winning — ${currentTopBid} credits`;
    if (isFrozen) return currentTopBid > 0 ? `Outbid ${currentTopBid} to win title` : `Be first to bid`;
    if (isMyTopBid) return `You're leading with ${currentTopBid} credits`;
    return currentTopBid > 0
      ? `Bid more than ${currentTopBid} credits to lead`
      : `Place first bid — min ${MIN_BID_CREDITS} credits`;
  }, [isSettled, isFrozen, isMyTopBid, currentTopBid, tier]);

  // ── Render loading / error ────────────────────────────────────────────────
  if (boliDocState.status === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingSkeleton} />
        <View style={[styles.loadingSkeleton, { width: '70%', marginTop: 8 }]} />
        <Text style={styles.loadingLabel}>Loading Boli…</Text>
      </View>
    );
  }

  if (boliDocState.status === 'error') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar barStyle="dark-content" />
        <Feather name="alert-circle" size={32} color={t.fgDanger} />
        <Text style={styles.errorText}>{boliDocState.message}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setBoliDocState({ status: 'loading' });
            getOrCreateBoliDoc(cityId, cycleId, tier, cityLabel)
              .then((doc) => setBoliDocState({ status: 'success', data: doc }))
              .catch(() => setBoliDocState({ status: 'error', message: 'Try again' }));
          }}
          accessibilityRole="button"
          accessibilityLabel="Retry loading Boli"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader
        title="Boli"
        onBack={() => router.back()}
        right={
          <CreditPill count={myCredits} onPress={() => setWalletVisible(true)} />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + SCROLL_BOTTOM_EXTRA },
        ]}
      >
        {/* ── Hero section ───────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: accent + ALPHA_10 }]}>
              <Feather name="zap" size={11} color={accent} />
              <Text style={[styles.heroBadgeText, { color: accent }]}>
                {isFrozen ? 'BOLI OPEN' : '5-HOUR CYCLE'}
              </Text>
            </View>
            <View style={styles.heroCycleId}>
              <Text style={styles.heroCycleIdText}>{cycleId}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            {isFrozen ? 'Boli is open!' : `Compete for ${TITLES[tier]}`}
          </Text>
          <Text style={styles.heroSub}>
            {isFrozen
              ? `${boliDoc?.titleHolderUsername ?? 'The holder'} can accept or reject the top bid in the next window.`
              : `Every 5 hours, the cycle freezes and the Boli auction window opens for 30 minutes.`}
          </Text>

          <CycleCountdown phase={phase} tier={tier} />
        </View>

        {/* ── Title holder card ──────────────────────────────────── */}
        {boliDocState.status === 'success' && (
          <TitleHolderCard
            doc={boliDoc}
            myUid={myUid}
            onAccept={handleAcceptBid}
            onReject={handleRejectBids}
            submitting={holderSubmitting}
          />
        )}

        {/* ── My bid winning banner ────────────────────────────────── */}
        {isMyTopBid && !isSettled && (
          <View style={styles.winningBanner}>
            <Feather name="trending-up" size={16} color={t.fgBrand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.winningBannerTitle}>You're the top bidder!</Text>
              <Text style={styles.winningBannerSub}>
                {isFrozen
                  ? `Waiting for the holder to decide. ${currentTopBid} credits in escrow.`
                  : `Stay ahead — others can outbid you before the cycle freezes.`}
              </Text>
            </View>
          </View>
        )}

        {/* ── How Boli works ───────────────────────────────────────── */}
        <HowItWorksCard tier={tier} scopeLabel={boliDoc?.scopeLabel ?? cityLabel} />

        {/* ── Bid history ──────────────────────────────────────────── */}
        {bids.length > 0 && (
          <View style={styles.bidsSection}>
            <Text style={styles.bidsSectionLabel}>
              BIDS THIS CYCLE · {bids.length}
            </Text>
            {bids.map((bid) => (
              <BidRow
                key={bid.uid}
                bid={bid}
                isMe={bid.uid === myUid}
                isTopBid={bid.uid === boliDoc?.topBidUid}
              />
            ))}
          </View>
        )}

        {/* ── Empty bids ────────────────────────────────────────────── */}
        {bids.length === 0 && !isSettled && (
          <View style={styles.emptyBids}>
            <Feather name="inbox" size={24} color={t.fgTextSubtle} />
            <Text style={styles.emptyBidsText}>No bids yet this cycle.</Text>
            <Text style={styles.emptyBidsSub}>
              Be the first to bid for {TITLES[tier]}!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky CTA bar ────────────────────────────────────────── */}
      <View
        style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, CTA_BAR_MIN_SAFE_PADDING) + 4 }]}
      >
        {isSettled ? (
          <View style={styles.ctaSettled}>
            <Feather name="check-circle" size={16} color={t.fgSuccess} />
            <Text style={styles.ctaSettledText}>{ctaLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              { backgroundColor: accent },
              isMyTopBid && styles.ctaBtnWinning,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setShowBidSheet(true);
            }}
            disabled={!canBid}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isMyTopBid ? 'Raise your bid' : 'Place a bid'}
            accessibilityState={{ disabled: !canBid }}
          >
            <Feather
              name={isMyTopBid ? 'trending-up' : 'award'}
              size={17}
              color={t.white}
            />
            <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bid sheet overlay ───────────────────────────────────────── */}
      <BidSheet
        visible={showBidSheet}
        currentTopBid={currentTopBid}
        myCredits={myCredits}
        tier={tier}
        scopeLabel={boliDoc?.scopeLabel ?? cityLabel}
        onClose={() => setShowBidSheet(false)}
        onConfirm={handlePlaceBid}
      />

      {/* ── Wallet drawer ───────────────────────────────────────────── */}
      <WalletDrawer
        visible={walletVisible}
        onClose={() => setWalletVisible(false)}
        credits={myCredits}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — all values from design tokens, zero hardcoded hex or magic numbers
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  screen: {
    flex: 1,
    backgroundColor: t.bgSurface,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.md,
  },
  scrollContent: {
    paddingHorizontal: sp.md,
    paddingTop: sp.sm,
    gap: sp.md,
  },

  // Loading
  loadingSkeleton: {
    height: 16,
    width: '85%',
    borderRadius: r.chip,
    backgroundColor: t.bgCardElevated,
  },
  loadingLabel: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    fontWeight: '500',
  },

  // Error
  errorText: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.body,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: sp.xl,
  },
  retryBtn: {
    paddingHorizontal: sp.xl,
    paddingVertical: sp.md,
    borderRadius: r.button,
    backgroundColor: t.fgBrand,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: t.white,
    fontSize: FONT_SIZE.body,
    fontWeight: '700',
  },

  // Hero section
  heroSection: {
    backgroundColor: t.bgCard,
    borderRadius: r.modal,
    borderWidth: 1,
    borderColor: t.borderSubtle,
    padding: sp.xl,
    alignItems: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: sp.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: 4,
    borderRadius: r.pill,
  },
  heroBadgeText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroCycleId: {
    backgroundColor: t.bgCardElevated,
    paddingHorizontal: sp.sm,
    paddingVertical: 3,
    borderRadius: r.chip,
  },
  heroCycleIdText: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.micro,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  heroTitle: {
    color: t.fgTextStrong,
    fontSize: HERO_TITLE_FONT_SIZE,
    fontWeight: '800',
    fontFamily: FONT_FAMILY.displayBold,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: sp.xs,
  },
  heroSub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: sp.lg,
    paddingHorizontal: sp.sm,
  },

  // Countdown ring
  countdownWrap: {
    alignItems: 'center',
    gap: sp.sm,
  },
  countdownRingOuter: {
    width: COUNTDOWN_RING_SIZE,
    height: COUNTDOWN_RING_SIZE,
    borderRadius: COUNTDOWN_RING_SIZE / 2,
    borderWidth: COUNTDOWN_RING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.bgCardElevated,
  },
  countdownRingInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
  },
  countdownTime: {
    fontSize: COUNTDOWN_FONT_SIZE,
    fontWeight: '700',
    fontFamily: FONT_FAMILY.monoNum,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.micro,
    fontWeight: '500',
    textAlign: 'center',
  },
  boliOpenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    backgroundColor: t.fgBrand,
    paddingHorizontal: sp.md,
    paddingVertical: 4,
    borderRadius: r.pill,
  },
  boliOpenText: {
    color: t.white,
    fontSize: FONT_SIZE.micro,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Title holder card
  holderCard: {
    backgroundColor: t.bgCard,
    borderRadius: r.modal,
    borderWidth: 1,
    borderColor: t.borderSubtle,
    overflow: 'hidden',
  },
  holderEmpty: {
    alignItems: 'center',
    padding: sp.xxl,
    gap: sp.sm,
  },
  holderEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: r.button,
    borderWidth: 2,
    backgroundColor: t.bgCardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.xs,
  },
  holderEmptyTitle: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.headline,
    fontWeight: '700',
    fontFamily: FONT_FAMILY.displayBold,
  },
  holderEmptySub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    textAlign: 'center',
    lineHeight: 19,
  },
  holderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingTop: sp.md,
    paddingBottom: sp.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.borderSubtle,
  },
  holderCrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  holderCrownLabel: {
    fontSize: FONT_SIZE.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  scopePill: {
    borderWidth: 1,
    paddingHorizontal: sp.sm,
    paddingVertical: 3,
    borderRadius: r.pill,
  },
  scopePillText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: '600',
  },
  holderBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    padding: sp.md,
  },
  holderAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  holderTitleBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
  },
  holderInfo: { flex: 1 },
  holderName: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.headline,
    fontWeight: '700',
    fontFamily: FONT_FAMILY.displayBold,
    letterSpacing: -0.2,
    marginBottom: sp.xs,
  },
  holderSub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    marginBottom: sp.sm,
  },
  holderTopBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    flexWrap: 'wrap',
  },
  holderTopBidText: {
    color: t.fgBrand,
    fontSize: FONT_SIZE.label,
    fontWeight: '700',
  },
  holderTopBidBy: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.caption,
    fontWeight: '500',
  },
  holderActionBar: {
    backgroundColor: t.bgBrandSubtle,
    padding: sp.md,
    gap: sp.sm,
    borderTopWidth: 1,
    borderTopColor: t.borderSubtle,
  },
  holderActionTitle: {
    color: t.fgBrand,
    fontSize: FONT_SIZE.body,
    fontWeight: '700',
  },
  holderActionSub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    lineHeight: 18,
  },
  holderActionBtns: {
    flexDirection: 'row',
    gap: sp.sm,
    marginTop: sp.xs,
  },
  holderAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    height: 44,
    borderRadius: r.button,
    backgroundColor: t.fgSuccess,
    minWidth: 44,
  },
  holderRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    height: 44,
    borderRadius: r.button,
    backgroundColor: t.bgCardElevated,
    borderWidth: 1,
    borderColor: t.borderStrong,
    minWidth: 44,
  },
  holderBtnDisabled: {
    opacity: 0.5,
  },
  holderAcceptBtnText: {
    color: t.white,
    fontSize: FONT_SIZE.body,
    fontWeight: '700',
  },
  holderRejectBtnText: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.body,
    fontWeight: '600',
  },
  holderNoBidsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    padding: sp.md,
    backgroundColor: t.bgCardElevated,
    borderTopWidth: 1,
    borderTopColor: t.borderSubtle,
  },
  holderNoBidsText: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.bodySmall,
  },
  holderSettledBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    padding: sp.md,
    backgroundColor: t.bgSuccessSubtle,
    borderTopWidth: 1,
    borderTopColor: t.borderSubtle,
  },
  holderSettledText: {
    color: t.fgSuccess,
    fontSize: FONT_SIZE.bodySmall,
    fontWeight: '600',
  },
  holderRejectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    padding: sp.md,
    backgroundColor: t.bgBrandSubtle,
    borderTopWidth: 1,
    borderTopColor: t.borderSubtle,
  },
  holderRejectedText: {
    color: t.fgBrand,
    fontSize: FONT_SIZE.bodySmall,
    fontWeight: '600',
  },

  // Winning banner
  winningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.sm,
    backgroundColor: t.bgBrandSubtle,
    borderRadius: r.button,
    padding: sp.md,
    borderWidth: 1,
    borderColor: t.borderSubtle,
  },
  winningBannerTitle: {
    color: t.fgBrand,
    fontSize: FONT_SIZE.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  winningBannerSub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    lineHeight: 17,
  },

  // How it works
  howCard: {
    backgroundColor: t.bgCard,
    borderRadius: r.button,
    borderWidth: 1,
    borderColor: t.borderSubtle,
    padding: sp.md,
  },
  howCardTitle: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.body,
    fontWeight: '700',
    marginBottom: sp.md,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.borderSubtle,
  },
  howStepBadge: {
    width: HOW_STEP_BADGE_SIZE,
    height: HOW_STEP_BADGE_SIZE,
    borderRadius: HOW_STEP_BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  howStepBadgeText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: '700',
  },
  howStepText: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    lineHeight: 19,
    flex: 1,
  },

  // Bids section
  bidsSection: {
    gap: sp.xs,
  },
  bidsSectionLabel: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.micro,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: sp.sm,
  },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: r.button,
    borderWidth: 1,
    marginBottom: 4,
    minHeight: 48,
  },
  bidRowInfo: { flex: 1 },
  bidRowName: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.body,
    fontWeight: '600',
  },
  bidRowTime: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.micro,
    fontWeight: '500',
    marginTop: 2,
  },
  bidRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  topBidPill: {
    backgroundColor: t.fgBrand,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: r.chip,
    marginRight: 4,
  },
  topBidPillText: {
    color: t.white,
    fontSize: FONT_SIZE.micro,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  bidRowAmount: {
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bidRowStatusLabel: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.caption,
    fontWeight: '500',
    marginLeft: 2,
  },

  // Empty bids
  emptyBids: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    paddingVertical: sp.xxl,
    backgroundColor: t.bgCard,
    borderRadius: r.button,
    borderWidth: 1,
    borderColor: t.borderSubtle,
  },
  emptyBidsText: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.body,
    fontWeight: '600',
  },
  emptyBidsSub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
  },

  // CTA bar
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: sp.md,
    paddingTop: sp.md,
    backgroundColor: t.bgSurface,
    borderTopWidth: 1,
    borderTopColor: t.borderSubtle,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    height: CTA_BAR_HEIGHT,
    borderRadius: RADIUS_PILL_BTN,
    ...t.shadow.lg,
    minHeight: 44,
  },
  ctaBtnWinning: {
    backgroundColor: t.fgSuccess,
  },
  ctaBtnText: {
    color: t.white,
    fontSize: FONT_SIZE.body,
    fontWeight: '700',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  ctaSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    height: CTA_BAR_HEIGHT,
    borderRadius: RADIUS_PILL_BTN,
    backgroundColor: t.bgCardElevated,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  ctaSettledText: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    fontWeight: '600',
  },

  // Bid sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.scrim,
  },
  sheetKAV: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: t.bgCard,
    borderTopLeftRadius: r.modal,
    borderTopRightRadius: r.modal,
    paddingHorizontal: sp.xl,
    paddingTop: sp.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: r.chip,
    backgroundColor: t.borderStrong,
    alignSelf: 'center',
    marginBottom: sp.xl,
  },
  sheetTitle: {
    color: t.fgTextStrong,
    fontSize: FONT_SIZE.title,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: sp.xs,
  },
  sheetSub: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    lineHeight: 19,
    marginBottom: sp.md,
  },
  rulePillsRow: {
    flexDirection: 'row',
    gap: sp.sm,
    marginBottom: sp.md,
    flexWrap: 'wrap',
  },
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    borderWidth: 1,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderRadius: r.pill,
  },
  rulePillText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: '600',
  },
  currentBidCard: {
    backgroundColor: t.bgCardElevated,
    borderRadius: r.button,
    padding: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.md,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  currentBidLabel: {
    color: t.fgTextMuted,
    fontSize: FONT_SIZE.bodySmall,
    fontWeight: '500',
  },
  currentBidRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  currentBidAmount: {
    color: t.fgBrand,
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bidInputLabel: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.caption,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: sp.sm,
  },
  bidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginBottom: sp.md,
  },
  bidStepBtn: {
    width: 44,
    height: 44,
    borderRadius: r.button,
    backgroundColor: t.bgCardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  bidInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bgCardElevated,
    borderRadius: r.button,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingHorizontal: sp.md,
    height: 48,
    gap: sp.sm,
  },
  bidInputField: {
    flex: 1,
    color: t.fgTextStrong,
    fontSize: BID_INPUT_FONT_SIZE,
    fontWeight: '700',
    fontFamily: FONT_FAMILY.monoNum,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  bidInputSuffix: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.bodySmall,
    fontWeight: '500',
  },
  validationRow: {
    gap: sp.sm,
    marginBottom: sp.sm,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  validationText: {
    fontSize: FONT_SIZE.label,
    fontWeight: '500',
  },
  escrowNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.sm,
    marginBottom: sp.md,
    paddingHorizontal: 2,
  },
  escrowNoteText: {
    color: t.fgTextSubtle,
    fontSize: FONT_SIZE.caption,
    lineHeight: 16,
    flex: 1,
  },
  sheetConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    height: CTA_BAR_HEIGHT,
    borderRadius: RADIUS_PILL_BTN,
    marginBottom: sp.md,
    ...t.shadow.md,
    minHeight: 44,
  },
  sheetConfirmBtnDisabled: {
    backgroundColor: t.bgCardElevated,
    shadowOpacity: 0,
    elevation: 0,
  },
  sheetConfirmBtnText: {
    color: t.white,
    fontSize: FONT_SIZE.bodyLarge,
    fontWeight: '700',
  },
});

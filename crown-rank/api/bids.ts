/**
 * @file crown-rank/api/bids.ts
 * @module CROWN — Bids API Layer
 * @description Firestore listeners + writes for the BOLI auction bid lifecycle.
 *   Implements PRD §9 (BOLI Auction) and §10 (Bid History Feed).
 *
 * Uses the @react-native-firebase NAMESPACED API. `snap.exists` is a boolean
 * PROPERTY. Server-side Cloud Functions own settlement, refunds and the
 * authoritative `highest_bid`; the client only places / raises / withdraws bids
 * and reads its own bid mirror at /users/{uid}/bids.
 *
 * @security Firestore rule: a user may only read/write bids where bidder_id == uid.
 */

import { firestore, serverTimestamp } from '@/lib/firebase';
import type { BidRecord, BidStatus, Tier } from '../types';

type FsTimestamp = { toMillis: () => number; toDate: () => Date };
type DocumentData = Record<string, any>;
export type Unsubscribe = () => void;

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

/** Convert a Firestore Timestamp / millis / ISO string to an ISO string (or null). */
function toIso(val: FsTimestamp | number | string | null | undefined): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (typeof (val as FsTimestamp).toDate === 'function') {
    return (val as FsTimestamp).toDate().toISOString();
  }
  return null;
}

const VALID_STATUSES: readonly BidStatus[] = [
  'active_winning',
  'active_outbid',
  'settled_won',
  'settled_seller_kept',
  'settled_outbid_refunded',
  'settled_expired',
];

function normalizeStatus(raw: unknown): BidStatus {
  return VALID_STATUSES.includes(raw as BidStatus)
    ? (raw as BidStatus)
    : 'active_winning';
}

/** Seconds until a future ISO/ms timestamp, clamped to ≥ 0, or null. */
function secondsUntil(val: FsTimestamp | number | string | null | undefined): number | null {
  const iso = toIso(val);
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / 1000));
}

function mapBidRecord(id: string, r: DocumentData): BidRecord {
  return {
    bidId: id,
    tier: (r.tier ?? 'baron') as Tier,
    geographyId: r.geography_id ?? '',
    geographyLabel: r.geography_label ?? '',
    cycleId: r.cycle_id ?? '',
    amount: r.amount ?? 0,
    status: normalizeStatus(r.status),
    currentHighBid: r.current_high_bid ?? null,
    outbidBy: r.outbid_by ?? null,
    placedAt: toIso(r.placed_at) ?? new Date().toISOString(),
    settledAt: toIso(r.settled_at),
    auctionEndsIn: secondsUntil(r.auction_ends_at),
  };
}

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTION: User Bid History (§10 — real-time feed)
// ──────────────────────────────────────────────────────────────

/**
 * Subscribes to the authenticated user's bid history, newest first.
 * Reads the per-user mirror at /users/{uid}/bids maintained by Cloud Functions.
 */
export function subscribeToUserBids(
  userId: string,
  onUpdate: (bids: BidRecord[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const ref = firestore()
    .collection('users')
    .doc(userId)
    .collection('bids')
    .orderBy('placed_at', 'desc')
    .limit(50);

  return ref.onSnapshot(
    (snap) => {
      const bids = snap.docs.map((d) => mapBidRecord(d.id, d.data() ?? {}));
      onUpdate(bids);
    },
    (err: Error) => onError(new Error(err.message)),
  );
}

// ──────────────────────────────────────────────────────────────
// WRITE: Place a new bid in the active BOLI auction (§9.2)
// ──────────────────────────────────────────────────────────────

export interface PlaceBidParams {
  userId: string;
  userHandle: string;
  userTrustScore: number;
  tier: Tier;
  geographyId: string;
  geographyLabel: string;
  cycleId: string;
  amount: number;
}

export interface PlaceBidResult {
  bidId: string;
}

/**
 * Places a bid into the cycle's auction bids collection. A Cloud Function
 * validates the amount against the current high bid, holds the user's credits,
 * and updates the authoritative `highest_bid`.
 *
 * Path: /cycles/{tier}/geos/{geographyId}/bids/{autoId}
 */
export async function placeBid(params: PlaceBidParams): Promise<PlaceBidResult> {
  const {
    userId,
    userHandle,
    userTrustScore,
    tier,
    geographyId,
    geographyLabel,
    cycleId,
    amount,
  } = params;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid-bid-amount');
  }

  const bidsCol = firestore()
    .collection('cycles')
    .doc(tier)
    .collection('geos')
    .doc(geographyId)
    .collection('bids');

  const docRef = bidsCol.doc();

  await docRef.set({
    bidder_id: userId,
    bidder_handle: userHandle,
    bidder_trust_score: userTrustScore,
    tier,
    geography_id: geographyId,
    geography_label: geographyLabel,
    cycle_id: cycleId,
    amount,
    status: 'active_winning',
    placed_at: serverTimestamp(),
    withdrawn: false,
  });

  return { bidId: docRef.id };
}

// ──────────────────────────────────────────────────────────────
// WRITE: Raise an existing bid (§9.3 — outbid recovery)
// ──────────────────────────────────────────────────────────────

export interface RaiseBidParams {
  tier: Tier;
  geographyId: string;
  bidId: string;
  newAmount: number;
}

/**
 * Raises the amount on an existing active bid. A Cloud Function re-validates
 * against the live high bid and adjusts the credit hold.
 */
export async function raiseBid(params: RaiseBidParams): Promise<void> {
  const { tier, geographyId, bidId, newAmount } = params;
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    throw new Error('invalid-bid-amount');
  }

  await firestore()
    .collection('cycles')
    .doc(tier)
    .collection('geos')
    .doc(geographyId)
    .collection('bids')
    .doc(bidId)
    .update({
      amount: newAmount,
      status: 'active_winning',
      raised_at: serverTimestamp(),
    });
}

// ──────────────────────────────────────────────────────────────
// WRITE: Withdraw an active bid (§9.4)
// ──────────────────────────────────────────────────────────────

export interface WithdrawBidParams {
  tier: Tier;
  geographyId: string;
  bidId: string;
}

/**
 * Withdraws an active bid. A Cloud Function releases the held credits and
 * recomputes the high bid. The doc is flagged rather than deleted so the
 * user keeps an auditable history row.
 */
export async function withdrawBid(params: WithdrawBidParams): Promise<void> {
  const { tier, geographyId, bidId } = params;

  await firestore()
    .collection('cycles')
    .doc(tier)
    .collection('geos')
    .doc(geographyId)
    .collection('bids')
    .doc(bidId)
    .update({
      withdrawn: true,
      withdrawn_at: serverTimestamp(),
    });
}

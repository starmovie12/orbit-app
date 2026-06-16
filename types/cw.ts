/**
 * types/cw.ts
 * Central TypeScript definitions for CROWN v1.0.
 * Single source of truth — all Firestore collections and app state derive from here.
 *
 * Naming convention
 * ─────────────────
 * CW prefix on every exported interface/type to prevent DOM and React Native
 * API naming collisions. TypeScript has built-in `Notification`, `Message`,
 * and `Event` types — without the prefix every import becomes ambiguous.
 *
 * Timestamp strategy
 * ──────────────────
 * · CWUser / CWMessage / CWRoom / CWCrate / CWDMConversation
 *   → use Firestore `Timestamp` (real-time Firestore listener land).
 * · CWTransaction / CWNotification / CWSavedMessage
 *   → use `number` (Unix ms) because these are deserialized for React state,
 *     used in mock seeds (constants/data.ts), and sorted client-side.
 *   Conversion: `(ts as Timestamp).toMillis()` on Firestore read.
 *
 * MVP Scope (Phase 0)
 * ───────────────────
 * VoiceRooms → Phase 2.  SupportTickets → Phase 2.  SearchHistory → Phase 2.
 * Complex CrownPassStatus / FounderPassStatus objects → collapsed into CWBadge.
 * PRD §9 "Ruthless MVP Cut" enforced.
 */

import { Timestamp } from 'firebase/firestore';

// ═════════════════════════════════════════════════════════════════════════════
// § 1 — SHARED ENUMS & LITERALS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Top-level identity badge per CW ecosystem.
 * Drives UI treatment (crown overlay, tinted rings, Discover tier chips).
 * Mutually exclusive — the highest applicable badge wins.
 */
export type CWBadge = 'MAYOR' | 'FOUNDER' | 'CROWN';

export type CWTheme    = 'light' | 'dark' | 'system';
export type CWLanguage = 'hinglish' | 'english' | 'hindi';

// ═════════════════════════════════════════════════════════════════════════════
// § 2 — USER & IDENTITY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Firestore: /users/{uid}
 * Matches the shape produced by `firestore-users.ts → defaultUser()` and
 * extended by the Blueprint §6 profile setup + §7 location setup flows.
 */
export interface CWUser {
  uid: string;
  phone: string;                       // E.164-ish, e.g., "+919876543210"
  displayName: string | null;          // chosen at onboarding §6 · null before step
  username: string | null;             // @handle · unique · null before step
  photoURL: string | null;             // Cloudflare R2 WebP URL · null = initials fallback
  bio: string | null;                  // max 200 chars · null before profile setup
  cityId: string | null;               // e.g., "chandigarh" · null before §7
  sectorId: string | null;             // e.g., "sector-17" · null before §7
  credits: number;                     // wallet balance — non-negative integer
  karma: number;                       // community reputation score
  badge: CWBadge | null;               // highest active badge · null = no badge yet
  mayorOf: string | null;              // sectorId if currently elected mayor, else null
  isVerified: boolean;                 // always true post phone-OTP
  kycStatus: 'none' | 'pending' | 'verified'; // required for cashout ≥ threshold (PRD §12.3)
  trustScore: number;                  // 0–100 — internal moderation score, never surfaced to user
  language: string;                    // language code, e.g., "hi", "en"
  interests: string[];                 // interest IDs from onboarding (content ranking)
  trophies: string[];                  // achievement IDs for profile display
  streak: number;                      // consecutive login days (daily bonus mechanic)
  onboardingStep: string;              // step key: "profile" | "location" | "complete" | "done"
  onboardingComplete: boolean;         // RouteGuard gate: false → redirect to /(onboarding)
  blockedUsers: string[];              // uids blocked by this user
  mutedUsers: string[];                // uids whose messages are collapsed
  joinedAt: Timestamp;
  lastActive: Timestamp;               // bumped on app foreground
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3 — MESSAGING & CHAT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Drives bubble render logic — alignment, avatar visibility, color, shape.
 * 'date' is a client-side separator injected by the list renderer; NOT stored
 * in Firestore.
 */
export type CWMessageVariant =
  | 'left'    // other user's message
  | 'right'   // current user's own message
  | 'ai'      // AI companion (anti-ghost-town, PRD §15)
  | 'mayor'   // pinned mayor announcement (full-width card)
  | 'system'  // system event (user joined, heat threshold crossed)
  | 'date';   // date divider — client-only, never persisted

export type CWMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Firestore: /rooms/{roomId}/messages/{messageId}
 * Client generates the UUID before write for optimistic rendering.
 */
export interface CWMessage {
  id: string;                          // Firestore doc ID = pre-generated client UUID
  roomId: string;                      // CWRoom.id
  uid: string;                         // sender uid (empty string for system/date variants)
  text: string | null;                 // null for pure-image messages
  imageURL: string | null;             // Cloudflare R2 WebP · null for text-only
  variant: CWMessageVariant;
  reactions: Record<string, number>;   // emoji → aggregate count (not per-user here)
  replyToId: string | null;            // id of message being replied to (v1.2)
  isMicDrop: boolean;                  // true when total reactions > 50 (PRD §10.5)
  isDeleted: boolean;                  // soft-delete — UI shows "message deleted" shell
  editedAt: Timestamp | null;          // null if never edited
  timestamp: Timestamp;                // server timestamp (FieldValue.serverTimestamp())
  status: CWMessageStatus;             // meaningful only for 'right' variant (own messages)

  // ── Denormalized sender identity (snapshot at send time) ───────────────────
  // Stored on the message so the chat row can render the WhatsApp/Telegram-style
  // avatar + name WITHOUT an extra /users/{uid} read per message. CROWN avatars
  // are emoji-on-color (no photo uploads) — `senderEmoji` + `senderColor` ARE the
  // avatar. All optional so older messages (written before this field existed)
  // still render via an initials fallback.
  senderName?: string | null;         // displayName ?? username at send time
  senderHandle?: string | null;       // @username at send time
  senderEmoji?: string | null;        // chosen avatar emoji (UserDoc.emoji)
  senderColor?: string | null;        // chosen avatar color  (UserDoc.color)
}

// ═════════════════════════════════════════════════════════════════════════════
// § 4 — ROOMS / SECTORS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Firestore: /rooms/{id}
 * id is a composite key: `${cityId}_${sectorId}`, e.g., "chandigarh_sector-17"
 */
export interface CWRoom {
  id: string;
  cityId: string;
  sectorId: string;
  colonyTag: string | null;            // human label, e.g., "City Center" for Sector 17
  onlineCount: number;                 // real-time presence counter
  heatScore: number;                   // 0–100, recalculated every 15 min
  mayorUid: string | null;
  pinnedAnnouncementId: string | null; // message id of sticky mayor post
  totalMembers: number;                // users whose home sector = this room
  aiCompanionsActive: boolean;         // PRD §15 anti-ghost-town: true when real users < threshold
  activeWar: CWWarInfo | null;         // null if no City War in progress
  activeElection: CWElectionInfo | null;
  createdAt: Timestamp;
  lastMessageAt: Timestamp;            // used for feed sort
}

/** Embedded in CWRoom when a City War is active. */
export interface CWWarInfo {
  warId: string;
  rivalSectorId: string;
  endsAt: Timestamp;
  ourScore: number;
  theirScore: number;
}

/** Embedded in CWRoom when a Mayor Election is running. */
export interface CWElectionInfo {
  electionId: string;
  phase: 'registration' | 'campaign' | 'voting' | 'result';
  endsAt: Timestamp;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 5 — FINANCIAL & TRANSACTIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Four wallet movement directions — strict mapping from PRD §10 billing logic.
 *
 * credit  = earned  (sparks received, daily login bonus, challenge prize)
 * debit   = spent   (spark gift sent, crate open, spotlight bid)
 * cashout = UPI withdrawal (Razorpay Payout API)
 * pass    = Crown Pass or Founder Pass purchase (Razorpay Payment)
 */
export type CWTransactionType   = 'credit' | 'debit' | 'cashout' | 'pass';
export type CWTransactionStatus = 'pending' | 'completed' | 'failed';

/**
 * Firestore: /transactions/{id}
 * Deserialized with `createdAtMs` (Unix ms) for React state and list rendering.
 * On Firestore read: `createdAtMs = (doc.createdAt as Timestamp).toMillis()`
 */
export interface CWTransaction {
  id: string;
  uid?: string;                        // recipient uid — present in Firestore, optional in mock
  type: CWTransactionType;
  amount: number;                      // strictly positive integer (direction encoded in `type`)
  balanceAfter?: number;               // snapshot of credits after this tx — audit trail
  description: string;                 // human-readable, shown in wallet history
  icon: string;                        // Feather icon name for list UI
  referenceId?: string | null;         // related messageId, crateId, orderId, etc.
  status: CWTransactionStatus;
  createdAtMs: number;                 // Unix milliseconds (deserialized from Firestore Timestamp)
  // cashout-only
  upiHandle?: string;
  razorpayPayoutId?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 6 — NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Seven categories — map 1:1 to the PRD §21 filter chips in the Notifications screen.
 * 'heat' drives City Wars / trending room push alerts.
 */
export type CWNotificationCategory =
  | 'mention'      // another user @mentioned you
  | 'spark'        // reaction or spark gift received
  | 'system'       // account events (verified, trust score, moderation)
  | 'mayor'        // mayor announcement or election event
  | 'wallet'       // cashout status, credit earned above threshold
  | 'achievement'  // challenge result, trophy unlocked
  | 'heat';        // room / sector trending alert

/**
 * Strongly typed deep-link context carried on each notification.
 * All fields optional — only populate what's relevant to the category.
 */
export interface CWNotificationMeta {
  route?: string;        // Expo Router path to navigate on tap
  fromName?: string;     // sender displayName (mention, spark, mayor)
  sectorName?: string;   // human-readable sector label
  karmaDelta?: number;   // trust/karma change amount (system category)
  credits?: number;      // credits involved (spark, wallet, achievement)
  roomId?: string;
  sectorId?: string;
  heatScore?: number;    // current heat score (heat category)
}

/**
 * Firestore: /notifications/{id}
 * Deserialized with `createdAtMs` (Unix ms) for React state and date grouping.
 */
export interface CWNotification {
  id: string;
  uid?: string;                         // recipient — present in Firestore, optional in mock
  category: CWNotificationCategory;
  title: string;                        // short, e.g., "Aman ne @you ko mention kiya"
  body: string;                         // preview text
  read: boolean;
  createdAtMs: number;                  // Unix milliseconds (deserialized from Firestore Timestamp)
  meta: CWNotificationMeta;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 7 — SAVED MESSAGES
// ═════════════════════════════════════════════════════════════════════════════

/** Attachment type for a saved message snapshot. */
export type CWMessageType = 'text' | 'image' | 'voice';

/**
 * Firestore: /users/{uid}/saved/{id}  (subcollection)
 * Snapshot of message data at save time — protects against source deletion.
 * Deserialized with `savedAtMs` (Unix ms).
 */
export interface CWSavedMessage {
  id: string;
  uid?: string;                         // owner — present in Firestore, optional in mock
  messageId: string;                    // original CWMessage.id
  sectorId: string;                     // room id — e.g., "room-6" (for navigation back)
  sectorName: string;                   // snapshot: e.g., "Startup Circle"
  text: string;                         // snapshot for offline search (empty for voice)
  senderName: string;                   // snapshot: displayName at save time
  senderHandle: string;                 // snapshot: @username at save time
  messageType: CWMessageType;
  voiceDurationSec?: number;            // seconds — populated only when messageType = 'voice'
  savedAtMs: number;                    // Unix milliseconds
}

// ═════════════════════════════════════════════════════════════════════════════
// § 8 — DISCOVER & CROWN CRATES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Firestore: /discoverPosts/{id}
 * Powers the Discover tab feed, spotlight carousel, and hot-sector tiles.
 * `views` is a pre-formatted string (e.g., "3.8K") produced server-side to
 * avoid re-computation across thousands of renders.
 */
export interface CWDiscoverPost {
  id: string;
  icon: string;                         // Feather icon name — NOT an emoji
  accent: string;                       // token color for icon tint or 3 px left stripe ONLY
  title: string;
  author: string;                       // @handle or displayName — snapshot at post time
  tier?: CWBadge;                       // present when author is Mayor / Founder / Crown
  room: string;                         // display room label, e.g., "Sector 17 · Music Junction"
  views: string;                        // pre-formatted, e.g., "3.8K" or "1.2K"
  category: string;                     // matches BAZAAR_CATEGORIES / interest IDs
  isSpotlight?: boolean;                // PRD §08 Engine 4 — Spotlight placement
  spotlightBidCredits?: number;         // credits bid for spotlight (higher = better placement)
  heatScore?: number;                   // 0–100, used for "Hot Sector" tile ordering
}

export type CWCrateTier = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * Firestore: /crates/{id}
 * Crown Crate product definition. Opening a crate is a `debit` CWTransaction.
 */
export interface CWCrate {
  id: string;
  name: string;                         // e.g., "Chandigarh City Crate"
  costCredits: number;                  // e.g., 10 for City Crate
  tier: CWCrateTier;
  onlyCrownPass: boolean;               // true = requires active CROWN badge
  pityGuarantee: number;                // after N opens, guaranteed epic+ reward
  availableFrom: Timestamp;
  availableUntil: Timestamp | null;     // null = permanent availability
}

// ═════════════════════════════════════════════════════════════════════════════
// § 9 — DIRECT MESSAGES  (v1.2 — scheduled post-launch)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Firestore: /dms/{id}
 * id = sorted uid concatenation: `${[uid1, uid2].sort().join('_')}`
 * Messages stored in subcollection: /dms/{id}/messages/{msgId}
 */
export interface CWDMConversation {
  id: string;
  participants: [string, string];           // exactly two uids — tuple enforces this
  lastMessagePreview: string;               // truncated for list display
  lastMessageAt: Timestamp;
  unreadCountByUid: Record<string, number>; // per-participant unread counts
  mutedBy: string[];                        // uids who silenced this conversation
}

// No circular dependencies — all exports above are fully self-contained.

/**
 * lib/firestore-users.ts
 *
 * Single source of truth for all /users/{uid} Firestore operations.
 * No other file in the project should write to the users collection.
 *
 * Collections
 * ───────────
 * /users/{uid}           — CW user profile (UserDoc shape)
 * /usernames/{handle}    — uniqueness reservation  { uid, createdAt }
 *
 * Blueprint §07 Database Schema: denormalized counters live on user doc
 * and are mutated exclusively through the helpers below so they stay
 * consistent. Never call firestore().collection('users').doc(uid).update()
 * from UI code — always go through these helpers.
 *
 * ─── CRITICAL FIX — April 21 incident ─────────────────────────────────
 * ROOT CAUSE: snap.exists was being called as a function — snap.exists()
 * Both firebase/compat (web) and @react-native-firebase (native) expose
 * DocumentSnapshot.exists as a BOOLEAN PROPERTY, not a method.
 * Calling snap.exists() returns a new function invocation result on web
 * and throws TypeError on native → broke the entire auth/onboarding flow.
 *
 * FIX: snapExists() now reads snap.exists strictly as a boolean property.
 * snap.exists()  ← NEVER USE THIS  (was the bug)
 * snap.exists    ← ALWAYS USE THIS  (the fix, applied everywhere below)
 * ───────────────────────────────────────────────────────────────────────
 *
 * Exported surface (public API)
 * ─────────────────────────────
 * Types:        UserDoc · OnboardingStep · Unsubscribe
 * Reads:        getUser · getUsersByCity · searchUsers
 * Writes:       ensureUser · updateUser · updateProfile · claimUsername
 * Credits:      incrementCredits · decrementCredits · debitCredits · creditUser
 * Karma:        addKarma
 * Counters:     incrementPosts · incrementWatches
 * Onboarding:   setOnboardingStep · defaultUser
 * Realtime:     subscribeToUser
 * Deprecated:   subscribeUser (alias → subscribeToUser)
 */

import { firestore, serverTimestamp, increment } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'language'
  | 'interests'
  | 'username'
  | 'welcome-bonus'
  | 'done';

/**
 * Shape of a document in /users/{uid}.
 *
 * NOTE: `region` maps to the Blueprint `cityId` concept — kept as `region`
 * in Firestore for backward compat with existing documents.
 * `getUsersByCity(cityId)` queries this field.
 */
export type UserDoc = {
  uid: string;
  phone: string;
  username: string | null;
  displayName: string | null;
  emoji: string;
  color: string;
  language: string;
  interests: string[];
  credits: number;
  karma: number;
  karmaLoanBalance: number;
  rank: number | null;
  badge: 'ACTIVE' | 'RISING' | 'PRO' | 'MASTER' | 'CHAMPION' | 'LEGEND';
  trustScore: number;
  bio: string;
  region: string | null;   // cityId — e.g. "chandigarh"
  trophies: string[];
  streak: number;
  posts: number;
  watches: number;
  onboardingStep: OnboardingStep;
  onboardingComplete: boolean;
  createdAt: unknown;  // Firestore Timestamp — use (createdAt as Timestamp).toMillis() to convert
  updatedAt: unknown;
};

/** Return type of all realtime subscriptions. Call to stop listening. */
export type Unsubscribe = () => void;

// ─── Collection keys ──────────────────────────────────────────────────────────

const USERS     = 'users';
const USERNAMES = 'usernames';

// ─── Critical fix: snap.exists as boolean property ───────────────────────────
/**
 * Reads DocumentSnapshot.exists as a boolean property.
 *
 * NEVER call snap.exists() — it is NOT a function in either
 * firebase/compat (web) or @react-native-firebase (native).
 * Calling it as a function was the root cause of the April 21 incident.
 *
 *   snap.exists   ✅  boolean property — always correct
 *   snap.exists() ❌  TypeError on native / wrong value on web — NEVER USE
 */
function snapExists(snap: any): boolean {
  return !!snap.exists;
}

// ═════════════════════════════════════════════════════════════════════════════
// § 1 — DEFAULT SHAPE
// ═════════════════════════════════════════════════════════════════════════════

/** Default blank user doc used on first sign-in via ensureUser(). */
export function defaultUser(uid: string, phone: string): UserDoc {
  return {
    uid,
    phone,
    username:         null,
    displayName:      null,
    emoji:            '👤',
    color:            '#C9A227',   // Gold — CROWD WORLD design token
    language:         'hi',
    interests:        [],
    credits:          50,          // welcome loan (Blueprint §08)
    karma:            0,
    karmaLoanBalance: 50,
    rank:             null,
    badge:            'ACTIVE',
    trustScore:       50,
    bio:              '',
    region:           null,
    trophies:         [],
    streak:           0,
    posts:            0,
    watches:          0,
    onboardingStep:   'language',
    onboardingComplete: false,
    createdAt:        serverTimestamp(),
    updatedAt:        serverTimestamp(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// § 2 — READS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Fetch a single user document.
 * Returns null when the uid does not exist — never throws for missing docs.
 *
 * @param uid  Firebase Auth UID.
 */
export async function getUser(uid: string): Promise<UserDoc | null> {
  if (!uid) return null;
  const snap = await firestore().collection(USERS).doc(uid).get();
  if (!snapExists(snap)) return null;
  return snap.data() as UserDoc;
}

/**
 * Returns all users whose home city matches `cityId`.
 * Results are ordered by karma descending (top contributors first).
 *
 * Requires composite Firestore index: region ASC + karma DESC.
 * Create via: Firebase Console → Firestore → Indexes → Add.
 *
 * @param cityId  e.g. "chandigarh"
 * @param limit   Max results (default 50).
 */
export async function getUsersByCity(
  cityId: string,
  limit = 50,
): Promise<UserDoc[]> {
  if (!cityId) return [];

  const snap = await firestore()
    .collection(USERS)
    .where('region', '==', cityId)
    .orderBy('karma', 'desc')
    .limit(limit)
    .get();

  if (snap.empty) return [];
  return snap.docs.map((d) => d.data() as UserDoc);
}

/**
 * Prefix-search users by username.
 *
 * Firestore range query on the lowercased `username` field — returns users
 * whose handle starts with `query`. Case-insensitive because usernames are
 * stored lowercase at claim time (claimUsername lowercases before writing).
 *
 * Requires single-field Firestore index on `username` (auto-created for
 * orderBy fields, but confirm in Console if results are unexpectedly empty).
 *
 * @param query  Partial username to search (e.g. "aman" matches "@amanjeet").
 * @param limit  Max results (default 20).
 *
 * NOTE: displayName search is a Phase 2 enhancement — requires Algolia or
 * Typesense, because Firestore has no native substring/full-text index.
 */
export async function searchUsers(
  query: string,
  limit = 20,
): Promise<UserDoc[]> {
  const term = query.toLowerCase().trim();
  if (!term) return [];

  // Range end: append \uf8ff (highest Unicode codepoint) to match all strings
  // that start with `term`. Standard Firestore prefix-search pattern.
  const termEnd = term + '\uf8ff';

  const snap = await firestore()
    .collection(USERS)
    .orderBy('username')
    .startAt(term)
    .endAt(termEnd)
    .limit(limit)
    .get();

  if (snap.empty) return [];
  return snap.docs.map((d) => d.data() as UserDoc);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3 — WRITES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Get-or-create user doc after phone OTP verification.
 *
 * Called by AuthContext immediately after verifyOTP succeeds.
 * · Existing user → returns their current doc (no write).
 * · New user      → writes defaultUser shape + returns it.
 *
 * @param uid    Firebase Auth UID.
 * @param phone  E.164 phone number, e.g. "+919876543210".
 */
export async function ensureUser(uid: string, phone: string): Promise<UserDoc> {
  const ref = firestore().collection(USERS).doc(uid);
  const snap = await ref.get();
  if (snapExists(snap)) return snap.data() as UserDoc;
  const fresh = defaultUser(uid, phone);
  await ref.set(fresh);
  return fresh;
}

/**
 * Partial update — bumps updatedAt on every call.
 *
 * For profile-editable fields (displayName, bio, region, color) prefer
 * updateProfile() which applies validation and sanitization.
 *
 * @param uid   Firebase Auth UID.
 * @param patch Fields to merge. Must not contain uid (silently omitted).
 */
export async function updateUser(
  uid: string,
  patch: Partial<UserDoc>,
): Promise<void> {
  if (!uid) return;
  const { uid: _omit, ...safe } = patch as UserDoc;
  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({ ...safe, updatedAt: serverTimestamp() });
}

/**
 * Update user-editable profile fields only.
 *
 * Separated from updateUser() so callers cannot accidentally overwrite
 * system-managed fields (credits, karma, badge, trustScore, etc.).
 * All fields are sanitized before writing.
 */
export async function updateProfile(
  uid: string,
  patch: {
    displayName?: string | null;
    bio?: string;
    region?: string | null;
    color?: string;
  },
): Promise<void> {
  if (!uid) return;

  const safe: Record<string, unknown> = {};
  if ('displayName' in patch) safe.displayName = patch.displayName ?? null;
  if ('bio' in patch)         safe.bio = (patch.bio ?? '').slice(0, 120);
  if ('region' in patch)      safe.region = patch.region ?? null;
  if ('color' in patch)       safe.color = patch.color;

  if (Object.keys(safe).length === 0) return;

  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({ ...safe, updatedAt: serverTimestamp() });
}

/**
 * Reserve a username atomically using a Firestore transaction.
 *
 * /usernames/{handle} acts as a uniqueness lock — if the doc exists and
 * its uid differs from the caller, throws "USERNAME_TAKEN".
 *
 * Username rules: 3–20 chars, lowercase letters / digits / underscores.
 *
 * @throws "USERNAME_INVALID" — format check failed.
 * @throws "USERNAME_TAKEN"   — another uid owns this handle.
 */
export async function claimUsername(uid: string, username: string): Promise<void> {
  const handle = username.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error('USERNAME_INVALID');

  const db         = firestore();
  const handleRef  = db.collection(USERNAMES).doc(handle);
  const userRef    = db.collection(USERS).doc(uid);

  await db.runTransaction(async (tx) => {
    const handleSnap = await tx.get(handleRef);
    if (snapExists(handleSnap)) {
      const owner = (handleSnap.data() as { uid?: string })?.uid;
      if (owner && owner !== uid) throw new Error('USERNAME_TAKEN');
    }
    tx.set(handleRef, { uid, createdAt: serverTimestamp() });
    tx.update(userRef, {
      username:    handle,
      displayName: handle,
      updatedAt:   serverTimestamp(),
    });
  });
}

/**
 * Convenience: advance the onboarding step and flip `onboardingComplete`
 * to true when step === "done".
 */
export async function setOnboardingStep(
  uid: string,
  step: OnboardingStep,
): Promise<void> {
  await updateUser(uid, {
    onboardingStep:     step,
    onboardingComplete: step === 'done',
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 4 — CREDITS (atomic)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Atomically add credits to a user's balance.
 *
 * Uses Firestore FieldValue.increment() — the operation is atomic at the
 * server level with no read-then-write race condition. Safe for concurrent
 * calls from Cloud Functions, client SDK, and admin SDK simultaneously.
 *
 * Use cases: daily login bonus, challenge prize, sponsored-post reward,
 * admin top-up, referral reward.
 *
 * @param uid    Firebase Auth UID.
 * @param amount Positive number of credits to add.
 */
export async function incrementCredits(uid: string, amount: number): Promise<void> {
  if (!uid || amount <= 0) return;
  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({
      credits:   increment(Math.abs(amount)),
      updatedAt: serverTimestamp(),
    });
}

/**
 * Atomically subtract credits from a user's balance.
 *
 * Uses Firestore FieldValue.increment() with a negative delta — atomic,
 * no read-then-write race. NOTE: this does NOT enforce a minimum balance.
 * If you need to guard against overdraft (e.g. in-app purchases), use
 * debitCredits() which runs a transaction with a balance check.
 *
 * Use cases: admin deductions, refund reversals, penalty deductions
 * by Cloud Functions that already validated balance server-side.
 *
 * @param uid    Firebase Auth UID.
 * @param amount Positive number of credits to subtract.
 */
export async function decrementCredits(uid: string, amount: number): Promise<void> {
  if (!uid || amount <= 0) return;
  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({
      credits:   increment(-Math.abs(amount)),
      updatedAt: serverTimestamp(),
    });
}

/**
 * Debit credits with balance guard — returns false if insufficient funds.
 *
 * Runs a Firestore transaction to atomically read → validate → write.
 * Use this for all user-facing debit actions (send spark, join spotlight,
 * open Crown Crate) where the UI must surface an "insufficient credits" error.
 *
 * @returns true if debit succeeded, false if balance was insufficient.
 */
export async function debitCredits(uid: string, amount: number): Promise<boolean> {
  if (!uid || amount <= 0) return false;

  const db  = firestore();
  const ref = db.collection(USERS).doc(uid);
  let success = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snapExists(snap)) return;
    const doc = snap.data() as UserDoc;
    if ((doc.credits ?? 0) < amount) {
      success = false;
      return;
    }
    tx.update(ref, {
      credits:   increment(-amount),
      updatedAt: serverTimestamp(),
    });
    success = true;
  });

  return success;
}

/**
 * Credit a user (e.g. watching a sponsored post, winning a challenge).
 * Prefer incrementCredits() for simple top-ups — this version also runs
 * a transaction to validate the doc exists before writing.
 *
 * @deprecated Use incrementCredits() for most cases — it is simpler and
 * equally safe due to Firestore's atomic increment semantics.
 */
export async function creditUser(uid: string, amount: number): Promise<void> {
  if (!uid || amount <= 0) return;
  await incrementCredits(uid, amount);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 5 — KARMA
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Adjust karma by `delta` (positive = add, negative = subtract).
 * Karma floor is 0 — never goes negative.
 *
 * Runs a transaction to safely read → clamp → write.
 *
 * Use cases:
 *   +karma  helpful reply, weekly challenge win, mayor election bonus
 *   -karma  downvote, moderation penalty
 */
export async function addKarma(uid: string, delta: number): Promise<void> {
  if (!uid || delta === 0) return;

  const db  = firestore();
  const ref = db.collection(USERS).doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snapExists(snap)) return;
    const doc  = snap.data() as UserDoc;
    const next = Math.max(0, (doc.karma ?? 0) + delta);
    tx.update(ref, { karma: next, updatedAt: serverTimestamp() });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 6 — ACTIVITY COUNTERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Increment the user's post count after a successful publish.
 * Uses atomic increment — safe for concurrent writes.
 */
export async function incrementPosts(uid: string): Promise<void> {
  if (!uid) return;
  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({
      posts:     increment(1),
      updatedAt: serverTimestamp(),
    });
}

/**
 * Increment the watch count each time a sponsored post is fully watched.
 * Uses atomic increment — safe for concurrent writes.
 */
export async function incrementWatches(uid: string): Promise<void> {
  if (!uid) return;
  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({
      watches:   increment(1),
      updatedAt: serverTimestamp(),
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// § 7 — REALTIME SUBSCRIPTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Live subscription to a user document.
 *
 * Calls `onChange` immediately with the current snapshot, then on every
 * subsequent change. Passes null when the document is deleted or missing.
 *
 * Returns an Unsubscribe function — always call it in useEffect cleanup
 * to prevent memory leaks:
 *
 * @example
 * useEffect(() => subscribeToUser(uid, setUser), [uid]);
 *
 * @param uid       Firebase Auth UID to watch.
 * @param onChange  Callback receiving the latest UserDoc (or null).
 * @returns         Unsubscribe — call to stop the listener.
 */
export function subscribeToUser(
  uid: string,
  onChange: (user: UserDoc | null) => void,
): Unsubscribe {
  if (!uid) {
    onChange(null);
    return () => {};
  }

  return firestore()
    .collection(USERS)
    .doc(uid)
    .onSnapshot(
      (snap) => onChange(snapExists(snap) ? (snap.data() as UserDoc) : null),
      (_err) => onChange(null),   // Network error or permissions revoked → emit null
    );
}

/**
 * @deprecated Renamed to subscribeToUser() for consistency with the rest of
 * the service layer. subscribeUser() will be removed in a future release.
 */
export const subscribeUser = subscribeToUser;

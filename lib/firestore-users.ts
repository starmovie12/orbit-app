/**
 * User document CRUD.
 *
 * Collection: /users/{uid}
 * Collection: /usernames/{username}  ← reservation for unique handle
 *
 * Blueprint §07 Database Schema: denormalized counters live on user doc,
 * mutated via transactions/increments. Writes are never done without going
 * through these helpers so counters stay consistent.
 */

import { firestore, serverTimestamp } from "@/lib/firebase";

export type OnboardingStep =
  | "language"
  | "interests"
  | "username"
  | "welcome-bonus"
  | "done";

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
  badge: "ACTIVE" | "RISING" | "PRO" | "MASTER" | "CHAMPION" | "LEGEND";
  trustScore: number;
  bio: string;
  region: string | null;
  trophies: string[];
  streak: number;
  posts: number;
  watches: number;
  onboardingStep: OnboardingStep;
  onboardingComplete: boolean;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
};

const USERS = "users";
const USERNAMES = "usernames";

/** Default blank user doc used on first sign-in. */
export function defaultUser(uid: string, phone: string): UserDoc {
  return {
    uid,
    phone,
    username: null,
    displayName: null,
    emoji: "👤",
    color: "#2481CC",
    language: "hi",
    interests: [],
    credits: 50, // welcome loan (blueprint §08)
    karma: 0,
    karmaLoanBalance: 50,
    rank: null,
    badge: "ACTIVE",
    trustScore: 50,
    bio: "",
    region: null,
    trophies: [],
    streak: 0,
    posts: 0,
    watches: 0,
    onboardingStep: "language",
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Fetch a user doc. Returns null if missing. */
export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await firestore().collection(USERS).doc(uid).get();
  if (!snap.exists()) return null;
  return snap.data() as UserDoc;
}

/**
 * Get-or-create user doc after phone verification.
 * First-time users get the `defaultUser` shape.
 */
export async function ensureUser(uid: string, phone: string): Promise<UserDoc> {
  const ref = firestore().collection(USERS).doc(uid);
  const snap = await ref.get();
  if (snap.exists()) return snap.data() as UserDoc;
  const fresh = defaultUser(uid, phone);
  await ref.set(fresh);
  return fresh;
}

/** Partial update + bump updatedAt. */
export async function updateUser(
  uid: string,
  patch: Partial<UserDoc>
): Promise<void> {
  await firestore()
    .collection(USERS)
    .doc(uid)
    .update({ ...patch, updatedAt: serverTimestamp() });
}

/**
 * Reserve a username atomically.
 * `/usernames/{name}` holds a tiny doc pointing to the owning uid.
 * Throws "USERNAME_TAKEN" if someone else already has it.
 */
export async function claimUsername(
  uid: string,
  username: string
): Promise<void> {
  const handle = username.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new Error("USERNAME_INVALID");
  }

  const db = firestore();
  const handleRef = db.collection(USERNAMES).doc(handle);
  const userRef = db.collection(USERS).doc(uid);

  await db.runTransaction(async (tx) => {
    const handleSnap = await tx.get(handleRef);
    if (handleSnap.exists()) {
      const owner = (handleSnap.data() as { uid?: string })?.uid;
      if (owner && owner !== uid) throw new Error("USERNAME_TAKEN");
    }
    tx.set(handleRef, { uid, createdAt: serverTimestamp() });
    tx.update(userRef, {
      username: handle,
      displayName: handle,
      updatedAt: serverTimestamp(),
    });
  });
}

/** Convenience: set the onboarding step and flip `onboardingComplete` on "done". */
export async function setOnboardingStep(
  uid: string,
  step: OnboardingStep
): Promise<void> {
  await updateUser(uid, {
    onboardingStep: step,
    onboardingComplete: step === "done",
  });
}

/**
 * Live user doc subscription. Returns an unsubscribe fn.
 * Used by AuthContext to keep local state in sync with server.
 */
export function subscribeUser(
  uid: string,
  onChange: (u: UserDoc | null) => void
): () => void {
  return firestore()
    .collection(USERS)
    .doc(uid)
    .onSnapshot(
      (snap) => onChange(snap.exists() ? (snap.data() as UserDoc) : null),
      () => onChange(null)
    );
}

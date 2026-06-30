/**
 * lib/firebase.ts — NATIVE (iOS / Android) Firebase provider
 * CROWN · @react-native-firebase v23 (namespaced API)
 *
 * Yeh file poore data layer (rooms, messages, users) ko asli 
 * database connection deti hai. Iske bina app nahi chalegi.
 */

import firestore from '@react-native-firebase/firestore';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';

// ── Firestore module (namespaced) ───────────────────────────────────────────
// `firestore` is callable: firestore().collection('rooms')...
// `firestore.FieldValue.serverTimestamp()` / `.increment(n)` are statics.
export { firestore };

// ── Auth module (namespaced) ────────────────────────────────────────────────
// `auth()` → Auth instance. Used by AuthContext / lib/auth.ts.
export { auth };

// ── Platform-correct session helpers (parity with lib/firebase.web.ts) ──────
// AuthContext routes through these so the SAME context code works on native
// (RNFirebase namespaced API) AND web (modular SDK).
//
// WHY THIS EXISTS: AuthContext previously called the WEB modular
// onAuthStateChanged(auth, cb) from 'firebase/auth'. On native, `auth` is the
// @react-native-firebase module, which that web function cannot read — so the
// listener never fired and a successful OTP login was never detected by the
// app. These helpers call the correct native API instead.

/** Subscribe to auth-state changes. Returns the unsubscribe fn. */
export function onAuthChanged(
  cb: (user: FirebaseAuthTypes.User | null) => void,
): () => void {
  return auth().onAuthStateChanged(cb);
}

/** Currently signed-in Firebase user, or null. */
export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

/** Sign the current user out of Firebase Auth. */
export function signOutUser(): Promise<void> {
  return auth().signOut();
}

/** Flush pending writes + disable Firestore network (sign-out teardown). */
export async function disableFirestoreNetwork(): Promise<void> {
  await firestore().disableNetwork();
}

// ── Ready Firestore instance (parity with web's modular `db`) ───────────────
// Yeh `db` web aur native ke beech compatibility banaye rakhta hai.
export const db = firestore();

/**
 * Firestore server timestamp sentinel.
 * Usage: { createdAt: serverTimestamp() }
 */
export const serverTimestamp = (): ReturnType<
  typeof firestore.FieldValue.serverTimestamp
> => firestore.FieldValue.serverTimestamp();

/**
 * Atomic counter increment sentinel.
 * Usage: { onlineCount: increment(1) }
 */
export const increment = (
  by: number,
): ReturnType<typeof firestore.FieldValue.increment> =>
  firestore.FieldValue.increment(by);

// ── Firebase error-code → Hinglish message mapper ───────────────────────────
// Humne jo error mapper `firebase-errors.ts` mein banaya, use yahan import karke 
// aage export kar rahe hain taaki baaki app usko purane tarike se use kar sake.
export { getFirebaseErrorMessage } from './firebase-errors';

export default db;

/**
 * lib/firebase.ts — NATIVE (iOS / Android) Firebase provider
 * CROWN · @react-native-firebase v23 (namespaced API)
 *
 * Yeh file poore data layer (rooms, messages, users) ko asli 
 * database connection deti hai. Iske bina app nahi chalegi.
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ── Firestore module (namespaced) ───────────────────────────────────────────
// `firestore` is callable: firestore().collection('rooms')...
// `firestore.FieldValue.serverTimestamp()` / `.increment(n)` are statics.
export { firestore };

// ── Auth module (namespaced) ────────────────────────────────────────────────
// `auth()` → Auth instance. Used by AuthContext / lib/auth.ts.
export { auth };

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

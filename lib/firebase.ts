/**
 * Central Firebase entry point — UNIVERSAL (works in Expo Go + Dev Build + Web).
 *
 * ─── WHY THIS CHANGE ───────────────────────────────────────────────────────
 * @react-native-firebase needs native modules compiled into a Dev Build.
 * Running `expo start` (Expo Go) does NOT have those native modules → crash:
 *   "Native module RNFBAppModule not found"
 * → This caused ALL routes to show "missing default export" because the
 *   entire module tree failed to load.
 *
 * SOLUTION: Use firebase/compat SDK for ALL platforms.
 *   ✅ Works in Expo Go (expo start)
 *   ✅ Works in Dev Build (expo start --dev-client)
 *   ✅ Works on Web
 *   ✅ Same API shape as @react-native-firebase (namespaced calls)
 *
 * When you're ready for production native builds, create firebase.native.ts
 * with @react-native-firebase and Metro will auto-pick it for iOS/Android.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * SECURITY NOTE:
 *   The apiKey below IS NOT A SECRET. Firebase Web API keys are public by
 *   design — they only identify the project to Google's API. Security is
 *   enforced via Firebase Security Rules + App Check, not by hiding this key.
 *   Real secrets (Admin SDK, service-account JSON) must NEVER be committed.
 */

import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain: "orbit-app-5b4b3.firebaseapp.com",
  projectId: "orbit-app-5b4b3",
  storageBucket: "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId: "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

// Idempotent init — hot-reload pe double-init crash nahi hoga
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

/**
 * `auth` and `firestore` are callable (`auth()`, `firestore()`) AND carry
 * static members (`firestore.FieldValue.serverTimestamp()` etc.).
 * This matches @react-native-firebase's export shape exactly.
 */
export const auth = firebase.auth;
export const firestore = firebase.firestore;

/** Firestore server timestamp shortcut (for createdAt / updatedAt). */
export const serverTimestamp = () =>
  firebase.firestore.FieldValue.serverTimestamp();

/** Atomic increment helper (used for karma, credits counters). */
export const increment = (by: number) =>
  firebase.firestore.FieldValue.increment(by);

export type FirestoreTypes = any;

/**
 * Central Firebase entry point — WEB build.
 *
 * Metro automatically picks this file when bundling for platform=web,
 * and uses firebase.ts for iOS/Android. Same import path in app code:
 *     import { auth, firestore } from "@/lib/firebase";
 *
 * Why `firebase/compat/*` for Firestore?
 *   @react-native-firebase's API is namespaced (`firestore()`, `firestore().collection(...)`,
 *   `firestore.FieldValue.serverTimestamp()`). firebase/compat preserves that exact
 *   namespaced API, so every existing call site in `lib/firestore-users.ts`, etc.
 *   works identically on web — zero rewrites needed.
 *
 * Why modular `getAuth()` for Auth?
 *   All call sites in `lib/auth.ts` and `contexts/AuthContext.tsx` use the modular SDK:
 *   `onAuthStateChanged(auth, ...)`, `signInWithPhoneNumber(auth, ...)`, etc.
 *   These functions require a modular Auth instance, NOT the compat `firebase.auth`
 *   namespace function. Exporting `firebase.auth` caused the runtime crash:
 *   "onAuthStateChanged is not a function".
 *
 * --------------------------------------------------------------------------
 * SECURITY NOTE for whoever reads this in the git log:
 *   The apiKey below IS NOT A SECRET. Firebase Web API keys are designed to
 *   be public (they only identify the project to Google's API). Security is
 *   enforced via Firebase Security Rules + App Check, not by hiding this key.
 *
 *   Real secrets (Admin SDK service-account JSON, private keys, tokens)
 *   MUST NEVER be committed to this repo. Ever. Not in any file.
 * --------------------------------------------------------------------------
 */

import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { getAuth, type Auth } from "firebase/auth";

const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain: "orbit-app-5b4b3.firebaseapp.com",
  projectId: "orbit-app-5b4b3",
  storageBucket: "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId: "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

// Idempotent init — hot-reload pe double-init crash nahi hoga
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_WEB_CONFIG);
}

/**
 * `auth` — modular Auth instance obtained via getAuth().
 *
 * firebase/compat and firebase modular share the same underlying app registry,
 * so `firebase.app()` returns the app initialized above, and `getAuth()` wraps
 * it in a proper modular Auth instance that works with all v9+ modular functions:
 *   onAuthStateChanged(auth, ...)
 *   signInWithPhoneNumber(auth, ...)
 *   signInWithCredential(auth, ...)
 *   signOut(auth)
 */
export const auth: Auth = getAuth(firebase.app());

/**
 * `firestore` — compat callable namespace.
 * Call sites use it as both a function (`firestore()`) and a static
 * namespace (`firestore.FieldValue.serverTimestamp()`), which is why
 * we keep compat here instead of switching to modular getFirestore().
 */
export const firestore = firebase.firestore;

/** Firestore server timestamp shortcut (for createdAt / updatedAt). */
export const serverTimestamp = () =>
  firebase.firestore.FieldValue.serverTimestamp();

/** Atomic increment helper (used for karma, credits counters). */
export const increment = (by: number) =>
  firebase.firestore.FieldValue.increment(by);

/**
 * Type alias — in native build this points to @react-native-firebase's
 * Firestore Module type. On web we don't have that exact type, but `any`
 * is sufficient because TypeScript erases `import type` at build time.
 */
export type FirestoreTypes = any;

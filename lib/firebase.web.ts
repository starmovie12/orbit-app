/**
 * Central Firebase entry point — WEB build.
 *
 * Metro automatically picks this file when bundling for platform=web,
 * and uses firebase.ts for iOS/Android. Same import path in app code:
 *     import { auth, firestore } from "@/lib/firebase";
 *
 * Why `firebase/compat/*` instead of the v9 modular SDK?
 *   @react-native-firebase's API is namespaced (`auth()`, `firestore().collection(...)`,
 *   `firestore.FieldValue.serverTimestamp()`). firebase/compat preserves that exact
 *   namespaced API, so every existing call site in `lib/auth.ts`, `lib/firestore-users.ts`,
 *   etc. works identically on web — zero rewrites needed.
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
import "firebase/compat/auth";
import "firebase/compat/firestore";

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
 * `auth` and `firestore` are callable (`auth()`, `firestore()`) AND carry
 * static members (`firestore.FieldValue.serverTimestamp()` etc.). This
 * structurally matches @react-native-firebase's exports.
 */
export const auth = firebase.auth;
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

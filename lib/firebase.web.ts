/**
 * lib/firebase.web.ts — WEB only
 *
 * ROOT CAUSE FIX (v3):
 *   Error: "getModularInstance(...).onAuthStateChanged is not a function"
 *
 *   Cause 1: `firebase` JS SDK was NOT in package.json — only
 *             @react-native-firebase was listed. Web needs the JS SDK.
 *             FIX → Added "firebase": "^11.0.0" to package.json.
 *
 *   Cause 2: Auth was initialized from a compat-wrapped app instance.
 *             Compat wraps the modular app, and passing a compat instance
 *             to getAuth() returns a compat Auth, not a modular Auth.
 *             Modular onAuthStateChanged() then fails on it.
 *             FIX → Let compat initialize the default app first (it also
 *             registers in the modular registry), then call getApp() to
 *             get the real modular FirebaseApp, and pass THAT to getAuth().
 */

import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain:        "orbit-app-5b4b3.firebaseapp.com",
  projectId:         "orbit-app-5b4b3",
  storageBucket:     "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId:             "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

// ── Step 1: Initialize compat app (also registers in modular registry) ───────
// Compat's initializeApp() internally calls the modular initializeApp(),
// so after this, getApps() returns the same app.
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// ── Step 2: Get the modular FirebaseApp from the registry ────────────────────
// This is the REAL modular instance — NOT a compat wrapper.
// getAuth(modularApp) returns a proper modular Auth, which works with
// all modular functions: onAuthStateChanged, signInWithPhoneNumber, etc.
const modularApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);

// ── Step 3: Auth — modular instance from modular app ────────────────────────
// onAuthStateChanged(auth, ...) will now work correctly ✅
export const auth: Auth = getAuth(modularApp);

// ── Step 4: Firestore modular instance ───────────────────────────────────────
export const db = getFirestore(modularApp);

// ── Step 5: Storage ──────────────────────────────────────────────────────────
export const storage = getStorage(modularApp);

// ── Step 6: Compat Firestore namespace (for call sites using namespaced API) ─
// firestore().collection("users").doc(uid).get()  ← compat pattern
// firestore.FieldValue.serverTimestamp()           ← compat pattern
export const firestore = firebase.firestore;

/** Shortcut for Firestore server timestamp. */
export const serverTimestamp = (): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.serverTimestamp();

/** Atomic counter increment helper. */
export const increment = (by: number): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.increment(by);

// Default export for compatibility
export default modularApp;

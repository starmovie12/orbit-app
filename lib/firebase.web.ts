/**
 * lib/firebase.web.ts — WEB only
 *
 * ROOT CAUSE FIX (v4 — FINAL):
 *   Error: "getModularInstance(...).onAuthStateChanged is not a function"
 *
 *   Root Cause: In Firebase v11, initializing the compat app BEFORE the
 *   modular app causes getAuth() to return an internally compat-wrapped
 *   Auth instance. The modular onAuthStateChanged() then calls
 *   getModularInstance(auth) on it, but the method is missing → crash.
 *
 *   FIX: Always initialize the MODULAR app first via initializeApp().
 *   Then initialize compat AFTER (it re-uses the same underlying app).
 *   getAuth(app) on the modular app gives a proper modular Auth instance
 *   that works correctly with all modular auth functions. ✅
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain:        "orbit-app-5b4b3.firebaseapp.com",
  projectId:         "orbit-app-5b4b3",
  storageBucket:     "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId:             "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

// ── Step 1: MODULAR app — always initialize first ────────────────────────────
// This must happen before compat setup. getAuth() on this instance returns
// a proper modular Auth, not a compat-wrapped one.
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// ── Step 2: Auth — purely modular, no compat involvement ────────────────────
// onAuthStateChanged(auth, callback) ✅  signInWithPhoneNumber ✅
export const auth: Auth = getAuth(app);

// ── Step 3: Firestore + Storage (modular) ────────────────────────────────────
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ── Step 4: Compat app — initialized AFTER modular ───────────────────────────
// Compat internally detects the already-initialized modular app and reuses it.
// This keeps the compat Firestore API (used widely in the codebase) working.
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// ── Step 5: Compat Firestore namespace ───────────────────────────────────────
// firestore().collection("users").doc(uid).get()   ← used across codebase
// firestore.FieldValue.serverTimestamp()            ← used across codebase
export const firestore = firebase.firestore;

/** Shortcut for Firestore server timestamp. */
export const serverTimestamp = (): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.serverTimestamp();

/** Atomic counter increment helper. */
export const increment = (by: number): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.increment(by);

// Default export for compatibility
export default app;

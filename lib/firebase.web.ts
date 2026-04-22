/**
 * lib/firebase.web.ts — WEB build only
 *
 * Metro automatically picks this file for platform=web.
 *
 * ROOT CAUSE FIX:
 *   Previous code did: getAuth(firebase.app())  ← compat app passed to modular getAuth
 *   This caused: "getModularInstance(...).onAuthStateChanged is not a function"
 *
 *   FIX: Initialize a PROPER modular app via initializeApp(), then pass
 *   THAT modular app to getAuth(). Compat SDK is kept only for Firestore
 *   because call sites use namespaced API (firestore().collection(...),
 *   firestore.FieldValue.serverTimestamp()).
 */

import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const FIREBASE_WEB_CONFIG = {
  apiKey:            "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain:        "orbit-app-5b4b3.firebaseapp.com",
  projectId:         "orbit-app-5b4b3",
  storageBucket:     "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId:             "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

// ── 1. Modular app (used for Auth) ──────────────────────────────────────────
//    getAuth() requires a MODULAR FirebaseApp, not a compat app.
//    Using the compat app caused: "getModularInstance(...).onAuthStateChanged
//    is not a function" — because the compat wrapper has no `.onAuthStateChanged`
//    internal method that the modular bridge expects.
const modularApp: FirebaseApp =
  getApps().length === 0
    ? initializeApp(FIREBASE_WEB_CONFIG)
    : getApp();

// ── 2. Compat app (used for Firestore only) ──────────────────────────────────
//    All Firestore call sites use namespaced API:
//      firestore().collection("users").doc(uid).get()
//      firestore.FieldValue.serverTimestamp()
//    firebase/compat preserves that API so no rewrites needed.
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_WEB_CONFIG);
}

// ── 3. Auth — modular instance from MODULAR app ──────────────────────────────
//    Works correctly with all modular functions:
//      onAuthStateChanged(auth, callback)   ✅
//      signInWithPhoneNumber(auth, ...)     ✅
//      signInWithCredential(auth, ...)      ✅
//      signOut(auth)                        ✅
export const auth: Auth = getAuth(modularApp);

// ── 4. Firestore — compat namespace ─────────────────────────────────────────
export const firestore = firebase.firestore;

/** Shortcut for Firestore server timestamp. */
export const serverTimestamp = (): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.serverTimestamp();

/** Atomic counter increment helper. */
export const increment = (by: number): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.increment(by);

export type FirestoreTypes = any;

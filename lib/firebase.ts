/**
 * lib/firebase.ts — NATIVE build (iOS / Android)
 *
 * Metro uses this file for iOS/Android.
 * Web uses firebase.web.ts instead (resolved automatically by Metro).
 *
 * FIX v3:
 *   - Uses ONLY modular Firebase JS SDK for Auth (no mixing compat + modular)
 *   - Compat kept ONLY for Firestore (namespaced API used in firestore-*.ts)
 *   - `firebase` package now in package.json so all imports resolve correctly
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Compat — only for Firestore (namespaced API)
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyBAeFZfk-TLk3WxhSLobX8AYjteSv-g344",
  authDomain:        "orbit-app-5b4b3.firebaseapp.com",
  projectId:         "orbit-app-5b4b3",
  storageBucket:     "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId:             "1:250454225022:web:285ff43d617e9230e6a82f",
  measurementId:     "G-ZG0JCXJ26V",
};

// ── Modular app ──────────────────────────────────────────────────────────────
const app: FirebaseApp =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

// ── Compat app (for Firestore only) ─────────────────────────────────────────
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ── Auth — AsyncStorage persistence ──────────────────────────────────────────
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized on hot-refresh
  auth = getAuth(app);
}

// ── Firestore (modular) ──────────────────────────────────────────────────────
const db = getFirestore(app);

// ── Storage ──────────────────────────────────────────────────────────────────
const storage = getStorage(app);

// ── Firestore compat namespace ───────────────────────────────────────────────
const firestore = firebase.firestore;

const serverTimestamp = (): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.serverTimestamp();

const increment = (by: number): firebase.firestore.FieldValue =>
  firebase.firestore.FieldValue.increment(by);

export { app, auth, db, storage, firestore, serverTimestamp, increment };
export default app;

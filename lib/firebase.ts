/**
 * lib/firebase.ts
 *
 * ✅ JS-only Firebase SDK (no native modules needed — works in Expo Go)
 * ✅ Real config: orbit-app-5b4b3
 * ✅ Auth persisted via AsyncStorage (session survives app restarts)
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  Auth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Firebase project config (orbit-app-5b4b3) ───────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBAeFZfk-TLk3WxhSLobX8AYjteSv-g344",
  authDomain:        "orbit-app-5b4b3.firebaseapp.com",
  projectId:         "orbit-app-5b4b3",
  storageBucket:     "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId:             "1:250454225022:web:285ff43d617e9230e6a82f",
  measurementId:     "G-ZG0JCXJ26V",
};

// ─── App (guard against duplicate init on hot-reload) ────────────────────────
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Auth (with AsyncStorage persistence) ────────────────────────────────────
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (happens during Expo fast-refresh)
  auth = getAuth(app);
}

// ─── Firestore ────────────────────────────────────────────────────────────────
const db = getFirestore(app);

// ─── Storage ─────────────────────────────────────────────────────────────────
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;

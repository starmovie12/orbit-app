/**
 * Central Firebase entry point — NATIVE (Android/iOS) build.
 *
 * Metro bundler ke platform-extensions ki wajah se automatically:
 *   - Web build         → lib/firebase.web.ts  (Firebase Web SDK compat)
 *   - iOS/Android build → this file             (@react-native-firebase)
 *
 * Is file ko mat chhedna. Sab web-specific kaam firebase.web.ts mein hota hai.
 *
 * @react-native-firebase auto-initializes from google-services.json (Android)
 * and GoogleService-Info.plist (iOS) at native startup — so we don't call
 * initializeApp() ourselves here.
 */

import auth from "@react-native-firebase/auth";
import firestore, {
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";

export { auth, firestore };
export type FirestoreTypes = FirebaseFirestoreTypes.Module;

/** Firestore server timestamp shortcut (for createdAt / updatedAt). */
export const serverTimestamp = () =>
  firestore.FieldValue.serverTimestamp();

/** Atomic increment helper (used for karma, credits counters). */
export const increment = (by: number) =>
  firestore.FieldValue.increment(by);

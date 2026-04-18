/**
 * Central Firebase entry point.
 *
 * @react-native-firebase auto-initializes from google-services.json (Android)
 * and GoogleService-Info.plist (iOS) at native startup — so we don't call
 * initializeApp() ourselves here. We just re-export the namespaces so every
 * import in the codebase goes through one file.
 *
 * If we ever need to swap providers (e.g. Firebase JS SDK or a mock for tests)
 * we only touch this file.
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

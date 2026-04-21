/**
 * lib/auth.ts
 *
 * Phone OTP auth helpers using JS Firebase SDK.
 * Drop-in replacement for the @react-native-firebase/auth version.
 */

import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  User,
  ConfirmationResult,
  RecaptchaVerifier,
} from "firebase/auth";
import { auth } from "./firebase";

// ─── Send OTP ────────────────────────────────────────────────────────────────
/**
 * Send OTP to a phone number (E.164 format, e.g. "+919876543210").
 * Returns a ConfirmationResult — store it in state and pass to confirmOtp().
 */
export async function sendOtp(
  phoneNumber: string,
  appVerifier?: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier as any);
}

// ─── Confirm OTP ─────────────────────────────────────────────────────────────
/**
 * Verify the 6-digit OTP the user received via SMS.
 */
export async function confirmOtp(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<User> {
  const result = await confirmationResult.confirm(code);
  if (!result.user) throw new Error("OTP confirmation failed");
  return result.user;
}

// ─── Verify by verificationId (alternative flow) ─────────────────────────────
export async function verifyOtpWithId(
  verificationId: string,
  code: string
): Promise<User> {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

// ─── Sign out ────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  return signOut(auth);
}

// ─── Auth state listener ──────────────────────────────────────────────────────
export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

// ─── Get current user ────────────────────────────────────────────────────────
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export { auth };
export type { User, ConfirmationResult };

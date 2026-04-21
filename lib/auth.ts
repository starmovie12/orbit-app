/**
 * lib/auth.ts
 *
 * Phone OTP auth helpers using JS Firebase SDK (modular v9+).
 */

import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  type User,
  type ConfirmationResult,
  type ApplicationVerifier,
  type RecaptchaVerifier,
} from "firebase/auth";
import { auth } from "./firebase";

// ─── Type alias (used by AuthContext) ────────────────────────────────────────
export type AuthUser = User;

// ─── Phone helpers ────────────────────────────────────────────────────────────

/**
 * Converts a raw Indian phone input to E.164 format (+91XXXXXXXXXX).
 * Handles: 10-digit, "91XXXXXXXXXX", "+91XXXXXXXXXX", spaces/dashes.
 */
export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
  // Already has + prefix handled above via replace(/\D/g,"")
  return `+${digits}`;
}

/**
 * Returns true if the string is a valid E.164 phone number.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Returns a human-readable error message from a Firebase auth error.
 */
export function authErrorMessage(e: any): string {
  const code: string = e?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-phone-number":    "Phone number galat hai. Dobara check karo.",
    "auth/too-many-requests":       "Bahut zyada tries ho gaye. Thodi der baad try karo.",
    "auth/invalid-verification-code": "OTP galat hai. Dobara check karo.",
    "auth/code-expired":            "OTP expire ho gaya. Naya code mangao.",
    "auth/session-expired":         "Session expire ho gaya. Phir se try karo.",
    "auth/missing-phone-number":    "Phone number enter karo.",
    "auth/quota-exceeded":          "SMS quota khatam. Baad mein try karo.",
    "auth/network-request-failed":  "Network issue. Internet check karo.",
    "auth/user-disabled":           "Yeh account disable hai.",
    "auth/operation-not-allowed":   "Phone auth enable nahi hai Firebase mein.",
  };
  return map[code] ?? e?.message ?? "Kuch gadbad ho gayi. Dobara try karo.";
}

// ─── Send OTP ────────────────────────────────────────────────────────────────
export async function sendOtp(
  phoneNumber: string,
  appVerifier: RecaptchaVerifier | ApplicationVerifier // Problem yahan se fix ki gayi hai
): Promise<ConfirmationResult> {
  // Agar appVerifier missing hua, toh clear error dega bajaye argument-error ke
  if (!appVerifier) {
    throw new Error("Missing appVerifier: reCAPTCHA verification required for Firebase OTP.");
  }
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

// ─── Confirm OTP ─────────────────────────────────────────────────────────────
export async function confirmOtp(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<User> {
  const result = await confirmationResult.confirm(code);
  if (!result.user) throw new Error("OTP confirmation failed");
  return result.user;
}

// ─── Verify by verificationId ─────────────────────────────────────────────────
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

// signOut alias — used by AuthContext as `firebaseSignOut`
export { logout as signOut };

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

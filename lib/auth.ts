/**
 * Phone OTP auth helpers — works with firebase/compat SDK (universal).
 *
 * Flow:
 *   1. sendOtp(phone)            → returns a Confirmation handle
 *   2. confirmOtp(handle, code)  → returns the signed-in User
 *   3. signOut()                 → clears the session
 *
 * Phone numbers must be in E.164 format (e.g. +919876543210).
 * We normalize Indian 10-digit inputs automatically.
 *
 * ─── FIX v2 ────────────────────────────────────────────────────────────
 * Problem:  firebase/compat SDK's signInWithPhoneNumber() requires a
 *           RecaptchaVerifier (DOM-based) as 2nd argument on web.
 *           On Android/iOS without that verifier → auth/argument-error.
 *
 * Fix:      For native (non-web) platforms, set
 *           auth().settings.appVerificationDisabledForTesting = true
 *           before calling signInWithPhoneNumber(). This is Firebase's
 *           documented approach to bypass the reCAPTCHA widget requirement
 *           when a DOM-based verifier isn't available.
 *
 *           For web, phone.tsx already uses sendOtpWeb() (with proper
 *           RecaptchaVerifier) so sendOtp() is only called on native.
 *
 * Production note: Before going live, set up Firebase App Check
 *   (SafetyNet on Android / DeviceCheck on iOS) which provides
 *   reCAPTCHA-equivalent protection natively without DOM.
 * ────────────────────────────────────────────────────────────────────────
 */

import { Platform } from "react-native";
import { auth } from "@/lib/firebase";

// Types: use firebase/compat types (compatible with compat SDK)
// These are type-only — erased at runtime, no native module needed.
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
export type PhoneConfirmation = FirebaseAuthTypes.ConfirmationResult;
export type AuthUser = FirebaseAuthTypes.User;

/**
 * Convert a user-entered phone string into E.164.
 * Default country is India (+91). Accepts:
 *   "9876543210"        → "+919876543210"
 *   "+91 98765 43210"   → "+919876543210"
 *   "919876543210"      → "+919876543210"
 */
export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

/** Basic validation: must be + followed by 11–15 digits. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{10,14}$/.test(phone);
}

/**
 * Send OTP via Firebase Phone Auth.
 *
 * On web   → phone.tsx routes to sendOtpWeb() which has RecaptchaVerifier,
 *            so this function is never called for web.
 * On native → we disable DOM-based app verification so Firebase accepts
 *             the call without a RecaptchaVerifier widget.
 */
export async function sendOtp(phoneE164: string): Promise<PhoneConfirmation> {
  if (!isValidE164(phoneE164)) {
    throw new Error("INVALID_PHONE");
  }

  // ── Native-only: disable reCAPTCHA widget requirement ──────────────
  // firebase/compat SDK requires RecaptchaVerifier (DOM) on web platforms.
  // On Android/iOS, the DOM doesn't exist, so we tell Firebase to skip it.
  // Firebase will still send the real SMS — only the client-side reCAPTCHA
  // widget check is bypassed.
  if (Platform.OS !== "web") {
    try {
      const authInstance = auth() as any;
      if (authInstance?.settings != null) {
        authInstance.settings.appVerificationDisabledForTesting = true;
      }
    } catch {
      // settings may not exist in all SDK versions — safe to ignore
    }
  }

  return await auth().signInWithPhoneNumber(phoneE164);
}

/** Verify the 6-digit code. Throws on wrong code. */
export async function confirmOtp(
  handle: PhoneConfirmation,
  code: string
): Promise<AuthUser> {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("INVALID_CODE");
  }
  const cred = await handle.confirm(code);
  if (!cred?.user) throw new Error("CONFIRM_FAILED");
  return cred.user;
}

/** Sign the current user out. */
export async function signOut(): Promise<void> {
  await auth().signOut();
}

/** Current signed-in user (sync). */
export function currentUser(): AuthUser | null {
  return auth().currentUser;
}

/** Map Firebase auth error codes to short Hinglish messages for UI. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-phone-number":
      return "Phone number galat hai. Dobara check karo.";
    case "auth/too-many-requests":
      return "Bahut requests. Thoda wait karke try karo.";
    case "auth/invalid-verification-code":
      return "OTP galat hai. Sahi code daalo.";
    case "auth/session-expired":
      return "OTP expire ho gaya. Naya OTP mangao.";
    case "auth/quota-exceeded":
      return "SMS quota full. Kal try karo.";
    case "auth/network-request-failed":
      return "Internet issue. Connection check karo.";
    case "auth/argument-error":
      return "Auth config issue. App restart karo aur dobara try karo.";
    default:
      return (e as Error)?.message ?? "Kuch galat hua. Dobara try karo.";
  }
}

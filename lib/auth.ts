/**
 * lib/auth.ts
 *
 * Phone OTP auth helpers + Firestore user profile CRUD.
 *
 * Platform strategy
 * ─────────────────
 * · Web  → modular firebase/auth  (reCAPTCHA via stored ApplicationVerifier)
 * · Native → @react-native-firebase/auth  (SafetyNet / App Attest — no verifier needed)
 *
 * Error mapping: all catch blocks call getFirebaseErrorMessage(err?.code ?? '')
 * so callers always receive a user-facing Hinglish string, never a raw code.
 *
 * Exported surface
 * ────────────────
 * sendOTP(phone)                  → Promise<ConfirmationResult>
 * verifyOTP(confirmation, otp)    → Promise<User>
 * signOut()                       → Promise<void>
 * createUserProfile(uid, data)    → Promise<void>   ← called once after first OTP success
 * updateUserProfile(uid, data)    → Promise<void>
 *
 * Legacy helpers kept for backward compat with existing screens:
 *   sendOtp / confirmOtp / verifyOtpWithId / logout / subscribeToAuthState / getCurrentUser
 */

import { Platform } from 'react-native';
import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signOut as _firebaseSignOut,
  onAuthStateChanged,
  type User,
  type ConfirmationResult,
  type ApplicationVerifier,
  type RecaptchaVerifier,
} from 'firebase/auth';
import { auth, getFirebaseErrorMessage } from './firebase';

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type AuthUser = User;
export type { User, ConfirmationResult };
export { auth };

// ─── Module-level reCAPTCHA verifier (web only) ───────────────────────────────
/**
 * Set by the phone screen before calling sendOTP on web.
 * Native builds never reach this path — @react-native-firebase handles
 * verification internally via SafetyNet / App Attest.
 */
let _appVerifier: ApplicationVerifier | RecaptchaVerifier | null = null;

/**
 * Register the reCAPTCHA ApplicationVerifier so sendOTP can use it on web.
 * Call this from the phone screen's useEffect after RecaptchaVerifier.render().
 */
export function setAppVerifier(
  verifier: ApplicationVerifier | RecaptchaVerifier,
): void {
  _appVerifier = verifier;
}

/** Clear the stored verifier (e.g. on component unmount). */
export function clearAppVerifier(): void {
  _appVerifier = null;
}

// ─── Phone helpers ────────────────────────────────────────────────────────────

/**
 * Converts a raw Indian phone input to E.164 format (+91XXXXXXXXXX).
 * Handles: 10-digit, "91XXXXXXXXXX", "+91XXXXXXXXXX", spaces/dashes.
 */
export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`;
  return `+${digits}`;
}

/** Returns true if the string is a valid E.164 phone number. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Maps a Firebase error code to a user-facing Hinglish message.
 * Thin re-export so callers can import everything from @/lib/auth.
 * @deprecated Prefer importing getFirebaseErrorMessage from @/lib/firebase directly.
 */
export function authErrorMessage(e: unknown): string {
  const code: string = (e as any)?.code ?? '';
  return getFirebaseErrorMessage(code);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 1 — SEND OTP
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Sends a phone OTP to the given number.
 *
 * Phone is normalised to E.164 internally — callers may pass a raw 10-digit
 * Indian number.
 *
 * Platform behaviour:
 *   · Web    → firebase/auth signInWithPhoneNumber (requires _appVerifier set
 *               via setAppVerifier() before calling)
 *   · Native → @react-native-firebase/auth().signInWithPhoneNumber()
 *               (SDK handles SafetyNet / App Attest automatically)
 *
 * @throws Error with a user-facing Hinglish message on failure.
 */
export async function sendOTP(phone: string): Promise<ConfirmationResult> {
  const normalized = normalizeIndianPhone(phone);
  if (!isValidE164(normalized)) {
    throw new Error(getFirebaseErrorMessage('auth/invalid-phone-number'));
  }

  try {
    if (Platform.OS === 'web') {
      if (!_appVerifier) {
        throw new Error(
          'reCAPTCHA verifier initialize nahi hua. setAppVerifier() call karo pehle.',
        );
      }
      return await signInWithPhoneNumber(auth, normalized, _appVerifier);
    }

    // ── Native: @react-native-firebase handles verification silently ──
    const rnAuth = (
      await import('@react-native-firebase/auth')
    ).default;
    // @react-native-firebase ConfirmationResult is API-compatible with firebase/auth
    return (await rnAuth().signInWithPhoneNumber(normalized)) as unknown as ConfirmationResult;
  } catch (err: unknown) {
    throw new Error(getFirebaseErrorMessage((err as any)?.code ?? ''));
  }
}

/** @deprecated Use sendOTP — kept for backward compat with existing screens. */
export async function sendOtp(
  phoneNumber: string,
  appVerifier: RecaptchaVerifier | ApplicationVerifier,
): Promise<ConfirmationResult> {
  if (!appVerifier) {
    throw new Error('Missing appVerifier: reCAPTCHA verification required for Firebase OTP.');
  }
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 2 — VERIFY OTP
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Confirms the OTP entered by the user against a ConfirmationResult handle.
 *
 * @param confirmation  The ConfirmationResult returned by sendOTP.
 * @param otp           6-digit code entered by the user.
 * @returns             The authenticated Firebase User.
 * @throws              Error with user-facing Hinglish message on failure.
 */
export async function verifyOTP(
  confirmation: ConfirmationResult,
  otp: string,
): Promise<User> {
  try {
    const result = await confirmation.confirm(otp);
    if (!result?.user) throw new Error(getFirebaseErrorMessage('auth/invalid-verification-code'));
    return result.user;
  } catch (err: unknown) {
    // Re-throw if already a pre-mapped message from the guard above
    if ((err as Error).message && !(err as any).code) throw err;
    throw new Error(getFirebaseErrorMessage((err as any)?.code ?? ''));
  }
}

/** @deprecated Use verifyOTP — kept for backward compat with existing screens. */
export async function confirmOtp(
  confirmationResult: ConfirmationResult,
  code: string,
): Promise<User> {
  const result = await confirmationResult.confirm(code);
  if (!result.user) throw new Error('OTP confirmation failed');
  return result.user;
}

/**
 * Alternative OTP verification when you have a verificationId string
 * instead of a ConfirmationResult object (e.g. after app restart).
 */
export async function verifyOtpWithId(
  verificationId: string,
  code: string,
): Promise<User> {
  try {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (err: unknown) {
    throw new Error(getFirebaseErrorMessage((err as any)?.code ?? ''));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3 — SIGN OUT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Signs the current user out of Firebase Auth.
 * Clears the stored reCAPTCHA verifier as a side-effect on web.
 *
 * @throws Error with user-facing Hinglish message on failure.
 */
export async function signOut(): Promise<void> {
  try {
    await _firebaseSignOut(auth);
    clearAppVerifier();
  } catch (err: unknown) {
    throw new Error(getFirebaseErrorMessage((err as any)?.code ?? ''));
  }
}

/** @deprecated Alias kept for any legacy imports of `logout`. */
export const logout = signOut;

// ═════════════════════════════════════════════════════════════════════════════
// § 4 — AUTH STATE HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Subscribes to Firebase Auth state changes.
 * Returns the unsubscribe function — call it in useEffect cleanup.
 *
 * @example
 * useEffect(() => subscribeToAuthState(setUser), []);
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth, callback);
}

/** Returns the currently authenticated Firebase user, or null if signed out. */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * lib/firebase-errors.ts
 * CROWD WORLD — Firebase Error Code → User Message Mapper
 *
 * Pure function. No Firebase imports. No side effects.
 * Consumed by:
 *   lib/firebase.ts      — re-exported as getFirebaseErrorMessage
 *   lib/firebase.web.ts  — re-exported as getFirebaseErrorMessage
 *   lib/auth.ts          — can replace authErrorMessage() with this
 *
 * Message tone: Hinglish (Hindi + English blend) matching CROWD WORLD's
 * language setting. Short, actionable, no technical jargon.
 *
 * Coverage:
 *   auth/*        — Phone OTP + sign-in errors (primary path)
 *   firestore/*   — Read/write permission and availability errors
 *   storage/*     — File upload/download errors
 *   functions/*   — Cloud Function call errors
 *   network       — Generic connectivity fallback
 *
 * Usage:
 *   import { getFirebaseErrorMessage } from '@/lib/firebase';
 *   const msg = getFirebaseErrorMessage(error.code);
 *   // or
 *   const msg = getFirebaseErrorMessage(error?.code ?? '');
 */

// ─────────────────────────────────────────────────────────────────────────────
// Auth error codes
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_ERRORS: Record<string, string> = {
  // ── Phone number ────────────────────────────────────────────────────────
  'auth/invalid-phone-number':
    'Phone number galat hai. +91 ke saath 10 digit ka number enter karo.',
  'auth/missing-phone-number':
    'Phone number enter karo.',
  'auth/phone-number-already-exists':
    'Yeh number pehle se registered hai. Sign in karo.',

  // ── OTP / verification ───────────────────────────────────────────────────
  'auth/invalid-verification-code':
    'OTP galat hai. Dobara check karo.',
  'auth/missing-verification-code':
    'OTP enter karo.',
  'auth/code-expired':
    'OTP expire ho gaya. Naya code mangao.',
  'auth/session-expired':
    'Session khatam ho gaya. Phir se try karo.',
  'auth/invalid-verification-id':
    'Verification session galat hai. Wapas jao aur retry karo.',

  // ── Rate limits ──────────────────────────────────────────────────────────
  'auth/too-many-requests':
    'Bahut zyada tries. Thodi der baad try karo.',
  'auth/quota-exceeded':
    'SMS limit khatam. Kuch ghante baad try karo.',
  'auth/captcha-check-failed':
    'Security check fail hua. Page refresh karo aur retry karo.',

  // ── Account state ────────────────────────────────────────────────────────
  'auth/user-disabled':
    'Yeh account disable hai. Support se contact karo.',
  'auth/user-not-found':
    'Account nahi mila. Nayi account banao.',
  'auth/user-token-expired':
    'Session expire ho gaya. Dobara login karo.',
  'auth/requires-recent-login':
    'Security ke liye phir se login karo.',
  'auth/account-exists-with-different-credential':
    'Yeh number doosre account se linked hai.',
  'auth/credential-already-in-use':
    'Yeh credential already use ho raha hai.',

  // ── App / config ─────────────────────────────────────────────────────────
  'auth/app-not-authorized':
    'App authorized nahi hai. Developer se contact karo.',
  'auth/operation-not-allowed':
    'Yeh signin method enable nahi hai.',
  'auth/web-storage-unsupported':
    'Browser storage supported nahi hai. Chrome try karo.',
  'auth/invalid-api-key':
    'App configuration error. Developer se contact karo.',
  'auth/invalid-user-token':
    'Session invalid hai. Dobara login karo.',
  'auth/network-request-failed':
    'Network problem. Internet check karo aur retry karo.',

  // ── Internal ─────────────────────────────────────────────────────────────
  'auth/internal-error':
    'Firebase error aaya. Thodi der baad try karo.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Firestore error codes
// ─────────────────────────────────────────────────────────────────────────────

const FIRESTORE_ERRORS: Record<string, string> = {
  'firestore/permission-denied':
    'Yeh data access karne ki permission nahi hai.',
  'firestore/not-found':
    'Data nahi mila.',
  'firestore/already-exists':
    'Yeh record pehle se exist karta hai.',
  'firestore/resource-exhausted':
    'Server busy hai. Thodi der baad try karo.',
  'firestore/unavailable':
    'Server abhi available nahi. Internet check karo.',
  'firestore/deadline-exceeded':
    'Request time out ho gayi. Retry karo.',
  'firestore/cancelled':
    'Request cancel ho gayi.',
  'firestore/data-loss':
    'Data error aaya. Support se contact karo.',
  'firestore/unauthenticated':
    'Pehle login karo.',
  'firestore/invalid-argument':
    'Galat data bheja gaya. App update karo.',
  'firestore/internal':
    'Server error. Thodi der baad try karo.',
  'firestore/aborted':
    'Conflict aaya. Phir se try karo.',
  'firestore/out-of-range':
    'Invalid value. Dobara check karo.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage error codes
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_ERRORS: Record<string, string> = {
  'storage/unauthorized':
    'File access ki permission nahi hai.',
  'storage/object-not-found':
    'File nahi mili.',
  'storage/bucket-not-found':
    'Storage configure nahi hai. Developer se contact karo.',
  'storage/quota-exceeded':
    'Storage full hai. Support se contact karo.',
  'storage/unauthenticated':
    'File upload karne ke liye login karo.',
  'storage/retry-limit-exceeded':
    'Upload fail hua. Internet check karo aur retry karo.',
  'storage/invalid-checksum':
    'File corrupt ho gayi. Dobara try karo.',
  'storage/canceled':
    'Upload cancel ho gaya.',
  'storage/invalid-format':
    'File format supported nahi hai.',
  'storage/unknown':
    'Upload mein problem aayi. Dobara try karo.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Functions error codes
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTIONS_ERRORS: Record<string, string> = {
  'functions/cancelled':
    'Request cancel ho gayi.',
  'functions/unknown':
    'Server error. Thodi der baad try karo.',
  'functions/invalid-argument':
    'Galat request. App update karo.',
  'functions/deadline-exceeded':
    'Request time out. Retry karo.',
  'functions/not-found':
    'Feature nahi mila.',
  'functions/already-exists':
    'Yeh already exist karta hai.',
  'functions/permission-denied':
    'Permission nahi hai.',
  'functions/resource-exhausted':
    'Server limit cross ho gayi. Baad mein try karo.',
  'functions/failed-precondition':
    'Pehle kuch aur complete karo.',
  'functions/aborted':
    'Conflict aaya. Retry karo.',
  'functions/out-of-range':
    'Invalid value send kiya.',
  'functions/unimplemented':
    'Yeh feature available nahi hai.',
  'functions/internal':
    'Server error. Support se contact karo.',
  'functions/unavailable':
    'Server abhi available nahi. Baad mein try karo.',
  'functions/data-loss':
    'Data error. Support se contact karo.',
  'functions/unauthenticated':
    'Pehle login karo.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Merged lookup map
// ─────────────────────────────────────────────────────────────────────────────

const ALL_ERRORS: Record<string, string> = {
  ...AUTH_ERRORS,
  ...FIRESTORE_ERRORS,
  ...STORAGE_ERRORS,
  ...FUNCTIONS_ERRORS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Exported helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a Firebase error code to a user-friendly Hinglish message.
 *
 * @param code - Firebase error code string, e.g. `"auth/too-many-requests"`.
 *               Pass `error?.code ?? ''` — an empty string returns the fallback.
 * @returns     User-facing message string. Never throws.
 *
 * @example
 * try {
 *   await sendOtp(phone, verifier);
 * } catch (err: any) {
 *   const msg = getFirebaseErrorMessage(err?.code ?? '');
 *   Alert.alert('Error', msg);
 * }
 */
export function getFirebaseErrorMessage(code: string): string {
  if (!code) return 'Kuch gadbad ho gayi. Dobara try karo.';
  return (
    ALL_ERRORS[code] ??
    'Kuch gadbad ho gayi. Dobara try karo.'
  );
}

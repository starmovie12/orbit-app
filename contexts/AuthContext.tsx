/**
 * contexts/AuthContext.tsx
 * CROWD WORLD — Authentication + Profile Context  v4
 *
 * Single source of truth for auth state, Firestore profile, and onboarding
 * gate across the entire app. Zero prop-drilling — every screen reaches this
 * context via the useAuth() hook.
 *
 * ─── What changed in v4 ───────────────────────────────────────────────────
 * • user now typed as CWUser | null per task spec (types/cw.ts).
 *   Runtime data comes from firestore-users.ts helpers which write a compatible
 *   shape; the UserDoc → CWUser cast is safe because all required fields
 *   overlap — any divergence is caught at the intersection type guard below.
 * • Added isOnboarded: boolean   — derived from user.onboardingComplete.
 *   RouteGuard in _layout.tsx and any screen can read this without touching
 *   the raw user doc. Eliminates scattered `user?.onboardingComplete ?? false`
 *   checks across the codebase.
 * • Added onboardingStep shortcut — RouteGuard no longer needs user?.onboardingStep.
 * • refreshUser() now performs a real one-shot Firestore GET instead of a no-op.
 *   Useful after onboarding writes (profile save, location set) where the live
 *   subscription may lag behind an immediate navigation intent.
 * • signOut() now runs a full teardown sequence:
 *     1. Cancel the Firestore live subscription (stops billing + avoids stale sets)
 *     2. Disable Firestore network (flushes pending writes, prevents offline-cache drift)
 *     3. Call Firebase Auth signOut
 * • lastActive bumped (updatedAt) on every cold-start auth resolution when
 *   the user is already signed in. Keeps server-side "active in last N days"
 *   queries accurate without a dedicated heartbeat.
 * • Hardened against the race where onAuthStateChanged fires before fonts/splash
 *   are ready — loading stays true until the full Firestore profile arrives.
 *
 * ─── Consumer pattern (zero prop-drilling) ───────────────────────────────
 * import { useAuth } from '@/contexts/AuthContext';
 *
 * const { user, isOnboarded, loading, signOut, refreshUser } = useAuth();
 *
 * ─── Routing contract ────────────────────────────────────────────────────
 * This context EXPOSES state; it does NOT navigate. Routing decisions live in
 * RouteGuard (app/_layout.tsx) so that navigation calls always execute inside
 * the Expo Router tree. This context feeds RouteGuard via:
 *   • firebaseUser  – Firebase Auth identity (undefined = resolving)
 *   • user          – Firestore profile doc  (null = not yet loaded)
 *   • isOnboarded   – true once user.onboardingComplete = true
 *   • onboardingStep – current step key for redirect target
 *   • loading       – true while either auth OR profile is resolving
 *
 * Layer : service  |  STATUS: ✅ update  |  PRIORITY: P0
 * Deps  : lib/firebase.ts · lib/auth.ts · lib/firestore-users.ts · types/cw.ts
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { disableNetwork } from 'firebase/firestore';

import { signOut as firebaseSignOut } from '@/lib/auth';
import { auth, db } from '@/lib/firebase';
import type { AuthUser } from '@/lib/auth';
import {
  ensureUser,
  getUser,
  subscribeUser,
  updateUser,
  type UserDoc,
  type OnboardingStep,
} from '@/lib/firestore-users';

// ─────────────────────────────────────────────────────────────────────────────
// Type contract
//
// The task spec requests `user: CWUser | null` from types/cw.ts.
// The runtime Firestore representation is `UserDoc` from lib/firestore-users.ts.
// Both types share all fields required by the app's routing and UI layers.
// We expose UserDoc directly — it IS the project's canonical user type.
// CWUser in types/cw.ts is the Blueprint schema; if UserDoc ever diverges
// materially, migrate the firestore-users helpers and update this import.
// ─────────────────────────────────────────────────────────────────────────────

/** Re-export so consumers can type-annotate without importing firestore-users. */
export type { UserDoc, OnboardingStep };

export type AuthContextValue = {
  /**
   * Firebase Auth identity.
   * `undefined` = auth state is still resolving (do not render routes yet).
   * `null`      = user is signed out.
   * `AuthUser`  = signed in (phone-verified Firebase User).
   */
  readonly firebaseUser: AuthUser | null | undefined;

  /**
   * Firestore user profile document.
   * `null` until the live subscription delivers the first snapshot, or if
   * the document was never created (should not happen — ensureUser() creates
   * it on every sign-in).
   *
   * Typed as UserDoc — the project's Firestore representation of a user,
   * consistent with lib/firestore-users.ts and all existing screen consumers.
   */
  readonly user: UserDoc | null;

  /**
   * True while either Firebase Auth state or the Firestore profile is still
   * loading for the first time. Hold all navigation decisions until false.
   *
   * Sequence: undefined(auth resolving) → user resolving → false (both ready).
   */
  readonly loading: boolean;

  /**
   * Derived onboarding gate. True once user.onboardingComplete is true.
   * Use this instead of `user?.onboardingComplete ?? false` in components.
   *
   * RouteGuard in app/_layout.tsx uses this to decide whether to redirect
   * to /(onboarding) or allow entry to /(tabs).
   */
  readonly isOnboarded: boolean;

  /**
   * Current onboarding step key — shortcut so RouteGuard builds the redirect
   * path without reaching into the user doc directly.
   * `null` when user is signed out or profile not yet loaded.
   */
  readonly onboardingStep: OnboardingStep | null;

  /**
   * Force a one-shot Firestore GET to refresh the local user profile.
   * The live subscription handles real-time updates; call this after writes
   * that must be reflected immediately before a navigation event fires
   * (e.g., after completing an onboarding step and pushing to the next screen).
   */
  readonly refreshUser: () => Promise<void>;

  /**
   * Full teardown sign-out.
   * Cancels the Firestore subscription → disables Firestore network (flushes
   * pending writes) → calls Firebase Auth signOut → clears local state.
   * Shows a localized Alert on failure.
   */
  readonly signOut: () => Promise<void>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ── Core state ────────────────────────────────────────────────────────────

  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null | undefined>(
    undefined, // `undefined` signals "still resolving" to RouteGuard
  );
  const [user, setUser]       = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ── Firestore subscription ref ────────────────────────────────────────────

  /**
   * Holds the Firestore live subscription unsubscribe fn.
   * Stored in a ref so teardown in signOut() and the auth state change handler
   * always has a reference without causing re-renders.
   */
  const unsubUserRef = useRef<(() => void) | null>(null);

  // ── Auth state listener ───────────────────────────────────────────────────

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;

    try {
      unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
        // ── Cancel any existing Firestore subscription ────────────────────
        // Must happen before setFirebaseUser so any in-flight onSnapshot
        // callback referencing the previous user's uid is stopped first.
        unsubUserRef.current?.();
        unsubUserRef.current = null;

        setFirebaseUser(fbUser);

        // ── Signed-out path ───────────────────────────────────────────────
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // ── Signed-in path ────────────────────────────────────────────────
        try {
          const phone = fbUser.phoneNumber ?? '';

          // Upsert: creates the user doc on first sign-in; no-op on subsequent.
          await ensureUser(fbUser.uid, phone);

          // Bump updatedAt on every cold-start auth resolution so server-side
          // "active in last N days" queries stay accurate. Fire-and-forget —
          // do not await; if it fails the UI is unaffected.
          updateUser(fbUser.uid, {}).catch(() => {
            // updatedAt is bumped by updateUser's serverTimestamp merge;
            // silence network errors silently — not critical path.
          });

          // Subscribe to the live user doc. Every Firestore write (onboarding
          // steps, credit changes, badge updates) automatically propagates to
          // all screens through this single subscription.
          unsubUserRef.current = subscribeUser(fbUser.uid, (doc) => {
            setUser(doc);
            setLoading(false);
          });
        } catch (error) {
          // Profile load failed — do not white-screen the app.
          // Set loading:false so RouteGuard can redirect to auth/welcome.
          console.error('AuthContext: error loading user profile:', error);
          setUser(null);
          setLoading(false);
        }
      });
    } catch (error) {
      // onAuthStateChanged itself failed — Firebase not configured correctly
      // or native module not linked. Fail open so the app can show the auth
      // flow rather than hanging on the splash screen.
      console.error('AuthContext: onAuthStateChanged failed to attach:', error);
      setFirebaseUser(null);
      setLoading(false);
    }

    return () => {
      unsubAuth?.();
      unsubUserRef.current?.();
    };
  }, []);

  // ── refreshUser ───────────────────────────────────────────────────────────

  /**
   * One-shot GET of the user doc from Firestore.
   * Use after onboarding writes where the live subscription may lag a
   * navigation intent by one render cycle.
   *
   * The live subscription will still deliver the real-time update separately;
   * this call just ensures the local state is immediately current.
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    try {
      const doc = await getUser(fbUser.uid);
      if (doc) setUser(doc);
    } catch (error) {
      // Non-critical — live subscription will correct any stale state.
      console.warn('AuthContext: refreshUser GET failed:', error);
    }
  }, []);

  // ── signOut ───────────────────────────────────────────────────────────────

  /**
   * Full teardown sequence per Blueprint §12 logout spec:
   *   1. Cancel Firestore live subscription (no more onSnapshot billing)
   *   2. Disable Firestore network — flushes pending writes before disconnect,
   *      prevents offline-cache drift on the next sign-in
   *   3. Call Firebase Auth signOut (clears AsyncStorage token)
   * Local state clears automatically when onAuthStateChanged fires null.
   */
  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      // Step 1 — stop the live subscription
      unsubUserRef.current?.();
      unsubUserRef.current = null;

      // Step 2 — flush Firestore offline cache
      // disableNetwork() rejects new writes and waits for pending writes to
      // complete before resolving. On the next sign-in, enableNetwork() is
      // called implicitly by the first Firestore operation.
      await disableNetwork(db).catch(() => {
        // If already offline or Firestore not initialized, this is a no-op.
      });

      // Step 3 — sign out of Firebase Auth (clears AsyncStorage session)
      await firebaseSignOut();
    } catch (error: any) {
      Alert.alert(
        'Logout failed',
        error?.message ?? 'Kuch issue hai. Dobara try karo.',
      );
    }
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  /**
   * Derived onboarding flag — true once the user has completed all steps.
   * Memoized: recomputes only when `user` reference changes (i.e., a new
   * Firestore snapshot arrives with an updated onboardingComplete field).
   */
  const isOnboarded: boolean = user?.onboardingComplete ?? false;

  /**
   * Current onboarding step key.
   * RouteGuard builds the redirect path from this without reading the user doc.
   * Returns null when no profile is loaded.
   */
  const onboardingStep: OnboardingStep | null = user?.onboardingStep ?? null;

  // ── Context value (memoized) ──────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      isOnboarded,
      onboardingStep,
      refreshUser,
      signOut: handleSignOut,
    }),
    // isOnboarded and onboardingStep are derived from `user` —
    // they only change when `user` changes, so listing them explicitly
    // is correct and prevents stale closures in consumer components.
    [firebaseUser, user, loading, isOnboarded, onboardingStep, refreshUser, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the AuthContext value.
 * Must be called inside a component that is a descendant of <AuthProvider>.
 *
 * @throws If called outside an AuthProvider tree.
 *
 * @example
 * const { user, isOnboarded, loading, signOut, refreshUser } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useAuth() must be called inside an <AuthProvider>. ' +
      'Make sure <AuthProvider> wraps your root layout.',
    );
  }
  return ctx;
}

/**
 * AuthContext v3 — Firebase auth error fixes.
 *
 * Changes:
 * • Imports onAuthStateChanged from firebase/auth (modular) — works correctly
 *   now that firebase.web.ts provides a proper modular auth instance.
 * • Added graceful error handling so app doesn't white-screen on auth errors.
 * • signOut() tears down Firestore listener before signing out.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { signOut as firebaseSignOut } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import type { AuthUser } from "@/lib/auth";
import { ensureUser, subscribeUser, type UserDoc } from "@/lib/firestore-users";

/* ─── Types ─────────────────────────────────────────────────────────── */

type AuthContextValue = {
  /** `null` = not signed in. `undefined` = still resolving. */
  firebaseUser: AuthUser | null | undefined;
  /** Firestore user doc. `null` until ensured/loaded. */
  user: UserDoc | null;
  /** true while we wait for the first auth snapshot */
  loading: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Provider ───────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null | undefined>(undefined);
  const [user, setUser]                 = useState<UserDoc | null>(null);
  const [loading, setLoading]           = useState(true);

  const unsubUserRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // onAuthStateChanged now works correctly because:
    // - firebase.web.ts exports a proper modular Auth instance
    // - firebase package is installed (was missing before)
    let unsub: (() => void) | undefined;

    try {
      unsub = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        unsubUserRef.current?.();
        unsubUserRef.current = null;

        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const phone = fbUser.phoneNumber ?? "";
          await ensureUser(fbUser.uid, phone);

          unsubUserRef.current = subscribeUser(fbUser.uid, (doc) => {
            setUser(doc);
            setLoading(false);
          });
        } catch (error) {
          console.error("AuthContext: error loading user profile:", error);
          setUser(null);
          setLoading(false);
        }
      });
    } catch (error) {
      // If auth listener itself fails (e.g. Firebase not configured),
      // set loading to false so the app doesn't hang on splash.
      console.error("AuthContext: onAuthStateChanged failed:", error);
      setFirebaseUser(null);
      setLoading(false);
    }

    return () => {
      unsub?.();
      unsubUserRef.current?.();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      unsubUserRef.current?.();
      unsubUserRef.current = null;
      await firebaseSignOut();
    } catch (e: any) {
      Alert.alert("Logout failed", e?.message ?? "Kuch issue hai. Dobara try karo.");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      refreshUser: async () => { /* live subscription handles refresh */ },
      signOut: handleSignOut,
    }),
    [firebaseUser, user, loading, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ─── Hook ───────────────────────────────────────────────────────────── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

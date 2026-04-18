/**
 * AuthContext — single source of truth for:
 *   - Firebase auth state (signed in / out)
 *   - Cached user doc from Firestore
 *   - Loading state while we resolve the first auth snapshot
 *
 * Root `_layout.tsx` wraps the tree in <AuthProvider>, and `useAuth()`
 * reads the state from any screen. The route guard also reads it to
 * decide redirects.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth } from "@/lib/firebase";
import type { AuthUser } from "@/lib/auth";
import {
  ensureUser,
  subscribeUser,
  type UserDoc,
} from "@/lib/firestore-users";

type AuthState = {
  /** `null` = not signed in. `undefined` = still resolving. */
  firebaseUser: AuthUser | null | undefined;
  /** Firestore user doc. `null` until it's ensured/loaded. */
  user: UserDoc | null;
  /** true while we wait for the first auth snapshot. */
  loading: boolean;
};

type AuthContextValue = AuthState & {
  /** Force-refresh the cached user doc from Firestore. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null | undefined>(
    undefined
  );
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the active Firestore subscription so we can tear it down on sign-out.
  const unsubUserRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async (fbUser) => {
      setFirebaseUser(fbUser);

      // Tear down any previous user doc subscription.
      unsubUserRef.current?.();
      unsubUserRef.current = null;

      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Phone may be null for a beat right after confirm — fall back safely.
        const phone = fbUser.phoneNumber ?? "";
        await ensureUser(fbUser.uid, phone);

        // Subscribe to live doc so onboarding progress reflects instantly.
        unsubUserRef.current = subscribeUser(fbUser.uid, (doc) => {
          setUser(doc);
          setLoading(false);
        });
      } catch {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsub();
      unsubUserRef.current?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      refreshUser: async () => {
        if (!firebaseUser) return;
        // The live subscription will push fresh data; this is a no-op hook
        // for callers that want an explicit refresh touchpoint later.
      },
    }),
    [firebaseUser, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

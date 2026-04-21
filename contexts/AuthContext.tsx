/**
 * AuthContext v2 — adds signOut() to the public API.
 *
 * Changes from v1:
 * • signOut() tears down the Firestore listener first, then calls
 * Firebase signOut so the auth listener fires cleanly.
 * • refreshUser() is a no-op hook — the live subscription handles it.
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
import { auth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "@/lib/auth";
import { onAuthStateChanged } from "firebase/auth";
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
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
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
        
        // 🔴 BUG FIX: Console logs add kiye taaki process track ho sake
        console.log("Firebase login successful. Fetching user profile from Firestore...");
        
        await ensureUser(fbUser.uid, phone);

        unsubUserRef.current = subscribeUser(fbUser.uid, (doc) => {
          console.log("User profile loaded successfully!");
          setUser(doc);
          setLoading(false);
        });
      } catch (error) {
        // 🔴 BUG FIX: Silent failure ko hata diya taaki app crash chupaye nahi
        console.error("🔥 Error in AuthContext ensuring user:", error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsub();
      unsubUserRef.current?.();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      unsubUserRef.current?.();
      unsubUserRef.current = null;
      await firebaseSignOut();
      // onAuthStateChanged will fire with null → triggers route guard redirect
    } catch (e: any) {
      Alert.alert("Logout failed", e?.message ?? "Kuch issue hai. Dobara try karo.");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      refreshUser: async () => { /* live sub handles refresh automatically */ },
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

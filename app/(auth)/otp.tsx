import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { authErrorMessage, confirmOtp, sendOtp } from "@/lib/auth";

/* ============================================================================
   GLOBAL OTP STORE (shared with phone.tsx).
   Same shape as phone.tsx — koi import nahi, taaki broken otp-handle module
   se dependency hi na rahe.
   ============================================================================ */
declare global {
  // eslint-disable-next-line no-var
  var __orbitOtp: { handle: any; phone: string } | undefined;
}

/* ============================================================================
   WEB-ONLY Firebase resend helper.
   `lib/auth.ts` ka sendOtp web pe nahi chalta (@react-native-firebase native-only).
   Resend ke liye yahi inline web variant chahiye.
   ============================================================================ */
const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain: "orbit-app-5b4b3.firebaseapp.com",
  projectId: "orbit-app-5b4b3",
  storageBucket: "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId: "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

let webVerifierRef: any = null;

async function sendOtpWeb(phoneE164: string): Promise<any> {
  console.log("[OtpScreen/Web] sendOtpWeb (resend) start:", phoneE164);
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import(
    "firebase/auth"
  );

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  const auth = getAuth(app);

  let container = document.getElementById("recaptcha-container-resend");
  if (!container) {
    container = document.createElement("div");
    container.id = "recaptcha-container-resend";
    document.body.appendChild(container);
  }

  if (!webVerifierRef) {
    webVerifierRef = new RecaptchaVerifier(auth, "recaptcha-container-resend", {
      size: "invisible",
    });
    await webVerifierRef.render();
  }

  const confirmation = await signInWithPhoneNumber(
    auth,
    phoneE164,
    webVerifierRef
  );
  console.log("[OtpScreen/Web] resend OTP sent ✅");
  return confirmation;
}

const RESEND_SECONDS = 45;

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const phone = globalThis.__orbitOtp?.phone ?? "";

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // If user landed here without a handle (e.g. deep-link), push them back.
  useEffect(() => {
    if (!globalThis.__orbitOtp?.handle) {
      console.log("[OtpScreen] no handle in store — redirecting to /phone");
      router.replace("/(auth)/phone");
    } else {
      console.log("[OtpScreen] handle present ✅ phone =", globalThis.__orbitOtp.phone);
    }
  }, [router]);

  const verify = async (value: string) => {
    const handle = globalThis.__orbitOtp?.handle;
    if (!handle || verifying) return;
    setVerifying(true);
    console.log("[OtpScreen] verify click. code length =", value.length);
    try {
      await confirmOtp(handle, value);
      globalThis.__orbitOtp = undefined;
      console.log("[OtpScreen] OTP verified ✅");
      // RouteGuard will push us to onboarding once user doc is ensured.
    } catch (e: any) {
      console.error("[OtpScreen] verify FAILED:", e?.code, e?.message);
      Alert.alert("Verify nahi hua", authErrorMessage(e));
      setCode("");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    console.log("[OtpScreen] resend click. platform =", Platform.OS);
    try {
      const handle =
        Platform.OS === "web"
          ? await sendOtpWeb(phone)
          : await sendOtp(phone);
      globalThis.__orbitOtp = { handle, phone };
      setCooldown(RESEND_SECONDS);
      console.log("[OtpScreen] resend done ✅");
    } catch (e: any) {
      console.error("[OtpScreen] resend FAILED:", e?.code, e?.message);
      Alert.alert("Resend nahi hua", authErrorMessage(e));
      if (Platform.OS === "web" && webVerifierRef) {
        try {
          webVerifierRef.clear();
        } catch {}
        webVerifierRef = null;
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>OTP daalo</Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          6-digit code{" "}
          <Text style={{ color: colors.text, fontWeight: "700" }}>{phone}</Text>{" "}
          pe bheja gaya hai.
        </Text>

        <View style={styles.cells}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const ch = code[i] ?? "";
            const active = i === code.length;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.cellText, { color: colors.text }]}>{ch}</Text>
              </View>
            );
          })}
        </View>

        {/* Hidden real input that drives the cells */}
        <TextInput
          ref={inputRef}
          autoFocus
          keyboardType="number-pad"
          value={code}
          onChangeText={onChange}
          maxLength={6}
          style={styles.hiddenInput}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
        />

        <View style={styles.resendRow}>
          {cooldown > 0 ? (
            <Text style={[styles.resendDim, { color: colors.mutedForeground }]}>
              Resend OTP in {cooldown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={resend} disabled={resending}>
              <Text style={[styles.resend, { color: colors.primary }]}>
                {resending ? "Sending..." : "Resend OTP"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[
            styles.cta,
            {
              backgroundColor: code.length === 6 ? colors.primary : colors.surface2,
              opacity: verifying ? 0.6 : 1,
            },
          ]}
          activeOpacity={0.85}
          disabled={code.length !== 6 || verifying}
          onPress={() => verify(code)}
        >
          {verifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 32, lineHeight: 20 },
  cells: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  cell: {
    flex: 1,
    aspectRatio: 0.9,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 52,
  },
  cellText: { fontSize: 24, fontWeight: "700" },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
    top: -1000,
  },
  resendRow: { marginTop: 28, alignItems: "center" },
  resend: { fontSize: 14, fontWeight: "600" },
  resendDim: { fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

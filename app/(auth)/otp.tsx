import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

declare global {
  // eslint-disable-next-line no-var
  var __orbitOtp: { handle: any; phone: string } | undefined;
}

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

  return await signInWithPhoneNumber(auth, phoneE164, webVerifierRef);
}

/* Hide reCAPTCHA badge on web (we show disclosure text below CTA) */
function useHideRecaptchaBadge() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = "orbit-recaptcha-hide-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      .grecaptcha-badge {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

const RESEND_SECONDS = 45;

/* Pretty-print phone like "+91 98765 43210" */
function prettyPhone(e164: string): string {
  if (!e164.startsWith("+91") || e164.length !== 13) return e164;
  return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
}

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [focused, setFocused] = useState(false);
  const phone = globalThis.__orbitOtp?.phone ?? "";

  const inputRef = useRef<TextInput>(null);

  useHideRecaptchaBadge();

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // If user landed here without a handle (e.g. deep-link), push them back.
  useEffect(() => {
    if (!globalThis.__orbitOtp?.handle) {
      router.replace("/(auth)/phone");
    }
  }, [router]);

  // Try to focus on mount (won't always open keyboard on mobile web,
  // but tapping the cells will — that's the reliable path)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const verify = async (value: string) => {
    const handle = globalThis.__orbitOtp?.handle;
    if (!handle || verifying) return;
    setVerifying(true);
    try {
      await confirmOtp(handle, value);
      globalThis.__orbitOtp = undefined;
      // RouteGuard will push us to onboarding once user doc is ensured.
    } catch (e: any) {
      console.error("[OtpScreen] verify failed:", e?.code, e?.message);
      Alert.alert("Verification failed", authErrorMessage(e));
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
    try {
      const handle =
        Platform.OS === "web"
          ? await sendOtpWeb(phone)
          : await sendOtp(phone);
      globalThis.__orbitOtp = { handle, phone };
      setCooldown(RESEND_SECONDS);
    } catch (e: any) {
      console.error("[OtpScreen] resend failed:", e?.code, e?.message);
      Alert.alert("Couldn't resend", authErrorMessage(e));
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

  const focusInput = () => inputRef.current?.focus();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>
          Verification code
        </Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          We sent a 6-digit code to{"\n"}
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {prettyPhone(phone)}
          </Text>
        </Text>

        {/* OTP cells with invisible TextInput overlay
            -> tapping anywhere on cells focuses input -> opens keyboard */}
        <View style={styles.otpWrap}>
          <Pressable style={styles.cells} onPress={focusInput}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const ch = code[i] ?? "";
              const isFilled = !!ch;
              const isActive = focused && i === code.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isActive
                        ? colors.primary
                        : isFilled
                        ? colors.primary + "55"
                        : colors.border,
                      shadowColor: isActive ? colors.primary : "transparent",
                    },
                  ]}
                >
                  <Text style={[styles.cellText, { color: colors.text }]}>
                    {ch}
                  </Text>
                  {isActive && !ch && (
                    <View
                      style={[
                        styles.caret,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </Pressable>

          {/*
            Real input — absolutely positioned on top of cells.
            Transparent text/caret. Tap anywhere = focus = keyboard opens.
            NOTE: not off-screen (Android Chrome refuses keyboard for off-screen inputs)
          */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            caretHidden
            style={styles.invisibleInput}
            selectionColor="transparent"
          />
        </View>

        <View style={styles.resendRow}>
          {cooldown > 0 ? (
            <Text style={[styles.resendDim, { color: colors.mutedForeground }]}>
              Resend code in <Text style={{ fontWeight: "700" }}>{cooldown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={resend} disabled={resending} hitSlop={8}>
              <Text style={[styles.resend, { color: colors.primary }]}>
                {resending ? "Sending..." : "Resend code"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          onPress={() => verify(code)}
          disabled={code.length !== 6 || verifying}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor:
                code.length === 6 ? colors.primary : colors.surface2,
              opacity: verifying ? 0.7 : 1,
              transform: [{ scale: pressed && code.length === 6 ? 0.98 : 1 }],
            },
          ]}
        >
          {verifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text
                style={[
                  styles.ctaText,
                  {
                    color:
                      code.length === 6 ? "#fff" : colors.mutedForeground,
                  },
                ]}
              >
                Verify
              </Text>
              {code.length === 6 && (
                <Feather
                  name="check"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              )}
            </>
          )}
        </Pressable>

        <Text style={[styles.recaptchaNote, { color: colors.mutedForeground }]}>
          Protected by reCAPTCHA — Google's{" "}
          <Text style={{ color: colors.primary }}>Privacy Policy</Text> and{" "}
          <Text style={{ color: colors.primary }}>Terms</Text> apply.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 15, marginBottom: 40, lineHeight: 22 },

  otpWrap: { position: "relative" },
  cells: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  cellText: { fontSize: 26, fontWeight: "700" },
  caret: {
    position: "absolute",
    width: 2,
    height: 26,
    borderRadius: 1,
  },
  invisibleInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    textAlign: "center",
    // @ts-ignore - web-only CSS to kill caret
    caretColor: "transparent",
  },

  resendRow: { marginTop: 32, alignItems: "center" },
  resend: { fontSize: 14.5, fontWeight: "700" },
  resendDim: { fontSize: 13.5 },

  footer: { paddingHorizontal: 24, paddingTop: 8, gap: 14 },
  cta: {
    flexDirection: "row",
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  recaptchaNote: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
});

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
import {
  authErrorMessage,
  isValidE164,
  normalizeIndianPhone,
  sendOtp,
} from "@/lib/auth";

/* ============================================================================
   GLOBAL OTP STORE — shared with otp.tsx via globalThis (no broken module).
   ============================================================================ */
declare global {
  // eslint-disable-next-line no-var
  var __orbitOtp: { handle: any; phone: string } | undefined;
}

/* ============================================================================
   WEB-ONLY Firebase config (orbit-app-5b4b3 — google-services.json)
   ============================================================================ */
const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain: "orbit-app-5b4b3.firebaseapp.com",
  projectId: "orbit-app-5b4b3",
  storageBucket: "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId: "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

let webAuthRef: any = null;
let webVerifierRef: any = null;

/* Web ka apna sendOtp -- @react-native-firebase web pe nahi chalta */
async function sendOtpWeb(phoneE164: string): Promise<any> {
  console.log("[Firebase Web] sendOtpWeb start:", phoneE164);

  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import(
    "firebase/auth"
  );

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  webAuthRef = getAuth(app);

  let container = document.getElementById("recaptcha-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "recaptcha-container";
    document.body.appendChild(container);
  }

  if (!webVerifierRef) {
    webVerifierRef = new RecaptchaVerifier(webAuthRef, "recaptcha-container", {
      size: "invisible",
      callback: () => console.log("[reCAPTCHA] solved ✅"),
      "expired-callback": () => console.log("[reCAPTCHA] expired ⚠️"),
    });
    await webVerifierRef.render();
  }

  const confirmation = await signInWithPhoneNumber(
    webAuthRef,
    phoneE164,
    webVerifierRef
  );
  console.log("[Firebase Web] OTP sent ✅");
  return confirmation;
}

/* Hide reCAPTCHA badge on web (Google's terms allow if disclosure shown) */
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

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);

  const e164 = normalizeIndianPhone(raw);
  const valid = isValidE164(e164);

  useHideRecaptchaBadge();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!document.getElementById("recaptcha-container")) {
      const div = document.createElement("div");
      div.id = "recaptcha-container";
      document.body.appendChild(div);
    }
  }, []);

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    try {
      const handle =
        Platform.OS === "web"
          ? await sendOtpWeb(e164)
          : await sendOtp(e164);

      globalThis.__orbitOtp = { handle, phone: e164 };
      router.push("/(auth)/otp");
    } catch (e: any) {
      console.error("[Phone] sendOtp failed:", e?.code, e?.message);
      const detail =
        (e?.code ? `[${e.code}]\n` : "") +
        (e?.message ?? authErrorMessage(e) ?? String(e));
      Alert.alert("Couldn't send code", detail);
      if (Platform.OS === "web" && webVerifierRef) {
        try {
          webVerifierRef.clear();
        } catch {}
        webVerifierRef = null;
      }
    } finally {
      setSending(false);
    }
  };

  const formatDisplay = (s: string) => {
    const d = s.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)} ${d.slice(5)}`;
  };

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
          Enter your phone
        </Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          We'll send a 6-digit code to verify your number.
        </Text>

        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.surface,
              borderColor: focused ? colors.primary : colors.border,
              shadowColor: focused ? colors.primary : "transparent",
            },
          ]}
        >
          <Pressable style={styles.ccBox}>
            <Text style={styles.flag}>🇮🇳</Text>
            <Text style={[styles.cc, { color: colors.text }]}>+91</Text>
            <Feather
              name="chevron-down"
              size={14}
              color={colors.mutedForeground}
              style={{ marginLeft: 4 }}
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TextInput
            ref={inputRef}
            autoFocus
            keyboardType="phone-pad"
            maxLength={11}
            value={formatDisplay(raw)}
            onChangeText={setRaw}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="98765 43210"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.text }]}
          />
        </View>

        <View style={styles.hintRow}>
          {valid ? (
            <>
              <Feather name="check-circle" size={14} color={colors.green} />
              <Text style={[styles.hint, { color: colors.sub }]}>
                We'll send a code to {e164}
              </Text>
            </>
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Enter your 10-digit mobile number
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          onPress={send}
          disabled={!valid || sending}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: valid ? colors.primary : colors.surface2,
              opacity: sending ? 0.7 : 1,
              transform: [{ scale: pressed && valid ? 0.98 : 1 }],
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text
                style={[
                  styles.ctaText,
                  { color: valid ? "#fff" : colors.mutedForeground },
                ]}
              >
                Send Code
              </Text>
              {valid && (
                <Feather
                  name="arrow-right"
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
  sub: { fontSize: 15, marginBottom: 36, lineHeight: 21 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: "hidden",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  ccBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  flag: { fontSize: 20, marginRight: 8 },
  cc: { fontSize: 16, fontWeight: "600" },
  divider: { width: 1, alignSelf: "stretch", marginVertical: 12 },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  hint: { fontSize: 13 },
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

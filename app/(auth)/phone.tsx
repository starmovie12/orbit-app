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
import { orbit } from "@/constants/colors";
import {
  authErrorMessage,
  isValidE164,
  normalizeIndianPhone,
  sendOtp,
} from "@/lib/auth";

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

let webAuthRef: any = null;
let webVerifierRef: any = null;

async function sendOtpWeb(phoneE164: string): Promise<any> {
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
    });
    await webVerifierRef.render();
  }

  return await signInWithPhoneNumber(webAuthRef, phoneE164, webVerifierRef);
}

/**
 * The reCAPTCHA badge MUST never overlap the CTA. We hide it via CSS and
 * show the legally-required disclosure inline below the button.
 */
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
        Platform.OS === "web" ? await sendOtpWeb(e164) : await sendOtp(e164);

      globalThis.__orbitOtp = { handle, phone: e164 };
      router.push("/(auth)/otp");
    } catch (e: any) {
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
      style={[styles.root, { backgroundColor: orbit.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Enter your number</Text>
        <Text style={styles.sub}>
          We'll send a 6-digit code to verify it's yours.
        </Text>

        <Text style={styles.label}>PHONE NUMBER</Text>

        <View
          style={[
            styles.inputRow,
            { borderColor: focused ? orbit.accent : orbit.borderStrong },
            focused && { backgroundColor: orbit.surface2 },
          ]}
        >
          <Pressable style={styles.ccBox}>
            <Text style={styles.cc}>+91</Text>
            <Feather
              name="chevron-down"
              size={14}
              color={orbit.textTertiary}
              style={{ marginLeft: 4 }}
            />
          </Pressable>

          <View style={styles.inlineDivider} />

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
            placeholderTextColor={orbit.textTertiary}
            style={styles.input}
          />
        </View>

        <View style={styles.hintRow}>
          {valid ? (
            <>
              <Feather name="check-circle" size={13} color={orbit.success} />
              <Text style={styles.hint}>We'll send a code to {e164}</Text>
            </>
          ) : (
            <Text style={styles.hintMuted}>Enter your 10-digit mobile number</Text>
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
              backgroundColor: valid ? orbit.accent : orbit.surface2,
              opacity: sending ? 0.7 : 1,
              transform: [{ scale: pressed && valid ? 0.98 : 1 }],
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={orbit.white} />
          ) : (
            <Text
              style={[
                styles.ctaText,
                { color: valid ? orbit.white : orbit.textTertiary },
              ]}
            >
              Send Code
            </Text>
          )}
        </Pressable>

        <Text style={styles.recaptchaNote}>
          Protected by reCAPTCHA. Google's{" "}
          <Text style={styles.legalLink}>Privacy</Text> &{" "}
          <Text style={styles.legalLink}>Terms</Text> apply.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  title: {
    color: orbit.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  sub: {
    color: orbit.textSecond,
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  ccBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: "100%",
  },
  cc: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  inlineDivider: {
    width: 1,
    height: 24,
    backgroundColor: orbit.borderSubtle,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  hint: {
    color: orbit.textSecond,
    fontSize: 14,
  },
  hintMuted: {
    color: orbit.textTertiary,
    fontSize: 14,
  },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  cta: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  recaptchaNote: {
    color: orbit.textTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  legalLink: {
    color: orbit.textSecond,
    fontWeight: "500",
  },
});

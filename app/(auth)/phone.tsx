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
import {
  authErrorMessage,
  isValidE164,
  normalizeIndianPhone,
  sendOtp,
} from "@/lib/auth";
import { setPhoneHandle } from "./otp-handle";

/* ------------------------------------------------------------------ */
/*  WEB-ONLY Firebase config.                                          */
/*  Values copied from your google-services.json (project orbit-app).  */
/*  authDomain pattern is always: <projectId>.firebaseapp.com          */
/* ------------------------------------------------------------------ */
const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w",
  authDomain: "orbit-app-5b4b3.firebaseapp.com",
  projectId: "orbit-app-5b4b3",
  storageBucket: "orbit-app-5b4b3.firebasestorage.app",
  messagingSenderId: "250454225022",
  appId: "1:250454225022:android:44b3e0a7ac0268cfe6a82f",
};

/* Module-level cache so reCAPTCHA solve hota hai sirf ek baar */
let webAuthRef: any = null;
let webVerifierRef: any = null;

/* -------- Web ka apna sendOtp -- @react-native-firebase web pe nahi chalta -------- */
async function sendOtpWeb(phoneE164: string): Promise<any> {
  console.log("[Firebase Web] sendOtpWeb start:", phoneE164);

  // Dynamic import — sirf web pe load hoga, native bundling break nahi karega
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import(
    "firebase/auth"
  );

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  webAuthRef = getAuth(app);
  console.log("[Firebase Web] auth ready. project:", app.options.projectId);

  // reCAPTCHA ke liye DOM container chahiye
  let container = document.getElementById("recaptcha-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "recaptcha-container";
    document.body.appendChild(container);
  }

  // Verifier ek baar bana — multiple times banane se "already rendered" error aata hai
  if (!webVerifierRef) {
    webVerifierRef = new RecaptchaVerifier(webAuthRef, "recaptcha-container", {
      size: "invisible",
      callback: () => console.log("[reCAPTCHA] solved ✅"),
      "expired-callback": () => console.log("[reCAPTCHA] expired ⚠️"),
    });
    await webVerifierRef.render();
    console.log("[Firebase Web] reCAPTCHA rendered");
  }

  const confirmation = await signInWithPhoneNumber(
    webAuthRef,
    phoneE164,
    webVerifierRef
  );
  console.log(
    "[Firebase Web] OTP sent ✅ verificationId:",
    confirmation?.verificationId
  );
  return confirmation;
}

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);

  const e164 = normalizeIndianPhone(raw);
  const valid = isValidE164(e164);

  /* Pre-mount reCAPTCHA container so first click feels snappy */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!document.getElementById("recaptcha-container")) {
      const div = document.createElement("div");
      div.id = "recaptcha-container";
      document.body.appendChild(div);
    }
    console.log("[PhoneScreen] mounted. Platform =", Platform.OS);
  }, []);

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    console.log(
      "[PhoneScreen] Send OTP click. phone =",
      e164,
      "platform =",
      Platform.OS
    );

    try {
      const handle =
        Platform.OS === "web"
          ? await sendOtpWeb(e164)
          : await sendOtp(e164);

      console.log("[PhoneScreen] handle received ✅:", handle);
      setPhoneHandle(handle as any, e164);
      router.push("/(auth)/otp");
    } catch (e: any) {
      /* ---- DETAILED error logging tere debugging ke liye ---- */
      console.error("════════ OTP SEND FAILED ════════");
      console.error("code   :", e?.code);
      console.error("message:", e?.message);
      console.error("name   :", e?.name);
      console.error("stack  :", e?.stack);
      console.error("raw err:", e);
      console.error("═════════════════════════════════");

      const detail =
        (e?.code ? `[${e.code}]\n` : "") +
        (e?.message ?? authErrorMessage(e) ?? String(e));

      Alert.alert("OTP send nahi hua", detail);

      /* Web pe verifier reset karo taaki next try fresh ho */
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
        <Text style={[styles.title, { color: colors.text }]}>Phone number</Text>
        <Text style={[styles.sub, { color: colors.sub }]}>
          Hum tumhe ek 6-digit OTP bhejenge verification ke liye.
        </Text>

        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.ccBox, { borderRightColor: colors.border }]}>
            <Text style={[styles.cc, { color: colors.text }]}>🇮🇳  +91</Text>
          </View>
          <TextInput
            ref={inputRef}
            autoFocus
            keyboardType="phone-pad"
            maxLength={15}
            value={raw}
            onChangeText={setRaw}
            placeholder="98765 43210"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.text }]}
          />
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {valid
            ? `✓ ${e164} pe OTP bhejenge`
            : "10 digits daalo ya +country-code ke saath full number"}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[
            styles.cta,
            {
              backgroundColor: valid ? colors.primary : colors.surface2,
              opacity: sending ? 0.6 : 1,
            },
          ]}
          activeOpacity={0.85}
          disabled={!valid || sending}
          onPress={send}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Send OTP</Text>
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
  sub: { fontSize: 14, marginBottom: 28, lineHeight: 20 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  ccBox: { paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1 },
  cc: { fontSize: 15, fontWeight: "600" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 16, fontSize: 16 },
  hint: { marginTop: 10, fontSize: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

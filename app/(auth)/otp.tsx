import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

function prettyPhone(e164: string): string {
  if (!e164.startsWith("+91") || e164.length !== 13) return e164;
  return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
}

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [focused, setFocused] = useState(false);
  const phone = globalThis.__orbitOtp?.phone ?? "";

  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    // 3 oscillations, 4px amplitude, 320ms total
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 53, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  4, duration: 53, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 53, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  4, duration: 53, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 53, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 15, useNativeDriver: true }),
    ]).start();
  };

  useHideRecaptchaBadge();

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!globalThis.__orbitOtp?.handle) {
      router.replace("/(auth)/phone");
    }
  }, [router]);

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
    } catch (e: any) {
      Alert.alert("Verification failed", authErrorMessage(e));
      triggerShake();
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
        Platform.OS === "web" ? await sendOtpWeb(phone) : await sendOtp(phone);
      globalThis.__orbitOtp = { handle, phone };
      setCooldown(RESEND_SECONDS);
    } catch (e: any) {
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
      style={[styles.root, { backgroundColor: orbit.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.sub}>
          6-digit code sent to{"  "}
          <Text style={styles.phoneText}>{prettyPhone(phone)}</Text>
          {"  "}
          <Text
            style={styles.editLink}
            onPress={() => router.back()}
            accessibilityRole="link"
            accessibilityLabel="Edit phone number"
          >
            Edit
          </Text>
        </Text>

        <View style={styles.otpWrap}>
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
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
                      borderColor: isActive
                        ? orbit.accent
                        : isFilled
                        ? orbit.borderStrong
                        : orbit.borderSubtle,
                      borderWidth: isActive ? 2 : 1,
                      backgroundColor: isActive
                        ? orbit.surface2
                        : orbit.surface1,
                      transform: [{ scale: isActive ? 1.02 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      {
                        color: isFilled ? orbit.textPrimary : orbit.textTertiary,
                      },
                    ]}
                  >
                    {ch}
                  </Text>
                  {isActive && !ch && (
                    <View style={styles.caret} />
                  )}
                </View>
              );
            })}
          </Pressable>
          </Animated.View>

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
            <Text style={styles.resendDim}>
              Resend in <Text style={styles.resendDimBold}>{cooldown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={resend} disabled={resending} hitSlop={8} accessibilityRole="button" accessibilityLabel="Resend code">
              <Text style={styles.resend}>
                {resending ? "Sending…" : "Resend code"}
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
                code.length === 6 ? orbit.accent : orbit.surface2,
              opacity: verifying ? 0.7 : 1,
              transform: [{ scale: pressed && code.length === 6 ? 0.98 : 1 }],
            },
          ]}
        >
          {verifying ? (
            <ActivityIndicator color={orbit.white} />
          ) : (
            <Text
              style={[
                styles.ctaText,
                {
                  color:
                    code.length === 6 ? orbit.white : orbit.textTertiary,
                },
              ]}
            >
              Verify
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
    marginBottom: 36,
    lineHeight: 22,
  },
  phoneText: {
    color: orbit.textPrimary,
    fontWeight: "600",
  },
  editLink: {
    color: orbit.accent,
    fontWeight: "600",
  },
  otpWrap: { position: "relative" },
  cells: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 56,
    maxWidth: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontSize: 22,
    fontWeight: "600",
  },
  caret: {
    position: "absolute",
    width: 2,
    height: 22,
    backgroundColor: orbit.accent,
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
    // @ts-ignore — web only
    caretColor: "transparent",
  },
  resendRow: {
    marginTop: 28,
    alignItems: "center",
  },
  resend: {
    color: orbit.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  resendDim: {
    color: orbit.textTertiary,
    fontSize: 14,
  },
  resendDimBold: {
    color: orbit.textSecond,
    fontWeight: "600",
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

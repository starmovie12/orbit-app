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
import {
  clearPhoneHandle,
  getPhone,
  getPhoneHandle,
  setPhoneHandle,
} from "./otp-handle";

const RESEND_SECONDS = 45;

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const phone = getPhone();

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // If user landed here without a handle (e.g. deep-link), push them back.
  useEffect(() => {
    if (!getPhoneHandle()) router.replace("/(auth)/phone");
  }, [router]);

  const verify = async (value: string) => {
    const handle = getPhoneHandle();
    if (!handle || verifying) return;
    setVerifying(true);
    try {
      await confirmOtp(handle, value);
      clearPhoneHandle();
      // RouteGuard will push us to onboarding once user doc is ensured.
    } catch (e) {
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
    try {
      const handle = await sendOtp(phone);
      setPhoneHandle(handle, phone);
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      Alert.alert("Resend nahi hua", authErrorMessage(e));
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
          6-digit code <Text style={{ color: colors.text, fontWeight: "700" }}>{phone}</Text> pe
          bheja gaya hai.
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

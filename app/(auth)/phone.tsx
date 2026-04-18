import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);

  const e164 = normalizeIndianPhone(raw);
  const valid = isValidE164(e164);

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    try {
      const handle = await sendOtp(e164);
      setPhoneHandle(handle, e164);
      router.push("/(auth)/otp");
    } catch (e) {
      Alert.alert("OTP send nahi hua", authErrorMessage(e));
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
          <View
            style={[styles.ccBox, { borderRightColor: colors.border }]}
          >
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

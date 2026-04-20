/**
 * Orbit — Feedback Components
 *
 * EmptyState: §4.10 — 64px icon + h2 title + body + optional CTA. Centered, 320px max.
 * Toast:      §7     — slide up from bottom, shadow-lg, auto-dismiss 4s.
 * Skeleton:   §7     — surface2 blocks, subtle 1.4s shimmer (almost invisible).
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { orbit } from "@/constants/colors";
import { Button } from "./Button";

/* ============================================================================
   EmptyState
   ============================================================================ */

export type EmptyStateProps = {
  icon: any;           // Feather icon name
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

export const EmptyState = ({
  icon,
  title,
  description,
  ctaLabel,
  onCtaPress,
}: EmptyStateProps) => (
  <View style={emptyStyles.wrap} accessibilityLiveRegion="polite">
    <View style={emptyStyles.iconWrap}>
      <Feather name={icon} size={40} color={orbit.textTertiary} />
    </View>
    <Text style={emptyStyles.title}>{title}</Text>
    {description ? <Text style={emptyStyles.desc}>{description}</Text> : null}
    {ctaLabel && onCtaPress ? (
      <View style={{ marginTop: 16 }}>
        <Button label={ctaLabel} onPress={onCtaPress} size="md" />
      </View>
    ) : null}
  </View>
);

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    maxWidth: 320,
    alignSelf: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  desc: {
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
});

/* ============================================================================
   Toast
   ============================================================================ */

export type ToastKind = "info" | "success" | "error";

export type ToastProps = {
  visible: boolean;
  message: string;
  kind?: ToastKind;
  onHide?: () => void;
  duration?: number;
  style?: ViewStyle;
};

/**
 * Controlled Toast — parent owns `visible`. Auto-hides after `duration` ms.
 * Slides up 16px + fade in, 240ms. Ease-out.
 */
export const Toast = ({
  visible,
  message,
  kind = "info",
  onHide,
  duration = 4000,
  style,
}: ToastProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: 0,
          duration: 240,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();

      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(ty, {
            toValue: 16,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(t);
    }
  }, [visible, duration, onHide, opacity, ty]);

  if (!visible) return null;

  const icon =
    kind === "success" ? "check-circle" : kind === "error" ? "alert-circle" : "info";
  const color =
    kind === "success" ? orbit.success : kind === "error" ? orbit.danger : orbit.accent;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        toastStyles.wrap,
        { opacity, transform: [{ translateY: ty }] },
        style,
      ]}
    >
      <View style={toastStyles.inner}>
        <Feather name={icon} size={16} color={color} style={{ marginRight: 10 }} />
        <Text style={toastStyles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 32,
    alignItems: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: orbit.surface3,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: 440,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  text: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
});

/* ============================================================================
   Skeleton
   ============================================================================ */

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Subtle shimmer loop — 1.4s, very low contrast.
 * NOT the aggressive Facebook shimmer. This one barely moves.
 */
export const Skeleton = ({
  width = "100%",
  height = 14,
  borderRadius = 6,
  style,
}: SkeletonProps) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const backgroundColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [orbit.surface2, orbit.surface3],
  });

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

/** Pre-composed skeleton that matches a ListItem row — handy for lists. */
export const ListItemSkeleton = () => (
  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }}>
    <Skeleton width={44} height={44} borderRadius={22} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Skeleton width={"60%"} height={14} />
      <View style={{ height: 8 }} />
      <Skeleton width={"90%"} height={12} />
    </View>
  </View>
);

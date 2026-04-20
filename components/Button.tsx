/**
 * Orbit — Button
 * Spec: §4.1 of UI V2 prompt.
 *
 * Variants: primary | secondary | ghost | destructive
 * Sizes:    sm (36px) | md (44px) | lg (52px)
 * States:   default | pressed | disabled | loading
 *
 * Primary:     accent bg, white label, no shadow, no gradient.
 * Secondary:   surface2 bg, textPrimary label, 1px borderStrong.
 * Ghost:       transparent, textPrimary, pressed gets surface2.
 * Destructive: danger bg, white label.
 * Loading:     width stays fixed, spinner replaces label.
 */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { orbit } from "@/constants/colors";

export type FeatherIconName = ComponentProps<typeof Feather>["name"];

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: FeatherIconName;    // Feather icon name, rendered left of label
  iconRight?: FeatherIconName; // Feather icon name, rendered right of label
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const SIZE_MAP: Record<ButtonSize, { h: number; px: number; fs: number; iconSize: number }> = {
  sm: { h: 36, px: 14, fs: 13, iconSize: 14 },
  md: { h: 44, px: 18, fs: 14, iconSize: 16 },
  lg: { h: 52, px: 20, fs: 15, iconSize: 18 },
};

export const Button = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) => {
  const s = SIZE_MAP[size];
  const isDisabled = disabled || loading;

  const variantStyle = (() => {
    if (isDisabled && variant !== "ghost") {
      return {
        bg: orbit.surface2,
        fg: orbit.textTertiary,
        border: "transparent",
      };
    }
    if (variant === "primary") {
      return { bg: orbit.accent, fg: orbit.white, border: "transparent" };
    }
    if (variant === "secondary") {
      return { bg: orbit.surface2, fg: orbit.textPrimary, border: orbit.borderStrong };
    }
    if (variant === "ghost") {
      return { bg: "transparent", fg: orbit.textPrimary, border: "transparent" };
    }
    // destructive
    return { bg: orbit.danger, fg: orbit.white, border: "transparent" };
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.h,
          paddingHorizontal: s.px,
          backgroundColor: pressed && !isDisabled && variant === "ghost"
            ? orbit.surface2
            : variantStyle.bg,
          borderColor: variantStyle.border,
          borderWidth: variant === "secondary" ? 1 : 0,
          width: fullWidth ? "100%" : undefined,
          opacity: isDisabled ? 1 : pressed ? 0.95 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.fg} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Feather
              name={icon}
              size={s.iconSize}
              color={variantStyle.fg}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            style={{
              color: variantStyle.fg,
              fontSize: s.fs,
              fontWeight: "600",
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
          {iconRight && (
            <Feather
              name={iconRight}
              size={s.iconSize}
              color={variantStyle.fg}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});

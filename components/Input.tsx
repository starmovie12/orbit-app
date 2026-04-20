/**
 * Orbit — Input
 * Spec: §4.2 of UI V2 prompt.
 *
 * Height 48px, radius 12px.
 * Background surface2, border 1px borderStrong.
 * Focus: border becomes accent + accentSoft ring (2px outside).
 * Label sits ABOVE the input (overline caption style) — no floating labels (Material trash).
 * Helper text below in textTertiary. Error text in danger.
 */

import React, { useState, forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { orbit } from "@/constants/colors";

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: any;      // Feather icon name
  rightIcon?: any;
  onRightIconPress?: () => void;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    helper,
    error,
    leftIcon,
    rightIcon,
    onFocus,
    onBlur,
    placeholderTextColor,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? orbit.danger
    : focused
    ? orbit.accent
    : orbit.borderStrong;

  return (
    <View>
      {label && <Text style={styles.label}>{label.toUpperCase()}</Text>}

      <View
        style={[
          styles.row,
          {
            borderColor,
            backgroundColor: focused ? orbit.surface2 : orbit.surface1,
            borderWidth: focused || error ? 2 : 1,
            // Compensate padding when border thickens
            paddingHorizontal: focused || error ? 13 : 14,
          },
        ]}
      >
        {leftIcon && (
          <Feather
            name={leftIcon}
            size={16}
            color={orbit.textTertiary}
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          ref={ref}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={placeholderTextColor ?? orbit.textTertiary}
          style={styles.input}
          {...rest}
        />
        {rightIcon && (
          <Feather
            name={rightIcon}
            size={16}
            color={orbit.textTertiary}
            style={{ marginLeft: 10 }}
            onPress={onRightIconPress}
            accessibilityRole={onRightIconPress ? "button" : undefined}
          />
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
  },
  input: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },
  helperText: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },
  errorText: {
    color: orbit.danger,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
  },
});

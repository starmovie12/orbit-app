/**
 * Orbit — Card
 * Spec: §4.7 of UI V2 prompt.
 *
 * Background surface1, radius 16px, padding 16px.
 * 1px borderSubtle border (replaces shadow in dark mode — borders > shadows).
 * Pressed state: background surface2.
 */

import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { orbit } from "@/constants/colors";

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  padding?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export const Card = ({
  children,
  onPress,
  padding = 16,
  style,
  accessibilityLabel,
}: CardProps) => {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.card,
          { padding, backgroundColor: pressed ? orbit.surface2 : orbit.surface1 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
});

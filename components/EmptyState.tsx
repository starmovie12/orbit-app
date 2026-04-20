/**
 * Orbit — EmptyState
 * Spec: §4.10 of UI V2 prompt.
 *
 * Used when a list, feed, or screen has no content to show.
 * Quiet by design — no illustration overkill, no emoji, no neon.
 *
 * Usage:
 *   <EmptyState
 *     icon="inbox"
 *     title="Nothing here yet"
 *     subtitle="Rooms you join will appear here."
 *     action={{ label: "Explore Rooms", onPress: () => router.push('/rooms') }}
 *   />
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { orbit } from "@/constants/colors";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

export type EmptyStateProps = {
  /** Feather icon shown above title */
  icon: FeatherIconName;
  /** Primary message — h3 weight */
  title: string;
  /** Supporting explanation — body-m, textSecond */
  subtitle?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onPress: () => void;
  };
};

export const EmptyState = ({
  icon,
  title,
  subtitle,
  action,
}: EmptyStateProps) => {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {/* Icon in a subtle surface-2 circle */}
      <View style={styles.iconWrap}>
        <Feather name={icon} size={28} color={orbit.textTertiary} strokeWidth={1.75} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {subtitle ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}

      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: pressed ? orbit.accentHover : orbit.accent,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 48,
    gap: 0,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  subtitle: {
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actionBtn: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
  },
  actionLabel: {
    color: orbit.white,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

export default EmptyState;

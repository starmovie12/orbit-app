/**
 * Orbit — ListItem (the workhorse)
 * Spec: §4.4 of UI V2 prompt.
 *
 * [Avatar 44px]  [Title h3] ───────── [Meta caption]
 *                [Subtitle body-m]   [Badge / chevron]
 *
 * Vertical padding 14px, horizontal 20px.
 * Divider: 1px borderSubtle inset 76px from left (after avatar).
 * Pressed state: surface1.
 */

import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { orbit } from "@/constants/colors";

export type ListItemProps = {
  /** Left adornment — e.g. Avatar, IconBox, or nothing */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Top-right meta (e.g. timestamp) */
  meta?: string;
  /** Bottom-right adornment (badge, chevron) */
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export const ListItem = ({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  destructive = false,
  style,
  accessibilityLabel,
}: ListItemProps) => {
  const body = (
    <View style={[styles.row, style]}>
      {leading && <View style={{ marginRight: 12 }}>{leading}</View>}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.title,
              { color: destructive ? orbit.danger : orbit.textPrimary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing && <View style={{ marginLeft: 8 }}>{trailing}</View>}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        pressed && { backgroundColor: orbit.surface1 },
      ]}
    >
      {body}
    </Pressable>
  );
};

/** Sleek chevron for use as ListItem trailing — respects ghost list-item energy. */
export const ListItemChevron = () => (
  <Feather name="chevron-right" size={18} color={orbit.textTertiary} />
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  body: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
  subtitle: {
    color: orbit.textSecond,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
});

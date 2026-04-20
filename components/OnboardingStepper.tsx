import React from "react";
import { StyleSheet, View } from "react-native";
import { orbit } from "@/constants/colors";

/**
 * 4-dot progress indicator for onboarding screens.
 * step: 1-indexed (1 = language, 4 = welcome-bonus).
 */
export function OnboardingStepper({ step }: { step: number }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4].map((i) => {
        const active = i === step;
        const done = i < step;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: active ? 22 : 8,
                backgroundColor: done || active ? orbit.accent : orbit.surface2,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
});

import { Stack } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: false, // prevent swipe-back mid-onboarding
        contentStyle: { backgroundColor: "#17212B" },
      }}
    >
      <Stack.Screen name="language" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="username" />
      <Stack.Screen name="welcome-bonus" />
    </Stack>
  );
}

/**
 * app/_layout.tsx
 * CROWD WORLD — Root Layout v4.1
 *
 * ─── Provider hierarchy (outer → inner) ──────────────────────────────────────
 * SafeAreaProvider          → device insets for all screens
 * ErrorBoundary             → catches unhandled render errors, prevents white-screen
 * QueryClientProvider       → React Query for server-state caching
 * GestureHandlerRootView    → required root for react-native-gesture-handler
 * KeyboardProvider          → react-native-keyboard-controller (Rule 04)
 * StatusBar                 → light icons on dark bg (orbit.bg)
 * AuthProvider              → Firebase auth + Firestore profile (contexts/AuthContext)
 * SplashGate                → holds children until fonts are ready; shows spinner
 * RouteGuard                → auth + onboarding redirect logic (inside Expo Router tree)
 *
 * ─── SplashGate behaviour ────────────────────────────────────────────────────
 * `ready` prop = fontsLoaded || !!fontError.
 * While ready=false → renders ActivityIndicator (spinner).
 * While ready=false → SplashScreen.hideAsync() has NOT been called yet, so the
 * native splash screen is still covering the UI on iOS/Android.
 * Once ready=true  → SplashScreen.hideAsync() fires → native splash dismisses →
 * children (RouteGuard → screens) appear.
 *
 * ❌ `if (!fontsLoaded && !fontError) return null` has been removed.
 * That early return prevented the entire provider tree from mounting,
 * meaning SplashGate's ActivityIndicator was never reachable — dead code.
 * Without the early return, SplashGate correctly shows the spinner while
 * the native splash is still visible, then hands off to RouteGuard.
 *
 * ─── RouteGuard redirect table ───────────────────────────────────────────────
 * Not signed in                     → /(auth)/welcome
 * Signed in · onboarding incomplete → /(onboarding)/{currentStep}
 * Signed in · onboarding complete   → /(tabs)
 */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { orbit } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// ─────────────────────────────────────────────────────────────────────────────
// RouteGuard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads auth + onboarding state from AuthContext v4 and redirects accordingly.
 * Must live inside the Expo Router tree (i.e. inside <Stack>) so that
 * router.replace() calls are valid.
 *
 * Uses `isOnboarded` and `onboardingStep` from context — never reads raw
 * user.onboardingComplete or user.onboardingStep directly.
 */
function RouteGuard() {
  const { firebaseUser, user, loading, isOnboarded, onboardingStep } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    // ── BYPASS LOADING ───────────────────────────────────────────────────────
    // if (loading || firebaseUser === undefined) return;

    const group        = segments[0];
    const inAuth       = group === "(auth)";
    const inOnboarding = group === "(onboarding)";
    const inTabs       = group === "(tabs)";

    // ── BYPASS AUTH CHECK ────────────────────────────────────────────────────
    // if (!firebaseUser) {
    //   if (!inAuth) router.replace("/(auth)/welcome");
    //   return;
    // }

    // ── BYPASS PROFILE CHECK ─────────────────────────────────────────────────
    // if (!user) return;

    // ── BYPASS ONBOARDING CHECK ──────────────────────────────────────────────
    // if (!isOnboarded) {
    //   const step: string =
    //     !onboardingStep || onboardingStep === "done" ? "language" : onboardingStep;
    //   if (!inOnboarding) {
    //     router.replace(`/(onboarding)/${step}` as never);
    //   }
    //   return;
    // }

    // ── FORCED ENTRY TO TABS (HOME SCREEN) ───────────────────────────────────
    if (!inTabs) router.replace("/(tabs)");
  }, [firebaseUser, user, loading, isOnboarded, onboardingStep, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown:       false,
        animation:         "slide_from_right",
        animationDuration: 260,
      }}
    >
      <Stack.Screen name="(auth)"       options={{ animation: "fade" }} />
      <Stack.Screen name="(onboarding)" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)"       options={{ animation: "none" }} />

      {/* Deep screens */}
      <Stack.Screen
        name="room/[id]"
        options={{
          animation:        "slide_from_right",
          gestureEnabled:   true,
          gestureDirection: "horizontal",
        }}
      />
      <Stack.Screen
        name="dm/[id]"
        options={{
          animation:        "slide_from_right",
          gestureEnabled:   true,
          gestureDirection: "horizontal",
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{
          animation:        "slide_from_bottom",
          gestureEnabled:   true,
          gestureDirection: "vertical",
        }}
      />
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SplashGate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows an ActivityIndicator while fonts (or any other bootstrap condition)
 * are not yet ready. Once ready=true, renders children normally.
 *
 * On native, the device's own splash screen is still visible while ready=false
 * (SplashScreen.preventAutoHideAsync() + hideAsync() in RootLayout handle that).
 * The ActivityIndicator acts as a graceful fallback for the brief window between
 * native splash dismissal and the first content paint.
 */
function SplashGate({
  ready,
  children,
}: {
  ready:    boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();

  if (!ready) {
    return (
      <View
        style={{
          flex:            1,
          alignItems:      "center",
          justifyContent:  "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RootLayout
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Dismiss the native splash screen once fonts are ready (or failed).
      // fontError case: still dismiss — app renders with system font fallback.
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <StatusBar style="light" backgroundColor={orbit.bg} />
              <AuthProvider>
                <SplashGate ready={fontsLoaded || !!fontError}>
                  <RouteGuard />
                </SplashGate>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

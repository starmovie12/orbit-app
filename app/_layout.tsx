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

/**
 * Route guard.
 * Watches auth state + onboarding progress and redirects accordingly.
 *   - Not signed in                → /(auth)/welcome
 *   - Signed in, onboarding incomplete → /(onboarding)/{currentStep}
 *   - Signed in, onboarding done       → /(tabs)
 */
function RouteGuard() {
  const { firebaseUser, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || firebaseUser === undefined) return;

    const group = segments[0]; // "(auth)" | "(onboarding)" | "(tabs)" | undefined
    const inAuth = group === "(auth)";
    const inOnboarding = group === "(onboarding)";
    const inTabs = group === "(tabs)";

    // Not signed in → always push to auth.
    if (!firebaseUser) {
      if (!inAuth) router.replace("/(auth)/welcome");
      return;
    }

    // Signed in but user doc not yet loaded → wait one more tick.
    if (!user) return;

    // Signed in, onboarding incomplete → push to current onboarding step.
    if (!user.onboardingComplete) {
      const step = user.onboardingStep === "done" ? "language" : user.onboardingStep;
      if (!inOnboarding) {
        router.replace(`/(onboarding)/${step}` as never);
      }
      return;
    }

    // Fully onboarded → should be in tabs.
    if (!inTabs) router.replace("/(tabs)");
  }, [firebaseUser, user, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function SplashGate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const colors = useColors();
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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

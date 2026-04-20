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

    const group = segments[0];
    const inAuth = group === "(auth)";
    const inOnboarding = group === "(onboarding)";
    const inTabs = group === "(tabs)";

    if (!firebaseUser) {
      if (!inAuth) router.replace("/(auth)/welcome");
      return;
    }

    if (!user) return;

    if (!user.onboardingComplete) {
      const step = user.onboardingStep === "done" ? "language" : user.onboardingStep;
      if (!inOnboarding) {
        router.replace(`/(onboarding)/${step}` as never);
      }
      return;
    }

    if (!inTabs) router.replace("/(tabs)");
  }, [firebaseUser, user, loading, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 260,
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(onboarding)" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
      {/* Deep screens — full chat experiences */}
      <Stack.Screen
        name="room/[id]"
        options={{
          animation: "slide_from_right",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      />
      <Stack.Screen
        name="dm/[id]"
        options={{
          animation: "slide_from_right",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{
          animation: "slide_from_bottom",
          gestureEnabled: true,
          gestureDirection: "vertical",
        }}
      />
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

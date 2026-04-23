/**
 * Tab Layout — 4 Tabs matching the new HTML design
 * World | Discover | Ranks | Profile
 */
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const GOLD = "#C8871A";
const MUTED = "#8B6D4A";
const BORDER = "#E8D9C8";

function TabIcon({ name, focused }: { name: any; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeBar} />}
      <Feather name={name} size={22} color={focused ? GOLD : MUTED} />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.label, { color: focused ? GOLD : MUTED, fontWeight: focused ? "700" : "500" }]}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopWidth: 1,
          borderTopColor: BORDER,
          elevation: 0,
          height: isWeb ? 84 : isIOS ? 82 : 68,
          paddingBottom: isWeb ? 28 : isIOS ? 22 : 10,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      {/* 1. World (main chat room) */}
      <Tabs.Screen
        name="index"
        options={{
          title: "World",
          tabBarIcon: ({ focused }) => <TabIcon name="globe" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="World" focused={focused} />,
        }}
      />

      {/* 2. Discover */}
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Discover" focused={focused} />,
        }}
      />

      {/* 3. Ranks */}
      <Tabs.Screen
        name="ranks"
        options={{
          title: "Ranks",
          tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-2" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Ranks" focused={focused} />,
        }}
      />

      {/* 4. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
        }}
      />

      {/* Hidden screens (accessible via navigation, not tab bar) */}
      <Tabs.Screen name="rooms"   options={{ href: null }} />
      <Tabs.Screen name="bazaar"  options={{ href: null }} />
      <Tabs.Screen name="inbox"   options={{ href: null }} />
      <Tabs.Screen name="live"    options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", width: 48, height: 32, position: "relative" },
  activeBar: { position: "absolute", top: -4, width: 24, height: 3, borderRadius: 1.5, backgroundColor: GOLD },
  label: { fontSize: 11, letterSpacing: 0.2, marginTop: 2 },
});

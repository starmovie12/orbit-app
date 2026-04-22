import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { orbit } from "@/constants/colors";

function TabIcon({ name, focused }: { name: any; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeIndicator} />}
      <Feather
        name={name}
        size={22}
        color={focused ? orbit.accent : orbit.textTertiary}
      />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={[
        styles.label,
        {
          color: focused ? orbit.accent : orbit.textTertiary,
          fontWeight: focused ? "700" : "500",
        },
      ]}
    >
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
          borderTopColor: "#E8D9C8",
          elevation: 0,
          height: isWeb ? 84 : isIOS ? 82 : 68,
          paddingBottom: isWeb ? 28 : isIOS ? 22 : 10,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Rooms",
          tabBarIcon: ({ focused }) => <TabIcon name="message-square" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Rooms" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Discover" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bazaar"
        options={{
          title: "Bazaar",
          tabBarIcon: ({ focused }) => <TabIcon name="briefcase" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Bazaar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ranks"
        options={{
          title: "Ranks",
          tabBarIcon: ({ focused }) => <TabIcon name="award" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Ranks" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="You" focused={focused} />,
        }}
      />
      <Tabs.Screen name="rooms" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 32,
    position: "relative",
  },
  activeIndicator: {
    position: "absolute",
    top: -4,
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#C8871A",
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: 2,
  },
});

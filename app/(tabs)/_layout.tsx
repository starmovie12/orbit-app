/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Tab Layout Root                                                     ║
 * ║  PRD v5.1 §9.1 + §9.3 — Founder-Locked Architecture                        ║
 * ║  Owner: Ail Noor Alam (Founder) · Chandigarh · May 2026                     ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  PRD §9.1 — Four Tabs (Final, Locked):                                       ║
 * ║    Tab 1: HOME    → app/(tabs)/index.tsx    "The live chat"                  ║
 * ║    Tab 2: EXPLORE → app/(tabs)/discover.tsx "Discover cities + leaderboards" ║
 * ║    Tab 3: CROWN   → app/(tabs)/ranks.tsx    "Status & bidding center"        ║
 * ║    Tab 4: PROFILE → app/(tabs)/profile.tsx  "Your identity"                  ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  PRD §9.3 — Founder Mandate (v5.1-rev2):                                     ║
 * ║  "No floating Glass Island. No 280px-wide pill hovering 20px above the       ║
 * ║   safe area. The bottom nav is a SIMPLE, FULL-WIDTH, FIXED BAR —             ║
 * ║   exactly like WhatsApp / Telegram / Instagram."                              ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  SCROLL API (re-exported from CrownBottomNav + HomeHeader):                  ║
 * ║    import { hideNav, showNav }       from '@/app/(tabs)/_layout';             ║
 * ║    import { hideHeader, showHeader } from '@/app/(tabs)/_layout';             ║
 * ║                                                                              ║
 * ║    // Wire to FlatList scroll in HomeScreen:                                 ║
 * ║    const handleScroll = ({ nativeEvent: { contentOffset: { y } } }) => {    ║
 * ║      const delta = y - lastY.current;                                        ║
 * ║      if (delta > 4)  { hideNav(); hideHeader(); }                            ║
 * ║      if (delta < -4) { showNav(); showHeader(); }                            ║
 * ║      if (y < 10)     { showNav(); showHeader(); } // at bottom (inverted)    ║
 * ║      lastY.current = y;                                                      ║
 * ║    };                                                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { CrownBottomNav } from '@/components/organisms/CrownBottomNav';

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS — Scroll coordination API
//
// Any screen can import these directly from here OR from the source organisms.
// Both paths are identical — this file re-exports for discoverability.
// ─────────────────────────────────────────────────────────────────────────────

export {
  hideNav,
  showNav,
  navScrollAnim,
} from '@/components/organisms/CrownBottomNav';

export {
  hideHeader,
  showHeader,
  headerScrollAnim,
} from '@/components/organisms/HomeHeader';

// ─────────────────────────────────────────────────────────────────────────────
// TAB LAYOUT ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      /**
       * §9.3 — CrownBottomNav IS the tab bar.
       * Simple, full-width, fixed rectangle — NOT a floating pill.
       * Scroll-driven hide/show is handled inside CrownBottomNav via
       * the globally-exported navScrollAnim Animated.Value.
       */
      tabBar={(props) => <CrownBottomNav {...props} />}

      screenOptions={{
        /** Each screen owns its own header (HomeHeader organism, §9.2) */
        headerShown: false,

        /**
         * Suppress native Expo tab bar — CrownBottomNav is our renderer.
         * Without this the native bar renders on top of the custom one.
         */
        tabBarStyle:          { display: 'none' },
        tabBarShowLabel:      true,

        /**
         * §9.3.3 — Instant switching, no slide/fade between screens.
         * The 200ms coordination lives inside CrownBottomNav + HomeHeader.
         */
        animation: 'none',

        /**
         * Pause inactive tab renders — perf win on low-end Android (§21).
         */
        freezeOnBlur: true,

        /**
         * CrownBottomNav handles keyboard-hide internally via its own
         * KeyboardAvoidingView listener. Do not let Expo override this.
         */
        tabBarHideOnKeyboard: false,
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════
          PRIMARY TABS — PRD §9.1 Four Tabs (Founder-Locked)
          ══════════════════════════════════════════════════════════════════ */}

      {/**
       * TAB 1 — HOME
       * §9.1: "The live chat — primary destination, with 4-scope switcher"
       * Header: Row1(56px wordmark+icons) + Row2(48px scope switcher) +
       *         Row3(32px online strip) = 136px total. Hides on scroll.
       */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />

      {/**
       * TAB 2 — EXPLORE
       * §9.1: "Discover other cities, leaderboards, schedules, search"
       * File: app/(tabs)/discover.tsx
       * CrownBottomNav: route='discover' → id='explore' → label='Explore'
       */}
      <Tabs.Screen
        name="discover"
        options={{ title: 'Explore' }}
      />

      {/**
       * TAB 3 — CROWN
       * §9.1: "Status and bidding center — the emotional center of the app"
       * §9.1: "CROWN tab opens to your current rank in big type"
       * File: app/(tabs)/ranks.tsx
       * CrownBottomNav: route='ranks' → id='crown' → label='Crown'
       */}
      <Tabs.Screen
        name="ranks"
        options={{ title: 'Crown' }}
      />

      {/**
       * TAB 4 — PROFILE
       * §9.1: "Handle, titles, stats, followers/following, Credits, Settings"
       * Rule 03: The SOLE valid avatar/profile entry point.
       */}
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />

      {/* ══════════════════════════════════════════════════════════════════
          HIDDEN SCREENS — href:null — §9.4 "No Hidden Tabs, No More Menu"
          Reachable via in-app deep navigation, not from the tab bar.
          ══════════════════════════════════════════════════════════════════ */}

      {/** BAZAAR — Credits marketplace. Entry: Profile → Credits → Buy/Cashout */}
      <Tabs.Screen name="bazaar"    options={{ href: null }} />

      {/** INBOX — Direct Messages. Entry: Home header 💬 DM icon (Row 1) */}
      <Tabs.Screen name="inbox"     options={{ href: null }} />

      {/** LIVE — Voice Rooms (Agora RTC, v2.0). Registered for deep-link readiness */}
      <Tabs.Screen name="live"      options={{ href: null }} />

      {/** ROOMS — Internal voice room routing helper */}
      <Tabs.Screen name="rooms"     options={{ href: null }} />

      {/** SETTINGS — Sub-screen pushed from Profile → ⚙ gear */}
      <Tabs.Screen name="settings"  options={{ href: null }} />
    </Tabs>
  );
}

/**
 * CROWN — Splash / Welcome Screen
 * Route    : /onboarding  (app/(auth)/welcome.tsx)
 * Blueprint: Part 3 § 3 — v5.0 BAAP EDITION
 * Status   : ✅ PRODUCTION READY
 *
 * Layout (top → bottom):
 *   [1] StatusBar          transparent · dark-content
 *   [2] Brand Zone         96px + safe-area-top  → CROWN wordmark (centered)
 *   [3] Hero Illustration  280px                 → Abstract sector SVG
 *   [4] Headline + Subhead ~152px                → Hinglish copy
 *   [5] CTA Stack          sticky bottom         → 3 CTAs (primary · ghost · peek)
 *
 * Laws: LAW 4 (Peek Mode) · LAW 15 (CROWN wordmark) · DPDP privacy note
 * Deps: @/constants/colors · expo-router · react-native-safe-area-context
 *       expo-status-bar · react-native-svg
 */

import React, { useEffect, useRef, memo } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import { colors } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// CROWN WORDMARK — SVG · centered for splash (hero variant · 40px H)
// Pure typography: hand-crafted letterforms at gold-800
// Spec: Part 3 § 3 [2.A] — H: 40px · W: auto (~124px) · gold-800 centered
// LAW 15: This is the canonical CROWN wordmark. Do NOT replace with any
//         other brand name, logo, or icon. Gold-800 (#8B6F18) only.
// Letters: C · R · O · W · N  (5 glyphs, no separator)
// ─────────────────────────────────────────────────────────────────────────────
const CrownWordmark = memo(function CrownWordmark() {
  // gold-800 = #8B6F18 — brand wordmark (LAW 15 · Part 3 § 2)
  const C = '#8B6F18';
  return (
    <Svg
      width={124}
      height={40}
      viewBox="0 0 124 40"
      accessibilityRole="header"
      accessibilityLabel="CROWN"
      testID="splash-brand-logo"
    >
      {/* ── C ── x: 2–26 */}
      <Path
        d="M14 8 C6 8 2 14 2 20 C2 26 6 32 14 32 C18.5 32 22 30 24.5 27
           L21 23.5 C19.5 25.5 17 27 14 27 C9 27 7 23.5 7 20 C7 16.5 9 13 14 13
           C17 13 19.5 14.5 21 16.5 L24.5 13 C22 10 18.5 8 14 8Z"
        fill={C}
      />

      {/* ── R ── x: 28–49 */}
      <Path
        d="M28 8.5 L28 31.5 L33 31.5 L33 23 L37 23 L42.5 31.5 L48.5 31.5
           L42 22 C45.5 21 47.5 18.5 47.5 15.5 C47.5 11.5 44.5 8.5 39.5 8.5 L28 8.5Z
           M33 13 L39.5 13 C41.5 13 42.5 14 42.5 15.5 C42.5 17 41.5 18.5 39 18.5
           L33 18.5 L33 13Z"
        fill={C}
      />

      {/* ── O ── x: 50–76 */}
      <Path
        d="M63 8 C54.5 8 50 14 50 20 C50 26 54.5 32 63 32 C71.5 32 76 26 76 20
           C76 14 71.5 8 63 8Z M63 13 C68 13 71 16 71 20 C71 24 68 27 63 27
           C58 27 55 24 55 20 C55 16 58 13 63 13Z"
        fill={C}
      />

      {/* ── W ── x: 79–97 */}
      <Path
        d="M79 8.5 L84 24 L88 14 L92 24 L97 8.5 L92 8.5 L88 20 L84 8.5 L79 8.5Z"
        fill={C}
      />

      {/* ── N ── x: 100–122
          Two verticals (5px stroke) joined by a diagonal slash:
          left post (100–105) top-to-bottom · diagonal (105,8.5)→(117,31.5)
          right post (117–122) top-to-bottom
      ── */}
      <Path
        d="M100 8.5 L100 31.5 L105 31.5 L105 15
           L117 31.5 L122 31.5 L122 8.5 L117 8.5
           L117 25 L105 8.5 L100 8.5Z"
        fill={C}
      />
    </Svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO ILLUSTRATION — SVG · Abstract hyper-local sectors connecting
// Spec: Part 3 § 3 [3.A] — 240×240 · gold[600] · cream[200] · ink[600] outlines
// Chandigarh sector grid metaphor: hexagonal tiles, connector lines, live dots
// ─────────────────────────────────────────────────────────────────────────────
const HeroIllustration = memo(function HeroIllustration() {
  const gold  = '#C9A227';   // gold[600]
  const goldL = '#E2C66B';   // gold[400] — celebrate
  const goldS = '#ECD58F';   // gold[300] — soft / dashes
  const cream = '#F7ECD0';   // cream[200] — tile fills
  const inkL  = '#A89A85';   // ink[400] — lighter outlines

  return (
    <Svg
      width={240}
      height={240}
      viewBox="0 0 240 240"
      accessibilityElementsHidden
      testID="splash-hero-illustration"
    >
      {/* Subtle ambient backdrop circle */}
      <Circle cx="120" cy="120" r="108" fill={cream} opacity={0.38} />

      {/* ── CENTER tile: Sector 17 (flagship gold) ── */}
      <G>
        <Polygon
          points="120,58 149,74 149,106 120,122 91,106 91,74"
          fill={gold}
          stroke={cream}
          strokeWidth={2}
        />
        {/* Building silhouettes inside hex */}
        <Rect x="107" y="77" width="8"  height="14" rx="1" fill={cream} opacity={0.85} />
        <Rect x="119" y="72" width="8"  height="19" rx="1" fill={cream} opacity={0.90} />
        <Rect x="131" y="81" width="7"  height="10" rx="1" fill={cream} opacity={0.70} />
        {/* Live pulse dot at bottom of center tile */}
        <Circle cx="120" cy="110" r="3" fill={cream} />
      </G>

      {/* ── Connector dashes — sector grid lines ── */}
      <Line x1="120" y1="122" x2="78"  y2="148" stroke={goldS} strokeWidth={1.5} strokeDasharray="4,3" />
      <Line x1="120" y1="122" x2="162" y2="148" stroke={goldS} strokeWidth={1.5} strokeDasharray="4,3" />
      <Line x1="91"  y1="90"  x2="55"  y2="106" stroke={goldS} strokeWidth={1}   strokeDasharray="3,4" />
      <Line x1="149" y1="90"  x2="185" y2="106" stroke={goldS} strokeWidth={1}   strokeDasharray="3,4" />

      {/* ── BOTTOM-LEFT tile: Sector 22 ── */}
      <G>
        <Polygon
          points="78,148 100,135 122,148 122,172 100,185 78,172"
          fill={cream}
          stroke={gold}
          strokeWidth={1.5}
        />
        <Circle cx="100" cy="158" r="7" fill={goldL} opacity={0.55} />
        <Rect   x="94"  y="152"  width="12" height="9" rx="1.5" fill={gold} opacity={0.35} />
      </G>

      {/* ── BOTTOM-RIGHT tile: Sector 35 ── */}
      <G>
        <Polygon
          points="118,148 140,135 162,148 162,172 140,185 118,172"
          fill={cream}
          stroke={gold}
          strokeWidth={1.5}
        />
        <Circle cx="140" cy="158" r="7" fill={goldL} opacity={0.55} />
        <Rect   x="134" y="152"  width="12" height="9" rx="1.5" fill={gold} opacity={0.35} />
      </G>

      {/* ── LEFT tile: Sector 8 (subtle / tertiary) ── */}
      <G>
        <Polygon
          points="55,106 76,94 91,106 91,130 70,142 50,130"
          fill={cream}
          stroke={inkL}
          strokeWidth={1}
        />
        <Circle cx="70" cy="116" r="5" fill={gold} opacity={0.30} />
      </G>

      {/* ── RIGHT tile: Sector 26 (subtle / tertiary) ── */}
      <G>
        <Polygon
          points="149,106 164,94 184,106 184,130 165,142 149,130"
          fill={cream}
          stroke={inkL}
          strokeWidth={1}
        />
        <Circle cx="165" cy="116" r="5" fill={gold} opacity={0.30} />
      </G>

      {/* ── Pulse rings around center hex — "live" signal ── */}
      <Circle cx="120" cy="90" r="30" stroke={goldL} strokeWidth={1}   fill="none" opacity={0.45} />
      <Circle cx="120" cy="90" r="20" stroke={gold}  strokeWidth={1.5} fill="none" opacity={0.25} />

      {/* ── User avatar dots — "people online" social proof ── */}
      <Circle cx="89"  cy="72" r="5.5" fill={gold}  stroke={cream} strokeWidth={1.5} />
      <Circle cx="80"  cy="81" r="4"   fill={goldL} stroke={cream} strokeWidth={1}   />
      <Circle cx="151" cy="72" r="5.5" fill={gold}  stroke={cream} strokeWidth={1.5} />
      <Circle cx="160" cy="81" r="4"   fill={goldL} stroke={cream} strokeWidth={1}   />

      {/* ── Online count pill at bottom — 1 Lakh+ cue ── */}
      <Rect   x="90" y="196" width="60" height="22" rx="11" fill={gold} opacity={0.10} />
      <Circle cx="100" cy="207" r="3.5" fill="#059669" />
    </Svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — Staggered entry animations (mount-only, no loop)
// Wordmark spring → Hero fade → Headline rise → Subhead rise → CTA spring
// ─────────────────────────────────────────────────────────────────────────────
function useMountAnimations() {
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkScale   = useRef(new Animated.Value(0.8)).current;
  const heroOpacity     = useRef(new Animated.Value(0)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineY       = useRef(new Animated.Value(12)).current;
  const subheadOpacity  = useRef(new Animated.Value(0)).current;
  const subheadY        = useRef(new Animated.Value(8)).current;
  const ctaOpacity      = useRef(new Animated.Value(0)).current;
  const ctaScale        = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // [1] Wordmark: spring scale + fade  (0ms)
    Animated.parallel([
      Animated.spring(wordmarkScale, {
        toValue: 1, tension: 60, friction: 10, useNativeDriver: true,
      }),
      Animated.timing(wordmarkOpacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
    ]).start();

    // [2] Hero: fade in  (200ms delay)
    Animated.timing(heroOpacity, {
      toValue: 1, duration: 600, delay: 200, useNativeDriver: true,
    }).start();

    // [3] Headline: rise + fade  (400ms delay)
    Animated.parallel([
      Animated.timing(headlineOpacity, {
        toValue: 1, duration: 500, delay: 400, useNativeDriver: true,
      }),
      Animated.timing(headlineY, {
        toValue: 0, duration: 500, delay: 400, useNativeDriver: true,
      }),
    ]).start();

    // [4] Subhead: rise + fade  (600ms delay)
    Animated.parallel([
      Animated.timing(subheadOpacity, {
        toValue: 1, duration: 500, delay: 600, useNativeDriver: true,
      }),
      Animated.timing(subheadY, {
        toValue: 0, duration: 500, delay: 600, useNativeDriver: true,
      }),
    ]).start();

    // [5] CTAs: spring scale + fade  (800ms delay)
    Animated.parallel([
      Animated.timing(ctaOpacity, {
        toValue: 1, duration: 500, delay: 800, useNativeDriver: true,
      }),
      Animated.spring(ctaScale, {
        toValue: 1, tension: 60, friction: 10, delay: 800, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return {
    wordmarkStyle: { opacity: wordmarkOpacity, transform: [{ scale: wordmarkScale }] },
    heroStyle:     { opacity: heroOpacity },
    headlineStyle: { opacity: headlineOpacity, transform: [{ translateY: headlineY }] },
    subheadStyle:  { opacity: subheadOpacity,  transform: [{ translateY: subheadY }] },
    ctaStyle:      { opacity: ctaOpacity,      transform: [{ scale: ctaScale }] },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN COMPONENT — Welcome / Splash
// ─────────────────────────────────────────────────────────────────────────────
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const anim   = useMountAnimations();

  // ── Navigation handlers ──────────────────────────────────────────────────
  const handleGetStarted = () =>
    router.push({ pathname: '/(auth)/phone', params: { mode: 'signup' } });

  const handleSignIn = () =>
    router.push({ pathname: '/(auth)/phone', params: { mode: 'signin' } });

  // LAW 4: guest / peek mode — read-only until first write triggers Auth Gate
  const handlePeek = () =>
    router.push({ pathname: '/(tabs)', params: { guest: 'true' } });

  return (
    <View style={[styles.root, { backgroundColor: colors.bg.surface }]}>

      {/* ───────────────────────────────────────────────────────────────────
          [1] StatusBar — transparent · dark icons (warm ivory bg shows through)
         ─────────────────────────────────────────────────────────────────── */}
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* ═══════════════════════════════════════════════════════════════════
          [2] BRAND ZONE — 96px + safe-area-top
              CROWN wordmark · centered · spring animated
              LAW 15: wordmark must be CrowdWorldWordmark — never substituted
         ═══════════════════════════════════════════════════════════════════ */}
      <View style={[styles.brandZone, { paddingTop: insets.top + 24 }]}>
        {/* Golden accent dot — premium visual signal (spec [2.A]) */}
        <View style={styles.accentDot} />
        <Animated.View style={anim.wordmarkStyle}>
          <CrowdWorldWordmark />
        </Animated.View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          [3] HERO ZONE — 280px · Chandigarh sector SVG · decorative only
         ═══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={[styles.heroZone, anim.heroStyle]}>
        <HeroIllustration />
      </Animated.View>

      {/* ═══════════════════════════════════════════════════════════════════
          [4] COPY ZONE — Headline + Subhead · Hinglish · staggered reveal
         ═══════════════════════════════════════════════════════════════════ */}
      <View style={styles.copyZone}>
        <Animated.Text
          style={[styles.headline, anim.headlineStyle]}
          accessibilityRole="header"
          testID="splash-headline"
          numberOfLines={2}
        >
          Apne sector se zindagi mein rang bharo
        </Animated.Text>

        <Animated.Text
          style={[styles.subhead, anim.subheadStyle]}
          testID="splash-subhead"
          numberOfLines={2}
        >
          1 Lakh+ users already in their sector.{'\n'}Aap bhi join karo.
        </Animated.Text>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          [5] CTA STACK — sticky bottom · spring animated as unit
              [5.A] Primary  : "Shuru Karo"           — sign up flow
              [5.B] Ghost    : "Sign In karo"          — existing users
              [5.C] Peek Link: LAW 4 guest / read-only — deferred auth
              DPDP privacy note (mandatory · India launch)
         ═══════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[
          styles.ctaContainer,
          { paddingBottom: insets.bottom + 24 },
          anim.ctaStyle,
        ]}
      >
        {/* ── [5.A] Primary CTA — "Shuru Karo" ── */}
        <Pressable
          onPress={handleGetStarted}
          accessibilityRole="button"
          accessibilityLabel="Get started · sign up"
          testID="splash-cta-primary"
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: colors.fg.brand },
            pressed && styles.primaryCtaPressed,
          ]}
        >
          <Text style={[styles.primaryCtaText, { color: colors.fg.onBrand }]}>
            Shuru Karo
          </Text>
        </Pressable>

        {/* ── [5.B] Ghost CTA — "Sign In karo" ── */}
        <Pressable
          onPress={handleSignIn}
          accessibilityRole="button"
          accessibilityLabel="Already have an account · sign in"
          testID="splash-cta-signin"
          style={({ pressed }) => [styles.ghostCta, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.ghostCtaText, { color: colors.fg.brandText }]}>
            Account hai?{' '}
            <Text style={styles.ghostCtaEmphasis}>Sign In karo</Text>
          </Text>
        </Pressable>

        {/* ── [5.C] Peek Link — LAW 4 guest mode ── */}
        <Pressable
          onPress={handlePeek}
          accessibilityRole="button"
          accessibilityLabel="Continue as guest · peek without signing up"
          testID="splash-cta-peek"
          style={({ pressed }) => [styles.peekCta, pressed && { opacity: 0.5 }]}
        >
          <Text style={[styles.peekCtaText, { color: colors.fg.tertiary }]}>
            Pehle Chandigarh dekho · sign up baad mein
          </Text>
        </Pressable>

        {/* ── DPDP Privacy Note — mandatory for India · DPDP Act 2023 ── */}
        <Text
          style={[styles.privacyNote, { color: colors.fg.tertiary }]}
          testID="splash-privacy-note"
        >
          Continue karne par aap hamare{' '}
          <Text
            style={[styles.privacyLink, { color: colors.fg.secondary }]}
            onPress={() => router.push('/legal/terms' as any)}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            Terms
          </Text>
          {'  ·  '}
          <Text
            style={[styles.privacyLink, { color: colors.fg.secondary }]}
            onPress={() => router.push('/legal/privacy' as any)}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            Privacy Policy
          </Text>
          {'\n'}se agree karte hain · DPDP Act 2023 ke taht surakshit.
        </Text>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — All spacing/radius values from blueprint spec
// RULE: Colors always via tokens (colors.*) — NO hardcoded values in styles
//       Exception: ink/cream constants in SVG fills where circular dep risk exists
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Root ────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
  },

  // ── [2] Brand Zone ──────────────────────────────────────────────────────
  brandZone: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    minHeight: 96,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4B244',   // gold[500] — NOT a token to avoid circular dep
    marginBottom: 8,
    opacity: 0.7,
  },

  // ── [3] Hero Zone ────────────────────────────────────────────────────────
  heroZone: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // ── [4] Copy Zone ────────────────────────────────────────────────────────
  copyZone: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    textAlign: 'center',
    maxWidth: 320,
    color: '#1A1208',     // ink[950] — hardcoded: avoids circular dep
    letterSpacing: -0.3,
  },
  subhead: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 12,
    color: '#6B5B47',     // ink[600]
  },

  // ── [5] CTA Container — sticky bottom ────────────────────────────────────
  ctaContainer: {
    paddingTop: 24,
    paddingHorizontal: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDE5D5',   // ink[100] — subtle section hairline
  },

  // ── [5.A] Primary CTA — 54px · brand gold · white text ──────────────────
  primaryCta: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#C9A227',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
    }),
  },
  primaryCtaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── [5.B] Ghost CTA — 44px · no bg · brand text ──────────────────────────
  ghostCta: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  ghostCtaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ghostCtaEmphasis: {
    fontWeight: '700',
  },

  // ── [5.C] Peek Link — 32px · tertiary · underline ────────────────────────
  peekCta: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  peekCtaText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    textDecorationLine: 'underline',
    letterSpacing: 0.1,
  },

  // ── DPDP Privacy Note ────────────────────────────────────────────────────
  privacyNote: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 16,
  },
  privacyLink: {
    fontWeight: '500',
  },
});

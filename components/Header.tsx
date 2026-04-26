/**
 * CROWD WORLD — Header Component
 *
 * HTML source: crowd_world_redesigned.html
 *   .header          → container: white bg, bottom border + subtle gold shadow
 *   .header-top      → row: space-between, padding: 0 18px 8px
 *   .logo-icon       → 44×44, gradient #7B5A0A→gold→#F0D060→gold, radius 14
 *   .app-title       → Cormorant 24px/700, letter-spacing 0.5px
 *   .top-city-tag    → DM Sans 13px/600, color text-soft
 *   .screen-name-txt → Cormorant 24px/700, letter-spacing 0.3px (tab variant)
 *   .screen-sub-txt  → DM Sans 11px/600, color text-soft, letter-spacing 0.3px
 *   .coins           → gold-pale bg, gold-border border, gold-deep text, 6px 13px
 *   .dm-btn          → gold icon, 26×26
 *   .dm-badge        → gold-deep bg, white border, absolute top:-4 right:-6, 18px
 *
 * ── Variants ────────────────────────────────────────────────────────────────
 *   'world' → Logo icon (gradient) + "CROWD WORLD" + city tag subtitle
 *   'tab'   → Dynamic screen name (Cormorant) + optional subtitle (DM Sans)
 *   Both variants → Credits pill + DM button (right side hamesha same)
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   // World screen:
 *   <Header
 *     variant="world"
 *     title="CROWD WORLD"
 *     subtitle="Chandigarh"
 *     credits={542}
 *     dmCount={5}
 *     onPressCredits={() => router.push('/credits')}
 *     onPressDM={() => router.push('/inbox')}
 *   />
 *
 *   // Koi bhi tab screen:
 *   <Header
 *     variant="tab"
 *     title="Discover"
 *     subtitle="Cards & Challenges"
 *     credits={542}
 *     dmCount={5}
 *     onPressCredits={() => router.push('/credits')}
 *     onPressDM={() => router.push('/inbox')}
 *   />
 */

import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Line, Path } from "react-native-svg";

// Design tokens — constants/ se import
import { orbitGold }               from "@/constants/colors";
import { FONT_HEADING, FONT_BODY } from "@/constants/typography";
import { spacing, radius, shadows } from "@/constants/spacing";

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface HeaderProps {
  /** Layout variant:
   *  'world' → logo icon + CROWD WORLD brand title + city subtitle
   *  'tab'   → dynamic screen name + optional screen subtitle */
  variant: "world" | "tab";

  /** Main text:
   *  world → "CROWD WORLD" (ya app ka naam)
   *  tab   → screen ka display name, e.g. "Discover", "Bazaar" */
  title: string;

  /** Secondary text below the title:
   *  world → city name ya tag, e.g. "Chandigarh"
   *  tab   → screen ka tagline, e.g. "Cards & Challenges" */
  subtitle?: string;

  /** User ke current credits/coins — gold pill mein dikhta hai */
  credits: number;

  /** Unread DM count — badge mein dikhta hai (0 = badge hidden) */
  dmCount: number;

  /** Credits pill tap handler */
  onPressCredits?: () => void;

  /** DM button tap handler */
  onPressDM?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Logo Icon
// HTML .logo-icon — 44×44 gold multi-stop gradient + crowd SVG + shimmer overlay
// ─────────────────────────────────────────────────────────────────────────────

function LogoIcon() {
  return (
    <LinearGradient
      // HTML: linear-gradient(135deg, #7B5A0A, var(--gold), #F0D060, var(--gold))
      colors={["#7B5A0A", orbitGold.accent, "#F0D060", orbitGold.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.logoIconGradient}
    >
      {/* HTML SVG: crowd/people icon — 3 circles (heads) + path (bodies) */}
      {/* Exactly matching HTML viewBox="0 0 24 24" paths */}
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Ground line + crowd silhouettes */}
        <Path d="M2 20h20M5 20l2-8 5 4 5-4 2 8" />
        {/* 3 heads */}
        <Circle cx={5}  cy={9} r={2} />
        <Circle cx={12} cy={6} r={2} />
        <Circle cx={19} cy={9} r={2} />
      </Svg>

      {/* Shimmer overlay — HTML .logo-icon::after
          linear-gradient(135deg, rgba(255,255,255,.2) → transparent)
          React Native mein ::after nahi hota, extra View se simulate */}
      <LinearGradient
        colors={["rgba(255,255,255,0.20)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Credits Pill
// HTML .coins — gold-pale bg, gold-border border, ⚡ icon + number
// ─────────────────────────────────────────────────────────────────────────────

interface CreditsPillProps {
  count:   number;
  onPress?: () => void;
}

function CreditsPill({ count, onPress }: CreditsPillProps) {
  // Scale animation — HTML .coins:active { transform: scale(.96) }
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.timing(scaleAnim, {
      toValue: 0.96, duration: 80, useNativeDriver: true,
    }).start();
  }
  function pressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4,
    }).start();
  }

  // Credits number ko readable format mein dikhao
  // e.g. 1200 → "1.2k", 542 → "542"
  const formatted =
    count >= 1000
      ? `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}k`
      : String(count);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityLabel={`${formatted} credits`}
      accessibilityRole="button"
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* HTML .coins:
            background: linear-gradient(135deg, gold-pale, gold-pale) ← solid fill
            border: 1px solid gold-border
            box-shadow: 0 2px 8px rgba(201,162,39,.15) */}
        <LinearGradient
          // HTML mein dono stops same hain (gold-pale → gold-pale)
          // Slight variation add kiya for depth — more premium feel
          colors={[orbitGold.accentSoftSolid, "#FFF6E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coinsPill}
        >
          {/* Gold coin icon — HTML mein circle+⚡ SVG tha, yahan Feather 'zap' */}
          <View style={styles.coinsIconWrap}>
            <Feather name="zap" size={12} color={orbitGold.accent} />
          </View>

          {/* Credits count — HTML: font-size:13px/700, color:gold-deep */}
          <Text style={styles.coinsText} numberOfLines={1}>
            {formatted}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: DM Button
// HTML .dm-btn + .dm-badge
// ─────────────────────────────────────────────────────────────────────────────

interface DMButtonProps {
  count:   number;    // 0 = badge nahi dikhega
  onPress?: () => void;
}

function DMButton({ count, onPress }: DMButtonProps) {
  // Press feedback
  const opacityAnim = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.timing(opacityAnim, {
      toValue: 0.6, duration: 80, useNativeDriver: true,
    }).start();
  }
  function pressOut() {
    Animated.timing(opacityAnim, {
      toValue: 1, duration: 150, useNativeDriver: true,
    }).start();
  }

  const showBadge = count > 0;
  const badgeText = count > 99 ? "99+" : String(count);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityLabel={
        showBadge ? `${count} unread messages` : "Direct Messages"
      }
      accessibilityRole="button"
      style={styles.dmPressable}
    >
      <Animated.View style={[styles.dmInner, { opacity: opacityAnim }]}>
        {/* HTML .dm-btn: color:var(--gold), stroke-width:2, 26×26 SVG */}
        <Svg
          width={26}
          height={26}
          viewBox="0 0 24 24"
          fill="none"
          stroke={orbitGold.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Chat bubble path — exact HTML SVG */}
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </Svg>

        {/* Badge — HTML .dm-badge:
            position absolute, top:-4 right:-6
            background: gold-deep, color:#FFF
            height:18, min-width:18, border-radius:9
            border:2px solid #FFF, padding:0 4px
            font-size:10px/800 */}
        {showBadge && (
          <View style={styles.dmBadge}>
            <Text style={styles.dmBadgeText} numberOfLines={1}>
              {badgeText}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: Header
// ─────────────────────────────────────────────────────────────────────────────

export default function Header({
  variant,
  title,
  subtitle,
  credits,
  dmCount,
  onPressCredits,
  onPressDM,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  // Safe area top handle — status bar ke neeche se start ho
  // HTML header mein padding:13px 0 0 tha; usse safe area top add karo
  const paddingTop = insets.top + 13;

  return (
    <View
      style={[
        styles.header,
        { paddingTop },
      ]}
    >
      {/* ── Header Top Row ───────────────────────────────────────────────── */}
      {/* HTML .header-top: flex, space-between, align:center, padding:0 18px 8px */}
      <View style={styles.headerTop}>

        {/* ── LEFT: variant ke hisaab se alag content ────────────────────── */}
        {variant === "world" ? (
          // WORLD VARIANT: Logo icon + "CROWD WORLD" + city tag
          // HTML: .logo-row { display:flex; align-items:center; gap:10px }
          <View style={styles.logoRow}>
            {/* Gold gradient logo — .logo-icon */}
            <LogoIcon />

            {/* Title + subtitle stack */}
            <View style={styles.titleStack}>
              {/* HTML .app-title:
                  Cormorant Garamond 24px/700, color:#0D0800, letter-spacing:0.5px */}
              <Text style={styles.appTitle} numberOfLines={1}>
                {title}
              </Text>

              {/* HTML .top-city-tag:
                  DM Sans 13px/600, color:#A0875A (text-soft) */}
              {subtitle ? (
                <Text style={styles.cityTag} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          // TAB VARIANT: Dynamic screen name + subtitle
          // HTML: .screen-name-txt + .screen-sub-txt
          <View style={styles.tabTitleStack}>
            {/* HTML .screen-name-txt:
                Cormorant Garamond 24px/700, color:#0D0800, letter-spacing:0.3px */}
            <Text style={styles.screenNameTxt} numberOfLines={1}>
              {title}
            </Text>

            {/* HTML .screen-sub-txt:
                DM Sans 11px/600, color:#A0875A, margin-top:1, letter-spacing:0.3px */}
            {subtitle ? (
              <Text style={styles.screenSubTxt} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {/* ── RIGHT: Credits pill + DM button (hamesha same, dono variants mein) ── */}
        {/* HTML .header-actions: flex, align:center, gap:16px */}
        <View style={styles.headerActions}>
          <CreditsPill count={credits} onPress={onPressCredits} />
          <DMButton    count={dmCount} onPress={onPressDM}      />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Container — HTML .header ─────────────────────────────────────────────
  header: {
    backgroundColor:   orbitGold.bg,           // #FFFFFF
    zIndex:            10,

    // HTML: border-bottom: 1px solid var(--card-border)
    borderBottomWidth: 1,
    borderBottomColor: orbitGold.borderSubtle, // --card-border: #EDE3CC

    // HTML box-shadow simulate:
    //   0 1px 0 var(--card-border)          → borderBottom above cover this
    //   0 4px 24px rgba(201,162,39,.07)     → subtle gold drop shadow
    shadowColor:       orbitGold.accent,       // #C9A227
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.07,
    shadowRadius:      24,
    elevation:         3,                       // Android
  },

  // ── Top row — HTML .header-top ──────────────────────────────────────────
  headerTop: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    // HTML: padding: 0 18px 8px
    paddingHorizontal: spacing.screenH,         // 18px
    paddingBottom:     spacing.sm,              // 8px
  },

  // ── WORLD VARIANT — Logo row ─────────────────────────────────────────────
  // HTML .logo-row: display:flex, align-items:center, gap:10px
  logoRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,                      // HTML: gap:10px
    flex:              1,
    marginRight:       spacing.sm,
  },

  // HTML .logo-icon: 44×44, radius 14, gold shadow
  logoIconGradient: {
    width:             44,
    height:            44,
    borderRadius:      14,                      // --r-md + 2: logo ke liye 14px
    alignItems:        "center",
    justifyContent:    "center",
    overflow:          "hidden",

    // HTML box-shadow: 0 4px 16px rgba(201,162,39,.4), inset 0 1px 0 rgba(255,255,255,.3)
    // Inset part shimmer overlay se handle hota hai (LinearGradient overlay)
    // Outer shadow:
    shadowColor:       orbitGold.accent,
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.40,
    shadowRadius:      16,
    elevation:         8,
    flexShrink:        0,
  },

  // World variant mein title + city tag ka stack
  titleStack: {
    flex:              1,
    justifyContent:    "center",
  },

  // HTML .app-title:
  // font-family:'Cormorant Garamond',serif; font-size:24px; font-weight:700
  // color:var(--text); letter-spacing:0.5px
  appTitle: {
    fontFamily:        FONT_HEADING.bold,       // CormorantGaramond_700Bold
    fontSize:          24,
    fontWeight:        "700",
    color:             orbitGold.textPrimary,   // --text: #0D0800
    letterSpacing:     0.5,                     // HTML: 0.5px exact
    lineHeight:        28,
  },

  // HTML .top-city-tag:
  // font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600
  // color:var(--text-soft)
  cityTag: {
    fontFamily:        FONT_BODY.semiBold,      // DMSans_600SemiBold
    fontSize:          13,
    fontWeight:        "600",
    color:             orbitGold.textTertiary,  // --text-soft: #A0875A
    lineHeight:        17,
    marginTop:         1,
  },

  // ── TAB VARIANT — Dynamic screen title ───────────────────────────────────
  tabTitleStack: {
    flex:              1,
    justifyContent:    "center",
    marginRight:       spacing.sm,
  },

  // HTML .screen-name-txt:
  // font-family:'Cormorant Garamond',serif; font-size:24px; font-weight:700
  // color:var(--text); letter-spacing:0.3px
  screenNameTxt: {
    fontFamily:        FONT_HEADING.bold,       // CormorantGaramond_700Bold
    fontSize:          24,
    fontWeight:        "700",
    color:             orbitGold.textPrimary,   // --text: #0D0800
    letterSpacing:     0.3,                     // HTML: 0.3px (world se thoda kam)
    lineHeight:        28,
  },

  // HTML .screen-sub-txt:
  // font-size:11px; font-weight:600; color:var(--text-soft)
  // margin-top:1px; letter-spacing:.3px
  screenSubTxt: {
    fontFamily:        FONT_BODY.semiBold,      // DMSans_600SemiBold
    fontSize:          11,
    fontWeight:        "600",
    color:             orbitGold.textTertiary,  // --text-soft: #A0875A
    letterSpacing:     0.3,
    marginTop:         1,
    lineHeight:        15,
  },

  // ── Right side actions — HTML .header-actions ────────────────────────────
  // display:flex; align-items:center; gap:16px
  headerActions: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               16,                      // HTML: gap:16px
    flexShrink:        0,
  },

  // ── Credits Pill — HTML .coins ───────────────────────────────────────────
  // background: gold-pale gradient, border: gold-border
  // border-radius:20px, padding:6px 13px
  // font-size:13px/700, color:gold-deep
  // min-width:70, max-width:110
  coinsPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,                       // HTML: gap:5px
    borderRadius:      20,                      // HTML: border-radius:20px
    paddingHorizontal: 13,                      // HTML: padding: 6px 13px
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       orbitGold.goldBorder,    // --gold-border: #E2C660
    minWidth:          70,                      // HTML: min-width:70px
    maxWidth:          110,                     // HTML: max-width:110px

    // HTML box-shadow: 0 2px 8px rgba(201,162,39,.15)
    shadowColor:       orbitGold.accent,
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.15,
    shadowRadius:      8,
    elevation:         2,
  },

  coinsIconWrap: {
    width:             14,
    height:            14,
    alignItems:        "center",
    justifyContent:    "center",
  },

  // HTML .coins span: font-size:13px/700, color:var(--gold-deep)
  coinsText: {
    fontFamily:        FONT_BODY.bold,          // DMSans_700Bold
    fontSize:          13,
    fontWeight:        "700",
    color:             orbitGold.accentHover,   // --gold-deep: #9A7A18
    flexShrink:        1,
  },

  // ── DM Button — HTML .dm-btn ──────────────────────────────────────────────
  dmPressable: {
    flexShrink:        0,
  },

  dmInner: {
    position:          "relative",
    width:             34,                      // Touch target thoda bada rakha
    height:            34,
    alignItems:        "center",
    justifyContent:    "center",
  },

  // ── DM Badge — HTML .dm-badge ────────────────────────────────────────────
  // position:absolute; top:-4px; right:-6px
  // background:gold-deep; color:#FFF
  // height:18px; min-width:18px; border-radius:9px
  // border:2px solid #FFF; padding:0 4px
  // font-size:10px/800
  dmBadge: {
    position:          "absolute",
    top:               -4,                      // HTML: top:-4px
    right:             -6,                      // HTML: right:-6px
    minWidth:          18,                      // HTML: min-width:18px
    height:            18,                      // HTML: height:18px
    borderRadius:      9,                       // HTML: border-radius:9px
    backgroundColor:   orbitGold.accentHover,  // --gold-deep: #9A7A18
    borderWidth:       2,
    borderColor:       "#FFFFFF",               // HTML: border:2px solid #FFF
    paddingHorizontal: 4,                       // HTML: padding:0 4px
    alignItems:        "center",
    justifyContent:    "center",

    // Badge ko shadow se thoda lift do
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width:0, height:1 }, shadowOpacity:0.15, shadowRadius:2 },
      android: { elevation: 2 },
    }),
  },

  // HTML .dm-badge: font-size:10px/800, color:#FFF
  dmBadgeText: {
    fontFamily:        FONT_BODY.extraBold,    // DMSans_800ExtraBold
    fontSize:          10,
    fontWeight:        "800",
    color:             "#FFFFFF",
    lineHeight:        14,
    textAlign:         "center",
    includeFontPadding: false,                  // Android pe vertical centering fix
  },
});

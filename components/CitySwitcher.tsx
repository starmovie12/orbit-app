/**
 * CitySwitcher.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Horizontal city selector bar — HTML prototype ke .city-scroll + .city-btn ka
 * React Native equivalent.
 *
 * HTML reference classes:
 *   .city-scroll         → horizontal ScrollView, no scrollbar
 *   .city-btn            → inactive pill (white bg, subtle border)
 *   .city-btn.active     → active pill (gold gradient + shadow)
 *   .live-count-inline   → "● 1.2k" badge inside active pill
 *
 * Props:
 *   cities       → Array<{ id, name, liveCount, isActive }>
 *   onSelectCity → (id: string) => void — callback only, koi actual logic nahi
 *
 * Tokens: orbit (colors.ts), typography.ts, animations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useRef } from "react";
import {
  ScrollView,
  TouchableWithoutFeedback,
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// ── Design Tokens ─────────────────────────────────────────────────────────────
// colors.ts se liye — HTML ke :root variables se 100% sync
import { orbit } from "../constants/colors";

// typography.ts se — DM Sans font family
import { FONT_BODY, FONT_SIZE, LETTER_SPACING } from "../constants/typography";

// animations.ts se — press scale + easing
import { Duration, easeOut } from "../constants/animations";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CityItem {
  id: string;
  name: string;
  /** Live user count — e.g. 1240 → display as "1.2k" */
  liveCount: number;
  isActive: boolean;
}

interface CitySwitcherProps {
  cities: CityItem[];
  onSelectCity: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * liveCount ko human-readable format mein convert karo
 * 1240 → "1.2k" | 980 → "980"
 */
function formatLiveCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ─────────────────────────────────────────────────────────────────────────────
// BlinkingDot — HTML .ldot-inline ka equivalent
// CSS @keyframes blink: 0%,100%{opacity:1} 50%{opacity:.3}
// ─────────────────────────────────────────────────────────────────────────────

const BlinkingDot: React.FC = () => {
  // Opacity animate karo — loop mein
  const opacityAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // 1.4s cycle: 1 → 0.3 → 1, loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 700,           // 1400ms / 2 = 700ms per half
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cleanup jab unmount ho
    return () => opacityAnim.stopAnimation();
  }, [opacityAnim]);

  return (
    <Animated.View style={[s.liveDot, { opacity: opacityAnim }]} />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CityPill — ek single city button (active ya inactive)
// HTML: .city-btn aur .city-btn.active
// ─────────────────────────────────────────────────────────────────────────────

interface CityPillProps {
  city: CityItem;
  onPress: () => void;
}

const CityPill: React.FC<CityPillProps> = ({ city, onPress }) => {
  // Press animation — animations.ts ke useButtonPress jaisa
  // (lekin inline rakha taaki ref per-instance rahe)
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,               // Slight squish on press
      duration: Duration.micro,    // 80ms — quick haptic feel
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: Duration.micro,    // 80ms — snap back
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // ── Inactive Pill ──────────────────────────────────────────────────────────
  // HTML .city-btn: white bg, --card-border border, --text-soft color
  if (!city.isActive) {
    return (
      <TouchableWithoutFeedback
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${city.name} switch karo`}
        accessibilityState={{ selected: false }}
      >
        <Animated.View style={[s.pill, s.pillInactive, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={s.pillTextInactive} numberOfLines={1}>
            {city.name}
          </Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  // ── Active Pill ────────────────────────────────────────────────────────────
  // HTML .city-btn.active:
  //   background: linear-gradient(135deg, var(--gold), var(--gold-light))
  //   color: #FFF
  //   border-color: transparent
  //   box-shadow: 0 3px 12px rgba(201,162,39,.35)
  //
  // + .live-count-inline inside:
  //   "● {count}" with semi-transparent white bg pill
  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${city.name}, ${formatLiveCount(city.liveCount)} live users`}
      accessibilityState={{ selected: true }}
    >
      <Animated.View style={[s.pillShadowWrap, { transform: [{ scale: scaleAnim }] }]}>
        {/* Gold gradient — HTML ke linear-gradient(135deg, --gold, --gold-light) */}
        <LinearGradient
          colors={[orbit.accent, orbit.goldLight]}   // #C9A227 → #E8CC6A
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.pill, s.pillActive]}
        >
          {/* City name */}
          <Text style={s.pillTextActive} numberOfLines={1}>
            {city.name}
          </Text>

          {/* .live-count-inline — blinking dot + count, semi-white pill */}
          <View style={s.liveCountBadge}>
            <BlinkingDot />
            <Text style={s.liveCountText}>
              {formatLiveCount(city.liveCount)}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CitySwitcher — Main exported component
// HTML .city-scroll: overflow-x: auto, scrollbar-width: none
// ─────────────────────────────────────────────────────────────────────────────

const CitySwitcher: React.FC<CitySwitcherProps> = ({ cities, onSelectCity }) => {
  return (
    <ScrollView
      horizontal
      // Scrollbar kabhi visible nahi hoga — HTML ::-webkit-scrollbar{display:none}
      showsHorizontalScrollIndicator={false}
      // iOS momentum scroll — HTML mein -webkit-overflow-scrolling:touch jaisa feel
      decelerationRate="normal"
      // Overscroll glow Android pe nahi chahiye — premium feel
      overScrollMode="never"
      // Content ke andar padding — HTML .city-scroll: padding: 10px 18px
      contentContainerStyle={s.scrollContent}
      style={s.scrollContainer}
    >
      {cities.map((city) => (
        <CityPill
          key={city.id}
          city={city}
          // Callback only — koi state change nahi, parent handle karega
          onPress={() => onSelectCity(city.id)}
        />
      ))}
    </ScrollView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// HTML ke exact values se derived — har comment mein source class diya hai
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── .city-scroll ────────────────────────────────────────────────────────────
  scrollContainer: {
    backgroundColor: orbit.bg,                   // --bg: #FFFFFF
    // border-top: 1px solid var(--card-border) —
    // yeh parent Header mein handle karo (component apna border nahi lagata)
    flexShrink: 0,
  },

  // padding: 10px 18px (top/bottom 10, left/right 18) + gap: 8px between pills
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,                                      // HTML .city-scroll: gap:8px
    alignItems: "center",
  },

  // ── Pill base — .city-btn ──────────────────────────────────────────────────
  // padding:6px 16px; border-radius:20px; font-size:12px; font-weight:600;
  // white-space:nowrap; max-width:140px;
  pill: {
    paddingHorizontal: 16,                       // --r-full feel, HTML: padding:6px 16px
    paddingVertical: 6,
    borderRadius: 20,                            // HTML: border-radius:20px (.r-sm = 8 → yahan 20 custom)
    flexDirection: "row",
    alignItems: "center",
    gap: 6,                                      // HTML: gap:6px between name + live badge
    maxWidth: 140,                               // HTML G-020 FIX: max-width:140px
    overflow: "hidden",
  },

  // ── Inactive pill — .city-btn (default) ──────────────────────────────────
  // background:#FFF; border:1px solid var(--card-border); color:var(--text-soft)
  pillInactive: {
    backgroundColor: orbit.bg,                  // --bg: #FFF
    borderWidth: 1,
    borderColor: orbit.borderSubtle,             // --card-border: #EDE3CC
  },

  pillTextInactive: {
    fontFamily: FONT_BODY.semiBold,              // DM Sans 600 — HTML: font-weight:600
    fontSize: FONT_SIZE.sm + 1,                  // 12px — HTML: font-size:12px
    color: orbit.textTertiary,                   // --text-soft: #A0875A
    letterSpacing: LETTER_SPACING.wide,          // .2px — HTML: letter-spacing:.2px
    flexShrink: 1,                               // Overflow mein ellipsis
  },

  // ── Active pill wrapper (shadow needs to go outside LinearGradient) ────────
  // HTML box-shadow: 0 3px 12px rgba(201,162,39,.35)
  pillShadowWrap: {
    borderRadius: 20,
    // Android ke liye elevation shadow
    ...Platform.select({
      android: { elevation: 6 },
      // iOS ke liye shadow tokens
      ios: {
        shadowColor: orbit.accent,               // Gold shadow color
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
    }),
  },

  // ── Active pill — .city-btn.active ───────────────────────────────────────
  // gradient bg + white text + no border + shadow (on wrapper)
  pillActive: {
    // border-color:transparent — koi border nahi
    borderWidth: 0,
    // LinearGradient already wraps this, style sirf layout ke liye
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 140,
    overflow: "hidden",
  },

  pillTextActive: {
    fontFamily: FONT_BODY.semiBold,              // DM Sans 600
    fontSize: FONT_SIZE.sm + 1,                  // 12px
    color: orbit.textInverse,                    // #FFF — white on gold
    letterSpacing: LETTER_SPACING.wide,          // .2px
    flexShrink: 1,
  },

  // ── .live-count-inline ────────────────────────────────────────────────────
  // HTML: font-size:11px; font-weight:700; background:rgba(255,255,255,.25);
  //       padding:2px 6px; border-radius:10px; display:flex; gap:4px;
  liveCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,                                      // HTML: gap:4px (dot aur text ke beech)
    backgroundColor: "rgba(255,255,255,0.25)",   // --live-count semi-white pill
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,                            // HTML: border-radius:10px
    flexShrink: 0,                               // Badge kabhi shrink nahi karega
  },

  liveCountText: {
    fontFamily: FONT_BODY.bold,                  // DM Sans 700 — HTML: font-weight:700
    fontSize: FONT_SIZE.sm,                      // 11px — HTML: font-size:11px
    color: orbit.textInverse,                    // #FFF — white on gold bg
    lineHeight: 14,
  },

  // ── .ldot-inline — Blinking white dot ─────────────────────────────────────
  // HTML: width:5px; height:5px; background:#FFF; border-radius:50%;
  //        animation:blink 1.4s infinite;
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,                             // border-radius:50% → 2.5px ≈ 3
    backgroundColor: orbit.textInverse,          // #FFF
  },
});

export default CitySwitcher;

// ─────────────────────────────────────────────────────────────────────────────
// Usage Example:
// ─────────────────────────────────────────────────────────────────────────────
//
// import CitySwitcher from "@/components/CitySwitcher";
//
// const CITIES = [
//   { id: "chd",    name: "Chandigarh", liveCount: 1240, isActive: true  },
//   { id: "mohali", name: "Mohali",     liveCount:  820, isActive: false },
//   { id: "pkr",    name: "Panchkula",  liveCount:  430, isActive: false },
//   { id: "ldh",    name: "Ludhiana",   liveCount: 2100, isActive: false },
//   { id: "asr",    name: "Amritsar",   liveCount:  670, isActive: false },
// ];
//
// export default function HomeScreen() {
//   const [cities, setCities] = useState(CITIES);
//
//   const handleCitySelect = (id: string) => {
//     // CitySwitcher sirf callback deta hai — actual logic yahaan likho
//     setCities(prev =>
//       prev.map(c => ({ ...c, isActive: c.id === id }))
//     );
//   };
//
//   return (
//     <View>
//       <CitySwitcher cities={cities} onSelectCity={handleCitySelect} />
//     </View>
//   );
// }

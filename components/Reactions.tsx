/**
 * Reactions.tsx — components/Reactions.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD ke 2 reaction components:
 *
 *   ReactionPill   → chat bubble ke neeche chota emoji+count chip (.rp class)
 *   ReactionPicker → long-press pe aane wala 7-emoji arc picker (.reaction-picker)
 *
 * Source CSS:
 *   .rp              line 165 (base)
 *   .world-screen .rp  line 4485 (override — ye use karte hain)
 *   .reacts          line 164
 *   .reaction-picker line 4190
 *   .rp-option       line 4201
 *   @keyframes popIn line 4204
 *
 * HTML DOM reactions (line 7077-7083):
 *   🔥 🙌 ❤️ 😂 😮 💯 👑
 *
 * Animation:
 *   Reanimated v4.1.1 — SnappySpringConfig, withSpring, withDelay, runOnJS
 *   HTML popIn → container scale 0.85→1 spring
 *   Arc layout → parabola translateY per emoji (center highest, edges baseline)
 *   Stagger → har emoji 35ms delay se spring in karta hai
 *   Press → emoji 1→1.3→1 scale (HTML: .rp-option:active { transform: scale(1.3) })
 *
 * Exports:
 *   ReactionPill   (named)
 *   ReactionPicker (named)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  SnappySpringConfig,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { orbitGold }            from "@/constants/colors";
import { FONT_BODY, FONT_SIZE } from "@/constants/typography";

// ─── Design Tokens ──────────────────────────────────────────────────────────
// HTML :root variables → RN shortcuts
const C = {
  gold:           orbitGold.accent,           // #C9A227  --gold
  goldDeep:       orbitGold.accentHover,      // #9A7A18  --gold-deep
  goldPale:       orbitGold.accentSoftSolid,  // #FFF9EC  --gold-pale
  goldBorder:     orbitGold.goldBorder,       // #E2C660  --gold-border
  textMid:        orbitGold.textSecond,       // #6B5330  --text-mid
  cardBorder:     orbitGold.borderSubtle,     // #EDE3CC  --card-border
  white:          orbitGold.white,            // #FFFFFF
  surface:        "#FFFEFB",                  // world-screen .rp bg
  pillBorder:     "#F1E5C8",                  // world-screen .rp border
  shadow:         "rgba(154,122,24,0.06)",    // world-screen shadow color
  // Backdrop
  backdrop:       "rgba(13,8,0,0.35)",        // darkened for contrast
} as const;

// ─── Reaction list — HTML DOM se seedha (line 7077-7083) ────────────────────
interface ReactionDef {
  emoji: string;
  label: string;   // aria-label for accessibility
}

const REACTIONS: ReactionDef[] = [
  { emoji: "🔥", label: "Fire"       },
  { emoji: "🙌", label: "Hands up"   },
  { emoji: "❤️", label: "Heart"      },
  { emoji: "😂", label: "Laugh"      },
  { emoji: "😮", label: "Wow"        },
  { emoji: "💯", label: "100 points" },
  { emoji: "👑", label: "Crown"      },
];

// ─── Arc geometry ────────────────────────────────────────────────────────────
// HTML mein horizontal flex tha, hum parabolic arc add karte hain.
// center emoji (index 3) highest, edges (index 0,6) baseline par.
//
//      🔥  🙌  ❤️        💯  👑
//           ↑   😂  😮   ↑
//           ↑     ↑      ↑
//        arc hump — center emoji upar hai
//
const ARC_HEIGHT = 13;  // Max px jo center emoji utha jaayega edges se

/**
 * Har emoji ka static Y offset calculate karo.
 * Negative = upar (RN mein Y axis neeche badhta hai).
 * Parabola formula: -ARC_HEIGHT × (1 - ((i-3)/3)²)
 *   i=0: 0   (edge, no lift)
 *   i=1: -7.7
 *   i=2: -12.4
 *   i=3: -13  (center, maximum lift)
 *   i=4: -12.4
 *   i=5: -7.7
 *   i=6: 0   (edge, no lift)
 */
function arcStaticY(index: number): number {
  return -ARC_HEIGHT * (1 - Math.pow((index - 3) / 3, 2));
}

// ─── Spring configs ──────────────────────────────────────────────────────────
// Container entry: HTML popIn {from scale(.85) to scale(1)} — SnappySpringConfig
// Emoji entry: thoda bouncy chahiye — medium stiffness, low damping
// Emoji press: instant feel — SnappySpringConfig

const CONTAINER_SPRING = SnappySpringConfig; // damping:110, mass:4, stiffness:900

// Emoji pop-in spring — more bounce than SnappySpringConfig
const EMOJI_ENTRY_SPRING = {
  damping:   12,
  mass:      0.8,
  stiffness: 200,
} as const;

// Press spring — scale 1→1.3→1
const PRESS_SPRING = {
  damping:   8,
  mass:      0.5,
  stiffness: 300,
} as const;

// Stagger delay per emoji (ms)
const STAGGER_MS = 35;

// Exit animation duration
const EXIT_DURATION = 110;

// ═══════════════════════════════════════════════════════════════════════════
// ─── COMPONENT 1: ReactionPill ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * .rp (world-screen override) — emoji + count pill
 *
 * CSS:
 *   background: #FFFEFB
 *   border: 1px solid #F1E5C8
 *   border-radius: 14px
 *   padding: 4px 10px
 *   font-size: 11px; font-weight: 700
 *   color: var(--text-mid)
 *   box-shadow: 0 1px 3px rgba(154,122,24,.06), inset 0 1px 0 rgba(255,255,255,.6)
 *
 * Press state:
 *   .world-screen .rp:active { transform: scale(.94) }
 *   Active = gold bg + gold border (.rp:hover effect)
 */
export interface ReactionPillProps {
  emoji:    string;
  count:    number;
  active?:  boolean;    // User ne already react kiya hai
  onPress:  () => void;
  style?:   object;
}

export const ReactionPill = React.memo<ReactionPillProps>(({
  emoji,
  count,
  active = false,
  onPress,
  style,
}) => {
  // Press animation — scale .94 (CSS .rp:active)
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.94, SnappySpringConfig);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SnappySpringConfig);
  }, []);

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          s.pill,
          active   && s.pillActive,
          pressed  && s.pillPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`React with ${emoji}, ${count} reactions`}
        accessibilityState={{ selected: active }}
      >
        <Text style={[s.pillText, active && s.pillTextActive]}>
          {emoji} {count}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
ReactionPill.displayName = "ReactionPill";

// ═══════════════════════════════════════════════════════════════════════════
// ─── INTERNAL: PickerEmoji ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ReactionPicker ke andar har emoji ka apna animation state hota hai.
 * Alag component mein isliye nikala:
 *   1. useSharedValue ko loop mein call nahi kar sakte (Rules of Hooks)
 *   2. Har emoji independently spring aur press handle kare
 */
interface PickerEmojiProps {
  emoji:     string;
  label:     string;
  index:     number;
  isVisible: boolean;    // Picker visible hai kya — entry/exit trigger
  onPress:   (emoji: string) => void;
}

const PickerEmoji = React.memo<PickerEmojiProps>(({
  emoji,
  label,
  index,
  isVisible,
  onPress,
}) => {
  // Entry: scale 0→1 + translateY +20→0 (spring in from below)
  const scale       = useSharedValue(0);
  const translateY  = useSharedValue(20);   // Neeche se aaega
  const pressScale  = useSharedValue(1);    // Press: 1→1.3 (.rp-option:active)

  // Static arc Y offset — is emoji ki permanent parabolic position
  const staticArcY = arcStaticY(index);

  // Jab picker visible ho → stagger ke saath spring in
  useEffect(() => {
    if (isVisible) {
      // Stagger: left se right, har emoji 35ms baad
      const delay = index * STAGGER_MS;
      scale.value       = withDelay(delay, withSpring(1, EMOJI_ENTRY_SPRING));
      translateY.value  = withDelay(delay, withSpring(0, EMOJI_ENTRY_SPRING));
    } else {
      // Exit: quick fade out (container handles the main exit animation)
      scale.value = withTiming(0, { duration: EXIT_DURATION });
    }
  }, [isVisible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pressScale.value },   // Combine entry + press scale
      // Static arc offset + dynamic entry animation
      // arcStaticY negative (upar), translateY positive→0 (neeche se aata hai)
      { translateY: staticArcY + translateY.value },
    ],
  }));

  const handlePressIn = useCallback(() => {
    // .rp-option:active { transform: scale(1.3) }
    pressScale.value = withSpring(1.3, PRESS_SPRING);
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, PRESS_SPRING);
  }, []);

  const handlePress = useCallback(() => {
    onPress(emoji);
  }, [emoji, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}                        // Touch target thoda bada karo
      style={s.emojiPressable}
    >
      {/* .rp-option: font-size:22px; padding:4px */}
      <Animated.View style={[s.emojiWrap, animStyle]}>
        <Text style={s.emojiText}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  );
});
PickerEmoji.displayName = "PickerEmoji";

// ═══════════════════════════════════════════════════════════════════════════
// ─── COMPONENT 2: ReactionPicker ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * .reaction-picker — long-press ke baad aane wala 7-emoji arc picker
 *
 * CSS:
 *   position:fixed; background:#FFF; border:1px solid var(--card-border)
 *   border-radius:var(--r-xl) → 20px; padding:10px 14px;
 *   box-shadow:var(--shadow-lg); z-index:999;
 *   animation: popIn var(--t-quick) ease;
 *
 * @keyframes popIn:
 *   from { opacity:0; transform:scale(.85) }
 *   to   { opacity:1; transform:scale(1)   }
 *
 * RN architecture:
 *   Modal (transparent) → backdrop Pressable → Animated container → emoji arc
 *
 * Close triggers:
 *   1. Emoji select karo → onSelect(emoji) called, parent visible=false kare
 *   2. Backdrop press karo → onClose() called immediately
 *   3. Auto-close: 3s timeout (HTML behavior match)
 */
export interface ReactionPickerProps {
  visible:   boolean;
  onSelect:  (emoji: string) => void;
  onClose:   () => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onSelect,
  onClose,
}) => {
  // isOpen = Modal ka actual visible prop
  // visible prop → animate in/out → isOpen control karo
  const [isOpen, setIsOpen] = useState(false);

  // Container animations — HTML popIn effect
  const containerScale    = useSharedValue(0.85);
  const containerOpacity  = useSharedValue(0);
  const backdropOpacity   = useSharedValue(0);

  // Auto-close timer ref
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Close helper (UI thread se JS thread call ke liye runOnJS) ───────────
  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ── Animate in ───────────────────────────────────────────────────────────
  const animateIn = useCallback(() => {
    // HTML: popIn → scale(.85) → scale(1), opacity 0→1
    containerScale.value   = withSpring(1, CONTAINER_SPRING);
    containerOpacity.value = withTiming(1, { duration: 120 });
    backdropOpacity.value  = withTiming(1, { duration: 200 });
  }, []);

  // ── Animate out, phir Modal band karo ────────────────────────────────────
  const animateOut = useCallback((callback?: () => void) => {
    containerOpacity.value = withTiming(
      0,
      { duration: EXIT_DURATION },
      (finished) => {
        // Animation khatam hone ke baad Modal unmount karo
        if (finished) {
          runOnJS(closeModal)();
          if (callback) runOnJS(callback)();
        }
      }
    );
    // Scale bhi thoda shrink karo exit pe
    containerScale.value  = withSpring(0.88, CONTAINER_SPRING);
    backdropOpacity.value = withTiming(0, { duration: EXIT_DURATION });
  }, []);

  // ── visible prop ka effect ───────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Reset values, phir Modal open karo, phir animate in
      containerScale.value   = 0.85;
      containerOpacity.value = 0;
      backdropOpacity.value  = 0;
      setIsOpen(true);

      // Auto-close after 3s (HTML: picker._hideTimer = setTimeout 3000ms)
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = setTimeout(() => {
        animateOut(onClose);
      }, 3000);
    } else {
      // visible false → animate out
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      animateOut();
    }

    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [visible]);

  // Modal open hone ke baad animate in (isOpen=true pe play)
  useEffect(() => {
    if (isOpen) animateIn();
  }, [isOpen]);

  // ── Emoji select handler ──────────────────────────────────────────────────
  const handleSelect = useCallback((emoji: string) => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    // Select → close animation → parent callback
    animateOut(() => onSelect(emoji));
  }, [onSelect, animateOut]);

  // ── Backdrop press → close ───────────────────────────────────────────────
  const handleBackdropPress = useCallback(() => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    animateOut(onClose);
  }, [onClose, animateOut]);

  // ── Animated styles ───────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity:   containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"         // Hum khud animate karte hain
      statusBarTranslucent         // Android pe status bar ke upar bhi
      onRequestClose={handleBackdropPress}  // Android back button
    >
      {/* ── Full screen container ─────────────────────────────────────── */}
      <View style={s.modalRoot} pointerEvents="box-none">

        {/* ── Backdrop — tap karo toh picker band ────────────────────── */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityLabel="Dismiss reaction picker"
          accessibilityRole="button"
        >
          {/* Animated backdrop overlay */}
          <Animated.View
            style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
            pointerEvents="none"
          />
        </Pressable>

        {/* ── Picker container — centered, above keyboard ─────────────── */}
        <View
          style={s.pickerPositioner}
          pointerEvents="box-none"
        >
          {/*
            .reaction-picker:
              background:#FFF; border:1px solid var(--card-border)
              border-radius:20px; padding:10px 14px;
              box-shadow:var(--shadow-lg)
            popIn: scale(.85→1) + opacity(0→1)
          */}
          <Animated.View
            style={[s.pickerContainer, containerStyle]}
            // Tap on container should NOT propagate to backdrop
            pointerEvents="box-none"
          >
            {/*
              Arc row:
              - flexDirection: row, alignItems: flex-end
              - Har emoji ka translateY = arcStaticY (parabola) + entry spring
              - Result: center emoji upar, edges neeche → rainbow/arc shape
            */}
            <View style={s.emojiRow}>
              {REACTIONS.map((r, i) => (
                <PickerEmoji
                  key={r.emoji}
                  emoji={r.emoji}
                  label={r.label}
                  index={i}
                  isVisible={isOpen && visible}
                  onPress={handleSelect}
                />
              ))}
            </View>

            {/* Hint text — dismiss ke liye */}
            <Animated.Text
              style={[s.dismissHint, { opacity: containerOpacity.value }]}
            >
              tap bahar se band karo
            </Animated.Text>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

// ─── StyleSheet ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ════════════════ ReactionPill ════════════════════════════════════════════

  // .world-screen .rp
  pill: {
    backgroundColor: C.surface,         // #FFFEFB
    borderWidth:     1,
    borderColor:     C.pillBorder,       // #F1E5C8
    borderRadius:    14,                 // world-screen override: 14px
    paddingHorizontal: 10,               // padding: 4px 10px
    paddingVertical:   4,
    // box-shadow: 0 1px 3px rgba(154,122,24,.06), inset 0 1px 0 rgba(255,255,255,.6)
    // RN: inset shadow nahi hota, bahar wala hi milega
    shadowColor:     "rgba(154,122,24,1)",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    1.5,
    elevation:       1,
  },

  // .rp:hover / active state — gold border + gold bg
  pillActive: {
    backgroundColor: C.goldPale,        // --gold-pale
    borderColor:     C.gold,            // --gold
  },

  // Press visual feedback (.rp:active — scale already in Reanimated)
  pillPressed: {
    backgroundColor: C.goldPale,
    borderColor:     C.goldBorder,
  },

  // .world-screen .rp text: font-size:11px; font-weight:700; color:var(--text-mid)
  pillText: {
    fontSize:   FONT_SIZE.sm,            // 11px
    fontFamily: FONT_BODY.bold,          // DM Sans 700
    fontWeight: "700",
    color:      C.textMid,              // --text-mid #6B5330
    lineHeight: 16,
  },

  pillTextActive: {
    color: C.goldDeep,                  // Active = gold-deep text
  },

  // ════════════════ ReactionPicker — Overlay ════════════════════════════════

  // Full-screen modal root — transparent
  modalRoot: {
    flex:            1,
    justifyContent:  "flex-end",        // Picker neeche se thoda upar position hoga
    alignItems:      "center",
  },

  // .reaction-picker backdrop — HTML pe nahi tha, RN mein UX ke liye zaroori
  backdrop: {
    backgroundColor: C.backdrop,        // rgba(13,8,0,0.35)
  },

  // Picker ko screen ke 30% upar se position karo (keyboard area avoid)
  pickerPositioner: {
    width:          "100%",
    paddingBottom:  Platform.select({ ios: 140, android: 110 }),
    alignItems:     "center",
    pointerEvents:  "box-none",
  },

  // .reaction-picker:
  //   background:#FFF; border:1px solid var(--card-border)
  //   border-radius: var(--r-xl) → 20px
  //   padding: 10px 14px
  //   box-shadow: var(--shadow-lg) → 0 8px 32px rgba(0,0,0,.08)
  pickerContainer: {
    backgroundColor: C.white,
    borderWidth:     1,
    borderColor:     C.cardBorder,       // --card-border #EDE3CC
    borderRadius:    20,                 // --r-xl
    paddingHorizontal: 14,               // padding: 10px 14px
    paddingTop:        10,
    paddingBottom:     8,
    // var(--shadow-lg): 0 8px 32px rgba(0,0,0,.08)
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.12,
    shadowRadius:    16,
    elevation:       12,                 // Android ke liye strong elevation
    minWidth:        260,
  },

  // Arc emoji row — alignItems: flex-end taaki translateY se arc upar uthay
  emojiRow: {
    flexDirection:  "row",
    alignItems:     "flex-end",          // Edges baseline par, center arc se upar jaata hai
    gap:            2,                   // .reaction-picker: gap:8px — thoda kam for arc feel
    paddingTop:     ARC_HEIGHT + 4,      // Arc ke upar space chahiye
    paddingBottom:  4,
  },

  // .rp-option pressable wrapper — hit area
  emojiPressable: {
    padding:    4,                       // .rp-option: padding:4px
    alignItems: "center",
  },

  // Emoji animated view — size container
  emojiWrap: {
    alignItems:     "center",
    justifyContent: "center",
    width:          36,
    height:         36,
  },

  // .rp-option: font-size:22px
  emojiText: {
    fontSize:   22,                      // .rp-option: font-size:22px
    lineHeight: 28,
    textAlign:  "center",
  },

  // Hint text — subtle, auto dismiss ke baare mein
  dismissHint: {
    textAlign:  "center",
    fontSize:   9,
    fontFamily: FONT_BODY.semiBold,
    fontWeight: "600",
    color:      C.textMid,
    opacity:    0.5,
    marginTop:  2,
    letterSpacing: 0.3,
  },
});

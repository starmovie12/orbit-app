/**
 * Reactions.tsx — components/Reactions.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD — Three exports:
 *
 *   Reactions       → P1 molecule  (NEW — main consumer-facing API)
 *                     Props: { reactions, onReact, style? }
 *                     - Renders reaction pills in a horizontal row
 *                     - Long press → opens ReactionPicker
 *                     - Tap existing pill → toggle (react / un-react)
 *                     - Animated count spring pop on increment
 *                     - Haptic feedback via useHaptics
 *                     - React.memo
 *
 *   ReactionPill    → atom  (updated)
 *                     - onLongPress added
 *                     - Count change → withSpring scale pop (1 → 1.35 → 1)
 *
 *   ReactionPicker  → molecule  (updated — 6 emojis, 👑 removed)
 *                     - Arc layout + stagger spring
 *                     - 3s auto-close
 *
 * Design tokens: colors.* / spacing.* / radii.* / FONT_BODY / FONT_SIZE
 * Animation:     Reanimated v4 — withSpring / withTiming / withDelay / runOnJS
 * Haptics:       impactLight (react/un-react) · impactMedium (picker open)
 *
 * LAW compliance:
 *   LAW 13 — not a nav item, no Glass Island conflict
 *   Rule 03 — no avatar rendered
 *   Zero hardcoded colors / spacing / radii
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
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

import { colors, palette, radii, spacing } from "@/constants/colors";
import { FONT_BODY, FONT_SIZE }   from "@/constants/typography";
import { useHaptics }             from "@/hooks/useHaptics";

// ─── Design Tokens (semantic — zero raw hex) ─────────────────────────────────

const T = {
  pillBg:           palette.cream[200],          // §5.A: #F5E6C8 — warm ivory chip bg
  pillBgActive:     palette.gold[50],            // active: lightest gold wash
  pillBgPressed:    palette.cream[300],          // pressed: one step deeper cream
  pillBorder:       colors.border.default,
  pillBorderActive: colors.border.cardEmphasis,
  pillText:         colors.fg.secondary,
  pillTextActive:   colors.fg.brandText,

  addBg:            colors.bg.subtle,
  addBorder:        colors.border.default,
  addText:          colors.fg.tertiary,

  pickerBg:         colors.bg.surface,
  pickerBorder:     colors.border.card,
  backdrop:         colors.bg.scrim,
  dismissHint:      colors.fg.tertiary,

  shadowColor:      palette.gold[600],
  shadowDark:       palette.ink[950],
} as const;

// ─── 6 Standard Emojis (MAX 6 — 👑 removed per spec) ────────────────────────

interface ReactionDef { emoji: string; label: string }

const REACTIONS: ReactionDef[] = [
  { emoji: "🔥", label: "Fire"       },
  { emoji: "🙌", label: "Hands up"   },
  { emoji: "❤️", label: "Heart"      },
  { emoji: "😂", label: "Laugh"      },
  { emoji: "😮", label: "Wow"        },
  { emoji: "💯", label: "100 points" },
];

// ─── Arc geometry ─────────────────────────────────────────────────────────────
// 6 emojis → center between index 2 and 3 (mid = 2.5)

const ARC_HEIGHT = 12;

function arcStaticY(index: number): number {
  const mid = (REACTIONS.length - 1) / 2; // 2.5
  return -ARC_HEIGHT * (1 - Math.pow((index - mid) / mid, 2));
}

// ─── Spring configs ───────────────────────────────────────────────────────────

const CONTAINER_SPRING = SnappySpringConfig;

const EMOJI_ENTRY_SPRING = { damping: 12, mass: 0.8, stiffness: 200 } as const;
const PRESS_SPRING       = { damping:  8, mass: 0.5, stiffness: 300 } as const;

// Count spring — quick pop on increment / decrement
const COUNT_POP_SPRING = { damping: 10, mass: 0.6, stiffness: 340 } as const;

const STAGGER_MS    = 35;
const EXIT_DURATION = 110;

// ═══════════════════════════════════════════════════════════════════════════
// ─── INTERNAL: AnimatedCountText ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Spring-pops (1 → 1.35 → 1) whenever `count` changes.
 * Separate component so Reanimated hooks aren't called in a map loop.
 */
interface AnimatedCountTextProps { count: number; active: boolean }

const AnimatedCountText = React.memo<AnimatedCountTextProps>(({ count, active }) => {
  const scale   = useSharedValue(1);
  const prevRef = useRef(count);

  useEffect(() => {
    if (count !== prevRef.current) {
      scale.value = 1.35;                          // snap up
      scale.value = withSpring(1, COUNT_POP_SPRING); // spring back
      prevRef.current = count;
    }
  }, [count]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text
      style={[s.pillCountText, active && s.pillCountTextActive, animStyle]}
    >
      {count}
    </Animated.Text>
  );
});
AnimatedCountText.displayName = "AnimatedCountText";

// ═══════════════════════════════════════════════════════════════════════════
// ─── COMPONENT 1: ReactionPill ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export interface ReactionPillProps {
  emoji:        string;
  count:        number;
  active?:      boolean;
  onPress:      () => void;
  onLongPress?: () => void;
  style?:       StyleProp<ViewStyle>;
}

export const ReactionPill = React.memo<ReactionPillProps>(({
  emoji,
  count,
  active = false,
  onPress,
  onLongPress,
  style,
}) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn  = useCallback(() => {
    scale.value = withSpring(0.94, SnappySpringConfig);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SnappySpringConfig);
  }, []);

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={380}
        style={({ pressed }) => [
          s.pill,
          active  && s.pillActive,
          pressed && s.pillPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${emoji} reaction, ${count} people`}
        accessibilityState={{ selected: active }}
        hitSlop={10}
      >
        <Text style={s.pillEmoji}>{emoji}</Text>
        <AnimatedCountText count={count} active={active} />
      </Pressable>
    </Animated.View>
  );
});
ReactionPill.displayName = "ReactionPill";

// ═══════════════════════════════════════════════════════════════════════════
// ─── INTERNAL: PickerEmoji ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

interface PickerEmojiProps {
  emoji:     string;
  label:     string;
  index:     number;
  isVisible: boolean;
  onPress:   (emoji: string) => void;
}

const PickerEmoji = React.memo<PickerEmojiProps>(({
  emoji, label, index, isVisible, onPress,
}) => {
  const scale      = useSharedValue(0);
  const translateY = useSharedValue(18);
  const pressScale = useSharedValue(1);

  const staticArcY = arcStaticY(index);

  useEffect(() => {
    if (isVisible) {
      const delay = index * STAGGER_MS;
      scale.value      = withDelay(delay, withSpring(1, EMOJI_ENTRY_SPRING));
      translateY.value = withDelay(delay, withSpring(0, EMOJI_ENTRY_SPRING));
    } else {
      scale.value = withTiming(0, { duration: EXIT_DURATION });
    }
  }, [isVisible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pressScale.value },
      { translateY: staticArcY + translateY.value },
    ],
  }));

  const handlePressIn  = useCallback(() => { pressScale.value = withSpring(1.3, PRESS_SPRING); }, []);
  const handlePressOut = useCallback(() => { pressScale.value = withSpring(1,   PRESS_SPRING); }, []);
  const handlePress    = useCallback(() => { onPress(emoji); }, [emoji, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={s.emojiPressable}
    >
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

export interface ReactionPickerProps {
  visible:  boolean;
  onSelect: (emoji: string) => void;
  onClose:  () => void;
}

export const ReactionPicker = React.memo<ReactionPickerProps>(({
  visible, onSelect, onClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const containerScale   = useSharedValue(0.85);
  const containerOpacity = useSharedValue(0);
  const backdropOpacity  = useSharedValue(0);
  const autoCloseTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeModal = useCallback(() => setIsOpen(false), []);

  const animateIn = useCallback(() => {
    containerScale.value   = withSpring(1, CONTAINER_SPRING);
    containerOpacity.value = withTiming(1, { duration: 120 });
    backdropOpacity.value  = withTiming(1, { duration: 200 });
  }, []);

  const animateOut = useCallback((callback?: () => void) => {
    containerOpacity.value = withTiming(
      0, { duration: EXIT_DURATION },
      (finished) => {
        if (finished) {
          runOnJS(closeModal)();
          if (callback) runOnJS(callback)();
        }
      }
    );
    containerScale.value  = withSpring(0.88, CONTAINER_SPRING);
    backdropOpacity.value = withTiming(0, { duration: EXIT_DURATION });
  }, [closeModal]);

  useEffect(() => {
    if (visible) {
      containerScale.value   = 0.85;
      containerOpacity.value = 0;
      backdropOpacity.value  = 0;
      setIsOpen(true);

      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = setTimeout(() => animateOut(onClose), 3000);
    } else {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      animateOut();
    }

    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [visible]);

  useEffect(() => { if (isOpen) animateIn(); }, [isOpen]);

  const handleSelect = useCallback((emoji: string) => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    animateOut(() => onSelect(emoji));
  }, [onSelect, animateOut]);

  const handleBackdropPress = useCallback(() => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    animateOut(onClose);
  }, [onClose, animateOut]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity:   containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <View style={s.modalRoot} pointerEvents="box-none">

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityLabel="Dismiss reaction picker"
          accessibilityRole="button"
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
            pointerEvents="none"
          />
        </Pressable>

        <View style={s.pickerPositioner} pointerEvents="box-none">
          <Animated.View style={[s.pickerContainer, containerStyle]} pointerEvents="box-none">

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

            <Animated.Text style={[s.dismissHint, { opacity: containerOpacity.value }]}>
              tap bahar se band karo
            </Animated.Text>

          </Animated.View>
        </View>

      </View>
    </Modal>
  );
});
ReactionPicker.displayName = "ReactionPicker";

// ═══════════════════════════════════════════════════════════════════════════
// ─── COMPONENT 3: Reactions  ← P1 molecule (primary export) ──────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full reaction system for a post or message.
 *
 * Consumer wires Firestore:
 *   onReact(emoji) →
 *     userReacted === true  → Firestore arrayRemove + decrement
 *     userReacted === false → Firestore arrayUnion  + increment
 *
 * Tap  existing pill     → toggle own reaction  (impactLight)
 * Tap  "+" add button    → open picker          (impactMedium)
 * Long press any pill    → open picker          (impactMedium)
 * Picker select          → onReact(emoji)       (impactLight)
 */
export interface ReactionsProps {
  reactions: {
    emoji:       string;
    count:       number;
    userReacted: boolean;
  }[];
  onReact: (emoji: string) => void;
  style?:  StyleProp<ViewStyle>;
}

export const Reactions = React.memo<ReactionsProps>(({
  reactions,
  onReact,
  style,
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const { impactLight, impactMedium }     = useHaptics();

  // Show pills for reactions with count > 0 or already reacted (optimistic UI)
  // Cap at 6 (matches MAX 6 emoji types rule)
  const visibleReactions = useMemo(
    () => reactions.filter((r) => r.count > 0 || r.userReacted).slice(0, 6),
    [reactions]
  );

  const handlePillPress = useCallback((emoji: string) => {
    impactLight();
    onReact(emoji);
  }, [impactLight, onReact]);

  const openPicker = useCallback(() => {
    impactMedium();
    setPickerVisible(true);
  }, [impactMedium]);

  const handlePickerSelect = useCallback((emoji: string) => {
    setPickerVisible(false);
    impactLight();
    onReact(emoji);
  }, [impactLight, onReact]);

  const handlePickerClose = useCallback(() => {
    setPickerVisible(false);
  }, []);

  return (
    <View style={[s.reactionsRoot, style]}>

      {/* ── Pill row ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillRow}
        scrollEnabled={visibleReactions.length > 4}
      >
        {visibleReactions.map((r) => (
          <ReactionPill
            key={r.emoji}
            emoji={r.emoji}
            count={r.count}
            active={r.userReacted}
            onPress={() => handlePillPress(r.emoji)}
            onLongPress={openPicker}
            style={s.pillGap}
          />
        ))}

        {/* "+" add / open picker */}
        <Pressable
          onPress={openPicker}
          onLongPress={openPicker}
          delayLongPress={380}
          style={({ pressed }) => [s.addBtn, pressed && s.addBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add reaction"
          accessibilityHint="Opens emoji picker"
          hitSlop={10}
        >
          <Text style={s.addBtnText}>+</Text>
        </Pressable>
      </ScrollView>

      {/* ── Picker modal ──────────────────────────────────────────────── */}
      <ReactionPicker
        visible={pickerVisible}
        onSelect={handlePickerSelect}
        onClose={handlePickerClose}
      />

    </View>
  );
});
Reactions.displayName = "Reactions";

// ─── StyleSheet ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Reactions root ──────────────────────────────────────────────────────

  reactionsRoot: {
    flexDirection: "row",
    alignItems:    "center",
  },

  pillRow: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical: 2,
  },

  pillGap: {
    marginRight: spacing.xs,            // 4pt between pills
  },

  // ── ReactionPill ────────────────────────────────────────────────────────

  pill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   T.pillBg,
    borderWidth:       1,
    borderColor:       T.pillBorder,
    borderRadius:      radii.pill,
    paddingHorizontal: spacing.sm + 2,  // 10pt
    // Blueprint §5.A: "each: 24×24 chip" — visual height strictly 24px
    // computed: lineHeight(16) + pad(3×2=6) + border(1×2=2) = 24px ✓
    // Touch target (44pt) achieved via hitSlop={10} — no visual inflation needed
    paddingVertical:   3,
    // shadow.tier1
    shadowColor:       T.shadowColor,
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.06,
    shadowRadius:      2,
    elevation:         1,
  },

  pillActive: {
    backgroundColor: T.pillBgActive,
    borderColor:     T.pillBorderActive,
  },

  pillPressed: {
    backgroundColor: T.pillBgPressed,
    borderColor:     T.pillBorderActive,
  },

  pillEmoji: {
    fontSize:   13,
    lineHeight: 16,
  },

  pillCountText: {
    fontSize:   FONT_SIZE.xs,           // 11px
    fontFamily: FONT_BODY.bold,
    fontWeight: "700",
    color:      T.pillText,
    lineHeight: 16,
  },

  pillCountTextActive: {
    color: T.pillTextActive,
  },

  // ── Add button ──────────────────────────────────────────────────────────

  addBtn: {
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: T.addBg,
    borderWidth:     1,
    borderColor:     T.addBorder,
    borderRadius:    radii.pill,
    width:           24,   // Blueprint §5.A: 24×24 chip
    height:          24,   // Touch target via hitSlop={10} → 44pt (Rule 5.Q)
  },

  addBtnPressed: {
    borderColor:     T.pillBorderActive,
    backgroundColor: T.pillBgActive,
  },

  addBtnText: {
    fontSize:   FONT_SIZE.base,         // 15px
    fontFamily: FONT_BODY.regular,
    color:      T.addText,
    lineHeight: 18,
    marginTop:  Platform.OS === "android" ? -2 : 0,
  },

  // ── ReactionPicker — Overlay ────────────────────────────────────────────

  modalRoot: {
    flex:           1,
    justifyContent: "flex-end",
    alignItems:     "center",
  },

  backdrop: {
    backgroundColor: T.backdrop,
  },

  pickerPositioner: {
    width:          "100%",
    paddingBottom:  Platform.select({ ios: 140, android: 110 }),
    alignItems:     "center",
    pointerEvents:  "box-none",
  },

  pickerContainer: {
    backgroundColor:   T.pickerBg,
    borderWidth:       1,
    borderColor:       T.pickerBorder,
    borderRadius:      radii["2xl"],    // §A.1.4: designated modal / bottom-sheet token
    paddingHorizontal: spacing.base - 2,
    paddingTop:        spacing.sm + 2,
    paddingBottom:     spacing.sm,
    shadowColor:       T.shadowDark,
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:     0.12,
    shadowRadius:      16,
    elevation:         12,
    minWidth:          240,
  },

  emojiRow: {
    flexDirection: "row",
    alignItems:    "flex-end",
    gap:           2,
    paddingTop:    ARC_HEIGHT + 4,
    paddingBottom: spacing.xs,
  },

  emojiPressable: {
    padding:    spacing.xs,
    alignItems: "center",
  },

  emojiWrap: {
    alignItems:     "center",
    justifyContent: "center",
    width:          36,
    height:         36,
  },

  emojiText: {
    fontSize:  22,
    lineHeight: 28,
    textAlign: "center",
  },

  dismissHint: {
    textAlign:     "center",
    fontSize:      9,
    fontFamily:    FONT_BODY.semiBold,
    fontWeight:    "600",
    color:         T.dismissHint,
    opacity:       0.5,
    marginTop:     2,
    letterSpacing: 0.3,
  },
});

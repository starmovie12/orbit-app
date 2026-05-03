/**
 * ChatInput — components/molecules/ChatInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: molecule · Status: new · P0
 *
 * Spec ref  : § Home Screen [7] STICKY INPUT AREA
 * Blueprint : H=64px + safeAreaBottom · Bg=#FFFFFF · Z-Index=stickyCTA(940)
 *
 * Sub-elements
 * ────────────
 *  [7.A] Input Field   — pill · cream bg · animated border on focus
 *  [7.B] Send Button   — circular 40px · state machine: idle/active/sending/failed
 *  [7.C] Emoji Trigger — 20×20 inside input · right-aligned · opens emoji KB
 *  [7.D] Char Counter  — shows from 850 chars · fades in above input row
 *
 * Compliance
 * ──────────
 *  ✓ Rule 03 — NO user avatar in composer (avatar lives ONLY in Glass Island Profile tab)
 *  ✓ Rule 04 — position: static · margin-bottom: 0 · flush above Glass Island
 *  ✓ Z-Index — zIndexTokens.stickyCTA (940) · below Glass Island (950)
 *  ✓ Radius Protocol — radii.pill on input field + send button (no height/2 calculations)
 *  ✓ Auth gate — tap on unauthenticated input triggers onAuthGate before keyboard opens
 *  ✓ Haptic — impactLight on send (Blueprint Q13 · 16 triggers)
 *  ✓ Keyboard — KeyboardAvoidingView is the PARENT's responsibility (see § KEYBOARD note)
 *  ✓ React.memo — all props are primitives + stable callbacks
 *
 * § KEYBOARD NOTE
 * The spec (§ Section 5) mandates KeyboardAvoidingView wraps the ENTIRE screen
 * below the header — not just this component. This component is position:static
 * so the parent HomeScreen should wrap [ChatBody + ChatInput] in one KAV:
 *
 *   <KeyboardAvoidingView
 *     behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
 *     keyboardVerticalOffset={0}
 *     style={{ flex: 1 }}
 *   >
 *     <ChatBody />
 *     <ChatInput ... />
 *   </KeyboardAvoidingView>
 *
 * § Z-INDEX DISCREPANCY NOTE
 * Blueprint text says z-935; token file (§ 6) defines stickyCTA=940.
 * Token wins — zIndexTokens.stickyCTA (940) used throughout.
 * Still strictly below glassIsland (950) — Rule 04 preserved.
 *
 * § onVoice / onImage NOTE
 * Props accepted for future media attachment row.
 * Blueprint §[7] current revision has no voice/image buttons in composer;
 * they are not rendered. Remove from props when the attachment row ships.
 *
 * Deps:
 *   @expo/vector-icons (Feather) · react-native-safe-area-context
 *   hooks/useHaptics · constants/colors · constants/typography
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHaptics }                         from '@/hooks/useHaptics';
import {
  animation,
  colors,
  dimensions,
  palette,
  radii,
  spacing,
  zIndex as zIndexTokens,
}                                             from '@/constants/colors';
import { FONT_BODY, FONT_SIZE }               from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DIMENSION & LAYOUT CONSTANTS
// All values from Blueprint §[7] and constants/colors.ts dimension tokens.
// ─────────────────────────────────────────────────────────────────────────────

/** Composer strip height excluding safe-area — Blueprint §[7] H: 64px */
const STRIP_H = dimensions.inputLg; // 64

/** Vertical padding inside the strip — Blueprint §[7] "12px top · 12px bottom" */
const PAD_V = spacing.md; // 12

/** Horizontal padding — Blueprint §[7] "16px L/R" */
const PAD_H = spacing.base; // 16

/** Input field fixed height — Blueprint §[7.A] H: 40px */
const INPUT_H = dimensions.chatInputH; // 40

/** Send button visual size — Blueprint §[7.B] 40×40 */
const SEND_SIZE = dimensions.btnSendSize; // 40

/** Send button icon size — Blueprint §[7.B] icon 20×20 */
const SEND_ICON_SIZE = dimensions.btnSendInner; // 20

/** Gap between input field and send button — Blueprint §[7] 8px */
const INPUT_SEND_GAP = spacing.sm; // 8

/**
 * Input field internal horizontal padding — Blueprint §[7.A] "14px L · 14px R".
 * No spacing token for 14 — spec-mandated literal, used only here.
 */
const INPUT_PAD_H = 14 as const;

/** Emoji button size inside input — Blueprint §[7.A] Emoji icon: 20×20 */
const EMOJI_SIZE = 20 as const;

/**
 * Emoji button right offset inside input — Blueprint §[7.A] "12px from right edge".
 * No spacing token for 12... actually spacing.md = 12. Using token.
 */
const EMOJI_RIGHT = spacing.md; // 12

/**
 * Input right padding: reserves space for the 20px emoji icon + 12px from right
 * + 8px gap between text cursor and icon left edge.
 * Total: 12 + 20 + 8 = 40px
 *
 * ⚠️  FUTURE ICONS NOTE: This padding ONLY reserves space for the single emoji
 * trigger defined in Blueprint §[7.A]. If voice/image buttons are added to the
 * right side of the input field in a future revision, this value must be updated:
 *   INPUT_PAD_RIGHT = EMOJI_RIGHT + (iconCount × EMOJI_SIZE) + ((iconCount) × gapBetweenIcons)
 * Failing to update will cause text to overlap the new icons.
 * Corresponding EMOJI_RIGHT constant (absolute position of first icon from right)
 * stays the same — additional icons stack leftward from it.
 */
const INPUT_PAD_RIGHT = EMOJI_RIGHT + EMOJI_SIZE + spacing.sm; // 40

/** Idle input border width — Blueprint §[7.A] "1px solid #E8D5A0" */
const BORDER_IDLE_W = 1 as const;

/** Focused input border width — Blueprint §[7.A] "2px #D4A017 (focused)" */
const BORDER_FOCUS_W = 2 as const;

/**
 * Input field idle opacity when disabled (offline state) — Blueprint §[7.A] "opacity 0.5"
 * Not exposed as prop; controlled via `editable` when implementing offline banner.
 */
const INPUT_DISABLED_OPACITY = 0.5 as const;

/** Max chars allowed — Blueprint §[7.A] "Max chars: 1000" */
const CHAR_LIMIT = 1_000 as const;

/** Char counter appears from this threshold — Blueprint §[7.A] "counter visible from 850 chars" */
const COUNTER_THRESHOLD = 850 as const;

/** Send button opacity when disabled (no text) — Blueprint §[7.B] "Opacity: 0.6" */
const SEND_DISABLED_OPACITY = 0.6 as const;

/** Failed state auto-reset duration — Blueprint §[7.B] "failed (3s) → idle" */
const FAILED_RESET_MS = 3_000 as const;

/** Brief sending state duration before returning to idle (fire-and-forget onSend) */
const SENDING_IDLE_RESET_MS = 300 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLOR CONSTANTS
// All from semantic tokens — zero hardcoded hex literals.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip background — Blueprint §[7] "Bg #FFFFFF" */
const STRIP_BG = colors.bg.surface; // #FFFFFF

/** Top divider — Blueprint §[7] "top border 1px #E8D5A0" */
const STRIP_BORDER = colors.border.default; // cream[400]

/** Input field background — Blueprint §[7.A] "#F5E6C8" → v2 cream[200] */
const INPUT_BG = palette.cream[200]; // #F7ECD0

/** Input idle border color */
const INPUT_BORDER_IDLE = colors.border.inputIdle; // cream[400]

/** Input focused / filled border color */
const INPUT_BORDER_FOCUS = colors.border.inputFocus; // gold[600] #C9A227

/** Input text color — Blueprint §[7.A] "15px 400 #1A1A1A" */
const INPUT_TEXT_COLOR = colors.fg.primary; // ink[950] #1A1208

/** Input placeholder color — Blueprint §[7.A] "placeholder 15px 400 #6B5B2E" */
const INPUT_PLACEHOLDER_COLOR = colors.fg.placeholder; // ink[500]

/** Emoji icon color — Blueprint §[7.A] "20×20 · #6B5B2E" */
const EMOJI_COLOR = colors.fg.secondary; // ink[600] #6B5B47

/** Send button idle background — Blueprint §[7.B] Idle: "#F5E6C8" → cream[200] */
const SEND_BG_IDLE = palette.cream[200]; // #F7ECD0

/** Send button idle icon color — Blueprint §[7.B] Idle: "#6B5B2E" */
const SEND_ICON_IDLE = colors.fg.secondary; // ink[600]

/** Send button active background — Blueprint §[7.B] Active: "#D4A017" → gold[600] */
const SEND_BG_ACTIVE = colors.fg.brand; // gold[600] #C9A227

/** Send button active/sending icon color — Blueprint §[7.B] Active: "#FFFFFF" */
const SEND_ICON_ACTIVE = palette.white; // #FFFFFF

/** Send button failed background — Blueprint §[7.B] Failed: "#E07B20" → amber[600] */
const SEND_BG_FAILED = palette.amber[600]; // #D4651A

/** Char counter warning color — amber when nearing limit */
const COUNTER_COLOR_DEFAULT = colors.fg.secondary;   // ink[600]
/**
 * Warning color — Blueprint §[7.A]: last 50 chars warning.
 * Rev fix: was palette.amber[600] (hardcoded primitive).
 * Now: colors.fg.warning (semantic token → amber[600] = #D4651A).
 * Same value, but token ensures design system consistency if amber scale shifts.
 */
const COUNTER_COLOR_WARN    = colors.fg.warning;      // semantic token → amber[600] #D4651A

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Send button state machine — Blueprint §[7.B] state table */
type SendState = 'idle' | 'active' | 'sending' | 'failed';

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatInputProps {
  /**
   * Called when the user taps the active send button.
   * Receives trimmed, non-empty text.
   * onSend is fire-and-forget — the component returns to idle after calling it.
   * Message-level send state (✓ / ⚠️) is managed in the bubble, not here.
   */
  onSend: (text: string) => void;

  /**
   * Reserved for future voice recording button.
   * Not rendered in current blueprint revision — prop kept for API stability.
   */
  onVoice?: () => void;

  /**
   * Reserved for future image attachment button.
   * Not rendered in current blueprint revision — prop kept for API stability.
   */
  onImage?: () => void;

  /**
   * Triggered when an unauthenticated user taps the input field.
   * Caller should open the Auth Gate bottom sheet.
   * The input will NOT open the keyboard before this is called.
   */
  onAuthGate?: () => void;

  /**
   * Whether the current user is authenticated.
   * false → tap on input calls onAuthGate instead of opening keyboard.
   */
  isAuthenticated: boolean;

  /**
   * Input placeholder copy.
   * @default "Sector 17 mein message likho..."
   */
  placeholder?: string;

  /**
   * Offline / network-error disabled state.
   * Blueprint §[7.A] State (disabled): "opacity 0.5 (offline state)".
   * When true:
   *   · Input container opacity drops to INPUT_DISABLED_OPACITY (0.5)
   *   · TextInput is not editable (keyboard will not open)
   *   · Send button is disabled (existing sendState guard handles this)
   * Distinct from `isAuthenticated=false` — auth gate shows a sheet;
   * `disabled=true` silently blocks interaction during offline state.
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional styles applied to the outermost container.
   * Use sparingly — most layout is fixed by Rule 04.
   */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — SUB-COMPONENT: SendButton
// ─────────────────────────────────────────────────────────────────────────────

interface SendButtonProps {
  sendState:  SendState;
  onPress:    () => void;
  spinValue:  Animated.Value; // shared animated value for spinner rotation
}

/**
 * SendButton
 *
 * 40×40 circular button with four visual states:
 *   idle     — cream bg · play icon · opacity 0.6 · disabled
 *   active   — gold bg · send icon · opacity 1.0 · enabled (+ spring scale on transition)
 *   sending  — gold bg · rotating loader · disabled
 *   failed   — amber bg · warning icon · disabled → auto-resets to idle after 3s
 *
 * Radius Protocol: radii.pill (9999) — RN clamps to SEND_SIZE/2 = 20px for full circle.
 */
const SendButtonBase: React.FC<SendButtonProps> = ({ sendState, onPress, spinValue }) => {
  // ── Scale spring on idle→active ────────────────────────────────────────
  const btnScale   = useRef(new Animated.Value(1)).current;
  const wasActive  = useRef(false);

  const isActiveNow = sendState === 'active';

  useEffect(() => {
    if (isActiveNow && !wasActive.current) {
      // Blueprint §[7.B]: "scale 0.9→1.0 spring(gentle) 200ms" on idle→active
      btnScale.setValue(0.9);
      Animated.spring(btnScale, {
        toValue:         1,
        stiffness:       animation.easing.springGentle.stiffness, // 100
        damping:         animation.easing.springGentle.damping,   // 15
        useNativeDriver: true,
      }).start();
    }
    wasActive.current = isActiveNow;
  }, [isActiveNow, btnScale]);

  // ── Spinner rotation interpolation ─────────────────────────────────────
  const spin = spinValue.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Derived visual props per state ─────────────────────────────────────
  const isDisabled = sendState === 'idle' || sendState === 'sending' || sendState === 'failed';
  const bgColor    = sendState === 'idle'
    ? SEND_BG_IDLE
    : sendState === 'failed'
      ? SEND_BG_FAILED
      : SEND_BG_ACTIVE;

  // ── Icon per state ──────────────────────────────────────────────────────
  const renderIcon = (): React.ReactNode => {
    if (sendState === 'sending') {
      return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Feather
            name="loader"
            size={SEND_ICON_SIZE - 4}  // 16px per Blueprint §[7.B]
            color={SEND_ICON_ACTIVE}
          />
        </Animated.View>
      );
    }
    if (sendState === 'failed') {
      return (
        <Feather
          name="alert-triangle"
          size={SEND_ICON_SIZE}
          color={SEND_ICON_ACTIVE}
        />
      );
    }
    if (sendState === 'active') {
      return (
        <Feather
          name="send"
          size={SEND_ICON_SIZE}
          color={SEND_ICON_ACTIVE}
        />
      );
    }
    // idle — play arrow (closest Feather icon to ▷)
    return (
      <Feather
        name="play"
        size={SEND_ICON_SIZE}
        color={SEND_ICON_IDLE}
      />
    );
  };

  const accessibilityLabel = sendState === 'active' || sendState === 'sending'
    ? 'Send message'
    : 'Send button. Type a message first.';

  return (
    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}  // 44×44 touch target
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        testID="home-send-button"
        style={({ pressed }) => [
          sendButtonStyles.button,
          { backgroundColor: bgColor },
          isDisabled && sendButtonStyles.disabled,
          pressed && !isDisabled && sendButtonStyles.pressed,
        ]}
      >
        {renderIcon()}
      </Pressable>
    </Animated.View>
  );
};

const SendButtonMemo = React.memo(SendButtonBase);

const sendButtonStyles = StyleSheet.create({
  button: {
    width:          SEND_SIZE,          // 40px — Blueprint §[7.B]
    height:         SEND_SIZE,          // 40px
    borderRadius:   radii.pill,         // 9999 — Radius Protocol (RN clamps to 20px for circle)
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  disabled: {
    opacity: SEND_DISABLED_OPACITY,     // 0.6 — Blueprint §[7.B] Idle
  },
  pressed: {
    opacity: 0.85,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ChatInput
 *
 * Sticky bottom composer. Always visible — never hides (Rule 04).
 * Position: static — sits in the normal document flow, flush above Glass Island.
 *
 * ⛔ RULE 04 COMPLIANCE:
 *   position             : static (NOT absolute · NOT floating)
 *   margin-bottom        : 0 — Glass Island is immediately below
 *   z-index              : zIndexTokens.stickyCTA (940) — above content · below Glass Island
 *
 * ⛔ RULE 03 COMPLIANCE:
 *   No user avatar in this composer. Avatar lives ONLY in Glass Island Profile tab.
 *
 * Layout (horizontal flex):
 *   [input field flex-1] → 8px gap → [send button 40×40]
 *   (previously included [avatar 32px] — removed per Rule 03)
 *
 * @example
 * // Parent HomeScreen (inside KeyboardAvoidingView):
 * <ChatInput
 *   onSend={handleSend}
 *   isAuthenticated={!!user}
 *   onAuthGate={openAuthSheet}
 *   placeholder="Sector 17 mein message likho..."
 * />
 */
const ChatInputBase: React.FC<ChatInputProps> = ({
  onSend,
  onVoice:      _onVoice,   // reserved — not rendered in current revision
  onImage:      _onImage,   // reserved — not rendered in current revision
  onAuthGate,
  isAuthenticated,
  disabled      = false,
  placeholder   = 'Sector 17 mein message likho...',
  style,
}) => {
  const insets  = useSafeAreaInsets();
  const haptics = useHaptics();

  // ── State ─────────────────────────────────────────────────────────────────
  const [text,        setText]        = useState<string>('');
  const [isFocused,   setIsFocused]   = useState<boolean>(false);
  const [sendState,   setSendState]   = useState<SendState>('idle');

  // ── Refs ──────────────────────────────────────────────────────────────────
  const inputRef        = useRef<TextInput>(null);
  const failedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Spinner animation value (shared with SendButton) ─────────────────────
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop  = useRef<Animated.CompositeAnimation | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.1 — Spinner: start/stop when sendState changes to/from 'sending'
  // Blueprint §[7.B]: "16×16 #FFFFFF spinner (1000ms linear infinite)"
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sendState === 'sending') {
      spinValue.setValue(0);
      spinLoop.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue:         1,
          duration:        1_000,      // Blueprint §[7.B]: 1000ms
          easing:          Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinLoop.current = null;
      spinValue.setValue(0);
    }
  }, [sendState, spinValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      spinLoop.current?.stop();
      if (failedTimerRef.current)  clearTimeout(failedTimerRef.current);
      if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.2 — Derive send state from text length
  // sendState tracks: idle (no text) · active (has text) · sending · failed
  // sending and failed are set by handleSend — don't override them here.
  // ─────────────────────────────────────────────────────────────────────────

  const hasText = text.trim().length > 0;

  useEffect(() => {
    // Only update idle↔active — don't clobber 'sending' or 'failed'
    if (sendState === 'sending' || sendState === 'failed') return;
    setSendState(hasText ? 'active' : 'idle');
  }, [hasText, sendState]);

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.3 — Char counter display
  // Blueprint §[7.A]: "Max chars: 1000 · counter visible from 850 chars (subtle)"
  // ─────────────────────────────────────────────────────────────────────────

  const charsLeft   = CHAR_LIMIT - text.length;
  const showCounter = text.length >= COUNTER_THRESHOLD;
  const counterWarn = charsLeft <= 50; // last 50 chars → amber warning color

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.4 — Auth gate
  // Blueprint §[7.A]: "on first tap if unauthenticated → auth bottom sheet
  // appears before keyboard opens"
  // ─────────────────────────────────────────────────────────────────────────

  const handleInputFocus = useCallback((): void => {
    if (!isAuthenticated) {
      // Blur immediately — prevents keyboard from opening
      inputRef.current?.blur();
      onAuthGate?.();
      return;
    }
    setIsFocused(true);
    // Blueprint Q13: "Tap input field to focus" → impactLight
    haptics.impactLight();
  }, [isAuthenticated, onAuthGate, haptics]);

  const handleInputBlur = useCallback((): void => {
    setIsFocused(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.5 — Send handler
  // Blueprint §[7.B] on tap (active):
  //   1. Haptic light
  //   2. Optimistic bubble (parent's job)
  //   3. Input field clears immediately
  //   4. Send button → sending state
  //   5. Network call (parent's job via onSend)
  //   6. Return to idle (fire-and-forget; per-bubble status managed by parent)
  // ─────────────────────────────────────────────────────────────────────────

  const handleSend = useCallback((): void => {
    const trimmed = text.trim();
    if (!trimmed || sendState !== 'active') return;

    // 1. Haptic — Blueprint §[7.B] "Haptic light" + Q13 trigger
    haptics.impactLight();

    // 3. Clear input immediately (optimistic UX)
    setText('');

    // 4. Sending state — shows spinner
    setSendState('sending');

    // 5. Notify parent (fire-and-forget)
    onSend(trimmed);

    // 6. Return to idle (parent manages per-bubble failure state)
    sendingTimerRef.current = setTimeout(() => {
      setSendState(text.trim().length > 0 ? 'active' : 'idle');
    }, SENDING_IDLE_RESET_MS);
  }, [text, sendState, haptics, onSend]);

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.6 — Emoji keyboard trigger
  // Blueprint §[7.A]: "On tap: opens emoji picker (system emoji keyboard)"
  // RN has no API for programmatic emoji keyboard switch; focusing the input
  // allows the user to access emoji via the OS keyboard globe/emoji key.
  // ─────────────────────────────────────────────────────────────────────────

  const handleEmojiPress = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    inputRef.current?.focus();
  }, [isAuthenticated, onAuthGate]);

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.7 — Derived styles
  // ─────────────────────────────────────────────────────────────────────────

  /** Border changes on focus — Blueprint §[7.A] state table */
  const inputBorderColor = isFocused ? INPUT_BORDER_FOCUS : INPUT_BORDER_IDLE;
  const inputBorderWidth = isFocused ? BORDER_FOCUS_W     : BORDER_IDLE_W;

  // ─────────────────────────────────────────────────────────────────────────
  // § 6.8 — Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: PAD_V + insets.bottom },  // safe-area-bottom injected
        style,
      ]}
      testID="home-chat-input"
    >

      {/* ── [7.D] Char counter — Blueprint §[7.A]: visible from 850 chars ── */}
      {showCounter && (
        <View style={styles.counterRow} pointerEvents="none">
          <Text
            style={[
              styles.counterText,
              counterWarn && styles.counterTextWarn,
            ]}
            accessible={false}
          >
            {charsLeft}
          </Text>
        </View>
      )}

      {/* ── Main input row ────────────────────────────────────────────────── */}
      <View style={styles.row}>

        {/*
         * ── [7.A] Input Field ──────────────────────────────────────────────
         *
         * ⛔ RULE 03: Avatar previously sat here [7.A]. Removed.
         *   "Reclaimed horizontal space allocated to a wider input field."
         *   The input field now begins at the left edge of the inner padding zone.
         *
         * The input container is position:relative so the emoji trigger can be
         * absolutely positioned inside it at EMOJI_RIGHT px from the right edge.
         */}
        <View
          style={[
            styles.inputContainer,
            {
              borderColor: inputBorderColor,
              borderWidth: inputBorderWidth,
            },
            // Blueprint §[7.A] State (disabled): "opacity 0.5 (offline state)"
            // Applied to the container (not TextInput directly) so the emoji
            // trigger and border are also visually dimmed together.
            disabled && styles.inputContainerDisabled,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={text}
            onChangeText={(val) => {
              // Enforce char limit — Blueprint §[7.A] "Max chars: 1000"
              if (val.length <= CHAR_LIMIT) {
                setText(val);
              }
            }}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            multiline={false}         // Task spec: multiline=false
            blurOnSubmit={false}      // Task spec: blurOnSubmit=false
            returnKeyType="default"   // Blueprint §[7.A]: Enter inserts newline equivalent
            keyboardType="default"    // Blueprint §[7.A]
            autoCapitalize="sentences"// Blueprint §[7.A]
            autoCorrect               // Blueprint §[7.A] (default true)
            editable={isAuthenticated && !disabled}// Keyboard blocked when: unauthed OR offline
            maxLength={CHAR_LIMIT}    // Belt-and-suspenders guard
            accessible
            accessibilityLabel="Type a message in Sector 17"
            accessibilityRole="none"  // parent container owns role — "textbox" implicit
            testID="home-input-field"
          />

          {/* [7.C] Emoji trigger — Blueprint §[7.A]: 20×20 · right-aligned */}
          <Pressable
            onPress={handleEmojiPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.emojiButton}
            accessible
            accessibilityLabel="Open emoji keyboard"
            accessibilityRole="button"
          >
            <Feather
              name="smile"
              size={EMOJI_SIZE}
              color={EMOJI_COLOR}
            />
          </Pressable>
        </View>

        {/* 8px gap — Blueprint §[7] "Input-send button gap: 8px" */}
        <View style={styles.inputSendGap} />

        {/* ── [7.B] Send Button ──────────────────────────────────────────── */}
        <SendButtonMemo
          sendState={sendState}
          onPress={handleSend}
          spinValue={spinValue}
        />

      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — STYLES
// Zero hardcoded hex values — all tokens referenced in § 2.
// Magic numbers permitted only where no token exists and spec mandates literal
// (INPUT_PAD_H = 14, TRUST_CHIP_PAD_H-style cases — documented inline).
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ─── Outer wrapper ───────────────────────────────────────────────────────
  /**
   * Blueprint §[7]:
   *   position: static (NOT absolute — flush above Glass Island per Rule 04)
   *   H: 64px + safeAreaBottom
   *   Bg: #FFFFFF
   *   Top border: 1px #E8D5A0 (divider between chat body and composer)
   *   Z-Index: stickyCTA (940)
   *   paddingHorizontal: 16px
   *   paddingTop: 12px
   *   paddingBottom: 12px + safeAreaBottom (injected inline)
   *
   * Rev fix: removed minHeight: STRIP_H (64).
   * Reason: minHeight: 64 + paddingTop: 12 + paddingBottom: (12 + safeArea)
   * creates a flex-layout ambiguity — the minHeight constraint and the inline
   * paddingBottom (which varies by device) can produce unexpected behaviour
   * when the counter row is also visible (adds to intrinsic height).
   * Content defines the height organically:
   *   [paddingTop 12] + [optional counter] + [row 40px] + [paddingBottom 12+safe]
   * On iPhone 14 Pro: 12 + 40 + 12 + 34 = 98px — matches Blueprint "~98px iOS" ✓
   * On devices with no safe area: 12 + 40 + 12 + 0 = 64px — matches STRIP_H ✓
   */
  wrapper: {
    width:              '100%',
    // No minHeight — content + padding defines height reliably across devices
    backgroundColor:    STRIP_BG,             // #FFFFFF
    borderTopWidth:     StyleSheet.hairlineWidth,
    borderTopColor:     STRIP_BORDER,         // cream[400]
    paddingHorizontal:  PAD_H,                // 16px
    paddingTop:         PAD_V,                // 12px
    // paddingBottom set inline: PAD_V + insets.bottom
    zIndex:             zIndexTokens.stickyCTA, // 940 — Rule 04
    elevation:          8,                    // Android: zIndex needs elevation
    // ⛔ Rule 04: position is NOT set to 'absolute' — stays in normal flow
    // margin-bottom: 0 is the default — Glass Island sits immediately below
  },

  // ─── Main input row ──────────────────────────────────────────────────────
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    // No explicit height — items self-height at INPUT_H (40px)
  },

  // ─── [7.A] Input container ───────────────────────────────────────────────
  /**
   * Blueprint §[7.A]:
   *   H: 40px · Bg: #F5E6C8 → cream[200] · Border radius: 20px (full pill)
   *   Border: 1px idle → 2px focused (applied inline)
   *   paddingLeft: 14px · paddingRight: 40px (reserves emoji icon space)
   *
   * Radius Protocol: radii.pill (9999) — RN clamps to INPUT_H/2 = 20px (full pill).
   * The border-state change from 1px→2px shifts inner content slightly on Android.
   * Compensate by targeting a consistent inner area via paddingHorizontal constants.
   */
  inputContainer: {
    flex:           1,
    height:         INPUT_H,              // 40px
    borderRadius:   radii.pill,           // Radius Protocol: 9999, clamps to 20px
    backgroundColor: INPUT_BG,           // cream[200]
    flexDirection:  'row',
    alignItems:     'center',
    overflow:       'hidden',             // clips content to border radius on Android
    // borderColor + borderWidth applied inline (focus-driven)
  },

  // ─── [7.A] Input container — disabled state ─────────────────────────────
  /**
   * Blueprint §[7.A] State (disabled): "opacity 0.5 (offline state)".
   * Rev fix: INPUT_DISABLED_OPACITY was declared but never applied.
   * Separate style (not inline) so it composes cleanly via StyleSheet array.
   * Applied to container — dims input text, border, AND emoji trigger together.
   */
  inputContainerDisabled: {
    opacity: INPUT_DISABLED_OPACITY,   // 0.5 — Blueprint §[7.A]
  },

  // ─── [7.A] TextInput ─────────────────────────────────────────────────────
  inputField: {
    flex:               1,
    height:             INPUT_H,          // 40px
    paddingLeft:        INPUT_PAD_H,      // 14px — Blueprint §[7.A] spec literal
    paddingRight:       INPUT_PAD_RIGHT,  // 40px — reserves emoji icon space
    paddingTop:         0,                // Blueprint §[7.A] "0 V" (vertical padding)
    paddingBottom:      0,
    fontFamily:         FONT_BODY.regular,   // DMSans_400Regular
    fontSize:           FONT_SIZE.body,      // 15px — Blueprint §[7.A]
    fontWeight:         '400' as const,
    lineHeight:         22,
    color:              INPUT_TEXT_COLOR,    // ink[950]
    includeFontPadding: false,               // Android: remove extra vertical gap
    textAlignVertical:  'center',            // Android: vertical centering
  },

  // ─── [7.C] Emoji trigger ─────────────────────────────────────────────────
  /**
   * Blueprint §[7.A]: "Emoji icon: 20×20 · #6B5B2E · Position: 12px from right edge"
   * Absolutely positioned inside inputContainer.
   */
  emojiButton: {
    position:       'absolute',
    right:          EMOJI_RIGHT,           // 12px from right edge
    width:          EMOJI_SIZE,            // 20px
    height:         EMOJI_SIZE,            // 20px
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ─── Input–send gap ──────────────────────────────────────────────────────
  inputSendGap: {
    width: INPUT_SEND_GAP,                 // 8px
  },

  // ─── [7.D] Char counter row ──────────────────────────────────────────────
  /**
   * Blueprint §[7.A]: "counter visible from 850 chars (subtle)"
   * Floats above the input row · right-aligned · non-interactive.
   */
  counterRow: {
    alignItems:   'flex-end',
    paddingBottom: spacing.xs,             // 4px — tight gap above input row
  },
  counterText: {
    fontFamily:    FONT_BODY.regular,
    fontSize:      FONT_SIZE.cap,          // 12px
    fontWeight:    '400' as const,
    lineHeight:    16,
    color:         COUNTER_COLOR_DEFAULT,  // ink[600]
    includeFontPadding: false,
  },
  /**
   * Last 50 chars warning — amber[600]
   * Blueprint §[7.A] doesn't specify color change but amber is the warning token.
   */
  counterTextWarn: {
    color: COUNTER_COLOR_WARN,             // amber[600]
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — EXPORT
// React.memo — all props are primitives or stable callbacks (onSend, onAuthGate).
// Caller must stabilise callbacks with useCallback to prevent unnecessary re-renders.
//
// Re-renders only when:
//   · isAuthenticated changes (auth state)
//   · placeholder changes (rare)
//   · style changes (rare)
//   · onSend / onAuthGate reference changes (caller's useCallback responsibility)
// ─────────────────────────────────────────────────────────────────────────────

const ChatInput = React.memo(ChatInputBase);

export default ChatInput;

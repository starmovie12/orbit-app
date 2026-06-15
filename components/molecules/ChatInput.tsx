/**
 * CROWN — Chat Composer (molecule)  ·  components/molecules/ChatInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sticky bottom composer. PRD v3.2 §9.3.5 — Gap-Fill Trick.
 *   navVisible=true  → bottom = 56 + insets.bottom
 *   navVisible=false → bottom = insets.bottom   (fills the vacated nav space)
 *   Both animate in 200ms lockstep with the nav.
 *
 * PREMIUM PASS (WhatsApp-clean / Telegram-tight):
 *   • Emoji moved BACK INSIDE the pill (right-aligned) — was floating
 *     outside, which looked unbalanced.
 *   • Pill: soft cream fill, hairline idle border → 1.5px gold on focus
 *     (was a heavy 2px). Calmer, more premium.
 *   • Send button: refined gold circle, tasteful lift shadow (was a harsh
 *     0.45-opacity glow).
 *   • "+" attach now sits in its own soft tap circle.
 *   • All fonts via FONT_BODY (the loaded Inter family).
 *
 * Public API, state machine, gap-fill animation, auth gate, char counter,
 * scope-aware placeholder — all unchanged. Drop-in replacement.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHaptics } from '@/hooks/useHaptics';
import { animation, colors, dimensions, palette, radii, spacing } from '@/constants/colors';
import { FONT_BODY, FONT_SIZE } from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_H = dimensions.inputLg; // 64
const PAD_V = spacing.md; // 12
const PAD_H = spacing.base; // 16
const INPUT_H = 44 as const; // taller pill — premium breathing room
const SEND_SIZE = dimensions.btnSendSize; // 40
const SEND_ICON_SIZE = dimensions.btnSendInner; // 20

const INPUT_PAD_LEFT = 16 as const;
const EMOJI_SIZE = 20 as const;
const EMOJI_RIGHT = 12 as const;
/** reserve room inside the pill for the emoji icon */
const INPUT_PAD_RIGHT = EMOJI_RIGHT + EMOJI_SIZE + 8; // 40

const BORDER_IDLE_W = 1 as const;
const BORDER_FOCUS_W = 1.5 as const;

const INPUT_DISABLED_OPACITY = 0.5 as const;
const CHAR_LIMIT = 1_000 as const;
const COUNTER_THRESHOLD = 850 as const;
const FAILED_RESET_MS = 3_000 as const;
const SENDING_IDLE_RESET_MS = 300 as const;

const BOTTOM_NAV_HEIGHT = 56 as const;
const Z_CHAT_INPUT = 935 as const;
const NAV_ANIM_DURATION_MS = 200 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLORS (semantic tokens only)
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_BG = colors.bg.surface;
const STRIP_BORDER = colors.border.default;
const INPUT_BG = palette.cream[100]; // soft warm fill
const INPUT_BORDER_IDLE = colors.border.inputIdle;
const INPUT_BORDER_FOCUS = colors.border.inputFocus;
const INPUT_TEXT_COLOR = colors.fg.primary;
const INPUT_PLACEHOLDER_COLOR = colors.fg.placeholder;
const EMOJI_COLOR = colors.fg.secondary;
const PLUS_ICON_COLOR = colors.fg.secondary;
const SEND_BG = colors.fg.brand;
const SEND_ICON_COLOR = palette.white;
const SEND_BG_FAILED = colors.fg.error;
const COUNTER_COLOR_DEFAULT = colors.fg.secondary;
const COUNTER_COLOR_WARN = colors.fg.warning;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SendState = 'idle' | 'active' | 'sending' | 'failed';
type Scope = 'world' | 'country' | 'city' | 'sector';

export interface ChatInputProps {
  onSend: (text: string) => void;
  onVoice?: () => void;
  onImage?: () => void;
  onAuthGate?: () => void;
  isAuthenticated: boolean;
  navVisible?: boolean;
  scope?: Scope;
  cityLabel?: string;
  sectorLabel?: string;
  /** @deprecated prefer scope-aware props */
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function resolvePlaceholder(
  scope: Scope,
  cityLabel: string,
  sectorLabel: string,
  override?: string,
): string {
  if (override !== undefined) return override;
  switch (scope) {
    case 'world':
      return 'World ki chat mein message likho...';
    case 'country':
      return 'India ki chat mein message likho...';
    case 'city':
      return `${cityLabel} ki chat mein message likho...`;
    case 'sector':
      return `${sectorLabel} mein message likho...`;
  }
}

function resolveA11yLabel(scope: Scope, cityLabel: string, sectorLabel: string): string {
  switch (scope) {
    case 'world':
      return 'Type a message in World chat';
    case 'country':
      return 'Type a message in India chat';
    case 'city':
      return `Type a message in ${cityLabel} chat`;
    case 'sector':
      return `Type a message in ${sectorLabel}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — SendButton
// ─────────────────────────────────────────────────────────────────────────────

interface SendButtonProps {
  sendState: SendState;
  onPress: () => void;
  spinValue: Animated.Value;
}

const SendButtonBase: React.FC<SendButtonProps> = ({ sendState, onPress, spinValue }) => {
  const btnScale = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(false);
  const isActiveNow = sendState === 'active';

  useEffect(() => {
    if (isActiveNow && !wasActive.current) {
      btnScale.setValue(0.9);
      Animated.spring(btnScale, {
        toValue: 1,
        stiffness: animation.easing.springGentle.stiffness,
        damping: animation.easing.springGentle.damping,
        useNativeDriver: true,
      }).start();
    }
    wasActive.current = isActiveNow;
  }, [isActiveNow, btnScale]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const isDisabled = sendState === 'idle' || sendState === 'sending' || sendState === 'failed';
  const bgColor = sendState === 'failed' ? SEND_BG_FAILED : SEND_BG;

  const renderIcon = (): React.ReactNode => {
    if (sendState === 'sending') {
      return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Feather name="loader" size={SEND_ICON_SIZE - 4} color={SEND_ICON_COLOR} />
        </Animated.View>
      );
    }
    if (sendState === 'failed') {
      return <Feather name="alert-triangle" size={SEND_ICON_SIZE} color={SEND_ICON_COLOR} />;
    }
    return <Feather name="arrow-up" size={SEND_ICON_SIZE} color={SEND_ICON_COLOR} />;
  };

  const accessibilityLabel =
    sendState === 'active' || sendState === 'sending'
      ? 'Send message'
      : 'Send button. Type a message first.';

  return (
    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        testID="home-send-button"
        style={({ pressed }) => [
          sendButtonStyles.button,
          { backgroundColor: bgColor },
          sendState === 'idle' && sendButtonStyles.idle,
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
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Tasteful lift — not a harsh glow
    shadowColor: colors.fg.brand,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  idle: {
    // Slightly calmer when there's nothing to send
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.85,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ChatInputBase: React.FC<ChatInputProps> = ({
  onSend,
  onVoice: _onVoice,
  onImage: _onImage,
  onAuthGate,
  isAuthenticated,
  navVisible = true,
  scope = 'sector',
  cityLabel = '',
  sectorLabel = 'Sector 17',
  disabled = false,
  placeholder,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  const [text, setText] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [sendState, setSendState] = useState<SendState>('idle');

  const inputRef = useRef<TextInput>(null);
  const failedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Gap-fill animation (§9.3.5) ────────────────────────────────────────────
  const bottomAnim = useRef(new Animated.Value(BOTTOM_NAV_HEIGHT)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    const targetBottom = navVisible ? BOTTOM_NAV_HEIGHT + insets.bottom : insets.bottom;
    if (isFirstRender.current) {
      bottomAnim.setValue(targetBottom);
      isFirstRender.current = false;
      return;
    }
    Animated.timing(bottomAnim, {
      toValue: targetBottom,
      duration: NAV_ANIM_DURATION_MS,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
  }, [navVisible, insets.bottom, bottomAnim]);

  // ── Spinner ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sendState === 'sending') {
      spinValue.setValue(0);
      spinLoop.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1_000,
          easing: Easing.linear,
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

  useEffect(() => {
    return () => {
      spinLoop.current?.stop();
      if (failedTimerRef.current) clearTimeout(failedTimerRef.current);
      if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current);
    };
  }, []);

  // ── Derive idle/active from text ───────────────────────────────────────────
  const hasText = text.trim().length > 0;
  useEffect(() => {
    if (sendState === 'sending' || sendState === 'failed') return;
    setSendState(hasText ? 'active' : 'idle');
  }, [hasText, sendState]);

  // ── Char counter ───────────────────────────────────────────────────────────
  const charsLeft = CHAR_LIMIT - text.length;
  const showCounter = text.length >= COUNTER_THRESHOLD;
  const counterWarn = charsLeft <= 50;

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const handleInputFocus = useCallback((): void => {
    if (!isAuthenticated) {
      inputRef.current?.blur();
      onAuthGate?.();
      return;
    }
    setIsFocused(true);
    haptics.impactLight();
  }, [isAuthenticated, onAuthGate, haptics]);

  const handleInputBlur = useCallback((): void => setIsFocused(false), []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback((): void => {
    const trimmed = text.trim();
    if (!trimmed || sendState !== 'active') return;
    haptics.impactLight();
    setText('');
    setSendState('sending');
    onSend(trimmed);
    sendingTimerRef.current = setTimeout(() => {
      setSendState(text.trim().length > 0 ? 'active' : 'idle');
    }, SENDING_IDLE_RESET_MS);
  }, [text, sendState, haptics, onSend]);

  const handleEmojiPress = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    inputRef.current?.focus();
  }, [isAuthenticated, onAuthGate]);

  const handlePlusPress = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    _onImage?.();
  }, [isAuthenticated, onAuthGate, _onImage]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const inputBorderColor = isFocused ? INPUT_BORDER_FOCUS : INPUT_BORDER_IDLE;
  const inputBorderWidth = isFocused ? BORDER_FOCUS_W : BORDER_IDLE_W;
  const effectivePlaceholder = resolvePlaceholder(scope, cityLabel, sectorLabel, placeholder);
  const effectiveA11yLabel = resolveA11yLabel(scope, cityLabel, sectorLabel);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[styles.wrapper, { bottom: bottomAnim, paddingBottom: PAD_V }, style]}
      testID="home-chat-input"
    >
      {showCounter && (
        <View style={styles.counterRow} pointerEvents="none">
          <Text
            style={[styles.counterText, counterWarn && styles.counterTextWarn]}
            accessible={false}
          >
            {charsLeft}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        {/* + attach (soft tap circle) */}
        <Pressable
          onPress={handlePlusPress}
          style={({ pressed }) => [styles.plusButton, pressed && styles.plusPressed]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessible
          accessibilityLabel="Add attachment"
          accessibilityRole="button"
        >
          <Feather name="plus" size={22} color={PLUS_ICON_COLOR} />
        </Pressable>

        {/* Input pill — emoji lives INSIDE, right-aligned */}
        <View
          style={[
            styles.inputContainer,
            { borderColor: inputBorderColor, borderWidth: inputBorderWidth },
            disabled && styles.inputContainerDisabled,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={text}
            onChangeText={(val) => {
              if (val.length <= CHAR_LIMIT) setText(val);
            }}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={effectivePlaceholder}
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            multiline={false}
            blurOnSubmit={false}
            returnKeyType="default"
            keyboardType="default"
            autoCapitalize="sentences"
            autoCorrect
            editable={isAuthenticated && !disabled}
            maxLength={CHAR_LIMIT}
            accessible
            accessibilityLabel={effectiveA11yLabel}
            accessibilityRole="none"
            testID="home-input-field"
          />

          <Pressable
            onPress={handleEmojiPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.emojiButton}
            accessible
            accessibilityLabel="Open emoji keyboard"
            accessibilityRole="button"
          >
            <Feather name="smile" size={EMOJI_SIZE} color={EMOJI_COLOR} />
          </Pressable>
        </View>

        {/* Send */}
        <SendButtonMemo sendState={sendState} onPress={handleSend} spinValue={spinValue} />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: STRIP_H,
    backgroundColor: STRIP_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: STRIP_BORDER,
    paddingHorizontal: PAD_H,
    paddingTop: PAD_V,
    zIndex: Z_CHAT_INPUT,
    elevation: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ── Input pill ─────────────────────────────────────────────────────────────
  inputContainer: {
    flex: 1,
    height: INPUT_H,
    borderRadius: radii.pill,
    backgroundColor: INPUT_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: INPUT_PAD_LEFT,
    paddingRight: EMOJI_RIGHT,
    overflow: 'hidden',
  },
  inputContainerDisabled: {
    opacity: INPUT_DISABLED_OPACITY,
  },
  inputField: {
    flex: 1,
    height: INPUT_H,
    paddingVertical: 0,
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.mdLg, // 15
    lineHeight: 20,
    color: INPUT_TEXT_COLOR,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  emojiButton: {
    width: EMOJI_SIZE + 8,
    height: INPUT_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  // ── + attach ───────────────────────────────────────────────────────────────
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusPressed: {
    backgroundColor: colors.bg.goldSoft,
  },

  // ── Char counter ───────────────────────────────────────────────────────────
  counterRow: {
    alignItems: 'flex-end',
    paddingBottom: spacing.xs,
  },
  counterText: {
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.cap, // 12
    lineHeight: 16,
    color: COUNTER_COLOR_DEFAULT,
    includeFontPadding: false,
  },
  counterTextWarn: {
    color: COUNTER_COLOR_WARN,
  },
});

const ChatInput = React.memo(ChatInputBase);

export default ChatInput;

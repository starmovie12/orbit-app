/**
 * CROWN — Chat Composer (molecule)  ·  components/molecules/ChatInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * WhatsApp / Telegram-style FLOATING composer.
 *
 *   • One floating rounded box — holds EVERYTHING: [+] · text · 😊 · send.
 *   • No white bar behind it (transparent strip → it floats over the chat).
 *   • Auto-grows from 1 line up to ~5 lines, then scrolls inside (multiline).
 *   • NO character limit (send any length — like WhatsApp).
 *   • No black focus box on web (browser outline killed).
 *   • Gap-fill (§9.3.5) now uses translateY on the UI thread → smooth, no
 *     scroll glitch (was animating `bottom`, which thrashes layout).
 *
 * Public API unchanged — drop-in replacement.
 *   navVisible=true  → box sits above the nav
 *   navVisible=false → box slides down 56px to fill the vacated nav space
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHaptics } from '@/hooks/useHaptics';
import { animation, colors, palette, radii } from '@/constants/colors';
import { FONT_BODY, FONT_SIZE } from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

const NAV_HEIGHT = 56 as const;
const Z_CHAT_INPUT = 935 as const;
const NAV_ANIM_DURATION_MS = 200 as const;

/** Floating box outer side margin (so it doesn't touch screen edges) */
const SIDE_MARGIN = 12 as const;
/** Gap above the nav bar */
const BOTTOM_GAP = 6 as const;

/** Input min height (single line — aligns with the 36px control buttons) */
const MIN_INPUT_H = 36 as const;
/** Input max height (~5 lines) before it scrolls internally */
const MAX_INPUT_H = 120 as const;

const SEND_SIZE = 40 as const;
const SEND_ICON_SIZE = 20 as const;
const CTRL_SIZE = 36 as const;
const EMOJI_ICON = 22 as const;
const PLUS_ICON = 24 as const;

const SENDING_IDLE_RESET_MS = 300 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLORS (semantic tokens)
// ─────────────────────────────────────────────────────────────────────────────

const BOX_BG = palette.cream[100]; // soft warm fill
const BOX_BORDER_IDLE = colors.border.inputIdle; // cream[400]
const BOX_BORDER_FOCUS = colors.fg.brand; // gold
const INPUT_TEXT_COLOR = colors.fg.primary;
const INPUT_PLACEHOLDER_COLOR = colors.fg.placeholder;
const ICON_COLOR = colors.fg.secondary;
const SEND_BG = colors.fg.brand;
const SEND_BG_FAILED = colors.fg.error;
const SEND_ICON_COLOR = palette.white;

/** Kills the black focus outline on react-native-web */
const WEB_NO_OUTLINE =
  Platform.OS === 'web'
    ? ({ outlineWidth: 0, outlineColor: 'transparent', outlineStyle: 'none' } as unknown as ViewStyle)
    : null;

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
  /** Accepted for API symmetry — navVisible drives the animation. */
  navHidden?: boolean;
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
  if (override !== undefined && override !== '') return override;
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
      btnScale.setValue(0.85);
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

  return (
    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessible
        accessibilityLabel="Send message"
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
  },
  idle: { opacity: 0.9 },
  pressed: { opacity: 0.82 },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ChatInputBase: React.FC<ChatInputProps> = ({
  onSend,
  onVoice: _onVoice,
  onImage,
  onAuthGate,
  isAuthenticated,
  navVisible = true,
  navHidden,
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
  const [inputHeight, setInputHeight] = useState<number>(MIN_INPUT_H);

  const inputRef = useRef<TextInput>(null);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Gap-fill via translateY (UI thread → smooth) ───────────────────────────
  // 0 = nav visible (box above nav), 1 = nav hidden (box slid down to fill).
  const isHidden = navHidden !== undefined ? navHidden : !navVisible;
  const slide = useRef(new Animated.Value(isHidden ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: isHidden ? 1 : 0,
      duration: NAV_ANIM_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isHidden, slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, NAV_HEIGHT],
    extrapolate: 'clamp',
  });

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
      if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current);
    };
  }, []);

  // ── idle ↔ active from text ────────────────────────────────────────────────
  const hasText = text.trim().length > 0;
  useEffect(() => {
    if (sendState === 'sending' || sendState === 'failed') return;
    setSendState(hasText ? 'active' : 'idle');
  }, [hasText, sendState]);

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
    setInputHeight(MIN_INPUT_H);
    setSendState('sending');
    onSend(trimmed);
    sendingTimerRef.current = setTimeout(() => {
      setSendState('idle');
    }, SENDING_IDLE_RESET_MS);
  }, [text, sendState, haptics, onSend]);

  // ── Emoji → focus (opens keyboard emoji) ───────────────────────────────────
  const handleEmojiPress = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    haptics.impactLight();
    inputRef.current?.focus();
  }, [isAuthenticated, onAuthGate, haptics]);

  // ── Plus → attachment (or focus if no handler wired) ───────────────────────
  const handlePlusPress = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    haptics.impactLight();
    if (onImage) onImage();
    else inputRef.current?.focus();
  }, [isAuthenticated, onAuthGate, onImage, haptics]);

  // ── Auto-grow height ───────────────────────────────────────────────────────
  const handleContentSize = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }): void => {
      const h = Math.min(
        Math.max(MIN_INPUT_H, Math.ceil(e.nativeEvent.contentSize.height)),
        MAX_INPUT_H,
      );
      setInputHeight(h);
    },
    [],
  );

  const boxBorderColor = isFocused ? BOX_BORDER_FOCUS : BOX_BORDER_IDLE;
  const effectivePlaceholder = resolvePlaceholder(scope, cityLabel, sectorLabel, placeholder);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: NAV_HEIGHT + insets.bottom,
          paddingBottom: BOTTOM_GAP,
          transform: [{ translateY }],
        },
        style,
      ]}
      pointerEvents="box-none"
      testID="home-chat-input"
    >
      <View
        style={[styles.box, { borderColor: boxBorderColor }, disabled && styles.boxDisabled]}
      >
        {/* + attach (inside, left) */}
        <Pressable
          onPress={handlePlusPress}
          style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessible
          accessibilityLabel="Add attachment"
          accessibilityRole="button"
        >
          <Feather name="plus" size={PLUS_ICON} color={ICON_COLOR} />
        </Pressable>

        {/* Text — auto-grows, no limit */}
        <TextInput
          ref={inputRef}
          style={[styles.input, { height: inputHeight }, WEB_NO_OUTLINE]}
          value={text}
          onChangeText={setText}
          onContentSizeChange={handleContentSize}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={effectivePlaceholder}
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          multiline
          scrollEnabled
          blurOnSubmit={false}
          returnKeyType="default"
          keyboardType="default"
          autoCapitalize="sentences"
          autoCorrect
          editable={isAuthenticated && !disabled}
          accessible
          accessibilityLabel={effectivePlaceholder}
          testID="home-input-field"
        />

        {/* Emoji (inside, before send) */}
        <Pressable
          onPress={handleEmojiPress}
          style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessible
          accessibilityLabel="Open emoji keyboard"
          accessibilityRole="button"
        >
          <Feather name="smile" size={EMOJI_ICON} color={ICON_COLOR} />
        </Pressable>

        {/* Send (inside, right) */}
        <SendButtonMemo sendState={sendState} onPress={handleSend} spinValue={spinValue} />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Transparent strip — the box floats over the chat
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: SIDE_MARGIN,
    backgroundColor: 'transparent',
    zIndex: Z_CHAT_INPUT,
    elevation: 8,
  },

  // The single floating rounded box holding everything
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end', // controls pin to bottom as text grows
    backgroundColor: BOX_BG,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    // Floating lift
    shadowColor: palette.ink[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  boxDisabled: {
    opacity: 0.55,
  },

  input: {
    flex: 1,
    fontFamily: FONT_BODY.regular,
    fontSize: FONT_SIZE.mdLg, // 15
    lineHeight: 20,
    color: INPUT_TEXT_COLOR,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    margin: 0,
    textAlignVertical: 'top',
    includeFontPadding: false,
    maxHeight: MAX_INPUT_H,
  },

  ctrlBtn: {
    width: CTRL_SIZE,
    height: CTRL_SIZE,
    borderRadius: CTRL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlPressed: {
    backgroundColor: colors.bg.goldSoft,
  },
});

const ChatInput = React.memo(ChatInputBase);

export default ChatInput;

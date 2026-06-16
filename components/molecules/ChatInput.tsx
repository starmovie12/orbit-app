/**
 * CROWN — Chat Composer (molecule)  ·  components/molecules/ChatInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * WhatsApp / Telegram-style FLOATING composer.
 *
 *   • One floating rounded box — holds EVERYTHING: [+] · text · 😊 · send.
 *   • No white bar behind it (transparent strip → it floats over the chat).
 *   • Auto-grows 1→5 lines AND shrinks back when you delete text.
 *       - Web ratchet fixed: the <textarea> height is reset to "auto" before
 *         measuring scrollHeight, so it grows AND shrinks correctly.
 *       - Native auto-grows via onContentSizeChange.
 *   • NO character limit (send any length — like WhatsApp).
 *   • No black focus box on web (browser outline killed).
 *   • EMOJI button → opens a working emoji picker that inserts into the text.
 *   • PLUS button  → opens the device image picker (and forwards via onImage).
 *   • Gap-fill (§9.3.5) uses translateY on the UI thread → smooth, no glitch.
 *
 * Public API unchanged (onImage may now receive the picked uri). Drop-in.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { useHaptics } from '@/hooks/useHaptics';
import { hideNav, showNav } from '@/components/organisms/CrownBottomNav';
import { animation, colors, palette, radii } from '@/constants/colors';
import { FONT_BODY, FONT_SIZE } from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

const NAV_HEIGHT = 56 as const;
const Z_CHAT_INPUT = 935 as const;
const NAV_ANIM_DURATION_MS = 200 as const;

const SIDE_MARGIN = 12 as const;
const BOTTOM_GAP = 6 as const;

const MIN_INPUT_H = 36 as const;
const MAX_INPUT_H = 120 as const;

const SEND_SIZE = 40 as const;
const SEND_ICON_SIZE = 20 as const;
const CTRL_SIZE = 36 as const;
const EMOJI_ICON = 22 as const;
const PLUS_ICON = 24 as const;

const SENDING_IDLE_RESET_MS = 300 as const;
const EMOJI_PANEL_MAX_H = 216 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLORS
// ─────────────────────────────────────────────────────────────────────────────

const BOX_BG = palette.cream[100];
const BOX_BORDER_IDLE = colors.border.inputIdle;
const BOX_BORDER_FOCUS = colors.fg.brand;
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
// § 3 — EMOJI SET (common — inserts into text)
// ─────────────────────────────────────────────────────────────────────────────

const EMOJIS: readonly string[] = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😋', '😎', '🤩', '🥳', '😏', '😢', '😭',
  '😤', '😠', '😡', '🤬', '🤯', '😱', '😴', '🤤',
  '👍', '👎', '👌', '🙏', '👏', '🙌', '💪', '🔥',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '💎', '✨',
  '🎉', '🎊', '👑', '⭐', '💯', '✅', '❌', '👀',
];

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SendState = 'idle' | 'active' | 'sending' | 'failed';
type Scope = 'world' | 'country' | 'city' | 'sector';

export interface ChatInputProps {
  onSend: (text: string) => void;
  onVoice?: () => void;
  /** Receives the picked image uri (if any). */
  onImage?: (uri?: string) => void;
  onAuthGate?: () => void;
  isAuthenticated: boolean;
  navVisible?: boolean;
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
// § 5 — HELPERS
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
      return 'Message the world…';
    case 'country':
      return 'Message your country…';
    case 'city':
      return `Message ${cityLabel}…`;
    case 'sector':
      return `Message ${sectorLabel}…`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — SendButton
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
// § 7 — Emoji Picker Panel
// ─────────────────────────────────────────────────────────────────────────────

interface EmojiPanelProps {
  onPick: (emoji: string) => void;
}

const EmojiPanel: React.FC<EmojiPanelProps> = ({ onPick }) => (
  <View style={styles.emojiPanel}>
    <ScrollView
      style={{ maxHeight: EMOJI_PANEL_MAX_H }}
      contentContainerStyle={styles.emojiGrid}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      {EMOJIS.map((e) => (
        <Pressable
          key={e}
          onPress={() => onPick(e)}
          style={({ pressed }) => [styles.emojiCell, pressed && styles.emojiCellPressed]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Insert ${e}`}
        >
          <Text style={styles.emojiGlyph} allowFontScaling={false}>
            {e}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — MAIN COMPONENT
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
  const [showEmoji, setShowEmoji] = useState<boolean>(false);

  const inputRef = useRef<TextInput>(null);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Gap-fill via translateY ─────────────────────────────────────────────────
  const isHiddenProp = navHidden !== undefined ? navHidden : !navVisible;
  // On web, focusing the input opens the keyboard → hide the nav + drop the box.
  const isHidden = isHiddenProp || (Platform.OS === 'web' && isFocused);
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

  // ── Spinner ──────────────────────────────────────────────────────────────────
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

  // ── idle ↔ active ─────────────────────────────────────────────────────────────
  const hasText = text.trim().length > 0;
  useEffect(() => {
    if (sendState === 'sending' || sendState === 'failed') return;
    setSendState(hasText ? 'active' : 'idle');
  }, [hasText, sendState]);

  // ── AUTO-GROW + SHRINK ────────────────────────────────────────────────────────
  // Web: reset textarea height to "auto" before reading scrollHeight, so the box
  //      both grows and shrinks (fixes the stuck-tall ratchet bug).
  const measureWeb = useCallback((): void => {
    if (Platform.OS !== 'web') return;
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!el) return;
    el.rows = 1;                       // neutralize browser's default 2-row textarea
    el.style.height = 'auto';
    const next = Math.max(MIN_INPUT_H, Math.min(el.scrollHeight, MAX_INPUT_H));
    el.style.height = `${next}px`;
    setInputHeight(next);
  }, []);

  // Web: size the empty textarea to exactly one line on mount.
  useEffect(() => {
    if (Platform.OS === 'web') requestAnimationFrame(measureWeb);
  }, [measureWeb]);

  const resetHeight = useCallback((): void => {
    setInputHeight(MIN_INPUT_H);
    if (Platform.OS === 'web') {
      const el = inputRef.current as unknown as HTMLTextAreaElement | null;
      if (el) el.style.height = `${MIN_INPUT_H}px`;
    }
  }, []);

  const handleChangeText = useCallback(
    (t: string): void => {
      setText(t);
      if (Platform.OS === 'web') requestAnimationFrame(measureWeb);
    },
    [measureWeb],
  );

  // Native only — web is handled by measureWeb (avoids the scrollHeight ratchet).
  const handleContentSize = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }): void => {
      if (Platform.OS === 'web') return;
      const h = Math.max(MIN_INPUT_H, Math.min(Math.ceil(e.nativeEvent.contentSize.height), MAX_INPUT_H));
      setInputHeight(h);
    },
    [],
  );

  // ── Auth + focus ──────────────────────────────────────────────────────────────
  const handleInputFocus = useCallback((): void => {
    if (!isAuthenticated) {
      inputRef.current?.blur();
      onAuthGate?.();
      return;
    }
    setShowEmoji(false);
    setIsFocused(true);
    haptics.impactLight();
    if (Platform.OS === 'web') {
      hideNav();                          // hide bottom nav while typing
      requestAnimationFrame(measureWeb);  // keep empty box at one line
    }
  }, [isAuthenticated, onAuthGate, haptics, measureWeb]);

  const handleInputBlur = useCallback((): void => {
    setIsFocused(false);
    if (Platform.OS === 'web') showNav();  // restore bottom nav
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = useCallback((): void => {
    const trimmed = text.trim();
    if (!trimmed || sendState !== 'active') return;
    haptics.impactLight();
    setText('');
    setShowEmoji(false);
    resetHeight();
    setSendState('sending');
    onSend(trimmed);
    sendingTimerRef.current = setTimeout(() => {
      setSendState('idle');
    }, SENDING_IDLE_RESET_MS);
  }, [text, sendState, haptics, onSend, resetHeight]);

  // ── Emoji ─────────────────────────────────────────────────────────────────────
  const handleEmojiToggle = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    haptics.impactLight();
    inputRef.current?.blur(); // close keyboard so the panel is visible on mobile
    setShowEmoji((v) => !v);
  }, [isAuthenticated, onAuthGate, haptics]);

  const handleEmojiPick = useCallback(
    (emoji: string): void => {
      haptics.impactLight();
      setText((prev) => prev + emoji);
      if (Platform.OS === 'web') requestAnimationFrame(measureWeb);
    },
    [haptics, measureWeb],
  );

  // ── Plus → image picker ─────────────────────────────────────────────────────
  const handlePlusPress = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    haptics.impactLight();
    setShowEmoji(false);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        onImage?.(result.assets[0].uri);
      }
    } catch {
      // Picker unavailable — fail silently.
    }
  }, [isAuthenticated, onAuthGate, onImage, haptics]);

  const boxBorderColor = isFocused ? BOX_BORDER_FOCUS : BOX_BORDER_IDLE;
  const effectivePlaceholder = resolvePlaceholder(scope, cityLabel, sectorLabel, placeholder);

  // ── Render ──────────────────────────────────────────────────────────────────
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
      {showEmoji ? <EmojiPanel onPick={handleEmojiPick} /> : null}

      <View style={[styles.box, { borderColor: boxBorderColor }, disabled && styles.boxDisabled]}>
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

        {/* Text — grows & shrinks, no limit */}
        <TextInput
          ref={inputRef}
          style={[styles.input, { height: inputHeight }, WEB_NO_OUTLINE]}
          value={text}
          onChangeText={handleChangeText}
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
          onPress={handleEmojiToggle}
          style={({ pressed }) => [
            styles.ctrlBtn,
            showEmoji && styles.ctrlActive,
            pressed && styles.ctrlPressed,
          ]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessible
          accessibilityLabel="Toggle emoji picker"
          accessibilityRole="button"
        >
          <Feather
            name={showEmoji ? 'x' : 'smile'}
            size={EMOJI_ICON}
            color={showEmoji ? colors.fg.brand : ICON_COLOR}
          />
        </Pressable>

        {/* Send (inside, right) */}
        <SendButtonMemo sendState={sendState} onPress={handleSend} spinValue={spinValue} />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: SIDE_MARGIN,
    backgroundColor: 'transparent',
    zIndex: Z_CHAT_INPUT,
    elevation: 8,
  },

  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: BOX_BG,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
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
    fontSize: FONT_SIZE.mdLg,
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
  ctrlActive: {
    backgroundColor: colors.bg.goldSoft,
  },
  ctrlPressed: {
    backgroundColor: colors.bg.goldSoft,
  },

  // Emoji panel (floats above the box)
  emojiPanel: {
    backgroundColor: BOX_BG,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BOX_BORDER_IDLE,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 8,
    shadowColor: palette.ink[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiCell: {
    width: '12.5%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiCellPressed: {
    backgroundColor: colors.bg.goldSoft,
  },
  emojiGlyph: {
    fontSize: 24,
    lineHeight: 30,
  },
});

const ChatInput = React.memo(ChatInputBase);

export default ChatInput;

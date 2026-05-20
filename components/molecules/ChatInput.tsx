/**
 * ChatInput — components/molecules/ChatInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN App · PRD v3.2 §9.3.5 — Coordinated Input Box Behavior (Gap-Fill Trick)
 * Blueprint v5.0 BAAP EDITION · Layer: molecule · Status: updated · P0
 *
 * Spec ref  : § Home Screen [7] STICKY INPUT AREA + §9.3.5 Gap-Fill Trick
 * Blueprint : H=64px (min) · Bg=colors.bg.surface · Z-Index=935
 *
 * Sub-elements
 * ────────────
 *  [7.A] Input Field   — pill · cream bg · animated border on focus · scope-aware placeholder
 *  [7.B] Send Button   — circular 40px · state machine: idle/active/sending/failed
 *  [7.C] Emoji Trigger — 20×20 inside input · right-aligned · opens emoji KB
 *  [7.D] Char Counter  — shows from 850 chars · fades in above input row
 *
 * §9.3.5 — THE GAP-FILL TRICK
 * ────────────────────────────
 * When the bottom nav scrolls away (navVisible=false), ChatInput slides down to
 * fill the vacated space. Both animate in lockstep at 200ms Easing.ease.
 *
 *   navVisible=true  → bottom: BOTTOM_NAV_HEIGHT(56) + insets.bottom
 *   navVisible=false → bottom: insets.bottom
 *
 * Component is position:'absolute' with animated bottom (Animated.timing).
 * useNativeDriver:false required — 'bottom' is a layout property.
 *
 * Compliance
 * ──────────
 *  ✓ §9.3.5 — Gap-Fill Trick: position absolute · animated bottom · 200ms Easing.ease
 *  ✓ Rule 03 — NO user avatar in composer (avatar lives ONLY in bottom nav Profile tab)
 *  ✓ Z-Index — 935 (below bottom nav · above chat content)
 *  ✓ Radius Protocol — radii.pill on input field + send button
 *  ✓ Auth gate — unauthenticated tap triggers onAuthGate before keyboard opens
 *  ✓ Haptic — impactLight on send
 *  ✓ Scope-aware placeholder — §9.3.5 format per active scope
 *  ✓ Disabled state — offline visual dim + interaction block
 *  ✓ React.memo — all props are primitives + stable callbacks
 *
 * § KEYBOARD NOTE
 * With position:'absolute', this component is OUT of the normal document flow.
 * The parent HomeScreen must:
 *   1. Add paddingBottom to ChatBody equal to STRIP_H so content isn't hidden
 *   2. Use KeyboardAvoidingView wrapping ChatBody only (not ChatInput)
 *   ChatInput handles its own position via bottomAnim.
 *
 * § Z-INDEX NOTE (PRD v3.2 reconciliation)
 * PRD §9.3.5 mandates z-935 (below bottom nav, above chat content).
 * Previous Rev used zIndexTokens.stickyCTA (940) — overridden by explicit PRD spec.
 * Z_CHAT_INPUT = 935 as const defined below.
 *
 * REVISION HISTORY
 * ────────────────
 * Rev 1 — Initial implementation
 * Rev 2 — Fixed: bg/zIndex · heat pill gradient · layout · trust anchor
 * Rev 3 — Radius Protocol: hardcoded radii → radii.pill token
 * Rev 4 — PRD v3.2 §9.3.5 compliance:
 *          ADDED  : navVisible prop (boolean, default true)
 *          ADDED  : scope / cityLabel / sectorLabel props
 *          ADDED  : resolvePlaceholder() scope-aware helper
 *          ADDED  : BOTTOM_NAV_HEIGHT (56), Z_CHAT_INPUT (935), NAV_ANIM_DURATION_MS (200)
 *          ADDED  : Scope type
 *          CHANGED: wrapper → position:'absolute', left:0, right:0, zIndex:935
 *          CHANGED: bottomAnim Animated.Value + useEffect for gap-fill animation
 *          CHANGED: View wrapper → Animated.View with animated bottom
 *          CHANGED: paddingBottom = PAD_V only (bottom prop carries insets.bottom)
 *          CHANGED: placeholder default → scope-aware resolvePlaceholder()
 *          CHANGED: TextInput accessibilityLabel → scope-aware
 *          KEPT   : onSend, isAuthenticated, onAuthGate unchanged
 *          KEPT   : disabled prop (already existed)
 *          KEPT   : all existing SendButton logic, spinner, haptics
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
// All values from Blueprint §[7], §9.3.5, and constants/colors.ts dimension tokens.
// ─────────────────────────────────────────────────────────────────────────────

/** Composer strip base height — Blueprint §[7] H: 64px */
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
 * No spacing token for 14 — spec-mandated literal.
 */
const INPUT_PAD_H = 14 as const;

/** Emoji button size inside input — Blueprint §[7.A] Emoji icon: 20×20 */
const EMOJI_SIZE = 20 as const;

/**
 * Emoji button right offset inside input — Blueprint §[7.A] "12px from right edge".
 * Uses spacing.md = 12.
 */
const EMOJI_RIGHT = spacing.md; // 12

/**
 * Input right padding: reserves space for 20px emoji icon + 12px offset + 8px gap.
 * Total: 12 + 20 + 8 = 40px
 *
 * ⚠️  FUTURE ICONS: If voice/image buttons are added, update this value.
 */
const INPUT_PAD_RIGHT = EMOJI_RIGHT + EMOJI_SIZE + spacing.sm; // 40

/** Idle input border width — Blueprint §[7.A] */
const BORDER_IDLE_W = 1 as const;

/** Focused input border width — Blueprint §[7.A] */
const BORDER_FOCUS_W = 2 as const;

/**
 * Input field idle opacity when disabled — Blueprint §[7.A] "opacity 0.5"
 */
const INPUT_DISABLED_OPACITY = 0.5 as const;

/** Max chars allowed — Blueprint §[7.A] "Max chars: 1000" */
const CHAR_LIMIT = 1_000 as const;

/** Char counter appears from this threshold — Blueprint §[7.A] "counter visible from 850 chars" */
const COUNTER_THRESHOLD = 850 as const;

/** Send button opacity when disabled — Blueprint §[7.B] "Opacity: 0.6" */
const SEND_DISABLED_OPACITY = 0.6 as const;

/** Failed state auto-reset duration — Blueprint §[7.B] "failed (3s) → idle" */
const FAILED_RESET_MS = 3_000 as const;

/** Brief sending state duration before returning to idle */
const SENDING_IDLE_RESET_MS = 300 as const;

/**
 * Bottom navigation bar height — PRD §9.3 "height: 56px".
 * Used to position ChatInput above the nav bar (navVisible=true state).
 */
const BOTTOM_NAV_HEIGHT = 56 as const;

/**
 * Z-index for ChatInput — PRD §9.3.5 "z-index: 935".
 * Below bottom nav (which sits above) · above chat content.
 * PRD v3.2 overrides previous stickyCTA (940) token decision.
 */
const Z_CHAT_INPUT = 935 as const;

/**
 * Gap-fill animation duration — PRD §9.3.5 "200ms".
 * Both nav hide and ChatInput bottom-slide happen in 200ms lockstep.
 */
const NAV_ANIM_DURATION_MS = 200 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLOR CONSTANTS
// All from semantic tokens — zero hardcoded hex literals.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip background — Blueprint §[7] */
const STRIP_BG = colors.bg.surface;

/** Top divider — Blueprint §[7] */
const STRIP_BORDER = colors.border.default;

/** Input field background — Blueprint §[7.A] */
const INPUT_BG = palette.cream[200];

/** Input idle border color */
const INPUT_BORDER_IDLE = colors.border.inputIdle;

/** Input focused / filled border color */
const INPUT_BORDER_FOCUS = colors.border.inputFocus;

/** Input text color — Blueprint §[7.A] */
const INPUT_TEXT_COLOR = colors.fg.primary;

/** Input placeholder color — Blueprint §[7.A] */
const INPUT_PLACEHOLDER_COLOR = colors.fg.placeholder;

/** Emoji icon color — Blueprint §[7.A] */
const EMOJI_COLOR = colors.fg.secondary;

/** Send button idle background */
const SEND_BG_IDLE = palette.cream[200];

/** Send button idle icon color */
const SEND_ICON_IDLE = colors.fg.secondary;

/** Send button active background */
const SEND_BG_ACTIVE = colors.fg.brand;

/** Send button active/sending icon color */
const SEND_ICON_ACTIVE = palette.white;

/** Send button failed background */
const SEND_BG_FAILED = palette.amber[600];

/** Char counter default color */
const COUNTER_COLOR_DEFAULT = colors.fg.secondary;

/**
 * Char counter warning color — last 50 chars.
 * Semantic token (colors.fg.warning → amber[600]).
 */
const COUNTER_COLOR_WARN = colors.fg.warning;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Send button state machine — Blueprint §[7.B] */
type SendState = 'idle' | 'active' | 'sending' | 'failed';

/**
 * Active chat scope — determines placeholder text and geographic context.
 * PRD §9.3.5: scope-aware placeholder format.
 */
type Scope = 'world' | 'country' | 'city' | 'sector';

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatInputProps {
  /**
   * Called when the user taps the active send button.
   * Receives trimmed, non-empty text.
   * Fire-and-forget — component returns to idle after calling.
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
   * Whether the bottom navigation bar is currently visible.
   *
   * PRD §9.3.5 — Gap-Fill Trick:
   *   true  → bottom = BOTTOM_NAV_HEIGHT(56) + insets.bottom
   *   false → bottom = insets.bottom (fills vacated nav space)
   *
   * Both this component and the nav bar animate at 200ms Easing.ease in lockstep.
   * Parent must keep these in sync: set navVisible=false on scroll-down,
   * navVisible=true on scroll-up.
   *
   * @default true
   */
  navVisible?: boolean;

  /**
   * Currently-active chat scope.
   * Drives the placeholder text per PRD §9.3.5 scope-aware format.
   * @default 'sector'
   */
  scope?: Scope;

  /**
   * Display name of the active city (e.g. "Mumbai").
   * Used when scope === 'city': "{cityLabel} ki chat mein message likho..."
   * @default ''
   */
  cityLabel?: string;

  /**
   * Display name of the active sector (e.g. "Bandra W").
   * Used when scope === 'sector': "{sectorLabel} mein message likho..."
   * @default 'Sector 17'
   */
  sectorLabel?: string;

  /**
   * Override placeholder text — backward-compatible escape hatch.
   * If provided, overrides the scope-aware computed placeholder.
   * New callers should omit this and use scope/cityLabel/sectorLabel instead.
   *
   * @deprecated Prefer scope-aware props. Will be removed in a future revision.
   */
  placeholder?: string;

  /**
   * Offline / network-error disabled state.
   * When true:
   *   · Input container opacity drops to INPUT_DISABLED_OPACITY (0.5)
   *   · TextInput is not editable (keyboard will not open)
   *   · Send button is disabled
   * Distinct from isAuthenticated=false — auth gate shows a sheet;
   * disabled=true silently blocks interaction during offline state.
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional styles applied to the Animated.View wrapper.
   * Use sparingly — most layout is governed by position/bottom/z-index rules.
   */
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the scope-aware placeholder string.
 * PRD §9.3.5 format:
 *   world   → "World ki chat mein message likho..."
 *   country → "India ki chat mein message likho..."
 *   city    → "{cityLabel} ki chat mein message likho..."
 *   sector  → "{sectorLabel} mein message likho..."
 *
 * If `override` is provided (backward-compat placeholder prop), it wins.
 *
 * @param scope       - Active chat scope
 * @param cityLabel   - Active city display name
 * @param sectorLabel - Active sector display name
 * @param override    - Explicit override (deprecated placeholder prop)
 * @returns           Placeholder string for the TextInput
 */
function resolvePlaceholder(
  scope:       Scope,
  cityLabel:   string,
  sectorLabel: string,
  override?:   string,
): string {
  if (override !== undefined) return override; // backward-compat
  switch (scope) {
    case 'world':   return 'World ki chat mein message likho...';
    case 'country': return 'India ki chat mein message likho...';
    case 'city':    return `${cityLabel} ki chat mein message likho...`;
    case 'sector':  return `${sectorLabel} mein message likho...`;
  }
}

/**
 * Resolves the scope-aware accessibility label for the TextInput.
 *
 * @param scope       - Active chat scope
 * @param cityLabel   - Active city display name
 * @param sectorLabel - Active sector display name
 * @returns           Accessibility label string
 */
function resolveA11yLabel(
  scope:       Scope,
  cityLabel:   string,
  sectorLabel: string,
): string {
  switch (scope) {
    case 'world':   return 'Type a message in World chat';
    case 'country': return 'Type a message in India chat';
    case 'city':    return `Type a message in ${cityLabel} chat`;
    case 'sector':  return `Type a message in ${sectorLabel}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — SUB-COMPONENT: SendButton
// ─────────────────────────────────────────────────────────────────────────────

interface SendButtonProps {
  sendState:  SendState;
  onPress:    () => void;
  spinValue:  Animated.Value;
}

/**
 * SendButton
 *
 * 40×40 circular button with four visual states:
 *   idle     — cream bg · play icon · opacity 0.6 · disabled
 *   active   — gold bg · send icon · opacity 1.0 · enabled + spring scale
 *   sending  — gold bg · rotating loader · disabled
 *   failed   — amber bg · warning icon · disabled → auto-resets to idle after 3s
 *
 * Radius Protocol: radii.pill (9999) — RN clamps to SEND_SIZE/2 = 20px for circle.
 */
const SendButtonBase: React.FC<SendButtonProps> = ({ sendState, onPress, spinValue }) => {
  // ── Scale spring on idle→active ────────────────────────────────────────
  const btnScale  = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(false);

  const isActiveNow = sendState === 'active';

  useEffect(() => {
    if (isActiveNow && !wasActive.current) {
      // Blueprint §[7.B]: "scale 0.9→1.0 spring(gentle) 200ms" on idle→active
      btnScale.setValue(0.9);
      Animated.spring(btnScale, {
        toValue:         1,
        stiffness:       animation.easing.springGentle.stiffness, // 100
        damping:         animation.easing.springGentle.damping,   // 15
        useNativeDriver: true, // PERF: transform — compositor thread
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
            size={SEND_ICON_SIZE - 4}  // 16px — Blueprint §[7.B]
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
    // idle — play arrow
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
        hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
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
    width:          SEND_SIZE,    // 40px
    height:         SEND_SIZE,    // 40px
    borderRadius:   radii.pill,   // Radius Protocol — 9999, clamps to 20px
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  disabled: {
    opacity: SEND_DISABLED_OPACITY, // 0.6
  },
  pressed: {
    opacity: 0.85,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ChatInput
 *
 * Sticky bottom composer — position:'absolute' with animated bottom.
 * Implements PRD §9.3.5 Gap-Fill Trick: slides down when nav hides.
 *
 * ─ GAP-FILL TRICK (§9.3.5): ─────────────────────────────────────────────────
 *   navVisible=true  → bottom = 56 + insets.bottom (sits above nav bar)
 *   navVisible=false → bottom = insets.bottom (fills the vacated nav space)
 *   Both animate at 200ms Easing.ease — zero visual gap with nav animation.
 *   useNativeDriver: false — 'bottom' is a layout property, not transform/opacity.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ RULE 03 COMPLIANCE:
 *   No user avatar. Avatar lives ONLY in the bottom nav's Profile tab.
 *
 * ⛔ Z-INDEX: 935 — below bottom nav, above chat content.
 *
 * @example
 * <ChatInput
 *   onSend={handleSend}
 *   isAuthenticated={!!user}
 *   onAuthGate={openAuthSheet}
 *   scope="city"
 *   cityLabel="Mumbai"
 *   sectorLabel="Bandra W"
 *   navVisible={navVisible}
 * />
 */
const ChatInputBase: React.FC<ChatInputProps> = ({
  onSend,
  onVoice:      _onVoice,   // reserved — not rendered in current revision
  onImage:      _onImage,   // reserved — not rendered in current revision
  onAuthGate,
  isAuthenticated,
  navVisible    = true,
  scope         = 'sector',
  cityLabel     = '',
  sectorLabel   = 'Sector 17',
  disabled      = false,
  placeholder,              // explicit override (backward-compat)
  style,
}) => {
  const insets  = useSafeAreaInsets();
  const haptics = useHaptics();

  // ── State ─────────────────────────────────────────────────────────────────
  const [text,      setText]      = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [sendState, setSendState] = useState<SendState>('idle');

  // ── Refs ──────────────────────────────────────────────────────────────────
  const inputRef        = useRef<TextInput>(null);
  const failedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Spinner animation value (shared with SendButton) ─────────────────────
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop  = useRef<Animated.CompositeAnimation | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.1 — GAP-FILL ANIMATION (PRD §9.3.5)
  // Animated.Value for the `bottom` CSS property.
  // Initialized to BOTTOM_NAV_HEIGHT (56) — insets.bottom applied in first effect.
  // useNativeDriver:false — layout property, cannot use UI thread.
  // ─────────────────────────────────────────────────────────────────────────

  const bottomAnim     = useRef(new Animated.Value(BOTTOM_NAV_HEIGHT)).current;
  const isFirstRender  = useRef(true);

  useEffect(() => {
    // Target bottom position based on nav visibility:
    //   navVisible=true  → 56 + insets.bottom (above nav bar)
    //   navVisible=false → insets.bottom only  (fills vacated nav space)
    const targetBottom = navVisible
      ? BOTTOM_NAV_HEIGHT + insets.bottom
      : insets.bottom;

    if (isFirstRender.current) {
      // First render: set immediately — no animation flash on mount
      bottomAnim.setValue(targetBottom);
      isFirstRender.current = false;
      return;
    }

    // Subsequent changes: animate at 200ms Easing.ease (§9.3.5)
    // PERF: useNativeDriver:false — 'bottom' triggers layout, not compositor
    Animated.timing(bottomAnim, {
      toValue:         targetBottom,
      duration:        NAV_ANIM_DURATION_MS, // 200ms — §9.3.5 lockstep with nav
      easing:          Easing.ease,
      useNativeDriver: false,
    }).start();
  }, [navVisible, insets.bottom, bottomAnim]);

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.2 — Spinner: start/stop when sendState changes to/from 'sending'
  // Blueprint §[7.B]: "16×16 #FFFFFF spinner (1000ms linear infinite)"
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sendState === 'sending') {
      spinValue.setValue(0);
      spinLoop.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue:         1,
          duration:        1_000,         // Blueprint §[7.B]: 1000ms
          easing:          Easing.linear,
          useNativeDriver: true,          // PERF: transform — compositor thread
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
  // § 7.3 — Derive send state from text length
  // ─────────────────────────────────────────────────────────────────────────

  const hasText = text.trim().length > 0;

  useEffect(() => {
    // Only update idle↔active — don't clobber 'sending' or 'failed'
    if (sendState === 'sending' || sendState === 'failed') return;
    setSendState(hasText ? 'active' : 'idle');
  }, [hasText, sendState]);

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.4 — Char counter display
  // Blueprint §[7.A]: "Max chars: 1000 · counter visible from 850 chars (subtle)"
  // ─────────────────────────────────────────────────────────────────────────

  const charsLeft   = CHAR_LIMIT - text.length;
  const showCounter = text.length >= COUNTER_THRESHOLD;
  const counterWarn = charsLeft <= 50; // last 50 chars → amber warning

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.5 — Auth gate
  // ─────────────────────────────────────────────────────────────────────────

  const handleInputFocus = useCallback((): void => {
    if (!isAuthenticated) {
      inputRef.current?.blur();
      onAuthGate?.();
      return;
    }
    setIsFocused(true);
    haptics.impactLight();
  }, [isAuthenticated, onAuthGate, haptics]);

  const handleInputBlur = useCallback((): void => {
    setIsFocused(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.6 — Send handler
  // ─────────────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.7 — Emoji keyboard trigger
  // ─────────────────────────────────────────────────────────────────────────

  const handleEmojiPress = useCallback((): void => {
    if (!isAuthenticated) {
      onAuthGate?.();
      return;
    }
    inputRef.current?.focus();
  }, [isAuthenticated, onAuthGate]);

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.8 — Derived values
  // ─────────────────────────────────────────────────────────────────────────

  /** Border state driven by focus */
  const inputBorderColor = isFocused ? INPUT_BORDER_FOCUS : INPUT_BORDER_IDLE;
  const inputBorderWidth = isFocused ? BORDER_FOCUS_W     : BORDER_IDLE_W;

  /**
   * Scope-aware placeholder — PRD §9.3.5.
   * Explicit `placeholder` prop wins for backward compatibility.
   */
  const effectivePlaceholder = resolvePlaceholder(scope, cityLabel, sectorLabel, placeholder);

  /**
   * Scope-aware accessibility label.
   */
  const effectiveA11yLabel = resolveA11yLabel(scope, cityLabel, sectorLabel);

  // ─────────────────────────────────────────────────────────────────────────
  // § 7.9 — Render
  //
  // Animated.View is used instead of View so that `bottom: bottomAnim` works.
  // The `bottom` property is an Animated.Value — not usable with static View.
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom:         bottomAnim, // §9.3.5 — gap-fill animated position
          paddingBottom:  PAD_V,      // 12px — safe-area already baked into `bottom`
        },
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
         * ⛔ RULE 03: No avatar. Avatar lives ONLY in bottom nav Profile tab.
         *
         * Input container is position:relative so emoji trigger can be
         * absolutely positioned inside at EMOJI_RIGHT px from the right edge.
         */}
        <View
          style={[
            styles.inputContainer,
            {
              borderColor: inputBorderColor,
              borderWidth: inputBorderWidth,
            },
            disabled && styles.inputContainerDisabled,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={text}
            onChangeText={(val) => {
              if (val.length <= CHAR_LIMIT) {
                setText(val);
              }
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

        {/* 8px gap — Blueprint §[7] */}
        <View style={styles.inputSendGap} />

        {/* ── [7.B] Send Button ──────────────────────────────────────────── */}
        <SendButtonMemo
          sendState={sendState}
          onPress={handleSend}
          spinValue={spinValue}
        />

      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — STYLES
// Zero hardcoded hex values — all tokens referenced in § 2.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ─── Outer wrapper ───────────────────────────────────────────────────────
  /**
   * PRD §9.3.5 — Gap-Fill Trick position spec:
   *   position: 'absolute'  — out of normal flow · slides with nav
   *   left: 0, right: 0     — full screen width
   *   bottom: (animated)    — Animated.Value set inline
   *   minHeight: STRIP_H    — 64px base; grows upward if counter row is present
   *   zIndex: Z_CHAT_INPUT  — 935 (below nav, above chat content)
   *   elevation: 8          — Android: zIndex needs elevation for non-absolute siblings
   *
   * NOTE — minHeight vs height:
   *   task spec says "height: 64px" for the base state. We use minHeight so the
   *   char counter row (§ [7.D]) can expand the component upward without clipping.
   *   When counter is hidden, minHeight = 64px = STRIP_H as specified. ✓
   *
   * NOTE — paddingBottom:
   *   Previously PAD_V + insets.bottom (safe area via padding).
   *   Now PAD_V only — `bottom` value already positions component above safe area.
   *   (paddingBottom set inline in render to keep static styles simple.)
   */
  wrapper: {
    position:           'absolute',       // §9.3.5 — gap-fill trick
    left:               0,
    right:              0,
    // bottom: set inline via bottomAnim (Animated.Value)
    minHeight:          STRIP_H,          // 64px — grows upward for counter row
    backgroundColor:    STRIP_BG,         // colors.bg.surface
    borderTopWidth:     StyleSheet.hairlineWidth,
    borderTopColor:     STRIP_BORDER,     // colors.border.default
    paddingHorizontal:  PAD_H,            // 16px
    paddingTop:         PAD_V,            // 12px
    // paddingBottom set inline: PAD_V (12px) — safe area baked into `bottom`
    zIndex:             Z_CHAT_INPUT,     // 935 — PRD §9.3.5
    elevation:          8,                // Android
  },

  // ─── Main input row ──────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems:    'center',
  },

  // ─── [7.A] Input container ───────────────────────────────────────────────
  /**
   * Blueprint §[7.A]:
   *   H: 40px · Bg: cream[200] · Border radius: pill (20px effective)
   *   Border: 1px idle → 2px focused (applied inline)
   *   paddingLeft: 14px · paddingRight: 40px (reserves emoji icon space)
   * Radius Protocol: radii.pill (9999) — RN clamps to INPUT_H/2 = 20px.
   */
  inputContainer: {
    flex:            1,
    height:          INPUT_H,          // 40px
    borderRadius:    radii.pill,       // Radius Protocol: 9999 → clamps to 20px
    backgroundColor: INPUT_BG,         // cream[200]
    flexDirection:   'row',
    alignItems:      'center',
    overflow:        'hidden',
  },

  // ─── [7.A] Input container — disabled state ─────────────────────────────
  /**
   * Blueprint §[7.A] State (disabled): "opacity 0.5 (offline state)".
   * Applied to container — dims input text, border, AND emoji trigger together.
   */
  inputContainerDisabled: {
    opacity: INPUT_DISABLED_OPACITY, // 0.5
  },

  // ─── [7.A] TextInput ─────────────────────────────────────────────────────
  inputField: {
    flex:               1,
    height:             INPUT_H,         // 40px
    paddingLeft:        INPUT_PAD_H,     // 14px
    paddingRight:       INPUT_PAD_RIGHT, // 40px — reserves emoji space
    paddingTop:         0,
    paddingBottom:      0,
    fontFamily:         FONT_BODY.regular,
    fontSize:           FONT_SIZE.body,  // 15px
    fontWeight:         '400' as const,
    lineHeight:         22,
    color:              INPUT_TEXT_COLOR,    // ink[950]
    includeFontPadding: false,
    textAlignVertical:  'center',            // Android
  },

  // ─── [7.C] Emoji trigger ─────────────────────────────────────────────────
  /**
   * Blueprint §[7.A]: "Emoji icon: 20×20 · 12px from right edge"
   * Absolutely positioned inside inputContainer.
   */
  emojiButton: {
    position:       'absolute',
    right:          EMOJI_RIGHT,  // 12px
    width:          EMOJI_SIZE,   // 20px
    height:         EMOJI_SIZE,   // 20px
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ─── Input–send gap ──────────────────────────────────────────────────────
  inputSendGap: {
    width: INPUT_SEND_GAP, // 8px
  },

  // ─── [7.D] Char counter row ──────────────────────────────────────────────
  /**
   * Blueprint §[7.A]: "counter visible from 850 chars (subtle)"
   * Sits above input row · right-aligned · non-interactive.
   * With absolute-positioned wrapper, this expands the component upward. ✓
   */
  counterRow: {
    alignItems:    'flex-end',
    paddingBottom: spacing.xs, // 4px — tight gap above input row
  },
  counterText: {
    fontFamily:         FONT_BODY.regular,
    fontSize:           FONT_SIZE.cap, // 12px
    fontWeight:         '400' as const,
    lineHeight:         16,
    color:              COUNTER_COLOR_DEFAULT, // ink[600]
    includeFontPadding: false,
  },
  counterTextWarn: {
    color: COUNTER_COLOR_WARN, // colors.fg.warning → amber[600]
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — EXPORT
// React.memo — all props are primitives or stable callbacks.
// Caller must stabilise callbacks with useCallback to prevent unnecessary re-renders.
//
// Re-renders when: isAuthenticated · navVisible · scope · cityLabel · sectorLabel
//   · placeholder · disabled · style · onSend / onAuthGate reference changes
// ─────────────────────────────────────────────────────────────────────────────

const ChatInput = React.memo(ChatInputBase);

export default ChatInput;

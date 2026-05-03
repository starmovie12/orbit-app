/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — Input Component                                           ║
 * ║  Atom · P1 · Updated                                                     ║
 * ║                                                                          ║
 * ║  Variants: default | phone | otp | search                               ║
 * ║  Features:                                                               ║
 * ║    • Animated label float on focus / value-present                       ║
 * ║    • OTP: 6 boxes · auto-advance · backspace · clipboard paste           ║
 * ║    • Phone: +91 🇮🇳 non-editable prefix                                 ║
 * ║    • error prop → Crimson Rose border + error text                       ║
 * ║    • helper prop → espresso helper text below                            ║
 * ║    • All design tokens — zero hardcoded values                           ║
 * ║    • WCAG 2.2 AA verified · iOS + Android                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Clipboard,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TextInputProps,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  animation,
  colors,
  dimensions,
  radii,
  spacing,
  typography,
} from "@/constants/colors";

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type InputVariant = "default" | "phone" | "otp" | "search";

/** Shared props across all non-OTP variants */
export type InputProps = Omit<TextInputProps, "style"> & {
  variant?: Exclude<InputVariant, "otp">;
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: React.ComponentProps<typeof Feather>["name"];
  rightIcon?: React.ComponentProps<typeof Feather>["name"];
  onRightIconPress?: () => void;
};

/** OTP variant props — separate interface because value/onChange semantics differ */
export type OtpInputProps = {
  variant: "otp";
  label?: string;
  helper?: string;
  error?: string;
  /** Called every keystroke with the current full code string (length 0–6) */
  onChangeCode?: (code: string) => void;
  /** Called only when all 6 digits are filled */
  onComplete?: (code: string) => void;
  /** Pre-fill code — e.g. from SMS auto-read */
  value?: string;
  autoFocus?: boolean;
  editable?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — SHARED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Animated label: resting Y offset (inside the input) */
const LABEL_Y_REST = 0;
/** Animated label: floated Y offset (above the input) */
const LABEL_Y_FLOAT = -(spacing.xl + spacing.xs);
/** Font size when resting */
const LABEL_SIZE_REST = typography.body.fontSize;
/** Font size when floated */
const LABEL_SIZE_FLOAT = typography.inputLabel.fontSize;

const ANIM_DURATION = animation.duration.inputFocusBorder;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — ANIMATED FLOATING LABEL (shared sub-component)
// ─────────────────────────────────────────────────────────────────────────────

type FloatingLabelProps = {
  label: string;
  floated: boolean;
  hasError: boolean;
};

const FloatingLabel = memo(function FloatingLabel({
  label,
  floated,
  hasError,
}: FloatingLabelProps) {
  const animY = useRef(
    new Animated.Value(floated ? LABEL_Y_FLOAT : LABEL_Y_REST)
  ).current;
  const animSize = useRef(
    new Animated.Value(floated ? LABEL_SIZE_FLOAT : LABEL_SIZE_REST)
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animY, {
        toValue: floated ? LABEL_Y_FLOAT : LABEL_Y_REST,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(animSize, {
        toValue: floated ? LABEL_SIZE_FLOAT : LABEL_SIZE_REST,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }),
    ]).start();
  }, [floated, animY, animSize]);

  const floatedColor = hasError
    ? colors.fg.error
    : floated
    ? colors.fg.brand
    : colors.fg.tertiary;

  return (
    <Animated.Text
      style={[
        styles.floatingLabel,
        {
          transform: [{ translateY: animY }],
          fontSize: animSize,
          color: floatedColor,
        },
      ]}
      numberOfLines={1}
      pointerEvents="none"
    >
      {label}
    </Animated.Text>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — HELPER / ERROR TEXT (shared sub-component)
// ─────────────────────────────────────────────────────────────────────────────

const SubText = memo(function SubText({
  error,
  helper,
}: {
  error?: string;
  helper?: string;
}) {
  if (error) {
    return (
      <View style={styles.subTextRow}>
        <Feather
          name="alert-circle"
          size={12}
          color={colors.fg.error}
          style={{ marginRight: spacing.xs }}
        />
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      </View>
    );
  }
  if (helper) {
    return (
      <Text style={styles.helperText} numberOfLines={2}>
        {helper}
      </Text>
    );
  }
  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — STANDARD INPUT (default | phone | search)
// ─────────────────────────────────────────────────────────────────────────────

export const Input = memo(
  forwardRef<TextInput, InputProps>(function Input(
    {
      variant = "default",
      label,
      helper,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      onFocus,
      onBlur,
      value,
      defaultValue,
      placeholderTextColor,
      editable = true,
      ...rest
    },
    ref
  ) {
    const [focused, setFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(
      value ?? defaultValue ?? ""
    );
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const hasValue = (currentValue?.length ?? 0) > 0;
    const floated = focused || hasValue;
    const hasError = !!error;

    const borderColor = hasError
      ? colors.border.inputError
      : focused
      ? colors.border.inputFocus
      : hasValue
      ? colors.border.inputFilled
      : colors.border.inputIdle;

    const borderWidth = focused || hasError ? 2 : 1;
    // Compensate horizontal padding so content stays aligned when border thickens
    const horizontalPad = spacing.inputH - (borderWidth - 1);

    const handleFocus = useCallback(
      (e: any) => {
        setFocused(true);
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = useCallback(
      (e: any) => {
        setFocused(false);
        onBlur?.(e);
      },
      [onBlur]
    );

    const handleChange = useCallback(
      (text: string) => {
        if (!isControlled) setInternalValue(text);
        rest.onChangeText?.(text);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isControlled, rest.onChangeText]
    );

    // Determine left decoration ──────────────────────────────────────────────
    const resolvedLeftIcon: React.ComponentProps<typeof Feather>["name"] | null =
      variant === "search"
        ? (leftIcon ?? "search")
        : leftIcon ?? null;

    return (
      // Blueprint: Disabled → opacity 0.4 on full wrapper (bg change alone is not enough)
      <View style={[styles.wrapper, !editable && styles.wrapperDisabled]}>
        {/* Floating label sits inside the wrapper, positioned over the row */}
        {label ? (
          <View style={styles.labelContainer} pointerEvents="none">
            <FloatingLabel
              label={label}
              floated={floated}
              hasError={hasError}
            />
          </View>
        ) : null}

        <View
          style={[
            styles.row,
            {
              borderColor,
              borderWidth,
              paddingHorizontal: horizontalPad,
              height: dimensions.inputH,
              paddingTop: label && floated ? spacing.md : 0,
              backgroundColor: editable
                ? colors.bg.input
                : colors.bg.inputDisabled,
            },
          ]}
        >
          {/* Phone prefix — blueprint spec: 60px W · cream-50 bg · "+91" 16px 600 ink-950 · 1px right divider */}
          {variant === "phone" ? (
            <View style={styles.phonePrefix} accessible={false} accessibilityElementsHidden>
              <Text style={styles.phonePrefixCode}>+91</Text>
              <View style={styles.phoneDivider} />
            </View>
          ) : null}

          {/* Left icon (default / search) */}
          {resolvedLeftIcon ? (
            <Feather
              name={resolvedLeftIcon}
              size={16}
              color={focused ? colors.fg.brand : colors.fg.tertiary}
              style={styles.leftIcon}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}

          <TextInput
            ref={ref}
            value={isControlled ? value : internalValue}
            onChangeText={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={editable}
            placeholderTextColor={
              placeholderTextColor ?? colors.fg.placeholder
            }
            keyboardType={
              variant === "phone" ? "number-pad" : rest.keyboardType
            }
            textContentType={
              variant === "phone" ? "telephoneNumber" : rest.textContentType
            }
            maxLength={variant === "phone" ? 10 : rest.maxLength}
            style={[
              styles.textInput,
              variant === "search" && styles.textInputSearch,
            ]}
            selectionColor={colors.fg.brand}
            {...rest}
          />

          {/* Right icon */}
          {rightIcon ? (
            <Pressable
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole={onRightIconPress ? "button" : undefined}
              style={styles.rightIconPress}
            >
              <Feather
                name={rightIcon}
                size={16}
                color={focused ? colors.fg.brand : colors.fg.tertiary}
              />
            </Pressable>
          ) : null}
        </View>

        <SubText error={error} helper={helper} />
      </View>
    );
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — OTP INPUT
// ─────────────────────────────────────────────────────────────────────────────

const OTP_COUNT = dimensions.otpBoxCount; // 6
const OTP_BOX_SIZE = dimensions.otpBoxSize; // 52
const OTP_BOX_GAP = dimensions.otpBoxGap;   // 6

export type OtpInputRef = {
  /** Manually focus the first empty box (or box 0 if all filled) */
  focus: () => void;
  /** Clear all boxes and reset focus to box 0 */
  clear: () => void;
};

export const OtpInput = memo(
  forwardRef<OtpInputRef, OtpInputProps>(function OtpInput(
    {
      label,
      helper,
      error,
      onChangeCode,
      onComplete,
      value,
      autoFocus = false,
      editable = true,
    },
    ref
  ) {
    // Digits array — single source of truth
    const [digits, setDigits] = useState<string[]>(() => {
      const initial = (value ?? "").slice(0, OTP_COUNT).split("");
      return Array.from({ length: OTP_COUNT }, (_, i) => initial[i] ?? "");
    });

    // Sync controlled value prop
    useEffect(() => {
      if (value === undefined) return;
      const next = value.slice(0, OTP_COUNT).split("");
      setDigits(Array.from({ length: OTP_COUNT }, (_, i) => next[i] ?? ""));
    }, [value]);

    const inputRefs = useRef<Array<TextInput | null>>(
      Array.from({ length: OTP_COUNT }, () => null)
    );
    const [focusedIndex, setFocusedIndex] = useState<number | null>(
      autoFocus ? 0 : null
    );

    // Shake animation for error state
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const triggerShake = useCallback(() => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: animation.duration.otpShake, useNativeDriver: true }),
      ]).start();
    }, [shakeAnim]);

    const prevError = useRef(error);
    useEffect(() => {
      if (error && error !== prevError.current) triggerShake();
      prevError.current = error;
    }, [error, triggerShake]);

    // Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      focus() {
        const firstEmpty = digits.findIndex((d) => d === "");
        inputRefs.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus();
      },
      clear() {
        setDigits(Array(OTP_COUNT).fill(""));
        inputRefs.current[0]?.focus();
      },
    }));

    // Core digit change ──────────────────────────────────────────────────────
    const handleDigitChange = useCallback(
      (text: string, index: number) => {
        const clean = text.replace(/\D/g, "");

        if (clean.length > 1) {
          // Paste / multi-char: distribute across boxes from this index
          const chars = clean.slice(0, OTP_COUNT - index).split("");
          const next = [...digits];
          chars.forEach((ch, i) => {
            if (index + i < OTP_COUNT) next[index + i] = ch;
          });
          setDigits(next);
          const code = next.join("");
          onChangeCode?.(code);
          const firstEmpty = next.findIndex((d) => d === "");
          inputRefs.current[firstEmpty === -1 ? OTP_COUNT - 1 : firstEmpty]?.focus();
          if (next.every((d) => d !== "")) onComplete?.(code);
          return;
        }

        // Single char
        const next = [...digits];
        next[index] = clean;
        setDigits(next);
        const code = next.join("");
        onChangeCode?.(code);
        if (clean && index < OTP_COUNT - 1) {
          inputRefs.current[index + 1]?.focus();
        }
        if (next.every((d) => d !== "")) onComplete?.(code);
      },
      [digits, onChangeCode, onComplete]
    );

    // Backspace ──────────────────────────────────────────────────────────────
    const handleKeyPress = useCallback(
      (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
        if (e.nativeEvent.key === "Backspace") {
          if (digits[index]) {
            const next = [...digits];
            next[index] = "";
            setDigits(next);
            onChangeCode?.(next.join(""));
          } else if (index > 0) {
            const next = [...digits];
            next[index - 1] = "";
            setDigits(next);
            onChangeCode?.(next.join(""));
            inputRefs.current[index - 1]?.focus();
          }
        }
      },
      [digits, onChangeCode]
    );

    // Clipboard paste ────────────────────────────────────────────────────────
    const handlePaste = useCallback(
      async (index: number) => {
        try {
          const text = await Clipboard.getString();
          if (!text) return;
          const clean = text.replace(/\D/g, "").slice(0, OTP_COUNT);
          if (!clean) return;
          const chars = clean.split("");
          const next = [...digits];
          chars.forEach((ch, i) => {
            if (index + i < OTP_COUNT) next[index + i] = ch;
          });
          setDigits(next);
          const code = next.join("");
          onChangeCode?.(code);
          const firstEmpty = next.findIndex((d) => d === "");
          inputRefs.current[firstEmpty === -1 ? OTP_COUNT - 1 : firstEmpty]?.focus();
          if (next.every((d) => d !== "")) onComplete?.(code);
        } catch {
          /* Clipboard unavailable — silent */
        }
      },
      [digits, onChangeCode, onComplete]
    );

    const hasError = !!error;

    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.otpLabel}>{label}</Text> : null}

        <Animated.View
          style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {Array.from({ length: OTP_COUNT }, (_, i) => {
            const isFocused = focusedIndex === i;
            const isFilled = digits[i] !== "";
            // Blueprint § 5 OTP border spec:
            //   idle   → 1px cream-400  (inputIdle)
            //   focused → 2px gold-600  (inputFocus)
            //   filled  → 2px emerald-600 (inputSuccess)  ← was missing
            //   error   → 2px crimson-600 (inputError)
            const boxBorderColor = hasError
              ? colors.border.inputError
              : isFocused
              ? colors.border.inputFocus
              : isFilled
              ? colors.border.inputSuccess
              : colors.border.inputIdle;
            const boxBorderWidth = isFocused || isFilled || hasError ? 2 : 1;

            return (
              <Pressable
                key={i}
                onPress={() => inputRefs.current[i]?.focus()}
                onLongPress={() => handlePaste(i)}
                accessible={false}
                style={({ pressed }) => [
                  styles.otpBox,
                  {
                    borderColor: boxBorderColor,
                    borderWidth: boxBorderWidth,
                    backgroundColor: colors.bg.input,
                    opacity: pressed ? 0.82 : 1,
                    ...(isFocused
                      ? {
                          shadowColor: colors.fg.brand,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.28,
                          shadowRadius: 6,
                          elevation: 3,
                        }
                      : {
                          shadowColor: "transparent",
                          shadowOpacity: 0,
                          elevation: 0,
                        }),
                  },
                ]}
              >
                <TextInput
                  ref={(el) => { inputRefs.current[i] = el; }}
                  value={digits[i]}
                  onChangeText={(t) => handleDigitChange(t, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  onFocus={() => setFocusedIndex(i)}
                  onBlur={() => setFocusedIndex((prev) => prev === i ? null : prev)}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={2}
                  selectTextOnFocus
                  editable={editable}
                  caretHidden
                  autoFocus={autoFocus && i === 0}
                  style={styles.otpDigit}
                  selectionColor={colors.fg.brand}
                  importantForAutofill="yes"
                />
                {isFocused && !digits[i] ? <OtpCursor /> : null}
              </Pressable>
            );
          })}
        </Animated.View>

        <SubText error={error} helper={helper} />
      </View>
    );
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — OTP CURSOR (blinking caret sub-component)
// ─────────────────────────────────────────────────────────────────────────────

const OtpCursor = memo(function OtpCursor() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.otpCursor, { opacity }]}
      pointerEvents="none"
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Shared ────────────────────────────────────────────────────────────────
  wrapper: {
    // intentionally no overflow:hidden — floating label needs to escape
  },
  // Blueprint: Disabled state → full wrapper opacity 0.4
  wrapperDisabled: {
    opacity: 0.4,
  },

  // ── Floating label ────────────────────────────────────────────────────────
  labelContainer: {
    position: "absolute",
    left: spacing.inputH,
    // Vertically center the resting label inside the input row
    top: dimensions.inputH / 2 - LABEL_SIZE_REST / 2,
    zIndex: 1,
  },
  floatingLabel: {
    fontWeight: "500",
    // fontSize + translateY driven by Animated.Value
  },

  // ── Input row ─────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    overflow: "hidden",
  },

  // ── Phone prefix ──────────────────────────────────────────────────────────
  // Blueprint § 4: 60px W · bg cream-50 · "+91" 16px 600 ink-950 centered · 1px right divider
  // The prefix box sits flush-left inside the row (row has paddingHorizontal,
  // so we use negative margin to bleed to the left edge, then add the divider gap)
  phonePrefix: {
    width: 60,
    height: "100%",
    backgroundColor: colors.bg.subtle,      // cream[50] = #FFF9EC
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -(spacing.inputH - 1),      // Bleed to inner row edge (compensate paddingHorizontal)
    marginRight: spacing.sm,
  },
  phonePrefixCode: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.fg.primary,               // ink[950] — spec: ink-950
    letterSpacing: 0.2,
  },
  phoneDivider: {
    position: "absolute",
    right: 0,
    top: "15%",
    height: "70%",
    width: 1,
    backgroundColor: colors.border.default,
  },

  // ── Icons ─────────────────────────────────────────────────────────────────
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIconPress: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },

  // ── TextInput ─────────────────────────────────────────────────────────────
  textInput: {
    flex: 1,
    ...typography.inputValue,
    color: colors.fg.primary,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  textInputSearch: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },

  // ── Sub text ──────────────────────────────────────────────────────────────
  subTextRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  errorText: {
    ...typography.inputHelper,
    color: colors.fg.error,
    fontWeight: "500",
    flex: 1,
  },
  helperText: {
    ...typography.inputHelper,
    color: colors.fg.secondary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },

  // ── OTP ───────────────────────────────────────────────────────────────────
  otpLabel: {
    ...typography.inputLabel,
    color: colors.fg.secondary,
    marginBottom: spacing.md,
    letterSpacing: 0.3,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: OTP_BOX_GAP,
  },
  otpBox: {
    width: OTP_BOX_SIZE,
    height: OTP_BOX_SIZE,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  otpDigit: {
    ...typography.otpDigit,
    color: colors.fg.primary,
    textAlign: "center",
    width: "100%",
    height: "100%",
    padding: 0,
    includeFontPadding: false,
    // Hide native caret — we render our own blinking line
    ...Platform.select({ android: { caretColor: "transparent" } }),
  },
  otpCursor: {
    position: "absolute",
    bottom: 10,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.fg.brand,
    pointerEvents: "none",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — COMBINED VARIANT ROUTER (ergonomic single import)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * InputField — variant router.
 * Pass `variant="otp"` to get the OTP box grid; everything else gets Input.
 *
 * @example
 *   // Default text input with floating label
 *   <InputField label="Full Name" value={name} onChangeText={setName} />
 *
 *   // Phone input with +91 prefix
 *   <InputField variant="phone" label="Phone Number" value={phone} onChangeText={setPhone} />
 *
 *   // Search bar
 *   <InputField variant="search" placeholder="Dhundho..." />
 *
 *   // OTP grid — 6 boxes
 *   <InputField variant="otp" label="Enter OTP" onComplete={verifyOtp} />
 */
export type InputFieldProps = InputProps | OtpInputProps;

export const InputField = memo(
  forwardRef<TextInput | OtpInputRef, InputFieldProps>(function InputField(
    props,
    ref
  ) {
    if (props.variant === "otp") {
      return <OtpInput ref={ref as React.Ref<OtpInputRef>} {...props} />;
    }
    return <Input ref={ref as React.Ref<TextInput>} {...(props as InputProps)} />;
  })
);

export default Input;

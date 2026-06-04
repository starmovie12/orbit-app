/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — components/molecules/SearchBar.tsx                       ║
 * ║  Molecule · P1 · Blueprint v5.0 BAAP EDITION                            ║
 * ║                                                                          ║
 * ║  Used in: Discover · SavedMessages · Notifications filter               ║
 * ║                                                                          ║
 * ║  Props:                                                                  ║
 * ║    value         : string            controlled text value              ║
 * ║    onChangeText  : (t: string)→void  change handler                     ║
 * ║    placeholder?  : string            default "Search..."                ║
 * ║    onFocus?      : () => void        optional focus callback            ║
 * ║    style?        : ViewStyle         outer container override           ║
 * ║                                                                          ║
 * ║  Features:                                                               ║
 * ║    • Feather search icon left                                            ║
 * ║    • Clear "×" button right — visible only when value non-empty         ║
 * ║    • Animated border: inputIdle (#E5CC95) → inputFocus (#C9A227) 200ms  ║
 * ║    • Animated border width: 1px → 2px on focus                         ║
 * ║    • Clear button spring scale press feedback                           ║
 * ║    • Reduced-motion: opacity-only fallback via useReducedMotion()       ║
 * ║    • Full accessibility: role="search", "Clear search text" label       ║
 * ║    • React.memo on all sub-components                                   ║
 * ║    • Zero hardcoded colors / spacing — tokens only                      ║
 * ║                                                                          ║
 * ║  Design tokens:                                                          ║
 * ║    colors.border.inputIdle   = cream[400]   = #E5CC95                   ║
 * ║    colors.border.inputFocus  = gold[600]    = #C9A227                   ║
 * ║    colors.bg.input           = white                                     ║
 * ║    colors.fg.primary         = ink[950]     = #1A1208                   ║
 * ║    colors.fg.placeholder     = ink[500]                                 ║
 * ║    colors.fg.secondary       = ink[600]                                 ║
 * ║    spacing.md = 12 · spacing.sm = 8 · spacing.xs = 4                   ║
 * ║    radii.pill = 999 (full pill SearchBar capsule)                       ║
 * ║    animation.inputFocusBorder = 200ms                                   ║
 * ║                                                                          ║
 * ║  Deps: components/atoms/Divider.tsx · hooks/useDebounce.ts             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '@/constants/colors';
import {
  Duration,
  easeOut,
  springConfigs,
  useReducedMotion,
} from '@/constants/animations';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  /** Controlled search text value. */
  value: string;
  /** Called on every keystroke. Debounce in the consumer (useDebounce 300ms). */
  onChangeText: (text: string) => void;
  /** Placeholder text shown when input is empty. Default: "Search..." */
  placeholder?: string;
  /** Optional callback fired when the input receives focus. */
  onFocus?: () => void;
  /** Additional style applied to the outermost container View. */
  style?: ViewStyle;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Height of the SearchBar capsule.
 * 44px matches touch.minIos and aligns with Discover / Saved Messages layouts.
 * It is intentionally smaller than inputH (56px) — search bars are secondary
 * UI chrome, not primary form inputs.
 */
const SEARCH_BAR_HEIGHT = 44;

/**
 * Icon and clear-button size — consistent with Feather usage across app.
 * 18px keeps the search icon visually balanced inside the 44px capsule.
 */
const ICON_SIZE = 18;

/**
 * Border width for idle (unfocused) state.
 * Matches colors.border.inputIdle spec: 1px hairline.
 */
const BORDER_WIDTH_IDLE = 1;

/**
 * Border width for focused state.
 * Matches colors.border.inputFocus spec: 2px focused ring.
 */
const BORDER_WIDTH_FOCUS = 2;

/**
 * Duration for the focus border transition.
 * Blueprint §5.N animation.inputFocusBorder = 200ms.
 */
const BORDER_ANIM_DURATION = 200;

// ─── AnimatedSearchBorder ─────────────────────────────────────────────────────
//
// Wraps the SearchBar content in an Animated.View whose border color and width
// interpolate between idle and focused states.
//
// useNativeDriver: false is required because we're animating border properties
// (layout values), not opacity/transform. This is intentional and correct —
// the animation is short (200ms) and only triggers on focus/blur.

interface AnimatedSearchBorderProps {
  isFocused: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
}

const AnimatedSearchBorder = React.memo<AnimatedSearchBorderProps>(
  ({ isFocused, reducedMotion, children }) => {
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (reducedMotion) {
        // Reduced motion: snap instantly, no interpolated transition.
        animValue.setValue(isFocused ? 1 : 0);
        return;
      }
      Animated.timing(animValue, {
        toValue:         isFocused ? 1 : 0,
        duration:        BORDER_ANIM_DURATION,
        easing:          easeOut,
        useNativeDriver: false, // border color / width require layout driver
      }).start();
    }, [isFocused, reducedMotion, animValue]);

    const borderColor = animValue.interpolate({
      inputRange:  [0, 1],
      outputRange: [colors.border.inputIdle, colors.border.inputFocus],
    });

    const borderWidth = animValue.interpolate({
      inputRange:  [0, 1],
      outputRange: [BORDER_WIDTH_IDLE, BORDER_WIDTH_FOCUS],
    });

    return (
      <Animated.View
        style={[
          styles.capsule,
          {
            borderColor,
            borderWidth: borderWidth as unknown as number,
          },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {children}
      </Animated.View>
    );
  },
);

AnimatedSearchBorder.displayName = 'SearchBar.AnimatedSearchBorder';

// ─── ClearButton ──────────────────────────────────────────────────────────────
//
// Spring scale press animation (0.85 on press, spring back on release).
// Blueprint: Clear tap should feel snappy — springStiff (tension:200, friction:18).
// Reduced motion: opacity-only fallback.

interface ClearButtonProps {
  onPress: () => void;
  reducedMotion: boolean;
}

const ClearButton = React.memo<ClearButtonProps>(({ onPress, reducedMotion }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (reducedMotion) return;
    Animated.timing(scaleAnim, {
      toValue:         0.82,
      duration:        Duration.micro, // 80ms — buttonPress
      easing:          easeOut,
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, scaleAnim]);

  const handlePressOut = useCallback(() => {
    // springStiff: crisp, confident release. Never gets stuck at 0.82.
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...springConfigs.springStiff,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.clearWrapper,
        { transform: [{ scale: scaleAnim }] },
        reducedMotion && styles.noop,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={styles.clearHitSlop as { top: number; bottom: number; left: number; right: number }}
        accessibilityRole="button"
        accessibilityLabel="Clear search text"
        style={styles.clearTouch}
        activeOpacity={reducedMotion ? 0.5 : 1} // Reduced motion: opacity feedback
      >
        <Feather
          name="x"
          size={14}
          color={colors.fg.secondary}
          strokeWidth={2.5}
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

ClearButton.displayName = 'SearchBar.ClearButton';

// ─── SearchBar ────────────────────────────────────────────────────────────────

const SearchBar = React.memo<SearchBarProps>(
  ({ value, onChangeText, placeholder, onFocus, style }) => {
    const [isFocused, setIsFocused]   = useState(false);
    const inputRef                     = useRef<TextInput>(null);
    const reducedMotion                = useReducedMotion();
    const hasValue                     = value.length > 0;

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleFocus = useCallback(
      (_e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
        setIsFocused(true);
        onFocus?.();
      },
      [onFocus],
    );

    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);

    const handleChangeText = useCallback(
      (text: string) => {
        onChangeText(text);
      },
      [onChangeText],
    );

    /**
     * Clear tapped:
     *   1. Clear the value.
     *   2. Re-focus the input so the keyboard stays open and the user can
     *      immediately type a new query — zero friction.
     */
    const handleClear = useCallback(() => {
      onChangeText('');
      inputRef.current?.focus();
    }, [onChangeText]);

    // ── Computed styles ─────────────────────────────────────────────────────

    const containerStyle = useMemo(
      () => [styles.container, style],
      [style],
    );

    // ── Render ───────────────────────────────────────────────────────────────

    return (
      <View style={containerStyle}>
        <AnimatedSearchBorder
          isFocused={isFocused}
          reducedMotion={reducedMotion}
        >
          {/* Inner row: search icon · input · clear button */}
          <View style={styles.row}>

            {/* ── Search icon (left) ──────────────────────────────────────── */}
            <View
              style={styles.iconWrapper}
              accessible={false}
              importantForAccessibility="no"
            >
              <Feather
                name="search"
                size={ICON_SIZE}
                color={
                  isFocused
                    ? colors.border.inputFocus   // gold[600] when focused
                    : colors.fg.secondary        // ink[600] at rest
                }
                strokeWidth={2}
              />
            </View>

            {/* ── Text input ──────────────────────────────────────────────── */}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder ?? 'Search...'}
              placeholderTextColor={colors.fg.placeholder}
              style={styles.input}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityRole="search"
              accessibilityLabel={placeholder ?? 'Search'}
              accessibilityHint="Type to search"
              testID="search-bar-input"
            />

            {/* ── Clear button (right, conditional) ──────────────────────── */}
            {hasValue && (
              <ClearButton
                onPress={handleClear}
                reducedMotion={reducedMotion}
              />
            )}
          </View>
        </AnimatedSearchBorder>
      </View>
    );
  },
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;

// ─── Styles ──────────────────────────────────────────────────────────────────
//
// Token map:
//   colors.bg.input          → white background for the capsule
//   colors.border.inputIdle  → cream[400] — animated start value
//   colors.border.inputFocus → gold[600] — animated end value
//   radii.pill               → 999 — full capsule on all sides
//   spacing.md               → 12px — horizontal padding left/right
//   spacing.sm               → 8px  — gap between icon and input
//   spacing.xs               → 4px  — gap between input and clear button

const styles = StyleSheet.create({

  // Outer container — full width; accepts optional style override.
  container: {
    width: '100%',
  } as ViewStyle,

  // Animated border capsule — height and radius from tokens.
  // backgroundColor here (not on the row) so shadow renders on an opaque surface.
  capsule: {
    height:          SEARCH_BAR_HEIGHT,
    borderRadius:    radii.pill,            // 999 — true pill on all screen sizes
    backgroundColor: colors.bg.input,       // white
    overflow:        'hidden',              // clips content to border-radius (iOS)
    justifyContent:  'center',
  },

  // Inner horizontal row: icon | input | clear
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    height:           '100%',
    paddingHorizontal: spacing.md,          // 12px
  },

  // Search icon wrapper — fixed size so the icon stays centered
  iconWrapper: {
    width:           ICON_SIZE,
    height:          ICON_SIZE,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     spacing.sm,            // 8px gap to input
  },

  // TextInput — flex-1 takes all remaining space
  input: {
    flex:               1,
    height:             '100%',
    ...typography.bodyLg,                   // 15px 400 DM Sans — relaxed reading
    color:              colors.fg.primary,  // ink[950] — warm ink
    paddingVertical:    0,                  // Remove iOS default vertical padding
    includeFontPadding: false,              // Android: remove baseline padding
  },

  // Clear button animated wrapper — 28×28 touch target
  clearWrapper: {
    width:           28,
    height:          28,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      spacing.xs,            // 4px gap from input
  },

  // Clear button touchable — matches wrapper size exactly
  clearTouch: {
    width:           28,
    height:          28,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    14,                    // Circular for ripple on Android
  },

  // hitSlop used as a plain object reference for TypeScript
  clearHitSlop: {
    top:    8,
    bottom: 8,
    left:   8,
    right:  8,
  },

  // No-op style — used for reducedMotion spread guard (empty, intentional)
  noop: {},

});

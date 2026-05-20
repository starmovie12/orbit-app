/**
 * ScrollFAB — components/atoms/ScrollFAB.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN App · PRD v3.2 §10.1 Home Screen Anatomy · Layer: atom · Status: updated · P1
 *
 * Floating action button that surfaces when the user scrolls away from the
 * bottom of the Home Screen chat body. Signals unread messages below and
 * offers a single-tap shortcut back to the live edge.
 *
 * Visual anatomy
 * ──────────────
 *   ┌──────────────────────────────┐
 *   │  ↓  3 nayi messages          │  ← Brand gold pill (#D4A017) · subtle shadow
 *   └──────────────────────────────┘
 *        ↑ centred, 12px above sticky chat input
 *
 * Positioning (PRD §10.1)
 * ───────────────────────
 *   bottom = chatInputHeight (64) + bottomNavHeight (56) + insets.bottom + 12px gap
 *   horizontal = alignSelf: 'center' (CSS equivalent: left:50% + translateX(-50%))
 *   zIndex: stickyCTA (940) — sits above chat content, below bottom nav
 *
 * Animation (PRD §10.1 visibility spec)
 * ──────────────────────────────────────
 *   Show : opacity 0→1 + translateY 20→0 · 250ms · easeOut
 *   Hide : opacity 1→0 + translateY 0→10 · 150ms · easeIn
 *   Press: scale 1→0.95→1 via springStiff  (useButtonPress hook)
 *   Reduced motion: opacity-only · no translate
 *
 * Label format (PRD §10.1)
 * ────────────────────────
 *   count === 1 → "1 nayi message"
 *   count  > 1 → "{count} nayi messages"
 *   count === 0 → "Neeche jao"
 *   Use `buildScrollFABLabel(count)` exported below to build the string.
 *
 * Props
 * ─────
 *   visible          boolean        FAB visibility (driven by scroll position).
 *   label            string         Label text — required. Use buildScrollFABLabel(count).
 *   onPress          () => void     Scrolls chat to bottom / dismisses FAB.
 *   chatInputHeight? number         Height of sticky input bar. Default: 64px (PRD §10.1).
 *   bottomNavHeight? number         Height of bottom nav bar.  Default: 56px (PRD §10.1).
 *
 * Usage
 * ─────
 *   import ScrollFAB, { buildScrollFABLabel } from '@/components/atoms/ScrollFAB';
 *
 *   <ScrollFAB
 *     visible={!isAtBottom}
 *     onPress={scrollToBottom}
 *     label={buildScrollFABLabel(unreadCount)}
 *   />
 *
 * Deps: constants/colors.ts, constants/animations.ts, react-native-safe-area-context
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  spacing,
  typography,
  zIndex,
} from '@/constants/colors';
import {
  easings,
  useButtonPress,
  useReducedMotion,
} from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DESIGN TOKENS  (no hardcoded values below this block)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Y-axis travel on enter: opacity 0→1, translateY SLIDE_DISTANCE_IN→0.
 * PRD §10.1 show animation: 20px lift.
 */
const SLIDE_DISTANCE_IN = 20 as const;

/**
 * Y-axis travel on exit: opacity 1→0, translateY 0→SLIDE_DISTANCE_OUT.
 * PRD §10.1 hide animation: 10px drop.
 */
const SLIDE_DISTANCE_OUT = 10 as const;

/** Show animation duration (PRD §10.1): 250ms easeOut. */
const DURATION_SHOW = 250 as const;

/** Hide animation duration (PRD §10.1): 150ms easeIn — exit faster than enter. */
const DURATION_HIDE = 150 as const;

/**
 * Default sticky chat input height from PRD §10.1 anatomy (64px).
 * Overridable via chatInputHeight prop when the input resizes (e.g. multi-line input).
 */
const DEFAULT_CHAT_INPUT_HEIGHT = 64 as const;

/**
 * Default bottom nav height from PRD §10.1 anatomy (56px simple fixed bar).
 * Overridable via bottomNavHeight prop.
 */
const DEFAULT_BOTTOM_NAV_HEIGHT = 56 as const;

/**
 * Gap between FAB bottom edge and chat input top edge (PRD §10.1 positioning spec).
 */
const BOTTOM_GAP = 12 as const;

// Token aliases — never use raw color strings in JSX / StyleSheet below.
/** Brand gold — #D4A017. Ensure constants/colors.ts fg.brand = '#D4A017'. */
const PILL_BG      = colors.fg.brand;
/** White — text rendered on gold pill. */
const LABEL_COLOR  = colors.fg.onBrand;
/** Gold glow for shadow. */
const SHADOW_COLOR = colors.fg.brand;

/**
 * Frosted border — 40% opacity derivative of brand gold (#D4A017).
 * Single source of truth for this derived value.
 * Replace with `colors.fg.brandBorder40` once the token is added to constants/colors.ts.
 */
const BORDER_COLOR = 'rgba(212, 160, 23, 0.40)' as const; // 40% of #D4A017

/** Chevron-down glyph — swap for an icon component in the icon-system pass. */
const CHEVRON_DOWN = '↓' as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — LABEL UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the ScrollFAB label string from a new-message count.
 * Call this in the parent and pass the result to the `label` prop.
 *
 * @param count - Number of new messages below the viewport (0 = plain scroll indicator).
 * @returns Localised Hindi label string per PRD §10.1.
 *
 * @example
 * <ScrollFAB label={buildScrollFABLabel(unreadCount)} visible={!atBottom} onPress={scrollToBottom} />
 */
export function buildScrollFABLabel(count: number): string {
  if (count === 1) return '1 nayi message';
  if (count > 1)   return `${count} nayi messages`;
  return 'Neeche jao';
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface ScrollFABProps {
  /**
   * Controls FAB visibility. Driven by parent FlatList scroll position.
   *   true  → animate in  (opacity 0→1, translateY 20→0, 250ms easeOut)
   *   false → animate out (opacity 1→0, translateY 0→10, 150ms easeIn)
   */
  visible: boolean;

  /**
   * Label text rendered beside the ↓ chevron. Always required.
   * Build via `buildScrollFABLabel(count)` exported from this file.
   * Format (PRD §10.1):
   *   count === 1 → "1 nayi message"
   *   count  > 1 → "{count} nayi messages"
   *   count === 0 → "Neeche jao"
   */
  label: string;

  /**
   * Invoked when the user taps the FAB.
   * Typically calls `flatListRef.current?.scrollToEnd({ animated: true })`.
   */
  onPress: () => void;

  /**
   * Height of the sticky chat input bar in logical pixels.
   * Pass the measured value from the parent layout so the FAB repositions
   * correctly when the keyboard adjusts the input or the input grows multi-line.
   * @default 64  (PRD §10.1 anatomy)
   */
  chatInputHeight?: number;

  /**
   * Height of the bottom navigation bar in logical pixels.
   * @default 56  (PRD §10.1 anatomy — simple, fixed, full-width bar)
   */
  bottomNavHeight?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ScrollFAB
 *
 * Floating pill button anchored above the sticky chat input.
 * Fades and slides in when the user has scrolled away from the live edge;
 * tapping scrolls back to the bottom instantly.
 *
 * Positioning formula (PRD §10.1):
 *   bottom = chatInputHeight + bottomNavHeight + insets.bottom + 12px
 *
 * @example
 * // New-message count context from parent
 * <ScrollFAB
 *   visible={hasNew && !atBottom}
 *   onPress={scrollToBottom}
 *   label={buildScrollFABLabel(unreadCount)}
 * />
 *
 * @example
 * // Plain scroll-down affordance (no unread count)
 * <ScrollFAB
 *   visible={!atBottom}
 *   onPress={scrollToBottom}
 *   label={buildScrollFABLabel(0)}  // "Neeche jao"
 * />
 */
const ScrollFAB: React.FC<ScrollFABProps> = ({
  visible,
  label,
  onPress,
  chatInputHeight = DEFAULT_CHAT_INPUT_HEIGHT,
  bottomNavHeight = DEFAULT_BOTTOM_NAV_HEIGHT,
}) => {
  const insets        = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // ── Animated values — created once, never re-instantiated ────────────────
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE_IN)).current;

  // ── Button press scale from animations hook ───────────────────────────────
  const { scale, handlers: pressHandlers } = useButtonPress();

  // ── Dynamic bottom offset (PRD §10.1 positioning formula) ─────────────────
  // bottom = chatInputHeight + bottomNavHeight + insets.bottom + 12px gap
  // Default: 64 + 56 + insets.bottom + 12 = 132 + insets.bottom
  const bottomOffset =
    chatInputHeight + bottomNavHeight + insets.bottom + BOTTOM_GAP;

  // ── Enter: opacity 0→1, translateY 20→0, 250ms easeOut ───────────────────
  const animateIn = useCallback(() => {
    // Cancel any in-flight exit animation
    opacity.stopAnimation();
    translateY.stopAnimation();

    if (reducedMotion) {
      // Reduced motion: hold translateY at 0, fade only
      translateY.setValue(0);
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue:         1,
        duration:        DURATION_SHOW,       // 250ms
        easing:          easings.easeOut,
        useNativeDriver: true,
      }),
      ...(reducedMotion
        ? []
        : [
            Animated.timing(translateY, {
              toValue:         0,
              duration:        DURATION_SHOW,  // 250ms — match opacity
              easing:          easings.easeOut,
              useNativeDriver: true,
            }),
          ]),
    ]).start();
  }, [opacity, translateY, reducedMotion]);

  // ── Exit: opacity 1→0, translateY 0→10, 150ms easeIn ─────────────────────
  const animateOut = useCallback(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue:         0,
        duration:        DURATION_HIDE,            // 150ms — exit faster than enter
        easing:          easings.easeIn,
        useNativeDriver: true,
      }),
      ...(reducedMotion
        ? []
        : [
            Animated.timing(translateY, {
              toValue:         SLIDE_DISTANCE_OUT,  // 10px drop on exit
              duration:        DURATION_HIDE,       // 150ms
              easing:          easings.easeIn,
              useNativeDriver: true,
            }),
          ]),
    ]).start();
  }, [opacity, translateY, reducedMotion]);

  // ── React to visibility changes ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      animateOut();
    }
  }, [visible, animateIn, animateOut]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.root,
        {
          // Dynamic bottom offset — injected inline so StyleSheet can stay static
          bottom:    bottomOffset,
          opacity,
          transform: [
            { translateY },
            { scale }, // tactile press feedback — from useButtonPress
          ],
        },
      ]}
      // When invisible, remove from hit-testing so ghost taps don't get swallowed
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressHandlers.onPressIn}
        onPressOut={pressHandlers.onPressOut}
        style={styles.pressable}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.pill}>
          {/* ↓ Chevron */}
          <View style={styles.chevronWrap}>
            <Text
              style={styles.chevron}
              allowFontScaling={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {CHEVRON_DOWN}
            </Text>
          </View>

          {/* Label — always shown (label is a required prop per PRD §10.1) */}
          <Text
            style={styles.label}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — STYLES
// Tokens only — zero hardcoded color values.
// `bottom` intentionally absent here — injected as inline style (dynamic offset).
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root — position: absolute, centred, z-index above chat content ────────
  root: {
    position:  'absolute',
    // `bottom` injected inline — formula: chatInputHeight + bottomNavHeight + insets.bottom + 12
    // Horizontal centering via alignSelf: 'center'
    // (equivalent to CSS `left: 50%; transform: translateX(-50%)` in a full-width container)
    alignSelf: 'center',
    zIndex:    zIndex.stickyCTA,  // 940 — above content, below bottom nav (950)
    // Ensure shadow isn't clipped by parent overflow:hidden
    ...Platform.select({
      ios:     { overflow: 'visible' },
      android: {},
    }),
  },

  // ── Pressable — full pill tap area ────────────────────────────────────────
  pressable: {
    // No additional sizing — pill geometry defines the visual & touch target
  },

  // ── Gold pill (PRD §10.1 visual spec) ─────────────────────────────────────
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'center',
    gap:               spacing.xs,  // 4px between chevron and label

    // PRD §10.1: padding 10px 20px
    paddingVertical:   10,
    paddingHorizontal: 20,

    // PRD §10.1: brand gold bg, white text, 20px border-radius (pill)
    backgroundColor:   PILL_BG,
    borderRadius:      20,           // PRD §10.1 pill shape (20px, not full 999)
    borderWidth:       1,
    borderColor:       BORDER_COLOR, // frosted gold edge — 40% of #D4A017

    // Subtle elevation (PRD §10.1 shadow spec)
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius:  8,
    elevation:     4,                // Android subtle elevation
  },

  // ── Chevron wrap — consistent optical sizing ──────────────────────────────
  chevronWrap: {
    width:          16,
    height:         16,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── ↓ glyph ───────────────────────────────────────────────────────────────
  chevron: {
    ...typography.body,
    color:      LABEL_COLOR,
    fontWeight: '700' as const,
    lineHeight: 16,
    fontSize:   14,
  },

  // ── Label text ────────────────────────────────────────────────────────────
  label: {
    ...typography.caption,
    color:         LABEL_COLOR,
    fontWeight:    '600' as const,
    letterSpacing: 0.15,
    // Prevent label from growing and misaligning with the chevron
    flexShrink:    1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — EXPORT
// React.memo — re-renders only when visible / label / onPress /
// chatInputHeight / bottomNavHeight change.
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(ScrollFAB);

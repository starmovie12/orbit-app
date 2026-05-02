/**
 * ScrollFAB — components/atoms/ScrollFAB.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: new · P2
 *
 * Floating action button that surfaces when the user scrolls away from the
 * bottom of the Home Screen chat body. Signals unread messages below and
 * offers a single-tap shortcut back to the live edge.
 *
 * Visual anatomy
 * ──────────────
 *   ┌──────────────────────────────┐
 *   │  ↓  New messages  (or ↓)    │  ← Gold pill · frosted border · tier-2 shadow
 *   └──────────────────────────────┘
 *        ↑ centred, bottom: 80px above Glass Island floor
 *
 * Animation
 * ─────────
 *   Enter : opacity 0→1 + translateY +8→0 · 240ms · easeOut   (fadeConfig + 8px lift)
 *   Exit  : opacity 1→0 + translateY 0→+8 · 160ms · easeIn    (faster — less intrusive)
 *   Press : scale 1→0.95→1 via springStiff                     (useButtonPress hook)
 *   Reduced motion: opacity-only · no translate · blueprint "New messages chip slide" row
 *
 * Positioning
 * ───────────
 *   position: absolute · bottom: 80px (Glass Island 56px + gap 24px) · alignSelf: center
 *   zIndex: stickyCTA (940) — sits above content, below Glass Island (950)
 *
 * Props
 * ─────
 *   visible   boolean       Whether the FAB is visible (driven by scroll position).
 *   onPress   () => void    Scrolls chat to bottom / dismisses FAB.
 *   label?    string        Override label. Defaults to "New messages".
 *                           Pass undefined / empty string for icon-only mode (↓ only).
 *
 * Usage
 * ─────
 *   import ScrollFAB from '@/components/atoms/ScrollFAB';
 *
 *   // In Home Screen chat body — drive via FlatList onScroll / onContentSizeChange
 *   <ScrollFAB
 *     visible={!isAtBottom && hasNewMessages}
 *     onPress={scrollToBottom}
 *     label="New messages"
 *   />
 *
 * Deps: constants/colors.ts, constants/animations.ts
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

import {
  colors,
  spacing,
  typography,
  zIndex,
} from '@/constants/colors';
import {
  durations,
  easings,
  springConfigs,
  useButtonPress,
  useReducedMotion,
} from '@/constants/animations';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DESIGN TOKENS  (no hardcoded values below this block)
// ─────────────────────────────────────────────────────────────────────────────

/** Distance from bottom of the container. Glass Island (56) + gap (24) = 80px. */
const BOTTOM_OFFSET = 80 as const;

/** Y-axis travel distance for enter/exit slide animation (logical px). */
const SLIDE_DISTANCE = 8 as const;

/** Default label when the caller does not override. */
const DEFAULT_LABEL = 'New messages' as const;

/** Chevron-down glyph — single source of truth so it's easy to swap to an icon. */
const CHEVRON_DOWN = '↓' as const;

// Token aliases — never use raw color strings in JSX / StyleSheet below.
const GOLD           = colors.fg.brand;                        // #C9A227 Champagne Gold
const GOLD_TEXT      = colors.fg.onBrand;                     // #FFFFFF — text on gold pill
const PILL_BG        = colors.fg.brand;                       // solid gold pill fill
const BORDER_COLOR   = 'rgba(201, 162, 39, 0.40)' as const;  // frosted edge — 40% gold
const SHADOW_COLOR   = colors.fg.brand;                       // gold glow

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface ScrollFABProps {
  /**
   * Controls FAB visibility. Driven by the parent FlatList scroll position.
   * true  → animate in  (easeOut enter)
   * false → animate out (easeIn exit)
   */
  visible: boolean;

  /**
   * Invoked when the user taps the FAB.
   * Typically calls `flatListRef.current?.scrollToEnd({ animated: true })`.
   */
  onPress: () => void;

  /**
   * Custom label text rendered beside the ↓ chevron.
   * Pass an empty string or undefined to render icon-only mode.
   * @default "New messages"
   */
  label?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ScrollFAB
 *
 * Floating pill button anchored 80px above Glass Island. Fades and slides in
 * when unread messages exist below the viewport; tapping scrolls to the live edge.
 *
 * @example
 * // With label (new-message count context visible to parent)
 * <ScrollFAB visible={hasNew && !atBottom} onPress={scrollToBottom} label="New messages" />
 *
 * @example
 * // Icon-only — for a simple "scroll down" affordance
 * <ScrollFAB visible={!atBottom} onPress={scrollToBottom} />
 */
const ScrollFAB: React.FC<ScrollFABProps> = ({
  visible,
  onPress,
  label = DEFAULT_LABEL,
}) => {
  const reducedMotion = useReducedMotion();

  // ── Animated values — created once, never re-instantiated ────────────────
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  // ── Button press scale from animations hook ───────────────────────────────
  const { scale, handlers: pressHandlers } = useButtonPress();

  // ── Enter / exit orchestration ─────────────────────────────────────────────
  const animateIn = useCallback(() => {
    // Cancel any in-flight exit
    opacity.stopAnimation();
    translateY.stopAnimation();

    const parallel = Animated.parallel([
      Animated.timing(opacity, {
        toValue:         1,
        duration:        durations.normal,          // 240ms
        easing:          easings.easeOut,
        useNativeDriver: true,
      }),
      // Skip translate on reduced motion — blueprint "New messages chip slide" row
      ...(reducedMotion
        ? []
        : [
            Animated.timing(translateY, {
              toValue:         0,
              duration:        durations.normal,    // 240ms — match opacity
              easing:          easings.easeOut,
              useNativeDriver: true,
            }),
          ]),
    ]);

    if (reducedMotion) {
      // Hold translateY at 0 — no movement, only fade
      translateY.setValue(0);
    }

    parallel.start();
  }, [opacity, translateY, reducedMotion]);

  const animateOut = useCallback(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();

    const parallel = Animated.parallel([
      Animated.timing(opacity, {
        toValue:         0,
        duration:        durations.fast,             // 160ms — exit faster than enter
        easing:          easings.easeIn,
        useNativeDriver: true,
      }),
      ...(reducedMotion
        ? []
        : [
            Animated.timing(translateY, {
              toValue:         SLIDE_DISTANCE,
              duration:        durations.fast,       // 160ms
              easing:          easings.easeIn,
              useNativeDriver: true,
            }),
          ]),
    ]);

    parallel.start();
  }, [opacity, translateY, reducedMotion]);

  // ── React to visibility changes ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      animateOut();
    }
  }, [visible, animateIn, animateOut]);

  // ── Derived display state ─────────────────────────────────────────────────
  const showLabel = label.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity,
          transform: [
            { translateY },
            { scale },      // press tactile — from useButtonPress
          ],
        },
      ]}
      // When invisible, remove from hit-testing so taps don't get swallowed
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
        accessibilityLabel={
          showLabel ? `${label}. Tap to scroll down.` : 'Scroll down'
        }
        accessibilityHint="Returns to the bottom of the conversation"
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

          {/* Label — hidden in icon-only mode */}
          {showLabel && (
            <Text
              style={styles.label}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {label}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — STYLES
// Tokens only — zero hardcoded values.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root — positioned above Glass Island ──────────────────────────────────
  root: {
    position:   'absolute',
    bottom:     BOTTOM_OFFSET,
    // Centre horizontally: alignSelf works inside absolutely-positioned parents
    // only when the parent has a defined width. Callers should render this inside
    // a full-width View (e.g. the chat body container) with pointerEvents="box-none".
    alignSelf:  'center',
    zIndex:     zIndex.stickyCTA,   // 940 — above content, below Glass Island (950)
    // Ensure shadow isn't clipped by parent overflow:hidden
    ...Platform.select({
      ios:     { overflow: 'visible' },
      android: {},
    }),
  },

  // ── Pressable — full pill tap area ────────────────────────────────────────
  pressable: {
    // No additional sizing — pill defines the visual & touch target
  },

  // ── Gold pill ─────────────────────────────────────────────────────────────
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'center',
    gap:              spacing.xs,          // 4px between chevron and label
    paddingVertical:  spacing.sm,          // 8px top/bottom
    paddingHorizontal: spacing.base,       // 16px sides
    backgroundColor:  PILL_BG,            // solid gold fill
    borderRadius:     999,                 // full-pill
    borderWidth:      1,
    borderColor:      BORDER_COLOR,        // frosted gold edge — 40% opacity

    // Tier-2 gold glow shadow (blueprint shadow.tier2 values)
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius:  10,
    elevation:     6,                      // Android tier-2 elevation
  },

  // ── Chevron wrap — consistent optical size ────────────────────────────────
  chevronWrap: {
    width:          16,
    height:         16,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── ↓ glyph ───────────────────────────────────────────────────────────────
  chevron: {
    ...typography.body,
    color:      GOLD_TEXT,
    fontWeight: '700' as const,
    lineHeight: 16,
    fontSize:   14,
  },

  // ── Label text ────────────────────────────────────────────────────────────
  label: {
    ...typography.caption,
    color:        GOLD_TEXT,
    fontWeight:   '600' as const,
    letterSpacing: 0.15,
    // Prevent the label from growing and misaligning with the chevron
    flexShrink:   1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — EXPORT
// React.memo — re-renders only on visible / onPress / label changes.
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(ScrollFAB);

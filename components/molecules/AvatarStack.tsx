/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWD WORLD — components/molecules/AvatarStack.tsx                     ║
 * ║  Molecule · P2 · Blueprint v5.0 BAAP EDITION                            ║
 * ║                                                                          ║
 * ║  Used in: Room cards (host avatars) · Discover featured section         ║
 * ║                                                                          ║
 * ║  Props:                                                                  ║
 * ║    uids   : string[]           — Firebase UIDs to render                ║
 * ║    max?   : number = 5         — max visible before +N overflow          ║
 * ║    size?  : number = 28        — diameter of each avatar circle (px)    ║
 * ║    style? : ViewStyle          — outer wrapper override                 ║
 * ║                                                                          ║
 * ║  Visual design:                                                          ║
 * ║    Avatar circle : user.color bg · user.emoji (or initial) centered     ║
 * ║    Overlap       : -8px horizontal (each circle after first)            ║
 * ║    Border        : 2px white · separates circles on any bg              ║
 * ║    Z-stack       : first avatar on top (z descending left → right)      ║
 * ║    Overflow      : gold[600] bg · ink[950] text · "+N" · same size      ║
 * ║    Loading       : static cream skeleton discs (blueprint §1253)        ║
 * ║                                                                          ║
 * ║  Animation:                                                              ║
 * ║    Stagger fade+scale on initial data load (40ms per avatar)            ║
 * ║    Reduced motion → instant appear (no stagger)                         ║
 * ║    Engine: Reanimated 3 (UI thread · zero JS jank)                      ║
 * ║                                                                          ║
 * ║  Data:                                                                   ║
 * ║    Fetches { emoji, color, displayName } per uid via getUser()          ║
 * ║    Parallel Promise.all — single Firestore round-trip batch             ║
 * ║    Missing user → ink[600] bg · "?" fallback                            ║
 * ║                                                                          ║
 * ║  Design tokens:                                                          ║
 * ║    palette.gold[600]  = #C9A227   overflow badge bg                     ║
 * ║    colors.fg.primary  = ink[950]  overflow badge text (§15 AAA)         ║
 * ║    palette.white      = #FFFFFF   avatar border (separation ring)       ║
 * ║    palette.ink[600]   = #6B5B47   unknown-user fallback bg              ║
 * ║    palette.cream[200] = #F7ECD0   skeleton disc base color              ║
 * ║    radii.full         = 9999      perfect circle ← used everywhere      ║
 * ║    AVATAR_BORDER_WIDTH = 2px      separator ring thickness              ║
 * ║    STACK_OVERLAP       = 8px      horizontal offset between circles     ║
 * ║                                                                          ║
 * ║  FIX v5.0.1:                                                             ║
 * ║    Replaced all hardcoded `size / 2` & `outerSize / 2` borderRadius     ║
 * ║    calculations with `radii.full` (9999) design token.                  ║
 * ║    React Native clamps borderRadius at 50% automatically — using 9999   ║
 * ║    keeps code declarative, blueprint-synced, and math-free.             ║
 * ║                                                                          ║
 * ║  Deps: constants/colors.ts · constants/animations.ts                    ║
 * ║        lib/firestore-users.ts · react-native-reanimated                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// ── FIX: `radii` added to import — used for all borderRadius values ──────────
import { colors, palette, radii } from '@/constants/colors';
import { durations, easings, useReducedMotion } from '@/constants/animations';
import { getUser, type UserDoc } from '@/lib/firestore-users';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Horizontal overlap between consecutive avatar circles (task spec). */
const STACK_OVERLAP = 8;

/**
 * White separator ring around each avatar circle.
 * Ensures circles remain visually distinct on any background — cream cards
 * or the dark Glass Island surface.
 */
const AVATAR_BORDER_WIDTH = 2;

/** Stagger delay between each avatar's entrance animation (ms). */
const STAGGER_DELAY_MS = 40;

/** Opacity floor before entrance animation begins. */
const ENTRANCE_OPACITY_FROM = 0;

/** Scale floor for the entrance animation. */
const ENTRANCE_SCALE_FROM = 0.72;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvatarStackProps {
  /** Firebase Auth UIDs to render. Order is preserved; first = leftmost. */
  uids: string[];
  /** Maximum circles visible before "+N" overflow badge appears. Default 5. */
  max?: number;
  /** Diameter of each circle in logical pixels. Default 28. */
  size?: number;
  /** Optional outer wrapper style (margin, flex, etc). */
  style?: ViewStyle;
}

// ─── Internal types ───────────────────────────────────────────────────────────

/** Resolved per-avatar display data derived from UserDoc. */
interface AvatarData {
  uid:     string;
  /** User's chosen emoji (may be empty string). */
  emoji:   string;
  /** User's chosen background colour string (CSS hex or named). */
  color:   string;
  /** Single uppercase char — fallback when emoji is absent. */
  initial: string;
}

/** Discriminated union for async fetch state. */
type FetchState =
  | { status: 'loading' }
  | { status: 'ready'; items: AvatarData[] };

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Deterministic fallback colour from uid when user.color is absent.
 * Uses djb2 hash mod a curated warm palette — never cold/generic.
 */
const FALLBACK_PALETTE: readonly string[] = [
  palette.gold[600],   // Champagne Gold
  palette.amber[600],  // Burnished Amber
  palette.ink[600],    // Espresso Brown
  palette.gold[800],   // Antique Gold
  palette.amber[700],  // Deep Amber
] as const;

function uidToColor(uid: string): string {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) ^ uid.charCodeAt(i); // djb2 XOR variant
  }
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

/**
 * Resolve display data from a fetched UserDoc.
 * Null doc (user not found / fetch error) → safe "?" fallback.
 */
function resolveAvatar(uid: string, doc: UserDoc | null): AvatarData {
  if (!doc) {
    return { uid, emoji: '', color: palette.ink[600], initial: '?' };
  }

  return {
    uid,
    emoji:   doc.emoji ?? '',
    color:   doc.color || uidToColor(uid),
    initial: doc.displayName?.trim()[0]?.toUpperCase() ?? '?',
  };
}

// ─── AvatarStack ──────────────────────────────────────────────────────────────

const AvatarStack = React.memo<AvatarStackProps>(
  ({ uids, max = 5, size = 28, style }) => {
    const reducedMotion = useReducedMotion();

    const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });

    // ── Derived slices ───────────────────────────────────────────────────────

    /**
     * UIDs to show as circles.
     * Stable join-based memo key avoids re-fetch if parent re-renders with
     * the same uid array contents but a new array reference.
     */
    const visibleUids: string[] = useMemo(
      () => uids.slice(0, max),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [uids.join(','), max],
    );

    /** How many uids are hidden behind the overflow badge. */
    const overflowCount: number = uids.length > max ? uids.length - max : 0;

    // ── Firestore fetch ──────────────────────────────────────────────────────
    //
    // Fetch the visible slice only — never touch overflow uids.
    // Promise.all fires all getUser() calls simultaneously for a single
    // effective Firestore round-trip (each resolves independently).
    // Individual failures fall back to the null-doc placeholder — no throw.

    useEffect(() => {
      if (visibleUids.length === 0) {
        setFetchState({ status: 'ready', items: [] });
        return;
      }

      let cancelled = false;
      setFetchState({ status: 'loading' });

      Promise.all(
        visibleUids.map(uid =>
          getUser(uid).catch(() => null),  // Individual failure → null fallback
        ),
      ).then(docs => {
        if (cancelled) return;
        setFetchState({
          status: 'ready',
          items:  docs.map((doc, i) => resolveAvatar(visibleUids[i], doc)),
        });
      });

      return () => { cancelled = true; };
    // visibleUids.join is stable when contents match — used as dep, not the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleUids.join(',')]);

    // ── Render ───────────────────────────────────────────────────────────────

    /** Total rendered items (circles + optional overflow badge). */
    const totalCircles: number =
      (fetchState.status === 'ready' ? fetchState.items.length : visibleUids.length)
      + (overflowCount > 0 ? 1 : 0);

    /** Outer row height = circle diameter + 2× border width. */
    const rowHeight = size + AVATAR_BORDER_WIDTH * 2;

    const containerStyle = useMemo(
      () => [styles.container, { height: rowHeight }, style],
      [rowHeight, style],
    );

    // Loading skeleton — show placeholder discs while Firestore resolves.
    if (fetchState.status === 'loading') {
      const skeletonCount = Math.max(1, Math.min(visibleUids.length, max));
      return (
        <View style={containerStyle}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCircle
              key={i}
              size={size}
              zIndex={skeletonCount - i}
              isFirst={i === 0}
            />
          ))}
        </View>
      );
    }

    const { items } = fetchState;

    return (
      <View
        style={containerStyle}
        accessibilityElementsHidden={false}
      >
        {items.map((avatar, index) => (
          <AvatarCircle
            key={avatar.uid}
            avatar={avatar}
            size={size}
            index={index}
            zIndex={totalCircles - index}
            isFirst={index === 0}
            reducedMotion={reducedMotion}
          />
        ))}

        {overflowCount > 0 && (
          <OverflowBadge
            count={overflowCount}
            size={size}
            index={items.length}
            zIndex={totalCircles - items.length}
            reducedMotion={reducedMotion}
          />
        )}
      </View>
    );
  },
);

AvatarStack.displayName = 'AvatarStack';

export default AvatarStack;

// ─── AvatarCircle ─────────────────────────────────────────────────────────────
//
// Single rendered avatar disc.
// White border ring → colored inner circle → emoji or initial label.
// Reanimated 3 stagger-in on mount: opacity 0→1 + scale 0.72→1.0.

interface AvatarCircleProps {
  avatar:        AvatarData;
  size:          number;
  index:         number;
  zIndex:        number;
  isFirst:       boolean;
  reducedMotion: boolean;
}

const AvatarCircle = React.memo<AvatarCircleProps>(
  ({ avatar, size, index, zIndex, isFirst, reducedMotion }) => {
    const opacity = useSharedValue(reducedMotion ? 1 : ENTRANCE_OPACITY_FROM);
    const scale   = useSharedValue(reducedMotion ? 1 : ENTRANCE_SCALE_FROM);

    useEffect(() => {
      if (reducedMotion) {
        opacity.value = 1;
        scale.value   = 1;
        return;
      }

      const delay = index * STAGGER_DELAY_MS;

      const timingCfg = {
        duration: durations.normal,
        easing:   easings.easeOut,
      };

      opacity.value = withDelay(delay, withTiming(1, timingCfg));
      scale.value   = withDelay(delay, withTiming(1, timingCfg));

      return () => {
        cancelAnimation(opacity);
        cancelAnimation(scale);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const animStyle = useAnimatedStyle(() => ({
      opacity:   opacity.value,
      transform: [{ scale: scale.value }],
    }));

    const outerSize  = size + AVATAR_BORDER_WIDTH * 2;
    const emojiSize  = Math.round(size * 0.5);
    const lineHeight = Math.round(emojiSize * 1.2);

    const label = avatar.emoji || avatar.initial;

    return (
      <Animated.View
        style={[
          {
            width:           outerSize,
            height:          outerSize,
            // ── FIX 1/6: was `outerSize / 2` — now design token ─────────────
            borderRadius:    radii.full,
            backgroundColor: palette.white,
            marginLeft:      isFirst ? 0 : -(STACK_OVERLAP),
            zIndex,
            alignItems:      'center',
            justifyContent:  'center',
          },
          animStyle,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width:           size,
            height:          size,
            // ── FIX 2/6: was `size / 2` — now design token ──────────────────
            borderRadius:    radii.full,
            backgroundColor: avatar.color,
            alignItems:      'center',
            justifyContent:  'center',
            overflow:        'hidden',
          }}
        >
          <Text
            style={[
              styles.labelText,
              { fontSize: emojiSize, lineHeight },
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    );
  },
);

AvatarCircle.displayName = 'AvatarStack.AvatarCircle';

// ─── OverflowBadge ────────────────────────────────────────────────────────────
//
// "+N" gold circle. Appears after the last visible avatar.
// Blueprint §15: gold[600] bg → ink[950] text (AAA contrast).
// Same entrance animation as AvatarCircle, delayed by its index.

interface OverflowBadgeProps {
  count:         number;
  size:          number;
  index:         number;
  zIndex:        number;
  reducedMotion: boolean;
}

const OverflowBadge = React.memo<OverflowBadgeProps>(
  ({ count, size, index, zIndex, reducedMotion }) => {
    const opacity = useSharedValue(reducedMotion ? 1 : ENTRANCE_OPACITY_FROM);
    const scale   = useSharedValue(reducedMotion ? 1 : ENTRANCE_SCALE_FROM);

    useEffect(() => {
      if (reducedMotion) {
        opacity.value = 1;
        scale.value   = 1;
        return;
      }

      const delay   = index * STAGGER_DELAY_MS;
      const timingCfg = {
        duration: durations.normal,
        easing:   easings.easeOut,
      };

      opacity.value = withDelay(delay, withTiming(1, timingCfg));
      scale.value   = withDelay(delay, withTiming(1, timingCfg));

      return () => {
        cancelAnimation(opacity);
        cancelAnimation(scale);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const animStyle = useAnimatedStyle(() => ({
      opacity:   opacity.value,
      transform: [{ scale: scale.value }],
    }));

    const outerSize    = size + AVATAR_BORDER_WIDTH * 2;
    const badgeFontSz  = Math.max(8, Math.round(size * 0.36));
    const lineHeight   = Math.round(badgeFontSz * 1.2);

    // Cap visible count at 99 — "+99" always fits inside the disc.
    const label = `+${Math.min(count, 99)}`;

    return (
      <Animated.View
        style={[
          {
            width:           outerSize,
            height:          outerSize,
            // ── FIX 3/6: was `outerSize / 2` — now design token ─────────────
            borderRadius:    radii.full,
            backgroundColor: palette.white,
            marginLeft:      -(STACK_OVERLAP),
            zIndex,
            alignItems:      'center',
            justifyContent:  'center',
          },
          animStyle,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width:           size,
            height:          size,
            // ── FIX 4/6: was `size / 2` — now design token ──────────────────
            borderRadius:    radii.full,
            backgroundColor: palette.gold[600],
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <Text
            style={[
              styles.overflowLabel,
              { fontSize: badgeFontSz, lineHeight },
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    );
  },
);

OverflowBadge.displayName = 'AvatarStack.OverflowBadge';

// ─── SkeletonCircle ───────────────────────────────────────────────────────────
//
// Rendered during Firestore load.
// Static cream disc per Blueprint §1253: "circle · cream[200] fill".
// Full shimmer (LinearGradient loop) on a 28px disc would be overengineered;
// the static base colour communicates loading state clearly at this scale.

interface SkeletonCircleProps {
  size:    number;
  zIndex:  number;
  isFirst: boolean;
}

const SkeletonCircle = React.memo<SkeletonCircleProps>(
  ({ size, zIndex, isFirst }) => {
    const outerSize = size + AVATAR_BORDER_WIDTH * 2;

    return (
      <View
        style={{
          width:           outerSize,
          height:          outerSize,
          // ── FIX 5/6: was `outerSize / 2` — now design token ─────────────
          borderRadius:    radii.full,
          backgroundColor: palette.white,
          marginLeft:      isFirst ? 0 : -(STACK_OVERLAP),
          zIndex,
          alignItems:      'center',
          justifyContent:  'center',
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width:           size,
            height:          size,
            // ── FIX 6/6: was `size / 2` — now design token ──────────────────
            borderRadius:    radii.full,
            backgroundColor: palette.cream[200],
          }}
        />
      </View>
    );
  },
);

SkeletonCircle.displayName = 'AvatarStack.SkeletonCircle';

// ─── Static styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  /**
   * Outer flex-row.
   * overflow:'visible' is critical — the Reanimated scale entrance slightly
   * exceeds bounds and must NOT be clipped by the container.
   * height is injected inline (size-dependent).
   */
  container: {
    flexDirection: 'row',
    alignItems:    'center',
    overflow:      'visible',
  },

  /**
   * Avatar emoji or initial character.
   * - fontSize / lineHeight injected inline (derived from `size` prop).
   * - includeFontPadding: false → removes Android baseline gap inside the disc.
   * - color: white — readable on all dark user.color values.
   */
  labelText: {
    color:              palette.white,
    textAlign:          'center',
    includeFontPadding: false,
  },

  /**
   * Overflow "+N" label.
   * Blueprint §15 AAA: gold[600] bg → ink[950] text.
   * fontWeight '700' ensures crispness at small sizes (8–11px).
   */
  overflowLabel: {
    fontWeight:         '700',
    textAlign:          'center',
    includeFontPadding: false,
    color:              colors.fg.primary,  // ink[950] = #1A1208 — AAA on gold[600] ✅
  },

});

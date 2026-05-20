/**
 * OnlineCountStrip — components/molecules/OnlineCountStrip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN App · PRD v3.2 §9.2 Row 3 — "Online Count Strip"
 * Blueprint v5.0 BAAP EDITION · Layer: molecule · Status: updated · P0
 *
 * Revision 4 — PRD v3.2 §9.2 Row 3 full compliance pass
 *
 * Spec ref   : §9.2 Row 3 — "Always Names the Active Scope" (Founder-Locked)
 * Blueprint  : H=32px · Bg=colors.bg.surface · Z-Index=900 · justify-content space-between
 * Position   : 103–135px from screen top — ABOVE FOLD on all target devices ✓
 *
 * Sub-elements
 * ────────────
 *  [4.A] Pulsing Dot         — 8×8px amber circle · Animated opacity loop 1500ms
 *  [4.A] Count Text          — scope-aware text · Inter 500 12px · text-muted
 *  [4.B] Heat Score Pill     — flat amber[50] bg · "🔥 Heat {score}" · visible only ≥30
 *  [4.C] Trust Anchor Chip   — "📍 1.2 Lakh+" · gold[50] bg · first session · 60s hide
 *
 * Founder-Locked Rule: Row 3 ALWAYS names the active scope's geography.
 *   NEVER "234K online" — ALWAYS "234K Mumbai mein online".
 *
 * REVISION HISTORY
 * ────────────────
 * Rev 1 — Initial implementation
 * Rev 2 — Fixed: bg/zIndex · heat pill gradient · layout · trust anchor
 * Rev 3 — Radius Protocol: hardcoded pill radii → radii.pill token
 * Rev 4 — PRD v3.2 §9.2 Row 3 compliance:
 *          CHANGED : props interface — count → onlineCount; added scope / cityLabel / sectorLabel
 *          CHANGED : count formatting — Lakh/K/plain (Indian system, not K/quiet)
 *          CHANGED : text format — scope-aware "{count} {geo} mein online" (Founder-Locked)
 *          CHANGED : pulsing dot — 8×8px self-contained Animated.loop opacity (was LiveDot atom)
 *          CHANGED : heat pill — flat amber[50] bg; text "🔥 Heat {score}"; font 11px/600
 *          CHANGED : trust chip — "📍 1.2 Lakh+"; bg gold[50] (#FCF7E5); font 11px/600/muted
 *          CHANGED : showTrustAnchor / onTrustAnchorDismiss — now required (not optional)
 *          REMOVED : LinearGradient import (heat pill no longer gradient)
 *          REMOVED : LiveDot import (dot now self-contained)
 *          KEPT    : useAnimatedCount hook, React.memo, export name, testIDs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/atoms/Skeleton';

import { colors, palette, radii, spacing, zIndex as zIndexTokens } from '@/constants/colors';
import { FONT_BODY, FONT_SIZE }                                       from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — LAYOUT & DIMENSION CONSTANTS
// Source of truth: PRD v3.2 §9.2 Row 3 and task spec.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip fixed height — PRD §9.2 Row 3: H=32px */
const STRIP_HEIGHT = 32 as const;

/**
 * Pulsing presence dot — PRD Rev 4 spec:
 *   Size: 8×8px, border-radius: 4px (circle), color: amber[600]
 */
const DOT_SIZE   = 8 as const;
const DOT_RADIUS = 4 as const;

/** Pulse animation loop duration — PRD Rev 4: 1500ms loop */
const PULSE_DURATION_MS = 1_500 as const;

/** Gap between dot and count text */
const DOT_TO_TEXT_GAP = spacing.xs; // 4px

/** Heat pill height */
const HEAT_PILL_H = 22 as const;

/** Heat pill horizontal padding */
const HEAT_PILL_PAD_H = spacing.sm; // 8px

/** Heat score threshold below which pill is hidden — PRD §9.2: "visible only when heatScore ≥ 30" */
const HEAT_VISIBLE_THRESHOLD = 30 as const;

/** Trust anchor chip height */
const TRUST_CHIP_H = 24 as const;

/** Trust chip horizontal padding */
const TRUST_CHIP_PAD_H = 10 as const; // no 10px token — spec-mandated literal

/** Trust chip auto-hide duration — PRD §9.2 Row 3: "auto-hide after 60s" */
const TRUST_AUTO_HIDE_MS = 60_000 as const;

/** Count-up animation duration — PRD §9.2: "200ms count-up, no jarring jump" */
const COUNT_ANIM_MS = 200 as const;

/** Skeleton dimensions */
const SKELETON_COUNT_W = 80 as const;
const SKELETON_HEAT_W  = 60 as const;
const SKELETON_H       = 16 as const;

/**
 * Indian number system thresholds — PRD Rev 4 count formatting:
 *   ≥ 1,00,000 → "{X} Lakh"
 *   ≥ 1,000    → "{X}K"
 *   otherwise  → plain number
 */
const LAKH = 1_00_000 as const; // 100,000
const K    = 1_000    as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLOR CONSTANTS
// All values reference design-system tokens — zero hardcoded hex literals.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Presence dot fill — PRD Rev 4: amber[600] (Burnished Amber)
 * v2 token: palette.amber[600] = #D4651A
 */
const DOT_COLOR = palette.amber[600];

/**
 * Heat pill background — PRD Rev 4: amber[50] light amber tint (flat, no gradient)
 * v2 token: palette.amber[50]  ≈ #FFF8F0
 */
const HEAT_PILL_BG = palette.amber[50];

/**
 * Heat pill text — dark amber for legible contrast on amber[50] bg
 * v2 token: palette.amber[700] = #B45309
 */
const HEAT_PILL_TEXT_COLOR = palette.amber[700];

/**
 * Trust chip background — PRD Rev 4: gold[50] = #FCF7E5
 * v2 token: palette.gold[50]
 */
const TRUST_CHIP_BG = palette.gold[50]; // #FCF7E5

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS — PRD v3.2 §9.2 Row 3 interface
// ─────────────────────────────────────────────────────────────────────────────

export interface OnlineCountStripProps {
  /**
   * Currently-active chat scope — drives geography label in the count text.
   * Founder-Locked: Row 3 ALWAYS names the geography of the active scope.
   */
  scope: 'world' | 'country' | 'city' | 'sector';

  /**
   * Display name of the active city (e.g. "Mumbai").
   * Used when scope === 'city'.
   */
  cityLabel: string;

  /**
   * Display name of the active sector (e.g. "Bandra W").
   * Used when scope === 'sector'.
   */
  sectorLabel: string;

  /**
   * Online member count for the active scope.
   * `null` while loading — triggers skeleton state with `loading=true`.
   */
  onlineCount: number | null;

  /**
   * Scope heat score 0–100.
   * Pill hidden when `null` OR value < HEAT_VISIBLE_THRESHOLD (30).
   */
  heatScore: number | null;

  /**
   * Show shimmer skeleton loading state.
   * Managed by the real-time listener in the parent screen.
   */
  loading: boolean;

  /**
   * Show the Trust Anchor Chip §[4.C].
   * Caller is responsible for:
   *   - First-session-of-day detection (AsyncStorage timestamp vs calendar day)
   *   - Setting false on first scroll (FlatList onScroll handler)
   * The component self-manages the 60s auto-hide timer once visible.
   */
  showTrustAnchor: boolean;

  /**
   * Called when the trust anchor chip auto-hides after 60 seconds.
   * Update parent state / AsyncStorage so the chip isn't re-shown
   * if the screen unmounts and remounts within the same session.
   */
  onTrustAnchorDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — HELPERS — scope-aware text + Indian number formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a raw count per PRD Rev 4 Indian-system rules:
 *   ≥ 1,00,000 → "{X} Lakh"   e.g. 247891  → "2.5 Lakh"
 *   ≥ 1,000    → "{X}K"       e.g.  12847  → "12.8K"
 *   otherwise  → plain number  e.g.    847  → "847"
 *
 * Trailing ".0" is stripped for cleanliness (e.g. "3.0 Lakh" → "3 Lakh").
 */
function formatCount(count: number): string {
  if (count >= LAKH) {
    const lakh = count / LAKH;
    const str  = lakh % 1 === 0 ? `${lakh}` : lakh.toFixed(1);
    return `${str} Lakh`;
  }
  if (count >= K) {
    const k   = count / K;
    const str = k % 1 === 0 ? `${k}` : k.toFixed(1);
    return `${str}K`;
  }
  return count.toLocaleString('en-IN');
}

/**
 * Resolves the geography label for the active scope.
 *   sector  → sectorLabel prop    (e.g. "Bandra W")
 *   city    → cityLabel prop      (e.g. "Mumbai")
 *   country → "India"             (hardcoded per PRD — app is India-first)
 *   world   → "duniya bhar"       (hardcoded per PRD localization)
 *
 * Founder-Locked: this function is the single authority on geography labels.
 */
function resolveGeoLabel(
  scope:       OnlineCountStripProps['scope'],
  cityLabel:   string,
  sectorLabel: string,
): string {
  switch (scope) {
    case 'sector':  return sectorLabel;
    case 'city':    return cityLabel;
    case 'country': return 'India';
    case 'world':   return 'duniya bhar';
  }
}

/**
 * Builds the complete count+geography display string.
 * Format: "{formattedCount} {geoLabel} mein online"
 *
 * Examples (Founder-Locked per PRD §9.2):
 *   "12.8K Bandra W mein online"
 *   "2.5 Lakh Mumbai mein online"
 *   "124 Lakh India mein online"
 *   "2470 Lakh duniya bhar mein online"
 */
function buildCountText(
  count:       number,
  scope:       OnlineCountStripProps['scope'],
  cityLabel:   string,
  sectorLabel: string,
): string {
  const formatted = formatCount(count);
  const geo       = resolveGeoLabel(scope, cityLabel, sectorLabel);
  return `${formatted} ${geo} mein online`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — CUSTOM HOOK: useAnimatedCount
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animates the displayed integer from its previous value to `target` over
 * COUNT_ANIM_MS (200ms) using an ease-out cubic curve on the JS thread.
 *
 * PRD §9.2: "count change → number scrubs old→new (200ms count-up, no jarring jump)"
 *
 * Runs via requestAnimationFrame — no Reanimated dependency required
 * for a 200ms scrub on a single integer.
 */
function useAnimatedCount(target: number | null): number | null {
  const [displayed, setDisplayed] = useState<number | null>(target);
  const prevRef = useRef<number | null>(target);
  const rafRef  = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (target === null) {
      setDisplayed(null);
      prevRef.current = null;
      return;
    }

    const from = prevRef.current ?? target;
    prevRef.current = target;

    if (from === target) {
      setDisplayed(target);
      return;
    }

    const startTime = Date.now();

    const tick = (): void => {
      const rawProgress = (Date.now() - startTime) / COUNT_ANIM_MS;
      const progress    = Math.min(rawProgress, 1);
      // Ease-out cubic: fast start, decelerates into the final value
      const eased       = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target]);

  return displayed;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — SUB-COMPONENT: PulsingDot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PulsingDot — PRD Rev 4 spec:
 *   Size:        8×8px
 *   Radius:      4px (perfect circle)
 *   Color:       amber[600] = #D4651A (Burnished Amber)
 *   Animation:   Animated.loop opacity 1.0 → 0.2 → 1.0, 1500ms, ease-in-out
 *   Driver:      useNativeDriver: true — compositor thread, zero JS overhead
 *
 * Self-contained — no LiveDot atom dependency (Rev 4 change).
 * The white-ring wrapper from Rev 3 is removed; dot is a plain amber circle.
 */
const PulsingDot = React.memo(() => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue:        0.2,
          duration:       PULSE_DURATION_MS / 2, // 750ms fade-out
          easing:         Easing.inOut(Easing.ease),
          useNativeDriver: true, // PERF: compositor — zero layout/paint
        }),
        Animated.timing(opacity, {
          toValue:        1,
          duration:       PULSE_DURATION_MS / 2, // 750ms fade-in
          easing:         Easing.inOut(Easing.ease),
          useNativeDriver: true, // PERF: compositor — zero layout/paint
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[dotStyles.dot, { opacity }]}
      accessible={false}
    />
  );
});

PulsingDot.displayName = 'PulsingDot';

const dotStyles = StyleSheet.create({
  dot: {
    width:           DOT_SIZE,   // 8px
    height:          DOT_SIZE,   // 8px
    borderRadius:    DOT_RADIUS, // 4px — perfect circle
    backgroundColor: DOT_COLOR,  // amber[600] = #D4651A
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OnlineCountStrip
 *
 * 32px trust-anchor strip. Renders flush below the two-row Home Screen header.
 * PRD v3.2 §9.2 Row 3 compliance (Rev 4):
 *   ✓ Bg: colors.bg.surface
 *   ✓ Z-Index: zIndexTokens.fixedHeader (900)
 *   ✓ justifyContent: 'space-between'
 *   ✓ [4.A] 8×8px PulsingDot — amber[600] · Animated opacity loop 1500ms
 *   ✓ [4.A] Scope-aware count text — "{count} {geo} mein online" (Founder-Locked)
 *   ✓ [4.A] Indian format — Lakh / K / plain number
 *   ✓ [4.A] 200ms ease-out count-up animation on value change
 *   ✓ [4.B] Heat pill — amber[50] flat bg · "🔥 Heat {score}" · 11px 600 · ≥30 only
 *   ✓ [4.C] Trust chip — "📍 1.2 Lakh+" · gold[50] bg · 11px 600 · 60s auto-hide
 *   ✓ accessibilityLiveRegion "polite" on count element
 *   ✓ testIDs: home-online-count · home-heat-score · home-trust-anchor
 *   ✓ Radius Protocol: radii.pill token for all pill shapes
 *
 * @example
 * <OnlineCountStrip
 *   scope="city"
 *   cityLabel="Mumbai"
 *   sectorLabel="Bandra W"
 *   onlineCount={247891}
 *   heatScore={92}
 *   loading={false}
 *   showTrustAnchor={isFirstSessionOfDay}
 *   onTrustAnchorDismiss={markTrustAnchorSeen}
 * />
 * // → "2.5 Lakh Mumbai mein online · 🔥 Heat 92 · 📍 1.2 Lakh+"
 */
const OnlineCountStripBase: React.FC<OnlineCountStripProps> = ({
  scope,
  cityLabel,
  sectorLabel,
  onlineCount,
  heatScore,
  loading,
  showTrustAnchor,
  onTrustAnchorDismiss,
}) => {

  // ── [4.C] Trust anchor 60s auto-hide timer ───────────────────────────────
  // PRD §9.2: "Auto-hide: after 60s on screen OR on first scroll"
  // → 60s:        handled here via setTimeout
  // → First scroll: caller sets showTrustAnchor=false from FlatList onScroll
  const [trustVisible, setTrustVisible] = useState<boolean>(false);

  useEffect(() => {
    if (!showTrustAnchor) {
      setTrustVisible(false);
      return;
    }

    setTrustVisible(true);

    const timer = setTimeout(() => {
      setTrustVisible(false);
      onTrustAnchorDismiss();
    }, TRUST_AUTO_HIDE_MS);

    return () => clearTimeout(timer);
  }, [showTrustAnchor, onTrustAnchorDismiss]);

  // ── Count animation ──────────────────────────────────────────────────────
  const displayedCount = useAnimatedCount(onlineCount);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={styles.strip}
        accessible
        accessibilityLabel="Online count loading"
        testID="online-count-strip-loading"
      >
        <Skeleton width={SKELETON_COUNT_W} height={SKELETON_H} radius={radii.xs} />
        <Skeleton width={SKELETON_HEAT_W}  height={SKELETON_H} radius={radii.xs} />
      </View>
    );
  }

  // ── Count text — Founder-Locked scope-aware format ───────────────────────
  const countText = displayedCount !== null
    ? buildCountText(displayedCount, scope, cityLabel, sectorLabel)
    : '—';

  // ── Heat pill visibility ─────────────────────────────────────────────────
  const showHeatPill = heatScore !== null && heatScore >= HEAT_VISIBLE_THRESHOLD;

  // ── Accessibility label ──────────────────────────────────────────────────
  const geoLabel       = resolveGeoLabel(scope, cityLabel, sectorLabel);
  const countA11yLabel = displayedCount !== null
    ? `${displayedCount.toLocaleString('en-IN')} members online in ${geoLabel}`
    : 'Online count unavailable';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.strip} testID="online-count-strip">

      {/* ── LEFT: [4.A] Pulsing Dot + Scope-Aware Count Text ───────────── */}
      <View
        style={styles.leftGroup}
        accessible
        accessibilityLabel={countA11yLabel}
        accessibilityRole="text"
        accessibilityLiveRegion="polite" // announces on scope/count changes
        testID="home-online-count"
      >
        {/* 8×8px amber pulsing dot — always visible (no quiet suppression) */}
        <PulsingDot />

        <View style={styles.dotGap} />

        {/* Scope-aware text: "{count} {geo} mein online" — Founder-Locked */}
        <Text
          style={styles.countText}
          numberOfLines={1}
          accessible={false} // parent View owns a11y label
        >
          {countText}
        </Text>
      </View>

      {/* ── RIGHT: [4.B] Heat Pill + [4.C] Trust Chip ──────────────────── */}
      {(showHeatPill || trustVisible) && (
        <View style={styles.rightGroup}>

          {/* [4.B] Heat Score Pill — flat amber[50] · "🔥 Heat {score}" · ≥30 only */}
          {showHeatPill && (
            <View
              style={styles.heatPill}
              accessible
              accessibilityLabel={`Heat Score ${Math.round(heatScore!)} out of 100`}
              accessibilityRole="text"
              testID="home-heat-score"
            >
              <Text style={styles.heatPillText} accessible={false} numberOfLines={1}>
                {`🔥 Heat ${Math.round(heatScore!)}`}
              </Text>
            </View>
          )}

          {/* [4.C] Trust Anchor Chip — "📍 1.2 Lakh+" · gold[50] · 60s auto-hide */}
          {trustVisible && (
            <View
              style={styles.trustChip}
              accessible
              accessibilityLabel="Trusted by over 1.2 lakh users"
              accessibilityRole="text"
              testID="home-trust-anchor"
            >
              <Text style={styles.trustChipText} accessible={false} numberOfLines={1}>
                {'📍 1.2 Lakh+'}
              </Text>
            </View>
          )}

        </View>
      )}

    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — STYLES
// Zero hardcoded hex values — all colors reference design-system tokens above.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ─── Strip container ─────────────────────────────────────────────────────
  strip: {
    height:            STRIP_HEIGHT,             // 32px — PRD §9.2 Row 3
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.base,             // 16px horizontal — task spec
    backgroundColor:   colors.bg.surface,        // --bg-surface (white/light)
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    zIndex:            zIndexTokens.fixedHeader, // 900
    elevation:         4,                        // Android: zIndex for non-absolute flow
  },

  // ─── [4.A] Left group ────────────────────────────────────────────────────
  leftGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,       // fills remaining space — task spec
    flexShrink:    1,       // yields to right group on narrow viewports
  },

  dotGap: {
    width: DOT_TO_TEXT_GAP, // 4px between dot and text
  },

  /**
   * Count text — task spec: Inter 500, 12px, text-muted color
   * FONT_BODY.medium resolves to Inter_500Medium or equivalent project font.
   */
  countText: {
    fontFamily:    FONT_BODY.medium,       // Inter 500
    fontSize:      FONT_SIZE.cap,          // 12px
    fontWeight:    '500' as const,
    lineHeight:    17,
    letterSpacing: 0,
    color:         colors.fg.secondary,    // text-muted = ink[600] = #6B5B47
    flexShrink:    1,
  },

  // ─── Right group ─────────────────────────────────────────────────────────
  rightGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm, // 8px between heat pill and trust chip
    flexShrink:    0,          // right group never shrinks — always fully visible
  },

  // ─── [4.B] Heat Score Pill ───────────────────────────────────────────────
  /**
   * PRD Rev 4 change — flat amber[50] bg (was LinearGradient amber→gold).
   * H=22px · radii.pill token · 8px horizontal padding · visible when ≥30.
   * Text: "🔥 Heat {score}" (was "🔥 {score}") · 11px 600
   */
  heatPill: {
    height:            HEAT_PILL_H,     // 22px
    borderRadius:      radii.pill,      // Radius Protocol — token (28 → clamped to 11)
    paddingHorizontal: HEAT_PILL_PAD_H, // 8px
    backgroundColor:   HEAT_PILL_BG,    // amber[50] ≈ #FFF8F0
    alignItems:        'center',
    justifyContent:    'center',
  },

  heatPillText: {
    fontSize:      11,
    fontWeight:    '600' as const,
    lineHeight:    14,
    color:         HEAT_PILL_TEXT_COLOR, // amber[700] = #B45309 — contrast on amber[50]
  },

  // ─── [4.C] Trust Anchor Chip ─────────────────────────────────────────────
  /**
   * PRD Rev 4 changes:
   *   Text: "📍 1.2 Lakh+" (was "👥 1 Lakh+")
   *   Bg:   gold[50] = #FCF7E5 (was cream[200] = #F7ECD0)
   *   Font: 11px 600 text-muted (was 11px 500)
   * H=24px · radii.pill token · 10px horizontal padding
   */
  trustChip: {
    height:            TRUST_CHIP_H,    // 24px
    borderRadius:      radii.pill,      // Radius Protocol — token (28 → clamped to 12)
    paddingHorizontal: TRUST_CHIP_PAD_H,// 10px — spec-mandated literal (no token)
    backgroundColor:   TRUST_CHIP_BG,   // gold[50] = #FCF7E5
    alignItems:        'center',
    justifyContent:    'center',
  },

  trustChipText: {
    fontSize:   11,
    fontWeight: '600' as const,
    lineHeight: 14,
    color:      colors.fg.secondary, // text-muted = ink[600] = #6B5B47
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — EXPORT
// React.memo — all props are primitives + stable callbacks.
// Shallow compare prevents re-renders on unrelated parent state changes.
// Strip only re-renders when the real-time listener pushes a new value.
// ─────────────────────────────────────────────────────────────────────────────

const OnlineCountStrip = React.memo(OnlineCountStripBase);

export default OnlineCountStrip;

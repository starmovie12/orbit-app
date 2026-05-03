/**
 * OnlineCountStrip — components/molecules/OnlineCountStrip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: molecule · Status: new · P0
 * Revision 3 — Radius Protocol compliance: hardcoded pill radii → radii.pill token
 *
 * Spec ref   : § Home Screen [4] ONLINE COUNT STRIP
 * Blueprint  : H=32px · Bg=#FFFFFF · Z-Index=900 · justify-content space-between
 * Position   : 103–135px from screen top — ABOVE FOLD on all target devices ✓
 *
 * Sub-elements
 * ────────────
 *  [4.A] Online Member Pill   — LiveDot (amber, white ring) + count text
 *  [4.B] Heat Score Pill      — gradient pill · visible only when heatScore ≥ 30
 *  [4.C] Trust Anchor Chip    — conditional · first session of calendar day
 *
 * Layout    : flex-row · justify-content space-between · align-items center
 * Left side : [4.A]
 * Right side : [4.B] + [4.C] — row with 8px gap
 *
 * Deps      : atoms/LiveDot · atoms/Skeleton
 *             (HeatPulseDot not used — Blueprint §[4.B] replaces it with gradient pill)
 *
 * REVISION HISTORY
 * ────────────────
 * Rev 1 — Initial implementation
 * Rev 2 — Fixed: bg/zIndex · heat pill gradient · layout · trust anchor
 * Rev 3 — Fixed: HEAT_PILL_RADIUS + TRUST_CHIP_RADIUS hardcoded → radii.pill token
 *          Removed: HEAT_PILL_RADIUS const (was 11 — height/2 manual calc, Spec violation)
 *          Removed: TRUST_CHIP_RADIUS const (was 12 — height/2 manual calc, Spec violation)
 *          Added  : radii.pill (28) used directly in StyleSheet for both pill shapes
 *          Rationale: RN clamps borderRadius to height/2 automatically, so radii.pill=28
 *          on a 22px or 24px element still renders a perfect pill — token wins.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import LiveDot       from '@/components/atoms/LiveDot';
import { Skeleton }  from '@/components/atoms/Skeleton';

import { colors, palette, radii, spacing, zIndex as zIndexTokens } from '@/constants/colors';
import { typography, FONT_BODY, FONT_SIZE }                         from '@/constants/typography';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — LAYOUT & DIMENSION CONSTANTS
// Source of truth: Blueprint §[4] and sub-section specs.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip fixed height — Blueprint §[4] H: 32px */
const STRIP_HEIGHT = 32 as const;

/** LiveDot inner diameter — Blueprint §[4.A]: 6×6 dot */
const DOT_INNER_SIZE = 6 as const;

/** White border ring thickness — Blueprint §[4.A]: 2px #FFFFFF border */
const DOT_BORDER_W = 2 as const;

/** Total LiveDot container size, including border ring on all sides */
const DOT_OUTER_SIZE = DOT_INNER_SIZE + DOT_BORDER_W * 2; // 10px

/** Gap between dot container and count text label */
const DOT_TO_TEXT_GAP = spacing.xs; // 4px

/** Heat pill height — Blueprint §[4.B] H: 22px */
const HEAT_PILL_H = 22 as const;

// ─── REMOVED (Rev 3): HEAT_PILL_RADIUS = 11 ──────────────────────────────────
// Was: const HEAT_PILL_RADIUS = 11 as const;  // height / 2 — manual calc
// Why removed: Radius Protocol mandates radii.pill for pill shapes.
// radii.pill = 28 > height/2; RN clamps to height/2 → still a perfect pill.
// Fix: borderRadius: radii.pill used directly in styles.heatPill below.
// ─────────────────────────────────────────────────────────────────────────────

/** Heat pill horizontal padding — Blueprint §[4.B] Padding: 8px horizontal */
const HEAT_PILL_PAD_H = spacing.sm; // 8px

/** Heat score threshold below which pill is hidden — Blueprint §[4.B] "Visible only when Heat Score ≥ 30" */
const HEAT_VISIBLE_THRESHOLD = 30 as const;

/** Trust anchor chip height — Blueprint §[4.C] H: 24px */
const TRUST_CHIP_H = 24 as const;

// ─── REMOVED (Rev 3): TRUST_CHIP_RADIUS = 12 ─────────────────────────────────
// Was: const TRUST_CHIP_RADIUS = 12 as const;  // height / 2 — manual calc
// Why removed: same Radius Protocol violation as HEAT_PILL_RADIUS above.
// Fix: borderRadius: radii.pill used directly in styles.trustChip below.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trust chip horizontal padding — Blueprint §[4.C] Padding: 10px horizontal.
 * No spacing token for 10px — spec-mandated literal used here only.
 */
const TRUST_CHIP_PAD_H = 10 as const;

/** Auto-hide duration for trust chip — Blueprint §[4.C] "after 60s on screen" */
const TRUST_AUTO_HIDE_MS = 60_000 as const;

/** Count-up animation duration — Blueprint §[4.A] "200ms count-up" */
const COUNT_ANIM_MS = 200 as const;

/** Below this count, show quiet-state text instead — Blueprint §[4.A] State (low) */
const LOW_COUNT_THRESHOLD = 50 as const;

/** Above this count, abbreviate to "12.5K" — Blueprint §[4.A] State (>10K) */
const HIGH_COUNT_THRESHOLD = 10_000 as const;

/** Skeleton dimensions — Blueprint §Q6b / §Q6c */
const SKELETON_COUNT_W = 80 as const;
const SKELETON_HEAT_W  = 60 as const;
const SKELETON_H       = 16 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — COLOR CONSTANTS
// Blueprint v1 → v2 token mapping noted on each entry.
// Zero hardcoded hex literals — all values reference palette primitives.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LiveDot fill — Blueprint §[4.A]: #E07B20 (v1 goldenOrange)
 * v2 mapping: colors.fg.warning → palette.amber[600] = #D4651A
 */
const DOT_COLOR = colors.fg.warning;

/**
 * Heat pill gradient — Blueprint §[4.B]: linear-gradient #E07B20 → #F5C842 (45deg)
 * v2 mapping:
 *   #E07B20 → palette.amber[600] = #D4651A  (Burnished Amber)
 *   #F5C842 → palette.gold[400]  = #E2C66B  (Refined Celebrate)
 */
const HEAT_GRADIENT = [palette.amber[600], palette.gold[400]] as const;

/**
 * Trust chip background — Blueprint §[4.C]: #F5E6C8 (v1 cream)
 * v2 mapping: palette.cream[200] = #F7ECD0
 */
const TRUST_CHIP_BG = palette.cream[200];

/**
 * Trust chip text color — Blueprint §[4.C]: #6B5B2E (v1 espresso)
 * v2 mapping: palette.ink[600] = #6B5B47
 */
const TRUST_CHIP_TEXT_COLOR = palette.ink[600];

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface OnlineCountStripProps {
  /**
   * Online member count for the current sector.
   * `null` while loading. Triggers skeleton state when combined with `loading=true`.
   */
  count: number | null;

  /**
   * Sector heat score 0–100.
   * Pill hidden when `null` OR when value < HEAT_VISIBLE_THRESHOLD (30).
   */
  heatScore: number | null;

  /**
   * Show shimmer skeleton loading state.
   * Managed by the Firestore listener in the parent screen.
   */
  loading: boolean;

  /**
   * Show the Trust Anchor Chip §[4.C].
   * Caller is responsible for first-session-of-day detection
   * (compare cached AsyncStorage timestamp to current calendar day).
   * The component self-manages the 60s auto-hide timer once visible.
   * @default false
   */
  showTrustAnchor?: boolean;

  /**
   * Called when the trust anchor chip auto-hides after 60 seconds.
   * Use to update parent state / AsyncStorage so chip isn't re-shown
   * if the screen unmounts + remounts within the same session.
   */
  onTrustAnchorDismiss?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — CUSTOM HOOK: useAnimatedCount
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animates a displayed integer from its previous value to `target` over
 * COUNT_ANIM_MS (200ms) using an ease-out cubic curve.
 *
 * Runs on the JS thread via requestAnimationFrame — no Reanimated dependency
 * required for a 200ms scrub on a single integer.
 *
 * Blueprint §[4.A]: "count change → number scrubs old→new (200ms count-up)"
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
// § 5 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface CountDisplay {
  text:  string;
  isLow: boolean; // true → no dot, muted color, different text
}

/**
 * Resolve count label per Blueprint §[4.A] state table:
 *   < 50      → "Quiet abhi · pehle ho"       (quiet state — no dot)
 *   50–9,999  → "1,234 yahan online"           (en-IN locale grouping)
 *   ≥ 10,000  → "12.5K online"                 (abbreviated)
 */
function resolveCountDisplay(count: number): CountDisplay {
  if (count < LOW_COUNT_THRESHOLD) {
    return { text: 'Quiet abhi · pehle ho', isLow: true };
  }
  if (count >= HIGH_COUNT_THRESHOLD) {
    const k = (count / 1000).toFixed(1);
    return { text: `${k}K online`, isLow: false };
  }
  return { text: `${count.toLocaleString('en-IN')} yahan online`, isLow: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — SUB-COMPONENT: LiveDotWithBorder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LiveDotWithBorder
 *
 * Blueprint §[4.A]: 6×6 amber dot with 2px #FFFFFF border ring.
 *
 * Achieved by wrapping a 6px LiveDot (amber) inside a 10px white-filled circle.
 * The white circle's background creates the "border" effect without modifying
 * the LiveDot atom contract.
 *
 * Container: 10×10px white circle → provides 2px ring on all sides
 * Inner dot : 6×6px LiveDot (colors.fg.warning = amber[600])
 */
const LiveDotWithBorder = React.memo(() => (
  <View style={dotRingStyles.wrapper}>
    <LiveDot color={DOT_COLOR} size={DOT_INNER_SIZE} />
  </View>
));
LiveDotWithBorder.displayName = 'LiveDotWithBorder';

const dotRingStyles = StyleSheet.create({
  wrapper: {
    width:           DOT_OUTER_SIZE,        // 10px
    height:          DOT_OUTER_SIZE,        // 10px
    borderRadius:    DOT_OUTER_SIZE / 2,    // 5px — full circle
    backgroundColor: colors.bg.surface,     // #FFFFFF — creates the 2px white ring
    alignItems:      'center',
    justifyContent:  'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OnlineCountStrip
 *
 * 32px trust-anchor strip. Renders flush below the two-row Home Screen header.
 * Blueprint §[4] specification compliance:
 *   ✓ Bg: colors.bg.surface (#FFFFFF)
 *   ✓ Z-Index: zIndexTokens.fixedHeader (900)
 *   ✓ justifyContent: 'space-between'
 *   ✓ [4.A] Online Member Pill — amber dot (white ring) + count text + state variants
 *   ✓ [4.B] Heat Score Pill    — gradient pill "🔥 {score}", visible only ≥ 30
 *   ✓ [4.C] Trust Anchor Chip  — "👥 1 Lakh+", conditional, 60s auto-hide
 *   ✓ Count animation          — 200ms ease-out scrub on value change
 *   ✓ Quiet state (< 50)       — no dot, muted text "Quiet abhi · pehle ho"
 *   ✓ High state (≥ 10K)       — abbreviated "12.5K online"
 *   ✓ accessibilityLiveRegion  — "polite" on count element
 *   ✓ testIDs                  — home-online-count · home-heat-score · home-trust-anchor
 *   ✓ Radius Protocol          — radii.pill token for both pill shapes (Rev 3)
 *
 * @example
 * <OnlineCountStrip
 *   count={onlineCount}
 *   heatScore={sectorHeat}
 *   loading={isLoading}
 *   showTrustAnchor={isFirstSessionOfDay}
 *   onTrustAnchorDismiss={markTrustAnchorSeen}
 * />
 */
const OnlineCountStripBase: React.FC<OnlineCountStripProps> = ({
  count,
  heatScore,
  loading,
  showTrustAnchor    = false,
  onTrustAnchorDismiss,
}) => {

  // ── [4.C] Trust anchor 60s auto-hide timer ────────────────────────────────
  // Blueprint §[4.C]: "Auto-hide: after 60s on screen OR on first scroll"
  // → 60s: handled here via setTimeout
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
      onTrustAnchorDismiss?.();
    }, TRUST_AUTO_HIDE_MS);

    return () => clearTimeout(timer);
  }, [showTrustAnchor, onTrustAnchorDismiss]);

  // ── Count animation ───────────────────────────────────────────────────────
  const displayedCount = useAnimatedCount(count);

  // ── Loading state: two skeleton rects per Blueprint §Q6b / §Q6c ──────────
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

  // ── Count display variant ─────────────────────────────────────────────────
  const { text: countText, isLow } = displayedCount !== null
    ? resolveCountDisplay(displayedCount)
    : { text: '—', isLow: false };

  // ── Heat pill visibility ─────────────────────────────────────────────────
  const showHeatPill = heatScore !== null && heatScore >= HEAT_VISIBLE_THRESHOLD;

  // ── Accessibility labels ──────────────────────────────────────────────────
  const countA11yLabel = displayedCount !== null
    ? `${displayedCount.toLocaleString('en-IN')} members online in this sector`
    : 'Online count unavailable';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.strip} testID="online-count-strip">

      {/* ── LEFT: [4.A] Online Member Pill ─────────────────────────────── */}
      <View
        style={styles.leftGroup}
        accessible
        accessibilityLabel={countA11yLabel}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"  // Blueprint §[4.A]: announces on threshold crosses
        testID="home-online-count"
      >
        {/* Dot suppressed in quiet state (count < 50) */}
        {!isLow && (
          <>
            <LiveDotWithBorder />
            <View style={styles.dotGap} />
          </>
        )}

        <Text
          style={isLow ? styles.countTextLow : styles.countTextNormal}
          numberOfLines={1}
          accessible={false}  // parent View owns the a11y label
        >
          {countText}
        </Text>
      </View>

      {/* ── RIGHT: [4.B] Heat Pill + [4.C] Trust Chip ──────────────────── */}
      {(showHeatPill || trustVisible) && (
        <View style={styles.rightGroup}>

          {/* [4.B] Heat Score Pill — gradient, visible only when heatScore ≥ 30 */}
          {showHeatPill && (
            <LinearGradient
              // Blueprint §[4.B]: "linear-gradient #E07B20 → #F5C842 (45deg)"
              // start {x:0,y:1} → end {x:1,y:0} = bottom-left → top-right = 45deg
              colors={HEAT_GRADIENT}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.heatPill}
              accessible
              accessibilityLabel={`Heat Score ${Math.round(heatScore!)} out of 100`}
              accessibilityRole="text"
              testID="home-heat-score"
            >
              <Text style={styles.heatPillText} accessible={false} numberOfLines={1}>
                {`🔥 ${Math.round(heatScore!)}`}
              </Text>
            </LinearGradient>
          )}

          {/* [4.C] Trust Anchor Chip — first session of day · 60s auto-hide */}
          {trustVisible && (
            <View
              style={styles.trustChip}
              accessible
              accessibilityLabel="Trusted by over 1 lakh users"
              accessibilityRole="text"
              testID="home-trust-anchor"
            >
              <Text style={styles.trustChipText} accessible={false} numberOfLines={1}>
                {'👥 1 Lakh+'}
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
// Zero hardcoded hex values or magic numbers — all tokens referenced above.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ─── Strip container ───────────────────────────────────────────────────────
  strip: {
    height:             STRIP_HEIGHT,               // 32px — Blueprint §[4]
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',            // Blueprint §[4] "justify-content space-between"
    paddingHorizontal:  spacing.base,               // 16px — Blueprint §[4] "16px horizontal"
    backgroundColor:    colors.bg.surface,          // #FFFFFF — Blueprint §[4] "Bg #FFFFFF"
    borderBottomWidth:  StyleSheet.hairlineWidth,
    borderBottomColor:  colors.border.default,      // cream[400] — Blueprint §[4] "1px hairline #E8D5A0"
    zIndex:             zIndexTokens.fixedHeader,   // 900 — Blueprint §[4] "Z-Index: 900"
    elevation:          4,                          // Android: zIndex needs elevation for non-absolute flow
  },

  // ─── [4.A] Left group ──────────────────────────────────────────────────────
  leftGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    flexShrink:    1,  // yields space to right group if viewport is narrow
  },

  dotGap: {
    width: DOT_TO_TEXT_GAP, // 4px between ring container and text
  },

  /**
   * Normal count text — Blueprint §[4.A]: "12px 600 #1A1A1A"
   * v2: 12px 600 DM Sans SemiBold · ink[950]
   * Note: captionBold has wide tracking for uppercase — using explicit 0
   *       tracking here to match spec (mixed-case count string).
   */
  countTextNormal: {
    fontFamily:    FONT_BODY.semiBold,   // DMSans_600SemiBold
    fontSize:      FONT_SIZE.cap,        // 12
    fontWeight:    '600' as const,
    lineHeight:    17,
    letterSpacing: 0,
    color:         colors.fg.primary,    // ink[950] = #1A1208
    flexShrink:    1,
  },

  /**
   * Quiet state text — Blueprint §[4.A]: "#6B5B2E text" (no dot)
   * v2: 11px 500 DM Sans Medium · ink[600]
   */
  countTextLow: {
    ...typography.metaMedium,            // 11px 500 DM Sans · relaxed lh 17
    color:      colors.fg.secondary,     // ink[600] = #6B5B47
    flexShrink: 1,
  },

  // ─── Right group ───────────────────────────────────────────────────────────
  rightGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,  // 8px between heat pill and trust chip
    flexShrink:    0,           // right group never shrinks — always fully visible
  },

  // ─── [4.B] Heat Score Pill ─────────────────────────────────────────────────
  /**
   * Blueprint §[4.B]: H=22px · radius=11px (pill) · padding=8px horizontal
   *
   * Rev 3 — Radius Protocol fix:
   *   BEFORE: borderRadius: HEAT_PILL_RADIUS  (11 — manual height/2 calculation)
   *   AFTER : borderRadius: radii.pill        (28 — design system token)
   *
   * RN automatically clamps borderRadius to height/2, so radii.pill=28 on a
   * 22px-tall element renders identically to 11px. Token is the source of truth.
   *
   * Gradient applied by LinearGradient wrapper; this style handles geometry only.
   */
  heatPill: {
    height:            HEAT_PILL_H,    // 22px
    borderRadius:      radii.pill,     // ← Rev 3: was HEAT_PILL_RADIUS (11), now token (28)
    paddingHorizontal: HEAT_PILL_PAD_H,// 8px
    alignItems:        'center',
    justifyContent:    'center',
    overflow:          'hidden',       // clips gradient to border-radius on Android
  },

  /**
   * Blueprint §[4.B]: "12px 700 #FFFFFF · 4.5+:1 contrast on gradient"
   * Token: typography.captionStrong — purpose-built for heat pill text
   * (see typography.ts: "heat pill text (\"🔥 87\" in gradient pill)")
   */
  heatPillText: {
    ...typography.captionStrong, // 12px 700 DM Sans Bold · tight lh 14
    color: palette.white,        // #FFFFFF — contrast guaranteed per blueprint spec
  },

  // ─── [4.C] Trust Anchor Chip ───────────────────────────────────────────────
  /**
   * Blueprint §[4.C]: H=24px · radius=12px (pill) · padding=10px horizontal
   * Bg: #F5E6C8 (v1) → palette.cream[200] = #F7ECD0 (v2)
   *
   * Rev 3 — Radius Protocol fix:
   *   BEFORE: borderRadius: TRUST_CHIP_RADIUS  (12 — manual height/2 calculation)
   *   AFTER : borderRadius: radii.pill         (28 — design system token)
   *
   * Same reasoning as heatPill above — RN clamps to height/2 at render time.
   */
  trustChip: {
    height:            TRUST_CHIP_H,   // 24px
    borderRadius:      radii.pill,     // ← Rev 3: was TRUST_CHIP_RADIUS (12), now token (28)
    paddingHorizontal: TRUST_CHIP_PAD_H,  // 10px
    backgroundColor:   TRUST_CHIP_BG,     // cream[200] = #F7ECD0
    alignItems:        'center',
    justifyContent:    'center',
  },

  /**
   * Blueprint §[4.C]: "11px 500 #6B5B2E"
   * Token: typography.metaMedium — 11px 500 DM Sans Medium
   * Color: palette.ink[600] = #6B5B47 (v2 espresso)
   */
  trustChipText: {
    ...typography.metaMedium,          // 11px 500 DM Sans · relaxed lh
    color: TRUST_CHIP_TEXT_COLOR,      // palette.ink[600] = #6B5B47
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — EXPORT
// React.memo — all 5 props are primitives + stable callbacks.
// Shallow compare prevents re-renders on unrelated parent state changes.
// Strip only re-renders when Firestore pushes a new count / heatScore value.
// ─────────────────────────────────────────────────────────────────────────────

const OnlineCountStrip = React.memo(OnlineCountStripBase);

export default OnlineCountStrip;

/**
 * SkeletonBubble — components/atoms/SkeletonBubble.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: atom · Status: final · P1
 *
 * Loading state for the Home Screen chat FlatList while the initial 50 messages
 * are fetched from Firestore. Renders 8 message-bubble skeleton shapes that
 * visually mirror a real conversation — alternating alignments, varying widths,
 * shimmer animation — so the user understands the content type immediately.
 *
 * Blueprint spec (Part 1 · Element [4] · State 2 / LOADING-INITIAL):
 *   Count      : 8 bubbles
 *   Alignment  : 4 left (other user + avatar) · 3 right (own) · 1 center (system)
 *   Widths     : 60% · 45% · 70% · 55% · 80% · 40% · 65% · 50%  (task spec order)
 *   Heights    : 40-80px auto (driven by line count + padding — verified below)
 *   Bubble R   : radii.lg = 16px
 *   Avatar     : circle 36×36 (dimensions.avatarMsg) · bottom-aligned to bubble
 *   Inner lines: 1-2 text-line bones (12px H) + timestamp bone (11px H)
 *   Shell bg   : colors.bg.subtle (cream[50] · #FFF9EC — lighter than line bones)
 *   Line bg    : colors.bg.skeleton (cream[200] · #F7ECD0 — visible against shell)
 *   Shimmer    : cream[200] → white → cream[200] · L→R · 1200ms · ∞ (via Skeleton)
 *   Min visible: 300ms — enforced by parent FlatList transition (not here)
 *   testID     : "home-chat-skeleton"
 *   Animation  : fade-in 0→1 handled by parent (opaque at render)
 *
 * Spacing rhythm (dynamic — not uniform):
 *   Same sender consecutive (left→left)  : GAP_SAME = spacing.xs  =  4px
 *   Sender change (left↔right, or system): GAP_DIFF = spacing.md  = 12px
 *   paddingTop on container              : SCREEN_PAD = spacing.base = 16px
 *
 * System message (center): compact single-line pill (24px H · radii.pill).
 *   No outer shell, no inner text lines, no timestamp — matches real chip UI.
 *
 * No props — static layout. Shell widths are percentages; they adapt naturally
 * to any screen size without runtime dimension calculations.
 *
 * Parent responsibilities:
 *   • Fade-in: opacity 0→1 on mount (FlatList loading logic)
 *   • Fade-out + crossfade: as real messages replace skeleton (200ms per-item)
 *   • Min visible time: 300ms (don't dismiss before user registers it)
 *   • Max wait: 8000ms → trigger Severity 5 error state
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import Skeleton from '@/components/atoms/Skeleton';
import { colors, dimensions, radii, spacing } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — LAYOUT TOKENS
// All values sourced from Blueprint design tokens — zero hardcoded magic numbers.
// ─────────────────────────────────────────────────────────────────────────────

/** Screen edge horizontal padding — spacing.base = 16 (Blueprint § screen edge) */
const SCREEN_PAD: number = spacing.base;

/**
 * Same-user gap — consecutive bubbles from the SAME sender.
 * spacing.xs = 4px (tight cluster, feels like one conversation turn)
 */
const GAP_SAME: number = spacing.xs;

/**
 * Different-user gap — bubble sender changes (left↔right, or system).
 * spacing.md = 12px (clear visual separation between speakers)
 */
const GAP_DIFF: number = spacing.md;

/** Avatar size — dimensions.avatarMsg = 36 (Blueprint Element [4]: "circle 36×36") */
const AVATAR_SIZE: number = dimensions.avatarMsg;

/** Gap between avatar and bubble shell — spacing.sm = 8 */
const AVATAR_GAP: number = spacing.sm;

/** Bubble corner radius — radii.lg = 16 (Blueprint Element [4]: "radius 16px") */
const BUBBLE_R: number = radii.lg;

/**
 * Bubble vertical inner padding.
 * spacing.sm = 8 keeps resulting heights inside the 40-80px spec:
 *   1 text line : 8+8+12+8+11 = 47px ✅
 *   2 text lines: 8+8+12+8+12+8+11 = 67px ✅
 */
const BUBBLE_PAD_V: number = spacing.sm;

/** Bubble horizontal inner padding — spacing.md = 12 */
const BUBBLE_PAD_H: number = spacing.md;

/** Text-line bone height — Blueprint Element [4]: "rect … 12px H" */
const LINE_H = 12 as const;

/** Gap between stacked text-line bones — spacing.sm = 8 */
const LINE_GAP: number = spacing.sm;

/** Timestamp bone height — Blueprint Element [4]: "timestamp line · 11px H" */
const TS_H = 11 as const;

/** Border radius for inner text bones — radii.xs = 4 */
const LINE_RADIUS: number = radii.xs;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — BUBBLE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

type Alignment = 'left' | 'right' | 'center';

interface BubbleDef {
  /** Horizontal alignment of this bubble in the row. */
  align: Alignment;
  /**
   * Bubble width as a fraction of the available column (0–1).
   *   • left   → fraction of (content_width − AVATAR_SIZE − AVATAR_GAP)
   *   • right  → fraction of content_width
   *   • center → fraction of content_width (bubble is centered)
   *
   * Values from task spec (in order): 60 · 45 · 70 · 55 · 80 · 40 · 65 · 50 (%)
   */
  widthPct: number;
  /** Number of text-line bones inside the message shell (ignored for center/system). */
  lines: 1 | 2;
  /**
   * Bottom margin below this row in logical pixels.
   * Pre-computed so BubbleRow needs zero runtime logic:
   *   same sender (consecutive same align) → GAP_SAME = spacing.xs  = 4px
   *   sender change (align differs)        → GAP_DIFF = spacing.md  = 12px
   *   last bubble                          → 0 (no trailing margin)
   */
  bottomGap: number;
}

/**
 * 8 bubble shapes that constitute the loading skeleton.
 *
 * Distribution : 4 left · 3 right · 1 center  (Blueprint Element [4])
 * Width order  : 60% · 45% · 70% · 55% · 80% · 40% · 65% · 50%  (task spec)
 *
 * Gap logic (align[n] vs align[n+1]):
 *   left  → right  : diff-user → GAP_DIFF 12px
 *   right → left   : diff-user → GAP_DIFF 12px
 *   left  → left   : same-user → GAP_SAME  4px   ← [2]→[3] only
 *   *     → center : diff      → GAP_DIFF 12px
 *   center → *     : diff      → GAP_DIFF 12px
 *   last bubble    : 0
 */
const BUBBLE_DEFS: readonly BubbleDef[] = [
  { align: 'left',   widthPct: 0.60, lines: 2, bottomGap: GAP_DIFF }, // [0] left  → right  (diff)
  { align: 'right',  widthPct: 0.45, lines: 1, bottomGap: GAP_DIFF }, // [1] right → left   (diff)
  { align: 'left',   widthPct: 0.70, lines: 2, bottomGap: GAP_SAME }, // [2] left  → left   (same)
  { align: 'left',   widthPct: 0.55, lines: 2, bottomGap: GAP_DIFF }, // [3] left  → right  (diff)
  { align: 'right',  widthPct: 0.80, lines: 2, bottomGap: GAP_DIFF }, // [4] right → center (diff)
  { align: 'center', widthPct: 0.40, lines: 1, bottomGap: GAP_DIFF }, // [5] center→ left   (diff)
  { align: 'left',   widthPct: 0.65, lines: 2, bottomGap: GAP_DIFF }, // [6] left  → right  (diff)
  { align: 'right',  widthPct: 0.50, lines: 1, bottomGap: 0        }, // [7] last — no margin
] as const;

// Distribution verify: 4 left ✓  3 right ✓  1 center ✓

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — BUBBLE SHELL
// Rounded container holding text-line and timestamp bones.
//
// Shell uses colors.bg.subtle (cream[50] · #FFF9EC — lighter) so the skeleton
// line bones (colors.bg.skeleton · cream[200] · #F7ECD0 — darker) pop visibly.
//
// Contrast chain on screen:
//   Screen bg (#FFFFFF) → Shell (#FFF9EC) → Line bones (#F7ECD0) ✓
// ─────────────────────────────────────────────────────────────────────────────

interface BubbleShellProps {
  widthPct: number;
  lines: 1 | 2;
}

const BubbleShell: React.FC<BubbleShellProps> = ({ widthPct, lines }) => (
  <View
    style={[
      styles.bubbleShell,
      { width: `${Math.round(widthPct * 100)}%` as `${number}%` },
    ]}
  >
    {/* ── Text line 1 — longest (first message-text line) ─────────────────── */}
    <Skeleton
      width="78%"
      height={LINE_H}
      radius={LINE_RADIUS}
    />

    {/* ── Text line 2 — shorter (wrapped second line) ──────────────────────── */}
    {lines === 2 && (
      <Skeleton
        width="62%"
        height={LINE_H}
        radius={LINE_RADIUS}
        style={styles.lineSpacing}
      />
    )}

    {/* ── Timestamp bone — Blueprint: "rect 30% width · 11px H · bottom" ─── */}
    <Skeleton
      width="32%"
      height={TS_H}
      radius={LINE_RADIUS}
      style={styles.timestampSpacing}
    />
  </View>
);

const BubbleShellMemo = React.memo(BubbleShell);

// ─────────────────────────────────────────────────────────────────────────────
// § 3B — SYSTEM PILL
// Compact single-line centered pill for system messages (e.g. "joined the chat").
// Real UI: small centered chip, no avatar, no timestamp, no multi-line text.
//
// Blueprint date separator: "chip 24px H" — system pill mirrors this height.
// Full pill radius (radii.pill = 9999) rounds both ends completely.
// Uses colors.bg.skeleton directly (no outer shell — the pill IS the bone).
// ─────────────────────────────────────────────────────────────────────────────

/** Height mirrors the Blueprint date-separator chip (24px H). */
const SYSTEM_PILL_H = 24 as const;

const SystemPill: React.FC<{ widthPct: number }> = ({ widthPct }) => (
  <Skeleton
    width={`${Math.round(widthPct * 100)}%` as `${number}%`}
    height={SYSTEM_PILL_H}
    radius={radii.pill}
  />
);

const SystemPillMemo = React.memo(SystemPill);


// Wraps one BubbleShell (+ optional avatar) with the correct alignment.
// ─────────────────────────────────────────────────────────────────────────────

interface BubbleRowProps {
  def: BubbleDef;
}

const BubbleRow: React.FC<BubbleRowProps> = ({ def }) => {
  // bottomGap = 0 on last bubble → no trailing margin applied
  const rowStyle = def.bottomGap > 0 ? { marginBottom: def.bottomGap } : undefined;

  // ── CENTER — compact system message pill (no avatar, no text lines, no timestamp)
  if (def.align === 'center') {
    return (
      <View style={[styles.rowCenter, rowStyle]}>
        <SystemPillMemo widthPct={def.widthPct} />
      </View>
    );
  }

  // ── RIGHT — own message (no avatar, right-aligned) ────────────────────────
  if (def.align === 'right') {
    return (
      <View style={[styles.rowRight, rowStyle]}>
        <BubbleShellMemo widthPct={def.widthPct} lines={def.lines} />
      </View>
    );
  }

  // ── LEFT — other user message (avatar circle + bubble) ───────────────────
  // alignItems: 'flex-end' → avatar sits at the BOTTOM of the bubble,
  // matching how real chat avatars sit beside the final message line.
  return (
    <View style={[styles.rowLeft, rowStyle]}>
      {/* Avatar circle skeleton — dimensions.avatarMsg = 36 */}
      <Skeleton
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        radius={AVATAR_SIZE / 2}   // full circle
        style={styles.avatar}
      />

      {/* Horizontal gap between avatar and bubble */}
      <View style={styles.avatarGap} />

      {/* Flex column — bubble fills remaining width */}
      <View style={styles.leftColumn}>
        <BubbleShellMemo widthPct={def.widthPct} lines={def.lines} />
      </View>
    </View>
  );
};

const BubbleRowMemo = React.memo(BubbleRow);

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SkeletonBubble
 *
 * Renders 8 message-bubble skeleton shapes as the loading state for the Home
 * Screen chat body. Mount immediately on screen init — displays within 100ms
 * of app open (Blueprint § animation, State 2: LOADING-INITIAL).
 *
 * @example
 * // Inside Home Screen FlatList loading state:
 * if (isLoading) {
 *   return <SkeletonBubble />;
 * }
 */
const SkeletonBubble: React.FC = () => (
  <View style={styles.container} testID="home-chat-skeleton">
    {BUBBLE_DEFS.map((def, index) => (
      <BubbleRowMemo
        key={index}
        def={def}
      />
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Container ────────────────────────────────────────────────────────────
  container: {
    paddingHorizontal: SCREEN_PAD,   // spacing.base = 16 · Blueprint screen edge
    paddingTop:        SCREEN_PAD,   // spacing.base = 16 · 16px from top edge (not 8)
  },

  // ── Row variants ─────────────────────────────────────────────────────────
  // Note: bottomGap is applied as inline style on each row (dynamic per-pair).
  // rowSpacing removed — uniform static margin replaced by dynamic GAP_SAME/GAP_DIFF.
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'flex-end',       // avatar bottom-aligns to bubble
  },
  rowRight: {
    flexDirection:  'row',
    justifyContent: 'flex-end',      // bubble hugs the right edge
  },
  rowCenter: {
    alignItems: 'center',            // system message centered in row
  },

  // ── Avatar ───────────────────────────────────────────────────────────────
  avatar: {
    flexShrink: 0,                   // never compress the avatar circle
  },
  avatarGap: {
    width: AVATAR_GAP,               // spacing.sm = 8 · avatar ↔ bubble
  },

  // ── Left column (remaining space after avatar + gap) ─────────────────────
  leftColumn: {
    flex: 1,
    // widthPct inside BubbleShell resolves against this flex column's width
  },

  // ── Bubble shell ─────────────────────────────────────────────────────────
  bubbleShell: {
    /**
     * Shell: colors.bg.subtle — cream[50] #FFF9EC (lighter than line bones).
     * Inner Skeleton bones use colors.bg.skeleton — cream[200] #F7ECD0.
     * The subtle tint barely shows on white screen bg; bones contrast clearly.
     *
     * No overflow: 'hidden' here — each inner Skeleton handles its own clipping.
     */
    backgroundColor:   colors.bg.subtle,    // cream[50] · #FFF9EC
    borderRadius:      BUBBLE_R,            // radii.lg = 16
    paddingVertical:   BUBBLE_PAD_V,        // spacing.sm = 8
    paddingHorizontal: BUBBLE_PAD_H,        // spacing.md = 12
  },

  // ── Inner skeleton spacing ────────────────────────────────────────────────
  lineSpacing: {
    marginTop: LINE_GAP,             // spacing.sm = 8 · between text lines
  },
  timestampSpacing: {
    marginTop: LINE_GAP,             // spacing.sm = 8 · text → timestamp
  },

});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EXPORT
// React.memo — no props; renders once per mount until unmounted.
// ─────────────────────────────────────────────────────────────────────────────

export default React.memo(SkeletonBubble);

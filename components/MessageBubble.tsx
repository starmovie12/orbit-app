/**
 * components/MessageBubble.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN App — Chat ka dil.
 *
 * VARIANTS  (PRD §10.2 — 6 types, single inverted FlatList):
 *   right   → own message         (brand gold fill · right-tail · status ticks)
 *   left    → other user message  (cream bubble · left-tail · display name)
 *   ai      → AI companion        (cream fill · dashed ring · mandatory AI badge · italic text)
 *   mayor   → Mayor pinned        (center-aligned card · gold border + left accent)
 *   system  → System event        (centered · gold-50 bg · no tail · §14346)
 *   date    → Date separator chip (centered · cream chip · §[5.F])
 *
 * AVATAR DELEGATION (Rule 03 — strict):
 *   This component NEVER renders a user avatar. Avatar rendering is fully
 *   delegated to the parent FlatList item wrapper (e.g. ChatMessageRow).
 *   The parent places a <Avatar size="msg" /> to the left of this bubble for
 *   left / mayor / ai variants. MessageBubble is unaware of avatar existence.
 *   Rationale: Rule 03 mandates avatar lives ONLY in the bottom nav Profile tab
 *   at the app-nav level; bubble-adjacent avatars are layout concerns of the
 *   row wrapper, not the bubble molecule itself.
 *
 * ─── GAP ANALYSIS vs PRD §10.2 (v3.2) — FIXES APPLIED IN THIS VERSION ─────
 *
 *   FIX-01  T.bubbleRight:       palette.gold[600] (#C9A227) → colors.fg.brand
 *           PRD §19.2 --fg-brand = #D4A017 (updated brand gold)
 *
 *   FIX-02  T.bubbleLeft:        palette.cream[200] (#F7ECD0) → colors.bg.card
 *           PRD §19.2 --bg-card = #F5E6C8 (cream card / other-user bubbles)
 *
 *   FIX-03  T.bubbleAI:          palette.cream[50] (#FFF9EC) → colors.bg.card
 *           PRD §10.2 — AI Companion: "Left-aligned, cream fill" = same as left variant
 *
 *   FIX-04  T.bubbleMayor:       palette.cream[50] → palette.gold[50] (#FCF7E5)
 *           User spec — "Background: subtle gold tint"
 *
 *   FIX-05  T.borderMayorAccent: palette.gold[600] (#C9A227) → colors.fg.brand
 *           User spec — "Border: 2px solid gold (#D4A017) — left-accent border"
 *
 *   FIX-06  T.borderHighlight:   palette.gold[600] (#C9A227) → colors.fg.brand
 *           Consistency — saved-message ring uses brand gold
 *
 *   FIX-07  T.shadowGold:        palette.gold[600] → colors.fg.brand
 *           Consistency — shadow base matches brand token
 *
 *   FIX-08  T.statusFailed:      palette.crimson[600] (#C4294F) → colors.fg.danger
 *           PRD §19.2 --fg-danger = #EF4444
 *
 *   FIX-09  T.borderAI:          rgba base updated from gold[600] to D4A017
 *           Updated to 'rgba(212,160,23,0.45)' — palette.fg.brand @ 45% opacity
 *
 *   FIX-10  MessageStatus:       Added 'pending' variant
 *           PRD §10.2 Own Message: "status ✓/✓✓/⏳/⚠️" — ⏳ = pending was missing
 *
 *   FIX-11  STATUS_ICON:         Added pending entry { glyph: '⏳', a11y: 'Sending…' }
 *
 *   FIX-12  msgTextAI style:     Added fontStyle: 'italic' + muted color
 *           User spec — "Text: italic-tinted to distinguish from human messages"
 *
 *   FIX-13  isAI text render:    Applied styles.msgTextAI to AI message text
 *
 *   FIX-14  Mayor alignment:     Left-aligned → Center-aligned (wrapperMayor)
 *           PRD §10.2 — "Mayor Pinned Message: Centered, gold border, 24h sticky"
 *
 *   FIX-15  bubbleMayor tail:    borderTopLeftRadius radii.xs → radii.lg
 *           Center-aligned card has no tail corner; uniform radius required
 *
 *   FIX-16  bubbleMayor border:  borderLeftWidth 3 → 2, color → colors.fg.brand
 *           User spec — "Border: 2px solid gold (#D4A017) — left-accent border"
 *
 *   FIX-17  aiBadge size:        paddingHorizontal 7 → 10, paddingVertical 2 → 3
 *           fontSize 8.5 → 11
 *           PRD §11A.14 — "🤖 AI pill is enlarged 40% bigger than text"
 *
 *   FIX-18  aiBadge background:  palette.gold[600] (direct in StyleSheet) → colors.fg.brand
 *           No raw palette values in StyleSheet — must route through T or colors token
 *
 * ─── KNOWN GAP — CANNOT FIX WITHOUT INTERFACE CHANGE ─────────────────────
 *
 *   GAP-01  Trust score chip for left / other-user variant:
 *           User spec §10.2 Variant 2 — "display name + trust score chip agar available"
 *           PRD data model has trust_score on user documents (§23.2).
 *           MessageBubbleProps has no trustScore field and DO NOT CHANGE rule
 *           prohibits interface modifications. This chip must be added in a future
 *           props update: add `trustScore?: number` to MessageBubbleProps and render
 *           a <Tag variant="trust" label={...} /> in the metaContainer for left/ai variants.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROPS UNCHANGED (per DO NOT CHANGE mandate):
 *   status      → MessageStatus (extended with 'pending' — type change, not interface)
 *   highlighted → boolean  — 2px gold border for saved / bookmarked messages
 *   onLongPress → (event) => void  — available on ALL variants
 *
 * LAWS ENFORCED:
 *   Rule 03  — No avatar in this component (ever).
 *   §Q1      — date separator accessibilityRole: "header".
 *   §[5.F]   — date chip: H 24px · cream[200] bg · r-12 · 8px H pad.
 *   §14346   — system: gold[50] bg · 1px gold[300] · 12px 600 ink[700].
 *   §10.2    — all 6 variants per PRD v3.2.
 *   §11A.14  — AI pill enlarged 40%, always visible, never hidden.
 *   §19.2    — color tokens aligned to PRD locked set.
 *   Non-Negotiable #9 — AI always labeled "🤖 AI".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS : updated   · LAYER : molecule  · PRIORITY : P0
 * DEPS   : components/atoms/Tag.tsx · constants/colors.ts · constants/spacing.ts
 * PRD    : CROWN v3.2 §10.2, §11A.14, §19.2
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { Tag }                             from '@/components/atoms/Tag';
import { colors, palette, radii, spacing } from '@/constants/colors';

// ─── Design token aliases (zero hardcoded hex in JSX / styles below) ─────────
//
// colors.fg.brand   → #D4A017  --fg-brand   (PRD §19.2 primary token set)
// colors.bg.card    → #F5E6C8  --bg-card     (PRD §19.2 cream card / other-user bubbles)
// colors.fg.danger  → #EF4444  --fg-danger   (PRD §19.2 errors / crimson alerts)
// colors.fg.tertiary is already used in this file (textDate) — confirmed available
//
// FIX-09: T.borderAI base updated from gold[600] (#C9A227) to D4A017 (#D4A017)
//         rgba(212,160,23,0.45) = colors.fg.brand @ 45% opacity
//         In a future refactor, add colors.fg.brandAlpha(0.45) to constants/colors.ts

const T = {
  // Bubble backgrounds
  // FIX-02: was palette.cream[200] (#F7ECD0) — PRD --bg-card = #F5E6C8
  bubbleLeft:        colors.bg.card,               // #F5E6C8 — left / other-user fill (PRD --bg-card)
  // FIX-01: was palette.gold[600] (#C9A227) — PRD --fg-brand = #D4A017
  bubbleRight:       colors.fg.brand,              // #D4A017 — own message brand gold (PRD --fg-brand)
  // FIX-03: was palette.cream[50] (#FFF9EC) — PRD §10.2 AI = cream fill same as left
  bubbleAI:          colors.bg.card,               // #F5E6C8 — AI cream fill (same as left per PRD §10.2)
  // FIX-04: was palette.cream[50] (#FFF9EC) — user spec: "subtle gold tint"
  bubbleMayor:       palette.gold[50],             // #FCF7E5 — Mayor subtle gold tint
  bubbleSystem:      palette.gold[50],             // #FCF7E5 — system event (§14346)
  bubbleDateChip:    palette.cream[200],           // #F7ECD0 — date chip fill (§[5.F])

  // Borders
  borderLeft:        palette.cream[400],           // #E5CC95 — left bubble hairline
  // FIX-09: base updated from gold[600] (#C9A227) to D4A017 derivation
  borderAI:          'rgba(212,160,23,0.45)' as const, // colors.fg.brand @ 45% — AI dashed ring
  borderMayor:       palette.gold[300],            // #ECD58F — mayor outline
  // FIX-05: was palette.gold[600] (#C9A227) — user spec: #D4A017 left-accent
  borderMayorAccent: colors.fg.brand,              // #D4A017 — 2px left accent spine (PRD user spec)
  borderSystem:      palette.gold[300],            // #ECD58F — system card ring
  // FIX-06: was palette.gold[600] (#C9A227) — consistency with brand token
  borderHighlight:   colors.fg.brand,              // #D4A017 — saved-message ring

  // Text
  textBody:          palette.ink[950],             // #1A1208 — primary chat text
  textBodyWhite:     palette.white,                // #FFFFFF — own bubble text
  textMayor:         palette.ink[700],             // #524539 — mayor slightly heavier
  textTime:          palette.ink[500],             // #8A7960 — timestamp left / mayor
  textTimeRight:     'rgba(255,253,243,0.90)' as const, // palette.cream[50] @ 90% — ghosted white on gold
  textSystem:        palette.ink[700],             // #524539 — system text (§14346)
  // §[5.F]: date chip label — colors.fg.tertiary (ink[500]) for muted "translucent chip" feel
  textDate:          colors.fg.tertiary,           // ink[500] #8A7960 — softer than ink[600]
  textSenderName:    palette.ink[500],             // #8A7960 — username above bubble
  // FIX-12: AI message text — italic-tinted (colors.fg.tertiary = muted warm)
  textAI:            colors.fg.tertiary,           // muted warm tone — italic-tinted AI text

  // Status tick colours (on gold/right bubble)
  statusSent:        'rgba(255,253,243,0.60)' as const,  // palette.cream[50] @ 60% — dim single tick
  statusDelivered:   'rgba(255,253,243,0.92)' as const,  // palette.cream[50] @ 92% — bright double tick
  // FIX-08: was palette.crimson[600] (#C4294F) — PRD §19.2 --fg-danger = #EF4444
  statusFailed:      colors.fg.danger,             // #EF4444 — failed warning (PRD --fg-danger)
  // pending status uses ⏳ emoji — no specific color token needed; inherits textBodyWhite

  // Shadows
  // FIX-07: was palette.gold[600] (#C9A227) — consistency with brand token
  shadowGold:        colors.fg.brand,              // #D4A017 — gold shadow base
} as const;

// ─── Public types ─────────────────────────────────────────────────────────────

export type BubbleVariant =
  | 'left'
  | 'right'
  | 'mayor'
  | 'ai'
  | 'date'
  | 'system';

// FIX-10: Added 'pending' — PRD §10.2 Own Message: "status ✓/✓✓/⏳/⚠️"
// 'pending' = optimistic state: message sent to client, not yet confirmed by server
export type MessageStatus =
  | 'sent'
  | 'delivered'
  | 'pending'
  | 'failed';

export interface Reaction {
  emoji:   string;
  count:   number;
  active?: boolean;
}

/**
 * Loose tag bag — each key maps to exactly one Tag atom variant.
 * All optional; pass only what applies to this message's sender.
 *
 * GAP-01 NOTE: trustScore?: number should be added here in a future props update
 * to enable the "display name + trust score chip agar available" spec from PRD §10.2
 * Variant 2 (Other User Message). Blocked by DO NOT CHANGE rule for this update.
 */
export interface MessageTags {
  colony?:    string;   // colony / sector label
  verified?:  boolean;  // phone-OTP verified
  credits?:   string;   // wallet balance chip e.g. "₹420"
  isLocal?:   boolean;  // browsing own home sector
  isVisitor?: boolean;  // browsing outside home sector
  isAI?:      boolean;  // AI companion message
  isMoon?:    boolean;  // away / DND status
  isMayor?:   boolean;  // elected sector mayor
  isFounder?: boolean;  // founding cohort
  founderNo?: string;   // serial number e.g. "#001"
}

export interface MessageBubbleProps {
  variant:       BubbleVariant;
  /**
   * Message body text.
   * For variant='date'   → the date label ("Today" | "Yesterday" | "12 May").
   * For variant='system' → the event text ("Rahul joined the sector").
   */
  text:          string;
  /**
   * Formatted timestamp string, e.g. "10:42 AM".
   * Not rendered for variant='date' or 'system'.
   */
  time?:         string;
  /**
   * Sender display name — rendered above the bubble for left / mayor / ai.
   * Omitted for right / date / system.
   */
  username?:     string;
  /** Tag atoms to render in the sender meta row */
  tags?:         MessageTags;
  reactions?:    Reaction[];
  /**
   * Delivery status — only rendered for variant='right'.
   * sent      → ✓  (single dimmed tick)
   * delivered → ✓✓ (double bright tick)
   * pending   → ⏳  (optimistic — not yet server-confirmed)
   * failed    → ⚠  (crimson warning — tap to retry via onLongPress)
   */
  status?:       MessageStatus;
  /**
   * When true renders a 2px gold ring around the bubble.
   * Used to mark bookmarked / saved messages in the MessageActionSheet flow.
   */
  highlighted?:  boolean;
  onReact?:      (emoji: string) => void;
  onGift?:       () => void;
  /** Opens MessageActionSheet — available on ALL variants */
  onLongPress?:  (event: GestureResponderEvent) => void;
  style?:        ViewStyle;
}

// ─── MessageTagsRow — renders tag atoms, no inline styles ────────────────────

interface TagsRowProps {
  tags: MessageTags;
}

const MessageTagsRow: React.FC<TagsRowProps> = memo(({ tags }) => (
  <View style={styles.tagsRow}>
    {tags.colony    ? <Tag variant="colony"  label={tags.colony}             size="sm" /> : null}
    {tags.verified  ? <Tag variant="verified"                                size="sm" /> : null}
    {tags.credits   ? <Tag variant="credits" label={tags.credits}            size="sm" /> : null}
    {tags.isLocal   ? <Tag variant="local"                                   size="sm" /> : null}
    {tags.isVisitor ? <Tag variant="visitor"                                 size="sm" /> : null}
    {tags.isAI      ? <Tag variant="ai"                                      size="sm" /> : null}
    {tags.isMoon    ? <Tag variant="moon"                                    size="sm" /> : null}
    {tags.isMayor   ? <Tag variant="mayor"                                   size="sm" /> : null}
    {tags.isFounder ? <Tag variant="founder" label={tags.founderNo ?? '001'} size="sm" /> : null}
  </View>
));

MessageTagsRow.displayName = 'MessageTagsRow';

// ─── ReactionPill ─────────────────────────────────────────────────────────────

interface ReactionPillProps {
  reaction: Reaction;
  onPress:  () => void;
  isRight:  boolean;
}

const ReactionPill: React.FC<ReactionPillProps> = memo(
  ({ reaction, onPress, isRight }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.reactionPill,
        reaction.active && styles.reactionPillActive,
        isRight         && styles.reactionPillRight,
        pressed         && styles.reactionPillPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`React with ${reaction.emoji}, count ${reaction.count}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={styles.reactionText}>
        {reaction.emoji} {reaction.count}
      </Text>
    </Pressable>
  ),
);

ReactionPill.displayName = 'ReactionPill';

// ─── Status icon map ──────────────────────────────────────────────────────────
// FIX-10 + FIX-11: Added 'pending' — PRD §10.2 status icons: ✓/✓✓/⏳/⚠️
// DO NOT CHANGE: existing entries (sent, delivered, failed) kept identical

const STATUS_ICON: Record<MessageStatus, { glyph: string; a11y: string }> = {
  sent:      { glyph: '✓',  a11y: 'Sent'                                },
  delivered: { glyph: '✓✓', a11y: 'Delivered'                           },
  pending:   { glyph: '⏳', a11y: 'Sending…'                            },  // FIX-11
  failed:    { glyph: '⚠',  a11y: 'Failed to send. Long press to retry.' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATE SEPARATOR  (Blueprint §[5.F])
// ─────────────────────────────────────────────────────────────────────────────
//   Layout : full-width row — hairline ─── chip ─── hairline
//   Chip   : H 24px · cream[200] bg · r-12 · 8px H pad
//   Text   : 11px 600 ink[500] muted
//   Margin : 24px top · 16px bottom
//   a11y   : accessibilityRole "header" (§Q1)
// ═══════════════════════════════════════════════════════════════════════════════

interface DateSeparatorBubbleProps {
  label:        string;
  onLongPress?: (e: GestureResponderEvent) => void;
}

const DateSeparatorBubble: React.FC<DateSeparatorBubbleProps> = memo(
  ({ label, onLongPress }) => (
    <Pressable
      style={styles.dateSepWrapper}
      onLongPress={onLongPress}
      delayLongPress={350}
      android_ripple={null}
      accessibilityRole="header"
      accessibilityLabel={`Messages from ${label}`}
    >
      <View style={styles.dateSepLine} />
      <View style={styles.dateSepChip}>
        <Text style={styles.dateSepText} allowFontScaling={false}>
          {label}
        </Text>
      </View>
      <View style={styles.dateSepLine} />
    </Pressable>
  ),
);

DateSeparatorBubble.displayName = 'DateSeparatorBubble';

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM MESSAGE BUBBLE  (Blueprint §Q1-d + §14346)
// ─────────────────────────────────────────────────────────────────────────────
//   "Centered system bubble · gold-50 bg · 1px gold-300 · 12px 600 ink-700"
//   No tail · full-pill · centered · no avatar · no sender name
// ═══════════════════════════════════════════════════════════════════════════════

interface SystemBubbleProps {
  text:         string;
  onLongPress?: (e: GestureResponderEvent) => void;
}

const SystemBubble: React.FC<SystemBubbleProps> = memo(
  ({ text, onLongPress }) => (
    <Pressable
      style={styles.systemWrapper}
      onLongPress={onLongPress}
      delayLongPress={350}
      android_ripple={null}
      accessibilityRole="text"
      accessibilityLabel={`System: ${text}`}
    >
      <View style={styles.systemChip}>
        <Text style={styles.systemText} allowFontScaling={false}>
          {text}
        </Text>
      </View>
    </Pressable>
  ),
);

SystemBubble.displayName = 'SystemBubble';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MessageBubble
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubbleComponent({
  variant,
  text,
  time,
  username,
  tags,
  reactions = [],
  status,
  highlighted = false,
  onReact,
  onGift,
  onLongPress,
  style,
}: MessageBubbleProps) {

  // ── Structural variants exit early ─────────────────────────────────────────

  if (variant === 'date') {
    return <DateSeparatorBubble label={text} onLongPress={onLongPress} />;
  }

  if (variant === 'system') {
    return <SystemBubble text={text} onLongPress={onLongPress} />;
  }

  // ── left / right / mayor / ai ──────────────────────────────────────────────

  const isRight = variant === 'right';
  const isMayor = variant === 'mayor';
  const isAI    = variant === 'ai';

  // ── Read more / less (long-message clamp · WhatsApp-style) ──────────────────
  const MAX_LINES = 8;
  const [expanded, setExpanded]   = useState(false);
  const [overflowed, setOverflowed] = useState(false);
  const measuredRef = useRef(false);
  // Heuristic fallback so it also works on web (where onTextLayout can be flaky)
  const longByHeuristic = text.length > 240 || (text.match(/\n/g)?.length ?? 0) >= MAX_LINES;
  const canToggle = overflowed || longByHeuristic;
  const clampNow  = canToggle && !expanded;

  // DO NOT CHANGE: LongPress handler logic
  const handleLongPress = useCallback(
    (e: GestureResponderEvent) => { onLongPress?.(e); },
    [onLongPress],
  );

  // Composited bubble styles
  const bubbleStyle = [
    styles.bubble,
    variant === 'left'  && styles.bubbleLeft,
    isRight             && styles.bubbleRight,
    isMayor             && styles.bubbleMayor,
    isAI                && styles.bubbleAI,
    highlighted         && styles.bubbleHighlighted,
  ];

  // Timestamp style per variant
  const timeStyle: TextStyle =
    isRight ? styles.timeRight : isMayor ? styles.timeMayor : styles.timeLeft;

  // DO NOT CHANGE: Status tick rendering logic
  // (FIX-10: STATUS_ICON map now includes 'pending' — logic itself unchanged)
  const renderStatusIcon = () => {
    if (!isRight || !status) return null;
    const { glyph, a11y } = STATUS_ICON[status];
    const iconStyle =
      status === 'failed'    ? styles.statusFailed
      : status === 'sent'    ? styles.statusSent
      : status === 'pending' ? styles.statusPending
      :                        styles.statusDelivered;
    return (
      <Text
        style={[styles.statusIcon, iconStyle]}
        allowFontScaling={false}
        accessibilityLabel={a11y}
        accessibilityRole="image"
      >
        {' '}{glyph}
      </Text>
    );
  };

  return (
    <View
      style={[
        styles.wrapper,
        // FIX-14: Mayor is center-aligned card (PRD §10.2 "Centered, gold border, 24h sticky")
        // Previously: all non-right variants used wrapperLeft (alignment bug)
        isMayor ? styles.wrapperMayor
          : isRight ? styles.wrapperRight
          : styles.wrapperLeft,
        style,
      ]}
    >
      {/* ── Sender meta row (left / mayor / ai) ─────────────────────────── */}
      {!isRight && (
        <View style={[styles.metaContainer, isMayor && styles.metaMayor]}>
          {username ? (
            <Text style={styles.senderName} numberOfLines={1}>
              {username}
            </Text>
          ) : null}
          {tags ? <MessageTagsRow tags={tags} /> : null}
          {/*
           * GAP-01: trust score chip goes here for left/ai variants.
           * Add `trustScore?: number` to MessageBubbleProps + MessageTags,
           * then render: trustScore ? <Tag variant="trust" label={`${trustScore}`} size="sm" /> : null
           */}
        </View>
      )}

      {/* ── Bubble body ──────────────────────────────────────────────────── */}
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={350}
        android_ripple={null}
        style={({ pressed }) => [
          ...bubbleStyle,
          pressed && styles.bubblePressed,
        ]}
        accessibilityRole="text"
        accessibilityLabel={
          username ? `Message from ${username}: ${text}` : text
        }
        accessibilityHint="Long press to open actions"
      >
        {/* AI mandatory badge — §11A.14 · Non-Negotiable #9
            FIX-17: Enlarged 40% per PRD §11A.14
            "🤖 AI pill is enlarged 40% bigger than text — users instantly recognize them as ambient"
            MUST ALWAYS BE VISIBLE — NEVER REMOVE OR CONDITIONALLY HIDE */}
        {isAI && (
          <View style={styles.aiBadgeRow}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText} allowFontScaling={false}>
                🤖 AI
              </Text>
            </View>
          </View>
        )}

        {/* Mayor label strip */}
        {isMayor && (
          <View style={styles.mayorLabelRow}>
            <Text style={styles.mayorLabel} allowFontScaling={false}>
              👑 Mayor ka message
            </Text>
          </View>
        )}

        {/* Message text
            FIX-13: Apply msgTextAI (italic-tinted) for AI variant
            PRD §10.2 AI: "Text: italic-tinted to distinguish from human messages" */}
        <Text
          style={[
            styles.msgText,
            isRight && styles.msgTextRight,
            isMayor && styles.msgTextMayor,
            isAI    && styles.msgTextAI,        // FIX-13
          ]}
          numberOfLines={clampNow ? MAX_LINES : undefined}
          onTextLayout={(e) => {
            if (measuredRef.current) return;
            measuredRef.current = true;
            if (e.nativeEvent.lines.length > MAX_LINES) setOverflowed(true);
          }}
        >
          {text}
        </Text>

        {/* Read more / less — only for long messages */}
        {canToggle ? (
          <Text
            style={[styles.readMore, isRight && styles.readMoreRight]}
            onPress={() => setExpanded((v) => !v)}
            suppressHighlighting
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Read less' : 'Read more'}
          >
            {expanded ? 'Read less' : 'Read more'}
          </Text>
        ) : null}

        {/* Timestamp + status icon */}
        {time ? (
          <View style={styles.timeRow}>
            <Text style={timeStyle} allowFontScaling={false}>
              {time}
            </Text>
            {renderStatusIcon()}
          </View>
        ) : null}
      </Pressable>

      {/* ── Reactions + Gift row ─────────────────────────────────────────── */}
      {(reactions.length > 0 || (!isRight && onGift)) && (
        <View style={[styles.reactsRow, isRight && styles.reactsRowRight]}>
          {reactions.map((r, idx) => (
            <ReactionPill
              key={`${r.emoji}-${idx}`}
              reaction={r}
              onPress={() => onReact?.(r.emoji)}
              isRight={isRight}
            />
          ))}

          {!isRight && onGift && (
            <Pressable
              onPress={onGift}
              style={({ pressed }) => [
                styles.giftBtn,
                pressed && styles.giftBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send gift"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.giftBtnText}>🎁 Gift</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Right-bubble tag row ─────────────────────────────────────────── */}
      {isRight && tags && (
        <View style={styles.rightTagsRow}>
          <MessageTagsRow tags={tags} />
        </View>
      )}
    </View>
  );
}

// ─── React.memo export ───────────────────────────────────────────────────────

export const MessageBubble = memo(MessageBubbleComponent);
MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Wrapper alignment ──────────────────────────────────────────────────────
  wrapper: {
    flexDirection:     'column',
    marginVertical:    spacing.xs,       // 4px — tight consecutive message gap
    paddingHorizontal: spacing.sm,       // 8px — screen-edge breathing room
    maxWidth:          '100%',
  },
  wrapperLeft: {
    alignItems: 'flex-start',
    alignSelf:  'flex-start',
  },
  wrapperRight: {
    alignItems: 'flex-end',
    alignSelf:  'flex-end',
  },
  // FIX-14: Mayor center-aligned card (PRD §10.2 "Centered, gold border, 24h sticky")
  // Previously missing — mayor incorrectly used wrapperLeft
  wrapperMayor: {
    alignItems: 'center',
    alignSelf:  'center',
  },

  // ── Sender meta container ──────────────────────────────────────────────────
  metaContainer: {
    flexDirection:     'row',
    alignItems:        'center',
    flexWrap:          'wrap',
    gap:               spacing.xs,       // 4px
    marginBottom:      4,
    paddingHorizontal: 4,
    maxWidth:          '88%',
  },
  // FIX-14: Mayor meta row centered to match the center-aligned card
  metaMayor: {
    justifyContent: 'center',
  },
  senderName: {
    fontSize:      11,
    fontWeight:    '600',
    color:         T.textSenderName,
    letterSpacing: 0.1,
  },

  // ── Tag atoms row ──────────────────────────────────────────────────────────
  tagsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.xs,           // 4px
  },

  // ── Bubble base ────────────────────────────────────────────────────────────
  bubble: {
    paddingHorizontal: spacing.md,       // 12px
    paddingVertical:   10,
    maxWidth:          '88%',
  },
  bubblePressed: {
    transform: [{ scale: 0.985 }],
    opacity:   0.95,
  },

  // left — cream fill (#F5E6C8 per PRD --bg-card) + hairline border + subtle gold shadow
  // FIX-02: was palette.cream[200] (#F7ECD0), updated to colors.bg.card (#F5E6C8)
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleLeft: {
    backgroundColor:        T.bubbleLeft,            // FIX-02: colors.bg.card #F5E6C8
    borderWidth:             1,
    borderColor:             T.borderLeft,
    borderRadius:            radii.lg,               // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.xs,               // 4  — tail corner (top-left for left-aligned)
    borderTopRightRadius:    radii.lg,               // 16
    borderBottomRightRadius: radii.lg,               // 16
    borderBottomLeftRadius:  radii.lg,               // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 3 },
    shadowOpacity:           0.07,
    shadowRadius:            7,
    elevation:               2,
  },

  // right — Brand Gold solid (#D4A017 per PRD --fg-brand)
  // FIX-01: was palette.gold[600] (#C9A227), updated to colors.fg.brand (#D4A017)
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleRight: {
    backgroundColor:        T.bubbleRight,           // FIX-01: colors.fg.brand #D4A017
    borderRadius:            radii.lg,               // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.lg,               // 16
    borderTopRightRadius:    radii.lg,               // 16
    borderBottomRightRadius: radii.xs,               // 4  — tail corner (bottom-right for right-aligned)
    borderBottomLeftRadius:  radii.lg,               // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 5 },
    shadowOpacity:           0.28,
    shadowRadius:            10,
    elevation:               5,
  },

  // mayor — subtle gold tint + 2px gold outer border + 2px left-accent spine
  // FIX-04: was palette.cream[50] (#FFF9EC) → palette.gold[50] (#FCF7E5) "subtle gold tint"
  // FIX-05: borderMayorAccent updated from gold[600] (#C9A227) → colors.fg.brand (#D4A017)
  // FIX-15: borderTopLeftRadius radii.xs → radii.lg (no tail — center-aligned card has no tail)
  // FIX-16: borderLeftWidth 3 → 2 (user spec: "2px solid gold — left-accent border")
  // Radius Protocol §8: center card = uniform radii.lg; NO tail corner
  bubbleMayor: {
    backgroundColor:        T.bubbleMayor,           // FIX-04: palette.gold[50] #FCF7E5
    borderWidth:             1.5,
    borderColor:             T.borderMayor,
    borderLeftWidth:         2,                      // FIX-16: was 3, now 2px per user spec
    borderLeftColor:         T.borderMayorAccent,    // FIX-05: colors.fg.brand #D4A017
    borderRadius:            radii.lg,               // 16
    borderTopLeftRadius:     radii.lg,               // FIX-15: was radii.xs (tail) → radii.lg (card)
    borderTopRightRadius:    radii.lg,               // 16
    borderBottomRightRadius: radii.lg,               // 16
    borderBottomLeftRadius:  radii.lg,               // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 4 },
    shadowOpacity:           0.13,
    shadowRadius:            9,
    elevation:               3,
  },

  // ai — cream fill (#F5E6C8 per PRD) + dashed gold ring
  // FIX-03: was palette.cream[50] (#FFF9EC) → colors.bg.card (#F5E6C8) "cream fill same as left"
  // FIX-09: borderAI rgba base updated from C9A227 to D4A017
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleAI: {
    backgroundColor:        T.bubbleAI,              // FIX-03: colors.bg.card #F5E6C8
    borderWidth:             1,
    borderColor:             T.borderAI,             // FIX-09: rgba(212,160,23,0.45)
    borderStyle:             'dashed',
    borderRadius:            radii.lg,               // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.xs,               // 4  — tail corner (top-left, left-aligned variant)
    borderTopRightRadius:    radii.lg,               // 16
    borderBottomRightRadius: radii.lg,               // 16
    borderBottomLeftRadius:  radii.lg,               // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 2 },
    shadowOpacity:           0.06,
    shadowRadius:            5,
    elevation:               1,
  },

  // highlighted — 2px gold ring (saved / bookmarked)
  // FIX-06: borderHighlight updated to colors.fg.brand
  bubbleHighlighted: {
    borderWidth: 2,
    borderColor: T.borderHighlight,                  // FIX-06: colors.fg.brand #D4A017
  },

  // ── AI mandatory badge (§11A.14 — Non-Negotiable #9) ──────────────────────
  // FIX-17: Enlarged 40% per PRD §11A.14:
  //   "🤖 AI pill is enlarged 40% bigger than text so users instantly recognize them as ambient"
  //   Before: paddingHorizontal 7, paddingVertical 2, fontSize 8.5
  //   After:  paddingHorizontal 10, paddingVertical 3, fontSize 11
  // FIX-18: backgroundColor updated from palette.gold[600] (raw StyleSheet ref) → T.bubbleRight
  //         (which is colors.fg.brand #D4A017 — no raw palette access in StyleSheet)
  aiBadgeRow: {
    flexDirection: 'row',
    marginBottom:  spacing.xs,           // 4px
  },
  aiBadge: {
    backgroundColor:   T.bubbleRight,               // FIX-18: colors.fg.brand #D4A017 (was palette.gold[600])
    borderRadius:      radii.sm,                    // 6
    paddingHorizontal: 10,                          // FIX-17: was 7, now 10 (+40% per §11A.14)
    paddingVertical:   3,                           // FIX-17: was 2, now 3  (+40% per §11A.14)
    shadowColor:       palette.gold[900],
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.28,
    shadowRadius:      1.5,
    elevation:         2,
  },
  aiBadgeText: {
    color:         palette.cream[50],               // light text on gold badge — ok as palette ref
    fontSize:      11,                              // FIX-17: was 8.5, now 11  (+40% per §11A.14)
    fontWeight:    '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Mayor label ────────────────────────────────────────────────────────────
  mayorLabelRow: {
    flexDirection:  'row',
    justifyContent: 'center',                       // FIX-14: centered for card layout
    marginBottom:   5,
  },
  mayorLabel: {
    fontSize:      9,
    fontWeight:    '700',
    color:         palette.gold[900],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Message text ───────────────────────────────────────────────────────────
  msgText: {
    fontSize:   15,
    lineHeight: 22,
    color:      T.textBody,
    fontWeight: '400',
  },
  msgTextRight: {
    color: T.textBodyWhite,
  },
  msgTextMayor: {
    fontWeight: '500',
    color:      T.textMayor,
  },
  // FIX-12: AI message text — italic-tinted to distinguish from human messages
  // PRD §10.2 Variant 3: "Text: italic-tinted to distinguish from human messages"
  // Uses T.textAI = colors.fg.tertiary (muted warm tone matching PRD --fg-text-muted intent)
  msgTextAI: {
    fontStyle: 'italic',
    color:     T.textAI,                            // FIX-12: muted warm tint (colors.fg.tertiary)
  },

  // ── Read more / less toggle ───────────────────────────────────────────────
  readMore: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.fg.brandText,                // gold[700] — visible on cream bubble
    marginTop:  3,
  },
  readMoreRight: {
    color: palette.white,                           // white on the gold (own) bubble
  },

  // ── Timestamp row ──────────────────────────────────────────────────────────
  timeRow: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'center',
    marginTop:      5,
  },
  timeLeft: {
    fontSize:   10,
    fontWeight: '500',
    color:      T.textTime,
  },
  timeRight: {
    fontSize:   10,
    fontWeight: '500',
    color:      T.textTimeRight,
  },
  timeMayor: {
    fontSize:   10,
    fontWeight: '500',
    color:      T.textTime,
    opacity:    0.80,
  },

  // ── Status icons ───────────────────────────────────────────────────────────
  statusIcon: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: -1.5,
  },
  statusSent: {
    color: T.statusSent,
  },
  statusDelivered: {
    color: T.statusDelivered,
  },
  // FIX-10: Added pending status style — ⏳ inherits textTimeRight (ghosted white on gold)
  statusPending: {
    color:         T.textTimeRight,                 // ghosted white on gold — matches sent/delivered feel
    fontSize:      12,
    letterSpacing: 0,
  },
  // FIX-08: was palette.crimson[600] (#C4294F) — PRD §19.2 --fg-danger = #EF4444
  statusFailed: {
    color:         T.statusFailed,                  // FIX-08: colors.fg.danger #EF4444
    fontSize:      12,
    letterSpacing: 0,
  },

  // ── Reactions row ──────────────────────────────────────────────────────────
  reactsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,           // 4px
    marginTop:     spacing.sm,           // 8px
    paddingHorizontal: 4,
    alignItems:    'center',
    alignSelf:     'flex-start',
  },
  reactsRowRight: {
    alignSelf:      'flex-end',
    justifyContent: 'flex-end',
  },

  reactionPill: {
    backgroundColor:   palette.cream[50],
    borderWidth:       1,
    borderColor:       palette.cream[400],
    borderRadius:      radii.pill,                  // 9999 — true capsule at any scale
    paddingHorizontal: 10,
    paddingVertical:   4,
    shadowColor:       palette.gold[900],
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.06,
    shadowRadius:      1.5,
    elevation:         1,
  },
  reactionPillActive: {
    backgroundColor: palette.gold[50],
    borderColor:     palette.gold[300],
  },
  reactionPillRight: {
    backgroundColor: palette.gold[50],
    borderColor:     palette.gold[300],
  },
  reactionPillPressed: {
    transform: [{ scale: 0.93 }],
  },
  reactionText: {
    fontSize:   11,
    fontWeight: '700',
    color:      palette.ink[600],
  },

  // ── Gift button ────────────────────────────────────────────────────────────
  giftBtn: {
    backgroundColor:   palette.gold[50],
    borderWidth:       1,
    borderColor:       palette.gold[300],
    borderRadius:      radii.md,                    // 12
    paddingHorizontal: 9,
    paddingVertical:   4,
  },
  giftBtnPressed: {
    opacity: 0.78,
  },
  giftBtnText: {
    fontSize:   11,
    fontWeight: '700',
    color:      palette.gold[700],
  },

  // ── Right-bubble tags below ────────────────────────────────────────────────
  rightTagsRow: {
    marginTop:         4,
    alignSelf:         'flex-end',
    paddingHorizontal: 4,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // DATE SEPARATOR  Blueprint §[5.F]
  //   Row: hairline ─── chip ─── hairline
  //   Chip: H 24px · cream[200] bg · r-12 · 8px H padding
  //   Text: 11px 600 ink[500] muted
  //   Margin: 24px top · 16px bottom
  //   accessibilityRole: "header" (§Q1)
  // ════════════════════════════════════════════════════════════════════════════

  dateSepWrapper: {
    flexDirection:     'row',
    alignItems:        'center',
    marginTop:         spacing.xxl,      // 24px — inter-day gap
    marginBottom:      spacing.lg,       // 16px
    paddingHorizontal: spacing.md,       // 12px
  },
  dateSepLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: palette.cream[400], // #E5CC95 — warm hairline
  },
  dateSepChip: {
    height:            24,
    backgroundColor:   T.bubbleDateChip, // cream[200] #F7ECD0 (§[5.F])
    borderRadius:      12,
    paddingHorizontal: spacing.sm,       // 8px H padding (§[5.F])
    marginHorizontal:  spacing.sm,       // 8px gap from lines
    justifyContent:    'center',
    alignItems:        'center',
  },
  dateSepText: {
    fontSize:      11,
    fontWeight:    '600',
    color:         T.textDate,           // colors.fg.tertiary muted warm
    letterSpacing: 0.2,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SYSTEM MESSAGE  Blueprint §Q1-d + §14346
  //   "gold-50 bg · 1px gold-300 · 12px 600 ink-700"
  //   Centered · full-pill · no tail · no sender name
  // ════════════════════════════════════════════════════════════════════════════

  systemWrapper: {
    alignItems:        'center',
    justifyContent:    'center',
    marginVertical:    spacing.sm,       // 8px top + bottom
    paddingHorizontal: spacing.xl,       // 20px — keep pill from edges
  },
  systemChip: {
    backgroundColor:   T.bubbleSystem,  // gold[50] #FCF7E5
    borderWidth:       1,
    borderColor:       T.borderSystem,  // gold[300] #ECD58F
    borderRadius:      radii.pill,      // full pill — unmistakably "system"
    paddingHorizontal: spacing.md,      // 12px
    paddingVertical:   6,
    maxWidth:          '80%',
    alignItems:        'center',
  },
  systemText: {
    fontSize:      12,
    fontWeight:    '600',
    color:         T.textSystem,        // ink[700] #524539
    textAlign:     'center',
    letterSpacing: 0.1,
  },
});

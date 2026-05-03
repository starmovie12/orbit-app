/**
 * components/MessageBubble.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD — Chat ka dil.
 *
 * VARIANTS  (Blueprint §Q1 — 6 types, single inverted FlatList):
 *   left    → other user message  (cream bubble · left-tail)
 *   right   → own message         (gold fill · right-tail · status ticks)
 *   mayor   → Mayor announcement  (gold frame + left-accent border · crown label)
 *   ai      → AI companion        (dashed gold border · mandatory AI badge)
 *   date    → Date separator chip (centered · translucent cream chip · NEW §[5.F])
 *   system  → System event        (centered · gold-50 bg · no tail · NEW §14346)
 *
 * AVATAR DELEGATION (Rule 03 — strict):
 *   This component NEVER renders a user avatar. Avatar rendering is fully
 *   delegated to the parent FlatList item wrapper (e.g. ChatMessageRow).
 *   The parent places a <Avatar size="msg" /> to the left of this bubble for
 *   left / mayor / ai variants. MessageBubble is unaware of avatar existence.
 *   Rationale: Rule 03 mandates avatar lives ONLY in Glass Island Profile tab
 *   at the app-nav level; bubble-adjacent avatars are layout concerns of the
 *   row wrapper, not the bubble molecule itself.
 *
 * PROPS ADDED (this update):
 *   status      → 'sent' | 'delivered' | 'failed'  — tick icons for 'right' variant
 *   highlighted → boolean  — 2px gold border for saved / bookmarked messages
 *   onLongPress → (event) => void  — extended to ALL variants (opens MessageActionSheet)
 *
 * TAGS:
 *   Uses <Tag /> atom from components/atoms/Tag.tsx — zero inline tag styles.
 *   MessageTagsRow sub-component renders each key as a distinct Tag atom.
 *
 * LAWS:
 *   Rule 03  — No avatar in composer (never render avatar here).
 *   §Q1      — date separator accessibilityRole: "header".
 *   §[5.F]   — date chip: H 24px · cream[200] bg · r-12 · 8px H pad.
 *   §14346   — system: gold[50] bg · 1px gold[300] · 12px 600 ink[700].
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS : update  · LAYER : molecule  · PRIORITY : P0
 * DEPS   : components/atoms/Tag.tsx · constants/colors.ts · constants/spacing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useCallback } from 'react';
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

const T = {
  // Bubble backgrounds
  bubbleLeft:        palette.cream[200],           // #F7ECD0 — left / other-user fill
  bubbleRight:       palette.gold[600],            // #C9A227 — own message Champagne Gold
  bubbleAI:         palette.cream[50],             // #FFF9EC — AI warm ivory
  bubbleMayor:      palette.cream[50],             // #FFF9EC — Mayor warm fill
  bubbleSystem:     palette.gold[50],              // #FCF7E5 — system event (§14346)
  bubbleDateChip:   palette.cream[200],            // #F7ECD0 — date chip fill (§[5.F])

  // Borders
  borderLeft:        palette.cream[400],           // #E5CC95 — left bubble hairline
  borderAI:         'rgba(201,162,39,0.45)' as const, // gold-600 @ 45% — AI dashed ring
  borderMayor:      palette.gold[300],             // #ECD58F — mayor outline
  borderMayorAccent: palette.gold[600],            // #C9A227 — 3px left accent spine
  borderSystem:     palette.gold[300],             // #ECD58F — system card ring
  borderHighlight:  palette.gold[600],             // #C9A227 — saved-message ring

  // Text
  textBody:          palette.ink[950],             // #1A1208 — primary chat text
  textBodyWhite:     palette.white,                // #FFFFFF — own bubble text
  textMayor:        palette.ink[700],              // #524539 — mayor slightly heavier
  textTime:         palette.ink[500],              // #8A7960 — timestamp left / mayor
  textTimeRight:    'rgba(255,253,243,0.90)' as const, // ghosted white on gold
  textSystem:       palette.ink[700],              // #524539 — system text (§14346)
  // §[5.F]: date chip label — colors.fg.tertiary (ink[500]) for muted "translucent chip" feel
  textDate:         colors.fg.tertiary,            // ink[500] #8A7960 — softer than ink[600]
  textSenderName:   palette.ink[500],              // #8A7960 — username above bubble

  // Status tick colours (on gold/right bubble)
  statusSent:       'rgba(255,253,243,0.60)' as const,  // dim — single tick
  statusDelivered:  'rgba(255,253,243,0.92)' as const,  // bright — double tick
  statusFailed:     palette.crimson[600],          // #C4294F — failed warning

  // Shadows
  shadowGold:        palette.gold[600],
} as const;

// ─── Public types ─────────────────────────────────────────────────────────────

export type BubbleVariant =
  | 'left'
  | 'right'
  | 'mayor'
  | 'ai'
  | 'date'
  | 'system';

export type MessageStatus =
  | 'sent'
  | 'delivered'
  | 'failed';

export interface Reaction {
  emoji:   string;
  count:   number;
  active?: boolean;
}

/**
 * Loose tag bag — each key maps to exactly one Tag atom variant.
 * All optional; pass only what applies to this message's sender.
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

const STATUS_ICON: Record<MessageStatus, { glyph: string; a11y: string }> = {
  sent:      { glyph: '✓',  a11y: 'Sent'                              },
  delivered: { glyph: '✓✓', a11y: 'Delivered'                         },
  failed:    { glyph: '⚠',  a11y: 'Failed to send. Long press to retry.' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATE SEPARATOR  (Blueprint §[5.F])
// ─────────────────────────────────────────────────────────────────────────────
//   Layout : full-width row — hairline ─── chip ─── hairline
//   Chip   : H 24px · cream[200] bg · r-12 · 8px H pad
//   Text   : 11px 600 ink[600]
//   Margin : 24px top · 16px bottom
//   a11y   : accessibilityRole "header"
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

  // Status tick / failed icon (right-variant only)
  const renderStatusIcon = () => {
    if (!isRight || !status) return null;
    const { glyph, a11y } = STATUS_ICON[status];
    const iconStyle =
      status === 'failed'    ? styles.statusFailed
      : status === 'sent'    ? styles.statusSent
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
        isRight ? styles.wrapperRight : styles.wrapperLeft,
        style,
      ]}
    >
      {/* ── Sender meta row (left / mayor / ai) ─────────────────────────── */}
      {!isRight && (
        <View style={styles.metaContainer}>
          {username ? (
            <Text style={styles.senderName} numberOfLines={1}>
              {username}
            </Text>
          ) : null}
          {tags ? <MessageTagsRow tags={tags} /> : null}
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
        {/* AI mandatory badge — §[5.C] · W-002 fix */}
        {isAI && (
          <View style={styles.aiBadgeRow}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText} allowFontScaling={false}>
                ✦ AI
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

        {/* Message text */}
        <Text
          style={[
            styles.msgText,
            isRight && styles.msgTextRight,
            isMayor && styles.msgTextMayor,
          ]}
        >
          {text}
        </Text>

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

  // left — cream fill + hairline border + subtle gold shadow
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleLeft: {
    backgroundColor:        T.bubbleLeft,
    borderWidth:             1,
    borderColor:             T.borderLeft,
    borderRadius:            radii.lg,    // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.xs,    // 4  — tail corner (top-left for left-aligned)
    borderTopRightRadius:    radii.lg,    // 16
    borderBottomRightRadius: radii.lg,    // 16
    borderBottomLeftRadius:  radii.lg,    // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 3 },
    shadowOpacity:           0.07,
    shadowRadius:            7,
    elevation:               2,
  },

  // right — Champagne Gold solid + gold glow
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleRight: {
    backgroundColor:        T.bubbleRight,
    borderRadius:            radii.lg,    // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.lg,    // 16
    borderTopRightRadius:    radii.lg,    // 16
    borderBottomRightRadius: radii.xs,    // 4  — tail corner (bottom-right for right-aligned)
    borderBottomLeftRadius:  radii.lg,    // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 5 },
    shadowOpacity:           0.28,
    shadowRadius:            10,
    elevation:               5,
  },

  // mayor — warm ivory + 3px gold left-accent spine
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleMayor: {
    backgroundColor:        T.bubbleMayor,
    borderWidth:             1.5,
    borderColor:             T.borderMayor,
    borderLeftWidth:         3,
    borderLeftColor:         T.borderMayorAccent,
    borderRadius:            radii.lg,    // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.xs,    // 4  — tail corner (top-left, left-aligned variant)
    borderTopRightRadius:    radii.lg,    // 16
    borderBottomRightRadius: radii.lg,    // 16
    borderBottomLeftRadius:  radii.lg,    // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 4 },
    shadowOpacity:           0.13,
    shadowRadius:            9,
    elevation:               3,
  },

  // ai — warm ivory + dashed gold ring
  // Radius Protocol §8: chat bubbles = radii.lg (16px); tail corner = radii.xs (4px)
  bubbleAI: {
    backgroundColor:        T.bubbleAI,
    borderWidth:             1,
    borderColor:             T.borderAI,
    borderStyle:             'dashed',
    borderRadius:            radii.lg,    // 16 — §8 chat bubble protocol
    borderTopLeftRadius:     radii.xs,    // 4  — tail corner (top-left, left-aligned variant)
    borderTopRightRadius:    radii.lg,    // 16
    borderBottomRightRadius: radii.lg,    // 16
    borderBottomLeftRadius:  radii.lg,    // 16
    shadowColor:             T.shadowGold,
    shadowOffset:            { width: 0, height: 2 },
    shadowOpacity:           0.06,
    shadowRadius:            5,
    elevation:               1,
  },

  // highlighted — 2px gold ring (saved / bookmarked)
  bubbleHighlighted: {
    borderWidth: 2,
    borderColor: T.borderHighlight,
  },

  // ── AI mandatory badge (W-002 fix) ─────────────────────────────────────────
  aiBadgeRow: {
    flexDirection: 'row',
    marginBottom:  spacing.xs,           // 4px
  },
  aiBadge: {
    backgroundColor:  palette.gold[600],
    borderRadius:     radii.sm,          // 6
    paddingHorizontal: 7,
    paddingVertical:   2,
    shadowColor:      palette.gold[900],
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.28,
    shadowRadius:     1.5,
    elevation:        2,
  },
  aiBadgeText: {
    color:         palette.cream[50],
    fontSize:      8.5,
    fontWeight:    '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Mayor label ────────────────────────────────────────────────────────────
  mayorLabelRow: {
    flexDirection: 'row',
    marginBottom:  5,
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
  statusFailed: {
    color:         T.statusFailed,
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
    backgroundColor:  palette.cream[50],
    borderWidth:      1,
    borderColor:      palette.cream[400],
    borderRadius:     radii.pill,        // 9999 — true capsule at any scale
    paddingHorizontal: 10,
    paddingVertical:   4,
    shadowColor:      palette.gold[900],
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.06,
    shadowRadius:     1.5,
    elevation:        1,
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
    backgroundColor:  palette.gold[50],
    borderWidth:      1,
    borderColor:      palette.gold[300],
    borderRadius:     radii.md,          // 12
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
  //   Text: 11px 600 ink[600]
  //   Margin: 24px top · 16px bottom
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
    backgroundColor:   T.bubbleDateChip, // cream[200]
    borderRadius:      12,
    paddingHorizontal: spacing.sm,       // 8px H padding (§[5.F])
    marginHorizontal:  spacing.sm,       // 8px gap from lines
    justifyContent:    'center',
    alignItems:        'center',
  },
  dateSepText: {
    fontSize:      11,
    fontWeight:    '600',
    color:         T.textDate,           // ink[600]
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

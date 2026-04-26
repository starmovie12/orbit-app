/**
 * MessageBubble.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * CROWD WORLD — Chat ka dil. Char variants mein aata hai:
 *   left    → doosre users ke messages (halka cream bubble, left-tail)
 *   right   → apna message (gold gradient, right-tail)
 *   mayor   → mayor ka special pinned-feel bubble (gold frame + left-border)
 *   ai      → AI companion message (dashed gold border + mandatory AI badge)
 *
 * Sub-components:
 *   <Tag />          → colony, verified, credits, local, visitor, ai, moon, mayor chips
 *   <ReactionPill /> → emoji + count pill
 *
 * Tokens: orbitGold from constants/colors.ts
 * ──────────────────────────────────────────────────────────────────────────
 */

import React, { useCallback, useRef } from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { orbitGold } from "@/constants/colors";

// ─── Design token shortcuts ──────────────────────────────────────────────────
// HTML ke :root CSS variables ko yahaan map kiya hai
const T = {
  // Backgrounds
  goldPale:       "#FFF9EC",          // --gold-pale
  goldPaleWarm:   "#FFFCF0",          // world-screen warm tone
  goldPaleDark:   "#FFF3CD",          // world-screen gradient end
  bubbleLeft:     "#FFFEFB",          // world-screen left bubble bg
  white:          "#FFFFFF",

  // Borders
  cardBorder:     "#F1E5C8",          // world-screen left bubble border
  goldBorder:     "#E2C660",          // --gold-border

  // Gold accent
  gold:           "#C9A227",          // --gold
  goldDeep:       "#9A7A18",          // --gold-deep
  goldLight:      "#E8CC6A",          // --gold-light

  // Text
  textBody:       "#1A1208",          // --text-body
  textMid:        "#6B5330",          // --text-mid
  textSoft:       "#A0875A",          // --text-soft

  // Shadows (React Native mein shadow props alag hote hain, iOS-only elevation Android pe)
  shadowGold:     "rgba(201,162,39,0.25)",
} as const;

// ─── Prop Types ──────────────────────────────────────────────────────────────

/** Reaction ek emoji+count pair hai, optional active state bhi */
export interface Reaction {
  emoji: string;
  count: number;
  active?: boolean;  // user ne already react kiya hai kya
}

/** Tags object — har key optional hai */
export interface MessageTags {
  colony?:   string;   // colony name, truncated to 80px
  verified?: boolean;  // gold checkmark
  credits?:  string;   // e.g. "₹420"
  isLocal?:  boolean;  // LOCAL pill
  isVisitor?: boolean; // VISITOR pill
  isAI?:     boolean;  // AI pill
  isMoon?:   boolean;  // 🌙 emoji
  isMayor?:  boolean;  // MAYOR badge (gradient)
}

export type BubbleVariant = "left" | "right" | "mayor" | "ai";

export interface MessageBubbleProps {
  variant:     BubbleVariant;
  username:    string;
  tags?:       MessageTags;
  text:        string;
  time:        string;
  reactions?:  Reaction[];
  onReact?:    (emoji: string) => void;
  onGift?:     () => void;
  onReport?:   () => void;
  onLongPress?: (event: GestureResponderEvent) => void;  // reaction picker callback
  style?:      ViewStyle;
}

// ─── Tag Sub-component ───────────────────────────────────────────────────────
// HTML .meta row ke andar aane wale saare chips yahaan hain

interface TagProps {
  tags: MessageTags;
  variant: BubbleVariant;
}

const Tag: React.FC<TagProps> = ({ tags, variant }) => {
  // Right bubble mein tags ka color thoda alag hota hai (white tint)
  const isRight = variant === "right";

  return (
    <View style={styles.metaRow}>
      {/* Colony name — truncate karo agar zyada lamba ho */}
      {tags.colony ? (
        <Text
          style={[styles.tagColony, isRight && styles.tagColonyRight]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {tags.colony}
        </Text>
      ) : null}

      {/* Gold verified checkmark — circle badge */}
      {tags.verified ? (
        <View style={styles.tagVerified}>
          <Text style={styles.tagVerifiedText}>✓</Text>
        </View>
      ) : null}

      {/* Credits chip — e.g. ₹420 */}
      {tags.credits ? (
        <View style={styles.tagCredits}>
          <Text style={styles.tagCreditsText}>{tags.credits}</Text>
        </View>
      ) : null}

      {/* LOCAL pill — iss shahar ka banda */}
      {tags.isLocal ? (
        <View style={styles.tagPill}>
          <Text style={styles.tagPillText}>LOCAL</Text>
        </View>
      ) : null}

      {/* VISITOR pill — bahar se aaya */}
      {tags.isVisitor ? (
        <View style={styles.tagPill}>
          <Text style={styles.tagPillText}>VISITOR</Text>
        </View>
      ) : null}

      {/* AI pill — bot hai bhai */}
      {tags.isAI ? (
        <View style={styles.tagPill}>
          <Text style={styles.tagPillText}>AI</Text>
        </View>
      ) : null}

      {/* Moon emoji — raat ka bandaa / special status */}
      {tags.isMoon ? (
        <Text style={styles.tagMoon}>🌙</Text>
      ) : null}

      {/* Mayor badge — gradient gold, zyada premium */}
      {tags.isMayor ? (
        <View style={styles.tagMayorBadge}>
          <Text style={styles.tagMayorBadgeText}>⚡ MAYOR</Text>
        </View>
      ) : null}
    </View>
  );
};

// ─── Reaction Pill Sub-component ─────────────────────────────────────────────
// .rp class ka React Native version

interface ReactionPillProps {
  reaction:  Reaction;
  onPress:   () => void;
  isRight:   boolean;
}

const ReactionPill: React.FC<ReactionPillProps> = ({ reaction, onPress, isRight }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.reactionPill,
        reaction.active && styles.reactionPillActive,
        pressed && styles.reactionPillPressed,
        // Right bubble ke neeche reactions ka bg thoda warm
        isRight && styles.reactionPillRight,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`React with ${reaction.emoji}, count ${reaction.count}`}
    >
      <Text style={styles.reactionText}>
        {reaction.emoji} {reaction.count}
      </Text>
    </Pressable>
  );
};

// ─── Main MessageBubble Component ────────────────────────────────────────────

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  variant,
  username,
  tags,
  text,
  time,
  reactions = [],
  onReact,
  onGift,
  onReport,
  onLongPress,
  style,
}) => {
  const isRight  = variant === "right";
  const isMayor  = variant === "mayor";
  const isAI     = variant === "ai";
  const isLeft   = variant === "left";

  // Long press handler — reaction picker trigger karta hai (parent handle karo)
  const handleLongPress = useCallback(
    (e: GestureResponderEvent) => {
      onLongPress?.(e);
    },
    [onLongPress]
  );

  // Bubble ki style variant ke hisaab se decide hoti hai
  const bubbleStyle = [
    styles.bubble,
    isLeft  && styles.bubbleLeft,
    isRight && styles.bubbleRight,
    isMayor && styles.bubbleMayor,
    isAI    && styles.bubbleAI,
  ];

  // Time + ticks ka color variant ke hisaab se
  const msgInfoStyle: TextStyle = [
    styles.msgInfo,
    isRight ? styles.msgInfoRight : styles.msgInfoLeft,
    isMayor && styles.msgInfoMayor,
  ] as unknown as TextStyle;

  return (
    // .mw wrapper — alignment decide karta hai left/right
    <View
      style={[
        styles.wrapper,
        isRight ? styles.wrapperRight : styles.wrapperLeft,
        style,
      ]}
    >
      {/* Meta row — username + tags. Mayor/AI ke liye bhi show hota hai */}
      {!isRight && (
        <View style={styles.metaContainer}>
          {/* Username */}
          <Text style={styles.username} numberOfLines={1}>
            {username}
          </Text>

          {/* Tags row — colony, verified, credits, local, etc. */}
          {tags && (
            <Tag tags={tags} variant={variant} />
          )}
        </View>
      )}

      {/* ─── Bubble — long-press = reaction picker open ─── */}
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={350}          // 350ms hold se reaction picker
        android_ripple={null}         // ripple nahi chahiye chat mein
        style={({ pressed }) => [
          ...bubbleStyle,
          pressed && styles.bubblePressed,
        ]}
        accessibilityRole="text"
        accessibilityLabel={`Message from ${username}: ${text}`}
        accessibilityHint="Long press to react"
      >
        {/* AI variant mein mandatory AI badge pehle aata hai (W-002 fix) */}
        {isAI && (
          <View style={styles.aiBadgeRow}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✦ AI</Text>
            </View>
          </View>
        )}

        {/* Mayor variant mein ek subtle label */}
        {isMayor && (
          <View style={styles.mayorLabelRow}>
            <Text style={styles.mayorLabel}>⚡ Mayor ka message</Text>
          </View>
        )}

        {/* Message text */}
        <Text style={[
          styles.msgText,
          isRight && styles.msgTextRight,
          isMayor && styles.msgTextMayor,
        ]}>
          {text}
        </Text>

        {/* Time + read ticks — bubble ke andar neeche */}
        <View style={styles.msgInfoRow}>
          <Text style={msgInfoStyle}>
            {time}
            {/* Apna message toh double tick dikhao */}
            {isRight && (
              <Text style={styles.ticks}>  ✓✓</Text>
            )}
          </Text>
        </View>
      </Pressable>

      {/* ─── Reactions row — bubble ke neeche ─── */}
      {(reactions.length > 0 || onGift) && (
        <View style={[
          styles.reactsRow,
          isRight && styles.reactsRowRight,
        ]}>
          {/* Emoji reaction pills */}
          {reactions.map((r, idx) => (
            <ReactionPill
              key={`${r.emoji}-${idx}`}
              reaction={r}
              onPress={() => onReact?.(r.emoji)}
              isRight={isRight}
            />
          ))}

          {/* Gift button — doosre ke messages pe dikhe */}
          {!isRight && onGift && (
            <Pressable
              onPress={onGift}
              style={({ pressed }) => [
                styles.giftBtn,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send gift"
            >
              <Text style={styles.giftBtnText}>🎁 Gift</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Right bubble ke liye meta row neeche + report option */}
      {isRight && (
        <View style={styles.rightMeta}>
          {/* Tags right pe bhi show ho sakti hain agar ho */}
          {tags && (
            <Tag tags={tags} variant={variant} />
          )}
        </View>
      )}
    </View>
  );
};

// ─── StyleSheet ───────────────────────────────────────────────────────────────
// HTML world-screen specific overrides ko RN mein translate kiya hai

const styles = StyleSheet.create({

  // ── .mw wrapper ─────────────────────────────────────────────────────────────
  wrapper: {
    flexDirection:  "column",
    marginVertical: 5,
    paddingHorizontal: 12,
    maxWidth:       "100%",
  },
  wrapperLeft: {
    alignItems:  "flex-start",   // .mw.l → left align
    alignSelf:   "flex-start",
  },
  wrapperRight: {
    alignItems:  "flex-end",     // .mw.r → right align
    alignSelf:   "flex-end",
  },

  // ── Meta row (username + tags) ───────────────────────────────────────────────
  // .meta class ka RN version
  metaContainer: {
    flexDirection:  "row",
    alignItems:     "center",
    flexWrap:       "wrap",
    gap:            4,
    marginBottom:   4,
    paddingHorizontal: 4,
    maxWidth:       "88%",       // .mw.l > * max-width:88%
  },
  username: {
    fontSize:   11,
    color:      T.textSoft,      // --text-soft
    fontWeight: "600",
  },

  // ── Tags row ─────────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
    gap:           4,
  },

  // .tag-colony
  tagColony: {
    color:      T.textMid,       // --text-mid
    fontWeight: "700",
    fontSize:   11,
    maxWidth:   80,              // max-width:80px, overflow hidden
  },
  tagColonyRight: {
    color: "rgba(255,255,255,0.85)",
  },

  // .tag-verified
  tagVerified: {
    width:           14,
    height:          14,
    borderRadius:    7,          // 50%
    backgroundColor: T.gold,    // --gold
    alignItems:      "center",
    justifyContent:  "center",
  },
  tagVerifiedText: {
    color:    "#FFF",
    fontSize: 8,
    fontWeight: "800",
  },

  // .tag-credits
  tagCredits: {
    backgroundColor: T.goldPale,   // --gold-pale
    borderWidth:     1,
    borderColor:     T.goldBorder,  // --gold-border
    borderRadius:    6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagCreditsText: {
    color:      T.goldDeep,      // --gold-deep
    fontSize:   10,
    fontWeight: "700",
  },

  // .tag-local / .tag-visitor / .tag-ai — same style, alag text
  tagPill: {
    backgroundColor: T.goldPale,
    borderWidth:     1,
    borderColor:     T.goldBorder,
    borderRadius:    5,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  tagPillText: {
    color:          T.goldDeep,
    fontSize:       9,
    fontWeight:     "800",
    textTransform:  "uppercase",
    letterSpacing:  0.4,
  },

  // .tag-moon
  tagMoon: {
    fontSize: 10,
  },

  // .tag-mayor-badge — gradient feel (RN mein gradient nahi, toh closest solid)
  tagMayorBadge: {
    backgroundColor: T.goldPaleWarm,  // closest to linear-gradient(gold-pale → #FFF3CD)
    borderWidth:     1,
    borderColor:     T.goldBorder,
    borderRadius:    5,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  tagMayorBadgeText: {
    color:          T.goldDeep,
    fontSize:       8,
    fontWeight:     "800",
    textTransform:  "uppercase",
    letterSpacing:  0.5,
  },

  // ── Bubble base ──────────────────────────────────────────────────────────────
  // .bubble ke common styles
  bubble: {
    padding:      "10px 14px" as unknown as number,  // RN mein string nahi chalta
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:     14,
    maxWidth:     "88%",
  },

  // .bubble.l — left bubble (doosre ka message)
  bubbleLeft: {
    backgroundColor: T.bubbleLeft,     // #FFFEFB
    borderWidth:     1,
    borderColor:     T.cardBorder,     // #F1E5C8
    borderRadius:    6,                // r-xs top-left
    borderTopLeftRadius:   6,          // .bubble.l → r-xs r-xl r-xl r-xl
    borderTopRightRadius:  18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius:  18,
    // iOS shadow
    shadowColor:     T.gold,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.07,
    shadowRadius:    7,
    elevation:       2,                // Android
  },

  // .bubble.r — apna message (gold gradient)
  // RN mein LinearGradient chahiye gradient ke liye, yahan approximation
  bubbleRight: {
    backgroundColor: T.gold,          // fallback, real app mein LinearGradient use karo
    borderRadius:    18,
    borderTopLeftRadius:     18,       // .bubble.r → r-xl r-xl r-xs r-xl
    borderTopRightRadius:    18,
    borderBottomRightRadius: 6,        // r-xs
    borderBottomLeftRadius:  18,
    // Gold glow shadow
    shadowColor:     T.gold,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.32,
    shadowRadius:    10,
    elevation:       5,
  },

  // .bubble.mayor-bubble — mayor ka special framing
  bubbleMayor: {
    backgroundColor: T.goldPaleWarm,   // linear-gradient(#FFFCF0, #FFF3CD) approx
    borderWidth:     1.5,
    borderColor:     T.goldBorder,
    borderLeftWidth: 3,                // left-border:3px gold — mayor ki pehchaan
    borderLeftColor: T.gold,
    borderRadius:    18,
    borderTopLeftRadius:     6,        // r-xs top-left
    borderTopRightRadius:    18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius:  18,
    shadowColor:     T.gold,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.16,
    shadowRadius:    9,
    elevation:       3,
  },

  // .ai-companion-msg — dashed border, mandatory AI badge
  // RN mein native dashed border limited support hai — workaround: borderStyle 'dashed'
  bubbleAI: {
    backgroundColor: T.goldPaleWarm,
    borderWidth:     1,
    borderColor:     "rgba(201,162,39,0.5)",
    borderStyle:     "dashed",         // AI ki pehchaan — dashed border
    borderRadius:    18,
    borderTopLeftRadius:     6,
    borderTopRightRadius:    18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius:  18,
    shadowColor:     T.gold,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    5,
    elevation:       1,
  },

  // Press state — scale down thoda
  bubblePressed: {
    transform: [{ scale: 0.985 }],
  },

  // ── AI Badge (W-002 mandatory fix) ──────────────────────────────────────────
  // .ai-companion-msg::before ka RN version — har AI message pe dikhe
  aiBadgeRow: {
    flexDirection: "row",
    marginBottom:  6,
  },
  aiBadge: {
    backgroundColor: T.gold,           // gradient approximation
    borderRadius:    6,
    paddingHorizontal: 7,
    paddingVertical:   2,
    // Subtle shadow
    shadowColor:     T.goldDeep,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.3,
    shadowRadius:    1.5,
    elevation:       2,
  },
  aiBadgeText: {
    color:          "#FFFCF0",
    fontSize:       8.5,
    fontWeight:     "800",
    textTransform:  "uppercase",
    letterSpacing:  0.6,
  },

  // ── Mayor label ──────────────────────────────────────────────────────────────
  mayorLabelRow: {
    flexDirection: "row",
    marginBottom:  5,
  },
  mayorLabel: {
    fontSize:   9,
    fontWeight: "700",
    color:      T.goldDeep,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Message text ─────────────────────────────────────────────────────────────
  msgText: {
    fontSize:   14,
    lineHeight: 21,              // 14 * 1.5
    color:      T.textBody,
    fontWeight: "400",
  },
  msgTextRight: {
    color: "#FFFFFF",            // Right bubble pe white text
  },
  msgTextMayor: {
    fontWeight: "500",
    color:      T.textBody,
  },

  // ── .msg-info (time + ticks) ─────────────────────────────────────────────────
  msgInfoRow: {
    flexDirection:  "row",
    justifyContent: "flex-end",
    marginTop:      5,
  },
  msgInfo: {
    fontSize:   10,
    fontWeight: "600",
  },
  msgInfoLeft: {
    color:   T.textSoft,        // --text-soft
    opacity: 1,
  },
  msgInfoRight: {
    color:   "rgba(255,253,243,0.92)",
    opacity: 1,
  },
  msgInfoMayor: {
    color:   T.goldDeep,
    opacity: 0.85,
  },

  // .ticks — double tick
  ticks: {
    fontWeight:    "700",
    letterSpacing: -2,
  },

  // ── Reactions row (.reacts) ──────────────────────────────────────────────────
  reactsRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           6,
    marginTop:     8,
    paddingHorizontal: 6,
    alignItems:    "center",
    alignSelf:     "flex-start",  // Left side by default
  },
  reactsRowRight: {
    alignSelf:      "flex-end",
    justifyContent: "flex-end",
  },

  // .rp — reaction pill
  reactionPill: {
    backgroundColor: T.bubbleLeft,    // #FFFEFB
    borderWidth:     1,
    borderColor:     T.cardBorder,    // #F1E5C8
    borderRadius:    14,
    paddingHorizontal: 10,
    paddingVertical:   4,
    shadowColor:     T.goldDeep,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    1.5,
    elevation:       1,
  },
  reactionPillActive: {
    // Active state — user ne react kiya hai
    backgroundColor: T.goldPale,
    borderColor:     T.goldBorder,
  },
  reactionPillPressed: {
    transform: [{ scale: 0.94 }],
  },
  reactionPillRight: {
    // Right bubble ke neeche slightly different
    backgroundColor: "#FFF8E8",
    borderColor:     T.goldBorder,
  },
  reactionText: {
    fontSize:   11,
    fontWeight: "700",
    color:      T.textMid,
  },

  // .gift-quick-btn
  giftBtn: {
    backgroundColor: T.goldPale,     // gold-pale to #FFF3CD gradient approx
    borderWidth:     1,
    borderColor:     T.goldBorder,
    borderRadius:    12,
    paddingHorizontal: 9,
    paddingVertical:   4,
  },
  giftBtnText: {
    fontSize:   11,
    fontWeight: "700",
    color:      T.goldDeep,
  },

  // Right bubble ke liye meta (tags) row — neeche right side mein
  rightMeta: {
    marginTop:    4,
    alignSelf:    "flex-end",
    paddingHorizontal: 4,
  },
});

export default MessageBubble;

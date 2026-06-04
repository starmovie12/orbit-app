/**
 * NotificationRow — components/organisms/NotificationRow.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: organism
 * Status: new (v2 — avatar+overlay fix) | Priority: P1
 *
 * Source-of-truth spec: MD file § 21 — Notifications Hub Screen · Section [3.B]
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │  80px H · 16px L/R · 12px V padding · 1px cream-400 bottom border         │
 * │  Unread: cream-50 bg + 4px gold-600 absolute left accent bar (§ 21 [3.B])  │
 * │  Read  : white bg · no accent                                              │
 * │                                                                            │
 * │  Left slot (per § 21 [3.B]):                                               │
 * │    Sender categories (mention · spark · mayor):                            │
 * │      · 44×44 initials circle (from meta.fromName)                          │
 * │      · 20×20 white circle overlay @ bottom-right  ← category icon 11px    │
 * │    Non-sender (wallet · achievement · heat · system):                      │
 * │      · 44×44 category icon circle (main avatar IS the icon)                │
 * │      · No overlay (main already communicates type)                         │
 * │                                                                            │
 * │  [Left slot] [Title 14/600/ink-950         ] [ChevronRight 16×16]         │
 * │              [Body  12/400/ink-600 ellipsis ]                              │
 * │              [Time  11/400/ink-500          ]                              │
 * │                                                                            │
 * │  Swipe-left → crimson dismiss zone → onDismiss() at ≥ 80px threshold      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Category → icon, colors, sender-presence:
 *   mention     → MessageSquare  gold-600     hasSender: true
 *   spark       → Heart          crimson-600  hasSender: true
 *   mayor       → Crown          gold-700     hasSender: true
 *   wallet      → Wallet         emerald-600  hasSender: false
 *   achievement → Trophy         gold-600     hasSender: false
 *   heat        → Flame          amber-600    hasSender: false
 *   system      → Bell           ink-600      hasSender: false
 *
 * Deps: constants/colors · types/cw · (no external atoms — avatar is self-contained)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  ChevronRight,
  Crown,
  Flame,
  Heart,
  MessageSquare,
  Trash2,
  Trophy,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import {
  colors,
  palette,
  typography,
  spacing,
  radii,
} from '@/constants/colors';
import type { CWNotification, CWNotificationCategory } from '@/types/cw';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS  (blueprint § 21 Section [3.B] · 8pt grid)
// ─────────────────────────────────────────────────────────────────────────────

/** Row min-height per blueprint § 21 Section [3.B]. */
const ROW_H = 80 as const;

/** Avatar circle diameter. Blueprint: "Avatar 44×44". */
const AVATAR_SIZE = 44 as const;

/**
 * Overlay badge outer diameter.
 * Blueprint: "16×16 in 20×20 white bg circle".
 */
const OVERLAY_SIZE    = 20 as const;
const OVERLAY_ICON_PX = 11 as const;  // glyph inside 20×20 — ~4-5px pad per side

/**
 * Overlay bleed offset from avatar bottom-right corner.
 * Sits -3px outside to achieve the "badge popping out" look.
 * Still within the 12px gap between avatar and meta column — no overflow clip needed.
 */
const OVERLAY_OFFSET = -3 as const;

/**
 * Unread left accent bar width.
 * Blueprint § 21 Section [3.B] verbatim: "4px gold-600 left accent border".
 */
const UNREAD_BAR_W = 4 as const;

/**
 * Swipe-to-dismiss threshold in px.
 * Blueprint gesture table (line 6739): "List item swipe · 80px threshold".
 */
const SWIPE_THRESHOLD = -80 as const;

/** Max horizontal travel during swipe before clamping. */
const DISMISS_ZONE_W = 80 as const;

const DISMISS_DURATION = 220 as const;
const SPRING_TENSION   = 140 as const;
const SPRING_FRICTION  = 14  as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — CATEGORY CONFIG
// Stores the Lucide component reference directly — avoids any runtime
// string→component lookup and gives full TypeScript safety.
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryConfig {
  /** Lucide icon component — used in both main circle and overlay badge. */
  Icon: LucideIcon;
  /** Container bg tint — applied to main avatar circle for non-sender categories. */
  bg: string;
  /** Icon glyph color. */
  color: string;
  /**
   * true  → sender categories: show initials circle + category icon overlay badge.
   * false → non-sender categories: category icon IS the main 44×44 avatar (no overlay).
   * Blueprint § 21 [3.B]: "sender's photo · or category icon if system notification".
   */
  hasSender: boolean;
}

const CATEGORY_CONFIG: Record<CWNotificationCategory, CategoryConfig> = {
  mention: {
    Icon:      MessageSquare,
    bg:        palette.cream[200],
    color:     palette.gold[600],
    hasSender: true,
  },
  spark: {
    Icon:      Heart,
    bg:        colors.bg.errorSoft,      // rgba(196,41,79,0.10) — crimson wash
    color:     palette.crimson[600],
    hasSender: true,
  },
  mayor: {
    Icon:      Crown,
    bg:        palette.gold[100],
    color:     palette.gold[700],
    hasSender: true,
  },
  wallet: {
    Icon:      Wallet,
    bg:        colors.bg.successSoft,    // rgba(26,122,74,0.10) — emerald wash
    color:     palette.emerald[600],
    hasSender: false,
  },
  achievement: {
    Icon:      Trophy,
    bg:        palette.gold[50],
    color:     palette.gold[600],
    hasSender: false,
  },
  heat: {
    Icon:      Flame,
    bg:        colors.bg.warningSoft,    // rgba(212,101,26,0.10) — amber wash
    color:     palette.amber[600],
    hasSender: false,
  },
  system: {
    Icon:      Bell,
    bg:        palette.cream[200],
    color:     palette.ink[600],
    hasSender: false,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive 1–2 uppercase initials from a display name.
 * Used for sender avatar fallback when no photoURL is available.
 *
 * @example getInitials("Aman Sharma") → "AS"
 * @example getInitials("Priya")       → "PR"
 * @example getInitials(undefined)     → "?"
 */
function getInitials(name: string | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Hinglish relative-time string from Unix-ms timestamp.
 * Blueprint § 21 copy spec: "5 min pehle" · "2 ghante pehle" · "Kal".
 *
 * @example formatTime(Date.now() - 300_000)    → "5 min pehle"
 * @example formatTime(Date.now() - 7_200_000)  → "2 ghante pehle"
 */
function formatTime(ms: number): string {
  const diffMs = Date.now() - ms;
  const secs   = Math.floor(diffMs / 1_000);
  const mins   = Math.floor(secs  / 60);
  const hours  = Math.floor(mins  / 60);
  const days   = Math.floor(hours / 24);

  if (secs  <  60) return 'Abhi';
  if (mins  <  60) return `${mins} min pehle`;
  if (hours <  24) return `${hours} ghante pehle`;
  if (days === 1)  return 'Kal';
  if (days  <   7) return `${days} din pehle`;

  // Older → "2 May" (Indian locale short format)
  return new Date(ms).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — AVATAR SLOT (extracted sub-component for readability + memo isolation)
//
// Sender notification  → 44×44 initials circle + 20×20 category icon overlay
// System notification  → 44×44 category icon circle directly (no overlay)
// ─────────────────────────────────────────────────────────────────────────────

interface AvatarSlotProps {
  cfg:      CategoryConfig;
  fromName: string | undefined;
}

const AvatarSlot: React.FC<AvatarSlotProps> = memo(({ cfg, fromName }) => {
  const { Icon, bg, color, hasSender } = cfg;

  return (
    <View style={styles.avatarWrapper}>

      {hasSender ? (
        /*
         * Sender category — initials circle.
         * gold[50] bg + gold[800] text = 6.4:1 contrast (AA) ✓
         * Chosen over ink[950] to stay on-brand at this focal point.
         */
        <View style={styles.initialsCircle}>
          <Text
            style={styles.initialsText}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {getInitials(fromName)}
          </Text>
        </View>
      ) : (
        /*
         * Non-sender category — icon IS the avatar.
         * Blueprint § 21 [3.B]: "category icon if system notification".
         * Matches the 44×44 circle pattern from TransactionRow for consistency.
         */
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Icon size={20} color={color} strokeWidth={1.5} />
        </View>
      )}

      {hasSender && (
        /*
         * Category icon overlay badge — sender rows only.
         * Blueprint § 21 [3.B]: "16×16 in 20×20 white bg circle" @ bottom-right.
         * 1.5px white border separates badge from any initials bg colour.
         * OVERLAY_OFFSET (-3px) creates the standard "badge pops out" look while
         * staying within the 12px gap before the meta column — no clipping.
         */
        <View style={styles.overlayBadge}>
          <Icon
            size={OVERLAY_ICON_PX}
            color={color}
            strokeWidth={2}     // slightly heavier at 11px — stays crisp on screen
          />
        </View>
      )}

    </View>
  );
});

AvatarSlot.displayName = 'NotificationRow.AvatarSlot';

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationRowProps {
  /** Fully-typed CROWN notification deserialized from Firestore. */
  notification: CWNotification;
  /**
   * Called on row tap.
   * Parent responsibility: navigate to `meta.route` AND mark as read in Firestore.
   */
  onPress: () => void;
  /**
   * Called on long-press (≥ 400ms).
   * Parent should open § 21 action sheet:
   *   "Mark as read/unread" · "Mute this {sender|sector|type}" · "Delete" · "Cancel"
   */
  onLongPress?: () => void;
  /**
   * Called after the dismiss fly-out animation completes (swipe ≥ 80px threshold).
   * Parent is responsible for removing the item from the list and Firestore.
   */
  onDismiss?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NotificationRow
 *
 * Production-ready per blueprint § 21 Section [3.B]. Key guarantees:
 *
 *   VISUAL STATE
 *     Unread  · cream-50 bg + 4px gold-600 left accent bar (absolute, no padding shift)
 *     Read    · white bg · no accent
 *     Pressed · cream-300 flash (Pressable state)
 *
 *   LEFT AVATAR SLOT  (§ 21 [3.B] "Avatar 44×44 … category icon overlay bottom-right")
 *     Sender (mention, spark, mayor):
 *       44×44 gold-50 initials circle (meta.fromName → "AS") +
 *       20×20 white overlay badge @ bottom-right with 11px category icon
 *     Non-sender (wallet, achievement, heat, system):
 *       44×44 category icon circle — icon IS the avatar, no overlay
 *
 *   META COLUMN  (flex-1, min-width:0 for proper ellipsis)
 *     title  14px 600 ink-950 · 1-line ellipsis
 *     body   12px 400 ink-600 · 1-line ellipsis
 *     time   11px 400 ink-500 · Hinglish relative ("5 min pehle", "Kal", "2 May")
 *
 *   SWIPE-LEFT DISMISS  (PanResponder, no Reanimated dependency)
 *     dx < -8 AND |dx| > |dy| — prevents scroll false-positives
 *     80px threshold → fly-out (220ms) → onDismiss()
 *     < 80px release → spring snap-back (tension:140 / friction:14)
 *     Crimson dismiss zone + Trash2 icon fades in behind row during swipe
 *
 *   ACCESSIBILITY
 *     accessibilityRole="button" · full label (read state + title + body + time)
 *     accessibilityState.checked = !read (unread = logically "checked" for SR)
 *     accessibilityHint for long-press (when onLongPress is provided)
 *     Dismiss zone hidden from accessibility tree
 *
 * @example
 * <NotificationRow
 *   notification={item}
 *   onPress={() => {
 *     router.push(item.meta.route ?? '/notifications');
 *     markNotificationRead(item.id);
 *   }}
 *   onLongPress={() => openActionSheet(item)}
 *   onDismiss={() => deleteNotification(item.id)}
 * />
 */
const NotificationRow: React.FC<NotificationRowProps> = ({
  notification,
  onPress,
  onLongPress,
  onDismiss,
}) => {
  const { read, category, title, body, createdAtMs, meta } = notification;
  const cfg  = CATEGORY_CONFIG[category];
  const time = formatTime(createdAtMs);

  // ── Swipe-to-dismiss (PanResponder + core Animated) ───────────────────────

  const translateX = useRef(new Animated.Value(0)).current;

  const snapBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue:         0,
      tension:         SPRING_TENSION,
      friction:        SPRING_FRICTION,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const triggerDismiss = useCallback(() => {
    Animated.timing(translateX, {
      toValue:         -500,
      duration:        DISMISS_DURATION,
      useNativeDriver: true,
    }).start(() => onDismiss?.());
  }, [translateX, onDismiss]);

  const panResponder = useRef(
    PanResponder.create({
      // Never steal on first contact — tap + long-press fire without interference.
      onStartShouldSetPanResponder: () => false,

      // Only claim clear leftward horizontal swipes.
      // |dx| > |dy| guard: vertical FlatList scroll always wins.
      // iOS edge-swipe zone (left 16px) handled by React Navigation — no conflict.
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        dx < -8 && Math.abs(dx) > Math.abs(dy),

      // Translate row directly from finger.
      // Clamp: [−DISMISS_ZONE_W×2 … 0] — no rightward drift, sensible max left.
      onPanResponderMove: (_, { dx }) => {
        translateX.setValue(Math.max(-(DISMISS_ZONE_W * 2), Math.min(0, dx)));
      },

      onPanResponderRelease: (_, { dx }) => {
        dx < SWIPE_THRESHOLD ? triggerDismiss() : snapBack();
      },

      // Gesture stolen (e.g. parent ScrollView claims it): restore cleanly.
      onPanResponderTerminate: () => snapBack(),
    })
  ).current;

  // Crimson dismiss zone fades in proportionally as the row slides left.
  const dismissOpacity = translateX.interpolate({
    inputRange:  [SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>

      {/* ── [A] Crimson dismiss zone — behind row · fades in on swipe ──── */}
      <Animated.View
        style={[styles.dismissZone, { opacity: dismissOpacity }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Trash2 size={20} color={palette.white} strokeWidth={1.5} />
        <Text style={styles.dismissLabel}>Delete</Text>
      </Animated.View>

      {/* ── [B] Swipeable row ─────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.rowShell,
          read ? styles.shellRead : styles.shellUnread,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 4px gold-600 unread accent bar — absolute left edge, full height */}
        {!read && <View style={styles.unreadAccent} />}

        <Pressable
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={
            `${read ? '' : 'Unread. '}${title}. ${body}. ${time}. Tap to view.`
          }
          accessibilityHint={
            onLongPress
              ? 'Double tap to view. Hold for more options.'
              : 'Double tap to view.'
          }
          accessibilityState={{ checked: !read }}
        >

          {/* ── [1] Avatar slot ─────────────────────────────────────── */}
          <AvatarSlot cfg={cfg} fromName={meta.fromName} />

          {/* ── [2] Meta — title · body · time ──────────────────────── */}
          <View style={styles.meta}>
            <Text
              style={styles.title}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <Text
              style={styles.body}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {body}
            </Text>
            <Text style={styles.time} numberOfLines={1}>
              {time}
            </Text>
          </View>

          {/* ── [3] ChevronRight ────────────────────────────────────── */}
          <ChevronRight
            size={16}
            color={colors.fg.tertiary}    // ink-500
            strokeWidth={1.5}
          />

        </Pressable>
      </Animated.View>

    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — STYLES
// All values sourced from blueprint § 21 Section [3.B] + 8pt grid.
// Zero raw hex — every color via tokens (palette.* / colors.*).
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Outer wrapper — clips dismiss-zone backdrop bleed ────────────────────
  wrapper: {
    overflow:        'hidden',
    backgroundColor: palette.crimson[600],   // dismiss bg visible through row gap
  },

  // ── Dismiss zone ─────────────────────────────────────────────────────────
  dismissZone: {
    ...StyleSheet.absoluteFillObject,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    paddingRight:   spacing.xl,              // 24px — icon+label breathing room
    gap:            spacing.xs,              // 4px
  },

  dismissLabel: {
    ...typography.label,                     // 12px 600 lineHeight:16
    color:         palette.white,
    letterSpacing: 0.3,
  },

  // ── Animated shell (translateX drives swipe) ──────────────────────────────
  rowShell: {
    position: 'relative',                    // anchors unreadAccent + overlay badge
  },

  shellRead: {
    backgroundColor: colors.bg.surface,      // white
  },

  shellUnread: {
    backgroundColor: colors.bg.subtle,       // cream-50 — Warm Ivory Cream
  },

  // ── 4px unread accent bar — absolute · left edge · full height ────────────
  // Blueprint § 21 [3.B] verbatim: "4px gold-600 left accent border".
  // Absolute positioning keeps the content padding at exactly 16px (8pt grid ✓).
  unreadAccent: {
    position:        'absolute',
    left:             0,
    top:              0,
    bottom:           0,
    width:            UNREAD_BAR_W,           // 4px
    backgroundColor:  palette.gold[600],      // Champagne Gold #C9A227
    zIndex:           1,
  },

  // ── Pressable row content area ────────────────────────────────────────────
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    minHeight:         ROW_H,                // 80px
    paddingHorizontal: spacing.base,         // 16px L/R
    paddingVertical:   spacing.md,           // 12px V
    gap:               spacing.md,           // 12px between left/meta/chevron
    borderBottomWidth:  1,
    borderBottomColor:  colors.border.default,   // cream-400
  },

  rowPressed: {
    backgroundColor: colors.bg.cardPressed,  // cream-300 — brief press flash
  },

  // ── Avatar slot wrapper ───────────────────────────────────────────────────
  // Fixed 44×44; position:relative anchors the absolute overlay badge.
  avatarWrapper: {
    width:      AVATAR_SIZE,                 // 44
    height:     AVATAR_SIZE,                 // 44
    position:  'relative',
    flexShrink: 0,
  },

  // ── Initials circle (sender categories) ──────────────────────────────────
  // gold[50] bg + gold[800] text = 6.4:1 AA contrast ✓ (§ 15 audit in colors.ts)
  initialsCircle: {
    width:           AVATAR_SIZE,            // 44
    height:          AVATAR_SIZE,            // 44
    borderRadius:    radii.full,
    backgroundColor: palette.gold[50],
    alignItems:      'center',
    justifyContent:  'center',
  },

  initialsText: {
    fontSize:    16,
    fontWeight:  '700',
    lineHeight:  20,
    color:       palette.gold[800],          // 6.4:1 on gold[50] (§ 15 audit) ✓
    letterSpacing: 0.5,
  },

  // ── Category icon circle (non-sender categories) ──────────────────────────
  // Matches 44×44 circle pattern from TransactionRow for visual consistency.
  // backgroundColor injected inline from cfg.bg.
  iconCircle: {
    width:           AVATAR_SIZE,            // 44
    height:          AVATAR_SIZE,            // 44
    borderRadius:    radii.full,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Category icon overlay badge (sender rows only) ────────────────────────
  // Blueprint § 21 [3.B]: "16×16 in 20×20 white bg circle" @ bottom-right.
  // OVERLAY_OFFSET = -3px bleed, absorbed by 12px gap before meta column.
  // 1.5px white border creates visual separation from initials background.
  overlayBadge: {
    position:        'absolute',
    bottom:           OVERLAY_OFFSET,        // -3
    right:            OVERLAY_OFFSET,        // -3
    width:            OVERLAY_SIZE,          // 20
    height:           OVERLAY_SIZE,          // 20
    borderRadius:     radii.full,
    backgroundColor:  palette.white,
    alignItems:       'center',
    justifyContent:   'center',
    borderWidth:      1.5,
    borderColor:      palette.white,         // white-on-white = hairline separator
  },

  // ── Meta column (flex-1) ──────────────────────────────────────────────────
  meta: {
    flex:    1,
    gap:     2,        // 2px between title/body, body/time — § 21 [3.B] spec
    minWidth: 0,       // required for numberOfLines ellipsis inside flex child
  },

  // Title · blueprint § 21 [3.B]: "14px 600 ink-950 · 1 line ellipsis"
  title: {
    fontSize:   14,
    fontWeight: '600',
    lineHeight: 20,
    color:      colors.fg.primary,           // ink-950
  },

  // Body preview · blueprint § 21 [3.B]: "12px 400 ink-600 · 1 line ellipsis"
  body: {
    fontSize:   12,
    fontWeight: '400',
    lineHeight: 16,
    color:      colors.fg.secondary,         // ink-600
  },

  // Timestamp · blueprint § 21 [3.B]: "11px 400 ink-500 · 4px below preview"
  time: {
    ...typography.caption,                   // 11px 400 lineHeight:15
    color:     colors.fg.tertiary,           // ink-500
    marginTop: 2,                            // gap + lineHeight achieves ~4px below body
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — EXPORT
// Both NotificationRow and AvatarSlot are wrapped in React.memo.
// CWNotification fields are flat primitives — shallow compare is safe and
// efficient for long notification lists.
// ─────────────────────────────────────────────────────────────────────────────

export default memo(NotificationRow);

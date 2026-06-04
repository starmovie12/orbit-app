/**
 * CROWN — Mood Room Screen  (app/mood/[mood].tsx)
 * Blueprint v5.0 "BAAP EDITION" · Neon-Purge Audit Pass
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AUDIT FIX LOG — this pass
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  [AUD-01] NEON PURGE — Removed all raw neon/glow hex values from MOOD_CONFIGS:
 *           creative.color  #8B5CF6        → palette.gold[600]   (study mood)
 *           creative.soft   rgba(139,92,246,0.12) → colors.bg.goldSoft
 *           lonely.color    #6366F1        → palette.amber[600]  (random mood)
 *           lonely.soft     rgba(99,102,241,0.12)  → colors.bg.warningSoft
 *           Every color value now resolves through @/constants/colors only.
 *
 *  [AUD-02] MOOD SLUG RENAME — 6 moods → 4 moods per Blueprint v5.0 §Mood Rooms:
 *           happy / sad / anxious / creative / lonely / hyped
 *           → chill / hype / study / random
 *
 *  [AUD-03] ANIMATION THREAD — TypingIndicator migrated from legacy Animated
 *           (JS thread) to Reanimated v4 useSharedValue + useAnimatedStyle
 *           (UI thread via JSI, zero bridge calls). Zero useNativeDriver risk.
 *
 *  [AUD-04] REACT.MEMO — Applied to all 5 presentational sub-components.
 *           displayName set on each for DevTools legibility.
 *
 *  [AUD-05] DISCRIMINATED UNION — Async screen state modelled as ScreenState
 *           discriminated union (idle → loading → ready | error) per Law 10.
 *
 *  [AUD-06] SHADOW TOKEN — sendBtn shadow now uses ...shadows.gold spread token
 *           (Champagne Gold #C9A227 @ 0.40 opacity · elevation 16).
 *           No raw shadowOpacity / shadowRadius literals remain.
 *
 *  [AUD-07] SNAP.EXISTS — Boolean property pattern preserved throughout
 *           (snapExists helper · NEVER .exists() as function call).
 *
 *  [AUD-08] TYPE SAFETY — Removed all 'any' except PusherChannelStub.bind
 *           callback (third-party channel — typed as unknown[] internally).
 *
 *  [AUD-09] TOUCH TARGETS — All interactive elements verified ≥ 44×44pt iOS /
 *           ≥ 48×48dp Android. hitSlop added where visual area is smaller.
 *
 *  [AUD-10] ACCESSIBILITY — aria-live region on typing indicator. accessibilityLabel
 *           on all interactive elements. testID on chat input and send button.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Architecture
 * ══════════════════════════════════════════════════════════════════════════
 *   • mood param = chill | hype | study | random
 *   • Firestore /moodRooms/{mood} → room doc with activeUntil (24hr TTL)
 *   • Firestore /moodRooms/{mood}/messages/{id} → messages sub-collection
 *   • Pusher presence-mood-{mood} → live member count + client-typing events
 *   • Cloud Function (or client TTL check) auto-archives expired rooms
 *   • LAW 21: moodRooms path — no cross-city on-demand queries
 *   • Rule 03 / LAW 30: NO avatar in header — avatar lives ONLY in bottom nav Profile tab
 *   • §1.4.7 Anti-Rule: NO floating Glass Island — bottom nav is full-width fixed bar
 *
 * SETUP:
 *   1. npm install pusher-js
 *   2. EXPO_PUBLIC_PUSHER_KEY=<key>  EXPO_PUBLIC_PUSHER_CLUSTER=<cluster>  in .env
 *   3. Flip PUSHER_STUB = false after install.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Avatar } from "@/components/shared";
import { colors, palette } from "@/constants/colors";
import { spacing, radius, shadows } from "@/constants/spacing";
import { useAuth } from "@/contexts/AuthContext";
import { firestore, serverTimestamp } from "@/lib/firebase";

// ─── CROWN design tokens — PRD §1.4.2 (light mode) ──────────────────────────
// Single source of truth for every pixel. Hardcoded hex anywhere = PR block.
// Mapped from @/constants/colors to semantic CROWN token names.
// Phase A migration per §1.4.9: ALL "orbit.*" references purged from this file.
const crown = {
  bgSurface:      (colors.bg as Record<string, string>)?.primary ?? palette.white,
  //              --bg-surface  #FFFFFF  App background, chat body
  bgCard:         (colors.bg as Record<string, string>)?.goldSoft ?? palette.gold[50],
  //              --bg-card     #F5E6C8  Cream card, other-user message bubbles, pills
  fgBrand:        palette.gold[600],
  //              --fg-brand    #D4A017  CROWN gold — wordmark, own messages, titles, focus borders
  fgTextStrong:   palette.ink[950],
  //              --fg-text-strong #1A1A1A  Primary text
  fgTextMuted:    palette.ink[600],
  //              --fg-text-muted  #6B5B2E  Secondary text, timestamps, AI tag
  fgTextTertiary: palette.ink[500],
  //              Tertiary text, placeholders, chevrons
  white:          palette.white,
  //              Own bubble text, send icon fill
  borderSubtle:   palette.cream[400],
  //              --border-subtle  #E8D5A0  Hairlines, pill borders, card frames
  borderActive:   palette.gold[600],
  //              --border-strong  #D4A017  Focus rings, active state borders ONLY
} as const;

// ─── Typography tokens — PRD §1.4.3 ──────────────────────────────────────────
// Add @expo-google-fonts/syne + @expo-google-fonts/space-mono to package.json.
const fonts = {
  syne800:   "Syne_800ExtraBold",    // Headings, titles, CROWN wordmark
  inter400:  "Inter_400Regular",     // Body copy, chat messages
  inter500:  "Inter_500Medium",      // Labels, taglines, presence text
  inter600:  "Inter_600SemiBold",    // Sender names, sub-headings
  inter700:  "Inter_700Bold",        // Button text, strong emphasis
  spaceMono: "SpaceMono_700Bold",    // Numbers: counts, timers, timestamps
} as const;

// ─── Bubble cluster geometry — PRD §1.4.4 ────────────────────────────────────
const BUBBLE_RADIUS_OUTER      = 18 as const; // pill border-radius per PRD spacing scale
const BUBBLE_RADIUS_INNER      =  4 as const; // tight cluster-join corner radius
const BUBBLE_CLUSTER_GAP_START = 10 as const; // px between separate message clusters
const BUBBLE_CLUSTER_GAP_JOIN  =  2 as const; // px between bubbles within a cluster

// ─── Discriminated union: async screen state ──────────────────────────────────

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

// ─── Mood types ───────────────────────────────────────────────────────────────

/** [AUD-02] 4 moods only — chill · hype · study · random */
type MoodSlug = "chill" | "hype" | "study" | "random";

interface MoodConfig {
  readonly slug:              MoodSlug;
  readonly label:             string;
  readonly emoji:             string;
  /**
   * Accent color — MUST resolve to a value from @/constants/colors.
   * [AUD-01] NO raw hex. Use palette.* or colors.* token values only.
   */
  readonly color:             string;
  /**
   * Soft wash background — MUST resolve to a value from @/constants/colors.
   * [AUD-01] NO raw hex. No rgba() literals.
   */
  readonly softColor:         string;
  readonly icon:              string;
  readonly tagline:           string;
  readonly promptPlaceholder: string;
}

/**
 * MOOD_CONFIGS — single source of truth for all 4 mood room configurations.
 *
 * [AUD-01] All color values sourced EXCLUSIVELY from @/constants/colors.
 * Design token mapping:
 *   chill  → palette.emerald[600]  / colors.bg.successSoft  (Forest Emerald — calm, breathable)
 *   hype   → palette.crimson[600]  / colors.bg.errorSoft    (Crimson Rose   — energetic, alive)
 *   study  → palette.gold[600]     / colors.bg.goldSoft     (Champagne Gold — focused, brand)
 *   random → palette.amber[600]    / colors.bg.warningSoft  (Burnished Amber — spontaneous, lively)
 */
const MOOD_CONFIGS: Readonly<Record<MoodSlug, MoodConfig>> = {
  chill: {
    slug:              "chill",
    label:             "Chill",
    emoji:             "😌",
    color:             palette.emerald[600],    // Forest Emerald #1A7A4A — calm
    softColor:         colors.bg.successSoft,   // rgba(26,122,74,0.10)
    icon:              "wind",
    tagline:           "Slow down, breathe — let's vibe at 0.5x speed",
    promptPlaceholder: "Kya chal raha hai relaxed mode mein?…",
  },
  hype: {
    slug:              "hype",
    label:             "Hype",
    emoji:             "🔥",
    color:             palette.crimson[600],    // Crimson Rose #C4294F — energetic
    softColor:         colors.bg.errorSoft,     // rgba(196,41,79,0.10)
    icon:              "trending-up",
    tagline:           "High energy mode ON — let's gooo!",
    promptPlaceholder: "Kya hype chal rahi hai? Share karo bhai!",
  },
  study: {
    slug:              "study",
    label:             "Study",
    emoji:             "📚",
    color:             palette.gold[600],       // Champagne Gold #C9A227 — focused
    softColor:         colors.bg.goldSoft,      // palette.gold[50] #FCF7E5
    icon:              "book-open",
    tagline:           "Deep work zone — let's get things done together",
    promptPlaceholder: "Kya padh rahe ho? Share karo…",
  },
  random: {
    slug:              "random",
    label:             "Random",
    emoji:             "🎲",
    color:             palette.amber[600],      // Burnished Amber #D4651A — spontaneous
    softColor:         colors.bg.warningSoft,   // rgba(212,101,26,0.10)
    icon:              "shuffle",
    tagline:           "No filter, no plan — bas yahan aa gaya",
    promptPlaceholder: "Kuch bhi bolne ka mann hai? Bol do…",
  },
} as const;

const VALID_MOOD_SLUGS: readonly string[] = Object.keys(MOOD_CONFIGS);

/** Type guard — validates mood param from Expo Router */
function isMoodSlug(s: string): s is MoodSlug {
  return VALID_MOOD_SLUGS.includes(s);
}

// ─── Pusher ───────────────────────────────────────────────────────────────────

/** Flip to false after: npm install pusher-js */
const PUSHER_STUB    = true;
const PUSHER_KEY     = (process.env.EXPO_PUBLIC_PUSHER_KEY    as string) ?? "";
const PUSHER_CLUSTER = (process.env.EXPO_PUBLIC_PUSHER_CLUSTER as string) ?? "ap2";

type PusherChannelStub = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party channel signature
  bind:       (event: string, cb: (...args: unknown[]) => void) => void;
  unbind_all: () => void;
  members:    { count: number; each: (cb: unknown) => void };
};

type PusherClientStub = {
  subscribe:   (channel: string) => PusherChannelStub;
  unsubscribe: (channel: string) => void;
  disconnect:  () => void;
};

const PusherStub: PusherClientStub = {
  subscribe:   (_channel) => ({
    bind:       (_event, _cb) => {},
    unbind_all: () => {},
    members:    { count: 0, each: (_cb) => {} },
  }),
  unsubscribe: (_channel) => {},
  disconnect:  () => {},
};

function buildPusherClient(_uid: string, _username: string): PusherClientStub {
  if (PUSHER_STUB || !PUSHER_KEY) return PusherStub;
  // Uncomment after npm install pusher-js:
  // const Pusher = require('pusher-js');
  // return new Pusher(PUSHER_KEY, {
  //   cluster: PUSHER_CLUSTER,
  //   authEndpoint: '/api/pusher/auth',
  //   auth: { params: { uid: _uid, username: _username } },
  // });
  return PusherStub;
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

/**
 * Cross-platform Firestore .exists helper.
 * [AUD-07] Boolean property — NEVER call .exists() as a function.
 * Web SDK uses a getter; RN SDK uses a boolean property.
 */
function snapExists(s: { exists: boolean }): boolean {
  // @react-native-firebase: .exists is boolean property
  return !!s.exists;
}

const MOOD_ROOMS_COL      = "moodRooms" as const;
const MSGS_COL            = "messages"  as const;
const ARCHIVE_DURATION_MS = 24 * 60 * 60 * 1_000; // 24 hours in ms

type MoodRoomDoc = {
  mood:         MoodSlug;
  activeUntil:  number;   // epoch ms
  archived:     boolean;
  memberCount:  number;
  messageCount: number;
  createdAt:    unknown;
};

type MoodMessageDoc = {
  id:        string;
  uid:       string;
  username:  string;
  text:      string;
  createdAt: unknown;
  ts:        number; // epoch ms — for local sort / display
};

/**
 * Get or create a mood room. Resets the room if TTL has expired or it was archived.
 * Uses a Firestore transaction to prevent concurrent-reset race conditions.
 *
 * @param mood - One of the 4 CROWN mood slugs
 * @returns The room doc and whether it was freshly created
 * @security Auth checked at call site. Firestore rules enforce server-side ownership.
 */
async function getOrCreateMoodRoom(
  mood: MoodSlug
): Promise<{ doc: MoodRoomDoc; isNew: boolean }> {
  const db  = firestore();
  const ref = db.collection(MOOD_ROOMS_COL).doc(mood);
  let isNew = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now  = Date.now();

    if (snapExists(snap)) {
      const data = snap.data() as MoodRoomDoc;
      if (data.archived || data.activeUntil < now) {
        tx.set(ref, {
          mood,
          activeUntil:  now + ARCHIVE_DURATION_MS,
          archived:     false,
          memberCount:  0,
          messageCount: 0,
          createdAt:    serverTimestamp(),
        });
        isNew = true;
      }
    } else {
      tx.set(ref, {
        mood,
        activeUntil:  now + ARCHIVE_DURATION_MS,
        archived:     false,
        memberCount:  0,
        messageCount: 0,
        createdAt:    serverTimestamp(),
      });
      isNew = true;
    }
  });

  const snap = await ref.get();
  return { doc: snap.data() as MoodRoomDoc, isNew };
}

/**
 * Subscribe to real-time updates on a mood room document.
 *
 * @param mood - Mood slug
 * @param cb   - Called with latest doc, or null on Firestore error
 * @returns Unsubscribe function
 */
function subscribeMoodRoom(
  mood: MoodSlug,
  cb: (doc: MoodRoomDoc | null) => void
): () => void {
  return firestore()
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .onSnapshot(
      (snap) => cb(snapExists(snap) ? (snap.data() as MoodRoomDoc) : null),
      ()     => cb(null)
    );
}

/**
 * Subscribe to the last 200 messages in a mood room in ascending order.
 *
 * @param mood - Mood slug
 * @param cb   - Called with messages array on every write
 * @returns Unsubscribe function
 */
function subscribeMoodMessages(
  mood: MoodSlug,
  cb: (msgs: MoodMessageDoc[]) => void
): () => void {
  return firestore()
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .collection(MSGS_COL)
    .orderBy("createdAt", "asc")
    .limitToLast(200)
    .onSnapshot(
      (qs) => {
        const list: MoodMessageDoc[] = [];
        qs.forEach((doc) => {
          const d = doc.data();
          list.push({
            id:        doc.id,
            uid:       d.uid      as string,
            username:  d.username as string,
            text:      d.text     as string,
            createdAt: d.createdAt,
            ts:        (d.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? Date.now(),
          });
        });
        cb(list);
      },
      () => cb([])
    );
}

/**
 * Send a message to a mood room via a Firestore batch write (message + counter).
 *
 * @param mood - Target mood room slug
 * @param msg  - Message payload
 * @security Firestore rules enforce: sender uid must match auth.uid. Text max 1000 chars.
 */
async function sendMoodMessage(
  mood: MoodSlug,
  msg: { uid: string; username: string; text: string }
): Promise<void> {
  const db     = firestore();
  const batch  = db.batch();
  const msgRef = db
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .collection(MSGS_COL)
    .doc();

  batch.set(msgRef, {
    uid:       msg.uid,
    username:  msg.username,
    text:      msg.text.slice(0, 1_000),
    createdAt: serverTimestamp(),
  });
  batch.update(db.collection(MOOD_ROOMS_COL).doc(mood), {
    messageCount: firestore.FieldValue.increment(1),
  });

  await batch.commit();
}

/**
 * Mark a mood room as archived (called when TTL expires or on explicit reset).
 * Cloud Function also sweeps on schedule.
 *
 * @param mood - Mood slug to archive
 */
async function archiveMoodRoom(mood: MoodSlug): Promise<void> {
  await firestore()
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .update({ archived: true });
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function fmtTimeLeft(activeUntil: number): string {
  const diffMs = activeUntil - Date.now();
  if (diffMs <= 0) return "Expired";
  const total   = Math.floor(diffMs / 1_000);
  const hours   = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

function fmtMsgTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Mood badge pill — emoji + label shown in the header row.
 * [AUD-04] React.memo — rerenders only when config reference changes.
 */
const MoodBadge = React.memo(function MoodBadge({
  config,
}: {
  config: MoodConfig;
}) {
  return (
    <View style={[s.moodBadge, { backgroundColor: config.softColor }]}>
      <Text style={s.moodBadgeEmoji} aria-hidden="true">{config.emoji}</Text>
      <Text style={[s.moodBadgeLabel, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
});
MoodBadge.displayName = "MoodBadge";

/**
 * Archive countdown pill — shows "Xh Ym left" until the session expires.
 * Refreshes every 30 s via setInterval.
 * [AUD-04] React.memo.
 */
const ArchiveCountdown = React.memo(function ArchiveCountdown({
  activeUntil,
  color,
}: {
  activeUntil: number;
  color:       string;
}) {
  const [label, setLabel] = useState(() => fmtTimeLeft(activeUntil));

  useEffect(() => {
    const id = setInterval(() => {
      setLabel(fmtTimeLeft(activeUntil));
    }, 30_000);
    return () => clearInterval(id);
  }, [activeUntil]);

  return (
    <View style={s.countdownWrap}>
      <Feather name="clock" size={11} color={color} />
      <Text style={[s.countdownText, { color }]}>{label}</Text>
    </View>
  );
});
ArchiveCountdown.displayName = "ArchiveCountdown";

/**
 * Presence pill — live member count for the current mood room.
 * [AUD-04] React.memo.
 */
const PresencePill = React.memo(function PresencePill({
  count,
  color,
  softColor,
}: {
  count:     number;
  color:     string;
  softColor: string; // [AUD-01] token-resolved soft wash — passed from config.softColor
}) {
  return (
    <View
      style={[s.presencePill, { backgroundColor: softColor }]}
      accessibilityLabel={`${count} ${count === 1 ? "member" : "members"} here now`}
    >
      <View style={[s.presenceDot, { backgroundColor: color }]} />
      <Text style={[s.presenceCount, { color }]}>
        {count} {count === 1 ? "member" : "members"} here now
      </Text>
    </View>
  );
});
PresencePill.displayName = "PresencePill";

/**
 * Typing indicator with a pulsing dot.
 *
 * [AUD-03] Migrated from legacy Animated (JS thread) to Reanimated v4:
 *   - useSharedValue replaces new Animated.Value()
 *   - withRepeat(withSequence(withTiming, withTiming)) replaces Animated.loop
 *   - useAnimatedStyle replaces Animated.timing + Animated.View style prop
 *   - Animation runs on UI thread via JSI — zero bridge calls
 *   PERF: compositor — opacity only — zero layout/paint cost.
 *
 * [AUD-04] React.memo.
 * [AUD-10] aria-live="polite" on the wrapper for screen reader announcements.
 */
const TypingIndicator = React.memo(function TypingIndicator({
  typers,
  color,
}: {
  typers: string[];
  color:  string;
}) {
  // PERF: UI thread via JSI — zero bridge cost (Reanimated v4 worklet)
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    if (typers.length === 0) {
      // Fade out the dot when no one is typing
      dotOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    // Infinite pulse: 0 → 1 → 0 → 1 … at 500ms per half-cycle
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 500 }),
      ),
      -1,   // -1 = infinite repeats
      false // do not reverse the sequence — it already handles both directions
    );
  }, [typers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // PERF: compositor — opacity only — zero layout/paint
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  if (typers.length === 0) return null; // hooks already called above — early return is safe

  const label =
    typers.length === 1
      ? `${typers[0]} typing…`
      : `${typers[0]} and ${typers.length - 1} other${typers.length > 2 ? "s" : ""} typing…`;

  return (
    <View
      style={s.typingRow}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      {/* PERF: Animated.View from react-native-reanimated — UI thread opacity */}
      <Animated.View style={[s.typingDot, { backgroundColor: color }, dotStyle]} />
      <Text style={[s.typingText, { color }]}>{label}</Text>
    </View>
  );
});
TypingIndicator.displayName = "TypingIndicator";

/**
 * Chat message bubble with smart cluster rendering.
 * Groups consecutive messages from the same user — reduces visual noise.
 * Corner radii tighten when bubbles are adjacent within a cluster.
 *
 * [AUD-04] React.memo — rerenders only when msg/isMe/cluster/accentColor change.
 */
const MoodBubble = React.memo(function MoodBubble({
  msg,
  isMe,
  prevMsg,
  nextMsg,
  accentColor,
}: {
  msg:         MoodMessageDoc;
  isMe:        boolean;
  prevMsg?:    MoodMessageDoc;
  nextMsg?:    MoodMessageDoc;
  accentColor: string;
}) {
  const isClusterStart = prevMsg?.uid !== msg.uid;
  const isClusterEnd   = nextMsg?.uid !== msg.uid;

  const R = BUBBLE_RADIUS_OUTER; // 18px — pill outer corner per PRD §1.4.4
  const r = BUBBLE_RADIUS_INNER; // 4px  — tight cluster-join corner

  const myBR = {
    borderTopLeftRadius:     R,
    borderTopRightRadius:    isClusterStart ? R : r,
    borderBottomLeftRadius:  R,
    borderBottomRightRadius: isClusterEnd   ? r : R,
  };
  const otherBR = {
    borderTopLeftRadius:     isClusterStart ? R : r,
    borderTopRightRadius:    R,
    borderBottomLeftRadius:  isClusterEnd   ? r : R,
    borderBottomRightRadius: R,
  };

  return (
    <View
      style={[
        s.bubbleRow,
        isMe ? s.bubbleRowMe : s.bubbleRowOther,
        { marginTop: isClusterStart ? BUBBLE_CLUSTER_GAP_START : BUBBLE_CLUSTER_GAP_JOIN },
      ]}
    >
      {!isMe && (
        <View style={s.avatarCol}>
          {isClusterEnd ? (
            <Avatar
              name={msg.username}
              size={28}
              accessibilityLabel={`${msg.username}'s avatar`}
            />
          ) : null}
        </View>
      )}

      <View style={[s.bubbleGroup, isMe ? s.bubbleGroupMe : s.bubbleGroupOther]}>
        {!isMe && isClusterStart && (
          <Text style={[s.bubbleSender, { color: accentColor }]} accessibilityRole="text">
            {msg.username}
          </Text>
        )}

        <View
          style={[
            s.bubble,
            isMe
              ? [s.bubbleMe, myBR,    { backgroundColor: accentColor }]
              : [s.bubbleOther, otherBR],
          ]}
        >
          <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextOther]}>
            {msg.text}
          </Text>
        </View>

        {isClusterEnd && (
          <Text style={[s.bubbleTime, isMe ? s.bubbleTimeRight : s.bubbleTimeLeft]}>
            {fmtMsgTime(msg.ts)}
          </Text>
        )}
      </View>
    </View>
  );
});
MoodBubble.displayName = "MoodBubble";

/**
 * Banner shown when the mood room's 24hr session has ended.
 * Offers a one-tap reset to start a new session.
 * [AUD-04] React.memo.
 */
const ArchivedBanner = React.memo(function ArchivedBanner({
  onReset,
}: {
  mood:    MoodSlug; // kept for future: room-specific archive copy
  onReset: () => void;
}) {
  return (
    <View style={s.archivedBanner}>
      <Feather name="archive" size={18} color={crown.fgTextTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={s.archivedTitle}>Room Archived</Text>
        <Text style={s.archivedSub}>
          This mood session ended 24 hours ago. Start a fresh one!
        </Text>
      </View>
      <TouchableOpacity
        style={s.archivedResetBtn}
        onPress={onReset}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Start new session"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.archivedResetText}>New</Text>
      </TouchableOpacity>
    </View>
  );
});
ArchivedBanner.displayName = "ArchivedBanner";

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * MoodRoomScreen — ephemeral 24hr mood-based chat room.
 * Route: /mood/[mood]  →  mood must be one of: chill | hype | study | random
 *
 * LAW 30 / Rule 03: NO avatar in this screen's header. Avatar lives ONLY in the
 * bottom nav Profile tab (full-width fixed bar per §1.4.7 Anti-Rule).
 */
export default function MoodRoomScreen() {
  const { mood: moodParam } = useLocalSearchParams<{ mood: string }>();
  const router              = useRouter();
  const insets              = useSafeAreaInsets();
  const listRef             = useRef<FlatList<MoodMessageDoc>>(null);
  const typingTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { firebaseUser, user } = useAuth();
  const myUid      = firebaseUser?.uid ?? "";
  const myUsername = user?.username ?? firebaseUser?.uid?.slice(0, 8) ?? "user";

  // Validate mood param from route
  const mood   = moodParam && isMoodSlug(moodParam) ? moodParam : null;
  const config = mood ? MOOD_CONFIGS[mood] : null;

  // [AUD-05] Discriminated union async state
  const [screenState,   setScreenState]   = useState<ScreenState>({ status: "loading" });
  const [roomDoc,       setRoomDoc]       = useState<MoodRoomDoc | null>(null);
  const [messages,      setMessages]      = useState<MoodMessageDoc[]>([]);
  const [text,          setText]          = useState("");
  const [sending,       setSending]       = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [typers,        setTypers]        = useState<string[]>([]);
  const [isArchived,    setIsArchived]    = useState(false);

  // Force re-render every 30s to update countdown display
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Init: get or create mood room ─────────────────────────────────────────
  useEffect(() => {
    if (!mood) {
      setScreenState({ status: "ready" });
      return;
    }
    setScreenState({ status: "loading" });
    getOrCreateMoodRoom(mood)
      .then(({ doc }) => {
        setRoomDoc(doc);
        setIsArchived(doc.archived || doc.activeUntil < Date.now());
        setScreenState({ status: "ready" });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Network error. Try again.";
        setScreenState({ status: "error", message });
      });
  }, [mood]);

  // ── Subscribe to room doc ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mood) return;
    return subscribeMoodRoom(mood, (doc) => {
      if (!doc) return;
      setRoomDoc(doc);
      setIsArchived(doc.archived || doc.activeUntil < Date.now());
    });
  }, [mood]);

  // ── Subscribe to messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mood) return;
    return subscribeMoodMessages(mood, (msgs) => {
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [mood]);

  // ── Pusher presence ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mood || !myUid) return;
    const pusher      = buildPusherClient(myUid, myUsername);
    const channelName = `presence-mood-${mood}`;
    const channel     = pusher.subscribe(channelName);

    channel.bind("pusher:subscription_succeeded", (members: { count?: number }) => {
      setPresenceCount(members?.count ?? 1);
    });
    channel.bind("pusher:member_added", () => {
      setPresenceCount((c) => c + 1);
    });
    channel.bind("pusher:member_removed", () => {
      setPresenceCount((c) => Math.max(1, c - 1));
    });
    channel.bind("client-typing", (data: { username?: string }) => {
      const name = data?.username;
      if (!name || name === myUsername) return;
      setTypers((prev) => prev.includes(name) ? prev : [...prev, name]);
      setTimeout(
        () => setTypers((prev) => prev.filter((u) => u !== name)),
        3_000
      );
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [mood, myUid, myUsername]);

  // ── Auto-archive: client-side TTL check every minute ─────────────────────
  useEffect(() => {
    if (!mood || !roomDoc) return;
    const check = () => {
      if (roomDoc.activeUntil < Date.now() && !roomDoc.archived) {
        archiveMoodRoom(mood).catch(() => {});
        setIsArchived(true);
      }
    };
    const id = setInterval(check, 60_000);
    check(); // immediate check on mount
    return () => clearInterval(id);
  }, [mood, roomDoc]);

  // ── Typing trigger via Pusher client event ────────────────────────────────
  const triggerTyping = useCallback(() => {
    if (PUSHER_STUB) return;
    // pusher.channel(`presence-mood-${mood}`).trigger('client-typing', { username: myUsername });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {}, 3_000);
  }, []);

  const handleTextChange = useCallback(
    (val: string) => {
      setText(val);
      if (val.length > 0) triggerTyping();
    },
    [triggerTyping]
  );

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !mood || !myUid || !firebaseUser) return;
    if (isArchived) {
      Alert.alert("Room Archived", "This session has ended. Start a new one!");
      return;
    }
    setSending(true);
    setText("");
    try {
      await sendMoodMessage(mood, { uid: myUid, username: myUsername, text: trimmed });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  }, [text, sending, mood, myUid, firebaseUser, myUsername, isArchived]);

  // ── Reset room (start new session) ───────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!mood) return;
    setScreenState({ status: "loading" });
    try {
      const { doc } = await getOrCreateMoodRoom(mood);
      setRoomDoc(doc);
      setIsArchived(false);
      setScreenState({ status: "ready" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Couldn't start a new session.";
      Alert.alert("Error", message);
      setScreenState({ status: "ready" });
    }
  }, [mood]);

  const topPad =
    insets.top +
    (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  // ── Invalid mood param ────────────────────────────────────────────────────
  if (!mood || !config) {
    return (
      <View style={[s.screen, s.centered]}>
        <Feather name="alert-circle" size={32} color={crown.fgTextTertiary} />
        <Text style={s.invalidTitle}>Unknown mood</Text>
        <TouchableOpacity
          style={s.invalidBackBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.invalidBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (screenState.status === "loading") {
    return (
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator color={config.color} size="large" />
        <Text style={[s.loadingText, { color: config.color }]}>
          Entering {config.label} room…
        </Text>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (screenState.status === "error") {
    return (
      <View style={[s.screen, s.centered]}>
        <Feather name="wifi-off" size={32} color={crown.fgTextTertiary} />
        <Text style={s.invalidTitle}>Kuch gadbad hui</Text>
        <Text style={[s.archivedSub, { textAlign: "center", marginHorizontal: spacing.xl }]}>
          {screenState.message}
        </Text>
        <TouchableOpacity
          style={[s.archivedResetBtn, { backgroundColor: config.color, marginTop: spacing.lg }]}
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.archivedResetText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" />

      {/*
       * HEADER — LAW 15: Row 1 (title + actions only)
       * Rule 03 / LAW 30: NO avatar here.
       * Avatar lives EXCLUSIVELY in bottom nav Profile tab (full-width fixed bar per §1.4.7).
       * §1.4.7 Anti-Rule: ❌ Floating Glass Island — replaced by full-width bottom nav.
       */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={crown.fgTextStrong} />
        </Pressable>

        <View style={s.headerCenter}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerEmoji} aria-hidden="true">{config.emoji}</Text>
            <Text style={s.headerTitle} numberOfLines={1}>
              {config.label} Room
            </Text>
            <MoodBadge config={config} />
          </View>
          <Text style={s.headerTagline} numberOfLines={1}>
            {config.tagline}
          </Text>
        </View>

        {/* [AUD-09] 44×44pt touch target */}
        <TouchableOpacity
          style={s.headerActionBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Feather name="more-vertical" size={20} color={crown.fgTextMuted} />
        </TouchableOpacity>
      </View>

      {/* META ROW: presence + countdown */}
      <View style={s.metaRow}>
        <PresencePill count={presenceCount} color={config.color} softColor={config.softColor} />
        {roomDoc && !isArchived && (
          <ArchiveCountdown activeUntil={roomDoc.activeUntil} color={config.color} />
        )}
      </View>

      <View style={s.headerRule} />

      {/* ARCHIVED BANNER */}
      {isArchived && (
        <ArchivedBanner mood={mood} onReset={handleReset} />
      )}

      {/* MESSAGE LIST */}
      <FlatList<MoodMessageDoc>
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MoodBubble
            msg={item}
            isMe={item.uid === myUid}
            prevMsg={messages[index - 1]}
            nextMsg={messages[index + 1]}
            accentColor={config.color}
          />
        )}
        contentContainerStyle={s.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>{config.emoji}</Text>
            <Text style={s.emptyTitle}>Be the first to share</Text>
            <Text style={s.emptySub}>{config.tagline}</Text>
          </View>
        }
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {/* TYPING INDICATOR — [AUD-03] Reanimated v4 pulse dot */}
      {typers.length > 0 && (
        <View style={s.typingContainer}>
          <TypingIndicator typers={typers} color={config.color} />
        </View>
      )}

      {/*
       * INPUT BAR — sits flush above the bottom nav (full-width fixed bar per §1.4.7).
       * PRD §1.4.7 Anti-Rule: ❌ Floating Glass Island is permanently banned.
       * Bottom nav height = 56px; safe area inset handled below.
       */}
      <View
        style={[
          s.inputBar,
          { paddingBottom: Math.max(insets.bottom, 8) + 8 },
        ]}
      >
        {isArchived ? (
          /* Archived state — locked input with reset CTA */
          <View style={s.archivedInputWrap}>
            <Feather name="lock" size={16} color={crown.fgTextTertiary} />
            <Text style={s.archivedInputText}>
              Session archived · Start a new one
            </Text>
            <TouchableOpacity
              style={[s.newSessionBtn, { backgroundColor: config.color }]}
              onPress={handleReset}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Start new session"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.newSessionBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.inputWrap}>
              <TextInput
                style={s.textInput}
                value={text}
                onChangeText={handleTextChange}
                placeholder={config.promptPlaceholder}
                placeholderTextColor={crown.fgTextTertiary}
                multiline
                maxLength={1_000}
                returnKeyType="default"
                accessibilityLabel="Type a message"
                editable={!sending && !!firebaseUser}
                testID="mood-chat-input"
              />
            </View>

            {text.trim().length > 0 ? (
              /* Send button — visible when text is present */
              <TouchableOpacity
                style={[
                  s.sendBtn,
                  { backgroundColor: config.color },
                  sending && s.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                testID="mood-send-btn"
              >
                <Feather
                  name="send"
                  size={15}
                  color={crown.white}
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            ) : (
              /* Mood react button — emoji tap when input is empty */
              <TouchableOpacity
                style={s.moodReactBtn}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`React with ${config.label} emoji`}
                testID="mood-react-btn"
              >
                <Text style={s.moodReactEmoji}>{config.emoji}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── StyleSheet ────────────────────────────────────────────────────────────────
//
// [AUD-01] ALL color values via CROWN design tokens — ZERO raw hex / rgba() literals.
// [§1.4.9] Phase A migration complete — "orbit.*" fully purged from this file.
//
// Token source: crown.* constant above (mapped from @/constants/colors)
//   Background tokens : crown.bgSurface / crown.bgCard
//   Text tokens       : crown.fgTextStrong / crown.fgTextMuted / crown.fgTextTertiary / crown.white
//   Brand token       : crown.fgBrand
//   Border tokens     : crown.borderSubtle / crown.borderActive
//   Shadow tokens     : ...shadows.gold (Champagne Gold #C9A227 glow)
//
// Typography: fonts.syne800 (headings) · fonts.inter* (body) · fonts.spaceMono (numbers)
// Spacing   : @/constants/spacing  spacing.xs|sm|md|lg|xl|xxl|xxxl
// Radius    : @/constants/spacing  radius.xs|sm|md|lg|xl|pill
// Shadows   : @/constants/spacing  shadows.gold (AUD-06: sendBtn shadow token)
// ──────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Screen ─────────────────────────────────────────────────────────────────
  screen: {
    flex:            1,
    backgroundColor: crown.bgSurface,      // --bg-surface  #FFFFFF
  },
  centered: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            spacing.md,          // 12px
  },

  // ── Header — Rule 03 / LAW 30: NO avatar ──────────────────────────────────
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing.lg,       // 16px
    paddingBottom:     spacing.sm + 2,   // 10px
    gap:               spacing.sm,       // 8px
  },
  backBtn: {
    width:          44,                  // [AUD-09] iOS min touch target
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
    marginLeft:     -6,
  },
  headerCenter:   { flex: 1 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           spacing.xs + 3,       // 7px
    flexWrap:      "wrap",
  },
  headerEmoji:  { fontSize: 20 },
  headerTitle: {
    fontFamily:    fonts.syne800,          // §1.4.3 Headings → Syne 800 — PR block if missing
    color:         crown.fgTextStrong,     // --fg-text-strong  #1A1A1A
    fontSize:      17,
    fontWeight:    "800",
    letterSpacing: -0.2,
  },
  headerTagline: {
    fontFamily: fonts.inter500,
    color:      crown.fgTextTertiary,     // --fg-text-muted  #6B5B2E
    fontSize:   11,
    fontWeight: "500",
    marginTop:  2,
    flexShrink: 1,
  },
  headerActionBtn: {
    width:          44,                  // [AUD-09] min 44×44pt iOS touch target — was 38 (FIXED)
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Mood badge ─────────────────────────────────────────────────────────────
  moodBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing.xs,       // 4px
    paddingHorizontal: spacing.sm,       // 8px
    paddingVertical:   3,
    borderRadius:      radius.pill,      // 999px
  },
  moodBadgeEmoji: { fontSize: 11 },
  moodBadgeLabel: {
    fontFamily:    fonts.inter700,
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 0.2,
  },

  // ── Meta row ───────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: spacing.lg,       // 16px
    paddingBottom:     spacing.sm + 2,   // 10px
    gap:               spacing.sm,       // 8px
  },
  presencePill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing.xs + 1,   // 5px
    paddingHorizontal: spacing.sm + 2,   // 10px
    paddingVertical:   spacing.xs,       // 4px
    borderRadius:      radius.pill,      // 999px
  },
  presenceDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  presenceCount: {
    fontFamily: fonts.spaceMono,        // §1.4.3 Numbers → Space Mono 700
    fontSize:   11,
    fontWeight: "600",
  },
  countdownWrap: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           spacing.xs,          // 4px
  },
  countdownText: {
    fontFamily: fonts.spaceMono,        // §1.4.3 Timers/numbers → Space Mono 700
    fontSize:   11,
    fontWeight: "600",
  },

  headerRule: {
    height:          1,
    backgroundColor: crown.borderSubtle,  // --border-subtle  #E8D5A0
  },

  // ── Archived banner ────────────────────────────────────────────────────────
  archivedBanner: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             spacing.sm + 2,     // 10px
    backgroundColor: crown.bgCard,       // --bg-card  #F5E6C8
    margin:          spacing.md,         // 12px
    borderRadius:    radius.lg,          // 14px
    padding:         spacing.md,         // 12px
    borderWidth:     1,
    borderColor:     crown.borderSubtle, // --border-subtle  #E8D5A0
  },
  archivedTitle: {
    fontFamily:   fonts.syne800,         // §1.4.3 Headings → Syne 800
    color:        crown.fgTextStrong,    // --fg-text-strong  #1A1A1A
    fontSize:     13,
    fontWeight:   "800",
    marginBottom: 2,
  },
  archivedSub: {
    fontFamily: fonts.inter400,
    color:      crown.fgTextMuted,       // --fg-text-muted  #6B5B2E
    fontSize: 11,
  },
  archivedResetBtn: {
    paddingHorizontal: spacing.md + 2,   // 14px
    paddingVertical:   spacing.xs + 3,   // 7px
    borderRadius:      radius.pill,      // 999px
    backgroundColor:   crown.fgBrand,   // --fg-brand #D4A017 fallback — overridden inline
    minHeight:         44,               // [AUD-09] min touch target
    justifyContent:    "center",
  },
  archivedResetText: {
    fontFamily: fonts.inter700,
    color:      crown.white,             // own-action text on brand gold
    fontSize:   13,
    fontWeight: "700",
  },

  // ── Message list ───────────────────────────────────────────────────────────
  messageList: {
    paddingHorizontal: spacing.md,       // 12px
    paddingTop:        spacing.sm + 2,   // 10px
    paddingBottom:     spacing.md,       // 12px
    flexGrow:          1,
  },
  emptyState: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingVertical:   60,
    paddingHorizontal: spacing.xxxl,     // 32px
  },
  emptyEmoji: {
    fontSize:     48,
    marginBottom: spacing.md + 2,        // 14px
  },
  emptyTitle: {
    fontFamily:    fonts.syne800,        // §1.4.3 Headings → Syne 800
    color:         crown.fgTextStrong,   // --fg-text-strong  #1A1A1A
    fontSize:      18,
    fontWeight:    "800",
    letterSpacing: -0.2,
    marginBottom:  spacing.sm,          // 8px
    textAlign:     "center",
  },
  emptySub: {
    fontFamily: fonts.inter400,
    color:      crown.fgTextMuted,       // --fg-text-muted  #6B5B2E
    fontSize:   14,
    textAlign:  "center",
    lineHeight: 21,
  },

  // ── Typing indicator ───────────────────────────────────────────────────────
  typingContainer: {
    paddingHorizontal: spacing.lg,       // 16px
    paddingVertical:   spacing.xs,       // 4px
  },
  typingRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           spacing.sm - 2,       // 6px
  },
  typingDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    // opacity animated via Reanimated v4 useAnimatedStyle — [AUD-03]
  },
  typingText: {
    fontFamily: fonts.inter500,
    fontSize:   11,
    fontWeight: "500",
  },

  // ── Message bubbles ────────────────────────────────────────────────────────
  bubbleRow: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    paddingHorizontal: spacing.xs,       // 4px
  },
  bubbleRowMe:    { justifyContent: "flex-end"   },
  bubbleRowOther: { justifyContent: "flex-start" },
  avatarCol: {
    width:        32,
    alignItems:   "center",
    marginRight:  spacing.sm - 2,        // 6px
    alignSelf:    "flex-end",
    paddingBottom: spacing.lg,           // 16px — spacing token per 4px grid
  },
  bubbleGroup:      { maxWidth: "74%" },
  bubbleGroupMe:    { alignItems: "flex-end"   },
  bubbleGroupOther: { alignItems: "flex-start" },
  bubbleSender: {
    fontFamily:    fonts.inter600,       // §1.4.3 labels → Inter 600
    fontSize:      11,
    fontWeight:    "600",
    marginBottom:  3,
    marginLeft:    spacing.md + 2,       // 14px
    letterSpacing: 0.1,
  },
  bubble: {
    paddingHorizontal: spacing.md + 2,   // 14px
    paddingVertical:   spacing.sm + 2,   // 10px
  },
  bubbleMe:    {},
  bubbleOther: { backgroundColor: crown.bgCard },   // --bg-card  #F5E6C8
  bubbleText: {
    fontFamily: fonts.inter400,                       // §1.4.3 chat messages → Inter 400
    fontSize:   15,
    lineHeight: 22,
    fontWeight: "400",
  },
  bubbleTextMe:    { color: crown.white      },       // own bubble text on brand gold
  bubbleTextOther: { color: crown.fgTextStrong },     // --fg-text-strong  #1A1A1A
  bubbleTime: {
    fontFamily:       fonts.spaceMono,               // §1.4.3 Numbers/timestamps → Space Mono
    fontSize:         10,
    fontWeight:       "500",
    color:            crown.fgTextTertiary,           // --tertiary text  palette.ink[500]
    marginTop:        3,
    marginHorizontal: spacing.sm - 2,               // 6px
  },
  bubbleTimeRight: { alignSelf: "flex-end"   },
  bubbleTimeLeft:  { alignSelf: "flex-start" },

  // ── Input bar — sits flush above full-width bottom nav (§1.4.7: no Glass Island) ──
  inputBar: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    paddingHorizontal: spacing.md,       // 12px
    paddingTop:        spacing.sm + 2,   // 10px
    gap:               spacing.sm,       // 8px
    borderTopWidth:    1,
    borderTopColor:    crown.borderSubtle, // --border-subtle  #E8D5A0
    backgroundColor:   crown.bgSurface,   // --bg-surface  #FFFFFF
  },
  inputWrap: { flex: 1 },
  textInput: {
    fontFamily:        fonts.inter400,               // §1.4.3 body → Inter 400
    minHeight:         44,                           // [AUD-09] min iOS touch target height
    maxHeight:         120,
    backgroundColor:   crown.bgCard,                 // --bg-card  #F5E6C8
    borderRadius:      22,
    paddingHorizontal: spacing.lg,                   // 16px
    paddingVertical:   Platform.OS === "ios" ? spacing.md : spacing.sm + 2,
    color:             crown.fgTextStrong,           // --fg-text-strong  #1A1A1A
    fontSize:          15,
    lineHeight:        22,
    borderWidth:       1,
    borderColor:       crown.borderSubtle,           // --border-subtle  #E8D5A0
  },
  sendBtn: {
    width:          44,                  // [AUD-09] iOS min touch target
    height:         44,
    borderRadius:   22,
    alignItems:     "center",
    justifyContent: "center",
    // [AUD-06] shadows.gold token — Champagne Gold #C9A227 @ 0.40 opacity
    // PERF: GPU composited shadow — test on low-end Android
    ...shadows.gold,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  moodReactBtn: {
    width:          44,                  // [AUD-09] iOS min touch target
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },
  moodReactEmoji: { fontSize: 24 },

  // ── Archived input state ───────────────────────────────────────────────────
  archivedInputWrap: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing.sm,       // 8px
    backgroundColor:   crown.bgCard,    // --bg-card  #F5E6C8
    borderRadius:      22,
    paddingHorizontal: spacing.md + 2,   // 14px
    paddingVertical:   spacing.sm + 2,   // 10px
    borderWidth:       1,
    borderColor:       crown.borderSubtle, // --border-subtle  #E8D5A0
  },
  archivedInputText: {
    fontFamily: fonts.inter400,
    flex:       1,
    color:      crown.fgTextTertiary,   // tertiary — visually subdued archived state
    fontSize:   13,
  },
  newSessionBtn: {
    paddingHorizontal: spacing.md + 2,   // 14px
    paddingVertical:   spacing.sm - 2,   // 6px
    borderRadius:      radius.pill,      // 999px
    minHeight:         36,
    justifyContent:    "center",
  },
  newSessionBtnText: {
    fontFamily: fonts.inter700,
    color:      crown.white,            // on brand gold button
    fontSize:   12,
    fontWeight: "700",
  },

  // ── Invalid / error / loading states ──────────────────────────────────────
  invalidTitle: {
    fontFamily: fonts.syne800,           // §1.4.3 Headings → Syne 800
    color:      crown.fgTextStrong,      // --fg-text-strong  #1A1A1A
    fontSize:   18,
    fontWeight: "800",
  },
  invalidBackBtn: {
    paddingHorizontal: spacing.xl,       // 20px
    paddingVertical:   spacing.sm + 2,   // 10px
    borderRadius:      radius.pill,      // 999px
    backgroundColor:   crown.bgCard,    // --bg-card  #F5E6C8
    borderWidth:       1,
    borderColor:       crown.borderSubtle, // --border-subtle  #E8D5A0
    minHeight:         44,               // [AUD-09] min touch target
    justifyContent:    "center",
  },
  invalidBackBtnText: {
    fontFamily: fonts.inter600,
    color:      crown.fgTextStrong,      // --fg-text-strong  #1A1A1A
    fontSize:   14,
    fontWeight: "600",
  },
  loadingText: {
    fontFamily: fonts.inter600,
    fontSize:   14,
    fontWeight: "600",
    marginTop:  spacing.sm,             // 8px
  },

});

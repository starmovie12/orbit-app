/**
 * ORBIT — Mood Room Screen  (app/mood/[mood].tsx)
 *
 * Blueprint §01: 6 moods — Happy, Sad, Anxious, Creative, Lonely, Hyped.
 * "Aaj mood kya hai?" — 24hr auto-archive creates FOMO + daily check-in habit.
 *
 * SETUP:
 *   1. npm install pusher-js
 *   2. EXPO_PUBLIC_PUSHER_KEY=<key> and EXPO_PUBLIC_PUSHER_CLUSTER=<cluster> in .env
 *   3. Set PUSHER_STUB = false once pusher-js is installed.
 *
 * Architecture:
 *   • `mood` param = one of the 6 mood slugs (happy | sad | anxious | creative | lonely | hyped)
 *   • Firestore /moodRooms/{mood} → room doc with activeUntil (24hr TTL)
 *   • Firestore /moodRooms/{mood}/messages/{id} → messages sub-collection
 *   • Pusher channel = `mood-${mood}` → presence for live member count + typing
 *   • Cloud Function (or client) auto-archives when activeUntil < now
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Avatar } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { firestore, serverTimestamp } from "@/lib/firebase";

// Cross-platform Firestore .exists helper (web compat vs native SDK)
function snapExists(s: any): boolean { return typeof s.exists === 'function' ? s.exists() : !!s.exists; }

/* ─────────────────────────────────────────────────────────────────────
   Mood definitions
───────────────────────────────────────────────────────────────────── */

type MoodSlug = "happy" | "sad" | "anxious" | "creative" | "lonely" | "hyped";

type MoodConfig = {
  slug: MoodSlug;
  label: string;
  emoji: string;
  color: string;
  softColor: string;
  icon: string;
  tagline: string;
  promptPlaceholder: string;
};

const MOOD_CONFIGS: Record<MoodSlug, MoodConfig> = {
  happy: {
    slug: "happy",
    label: "Happy",
    emoji: "😄",
    color: orbit.success,
    softColor: orbit.successSoft,
    icon: "sun",
    tagline: "Good vibes only — share what's making you smile today",
    promptPlaceholder: "Aaj kya accha hua? Share karo…",
  },
  sad: {
    slug: "sad",
    label: "Sad",
    emoji: "😔",
    color: orbit.accent,
    softColor: orbit.accentSoft,
    icon: "cloud-drizzle",
    tagline: "It's okay to not be okay — we're here with you",
    promptPlaceholder: "Kuch share karna hai? Yahan safe space hai…",
  },
  anxious: {
    slug: "anxious",
    label: "Anxious",
    emoji: "😰",
    color: orbit.warning,
    softColor: orbit.warningSoft,
    icon: "zap",
    tagline: "Breathe. You're not alone in this.",
    promptPlaceholder: "Kya chal raha hai dimag mein? Bolo…",
  },
  creative: {
    slug: "creative",
    label: "Creative",
    emoji: "🎨",
    color: "#8B5CF6",
    softColor: "rgba(139,92,246,0.12)",
    icon: "edit-3",
    tagline: "Create, share, inspire — let's make something today",
    promptPlaceholder: "Kya bana rahe ho? Idea share karo…",
  },
  lonely: {
    slug: "lonely",
    label: "Lonely",
    emoji: "🌙",
    color: "#6366F1",
    softColor: "rgba(99,102,241,0.12)",
    icon: "moon",
    tagline: "Late night feels? You've got company here.",
    promptPlaceholder: "Koi sun raha hai — bolo jo mann mein hai…",
  },
  hyped: {
    slug: "hyped",
    label: "Hyped",
    emoji: "🔥",
    color: orbit.danger,
    softColor: orbit.dangerSoft,
    icon: "trending-up",
    tagline: "High energy mode ON — let's gooo!",
    promptPlaceholder: "Kya hype chal rahi hai? Share karo bhai!",
  },
};

const VALID_MOOD_SLUGS = Object.keys(MOOD_CONFIGS) as MoodSlug[];

function isMoodSlug(s: string): s is MoodSlug {
  return VALID_MOOD_SLUGS.includes(s as MoodSlug);
}

/* ─────────────────────────────────────────────────────────────────────
   Pusher — stub until pusher-js is installed
───────────────────────────────────────────────────────────────────── */

const PUSHER_STUB = true; // flip to false after: npm install pusher-js
const PUSHER_KEY = (process.env.EXPO_PUBLIC_PUSHER_KEY as string) ?? "";
const PUSHER_CLUSTER = (process.env.EXPO_PUBLIC_PUSHER_CLUSTER as string) ?? "ap2";

const PusherStub = {
  subscribe: (_channel: string) => ({
    bind: (_event: string, _cb: (...args: any[]) => void) => {},
    unbind_all: () => {},
    members: { count: 0, each: (_cb: any) => {} },
  }),
  unsubscribe: (_channel: string) => {},
  disconnect: () => {},
};

function buildPusherClient(uid: string, username: string) {
  if (PUSHER_STUB || !PUSHER_KEY) return PusherStub;
  // Real:
  // const Pusher = require('pusher-js');
  // const client = new Pusher(PUSHER_KEY, {
  //   cluster: PUSHER_CLUSTER,
  //   authEndpoint: '/api/pusher/auth',
  //   auth: { params: { uid, username } },
  // });
  // return client;
  return PusherStub;
}

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

const MOOD_ROOMS_COL = "moodRooms";
const MSGS_COL = "messages";
const ARCHIVE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

type MoodRoomDoc = {
  mood: MoodSlug;
  activeUntil: number; // epoch ms
  archived: boolean;
  memberCount: number;
  messageCount: number;
  createdAt: unknown;
};

type MoodMessageDoc = {
  id: string;
  uid: string;
  username: string;
  text: string;
  createdAt: unknown;
  ts: number; // epoch ms for local sort
};

/** Get or create a mood room. Returns the doc + whether it was created fresh. */
async function getOrCreateMoodRoom(
  mood: MoodSlug
): Promise<{ doc: MoodRoomDoc; isNew: boolean }> {
  const db = firestore();
  const ref = db.collection(MOOD_ROOMS_COL).doc(mood);

  let isNew = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (snapExists(snap)) {
      const data = snap.data() as MoodRoomDoc;
      // If archived or TTL expired, reset the room
      if (data.archived || data.activeUntil < now) {
        tx.set(ref, {
          mood,
          activeUntil: now + ARCHIVE_DURATION_MS,
          archived: false,
          memberCount: 0,
          messageCount: 0,
          createdAt: serverTimestamp(),
        } as Omit<MoodRoomDoc, "id">);
        isNew = true;
      }
    } else {
      tx.set(ref, {
        mood,
        activeUntil: now + ARCHIVE_DURATION_MS,
        archived: false,
        memberCount: 0,
        messageCount: 0,
        createdAt: serverTimestamp(),
      } as Omit<MoodRoomDoc, "id">);
      isNew = true;
    }
  });

  const snap = await ref.get();
  return { doc: snap.data() as MoodRoomDoc, isNew };
}

function subscribeMoodRoom(
  mood: MoodSlug,
  cb: (doc: MoodRoomDoc | null) => void
): () => void {
  return firestore()
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .onSnapshot(
      (snap) => cb(snapExists(snap) ? (snap.data() as MoodRoomDoc) : null),
      () => cb(null)
    );
}

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
          const data = doc.data();
          list.push({
            id: doc.id,
            uid: data.uid,
            username: data.username,
            text: data.text,
            createdAt: data.createdAt,
            ts: data.createdAt?.toMillis?.() ?? Date.now(),
          });
        });
        cb(list);
      },
      () => cb([])
    );
}

async function sendMoodMessage(
  mood: MoodSlug,
  msg: { uid: string; username: string; text: string }
): Promise<void> {
  const db = firestore();
  const batch = db.batch();
  const msgRef = db
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .collection(MSGS_COL)
    .doc();

  batch.set(msgRef, {
    uid: msg.uid,
    username: msg.username,
    text: msg.text.slice(0, 1000),
    createdAt: serverTimestamp(),
  });

  batch.update(db.collection(MOOD_ROOMS_COL).doc(mood), {
    messageCount: firestore.FieldValue.increment(1),
  });

  await batch.commit();
}

/** Archive the room (called by client when TTL expires; Cloud Function can also do this). */
async function archiveMoodRoom(mood: MoodSlug): Promise<void> {
  await firestore()
    .collection(MOOD_ROOMS_COL)
    .doc(mood)
    .update({ archived: true });
}

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function fmtTimeLeft(activeUntil: number): string {
  const diffMs = activeUntil - Date.now();
  if (diffMs <= 0) return "Expired";
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function fmtMsgTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────── */

function MoodBadge({ config }: { config: MoodConfig }) {
  return (
    <View style={[styles.moodBadge, { backgroundColor: config.softColor }]}>
      <Text style={styles.moodBadgeEmoji}>{config.emoji}</Text>
      <Text style={[styles.moodBadgeLabel, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

function ArchiveCountdown({
  activeUntil,
  color,
}: {
  activeUntil: number;
  color: string;
}) {
  const [label, setLabel] = useState(() => fmtTimeLeft(activeUntil));

  useEffect(() => {
    const id = setInterval(() => {
      setLabel(fmtTimeLeft(activeUntil));
    }, 30_000);
    return () => clearInterval(id);
  }, [activeUntil]);

  return (
    <View style={styles.countdownWrap}>
      <Feather name="clock" size={11} color={color} />
      <Text style={[styles.countdownText, { color }]}>{label}</Text>
    </View>
  );
}

function PresencePill({ count, color }: { count: number; color: string }) {
  return (
    <View style={[styles.presencePill, { backgroundColor: `${color}18` }]}>
      <View style={[styles.presenceDot, { backgroundColor: color }]} />
      <Text style={[styles.presenceCount, { color }]}>
        {count} {count === 1 ? "member" : "members"} here now
      </Text>
    </View>
  );
}

function TypingIndicator({ typers, color }: { typers: string[]; color: string }) {
  const dot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typers.length === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dot, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [typers.length, dot]);

  if (typers.length === 0) return null;

  const label =
    typers.length === 1
      ? `${typers[0]} typing…`
      : `${typers[0]} and ${typers.length - 1} other${typers.length > 2 ? "s" : ""} typing…`;

  return (
    <View style={styles.typingRow}>
      <Animated.View style={[styles.typingDot, { backgroundColor: color, opacity: dot }]} />
      <Text style={[styles.typingText, { color }]}>{label}</Text>
    </View>
  );
}

function MoodBubble({
  msg,
  isMe,
  prevMsg,
  nextMsg,
  accentColor,
}: {
  msg: MoodMessageDoc;
  isMe: boolean;
  prevMsg?: MoodMessageDoc;
  nextMsg?: MoodMessageDoc;
  accentColor: string;
}) {
  const prevSame = prevMsg?.uid === msg.uid;
  const nextSame = nextMsg?.uid === msg.uid;
  const isClusterStart = !prevSame;
  const isClusterEnd = !nextSame;

  const R = 18;
  const r = 4;
  const myBR = {
    borderTopLeftRadius: R,
    borderTopRightRadius: isClusterStart ? R : r,
    borderBottomLeftRadius: R,
    borderBottomRightRadius: isClusterEnd ? r : R,
  };
  const otherBR = {
    borderTopLeftRadius: isClusterStart ? R : r,
    borderTopRightRadius: R,
    borderBottomLeftRadius: isClusterEnd ? r : R,
    borderBottomRightRadius: R,
  };

  return (
    <View
      style={[
        styles.bubbleRow,
        isMe ? styles.bubbleRowMe : styles.bubbleRowOther,
        { marginTop: isClusterStart ? 10 : 2 },
      ]}
    >
      {!isMe && (
        <View style={styles.avatarCol}>
          {isClusterEnd ? <Avatar name={msg.username} size={28} /> : null}
        </View>
      )}

      <View
        style={[
          styles.bubbleGroup,
          isMe ? styles.bubbleGroupMe : styles.bubbleGroupOther,
        ]}
      >
        {!isMe && isClusterStart && (
          <Text style={[styles.bubbleSender, { color: accentColor }]}>
            {msg.username}
          </Text>
        )}

        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, myBR, { backgroundColor: accentColor }]
              : [styles.bubbleOther, otherBR],
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
            ]}
          >
            {msg.text}
          </Text>
        </View>

        {isClusterEnd && (
          <Text
            style={[
              styles.bubbleTime,
              isMe ? styles.bubbleTimeRight : styles.bubbleTimeLeft,
            ]}
          >
            {fmtMsgTime(msg.ts)}
          </Text>
        )}
      </View>
    </View>
  );
}

function ArchivedBanner({ mood, onReset }: { mood: string; onReset: () => void }) {
  return (
    <View style={styles.archivedBanner}>
      <Feather name="archive" size={18} color={orbit.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.archivedTitle}>Room Archived</Text>
        <Text style={styles.archivedSub}>
          This mood session ended 24 hours ago. Start a fresh one!
        </Text>
      </View>
      <TouchableOpacity
        style={styles.archivedResetBtn}
        onPress={onReset}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Start new session"
      >
        <Text style={styles.archivedResetText}>New</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function MoodRoomScreen() {
  const { mood: moodParam } = useLocalSearchParams<{ mood: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<any>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { firebaseUser, user } = useAuth();
  const myUid = firebaseUser?.uid ?? "";
  const myUsername = user?.username ?? firebaseUser?.uid?.slice(0, 8) ?? "user";

  // Validate mood param
  const mood = isMoodSlug(moodParam ?? "") ? (moodParam as MoodSlug) : null;
  const config = mood ? MOOD_CONFIGS[mood] : null;

  const [roomDoc, setRoomDoc] = useState<MoodRoomDoc | null>(null);
  const [messages, setMessages] = useState<MoodMessageDoc[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presenceCount, setPresenceCount] = useState(1);
  const [typers, setTypers] = useState<string[]>([]);
  const [isArchived, setIsArchived] = useState(false);

  /* Countdown ticker */
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  /* Get or create mood room on mount */
  useEffect(() => {
    if (!mood) {
      setLoading(false);
      return;
    }
    getOrCreateMoodRoom(mood)
      .then(({ doc }) => {
        setRoomDoc(doc);
        setIsArchived(doc.archived || doc.activeUntil < Date.now());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mood]);

  /* Subscribe to room doc */
  useEffect(() => {
    if (!mood) return;
    const unsub = subscribeMoodRoom(mood, (doc) => {
      if (!doc) return;
      setRoomDoc(doc);
      setIsArchived(doc.archived || doc.activeUntil < Date.now());
    });
    return unsub;
  }, [mood]);

  /* Subscribe to messages */
  useEffect(() => {
    if (!mood) return;
    const unsub = subscribeMoodMessages(mood, (msgs) => {
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [mood]);

  /* Pusher presence */
  useEffect(() => {
    if (!mood || !myUid) return;
    const pusher = buildPusherClient(myUid, myUsername);
    const channelName = `presence-mood-${mood}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("pusher:subscription_succeeded", (members: any) => {
      setPresenceCount(members?.count ?? 1);
    });
    channel.bind("pusher:member_added", (_member: any) => {
      setPresenceCount((c) => c + 1);
    });
    channel.bind("pusher:member_removed", (_member: any) => {
      setPresenceCount((c) => Math.max(1, c - 1));
    });
    channel.bind("client-typing", (data: { username: string }) => {
      if (data.username === myUsername) return;
      setTypers((prev) => {
        if (prev.includes(data.username)) return prev;
        return [...prev, data.username];
      });
      setTimeout(() => {
        setTypers((prev) => prev.filter((u) => u !== data.username));
      }, 3000);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [mood, myUid, myUsername]);

  /* Auto-archive check — runs every minute */
  useEffect(() => {
    if (!mood || !roomDoc) return;
    const check = () => {
      if (roomDoc.activeUntil < Date.now() && !roomDoc.archived) {
        archiveMoodRoom(mood).catch(() => {});
        setIsArchived(true);
      }
    };
    const id = setInterval(check, 60_000);
    check(); // immediate check
    return () => clearInterval(id);
  }, [mood, roomDoc]);

  /* Send typing indicator via Pusher */
  const triggerTyping = useCallback(() => {
    if (PUSHER_STUB) return;
    // pusher.channel(`presence-mood-${mood}`).trigger('client-typing', { username: myUsername });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {}, 3000);
  }, []);

  /* Handle text change */
  const handleTextChange = useCallback(
    (val: string) => {
      setText(val);
      if (val.length > 0) triggerTyping();
    },
    [triggerTyping]
  );

  /* Send message */
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
      await sendMoodMessage(mood, {
        uid: myUid,
        username: myUsername,
        text: trimmed,
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }, [text, sending, mood, myUid, firebaseUser, myUsername, isArchived]);

  /* Reset (start new session) */
  const handleReset = useCallback(async () => {
    if (!mood) return;
    setLoading(true);
    try {
      await getOrCreateMoodRoom(mood);
      setIsArchived(false);
    } catch {
      Alert.alert("Error", "Couldn't start a new session. Try again.");
    } finally {
      setLoading(false);
    }
  }, [mood]);

  const topPad =
    insets.top + (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  /* Invalid mood */
  if (!mood || !config) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Feather name="alert-circle" size={32} color={orbit.textTertiary} />
        <Text style={styles.invalidTitle}>Unknown mood</Text>
        <TouchableOpacity
          style={styles.invalidBackBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.invalidBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={config.color} size="large" />
        <Text style={[styles.loadingText, { color: config.color }]}>
          Entering {config.label} room…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerEmoji}>{config.emoji}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {config.label} Room
            </Text>
            <MoodBadge config={config} />
          </View>
          <Text style={styles.headerTagline} numberOfLines={1}>
            {config.tagline}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Feather name="more-vertical" size={20} color={orbit.textSecond} />
        </TouchableOpacity>
      </View>

      {/* ── META ROW ──────────────────────────────────────────────── */}
      <View style={styles.metaRow}>
        <PresencePill count={presenceCount} color={config.color} />
        {roomDoc && !isArchived && (
          <ArchiveCountdown activeUntil={roomDoc.activeUntil} color={config.color} />
        )}
      </View>

      <View style={styles.headerRule} />

      {/* ── ARCHIVED BANNER ─────────────────────────────────────── */}
      {isArchived && (
        <ArchivedBanner mood={mood} onReset={handleReset} />
      )}

      {/* ── MESSAGES ─────────────────────────────────────────────── */}
      <FlatList
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
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{config.emoji}</Text>
            <Text style={styles.emptyTitle}>Be the first to share</Text>
            <Text style={styles.emptySub}>{config.tagline}</Text>
          </View>
        }
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {/* ── TYPING INDICATOR ─────────────────────────────────────── */}
      {typers.length > 0 && (
        <View style={styles.typingContainer}>
          <TypingIndicator typers={typers} color={config.color} />
        </View>
      )}

      {/* ── INPUT BAR ─────────────────────────────────────────────── */}
      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 8) + 8 },
        ]}
      >
        {isArchived ? (
          <View style={styles.archivedInputWrap}>
            <Feather name="lock" size={16} color={orbit.textTertiary} />
            <Text style={styles.archivedInputText}>
              Session archived · Start a new one
            </Text>
            <TouchableOpacity
              style={[styles.newSessionBtn, { backgroundColor: config.color }]}
              onPress={handleReset}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Start new session"
            >
              <Text style={styles.newSessionBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={handleTextChange}
                placeholder={config.promptPlaceholder}
                placeholderTextColor={orbit.textTertiary}
                multiline
                maxLength={1000}
                returnKeyType="default"
                accessibilityLabel="Type a message"
                editable={!sending && !!firebaseUser}
              />
            </View>
            {text.trim().length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  { backgroundColor: config.color },
                  sending && { opacity: 0.5 },
                ]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Feather
                  name="send"
                  size={15}
                  color={orbit.white}
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.moodReactBtn}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="React with emoji"
              >
                <Text style={styles.moodReactEmoji}>{config.emoji}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: orbit.bg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  headerCenter: { flex: 1 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  headerEmoji: { fontSize: 20 },
  headerTitle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerTagline: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    flexShrink: 1,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Mood badge */
  moodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  moodBadgeEmoji: { fontSize: 11 },
  moodBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  /* Meta row */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  presencePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  presenceCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  countdownWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: "600",
  },

  headerRule: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
  },

  /* Archived banner */
  archivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: orbit.surface2,
    margin: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  archivedTitle: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  archivedSub: {
    color: orbit.textSecond,
    fontSize: 11,
  },
  archivedResetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: orbit.accent,
  },
  archivedResetText: {
    color: orbit.white,
    fontSize: 13,
    fontWeight: "700",
  },

  /* Messages */
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 14,
  },
  emptyTitle: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },

  /* Typing */
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typingText: {
    fontSize: 11,
    fontWeight: "500",
  },

  /* Bubbles */
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  bubbleRowMe: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  avatarCol: {
    width: 32,
    alignItems: "center",
    marginRight: 6,
    alignSelf: "flex-end",
    paddingBottom: 16,
  },
  bubbleGroup: { maxWidth: "74%" },
  bubbleGroupMe: { alignItems: "flex-end" },
  bubbleGroupOther: { alignItems: "flex-start" },
  bubbleSender: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3,
    marginLeft: 14,
    letterSpacing: 0.1,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {},
  bubbleOther: { backgroundColor: orbit.surface2 },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  bubbleTextMe: { color: orbit.white },
  bubbleTextOther: { color: orbit.textPrimary },
  bubbleTime: {
    fontSize: 10,
    fontWeight: "500",
    color: orbit.textTertiary,
    marginTop: 3,
    marginHorizontal: 6,
  },
  bubbleTimeRight: { alignSelf: "flex-end" },
  bubbleTimeLeft: { alignSelf: "flex-start" },

  /* Input */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    backgroundColor: orbit.bg,
  },
  inputWrap: { flex: 1 },
  textInput: {
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: orbit.surface2,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: orbit.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  moodReactBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  moodReactEmoji: { fontSize: 24 },

  /* Archived input */
  archivedInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: orbit.surface2,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  archivedInputText: {
    flex: 1,
    color: orbit.textTertiary,
    fontSize: 13,
  },
  newSessionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
  },
  newSessionBtnText: {
    color: orbit.white,
    fontSize: 12,
    fontWeight: "700",
  },

  /* Invalid / loading states */
  invalidTitle: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  invalidBackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  invalidBackBtnText: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
});

/**
 * ORBIT — DM Chat Screen (1:1) v2
 *
 * Route: /dm/[id]  where id = deterministic threadId from firestore-dms.ts
 *
 * v2 additions over v1:
 *   • Full message tick system — "sent" → "delivered" → "read"
 *     Derived from thread.unread[otherUid]: 0 = read; >0 = delivered.
 *     Optimistic messages (local-only before Firestore confirms) show "sent".
 *   • Voice message recording: press-and-hold mic → animated waveform timer
 *     → release to send. Calls sendVoiceMessage() with a stub URL for now.
 *     Install expo-av + wire up actual Audio.Recording for real recording.
 *   • Voice message playback: tap play → animated progress bar + timer.
 *   • "You are typing…" composing state shown to other side (future Pusher hook).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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

import { Avatar, ReadStatus, type ReadState } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeThread,
  touchThreadLastMessage,
  markThreadRead,
  type DMThreadDoc,
} from "@/lib/firestore-dms";
import {
  subscribeMessages,
  sendTextMessage,
  sendVoiceMessage,
  type MessageDoc,
} from "@/lib/firestore-messages";

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type MsgType = "text" | "voice" | "image";

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text?: string;
  type: MsgType;
  duration?: number;
  time: string;
  ts: number;
  /** undefined = optimistic (not yet in Firestore) */
  optimistic?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────
   Waveform bars
───────────────────────────────────────────────────────────────────── */

const WAVE_HEIGHTS = [5, 10, 7, 14, 9, 17, 7, 13, 9, 15, 7, 11, 5, 13, 9, 17, 7, 11, 5, 9];

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function tsToSeconds(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toDate === "function") return Math.floor(ts.toDate().getTime() / 1000);
  if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
  if (typeof ts === "number") return ts;
  return 0;
}

function fmtHHMM(ts: any): string {
  if (!ts) return "";
  const d: Date | null =
    typeof ts?.toDate === "function" ? ts.toDate() :
    ts instanceof Date ? ts : null;
  if (!d) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function mapMessage(m: MessageDoc, myUid: string): ChatMessage {
  return {
    id: m.id,
    uid: m.uid,
    name: m.uid === myUid ? "You" : m.username,
    text: m.text ?? undefined,
    type: (m.type === "system" ? "text" : m.type) as MsgType,
    duration: m.duration ?? undefined,
    time: fmtHHMM(m.createdAt),
    ts: tsToSeconds(m.createdAt),
  };
}

function dateLabelFor(tsSeconds: number): string {
  if (tsSeconds === 0) return "Today";
  const d = new Date(tsSeconds * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msgDay = new Date(d);
  msgDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-IN", { weekday: "long" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/**
 * Derive per-message read state.
 *
 * Algorithm:
 *   thread.unread[otherUid] = N means the last N of my messages are UNREAD
 *   by the other user → show "delivered". Everything older = "read".
 *   An optimistic message (not yet confirmed) shows "sent".
 */
function deriveReadState(
  msg: ChatMessage,
  myUid: string,
  myMessages: ChatMessage[],
  unreadCount: number,
): ReadState {
  if (msg.uid !== myUid) return "read"; // other person's msgs — irrelevant
  if (msg.optimistic) return "sent";
  if (unreadCount === 0) return "read";
  // find this msg's position from the end among my messages
  const myMsgsSorted = [...myMessages].filter(m => m.uid === myUid && !m.optimistic).sort((a, b) => a.ts - b.ts);
  const idx = myMsgsSorted.findIndex(m => m.id === msg.id);
  const fromEnd = myMsgsSorted.length - 1 - idx;
  return fromEnd < unreadCount ? "delivered" : "read";
}

/* ─────────────────────────────────────────────────────────────────────
   VoiceNote playback component
───────────────────────────────────────────────────────────────────── */

function VoiceNote({ isMe, duration }: { isMe: boolean; duration: number }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const iconColor = isMe ? "rgba(255,255,255,0.9)" : orbit.textPrimary;
  const barColor = isMe ? "rgba(255,255,255,0.35)" : orbit.textTertiary;
  const barActive = isMe ? "rgba(255,255,255,0.85)" : orbit.accent;
  const timeColor = isMe ? "rgba(255,255,255,0.65)" : orbit.textTertiary;

  const togglePlay = useCallback(() => {
    if (playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      progressAnim.stopAnimation();
      setPlaying(false);
    } else {
      setElapsed(0);
      setPlaying(true);
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setPlaying(false);
          setElapsed(0);
          progressAnim.setValue(0);
        }
      });
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= duration - 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  }, [playing, duration, progressAnim]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      progressAnim.stopAnimation();
    };
  }, [progressAnim]);

  const displayTime = playing ? elapsed : duration;

  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity
        style={[styles.voicePlay, { backgroundColor: isMe ? "rgba(255,255,255,0.18)" : orbit.surface3 }]}
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
        hitSlop={6}
      >
        <Feather name={playing ? "pause" : "play"} size={13} color={iconColor} />
      </TouchableOpacity>

      <View style={styles.waveform}>
        {WAVE_HEIGHTS.map((h, i) => {
          const threshold = Math.floor((i / WAVE_HEIGHTS.length) * duration);
          const isActive = playing && elapsed >= threshold;
          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                { height: h, backgroundColor: isActive ? barActive : barColor },
              ]}
            />
          );
        })}
      </View>

      <Text style={[styles.voiceDuration, { color: timeColor }]}>
        {fmtDuration(displayTime)}
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   VoiceRecorder component (press-and-hold UI)
───────────────────────────────────────────────────────────────────── */

interface VoiceRecorderProps {
  onSend: (durationSec: number) => Promise<void>;
  onCancel: () => void;
}

function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      scaleAnim.stopAnimation();
    };
  }, [scaleAnim]);

  return (
    <View style={styles.recorderBar}>
      <TouchableOpacity
        style={styles.recorderCancelBtn}
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Cancel recording"
      >
        <Feather name="x" size={18} color={orbit.danger} />
      </TouchableOpacity>

      <View style={styles.recorderCenter}>
        <Animated.View style={[styles.recorderDot, { transform: [{ scale: scaleAnim }] }]} />
        <Text style={styles.recorderLabel}>Recording…</Text>
        <Text style={styles.recorderTime}>{fmtDuration(elapsed)}</Text>
      </View>

      <TouchableOpacity
        style={styles.recorderSendBtn}
        onPress={() => {
          if (timerRef.current) clearInterval(timerRef.current);
          onSend(Math.max(1, elapsed));
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
      >
        <Feather name="send" size={18} color={orbit.white} />
      </TouchableOpacity>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Bubble component
───────────────────────────────────────────────────────────────────── */

function Bubble({
  msg, prevMsg, nextMsg, myUid, readState,
}: {
  msg: ChatMessage;
  prevMsg?: ChatMessage;
  nextMsg?: ChatMessage;
  myUid: string;
  readState: ReadState;
}) {
  const isMe = msg.uid === myUid;
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
        styles.msgRow,
        isMe ? styles.msgRowMe : styles.msgRowOther,
        { marginTop: isClusterStart ? 10 : 2 },
      ]}
    >
      {!isMe && (
        <View style={styles.avatarCol}>
          {isClusterEnd ? <Avatar name={msg.name} size={30} /> : null}
        </View>
      )}

      <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
        <View
          style={[
            styles.bubble,
            isMe ? [styles.bubbleMe, myBR] : [styles.bubbleOther, otherBR],
          ]}
        >
          {msg.type === "voice" && msg.duration != null ? (
            <VoiceNote isMe={isMe} duration={msg.duration} />
          ) : (
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
              {msg.text}
            </Text>
          )}
        </View>

        {isClusterEnd && (
          <View style={[styles.msgMeta, isMe ? styles.msgMetaRight : styles.msgMetaLeft]}>
            <Text style={styles.msgTime}>{msg.time}</Text>
            {isMe && (
              <View style={styles.tickWrap}>
                <ReadStatus state={readState} />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Date separator
───────────────────────────────────────────────────────────────────── */

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSep}>
      <View style={styles.dateLine} />
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateLine} />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function DMChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<any>>(null);

  const { firebaseUser, user } = useAuth();
  const myUid = firebaseUser?.uid ?? "";
  const myUsername = user?.username ?? "you";

  const [text, setText] = useState("");
  const [thread, setThread] = useState<DMThreadDoc | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);

  /* ── Subscriptions ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!id) return;
    return subscribeThread(id, t => setThread(t));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeMessages("dm", id, docs => {
      setMessages(docs.map(m => mapMessage(m, myUid)));
    });
  }, [id, myUid]);

  /* Mark read whenever screen is focused and messages change. */
  useEffect(() => {
    if (!id || !myUid) return;
    markThreadRead(id, myUid).catch(() => {});
  }, [id, myUid, messages.length]);

  /* ── Derived values ────────────────────────────────────────────── */

  const otherUid = useMemo(() => {
    if (!thread || !myUid) return "";
    return thread.participants.find(p => p !== myUid) ?? "";
  }, [thread, myUid]);

  const otherProfile = otherUid ? thread?.participantProfiles?.[otherUid] : undefined;
  const otherName = otherProfile?.username ?? "User";

  /** How many of my recent messages the other person has not yet read. */
  const otherUnread: number = useMemo(() => {
    if (!thread || !otherUid) return 0;
    return (thread.unread as Record<string, number>)?.[otherUid] ?? 0;
  }, [thread, otherUid]);

  /* ── Send text ──────────────────────────────────────────────────── */

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !id || !myUid || !otherUid) return;

    setSending(true);
    const savedText = text;
    setText("");

    try {
      await sendTextMessage("dm", id, { uid: myUid, username: myUsername, text: trimmed });
      await touchThreadLastMessage(id, { preview: trimmed, senderUid: myUid, recipientUid: otherUid });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      setText(savedText);
    } finally {
      setSending(false);
    }
  }, [text, sending, id, myUid, otherUid, myUsername]);

  /* ── Send voice ─────────────────────────────────────────────────── */

  const handleVoiceSend = useCallback(async (durationSec: number) => {
    setRecording(false);
    if (!id || !myUid || !otherUid) return;

    try {
      // TODO: replace STUB_URL with a real Cloudflare R2 signed URL after
      // recording with expo-av (Audio.Recording). Install expo-av and wire it up.
      const STUB_URL = "";
      await sendVoiceMessage("dm", id, {
        uid: myUid,
        username: myUsername,
        durationSec,
        url: STUB_URL,
      });
      await touchThreadLastMessage(id, {
        preview: `🎙 Voice message (${fmtDuration(durationSec)})`,
        senderUid: myUid,
        recipientUid: otherUid,
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      /* swallow — user can retry */
    }
  }, [id, myUid, otherUid, myUsername]);

  /* ── List data ──────────────────────────────────────────────────── */

  type ListItem =
    | { kind: "separator"; label: string; key: string }
    | { kind: "msg"; msg: ChatMessage; prevMsg?: ChatMessage; nextMsg?: ChatMessage; key: string };

  const listData = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    let lastDayLabel: string | null = null;
    messages.forEach((msg, i) => {
      const label = dateLabelFor(msg.ts);
      if (label !== lastDayLabel) {
        result.push({ kind: "separator", label, key: `sep-${label}-${i}` });
        lastDayLabel = label;
      }
      result.push({
        kind: "msg",
        msg,
        prevMsg: messages[i - 1],
        nextMsg: messages[i + 1],
        key: msg.id,
      });
    });
    return result;
  }, [messages]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === "separator") return <DateSeparator label={item.label} />;
      const readState = deriveReadState(item.msg, myUid, messages, otherUnread);
      return (
        <Bubble
          msg={item.msg}
          prevMsg={item.prevMsg}
          nextMsg={item.nextMsg}
          myUid={myUid}
          readState={readState}
        />
      );
    },
    [myUid, messages, otherUnread]
  );

  const topPad = insets.top + (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: orbit.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── HEADER ───────────────────────────────────────────────── */}
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

        <TouchableOpacity
          style={styles.headerMeta}
          activeOpacity={0.75}
          onPress={() => otherUid && router.push(`/user/${otherUid}` as never)}
          accessibilityRole="button"
          accessibilityLabel="View profile"
        >
          <Avatar name={otherName} size={34} online />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
            <Text style={styles.headerOnline}>online</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voice call"
          >
            <Feather name="phone" size={20} color={orbit.textSecond} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Feather name="more-vertical" size={20} color={orbit.textSecond} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerRule} />

      {/* ── MESSAGES ─────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.msgList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {/* ── INPUT BAR / RECORDER ─────────────────────────────────── */}
      {recording ? (
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setRecording(false)}
        />
      ) : (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <TouchableOpacity
            style={styles.inputSideBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Attach file"
          >
            <Feather name="paperclip" size={20} color={orbit.textTertiary} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={orbit.textTertiary}
              multiline
              maxLength={2000}
              returnKeyType="default"
              accessibilityLabel="Type a message"
              editable={!sending}
            />
          </View>

          {text.trim().length > 0 ? (
            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Feather name="send" size={15} color={orbit.white} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.inputSideBtn}
              hitSlop={6}
              onPress={() => setRecording(true)}
              accessibilityRole="button"
              accessibilityLabel="Record voice message"
            >
              <Feather name="mic" size={20} color={orbit.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  headerMeta: {
    flex: 1,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  headerName: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.01,
  },
  headerOnline: {
    color: orbit.success,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  headerActions: { flexDirection: "row", gap: 4, alignItems: "center" },
  headerActionBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRule: { height: 1, backgroundColor: orbit.borderSubtle },

  /* Message list */
  msgList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },

  /* Date separator */
  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
    paddingHorizontal: 8,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: orbit.borderSubtle },
  dateLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  /* Bubbles */
  msgRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },

  avatarCol: {
    width: 34,
    alignItems: "center",
    marginRight: 6,
    alignSelf: "flex-end",
    paddingBottom: 18,
  },

  msgGroup: { maxWidth: "74%" },
  msgGroupMe: { alignItems: "flex-end" },
  msgGroupOther: { alignItems: "flex-start" },

  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: orbit.accent },
  bubbleOther: { backgroundColor: orbit.surface2 },

  msgText: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  msgTextMe: { color: orbit.white },
  msgTextOther: { color: orbit.textPrimary },

  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
    marginHorizontal: 6,
  },
  msgMetaRight: { alignSelf: "flex-end" },
  msgMetaLeft: { alignSelf: "flex-start" },
  msgTime: { color: orbit.textTertiary, fontSize: 11, fontWeight: "500" },
  tickWrap: { marginTop: 1 },

  /* Voice note playback */
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 168,
  },
  voicePlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 22,
  },
  waveBar: { flex: 1, borderRadius: 2, minWidth: 2 },
  voiceDuration: { fontSize: 12, fontWeight: "500" },

  /* Input bar */
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
  inputSideBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: orbit.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: orbit.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  /* Voice recorder bar */
  recorderBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    backgroundColor: orbit.surface1,
    gap: 12,
  },
  recorderCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: orbit.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  recorderCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recorderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: orbit.danger,
  },
  recorderLabel: {
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: "500",
  },
  recorderTime: {
    color: orbit.danger,
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  recorderSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: orbit.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: orbit.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});

/**
 * ORBIT — Room Chat Screen (Firestore-wired)
 *
 * v2 changes from v1 (mock):
 *   • Room header reads from /rooms/{id} via subscribeRoom.
 *   • Messages load live from /rooms/{id}/messages via subscribeMessages.
 *   • handleSend() writes to Firestore + bumps denormalized lastMessage*.
 *   • MY_UID comes from AuthContext.
 *   • Falls back to mock BASE_MSGS if the user is not signed in (splash).
 *
 * UI chrome, voice-note waveform, bubble clustering, date separators
 * — all preserved bit-for-bit. No hardcoded hex added. Orbit tokens only.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ROOMS } from "@/constants/data";
import { Avatar } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeRoom,
  touchRoomLastMessage,
  type RoomDoc,
} from "@/lib/firestore-rooms";
import {
  subscribeMessages,
  sendTextMessage,
  type MessageDoc,
} from "@/lib/firestore-messages";

/* ─────────────────────────────────────────────────────────────────────
   TYPES (screen-local view model — keeps the Bubble renderer unchanged)
───────────────────────────────────────────────────────────────────── */

type MsgType = "text" | "voice" | "image";

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text?: string;
  type: MsgType;
  duration?: number;
  caption?: string;
  time: string;
  /** Numeric ts used ONLY to group date separators; seconds-since-epoch is fine. */
  ts: number;
}

/* Fixed waveform heights (unchanged from v1) */
const WAVE_HEIGHTS = [6, 12, 8, 16, 10, 18, 8, 14, 10, 16, 8, 12, 6, 14, 10, 18, 8, 12, 6, 10];

/* ─────────────────────────────────────────────────────────────────────
   MOCK — used only when the user is signed out (e.g. during splash).
───────────────────────────────────────────────────────────────────── */
const FALLBACK_UID = "me";
const BASE_MSGS: ChatMessage[] = [
  { id: "1", uid: "ghost_player", name: "ghost_player", text: "Kal ka plan kya hai yaar?", type: "text", time: "21:58", ts: 1 },
  { id: "2", uid: "neo_gamer", name: "neo_gamer", text: "Gaming session pakka?", type: "text", time: "21:59", ts: 1 },
  { id: "3", uid: FALLBACK_UID, name: "You", text: "Haan chalega, kya time pe milna?", type: "text", time: "22:00", ts: 1 },
];

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
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** Map a Firestore message doc → the screen's view model. */
function mapMessage(m: MessageDoc, myUid: string): ChatMessage {
  const isMe = m.uid === myUid;
  return {
    id: m.id,
    uid: m.uid,
    name: isMe ? "You" : m.username,
    text: m.text ?? undefined,
    type: (m.type === "system" ? "text" : m.type) as MsgType,
    duration: m.duration ?? undefined,
    caption: m.caption ?? undefined,
    time: fmtHHMM(m.createdAt),
    ts: tsToSeconds(m.createdAt),
  };
}

/** Labels for the date separator above a message cluster. */
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

/* ─────────────────────────────────────────────────────────────────────
   Sub-components (unchanged rendering)
───────────────────────────────────────────────────────────────────── */

function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

function VoiceNote({ isMe, duration }: { isMe: boolean; duration: number }) {
  const [playing, setPlaying] = useState(false);
  const iconColor = isMe ? "rgba(255,255,255,0.9)" : orbit.textPrimary;
  const barColor = isMe ? "rgba(255,255,255,0.45)" : orbit.textTertiary;
  const barActive = isMe ? "rgba(255,255,255,0.85)" : orbit.textPrimary;
  const timeColor = isMe ? "rgba(255,255,255,0.65)" : orbit.textTertiary;

  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity
        style={[styles.voicePlay, { backgroundColor: isMe ? "rgba(255,255,255,0.18)" : orbit.surface3 }]}
        onPress={() => setPlaying(p => !p)}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
      >
        <Feather name={playing ? "pause" : "play"} size={13} color={iconColor} />
      </TouchableOpacity>

      <View style={styles.waveform}>
        {WAVE_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              { height: h, backgroundColor: playing && i < 8 ? barActive : barColor },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.voiceDuration, { color: timeColor }]}>
        {`0:${duration.toString().padStart(2, "0")}`}
      </Text>
    </View>
  );
}

function Bubble({
  msg, prevMsg, nextMsg, myUid,
}: {
  msg: ChatMessage;
  prevMsg?: ChatMessage;
  nextMsg?: ChatMessage;
  myUid: string;
}) {
  const isMe = msg.uid === myUid;
  const prevSame = prevMsg?.uid === msg.uid;
  const nextSame = nextMsg?.uid === msg.uid;
  const isClusterStart = !prevSame;
  const isClusterEnd = !nextSame;

  const bubbleRadius = 18;
  const tailRadius = 4;
  const myBR = {
    borderTopLeftRadius: bubbleRadius,
    borderTopRightRadius: isClusterStart ? bubbleRadius : tailRadius,
    borderBottomLeftRadius: bubbleRadius,
    borderBottomRightRadius: isClusterEnd ? tailRadius : bubbleRadius,
  };
  const otherBR = {
    borderTopLeftRadius: isClusterStart ? bubbleRadius : tailRadius,
    borderTopRightRadius: bubbleRadius,
    borderBottomLeftRadius: isClusterEnd ? tailRadius : bubbleRadius,
    borderBottomRightRadius: bubbleRadius,
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
        {!isMe && isClusterStart && (
          <Text style={styles.senderName}>{msg.name}</Text>
        )}

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
          <Text style={[styles.msgTime, isMe ? styles.msgTimeRight : styles.msgTimeLeft]}>
            {msg.time}
          </Text>
        )}
      </View>
    </View>
  );
}

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

export default function RoomChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<any>>(null);

  const { firebaseUser, user } = useAuth();
  const myUid = firebaseUser?.uid ?? FALLBACK_UID;
  const myUsername = user?.username ?? "you";

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomDoc, setRoomDoc] = useState<RoomDoc | null>(null);
  const [sending, setSending] = useState(false);

  /* Room header — live. Falls back to mock ROOMS catalog so the header
     never flashes empty while we wait for Firestore. */
  const mockRoom = useMemo(
    () => ROOMS.find((r) => r.id === id) ?? ROOMS[0],
    [id]
  );

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeRoom(id, (doc) => setRoomDoc(doc));
    return unsub;
  }, [id]);

  /* Live messages. */
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeMessages("room", id, (docs) => {
      const mapped = docs.map((m) => mapMessage(m, myUid));
      // If Firestore is empty AND user is signed out → show mock so screen isn't blank.
      setMessages(mapped.length === 0 && !firebaseUser ? BASE_MSGS : mapped);
    });
    return unsub;
  }, [id, myUid, firebaseUser]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !id) return;
    if (!firebaseUser || !user) return;           // no optimistic send when signed-out

    setSending(true);
    const originalText = text;
    setText("");                                   // optimistic UI

    try {
      await sendTextMessage("room", id, {
        uid: myUid,
        username: myUsername,
        text: trimmed,
      });
      await touchRoomLastMessage(id, {
        preview: trimmed,
        uid: myUid,
        username: myUsername,
      });
      // Live subscription will deliver the new doc and auto-scroll.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (e) {
      // Put the text back so the user can retry.
      setText(originalText);
    } finally {
      setSending(false);
    }
  }, [text, sending, id, firebaseUser, user, myUid, myUsername]);

  /* Build list items with date separators at cluster boundaries. */
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
      if (item.kind === "separator") {
        return <DateSeparator label={item.label} />;
      }
      return (
        <Bubble
          msg={item.msg}
          prevMsg={item.prevMsg}
          nextMsg={item.nextMsg}
          myUid={myUid}
        />
      );
    },
    [myUid]
  );

  const topPad = insets.top + (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  /* Header display values (prefer live doc, fall back to mock). */
  const headerName = roomDoc?.name ?? mockRoom.name;
  const headerOnline = roomDoc?.memberCount ?? mockRoom.online;
  const headerIsLive = roomDoc?.isLive ?? mockRoom.isLive;

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
          accessibilityRole="button"
          accessibilityLabel="Room info"
          onPress={() => router.push(`/user/${id}` as never)}
        >
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerName} numberOfLines={1}>
              {headerName}
            </Text>
            {headerIsLive && <LiveBadge />}
          </View>
          <Text style={styles.headerSub}>
            {headerOnline.toLocaleString("en-IN")} members online
          </Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            hitSlop={8}
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Search in chat"
          >
            <Feather name="search" size={20} color={orbit.textSecond} />
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={8}
            style={styles.headerActionBtn}
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
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.msgList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {/* ── INPUT BAR ─────────────────────────────────────────────── */}
      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 8) + 8 },
        ]}
      >
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
            accessibilityRole="none"
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
            accessibilityRole="button"
            accessibilityLabel="Record voice message"
          >
            <Feather name="mic" size={20} color={orbit.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES (unchanged from v1)
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1 },

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
  headerMeta: { flex: 1, paddingHorizontal: 4 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerName: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.01,
    flexShrink: 1,
  },
  headerSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRule: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(229, 72, 77, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: orbit.danger,
  },
  liveText: {
    color: orbit.danger,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  msgList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },

  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
    paddingHorizontal: 8,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: orbit.borderSubtle,
  },
  dateLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
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

  senderName: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
    marginLeft: 14,
    letterSpacing: 0.1,
  },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: { backgroundColor: orbit.accent },
  bubbleOther: { backgroundColor: orbit.surface2 },

  msgText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  msgTextMe: { color: orbit.white },
  msgTextOther: { color: orbit.textPrimary },

  msgTime: {
    fontSize: 11,
    fontWeight: "500",
    color: orbit.textTertiary,
    marginTop: 3,
    marginHorizontal: 6,
  },
  msgTimeRight: { alignSelf: "flex-end" },
  msgTimeLeft: { alignSelf: "flex-start" },

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
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: "500",
  },

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
});

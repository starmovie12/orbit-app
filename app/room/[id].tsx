/**
 * ORBIT — Room Chat Screen
 *
 * Full group chat experience. Supports: text, voice notes, image previews.
 * Design tokens: orbit.* only. No hardcoded hex. No emojis in chrome.
 * Feather icons only. 4px spacing grid. One accent color.
 */

import React, {
  useState,
  useRef,
  useCallback,
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

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

type MsgType = "text" | "voice" | "image";

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text?: string;
  type: MsgType;
  /** Voice note duration in seconds */
  duration?: number;
  /** Image caption */
  caption?: string;
  time: string;
  /** ISO timestamp for date separators */
  ts: number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOCK DATA — one conversation per room id, fallback to "default"
───────────────────────────────────────────────────────────────────────────── */

const MY_UID = "me";

const BASE_MSGS: ChatMessage[] = [
  { id: "1",  uid: "ghost_player", name: "ghost_player", text: "Kal ka plan kya hai yaar?",              type: "text",  time: "21:58", ts: 1 },
  { id: "2",  uid: "neo_gamer",    name: "neo_gamer",    text: "Gaming session pakka?",                  type: "text",  time: "21:59", ts: 1 },
  { id: "3",  uid: MY_UID,         name: "You",          text: "Haan chalega, kya time pe milna?",       type: "text",  time: "22:00", ts: 1 },
  { id: "4",  uid: "ghost_player", name: "ghost_player", text: "Raat 10 baje ke baad? Server ready hai", type: "text",  time: "22:01", ts: 1 },
  { id: "5",  uid: "noor_bhai",    name: "noor_bhai",                                                    type: "voice", duration: 12, time: "22:03", ts: 1 },
  { id: "6",  uid: MY_UID,         name: "You",          text: "Perfect, main 10:15 pe aaunga",          type: "text",  time: "22:04", ts: 1 },
  { id: "7",  uid: "neo_gamer",    name: "neo_gamer",    text: "Bhai aaj sad lag raha yaar…",            type: "text",  time: "22:10", ts: 2 },
  { id: "8",  uid: "ghost_player", name: "ghost_player", text: "Kya hua bhai, sab theek?",               type: "text",  time: "22:11", ts: 2 },
  { id: "9",  uid: MY_UID,         name: "You",          text: "Tension mat lo, will catch up!",         type: "text",  time: "22:12", ts: 2 },
  { id: "10", uid: "noor_bhai",    name: "noor_bhai",    text: "Haha +1 bhai sab milke solve karenge",   type: "text",  time: "22:13", ts: 2 },
  { id: "11", uid: "ghost_player", name: "ghost_player",                                                 type: "voice", duration: 8,  time: "22:14", ts: 2 },
  { id: "12", uid: MY_UID,         name: "You",          text: "Ekdum sahi kaha",                        type: "text",  time: "22:15", ts: 2 },
];

/** Fixed waveform heights per index (no Math.random to avoid re-render flicker) */
const WAVE_HEIGHTS = [6, 12, 8, 16, 10, 18, 8, 14, 10, 16, 8, 12, 6, 14, 10, 18, 8, 12, 6, 10];

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

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
              {
                height: h,
                backgroundColor: playing && i < 8 ? barActive : barColor,
              },
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

/** Single message bubble + metadata */
function Bubble({
  msg,
  prevMsg,
  nextMsg,
}: {
  msg: ChatMessage;
  prevMsg?: ChatMessage;
  nextMsg?: ChatMessage;
}) {
  const isMe = msg.uid === MY_UID;
  const prevSame = prevMsg?.uid === msg.uid;
  const nextSame = nextMsg?.uid === msg.uid;
  const isClusterStart = !prevSame;
  const isClusterEnd = !nextSame;

  /* Border radius logic — clusters share radius on inner edges */
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
      {/* Avatar column (others) — visible only at cluster start */}
      {!isMe && (
        <View style={styles.avatarCol}>
          {isClusterEnd ? <Avatar name={msg.name} size={30} /> : null}
        </View>
      )}

      <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
        {/* Sender name — first in cluster, others only */}
        {!isMe && isClusterStart && (
          <Text style={styles.senderName}>{msg.name}</Text>
        )}

        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, myBR]
              : [styles.bubbleOther, otherBR],
          ]}
        >
          {msg.type === "voice" && msg.duration != null ? (
            <VoiceNote isMe={isMe} duration={msg.duration} />
          ) : (
            <Text
              style={[
                styles.msgText,
                isMe ? styles.msgTextMe : styles.msgTextOther,
              ]}
            >
              {msg.text}
            </Text>
          )}
        </View>

        {/* Timestamp — only at cluster end */}
        {isClusterEnd && (
          <Text
            style={[
              styles.msgTime,
              isMe ? styles.msgTimeRight : styles.msgTimeLeft,
            ]}
          >
            {msg.time}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Date separator between message groups */
function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSep}>
      <View style={styles.dateLine} />
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateLine} />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCREEN
───────────────────────────────────────────────────────────────────────────── */

export default function RoomChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(BASE_MSGS);

  const room = useMemo(
    () => ROOMS.find((r) => r.id === id) ?? ROOMS[0],
    [id]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      uid: MY_UID,
      name: "You",
      text: trimmed,
      type: "text",
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      ts: 3,
    };
    setMessages((prev) => [...prev, newMsg]);
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [text]);

  type ListItem =
    | { kind: "separator"; label: string; key: string }
    | { kind: "msg"; msg: ChatMessage; prevMsg?: ChatMessage; nextMsg?: ChatMessage; key: string };

  const listData = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    let lastTs: number | null = null;
    messages.forEach((msg, i) => {
      if (msg.ts !== lastTs) {
        const labels: Record<number, string> = { 1: "Yesterday", 2: "Today", 3: "Today" };
        result.push({ kind: "separator", label: labels[msg.ts] ?? "Today", key: `sep-${msg.ts}` });
        lastTs = msg.ts;
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
        <Bubble msg={item.msg} prevMsg={item.prevMsg} nextMsg={item.nextMsg} />
      );
    },
    []
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
          accessibilityRole="button"
          accessibilityLabel="Room info"
          onPress={() => router.push(`/user/${id}` as never)}
        >
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerName} numberOfLines={1}>
              {room.name}
            </Text>
            {room.isLive && <LiveBadge />}
          </View>
          <Text style={styles.headerSub}>
            {room.online.toLocaleString("en-IN")} members online
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
          />
        </View>

        {text.trim().length > 0 ? (
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
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

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────────────── */

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

  /* Live badge */
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

  /* Messages list */
  msgList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },

  /* Date separator */
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

  /* Message row */
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },

  /* Avatar column — 34px wide, always takes space for alignment */
  avatarCol: {
    width: 34,
    alignItems: "center",
    marginRight: 6,
    alignSelf: "flex-end",
    paddingBottom: 18, // clears timestamp
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

  /* Bubble */
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

  /* Voice note */
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
});

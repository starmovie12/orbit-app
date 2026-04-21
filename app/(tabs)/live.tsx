/**
 * ORBIT — Live Tab  (app/(tabs)/live.tsx)
 *
 * ORBIT Live = Clubhouse-style audio rooms with a desi twist.
 * Blueprint §11: Agora RTC, <300ms latency, credit-gated host revenue.
 *
 * To add this tab to the nav bar, add to app/(tabs)/_layout.tsx:
 *   <Tabs.Screen
 *     name="live"
 *     options={{
 *       title: "Live",
 *       tabBarIcon: ({ focused }) => <TabIcon name="radio" focused={focused} />,
 *       tabBarLabel: ({ focused }) => <TabLabel label="Live" focused={focused} />,
 *     }}
 *   />
 *
 * ────────────────────────────────────────────────────────────────────
 * Architecture:
 *   • Firestore /rooms where kind == "live" → live room list.
 *   • "Go Live" → creates a /rooms doc with kind="live" + isLive=true.
 *   • Joining: updates memberCount via Firestore transaction.
 *   • Agora RTC: install `react-native-agora` (npm i react-native-agora).
 *     Until installed, the join flow shows the room UI without actual audio.
 *     Wire AGORA_APP_ID in your .env and remove the AGORA_STUB guard.
 * ────────────────────────────────────────────────────────────────────
 *
 * SETUP (one-time):
 *   1. npm install react-native-agora
 *   2. Add EXPO_PUBLIC_AGORA_APP_ID=<your-id> to .env
 *   3. Remove the `AGORA_STUB` constant below and uncomment the real imports.
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
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { firestore, serverTimestamp, increment } from "@/lib/firebase";
import type { RoomDoc } from "@/lib/firestore-rooms";

// Cross-platform Firestore .exists helper (web compat vs native SDK)
function snapExists(s: any): boolean { return typeof s.exists === 'function' ? s.exists() : !!s.exists; }

/* ─────────────────────────────────────────────────────────────────────
   Agora RTC integration
   ─────────────────────────────────────────────────────────────────────
   Set AGORA_STUB = false and wire real imports once react-native-agora
   is installed. The UI is fully wired — only the SDK calls are stubbed.
───────────────────────────────────────────────────────────────────── */

const AGORA_STUB = true; // ← flip to false after installing react-native-agora
const AGORA_APP_ID = (process.env.EXPO_PUBLIC_AGORA_APP_ID as string) ?? "";

// When react-native-agora is installed, replace this stub module with:
//   import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } from 'react-native-agora';
const AgoraStub = {
  createEngine: () => null as any,
  joinChannel: async (_ch: string, _uid: number, _options: any) => {},
  leaveChannel: async () => {},
  setClientRole: (_role: "host" | "audience") => {},
  enableAudio: () => {},
  muteLocalAudioStream: (_muted: boolean) => {},
  destroy: () => {},
};

function buildAgoraEngine() {
  if (AGORA_STUB || !AGORA_APP_ID) return AgoraStub;
  // Real: return createAgoraRtcEngine();
  return AgoraStub;
}

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers for Live rooms
───────────────────────────────────────────────────────────────────── */

const ROOMS_COL = "rooms";

/** Subscribe to all live rooms (kind == "live" and isLive == true). */
function subscribeLiveRooms(onChange: (rooms: RoomDoc[]) => void): () => void {
  return firestore()
    .collection(ROOMS_COL)
    .where("kind", "==", "live")
    .where("isLive", "==", true)
    .orderBy("memberCount", "desc")
    .onSnapshot(
      qs => {
        const list: RoomDoc[] = [];
        qs.forEach(doc => {
          list.push({ id: doc.id, ...(doc.data() as Omit<RoomDoc, "id">) });
        });
        onChange(list);
      },
      () => onChange([])
    );
}

/** Create a new live audio room. Returns the new room id. */
async function createLiveRoom(args: {
  name: string;
  description: string;
  language: string;
  hostUid: string;
  hostUsername: string;
  accent: string;
}): Promise<string> {
  const ref = firestore().collection(ROOMS_COL).doc();
  await ref.set({
    name: args.name,
    icon: "radio",
    accent: args.accent,
    description: args.description,
    kind: "live",
    language: args.language,
    memberCount: 1,
    lastMessagePreview: `${args.hostUsername} started a live room`,
    lastMessageAt: serverTimestamp(),
    lastMessageUid: args.hostUid,
    lastMessageUsername: args.hostUsername,
    isLive: true,
    liveHostUid: args.hostUid,
    createdAt: serverTimestamp(),
    createdBy: args.hostUid,
  });
  return ref.id;
}

/** Increment or decrement listener count. */
async function updateListenerCount(roomId: string, delta: 1 | -1): Promise<void> {
  await firestore().collection(ROOMS_COL).doc(roomId).update({
    memberCount: increment(delta),
  });
}

/** Mark room as ended (isLive = false). */
async function endLiveRoom(roomId: string): Promise<void> {
  await firestore().collection(ROOMS_COL).doc(roomId).update({
    isLive: false,
    liveHostUid: null,
  });
}

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type LiveRoom = RoomDoc;

type JoinedSession = {
  roomId: string;
  roomName: string;
  isHost: boolean;
  muted: boolean;
};

const LANGUAGE_OPTIONS = [
  "Hindi", "English", "Hinglish", "Punjabi",
  "Tamil", "Telugu", "Marathi", "Bengali",
];

const ACCENT_OPTIONS = [
  orbit.accent,
  orbit.success,
  orbit.warning,
  orbit.danger,
];

/* ─────────────────────────────────────────────────────────────────────
   Live Room Card
───────────────────────────────────────────────────────────────────── */

function LivePulse() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scaleAnim, opacityAnim]);

  return (
    <View style={styles.livePulseWrap}>
      <Animated.View
        style={[
          styles.livePulseRing,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      />
      <View style={styles.livePulseDot} />
    </View>
  );
}

function RoomCard({ room, onJoin }: { room: LiveRoom; onJoin: (room: LiveRoom) => void }) {
  return (
    <TouchableOpacity
      style={styles.roomCard}
      activeOpacity={0.82}
      onPress={() => onJoin(room)}
      accessibilityRole="button"
      accessibilityLabel={`Join ${room.name}`}
    >
      <View style={styles.roomCardTop}>
        {/* Icon */}
        <View style={[styles.roomIconWrap, { backgroundColor: room.accent + "1A" }]}>
          <Feather name="radio" size={18} color={room.accent} />
        </View>

        {/* Meta */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          {room.description ? (
            <Text style={styles.roomDesc} numberOfLines={1}>{room.description}</Text>
          ) : null}
        </View>

        {/* Live badge + listener count */}
        <View style={styles.roomBadgeCol}>
          <View style={styles.liveBadge}>
            <LivePulse />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <View style={styles.listenerRow}>
            <Feather name="headphones" size={10} color={orbit.textTertiary} />
            <Text style={styles.listenerCount}>
              {room.memberCount.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      </View>

      {/* Join bar */}
      <View style={[styles.roomJoinBar, { backgroundColor: room.accent }]}>
        <Text style={styles.roomJoinText}>Tap to join</Text>
        <Feather name="headphones" size={12} color={orbit.white} />
      </View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Go Live bottom sheet
───────────────────────────────────────────────────────────────────── */

interface GoLiveSheetProps {
  visible: boolean;
  onClose: () => void;
  onLive: (roomId: string) => void;
  hostUsername: string;
}

function GoLiveSheet({ visible, onClose, onLive, hostUsername }: GoLiveSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [language, setLanguage] = useState("Hinglish");
  const [accent, setAccent] = useState(orbit.accent);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
      // Reset form
      setName("");
      setDesc("");
      setLanguage("Hinglish");
      setAccent(orbit.accent);
      setStarting(false);
    }
  }, [visible, slideAnim]);

  const { firebaseUser, user } = useAuth();

  const handleStart = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || starting || !firebaseUser) return;
    setStarting(true);
    try {
      const roomId = await createLiveRoom({
        name: trimmedName,
        description: desc.trim(),
        language,
        hostUid: firebaseUser.uid,
        hostUsername: user?.username ?? hostUsername,
        accent,
      });
      onLive(roomId);
      onClose();
    } catch {
      setStarting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Go Live</Text>
            <Text style={styles.sheetSub}>Start an audio room — anyone on ORBIT can join.</Text>

            {/* Room name */}
            <Text style={styles.fieldLabel}>Room Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Late Night Feels, Tech Talk…"
              placeholderTextColor={orbit.textTertiary}
              maxLength={60}
              returnKeyType="next"
              accessibilityLabel="Room name"
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 72, paddingTop: 10 }]}
              value={desc}
              onChangeText={setDesc}
              placeholder="What will you talk about?"
              placeholderTextColor={orbit.textTertiary}
              multiline
              maxLength={140}
              accessibilityLabel="Room description"
            />

            {/* Language */}
            <Text style={styles.fieldLabel}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.langRow}>
                {LANGUAGE_OPTIONS.map(lang => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langChip, language === lang && styles.langChipActive]}
                    onPress={() => setLanguage(lang)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={lang}
                  >
                    <Text style={[styles.langChipText, language === lang && { color: orbit.accent }]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Accent color */}
            <Text style={styles.fieldLabel}>Room Color</Text>
            <View style={styles.accentRow}>
              {ACCENT_OPTIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.accentDot, { backgroundColor: c }, accent === c && styles.accentDotActive]}
                  onPress={() => setAccent(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  hitSlop={6}
                />
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[
                styles.goLiveBtn,
                { backgroundColor: accent },
                (!name.trim() || starting) && { opacity: 0.5 },
              ]}
              onPress={handleStart}
              disabled={!name.trim() || starting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Start live room"
            >
              {starting ? (
                <ActivityIndicator size="small" color={orbit.white} />
              ) : (
                <>
                  <View style={styles.goLivePulseSmall} />
                  <Text style={styles.goLiveBtnText}>Go Live</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   In-Room overlay (shown when user has joined a live room)
───────────────────────────────────────────────────────────────────── */

interface InRoomOverlayProps {
  session: JoinedSession;
  listenerCount: number;
  onToggleMute: () => void;
  onLeave: () => void;
}

function InRoomOverlay({ session, listenerCount, onToggleMute, onLeave }: InRoomOverlayProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [slideAnim]);

  return (
    <Animated.View
      style={[
        styles.inRoomBar,
        {
          bottom: insets.bottom + 16,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.inRoomLeft}>
        <View style={styles.inRoomLiveDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.inRoomName} numberOfLines={1}>{session.roomName}</Text>
          <View style={styles.inRoomMeta}>
            <Feather name="headphones" size={10} color={orbit.textTertiary} />
            <Text style={styles.inRoomCount}>{listenerCount.toLocaleString("en-IN")}</Text>
            {session.isHost && (
              <Text style={styles.inRoomHostBadge}>HOST</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.inRoomActions}>
        <TouchableOpacity
          style={[styles.inRoomBtn, session.muted && styles.inRoomBtnMuted]}
          onPress={onToggleMute}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={session.muted ? "Unmute" : "Mute"}
        >
          <Feather
            name={session.muted ? "mic-off" : "mic"}
            size={16}
            color={session.muted ? orbit.danger : orbit.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.inRoomLeaveBtn}
          onPress={onLeave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Leave room"
        >
          <Text style={styles.inRoomLeaveText}>Leave</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();

  const myUid = firebaseUser?.uid ?? "";
  const myUsername = user?.username ?? "you";

  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGoLive, setShowGoLive] = useState(false);
  const [session, setSession] = useState<JoinedSession | null>(null);
  const [liveListenerCount, setLiveListenerCount] = useState(0);

  // Agora engine ref — lives for the duration of an active session
  const engineRef = useRef<ReturnType<typeof buildAgoraEngine> | null>(null);

  const topPad = insets.top + (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  /* ── Subscribe to live rooms ────────────────────────────────────── */
  useEffect(() => {
    const unsub = subscribeLiveRooms(list => {
      setRooms(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  /* ── Subscribe to live listener count when in a room ───────────── */
  useEffect(() => {
    if (!session) return;
    const unsub = firestore()
      .collection(ROOMS_COL)
      .doc(session.roomId)
      .onSnapshot(snap => {
        if (snapExists(snap)) {
          setLiveListenerCount((snap.data() as RoomDoc).memberCount ?? 0);
        }
      }, () => {});
    return unsub;
  }, [session?.roomId]);

  /* ── Cleanup Agora on unmount ───────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.leaveChannel();
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  /* ── Join a room ────────────────────────────────────────────────── */
  const handleJoin = useCallback(async (room: LiveRoom) => {
    if (!myUid || session) return;

    const isHost = room.liveHostUid === myUid;

    try {
      // Increment listener count
      await updateListenerCount(room.id, 1);

      // Init Agora
      const engine = buildAgoraEngine();
      engineRef.current = engine;
      engine.enableAudio();
      engine.setClientRole(isHost ? "host" : "audience");

      // Join Agora channel (stub: passes roomId as channel name)
      // Real token should come from your backend token server.
      await engine.joinChannel(room.id, Math.abs(myUid.hashCode?.() ?? Math.random() * 9999 | 0), {
        clientRoleType: isHost ? 1 : 2, // HOST=1, AUDIENCE=2
        token: "", // ← Replace with token from your backend
      });

      setSession({
        roomId: room.id,
        roomName: room.name,
        isHost,
        muted: !isHost,
      });
    } catch {
      // Agora init failed — update listener count back
      await updateListenerCount(room.id, -1).catch(() => {});
    }
  }, [myUid, session]);

  /* ── Leave room ─────────────────────────────────────────────────── */
  const handleLeave = useCallback(async () => {
    if (!session) return;

    const { roomId, isHost } = session;

    try {
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        engineRef.current.destroy();
        engineRef.current = null;
      }
      await updateListenerCount(roomId, -1);
      if (isHost) await endLiveRoom(roomId);
    } finally {
      setSession(null);
    }
  }, [session]);

  /* ── Toggle mute ────────────────────────────────────────────────── */
  const handleToggleMute = useCallback(() => {
    if (!session) return;
    const next = !session.muted;
    engineRef.current?.muteLocalAudioStream(next);
    setSession(prev => prev ? { ...prev, muted: next } : prev);
  }, [session]);

  /* ── User went live (from GoLiveSheet) ─────────────────────────── */
  const handleWentLive = useCallback(async (roomId: string) => {
    if (!myUid) return;
    // Don't double-increment — createLiveRoom already sets memberCount=1
    const engine = buildAgoraEngine();
    engineRef.current = engine;
    engine.enableAudio();
    engine.setClientRole("host");
    await engine.joinChannel(roomId, Math.abs(myUid.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 99999), {
      clientRoleType: 1,
      token: "",
    });
    setSession({ roomId, roomName: "Your Room", isHost: true, muted: false });
  }, [myUid]);

  /* ── Render room card ───────────────────────────────────────────── */
  const renderRoom = useCallback(({ item }: { item: LiveRoom }) => (
    <RoomCard room={item} onJoin={handleJoin} />
  ), [handleJoin]);

  /* ── Empty state ────────────────────────────────────────────────── */
  const EmptyLive = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Feather name="radio" size={40} color={orbit.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No live rooms right now</Text>
      <Text style={styles.emptySub}>
        Be the first to start one — tap Go Live below.
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={styles.headerTitle}>ORBIT Live</Text>
        <View style={styles.headerRight}>
          {session && (
            <View style={styles.onAirBadge}>
              <View style={styles.onAirDot} />
              <Text style={styles.onAirText}>ON AIR</Text>
            </View>
          )}
          <TouchableOpacity
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search rooms"
          >
            <Feather name="search" size={20} color={orbit.textSecond} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── FEATURED BANNER ────────────────────────────────────────── */}
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerIconWrap}>
            <Feather name="zap" size={18} color={orbit.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Evening Rush · 8-11 PM</Text>
            <Text style={styles.bannerSub}>Most rooms are live now. Join the conversation.</Text>
          </View>
        </View>
      </View>

      {/* ── ROOMS LIST ─────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={orbit.accent} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={item => item.id}
          renderItem={renderRoom}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (session ? 110 : 100) },
          ]}
          ListEmptyComponent={EmptyLive}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            rooms.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderLabel}>
                  {rooms.length} ROOM{rooms.length !== 1 ? "S" : ""} LIVE
                </Text>
                <View style={styles.listHeaderDot} />
              </View>
            ) : null
          }
        />
      )}

      {/* ── GO LIVE CTA ────────────────────────────────────────────── */}
      <View style={[styles.ctaWrap, { bottom: insets.bottom + (session ? 86 : 16) }]}>
        <TouchableOpacity
          style={[styles.goLiveCta, session && { opacity: 0.45 }]}
          onPress={() => !session && setShowGoLive(true)}
          disabled={!!session}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={session ? "Already in a room" : "Go Live"}
        >
          <View style={styles.ctaPulseWrap}>
            <View style={styles.ctaPulseDot} />
          </View>
          <Text style={styles.ctaBtnText}>Go Live</Text>
          <Feather name="chevron-right" size={16} color={orbit.white} />
        </TouchableOpacity>
      </View>

      {/* ── IN-ROOM OVERLAY ────────────────────────────────────────── */}
      {session && (
        <InRoomOverlay
          session={session}
          listenerCount={liveListenerCount}
          onToggleMute={handleToggleMute}
          onLeave={handleLeave}
        />
      )}

      {/* ── GO LIVE SHEET ──────────────────────────────────────────── */}
      <GoLiveSheet
        visible={showGoLive}
        onClose={() => setShowGoLive(false)}
        onLive={handleWentLive}
        hostUsername={myUsername}
      />
    </View>
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: orbit.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  onAirBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: orbit.dangerSoft,
  },
  onAirDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.danger,
  },
  onAirText: {
    color: orbit.danger,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  /* Banner */
  banner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: orbit.accentSoftSolid,
    borderWidth: 1,
    borderColor: orbit.accentSoft,
    padding: 14,
  },
  bannerContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: orbit.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { color: orbit.textPrimary, fontSize: 14, fontWeight: "600" },
  bannerSub: { color: orbit.textSecond, fontSize: 12, marginTop: 3 },

  /* List */
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  listHeaderLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  listHeaderDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: orbit.danger,
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* Room card */
  roomCard: {
    borderRadius: 14,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    marginBottom: 12,
    overflow: "hidden",
  },
  roomCardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  roomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roomName: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  roomDesc: {
    color: orbit.textSecond,
    fontSize: 12,
    marginTop: 3,
  },
  roomBadgeCol: { alignItems: "flex-end", gap: 6 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: orbit.dangerSoft,
  },
  liveBadgeText: {
    color: orbit.danger,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  listenerRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  listenerCount: { color: orbit.textTertiary, fontSize: 11, fontWeight: "500" },
  roomJoinBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  roomJoinText: { color: orbit.white, fontSize: 13, fontWeight: "600" },

  /* Live pulse animation */
  livePulseWrap: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  livePulseRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: orbit.danger,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.danger,
  },

  /* Empty state */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  emptySub: {
    marginTop: 8,
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },

  /* Go Live CTA */
  ctaWrap: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  goLiveCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: orbit.danger,
    shadowColor: orbit.danger,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaPulseWrap: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  ctaPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: orbit.white },
  ctaBtnText: { color: orbit.white, fontSize: 16, fontWeight: "700", letterSpacing: -0.1 },

  /* In-room bar */
  inRoomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: orbit.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: orbit.black,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  inRoomLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  inRoomLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: orbit.danger,
  },
  inRoomName: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  inRoomMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  inRoomCount: { color: orbit.textTertiary, fontSize: 11, fontWeight: "500" },
  inRoomHostBadge: {
    color: orbit.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inRoomActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  inRoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: orbit.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  inRoomBtnMuted: { backgroundColor: orbit.dangerSoft },
  inRoomLeaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: orbit.dangerSoft,
  },
  inRoomLeaveText: { color: orbit.danger, fontSize: 13, fontWeight: "600" },

  /* Go Live sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: orbit.surface1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSub: {
    color: orbit.textSecond,
    fontSize: 13,
    marginBottom: 20,
  },
  fieldLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: orbit.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },
  langRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  langChipActive: {
    backgroundColor: orbit.accentSoft,
    borderColor: orbit.accent,
  },
  langChipText: { color: orbit.textSecond, fontSize: 13, fontWeight: "500" },
  accentRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  accentDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  accentDotActive: {
    borderWidth: 3,
    borderColor: orbit.white,
    shadowColor: orbit.black,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  goLiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 26,
  },
  goLivePulseSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: orbit.white,
  },
  goLiveBtnText: { color: orbit.white, fontSize: 16, fontWeight: "700" },
});

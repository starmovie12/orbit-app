/**
 * ORBIT — Live Audio Room Screen  (app/live/[id].tsx)
 *
 * Blueprint §11: Agora RTC <300ms audio, credit-gated entry,
 * speaker grid, raise-hand queue, host revenue flow via Firestore.
 *
 * SETUP:
 *   1. npm install react-native-agora
 *   2. EXPO_PUBLIC_AGORA_APP_ID=<your-id> in .env
 *   3. Set AGORA_STUB = false and uncomment real imports below.
 *
 * Architecture:
 *   • Firestore /rooms/{id}  → room doc (name, host, memberCount, isLive)
 *   • Firestore /rooms/{id}/liveParticipants/{uid} → speaker/listener docs
 *   • Firestore /users/{uid}/liveUsage/{YYYY-MM-DD} → credit gate (10/day)
 *   • Agora RTC channel = roomId, audience vs host roles
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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Avatar } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { firestore, serverTimestamp, increment } from "@/lib/firebase";
import type { RoomDoc } from "@/lib/firestore-rooms";

/* ─────────────────────────────────────────────────────────────────────
   Agora RTC — stub until react-native-agora is installed
───────────────────────────────────────────────────────────────────── */

const AGORA_STUB = true; // flip to false after: npm install react-native-agora
const AGORA_APP_ID = (process.env.EXPO_PUBLIC_AGORA_APP_ID as string) ?? "";

// When react-native-agora is installed, replace with:
//   import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } from 'react-native-agora';
const AgoraStub = {
  initialize: (_appId: string) => {},
  enableAudio: () => {},
  setChannelProfile: (_profile: number) => {},
  setClientRole: (_role: number) => {},
  joinChannel: (_token: string | null, _ch: string, _info: string, _uid: number) => 0,
  leaveChannel: () => 0,
  muteLocalAudioStream: (_muted: boolean) => 0,
  destroy: () => {},
  addListener: (_event: string, _cb: (...args: any[]) => void) => ({ remove: () => {} }),
};

function buildAgoraEngine() {
  if (AGORA_STUB || !AGORA_APP_ID) return AgoraStub;
  // Real:
  // const engine = createAgoraRtcEngine();
  // engine.initialize({ appId: AGORA_APP_ID });
  // return engine;
  return AgoraStub;
}

/* ─────────────────────────────────────────────────────────────────────
   Credit gate constants
───────────────────────────────────────────────────────────────────── */

const DAILY_CREDIT_LIMIT = 10;
const CREDITS_PER_SESSION = 1; // 1 credit deducted per session join

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type ParticipantRole = "host" | "speaker" | "listener";

type Participant = {
  uid: string;
  username: string;
  role: ParticipantRole;
  muted: boolean;
  handRaised: boolean;
  agoraUid?: number;
  joinedAt: number;
};

type LiveRoomState = {
  name: string;
  description: string;
  hostUid: string;
  hostUsername: string;
  memberCount: number;
  language: string;
  accent: string;
  isLive: boolean;
  createdAt: unknown;
};

/* ─────────────────────────────────────────────────────────────────────
   Firestore helpers
───────────────────────────────────────────────────────────────────── */

const ROOMS_COL = "rooms";
const USERS_COL = "users";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function checkAndDebitDailyCreditGate(uid: string): Promise<boolean> {
  const db = firestore();
  const usageRef = db
    .collection(USERS_COL)
    .doc(uid)
    .collection("liveUsage")
    .doc(todayKey());

  let allowed = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const used: number = snap.exists() ? (snap.data() as any)?.creditsUsed ?? 0 : 0;
    if (used >= DAILY_CREDIT_LIMIT) {
      allowed = false;
      return;
    }
    tx.set(usageRef, { creditsUsed: used + CREDITS_PER_SESSION }, { merge: true });
    allowed = true;
  });
  return allowed;
}

function subscribeRoomDoc(
  roomId: string,
  cb: (doc: LiveRoomState | null) => void
): () => void {
  return firestore()
    .collection(ROOMS_COL)
    .doc(roomId)
    .onSnapshot(
      (snap) => cb(snap.exists() ? (snap.data() as LiveRoomState) : null),
      () => cb(null)
    );
}

function subscribeParticipants(
  roomId: string,
  cb: (list: Participant[]) => void
): () => void {
  return firestore()
    .collection(ROOMS_COL)
    .doc(roomId)
    .collection("liveParticipants")
    .orderBy("joinedAt", "asc")
    .onSnapshot(
      (qs) => {
        const list: Participant[] = [];
        qs.forEach((doc) => list.push(doc.data() as Participant));
        cb(list);
      },
      () => cb([])
    );
}

async function joinParticipant(
  roomId: string,
  participant: Participant
): Promise<void> {
  const db = firestore();
  await db
    .collection(ROOMS_COL)
    .doc(roomId)
    .collection("liveParticipants")
    .doc(participant.uid)
    .set(participant);
  await db
    .collection(ROOMS_COL)
    .doc(roomId)
    .update({ memberCount: increment(1) });
}

async function leaveParticipant(roomId: string, uid: string): Promise<void> {
  const db = firestore();
  await db
    .collection(ROOMS_COL)
    .doc(roomId)
    .collection("liveParticipants")
    .doc(uid)
    .delete();
  await db
    .collection(ROOMS_COL)
    .doc(roomId)
    .update({ memberCount: increment(-1) });
}

async function updateParticipantField(
  roomId: string,
  uid: string,
  patch: Partial<Participant>
): Promise<void> {
  await firestore()
    .collection(ROOMS_COL)
    .doc(roomId)
    .collection("liveParticipants")
    .doc(uid)
    .update(patch);
}

async function endRoom(roomId: string): Promise<void> {
  const db = firestore();
  const pSnap = await db
    .collection(ROOMS_COL)
    .doc(roomId)
    .collection("liveParticipants")
    .get();
  const batch = db.batch();
  pSnap.forEach((doc) => batch.delete(doc.ref));
  batch.update(db.collection(ROOMS_COL).doc(roomId), {
    isLive: false,
    liveHostUid: null,
    memberCount: 0,
  });
  await batch.commit();
}

/* ─────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────── */

function LivePulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.pulseDot} />
    </View>
  );
}

function SpeakerCard({
  participant,
  isMe,
  onTap,
}: {
  participant: Participant;
  isMe: boolean;
  onTap: () => void;
}) {
  const isHost = participant.role === "host";
  const isSpeaker = participant.role === "speaker";

  return (
    <TouchableOpacity
      style={styles.speakerCard}
      onPress={onTap}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${participant.username}${isHost ? ", host" : ""}${participant.muted ? ", muted" : ""}`}
    >
      <View style={[styles.speakerAvatarWrap, participant.muted && styles.speakerAvatarMuted]}>
        <Avatar name={participant.username} size={56} />
        {!participant.muted && (
          <View style={styles.speakerAudioRing} />
        )}
        {isHost && (
          <View style={styles.hostBadgeWrap}>
            <Feather name="star" size={9} color={orbit.white} />
          </View>
        )}
      </View>
      <Text style={styles.speakerName} numberOfLines={1}>
        {isMe ? "You" : participant.username}
      </Text>
      <View style={styles.speakerStatus}>
        {participant.handRaised && (
          <Text style={styles.handRaisedEmoji}>✋</Text>
        )}
        {participant.muted ? (
          <Feather name="mic-off" size={11} color={orbit.textTertiary} />
        ) : (
          <Feather name="mic" size={11} color={orbit.success} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function ListenerRow({ participant }: { participant: Participant }) {
  return (
    <View style={styles.listenerRow}>
      <Avatar name={participant.username} size={32} />
      <Text style={styles.listenerName} numberOfLines={1}>
        {participant.username}
      </Text>
      {participant.handRaised && (
        <View style={styles.listenerHandBadge}>
          <Text style={{ fontSize: 12 }}>✋</Text>
        </View>
      )}
    </View>
  );
}

function CreditGateModal({
  visible,
  creditsUsedToday,
  onClose,
}: {
  visible: boolean;
  creditsUsedToday: number;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.creditGateCard}>
          <View style={styles.creditGateIconWrap}>
            <Feather name="lock" size={28} color={orbit.warning} />
          </View>
          <Text style={styles.creditGateTitle}>Daily Limit Reached</Text>
          <Text style={styles.creditGateSub}>
            You've used {creditsUsedToday}/{DAILY_CREDIT_LIMIT} live room credits today.
            Come back tomorrow for more sessions!
          </Text>
          <View style={styles.creditGateBar}>
            <View
              style={[
                styles.creditGateFill,
                { width: `${Math.min(100, (creditsUsedToday / DAILY_CREDIT_LIMIT) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.creditGateBarLabel}>
            {creditsUsedToday} / {DAILY_CREDIT_LIMIT} credits used today
          </Text>
          <TouchableOpacity
            style={styles.creditGateBtn}
            onPress={onClose}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.creditGateBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function RaiseHandQueueSheet({
  visible,
  raisedHands,
  onPromote,
  onDismiss,
  onClose,
}: {
  visible: boolean;
  raisedHands: Participant[];
  onPromote: (uid: string) => void;
  onDismiss: (uid: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Raised Hands</Text>
          <Text style={styles.sheetSub}>{raisedHands.length} listener{raisedHands.length !== 1 ? "s" : ""} want to speak</Text>
          {raisedHands.length === 0 ? (
            <View style={styles.sheetEmpty}>
              <Feather name="hand" size={32} color={orbit.textTertiary} />
              <Text style={styles.sheetEmptyText}>No hands raised yet</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {raisedHands.map((p) => (
                <View key={p.uid} style={styles.handQueueRow}>
                  <Avatar name={p.username} size={38} />
                  <Text style={styles.handQueueName} numberOfLines={1}>{p.username}</Text>
                  <View style={styles.handQueueActions}>
                    <TouchableOpacity
                      style={styles.handPromoteBtn}
                      onPress={() => onPromote(p.uid)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Invite ${p.username} to speak`}
                    >
                      <Feather name="mic" size={13} color={orbit.white} />
                      <Text style={styles.handPromoteBtnText}>Invite</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.handDismissBtn}
                      onPress={() => onDismiss(p.uid)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss ${p.username}`}
                    >
                      <Feather name="x" size={16} color={orbit.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={{ height: 20 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, user } = useAuth();

  const myUid = firebaseUser?.uid ?? "";
  const myUsername = user?.username ?? firebaseUser?.uid?.slice(0, 8) ?? "user";

  /* State */
  const [roomDoc, setRoomDoc] = useState<LiveRoomState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [showHandQueue, setShowHandQueue] = useState(false);
  const [creditGateVisible, setCreditGateVisible] = useState(false);
  const [creditsUsedToday, setCreditsUsedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  /* Agora engine ref */
  const engineRef = useRef<typeof AgoraStub | null>(null);

  /* Derived */
  const isHost = useMemo(
    () => roomDoc?.hostUid === myUid,
    [roomDoc, myUid]
  );

  const myParticipant = useMemo(
    () => participants.find((p) => p.uid === myUid),
    [participants, myUid]
  );

  const speakers = useMemo(
    () => participants.filter((p) => p.role === "host" || p.role === "speaker"),
    [participants]
  );

  const listeners = useMemo(
    () => participants.filter((p) => p.role === "listener"),
    [participants]
  );

  const raisedHands = useMemo(
    () => participants.filter((p) => p.role === "listener" && p.handRaised),
    [participants]
  );

  /* Subscriptions */
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeRoomDoc(id, (doc) => {
      setRoomDoc(doc);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeParticipants(id, setParticipants);
    return unsub;
  }, [id]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.leaveChannel();
        engineRef.current.destroy();
        engineRef.current = null;
      }
      if (joined && id && myUid) {
        leaveParticipant(id, myUid).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Join room */
  const handleJoin = useCallback(async () => {
    if (!id || !myUid || joining) return;
    setJoining(true);

    try {
      // Credit gate check
      const db = firestore();
      const usageRef = db
        .collection(USERS_COL)
        .doc(myUid)
        .collection("liveUsage")
        .doc(todayKey());
      const usageSnap = await usageRef.get();
      const usedToday: number = usageSnap.exists()
        ? (usageSnap.data() as any)?.creditsUsed ?? 0
        : 0;

      setCreditsUsedToday(usedToday);

      if (usedToday >= DAILY_CREDIT_LIMIT && !isHost) {
        setCreditGateVisible(true);
        setJoining(false);
        return;
      }

      // Debit credit (skip for host)
      if (!isHost) {
        const allowed = await checkAndDebitDailyCreditGate(myUid);
        if (!allowed) {
          setCreditsUsedToday(DAILY_CREDIT_LIMIT);
          setCreditGateVisible(true);
          setJoining(false);
          return;
        }
      }

      // Determine role
      const role: ParticipantRole = isHost ? "host" : "listener";
      const agoraRole = isHost ? 1 : 2; // 1 = broadcaster, 2 = audience in Agora

      // Join Firestore
      await joinParticipant(id, {
        uid: myUid,
        username: myUsername,
        role,
        muted: isHost ? false : true,
        handRaised: false,
        agoraUid: Math.floor(Math.random() * 1000000),
        joinedAt: Date.now(),
      });

      // Init Agora
      const engine = buildAgoraEngine();
      engine.initialize(AGORA_APP_ID);
      engine.enableAudio();
      engine.setChannelProfile(1); // LIVE_BROADCASTING
      engine.setClientRole(agoraRole);

      if (!AGORA_STUB) {
        engine.addListener("userJoined", (agoraUid: number) => {
          // remote user joined — RTC handles audio automatically
        });
        engine.addListener("userOffline", (agoraUid: number) => {
          // remote user left
        });
      }

      engine.joinChannel(null, id, "", 0);
      engineRef.current = engine;

      setMuted(isHost ? false : true);
      setJoined(true);
    } catch (e) {
      Alert.alert("Couldn't join", "Please try again.");
    } finally {
      setJoining(false);
    }
  }, [id, myUid, joining, isHost, myUsername]);

  /* Leave room */
  const handleLeave = useCallback(async () => {
    if (!id || !myUid) return;

    if (isHost) {
      Alert.alert(
        "End Room?",
        "Ending the room will remove all participants.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "End Room",
            style: "destructive",
            onPress: async () => {
              engineRef.current?.leaveChannel();
              engineRef.current?.destroy();
              engineRef.current = null;
              await endRoom(id);
              setJoined(false);
              router.back();
            },
          },
        ]
      );
      return;
    }

    engineRef.current?.leaveChannel();
    engineRef.current?.destroy();
    engineRef.current = null;
    await leaveParticipant(id, myUid);
    setJoined(false);
    router.back();
  }, [id, myUid, isHost, router]);

  /* Toggle mute */
  const handleToggleMute = useCallback(async () => {
    if (!joined || !id) return;
    const newMuted = !muted;
    engineRef.current?.muteLocalAudioStream(newMuted);
    setMuted(newMuted);
    await updateParticipantField(id, myUid, { muted: newMuted });
  }, [joined, id, muted, myUid]);

  /* Toggle raise hand */
  const handleRaiseHand = useCallback(async () => {
    if (!joined || !id || isHost || myParticipant?.role === "speaker") return;
    const newRaised = !handRaised;
    setHandRaised(newRaised);
    await updateParticipantField(id, myUid, { handRaised: newRaised });
  }, [joined, id, isHost, myParticipant, handRaised, myUid]);

  /* Host: promote listener to speaker */
  const handlePromoteSpeaker = useCallback(
    async (targetUid: string) => {
      if (!id || !isHost) return;
      await updateParticipantField(id, targetUid, {
        role: "speaker",
        handRaised: false,
        muted: false,
      });
      setShowHandQueue(false);
    },
    [id, isHost]
  );

  /* Host: dismiss raised hand */
  const handleDismissHand = useCallback(
    async (targetUid: string) => {
      if (!id || !isHost) return;
      await updateParticipantField(id, targetUid, { handRaised: false });
    },
    [id, isHost]
  );

  /* Tap a speaker card (host can mute/promote) */
  const handleSpeakerTap = useCallback(
    (participant: Participant) => {
      if (!isHost || participant.uid === myUid) return;
      Alert.alert(participant.username, "Manage speaker", [
        {
          text: participant.muted ? "Unmute" : "Mute",
          onPress: () =>
            updateParticipantField(id!, participant.uid, {
              muted: !participant.muted,
            }),
        },
        {
          text: "Remove from stage",
          style: "destructive",
          onPress: () =>
            updateParticipantField(id!, participant.uid, { role: "listener" }),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [isHost, myUid, id]
  );

  const topPad =
    insets.top + (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={orbit.accent} size="large" />
      </View>
    );
  }

  if (!roomDoc || !roomDoc.isLive) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <View style={styles.endedIconWrap}>
          <Feather name="radio" size={32} color={orbit.textTertiary} />
        </View>
        <Text style={styles.endedTitle}>Room Ended</Text>
        <Text style={styles.endedSub}>This live room is no longer active.</Text>
        <TouchableOpacity
          style={styles.endedBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.endedBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={joined ? handleLeave : () => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Leave room"
        >
          <Feather
            name={joined ? "log-out" : "arrow-left"}
            size={20}
            color={joined ? orbit.danger : orbit.textPrimary}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <LivePulse />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {roomDoc.name}
            </Text>
          </View>
          <Text style={styles.headerSub}>
            {roomDoc.memberCount} listening · {roomDoc.language}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {isHost && raisedHands.length > 0 && (
            <TouchableOpacity
              style={styles.handQueueBtn}
              onPress={() => setShowHandQueue(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${raisedHands.length} raised hands`}
            >
              <Text style={styles.handQueueBtnText}>✋ {raisedHands.length}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            hitSlop={8}
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Share room"
          >
            <Feather name="share-2" size={19} color={orbit.textSecond} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerRule} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SPEAKERS GRID ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>On Stage</Text>
        <View style={styles.speakersGrid}>
          {speakers.length === 0 ? (
            <View style={styles.emptyStagePlaceholder}>
              <Feather name="mic-off" size={22} color={orbit.textTertiary} />
              <Text style={styles.emptyStageText}>No speakers yet</Text>
            </View>
          ) : (
            speakers.map((p) => (
              <SpeakerCard
                key={p.uid}
                participant={p}
                isMe={p.uid === myUid}
                onTap={() => handleSpeakerTap(p)}
              />
            ))
          )}
        </View>

        {/* ── LISTENERS ──────────────────────────────────────────── */}
        {listeners.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              Listeners · {listeners.length}
            </Text>
            <View style={styles.listenersWrap}>
              {listeners.map((p) => (
                <ListenerRow key={p.uid} participant={p} />
              ))}
            </View>
          </>
        )}

        {/* ── HOST REVENUE BADGE ─────────────────────────────────── */}
        {isHost && joined && (
          <View style={styles.revenueCard}>
            <Feather name="trending-up" size={16} color={orbit.success} />
            <Text style={styles.revenueText}>
              Earning credits while you host
            </Text>
            <View style={styles.revenueBadge}>
              <Feather name="zap" size={10} color={orbit.warning} />
              <Text style={styles.revenueBadgeText}>LIVE</Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── BOTTOM CONTROLS ─────────────────────────────────────── */}
      <View
        style={[
          styles.controls,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        {!joined ? (
          <TouchableOpacity
            style={[styles.joinBtn, joining && { opacity: 0.6 }]}
            onPress={handleJoin}
            disabled={joining}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Join room"
          >
            {joining ? (
              <ActivityIndicator color={orbit.white} size="small" />
            ) : (
              <>
                <Feather name="headphones" size={18} color={orbit.white} />
                <Text style={styles.joinBtnText}>
                  {isHost ? "Start Room" : "Join Room"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.controlRow}>
            {/* Mute / unmute — only for host or speakers */}
            {(isHost || myParticipant?.role === "speaker") && (
              <TouchableOpacity
                style={[styles.controlBtn, muted && styles.controlBtnActive]}
                onPress={handleToggleMute}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={muted ? "Unmute" : "Mute"}
              >
                <Feather
                  name={muted ? "mic-off" : "mic"}
                  size={20}
                  color={muted ? orbit.danger : orbit.textPrimary}
                />
              </TouchableOpacity>
            )}

            {/* Raise hand — listeners only */}
            {myParticipant?.role === "listener" && (
              <TouchableOpacity
                style={[styles.controlBtn, handRaised && styles.controlBtnRaisedHand]}
                onPress={handleRaiseHand}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={handRaised ? "Lower hand" : "Raise hand"}
              >
                <Text style={styles.handEmoji}>{handRaised ? "✋" : "🤚"}</Text>
              </TouchableOpacity>
            )}

            {/* Raise-hand queue — host only */}
            {isHost && (
              <TouchableOpacity
                style={[styles.controlBtn, raisedHands.length > 0 && styles.controlBtnBadge]}
                onPress={() => setShowHandQueue(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Raised hands queue"
              >
                <Feather name="list" size={20} color={orbit.textPrimary} />
                {raisedHands.length > 0 && (
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeDotText}>{raisedHands.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Leave */}
            <TouchableOpacity
              style={styles.leaveBtn}
              onPress={handleLeave}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isHost ? "End room" : "Leave room"}
            >
              <Text style={styles.leaveBtnText}>
                {isHost ? "End" : "Leave"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── MODALS ──────────────────────────────────────────────── */}
      <CreditGateModal
        visible={creditGateVisible}
        creditsUsedToday={creditsUsedToday}
        onClose={() => {
          setCreditGateVisible(false);
          router.back();
        }}
      />

      <RaiseHandQueueSheet
        visible={showHandQueue}
        raisedHands={raisedHands}
        onPromote={handlePromoteSpeaker}
        onDismiss={handleDismissHand}
        onClose={() => setShowHandQueue(false)}
      />
    </View>
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
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  headerSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  handQueueBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: orbit.warningSoft,
    marginRight: 4,
  },
  handQueueBtnText: {
    color: orbit.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  headerRule: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
  },

  /* Live pulse */
  pulseWrap: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: orbit.danger,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: orbit.danger,
  },

  /* Body */
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 14,
    marginTop: 8,
  },

  /* Speaker grid */
  speakersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  speakerCard: {
    alignItems: "center",
    width: 80,
  },
  speakerAvatarWrap: {
    position: "relative",
    marginBottom: 6,
  },
  speakerAvatarMuted: {
    opacity: 0.6,
  },
  speakerAudioRing: {
    position: "absolute",
    inset: -3,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: orbit.success,
  },
  hostBadgeWrap: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: orbit.warning,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: orbit.bg,
  },
  speakerName: {
    color: orbit.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 76,
  },
  speakerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  handRaisedEmoji: {
    fontSize: 12,
  },
  emptyStagePlaceholder: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderStyle: "dashed",
    gap: 8,
  },
  emptyStageText: {
    color: orbit.textTertiary,
    fontSize: 13,
  },

  /* Listeners */
  listenersWrap: {
    gap: 8,
    marginBottom: 24,
  },
  listenerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  listenerName: {
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  listenerHandBadge: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Revenue */
  revenueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: orbit.successSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: `rgba(43,182,115,0.2)`,
  },
  revenueText: {
    color: orbit.success,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  revenueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: orbit.warningSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  revenueBadgeText: {
    color: orbit.warning,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  /* Controls */
  controls: {
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    backgroundColor: orbit.bg,
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: orbit.danger,
    shadowColor: orbit.danger,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  joinBtnText: {
    color: orbit.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  controlBtnActive: {
    backgroundColor: orbit.dangerSoft,
    borderColor: orbit.danger,
  },
  controlBtnRaisedHand: {
    backgroundColor: orbit.warningSoft,
    borderColor: orbit.warning,
  },
  controlBtnBadge: {
    borderColor: orbit.accent,
  },
  handEmoji: {
    fontSize: 20,
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: orbit.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: orbit.bg,
  },
  badgeDotText: {
    color: orbit.white,
    fontSize: 9,
    fontWeight: "700",
  },
  leaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: orbit.dangerSoft,
  },
  leaveBtnText: {
    color: orbit.danger,
    fontSize: 14,
    fontWeight: "700",
  },

  /* Ended state */
  endedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  endedTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  endedSub: {
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  endedBackBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  endedBackBtnText: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },

  /* Credit gate modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  creditGateCard: {
    width: "100%",
    backgroundColor: orbit.surface1,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  creditGateIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 15,
    backgroundColor: orbit.warningSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  creditGateTitle: {
    color: orbit.textPrimary,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  creditGateSub: {
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  creditGateBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.surface3,
    marginBottom: 8,
    overflow: "hidden",
  },
  creditGateFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.warning,
  },
  creditGateBarLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 20,
  },
  creditGateBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: orbit.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  creditGateBtnText: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },

  /* Raise-hand sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: orbit.surface1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  sheetSub: {
    color: orbit.textSecond,
    fontSize: 13,
    marginBottom: 16,
  },
  sheetEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  sheetEmptyText: {
    color: orbit.textTertiary,
    fontSize: 14,
  },
  handQueueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
  },
  handQueueName: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  handQueueActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  handPromoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: orbit.accent,
  },
  handPromoteBtnText: {
    color: orbit.white,
    fontSize: 12,
    fontWeight: "700",
  },
  handDismissBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: orbit.surface2,
  },
});

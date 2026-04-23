/**
 * ORBIT — World Tab (index.tsx) — v4 Golden PRD Design
 *
 * Full redesign matching the CROWN HTML (index__10_.html):
 *   • Header: Logo + "ORBIT • City" title + Credits pill + DM button
 *   • City Status Bar: rank badge + animated BLAZING PULSE heat meter
 *   • City Tabs: horizontal scroll with live counts
 *   • City Wars Banner: dark gradient card showing live city competition
 *   • Chat messages with identity tags: [Colony], ✔ verified, ⚡ credits, LOCAL/VISITOR
 *   • Mayor card (pinned announcement)
 *   • Quick actions: BOOST / CHECK-IN / CHALLENGE
 *   • 4-tab bottom nav pill
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Types ─────────────────────────────────────────────────────────── */
type City = { id: string; name: string; liveCount: string };

type MsgTag = {
  colony?: string;
  verified?: boolean;
  credits?: string;
  isLocal?: boolean;
  isVisitor?: boolean;
};

type ChatMsg = {
  id: string;
  user?: string;
  tags?: MsgTag;
  text: string;
  time: string;
  isMine?: boolean;
  reactions?: { emoji: string; count: number }[];
  isMayor?: boolean;
  mayorName?: string;
  isCityWars?: boolean;
};

/* ─── Mock Data ──────────────────────────────────────────────────────── */
const CITIES: City[] = [
  { id: 'all',  name: 'All India',   liveCount: '12,847' },
  { id: 'chd',  name: 'Chandigarh',  liveCount: '2,140'  },
  { id: 'mum',  name: 'Mumbai',      liveCount: '4,890'  },
  { id: 'ldh',  name: 'Ludhiana',    liveCount: '1,230'  },
  { id: 'ddn',  name: 'Dehradun',    liveCount: '850'    },
  { id: 'hyd',  name: 'Hyderabad',   liveCount: '3,100'  },
];

const INITIAL_MSGS: ChatMsg[] = [
  {
    id: 'wars', isCityWars: true,
    text: '', time: '',
  },
  {
    id: '1',
    user: 'Aman_Dhanas',
    tags: { colony: 'Dhanas', verified: true, credits: '1.2k' },
    text: 'Chandigarh Sector 17 mein food festival start ho gaya hai! Kaun kaun aa raha hai? 🥘',
    time: '7:11 AM',
    reactions: [{ emoji: '🔥', count: 94 }, { emoji: '🙌', count: 58 }],
  },
  {
    id: '2', isMine: true,
    tags: { isLocal: true },
    text: 'Main 20 mins mein wahan pahunch raha hoon. Wait karna! 🚀',
    time: '7:13 AM',
  },
  {
    id: 'mayor', isMayor: true, mayorName: 'Rajveer Singh',
    text: "Sector 17 is buzzing tonight! 🌆 Jo sabse zyada active rahega aaj, use 'Golden Citizen' badge milega!",
    time: '7:15 AM',
  },
  {
    id: '3',
    user: 'Rahul_Dev',
    tags: { colony: 'Delhi', isVisitor: true },
    text: 'Hi guys! Main iss weekend Chandigarh ghoomne aa raha hu. Koi badhiya jagah batao?',
    time: '7:22 AM',
  },
  {
    id: '4',
    user: 'Simran_Kaur',
    tags: { colony: 'Sec 22', verified: true },
    text: 'Hello everyone! Koi abhi Elante ke paas hai kya? Traffic kaisa hai wahan?',
    time: '7:24 AM',
  },
  {
    id: '5',
    user: 'Kabir_Singh',
    tags: { colony: 'Mohali', credits: '450' },
    text: 'Haan bilkul! Ek local Sufi band perform karega raat 8:30 baje se. Bahut badiya mahol hone wala hai. 🎸🎤',
    time: '7:33 AM',
    reactions: [{ emoji: '🎶', count: 18 }],
  },
];

/* ─── Sub-components ─────────────────────────────────────────────────── */

/** Animated red pulse dot for heat meter */
function HeatPulse() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  return (
    <Animated.View style={[s.heatDot, { transform: [{ scale }] }]} />
  );
}

/** Blinking dot for live count in city tab */
function BlinkDot() {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.blinkDot, { opacity: op }]} />;
}

/** City War Banner */
function CityWarsBanner() {
  return (
    <View style={s.cwBanner}>
      <View style={s.cwHeader}>
        <Text style={s.cwHeaderText}>🔥 City Wars Live</Text>
        <Text style={s.cwHeaderText}>Ends in 03:14:00</Text>
      </View>
      <View style={s.cwTeams}>
        <Text style={s.cwTeamLeft}>CHANDIGARH</Text>
        <Text style={s.cwVs}>VS</Text>
        <Text style={s.cwTeamRight}>DELHI</Text>
      </View>
      <View style={s.cwBarBg}>
        <View style={[s.cwBarFill, { flex: 55, backgroundColor: '#C8871A' }]} />
        <View style={[s.cwBarFill, { flex: 45, backgroundColor: '#EF4444' }]} />
      </View>
      <View style={s.cwScores}>
        <Text style={s.cwScoreText}>12,450 pts</Text>
        <Text style={s.cwScoreText}>11,200 pts</Text>
      </View>
    </View>
  );
}

/** Identity tags row for a message */
function MetaTags({ user, tags }: { user?: string; tags?: MsgTag }) {
  return (
    <View style={s.metaRow}>
      {user && <Text style={s.metaUser}>{user}</Text>}
      {tags?.colony && (
        <Text style={s.tagColony}>[{tags.colony}]</Text>
      )}
      {tags?.verified && (
        <View style={s.tagVerified}>
          <Text style={s.tagVerifiedText}>✔</Text>
        </View>
      )}
      {tags?.credits && (
        <View style={s.tagCredits}>
          <Text style={s.tagCreditsText}>⚡ {tags.credits}</Text>
        </View>
      )}
      {tags?.isLocal && (
        <View style={s.tagLocal}>
          <Text style={s.tagLocalText}>LOCAL</Text>
        </View>
      )}
      {tags?.isVisitor && (
        <View style={s.tagVisitor}>
          <Text style={s.tagVisitorText}>VISITOR</Text>
        </View>
      )}
    </View>
  );
}

/** Mayor pinned card */
function MayorCard({ msg }: { msg: ChatMsg }) {
  return (
    <View style={s.mayorCard}>
      <View style={s.mayorHead}>
        <View style={s.mayorAv}>
          <Text style={s.mayorAvText}>{msg.mayorName?.[0] ?? 'M'}</Text>
        </View>
        <Text style={s.mayorName}>{msg.mayorName}</Text>
        <View style={s.mayorBadge}>
          <Text style={s.mayorBadgeText}>MAYOR</Text>
        </View>
      </View>
      <Text style={s.mayorText}>{msg.text}</Text>
    </View>
  );
}

/** Regular chat bubble */
function Bubble({ msg }: { msg: ChatMsg }) {
  if (msg.isCityWars) return <CityWarsBanner />;
  if (msg.isMayor) return <MayorCard msg={msg} />;

  return (
    <View style={[s.msgWrap, msg.isMine && s.msgWrapRight]}>
      <MetaTags user={msg.isMine ? undefined : msg.user} tags={msg.tags} />
      <View style={[s.bubble, msg.isMine ? s.bubbleRight : s.bubbleLeft]}>
        <Text style={[s.bubbleText, msg.isMine && s.bubbleTextRight]}>
          {msg.text}
        </Text>
        <View style={s.msgInfo}>
          <Text style={[s.msgTime, msg.isMine && s.msgTimeRight]}>
            {msg.time}
          </Text>
          {msg.isMine && <Text style={s.ticks}>✓✓</Text>}
        </View>
      </View>
      {msg.reactions && msg.reactions.length > 0 && (
        <View style={s.reactRow}>
          {msg.reactions.map((r, i) => (
            <TouchableOpacity key={i} style={s.reactPill} activeOpacity={0.7}>
              <Text style={s.reactText}>{r.emoji} {r.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────── */
export default function WorldScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]);
  const [msgs, setMsgs] = useState<ChatMsg[]>(INITIAL_MSGS);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const credits = user?.credits ?? 542;

  const nowStr = () => {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' + m : m} ${ap}`;
  };

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    setMsgs(prev => [...prev, {
      id: Date.now().toString(),
      isMine: true,
      tags: { isLocal: true },
      text,
      time: nowStr(),
    }]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const padBottom = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>

        {/* Top row: logo + title + actions */}
        <View style={s.headerTop}>
          <View style={s.logoRow}>
            <View style={s.logoIcon}>
              <Feather name="globe" size={18} color="#FFF" />
            </View>
            <View>
              <Text style={s.appTitle}>
                ORBIT{'  '}
                <Text style={s.cityTag}>• {selectedCity.name}</Text>
              </Text>
            </View>
          </View>
          <View style={s.headerActions}>
            <View style={s.coinPill}>
              <View style={s.coinCircle}><Text style={s.coinRs}>₹</Text></View>
              <Text style={s.coinText}>{credits}</Text>
            </View>
            <TouchableOpacity
              style={s.dmBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/dm/inbox' as never)}
            >
              <Feather name="message-circle" size={26} color="#C8871A" />
              <View style={s.dmBadge}><Text style={s.dmBadgeText}>5</Text></View>
            </TouchableOpacity>
          </View>
        </View>

        {/* City Rank + Heat Meter */}
        <View style={s.cityStatusBar}>
          <Text style={s.cityRank}>🏆 #2 Most Active Today</Text>
          <View style={s.heatMeter}>
            <HeatPulse />
            <Text style={s.heatText}>BLAZING PULSE</Text>
          </View>
        </View>

        {/* City tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.cityScroll}
          contentContainerStyle={s.cityScrollContent}
        >
          {CITIES.map(city => (
            <TouchableOpacity
              key={city.id}
              style={[s.cityBtn, selectedCity.id === city.id && s.cityBtnActive]}
              onPress={() => setSelectedCity(city)}
              activeOpacity={0.75}
            >
              <Text style={[s.cityBtnText, selectedCity.id === city.id && s.cityBtnTextActive]}>
                {city.name}
              </Text>
              {selectedCity.id === city.id && (
                <View style={s.livePill}>
                  <BlinkDot />
                  <Text style={s.livePillText}>{city.liveCount} Live</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── CHAT ── */}
      <ScrollView
        ref={scrollRef}
        style={s.chat}
        contentContainerStyle={[s.chatContent, { paddingBottom: padBottom }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {msgs.map(msg => <Bubble key={msg.id} msg={msg} />)}
      </ScrollView>

      {/* ── INPUT AREA ── */}
      <View style={[s.inputArea, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.quickBtns}>
          <TouchableOpacity style={s.qb} activeOpacity={0.75}>
            <Feather name="zap" size={11} color="#C8871A" />
            <Text style={s.qbText}>BOOST</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qb} activeOpacity={0.75}>
            <Feather name="map-pin" size={11} color="#2E7D32" />
            <Text style={s.qbText}>CHECK-IN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qb} activeOpacity={0.75}>
            <Feather name="target" size={11} color="#C0392B" />
            <Text style={s.qbText}>CHALLENGE</Text>
          </TouchableOpacity>
        </View>
        <View style={s.inputBox}>
          <TouchableOpacity style={s.iconBtn}>
            <Feather name="image" size={18} color="#B09880" />
          </TouchableOpacity>
          <TextInput
            style={s.txtIn}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Say something to the crowd…"
            placeholderTextColor="#C4AC96"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={s.iconBtn}>
            <Feather name="smile" size={18} color="#B09880" />
          </TouchableOpacity>
          <TouchableOpacity style={s.sendBtn} onPress={sendMessage}>
            <Feather name="send" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const GOLD = '#C8871A';
const BG   = '#FDF8F2';
const WHITE = '#FFFFFF';

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  /* Header */
  header: { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: '#E8D9C8', zIndex: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  appTitle: { fontSize: 22, fontWeight: '800', color: '#1A1208', letterSpacing: -0.2 },
  cityTag: { fontSize: 13, fontWeight: '600', color: '#8B6D4A' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF8ED', borderWidth: 1, borderColor: '#E8C97A', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
  coinCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  coinRs: { fontSize: 10, fontWeight: '800', color: WHITE },
  coinText: { fontSize: 13, fontWeight: '700', color: '#A0620A' },
  dmBtn: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  dmBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#A0620A', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: WHITE, paddingHorizontal: 3 },
  dmBadgeText: { fontSize: 10, fontWeight: '800', color: WHITE },

  /* City Status Bar */
  cityStatusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  cityRank: { fontSize: 11, fontWeight: '800', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  heatMeter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heatDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  heatText: { fontSize: 11, fontWeight: '800', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* City Tabs */
  cityScroll: { borderTopWidth: 1, borderTopColor: '#E8D9C8', borderStyle: 'dashed' },
  cityScrollContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  cityBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E8D9C8', backgroundColor: WHITE, gap: 6 },
  cityBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  cityBtnText: { fontSize: 13, fontWeight: '600', color: '#8B6D4A' },
  cityBtnTextActive: { color: WHITE },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  livePillText: { fontSize: 11, fontWeight: '700', color: WHITE },
  blinkDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: WHITE },

  /* Chat */
  chat: { flex: 1, backgroundColor: BG },
  chatContent: { padding: 14, gap: 16 },

  /* City Wars Banner */
  cwBanner: { backgroundColor: '#1A1208', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cwHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cwHeaderText: { fontSize: 10, fontWeight: '800', color: '#C4AC96', textTransform: 'uppercase' },
  cwTeams: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cwTeamLeft: { fontSize: 13, fontWeight: '800', color: '#F59E0B' },
  cwVs: { fontSize: 10, fontWeight: '700', color: '#8B6D4A' },
  cwTeamRight: { fontSize: 13, fontWeight: '800', color: '#EF4444' },
  cwBarBg: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  cwBarFill: { height: 6 },
  cwScores: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  cwScoreText: { fontSize: 9, fontWeight: '700', color: '#E8D9C8' },

  /* Message meta tags */
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4, paddingHorizontal: 4 },
  metaUser: { fontSize: 11, fontWeight: '600', color: '#B09880' },
  tagColony: { fontSize: 11, fontWeight: '700', color: '#8B6D4A' },
  tagVerified: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#4F8FFF', alignItems: 'center', justifyContent: 'center' },
  tagVerifiedText: { fontSize: 7, color: WHITE, fontWeight: '800' },
  tagCredits: { backgroundColor: '#FFF8ED', borderWidth: 1, borderColor: '#E8C97A', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  tagCreditsText: { fontSize: 9, fontWeight: '700', color: '#A0620A' },
  tagLocal: { backgroundColor: '#E8F5E9', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tagLocalText: { fontSize: 8, fontWeight: '800', color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.5 },
  tagVisitor: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tagVisitorText: { fontSize: 8, fontWeight: '800', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Bubbles */
  msgWrap: { maxWidth: '85%', alignSelf: 'flex-start', alignItems: 'flex-start' },
  msgWrapRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { padding: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: '#EDE0CF', backgroundColor: WHITE },
  bubbleLeft: { borderTopLeftRadius: 4 },
  bubbleRight: { borderTopRightRadius: 4, backgroundColor: GOLD, borderColor: 'transparent' },
  bubbleText: { fontSize: 13.5, lineHeight: 20, color: '#2A1F12' },
  bubbleTextRight: { color: WHITE },
  msgInfo: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 3, opacity: 0.75 },
  msgTime: { fontSize: 9.5, color: '#8B6D4A' },
  msgTimeRight: { color: 'rgba(255,255,255,0.9)' },
  ticks: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '700', letterSpacing: -2 },
  reactRow: { flexDirection: 'row', gap: 5, marginTop: 5, paddingHorizontal: 4 },
  reactPill: { backgroundColor: WHITE, borderWidth: 1, borderColor: '#EDE0CF', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8 },
  reactText: { fontSize: 11, color: '#8B6D4A' },

  /* Mayor */
  mayorCard: { backgroundColor: '#FFFBF5', borderWidth: 1.5, borderColor: '#E8C97A', borderRadius: 16, padding: 14, maxWidth: '90%', alignSelf: 'flex-start' },
  mayorHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  mayorAv: { width: 30, height: 30, borderRadius: 10, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  mayorAvText: { fontSize: 12, fontWeight: '800', color: WHITE },
  mayorName: { fontSize: 13, fontWeight: '700', color: '#A0620A' },
  mayorBadge: { backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#E8C97A', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  mayorBadgeText: { fontSize: 9, fontWeight: '800', color: '#A0620A', textTransform: 'uppercase', letterSpacing: 0.5 },
  mayorText: { fontSize: 13, color: '#2A1F12', lineHeight: 20 },

  /* Input */
  inputArea: { backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: '#E8D9C8', paddingHorizontal: 12, paddingTop: 8 },
  quickBtns: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  qb: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#E8D9C8', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10 },
  qbText: { fontSize: 11, fontWeight: '700', color: '#8B6D4A' },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#E8D9C8', borderRadius: 24, paddingVertical: 6, paddingLeft: 8, paddingRight: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txtIn: { flex: 1, fontSize: 13, color: '#2A1F12', paddingVertical: 0 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
});

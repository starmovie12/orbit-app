/**
 * ORBIT — Rooms Tab (v3 Golden Edition)
 *
 * Complete redesign matching the CROWN HTML design:
 *   • White + Golden premium theme (#FDF8F2 bg, #C8871A gold accent)
 *   • City tabs (horizontal scroll) at the top
 *   • Group chat message feed  
 *   • Input bar with BOOST / CHECK-IN / CHALLENGE quick actions
 *   • Mayor card (pinned announcement)
 *   • DM icon in header navigates to DM list
 *
 * Data:
 *   • Live Firestore rooms subscription for city selection
 *   • Mock messages for display (real-time in Batch 2)
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type City = {
  id: string;
  name: string;
  liveCount: string;
};

type ChatMsg = {
  id: string;
  user: string;
  text: string;
  time: string;
  isMine?: boolean;
  reactions?: { emoji: string; count: number }[];
  isMayor?: boolean;
  mayorName?: string;
};

/* ─────────────────────────────────────────────────────────────────────
   Mock Data
───────────────────────────────────────────────────────────────────── */

const CITIES: City[] = [
  { id: 'all', name: 'All India', liveCount: '12,847' },
  { id: 'chd', name: 'Chandigarh', liveCount: '2,140' },
  { id: 'mum', name: 'Mumbai', liveCount: '4,890' },
  { id: 'ldh', name: 'Ludhiana', liveCount: '1,230' },
  { id: 'ddn', name: 'Dehradun', liveCount: '850' },
  { id: 'hyd', name: 'Hyderabad', liveCount: '3,100' },
];

const INITIAL_MESSAGES: ChatMsg[] = [
  {
    id: '1', user: 'Aman_Dhanas', time: '7:11 AM',
    text: 'Chandigarh Sector 17 mein food festival start ho gaya hai! Kaun kaun aa raha hai? 🥘',
    reactions: [{ emoji: '🔥', count: 94 }, { emoji: '🙌', count: 58 }],
  },
  {
    id: '2', user: 'You', time: '7:13 AM', isMine: true,
    text: 'Main 20 mins mein wahan pahunch raha hoon. Wait karna! 🚀',
  },
  {
    id: 'mayor', user: 'Rajveer Singh', time: '7:15 AM',
    isMayor: true, mayorName: 'Rajveer Singh',
    text: "Sector 17 is buzzing tonight! 🌆 Jo sabse zyada active rahega aaj, use 'Golden Citizen' badge milega!",
  },
  {
    id: '3', user: 'Priya_CHD', time: '7:19 AM',
    text: 'Yaar main toh already wahan hoon! Momos ki line bahut badi hai 😄',
    reactions: [{ emoji: '😂', count: 42 }, { emoji: '❤️', count: 31 }],
  },
  {
    id: '4', user: 'Rahul_Dev', time: '7:22 AM', text: 'Hi guys!',
  },
  {
    id: '5', user: 'Simran_Kaur', time: '7:24 AM',
    text: 'Hello everyone! Koi abhi Elante ke paas hai kya?',
  },
  {
    id: '6', user: 'Vikram_22', time: '7:26 AM',
    text: 'Haan Simran, main yahan Industrial Area wale red light pe fasa hu. Traffic bahut zyaada hai aaj. 🚦',
  },
  {
    id: '7', user: 'You', time: '7:28 AM', isMine: true,
    text: 'Traffic toh hoga hi bhai aaj weekend hai upar se weather itna acha ho rakha hai 😅',
  },
  {
    id: '8', user: 'Neha_Sharma', time: '7:31 AM',
    text: 'Kya aaj Sector 17 plaza mein koi live music band aa raha hai kya perform karne?',
  },
  {
    id: '9', user: 'Kabir_Singh', time: '7:33 AM',
    text: 'Haan bilkul! Ek local Sufi band perform karega raat 8:30 baje se. Bahut badiya mahol hone wala hai. 🎸🎤',
    reactions: [{ emoji: '🎶', count: 18 }],
  },
  {
    id: '10', user: 'Anjali_V', time: '7:35 AM',
    text: "Awesome! Can't wait. Main apne friends ke sath bas nikalne hi wali hu.",
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────── */

function BlinkDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.blinkDot, { opacity }]} />;
}

function CityTab({
  city, active, onPress,
}: { city: City; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.cityBtn, active && styles.cityBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.cityBtnText, active && styles.cityBtnTextActive]}>
        {city.name}
      </Text>
      {active && (
        <View style={styles.livePill}>
          <BlinkDot />
          <Text style={styles.livePillText}>{city.liveCount} Live</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MayorCard({ msg }: { msg: ChatMsg }) {
  return (
    <View style={styles.mayorCard}>
      <View style={styles.mayorHead}>
        <View style={styles.mayorAvatar}>
          <Text style={styles.mayorAvatarText}>
            {msg.mayorName?.[0] ?? 'M'}
          </Text>
        </View>
        <Text style={styles.mayorName}>{msg.mayorName}</Text>
        <View style={styles.mayorBadge}>
          <Text style={styles.mayorBadgeText}>MAYOR</Text>
        </View>
      </View>
      <Text style={styles.mayorText}>{msg.text}</Text>
    </View>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  if (msg.isMayor) return <MayorCard msg={msg} />;

  return (
    <View style={[styles.msgWrap, msg.isMine && styles.msgWrapRight]}>
      {!msg.isMine && (
        <Text style={styles.msgUser}>{msg.user}</Text>
      )}
      {msg.isMine && (
        <View style={styles.myLabel}>
          <Text style={styles.myLabelText}>Local</Text>
        </View>
      )}
      <View style={[styles.bubble, msg.isMine ? styles.bubbleRight : styles.bubbleLeft]}>
        <Text style={[styles.bubbleText, msg.isMine && styles.bubbleTextRight]}>
          {msg.text}
        </Text>
        <View style={styles.msgMeta}>
          <Text style={[styles.msgTime, msg.isMine && styles.msgTimeRight]}>
            {msg.time}
          </Text>
          {msg.isMine && (
            <Text style={styles.ticks}>✓✓</Text>
          )}
        </View>
      </View>
      {msg.reactions && msg.reactions.length > 0 && (
        <View style={styles.reactRow}>
          {msg.reactions.map((r, i) => (
            <TouchableOpacity key={i} style={styles.reactPill} activeOpacity={0.7}>
              <Text style={styles.reactText}>{r.emoji} {r.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [selectedCity, setSelectedCity] = useState('all');
  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const credits = user?.credits ?? 542;
  const dmUnread = 5;

  const now = () => {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
  };

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    const msg: ChatMsg = {
      id: Date.now().toString(),
      user: 'You',
      text,
      time: now(),
      isMine: true,
    };
    setMessages(prev => [...prev, msg]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const padBottom = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Feather name="globe" size={18} color="#FFF" />
            </View>
            <Text style={styles.appTitle}>ORBIT</Text>
          </View>

          <View style={styles.headerActions}>
            {/* Credits Pill */}
            <View style={styles.creditPill}>
              <View style={styles.creditCoin}>
                <Text style={styles.creditCoinText}>₹</Text>
              </View>
              <Text style={styles.creditText}>{credits}</Text>
            </View>

            {/* DM Button */}
            <TouchableOpacity
              style={styles.dmBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/dm/inbox' as never)}
              accessibilityLabel="Direct Messages"
            >
              <Feather name="message-circle" size={26} color="#C8871A" />
              {dmUnread > 0 && (
                <View style={styles.dmBadge}>
                  <Text style={styles.dmBadgeText}>{dmUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CITY TABS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cityScroll}
          contentContainerStyle={styles.cityScrollContent}
        >
          {CITIES.map(city => (
            <CityTab
              key={city.id}
              city={city}
              active={selectedCity === city.id}
              onPress={() => setSelectedCity(city.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── CHAT MESSAGES ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={[styles.chatContent, { paddingBottom: padBottom }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </ScrollView>

      {/* ── INPUT AREA ── */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
        {/* Quick Action Buttons */}
        <View style={styles.quickBtns}>
          <TouchableOpacity style={styles.quickBtn} activeOpacity={0.75}>
            <Feather name="zap" size={11} color="#C8871A" />
            <Text style={styles.quickBtnText}>BOOST</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} activeOpacity={0.75}>
            <Feather name="map-pin" size={11} color="#2E7D32" />
            <Text style={styles.quickBtnText}>CHECK-IN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} activeOpacity={0.75}>
            <Feather name="target" size={11} color="#C0392B" />
            <Text style={styles.quickBtnText}>CHALLENGE</Text>
          </TouchableOpacity>
        </View>

        {/* Text Input Row */}
        <View style={styles.inputBox}>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="image" size={18} color="#B09880" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Say something to the crowd…"
            placeholderTextColor="#C4AC96"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="smile" size={18} color="#B09880" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Feather name="send" size={15} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDF8F2',
  },

  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D9C8',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#C8871A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1208',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8ED',
    borderWidth: 1,
    borderColor: '#E8C97A',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  creditCoin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C8871A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditCoinText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  creditText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A0620A',
  },
  dmBtn: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#A0620A',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 3,
  },
  dmBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },

  /* City Tabs */
  cityScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8D9C8',
  },
  cityScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  cityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8D9C8',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  cityBtnActive: {
    backgroundColor: '#C8871A',
    borderColor: '#C8871A',
  },
  cityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B6D4A',
    whiteSpace: 'nowrap',
  },
  cityBtnTextActive: {
    color: '#FFFFFF',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  livePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  blinkDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF',
  },

  /* Chat */
  chat: {
    flex: 1,
    backgroundColor: '#FDF8F2',
  },
  chatContent: {
    padding: 14,
    gap: 14,
  },

  /* Message Bubble */
  msgWrap: {
    maxWidth: '82%',
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  msgWrapRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgUser: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B09880',
    marginBottom: 3,
    paddingHorizontal: 4,
  },
  myLabel: {
    backgroundColor: '#E8F5E9',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  myLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2E7D32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE0CF',
    backgroundColor: '#FFFFFF',
  },
  bubbleLeft: {
    borderTopLeftRadius: 4,
  },
  bubbleRight: {
    borderTopRightRadius: 4,
    backgroundColor: '#C8871A',
    borderColor: 'transparent',
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#2A1F12',
  },
  bubbleTextRight: {
    color: '#FFFFFF',
  },
  msgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
    opacity: 0.75,
  },
  msgTime: {
    fontSize: 9.5,
    color: '#8B6D4A',
  },
  msgTimeRight: {
    color: 'rgba(255,255,255,0.9)',
  },
  ticks: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: -2,
  },
  reactRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 4,
  },
  reactPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE0CF',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  reactText: {
    fontSize: 11,
    color: '#8B6D4A',
  },

  /* Mayor Card */
  mayorCard: {
    backgroundColor: '#FFFBF5',
    borderWidth: 1.5,
    borderColor: '#E8C97A',
    borderRadius: 16,
    padding: 14,
    maxWidth: '90%',
    alignSelf: 'flex-start',
  },
  mayorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  mayorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#C8871A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mayorAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  mayorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A0620A',
  },
  mayorBadge: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#E8C97A',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  mayorBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A0620A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mayorText: {
    fontSize: 13,
    color: '#2A1F12',
    lineHeight: 20,
  },

  /* Input Area */
  inputArea: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8D9C8',
    backgroundColor: '#FFFFFF',
  },
  quickBtns: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#E8D9C8',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B6D4A',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8D9C8',
    borderRadius: 24,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#2A1F12',
    paddingVertical: 0,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#C8871A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

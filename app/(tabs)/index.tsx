/**
 * CROWD WORLD — Home Screen (index.tsx) — Blueprint v5.0 BAAP EDITION
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * FIXES APPLIED (v5.1-patch):
 *   FIX 1 — BUG ROOT CAUSE: contentContainerStyle `paddingTop` was set to
 *            `chatPaddingBottom` (~178px). For an inverted FlatList, paddingTop
 *            maps to the VISUAL BOTTOM (first thing rendered on screen open).
 *            This created a 178px blank zone at the bottom → messages appeared
 *            above the visible area. Fixed: paddingTop → 8px.
 *   FIX 2 — isLoading initialised to `false`. INITIAL_MSGS is synchronous mock
 *            data — the 1200ms skeleton timeout blocked the FlatList for no reason.
 *   FIX 3 — Removed getItemLayout. Messages have variable heights (40px–180px).
 *            The hardcoded `length: 80` caused wrong item offsets and skipped
 *            renders for tall items (mayor card, AI message with reactions, etc.)
 *   FIX 4 — KAV behavior: `"height"` on Android shrinks KAV by full keyboard
 *            height. With the inputArea's paddingBottom (~110px) included, the
 *            FlatList collapsed to 0 height when keyboard opened. Fixed:
 *            behavior is now `"padding"` on iOS only, `undefined` on Android.
 *            keyboardVerticalOffset accounts for the sticky header stack height.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Chat-First Landing · Hyper-Local Sector Chat
 *
 * Layout Stack (top → bottom):
 *   [1] Status Bar (system)
 *   [2] Header — CROWD Wordmark + City Pill + Sector Pill
 *   [3] Offline Banner (conditional)
 *   [4] Online Count Strip (pulsing dot · Heat Score · Trust Anchor)
 *   [5] Chat Body — Inverted FlatList (6 message variants)
 *   [6] New Messages Floating Chip (conditional)
 *   [7] Sticky Input Area — cream field + send button
 *   [8] Glass Island Nav (dark pill · z-950)
 *
 * Rules enforced:
 *   Rule 03 — Profile avatar ONLY in Glass Island Profile tab
 *   Rule 04 — Chat Input flush above Glass Island · zero gap · zero overlap
 *   LAW 13  — Floating Glass Island hides on scroll-up · hides on keyboard open
 *   § 5.A   — CROWN wordmark Home Screen ONLY · pure typography · no animation
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

import { colors, palette, spacing, radii, zIndex } from '@/constants/colors';
import { durations, easings, useReducedMotion } from '@/constants/animations';
import PullIndicator from '@/components/atoms/PullIndicator';
import ScrollFAB from '@/components/atoms/ScrollFAB';
import SkeletonBubble from '@/components/atoms/SkeletonBubble';

/* ─────────────────────────────────────────────────────────────────────────
   FEATHER ICON WRAPPERS
   ───────────────────────────────────────────────────────────────────────── */
const HomeIcon = ({ size, color }: { size: number; color: string; strokeWidth?: number }) => (
  <Feather name="home" size={size} color={color} />
);
const Compass = ({ size, color }: { size: number; color: string; strokeWidth?: number }) => (
  <Feather name="compass" size={size} color={color} />
);
const CreditCard = ({ size, color }: { size: number; color: string; strokeWidth?: number }) => (
  <Feather name="credit-card" size={size} color={color} />
);
const User = ({ size, color }: { size: number; color: string; strokeWidth?: number }) => (
  <Feather name="user" size={size} color={color} />
);
const SendIcon = ({ size, color }: { size: number; color: string; strokeWidth?: number }) => (
  <Feather name="send" size={size} color={color} />
);
const Check = ({ size, color }: { size: number; color: string; strokeWidth?: number }) => (
  <Feather name="check" size={size} color={color} />
);

/* ─────────────────────────────────────────────────────────────────────────
   DESIGN TOKEN BRIDGE
   ───────────────────────────────────────────────────────────────────────── */
const TOKEN = {
  /* ── Backgrounds ── */
  bgSurface:          colors.bg.surface,
  bgCard:             colors.bg.card,
  bgCardHover:        colors.bg.cardHover,
  bgCardPressed:      colors.bg.cardPressed,
  bgSubtle:           colors.bg.subtle,        // cream[50] #FFF9EC — warm ivory screen bg
  bgApp:              colors.bg.subtle,         // FIX: warm ivory instead of pure white

  /* ── Foregrounds ── */
  fgPrimary:          colors.fg.primary,
  fgSecondary:        colors.fg.secondary,
  fgTertiary:         colors.fg.tertiary,
  fgBrand:            colors.fg.brand,
  fgBrandHover:       colors.fg.brandHover,
  fgBrandSubtle:      colors.fg.brandSubtle,
  fgBrandText:        colors.fg.brandText,
  fgOnBrand:          colors.fg.onBrand,
  fgCelebrate:        colors.fg.celebrate,
  fgWarning:          colors.fg.warning,
  fgSuccess:          colors.fg.success,
  fgError:            colors.fg.error,
  fgMuted:            colors.fg.disabled,
  errorRed:           colors.fg.error,

  /* ── Borders ── */
  borderHair:         colors.border.default,
  borderPill:         colors.border.default,
  borderSector:       colors.fg.warning,
  borderInputIdle:    colors.border.inputIdle,
  borderInputFocus:   colors.border.inputFocus,
  borderCardEmphasis: colors.border.cardEmphasis,

  /* ── Glass Island (LAW 13) ── */
  glassIslandBg:      colors.bg.glass,
  glassIslandActive:  colors.fg.brand,
  glassIslandInactive:'rgba(255,255,255,0.58)' as const,  // FIX: 58% per spec (was 70%)
  glassIslandShadow:  palette.glass.shadow,

  /* ── Semantic ── */
  offlineBg:          colors.bg.inverse,
  scrim:              colors.bg.scrim,
} as const;

/* ─────────────────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────────────────── */
type MsgStatus = 'sending' | 'sent' | 'read' | 'failed';
type MsgVariant = 'own' | 'other' | 'ai' | 'system' | 'mayor' | 'date_separator';

interface Reaction { emoji: string; count: number; }

interface ChatMsg {
  id: string;
  variant: MsgVariant;
  text: string;
  time: string;
  displayName?: string;
  colonyTag?: string;
  isVerified?: boolean;
  isFounder?: boolean;
  isMayor?: boolean;
  reactions?: Reaction[];
  status?: MsgStatus;
  isAI?: boolean;
  mayorName?: string;
}

interface City   { id: string; name: string; }
interface Sector { id: string; name: string; }

/* ─────────────────────────────────────────────────────────────────────────
   MOCK DATA
   ───────────────────────────────────────────────────────────────────────── */
const CITIES: City[] = [
  { id: 'chd', name: 'Chandigarh' },
  { id: 'mum', name: 'Mumbai' },
  { id: 'ldh', name: 'Ludhiana' },
  { id: 'ddn', name: 'Dehradun' },
  { id: 'hyd', name: 'Hyderabad' },
];

const SECTORS: Sector[] = [
  { id: 'sec17', name: 'Sector 17' },
  { id: 'sec22', name: 'Sector 22' },
  { id: 'sec35', name: 'Sector 35' },
  { id: 'dhanas', name: 'Dhanas' },
  { id: 'mohali', name: 'Mohali' },
];

/* Sorted ascending by time — FlatList inverted handles display order */
const INITIAL_MSGS: ChatMsg[] = [
  { id: 'date_1', variant: 'date_separator', text: 'Aaj', time: '' },
  { id: 'sys_1', variant: 'system', text: 'Sector 17 abhi Heat 67 pe hai 🔥', time: '7:00 AM' },
  {
    id: 'mayor_pin',
    variant: 'mayor',
    text: "Sector 17 is buzzing tonight! 🌆 Jo sabse zyada active rahega aaj, use 'Golden Citizen' badge milega! Come join the energy.",
    time: '7:05 AM',
    mayorName: 'Rajveer Singh',
  },
  {
    id: 'ai_1',
    variant: 'ai',
    displayName: 'Aria',
    colonyTag: 'Sector 17',
    text: 'Namaste! Main Aria hoon, Sector 17 ki AI companion. Kuch jaanna hai ya bas timepass? Dono theek hai 😄',
    time: '7:08 AM',
    isAI: true,
  },
  {
    id: 'msg_1',
    variant: 'other',
    displayName: 'Aman_Dhanas',
    colonyTag: 'Dhanas',
    isVerified: true,
    text: 'Chandigarh Sector 17 mein food festival start ho gaya hai! Kaun kaun aa raha hai? 🥘',
    time: '7:11 AM',
    reactions: [{ emoji: '🔥', count: 94 }, { emoji: '🙌', count: 58 }],
  },
  {
    id: 'msg_2',
    variant: 'own',
    text: 'Main 20 mins mein wahan pahunch raha hoon. Wait karna! 🚀',
    time: '7:13 AM',
    status: 'read',
  },
  {
    id: 'msg_3',
    variant: 'other',
    displayName: 'Rahul_Dev',
    colonyTag: 'Delhi',
    text: 'Hi guys! Main iss weekend Chandigarh ghoomne aa raha hu. Koi badhiya jagah batao?',
    time: '7:22 AM',
  },
  {
    id: 'msg_4',
    variant: 'other',
    displayName: 'Simran_Kaur',
    colonyTag: 'Sec 22',
    isVerified: true,
    text: 'Hello everyone! Koi abhi Elante ke paas hai kya? Traffic kaisa hai wahan?',
    time: '7:24 AM',
  },
  {
    id: 'msg_5',
    variant: 'other',
    displayName: 'Kabir_Singh',
    colonyTag: 'Mohali',
    isFounder: true,
    text: 'Haan bilkul! Ek local Sufi band perform karega raat 8:30 baje se. Bahut badiya mahol hone wala hai. 🎸🎤',
    time: '7:33 AM',
    reactions: [{ emoji: '🎶', count: 18 }],
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   ANIMATED HELPERS
   ───────────────────────────────────────────────────────────────────────── */
function OnlinePulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: durations.ripple, easing: easings.easeInOut, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: durations.ripple, easing: easings.easeInOut, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.onlineDot, { opacity }]} accessibilityElementsHidden />;
}

/* ─────────────────────────────────────────────────────────────────────────
   HEADER — Two-Row Architecture
   ───────────────────────────────────────────────────────────────────────── */
interface HeaderProps {
  city: City; sector: Sector;
  onCityPress: () => void; onSectorPress: () => void;
  onNotificationsPress: () => void; onProfilePress: () => void;
  paddingTop: number; notificationCount?: number;
}

function HomeHeader({ city, sector, onCityPress, onSectorPress, onNotificationsPress, onProfilePress, paddingTop, notificationCount = 0 }: HeaderProps) {
  return (
    <View style={[styles.header, { paddingTop }]} testID="home-header">
      {/* ROW 1 — Brand Row */}
      <View style={styles.headerRow1}>
        <Text
          style={styles.crownWordmark}
          accessibilityRole="header"
          accessibilityLabel="CROWD WORLD"
          testID="home-header-brand-logo"
        >
          CROWD
        </Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onNotificationsPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={notificationCount > 0 ? `Notifications · ${notificationCount} unread` : 'Notifications'}
            testID="home-header-notifications"
          >
            <Feather name="bell" size={22} color={TOKEN.fgPrimary} />
            {notificationCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={onProfilePress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            testID="home-header-profile-avatar"
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>A</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ROW 2 — Location Row */}
      <View style={styles.headerRow2}>
        <TouchableOpacity
          style={styles.cityPill} onPress={onCityPress} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel={`Change city. Currently ${city.name}.`}
          testID="home-header-city-pill"
        >
          <Text style={styles.pillIcon}>📍</Text>
          <Text style={styles.pillText} numberOfLines={1}>{city.name}</Text>
          <Feather name="chevron-down" size={12} color={TOKEN.fgSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sectorPill} onPress={onSectorPress} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel={`Change sector. Currently ${sector.name}, ${city.name}.`}
          testID="home-header-sector-pill"
        >
          <Text style={styles.pillText} numberOfLines={1}>{sector.name}</Text>
          <Feather name="chevron-down" size={12} color={TOKEN.fgSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ONLINE COUNT STRIP
   ───────────────────────────────────────────────────────────────────────── */
function OnlineCountStrip({ count, heatScore, showTrustAnchor }: { count: number; heatScore: number; showTrustAnchor: boolean }) {
  const displayCount = count >= 10000 ? `${(count / 1000).toFixed(1)}K` : count.toLocaleString('en-IN');
  return (
    <View style={styles.onlineStrip} testID="home-online-strip">
      <View style={styles.onlineLeft}>
        <OnlinePulseDot />
        <Text style={styles.onlineText} accessibilityLabel={`${displayCount} members online`} accessibilityLiveRegion="polite" testID="home-online-count">
          {displayCount} yahan online
        </Text>
      </View>
      <View style={styles.onlineRight}>
        {showTrustAnchor && (
          <View style={styles.trustChip} testID="home-trust-anchor">
            <Text style={styles.trustChipText} accessibilityLabel="Trusted by over 1 lakh users">👥 1 Lakh+</Text>
          </View>
        )}
        {heatScore >= 30 && (
          <View style={styles.heatPill} testID="home-heat-score">
            <Text style={styles.heatPillText} accessibilityLabel={`Heat Score ${heatScore}`}>🔥 {heatScore}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   OFFLINE BANNER
   ───────────────────────────────────────────────────────────────────────── */
function OfflineBanner({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(-32)).current;
  useEffect(() => {
    Animated.timing(translateY, { toValue: visible ? 0 : -32, duration: visible ? 240 : 200, useNativeDriver: true }).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[styles.offlineBanner, { transform: [{ translateY }] }]} accessibilityLiveRegion="polite" testID="home-offline-banner">
      <Text style={styles.offlineIcon}>📶</Text>
      <Text style={styles.offlineText} numberOfLines={1}>Offline · saved messages dikha rahe hain</Text>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MESSAGE BUBBLE VARIANTS
   ───────────────────────────────────────────────────────────────────────── */
function StatusTick({ status }: { status?: MsgStatus }) {
  if (!status) return null;
  if (status === 'sending') return <Text style={styles.tickText}>⏳</Text>;
  if (status === 'failed')  return <Text style={[styles.tickText, { color: TOKEN.errorRed }]}>⚠️</Text>;
  if (status === 'read')    return <Text style={[styles.tickText, styles.tickRead]}>✓✓</Text>;
  return <Text style={styles.tickText}>✓</Text>;
}

function ReactionsRow({ reactions }: { reactions: Reaction[] }) {
  if (!reactions.length) return null;
  return (
    <View style={styles.reactRow}>
      {reactions.map((r, i) => (
        <TouchableOpacity key={i} style={styles.reactPill} activeOpacity={0.75} accessibilityLabel={`${r.count} ${r.emoji} reactions`}>
          <Text style={styles.reactText}>{r.emoji} {r.count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function OwnBubble({ msg }: { msg: ChatMsg }) {
  return (
    <View style={styles.ownWrap}>
      <View style={styles.ownBubble}>
        <Text style={styles.ownText}>{msg.text}</Text>
        <View style={styles.ownMeta}>
          <Text style={styles.ownTime}>{msg.time}</Text>
          <StatusTick status={msg.status} />
        </View>
      </View>
      {msg.reactions && <ReactionsRow reactions={msg.reactions} />}
    </View>
  );
}

function OtherBubble({ msg }: { msg: ChatMsg }) {
  const router = useRouter();
  const isAI = msg.variant === 'ai';
  const initials = (msg.displayName ?? 'U').charAt(0).toUpperCase();
  return (
    <View style={styles.otherWrap}>
      <TouchableOpacity
        style={[styles.avatar, isAI && styles.avatarAI]}
        activeOpacity={0.8}
        onPress={() => !isAI && router.push(`/user/${msg.id}` as never)}
        accessibilityLabel={isAI ? `AI companion ${msg.displayName}` : `View ${msg.displayName}'s profile`}
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </TouchableOpacity>

      <View style={styles.otherContent}>
        <View style={styles.otherNameRow}>
          <Text style={styles.otherName}>{msg.displayName}</Text>
          {msg.colonyTag   && <View style={styles.colonyTag}><Text style={styles.colonyTagText}>{msg.colonyTag}</Text></View>}
          {msg.isVerified  && <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✔</Text></View>}
          {msg.isFounder   && <View style={styles.founderBadge}><Text style={styles.founderText}>FOUNDER</Text></View>}
          {msg.isMayor     && <View style={styles.mayorInlineBadge}><Text style={styles.mayorInlineText}>👑 Mayor</Text></View>}
          {isAI            && <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>🤖 AI</Text></View>}
        </View>
        <View style={[styles.otherBubble, isAI && styles.otherBubbleAI]}>
          <Text style={styles.otherText}>{msg.text}</Text>
          <Text style={styles.otherTime}>{msg.time}</Text>
        </View>
        {msg.reactions && <ReactionsRow reactions={msg.reactions} />}
      </View>
    </View>
  );
}

function MayorBubble({ msg }: { msg: ChatMsg }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableWithoutFeedback onPress={() => setExpanded(!expanded)}>
      <View style={styles.mayorWrap} accessibilityRole="text" accessibilityLabel={`Mayor announcement: ${msg.text}`}>
        <Text style={styles.mayorCrown}>👑</Text>
        <View style={styles.mayorCard}>
          <Text style={styles.mayorCardHeader}>📌 {msg.mayorName} · Mayor</Text>
          <Text style={styles.mayorCardText} numberOfLines={expanded ? undefined : 4}>{msg.text}</Text>
          <Text style={styles.mayorCardTime}>{msg.time}</Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

function SystemMsg({ msg }: { msg: ChatMsg }) {
  return (
    <View style={styles.systemWrap}>
      <Text style={styles.systemText} accessibilityRole="text" accessibilityLabel={`System: ${msg.text}`}>{msg.text}</Text>
    </View>
  );
}

function DateSeparator({ msg }: { msg: ChatMsg }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={styles.dateSepChip}>
        <Text style={styles.dateSepText} accessibilityRole="header" accessibilityLabel={`Messages from ${msg.text}`}>{msg.text}</Text>
      </View>
    </View>
  );
}

function MessageItem({ item }: { item: ChatMsg }) {
  switch (item.variant) {
    case 'own':           return <OwnBubble msg={item} />;
    case 'other':
    case 'ai':            return <OtherBubble msg={item} />;
    case 'mayor':         return <MayorBubble msg={item} />;
    case 'system':        return <SystemMsg msg={item} />;
    case 'date_separator':return <DateSeparator msg={item} />;
    default:              return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   GLASS ISLAND NAV BAR (LAW 13)
   ───────────────────────────────────────────────────────────────────────── */
const GLASS_TABS: Array<{
  id: 'home' | 'discover' | 'wallet' | 'profile';
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
}> = [
  { id: 'home',     Icon: HomeIcon,   label: 'Home' },
  { id: 'discover', Icon: Compass,    label: 'Discover' },
  { id: 'wallet',   Icon: CreditCard, label: 'Wallet' },
  { id: 'profile',  Icon: User,       label: 'Profile' },
];

function GlassIsland({ activeTab, onTabPress, translateY, bottomInset }: {
  activeTab: 'home' | 'discover' | 'wallet' | 'profile';
  onTabPress: (tab: 'home' | 'discover' | 'wallet' | 'profile') => void;
  translateY: Animated.Value;
  bottomInset: number;
}) {
  return (
    <Animated.View
      style={[styles.glassIslandWrapper, { bottom: bottomInset + 16, transform: [{ translateY }] }]}
      accessibilityRole="tablist"
      testID="home-glass-island"
    >
      <View style={styles.glassIsland}>
        {GLASS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.glassTab}
              onPress={() => onTabPress(tab.id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={isActive ? `${tab.label}, currently selected` : `${tab.label}`}
            >
              {isActive && <View style={styles.glassActiveGlow} />}
              <tab.Icon size={22} strokeWidth={1.5} color={isActive ? TOKEN.glassIslandActive : TOKEN.glassIslandInactive} />
              {isActive && <View style={styles.glassActiveDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CITY / SECTOR PICKER SHEET
   ───────────────────────────────────────────────────────────────────────── */
function PickerSheet({ type, items, selectedId, onSelect, onClose }: {
  type: 'city' | 'sector';
  items: Array<City | Sector>;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const title = type === 'city' ? 'Apna Shehar Chuno' : 'Apna Sector Chuno';
  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableWithoutFeedback>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.sheetRow, selectedId === item.id && styles.sheetRowActive]}
                onPress={() => { onSelect(item.id); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.sheetRowText, selectedId === item.id && styles.sheetRowTextActive]}>{item.name}</Text>
                {selectedId === item.id && <Check size={16} color={TOKEN.fgBrand} strokeWidth={1.5} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN HOME SCREEN
   ───────────────────────────────────────────────────────────────────────── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  /* ── State ── */
  const [selectedCity, setSelectedCity]     = useState<City>(CITIES[0]);
  const [selectedSector, setSelectedSector] = useState<Sector>(SECTORS[0]);
  const [msgs, setMsgs]                     = useState<ChatMsg[]>(INITIAL_MSGS);
  const [inputText, setInputText]           = useState('');
  const [isOffline, setIsOffline]           = useState(false);
  const [onlineCount]                       = useState(234);
  const [heatScore]                         = useState(67);
  const [showTrustAnchor, setShowTrustAnchor] = useState(true);
  const [pickerOpen, setPickerOpen]         = useState<'city' | 'sector' | null>(null);
  const [activeTab, setActiveTab]           = useState<'home' | 'discover' | 'wallet' | 'profile'>('home');
  const [newMsgCount, setNewMsgCount]       = useState(0);
  const [isScrolledUp, setIsScrolledUp]     = useState(false);
  const [isSendDisabled, setIsSendDisabled] = useState(true);
  const [notificationCount]                 = useState(3);

  /**
   * FIX 2: isLoading starts FALSE.
   * INITIAL_MSGS is synchronous mock data — no async fetch needed.
   * The original `isLoading = true` with a 1200ms timeout was blocking the
   * FlatList render for no reason, causing a blank white screen for 1.2s.
   * When you wire up Firestore, set this to `true` and call `setIsLoading(false)`
   * inside your `onSnapshot` callback's first emission.
   */
  const [isLoading, setIsLoading]           = useState(false);
  const [isRefreshing, setIsRefreshing]     = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  /* ── Refs ── */
  const flatListRef      = useRef<FlatList>(null);
  const glassTranslateY  = useRef(new Animated.Value(0)).current;
  const lastScrollY      = useRef(0);

  /* ── Trust anchor auto-hide ── */
  useEffect(() => {
    if (!showTrustAnchor) return;
    const t = setTimeout(() => setShowTrustAnchor(false), 60000);
    return () => clearTimeout(t);
  }, [showTrustAnchor]);

  /* ── Glass Island: hide on keyboard open ── */
  useEffect(() => {
    const hide = () => {
      setIsKeyboardVisible(true);
      Animated.timing(glassTranslateY, { toValue: 120, duration: 250, useNativeDriver: true }).start();
    };
    const show = () => {
      setIsKeyboardVisible(false);
      Animated.timing(glassTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', hide),
      Keyboard.addListener('keyboardDidShow',  hide),
      Keyboard.addListener('keyboardWillHide', show),
      Keyboard.addListener('keyboardDidHide',  show),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  /* ── Helpers ── */
  const nowStr = useCallback(() => {
    const d = new Date();
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' + m : m} ${ap}`;
  }, []);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    const newMsg: ChatMsg = { id: Date.now().toString(), variant: 'own', text, time: nowStr(), status: 'sending' };
    setMsgs((prev) => [...prev, newMsg]);
    setInputText('');
    setIsSendDisabled(true);
    setTimeout(() => {
      setMsgs((prev) => prev.map((m) => m.id === newMsg.id ? { ...m, status: 'sent' as MsgStatus } : m));
    }, 800);
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 80);
  }, [inputText, nowStr]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    setIsSendDisabled(text.trim().length === 0);
  }, []);

  /* ── Scroll handler ── */
  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    lastScrollY.current = y;
    const scrolledUp = y > 100;
    if (scrolledUp !== isScrolledUp) {
      setIsScrolledUp(scrolledUp);
      Animated.spring(glassTranslateY, { toValue: scrolledUp ? 80 : 0, stiffness: 180, damping: 22, useNativeDriver: true }).start();
    }
    if (y > 50 && showTrustAnchor) setShowTrustAnchor(false);
  }, [isScrolledUp, showTrustAnchor]);

  /* ── Pull-to-refresh ── */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise<void>((r) => setTimeout(r, 1000));
    setIsRefreshing(false);
  }, []);

  /* ── Tab navigation ── */
  const handleTabPress = useCallback((tab: 'home' | 'discover' | 'wallet' | 'profile') => {
    if (tab === 'home') { flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); return; }
    setActiveTab(tab);
    const routes: Record<string, string> = { discover: '/(tabs)/discover', wallet: '/credits/index', profile: '/(tabs)/profile' };
    if (routes[tab]) router.push(routes[tab] as never);
  }, [router]);

  /* ── Bottom spacing maths ──
   *
   * Glass Island:
   *   Height = 56px | Bottom = insets.bottom + 16px
   *   → Visual top of glass island = insets.bottom + 16 + 56 = insets.bottom + 72
   *
   * Input area paddingBottom (when keyboard hidden):
   *   Needs to push content above glass island top + 4px gap
   *   = insets.bottom + 72 + 4 = insets.bottom + 76
   *
   * Input area paddingBottom (when keyboard visible):
   *   Glass island is off-screen → only safe area needed
   *   = insets.bottom + 8
   */
  const inputPaddingBottom = isKeyboardVisible
    ? insets.bottom + 8
    : insets.bottom + 76;

  /**
   * FIX 4: KAV behavior.
   *
   * Android — `undefined` (no behavior). The Android system handles window
   * resizing for the keyboard natively (WindowSoftInputMode). Using "height"
   * caused the KAV to shrink by the full keyboard height while the inputArea
   * still carried its large paddingBottom, collapsing the FlatList to ~0px.
   *
   * iOS — `"padding"` adds bottom padding to the KAV equal to the keyboard
   * height, pushing the whole chat + input up. keyboardVerticalOffset = total
   * height of non-KAV content above the KAV (insets.top + header 100px + strip 32px).
   */
  const kavBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const kavOffset   = insets.top + 132; // 56 (row1) + 44 (row2) + 32 (online strip)

  /* ── Inverted data (newest first) ── */
  const invertedMsgs = useMemo(() => [...msgs].reverse(), [msgs]);

  const renderItem    = useCallback(({ item }: { item: ChatMsg }) => <MessageItem item={item} />, []);
  const keyExtractor  = useCallback((item: ChatMsg) => item.id, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* HEADER */}
      <HomeHeader
        city={selectedCity} sector={selectedSector}
        onCityPress={() => setPickerOpen('city')} onSectorPress={() => setPickerOpen('sector')}
        onNotificationsPress={() => router.push('/notifications/index' as never)}
        onProfilePress={() => router.push('/(tabs)/profile' as never)}
        paddingTop={insets.top} notificationCount={notificationCount}
      />

      {/* OFFLINE BANNER */}
      <OfflineBanner visible={isOffline} />

      {/* ONLINE COUNT STRIP */}
      <OnlineCountStrip count={onlineCount} heatScore={heatScore} showTrustAnchor={showTrustAnchor} />

      {/* ── KEYBOARD AVOIDING WRAPPER ── */}
      <KeyboardAvoidingView
        style={styles.chatInputWrapper}
        behavior={kavBehavior}
        keyboardVerticalOffset={kavBehavior ? kavOffset : undefined}
      >
        {/* CHAT BODY */}
        {isLoading ? (
          <View style={styles.chatList} testID="home-chat-skeleton">
            <SkeletonBubble />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={invertedMsgs}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted
            style={styles.chatList}
            /**
             * FIX 1: The ROOT CAUSE of the blank chat.
             *
             * contentContainerStyle previously had `paddingTop: chatPaddingBottom`
             * (~178px). For an inverted FlatList, `paddingTop` in the content container
             * maps to the VISUAL BOTTOM — the area the user sees first on render.
             * The 178px of empty space appeared at the bottom, pushing all messages
             * above the visible area. Users saw only a cream-white void.
             *
             * Fix: use paddingTop: 8 (tiny gap between newest message and list edge)
             * and paddingBottom: 8 (tiny gap at visual top for oldest messages).
             * The input area is a sibling element — it handles its own spacing.
             */
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={10}
            /**
             * FIX 3: getItemLayout REMOVED.
             * It returned a hardcoded `length: 80` for all items. Message bubbles
             * range from ~44px (short system msg) to ~200px (mayor card with reactions).
             * The mismatched lengths caused FlatList to miscalculate scroll offsets,
             * rendering items at wrong positions and skipping off-screen items.
             * Without getItemLayout, FlatList measures items accurately.
             */
            removeClippedSubviews={Platform.OS === 'android'}
            onEndReachedThreshold={0.6}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            refreshControl={
              <PullIndicator refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
          />
        )}

        {/* SCROLL FAB */}
        <ScrollFAB
          visible={isScrolledUp && newMsgCount > 0}
          label={newMsgCount > 0 ? `${newMsgCount} nayi messages` : 'New messages'}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            setNewMsgCount(0);
          }}
        />

        {/* STICKY INPUT AREA — Rule 04: flush above Glass Island */}
        <View style={[styles.inputArea, { paddingBottom: inputPaddingBottom }]} testID="home-input-area">
          <TextInput
            style={[styles.inputField, !isSendDisabled && styles.inputFieldActive]}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder={`${selectedSector.name} mein message likho...`}
            placeholderTextColor={TOKEN.fgSecondary}
            multiline
            maxLength={1000}
            returnKeyType="default"
            keyboardType="default"
            autoCapitalize="sentences"
            autoCorrect
            accessible
            accessibilityLabel={`Type a message in ${selectedSector.name}`}
            testID="home-input-field"
          />

          <TouchableOpacity
            style={[styles.sendBtn, isSendDisabled && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={isSendDisabled}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isSendDisabled ? 'Send button. Type a message first.' : 'Send message'}
            accessibilityState={{ disabled: isSendDisabled }}
            testID="home-send-button"
          >
            <SendIcon size={18} strokeWidth={1.5} color={isSendDisabled ? TOKEN.fgTertiary : TOKEN.fgOnBrand} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* GLASS ISLAND NAV (LAW 13) */}
      <GlassIsland activeTab={activeTab} onTabPress={handleTabPress} translateY={glassTranslateY} bottomInset={insets.bottom} />

      {/* CITY / SECTOR PICKER SHEETS */}
      {pickerOpen === 'city' && (
        <PickerSheet type="city" items={CITIES} selectedId={selectedCity.id}
          onSelect={(id) => { const f = CITIES.find((c) => c.id === id); if (f) setSelectedCity(f); }}
          onClose={() => setPickerOpen(null)}
        />
      )}
      {pickerOpen === 'sector' && (
        <PickerSheet type="sector" items={SECTORS} selectedId={selectedSector.id}
          onSelect={(id) => { const f = SECTORS.find((s) => s.id === id); if (f) setSelectedSector(f); }}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STYLES — v2.1 Premium Color System · Two-Row Header
   ───────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({

  /* ── Root ── */
  screen: {
    flex: 1,
    backgroundColor: TOKEN.bgApp,         // cream[50] #FFF9EC warm ivory (was pure white)
  },

  /* ── Header ── */
  header: {
    backgroundColor: TOKEN.bgSurface,
    zIndex: 900,
    // Shadow instead of border for premium feel
    shadowColor: palette.ink[950],
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  headerRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
  },

  crownWordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKEN.fgBrandSubtle,            // gold[800] #8B6F18 — 6.4:1 on white ✅ AA
    letterSpacing: -0.5,
    lineHeight: 26,
  },

  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6, right: 4,
    minWidth: 16, height: 16,
    borderRadius: 8,
    backgroundColor: TOKEN.fgError,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: TOKEN.bgSurface,
    paddingHorizontal: 2,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  headerAvatarBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TOKEN.bgCard,
    borderWidth: 2, borderColor: TOKEN.fgBrand,
    alignItems: 'center', justifyContent: 'center',
    // Premium shadow on avatar
    shadowColor: TOKEN.fgBrand,
    shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerAvatarText: { fontSize: 14, fontWeight: '700', color: TOKEN.fgSecondary },

  headerRow2: {
    flexDirection: 'row', alignItems: 'center',
    height: 44, paddingHorizontal: 16, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKEN.borderHair,
  },

  cityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: TOKEN.bgCard,
    // Shadow instead of flat border for premium feel
    shadowColor: palette.ink[950],
    shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
    maxWidth: 140,
  },
  pillIcon: { fontSize: 12 },
  pillText: { fontSize: 13, fontWeight: '600', color: TOKEN.fgPrimary, flex: 1 },

  sectorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: TOKEN.bgCard,
    borderWidth: 1.5, borderColor: TOKEN.borderSector,  // amber accent border = active context
    shadowColor: TOKEN.borderSector,
    shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
    maxWidth: 160,
  },

  /* ── Offline Banner ── */
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 32, backgroundColor: TOKEN.offlineBg,
    paddingHorizontal: 16, zIndex: 935,
  },
  offlineIcon: { fontSize: 13 },
  offlineText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF', flex: 1 },

  /* ── Online Count Strip ── */
  onlineStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 32, backgroundColor: TOKEN.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TOKEN.borderHair,
    paddingHorizontal: 16, zIndex: 900,
  },
  onlineLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: TOKEN.fgWarning,
  },
  onlineText: { fontSize: 12, fontWeight: '600', color: TOKEN.fgPrimary },
  onlineRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustChip: {
    height: 24, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: TOKEN.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  trustChipText: { fontSize: 11, fontWeight: '500', color: TOKEN.fgSecondary },
  heatPill: {
    height: 22, paddingHorizontal: 8, borderRadius: 11,
    backgroundColor: TOKEN.fgWarning, alignItems: 'center', justifyContent: 'center',
  },
  heatPillText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  /* ── Chat Container ── */
  chatInputWrapper: { flex: 1 },

  chatList: {
    flex: 1,
    backgroundColor: TOKEN.bgApp,          // warm ivory matches screen bg
  },

  /**
   * FIX 1 (styles): chatContent no longer takes dynamic paddingTop.
   *
   * Old: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 }
   *       + inline { paddingTop: ~178px } ← THIS was creating the blank zone
   *
   * New: static 8px padding top and bottom. Input area is a sibling element
   *      in the KAV — it handles its own physical space in the layout.
   *      The FlatList content just needs a small breathing gap.
   */
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 8,       // gap between newest message and FlatList bottom edge
    paddingBottom: 16,   // gap at the visual top (oldest message area)
  },

  /* ── OWN BUBBLE ── */
  ownWrap: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '75%', marginVertical: 3 },
  ownBubble: {
    backgroundColor: TOKEN.fgBrand,       // gold[600] champagne
    borderRadius: 16, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 36,
    shadowColor: TOKEN.fgBrand,
    shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  ownText: { fontSize: 15, fontWeight: '400', color: '#FFFFFF', lineHeight: 22 },
  ownMeta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 },
  ownTime: { fontSize: 11, color: 'rgba(255,255,255,0.70)' },
  tickText: { fontSize: 11, color: 'rgba(255,255,255,0.70)' },
  tickRead: { letterSpacing: -2, color: 'rgba(255,255,255,0.90)' },

  /* ── OTHER / AI BUBBLE ── */
  otherWrap: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'flex-start', maxWidth: '85%', gap: 8, marginVertical: 3 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: TOKEN.bgCard,
    borderWidth: 1, borderColor: TOKEN.borderHair,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarAI: { borderStyle: 'dashed', borderColor: TOKEN.fgSecondary },
  avatarText: { fontSize: 15, fontWeight: '700', color: TOKEN.fgSecondary },
  otherContent: { flex: 1, gap: 3 },
  otherNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, paddingHorizontal: 2 },
  otherName: { fontSize: 13, fontWeight: '700', color: TOKEN.fgSecondary },
  colonyTag: { backgroundColor: TOKEN.bgCard, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  colonyTagText: { fontSize: 10, fontWeight: '600', color: TOKEN.fgSecondary },
  verifiedBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#4F8FFF', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { fontSize: 7, fontWeight: '800', color: '#FFFFFF' },
  founderBadge: { backgroundColor: palette.gold[100], borderWidth: 1, borderColor: TOKEN.borderHair, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  founderText: { fontSize: 9, fontWeight: '800', color: TOKEN.fgBrandSubtle, letterSpacing: 0.3 },
  mayorInlineBadge: { backgroundColor: palette.gold[100], borderWidth: 1, borderColor: TOKEN.borderHair, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  mayorInlineText: { fontSize: 9, fontWeight: '800', color: TOKEN.fgBrandSubtle },
  aiBadge: { backgroundColor: TOKEN.bgCard, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  aiBadgeText: { fontSize: 10, fontWeight: '600', color: TOKEN.fgSecondary, fontStyle: 'italic' },
  otherBubble: {
    backgroundColor: TOKEN.bgCard,        // cream[200] warm ivory
    borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 36,
    // Shadow instead of flat border for luxury feel
    shadowColor: palette.ink[950],
    shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  otherBubbleAI: { borderStyle: 'dashed', borderWidth: 1, borderColor: TOKEN.borderHair },
  otherText: { fontSize: 15, fontWeight: '400', color: TOKEN.fgPrimary, lineHeight: 22 },
  otherTime: { fontSize: 11, color: TOKEN.fgSecondary, marginTop: 4 },

  /* ── Reactions ── */
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5, paddingHorizontal: 2 },
  reactPill: {
    backgroundColor: TOKEN.bgSurface,
    shadowColor: palette.ink[950], shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
    borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8,
  },
  reactText: { fontSize: 12, color: TOKEN.fgSecondary },

  /* ── Mayor Announcement ── */
  mayorWrap: { alignSelf: 'center', width: '92%', marginVertical: 8, position: 'relative' },
  mayorCrown: { fontSize: 20, textAlign: 'center', position: 'absolute', top: -10, left: 0, right: 0, zIndex: 1 },
  mayorCard: {
    backgroundColor: TOKEN.bgCard,
    borderWidth: 2, borderColor: TOKEN.borderCardEmphasis,
    borderRadius: 12, padding: 16, marginTop: 8,
    shadowColor: TOKEN.fgBrand, shadowOpacity: 0.12, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  mayorCardHeader: { fontSize: 12, fontWeight: '700', color: TOKEN.fgBrand, textAlign: 'center', marginBottom: 8 },
  mayorCardText: { fontSize: 15, fontWeight: '400', color: TOKEN.fgPrimary, lineHeight: 22 },
  mayorCardTime: { fontSize: 11, color: TOKEN.fgSecondary, textAlign: 'center', marginTop: 8 },

  /* ── System Message ── */
  systemWrap: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  systemText: { fontSize: 12, fontWeight: '400', color: TOKEN.fgSecondary, textAlign: 'center' },

  /* ── Date Separator ── */
  dateSepWrap: { alignItems: 'center', marginVertical: 10 },
  dateSepChip: { height: 24, paddingHorizontal: 12, borderRadius: 12, backgroundColor: TOKEN.bgCard, alignItems: 'center', justifyContent: 'center' },
  dateSepText: { fontSize: 11, fontWeight: '600', color: TOKEN.fgSecondary },

  /* ── Input Area — Rule 04: static · z-935 · flush above Glass Island ── */
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TOKEN.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKEN.borderHair,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 935,
    // Premium: shadow instead of border on top
    shadowColor: palette.ink[950],
    shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 }, elevation: 4,
  },
  inputField: {
    flex: 1,
    minHeight: 40, maxHeight: 120,
    backgroundColor: TOKEN.bgCard,         // cream[200]
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TOKEN.borderInputIdle,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, fontWeight: '400', color: TOKEN.fgPrimary,
  },
  inputFieldActive: {
    borderWidth: 2,
    borderColor: TOKEN.borderInputFocus,   // gold[600]
    shadowColor: TOKEN.fgBrand,
    shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }, elevation: 2,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TOKEN.fgBrand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: TOKEN.fgBrand,
    shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  sendBtnDisabled: {
    backgroundColor: TOKEN.bgCard,
    shadowOpacity: 0, elevation: 0,
  },

  /* ── Glass Island — LAW 13 · z-950 ── */
  glassIslandWrapper: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 950,
  },
  glassIsland: {
    flexDirection: 'row',
    width: 280, height: 56, borderRadius: 28,
    backgroundColor: TOKEN.glassIslandBg,  // rgba(20,16,12,0.85) warm navy
    alignItems: 'center',
    // Gold rim hairline at top — per spec
    borderWidth: 0.5,
    borderColor: 'rgba(226,198,107,0.40)',
    shadowColor: TOKEN.glassIslandShadow,
    shadowOpacity: 0.40, shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 }, elevation: 16,
    overflow: 'hidden',
  },
  glassTab: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  glassActiveGlow: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(201,162,39,0.18)',  // gold[600] @ 18%
  },
  glassActiveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: TOKEN.glassIslandActive },

  /* ── Picker Sheet ── */
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TOKEN.scrim,
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  sheetContainer: {
    backgroundColor: TOKEN.bgSurface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 4,
    shadowColor: palette.ink[950], shadowOpacity: 0.20, shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: TOKEN.borderHair, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: TOKEN.fgPrimary, marginBottom: 8, paddingHorizontal: 4 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TOKEN.borderHair,
  },
  sheetRowActive: { borderBottomColor: 'transparent' },
  sheetRowText: { fontSize: 15, fontWeight: '500', color: TOKEN.fgPrimary },
  sheetRowTextActive: { fontWeight: '700', color: TOKEN.fgBrand },
});

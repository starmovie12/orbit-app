/**
 * CROWD WORLD — Home Screen (index.tsx) — Blueprint v5.0 BAAP EDITION
 *
 * Chat-First Landing · Hyper-Local Sector Chat
 *
 * Layout Stack (top → bottom):
 *   [1] Status Bar (system)
 *   [2] Header — City Pill + Sector Pill + CROWN Wordmark
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
  AccessibilityInfo,
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
import {
  Bell,
  Check,
  ChevronDown,
  Compass,
  CreditCard,
  Home as HomeIcon,
  Send as SendIcon,
  User,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

import { colors, palette, spacing, radii, zIndex } from '@/constants/colors';
import {
  durations,
  easings,
  fadeConfig,
  useReducedMotion,
} from '@/constants/animations';
import PullIndicator from '@/components/atoms/PullIndicator';
import ScrollFAB from '@/components/atoms/ScrollFAB';
import SkeletonBubble from '@/components/atoms/SkeletonBubble';

/* ─────────────────────────────────────────────────────────────────────────
   DESIGN TOKEN BRIDGE — maps legacy TOKEN.* names to canonical
   @/constants/colors semantic tokens. Zero hardcoded hex values.
   ───────────────────────────────────────────────────────────────────────── */
const TOKEN = {
  /* ── Backgrounds ── */
  bgSurface:          colors.bg.surface,
  bgCard:             colors.bg.card,
  bgCardHover:        colors.bg.cardHover,
  bgCardPressed:      colors.bg.cardPressed,
  bgSubtle:           colors.bg.subtle,
  bgApp:              colors.bg.surface,

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
  glassIslandInactive:'rgba(255,255,255,0.70)' as const,
  glassIslandShadow:  palette.glass.shadow,

  /* ── Semantic ── */
  offlineBg:          colors.bg.inverse,
  scrim:              colors.bg.scrim,
} as const;

/* ─────────────────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────────────────── */
type MsgStatus = 'sending' | 'sent' | 'read' | 'failed';

type MsgVariant =
  | 'own'
  | 'other'
  | 'ai'
  | 'system'
  | 'mayor'
  | 'date_separator';

interface Reaction {
  emoji: string;
  count: number;
}

interface ChatMsg {
  id: string;
  variant: MsgVariant;
  text: string;
  time: string;
  /* own + other + ai */
  displayName?: string;
  colonyTag?: string;
  isVerified?: boolean;
  isFounder?: boolean;
  isMayor?: boolean;
  reactions?: Reaction[];
  status?: MsgStatus;
  isAI?: boolean;
  /* mayor */
  mayorName?: string;
}

interface City {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   MOCK DATA  (replace with Firestore queries in production)
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
  {
    id: 'date_1',
    variant: 'date_separator',
    text: 'Aaj',
    time: '',
  },
  {
    id: 'sys_1',
    variant: 'system',
    text: 'Sector 17 abhi Heat 67 pe hai 🔥',
    time: '7:00 AM',
  },
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
    reactions: [
      { emoji: '🔥', count: 94 },
      { emoji: '🙌', count: 58 },
    ],
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

/** Pulsing amber dot — Online count strip. Uses animation tokens per Blueprint §5.N */
function OnlinePulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: durations.ripple,   // 600ms — blueprint §5.N pulseHalf
          easing:   easings.easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: durations.ripple,
          easing:   easings.easeInOut,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[styles.onlineDot, { opacity }]}
      accessibilityElementsHidden
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HEADER COMPONENT — Two-Row Architecture (Part 3 § 1 Correction)
   Row 1: CROWD wordmark (left) · Notifications + Avatar (right)
   Row 2: City Pill · Sector Pill
   Total sticky height: 100px (56px + 44px, excluding safe-area-top)
   ───────────────────────────────────────────────────────────────────────── */
interface HeaderProps {
  city: City;
  sector: Sector;
  onCityPress: () => void;
  onSectorPress: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
  paddingTop: number;
  notificationCount?: number;
}

function HomeHeader({
  city,
  sector,
  onCityPress,
  onSectorPress,
  onNotificationsPress,
  onProfilePress,
  paddingTop,
  notificationCount = 0,
}: HeaderProps) {
  return (
    <View style={[styles.header, { paddingTop }]} testID="home-header">

      {/* ── ROW 1 — Brand Row (56px H) ── */}
      {/* CROWD wordmark left · Notifications + Avatar right */}
      <View style={styles.headerRow1}>

        {/* CROWD Wordmark — LAW 15 · left edge · gold-800 · pure typography */}
        <Text
          style={styles.crownWordmark}
          accessibilityRole="header"
          accessibilityLabel="CROWD WORLD"
          importantForAccessibility="yes"
          testID="home-header-brand-logo"
        >
          CROWD
        </Text>

        {/* Right actions: Notifications + Profile Avatar */}
        <View style={styles.headerRightActions}>

          {/* Notifications Bell */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onNotificationsPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              notificationCount > 0
                ? `Notifications · ${notificationCount} unread`
                : 'Notifications'
            }
            testID="home-header-notifications"
          >
            <Bell size={22} color={TOKEN.fgPrimary} strokeWidth={1.5} />
            {notificationCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Profile Avatar — Rule 03: THIS is the sole valid location */}
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

      {/* ── ROW 2 — Location Row (44px H) ── */}
      {/* City Pill + Sector Pill */}
      <View style={styles.headerRow2}>

        {/* City Picker Pill */}
        <TouchableOpacity
          style={styles.cityPill}
          onPress={onCityPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Change city. Currently ${city.name}.`}
          accessibilityHint="Double tap to open city picker"
          testID="home-header-city-pill"
        >
          <Text style={styles.pillIcon}>📍</Text>
          <Text style={styles.pillText} numberOfLines={1}>
            {city.name}
          </Text>
          <ChevronDown size={12} color={TOKEN.fgSecondary} strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Sector Picker Pill */}
        <TouchableOpacity
          style={styles.sectorPill}
          onPress={onSectorPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Change sector. Currently ${sector.name}, ${city.name}.`}
          accessibilityHint="Double tap to open sector picker"
          testID="home-header-sector-pill"
        >
          <Text style={styles.pillText} numberOfLines={1}>
            {sector.name}
          </Text>
          <ChevronDown size={12} color={TOKEN.fgSecondary} strokeWidth={1.5} />
        </TouchableOpacity>

      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ONLINE COUNT STRIP
   ───────────────────────────────────────────────────────────────────────── */
interface OnlineStripProps {
  count: number;
  heatScore: number;
  showTrustAnchor: boolean;
}

function OnlineCountStrip({ count, heatScore, showTrustAnchor }: OnlineStripProps) {
  const displayCount = count >= 10000
    ? `${(count / 1000).toFixed(1)}K`
    : count.toLocaleString('en-IN');

  return (
    <View style={styles.onlineStrip} testID="home-online-strip">
      {/* Online member count */}
      <View style={styles.onlineLeft}>
        <OnlinePulseDot />
        <Text
          style={styles.onlineText}
          accessibilityLabel={`${displayCount} members online in this sector`}
          accessibilityLiveRegion="polite"
          testID="home-online-count"
        >
          {displayCount} yahan online
        </Text>
      </View>

      <View style={styles.onlineRight}>
        {/* Trust anchor — first session of day only */}
        {showTrustAnchor && (
          <View style={styles.trustChip} testID="home-trust-anchor">
            <Text
              style={styles.trustChipText}
              accessibilityLabel="Trusted by over 1 lakh users"
            >
              👥 1 Lakh+
            </Text>
          </View>
        )}

        {/* Heat Score pill — visible when >= 30 */}
        {heatScore >= 30 && (
          <View style={styles.heatPill} testID="home-heat-score">
            <Text
              style={styles.heatPillText}
              accessibilityLabel={`Heat Score ${heatScore} out of 100`}
            >
              🔥 {heatScore}
            </Text>
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
    Animated.timing(translateY, {
      toValue: visible ? 0 : -32,
      duration: visible ? 240 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.offlineBanner, { transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
      testID="home-offline-banner"
    >
      <Text style={styles.offlineIcon}>📶</Text>
      <Text style={styles.offlineText} numberOfLines={1}>
        Offline · saved messages dikha rahe hain
      </Text>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MESSAGE BUBBLE VARIANTS
   ───────────────────────────────────────────────────────────────────────── */

/** Status tick for own messages */
function StatusTick({ status }: { status?: MsgStatus }) {
  if (!status) return null;
  if (status === 'sending') return <Text style={styles.tickText}>⏳</Text>;
  if (status === 'failed')
    return <Text style={[styles.tickText, { color: TOKEN.errorRed }]}>⚠️</Text>;
  if (status === 'read')
    return (
      <Text style={[styles.tickText, styles.tickRead]}>✓✓</Text>
    );
  return <Text style={styles.tickText}>✓</Text>;
}

/** Reactions row */
function ReactionsRow({ reactions }: { reactions: Reaction[] }) {
  if (!reactions.length) return null;
  return (
    <View style={styles.reactRow}>
      {reactions.map((r, i) => (
        <TouchableOpacity
          key={i}
          style={styles.reactPill}
          activeOpacity={0.75}
          accessibilityLabel={`${r.count} ${r.emoji} reactions`}
        >
          <Text style={styles.reactText}>
            {r.emoji} {r.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** OWN MESSAGE — right-aligned golden bubble */
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

/** OTHER / AI MESSAGE — left-aligned cream bubble with avatar */
function OtherBubble({ msg }: { msg: ChatMsg }) {
  const router = useRouter();
  const isAI = msg.variant === 'ai';
  const initials = (msg.displayName ?? 'U').charAt(0).toUpperCase();

  return (
    <View style={styles.otherWrap}>
      {/* Avatar */}
      <TouchableOpacity
        style={[styles.avatar, isAI && styles.avatarAI]}
        activeOpacity={0.8}
        onPress={() => !isAI && router.push(`/user/${msg.id}` as never)}
        accessibilityLabel={
          isAI ? `AI companion ${msg.displayName}` : `View ${msg.displayName}'s profile`
        }
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </TouchableOpacity>

      <View style={styles.otherContent}>
        {/* Name row */}
        <View style={styles.otherNameRow}>
          <Text style={styles.otherName}>{msg.displayName}</Text>
          {msg.colonyTag && (
            <View style={styles.colonyTag}>
              <Text style={styles.colonyTagText}>{msg.colonyTag}</Text>
            </View>
          )}
          {msg.isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✔</Text>
            </View>
          )}
          {msg.isFounder && (
            <View style={styles.founderBadge}>
              <Text style={styles.founderText}>FOUNDER</Text>
            </View>
          )}
          {msg.isMayor && (
            <View style={styles.mayorInlineBadge}>
              <Text style={styles.mayorInlineText}>👑 Mayor</Text>
            </View>
          )}
          {isAI && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>🤖 AI</Text>
            </View>
          )}
        </View>

        {/* Bubble */}
        <View style={[styles.otherBubble, isAI && styles.otherBubbleAI]}>
          <Text style={styles.otherText}>{msg.text}</Text>
          <Text style={styles.otherTime}>{msg.time}</Text>
        </View>

        {msg.reactions && <ReactionsRow reactions={msg.reactions} />}
      </View>
    </View>
  );
}

/** MAYOR ANNOUNCEMENT — centered golden card */
function MayorBubble({ msg }: { msg: ChatMsg }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableWithoutFeedback onPress={() => setExpanded(!expanded)}>
      <View
        style={styles.mayorWrap}
        accessibilityRole="text"
        accessibilityLabel={`Pinned Mayor announcement from ${msg.mayorName}: ${msg.text}`}
      >
        {/* Crown icon overlapping top edge */}
        <Text style={styles.mayorCrown}>👑</Text>
        <View style={styles.mayorCard}>
          <Text style={styles.mayorCardHeader}>
            📌 {msg.mayorName} · Mayor
          </Text>
          <Text
            style={styles.mayorCardText}
            numberOfLines={expanded ? undefined : 4}
          >
            {msg.text}
          </Text>
          <Text style={styles.mayorCardTime}>{msg.time}</Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

/** SYSTEM MESSAGE — centered, no bubble */
function SystemMsg({ msg }: { msg: ChatMsg }) {
  return (
    <View style={styles.systemWrap}>
      <Text
        style={styles.systemText}
        accessibilityRole="text"
        accessibilityLabel={`System: ${msg.text}`}
      >
        {msg.text}
      </Text>
    </View>
  );
}

/** DATE SEPARATOR */
function DateSeparator({ msg }: { msg: ChatMsg }) {
  return (
    <View style={styles.dateSepWrap}>
      <View style={styles.dateSepChip}>
        <Text
          style={styles.dateSepText}
          accessibilityRole="header"
          accessibilityLabel={`Messages from ${msg.text}`}
        >
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

/** Master bubble switcher */
function MessageItem({ item }: { item: ChatMsg }) {
  switch (item.variant) {
    case 'own':
      return <OwnBubble msg={item} />;
    case 'other':
    case 'ai':
      return <OtherBubble msg={item} />;
    case 'mayor':
      return <MayorBubble msg={item} />;
    case 'system':
      return <SystemMsg msg={item} />;
    case 'date_separator':
      return <DateSeparator msg={item} />;
    default:
      return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   GLASS ISLAND NAV BAR  (LAW 13)
   ───────────────────────────────────────────────────────────────────────── */
interface GlassIslandProps {
  activeTab: 'home' | 'discover' | 'wallet' | 'profile';
  onTabPress: (tab: 'home' | 'discover' | 'wallet' | 'profile') => void;
  translateY: Animated.Value;
  bottomInset: number;
}

const GLASS_TABS: Array<{
  id: 'home' | 'discover' | 'wallet' | 'profile';
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
}> = [
  { id: 'home',     Icon: HomeIcon,    label: 'Home' },
  { id: 'discover', Icon: Compass,     label: 'Discover' },
  { id: 'wallet',   Icon: CreditCard,  label: 'Wallet' },
  { id: 'profile',  Icon: User,        label: 'Profile' },
];

function GlassIsland({
  activeTab,
  onTabPress,
  translateY,
  bottomInset,
}: GlassIslandProps) {
  return (
    <Animated.View
      style={[
        styles.glassIslandWrapper,
        { bottom: bottomInset + 16, transform: [{ translateY }] },
      ]}
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
              accessibilityLabel={
                isActive
                  ? `${tab.label}, currently selected`
                  : `${tab.label}, double tap to switch`
              }
            >
              <tab.Icon
                size={22}
                strokeWidth={1.5}
                color={
                  isActive
                    ? TOKEN.glassIslandActive
                    : TOKEN.glassIslandInactive
                }
              />
              {isActive && <View style={styles.glassActiveDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CITY / SECTOR PICKER BOTTOM SHEET  (lightweight inline)
   ───────────────────────────────────────────────────────────────────────── */
interface PickerSheetProps {
  type: 'city' | 'sector';
  items: Array<City | Sector>;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function PickerSheet({
  type,
  items,
  selectedId,
  onSelect,
  onClose,
}: PickerSheetProps) {
  const title = type === 'city' ? 'Apna Shehar Chuno' : 'Apna Sector Chuno';

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableWithoutFeedback>
          <View style={styles.sheetContainer}>
            {/* Handle */}
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.sheetRow,
                  selectedId === item.id && styles.sheetRowActive,
                ]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    selectedId === item.id && styles.sheetRowTextActive,
                  ]}
                >
                  {item.name}
                </Text>
                {selectedId === item.id && (
                  <Check size={16} color={TOKEN.fgBrand} strokeWidth={1.5} />
                )}
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
  const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]);
  const [selectedSector, setSelectedSector] = useState<Sector>(SECTORS[0]);
  const [msgs, setMsgs] = useState<ChatMsg[]>(INITIAL_MSGS);
  const [inputText, setInputText] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [onlineCount] = useState(234);
  const [heatScore] = useState(67);
  const [showTrustAnchor, setShowTrustAnchor] = useState(true);
  const [pickerOpen, setPickerOpen] = useState<'city' | 'sector' | null>(null);
  const [activeTab, setActiveTab] = useState<
    'home' | 'discover' | 'wallet' | 'profile'
  >('home');
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [isSendDisabled, setIsSendDisabled] = useState(true);
  const [notificationCount] = useState(3); // mock · replace with Firestore listener
  const [isLoading, setIsLoading] = useState(true);      // skeleton until first load
  const [isRefreshing, setIsRefreshing] = useState(false); // pull-to-refresh

  /* ── Refs ── */
  const flatListRef = useRef<FlatList>(null);
  const glassTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);

  /* ── Trust anchor auto-hide after 60s ── */
  useEffect(() => {
    if (!showTrustAnchor) return;
    const t = setTimeout(() => setShowTrustAnchor(false), 60000);
    return () => clearTimeout(t);
  }, [showTrustAnchor]);

  /* ── Initial data load — dismiss skeleton after first Firestore fetch ── */
  /* Replace this timeout with your real Firestore listener's onSuccess callback */
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  /* ── Pull-to-refresh handler ── */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Replace with real Firestore re-fetch:
    //   await fetchLatestMessages(selectedSector.id);
    await new Promise<void>((r) => setTimeout(r, 1000));
    setIsRefreshing(false);
  }, []);

  /* ── Glass Island: hide on keyboard open ── */
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', () => {
      Animated.timing(glassTranslateY, {
        toValue: 120,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      Animated.timing(glassTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
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

    const newMsg: ChatMsg = {
      id: Date.now().toString(),
      variant: 'own',
      text,
      time: nowStr(),
      status: 'sending',
    };

    setMsgs((prev) => [...prev, newMsg]);
    setInputText('');
    setIsSendDisabled(true);

    // Optimistic status update
    setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === newMsg.id ? { ...m, status: 'sent' as MsgStatus } : m
        )
      );
    }, 800);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 80);
  }, [inputText, nowStr]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    setIsSendDisabled(text.trim().length === 0);
  }, []);

  /* ── Scroll handler for Glass Island hide/show ── */
  const handleScroll = useCallback(
    (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      // In inverted FlatList, scrolling "up" (toward older msgs) means y increases
      const scrolledUp = y > 100;
      if (scrolledUp !== isScrolledUp) {
        setIsScrolledUp(scrolledUp);
        Animated.spring(glassTranslateY, {
          toValue: scrolledUp ? 80 : 0,
          stiffness: 180,
          damping: 20,
          useNativeDriver: true,
        }).start();
      }

      // Hide trust anchor on first scroll
      if (y > 50 && showTrustAnchor) {
        setShowTrustAnchor(false);
      }
    },
    [isScrolledUp, showTrustAnchor]
  );

  /* ── Tab navigation ── */
  const handleTabPress = useCallback(
    (tab: 'home' | 'discover' | 'wallet' | 'profile') => {
      if (tab === 'home') {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      }
      setActiveTab(tab);
      const routes: Record<string, string> = {
        discover: '/(tabs)/discover',
        wallet: '/credits/index',
        profile: '/(tabs)/profile',
      };
      if (routes[tab]) router.push(routes[tab] as never);
    },
    [router]
  );

  /* ── Glass Island bottom position ── */
  // Glass Island sits flush below input area
  // Input area H = 64px + bottom inset
  // Glass Island is positioned 16px above safe-area-bottom
  const glassBottom = insets.bottom + 16;

  // Chat list bottom padding: input area + glass island + gap
  const chatPaddingBottom = 64 + insets.bottom + 56 + 16 + 8;

  /* ── Inverted data ── */
  const invertedMsgs = useMemo(() => [...msgs].reverse(), [msgs]);

  /* ── Render item (memoized) ── */
  const renderItem = useCallback(
    ({ item }: { item: ChatMsg }) => <MessageItem item={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMsg) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 80,
      offset: 80 * index,
      index,
    }),
    []
  );

  /* ── Input area bottom padding ── */
  // Sits above Glass Island — Glass Island height = 56px + 16px above safe-area
  const inputPaddingBottom = insets.bottom + 56 + 16 + 4;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── HEADER — Two-Row (Part 3 § 1) ── */}
      <HomeHeader
        city={selectedCity}
        sector={selectedSector}
        onCityPress={() => setPickerOpen('city')}
        onSectorPress={() => setPickerOpen('sector')}
        onNotificationsPress={() => router.push('/notifications/index' as never)}
        onProfilePress={() => router.push('/(tabs)/profile' as never)}
        paddingTop={insets.top}
        notificationCount={notificationCount}
      />

      {/* ── OFFLINE BANNER ── */}
      <OfflineBanner visible={isOffline} />

      {/* ── ONLINE COUNT STRIP ── */}
      <OnlineCountStrip
        count={onlineCount}
        heatScore={heatScore}
        showTrustAnchor={showTrustAnchor}
      />

      {/* ── KEYBOARD AVOIDING WRAPPER (only wraps chat + input) ── */}
      <KeyboardAvoidingView
        style={styles.chatInputWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── CHAT BODY ── */}
        {isLoading ? (
          /* Loading state: 8 premium skeleton bubbles while Firestore fetches */
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
          contentContainerStyle={[
            styles.chatContent,
            { paddingTop: chatPaddingBottom },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          refreshControl={
            <PullIndicator
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        />
        )}

        {/* ── SCROLL FAB — "New messages" pill (ScrollFAB replaces NewMsgChip) ── */}
        <ScrollFAB
          visible={isScrolledUp && newMsgCount > 0}
          label={newMsgCount > 0 ? `${newMsgCount} nayi messages` : 'New messages'}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            setNewMsgCount(0);
          }}
        />

        {/* ── STICKY INPUT AREA ── */}
        {/* Rule 04: static position · flush above Glass Island · z-935 */}
        <View
          style={[
            styles.inputArea,
            { paddingBottom: inputPaddingBottom },
          ]}
          testID="home-input-area"
        >
          {/* Input field */}
          <TextInput
            style={[
              styles.inputField,
              !isSendDisabled && styles.inputFieldActive,
            ]}
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
            accessibilityRole="none"
            testID="home-input-field"
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              isSendDisabled && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={isSendDisabled}
            hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isSendDisabled
                ? 'Send button. Type a message first.'
                : 'Send message'
            }
            accessibilityState={{ disabled: isSendDisabled }}
            testID="home-send-button"
          >
            <SendIcon
              size={18}
              strokeWidth={1.5}
              color={isSendDisabled ? TOKEN.fgSecondary : TOKEN.fgOnBrand}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── GLASS ISLAND NAV (LAW 13) ── */}
      {/* Rule 04: z-950 · flush below input · not overlapping */}
      <GlassIsland
        activeTab={activeTab}
        onTabPress={handleTabPress}
        translateY={glassTranslateY}
        bottomInset={insets.bottom}
      />

      {/* ── CITY / SECTOR PICKER SHEET ── */}
      {pickerOpen === 'city' && (
        <PickerSheet
          type="city"
          items={CITIES}
          selectedId={selectedCity.id}
          onSelect={(id) => {
            const found = CITIES.find((c) => c.id === id);
            if (found) setSelectedCity(found);
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}
      {pickerOpen === 'sector' && (
        <PickerSheet
          type="sector"
          items={SECTORS}
          selectedId={selectedSector.id}
          onSelect={(id) => {
            const found = SECTORS.find((s) => s.id === id);
            if (found) setSelectedSector(found);
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STYLES — v2.0 Premium Color System · Two-Row Header
   ───────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* ── Root ── */
  screen: {
    flex: 1,
    backgroundColor: TOKEN.bgApp,
  },

  /* ── Header (Two-Row · § 1 correction) ── */
  header: {
    backgroundColor: TOKEN.bgSurface,
    zIndex: 900,
  },

  /* Row 1 — Brand Row (56px H · CROWD wordmark left · Notifications + Avatar right) */
  headerRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
  },

  /* CROWD Wordmark — LAW 15 · gold[800] · 24px H · tight tracking · left edge */
  /* § 5.A: pure typography · NO ornamentation · NO gradient · NO animation */
  crownWordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKEN.fgBrandSubtle,  // gold[800] — 6.4:1 contrast on white ✅ AA
    letterSpacing: -0.5,
    lineHeight: 26,
  },

  /* Right actions container */
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TOKEN.fgError,  // crimson[600]
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: TOKEN.bgSurface,
    paddingHorizontal: 2,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerAvatarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TOKEN.bgCard,
    borderWidth: 2,
    borderColor: TOKEN.fgBrand,  // gold[600]
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKEN.fgSecondary,
  },

  /* Row 2 — Location Row (44px H · City Pill + Sector Pill) */
  headerRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.borderHair,  // cream[400]
  },

  /* City pill */
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: TOKEN.bgCard,         // cream[200] — warm ivory
    borderWidth: 1,
    borderColor: TOKEN.borderPill,          // cream[400]
    maxWidth: 140,
  },
  pillIcon: {
    fontSize: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKEN.fgPrimary,               // ink[950]
    flex: 1,
  },

  /* Sector pill — amber[600] border signals active hyper-local context */
  sectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: TOKEN.bgCard,
    borderWidth: 1,
    borderColor: TOKEN.borderSector,       // amber[600] — stronger border vs city pill
    maxWidth: 160,
  },

  /* ── Offline Banner ── */
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    backgroundColor: TOKEN.offlineBg,     // ink[950]
    paddingHorizontal: 16,
    zIndex: 935,
  },
  offlineIcon: { fontSize: 13 },
  offlineText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
  },

  /* ── Online Count Strip ── */
  onlineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    backgroundColor: TOKEN.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.borderHair,
    paddingHorizontal: 16,
    zIndex: 900,
  },
  onlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TOKEN.fgWarning,     // amber[600]
    borderWidth: 2,
    borderColor: TOKEN.bgSurface,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKEN.fgPrimary,
  },
  onlineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustChip: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: TOKEN.bgCard,        // cream[200]
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: TOKEN.fgSecondary,             // ink[600]
  },
  heatPill: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: TOKEN.fgWarning,     // amber[600]
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── Chat ── */
  chatInputWrapper: {
    flex: 1,
  },
  chatList: {
    flex: 1,
    backgroundColor: TOKEN.bgSurface,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },

  /* ── OWN BUBBLE — gold[600] fill · Rule 04 compliant ── */
  ownWrap: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '75%',
    marginVertical: 4,
  },
  ownBubble: {
    backgroundColor: TOKEN.fgBrand,       // gold[600] champagne
    borderRadius: 16,
    borderBottomRightRadius: 4,           // tail
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 36,
    shadowColor: TOKEN.fgBrand,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  ownText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  ownMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ownTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.70)',
  },
  tickText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.70)',
  },
  tickRead: {
    letterSpacing: -2,
    color: 'rgba(255,255,255,0.90)',
  },

  /* ── OTHER / AI BUBBLE — cream[200] fill ── */
  otherWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '85%',
    gap: 8,
    marginVertical: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKEN.bgCard,
    borderWidth: 1,
    borderColor: TOKEN.borderHair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAI: {
    borderStyle: 'dashed',
    borderColor: TOKEN.fgSecondary,       // ink[600]
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKEN.fgSecondary,
  },
  otherContent: {
    flex: 1,
    gap: 3,
  },
  otherNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 2,
  },
  otherName: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKEN.fgSecondary,             // ink[600] espresso
  },
  colonyTag: {
    backgroundColor: TOKEN.bgCard,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  colonyTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: TOKEN.fgSecondary,
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4F8FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  founderBadge: {
    backgroundColor: '#FBF4E2',           // gold[100]
    borderWidth: 1,
    borderColor: TOKEN.borderHair,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  founderText: {
    fontSize: 9,
    fontWeight: '800',
    color: TOKEN.fgBrandSubtle,           // gold[800]
    letterSpacing: 0.3,
  },
  mayorInlineBadge: {
    backgroundColor: '#F9EFCE',           // gold[100]
    borderWidth: 1,
    borderColor: TOKEN.borderHair,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  mayorInlineText: {
    fontSize: 9,
    fontWeight: '800',
    color: TOKEN.fgBrandSubtle,           // gold[800]
  },
  aiBadge: {
    backgroundColor: TOKEN.bgCard,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: TOKEN.fgSecondary,
    fontStyle: 'italic',
  },
  otherBubble: {
    backgroundColor: TOKEN.bgCard,       // cream[200] warm ivory
    borderRadius: 16,
    borderBottomLeftRadius: 4,            // tail toward avatar
    borderWidth: 1,
    borderColor: TOKEN.borderHair,        // cream[400]
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 36,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  otherBubbleAI: {
    borderStyle: 'dashed',
  },
  otherText: {
    fontSize: 15,
    fontWeight: '400',
    color: TOKEN.fgPrimary,               // ink[950] warm
    lineHeight: 22,
  },
  otherTime: {
    fontSize: 11,
    color: TOKEN.fgSecondary,             // ink[600]
    marginTop: 4,
  },

  /* ── Reactions ── */
  reactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  reactPill: {
    backgroundColor: TOKEN.bgSurface,
    borderWidth: 1,
    borderColor: TOKEN.borderHair,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  reactText: {
    fontSize: 12,
    color: TOKEN.fgSecondary,
  },

  /* ── Mayor Announcement — cream[200] + gold[600] 2px border ── */
  mayorWrap: {
    alignSelf: 'center',
    width: '92%',
    marginVertical: 8,
    position: 'relative',
  },
  mayorCrown: {
    fontSize: 20,
    textAlign: 'center',
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  mayorCard: {
    backgroundColor: TOKEN.bgCard,
    borderWidth: 2,
    borderColor: TOKEN.borderCardEmphasis, // gold[600]
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  mayorCardHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKEN.fgBrand,                  // gold[600]
    textAlign: 'center',
    marginBottom: 8,
  },
  mayorCardText: {
    fontSize: 15,
    fontWeight: '400',
    color: TOKEN.fgPrimary,
    lineHeight: 22,
  },
  mayorCardTime: {
    fontSize: 11,
    color: TOKEN.fgSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  /* ── System Message ── */
  systemWrap: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  systemText: {
    fontSize: 12,
    fontWeight: '400',
    color: TOKEN.fgSecondary,              // ink[600]
    textAlign: 'center',
  },

  /* ── Date Separator ── */
  dateSepWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSepChip: {
    height: 24,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: TOKEN.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSepText: {
    fontSize: 11,
    fontWeight: '600',
    color: TOKEN.fgSecondary,
  },

  /* ── Input Area — Rule 04: static · z-935 · flush above Glass Island ── */
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TOKEN.bgSurface,
    borderTopWidth: 1,
    borderTopColor: TOKEN.borderHair,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 935,
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: TOKEN.bgCard,        // cream[200]
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TOKEN.borderInputIdle,   // cream[400]
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '400',
    color: TOKEN.fgPrimary,
  },
  inputFieldActive: {
    borderWidth: 2,
    borderColor: TOKEN.borderInputFocus,  // gold[600]
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TOKEN.fgBrand,       // gold[600]
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOKEN.fgBrand,
    shadowOpacity: 0.30,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: TOKEN.bgCard,
    shadowOpacity: 0,
    elevation: 0,
  },

  /* ── Glass Island — LAW 13 · warm-tinted navy · z-950 ── */
  glassIslandWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 950,
  },
  glassIsland: {
    flexDirection: 'row',
    width: 280,
    height: 56,
    borderRadius: 28,
    backgroundColor: TOKEN.glassIslandBg,  // rgba(20,16,12,0.85)
    alignItems: 'center',
    shadowColor: TOKEN.glassIslandShadow,
    shadowOpacity: 0.40,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    overflow: 'hidden',
  },
  glassTab: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  glassActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKEN.glassIslandActive,  // gold[600]
  },

  /* ── Picker Sheet ── */
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TOKEN.scrim,          // rgba(28,24,20,0.55) warm
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  sheetContainer: {
    backgroundColor: TOKEN.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKEN.borderHair,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TOKEN.fgPrimary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.borderHair,
  },
  sheetRowActive: {
    borderBottomColor: 'transparent',
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: TOKEN.fgPrimary,
  },
  sheetRowTextActive: {
    fontWeight: '700',
    color: TOKEN.fgBrand,                  // gold[600]
  },
});

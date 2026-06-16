/**
 * CROWN — Home Screen (app/(tabs)/index.tsx)
 * PRD v3.2 FINAL · §9 App Architecture · §10 Home Screen · §19 Visual Design
 * Updated: §9.3.4 + §9.3.5 Swiggy-Style Scroll Coordination + Organism Components
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * LAYOUT STACK (top → bottom):
 * [1]  HomeHeader (organism) — 3 rows (136px total):
 * Row 1 (56px): "CROWN" wordmark + 🔔 bell + 💬 DM icon
 * Row 2 (48px): 4-Scope Switcher (World / Country / City / Sector)
 * → No track background (PRD v3.1 patch)
 * → Sliding gold capsule under active tab
 * → NEVER hides when isInputFocused=true (§9.2)
 * Row 3 (32px): Online strip — always names active scope geography
 * Hides on scroll-down · Reappears on scroll-up (§9.3.4)
 * [2]  Offline Banner (conditional · 32px)
 * [3]  Inverted FlatList — 6 message variants + 8-skeleton state
 * [4]  ScrollFAB — new-message chip (conditional)
 * [5]  ChatInput — sticky; slides down to fill gap when nav hidden (§9.3.5)
 * [6]  CrownBottomNav (organism) — fixed full-width bar (§9.3 PRD)
 * Tabs: Home · Explore · Crown · Profile
 * Hides on scroll-down (translateY 100%) · Reappears on scroll-up
 * NO floating glass island · NO backdrop-filter
 * bg: --bg-surface (white) · border-top: 1px --border-subtle
 *
 * SCROLL COORDINATION (§9.3.4 + §9.3.5 — Swiggy-Style):
 * navHidden=true  → header slides up, nav slides down, input fills gap
 * navHidden=false → all three snap back (200ms ease)
 * atBottom (y<10) → force navHidden=false always
 * isInputFocused  → Row 2 never hides regardless of navHidden
 *
 * SHEETS / MODALS:
 * CityPickerSheet     — tap active City scope button
 * SectorPickerSheet   — tap active Sector scope button
 * AuthGateSheet       — unauth write attempt (LAW 4)
 * MessageActionSheet  — long-press any bubble
 * SendFailedModal     — send failure recovery
 *
 * PRD LAWS ENFORCED:
 * §9.2  — 3-row header · Row 2 no track bg (v3.1 patch)
 * §9.3  — Simple fixed full-width bottom nav (not floating)
 * §9.3.3 — Tab switching: Home→scrollToBottom, others→router.push
 * §9.3.4 — Hide/show coordination on scroll delta
 * §9.3.5 — Input gap-fill trick (bottom shifts 56px → 0 when nav hidden)
 * §10.1 — Home screen anatomy locked
 * §19.1 — "CROWN" wordmark (uppercase, Syne 700)
 * §19.2 — Color tokens: bg-surface white, brand gold #D4A017
 * Rule 03 — NO avatar in header (lives only in Profile tab)
 *
 * FIRESTORE (UNCHANGED — DO NOT MODIFY):
 * subscribeToMessages() — real-time chat stream (50 messages)
 * subscribeToRoom()     — room metadata (onlineCount, heatScore)
 * sendMessage()         — optimistic write with status lifecycle
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
  AppState,
  type AppStateStatus,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useRouter }             from 'expo-router';
import { Feather }               from '@expo/vector-icons';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

// ── Async storage (Task Card #19 — view-mode persistence) ─────────────────
import AsyncStorage              from '@react-native-async-storage/async-storage';
// ── Auth ──────────────────────────────────────────────────────────────────
import { useAuth }               from '@/contexts/AuthContext';
// ── Design tokens ─────────────────────────────────────────────────────────
import { colors, palette, zIndex, spacing } from '@/constants/colors';
import { layout }                            from '@/constants/spacing';
import { FONT_BODY, FONT_HEADING }           from '@/constants/typography';
// ── Organisms (PRD §9.2 + §9.3) ───────────────────────────────────────────
// HomeHeader: 3-row header organism (Row1 wordmark + Row2 scope + Row3 strip)
// CrownBottomNav: Simple fixed full-width bottom nav organism (§9.3)
import HomeHeader, {
  hideHeader,
  showHeader,
} from '@/components/organisms/HomeHeader';
import CrownBottomNav, {
  hideNav,
  showNav,
} from '@/components/organisms/CrownBottomNav';

// ── Molecules ─────────────────────────────────────────────────────────────
import ChatInput                  from '@/components/molecules/ChatInput';
import SegmentedControl, {
  type SegmentOption,
}                                  from '@/components/molecules/SegmentedControl';
// ── Atoms / Molecules ─────────────────────────────────────────────────────
import MessageBubble              from '@/components/MessageBubble';
import ScrollFAB                  from '@/components/atoms/ScrollFAB';
import SkeletonBubble             from '@/components/atoms/SkeletonBubble';
// ── Sheet / Modal organisms ───────────────────────────────────────────────
import CityPickerSheet            from '@/components/organisms/CityPickerSheet';
import SectorPickerSheet          from '@/components/organisms/SectorPickerSheet';
import CountryPickerSheet         from '@/components/organisms/CountryPickerSheet';
import { MessageActionSheet }     from '@/components/organisms/MessageActionSheet';
import { AuthGateSheet }          from '@/components/organisms/AuthGateSheet';
import { SendFailedModal }         from '@/components/organisms/SendFailedModal';
// ── Firestore (UNCHANGED) ─────────────────────────────────────────────────
import {
  subscribeToMessages,
  sendMessage,
  type Unsubscribe as MsgUnsubscribe,
}                                 from '@/lib/firestore-messages';
import {
  subscribeToRoom,
  incrementOnlineCount,
  decrementOnlineCount,
  type Unsubscribe as RoomUnsubscribe,
}                                 from '@/lib/firestore-rooms';
// ── Types ─────────────────────────────────────────────────────────────────
import type { CWMessage, CWRoom } from '@/types/cw';
// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGE_PAGE_SIZE  = 50    as const;
const SKELETON_COUNT     = 8     as const;
const TRUST_ANCHOR_MS    = 60_000 as const;

const DEFAULT_CITY_ID      = 'chandigarh'  as const;
const DEFAULT_CITY_LABEL   = 'Chandigarh'  as const;
const DEFAULT_COUNTRY_ID    = 'IN'          as const;
const DEFAULT_COUNTRY_LABEL = 'India'       as const;
const DEFAULT_COUNTRY_EMOJI = '🇮🇳'         as const;
const DEFAULT_SECTOR_ID    = 'sector-17'   as const;
const DEFAULT_SECTOR_LABEL = 'Sector 17'   as const;
// PRD §19.2 — Brand color tokens (light mode)
const BRAND_GOLD    = '#D4A017' as const;
// --fg-brand
const TEXT_STRONG   = '#1A1A1A' as const;   // --fg-text-strong
const TEXT_MUTED    = '#6B5B2E' as const;
// --fg-text-muted
const BG_SURFACE    = '#FFFFFF' as const;   // --bg-surface
const BORDER_SUBTLE = '#E8D5A0' as const;
// --border-subtle

// PRD §9.3 — Bottom nav height (content area, excluding safe-area)
const BOTTOM_NAV_HEIGHT = 56 as const;
// ── Task Card #19 — Live / Top 30 Toggle ─────────────────────────────────
/** Messages older than this are excluded from the Top 30 pool */
const TWO_HOURS_MS       = 2 * 60 * 60 * 1_000 as const;
/** Hard cap on Top 30 list size */
const TOP30_LIMIT        = 30                    as const;
/** AsyncStorage key prefix for per-scope view mode pref */
const VIEW_PREF_KEY_PFX  = 'crown:view_mode:'   as const;
// PRD §9.3.4 — Scroll delta threshold for hide/show (prevents jitter)
const SCROLL_DELTA_THRESHOLD = 4 as const;
// PRD §9.3.5 — Scroll y threshold for "at bottom" detection (inverted list)
const AT_BOTTOM_Y_THRESHOLD = 10 as const;
// PRD §10.6 — ScrollFAB appears after scrolling this many px up
const SCROLL_FAB_THRESHOLD = 80 as const;
// PRD §10.1 — Trust anchor hides after scrolling past this y
const TRUST_ANCHOR_SCROLL_THRESHOLD = 20 as const;
/** Derive scope-aware roomId */
function buildRoomId(
  scope: ScopeKey,
  countryId: string,
  cityId: string,
  sectorId: string,
): string {
  switch (scope) {
    case 'world':   return 'world';
    case 'country': return countryId.toLowerCase();
    case 'city':    return cityId;
    case 'sector':  return `${cityId}_${sectorId}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — LOCAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The 4 geographic scopes — PRD §9.1 / §10.1 */
type ScopeKey = 'world' | 'country' | 'city' | 'sector';

/**
 * Task Card #19 — Live vs Top 30 view mode.
 * 'live' = chronological real-time stream (existing behaviour).
 * 'top30' = 30 most-reacted messages from the last 2 hours, client-side derived.
 */
type ViewMode = 'live' | 'top30';

/** Bottom nav tabs — PRD §9.3.2 */
type BottomTab = 'home' | 'explore' | 'crown' | 'profile';

/** Adapter for MessageActionSheet.message */
interface ActionSheetMsg {
  id:           string;
  variant:      'own' | 'other_user' | 'ai_companion' | 'mayor_announcement' | 'system' | 'date_separator';
  sector_id:    string;
  city_id:      string;
  timestamp:    number;
  text?:        string;
  sender_id?:   string;
  sender_name?: string;
  mayor_id?:    string;
  mayor_name?:  string;
  is_pinned?:   boolean;
}

interface FailedMsg {
  id:     string;
  text:   string;
  roomId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(ts: { toDate(): Date } | null | undefined): string {
  try {
    const date: Date = ts?.toDate?.() ?? new Date(ts as number);
    let h = date.getHours();
    const m = date.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' + m : m} ${ap}`;
  } catch {
    return '';
  }
}

function mapVariant(
  msg: CWMessage,
  currentUid: string | null,
): React.ComponentProps<typeof MessageBubble>['variant'] {
  if (msg.variant === 'date')   return 'date';
  if (msg.variant === 'system') return 'system';
  if (msg.variant === 'ai')     return 'ai';
  if (msg.variant === 'mayor')  return 'mayor';
  if (msg.variant === 'right' || (!!currentUid && msg.uid === currentUid)) return 'right';
  return 'left';
}

function mapStatus(msg: CWMessage): React.ComponentProps<typeof MessageBubble>['status'] {
  if (!msg.status)                               return undefined;
  if (msg.status === 'sent')                     return 'sent';
  if (msg.status === 'delivered' || msg.status === 'read') return 'delivered';
  if (msg.status === 'failed')                   return 'failed';
  return undefined;
}

function adaptToActionMsg(
  msg: CWMessage,
  currentUid: string | null,
  cityId: string,
  sectorId: string,
): ActionSheetMsg {
  const isOwn = !!currentUid && msg.uid === currentUid;
  let variant: ActionSheetMsg['variant'];
  switch (msg.variant) {
    case 'system': variant = 'system';             break;
    case 'date':   variant = 'date_separator';     break;
    case 'ai':     variant = 'ai_companion';       break;
    case 'mayor':  variant = 'mayor_announcement'; break;
    case 'right':  variant = 'own';                break;
    default:       variant = isOwn ? 'own' : 'other_user';
  }
  return {
    id:        msg.id,
    variant,
    sector_id: sectorId,
    city_id:   cityId,
    timestamp: (msg.timestamp as any)?.toMillis?.() ?? Date.now(),
    text:      msg.text ?? undefined,
    sender_id: msg.uid || undefined,
    is_pinned: false,
  };
}

/** PRD §10.1 — scope-aware online strip label */
function getScopeOnlineLabel(
  scope: ScopeKey,
  cityLabel: string,
  sectorLabel: string,
  count: number | null,
  countryLabel: string = 'India',
): string {
  const n = count !== null
    ? count >= 100_000
      ? `${(count / 100_000).toFixed(1)} Lakh`
      : count >= 1_000
      ? `${(count / 1_000).toFixed(0)}K`
      : count.toString()
    : '—';
  switch (scope) {
    case 'world':   return `${n} duniya bhar mein online`;
    case 'country': return `${n} ${countryLabel} mein online`;
    case 'city':    return `${n} ${cityLabel} mein online`;
    case 'sector':  return `${n} ${sectorLabel} mein online`;
  }
}

/** PRD §10.1 — scope-aware input placeholder */
function getScopePlaceholder(
  scope: ScopeKey,
  cityLabel: string,
  sectorLabel: string,
  countryLabel: string = 'India',
): string {
  switch (scope) {
    case 'world':   return 'World ki chat mein message likho...';
    case 'country': return `${countryLabel} ki chat mein message likho...`;
    case 'city':    return `${cityLabel} ki chat mein message likho...`;
    case 'sector':  return `${sectorLabel} mein message likho...`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — OFFLINE BANNER
// ─────────────────────────────────────────────────────────────────────────────

function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      style={S.offlineBanner}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID="home-offline-banner"
    >
      <Feather name="wifi-off" size={13} color={palette.white} style={S.offlineIcon} />
      <Text style={S.offlineText} numberOfLines={1}>
        Offline · saved messages dikha rahe hain
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — MESSAGE ROW (renders one MessageBubble per CWMessage)
// ─────────────────────────────────────────────────────────────────────────────

interface MessageRowProps {
  msg:        CWMessage;
  currentUid: string | null;
  onLongPress:(msg: CWMessage) => void;
}

const MessageRow = React.memo(function MessageRow({
  msg,
  currentUid,
  onLongPress,
}: MessageRowProps) {
  const variant  = mapVariant(msg, currentUid);
  const status   = mapStatus(msg);

  const reactions = useMemo<Array<{ emoji: string; count: number }>>(() => {
    if (!msg.reactions) return [];
    return Object.entries(msg.reactions).map(([emoji, count]) => ({
      emoji,
      count: count as number,
    }));
  }, [msg.reactions]);

  const tags = useMemo<React.ComponentProps<typeof MessageBubble>['tags']>(() => {
    if (variant === 'ai')  return { isAI: true };
    if (variant === 'mayor') return { isMayor: true };
    return undefined;
  }, [variant]);

  const handleLongPress = useCallback(() => {
    onLongPress(msg);
  }, [msg, onLongPress]);

  const displayText = msg.isDeleted
    ? '🚫 Yeh message delete ho gaya'
    : (msg.text ?? '');

  return (
    <MessageBubble
      variant={variant}
      text={displayText}
      time={formatTime(msg.timestamp)}
      status={status}
      reactions={reactions}
      tags={tags}
      onLongPress={handleLongPress}
    />
  );
});
// ─────────────────────────────────────────────────────────────────────────────
// § 4b — LIVE / TOP 30 TOGGLE BAR  (Task Card #19)
//
// • Shown only for City / Country / World scope — Sector is always Live.
// • Uses the existing SegmentedControl molecule (dark pill, gold indicator).
// • Bar height: 8px V-padding × 2 + 32px control = 48px total.
// • Sits between the sticky HomeHeader and the KAV/FlatList so it scrolls
//   ONLY when the header hides (it's part of the sticky zone above the chat).
// ─────────────────────────────────────────────────────────────────────────────

const LIVE_TOP30_OPTIONS: SegmentOption[] = [
  { label: '⚡ Live', value: 'live'   },
  { label: '🏆 Top 30', value: 'top30' },
];
interface LiveTop30BarProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function LiveTop30Bar({ viewMode, onChange }: LiveTop30BarProps) {
  return (
    <View
      style={S.liveTop30Bar}
      accessibilityRole="tablist"
      accessibilityLabel="View mode — Live chat ya Top 30"
      testID="live-top30-bar"
    >
      <SegmentedControl
        options={LIVE_TOP30_OPTIONS}
        selected={viewMode}
        onChange={(v) => onChange(v as ViewMode)}
        style={S.liveTop30Control}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5b — TOP 30 MESSAGE ROW  (Task Card #19)
//
// Wraps the existing MessageRow with:
//   • Rank badge (#1, #2 … #30) in Space Mono (numerics token)
//   • Percentile chip: "🏆 Top 0.06% · 142 reactions"
//     Percentile ≈ (rank / total_msgs_in_memory) × 100 (Phase 1 approximation)
//
// Phase 2: replace totalSeen with a Cloud Function daily count per scope.
// ─────────────────────────────────────────────────────────────────────────────

interface Top30MessageRowProps {
  msg:        CWMessage;
  currentUid: string | null;
  onLongPress:(msg: CWMessage) => void;
  rank:       number;
  // 1-based (1 = most reactions)
  totalSeen:  number;
  // total messages in local memory (for percentile approx)
}

const Top30MessageRow = React.memo(function Top30MessageRow({
  msg,
  currentUid,
  onLongPress,
  rank,
  totalSeen,
}: Top30MessageRowProps) {

  // Sum all emoji reaction counts for this message
  const totalReactions = useMemo(
    () => Object.values(msg.reactions ?? {}).reduce((s: number, n: number) => s + n, 0),
    [msg.reactions],
  );

  // Percentile: lower rank number = better → "Top X%"
  // Minimum shown: 0.1% (avoids "Top 0.0%")
  const percentile = totalSeen > 0
    ? Math.max(0.1, (rank / totalSeen) * 100).toFixed(1)
    : null;

  return (
    <View style={S.top30Row} testID={`top30-row-${rank}`}>

      {/* ── Rank line ─────────────────────────────────────────────────── */}
      <View style={S.top30RankLine}>
        <Text style={S.top30RankNum} accessibilityLabel={`Rank ${rank}`}>
          #{rank}
        </Text>
        {percentile !== null && (
          <View style={S.top30PercentilePill}>
            <Text style={S.top30PercentileText}>
              🏆 Top {percentile}% · {totalReactions} reactions
            </Text>
          </View>
        )}
      </View>

      {/* ── Message bubble ──────────────────────────────────────────────── */}
      <MessageRow
        msg={msg}
        currentUid={currentUid}
        onLongPress={onLongPress}
      />
    </View>
  );
});



function ChatSkeleton() {
  return (
    <View style={S.chatList} testID="home-chat-skeleton">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <SkeletonBubble key={i} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function ChatEmptyState({ sectorLabel }: { sectorLabel: string }) {
  return (
    <View style={S.emptyState} accessibilityRole="text">
      <Text style={S.emptyIcon}>🏙️</Text>
      <Text style={S.emptyTitle}>{sectorLabel} abhi quiet hai</Text>
      <Text style={S.emptySubtitle}>
        Pehle ho · Apne neighbours ko hi zindagi do
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — MAIN HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  // ── Location ─────────────────────────────────────────────────────────────
  const [countryId,    setCountryId]    = useState(DEFAULT_COUNTRY_ID);
  const [countryLabel, setCountryLabel] = useState(DEFAULT_COUNTRY_LABEL);
  const [countryEmoji, setCountryEmoji] = useState(DEFAULT_COUNTRY_EMOJI);
  const [cityId,       setCityId]       = useState(DEFAULT_CITY_ID);
  const [cityLabel,    setCityLabel]    = useState(DEFAULT_CITY_LABEL);
  const [sectorId,     setSectorId]     = useState(DEFAULT_SECTOR_ID);
  const [sectorLabel,  setSectorLabel]  = useState(DEFAULT_SECTOR_LABEL);
  // ── Scope (4-scope switcher — PRD §9.2 Row 2) ────────────────────────────
  const [activeScope, setActiveScope] = useState<ScopeKey>('sector');
  // ── Room ID — scope-aware ─────────────────────────────────────────────────
  const roomId = useMemo(
    () => buildRoomId(activeScope, countryId, cityId, sectorId),
    [activeScope, countryId, cityId, sectorId],
  );
  // ── Room metadata ─────────────────────────────────────────────────────────
  const [room,        setRoom]        = useState<CWRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);

  // ── Messages ──────────────────────────────────────────────────────────────
  const [messages,   setMessages]    = useState<CWMessage[]>([]);
  const [isLoading,  setIsLoading]   = useState(true);
  const [isOffline,  setIsOffline]   = useState(false);
  // ── ScrollFAB ─────────────────────────────────────────────────────────────
  const [newMsgCount,  setNewMsgCount]  = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  // ── Scroll Coordination — Swiggy-Style (PRD §9.3.4 + §9.3.5) ────────────
  // navHidden=true  → header up, nav down, input fills 56px gap
  // navHidden=false → all three visible, coordinated 200ms ease
  const [navHidden, setNavHidden] = useState(false);
  // ── isInputFocused — PRD §9.2 Row 2 Exception ────────────────────────────
  // When composing, Row 2 scope switcher NEVER hides so user can retarget scope
  const [isInputFocused, setIsInputFocused] = useState(false);
  // ── lastScrollY ref — scroll delta tracking (PRD §9.3.4) ─────────────────
  // useRef avoids re-renders on every scroll event (perf-critical path)
  const lastScrollY = useRef(0);
  // ── Sheets ────────────────────────────────────────────────────────────────
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [citySheetOpen,   setCitySheetOpen]   = useState(false);
  const [sectorSheetOpen, setSectorSheetOpen] = useState(false);
  const [authSheetOpen,   setAuthSheetOpen]   = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionMsg,       setActionMsg]       = useState<ActionSheetMsg | null>(null);
  // ── Send-failed modal ─────────────────────────────────────────────────────
  const [failedModalOpen, setFailedModalOpen] = useState(false);
  const [failedMsg,       setFailedMsg]       = useState<FailedMsg | null>(null);
  // ── Trust anchor ──────────────────────────────────────────────────────────
  const [showTrustAnchor, setShowTrustAnchor] = useState(true);
  // ── Refs ──────────────────────────────────────────────────────────────────
  const flatListRef   = useRef<FlatList<CWMessage>>(null);
  const msgUnsubRef   = useRef<MsgUnsubscribe | null>(null);
  const roomUnsubRef  = useRef<RoomUnsubscribe | null>(null);
  const firstLoadRef  = useRef(true);
  // ── Bottom tab state (PRD §9.3) ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  // ── User credits + DM count ───────────────────────────────────────────────
  const [userCredits,   setUserCredits]   = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.1 — KEYBOARD LISTENER (isInputFocused tracking)
  // PRD §9.2: Row 2 scope switcher never hides when composing a message.
  // Track keyboard show/hide to set isInputFocused state.
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsInputFocused(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsInputFocused(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.1b — SCROLL-TO-BOTTOM SIGNAL (PRD §9.3.3)
  // CrownBottomNav fires 'crown:scrollToBottom' via DeviceEventEmitter when
  // the user re-taps the already-active HOME tab.
  // This handler receives it and
  // scrolls the FlatList to offset 0 (= latest messages, because inverted).
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const { DeviceEventEmitter } = require('react-native');
    const sub = DeviceEventEmitter.addListener('crown:scrollToBottom', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, []);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.2 — FIRESTORE SUBSCRIPTIONS (UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    setRoomLoading(true);
    roomUnsubRef.current?.();
    roomUnsubRef.current = subscribeToRoom(roomId, (data) => {
      setRoom(data);
      setRoomLoading(false);
    });
    return () => { roomUnsubRef.current?.(); };
  }, [roomId]);
  useEffect(() => {
    setIsLoading(true);
    setMessages([]);
    firstLoadRef.current = true;
    setNewMsgCount(0);
    msgUnsubRef.current?.();

    msgUnsubRef.current = subscribeToMessages(roomId, MESSAGE_PAGE_SIZE, (msgs) => {
      setMessages(msgs);
      setIsLoading(false);
      if (!firstLoadRef.current && isScrolledUp) {
        setNewMsgCount((prev) => prev + 1);
      }
      firstLoadRef.current = false;
    });

    return () => { msgUnsubRef.current?.(); };
  }, [roomId]);
  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.uid) return;
    incrementOnlineCount(roomId).catch(() => {});

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        decrementOnlineCount(roomId).catch(() => {});
      } else if (state === 'active') {
        incrementOnlineCount(roomId).catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      decrementOnlineCount(roomId).catch(() => {});
    };
  }, [roomId, user?.uid]);
  useEffect(() => {
    if (!showTrustAnchor) return;
    const t = setTimeout(() => setShowTrustAnchor(false), TRUST_ANCHOR_MS);
    return () => clearTimeout(t);
  }, [showTrustAnchor]);
  useEffect(() => {
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsOffline(!(state.isConnected ?? true));
    }).catch(() => {});
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOffline(!(state.isConnected ?? true));
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    if (!user?.uid) {
      setUserCredits(0);
      setUnreadDmCount(0);
      return;
    }
    import('@/lib/firestore-users').then(({ subscribeToUserProfile }) => {
      const unsubUser = subscribeToUserProfile(user.uid, (profile) => {
        setUserCredits(profile?.credits ?? 0);
      });
      return () => unsubUser();
    }).catch(() => {});

    import('@/lib/firestore-messages').then(({ subscribeToUnreadDmCount }) => {
      const unsubDm = subscribeToUnreadDmCount(user.uid, (count) => {
        setUnreadDmCount(count);
      });
      return () => unsubDm();
    }).catch(() => {});
  }, [user?.uid]);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.3 — SEND MESSAGE (optimistic — UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSend = useCallback(async (text: string) => {
    if (!user?.uid) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const optId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const optimistic: CWMessage = {
      id:        optId,
      roomId,
      uid:       user.uid,
      text:      trimmed,
      imageURL:  null,
      variant:   'right',
      reactions: {},
      replyToId: null,
      isMicDrop: false,
      isDeleted: false,
      editedAt:  null,
      timestamp: { toDate: () => new Date(), toMillis: () => Date.now() } as any,
      status:    'sent',
    };

    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 60);

    try {
      await sendMessage(roomId, {
        id: optId, uid: user.uid, text: trimmed, variant: 'right', status: 'sent',
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optId ? { ...m, status: 'failed' as const } : m)
      );
      setFailedMsg({ id: optId, text: trimmed, roomId });
      setFailedModalOpen(true);
    }
  }, [user?.uid, roomId]);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.4 — FAILED MESSAGE RETRY (UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRetryFailed = useCallback(async () => {
    if (!failedMsg) return;
    const failed = failedMsg;
    setFailedModalOpen(false);
    setFailedMsg(null);
    setMessages((prev) => prev.filter((m) => m.id !== failed.id));
    await handleSend(failed.text);
  }, [failedMsg, handleSend]);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.5 — AUTH GATE (LAW 4 — Peek-Before-Join — UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAuthGate = useCallback(() => {
    setAuthSheetOpen(true);
  }, []);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.6 — LONG PRESS → MESSAGE ACTION SHEET (UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleLongPress = useCallback((msg: CWMessage) => {
    const adapted = adaptToActionMsg(msg, user?.uid ?? null, cityId, sectorId);
    setActionMsg(adapted);
    setActionSheetOpen(true);
  }, [user?.uid, cityId, sectorId]);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.7 — SCROLL HANDLER (PRD §9.3.4 + §9.3.5 — Swiggy-Style Coordination)
  //
  // Three-element coordination on every scroll frame (no re-render overhead):
  //   1. delta > 4px DOWN → reading mode
  //      hideHeader() — header slides up (-translateY 100%, 220ms easeInQuad)
  //      hideNav()    — nav slides down (+translateY 100%, 200ms ease)
  //      setNavHidden(true) — ChatInput bottom drops to insets.bottom (gap-fill)
  //   2. delta < -4px UP → controls mode — all three snap back
  //      showHeader() / showNav() / setNavHidden(false)
  //   3. atBottom (y < 10 on inverted list) → always force controls visible
  //
  // PERF: lastScrollY is a ref — zero re-renders per scroll frame.
  //       Only setNavHidden / setIsScrolledUp / setShowTrustAnchor cause renders
  //       and those are gated behind equality checks.
  // ═══════════════════════════════════════════════════════════════════════════

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const delta    = currentY - lastScrollY.current;
    lastScrollY.current = currentY;

    // ── PRD §9.3.4 — Swiggy-style hide/show ─────────────────────────────
    const atBottom = currentY < AT_BOTTOM_Y_THRESHOLD;

    if (atBottom || delta < -SCROLL_DELTA_THRESHOLD) {
      // Scrolling UP or at latest message → show all controls
      showHeader();        // HomeHeader slides back (headerScrollAnim → 0)
      showNav();           // CrownBottomNav slides back (navScrollAnim → 0)
      setNavHidden(false); // ChatInput: bottom returns to 56 + insets.bottom
    } else if (delta > SCROLL_DELTA_THRESHOLD) {
      // Scrolling DOWN → reading mode: hide header + nav, input fills gap
      hideHeader();        // HomeHeader slides up (headerScrollAnim → 1)
      hideNav();
      // CrownBottomNav slides down (navScrollAnim → 1)
      setNavHidden(true);
      // ChatInput: bottom falls to insets.bottom only
    }

    // ── ScrollFAB threshold ───────────────────────────────────────────────
    const scrolledUp = currentY > SCROLL_FAB_THRESHOLD;
    if (scrolledUp !== isScrolledUp) setIsScrolledUp(scrolledUp);

    // ── Trust anchor: hide on first scroll ───────────────────────────────
    if (currentY > TRUST_ANCHOR_SCROLL_THRESHOLD && showTrustAnchor) {
      setShowTrustAnchor(false);
    }
  }, [isScrolledUp, showTrustAnchor]);

  const handleScrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgCount(0);
    setIsScrolledUp(false);
  }, []);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.8 — SCOPE PRESS (PRD §10.8 — single tap vs tap-when-active)
  //
  //   Single tap on non-active scope → switch scope
  //   Tap already-active 'city'    → open CityPickerSheet
  //   Tap already-active 'sector'  → open SectorPickerSheet
  //   Tap already-active 'country' → (future: country picker)
  //   Tap already-active 'world'   → no action (only one world room)
  // ═══════════════════════════════════════════════════════════════════════════

  // PRD §9.2 — Single tap = switch scope; re-tap active = open picker
  // Split into two callbacks matching HomeHeader's onScopeChange / onPickerOpen API
  const handleScopeChange = useCallback((scope: ScopeKey) => {
    setActiveScope(scope);
  }, []);
  const handlePickerOpen = useCallback((scope: ScopeKey) => {
    if (scope === 'country') { setCountrySheetOpen(true); return; }
    if (scope === 'city')    { setCitySheetOpen(true);    return; }
    if (scope === 'sector')  { setSectorSheetOpen(true);  return; }
    // 'world' — no picker (only one world room)
  }, []);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.9 — CITY / SECTOR / COUNTRY SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCountrySelect = useCallback((id: string, name: string, emoji: string) => {
    setCountryId(id);
    setCountryLabel(name);
    setCountryEmoji(emoji);
  }, []);
  const handleCitySelect = useCallback((selectedCityId: string) => {
    setCityId(selectedCityId);
    setCityLabel(selectedCityId.charAt(0).toUpperCase() + selectedCityId.slice(1));
  }, []);
  const handleSectorSelect = useCallback((selectedSectorId: string) => {
    setSectorId(selectedSectorId);
    const label = selectedSectorId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    setSectorLabel(label);
  }, []);
  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.10 — BOTTOM TAB PRESS (PRD §9.3.3)
  //
  //   'home'    → scroll to bottom (latest messages) — no route push
  //   'explore' → router.push('/(tabs)/discover')
  //   'crown'   → router.push('/(tabs)/ranks')
  //   'profile' → router.push('/(tabs)/profile')
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTabPress = useCallback((tab: BottomTab) => {
    setActiveTab(tab);

    if (tab === 'home') {
      // PRD §9.3.3: Tapping Home while on Home → scroll to latest message (bottom)
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }

    // PRD §9.3.3: Other tabs push to their respective routes
    if (tab === 'explore') { router.push('/(tabs)/discover' as never); return; }
    if (tab === 'crown')   { router.push('/(tabs)/ranks'    as never); return; }
    if (tab === 'profile') { router.push('/(tabs)/profile'  as never); return; }
  }, [router]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.11 — FLATLIST DATA (newest-first for inverted list — UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const renderItem = useCallback(({ item }: { item: CWMessage }) => (
    <MessageRow
      msg={item}
      currentUid={user?.uid ?? null}
      onLongPress={handleLongPress}
    />
  ), [user?.uid, handleLongPress]);
  const keyExtractor = useCallback((item: CWMessage) => item.id, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.12 — KAV OFFSET (PRD §9.2)
  // Row1(56) + Row2(48) + Row3(32) = 136px + safeAreaTop
  // ═══════════════════════════════════════════════════════════════════════════

  const kavOffset = insets.top + 56 + 48 + 32;
  // = insets.top + 136px

  // ═══════════════════════════════════════════════════════════════════════════
  // § 8.13 — RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View style={S.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/*
       * ── [1] THREE-ROW HOME HEADER — organisms/HomeHeader (PRD §9.2) ──────
       *
       * Row 1 (56px): "CROWN" wordmark + 🔔 Bell + 💬 DM
       * Row 2 (48px): 4-Scope Switcher (World / Country / City / Sector)
       * PRD v3.1: NO track background — sliding capsule only
       * PRD §9.2: Row 2 NEVER hides when composerFocused=true
       * Row 3 (32px): Online count strip — always names the active geography
       *
       * Rule 03: NO avatar here. Avatar ONLY in Profile tab (CrownBottomNav).
       * Scroll coordination: hideHeader() / showHeader() called from scroll
       * handler below — HomeHeader animates internally via headerScrollAnim.
       */}
      {/*
       * FIX #1 — Wrapper View hata diya.
       * Pehle <View style={{ paddingTop: insets.top }}> ke andar HomeHeader tha.
       * React Native Web ka default overflow:hidden us wrapper ko 0-height
       * collapse kar ke header ko clip kar raha tha.
       * HomeHeader apna paddingTop:insets.top khud handle karta hai.
       */}
      <HomeHeader
        activeScope={activeScope}
        scopeLabels={{
          country:      countryLabel,
          city:         cityLabel,
          sector:       sectorLabel,
          countryEmoji: countryEmoji,
        }}
        onScopeChange={handleScopeChange}
        onPickerOpen={handlePickerOpen}
        onlineCount={room?.onlineCount ?? 0}
        heatScore={room?.heatScore ?? 0}
        unreadNotifications={0}
        unreadDms={unreadDmCount}
        showTrustAnchor={showTrustAnchor}
        onNotificationPress={() => router.push('/notifications/index' as never)}
        onDmPress={() => router.push('/(tabs)/inbox' as never)}
        composerFocused={isInputFocused}
      />

      {/*
       * ── [2] OFFLINE BANNER (conditional · 32px) ───────────────────────────
       */}
      <OfflineBanner visible={isOffline} />

      {/*
       * ── KEYBOARD AVOIDING WRAPPER ─────────────────────────────────────────
       * iOS: behavior="padding" — pushes content up by keyboard height
       * kavOffset: safeAreaTop + 56 + 48 + 32 = safeAreaTop + 136px
       */}
      <KeyboardAvoidingView
        style={S.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? kavOffset : undefined}
      >
        {/*
         * ── [3] CHAT BODY — Inverted FlatList ─────────────────────────────
         *
         * 6 message variants rendered by MessageRow → MessageBubble:
         * 'right'  — own message (gold fill, right-aligned)
         * 'left'   — other user (cream fill, left-aligned)
         * 'ai'     — AI companion (dotted ring, 🤖 AI pill)
         * 'mayor'  — Mayor announcement (gold left-accent)
         * 'system' — System event (centered chip)
         * 'date'   — Date separator (hairline chip)
         *
         * paddingBottom: BOTTOM_NAV_HEIGHT(56) + insets.bottom + 72(input bar)
         * PRD §9.3.5: 72px accounts for ChatInput bar above the nav.
         */}
        {isLoading ? (
          <ChatSkeleton />
        ) : (
          <FlatList<CWMessage>
            ref={flatListRef}
            data={invertedMessages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted
            style={S.chatList}
            contentContainerStyle={[
              S.chatContent,
              {
                // FIX #2 — Inverted FlatList mein padding direction ulta hota hai:
                //   paddingTop    = visual BOTTOM → newest message ke neeche
                //                   ChatInput (72px) + CrownBottomNav (56px) + safe-area
                //   paddingBottom = visual TOP    → oldest message ke upar
                //                   HomeHeader (136px) + safe-area
                paddingTop:    BOTTOM_NAV_HEIGHT + insets.bottom + 72,
                paddingBottom: insets.top + 136 + 8,
              },
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
            testID="home-chat-list"
            ListEmptyComponent={
              // FIX #3 — ListEmptyComponent ko inverted FlatList ka
              // container-level transform milta hai (scale:-1 / scaleY:-1) lekin
              // individual item jaisa counter-transform NAHI milta. Isliye empty
              // state 180° rotate dikhta tha.
              // Yeh wrapper cancel karta hai.
              <View style={{
                transform: Platform.select({
                  android: [{ scaleY: -1 as number }],
                  default: [{ scale: -1 as number }],
                }),
              }}>
                <ChatEmptyState sectorLabel={sectorLabel} />
              </View>
            }
          />
        )}

        {/*
         * ── [4] SCROLL FAB (new messages chip) ────────────────────────────
         * Positioned above ChatInput and CrownBottomNav.
         */}
        <ScrollFAB
          visible={isScrolledUp && newMsgCount > 0}
          label={newMsgCount > 0 ? `${newMsgCount} nayi messages` : 'New messages'}
          onPress={handleScrollToBottom}
        />

        {/*
         * ── [5] STICKY CHAT INPUT (PRD §9.3.5 — Gap-Fill Trick) ──────────
         *
         * navHidden prop:   When true, ChatInput slides down by 56px to fill
         * the vacated space of the hidden CrownBottomNav.
         * Both the nav (translateY 100%) and input (bottom shift)
         * animate at 200ms ease — zero visual gap, zero jump.
         *
         * navVisible prop:  Inverse of navHidden — provided for components that
         * prefer the affirmative form.
         *
         * Placeholder reflects active scope (PRD §10.1 note).
         * Rule 03: NO user avatar in this composer.
         * disabled=true when offline.
         */}
        <ChatInput
          onSend={handleSend}
          isAuthenticated={!!user}
          onAuthGate={handleAuthGate}
          placeholder={getScopePlaceholder(activeScope, cityLabel, sectorLabel, 'India')}
          disabled={isOffline}
          // ── PRD §9.3.5 — Scroll Coordination props ─────────────────────
          navHidden={navHidden}
          navVisible={!navHidden}
        />
      </KeyboardAvoidingView>

      {/*
       * ── [6] CROWN BOTTOM NAV — organisms/CrownBottomNav (PRD §9.3) ───────
       *
       * Replaces internal SimpleBottomNav.
       * Organism version receives navHidden
       * prop and handles its own translateY(100%) slide animation (200ms ease).
       *
       * PRD Founder mandate: "No floating Glass Island. The bottom nav is a
       * simple, full-width, fixed bar — exactly like WhatsApp / Telegram."
       *
       * - Full-width edge-to-edge (left: 0, right: 0)
       * - Height: 56px + safe-area-inset-bottom
       * - Solid white bg (--bg-surface)
       * - border-top: 1px --border-subtle
       * - NO backdrop-filter · NO transparency · NO border-radius
       *
       * navHidden=true  → translateY(100%) — slides fully off-screen (200ms)
       * navHidden=false → translateY(0%)   — slides back in (200ms)
       *
       * Tabs: Home · Explore · Crown · Profile
       * Active: var(--fg-brand) gold icon + bold label
       * Inactive: var(--fg-text-muted) muted
       *
       * Rule 03: Profile tab shows avatar ONLY here (not in header)
       */}
      <CrownBottomNav
        activeTab={activeTab}
        onTabPress={handleTabPress}
        bottomInset={insets.bottom}
        navHidden={navHidden}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SHEETS & MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/*
       * COUNTRY PICKER SHEET
       * Triggered: tap already-active 'country' scope button (PRD §10.8)
       * Design: 72% height · hero cards · full-row gold active state
       */}
      <CountryPickerSheet
        visible={countrySheetOpen}
        onClose={() => setCountrySheetOpen(false)}
        selected={countryId}
        onSelect={handleCountrySelect}
      />

      {/*
       * CITY PICKER SHEET
       * Triggered: tap already-active 'city' scope button (PRD §10.8)
       */}
      <CityPickerSheet
        visible={citySheetOpen}
        onClose={() => setCitySheetOpen(false)}
        selected={cityId}
        countryCode={countryId} // <--- FIX HERE: Yeh pehle missing tha
        onSelect={handleCitySelect}
      />

      {/*
       * SECTOR PICKER SHEET
       * Triggered: tap already-active 'sector' scope button (PRD §10.8)
       */}
      <SectorPickerSheet
        visible={sectorSheetOpen}
        onClose={() => setSectorSheetOpen(false)}
        cityId={cityId}
        selected={sectorId}
        onSelect={handleSectorSelect}
      />

      {/*
       * AUTH GATE SHEET (LAW 4 — Peek-Before-Join)
       * Half-screen · DISMISSIBLE · "Pehle dekho · sign up baad mein"
       */}
      <AuthGateSheet
        visible={authSheetOpen}
        onClose={() => setAuthSheetOpen(false)}
        onSignIn={() => setAuthSheetOpen(false)}
        triggerAction="input_tap"
      />

      {/*
       * MESSAGE ACTION SHEET
       * Triggered by long-press (350ms) on any message bubble.
       */}
      {actionMsg && user?.uid && (
        <MessageActionSheet
          visible={actionSheetOpen}
          onClose={() => { setActionSheetOpen(false); setActionMsg(null); }}
          message={actionMsg as any}
          currentUid={user.uid}
          isMayor={room?.mayorUid === user.uid}
        />
      )}

      {/*
       * SEND FAILED MODAL
       * Shows ⚠️ icon + "Dobara bhejo" CTA after send failure.
       */}
      {failedMsg !== null && (
        <SendFailedModal
          visible={failedModalOpen}
          failedMessage={failedMsg.text}
          onClose={() => { setFailedModalOpen(false); setFailedMsg(null); }}
          onRetry={handleRetryFailed}
          onSaveDraft={() => { setFailedModalOpen(false); setFailedMsg(null); }}
          onDiscard={() => {
            if (failedMsg) {
              setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
            }
            setFailedModalOpen(false);
            setFailedMsg(null);
          }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — STYLES
// PRD §19.2 color tokens. Zero hardcoded hex outside token constants above.
// Header styles removed — now managed by organisms/HomeHeader.
// BottomNav styles removed — now managed by organisms/CrownBottomNav.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root screen ───────────────────────────────────────────────────────────
  // PRD §19.2: --bg-surface = #FFFFFF (white)
  screen: {
    flex:            1,
    backgroundColor: BG_SURFACE,            // #FFFFFF — PRD §19.2
  },

  // ── Offline Banner ────────────────────────────────────────────────────────
  offlineBanner: {
    height:            32,
    backgroundColor:   palette.ink[950],    // warm ink — dark bg
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.base,        // 16px
    zIndex:            zIndex.fixedHeader,  // 900
  },
  offlineIcon: {
    marginRight: 6,
  },
  offlineText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   12,
    fontWeight: '500',
    color:      palette.white,
    flex:       1,
  },

  // ── KAV wrapper ───────────────────────────────────────────────────────────
  kav: {
    flex: 1,
  },

  // ── Chat FlatList ─────────────────────────────────────────────────────────
  chatList: {
    flex:            1,
    backgroundColor: BG_SURFACE,           // white
  },
  chatContent: {
    paddingHorizontal: spacing.sm,         // 8px
    paddingTop:        8,
    paddingBottom:     16,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    paddingVertical:   64,
    gap:               12,
  },
  emptyIcon: {
    fontSize:  64,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: FONT_BODY.bold,
    fontSize:   22,
    fontWeight: '700',
    color:      TEXT_STRONG,
    textAlign:  'center',
  },
  emptySubtitle: {
    fontFamily: FONT_BODY.regular,
    fontSize:   15,
    fontWeight: '400',
    color:      TEXT_MUTED,
    textAlign:  'center',
    lineHeight: 22,
  },
});

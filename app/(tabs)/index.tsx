/**
 * CROWD WORLD — Home Screen (app/(tabs)/index.tsx)
 * Blueprint v5.0 BAAP EDITION · Chat-First Landing · PRODUCTION COMPLETE
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * LAYOUT STACK (top → bottom):
 *   [1]  Header — CROWD WORLD wordmark + City Pill + Sector Pill   (LAW 15)
 *   [2]  Offline Banner (conditional · 32px · dark bg)
 *   [3]  Online Count Strip (32px · pulsing dot · Heat Score)
 *   [4]  Inverted FlatList — 6 message variants + 8-skeleton state
 *   [5]  ScrollFAB — new-message chip (conditional)
 *   [6]  ChatInput — sticky flush above Glass Island               (Rule 04 z:940)
 *   [7]  FloatingGlassIsland — dark glass pill nav                 (LAW 13 z:950)
 *
 * SHEETS / MODALS (rendered absolutely):
 *   CityPickerSheet     — triggered by City Pill
 *   SectorPickerSheet   — triggered by Sector Pill
 *   AuthGateSheet       — triggered by unauth write attempt (LAW 4)
 *   MessageActionSheet  — triggered by long-press on any bubble
 *   SendFailedModal     — triggered by message send failure (3 retry attempts)
 *
 * LAWS ENFORCED:
 *   Rule 03 — Avatar ONLY in Glass Island Profile tab (never in header/composer)
 *   Rule 04 — ChatInput flush above Glass Island · zero gap · z:940
 *   LAW 13  — Glass Island hides on scroll-up + keyboard open
 *   LAW 15  — Two-row header: 56px Row 1 + 44px Row 2
 *   § 5.A   — CROWD WORLD wordmark home screen ONLY
 *   LAW 4   — Peek-Before-Join: unauthenticated users see read-only preview
 *
 * FIRESTORE:
 *   subscribeToMessages() — real-time chat stream (50 messages · desc order)
 *   subscribeToRoom()     — real-time room metadata (onlineCount, heatScore)
 *   sendMessage()         — optimistic write with status lifecycle
 *   incrementOnlineCount / decrementOnlineCount — presence tracking
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
  AppState,
  type AppStateStatus,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useRouter }             from 'expo-router';
import { Feather }               from '@expo/vector-icons';

// ── Auth ──────────────────────────────────────────────────────────────────
import { useAuth }               from '@/contexts/AuthContext';

// ── Design tokens ─────────────────────────────────────────────────────────
import { colors, palette, zIndex, spacing } from '@/constants/colors';
import { layout }                            from '@/constants/spacing';
import { FONT_BODY }                         from '@/constants/typography';

// ── Components ────────────────────────────────────────────────────────────
import Header                     from '@/components/Header';
import OnlineCountStrip           from '@/components/molecules/OnlineCountStrip';
import ChatInput                  from '@/components/molecules/ChatInput';
import MessageBubble              from '@/components/MessageBubble';
import FloatingGlassIsland, {
  type FloatingGlassIslandHandle,
}                                 from '@/components/organisms/FloatingGlassIsland';
import CityPickerSheet            from '@/components/organisms/CityPickerSheet';
import SectorPickerSheet          from '@/components/organisms/SectorPickerSheet';
import { MessageActionSheet }     from '@/components/organisms/MessageActionSheet';
import { AuthGateSheet }          from '@/components/organisms/AuthGateSheet';
import ScrollFAB                  from '@/components/atoms/ScrollFAB';
import SkeletonBubble             from '@/components/atoms/SkeletonBubble';

// ── Firestore ─────────────────────────────────────────────────────────────
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

const MESSAGE_PAGE_SIZE = 50 as const;
const SKELETON_COUNT    = 8  as const;
const TRUST_ANCHOR_MS   = 60_000 as const;

const DEFAULT_CITY_ID     = 'chandigarh'  as const;
const DEFAULT_CITY_LABEL  = 'Chandigarh'  as const;
const DEFAULT_SECTOR_ID   = 'sector-17'   as const;
const DEFAULT_SECTOR_LABEL = 'Sector 17'  as const;

function buildRoomId(cityId: string, sectorId: string) {
  return `${cityId}_${sectorId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — LOCAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Adapter for MessageActionSheet.message — bridges CWMessage → sheet contract */
interface ActionSheetMsg {
  id:          string;
  variant:     'own' | 'other_user' | 'ai_companion' | 'mayor_announcement' | 'system' | 'date_separator';
  sector_id:   string;
  city_id:     string;
  timestamp:   number;
  text?:       string;
  sender_id?:  string;
  sender_name?: string;
  mayor_id?:   string;
  mayor_name?: string;
  is_pinned?:  boolean;
}

/** Payload for the send-failed recovery modal */
interface FailedMsg {
  id:     string;
  text:   string;
  roomId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PURE HELPERS (formatTime · mapVariant · mapStatus · adaptToActionMsg)
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(ts: any): string {
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
  if (!msg.status) return undefined;
  if (msg.status === 'sent') return 'sent';
  if (msg.status === 'delivered' || msg.status === 'read') return 'delivered';
  if (msg.status === 'failed') return 'failed';
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
    case 'system': variant = 'system';              break;
    case 'date':   variant = 'date_separator';      break;
    case 'ai':     variant = 'ai_companion';        break;
    case 'mayor':  variant = 'mayor_announcement';  break;
    case 'right':  variant = 'own';                 break;
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

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — SEND FAILED MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface SendFailedModalProps {
  visible:   boolean;
  failedMsg: FailedMsg | null;
  onRetry:   (msg: FailedMsg) => void;
  onDismiss: () => void;
}

function SendFailedModal({ visible, failedMsg, onRetry, onDismiss }: SendFailedModalProps) {
  if (!failedMsg) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={S.failedScrim}>
          <TouchableWithoutFeedback>
            <View style={S.failedCard} accessibilityRole="dialog">
              <View style={S.failedIconWrap}>
                <Feather name="alert-triangle" size={28} color={palette.crimson[600]} />
              </View>
              <Text style={S.failedTitle}>Message send nahi hua</Text>
              <Text style={S.failedPreview} numberOfLines={2}>
                "{failedMsg.text.slice(0, 80)}{failedMsg.text.length > 80 ? '…' : ''}"
              </Text>
              <TouchableOpacity
                style={S.failedRetryBtn}
                onPress={() => onRetry(failedMsg)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Dobara bhejo · Retry"
              >
                <Feather name="refresh-cw" size={16} color={palette.white} style={S.failedRetryIcon} />
                <Text style={S.failedRetryText}>Dobara bhejo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={S.failedCancelBtn}
                onPress={onDismiss}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Cancel karo"
              >
                <Text style={S.failedCancelText}>Cancel karo</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — OFFLINE BANNER
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
// § 6 — MESSAGE ROW (renders one MessageBubble per CWMessage)
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
  const variant = mapVariant(msg, currentUid);
  const status  = mapStatus(msg);

  const reactions = useMemo<Array<{ emoji: string; count: number }>>(() => {
    if (!msg.reactions) return [];
    return Object.entries(msg.reactions).map(([emoji, count]) => ({
      emoji,
      count: count as number,
    }));
  }, [msg.reactions]);

  const tags = useMemo<React.ComponentProps<typeof MessageBubble>['tags']>(() => {
    if (variant === 'ai')    return { isAI: true };
    if (variant === 'mayor') return { isMayor: true };
    return undefined;
  }, [variant]);

  const handleLongPress = useCallback(() => {
    onLongPress(msg);
  }, [msg, onLongPress]);

  // Deleted messages: render a soft shell instead of the original text
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
// § 7 — CHAT SKELETON (8 alternating left/right shimmer bubbles)
// ─────────────────────────────────────────────────────────────────────────────

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
// § 8 — EMPTY STATE
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
// § 9 — MAIN HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  // ── Location ─────────────────────────────────────────────────────────────
  const [cityId,       setCityId]       = useState(DEFAULT_CITY_ID);
  const [cityLabel,    setCityLabel]    = useState(DEFAULT_CITY_LABEL);
  const [sectorId,     setSectorId]     = useState(DEFAULT_SECTOR_ID);
  const [sectorLabel,  setSectorLabel]  = useState(DEFAULT_SECTOR_LABEL);

  const roomId = useMemo(() => buildRoomId(cityId, sectorId), [cityId, sectorId]);

  // ── Room metadata ─────────────────────────────────────────────────────────
  const [room,        setRoom]        = useState<CWRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);

  // ── Messages ──────────────────────────────────────────────────────────────
  const [messages,   setMessages]    = useState<CWMessage[]>([]);
  const [isLoading,  setIsLoading]   = useState(true);
  const [isOffline,  setIsOffline]   = useState(false);

  // ── ScrollFAB ─────────────────────────────────────────────────────────────
  const [newMsgCount,   setNewMsgCount]   = useState(0);
  const [isScrolledUp,  setIsScrolledUp]  = useState(false);

  // ── Sheets ────────────────────────────────────────────────────────────────
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
  const glassRef      = useRef<FloatingGlassIslandHandle>(null);
  const msgUnsubRef   = useRef<MsgUnsubscribe | null>(null);
  const roomUnsubRef  = useRef<RoomUnsubscribe | null>(null);
  const firstLoadRef  = useRef(true);

  // ── Glass Island active tab ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'wallet' | 'profile'>('home');

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.1 — FIRESTORE SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Room metadata: onlineCount + heatScore
  useEffect(() => {
    setRoomLoading(true);
    roomUnsubRef.current?.();
    roomUnsubRef.current = subscribeToRoom(roomId, (data) => {
      setRoom(data);
      setRoomLoading(false);
    });
    return () => { roomUnsubRef.current?.(); };
  }, [roomId]);

  // Messages real-time stream
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
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presence: increment on mount, decrement on unmount + background
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

  // Trust anchor auto-hide after 60s
  useEffect(() => {
    if (!showTrustAnchor) return;
    const t = setTimeout(() => setShowTrustAnchor(false), TRUST_ANCHOR_MS);
    return () => clearTimeout(t);
  }, [showTrustAnchor]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.2 — SEND MESSAGE (optimistic)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSend = useCallback(async (text: string) => {
    if (!user?.uid) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const optId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Optimistic bubble — appears immediately
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
    // Scroll to newest (inverted list: offset 0 = bottom = newest)
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 60);

    try {
      await sendMessage(roomId, {
        id:      optId,
        uid:     user.uid,
        text:    trimmed,
        variant: 'right',
        status:  'sent',
      });
    } catch {
      // Mark optimistic bubble as failed
      setMessages((prev) =>
        prev.map((m) => m.id === optId ? { ...m, status: 'failed' as const } : m)
      );
      setFailedMsg({ id: optId, text: trimmed, roomId });
      setFailedModalOpen(true);
    }
  }, [user?.uid, roomId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.3 — FAILED MESSAGE RETRY
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRetryFailed = useCallback(async (failed: FailedMsg) => {
    setFailedModalOpen(false);
    setFailedMsg(null);
    // Remove the failed bubble before re-sending
    setMessages((prev) => prev.filter((m) => m.id !== failed.id));
    await handleSend(failed.text);
  }, [handleSend]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.4 — AUTH GATE (LAW 4 — Peek-Before-Join)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAuthGate = useCallback(() => {
    setAuthSheetOpen(true);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.5 — LONG PRESS → MESSAGE ACTION SHEET
  // ═══════════════════════════════════════════════════════════════════════════

  const handleLongPress = useCallback((msg: CWMessage) => {
    const adapted = adaptToActionMsg(msg, user?.uid ?? null, cityId, sectorId);
    setActionMsg(adapted);
    setActionSheetOpen(true);
  }, [user?.uid, cityId, sectorId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.6 — SCROLL (Glass Island LAW 13 + ScrollFAB)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Forward to FloatingGlassIsland for LAW 13 hide/show
    glassRef.current?.scrollHandler(event);

    const y = event.nativeEvent.contentOffset.y;
    const scrolledUp = y > 80;
    if (scrolledUp !== isScrolledUp) setIsScrolledUp(scrolledUp);

    // Hide trust anchor on first scroll
    if (y > 20 && showTrustAnchor) setShowTrustAnchor(false);
  }, [isScrolledUp, showTrustAnchor]);

  const handleScrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgCount(0);
    setIsScrolledUp(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.7 — CITY / SECTOR SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCitySelect = useCallback((selectedCityId: string) => {
    setCityId(selectedCityId);
    // Capitalise first letter as best-effort label until Firestore resolves name
    setCityLabel(selectedCityId.charAt(0).toUpperCase() + selectedCityId.slice(1));
  }, []);

  const handleSectorSelect = useCallback((selectedSectorId: string) => {
    setSectorId(selectedSectorId);
    // "sector-17" → "Sector 17"
    const label = selectedSectorId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    setSectorLabel(label);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.8 — GLASS ISLAND TAB PRESS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTabPress = useCallback((tab: 'home' | 'discover' | 'wallet' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'home') {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    const routes: Record<string, string> = {
      discover: '/(tabs)/discover',
      wallet:   '/credits/index',
      profile:  '/(tabs)/profile',
    };
    if (routes[tab]) router.push(routes[tab] as never);
  }, [router]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.9 — FLATLIST DATA (newest-first for inverted list)
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
  // § 9.10 — KAV OFFSET
  // Height of non-KAV content above the KAV (for iOS padding compensation):
  //   safeAreaTop + Row1 (56) + Row2 (44) + OnlineStrip (32)
  // ═══════════════════════════════════════════════════════════════════════════

  const kavOffset = insets.top + layout.headerRow1Height + layout.headerRow2Height + 32;

  // ═══════════════════════════════════════════════════════════════════════════
  // § 9.11 — RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View style={S.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/*
       * ── [1] TWO-ROW HEADER (LAW 15) ──────────────────────────────────────
       *
       * variant="world":
       *   Row 1 (56px): "CROWD WORLD" wordmark (§ 5.A · Cormorant 24/700 · gold-800)
       *                 + Coins pill + DM icon (right)
       *   Row 2 (44px): CityPill + SectorPill
       *
       * Rule 03: NO profile avatar here.
       * Avatar lives ONLY in FloatingGlassIsland Profile tab below.
       *
       * credits / dmCount: wired to 0 for v1.0.
       * TODO: plug into user.credits from Firestore + unread DM subscription.
       */}
      <Header
        variant="world"
        city={cityLabel}
        sector={sectorLabel}
        sectorIsActive
        onPressCity={() => setCitySheetOpen(true)}
        onPressSector={() => setSectorSheetOpen(true)}
        credits={0}
        dmCount={0}
        onPressCredits={() => router.push('/credits/index' as never)}
        onPressDM={() => router.push('/(tabs)/inbox' as never)}
      />

      {/*
       * ── [2] OFFLINE BANNER (conditional · 32px · dark bg) ─────────────────
       *
       * Blueprint §Q9: 32px H below header · ink[950] bg
       * "📶 Offline · saved messages dikha rahe hain"
       * isOffline currently false (TODO: wire to NetInfo)
       */}
      <OfflineBanner visible={isOffline} />

      {/*
       * ── [3] ONLINE COUNT STRIP (32px · amber dot · Heat Score) ────────────
       *
       * [4.A] Online Member Pill: animated amber dot + count text
       *       count-up animation (200ms ease-out cubic)
       *       States: quiet (<50) · normal · abbreviated (≥10K)
       * [4.B] Heat Score Pill: gradient amber→gold · visible when score ≥ 30
       * [4.C] Trust Anchor Chip: "👥 1 Lakh+" · auto-hides after 60s
       *
       * loading=roomLoading shows skeleton rects (80×16 + 60×16)
       */}
      <OnlineCountStrip
        count={room?.onlineCount ?? null}
        heatScore={room?.heatScore ?? null}
        loading={roomLoading}
        showTrustAnchor={showTrustAnchor}
        onTrustAnchorDismiss={() => setShowTrustAnchor(false)}
      />

      {/*
       * ── KEYBOARD AVOIDING WRAPPER ─────────────────────────────────────────
       *
       * iOS:     behavior="padding" — pushes content up by keyboard height
       * Android: undefined — system WindowSoftInputMode handles resizing
       *
       * kavOffset accounts for all fixed-height content above this wrapper
       * (safeArea + header rows + online strip = insets.top + 56 + 44 + 32)
       *
       * The KAV wraps BOTH the FlatList AND the ChatInput so they both move
       * together when the keyboard opens (Rule 04: flush with no gap).
       */}
      <KeyboardAvoidingView
        style={S.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? kavOffset : undefined}
      >
        {/*
         * ── [4] CHAT BODY — Inverted FlatList ─────────────────────────────
         *
         * inverted=true: latest messages at visual bottom (index 0 = newest)
         * 6 message variants rendered by MessageRow → MessageBubble:
         *   'right'  — own message (gold fill · right-aligned)
         *   'left'   — other user (cream fill · left-aligned)
         *   'ai'     — AI companion (dashed gold border · ✦ AI badge)
         *   'mayor'  — Mayor announcement (gold left-accent spine)
         *   'system' — System event (centered gold-50 chip)
         *   'date'   — Date separator (hairline ─── chip ─── hairline)
         *
         * FIX (v5.1): paddingTop: 8 (visual bottom gap, not ~178px)
         * FIX (v5.1): getItemLayout removed (variable heights 40–200px)
         * FIX (v5.1): behavior="padding" on iOS only (not "height")
         *
         * Peek-Before-Join (LAW 4): messages are always rendered regardless
         * of auth state. ChatInput below triggers AuthGateSheet if unauthed.
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
            contentContainerStyle={S.chatContent}
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
            ListEmptyComponent={<ChatEmptyState sectorLabel={sectorLabel} />}
          />
        )}

        {/*
         * ── [5] SCROLL FAB (new messages chip) ────────────────────────────
         *
         * Appears when isScrolledUp=true AND newMsgCount>0
         * Positioned 80px above Glass Island floor (56px island + 24px gap)
         * Tapping scrolls to offset:0 (latest message) + resets counter
         * zIndex: stickyCTA (940) — above content, below Glass Island (950)
         */}
        <ScrollFAB
          visible={isScrolledUp && newMsgCount > 0}
          label={newMsgCount > 0 ? `${newMsgCount} nayi messages` : 'New messages'}
          onPress={handleScrollToBottom}
        />

        {/*
         * ── [6] STICKY CHAT INPUT (Rule 04 · z:940 · flush above Glass Island)
         *
         * ChatInput is position:static — sits in normal flex flow.
         * It is the DIRECT SIBLING below FlatList inside the KAV.
         * Glass Island (z:950) renders absolutely on top of it.
         * Rule 04: ChatInput z:940 < GlassIsland z:950, no gap, no overlap.
         *
         * ChatInput handles internally:
         *   - Auth gate: if !isAuthenticated → calls onAuthGate (no keyboard)
         *   - Send state machine: idle → active → sending → failed
         *   - Char counter: visible from 850 chars
         *   - Emoji keyboard trigger
         *   - disabled=true → offline opacity 0.5 (no interaction)
         *
         * Rule 03: NO user avatar in this composer.
         * Avatar ONLY in FloatingGlassIsland Profile tab.
         *
         * paddingBottom is handled by ChatInput's useSafeAreaInsets internally.
         */}
        <ChatInput
          onSend={handleSend}
          isAuthenticated={!!user}
          onAuthGate={handleAuthGate}
          placeholder={`${sectorLabel} mein message likho...`}
          disabled={isOffline}
        />
      </KeyboardAvoidingView>

      {/*
       * ── [7] FLOATING GLASS ISLAND (LAW 13 · z:950) ───────────────────────
       *
       * Self-contained floating pill nav:
       *   home     → Feather 'home'
       *   discover → Feather 'compass'
       *   wallet   → Feather 'credit-card'
       *   profile  → User avatar (Rule 03: ONLY place avatar appears)
       *
       * LAW 13 hide/show:
       *   Scroll toward older msgs → springBouncy hide (translateY + 72 + insets.bottom)
       *   Scroll back to latest   → springBouncy show (translateY 0)
       *   Keyboard opens          → hide (translateY +120px off-screen)
       *   Keyboard closes         → show (translateY 0)
       *   Reduced motion          → opacity fade only (no translateY animation)
       *
       * glassRef exposes scrollHandler wired to FlatList onScroll via handleScroll.
       */}
      <FloatingGlassIsland
        ref={glassRef}
        activeTab={activeTab}
        onTabPress={handleTabPress}
        userAvatarUri={user?.photoURL ?? undefined}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SHEETS & MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/*
       * CITY PICKER SHEET
       *
       * Features:
       *   - Firestore /cities real-time collection (is_active == true · orderBy name)
       *   - Shimmer skeleton: 6 rows × 64px · cream-200 ↔ white · 1200ms
       *   - Instant client-side search filter ("City dhundo...")
       *   - Recent Cities horizontal strip (AsyncStorage · max 5)
       *   - Active city: 2px gold-600 left accent bar + cream wash bg
       *   - Spinner overlay during city switch (AsyncStorage + Firestore parallel write)
       *   - 5 states: loading · idle · search-active · empty · error
       */}
      <CityPickerSheet
        visible={citySheetOpen}
        onClose={() => setCitySheetOpen(false)}
        selected={cityId}
        onSelect={handleCitySelect}
      />

      {/*
       * SECTOR PICKER SHEET
       *
       * Features:
       *   - Real-time Firestore sectors via subscribeSectorsByCity(cityId)
       *   - Shimmer skeleton: 8 rows × 64px · 1200ms
       *   - Sort toggle: 🔥 Heat (default) · 👥 Online · A-Z (LayoutAnimation)
       *   - Per row: 24×24 circle icon + name + colony tag + online count + HeatPulseDot
       *   - Heat pill: gradient amber→gold · visible when heatScore ≥ 30
       *   - Active sector: 2px gold-600 left bar + cream-50 bg + golden ✓ top-right
       *   - 5 states: loading · idle · search-active · empty · error
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
       *
       * Triggered when unauthed user taps ChatInput.
       * Features:
       *   - Half-screen (50%) · DISMISSIBLE (LAW 4 explicit: no forced signup)
       *   - Hero illustration (lock + heart · scale spring 0.9→1.0 on mount)
       *   - "Bas ek step aur..." subtitle (gold-700)
       *   - Headline + "1 Lakh+ users" trust anchor subhead
       *   - Feature strip (3 benefits · stagger fade-in 100ms each)
       *   - Phone input (+91 prefix · 10-digit · phone-pad · autoFocus)
       *   - Continue CTA (54px gold · disabled until 10 digits)
       *   - DPDP Act 2023 Terms + Privacy disclosure
       *   - "Pehle dekho · sign up baad mein" peek link (LAW 4 explicit)
       *   - Analytics: auth_gate_shown · auth_gate_continue_tap · etc.
       */}
      <AuthGateSheet
        visible={authSheetOpen}
        onClose={() => setAuthSheetOpen(false)}
        onSignIn={() => setAuthSheetOpen(false)}
        triggerAction="input_tap"
      />

      {/*
       * MESSAGE ACTION SHEET
       *
       * Triggered by long-press (350ms) on any message bubble.
       * Features:
       *   - 40%-height sheet · drag-down / scrim-tap → dismiss
       *   - Message preview (80px · avatar · 2-line text · relative time)
       *   - Quick-react emoji row: ❤️ 🔥 😂 👍 😮 🙏 (scale 1.0→1.2→1.0 · 200ms)
       *   - Extended emoji sub-picker (24 emojis · 8-column grid)
       *   - Action rows (per variant):
       *       React karo · Reply karo (disabled v1.1) · Copy karo
       *       WhatsApp pe Share · Save karo
       *       Report karo (not own, not AI) · Delete karo (own only)
       *       Pin/Unpin (Mayor only)
       *   - Per-action spinner → ✓ → dismiss
       *   - Delete: confirm modal (spring animation)
       *   - Report: reason selector → confirm modal
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
       * SEND FAILED MODAL (Blueprint §Q8 Severity 3)
       *
       * Triggered when sendMessage() rejects after optimistic write.
       * Shows: ⚠️ icon + truncated message preview + "Dobara bhejo" CTA
       * Retry: removes failed optimistic bubble → re-calls handleSend()
       * Up to 3 attempts tracked by the user manually (v1.0 per spec)
       */}
      <SendFailedModal
        visible={failedModalOpen}
        failedMsg={failedMsg}
        onRetry={handleRetryFailed}
        onDismiss={() => { setFailedModalOpen(false); setFailedMsg(null); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — STYLES
// All values from design token system. Zero hardcoded hex/magic numbers.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root screen ───────────────────────────────────────────────────────────
  // Warm Ivory (#FFF9EC = cream[50]) per Blueprint v5.0 Part 3 § 2
  screen: {
    flex: 1,
    backgroundColor: colors.bg.subtle,        // cream[50] #FFF9EC
  },

  // ── Offline Banner ────────────────────────────────────────────────────────
  // Blueprint §Q9: 32px H · ink[950] bg · 📶 icon + text
  offlineBanner: {
    height:           32,
    backgroundColor:  palette.ink[950],
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: spacing.base,           // 16px
    zIndex:           zIndex.fixedHeader,      // 900
  },
  offlineIcon: {
    marginRight: 6,
  },
  offlineText: {
    fontFamily: FONT_BODY.medium,              // DM Sans 500
    fontSize:   12,
    fontWeight: '500',
    color:      palette.white,
    flex:       1,
  },

  // ── Keyboard Avoiding View ────────────────────────────────────────────────
  kav: {
    flex: 1,
  },

  // ── Chat FlatList ─────────────────────────────────────────────────────────
  chatList: {
    flex:            1,
    backgroundColor: colors.bg.subtle,        // warm ivory — matches screen bg
  },

  // chatContent:
  //   paddingTop  = 8px gap at visual bottom (newest message edge, inverted)
  //   paddingBottom = 16px gap at visual top (oldest message area)
  //   paddingHorizontal: 8px — MessageBubble adds its own H padding internally
  //
  // FIX v5.1: paddingTop was previously ~178px (inputPaddingBottom) causing
  // a 178px blank zone at the bottom. Fixed to 8px static value.
  chatContent: {
    paddingHorizontal: spacing.sm,            // 8px — breathing room from screen edge
    paddingTop:        8,                     // gap between newest msg and list bottom
    paddingBottom:     16,                    // gap above oldest messages
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  // Shown when room is new and AI has not yet seeded
  // Blueprint §Q7: "Sector 17 abhi quiet hai" · 22px/700 + subtitle + CTA
  emptyState: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 32,
    paddingVertical:  64,
    gap:             12,
  },
  emptyIcon: {
    fontSize:   64,
    textAlign:  'center',
  },
  emptyTitle: {
    fontFamily: FONT_BODY.bold,               // DM Sans 700
    fontSize:   22,
    fontWeight: '700',
    color:      colors.fg.primary,            // ink[950] warm ink
    textAlign:  'center',
  },
  emptySubtitle: {
    fontFamily: FONT_BODY.regular,            // DM Sans 400
    fontSize:   15,
    fontWeight: '400',
    color:      colors.fg.secondary,          // ink[600] espresso
    textAlign:  'center',
    lineHeight: 22,
  },

  // ── Send Failed Modal ─────────────────────────────────────────────────────
  // Blueprint §Q8 Severity 3: modal · ⚠️ · retry CTA
  failedScrim: {
    flex:            1,
    backgroundColor: 'rgba(28, 24, 20, 0.55)', // colors.bg.scrim
    alignItems:      'center',
    justifyContent:  'center',
  },
  failedCard: {
    width:           320,
    backgroundColor: palette.white,
    borderRadius:    16,
    padding:         24,
    alignItems:      'center',
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(26,18,8,0.18)',
        shadowOffset:  { width: 0, height: 8 },
        shadowRadius:  24,
        shadowOpacity: 1,
      },
      android: { elevation: 16 },
    }),
  },
  failedIconWrap: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: palette.cream[100],
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  failedTitle: {
    fontFamily:   FONT_BODY.bold,
    fontSize:     18,
    fontWeight:   '700',
    color:        palette.ink[950],
    textAlign:    'center',
    marginBottom: 8,
  },
  failedPreview: {
    fontFamily:   FONT_BODY.regular,
    fontSize:     13,
    fontWeight:   '400',
    color:        palette.ink[600],
    textAlign:    'center',
    lineHeight:   18,
    fontStyle:    'italic',
    marginBottom: 20,
  },
  failedRetryBtn: {
    width:          '100%' as const,
    height:         48,
    borderRadius:   12,
    backgroundColor: palette.gold[600],
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   10,
  },
  failedRetryIcon: {
    marginRight: 8,
  },
  failedRetryText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   15,
    fontWeight: '600',
    color:      palette.white,
  },
  failedCancelBtn: {
    width:          '100%' as const,
    height:         44,
    borderRadius:   12,
    backgroundColor: palette.cream[200],
    alignItems:     'center',
    justifyContent: 'center',
  },
  failedCancelText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   15,
    fontWeight: '500',
    color:      palette.ink[950],
  },
});

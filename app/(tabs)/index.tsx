/**
 * CROWN — Home Screen (app/(tabs)/index.tsx)
 * PRD v3.2 FINAL · §9 App Architecture · §10 Home Screen · §19 Visual Design
 * Updated: PRD-compliant 3-row HomeHeader + Simple Fixed BottomNav
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * LAYOUT STACK (top → bottom):
 *   [1]  HomeHeader — 3 rows (136px total):
 *          Row 1 (56px): "CROWN" wordmark + 🔔 bell + 💬 DM icon
 *          Row 2 (48px): 4-Scope Switcher (World / Country / City / Sector)
 *                        → No track background (PRD v3.1 patch)
 *                        → Sliding gold capsule under active tab
 *          Row 3 (32px): Online strip — always names active scope geography
 *   [2]  Offline Banner (conditional · 32px)
 *   [3]  Inverted FlatList — 6 message variants + 8-skeleton state
 *   [4]  ScrollFAB — new-message chip (conditional)
 *   [5]  ChatInput — sticky above bottom nav (z:935)
 *   [6]  SimpleBottomNav — fixed full-width bar (§9.3 PRD)
 *          Tabs: Home · Explore · Crown · Profile
 *          NO floating glass island · NO backdrop-filter
 *          bg: --bg-surface (white) · border-top: 1px --border-subtle
 *
 * SHEETS / MODALS:
 *   CityPickerSheet     — tap active City scope button
 *   SectorPickerSheet   — tap active Sector scope button
 *   AuthGateSheet       — unauth write attempt (LAW 4)
 *   MessageActionSheet  — long-press any bubble
 *   SendFailedModal     — send failure recovery
 *
 * PRD LAWS ENFORCED:
 *   §9.2  — 3-row header · Row 2 no track bg (v3.1 patch)
 *   §9.3  — Simple fixed full-width bottom nav (not floating)
 *   §10.1 — Home screen anatomy locked
 *   §19.1 — "CROWN" wordmark (uppercase, Syne 700)
 *   §19.2 — Color tokens: bg-surface white, brand gold #D4A017
 *   Rule 03 — NO avatar in header (lives only in Profile tab)
 *
 * FIRESTORE:
 *   subscribeToMessages() — real-time chat stream (50 messages)
 *   subscribeToRoom()     — room metadata (onlineCount, heatScore)
 *   sendMessage()         — optimistic write with status lifecycle
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
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useRouter }             from 'expo-router';
import { Feather }               from '@expo/vector-icons';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

// ── Auth ──────────────────────────────────────────────────────────────────
import { useAuth }               from '@/contexts/AuthContext';

// ── Design tokens ─────────────────────────────────────────────────────────
import { colors, palette, zIndex, spacing } from '@/constants/colors';
import { layout }                            from '@/constants/spacing';
import { FONT_BODY, FONT_HEADING }           from '@/constants/typography';

// ── Components ────────────────────────────────────────────────────────────
import OnlineCountStrip           from '@/components/molecules/OnlineCountStrip';
import ChatInput                  from '@/components/molecules/ChatInput';
import MessageBubble              from '@/components/MessageBubble';
import CityPickerSheet            from '@/components/organisms/CityPickerSheet';
import SectorPickerSheet          from '@/components/organisms/SectorPickerSheet';
import { MessageActionSheet }     from '@/components/organisms/MessageActionSheet';
import { AuthGateSheet }          from '@/components/organisms/AuthGateSheet';
import ScrollFAB                  from '@/components/atoms/ScrollFAB';
import { SendFailedModal }         from '@/components/organisms/SendFailedModal';
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

const MESSAGE_PAGE_SIZE  = 50    as const;
const SKELETON_COUNT     = 8     as const;
const TRUST_ANCHOR_MS    = 60_000 as const;

const DEFAULT_CITY_ID      = 'chandigarh'  as const;
const DEFAULT_CITY_LABEL   = 'Chandigarh'  as const;
const DEFAULT_SECTOR_ID    = 'sector-17'   as const;
const DEFAULT_SECTOR_LABEL = 'Sector 17'   as const;

// PRD §19.2 — Brand color tokens (light mode)
const BRAND_GOLD   = '#D4A017' as const;   // --fg-brand
const BRAND_GOLD_L = '#F5C842' as const;   // --fg-brand-light
const TEXT_STRONG  = '#1A1A1A' as const;   // --fg-text-strong
const TEXT_MUTED   = '#6B5B2E' as const;   // --fg-text-muted
const BG_SURFACE   = '#FFFFFF' as const;   // --bg-surface
const BG_CARD      = '#F5E6C8' as const;   // --bg-card (cream bubbles)
const BORDER_SUBTLE = '#E8D5A0' as const;  // --border-subtle

// PRD §9.3 — Bottom nav height
const BOTTOM_NAV_HEIGHT = 56 as const;

/** Derive scope-aware roomId */
function buildRoomId(
  scope: ScopeKey,
  cityId: string,
  sectorId: string,
): string {
  switch (scope) {
    case 'world':   return 'world';
    case 'country': return 'india';       // default country
    case 'city':    return cityId;
    case 'sector':  return `${cityId}_${sectorId}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — LOCAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The 4 geographic scopes — PRD §9.1 / §10.1 */
type ScopeKey = 'world' | 'country' | 'city' | 'sector';

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
    case 'country': return `${n} India mein online`;
    case 'city':    return `${n} ${cityLabel} mein online`;
    case 'sector':  return `${n} ${sectorLabel} mein online`;
  }
}

/** PRD §10.1 — scope-aware input placeholder */
function getScopePlaceholder(
  scope: ScopeKey,
  cityLabel: string,
  sectorLabel: string,
): string {
  switch (scope) {
    case 'world':   return 'World ki chat mein message likho...';
    case 'country': return 'India ki chat mein message likho...';
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
// § 5 — HOME HEADER (PRD §9.2 — 3-row architecture)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PRD §9.2 Row 2 — 4-scope switcher
 * - 4 equal-width buttons: 🌍 World | 🇮🇳 India | 🏙️ City | 🏘️ Sector
 * - Active: gold sliding capsule + bold gold label
 * - Inactive: transparent bg, muted label
 * - NO track background strip (PRD v3.1 patch — removed)
 * - Single tap non-active → switch scope
 * - Tap already-active → open picker sheet (Country/City/Sector)
 */
interface ScopeSwitcherProps {
  activeScope:  ScopeKey;
  cityLabel:    string;
  sectorLabel:  string;
  onScopePress: (scope: ScopeKey) => void;
}

const SCOPE_TABS: Array<{ key: ScopeKey; icon: string; getLabel: (c: string, s: string) => string }> = [
  { key: 'world',   icon: '🌍', getLabel: () => 'World' },
  { key: 'country', icon: '🇮🇳', getLabel: () => 'India' },
  { key: 'city',    icon: '🏙️',  getLabel: (c) => c },
  { key: 'sector',  icon: '🏘️',  getLabel: (_, s) => s },
];

function ScopeSwitcher({
  activeScope,
  cityLabel,
  sectorLabel,
  onScopePress,
}: ScopeSwitcherProps) {
  const screenW    = Dimensions.get('window').width;
  const tabW       = screenW / SCOPE_TABS.length;
  const activeIdx  = SCOPE_TABS.findIndex((t) => t.key === activeScope);

  // Animated capsule X position — slides between tab positions
  const capsuleX   = useRef(new Animated.Value(activeIdx * tabW)).current;

  useEffect(() => {
    Animated.spring(capsuleX, {
      toValue:       activeIdx * tabW,
      useNativeDriver: true,
      tension:       200,
      friction:      22,
    }).start();
  }, [activeIdx, tabW, capsuleX]);

  return (
    <View
      style={[S.scopeRow, { width: screenW }]}
      accessibilityRole="tablist"
      testID="home-scope-switcher"
    >
      {/* PRD v3.1 — NO track background. Capsule only. */}
      <Animated.View
        style={[
          S.scopeCapsule,
          { width: tabW - 12, transform: [{ translateX: capsuleX }] },
        ]}
        pointerEvents="none"
      />

      {SCOPE_TABS.map((tab) => {
        const isActive = tab.key === activeScope;
        const label    = tab.getLabel(cityLabel, sectorLabel);
        return (
          <Pressable
            key={tab.key}
            style={S.scopeTab}
            onPress={() => onScopePress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${label} chat`}
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            testID={`scope-tab-${tab.key}`}
          >
            <Text style={S.scopeIcon} numberOfLines={1}>{tab.icon}</Text>
            <Text
              style={[S.scopeLabel, isActive && S.scopeLabelActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {/* PRD v3.1 — gold ▾ chevron only on active tab */}
            {isActive && (
              <Feather name="chevron-down" size={10} color={BRAND_GOLD} style={S.scopeChevron} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * PRD §9.2 Row 3 — Online count strip
 * Always names the geography of the currently-active scope.
 */
interface HomeOnlineStripProps {
  scope:          ScopeKey;
  cityLabel:      string;
  sectorLabel:    string;
  onlineCount:    number | null;
  heatScore:      number | null;
  loading:        boolean;
  showTrustAnchor: boolean;
  onTrustAnchorDismiss: () => void;
}

function HomeOnlineStrip({
  scope,
  cityLabel,
  sectorLabel,
  onlineCount,
  heatScore,
  loading,
  showTrustAnchor,
  onTrustAnchorDismiss,
}: HomeOnlineStripProps) {
  const label = loading
    ? '—'
    : getScopeOnlineLabel(scope, cityLabel, sectorLabel, onlineCount);

  return (
    <View style={S.onlineStrip} testID="home-online-strip">
      {/* Pulsing amber dot */}
      <View style={S.onlineDot} />

      {/* Scope-aware count text */}
      <Text style={S.onlineText} numberOfLines={1} accessibilityLiveRegion="polite">
        {label}
      </Text>

      {/* Heat score pill — PRD: visible when ≥ 30 */}
      {!loading && heatScore !== null && heatScore >= 30 && (
        <View style={S.heatPill}>
          <Text style={S.heatText}>🔥 Heat {heatScore}</Text>
        </View>
      )}

      {/* Trust anchor — PRD: visible first session, auto-hides after 60s */}
      {showTrustAnchor && (
        <TouchableOpacity
          style={S.trustAnchor}
          onPress={onTrustAnchorDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss trust anchor"
        >
          <Text style={S.trustText}>📍 1.2 Lakh+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * PRD §9.2 — 3-Row HomeHeader
 * Row 1 (56px): CROWN wordmark + notification bell + DM icon
 * Row 2 (48px): 4-scope switcher — PRD v3.1: no track background
 * Row 3 (32px): Online count strip — always names active scope
 *
 * Rule 03: NO avatar in this header (lives ONLY in Profile tab).
 */
interface HomeHeaderProps {
  activeScope:          ScopeKey;
  cityLabel:            string;
  sectorLabel:          string;
  onlineCount:          number | null;
  heatScore:            number | null;
  roomLoading:          boolean;
  unreadDmCount:        number;
  showTrustAnchor:      boolean;
  onScopePress:         (scope: ScopeKey) => void;
  onPressBell:          () => void;
  onPressDM:            () => void;
  onTrustAnchorDismiss: () => void;
}

function HomeHeader({
  activeScope,
  cityLabel,
  sectorLabel,
  onlineCount,
  heatScore,
  roomLoading,
  unreadDmCount,
  showTrustAnchor,
  onScopePress,
  onPressBell,
  onPressDM,
  onTrustAnchorDismiss,
}: HomeHeaderProps) {
  return (
    <View style={S.headerWrap} testID="home-header">
      {/* ── Row 1 — CROWN wordmark + Bell + DM (56px) ───────────── */}
      <View style={S.headerRow1}>
        {/* PRD §19.1 — "CROWN" uppercase · Syne 700 · brand gold */}
        <Text
          style={S.wordmark}
          accessibilityRole="header"
          accessibilityLabel="CROWN app"
        >
          CROWN
        </Text>

        {/* Right actions — bell + DM */}
        {/* Rule 03: NO user avatar here */}
        <View style={S.headerActions}>
          <TouchableOpacity
            style={S.headerActionBtn}
            onPress={onPressBell}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            testID="home-bell-btn"
          >
            <Feather name="bell" size={22} color={TEXT_STRONG} />
          </TouchableOpacity>

          <TouchableOpacity
            style={S.headerActionBtn}
            onPress={onPressDM}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={unreadDmCount > 0 ? `${unreadDmCount} unread DMs` : 'Direct messages'}
            accessibilityRole="button"
            testID="home-dm-btn"
          >
            <Feather name="message-circle" size={22} color={TEXT_STRONG} />
            {unreadDmCount > 0 && (
              <View style={S.dmBadge} accessibilityLabel={`${unreadDmCount} unread`}>
                <Text style={S.dmBadgeText}>
                  {unreadDmCount > 99 ? '99+' : unreadDmCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Row 2 — 4-Scope Switcher (48px) ────────────────────── */}
      {/* PRD v3.1: NO track background — capsule only */}
      <ScopeSwitcher
        activeScope={activeScope}
        cityLabel={cityLabel}
        sectorLabel={sectorLabel}
        onScopePress={onScopePress}
      />

      {/* ── Row 3 — Online Count Strip (32px) ───────────────────── */}
      <HomeOnlineStrip
        scope={activeScope}
        cityLabel={cityLabel}
        sectorLabel={sectorLabel}
        onlineCount={onlineCount}
        heatScore={heatScore}
        loading={roomLoading}
        showTrustAnchor={showTrustAnchor}
        onTrustAnchorDismiss={onTrustAnchorDismiss}
      />

      {/* Hairline separator below header */}
      <View style={S.headerDivider} />
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
    if (variant === 'ai')    return { isAI: true };
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
// § 7 — CHAT SKELETON (8 alternating shimmer bubbles)
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
// § 9 — SIMPLE BOTTOM NAV (PRD §9.3 — full-width, fixed, no glass)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PRD §9.3 — Simple Fixed Full-Width Bottom Navigation
 *
 * "No floating Glass Island. No 280px-wide pill hovering 20px above the safe area.
 *  The bottom nav is a simple, full-width, fixed bar — exactly like WhatsApp /
 *  Telegram / Instagram bottom nav. Predictable. Boring. Easy."
 *
 * - H: 56px + safe-area-inset-bottom
 * - W: 100% (full width, edge-to-edge)
 * - bg: --bg-surface (solid white)
 * - border-top: 1px --border-subtle
 * - border-radius: 0 (flush rectangle)
 * - No backdrop-filter, no transparency, no floating
 *
 * Tabs: Home · Explore · Crown · Profile
 * Active: gold icon + bold gold label
 * Inactive: muted icon + regular label
 */

const BOTTOM_TABS: Array<{
  key: BottomTab;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
}> = [
  { key: 'home',    icon: 'home',      label: 'Home'    },
  { key: 'explore', icon: 'compass',   label: 'Explore' },
  { key: 'crown',   icon: 'award',     label: 'Crown'   },
  { key: 'profile', icon: 'user',      label: 'Profile' },
];

interface SimpleBottomNavProps {
  activeTab:    BottomTab;
  onTabPress:   (tab: BottomTab) => void;
  bottomInset:  number;
}

function SimpleBottomNav({
  activeTab,
  onTabPress,
  bottomInset,
}: SimpleBottomNavProps) {
  return (
    <View
      style={[
        S.bottomNav,
        { paddingBottom: bottomInset, height: BOTTOM_NAV_HEIGHT + bottomInset },
      ]}
      accessibilityRole="tablist"
      testID="home-bottom-nav"
    >
      {BOTTOM_TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              S.bottomNavTab,
              pressed && S.bottomNavTabPressed,
            ]}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
            testID={`bottom-tab-${tab.key}`}
          >
            <Feather
              name={tab.icon}
              size={24}
              color={isActive ? BRAND_GOLD : TEXT_MUTED}
            />
            <Text
              style={[
                S.bottomNavLabel,
                isActive ? S.bottomNavLabelActive : S.bottomNavLabelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — MAIN HOME SCREEN
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

  // ── Scope (4-scope switcher — PRD §9.2 Row 2) ────────────────────────────
  const [activeScope, setActiveScope] = useState<ScopeKey>('sector');

  // ── Room ID — scope-aware ─────────────────────────────────────────────────
  const roomId = useMemo(
    () => buildRoomId(activeScope, cityId, sectorId),
    [activeScope, cityId, sectorId],
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
  const msgUnsubRef   = useRef<MsgUnsubscribe | null>(null);
  const roomUnsubRef  = useRef<RoomUnsubscribe | null>(null);
  const firstLoadRef  = useRef(true);

  // ── Bottom tab state (PRD §9.3) ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<BottomTab>('home');

  // ── User credits + DM count ───────────────────────────────────────────────
  const [userCredits,   setUserCredits]   = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.1 — FIRESTORE SUBSCRIPTIONS
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
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // § 10.2 — SEND MESSAGE (optimistic)
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
  // § 10.3 — FAILED MESSAGE RETRY
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
  // § 10.4 — AUTH GATE (LAW 4 — Peek-Before-Join)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAuthGate = useCallback(() => {
    setAuthSheetOpen(true);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.5 — LONG PRESS → MESSAGE ACTION SHEET
  // ═══════════════════════════════════════════════════════════════════════════

  const handleLongPress = useCallback((msg: CWMessage) => {
    const adapted = adaptToActionMsg(msg, user?.uid ?? null, cityId, sectorId);
    setActionMsg(adapted);
    setActionSheetOpen(true);
  }, [user?.uid, cityId, sectorId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.6 — SCROLL (ScrollFAB + hide trust anchor)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const scrolledUp = y > 80;
    if (scrolledUp !== isScrolledUp) setIsScrolledUp(scrolledUp);
    if (y > 20 && showTrustAnchor) setShowTrustAnchor(false);
  }, [isScrolledUp, showTrustAnchor]);

  const handleScrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgCount(0);
    setIsScrolledUp(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.7 — SCOPE PRESS (PRD §10.8 — single tap vs tap-when-active)
  //
  //   Single tap on non-active scope → switch scope
  //   Tap already-active 'city'    → open CityPickerSheet
  //   Tap already-active 'sector'  → open SectorPickerSheet
  //   Tap already-active 'country' → (future: country picker)
  //   Tap already-active 'world'   → no action (only one world room)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleScopePress = useCallback((scope: ScopeKey) => {
    if (scope !== activeScope) {
      // Switch to this scope
      setActiveScope(scope);
      return;
    }
    // Tap on already-active scope → open picker
    if (scope === 'city')    { setCitySheetOpen(true);   return; }
    if (scope === 'sector')  { setSectorSheetOpen(true); return; }
    // 'world' and 'country' — no picker in v1.0
  }, [activeScope]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.8 — CITY / SECTOR SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

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
  // § 10.9 — BOTTOM TAB PRESS (PRD §9.3.3)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTabPress = useCallback((tab: BottomTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      // Tapping Home while on Home → scroll to latest message
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    const routes: Record<string, string> = {
      explore: '/(tabs)/discover',
      crown:   '/(tabs)/ranks',
      profile: '/(tabs)/profile',
    };
    if (routes[tab]) router.push(routes[tab] as never);
  }, [router]);

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.10 — FLATLIST DATA (newest-first for inverted list)
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
  // § 10.11 — KAV OFFSET
  // PRD §9.2: Row1(56) + Row2(48) + Row3(32) = 136px + safeAreaTop
  // ═══════════════════════════════════════════════════════════════════════════

  const kavOffset = insets.top + 56 + 48 + 32;   // 136px header stack

  // ═══════════════════════════════════════════════════════════════════════════
  // § 10.12 — RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View style={S.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/*
       * ── [1] THREE-ROW HOME HEADER (PRD §9.2) ─────────────────────────────
       *
       * Row 1 (56px): "CROWN" wordmark (Syne 700, brand gold) + Bell + DM
       * Row 2 (48px): 4-Scope Switcher (World / India / City / Sector)
       *               PRD v3.1: NO track background — sliding capsule only
       * Row 3 (32px): Online count strip — names the active scope geography
       *
       * Rule 03: NO avatar here. Avatar is ONLY in Profile tab of bottom nav.
       */}
      <View style={{ paddingTop: insets.top, backgroundColor: BG_SURFACE }}>
        <HomeHeader
          activeScope={activeScope}
          cityLabel={cityLabel}
          sectorLabel={sectorLabel}
          onlineCount={room?.onlineCount ?? null}
          heatScore={room?.heatScore ?? null}
          roomLoading={roomLoading}
          unreadDmCount={unreadDmCount}
          showTrustAnchor={showTrustAnchor}
          onScopePress={handleScopePress}
          onPressBell={() => router.push('/notifications/index' as never)}
          onPressDM={() => router.push('/(tabs)/inbox' as never)}
          onTrustAnchorDismiss={() => setShowTrustAnchor(false)}
        />
      </View>

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
         *   'right'  — own message (gold fill, right-aligned)
         *   'left'   — other user (cream fill, left-aligned)
         *   'ai'     — AI companion (dotted ring, 🤖 AI pill)
         *   'mayor'  — Mayor announcement (gold left-accent)
         *   'system' — System event (centered chip)
         *   'date'   — Date separator (hairline chip)
         *
         * paddingBottom accounts for SimpleBottomNav (56px + insets.bottom)
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
              { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 72 },
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
            ListEmptyComponent={<ChatEmptyState sectorLabel={sectorLabel} />}
          />
        )}

        {/*
         * ── [4] SCROLL FAB (new messages chip) ────────────────────────────
         * Positioned above ChatInput and SimpleBottomNav.
         */}
        <ScrollFAB
          visible={isScrolledUp && newMsgCount > 0}
          label={newMsgCount > 0 ? `${newMsgCount} nayi messages` : 'New messages'}
          onPress={handleScrollToBottom}
        />

        {/*
         * ── [5] STICKY CHAT INPUT (z:935 · flush above SimpleBottomNav) ──
         *
         * Placeholder reflects active scope (PRD §10.1 note).
         * Rule 03: NO user avatar in this composer.
         * disabled=true when offline.
         */}
        <ChatInput
          onSend={handleSend}
          isAuthenticated={!!user}
          onAuthGate={handleAuthGate}
          placeholder={getScopePlaceholder(activeScope, cityLabel, sectorLabel)}
          disabled={isOffline}
        />
      </KeyboardAvoidingView>

      {/*
       * ── [6] SIMPLE BOTTOM NAV (PRD §9.3) ─────────────────────────────────
       *
       * PRD Founder mandate: "No floating Glass Island. The bottom nav is a
       * simple, full-width, fixed bar — exactly like WhatsApp / Telegram."
       *
       * - Full-width edge-to-edge
       * - 56px + safe-area-inset-bottom
       * - Solid white bg (--bg-surface)
       * - border-top: 1px --border-subtle
       * - NO backdrop-filter · NO transparency · NO border-radius
       *
       * Tabs: Home · Explore · Crown · Profile
       * Active: var(--fg-brand) gold icon + bold label
       * Inactive: var(--fg-text-muted) muted
       *
       * Rule 03: Profile tab shows avatar ONLY here (not in header)
       */}
      <SimpleBottomNav
        activeTab={activeTab}
        onTabPress={handleTabPress}
        bottomInset={insets.bottom}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SHEETS & MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      {/*
       * CITY PICKER SHEET
       * Triggered: tap already-active 'city' scope button (PRD §10.8)
       */}
      <CityPickerSheet
        visible={citySheetOpen}
        onClose={() => setCitySheetOpen(false)}
        selected={cityId}
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
// § 11 — STYLES
// PRD §19.2 color tokens. Zero hardcoded hex outside token constants above.
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const SCOPE_TAB_W = SCREEN_W / 4;

const S = StyleSheet.create({

  // ── Root screen ───────────────────────────────────────────────────────────
  // PRD §19.2: --bg-surface = #FFFFFF (white)
  screen: {
    flex:            1,
    backgroundColor: BG_SURFACE,           // #FFFFFF — PRD §19.2
  },

  // ── Offline Banner ────────────────────────────────────────────────────────
  offlineBanner: {
    height:            32,
    backgroundColor:   palette.ink[950],   // warm ink — dark bg
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.base,       // 16px
    zIndex:            zIndex.fixedHeader, // 900
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
    backgroundColor: BG_SURFACE,          // white
  },
  chatContent: {
    paddingHorizontal: spacing.sm,        // 8px
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

  // ══════════════════════════════════════════════════════════════════════════
  // HOME HEADER
  // ══════════════════════════════════════════════════════════════════════════

  headerWrap: {
    backgroundColor: BG_SURFACE,          // white
    width:           '100%',
  },

  // ── Row 1 — CROWN wordmark + Bell + DM (56px) ────────────────────────────
  headerRow1: {
    height:            56,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    backgroundColor:   BG_SURFACE,
  },

  // PRD §19.1 — CROWN wordmark: Syne 700 · brand gold · uppercase · -0.4px tracking
  wordmark: {
    fontFamily:    FONT_HEADING?.bold ?? 'System',
    fontSize:      24,
    fontWeight:    '700',
    color:         BRAND_GOLD,             // --fg-brand #D4A017
    letterSpacing: -0.4,
    textTransform: 'uppercase',
  },

  headerActions: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
  },
  headerActionBtn: {
    width:          44,                   // Apple HIG min 44pt touch target
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  // DM badge (unread count)
  dmBadge: {
    position:        'absolute',
    top:             6,
    right:           4,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: palette.crimson[600], // #C4294F
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  dmBadgeText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   10,
    fontWeight: '600',
    color:      palette.white,
    lineHeight: 12,
  },

  // ── Row 2 — Scope Switcher (48px) ─────────────────────────────────────────
  // PRD v3.1: NO background track — capsule only over white surface
  scopeRow: {
    height:          48,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: BG_SURFACE,          // transparent over white — PRD v3.1
    position:        'relative',
    overflow:        'hidden',
  },

  // Gold sliding capsule — active tab indicator
  // PRD v3.1: "sirf sliding capsule (active indicator) hi bacha"
  // box-shadow: 0 1px 8px rgba(24,15,4,0.12), 0 0 0 1px rgba(200,144,10,0.15)
  scopeCapsule: {
    position:        'absolute',
    top:             6,
    height:          36,
    marginLeft:      6,
    borderRadius:    18,                  // pill shape
    backgroundColor: palette.gold[50],   // very light gold tint (#FCF7E5)
    borderWidth:     1,
    borderColor:     `rgba(200, 144, 10, 0.20)`, // subtle gold ring (PRD spec)
    // Shadow approximation in RN:
    shadowColor:     '#18100C',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.12,
    shadowRadius:    4,
    elevation:       2,
  },

  scopeTab: {
    flex:           1,
    height:         48,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap:            1,
  },

  scopeIcon: {
    fontSize:   14,
    lineHeight: 18,
  },

  scopeLabel: {
    fontFamily:  FONT_BODY.medium,
    fontSize:    11,
    fontWeight:  '500',
    color:       TEXT_MUTED,             // inactive: muted
    lineHeight:  14,
  },
  scopeLabelActive: {
    color:       BRAND_GOLD,             // active: brand gold
    fontWeight:  '600',
  },
  scopeChevron: {
    marginTop: -1,
    opacity:   0.7,
  },

  // ── Row 3 — Online Strip (32px) ───────────────────────────────────────────
  onlineStrip: {
    height:            32,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    gap:               8,
    backgroundColor:   BG_SURFACE,
  },

  // Amber pulsing dot (presence indicator)
  onlineDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: palette.amber[600],  // #D4651A — burnished amber
  },

  onlineText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   12,
    fontWeight: '500',
    color:      TEXT_MUTED,
    flex:       1,
  },

  // Heat score pill (visible when score ≥ 30)
  heatPill: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      10,
    backgroundColor:   palette.amber[50], // light amber tint
  },
  heatText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   11,
    fontWeight: '600',
    color:      palette.amber[700],
  },

  // Trust anchor chip (first session · auto-hides 60s)
  trustAnchor: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      10,
    backgroundColor:   palette.gold[50],  // FCF7E5
  },
  trustText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   11,
    fontWeight: '600',
    color:      TEXT_MUTED,
  },

  // Hairline below header
  headerDivider: {
    height:          1,
    backgroundColor: BORDER_SUBTLE,      // #E8D5A0
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SIMPLE BOTTOM NAV (PRD §9.3)
  // ══════════════════════════════════════════════════════════════════════════

  // PRD §9.3.1 spec:
  //   position: fixed · bottom: 0 · left/right: 0 (full width)
  //   height: 56px + safe-area
  //   bg: --bg-surface solid (white)
  //   border-top: 1px --border-subtle
  //   border-radius: 0 (flush rectangle)
  //   NO backdrop-filter, NO transparency, NO floating
  bottomNav: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'stretch',
    backgroundColor:   BG_SURFACE,       // solid white — PRD §19.2
    borderTopWidth:    1,
    borderTopColor:    BORDER_SUBTLE,    // 1px --border-subtle
    borderRadius:      0,                // PRD §9.3: flush rectangle
    zIndex:            950,
    // Very subtle elevation — PRD §9.3.1: "0 -1px 0 rgba(0,0,0,0.04)"
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -1 },
    shadowOpacity:     0.04,
    shadowRadius:      0,
    elevation:         8,
  },

  // PRD §9.3.2 — each tab = 25% width, column flex, icon + label centered
  bottomNavTab: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingTop:        8,
    paddingBottom:     4,
    paddingHorizontal: 4,
    gap:               2,
    minHeight:         44,               // Apple HIG touch target minimum
  },
  bottomNavTabPressed: {
    opacity: 0.7,
  },

  // PRD §9.3.2 — 11px Inter 500
  bottomNavLabel: {
    fontSize:   11,
    lineHeight: 14,
  },
  bottomNavLabelActive: {
    fontFamily: FONT_BODY.semibold,
    fontWeight: '600',
    color:      BRAND_GOLD,             // --fg-brand active
  },
  bottomNavLabelInactive: {
    fontFamily: FONT_BODY.regular,
    fontWeight: '400',
    color:      TEXT_MUTED,             // --fg-text-muted inactive
  },
});

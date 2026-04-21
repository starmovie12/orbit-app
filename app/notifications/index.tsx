/**
 * ORBIT — Notifications Screen
 * Route: /notifications/index (or tab link)
 *
 * Displays and groups all notification events for the current user:
 *   • mention       — @mention in a room or post
 *   • dm            — new direct message received
 *   • challenge     — challenge result (won / ranked / entered)
 *   • credit        — credits earned (watch reward, challenge prize, gift)
 *   • karma         — karma change (increase / decrease)
 *
 * Grouping: Today · Yesterday · Earlier (by Firestore timestamp)
 *
 * Firestore:
 *   /notifications/{uid}/items/{notifId}
 *   Fields: type, title, body, read, createdAt, meta{}
 *
 * Falls back to mock data when empty / signed-out.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Avatar, ScreenHeader } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import type { FeatherIconName } from '@/components/shared';

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type NotifType = 'mention' | 'dm' | 'challenge' | 'credit' | 'karma';

type NotifItem = {
  id:        string;
  type:      NotifType;
  title:     string;
  body:      string;
  read:      boolean;
  createdAt: any;          // Firestore Timestamp | Date | null
  meta: {
    route?:       string;  // deeplink target e.g. /room/[id], /dm/[id]
    delta?:       number;  // karma delta (+ / -)
    credits?:     number;  // credits earned
    fromName?:    string;  // sender display name
    rank?:        number;  // challenge rank
  };
};

type Group = {
  title: string;
  data:  NotifItem[];
};

/* ─────────────────────────────────────────────────────────────────────
   Mock fallback data
───────────────────────────────────────────────────────────────────── */

const now   = Date.now();
const H     = 3_600_000;
const DAY   = 86_400_000;

const MOCK_NOTIFS: NotifItem[] = [
  {
    id:        'm1',
    type:      'mention',
    title:     'ghost_player mentioned you',
    body:      '@you bhai check this track out in Music Junction',
    read:      false,
    createdAt: new Date(now - 12 * 60_000),
    meta:      { route: '/room/4', fromName: 'ghost_player' },
  },
  {
    id:        'm2',
    type:      'dm',
    title:     'New message from Priya Singh',
    body:      'Thanks for the feedback on my design!',
    read:      false,
    createdAt: new Date(now - 45 * 60_000),
    meta:      { route: '/dm/d2', fromName: 'Priya Singh' },
  },
  {
    id:        'm3',
    type:      'karma',
    title:     'Karma earned',
    body:      'Your post in Startup Circle got 12 upvotes',
    read:      false,
    createdAt: new Date(now - 1.5 * H),
    meta:      { delta: 36 },
  },
  {
    id:        'm4',
    type:      'credit',
    title:     'Credits earned',
    body:      'You watched 3 sponsored posts and earned credits',
    read:      true,
    createdAt: new Date(now - 3 * H),
    meta:      { credits: 15 },
  },
  {
    id:        'm5',
    type:      'challenge',
    title:     'Challenge result — Best Desi Rap Verse',
    body:      'You placed #3 in this week\'s challenge. Great work!',
    read:      true,
    createdAt: new Date(now - 6 * H),
    meta:      { route: '/challenges/c1', rank: 3 },
  },
  {
    id:        'm6',
    type:      'mention',
    title:     'sk_promo99 mentioned you',
    body:      '@you your pitch is solid, connect karte hain',
    read:      true,
    createdAt: new Date(now - DAY + 2 * H),
    meta:      { route: '/room/6', fromName: 'sk_promo99' },
  },
  {
    id:        'm7',
    type:      'dm',
    title:     'New message from Dev Nair',
    body:      'Bhai collab karte hain is weekend?',
    read:      true,
    createdAt: new Date(now - DAY + H),
    meta:      { route: '/dm/d5', fromName: 'Dev Nair' },
  },
  {
    id:        'm8',
    type:      'credit',
    title:     'Challenge prize received',
    body:      'You won the Photography challenge — 750 credits deposited',
    read:      true,
    createdAt: new Date(now - DAY - 2 * H),
    meta:      { credits: 750, route: '/credits' },
  },
  {
    id:        'm9',
    type:      'karma',
    title:     'Karma adjustment',
    body:      'A post was removed by moderators — karma deducted',
    read:      true,
    createdAt: new Date(now - DAY - 4 * H),
    meta:      { delta: -20 },
  },
  {
    id:        'm10',
    type:      'challenge',
    title:     'Challenge Won! 🏆',
    body:      'You won the Startup Pitch (60s) challenge. 2000 credits incoming.',
    read:      true,
    createdAt: new Date(now - 2 * DAY),
    meta:      { route: '/challenges/c4', rank: 1, credits: 2000 },
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function snapExists(snap: any): boolean {
  if (typeof snap.exists === 'function') return snap.exists();
  return !!snap.exists;
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate() as Date;
  if (ts instanceof Date) return ts;
  return null;
}

function dateGroup(ts: any): 'today' | 'yesterday' | 'earlier' {
  const d = tsToDate(ts);
  if (!d) return 'earlier';
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today.getTime() - DAY);
  if (d >= today)     return 'today';
  if (d >= yesterday) return 'yesterday';
  return 'earlier';
}

function fmtTime(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diff < 2 * 86_400_000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function groupNotifs(items: NotifItem[]): Group[] {
  const todayGroup:     NotifItem[] = [];
  const yesterdayGroup: NotifItem[] = [];
  const earlierGroup:   NotifItem[] = [];

  for (const n of items) {
    const g = dateGroup(n.createdAt);
    if      (g === 'today')     todayGroup.push(n);
    else if (g === 'yesterday') yesterdayGroup.push(n);
    else                        earlierGroup.push(n);
  }

  const groups: Group[] = [];
  if (todayGroup.length > 0)     groups.push({ title: 'Today',     data: todayGroup });
  if (yesterdayGroup.length > 0) groups.push({ title: 'Yesterday', data: yesterdayGroup });
  if (earlierGroup.length > 0)   groups.push({ title: 'Earlier',   data: earlierGroup });
  return groups;
}

/* ─────────────────────────────────────────────────────────────────────
   Notif icon + color config
───────────────────────────────────────────────────────────────────── */

type NotifMeta = {
  icon:    FeatherIconName;
  color:   string;
  bgColor: string;
};

function notifMeta(type: NotifType, delta?: number): NotifMeta {
  switch (type) {
    case 'mention':
      return { icon: 'at-sign',       color: orbit.accent,   bgColor: orbit.accentSoft };
    case 'dm':
      return { icon: 'message-circle',color: orbit.accent,   bgColor: orbit.accentSoft };
    case 'challenge':
      return { icon: 'award',         color: orbit.warning,  bgColor: orbit.warningSoft };
    case 'credit':
      return { icon: 'dollar-sign',   color: orbit.success,  bgColor: orbit.successSoft };
    case 'karma':
      return delta != null && delta < 0
        ? { icon: 'trending-down', color: orbit.danger,  bgColor: orbit.dangerSoft }
        : { icon: 'trending-up',   color: orbit.success, bgColor: orbit.successSoft };
    default:
      return { icon: 'bell',          color: orbit.textSecond, bgColor: orbit.surface2 };
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Unread count pill
───────────────────────────────────────────────────────────────────── */

function UnreadPill({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.unreadPill}>
      <Text style={styles.unreadPillText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Notification Row
───────────────────────────────────────────────────────────────────── */

function NotifRow({
  item,
  onPress,
  onMarkRead,
}: {
  item:       NotifItem;
  onPress:    (n: NotifItem) => void;
  onMarkRead: (id: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(item.read ? 0 : 1)).current;
  const meta     = notifMeta(item.type, item.meta.delta);

  function handlePress() {
    if (!item.read) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      onMarkRead(item.id);
    }
    onPress(item);
  }

  return (
    <TouchableOpacity
      style={styles.notifRow}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {/* Unread indicator */}
      <Animated.View
        style={[
          styles.unreadDot,
          { opacity: fadeAnim },
        ]}
      />

      {/* Icon box */}
      <View style={[styles.notifIconBox, { backgroundColor: meta.bgColor }]}>
        <Feather name={meta.icon} size={16} color={meta.color} />
      </View>

      {/* Content */}
      <View style={styles.notifContent}>
        <View style={styles.notifTitleRow}>
          <Text
            style={[
              styles.notifTitle,
              !item.read && { color: orbit.textPrimary, fontWeight: '600' },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.notifTime}>{fmtTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>

        {/* Inline meta chips */}
        {item.type === 'credit' && item.meta.credits != null && (
          <View style={styles.notifChipRow}>
            <View style={[styles.notifChip, { backgroundColor: orbit.successSoft }]}>
              <Feather name="dollar-sign" size={10} color={orbit.success} />
              <Text style={[styles.notifChipText, { color: orbit.success }]}>
                +{item.meta.credits} credits
              </Text>
            </View>
          </View>
        )}
        {item.type === 'karma' && item.meta.delta != null && (
          <View style={styles.notifChipRow}>
            <View
              style={[
                styles.notifChip,
                {
                  backgroundColor:
                    item.meta.delta < 0 ? orbit.dangerSoft : orbit.successSoft,
                },
              ]}
            >
              <Feather
                name={item.meta.delta < 0 ? 'trending-down' : 'trending-up'}
                size={10}
                color={item.meta.delta < 0 ? orbit.danger : orbit.success}
              />
              <Text
                style={[
                  styles.notifChipText,
                  { color: item.meta.delta < 0 ? orbit.danger : orbit.success },
                ]}
              >
                {item.meta.delta > 0 ? '+' : ''}{item.meta.delta} karma
              </Text>
            </View>
          </View>
        )}
        {item.type === 'challenge' && item.meta.rank != null && (
          <View style={styles.notifChipRow}>
            <View style={[styles.notifChip, { backgroundColor: orbit.warningSoft }]}>
              <Feather name="award" size={10} color={orbit.warning} />
              <Text style={[styles.notifChipText, { color: orbit.warning }]}>
                #{item.meta.rank} place
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Group Header
───────────────────────────────────────────────────────────────────── */

function GroupHeader({ title }: { title: string }) {
  return (
    <View style={styles.groupHeader}>
      <Text style={styles.groupHeaderText}>{title}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Filter Pills
───────────────────────────────────────────────────────────────────── */

const FILTER_OPTIONS: { label: string; value: NotifType | 'all' }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Mentions',  value: 'mention'   },
  { label: 'Messages',  value: 'dm'        },
  { label: 'Karma',     value: 'karma'     },
  { label: 'Credits',   value: 'credit'    },
  { label: 'Challenges',value: 'challenge' },
];

function FilterPills({
  active,
  onChange,
}: {
  active:   string;
  onChange: (v: NotifType | 'all') => void;
}) {
  return (
    <View style={styles.filterRow}>
      {FILTER_OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.filterPill,
            active === opt.value && styles.filterPillActive,
          ]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterPillText,
              active === opt.value && styles.filterPillTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Empty State
───────────────────────────────────────────────────────────────────── */

function EmptyState({ filter }: { filter: string }) {
  const msg =
    filter === 'all'
      ? 'No notifications yet'
      : `No ${filter} notifications`;
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Feather name="bell-off" size={28} color={orbit.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{msg}</Text>
      <Text style={styles.emptySubtitle}>
        Stay active in rooms and challenges to get notified.
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [notifs,  setNotifs]  = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<NotifType | 'all'>('all');
  const [usingMock, setUsingMock] = useState(false);

  const myUid = firebaseUser?.uid ?? null;

  /* ── Subscribe to Firestore notifications ── */
  useEffect(() => {
    if (!myUid) {
      setNotifs(MOCK_NOTIFS);
      setUsingMock(true);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;

    try {
      unsub = firestore()
        .collection('notifications')
        .doc(myUid)
        .collection('items')
        .orderBy('createdAt', 'desc')
        .limit(60)
        .onSnapshot(
          snap => {
            if (snap.empty) {
              setNotifs(MOCK_NOTIFS);
              setUsingMock(true);
            } else {
              const docs: NotifItem[] = snap.docs.map(d => ({
                id:        d.id,
                type:      (d.data().type ?? 'mention') as NotifType,
                title:     d.data().title  ?? '',
                body:      d.data().body   ?? '',
                read:      d.data().read   ?? false,
                createdAt: d.data().createdAt,
                meta:      d.data().meta   ?? {},
              }));
              setNotifs(docs);
              setUsingMock(false);
            }
            setLoading(false);
          },
          () => {
            setNotifs(MOCK_NOTIFS);
            setUsingMock(true);
            setLoading(false);
          }
        );
    } catch {
      setNotifs(MOCK_NOTIFS);
      setUsingMock(true);
      setLoading(false);
    }

    return () => unsub?.();
  }, [myUid]);

  /* ── Mark single notification read ── */
  const markRead = useCallback(async (id: string) => {
    setNotifs(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    if (!myUid || usingMock) return;
    try {
      await firestore()
        .collection('notifications')
        .doc(myUid)
        .collection('items')
        .doc(id)
        .update({ read: true });
    } catch {}
  }, [myUid, usingMock]);

  /* ── Mark all read ── */
  const markAllRead = useCallback(async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    if (!myUid || usingMock) return;
    try {
      const unread = notifs.filter(n => !n.read);
      const batch  = firestore().batch();
      for (const n of unread) {
        const ref = firestore()
          .collection('notifications')
          .doc(myUid)
          .collection('items')
          .doc(n.id);
        batch.update(ref, { read: true });
      }
      await batch.commit();
    } catch {}
  }, [myUid, usingMock, notifs]);

  /* ── Navigation on press ── */
  const handleNotifPress = useCallback((n: NotifItem) => {
    const route = n.meta?.route;
    if (route) {
      router.push(route as never);
    }
  }, [router]);

  /* ── Derived data ── */
  const filtered   = filter === 'all' ? notifs : notifs.filter(n => n.type === filter);
  const groups     = groupNotifs(filtered);
  const unreadAll  = notifs.filter(n => !n.read).length;

  /* ── Flat list data: interleave group headers + items ── */
  type FlatItem =
    | { kind: 'header'; title: string; key: string }
    | { kind: 'notif';  notif: NotifItem; key: string };

  const flatData: FlatItem[] = [];
  for (const g of groups) {
    flatData.push({ kind: 'header', title: g.title, key: `h_${g.title}` });
    for (const n of g.data) {
      flatData.push({ kind: 'notif', notif: n, key: n.id });
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        right={
          unreadAll > 0 ? (
            <TouchableOpacity
              onPress={markAllRead}
              style={styles.markAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* ── Filter pills ── */}
      <FilterPills active={filter} onChange={setFilter} />

      {/* ── Unread summary bar ── */}
      {unreadAll > 0 && filter === 'all' && (
        <View style={styles.unreadBar}>
          <Feather name="bell" size={13} color={orbit.accent} />
          <Text style={styles.unreadBarText}>
            {unreadAll} unread notification{unreadAll !== 1 ? 's' : ''}
          </Text>
          <UnreadPill count={unreadAll} />
        </View>
      )}

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={orbit.accent} size="large" />
        </View>
      ) : flatData.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={item => item.key}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return <GroupHeader title={item.title} />;
            }
            return (
              <NotifRow
                item={item.notif}
                onPress={handleNotifPress}
                onMarkRead={markRead}
              />
            );
          }}
          ItemSeparatorComponent={({ leadingItem }) =>
            leadingItem?.kind === 'notif' ? (
              <View style={styles.rowDivider} />
            ) : null
          }
          initialNumToRender={20}
          windowSize={10}
        />
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.bg },

  markAllBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  markAllText: {
    color: orbit.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Filter ── */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: orbit.accent,
    borderColor: orbit.accent,
  },
  filterPillText: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: orbit.white,
    fontWeight: '600',
  },

  /* ── Unread bar ── */
  unreadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: orbit.accentSoft,
    borderRadius: 10,
  },
  unreadBarText: {
    flex: 1,
    color: orbit.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  unreadPill: {
    backgroundColor: orbit.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadPillText: {
    color: orbit.white,
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── List ── */
  listContent: { paddingTop: 4 },

  /* ── Group header ── */
  groupHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  groupHeaderText: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* ── Notification row ── */
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: orbit.accent,
    marginTop: 6,
    flexShrink: 0,
  },
  notifIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 3,
  },
  notifTitle: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
  },
  notifTime: {
    color: orbit.textTertiary,
    fontSize: 11,
    flexShrink: 0,
    marginTop: 1,
  },
  notifBody: {
    color: orbit.textTertiary,
    fontSize: 13,
    lineHeight: 18,
  },

  /* ── Chips ── */
  notifChipRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  notifChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  notifChipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Divider ── */
  rowDivider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
    marginLeft: 71, // align with text content
  },

  /* ── Loading ── */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Empty ── */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: orbit.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: orbit.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});

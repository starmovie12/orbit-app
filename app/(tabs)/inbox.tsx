/**
 * ORBIT — Inbox Tab (inbox.tsx)
 *
 * Upgraded from mock → live Firestore.
 *
 * Changes:
 *   • Subscribes to /dmThreads where participants array-contains current uid
 *     via subscribeMyThreads() — newest activity first.
 *   • Unread badge = thread.unread[uid] counter from Firestore.
 *   • Presence dot = online field on the other user's profile shard
 *     (Phase 1 = last-seen within 2 min; Phase 2 = Realtime DB presence).
 *   • Navigates to /dm/[threadId] on row tap.
 *   • Falls back to INBOX_CHATS mock when user is not signed in or
 *     dmThreads returns empty (first launch / no conversations yet).
 *   • markThreadRead() called when user opens a thread (deferred to
 *     dm/[id].tsx — inbox only shows badge, does not reset it).
 *
 * Firestore shape consumed (from lib/firestore-dms.ts):
 *   DMThreadDoc {
 *     id, participants[], participantProfiles{uid → {username, emoji, color}},
 *     lastMessagePreview, lastMessageAt, lastMessageUid, unread{uid→n}, createdAt
 *   }
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  ReadStatus,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeMyThreads, type DMThreadDoc } from '@/lib/firestore-dms';
import { INBOX_CHATS } from '@/constants/data';

/* ─── Types ─────────────────────────────────────────────────────────── */

/** Unified view model — maps both live Firestore docs and mock chats. */
type ChatVM = {
  id: string;            // threadId (real) or mock id
  name: string;          // other user's username
  preview: string;
  time: string;
  unread: number;
  status: 'sent' | 'delivered' | 'read' | 'received';
  online: boolean;
  isMine: boolean;       // last message was sent by me
};

/* ─── Helpers ───────────────────────────────────────────────────────── */

function fmtTime(ts: any): string {
  if (!ts) return '';
  const d: Date | null =
    typeof ts?.toDate === 'function' ? ts.toDate() :
    ts instanceof Date ? ts : null;
  if (!d) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

/**
 * Convert a live Firestore DMThreadDoc → ChatVM.
 * `myUid` is needed to resolve the "other" participant's profile and unread count.
 */
function threadToVM(thread: DMThreadDoc, myUid: string): ChatVM {
  const otherUid    = thread.participants.find(p => p !== myUid) ?? '';
  const otherProfile = thread.participantProfiles?.[otherUid];
  const name        = otherProfile?.username ?? otherUid.slice(0, 12);
  const unread      = thread.unread?.[myUid] ?? 0;
  const isMine      = thread.lastMessageUid === myUid;

  // Infer read-status from unread counter + sender
  let status: ChatVM['status'] = 'received';
  if (isMine) {
    status = unread === 0 ? 'read' : 'delivered';
  } else {
    status = unread > 0 ? 'received' : 'read';
  }

  return {
    id: thread.id,
    name,
    preview: thread.lastMessagePreview || '…',
    time: fmtTime(thread.lastMessageAt),
    unread,
    status,
    online: false,   // Phase 2: pull from RTDB presence node
    isMine,
  };
}

/** Convert INBOX_CHATS mock → ChatVM so the renderer is unified. */
function mockToVM(m: typeof INBOX_CHATS[0]): ChatVM {
  return {
    id: m.id,
    name: m.name,
    preview: m.preview,
    time: m.time,
    unread: m.unread,
    status: m.status as ChatVM['status'],
    online: m.online,
    isMine: m.status === 'read' || m.status === 'delivered',
  };
}

/* ─── Sub-components ────────────────────────────────────────────────── */

/** Total unread pill shown in the header (sum of all thread unreads). */
function TotalUnreadPill({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.totalUnreadPill}>
      <Text style={styles.totalUnreadText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function EmptyInbox() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Feather name="message-circle" size={28} color={orbit.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a conversation from someone's profile or in a room.
      </Text>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────── */

export default function InboxScreen() {
  const insets       = useSafeAreaInsets();
  const router       = useRouter();
  const { user, firebaseUser } = useAuth();

  const [search, setSearch]   = useState('');
  const [threads, setThreads] = useState<DMThreadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setMock]  = useState(false);

  const myUid = firebaseUser?.uid ?? null;

  /* ── Subscribe to Firestore /dmThreads ── */
  useEffect(() => {
    if (!myUid) {
      // Not signed in — use mock data immediately
      setMock(true);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;

    try {
      unsub = subscribeMyThreads(myUid, (liveThreads) => {
        if (liveThreads.length === 0 && threads.length === 0) {
          // No threads yet — show mock so the screen isn't blank on first launch
          setMock(true);
        } else {
          setThreads(liveThreads);
          setMock(false);
        }
        setLoading(false);
      });
    } catch {
      setMock(true);
      setLoading(false);
    }

    return () => unsub?.();
  }, [myUid]);

  /* ── Derive view models ── */
  const chatVMs: ChatVM[] = useMemo(() => {
    if (usingMock || !myUid) {
      return INBOX_CHATS.map(mockToVM);
    }
    return threads.map(t => threadToVM(t, myUid));
  }, [threads, myUid, usingMock]);

  const filtered = chatVMs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.preview.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = chatVMs.reduce((sum, c) => sum + c.unread, 0);

  /* ── Row renderer ── */
  const renderChat = ({ item }: { item: ChatVM }) => (
    <TouchableOpacity
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={() => router.push(`/dm/${item.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${item.name}${item.unread > 0 ? `, ${item.unread} unread` : ''}`}
    >
      {/* Avatar with presence indicator */}
      <Avatar name={item.name} size={44} online={item.online} />

      <View style={styles.listBody}>
        {/* Name row */}
        <View style={styles.listNameRow}>
          <Text
            style={[
              styles.listName,
              item.unread > 0 && styles.listNameUnread,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.listTime}>{item.time}</Text>
        </View>

        {/* Preview + unread badge row */}
        <View style={styles.listPreviewRow}>
          <View style={styles.dmPreviewRow}>
            {/* Tick marks — only shown when the message was sent by me */}
            {item.isMine && (
              <ReadStatus state={item.status as any} />
            )}
            <Text
              style={[
                styles.listPreview,
                item.unread > 0 && styles.listPreviewUnread,
              ]}
              numberOfLines={1}
            >
              {item.preview}
            </Text>
          </View>

          {/* Unread count badge */}
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread > 99 ? '99+' : item.unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Inbox"
        right={
          <View style={styles.headerRight}>
            {/* Compose new DM button */}
            <TouchableOpacity
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="New message"
              onPress={() => { /* TODO: open user search / compose sheet */ }}
            >
              <Feather name="edit" size={20} color={orbit.textSecond} />
            </TouchableOpacity>
            <TotalUnreadPill count={totalUnread} />
          </View>
        }
      />

      <SearchBar
        placeholder="Search messages..."
        value={search}
        onChangeText={setSearch}
      />

      {/* Loading state */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={orbit.textTertiary} />
        </View>
      )}

      {/* Mock data notice */}
      {!loading && usingMock && (
        <View style={styles.demoNotice}>
          <Feather name="info" size={12} color={orbit.textTertiary} />
          <Text style={styles.demoNoticeText}>
            Sample conversations — start chatting to see real DMs
          </Text>
        </View>
      )}

      {/* Chat list */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <EmptyInbox />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={i => i.id}
              renderItem={renderChat}
              ItemSeparatorComponent={Divider}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomPad }}
              // Optimizations
              removeClippedSubviews
              maxToRenderPerBatch={12}
              windowSize={8}
              getItemLayout={(_, index) => ({
                length: 72,
                offset: 72 * index,
                index,
              })}
            />
          )}
        </>
      )}
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalUnreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: orbit.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  totalUnreadText: {
    color: orbit.white,
    fontSize: 10,
    fontWeight: '700',
  },

  /* Section label */
  sectionLabelRow: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* Chat row */
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    minHeight: 72,
  },
  listBody: { flex: 1 },
  listNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  listName: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  listNameUnread: {
    fontWeight: '700',
  },
  listTime: {
    color: orbit.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },
  listPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dmPreviewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listPreview: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 18,
  },
  listPreviewUnread: {
    color: orbit.textPrimary,
    fontWeight: '500',
  },

  /* Unread badge */
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: orbit.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: orbit.white,
    fontSize: 11,
    fontWeight: '700',
  },

  /* Demo notice banner */
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: orbit.surface2,
    borderRadius: 8,
  },
  demoNoticeText: {
    flex: 1,
    color: orbit.textTertiary,
    fontSize: 12,
  },

  /* Loading */
  loadingWrap: {
    paddingTop: 48,
    alignItems: 'center',
  },

  /* Empty state */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: orbit.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

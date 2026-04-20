/**
 * ORBIT — Rooms tab
 *
 * Changes from v1 (mock) → v2 (Firestore):
 *   • Rooms section now reads live from /rooms collection.
 *   • DM section reads live from /dmThreads where I'm a participant.
 *   • Tapping a row navigates to /room/{id} or /dm/{threadId}.
 *   • Falls back to the existing mock data when the user is not yet
 *     signed in (happens during the splash → guard transition).
 *
 * Keeps the original visual layout pixel-for-pixel — only wires up data
 * sources and adds onPress handlers.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ROOMS as MOCK_ROOMS, DM_CHATS as MOCK_DMS } from '@/constants/data';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  ReadStatus,
  IconBox,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeRooms, type RoomDoc } from '@/lib/firestore-rooms';
import { subscribeMyThreads, type DMThreadDoc } from '@/lib/firestore-dms';

/* ─────────────────────────────────────────────────────────────────────
   View models — shape rooms.tsx originally rendered. We map both the
   live Firestore docs and the mock fallback into this shape so the
   renderers don't have to branch.
───────────────────────────────────────────────────────────────────── */

type RoomVM = {
  id: string;
  icon: string;
  accent: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  online: number;
  muted: boolean;
  isLive: boolean;
  typing?: string;
};

type DMVM = {
  id: string;                           // threadId
  name: string;                         // other user's username
  preview: string;
  time: string;
  unread: number;
  status: 'sent' | 'delivered' | 'read' | 'received';
  online: boolean;
};

/* ─────────────────────────────────────────────────────────────────────
   Time formatter — Firestore Timestamp → short relative label.
───────────────────────────────────────────────────────────────────── */
function fmtTime(ts: any): string {
  if (!ts) return '';
  const d: Date | null =
    typeof ts?.toDate === 'function' ? ts.toDate() :
    ts instanceof Date ? ts :
    null;
  if (!d) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
  const yesterday = new Date(now - 86_400_000).toDateString();
  if (d.toDateString() === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

/* ─────────────────────────────────────────────────────────────────────
   Sub-components (unchanged styling)
───────────────────────────────────────────────────────────────────── */

function LiveDot() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

function RoomItem({ item, onPress }: { item: RoomVM; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={onPress}>
      <IconBox icon={item.icon as any} size={44} tint={item.accent} variant="circle" />

      <View style={styles.listBody}>
        <View style={styles.listNameRow}>
          <Text style={styles.listName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isLive ? <LiveDot /> : (
            <Text style={styles.listTime}>{item.time}</Text>
          )}
        </View>
        <View style={styles.listPreviewRow}>
          {item.typing ? (
            <Text style={styles.typingText}>{item.typing} typing…</Text>
          ) : (
            <Text style={styles.listPreview} numberOfLines={1}>
              {item.preview}
            </Text>
          )}
          {item.unread > 0 && (
            <View
              style={[
                styles.unreadBadge,
                { backgroundColor: item.muted ? orbit.surface3 : orbit.accent },
              ]}
            >
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DMItem({ item, onPress }: { item: DMVM; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={onPress}>
      <Avatar name={item.name} size={44} online={item.online} />

      <View style={styles.listBody}>
        <View style={styles.listNameRow}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.listTime}>{item.time}</Text>
        </View>
        <View style={styles.listPreviewRow}>
          <View style={styles.dmPreviewRow}>
            <ReadStatus state={item.status as any} />
            <Text style={styles.listPreview} numberOfLines={1}>
              {item.preview}
            </Text>
          </View>
          {item.unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: orbit.accent }]}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { firebaseUser, user } = useAuth();
  const myUid = firebaseUser?.uid ?? null;

  const [search, setSearch] = useState('');
  const [rooms, setRooms] = useState<RoomVM[] | null>(null);
  const [dms, setDMs] = useState<DMVM[] | null>(null);

  /* Live rooms — shown to everyone, signed-in or not. */
  useEffect(() => {
    const unsub = subscribeRooms((list: RoomDoc[]) => {
      const vm: RoomVM[] = list.map((r) => ({
        id: r.id,
        icon: r.icon,
        accent: r.accent,
        name: r.name,
        preview: r.lastMessagePreview || 'No messages yet',
        time: fmtTime(r.lastMessageAt),
        unread: 0,                        // per-room unread lands in Batch 2
        online: r.memberCount,
        muted: false,
        isLive: r.isLive,
      }));
      setRooms(vm);
    });
    return unsub;
  }, []);

  /* Live DM threads for me. */
  useEffect(() => {
    if (!myUid) { setDMs([]); return; }
    const unsub = subscribeMyThreads(myUid, (list: DMThreadDoc[]) => {
      const vm: DMVM[] = list.map((t) => {
        const otherUid = t.participants.find((p) => p !== myUid) ?? '';
        const other = t.participantProfiles?.[otherUid];
        const unread = t.unread?.[myUid] ?? 0;
        const isMine = t.lastMessageUid === myUid;
        return {
          id: t.id,
          name: other?.username ?? 'Unknown',
          preview: t.lastMessagePreview || 'Say hi 👋',
          time: fmtTime(t.lastMessageAt),
          unread,
          status: isMine ? 'delivered' : 'received',
          online: false,               // presence lands in Batch 4
        };
      });
      setDMs(vm);
    });
    return unsub;
  }, [myUid]);

  /* Fallback to mock when collections are still empty or user not loaded.
     Lets the UI feel alive on first launch before the seed runs. */
  const roomsForRender: RoomVM[] = useMemo(() => {
    if (rooms && rooms.length > 0) return rooms;
    if (rooms === null) return MOCK_ROOMS as unknown as RoomVM[]; // still loading
    return MOCK_ROOMS as unknown as RoomVM[];                      // empty → show mock
  }, [rooms]);

  const dmsForRender: DMVM[] = useMemo(() => {
    if (dms && dms.length > 0) return dms;
    // When signed in and no threads yet → empty (fair). When signed out, show mock.
    if (!myUid) return MOCK_DMS as unknown as DMVM[];
    return [];
  }, [dms, myUid]);

  const filteredRooms = roomsForRender.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDMs = dmsForRender.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const sections = [
    { title: 'GROUP ROOMS', data: filteredRooms, type: 'room' as const },
    { title: 'DIRECT MESSAGES', data: filteredDMs, type: 'dm' as const },
  ].filter(s => s.data.length > 0);

  const totalUnread =
    roomsForRender.reduce((a, r) => a + (r.unread ?? 0), 0) +
    dmsForRender.reduce((a, d) => a + (d.unread ?? 0), 0);
  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  const openRoom = (id: string) => router.push(`/room/${id}` as never);
  const openDM   = (id: string) => router.push(`/dm/${id}` as never);

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Rooms"
        right={
          <>
            {totalUnread > 0 && (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{totalUnread}</Text>
              </View>
            )}
            <TouchableOpacity hitSlop={8} accessibilityRole="button" accessibilityLabel="New message">
              <Feather name="edit" size={20} color={orbit.textSecond} />
            </TouchableOpacity>
          </>
        }
      />
      <SearchBar
        placeholder="Search rooms, DMs..."
        value={search}
        onChangeText={setSearch}
      />

      <TouchableOpacity activeOpacity={0.85} style={styles.spotlightBar}>
        <View style={styles.spotlightLeft}>
          <Feather name="star" size={14} color={orbit.warning} style={{ marginRight: 8 }} />
          <Text style={styles.spotlightText}>
            Spotlight live · Gaming Lounge · 38m left
          </Text>
        </View>
        <View style={styles.spotlightRight}>
          <Text style={styles.spotlightBid}>Bid</Text>
          <Feather name="arrow-right" size={13} color={orbit.warning} style={{ marginLeft: 4 }} />
        </View>
      </TouchableOpacity>

      <SectionList
        sections={sections}
        keyExtractor={(i: any) => i.id}
        renderItem={({ item, section }) =>
          section.type === 'room'
            ? <RoomItem item={item as RoomVM} onPress={() => openRoom((item as RoomVM).id)} />
            : <DMItem item={item as DMVM} onPress={() => openDM((item as DMVM).id)} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        ItemSeparatorComponent={Divider}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        stickySectionHeadersEnabled
      />

      {/* FAB — new room / new DM (§5.4) */}
      <TouchableOpacity
        style={[styles.fab, { bottom: (Platform.OS === 'web' ? 90 : insets.bottom + 76) }]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Start a new chat or room"
      >
        <Feather name="plus" size={22} color={orbit.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
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
    fontWeight: '600',
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
  listPreview: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 18,
  },
  dmPreviewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    flex: 1,
    color: orbit.accent,
    fontSize: 14,
    fontStyle: 'italic',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: orbit.white,
    fontSize: 11,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.danger,
  },
  liveText: {
    color: orbit.danger,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  spotlightBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
  },
  spotlightLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  spotlightText: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  spotlightRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotlightBid: {
    color: orbit.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: orbit.bg,
  },
  sectionHeaderText: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  totalBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: orbit.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  totalBadgeText: {
    color: orbit.white,
    fontSize: 11,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: orbit.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});

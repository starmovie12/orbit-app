import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { ROOMS, DM_CHATS } from '@/constants/data';
import { ScreenHeader, SearchBar, Divider, Ticks } from '@/components/shared';

type Room = typeof ROOMS[0];
type DM = typeof DM_CHATS[0];

function LiveBadge() {
  const colors = useColors();
  return (
    <View style={[styles.liveBadge, { backgroundColor: '#EF4444' }]}>
      <Text style={styles.liveBadgeText}>LIVE</Text>
    </View>
  );
}

function RoomItem({ item }: { item: Room }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.background }]}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        <View style={[
          styles.avatar,
          {
            backgroundColor: item.isLive ? '#EF444422' : item.color + '22',
            borderColor: item.isLive ? '#EF4444' : item.color + '44',
            borderWidth: item.isLive ? 2 : 1,
          }
        ]}>
          <Text style={styles.avatarEmoji}>{item.emoji}</Text>
        </View>
        {!item.isLive && (
          <View style={[styles.onlineDot, { backgroundColor: colors.green, borderColor: colors.background }]} />
        )}
      </View>

      <View style={styles.listBody}>
        <View style={styles.listNameRow}>
          <Text style={[styles.listName, { color: item.isLive ? '#EF4444' : colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isLive ? <LiveBadge /> : (
            <Text style={[styles.listTime, { color: colors.mutedForeground }]}>{item.time}</Text>
          )}
        </View>
        <View style={styles.listPreviewRow}>
          {item.typing ? (
            <View style={styles.typingRow}>
              <Text style={[styles.typingDots, { color: colors.blueLight }]}>• • •</Text>
              <Text style={[styles.typingText, { color: colors.blueLight }]}>{item.typing} typing…</Text>
            </View>
          ) : (
            <Text
              style={[
                styles.listPreview,
                { color: item.isLive ? colors.blueLight : colors.sub }
              ]}
              numberOfLines={1}
            >
              {item.preview}
            </Text>
          )}
          {item.unread > 0 && (
            <View style={[
              styles.unreadBadge,
              { backgroundColor: item.muted ? colors.mutedForeground : colors.primary },
            ]}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
        {!item.isLive && (
          <Text style={[styles.onlineCount, { color: colors.green }]}>
            🟢 {item.online.toLocaleString()} online
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function DMItem({ item }: { item: DM }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.background }]}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        {item.online && (
          <View style={[styles.onlineDot, { backgroundColor: colors.green, borderColor: colors.background }]} />
        )}
      </View>

      <View style={styles.listBody}>
        <View style={styles.listNameRow}>
          <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.listTime, { color: colors.mutedForeground }]}>{item.time}</Text>
        </View>
        <View style={styles.listPreviewRow}>
          <View style={styles.dmPreviewRow}>
            <Ticks state={item.ticks} />
            <Text style={[styles.listPreview, { color: colors.sub }]} numberOfLines={1}>
              {item.preview}
            </Text>
          </View>
          {item.unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RoomsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filteredRooms = ROOMS.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDMs = DM_CHATS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const sections = [
    { title: 'GROUP ROOMS', data: filteredRooms, type: 'room' as const },
    { title: 'DIRECT MESSAGES', data: filteredDMs, type: 'dm' as const },
  ].filter(s => s.data.length > 0);

  const totalUnread = ROOMS.reduce((a, r) => a + r.unread, 0) + DM_CHATS.reduce((a, d) => a + d.unread, 0);
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Rooms"
        right={
          totalUnread > 0 ? (
            <View style={[styles.totalBadge, { backgroundColor: colors.red }]}>
              <Text style={styles.totalBadgeText}>{totalUnread}</Text>
            </View>
          ) : undefined
        }
      />
      <SearchBar
        placeholder="Search rooms, DMs..."
        value={search}
        onChangeText={setSearch}
      />

      <View style={[styles.spotlightBar, { backgroundColor: colors.gold + '18', borderColor: colors.gold + '44' }]}>
        <Text style={[styles.spotlightText, { color: colors.gold }]}>
          ⭐ Spotlight Live · Gaming Lounge · 38 min left
        </Text>
        <TouchableOpacity>
          <Text style={[styles.spotlightBid, { color: colors.gold }]}>Bid →</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={({ item, section }) =>
          section.type === 'room'
            ? <RoomItem item={item as Room} />
            : <DMItem item={item as DM} />
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.surface2, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.sub }]}>
              {section.title}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={Divider}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
        stickySectionHeadersEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatarWrap: {
    position: 'relative',
    width: 50,
    height: 50,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 24 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  listBody: { flex: 1 },
  listNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  listName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  listTime: { fontSize: 11 },
  listPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listPreview: { fontSize: 13, flex: 1 },
  dmPreviewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  onlineCount: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typingDots: { fontSize: 14, letterSpacing: 2 },
  typingText: { fontSize: 13, fontStyle: 'italic' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  liveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  spotlightBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  spotlightText: { fontSize: 12, fontWeight: '600', flex: 1 },
  spotlightBid: { fontSize: 12, fontWeight: '700' },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  sectionHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  totalBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  totalBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

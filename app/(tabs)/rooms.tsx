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
import { Feather } from '@expo/vector-icons';
import { ROOMS, DM_CHATS } from '@/constants/data';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  ReadStatus,
  IconBox,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';

type Room = typeof ROOMS[0];
type DM = typeof DM_CHATS[0];

function LiveDot() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

function RoomItem({ item }: { item: Room }) {
  return (
    <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
      <IconBox icon={item.icon} size={44} tint={item.accent} variant="circle" />

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

function DMItem({ item }: { item: DM }) {
  return (
    <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
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

export default function RoomsScreen() {
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
  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

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
            <TouchableOpacity hitSlop={8}>
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
        keyExtractor={i => i.id}
        renderItem={({ item, section }) =>
          section.type === 'room'
            ? <RoomItem item={item as Room} />
            : <DMItem item={item as DM} />
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
    fontSize: 13,
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
    fontSize: 13,
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

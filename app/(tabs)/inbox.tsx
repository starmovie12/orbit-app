import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { INBOX_CHATS } from '@/constants/data';
import { ScreenHeader, SearchBar, Divider, Ticks } from '@/components/shared';

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filtered = INBOX_CHATS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderChat = ({ item }: { item: typeof INBOX_CHATS[0] }) => {
    const initials = item.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2);

    return (
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: colors.background }]}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
            <Text style={[styles.avatarInitials, { color: item.color }]}>{initials}</Text>
          </View>
          {item.online && (
            <View style={[styles.onlineDot, { backgroundColor: colors.green, borderColor: colors.background }]} />
          )}
        </View>

        <View style={styles.listBody}>
          <View style={styles.listNameRow}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.listTime, { color: colors.mutedForeground }]}>{item.time}</Text>
          </View>
          <View style={styles.listPreviewRow}>
            <View style={styles.previewLeft}>
              <Ticks state={item.ticks} />
              <Text style={[styles.listPreview, { color: colors.sub }]} numberOfLines={1}>
                {item.ticks !== 'none' ? ' ' : ''}{item.preview}
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
  };

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Inbox" />
      <SearchBar
        placeholder="Search messages..."
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderChat}
        ItemSeparatorComponent={Divider}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
      />

      <TouchableOpacity
        style={[styles.composeFab, { backgroundColor: colors.primary, bottom: bottomPad + 20 }]}
        activeOpacity={0.85}
      >
        <Text style={styles.composeFabIcon}>✏️</Text>
      </TouchableOpacity>
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
  avatarInitials: { fontSize: 18, fontWeight: '700' },
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
  previewLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  listPreview: { fontSize: 13, flex: 1 },
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
  composeFab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  composeFabIcon: { fontSize: 22 },
});

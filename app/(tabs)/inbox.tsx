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
import { Feather } from '@expo/vector-icons';
import { INBOX_CHATS } from '@/constants/data';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  ReadStatus,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filtered = INBOX_CHATS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderChat = ({ item }: { item: typeof INBOX_CHATS[0] }) => (
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
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
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
          <TouchableOpacity hitSlop={8}>
            <Feather name="edit" size={20} color={orbit.textSecond} />
          </TouchableOpacity>
        }
      />
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
        contentContainerStyle={{ paddingBottom: bottomPad }}
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
  dmPreviewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listPreview: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 13,
    lineHeight: 18,
  },
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

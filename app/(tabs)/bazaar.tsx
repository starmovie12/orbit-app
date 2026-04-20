import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BAZAAR_GIGS, BAZAAR_CATEGORIES } from '@/constants/data';
import { ScreenHeader, SearchBar, IconBox } from '@/components/shared';
import { orbit } from '@/constants/colors';

function GigCard({ item }: { item: typeof BAZAAR_GIGS[0] }) {
  return (
    <TouchableOpacity style={styles.gigCard} activeOpacity={0.85}>
      <View style={styles.gigTop}>
        <IconBox icon={item.icon} size={48} />
        <View style={styles.gigInfo}>
          <Text style={styles.gigTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.gigSeller}>by @{item.seller}</Text>
          <View style={styles.gigMeta}>
            <Feather name="star" size={11} color={orbit.warning} />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            <Text style={styles.gigReviews}>({item.reviews})</Text>
            <Text style={styles.gigDot}>·</Text>
            <Text style={styles.gigDelivery}>{item.delivery}</Text>
          </View>
        </View>
      </View>

      <View style={styles.gigTagRow}>
        {item.tags.map((tag, i) => (
          <View key={i} style={styles.gigTag}>
            <Text style={styles.gigTagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.gigBottom}>
        <View>
          <Text style={styles.gigPriceLabel}>STARTING AT</Text>
          <Text style={styles.gigPrice}>₹{item.price.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.gigContactBtn} activeOpacity={0.85}>
          <Text style={styles.gigContactText}>Contact</Text>
          <Feather name="arrow-right" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function BazaarScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeCategory, setCategory] = useState('All');

  const filtered = BAZAAR_GIGS.filter(g => {
    const matchCat = activeCategory === 'All' || g.category === activeCategory;
    const matchSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.seller.toLowerCase().includes(search.toLowerCase()) ||
      g.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Bazaar"
        right={
          <TouchableOpacity style={styles.postBtn} activeOpacity={0.85}>
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.postBtnText}>Post Gig</Text>
          </TouchableOpacity>
        }
      />
      <SearchBar
        placeholder="Search skills, designers, devs..."
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryRow}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 8 }}
      >
        {BAZAAR_CATEGORIES.map(cat => {
          const active = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryPill, active && styles.categoryPillActive]}
              onPress={() => setCategory(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.resultCount}>
        {filtered.length} {filtered.length === 1 ? 'gig' : 'gigs'} found
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <GigCard item={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryRow: { flexGrow: 0 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  categoryPillActive: {
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    borderColor: orbit.accent,
  },
  categoryPillText: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: orbit.accent,
    fontWeight: '600',
  },
  resultCount: {
    color: orbit.textTertiary,
    fontSize: 11,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  /* Gig card */
  gigCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 16,
  },
  gigTop: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  gigInfo: { flex: 1 },
  gigTitle: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
  },
  gigSeller: {
    color: orbit.textSecond,
    fontSize: 12,
    marginBottom: 6,
  },
  gigMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: orbit.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  gigReviews: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  gigDot: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  gigDelivery: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  gigTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  gigTag: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gigTagText: {
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: '500',
  },
  gigBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  gigPriceLabel: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  gigPrice: {
    color: orbit.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  gigContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  gigContactText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

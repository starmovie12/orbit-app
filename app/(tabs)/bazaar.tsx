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
import { useColors } from '@/hooks/useColors';
import { BAZAAR_GIGS, BAZAAR_CATEGORIES } from '@/constants/data';
import { ScreenHeader, SearchBar, Divider } from '@/components/shared';

function StarRating({ rating }: { rating: number }) {
  const colors = useColors();
  return (
    <View style={styles.starRow}>
      <Text style={styles.starIcon}>⭐</Text>
      <Text style={[styles.ratingText, { color: colors.gold }]}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function GigCard({ item }: { item: typeof BAZAAR_GIGS[0] }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.gigCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={styles.gigTop}>
        <View style={[styles.gigIcon, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
          <Text style={styles.gigIconEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.gigInfo}>
          <Text style={[styles.gigTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.gigSeller, { color: colors.sub }]}>by @{item.seller}</Text>
          <View style={styles.gigMeta}>
            <StarRating rating={item.rating} />
            <Text style={[styles.gigReviews, { color: colors.mutedForeground }]}>({item.reviews})</Text>
            <Text style={[styles.gigDelivery, { color: colors.mutedForeground }]}>· {item.delivery}</Text>
          </View>
        </View>
      </View>

      <View style={styles.gigTagRow}>
        {item.tags.map((tag, i) => (
          <View key={i} style={[styles.gigTag, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.gigTagText, { color: colors.sub }]}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.gigBottom}>
        <View>
          <Text style={[styles.gigPriceLabel, { color: colors.mutedForeground }]}>Starting at</Text>
          <Text style={[styles.gigPrice, { color: colors.green }]}>₹{item.price}</Text>
        </View>
        <TouchableOpacity style={[styles.gigContactBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
          <Text style={styles.gigContactText}>Contact →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function BazaarScreen() {
  const colors = useColors();
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

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Skill Bazaar"
        right={
          <TouchableOpacity style={[styles.postBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={styles.postBtnText}>+ Post Gig</Text>
          </TouchableOpacity>
        }
      />
      <SearchBar
        placeholder="Search skills, designers, devs..."
        value={search}
        onChangeText={setSearch}
      />

      <View style={[styles.heroBanner, { backgroundColor: colors.blueLight + '18', borderColor: colors.blueLight + '33' }]}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          💼 Desi Talent Marketplace
        </Text>
        <Text style={[styles.heroSub, { color: colors.sub }]}>
          Hire or sell skills · UPI payouts · 15% platform fee
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryRow}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
      >
        {BAZAAR_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryPill,
              { backgroundColor: colors.surface2, borderColor: colors.border },
              activeCategory === cat && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setCategory(cat)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.categoryPillText,
              { color: colors.sub },
              activeCategory === cat && { color: '#fff' },
            ]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Divider indent={false} />

      <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
        {filtered.length} gigs found
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <GigCard item={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  postBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  heroBanner: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  heroSub: { fontSize: 12 },
  categoryRow: { flexGrow: 0 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: { fontSize: 12, fontWeight: '600' },
  resultCount: {
    fontSize: 11,
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 12,
    paddingTop: 4,
  },
  gigCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  gigTop: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  gigIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gigIconEmoji: { fontSize: 26 },
  gigInfo: { flex: 1 },
  gigTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 2 },
  gigSeller: { fontSize: 12, marginBottom: 4 },
  gigMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starIcon: { fontSize: 10 },
  ratingText: { fontSize: 12, fontWeight: '700' },
  gigReviews: { fontSize: 11 },
  gigDelivery: { fontSize: 11 },
  gigTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  gigTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  gigTagText: { fontSize: 10, fontWeight: '600' },
  gigBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gigPriceLabel: { fontSize: 10, marginBottom: 1 },
  gigPrice: { fontSize: 20, fontWeight: '800' },
  gigContactBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gigContactText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

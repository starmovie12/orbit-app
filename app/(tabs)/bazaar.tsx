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
import { ScreenHeader, SearchBar } from '@/components/shared';
import { orbit } from '@/constants/colors';

function GigCard({ item }: { item: typeof BAZAAR_GIGS[0] }) {
  return (
    <TouchableOpacity
      style={styles.gigCard}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} by ${item.seller}, starting at ₹${item.price}`}
    >
      {/* Cover area — icon on surface2, 16:10 aspect */}
      <View style={styles.gigCover}>
        <Feather name={item.icon as any} size={28} color={orbit.textSecond} />
      </View>

      <View style={styles.gigBody}>
        <Text style={styles.gigTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.gigSellerRow}>
          <View style={styles.gigSellerAvatar}>
            <Text style={styles.gigSellerAvatarText}>
              {item.seller.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.gigSeller} numberOfLines={1}>@{item.seller}</Text>
        </View>

        <View style={styles.gigMeta}>
          <Feather name="star" size={11} color={orbit.warning} />
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          <Text style={styles.gigReviews}>({item.reviews})</Text>
        </View>

        <View style={styles.gigPricePill}>
          <Text style={styles.gigPriceText}>₹{item.price.toLocaleString()}</Text>
        </View>
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
            <Feather name="plus" size={14} color={orbit.white} />
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
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
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
    color: orbit.white,
    fontSize: 14,
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

  /* Gig card — 2-column grid optimized */
  gigCard: {
    flex: 1,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gigCover: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gigBody: {
    padding: 12,
  },
  gigTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 8,
    minHeight: 38,
  },
  gigSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  gigSellerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: orbit.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gigSellerAvatarText: {
    color: orbit.white,
    fontSize: 9,
    fontWeight: '700',
  },
  gigSeller: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
  },
  gigMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
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
  gigPricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gigPriceText: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

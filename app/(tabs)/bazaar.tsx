/**
 * ORBIT — Bazaar Tab (bazaar.tsx)
 *
 * Upgraded: mock BAZAAR_GIGS → live Firestore /bazaar collection.
 *
 * Features:
 *   • Subscribes to /bazaar (orderBy createdAt desc, limit 30)
 *   • Falls back to BAZAAR_GIGS mock when Firestore is empty / offline
 *   • Category filter pills + search (title, seller, tags)
 *   • "Post Gig" CTA in header → karma gate (≥ 50 required)
 *   • KarmaGateSheet — explains gate, shows current karma, how to earn more
 *   • CreateListingSheet — BottomSheet with full form (title, category,
 *     price, delivery, description) — writes to /bazaar on submit
 *   • Two-column card grid layout preserved
 *
 * Firestore /bazaar/{listingId} schema (blueprint §07):
 *   title:    string
 *   priceINR: number
 *   category: string           ← matches BAZAAR_CATEGORIES
 *   author:   { uid, username, karma, trust }   ← denormalized
 *   tags:     string[]         ← max 3
 *   rating:   number           ← 0 until first review
 *   reviews:  number
 *   delivery: string           ← "Same day" | "1 day" | "2 days" | "3 days"
 *   icon:     string           ← Feather icon name
 *   createdAt: Timestamp
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore, serverTimestamp } from '@/lib/firebase';
import { BAZAAR_GIGS, BAZAAR_CATEGORIES } from '@/constants/data';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const COLLECTION = 'bazaar';
const KARMA_GATE = 50;
const DELIVERY_OPTIONS = ['Same day', '1 day', '2 days', '3 days'];

/** Feather icon mapped to each category — keeps the grid consistent. */
const CATEGORY_ICONS: Record<string, string> = {
  Design:   'pen-tool',
  Dev:      'code',
  Writing:  'edit-3',
  Social:   'trending-up',
  Video:    'film',
  Audio:    'mic',
  Business: 'bar-chart-2',
  All:      'briefcase',
};

/* ─── Types ─────────────────────────────────────────────────────────────── */

type BazaarDoc = {
  id: string;
  title: string;
  priceINR: number;
  category: string;
  author: { uid: string; username: string; karma: number; trust: number };
  tags: string[];
  rating: number;
  reviews: number;
  delivery: string;
  icon: string;
  coverImage?: string;
  createdAt: unknown;
};

type CreateForm = {
  title: string;
  category: string;
  price: string;
  delivery: string;
  description: string;
  tags: string;
};

const EMPTY_FORM: CreateForm = {
  title:       '',
  category:    'Design',
  price:       '',
  delivery:    '1 day',
  description: '',
  tags:        '',
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function mockToGigDoc(g: typeof BAZAAR_GIGS[0]): BazaarDoc {
  return {
    id:       g.id,
    title:    g.title,
    priceINR: g.price,
    category: g.category,
    author:   { uid: `mock_${g.seller}`, username: g.seller, karma: 1000, trust: 80 },
    tags:     g.tags,
    rating:   g.rating,
    reviews:  g.reviews,
    delivery: g.delivery,
    icon:     g.icon,
    createdAt: null,
  };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function GigCard({ item }: { item: BazaarDoc }) {
  return (
    <TouchableOpacity
      style={styles.gigCard}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} by ${item.author.username}, starting at ₹${item.priceINR}`}
    >
      {/* Cover placeholder — Feather icon centred in 16:10 area */}
      <View style={styles.gigCover}>
        <View style={styles.gigCoverInner}>
          <Feather name={item.icon as any} size={28} color={orbit.textSecond} />
        </View>
        {/* Category tag top-right */}
        <View style={styles.gigCategoryTag}>
          <Text style={styles.gigCategoryTagText}>{item.category}</Text>
        </View>
      </View>

      <View style={styles.gigBody}>
        <Text style={styles.gigTitle} numberOfLines={2}>{item.title}</Text>

        {/* Seller row */}
        <View style={styles.gigSellerRow}>
          <Avatar name={item.author.username} size={20} />
          <Text style={styles.gigSeller} numberOfLines={1}>
            @{item.author.username}
          </Text>
        </View>

        {/* Star + rating */}
        <View style={styles.gigMeta}>
          <Feather name="star" size={11} color={orbit.warning} />
          <Text style={styles.ratingText}>
            {item.rating > 0 ? item.rating.toFixed(1) : 'New'}
          </Text>
          {item.reviews > 0 && (
            <Text style={styles.gigReviews}>({item.reviews})</Text>
          )}
          <Text style={styles.gigDot}>·</Text>
          <Feather name="clock" size={11} color={orbit.textTertiary} />
          <Text style={styles.gigDelivery}>{item.delivery}</Text>
        </View>

        {/* Price + tags */}
        <View style={styles.gigFooter}>
          <View style={styles.gigPricePill}>
            <Text style={styles.gigPriceText}>₹{item.priceINR.toLocaleString()}</Text>
          </View>
          {item.tags.slice(0, 1).map(tag => (
            <View key={tag} style={styles.gigTagPill}>
              <Text style={styles.gigTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ── Karma Gate Sheet ── */
function KarmaGateSheet({
  visible,
  onClose,
  currentKarma,
}: {
  visible: boolean;
  onClose: () => void;
  currentKarma: number;
}) {
  const needed = Math.max(0, KARMA_GATE - currentKarma);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Karma Gate">
      <View style={styles.gateWrap}>
        {/* Karma progress visual */}
        <View style={styles.gateCircleRow}>
          <View style={styles.gateCircle}>
            <Text style={styles.gateCircleNum}>{currentKarma}</Text>
            <Text style={styles.gateCircleLbl}>your karma</Text>
          </View>
          <Feather name="arrow-right" size={20} color={orbit.textTertiary} />
          <View style={[styles.gateCircle, styles.gateCircleTarget]}>
            <Text style={[styles.gateCircleNum, { color: orbit.accent }]}>
              {KARMA_GATE}
            </Text>
            <Text style={styles.gateCircleLbl}>required</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.gateBarBg}>
          <View
            style={[
              styles.gateBarFill,
              { width: `${Math.min(100, (currentKarma / KARMA_GATE) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.gateProgressText}>
          {needed > 0
            ? `${needed} more karma chahiye to post a gig`
            : 'Karma requirement met!'}
        </Text>

        {/* How to earn */}
        <View style={styles.gateHowTitle}>
          <Text style={styles.gateHowTitleText}>Karma kaise earn karein</Text>
        </View>
        {[
          { icon: 'message-circle', label: 'Rooms mein helpful replies karo', pts: '+5' },
          { icon: 'play',           label: 'Discover posts watch karo',        pts: '+2' },
          { icon: 'users',          label: 'Friends ko invite karo',           pts: '+10' },
          { icon: 'award',          label: 'Weekly challenge jeet',            pts: '+50' },
        ].map(item => (
          <View key={item.icon} style={styles.gateHowRow}>
            <View style={styles.gateHowIcon}>
              <Feather name={item.icon as any} size={16} color={orbit.accent} />
            </View>
            <Text style={styles.gateHowLabel}>{item.label}</Text>
            <Text style={styles.gateHowPts}>{item.pts}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.gateCloseBtn}
          onPress={onClose}
          activeOpacity={0.85}
        >
          <Text style={styles.gateCloseBtnText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

/* ── Create Listing Sheet ── */
function CreateListingSheet({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (form: CreateForm) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const categories = BAZAAR_CATEGORIES.filter(c => c !== 'All');

  const set = (key: keyof CreateForm, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof CreateForm, string>> = {};
    if (!form.title.trim() || form.title.trim().length < 5) {
      e.title = 'Title kam se kam 5 characters ka hona chahiye';
    }
    const p = Number(form.price);
    if (!form.price || isNaN(p) || p < 1) {
      e.price = 'Valid price daalo (₹1 minimum)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(form);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Post a Gig"
      preventBackdropDismiss={submitting}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>GIG TITLE</Text>
            <View style={[
              styles.textInputBox,
              errors.title ? styles.textInputError : null,
            ]}>
              <TextInput
                style={styles.textInput}
                value={form.title}
                onChangeText={v => set('title', v)}
                placeholder="e.g. Professional Logo Design"
                placeholderTextColor={orbit.textTertiary}
                maxLength={80}
              />
            </View>
            {errors.title && (
              <Text style={styles.fieldError}>{errors.title}</Text>
            )}
          </View>

          {/* Category pills */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.formPill,
                    form.category === cat && styles.formPillActive,
                  ]}
                  onPress={() => set('category', cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.formPillText,
                    form.category === cat && styles.formPillTextActive,
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Price */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>PRICE (₹)</Text>
            <View style={[
              styles.textInputBox,
              styles.textInputRow,
              errors.price ? styles.textInputError : null,
            ]}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={form.price}
                onChangeText={v => set('price', v.replace(/[^0-9]/g, ''))}
                placeholder="500"
                placeholderTextColor={orbit.textTertiary}
                keyboardType="number-pad"
                maxLength={7}
              />
            </View>
            {errors.price && (
              <Text style={styles.fieldError}>{errors.price}</Text>
            )}
          </View>

          {/* Delivery time */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>DELIVERY TIME</Text>
            <View style={styles.deliveryRow}>
              {DELIVERY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.deliveryPill,
                    form.delivery === opt && styles.deliveryPillActive,
                  ]}
                  onPress={() => set('delivery', opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.deliveryPillText,
                    form.delivery === opt && styles.deliveryPillTextActive,
                  ]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>TAGS (comma separated, max 3)</Text>
            <View style={styles.textInputBox}>
              <TextInput
                style={styles.textInput}
                value={form.tags}
                onChangeText={v => set('tags', v)}
                placeholder="Logo, Branding, Figma"
                placeholderTextColor={orbit.textTertiary}
                maxLength={60}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>DESCRIPTION (optional)</Text>
            <View style={[styles.textInputBox, { height: 100, alignItems: 'flex-start' }]}>
              <TextInput
                style={[styles.textInput, { height: 92, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form.description}
                onChangeText={v => set('description', v)}
                placeholder="Apne gig ke baare mein batao..."
                placeholderTextColor={orbit.textTertiary}
                multiline
                maxLength={300}
              />
            </View>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={orbit.white} size="small" />
            ) : (
              <>
                <Feather name="check" size={16} color={orbit.white} />
                <Text style={styles.submitBtnText}>Publish Gig</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */

export default function BazaarScreen() {
  const insets = useSafeAreaInsets();
  const { user, firebaseUser } = useAuth();

  const [search, setSearch]               = useState('');
  const [activeCategory, setCategory]     = useState('All');
  const [gigs, setGigs]                   = useState<BazaarDoc[]>([]);
  const [loading, setLoading]             = useState(true);
  const [usingMock, setUsingMock]         = useState(false);
  const [gateVisible, setGateVisible]     = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  const myUid   = firebaseUser?.uid ?? null;
  const myKarma = user?.karma ?? 0;

  /* ── Subscribe to /bazaar ── */
  useEffect(() => {
    let unsub: (() => void) | undefined;

    try {
      unsub = firestore()
        .collection(COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(30)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              setGigs(BAZAAR_GIGS.map(mockToGigDoc));
              setUsingMock(true);
            } else {
              const list: BazaarDoc[] = [];
              qs.forEach((doc) => {
                const d = doc.data() as Omit<BazaarDoc, 'id'>;
                list.push({ id: doc.id, ...d });
              });
              setGigs(list);
              setUsingMock(false);
            }
            setLoading(false);
          },
          () => {
            setGigs(BAZAAR_GIGS.map(mockToGigDoc));
            setUsingMock(true);
            setLoading(false);
          }
        );
    } catch {
      setGigs(BAZAAR_GIGS.map(mockToGigDoc));
      setUsingMock(true);
      setLoading(false);
    }

    return () => unsub?.();
  }, []);

  /* ── Filter ── */
  const filtered = gigs.filter(g => {
    const matchCat = activeCategory === 'All' || g.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      g.title.toLowerCase().includes(q) ||
      g.author.username.toLowerCase().includes(q) ||
      g.tags.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  /* ── Post gig tap ── */
  const handlePostGigTap = () => {
    if (!myUid) {
      Alert.alert('Sign in required', 'Gig post karne ke liye sign in karo.');
      return;
    }
    if (myKarma < KARMA_GATE) {
      setGateVisible(true);
    } else {
      setCreateVisible(true);
    }
  };

  /* ── Submit new listing ── */
  const handleSubmitListing = async (form: CreateForm) => {
    if (!myUid || !user) return;
    setSubmitting(true);
    try {
      await firestore().collection(COLLECTION).add({
        title:    form.title.trim(),
        priceINR: Number(form.price),
        category: form.category,
        author: {
          uid:      myUid,
          username: user.username ?? 'anonymous',
          karma:    user.karma,
          trust:    user.trustScore,
        },
        tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 3),
        rating:      0,
        reviews:     0,
        delivery:    form.delivery,
        icon:        CATEGORY_ICONS[form.category] ?? 'briefcase',
        description: form.description.trim(),
        createdAt:   serverTimestamp(),
      });
      setCreateVisible(false);
      Alert.alert('Posted!', 'Tera gig live ho gaya Bazaar mein.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Kuch gadbad ho gayi. Dobara try karo.');
    } finally {
      setSubmitting(false);
    }
  };

  const bottomPad = Platform.OS === 'web' ? 90 : insets.bottom + 70;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Bazaar"
        right={
          <TouchableOpacity
            style={styles.postBtn}
            activeOpacity={0.85}
            onPress={handlePostGigTap}
            accessibilityRole="button"
            accessibilityLabel="Post a gig"
          >
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

      {/* Category pills */}
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
              <Text style={[
                styles.categoryPillText,
                active && styles.categoryPillTextActive,
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Result count + demo notice */}
      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>
          {loading ? '…' : `${filtered.length} ${filtered.length === 1 ? 'gig' : 'gigs'} found`}
        </Text>
        {usingMock && !loading && (
          <Text style={styles.demoLabel}>DEMO</Text>
        )}
      </View>

      {/* Loading */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={orbit.textTertiary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="inbox" size={32} color={orbit.textTertiary} />
          <Text style={styles.emptyText}>No gigs found</Text>
          <Text style={styles.emptySubtext}>Try a different category or search term</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <GigCard item={item} />}
          numColumns={2}
          columnWrapperStyle={styles.gridGap}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={6}
        />
      )}

      {/* Karma Gate sheet */}
      <KarmaGateSheet
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        currentKarma={myKarma}
      />

      {/* Create Listing sheet */}
      <CreateListingSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSubmit={handleSubmitListing}
        submitting={submitting}
      />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header CTA */
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

  /* Category pills */
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

  /* Result row */
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  resultCount: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  demoLabel: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    backgroundColor: orbit.surface2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  /* List */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  gridGap: { gap: 12 },

  /* Gig card */
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gigCoverInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gigCategoryTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(10,10,11,0.7)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  gigCategoryTagText: {
    color: orbit.textSecond,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  gigBody: { padding: 12 },
  gigTitle: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
    minHeight: 36,
  },
  gigSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
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
    gap: 3,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  ratingText: {
    color: orbit.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  gigReviews: {
    color: orbit.textTertiary,
    fontSize: 11,
  },
  gigDot: {
    color: orbit.textTertiary,
    fontSize: 11,
    marginHorizontal: 2,
  },
  gigDelivery: {
    color: orbit.textTertiary,
    fontSize: 11,
  },
  gigFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  gigPricePill: {
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
  gigTagPill: {
    backgroundColor: orbit.surface3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gigTagText: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '500',
  },

  /* States */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 80,
  },
  emptyText: {
    color: orbit.textSecond,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    color: orbit.textTertiary,
    fontSize: 13,
  },

  /* Karma gate sheet */
  gateWrap: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  gateCircleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 8,
  },
  gateCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  gateCircleTarget: {
    borderColor: orbit.accent,
    backgroundColor: orbit.accentSoftSolid,
  },
  gateCircleNum: {
    color: orbit.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  gateCircleLbl: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '500',
  },
  gateBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.surface2,
    overflow: 'hidden',
  },
  gateBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: orbit.accent,
  },
  gateProgressText: {
    color: orbit.textSecond,
    fontSize: 13,
    textAlign: 'center',
  },
  gateHowTitle: {
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    paddingTop: 16,
  },
  gateHowTitleText: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  gateHowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  gateHowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: orbit.accentSoftSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateHowLabel: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 13,
  },
  gateHowPts: {
    color: orbit.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  gateCloseBtn: {
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  gateCloseBtnText: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  /* Create listing form */
  formScroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  fieldWrap: { gap: 8 },
  fieldLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  textInputBox: {
    height: 48,
    borderRadius: 12,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInputError: {
    borderColor: orbit.danger,
  },
  textInput: {
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  currencyPrefix: {
    color: orbit.textTertiary,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  fieldError: {
    color: orbit.danger,
    fontSize: 12,
    fontWeight: '500',
  },
  formPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  formPillActive: {
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    borderColor: orbit.accent,
  },
  formPillText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '500',
  },
  formPillTextActive: {
    color: orbit.accent,
    fontWeight: '600',
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  deliveryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  deliveryPillActive: {
    backgroundColor: 'rgba(91, 127, 255, 0.10)',
    borderColor: orbit.accent,
  },
  deliveryPillText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '500',
  },
  deliveryPillTextActive: {
    color: orbit.accent,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: orbit.accent,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 4,
  },
  submitBtnText: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

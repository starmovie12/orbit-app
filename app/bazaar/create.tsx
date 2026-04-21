/**
 * ORBIT — Bazaar Create Listing Screen (app/bazaar/create.tsx)
 *
 * Features:
 *   • Full-screen form: title, category, price, delivery, description,
 *     portfolio images (up to 4 via expo-image-picker)
 *   • Karma gate: user must have karma ≥ 50 to create a listing
 *     (gate shown inline — no sheet, just a clear blocked state)
 *   • Publishes to /bazaar Firestore collection on submit
 *   • Image URIs stored in the listing doc (base field — swap for
 *     Cloud Storage URLs in production via firebase/storage)
 *   • Full validation: title ≥ 5 chars, price ≥ 1 ₹
 *   • Feather icons throughout; zero emoji in chrome
 *
 * Firestore /bazaar/{listingId} schema written here:
 *   title, priceINR, category, author{uid,username,karma,trust},
 *   tags[], rating, reviews, delivery, icon, description,
 *   portfolioImages[], createdAt
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ScreenHeader } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore, serverTimestamp } from '@/lib/firebase';
import { BAZAAR_CATEGORIES } from '@/constants/data';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const KARMA_GATE   = 50;
const COLLECTION   = 'bazaar';
const MAX_IMAGES   = 4;

const DELIVERY_OPTIONS = ['Same day', '1 day', '2 days', '3 days'];

const CATEGORY_ICONS: Record<string, string> = {
  Design:   'pen-tool',
  Dev:      'code',
  Writing:  'edit-3',
  Social:   'trending-up',
  Video:    'film',
  Audio:    'mic',
  Business: 'bar-chart-2',
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

type FormState = {
  title:       string;
  category:    string;
  price:       string;
  delivery:    string;
  description: string;
  tags:        string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  title:       '',
  category:    'Design',
  price:       '',
  delivery:    '1 day',
  description: '',
  tags:        '',
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Karma gate screen — shown when user has insufficient karma */
function KarmaGateView({ karma }: { karma: number }) {
  const router  = useRouter();
  const needed  = Math.max(0, KARMA_GATE - karma);
  const pct     = Math.min(100, (karma / KARMA_GATE) * 100);

  return (
    <ScrollView
      contentContainerStyle={styles.gateContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Lock icon */}
      <View style={styles.gateLockWrap}>
        <Feather name="lock" size={32} color={orbit.textTertiary} />
      </View>

      <Text style={styles.gateTitle}>Karma Gate</Text>
      <Text style={styles.gateSubtitle}>
        Listing post karne ke liye {KARMA_GATE} karma chahiye
      </Text>

      {/* Progress circles */}
      <View style={styles.gateCircleRow}>
        <View style={styles.gateCircle}>
          <Text style={styles.gateCircleNum}>{karma}</Text>
          <Text style={styles.gateCircleLbl}>your karma</Text>
        </View>
        <Feather name="arrow-right" size={18} color={orbit.textTertiary} />
        <View style={[styles.gateCircle, styles.gateCircleTarget]}>
          <Text style={[styles.gateCircleNum, { color: orbit.accent }]}>
            {KARMA_GATE}
          </Text>
          <Text style={styles.gateCircleLbl}>required</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.gateBarBg}>
        <View style={[styles.gateBarFill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={styles.gateProgressText}>
        {needed > 0
          ? `${needed} more karma chahiye`
          : 'Karma requirement met!'}
      </Text>

      {/* How to earn section */}
      <View style={styles.gateCard}>
        <Text style={styles.gateCardTitle}>Karma kaise earn karein</Text>
        {[
          { icon: 'message-circle', label: 'Rooms mein helpful replies karo', pts: '+5' },
          { icon: 'play',           label: 'Discover posts watch karo',        pts: '+2' },
          { icon: 'users',          label: 'Friends ko invite karo',           pts: '+10' },
          { icon: 'award',          label: 'Weekly challenge jeet',            pts: '+50' },
          { icon: 'check-circle',   label: 'Identity verify karo',             pts: '+50' },
        ].map((item, idx) => (
          <View key={item.icon} style={styles.gateRow}>
            <View style={styles.gateRowIcon}>
              <Feather name={item.icon as any} size={15} color={orbit.accent} />
            </View>
            <Text style={styles.gateRowLabel}>{item.label}</Text>
            <Text style={styles.gateRowPts}>{item.pts}</Text>
            {idx < 4 && <View style={[StyleSheet.absoluteFillObject, { display: 'none' }]} />}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.gateBackBtn}
        onPress={() => router.back()}
        activeOpacity={0.85}
      >
        <Text style={styles.gateBackBtnText}>Go Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/** Single portfolio image tile */
function ImageTile({
  uri,
  onRemove,
}: {
  uri: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.imageTile}>
      <Image source={{ uri }} style={styles.imageTileImg} />
      <TouchableOpacity
        style={styles.imageTileRemove}
        onPress={onRemove}
        hitSlop={4}
        activeOpacity={0.85}
      >
        <Feather name="x" size={12} color={orbit.white} />
      </TouchableOpacity>
    </View>
  );
}

/** Add image placeholder tile */
function AddImageTile({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.imageTileAdd}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Feather name="plus" size={20} color={orbit.textTertiary} />
      <Text style={styles.imageTileAddText}>Add</Text>
    </TouchableOpacity>
  );
}

/* ─── Field helpers ──────────────────────────────────────────────────────── */

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <Text style={styles.fieldError}>{text}</Text>;
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */

export default function CreateBazaarListingScreen() {
  const router             = useRouter();
  const insets             = useSafeAreaInsets();
  const { user, firebaseUser } = useAuth();

  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]         = useState<FormErrors>({});
  const [images, setImages]         = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const myUid   = firebaseUser?.uid ?? null;
  const myKarma = user?.karma ?? 0;

  /* ── Field setter ── */
  const setField = useCallback((key: keyof FormState, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  /* ── Validation ── */
  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.title.trim() || form.title.trim().length < 5) {
      e.title = 'Title kam se kam 5 characters ka hona chahiye';
    }
    const p = Number(form.price);
    if (!form.price || isNaN(p) || p < 1) {
      e.price = 'Valid price daalo (₹1 minimum)';
    }
    if (!form.description.trim()) {
      e.description = 'Description likhna zaroori hai';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Image picker ── */
  const handlePickImage = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `Maximum ${MAX_IMAGES} portfolio images allowed.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'Gallery access chahiye portfolio images ke liye. Settings mein allow karo.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets.length > 0) {
      setImages(prev => [...prev, result.assets[0].uri]);
    }
  }, [images]);

  const handleRemoveImage = useCallback((idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }, []);

  /* ── Submit ── */
  const handleSubmit = useCallback(async () => {
    if (!myUid || !user) {
      Alert.alert('Error', 'Sign in karo pehle.');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const tagsArray = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 3);

      await firestore().collection(COLLECTION).add({
        title:            form.title.trim(),
        priceINR:         Number(form.price),
        category:         form.category,
        author: {
          uid:      myUid,
          username: user.username ?? 'anonymous',
          karma:    user.karma ?? 0,
          trust:    user.trustScore ?? 50,
        },
        tags:             tagsArray,
        rating:           0,
        reviews:          0,
        delivery:         form.delivery,
        icon:             CATEGORY_ICONS[form.category] ?? 'briefcase',
        description:      form.description.trim(),
        portfolioImages:  images,
        createdAt:        serverTimestamp(),
      });

      Alert.alert(
        'Published!',
        'Tera gig Bazaar mein live ho gaya.',
        [{ text: 'Great!', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Kuch gadbad ho gayi. Dobara try karo.');
    } finally {
      setSubmitting(false);
    }
  }, [form, images, myUid, user, router]);

  /* ── Not signed in ── */
  if (!myUid) {
    return (
      <View style={[styles.root, { backgroundColor: orbit.bg }]}>
        <ScreenHeader title="Create Listing" onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Feather name="user" size={36} color={orbit.textTertiary} />
          <Text style={styles.centerStateTitle}>Sign in required</Text>
          <Text style={styles.centerStateSub}>
            Listing post karne ke liye sign in karo.
          </Text>
        </View>
      </View>
    );
  }

  /* ── Karma gate ── */
  if (myKarma < KARMA_GATE) {
    return (
      <View style={[styles.root, { backgroundColor: orbit.bg }]}>
        <ScreenHeader title="Create Listing" onBack={() => router.back()} />
        <KarmaGateView karma={myKarma} />
      </View>
    );
  }

  const categories = BAZAAR_CATEGORIES.filter(c => c !== 'All');
  const bottomPad  = Platform.OS === 'web' ? 80 : insets.bottom + 100;

  return (
    <View style={[styles.root, { backgroundColor: orbit.bg }]}>
      <ScreenHeader title="Post a Gig" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Title ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="GIG TITLE" />
            <View style={[
              styles.inputBox,
              errors.title ? styles.inputBoxError : null,
            ]}>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={v => setField('title', v)}
                placeholder="e.g. Professional Logo Design in 2 Days"
                placeholderTextColor={orbit.textTertiary}
                maxLength={80}
                returnKeyType="next"
              />
            </View>
            <FieldError text={errors.title} />
            <Text style={styles.charCount}>{form.title.length}/80</Text>
          </View>

          {/* ── Category ───────────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="CATEGORY" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {categories.map(cat => {
                const active = form.category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setField('category', cat)}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={(CATEGORY_ICONS[cat] ?? 'briefcase') as any}
                      size={12}
                      color={active ? orbit.accent : orbit.textTertiary}
                    />
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Price ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="STARTING PRICE (₹)" />
            <View style={[
              styles.inputBox,
              styles.inputRow,
              errors.price ? styles.inputBoxError : null,
            ]}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.price}
                onChangeText={v => setField('price', v.replace(/[^0-9]/g, ''))}
                placeholder="500"
                placeholderTextColor={orbit.textTertiary}
                keyboardType="number-pad"
                maxLength={7}
                returnKeyType="next"
              />
              {form.price !== '' && (
                <Text style={styles.priceHint}>
                  ≈ ${(Number(form.price) / 83).toFixed(0)} USD
                </Text>
              )}
            </View>
            <FieldError text={errors.price} />
          </View>

          {/* ── Delivery time ──────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="DELIVERY TIME" />
            <View style={styles.deliveryRow}>
              {DELIVERY_OPTIONS.map(opt => {
                const active = form.delivery === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.deliveryPill, active && styles.deliveryPillActive]}
                    onPress={() => setField('delivery', opt)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.deliveryPillText,
                      active && styles.deliveryPillTextActive,
                    ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Description ────────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="DESCRIPTION" />
            <View style={[
              styles.inputBox,
              styles.textareaBox,
              errors.description ? styles.inputBoxError : null,
            ]}>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.description}
                onChangeText={v => setField('description', v)}
                placeholder="Apne gig ke baare mein detail mein likho. Kya deliver karoge, kya include hai, kya nahi..."
                placeholderTextColor={orbit.textTertiary}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.descFooter}>
              <FieldError text={errors.description} />
              <Text style={styles.charCount}>{form.description.length}/500</Text>
            </View>
          </View>

          {/* ── Tags ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="TAGS (comma separated, max 3)" />
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={form.tags}
                onChangeText={v => setField('tags', v)}
                placeholder="Logo, Branding, Figma"
                placeholderTextColor={orbit.textTertiary}
                maxLength={60}
                returnKeyType="done"
              />
            </View>
            {/* Tag preview pills */}
            {form.tags.trim().length > 0 && (
              <View style={styles.tagPreviewRow}>
                {form.tags
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((tag, i) => (
                    <View key={i} style={styles.tagPreviewPill}>
                      <Text style={styles.tagPreviewText}>{tag}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>

          {/* ── Portfolio images ────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.portfolioHeader}>
              <FieldLabel text="PORTFOLIO IMAGES (optional)" />
              <Text style={styles.portfolioCount}>
                {images.length}/{MAX_IMAGES}
              </Text>
            </View>
            <Text style={styles.portfolioHint}>
              Add sample work to attract more buyers. Ratio 16:9 recommended.
            </Text>
            <View style={styles.imageGrid}>
              {images.map((uri, idx) => (
                <ImageTile
                  key={idx}
                  uri={uri}
                  onRemove={() => handleRemoveImage(idx)}
                />
              ))}
              {images.length < MAX_IMAGES && (
                <AddImageTile onPress={handlePickImage} />
              )}
            </View>
          </View>

          {/* ── Preview card ────────────────────────────────────── */}
          <View style={styles.section}>
            <FieldLabel text="LISTING PREVIEW" />
            <View style={styles.previewCard}>
              <View style={styles.previewCover}>
                {images.length > 0 ? (
                  <Image
                    source={{ uri: images[0] }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <Feather
                    name={(CATEGORY_ICONS[form.category] ?? 'briefcase') as any}
                    size={28}
                    color={orbit.textTertiary}
                  />
                )}
                <View style={styles.previewCatTag}>
                  <Text style={styles.previewCatTagText}>{form.category}</Text>
                </View>
              </View>
              <View style={styles.previewBody}>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {form.title.trim() || 'Your gig title will appear here'}
                </Text>
                <View style={styles.previewMeta}>
                  <Feather name="clock" size={11} color={orbit.textTertiary} />
                  <Text style={styles.previewDelivery}>{form.delivery}</Text>
                  {form.price !== '' && (
                    <>
                      <Text style={styles.previewDot}>·</Text>
                      <Text style={styles.previewPrice}>
                        ₹{Number(form.price).toLocaleString()}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky submit bar ──────────────────────────────────── */}
      <View
        style={[
          styles.submitBar,
          { paddingBottom: Platform.OS === 'web' ? 12 : insets.bottom + 12 },
        ]}
      >
        <View style={styles.submitBarInner}>
          <View>
            <Text style={styles.submitBarLabel}>Starting at</Text>
            <Text style={styles.submitBarPrice}>
              {form.price ? `₹${Number(form.price).toLocaleString()}` : '—'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
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
        </View>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:         { flex: 1 },

  /* ── Scroll ── */
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 24,
  },

  /* ── Section ── */
  section: { gap: 8 },

  /* ── Field label ── */
  fieldLabel: {
    color:         orbit.textTertiary,
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.6,
  },
  fieldError: {
    color:      orbit.danger,
    fontSize:   12,
    fontWeight: '500',
  },
  charCount: {
    color:     orbit.textTertiary,
    fontSize:  11,
    textAlign: 'right',
    marginTop: 2,
  },

  /* ── Inputs ── */
  inputBox: {
    height:           48,
    borderRadius:     12,
    backgroundColor:  orbit.surface2,
    borderWidth:      1,
    borderColor:      orbit.borderStrong,
    paddingHorizontal:14,
    justifyContent:   'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  inputBoxError: {
    borderColor: orbit.danger,
  },
  input: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '500',
    padding:    0,
  },
  currencyPrefix: {
    color:       orbit.textTertiary,
    fontSize:    17,
    fontWeight:  '600',
    marginRight: 8,
  },
  priceHint: {
    color:    orbit.textTertiary,
    fontSize: 12,
  },
  textareaBox: {
    height:      120,
    alignItems:  'flex-start',
  },
  textarea: {
    height:          112,
    textAlignVertical:'top',
    paddingTop:      12,
  },
  descFooter: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },

  /* ── Category pills ── */
  pillRow: {
    gap:            8,
    paddingVertical: 2,
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal:14,
    paddingVertical: 8,
    borderRadius:    18,
    backgroundColor: orbit.surface2,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
  },
  pillActive: {
    backgroundColor: orbit.accentSoftSolid,
    borderColor:     orbit.accent,
  },
  pillText: {
    color:      orbit.textSecond,
    fontSize:   13,
    fontWeight: '500',
  },
  pillTextActive: {
    color:      orbit.accent,
    fontWeight: '600',
  },

  /* ── Delivery pills ── */
  deliveryRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  deliveryPill: {
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      10,
    backgroundColor:   orbit.surface2,
    borderWidth:       1,
    borderColor:       orbit.borderSubtle,
  },
  deliveryPillActive: {
    backgroundColor: orbit.accentSoftSolid,
    borderColor:     orbit.accent,
  },
  deliveryPillText: {
    color:      orbit.textSecond,
    fontSize:   13,
    fontWeight: '500',
  },
  deliveryPillTextActive: {
    color:      orbit.accent,
    fontWeight: '600',
  },

  /* ── Tag preview ── */
  tagPreviewRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     4,
  },
  tagPreviewPill: {
    backgroundColor:   orbit.surface3,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      6,
  },
  tagPreviewText: {
    color:      orbit.textSecond,
    fontSize:   11,
    fontWeight: '500',
  },

  /* ── Portfolio images ── */
  portfolioHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  portfolioCount: {
    color:      orbit.textTertiary,
    fontSize:   12,
    fontWeight: '500',
  },
  portfolioHint: {
    color:    orbit.textTertiary,
    fontSize: 12,
    marginTop:-4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
  },
  imageTile: {
    width:        92,
    height:       60,
    borderRadius: 10,
    overflow:     'hidden',
    position:     'relative',
  },
  imageTileImg: {
    width:  '100%',
    height: '100%',
  },
  imageTileRemove: {
    position:        'absolute',
    top:             4,
    right:           4,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  imageTileAdd: {
    width:           92,
    height:          60,
    borderRadius:    10,
    backgroundColor: orbit.surface2,
    borderWidth:     1,
    borderColor:     orbit.borderStrong,
    borderStyle:     'dashed',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
  },
  imageTileAddText: {
    color:      orbit.textTertiary,
    fontSize:   11,
    fontWeight: '500',
  },

  /* ── Preview card ── */
  previewCard: {
    backgroundColor: orbit.surface1,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    overflow:        'hidden',
  },
  previewCover: {
    width:           '100%',
    height:          100,
    backgroundColor: orbit.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  previewCatTag: {
    position:        'absolute',
    top:             8,
    right:           8,
    backgroundColor: 'rgba(10,10,11,0.7)',
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      5,
  },
  previewCatTagText: {
    color:         orbit.textSecond,
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.2,
  },
  previewBody: {
    padding: 12,
    gap:     6,
  },
  previewTitle: {
    color:      orbit.textPrimary,
    fontSize:   14,
    fontWeight: '600',
    lineHeight: 20,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  previewDelivery: {
    color:    orbit.textTertiary,
    fontSize: 12,
  },
  previewDot: {
    color:    orbit.textTertiary,
    fontSize: 12,
  },
  previewPrice: {
    color:      orbit.accent,
    fontSize:   13,
    fontWeight: '700',
  },

  /* ── Submit bar ── */
  submitBar: {
    backgroundColor: orbit.bg,
    borderTopWidth:  1,
    borderTopColor:  orbit.borderSubtle,
    paddingTop:      12,
    paddingHorizontal:16,
    ...Platform.select({
      ios:     { shadowColor:'#000', shadowOffset:{ width:0, height:-4 }, shadowOpacity:0.12, shadowRadius:12 },
      android: { elevation: 10 },
    }),
  },
  submitBarInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
  },
  submitBarLabel: {
    color:      orbit.textTertiary,
    fontSize:   11,
    fontWeight: '500',
  },
  submitBarPrice: {
    color:         orbit.textPrimary,
    fontSize:      18,
    fontWeight:    '700',
    letterSpacing: -0.4,
  },
  submitBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: orbit.accent,
    paddingVertical: 14,
    paddingHorizontal:28,
    borderRadius:    13,
    minWidth:        140,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color:      orbit.white,
    fontSize:   15,
    fontWeight: '700',
  },

  /* ── Center state (not signed in) ── */
  centerState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    paddingHorizontal: 32,
  },
  centerStateTitle: {
    color:      orbit.textPrimary,
    fontSize:   18,
    fontWeight: '700',
    marginTop:  8,
  },
  centerStateSub: {
    color:     orbit.textSecond,
    fontSize:  14,
    textAlign: 'center',
    lineHeight:20,
  },

  /* ── Karma gate ── */
  gateContainer: {
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     40,
    alignItems:        'center',
    gap:               16,
  },
  gateLockWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: orbit.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     orbit.borderStrong,
    marginBottom:    4,
  },
  gateTitle: {
    color:         orbit.textPrimary,
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.4,
  },
  gateSubtitle: {
    color:     orbit.textSecond,
    fontSize:  14,
    textAlign: 'center',
    lineHeight:20,
  },
  gateCircleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           20,
    marginVertical:8,
  },
  gateCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: orbit.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     orbit.borderStrong,
  },
  gateCircleTarget: {
    borderColor:     orbit.accent,
    backgroundColor: orbit.accentSoftSolid,
  },
  gateCircleNum: {
    color:      orbit.textPrimary,
    fontSize:   22,
    fontWeight: '700',
  },
  gateCircleLbl: {
    color:      orbit.textTertiary,
    fontSize:   10,
    fontWeight: '500',
    marginTop:  2,
  },
  gateBarBg: {
    width:           '100%',
    height:          6,
    borderRadius:    3,
    backgroundColor: orbit.surface2,
    overflow:        'hidden',
  },
  gateBarFill: {
    height:          '100%',
    borderRadius:    3,
    backgroundColor: orbit.accent,
  },
  gateProgressText: {
    color:     orbit.textSecond,
    fontSize:  13,
    textAlign: 'center',
  },
  gateCard: {
    width:           '100%',
    backgroundColor: orbit.surface1,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         16,
    gap:             12,
    marginTop:       4,
  },
  gateCardTitle: {
    color:         orbit.textPrimary,
    fontSize:      15,
    fontWeight:    '600',
    marginBottom:  4,
  },
  gateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  gateRowIcon: {
    width:           32,
    height:          32,
    borderRadius:    8,
    backgroundColor: orbit.accentSoftSolid,
    alignItems:      'center',
    justifyContent:  'center',
  },
  gateRowLabel: {
    flex:       1,
    color:      orbit.textSecond,
    fontSize:   13,
    lineHeight: 18,
  },
  gateRowPts: {
    color:      orbit.accent,
    fontSize:   13,
    fontWeight: '700',
  },
  gateBackBtn: {
    width:           '100%',
    backgroundColor: orbit.surface2,
    borderRadius:    13,
    paddingVertical: 15,
    alignItems:      'center',
    marginTop:       8,
  },
  gateBackBtnText: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '600',
  },
});

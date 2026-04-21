/**
 * ORBIT — Bazaar Listing Detail Screen (app/bazaar/[id].tsx)
 *
 * Route: /bazaar/[id]  where id = Firestore document id in /bazaar/{id}
 *
 * Features:
 *   • Fetches the full listing doc from /bazaar/{id} in real-time
 *   • Gig preview: cover images carousel, title, category, delivery,
 *     rating, tags, full description
 *   • Seller ORBIT Card: avatar, handle, karma, rank, trust score,
 *     skills/interests — same design as /app/(tabs)/profile.tsx
 *   • Reviews: real-time subscription to /bazaar/{id}/reviews subcollection,
 *     sorted by createdAt desc; inline "Write a review" form for buyers
 *   • Order / Contact button:
 *       → "Order Now" triggers Razorpay checkout (same pattern as credits/purchase.tsx)
 *       → After payment success, writes an order doc to /bazaar/{id}/orders
 *       → "Message Seller" navigates to DM thread via ensureThread()
 *   • Same-author guard: listing owner sees "Manage Gig" instead of Order
 *
 * Firestore reads:
 *   /bazaar/{id}                  — listing doc
 *   /users/{sellerUid}            — seller profile (for ORBIT Card)
 *   /bazaar/{id}/reviews          — subcollection, latest 20
 *   /bazaar/{id}/orders           — write-only on success
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Avatar, TierPill, Divider } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore, serverTimestamp } from '@/lib/firebase';
import { subscribeUser, type UserDoc } from '@/lib/firestore-users';
import { ensureThread } from '@/lib/firestore-dms';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const RAZORPAY_KEY_ID = 'rzp_test_YOUR_KEY_HERE'; // ← swap for live key
const ORDER_API_URL   =
  'https://us-central1-YOUR_PROJECT.cloudfunctions.net/createRazorpayOrder';
const { width: SCREEN_W } = Dimensions.get('window');

/* ─── Razorpay stub ──────────────────────────────────────────────────────── */

// Remove this block once you run: npm install react-native-razorpay
declare module 'react-native-razorpay' {
  interface RazorpayOptions {
    description: string;
    currency: string;
    key: string;
    amount: number;
    name: string;
    order_id: string;
    prefill?: { email?: string; contact?: string; name?: string };
    theme?: { color?: string };
    retry?: { enabled: boolean };
    send_sms_hash?: boolean;
    remember_customer?: boolean;
  }
  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }
  export default class RazorpayCheckout {
    static open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
  }
}

const RazorpayCheckout = {
  open: async (_opts: any): Promise<any> => {
    throw Object.assign(
      new Error('Razorpay not installed. Run: npm install react-native-razorpay'),
      { code: -1, description: 'Package not installed' },
    );
  },
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

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
  description?: string;
  portfolioImages?: string[];
  createdAt: unknown;
};

type ReviewDoc = {
  id: string;
  reviewerUid: string;
  reviewerName: string;
  rating: number;         // 1–5
  comment: string;
  createdAt: unknown;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function snapExists(s: any): boolean {
  return typeof s.exists === 'function' ? s.exists() : !!s.exists;
}

type KarmaTier = 'LEGEND' | 'MASTER' | 'PRO' | 'RISING';

function karmaToTier(karma: number): KarmaTier {
  if (karma >= 2000) return 'LEGEND';
  if (karma >= 501)  return 'MASTER';
  if (karma >= 101)  return 'PRO';
  return 'RISING';
}

function renderStars(rating: number, size = 14) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Feather
        key={i}
        name="star"
        size={size}
        color={i <= Math.round(rating) ? orbit.warning : orbit.borderStrong}
      />,
    );
  }
  return stars;
}

/** Create a Razorpay order via backend Cloud Function */
async function createRazorpayOrder(amountInr: number, uid: string): Promise<string> {
  const res = await fetch(ORDER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountInr * 100, currency: 'INR', uid }),
  });
  if (!res.ok) throw new Error('Order creation failed. Try again.');
  const json = await res.json();
  return json.orderId as string;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Scrollable image carousel for portfolio images */
function ImageCarousel({ images, icon }: { images: string[]; icon: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!images || images.length === 0) {
    return (
      <View style={styles.carouselPlaceholder}>
        <Feather name={icon as any} size={40} color={orbit.textTertiary} />
      </View>
    );
  }

  return (
    <View style={styles.carouselWrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setActiveIdx(idx);
        }}
      >
        {images.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={styles.carouselImage}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.carouselDots}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.carouselDot,
                i === activeIdx && styles.carouselDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Seller ORBIT Card — mirrors profile screen design */
function SellerOrbitCard({
  seller,
  onMessage,
}: {
  seller: UserDoc;
  onMessage: () => void;
}) {
  const displayName = seller.displayName || seller.username || 'User';
  const handle      = seller.username ? `@${seller.username}` : '—';
  const tier        = karmaToTier(seller.karma ?? 0);
  const skills      = seller.interests ?? [];
  const trustScore  = seller.trustScore ?? 50;
  const trustColor  =
    trustScore >= 90 ? orbit.success :
    trustScore >= 70 ? orbit.warning :
    orbit.danger;

  return (
    <View style={styles.orbitCard}>
      {/* Header */}
      <View style={styles.orbitCardHeader}>
        <Avatar name={displayName} size={52} />
        <View style={styles.orbitCardHeaderInfo}>
          <Text style={styles.orbitCardName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.orbitCardHandle}>{handle}</Text>
          <TierPill tier={tier} />
        </View>
      </View>

      {/* Bio */}
      {!!seller.bio && (
        <Text style={styles.orbitCardBio} numberOfLines={3}>
          {seller.bio}
        </Text>
      )}

      {/* Skills/Interests */}
      {skills.length > 0 && (
        <View style={styles.orbitCardSkills}>
          {skills.slice(0, 5).map((s, i) => (
            <View key={i} style={styles.skillTag}>
              <Text style={styles.skillTagText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats strip */}
      <View style={styles.orbitCardFooter}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>
            {(seller.karma ?? 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.cardStatLbl}>KARMA</Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Text style={styles.cardStatVal}>
            {seller.rank != null ? `#${seller.rank}` : '—'}
          </Text>
          <Text style={styles.cardStatLbl}>RANK</Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Text style={[styles.cardStatVal, { color: trustColor }]}>
            {trustScore}
          </Text>
          <Text style={styles.cardStatLbl}>TRUST</Text>
        </View>
      </View>

      {/* Trust bar */}
      <View style={styles.trustTrack}>
        <View
          style={[
            styles.trustFill,
            {
              width: `${Math.min(100, trustScore)}%` as any,
              backgroundColor: trustColor,
            },
          ]}
        />
      </View>

      {/* Message button */}
      <TouchableOpacity
        style={styles.messageBtn}
        onPress={onMessage}
        activeOpacity={0.85}
      >
        <Feather name="message-circle" size={15} color={orbit.accent} />
        <Text style={styles.messageBtnText}>Message Seller</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Single review row */
function ReviewRow({ review }: { review: ReviewDoc }) {
  return (
    <View style={styles.reviewRow}>
      <Avatar name={review.reviewerName} size={36} />
      <View style={styles.reviewContent}>
        <View style={styles.reviewTopRow}>
          <Text style={styles.reviewerName}>@{review.reviewerName}</Text>
          <View style={styles.reviewStars}>
            {renderStars(review.rating, 11)}
          </View>
        </View>
        {!!review.comment && (
          <Text style={styles.reviewComment}>{review.comment}</Text>
        )}
      </View>
    </View>
  );
}

/** Inline write-review form */
function WriteReviewForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (rating: number, comment: string) => Promise<void>;
  submitting: boolean;
}) {
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState('');
  const [hovered, setHovered] = useState(0);

  const display = hovered > 0 ? hovered : rating;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }
    await onSubmit(rating, comment.trim());
    setRating(0);
    setComment('');
  };

  return (
    <View style={styles.writeReviewForm}>
      <Text style={styles.writeReviewTitle}>Write a Review</Text>

      {/* Star selector */}
      <View style={styles.starSelector}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => setRating(n)}
            onPressIn={() => setHovered(n)}
            onPressOut={() => setHovered(0)}
            hitSlop={6}
            activeOpacity={0.8}
          >
            <Feather
              name="star"
              size={28}
              color={n <= display ? orbit.warning : orbit.borderStrong}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Comment input */}
      <View style={styles.reviewInputBox}>
        <TextInput
          style={styles.reviewInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Apna experience share karo..."
          placeholderTextColor={orbit.textTertiary}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.reviewSubmitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={orbit.white} size="small" />
        ) : (
          <Text style={styles.reviewSubmitBtnText}>Post Review</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */

export default function BazaarDetailScreen() {
  const { id }                 = useLocalSearchParams<{ id: string }>();
  const router                 = useRouter();
  const insets                 = useSafeAreaInsets();
  const { user, firebaseUser } = useAuth();

  const [listing, setListing]         = useState<BazaarDoc | null>(null);
  const [seller,  setSeller]          = useState<UserDoc | null>(null);
  const [reviews, setReviews]         = useState<ReviewDoc[]>([]);
  const [loadingDoc,  setLoadingDoc]  = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const myUid  = firebaseUser?.uid ?? null;
  const myName = user?.username ?? 'anonymous';
  const myPhone= firebaseUser?.phoneNumber ?? '';
  const isOwner = listing ? listing.author.uid === myUid : false;

  /* ── Fetch listing ── */
  useEffect(() => {
    if (!id) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = firestore()
        .collection('bazaar')
        .doc(id)
        .onSnapshot(
          snap => {
            if (snapExists(snap)) {
              setListing({ id: snap.id, ...(snap.data() as Omit<BazaarDoc, 'id'>) });
            }
            setLoadingDoc(false);
          },
          () => setLoadingDoc(false),
        );
    } catch {
      setLoadingDoc(false);
    }
    return () => unsub?.();
  }, [id]);

  /* ── Subscribe seller profile ── */
  useEffect(() => {
    if (!listing?.author.uid) return;
    const unsub = subscribeUser(listing.author.uid, doc => setSeller(doc));
    return () => unsub();
  }, [listing?.author.uid]);

  /* ── Fetch reviews ── */
  useEffect(() => {
    if (!id) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = firestore()
        .collection('bazaar')
        .doc(id)
        .collection('reviews')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(qs => {
          const list: ReviewDoc[] = [];
          qs.forEach(doc => {
            list.push({ id: doc.id, ...(doc.data() as Omit<ReviewDoc, 'id'>) });
          });
          setReviews(list);
          if (myUid) {
            setHasReviewed(list.some(r => r.reviewerUid === myUid));
          }
        });
    } catch { /* silent */ }
    return () => unsub?.();
  }, [id, myUid]);

  /* ── Message seller ── */
  const handleMessage = useCallback(async () => {
    if (!myUid || !listing) {
      Alert.alert('Sign in required', 'Message karne ke liye sign in karo.');
      return;
    }
    if (isOwner) {
      Alert.alert('', 'Yeh tumhara apna gig hai.');
      return;
    }
    try {
      const threadId = await ensureThread(myUid, listing.author.uid);
      router.push(`/dm/${threadId}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Message start nahi ho paya.');
    }
  }, [myUid, listing, isOwner, router]);

  /* ── Razorpay checkout ── */
  const handleOrder = useCallback(async () => {
    if (!myUid || !listing) {
      Alert.alert('Sign in required', 'Order karne ke liye sign in karo.');
      return;
    }
    if (isOwner) {
      Alert.alert('', 'Tum apna hi gig order nahi kar sakte.');
      return;
    }

    setOrderLoading(true);
    try {
      // 1. Create server-side Razorpay order
      const orderId = await createRazorpayOrder(listing.priceINR, myUid);

      // 2. Open native checkout
      const paymentData = await RazorpayCheckout.open({
        description: listing.title,
        currency:    'INR',
        key:         RAZORPAY_KEY_ID,
        amount:      listing.priceINR * 100, // paise
        name:        'ORBIT Bazaar',
        order_id:    orderId,
        prefill: {
          contact: myPhone.replace('+91', ''),
          name:    user?.displayName ?? user?.username ?? 'Orbit User',
        },
        theme:              { color: orbit.accent },
        retry:              { enabled: true },
        send_sms_hash:      true,
        remember_customer:  false,
      });

      // 3. Write order doc to /bazaar/{id}/orders
      await firestore()
        .collection('bazaar')
        .doc(id)
        .collection('orders')
        .add({
          buyerUid:          myUid,
          buyerName:         myName,
          sellerUid:         listing.author.uid,
          listingId:         id,
          listingTitle:      listing.title,
          priceINR:          listing.priceINR,
          status:            'placed',
          razorpayPaymentId: paymentData.razorpay_payment_id,
          razorpayOrderId:   paymentData.razorpay_order_id,
          createdAt:         serverTimestamp(),
        });

      Alert.alert(
        'Order Placed!',
        `Tumhara order confirm ho gaya. Seller se miloge jaldi.`,
        [{ text: 'Message Seller', onPress: handleMessage }, { text: 'OK' }],
      );
    } catch (e: any) {
      if (e?.code === 0 || e?.description === 'Payment cancelled.') return;
      Alert.alert(
        'Payment Failed',
        e?.description ?? e?.message ?? 'Try again or use a different method.',
      );
    } finally {
      setOrderLoading(false);
    }
  }, [myUid, listing, isOwner, myPhone, user, id, myName, handleMessage]);

  /* ── Submit review ── */
  const handleSubmitReview = useCallback(async (rating: number, comment: string) => {
    if (!myUid || !id) return;
    setReviewSubmitting(true);
    try {
      await firestore()
        .collection('bazaar')
        .doc(id)
        .collection('reviews')
        .add({
          reviewerUid:  myUid,
          reviewerName: myName,
          rating,
          comment,
          createdAt: serverTimestamp(),
        });

      // Update listing aggregate rating (simple overwrite with new avg)
      const newCount  = (listing?.reviews ?? 0) + 1;
      const oldTotal  = (listing?.rating ?? 0) * (listing?.reviews ?? 0);
      const newRating = parseFloat(((oldTotal + rating) / newCount).toFixed(1));
      await firestore().collection('bazaar').doc(id).update({
        rating:  newRating,
        reviews: newCount,
      });

      setHasReviewed(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Review post nahi ho paya.');
    } finally {
      setReviewSubmitting(false);
    }
  }, [myUid, id, myName, listing]);

  /* ── Loading ── */
  if (loadingDoc) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  /* ── Not found ── */
  if (!listing) {
    return (
      <View style={[styles.root, { backgroundColor: orbit.bg }]}>
        <View style={[styles.notFoundHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={orbit.textTertiary} />
          <Text style={styles.notFoundText}>Listing not found</Text>
          <Text style={styles.notFoundSub}>Yeh gig delete ho gaya ya move ho gaya.</Text>
        </View>
      </View>
    );
  }

  const bottomPad = Platform.OS === 'web' ? 80 : insets.bottom + 90;
  const coverImages = listing.portfolioImages ?? [];

  return (
    <View style={[styles.root, { backgroundColor: orbit.bg }]}>

      {/* ── Floating back button (over image carousel) ── */}
      <View style={[styles.floatingHeader, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.floatingBack}
          onPress={() => router.back()}
          activeOpacity={0.85}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={20} color={orbit.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Image carousel / cover ──────────────────────────── */}
        <ImageCarousel images={coverImages} icon={listing.icon} />

        <View style={styles.content}>

          {/* ── Category tag + title ──────────────────────────── */}
          <View style={styles.categoryTag}>
            <Feather
              name={(listing.icon) as any}
              size={12}
              color={orbit.accent}
            />
            <Text style={styles.categoryTagText}>{listing.category}</Text>
          </View>

          <Text style={styles.listingTitle}>{listing.title}</Text>

          {/* ── Rating row ───────────────────────────────────── */}
          <View style={styles.ratingRow}>
            <View style={styles.ratingStars}>
              {renderStars(listing.rating)}
            </View>
            <Text style={styles.ratingVal}>
              {listing.rating > 0 ? listing.rating.toFixed(1) : 'New'}
            </Text>
            {listing.reviews > 0 && (
              <Text style={styles.ratingCount}>({listing.reviews} reviews)</Text>
            )}
            <View style={styles.ratingDot} />
            <Feather name="clock" size={12} color={orbit.textTertiary} />
            <Text style={styles.deliveryText}>{listing.delivery}</Text>
          </View>

          {/* ── Tags ─────────────────────────────────────────── */}
          {listing.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {listing.tags.map(tag => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <Divider />

          {/* ── Description ──────────────────────────────────── */}
          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Gig</Text>
              <Text style={styles.descriptionText}>{listing.description}</Text>
            </View>
          ) : null}

          {/* ── Seller ORBIT Card ─────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About the Seller</Text>
            {seller ? (
              <SellerOrbitCard seller={seller} onMessage={handleMessage} />
            ) : (
              <View style={styles.sellerPlaceholder}>
                <Avatar name={listing.author.username} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerPlaceholderName}>
                    @{listing.author.username}
                  </Text>
                  <Text style={styles.sellerPlaceholderSub}>
                    Karma: {listing.author.karma.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Reviews ──────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>
                Reviews{listing.reviews > 0 ? ` (${listing.reviews})` : ''}
              </Text>
              {listing.rating > 0 && (
                <View style={styles.avgRatingBadge}>
                  <Feather name="star" size={12} color={orbit.warning} />
                  <Text style={styles.avgRatingText}>
                    {listing.rating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>

            {reviews.length === 0 ? (
              <View style={styles.noReviews}>
                <Feather name="message-square" size={24} color={orbit.textTertiary} />
                <Text style={styles.noReviewsText}>Abhi koi reviews nahi hain</Text>
              </View>
            ) : (
              <View style={styles.reviewList}>
                {reviews.map((review, idx) => (
                  <React.Fragment key={review.id}>
                    <ReviewRow review={review} />
                    {idx < reviews.length - 1 && <Divider inset={52} />}
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Write review — shown only if not owner and not already reviewed */}
            {myUid && !isOwner && !hasReviewed && (
              <WriteReviewForm
                onSubmit={handleSubmitReview}
                submitting={reviewSubmitting}
              />
            )}
            {hasReviewed && (
              <View style={styles.reviewedBanner}>
                <Feather name="check-circle" size={14} color={orbit.success} />
                <Text style={styles.reviewedBannerText}>
                  Tumne yeh gig review kar diya hai
                </Text>
              </View>
            )}
          </View>

        </View>
      </ScrollView>

      {/* ── Sticky order bar ──────────────────────────────────── */}
      <View
        style={[
          styles.orderBar,
          { paddingBottom: Platform.OS === 'web' ? 12 : insets.bottom + 12 },
        ]}
      >
        <View style={styles.orderBarInner}>
          {/* Price */}
          <View>
            <Text style={styles.orderBarLabel}>Starting at</Text>
            <Text style={styles.orderBarPrice}>
              ₹{listing.priceINR.toLocaleString()}
            </Text>
          </View>

          {/* CTA buttons */}
          {isOwner ? (
            <TouchableOpacity style={styles.manageBtn} activeOpacity={0.85}>
              <Feather name="settings" size={15} color={orbit.textPrimary} />
              <Text style={styles.manageBtnText}>Manage Gig</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ctaBtns}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={handleMessage}
                activeOpacity={0.85}
              >
                <Feather name="message-circle" size={16} color={orbit.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orderBtn, orderLoading && styles.orderBtnDisabled]}
                onPress={handleOrder}
                disabled={orderLoading}
                activeOpacity={0.88}
              >
                {orderLoading ? (
                  <ActivityIndicator color={orbit.white} size="small" />
                ) : (
                  <>
                    <Feather name="shopping-bag" size={15} color={orbit.white} />
                    <Text style={styles.orderBtnText}>Order Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const CAROUSEL_H = SCREEN_W * (9 / 16);

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },

  /* ── Floating back ── */
  floatingHeader: {
    position:   'absolute',
    left:       16,
    zIndex:     10,
  },
  floatingBack: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: 'rgba(10,10,11,0.70)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
  },

  /* ── Not found ── */
  notFoundHeader: {
    paddingHorizontal: 16,
    paddingBottom:     12,
  },
  notFoundText: {
    color:      orbit.textPrimary,
    fontSize:   18,
    fontWeight: '700',
    marginTop:  12,
  },
  notFoundSub: {
    color:    orbit.textSecond,
    fontSize: 14,
  },

  /* ── Carousel ── */
  carouselWrap: {
    width:  SCREEN_W,
    height: CAROUSEL_H,
  },
  carouselImage: {
    width:  SCREEN_W,
    height: CAROUSEL_H,
  },
  carouselPlaceholder: {
    width:           SCREEN_W,
    height:          CAROUSEL_H,
    backgroundColor: orbit.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  carouselDots: {
    position:       'absolute',
    bottom:         10,
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
  },
  carouselDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  carouselDotActive: {
    backgroundColor: orbit.white,
    width:           16,
  },

  /* ── Content ── */
  content: {
    paddingHorizontal: 20,
    paddingTop:        20,
    gap:               20,
  },

  /* ── Category tag ── */
  categoryTag: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    alignSelf:       'flex-start',
    backgroundColor: orbit.accentSoftSolid,
    paddingHorizontal:10,
    paddingVertical:  4,
    borderRadius:     6,
    borderWidth:      1,
    borderColor:      orbit.accent + '40',
  },
  categoryTagText: {
    color:         orbit.accent,
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.3,
  },

  /* ── Title ── */
  listingTitle: {
    color:         orbit.textPrimary,
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.4,
    lineHeight:    30,
  },

  /* ── Rating row ── */
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    flexWrap:      'wrap',
  },
  ratingStars: {
    flexDirection: 'row',
    gap:           2,
  },
  ratingVal: {
    color:      orbit.textPrimary,
    fontSize:   14,
    fontWeight: '600',
    marginLeft: 2,
  },
  ratingCount: {
    color:    orbit.textTertiary,
    fontSize: 13,
  },
  ratingDot: {
    width:           3,
    height:          3,
    borderRadius:    1.5,
    backgroundColor: orbit.textTertiary,
    marginHorizontal:3,
  },
  deliveryText: {
    color:    orbit.textTertiary,
    fontSize: 13,
    marginLeft:2,
  },

  /* ── Tags ── */
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           7,
  },
  tagPill: {
    backgroundColor:   orbit.surface2,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       orbit.borderSubtle,
  },
  tagPillText: {
    color:      orbit.textSecond,
    fontSize:   12,
    fontWeight: '500',
  },

  /* ── Section ── */
  section: { gap: 14 },
  sectionTitle: {
    color:         orbit.textPrimary,
    fontSize:      17,
    fontWeight:    '700',
    letterSpacing: -0.2,
  },

  /* ── Description ── */
  descriptionText: {
    color:      orbit.textSecond,
    fontSize:   15,
    lineHeight: 23,
  },

  /* ── ORBIT Card ── */
  orbitCard: {
    backgroundColor: orbit.surface1,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    borderRadius:    16,
    padding:         16,
    gap:             12,
  },
  orbitCardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  orbitCardHeaderInfo: {
    flex: 1,
    gap:  4,
  },
  orbitCardName: {
    color:         orbit.textPrimary,
    fontSize:      17,
    fontWeight:    '700',
    letterSpacing: -0.3,
  },
  orbitCardHandle: {
    color:     orbit.textSecond,
    fontSize:  13,
  },
  orbitCardBio: {
    color:      orbit.textSecond,
    fontSize:   14,
    lineHeight: 20,
  },
  orbitCardSkills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
  },
  skillTag: {
    backgroundColor:   orbit.surface2,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      6,
  },
  skillTagText: {
    color:      orbit.textSecond,
    fontSize:   11,
    fontWeight: '500',
  },
  orbitCardFooter: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 14,
    backgroundColor: orbit.surface2,
    borderRadius:    12,
  },
  cardStat: {
    flex:           1,
    alignItems:     'center',
  },
  cardStatVal: {
    color:         orbit.textPrimary,
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.3,
  },
  cardStatLbl: {
    color:         orbit.textTertiary,
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.5,
    marginTop:     3,
  },
  cardStatDivider: {
    width:           1,
    height:          24,
    backgroundColor: orbit.borderSubtle,
  },
  trustTrack: {
    height:          4,
    borderRadius:    2,
    backgroundColor: orbit.surface2,
    overflow:        'hidden',
  },
  trustFill: {
    height:       '100%',
    borderRadius: 2,
  },
  messageBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical: 12,
    borderRadius:    10,
    backgroundColor: orbit.accentSoftSolid,
    borderWidth:     1,
    borderColor:     orbit.accent + '40',
  },
  messageBtnText: {
    color:      orbit.accent,
    fontSize:   14,
    fontWeight: '600',
  },

  /* ── Seller placeholder ── */
  sellerPlaceholder: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: orbit.surface1,
    borderRadius:    14,
    padding:         14,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
  },
  sellerPlaceholderName: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '600',
  },
  sellerPlaceholderSub: {
    color:    orbit.textSecond,
    fontSize: 13,
    marginTop:2,
  },

  /* ── Reviews ── */
  reviewsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  avgRatingBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: orbit.warningSoft,
    paddingHorizontal:10,
    paddingVertical:  4,
    borderRadius:     8,
  },
  avgRatingText: {
    color:      orbit.warning,
    fontSize:   13,
    fontWeight: '700',
  },
  noReviews: {
    alignItems:    'center',
    paddingVertical:24,
    gap:           8,
  },
  noReviewsText: {
    color:    orbit.textTertiary,
    fontSize: 14,
  },
  reviewList: {
    backgroundColor: orbit.surface1,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    overflow:        'hidden',
  },
  reviewRow: {
    flexDirection: 'row',
    gap:           12,
    padding:       14,
  },
  reviewContent: {
    flex: 1,
    gap:  6,
  },
  reviewTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  reviewerName: {
    color:      orbit.textPrimary,
    fontSize:   14,
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
    gap:           2,
  },
  reviewComment: {
    color:      orbit.textSecond,
    fontSize:   13,
    lineHeight: 19,
  },

  /* ── Write review form ── */
  writeReviewForm: {
    backgroundColor: orbit.surface1,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    padding:         16,
    gap:             14,
    marginTop:       4,
  },
  writeReviewTitle: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '700',
  },
  starSelector: {
    flexDirection: 'row',
    gap:           8,
  },
  reviewInputBox: {
    backgroundColor:  orbit.surface2,
    borderRadius:     10,
    borderWidth:      1,
    borderColor:      orbit.borderStrong,
    padding:          12,
    height:           88,
  },
  reviewInput: {
    color:             orbit.textPrimary,
    fontSize:          14,
    lineHeight:        20,
    padding:           0,
    textAlignVertical: 'top',
    height:            '100%',
  },
  reviewSubmitBtn: {
    backgroundColor: orbit.accent,
    borderRadius:    10,
    paddingVertical: 13,
    alignItems:      'center',
  },
  reviewSubmitBtnText: {
    color:      orbit.white,
    fontSize:   14,
    fontWeight: '600',
  },
  reviewedBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: orbit.successSoft,
    borderRadius:    10,
    paddingVertical: 12,
    paddingHorizontal:14,
  },
  reviewedBannerText: {
    color:      orbit.success,
    fontSize:   13,
    fontWeight: '500',
  },

  /* ── Order bar ── */
  orderBar: {
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
  orderBarInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
  },
  orderBarLabel: {
    color:      orbit.textTertiary,
    fontSize:   11,
    fontWeight: '500',
  },
  orderBarPrice: {
    color:         orbit.textPrimary,
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  ctaBtns: {
    flexDirection: 'row',
    gap:           10,
    alignItems:    'center',
  },
  contactBtn: {
    width:           46,
    height:          46,
    borderRadius:    12,
    backgroundColor: orbit.surface2,
    borderWidth:     1,
    borderColor:     orbit.borderStrong,
    alignItems:      'center',
    justifyContent:  'center',
  },
  orderBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              8,
    backgroundColor:  orbit.accent,
    paddingVertical:  14,
    paddingHorizontal:24,
    borderRadius:     13,
    minWidth:         130,
  },
  orderBtnDisabled: {
    opacity: 0.6,
  },
  orderBtnText: {
    color:      orbit.white,
    fontSize:   15,
    fontWeight: '700',
  },
  manageBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              8,
    backgroundColor:  orbit.surface2,
    borderWidth:      1,
    borderColor:      orbit.borderStrong,
    paddingVertical:  14,
    paddingHorizontal:24,
    borderRadius:     13,
  },
  manageBtnText: {
    color:      orbit.textPrimary,
    fontSize:   15,
    fontWeight: '600',
  },
});

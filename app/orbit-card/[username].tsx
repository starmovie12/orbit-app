/**
 * ORBIT — Public ORBIT Card Screen
 * Route: /orbit-card/[username]
 *
 * Features:
 *   • Fetches user by username via /usernames/{username} → /users/{uid}
 *   • Deep link friendly — Branch.io short URL shared via RN Share API
 *   • QR code rendered via react-native-svg (dots matrix, deterministic)
 *   • Skill tags from user.interests
 *   • Testimonials section (Firestore /users/{uid}/testimonials subcollection)
 *   • Karma tier badge, trust score bar, stats strip
 *   • "Add Testimonial" CTA for logged-in users (not the card owner)
 *   • Copy link, native share, download prompts
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';

import { Avatar, TierPill, ScreenHeader } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { type UserDoc } from '@/lib/firestore-users';

/* ─────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────── */

const BRANCH_BASE_URL = 'https://orbit.app.link/card/';
const USERS_COL       = 'users';
const USERNAMES_COL   = 'usernames';
const TESTIMONIALS_COL = 'testimonials';
const MAX_TESTIMONIALS = 5;

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type KarmaTier = 'LEGEND' | 'MASTER' | 'PRO' | 'RISING';

type TestimonialDoc = {
  id:          string;
  fromUid:     string;
  fromName:    string;
  text:        string;
  createdAt:   any;
};

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function karmaToTier(karma: number): KarmaTier {
  if (karma >= 2000) return 'LEGEND';
  if (karma >= 501)  return 'MASTER';
  if (karma >= 101)  return 'PRO';
  return 'RISING';
}

function tierColor(tier: KarmaTier): string {
  switch (tier) {
    case 'LEGEND': return orbit.warning;
    case 'MASTER': return orbit.accent;
    case 'PRO':    return orbit.success;
    default:       return orbit.danger;
  }
}

function tierLabel(tier: KarmaTier): string {
  switch (tier) {
    case 'LEGEND': return 'All privileges · Verified badge';
    case 'MASTER': return 'Priority support · All features';
    case 'PRO':    return 'Spotlight eligible · Blue dot';
    default:       return 'Rising member of Orbit';
  }
}

function snapExists(snap: any): boolean {
  if (typeof snap.exists === 'function') return snap.exists();
  return !!snap.exists;
}

function fmtTimestamp(ts: any): string {
  if (!ts) return '';
  const d: Date | null =
    typeof ts?.toDate === 'function' ? ts.toDate() :
    ts instanceof Date ? ts : null;
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────────
   QR Code — deterministic dot-matrix via react-native-svg
   Generates a 21×21 visual fingerprint seeded on the username string.
   Not a scannable ISO QR — a branded visual identity mark.
───────────────────────────────────────────────────────────────────── */

const QR_SIZE   = 140;
const QR_CELLS  = 21;
const CELL_SIZE = QR_SIZE / QR_CELLS;

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

/** Returns true if cell (r, c) should be filled — seeded by username. */
function cellFilled(username: string, row: number, col: number): boolean {
  // Fixed finder patterns (top-left, top-right, bottom-left corners)
  const isCorner =
    (row < 7 && col < 7) ||
    (row < 7 && col >= QR_CELLS - 7) ||
    (row >= QR_CELLS - 7 && col < 7);
  if (isCorner) {
    // 7×7 finder: outer ring + inner 3×3
    const dr = row < 7 ? row : row - (QR_CELLS - 7);
    const dc = col < 7 ? col : col >= QR_CELLS - 7 ? col - (QR_CELLS - 7) : col;
    const inOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
    const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
    return inOuter || inInner;
  }
  const seed = hashStr(`${username}:${row}:${col}`);
  return (seed & 0x1) === 1;
}

function QRCode({ username, size = QR_SIZE }: { username: string; size?: number }) {
  const cell = size / QR_CELLS;
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < QR_CELLS; r++) {
    for (let c = 0; c < QR_CELLS; c++) {
      if (cellFilled(username, r, c)) {
        cells.push({ r, c });
      }
    }
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill={orbit.surface2} rx={8} />
      {cells.map(({ r, c }) => (
        <Rect
          key={`${r}:${c}`}
          x={c * cell + 1}
          y={r * cell + 1}
          width={cell - 2}
          height={cell - 2}
          rx={1.5}
          fill={orbit.textPrimary}
        />
      ))}
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Skill Tag
───────────────────────────────────────────────────────────────────── */

function SkillTag({ label }: { label: string }) {
  return (
    <View style={styles.skillTag}>
      <Text style={styles.skillTagText}>{label}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Testimonial Row
───────────────────────────────────────────────────────────────────── */

function TestimonialRow({ item }: { item: TestimonialDoc }) {
  return (
    <View style={styles.testimonialRow}>
      <Avatar name={item.fromName} size={36} />
      <View style={styles.testimonialBody}>
        <View style={styles.testimonialHeader}>
          <Text style={styles.testimonialName}>{item.fromName}</Text>
          {!!fmtTimestamp(item.createdAt) && (
            <Text style={styles.testimonialDate}>{fmtTimestamp(item.createdAt)}</Text>
          )}
        </View>
        <Text style={styles.testimonialText} numberOfLines={3}>{item.text}</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Trust Bar
───────────────────────────────────────────────────────────────────── */

function TrustBar({ score }: { score: number }) {
  const color =
    score >= 90 ? orbit.success :
    score >= 70 ? orbit.warning :
    orbit.danger;
  return (
    <View style={styles.trustCard}>
      <View style={styles.trustHeader}>
        <View style={styles.trustHeaderLeft}>
          <Feather name="shield" size={13} color={orbit.textSecond} />
          <Text style={styles.trustLabel}>TRUST SCORE</Text>
        </View>
        <Text style={[styles.trustVal, { color }]}>{score}</Text>
      </View>
      <View style={styles.trustTrack}>
        <View
          style={[
            styles.trustFill,
            { width: `${Math.min(100, Math.max(0, score))}%` as any, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Add Testimonial Modal (inline input)
───────────────────────────────────────────────────────────────────── */

import { TextInput } from 'react-native';

function AddTestimonialRow({
  targetUid,
  fromName,
  fromUid,
  onAdded,
}: {
  targetUid: string;
  fromName:  string;
  fromUid:   string;
  onAdded:   () => void;
}) {
  const [text, setText]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [open, setOpen]       = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 10) {
      Alert.alert('Too short', 'Write at least 10 characters.');
      return;
    }
    setSaving(true);
    try {
      await firestore()
        .collection(USERS_COL)
        .doc(targetUid)
        .collection(TESTIMONIALS_COL)
        .add({
          fromUid,
          fromName,
          text: trimmed.slice(0, 200),
          createdAt: firestore.FieldValue.serverTimestamp?.() ?? new Date(),
        });
      setText('');
      setOpen(false);
      onAdded();
    } catch {
      Alert.alert('Error', 'Could not save testimonial. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <TouchableOpacity style={styles.addTestimonialBtn} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Feather name="plus" size={15} color={orbit.accent} />
        <Text style={styles.addTestimonialText}>Write a testimonial</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.addTestimonialForm}>
      <TextInput
        style={styles.testimonialInput}
        placeholder="What makes this person stand out?"
        placeholderTextColor={orbit.textTertiary}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={200}
        autoFocus
      />
      <View style={styles.addTestimonialActions}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => { setText(''); setOpen(false); }}
          disabled={saving}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, (!text.trim() || saving) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!text.trim() || saving}
          activeOpacity={0.75}
        >
          {saving
            ? <ActivityIndicator size="small" color={orbit.white} />
            : <Text style={styles.submitBtnText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function OrbitCardScreen() {
  const { username }     = useLocalSearchParams<{ username: string }>();
  const insets           = useSafeAreaInsets();
  const router           = useRouter();
  const { firebaseUser, user: meUser } = useAuth();

  const [target, setTarget]             = useState<UserDoc | null>(null);
  const [testimonials, setTestimonials] = useState<TestimonialDoc[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [sharing, setSharing]           = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  const shareUrl = `${BRANCH_BASE_URL}${username ?? ''}`;
  const isMe     = !!firebaseUser && target?.uid === firebaseUser.uid;

  /* ── Fetch user by username ── */
  useEffect(() => {
    if (!username) {
      setError('No username provided.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchCard() {
      try {
        const handle    = (username as string).toLowerCase().replace(/^@/, '');
        const handleSnap = await firestore().collection(USERNAMES_COL).doc(handle).get();
        if (!snapExists(handleSnap)) {
          if (!cancelled) { setError('User not found.'); setLoading(false); }
          return;
        }
        const uid = (handleSnap.data() as { uid: string }).uid;
        const userSnap = await firestore().collection(USERS_COL).doc(uid).get();
        if (!snapExists(userSnap) || cancelled) {
          if (!cancelled) { setError('Profile unavailable.'); setLoading(false); }
          return;
        }
        const doc = userSnap.data() as UserDoc;

        // Fetch testimonials subcollection
        const tSnap = await firestore()
          .collection(USERS_COL)
          .doc(uid)
          .collection(TESTIMONIALS_COL)
          .orderBy('createdAt', 'desc')
          .limit(MAX_TESTIMONIALS)
          .get();

        const tList: TestimonialDoc[] = tSnap.docs.map(d => ({
          id:        d.id,
          fromUid:   d.data().fromUid  ?? '',
          fromName:  d.data().fromName ?? 'Orbit User',
          text:      d.data().text     ?? '',
          createdAt: d.data().createdAt,
        }));

        if (!cancelled) {
          setTarget(doc);
          setTestimonials(tList);
          setLoading(false);
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 80,
            friction: 9,
          }).start();
        }
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load profile.');
          setLoading(false);
        }
      }
    }

    fetchCard();
    return () => { cancelled = true; };
  }, [username]);

  /* ── Refresh testimonials after add ── */
  const refreshTestimonials = useCallback(async () => {
    if (!target?.uid) return;
    try {
      const tSnap = await firestore()
        .collection(USERS_COL)
        .doc(target.uid)
        .collection(TESTIMONIALS_COL)
        .orderBy('createdAt', 'desc')
        .limit(MAX_TESTIMONIALS)
        .get();
      setTestimonials(tSnap.docs.map(d => ({
        id:        d.id,
        fromUid:   d.data().fromUid  ?? '',
        fromName:  d.data().fromName ?? 'Orbit User',
        text:      d.data().text     ?? '',
        createdAt: d.data().createdAt,
      })));
    } catch {}
  }, [target?.uid]);

  /* ── Share via Branch.io deep link + native share sheet ── */
  const handleShare = useCallback(async () => {
    if (!target) return;
    setSharing(true);
    try {
      const displayName = target.displayName || target.username || 'Someone';
      const message =
        `Check out ${displayName}'s ORBIT Card 🚀\n` +
        `Karma: ${(target.karma ?? 0).toLocaleString('en-IN')} · ` +
        `Tier: ${karmaToTier(target.karma ?? 0)}\n\n${shareUrl}`;

      await Share.share(
        Platform.OS === 'ios'
          ? { url: shareUrl, message }
          : { message },
        { dialogTitle: `Share ${displayName}'s ORBIT Card` }
      );
    } catch {
      /* user dismissed */
    } finally {
      setSharing(false);
    }
  }, [target, shareUrl]);

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={orbit.accent} size="large" />
        <Text style={styles.loadingText}>Loading card…</Text>
      </View>
    );
  }

  if (error || !target) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Feather name="user-x" size={36} color={orbit.textTertiary} />
        <Text style={styles.errorTitle}>{error ?? 'Profile not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = target.displayName || target.username || 'Orbit User';
  const handle      = target.username ? `@${target.username}` : '';
  const tier        = karmaToTier(target.karma ?? 0);
  const tColor      = tierColor(tier);
  const skills      = target.interests ?? [];

  const karma    = target.karma    ?? 0;
  const rank     = target.rank;
  const trustSc  = target.trustScore ?? 50;
  const posts    = target.posts    ?? 0;
  const watches  = target.watches  ?? 0;

  const canTestify =
    !!firebaseUser &&
    !isMe &&
    !testimonials.some(t => t.fromUid === firebaseUser.uid);

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="ORBIT Card"
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            style={styles.shareHeaderBtn}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.75}
          >
            {sharing
              ? <ActivityIndicator size="small" color={orbit.accent} />
              : <Feather name="share-2" size={20} color={orbit.accent} />}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card Hero ── */}
        <Animated.View style={[styles.cardHero, { transform: [{ scale: scaleAnim }] }]}>
          {/* Accent stripe */}
          <View style={[styles.cardStripe, { backgroundColor: tColor }]} />

          <View style={styles.cardInner}>
            {/* Top row: avatar + identity */}
            <View style={styles.heroRow}>
              <Avatar name={displayName} size={64} ringed />
              <View style={styles.heroIdentity}>
                <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
                {!!handle && <Text style={styles.heroHandle}>{handle}</Text>}
                <View style={styles.heroBadgeRow}>
                  <TierPill tier={tier} solid />
                  {rank != null && (
                    <View style={styles.rankPill}>
                      <Text style={styles.rankPillText}>#{rank} Global</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Bio */}
            {!!target.bio && (
              <Text style={styles.heroBio} numberOfLines={2}>{target.bio}</Text>
            )}

            {/* Stats strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: tColor }]}>
                  {karma.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.statLbl}>KARMA</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{posts.toLocaleString('en-IN')}</Text>
                <Text style={styles.statLbl}>POSTS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{watches.toLocaleString('en-IN')}</Text>
                <Text style={styles.statLbl}>WATCHES</Text>
              </View>
            </View>

            {/* Tier privilege label */}
            <View style={styles.tierHint}>
              <View style={[styles.tierDot, { backgroundColor: tColor }]} />
              <Text style={styles.tierHintText}>{tierLabel(tier)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Skill Tags ── */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SKILLS & INTERESTS</Text>
            <View style={styles.skillsWrap}>
              {skills.map((s, i) => <SkillTag key={i} label={s} />)}
            </View>
          </View>
        )}

        {/* ── Trust Score ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRUST SCORE</Text>
          <TrustBar score={trustSc} />
        </View>

        {/* ── QR Code + Share ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCAN TO CONNECT</Text>
          <View style={styles.qrCard}>
            <QRCode username={target.username ?? displayName} size={140} />
            <View style={styles.qrInfo}>
              <Text style={styles.qrTitle}>Share your card</Text>
              <Text style={styles.qrSubtitle} numberOfLines={2}>{shareUrl}</Text>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShare}
                activeOpacity={0.8}
                disabled={sharing}
              >
                {sharing
                  ? <ActivityIndicator size="small" color={orbit.white} />
                  : (
                    <>
                      <Feather name="share-2" size={14} color={orbit.white} />
                      <Text style={styles.shareBtnText}>Share Card</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Testimonials ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>TESTIMONIALS</Text>
            {testimonials.length > 0 && (
              <Text style={styles.sectionCount}>{testimonials.length}</Text>
            )}
          </View>

          {testimonials.length === 0 && (
            <View style={styles.emptyTestimonials}>
              <Feather name="message-square" size={22} color={orbit.textTertiary} />
              <Text style={styles.emptyTestimonialsText}>No testimonials yet</Text>
            </View>
          )}

          {testimonials.length > 0 && (
            <View style={styles.testimonialsCard}>
              {testimonials.map((t, i) => (
                <React.Fragment key={t.id}>
                  <TestimonialRow item={t} />
                  {i < testimonials.length - 1 && (
                    <View style={styles.testimonialDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {canTestify && (
            <View style={styles.addTestimonialWrap}>
              <AddTestimonialRow
                targetUid={target.uid}
                fromUid={firebaseUser!.uid}
                fromName={meUser?.displayName || meUser?.username || 'You'}
                onAdded={refreshTestimonials}
              />
            </View>
          )}
        </View>

        {/* ── Deep link footnote ── */}
        <View style={styles.footnote}>
          <Feather name="link" size={11} color={orbit.textTertiary} />
          <Text style={styles.footnoteText}>
            orbit.app.link/card/{target.username ?? ''}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  loadingText: {
    color: orbit.textTertiary,
    fontSize: 13,
    marginTop: 12,
  },
  errorTitle: {
    color: orbit.textSecond,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: orbit.surface2,
    borderRadius: 10,
  },
  backBtnText: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },

  shareHeaderBtn: { padding: 4 },

  /* ── Card hero ── */
  cardHero: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cardStripe: { height: 4, width: '100%' },
  cardInner:  { padding: 20 },

  heroRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroIdentity:  { flex: 1, marginLeft: 14 },
  heroName: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  heroHandle:   { color: orbit.textSecond, fontSize: 13, marginBottom: 8 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  rankPill: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankPillText: { color: orbit.textSecond, fontSize: 11, fontWeight: '600' },

  heroBio: {
    color: orbit.textSecond,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 14,
  },
  statBox:    { flex: 1, alignItems: 'center' },
  statVal:    { color: orbit.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  statLbl:    { color: orbit.textTertiary, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },
  statDivider:{ width: 1, height: 26, backgroundColor: orbit.borderSubtle, alignSelf: 'center' },

  tierHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierDot:  { width: 6, height: 6, borderRadius: 3 },
  tierHintText: { color: orbit.textTertiary, fontSize: 12 },

  /* ── Sections ── */
  section: { marginTop: 24 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  sectionCount: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 12,
  },

  /* ── Skills ── */
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillTag:   {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  skillTagText: { color: orbit.textSecond, fontSize: 12, fontWeight: '500' },

  /* ── Trust ── */
  trustCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 14,
  },
  trustHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  trustHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustLabel:       { color: orbit.textSecond, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  trustVal:         { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  trustTrack: {
    height: 5,
    backgroundColor: orbit.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trustFill: { height: '100%', borderRadius: 3 },

  /* ── QR Card ── */
  qrCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qrInfo:      { flex: 1 },
  qrTitle:     { color: orbit.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 4 },
  qrSubtitle:  { color: orbit.textTertiary, fontSize: 11, lineHeight: 15, marginBottom: 14 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: orbit.accent,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shareBtnText: { color: orbit.white, fontSize: 13, fontWeight: '600' },

  /* ── Testimonials ── */
  testimonialsCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: 'hidden',
  },
  testimonialRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  testimonialBody: { flex: 1 },
  testimonialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  testimonialName: { color: orbit.textPrimary, fontSize: 13, fontWeight: '600' },
  testimonialDate: { color: orbit.textTertiary, fontSize: 11 },
  testimonialText: { color: orbit.textSecond, fontSize: 13, lineHeight: 18 },
  testimonialDivider: { height: 1, backgroundColor: orbit.borderSubtle, marginLeft: 62 },

  emptyTestimonials: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    gap: 8,
  },
  emptyTestimonialsText: { color: orbit.textTertiary, fontSize: 13 },

  addTestimonialWrap: { marginTop: 10 },
  addTestimonialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
  },
  addTestimonialText: { color: orbit.accent, fontSize: 13, fontWeight: '600' },
  addTestimonialForm: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
    padding: 14,
  },
  testimonialInput: {
    color: orbit.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  addTestimonialActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: orbit.surface2,
    borderRadius: 8,
  },
  cancelBtnText: { color: orbit.textSecond, fontSize: 13, fontWeight: '500' },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: orbit.accent,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnText: { color: orbit.white, fontSize: 13, fontWeight: '600' },

  /* ── Footnote ── */
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 28,
  },
  footnoteText: { color: orbit.textTertiary, fontSize: 11 },
});

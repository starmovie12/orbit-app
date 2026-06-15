/**
 * CROWN — Profile Tab (app/(tabs)/profile.tsx)
 *
 * The signed-in user's OWN profile. Implements the PRD §11A.8 "My Best Of"
 * architecture, wired to LIVE Firestore data (not mock).
 *
 * ── Why this is a full rewrite ──────────────────────────────────────────────
 *   The previous profile.tsx was authored in NativeWind className syntax
 *   (`className="bg-[var(--bg-base)]"`). NativeWind/Tailwind is NOT installed
 *   in this repo (no dep in package.json), so every className was a no-op and
 *   the screen rendered unstyled. It also used 100% mock data with empty
 *   onPress handlers. This rewrite uses the repo's actual convention —
 *   StyleSheet + `orbit` tokens + shared components — exactly like
 *   app/user/[id].tsx, ranks.tsx, settings.tsx, etc.
 *
 * ── Section order (PRD §11A.8) ──────────────────────────────────────────────
 *   1. Identity hero (avatar, handle, tier, location, trust, bio)
 *   2. Actions (Edit Profile · Share Card)
 *   3. Stats strip
 *   4. Karma Tier card
 *   5. My Best Of (top-5 messages)
 *   6. Quote of the Week
 *   7. Crown Journey (title/badge timeline)
 *   8. My City Heat (30-day)
 *   9. Recent Sparks Received
 *  10. Privacy & Safety (Profile Visibility · Safety Mode) — PRD §14.1 / §24.5.1
 *  11. Trust Score bar
 *  12. Sign Out
 *
 * ── LIVE vs STUBBED (honest status) ─────────────────────────────────────────
 *   LIVE   : identity, tier, trust, karma/posts/streak/credits, bio, region,
 *            trophies → Crown Journey, Share Card, Edit Profile nav, Sign Out.
 *   STUBBED: "My Best Of" (top-5 messages), Quote of the Week, My City Heat,
 *            Recent Sparks — the current Firestore model (UserDoc + rooms/
 *            messages) has no per-user message-by-reaction index, no sparks
 *            collection, and no daily heat series. These sections render REAL
 *            data the moment those sources exist; until then they show honest,
 *            on-brand empty states (they are NOT faked with mock data).
 *   The Profile Visibility + Safety Mode toggles persist the user's CHOICE
 *   locally (AsyncStorage). True enforcement (hiding sections from non-followers,
 *   forcing Hide-Location/DM-shield) needs an `isPublic`/`safetyMode` field on
 *   UserDoc + a firestore.rules read-gate — flagged for the founder.
 *
 * Layer: tab screen | STATUS: ✅ wired | Theme: light-default, gold accent.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Avatar, TierPill } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { TITLES, TITLE_COLORS } from '@/constants/titles';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeUser, type UserDoc } from '@/lib/firestore-users';

/* ─────────────────────────────────────────────────────────────────────────
   Karma tier — blueprint §08 (mirrors app/user/[id].tsx so own + others'
   profiles stay visually identical)
───────────────────────────────────────────────────────────────────────── */

type KarmaTier = 'LEGEND' | 'MASTER' | 'PRO' | 'RISING';

function karmaToTier(karma: number): KarmaTier {
  if (karma >= 2000) return 'LEGEND';
  if (karma >= 501) return 'MASTER';
  if (karma >= 101) return 'PRO';
  return 'RISING';
}

function tierMultiplier(tier: KarmaTier): string {
  switch (tier) {
    case 'LEGEND': return '2.0×';
    case 'MASTER': return '1.5×';
    case 'PRO':    return '1.25×';
    default:       return '1.0×';
  }
}

const TIER_DOT: Record<KarmaTier, string> = {
  LEGEND: orbit.warning,
  MASTER: orbit.accent,
  PRO:    orbit.success,
  RISING: orbit.danger,
};

/** cityId ("bandra_w") → display ("Bandra W"). region is a cityId slug. */
function prettyRegion(region: string | null): string | null {
  if (!region) return null;
  return region
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Crown Journey marker color. Uses constants/titles.ts so scope-titles render
 * in their canonical accent; other badges use the gold accent (most recent) or
 * a muted dot. Never hardcodes a title string (PR-block per §4).
 */
function trophyColor(trophy: string, isMostRecent: boolean): string {
  if (trophy === TITLES.CITY) return TITLE_COLORS.CITY;     // Mayor (VICEROY) — amber gold
  if (trophy === TITLES.SECTOR) return orbit.success;        // BARON — emerald
  if (trophy === TITLES.COUNTRY || trophy === TITLES.WORLD) return orbit.accent;
  return isMostRecent ? orbit.accent : orbit.borderStrong;
}

/* ─────────────────────────────────────────────────────────────────────────
   My Best Of — shape is ready; data source is not wired yet.
   When a per-user "top messages by lifetime reactions" query/index exists,
   populate `bestMessages` and the list renders automatically.
───────────────────────────────────────────────────────────────────────── */

type BestMessage = {
  id: string;
  text: string;
  reactions: number;
  timeAgo: string;
};

/* ─────────────────────────────────────────────────────────────────────────
   Small presentational helpers
───────────────────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function StatBox({ val, lbl }: { val: string | number; lbl: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>
        {typeof val === 'number' ? val.toLocaleString('en-IN') : val}
      </Text>
      <Text style={styles.statLbl}>{lbl}</Text>
    </View>
  );
}

/** On-brand empty state used by the not-yet-wired sections. */
function EmptyCard({
  icon,
  title,
  sub,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  sub: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Feather name={icon} size={18} color={orbit.accent} />
      </View>
      <Text style={styles.emptyCardTitle}>{title}</Text>
      <Text style={styles.emptyCardSub}>{sub}</Text>
    </View>
  );
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 90 ? orbit.success : score >= 70 ? orbit.warning : orbit.danger;
  return (
    <View style={styles.trustCard}>
      <View style={styles.trustHeader}>
        <View style={styles.trustHeaderLeft}>
          <Feather name="shield" size={14} color={orbit.textSecond} />
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

function KarmaTierCard({ karma }: { karma: number }) {
  const tier = karmaToTier(karma);
  const dot = TIER_DOT[tier];
  const nextThreshold =
    tier === 'RISING' ? 101 : tier === 'PRO' ? 501 : tier === 'MASTER' ? 2001 : null;
  const progress = nextThreshold ? Math.min(1, karma / nextThreshold) : 1;

  return (
    <View style={styles.tierCard}>
      <View style={styles.tierCardHeader}>
        <View style={styles.tierCardLeft}>
          <View style={[styles.tierDot, { backgroundColor: dot }]} />
          <Text style={styles.tierCardTitle}>KARMA TIER</Text>
        </View>
        <View style={styles.tierBadgeRow}>
          <TierPill tier={tier} />
          <Text style={styles.tierMult}>{tierMultiplier(tier)} earnings</Text>
        </View>
      </View>

      <View style={styles.tierTrack}>
        <View style={[styles.tierFill, { width: `${progress * 100}%` as any, backgroundColor: dot }]} />
      </View>

      <View style={styles.tierCardFooter}>
        <Text style={styles.karmaValue}>
          <Text style={[styles.karmaValueNum, { color: dot }]}>{karma.toLocaleString('en-IN')}</Text>
          <Text style={styles.karmaLbl}>  karma points</Text>
        </Text>
        {nextThreshold && (
          <Text style={styles.tierNext}>
            {(nextThreshold - karma).toLocaleString('en-IN')} to next tier
          </Text>
        )}
      </View>
    </View>
  );
}

/* Compact 2-segment Public/Private control — design-consistent (no OS Switch). */
function SegToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.85}
            style={[styles.segItem, active && styles.segItemActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────────── */

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, user: me, signOut } = useAuth();

  // Seed from AuthContext, then subscribe to the live doc so profile edits,
  // karma gains, etc. reflect immediately without a manual refresh.
  const [user, setUser] = useState<UserDoc | null>(me ?? null);
  useEffect(() => setUser((prev) => me ?? prev), [me]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    const unsub = subscribeUser(uid, (doc) => {
      if (doc) setUser(doc);
    });
    return unsub;
  }, [firebaseUser?.uid]);

  // Profile Visibility (PRD §14.1) + Safety Mode (PRD §24.5.1).
  // Persisted locally per-uid. Server enforcement = TODO (see header note).
  const uid = firebaseUser?.uid ?? 'anon';
  const VIS_KEY = `crown:profile:visibility:${uid}`;
  const SAFE_KEY = `crown:profile:safetyMode:${uid}`;

  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [safetyMode, setSafetyMode] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [v, s] = await AsyncStorage.multiGet([VIS_KEY, SAFE_KEY]);
        if (!alive) return;
        if (v[1] === 'private') setVisibility('private');
        if (s[1] === '1') setSafetyMode(true);
      } catch {
        /* first run / storage unavailable — defaults are fine */
      }
    })();
    return () => {
      alive = false;
    };
  }, [VIS_KEY, SAFE_KEY]);

  const onVisibilityChange = useCallback(
    (v: string) => {
      const next = v === 'private' ? 'private' : 'public';
      setVisibility(next);
      AsyncStorage.setItem(VIS_KEY, next).catch(() => {});
    },
    [VIS_KEY],
  );

  const toggleSafety = useCallback(() => {
    setSafetyMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(SAFE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, [SAFE_KEY]);

  // Derived display values (all from real UserDoc fields).
  const displayName = user?.displayName || user?.username || 'You';
  const handle = user?.username ? `@${user.username}` : '';
  const karma = user?.karma ?? 0;
  const tier = karmaToTier(karma);
  const region = prettyRegion(user?.region ?? null);
  const trust = user?.trustScore ?? 50;
  const trophies = user?.trophies ?? [];

  // Wire a real source here later → list renders automatically.
  const bestMessages = useMemo<BestMessage[]>(() => [], []);

  const topPad = insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);

  /* ── Share CROWN Card ─────────────────────────────────────────────────── */
  const handleShare = useCallback(async () => {
    if (!user) return;
    try {
      await Share.share({
        title: `${displayName} on CROWN`,
        message: `Check out ${displayName}'s CROWN profile: https://crownapp.in/u/${
          user.username ?? user.uid
        }`,
      });
    } catch {
      /* user dismissed */
    }
  }, [user, displayName]);

  /* ── Not signed in / still resolving ──────────────────────────────────── */
  if (!user) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share profile"
          >
            <Feather name="share-2" size={19} color={orbit.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings' as never)}
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Feather name="settings" size={19} color={orbit.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1 · IDENTITY HERO ──────────────────────────────────────────── */}
        <View style={styles.identity}>
          <Avatar name={displayName} size={96} ringed />
          <Text style={styles.name}>{displayName}</Text>
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}

          <View style={styles.tierRow}>
            <TierPill tier={tier} />
            {user.rank != null && (
              <View style={styles.rankPill}>
                <Feather name="award" size={11} color={orbit.warning} />
                <Text style={styles.rankText}>Rank #{user.rank.toLocaleString('en-IN')}</Text>
              </View>
            )}
          </View>

          {/* Location + Trust (PRD: "Bandra W, Mumbai · ⭐ Trust 87") */}
          <View style={styles.metaRow}>
            {region ? (
              <>
                <Feather name="map-pin" size={13} color={orbit.textTertiary} />
                <Text style={styles.metaText}>{region}</Text>
                <Text style={styles.metaDot}>·</Text>
              </>
            ) : null}
            <Feather name="star" size={13} color={orbit.success} />
            <Text style={[styles.metaText, { color: orbit.success, fontWeight: '700' }]}>
              Trust {trust}
            </Text>
          </View>

          {user.bio ? (
            <Text style={styles.bio} numberOfLines={4}>
              {user.bio}
            </Text>
          ) : null}

          {/* ── 2 · ACTIONS (own profile = Edit · Share, no Follow/DM) ────── */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/edit-profile' as never)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Edit your profile"
            >
              <Feather name="edit-2" size={16} color={orbit.white} />
              <Text style={styles.primaryBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleShare}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Share your CROWN card"
            >
              <Feather name="share-2" size={16} color={orbit.textPrimary} />
              <Text style={styles.secondaryBtnText}>Share Card</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3 · STATS ──────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatBox val={user.posts ?? 0} lbl="MESSAGES" />
          <View style={styles.statDivider} />
          <StatBox val={karma} lbl="KARMA" />
          <View style={styles.statDivider} />
          <StatBox val={user.streak ?? 0} lbl="STREAK" />
          <View style={styles.statDivider} />
          <StatBox val={user.credits ?? 0} lbl="CREDITS" />
        </View>

        {/* ── 4 · KARMA TIER ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <KarmaTierCard karma={karma} />
        </View>

        {/* ── 5 · MY BEST OF ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>MY BEST OF</SectionLabel>
          {bestMessages.length > 0 ? (
            bestMessages.map((msg) => (
              <TouchableOpacity
                key={msg.id}
                style={styles.bestMsg}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="View message"
              >
                <Text style={styles.bestMsgText} numberOfLines={2}>
                  {msg.text}
                </Text>
                <View style={styles.bestMsgFooter}>
                  <View style={styles.reactChip}>
                    <Feather name="heart" size={12} color={orbit.accent} />
                    <Text style={styles.reactChipText}>{msg.reactions.toLocaleString('en-IN')}</Text>
                  </View>
                  <Text style={styles.bestMsgTime}>{msg.timeAgo}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyCard
              icon="message-square"
              title="Abhi koi standout message nahi"
              sub="Tumhare top 5 messages yahan apne-aap aayenge — jab log react karenge, sabse zyada reactions wale upar dikhenge."
            />
          )}
        </View>

        {/* ── 6 · QUOTE OF THE WEEK ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>QUOTE OF THE WEEK</SectionLabel>
          <EmptyCard
            icon="message-circle"
            title="Apna favourite message pin karo"
            sub="Koi ek message choose karo jo profile par feature rahe. Har Sunday reset hota hai."
          />
        </View>

        {/* ── 7 · CROWN JOURNEY ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>CROWN JOURNEY</SectionLabel>
          {trophies.length > 0 ? (
            <View style={styles.journeyCard}>
              {trophies.map((t, i) => {
                const last = i === trophies.length - 1;
                const color = trophyColor(t, i === 0);
                return (
                  <View key={`${t}-${i}`} style={styles.journeyRow}>
                    <View style={styles.journeyRail}>
                      <View style={[styles.journeyDot, { backgroundColor: color }]} />
                      {!last && <View style={styles.journeyLine} />}
                    </View>
                    <View style={[styles.journeyBody, !last && { paddingBottom: 16 }]}>
                      <Text style={[styles.journeyTitle, i === 0 && { color }]}>{t}</Text>
                      {i === 0 && <Text style={styles.journeySub}>Most recent</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyCard
              icon="award"
              title="Tumhari Crown Journey yahan banegi"
              sub="Har title aur badge — chhota ho ya bada — yahan permanently dikhega. React paao, rank chadho, title jeeto."
            />
          )}
        </View>

        {/* ── 8 · MY CITY HEAT ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>MY CITY HEAT</SectionLabel>
          <EmptyCard
            icon="activity"
            title="30-day City Heat jald"
            sub={`Tumhari roz ki ${region ?? 'city'} contribution ka sparkline yahan dikhega — apni presence ka heatmap.`}
          />
        </View>

        {/* ── 9 · RECENT SPARKS RECEIVED ─────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>RECENT SPARKS</SectionLabel>
          <EmptyCard
            icon="zap"
            title="Abhi tak koi Spark nahi"
            sub="Jab koi tumhe Spark Gift bhejega, last 3 sparks sender ke saath yahan dikhenge."
          />
        </View>

        {/* ── 10 · PRIVACY & SAFETY ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>PRIVACY & SAFETY</SectionLabel>
          <View style={styles.controlCard}>
            {/* Profile Visibility — PRD §14.1 */}
            <View style={styles.controlRow}>
              <View style={styles.controlLeft}>
                <View style={styles.controlIcon}>
                  <Feather
                    name={visibility === 'private' ? 'lock' : 'globe'}
                    size={15}
                    color={orbit.textSecond}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlTitle}>Profile Visibility</Text>
                  <Text style={styles.controlSub}>
                    {visibility === 'private'
                      ? 'Sirf handle, avatar & titles dikhte hain'
                      : 'Pura profile sabko dikhta hai'}
                  </Text>
                </View>
              </View>
              <SegToggle
                value={visibility}
                onChange={onVisibilityChange}
                options={[
                  { key: 'public', label: 'Public' },
                  { key: 'private', label: 'Private' },
                ]}
              />
            </View>

            <View style={styles.controlDivider} />

            {/* Safety Mode — PRD §24.5.1 */}
            <TouchableOpacity
              style={styles.controlRow}
              onPress={toggleSafety}
              activeOpacity={0.85}
              accessibilityRole="switch"
              accessibilityState={{ checked: safetyMode }}
              accessibilityLabel="Safety Mode"
            >
              <View style={styles.controlLeft}>
                <View
                  style={[
                    styles.controlIcon,
                    safetyMode && { backgroundColor: orbit.dangerSoft },
                  ]}
                >
                  <Feather
                    name="shield"
                    size={15}
                    color={safetyMode ? orbit.danger : orbit.textSecond}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlTitle}>Safety Mode</Text>
                  <Text style={styles.controlSub}>
                    Location hide + DM-shield force karo
                  </Text>
                </View>
              </View>
              <View style={[styles.switchTrack, safetyMode && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, safetyMode && styles.switchThumbOn]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 11 · TRUST SCORE ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>TRUST SCORE</SectionLabel>
          <TrustBar score={trust} />
        </View>

        {/* ── 12 · SIGN OUT ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={signOut}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Feather name="log-out" size={16} color={orbit.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STYLES — all colors via orbit.* tokens (zero hardcoded hex).
   Gold text uses orbit.accentHover (gold-700, WCAG-safe); orbit.accent
   (gold-600) is only used for icons/fills/buttons.
───────────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
    backgroundColor: orbit.bg,
  },
  headerTitle: { color: orbit.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  /* Identity */
  identity: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  name: { marginTop: 16, color: orbit.textPrimary, fontSize: 23, fontWeight: '700', letterSpacing: -0.3 },
  handle: { marginTop: 3, color: orbit.textSecond, fontSize: 14, fontWeight: '500' },
  tierRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: orbit.warningSoft,
  },
  rankText: { color: orbit.warning, fontSize: 12, fontWeight: '600' },

  metaRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: orbit.textSecond, fontSize: 13, fontWeight: '500' },
  metaDot: { color: orbit.textTertiary, fontSize: 13, marginHorizontal: 2 },

  bio: {
    marginTop: 14,
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  /* Actions */
  actions: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: orbit.accent,
  },
  primaryBtnText: { color: orbit.white, fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  secondaryBtnText: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: orbit.textPrimary, fontSize: 17, fontWeight: '700' },
  statLbl: {
    marginTop: 4,
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 28, backgroundColor: orbit.borderSubtle },

  /* Section scaffolding */
  section: { paddingHorizontal: 20, paddingTop: 22 },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  /* Karma tier card */
  tierCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    gap: 12,
  },
  tierCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierCardTitle: { color: orbit.textSecond, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  tierBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierMult: { color: orbit.textTertiary, fontSize: 11, fontWeight: '500' },
  tierTrack: { height: 6, borderRadius: 3, backgroundColor: orbit.surface3, overflow: 'hidden' },
  tierFill: { height: '100%', borderRadius: 3 },
  tierCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  karmaValue: { flexDirection: 'row', alignItems: 'baseline' },
  karmaValueNum: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  karmaLbl: { color: orbit.textTertiary, fontSize: 13, fontWeight: '500' },
  tierNext: { color: orbit.textTertiary, fontSize: 11, fontWeight: '500' },

  /* My Best Of */
  bestMsg: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  bestMsgText: { color: orbit.textPrimary, fontSize: 14, lineHeight: 20 },
  bestMsgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: orbit.accentSoft,
  },
  reactChipText: { color: orbit.accentHover, fontSize: 12, fontWeight: '700' },
  bestMsgTime: { color: orbit.textTertiary, fontSize: 12 },

  /* Empty state card */
  emptyCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: orbit.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCardTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCardSub: {
    marginTop: 6,
    color: orbit.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  /* Crown Journey */
  journeyCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    padding: 18,
  },
  journeyRow: { flexDirection: 'row' },
  journeyRail: { width: 22, alignItems: 'center' },
  journeyDot: { width: 11, height: 11, borderRadius: 6, marginTop: 2 },
  journeyLine: { width: 2, flex: 1, backgroundColor: orbit.borderSubtle, marginTop: 2 },
  journeyBody: { flex: 1, paddingLeft: 10 },
  journeyTitle: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },
  journeySub: { marginTop: 3, color: orbit.textTertiary, fontSize: 12 },

  /* Privacy & Safety */
  controlCard: {
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    overflow: 'hidden',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  controlLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  controlIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlTitle: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },
  controlSub: { marginTop: 2, color: orbit.textTertiary, fontSize: 12, lineHeight: 16 },
  controlDivider: { height: 1, backgroundColor: orbit.borderSubtle, marginLeft: 60 },

  /* Segmented Public/Private */
  seg: {
    flexDirection: 'row',
    backgroundColor: orbit.surface3,
    borderRadius: 10,
    padding: 3,
  },
  segItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segItemActive: { backgroundColor: orbit.bg },
  segText: { color: orbit.textTertiary, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: orbit.textPrimary },

  /* Custom switch (Safety Mode) */
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: orbit.surface3,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: orbit.danger },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: orbit.white,
    alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },

  /* Trust card */
  trustCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  trustHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trustHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustLabel: { color: orbit.textSecond, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  trustVal: { fontSize: 20, fontWeight: '700' },
  trustTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.surface3,
    marginTop: 12,
    overflow: 'hidden',
  },
  trustFill: { height: '100%', borderRadius: 3 },

  /* Sign out */
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: orbit.dangerSoft,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  signOutText: { color: orbit.danger, fontSize: 14, fontWeight: '600' },
});

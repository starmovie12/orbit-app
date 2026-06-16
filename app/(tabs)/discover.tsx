/**
 * CROWN — EXPLORE Tab (discover.tsx)
 * ════════════════════════════════════════════════════════════════════════════
 * PRD §9.1: EXPLORE = "Discover other cities, leaderboards, schedules, search".
 * Contains: 4-tier leaderboards · Battle Schedule · City Picker · Search.
 *
 * This is a FULL rewrite of the legacy ORBIT discover screen. The previous
 * version was a posts/views/"Watch now" feed with Spotlight Auctions, Mood
 * Rooms and Weekly Challenges — all features the PRD explicitly CUT (v4→v5
 * removal list + founder's "no feed, no posts" mandate). None of that belongs
 * in CROWN. EXPLORE is a discovery surface for titles, battles and geography.
 *
 * ── What every interactive element does ──────────────────────────────────────
 *   • Search bar          → live-searches users (Firestore) + filters cities;
 *                           tapping a user row opens their profile.
 *   • Scope switcher       → World / Country / City / Sector leaderboards.
 *                           Each scope shows the live Top contenders for that
 *                           tier's title (IMPERATOR / SOVEREIGN / VICEROY / BARON).
 *   • Podium (top 3)       → tap a podium avatar → that user's profile.
 *   • Leaderboard rows     → tap → that user's profile (/user/[id]).
 *   • "Change" (City/Sector)→ opens the City Picker bottom sheet to switch which
 *                           city/sector leaderboard you're viewing.
 *   • Battle Schedule rows  → tap → jumps Home to that scope's live chat so the
 *                           user can go contend before the freeze.
 *   • City Picker rows      → tap → sets the active city + jumps Home to that
 *                           city's chat (visit another city — PRD §9.2 picker).
 *
 * ── Data layer ───────────────────────────────────────────────────────────────
 * Live Firestore via the same proven pattern as ranks.tsx:
 *   World/Country → /users orderBy('karma','desc')
 *   City/Sector   → /users where('region','==',cityId) orderBy('karma','desc')
 * Graceful fallback to mock (RANKS_DATA / fallback cities) when the collection
 * is empty or offline — so the screen is never blank during seeding. A small
 * "DEMO" pill marks mock data, exactly like ranks.tsx.
 *
 * Title strings come ONLY from @/constants/titles (hardcoding them is a
 * PR-block). All colour comes from the `orbit` token set (gold = #D4A017).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  SearchBar,
  Divider,
  CreditPill,
  WalletDrawer,
  Avatar,
} from '@/components/shared';
import { orbit } from '@/constants/colors';
import { TITLES, TITLE_LABELS, TITLE_COLORS, CYCLE } from '@/constants/titles';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { searchUsers } from '@/lib/firestore-users';
import type { UserDoc } from '@/lib/firestore-users';
import { RANKS_DATA, MY_PROFILE } from '@/constants/data';

/* ════════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════════ */

type ScopeKey = 'WORLD' | 'COUNTRY' | 'CITY' | 'SECTOR';

/** Unified leaderboard contender — from Firestore or mock. */
type Contender = {
  id: string; // uid
  name: string; // username
  karma: number;
  badge: string;
  region: string | null;
};

/** A visitable place in the City Picker. */
type Place = {
  id: string; // cityId — e.g. "mumbai"
  name: string; // "Mumbai"
  country: string; // "India"
  online: number; // live count (estimate / mock)
};

/** A search hit for a user. */
type UserHit = {
  uid: string;
  username: string;
  displayName: string | null;
  karma: number;
};

/* ════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════════════════ */

const USERS_COLL = 'users';
const LEADERBOARD_LIMIT = 50;
const SEARCH_LIMIT = 12;

/**
 * The four leaderboard scopes, in PRD order (World first — the apex tier).
 * Each maps to a title from constants/titles.ts. `icon` is a Feather glyph.
 */
const SCOPES: {
  key: ScopeKey;
  tab: string; // short tab label
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string; // full ceremonial title (from TITLES)
  accent: string; // tier accent
  geographic: boolean; // City/Sector are pickable; World/Country use home defaults
}[] = [
  { key: 'WORLD', tab: 'World', icon: 'globe', title: TITLES.WORLD, accent: orbit.accent, geographic: false },
  { key: 'COUNTRY', tab: 'Country', icon: 'flag', title: TITLES.COUNTRY, accent: orbit.accent, geographic: false },
  { key: 'CITY', tab: 'City', icon: 'map-pin', title: TITLES.CITY, accent: TITLE_COLORS.CITY, geographic: true },
  { key: 'SECTOR', tab: 'Sector', icon: 'home', title: TITLES.SECTOR, accent: TITLE_COLORS.SECTOR, geographic: true },
];

/**
 * Fallback city list for the City Picker — used until a live cities collection
 * is wired. Sorted by online count (desc) like the PRD picker. English-only
 * copy (global product). These are real OSM-scale metros, not placeholders.
 */
const FALLBACK_PLACES: Place[] = [
  { id: 'mumbai', name: 'Mumbai', country: 'India', online: 247891 },
  { id: 'delhi', name: 'Delhi', country: 'India', online: 198450 },
  { id: 'bengaluru', name: 'Bengaluru', country: 'India', online: 156200 },
  { id: 'chandigarh', name: 'Chandigarh', country: 'India', online: 48230 },
  { id: 'hyderabad', name: 'Hyderabad', country: 'India', online: 92100 },
  { id: 'chennai', name: 'Chennai', country: 'India', online: 88400 },
  { id: 'kolkata', name: 'Kolkata', country: 'India', online: 79300 },
  { id: 'pune', name: 'Pune', country: 'India', online: 71200 },
  { id: 'jaipur', name: 'Jaipur', country: 'India', online: 41800 },
  { id: 'lucknow', name: 'Lucknow', country: 'India', online: 34600 },
  { id: 'new-york', name: 'New York', country: 'USA', online: 142000 },
  { id: 'london', name: 'London', country: 'UK', online: 118700 },
  { id: 'dubai', name: 'Dubai', country: 'UAE', online: 64200 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', online: 58900 },
  { id: 'toronto', name: 'Toronto', country: 'Canada', online: 47100 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', online: 39400 },
];

/** Default home geography when the user's profile has none set yet. */
const DEFAULT_CITY: Place = FALLBACK_PLACES[3]; // Chandigarh (founder's city)

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Title-case a cityId slug → display name fallback ("new-york" → "New York"). */
function prettyCity(id: string): string {
  return id
    .split(/[-_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function mockToContender(m: (typeof RANKS_DATA)[number]): Contender {
  return {
    id: m.id,
    name: m.name,
    karma: m.karma,
    badge: m.badge ?? 'ACTIVE',
    region: null,
  };
}

/* ── Battle Schedule timing (5-hour cycle, staggered per scope) ───────────────
 * PRD §8: cycles are 5h; freeze times are PUBLISHED AHEAD (never AI-decided).
 * World freezes daily at 23:30 IST (CYCLE.WORLD_FREEZE_HOUR/MINUTE_IST).
 * The other three are staggered off a fixed 5h grid anchored to midnight IST,
 * so contenders always know exactly when their scope locks. This is a
 * deterministic schedule (offsets are constant), matching "freeze times
 * published 7 cycles ahead, staggered". */

const IST_OFFSET_MIN = 5 * 60 + 30; // IST = UTC+5:30

/** Current time in IST as ms-since-midnight + a Date for that IST wall clock. */
function nowIST(): { msOfDay: number; date: Date } {
  const utc = Date.now();
  const istMs = utc + IST_OFFSET_MIN * 60_000;
  const d = new Date(istMs);
  const msOfDay =
    d.getUTCHours() * 3_600_000 +
    d.getUTCMinutes() * 60_000 +
    d.getUTCSeconds() * 1_000 +
    d.getUTCMilliseconds();
  return { msOfDay, date: d };
}

const FIVE_H = 5 * 3_600_000;

/** Stagger offsets (ms into the 5h grid) so the four scopes never freeze at once. */
const SCOPE_FREEZE_OFFSET: Record<ScopeKey, number> = {
  // World is special-cased to 23:30 IST daily; offset unused for it.
  WORLD: 0,
  COUNTRY: 0, // freezes on the 5h grid: 00:00, 05:00, 10:00, 15:00, 20:00 IST
  CITY: 90 * 60_000, // +1h30m → 01:30, 06:30, 11:30, 16:30, 21:30 IST
  SECTOR: 180 * 60_000, // +3h00m → 03:00, 08:00, 13:00, 18:00, 23:00 IST
};

/** Ms remaining until this scope's next freeze (IST grid). */
function msUntilFreeze(scope: ScopeKey): number {
  const { msOfDay } = nowIST();

  if (scope === 'WORLD') {
    const target =
      CYCLE.WORLD_FREEZE_HOUR_IST * 3_600_000 + CYCLE.WORLD_FREEZE_MINUTE_IST * 60_000;
    let delta = target - msOfDay;
    if (delta <= 0) delta += 24 * 3_600_000; // tomorrow's 23:30
    return delta;
  }

  const offset = SCOPE_FREEZE_OFFSET[scope];
  // Next grid point strictly in the future.
  const sinceAnchor = (msOfDay - offset + 24 * 3_600_000) % FIVE_H;
  let delta = FIVE_H - sinceAnchor;
  if (delta <= 0) delta += FIVE_H;
  return delta;
}

function fmtClock(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/* ════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENT — Scope Switcher (segmented, matches ranks.tsx tab bar)
   ════════════════════════════════════════════════════════════════════════════ */

function ScopeSwitcher({
  active,
  onChange,
}: {
  active: ScopeKey;
  onChange: (s: ScopeKey) => void;
}) {
  return (
    <View style={styles.tabBarOuter}>
      <View style={styles.tabBar}>
        {SCOPES.map((s) => {
          const isActive = s.key === active;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onChange(s.key)}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${s.tab} leaderboard`}
            >
              <Feather
                name={s.icon}
                size={14}
                color={isActive ? orbit.textPrimary : orbit.textTertiary}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{s.tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENT — Title banner (names the title + scope you're viewing)
   ════════════════════════════════════════════════════════════════════════════ */

function TitleBanner({
  scope,
  placeName,
  onChangePlace,
}: {
  scope: (typeof SCOPES)[number];
  placeName: string;
  onChangePlace?: () => void;
}) {
  // "Mayor (VICEROY) of Mumbai" / "BARON of Chandigarh" / "SOVEREIGN" / "IMPERATOR"
  let line: string;
  if (scope.key === 'CITY') line = TITLE_LABELS.WITH_SCOPE.CITY(placeName);
  else if (scope.key === 'SECTOR') line = TITLE_LABELS.WITH_SCOPE.SECTOR(placeName);
  else if (scope.key === 'COUNTRY') line = `${scope.title} · ${placeName}`;
  else line = `${scope.title} · Worldwide`;

  return (
    <View style={styles.bannerRow}>
      <View style={[styles.bannerDot, { backgroundColor: scope.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerLabel}>RACE FOR</Text>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          {line}
        </Text>
      </View>
      {onChangePlace && (
        <TouchableOpacity
          style={styles.changeBtn}
          onPress={onChangePlace}
          activeOpacity={0.8}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Change location"
        >
          <Feather name="repeat" size={13} color={orbit.accent} />
          <Text style={styles.changeBtnText}>Change</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENT — Podium (top 3 contenders)
   ════════════════════════════════════════════════════════════════════════════ */

function Podium({
  top3,
  accent,
  onTap,
}: {
  top3: Contender[];
  accent: string;
  onTap: (uid: string) => void;
}) {
  if (top3.length < 3) return null;
  // Display order: 2nd · 1st · 3rd (classic podium)
  const order = [
    { c: top3[1], place: 2, size: 56, lift: 18 },
    { c: top3[0], place: 1, size: 72, lift: 0 },
    { c: top3[2], place: 3, size: 56, lift: 28 },
  ];
  // 1st = brand gold token; 2nd/3rd = silver/bronze (no dedicated tokens — neutral metals).
  const medal = [orbit.accent, '#A8A8B3', '#B08D57'];

  return (
    <View style={styles.podiumRow}>
      {order.map(({ c, place, size, lift }) => (
        <Pressable
          key={c.id}
          style={[styles.podiumCol, { marginTop: lift }]}
          onPress={() => onTap(c.id)}
          accessibilityRole="button"
          accessibilityLabel={`Rank ${place}: ${c.name}`}
        >
          <View>
            <Avatar name={c.name} size={size} ringed={place === 1} />
            <View style={[styles.podiumMedal, { backgroundColor: medal[place - 1] }]}>
              <Text style={styles.podiumMedalText}>{place}</Text>
            </View>
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>
            @{c.name}
          </Text>
          <View style={styles.podiumKarmaRow}>
            <Feather name="heart" size={10} color={accent} />
            <Text style={[styles.podiumKarma, { color: accent }]}>{fmtCount(c.karma)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENT — Leaderboard row (rank 4+)
   ════════════════════════════════════════════════════════════════════════════ */

function LeaderRow({
  item,
  rank,
  accent,
  isMe,
  onPress,
}: {
  item: Contender;
  rank: number;
  accent: string;
  isMe: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, isMe && styles.rowMe]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}: ${item.name}, ${item.karma} reactions`}
    >
      <Text style={[styles.rowRank, isMe && { color: accent }]}>{rank}</Text>
      <Avatar name={item.name} size={40} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          @{item.name}
          {isMe ? <Text style={[styles.youTag, { color: accent }]}>  · You</Text> : null}
        </Text>
        {item.badge && item.badge !== 'ACTIVE' ? (
          <Text style={styles.rowBadge}>{item.badge}</Text>
        ) : (
          <Text style={styles.rowSub}>Contender</Text>
        )}
      </View>
      <View style={styles.rowKarma}>
        <Feather name="heart" size={12} color={accent} />
        <Text style={[styles.rowKarmaText, { color: accent }]}>{fmtCount(item.karma)}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={orbit.textTertiary} />
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENT — Battle Schedule (live countdowns to each scope's freeze)
   ════════════════════════════════════════════════════════════════════════════ */

function BattleSchedule({
  tick,
  homeCity,
  onGoScope,
}: {
  tick: number; // re-render trigger (updates every second)
  homeCity: string;
  onGoScope: (s: ScopeKey) => void;
}) {
  // tick referenced so the component re-renders each second.
  void tick;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Battle Schedule</Text>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveChipText}>IST</Text>
        </View>
      </View>
      <Text style={styles.sectionHint}>
        Next title freeze per scope. Be in the chat before the clock hits zero.
      </Text>

      <View style={styles.scheduleCard}>
        {SCOPES.map((s, i) => {
          const ms = msUntilFreeze(s.key);
          const soon = ms <= 10 * 60_000; // < 10 min = "closing"
          const place =
            s.key === 'CITY' ? homeCity : s.key === 'SECTOR' ? homeCity : '';
          const label =
            s.key === 'WORLD'
              ? 'Worldwide'
              : s.key === 'COUNTRY'
              ? 'Your country'
              : place;
          return (
            <React.Fragment key={s.key}>
              <TouchableOpacity
                style={styles.scheduleRow}
                onPress={() => onGoScope(s.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${s.title} freezes in ${fmtClock(ms)}. Open chat.`}
              >
                <View style={[styles.scheduleIcon, { backgroundColor: orbit.surface2 }]}>
                  <Feather name={s.icon} size={16} color={s.accent} />
                </View>
                <View style={styles.scheduleBody}>
                  <Text style={styles.scheduleTitle} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text style={styles.scheduleScope} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
                <View style={styles.scheduleRight}>
                  <Text style={[styles.scheduleClock, soon && { color: orbit.danger }]}>
                    {fmtClock(ms)}
                  </Text>
                  <Text style={styles.scheduleClockLbl}>{soon ? 'closing' : 'to freeze'}</Text>
                </View>
              </TouchableOpacity>
              {i < SCOPES.length - 1 && <Divider inset={64} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENT — City Picker bottom sheet (visit / switch geography)
   ════════════════════════════════════════════════════════════════════════════ */

function CityPickerSheet({
  visible,
  places,
  activeId,
  onClose,
  onPick,
}: {
  visible: boolean;
  places: Place[];
  activeId: string;
  onClose: () => void;
  onPick: (p: Place) => void;
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(600)).current;
  const [q, setQ] = useState('');

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 600,
      duration: visible ? 260 : 200,
      useNativeDriver: true,
    }).start();
    if (!visible) setQ('');
  }, [visible, slide]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? places.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.country.toLowerCase().includes(needle),
        )
      : places;
    return [...list].sort((a, b) => b.online - a.online);
  }, [places, q]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close city picker">
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slide }] }]}
        >
          {/* Stop touches inside the sheet from closing it */}
          <Pressable onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Visit another city</Text>
            <Text style={styles.sheetSub}>
              Jump into any city's live chat — post anywhere on Earth.
            </Text>

            <View style={styles.sheetSearch}>
              <Feather name="search" size={16} color={orbit.textTertiary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search cities or countries…"
                placeholderTextColor={orbit.textTertiary}
                style={styles.sheetSearchInput}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search cities"
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear">
                  <Feather name="x" size={15} color={orbit.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <View style={styles.sheetEmpty}>
                  <Feather name="map" size={28} color={orbit.textTertiary} />
                  <Text style={styles.sheetEmptyText}>No cities match “{q}”.</Text>
                </View>
              ) : (
                filtered.map((p) => {
                  const isActive = p.id === activeId;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.placeRow, isActive && styles.placeRowActive]}
                      onPress={() => onPick(p)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${p.country}, ${fmtCount(p.online)} online${
                        isActive ? ' — current' : ''
                      }`}
                    >
                      <View style={styles.placeMono}>
                        <Text style={styles.placeMonoText}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.placeName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.placeMeta} numberOfLines={1}>
                          {p.country} · {fmtCount(p.online)} online
                        </Text>
                      </View>
                      {isActive ? (
                        <Feather name="check-circle" size={18} color={orbit.accent} />
                      ) : (
                        <Feather name="arrow-up-right" size={16} color={orbit.textTertiary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ════════════════════════════════════════════════════════════════════════════ */

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, firebaseUser } = useAuth();

  const myUid = firebaseUser?.uid ?? null;
  const credits = user?.credits ?? MY_PROFILE.watchCredits;

  /* ── Home geography (from profile, with sensible fallback) ── */
  const homeCityId = user?.region ?? DEFAULT_CITY.id;
  const homeCityName = useMemo(() => {
    const match = FALLBACK_PLACES.find((p) => p.id === homeCityId);
    return match ? match.name : prettyCity(homeCityId);
  }, [homeCityId]);

  /* ── Active scope + the city being viewed for City/Sector boards ── */
  const [scope, setScope] = useState<ScopeKey>('WORLD');
  const [viewCity, setViewCity] = useState<Place>(() => {
    const match = FALLBACK_PLACES.find((p) => p.id === homeCityId);
    return match ?? { id: homeCityId, name: prettyCity(homeCityId), country: '', online: 0 };
  });

  /* ── Leaderboard data ── */
  const [contenders, setContenders] = useState<Contender[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  /* ── Search ── */
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  /* ── UI ── */
  const [walletVisible, setWallet] = useState(false);
  const [pickerVisible, setPicker] = useState(false);

  /* ── Battle Schedule ticker (re-render once per second) ── */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 86_400), 1000);
    return () => clearInterval(id);
  }, []);

  const activeScope = SCOPES.find((s) => s.key === scope)!;
  const isGeo = activeScope.geographic;
  const boardPlaceName = isGeo ? viewCity.name : scope === 'COUNTRY' ? (viewCity.country || 'Your country') : 'Worldwide';

  /* ── Subscribe to leaderboard data for the active scope ──────────────────────
   * World/Country → global /users karma board.
   * City/Sector   → /users where region == viewCity.id.
   * Re-subscribes whenever scope or viewed city changes. */
  useEffect(() => {
    let unsub: (() => void) | undefined;
    setLoading(true);

    const applyMock = () => {
      setContenders(RANKS_DATA.map(mockToContender));
      setUsingMock(true);
      setLoading(false);
    };

    try {
      let query = firestore().collection(USERS_COLL) as any;

      if (scope === 'CITY' || scope === 'SECTOR') {
        // Geography-scoped board. region == cityId.
        query = query.where('region', '==', viewCity.id).orderBy('karma', 'desc').limit(LEADERBOARD_LIMIT);
      } else {
        // Global board (World / Country share the karma ranking in Phase 1;
        // a country filter is added once `countryId` is denormalised on users).
        query = query.orderBy('karma', 'desc').limit(LEADERBOARD_LIMIT);
      }

      unsub = query.onSnapshot(
        (qs: any) => {
          if (qs.empty) {
            applyMock();
            return;
          }
          const list: Contender[] = [];
          qs.forEach((doc: any) => {
            const d = doc.data() as UserDoc;
            if (!d.onboardingComplete || !d.username) return;
            list.push({
              id: doc.id,
              name: d.username,
              karma: d.karma ?? 0,
              badge: d.badge ?? 'ACTIVE',
              region: d.region ?? null,
            });
          });
          if (list.length === 0) {
            applyMock();
          } else {
            setContenders(list);
            setUsingMock(false);
            setLoading(false);
          }
        },
        () => applyMock(),
      );
    } catch {
      applyMock();
    }

    return () => unsub?.();
  }, [scope, viewCity.id]);

  /* ── Live user search (debounced) ── */
  useEffect(() => {
    const needle = search.trim();
    if (needle.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(needle, SEARCH_LIMIT);
        if (seq !== searchSeq.current) return; // stale
        const mapped: UserHit[] = (res ?? [])
          .filter((u: UserDoc) => !!u.username)
          .map((u: UserDoc) => ({
            uid: u.uid,
            username: u.username as string,
            displayName: u.displayName,
            karma: u.karma ?? 0,
          }));
        setHits(mapped);
      } catch {
        if (seq === searchSeq.current) setHits([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Navigation handlers ── */
  const openUser = useCallback(
    (uid: string) => {
      if (uid.startsWith('mock_') || /^\d+$/.test(uid)) return; // mock rows aren't real profiles
      router.push(`/user/${uid}` as never);
    },
    [router],
  );

  const goScopeChat = useCallback(
    (s: ScopeKey) => {
      // Jump Home to the live chat. Pass the scope (+ city for geo scopes) so the
      // Home screen can open the right room. Home reads these params if present.
      const params: Record<string, string> = { scope: s.toLowerCase() };
      if (s === 'CITY' || s === 'SECTOR') params.cityId = viewCity.id;
      router.push({ pathname: '/(tabs)', params } as never);
    },
    [router, viewCity.id],
  );

  const pickPlace = useCallback(
    (p: Place) => {
      setViewCity(p);
      setPicker(false);
      // If we're on a geographic board, the board re-subscribes to the new city.
      // If not, switch the board to City so the pick is immediately meaningful.
      setScope((cur) => (cur === 'CITY' || cur === 'SECTOR' ? cur : 'CITY'));
    },
    [],
  );

  const bottomPad = Platform.OS === 'web' ? 96 : insets.bottom + 76;

  const showingSearch = search.trim().length >= 2;

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      <ScreenHeader
        title="Explore"
        right={
          usingMock && !loading ? (
            <View style={styles.demoPill}>
              <Text style={styles.demoPillText}>DEMO</Text>
            </View>
          ) : (
            <CreditPill count={credits} onPress={() => setWallet(true)} />
          )
        }
      />

      <SearchBar
        placeholder="Search people, cities…"
        value={search}
        onChangeText={setSearch}
      />

      {/* ── SEARCH RESULTS MODE ────────────────────────────────────────────── */}
      {showingSearch ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        >
          {/* People */}
          <Text style={styles.searchGroupLabel}>PEOPLE</Text>
          {searching && hits.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={orbit.textTertiary} />
            </View>
          ) : hits.length === 0 ? (
            <Text style={styles.searchEmpty}>No people found for “{search.trim()}”.</Text>
          ) : (
            hits.map((h, i) => (
              <React.Fragment key={h.uid}>
                <TouchableOpacity
                  style={styles.hitRow}
                  onPress={() => openUser(h.uid)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${h.username}'s profile`}
                >
                  <Avatar name={h.displayName ?? h.username} size={40} />
                  <View style={styles.hitBody}>
                    <Text style={styles.hitName} numberOfLines={1}>
                      {h.displayName ?? `@${h.username}`}
                    </Text>
                    <Text style={styles.hitSub} numberOfLines={1}>
                      @{h.username} · {fmtCount(h.karma)} karma
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={orbit.textTertiary} />
                </TouchableOpacity>
                {i < hits.length - 1 && <Divider inset={68} />}
              </React.Fragment>
            ))
          )}

          {/* Cities */}
          <Text style={[styles.searchGroupLabel, { marginTop: 18 }]}>CITIES</Text>
          {(() => {
            const needle = search.trim().toLowerCase();
            const cityHits = FALLBACK_PLACES.filter(
              (p) =>
                p.name.toLowerCase().includes(needle) ||
                p.country.toLowerCase().includes(needle),
            ).sort((a, b) => b.online - a.online);
            if (cityHits.length === 0) {
              return <Text style={styles.searchEmpty}>No cities found.</Text>;
            }
            return cityHits.map((p, i) => (
              <React.Fragment key={p.id}>
                <TouchableOpacity
                  style={styles.hitRow}
                  onPress={() => {
                    setViewCity(p);
                    setScope('CITY');
                    setSearch('');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${p.name} leaderboard`}
                >
                  <View style={styles.placeMono}>
                    <Text style={styles.placeMonoText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.hitBody}>
                    <Text style={styles.hitName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.hitSub} numberOfLines={1}>
                      {p.country} · {fmtCount(p.online)} online
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={orbit.textTertiary} />
                </TouchableOpacity>
                {i < cityHits.length - 1 && <Divider inset={68} />}
              </React.Fragment>
            ));
          })()}
        </ScrollView>
      ) : (
        /* ── DEFAULT MODE: leaderboards + schedule ────────────────────────── */
        <>
          <ScopeSwitcher active={scope} onChange={setScope} />

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={orbit.textTertiary} />
              <Text style={styles.loadingText}>Loading {activeScope.tab} leaderboard…</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomPad }}
            >
              <TitleBanner
                scope={activeScope}
                placeName={boardPlaceName}
                onChangePlace={isGeo ? () => setPicker(true) : undefined}
              />

              {/* Podium top 3 */}
              <Podium top3={contenders.slice(0, 3)} accent={activeScope.accent} onTap={openUser} />

              <Divider />

              {/* Rows 4+ */}
              {contenders.length <= 3 ? (
                <View style={styles.thinWrap}>
                  <Feather name="users" size={40} color={orbit.textTertiary} />
                  <Text style={styles.thinTitle}>The race is just starting</Text>
                  <Text style={styles.thinSub}>
                    Be the first to climb this leaderboard — react and post in the chat.
                  </Text>
                  <TouchableOpacity
                    style={styles.thinCta}
                    onPress={() => goScopeChat(scope)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.thinCtaText}>Open {activeScope.tab} chat</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                contenders.slice(3).map((c, i) => (
                  <React.Fragment key={c.id}>
                    <LeaderRow
                      item={c}
                      rank={i + 4}
                      accent={activeScope.accent}
                      isMe={c.id === myUid}
                      onPress={() => openUser(c.id)}
                    />
                    {i < contenders.slice(3).length - 1 && <Divider inset={64} />}
                  </React.Fragment>
                ))
              )}

              {/* Battle Schedule */}
              <BattleSchedule tick={tick} homeCity={homeCityName} onGoScope={goScopeChat} />

              {/* Visit another city CTA */}
              <TouchableOpacity
                style={styles.visitCard}
                onPress={() => setPicker(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Open city picker"
              >
                <View style={styles.visitIcon}>
                  <Feather name="compass" size={20} color={orbit.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitTitle}>Visit another city</Text>
                  <Text style={styles.visitSub}>
                    Currently viewing {viewCity.name}. Tap to explore any city on Earth.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={orbit.textTertiary} />
              </TouchableOpacity>
            </ScrollView>
          )}
        </>
      )}

      {/* ── Overlays ── */}
      <CityPickerSheet
        visible={pickerVisible}
        places={FALLBACK_PLACES}
        activeId={viewCity.id}
        onClose={() => setPicker(false)}
        onPick={pickPlace}
      />

      <WalletDrawer visible={walletVisible} onClose={() => setWallet(false)} credits={credits} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   STYLES — all colour from `orbit` tokens (gold = #D4A017). 8pt grid.
   ════════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* DEMO pill (parity with ranks.tsx) */
  demoPill: {
    backgroundColor: orbit.surface2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  demoPillText: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  /* Scope switcher */
  tabBarOuter: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: orbit.surface1,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 7,
  },
  tabActive: { backgroundColor: orbit.surface3 },
  tabText: { color: orbit.textTertiary, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: orbit.textPrimary, fontWeight: '700' },

  /* Title banner */
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 12,
  },
  bannerDot: { width: 10, height: 10, borderRadius: 5 },
  bannerLabel: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  bannerTitle: { color: orbit.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: orbit.accentSoft,
    borderWidth: 1,
    borderColor: orbit.goldBorder,
  },
  changeBtnText: { color: orbit.accent, fontSize: 12, fontWeight: '600' },

  /* Podium */
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  podiumCol: { alignItems: 'center', width: 92 },
  podiumMedal: {
    position: 'absolute',
    bottom: -4,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: orbit.bg,
  },
  podiumMedalText: { color: orbit.white, fontSize: 11, fontWeight: '800' },
  podiumName: {
    color: orbit.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    maxWidth: 92,
  },
  podiumKarmaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  podiumKarma: { fontSize: 12, fontWeight: '700' },

  /* Leaderboard rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  rowMe: { backgroundColor: orbit.accentSoft },
  rowRank: {
    width: 24,
    textAlign: 'center',
    color: orbit.textTertiary,
    fontSize: 14,
    fontWeight: '700',
  },
  rowBody: { flex: 1 },
  rowName: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },
  youTag: { fontSize: 12, fontWeight: '700' },
  rowBadge: {
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  rowSub: { color: orbit.textTertiary, fontSize: 12, marginTop: 2 },
  rowKarma: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowKarmaText: { fontSize: 13, fontWeight: '700' },

  /* Thin/empty board state */
  thinWrap: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 8 },
  thinTitle: { color: orbit.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 6 },
  thinSub: { color: orbit.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  thinCta: {
    marginTop: 12,
    backgroundColor: orbit.accent,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  thinCtaText: { color: orbit.white, fontSize: 14, fontWeight: '600' },

  /* Sections */
  section: { paddingTop: 24, paddingBottom: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sectionTitle: { color: orbit.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionHint: {
    color: orbit.textTertiary,
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 17,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: orbit.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: orbit.success },
  liveChipText: { color: orbit.textSecond, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  /* Battle schedule card */
  scheduleCard: {
    marginHorizontal: 20,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
  },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  scheduleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scheduleBody: { flex: 1 },
  scheduleTitle: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },
  scheduleScope: { color: orbit.textTertiary, fontSize: 12, marginTop: 2 },
  scheduleRight: { alignItems: 'flex-end' },
  scheduleClock: { color: orbit.textPrimary, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scheduleClockLbl: { color: orbit.textTertiary, fontSize: 10, marginTop: 2, letterSpacing: 0.3 },

  /* Visit-another-city card */
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  visitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: orbit.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitTitle: { color: orbit.textPrimary, fontSize: 15, fontWeight: '700' },
  visitSub: { color: orbit.textTertiary, fontSize: 12, marginTop: 3, lineHeight: 17 },

  /* Search results */
  searchGroupLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchEmpty: { color: orbit.textTertiary, fontSize: 13, paddingHorizontal: 20, paddingVertical: 8 },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  hitBody: { flex: 1 },
  hitName: { color: orbit.textPrimary, fontSize: 14, fontWeight: '600' },
  hitSub: { color: orbit.textTertiary, fontSize: 12, marginTop: 2 },

  /* States */
  loadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  loadingText: { color: orbit.textTertiary, fontSize: 13 },

  /* City Picker sheet */
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: orbit.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '82%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
    marginBottom: 16,
  },
  sheetTitle: { color: orbit.textPrimary, fontSize: 19, fontWeight: '700', letterSpacing: -0.2 },
  sheetSub: { color: orbit.textTertiary, fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
  },
  sheetSearchInput: { flex: 1, color: orbit.textPrimary, fontSize: 14, paddingVertical: 0 },
  sheetList: { marginTop: 4 },
  sheetEmpty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  sheetEmptyText: { color: orbit.textTertiary, fontSize: 13 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  placeRowActive: { backgroundColor: orbit.accentSoft, borderRadius: 12, paddingHorizontal: 10 },
  placeMono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: orbit.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeMonoText: { color: orbit.textSecond, fontSize: 16, fontWeight: '700' },
  placeName: { color: orbit.textPrimary, fontSize: 15, fontWeight: '600' },
  placeMeta: { color: orbit.textTertiary, fontSize: 12, marginTop: 2 },
});

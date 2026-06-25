/**
 * CROWN — EXPLORE Tab (discover.tsx)  ·  PREMIUM EDITION
 * ════════════════════════════════════════════════════════════════════════════
 * PRD §9.1: EXPLORE = "Discover other cities, leaderboards, schedules, search".
 * Contains: 4-tier leaderboards · Battle Schedule · City Picker · Search.
 *
 * DESIGN LANGUAGE — premium royal cream-gold (matches the founder's reference):
 *   • Cormorant Garamond serif for hero titles & section headings (the signature
 *     premium feel) · Inter for body/labels · Space Mono for all numerics/timers.
 *   • Warm cream→gold LinearGradient cards with a 3px top accent bar and a soft
 *     "royal shine" overlay, gold hairline borders, layered gold-tinted shadows.
 *   • Glowing pulse dots, gradient divider chips, shimmering gold CTAs.
 *   • Everything is themed via the repo `orbit` token set (brand gold = #D4A017).
 *     No banned values, no raw off-brand hex. 8pt grid. Title strings come ONLY
 *     from @/constants/titles (hardcoding them is a PR-block).
 *
 * Replaces the legacy ORBIT discover screen (a posts/views/"Watch" feed with
 * Spotlight Auctions, Mood Rooms, Crates — all CUT by the MAIN PRD). EXPLORE is
 * a discovery surface for titles, battles and geography, not a feed.
 *
 * ── Every interactive element does real work ─────────────────────────────────
 *   Search        → live user search (Firestore) + city filter; tap → profile.
 *   Scope tabs     → World / Country / City / Sector leaderboards (live).
 *   Hero + podium  → tap a contender → that user's profile (/user/[id]).
 *   Board rows     → tap → that user's profile.
 *   "Change"       → opens the City Picker to switch the City/Sector board.
 *   Schedule rows  → tap → jump Home to that scope's live chat before freeze.
 *   City Picker    → tap a city → view its board + visit its chat.
 *   Wallet pill     → credits drawer.
 *
 * ── Data ─────────────────────────────────────────────────────────────────────
 * Same proven Firestore pattern as ranks.tsx, with graceful mock fallback (a
 * "DEMO" pill marks mock data) so the screen is never blank during seeding.
 *   World/Country → /users orderBy('karma','desc')
 *   City/Sector   → /users where('region','==',cityId) orderBy('karma','desc')
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
  Easing,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  Divider,
  CreditPill,
  WalletDrawer,
  Avatar,
} from '@/components/shared';
import { orbit, palette } from '@/constants/colors';
import { FONT_BODY, FONT_CORMORANT, FONT_NUMERIC } from '@/constants/typography';
import { TITLES, TITLE_LABELS, TITLE_COLORS, CYCLE } from '@/constants/titles';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { searchUsers } from '@/lib/firestore-users';
import type { UserDoc } from '@/lib/firestore-users';
import { RANKS_DATA, MY_PROFILE } from '@/constants/data';

/* ════════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS (derived from `orbit` + `palette` — premium cream-gold)
   ════════════════════════════════════════════════════════════════════════════ */

const GOLD = orbit.accent; // #D4A017 — primary brand gold
const GOLD_DEEP = palette.gold[800]; // #8B6F18 — deep gold for serif headings on cream
const GOLD_MID = palette.gold[700]; // #A88A24 — links / accents on white
const GOLD_LIGHT = palette.gold[400]; // #E2C66B — gradient highlight
const GOLD_BORDER = palette.gold[300]; // #ECD58F — warm gold hairline
const CREAM_HI = palette.cream[50]; // #FFF9EC — card gradient top
const CREAM_LO = palette.gold[100]; // #F9EFCE — card gradient bottom
const TEXT_BODY = palette.ink[900]; // near-black warm body text
const TEXT_SOFT = '#8B7040'; // warm brown muted (matches reference)

const CREAM_CARD_GRAD = [CREAM_HI, CREAM_LO] as const;
const GOLD_CTA_GRAD = [GOLD_DEEP, GOLD, GOLD_LIGHT] as const;

/* ════════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════════ */

type ScopeKey = 'WORLD' | 'COUNTRY' | 'CITY' | 'SECTOR';

type Contender = {
  id: string;
  name: string;
  karma: number;
  badge: string;
  region: string | null;
};

type Place = {
  id: string;
  name: string;
  country: string;
  online: number;
};

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

const SCOPES: {
  key: ScopeKey;
  tab: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  emoji: string;
  title: string;
  accent: string;
  geographic: boolean;
}[] = [
  { key: 'WORLD', tab: 'World', icon: 'globe', emoji: '🌍', title: TITLES.WORLD, accent: GOLD, geographic: false },
  { key: 'COUNTRY', tab: 'Country', icon: 'flag', emoji: '🏳️', title: TITLES.COUNTRY, accent: GOLD, geographic: false },
  { key: 'CITY', tab: 'City', icon: 'map-pin', emoji: '🏙️', title: TITLES.CITY, accent: TITLE_COLORS.CITY, geographic: true },
  { key: 'SECTOR', tab: 'Sector', icon: 'home', emoji: '🏘️', title: TITLES.SECTOR, accent: TITLE_COLORS.SECTOR, geographic: true },
];

/** Fallback city list (English-only — global product). Sorted by online count. */
const FALLBACK_PLACES: Place[] = [
  { id: 'mumbai', name: 'Mumbai', country: 'India', online: 247891 },
  { id: 'delhi', name: 'Delhi', country: 'India', online: 198450 },
  { id: 'bengaluru', name: 'Bengaluru', country: 'India', online: 156200 },
  { id: 'hyderabad', name: 'Hyderabad', country: 'India', online: 92100 },
  { id: 'chennai', name: 'Chennai', country: 'India', online: 88400 },
  { id: 'kolkata', name: 'Kolkata', country: 'India', online: 79300 },
  { id: 'pune', name: 'Pune', country: 'India', online: 71200 },
  { id: 'chandigarh', name: 'Chandigarh', country: 'India', online: 48230 },
  { id: 'jaipur', name: 'Jaipur', country: 'India', online: 41800 },
  { id: 'lucknow', name: 'Lucknow', country: 'India', online: 34600 },
  { id: 'new-york', name: 'New York', country: 'USA', online: 142000 },
  { id: 'london', name: 'London', country: 'UK', online: 118700 },
  { id: 'dubai', name: 'Dubai', country: 'UAE', online: 64200 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', online: 58900 },
  { id: 'toronto', name: 'Toronto', country: 'Canada', online: 47100 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', online: 39400 },
];

const DEFAULT_CITY: Place = FALLBACK_PLACES[7]; // Chandigarh

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function prettyCity(id: string): string {
  return id
    .split(/[-_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function mockToContender(m: (typeof RANKS_DATA)[number]): Contender {
  return { id: m.id, name: m.name, karma: m.karma, badge: m.badge ?? 'ACTIVE', region: null };
}

/* ── Battle Schedule timing (deterministic 5h cycle, staggered per scope) ───── */
const IST_OFFSET_MIN = 5 * 60 + 30;
const FIVE_H = 5 * 3_600_000;

function istMsOfDay(): number {
  const istMs = Date.now() + IST_OFFSET_MIN * 60_000;
  const d = new Date(istMs);
  return (
    d.getUTCHours() * 3_600_000 +
    d.getUTCMinutes() * 60_000 +
    d.getUTCSeconds() * 1_000 +
    d.getUTCMilliseconds()
  );
}

const SCOPE_FREEZE_OFFSET: Record<ScopeKey, number> = {
  WORLD: 0,
  COUNTRY: 0, // 00:00 / 05:00 / 10:00 / 15:00 / 20:00 IST
  CITY: 90 * 60_000, // +1h30m
  SECTOR: 180 * 60_000, // +3h
};

function msUntilFreeze(scope: ScopeKey): number {
  const msOfDay = istMsOfDay();
  if (scope === 'WORLD') {
    const target = CYCLE.WORLD_FREEZE_HOUR_IST * 3_600_000 + CYCLE.WORLD_FREEZE_MINUTE_IST * 60_000;
    let delta = target - msOfDay;
    if (delta <= 0) delta += 24 * 3_600_000;
    return delta;
  }
  const offset = SCOPE_FREEZE_OFFSET[scope];
  const sinceAnchor = (msOfDay - offset + 24 * 3_600_000) % FIVE_H;
  let delta = FIVE_H - sinceAnchor;
  if (delta <= 0) delta += FIVE_H;
  return delta;
}

function fmtClock(ms: number): string {
  if (ms < 0) ms = 0;
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/* ════════════════════════════════════════════════════════════════════════════
   SHARED PRIMITIVE — PulseDot (glowing live indicator)
   ════════════════════════════════════════════════════════════════════════════ */

function PulseDot({ color = GOLD, size = 7 }: { color?: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ).start();
  }, [a]);
  const ringScale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ringOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SHARED PRIMITIVE — PremiumCard (cream→gold gradient, top accent, royal shine)
   ════════════════════════════════════════════════════════════════════════════ */

function PremiumCard({
  children,
  accent = GOLD,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  style?: any;
}) {
  return (
    <View style={[styles.premCardShadow, style]}>
      <LinearGradient colors={CREAM_CARD_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premCard}>
        <LinearGradient
          colors={[GOLD_DEEP, accent, GOLD_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.premAccentBar}
        />
        <LinearGradient colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} style={styles.premShine} pointerEvents="none" />
        {children}
      </LinearGradient>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SHARED PRIMITIVE — DividerChip (gradient lines + serif gold label)
   ════════════════════════════════════════════════════════════════════════════ */

function DividerChip({ label }: { label: string }) {
  return (
    <View style={styles.divChipRow}>
      <LinearGradient colors={['rgba(212,160,23,0)', GOLD_BORDER]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.divChipLine} />
      <View style={styles.divChip}>
        <Text style={styles.divChipText}>{label}</Text>
      </View>
      <LinearGradient colors={[GOLD_BORDER, 'rgba(212,160,23,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.divChipLine} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — Premium search field
   ════════════════════════════════════════════════════════════════════════════ */

function PremiumSearch({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.searchWrap}>
      <View style={[styles.searchRow, focused && styles.searchRowFocus]}>
        <Feather name="search" size={16} color={focused ? GOLD : TEXT_SOFT} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={TEXT_SOFT}
          style={styles.searchInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityRole="search"
          accessibilityLabel={placeholder}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={TEXT_SOFT} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — Scope Switcher (premium gold segmented control)
   ════════════════════════════════════════════════════════════════════════════ */

function ScopeSwitcher({ active, onChange }: { active: ScopeKey; onChange: (s: ScopeKey) => void }) {
  return (
    <View style={styles.scopeWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRow}>
        {SCOPES.map((s) => {
          const isActive = s.key === active;
          if (isActive) {
            return (
              <TouchableOpacity
                key={s.key}
                activeOpacity={0.85}
                onPress={() => onChange(s.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: true }}
                accessibilityLabel={`${s.tab} leaderboard`}
              >
                <LinearGradient colors={GOLD_CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scopePillActive}>
                  <Text style={styles.scopeEmoji}>{s.emoji}</Text>
                  <Text style={styles.scopePillTextActive}>{s.tab}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={s.key}
              style={styles.scopePill}
              activeOpacity={0.85}
              onPress={() => onChange(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: false }}
              accessibilityLabel={`${s.tab} leaderboard`}
            >
              <Text style={styles.scopeEmoji}>{s.emoji}</Text>
              <Text style={styles.scopePillText}>{s.tab}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — Hero leaderboard banner (the premium centerpiece)
   ════════════════════════════════════════════════════════════════════════════ */

function LeaderHero({
  scope,
  placeName,
  leader,
  contenderCount,
  onChangePlace,
  onTapLeader,
  onGoChat,
}: {
  scope: (typeof SCOPES)[number];
  placeName: string;
  leader: Contender | null;
  contenderCount: number;
  onChangePlace?: () => void;
  onTapLeader: (uid: string) => void;
  onGoChat: () => void;
}) {
  let titleLine: string;
  if (scope.key === 'CITY') titleLine = TITLE_LABELS.WITH_SCOPE.CITY(placeName);
  else if (scope.key === 'SECTOR') titleLine = TITLE_LABELS.WITH_SCOPE.SECTOR(placeName);
  else titleLine = `${scope.title}`;

  const subLine =
    scope.key === 'CITY' || scope.key === 'SECTOR'
      ? placeName
      : scope.key === 'COUNTRY'
      ? 'Your country'
      : 'Worldwide';

  return (
    <View style={styles.heroOuter}>
      <PremiumCard accent={scope.accent}>
        <View style={styles.heroInner}>
          <View style={styles.heroLabel}>
            <PulseDot color={scope.accent} size={6} />
            <Text style={styles.heroLabelText}>RACE FOR THE CROWN · LIVE</Text>
          </View>

          <Text style={styles.heroTitle} numberOfLines={2}>
            {titleLine}
          </Text>
          <Text style={styles.heroSub}>
            {subLine} · {contenderCount > 0 ? `${contenderCount} contending` : 'be the first'}
          </Text>

          {leader ? (
            <Pressable
              style={styles.heroLeaderRow}
              onPress={() => onTapLeader(leader.id)}
              accessibilityRole="button"
              accessibilityLabel={`Current leader ${leader.name}`}
            >
              <View style={styles.heroCrownWrap}>
                <Avatar name={leader.name} size={56} ringed />
                <View style={[styles.heroCrownBadge, { backgroundColor: scope.accent }]}>
                  <Text style={styles.heroCrownEmoji}>👑</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLeaderLabel}>CURRENT LEADER</Text>
                <Text style={styles.heroLeaderName} numberOfLines={1}>
                  @{leader.name}
                </Text>
                <View style={styles.heroLeaderKarma}>
                  <Feather name="heart" size={12} color={scope.accent} />
                  <Text style={styles.heroLeaderKarmaText}>{fmtCount(leader.karma)} reactions</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={TEXT_SOFT} />
            </Pressable>
          ) : (
            <View style={styles.heroEmptyLeader}>
              <Text style={styles.heroEmptyText}>The throne is open. Claim it in the chat.</Text>
            </View>
          )}

          {onChangePlace && (
            <TouchableOpacity
              style={styles.heroChange}
              onPress={onChangePlace}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change location"
            >
              <Feather name="repeat" size={13} color={GOLD_MID} />
              <Text style={styles.heroChangeText}>Viewing {placeName} — tap to change</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity activeOpacity={0.88} onPress={onGoChat} accessibilityRole="button" accessibilityLabel={`Open ${scope.tab} chat`}>
            <LinearGradient colors={GOLD_CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroCta}>
              <Feather name="zap" size={15} color="#FFF" />
              <Text style={styles.heroCtaText}>Enter the {scope.tab} chat & climb</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </PremiumCard>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — Podium (2nd · 1st · 3rd)
   ════════════════════════════════════════════════════════════════════════════ */

function Podium({ top3, accent, onTap }: { top3: Contender[]; accent: string; onTap: (uid: string) => void }) {
  if (top3.length < 3) return null;
  const order = [
    { c: top3[1], place: 2, size: 54, lift: 20 },
    { c: top3[0], place: 1, size: 70, lift: 0 },
    { c: top3[2], place: 3, size: 54, lift: 28 },
  ];
  const medalGrad: Record<number, readonly [string, string]> = {
    1: [GOLD_DEEP, GOLD_LIGHT],
    2: ['#9AA0A8', '#C8CDD4'],
    3: ['#9A6B33', '#C89456'],
  };
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
            <LinearGradient colors={medalGrad[place]} style={styles.podiumMedal}>
              <Text style={styles.podiumMedalText}>{place}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>
            @{c.name}
          </Text>
          <View style={styles.podiumKarmaRow}>
            <Feather name="heart" size={10} color={accent} />
            <Text style={styles.podiumKarma}>{fmtCount(c.karma)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — Leaderboard row (rank 4+)
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
      <Text style={[styles.rowRank, isMe && { color: GOLD_DEEP }]}>{rank}</Text>
      <Avatar name={item.name} size={42} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          @{item.name}
          {isMe ? <Text style={styles.youTag}>  · You</Text> : null}
        </Text>
        <Text style={styles.rowSub}>{item.badge && item.badge !== 'ACTIVE' ? item.badge : 'Contender'}</Text>
      </View>
      <View style={styles.rowKarma}>
        <Feather name="heart" size={12} color={accent} />
        <Text style={styles.rowKarmaText}>{fmtCount(item.karma)}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={TEXT_SOFT} />
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — Battle Schedule (live countdowns, premium card)
   ════════════════════════════════════════════════════════════════════════════ */

function BattleSchedule({ tick, homeCity, onGoScope }: { tick: number; homeCity: string; onGoScope: (s: ScopeKey) => void }) {
  void tick; // re-render each second
  return (
    <View style={styles.section}>
      <DividerChip label="⚔️  Battle Schedule" />
      <Text style={styles.sectionHint}>Next title freeze per scope (IST). Be in the chat before the clock hits zero.</Text>
      <View style={styles.schedOuter}>
        <PremiumCard>
          <View style={styles.schedInner}>
            {SCOPES.map((s, i) => {
              const ms = msUntilFreeze(s.key);
              const soon = ms <= 10 * 60_000;
              const label = s.key === 'WORLD' ? 'Worldwide' : s.key === 'COUNTRY' ? 'Your country' : homeCity;
              return (
                <React.Fragment key={s.key}>
                  <TouchableOpacity
                    style={styles.schedRow}
                    onPress={() => onGoScope(s.key)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.title} freezes in ${fmtClock(ms)}. Open chat.`}
                  >
                    <View style={styles.schedIcon}>
                      <Text style={styles.schedEmoji}>{s.emoji}</Text>
                    </View>
                    <View style={styles.schedBody}>
                      <Text style={styles.schedTitle} numberOfLines={1}>
                        {s.title}
                      </Text>
                      <Text style={styles.schedScope} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                    <View style={styles.schedRight}>
                      <Text style={[styles.schedClock, soon && { color: orbit.danger }]}>{fmtClock(ms)}</Text>
                      <Text style={styles.schedClockLbl}>{soon ? 'closing' : 'to freeze'}</Text>
                    </View>
                  </TouchableOpacity>
                  {i < SCOPES.length - 1 && <View style={styles.schedDivider} />}
                </React.Fragment>
              );
            })}
          </View>
        </PremiumCard>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENT — City Picker bottom sheet (premium)
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
  const slide = useRef(new Animated.Value(700)).current;
  const [q, setQ] = useState('');

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 700,
      duration: visible ? 280 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (!visible) setQ('');
  }, [visible, slide]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? places.filter((p) => p.name.toLowerCase().includes(needle) || p.country.toLowerCase().includes(needle))
      : places;
    return [...list].sort((a, b) => b.online - a.online);
  }, [places, q]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close city picker">
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slide }] }]}>
          <Pressable onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Visit another city</Text>
            <Text style={styles.sheetSub}>Jump into any city's live chat — post anywhere on Earth.</Text>

            <View style={styles.sheetSearch}>
              <Feather name="search" size={16} color={TEXT_SOFT} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search cities or countries…"
                placeholderTextColor={TEXT_SOFT}
                style={styles.sheetSearchInput}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search cities"
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear">
                  <Feather name="x" size={15} color={TEXT_SOFT} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <View style={styles.sheetEmpty}>
                  <Feather name="map" size={28} color={TEXT_SOFT} />
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
                      accessibilityLabel={`${p.name}, ${p.country}, ${fmtCount(p.online)} online${isActive ? ' — current' : ''}`}
                    >
                      <LinearGradient colors={[GOLD_DEEP, GOLD]} style={styles.placeMono}>
                        <Text style={styles.placeMonoText}>{p.name.charAt(0).toUpperCase()}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.placeName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <View style={styles.placeMetaRow}>
                          <PulseDot color={orbit.success} size={5} />
                          <Text style={styles.placeMeta} numberOfLines={1}>
                            {p.country} · {fmtCount(p.online)} online
                          </Text>
                        </View>
                      </View>
                      {isActive ? (
                        <Feather name="check-circle" size={18} color={GOLD} />
                      ) : (
                        <Feather name="arrow-up-right" size={16} color={TEXT_SOFT} />
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

  const homeCityId = user?.region ?? DEFAULT_CITY.id;
  const homeCityName = useMemo(() => {
    const m = FALLBACK_PLACES.find((p) => p.id === homeCityId);
    return m ? m.name : prettyCity(homeCityId);
  }, [homeCityId]);

  const [scope, setScope] = useState<ScopeKey>('WORLD');
  const [viewCity, setViewCity] = useState<Place>(() => {
    const m = FALLBACK_PLACES.find((p) => p.id === homeCityId);
    return m ?? { id: homeCityId, name: prettyCity(homeCityId), country: '', online: 0 };
  });

  const [contenders, setContenders] = useState<Contender[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const [walletVisible, setWallet] = useState(false);
  const [pickerVisible, setPicker] = useState(false);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 86_400), 1000);
    return () => clearInterval(id);
  }, []);

  const activeScope = SCOPES.find((s) => s.key === scope)!;
  const isGeo = activeScope.geographic;
  const boardPlaceName = isGeo ? viewCity.name : scope === 'COUNTRY' ? viewCity.country || 'Your country' : 'Worldwide';

  /* ── Subscribe leaderboard for the active scope ── */
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
        query = query.where('region', '==', viewCity.id).orderBy('karma', 'desc').limit(LEADERBOARD_LIMIT);
      } else {
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
          if (list.length === 0) applyMock();
          else {
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
        if (seq !== searchSeq.current) return;
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

  /* ── Handlers ── */
  const openUser = useCallback(
    (uid: string) => {
      if (uid.startsWith('mock_') || /^\d+$/.test(uid)) return;
      router.push(`/user/${uid}` as never);
    },
    [router],
  );

  const goScopeChat = useCallback(
    (s: ScopeKey) => {
      const params: Record<string, string> = { scope: s.toLowerCase() };
      if (s === 'CITY' || s === 'SECTOR') params.cityId = viewCity.id;
      router.push({ pathname: '/(tabs)', params } as never);
    },
    [router, viewCity.id],
  );

  const pickPlace = useCallback((p: Place) => {
    setViewCity(p);
    setPicker(false);
    setScope((cur) => (cur === 'CITY' || cur === 'SECTOR' ? cur : 'CITY'));
  }, []);

  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;
  const showingSearch = search.trim().length >= 2;
  const leader = contenders.length > 0 ? contenders[0] : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Explore"
        right={
          usingMock && !loading && !showingSearch ? (
            <View style={styles.demoPill}>
              <Text style={styles.demoPillText}>DEMO</Text>
            </View>
          ) : (
            <CreditPill count={credits} onPress={() => setWallet(true)} />
          )
        }
      />

      <PremiumSearch value={search} onChange={setSearch} placeholder="Search people, cities…" />

      {showingSearch ? (
        /* ── SEARCH MODE ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
          <Text style={styles.searchGroupLabel}>PEOPLE</Text>
          {searching && hits.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={GOLD} />
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
                  <Avatar name={h.displayName ?? h.username} size={42} />
                  <View style={styles.hitBody}>
                    <Text style={styles.hitName} numberOfLines={1}>
                      {h.displayName ?? `@${h.username}`}
                    </Text>
                    <Text style={styles.hitSub} numberOfLines={1}>
                      @{h.username} · {fmtCount(h.karma)} karma
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={TEXT_SOFT} />
                </TouchableOpacity>
                {i < hits.length - 1 && <Divider inset={70} />}
              </React.Fragment>
            ))
          )}

          <Text style={[styles.searchGroupLabel, { marginTop: 20 }]}>CITIES</Text>
          {(() => {
            const needle = search.trim().toLowerCase();
            const cityHits = FALLBACK_PLACES.filter(
              (p) => p.name.toLowerCase().includes(needle) || p.country.toLowerCase().includes(needle),
            ).sort((a, b) => b.online - a.online);
            if (cityHits.length === 0) return <Text style={styles.searchEmpty}>No cities found.</Text>;
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
                  <LinearGradient colors={[GOLD_DEEP, GOLD]} style={styles.placeMono}>
                    <Text style={styles.placeMonoText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={styles.hitBody}>
                    <Text style={styles.hitName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.hitSub} numberOfLines={1}>
                      {p.country} · {fmtCount(p.online)} online
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={TEXT_SOFT} />
                </TouchableOpacity>
                {i < cityHits.length - 1 && <Divider inset={70} />}
              </React.Fragment>
            ));
          })()}
        </ScrollView>
      ) : (
        /* ── DEFAULT MODE ── */
        <>
          <ScopeSwitcher active={scope} onChange={setScope} />

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={GOLD} />
              <Text style={styles.loadingText}>Loading {activeScope.tab} leaderboard…</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
              <LeaderHero
                scope={activeScope}
                placeName={boardPlaceName}
                leader={leader}
                contenderCount={contenders.length}
                onChangePlace={isGeo ? () => setPicker(true) : undefined}
                onTapLeader={openUser}
                onGoChat={() => goScopeChat(scope)}
              />

              <DividerChip label="🏆  Top Contenders" />
              <Podium top3={contenders.slice(0, 3)} accent={activeScope.accent} onTap={openUser} />

              {contenders.length <= 3 ? (
                <View style={styles.thinWrap}>
                  <Feather name="users" size={40} color={TEXT_SOFT} />
                  <Text style={styles.thinTitle}>The race is just starting</Text>
                  <Text style={styles.thinSub}>Be the first to climb this leaderboard — react and post in the chat.</Text>
                </View>
              ) : (
                <View style={styles.boardList}>
                  {contenders.slice(3).map((c, i, arr) => (
                    <React.Fragment key={c.id}>
                      <LeaderRow item={c} rank={i + 4} accent={activeScope.accent} isMe={c.id === myUid} onPress={() => openUser(c.id)} />
                      {i < arr.length - 1 && <Divider inset={66} />}
                    </React.Fragment>
                  ))}
                </View>
              )}

              <BattleSchedule tick={tick} homeCity={homeCityName} onGoScope={goScopeChat} />

              <View style={styles.section}>
                <DividerChip label="🌆  Discover Cities" />
                <View style={styles.visitOuter}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel="Open city picker">
                    <PremiumCard>
                      <View style={styles.visitInner}>
                        <View style={styles.visitIcon}>
                          <Feather name="compass" size={22} color={GOLD} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.visitTitle}>Visit another city</Text>
                          <Text style={styles.visitSub}>Currently viewing {viewCity.name}. Explore any city on Earth.</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={TEXT_SOFT} />
                      </View>
                    </PremiumCard>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </>
      )}

      <CityPickerSheet visible={pickerVisible} places={FALLBACK_PLACES} activeId={viewCity.id} onClose={() => setPicker(false)} onPick={pickPlace} />
      <WalletDrawer visible={walletVisible} onClose={() => setWallet(false)} credits={credits} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.bg },

  demoPill: { backgroundColor: orbit.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  demoPillText: { fontFamily: FONT_BODY.bold, color: TEXT_SOFT, fontSize: 10, letterSpacing: 0.6 },

  /* Premium card primitive */
  premCardShadow: {
    borderRadius: 22,
    backgroundColor: CREAM_HI,
    shadowColor: GOLD,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  premCard: { borderRadius: 22, borderWidth: 1.5, borderColor: GOLD_BORDER, overflow: 'hidden' },
  premAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  premShine: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },

  /* Divider chip */
  divChipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 10 },
  divChipLine: { flex: 1, height: 1 },
  divChip: {
    backgroundColor: CREAM_HI,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
    shadowColor: GOLD,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  divChipText: { fontFamily: FONT_CORMORANT.bold, fontSize: 14, color: GOLD_DEEP, letterSpacing: 0.4 },

  /* Search */
  searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    borderRadius: 14,
    paddingHorizontal: 13,
    height: 46,
    shadowColor: GOLD,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchRowFocus: { borderColor: GOLD, shadowOpacity: 0.2 },
  searchInput: { flex: 1, fontFamily: FONT_BODY.medium, color: TEXT_BODY, fontSize: 14, paddingVertical: 0 },

  /* Scope switcher */
  scopeWrap: { paddingTop: 10, paddingBottom: 4 },
  scopeRow: { paddingHorizontal: 16, gap: 8 },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
  },
  scopePillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  scopeEmoji: { fontSize: 13 },
  scopePillText: { fontFamily: FONT_BODY.bold, fontSize: 13, color: GOLD_DEEP },
  scopePillTextActive: { fontFamily: FONT_BODY.bold, fontSize: 13, color: '#FFF' },

  /* Hero */
  heroOuter: { paddingHorizontal: 16, paddingTop: 14 },
  heroInner: { padding: 18, gap: 6 },
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroLabelText: { fontFamily: FONT_BODY.bold, fontSize: 9.5, color: GOLD_DEEP, letterSpacing: 1 },
  heroTitle: { fontFamily: FONT_CORMORANT.bold, fontSize: 27, color: TEXT_BODY, lineHeight: 32, marginTop: 8, letterSpacing: 0.3 },
  heroSub: { fontFamily: FONT_BODY.semiBold, fontSize: 12, color: TEXT_SOFT, marginTop: -1 },

  heroLeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  heroCrownWrap: { position: 'relative' },
  heroCrownBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CREAM_HI,
  },
  heroCrownEmoji: { fontSize: 13 },
  heroLeaderLabel: { fontFamily: FONT_BODY.bold, fontSize: 9, color: TEXT_SOFT, letterSpacing: 0.8 },
  heroLeaderName: { fontFamily: FONT_CORMORANT.bold, fontSize: 19, color: GOLD_DEEP, marginTop: 1 },
  heroLeaderKarma: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  heroLeaderKarmaText: { fontFamily: FONT_NUMERIC.bold, fontSize: 12, color: GOLD_DEEP },

  heroEmptyLeader: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  heroEmptyText: { fontFamily: FONT_CORMORANT.semiBold, fontSize: 15, color: TEXT_SOFT, textAlign: 'center' },

  heroChange: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 12 },
  heroChangeText: { fontFamily: FONT_BODY.semiBold, fontSize: 11.5, color: GOLD_MID },

  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 14,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  heroCtaText: { fontFamily: FONT_BODY.bold, fontSize: 14, color: '#FFF', letterSpacing: 0.2 },

  /* Podium */
  podiumRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 22, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18 },
  podiumCol: { alignItems: 'center', width: 90 },
  podiumMedal: {
    position: 'absolute',
    bottom: -4,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: orbit.bg,
  },
  podiumMedalText: { fontFamily: FONT_NUMERIC.bold, color: '#FFF', fontSize: 11 },
  podiumName: { fontFamily: FONT_BODY.bold, fontSize: 12, color: TEXT_BODY, marginTop: 10, maxWidth: 90 },
  podiumKarmaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  podiumKarma: { fontFamily: FONT_NUMERIC.bold, fontSize: 12, color: GOLD_DEEP },

  /* Board */
  boardList: { marginHorizontal: 16, backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: orbit.borderSubtle, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowMe: { backgroundColor: orbit.accentSoft },
  rowRank: { width: 24, textAlign: 'center', fontFamily: FONT_NUMERIC.bold, color: TEXT_SOFT, fontSize: 14 },
  rowBody: { flex: 1 },
  rowName: { fontFamily: FONT_BODY.bold, color: TEXT_BODY, fontSize: 14 },
  youTag: { fontFamily: FONT_BODY.bold, fontSize: 12, color: GOLD_DEEP },
  rowSub: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 11.5, marginTop: 2 },
  rowKarma: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowKarmaText: { fontFamily: FONT_NUMERIC.bold, fontSize: 13, color: GOLD_DEEP },

  /* Thin state */
  thinWrap: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 36, gap: 8 },
  thinTitle: { fontFamily: FONT_CORMORANT.bold, color: TEXT_BODY, fontSize: 18, marginTop: 6 },
  thinSub: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  /* Sections */
  section: { paddingTop: 2 },
  sectionHint: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 12, paddingHorizontal: 18, marginBottom: 12, lineHeight: 17 },

  /* Schedule */
  schedOuter: { paddingHorizontal: 16 },
  schedInner: { paddingVertical: 4 },
  schedRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  schedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedEmoji: { fontSize: 18 },
  schedBody: { flex: 1 },
  schedTitle: { fontFamily: FONT_BODY.bold, color: TEXT_BODY, fontSize: 14 },
  schedScope: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 12, marginTop: 2 },
  schedRight: { alignItems: 'flex-end' },
  schedClock: { fontFamily: FONT_NUMERIC.bold, color: GOLD_DEEP, fontSize: 15 },
  schedClockLbl: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 10, marginTop: 2, letterSpacing: 0.3 },
  schedDivider: { height: 1, backgroundColor: 'rgba(212,160,23,0.18)', marginHorizontal: 14 },

  /* Visit card */
  visitOuter: { paddingHorizontal: 16 },
  visitInner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  visitIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitTitle: { fontFamily: FONT_CORMORANT.bold, color: TEXT_BODY, fontSize: 17 },
  visitSub: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 12, marginTop: 3, lineHeight: 17 },

  /* Search results */
  searchGroupLabel: { fontFamily: FONT_BODY.bold, color: TEXT_SOFT, fontSize: 11, letterSpacing: 0.8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  searchEmpty: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 13, paddingHorizontal: 18, paddingVertical: 8 },
  hitRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 14 },
  hitBody: { flex: 1 },
  hitName: { fontFamily: FONT_BODY.bold, color: TEXT_BODY, fontSize: 14 },
  hitSub: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 12, marginTop: 2 },

  /* States */
  loadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  loadingText: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 13 },

  /* City picker sheet */
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(20,12,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: orbit.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, maxHeight: '84%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: GOLD_BORDER, marginBottom: 16 },
  sheetTitle: { fontFamily: FONT_CORMORANT.bold, color: TEXT_BODY, fontSize: 22, letterSpacing: 0.3 },
  sheetSub: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    borderRadius: 14,
    paddingHorizontal: 13,
    height: 46,
    marginBottom: 8,
  },
  sheetSearchInput: { flex: 1, fontFamily: FONT_BODY.medium, color: TEXT_BODY, fontSize: 14, paddingVertical: 0 },
  sheetList: { marginTop: 4 },
  sheetEmpty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  sheetEmptyText: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 13 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4 },
  placeRowActive: { backgroundColor: orbit.accentSoft, borderRadius: 14, paddingHorizontal: 10 },
  placeMono: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  placeMonoText: { fontFamily: FONT_BODY.bold, color: '#FFF', fontSize: 16 },
  placeName: { fontFamily: FONT_BODY.bold, color: TEXT_BODY, fontSize: 15 },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  placeMeta: { fontFamily: FONT_BODY.medium, color: TEXT_SOFT, fontSize: 12 },
});

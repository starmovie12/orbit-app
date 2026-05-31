/**
 * components/organisms/IndiaPickerSheet.tsx
 *
 * CROWN — India City Explorer Bottom Sheet
 * ───────────────────────────────────────────────────────────────────────────
 * Triggered when the user taps the ALREADY-ACTIVE "India 🇮🇳" (country scope)
 * tab in the home header's FourScopeSwitcher.
 *
 * Design direction: "MIDNIGHT BHARAT"
 *   • Completely distinct from CityPickerSheet (which is a plain white list)
 *   • Dark immersive header (ink-950) with saffron tricolor accent bars
 *   • Two-column grid of city cards — never a flat list
 *   • Region filter chips (North / South / East / West / Central / NE)
 *   • Online count live badge on each card (emerald dot)
 *   • Active city: amber left-border + warm saffron tint card bg
 *
 * ── DATA ────────────────────────────────────────────────────────────────────
 *   Reuses getCities() from @/lib/firestore-rooms.
 *   Local REGION_MAP enriches each city with region label + representative emoji.
 *
 * ── PROPS ───────────────────────────────────────────────────────────────────
 *   visible   : boolean — controls sheet visibility
 *   onClose   : () => void — close handler
 *   selected  : string — current cityId
 *   onSelect  : (cityId: string) => void — city selected callback
 *
 * ── DESIGN TOKENS ───────────────────────────────────────────────────────────
 *   Header bg      : palette.ink[950]   #1A1208   deep warm black
 *   Header accent  : palette.saffron[600] #C9722C tricolor saffron
 *   Header green   : palette.emerald[600] #1A7A4A tricolor green
 *   Sheet bg       : colors.bg.surface  #FFFFFF   white
 *   Card bg        : palette.cream[50]  → clean card
 *   Active card    : palette.amber[50]  bg + palette.amber[600] 2px border
 *   Region pill    : palette.cream[200] idle, palette.amber[600] active
 *   Live dot       : palette.emerald[600]
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';
import { Feather }            from '@expo/vector-icons';
import * as Haptics           from 'expo-haptics';
import firestore              from '@react-native-firebase/firestore';
import auth                   from '@react-native-firebase/auth';

import { getCities }             from '@/lib/firestore-rooms';
import { palette, colors }       from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// ─── Screen constant ─────────────────────────────────────────────────────────
const SCREEN_H  = Dimensions.get('window').height;
const SCREEN_W  = Dimensions.get('window').width;
const DRAG_DISMISS = 80;

// ─── Design token aliases ─────────────────────────────────────────────────────
const C = {
  // Header
  headerBg:       palette.ink[950],        // #1A1208 — deep warm black
  headerText:     '#FFFFFF',               // white text on dark header
  headerSub:      'rgba(255,255,255,0.60)',// muted white sub-text
  saffronAccent:  palette.saffron[600],    // #C9722C — India tricolor saffron
  greenAccent:    palette.emerald[600],    // #1A7A4A — India tricolor green

  // Sheet body
  sheetBg:        colors.bg.surface,       // #FFFFFF
  bodyBg:         '#F8F4EE',               // very light cream body
  cardBg:         '#FFFFFF',               // card face
  cardBorder:     palette.cream[400],      // #E5CC95 — subtle card border
  activeCardBg:   'rgba(212, 101, 26, 0.06)', // amber tint for active card
  activeCardBorder: palette.amber[600],    // #D4651A — left accent bar

  // Text
  textPrimary:    palette.ink[950],        // #1A1208
  textSecondary:  palette.ink[600],        // #6B5B47
  textBrand:      palette.gold[600],       // #C9A227

  // Chips
  chipIdle:       palette.cream[200],      // #F7ECD0
  chipIdleBorder: palette.cream[400],      // #E5CC95
  chipActive:     palette.amber[600],      // #D4651A
  chipActiveText: '#FFFFFF',

  // Search
  searchBg:       '#FFFBF5',
  searchBorder:   palette.cream[400],      // #E5CC95
  searchFocus:    palette.amber[600],      // #D4651A

  // Live badge
  liveDot:        palette.emerald[600],    // #1A7A4A

  // Shimmer
  shimmerBase:    palette.cream[200],
  shimmerPeak:    '#FFFFFF',
} as const;

// ─── Region definitions ───────────────────────────────────────────────────────

type RegionKey = 'all' | 'north' | 'south' | 'east' | 'west' | 'central' | 'ne';

interface Region {
  key:   RegionKey;
  label: string;
  emoji: string;
}

const REGIONS: readonly Region[] = [
  { key: 'all',     label: 'Sab',    emoji: '🗺️' },
  { key: 'north',   label: 'Uttar',  emoji: '🏔️' },
  { key: 'south',   label: 'Dakshin',emoji: '🌴' },
  { key: 'east',    label: 'Purv',   emoji: '🌅' },
  { key: 'west',    label: 'Paschim',emoji: '🌊' },
  { key: 'central', label: 'Madhya', emoji: '🌾' },
  { key: 'ne',      label: 'NE',     emoji: '⛰️' },
] as const;

/**
 * Local enrichment: maps cityId → {region, emoji}
 * Firestore docs don't carry region tags; this local map fills the gap.
 * Add entries as new cities are activated in Firestore.
 */
const CITY_META: Record<string, { region: RegionKey; emoji: string }> = {
  // North
  chandigarh:     { region: 'north',   emoji: '🌸' },
  delhi:          { region: 'north',   emoji: '🏛️' },
  noida:          { region: 'north',   emoji: '🏗️' },
  gurugram:       { region: 'north',   emoji: '💼' },
  jaipur:         { region: 'north',   emoji: '🏰' },
  lucknow:        { region: 'north',   emoji: '🕌' },
  agra:           { region: 'north',   emoji: '🕍' },
  amritsar:       { region: 'north',   emoji: '🛕' },
  ludhiana:       { region: 'north',   emoji: '🌿' },
  jalandhar:      { region: 'north',   emoji: '🌱' },
  shimla:         { region: 'north',   emoji: '🏔️' },
  dehradun:       { region: 'north',   emoji: '🌲' },
  jammu:          { region: 'north',   emoji: '🎋' },
  varanasi:       { region: 'north',   emoji: '🙏' },
  prayagraj:      { region: 'north',   emoji: '🚣' },
  kanpur:         { region: 'north',   emoji: '🏭' },
  patna:          { region: 'north',   emoji: '🌊' },
  ranchi:         { region: 'north',   emoji: '🌳' },

  // South
  bengaluru:      { region: 'south',   emoji: '💻' },
  bangalore:      { region: 'south',   emoji: '💻' },
  hyderabad:      { region: 'south',   emoji: '💊' },
  chennai:        { region: 'south',   emoji: '🎭' },
  kochi:          { region: 'south',   emoji: '🚢' },
  thiruvananthapuram: { region: 'south', emoji: '🌴' },
  mysuru:         { region: 'south',   emoji: '👑' },
  coimbatore:     { region: 'south',   emoji: '🏭' },
  visakhapatnam:  { region: 'south',   emoji: '⚓' },
  vijayawada:     { region: 'south',   emoji: '🌉' },
  madurai:        { region: 'south',   emoji: '🛕' },
  mangaluru:      { region: 'south',   emoji: '🌊' },

  // East
  kolkata:        { region: 'east',    emoji: '🌉' },
  bhubaneswar:    { region: 'east',    emoji: '🏯' },
  cuttack:        { region: 'east',    emoji: '🎨' },

  // West
  mumbai:         { region: 'west',    emoji: '🎬' },
  pune:           { region: 'west',    emoji: '🎓' },
  ahmedabad:      { region: 'west',    emoji: '🏙️' },
  surat:          { region: 'west',    emoji: '💎' },
  vadodara:       { region: 'west',    emoji: '🏛️' },
  nagpur:         { region: 'west',    emoji: '🍊' },
  nashik:         { region: 'west',    emoji: '🍇' },

  // Central
  bhopal:         { region: 'central', emoji: '🏞️' },
  indore:         { region: 'central', emoji: '🌆' },
  raipur:         { region: 'central', emoji: '🌿' },
  jabalpur:       { region: 'central', emoji: '🌋' },

  // NE
  guwahati:       { region: 'ne',      emoji: '🦏' },
  shillong:       { region: 'ne',      emoji: '☁️' },
  imphal:         { region: 'ne',      emoji: '🎭' },
  aizawl:         { region: 'ne',      emoji: '⛰️' },
};

/** Get emoji for a city — fallback to region or default 🏙️ */
function getCityEmoji(cityId: string): string {
  return CITY_META[cityId.toLowerCase()]?.emoji ?? '🏙️';
}

/** Get region for a city */
function getCityRegion(cityId: string): RegionKey {
  return CITY_META[cityId.toLowerCase()]?.region ?? 'north';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CityItem {
  id:           string;
  name:         string;
  state?:       string;
  online_count: number;
  sector_count: number;
  is_active:    boolean;
  region:       RegionKey;
  emoji:        string;
}

export interface IndiaPickerSheetProps {
  visible:  boolean;
  onClose:  () => void;
  selected: string;
  onSelect: (cityId: string) => void;
}

// ─── Shimmer hook ─────────────────────────────────────────────────────────────

function useShimmer(): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim;
}

// ─── Format online count ─────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Skeleton card pair ────────────────────────────────────────────────────────

const SkeletonCard = memo(function SkeletonCard({ shimmer }: { shimmer: Animated.Value }) {
  const bg = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [C.shimmerBase, C.shimmerPeak],
  });
  return (
    <View style={SK.card}>
      <Animated.View style={[SK.icon, { backgroundColor: bg }]} />
      <Animated.View style={[SK.line, SK.lineW70, { backgroundColor: bg }]} />
      <Animated.View style={[SK.line, SK.lineW50, { backgroundColor: bg, marginTop: 4 }]} />
      <Animated.View style={[SK.chip, { backgroundColor: bg, marginTop: 8 }]} />
    </View>
  );
});

const SK = StyleSheet.create({
  card:   { flex: 1, margin: 5, borderRadius: 14, padding: 12, backgroundColor: C.cardBg,
            borderWidth: 1, borderColor: C.cardBorder },
  icon:   { width: 32, height: 32, borderRadius: 10, marginBottom: 8 },
  line:   { height: 11, borderRadius: 5 },
  lineW70: { width: '70%' },
  lineW50: { width: '50%' },
  chip:   { width: 60, height: 18, borderRadius: 9 },
});

// ── City Card ─────────────────────────────────────────────────────────────────

interface CityCardProps {
  city:      CityItem;
  isActive:  boolean;
  onPress:   (city: CityItem) => void;
}

const CityCard = memo(function CityCard({ city, isActive, onPress }: CityCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, bounciness: 0, speed: 40 }).start();
  }, [scale]);

  const pressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 30 }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(city);
  }, [city, onPress]);

  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${city.name}, ${city.state ?? ''}`}
      accessibilityState={{ selected: isActive }}
      style={S.cardPressable}
    >
      <Animated.View style={[
        S.card,
        isActive && S.cardActive,
        { transform: [{ scale }] },
      ]}>
        {/* Active left accent bar */}
        {isActive && <View style={S.cardAccentBar} />}

        {/* Emoji */}
        <Text style={S.cardEmoji} allowFontScaling={false}>{city.emoji}</Text>

        {/* City name */}
        <Text
          style={[S.cardCityName, isActive && S.cardCityNameActive]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {city.name}
        </Text>

        {/* State */}
        {!!city.state && (
          <Text style={S.cardState} numberOfLines={1} allowFontScaling={false}>
            {city.state}
          </Text>
        )}

        {/* Live badge */}
        <View style={S.liveBadge}>
          <View style={[S.liveDot, city.online_count > 0 && S.liveDotActive]} />
          <Text style={S.liveText} allowFontScaling={false}>
            {city.online_count > 0 ? `${fmtCount(city.online_count)} online` : 'Abhi shuru'}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const IndiaPickerSheet = memo(function IndiaPickerSheet({
  visible,
  onClose,
  selected,
  onSelect,
}: IndiaPickerSheetProps) {
  const insets   = useSafeAreaInsets();
  const shimmer  = useShimmer();

  // ── State ──────────────────────────────────────────────────────────────────
  const [cities,      setCities]      = useState<CityItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [query,       setQuery]       = useState('');
  const [region,      setRegion]      = useState<RegionKey>('all');
  const [switching,   setSwitching]   = useState(false);

  // ── Animation ──────────────────────────────────────────────────────────────
  const translateY       = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 240, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H, duration: 260, useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  // ── Drag-to-dismiss ────────────────────────────────────────────────────────
  const dragRef = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { dragRef.current = 0; },
      onPanResponderMove: (_, g) => {
        const dy = Math.max(0, g.dy);
        translateY.setValue(dy);
        dragRef.current = dy;
      },
      onPanResponderRelease: () => {
        if (dragRef.current > DRAG_DISMISS) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, bounciness: 3, speed: 20,
          }).start();
        }
      },
    })
  ).current;

  // ── Firestore cities ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const unsub = getCities((rawCities) => {
      const enriched: CityItem[] = rawCities
        .filter((c: any) => c.is_active !== false)
        .map((c: any) => ({
          id:           c.id,
          name:         c.name || c.id.charAt(0).toUpperCase() + c.id.slice(1),
          state:        c.state ?? undefined,
          online_count: c.online_count ?? 0,
          sector_count: c.sector_count ?? 0,
          is_active:    c.is_active ?? true,
          region:       getCityRegion(c.id),
          emoji:        getCityEmoji(c.id),
        }));
      setCities(enriched);
      setLoading(false);
    });
    return () => unsub();
  }, [visible]);

  // ── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setRegion('all');
      setSwitching(false);
    }
  }, [visible]);

  // ── Filtered city list ─────────────────────────────────────────────────────
  const filtered = useMemo<CityItem[]>(() => {
    const q = query.trim().toLowerCase();
    return cities.filter((c) => {
      const regionMatch = region === 'all' || c.region === region;
      const searchMatch = !q || c.name.toLowerCase().includes(q) || (c.state ?? '').toLowerCase().includes(q);
      return regionMatch && searchMatch;
    });
  }, [cities, query, region]);

  // ── Total India online (aggregate) ────────────────────────────────────────
  const totalOnline = useMemo(
    () => cities.reduce((sum, c) => sum + c.online_count, 0),
    [cities]
  );

  // ── Select handler ─────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (city: CityItem) => {
    setSwitching(true);
    try {
      // Persist to user profile
      const uid = auth().currentUser?.uid;
      if (uid) {
        await firestore().collection('users').doc(uid).set(
          { city_id: city.id },
          { merge: true }
        );
      }
    } catch { /* silent */ } finally {
      setSwitching(false);
    }
    onSelect(city.id);
    onClose();
  }, [onSelect, onClose]);

  // ── Render each grid row (pair of cards) ──────────────────────────────────
  const renderPair = useCallback(({ item }: { item: [CityItem, CityItem | null] }) => (
    <View style={S.cardRow}>
      <CityCard
        city={item[0]}
        isActive={item[0].id === selected}
        onPress={handleSelect}
      />
      {item[1] ? (
        <CityCard
          city={item[1]}
          isActive={item[1].id === selected}
          onPress={handleSelect}
        />
      ) : (
        <View style={S.cardPressable} />
      )}
    </View>
  ), [selected, handleSelect]);

  // Pair up cities into rows of 2
  const pairedCities = useMemo<[CityItem, CityItem | null][]>(() => {
    const pairs: [CityItem, CityItem | null][] = [];
    for (let i = 0; i < filtered.length; i += 2) {
      pairs.push([filtered[i], filtered[i + 1] ?? null]);
    }
    return pairs;
  }, [filtered]);

  const keyExtractor = useCallback(
    (item: [CityItem, CityItem | null]) => item[0].id,
    []
  );

  // Skeleton row pairs
  const SKELETON_COUNT = 6;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <Animated.View style={[S.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* ── Sheet ──────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          S.sheet,
          { transform: [{ translateY }], paddingBottom: insets.bottom + 8 },
        ]}
        accessibilityViewIsModal
        accessibilityRole="dialog"
      >

        {/* ── DARK HEADER (drag area) ─────────────────────────────────────── */}
        <View
          style={S.header}
          {...panResponder.panHandlers}
        >
          {/* Tricolor accent bar at very top */}
          <View style={S.tricolor}>
            <View style={[S.triBar, { backgroundColor: C.saffronAccent }]} />
            <View style={[S.triBar, { backgroundColor: '#FFFFFF' }]} />
            <View style={[S.triBar, { backgroundColor: C.greenAccent }]} />
          </View>

          {/* Drag pill */}
          <View style={S.handleArea}>
            <View style={S.handle} />
          </View>

          {/* Header content row */}
          <View style={S.headerContent}>
            {/* Left: flag + title */}
            <View style={S.headerLeft}>
              <Text style={S.headerFlag} allowFontScaling={false}>🇮🇳</Text>
              <View>
                <Text style={S.headerTitle} allowFontScaling={false}>BHARAT</Text>
                <Text style={S.headerSub} allowFontScaling={false} numberOfLines={1}>
                  Apna shehar chuno
                </Text>
              </View>
            </View>

            {/* Right: total online count */}
            <View style={S.headerStats}>
              <View style={[S.headerDot, { backgroundColor: C.greenAccent }]} />
              <Text style={S.headerCount} allowFontScaling={false}>
                {loading ? '—' : `${fmtCount(totalOnline)} online`}
              </Text>
            </View>
          </View>
        </View>

        {/* ── SEARCH BAR ─────────────────────────────────────────────────── */}
        <View style={S.searchWrap}>
          <Feather name="search" size={16} color={C.textSecondary} style={S.searchIcon} />
          <TextInput
            style={S.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Shehar dhundo..."
            placeholderTextColor={C.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            allowFontScaling={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={12} style={S.searchClear}>
              <Feather name="x" size={15} color={C.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* ── REGION FILTER CHIPS ────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={S.regionScroll}
          contentContainerStyle={S.regionContent}
        >
          {REGIONS.map((r) => {
            const active = r.key === region;
            return (
              <Pressable
                key={r.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setRegion(r.key);
                }}
                style={[S.regionChip, active && S.regionChipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={S.regionChipEmoji} allowFontScaling={false}>{r.emoji}</Text>
                <Text
                  style={[S.regionChipLabel, active && S.regionChipLabelActive]}
                  allowFontScaling={false}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── CITY GRID ──────────────────────────────────────────────────── */}
        {loading ? (
          <View style={S.gridContainer}>
            {Array.from({ length: SKELETON_COUNT / 2 }).map((_, i) => (
              <View key={i} style={S.cardRow}>
                <SkeletonCard shimmer={shimmer} />
                <SkeletonCard shimmer={shimmer} />
              </View>
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View style={S.emptyState}>
            <Text style={S.emptyEmoji}>🌍</Text>
            <Text style={S.emptyTitle}>Koi shehar nahi mila</Text>
            <Text style={S.emptySub}>
              {query ? `"${query}" nahi mili` : 'Is region mein abhi koi city nahi'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={pairedCities}
            renderItem={renderPair}
            keyExtractor={keyExtractor}
            style={S.gridList}
            contentContainerStyle={[S.gridContent, { paddingBottom: 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* ── SWITCH SPINNER OVERLAY ─────────────────────────────────────── */}
        {switching && (
          <View style={S.spinnerOverlay}>
            <ActivityIndicator size="large" color={C.saffronAccent} />
          </View>
        )}

      </Animated.View>
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Modal overlay ──────────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },

  // ── Sheet container ────────────────────────────────────────────────────────
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    maxHeight:            SCREEN_H * 0.87,
    backgroundColor:      C.sheetBg,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
    ...Platform.select({
      android: { elevation: 28 },
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: -6 },
        shadowOpacity: 0.30,
        shadowRadius:  24,
      },
    }),
  },

  // ── DARK HEADER ────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.headerBg,
    paddingBottom:   14,
  },
  tricolor: {
    flexDirection:   'row',
    height:          4,
  },
  triBar: {
    flex: 1,
  },
  handleArea: {
    alignItems:   'center',
    paddingTop:   10,
    paddingBottom: 6,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerContent: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 18,
    paddingTop:        2,
    paddingBottom:     4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  headerFlag: {
    fontSize: 32,
    lineHeight: 38,
  },
  headerTitle: {
    fontFamily:    FONT_HEADING.bold,     // Syne_800ExtraBold
    fontSize:      22,
    fontWeight:    '800',
    color:         C.headerText,
    letterSpacing: 1.5,
    lineHeight:    26,
  },
  headerSub: {
    fontFamily:    FONT_BODY.regular,     // Inter_400Regular
    fontSize:      12,
    fontWeight:    '400',
    color:         C.headerSub,
    marginTop:     1,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:   20,
  },
  headerDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  headerCount: {
    fontFamily:  FONT_BODY.semiBold,      // Inter_600SemiBold
    fontSize:    12,
    fontWeight:  '600',
    color:       '#FFFFFF',
  },

  // ── SEARCH BAR ─────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  14,
    marginTop:         14,
    marginBottom:      4,
    height:            44,
    borderRadius:      22,
    backgroundColor:   C.searchBg,
    borderWidth:       1,
    borderColor:       C.searchBorder,
    paddingHorizontal: 12,
    gap:               8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex:        1,
    fontFamily:  FONT_BODY.regular,
    fontSize:    14,
    fontWeight:  '400',
    color:       C.textPrimary,
    paddingVertical: 0,
  },
  searchClear: {
    padding: 4,
  },

  // ── REGION CHIPS ───────────────────────────────────────────────────────────
  regionScroll: {
    flexGrow:   0,
    marginTop:  10,
  },
  regionContent: {
    paddingHorizontal: 14,
    gap:               8,
    paddingBottom:     4,
  },
  regionChip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:     20,
    backgroundColor:  C.chipIdle,
    borderWidth:      1,
    borderColor:      C.chipIdleBorder,
  },
  regionChipActive: {
    backgroundColor: C.chipActive,
    borderColor:     C.chipActive,
  },
  regionChipEmoji: {
    fontSize: 13,
    lineHeight: 18,
  },
  regionChipLabel: {
    fontFamily:  FONT_BODY.semiBold,
    fontSize:    12,
    fontWeight:  '600',
    color:       C.textSecondary,
    letterSpacing: 0.1,
  },
  regionChipLabelActive: {
    color: '#FFFFFF',
  },

  // ── CITY GRID ──────────────────────────────────────────────────────────────
  gridList: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: 10,
    paddingTop:        10,
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingTop:        10,
  },
  cardRow: {
    flexDirection: 'row',
  },
  cardPressable: {
    flex:   1,
    margin: 5,
  },
  card: {
    flex:             1,
    borderRadius:     14,
    padding:          13,
    backgroundColor:  C.cardBg,
    borderWidth:      1,
    borderColor:      C.cardBorder,
    minHeight:        110,
    overflow:         'hidden',
    ...Platform.select({
      ios: {
        shadowColor:   '#00000015',
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius:  6,
      },
      android: { elevation: 2 },
    }),
  },
  cardActive: {
    backgroundColor: C.activeCardBg,
    borderColor:     C.activeCardBorder,
    borderWidth:     2,
  },
  cardAccentBar: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           3,
    backgroundColor: C.activeCardBorder,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardEmoji: {
    fontSize:    24,
    lineHeight:  30,
    marginBottom: 6,
  },
  cardCityName: {
    fontFamily:  FONT_BODY.bold,
    fontSize:    14,
    fontWeight:  '700',
    color:       C.textPrimary,
    lineHeight:  18,
  },
  cardCityNameActive: {
    color: C.activeCardBorder,
  },
  cardState: {
    fontFamily:  FONT_BODY.regular,
    fontSize:    11,
    fontWeight:  '400',
    color:       C.textSecondary,
    marginTop:   2,
    lineHeight:  15,
  },
  liveBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    marginTop:      8,
  },
  liveDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 122, 74, 0.25)',  // dimmed when 0 online
  },
  liveDotActive: {
    backgroundColor: C.liveDot,
  },
  liveText: {
    fontFamily:  FONT_BODY.medium,
    fontSize:    10,
    fontWeight:  '500',
    color:       C.textSecondary,
  },

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  emptyState: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap:             10,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  emptyTitle: {
    fontFamily:  FONT_BODY.bold,
    fontSize:    16,
    fontWeight:  '700',
    color:       C.textPrimary,
    textAlign:   'center',
  },
  emptySub: {
    fontFamily:  FONT_BODY.regular,
    fontSize:    13,
    fontWeight:  '400',
    color:       C.textSecondary,
    textAlign:   'center',
    lineHeight:  19,
  },

  // ── SPINNER OVERLAY ────────────────────────────────────────────────────────
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    alignItems:      'center',
    justifyContent:  'center',
  },
});

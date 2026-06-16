/**
 * components/organisms/CityPickerSheet.tsx — v6.0 (CountryPickerSheet design parity)
 *
 * CROWN — City Selection Bottom Sheet
 * "Same premium sheet as Country. Adapted for cities. Filtered by State/District."
 *
 * ── WHAT CHANGED (v6.0) ──────────────────────────────────────────────────────
 *
 * This file's VISUAL DESIGN is now a 1:1 match with CountryPickerSheet.tsx
 * (v5.14): the OTT trending hero cards, the alphabet sidebar + letter overlay,
 * the Recently Visited section, the Reanimated search-glow, the pinned shell +
 * merged title row, the skeletons, the switching overlay, the spacing/typography
 * tokens — all identical to the Country sheet so the two feel like siblings.
 *
 * The LOGIC is *adapted*, not blind-copied. A city has no continent, so the
 * Country sheet's "Region" axis (Asia/Europe/Africa…) is meaningless here.
 * The mapping applied:
 *
 * Country sheet                →   City sheet (this file)
 * ──────────────────────────────────────────────────────────────────────────
 * Region filter (fixed list)   →   State/District filter (DERIVED from data)
 * REGION_ACCENT / REGION_BG    →   single gold accent (no per-state colours)
 * Flag emoji avatar            →   first-letter monogram avatar
 * Region sub-label             →   State (+ sector count) sub-label
 * ISO code chip                →   (removed — cities have no ISO)
 * Dial-code search             →   (removed — search by name + state)
 * countries collection (web)   →   getCities() realtime (native, UNCHANGED)
 *
 * The data layer is deliberately untouched from the previous CityPickerSheet:
 * getCities() onSnapshot, FALLBACK_CITIES, the AsyncStorage keys, the native
 * firestore + auth writes, and the onSelect(cityId) contract all behave exactly
 * as before.
 * Parent screen (app/(tabs)/index.tsx) needs zero changes.
 *
 * ── STATE/DISTRICT FILTER ─────────────────────────────────────────────────────
 *
 * • The pill row is built at runtime from the unique `state` values present in
 * the loaded cities, sorted A–Z, prefixed with "All".
 * Punjab, Haryana, etc. appear automatically — no hardcoding.
 * • If the data has no states at all, the pill row hides itself gracefully (collapses to 0 height).
 * • Selecting a state filters the list to cities in that state; "All" clears it.
 * • Searching collapses the pills (same as Country).
 *
 * ── USAGE (unchanged) ─────────────────────────────────────────────────────────
 *
 * <CityPickerSheet
 * visible={citySheetOpen}
 * onClose={() => setCitySheetOpen(false)}
 * selected={currentCityId}
 * countryCode={currentCountryCode} // <── FIXED: Country filter
 * onSelect={(cityId) => setCurrentCityId(cityId)}
 * />
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
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  type GestureResponderEvent,
  type AccessibilityActionEvent,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather }       from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';
import AsyncStorage      from '@react-native-async-storage/async-storage';
// ── Native Firebase (UNCHANGED data layer) ────────────────────────────────────
// The City sheet uses the React-Native-Firebase native SDK for the user-profile
// write + auth, and getCities() (an onSnapshot subscription) for the city list.
// This is intentionally different from CountryPickerSheet (which uses the web JS
// SDK) — we copy the Country sheet's DESIGN, never its data layer.
import firestore         from '@react-native-firebase/firestore';
import auth              from '@react-native-firebase/auth';
// ── In-house BottomSheet — the SAME Modal-based sheet the Country picker uses ──
import { BottomSheet } from '@/components/BottomSheet';
import { getCities }   from '@/lib/firestore-rooms';

import { colors, palette }            from '@/constants/colors';
import { FONT_BODY, FONT_HEADING }    from '@/constants/typography';
// ── react-native-reanimated v4 (with react-native-worklets) ───────────────────
import ReAnimated, {
  Easing as REasing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
// [parity] Fixed tall sheet (≈90% screen) — matches CountryPickerSheet so the
// trending row + alphabet sidebar have room and there is zero height jump
// between loading and idle.
// (Previous City sheet was a 50% half-sheet.)
const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.9);
// ─── Storage keys (UNCHANGED — City sheet keys) ───────────────────────────────
const CW_CITY_KEY           = 'cw:selected_city'   as const;
const CW_RECENT_CITIES_KEY  = 'cw:recent_cities'   as const;
const MAX_RECENTS           = 5                     as const;
const TRENDING_COUNT        = 10                    as const;
// Top-10 OTT pattern

// ─── Firestore collections (native) ───────────────────────────────────────────
const USERS_COLLECTION      = 'users' as const;
// ─── Fallback list — shown if Firestore is slow/offline ───────────────────────
const CITY_LOAD_TIMEOUT_MS  = 7000;
const FALLBACK_CITIES: CityDoc[] = [
  { id: 'chandigarh',  name: 'Chandigarh',  state: 'Punjab',        online_count: 0, sector_count: 0, is_active: true },
  { id: 'delhi',       name: 'Delhi',       state: 'Delhi NCR',     online_count: 0, sector_count: 0, is_active: true },
  { id: 'mumbai',      name: 'Mumbai',      state: 'Maharashtra',   online_count: 0, sector_count: 0, is_active: true },
  { id: 'bangalore',   name: 'Bangalore',   state: 'Karnataka',     online_count: 0, sector_count: 0, is_active: true },
  { id: 'hyderabad',   name: 'Hyderabad',   state: 'Telangana',     online_count: 0, sector_count: 0, is_active: true },
  { id: 'pune',        name: 'Pune',        state: 'Maharashtra',   online_count: 0, sector_count: 0, is_active: true },
  { id: 'kolkata',     name: 'Kolkata',     state: 'West Bengal',   online_count: 0, sector_count: 0, is_active: true },
  { id: 'chennai',     name: 'Chennai',     state: 'Tamil Nadu',    online_count: 0, sector_count: 0, is_active: true },
  { id: 'ahmedabad',   name: 'Ahmedabad',   state: 'Gujarat',       online_count: 0, sector_count: 0, is_active: true },
  { id: 'jaipur',      name: 'Jaipur',      state: 'Rajasthan',     online_count: 0, sector_count: 0, is_active: true },
  { id: 'lucknow',     name: 'Lucknow',     state: 'Uttar Pradesh', online_count: 0, sector_count: 0, is_active: true },
  { id: 'amritsar',    name: 'Amritsar',    state: 'Punjab',        online_count: 0, sector_count: 0, is_active: true },
];
// ─── Layout constants (parity with CountryPickerSheet) ────────────────────────
const L = {
  rowH:         74,
  sectionH:     34,
  divH:          1,
  rowPadH:      16,
  avatarBox:    48,
  avatarRadius: 14,
  heroW:       154,
  heroH:       112,
  heroR:        20,
  heatW:        48,
  searchH:      52,
  closeBtn:     44,
  shimmerRows:   7,
  shimmerDur:  1200,
  pillH:        34,
  pillRowH:     52,
  alphaBarW:    22,
} as const;
// ─── Design token aliases (parity — palette-sourced, gold #D4A017) ────────────
const T = {
  sheetBg:       colors.bg.surface,   // #FFFFFF
  text:          palette.ink[950],
  textSecondary: palette.ink[600],
  textTertiary:  palette.ink[400],
  textMuted:     palette.ink[200],
  surfaceSunken: palette.cream[100],
  surfaceWell:   palette.cream[200],
  border:        palette.cream[300],
  borderSubtle:  palette.cream[200],
  gold:          palette.gold[600],   // #D4A017 — correct brand gold
  goldLight:     palette.gold[300],
  goldDim:       palette.gold[200],
  goldSubtle:    palette.gold[100],
  green:         palette.emerald[500],
  emerald:       palette.emerald[600],
  amber:         palette.amber[600],
} as const;
// ─── Derived overlay values (parity) ──────────────────────────────────────────
const DV = {
  activeRowBg:    'rgba(212,160,23,0.09)' as const,
  activeRowBorder:'rgba(212,160,23,0.24)' as const,
  sectionBg:      'rgba(255,255,255,0.97)'as const,
  switchOverlay:  'rgba(255,255,255,0.93)'as const,
} as const;
// ─── Haptic helpers (try/catch for restrictive Android ROMs) ──────────────────
const hapticLight  = async (): Promise<void> => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* no-op */ }
};
const hapticMedium = async (): Promise<void> => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch { /* no-op */ }
};
const hapticSelect = async (): Promise<void> => {
  try { await Haptics.selectionAsync();
  } catch { /* no-op */ }
};

// ─── Types ─────────────────────────────────────────────────────────────────────
/** Filter axis. 'All' is the sentinel; every other value is a real state name. */
type StateFilter = string;

type SectionItem = { type: 'section'; letter: string };
type CityItem    = { type: 'city';    city: CityDoc };
type DividerItem = { type: 'divider'; id: string };
type ListItem    = SectionItem | CityItem | DividerItem;
/**
 * Shape of a document in the Firestore /cities collection.
 * online_count: total active users across all sectors in this city.
 * sector_count: number of sectors available to join.
 * state:        used as the filter axis (replaces Country's "region").
 */
export interface CityDoc {
  id:               string;
  name:             string;
  state?:           string;
  online_count:     number;
  sector_count:     number;
  is_active:        boolean;
  search_keywords?: string[]; 
}

export interface CityPickerSheetProps {
  /** Whether the bottom sheet is currently visible */
  visible:  boolean;
  /** Called when sheet should close (backdrop tap, drag-down, or after selection) */
  onClose:  () => void;
  /** Currently selected cityId — used to highlight the active row */
  selected: string;
  /** Selected Country Code to filter cities */
  countryCode: string;
  /** Called with the new cityId after user confirms selection */
  onSelect: (cityId: string) => void;
}

// ─── Utility: diacritic normalization ─────────────────────────────────────────
function normalizeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── ✅ SMART DATA SANITIZER: Clean raw database names ───────────────────────
// Removes weird dots, diacritics (like Ï), and leading special characters
function formatCleanName(str: string): string {
  if (!str) return '';
  // 1. Remove accents/diacritics (e.g., 'ï' -> 'i', 'é' -> 'e')
  let clean = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // 2. Remove ANY dots/periods (e.g., "A.in" -> "Ain")
  clean = clean.replace(/\./g, '');
  // 3. Remove leading special characters (hyphens, commas at the start)
  clean = clean.replace(/^[^a-zA-Z0-9]+/g, '');
  // 4. Remove extra spaces
  clean = clean.replace(/\s+/g, ' ').trim();
  
  if (clean.length > 0) {
    // Ensure first letter is capitalized for beautiful UI
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean || str;
}

// ─── Utility: city monogram (first letter, uppercase) ─────────────────────────
function cityInitial(name: string): string {
  const ch = name?.trim()?.[0] ?? '\u2022';
  return ch.toUpperCase();
}

// ─── Utility: sector label ────────────────────────────────────────────────────
function sectorLabel(n: number): string {
  return n === 1 ? '1 sector' : `${n} sectors`;
}

// ─── Utility: Global short-count formatter (K/M/B) — parity ───────────────────
function fmtCount(n: number): string {
  if (n <= 0) return '0';
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return n.toLocaleString('en-US');
}

// ─── Build A-Z grouped flat-list data (takes a PRE-SORTED array) ──────────────
function buildAlphaSections(sorted: CityDoc[]): ListItem[] {
  const items: ListItem[] = [];
  let prevLetter     = '';
  let prevWasSection = true;
  for (const city of sorted) {
    const letter = city.name[0]?.toUpperCase() ?? '#';
    if (letter !== prevLetter) {
      items.push({ type: 'section', letter });
      prevLetter     = letter;
      prevWasSection = true;
    } else if (!prevWasSection) {
      items.push({ type: 'divider', id: `div-${city.id}` });
    }
    items.push({ type: 'city', city });
    prevWasSection = false;
  }
  return items;
}

function buildSearchResults(cities: CityDoc[]): ListItem[] {
  return cities.flatMap((c, i) =>
    i === 0
      ? [{ type: 'city', city: c } as CityItem]
      : [{ type: 'divider', id: `sdiv-${c.id}` } as DividerItem, { type: 'city', city: c } as CityItem],
  );
}

function precomputeLayouts(
  data: ListItem[],
): Array<{ length: number; offset: number; index: number }> {
  const out: Array<{ length: number; offset: number; index: number }> = [];
  let offset = 0;
  for (let i = 0; i < data.length; i++) {
    const item   = data[i]!;
    const length =
      item.type === 'section' ? L.sectionH :
      item.type === 'divider' ? L.divH     :
      L.rowH;
    out.push({ length, offset, index: i });
    offset += length;
  }
  return out;
}

// ─── PulseContext — instance-safe, ref-counted pulse animation (parity) ───────
interface _PulseCtx {
  anim:     SharedValue<number>;
  register: () => () => void;
}

const PulseContext = React.createContext<_PulseCtx | null>(null);
const PulseProvider = memo<{ children: React.ReactNode }>(({ children }) => {
  const anim = useSharedValue(1);
  const refs = useRef(0);

  const register = useCallback((): (() => void) => {
    refs.current++;
    if (refs.current === 1) {
      anim.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 850 }),
          withTiming(1.0, { duration: 850 }),
        ),
        -1,
        false,
      );
    }
    return () => {
      refs.current = Math.max(0, refs.current - 1);
      if (refs.current === 0) {
        cancelAnimation(anim);
        anim.value = withTiming(1, { duration: 150 });
      }
    };
  }, [anim]);

  const ctx = useMemo(() => ({ anim, register }), [anim, register]);

  return <PulseContext.Provider value={ctx}>{children}</PulseContext.Provider>;
});
PulseProvider.displayName = 'CityPickerSheet.PulseProvider';

function usePulse(enabled: boolean): SharedValue<number> {
  const ctx = React.useContext(PulseContext);
  const fallback = useSharedValue(1);
  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.register();
  }, [enabled, ctx]);
  return ctx ? ctx.anim : fallback;
}

// ─── LiveDot (parity) ──────────────────────────────────────────────────────────
const LiveDot = memo<{ size?: number; gold?: boolean; pulse?: boolean }>(
  ({ size = 7, gold = false, pulse = false }) => {
    const anim     = usePulse(pulse);
    const animStyle = useAnimatedStyle(() => ({
      opacity: pulse ? anim.value : 1,
    }));
    return (
      <ReAnimated.View
        style={[
          {
            width:           size,
            height:          size,
            borderRadius:    size / 2,
            backgroundColor: gold ? T.gold : T.green,
          },
          animStyle,
        ]}
        accessible={false}
      />
    );
  },
);
LiveDot.displayName = 'CityPickerSheet.LiveDot';
// ─── SkeletonRow (parity) ──────────────────────────────────────────────────────
const SkeletonRow = memo<{ shimmer: SharedValue<number> }>(({ shimmer }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.8]),
  }));
  return (
    <View style={sk.row}>
      <ReAnimated.View style={[sk.avatar, animStyle]} />
      <View style={sk.body}>
        <ReAnimated.View style={[sk.line1, animStyle]} />
        <ReAnimated.View style={[sk.line2, animStyle]} />
      </View>
      <ReAnimated.View style={[sk.badge, animStyle]} />
    </View>
  );
});
SkeletonRow.displayName = 'CityPickerSheet.SkeletonRow';

const sk = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', paddingHorizontal:L.rowPadH, height:L.rowH, gap:14 },
  avatar: { width:L.avatarBox, height:L.avatarBox, borderRadius:L.avatarRadius, backgroundColor:T.surfaceWell },
  body:   { flex:1, gap:8 },
  line1:  { height:14, borderRadius:7, backgroundColor:T.surfaceWell, width:'60%' as const },
  line2:  { height:11, borderRadius:6, backgroundColor:T.surfaceWell, width:'38%' as const },
  badge:  { width:L.heatW, height:8, borderRadius:4, backgroundColor:T.surfaceWell },
});
// ─── SkeletonHeroCard (parity — mirrors the OTT ranking card layout) ──────────
const SkeletonHeroCard = memo<{ shimmer: SharedValue<number> }>(({ shimmer }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.25, 0.75]),
  }));
  return (
    <ReAnimated.View style={[skh.card, animStyle]}>
      <ReAnimated.View style={[skh.avatar, animStyle]} />
      <ReAnimated.View style={[skh.badge,  animStyle]} />
      <ReAnimated.View style={[skh.name,   animStyle]} />
      <ReAnimated.View style={[skh.region, animStyle]} />
    </ReAnimated.View>
  );
});
SkeletonHeroCard.displayName = 'CityPickerSheet.SkeletonHeroCard';

const skh = StyleSheet.create({
  card: {
    width:           L.heroW,
    height:          L.heroH,
    borderRadius:    L.heroR,
    borderWidth:     1.5,
    borderColor:     T.border,
    backgroundColor: T.surfaceWell,
  },
  avatar: {
    position:        'absolute',
    top:             11,
    left:            12,
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: T.surfaceSunken,
  },
  badge: {
    position:        'absolute',
    top:             14,
    right:           11,
    width:           60,
    height:          14,
    borderRadius:    7,
    backgroundColor: T.surfaceSunken,
  },
  name: {
    position:        'absolute',
    bottom:          30,
    left:            12,
    width:           74,
    height:          13,
    borderRadius:    7,
    backgroundColor: T.surfaceSunken,
  },
  region: {
    position:        'absolute',
    bottom:          12,
    left:            12,
    width:           44,
    height:          10,
    borderRadius:    5,
    backgroundColor: T.surfaceSunken,
  },
});
// ─── SectionHeader (parity) ────────────────────────────────────────────────────
const SectionHeader = memo<{ letter: string }>(({ letter }) => (
  <View style={sec.wrap} accessibilityRole="header">
    <Text
      style={sec.letter}
      accessibilityLabel={`Cities starting with ${letter}`}
    >
      {letter}
    </Text>
  </View>
));
SectionHeader.displayName = 'CityPickerSheet.SectionHeader';

const sec = StyleSheet.create({
  wrap: {
    height:            L.sectionH,
    paddingHorizontal: L.rowPadH,
    justifyContent:    'center',
    backgroundColor:   DV.sectionBg,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSubtle,
  },
  letter: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    fontFamily:    FONT_BODY.bold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
});
// ─── HeroCard (OTT ranking card — parity, with monogram avatar) ───────────────
interface HeroCardProps {
  city:           CityDoc;
  isSelected:     boolean;
  onPress:        (city: CityDoc) => void;
  rank:           number;
  // 1-based trending position (1–10)
  entryDelay?:    number;        // ms delay for stagger
  reducedMotion?: boolean;
}

const HeroCard = memo<HeroCardProps>(({
  city,
  isSelected,
  onPress,
  rank,
  entryDelay    = 0,
  reducedMotion = false,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => onPress(city), [onPress, city]);
  const onPressIn   = useCallback(() =>
    Animated.spring(scale, { toValue:0.94, useNativeDriver:true, speed:50, bounciness:0 }).start(),
  [scale]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue:1.00, useNativeDriver:true, speed:40, bounciness:5 }).start(),
  [scale]);

  const entering = useMemo(
    () => reducedMotion
      ? undefined
      : SlideInRight.delay(entryDelay).duration(300).springify().damping(18),
    [entryDelay, reducedMotion],
  );

  const isOnline = city.online_count > 0;
  const sub      = city.state || sectorLabel(city.sector_count);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${city.name}, #${rank} trending, ${fmtCount(city.online_count)} online`}
      accessibilityState={{ selected: isSelected }}
    >
      <ReAnimated.View
        entering={entering}
        style={[
          hc.card,
          isSelected && { borderColor: T.gold },
          isSelected && hc.cardActive,
          { transform: [{ scale }] },
        ]}
      >
        <View style={hc.inner}>

          {/* TOP-LEFT: monogram avatar (replaces Country's flag emoji) */}
          <View style={[hc.avatar, isSelected && hc.avatarActive]}>
            <Text style={[hc.avatarMono, isSelected && { color: T.gold }]} accessible={false}>
              {cityInitial(city.name)}
            </Text>
          </View>

          {/* TOP-RIGHT: online status pill badge */}
          <View style={hc.onlinePill}>
            <View style={[hc.pillDot, isOnline && hc.pillDotLive]} />
            <Text style={hc.pillText}>
              {isOnline ? fmtCount(city.online_count) : '0'}{' online'}
            </Text>
          </View>

          {/* BOTTOM-LEFT: city name + state (replaces region) */}
          <View style={hc.nameGroup}>
            <Text style={[hc.name, isSelected && { color: T.gold }]} numberOfLines={1}>
              {city.name}
            </Text>
            <Text style={[hc.region, isSelected && { color: T.gold }]} numberOfLines={1}>
              {sub}
            </Text>
          </View>

          {/* BOTTOM-RIGHT: massive rank numeral — bleeds off the right edge */}
          <Text
            style={[hc.rankNum, isSelected && hc.rankNumActive]}
            accessible={false}
          >
            {rank}
          </Text>

        </View>
      </ReAnimated.View>
    </Pressable>
  );
});
HeroCard.displayName = 'CityPickerSheet.HeroCard';

const hc = StyleSheet.create({
  card: {
    width:           L.heroW,
    height:          L.heroH,
    borderRadius:    L.heroR,
    borderWidth:     1.5,
    borderColor:     T.border,
    backgroundColor: T.sheetBg,
    shadowColor:     T.text,
    shadowOpacity:   0.06,
    shadowRadius:    10,
    shadowOffset:    { width:0, height:3 },
    elevation:       2,
  },
  cardActive: { shadowOpacity:0.18, shadowRadius:22, elevation:6 },

  inner: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    borderRadius:    L.heroR - 1,
    backgroundColor: T.sheetBg,
    overflow:        'hidden',
  },

  // TOP-LEFT: monogram avatar circle (matches skeleton skh.avatar)
  avatar: {
    position:        'absolute',
    top:             11,
    left:            12,
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: T.goldSubtle,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarActive: { backgroundColor: T.goldDim },
  avatarMono: {
    fontSize:   17,
    fontWeight: '800',
    color:      T.text,
    fontFamily: FONT_HEADING.bold,
    includeFontPadding: false,
  },

  onlinePill: {
    position:        'absolute',
    top:               11,
    right:             8,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   'rgba(0,0,0,0.04)',
    borderWidth:       0.5,
    borderColor:       'rgba(0,0,0,0.10)',
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      10,
  },
  pillDot:     { width:5, height:5, borderRadius:3, backgroundColor:T.border },
  pillDotLive: { backgroundColor:T.green },
  pillText: {
    fontSize:   9,
    fontWeight: '600',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.semiBold,
  },

  nameGroup: {
    position: 'absolute',
    bottom:    12,
    left:     12,
    right:    28,
  },
  name: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.text,
    fontFamily: FONT_HEADING.semiBold,
  },
  region: {
    fontSize:   10,
    fontWeight: '500',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.medium,
    marginTop:  2,
  },

  // Orange rank watermark — same warm base (234,88,12) as Country / bottom-nav
  rankNum: {
    position:   'absolute',
    bottom:     -10,
    right:      -10,
    fontSize:   80,
    fontWeight: '900',
    color:      'rgba(234,88,12,0.65)',
    lineHeight: 88,
  },
  rankNumActive: { color: 'rgba(234,88,12,0.75)' },
});
// ─── CityRow (parity with CountryRow — monogram avatar, state sub-label) ──────
interface CityRowProps {
  city:       CityDoc;
  isSelected: boolean;
  onPress:    (city: CityDoc) => void;
}

const CityRow = memo<CityRowProps>(({ city, isSelected, onPress }) => {
  const scale     = useRef(new Animated.Value(1)).current;
  const flashAnim = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashAnim.value }));

  const handlePress = useCallback(() => onPress(city), [onPress, city]);
  const onPressIn   = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
    flashAnim.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }, [scale, flashAnim]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 55, bounciness: 4 }).start(),
  [scale]);

  const sub = city.state
    ? `${city.state} \u00B7 ${sectorLabel(city.sector_count)}`
    : sectorLabel(city.sector_count);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${city.name}, ${sub}, ${
        city.online_count > 0 ? fmtCount(city.online_count) + ' online' : 'no one online'
      }`}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View
        style={[
          cr.row,
          isSelected && cr.rowActive,
          { transform: [{ scale }] },
        ]}
      >
        {/* Monogram avatar (replaces Country's flag emoji box) */}
        <View style={[cr.avatarBox, isSelected && cr.avatarBoxActive]}>
          <Text style={[cr.avatarMono, isSelected && { color: T.gold }]} accessible={false}>
            {cityInitial(city.name)}
          </Text>
        </View>

        <View style={cr.body}>
          <View style={cr.nameRow}>
            <Text style={[cr.name, isSelected && cr.nameActive]} numberOfLines={1}>
              {city.name}
            </Text>
          </View>

          {/* State sub-label (replaces Country's region label) */}
          <Text style={[cr.subLabel, isSelected && cr.subLabelActive]} numberOfLines={1}>
            {sub}
          </Text>
        </View>

        {/* Online count badge */}
        <View style={[cr.onlineBadge, isSelected && cr.onlineBadgeActive]}>
          <View
            style={[
              cr.badgeDot,
              { backgroundColor: city.online_count > 0 ? T.green : T.border },
            ]}
          />
          <Text style={[cr.badgeText, isSelected && { color: T.gold }]}>
            {city.online_count > 0 ? `${fmtCount(city.online_count)} online` : '0 online'}
          </Text>
        </View>

        {isSelected ? (
          <View style={[cr.checkCircle, { backgroundColor: T.gold }]}>
            <Feather name="check" size={12} color={T.sheetBg} />
          </View>
        ) : (
          <Feather name="chevron-right" size={16} color={T.textTertiary} />
        )}

        {/* Selected-state left accent rail — gold, rounded pill */}
        {isSelected && (
          <View
            style={[cr.selectedRail, { backgroundColor: T.gold }]}
            pointerEvents="none"
            importantForAccessibility="no"
          />
        )}

        {/* Press flash overlay (UI thread) */}
        <ReAnimated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: DV.activeRowBg }, flashStyle]}
          pointerEvents="none"
        />
      </Animated.View>
    </Pressable>
  );
});
CityRow.displayName = 'CityPickerSheet.CityRow';

const cr = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    height:            L.rowH,
    gap:               14,
    backgroundColor:   T.sheetBg,
  },
  rowActive: { backgroundColor: DV.activeRowBg },

  avatarBox: {
    width:           L.avatarBox,
    height:         L.avatarBox,
    borderRadius:   L.avatarRadius,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: T.goldSubtle,
    flexShrink:     0,
  },
  avatarBoxActive: { backgroundColor: T.goldDim },
  avatarMono: {
    fontSize:   20,
    fontWeight: '800',
    color:      T.text,
    fontFamily: FONT_HEADING.bold,
    includeFontPadding: false,
  },

  body:     { flex:1, gap:6 },
  nameRow: { flexDirection:'row', alignItems:'center', gap:6 },
  name: {
    fontSize:   15,
    fontWeight: '600',
    color:      T.text,
    fontFamily: FONT_HEADING.medium,
    flexShrink: 1,
  },
  nameActive: { color:T.gold, fontWeight:'700' },

  subLabel: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.medium,
  },
  subLabelActive: { color: T.goldLight },

  onlineBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   5,
    borderRadius:      20,
    backgroundColor:   T.surfaceSunken,
    flexShrink:        0,
  },
  onlineBadgeActive: { backgroundColor: DV.activeRowBg },
  badgeDot:  { width:5, height:5, borderRadius:2.5, flexShrink:0 },
  badgeText: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
  },
  checkCircle: {
    width:28, height:28, borderRadius:14,
    alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
  selectedRail: {
    position:     'absolute',
    left:         6,
    top:          14,
    bottom:       14,
    width:        3,
    borderRadius: 1.5,
  },
});
// ─── RowDivider (parity) ───────────────────────────────────────────────────────
const RowDivider = memo(() => (
  <View
    style={{ height:L.divH, backgroundColor:T.borderSubtle, marginHorizontal:L.rowPadH }}
    accessible={false}
    importantForAccessibility="no-hide-descendants"
  />
));
RowDivider.displayName = 'CityPickerSheet.RowDivider';

// ─── StatePill (replaces Country's RegionPill — same visual) ──────────────────
interface StatePillProps {
  label:   StateFilter;
  active:  boolean;
  count?:  number;
  onPress: (filter: StateFilter) => void;
}

const StatePill = memo<StatePillProps>(({ label, active, count, onPress }) => {
  const handlePress = useCallback(() => onPress(label), [onPress, label]);
  const displayText = count !== undefined ? `${label} \u00B7 ${count}` : label;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityLabel={count !== undefined ? `${label}, ${count} cities` : `Filter by ${label}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [sp.pill, active && sp.pillActive, pressed && { opacity:0.72 }]}
    >
      <Text style={[sp.text, active && sp.textActive]}>{displayText}</Text>
    </Pressable>
  );
});
StatePill.displayName = 'CityPickerSheet.StatePill';
const sp = StyleSheet.create({
  pill: {
    height:            L.pillH,
    paddingHorizontal: 16,
    borderRadius:      L.pillH / 2,
    borderWidth:       1,
    borderColor:       T.border,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   T.sheetBg,
  },
  pillActive: { borderColor:T.gold, backgroundColor:T.goldSubtle },
  text:        { fontSize:13, fontWeight:'600', color:T.textSecondary, fontFamily:FONT_BODY.semiBold },
  textActive: { color: T.gold },
});
// ─── AlphabetSidebar (parity) ──────────────────────────────────────────────────
interface AlphabetSidebarProps {
  letters:        string[];
  onPress:        (letter: string) => void;
  onLetterChange: (letter: string | null) => void;
}

const AlphabetSidebar = memo<AlphabetSidebarProps>(
  ({ letters, onPress, onLetterChange }) => {
    const heightRef    = useRef(0);
    const lastIdxRef   = useRef(-1);
    const lastHapticMs = useRef(0);

    const onPressRef        = useRef(onPress);
    const onLetterChangeRef = useRef(onLetterChange);
    const lettersRef        = useRef(letters);

    useEffect(() => { onPressRef.current        = onPress;        }, [onPress]);
    useEffect(() => { onLetterChangeRef.current = onLetterChange; }, [onLetterChange]);
    useEffect(() => { lettersRef.current        = letters;        }, [letters]);

    const hitLetter = useCallback((locationY: number) => {
      const ls = lettersRef.current;
      if (heightRef.current <= 0 || ls.length === 0) return;
      const idx     = Math.floor((locationY / heightRef.current) * ls.length);
      const clamped = Math.max(0, Math.min(ls.length - 1, idx));
      if (clamped !== lastIdxRef.current) {
        lastIdxRef.current = clamped;
        const letter = ls[clamped];
        if (letter) {
          const now = Date.now();
          if (now - lastHapticMs.current >= 50) {
            lastHapticMs.current = now;
            void hapticSelect();
          }
          onLetterChangeRef.current(letter);
          onPressRef.current(letter);
        }
      }
    }, []);
    const panHandlers = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => false,
        onPanResponderGrant:   (e: GestureResponderEvent) => { lastIdxRef.current = -1; hitLetter(e.nativeEvent.locationY); },
        onPanResponderMove:    (e: GestureResponderEvent) => { hitLetter(e.nativeEvent.locationY); },
        onPanResponderRelease: () => {
          lastIdxRef.current = -1;
          onLetterChangeRef.current(null);
        },
      }).panHandlers,
    ).current;
    return (
      <View
        style={ab.wrap}
        onLayout={(e) => { heightRef.current = e.nativeEvent.layout.height; }}
        {...panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Alphabet scroller, ${letters.length} letters`}
        accessibilityHint="Drag to jump to a letter"
        accessibilityActions={[
          { name: 'increment', label: 'Next letter' },
          { name: 'decrement', label: 'Previous letter' },
        ]}
        onAccessibilityAction={(event: AccessibilityActionEvent) => {
          const ls = lettersRef.current;
          if (ls.length === 0) return;
          const cur  = lastIdxRef.current < 0 ? 0 : lastIdxRef.current;
          const next = event.nativeEvent.actionName === 'increment'
            ? Math.min(ls.length - 1, cur + 1)
            : Math.max(0, cur - 1);
          lastIdxRef.current = next;
          const letter = ls[next];
          if (letter) {
            void hapticSelect();
            onLetterChangeRef.current(letter);
            onPressRef.current(letter);
          }
        }}
      >
        {letters.map((letter) => (
          <View key={letter} style={ab.btn} accessible={false}>
            <Text style={ab.letter}>{letter}</Text>
          </View>
        ))}
      </View>
    );
  },
);
AlphabetSidebar.displayName = 'CityPickerSheet.AlphabetSidebar';

const ab = StyleSheet.create({
  wrap: {
    position:      'absolute',
    right:         2,
    top:           0,
    bottom:        0,
    width:         L.alphaBarW,
    flexDirection: 'column',
    alignItems:    'center',
    zIndex:        10,
  },
  btn: {
    width:          L.alphaBarW,
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      8,
  },
  letter: { fontSize:10, fontWeight:'700', color:T.gold, fontFamily:FONT_BODY.bold },
});
// ─── LetterOverlay (parity) ────────────────────────────────────────────────────
const LetterOverlay = memo<{ letter: string | null; reducedMotion?: boolean }>(
  ({ letter, reducedMotion = false }) => {
    const scale   = useSharedValue(0.7);
    const opacity = useSharedValue(0);

    useEffect(() => {
      if (letter) {
        if (reducedMotion) {
          scale.value   = 1;
          opacity.value = 1;
        } else {
          scale.value   = withSpring(1, { damping: 15, stiffness: 350 });
          opacity.value = withTiming(1, { duration: 150 });
        }
      } else {
        if (reducedMotion) {
          scale.value   = 0.7;
          opacity.value = 0;
        } else {
          scale.value   = withTiming(0.7, { duration: 100 });
          opacity.value = withTiming(0,   { duration: 100 });
        }
      }
    }, [letter, reducedMotion, scale, opacity]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity:    opacity.value,
    }));

    return (
      <View style={lo.container} pointerEvents="none">
        <ReAnimated.View style={[lo.bubble, animStyle]}>
          <Text style={lo.letter}>{letter ?? ''}</Text>
        </ReAnimated.View>
      </View>
    );
  },
);
LetterOverlay.displayName = 'CityPickerSheet.LetterOverlay';

const lo = StyleSheet.create({
  container: {
    position:       'absolute',
    left:           0,
    right:          0,
    top:            0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:          50,
  },
  bubble: {
    width:          80,
    height:         80,
    borderRadius:   20,
    backgroundColor: T.gold,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    T.gold,
    shadowOpacity:  0.40,
    shadowRadius:   20,
    shadowOffset:   { width:0, height:4 },
    elevation:      14,
  },
  letter: {
    fontSize:   40,
    fontWeight: '800',
    color:      T.sheetBg,
    fontFamily: FONT_HEADING.bold,
    lineHeight: 44,
    includeFontPadding: false,
  },
});
// ─── AlphaSidebarAndOverlay (parity — owns the active letter locally) ─────────
interface AlphaSidebarAndOverlayProps {
  letters:       string[];
  onPress:       (letter: string) => void;
  reducedMotion: boolean;
}

const AlphaSidebarAndOverlay = memo<AlphaSidebarAndOverlayProps>(
  ({ letters, onPress, reducedMotion }) => {
    const [activeLetter, setActiveLetter] = useState<string | null>(null);
    return (
      <>
        <AlphabetSidebar
          letters={letters}
          onPress={onPress}
          onLetterChange={setActiveLetter}
        />
        <LetterOverlay letter={activeLetter} reducedMotion={reducedMotion} />
      </>
    );
  },
);
AlphaSidebarAndOverlay.displayName = 'CityPickerSheet.AlphaSidebarAndOverlay';

// ─── RecentlyVisitedSection (parity — renders CityRows) ───────────────────────
interface RecentlyVisitedProps {
  cities:   CityDoc[];
  selected: string;
  onSelect: (city: CityDoc) => void;
}

const RecentlyVisitedSection = memo<RecentlyVisitedProps>(
  ({ cities, selected, onSelect }) => (
    <View>
      <View style={rv.headerRow}>
        <Feather name="clock" size={12} color={T.gold} />
        <Text style={rv.label}>RECENTLY VISITED</Text>
      </View>
      {cities.map((c) => (
        <CityRow
          key={c.id}
          city={c}
          isSelected={c.id === selected}
          onPress={onSelect}
        />
      ))}
      <View style={rv.sectionDivider} />
    </View>
  ),
);
RecentlyVisitedSection.displayName = 'CityPickerSheet.RecentlyVisitedSection';

const rv = StyleSheet.create({
  headerRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        12,
    marginBottom:     6,
  },
  label: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
    textTransform: 'uppercase',
  },
  sectionDivider: {
    height:          1,
    backgroundColor: T.borderSubtle,
    marginTop:       0,
  },
});
// ─── Main component ────────────────────────────────────────────────────────────
type SheetState = 'loading' | 'idle' | 'switching' | 'error';
function CityPickerSheetBase({
  visible,
  onClose,
  selected,
  countryCode, // <── RECEIVED: from Props
  onSelect,
}: CityPickerSheetProps) {

  const [cities,       setCities]       = useState<CityDoc[]>([]);
  const [sheetState,   setSheetState]   = useState<SheetState>('loading');
  const [rawQuery,     setRawQuery]     = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [stateFilter,  setStateFilter]  = useState<StateFilter>('All');
  const [error,        setError]        = useState<string | null>(null);
  const [reducedMotion,setRM]           = useState(false);
  const [recentIds,    setRecentIds]    = useState<string[]>([]);
  const [switchingTo,  setSwitchingTo]  = useState<CityDoc | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchRef      = useRef<TextInput>(null);
  const listRef        = useRef<FlatList<ListItem>>(null);
  const isMountedRef   = useRef(true);
  const isSwitchingRef = useRef(false);
  const selectedRef    = useRef(selected);
  const recentIdsRef   = useRef(recentIds);
  const unsubRef       = useRef<(() => void) | undefined>(undefined);
  useEffect(() => { selectedRef.current  = selected;  }, [selected]);
  useEffect(() => { recentIdsRef.current = recentIds; }, [recentIds]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
// ── Animated pills row (height + opacity collapse) — parity ─────────────────
  const pillsH  = useSharedValue(L.pillRowH);
  const pillsOp = useSharedValue(1);
  const animatedPillsStyle = useAnimatedStyle(() => ({
    height:   pillsH.value,
    opacity:  pillsOp.value,
    overflow: 'hidden' as const,
  }));
// ── Search-bar focus glow — parity ──────────────────────────────────────────
  const searchFocused = useSharedValue(0);
  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(searchFocused.value, [0, 1], [T.border, T.gold]),
  }));
  const handleSearchFocus = useCallback(() => {
    searchFocused.value = withTiming(1, { duration: 180 });
  }, [searchFocused]);
  const handleSearchBlur = useCallback(() => {
    searchFocused.value = withTiming(0, { duration: 150 });
  }, [searchFocused]);
// ── Shimmer animation (UI thread) — parity ──────────────────────────────────
  const shimmerAnim = useSharedValue(0);
  useEffect(() => {
    if (sheetState !== 'loading') {
      cancelAnimation(shimmerAnim);
      shimmerAnim.value = 0;
      return;
    }
    shimmerAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: L.shimmerDur / 2 }),
        withTiming(0, { duration: L.shimmerDur / 2 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(shimmerAnim);
  }, [sheetState, shimmerAnim]);

  // ── Debounced search — 150ms ────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 150);
    return () => clearTimeout(id);
  }, [rawQuery]);
// ── Reset list scroll when search query settles ─────────────────────────────
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [searchQuery]);
// ── Reduced motion ──────────────────────────────────────────────────────────
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

// ── Load on open — getCities() realtime + timeout fallback ───────────────────
  useEffect(() => {
    if (!visible) return;

    isSwitchingRef.current = false;
    setSheetState('loading');
    setRawQuery('');
    setSearchQuery('');
    setStateFilter('All');
    setError(null);
    setSwitchingTo(null);

    let settled = false;

    // Recents (local, fast)
    AsyncStorage.getItem(CW_RECENT_CITIES_KEY)
      .then((raw) => {
        if (raw && isMountedRef.current) {
          try { setRecentIds(JSON.parse(raw) as string[]); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* non-critical */ });

    // Safety timeout
    const timeoutId = setTimeout(() => {
      if (!settled && isMountedRef.current) {
        const fallbackToUse = countryCode === 'IN' ? FALLBACK_CITIES : [];
        setCities((prev) => (prev.length > 0 ? prev : fallbackToUse));
        setSheetState('idle');
      }
    }, CITY_LOAD_TIMEOUT_MS);

    // ── DATA FETCH AND SANITIZATION ──
    const unsub = getCities(countryCode, (docs: CityDoc[]) => {
      settled = true;
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;
      
      const fallbackToUse = countryCode === 'IN' ? FALLBACK_CITIES : [];
      
      // ✅ Yahan ganda data saaf ho raha hai
      const cleanDocs = docs.map(d => ({
        ...d,
        name: formatCleanName(d.name),
        state: d.state ? formatCleanName(d.state) : undefined,
      }));
      
      setCities(cleanDocs.length > 0 ? cleanDocs : fallbackToUse);
      setSheetState('idle');
    });
    unsubRef.current = unsub;
    return () => {
      clearTimeout(timeoutId);
      unsubRef.current?.();
      unsubRef.current = undefined;
    };
  }, [visible, countryCode]); 

// ── Pull-to-refresh — re-subscribe (getCities is realtime) ──────────────────
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    unsubRef.current?.();
    const unsub = getCities(countryCode, (docs: CityDoc[]) => {
      if (!isMountedRef.current) return;
      const fallbackToUse = countryCode === 'IN' ? FALLBACK_CITIES : [];
      
      // ✅ Yahan ganda data saaf ho raha hai
      const cleanDocs = docs.map(d => ({
        ...d,
        name: formatCleanName(d.name),
        state: d.state ? formatCleanName(d.state) : undefined,
      }));
      
      setCities(cleanDocs.length > 0 ? cleanDocs : fallbackToUse);
      setIsRefreshing(false);
    });
    unsubRef.current = unsub;
  }, [countryCode]);

// ── Retry ───────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setSheetState('loading');
    setError(null);
    unsubRef.current?.();
    const unsub = getCities(countryCode, (docs: CityDoc[]) => {
      if (!isMountedRef.current) return;
      const fallbackToUse = countryCode === 'IN' ? FALLBACK_CITIES : [];
      
      // ✅ Yahan ganda data saaf ho raha hai
      const cleanDocs = docs.map(d => ({
        ...d,
        name: formatCleanName(d.name),
        state: d.state ? formatCleanName(d.state) : undefined,
      }));
      
      setCities(cleanDocs.length > 0 ? cleanDocs : fallbackToUse);
      setSheetState('idle');
    });
    unsubRef.current = unsub;
  }, [countryCode]);

// ── Filtered + sorted lists ─────────────────────────────────────────────────
  const stateFiltered = useMemo<CityDoc[]>(() => {
    if (stateFilter === 'All') return cities;
    return cities.filter((c) => c.state === stateFilter);
  }, [cities, stateFilter]);
  const sortedStateFiltered = useMemo(
    () => [...stateFiltered].sort((a, b) => a.name.localeCompare(b.name)),
    [stateFiltered],
  );
// Pre-computed normalized "name + state" per city — keeps search off the hot path.
  const normIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cities) {
      // ✅ NAYA UPGRADE: Agar data mein search_keywords hain, toh unko bhi scan karega
      const keywordsStr = c.search_keywords ? c.search_keywords.join(' ') : '';
      m.set(c.id, normalizeDiacritics(`${c.name} ${c.state ?? ''} ${keywordsStr}`));
    }
    return m;
  }, [cities]);
  const displayCities = useMemo<CityDoc[]>(() => {
    const q = searchQuery.trim();
    if (!q) return stateFiltered;

    const normQ = normalizeDiacritics(q);
    const matches = stateFiltered.filter((c) => (normIndex.get(c.id) ?? '').includes(normQ));

    // Relevance ranking: 0 exact name · 1 name-prefix · 2 substring/state.
    const rank = (c: CityDoc): number => {
      const n = normalizeDiacritics(c.name);
      if (n === normQ)           return 0;
      if (n.startsWith(normQ))   return 1;
      return 2;
    };
    return matches.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb)                         return ra - rb;
      if (b.online_count !== a.online_count) return b.online_count - a.online_count;
      return a.name.localeCompare(b.name);
    });
  }, [stateFiltered, searchQuery, normIndex]);

  // Trending = busiest cities (getCities returns name-sorted, so re-sort here).
  const trendingCities = useMemo(
    () => [...cities].sort((a, b) => b.online_count - a.online_count).slice(0, TRENDING_COUNT),
    [cities],
  );
// States derived from data — Punjab/Haryana/etc. appear automatically.
  const stateList = useMemo<StateFilter[]>(() => {
    const set = new Set<string>();
    for (const c of cities) if (c.state) set.add(c.state);
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [cities]);
  const stateCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = { All: cities.length };
    for (const c of cities) if (c.state) counts[c.state] = (counts[c.state] ?? 0) + 1;
    return counts;
  }, [cities]);
  const hasStates = stateList.length > 1;

  // Pills collapse on search OR when there are no states to filter by.
  useEffect(() => {
    const collapse = rawQuery.trim().length > 0 || !hasStates;
    if (collapse) {
      pillsH.value  = withTiming(0,          { duration: 200, easing: REasing.out(REasing.cubic) });
      pillsOp.value = withTiming(0,          { duration: 160, easing: REasing.out(REasing.cubic) });
    } else {
      pillsH.value  = withTiming(L.pillRowH, { duration: 220, easing: REasing.out(REasing.cubic) });
      pillsOp.value = withTiming(1,          { duration: 180, easing: REasing.out(REasing.cubic) });
    }
  }, [rawQuery, hasStates, pillsH, pillsOp]);
  const selectedCity = useMemo(
    () => cities.find((c) => c.id === selected) ?? null,
    [cities, selected],
  );
  const recentCities = useMemo<CityDoc[]>(
    () => recentIds.flatMap((id) => {
      const c = cities.find((c) => c.id === id);
      return c ? [c] : [];
    }),
    [recentIds, cities],
  );
// ── Flat data + A-Z sections ────────────────────────────────────────────────
  const flatData = useMemo<ListItem[]>(() => {
    if (searchQuery.trim()) return buildSearchResults(displayCities);
    return buildAlphaSections(sortedStateFiltered);
  }, [displayCities, searchQuery, sortedStateFiltered]);
  const itemLayouts = useMemo(
    () => (searchQuery.trim() ? null : precomputeLayouts(flatData)),
    [flatData, searchQuery],
  );
  const alphabetLetters = useMemo<string[]>(() => {
    if (searchQuery.trim()) return [];
    return flatData
      .filter((item): item is SectionItem => item.type === 'section')
      .map((item) => item.letter);
  }, [flatData, searchQuery]);
  const sectionIndexMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    flatData.forEach((item, i) => {
      if (item.type === 'section') map.set(item.letter, i);
    });
    return map;
  }, [flatData]);
  const handleAlphabetPress = useCallback((letter: string) => {
    const index = sectionIndexMap.get(letter);
    if (index === undefined) return;
    listRef.current?.scrollToIndex({ index, animated: !reducedMotion, viewOffset: 0 });
  }, [sectionIndexMap, reducedMotion]);
// ── State filter ────────────────────────────────────────────────────────────
  const handleStateFilter = useCallback((s: StateFilter) => {
    void hapticSelect();
    setStateFilter(s);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
// ── Selection (UNCHANGED data behavior — city_id write + recents) ───────────
  const handleSelectCity = useCallback(async (city: CityDoc) => {
    if (isSwitchingRef.current) return;
    if (city.id === selectedRef.current) { onClose(); return; }

    isSwitchingRef.current = true;
    setSwitchingTo(city);
    void hapticMedium();
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      const uid = auth().currentUser?.uid;

      const updated = [
        city.id,
        ...recentIdsRef.current.filter((id) => id !== city.id),
      ].slice(0, MAX_RECENTS);

      // Fire-and-forget — disk/network I/O must NOT block the UI close.
      AsyncStorage.setItem(CW_CITY_KEY, city.id).catch(() => {});
      AsyncStorage.setItem(CW_RECENT_CITIES_KEY, JSON.stringify(updated))
        .then(() => { if (isMountedRef.current) setRecentIds(updated); })
        .catch(() => {});
      if (uid) {
        firestore()
          .collection(USERS_COLLECTION)
          .doc(uid)
          .set({ city_id: city.id }, { merge: true })
          .catch(() => {});
      }

      onSelect(city.id);

      await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 160));
      onClose();
    } finally {
      isSwitchingRef.current = false;
      if (isMountedRef.current) {
        setSheetState('idle');
        setSwitchingTo(null);
      }
    }
  }, [onClose, onSelect, reducedMotion]);
// ── List helpers ────────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: ListItem): string => {
    if (item.type === 'section') return `sec-${item.letter}`;
    if (item.type === 'divider') return item.id;
    return `city-${item.city.id}`;
  }, []);
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    if (item.type === 'divider') return <RowDivider />;
    return (
      <CityRow
        city={item.city}
        isSelected={item.city.id === selectedRef.current}
        onPress={handleSelectCity}
      />
    );
  }, [handleSelectCity]);
  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      if (itemLayouts) {
        return itemLayouts[index] ?? { length: L.rowH, offset: L.rowH * index, index };
      }
      // Search mode: [City, Divider, City, …] — even = City (rowH), odd = Divider (divH).
      const pairSize = L.rowH + L.divH;
      if (index % 2 === 0) {
        return { length: L.rowH, offset: (index / 2) * pairSize, index };
      }
      return { length: L.divH, offset: Math.floor(index / 2) * pairSize + L.rowH, index };
    },
    [itemLayouts],
  );
  const clearSearch = useCallback(() => {
    setRawQuery('');
    searchRef.current?.focus();
  }, []);
// ── Dynamic labels / guards ─────────────────────────────────────────────────
  const placeholder  = cities.length > 0
    ? `Search ${cities.length} cities…`
    : 'Search cities…';
  const showTrending = !searchQuery.trim() && stateFilter === 'All' && trendingCities.length > 0;
  const showAlpha    = alphabetLetters.length > 0 && !searchQuery.trim();
  const showRecents  = recentCities.length > 0 && !searchQuery.trim() && stateFilter === 'All';
  const isStateSearchEmpty =
    searchQuery.trim().length > 0 &&
    displayCities.length === 0 &&
    stateFilter !== 'All';
// ── ListHeaderComponent: Trending + Recents ─────────────────────────────────
  const renderListHeader = useCallback(() => (
    <>
      {showTrending && (
        <View style={sh.trendingSection}>
          <View style={sh.trendingLabelRow}>
            <Feather name="trending-up" size={13} color={T.gold} />
            <Text style={sh.trendingLabel}>TRENDING</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sh.heroScroll}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel="Trending cities"
          >
            {trendingCities.map((c, index) => (
              <HeroCard
                key={c.id}
                city={c}
                isSelected={c.id === selected}
                onPress={handleSelectCity}
                rank={index + 1}
                entryDelay={index * 40}
                reducedMotion={reducedMotion}
              />
            ))}
          </ScrollView>
          <View style={sh.hairline} />
        </View>
      )}
      {showRecents && (
        <RecentlyVisitedSection
          cities={recentCities}
          selected={selected}
          onSelect={handleSelectCity}
        />
      )}
    </>
  ), [showTrending, showRecents, trendingCities, recentCities, selected, handleSelectCity, reducedMotion]);
// ── ListEmptyComponent ──────────────────────────────────────────────────────
  const renderListEmpty = useCallback(() => {
    if (isStateSearchEmpty) {
      return (
        <ReAnimated.View
          entering={!reducedMotion ? FadeIn.duration(200) : undefined}
          style={sh.stateWrap}
        >
          <View style={sh.stateIconCircle}>
            <Feather name="search" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>No Results in {stateFilter}</Text>
          <Text style={sh.stateHint}>
            No cities match "{searchQuery}" in {stateFilter}.
          </Text>
          <Pressable
            onPress={() => { void hapticLight(); setStateFilter('All'); }}
            style={({ pressed }) => [sh.ctaBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`Search all cities for ${searchQuery}`}
          >
            <Feather name="map" size={14} color={T.gold} />
            <Text style={sh.ctaBtnText}>Search All Cities</Text>
          </Pressable>
        </ReAnimated.View>
      );
    }
    return (
      <ReAnimated.View
        entering={!reducedMotion ? FadeIn.duration(200) : undefined}
        style={sh.stateWrap}
      >
        <View style={sh.stateIconCircle}>
          <Feather name="map-pin" size={28} color={T.textTertiary} />
        </View>
        <Text style={sh.stateTitle}>No Cities Found</Text>
        <Text style={sh.stateHint}>
          {searchQuery.trim()
            ? `"${searchQuery}" didn't match any city`
            : 'No cities in this state yet'}
        </Text>
      </ReAnimated.View>
    );
  }, [isStateSearchEmpty, stateFilter, searchQuery, reducedMotion]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — parity with CountryPickerSheet
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight={SHEET_HEIGHT}
      style={sh.sheetShell}
    >
      <View style={sh.outerWrapper}>

      {/* ── PINNED SHELL — never scrolls ──────────────────────────────────────── */}
      <View style={sh.pinnedShell}>

        {/* ── MERGED TITLE ROW ────────────────────────────────────────────────── */}
        <View style={sh.titleRowMerged}>
          {/* Left: map-pin icon (Country uses a globe) */}
          <View style={sh.headerIconWrap}>
            <Feather name="map-pin" size={22} color={T.gold} />
          </View>

          {/* Center: title + active-city strip inline */}
          <View style={sh.titleTextGroup}>
            <Text style={sh.title}>Choose City</Text>

            {selectedCity != null && sheetState !== 'loading' && (
              <View
                style={sh.activeInline}
                accessibilityRole="text"
                accessibilityLabel={`Active city: ${selectedCity.name}`}
              >
                <LiveDot size={5} pulse />
                <Feather name="map-pin" size={11} color={T.gold} style={sh.activePin} />
                <Text style={sh.activeName} numberOfLines={1}>
                  {selectedCity.name}
                </Text>
                <Text style={sh.activeSep} accessible={false}>{'\u00B7'}</Text>
                <Text style={sh.activeCountInline} numberOfLines={1}>
                  {selectedCity.online_count > 0
                    ? `${fmtCount(selectedCity.online_count)} online`
                    : '0 online'}
                </Text>
                <View style={sh.activeBadge}>
                  <Text style={sh.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
            )}
          </View>

          {/* Right: close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [sh.closeBtn, pressed && sh.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Close city picker"
            hitSlop={{ top:4, bottom:4, left:4, right:4 }}
          >
            <Feather name="x" size={20} color={T.textSecondary} />
          </Pressable>
        </View>

        {/* ── SEARCH BAR — Reanimated border glow (UI thread) ─────────────────── */}
        <ReAnimated.View style={[sh.searchWrap, animatedBorderStyle]}>
          <Feather name="search" size={18} color={T.textTertiary} />
          <TextInput
            ref={searchRef}
            style={sh.searchInput}
            value={rawQuery}
            onChangeText={setRawQuery}
            placeholder={placeholder}
            placeholderTextColor={T.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            underlineColorAndroid="transparent"
            spellCheck={false}
            autoComplete="off"
            textContentType="none"
            maxLength={40}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            accessibilityLabel="Search for a city"
            accessibilityHint="Type a city or state name"
          />
          {rawQuery.length > 0 && (
            <Pressable
              onPress={clearSearch}
              hitSlop={{ top:8, bottom:8, left:8, right:8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x-circle" size={18} color={T.textTertiary} />
            </Pressable>
          )}
        </ReAnimated.View>

        {/* ── STATE/DISTRICT PILLS ROW — Reanimated height + opacity ──────────── */}
        <ReAnimated.View style={[sh.pillAnimWrap, animatedPillsStyle]}>
          {hasStates && sheetState !== 'loading' && error == null && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sh.pillScroll}
              keyboardShouldPersistTaps="always"
              accessibilityRole="tablist"
              accessibilityLabel="Filter cities by state"
            >
              {stateList.map((s) => (
                <StatePill
                  key={s}
                  label={s}
                  active={stateFilter === s}
                  count={cities.length > 0 ? (stateCounts[s] ?? 0) : undefined}
                  onPress={handleStateFilter}
                />
              ))}
            </ScrollView>
          )}
        </ReAnimated.View>

        <View style={sh.hairline} />
        </View>

      {/* ── CONTENT ZONE ──────────────────────────────────────────────────────── */}

      {sheetState === 'loading' ? (

        <View style={sh.contentArea}>
          <View style={sh.trendingSection}>
            <View style={sh.trendingLabelRow}>
              <Feather name="trending-up" size={13} color={T.gold} />
              <Text style={sh.trendingLabel}>TRENDING</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sh.heroScroll}
              scrollEnabled={false}
            >
              {Array.from({ length: TRENDING_COUNT }, (_, i) => (
                <SkeletonHeroCard key={i} shimmer={shimmerAnim} />
              ))}
            </ScrollView>
            <View style={sh.hairline} />
          </View>
          {recentIds.length > 0 && (
            <View>
              <View style={rv.headerRow}>
                <Feather name="clock" size={12} color={T.gold} />
                <Text style={rv.label}>RECENTLY VISITED</Text>
              </View>
              {recentIds.map((id) => (
                <SkeletonRow key={id} shimmer={shimmerAnim} />
              ))}
              <View style={rv.sectionDivider} />
            </View>
          )}
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading cities"
            accessible
          >
            {Array.from({ length: L.shimmerRows }, (_, i) => (
              <SkeletonRow key={i} shimmer={shimmerAnim} />
            ))}
          </View>
        </View>

      ) : error != null ? (

        <View style={sh.stateWrap}>
          <View style={sh.stateIconCircle}>
            <Feather name="wifi-off" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>Failed to Load</Text>
          <Text style={sh.stateHint}>{error}</Text>
          <Pressable
            onPress={handleRetry}
            style={({ pressed }) => [sh.retryBtn, pressed && sh.retryBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading cities"
          >
            <Feather name="refresh-cw" size={14} color={T.sheetBg} />
            <Text style={sh.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>

      ) : (

        <View
          style={sh.listWrap}
          accessibilityRole="radiogroup"
          accessibilityLabel="City list"
        >
          {searchQuery.trim().length > 0 && (
            <View
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${displayCities.length} ${displayCities.length === 1 ? 'city' : 'cities'} found`}
              style={sh.srOnly}
            />
          )}
          <FlatList
            ref={listRef}
            data={flatData}
            extraData={selected}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderListEmpty}
            showsVerticalScrollIndicator={false}
            style={sh.flatList}
            contentContainerStyle={[
              sh.listContent,
              showAlpha && { paddingRight: L.alphaBarW + 6 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            windowSize={8}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={(info) => {
              const offset = itemLayouts?.[info.index]?.offset
                ?? L.rowH * info.index;
              listRef.current?.scrollToOffset({ offset, animated: false });
            }}
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={T.gold}
                colors={[T.gold]}
              />
            }
          />

          {showAlpha && (
            <AlphaSidebarAndOverlay
              letters={alphabetLetters}
              onPress={handleAlphabetPress}
              reducedMotion={reducedMotion}
            />
          )}
        </View>

      )}

      {/* ── SWITCHING OVERLAY — FadeIn 150ms (monogram instead of flag) ───────── */}
      {sheetState === 'switching' && (
        <ReAnimated.View
          entering={!reducedMotion ? FadeIn.duration(150) : undefined}
          style={sh.switchOverlay}
          pointerEvents="auto"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={
            switchingTo != null
              ? `Switching to ${switchingTo.name}`
              : 'Switching city'
          }
        >
          <View style={sh.switchSpinnerWrap}>
            <ActivityIndicator
              size={60}
              color={T.gold}
              style={sh.switchActivityRing}
            />
            <View style={sh.switchSpinner}>
              <Text style={sh.switchMono}>
                {cityInitial(switchingTo?.name ?? selectedCity?.name ?? '\u2022')}
              </Text>
            </View>
          </View>
        </ReAnimated.View>
      )}

      </View>{/* close outerWrapper */}
    </BottomSheet>
  );
}

// Wrap in PulseProvider so each mounted sheet gets its own isolated pulse value.
export const CityPickerSheet = memo((props: CityPickerSheetProps) => (
  <PulseProvider>
    <CityPickerSheetBase {...props} />
  </PulseProvider>
));
CityPickerSheet.displayName = 'CityPickerSheet';

export default CityPickerSheet;

// ─── Styles ────────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({

  sheetShell: {
    height:          SHEET_HEIGHT,
    backgroundColor: T.sheetBg,
  },

  outerWrapper: {
    flex: 1,
  },

  pinnedShell: {
    backgroundColor: T.sheetBg,
    paddingBottom:   6,
  },

  titleRowMerged: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    paddingVertical:   12,
    gap:               12,
  },
  headerIconWrap: {
    width:           44,
    height:          44,
    borderRadius:    13,
    backgroundColor: T.goldSubtle,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  titleTextGroup: {
    flex: 1,
    gap:  3,
  },
  title: {
    fontSize:      17,
    fontWeight:    '700',
    color:         T.text,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: -0.3,
  },

  activeInline: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    flexWrap:      'nowrap',
  },
  activePin: { marginRight: -1 },
  activeName: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.gold,
    fontFamily: FONT_HEADING.semiBold,
    flexShrink: 1,
    maxWidth:   120,
  },
  activeSep:   { color:T.textMuted, fontSize:13 },
  activeCountInline: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor:   T.gold,
    borderRadius:      5,
    paddingHorizontal: 5,
    paddingVertical:   2,
    flexShrink:        0,
  },
  activeBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    color:         T.sheetBg,
    letterSpacing: 0.7,
    fontFamily:    FONT_BODY.bold,
  },

  closeBtn: {
    width:           L.closeBtn,
    height:          L.closeBtn,
    borderRadius:    L.closeBtn / 2,
    backgroundColor: T.surfaceWell,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  closeBtnPressed: { opacity:0.60 },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  L.rowPadH,
    marginVertical:    8,
    height:            L.searchH,
    backgroundColor:   T.surfaceSunken,
    borderRadius:      L.searchH / 2,
    paddingHorizontal: 14,
    borderWidth:       1.5,
    gap:               8,
  },
  searchInput: {
    flex:            1,
    fontSize:        14,
    color:           T.text,
    fontFamily:      FONT_BODY.regular,
    paddingVertical: 0,
    outlineStyle:    'none',
  },

  pillAnimWrap: {
    // height controlled by Reanimated shared value
  },
  pillScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   9,
    gap:               10,
    flexDirection:     'row',
  },

  hairline: {
    height:          1,
    marginTop:       8,
    backgroundColor: T.borderSubtle,
  },

  contentArea: { flex:1 },
  listWrap:    { flex:1, position:'relative' },
  flatList:    { flex:1 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 32 : 28 },

  trendingSection:  { paddingBottom:12 },
  trendingLabelRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        12,
    marginBottom:     12,
  },
  trendingLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
    textTransform: 'uppercase',
    flex:          1,
  },
  heroScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   10,
    gap:               12,
  },

  stateWrap: {
    alignItems:        'center',
    paddingTop:        44,
    paddingBottom:     36,
    paddingHorizontal: 32,
    gap:               12,
    flex:              1,
  },
  stateIconCircle: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: T.surfaceWell,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  stateTitle: {
    fontSize:   17,
    fontWeight: '700',
    color:      T.text,
    fontFamily: FONT_HEADING.semiBold,
    textAlign:  'center',
  },
  stateHint: {
    fontSize:   13,
    color:      T.textSecondary,
    fontFamily: FONT_BODY.regular,
    textAlign:  'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginTop:         4,
    paddingVertical:   13,
    paddingHorizontal: 28,
    backgroundColor:   T.gold,
    borderRadius:      16,
    shadowColor:       T.gold,
    shadowOpacity:     0.35,
    shadowRadius:      14,
    shadowOffset:      { width:0, height:5 },
    elevation:         5,
  },
  retryBtnPressed: { opacity:0.80 },
  retryBtnText: {
    fontSize:      14,
    fontWeight:    '700',
    color:         T.sheetBg,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: 0.2,
  },

  ctaBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginTop:         4,
    paddingVertical:   11,
    paddingHorizontal: 22,
    borderRadius:      14,
    borderWidth:       1.5,
    borderColor:       T.gold,
    backgroundColor:   T.goldSubtle,
  },
  ctaBtnText: {
    fontSize:      13,
    fontWeight:    '700',
    color:         T.gold,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: 0.1,
  },

  switchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:      DV.switchOverlay,
    alignItems:           'center',
    justifyContent:       'center',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    zIndex:               99,
  },
  switchSpinner: {
    position:        'absolute',
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: T.sheetBg,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     T.text,
    shadowOpacity:   0.12,
    shadowRadius:    20,
    shadowOffset:    { width:0, height:8 },
    elevation:       10,
  },
  switchSpinnerWrap: {
    width:           80,
    height:          80,
    alignItems:      'center',
    justifyContent:  'center',
  },
  switchActivityRing: {
    position: 'absolute',
    width:    80,
    height:   80,
  },
  switchMono: {
    fontSize:   26,
    fontWeight: '800',
    color:      T.gold,
    fontFamily: FONT_HEADING.bold,
    includeFontPadding: false,
  },

  srOnly: { width: 0, height: 0, overflow: 'hidden' },
});

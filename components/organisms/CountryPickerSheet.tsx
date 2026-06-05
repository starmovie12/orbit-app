/**
 * components/organisms/CountryPickerSheet.tsx — v4.1 (True Nested Scrolling Update)
 *
 * CROWN — Country Selection Bottom Sheet
 * "The gateway to the world. Clean. Fast. Global."
 *
 * ── v4.1 CHANGELOG (True Gorhom Integration) ─────────────────────────────────
 *
 * [v4.1-UPDATE] Removed the local PanResponder/Modal custom implementation.
 * Now exclusively using the actual @gorhom/bottom-sheet v5 library.
 * This enables true nested scrolling (Gesture Arbitration).
 * - Sheet naturally expands 55% -> 92% on upward scroll.
 * - List naturally scrolls once sheet is at max snap point.
 * - Downward scroll seamlessly transitions from list-scroll to sheet-collapse.
 *
 * [v4.1-UPDATE] Replaced standard TextInput with BottomSheetTextInput to ensure
 * gesture handlers don't conflict with text selection/input.
 *
 * [v4.1-CLEANUP] Removed hacky manual onScroll, dragBy, and setHeight handlers
 * as the native Reanimated worklets in Gorhom handle this perfectly.
 *
 * ── PRESERVED FROM v3.3 & v4.0 (zero changes) ────────────────────────────────
 *
 * Data layer: fetchCountries, buildAlphaSections, buildSearchResults, etc.
 * Animations: Search glow, pill collapse, stagger hero cards, letter overlay.
 * Components: SkeletonRows, HeroCard, PulseContext, etc.
 *
 * ── PREREQUISITES ─────────────────────────────────────────────────────────────
 * npm install @gorhom/bottom-sheet@^5.x
 * react-native-reanimated v3  — Reanimated plugin in babel.config.js required
 * react-native-gesture-handler v2 — GestureHandlerRootView at app root
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
  Easing,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  PanResponder,
  type GestureResponderEvent,
} from 'react-native';
import { Feather }       from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';

// ── @gorhom/bottom-sheet (ACTUAL LIBRARY) ─────────────────────────────────────
import BottomSheet, {
  BottomSheetView,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

// ── react-native-reanimated v3 ────────────────────────────────────────────────
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';

import { db }                    from '@/lib/firebase';
import { palette }               from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// ─── Storage keys ──────────────────────────────────────────────────────────────
const CW_COUNTRY_KEY  = '@cw/country_id'           as const;
const CW_RECENTS_KEY  = '@cw/recent_countries_v3'  as const;
const MAX_RECENTS     = 3                           as const;
const TRENDING_COUNT  = 5                           as const;
const MAX_RETRIES     = 3                           as const;

// ─── Country cache (AsyncStorage) ─────────────────────────────────────────────
const COUNTRIES_CACHE_KEY = '@cw/countries_v2'     as const;
const COUNTRIES_CACHE_TTL = 6 * 60 * 60 * 1000    as const;

// ─── Layout constants ──────────────────────────────────────────────────────────
const L = {
  rowH:         68,
  sectionH:     34,
  divH:          1,
  rowPadH:      16,
  flagBox:      44,
  flagRadius:   12,
  flagEmoji:    26,
  heroW:       142,
  heroH:        98,
  heroR:        18,
  heatW:        48,
  heatH:         4,
  heatR:         2,
  searchH:      48,
  handleW:      40,
  handleH:       4,
  closeBtn:     44,
  shimmerRows:   7,
  shimmerDur:  1200,
  pillH:        32,
  pillRowH:     50,
  alphaItemH:   18,
  alphaBarW:    22,
} as const;

// ─── Design token aliases ──────────────────────────────────────────────────────
const T = {
  sheetBg:       palette.cream[50],
  text:          palette.ink[950],
  textSecondary: palette.ink[600],
  textTertiary:  palette.ink[400],
  textMuted:     palette.ink[200],
  surfaceSunken: palette.cream[100],
  surfaceWell:   palette.cream[200],
  border:        palette.cream[300],
  borderSubtle:  palette.cream[200],
  gold:          palette.gold[600],
  goldLight:     palette.gold[300],
  goldDim:       palette.gold[200],
  goldSubtle:    palette.gold[100],
  green:         palette.emerald[500],
  emerald:       palette.emerald[600],
  amber:         palette.amber[600],
} as const;

// ─── Derived overlay values ────────────────────────────────────────────────────
const DV = {
  activeRowBg:    'rgba(212,160,23,0.09)' as const,
  activeRowBorder:'rgba(212,160,23,0.24)' as const,
  sectionBg:      'rgba(250,250,250,0.97)'as const,
  switchOverlay:  'rgba(250,250,250,0.93)'as const,
  regionBlue:     'rgba(59,130,246,1)'   as const,
  regionPurple:   'rgba(139,92,246,1)'   as const,
  regionRed:      'rgba(220,38,38,1)'    as const,
} as const;

// ─── Haptic helpers ────────────────────────────────────────────────────────────
const hapticLight  = (): Promise<void> => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hapticMedium = (): Promise<void> => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hapticSelect = (): Promise<void> => Haptics.selectionAsync();

// ─── Types ─────────────────────────────────────────────────────────────────────
type Region = 'Asia' | 'Americas' | 'Africa' | 'Europe' | 'Oceania' | 'Middle East';
type RegionFilter = 'All' | Region;

type SectionItem  = { type: 'section'; letter: string };
type CountryItem  = { type: 'country'; country: CountryDoc };
type DividerItem  = { type: 'divider'; id: string };
type ListItem     = SectionItem | CountryItem | DividerItem;

export interface CountryDoc {
  id:          string;
  name:        string;
  emoji:       string;
  onlineCount: number;
  heat:        number;
  region:      Region;
  dialCode?:   string;
}

export interface FSCountry {
  name?:         string;
  flag?:         string;
  iso2?:         string;
  continent?:    string;
  online_count?: number;
  is_active?:    boolean;
  capital?:      string;
  dial_code?:    string;
}

interface CountryCacheEntry {
  data:      CountryDoc[];
  fetchedAt: number;
  expiresAt: number;
}

export interface CountryPickerSheetProps {
  visible:  boolean;
  onClose:  () => void;
  selected: string;
  onSelect: (countryId: string, name: string, emoji: string) => void;
}

// ─── Region color system ───────────────────────────────────────────────────────
const MIDDLE_EAST_ISO = new Set<string>([
  'AE','BH','IQ','IR','IL','JO','KW','LB','OM','PS','QA','SA','SY','YE',
]);

const REGION_FLAG_BG: Record<Region, string> = {
  'Asia':        'rgba(212,160,23,0.14)',
  'Americas':    'rgba(16,185,129,0.13)',
  'Africa':      'rgba(212,101,26,0.14)',
  'Europe':      'rgba(59,130,246,0.12)',
  'Oceania':     'rgba(139,92,246,0.12)',
  'Middle East': 'rgba(220,38,38,0.11)',
};

const REGION_ACCENT: Record<Region, string> = {
  'Asia':        T.gold,
  'Americas':    T.emerald,
  'Africa':      T.amber,
  'Europe':      DV.regionBlue,
  'Oceania':     DV.regionPurple,
  'Middle East': DV.regionRed,
};

const REGION_FILTERS: RegionFilter[] = [
  'All','Asia','Europe','Americas','Africa','Oceania','Middle East',
];

// ─── Utilities ─────────────────────────────────────────────────────────────────
function normalizeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function mapToRegion(continent: string, iso2: string): Region {
  if (MIDDLE_EAST_ISO.has(iso2)) return 'Middle East';
  switch (continent?.trim()) {
    case 'Africa':              return 'Africa';
    case 'Europe':              return 'Europe';
    case 'Oceania':
    case 'Australia/Oceania':
    case 'Australia & Oceania': return 'Oceania';
    case 'Asia':                return 'Asia';
    case 'North America':
    case 'South America':
    case 'Central America':
    case 'Americas':            return 'Americas';
    default:
      return 'Asia';
  }
}

function computeHeat(n: number): number {
  if (n <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(n + 1) / 5) * 100));
}

function heatColour(heat: number): string {
  if (heat >= 75) return T.emerald;
  if (heat >= 50) return T.gold;
  if (heat >= 25) return T.amber;
  return T.border;
}

function fmtCount(n: number): string {
  if (n <= 0) return '0';
  if (n >= 10_000_000) {
    const v = n / 10_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}Cr`;
  }
  if (n >= 100_000) {
    const v = n / 100_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}L`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('en-IN');
}

function mapFSDoc(docId: string, data: Partial<FSCountry>): CountryDoc {
  const iso2 = ((data.iso2 ?? docId) as string).toUpperCase();
  const onlineCount = Number(data.online_count ?? 0);
  return {
    id:          iso2,
    name:        data.name ?? iso2,
    emoji:       data.flag ?? '🌐',
    onlineCount,
    heat:        computeHeat(onlineCount),
    region:      mapToRegion(data.continent ?? '', iso2),
    dialCode:    data.dial_code,
  };
}

async function migrateRecentsCache(): Promise<void> {
  try {
    const v2 = await AsyncStorage.getItem('@cw/recent_countries_v2');
    if (!v2) return;
    const alreadyMigrated = await AsyncStorage.getItem(CW_RECENTS_KEY);
    if (alreadyMigrated) {
      await AsyncStorage.removeItem('@cw/recent_countries_v2');
      return;
    }
    await AsyncStorage.setItem(CW_RECENTS_KEY, v2);
    await AsyncStorage.removeItem('@cw/recent_countries_v2');
  } catch { /* non-critical */ }
}

async function fetchCountries(bypassCache = false): Promise<[CountryDoc[], number]> {
  if (!bypassCache) {
    try {
      const raw = await AsyncStorage.getItem(COUNTRIES_CACHE_KEY);
      if (raw) {
        const entry = JSON.parse(raw) as CountryCacheEntry;
        if (Date.now() < entry.expiresAt) {
          return [entry.data, entry.fetchedAt];
        }
      }
    } catch { /* cache miss — fall through */ }
  }

  const snap = await getDocs(
    query(collection(db, 'countries'), where('is_active', '==', true)),
  );
  const docs = snap.docs.map((d) => mapFSDoc(d.id, d.data() as Partial<FSCountry>));
  docs.sort((a, b) =>
    b.onlineCount !== a.onlineCount
      ? b.onlineCount - a.onlineCount
      : a.name.localeCompare(b.name),
  );

  const fetchedAt = Date.now();
  const jitterMs  = (Math.random() - 0.5) * 60 * 60 * 1000;
  const expiresAt = fetchedAt + COUNTRIES_CACHE_TTL + jitterMs;
  AsyncStorage.setItem(
    COUNTRIES_CACHE_KEY,
    JSON.stringify({ data: docs, fetchedAt, expiresAt } as CountryCacheEntry),
  ).catch(() => {});

  return [docs, fetchedAt];
}

function buildAlphaSections(sorted: CountryDoc[]): ListItem[] {
  const items: ListItem[] = [];
  let prevLetter     = '';
  let prevWasSection = true;

  for (const country of sorted) {
    const letter = country.name[0]?.toUpperCase() ?? '#';
    if (letter !== prevLetter) {
      items.push({ type: 'section', letter });
      prevLetter     = letter;
      prevWasSection = true;
    } else if (!prevWasSection) {
      items.push({ type: 'divider', id: `div-${country.id}` });
    }
    items.push({ type: 'country', country });
    prevWasSection = false;
  }
  return items;
}

function buildSearchResults(countries: CountryDoc[]): ListItem[] {
  return countries.flatMap((c, i) =>
    i === 0
      ? [{ type: 'country', country: c } as CountryItem]
      : [{ type: 'divider', id: `sdiv-${c.id}` } as DividerItem, { type: 'country', country: c } as CountryItem],
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

// ─── PulseContext ──────────────────────────────────────────────────────────────
interface _PulseCtx {
  anim:     Animated.Value;
  register: () => () => void;
}

const PulseContext = React.createContext<_PulseCtx | null>(null);

const PulseProvider = memo<{ children: React.ReactNode }>(({ children }) => {
  const anim    = useRef(new Animated.Value(1)).current;
  const refs    = useRef(0);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const register = useCallback((): (() => void) => {
    refs.current++;
    if (loopRef.current === null) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.2, duration: 850, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1.0, duration: 850, useNativeDriver: true }),
        ]),
      );
      loopRef.current.start();
    }
    return () => {
      refs.current = Math.max(0, refs.current - 1);
      if (refs.current === 0 && loopRef.current !== null) {
        loopRef.current.stop();
        loopRef.current = null;
        anim.setValue(1);
      }
    };
  }, [anim]);

  const ctx = useMemo(() => ({ anim, register }), [anim, register]);

  return <PulseContext.Provider value={ctx}>{children}</PulseContext.Provider>;
});

function usePulse(enabled: boolean): Animated.Value {
  const ctx = React.useContext(PulseContext);
  const fallbackAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.register();
  }, [enabled, ctx]);

  return ctx?.anim ?? fallbackAnim;
}

// ─── Components ────────────────────────────────────────────────────────────────
const LiveDot = memo<{ size?: number; gold?: boolean; pulse?: boolean }>(
  ({ size = 7, gold = false, pulse = false }) => {
    const anim = usePulse(pulse);
    return (
      <Animated.View
        style={{
          width:           size,
          height:          size,
          borderRadius:    size / 2,
          backgroundColor: gold ? T.gold : T.green,
          opacity:         pulse ? anim : 1,
        }}
        accessible={false}
      />
    );
  },
);

const SkeletonRow = memo<{ shimmer: Animated.Value }>(({ shimmer }) => {
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  return (
    <View style={sk.row}>
      <Animated.View style={[sk.flag, { opacity }]} />
      <View style={sk.body}>
        <Animated.View style={[sk.line1, { opacity }]} />
        <Animated.View style={[sk.line2, { opacity }]} />
      </View>
      <Animated.View style={[sk.heat, { opacity }]} />
    </View>
  );
});

const sk = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', paddingHorizontal:L.rowPadH, height:L.rowH, gap:12 },
  flag:  { width:L.flagBox, height:L.flagBox, borderRadius:L.flagRadius, backgroundColor:T.surfaceWell },
  body:  { flex:1, gap:8 },
  line1: { height:14, borderRadius:7, backgroundColor:T.surfaceWell, width:'60%' as const },
  line2: { height:11, borderRadius:6, backgroundColor:T.surfaceWell, width:'38%' as const },
  heat:  { width:L.heatW, height:8, borderRadius:4, backgroundColor:T.surfaceWell },
});

const SkeletonHeroCard = memo<{ shimmer: Animated.Value }>(({ shimmer }) => {
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] });
  return (
    <Animated.View style={[skh.card, { opacity }]}>
      <Animated.View style={[skh.flag,  { opacity }]} />
      <Animated.View style={[skh.line1, { opacity }]} />
      <Animated.View style={[skh.line2, { opacity }]} />
      <View style={skh.heatTrackWrap}>
        <Animated.View style={[skh.heatBar, { opacity }]} />
      </View>
    </Animated.View>
  );
});

const skh = StyleSheet.create({
  card: {
    width:           L.heroW,
    height:          L.heroH,
    borderRadius:    L.heroR,
    borderWidth:     1.5,
    borderColor:     T.border,
    backgroundColor: T.surfaceWell,
    padding:         12,
    gap:             6,
  },
  flag:         { width:28, height:28, borderRadius:8, backgroundColor:T.surfaceSunken },
  line1:        { height:14, borderRadius:7, width:'70%' as const, backgroundColor:T.surfaceSunken },
  line2:        { height:10, borderRadius:5, width:'45%' as const, backgroundColor:T.surfaceSunken },
  heatTrackWrap:{ flex:1, justifyContent:'flex-end' },
  heatBar:      { height:L.heatH, borderRadius:L.heatR, backgroundColor:T.surfaceSunken },
});

const SectionHeader = memo<{ letter: string }>(({ letter }) => (
  <View style={sec.wrap} accessibilityRole="header">
    <Text style={sec.letter} accessibilityLabel={`Countries starting with ${letter}`}>
      {letter}
    </Text>
  </View>
));

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

interface HeroCardProps {
  country:       CountryDoc;
  isSelected:    boolean;
  onPress:       (country: CountryDoc) => void;
  entryDelay?:   number;
  reducedMotion?: boolean;
}

const HeroCard = memo<HeroCardProps>(({ country, isSelected, onPress, entryDelay = 0, reducedMotion = false }) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const accent = REGION_ACCENT[country.region] as string;
  const filled = Math.max(0, Math.min(1, country.heat / 100));

  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() => Animated.spring(scale, { toValue:0.94, useNativeDriver:true, speed:50, bounciness:0 }).start(), [scale]);
  const onPressOut  = useCallback(() => Animated.spring(scale, { toValue:1.00, useNativeDriver:true, speed:40, bounciness:5 }).start(), [scale]);

  const entering = useMemo(
    () => reducedMotion ? undefined : SlideInRight.delay(entryDelay).duration(300).springify().damping(18),
    [entryDelay, reducedMotion],
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${country.name}, ${fmtCount(country.onlineCount)} online`}
      accessibilityState={{ selected: isSelected }}
    >
      <ReAnimated.View style={[hc.card, isSelected && { borderColor: accent, ...hc.cardActive }, { transform: [{ scale }] }]} entering={entering}>
        <Text style={hc.flag} accessible={false}>{country.emoji}</Text>
        <Text style={[hc.name, isSelected && { color: accent }]} numberOfLines={1}>{country.name}</Text>
        <View style={hc.countRow}>
          <LiveDot size={5} gold={isSelected} pulse={false} />
          <Text style={[hc.count, isSelected && { color: accent }]}>{country.onlineCount > 0 ? fmtCount(country.onlineCount) : '—'}</Text>
        </View>
        <View style={hc.heatTrackWrap}>
          <View style={hc.heatTrack}>
            <View style={[hc.heatFill, { width: `${(filled * 100).toFixed(0)}%` as `${number}%`, backgroundColor: isSelected ? accent : heatColour(country.heat) }]} />
          </View>
        </View>
        {isSelected && (
          <View style={[hc.checkDot, { backgroundColor: accent }]}>
            <Feather name="check" size={9} color={T.sheetBg} />
          </View>
        )}
      </ReAnimated.View>
    </Pressable>
  );
});

const hc = StyleSheet.create({
  card: { width: L.heroW, height: L.heroH, borderRadius: L.heroR, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.sheetBg, padding: 12, gap: 3, shadowColor: T.text, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width:0, height:3 }, elevation: 2, overflow: 'hidden' },
  cardActive: { shadowOpacity:0.14, shadowRadius:18, elevation:5 },
  flag: { fontSize:L.flagEmoji },
  name: { fontSize: 13, fontWeight: '700', color: T.text, fontFamily: FONT_HEADING.semiBold, flexShrink: 1 },
  countRow: { flexDirection:'row', alignItems:'center', gap:4 },
  count: { fontSize: 10, fontWeight: '600', color: T.textSecondary, fontFamily: FONT_BODY.semiBold },
  heatTrackWrap: { flex:1, justifyContent:'flex-end' },
  heatTrack: { width: '100%', height: L.heatH, borderRadius: L.heatR, backgroundColor: T.border, overflow: 'hidden' },
  heatFill: { height:'100%', borderRadius:L.heatR },
  checkDot: { position:'absolute', top:8, right:8, width:18, height:18, borderRadius:9, alignItems:'center', justifyContent:'center' },
});

interface CountryRowProps {
  country:    CountryDoc;
  isSelected: boolean;
  onPress:    (country: CountryDoc) => void;
}

const CountryRow = memo<CountryRowProps>(({ country, isSelected, onPress }) => {
  const scale     = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const regionBg  = REGION_FLAG_BG[country.region];
  const heatFill  = Math.max(0, Math.min(1, country.heat / 100));
  const accent    = REGION_ACCENT[country.region] as string;

  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 40, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 40, useNativeDriver: false }),
    ]).start();
  }, [scale, flashAnim]);
  const onPressOut  = useCallback(() => Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 55, bounciness: 4 }).start(), [scale]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${country.name} (${country.id}), ${country.onlineCount > 0 ? fmtCount(country.onlineCount) + ' online' : 'no one online'}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View style={[cr.row, isSelected && cr.rowActive, { transform: [{ scale }] }]}>
        <View style={[cr.flagBox, { backgroundColor: regionBg }]}>
          <Text style={cr.flagEmoji} accessible={false}>{country.emoji}</Text>
        </View>
        <View style={cr.body}>
          <View style={cr.nameRow}>
            <Text style={[cr.name, isSelected && cr.nameActive]} numberOfLines={1}>{country.name}</Text>
            <Text style={[cr.iso, isSelected && { color: T.goldLight }]} accessible={false}>{country.id}</Text>
          </View>
          <View style={cr.meta}>
            {country.onlineCount > 0 ? <LiveDot size={5} gold={isSelected} pulse={false} /> : <View style={[cr.dotStatic, { backgroundColor: T.border }]} />}
            <Text style={[cr.count, isSelected && cr.countActive]}>{country.onlineCount > 0 ? `${fmtCount(country.onlineCount)} online` : 'No one online'}</Text>
          </View>
        </View>
        <View style={cr.heatCol}>
          <View style={cr.heatTrack}>
            <View style={[cr.heatFill, { width: `${(heatFill * 100).toFixed(0)}%` as `${number}%`, backgroundColor: isSelected ? accent : heatColour(country.heat) }]} />
          </View>
          <Text style={[cr.heatNum, isSelected && { color: accent }]}>{country.heat}</Text>
        </View>
        {isSelected ? (
          <View style={[cr.checkCircle, { backgroundColor: accent }]}><Feather name="check" size={12} color={T.sheetBg} /></View>
        ) : (
          <Feather name="chevron-right" size={16} color={T.textTertiary} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: DV.activeRowBg, opacity: flashAnim }]} pointerEvents="none" />
      </Animated.View>
    </Pressable>
  );
});

const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: L.rowPadH, height: L.rowH, gap: 12, backgroundColor: T.sheetBg },
  rowActive: { backgroundColor: DV.activeRowBg },
  flagBox: { width: L.flagBox, height: L.flagBox, borderRadius: L.flagRadius, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flagEmoji: { fontSize: L.flagEmoji },
  body: { flex:1, gap:4 },
  nameRow: { flexDirection:'row', alignItems:'center', gap:6 },
  name: { fontSize: 15, fontWeight: '600', color: T.text, fontFamily: FONT_HEADING.medium, flexShrink: 1 },
  nameActive: { color:T.gold, fontWeight:'700' },
  iso: { fontSize: 10, fontWeight: '600', color: T.textTertiary, fontFamily: FONT_BODY.semiBold, letterSpacing: 0.5, flexShrink: 0 },
  meta: { flexDirection:'row', alignItems:'center', gap:4 },
  dotStatic: { width:5, height:5, borderRadius:2.5 },
  count: { fontSize: 11, fontWeight: '500', color: T.textSecondary, fontFamily: FONT_BODY.medium },
  countActive: { color: T.gold },
  heatCol: { alignItems:'flex-end', gap:3, width:56, flexShrink:0 },
  heatTrack: { width: L.heatW, height: L.heatH, borderRadius: L.heatR, backgroundColor: T.border, overflow: 'hidden' },
  heatFill: { height:'100%', borderRadius:L.heatR },
  heatNum: { fontSize: 10, fontWeight: '600', color: T.textTertiary, fontFamily: FONT_BODY.semiBold },
  checkCircle: { width:26, height:26, borderRadius:13, alignItems:'center', justifyContent:'center', flexShrink:0 },
});

const RowDivider = memo(() => (
  <View style={{ height:L.divH, backgroundColor:T.borderSubtle, marginHorizontal:L.rowPadH }} accessible={false} importantForAccessibility="no-hide-descendants" />
));

interface RegionPillProps {
  label:   RegionFilter;
  active:  boolean;
  count?:  number;
  onPress: (filter: RegionFilter) => void;
}

const RegionPill = memo<RegionPillProps>(({ label, active, count, onPress }) => {
  const handlePress = useCallback(() => onPress(label), [onPress, label]);
  const displayText = count !== undefined ? `${label} · ${count}` : label;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityLabel={count !== undefined ? `${label}, ${count} countries` : `Filter by ${label}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [rp.pill, active && rp.pillActive, pressed && { opacity:0.72 }]}
    >
      <Text style={[rp.text, active && rp.textActive]}>{displayText}</Text>
    </Pressable>
  );
});

const rp = StyleSheet.create({
  pill: { height: L.pillH, paddingHorizontal: 14, borderRadius: L.pillH / 2, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', backgroundColor: T.sheetBg },
  pillActive: { borderColor:T.gold, backgroundColor:T.goldSubtle },
  text: { fontSize:12, fontWeight:'600', color:T.textSecondary, fontFamily:FONT_BODY.semiBold },
  textActive: { color: T.gold },
});

interface AlphabetSidebarProps {
  letters:        string[];
  onPress:        (letter: string) => void;
  onLetterChange: (letter: string | null) => void;
}

const AlphabetSidebar = memo<AlphabetSidebarProps>(({ letters, onPress, onLetterChange }) => {
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
      accessibilityActions={[{ name: 'increment', label: 'Next letter' }, { name: 'decrement', label: 'Previous letter' }]}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        const ls = lettersRef.current;
        if (ls.length === 0) return;
        const cur  = lastIdxRef.current < 0 ? 0 : lastIdxRef.current;
        const next = event.nativeEvent.actionName === 'increment' ? Math.min(ls.length - 1, cur + 1) : Math.max(0, cur - 1);
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
});

const ab = StyleSheet.create({
  wrap: { position: 'absolute', right: 2, top: 0, bottom: 0, width: L.alphaBarW, flexDirection: 'column', alignItems: 'center', zIndex: 10 },
  btn: { width: L.alphaBarW, flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 8 },
  letter: { fontSize:9, fontWeight:'700', color:T.gold, fontFamily:FONT_BODY.bold },
});

const LetterOverlay = memo<{ letter: string | null; reducedMotion?: boolean }>(({ letter, reducedMotion = false }) => {
  const scale   = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (letter) {
      if (reducedMotion) { scale.value = 1; opacity.value = 1; } 
      else { scale.value = withSpring(1, { damping: 15, stiffness: 350 }); opacity.value = withTiming(1, { duration: 150 }); }
    } else {
      if (reducedMotion) { scale.value = 0.7; opacity.value = 0; } 
      else { scale.value = withTiming(0.7, { duration: 100 }); opacity.value = withTiming(0, { duration: 100 }); }
    }
  }, [letter, reducedMotion, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <View style={lo.container} pointerEvents="none">
      <ReAnimated.View style={[lo.bubble, animStyle]}>
        <Text style={lo.letter}>{letter ?? ''}</Text>
      </ReAnimated.View>
    </View>
  );
});

const lo = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  bubble: { width: 80, height: 80, borderRadius: 20, backgroundColor: T.gold, alignItems: 'center', justifyContent: 'center', shadowColor: T.gold, shadowOpacity: 0.40, shadowRadius: 20, shadowOffset: { width:0, height:4 }, elevation: 14 },
  letter: { fontSize: 40, fontWeight: '800', color: T.sheetBg, fontFamily: FONT_HEADING.bold, lineHeight: 44, includeFontPadding: false },
});

interface RecentlyVisitedProps {
  countries: CountryDoc[];
  selected:  string;
  onSelect:  (country: CountryDoc) => void;
}

const RecentlyVisitedSection = memo<RecentlyVisitedProps>(({ countries, selected, onSelect }) => (
  <View>
    <View style={rv.headerRow}>
      <Feather name="clock" size={12} color={T.gold} />
      <Text style={rv.label}>RECENTLY VISITED</Text>
    </View>
    {countries.map((c) => (
      <CountryRow key={c.id} country={c} isSelected={c.id === selected} onPress={onSelect} />
    ))}
    <View style={rv.sectionDivider} />
  </View>
));

const rv = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: L.rowPadH, marginTop: 10, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '700', color: T.textSecondary, letterSpacing: 0.8, fontFamily: FONT_BODY.bold, textTransform: 'uppercase' },
  sectionDivider: { height: 6, backgroundColor: T.surfaceSunken, marginTop: 4 },
});

// ─── Main component ────────────────────────────────────────────────────────────
type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CountryPickerSheetProps) {

  // [v4.1-UPDATE] Using true Gorhom BottomSheet instance
  const sheetRef = useRef<BottomSheet>(null);
  
  // Sheet naturally opens at 55%, expanding to 92% automatically on scroll or search focus.
  const snapPoints = useMemo(() => ['55%', '92%'], []);

  const [countries,     setCountries]    = useState<CountryDoc[]>([]);
  const [sheetState,    setSheetState]   = useState<SheetState>('loading');
  const [rawQuery,      setRawQuery]     = useState('');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [regionFilter,  setRegionFilter] = useState<RegionFilter>('All');
  const [error,         setError]        = useState<string | null>(null);
  const [reducedMotion, setRM]           = useState(false);
  const [recentIds,     setRecentIds]    = useState<string[]>([]);
  const [fetchedAt,     setFetchedAt]    = useState<number | null>(null);
  const [switchingTo,   setSwitchingTo]  = useState<CountryDoc | null>(null);
  const [isRefreshing,  setIsRefreshing] = useState(false);
  const [tickNow,       setTickNow]      = useState(() => Date.now());
  const [activeAlphaLetter, setActiveAlphaLetter] = useState<string | null>(null);

  const searchRef     = useRef<any>(null); // For BottomSheetTextInput
  
  // [v4.1-UPDATE] Using Gorhom's BottomSheetFlatList for automatic gesture syncing
  const listRef       = useRef<any>(null); 
  const fetchIdRef    = useRef(0);
  const isFetchingRef = useRef(false);
  const isMountedRef  = useRef(true);
  const isSwitchingRef  = useRef(false);
  const retryCountRef   = useRef(0);
  const [retryCount,    setRetryCount]   = useState(0); 
  const selectedRef     = useRef(selected);
  const recentIdsRef    = useRef(recentIds);

  useEffect(() => { selectedRef.current  = selected;     }, [selected]);
  useEffect(() => { recentIdsRef.current = recentIds;    }, [recentIds]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => { void migrateRecentsCache(); }, []);

  // Control Bottom Sheet presentation natively via Gorhom
  useEffect(() => {
    if (visible) {
      void hapticLight();
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} pressBehavior="close" appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} />
    ),
    [],
  );

  const handleSheetClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const pillsHeight  = useRef(new Animated.Value(L.pillRowH)).current;
  const pillsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isSearching = rawQuery.length > 0;
    Animated.parallel([
      Animated.timing(pillsHeight, { toValue: isSearching ? 0 : L.pillRowH, duration: isSearching ? 200 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(pillsOpacity, { toValue: isSearching ? 0 : 1, duration: isSearching ? 160 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [rawQuery, pillsHeight, pillsOpacity]);

  const searchBorderAnim = useRef(new Animated.Value(0)).current;
  const animatedBorderColor = searchBorderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [T.border, T.gold],
  });

  const handleSearchFocus = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
    Animated.timing(searchBorderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [searchBorderAnim]);

  const handleSearchBlur = useCallback(() => {
    Animated.timing(searchBorderAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  }, [searchBorderAnim]);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (sheetState !== 'loading') { shimmerAnim.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmerAnim, { toValue:1, duration:L.shimmerDur/2, useNativeDriver:true }),
      Animated.timing(shimmerAnim, { toValue:0, duration:L.shimmerDur/2, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [sheetState, shimmerAnim]);

  useEffect(() => {
    if (fetchedAt == null) return;
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 150);
    return () => clearTimeout(id);
  }, [rawQuery]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [searchQuery]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!visible) return;

    retryCountRef.current  = 0;
    setRetryCount(0);
    isSwitchingRef.current = false;
    const currentFetchId = ++fetchIdRef.current;

    setSheetState('loading');
    setRawQuery('');
    setSearchQuery('');
    setRegionFilter('All');
    setError(null);
    setSwitchingTo(null);

    AsyncStorage.getItem(CW_RECENTS_KEY).then((raw) => {
      if (fetchIdRef.current !== currentFetchId || !raw) return;
      try { setRecentIds(JSON.parse(raw) as string[]); } catch { /* ignore */ }
    }).catch(() => {});

    fetchCountries().then(([docs, ts]) => {
      if (fetchIdRef.current !== currentFetchId) return;
      setCountries(docs);
      setFetchedAt(ts);
      setTickNow(Date.now());
      setSheetState('idle');
    }).catch((err: unknown) => {
      if (fetchIdRef.current !== currentFetchId) return;
      console.error('[CountryPickerSheet] fetch failed:', err);
      setError('Could not load countries. Check your connection and try again.');
      setSheetState('idle');
    });
  }, [visible]);

  const handleRefresh = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    const currentFetchId = ++fetchIdRef.current;
    fetchCountries(true).then(([docs, ts]) => {
      if (fetchIdRef.current !== currentFetchId) return;
      if (isMountedRef.current) {
        setCountries(docs); setFetchedAt(ts); setTickNow(Date.now());
      }
    }).catch((err: unknown) => {
      if (fetchIdRef.current !== currentFetchId) return;
      console.error('[CountryPickerSheet] pull-to-refresh failed:', err);
    }).finally(() => {
      if (fetchIdRef.current === currentFetchId) isFetchingRef.current = false;
      if (isMountedRef.current) setIsRefreshing(false);
    });
  }, []);

  const handleRetry = useCallback(() => {
    if (isFetchingRef.current) return;
    if (retryCountRef.current >= MAX_RETRIES) {
      setError('Too many failed attempts. Please check your connection and restart the app.'); return;
    }
    retryCountRef.current++;
    setRetryCount(retryCountRef.current);
    isFetchingRef.current = true;
    const currentFetchId = ++fetchIdRef.current;
    setSheetState('loading');
    setError(null);

    fetchCountries(true).then(([docs, ts]) => {
      if (fetchIdRef.current !== currentFetchId) return;
      if (isMountedRef.current) { setCountries(docs); setFetchedAt(ts); setTickNow(Date.now()); setSheetState('idle'); }
    }).catch((err: unknown) => {
      if (fetchIdRef.current !== currentFetchId) return;
      if (!isMountedRef.current) return;
      setError(retryCountRef.current >= MAX_RETRIES ? `Still unable to load (attempt ${MAX_RETRIES}/${MAX_RETRIES}). Please check your connection.` : 'Still unable to load. Please try again later.');
      setSheetState('idle');
    }).finally(() => {
      if (fetchIdRef.current === currentFetchId) isFetchingRef.current = false;
    });
  }, []);

  const regionFiltered = useMemo<CountryDoc[]>(() => {
    if (regionFilter === 'All') return countries;
    return countries.filter((c) => c.region === regionFilter);
  }, [countries, regionFilter]);

  const sortedRegionFiltered = useMemo(() => [...regionFiltered].sort((a, b) => a.name.localeCompare(b.name)), [regionFiltered]);

  const displayCountries = useMemo<CountryDoc[]>(() => {
    if (!searchQuery.trim()) return regionFiltered;
    const q = searchQuery.trim();
    const normQ = normalizeDiacritics(q);
    const isDialQ = /^\+?\d+$/.test(q);
    const digits = q.replace(/\D/g, '');

    return regionFiltered.filter((c) => {
      if (normalizeDiacritics(c.name).includes(normQ)) return true;
      if (c.id.toLowerCase() === normQ) return true;
      if (isDialQ && c.dialCode?.replace(/\D/g, '').startsWith(digits)) return true;
      return false;
    });
  }, [regionFiltered, searchQuery]);

  const trendingCountries = useMemo(() => countries.slice(0, TRENDING_COUNT), [countries]);

  const regionCounts = useMemo<Partial<Record<RegionFilter, number>>>(() => {
    const counts: Partial<Record<RegionFilter, number>> = { 'All': countries.length };
    for (const c of countries) { counts[c.region] = (counts[c.region] ?? 0) + 1; }
    return counts;
  }, [countries]);

  const countTimeLabel = useMemo<string | null>(() => {
    if (fetchedAt == null) return null;
    const diffMin = Math.round((tickNow - fetchedAt) / 60_000);
    if (diffMin < 1) return 'Updated just now';
    if (diffMin === 1) return 'Updated 1 min ago';
    if (diffMin < 60) return `Updated ${diffMin} min ago`;
    return `Counts at ${new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }, [fetchedAt, tickNow]);

  const selectedCountry = useMemo(() => countries.find((c) => c.id === selected) ?? null, [countries, selected]);

  const recentCountries = useMemo<CountryDoc[]>(
    () => recentIds.flatMap((id) => { const c = countries.find((c) => c.id === id); return c ? [c] : []; }),
    [recentIds, countries],
  );

  const flatData = useMemo<ListItem[]>(() => {
    if (searchQuery.trim()) return buildSearchResults(displayCountries);
    return buildAlphaSections(sortedRegionFiltered);
  }, [displayCountries, searchQuery, sortedRegionFiltered]);

  const itemLayouts = useMemo(() => (searchQuery.trim() ? null : precomputeLayouts(flatData)), [flatData, searchQuery]);

  const alphabetLetters = useMemo<string[]>(() => {
    if (searchQuery.trim()) return [];
    return flatData.filter((item): item is SectionItem => item.type === 'section').map((item) => item.letter);
  }, [flatData, searchQuery]);

  const sectionIndexMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    flatData.forEach((item, i) => { if (item.type === 'section') map.set(item.letter, i); });
    return map;
  }, [flatData]);

  const handleAlphabetPress = useCallback((letter: string) => {
    const index = sectionIndexMap.get(letter);
    if (index === undefined) return;
    listRef.current?.scrollToIndex({ index, animated: !reducedMotion, viewOffset: 0 });
  }, [sectionIndexMap, reducedMotion]);

  const handleRegion = useCallback((r: RegionFilter) => {
    void hapticSelect(); setRegionFilter(r);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleSelect = useCallback(async (country: CountryDoc) => {
    if (isSwitchingRef.current) return;
    if (country.id === selectedRef.current) { onClose(); return; }

    isSwitchingRef.current = true;
    setSwitchingTo(country);
    void hapticMedium();
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      try {
        await AsyncStorage.setItem(CW_COUNTRY_KEY, country.id);
        const updated = [country.id, ...recentIdsRef.current.filter((id) => id !== country.id)].slice(0, MAX_RECENTS);
        await AsyncStorage.setItem(CW_RECENTS_KEY, JSON.stringify(updated));
        if (isMountedRef.current) setRecentIds(updated);
      } catch { /* non-critical */ }

      onSelect(country.id, country.name, country.emoji);
      if (isMountedRef.current) { setSheetState('idle'); setSwitchingTo(null); }

      await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 160));
      onClose();
    } finally {
      isSwitchingRef.current = false;
    }
  }, [onClose, onSelect, reducedMotion]);

  const keyExtractor = useCallback((item: ListItem, i: number): string => {
    if (item.type === 'section') return `sec-${item.letter}`;
    if (item.type === 'divider') return item.id;
    return `country-${item.country.id}-${i}`;
  }, []);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    if (item.type === 'divider') return <RowDivider />;
    return <CountryRow country={item.country} isSelected={item.country.id === selectedRef.current} onPress={handleSelect} />;
  }, [handleSelect]);

  const getItemLayout = useCallback((_: unknown, index: number) => {
    if (!itemLayouts) return { length: L.rowH, offset: L.rowH * index, index };
    return itemLayouts[index] ?? { length: L.rowH, offset: L.rowH * index, index };
  }, [itemLayouts]);

  const clearSearch = useCallback(() => {
    setRawQuery(''); searchRef.current?.focus();
  }, []);

  const placeholder  = countries.length > 0 ? `Search ${countries.length} countries…` : 'Search countries…';
  const showTrending = !searchQuery.trim() && regionFilter === 'All' && trendingCountries.length > 0;
  const showAlpha    = alphabetLetters.length > 0 && !searchQuery.trim();
  const showRecents  = recentCountries.length > 0 && !searchQuery.trim();
  const isRegionSearchEmpty = searchQuery.trim().length > 0 && displayCountries.length === 0 && regionFilter !== 'All';

  const renderListHeader = useCallback(() => (
    <>
      {showTrending && (
        <View style={sh.trendingSection}>
          <View style={sh.trendingLabelRow}>
            <Feather name="trending-up" size={13} color={T.gold} />
            <Text style={sh.trendingLabel}>TRENDING</Text>
            {countTimeLabel != null && <Text style={sh.countTimeLabel}>{countTimeLabel}</Text>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.heroScroll} keyboardShouldPersistTaps="handled" accessibilityLabel="Trending countries">
            {trendingCountries.map((c, index) => <HeroCard key={c.id} country={c} isSelected={c.id === selected} onPress={handleSelect} entryDelay={index * 40} reducedMotion={reducedMotion} />)}
          </ScrollView>
          <View style={sh.hairline} />
        </View>
      )}
      {showRecents && <RecentlyVisitedSection countries={recentCountries} selected={selected} onSelect={handleSelect} />}
    </>
  ), [showTrending, showRecents, trendingCountries, recentCountries, selected, handleSelect, countTimeLabel, reducedMotion]);

  const renderListEmpty = useCallback(() => {
    if (isRegionSearchEmpty) {
      return (
        <ReAnimated.View entering={!reducedMotion ? FadeIn.duration(200) : undefined} style={sh.stateWrap}>
          <View style={sh.stateIconCircle}><Feather name="search" size={28} color={T.textTertiary} /></View>
          <Text style={sh.stateTitle}>No Results in {regionFilter}</Text>
          <Text style={sh.stateHint}>No countries match "{searchQuery}" in {regionFilter}.</Text>
          <Pressable onPress={() => { void hapticLight(); setRegionFilter('All'); }} style={({ pressed }) => [sh.ctaBtn, pressed && { opacity: 0.75 }]} accessibilityRole="button">
            <Feather name="globe" size={14} color={T.gold} />
            <Text style={sh.ctaBtnText}>Search All Countries</Text>
          </Pressable>
        </ReAnimated.View>
      );
    }
    return (
      <ReAnimated.View entering={!reducedMotion ? FadeIn.duration(200) : undefined} style={sh.stateWrap}>
        <View style={sh.stateIconCircle}><Feather name="globe" size={28} color={T.textTertiary} /></View>
        <Text style={sh.stateTitle}>No Countries Found</Text>
        <Text style={sh.stateHint}>{searchQuery.trim() ? `"${searchQuery}" didn't match any country` : 'No countries in this region yet'}</Text>
      </ReAnimated.View>
    );
  }, [isRegionSearchEmpty, regionFilter, searchQuery, reducedMotion]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      enablePanDownToClose={true}
      onClose={handleSheetClose}
      backgroundStyle={sh.sheetBackground}
      handleStyle={sh.handleContainer}
      handleIndicatorStyle={sh.handleIndicator}
    >
      <BottomSheetView style={sh.pinnedShell}>
        <View style={sh.titleRowMerged}>
          <View style={sh.globeIconWrap}><Feather name="globe" size={22} color={T.gold} /></View>
          <View style={sh.titleTextGroup}>
            <Text style={sh.title}>Choose Country</Text>
            {selectedCountry != null && sheetState !== 'loading' && (
              <View style={sh.activeInline}>
                <LiveDot size={5} pulse />
                <Text style={sh.activeFlag} accessible={false}>{selectedCountry.emoji}</Text>
                <Text style={sh.activeName} numberOfLines={1}>{selectedCountry.name}</Text>
                <Text style={sh.activeSep} accessible={false}>·</Text>
                <Text style={sh.activeCountInline} numberOfLines={1}>
                  {selectedCountry.onlineCount > 0 ? `${fmtCount(selectedCountry.onlineCount)} online` : 'No one online'}
                </Text>
                <View style={sh.activeBadge}><Text style={sh.activeBadgeText}>ACTIVE</Text></View>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [sh.closeBtn, pressed && sh.closeBtnPressed]} hitSlop={{ top:4, bottom:4, left:4, right:4 }}>
            <Feather name="x" size={20} color={T.textSecondary} />
          </Pressable>
        </View>

        <Animated.View style={[sh.searchWrap, { borderColor: animatedBorderColor }]}>
          <Feather name="search" size={18} color={T.textTertiary} />
          {/* [v4.1-UPDATE] Integrated BottomSheetTextInput to prevent gesture handler conflicts */}
          <BottomSheetTextInput
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
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {rawQuery.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Feather name="x-circle" size={18} color={T.textTertiary} />
            </Pressable>
          )}
        </Animated.View>

        <Animated.View style={[sh.pillAnimWrap, { height: pillsHeight, opacity: pillsOpacity, overflow: 'hidden' }]}>
          {sheetState !== 'loading' && error == null && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.pillScroll} keyboardShouldPersistTaps="always">
              {REGION_FILTERS.map((r) => <RegionPill key={r} label={r} active={regionFilter === r} count={countries.length > 0 ? (regionCounts[r] ?? 0) : undefined} onPress={handleRegion} />)}
            </ScrollView>
          )}
        </Animated.View>
        <View style={sh.hairline} />
      </BottomSheetView>

      {sheetState === 'loading' ? (
        <BottomSheetView style={sh.contentArea}>
          <View style={sh.trendingSection}>
            <View style={sh.trendingLabelRow}><Feather name="trending-up" size={13} color={T.gold} /><Text style={sh.trendingLabel}>TRENDING</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.heroScroll} scrollEnabled={false}>
              {Array.from({ length: TRENDING_COUNT }, (_, i) => <SkeletonHeroCard key={i} shimmer={shimmerAnim} />)}
            </ScrollView>
            <View style={sh.hairline} />
          </View>
          {recentIds.length > 0 && (
            <View>
              <View style={rv.headerRow}><Feather name="clock" size={12} color={T.gold} /><Text style={rv.label}>RECENTLY VISITED</Text></View>
              {recentIds.map((id) => <SkeletonRow key={id} shimmer={shimmerAnim} />)}
              <View style={rv.sectionDivider} />
            </View>
          )}
          <View accessible accessibilityRole="progressbar">
            {Array.from({ length: L.shimmerRows }, (_, i) => <SkeletonRow key={i} shimmer={shimmerAnim} />)}
          </View>
        </BottomSheetView>
      ) : error != null ? (
        <BottomSheetView style={sh.stateWrap}>
          <View style={sh.stateIconCircle}><Feather name="wifi-off" size={28} color={T.textTertiary} /></View>
          <Text style={sh.stateTitle}>Failed to Load</Text>
          <Text style={sh.stateHint}>{error}</Text>
          {retryCountRef.current < MAX_RETRIES && (
            <Pressable onPress={handleRetry} style={({ pressed }) => [sh.retryBtn, pressed && sh.retryBtnPressed]}>
              <Feather name="refresh-cw" size={14} color={T.sheetBg} />
              <Text style={sh.retryBtnText}>Try Again</Text>
            </Pressable>
          )}
        </BottomSheetView>
      ) : (
        <View style={sh.listWrap}>
          {searchQuery.trim().length > 0 && <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${displayCountries.length} countries found`} style={sh.srOnly} />}
          
          {/* [v4.1-UPDATE] Actual Gorhom BottomSheetFlatList */}
          {/* This natively communicates with the BottomSheet to seamlessly manage scroll gestures */}
          <BottomSheetFlatList
            ref={listRef}
            data={flatData}
            extraData={selected}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderListEmpty}
            showsVerticalScrollIndicator={false}
            style={sh.flatList}
            contentContainerStyle={[sh.listContent, showAlpha && { paddingRight: L.alphaBarW + 6 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            windowSize={8}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={(info) => {
              const offset = itemLayouts?.[info.index]?.offset ?? L.rowH * info.index;
              listRef.current?.scrollToOffset({ offset, animated: false });
            }}
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={T.gold} colors={[T.gold]} />}
          />

          {showAlpha && <AlphabetSidebar letters={alphabetLetters} onPress={handleAlphabetPress} onLetterChange={setActiveAlphaLetter} />}
          <LetterOverlay letter={activeAlphaLetter} reducedMotion={reducedMotion} />
        </View>
      )}

      {sheetState === 'switching' && (
        <ReAnimated.View entering={!reducedMotion ? FadeIn.duration(150) : undefined} style={sh.switchOverlay} pointerEvents="auto">
          <View style={sh.switchSpinnerWrap}>
            <ActivityIndicator size={60} color={T.gold} style={sh.switchActivityRing} />
            <View style={sh.switchSpinner}><Text style={sh.switchFlag}>{switchingTo?.emoji ?? selectedCountry?.emoji ?? '🌐'}</Text></View>
          </View>
        </ReAnimated.View>
      )}
    </BottomSheet>
  );
}

export const CountryPickerSheet = memo((props: CountryPickerSheetProps) => (
  <PulseProvider>
    <CountryPickerSheetBase {...props} />
  </PulseProvider>
));
export default CountryPickerSheet;

// ─── Styles ────────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  sheetBackground: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: T.sheetBg },
  handleContainer: { paddingTop: 10 },
  handleIndicator: { width: L.handleW, height: L.handleH, borderRadius: L.handleH / 2, backgroundColor: T.border },
  pinnedShell: { backgroundColor: T.sheetBg, paddingBottom: 4 },
  titleRowMerged: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: L.rowPadH, paddingVertical: 10, gap: 10 },
  globeIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.goldSubtle, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleTextGroup: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontWeight: '700', color: T.text, fontFamily: FONT_HEADING.semiBold, letterSpacing: -0.3 },
  activeInline: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap' },
  activeFlag:  { fontSize:13 },
  activeName: { fontSize: 13, fontWeight: '700', color: T.gold, fontFamily: FONT_HEADING.semiBold, flexShrink: 1, maxWidth: 100 },
  activeSep:   { color:T.textMuted, fontSize:13 },
  activeCountInline: { fontSize: 11, fontWeight: '500', color: T.textSecondary, fontFamily: FONT_BODY.medium, flexShrink: 1 },
  activeBadge: { backgroundColor: T.gold, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 0 },
  activeBadgeText: { fontSize: 8, fontWeight: '800', color: T.sheetBg, letterSpacing: 0.7, fontFamily: FONT_BODY.bold },
  closeBtn: { width: L.closeBtn, height: L.closeBtn, borderRadius: L.closeBtn / 2, backgroundColor: T.surfaceWell, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  closeBtnPressed: { opacity:0.60 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: L.rowPadH, marginVertical: 6, height: L.searchH, backgroundColor: T.surfaceSunken, borderRadius: L.searchH / 2, paddingHorizontal: 14, borderWidth: 1.5, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: T.text, fontFamily: FONT_BODY.regular, paddingVertical: 0 },
  pillAnimWrap: {},
  pillScroll: { paddingHorizontal: L.rowPadH, paddingVertical: 9, gap: 8, flexDirection: 'row' },
  hairline: { height: 1, backgroundColor: T.borderSubtle },
  contentArea: { flex:1 },
  listWrap: { flex:1, position:'relative' },
  flatList: { flex:1 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 24 : 20 },
  trendingSection:  { paddingBottom:8 },
  trendingLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: L.rowPadH, marginTop: 8, marginBottom: 10 },
  trendingLabel: { fontSize: 11, fontWeight: '700', color: T.textSecondary, letterSpacing: 0.8, fontFamily: FONT_BODY.bold, textTransform: 'uppercase', flex: 1 },
  countTimeLabel: { fontSize: 10, fontWeight: '500', color: T.textTertiary, fontFamily: FONT_BODY.regular },
  heroScroll: { paddingHorizontal: L.rowPadH, gap: 10 },
  stateWrap: { alignItems: 'center', paddingTop: 44, paddingBottom: 36, paddingHorizontal: 32, gap: 12, flex: 1 },
  stateIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.surfaceWell, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle: { fontSize: 17, fontWeight: '700', color: T.text, fontFamily: FONT_HEADING.semiBold, textAlign: 'center' },
  stateHint: { fontSize: 13, color: T.textSecondary, fontFamily: FONT_BODY.regular, textAlign: 'center', lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingVertical: 13, paddingHorizontal: 28, backgroundColor: T.gold, borderRadius: 16, shadowColor: T.gold, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width:0, height:5 }, elevation: 5 },
  retryBtnPressed: { opacity:0.80 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: T.sheetBg, fontFamily: FONT_HEADING.semiBold, letterSpacing: 0.2 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1.5, borderColor: T.gold, backgroundColor: T.goldSubtle },
  ctaBtnText: { fontSize: 13, fontWeight: '700', color: T.gold, fontFamily: FONT_HEADING.semiBold, letterSpacing: 0.1 },
  switchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: DV.switchOverlay, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, zIndex: 99 },
  switchSpinner: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: T.sheetBg, alignItems: 'center', justifyContent: 'center', shadowColor: T.text, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width:0, height:8 }, elevation: 10 },
  switchSpinnerWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  switchActivityRing: { position: 'absolute', width: 80, height: 80 },
  switchFlag: { fontSize:30 },
  srOnly: { width: 0, height: 0, overflow: 'hidden' },
});

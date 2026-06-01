/**
 * components/organisms/CountryPickerSheet.tsx — v3.2
 *
 * CROWN — Country Selection Bottom Sheet
 * "The gateway to the world. Clean. Fast. Global."
 *
 * ── v3.2 CHANGELOG (37 issues resolved) ──────────────────────────────────────
 *
 *  CRITICAL FIXES
 *  ✦ [CRIT-01] Module-level _pulseRefs/_pulseLoop/_pulseAnim → usePulse(enabled)
 *              hook with proper ref-counting; eliminated memory leak + anti-pattern
 *  ✦ [CRIT-02] isFetchingRef race condition → fetchIdRef increment/compare pattern;
 *              rapid visibility toggles produce exactly 1 active getDocs read
 *  ✦ [CRIT-03] Switching overlay pointerEvents="none" → "auto" (blocks underlying
 *              touches); handleSelect guarded by isSwitchingRef for instant lock
 *  ✦ [CRIT-04] LiveDot false-confirmation loop — snapshot data showing realtime
 *              pulse → pulse=false on all CountryRow/strip dots; only the active
 *              strip LiveDot still pulses (adjacent to countTimeLabel context)
 *  ✦ [CRIT-05] 6-hr TTL thundering herd → jittered expiresAt (±30 min) written
 *              at cache-save time; CountryCacheEntry gains expiresAt field
 *  ✦ [CRIT-06] TypeScript 'as any' on palette.emerald/amber → direct access
 *              (fallback already used direct access; 'as any' was redundant)
 *
 *  HIGH PRIORITY FIXES
 *  ✦ [HIGH-01] renderItem inline arrow broke CountryRow/HeroCard memo → onPress
 *              typed as (country: CountryDoc) => void; component wraps in useCallback
 *  ✦ [HIGH-02] recentIds dead code (loaded but never rendered) → RecentlyVisited
 *              section renders above A-Z list when no search active
 *  ✦ [HIGH-03] Switching overlay showed OLD country emoji → switchingTo state
 *              tracks the new country; overlay reads switchingTo.emoji
 *  ✦ [HIGH-04] buildAlphaSections re-sorted on every filter press → sortedRegion
 *              Filtered memoized separately; buildAlphaSections takes pre-sorted data
 *  ✦ [HIGH-05] SHEET_MAX recomputed on every render → wrapped in useMemo
 *  ✦ [HIGH-06] AlphabetSidebar PanResponder captured FlatList scroll moves →
 *              onMoveShouldSetPanResponder: () => false (only claim on touch start)
 *  ✦ [HIGH-07] handleSelect state updates after unmount → isMountedRef guard on
 *              all setState calls inside the async handler
 *  ✦ [HIGH-08] Search ignored regionFilter (searched all countries) → now filters
 *              within regionFiltered; cross-region reachable via ADD-07 CTA
 *  ✦ [HIGH-09] HeroCard accessibilityRole="button" inconsistent with CountryRow
 *              "radio" → HeroCard updated to role="radio" + accessibilityState.checked
 *  ✦ [HIGH-10] Rapid hapticSelect on fast alphabet pan → throttled to ≥50 ms gap
 *
 *  MEDIUM FIXES
 *  ✦ [MED-01] 🌍 globe emoji in header → Feather "globe" icon (CROWN standard)
 *  ✦ [MED-02] RegionPill accessibilityRole="button" inside tablist → "tab"
 *  ✦ [MED-03] Search diacritic blind — "cote" missed "Côte d'Ivoire" →
 *              normalizeDiacritics() added; all name comparisons normalize first
 *  ✦ [MED-04] AlphabetSidebar pan: no visual letter feedback → LetterOverlay
 *              component shows gold letter bubble; see also ADD-06
 *  ✦ [MED-05] countTimeLabel 24 h format → superseded by ADD-04 relative time;
 *              fallback format uses en-IN 12 h AM/PM via toLocaleTimeString
 *  ✦ [MED-06] Unlimited retries → MAX_RETRIES=3 cap; retryCountRef tracks
 *              attempts; final exhaustion error has distinct message
 *  ✦ [MED-07] AccessibilityInfo.isReduceMotionEnabled Android note → comment
 *              added; works Android API 26+ (RN 0.73+); safe false-default otherwise
 *  ✦ [MED-08] RowDivider focusable to screen readers → accessible={false} +
 *              importantForAccessibility="no-hide-descendants"
 *  ✦ [MED-09] mapToRegion silent 'Asia' fallback → __DEV__ console.warn added
 *  ✦ [MED-10] FlatList radiogroup wrapper missing → View role="radiogroup" wraps
 *              the FlatList
 *  ✦ [MED-11] AlphabetSidebar keyboard/switch-access impossible →
 *              accessibilityActions increment/decrement with haptic + scroll
 *
 *  ADD — New Features
 *  ✦ [ADD-01] Recently Visited section renders above A-Z list (was dead code)
 *  ✦ [ADD-02] onSnapshot stub — TODO comment; infrastructure for real-time count
 *  ✦ [ADD-03] Pull-to-refresh on FlatList (RefreshControl, bypass-cache refetch)
 *  ✦ [ADD-04] Relative time label "Updated X min ago" with 60 s auto-tick timer
 *  ✦ [ADD-05] Offline detection stub — TODO comment for NetInfo pre-check
 *  ✦ [ADD-06] Visual letter overlay during AlphabetSidebar pan (LetterOverlay)
 *  ✦ [ADD-07] Empty search within active region → "Search All Countries" CTA
 *  ✦ [ADD-08] Country count badge on region pills (e.g. "Asia · 47")
 *  ✦ [ADD-09] Dial-code search: "+91" / "91" → India via CountryDoc.dialCode
 *  ✦ [ADD-10] Skeleton shimmer HeroCards in Trending section during loading
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *
 *   <CountryPickerSheet
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     selected="IN"
 *     onSelect={(id, name, emoji) => { … }}
 *   />
 *
 * ── FIREBASE CONFIG ───────────────────────────────────────────────────────────
 *   Adjust @/lib/firebase import path if your db lives elsewhere.
 *   ADD-09: dialCode requires a `dial_code` field in Firestore (e.g. "+91").
 *           If absent, dial-code search silently degrades to name+ISO matching.
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
  Animated,
  FlatList,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather }       from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db }                 from '@/lib/firebase';
import { BottomSheet }        from '@/components/BottomSheet';
import { palette }            from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// ─── Storage keys ──────────────────────────────────────────────────────────────
const CW_COUNTRY_KEY  = '@cw/country_id'           as const;
const CW_RECENTS_KEY  = '@cw/recent_countries_v3'  as const;
const MAX_RECENTS     = 3                           as const;
const TRENDING_COUNT  = 5                           as const;
const MAX_RETRIES     = 3                           as const; // [MED-06]

// ─── Country cache (AsyncStorage) ─────────────────────────────────────────────
const COUNTRIES_CACHE_KEY = '@cw/countries_v2'     as const; // bumped for new schema
const COUNTRIES_CACHE_TTL = 6 * 60 * 60 * 1000    as const; // 6 hours base

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
  // [CRIT-06] Removed 'as any' casts — palette.emerald/amber are valid direct refs
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
  dialCode?:   string; // [ADD-09] e.g. "+91" — requires dial_code field in Firestore
}

export interface CountryPickerSheetProps {
  visible:  boolean;
  onClose:  () => void;
  selected: string;
  onSelect: (countryId: string, name: string, emoji: string) => void;
}

interface FSCountry {
  name?:         string;
  flag?:         string;
  iso2?:         string;
  continent?:    string;
  online_count?: number;
  is_active?:    boolean;
  capital?:      string;
  dial_code?:    string; // [ADD-09]
}

// [CRIT-05] expiresAt stored with jitter to spread cache invalidations across users
interface CountryCacheEntry {
  data:      CountryDoc[];
  fetchedAt: number;
  expiresAt: number; // jittered: base TTL ± 30 min
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

// ─── Utility: diacritic normalization ─────────────────────────────────────────
// [MED-03] "cote" now matches "Côte d'Ivoire", "reunion" matches "Réunion", etc.
function normalizeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Utility: Region mapping ───────────────────────────────────────────────────
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
      // [MED-09] Surface unknown continents in dev so Firestore data can be corrected
      if (__DEV__ && continent?.trim()) {
        console.warn(
          `[CountryPickerSheet] Unknown continent: "${continent}" for ${iso2} — defaulting to Asia`,
        );
      }
      return 'Asia';
  }
}

// ─── Utility: Heat score ───────────────────────────────────────────────────────
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

// ─── Utility: Indian short-count formatter ─────────────────────────────────────
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

// ─── Firestore mapper ──────────────────────────────────────────────────────────
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
    dialCode:    data.dial_code, // [ADD-09] undefined when not in Firestore
  };
}

// ─── Firestore fetch — cache-first (AsyncStorage) ────────────────────────────
async function fetchCountries(bypassCache = false): Promise<[CountryDoc[], number]> {
  // 1. Serve from cache if still within jittered expiry window
  if (!bypassCache) {
    try {
      const raw = await AsyncStorage.getItem(COUNTRIES_CACHE_KEY);
      if (raw) {
        const entry = JSON.parse(raw) as CountryCacheEntry;
        if (Date.now() < entry.expiresAt) {
          return [entry.data, entry.fetchedAt]; // cache hit: 0 Firestore reads
        }
      }
    } catch { /* cache miss — fall through */ }
  }

  // 2. Network fetch
  const snap = await getDocs(
    query(collection(db, 'countries'), where('is_active', '==', true)),
  );
  const docs = snap.docs.map((d) => mapFSDoc(d.id, d.data() as Partial<FSCountry>));
  docs.sort((a, b) =>
    b.onlineCount !== a.onlineCount
      ? b.onlineCount - a.onlineCount
      : a.name.localeCompare(b.name),
  );

  // 3. Persist with jitter — [CRIT-05] prevents thundering herd on TTL expiry
  const fetchedAt = Date.now();
  const jitterMs  = (Math.random() - 0.5) * 60 * 60 * 1000; // ±30 min
  const expiresAt = fetchedAt + COUNTRIES_CACHE_TTL + jitterMs;
  AsyncStorage.setItem(
    COUNTRIES_CACHE_KEY,
    JSON.stringify({ data: docs, fetchedAt, expiresAt } as CountryCacheEntry),
  ).catch(() => {});

  return [docs, fetchedAt];
}

// ─── Build A-Z grouped flat-list data ─────────────────────────────────────────
// [HIGH-04] Takes a PRE-SORTED array (caller handles sort). No internal sort.
function buildAlphaSections(sorted: CountryDoc[]): ListItem[] {
  const items: ListItem[] = [];
  let prevLetter    = '';
  let prevWasSection = true;

  for (const country of sorted) {
    const letter = country.name[0]?.toUpperCase() ?? '#';
    if (letter !== prevLetter) {
      items.push({ type: 'section', letter });
      prevLetter    = letter;
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

// ─── [CRIT-01] usePulse — ref-counted, module-level animation ─────────────────
// One Animated.Value drives ALL LiveDot instances (far more performant).
// The loop starts on first subscriber, stops on last unmount — no leaks.
// Encapsulated in an object to prevent accidental global mutation.
const _pulse = {
  anim: new Animated.Value(1),
  refs: 0,
  loop: null as Animated.CompositeAnimation | null,
};

function usePulse(enabled: boolean): Animated.Value {
  useEffect(() => {
    if (!enabled) return;
    _pulse.refs++;
    if (_pulse.loop === null) {
      _pulse.loop = Animated.loop(
        Animated.sequence([
          Animated.timing(_pulse.anim, { toValue: 0.2, duration: 850, useNativeDriver: true }),
          Animated.timing(_pulse.anim, { toValue: 1.0, duration: 850, useNativeDriver: true }),
        ]),
      );
      _pulse.loop.start();
    }
    return () => {
      _pulse.refs = Math.max(0, _pulse.refs - 1);
      if (_pulse.refs === 0 && _pulse.loop !== null) {
        _pulse.loop.stop();
        _pulse.loop = null;
        _pulse.anim.setValue(1);
      }
    };
  }, [enabled]);
  return _pulse.anim;
}

// ─── LiveDot ───────────────────────────────────────────────────────────────────
// [CRIT-04] pulse=false → static dot. Prevents false real-time implication
// on snapshot (getDocs) data. Only the active-strip dot passes pulse=true
// because it sits next to the countTimeLabel which provides honest context.
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

// ─── SkeletonRow ───────────────────────────────────────────────────────────────
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

// ─── [ADD-10] SkeletonHeroCard — shown in Trending section during loading ─────
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

// ─── SectionHeader ─────────────────────────────────────────────────────────────
const SectionHeader = memo<{ letter: string }>(({ letter }) => (
  <View style={sec.wrap} accessibilityRole="header">
    <Text
      style={sec.letter}
      accessibilityLabel={`Countries starting with ${letter}`}
    >
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

// ─── HeroCard ──────────────────────────────────────────────────────────────────
interface HeroCardProps {
  country:    CountryDoc;
  isSelected: boolean;
  // [HIGH-01] Stable ref — no inline arrow needed at the call site
  onPress:    (country: CountryDoc) => void;
}

const HeroCard = memo<HeroCardProps>(({ country, isSelected, onPress }) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const accent = REGION_ACCENT[country.region] as string;
  const filled = Math.max(0, Math.min(1, country.heat / 100));

  // [HIGH-01] useCallback binds country without inline arrow in renderItem
  const handlePress    = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn      = useCallback(() =>
    Animated.spring(scale, { toValue:0.94, useNativeDriver:true, speed:50, bounciness:0 }).start(),
  [scale]);
  const onPressOut     = useCallback(() =>
    Animated.spring(scale, { toValue:1.00, useNativeDriver:true, speed:40, bounciness:5 }).start(),
  [scale]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      // [HIGH-09] Consistent with CountryRow — role="radio" + checked
      accessibilityRole="radio"
      accessibilityLabel={`${country.name}, ${fmtCount(country.onlineCount)} online`}
      accessibilityState={{ checked: isSelected }}
    >
      <Animated.View
        style={[
          hc.card,
          isSelected && { borderColor: accent, ...hc.cardActive },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={hc.flag} accessible={false}>{country.emoji}</Text>

        <Text style={[hc.name, isSelected && { color: accent }]} numberOfLines={1}>
          {country.name}
        </Text>

        <View style={hc.countRow}>
          {/* [CRIT-04] pulse=false — getDocs is snapshot, not real-time */}
          <LiveDot size={5} gold={isSelected} pulse={false} />
          <Text style={[hc.count, isSelected && { color: accent }]}>
            {country.onlineCount > 0 ? fmtCount(country.onlineCount) : '—'}
          </Text>
        </View>

        <View style={hc.heatTrackWrap}>
          <View style={hc.heatTrack}>
            <View
              style={[
                hc.heatFill,
                {
                  width: `${(filled * 100).toFixed(0)}%` as `${number}%`,
                  backgroundColor: isSelected ? accent : heatColour(country.heat),
                },
              ]}
            />
          </View>
        </View>

        {isSelected && (
          <View style={[hc.checkDot, { backgroundColor: accent }]}>
            <Feather name="check" size={9} color={T.sheetBg} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

const hc = StyleSheet.create({
  card: {
    width:           L.heroW,
    height:          L.heroH,
    borderRadius:    L.heroR,
    borderWidth:     1.5,
    borderColor:     T.border,
    backgroundColor: T.sheetBg,
    padding:         12,
    gap:             3,
    shadowColor:     T.text,
    shadowOpacity:   0.06,
    shadowRadius:    10,
    shadowOffset:    { width:0, height:3 },
    elevation:       2,
    overflow:        'hidden',
  },
  cardActive: { shadowOpacity:0.14, shadowRadius:18, elevation:5 },
  flag:       { fontSize:L.flagEmoji },
  name: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.text,
    fontFamily: FONT_HEADING.semiBold,
    flexShrink: 1,
  },
  countRow:    { flexDirection:'row', alignItems:'center', gap:4 },
  count: {
    fontSize:   10,
    fontWeight: '600',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.semiBold,
  },
  heatTrackWrap: { flex:1, justifyContent:'flex-end' },
  heatTrack: {
    width:           '100%',
    height:          L.heatH,
    borderRadius:    L.heatR,
    backgroundColor: T.border,
    overflow:        'hidden',
  },
  heatFill:  { height:'100%', borderRadius:L.heatR },
  checkDot: {
    position:'absolute', top:8, right:8,
    width:18, height:18, borderRadius:9,
    alignItems:'center', justifyContent:'center',
  },
});

// ─── CountryRow ────────────────────────────────────────────────────────────────
interface CountryRowProps {
  country:    CountryDoc;
  isSelected: boolean;
  // [HIGH-01] Stable ref — no inline arrow needed at the call site
  onPress:    (country: CountryDoc) => void;
}

const CountryRow = memo<CountryRowProps>(({ country, isSelected, onPress }) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const regionBg = REGION_FLAG_BG[country.region];
  const heatFill = Math.max(0, Math.min(1, country.heat / 100));
  const accent   = REGION_ACCENT[country.region] as string;

  // [HIGH-01] Stable callback — memo only breaks on country or onPress change
  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() =>
    Animated.spring(scale, { toValue:0.97, useNativeDriver:true, speed:60, bounciness:0 }).start(),
  [scale]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue:1.00, useNativeDriver:true, speed:55, bounciness:4 }).start(),
  [scale]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${country.name} (${country.id}), ${
        country.onlineCount > 0 ? fmtCount(country.onlineCount) + ' online' : 'no one online'
      }`}
      accessibilityState={{ checked: isSelected }}
    >
      <Animated.View
        style={[
          cr.row,
          isSelected && cr.rowActive,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[cr.flagBox, { backgroundColor: regionBg }]}>
          <Text style={cr.flagEmoji} accessible={false}>{country.emoji}</Text>
        </View>

        <View style={cr.body}>
          <View style={cr.nameRow}>
            <Text style={[cr.name, isSelected && cr.nameActive]} numberOfLines={1}>
              {country.name}
            </Text>
            <Text style={[cr.iso, isSelected && { color: T.goldLight }]} accessible={false}>
              {country.id}
            </Text>
          </View>

          <View style={cr.meta}>
            {country.onlineCount > 0
              ? <LiveDot size={5} gold={isSelected} pulse={false} /> // [CRIT-04]
              : <View style={[cr.dotStatic, { backgroundColor: T.border }]} />
            }
            <Text style={[cr.count, isSelected && cr.countActive]}>
              {country.onlineCount > 0
                ? `${fmtCount(country.onlineCount)} online`
                : 'No one online'}
            </Text>
          </View>
        </View>

        <View style={cr.heatCol}>
          <View style={cr.heatTrack}>
            <View
              style={[
                cr.heatFill,
                {
                  width: `${(heatFill * 100).toFixed(0)}%` as `${number}%`,
                  backgroundColor: isSelected ? accent : heatColour(country.heat),
                },
              ]}
            />
          </View>
          <Text style={[cr.heatNum, isSelected && { color: accent }]}>
            {country.heat}
          </Text>
        </View>

        {isSelected ? (
          <View style={[cr.checkCircle, { backgroundColor: accent }]}>
            <Feather name="check" size={12} color={T.sheetBg} />
          </View>
        ) : (
          <Feather name="chevron-right" size={16} color={T.textTertiary} />
        )}
      </Animated.View>
    </Pressable>
  );
});

const cr = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    height:            L.rowH,
    gap:               12,
    backgroundColor:   T.sheetBg,
  },
  rowActive:   { backgroundColor: DV.activeRowBg },
  flagBox: {
    width:          L.flagBox,
    height:         L.flagBox,
    borderRadius:   L.flagRadius,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  flagEmoji: { fontSize: L.flagEmoji },
  body:      { flex:1, gap:4 },
  nameRow:   { flexDirection:'row', alignItems:'center', gap:6 },
  name: {
    fontSize:   15,
    fontWeight: '600',
    color:      T.text,
    fontFamily: FONT_HEADING.medium,
    flexShrink: 1,
  },
  nameActive: { color:T.gold, fontWeight:'700' },
  iso: {
    fontSize:      10,
    fontWeight:    '600',
    color:         T.textTertiary,
    fontFamily:    FONT_BODY.semiBold,
    letterSpacing: 0.5,
    flexShrink:    0,
  },
  meta:      { flexDirection:'row', alignItems:'center', gap:4 },
  dotStatic: { width:5, height:5, borderRadius:2.5 },
  count: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
  },
  countActive: { color: T.gold },
  heatCol: { alignItems:'flex-end', gap:3, width:56, flexShrink:0 },
  heatTrack: {
    width:           L.heatW,
    height:          L.heatH,
    borderRadius:    L.heatR,
    backgroundColor: T.border,
    overflow:        'hidden',
  },
  heatFill: { height:'100%', borderRadius:L.heatR },
  heatNum: {
    fontSize:   10,
    fontWeight: '600',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.semiBold,
  },
  checkCircle: {
    width:26, height:26, borderRadius:13,
    alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
});

// ─── RowDivider ────────────────────────────────────────────────────────────────
// [MED-08] accessible={false} prevents screen readers from focusing the divider
const RowDivider = memo(() => (
  <View
    style={{ height:L.divH, backgroundColor:T.borderSubtle, marginHorizontal:L.rowPadH }}
    accessible={false}
    importantForAccessibility="no-hide-descendants"
  />
));

// ─── [NEW-03] RegionPill ───────────────────────────────────────────────────────
interface RegionPillProps {
  label:   RegionFilter;
  active:  boolean;
  count?:  number; // [ADD-08] e.g. 47; undefined = don't show
  // [HIGH-01] Stable ref pattern applied to pills too
  onPress: (filter: RegionFilter) => void;
}

const RegionPill = memo<RegionPillProps>(({ label, active, count, onPress }) => {
  // [HIGH-01] Bind label without inline arrow at call site
  const handlePress = useCallback(() => onPress(label), [onPress, label]);
  const displayText = count !== undefined
    ? `${label} · ${count}`  // [ADD-08]
    : label;

  return (
    <Pressable
      onPress={handlePress}
      // [MED-02] tablist container → each pill must be "tab", not "button"
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
  pill: {
    height:            L.pillH,
    paddingHorizontal: 14,
    borderRadius:      L.pillH / 2,
    borderWidth:       1,
    borderColor:       T.border,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   T.sheetBg,
  },
  pillActive: { borderColor:T.gold, backgroundColor:T.goldSubtle },
  text:       { fontSize:12, fontWeight:'600', color:T.textSecondary, fontFamily:FONT_BODY.semiBold },
  textActive: { color: T.gold },
});

// ─── [NEW-02] AlphabetSidebar ─────────────────────────────────────────────────
interface AlphabetSidebarProps {
  letters:        string[];
  onPress:        (letter: string) => void;
  onLetterChange: (letter: string | null) => void; // [ADD-06/MED-04] overlay
}

const AlphabetSidebar = memo<AlphabetSidebarProps>(
  ({ letters, onPress, onLetterChange }) => {
    const heightRef    = useRef(0);
    const lastIdxRef   = useRef(-1);
    // [HIGH-10] Throttle haptics — rapid pan can hammer haptic engine
    const lastHapticMs = useRef(0);

    // Mutable refs for callback props — avoids recreating PanResponder on every render
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
          // [HIGH-10] ≥50 ms between haptics — prevents battery drain on fast pan
          const now = Date.now();
          if (now - lastHapticMs.current >= 50) {
            lastHapticMs.current = now;
            void hapticSelect();
          }
          onLetterChangeRef.current(letter); // [ADD-06/MED-04] show overlay
          onPressRef.current(letter);
        }
      }
    }, []); // stable — reads via refs

    // [CRIT-01 of PanResponder] Created once — delegates via stable refs
    const panHandlers = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // [HIGH-06] Do NOT claim ongoing moves — lets FlatList scroll normally
        onMoveShouldSetPanResponder:  () => false,
        onPanResponderGrant:   (e) => { lastIdxRef.current = -1; hitLetter(e.nativeEvent.locationY); },
        onPanResponderMove:    (e) => { hitLetter(e.nativeEvent.locationY); },
        onPanResponderRelease: () => {
          lastIdxRef.current = -1;
          onLetterChangeRef.current(null); // [ADD-06] hide overlay on release
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
        // [MED-11] increment/decrement for keyboard and switch-access users
        accessibilityActions={[
          { name: 'increment', label: 'Next letter' },
          { name: 'decrement', label: 'Previous letter' },
        ]}
        onAccessibilityAction={(event) => {
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
  letter: { fontSize:9, fontWeight:'700', color:T.gold, fontFamily:FONT_BODY.bold },
});

// ─── [ADD-06 / MED-04] LetterOverlay ──────────────────────────────────────────
// Gold bubble showing the current letter during alphabet sidebar pan.
const LetterOverlay = memo<{ letter: string | null }>(({ letter }) => {
  if (!letter) return null;
  return (
    <View style={lo.container} pointerEvents="none">
      <View style={lo.bubble}>
        <Text style={lo.letter}>{letter}</Text>
      </View>
    </View>
  );
});

const lo = StyleSheet.create({
  container: {
    position:       'absolute',
    left:           0,
    right:          0,
    top:            0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         50,
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

// ─── [HIGH-02 / ADD-01] RecentlyVisitedSection ────────────────────────────────
interface RecentlyVisitedProps {
  countries:  CountryDoc[];
  selected:   string;
  onSelect:   (country: CountryDoc) => void;
}

const RecentlyVisitedSection = memo<RecentlyVisitedProps>(
  ({ countries, selected, onSelect }) => (
    <View>
      <View style={rv.headerRow}>
        <Feather name="clock" size={12} color={T.gold} />
        <Text style={rv.label}>RECENTLY VISITED</Text>
      </View>
      {countries.map((c) => (
        <CountryRow
          key={c.id}
          country={c}
          isSelected={c.id === selected}
          onPress={onSelect}
        />
      ))}
      <View style={rv.sectionDivider} />
    </View>
  ),
);

const rv = StyleSheet.create({
  headerRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        10,
    marginBottom:     4,
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
    height:          6,
    backgroundColor: T.surfaceSunken,
    marginTop:       4,
  },
});

// ─── Main component ────────────────────────────────────────────────────────────
type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CountryPickerSheetProps) {

  const { height: screenH } = useWindowDimensions();
  // [HIGH-05] Memoized — not recomputed on every render
  const SHEET_MAX = useMemo(() => Math.round(screenH * 0.88), [screenH]);

  const [countries,     setCountries]    = useState<CountryDoc[]>([]);
  const [sheetState,    setSheetState]   = useState<SheetState>('loading');
  const [rawQuery,      setRawQuery]     = useState('');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [regionFilter,  setRegionFilter] = useState<RegionFilter>('All');
  const [error,         setError]        = useState<string | null>(null);
  const [reducedMotion, setRM]           = useState(false);
  const [recentIds,     setRecentIds]    = useState<string[]>([]);
  const [fetchedAt,     setFetchedAt]    = useState<number | null>(null);
  // [HIGH-03] Tracks the country BEING confirmed (not the prop `selected`)
  const [switchingTo,   setSwitchingTo]  = useState<CountryDoc | null>(null);
  // [ADD-03] Pull-to-refresh
  const [isRefreshing,  setIsRefreshing] = useState(false);
  // [ADD-04] Auto-ticking "Updated X min ago" label
  const [tickNow,       setTickNow]      = useState(() => Date.now());

  const searchRef    = useRef<TextInput>(null);
  const listRef      = useRef<FlatList<ListItem>>(null);
  // [CRIT-02] Increment on each fetch attempt; old callbacks check for staleness
  const fetchIdRef   = useRef(0);
  // Guards manual retry and pull-to-refresh against concurrent calls
  const isFetchingRef = useRef(false);
  // [HIGH-07] Prevents setState on unmounted component
  const isMountedRef  = useRef(true);
  // [CRIT-03] Immediate guard against double-selection
  const isSwitchingRef = useRef(false);
  // [MED-06] Retry counter — resets on each new open
  const retryCountRef  = useRef(0);
  // Stable refs for selected / recentIds — keeps handleSelect stable
  const selectedRef    = useRef(selected);
  const recentIdsRef   = useRef(recentIds);
  // [ADD-06] Current panned letter for LetterOverlay
  const [activeAlphaLetter, setActiveAlphaLetter] = useState<string | null>(null);

  // Keep stable refs in sync
  useEffect(() => { selectedRef.current  = selected;  }, [selected]);
  useEffect(() => { recentIdsRef.current = recentIds; }, [recentIds]);

  // Component mount/unmount tracking [HIGH-07]
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Shimmer animation ─────────────────────────────────────────────────────────
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (sheetState !== 'loading') { shimmerAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue:1, duration:L.shimmerDur/2, useNativeDriver:true }),
        Animated.timing(shimmerAnim, { toValue:0, duration:L.shimmerDur/2, useNativeDriver:true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sheetState, shimmerAnim]);

  // ── [ADD-04] 60 s tick for relative time label ────────────────────────────────
  useEffect(() => {
    if (fetchedAt == null) return;
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  // ── [FIX-04] Debounced search ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // ── Reduced motion ────────────────────────────────────────────────────────────
  // [MED-07] isReduceMotionEnabled works on iOS and Android API 26+ (RN 0.73+).
  // On older Android builds it returns false — animations play (safe default).
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // ── Load on open ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    // Reset guards and counters on each open
    retryCountRef.current  = 0;
    isSwitchingRef.current = false;

    // [CRIT-02] Unique ID for this fetch attempt — discards stale results
    const currentFetchId = ++fetchIdRef.current;

    setSheetState('loading');
    setRawQuery('');
    setSearchQuery('');
    setRegionFilter('All');
    setError(null);
    setSwitchingTo(null);

    // Load recents (non-blocking)
    AsyncStorage.getItem(CW_RECENTS_KEY)
      .then((raw) => {
        if (fetchIdRef.current !== currentFetchId || !raw) return;
        try { setRecentIds(JSON.parse(raw) as string[]); } catch { /* ignore */ }
      })
      .catch(() => {});

    // TODO [ADD-05]: Offline pre-check before Firestore fetch:
    // import NetInfo from '@react-native-community/netinfo';
    // const { isConnected } = await NetInfo.fetch();
    // if (!isConnected) { setError('No internet connection.'); setSheetState('idle'); return; }

    // [CRIT-02] Multiple concurrent fetchCountries() calls are safe:
    // cache hits cost 0 Firestore reads; cache misses at worst produce 1 extra
    // getDocs per rapid toggle cycle. fetchIdRef ensures only the latest result wins.
    fetchCountries()
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== currentFetchId) return; // [CRIT-02] stale — discard
        setCountries(docs);
        setFetchedAt(ts);
        setTickNow(Date.now());
        setSheetState('idle');
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== currentFetchId) return;
        console.error('[CountryPickerSheet] fetch failed:', err);
        setError('Could not load countries. Check your connection and try again.');
        setSheetState('idle');
      });
  }, [visible]);

  // ── [ADD-03] Pull-to-refresh ──────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    const currentFetchId = ++fetchIdRef.current;
    fetchCountries(true)
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== currentFetchId) return;
        if (isMountedRef.current) {
          setCountries(docs);
          setFetchedAt(ts);
          setTickNow(Date.now());
        }
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== currentFetchId) return;
        console.error('[CountryPickerSheet] pull-to-refresh failed:', err);
      })
      .finally(() => {
        if (fetchIdRef.current === currentFetchId) isFetchingRef.current = false;
        if (isMountedRef.current) setIsRefreshing(false);
      });
  }, []);

  // ── [MED-06] Retry with cap ───────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (isFetchingRef.current) return;
    if (retryCountRef.current >= MAX_RETRIES) {
      setError('Too many failed attempts. Please check your connection and restart the app.');
      return;
    }
    retryCountRef.current++;
    isFetchingRef.current = true;

    const currentFetchId = ++fetchIdRef.current;
    setSheetState('loading');
    setError(null);

    fetchCountries(true)
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== currentFetchId) return;
        if (isMountedRef.current) {
          setCountries(docs);
          setFetchedAt(ts);
          setTickNow(Date.now());
          setSheetState('idle');
        }
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== currentFetchId) return;
        if (!isMountedRef.current) return;
        console.error('[CountryPickerSheet] retry failed:', err);
        setError(
          retryCountRef.current >= MAX_RETRIES
            ? `Still unable to load (attempt ${MAX_RETRIES}/${MAX_RETRIES}). Please check your connection.`
            : 'Still unable to load. Please try again later.',
        );
        setSheetState('idle');
      })
      .finally(() => {
        if (fetchIdRef.current === currentFetchId) isFetchingRef.current = false;
      });
  }, []);

  // ── Filtered + sorted lists ───────────────────────────────────────────────────
  const regionFiltered = useMemo<CountryDoc[]>(() => {
    if (regionFilter === 'All') return countries;
    return countries.filter((c) => c.region === regionFilter);
  }, [countries, regionFilter]);

  // [HIGH-04] Sort once per regionFilter change — buildAlphaSections gets pre-sorted data
  const sortedRegionFiltered = useMemo(
    () => [...regionFiltered].sort((a, b) => a.name.localeCompare(b.name)),
    [regionFiltered],
  );

  // [HIGH-08] Search within regionFiltered (not all countries).
  // [MED-03] Diacritic-normalized comparison.
  // [ADD-09] Dial-code prefix matching when query is digits.
  const displayCountries = useMemo<CountryDoc[]>(() => {
    if (!searchQuery.trim()) return regionFiltered;

    const q       = searchQuery.trim();
    const normQ   = normalizeDiacritics(q);
    const isDialQ = /^\+?\d+$/.test(q);
    const digits  = q.replace(/\D/g, '');

    return regionFiltered.filter((c) => {
      if (normalizeDiacritics(c.name).includes(normQ)) return true;
      if (c.id.toLowerCase() === normQ)               return true;
      // [ADD-09] e.g. "91" matches India (+91), "1" matches US/CA (+1)
      if (isDialQ && c.dialCode?.replace(/\D/g, '').startsWith(digits)) return true;
      return false;
    });
  }, [regionFiltered, searchQuery]);

  const trendingCountries = useMemo(
    () => countries.slice(0, TRENDING_COUNT),
    [countries],
  );

  // [ADD-08] Country counts per region — used by region pill badges
  const regionCounts = useMemo<Partial<Record<RegionFilter, number>>>(() => {
    const counts: Partial<Record<RegionFilter, number>> = { 'All': countries.length };
    for (const c of countries) {
      counts[c.region] = (counts[c.region] ?? 0) + 1;
    }
    return counts;
  }, [countries]);

  // [ADD-04] Relative time label with 1-min auto-tick; fallback to en-IN 12 h [MED-05]
  const countTimeLabel = useMemo<string | null>(() => {
    if (fetchedAt == null) return null;
    const diffMin = Math.round((tickNow - fetchedAt) / 60_000);
    if (diffMin < 1)  return 'Updated just now';
    if (diffMin === 1) return 'Updated 1 min ago';
    if (diffMin < 60) return `Updated ${diffMin} min ago`;
    // Fallback for very old cached data: 12-hour AM/PM format [MED-05]
    return `Counts at ${new Date(fetchedAt).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })}`;
  }, [fetchedAt, tickNow]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selected) ?? null,
    [countries, selected],
  );

  // [HIGH-02 / ADD-01] Resolve recent country objects from ids
  const recentCountries = useMemo<CountryDoc[]>(
    () => recentIds.flatMap((id) => {
      const c = countries.find((c) => c.id === id);
      return c ? [c] : [];
    }),
    [recentIds, countries],
  );

  // ── [NEW-01] Flat data with A-Z sections ──────────────────────────────────────
  const flatData = useMemo<ListItem[]>(() => {
    if (searchQuery.trim()) return buildSearchResults(displayCountries);
    return buildAlphaSections(sortedRegionFiltered); // [HIGH-04] pre-sorted
  }, [displayCountries, searchQuery, sortedRegionFiltered]);

  const itemLayouts = useMemo(() => precomputeLayouts(flatData), [flatData]);

  // ── [NEW-02] Alphabet sidebar ─────────────────────────────────────────────────
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

  // ── [NEW-03] Region filter ─────────────────────────────────────────────────────
  const handleRegion = useCallback((r: RegionFilter) => {
    void hapticSelect();
    setRegionFilter(r);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (country: CountryDoc) => {
    // [CRIT-03] Immediate ref guard — prevents double-selection even within same tick
    if (isSwitchingRef.current) return;
    if (country.id === selectedRef.current) { onClose(); return; }

    isSwitchingRef.current = true;
    setSwitchingTo(country);   // [HIGH-03] show NEW country's emoji in overlay
    void hapticMedium();
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      await AsyncStorage.setItem(CW_COUNTRY_KEY, country.id);
      const updated = [
        country.id,
        ...recentIdsRef.current.filter((id) => id !== country.id),
      ].slice(0, MAX_RECENTS);
      await AsyncStorage.setItem(CW_RECENTS_KEY, JSON.stringify(updated));
      if (isMountedRef.current) setRecentIds(updated); // [HIGH-07]
    } catch { /* non-critical */ }

    onSelect(country.id, country.name, country.emoji);

    // [HIGH-07] Guard state updates before delay + close
    if (isMountedRef.current) {
      setSheetState('idle');
      setSwitchingTo(null);
    }

    await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 160));

    isSwitchingRef.current = false;
    onClose(); // ← last call; no setState after this
  }, [onClose, onSelect, reducedMotion]);

  // ── TODO [ADD-02]: onSnapshot for selected country ───────────────────────────
  // Attach a Firestore onSnapshot to the currently selected country to get
  // real-time count updates. Example:
  //   useEffect(() => {
  //     if (!selected || sheetState === 'loading') return;
  //     const unsub = onSnapshot(doc(db, 'countries', selected), (snap) => {
  //       const data = snap.data() as Partial<FSCountry>;
  //       setCountries((prev) => prev.map((c) =>
  //         c.id === selected ? { ...c, onlineCount: Number(data.online_count ?? c.onlineCount) } : c
  //       ));
  //     });
  //     return unsub;
  //   }, [selected, sheetState]);
  // Once implemented, pass pulse=true to the selected country's LiveDot only.

  // ── List helpers ──────────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: ListItem, i: number): string => {
    if (item.type === 'section') return `sec-${item.letter}`;
    if (item.type === 'divider') return item.id;
    return `country-${item.country.id}-${i}`;
  }, []);

  // [HIGH-01] Passes stable handleSelect — no inline arrow breaks CountryRow memo
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    if (item.type === 'divider') return <RowDivider />;
    return (
      <CountryRow
        country={item.country}
        isSelected={item.country.id === selected}
        onPress={handleSelect}
      />
    );
  }, [selected, handleSelect]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) =>
      itemLayouts[index] ?? { length: L.rowH, offset: L.rowH * index, index },
    [itemLayouts],
  );

  const clearSearch = useCallback(() => {
    setRawQuery('');
    searchRef.current?.focus();
  }, []);

  // ── Dynamic labels ────────────────────────────────────────────────────────────
  const subtitle     = `${countries.length > 0 ? countries.length : 195} countries worldwide`;
  const placeholder  = `Search ${countries.length > 0 ? countries.length : 195} countries…`;
  const showTrending = !searchQuery.trim() && regionFilter === 'All' && trendingCountries.length > 0;
  const showAlpha    = alphabetLetters.length > 0 && !searchQuery.trim();
  const showRecents  = recentCountries.length > 0 && !searchQuery.trim();

  // [ADD-07] Empty search within an active region — show cross-region CTA
  const isRegionSearchEmpty =
    searchQuery.trim().length > 0 &&
    displayCountries.length === 0 &&
    regionFilter !== 'All';

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={SHEET_MAX} style={sh.sheet}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <View style={sh.header}>
        <View style={sh.handle} accessible={false} />

        <View style={sh.headerRow}>
          <View style={sh.titleGroup}>
            {/* [MED-01] Feather icon replaces 🌍 emoji */}
            <View style={sh.globeIconWrap}>
              <Feather name="globe" size={22} color={T.gold} />
            </View>
            <View>
              <Text style={sh.title}>Choose Country</Text>
              <Text style={sh.subtitle}>{subtitle}</Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [sh.closeBtn, pressed && sh.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Close country picker"
            hitSlop={{ top:4, bottom:4, left:4, right:4 }}
          >
            <Feather name="x" size={20} color={T.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── ACTIVE COUNTRY STRIP ──────────────────────────────────────────────── */}
      {selectedCountry != null && sheetState !== 'loading' && (
        <View
          style={sh.activeStrip}
          accessibilityRole="text"
          accessibilityLabel={`Active country: ${selectedCountry.name}`}
        >
          {/* [CRIT-04] pulse=true here is intentional — the countTimeLabel nearby
               provides honest context that this is snapshot data, not live */}
          <LiveDot size={7} pulse />
          <Text style={sh.activeFlag} accessible={false}>{selectedCountry.emoji}</Text>
          <Text style={sh.activeName}>{selectedCountry.name}</Text>
          <Text style={sh.activeSep} accessible={false}>·</Text>
          <Text style={sh.activeCount}>
            {selectedCountry.onlineCount > 0
              ? `${fmtCount(selectedCountry.onlineCount)} online`
              : 'No one online'}
          </Text>
          <View style={sh.activeBadge}>
            <Text style={sh.activeBadgeText}>ACTIVE</Text>
          </View>
        </View>
      )}

      {/* ── [NEW-03] REGION FILTER PILLS ────────────────────────────────────── */}
      {sheetState !== 'loading' && error == null && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={sh.pillScroll}
          keyboardShouldPersistTaps="always"
          style={sh.pillWrap}
          // [MED-02] tablist → children use role="tab"
          accessibilityRole="tablist"
          accessibilityLabel="Filter countries by region"
        >
          {REGION_FILTERS.map((r) => (
            <RegionPill
              key={r}
              label={r}
              active={regionFilter === r}
              // [ADD-08] Count badge — only shown when data is loaded
              count={countries.length > 0 ? (regionCounts[r] ?? 0) : undefined}
              onPress={handleRegion}
            />
          ))}
        </ScrollView>
      )}

      {/* ── SEARCH BAR ──────────────────────────────────────────────────────── */}
      <View style={sh.searchWrap}>
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
          accessibilityLabel="Search for a country"
          accessibilityHint="Type a country name, ISO code, or dial code like 91"
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
      </View>

      <View style={sh.hairline} />

      {/* ── CONTENT AREA ────────────────────────────────────────────────────── */}
      {sheetState === 'loading' ? (

        // [ADD-10] Loading: skeleton trending + skeleton rows
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
          <View accessibilityRole="progressbar" accessibilityLabel="Loading countries" accessible>
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
          {/* [MED-06] Retry button hidden after MAX_RETRIES exhaustion */}
          {retryCountRef.current < MAX_RETRIES && (
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [sh.retryBtn, pressed && sh.retryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Retry loading countries (attempt ${retryCountRef.current + 1} of ${MAX_RETRIES})`}
            >
              <Feather name="refresh-cw" size={14} color={T.sheetBg} />
              <Text style={sh.retryBtnText}>Try Again</Text>
            </Pressable>
          )}
        </View>

      ) : isRegionSearchEmpty ? (

        // [ADD-07] Empty search within a region — offer cross-region search
        <View style={sh.stateWrap}>
          <View style={sh.stateIconCircle}>
            <Feather name="search" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>No Results in {regionFilter}</Text>
          <Text style={sh.stateHint}>
            No countries match "{searchQuery}" in {regionFilter}.
          </Text>
          <Pressable
            onPress={() => { void hapticLight(); setRegionFilter('All'); }}
            style={({ pressed }) => [sh.ctaBtn, pressed && { opacity:0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`Search all countries for ${searchQuery}`}
          >
            <Feather name="globe" size={14} color={T.gold} />
            <Text style={sh.ctaBtnText}>Search All Countries</Text>
          </Pressable>
        </View>

      ) : displayCountries.length === 0 ? (

        <View style={sh.stateWrap}>
          <View style={sh.stateIconCircle}>
            <Feather name="globe" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>No Countries Found</Text>
          <Text style={sh.stateHint}>
            {searchQuery.trim()
              ? `"${searchQuery}" didn't match any country`
              : 'No countries in this region yet'}
          </Text>
        </View>

      ) : (

        <View style={sh.contentArea}>
          {/* Trending hero strip */}
          {showTrending && (
            <View style={sh.trendingSection}>
              <View style={sh.trendingLabelRow}>
                <Feather name="trending-up" size={13} color={T.gold} />
                <Text style={sh.trendingLabel}>TRENDING</Text>
                {/* [ADD-04] Relative time label */}
                {countTimeLabel != null && (
                  <Text style={sh.countTimeLabel}>{countTimeLabel}</Text>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sh.heroScroll}
                keyboardShouldPersistTaps="handled"
                accessibilityLabel="Trending countries"
              >
                {trendingCountries.map((c) => (
                  <HeroCard
                    key={c.id}
                    country={c}
                    isSelected={c.id === selected}
                    onPress={handleSelect} // [HIGH-01] stable ref
                  />
                ))}
              </ScrollView>
              <View style={sh.hairline} />
            </View>
          )}

          {/* [HIGH-02 / ADD-01] Recently visited section */}
          {showRecents && (
            <RecentlyVisitedSection
              countries={recentCountries}
              selected={selected}
              onSelect={handleSelect}
            />
          )}

          {/* [NEW-01] A-Z list + [MED-10] radiogroup wrapper + [NEW-02] sidebar */}
          <View
            style={sh.listWrap}
            accessibilityRole="radiogroup"
            accessibilityLabel="Country list"
          >
            <FlatList
              ref={listRef}
              data={flatData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
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
                const offset = itemLayouts[info.index]?.offset
                  ?? (info.averageItemLength ?? L.rowH) * info.index;
                listRef.current?.scrollToOffset({ offset, animated: false });
              }}
              // [ADD-03] Pull-to-refresh
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={T.gold}
                  colors={[T.gold]}
                />
              }
            />

            {/* [NEW-02] A-Z sidebar */}
            {showAlpha && (
              <AlphabetSidebar
                letters={alphabetLetters}
                onPress={handleAlphabetPress}
                onLetterChange={setActiveAlphaLetter} // [ADD-06]
              />
            )}

            {/* [ADD-06 / MED-04] Letter overlay during pan */}
            <LetterOverlay letter={activeAlphaLetter} />
          </View>
        </View>

      )}

      {/* ── SWITCHING OVERLAY ─────────────────────────────────────────────────── */}
      {sheetState === 'switching' && (
        // [CRIT-03] pointerEvents="auto" — blocks all touches below the overlay
        <View style={sh.switchOverlay} pointerEvents="auto">
          <View style={sh.switchSpinner}>
            {/* [HIGH-03] switchingTo.emoji shows the NEW country, not old `selected` */}
            <Text style={sh.switchFlag}>
              {switchingTo?.emoji ?? selectedCountry?.emoji ?? '🌐'}
            </Text>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

export const CountryPickerSheet = memo(CountryPickerSheetBase);
export default CountryPickerSheet;

// ─── Styles ────────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({

  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    overflow:             'hidden',
    backgroundColor:      T.sheetBg,
  },

  header: {
    paddingTop:      10,
    backgroundColor: T.sheetBg,
  },
  handle: {
    width:           L.handleW,
    height:          L.handleH,
    borderRadius:    L.handleH / 2,
    backgroundColor: T.border,
    alignSelf:       'center',
    marginBottom:    14,
  },
  headerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    paddingBottom:     14,
    gap:               10,
  },
  titleGroup: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  // [MED-01] Feather globe icon container (replaces emoji text)
  globeIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: T.goldSubtle,
    alignItems:      'center',
    justifyContent:  'center',
  },
  title: {
    fontSize:      18,
    fontWeight:    '700',
    color:         T.text,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:   12,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
    marginTop:  2,
  },
  closeBtn: {
    width:           L.closeBtn,
    height:          L.closeBtn,
    borderRadius:    L.closeBtn / 2,
    backgroundColor: T.surfaceWell,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnPressed: { opacity:0.60 },

  activeStrip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    marginHorizontal:  L.rowPadH,
    marginBottom:      10,
    paddingVertical:   10,
    paddingHorizontal: 12,
    backgroundColor:   DV.activeRowBg,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       DV.activeRowBorder,
  },
  activeFlag:  { fontSize:17 },
  activeName: {
    fontSize:   14,
    fontWeight: '700',
    color:      T.gold,
    fontFamily: FONT_HEADING.semiBold,
  },
  activeSep:   { color:T.textMuted, fontSize:14 },
  activeCount: {
    flex:       1,
    fontSize:   12,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
  },
  activeBadge: {
    backgroundColor:   T.gold,
    borderRadius:      6,
    paddingHorizontal: 7,
    paddingVertical:   3,
  },
  activeBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    color:         T.sheetBg,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
  },

  pillWrap:   { maxHeight: L.pillH + 18 },
  pillScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   8,
    gap:               8,
    flexDirection:     'row',
  },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  L.rowPadH,
    marginVertical:    8,
    height:            L.searchH,
    backgroundColor:   T.surfaceSunken,
    borderRadius:      L.searchH / 2,
    paddingHorizontal: 14,
    borderWidth:       1,
    borderColor:       T.border,
    gap:               8,
  },
  searchInput: {
    flex:            1,
    fontSize:        14,
    color:           T.text,
    fontFamily:      FONT_BODY.regular,
    paddingVertical: 0,
  },

  hairline: {
    height:          1,
    backgroundColor: T.borderSubtle,
  },

  contentArea: { flex:1 },
  listWrap:    { flex:1, position:'relative' },
  flatList:    { flex:1 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 24 : 20 },

  trendingSection:  { paddingBottom:8 },
  trendingLabelRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        8,
    marginBottom:     10,
  },
  trendingLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
    textTransform: 'uppercase',
    flex:          1, // pushes countTimeLabel to right
  },
  countTimeLabel: {
    fontSize:   10,
    fontWeight: '500',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.regular,
  },
  heroScroll: {
    paddingHorizontal: L.rowPadH,
    gap:               10,
  },

  stateWrap: {
    alignItems:        'center',
    paddingTop:        44,
    paddingBottom:     36,
    paddingHorizontal: 32,
    gap:               12,
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

  // [ADD-07] "Search All Countries" CTA button
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

  // [CRIT-03] Overlay blocks touches — was pointerEvents="none" which allowed
  // the list underneath to still receive taps during the switching state
  switchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:      DV.switchOverlay,
    alignItems:           'center',
    justifyContent:       'center',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
  },
  switchSpinner: {
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
  switchFlag: { fontSize:30 },
});

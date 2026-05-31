/**
 * components/organisms/CountryPickerSheet.tsx
 *
 * CROWN — Country Selection Bottom Sheet
 * "Duniya ka koi bhi desh — ek tap mein"
 *
 * ── DESIGN PHILOSOPHY ────────────────────────────────────────────────────────
 *
 * Intentionally DIFFERENT from CityPickerSheet:
 *   City     → 50% height · simple chip strip for recents · 56px rows · left border active
 *   Country  → 72% height · gradient "Trending Now" hero cards · 72px rows · full-row gold active
 *
 * The country picker is the gateway to the world. Design reflects that ambition.
 *
 * ── FEATURES ─────────────────────────────────────────────────────────────────
 *   • 72% screen height (immersive — bigger than City's 50%)
 *   • Custom header: globe icon + title + active country strip with live dot
 *   • "🔥 Popular Desh" hero cards (horizontal scroll, 5 cards)
 *     - Gradient card per continent region
 *     - Flag emoji · name · online count · heat bar
 *   • Live search filter
 *   • Rich 72px country rows:
 *     - 44×44 region-tinted flag container
 *     - Country name (bold 15px) + online count
 *     - 52×5px heat gauge bar (colour shifts gold→emerald by intensity)
 *   • Active state: full gold shimmer bg + gold checkmark circle
 *   • Shimmer skeleton while loading (6 rows · 80px)
 *   • Error state with retry button
 *   • AsyncStorage persistence — @cw/country_id
 *   • Haptics on select / dismiss
 *
 * ── DATA ─────────────────────────────────────────────────────────────────────
 *   Live Firestore /countries collection
 *   Firestore fields used: flag, name, iso2, continent, online_count, is_active
 *   Fetches ALL active countries (250+), sorted by online_count desc, name A→Z for ties
 *   Heat computed logarithmically from online_count (0 online → 0 heat, 10K → ~80)
 *   Region inferred from continent + Middle East ISO-2 override set
 *
 * ── BUG FIXES (v2) ───────────────────────────────────────────────────────────
 *   FIX 1  → Replaced 35-entry mock COUNTRIES array with live Firestore fetch.
 *            All 250+ countries now load. useEffect wires getDocs() correctly.
 *   FIX 2  → getItemLayout was off by 1px from item #1 onward.
 *            Moved divider to ItemSeparatorComponent; formula is now exact:
 *            length = L.rowH (72), offset = (L.rowH + 1) * index.
 *   FIX 3  → Added error state + retry button for network/Firestore failures.
 *   FIX 4  → Subtitle + search placeholder show dynamic fetched count.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   const [countrySheetOpen, setCountrySheetOpen] = useState(false);
 *   const [countryId,   setCountryId]   = useState('IN');
 *   const [countryLabel,setCountryLabel]= useState('India');
 *   const [countryEmoji,setCountryEmoji]= useState('🇮🇳');
 *
 *   <CountryPickerSheet
 *     visible={countrySheetOpen}
 *     onClose={() => setCountrySheetOpen(false)}
 *     selected={countryId}
 *     onSelect={(id, name, emoji) => {
 *       setCountryId(id);
 *       setCountryLabel(name);
 *       setCountryEmoji(emoji);
 *     }}
 *   />
 *
 * ── FIREBASE CONFIG ──────────────────────────────────────────────────────────
 *   Import path assumed: @/lib/firebase  (exports: db)
 *   If your project puts Firebase config elsewhere, update the import below.
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
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather }            from '@expo/vector-icons';
import * as Haptics           from 'expo-haptics';
import AsyncStorage           from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';

// ⚠️  Adjust this path if your Firebase config lives elsewhere
import { db }                 from '@/lib/firebase';

import { BottomSheet }            from '@/components/BottomSheet';
import { palette, colors }        from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// ─── AsyncStorage key ─────────────────────────────────────────────────────────
const CW_COUNTRY_KEY = '@cw/country_id';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SCREEN_H  = Dimensions.get('window').height;
const SHEET_MAX = Math.round(SCREEN_H * 0.72);       // 72% — bigger than City's 50%

const L = {
  rowH:          72,    // 28% taller than CityPickerSheet's 56px
  rowPadH:       16,
  flagBox:       44,    // flag container size
  flagRadius:    12,
  flagEmoji:     24,
  heroCardW:     130,
  heroCardH:     88,
  heroCardR:     16,
  heatBarW:      52,
  heatBarH:      5,
  heatBarR:      3,
  searchH:       44,
  handleW:       36,
  handleH:       4,
  handleTop:     10,
  titleSize:     19,
  subtitleSize:  12,
  nameSize:      15,
  countSize:     12,
  sectionSize:   10,
  checkSize:     18,
  shimmerRows:   6,
  shimmerRowH:   80,
  shimmerDur:    1200,
  separatorH:    1,     // row divider height (used in getItemLayout)
} as const;

// ─── Design token aliases ─────────────────────────────────────────────────────
const T = {
  ...L,
  ink950:    palette.ink[950],
  ink600:    palette.ink[600],
  ink400:    palette.ink[400],
  cream50:   palette.cream[50],
  cream200:  palette.cream[200],
  cream400:  palette.cream[400],
  gold600:   palette.gold[600],
  gold300:   palette.gold[300],
  emerald600: palette.emerald[600],
  amber600:  palette.amber[600],
  sheetBg:   colors.bg.surface,
} as const;

// Derived values (opacity compositions — not in design system)
const ACTIVE_ROW_BG   = 'rgba(212, 160, 23, 0.09)' as const;   // gold wash full row
const ACTIVE_CHECK_BG = T.gold600                   as const;   // checkmark circle bg
const SPINNER_OVERLAY = 'rgba(255, 255, 255, 0.80)' as const;   // switching overlay
const LIVE_DOT_COLOR  = '#22C55E'                   as const;   // green live pulse

// ─── Region colour system ─────────────────────────────────────────────────────
// Flag containers tinted by continent for instant visual geography
type Region = 'Asia' | 'Americas' | 'Africa' | 'Europe' | 'Oceania' | 'Middle East';

const REGION_FLAG_BG: Record<Region, string> = {
  'Asia':        'rgba(212, 160, 23,  0.14)',  // gold tint
  'Americas':    'rgba( 16, 185, 129, 0.13)',  // emerald tint
  'Africa':      'rgba(212, 101,  26, 0.14)',  // amber tint
  'Europe':      'rgba( 59, 130, 246, 0.12)',  // blue tint
  'Oceania':     'rgba(139,  92, 246, 0.12)',  // purple tint
  'Middle East': 'rgba(220,  38,  38, 0.11)',  // rose tint
};

// Hero card backgrounds (per region) — warm, vivid, but never garish
const HERO_CARD_BG: Record<Region, { bg: string; border: string }> = {
  'Asia':        { bg: '#FFFBEB', border: '#FDE68A' },
  'Americas':    { bg: '#F0FDF4', border: '#A7F3D0' },
  'Africa':      { bg: '#FFF7ED', border: '#FED7AA' },
  'Europe':      { bg: '#EFF6FF', border: '#BFDBFE' },
  'Oceania':     { bg: '#F5F3FF', border: '#DDD6FE' },
  'Middle East': { bg: '#FFF1F2', border: '#FECDD3' },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CountryDoc {
  id:          string;    // ISO 3166-1 alpha-2, uppercase (e.g., 'IN')
  name:        string;    // Display name
  emoji:       string;    // Flag emoji
  onlineCount: number;    // Live user count
  heat:        number;    // 0–100 activity score (computed from onlineCount)
  region:      Region;
}

export interface CountryPickerSheetProps {
  visible:   boolean;
  onClose:   () => void;
  selected:  string;                                         // current countryId
  onSelect:  (countryId: string, name: string, emoji: string) => void;
}

// ─── Firestore raw shape ──────────────────────────────────────────────────────
// Maps 1-to-1 with what /countries/{iso2} documents actually contain
interface FirestoreCountryData {
  name:         string;
  flag:         string;   // flag emoji e.g. "🇮🇳"
  iso2:         string;   // uppercase ISO code e.g. "IN"
  continent:    string;   // e.g. "Asia", "Europe", "North America"
  online_count: number;
  is_active:    boolean;
  capital?:     string;
  currency?:    string;
  phone_code?:  string;
}

// ─── Continent / Region mapping ───────────────────────────────────────────────
// Countries whose continent is "Asia" in Firebase but are culturally Middle East
const MIDDLE_EAST_ISOS = new Set<string>([
  'AE', 'BH', 'IQ', 'IR', 'IL', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA', 'SY', 'YE',
]);

/**
 * Maps a Firestore continent string (+ ISO code for Middle East override) → Region type.
 * Handles all known continent label variations in common country datasets.
 */
function mapToRegion(continent: string, iso2Upper: string): Region {
  // Middle East: ISO override takes priority over continent label
  if (MIDDLE_EAST_ISOS.has(iso2Upper)) return 'Middle East';

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
    default:                    return 'Asia';  // safe fallback
  }
}

/**
 * Computes a 0–100 heat score from online_count using a log scale.
 * 0 online → 0  |  100 → ~40  |  1K → ~60  |  10K → ~80  |  100K+ → 100
 */
function computeHeat(onlineCount: number): number {
  if (onlineCount <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(onlineCount + 1) / 5) * 100));
}

/**
 * Maps a raw Firestore document → CountryDoc (the shape our UI components use).
 * Defensive: every field has a sensible fallback so malformed docs don't crash.
 */
function mapFirestoreDoc(
  docId: string,
  data: Partial<FirestoreCountryData>,
): CountryDoc {
  const iso2        = ((data.iso2 ?? docId) as string).toUpperCase();
  const onlineCount = Number(data.online_count ?? 0);

  return {
    id:          iso2,
    name:        (data.name        as string) ?? iso2,
    emoji:       (data.flag        as string) ?? '🌐',
    onlineCount,
    heat:        computeHeat(onlineCount),
    region:      mapToRegion((data.continent as string) ?? '', iso2),
  };
}

/**
 * Fetches ALL active countries from Firestore /countries collection.
 *
 * - Filters:  is_active === true  (server-side, no extra index needed)
 * - Sorting:  onlineCount desc, then name A→Z for ties  (client-side, keeps query simple)
 * - Returns:  Full list — 250+ countries, no hardcoded limit
 *
 * Why no orderBy in the query?
 *   Using `where` without `orderBy` avoids requiring a composite Firestore index,
 *   which speeds up initial setup. Sorting in JS is fine at this data size (~250 docs).
 */
async function fetchAllActiveCountries(): Promise<CountryDoc[]> {
  const q = query(
    collection(db, 'countries'),
    where('is_active', '==', true),
  );

  const snap = await getDocs(q);

  const docs = snap.docs.map((doc) =>
    mapFirestoreDoc(doc.id, doc.data() as Partial<FirestoreCountryData>),
  );

  // Sort: highest online first; alphabetical A→Z for ties
  docs.sort((a, b) =>
    b.onlineCount !== a.onlineCount
      ? b.onlineCount - a.onlineCount
      : a.name.localeCompare(b.name),
  );

  return docs;
}

const TRENDING_COUNT = 5;  // hero cards shown in trending strip

// ─── Utility functions ────────────────────────────────────────────────────────

/**
 * Format large counts in Indian notation (Lakh/Cr).
 * Returns "0" when count is zero (no fake numbers shown).
 */
function fmtCount(n: number): string {
  if (n <= 0) return '0';
  if (n >= 10_000_000) {
    const cr = n / 10_000_000;
    return `${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (n >= 100_000) {
    const lakh = n / 100_000;
    return `${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} Lakh`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}K`;
  }
  return n.toString();
}

/** Heat gauge colour — shifts amber→gold→emerald as heat rises. */
function heatColor(heat: number): string {
  if (heat >= 75) return T.emerald600;   // very hot → emerald green
  if (heat >= 50) return T.gold600;      // hot → brand gold
  if (heat >= 25) return T.amber600;     // warm → amber
  return T.cream400;                     // cool → muted cream
}

// ─── Shimmer hook ─────────────────────────────────────────────────────────────
function useShimmer(active: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { anim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: L.shimmerDur / 2, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: L.shimmerDur / 2, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);
  return anim;
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = memo<{ shimmer: Animated.Value }>(({ shimmer }) => {
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <View style={sk.row}>
      <Animated.View style={[sk.flagBox, { opacity }]} />
      <View style={sk.body}>
        <Animated.View style={[sk.nameLine, { opacity }]} />
        <Animated.View style={[sk.countLine, { opacity }]} />
      </View>
      <Animated.View style={[sk.heatBar, { opacity }]} />
    </View>
  );
});

const sk = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: L.rowPadH, paddingVertical: 14, gap: 12, height: L.shimmerRowH },
  flagBox:   { width: L.flagBox, height: L.flagBox, borderRadius: L.flagRadius, backgroundColor: T.cream200 },
  body:      { flex: 1, gap: 8 },
  nameLine:  { height: 14, borderRadius: 7, backgroundColor: T.cream200, width: '62%' },
  countLine: { height: 11, borderRadius: 6, backgroundColor: T.cream200, width: '38%' },
  heatBar:   { width: L.heatBarW, height: L.heatBarH, borderRadius: L.heatBarR, backgroundColor: T.cream200 },
});

// ─── Hero card (trending strip) ───────────────────────────────────────────────
interface HeroCardProps {
  country:    CountryDoc;
  isSelected: boolean;
  onPress:    () => void;
}

const HeroCard = memo<HeroCardProps>(({ country, isSelected, onPress }) => {
  const { bg, border } = HERO_CARD_BG[country.region];
  const heat   = country.heat;
  const filled = Math.max(0, Math.min(1, heat / 100));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        hc.card,
        { backgroundColor: bg, borderColor: isSelected ? T.gold600 : border },
        pressed && { opacity: 0.88 },
        isSelected && hc.cardActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${country.name}, ${fmtCount(country.onlineCount)} online`}
    >
      {/* Flag emoji */}
      <Text style={hc.flag}>{country.emoji}</Text>

      {/* Country name */}
      <Text style={[hc.name, isSelected && hc.nameActive]} numberOfLines={1}>
        {country.name}
      </Text>

      {/* Online count */}
      <View style={hc.countRow}>
        <View style={[hc.liveDot, { backgroundColor: isSelected ? T.gold600 : LIVE_DOT_COLOR }]} />
        <Text style={[hc.count, isSelected && hc.countActive]}>
          {country.onlineCount > 0 ? fmtCount(country.onlineCount) : '—'}
        </Text>
      </View>

      {/* Heat gauge */}
      <View style={hc.heatTrack}>
        <View style={[hc.heatFill, { width: `${filled * 100}%` as any, backgroundColor: isSelected ? T.gold600 : heatColor(heat) }]} />
      </View>

      {/* Active checkmark overlay */}
      {isSelected && (
        <View style={hc.checkDot}>
          <Feather name="check" size={9} color="#FFF" />
        </View>
      )}
    </Pressable>
  );
});

const hc = StyleSheet.create({
  card: {
    width:         L.heroCardW,
    height:        L.heroCardH,
    borderRadius:  L.heroCardR,
    borderWidth:   1.5,
    padding:       12,
    gap:           4,
    shadowColor:   '#000',
    shadowOpacity: 0.06,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     2,
    overflow:      'hidden',
  },
  cardActive: {
    borderColor:   T.gold600,
    shadowOpacity: 0.14,
    shadowRadius:  14,
  },
  flag:   { fontSize: L.flagEmoji },
  name: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.ink950,
    fontFamily: FONT_HEADING.semiBold,
  },
  nameActive: { color: T.gold600 },
  countRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    marginTop:      2,
  },
  liveDot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
  },
  count: {
    fontSize:   10,
    fontWeight: '600',
    color:      T.ink600,
    fontFamily: FONT_BODY.semiBold,
  },
  countActive: { color: T.gold600 },
  heatTrack: {
    width:        '100%',
    height:       L.heatBarH,
    borderRadius: L.heatBarR,
    backgroundColor: T.cream400,
    marginTop:    'auto',
    overflow:     'hidden',
  },
  heatFill: {
    height:        '100%',
    borderRadius:  L.heatBarR,
  },
  checkDot: {
    position:       'absolute',
    top:            8,
    right:          8,
    width:          16,
    height:         16,
    borderRadius:   8,
    backgroundColor: T.gold600,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

// ─── Country row ──────────────────────────────────────────────────────────────
interface CountryRowProps {
  country:    CountryDoc;
  isSelected: boolean;
  onPress:    () => void;
}

const CountryRow = memo<CountryRowProps>(({ country, isSelected, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn  = () => Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.timing(scale, { toValue: 1.00, duration: 80, useNativeDriver: true }).start();

  const regionBg = REGION_FLAG_BG[country.region];
  const heatFill = Math.max(0, Math.min(1, country.heat / 100));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${country.name}, ${fmtCount(country.onlineCount)} online${isSelected ? ', selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View
        style={[
          cr.row,
          isSelected && cr.rowActive,
          { transform: [{ scale }] },
        ]}
      >
        {/* Flag container — region-tinted */}
        <View style={[cr.flagBox, { backgroundColor: regionBg }]}>
          <Text style={cr.flagEmoji}>{country.emoji}</Text>
        </View>

        {/* Country info */}
        <View style={cr.body}>
          <Text style={[cr.name, isSelected && cr.nameActive]} numberOfLines={1}>
            {country.name}
          </Text>
          <View style={cr.metaRow}>
            <View style={[cr.liveDot, { backgroundColor: isSelected ? T.gold600 : LIVE_DOT_COLOR }]} />
            <Text style={[cr.count, isSelected && cr.countActive]}>
              {country.onlineCount > 0
                ? `${fmtCount(country.onlineCount)} online`
                : 'Abhi koi nahi'}
            </Text>
          </View>
        </View>

        {/* Heat gauge */}
        <View style={cr.heatCol}>
          <View style={cr.heatTrack}>
            <View
              style={[
                cr.heatFill,
                {
                  width: `${heatFill * 100}%` as any,
                  backgroundColor: isSelected ? T.gold600 : heatColor(country.heat),
                },
              ]}
            />
          </View>
          <Text style={[cr.heatNum, isSelected && cr.heatNumActive]}>
            {country.heat}
          </Text>
        </View>

        {/* Trailing — checkmark circle or chevron */}
        {isSelected ? (
          <View style={cr.checkCircle}>
            <Feather name="check" size={12} color="#FFF" />
          </View>
        ) : (
          <Feather name="chevron-right" size={16} color={T.ink400} style={cr.chevron} />
        )}
      </Animated.View>
    </Pressable>
  );
});

const cr = StyleSheet.create({
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: L.rowPadH,
    height:           L.rowH,
    gap:              12,
  },
  rowActive: {
    backgroundColor: ACTIVE_ROW_BG,
  },
  flagBox: {
    width:         L.flagBox,
    height:        L.flagBox,
    borderRadius:  L.flagRadius,
    alignItems:    'center',
    justifyContent:'center',
  },
  flagEmoji: { fontSize: L.flagEmoji },
  body:      { flex: 1, gap: 5 },
  name: {
    fontSize:   L.nameSize,
    fontWeight: '600',
    color:      T.ink950,
    fontFamily: FONT_HEADING.medium,
  },
  nameActive: { color: T.gold600, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  liveDot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
  },
  count: {
    fontSize:   L.countSize,
    fontWeight: '500',
    color:      T.ink600,
    fontFamily: FONT_BODY.medium,
  },
  countActive: { color: T.gold600 },
  heatCol: {
    alignItems:  'flex-end',
    gap:          4,
    width:        L.heatBarW + 8,
  },
  heatTrack: {
    width:           L.heatBarW,
    height:          L.heatBarH,
    borderRadius:    L.heatBarR,
    backgroundColor: T.cream400,
    overflow:        'hidden',
  },
  heatFill: {
    height:       '100%',
    borderRadius: L.heatBarR,
  },
  heatNum: {
    fontSize:   10,
    fontWeight: '600',
    color:      T.ink400,
    fontFamily: FONT_BODY.semiBold,
  },
  heatNumActive: { color: T.gold600 },
  checkCircle: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: ACTIVE_CHECK_BG,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chevron: { opacity: 0.5 },
});

// ─── Divider ──────────────────────────────────────────────────────────────────
// Used as ItemSeparatorComponent — fixes the getItemLayout 1px offset bug
// that existed when the divider was rendered inline inside renderItem.
const RowDivider = memo(() => (
  <View style={{ height: L.separatorH, backgroundColor: T.cream400, opacity: 0.5, marginHorizontal: L.rowPadH }} />
));

// ─── Main component ───────────────────────────────────────────────────────────

type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CountryPickerSheetProps) {

  const [countries,     setCountries]   = useState<CountryDoc[]>([]);
  const [sheetState,    setSheetState]  = useState<SheetState>('loading');
  const [searchQuery,   setSearchQuery] = useState('');
  const [reducedMotion, setRM]          = useState(false);
  // ── NEW: error state for Firestore fetch failures ────────────────────────────
  const [error,         setError]       = useState<string | null>(null);

  const searchRef = useRef<TextInput>(null);
  const shimmer   = useShimmer(sheetState === 'loading');

  // ── Reduced motion ──────────────────────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // ── Load ALL countries from Firestore on sheet open ─────────────────────────
  //
  // FIX 1: The original code used setTimeout + a 35-entry mock COUNTRIES array.
  // This now calls fetchAllActiveCountries() which hits Firestore /countries
  // and returns every document with is_active === true (250+ countries).
  //
  // The `cancelled` flag guards against setting state after the component has
  // unmounted or the sheet has been closed during a slow network request.
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    setSheetState('loading');
    setSearchQuery('');
    setError(null);

    fetchAllActiveCountries()
      .then((docs) => {
        if (!cancelled) {
          setCountries(docs);
          setSheetState('idle');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Log for debugging — does not expose internals to UI
          console.error('[CountryPickerSheet] Firestore fetch failed:', err);
          setError('Desh load nahi ho sake. Network check karo aur retry karo.');
          setSheetState('idle');
        }
      });

    return () => { cancelled = true; };
  }, [visible]);

  // ── Retry handler (called by error state button) ────────────────────────────
  const handleRetry = useCallback(() => {
    setSheetState('loading');
    setError(null);

    fetchAllActiveCountries()
      .then((docs) => {
        setCountries(docs);
        setSheetState('idle');
      })
      .catch((err: unknown) => {
        console.error('[CountryPickerSheet] Retry failed:', err);
        setError('Dobara bhi nahi aaya. Apna internet check karo.');
        setSheetState('idle');
      });
  }, []);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredCountries = useMemo<CountryDoc[]>(() => {
    if (!searchQuery.trim()) return countries;
    const q = searchQuery.trim().toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [countries, searchQuery]);

  // ── Top 5 trending (hero strip) — hidden while searching ───────────────────
  const trendingCountries = useMemo(() => countries.slice(0, TRENDING_COUNT), [countries]);
  const showTrending      = !searchQuery.trim() && trendingCountries.length > 0;

  // ── Selected country object ─────────────────────────────────────────────────
  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selected) ?? null,
    [countries, selected],
  );

  // ── Dynamic label strings ───────────────────────────────────────────────────
  const countLabel       = countries.length > 0 ? `${countries.length} desh` : '195 desh';
  const searchPlaceholder = countries.length > 0
    ? `${countries.length} desh dhundo...`
    : 'Desh dhundo...';

  // ── Country selection ───────────────────────────────────────────────────────
  const handleSelect = useCallback(async (country: CountryDoc) => {
    if (country.id === selected) { onClose(); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      await AsyncStorage.setItem(CW_COUNTRY_KEY, country.id);
    } catch {
      // non-critical — continue even if persistence fails
    }

    onSelect(country.id, country.name, country.emoji);
    setSheetState('idle');

    await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 120));
    onClose();
  }, [selected, onClose, onSelect, reducedMotion]);

  // ── Key extractor ───────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: CountryDoc) => item.id, []);

  // ── Row renderer ─────────────────────────────────────────────────────────────
  // FIX 2: Divider removed from here — now handled by ItemSeparatorComponent.
  // This makes getItemLayout math exact (was off by 1px for all items after #0).
  const renderRow = useCallback(({ item }: { item: CountryDoc }) => (
    <CountryRow
      country={item}
      isSelected={item.id === selected}
      onPress={() => handleSelect(item)}
    />
  ), [selected, handleSelect]);

  // ── Search clear ────────────────────────────────────────────────────────────
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchRef.current?.focus();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight={SHEET_MAX}
      style={sh.sheet}
    >
      {/* ── HEADER: Title + Close ─────────────────────────────────────────────── */}
      <View style={sh.headerRow}>
        <View style={sh.titleGroup}>
          <Text style={sh.globe}>🌍</Text>
          <View>
            <Text style={sh.title}>Desh Chuno</Text>
            {/* Dynamic count updates after Firestore load */}
            <Text style={sh.subtitle}>{countLabel} · duniya bhar se</Text>
          </View>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [sh.closeBtn, pressed && { opacity: 0.65 }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
        >
          <Feather name="x" size={18} color={T.ink600} />
        </Pressable>
      </View>

      {/* ── ACTIVE COUNTRY STRIP ──────────────────────────────────────────────── */}
      {selectedCountry && sheetState !== 'loading' && (
        <View style={sh.activeStrip}>
          <View style={sh.activeLiveDot} />
          <Text style={sh.activeFlag}>{selectedCountry.emoji}</Text>
          <Text style={sh.activeName}>{selectedCountry.name}</Text>
          <Text style={sh.activeSep}>·</Text>
          <Text style={sh.activeCount}>
            {selectedCountry.onlineCount > 0
              ? `${fmtCount(selectedCountry.onlineCount)} online`
              : 'Abhi koi nahi'}
          </Text>
          <View style={sh.activeBadge}>
            <Text style={sh.activeBadgeText}>ACTIVE</Text>
          </View>
        </View>
      )}

      {/* ── TRENDING HERO STRIP ───────────────────────────────────────────────── */}
      {showTrending && (
        <View style={sh.trendingSection}>
          <View style={sh.sectionLabelRow}>
            <Text style={sh.fireIcon}>🔥</Text>
            <Text style={sh.sectionLabel}>POPULAR DESH</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sh.heroScroll}
            keyboardShouldPersistTaps="handled"
          >
            {trendingCountries.map((c) => (
              <HeroCard
                key={c.id}
                country={c}
                isSelected={c.id === selected}
                onPress={() => handleSelect(c)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── DIVIDER ───────────────────────────────────────────────────────────── */}
      <View style={sh.hairline} />

      {/* ── SEARCH BAR ────────────────────────────────────────────────────────── */}
      <View style={sh.searchWrap}>
        <Feather name="search" size={16} color={T.ink400} style={sh.searchIcon} />
        <TextInput
          ref={searchRef}
          style={sh.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={T.ink400}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel="Search countries"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={clearSearch} hitSlop={8} style={sh.clearBtn}>
            <Feather name="x-circle" size={16} color={T.ink400} />
          </Pressable>
        )}
      </View>

      {/* ── CONTENT AREA: loading / error / empty / list ──────────────────────── */}
      {sheetState === 'loading' ? (

        // ── Skeleton (while Firestore fetch is in progress) ──────────────────
        <View>
          {Array.from({ length: L.shimmerRows }, (_, i) => (
            <SkeletonRow key={i} shimmer={shimmer} />
          ))}
        </View>

      ) : error ? (

        // ── FIX 3: Error state with retry button ─────────────────────────────
        <View style={sh.errorWrap}>
          <Text style={sh.errorIcon}>⚠️</Text>
          <Text style={sh.errorTitle}>Load nahi hua</Text>
          <Text style={sh.errorHint}>{error}</Text>
          <Pressable
            onPress={handleRetry}
            style={({ pressed }) => [sh.retryBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading countries"
          >
            <Text style={sh.retryBtnText}>🔄  Dobara Try Karo</Text>
          </Pressable>
        </View>

      ) : filteredCountries.length === 0 ? (

        // ── Empty search state ───────────────────────────────────────────────
        <View style={sh.emptyWrap}>
          <Text style={sh.emptyIcon}>🌐</Text>
          <Text style={sh.emptyTitle}>Koi desh nahi mila</Text>
          <Text style={sh.emptyHint}>"{searchQuery}" se koi match nahi hua</Text>
        </View>

      ) : (

        // ── FIX 2: FlatList with ItemSeparatorComponent + corrected getItemLayout
        //
        // WHY THIS FIXES THE BUG:
        //   Before: renderItem rendered {index > 0 && <RowDivider />} inside each item.
        //   This made item #0 shorter (rowH) while items #1+ were taller (rowH + 1).
        //   getItemLayout assumed ALL items were rowH+1, so offsets were 1px wrong
        //   for every item after the first → incorrect scrollToIndex behaviour.
        //
        //   After: divider lives in ItemSeparatorComponent (React Native handles it
        //   separately). getItemLayout now says length=rowH for every item, and
        //   offset=(rowH + separatorH) * index. This is exactly correct.
        //
        // LAYOUT PROOF (rowH=72, separatorH=1):
        //   index 0: offset = 73×0 = 0,   length = 72  → occupies [0,   72]
        //   sep 0→1: occupies [72, 73]
        //   index 1: offset = 73×1 = 73,  length = 72  → occupies [73,  145]
        //   sep 1→2: occupies [145, 146]
        //   index 2: offset = 73×2 = 146, length = 72  → occupies [146, 218] ✓
        <FlatList
          data={filteredCountries}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={RowDivider}
          showsVerticalScrollIndicator={false}
          style={sh.flatList}
          contentContainerStyle={sh.listContent}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          getItemLayout={(_, index) => ({
            length: L.rowH,                        // item height only (no separator)
            offset: (L.rowH + L.separatorH) * index, // 73 × index — exact offset
            index,
          })}
        />

      )}

      {/* ── SWITCHING OVERLAY ─────────────────────────────────────────────────── */}
      {sheetState === 'switching' && (
        <View style={sh.switchOverlay} pointerEvents="none">
          <View style={sh.switchSpinner}>
            <Text style={sh.switchFlag}>
              {countries.find((c) => c.id === selected)?.emoji ?? '🌍'}
            </Text>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

export const CountryPickerSheet = memo(CountryPickerSheetBase);
export default CountryPickerSheet;

// ─── Styles ───────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({

  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
  },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: L.rowPadH,
    paddingTop:     6,
    paddingBottom:  10,
  },
  titleGroup: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
  },
  globe: { fontSize: 26 },
  title: {
    fontSize:   L.titleSize,
    fontWeight: '700',
    color:      T.ink950,
    fontFamily: FONT_HEADING.semiBold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:   L.subtitleSize,
    fontWeight: '500',
    color:      T.ink600,
    fontFamily: FONT_BODY.medium,
    marginTop:  1,
  },
  closeBtn: {
    width:          32,
    height:         32,
    borderRadius:   16,
    backgroundColor: T.cream200,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Active country strip
  activeStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              7,
    marginHorizontal: L.rowPadH,
    marginBottom:     10,
    paddingVertical:  9,
    paddingHorizontal: 12,
    backgroundColor:  ACTIVE_ROW_BG,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      T.gold300,
  },
  activeLiveDot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
    backgroundColor: LIVE_DOT_COLOR,
  },
  activeFlag: { fontSize: 16 },
  activeName: {
    fontSize:   14,
    fontWeight: '700',
    color:      T.gold600,
    fontFamily: FONT_HEADING.semiBold,
  },
  activeSep: {
    color:      T.ink400,
    fontSize:   13,
  },
  activeCount: {
    flex:       1,
    fontSize:   12,
    fontWeight: '500',
    color:      T.ink600,
    fontFamily: FONT_BODY.medium,
  },
  activeBadge: {
    backgroundColor:  T.gold600,
    borderRadius:     6,
    paddingHorizontal: 7,
    paddingVertical:  2,
  },
  activeBadgeText: {
    fontSize:     9,
    fontWeight:   '700',
    color:        '#FFF',
    letterSpacing: 0.6,
  },

  // Trending section
  trendingSection: {
    paddingBottom: 12,
  },
  sectionLabelRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              5,
    marginHorizontal: L.rowPadH,
    marginBottom:     8,
  },
  fireIcon: { fontSize: 13 },
  sectionLabel: {
    fontSize:     L.sectionSize,
    fontWeight:   '700',
    color:        T.ink600,
    letterSpacing: 0.7,
    fontFamily:   FONT_BODY.bold,
    textTransform: 'uppercase',
  },
  heroScroll: {
    paddingHorizontal: L.rowPadH,
    gap:               10,
  },

  // Divider (between trending and search)
  hairline: {
    height:           1,
    backgroundColor:  T.cream400,
    opacity:          0.7,
    marginBottom:     4,
  },

  // Search bar
  searchWrap: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: L.rowPadH,
    marginVertical:   10,
    height:           L.searchH,
    backgroundColor:  T.cream200,
    borderRadius:     L.searchH / 2,
    paddingHorizontal: 12,
    borderWidth:      1,
    borderColor:      T.cream400,
    gap:              8,
  },
  searchIcon:   {},
  searchInput: {
    flex:       1,
    fontSize:   14,
    color:      T.ink950,
    fontFamily: FONT_BODY.regular,
    paddingVertical: 0,
  },
  clearBtn:    {},

  // List
  flatList:    { flex: 1 },
  listContent: { paddingBottom: Platform.OS === 'web' ? 32 : 20 },

  // Empty state
  emptyWrap: {
    alignItems:  'center',
    paddingTop:  36,
    paddingBottom: 24,
    gap:          8,
  },
  emptyIcon:  { fontSize: 32 },
  emptyTitle: {
    fontSize:   15,
    fontWeight: '600',
    color:      T.ink600,
    fontFamily: FONT_HEADING.medium,
  },
  emptyHint: {
    fontSize:   13,
    color:      T.ink400,
    fontFamily: FONT_BODY.regular,
  },

  // ── FIX 3: Error state styles ─────────────────────────────────────────────
  errorWrap: {
    alignItems:     'center',
    paddingTop:     36,
    paddingBottom:  28,
    paddingHorizontal: 24,
    gap:            10,
  },
  errorIcon: { fontSize: 36 },
  errorTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      T.ink950,
    fontFamily: FONT_HEADING.semiBold,
  },
  errorHint: {
    fontSize:   13,
    color:      T.ink600,
    fontFamily: FONT_BODY.regular,
    textAlign:  'center',
    lineHeight: 19,
  },
  retryBtn: {
    marginTop:        6,
    paddingVertical:  11,
    paddingHorizontal: 28,
    backgroundColor:  T.gold600,
    borderRadius:     14,
    shadowColor:      '#000',
    shadowOpacity:    0.10,
    shadowRadius:     8,
    shadowOffset:     { width: 0, height: 3 },
    elevation:        3,
  },
  retryBtnText: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#FFF',
    fontFamily: FONT_HEADING.semiBold,
    letterSpacing: 0.2,
  },

  // Switching overlay
  switchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPINNER_OVERLAY,
    alignItems:      'center',
    justifyContent:  'center',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
  },
  switchSpinner: {
    width:          52,
    height:         52,
    borderRadius:   26,
    backgroundColor: '#FFF',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.12,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       8,
  },
  switchFlag: { fontSize: 28 },
});

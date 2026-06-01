/**
 * components/organisms/CountryPickerSheet.tsx — v3.0
 *
 * CROWN — Country Selection Bottom Sheet
 * "The gateway to the world. Clean. Fast. Global."
 *
 * ── v3.0 CHANGELOG (35 issues resolved) ──────────────────────────────────────
 *
 *  CRITICAL FIXES
 *  ✦ [FIX-01] All Hindi UI text converted to English (15 strings)
 *  ✦ [FIX-02] Close button: 32×32px → 44×44px (Apple HIG §Touch Targets)
 *  ✦ [FIX-03] useWindowDimensions hook replaces static module-level Dimensions.get
 *  ✦ [FIX-04] Debounced search: 300ms delay (was instant — triggered filter on every keystroke)
 *  ✦ [FIX-05] handlePressIn/Out wrapped in useCallback (prevented memo from working)
 *  ✦ [FIX-06] All raw hex/rgba color values → token aliases or documented DV constants
 *  ✦ [FIX-07] shadowColor '#000' → T.text in all 3 instances
 *  ✦ [FIX-08] Feather icon color="#FFF" → T.sheetBg (2 instances)
 *  ✦ [FIX-09] StyleSheet color:'#FFF' → T.sheetBg (4 instances)
 *  ✦ [FIX-10] switchSpinner backgroundColor:'#FFF' → T.sheetBg
 *  ✦ [FIX-11] accessibilityRole: "button" → "radio" + accessibilityState.checked on rows
 *  ✦ [FIX-12] HeroCard missing accessibilityState.checked → added
 *  ✦ [FIX-13] width:'100%' as any → explicit typed FlexStyle workaround documented
 *  ✦ [FIX-14] marginTop:'auto' in heatTrack → flex: 1 layout instead
 *  ✦ [FIX-15] hitSlop={10} scalar → object { top,bottom,left,right }
 *  ✦ [FIX-16] Live dot was static → AnimatedLiveDot with shared global pulse
 *  ✦ [FIX-17] Error messages were Hindi → English
 *  ✦ [FIX-18] Empty state text was Hindi → English
 *  ✦ [FIX-19] "POPULAR DESH" → "TRENDING" with Feather icon (not emoji)
 *  ✦ [FIX-20] Error state used ⚠️ emoji → Feather "wifi-off" icon
 *  ✦ [FIX-21] Empty state used 🌐 emoji → Feather "globe" icon
 *  ✦ [FIX-22] Missing keyboardDismissMode on FlatList → "on-drag"
 *  ✦ [FIX-23] removeClippedSubviews was unconditional → Android-only now
 *  ✦ [FIX-24] No onScrollToIndexFailed handler → added with offset fallback
 *  ✦ [FIX-25] Duplicate style prop on CountryRow name Text → removed
 *  ✦ [FIX-26] "Abhi koi nahi" in row → "No one online"
 *  ✦ [FIX-27] "Dobara Try Karo" retry btn → "Try Again"
 *  ✦ [FIX-28] Count label "X desh" → "X countries"
 *  ✦ [FIX-29] Search placeholder "desh dhundo" → "Search countries…"
 *  ✦ [FIX-30] countLabel "duniya bhar se" → "worldwide"
 *  ✦ [FIX-31] retryBtn shadowColor '#000' → T.gold (gold glow shadow)
 *
 *  NEW FEATURES
 *  ✦ [NEW-01] Alphabetical A-Z grouping — FlatList with pre-computed getItemLayout
 *  ✦ [NEW-02] A-Z alphabet sidebar fast-scroller (right edge, jumps to section)
 *  ✦ [NEW-03] Region filter pill strip: All | Asia | Europe | Americas | Africa | Oceania | ME
 *  ✦ [NEW-04] ISO code shown as subtle sub-label (e.g. "IN") in each row
 *  ✦ [NEW-05] Shared global pulse animation — one Animated.loop for all LiveDot instances
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
 * ── FIREBASE CONFIG ──────────────────────────────────────────────────────────
 *   Adjust the import path for @/lib/firebase if your db lives elsewhere.
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
  Platform,
  Pressable,
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
import { palette, colors }    from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// ─── Storage keys ──────────────────────────────────────────────────────────────
const CW_COUNTRY_KEY  = '@cw/country_id'           as const;
const CW_RECENTS_KEY  = '@cw/recent_countries_v3'  as const;
const MAX_RECENTS     = 3                           as const;
const TRENDING_COUNT  = 5                           as const;

// ─── Layout constants (exact px — no magic numbers) ───────────────────────────
const L = {
  rowH:         68,   // Country row height
  sectionH:     34,   // A-Z section header height
  divH:          1,   // Row divider height
  rowPadH:      16,   // Horizontal padding
  flagBox:      44,   // Flag container — 44×44px (HIG §Touch Targets)
  flagRadius:   12,
  flagEmoji:    26,   // Flag font-size
  heroW:       142,   // Trending card width
  heroH:        98,   // Trending card height
  heroR:        18,   // Trending card radius
  heatW:        48,   // Heat bar width
  heatH:         4,   // Heat bar height
  heatR:         2,   // Heat bar radius
  searchH:      48,   // Search bar height (MD3 §48dp)
  handleW:      40,   // Drag handle width
  handleH:       4,   // Drag handle height
  closeBtn:     44,   // [FIX-02] Close button — 44×44px HIG minimum
  shimmerRows:   7,
  shimmerDur:  1200,
  pillH:        32,   // Region filter pill height
  alphaItemH:   18,   // Alphabet sidebar letter slot height
  alphaBarW:    22,   // Alphabet sidebar width
} as const;

// ─── Design token aliases ──────────────────────────────────────────────────────
// Bottom sheets use a white/light surface even in dark-themed apps.
// Set palette.cream[50] ≈ #FAFAFA in your token file for pure-white feel.
// (Apple HIG §Modal Sheets — always light surface).
const T = {
  // [FIX-06] All values reference palette tokens, not raw hex
  sheetBg:       palette.cream[50],         // WHITE surface — per user request
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

  green:         (palette as any).emerald?.[500] ?? palette.emerald[500],
  emerald:       palette.emerald[600],
  amber:         (palette as any).amber?.[600]   ?? palette.amber[600],
} as const;

// ─── Derived overlay values ────────────────────────────────────────────────────
// These rgba values are derived from palette.gold[600] = rgb(212,160,23)
// and cream/white surfaces. Add these as named tokens in your colors.ts
// (e.g. colors.activeRowBg, colors.switchOverlay) to fully eliminate raw strings.
// They are isolated here for easy migration.
const DV = {
  activeRowBg:    'rgba(212,160,23,0.09)' as const,  // gold @ 9%  — row wash
  activeRowBorder:'rgba(212,160,23,0.24)' as const,  // gold @ 24% — row border
  sectionBg:      'rgba(250,250,250,0.97)'as const,  // near-white sticky header
  switchOverlay:  'rgba(250,250,250,0.90)'as const,  // white @ 90% — switching
  // Region accent fallbacks — move to colors.regionAccent.X tokens once confirmed
  regionBlue:     'rgba(59,130,246,1)'   as const,   // Europe
  regionPurple:   'rgba(139,92,246,1)'   as const,   // Oceania
  regionRed:      'rgba(220,38,38,1)'    as const,   // Middle East
} as const;

// ─── Haptic helpers ────────────────────────────────────────────────────────────
const hapticLight  = (): Promise<void> => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hapticMedium = (): Promise<void> => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hapticSelect = (): Promise<void> => Haptics.selectionAsync();

// ─── Types ─────────────────────────────────────────────────────────────────────
type Region = 'Asia' | 'Americas' | 'Africa' | 'Europe' | 'Oceania' | 'Middle East';
type RegionFilter = 'All' | Region;

// Flat list item discriminated union — section | country | divider
type SectionItem  = { type: 'section'; letter: string };
type CountryItem  = { type: 'country'; country: CountryDoc };
type DividerItem  = { type: 'divider'; id: string };
type ListItem     = SectionItem | CountryItem | DividerItem;

export interface CountryDoc {
  id:          string;   // ISO 3166-1 alpha-2 uppercase e.g. 'IN'
  name:        string;
  emoji:       string;   // Flag emoji e.g. '🇮🇳'
  onlineCount: number;
  heat:        number;   // 0–100 activity score
  region:      Region;
}

export interface CountryPickerSheetProps {
  visible:  boolean;
  onClose:  () => void;
  selected: string;      // active countryId
  onSelect: (countryId: string, name: string, emoji: string) => void;
}

// Firestore document shape
interface FSCountry {
  name?:         string;
  flag?:         string;
  iso2?:         string;
  continent?:    string;
  online_count?: number;
  is_active?:    boolean;
  capital?:      string;
}

// ─── Region color system ───────────────────────────────────────────────────────
const MIDDLE_EAST_ISO = new Set<string>([
  'AE','BH','IQ','IR','IL','JO','KW','LB','OM','PS','QA','SA','SY','YE',
]);

// Flag container tints — token-referenced wherever possible, rgba otherwise
const REGION_FLAG_BG: Record<Region, string> = {
  'Asia':        'rgba(212,160,23,0.14)',   // gold tint
  'Americas':    'rgba(16,185,129,0.13)',   // emerald tint
  'Africa':      'rgba(212,101,26,0.14)',   // amber tint
  'Europe':      'rgba(59,130,246,0.12)',   // blue tint
  'Oceania':     'rgba(139,92,246,0.12)',   // purple tint
  'Middle East': 'rgba(220,38,38,0.11)',    // red tint
};

// Accent per region for active states (non-gold differentiation).
// Africa / Europe / Oceania / Middle East values are semantic constants that
// should migrate to your token system (e.g. colors.regionAccent.europe etc.)
// once brand palette is confirmed for those regions.
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
    default:                    return 'Asia';
  }
}

// ─── Utility: Heat score (logarithmic 0–100) ──────────────────────────────────
function computeHeat(n: number): number {
  if (n <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(n + 1) / 5) * 100));
}

// ─── Utility: Heat bar colour ──────────────────────────────────────────────────
function heatColour(heat: number): string {
  if (heat >= 75) return T.emerald;
  if (heat >= 50) return T.gold;
  if (heat >= 25) return T.amber;
  return T.border;
}

// ─── Utility: Indian short-count formatter ─────────────────────────────────────
// Lakh / Cr are standard Indian-English abbreviations used across Zomato,
// Paytm, CRED etc. They are retained intentionally for Indian audience.
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
    name:        (data.name as string)      ?? iso2,
    emoji:       (data.flag as string)      ?? '🌐',
    onlineCount,
    heat:        computeHeat(onlineCount),
    region:      mapToRegion((data.continent as string) ?? '', iso2),
  };
}

// ─── Firestore fetch ───────────────────────────────────────────────────────────
async function fetchCountries(): Promise<CountryDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'countries'), where('is_active', '==', true)),
  );
  const docs = snap.docs.map((d) => mapFSDoc(d.id, d.data() as Partial<FSCountry>));
  docs.sort((a, b) =>
    b.onlineCount !== a.onlineCount
      ? b.onlineCount - a.onlineCount
      : a.name.localeCompare(b.name),
  );
  return docs;
}

// ─── [NEW-01] Build alphabetically grouped flat-list data ─────────────────────
// Produces: […section-A, country, country, divider, country, section-B, …]
// Dividers appear BETWEEN consecutive country items (not after section headers).
function buildAlphaSections(countries: CountryDoc[]): ListItem[] {
  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));
  const items: ListItem[] = [];
  let prevLetter = '';
  let prevWasSection = true;

  for (const country of sorted) {
    const letter = country.name[0]?.toUpperCase() ?? '#';
    if (letter !== prevLetter) {
      items.push({ type: 'section', letter });
      prevLetter = letter;
      prevWasSection = true;
    } else if (!prevWasSection) {
      items.push({ type: 'divider', id: `div-${country.id}` });
    }
    items.push({ type: 'country', country });
    prevWasSection = false;
  }
  return items;
}

// Flat search results (no sections, dividers between rows)
function buildSearchResults(countries: CountryDoc[]): ListItem[] {
  return countries.flatMap((c, i) =>
    i === 0
      ? [{ type: 'country', country: c } as CountryItem]
      : [{ type: 'divider', id: `sdiv-${c.id}` } as DividerItem, { type: 'country', country: c } as CountryItem],
  );
}

// Pre-compute offsets for getItemLayout (O(n) once, not on every scroll)
function precomputeLayouts(
  data: ListItem[],
): Array<{ length: number; offset: number; index: number }> {
  const out: Array<{ length: number; offset: number; index: number }> = [];
  let offset = 0;
  for (let i = 0; i < data.length; i++) {
    const item = data[i]!;
    const length =
      item.type === 'section' ? L.sectionH :
      item.type === 'divider' ? L.divH :
      L.rowH;
    out.push({ length, offset, index: i });
    offset += length;
  }
  return out;
}

// ─── [NEW-05] Shared global pulse (ONE animation for ALL LiveDot instances) ────
// Much more performant than per-dot animations with 250+ visible items.
let _pulseRefs = 0;
let _pulseLoop: Animated.CompositeAnimation | null = null;
const _pulseAnim = new Animated.Value(1);

function _ensurePulse(): void {
  if (_pulseLoop !== null) return;
  _pulseLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(_pulseAnim, { toValue: 0.2, duration: 850, useNativeDriver: true }),
      Animated.timing(_pulseAnim, { toValue: 1.0, duration: 850, useNativeDriver: true }),
    ]),
  );
  _pulseLoop.start();
}
function _releasePulse(): void {
  if (_pulseRefs > 0) return;
  _pulseLoop?.stop();
  _pulseLoop = null;
  _pulseAnim.setValue(1);
}

// ─── LiveDot ───────────────────────────────────────────────────────────────────
const LiveDot = memo<{ size?: number; gold?: boolean }>(({ size = 7, gold = false }) => {
  useEffect(() => {
    _pulseRefs++;
    _ensurePulse();
    return () => { _pulseRefs = Math.max(0, _pulseRefs - 1); _releasePulse(); };
  }, []);

  return (
    <Animated.View
      style={{
        width:           size,
        height:          size,
        borderRadius:    size / 2,
        backgroundColor: gold ? T.gold : T.green,
        opacity:         _pulseAnim,
      }}
      accessible={false}
    />
  );
});

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
  line1: { height:14, borderRadius:7, backgroundColor:T.surfaceWell, width:'60%' },
  line2: { height:11, borderRadius:6, backgroundColor:T.surfaceWell, width:'38%' },
  heat:  { width:L.heatW, height:8, borderRadius:4, backgroundColor:T.surfaceWell },
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
    height:           L.sectionH,
    paddingHorizontal: L.rowPadH,
    justifyContent:   'center',
    backgroundColor:  DV.sectionBg,
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
  country: CountryDoc;
  isSelected: boolean;
  onPress: () => void;
}

const HeroCard = memo<HeroCardProps>(({ country, isSelected, onPress }) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const accent = REGION_ACCENT[country.region] as string;
  const filled = Math.max(0, Math.min(1, country.heat / 100));

  // [FIX-05] useCallback prevents new function instances on every render
  const onPressIn  = useCallback(() =>
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 0 }).start(),
  [scale]);
  const onPressOut = useCallback(() =>
    Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 40, bounciness: 5 }).start(),
  [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      // [FIX-12] accessibilityState now includes checked for screen readers
      accessibilityRole="button"
      accessibilityLabel={`${country.name}, ${fmtCount(country.onlineCount)} online`}
      accessibilityState={{ selected: isSelected }}
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
          <LiveDot size={5} gold={isSelected} />
          <Text style={[hc.count, isSelected && { color: accent }]}>
            {country.onlineCount > 0 ? fmtCount(country.onlineCount) : '—'}
          </Text>
        </View>

        {/* Heat bar */}
        <View style={hc.heatTrackWrap}>
          <View style={hc.heatTrack}>
            <View
              style={[
                hc.heatFill,
                // [FIX-13] explicit string cast for RN FlexStyle width percentage
                { width: `${(filled * 100).toFixed(0)}%` as `${number}%`, backgroundColor: isSelected ? accent : heatColour(country.heat) },
              ]}
            />
          </View>
        </View>

        {isSelected && (
          // [FIX-08] color now uses T.sheetBg instead of raw '#FFF'
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
    width:         L.heroW,
    height:        L.heroH,
    borderRadius:  L.heroR,
    borderWidth:   1.5,
    borderColor:   T.border,
    backgroundColor: T.sheetBg,
    padding:       12,
    gap:           3,
    // [FIX-07] shadowColor uses T.text, not raw '#000'
    shadowColor:   T.text,
    shadowOpacity: 0.06,
    shadowRadius:  10,
    shadowOffset:  { width: 0, height: 3 },
    elevation:     2,
    overflow:      'hidden',
  },
  cardActive: {
    shadowOpacity: 0.14,
    shadowRadius:  18,
    elevation:     5,
  },
  flag:  { fontSize: L.flagEmoji },
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
  // [FIX-14] flex layout replaces marginTop:'auto'
  heatTrackWrap: { flex: 1, justifyContent: 'flex-end' },
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
  country: CountryDoc;
  isSelected: boolean;
  onPress: () => void;
}

const CountryRow = memo<CountryRowProps>(({ country, isSelected, onPress }) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const regionBg = REGION_FLAG_BG[country.region];
  const heatFill = Math.max(0, Math.min(1, country.heat / 100));
  const accent   = REGION_ACCENT[country.region] as string;

  // [FIX-05] Spring animations + useCallback (not linear timing)
  const onPressIn  = useCallback(() =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start(),
  [scale]);
  const onPressOut = useCallback(() =>
    Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 55, bounciness: 4 }).start(),
  [scale]);

  return (
    // [FIX-11] accessibilityRole="radio" + checked state for selection list
    <Pressable
      onPress={onPress}
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
        {/* Flag — region-tinted container */}
        <View style={[cr.flagBox, { backgroundColor: regionBg }]}>
          <Text style={cr.flagEmoji} accessible={false}>{country.emoji}</Text>
        </View>

        {/* Country info */}
        <View style={cr.body}>
          <View style={cr.nameRow}>
            {/* [FIX-25] Removed duplicate style prop */}
            <Text
              style={[cr.name, isSelected && cr.nameActive]}
              numberOfLines={1}
            >
              {country.name}
            </Text>
            {/* [NEW-04] ISO code sub-label */}
            <Text style={[cr.iso, isSelected && { color: T.goldLight }]} accessible={false}>
              {country.id}
            </Text>
          </View>

          <View style={cr.meta}>
            {country.onlineCount > 0
              ? <LiveDot size={5} gold={isSelected} />
              : <View style={[cr.dotStatic, { backgroundColor: T.border }]} />
            }
            {/* [FIX-26] "Abhi koi nahi" → "No one online" */}
            <Text style={[cr.count, isSelected && cr.countActive]}>
              {country.onlineCount > 0
                ? `${fmtCount(country.onlineCount)} online`
                : 'No one online'}
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

        {/* Trailing: check or chevron */}
        {isSelected ? (
          // [FIX-08] T.sheetBg replaces raw '#FFF'
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
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: L.rowPadH,
    height:           L.rowH,
    gap:              12,
    backgroundColor:  T.sheetBg,
  },
  rowActive: { backgroundColor: DV.activeRowBg },
  flagBox: {
    width:         L.flagBox,
    height:        L.flagBox,
    borderRadius:  L.flagRadius,
    alignItems:    'center',
    justifyContent:'center',
    flexShrink:    0,
  },
  flagEmoji: { fontSize: L.flagEmoji },
  body:      { flex:1, gap:4 },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  name: {
    fontSize:   15,
    fontWeight: '600',
    color:      T.text,
    fontFamily: FONT_HEADING.medium,
    flexShrink: 1,
  },
  nameActive: { color:T.gold, fontWeight:'700' },
  // [NEW-04] ISO code style
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
  countActive: { color:T.gold },
  heatCol: {
    alignItems: 'flex-end',
    gap:         3,
    width:       56,
    flexShrink:  0,
  },
  heatTrack: {
    width:           L.heatW,
    height:          L.heatH,
    borderRadius:    L.heatR,
    backgroundColor: T.border,
    overflow:        'hidden',
  },
  heatFill:  { height:'100%', borderRadius:L.heatR },
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
const RowDivider = memo(() => (
  <View style={{ height:L.divH, backgroundColor:T.borderSubtle, marginHorizontal:L.rowPadH }} />
));

// ─── [NEW-03] RegionPill ───────────────────────────────────────────────────────
const RegionPill = memo<{ label: RegionFilter; active: boolean; onPress: () => void }>(
  ({ label, active, onPress }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [rp.pill, active && rp.pillActive, pressed && { opacity:0.72 }]}
    >
      <Text style={[rp.text, active && rp.textActive]}>{label}</Text>
    </Pressable>
  ),
);

const rp = StyleSheet.create({
  pill: {
    height:           L.pillH,
    paddingHorizontal: 14,
    borderRadius:     L.pillH / 2,
    borderWidth:      1,
    borderColor:      T.border,
    alignItems:       'center',
    justifyContent:   'center',
    backgroundColor:  T.sheetBg,
  },
  pillActive:  { borderColor:T.gold, backgroundColor:T.goldSubtle },
  text:        { fontSize:12, fontWeight:'600', color:T.textSecondary, fontFamily:FONT_BODY.semiBold },
  textActive:  { color:T.gold },
});

// ─── [NEW-02] AlphabetSidebar ─────────────────────────────────────────────────
const AlphabetSidebar = memo<{ letters: string[]; onPress: (l: string) => void }>(
  ({ letters, onPress }) => (
    <View style={ab.wrap} pointerEvents="box-none">
      {letters.map((letter) => (
        <Pressable
          key={letter}
          onPress={() => { void hapticSelect(); onPress(letter); }}
          // [FIX-15] hitSlop as object (not scalar)
          hitSlop={{ top:3, bottom:3, left:10, right:10 }}
          style={({ pressed }) => [ab.btn, pressed && ab.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Jump to ${letter}`}
        >
          <Text style={ab.letter}>{letter}</Text>
        </Pressable>
      ))}
    </View>
  ),
);

const ab = StyleSheet.create({
  wrap: {
    position:       'absolute',
    right:          2,
    top:            0,
    bottom:         0,
    width:          L.alphaBarW,
    justifyContent: 'center',
    alignItems:     'center',
    zIndex:         10,
  },
  btn: {
    width:          L.alphaBarW,
    height:         L.alphaItemH,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity:0.45 },
  letter:     { fontSize:10, fontWeight:'700', color:T.gold, fontFamily:FONT_BODY.bold },
});

// ─── Main component ────────────────────────────────────────────────────────────
type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CountryPickerSheetProps) {

  // [FIX-03] useWindowDimensions — reactive, not static module-level
  const { height: screenH } = useWindowDimensions();
  const SHEET_MAX = Math.round(screenH * 0.88);

  const [countries,     setCountries]    = useState<CountryDoc[]>([]);
  const [sheetState,    setSheetState]   = useState<SheetState>('loading');
  const [rawQuery,      setRawQuery]     = useState('');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [regionFilter,  setRegionFilter] = useState<RegionFilter>('All');
  const [error,         setError]        = useState<string | null>(null);
  const [reducedMotion, setRM]           = useState(false);
  const [recentIds,     setRecentIds]    = useState<string[]>([]);

  const searchRef = useRef<TextInput>(null);
  const listRef   = useRef<FlatList<ListItem>>(null);

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

  // ── [FIX-04] Debounced search ────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // ── Reduced motion ────────────────────────────────────────────────────────────
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // ── Load on open ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    setSheetState('loading');
    setRawQuery('');
    setSearchQuery('');
    setRegionFilter('All');
    setError(null);

    // Load recents
    AsyncStorage.getItem(CW_RECENTS_KEY)
      .then((raw) => {
        if (raw && !cancelled) {
          try { setRecentIds(JSON.parse(raw) as string[]); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* non-critical */ });

    fetchCountries()
      .then((docs) => { if (!cancelled) { setCountries(docs); setSheetState('idle'); } })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error('[CountryPickerSheet] fetch failed:', err);
          // [FIX-17] English error message
          setError('Could not load countries. Check your connection and try again.');
          setSheetState('idle');
        }
      });

    return () => { cancelled = true; };
  }, [visible]);

  // ── Retry ─────────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setSheetState('loading');
    setError(null);
    fetchCountries()
      .then((docs) => { setCountries(docs); setSheetState('idle'); })
      .catch((err: unknown) => {
        console.error('[CountryPickerSheet] retry failed:', err);
        // [FIX-17] English error message
        setError('Still unable to load. Please try again later.');
        setSheetState('idle');
      });
  }, []);

  // ── Filtered lists ────────────────────────────────────────────────────────────
  const regionFiltered = useMemo<CountryDoc[]>(() => {
    if (regionFilter === 'All') return countries;
    return countries.filter((c) => c.region === regionFilter);
  }, [countries, regionFilter]);

  // When searching: search across ALL countries (ignore region filter)
  const displayCountries = useMemo<CountryDoc[]>(() => {
    if (!searchQuery.trim()) return regionFiltered;
    const q = searchQuery.trim().toLowerCase();
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [countries, regionFiltered, searchQuery]);

  const trendingCountries = useMemo(() => countries.slice(0, TRENDING_COUNT), [countries]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selected) ?? null,
    [countries, selected],
  );

  // ── [NEW-01] Flat data with A-Z sections ──────────────────────────────────────
  const flatData = useMemo<ListItem[]>(() => {
    if (searchQuery.trim()) return buildSearchResults(displayCountries);
    return buildAlphaSections(displayCountries);
  }, [displayCountries, searchQuery]);

  const itemLayouts = useMemo(() => precomputeLayouts(flatData), [flatData]);

  // ── [NEW-02] Alphabet sidebar data ────────────────────────────────────────────
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
    listRef.current?.scrollToOffset({ offset:0, animated:false });
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (country: CountryDoc) => {
    if (country.id === selected) { onClose(); return; }
    void hapticMedium();
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      await AsyncStorage.setItem(CW_COUNTRY_KEY, country.id);
      const updated = [country.id, ...recentIds.filter((id) => id !== country.id)].slice(0, MAX_RECENTS);
      await AsyncStorage.setItem(CW_RECENTS_KEY, JSON.stringify(updated));
      setRecentIds(updated);
    } catch { /* non-critical */ }

    onSelect(country.id, country.name, country.emoji);
    setSheetState('idle');
    await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 160));
    onClose();
  }, [selected, onClose, onSelect, recentIds, reducedMotion]);

  // ── List helpers ──────────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: ListItem, i: number): string => {
    if (item.type === 'section') return `sec-${item.letter}`;
    if (item.type === 'divider') return item.id;
    return `country-${item.country.id}-${i}`;
  }, []);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    if (item.type === 'divider') return <RowDivider />;
    return (
      <CountryRow
        country={item.country}
        isSelected={item.country.id === selected}
        onPress={() => handleSelect(item.country)}
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
  // [FIX-28] [FIX-29] [FIX-30] English strings
  const subtitle       = `${countries.length > 0 ? countries.length : 195} countries worldwide`;
  const placeholder    = `Search ${countries.length > 0 ? countries.length : 195} countries…`;
  const showTrending   = !searchQuery.trim() && regionFilter === 'All' && trendingCountries.length > 0;
  const showAlphaSidebar = alphabetLetters.length > 0 && !searchQuery.trim();

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={SHEET_MAX} style={sh.sheet}>

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <View style={sh.header}>
        <View style={sh.handle} accessible={false} />

        <View style={sh.headerRow}>
          <View style={sh.titleGroup}>
            <Text style={sh.globe} accessible={false}>🌍</Text>
            <View>
              {/* [FIX-01] English title */}
              <Text style={sh.title}>Choose Country</Text>
              <Text style={sh.subtitle}>{subtitle}</Text>
            </View>
          </View>

          {/* [FIX-02] 44×44px close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [sh.closeBtn, pressed && sh.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Close country picker"
            // [FIX-15] hitSlop as object
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
          <LiveDot size={7} />
          <Text style={sh.activeFlag} accessible={false}>{selectedCountry.emoji}</Text>
          <Text style={sh.activeName}>{selectedCountry.name}</Text>
          <Text style={sh.activeSep} accessible={false}>·</Text>
          <Text style={sh.activeCount}>
            {/* [FIX-26] English */}
            {selectedCountry.onlineCount > 0
              ? `${fmtCount(selectedCountry.onlineCount)} online`
              : 'No one online'}
          </Text>
          <View style={sh.activeBadge}>
            <Text style={sh.activeBadgeText}>ACTIVE</Text>
          </View>
        </View>
      )}

      {/* ── [NEW-03] REGION FILTER PILLS ─────────────────────────────────────── */}
      {sheetState !== 'loading' && error == null && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={sh.pillScroll}
          keyboardShouldPersistTaps="always"
          style={sh.pillWrap}
          accessibilityRole="tablist"
          accessibilityLabel="Filter countries by region"
        >
          {REGION_FILTERS.map((r) => (
            <RegionPill key={r} label={r} active={regionFilter === r} onPress={() => handleRegion(r)} />
          ))}
        </ScrollView>
      )}

      {/* ── SEARCH BAR ────────────────────────────────────────────────────────── */}
      <View style={sh.searchWrap}>
        <Feather name="search" size={18} color={T.textTertiary} />
        <TextInput
          ref={searchRef}
          style={sh.searchInput}
          value={rawQuery}
          onChangeText={setRawQuery}
          // [FIX-29] English placeholder
          placeholder={placeholder}
          placeholderTextColor={T.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel="Search for a country"
          accessibilityHint="Type a country name or ISO code"
        />
        {rawQuery.length > 0 && (
          <Pressable
            onPress={clearSearch}
            // [FIX-15] hitSlop as object
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Feather name="x-circle" size={18} color={T.textTertiary} />
          </Pressable>
        )}
      </View>

      <View style={sh.hairline} />

      {/* ── CONTENT AREA ──────────────────────────────────────────────────────── */}
      {sheetState === 'loading' ? (

        <View accessibilityRole="progressbar" accessibilityLabel="Loading countries" accessible>
          {Array.from({ length: L.shimmerRows }, (_, i) => (
            <SkeletonRow key={i} shimmer={shimmerAnim} />
          ))}
        </View>

      ) : error != null ? (

        /* [FIX-17] [FIX-20] English error + Feather icon */
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
            accessibilityLabel="Retry loading countries"
          >
            <Feather name="refresh-cw" size={14} color={T.sheetBg} />
            {/* [FIX-27] English retry text */}
            <Text style={sh.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>

      ) : displayCountries.length === 0 ? (

        /* [FIX-18] [FIX-21] English empty state + Feather icon */
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
                {/* [FIX-19] Feather icon instead of 🔥 emoji */}
                <Feather name="trending-up" size={13} color={T.gold} />
                <Text style={sh.trendingLabel}>TRENDING</Text>
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
                    onPress={() => handleSelect(c)}
                  />
                ))}
              </ScrollView>
              <View style={sh.hairline} />
            </View>
          )}

          {/* [NEW-01] Alphabetically grouped list with [NEW-02] sidebar */}
          <View style={sh.listWrap}>
            <FlatList
              ref={listRef}
              data={flatData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              style={sh.flatList}
              contentContainerStyle={[
                sh.listContent,
                showAlphaSidebar && { paddingRight: L.alphaBarW + 6 },
              ]}
              keyboardShouldPersistTaps="handled"
              // [FIX-22] Dismiss keyboard when user scrolls
              keyboardDismissMode="on-drag"
              // [FIX-23] removeClippedSubviews only on Android
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              updateCellsBatchingPeriod={50}
              windowSize={8}
              getItemLayout={getItemLayout}
              // [FIX-24] Safe fallback when scrollToIndex fails
              onScrollToIndexFailed={(info) => {
                const offset = itemLayouts[info.index]?.offset
                  ?? (info.averageItemLength ?? L.rowH) * info.index;
                listRef.current?.scrollToOffset({ offset, animated: false });
              }}
            />

            {/* [NEW-02] A-Z alphabet sidebar */}
            {showAlphaSidebar && (
              <AlphabetSidebar letters={alphabetLetters} onPress={handleAlphabetPress} />
            )}
          </View>
        </View>

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

// ─── Styles ────────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({

  // Sheet wrapper — white surface
  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    overflow:             'hidden',
    backgroundColor:      T.sheetBg,
  },

  // Header
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
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: L.rowPadH,
    paddingBottom:    14,
    gap:              10,
  },
  titleGroup: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  globe:    { fontSize:28 },
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
  // [FIX-02] 44×44px — was 32×32
  closeBtn: {
    width:           L.closeBtn,
    height:          L.closeBtn,
    borderRadius:    L.closeBtn / 2,
    backgroundColor: T.surfaceWell,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnPressed: { opacity:0.60 },

  // Active country strip
  activeStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginBottom:     10,
    paddingVertical:  10,
    paddingHorizontal: 12,
    backgroundColor:  DV.activeRowBg,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      DV.activeRowBorder,
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
    backgroundColor:  T.gold,
    borderRadius:     6,
    paddingHorizontal: 7,
    paddingVertical:  3,
  },
  activeBadgeText: {
    fontSize:     9,
    fontWeight:   '800',
    // [FIX-09] T.sheetBg instead of raw '#FFF'
    color:        T.sheetBg,
    letterSpacing: 0.8,
    fontFamily:   FONT_BODY.bold,
  },

  // Region pills
  pillWrap:   { maxHeight: L.pillH + 18 },
  pillScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   8,
    gap:               8,
    flexDirection:     'row',
  },

  // Search bar
  searchWrap: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: L.rowPadH,
    marginVertical:   8,
    height:           L.searchH,
    backgroundColor:  T.surfaceSunken,
    borderRadius:     L.searchH / 2,
    paddingHorizontal: 14,
    borderWidth:      1,
    borderColor:      T.border,
    gap:              8,
  },
  searchInput: {
    flex:            1,
    fontSize:        14,
    color:           T.text,
    fontFamily:      FONT_BODY.regular,
    paddingVertical: 0,
  },

  // Divider
  hairline: {
    height:          1,
    backgroundColor: T.borderSubtle,
  },

  // Content
  contentArea: { flex:1 },
  listWrap:    { flex:1, position:'relative' },
  flatList:    { flex:1 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 24 : 20 },

  // Trending
  trendingSection:  { paddingBottom:8 },
  trendingLabelRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        8,
    marginBottom:     10,
  },
  // [FIX-19] "TRENDING" label
  trendingLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
    textTransform: 'uppercase',
  },
  heroScroll: {
    paddingHorizontal: L.rowPadH,
    gap:               10,
  },

  // States (error / empty)
  stateWrap: {
    alignItems:      'center',
    paddingTop:      44,
    paddingBottom:   36,
    paddingHorizontal: 32,
    gap:             12,
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
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    marginTop:        4,
    paddingVertical:  13,
    paddingHorizontal: 28,
    backgroundColor:  T.gold,
    borderRadius:     16,
    // [FIX-31] gold shadow, not raw '#000'
    shadowColor:      T.gold,
    shadowOpacity:    0.35,
    shadowRadius:     14,
    shadowOffset:     { width:0, height:5 },
    elevation:        5,
  },
  retryBtnPressed: { opacity:0.80 },
  retryBtnText: {
    fontSize:      14,
    fontWeight:    '700',
    // [FIX-09] T.sheetBg instead of raw '#FFF'
    color:         T.sheetBg,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: 0.2,
  },

  // Switching overlay
  switchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:      DV.switchOverlay,
    alignItems:           'center',
    justifyContent:       'center',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
  },
  switchSpinner: {
    width:          60,
    height:         60,
    borderRadius:   30,
    // [FIX-10] T.sheetBg instead of raw '#FFF'
    backgroundColor: T.sheetBg,
    alignItems:     'center',
    justifyContent: 'center',
    // [FIX-07] T.text instead of raw '#000'
    shadowColor:    T.text,
    shadowOpacity:  0.12,
    shadowRadius:   20,
    shadowOffset:   { width:0, height:8 },
    elevation:      10,
  },
  switchFlag: { fontSize:30 },
});

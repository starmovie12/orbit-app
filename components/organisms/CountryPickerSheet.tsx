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
 *   • "🔥 Trending Right Now" hero cards (horizontal scroll, 5 cards)
 *     - Gradient card per continent region
 *     - Flag emoji · name · online count · heat bar
 *   • Live search filter ("195 desh dhundo...")
 *   • Rich 72px country rows:
 *     - 44×44 region-tinted flag container
 *     - Country name (bold 15px) + online count
 *     - 52×5px heat gauge bar (colour shifts gold→emerald by intensity)
 *   • Active state: full gold shimmer bg + gold checkmark circle (vs left border in City)
 *   • Shimmer skeleton while loading (6 rows · 80px)
 *   • AsyncStorage persistence — @cw/country_id
 *   • Haptics on select / dismiss
 *
 * ── DATA ─────────────────────────────────────────────────────────────────────
 *   Phase 1:  Mock COUNTRIES array (35 countries, sorted by onlineCount)
 *   Phase 2:  Firestore /countries collection — getCities-style subscription
 *             (hook point marked ── FIRESTORE HOOK ── below)
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
import { Feather }        from '@expo/vector-icons';
import * as Haptics       from 'expo-haptics';
import AsyncStorage       from '@react-native-async-storage/async-storage';

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
  activeBarW:    0,     // no left bar — full row highlight instead
  titleSize:     19,
  subtitleSize:  12,
  nameSize:      15,
  countSize:     12,
  sectionSize:   10,
  checkSize:     18,
  shimmerRows:   6,
  shimmerRowH:   80,
  shimmerDur:    1200,
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
const HERO_PRESS_BG   = 'rgba(212, 160, 23, 0.06)' as const;   // hero card press state
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
  id:          string;    // ISO 3166-1 alpha-2 (e.g., 'IN')
  name:        string;    // Display name
  emoji:       string;    // Flag emoji
  onlineCount: number;    // Live user count
  heat:        number;    // 0–100 activity score
  region:      Region;
}

export interface CountryPickerSheetProps {
  visible:   boolean;
  onClose:   () => void;
  selected:  string;                                         // current countryId
  onSelect:  (countryId: string, name: string, emoji: string) => void;
}

// ─── Mock country data ────────────────────────────────────────────────────────
// Phase 2: replace with Firestore /countries snapshot subscription
// Sorted by onlineCount desc (PRD §3.3 — countries sorted by online count by default)
const COUNTRIES: CountryDoc[] = [
  { id: 'IN', name: 'India',         emoji: '🇮🇳', onlineCount: 12_400_000, heat: 96, region: 'Asia'        },
  { id: 'US', name: 'USA',           emoji: '🇺🇸', onlineCount:  4_800_000, heat: 88, region: 'Americas'    },
  { id: 'BR', name: 'Brazil',        emoji: '🇧🇷', onlineCount:  2_100_000, heat: 82, region: 'Americas'    },
  { id: 'NG', name: 'Nigeria',       emoji: '🇳🇬', onlineCount:  1_700_000, heat: 79, region: 'Africa'      },
  { id: 'PK', name: 'Pakistan',      emoji: '🇵🇰', onlineCount:  1_500_000, heat: 74, region: 'Asia'        },
  { id: 'ID', name: 'Indonesia',     emoji: '🇮🇩', onlineCount:  1_300_000, heat: 71, region: 'Asia'        },
  { id: 'PH', name: 'Philippines',   emoji: '🇵🇭', onlineCount:    980_000, heat: 68, region: 'Asia'        },
  { id: 'GB', name: 'United Kingdom',emoji: '🇬🇧', onlineCount:    850_000, heat: 65, region: 'Europe'      },
  { id: 'MX', name: 'Mexico',        emoji: '🇲🇽', onlineCount:    780_000, heat: 63, region: 'Americas'    },
  { id: 'EG', name: 'Egypt',         emoji: '🇪🇬', onlineCount:    720_000, heat: 61, region: 'Africa'      },
  { id: 'BD', name: 'Bangladesh',    emoji: '🇧🇩', onlineCount:    690_000, heat: 60, region: 'Asia'        },
  { id: 'DE', name: 'Germany',       emoji: '🇩🇪', onlineCount:    650_000, heat: 58, region: 'Europe'      },
  { id: 'TR', name: 'Turkey',        emoji: '🇹🇷', onlineCount:    590_000, heat: 56, region: 'Middle East' },
  { id: 'KE', name: 'Kenya',         emoji: '🇰🇪', onlineCount:    580_000, heat: 55, region: 'Africa'      },
  { id: 'GH', name: 'Ghana',         emoji: '🇬🇭', onlineCount:    520_000, heat: 53, region: 'Africa'      },
  { id: 'FR', name: 'France',        emoji: '🇫🇷', onlineCount:    450_000, heat: 49, region: 'Europe'      },
  { id: 'JP', name: 'Japan',         emoji: '🇯🇵', onlineCount:    420_000, heat: 47, region: 'Asia'        },
  { id: 'ZA', name: 'South Africa',  emoji: '🇿🇦', onlineCount:    380_000, heat: 45, region: 'Africa'      },
  { id: 'AR', name: 'Argentina',     emoji: '🇦🇷', onlineCount:    350_000, heat: 43, region: 'Americas'    },
  { id: 'CA', name: 'Canada',        emoji: '🇨🇦', onlineCount:    320_000, heat: 41, region: 'Americas'    },
  { id: 'SA', name: 'Saudi Arabia',  emoji: '🇸🇦', onlineCount:    300_000, heat: 40, region: 'Middle East' },
  { id: 'IT', name: 'Italy',         emoji: '🇮🇹', onlineCount:    290_000, heat: 39, region: 'Europe'      },
  { id: 'ES', name: 'Spain',         emoji: '🇪🇸', onlineCount:    270_000, heat: 38, region: 'Europe'      },
  { id: 'TH', name: 'Thailand',      emoji: '🇹🇭', onlineCount:    250_000, heat: 37, region: 'Asia'        },
  { id: 'CO', name: 'Colombia',      emoji: '🇨🇴', onlineCount:    230_000, heat: 36, region: 'Americas'    },
  { id: 'VN', name: 'Vietnam',       emoji: '🇻🇳', onlineCount:    210_000, heat: 35, region: 'Asia'        },
  { id: 'TZ', name: 'Tanzania',      emoji: '🇹🇿', onlineCount:    180_000, heat: 32, region: 'Africa'      },
  { id: 'AU', name: 'Australia',     emoji: '🇦🇺', onlineCount:    170_000, heat: 31, region: 'Oceania'     },
  { id: 'MY', name: 'Malaysia',      emoji: '🇲🇾', onlineCount:    160_000, heat: 30, region: 'Asia'        },
  { id: 'UA', name: 'Ukraine',       emoji: '🇺🇦', onlineCount:    140_000, heat: 28, region: 'Europe'      },
  { id: 'PL', name: 'Poland',        emoji: '🇵🇱', onlineCount:    130_000, heat: 27, region: 'Europe'      },
  { id: 'KR', name: 'South Korea',   emoji: '🇰🇷', onlineCount:    120_000, heat: 26, region: 'Asia'        },
  { id: 'NL', name: 'Netherlands',   emoji: '🇳🇱', onlineCount:    110_000, heat: 25, region: 'Europe'      },
  { id: 'MA', name: 'Morocco',       emoji: '🇲🇦', onlineCount:    100_000, heat: 24, region: 'Africa'      },
  { id: 'RU', name: 'Russia',        emoji: '🇷🇺', onlineCount:     90_000, heat: 22, region: 'Europe'      },
];

const TRENDING_COUNT = 5;  // hero cards shown in trending strip

// ─── Utility functions ────────────────────────────────────────────────────────

/** Format large counts in Indian notation (Lakh/Cr). */
function fmtCount(n: number): string {
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
  const heat = country.heat;
  const filled = Math.max(0, Math.min(1, heat / 100));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        hc.card,
        { backgroundColor: isSelected ? bg : bg, borderColor: isSelected ? T.gold600 : border },
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
          {fmtCount(country.onlineCount)}
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
              {fmtCount(country.onlineCount)} online
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
const RowDivider = () => <View style={{ height: 1, backgroundColor: T.cream400, opacity: 0.5, marginHorizontal: L.rowPadH }} />;

// ─── Main component ───────────────────────────────────────────────────────────

type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CountryPickerSheetProps) {

  const [countries,    setCountries]   = useState<CountryDoc[]>([]);
  const [sheetState,   setSheetState]  = useState<SheetState>('loading');
  const [searchQuery,  setSearchQuery] = useState('');
  const [reducedMotion,setRM]          = useState(false);

  const searchRef = useRef<TextInput>(null);
  const shimmer   = useShimmer(sheetState === 'loading');

  // ── Reduced motion ──────────────────────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // ── Load data on sheet open ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    setSheetState('loading');
    setSearchQuery('');

    // ── FIRESTORE HOOK (Phase 2) ──────────────────────────────────────────────
    // Replace the setTimeout below with:
    //   unsub = getCountries((docs: CountryDoc[]) => {
    //     setCountries(docs.sort((a, b) => b.onlineCount - a.onlineCount));
    //     setSheetState('idle');
    //   });
    // ─────────────────────────────────────────────────────────────────────────
    const timer = setTimeout(() => {
      setCountries(COUNTRIES);
      setSheetState('idle');
    }, 380);                // simulate 380ms load — shorter than skeleton feels sluggish

    return () => clearTimeout(timer);
  }, [visible]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredCountries = useMemo<CountryDoc[]>(() => {
    if (!searchQuery.trim()) return countries;
    const q = searchQuery.trim().toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [countries, searchQuery]);

  // ── Top 5 trending (hero strip) — hidden while searching ───────────────────
  const trendingCountries = useMemo(() => countries.slice(0, TRENDING_COUNT), [countries]);
  const showTrending      = !searchQuery.trim() && trendingCountries.length > 0;

  // ── Selected country object ─────────────────────────────────────────────────
  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selected) ?? null,
    [countries, selected]
  );

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

  // ── Row renderer ────────────────────────────────────────────────────────────
  const renderRow = useCallback(({ item, index }: { item: CountryDoc; index: number }) => (
    <React.Fragment key={item.id}>
      {index > 0 && <RowDivider />}
      <CountryRow
        country={item}
        isSelected={item.id === selected}
        onPress={() => handleSelect(item)}
      />
    </React.Fragment>
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
      {/* ── DRAG HANDLE ───────────────────────────────────────────────────────── */}
      <View style={sh.handleWrap}>
        <View style={sh.handle} />
      </View>

      {/* ── HEADER: Title + Close ─────────────────────────────────────────────── */}
      <View style={sh.headerRow}>
        <View style={sh.titleGroup}>
          <Text style={sh.globe}>🌍</Text>
          <View>
            <Text style={sh.title}>Desh Chuno</Text>
            <Text style={sh.subtitle}>195 desh · duniya bhar se</Text>
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
            {fmtCount(selectedCountry.onlineCount)} online
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
            <Text style={sh.sectionLabel}>TRENDING RIGHT NOW</Text>
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
          placeholder="195 desh dhundo..."
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

      {/* ── COUNTRY LIST ──────────────────────────────────────────────────────── */}
      {sheetState === 'loading' ? (
        // Skeleton
        <View>
          {Array.from({ length: L.shimmerRows }, (_, i) => (
            <SkeletonRow key={i} shimmer={shimmer} />
          ))}
        </View>
      ) : filteredCountries.length === 0 ? (
        // Empty state
        <View style={sh.emptyWrap}>
          <Text style={sh.emptyIcon}>🌐</Text>
          <Text style={sh.emptyTitle}>Koi desh nahi mila</Text>
          <Text style={sh.emptyHint}>"{searchQuery}" se koi match nahi hua</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCountries}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sh.listContent}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          getItemLayout={(_, index) => ({
            length: L.rowH + 1,   // row + divider
            offset: (L.rowH + 1) * index,
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

  // Handle
  handleWrap: {
    alignItems:  'center',
    paddingTop:  L.handleTop,
    paddingBottom: 4,
  },
  handle: {
    width:         L.handleW,
    height:        L.handleH,
    borderRadius:  L.handleH / 2,
    backgroundColor: T.cream400,
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

  // Divider
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

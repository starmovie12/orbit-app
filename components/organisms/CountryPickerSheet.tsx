/**
 * components/organisms/CountryPickerSheet.tsx — v7.0 · PRD OMEGA COUNCIL FINAL
 * CROWN — Country Selection Bottom Sheet · Blueprint v5.0 "BAAP EDITION"
 *
 * All 22 PRD sections. Zero placeholders. Zero `any`. WCAG 2.2 AA.
 * v7 over v6 — delta:
 *   PRD-21  Dark mode — full token swap system via ThemeCtx + useT()
 *   PRD-05  Pulse cycle speed from top-country heat (≥90→2s, ≥75→1.4s, <75→2.8s)
 *   PRD-05  TrendingCard badge dot uses <LiveDot> (was static View)
 *   PRD-14  T+80ms veil delay — handleSelect now defers state change to 80ms
 *   PRD-04  Animated clear button — spring entry (scale 0.7→1), timing exit (→0.7)
 *   PRD-16  Snap settle haptic via BottomSheet onChange (removed premature hL calls)
 *   PRD-22  FTUE nudge guards on recentIds.length (was recentCountries.length)
 *   PRD-09  accessibilityValue on AlphabetSidebar
 *   PRD-16  Clear button haptic fires on onPressIn (was via onPress handler)
 *   PRD-03  Portal Lip crossfades with idle transition (opacity animated)
 *   PRD-11  Search results sorted prefix-match first, contains second
 *   PRD-07  Dynamic Type row height — max(68, 68 + (fontScale − 1) × 22)
 *   PRD-17  IH map complete — all 8 height constants present
 *   PRD-12  SheetState type complete — all 7 states in union
 *
 * Dependencies: @gorhom/bottom-sheet v5, react-native-reanimated v4,
 *   react-native-gesture-handler v2, react-native-svg,
 *   expo-haptics, expo-linear-gradient
 */

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  FlatList,
  Keyboard,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import BottomSheet, {
  BottomSheetView,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  createAnimatedComponent,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { db } from '@/lib/firebase';
import { palette } from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// ─── Animated SVG ─────────────────────────────────────────────────────────────
const AnimatedSvgCircle = createAnimatedComponent(SvgCircle);

// ─── Screen ───────────────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Storage keys ─────────────────────────────────────────────────────────────
const CW_COUNTRY_KEY = '@cw/country_id' as const;
const CW_RECENTS_KEY = '@cw/recent_countries_v3' as const;
const COUNTRIES_KEY  = '@cw/countries_v2' as const;
const FTUE_KEY       = '@cw/hasSeenArenaGuidance' as const;
const MAX_RECENTS    = 3 as const;
const TRENDING_COUNT = 7 as const;
const MAX_RETRIES    = 3 as const;
const COUNTRIES_TTL  = 6 * 60 * 60 * 1000 as const;

// ─── PRD-17 Item height map — COMPLETE ────────────────────────────────────────
const IH = {
  SECTION:                32,   // PRD-08: A-Z section header
  ROW:                    68,   // PRD-07: country row (base, before Dynamic Type)
  FOOTER:                 36,   // PRD-17: freshness footer
  SECTION_SEPARATOR:       1,   // PRD-08: 0.5pt rule (rendered as 1pt for layout)
  TRENDING_SECTION:      160,   // PRD-17: label(32) + cards(104) + margins(24)
  RECENTLY_VISITED_ROW:   68,   // PRD-06: same as ROW — identical component
  RECENTLY_VISITED_LABEL: 43,   // PRD-17: 20pt top pad + 11pt text + 12pt bottom
  AZ_SEPARATOR:           25,   // PRD-17: 16pt top + 0.5pt rule + 8pt bottom
} as const;

// ─── Layout constants (PRD-specified pt values) ────────────────────────────────
const L = {
  rowHeat:   4,
  flagBox:  40,
  flagR:    20,
  flagEmoji:26,
  flagML:   12,
  flagGap:  10,
  heroW:   140,
  heroH:   104,
  heroR:    14,
  heroHeat:  3,
  secH:     32,
  sideW:    20,
  sideR:     4,
  oW:       58,
  oH:       58,
  oR:       14,
  searchH:  44,
  searchMV:  4,
  searchR:  12,
  handleW:  36,
  handleH:   4,
  closeBtn: 44,
  pillH:    32,
  pillRow:  52,
  shimW:    60,
  shimDur:1400,
  shimRows:  7,
} as const;

// ─── PRD-18 Spring parameter library ─────────────────────────────────────────
const SP = {
  ARRIVAL:   { mass: 1.0, stiffness: 220, damping: 22 },
  MICRO:     { mass: 0.5, stiffness: 500, damping: 28 },
  VEIL:      { mass: 1.0, stiffness: 180, damping: 20 },
  PRECISION: { mass: 0.4, stiffness: 600, damping: 28 },
  SIDEBAR:   { mass: 0.4, stiffness: 700, damping: 30 },
} as const;

// ─── PRD-14 Arc constants ─────────────────────────────────────────────────────
const ARC_R   = 44;
const ARC_C   = 2 * Math.PI * ARC_R;
const ARC_GAP = ARC_C * 0.25;  // 25% gap = 270° drawn
const ARC_SVG = 160;
const ARC_CX  = ARC_SVG / 2;
const ARC_CY  = ARC_SVG / 2;
const SEAL_CX = ARC_CX + ARC_R;  // 3 o'clock endpoint
const SEAL_CY = ARC_CY;

// ─── PRD-21 Design token system — Light + Dark ────────────────────────────────
interface Tokens {
  sheetBg:    string; // Primary sheet surface
  surface:    string; // cream[100] / ink[900] — cards, search bg, pills
  surfaceW:   string; // cream[200] / ink[700] — pressed states, hairlines
  border:     string; // cream[300] / ink[600] — 1pt borders
  borderS:    string; // cream[200] / ink[600] — subtle hairlines
  text:       string; // ink[950] / cream[50]  — primary text
  textSec:    string; // ink[600] / cream[200] — secondary text
  textTer:    string; // ink[400] / cream[300] — tertiary / labels
  textMut:    string; // ink[200] / ink[600]   — separators, placeholders
  gold:       string; // gold[600] (invariant)
  goldL:      string; // gold[300] (invariant)
  goldS:      string; // gold[100] light / gold[600]@14% dark — selection tint
  green:      string; // emerald[500] (invariant)
  emerald:    string; // emerald[600] (invariant)
  amber:      string; // amber[600]  (invariant)
  secBg:      string; // Frosted section header bg
  selRow:     string; // Selected row / card bg tint
  skeleton:   string; // Skeleton fill
  veilOp:     number; // Arena veil opacity (0.92 light / 0.96 dark)
  closeIcon:  string; // Close button icon
  pillBg:     string; // Unselected pill bg
  pillBorder: string; // Unselected pill border
  sidebarLtr: string; // Sidebar default letter
  badgeBg:    string; // Online badge background
  badgeText:  string; // Online badge text
}

const LIGHT: Tokens = {
  sheetBg:    palette.cream[50],
  surface:    palette.cream[100],
  surfaceW:   palette.cream[200],
  border:     palette.cream[300],
  borderS:    palette.cream[200],
  text:       palette.ink[950],
  textSec:    palette.ink[600],
  textTer:    palette.ink[400],
  textMut:    palette.ink[200],
  gold:       palette.gold[600],
  goldL:      palette.gold[300],
  goldS:      palette.gold[100],
  green:      palette.emerald[500],
  emerald:    palette.emerald[600],
  amber:      palette.amber[600],
  secBg:      'rgba(250,248,242,0.95)',
  selRow:     palette.gold[100],
  skeleton:   palette.cream[200],
  veilOp:     0.92,
  closeIcon:  palette.ink[600],
  pillBg:     palette.cream[100],
  pillBorder: palette.cream[300],
  sidebarLtr: palette.ink[400],
  badgeBg:    'rgba(17,17,17,0.88)',
  badgeText:  palette.cream[50],
};

const DARK: Tokens = {
  sheetBg:    palette.ink[950],
  surface:    palette.ink[900],
  surfaceW:   palette.ink[700],
  border:     palette.ink[600],
  borderS:    palette.ink[600],
  text:       palette.cream[50],
  textSec:    palette.cream[200],
  textTer:    palette.cream[300],
  textMut:    palette.ink[600],
  gold:       palette.gold[600],
  goldL:      palette.gold[300],
  goldS:      `${palette.gold[600]}24`,   // gold[600] at 14% opacity — PRD-21
  green:      palette.emerald[500],
  emerald:    palette.emerald[600],
  amber:      palette.amber[600],
  secBg:      `${palette.ink[900]}F2`,    // ink[900] at ~95% — PRD-21
  selRow:     `${palette.gold[600]}24`,   // gold[600] at 14% over ink[950] — PRD-21
  skeleton:   palette.ink[700],           // PRD-21
  veilOp:     0.96,                       // PRD-21: slightly more opaque
  closeIcon:  palette.cream[200],         // PRD-21
  pillBg:     palette.ink[900],           // PRD-21
  pillBorder: palette.ink[600],           // PRD-21
  sidebarLtr: palette.cream[300],         // PRD-21
  badgeBg:    `${palette.cream[50]}E0`,   // cream[50] at ~88% — legible on ink[900] card
  badgeText:  palette.ink[950],
};

// ─── PRD-21 Theme context ─────────────────────────────────────────────────────
const ThemeCtx = createContext<Tokens>(LIGHT);
const useT = (): Tokens => useContext(ThemeCtx);

// ─── PRD-04/20/21 accent + region maps (invariant — work on both bg colours) ─
const R_BLUE = 'rgba(59,130,246,1)';
const R_PUR  = 'rgba(139,92,246,1)';
const R_RED  = 'rgba(220,38,38,1)';

const R_ACCENT: Record<string, string> = {
  'Asia': palette.gold[600], 'Americas': palette.emerald[600],
  'Africa': palette.amber[600], 'Europe': R_BLUE,
  'Oceania': R_PUR, 'Middle East': R_RED,
};

const R_ACCENT40: Record<string, string> = {
  'Asia': 'rgba(212,160,23,0.4)', 'Americas': 'rgba(16,185,129,0.4)',
  'Africa': 'rgba(212,101,26,0.4)', 'Europe': 'rgba(59,130,246,0.4)',
  'Oceania': 'rgba(139,92,246,0.4)', 'Middle East': 'rgba(220,38,38,0.4)',
};

const R_FLAGBG: Record<string, string> = {
  'Asia': 'rgba(212,160,23,0.10)', 'Americas': 'rgba(16,185,129,0.10)',
  'Africa': 'rgba(212,101,26,0.10)', 'Europe': 'rgba(59,130,246,0.10)',
  'Oceania': 'rgba(139,92,246,0.10)', 'Middle East': 'rgba(220,38,38,0.10)',
};

const HEAT_TINT: Record<string, readonly [string, string]> = {
  hot:  ['rgba(16,185,129,0.14)', 'transparent'],
  warm: ['rgba(212,160,23,0.12)', 'transparent'],
  cool: ['rgba(212,101,26,0.08)', 'transparent'],
};

// ─── PRD-04 Region filter pills ────────────────────────────────────────────────
const REGIONS = ['All','Asia','Americas','Europe','Africa','Middle East','Oceania'] as const;
type RegionFilter = (typeof REGIONS)[number];

const PILL_ACCENT: Record<RegionFilter, string> = {
  'All': palette.gold[600], 'Asia': palette.gold[600],
  'Americas': palette.emerald[600], 'Europe': R_BLUE,
  'Africa': palette.amber[600], 'Middle East': R_RED, 'Oceania': R_PUR,
};

// ─── PRD-16 Haptics ────────────────────────────────────────────────────────────
const hL  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hM  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hS  = () => Haptics.selectionAsync();
const hW  = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
const hOK = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// ─── Middle East ISO set ──────────────────────────────────────────────────────
const ME = new Set(['AE','BH','IQ','IR','IL','JO','KW','LB','OM','PS','QA','SA','SY','YE']);

// ─── Types ────────────────────────────────────────────────────────────────────
type Region = 'Asia'|'Americas'|'Africa'|'Europe'|'Oceania'|'Middle East';

// PRD-12: Complete 7-state machine
type SheetState = 'loading' | 'idle' | 'searching' | 'switching' | 'error' | 'refreshing' | 'empty_region';

type SwitchPhase = 'entering' | 'activated';

export interface CountryDoc {
  id: string; name: string; emoji: string;
  onlineCount: number; heat: number; region: Region; dialCode?: string;
}
export interface CountryPickerSheetProps {
  visible: boolean; onClose: () => void;
  selected: string; onSelect: (id: string, name: string, emoji: string) => void;
}
export interface FSCountry {
  name?: string; flag?: string; iso2?: string; continent?: string;
  online_count?: number; is_active?: boolean; dial_code?: string;
}

type SecItem = { type: 'section'; letter: string };
type CntItem = { type: 'country'; country: CountryDoc };
type ListItem = SecItem | CntItem;
interface CacheEntry { data: CountryDoc[]; fetchedAt: number; expiresAt: number }

// ─── Utilities ────────────────────────────────────────────────────────────────
function normD(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function mapRegion(continent: string, iso2: string): Region {
  if (ME.has(iso2)) return 'Middle East';
  switch (continent?.trim()) {
    case 'Africa':  return 'Africa';
    case 'Europe':  return 'Europe';
    case 'Oceania': case 'Australia/Oceania': case 'Australia & Oceania': return 'Oceania';
    case 'North America': case 'South America': case 'Central America': case 'Americas': return 'Americas';
    default: return 'Asia';
  }
}

function calcHeat(n: number): number {
  return n <= 0 ? 0 : Math.min(100, Math.round((Math.log10(n + 1) / 5) * 100));
}

function heatCol(h: number, t: Tokens): string {
  return h >= 75 ? t.green : h >= 50 ? t.gold : h >= 25 ? t.amber : t.border;
}

function fmt(n: number): string {
  if (n <= 0) return '0';
  if (n >= 1e7) { const v = n / 1e7; return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}Cr`; }
  if (n >= 1e5) { const v = n / 1e5; return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}L`; }
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return n.toLocaleString('en-IN');
}

function mapDoc(id: string, d: Partial<FSCountry>): CountryDoc {
  const iso2 = ((d.iso2 ?? id) as string).toUpperCase();
  const oc   = Number(d.online_count ?? 0);
  return {
    id: iso2, name: d.name ?? iso2, emoji: d.flag ?? '🌐',
    onlineCount: oc, heat: calcHeat(oc),
    region: mapRegion(d.continent ?? '', iso2), dialCode: d.dial_code,
  };
}

// ─── PRD-07 Dynamic Type row height ───────────────────────────────────────────
function dynRowH(): number {
  const scale = PixelRatio.getFontScale();
  return Math.max(IH.ROW, Math.round(IH.ROW + (scale - 1) * 22));
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function migrateRecents(): Promise<void> {
  try {
    const v2 = await AsyncStorage.getItem('@cw/recent_countries_v2');
    if (!v2) return;
    const already = await AsyncStorage.getItem(CW_RECENTS_KEY);
    if (already) { await AsyncStorage.removeItem('@cw/recent_countries_v2'); return; }
    await AsyncStorage.setItem(CW_RECENTS_KEY, v2);
    await AsyncStorage.removeItem('@cw/recent_countries_v2');
  } catch { /* non-critical */ }
}

async function fetchCountries(bypass = false): Promise<[CountryDoc[], number]> {
  if (!bypass) {
    try {
      const raw = await AsyncStorage.getItem(COUNTRIES_KEY);
      if (raw) {
        const e = JSON.parse(raw) as CacheEntry;
        if (Date.now() < e.expiresAt) return [e.data, e.fetchedAt];
      }
    } catch { /* cache miss */ }
  }
  const snap = await getDocs(query(collection(db, 'countries'), where('is_active', '==', true)));
  const docs  = snap.docs.map((d) => mapDoc(d.id, d.data() as Partial<FSCountry>));
  docs.sort((a, b) => b.onlineCount - a.onlineCount || a.name.localeCompare(b.name));
  const fetchedAt = Date.now();
  // PRD-17: ±30min jitter prevents thundering herd
  AsyncStorage.setItem(COUNTRIES_KEY, JSON.stringify({
    data: docs, fetchedAt,
    expiresAt: fetchedAt + COUNTRIES_TTL + (Math.random() - 0.5) * 3_600_000,
  })).catch(() => {});
  return [docs, fetchedAt];
}

// ─── List builders ────────────────────────────────────────────────────────────
function buildSections(sorted: CountryDoc[]): ListItem[] {
  const items: ListItem[] = [];
  let prev = '';
  for (const c of sorted) {
    const l = c.name[0]?.toUpperCase() ?? '#';
    if (l !== prev) { items.push({ type: 'section', letter: l }); prev = l; }
    items.push({ type: 'country', country: c });
  }
  return items;
}

function buildSearch(countries: CountryDoc[]): ListItem[] {
  return countries.map((c) => ({ type: 'country', country: c } as CntItem));
}

// PRD-17: O(n) pre-computed offset map, row height-aware
function buildOffsets(data: ListItem[], rowH: number): number[] {
  const map: number[] = [];
  let off = 0;
  for (const item of data) {
    map.push(off);
    off += item.type === 'section' ? IH.SECTION : rowH;
  }
  return map;
}

// ─── PulseProvider — PRD-05: cycle speed from top country heat ────────────────
interface PulseCtx { anim: Animated.SharedValue<number>; register: () => () => void }
const PulseCtxObj = createContext<PulseCtx | null>(null);

const PulseProvider = memo<{ children: React.ReactNode; cycleMs: number }>(
  ({ children, cycleMs }) => {
    const anim     = useSharedValue(1);
    const refs     = useRef(0);
    const on       = useRef(false);
    const cycleRef = useRef(cycleMs);

    const start = useCallback(() => {
      anim.value = withRepeat(withSequence(
        withTiming(0.2, { duration: cycleRef.current / 2, easing: Easing.inOut(Easing.sine) }),
        withTiming(1.0, { duration: cycleRef.current / 2, easing: Easing.inOut(Easing.sine) }),
      ), -1);
      on.current = true;
    }, [anim]);

    const stop = useCallback(() => {
      cancelAnimation(anim); anim.value = 1; on.current = false;
    }, [anim]);

    // PRD-05: restart animation when cycle speed changes on data refresh
    useEffect(() => {
      cycleRef.current = cycleMs;
      if (on.current && refs.current > 0) { stop(); start(); }
    }, [cycleMs, start, stop]);

    const register = useCallback((): (() => void) => {
      refs.current++;
      if (!on.current) start();
      return () => {
        refs.current = Math.max(0, refs.current - 1);
        if (refs.current === 0) stop();
      };
    }, [start, stop]);

    const ctx = useMemo<PulseCtx>(() => ({ anim, register }), [anim, register]);
    return <PulseCtxObj.Provider value={ctx}>{children}</PulseCtxObj.Provider>;
  },
);

function usePulse(enabled: boolean): Animated.SharedValue<number> {
  const ctx      = useContext(PulseCtxObj);
  const fallback = useSharedValue(1);
  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.register();
  }, [enabled, ctx]);
  return ctx?.anim ?? fallback;
}

// ─── BreathingProvider — single worklet for ALL heat≥75 elements ──────────────
interface BreatheCtx { anim: Animated.SharedValue<number>; register: () => () => void }
const BreatheCtxObj = createContext<BreatheCtx | null>(null);

const BreathingProvider = memo<{ children: React.ReactNode }>(({ children }) => {
  const anim = useSharedValue(1);
  const refs = useRef(0);
  const on   = useRef(false);

  const start = useCallback(() => {
    anim.value = withRepeat(withSequence(
      withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.sine) }),
      withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.sine) }),
    ), -1);
    on.current = true;
  }, [anim]);

  const stop = useCallback(() => {
    cancelAnimation(anim); anim.value = 1; on.current = false;
  }, [anim]);

  const register = useCallback((): (() => void) => {
    refs.current++;
    if (!on.current) start();
    return () => {
      refs.current = Math.max(0, refs.current - 1);
      if (refs.current === 0) stop();
    };
  }, [start, stop]);

  const ctx = useMemo<BreatheCtx>(() => ({ anim, register }), [anim, register]);
  return <BreatheCtxObj.Provider value={ctx}>{children}</BreatheCtxObj.Provider>;
});

function useBreathe(enabled: boolean): Animated.SharedValue<number> {
  const ctx      = useContext(BreatheCtxObj);
  const fallback = useSharedValue(1);
  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.register();
  }, [enabled, ctx]);
  return ctx?.anim ?? fallback;
}

// ─── LiveDot — pulsing / static dot (PRD-05, PRD-07) ─────────────────────────
const LiveDot = memo<{ size?: number; color?: string; pulse?: boolean }>(
  ({ size = 5, color = palette.emerald[500], pulse = false }) => {
    const anim  = usePulse(pulse);
    const style = useAnimatedStyle(() => ({
      opacity:   pulse ? anim.value : 1,
      transform: [{ scale: pulse ? interpolate(anim.value, [0.2, 1], [1, 1.4]) : 1 }],
    }));
    return (
      <Animated.View
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
        accessible={false}
      />
    );
  },
);

// ─── SkeletonRow — geometry matches real CountryRow exactly (PRD-12) ──────────
const SkeletonRow = memo<{ shimX: Animated.SharedValue<number>; rowH: number }>(({ shimX, rowH }) => {
  const t        = useT();
  const shimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shimX.value }] }));
  const shim = (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: L.shimW }, shimStyle]}>
      <LinearGradient
        colors={['transparent', `${t.sheetBg}B3`, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
  return (
    <View style={[_sk.row, { height: rowH, backgroundColor: t.sheetBg }]}>
      <View style={[_sk.heatBar, { backgroundColor: t.border }]} />
      <View style={[_sk.flag, { backgroundColor: t.skeleton, overflow: 'hidden' }]}>{shim}</View>
      <View style={_sk.body}>
        <View style={[_sk.nameLine, { backgroundColor: t.skeleton, overflow: 'hidden' }]}>{shim}</View>
        <View style={[_sk.metaLine, { backgroundColor: t.skeleton, overflow: 'hidden' }]}>{shim}</View>
      </View>
    </View>
  );
});
const _sk = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center' },
  heatBar:  { width: L.rowHeat, alignSelf: 'stretch' },
  flag:     { width: L.flagBox, height: L.flagBox, borderRadius: L.flagR, marginLeft: L.flagML },
  body:     { flex: 1, marginLeft: L.flagGap, gap: 8 },
  nameLine: { height: 14, borderRadius: 7, width: '55%' as const },
  metaLine: { height: 10, borderRadius: 5, width: '35%' as const },
});

// ─── SkeletonTrendingCard (PRD-12) ────────────────────────────────────────────
const SkeletonCard = memo<{ shimX: Animated.SharedValue<number> }>(({ shimX }) => {
  const t        = useT();
  const shimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shimX.value }] }));
  return (
    <View style={[_scard.card, { backgroundColor: t.skeleton, borderColor: t.border, overflow: 'hidden' }]}>
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: L.shimW }, shimStyle]}>
        <LinearGradient
          colors={['transparent', `${t.sheetBg}B3`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});
const _scard = StyleSheet.create({
  card: { width: L.heroW, height: L.heroH, borderRadius: L.heroR, borderWidth: 1 },
});

// ─── SectionHeader (PRD-08) — frosted, cream[100]/ink[900] at 95% ─────────────
const SectionHeader = memo<{ letter: string }>(({ letter }) => {
  const t = useT();
  return (
    <View
      style={[_sec.wrap, { backgroundColor: t.secBg, borderBottomColor: t.borderS }]}
      accessibilityRole="header"
    >
      <Text
        style={[_sec.letter, { color: t.textSec }]}
        accessibilityLabel={`Countries starting with ${letter}`}
      >
        {letter}
      </Text>
    </View>
  );
});
const _sec = StyleSheet.create({
  wrap:   { height: IH.SECTION, paddingHorizontal: 20, justifyContent: 'center', borderBottomWidth: 0.5 },
  letter: { fontFamily: FONT_HEADING.semiBold, fontSize: 13, letterSpacing: 0.4 },
});

// ─── RegionPill (PRD-04) ──────────────────────────────────────────────────────
interface PillProps { label: RegionFilter; active: boolean; accent: string; onPress: (f: RegionFilter) => void }
const RegionPill = memo<PillProps>(({ label, active, accent, onPress }) => {
  const t      = useT();
  const scale  = useSharedValue(1);
  const chkSc  = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    chkSc.value = withSpring(active ? 1 : 0, SP.MICRO);
  }, [active, chkSc]);

  const scStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const chkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chkSc.value }],
    opacity: chkSc.value,
    width: chkSc.value > 0.01 ? 16 : 0,
  }));

  return (
    <Pressable
      onPressIn={() => { void hS(); scale.value = withSpring(0.96, SP.MICRO); }}
      onPressOut={() => { scale.value = withSpring(1.0, { mass: 0.5, stiffness: 400, damping: 22 }); }}
      onPress={() => onPress(label)}
      accessibilityRole="radio"
      accessibilityLabel={`${label === 'All' ? 'All regions' : label} filter`}
      accessibilityState={{ selected: active }}
      accessibilityHint="Shows only countries in this region"
    >
      <Animated.View style={[
        _rp.pill,
        {
          backgroundColor: active ? `${accent}1F` : t.pillBg,
          borderColor: active ? accent : t.pillBorder,
          borderWidth: active ? 1.5 : 1,
        },
        scStyle,
      ]}>
        <Animated.View style={chkStyle}>
          <Feather name="check" size={10} color={accent} />
        </Animated.View>
        <Text style={[_rp.text, { color: active ? accent : t.textSec }]}>
          {label.toUpperCase()}
        </Text>
      </Animated.View>
    </Pressable>
  );
});
const _rp = StyleSheet.create({
  pill: { height: L.pillH, paddingHorizontal: 14, borderRadius: L.pillH / 2, minWidth: 72, flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontFamily: FONT_BODY.semiBold, fontSize: 12, letterSpacing: 0.5 },
});

// ─── TrendingCard (PRD-05) — 140×104pt ───────────────────────────────────────
interface TCardProps {
  country: CountryDoc; rank: number; isSelected: boolean;
  onPress: (c: CountryDoc, pageY: number) => void;
  entryDelay: number; reducedMotion: boolean;
}
const TrendingCard = memo<TCardProps>(({ country, rank, isSelected, onPress, entryDelay, reducedMotion }) => {
  const t       = useT();
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(20);
  const breathe = useBreathe(!isSelected && country.heat >= 75);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = withDelay(entryDelay * 0.4, withTiming(1, { duration: 150 }));
    } else {
      opacity.value = withDelay(entryDelay, withSpring(1, SP.ARRIVAL));
      transY.value  = withDelay(entryDelay, withSpring(0, SP.ARRIVAL));
    }
  }, [entryDelay, opacity, reducedMotion, transY]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: transY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));
  const heatBarStyle = useAnimatedStyle(() => ({
    opacity: isSelected ? 1 : (country.heat >= 75 ? breathe.value : 1),
  }));

  const hColor   = isSelected ? t.gold : heatCol(country.heat, t);
  const nameFont = isSelected ? FONT_HEADING.bold : FONT_HEADING.medium;
  const tint     = country.heat >= 75 ? HEAT_TINT.hot : country.heat >= 50 ? HEAT_TINT.warm : country.heat >= 25 ? HEAT_TINT.cool : null;
  const hDesc    = country.heat >= 75 ? 'Very active' : country.heat >= 50 ? 'Active' : country.heat >= 25 ? 'Warm' : 'Quiet';
  const a11y     = `${country.name}, ${fmt(country.onlineCount)} online, ${hDesc} arena${isSelected ? '. Currently selected.' : ''}`;

  return (
    <Pressable
      onPressIn={(e) => { scale.value = withSpring(0.96, SP.MICRO); onPress(country, e.nativeEvent.pageY); }}
      onPressOut={() => { scale.value = withSpring(1.0, { mass: 0.5, stiffness: 400, damping: 22 }); }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Double tap to enter this country's arena"
    >
      <Animated.View style={[
        _hc.card,
        {
          backgroundColor: isSelected ? t.selRow : t.surface,
          borderColor: isSelected ? t.gold : t.borderS,
          borderWidth: isSelected ? 1.5 : 1,
        },
        cardStyle,
      ]}>
        {!isSelected && tint && (
          <LinearGradient colors={tint as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        )}
        {/* PRD-05: 3pt left heat accent bar */}
        <Animated.View style={[_hc.heatBar, { backgroundColor: hColor }, heatBarStyle]} />
        {/* PRD-05: online count badge top-right — badge dot uses LiveDot (PRD-05 fix) */}
        <View style={[_hc.badge, { backgroundColor: t.badgeBg }]}>
          <LiveDot size={5} color={hColor} pulse={!isSelected && country.heat >= 75} />
          <Text style={[_hc.badgeText, { color: t.badgeText }]}>{fmt(country.onlineCount)}</Text>
        </View>
        {/* PRD-20: check-circle top-left when selected */}
        {isSelected && <View style={_hc.chkWrap}><Feather name="check-circle" size={14} color={t.gold} /></View>}
        {/* PRD-05: flag */}
        <Text style={_hc.flag} accessible={false}>{country.emoji}</Text>
        {/* PRD-05: info block */}
        <View style={_hc.info}>
          <Text style={[_hc.name, { fontFamily: nameFont, color: t.text }]} numberOfLines={1}>{country.name}</Text>
          <Text style={[_hc.region, { color: R_ACCENT[country.region] ?? t.gold }]}>
            {country.region.toUpperCase()}
          </Text>
        </View>
        {/* PRD-05: rank badge */}
        <Text style={[_hc.rank, { color: t.textTer }]}>#{rank}</Text>
      </Animated.View>
    </Pressable>
  );
});
const _hc = StyleSheet.create({
  card:     { width: L.heroW, height: L.heroH, borderRadius: L.heroR, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  heatBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: L.heroHeat, borderTopLeftRadius: L.heroR, borderBottomLeftRadius: L.heroR },
  badge:    { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, paddingHorizontal: 8, height: 22 },
  badgeText:{ fontFamily: FONT_BODY.bold, fontSize: 11 },
  chkWrap:  { position: 'absolute', top: 8, left: 10 },
  flag:     { fontSize: 36, position: 'absolute', left: 16, top: L.heroH / 2 - 18 },
  info:     { position: 'absolute', bottom: 8, left: 16, right: 8 },
  name:     { fontSize: 14 },
  region:   { fontFamily: FONT_BODY.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  rank:     { position: 'absolute', bottom: 8, left: 10, fontFamily: FONT_BODY.bold, fontSize: 10 },
});

// ─── CountryRow (PRD-07) — Dynamic Type + dark mode ──────────────────────────
interface RowProps {
  country: CountryDoc; isSelected: boolean;
  onPressIn: (c: CountryDoc, pageY: number) => void;
  rowH?: number;  // PRD-07: Dynamic Type height
}
const CountryRow = memo<RowProps>(({ country, isSelected, onPressIn, rowH = IH.ROW }) => {
  const t       = useT();
  const flashOp = useSharedValue(0);
  const breathe = useBreathe(!isSelected && country.heat >= 75);
  const chkSc   = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    chkSc.value = withSpring(isSelected ? 1 : 0, { mass: 0.6, stiffness: 500, damping: 28 });
  }, [isSelected, chkSc]);

  const flashStyle   = useAnimatedStyle(() => ({ opacity: flashOp.value }));
  const heatBarStyle = useAnimatedStyle(() => ({ opacity: isSelected ? 1 : (country.heat >= 75 ? breathe.value : 1) }));
  const chkStyle     = useAnimatedStyle(() => ({ transform: [{ scale: chkSc.value }], opacity: chkSc.value }));

  const hColor   = isSelected ? t.gold : heatCol(country.heat, t);
  const nameFont = isSelected ? FONT_HEADING.bold : FONT_HEADING.medium;
  const isoColor = isSelected ? t.gold : t.textTer;
  const flagBg   = R_FLAGBG[country.region] ?? `${t.gold}1A`;
  const a11y     = `${country.name}, ${country.id}, ${country.onlineCount > 0 ? fmt(country.onlineCount) + ' online' : 'no one online'}${isSelected ? '. Currently selected.' : ''}`;

  return (
    <Pressable
      onPressIn={(e) => {
        flashOp.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
        onPressIn(country, e.nativeEvent.pageY);
      }}
      onPressOut={() => { flashOp.value = withTiming(0, { duration: 80 }); }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: isSelected }}
      accessibilityHint="Double tap to enter this country's arena"
    >
      <View style={[_cr.row, { height: rowH, backgroundColor: isSelected ? t.selRow : t.sheetBg }]}>
        <Animated.View style={[_cr.heatBar, { height: rowH, backgroundColor: hColor }, heatBarStyle]} />
        <View style={[_cr.flagCircle, { backgroundColor: flagBg, marginLeft: L.flagML }]}>
          <Text style={{ fontSize: L.flagEmoji }} accessible={false}>{country.emoji}</Text>
        </View>
        <View style={_cr.body}>
          <Text style={[_cr.name, { fontFamily: nameFont, color: t.text }]} numberOfLines={1}>{country.name}</Text>
          <View style={_cr.meta}>
            <Text style={[_cr.iso, { color: isoColor }]}>{country.id}</Text>
            <Text style={[_cr.dot, { color: t.textMut }]} accessible={false}> · </Text>
            <Text style={[_cr.count, { color: t.textSec }]}>{fmt(country.onlineCount)}</Text>
            <LiveDot size={5} color={hColor} pulse={country.heat >= 75} />
          </View>
        </View>
        <Animated.View style={[_cr.trailing, chkStyle]}>
          <Feather name="check-circle" size={18} color={t.gold} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.surfaceW }, flashStyle]} pointerEvents="none" />
      </View>
    </Pressable>
  );
});
const _cr = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  heatBar:    { width: L.rowHeat },
  flagCircle: { width: L.flagBox, height: L.flagBox, borderRadius: L.flagR, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body:       { flex: 1, marginLeft: L.flagGap, gap: 3 },
  name:       { fontSize: 15 },
  meta:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iso:        { fontFamily: FONT_BODY.medium, fontSize: 11 },
  dot:        { fontFamily: FONT_BODY.regular, fontSize: 11 },
  count:      { fontFamily: FONT_BODY.semiBold, fontSize: 11 },
  trailing:   { marginLeft: 8, flexShrink: 0 },
});

// ─── AlphabetSidebar (PRD-09) — active/adjacent states + accessibilityValue ──
interface SidebarProps {
  letters: string[]; activeLtr: string | null;
  onPress: (l: string) => void; onChange: (l: string | null) => void;
}
const AlphabetSidebar = memo<SidebarProps>(({ letters, activeLtr, onPress, onChange }) => {
  const t          = useT();
  const heightRef  = useRef(0);
  const lastIdx    = useRef(-1);
  const hapticCnt  = useRef(0);
  const trackOp   = useSharedValue(0);

  const onPressRef  = useRef(onPress);
  const onChangeRef = useRef(onChange);
  const lettersRef  = useRef(letters);
  useEffect(() => { onPressRef.current  = onPress;  }, [onPress]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { lettersRef.current  = letters;  }, [letters]);

  const trackStyle = useAnimatedStyle(() => ({ opacity: trackOp.value }));

  const hit = useCallback((y: number) => {
    const ls = lettersRef.current;
    if (!heightRef.current || !ls.length) return;
    const idx = Math.max(0, Math.min(ls.length - 1, Math.floor((y / heightRef.current) * ls.length)));
    if (idx !== lastIdx.current) {
      hapticCnt.current++;
      if (hapticCnt.current % 3 === 0) void hL();
      lastIdx.current = idx;
      const l = ls[idx];
      if (l) { onChangeRef.current(l); onPressRef.current(l); }
    }
  }, []);

  const panH = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => false,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      lastIdx.current = -1; hapticCnt.current = 0;
      void hL();
      trackOp.value = withTiming(1, { duration: 100 });
      hit(e.nativeEvent.locationY);
    },
    onPanResponderMove:    (e: GestureResponderEvent) => hit(e.nativeEvent.locationY),
    onPanResponderRelease: () => {
      lastIdx.current = -1;
      onChangeRef.current(null);
      trackOp.value = withTiming(0, { duration: 200 });
    },
  }).panHandlers).current;

  const activeIdx = activeLtr ? letters.indexOf(activeLtr) : -1;

  return (
    <View
      style={_ab.wrap}
      onLayout={(e) => { heightRef.current = e.nativeEvent.layout.height; }}
      {...panH}
      accessibilityRole="adjustable"
      accessibilityLabel="Alphabet navigator"
      accessibilityHint="Swipe up or down to jump to a letter section"
      // PRD-09: accessibilityValue — announces current letter to screen reader
      accessibilityValue={{ text: activeLtr ? `Letter ${activeLtr}` : undefined }}
      accessibilityActions={[{ name: 'increment', label: 'Next letter' }, { name: 'decrement', label: 'Previous letter' }]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => {
        const ls = lettersRef.current; if (!ls.length) return;
        const cur  = lastIdx.current < 0 ? 0 : lastIdx.current;
        const next = e.nativeEvent.actionName === 'increment' ? Math.min(ls.length - 1, cur + 1) : Math.max(0, cur - 1);
        lastIdx.current = next;
        const l = ls[next];
        if (l) { void hL(); onChangeRef.current(l); onPressRef.current(l); }
      }}
    >
      {/* PRD-09: Active track rail — 1pt gold line at left edge during pan */}
      <Animated.View style={[_ab.track, { backgroundColor: `${t.gold}66` }, trackStyle]} />

      {letters.map((l, idx) => {
        const isAct = idx === activeIdx;
        const isAdj = activeIdx >= 0 && Math.abs(idx - activeIdx) === 1;
        return (
          <View key={l} style={_ab.btn} accessible={false}>
            {isAct && <View style={[_ab.activeBg, { backgroundColor: t.goldS }]} />}
            <Text style={[
              _ab.ltr, { color: t.sidebarLtr },
              isAdj && { fontFamily: FONT_BODY.medium, fontSize: 11, color: t.textSec },
              isAct && { fontFamily: FONT_BODY.bold, fontSize: 13, color: t.gold },
            ]}>
              {l}
            </Text>
          </View>
        );
      })}
    </View>
  );
});
const _ab = StyleSheet.create({
  wrap:     { position: 'absolute', right: L.sideR, top: 0, bottom: 0, width: L.sideW, zIndex: 10, flexDirection: 'column', alignItems: 'center' },
  track:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1 },
  btn:      { width: L.sideW, flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 8 },
  activeBg: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  ltr:      { fontFamily: FONT_BODY.medium, fontSize: 10 },
});

// ─── LetterOverlay (PRD-10) — 58×58, fixed at 40% screen height ──────────────
const LetterOverlay = memo<{ letter: string | null; reducedMotion: boolean }>(
  ({ letter, reducedMotion }) => {
    const scale   = useSharedValue(0.65);
    const opac    = useSharedValue(0);
    const lOpac   = useSharedValue(0);
    const dispRef = useRef(letter ?? '');

    useEffect(() => {
      if (letter) {
        dispRef.current = letter;
        if (reducedMotion) { scale.value = 1; opac.value = 1; lOpac.value = 1; }
        else {
          scale.value = withSpring(1, SP.PRECISION);
          opac.value  = withTiming(1, { duration: 120 });
          lOpac.value = withSpring(1, SP.PRECISION);
        }
      } else {
        if (reducedMotion) { scale.value = 0.65; opac.value = 0; lOpac.value = 0; }
        else {
          scale.value = withTiming(0.7, { duration: 180, easing: Easing.out(Easing.cubic) });
          opac.value  = withTiming(0,   { duration: 180, easing: Easing.out(Easing.cubic) });
        }
      }
    }, [letter, reducedMotion, scale, opac, lOpac]);

    const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opac.value }));
    const letterStyle    = useAnimatedStyle(() => ({ opacity: lOpac.value }));

    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start', alignItems: 'flex-end', zIndex: 50 }]}>
        <Animated.View style={[_lo.bubble, { top: SCREEN_H * 0.4, right: L.sideR + L.sideW + 12 }, containerStyle]}>
          <Animated.Text style={[_lo.letter, letterStyle]}>
            {letter ?? dispRef.current}
          </Animated.Text>
        </Animated.View>
      </View>
    );
  },
);
const _lo = StyleSheet.create({
  bubble: { position: 'absolute', width: L.oW, height: L.oH, borderRadius: L.oR, backgroundColor: `${palette.ink[950]}F0`, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: FONT_HEADING.bold, fontSize: 30, color: palette.cream[50], includeFontPadding: false },
});

// ─── RecentlyVisitedSection (PRD-06) — "RECENT BATTLEGROUNDS" ────────────────
const RecentSection = memo<{
  countries: CountryDoc[]; selected: string; rowH: number;
  onPressIn: (c: CountryDoc, y: number) => void;
}>(({ countries, selected, onPressIn, rowH }) => {
  const t = useT();
  return (
    <View>
      <View style={_rv.header}>
        <Text style={[_rv.label, { color: t.textTer }]}>RECENT BATTLEGROUNDS</Text>
      </View>
      {countries.map((c) => (
        <CountryRow key={c.id} country={c} isSelected={c.id === selected} onPressIn={onPressIn} rowH={rowH} />
      ))}
      <View style={[_rv.rule, { backgroundColor: t.borderS }]} />
    </View>
  );
});
const _rv = StyleSheet.create({
  header: { paddingLeft: 20, paddingTop: 20, paddingBottom: 8 },
  label:  { fontFamily: FONT_BODY.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  rule:   { height: 0.5, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
});

// ─── FirstArenaNudge (PRD-22) — 80pt, gold[100] bg, dismiss collapse ─────────
const FirstArenaNudge = memo<{ onDismiss: () => void }>(({ onDismiss }) => {
  const t   = useT();
  const h   = useSharedValue(80);
  const o   = useSharedValue(1);
  const dismiss = useCallback(async () => {
    void hL();
    await AsyncStorage.setItem(FTUE_KEY, 'true').catch(() => {});
    o.value = withTiming(0, { duration: 200 });
    h.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    setTimeout(onDismiss, 220);
  }, [h, o, onDismiss]);
  const style = useAnimatedStyle(() => ({ height: h.value, opacity: o.value, overflow: 'hidden' as const }));
  return (
    <Animated.View style={[_ng.wrap, { backgroundColor: t.goldS, borderColor: t.goldL }, style]}>
      <View style={_ng.inner}>
        <Feather name="globe" size={24} color={t.gold} />
        <View style={_ng.txt}>
          <Text style={[_ng.heading, { color: t.text }]}>Your first global arena</Text>
          <Text style={[_ng.body, { color: t.textSec }]}>
            Pick a country to compete in. High heat means more opponents — and bigger wins.
          </Text>
        </View>
        <Pressable
          onPress={dismiss} style={_ng.close}
          accessibilityRole="button" accessibilityLabel="Dismiss arena guidance"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={16} color={t.textTer} />
        </Pressable>
      </View>
    </Animated.View>
  );
});
const _ng = StyleSheet.create({
  wrap:    { marginHorizontal: 20, borderRadius: 12, marginTop: 16, marginBottom: 12, borderWidth: 1 },
  inner:   { flexDirection: 'row', alignItems: 'center', height: 80, paddingLeft: 16, gap: 12 },
  txt:     { flex: 1 },
  heading: { fontFamily: FONT_HEADING.semiBold, fontSize: 14 },
  body:    { fontFamily: FONT_BODY.regular, fontSize: 12, marginTop: 4 },
  close:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

// ─── ErrorState (PRD-13) — copy by retry attempt ─────────────────────────────
const ERR_COPY = [
  { heading: "Can't reach the arena",  body: 'Check your connection and try again.',                     cta: 'Try Again', isClose: false },
  { heading: "Still can't connect",    body: 'The servers might be busy. One more try?',                 cta: 'Retry',     isClose: false },
  { heading: 'Connection failed',      body: "We'll load countries when your connection improves.",      cta: 'Close',     isClose: true  },
] as const;

const ErrorState = memo<{ attempt: number; onRetry: () => void; onClose: () => void }>(
  ({ attempt, onRetry, onClose }) => {
    const t    = useT();
    const copy = ERR_COPY[Math.min(attempt, ERR_COPY.length - 1)]!;
    return (
      <Animated.View entering={FadeIn.duration(300)} style={_er.wrap}>
        <Feather name="wifi-off" size={44} color={t.textMut} />
        <Text style={[_er.heading, { color: t.text }]}>{copy.heading}</Text>
        <Text style={[_er.body, { color: t.textSec }]}>{copy.body}</Text>
        <Pressable
          onPressIn={() => void hL()}
          onPress={copy.isClose ? onClose : onRetry}
          style={[_er.btn, copy.isClose ? { backgroundColor: t.surfaceW } : { backgroundColor: t.gold }]}
          accessibilityRole="button" accessibilityLabel={copy.cta}
        >
          <Text style={[_er.btnText, { color: copy.isClose ? t.text : palette.cream[50] }]}>{copy.cta}</Text>
        </Pressable>
      </Animated.View>
    );
  },
);
const _er = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 12, flex: 1 },
  heading: { fontFamily: FONT_HEADING.semiBold, fontSize: 18, textAlign: 'center' },
  body:    { fontFamily: FONT_BODY.regular, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  btn:     { height: 44, borderRadius: 12, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnText: { fontFamily: FONT_BODY.semiBold, fontSize: 14 },
});

// ─── FreshnessFooter (PRD-17) — "Radar sweep: X mins ago" ────────────────────
const FreshnessFooter = memo<{ fetchedAt: number | null; tickNow: number }>(({ fetchedAt, tickNow }) => {
  const t = useT();
  if (!fetchedAt) return null;
  const d     = Math.round((tickNow - fetchedAt) / 60_000);
  const label = d < 1 ? 'Radar sweep: just now'
    : d === 1 ? 'Radar sweep: 1 min ago'
    : d < 60  ? `Radar sweep: ${d} mins ago`
    : `Radar sweep: ${new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  return (
    <View style={_ff.wrap}>
      <Text style={[_ff.text, { color: t.textTer }]}>{label}</Text>
    </View>
  );
});
const _ff = StyleSheet.create({
  wrap: { height: IH.FOOTER, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: FONT_BODY.regular, fontSize: 10 },
});

// ─── ArenaVeil (PRD-14) — 650ms gate sequence ─────────────────────────────────
// T+0ms:   Medium haptic (parent)
// T+80ms:  Veil initiates state change (parent delays setState 80ms)
// T+0 of veil visible: veil expands from tapped row Y (scaleY spring from 0.3)
// T+160ms: Flag + name spring in
// T+260ms: Arc sweeps 270° over 280ms → completes T+540ms
// T+300ms: "Entering" subtitle opacity→0.55
// T+500ms: onSelect fires, text crossfade to "activated."
// T+540ms: Arc seal dot appears
// T+580ms: Light haptic + sheet closes (parent)
interface VeilProps {
  country: CountryDoc | null; switchPhase: SwitchPhase;
  tappedY: number; reducedMotion: boolean; visible: boolean;
}
const ArenaVeil = memo<VeilProps>(({ country, switchPhase, tappedY, reducedMotion, visible }) => {
  const veilOp  = useSharedValue(0);
  const veilScY = useSharedValue(0.3);
  const nameOp  = useSharedValue(0);
  const nameY   = useSharedValue(20);
  const arcOff  = useSharedValue(ARC_C);
  const sealOp  = useSharedValue(0);
  const entOp   = useSharedValue(0);
  const actOp   = useSharedValue(0);

  const arcProps  = useAnimatedProps(() => ({ strokeDashoffset: arcOff.value }));
  const sealProps = useAnimatedProps(() => ({ fillOpacity: sealOp.value }));

  const sheetTop  = SCREEN_H * (1 - 0.58);
  const originOff = tappedY - (sheetTop + SCREEN_H * 0.58 * 0.5);

  const veilStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: veilOp.value };
    return {
      opacity: veilOp.value,
      transform: [
        { translateY: originOff },
        { scaleY: veilScY.value },
        { translateY: -originOff },
      ],
    };
  });
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameOp.value, transform: [{ translateY: nameY.value }] }));
  const entStyle  = useAnimatedStyle(() => ({ opacity: entOp.value }));
  const actStyle  = useAnimatedStyle(() => ({ opacity: actOp.value }));

  useEffect(() => {
    if (!visible || !country) {
      veilOp.value = withTiming(0, { duration: 200 });
      veilScY.value = 0.3; nameOp.value = 0; nameY.value = 20;
      arcOff.value = ARC_C; sealOp.value = 0;
      entOp.value = 0; actOp.value = 0;
      return;
    }
    if (reducedMotion) {
      veilOp.value = withTiming(0.92, { duration: 200 });
      nameOp.value = withDelay(100, withTiming(1, { duration: 150 }));
      nameY.value  = 0;
      entOp.value  = withDelay(200, withTiming(0.55, { duration: 150 }));
      return;
    }
    veilOp.value  = withSpring(0.92, SP.VEIL);
    veilScY.value = withSpring(1.0,  SP.VEIL);
    nameOp.value  = withDelay(160, withSpring(1, { mass: 0.9, stiffness: 250, damping: 24 }));
    nameY.value   = withDelay(160, withSpring(0, { mass: 0.9, stiffness: 250, damping: 24 }));
    arcOff.value  = withDelay(260, withTiming(ARC_GAP, { duration: 280, easing: Easing.out(Easing.cubic) }));
    entOp.value   = withDelay(300, withTiming(0.55, { duration: 200 }));
    sealOp.value  = withDelay(540, withTiming(1,    { duration: 60 }));
  }, [visible, country, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (switchPhase !== 'activated') return;
    entOp.value = withTiming(0, { duration: 80 });
    actOp.value = withDelay(90, withTiming(0.55, { duration: 150 }));
  }, [switchPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !country) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink[950] }, veilStyle]} />
      <View style={_vl.content} pointerEvents="none">
        <Animated.View style={[_vl.nameRow, nameStyle]}>
          <Text style={_vl.flag}>{country.emoji}</Text>
          <Text style={_vl.name}>{country.name}</Text>
        </Animated.View>
        <View style={_vl.arcWrap}>
          <Svg width={ARC_SVG} height={ARC_SVG} viewBox={`0 0 ${ARC_SVG} ${ARC_SVG}`}>
            <AnimatedSvgCircle
              cx={ARC_CX} cy={ARC_CY} r={ARC_R}
              stroke={palette.gold[600]} strokeWidth={2}
              fill="none" strokeDasharray={ARC_C}
              rotation={90} origin={`${ARC_CX},${ARC_CY}`}
              animatedProps={arcProps}
            />
            <AnimatedSvgCircle
              cx={SEAL_CX} cy={SEAL_CY} r={3}
              fill={palette.gold[600]}
              animatedProps={sealProps}
            />
          </Svg>
        </View>
        <View style={_vl.subWrap}>
          <Animated.Text style={[_vl.sub, entStyle]}>Entering {country.name}</Animated.Text>
          <Animated.Text style={[_vl.sub, _vl.subAbs, actStyle]}>{country.name} activated.</Animated.Text>
        </View>
      </View>
    </View>
  );
});
const _vl = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 2 },
  flag:    { fontSize: 36 },
  name:    { fontFamily: FONT_HEADING.bold, fontSize: 28, color: palette.cream[50] },
  arcWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  subWrap: { height: 22, alignItems: 'center', justifyContent: 'center', marginTop: 12, width: '100%' as const },
  sub:     { fontFamily: FONT_BODY.regular, fontSize: 13, color: `${palette.cream[50]}8C`, textAlign: 'center' },
  subAbs:  { position: 'absolute' },
});

// ─── Main Component ───────────────────────────────────────────────────────────
function CountryPickerSheetBase({ visible, onClose, selected, onSelect }: CountryPickerSheetProps) {
  // PRD-21: Dark mode
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const tokens      = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);

  const sheetRef   = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['58%', '94%'], []);

  // PRD-07: Dynamic Type row height
  const rowH = useMemo(() => dynRowH(), []);

  const [countries,     setCountries]    = useState<CountryDoc[]>([]);
  const [sheetState,    setSheetState]   = useState<SheetState>('loading');
  const [rawQuery,      setRawQuery]     = useState('');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [regionFilter,  setRegionFilter] = useState<RegionFilter>('All');
  const [errAttempt,    setErrAttempt]   = useState(0);
  const [hasError,      setHasError]     = useState(false);
  const [reducedMotion, setRM]           = useState(false);
  const [recentIds,     setRecentIds]    = useState<string[]>([]);
  const [fetchedAt,     setFetchedAt]    = useState<number | null>(null);
  const [switchingTo,   setSwitchingTo]  = useState<CountryDoc | null>(null);
  const [switchPhase,   setSwitchPhase]  = useState<SwitchPhase>('entering');
  const [tappedY,       setTappedY]      = useState(0);
  const [isRefreshing,  setIsRefreshing] = useState(false);
  const [tickNow,       setTickNow]      = useState(() => Date.now());
  const [activeLetter,  setActiveLetter] = useState<string | null>(null);
  const [nudgeDone,     setNudgeDone]    = useState(false);

  const listRef        = useRef<FlatList<ListItem>>(null);
  const fetchIdRef     = useRef(0);
  const isFetchingRef  = useRef(false);
  const isMountedRef   = useRef(true);
  const isSwitchRef    = useRef(false);
  const retryRef       = useRef(0);
  const selectedRef    = useRef(selected);
  const recentIdsRef   = useRef(recentIds);
  const switchTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { selectedRef.current  = selected;  }, [selected]);
  useEffect(() => { recentIdsRef.current = recentIds; }, [recentIds]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  // Shared values
  const pillsH      = useSharedValue(L.pillRow);
  const pillsO      = useSharedValue(1);
  const sFocus      = useSharedValue(0);
  const shimX       = useSharedValue(-L.shimW);
  const portalLipOp = useSharedValue(0);   // PRD-03: Portal Lip crossfade
  const clearBtnSc  = useSharedValue(0.7); // PRD-04: Clear button entry/exit
  const clearBtnOp  = useSharedValue(0);

  // PRD-12: Shimmer — single worklet for ALL skeleton elements
  useEffect(() => {
    if (sheetState === 'loading') {
      shimX.value = withRepeat(
        withTiming(SCREEN_W + L.shimW, { duration: L.shimDur, easing: Easing.linear }),
        -1, false,
      );
    } else { cancelAnimation(shimX); shimX.value = -L.shimW; }
  }, [sheetState, shimX]);

  // PRD-17: 60s tick for freshness footer
  useEffect(() => {
    if (!fetchedAt) return;
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  // PRD-11: 150ms search debounce
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 150);
    return () => clearTimeout(id);
  }, [rawQuery]);

  useEffect(() => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [searchQuery]);

  // PRD-18: Reduced motion
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // PRD-03: Portal Lip crossfade animation (idle only)
  const trendingLength = useMemo(() => {
    return [...countries].sort((a, b) => b.onlineCount - a.onlineCount).slice(0, TRENDING_COUNT).length;
  }, [countries]);

  useEffect(() => {
    if (sheetState === 'idle' && trendingLength > 0) {
      portalLipOp.value = withTiming(1, { duration: 240 });
    } else {
      portalLipOp.value = withTiming(0, { duration: 180 });
    }
  }, [sheetState, trendingLength, portalLipOp]);

  // PRD-04: Animated clear button — spring entry, timing exit
  useEffect(() => {
    if (rawQuery.length > 0) {
      clearBtnSc.value = withSpring(1,   { mass: 0.5, stiffness: 400, damping: 25 });
      clearBtnOp.value = withSpring(1,   { mass: 0.5, stiffness: 400, damping: 25 });
    } else {
      clearBtnSc.value = withTiming(0.7, { duration: 120, easing: Easing.out(Easing.quad) });
      clearBtnOp.value = withTiming(0,   { duration: 120, easing: Easing.out(Easing.quad) });
    }
  }, [rawQuery, clearBtnSc, clearBtnOp]);

  // PRD-03: Sheet open/close
  useEffect(() => {
    if (visible) {
      if (Keyboard.isVisible?.()) { Keyboard.dismiss(); setTimeout(() => sheetRef.current?.snapToIndex(0), 50); }
      else sheetRef.current?.snapToIndex(0);
      // NOTE: Haptic fires via onChange (snap settle) — not here
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  // Load on open
  useEffect(() => {
    if (!visible) return;
    void migrateRecents();
    retryRef.current = 0; isSwitchRef.current = false;
    const fid = ++fetchIdRef.current;
    setSheetState('loading'); setRawQuery(''); setSearchQuery('');
    setRegionFilter('All'); setHasError(false); setErrAttempt(0); setSwitchingTo(null);

    AsyncStorage.multiGet([CW_RECENTS_KEY, FTUE_KEY]).then(([[, r], [, seen]]) => {
      if (fetchIdRef.current !== fid) return;
      if (r) { try { setRecentIds(JSON.parse(r) as string[]); } catch { /* ignore */ } }
      setNudgeDone(seen === 'true');
    }).catch(() => {});

    fetchCountries()
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== fid || !isMountedRef.current) return;
        setCountries(docs); setFetchedAt(ts); setTickNow(Date.now()); setSheetState('idle');
      })
      .catch(() => {
        if (fetchIdRef.current !== fid || !isMountedRef.current) return;
        setHasError(true); setSheetState('error');
      });
  }, [visible]);

  // PRD-04: Search focus — pills collapse → snap to Snap 1
  const handleFocus = useCallback(() => {
    sFocus.value = withTiming(1, { duration: 180 });
    pillsH.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    pillsO.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    setTimeout(() => sheetRef.current?.snapToIndex(1), 80);
    // Haptic fires via onChange at snap settle — not here
  }, [sFocus, pillsH, pillsO]);

  const handleBlur = useCallback(() => {
    sFocus.value = withTiming(0, { duration: 150 });
    if (!rawQuery.trim()) {
      pillsH.value = withTiming(L.pillRow, { duration: 220, easing: Easing.in(Easing.cubic) });
      pillsO.value = withTiming(1,         { duration: 220, easing: Easing.in(Easing.cubic) });
      setTimeout(() => sheetRef.current?.snapToIndex(0), 100);
    }
  }, [rawQuery, sFocus, pillsH, pillsO]);

  // PRD-12: Pull-to-refresh
  const handleRefresh = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true; setIsRefreshing(true);
    const fid = ++fetchIdRef.current;
    fetchCountries(true)
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== fid || !isMountedRef.current) return;
        setCountries(docs); setFetchedAt(ts); setTickNow(Date.now()); void hOK();
      })
      .catch(() => { if (fetchIdRef.current === fid) void hW(); })
      .finally(() => {
        if (fetchIdRef.current === fid) isFetchingRef.current = false;
        if (isMountedRef.current) setIsRefreshing(false);
      });
  }, []);

  // PRD-13: Retry per attempt
  const handleRetry = useCallback(() => {
    if (isFetchingRef.current || retryRef.current >= MAX_RETRIES) return;
    retryRef.current++;
    isFetchingRef.current = true;
    setErrAttempt(retryRef.current); setHasError(false); setSheetState('loading');
    const fid = ++fetchIdRef.current;
    fetchCountries(true)
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== fid || !isMountedRef.current) return;
        setCountries(docs); setFetchedAt(ts); setSheetState('idle'); setHasError(false);
      })
      .catch(() => {
        if (fetchIdRef.current !== fid || !isMountedRef.current) return;
        setHasError(true); setSheetState('error');
      })
      .finally(() => { if (fetchIdRef.current === fid) isFetchingRef.current = false; });
  }, []);

  // PRD-14: Selection — 650ms gate sequence
  // PRD-14 fix: veil starts at T+80ms, not T+0ms
  const handleSelect = useCallback((country: CountryDoc, pageY: number) => {
    if (isSwitchRef.current) return;

    // PRD-02: re-select = Warning haptic + close, onSelect NOT fired
    if (country.id === selectedRef.current) { void hW(); sheetRef.current?.close(); return; }

    isSwitchRef.current = true;
    void hM();  // T+0ms: Medium haptic (PRD-16)
    Keyboard.dismiss();

    switchTimers.current.forEach(clearTimeout);
    switchTimers.current = [];

    // T+80ms — Arena Threshold Initiates (PRD-14)
    const t80 = setTimeout(() => {
      if (!isMountedRef.current) return;
      setTappedY(pageY);
      setSwitchingTo(country);
      setSwitchPhase('entering');
      setSheetState('switching');
    }, 80);

    // T+500ms: onSelect fires + text swap
    const t500 = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(CW_COUNTRY_KEY, country.id);
        const updated = [country.id, ...recentIdsRef.current.filter((id) => id !== country.id)].slice(0, MAX_RECENTS);
        await AsyncStorage.setItem(CW_RECENTS_KEY, JSON.stringify(updated));
        if (isMountedRef.current) setRecentIds(updated);
      } catch { /* non-critical */ }
      onSelect(country.id, country.name, country.emoji);
      if (isMountedRef.current) setSwitchPhase('activated');
      // PRD-15: assertive accessibility announcement
      AccessibilityInfo.announceForAccessibility(`Entering ${country.name}. Arena selected.`);
    }, 500);

    // T+580ms: Light haptic + close (PRD-16)
    const t580 = setTimeout(() => { void hL(); sheetRef.current?.close(); }, 580);

    // T+800ms: cleanup
    const t800 = setTimeout(() => {
      if (isMountedRef.current) { setSwitchingTo(null); setSheetState('idle'); setSwitchPhase('entering'); }
      isSwitchRef.current = false;
    }, 800);

    switchTimers.current = [t80, t500, t580, t800];
  }, [onSelect]);

  // PRD-17: Memoized derived data
  const trendingCountries = useMemo(
    () => [...countries].sort((a, b) => b.onlineCount - a.onlineCount).slice(0, TRENDING_COUNT),
    [countries],
  );

  // PRD-05: pulse cycle speed from top country heat
  const pulseCycleMs = useMemo(() => {
    const topHeat = trendingCountries[0]?.heat ?? 0;
    return topHeat >= 90 ? 2000 : topHeat >= 75 ? 1400 : 2800;
  }, [trendingCountries]);

  const recentCountries = useMemo(
    () => recentIds.flatMap((id) => { const c = countries.find((x) => x.id === id); return c ? [c] : []; }),
    [recentIds, countries],
  );
  const selectedCountry = useMemo(() => countries.find((c) => c.id === selected) ?? null, [countries, selected]);
  const filtered        = useMemo(() => regionFilter === 'All' ? countries : countries.filter((c) => c.region === regionFilter), [countries, regionFilter]);
  const sortedAZ        = useMemo(() => [...filtered].sort((a, b) => a.name.localeCompare(b.name)), [filtered]);

  // PRD-11: Search with prefix-match sort
  const displayCountries = useMemo(() => {
    if (!searchQuery.trim()) return filtered;
    const q      = searchQuery.trim();
    const nq     = normD(q);
    const isNum  = /^\+?\d+$/.test(q);
    const digits = q.replace(/\D/g, '');
    const matches = filtered.filter((c) =>
      normD(c.name).includes(nq) || c.id.toLowerCase() === nq ||
      (isNum && c.dialCode?.replace(/\D/g, '').startsWith(digits)),
    );
    // PRD-11: Exact prefix match first, contains-match second
    return matches.sort((a, b) => {
      const an = normD(a.name), bn = normD(b.name);
      const aP = an.startsWith(nq), bP = bn.startsWith(nq);
      if (aP && !bP) return -1;
      if (!aP && bP) return  1;
      return 0;
    });
  }, [filtered, searchQuery]);

  const flatData = useMemo<ListItem[]>(
    () => searchQuery.trim() ? buildSearch(displayCountries) : buildSections(sortedAZ),
    [displayCountries, searchQuery, sortedAZ],
  );
  const offsets = useMemo(() => buildOffsets(flatData, rowH), [flatData, rowH]);

  const alphaLetters = useMemo(
    () => searchQuery.trim() ? [] : flatData.filter((i): i is SecItem => i.type === 'section').map((i) => i.letter),
    [flatData, searchQuery],
  );
  const sectionIdxMap = useMemo(() => {
    const m = new Map<string, number>();
    flatData.forEach((item, i) => { if (item.type === 'section') m.set(item.letter, i); });
    return m;
  }, [flatData]);

  // PRD-22 fix: guard on recentIds.length (not recentCountries.length)
  const showNudge    = !nudgeDone && recentIds.length === 0 && sheetState === 'idle';
  const dominantRegion = trendingCountries[0]?.region ?? 'Asia';
  const isAllQuiet   = countries.length > 0 && countries.every((c) => c.onlineCount === 0);

  const handleRegion = useCallback((r: RegionFilter) => { void hS(); setRegionFilter(r); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, []);
  const handleAlpha  = useCallback((l: string) => { const i = sectionIdxMap.get(l); if (i != null) listRef.current?.scrollToIndex({ index: i, animated: !reducedMotion, viewOffset: 0 }); }, [sectionIdxMap, reducedMotion]);
  const clearSearch  = useCallback(() => { setRawQuery(''); }, []);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    return <CountryRow country={item.country} isSelected={item.country.id === selectedRef.current} onPressIn={handleSelect} rowH={rowH} />;
  }, [handleSelect, rowH]);

  const keyExtractor  = useCallback((item: ListItem, i: number): string => item.type === 'section' ? `s-${item.letter}` : `c-${item.country.id}-${i}`, []);
  const getItemLayout = useCallback((_: unknown, i: number) => ({
    length: flatData[i]?.type === 'section' ? IH.SECTION : rowH,
    offset: offsets[i] ?? 0,
    index: i,
  }), [flatData, offsets, rowH]);

  // Animated styles
  const pillsStyle = useAnimatedStyle(() => ({ height: pillsH.value, opacity: pillsO.value, overflow: 'hidden' as const }));
  const searchBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(sFocus.value, [0, 1], [tokens.border, tokens.gold]),
    borderWidth: interpolate(sFocus.value, [0, 1], [1, 1.5]),
  }));
  const portalLipStyle = useAnimatedStyle(() => ({ opacity: portalLipOp.value }));
  const clearBtnStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: clearBtnSc.value }],
    opacity: clearBtnOp.value,
  }));

  // PRD-03: Backdrop 62% opacity, no blur
  const renderBackdrop = useCallback((p: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...p} pressBehavior="close" appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.62} />
  ), []);

  // PRD-11: Empty states
  const isZeroRegion = searchQuery.trim().length > 0 && displayCountries.length === 0 && regionFilter !== 'All';
  const isZeroAll    = searchQuery.trim().length > 0 && displayCountries.length === 0 && regionFilter === 'All';

  const renderEmpty = useCallback(() => {
    if (isZeroRegion) return (
      <Animated.View entering={FadeIn.duration(200)} style={[_em.wrap]}>
        <Feather name="filter" size={40} color={tokens.textMut} />
        <Text style={[_em.heading, { color: tokens.text }]}>No matches in {regionFilter}</Text>
        <Text style={[_em.body, { color: tokens.textSec }]}>This region has no countries matching your search</Text>
        <Pressable
          onPress={() => setRegionFilter('All')}
          style={[_em.btnPrimary, { backgroundColor: tokens.gold }]}
          accessibilityRole="button" accessibilityLabel="Search all regions"
        >
          <Text style={[_em.btnPrimaryText, { color: palette.cream[50] }]}>Search All Regions</Text>
        </Pressable>
        <Pressable
          onPress={clearSearch} style={_em.btnSec}
          accessibilityRole="button" accessibilityLabel="Clear search"
        >
          <Text style={[_em.btnSecText, { color: tokens.gold }]}>Clear Search</Text>
        </Pressable>
      </Animated.View>
    );
    if (isZeroAll) return (
      <Animated.View entering={FadeIn.duration(200)} style={_em.wrap}>
        <Feather name="search" size={40} color={tokens.textMut} />
        <Text style={[_em.heading, { color: tokens.text }]}>No countries found</Text>
        <Text style={[_em.body, { color: tokens.textSec }]}>Try a different spelling or the country's ISO code</Text>
        <Pressable
          onPress={clearSearch} style={_em.btnSec}
          accessibilityRole="button" accessibilityLabel="Clear search"
        >
          <Text style={[_em.btnSecText, { color: tokens.gold }]}>Clear Search</Text>
        </Pressable>
      </Animated.View>
    );
    return null;
  }, [isZeroRegion, isZeroAll, regionFilter, clearSearch, tokens]);

  const showAlpha    = alphaLetters.length > 0 && !searchQuery.trim();
  const showTrending = !searchQuery.trim() && regionFilter === 'All' && trendingCountries.length > 0;
  const showRecents  = recentCountries.length > 0 && !searchQuery.trim();

  // PRD-22: "Awaiting selection..." for FTUE
  const titleEmoji = selectedCountry?.emoji ?? '';
  const titleName  = selectedCountry?.name ?? (recentIds.length === 0 ? 'Awaiting selection...' : '');

  const renderHeader = useCallback(() => (
    <>
      {/* PRD-03: Portal Lip — animated crossfade on idle, dominant region accent */}
      <Animated.View style={[{ height: 1 }, portalLipStyle]}>
        <LinearGradient
          colors={[R_ACCENT40[dominantRegion] ?? 'transparent', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* PRD-05: LIVE ARENAS / QUIET ARENAS */}
      {showTrending && (
        <View style={_sh.trendSection}>
          <View style={_sh.trendLabel}>
            <Text style={[_sh.trendText, { color: tokens.textTer }]}>{isAllQuiet ? 'QUIET ARENAS' : 'LIVE ARENAS'}</Text>
            <LiveDot size={5} color={tokens.green} pulse={!isAllQuiet} />
          </View>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={_sh.trendScroll}
            decelerationRate="fast"
            snapToInterval={L.heroW + 12} snapToAlignment="start"
            keyboardShouldPersistTaps="handled"
            accessibilityLabel="Trending countries"
          >
            {trendingCountries.map((c, i) => (
              <TrendingCard
                key={c.id} country={c} rank={i + 1} isSelected={c.id === selected}
                onPress={handleSelect}
                entryDelay={reducedMotion ? i * 40 : i * 60}
                reducedMotion={reducedMotion}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* PRD-06: Recents or PRD-22: Nudge */}
      {showRecents ? (
        <RecentSection countries={recentCountries} selected={selected} onPressIn={handleSelect} rowH={rowH} />
      ) : showNudge ? (
        <FirstArenaNudge onDismiss={() => setNudgeDone(true)} />
      ) : null}
    </>
  ), [sheetState, showTrending, showRecents, showNudge, trendingCountries, recentCountries, selected, handleSelect, reducedMotion, dominantRegion, isAllQuiet, rowH, tokens, portalLipStyle]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <ThemeCtx.Provider value={tokens}>
      <PulseProvider cycleMs={pulseCycleMs}>
        <BreathingProvider>
          <BottomSheet
            ref={sheetRef}
            index={-1}
            snapPoints={snapPoints}
            keyboardBehavior="fillParent"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            backdropComponent={renderBackdrop}
            enablePanDownToClose
            onClose={onClose}
            // PRD-16: Snap settle haptic — fires at each snap settle
            onChange={(index) => { if (index >= 0) void hL(); }}
            backgroundStyle={[_sh.sheetBg, { backgroundColor: tokens.sheetBg }]}
            handleStyle={_sh.handleContainer}
            handleIndicatorStyle={[_sh.handleIndicator, { backgroundColor: tokens.border }]}
          >
            {/* ── PINNED SHELL (PRD-04) — 136pt total ── */}
            <BottomSheetView style={[_sh.pinnedShell, { backgroundColor: tokens.sheetBg }]}>

              {/* PRD-04: Title row — 44pt */}
              <View style={_sh.titleRow}>
                <Text style={[_sh.titleText, { color: tokens.text }]}>SELECT ARENA</Text>
                {(selectedCountry || recentIds.length === 0) && (
                  <View style={_sh.selInd} accessibilityRole="text" accessibilityLabel={`Current: ${titleName}`}>
                    <View style={[_sh.selSep, { backgroundColor: tokens.border }]} />
                    {titleEmoji ? <Text style={_sh.selEmoji} accessible={false}>{titleEmoji}</Text> : null}
                    <Text style={[_sh.selName, { color: tokens.textTer }]} numberOfLines={1}>{titleName}</Text>
                  </View>
                )}
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [_sh.closeBtn, pressed && { backgroundColor: tokens.surfaceW, borderRadius: 22 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Close country selector"
                  accessibilityHint="Dismisses this sheet without changing your country"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Feather name="x" size={20} color={tokens.closeIcon} />
                </Pressable>
              </View>

              {/* PRD-04: Search bar — 44pt + 4pt×2 = 52pt allocation */}
              <Animated.View style={[_sh.searchWrap, { backgroundColor: tokens.surface }, searchBorderStyle]}>
                <Feather name="search" size={16} color={tokens.textTer} />
                <BottomSheetTextInput
                  style={[_sh.searchInput, { color: tokens.text }]}
                  value={rawQuery}
                  onChangeText={setRawQuery}
                  placeholder="Search countries..."
                  placeholderTextColor={tokens.textMut}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  selectionColor={tokens.gold}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  accessibilityRole="search"
                  accessibilityLabel="Search countries"
                  accessibilityHint="Type a country name, ISO code, or dial code like +91"
                />
                {/* PRD-04: Animated clear button — spring in, timing out */}
                <Animated.View style={clearBtnStyle} pointerEvents={rawQuery.length > 0 ? 'auto' : 'none'}>
                  <Pressable
                    onPressIn={() => void hS()}  // PRD-16: haptic on pressIn
                    onPress={clearSearch}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Feather name="x-circle" size={16} color={tokens.textTer} />
                  </Pressable>
                </Animated.View>
              </Animated.View>

              {/* PRD-04: Region filter row — 52pt, collapses on search focus */}
              <Animated.View style={[_sh.pillWrap, pillsStyle]}>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={_sh.pillScroll}
                  keyboardShouldPersistTaps="always"
                >
                  {REGIONS.map((r) => (
                    <RegionPill key={r} label={r} active={regionFilter === r} accent={PILL_ACCENT[r] ?? tokens.gold} onPress={handleRegion} />
                  ))}
                </ScrollView>
              </Animated.View>

              <View style={[_sh.hairline, { backgroundColor: tokens.borderS }]} />
            </BottomSheetView>

            {/* ── CONTENT ZONE ─────────────────────────────────────────────── */}
            {sheetState === 'loading' ? (
              <BottomSheetView style={{ flex: 1 }}>
                <View style={_sh.trendSection}>
                  <View style={_sh.trendLabel}>
                    <View style={[{ height: 12, width: 120, borderRadius: 6, backgroundColor: tokens.skeleton }]} />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={_sh.trendScroll} scrollEnabled={false}>
                    {Array.from({ length: TRENDING_COUNT }, (_, i) => <SkeletonCard key={i} shimX={shimX} />)}
                  </ScrollView>
                </View>
                <View accessibilityRole="progressbar" accessibilityLabel="Loading countries">
                  {Array.from({ length: L.shimRows }, (_, i) => <SkeletonRow key={i} shimX={shimX} rowH={rowH} />)}
                </View>
              </BottomSheetView>

            ) : hasError ? (
              <BottomSheetView style={{ flex: 1 }}>
                <ErrorState attempt={errAttempt} onRetry={handleRetry} onClose={onClose} />
              </BottomSheetView>

            ) : (
              <View style={_sh.listWrap}>
                {/* PRD-15: A11y live region for search count */}
                {searchQuery.trim().length > 0 && (
                  <View
                    accessible
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`${displayCountries.length} ${displayCountries.length === 1 ? 'country' : 'countries'} found`}
                    style={_sh.srOnly}
                  />
                )}
                <BottomSheetFlatList
                  ref={listRef}
                  data={flatData}
                  extraData={selected}
                  renderItem={renderItem}
                  keyExtractor={keyExtractor}
                  ListHeaderComponent={renderHeader}
                  ListEmptyComponent={renderEmpty}
                  ListFooterComponent={<FreshnessFooter fetchedAt={fetchedAt} tickNow={tickNow} />}
                  showsVerticalScrollIndicator={false}
                  style={_sh.flatList}
                  contentContainerStyle={[_sh.listContent, showAlpha && { paddingRight: L.sideW + 6 }]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={20}
                  maxToRenderPerBatch={20}
                  updateCellsBatchingPeriod={50}
                  windowSize={8}
                  getItemLayout={getItemLayout}
                  onScrollToIndexFailed={(info) => {
                    const off = offsets[info.index] ?? rowH * info.index;
                    listRef.current?.scrollToOffset({ offset: off, animated: false });
                  }}
                  bounces alwaysBounceVertical overScrollMode="always"
                  refreshing={isRefreshing} onRefresh={handleRefresh}
                  accessibilityRole="list" accessibilityLabel="Country list"
                />
                {/* PRD-09: A-Z sidebar */}
                {showAlpha && (
                  <AlphabetSidebar
                    letters={alphaLetters}
                    activeLtr={activeLetter}
                    onPress={handleAlpha}
                    onChange={setActiveLetter}
                  />
                )}
                {/* PRD-10: Letter overlay */}
                <LetterOverlay letter={activeLetter} reducedMotion={reducedMotion} />
              </View>
            )}

            {/* PRD-14: Arena Veil — absolute, covers entire sheet */}
            <ArenaVeil
              country={switchingTo}
              switchPhase={switchPhase}
              tappedY={tappedY}
              reducedMotion={reducedMotion}
              visible={sheetState === 'switching' && switchingTo !== null}
            />
          </BottomSheet>
        </BreathingProvider>
      </PulseProvider>
    </ThemeCtx.Provider>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
// Providers are now inside CountryPickerSheetBase — no outer wrapper needed
export const CountryPickerSheet = memo(CountryPickerSheetBase);
export default CountryPickerSheet;

// ─── Static StyleSheets — layout only, no color properties ───────────────────
const _sh = StyleSheet.create({
  sheetBg:         { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handleContainer: { paddingTop: 8 },
  handleIndicator: { width: L.handleW, height: L.handleH, borderRadius: 2 },
  pinnedShell:     {},
  titleRow:        { height: 44, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8 },
  titleText:       { fontFamily: FONT_BODY.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 },
  selInd:          { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, gap: 8, overflow: 'hidden' },
  selSep:          { width: 1, height: 14 },
  selEmoji:        { fontSize: 20 },
  selName:         { fontFamily: FONT_BODY.medium, fontSize: 12, maxWidth: 90 },
  closeBtn:        { width: L.closeBtn, height: L.closeBtn, alignItems: 'center', justifyContent: 'center' },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: L.searchH, borderRadius: L.searchR, paddingHorizontal: 12, gap: 8, marginTop: L.searchMV, marginBottom: L.searchMV },
  searchInput:     { flex: 1, fontFamily: FONT_BODY.medium, fontSize: 14, paddingVertical: 0 },
  pillWrap:        {},
  pillScroll:      { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  hairline:        { height: 1 },
  listWrap:        { flex: 1, position: 'relative' },
  flatList:        { flex: 1 },
  listContent:     { paddingBottom: Platform.OS === 'android' ? 24 : 20 },
  trendSection:    { paddingBottom: 4 },
  trendLabel:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingTop: 16, paddingBottom: 10 },
  trendText:       { fontFamily: FONT_BODY.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
  trendScroll:     { paddingLeft: 20, paddingRight: 20, gap: 12 },
  srOnly:          { width: 0, height: 0, overflow: 'hidden' },
});

// PRD-11: Empty state styles
const _em = StyleSheet.create({
  wrap:           { alignItems: 'center', paddingTop: 44, paddingBottom: 32, paddingHorizontal: 20, gap: 12, flex: 1 },
  heading:        { fontFamily: FONT_HEADING.semiBold, fontSize: 16, textAlign: 'center' },
  body:           { fontFamily: FONT_BODY.regular, fontSize: 13, textAlign: 'center', maxWidth: 260 },
  btnPrimary:     { height: 44, borderRadius: 12, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', width: SCREEN_W - 40, marginTop: 24 },
  btnPrimaryText: { fontFamily: FONT_BODY.semiBold, fontSize: 14 },
  btnSec:         { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnSecText:     { fontFamily: FONT_BODY.semiBold, fontSize: 14 },
});

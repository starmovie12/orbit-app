/**
 * components/organisms/SectorPickerSheet.tsx
 *
 * CROWD WORLD — Sector Picker Bottom Sheet
 * Blueprint v5.0 BAAP EDITION · § 17 · Production Ready
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * Half-sheet (50% screen H) bottom sheet for selecting a sector within the
 * active city. Triggered by tapping the Sector Pill in the Home header (Row 2),
 * profile edit, and post-city-selection onboarding flow.
 *
 * Key features:
 *   • Real-time Firestore sectors via subscribeSectorsByCity()
 *   • Shimmer skeleton (8 rows · 64px · 1200ms) while loading
 *   • Instant client-side search filter ("Sector dhundo...")
 *   • Sort toggle: Heat (default) · Online · A-Z — with LayoutAnimation re-sort
 *   • Per row: sector icon circle · name · colony tag · online count · heat pill
 *   • Animated HeatPulseDot (score-mapped color · pulsing ring)
 *   • Heat pill ONLY shown when heatScore ≥ 30 (visibility threshold)
 *   • Active sector: 2px gold-600 left border + cream-50 bg + golden ✓ top-right
 *   • 5 states: loading · idle · search-active · empty · error
 *
 * ── DESIGN SPEC (Blueprint § 17) ─────────────────────────────────────────────
 *
 *   Sheet height    : 50% screen · drag-down / scrim-tap → dismiss
 *   Title           : "Sector chuno · {City} mein" · 18px/700/ink-950 · centered
 *   Subtitle        : "{N} sectors" · 12px/500/ink-500 · centered
 *   Search input    : 44px H · radius 22px · cream-200 bg · "Sector dhundo..."
 *   Sort toggle     : 3 chips (Heat · Online · A-Z) · 32px H · 8px gap
 *                     Active: gold-600 bg + white text
 *                     Inactive: cream-50 bg + ink-700 text + 1px cream-400 border
 *   Sector row      : 64px H · 16px L/R pad
 *                     Left icon : 24×24 cream-200 circle · first letter gold-700
 *                     Middle    : name 15px/600/ink-950 + colony tag 12px/500/ink-500
 *                     Right     : online count + HeatPulseDot + heat pill (score ≥ 30)
 *                     Active    : 2px gold-600 left bar + cream-50 bg + ✓ top-right
 *   Skeleton        : 8 rows · shimmer cream-200 ↔ white · 1200ms
 *
 * ── BUGS FIXED vs CityPickerSheet ────────────────────────────────────────────
 *
 *   ✅  BottomSheet named import (not default — BottomSheet has no default export)
 *   ✅  maxHeight={SCREEN_H * 0.5} instead of non-existent snapPoint prop
 *   ✅  T token object properly defined (was undefined in CityPickerSheet)
 *   ✅  subscribeSectorsByCity from lib/firestore-rooms (no missing import)
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   components/BottomSheet.tsx
 *   lib/firestore-rooms.ts
 *   components/atoms/HeatPulseDot.tsx
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
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Feather }    from '@expo/vector-icons';
import * as Haptics   from 'expo-haptics';

import { BottomSheet }                          from '@/components/BottomSheet';
import { subscribeSectorsByCity }               from '@/lib/firestore-rooms';
import type { SectorRow }                       from '@/lib/firestore-rooms';
import HeatPulseDot                             from '@/components/atoms/HeatPulseDot';
import { colors, palette }                      from '@/constants/colors';
import { FONT_BODY }                             from '@/constants/typography';

// ─── Enable LayoutAnimation on Android ───────────────────────────────────────
// setLayoutAnimationEnabledExperimental must be called before any
// LayoutAnimation.configureNext call — once at module level is sufficient.
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Screen geometry ──────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;

// ─── Layout constants (L) ─────────────────────────────────────────────────────
const L = {
  rowH:              64,    // Sector row height · blueprint exact
  rowPadH:           16,    // Row horizontal padding · blueprint exact
  searchH:           44,    // Search input height · blueprint exact
  chipH:             32,    // Sort chip height · blueprint exact
  chipPadH:          16,    // Sort chip horizontal padding · blueprint exact
  iconCircleSize:    24,    // Sector icon circle diameter · blueprint exact
  iconFontSize:      12,    // Icon circle letter size
  activeBarW:         2,    // Left active accent bar width · blueprint "2px"
  checkSize:         12,    // Active ✓ icon size · top-right corner
  heatPillH:         22,    // Heat pill height · blueprint exact
  heatPillPadH:       8,    // Heat pill horizontal padding
  heatPillFontSize:  12,    // Heat pill label font size · blueprint exact
  heatScoreThreshold:30,    // Heat pill only shown when score ≥ this value
  onlineCountFontSz: 12,    // Online count font size · blueprint exact
  sectorNameFontSz:  15,    // Sector name font size · blueprint exact
  colonyTagFontSz:   12,    // Colony tag font size · blueprint exact
  titleFontSz:       18,    // Title font size · blueprint exact
  subtitleFontSz:    12,    // Subtitle font size
  sortGap:            8,    // Gap between sort chips · blueprint exact
  skeletonRows:       8,    // Skeleton row count · blueprint exact
  skeletonRowH:      64,    // Skeleton row height · blueprint exact
  shimmerDuration: 1200,    // Shimmer cycle · 1200ms
  pressDuration:     80,    // Press down animation (ms)
  pressScale:      0.97,    // Row press-down scale
  dotSize:            8,    // HeatPulseDot size
} as const;

// ─── Design token alias (T) ──────────────────────────────────────────────────
//
// Merges all layout constants (L.*) with semantic color tokens so StyleSheet
// rules reference one namespace. All colors come from the v2.0 token system —
// zero hardcoded hex values below.
//
// Color mapping:
//   T.ink950      = palette.ink[950]    #1A1208  primary text
//   T.ink600      = palette.ink[600]    #6B5B47  secondary text
//   T.ink700      = palette.ink[700]    #524539  inactive sort chip text
//   T.ink500      = palette.ink[500]    #8A7960  colony tag / subtitle text
//   T.cream50     = palette.cream[50]   #FFF9EC  active row bg / inactive chip bg
//   T.cream100    = palette.cream[100]  #FBF4E2  sector row pressed state
//   T.cream200    = palette.cream[200]  #F7ECD0  icon circle bg / input bg
//   T.cream400    = palette.cream[400]  #E5CC95  borders / dividers
//   T.gold600     = palette.gold[600]   #C9A227  active accent / heat pill bg
//   T.gold700     = palette.gold[700]   #A88A24  icon circle letter color
//   T.crimson600  = palette.crimson[600] #C4294F error states
//   T.white       = palette.white        #FFFFFF  text on gold bg
//   T.sheetBg     = colors.bg.surface    #FFFFFF  sheet background
//
const T = {
  ...L,
  ink950:    palette.ink[950],
  ink700:    palette.ink[700],
  ink600:    palette.ink[600],
  ink500:    palette.ink[500],
  cream50:   palette.cream[50],
  cream100:  palette.cream[100],
  cream200:  palette.cream[200],
  cream400:  palette.cream[400],
  gold600:   palette.gold[600],
  gold700:   palette.gold[700],
  crimson600: palette.crimson[600],
  white:     palette.white,
  sheetBg:   colors.bg.surface,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectorPickerSheetProps {
  /** Controls sheet visibility */
  visible:  boolean;
  /** Called when sheet should close (backdrop tap, drag-down, or after selection) */
  onClose:  () => void;
  /** City to load sectors for — e.g. "chandigarh" */
  cityId:   string;
  /** Currently selected sectorId — used to highlight the active row */
  selected: string;
  /** Called with the new sectorId after user confirms selection */
  onSelect: (sector: string) => void;
}

type SortKey   = 'heat' | 'online' | 'alpha';
type SheetState = 'loading' | 'idle' | 'error';

// ─── Shimmer hook ─────────────────────────────────────────────────────────────
//
// Oscillates 0 → 1 every 1200ms while `isActive` is true.
// Loop stops and resets when data arrives or an error occurs, releasing
// the JS-thread animation budget entirely.
// useNativeDriver:false is required — backgroundColor can't use the native driver.

function useShimmer(isActive: boolean): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue:         1,
          duration:        T.shimmerDuration / 2,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue:         0,
          duration:        T.shimmerDuration / 2,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, anim]);

  return anim;
}

// ─── Helper: format online count ─────────────────────────────────────────────
function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000)  return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Helper: cityId → display name ───────────────────────────────────────────
// "chandigarh" → "Chandigarh" | "new-delhi" → "New-delhi" (best-effort)
function cityDisplayName(cityId: string): string {
  return cityId.charAt(0).toUpperCase() + cityId.slice(1);
}

// ─── Sub-component: SkeletonRow ───────────────────────────────────────────────
//
// Blueprint § 17: 8 rows · 64px H · icon rect 24×24 + text blocks + right rects
// Shimmer: cream-200 ↔ white · 1200ms · synchronized

interface SkeletonRowProps {
  shimmer: Animated.Value;
}

const SkeletonRow = memo<SkeletonRowProps>(({ shimmer }) => {
  const bg = shimmer.interpolate({
    inputRange:  [0, 1],
    outputRange: [T.cream200, T.sheetBg],
  });

  return (
    <View style={styles.skeletonRow} accessibilityElementsHidden>
      {/* Icon circle placeholder */}
      <Animated.View style={[styles.skeletonIcon, { backgroundColor: bg }]} />

      {/* Text block */}
      <View style={styles.skeletonTextBlock}>
        <Animated.View style={[styles.skeletonLinePrimary,   { backgroundColor: bg }]} />
        <Animated.View style={[styles.skeletonLineSecondary, { backgroundColor: bg }]} />
      </View>

      {/* Right: count + dot */}
      <View style={styles.skeletonRightBlock}>
        <Animated.View style={[styles.skeletonRightLine, { backgroundColor: bg }]} />
        <Animated.View style={[styles.skeletonDot,       { backgroundColor: bg }]} />
      </View>
    </View>
  );
});

SkeletonRow.displayName = 'SectorPickerSheet.SkeletonRow';

// ─── Sub-component: SortChip ──────────────────────────────────────────────────
//
// Blueprint § 17 [4]:
//   Active  : gold-600 bg · white text · no border
//   Inactive: cream-50 bg · ink-700 text · 1px cream-400 border

interface SortChipProps {
  label:    string;
  isActive: boolean;
  onPress:  () => void;
}

const SortChip = memo<SortChipProps>(({ label, isActive, onPress }) => {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue:         T.pressScale,
      duration:        T.pressDuration,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue:    1,
      useNativeDriver: true,
      tension:    280,
      friction:   14,
    }).start();
  }, [pressAnim]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.sortChip,
          isActive ? styles.sortChipActive : styles.sortChipInactive,
          { transform: [{ scale: pressAnim }] },
        ]}
      >
        <Text
          style={[
            styles.sortChipText,
            isActive ? styles.sortChipTextActive : styles.sortChipTextInactive,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

SortChip.displayName = 'SectorPickerSheet.SortChip';

// ─── Sub-component: SectorListRow ─────────────────────────────────────────────
//
// Blueprint § 17 [5]:
//   64px H · 16px L/R · horizontal flex
//   Left    : 24×24 cream-200 circle with sector initial in gold-700
//   Middle  : name 15/600/ink-950 · colony tag 12/500/ink-500
//   Right   : online count 12/500/ink-500 · HeatPulseDot · heat pill (score ≥ 30)
//   Active  : 2px gold-600 left bar + cream-50 bg + golden ✓ top-right

interface SectorListRowProps {
  sector:     SectorRow;
  isSelected: boolean;
  onPress:    () => void;
  reducedMotion: boolean;
}

const SectorListRow = memo<SectorListRowProps>(
  ({ sector, isSelected, onPress, reducedMotion }) => {
    const pressAnim = useRef(new Animated.Value(1)).current;

    const onPressIn = useCallback(() => {
      Animated.timing(pressAnim, {
        toValue:         T.pressScale,
        duration:        T.pressDuration,
        useNativeDriver: true,
      }).start();
    }, [pressAnim]);

    const onPressOut = useCallback(() => {
      Animated.spring(pressAnim, {
        toValue:    1,
        useNativeDriver: true,
        tension:    280,
        friction:   14,
      }).start();
    }, [pressAnim]);

    const showHeatPill    = sector.heatScore >= T.heatScoreThreshold;
    const sectorInitial   = sector.sectorName.charAt(0).toUpperCase();
    const formattedOnline = formatCount(sector.onlineCount);

    const accessLabel = [
      sector.sectorName,
      sector.colonyTag ?? '',
      `${formattedOnline} online`,
      `heat ${sector.heatScore}`,
      isSelected ? 'selected' : '',
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessLabel}
        accessibilityState={{ selected: isSelected }}
        accessibilityHint={
          isSelected
            ? 'Currently selected sector'
            : 'Double tap to switch to this sector'
        }
      >
        <Animated.View
          style={[
            styles.sectorRow,
            isSelected && styles.sectorRowActive,
            { transform: [{ scale: pressAnim }] },
          ]}
        >
          {/* ── Left accent bar (active only) ──────────────────────────────── */}
          {isSelected && <View style={styles.activeAccentBar} />}

          {/* ── Sector icon circle ─────────────────────────────────────────── */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconLetter}>{sectorInitial}</Text>
          </View>

          {/* ── Middle: name + colony tag ──────────────────────────────────── */}
          <View style={styles.sectorMid}>
            <Text
              style={[styles.sectorName, isSelected && styles.sectorNameActive]}
              numberOfLines={1}
            >
              {sector.sectorName}
            </Text>

            {sector.colonyTag ? (
              <Text style={styles.colonyTag} numberOfLines={1}>
                {sector.colonyTag}
              </Text>
            ) : null}
          </View>

          {/* ── Right: online count · HeatPulseDot · heat pill ──────────────── */}
          <View style={styles.sectorRight}>
            {/* Online count */}
            <Text style={styles.onlineCount}>{formattedOnline} online</Text>

            {/* Animated heat dot */}
            <View style={styles.dotWrapper}>
              <HeatPulseDot score={sector.heatScore} size={T.dotSize} />
            </View>

            {/* Heat pill — only when score ≥ 30 */}
            {showHeatPill && (
              <View
                style={styles.heatPill}
                accessibilityLabel={`Heat score ${sector.heatScore}`}
                accessibilityRole="text"
              >
                <Text style={styles.heatPillText}>🔥 {sector.heatScore}</Text>
              </View>
            )}
          </View>

          {/* ── Golden ✓ top-right (active only) ──────────────────────────── */}
          {isSelected && (
            <View
              style={styles.checkCorner}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <Feather name="check" size={T.checkSize} color={T.gold600} />
            </View>
          )}
        </Animated.View>
      </Pressable>
    );
  },
);

SectorListRow.displayName = 'SectorPickerSheet.SectorListRow';

// ─── Main component ───────────────────────────────────────────────────────────

function SectorPickerSheetBase({
  visible,
  onClose,
  cityId,
  selected,
  onSelect,
}: SectorPickerSheetProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [sectors,       setSectors]      = useState<SectorRow[]>([]);
  const [sheetState,    setSheetState]   = useState<SheetState>('loading');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [sortKey,       setSortKey]      = useState<SortKey>('heat');
  const [reducedMotion, setReducedMotion]= useState(false);

  const searchRef = useRef<TextInput>(null);

  // Shimmer runs only while skeleton is visible
  const shimmer = useShimmer(sheetState === 'loading');

  // ── Accessibility: reduced motion ─────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // ── Subscribe to sectors when sheet opens ─────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    setSheetState('loading');
    setSearchQuery('');

    let unsub: (() => void) | undefined;

    try {
      unsub = subscribeSectorsByCity(cityId, (rows) => {
        setSectors(rows);
        setSheetState('idle');
      });
    } catch (err) {
      console.error('[SectorPickerSheet] subscribe error:', err);
      setSheetState('error');
    }

    return () => unsub?.();
  }, [visible, cityId]);

  // ── Filtered + sorted sector list ─────────────────────────────────────────
  const displaySectors = useMemo<SectorRow[]>(() => {
    // 1. Search filter
    let list = sectors;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.sectorName.toLowerCase().includes(q) ||
          (s.colonyTag?.toLowerCase().includes(q) ?? false),
      );
    }

    // 2. Sort
    const sorted = [...list];
    switch (sortKey) {
      case 'heat':
        sorted.sort((a, b) => b.heatScore - a.heatScore);
        break;
      case 'online':
        sorted.sort((a, b) => b.onlineCount - a.onlineCount);
        break;
      case 'alpha':
        sorted.sort((a, b) => a.sectorName.localeCompare(b.sectorName));
        break;
    }
    return sorted;
  }, [sectors, searchQuery, sortKey]);

  // ── Sort change ────────────────────────────────────────────────────────────
  const handleSortChange = useCallback(
    (key: SortKey) => {
      if (key === sortKey) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setSortKey(key);
    },
    [sortKey, reducedMotion],
  );

  // ── Sector selection ───────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (sector: SectorRow) => {
      if (sector.sectorId === selected) {
        onClose();
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();
      onSelect(sector.sectorId);
      onClose();
    },
    [selected, onSelect, onClose],
  );

  // ── Retry on error ─────────────────────────────────────────────────────────
  //
  // Bug fix: previous version called unsub() inside the callback, cancelling
  // the real-time listener after the very first batch of data. Also a second
  // active subscription would overlap with the main useEffect one.
  // Fix: store unsub in a ref so the subscription stays alive, and cancel any
  // previous subscription before creating a new one.
  const retryUnsubRef = useRef<(() => void) | undefined>(undefined);

  const handleRetry = useCallback(() => {
    retryUnsubRef.current?.();             // cancel any previous retry subscription
    setSheetState('loading');
    try {
      retryUnsubRef.current = subscribeSectorsByCity(cityId, (rows) => {
        setSectors(rows);
        setSheetState('idle');
      });
    } catch (err) {
      console.error('[SectorPickerSheet] retry error:', err);
      setSheetState('error');
    }
  }, [cityId]);

  // ── Clear search ───────────────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchRef.current?.focus();
  }, []);

  // ── FlatList helpers ───────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: SectorRow) => item.sectorId, []);

  const renderSectorRow = useCallback(
    ({ item }: { item: SectorRow }) => (
      <SectorListRow
        sector={item}
        isSelected={item.sectorId === selected}
        onPress={() => handleSelect(item)}
        reducedMotion={reducedMotion}
      />
    ),
    [selected, handleSelect, reducedMotion],
  );

  const ItemSeparator = useCallback(
    () => <View style={styles.rowDivider} />,
    [],
  );

  // ── Derived display values ─────────────────────────────────────────────────
  const cityName     = cityDisplayName(cityId);
  const sectorCount  = sectors.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight={SCREEN_H * 0.5}
    >
      {/* ── Title + Subtitle ─────────────────────────────────────────────── */}
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          Sector chuno · {cityName} mein
        </Text>
        {sheetState !== 'loading' && sectorCount > 0 && (
          <Text style={styles.subtitle}>
            {sectorCount} sector{sectorCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* ── Search Input ─────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Feather
            name="search"
            size={18}
            color={colors.fg.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Sector dhundo..."
            placeholderTextColor={colors.fg.tertiary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
            clearButtonMode="never"
            accessibilityLabel="Sector search"
            accessibilityHint="Type to filter the sector list"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={handleClearSearch}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.clearCircle}>
                <Feather name="x" size={10} color={T.sheetBg} />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Sort Toggle ──────────────────────────────────────────────────── */}
      {sheetState !== 'loading' && (
        <View
          style={styles.sortRow}
          accessibilityRole="tablist"
          accessibilityLabel="Sort sectors by"
        >
          <SortChip
            label="🔥 Heat"
            isActive={sortKey === 'heat'}
            onPress={() => handleSortChange('heat')}
          />
          <SortChip
            label="👥 Online"
            isActive={sortKey === 'online'}
            onPress={() => handleSortChange('online')}
          />
          <SortChip
            label="A-Z"
            isActive={sortKey === 'alpha'}
            onPress={() => handleSortChange('alpha')}
          />
        </View>
      )}

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      {sheetState !== 'loading' && <View style={styles.sectionDivider} />}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={styles.listArea}>

        {/* LOADING: 8 skeleton rows */}
        {sheetState === 'loading' && (
          <View>
            {Array.from({ length: T.skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} shimmer={shimmer} />
            ))}
          </View>
        )}

        {/* IDLE: sector list */}
        {sheetState === 'idle' && displaySectors.length > 0 && (
          <FlatList
            data={displaySectors}
            renderItem={renderSectorRow}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={ItemSeparator}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={styles.listContent}
            accessibilityRole="list"
          />
        )}

        {/* EMPTY: no search results */}
        {sheetState === 'idle' && displaySectors.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={36} color={T.cream400} />
            <Text style={styles.emptyTitle}>Koi sector nahi mila</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `"${searchQuery}" se match karne wala\nkoi sector nahi hai`
                : `${cityName} mein abhi koi sector\navailable nahi hai`}
            </Text>
            {searchQuery.length > 0 && (
              <Pressable
                onPress={handleClearSearch}
                style={styles.emptyButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Text style={styles.emptyButtonText}>Search clear karo</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ERROR: Firestore fetch failed */}
        {sheetState === 'error' && (
          <View style={styles.errorState}>
            <Feather name="wifi-off" size={32} color={T.crimson600} />
            <Text style={styles.errorTitle}>Kuch gadbad ho gayi</Text>
            <Text style={styles.errorSubtitle}>
              Sectors load nahi hue.{'\n'}Internet check karo aur retry karo.
            </Text>
            <Pressable
              onPress={handleRetry}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading sectors"
            >
              <Feather
                name="refresh-cw"
                size={14}
                color={T.white}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryButtonText}>Retry karo</Text>
            </Pressable>
          </View>
        )}

      </View>
    </BottomSheet>
  );
}

export default memo(SectorPickerSheetBase);

SectorPickerSheetBase.displayName = 'SectorPickerSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// All color values come from T.* — the token alias defined above.
// All numeric values come from T.* (which spreads L.*).
// Zero hardcoded hex values — every color is traceable to colors.ts.

const styles = StyleSheet.create({

  // ── Title block ───────────────────────────────────────────────────────────
  titleBlock: {
    alignItems:  'center',
    paddingTop:   16,
    paddingBottom: 4,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily:  FONT_BODY.bold,           // DM Sans 700 · blueprint sheetTitle
    fontSize:    T.titleFontSz,    // 18 · blueprint exact
    fontWeight:  '700',
    color:       T.ink950,
    textAlign:   'center',
    lineHeight:  24,
  },
  subtitle: {
    fontFamily:  FONT_BODY.medium,         // DM Sans 500 · blueprint sheetSubtitle
    fontSize:    T.subtitleFontSz, // 12
    fontWeight:  '500',
    color:       T.ink500,
    textAlign:   'center',
    marginTop:   4,
    lineHeight:  16,
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: T.rowPadH,   // 16
    paddingTop:        12,
    paddingBottom:      8,
  },
  searchInputWrap: {
    height:          T.searchH,     // 44 · blueprint exact
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: T.cream200,    // cream-200 bg · blueprint exact
    borderRadius:    22,            // radius 22px · blueprint exact
    borderWidth:     1,
    borderColor:     T.cream400,
    paddingRight:    12,
  },
  searchIcon: {
    marginLeft:  12,
    marginRight:  8,
  },
  searchInput: {
    flex:     1,
    height:   T.searchH,
    fontFamily: FONT_BODY.regular,         // DM Sans 400
    fontSize: 14,
    color:    T.ink950,
    ...Platform.select({ android: { paddingVertical: 0 } }),
  },
  clearButton: {
    marginLeft:     4,
    alignItems:     'center',
    justifyContent: 'center',
  },
  clearCircle: {
    width:           18,
    height:          18,
    borderRadius:     9,
    backgroundColor: T.ink600,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Sort toggle ───────────────────────────────────────────────────────────
  sortRow: {
    flexDirection:   'row',
    paddingHorizontal: T.rowPadH,  // 16
    paddingBottom:    12,
    gap:             T.sortGap,    // 8 · blueprint exact
  },
  sortChip: {
    height:       T.chipH,         // 32 · blueprint exact
    borderRadius: T.chipH / 2,     // full pill
    paddingHorizontal: T.chipPadH, // 16 · blueprint exact
    justifyContent: 'center',
    alignItems:     'center',
  },
  sortChipActive: {
    backgroundColor: T.gold600,   // gold-600 bg · blueprint exact
  },
  sortChipInactive: {
    backgroundColor: T.cream50,   // cream-50 bg · blueprint exact
    borderWidth:     1,
    borderColor:     T.cream400,  // 1px cream-400 border · blueprint exact
  },
  sortChipText: {
    fontFamily: FONT_BODY.semiBold,        // DM Sans 600
    fontSize:   13,
    fontWeight: '600',
    lineHeight: 18,
  },
  sortChipTextActive: {
    color: T.white,               // white text · blueprint exact
  },
  sortChipTextInactive: {
    color: T.ink700,              // ink-700 text · blueprint exact
  },

  // ── Dividers ──────────────────────────────────────────────────────────────
  sectionDivider: {
    height:          1,
    backgroundColor: T.cream400,
    opacity:         0.6,
  },
  rowDivider: {
    height:          1,
    backgroundColor: T.cream400,
    marginLeft:      T.rowPadH + T.iconCircleSize + 12, // indent past icon
    opacity:         0.45,
  },

  // ── List area ─────────────────────────────────────────────────────────────
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },

  // ── Sector row ────────────────────────────────────────────────────────────
  // Blueprint § 17 [5]: 64px H · 16px L/R · horizontal flex
  sectorRow: {
    height:          T.rowH,        // 64 · blueprint exact
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: T.rowPadH,   // 16 · blueprint exact
    backgroundColor: T.sheetBg,
    overflow:        'hidden',
    position:        'relative',
  },
  sectorRowActive: {
    backgroundColor: T.cream50,    // cream-50 bg · blueprint exact
  },
  activeAccentBar: {
    position:       'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           T.activeBarW, // 2px · blueprint exact
    backgroundColor: T.gold600,    // gold-600 · blueprint exact
  },

  // ── Sector icon circle ────────────────────────────────────────────────────
  // Blueprint § 17 [5]: "24×24 cream-200 circle with first letter in gold-700"
  iconCircle: {
    width:           T.iconCircleSize,  // 24 · blueprint exact
    height:          T.iconCircleSize,  // 24 · blueprint exact
    borderRadius:    T.iconCircleSize / 2,
    backgroundColor: T.cream200,        // cream-200 · blueprint exact
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
    marginLeft:      T.activeBarW + 2,  // offset for accent bar
    flexShrink:      0,
  },
  iconLetter: {
    fontFamily: FONT_BODY.bold,            // DM Sans 700
    fontSize:   T.iconFontSize,  // 12
    fontWeight: '700',
    color:      T.gold700,       // gold-700 · blueprint exact
    lineHeight: 16,
  },

  // ── Middle: name + colony tag ─────────────────────────────────────────────
  sectorMid: {
    flex:    1,
    marginRight: 8,
  },
  sectorName: {
    fontFamily: FONT_BODY.semiBold,        // DM Sans 600 · blueprint sheetRowPrimary
    fontSize:   T.sectorNameFontSz, // 15 · blueprint exact
    fontWeight: '600',
    color:      T.ink950,
    lineHeight: 20,
  },
  sectorNameActive: {
    color: T.gold600,
  },
  colonyTag: {
    fontFamily: FONT_BODY.medium,          // DM Sans 500 · blueprint sheetRowSecondary
    fontSize:   T.colonyTagFontSz,  // 12 · blueprint exact
    fontWeight: '500',
    color:      T.ink500,           // ink-500 · blueprint exact
    lineHeight: 16,
    marginTop:   2,
  },

  // ── Right: online + dot + heat pill ──────────────────────────────────────
  sectorRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            6,
    flexShrink:     0,
  },
  onlineCount: {
    fontFamily: FONT_BODY.medium,          // DM Sans 500
    fontSize:   T.onlineCountFontSz, // 12 · blueprint exact
    fontWeight: '500',
    color:      T.ink500,            // ink-500 · blueprint exact
  },
  dotWrapper: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Heat pill (score ≥ 30 only) ───────────────────────────────────────────
  // Blueprint § 17 [5]: "22px H · amber-600 bg · radius 11px · 8px H padding"
  heatPill: {
    height:          T.heatPillH,        // 22 · blueprint exact
    borderRadius:    T.heatPillH / 2,    // radius 11px · blueprint exact
    paddingHorizontal: T.heatPillPadH,   // 8 · blueprint exact
    backgroundColor: T.gold600,          // gold-600 brand color
    justifyContent:  'center',
    alignItems:      'center',
  },
  heatPillText: {
    fontFamily: FONT_BODY.bold,            // DM Sans 700
    fontSize:   T.heatPillFontSize,  // 12 · blueprint exact
    fontWeight: '700',
    color:      T.white,             // white · blueprint exact
    lineHeight: 16,
  },

  // ── Active ✓ top-right corner ─────────────────────────────────────────────
  // Blueprint § 17 [5]: "golden ✓ overlay top-right corner"
  checkCorner: {
    position:       'absolute',
    top:             6,
    right:           8,
    width:           16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Skeleton rows ─────────────────────────────────────────────────────────
  skeletonRow: {
    height:          T.skeletonRowH,    // 64 · blueprint exact
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: T.rowPadH,       // 16
    gap:              12,
  },
  skeletonIcon: {
    width:        T.iconCircleSize,     // 24
    height:       T.iconCircleSize,
    borderRadius: T.iconCircleSize / 2,
    flexShrink:   0,
  },
  skeletonTextBlock: {
    flex: 1,
    gap:   8,
  },
  skeletonLinePrimary: {
    height:       14,
    width:        '65%',
    borderRadius:  7,
  },
  skeletonLineSecondary: {
    height:       10,
    width:        '40%',
    borderRadius:  5,
  },
  skeletonRightBlock: {
    alignItems: 'flex-end',
    gap:          6,
    flexShrink:   0,
  },
  skeletonRightLine: {
    height:       10,
    width:        52,
    borderRadius:  5,
  },
  skeletonDot: {
    width:        12,
    height:       12,
    borderRadius:  6,
    opacity:      0.5,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 32,
    paddingTop:       24,
    gap:              10,
  },
  emptyTitle: {
    fontFamily: FONT_BODY.semiBold,        // DM Sans 600
    fontSize:   17,
    fontWeight: '600',
    color:      T.ink950,
    textAlign:  'center',
    marginTop:   6,
  },
  emptySubtitle: {
    fontFamily: FONT_BODY.regular,         // DM Sans 400
    fontSize:   14,
    color:      T.ink600,
    textAlign:  'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop:         8,
    paddingHorizontal: 18,
    paddingVertical:    8,
    borderRadius:      20,
    backgroundColor:   T.cream200,
    borderWidth:        1,
    borderColor:       T.cream400,
  },
  emptyButtonText: {
    fontFamily: FONT_BODY.medium,          // DM Sans 500
    fontSize:   14,
    fontWeight: '500',
    color:      T.gold600,
  },

  // ── Error state ───────────────────────────────────────────────────────────
  errorState: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 32,
    paddingTop:       24,
    gap:              10,
  },
  errorTitle: {
    fontFamily: FONT_BODY.semiBold,        // DM Sans 600
    fontSize:   17,
    fontWeight: '600',
    color:      T.crimson600,
    textAlign:  'center',
    marginTop:   6,
  },
  errorSubtitle: {
    fontFamily: FONT_BODY.regular,         // DM Sans 400
    fontSize:   14,
    color:      T.ink600,
    textAlign:  'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop:         8,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 18,
    paddingVertical:    9,
    borderRadius:      20,
    backgroundColor:   T.gold600,
  },
  retryButtonText: {
    fontFamily: FONT_BODY.semiBold,        // DM Sans 600
    fontSize:   14,
    fontWeight: '600',
    color:      T.white,
  },

});

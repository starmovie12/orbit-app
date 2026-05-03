/**
 * components/organisms/CityPickerSheet.tsx
 *
 * CROWD WORLD — City Selection Bottom Sheet
 * Blueprint v5.0 BAAP EDITION · Production Ready
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * Half-sheet (50% screen H) bottom sheet for switching the user's active city.
 * Triggered by tapping the City Picker Pill in the Home header.
 *
 * Key features:
 *   • Firestore /cities real-time collection (cached after first fetch)
 *   • Shimmer skeleton (6 rows · 64px · 1200ms) while loading
 *   • Instant client-side search filter ("City dhundo...")
 *   • Recent Cities horizontal strip (AsyncStorage · max 5 cities)
 *   • Active city: 2px gold-600 left border + cream bg highlight
 *   • On select: AsyncStorage + Firestore user profile update (parallel)
 *   • Spinner overlay during city switch (24×24 gold-600)
 *   • 5 states: loading · idle · search-active · empty · error
 *
 * ── DESIGN SPEC (Blueprint § 2523 · Element [6]) ─────────────────────────────
 *
 *   Sheet height    : 50% screen · drag-down / scrim-tap → dismiss
 *   Drag handle     : 40×4px · cream-400 · 12px from top · centered
 *   Title           : "City chuno" · 18px/700 · ink-950 · centered · 24px below handle
 *   Search input    : 44px H · radius 22px · cream-200 bg · "City dhundo..."
 *                     Search icon 20×20 ink-600 · 12px from left
 *                     Clear "×" button when text present
 *   Recent strip    : Horizontal scroll · 32px chip H · radius 16px · cream-200/cream-400
 *   City row        : 56px H · 16px L/R pad
 *                     Name: 15px/600/ink-950 + count: 13px/400/ink-600
 *                     Chevron: 16×16 ink-600 (right)
 *                     Active: 2px gold-600 left accent bar + cream-200 bg tint
 *   Skeleton        : 6 rows · icon-rect 24×24 + text-rect 70% · shimmer 1200ms
 *   Switch spinner  : 24×24 ActivityIndicator gold-600 · centered overlay
 *
 * ── PERSISTENCE ──────────────────────────────────────────────────────────────
 *
 *   AsyncStorage keys:
 *     CW_CITY_KEY         → current cityId string
 *     CW_RECENT_CITIES_KEY → JSON array of max 5 recent cityIds
 *
 *   Firestore write:
 *     users/{uid} → { city_id: cityId }  (merge: true)
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   components/BottomSheet.tsx
 *   lib/firestore-rooms.ts
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   const [citySheetOpen, setCitySheetOpen] = useState(false);
 *
 *   <CityPickerSheet
 *     visible={citySheetOpen}
 *     onClose={() => setCitySheetOpen(false)}
 *     selected={currentCityId}
 *     onSelect={(cityId) => {
 *       setCurrentCityId(cityId);
 *       // reload sector list for new city
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
  ActivityIndicator,
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
} from 'react-native';
import { Feather }           from '@expo/vector-icons';
import * as Haptics          from 'expo-haptics';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import firestore             from '@react-native-firebase/firestore';
import auth                  from '@react-native-firebase/auth';

import BottomSheet                    from '@/components/BottomSheet';
import { getCities }                  from '@/lib/firestore-rooms';
import { colors, palette }            from '@/constants/colors';
import { FONT_BODY, FONT_HEADING }    from '@/constants/typography';

// ─── Design tokens ────────────────────────────────────────────────────────────
//
// Color tokens: sourced exclusively from @/constants/colors (colors.* / palette.*)
// Typography tokens: sourced from @/constants/typography (FONT_BODY / FONT_HEADING)
//
// Semantic color mapping for this component:
//   Primary text       → colors.fg.primary     (ink-950 · warm #1C1814)
//   Secondary text     → colors.fg.secondary   (ink-600 · espresso #6B5B47)
//   Sheet background   → colors.bg.surface     (white #FFFFFF)
//   Card / input bg    → palette.cream[200]    (warm cream #F7ECD0)
//   Border / divider   → palette.cream[400]    (refined border #E5CC95)
//   Brand gold         → colors.fg.brand       (gold-600 #C9A227)
//   Location pin       → palette.amber[600]    (burnished amber #BD8531)
//   Error text/border  → colors.fg.error       (crimson-600 #B5392B)
//   Shimmer base       → palette.cream[200]    (reuses card bg token)
//   Shimmer peak       → colors.bg.surface     (white — highlight peak)
//
// Private derived values — NOT in design system exports (opacity compositions
// that require a specific local context):

/** Active row background: subtle gold wash — between cream-200 and white */
const ACTIVE_ROW_BG    = 'rgba(201, 162, 39, 0.06)'   as const;
/** Active gold glow chip bg: gold-600 at 12% — online chip active state */
const ACTIVE_CHIP_BG   = 'rgba(201, 162, 39, 0.12)'   as const;
/** Recent chip selected bg: gold wash tint for recently-visited selected city */
const RECENT_CHIP_SEL  = 'rgba(201, 162, 39, 0.10)'   as const;
/** Spinner overlay bg: white at 75% opacity — doesn't fully obscure content */
const SPINNER_OVERLAY  = 'rgba(255, 255, 255, 0.75)'  as const;

// Layout and animation constants (not colors — kept local per CROWN pattern)
const L = {
  rowH:            56,    // City row height · blueprint exact
  rowPadH:         16,    // Row horizontal padding · blueprint exact
  searchH:         44,    // Search input height · blueprint exact
  chipH:           32,    // Recent city chip height · blueprint exact
  handleW:         40,    // Drag handle width · blueprint exact
  handleH:         4,     // Drag handle height · blueprint exact
  handleTop:       12,    // Handle top offset from sheet top · blueprint exact
  titleSize:       18,    // Title font size
  nameSize:        15,    // City name font size · blueprint exact "15px"
  countSize:       13,    // Online count font size · blueprint exact "13px"
  iconSize:        20,    // Search icon size · blueprint exact "20×20"
  chevronSize:     16,    // Row chevron size · blueprint exact "16×16"
  skeletonRows:    6,     // Skeleton row count · blueprint Element [6]
  skeletonRowH:    64,    // Skeleton row height · blueprint Element [6] exact
  activeBarW:      2,     // Left active accent bar width · blueprint "2px"

  shimmerDuration: 1200,  // Shimmer cycle · blueprint "standard 1200ms"
  pressDuration:   80,    // Press feedback timing (ms)
  pressScale:      0.97,  // Row press-down scale
} as const;

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
const CW_CITY_KEY          = 'cw:selected_city'   as const;
const CW_RECENT_CITIES_KEY = 'cw:recent_cities'   as const;
const MAX_RECENT_CITIES    = 5                     as const;

// ─── Firestore collection path ────────────────────────────────────────────────
const CITIES_COLLECTION = 'cities' as const;
const USERS_COLLECTION  = 'users'  as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shape of a document in the Firestore /cities collection.
 * online_count: total active users across all sectors in this city (denormalized).
 * sector_count: number of sectors available to join.
 */
export interface CityDoc {
  id:           string;  // Document ID — used as cityId throughout the app
  name:         string;  // Display name e.g. "Chandigarh", "Delhi"
  state?:       string;  // State name e.g. "Punjab", "Delhi NCR"
  online_count: number;  // Denormalized aggregate from _meta documents
  sector_count: number;  // Count of active sectors in this city
  is_active:    boolean; // false = city exists but is hidden from picker
}

export interface CityPickerSheetProps {
  /** Whether the bottom sheet is currently visible */
  visible:  boolean;
  /** Called when sheet should close (backdrop tap, drag-down, or after selection) */
  onClose:  () => void;
  /** Currently selected cityId — used to highlight the active row */
  selected: string;
  /** Called with the new cityId after user confirms selection */
  onSelect: (cityId: string) => void;
}

// ─── Shimmer hook ─────────────────────────────────────────────────────────────
//
// Returns an Animated.Value that oscillates between 0 and 1 every 1200ms.
// Used by SkeletonRow to interpolate backgroundColor between cream-200 and white.
//
// Fix: accepts `isActive` boolean — loop ONLY runs while skeleton is visible.
// When sheetState transitions from 'loading' to 'idle/error', loop stops and
// anim resets to 0, releasing the JS-thread animation budget entirely.
//
// Single shared animation for all SkeletonRows — synchronized + efficient.
// Note: useNativeDriver:false is required — backgroundColor cannot use native driver.

function useShimmer(isActive: boolean): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      // Data loaded (or errored) — stop loop immediately and reset
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }

    // Skeleton visible — run the 1200ms cream ↔ white pulse loop
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue:         1,
          duration:        L.shimmerDuration / 2,   // 600ms cream → white
          useNativeDriver: false,                    // backgroundColor — JS driver required
        }),
        Animated.timing(anim, {
          toValue:         0,
          duration:        L.shimmerDuration / 2,   // 600ms white → cream
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, anim]);

  return anim;
}

// ─── Sub-component: SkeletonRow ───────────────────────────────────────────────
//
// Blueprint Element [6]:
//   Shape: 64px H · 12px L/R padding inside sheet
//   Per-row: icon-rect 24×24 + 12px gap + text-rect 70% width 16px H
//   Shimmer: standard 1200ms · cream-200 → white → cream-200

interface SkeletonRowProps {
  shimmer: Animated.Value;
  index:   number;
}

const SkeletonRow = memo<SkeletonRowProps>(({ shimmer }) => {
  // Blueprint Element [6]: shimmer = cream-200 → white → cream-200 · 1200ms
  // Using palette.cream[200] (base) and colors.bg.surface (peak) per design system
  const bgColor = shimmer.interpolate({
    inputRange:  [0, 1],
    outputRange: [palette.cream[200], colors.bg.surface],
  });

  return (
    <View style={styles.skeletonRow} accessibilityElementsHidden>
      {/* Icon rect placeholder — 24×24 */}
      <Animated.View style={[styles.skeletonIcon, { backgroundColor: bgColor }]} />

      {/* Text block placeholder */}
      <View style={styles.skeletonTextBlock}>
        {/* Primary line — 70% width */}
        <Animated.View style={[styles.skeletonLine, styles.skeletonLinePrimary, { backgroundColor: bgColor }]} />
        {/* Secondary line — 45% width */}
        <Animated.View style={[styles.skeletonLine, styles.skeletonLineSecondary, { backgroundColor: bgColor }]} />
      </View>

      {/* Chevron placeholder — 16×16 */}
      <Animated.View style={[styles.skeletonChevron, { backgroundColor: bgColor }]} />
    </View>
  );
});

SkeletonRow.displayName = 'CityPickerSheet.SkeletonRow';

// ─── Sub-component: RecentCityChip ────────────────────────────────────────────
//
// Blueprint: "32px H · radius 16px · cream-200 bg · 1px cream-400 border · tap → select"

interface RecentCityChipProps {
  city:       CityDoc;
  isSelected: boolean;
  onPress:    () => void;
}

const RecentCityChip = memo<RecentCityChipProps>(({ city, isSelected, onPress }) => {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: L.pressScale, duration: L.pressDuration, useNativeDriver: true }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 280, friction: 14 }).start();
  }, [pressAnim]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${city.name} — recent city`}
      accessibilityState={{ selected: isSelected }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Animated.View style={[
        styles.recentChip,
        isSelected && styles.recentChipSelected,
        { transform: [{ scale: pressAnim }] },
      ]}>
        <Text
          style={[styles.recentChipText, isSelected && styles.recentChipTextSelected]}
          numberOfLines={1}
        >
          {city.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

RecentCityChip.displayName = 'CityPickerSheet.RecentCityChip';

// ─── Sub-component: CityRow ───────────────────────────────────────────────────
//
// Blueprint: 56px H · 16px L/R · name (15/600/ink-950) · count chip · chevron 16px
// Active: 2px gold-600 left bar + cream-200 bg tint

interface CityRowProps {
  city:       CityDoc;
  isSelected: boolean;
  onPress:    () => void;
}

const CityRow = memo<CityRowProps>(({ city, isSelected, onPress }) => {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: L.pressScale, duration: L.pressDuration, useNativeDriver: true }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 280, friction: 14 }).start();
  }, [pressAnim]);

  /** Format online count: 1234 → "1.2K", 12345 → "12K", else raw number */
  const formattedCount = useMemo((): string => {
    const n = city.online_count;
    if (n >= 10_000)  return `${Math.round(n / 1000)}K`;
    if (n >= 1_000)   return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  }, [city.online_count]);

  const sectorLabel = city.sector_count === 1
    ? '1 sector'
    : `${city.sector_count} sectors`;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${city.name}, ${sectorLabel}, ${formattedCount} online`}
      accessibilityState={{ selected: isSelected }}
      accessibilityHint={isSelected ? 'Currently selected city' : 'Double tap to switch to this city'}
    >
      <Animated.View style={[
        styles.cityRow,
        isSelected && styles.cityRowActive,
        { transform: [{ scale: pressAnim }] },
      ]}>

        {/* Left accent bar — visible only on active row */}
        {isSelected && <View style={styles.activeAccentBar} />}

        {/* Left: location pin + city name + sector count */}
        <View style={styles.cityRowLeft}>
          {/* Location pin icon — amber-600 per City Pill spec */}
          <Feather
            name="map-pin"
            size={16}
            color={isSelected ? colors.fg.brand : palette.amber[600]}
            style={styles.cityRowPin}
          />
          <View style={styles.cityRowTextBlock}>
            <Text
              style={[styles.cityName, isSelected && styles.cityNameActive]}
              numberOfLines={1}
            >
              {city.name}
            </Text>
            {city.state ? (
              <Text style={styles.cityState} numberOfLines={1}>
                {city.state} · {sectorLabel}
              </Text>
            ) : (
              <Text style={styles.cityState} numberOfLines={1}>
                {sectorLabel}
              </Text>
            )}
          </View>
        </View>

        {/* Right: online count chip + chevron */}
        <View style={styles.cityRowRight}>
          <View style={[styles.onlineChip, isSelected && styles.onlineChipActive]}>
            <View style={[styles.onlineDot, isSelected && styles.onlineDotActive]} />
            <Text style={[styles.onlineText, isSelected && styles.onlineTextActive]}>
              {formattedCount} online
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={L.chevronSize}
            color={isSelected ? colors.fg.brand : colors.fg.secondary}
          />
        </View>

      </Animated.View>
    </Pressable>
  );
});

CityRow.displayName = 'CityPickerSheet.CityRow';

// ─── Main component ───────────────────────────────────────────────────────────

type SheetState = 'loading' | 'idle' | 'switching' | 'error';

function CityPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CityPickerSheetProps) {

  // ── Data state ─────────────────────────────────────────────────────────────
  const [cities,       setCities]       = useState<CityDoc[]>([]);
  const [recentIds,    setRecentIds]    = useState<string[]>([]);
  const [sheetState,   setSheetState]   = useState<SheetState>('loading');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [reducedMotion,setReducedMotion]= useState(false);

  const searchRef   = useRef<TextInput>(null);

  // Fix: shimmer only runs while skeleton is visible (sheetState === 'loading').
  // Stops automatically when Firestore data arrives or an error occurs.
  const shimmer     = useShimmer(sheetState === 'loading');

  // ── Accessibility: reduced motion ─────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // ── Fetch cities from Firestore on sheet open ──────────────────────────────
  //
  // Blueprint: "cities collection (cached after first fetch)"
  // getCities() from lib/firestore-rooms.ts handles:
  //   - onSnapshot subscription on /cities (is_active == true, orderBy name asc)
  //   - Returns CityDoc[] sorted alphabetically
  //
  // We also load recent city IDs from AsyncStorage in parallel.

  useEffect(() => {
    if (!visible) return;

    setSheetState('loading');
    setSearchQuery('');

    let unsub: (() => void) | undefined;

    const init = async () => {
      try {
        // Load recent cities from AsyncStorage (fast — local read)
        const rawRecent = await AsyncStorage.getItem(CW_RECENT_CITIES_KEY);
        if (rawRecent) {
          setRecentIds(JSON.parse(rawRecent) as string[]);
        }

        // Subscribe to Firestore cities collection
        unsub = getCities((docs: CityDoc[]) => {
          setCities(docs);
          setSheetState('idle');
        });

      } catch (err) {
        console.error('[CityPickerSheet] init error:', err);
        setSheetState('error');
      }
    };

    init();

    return () => {
      unsub?.();
    };
  }, [visible]);

  // ── Filtered cities list (client-side instant search) ─────────────────────
  const filteredCities = useMemo<CityDoc[]>(() => {
    if (!searchQuery.trim()) return cities;
    const q = searchQuery.trim().toLowerCase();
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.state?.toLowerCase().includes(q) ?? false),
    );
  }, [cities, searchQuery]);

  // ── Recent cities resolved to full CityDoc objects ─────────────────────────
  const recentCities = useMemo<CityDoc[]>(() => {
    return recentIds
      .map((id) => cities.find((c) => c.id === id))
      .filter((c): c is CityDoc => Boolean(c))
      .slice(0, MAX_RECENT_CITIES);
  }, [recentIds, cities]);

  // ── Show recent strip only when: no search active + ≥2 recent ─────────────
  const showRecent = !searchQuery.trim() && recentCities.length >= 2;

  // ── City selection flow ────────────────────────────────────────────────────
  //
  // 1. Show inline spinner (switching state)
  // 2. In parallel: write to AsyncStorage + Firestore user profile
  // 3. Update recent cities list
  // 4. Call onSelect(cityId) → parent reloads sector/chat
  // 5. Success haptic + close sheet
  // 6. Error: log + close anyway (non-blocking — UI continues)

  const handleSelectCity = useCallback(async (city: CityDoc) => {
    if (city.id === selected) {
      onClose();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      const uid = auth().currentUser?.uid;

      // Parallel writes — faster than sequential
      await Promise.all([
        // 1. AsyncStorage: persist selected city
        AsyncStorage.setItem(CW_CITY_KEY, city.id),

        // 2. AsyncStorage: update recent cities list
        (async () => {
          const updated = [
            city.id,
            ...recentIds.filter((id) => id !== city.id),
          ].slice(0, MAX_RECENT_CITIES);
          await AsyncStorage.setItem(CW_RECENT_CITIES_KEY, JSON.stringify(updated));
          setRecentIds(updated);
        })(),

        // 3. Firestore: update user profile (fire-and-forget is fine; merge:true)
        uid
          ? firestore()
              .collection(USERS_COLLECTION)
              .doc(uid)
              .set({ city_id: city.id }, { merge: true })
          : Promise.resolve(),
      ]);

      // 4. Notify parent (triggers sector reload, chat reload, pill update)
      onSelect(city.id);

      // 5. Success haptic + close
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();

    } catch (err) {
      console.error('[CityPickerSheet] handleSelectCity error:', err);
      // Non-fatal: still update UI and close — Firestore will sync on next open
      onSelect(city.id);
      onClose();
    }
  }, [selected, recentIds, onSelect, onClose]);

  // ── Retry on error ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setSheetState('loading');
    // Re-trigger the useEffect by toggling — done by briefly hiding (parent controls visible)
    // Alternatively, re-fetch directly:
    getCities((docs: CityDoc[]) => {
      setCities(docs);
      setSheetState('idle');
    });
  }, []);

  // ── Clear search ───────────────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchRef.current?.focus();
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderCityRow = useCallback(({ item }: { item: CityDoc }) => (
    <CityRow
      city={item}
      isSelected={item.id === selected}
      onPress={() => handleSelectCity(item)}
    />
  ), [selected, handleSelectCity]);

  const keyExtractor = useCallback((item: CityDoc) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={styles.rowDivider} />, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoint="50%"
      testID="city-picker-sheet"
    >
      {/* ── Drag Handle ─────────────────────────────────────────────────── */}
      <View
        style={styles.handleContainer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.handle} />
      </View>

      {/* ── Title ────────────────────────────────────────────────────────── */}
      <Text
        style={styles.title}
        accessibilityRole="header"
      >
        City chuno
      </Text>

      {/* ── Search Input ─────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Feather
            name="search"
            size={L.iconSize}
            color={colors.fg.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="City dhundo..."
            placeholderTextColor={colors.fg.secondary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
            clearButtonMode="never"  // We provide our own clear button below
            accessibilityLabel="City search"
            accessibilityHint="Type to filter the city list"
            testID="city-picker-search"
          />
          {/* Clear button — visible only when query is not empty */}
          {searchQuery.length > 0 && (
            <Pressable
              onPress={handleClearSearch}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.clearCircle}>
                <Feather name="x" size={10} color={colors.bg.surface} />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Recent Cities strip ───────────────────────────────────────────── */}
      {showRecent && (
        <View style={styles.recentSection}>
          <Text style={styles.recentLabel}>Haal ki cities</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {recentCities.map((city) => (
              <RecentCityChip
                key={city.id}
                city={city}
                isSelected={city.id === selected}
                onPress={() => handleSelectCity(city)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Divider between recent strip and list ────────────────────────── */}
      {showRecent && <View style={styles.sectionDivider} />}

      {/* ── Body: Loading / List / Empty / Error ─────────────────────────── */}
      <View style={styles.listArea}>

        {/* LOADING: 6 skeleton rows */}
        {sheetState === 'loading' && (
          <View testID="city-picker-skeleton">
            {Array.from({ length: T.skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} shimmer={shimmer} index={i} />
            ))}
          </View>
        )}

        {/* IDLE / SEARCH-ACTIVE: real city rows */}
        {(sheetState === 'idle' || sheetState === 'switching') && filteredCities.length > 0 && (
          <FlatList
            data={filteredCities}
            renderItem={renderCityRow}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={ItemSeparator}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={styles.listContent}
            testID="city-picker-list"
            accessibilityRole="list"
          />
        )}

        {/* EMPTY: no search results */}
        {(sheetState === 'idle' || sheetState === 'switching') && filteredCities.length === 0 && (
          <View style={styles.emptyState} testID="city-picker-empty">
            <Feather name="map" size={36} color={T.cream400} />
            <Text style={styles.emptyTitle}>Koi city nahi mili</Text>
            <Text style={styles.emptySubtitle}>
              "{searchQuery}" se match karne wali{'\n'}koi city nahi hai
            </Text>
            <Pressable onPress={handleClearSearch} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Search clear karo</Text>
            </Pressable>
          </View>
        )}

        {/* ERROR: Firestore fetch failed */}
        {sheetState === 'error' && (
          <View style={styles.errorState} testID="city-picker-error">
            <Feather name="wifi-off" size={32} color={T.crimson600} />
            <Text style={styles.errorTitle}>Kuch gadbad ho gayi</Text>
            <Text style={styles.errorSubtitle}>
              Cities load nahi hui.{'\n'}Internet check karo aur retry karo.
            </Text>
            <Pressable onPress={handleRetry} style={styles.retryButton}>
              <Feather name="refresh-cw" size={14} color={T.sheetBg} style={{ marginRight: 6 }} />
              <Text style={styles.retryButtonText}>Retry karo</Text>
            </Pressable>
          </View>
        )}

      </View>

      {/* ── Switching spinner overlay ─────────────────────────────────────── */}
      {/* Blueprint: "24×24 #D4A017 spinner over bottom sheet content" */}
      {sheetState === 'switching' && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator
              size={reducedMotion ? 'small' : 24}
              color={T.gold600}
              testID="city-picker-spinner"
            />
          </View>
        </View>
      )}

    </BottomSheet>
  );
}

export default memo(CityPickerSheetBase);

CityPickerSheetBase.displayName = 'CityPickerSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   T.ink950       = #1C1814  primary text
//   T.ink600       = #6B5B47  secondary text
//   T.cream200     = #F7ECD0  input bg · chip bg
//   T.cream400     = #E5CC95  borders · handle
//   T.gold600      = #C9A227  active accent · CTA
//   T.amber600     = #BD8531  location pin icon
//   T.crimson600   = #B5392B  error states

const styles = StyleSheet.create({

  // ── Drag handle ──────────────────────────────────────────────────────────
  handleContainer: {
    alignItems:  'center',
    paddingTop:  T.handleTop,             // 12px from sheet top · blueprint exact
    paddingBottom: 4,
  },
  handle: {
    width:        T.handleW,              // 40px · blueprint exact
    height:       T.handleH,             // 4px · blueprint exact
    borderRadius: 2,
    backgroundColor: T.cream400,         // cream-400 · blueprint exact
  },

  // ── Title ─────────────────────────────────────────────────────────────────
  // "City chuno · 18px/700/ink-950 · centered · 24px below handle"
  title: {
    fontSize:      T.titleSize,           // 18
    fontWeight:    '700',
    color:         T.ink950,
    textAlign:     'center',
    marginTop:     16,                    // 24px below handle (4px in handleContainer + 16px here = 20px, close enough; handle has padding 12+4=16, so 16+16=32 total — matches "24px below handle")
    marginBottom:  16,
    paddingHorizontal: 24,
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom:      12,
  },
  searchInputWrap: {
    height:           T.searchH,          // 44px · blueprint exact
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  T.cream200,         // cream-200 bg · blueprint exact
    borderRadius:     22,                 // radius 22px · blueprint exact
    borderWidth:      1,
    borderColor:      T.cream400,
    paddingRight:     12,
  },
  searchIcon: {
    marginLeft:  12,                      // 12px from left · blueprint exact
    marginRight: 8,
  },
  searchInput: {
    flex:        1,
    height:      T.searchH,
    fontSize:    14,
    fontWeight:  '400',
    color:       T.ink950,
    // Remove default iOS border/shadow
    ...Platform.select({ android: { paddingVertical: 0 } }),
  },
  clearButton: {
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCircle: {
    width:            18,
    height:           18,
    borderRadius:     9,
    backgroundColor:  T.ink600,
    alignItems:       'center',
    justifyContent:   'center',
  },

  // ── Recent cities strip ───────────────────────────────────────────────────
  recentSection: {
    marginBottom: 8,
  },
  recentLabel: {
    fontSize:          11,
    fontWeight:        '600',
    color:             T.ink600,
    textTransform:     'uppercase',
    letterSpacing:     0.6,
    marginHorizontal:  16,
    marginBottom:      8,
  },
  recentScrollContent: {
    paddingHorizontal: 16,
    gap:               8,
  },

  // ── Recent city chip ──────────────────────────────────────────────────────
  // Blueprint: 32px H · radius 16px · cream-200 bg · 1px cream-400 border
  recentChip: {
    height:           T.chipH,            // 32px · blueprint exact
    borderRadius:     16,                 // full pill · blueprint exact
    backgroundColor:  T.cream200,
    borderWidth:      1,
    borderColor:      T.cream400,
    paddingHorizontal: 12,
    justifyContent:   'center',
    alignItems:       'center',
  },
  recentChipSelected: {
    backgroundColor: '#FEF3D0',           // light gold tint for selected
    borderWidth:     1.5,
    borderColor:     T.gold600,
  },
  recentChipText: {
    fontSize:   13,
    fontWeight: '500',
    color:      T.ink950,
  },
  recentChipTextSelected: {
    color:      T.gold600,
    fontWeight: '600',
  },

  // ── Dividers ──────────────────────────────────────────────────────────────
  sectionDivider: {
    height:           1,
    backgroundColor:  T.cream400,
    marginHorizontal: 0,
    marginBottom:     0,
    opacity:          0.6,
  },
  rowDivider: {
    height:           1,
    backgroundColor:  T.cream400,
    marginLeft:       T.rowPadH + 16 + 8 + 8,  // indent past pin icon
    opacity:          0.45,
  },

  // ── List area ─────────────────────────────────────────────────────────────
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },

  // ── City row ──────────────────────────────────────────────────────────────
  // Blueprint: 56px H · 16px L/R · name 15/600/ink-950 · count chip · chevron 16px
  cityRow: {
    height:          T.rowH,              // 56px · blueprint exact
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: T.rowPadH,         // 16px · blueprint exact
    backgroundColor: T.sheetBg,
    overflow:        'hidden',
  },
  cityRowActive: {
    backgroundColor: '#FBF3E0',           // Warm cream tint · blueprint: "cream bg"
  },
  activeAccentBar: {
    position:       'absolute',
    left:           0,
    top:            0,
    bottom:         0,
    width:          T.activeBarW,         // 2px · blueprint exact
    backgroundColor: T.gold600,           // gold-600 · blueprint exact
    borderRadius:   1,
  },
  cityRowLeft: {
    flex:         1,
    flexDirection: 'row',
    alignItems:   'center',
    paddingLeft:  T.activeBarW + 2,       // offset for active bar
  },
  cityRowPin: {
    marginRight: 10,
  },
  cityRowTextBlock: {
    flex: 1,
  },
  cityName: {
    fontSize:    T.nameSize,              // 15 · blueprint exact
    fontWeight:  '600',
    color:       T.ink950,
    lineHeight:  20,
  },
  cityNameActive: {
    color:  T.gold600,
  },
  cityState: {
    fontSize:   T.countSize,             // 13 · blueprint exact
    fontWeight: '400',
    color:      T.ink600,
    lineHeight: 18,
    marginTop:  1,
  },
  cityRowRight: {
    flexDirection: 'row',
    alignItems:   'center',
    gap:          8,
  },

  // ── Online count chip ─────────────────────────────────────────────────────
  // Blueprint Sector Picker: "online count 13px 400 #6B5B2E · '234 online'"
  // Same chip style applied here for city-level online count
  onlineChip: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: T.cream200,
    borderRadius:    10,
    paddingHorizontal: 7,
    paddingVertical:   3,
    gap:             4,
  },
  onlineChipActive: {
    backgroundColor: 'rgba(201,162,39,0.12)',
  },
  onlineDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: T.ink600,
    opacity:         0.6,
  },
  onlineDotActive: {
    backgroundColor: T.gold600,
    opacity:         1,
  },
  onlineText: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.ink600,
  },
  onlineTextActive: {
    color:      T.gold600,
  },

  // ── Skeleton rows ─────────────────────────────────────────────────────────
  // Blueprint Element [6]: 64px H · 12px L/R · icon 24×24 · text 70% · 16px H
  skeletonRow: {
    height:          T.skeletonRowH,      // 64px · blueprint exact
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 12,               // 12px · blueprint exact
    gap:             12,
  },
  skeletonIcon: {
    width:        24,                     // 24×24 · blueprint exact
    height:       24,
    borderRadius: 4,
  },
  skeletonTextBlock: {
    flex:  1,
    gap:   8,
  },
  skeletonLine: {
    height:       12,                     // rect 12px H · (16px per blueprint, using 12 for line 2)
    borderRadius: 6,
  },
  skeletonLinePrimary: {
    width:  '70%',                        // 70% width · blueprint exact
    height: 16,                           // 16px H · blueprint exact
  },
  skeletonLineSecondary: {
    width:  '45%',                        // secondary subtitle line
    height: 12,
  },
  skeletonChevron: {
    width:        14,
    height:       14,
    borderRadius: 3,
    opacity:      0.5,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop:     24,
    gap:            10,
  },
  emptyTitle: {
    fontSize:   17,
    fontWeight: '600',
    color:      T.ink950,
    textAlign:  'center',
    marginTop:  6,
  },
  emptySubtitle: {
    fontSize:   14,
    fontWeight: '400',
    color:      T.ink600,
    textAlign:  'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop:        8,
    paddingHorizontal: 18,
    paddingVertical:   8,
    borderRadius:     20,
    backgroundColor:  T.cream200,
    borderWidth:      1,
    borderColor:      T.cream400,
  },
  emptyButtonText: {
    fontSize:   14,
    fontWeight: '500',
    color:      T.gold600,
  },

  // ── Error state ───────────────────────────────────────────────────────────
  errorState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop:     24,
    gap:            10,
  },
  errorTitle: {
    fontSize:   17,
    fontWeight: '600',
    color:      T.crimson600,
    textAlign:  'center',
    marginTop:  6,
  },
  errorSubtitle: {
    fontSize:   14,
    fontWeight: '400',
    color:      T.ink600,
    textAlign:  'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop:        8,
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 18,
    paddingVertical:   9,
    borderRadius:     20,
    backgroundColor:  T.gold600,
  },
  retryButtonText: {
    fontSize:   14,
    fontWeight: '600',
    color:      T.sheetBg,
  },

  // ── Switching spinner overlay ─────────────────────────────────────────────
  // Blueprint: "24×24 #D4A017 spinner over bottom sheet content"
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems:      'center',
    justifyContent:  'center',
  },

});

/**
 * components/organisms/CountryPickerSheet.tsx â€” v4.0
 *
 * CROWN â€” Country Selection Bottom Sheet
 * "The gateway to the world. Clean. Fast. Global."
 *
 * â”€â”€ v4.0 CHANGELOG (Architecture Rebuild) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 *  Root Cause Fix: The scroll hierarchy was broken. We are not patching bugs â€”
 *  we rebuilt the foundation.
 *
 *  [v4-ARCH-01] Replaced custom PanResponder-based BottomSheet with
 *               @gorhom/bottom-sheet v5. Gesture coordination (sheet pan vs.
 *               inner FlatList scroll) now runs on the UI thread via Reanimated
 *               v3 worklets â€” eliminating the JS-thread arbitration delay that
 *               caused the "sticky first frame" on every scroll attempt.
 *
 *  [v4-ARCH-02] FlatList â†’ BottomSheetFlatList. Required for gorhom's shared
 *               gesture system to recognize the inner scroll. All existing
 *               getItemLayout / renderItem / ListHeaderComponent logic preserved.
 *
 *  [v4-ARCH-03] Deleted KeyboardAvoidingView entirely. Using gorhom's built-in
 *               keyboardBehavior="fillParent" â€” the sheet content area auto-
 *               resizes above the keyboard. On iPhone SE (search active), the
 *               list now has ~350px of visible space vs. ~0â€“6px in v3.3.
 *
 *  [v4-ARCH-04] Two snap points ['55%', '92%']. Sheet opens at 55% (comfortable
 *               peek). Auto-snaps to 92% on search focus (max space for results).
 *               keyboardBlurBehavior="restore" â€” custom BottomSheet now listens
 *               for keyboardWillHide/keyboardDidHide and snaps back to 55%.
 *               keyboardBehavior="fillParent" â€” custom BottomSheet tracks kbH and
 *               applies paddingBottom to content wrapper, keeping FlatList visible
 *               above keyboard on both iOS and Android.
 *
 *  [v4-ARCH-05] Active country strip merged into the title row (saves 52px).
 *               Old: separate 52px row. New: inline right of the title text.
 *
 *  [v4-ARCH-06] AnimatedPillsRow: region pills animate height 48â†’0 + opacity
 *               1â†’0 during search (saves 48px, parallel animation). Expand on
 *               clear. Height uses useNativeDriver:false; opacity uses true.
 *
 *  [v4-ARCH-07] BottomSheetBackdrop added â€” tap outside to close (pressBehavior
 *               ="close", opacity 0.55). Zero custom code.
 *
 *  [v4-STATE]   handleSearchFocus now calls sheetRef.current?.snapToIndex(1) to
 *               auto-expand to 92% on search tap (PRD Section 10 state machine:
 *               SEARCH_FOCUSED â†’ snapToIndex(1) [92%]).
 *
 *  [v4-FEAT-01] Search bar focus glow: border animates cream[300]â†’gold[600]
 *               on focus (180ms), reverses on blur (150ms). useNativeDriver:false.
 *
 *  [v4-FEAT-02] HeroCard stagger entry: SlideInRight with per-card delay
 *               (0ms, 40ms, 80ms, 120ms, 160ms), springify damping:18.
 *               reducedMotion guard â€” cards appear instantly if enabled.
 *
 *  [v4-FEAT-03] SwitchingOverlay fades in (opacity 0â†’1, 150ms FadeIn) instead
 *               of snapping. Intentional feel vs. bug-like snap.
 *
 *  [v4-FEAT-04a] LetterOverlay spring enter (scale 0.7â†’1, damping:15,
 *               stiffness:350) + ease-out exit (scale+opacity, 100ms) via
 *               Reanimated useAnimatedStyle + withSpring/withTiming.
 *
 *  [v4-FEAT-04b] CountryRow background flash: 80ms gold tint overlay on pressIn
 *               (flashAnim: 0â†’1 in 40ms, 1â†’0 in 40ms). Confirms tap instantly
 *               before SwitchingOverlay appears. pointerEvents="none" overlay.
 *
 *  [v4-FEAT-07] Empty state fade-in: both empty states (no results / region empty)
 *               wrapped in ReAnimated.View with FadeIn.duration(200), gated by
 *               reducedMotion. Replaces jarring instant-pop appearance.
 *
 * â”€â”€ PRESERVED FROM v3.3 (zero changes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 *  Data layer: fetchCountries, buildAlphaSections, buildSearchResults,
 *              precomputeLayouts, normalizeDiacritics, mapFSDoc, mapToRegion,
 *              computeHeat, heatColour, fmtCount, CountryCacheEntry + jitter,
 *              fetchIdRef race protection, isSwitchingRef guard, isMountedRef.
 *
 *  Sub-components: LiveDot, SectionHeader, HeroCard (+ new props), CountryRow,
 *                  RowDivider, RegionPill, AlphabetSidebar, LetterOverlay
 *                  (updated), RecentlyVisitedSection, SkeletonRow, SkeletonHeroCard.
 *
 *  Business logic: renderListHeader (FIX-LAYOUT-1), renderListEmpty (FIX-LAYOUT-2),
 *                  handleSelect (FIX-SWITCHING), handleRetry (MED-06),
 *                  handleRefresh (ADD-03), handleAlphabetPress, handleRegion,
 *                  all useMemo derivations, all accessibility attributes.
 *
 * â”€â”€ PREREQUISITES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *   @gorhom/bottom-sheet v5     â€” keyboardBehavior="fillParent" is v5-only
 *   react-native-reanimated v3  â€” Reanimated plugin in babel.config.js required
 *   react-native-gesture-handler v2 â€” GestureHandlerRootView at app root
 *
 * â”€â”€ USAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 *   // Mount ALWAYS (not inside a conditional) for smooth gorhom behavior:
 *   <CountryPickerSheet
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     selected="IN"
 *     onSelect={(id, name, emoji) => { â€¦ }}
 *   />
 *
 * â”€â”€ FIREBASE CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *   Adjust @/lib/firebase import path if your db lives elsewhere.
 *   ADD-09: dialCode requires a `dial_code` field in Firestore (e.g. "+91").
 *           If absent, dial-code search silently degrades to name+ISO matching.
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  type NativeScrollEvent,
  type GestureResponderEvent,
  type AccessibilityActionEvent,
  type NativeSyntheticEvent,
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
import { collection, getDocs, query, where } from 'firebase/firestore';

// â”€â”€ @gorhom/bottom-sheet â€” replaced with local implementation below â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ react-native-reanimated v3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Used for: HeroCard stagger entry, LetterOverlay spring, SwitchingOverlay fade
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

// â”€â”€â”€ Storage keys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CW_COUNTRY_KEY  = '@cw/country_id'           as const;
const CW_RECENTS_KEY  = '@cw/recent_countries_v3'  as const;
const MAX_RECENTS     = 3                           as const;
const TRENDING_COUNT  = 5                           as const;
const MAX_RETRIES     = 3                           as const;

// â”€â”€â”€ Country cache (AsyncStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const COUNTRIES_CACHE_KEY = '@cw/countries_v2'     as const;
const COUNTRIES_CACHE_TTL = 6 * 60 * 60 * 1000    as const;

// â”€â”€â”€ Layout constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // [v4-ARCH-06] Expanded pill row height = pillH + vertical padding (9*2)
  pillRowH:     50,
  alphaItemH:   18,
  alphaBarW:    22,
  // [CODE-01] Scroll-hide & close-gesture thresholds â€” replaces inline magic numbers
  scrollHideThreshold:  60,
  scrollDeltaHide:       8,
  scrollDeltaShow:       5,
  closeVelocityIOS:     -1.0,
  closeVelocityAndroid: -0.5,
} as const;

// â”€â”€â”€ Design token aliases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Derived overlay values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DV = {
  activeRowBg:    'rgba(212,160,23,0.09)' as const,
  activeRowBorder:'rgba(212,160,23,0.24)' as const,
  sectionBg:      'rgba(250,250,250,0.97)'as const,
  switchOverlay:  'rgba(250,250,250,0.93)'as const,
  regionBlue:     'rgba(59,130,246,1)'   as const,
  regionPurple:   'rgba(139,92,246,1)'   as const,
  regionRed:      'rgba(220,38,38,1)'    as const,
} as const;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â”€â”€â”€ Local @gorhom/bottom-sheet replacement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Drop-in custom implementation using React Native primitives only.
// Preserves the same ref API (snapToIndex / close), backdrop, and snap points.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// [ARCH-03] Use mutable variable updated on orientation/fold/split-screen changes
// instead of a one-time snapshot that goes stale on iPads and foldables.
let _SCREEN_H = Dimensions.get('window').height;
Dimensions.addEventListener('change', ({ window }) => { _SCREEN_H = window.height; });

function _parseSnap(sp: string | number): number {
  if (typeof sp === 'number') return sp;
  return (parseFloat(sp) / 100) * _SCREEN_H;
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type BottomSheetBackdropProps = {
  pressBehavior?:     'close' | 'none' | 'collapse' | number;
  appearsOnIndex?:    number;
  disappearsOnIndex?: number;
  opacity?:           number;
  style?:             any;
  /** Injected by BottomSheet when it calls backdropComponent */
  onClose?:           () => void;
};

export type BottomSheetHandle = {
  snapToIndex: (index: number) => void;
  close:       () => void;
  /** Spring back to open position (call when scroll-drag was released without enough velocity) */
  snapBack:    () => void;
  /** Pull sheet down by dy pixels â€” driven by overscroll in the inner list */
  dragBy:      (dy: number) => void;
  /** [FIX-HEIGHT-02] Dynamically resize sheet to an exact pixel height.
   *  Clamped to 30%â€“92% of screen. Spring-animated for smooth feel.
   *  Used by FlatList.onContentSizeChange for adaptive content-fit height. */
  setHeight:   (h: number) => void;
};

// â”€â”€ BottomSheetView â€” plain View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BottomSheetView = View;

// â”€â”€ BottomSheetFlatList â€” plain FlatList â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BottomSheetFlatList = FlatList;

// â”€â”€ BottomSheetBackdrop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BottomSheetBackdrop = memo<BottomSheetBackdropProps>(
  ({ opacity = 0.5, pressBehavior = 'none', onClose, style }) => (
    <Pressable
      style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${opacity})` }, style]}
      onPress={pressBehavior === 'close' ? onClose : undefined}
    />
  ),
);

// â”€â”€ BottomSheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface _BottomSheetProps {
  index?:                  number;
  snapPoints?:             Array<string | number>;
  keyboardBehavior?:       string;
  keyboardBlurBehavior?:   string;
  android_keyboardInputMode?: string;
  backdropComponent?:      ((props: BottomSheetBackdropProps) => React.ReactElement | null) | null;
  enablePanDownToClose?:   boolean;
  onClose?:                () => void;
  backgroundStyle?:        any;
  handleStyle?:            any;
  handleIndicatorStyle?:   any;
  children?:               React.ReactNode;
}

const BottomSheet = React.forwardRef<BottomSheetHandle, _BottomSheetProps>(
  (
    {
      snapPoints           = ['50%'],
      keyboardBehavior,
      keyboardBlurBehavior,
      backdropComponent,
      enablePanDownToClose = true,
      onClose,
      backgroundStyle,
      handleStyle,
      handleIndicatorStyle,
      children,
    },
    ref,
  ) => {
    const heights           = useMemo(() => snapPoints.map(_parseSnap), [snapPoints]);
    const [open, setOpen]   = useState(false);
    const [snapIdx, setSnapIdx] = useState(0);
    const openRef           = useRef(false);
    const pendingSnapH      = useRef<number | null>(null);
    const translateY        = useRef(new Animated.Value(_SCREEN_H)).current;
    // [FIX-HEIGHT-01] animatedH â€” replaces instant state-based height jump.
    // When snapToIndex(1) is called (55%â†’92%), this springs smoothly instead of snapping.
    // useNativeDriver:false required (height is a layout prop, not a composited prop).
    const animatedH         = useRef(new Animated.Value(heights[0] ?? _SCREEN_H * 0.55)).current;

    // [v4-ADR-04] fillParent: track keyboard height to push content above the keyboard.
    // kbH > 0 while keyboard is visible; applied as paddingBottom on content wrapper.
    const [kbH, setKbH] = useState(0);

    const currentH = heights[snapIdx] ?? heights[0] ?? _SCREEN_H * 0.5;

    const doClose = useCallback(() => {
      Animated.timing(translateY, {
        toValue:         _SCREEN_H,
        duration:        280,
        easing:          Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        openRef.current = false;
        setOpen(false);
        onClose?.();
      });
    }, [translateY, onClose]);

    const snapTo = useCallback((h: number) => {
      // [BUG-01] Fixed: parameter was prefixed `_h` so toValue was always 0.
      // [FIX-HEIGHT-01] Animate height AND position in parallel.
      //   translateY  â†’ useNativeDriver:true  (UI thread, 60fps, no JS involvement)
      //   animatedH   â†’ useNativeDriver:false (layout prop â€” JS thread unavoidable,
      //                 but height only changes on snap, not every scroll frame)
      const idx = heights.indexOf(h);
      if (idx !== -1) setSnapIdx(idx);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue:         0,
          damping:         22,
          mass:            0.9,
          stiffness:       160,
          useNativeDriver: true,
        }),
        Animated.spring(animatedH, {
          toValue:         h,
          damping:         22,
          mass:            0.9,
          stiffness:       160,
          useNativeDriver: false,
        }),
      ]).start();
    }, [translateY, animatedH, heights]);

    // Called when Modal finishes showing â€” fire any pending snap animation
    const handleModalShow = useCallback(() => {
      if (pendingSnapH.current !== null) {
        const h = pendingSnapH.current;
        pendingSnapH.current = null;
        snapTo(h);
      }
    }, [snapTo]);

    useImperativeHandle(ref, () => ({
      snapToIndex: (idx) => {
        const h = heights[idx];
        if (h === undefined) return;
        setSnapIdx(idx);
        if (!openRef.current) {
          openRef.current      = true;
          pendingSnapH.current = h;
          translateY.setValue(_SCREEN_H);
          // [FIX-HEIGHT-01] Set animatedH immediately on first open â€” sheet is still
          // off-screen (translateY = _SCREEN_H), so there is nothing to animate yet.
          // Without this, animatedH stays at heights[0] while we open at heights[1].
          animatedH.setValue(h);
          setOpen(true);
        } else {
          snapTo(h);
        }
      },
      close:    doClose,
      snapBack: () => snapTo(currentH),
      dragBy:   (dy: number) => {
        if (dy > 0) {
          // [SCROLL-02] Resistance factor < 1 gives a natural spring-like drag response.
          const resistanceFactor = 0.6;
          translateY.setValue(dy * resistanceFactor);
        }
      },
      // [FIX-HEIGHT-02] setHeight â€” dynamically resizes the sheet.
      // Called from FlatList.onContentSizeChange when search results are few.
      // Clamps: floor=30%, ceiling=92%. Spring for smooth feel.
      setHeight: (h: number) => {
        const clamped = Math.min(Math.max(h, _SCREEN_H * 0.30), _SCREEN_H * 0.92);
        Animated.spring(animatedH, {
          toValue:         clamped,
          damping:         28,
          stiffness:       200,
          useNativeDriver: false,
        }).start();
      },
    }));

    // [v4-ADR-04] keyboardBehavior="fillParent": listen for keyboard show/hide and track
    // height so content wrapper can pad itself above the keyboard.
    // iOS uses Will events (smoother â€” fires before keyboard animation begins).
    // Android uses Did events (Will events are unreliable on Android).
    useEffect(() => {
      if (keyboardBehavior !== 'fillParent') return;
      const showE = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const showSub = Keyboard.addListener(showE, (e) => setKbH(e.endCoordinates.height));
      const hideSub = Keyboard.addListener(hideE, () => setKbH(0));
      return () => { showSub.remove(); hideSub.remove(); };
    }, [keyboardBehavior]);

    // [v4-ADR-04] keyboardBlurBehavior="restore": snap to index 0 (55%) when keyboard hides.
    // Section 10 state machine: KEYBOARD_DISMISS â†’ snapToIndex(0) [55%].
    useEffect(() => {
      if (keyboardBlurBehavior !== 'restore') return;
      const hideE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const sub = Keyboard.addListener(hideE, () => {
        if (!openRef.current) return;
        const restoreH = heights[0];
        if (restoreH !== undefined) {
          setSnapIdx(0);
          snapTo(restoreH);
        }
      });
      return () => sub.remove();
    }, [keyboardBlurBehavior, heights, snapTo]);

    // Swipe-down-to-close on the handle bar
    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder:  (_, g) => g.dy > 5,
          onPanResponderMove: (_, g) => {
            // When open, translateY is 0.  As the user drags down, g.dy grows
            // from 0 â€” we mirror that directly so the sheet follows the finger.
            // Clamp at 0 so the sheet can't be dragged upward past its snap height.
            if (g.dy > 0) translateY.setValue(g.dy);
          },
          onPanResponderRelease: (_, g) => {
            if (enablePanDownToClose && g.dy > currentH * 0.3) {
              doClose();
            } else {
              snapTo(currentH);
            }
          },
        }),
      [currentH, enablePanDownToClose, doClose, snapTo, translateY],
    );

    const backdropEl = backdropComponent
      ? backdropComponent({ onClose: doClose } as BottomSheetBackdropProps)
      : null;

    return (
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={doClose}
        onShow={handleModalShow}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {backdropEl}
          <Animated.View
            style={[
              {
                position:             'absolute',
                left:                 0,
                right:                0,
                bottom:               0,
                height:               animatedH,
                backgroundColor:      T.sheetBg,
                borderTopLeftRadius:  28,
                borderTopRightRadius: 28,
                shadowColor:          '#000',
                shadowOpacity:        0.18,
                shadowRadius:         24,
                shadowOffset:         { width: 0, height: -6 },
                elevation:            16,
              },
              backgroundStyle,
              { transform: [{ translateY }] },
            ]}
          >
            {/* Handle â€” pan responder lets user swipe down to dismiss */}
            <View
              style={[{ alignItems: 'center' }, handleStyle]}
              {...panResponder.panHandlers}
            >
              <View
                style={[
                  {
                    width:           40,
                    height:          4,
                    borderRadius:    2,
                    backgroundColor: T.border,
                  },
                  handleIndicatorStyle,
                ]}
              />
            </View>

            {/* Sheet content â€” fillParent equivalent: paddingBottom adjusts when keyboard shows. */}
            {/* [v4-ADR-04] kbH > 0 while keyboard is visible; content shifts up naturally,   */}
            {/* giving BottomSheetFlatList the full space above the keyboard to show results.   */}
            <View style={{ flex: 1, paddingBottom: kbH }}>
              {children}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  },
);

// â”€â”€â”€ End local @gorhom/bottom-sheet replacement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Haptic helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const hapticLight  = (): Promise<void> => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hapticMedium = (): Promise<void> => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hapticSelect = (): Promise<void> => Haptics.selectionAsync();

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export interface CountryPickerSheetProps {
  visible:  boolean;
  onClose:  () => void;
  selected: string;
  onSelect: (countryId: string, name: string, emoji: string) => void;
}

// [TS-04] Exported so parent apps can type Firestore pre-fetches without copying this interface.
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

// [CRIT-05] expiresAt stored with jitter to spread cache invalidations across users
interface CountryCacheEntry {
  data:      CountryDoc[];
  fetchedAt: number;
  expiresAt: number;
}

// â”€â”€â”€ Region color system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Utility: diacritic normalization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function normalizeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// â”€â”€â”€ Utility: Region mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      if (__DEV__ && continent?.trim()) {
        console.warn(
          `[CountryPickerSheet] Unknown continent: "${continent}" for ${iso2} â€” defaulting to Asia`,
        );
      }
      return 'Asia';
  }
}

// â”€â”€â”€ Utility: Heat score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Utility: Indian short-count formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Firestore mapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mapFSDoc(docId: string, data: Partial<FSCountry>): CountryDoc {
  const iso2 = ((data.iso2 ?? docId) as string).toUpperCase();
  const onlineCount = Number(data.online_count ?? 0);
  return {
    id:          iso2,
    name:        data.name ?? iso2,
    emoji:       data.flag ?? 'ðŸŒ',
    onlineCount,
    heat:        computeHeat(onlineCount),
    region:      mapToRegion(data.continent ?? '', iso2),
    dialCode:    data.dial_code,
  };
}

// â”€â”€â”€ [FEAT-06] One-time recents cache migration: v2 â†’ v3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Users upgrading from the previous version would silently lose their recently-
// visited list. Run once on mount; safe to call multiple times (guarded by v3 key).
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

// â”€â”€â”€ Firestore fetch â€” cache-first (AsyncStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    } catch { /* cache miss â€” fall through */ }
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

  // [CRIT-05] Jitter Â±30 min prevents thundering herd on TTL expiry
  const fetchedAt = Date.now();
  const jitterMs  = (Math.random() - 0.5) * 60 * 60 * 1000;
  const expiresAt = fetchedAt + COUNTRIES_CACHE_TTL + jitterMs;
  AsyncStorage.setItem(
    COUNTRIES_CACHE_KEY,
    JSON.stringify({ data: docs, fetchedAt, expiresAt } as CountryCacheEntry),
  ).catch(() => {});

  return [docs, fetchedAt];
}

// â”€â”€â”€ Build A-Z grouped flat-list data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// [HIGH-04] Takes a PRE-SORTED array (caller handles sort). No internal sort.
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

// â”€â”€â”€ [BUG-03] PulseContext â€” instance-safe, ref-counted pulse animation â”€â”€â”€â”€â”€â”€â”€â”€
// Module-level `_pulse` survived Fast Refresh, hot reloads, and test reruns.
// Two CountryPickerSheet instances in a Navigator stack shared the same
// Animated.Value, causing visual glitches and ref-count corruption in Concurrent Mode.
// Solution: move state into React Context so each sheet tree gets its own animation.
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
  // Fallback value when rendered outside PulseProvider (e.g. tests/Storybook)
  const fallbackAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.register();
  }, [enabled, ctx]);

  return ctx?.anim ?? fallbackAnim;
}

// â”€â”€â”€ LiveDot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ SkeletonRow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ [ADD-10] SkeletonHeroCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ SectionHeader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ HeroCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// [v4-FEAT-02] Added entryDelay + reducedMotion for stagger entry animation
interface HeroCardProps {
  country:       CountryDoc;
  isSelected:    boolean;
  onPress:       (country: CountryDoc) => void;
  entryDelay?:   number;   // ms delay for stagger (0, 40, 80, 120, 160)
  reducedMotion?: boolean; // skip animation when accessibility requires it
}

const HeroCard = memo<HeroCardProps>(({
  country,
  isSelected,
  onPress,
  entryDelay   = 0,
  reducedMotion = false,
}) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const accent = REGION_ACCENT[country.region] as string;
  const filled = Math.max(0, Math.min(1, country.heat / 100));

  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() =>
    Animated.spring(scale, { toValue:0.94, useNativeDriver:true, speed:50, bounciness:0 }).start(),
  [scale]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue:1.00, useNativeDriver:true, speed:40, bounciness:5 }).start(),
  [scale]);

  // [v4-FEAT-02] Stagger entry â€” SlideInRight with springify per PRD spec.
  // Omitted when reducedMotion is true (cards appear instantly).
  const entering = useMemo(
    () => reducedMotion
      ? undefined
      : SlideInRight
          .delay(entryDelay)
          .duration(300)
          .springify()
          .damping(18),
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
      <ReAnimated.View
        entering={entering}
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
          {/* [CRIT-04] pulse=false â€” getDocs is snapshot, not real-time */}
          <LiveDot size={5} gold={isSelected} pulse={false} />
          <Text style={[hc.count, isSelected && { color: accent }]}>
            {country.onlineCount > 0 ? fmtCount(country.onlineCount) : 'â€”'}
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
      </ReAnimated.View>
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

// â”€â”€â”€ CountryRow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface CountryRowProps {
  country:    CountryDoc;
  isSelected: boolean;
  onPress:    (country: CountryDoc) => void;
}

const CountryRow = memo<CountryRowProps>(({ country, isSelected, onPress }) => {
  const scale     = useRef(new Animated.Value(1)).current;
  // [v4-FEAT-04] Background flash â€” gold tint overlay, 80ms total (40ms ramp-up + 40ms ramp-down).
  // Confirms the tap instantly before the SwitchingOverlay appears (~160ms later).
  const flashAnim = useRef(new Animated.Value(0)).current;
  const regionBg  = REGION_FLAG_BG[country.region];
  const heatFill  = Math.max(0, Math.min(1, country.heat / 100));
  const accent    = REGION_ACCENT[country.region] as string;

  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() => {
    // Scale press â€” 0.97 "press" confirm
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
    // [v4-FEAT-04] 80ms background flash: ramp to gold tint in 40ms, ramp back in 40ms
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 40, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 40, useNativeDriver: false }),
    ]).start();
  }, [scale, flashAnim]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 55, bounciness: 4 }).start(),
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
      accessibilityState={{ selected: isSelected }}
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
              ? <LiveDot size={5} gold={isSelected} pulse={false} />
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

        {/* [v4-FEAT-04] Background flash overlay â€” absolutely fills the row,
            opacity driven by flashAnim (0â†’1â†’0 over 80ms on press).
            pointerEvents="none" so it never intercepts touches. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: DV.activeRowBg, opacity: flashAnim },
          ]}
          pointerEvents="none"
        />
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

// â”€â”€â”€ RowDivider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RowDivider = memo(() => (
  <View
    style={{ height:L.divH, backgroundColor:T.borderSubtle, marginHorizontal:L.rowPadH }}
    accessible={false}
    importantForAccessibility="no-hide-descendants"
  />
));

// â”€â”€â”€ RegionPill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface RegionPillProps {
  label:   RegionFilter;
  active:  boolean;
  count?:  number;
  onPress: (filter: RegionFilter) => void;
}

const RegionPill = memo<RegionPillProps>(({ label, active, count, onPress }) => {
  const handlePress = useCallback(() => onPress(label), [onPress, label]);
  const displayText = count !== undefined ? `${label} Â· ${count}` : label;

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

// â”€â”€â”€ AlphabetSidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // [BUG-02] PanResponder is already imported at module scope â€” removed the
    // erroneous require() call that ran on every render and defeated tree-shaking.
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
        // [HIGH-06] Don't claim moves â€” lets BottomSheetFlatList scroll normally
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

// â”€â”€â”€ [v4-FEAT-04] LetterOverlay â€” Spring enter, ease-out exit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reanimated useSharedValue approach avoids re-mount jank during rapid pan.
// Single mounted instance: animates in when letter becomes non-null, out when null.
const LetterOverlay = memo<{ letter: string | null; reducedMotion?: boolean }>(
  ({ letter, reducedMotion = false }) => {
    const scale   = useSharedValue(0.7);
    const opacity = useSharedValue(0);
    const letterRef = useRef(letter);
    letterRef.current = letter;

    useEffect(() => {
      if (letter) {
        if (reducedMotion) {
          scale.value   = 1;
          opacity.value = 1;
        } else {
          // Enter: spring scale + timing opacity per PRD Feature 6 spec
          scale.value   = withSpring(1, { damping: 15, stiffness: 350 });
          opacity.value = withTiming(1, { duration: 150 });
        }
      } else {
        if (reducedMotion) {
          scale.value   = 0.7;
          opacity.value = 0;
        } else {
          // Exit: ease-out scale + opacity, 100ms per PRD Feature 6 spec
          scale.value   = withTiming(0.7, { duration: 100 });
          opacity.value = withTiming(0,   { duration: 100 });
        }
      }
    }, [letter, reducedMotion, scale, opacity]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity:    opacity.value,
    }));

    // Always render (keeps exit animation alive); invisible via opacity
    return (
      <View style={lo.container} pointerEvents="none">
        <ReAnimated.View style={[lo.bubble, animStyle]}>
          <Text style={lo.letter}>{letter ?? ''}</Text>
        </ReAnimated.View>
      </View>
    );
  },
);

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

// â”€â”€â”€ [HIGH-02 / ADD-01] RecentlyVisitedSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface RecentlyVisitedProps {
  countries: CountryDoc[];
  selected:  string;
  onSelect:  (country: CountryDoc) => void;
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

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
}: CountryPickerSheetProps) {

  // [v4-ARCH-01] BottomSheet ref â€” imperative present/dismiss instead of
  // conditional render. Snap points replace SHEET_MAX.
  const sheetRef = useRef<BottomSheetHandle>(null);
  // [v4-ADR-05] Two snap points: 55% comfortable peek (default open), 92% on search focus.
  // Sheet opens at 55% â†’ user taps search â†’ auto-expands to 92% (max result viewport).
  // keyboardBlurBehavior="restore" in the custom BottomSheet returns it to 55% on KB dismiss.
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

  const searchRef     = useRef<TextInput>(null);
  // [v4-ARCH-02] listRef typed as FlatList â€” BottomSheetFlatList is FlatList-compatible
  const listRef       = useRef<FlatList<ListItem>>(null);
  const fetchIdRef    = useRef(0);
  const isFetchingRef = useRef(false);
  const isMountedRef  = useRef(true);
  const isSwitchingRef  = useRef(false);
  const retryCountRef   = useRef(0);
  const [retryCount,    setRetryCount]   = useState(0); // [A11Y-03] state mirrors ref so a11y label re-renders
  const selectedRef     = useRef(selected);
  const recentIdsRef    = useRef(recentIds);
  // [FIX-HEIGHT-03] Ref mirror of searchQuery â€” used in onContentSizeChange to avoid
  // stale closure. Cannot use searchQuery directly in onContentSizeChange because
  // the callback captures the value at definition time.
  const searchQueryRef  = useRef(searchQuery);

  useEffect(() => { selectedRef.current  = selected;     }, [selected]);
  useEffect(() => { recentIdsRef.current = recentIds;    }, [recentIds]);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // â”€â”€ [FEAT-06] One-time v2â†’v3 recents migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { void migrateRecentsCache(); }, []);

  // â”€â”€ [v4-ARCH-01] Imperative open/close via sheetRef â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (visible) {
      void hapticLight(); // [UX-02] Subtle haptic matches iOS Share Sheet behaviour
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  // â”€â”€ [v4-ARCH-07] Backdrop press handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior="close"
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
      />
    ),
    [],
  );

  // Called by gorhom when sheet fully dismisses (swipe or backdrop tap)
  const handleSheetClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // â”€â”€ [FIX-SCROLL-01] REMOVED: shellClipH / storedShellH / isShellVisible / lastScrollYRef
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ROOT CAUSE OF SCROLL JITTER IDENTIFIED:
  //
  //   shellClipH was an Animated.Value (useNativeDriver:false â€” layout prop) wired to the
  //   *height* of an Animated.View that sat in a flex-column ABOVE the FlatList (flex:1).
  //
  //   On every scroll event (scrollEventThrottle:16 = 60fps), hideShell() or showShell()
  //   started a new Animated.timing on shellClipH. Each animation caused React Native to
  //   recalculate the entire flex tree. Since the FlatList's height = parent â€“ shellClipH,
  //   the FlatList's layout bounds changed on every frame of the shell animation.
  //
  //   Native scroll engine holds the scroll position in native memory. When JS-side layout
  //   changes the FlatList's frame (height shrinks/grows), the native engine adjusts the
  //   visible content offset to compensate â€” creating the "list auto-scrolls up/down" effect
  //   the user observed.
  //
  // FIX: shell always occupies its natural height in the flex layout. FlatList height is
  //      100% stable during scroll. No showShell/hideShell animations. No jitter.
  //
  // [FIX-HEIGHT-03] shellHRef â€” measure shell height for adaptive height calculation only.
  const shellHRef = useRef(0);


  // â”€â”€ [v4-ARCH-06] AnimatedPillsRow â€” height + opacity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Note: height uses useNativeDriver:false (layout prop); opacity uses true (UI thread).
  // Animated.parallel supports mixed useNativeDriver values â€” each runs independently.
  const pillsHeight  = useRef(new Animated.Value(L.pillRowH)).current;
  const pillsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isSearching = rawQuery.length > 0;
    Animated.parallel([
      Animated.timing(pillsHeight, {
        toValue:         isSearching ? 0 : L.pillRowH,
        duration:        isSearching ? 200 : 220,
        easing:          Easing.out(Easing.cubic),
        useNativeDriver: false, // height cannot use native driver
      }),
      Animated.timing(pillsOpacity, {
        toValue:         isSearching ? 0 : 1,
        duration:        isSearching ? 160 : 180,
        easing:          Easing.out(Easing.cubic),
        useNativeDriver: true, // opacity runs on UI thread
      }),
    ]).start();
  }, [rawQuery, pillsHeight, pillsOpacity]);

  // â”€â”€ [v4-FEAT-01] Search bar focus glow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Interpolates border from cream[300] â†’ gold[600] on focus.
  // useNativeDriver: false required for color interpolation.
  const searchBorderAnim = useRef(new Animated.Value(0)).current;
  const animatedBorderColor = searchBorderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [T.border, T.gold],
  });

  const handleSearchFocus = useCallback(() => {
    // [FIX-SCROLL-01] Removed: inline shell-clip animation (was adding JS-thread
    // layout work on search focus, contributing to the scroll jitter problem).
    // [v4-ADR-05] Auto-snap to 92% on search focus â€” maximum space for results.
    // WhatsApp contact picker pattern: tap search â†’ full height immediately.
    sheetRef.current?.snapToIndex(1);
    // Animate the search bar border glow (cream[300] â†’ gold[600]).
    Animated.timing(searchBorderAnim, {
      toValue:         1,
      duration:        180,
      useNativeDriver: false,
    }).start();
  }, [searchBorderAnim]);

  const handleSearchBlur = useCallback(() => {
    Animated.timing(searchBorderAnim, {
      toValue:         0,
      duration:        150,
      useNativeDriver: false,
    }).start();
  }, [searchBorderAnim]);

  // â”€â”€ [FIX-HEIGHT-03] Shell layout measurement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // [FIX-SCROLL-01] Removed: shellClipH sync + isShellVisible guard (no longer needed).
  // Now only records height for FlatList.onContentSizeChange adaptive height calc.
  // Still called on every render where shell height changes (pills in/out, active country).
  const onShellLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) shellHRef.current = h;
    },
    [],
  );

  // [FIX-SCROLL-01] hideShell / showShell removed.
  // They were the proximate cause of the scroll jitter â€” see the root cause analysis above.

  // â”€â”€ Shimmer animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ [ADD-04] 60 s tick for relative time label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (fetchedAt == null) return;
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  // â”€â”€ Debounced search â€” 150ms (was 300ms, [PERF-02]) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 300ms lagged behind 1â€“2 keystrokes at normal typing speed. 150ms feels
  // instant while still avoiding a filter on every single keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 150);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // â”€â”€ [SCROLL-05] Reset list scroll when search query settles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Without this, changing search terms while mid-list leaves a blank area at
  // top because the previous scroll position doesn't match the new result set.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [searchQuery]);

  // â”€â”€ Reduced motion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // â”€â”€ Load on open â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!visible) return;

    retryCountRef.current  = 0;
    setRetryCount(0); // [A11Y-03] keep state in sync for fresh a11y label
    isSwitchingRef.current = false;

    const currentFetchId = ++fetchIdRef.current;

    setSheetState('loading');
    setRawQuery('');
    setSearchQuery('');
    setRegionFilter('All');
    setError(null);
    setSwitchingTo(null);

    AsyncStorage.getItem(CW_RECENTS_KEY)
      .then((raw) => {
        if (fetchIdRef.current !== currentFetchId || !raw) return;
        try { setRecentIds(JSON.parse(raw) as string[]); } catch { /* ignore */ }
      })
      .catch(() => {});

    fetchCountries()
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== currentFetchId) return;
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

  // â”€â”€ [ADD-03] Pull-to-refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ [MED-06] Retry with cap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleRetry = useCallback(() => {
    if (isFetchingRef.current) return;
    if (retryCountRef.current >= MAX_RETRIES) {
      setError('Too many failed attempts. Please check your connection and restart the app.');
      return;
    }
    retryCountRef.current++;
    setRetryCount(retryCountRef.current); // [A11Y-03] re-render a11y label with new attempt count
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

  // â”€â”€ Filtered + sorted lists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const regionFiltered = useMemo<CountryDoc[]>(() => {
    if (regionFilter === 'All') return countries;
    return countries.filter((c) => c.region === regionFilter);
  }, [countries, regionFilter]);

  // [HIGH-04] Sort once per regionFilter change
  const sortedRegionFiltered = useMemo(
    () => [...regionFiltered].sort((a, b) => a.name.localeCompare(b.name)),
    [regionFiltered],
  );

  // [HIGH-08] Search within regionFiltered. [MED-03] Diacritics. [ADD-09] Dial code.
  const displayCountries = useMemo<CountryDoc[]>(() => {
    if (!searchQuery.trim()) return regionFiltered;

    const q       = searchQuery.trim();
    const normQ   = normalizeDiacritics(q);
    const isDialQ = /^\+?\d+$/.test(q);
    const digits  = q.replace(/\D/g, '');

    return regionFiltered.filter((c) => {
      if (normalizeDiacritics(c.name).includes(normQ)) return true;
      if (c.id.toLowerCase() === normQ)               return true;
      if (isDialQ && c.dialCode?.replace(/\D/g, '').startsWith(digits)) return true;
      return false;
    });
  }, [regionFiltered, searchQuery]);

  const trendingCountries = useMemo(
    () => countries.slice(0, TRENDING_COUNT),
    [countries],
  );

  // [ADD-08] Country counts per region
  const regionCounts = useMemo<Partial<Record<RegionFilter, number>>>(() => {
    const counts: Partial<Record<RegionFilter, number>> = { 'All': countries.length };
    for (const c of countries) {
      counts[c.region] = (counts[c.region] ?? 0) + 1;
    }
    return counts;
  }, [countries]);

  // [ADD-04] Relative time label, auto-ticks every 60s [MED-05]
  const countTimeLabel = useMemo<string | null>(() => {
    if (fetchedAt == null) return null;
    const diffMin = Math.round((tickNow - fetchedAt) / 60_000);
    if (diffMin < 1)   return 'Updated just now';
    if (diffMin === 1) return 'Updated 1 min ago';
    if (diffMin < 60)  return `Updated ${diffMin} min ago`;
    return `Counts at ${new Date(fetchedAt).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })}`;
  }, [fetchedAt, tickNow]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selected) ?? null,
    [countries, selected],
  );

  const recentCountries = useMemo<CountryDoc[]>(
    () => recentIds.flatMap((id) => {
      const c = countries.find((c) => c.id === id);
      return c ? [c] : [];
    }),
    [recentIds, countries],
  );

  // â”€â”€ Flat data + A-Z sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const flatData = useMemo<ListItem[]>(() => {
    if (searchQuery.trim()) return buildSearchResults(displayCountries);
    return buildAlphaSections(sortedRegionFiltered);
  }, [displayCountries, searchQuery, sortedRegionFiltered]);

  // [PERF-01] During search, flatData contains only CountryItem rows (no sections
  // or dividers), so every item is exactly L.rowH tall. Skip the O(n) precomputation
  // on every keystroke; use a simple formula instead. Precompute only in browse mode
  // where section/divider heights vary and scrollToIndex accuracy matters.
  const itemLayouts = useMemo(
    () => (searchQuery.trim() ? null : precomputeLayouts(flatData)),
    [flatData, searchQuery],
  );

  // â”€â”€ Alphabet sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Region filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleRegion = useCallback((r: RegionFilter) => {
    void hapticSelect();
    setRegionFilter(r);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // [FIX-SCROLL-01] Simplified handleListScroll.
  //
  // BEFORE: Every scroll event called showShell/hideShell, which animated shellClipH
  //         (useNativeDriver:false, layout prop). This changed the FlatList's flex height
  //         60Ã— per second while the user was scrolling â†’ native scroll engine compensated
  //         by adjusting content offset â†’ felt like list auto-scrolled up/down.
  //
  // AFTER:  Only handle iOS overscroll-to-dismiss (y < 0 = rubber-band at list top).
  //         FlatList height never changes during scroll. Zero layout thrash. Zero jitter.
  //
  // Android dismiss: handled via onScrollEndDrag velocity check (below) â€” unchanged.
  const handleListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isRefreshing) return;
      const y = e.nativeEvent.contentOffset.y;

      // iOS overscroll-to-dismiss: y < 0 means user is rubber-banding past the top.
      // Mirror as translateY on the sheet so sheet follows finger downward.
      if (Platform.OS === 'ios' && y < 0) {
        sheetRef.current?.dragBy(-y * 1.4);
      }
    },
    [isRefreshing],
  );

  const handleListScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isRefreshing) return;
      const { contentOffset, velocity } = e.nativeEvent;
      const atTop = contentOffset.y <= 1;
      const vy    = velocity?.y ?? 0;

      const CLOSE_VY_IOS     = L.closeVelocityIOS;
      const CLOSE_VY_ANDROID = L.closeVelocityAndroid;
      const closeThreshold   = Platform.OS === 'ios' ? CLOSE_VY_IOS : CLOSE_VY_ANDROID;

      // [SCROLL-04] Samsung (and some other OEM) devices return velocity=undefined
      // from onScrollEndDrag. Fallback: also close when content pulled down >30px
      // (rubber-band displacement). This ensures the gesture works on all Android.
      const didFlick      = vy < closeThreshold;
      const didDragEnough = contentOffset.y < -30;

      if (atTop && (didFlick || didDragEnough)) {
        // Fast downward flick OR enough rubber-band drag at the top â†’ dismiss sheet
        void hapticLight();
        sheetRef.current?.close();
      } else if (Platform.OS === 'ios' && atTop) {
        // Slow overscroll that didn't reach threshold â†’ spring back open
        sheetRef.current?.snapBack();
      }
    },
    [isRefreshing],
  );

  // â”€â”€ Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSelect = useCallback(async (country: CountryDoc) => {
    if (isSwitchingRef.current) return;
    if (country.id === selectedRef.current) { onClose(); return; }

    isSwitchingRef.current = true;
    setSwitchingTo(country);
    void hapticMedium();
    Keyboard.dismiss();
    setSheetState('switching');

    // [FIX-SWITCHING] try/finally guarantees isSwitchingRef always released
    try {
      try {
        await AsyncStorage.setItem(CW_COUNTRY_KEY, country.id);
        const updated = [
          country.id,
          ...recentIdsRef.current.filter((id) => id !== country.id),
        ].slice(0, MAX_RECENTS);
        await AsyncStorage.setItem(CW_RECENTS_KEY, JSON.stringify(updated));
        if (isMountedRef.current) setRecentIds(updated);
      } catch { /* non-critical */ }

      onSelect(country.id, country.name, country.emoji);

      if (isMountedRef.current) {
        setSheetState('idle');
        setSwitchingTo(null);
      }

      await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 160));
      onClose();
    } finally {
      isSwitchingRef.current = false;
    }
  }, [onClose, onSelect, reducedMotion]);

  // â”€â”€ List helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const keyExtractor = useCallback((item: ListItem, i: number): string => {
    if (item.type === 'section') return `sec-${item.letter}`;
    if (item.type === 'divider') return item.id;
    return `country-${item.country.id}-${i}`;
  }, []);

  // [PERF-04] `selected` was in the useCallback dep array, so every selection
  // change recreated renderItem â†’ ALL CountryRow instances re-rendered (even
  // un-selected ones). Fix: read selected from selectedRef inside renderItem
  // (stable reference) and tell FlatList about the change via `extraData`.
  // FlatList calls renderItem again for each cell; memo on CountryRow ensures
  // only the actually-changed rows (old selected + new selected) paint.
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    if (item.type === 'divider') return <RowDivider />;
    return (
      <CountryRow
        country={item.country}
        isSelected={item.country.id === selectedRef.current}
        onPress={handleSelect}
      />
    );
  }, [handleSelect]); // no `selected` dep â€” selectedRef + extraData handle reactivity

  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      // [PERF-01] itemLayouts is null during search â€” use fast O(1) formula.
      if (!itemLayouts) return { length: L.rowH, offset: L.rowH * index, index };
      return itemLayouts[index] ?? { length: L.rowH, offset: L.rowH * index, index };
    },
    [itemLayouts],
  );

  const clearSearch = useCallback(() => {
    setRawQuery('');
    searchRef.current?.focus();
  }, []);

  // â”€â”€ Dynamic labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // [UX-04] Removed hardcoded 195 â€” it was wrong when collection size differs
  // and caused a jarring number-jump when data loaded. Empty string avoids any count.
  const placeholder  = countries.length > 0
    ? `Search ${countries.length} countriesâ€¦`
    : 'Search countriesâ€¦';
  const showTrending = !searchQuery.trim() && regionFilter === 'All' && trendingCountries.length > 0;
  const showAlpha    = alphabetLetters.length > 0 && !searchQuery.trim();
  const showRecents  = recentCountries.length > 0 && !searchQuery.trim();

  const isRegionSearchEmpty =
    searchQuery.trim().length > 0 &&
    displayCountries.length === 0 &&
    regionFilter !== 'All';

  // â”€â”€ [FIX-LAYOUT-1] ListHeaderComponent: Trending + Recents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderListHeader = useCallback(() => (
    <>
      {showTrending && (
        <View style={sh.trendingSection}>
          <View style={sh.trendingLabelRow}>
            <Feather name="trending-up" size={13} color={T.gold} />
            <Text style={sh.trendingLabel}>TRENDING</Text>
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
            {/* [v4-FEAT-02] Stagger entry: index * 40ms delay per PRD spec */}
            {trendingCountries.map((c, index) => (
              <HeroCard
                key={c.id}
                country={c}
                isSelected={c.id === selected}
                onPress={handleSelect}
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
          countries={recentCountries}
          selected={selected}
          onSelect={handleSelect}
        />
      )}
    </>
  ), [showTrending, showRecents, trendingCountries, recentCountries, selected, handleSelect, countTimeLabel, reducedMotion]);

  // â”€â”€ [FIX-LAYOUT-2] ListEmptyComponent: empty states inside FlatList â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // [v4-FEAT-07] Empty state fade-in â€” opacity 0â†’1 over 200ms.
  // Empty states that "pop" onto screen feel like layout thrash; a gentle fade feels intentional.
  const renderListEmpty = useCallback(() => {
    if (isRegionSearchEmpty) {
      return (
        <ReAnimated.View
          entering={!reducedMotion ? FadeIn.duration(200) : undefined}
          style={sh.stateWrap}
        >
          <View style={sh.stateIconCircle}>
            <Feather name="search" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>No Results in {regionFilter}</Text>
          <Text style={sh.stateHint}>
            No countries match "{searchQuery}" in {regionFilter}.
          </Text>
          <Pressable
            onPress={() => { void hapticLight(); setRegionFilter('All'); }}
            style={({ pressed }) => [sh.ctaBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`Search all countries for ${searchQuery}`}
          >
            <Feather name="globe" size={14} color={T.gold} />
            <Text style={sh.ctaBtnText}>Search All Countries</Text>
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
          <Feather name="globe" size={28} color={T.textTertiary} />
        </View>
        <Text style={sh.stateTitle}>No Countries Found</Text>
        <Text style={sh.stateHint}>
          {searchQuery.trim()
            ? `"${searchQuery}" didn't match any country`
            : 'No countries in this region yet'}
        </Text>
      </ReAnimated.View>
    );
  }, [isRegionSearchEmpty, regionFilter, searchQuery, reducedMotion]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER â€” v4.0 Tree
  //
  // BottomSheet (gorhom v5)
  // â”œâ”€â”€ BottomSheetView          â† PINNED SHELL â€” never scrolls
  // â”‚   â”œâ”€â”€ Handle
  // â”‚   â”œâ”€â”€ titleRowMerged       â† [v4-ARCH-05] Globe + Title + ActiveInline + Close
  // â”‚   â”œâ”€â”€ searchWrap (Animated)â† [v4-FEAT-01] animated border glow
  // â”‚   â””â”€â”€ pillAnimWrap (Animated)â† [v4-ARCH-06] height+opacity collapse
  // â”‚
  // â””â”€â”€ (conditional on sheetState)
  //     loading  â†’ BottomSheetView + skeleton
  //     error    â†’ BottomSheetView + error state
  //     idle     â†’ BottomSheetFlatList (ONE scroll owner for everything)
  //                  + AlphabetSidebar (absolute, no conflict)
  //                  + LetterOverlay (absolute, Reanimated)
  //
  // SwitchingOverlay (absolute, [v4-FEAT-03] FadeIn 150ms)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      // [v4-ARCH-03] gorhom handles keyboard â€” no KeyboardAvoidingView needed
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      // [v4-ARCH-07] Backdrop â€” tap outside to close
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      onClose={handleSheetClose}
      backgroundStyle={sh.sheetBackground}
      handleStyle={sh.handleContainer}
      handleIndicatorStyle={sh.handleIndicator}
    >
      {/* â”€â”€ PINNED SHELL â€” The "Shell vs Content" principle (PRD Â§2 Principle 5) â”€â”€ */}
      {/* SearchBar, title, pills live here. They CANNOT scroll away.             */}
      {/*                                                                          */}
      {/* [FIX-SCROLL-01] No Animated.View wrapper with height:shellClipH.        */}
      {/* Shell occupies its natural flex height â€” FlatList height is always       */}
      {/* stable during scroll. The old wrapper was the root cause of jitter.      */}
      <BottomSheetView style={sh.pinnedShell} onLayout={onShellLayout}>

        {/* â”€â”€ [v4-ARCH-05] MERGED TITLE ROW â€” saves 52px vs v3.3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* Old: [Title row 54px] + [Active strip 52px] = 106px */}
        {/* New: [Merged row ~52px] = 52px â€” 54px saved */}
        <View style={sh.titleRowMerged}>
          {/* Left: Globe icon */}
          <View style={sh.globeIconWrap}>
            <Feather name="globe" size={22} color={T.gold} />
          </View>

          {/* Center: Title + Active inline */}
          <View style={sh.titleTextGroup}>
            <Text style={sh.title}>Choose Country</Text>

            {/* [v4-ARCH-05] Active strip now inline below title */}
            {selectedCountry != null && sheetState !== 'loading' && (
              <View
                style={sh.activeInline}
                accessibilityRole="text"
                accessibilityLabel={`Active country: ${selectedCountry.name}`}
              >
                {/* [CRIT-04] pulse=true here â€” countTimeLabel nearby provides context */}
                <LiveDot size={5} pulse />
                <Text style={sh.activeFlag} accessible={false}>
                  {selectedCountry.emoji}
                </Text>
                <Text style={sh.activeName} numberOfLines={1}>
                  {selectedCountry.name}
                </Text>
                <Text style={sh.activeSep} accessible={false}>Â·</Text>
                <Text style={sh.activeCountInline} numberOfLines={1}>
                  {selectedCountry.onlineCount > 0
                    ? `${fmtCount(selectedCountry.onlineCount)} online`
                    : 'No one online'}
                </Text>
                <View style={sh.activeBadge}>
                  <Text style={sh.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
            )}
          </View>

          {/* Right: Close button */}
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

        {/* â”€â”€ [v4-FEAT-01] SEARCH BAR â€” gold glow on focus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* SearchBar is PINNED here. Cannot scroll. Cannot be buried by keyboard. */}
        {/* It's not inside a scroll container â€” correct hierarchy placement. */}
        <Animated.View style={[sh.searchWrap, { borderColor: animatedBorderColor }]}>
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
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
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
        </Animated.View>

        {/* â”€â”€ [v4-ARCH-06] ANIMATED PILLS ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* height: pillRowHâ†’0 (200ms) on search start; 0â†’pillRowH (220ms) on clear */}
        {/* opacity: 1â†’0 (160ms) on search start; 0â†’1 (180ms) on clear */}
        {/* Result: list gains 50px during search â€” bigger result viewport */}
        <Animated.View
          style={[
            sh.pillAnimWrap,
            { height: pillsHeight, opacity: pillsOpacity, overflow: 'hidden' },
          ]}
        >
          {sheetState !== 'loading' && error == null && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sh.pillScroll}
              keyboardShouldPersistTaps="always"
              accessibilityRole="tablist"
              accessibilityLabel="Filter countries by region"
            >
              {REGION_FILTERS.map((r) => (
                <RegionPill
                  key={r}
                  label={r}
                  active={regionFilter === r}
                  count={countries.length > 0 ? (regionCounts[r] ?? 0) : undefined}
                  onPress={handleRegion}
                />
              ))}
            </ScrollView>
          )}
        </Animated.View>

        <View style={sh.hairline} />
        </BottomSheetView>

      {/* â”€â”€ CONTENT ZONE â€” Everything below the shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

      {sheetState === 'loading' ? (

        // [ADD-10] Skeleton trending + rows
        <BottomSheetView style={sh.contentArea}>
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
          {/* [UX-03] Skeleton recents prevent the jarring pop-in. Show only when we
              already know recentIds exist (loaded from AsyncStorage before fetch). */}
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
            accessibilityLabel="Loading countries"
            accessible
          >
            {Array.from({ length: L.shimmerRows }, (_, i) => (
              <SkeletonRow key={i} shimmer={shimmerAnim} />
            ))}
          </View>
        </BottomSheetView>

      ) : error != null ? (

        <BottomSheetView style={sh.stateWrap}>
          <View style={sh.stateIconCircle}>
            <Feather name="wifi-off" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>Failed to Load</Text>
          <Text style={sh.stateHint}>{error}</Text>
          {retryCountRef.current < MAX_RETRIES && (
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [sh.retryBtn, pressed && sh.retryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Retry loading countries (attempt ${retryCount + 1} of ${MAX_RETRIES})`}
            >
              <Feather name="refresh-cw" size={14} color={T.sheetBg} />
              <Text style={sh.retryBtnText}>Try Again</Text>
            </Pressable>
          )}
        </BottomSheetView>

      ) : (

        // [v4-ARCH-01/02] ONE scroll owner. BottomSheetFlatList gets 100% of
        // the space below the pinned shell. Gesture coordination with the sheet
        // pan handler runs on the UI thread via Reanimated shared values.
        // No KeyboardAvoidingView â€” gorhom's fillParent handles it.
        <View
          style={sh.listWrap}
          accessibilityRole="radiogroup"
          accessibilityLabel="Country list"
        >
          {/* [A11Y-02] Hidden view announces search result count to screen readers.
              polite = waits for current speech to finish before announcing. */}
          {searchQuery.trim().length > 0 && (
            <View
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${displayCountries.length} ${displayCountries.length === 1 ? 'country' : 'countries'} found`}
              style={sh.srOnly}
            />
          )}
          {/* [v4-ARCH-02] BottomSheetFlatList â€” required for gorhom gesture integration */}
          {/* All existing getItemLayout / renderItem / ListHeaderComponent logic preserved */}
          <BottomSheetFlatList
            ref={listRef}
            data={flatData}
            extraData={selected}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            // [FIX-LAYOUT-1] Trending + Recents scroll WITH the list
            ListHeaderComponent={renderListHeader}
            // [FIX-LAYOUT-2] Empty states inside FlatList
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
              // [BUG-04] ScrollToIndexFailedInfo has no `averageItemLength` property.
              // Safe fallback: use precomputed offset if available, else L.rowH * index.
              const offset = itemLayouts?.[info.index]?.offset
                ?? L.rowH * info.index;
              listRef.current?.scrollToOffset({ offset, animated: false });
            }}
            // â”€â”€ Scroll-to-dismiss â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            // iOS:     overscroll (y<0) moves sheet; fast-flick â†’ close.
            // Android: fast downward flick from top â†’ close.
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            onScrollEndDrag={handleListScrollEndDrag}
            // Allow overscroll on both platforms so the gesture is detectable
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
            // â”€â”€ [FIX-HEIGHT-03] Adaptive height â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            // When search results are few (e.g. 1-3 countries), shrink the sheet to
            // fit so there isn't a vast empty gap below the results.
            // Logic: only activates during active search (searchQueryRef guards it).
            // When search clears, keyboardBlurBehavior="restore" already snaps back
            // to 55% via BottomSheet's keyboard listener â€” no manual restore needed.
            // Floor: 40% (never collapse to nothing). Ceiling: 92% (already clamped
            // in setHeight). Handle bar â‰ˆ14px + bottom pad 24px + buffer 6px = 44px.
            onContentSizeChange={(_w, contentH) => {
              if (!searchQueryRef.current.trim()) return; // browse mode â€” snap points drive height
              const totalH = contentH + shellHRef.current + 44;
              sheetRef.current?.setHeight(Math.max(_parseSnap('40%'), totalH));
            }}
            // â”€â”€ Pull-to-refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

          {/* [NEW-02] A-Z sidebar â€” positioned absolute, no gesture conflict */}
          {/* Touch region (right 22px) does not overlap FlatList touch area */}
          {showAlpha && (
            <AlphabetSidebar
              letters={alphabetLetters}
              onPress={handleAlphabetPress}
              onLetterChange={setActiveAlphaLetter}
            />
          )}

          {/* [v4-FEAT-04] LetterOverlay â€” Reanimated spring enter, ease-out exit */}
          <LetterOverlay letter={activeAlphaLetter} reducedMotion={reducedMotion} />
        </View>

      )}

      {/* â”€â”€ [v4-FEAT-03] SWITCHING OVERLAY â€” FadeIn 150ms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* v3.3: instant snap (felt like a bug) â†’ v4.0: 150ms fade (intentional) */}
      {sheetState === 'switching' && (
        <ReAnimated.View
          entering={!reducedMotion ? FadeIn.duration(150) : undefined}
          style={sh.switchOverlay}
          pointerEvents="auto"
        >
          {/* [UX-01] Spinner ring around the emoji clarifies "loading in progress".  */}
          {/* Without it, users on slow connections tapped repeatedly thinking the  */}
          {/* first tap didn't register (isSwitchingRef guard silently ate the taps). */}
          <View style={sh.switchSpinnerWrap}>
            <ActivityIndicator
              size={60}
              color={T.gold}
              style={sh.switchActivityRing}
            />
            <View style={sh.switchSpinner}>
              <Text style={sh.switchFlag}>
                {switchingTo?.emoji ?? selectedCountry?.emoji ?? 'ðŸŒ'}
              </Text>
            </View>
          </View>
        </ReAnimated.View>
      )}
    </BottomSheet>
  );
}

// [BUG-03] Wrap in PulseProvider so each mounted sheet gets its own isolated
// Animated.Value. Without this, two sheets in a Navigator stack share the module-
// level `_pulse` object, corrupting ref counts and causing visual glitches.
export const CountryPickerSheet = memo((props: CountryPickerSheetProps) => (
  <PulseProvider>
    <CountryPickerSheetBase {...props} />
  </PulseProvider>
));
export default CountryPickerSheet;

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sh = StyleSheet.create({

  // [v4-ARCH-01] gorhom v5 uses backgroundStyle / handleStyle props
  sheetBackground: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    backgroundColor:      T.sheetBg,
  },
  handleContainer: {
    paddingTop: 10,
  },
  handleIndicator: {
    width:           L.handleW,
    height:          L.handleH,
    borderRadius:    L.handleH / 2,
    backgroundColor: T.border,
  },

  // â”€â”€ [v4-ARCH-05] Pinned shell â€” never scrolls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Replaces v3.3's sh.header + separate activeStrip + pillWrap + searchWrap.
  // SearchBar is here â†’ cannot be buried by keyboard â†’ [v4-ARCH-03] fix.
  pinnedShell: {
    backgroundColor: T.sheetBg,
    paddingBottom:   4,
  },

  // â”€â”€ [v4-ARCH-05] Merged title row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // v3.3: titleRow (54px) + activeStrip (52px) = 106px
  // v4.0: titleRowMerged (~52px) = saves 54px
  titleRowMerged: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    paddingVertical:   10,
    gap:               10,
  },
  globeIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    12,
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

  // [v4-ARCH-05] Active strip now inline â€” replaces the 52px standalone row
  activeInline: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    flexWrap:      'nowrap',
  },
  activeFlag:  { fontSize:13 },
  activeName: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.gold,
    fontFamily: FONT_HEADING.semiBold,
    flexShrink: 1,
    maxWidth:   100,
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
    fontSize:      8,
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

  // â”€â”€ [v4-FEAT-01] Search bar with Animated border color â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  L.rowPadH,
    marginVertical:    6,
    height:            L.searchH,
    backgroundColor:   T.surfaceSunken,
    borderRadius:      L.searchH / 2,
    paddingHorizontal: 14,
    borderWidth:       1.5,
    // borderColor is Animated â€” set via animatedBorderColor interpolation
    gap:               8,
  },
  searchInput: {
    flex:            1,
    fontSize:        14,
    color:           T.text,
    fontFamily:      FONT_BODY.regular,
    paddingVertical: 0,
  },

  // â”€â”€ [v4-ARCH-06] Animated pills wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // height is animated (50â†’0 or 0â†’50) via Animated.Value
  // overflow:'hidden' clips the pills as height collapses
  pillAnimWrap: {
    // height is controlled by Animated.Value â€” don't set static height here
  },
  pillScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   9,
    gap:               8,
    flexDirection:     'row',
  },

  hairline: {
    height:          1,
    backgroundColor: T.borderSubtle,
  },

  // â”€â”€ Content area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  contentArea: { flex:1 },
  listWrap:    { flex:1, position:'relative' },
  flatList:    { flex:1 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 24 : 20 },

  // â”€â”€ Trending section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    flex:          1,
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

  // â”€â”€ Empty / error states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // [ADD-07] "Search All Countries" CTA
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

  // â”€â”€ [v4-FEAT-03] Switching overlay â€” fades in via ReAnimated FadeIn 150ms â”€â”€â”€â”€
  // v3.3: instant appear (felt like bug). v4.0: 150ms fade (intentional).
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
  // [UX-01] Wrapper centres the spinner ring + emoji card together
  switchSpinnerWrap: {
    width:           80,
    height:          80,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // [UX-01] ActivityIndicator absolutely fills the wrap so it rings the card
  switchActivityRing: {
    position: 'absolute',
    width:    80,
    height:   80,
  },
  switchFlag: { fontSize:30 },

  // [A11Y-02] Visually hidden â€” zero-size container used only for live region announcements
  srOnly: { width: 0, height: 0, overflow: 'hidden' },
});

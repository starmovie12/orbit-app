/**
 * components/Header.tsx
 *
 * CROWD WORLD — Sticky App Header · LAW 15 Two-Row Architecture
 * Blueprint v5.0 BAAP EDITION · Part 3 §1 · LAW 15 COMPLIANT
 *
 * ── VISUAL ARCHITECTURE ──────────────────────────────────────────────────────
 *
 *  variant='world'  (Home Screen only · § 5.A)
 *  ┌──────────────────────────────────── Row 1 · 56px (headerRow1Height) ────┐
 *  │  CROWD WORLD  [Cormorant 24/700 tight]          [🪙 542]   [💬✦3]      │
 *  └────────────────────────────────────────────────────────────────────────┘
 *  ┌──────────────────────────────────── Row 2 · 44px (headerRow2Height) ────┐
 *  │  [📍 Chandigarh ⌄]  [Sector 17 ⌄]                                     │
 *  └────────────────────────────────────────────────────────────────────────┘
 *  ──── hairline border-bottom (colors.border.default) ────────────────────────
 *
 *  variant='tab'  (Discover · Wallet · Profile)
 *  ┌──────────────────────────────────── Row 1 · 56px ──────────────────────┐
 *  │  Discover  [optional subtitle]                  [🪙 542]   [💬✦3]     │
 *  └────────────────────────────────────────────────────────────────────────┘
 *  ──── hairline border-bottom ─────────────────────────────────────────────────
 *
 * ── HEIGHT ACCOUNTING (scroll insets at call-site) ───────────────────────────
 *   SafeAreaView edges={['top']} absorbs device status bar.
 *   world variant total: layout.headerHeight     = 100px  (56 + 44)
 *   tab   variant total: layout.headerRow1Height =  56px
 *   ➜ Use layout.headerHeight for world screens' FlatList contentInset.top
 *   ➜ Use layout.headerRow1Height for tab screens' scroll content inset
 *
 * ── LAWS HONOURED ────────────────────────────────────────────────────────────
 *   LAW 15 : Two-row header — 56px Row 1 + 44px Row 2 — NON-NEGOTIABLE
 *   Rule 03: No avatar in header (avatar lives ONLY in Glass Island Profile tab)
 *   Token  : All colors, spacing, radii from CROWN design system — no hardcoded values
 *
 * ── DEPS (declared in task spec) ─────────────────────────────────────────────
 *   components/atoms/Coins.tsx
 *   components/molecules/CityPill.tsx
 *   components/molecules/SectorPill.tsx
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   // Home screen (world variant — two-row):
 *   <Header
 *     variant="world"
 *     city="Chandigarh"
 *     sector="Sector 17"
 *     onPressCity={() => router.push('/city-picker')}
 *     onPressSector={() => router.push('/sector-picker')}
 *     credits={542}
 *     dmCount={3}
 *     onPressCredits={() => router.push('/wallet')}
 *     onPressDM={() => router.push('/inbox')}
 *   />
 *
 *   // Tab screen (single row):
 *   <Header
 *     variant="tab"
 *     title="Discover"
 *     subtitle="Cards & Challenges"
 *     credits={542}
 *     dmCount={3}
 *     onPressCredits={() => router.push('/wallet')}
 *     onPressDM={() => router.push('/inbox')}
 *   />
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { colors, radii, zIndex, palette } from '@/constants/colors';
import { layout, spacing }                from '@/constants/spacing';
import {
  FONT_HEADING,
  FONT_BODY,
  LETTER_SPACING,
}                                         from '@/constants/typography';
import {
  Duration,
  easeOut,
  springConfigs,
  useReducedMotion,
}                                         from '@/constants/animations';

import Coins      from '@/components/atoms/Coins';
import CityPill   from '@/components/molecules/CityPill';
import SectorPill from '@/components/molecules/SectorPill';

// ─── Types ────────────────────────────────────────────────────────────────────
//
// Discriminated union — TypeScript enforces the correct prop set per variant.
// 'world' variant requires city/sector picker props; 'tab' requires a screen title.
// No `never`-tagged cross-contamination can reach the render paths.

interface SharedProps {
  /** User's current CROWN credit balance — displayed in the gold pill */
  credits: number;
  /** Unread DM count — shown as badge on the chat icon (0 = badge hidden) */
  dmCount: number;
  /** Tapping the Coins pill navigates to /wallet */
  onPressCredits?: () => void;
  /** Tapping the DM icon navigates to /inbox */
  onPressDM?: () => void;
}

interface WorldVariantProps extends SharedProps {
  /** Two-row layout (LAW 15): wordmark in Row 1 + city/sector pills in Row 2 */
  variant: 'world';
  /** Display name of the active city, e.g. "Chandigarh" — passed to CityPill */
  city: string;
  /** Display name of the active sector, e.g. "Sector 17" — passed to SectorPill */
  sector: string;
  /** Opens the city-picker bottom sheet (§16) */
  onPressCity: () => void;
  /** Opens the sector-picker bottom sheet (§17) */
  onPressSector: () => void;
  /**
   * Pass `true` when this sector is the currently active/selected one
   * (shows the 2px gold border active state on SectorPill).
   * @default false
   */
  sectorIsActive?: boolean;
  title?: never;
  subtitle?: never;
}

interface TabVariantProps extends SharedProps {
  /** Single-row layout: screen title in the position where Row 1 sits */
  variant: 'tab';
  /** Primary screen name, e.g. "Discover", "Wallet", "Profile" */
  title: string;
  /** Optional secondary line below the title, e.g. "Cards & Challenges" */
  subtitle?: string;
  city?: never;
  sector?: never;
  onPressCity?: never;
  onPressSector?: never;
  sectorIsActive?: never;
}

/** Full typed HeaderProps — discriminated by `variant` */
export type HeaderProps = WorldVariantProps | TabVariantProps;

// ─── Sub-component: DM Button ─────────────────────────────────────────────────
//
// Gold chat-bubble icon + optional badge.
// Press animation: scale 1.0 → 0.92 (Duration.micro) + spring release.
// Reduced motion: opacity dip instead of scale (blueprint §A.1.6).

interface DMButtonProps {
  count:    number;
  onPress?: () => void;
}

const DMButton = memo<DMButtonProps>(({ count, onPress }) => {
  const reducedMotion = useReducedMotion();
  const scaleAnim     = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (reducedMotion) return;
    Animated.timing(scaleAnim, {
      toValue:         0.92,
      duration:        Duration.micro,   // 80ms — §5.N buttonPress
      easing:          easeOut,
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...springConfigs.springStiff,      // tension:200 · friction:18
    }).start();
  }, [scaleAnim]);

  const showBadge = count > 0;
  const badgeText = count > 99 ? '99+' : String(count);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={TOUCH_SLOP}
      accessibilityRole="button"
      accessibilityLabel={showBadge ? `${count} unread messages` : 'Direct Messages'}
      style={({ pressed }) =>
        reducedMotion && pressed ? styles.dmPressedOpacity : undefined
      }
    >
      <Animated.View
        style={[
          styles.dmInner,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Message-circle icon — gold brand color */}
        <Feather
          name="message-circle"
          size={22}
          color={colors.fg.brand}          // gold[600] #C9A227
        />

        {/* Badge — visible only when dmCount > 0 */}
        {showBadge && (
          <View style={styles.dmBadge}>
            <Text style={styles.dmBadgeText} numberOfLines={1}>
              {badgeText}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

DMButton.displayName = 'Header.DMButton';

// ─── Sub-component: Right Actions ─────────────────────────────────────────────
// Shared between both variants — Coins pill + DM button — always in Row 1 right.

interface RightActionsProps {
  credits:          number;
  dmCount:          number;
  onPressCredits?:  () => void;
  onPressDM?:       () => void;
}

const RightActions = memo<RightActionsProps>(({
  credits,
  dmCount,
  onPressCredits,
  onPressDM,
}) => (
  <View style={styles.rightActions}>
    <Coins
      amount={credits}
      size="sm"         // compact pill — glass island / header context
      animated          // pulses on credit change for delight feedback
      onPress={onPressCredits}
    />
    <DMButton
      count={dmCount}
      onPress={onPressDM}
    />
  </View>
));

RightActions.displayName = 'Header.RightActions';

// ─── Main component: Header ───────────────────────────────────────────────────

function HeaderComponent(props: HeaderProps) {
  const { credits, dmCount, onPressCredits, onPressDM } = props;

  return (
    <SafeAreaView
      edges={['top']}        // absorbs device status bar height only
      style={styles.safeArea}
    >
      {/* ── ROW 1 — Brand row (both variants) ────────────────────────────── */}
      {/*
       * World : CROWD WORLD wordmark (left) + Coins + DM (right)
       * Tab   : Screen title stack   (left) + Coins + DM (right)
       * Height: layout.headerRow1Height = 56px (LAW 15 §1)
       */}
      <View style={styles.row1}>

        {/* LEFT: wordmark (world) or screen title (tab) */}
        {props.variant === 'world' ? (

          /* WORLD — CROWD WORLD wordmark · Cormorant 24/700 · tight tracking */
          <Text
            style={styles.wordmark}
            numberOfLines={1}
            accessibilityRole="header"
            accessibilityLabel="CROWD WORLD"
          >
            CROWD WORLD
          </Text>

        ) : (

          /* TAB — dynamic screen title + optional subtitle */
          <View style={styles.tabTitleStack}>
            <Text style={styles.screenName} numberOfLines={1} accessibilityRole="header">
              {props.title}
            </Text>
            {props.subtitle ? (
              <Text style={styles.screenSub} numberOfLines={1}>
                {props.subtitle}
              </Text>
            ) : null}
          </View>

        )}

        {/* RIGHT: Coins + DM — identical in both variants */}
        <RightActions
          credits={credits}
          dmCount={dmCount}
          onPressCredits={onPressCredits}
          onPressDM={onPressDM}
        />
      </View>

      {/* ── ROW 2 — Location row (world variant only) ─────────────────────── */}
      {/*
       * Shows CityPill (left) + SectorPill (right).
       * Tab variant skips Row 2 entirely — the container renders nothing here.
       * Height: layout.headerRow2Height = 44px (LAW 15 §1)
       */}
      {props.variant === 'world' && (
        <View style={styles.row2}>
          <CityPill
            city={props.city}
            onPress={props.onPressCity}
          />
          <SectorPill
            sector={props.sector}
            isActive={props.sectorIsActive ?? false}
            onPress={props.onPressSector}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Memo + export ────────────────────────────────────────────────────────────
//
// React.memo — Header re-renders only when its props change.
// In practice this means:
//   • City / sector label changes (city picker selection)
//   • Credit balance updates (Firestore real-time listener)
//   • DM badge count changes (FCM notification push)
//   • dmCount / onPress* identity changes — handlers should be useCallback'd
//     at the call-site to avoid spurious re-renders on every parent update.

export default memo(HeaderComponent);

// ─── Constants ────────────────────────────────────────────────────────────────

/** Touch slop for DM button — meets 44px Rule 5.Q minimum */
const TOUCH_SLOP = { top: 11, bottom: 11, left: 8, right: 8 } as const;

// ─── Styles ───────────────────────────────────────────────────────────────────
//
// Token mapping:
//   colors.bg.surface          = white             — header background
//   colors.border.default      = cream[400]        — bottom hairline
//   colors.fg.brandSubtle      = gold[800] #8B6F18 — wordmark (AA 6.4:1)
//   colors.fg.primary          = ink[950]           — tab screen title
//   colors.fg.tertiary         = ink[500]           — tab subtitle
//   colors.fg.brand            = gold[600]          — DM icon, Coins border
//   colors.fg.brandHover       = gold[700]          — DM badge background
//   zIndex.fixedHeader         = 900               — sticky above scroll content
//   layout.headerRow1Height    = 56                — Row 1 (LAW 15)
//   layout.headerRow2Height    = 44                — Row 2 (LAW 15, world only)
//   spacing.screenH            = 18                — screen horizontal inset
//   spacing.sm                 =  8                — gap between pills (Row 2)
//   spacing.lg                 = 16                — gap between Coins + DM

const styles = StyleSheet.create({

  // SafeAreaView wrapper — owns the background, bottom border, shadow, z-index.
  // Clips to content so safe area padding is handled by the OS edge insets.
  safeArea: {
    backgroundColor:   colors.bg.surface,          // white — clean warm canvas
    zIndex:            zIndex.fixedHeader,          // 900 — sticky above FlatList
    borderBottomWidth: StyleSheet.hairlineWidth,    // 0.5px retina-sharp divider
    borderBottomColor: colors.border.default,       // cream[400] #E5CC95

    // Subtle gold-tinted shadow (tier1) — signals elevation without noise
    ...colors.shadow.tier1,
  },

  // ── Row 1 ────────────────────────────────────────────────────────────────
  // Fixed 56px (LAW 15 headerRow1Height). Space-between aligns wordmark/title
  // left and the Coins+DM actions right.
  row1: {
    height:            layout.headerRow1Height,     // 56px — LAW 15 §1
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.screenH,             // 18px — screen horizontal inset
  },

  // ── Row 2 ────────────────────────────────────────────────────────────────
  // Fixed 44px (LAW 15 headerRow2Height). Pills sit left, row is flex-start.
  // The hairline border below safeArea acts as the visual bottom edge of Row 2.
  row2: {
    height:            layout.headerRow2Height,     // 44px — LAW 15 §1
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.screenH,             // 18px — aligned with Row 1
    gap:               spacing.sm,                  //  8px — gap between CityPill + SectorPill
  },

  // ── World variant: CROWD WORLD wordmark ──────────────────────────────────
  // Cormorant Garamond 24/700 · tight tracking (-0.2) · brandSubtle gold[800]
  // Blueprint: "Premium minimalist wordmark · pure typography · weight 700 · tight tracking"
  // colors.fg.brandSubtle = gold[800] = #8B6F18 → WCAG AA 6.4:1 on white ✅
  wordmark: {
    fontFamily:        FONT_HEADING.bold,            // CormorantGaramond_700Bold
    fontSize:          24,
    fontWeight:        '700',
    lineHeight:        28,
    letterSpacing:     LETTER_SPACING.tight,         // -0.2 — "tight tracking" per spec
    color:             colors.fg.brandSubtle,        // gold[800] — brand text AA-safe
    flex:              1,                            // pushes actions to the right
    marginRight:       spacing.sm,                   // 8px breathing room before actions
  },

  // ── Tab variant: screen title stack ──────────────────────────────────────
  tabTitleStack: {
    flex:           1,
    justifyContent: 'center',
    marginRight:    spacing.sm,                      // 8px breathing room
  },

  // Primary screen name — Cormorant 24/700 like worldmark but slightly wider tracking
  // Uses ink[950] (primary text) for tab screens — less brand-forward than home.
  screenName: {
    fontFamily:    FONT_HEADING.bold,                // CormorantGaramond_700Bold
    fontSize:      24,
    fontWeight:    '700',
    lineHeight:    28,
    letterSpacing: LETTER_SPACING.wide,              // 0.3 — screen names breathe slightly
    color:         colors.fg.primary,               // ink[950] — primary text
  },

  // Optional secondary line — DM Sans 11/600 · ink[500] tertiary
  // e.g. "Cards & Challenges" under "Discover"
  screenSub: {
    fontFamily:    FONT_BODY.semiBold,               // DMSans_600SemiBold
    fontSize:      11,
    fontWeight:    '600',
    lineHeight:    15,
    letterSpacing: LETTER_SPACING.wide,              // 0.3 — matches .screen-sub-txt HTML
    color:         colors.fg.tertiary,              // ink[500] — de-emphasized
    marginTop:     2,
  },

  // ── Right actions (Coins + DM) ────────────────────────────────────────────
  // Shared across both variants. Fixed flex-end, no shrink.
  rightActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.lg,                       // 16px — matches original 16px gap
    flexShrink:    0,
  },

  // ── DM Button ─────────────────────────────────────────────────────────────
  // 22×22 Feather message-circle icon + absolute badge.
  // Wrapper is slightly larger for thumb comfort — hitSlop covers the rest.
  dmInner: {
    width:          32,                              // touch target — hitSlop extends to 44px
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },

  // Reduced-motion: opacity dip (blueprint §A.1.6)
  dmPressedOpacity: {
    opacity: 0.60,
  },

  // Badge pill — absolute top-right of dmInner
  // Background: colors.fg.brandHover = gold[700] #A88A24 (deeper than icon for contrast)
  // Border: 2px white separator — visually separates badge from icon
  dmBadge: {
    position:          'absolute',
    top:               -4,
    right:             -6,
    minWidth:          18,
    height:            18,
    borderRadius:      radii.full,                  // 9999 — perfect pill at any width
    backgroundColor:   colors.fg.brandHover,        // gold[700] — warm prestige badge
    borderWidth:       2,
    borderColor:       colors.bg.surface,           // white separator ring
    paddingHorizontal: 3,
    alignItems:        'center',
    justifyContent:    'center',

    // Elevates badge above icon — both iOS and Android
    ...Platform.select({
      ios: {
        shadowColor:   palette.ink[950],
        shadowOffset:  { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius:  2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Badge count text — DMSans 800 · white · compact
  // includeFontPadding: false → removes Android's extra vertical glyph space
  dmBadgeText: {
    fontFamily:          FONT_BODY.extraBold,        // DMSans_800ExtraBold
    fontSize:            10,
    fontWeight:          '800',
    color:               palette.white,
    lineHeight:          13,
    textAlign:           'center',
    includeFontPadding:  false,                      // Android centering fix
    textAlignVertical:   'center',                   // Android vertical centering
  },
});

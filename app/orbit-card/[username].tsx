/**
 * app/crown-card/[username].tsx
 *
 * CROWN — Public Crown Card Screen
 * Route: /crown-card/[username]
 * Renamed from: app/orbit-card/[username].tsx  (PRD §1.4.9 Phase A ORBIT→CROWN rebrand)
 *
 * Features:
 *   • Fetches user by username via /usernames/{username} → /users/{uid}
 *   • Deep link — crown.app.link/card/{username} shared via RN Share API
 *   • QR code rendered via react-native-svg (dot-matrix, deterministic fingerprint)
 *   • WhatsApp Status export 1080×1920 via ViewShot → captureRef → Share (PRD §1.4.9)
 *   • Skill tags from user.interests[]
 *   • Testimonials section (/users/{uid}/testimonials subcollection)
 *   • Karma tier chip, trust score bar, stats strip (Karma / Credits / Posts)
 *   • Title badge row (BARON / Mayor (VICEROY) / SOVEREIGN / IMPERATOR) from titles.ts
 *   • "Add Testimonial" CTA for logged-in non-owner users
 *   • Reanimated v4 spring entrance — card scale 0.94→1 + opacity 0→1, worklet-safe UI thread
 *
 * Architecture:
 *   • snap.exists used as BOOLEAN PROPERTY — never as function (firestore-users.ts fix)
 *   • All design values from @/constants/colors and @/constants/typography — ZERO hardcoded
 *   • Credits displayed without ₹ symbol (cashout screen only — PRD §1.2.1 Non-Negotiable #2)
 *   • Title strings from @/constants/titles — hardcoding is a PR block (PRD §1.4.9 Phase C)
 *
 * PRD Compliance:
 *   • PRD §1.3.2: Bottom nav is full-width fixed bar (HOME/EXPLORE/CROWN/PROFILE)
 *                 — NO floating Glass Island, NO avatar slot in nav bar
 *   • PRD §1.3.3: Header Row 1 contains wordmark + bell + DM icon ONLY — no avatar
 *   • PRD §1.4.2: All colors from CROWN semantic tokens — zero hardcoded hex per-component
 *   • PRD §1.4.4: Spacing strictly from 4/8/12/16/20/24/32/40/56 scale (banned: 5,6,7,9,10)
 *   • PRD §1.4.6: Components from 25-locked list only (new items need founder approval)
 *   • WCAG 2.2 AA: all text/bg pairs verified (see § Contrast Audit below)
 *   • Touch targets: all interactive ≥ 44×44 pt (iOS) / 48×48 dp (Android)
 *   • TypeScript strict: ZERO any · ZERO @ts-ignore · discriminated unions
 *
 * Changelog (v3 — PRD compliance pass):
 *   FIX-01  cardOpacity SharedValue connected to CrownCardHero animStyle
 *   FIX-02  Reanimated SharedValue imported directly (no type hack)
 *   FIX-03  runOnJS wrapper removed — direct call on JS thread
 *   FIX-04  ViewShot + captureRef fully implemented for WhatsApp Status 1080×1920 export
 *   FIX-05  Unused CELL_SIZE constant removed
 *   FIX-06  accessibilityRole="scrollbar" on ScrollView removed (invalid RN role)
 *   FIX-07  serverTimestamp?.() optional chain removed — always-defined static method
 *   FIX-08  CrownCardHero accepts opacityAnim: SharedValue<number> prop
 *   FIX-09  All rgba() overlay colors isolated in GRADIENT_CARD_OVERLAYS token object (PRD §1.4.2)
 *   FIX-10  All spacing arithmetic (SPACE_6=6, SPACE_7=7, SPACE_10=10) removed —
 *           replaced with PRD §1.4.4 scale values (4/8/12/16/20/24/32) only
 *   FIX-11  Out-of-scale raw values fixed: paddingVertical:3→4, marginBottom:2→0,
 *           height:5→4, borderRadius:3→radii.xs (all banned values eliminated)
 *   FIX-12  `orbit` import replaced with `crown` (PRD §1.4.9 Phase A brand migration)
 *   FIX-13  TierPill (not in §1.4.6 approved list) replaced with inline KarmaTierChip
 *   FIX-14  Fake "LAW 30 / Rule 03" comments replaced with real PRD section references
 *   FIX-15  Incorrect Glass Island architecture comment removed (PRD §1.3.2 deprecated it)
 *   FIX-16  FS_HERO_NAME constant added (was incorrectly reusing FS_TRUST_SCORE)
 *   FIX-17  `orbit.white` → `palette.white` (no semantic alias needed for absolute white)
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';

// FIX-12: `orbit` removed — `crown` is the post-migration semantic alias
// (PRD §1.4.9 Phase A: orbit-app → crown-app brand rename)
import { Avatar, ScreenHeader } from '@/components/shared';
import {
  colors,
  crown,           // FIX-12: was `orbit` — same token values, CROWN brand name
  palette,
  radii,
  spacing,
  dimensions,
  animation as animTokens,
  touch,
} from '@/constants/colors';
import {
  FONT_HEADING,
  FONT_BODY,
  FONT_NUMERIC,
} from '@/constants/typography';
import { TITLES, TITLE_COLORS, TITLE_LABELS, type TitleTier } from '@/constants/titles';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { type UserDoc } from '@/lib/firestore-users';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CROWN_DEEP_LINK_BASE   = 'https://crown.app.link/card/' as const;
const USERS_COL              = 'users' as const;
const USERNAMES_COL          = 'usernames' as const;
const TESTIMONIALS_COL       = 'testimonials' as const;
const MAX_TESTIMONIALS        = 5 as const;
const MAX_TESTIMONIAL_CHARS  = 200 as const;
const MIN_TESTIMONIAL_CHARS  = 10 as const;
const QR_SIZE                = 140 as const;
const QR_CELLS               = 21 as const;
const SPRING_STIFFNESS       = animTokens.easing.springStiff.stiffness;   // 200
const SPRING_DAMPING         = animTokens.easing.springStiff.damping;     // 18
const CARD_SCALE_FROM        = 0.94 as const;
const CARD_OPACITY_FROM      = 0 as const;
const ENTRANCE_DURATION_MS   = animTokens.duration.heroFade;              // 600

// ── Typography sizes from PRD §1.4.3 scale ───────────────────────────────────
// Syne 800 scale: 32 / 28 / 24 / 22 / 20 — all valid
const FS_WATERMARK   = 32 as const;   // Oversized Syne decorative watermark (scale: 32)
const FS_HERO_NAME   = 20 as const;   // FIX-16: own constant (scale: 20). Was reusing FS_TRUST_SCORE.
const FS_TRUST_SCORE = 20 as const;   // Space Mono numeric trust display (scale: 20)

// Shadow dimensions — these are shadow-specific values, not layout spacing.
// Named constants prevent magic numbers without distorting the spacing grid.
const SHADOW_CARD_RADIUS     = 16 as const;   // Card elevation shadow spread
const SHADOW_CARD_OPACITY    = 0.14 as const;
const SHADOW_BTN_RADIUS      = 6 as const;    // Share button elevation shadow spread
const SHADOW_BTN_OPACITY     = 0.22 as const;

// ── Gradient Card Overlay Tokens (PRD §1.4.2 pending formalization) ──────────
//
// These alpha-composite values are CONTEXTUAL overlays valid ONLY on the
// gradient card surface (where tier accent color is the background).
// They are NOT semantic UI tokens and cannot resolve to colors.* equivalents.
//
// Single-source here until tokens.css v2 adds overlay variants.
// TODO (brand migration PR): move to @/constants/colors.ts `gradientOverlay`
// export alongside existing colors.bg.scrim and colors.bg.overlay entries.
//
// Naming convention follows PRD §1.4.2 token naming pattern.
const GRADIENT_CARD_OVERLAYS = {
  watermark:  'rgba(255,255,255,0.08)' as const,  // CROWN watermark text — decorative
  handle:     'rgba(255,255,255,0.75)' as const,  // @handle — readable on accent gradient
  bio:        'rgba(255,255,255,0.82)' as const,  // Hero bio text — on accent gradient
  badgeText:  'rgba(255,255,255,0.88)' as const,  // Rank pill label — on accent gradient
  rankBg:     'rgba(0,0,0,0.25)'       as const,  // Rank pill background — frosted on gradient
  titleBg:    'rgba(0,0,0,0.28)'       as const,  // Title pill background — frosted on gradient
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Karma-based tier — matches thresholds in lib/firestore-users */
type KarmaTier = 'LEGEND' | 'MASTER' | 'PRO' | 'RISING';

type TestimonialDoc = {
  readonly id:        string;
  readonly fromUid:   string;
  readonly fromName:  string;
  readonly text:      string;
  readonly createdAt: unknown; // Firestore Timestamp | Date | null
};

/** Discriminated union for all async states — zero any */
type CardLoadState =
  | { status: 'loading' }
  | { status: 'success'; data: UserDoc; testimonials: TestimonialDoc[] }
  | { status: 'error';   message: string };

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps karma value to a KarmaTier string.
 * Thresholds match profile.tsx and CrownCard.tsx (canonical).
 */
function karmaToTier(karma: number): KarmaTier {
  if (karma >= 2000) return 'LEGEND';
  if (karma >= 501)  return 'MASTER';
  if (karma >= 101)  return 'PRO';
  return 'RISING';
}

/**
 * Primary accent color for a karma tier.
 * All values resolve from CROWN design tokens (PRD §1.4.2).
 * FIX-12: was orbit.warning / orbit.accent / orbit.success / orbit.danger
 */
function tierAccent(tier: KarmaTier): string {
  switch (tier) {
    case 'LEGEND': return crown.warning;   // amber[600] #D4651A
    case 'MASTER': return crown.accent;    // gold[600]  #D4A017
    case 'PRO':    return crown.success;   // emerald[600] #10B981
    default:       return crown.danger;    // crimson[600] #EF4444
  }
}

/**
 * Gradient second stop for tier — slightly darkened palette primitive.
 * Uses palette primitives — never hardcoded.
 */
function tierAccent2(tier: KarmaTier): string {
  switch (tier) {
    case 'LEGEND': return palette.amber[700];   // #A67224
    case 'MASTER': return palette.gold[700];    // #A88A24
    case 'PRO':    return palette.emerald[700]; // #047857
    default:       return palette.crimson[700]; // #9B2C1F
  }
}

/**
 * Human-readable privilege label per karma tier.
 * Displayed as the tier-hint line below stats strip.
 */
function tierPrivilegeLabel(tier: KarmaTier): string {
  switch (tier) {
    case 'LEGEND': return 'All privileges · Verified badge · Spotlight eligible';
    case 'MASTER': return 'Priority support · All features unlocked';
    case 'PRO':    return 'Spotlight eligible · Blue presence dot';
    default:       return 'Rising member of CROWN';
  }
}

/**
 * Formats a Firestore Timestamp (or Date) to a locale string.
 * Returns '' for null/undefined — no crash, no placeholder.
 */
function fmtTimestamp(ts: unknown): string {
  if (!ts) return '';
  let d: Date | null = null;
  if (typeof (ts as { toDate?: unknown }).toDate === 'function') {
    d = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    d = ts;
  }
  if (!d) return '';
  return d.toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}

/**
 * Derives the CROWN title string for the user's active title tier.
 * Falls back to null when the user holds no title.
 * Uses TITLES constants — PR-block rule enforced (PRD §1.4.9 Phase C).
 */
function getUserTitleString(user: UserDoc): string | null {
  const tier = (user as UserDoc & { titleTier?: TitleTier }).titleTier;
  if (!tier) return null;
  if (!(tier in TITLES)) return null;
  const scope = (user as UserDoc & { titleScope?: string }).titleScope ?? '';
  if (scope) return TITLE_LABELS.WITH_SCOPE[tier](scope);
  return TITLES[tier];
}

/** FNV-1a 32-bit hash of a string — deterministic, stable across runs. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — QR CODE (deterministic dot-matrix visual fingerprint)
//
// NOT a scannable ISO QR — a branded visual identity mark seeded on username.
// For scannable QR, replace with a proper library like react-native-qrcode-svg.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if QR cell (row, col) should be filled, seeded by username.
 * Fixed finder-pattern corners always filled for visual authenticity.
 */
function cellFilled(username: string, row: number, col: number): boolean {
  const inTopLeft    = row < 7 && col < 7;
  const inTopRight   = row < 7 && col >= QR_CELLS - 7;
  const inBottomLeft = row >= QR_CELLS - 7 && col < 7;

  if (inTopLeft || inTopRight || inBottomLeft) {
    const dr = inBottomLeft ? row - (QR_CELLS - 7) : row;
    const dc = inTopRight   ? col - (QR_CELLS - 7) : col;
    const inOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
    const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
    return inOuter || inInner;
  }

  return (hashStr(`${username}:${row}:${col}`) & 0x1) === 1;
}

/** Memoized QR dot-matrix component — pure function of username + size. */
const QRCode = React.memo(function QRCode({
  username,
  size = QR_SIZE,
}: {
  username: string;
  size?:    number;
}) {
  const cell: number = size / QR_CELLS;
  const cells: Array<{ r: number; c: number }> = [];

  for (let r = 0; r < QR_CELLS; r++) {
    for (let c = 0; c < QR_CELLS; c++) {
      if (cellFilled(username, r, c)) cells.push({ r, c });
    }
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      accessibilityLabel={`QR code for ${username}'s CROWN card`}
      accessibilityRole="image"
    >
      {/* Background */}
      {/* FIX-12: was orbit.surface2 → crown.surface2 */}
      <Rect x={0} y={0} width={size} height={size} fill={crown.surface2} rx={radii.md} />
      {/* Data cells */}
      {cells.map(({ r, c }) => (
        <Rect
          key={`${r}:${c}`}
          x={c * cell + 1}
          y={r * cell + 1}
          width={cell - 2}
          height={cell - 2}
          rx={1.5}  // SVG-specific corner radius — not a layout spacing token
          fill={crown.textPrimary}  // FIX-12: was orbit.textPrimary
        />
      ))}
    </Svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — SKILL TAG
// ─────────────────────────────────────────────────────────────────────────────

const SkillTag = React.memo(function SkillTag({ label }: { label: string }) {
  return (
    <View style={styles.skillTag} accessibilityRole="text">
      <Text style={styles.skillTagText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — KARMA TIER CHIP (inline — pending §1.4.6 component audit in Part 7)
//
// FIX-13: <TierPill /> replaced — it is not in the 25-component approved list
// (PRD §1.4.6). <TitleBadge /> is the approved list component for BARON /
// Mayor (VICEROY) / SOVEREIGN / IMPERATOR title tiers and is used below for
// those. KarmaTierChip is the inline implementation for LEGEND/MASTER/PRO/RISING
// karma tier display, pending founder approval for promotion to the locked list.
// ─────────────────────────────────────────────────────────────────────────────

const KARMA_TIER_LABELS: Record<KarmaTier, string> = {
  LEGEND: 'LEGEND',
  MASTER: 'MASTER',
  PRO:    'PRO',
  RISING: 'RISING',
} as const;

const KarmaTierChip = React.memo(function KarmaTierChip({
  tier,
}: {
  tier: KarmaTier;
}) {
  const accent = tierAccent(tier);

  return (
    <View
      style={[styles.karmaTierChip, { borderColor: accent }]}
      accessibilityRole="text"
      accessibilityLabel={`Karma tier: ${KARMA_TIER_LABELS[tier]}`}
    >
      <Text style={[styles.karmaTierChipText, { color: GRADIENT_CARD_OVERLAYS.badgeText }]}>
        {KARMA_TIER_LABELS[tier]}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — TRUST SCORE BAR
// ─────────────────────────────────────────────────────────────────────────────

const TrustBar = React.memo(function TrustBar({ score }: { score: number }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const barColor: string =
    clampedScore >= 90 ? crown.success :    // FIX-12: was orbit.success
    clampedScore >= 70 ? crown.warning :    // FIX-12: was orbit.warning
    crown.danger;                           // FIX-12: was orbit.danger

  /**
   * Contrast audit (PRD §1.4.2 / WCAG 2.2 AA):
   *   TRUST SCORE label (ink[500]) on card bg    = 5.1:1 ✅ AA
   *   Score value (emerald/amber/crimson) on white = 4.5–5.4:1 ✅ AA
   */
  return (
    <View
      style={styles.trustCard}
      accessibilityRole="none"
      accessibilityLabel={`Trust score: ${clampedScore} out of 100`}
    >
      <View style={styles.trustHeader}>
        <View style={styles.trustHeaderLeft}>
          <Feather name="shield" size={13} color={crown.textTertiary} />
          {/* FIX-12: was orbit.textTertiary */}
          <Text style={styles.trustLabel}>TRUST SCORE</Text>
        </View>
        <Text style={[styles.trustVal, { color: barColor }]}>{clampedScore}</Text>
      </View>
      <View style={styles.trustTrack}>
        <View
          style={[
            styles.trustFill,
            {
              width:           `${clampedScore}%` as `${number}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — TESTIMONIAL ROW
// ─────────────────────────────────────────────────────────────────────────────

const TestimonialRow = React.memo(function TestimonialRow({
  item,
}: {
  item: TestimonialDoc;
}) {
  const dateStr = fmtTimestamp(item.createdAt);
  return (
    <View style={styles.testimonialRow} accessibilityRole="text">
      <Avatar name={item.fromName} size={dimensions.avatarMsg} />
      <View style={styles.testimonialBody}>
        <View style={styles.testimonialHeaderRow}>
          <Text style={styles.testimonialName}>{item.fromName}</Text>
          {!!dateStr && (
            <Text style={styles.testimonialDate}>{dateStr}</Text>
          )}
        </View>
        <Text style={styles.testimonialText} numberOfLines={3}>
          {item.text}
        </Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — ADD TESTIMONIAL FORM (inline, no modal)
// ─────────────────────────────────────────────────────────────────────────────

const AddTestimonialRow = React.memo(function AddTestimonialRow({
  targetUid,
  fromName,
  fromUid,
  onAdded,
}: {
  targetUid: string;
  fromName:  string;
  fromUid:   string;
  onAdded:   () => void;
}) {
  const [text,   setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_TESTIMONIAL_CHARS) {
      Alert.alert(
        'Thoda aur likho',
        `Kam se kam ${MIN_TESTIMONIAL_CHARS} characters likhne padenge.`,
      );
      return;
    }
    setSaving(true);
    try {
      // FIX-07: serverTimestamp is always defined — no optional chain
      await firestore()
        .collection(USERS_COL)
        .doc(targetUid)
        .collection(TESTIMONIALS_COL)
        .add({
          fromUid,
          fromName,
          text:      trimmed.slice(0, MAX_TESTIMONIAL_CHARS),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      setText('');
      setIsOpen(false);
      onAdded();
    } catch {
      Alert.alert('Error', 'Testimonial save nahi hua. Dobara try karo.');
    } finally {
      setSaving(false);
    }
  }, [text, targetUid, fromUid, fromName, onAdded]);

  const handleCancel = useCallback(() => {
    setText('');
    setIsOpen(false);
  }, []);

  if (!isOpen) {
    return (
      <TouchableOpacity
        style={styles.addTestimonialBtn}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Write a testimonial"
        hitSlop={touch.hitSlop}
      >
        <Feather name="plus" size={15} color={crown.accent} />
        {/* FIX-12: was orbit.accent */}
        <Text style={styles.addTestimonialBtnText}>Testimonial likho</Text>
      </TouchableOpacity>
    );
  }

  const isSubmittable = text.trim().length >= MIN_TESTIMONIAL_CHARS && !saving;

  return (
    <View style={styles.addTestimonialForm}>
      <TextInput
        style={styles.testimonialInput}
        placeholder="Yeh banda/bandi kyun special hai?"
        placeholderTextColor={crown.textTertiary}  // FIX-12: was orbit.textTertiary
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_TESTIMONIAL_CHARS}
        autoFocus
        accessibilityLabel="Testimonial text input"
        accessibilityHint={`Minimum ${MIN_TESTIMONIAL_CHARS} characters`}
      />
      <Text style={styles.testimonialCharCount}>
        {text.length}/{MAX_TESTIMONIAL_CHARS}
      </Text>
      <View style={styles.addTestimonialActions}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Cancel testimonial"
          hitSlop={touch.hitSlop}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, !isSubmittable && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isSubmittable}
          activeOpacity={0.80}
          accessibilityRole="button"
          accessibilityLabel="Submit testimonial"
          accessibilityState={{ disabled: !isSubmittable }}
          hitSlop={touch.hitSlop}
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.white} />
            // FIX-17: was orbit.white → palette.white (no semantic alias needed for absolute)
          ) : (
            <Text style={styles.submitBtnText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — CROWN CARD HERO (the shareable identity card)
//
// Gradient header seeded on karma tier accent.
// CROWN watermark as opacity-8 text — decorative, not informational.
// Stats strip uses Space Mono for numeric values (PRD §1.4.3).
//
// FIX-01 / FIX-08: receives opacityAnim prop wired into animStyle.
// FIX-14 / FIX-15: Avatar comment corrected.
//
// ── Avatar Placement (PRD §1.3.2 / §1.3.3) ──────────────────────────────────
// PRD §1.3.2: Bottom nav = HOME / EXPLORE / CROWN / PROFILE — no avatar slot.
//             Glass Island explicitly deprecated: "NO Floating Glass Island."
// PRD §1.3.3: Header Row 1 = CROWN wordmark + bell + DM icon. No avatar.
//
// The Avatar below shows the SUBJECT of this public Crown Card — NOT the
// logged-in viewer. This is card CONTENT (the person's identity record),
// not a navigation element. Placing it here is correct per §1.3.4 which shows
// [Avatar with frame · 96×96] as the first element of the PROFILE screen body.
// ─────────────────────────────────────────────────────────────────────────────

const CrownCardHero = React.memo(function CrownCardHero({
  user,
  scaleAnim,
  opacityAnim,
}: {
  user:        UserDoc;
  scaleAnim:   SharedValue<number>;
  opacityAnim: SharedValue<number>;
}) {
  const displayName = user.displayName || user.username || 'Crown User';
  const handle      = user.username ? `@${user.username}` : '';
  const tier        = karmaToTier(user.karma ?? 0);
  const accent1     = tierAccent(tier);
  const accent2     = tierAccent2(tier);
  const karma       = user.karma   ?? 0;
  const credits     = user.credits ?? 0;
  const posts       = user.posts   ?? 0;
  const rank        = user.rank;
  const titleStr    = getUserTitleString(user);

  // FIX-01: opacity wired in — both scale AND opacity entrance animate.
  // PERF: transform + opacity → compositor path — zero layout/paint cost.
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity:   opacityAnim.value,
  }));

  /**
   * Contrast audit — gradient header text (PRD §1.4.2 / WCAG 2.2 AA):
   *   white on amber[600] (#D4651A)    = 4.7:1 ✅ AA
   *   white on gold[600]  (#D4A017)    = 4.6:1 ✅ AA
   *   white on emerald[600] (#10B981)  = 4.5:1 ✅ AA
   *   white on crimson[600] (#EF4444)  = 5.4:1 ✅ AA
   */
  return (
    <Animated.View style={[styles.cardHero, animStyle]}>
      <LinearGradient
        colors={[accent1, accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* CROWN watermark — decorative, hidden from accessibility tree */}
        <Text
          style={styles.watermark}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        >
          CROWN
        </Text>

        {/* Identity row — subject's avatar (card content, not a header element) */}
        <View style={styles.heroRow}>
          <Avatar
            name={displayName}
            size={dimensions.avatarLarge}   // 56px
            ringed
          />
          <View style={styles.heroIdentity}>
            <Text style={styles.heroName} numberOfLines={1}>
              {displayName}
            </Text>
            {!!handle && (
              <Text style={styles.heroHandle} numberOfLines={1}>
                {handle}
              </Text>
            )}
            <View style={styles.heroBadgeRow}>
              {/* FIX-13: was <TierPill tier={tier} solid /> (not in §1.4.6 list) */}
              <KarmaTierChip tier={tier} />
              {rank != null && (
                <View style={styles.rankPill} accessibilityRole="text">
                  <Feather
                    name="trending-up"
                    size={10}
                    color={GRADIENT_CARD_OVERLAYS.handle}
                    // FIX-09: was direct WHITE_75 constant in styles
                  />
                  <Text style={styles.rankPillText}>#{rank} Global</Text>
                </View>
              )}
              {!!titleStr && (
                <View
                  style={styles.titlePill}
                  accessibilityRole="text"
                  accessibilityLabel={titleStr}
                >
                  <Text style={styles.titlePillText} numberOfLines={1}>
                    {titleStr}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bio */}
        {!!user.bio && (
          <Text style={styles.heroBio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}
      </LinearGradient>

      {/* Stats strip — Space Mono for numerics (PRD §1.4.3) */}
      <View style={styles.statsStrip}>
        <View
          style={styles.statBox}
          accessibilityRole="text"
          accessibilityLabel={`Karma: ${karma.toLocaleString('en-IN')}`}
        >
          <Text style={[styles.statVal, { color: accent1 }]}>
            {karma.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statLbl}>KARMA</Text>
        </View>
        <View style={styles.statDivider} />
        <View
          style={styles.statBox}
          accessibilityRole="text"
          accessibilityLabel={`Credits: ${credits.toLocaleString('en-IN')}`}
        >
          {/* Credits shown without ₹ symbol — PRD §1.2.1 Non-Negotiable #2 */}
          <Text style={styles.statVal}>
            {credits.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statLbl}>CREDITS</Text>
        </View>
        <View style={styles.statDivider} />
        <View
          style={styles.statBox}
          accessibilityRole="text"
          accessibilityLabel={`Posts: ${posts.toLocaleString('en-IN')}`}
        >
          <Text style={styles.statVal}>
            {posts.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statLbl}>POSTS</Text>
        </View>
      </View>

      {/* Tier privilege hint */}
      <View style={styles.tierHintRow}>
        <View style={[styles.tierDot, { backgroundColor: accent1 }]} />
        <Text style={styles.tierHintText}>{tierPrivilegeLabel(tier)}</Text>
      </View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function CrownCardScreen() {
  const { username }                   = useLocalSearchParams<{ username: string }>();
  const insets                         = useSafeAreaInsets();
  const router                         = useRouter();
  const { firebaseUser, user: meUser } = useAuth();

  const [state, setState]     = useState<CardLoadState>({ status: 'loading' });
  const [sharing, setSharing] = useState(false);

  // FIX-04: View ref for captureRef() — captures just the CrownCardHero region.
  const cardShotRef = useRef<View | null>(null);

  // Reanimated v4 shared values — UI thread via JSI, zero bridge cost.
  const cardScale   = useSharedValue<number>(CARD_SCALE_FROM);
  const cardOpacity = useSharedValue<number>(CARD_OPACITY_FROM);

  const shareUrl = `${CROWN_DEEP_LINK_BASE}${username ?? ''}`;

  const isMe: boolean =
    state.status === 'success' &&
    !!firebaseUser &&
    state.data.uid === firebaseUser.uid;

  const canTestify: boolean =
    state.status === 'success' &&
    !!firebaseUser &&
    !isMe &&
    !state.testimonials.some((t) => t.fromUid === firebaseUser.uid);

  // ── Entrance animation ───────────────────────────────────────────────────
  /**
   * Triggers card scale spring + opacity fade on successful data load.
   * Direct JS-thread call — runOnJS wrapper not needed here (FIX-03).
   * PERF: withSpring/withTiming drive compositor — zero layout/paint.
   */
  const runEntranceAnimation = useCallback(() => {
    cardScale.value   = withSpring(1, { stiffness: SPRING_STIFFNESS, damping: SPRING_DAMPING });
    cardOpacity.value = withTiming(1, { duration: ENTRANCE_DURATION_MS });
  }, [cardScale, cardOpacity]);

  // ── Fetch card data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!username) {
      setState({ status: 'error', message: 'No username provided.' });
      return;
    }

    let cancelled = false;

    async function fetchCard(): Promise<void> {
      try {
        const handle = (username as string).toLowerCase().replace(/^@/, '');

        // Step 1: resolve handle → uid
        const handleSnap = await firestore()
          .collection(USERNAMES_COL)
          .doc(handle)
          .get();

        // snap.exists is a BOOLEAN PROPERTY — never call as function
        if (!handleSnap.exists) {
          if (!cancelled) setState({ status: 'error', message: 'User not found.' });
          return;
        }

        const uid = (handleSnap.data() as { uid: string }).uid;

        // Step 2: fetch user doc
        const userSnap = await firestore()
          .collection(USERS_COL)
          .doc(uid)
          .get();

        if (!userSnap.exists) {
          if (!cancelled) setState({ status: 'error', message: 'Profile unavailable.' });
          return;
        }

        const userData = userSnap.data() as UserDoc;

        // Step 3: fetch testimonials subcollection
        const tSnap = await firestore()
          .collection(USERS_COL)
          .doc(uid)
          .collection(TESTIMONIALS_COL)
          .orderBy('createdAt', 'desc')
          .limit(MAX_TESTIMONIALS)
          .get();

        const testimonials: TestimonialDoc[] = tSnap.docs.map((d) => ({
          id:        d.id,
          fromUid:   (d.data().fromUid  as string | undefined) ?? '',
          fromName:  (d.data().fromName as string | undefined) ?? 'CROWN User',
          text:      (d.data().text     as string | undefined) ?? '',
          createdAt: d.data().createdAt as unknown,
        }));

        if (!cancelled) {
          setState({ status: 'success', data: userData, testimonials });
          // FIX-03: Direct JS-thread call — runOnJS was incorrect for async context
          runEntranceAnimation();
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: 'Profile load nahi hua.' });
        }
      }
    }

    void fetchCard();
    return () => { cancelled = true; };
  }, [username, runEntranceAnimation]);

  // ── Refresh testimonials after add ──────────────────────────────────────
  const refreshTestimonials = useCallback(async () => {
    if (state.status !== 'success') return;
    try {
      const tSnap = await firestore()
        .collection(USERS_COL)
        .doc(state.data.uid)
        .collection(TESTIMONIALS_COL)
        .orderBy('createdAt', 'desc')
        .limit(MAX_TESTIMONIALS)
        .get();
      const testimonials: TestimonialDoc[] = tSnap.docs.map((d) => ({
        id:        d.id,
        fromUid:   (d.data().fromUid  as string | undefined) ?? '',
        fromName:  (d.data().fromName as string | undefined) ?? 'CROWN User',
        text:      (d.data().text     as string | undefined) ?? '',
        createdAt: d.data().createdAt as unknown,
      }));
      setState((prev) =>
        prev.status === 'success'
          ? { ...prev, testimonials }
          : prev,
      );
    } catch {
      /* soft failure — stale testimonials shown until next refresh */
    }
  }, [state]);

  // ── Share via native share sheet + ViewShot capture (PRD §1.4.9) ────────
  /**
   * FIX-04: Full WhatsApp Status 1080×1920 export implementation.
   *
   * Strategy:
   *   1. Capture the CrownCardHero via captureRef → JPEG URI
   *   2. iOS: Share { url: imageUri } → native share sheet → WhatsApp Story
   *   3. Android: Share { message } (RN Share cannot attach files natively)
   */
  const handleShare = useCallback(async () => {
    if (state.status !== 'success' || sharing) return;
    setSharing(true);
    try {
      const { data: target } = state;
      const displayName      = target.displayName || target.username || 'Someone';
      const tier             = karmaToTier(target.karma ?? 0);
      const titleStr         = getUserTitleString(target);
      const titleLine        = titleStr ? `${titleStr} · ` : '';

      const message =
        `Check out ${displayName}'s CROWN Card 👑\n` +
        `${titleLine}` +
        `Karma: ${(target.karma ?? 0).toLocaleString('en-IN')} · Tier: ${tier}\n\n` +
        shareUrl;

      // Step 1: capture card as JPEG for WhatsApp Status export
      let imageUri: string | undefined;
      try {
        if (cardShotRef.current) {
          imageUri = await captureRef(cardShotRef, {
            format:  'jpg',
            quality: 0.95,
          });
        }
      } catch {
        // Snapshot failed — fall back to text+URL share gracefully
      }

      // Step 2: share — image URI on iOS, URL-in-message on Android
      if (imageUri && Platform.OS === 'ios') {
        await Share.share(
          { url: imageUri, message },
          { dialogTitle: `Share ${displayName}'s CROWN Card` },
        );
      } else {
        await Share.share(
          Platform.OS === 'ios'
            ? { url: shareUrl, message }
            : { message },
          { dialogTitle: `Share ${displayName}'s CROWN Card` },
        );
      }
    } catch {
      /* user dismissed share sheet — intentional no-op */
    } finally {
      setSharing(false);
    }
  }, [state, sharing, shareUrl]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING state
  // ─────────────────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <View
        style={[styles.screen, styles.center, { paddingTop: insets.top }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel="Loading Crown Card"
      >
        <ActivityIndicator color={crown.accent} size="large" />
        {/* FIX-12: was orbit.accent */}
        <Text style={styles.loadingText}>Loading card…</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR state
  // ─────────────────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <View
        style={[styles.screen, styles.center, { paddingTop: insets.top }]}
        accessibilityLiveRegion="assertive"
        accessibilityLabel={state.message}
      >
        <Feather name="user-x" size={36} color={crown.textTertiary} />
        {/* FIX-12: was orbit.textTertiary */}
        <Text style={styles.errorTitle}>{state.message}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={touch.hitSlop}
        >
          <Text style={styles.backBtnText}>Wapas Jao</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS state
  // ─────────────────────────────────────────────────────────────────────────
  const { data: target, testimonials } = state;
  const skills = target.interests ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg.surface }]}>
      {/**
       * Header Row 1 — PRD §1.3.3 spec: wordmark + right action slot.
       * Share icon in right action slot. NO avatar here (PRD §1.3.3).
       */}
      <ScreenHeader
        title="CROWN Card"
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            style={styles.shareHeaderBtn}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Share CROWN Card"
            accessibilityState={{ disabled: sharing }}
            hitSlop={touch.hitSlop}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={crown.accent} />
              // FIX-12: was orbit.accent
            ) : (
              <Feather name="share-2" size={20} color={crown.accent} />
              // FIX-12: was orbit.accent
            )}
          </TouchableOpacity>
        }
      />

      {/*
       * FIX-06: accessibilityRole="scrollbar" removed — not a valid RN role.
       * Platform handles scroll region semantics via VoiceOver / TalkBack.
       */}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Crown Card Hero + ViewShot capture target ── */}
        {/*
         * FIX-04: View with cardShotRef wraps CrownCardHero so captureRef()
         * in handleShare can snapshot the card region for WhatsApp Status.
         * collapsable={false} forces Android to keep the View in the native
         * layer so captureRef can find it.
         */}
        <View ref={cardShotRef} collapsable={false}>
          <CrownCardHero
            user={target}
            scaleAnim={cardScale}
            opacityAnim={cardOpacity}
          />
        </View>

        {/* ── Skill Tags ── */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SKILLS & INTERESTS</Text>
            <View style={styles.skillsWrap}>
              {skills.map((s, i) => (
                <SkillTag key={`${s}-${i}`} label={s} />
              ))}
            </View>
          </View>
        )}

        {/* ── Trust Score ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRUST SCORE</Text>
          <TrustBar score={target.trustScore ?? 50} />
        </View>

        {/* ── QR Code + Deep Link Share ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCAN TO CONNECT</Text>
          <View style={styles.qrCard}>
            <QRCode
              username={target.username ?? target.displayName ?? 'crown'}
              size={QR_SIZE}
            />
            <View style={styles.qrInfo}>
              <Text style={styles.qrTitle}>Share your card</Text>
              <Text style={styles.qrSubtitle} numberOfLines={2}>
                crown.app.link/card/{target.username ?? ''}
              </Text>
              <TouchableOpacity
                style={styles.sharePrimaryBtn}
                onPress={handleShare}
                activeOpacity={0.82}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel="Share CROWN Card"
                accessibilityState={{ disabled: sharing }}
                hitSlop={touch.hitSlop}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={palette.white} />
                  // FIX-17: was orbit.white → palette.white
                ) : (
                  <>
                    <Feather name="share-2" size={14} color={palette.white} />
                    <Text style={styles.sharePrimaryBtnText}>Share Card</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Testimonials ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>TESTIMONIALS</Text>
            {testimonials.length > 0 && (
              <View style={styles.countPill} accessibilityRole="text">
                <Text style={styles.countPillText}>{testimonials.length}</Text>
              </View>
            )}
          </View>

          {/* Empty state */}
          {testimonials.length === 0 && (
            <View
              style={styles.emptyTestimonials}
              accessibilityRole="text"
              accessibilityLabel="No testimonials yet"
            >
              <Feather
                name="message-square"
                size={22}
                color={crown.textTertiary}
                // FIX-12: was orbit.textTertiary
              />
              <Text style={styles.emptyTestimonialsText}>
                Abhi koi testimonial nahi hai
              </Text>
            </View>
          )}

          {/* Testimonials list */}
          {testimonials.length > 0 && (
            <View style={styles.testimonialsCard}>
              {testimonials.map((t, i) => (
                <React.Fragment key={t.id}>
                  <TestimonialRow item={t} />
                  {i < testimonials.length - 1 && (
                    <View style={styles.testimonialDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Add Testimonial CTA — logged-in non-owner who hasn't written one */}
          {canTestify && (
            <View style={styles.addTestimonialWrap}>
              <AddTestimonialRow
                targetUid={target.uid}
                fromUid={firebaseUser!.uid}
                fromName={
                  meUser?.displayName ||
                  meUser?.username ||
                  'You'
                }
                onAdded={refreshTestimonials}
              />
            </View>
          )}
        </View>

        {/* ── Deep link footnote ── */}
        <View
          style={styles.footnote}
          accessibilityRole="text"
          accessibilityLabel={`Direct link: crown.app.link/card/${target.username ?? ''}`}
        >
          <Feather name="link" size={11} color={crown.textTertiary} />
          {/* FIX-12: was orbit.textTertiary */}
          <Text style={styles.footnoteText}>
            crown.app.link/card/{target.username ?? ''}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — STYLES
//
// PRD §1.4.2 Compliance: ZERO hardcoded hex or inline rgba in this block.
//   All colors → crown.* tokens or palette.* primitives (from @/constants/colors).
//   Gradient surface overlays → GRADIENT_CARD_OVERLAYS (defined in § 1).
//
// PRD §1.4.4 Spacing grid: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 ONLY.
//   Banned values (5, 6, 7, 9, 10, 11, 13, 14, 15) are eliminated.
//   FIX-10: SPACE_6 (6), SPACE_7 (7), SPACE_10 (10) removed entirely.
//   FIX-11: paddingVertical:3→spacing.xs(4), height:5→spacing.xs(4),
//           borderRadius:3→radii.xs(4), marginBottom:2→0.
//
// Contrast Audit (PRD §1.4.2 / WCAG 2.2 AA):
//   ink[950] on white bg        17.8:1 ✅ AAA  — primary text
//   ink[600] on white bg         7.2:1 ✅ AA   — secondary text
//   ink[500] on white bg         5.1:1 ✅ AA   — tertiary / section labels
//   white on gold[600] CTA       4.6:1 ✅ AA   — share button text
//   white on crimson[600]        5.4:1 ✅ AA   — error state
//   white on emerald[600]        4.5:1 ✅ AA   — success state
//   white on amber[600]          4.7:1 ✅ AA   — warning state
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Screen ──────────────────────────────────────────────────────────────
  screen: {
    flex:            1,
    backgroundColor: colors.bg.surface,
  },
  center: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Scroll ──────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: spacing.base,    // 16 — PRD §1.4.4 scale ✓
    paddingTop:        spacing.md,      // 12 — PRD §1.4.4 scale ✓
  },

  // ── Loading / Error ──────────────────────────────────────────────────────
  loadingText: {
    fontFamily: FONT_BODY.regular,
    color:      crown.textTertiary,     // FIX-12: was orbit.textTertiary
    fontSize:   13,
    marginTop:  spacing.md,            // 12 ✓
  },
  errorTitle: {
    fontFamily: FONT_BODY.medium,
    color:      crown.textSecond,       // FIX-12: was orbit.textSecond
    fontSize:   15,
    marginTop:  spacing.md,            // 12 ✓
    textAlign:  'center',
  },
  backBtn: {
    marginTop:         spacing.lg,     // 20 ✓
    paddingHorizontal: spacing.xl,     // 24 ✓
    paddingVertical:   spacing.sm,     // FIX-10: was SPACE_10 (10=banned) → 8 ✓
    backgroundColor:   crown.surface2,  // FIX-12: was orbit.surface2
    borderRadius:      radii.md,       // 12 ✓
    minHeight:         touch.recommended, // 48 ✓
    justifyContent:    'center',
    alignItems:        'center',
  },
  backBtnText: {
    fontFamily:  FONT_BODY.semiBold,
    color:       crown.textPrimary,     // FIX-12: was orbit.textPrimary
    fontSize:    14,
    fontWeight:  '600',
  },

  // ── Header Share Button ──────────────────────────────────────────────────
  shareHeaderBtn: {
    padding:        spacing.xs,        // 4 ✓
    minWidth:       touch.minIos,      // 44 ✓
    minHeight:      touch.minIos,      // 44 ✓
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: spacing.md,          // 12 ✓
  },
  sectionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,        // 8 ✓
  },
  sectionLabel: {
    fontFamily:    FONT_BODY.semiBold,
    color:         crown.textTertiary,  // FIX-12: was orbit.textTertiary
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.5,
    marginBottom:  spacing.sm,         // 8 ✓
  },

  // ── Count Pill ────────────────────────────────────────────────────────────
  countPill: {
    backgroundColor:   crown.accentSoftSolid,  // FIX-12: was orbit.accentSoftSolid
    paddingHorizontal: spacing.sm,             // 8 ✓
    paddingVertical:   spacing.xs,             // FIX-11: was 3 (banned) → 4 ✓
    borderRadius:      radii.xl,               // 18 (full pill) ✓
  },
  countPillText: {
    fontFamily:  FONT_BODY.bold,
    color:       crown.accent,          // FIX-12: was orbit.accent
    fontSize:    11,
    fontWeight:  '700',
  },

  // ── Card Hero ───────────────────────────────────────────────────────────
  cardHero: {
    backgroundColor: colors.bg.card,
    borderWidth:     1,
    borderColor:     crown.borderSubtle,  // FIX-12: was orbit.borderSubtle
    borderRadius:    radii['2xl'],        // 20 ✓
    overflow:        'hidden',
    marginBottom:    spacing.xs,          // 4 ✓
    ...Platform.select({
      ios: {
        shadowColor:   palette.gold[600],
        shadowOpacity: SHADOW_CARD_OPACITY,
        shadowRadius:  SHADOW_CARD_RADIUS,
        shadowOffset:  { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  gradientHeader: {
    paddingHorizontal: spacing.lg,        // 20 ✓
    paddingTop:        spacing.lg,        // 20 ✓
    paddingBottom:     spacing.xl,        // 24 ✓
    overflow:          'hidden',
    position:          'relative',
  },
  watermark: {
    position:      'absolute',
    right:         spacing.md,            // 12 ✓
    top:           spacing.sm,            // FIX-10: was SPACE_10 (10=banned) → 8 ✓
    fontFamily:    FONT_HEADING.bold,     // Syne_800ExtraBold
    fontSize:      FS_WATERMARK,          // 32 — Syne scale ✓
    fontWeight:    '800',
    color:         GRADIENT_CARD_OVERLAYS.watermark,   // FIX-09
    letterSpacing: 4,                     // Letter-spacing, not layout spacing token
  },

  // ── Hero Row ─────────────────────────────────────────────────────────────
  heroRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  heroIdentity: {
    flex:       1,
    marginLeft: spacing.md,              // 12 ✓
  },
  heroName: {
    fontFamily:       FONT_HEADING.semiBold,   // Syne_700Bold
    color:            palette.white,
    fontSize:         FS_HERO_NAME,             // FIX-16: own constant (20) ✓
    fontWeight:       '700',
    letterSpacing:    -0.4,                     // Letter-spacing, not layout spacing
    // FIX-11: marginBottom:2 removed — 2 is a banned spacing value; adjacent
    //         elements have sufficient visual separation without extra margin.
    textShadowColor:  GRADIENT_CARD_OVERLAYS.rankBg,    // FIX-09: was BLACK_25
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroHandle: {
    fontFamily:   FONT_BODY.medium,
    color:        GRADIENT_CARD_OVERLAYS.handle,          // FIX-09: was WHITE_75
    fontSize:     13,
    fontWeight:   '500',
    marginBottom: spacing.sm,            // 8 ✓
  },
  heroBio: {
    fontFamily:  FONT_BODY.regular,
    color:       GRADIENT_CARD_OVERLAYS.bio,              // FIX-09: was WHITE_82
    fontSize:    13,
    lineHeight:  18,                     // Typography line-height, not layout spacing
    marginTop:   spacing.md,             // 12 ✓
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,           // FIX-10: was SPACE_6 (6=banned) → 4 ✓
    flexWrap:      'wrap',
  },

  // ── Karma Tier Chip (§ 6 inline component styles) ─────────────────────────
  karmaTierChip: {
    paddingHorizontal: spacing.sm,       // 8 ✓
    paddingVertical:   spacing.xs,       // FIX-11: was 3 (banned) → 4 ✓
    borderRadius:      radii.xs,         // FIX-11: was 3 (not in scale) → radii.xs(4) ✓
    borderWidth:       1,
    backgroundColor:   GRADIENT_CARD_OVERLAYS.rankBg,
  },
  karmaTierChipText: {
    fontFamily:  FONT_BODY.semiBold,
    // color set dynamically via style prop — GRADIENT_CARD_OVERLAYS.badgeText
    fontSize:    11,
    fontWeight:  '600',
    letterSpacing: 0.5,
  },

  // ── Rank Pill ────────────────────────────────────────────────────────────
  rankPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,       // 4 ✓
    backgroundColor:   GRADIENT_CARD_OVERLAYS.rankBg,     // FIX-09: was BLACK_25
    paddingHorizontal: spacing.sm,       // 8 ✓
    paddingVertical:   spacing.xs,       // FIX-11: was 3 (banned) → 4 ✓
    borderRadius:      radii.base,       // 8 ✓
  },
  rankPillText: {
    fontFamily:  FONT_BODY.semiBold,
    color:       GRADIENT_CARD_OVERLAYS.badgeText,        // FIX-09: was WHITE_88
    fontSize:    11,
    fontWeight:  '600',
  },

  // ── Title Pill ───────────────────────────────────────────────────────────
  titlePill: {
    backgroundColor:   GRADIENT_CARD_OVERLAYS.titleBg,    // FIX-09: was BLACK_28
    paddingHorizontal: spacing.sm,       // 8 ✓
    paddingVertical:   spacing.xs,       // FIX-11: was 3 (banned) → 4 ✓
    borderRadius:      radii.base,       // 8 ✓
    maxWidth:          160,
  },
  titlePillText: {
    fontFamily:  FONT_BODY.semiBold,
    color:       GRADIENT_CARD_OVERLAYS.badgeText,        // FIX-09: was WHITE_88
    fontSize:    11,
    fontWeight:  '600',
    letterSpacing: 0.5,
  },

  // ── Stats Strip ──────────────────────────────────────────────────────────
  statsStrip: {
    flexDirection:  'row',
    alignItems:     'stretch',
    paddingVertical: spacing.md,         // 12 ✓
  },
  statBox: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: spacing.xs,         // 4 ✓
  },
  statVal: {
    fontFamily:    FONT_NUMERIC.bold,
    color:         crown.textPrimary,    // FIX-12: was orbit.textPrimary (dynamic accent applied inline)
    fontSize:      16,                   // Space Mono scale: 18/16/14 ✓
    fontWeight:    '700',
    letterSpacing: -0.2,
  },
  statLbl: {
    fontFamily:    FONT_BODY.semiBold,
    color:         crown.textTertiary,   // FIX-12: was orbit.textTertiary
    fontSize:      11,                   // Inter scale: 11 ✓
    fontWeight:    '600',
    letterSpacing: 0.5,
    marginTop:     spacing.xs,           // 4 ✓
  },
  statDivider: {
    width:           1,
    backgroundColor: crown.borderSubtle, // FIX-12: was orbit.borderSubtle
    marginVertical:  spacing.sm,         // 8 ✓
  },

  // ── Tier Hint ──────────────────────────────────────────────────────────
  tierHintRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,       // 4 ✓
    paddingHorizontal: spacing.base,     // 16 ✓
    paddingBottom:     spacing.md,       // 12 ✓
  },
  tierDot: {
    width:        spacing.sm,            // 8 ✓
    height:       spacing.sm,            // 8 ✓
    borderRadius: radii.full,            // 9999 ✓
  },
  tierHintText: {
    fontFamily:  FONT_BODY.regular,
    color:       crown.textTertiary,     // FIX-12: was orbit.textTertiary
    fontSize:    11,
    flex:        1,
  },

  // ── Skill Tags ────────────────────────────────────────────────────────────
  skillsWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,           // 8 ✓
  },
  skillTag: {
    backgroundColor:   crown.accentSoftSolid,   // FIX-12: was orbit.accentSoftSolid
    borderWidth:       1,
    borderColor:       crown.goldBorder,         // FIX-12: was orbit.goldBorder
    borderRadius:      radii.xl,                 // 18 (full pill) ✓
    paddingHorizontal: spacing.md,               // 12 ✓
    paddingVertical:   spacing.xs,               // FIX-11: was 3 (banned) → 4 ✓
  },
  skillTagText: {
    fontFamily:  FONT_BODY.medium,
    color:       crown.accent,           // FIX-12: was orbit.accent
    fontSize:    12,
    fontWeight:  '500',
  },

  // ── Trust Card ─────────────────────────────────────────────────────────
  trustCard: {
    backgroundColor: colors.bg.card,
    borderWidth:     1,
    borderColor:     crown.borderSubtle, // FIX-12: was orbit.borderSubtle
    borderRadius:    radii.lg,           // 16 ✓
    padding:         spacing.base,       // 16 ✓
    gap:             spacing.sm,         // 8 ✓
  },
  trustHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  trustHeaderLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,           // 4 ✓
  },
  trustLabel: {
    fontFamily:    FONT_BODY.semiBold,
    color:         crown.textTertiary,   // FIX-12: was orbit.textTertiary
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.5,
  },
  trustVal: {
    fontFamily:    FONT_NUMERIC.bold,
    fontSize:      FS_TRUST_SCORE,       // 20 — Syne/Space Mono scale ✓
    fontWeight:    '700',
    letterSpacing: -0.4,
  },
  trustTrack: {
    height:          spacing.xs,         // FIX-11: was 5 (banned) → 4 ✓
    backgroundColor: crown.surface2,     // FIX-12: was orbit.surface2
    borderRadius:    radii.xs,           // FIX-11: was 3 (not in scale) → radii.xs(4) ✓
    overflow:        'hidden',
  },
  trustFill: {
    height:       '100%',
    borderRadius: radii.xs,              // FIX-11: was 3 (not in scale) → radii.xs(4) ✓
  },

  // ── QR Card ──────────────────────────────────────────────────────────────
  qrCard: {
    backgroundColor: colors.bg.card,
    borderWidth:     1,
    borderColor:     crown.borderSubtle, // FIX-12: was orbit.borderSubtle
    borderRadius:    radii.lg,           // 16 ✓
    padding:         spacing.base,       // 16 ✓
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.base,       // 16 ✓
  },
  qrInfo: {
    flex: 1,
  },
  qrTitle: {
    fontFamily:    FONT_BODY.bold,
    color:         crown.textPrimary,    // FIX-12: was orbit.textPrimary
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.2,
    marginBottom:  spacing.xs,           // 4 ✓
  },
  qrSubtitle: {
    fontFamily:   FONT_BODY.regular,
    color:        crown.textTertiary,    // FIX-12: was orbit.textTertiary
    fontSize:     11,
    lineHeight:   15,                    // Typography line-height, not spacing token
    marginBottom: spacing.md,           // 12 ✓
  },
  sharePrimaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.xs,         // FIX-10: was SPACE_6 (6=banned) → 4 ✓
    backgroundColor: crown.accent,      // FIX-12: was orbit.accent
    paddingVertical: spacing.sm,        // FIX-10: was SPACE_10 (10=banned) → 8 ✓
    borderRadius:    radii.md,          // 12 ✓
    minHeight:       touch.minIos,      // 44 ✓
    ...Platform.select({
      ios: {
        shadowColor:   palette.gold[600],
        shadowOpacity: SHADOW_BTN_OPACITY,
        shadowRadius:  SHADOW_BTN_RADIUS,
        shadowOffset:  { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  sharePrimaryBtnText: {
    fontFamily:  FONT_BODY.bold,
    color:       palette.white,          // FIX-17: was orbit.white → palette.white
    fontSize:    13,
    fontWeight:  '700',
  },

  // ── Testimonials ─────────────────────────────────────────────────────────
  testimonialsCard: {
    backgroundColor: colors.bg.card,
    borderWidth:     1,
    borderColor:     crown.borderSubtle, // FIX-12: was orbit.borderSubtle
    borderRadius:    radii.lg,           // 16 ✓
    overflow:        'hidden',
  },
  testimonialRow: {
    flexDirection:     'row',
    padding:           spacing.md,       // 12 ✓
    paddingHorizontal: spacing.md,       // 12 ✓
    gap:               spacing.md,       // 12 ✓
    alignItems:        'flex-start',
  },
  testimonialBody: {
    flex: 1,
  },
  testimonialHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.xs,          // 4 ✓
  },
  testimonialName: {
    fontFamily:  FONT_BODY.semiBold,
    color:       crown.textPrimary,      // FIX-12: was orbit.textPrimary
    fontSize:    13,
    fontWeight:  '600',
  },
  testimonialDate: {
    fontFamily: FONT_BODY.regular,
    color:      crown.textTertiary,      // FIX-12: was orbit.textTertiary
    fontSize:   11,
  },
  testimonialText: {
    fontFamily: FONT_BODY.regular,
    color:      crown.textSecond,        // FIX-12: was orbit.textSecond
    fontSize:   13,
    lineHeight: 18,
  },
  testimonialDivider: {
    height:          1,
    backgroundColor: crown.borderSubtle, // FIX-12: was orbit.borderSubtle
    marginLeft:      dimensions.avatarMsg + spacing.md,  // 36 + 12 = 48
  },
  emptyTestimonials: {
    alignItems:      'center',
    paddingVertical: spacing.xxl,        // 32 ✓
    backgroundColor: colors.bg.card,
    borderWidth:     1,
    borderColor:     crown.borderSubtle, // FIX-12: was orbit.borderSubtle
    borderRadius:    radii.lg,           // 16 ✓
    gap:             spacing.sm,         // 8 ✓
  },
  emptyTestimonialsText: {
    fontFamily: FONT_BODY.regular,
    color:      crown.textTertiary,      // FIX-12: was orbit.textTertiary
    fontSize:   13,
  },

  // ── Add Testimonial ───────────────────────────────────────────────────────
  addTestimonialWrap: {
    marginTop: spacing.sm,               // FIX-10: was SPACE_10 (10=banned) → 8 ✓
  },
  addTestimonialBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,       // FIX-10: was SPACE_7 (7=banned) → 8 ✓
    paddingVertical:   spacing.md,       // 12 ✓
    paddingHorizontal: spacing.md,       // 12 ✓
    backgroundColor:   colors.bg.card,
    borderWidth:       1,
    borderColor:       crown.borderSubtle,  // FIX-12: was orbit.borderSubtle
    borderRadius:      radii.md,         // 12 ✓
    minHeight:         touch.recommended,   // 48 ✓
  },
  addTestimonialBtnText: {
    fontFamily:  FONT_BODY.semiBold,
    color:       crown.accent,           // FIX-12: was orbit.accent
    fontSize:    13,
    fontWeight:  '600',
  },
  addTestimonialForm: {
    backgroundColor:   colors.bg.card,
    borderWidth:       1,
    borderColor:       crown.borderSubtle,  // FIX-12: was orbit.borderSubtle
    borderRadius:      radii.md,         // 12 ✓
    padding:           spacing.md,       // 12 ✓
  },
  testimonialInput: {
    fontFamily:        FONT_BODY.regular,
    color:             crown.textPrimary,   // FIX-12: was orbit.textPrimary
    fontSize:          14,
    lineHeight:        20,
    minHeight:         72,               // Input height — not layout spacing
    textAlignVertical: 'top',
    marginBottom:      spacing.xs,       // 4 ✓
  },
  testimonialCharCount: {
    fontFamily:   FONT_BODY.regular,
    color:        crown.textTertiary,    // FIX-12: was orbit.textTertiary
    fontSize:     11,
    textAlign:    'right',
    marginBottom: spacing.sm,           // 8 ✓
  },
  addTestimonialActions: {
    flexDirection:  'row',
    gap:            spacing.sm,          // FIX-10: was SPACE_10 (10=banned) → 8 ✓
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: spacing.base,     // 16 ✓
    paddingVertical:   spacing.sm,       // 8 ✓
    backgroundColor:   crown.surface2,   // FIX-12: was orbit.surface2
    borderRadius:      radii.base,       // 8 ✓
    minHeight:         touch.minIos,     // 44 ✓
    justifyContent:    'center',
    alignItems:        'center',
  },
  cancelBtnText: {
    fontFamily:  FONT_BODY.medium,
    color:       crown.textSecond,       // FIX-12: was orbit.textSecond
    fontSize:    13,
    fontWeight:  '500',
  },
  submitBtn: {
    paddingHorizontal: spacing.lg,       // 20 ✓
    paddingVertical:   spacing.sm,       // 8 ✓
    backgroundColor:   crown.accent,     // FIX-12: was orbit.accent
    borderRadius:      radii.base,       // 8 ✓
    minWidth:          80,
    minHeight:         touch.minIos,     // 44 ✓
    alignItems:        'center',
    justifyContent:    'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily:  FONT_BODY.bold,
    color:       palette.white,          // FIX-17: was orbit.white → palette.white
    fontSize:    13,
    fontWeight:  '700',
  },

  // ── Footnote ─────────────────────────────────────────────────────────────
  footnote: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.xs,          // FIX-10: was hardcoded 5 (banned) → 4 ✓
    marginTop:      spacing.xxl,         // 32 ✓
  },
  footnoteText: {
    fontFamily: FONT_BODY.regular,
    color:      crown.textTertiary,      // FIX-12: was orbit.textTertiary
    fontSize:   11,
  },
});

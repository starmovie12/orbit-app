/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — app/(tabs)/ranks.tsx   (the CROWN tab)                          ║
 * ║  REWRITE v2.1 — wires the premium `crown-rank/` module into the tab      ║
 * ║                                                                          ║
 * ║  WHY THE OLD SCREEN LOOKED CHEAP:                                        ║
 * ║   • OLD: a standalone screen with HARDCODED dark colors (#0D1018,        ║
 * ║     #F59E0B) + NativeWind `className` styling. It ignored the app token  ║
 * ║     system entirely and rendered a broken dark/flat theme.               ║
 * ║   • NEW: assembles the real, already-built components in `crown-rank/`    ║
 * ║     (CrownHeroCard · RankCard · CyclePhasePanel · CrownJourneyTimeline    ║
 * ║     · BattleScheduleStrip) — LIGHT/cream, gold #D4A017, fully animated,   ║
 * ║     accessibility-complete, PRD-referenced. That module already existed   ║
 * ║     in the repo but was never wired to this route.                       ║
 * ║                                                                          ║
 * ║  THE ADAPTER LAYER (important):                                          ║
 * ║   The crown-rank API returns its own shapes (UserCrownData, JourneyEntry,║
 * ║   FreezeScheduleItem). The crown-rank COMPONENTS expect different shapes  ║
 * ║   (TitleHolderState, TimelineNode[], FreezeTime[]). The pure functions    ║
 * ║   below (toTitleState / toTimelineNodes / toFreezeTimes / emptyRankCard)  ║
 * ║   bridge the two. This is the only logic in the file; everything else is  ║
 * ║   composition.                                                           ║
 * ║                                                                          ║
 * ║  PRD: §9.1 (CROWN tab) · §11A.12 (Live Rank Progress) · §8 (Battle Cycle)║
 * ║  Data: crown-rank/api/* (Firestore subscriptions) — owner-scoped reads.  ║
 * ║                                                                          ║
 * ║  PREREQUISITE: app/_layout.tsx must also load Syne + Space Mono fonts     ║
 * ║  (see note at bottom) — the crown-rank components use them.              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings as SettingsIcon } from 'lucide-react-native';

import { useAuth } from '@/contexts/AuthContext';
import { colors, typography, spacing, dimensions } from '@/constants/colors';

// ── The premium CROWN-tab module (already built — we assemble it here) ────────
import CrownHeroCard from '@/crown-rank/components/CrownHeroCard';
import RankCard from '@/crown-rank/components/RankCard';
import CyclePhasePanel from '@/crown-rank/components/CyclePhasePanel';
import CrownJourneyTimeline from '@/crown-rank/components/CrownJourneyTimeline';
import BattleScheduleStrip from '@/crown-rank/components/BattleScheduleStrip';

import {
  subscribeToUserCrownData,
  fetchCrownJourney,
  fetchBattleSchedule,
  type UserCrownData,
  type ActiveTitle,
  type JourneyEntry,
  type FreezeScheduleItem,
} from '@/crown-rank/api/rank';

import type {
  Tier,
  RankCardData,
  TitleHolderState,
  UserTitle,
  TimelineNode,
  FreezeTime,
  CyclePhaseInfo,
} from '@/crown-rank/types';
import { TIER_ORDER } from '@/crown-rank/types';

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTERS — pure functions mapping API shapes → component prop shapes
// ═══════════════════════════════════════════════════════════════════════════

const TIER_GEO_FALLBACK: Record<Tier, string> = {
  baron: 'Your Sector',
  viceroy: 'Your City',
  sovereign: 'Your Country',
  imperator: 'The World',
};

/** Map an API ActiveTitle (sector/city/country/world) → component UserTitle. */
function toUserTitle(t: ActiveTitle): UserTitle {
  return {
    tier: t.tierId as Tier,
    geographyId: t.geographyId,
    geographyLabel: t.geographyName,
    cyclesHeld: t.cyclesHeld,
    cycleReward: t.cycleReward,
    pinViews: null,
    heldSince: t.heldSinceTs != null ? new Date(t.heldSinceTs).toISOString() : new Date().toISOString(),
  };
}

/** Build the CrownHeroCard's TitleHolderState from live crown data. */
function toTitleState(data: UserCrownData | null): TitleHolderState {
  if (!data) return { has: false };
  const raw = [
    data.currentTitles.sector,
    data.currentTitles.city,
    data.currentTitles.country,
    data.currentTitles.world,
  ].filter((t): t is ActiveTitle => !!t && t.active);

  if (raw.length === 0) return { has: false };

  const titles = raw.map(toUserTitle);
  // Primary = highest tier held (TIER_ORDER is low→high; last match = highest).
  const primaryTitle = [...titles].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  ).at(-1)!;
  return { has: true, titles, primaryTitle };
}

/** Map API JourneyEntry[] → component TimelineNode[]. */
function toTimelineNodes(entries: JourneyEntry[]): TimelineNode[] {
  return entries.map((e) => ({
    nodeId: e.entryId,
    type:
      e.type === 'first_title'
        ? 'first_title'
        : e.type === 'title'
        ? 'title'
        : 'badge',
    tier: (e.tier as Tier) ?? null,
    label:
      e.badgeType ??
      (e.tier ? e.tier.toUpperCase() : 'Milestone'),
    geographyLabel: e.geographyName || null,
    earnedAt: new Date(e.earnedAtMs).toISOString(),
    detail: {
      rankScore: e.rankScore,
      bidReceived: e.bidReceived,
      userDecision: e.keptTitle == null ? null : e.keptTitle ? 'kept' : 'accepted',
      cycleDurationHeld: null,
      cycleNumber: 0,
    },
  }));
}

/** Map API FreezeScheduleItem[] → component FreezeTime[]. */
function toFreezeTimes(items: FreezeScheduleItem[]): FreezeTime[] {
  const now = Date.now();
  return items.map((it) => {
    const freezeIn = Math.max(0, Math.round((it.freezeAtMs - now) / 1000));
    const days = Math.floor(freezeIn / 86400);
    const dateLabel =
      days <= 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `+${days} DAYS`;
    return {
      tier: it.tier as Tier,
      geographyId: it.geographyId,
      geographyLabel: it.geographyName,
      cycleId: it.cycleId,
      freezeAt: new Date(it.freezeAtMs).toISOString(),
      freezeIn,
      dateLabel,
    };
  });
}

/** A neutral cycle-phase object (Phase 1 — Dark Tunnel) for the empty state. */
function defaultPhase(): CyclePhaseInfo {
  const now = Date.now();
  return {
    phase: 1,
    phaseName: 'Dark Tunnel',
    phaseEmoji: '🌑',
    phaseStartedAt: new Date(now).toISOString(),
    nextPhaseAt: new Date(now + 3.5 * 60 * 60 * 1000).toISOString(),
    freezeAt: new Date(now + 4.5 * 60 * 60 * 1000).toISOString(),
    auctionEndsAt: null,
    decisionEndsAt: null,
    meritWinnerId: null,
    highestBid: null,
    baseBidPrice: null,
  };
}

/** A zeroed rank card for a tier the user has no score for yet. */
function emptyRankCard(tier: Tier, geographyLabel: string, phase: CyclePhaseInfo): RankCardData {
  return {
    tier,
    geographyId: '',
    geographyLabel,
    rankPosition: null,
    rankScore: 0,
    progressPercent: 0,
    milestoneLabel: 'Start climbing — react, reply and post to score',
    milestoneHeld: null,
    milestoneHeldSince: null,
    movement: 'same',
    movementDelta: 0,
    cyclePhase: phase,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function CrownTabScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crownData, setCrownData] = useState<UserCrownData | null>(null);
  const [journeyNodes, setJourneyNodes] = useState<TimelineNode[]>([]);
  const [freezeTimes, setFreezeTimes] = useState<FreezeTime[]>([]);

  // Human-readable geography labels from the user doc (fallback to generic).
  const geoLabels = useMemo<Record<Tier, string>>(() => {
    const u = user as any;
    const sector = u?.sectorId ?? u?.sectorName ?? null;
    const city = u?.cityId ?? u?.region ?? null;
    const country = u?.countryId ?? null;
    return {
      baron: sector
        ? `Sector ${String(sector).replace(/^sector-/i, '')}`
        : TIER_GEO_FALLBACK.baron,
      viceroy: city
        ? String(city).replace(/(^|\s)\w/g, (m) => m.toUpperCase())
        : TIER_GEO_FALLBACK.viceroy,
      sovereign: country ? String(country) : TIER_GEO_FALLBACK.sovereign,
      imperator: TIER_GEO_FALLBACK.imperator,
    };
  }, [user]);

  // The tier→geographyId map used for fetching the battle schedule.
  const tierGeographies = useMemo<Partial<Record<Tier, string>>>(() => {
    const u = user as any;
    return {
      baron: u?.sectorId ?? undefined,
      viceroy: u?.cityId ?? u?.region ?? undefined,
      sovereign: u?.countryId ?? undefined,
      imperator: 'world',
    };
  }, [user]);

  // ── Live subscription: crown data (titles + sleep-safe + credits) ──────────
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setCrownData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const unsub = subscribeToUserCrownData(
      uid,
      (data) => {
        if (cancelled) return;
        setCrownData(data);
        setLoading(false);
      },
      () => {
        // user-not-found or read error → treat as no-title empty state
        if (cancelled) return;
        setCrownData(null);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [uid]);

  // ── One-shot fetches: journey timeline + battle schedule ───────────────────
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    fetchCrownJourney(uid)
      .then((entries) => {
        if (!cancelled) setJourneyNodes(toTimelineNodes(entries));
      })
      .catch(() => {
        if (!cancelled) setJourneyNodes([]);
      });

    fetchBattleSchedule(tierGeographies)
      .then((items) => {
        if (!cancelled) setFreezeTimes(toFreezeTimes(items));
      })
      .catch(() => {
        if (!cancelled) setFreezeTimes([]);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, tierGeographies]);

  // ── Derived view data ──────────────────────────────────────────────────────
  const titleState = useMemo(() => toTitleState(crownData), [crownData]);

  // Four standings cards (Sector→World). Real score data would come from
  // subscribeToRankScore per tier; until those are wired, show encouraging
  // empty cards so a new user still sees all four tiers and their geographies.
  const rankCards = useMemo<RankCardData[]>(() => {
    const ph = defaultPhase();
    return TIER_ORDER.map((t) => emptyRankCard(t, geoLabels[t], ph));
  }, [geoLabels]);

  const primaryCard = rankCards[0];

  // ── Pull to refresh ────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    if (!uid) return;
    setRefreshing(true);
    try {
      const [entries, items] = await Promise.all([
        fetchCrownJourney(uid),
        fetchBattleSchedule(tierGeographies),
      ]);
      setJourneyNodes(toTimelineNodes(entries));
      setFreezeTimes(toFreezeTimes(items));
    } catch {
      /* keep existing data */
    } finally {
      setRefreshing(false);
    }
  }, [uid, tierGeographies]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header — wordmark + sleep-safe settings ─────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.crownGlyph} accessibilityElementsHidden>
            👑
          </Text>
          <Text style={styles.wordmark}>CROWN</Text>
        </View>
        <View
          accessibilityRole="button"
          accessibilityLabel="Sleep-safe auction settings"
          style={styles.settingsBtn}
        >
          <SettingsIcon size={18} color={colors.fg.secondary} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.fg.brand} />
          <Text style={styles.loadingText}>Loading your standings…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.fg.brand}
              colors={[colors.fg.brand]}
            />
          }
        >
          {/* ── Emotional anchor: title-holder hero / aspiration ─────────────── */}
          <View style={styles.section}>
            <CrownHeroCard titleState={titleState} />
          </View>

          {/* ── Active cycle phase panel (for the tier you're climbing) ──────── */}
          {primaryCard && (
            <View style={styles.section}>
              <CyclePhasePanel
                cyclePhase={primaryCard.cyclePhase}
                geographyLabel={primaryCard.geographyLabel}
                tierLabel={primaryCard.tier.toUpperCase()}
                rankScore={primaryCard.rankScore}
              />
            </View>
          )}

          {/* ── Your standings — one card per tier (Sector→World) ───────────── */}
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionTitle}>Your standings</Text>
            <Text style={styles.sectionSubtitle}>Tap a tier for the full breakdown</Text>
          </View>

          {rankCards.map((card) => (
            <View key={card.tier} style={styles.cardWrap}>
              <RankCard data={card} />
            </View>
          ))}

          {/* ── Battle schedule (next freeze times) ─────────────────────────── */}
          {freezeTimes.length > 0 && (
            <View style={styles.section}>
              <BattleScheduleStrip freezeTimes={freezeTimes} />
            </View>
          )}

          {/* ── Crown Journey timeline (titles + badges earned) ─────────────── */}
          {journeyNodes.length > 0 && (
            <View style={styles.section}>
              <CrownJourneyTimeline nodes={journeyNodes} />
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — tokens only, zero hardcoded hex (CROWN LAW 2)
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.surface, // white
  },

  header: {
    height: dimensions.headerHeight, // 56
    paddingHorizontal: spacing.base, // 16
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default, // cream hairline
    backgroundColor: colors.bg.surface,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm, // 8
  },
  crownGlyph: {
    fontSize: 22,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.fg.brandSubtle, // gold[800] — AA-safe brand wordmark on white
  },
  settingsBtn: {
    width: dimensions.btnIcon, // 44
    height: dimensions.btnIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg, // 20
  },

  section: {
    paddingHorizontal: spacing.base, // 16
    marginBottom: spacing.lg, // 20
  },
  sectionHeaderWrap: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.md, // 12
  },
  sectionTitle: {
    ...typography.title, // 22/700
    color: colors.fg.primary, // warm ink
  },
  sectionSubtitle: {
    ...typography.bodySmall, // 13/400
    color: colors.fg.secondary, // espresso
    marginTop: spacing.xs, // 4
  },
  cardWrap: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md, // 12
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.fg.secondary,
  },
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPPORTING CHANGE REQUIRED (do this once, separately):
 *
 * app/_layout.tsx — load Syne + Space Mono alongside Inter so the crown-rank
 * components render in the correct brand fonts (otherwise they fall back to
 * system font). Add to the imports + useFonts() call:
 *
 *   import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
 *   import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
 *
 *   const [fontsLoaded, fontError] = useFonts({
 *     Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
 *     Syne_700Bold, Syne_800ExtraBold,
 *     SpaceMono_400Regular, SpaceMono_700Bold,
 *   });
 *
 * Install once (phone — via EAS/Colab):
 *   npx expo install @expo-google-fonts/syne @expo-google-fonts/space-mono
 * ─────────────────────────────────────────────────────────────────────────────
 */

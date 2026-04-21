/**
 * components/ORBITCard.tsx
 *
 * ORBIT — Standalone ORBIT Card Component
 *
 * A premium social-identity card that can be embedded in the Profile screen,
 * the public /orbit-card/[username] route, or exported as an image.
 *
 * Features:
 *   • Gradient background — two-stop LinearGradient derived from the user's
 *     karma tier colour (matches the brand palette in constants/colors.ts).
 *   • Avatar — deterministic initials circle via the shared Avatar component.
 *   • Name + @handle — displayName (falls back to username) and @handle.
 *   • Karma / Credits / Posts stats strip — all values from UserDoc fields
 *     confirmed in lib/firestore-users.ts.
 *   • Tier pill + rank pill — karma tier derived with the same thresholds
 *     used by the /orbit-card/[username] screen; rank from user.rank.
 *   • Badge row — achievement badges computed from karma, streak, posts,
 *     watches, and trophies[], matching profile.tsx logic exactly.
 *   • Skills / Interests tags — user.interests[] (up to 6 shown).
 *   • Share CTA — React Native Share API, same deep-link format used by
 *     the /orbit-card/[username] screen (orbit.app.link/card/{username}).
 *   • Compact / Full mode toggle — `compact` prop collapses skills + badges
 *     for use inside chat message cards or list rows.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *
 *   user     UserDoc (from lib/firestore-users.ts).  Required.
 *   compact  Optional boolean.  When true: hides skills + badges rows,
 *            renders a shorter single-row footer.  Default: false.
 *   onShare  Optional callback — called after the native share sheet closes.
 *            If omitted the component handles sharing internally.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import ORBITCard from '@/components/ORBITCard';
 *
 *   // In profile screen (replaces inline OrbitCard):
 *   <ORBITCard user={user} />
 *
 *   // In orbit-card screen (compact embed inside list):
 *   <ORBITCard user={target} compact />
 */

import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { Avatar, TierPill } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { type UserDoc } from "@/lib/firestore-users";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANCH_BASE = "https://orbit.app.link/card/";
const MAX_SKILLS  = 6;
const MAX_BADGES  = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

type KarmaTier = "LEGEND" | "MASTER" | "PRO" | "RISING";

interface Badge {
  icon:  string;
  label: string;
  desc:  string;
}

export interface ORBITCardProps {
  /** Full user document from /users/{uid}. */
  user: UserDoc;
  /**
   * When true, hides the skills + badge rows and renders a compact footer.
   * Useful inside list rows or message bubbles.
   * @default false
   */
  compact?: boolean;
  /**
   * Optional override called after the native share sheet closes.
   * If omitted the component handles sharing via React Native Share API.
   */
  onShare?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function karmaToTier(karma: number): KarmaTier {
  if (karma >= 2000) return "LEGEND";
  if (karma >= 501)  return "MASTER";
  if (karma >= 101)  return "PRO";
  return "RISING";
}

/** Primary accent colour for a tier — mirrors tierColor() in orbit-card/[username].tsx */
function tierAccent(tier: KarmaTier): string {
  switch (tier) {
    case "LEGEND": return orbit.warning;
    case "MASTER": return orbit.accent;
    case "PRO":    return orbit.success;
    default:       return orbit.danger;
  }
}

/**
 * Second gradient stop — slightly darkened / shifted version of the primary
 * accent.  Keeps gradients subtle and on-brand without external colour libs.
 */
function tierAccent2(tier: KarmaTier): string {
  switch (tier) {
    case "LEGEND": return "#A06B1A";   // amber darkened
    case "MASTER": return "#3A5AE0";   // accent darkened
    case "PRO":    return "#1A8A54";   // success darkened
    default:       return "#B02D31";   // danger darkened
  }
}

/**
 * Compute achievement badges from user doc fields.
 * Matches the `buildAchievements()` logic in app/(tabs)/profile.tsx exactly
 * so both screens show consistent badges.
 */
function buildBadges(user: UserDoc): Badge[] {
  const list: Badge[] = [];
  const karma   = user.karma   ?? 0;
  const streak  = user.streak  ?? 0;
  const posts   = user.posts   ?? 0;
  const watches = user.watches ?? 0;

  // Karma tier badges
  if (karma >= 2000)      list.push({ icon: "award",      label: "Legend",      desc: "Karma ≥ 2000 — Legend tier" });
  else if (karma >= 501)  list.push({ icon: "zap",        label: "Master",      desc: "Karma ≥ 501 — Master tier" });
  else if (karma >= 1000) list.push({ icon: "zap",        label: "1K Karma",    desc: "Earned your first 1000 Karma" });
  else if (karma >= 100)  list.push({ icon: "trending-up", label: "Rising",     desc: "Earned your first 100 Karma" });

  // Streak badges
  if (streak >= 30)       list.push({ icon: "activity",   label: "30-Day Streak", desc: "30 days of continuous activity" });
  else if (streak >= 7)   list.push({ icon: "activity",   label: "On Fire",       desc: "7-day posting streak" });
  else if (streak >= 3)   list.push({ icon: "activity",   label: "Consistent",    desc: "3-day posting streak" });

  // Posts badges
  if (posts >= 100)       list.push({ icon: "star",       label: "Star Creator",  desc: "100+ posts uploaded" });
  else if (posts >= 10)   list.push({ icon: "edit",       label: "Creator",       desc: "Published 10+ posts" });

  // Watches badge
  if (watches >= 500)     list.push({ icon: "eye",        label: "Watcher",       desc: "Watched 500+ posts" });

  // Trophy badges from trophies[] string array on UserDoc
  const TROPHY_MAP: Record<string, Badge> = {
    top1:    { icon: "award",   label: "Champion",   desc: "Won a weekly challenge" },
    streak:  { icon: "zap",     label: "Streak King", desc: "Longest streak in the room" },
    star:    { icon: "star",    label: "Star",        desc: "Star badge awarded" },
    diamond: { icon: "hexagon", label: "Diamond",     desc: "Diamond tier reached" },
  };

  const alreadyLabels = new Set(list.map(b => b.label));
  (user.trophies ?? []).forEach(t => {
    const mapped = TROPHY_MAP[t];
    if (mapped && !alreadyLabels.has(mapped.label)) {
      list.push(mapped);
      alreadyLabels.add(mapped.label);
    }
  });

  // Welcome fallback — always shown for brand-new accounts
  if (list.length === 0) {
    list.push({ icon: "home",         label: "Welcome",    desc: "Joined the Orbit community" });
    list.push({ icon: "message-circle", label: "First Step", desc: "Profile complete — start chatting!" });
  }

  return list.slice(0, MAX_BADGES);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkillTag({ label }: { label: string }) {
  return (
    <View style={styles.skillTag}>
      <Text style={styles.skillTagText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function BadgeChip({ badge }: { badge: Badge }) {
  return (
    <View style={styles.badgeChip}>
      <Feather
        name={badge.icon as React.ComponentProps<typeof Feather>["name"]}
        size={11}
        color={orbit.warning}
      />
      <Text style={styles.badgeChipText}>{badge.label}</Text>
    </View>
  );
}

function StatCell({
  value,
  label,
  accent,
}: {
  value:   string | number;
  label:   string;
  accent?: string;
}) {
  const display =
    typeof value === "number"
      ? value.toLocaleString("en-IN")
      : value;
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statVal, accent ? { color: accent } : undefined]}>
        {display}
      </Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ORBITCard({
  user,
  compact = false,
  onShare,
}: ORBITCardProps) {
  const [sharing, setSharing] = useState(false);

  // Scale-in entrance animation
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:         1,
        tension:         80,
        friction:        9,
        useNativeDriver: true,
      }),
      Animated.timing(opacAnim, {
        toValue:         1,
        duration:        280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacAnim]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const displayName = user.displayName || user.username || "Orbit User";
  const handle      = user.username ? `@${user.username}` : "";
  const tier        = karmaToTier(user.karma ?? 0);
  const accent1     = tierAccent(tier);
  const accent2     = tierAccent2(tier);
  const skills      = (user.interests ?? []).slice(0, MAX_SKILLS);
  const badges      = buildBadges(user);
  const karma       = user.karma    ?? 0;
  const credits     = user.credits  ?? 0;
  const posts       = user.posts    ?? 0;
  const rank        = user.rank;
  const shareUrl    = `${BRANCH_BASE}${user.username ?? user.uid}`;

  // ── Share handler ────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const message =
        `Check out ${displayName}'s ORBIT Card 🚀\n` +
        `Karma: ${karma.toLocaleString("en-IN")} · Tier: ${tier}\n\n${shareUrl}`;

      await Share.share(
        Platform.OS === "ios"
          ? { url: shareUrl, message }
          : { message },
        { dialogTitle: `Share ${displayName}'s ORBIT Card` },
      );
      onShare?.();
    } catch {
      /* user dismissed */
    } finally {
      setSharing(false);
    }
  }, [sharing, displayName, karma, tier, shareUrl, onShare]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.root,
        { transform: [{ scale: scaleAnim }], opacity: opacAnim },
      ]}
      accessibilityRole="none"
    >
      {/* ── Gradient header ────────────────────────────────────────── */}
      <LinearGradient
        colors={[accent1, accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* ORBIT watermark */}
        <Text style={styles.watermark} accessibilityElementsHidden>
          ORBIT
        </Text>

        {/* Avatar + identity */}
        <View style={styles.heroRow}>
          <Avatar name={displayName} size={64} ringed />
          <View style={styles.heroIdentity}>
            <Text style={styles.heroName} numberOfLines={1}>
              {displayName}
            </Text>
            {!!handle && (
              <Text style={styles.heroHandle} numberOfLines={1}>
                {handle}
              </Text>
            )}
            {/* Tier pill + rank */}
            <View style={styles.heroPillRow}>
              <TierPill tier={tier} solid />
              {rank != null && (
                <View style={styles.rankPill}>
                  <Feather name="trending-up" size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.rankPillText}>#{rank} Global</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bio */}
        {!!user.bio && !compact && (
          <Text style={styles.heroBio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}
      </LinearGradient>

      {/* ── Card body ──────────────────────────────────────────────── */}
      <View style={styles.body}>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <StatCell value={karma}   label="KARMA"   accent={accent1} />
          <View style={styles.statDivider} />
          <StatCell value={credits} label="CREDITS" />
          <View style={styles.statDivider} />
          <StatCell value={posts}   label="POSTS"   />
          {rank != null && (
            <>
              <View style={styles.statDivider} />
              <StatCell value={`#${rank}`} label="RANK" />
            </>
          )}
        </View>

        {/* Badges row */}
        {!compact && badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BADGES</Text>
            <View style={styles.badgesRow}>
              {badges.map((b, i) => (
                <BadgeChip key={i} badge={b} />
              ))}
            </View>
          </View>
        )}

        {/* Skills / Interests */}
        {!compact && skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SKILLS & INTERESTS</Text>
            <View style={styles.skillsRow}>
              {skills.map((s, i) => (
                <SkillTag key={i} label={s} />
              ))}
            </View>
          </View>
        )}

        {/* Footer: share CTA + deep link */}
        <View style={[styles.footer, compact && styles.footerCompact]}>
          {/* Deep link label */}
          <View style={styles.linkRow}>
            <Feather name="link" size={11} color={orbit.textTertiary} />
            <Text style={styles.linkText} numberOfLines={1}>
              orbit.app.link/card/{user.username ?? ""}
            </Text>
          </View>

          {/* Share button */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: accent1 }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Share ${displayName}'s ORBIT Card`}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={orbit.white} />
            ) : (
              <>
                <Feather name="share-2" size={13} color={orbit.white} />
                <Text style={styles.shareBtnText}>Share Card</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root wrapper ────────────────────────────────────────────────────────────
  root: {
    backgroundColor: orbit.surface1,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    borderRadius:    20,
    overflow:        "hidden",
    // Soft card shadow
    ...Platform.select({
      ios: {
        shadowColor:   orbit.black,
        shadowOpacity: 0.18,
        shadowRadius:  12,
        shadowOffset:  { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },

  // ── Gradient header ──────────────────────────────────────────────────────────
  gradientHeader: {
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     22,
    position:          "relative",
    overflow:          "hidden",
  },
  watermark: {
    position:    "absolute",
    right:       14,
    top:         10,
    fontSize:    32,
    fontWeight:  "900",
    color:       "rgba(255,255,255,0.08)",
    letterSpacing: 4,
  },

  // ── Hero row ─────────────────────────────────────────────────────────────────
  heroRow: {
    flexDirection: "row",
    alignItems:    "center",
  },
  heroIdentity: {
    flex:       1,
    marginLeft: 14,
  },
  heroName: {
    color:         orbit.white,
    fontSize:      20,
    fontWeight:    "700",
    letterSpacing: -0.4,
    marginBottom:  2,
    textShadowColor:  "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroHandle: {
    color:        "rgba(255,255,255,0.75)",
    fontSize:     13,
    fontWeight:   "500",
    marginBottom: 8,
  },
  heroPillRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flexWrap:      "wrap",
  },
  rankPill: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             4,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:    6,
  },
  rankPillText: {
    color:      "rgba(255,255,255,0.85)",
    fontSize:   11,
    fontWeight: "600",
  },
  heroBio: {
    color:      "rgba(255,255,255,0.80)",
    fontSize:   13,
    lineHeight: 18,
    marginTop:  14,
  },

  // ── Card body ────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     18,
  },

  // ── Stats strip ───────────────────────────────────────────────────────────────
  statsStrip: {
    flexDirection:   "row",
    backgroundColor: orbit.surface2,
    borderRadius:    12,
    paddingVertical: 14,
    marginBottom:    6,
  },
  statCell: {
    flex:        1,
    alignItems:  "center",
  },
  statVal: {
    color:         orbit.textPrimary,
    fontSize:      16,
    fontWeight:    "700",
    letterSpacing: -0.3,
  },
  statLbl: {
    color:         orbit.textTertiary,
    fontSize:      10,
    fontWeight:    "600",
    letterSpacing: 0.5,
    marginTop:     3,
  },
  statDivider: {
    width:       1,
    height:      28,
    backgroundColor: orbit.borderSubtle,
    alignSelf:   "center",
  },

  // ── Sections ─────────────────────────────────────────────────────────────────
  section: {
    marginTop: 16,
  },
  sectionLabel: {
    color:         orbit.textTertiary,
    fontSize:      10,
    fontWeight:    "600",
    letterSpacing: 0.6,
    marginBottom:  10,
  },

  // ── Badges ───────────────────────────────────────────────────────────────────
  badgesRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           6,
  },
  badgeChip: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: orbit.surface2,
    borderWidth:     1,
    borderColor:     orbit.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:    20,
  },
  badgeChipText: {
    color:      orbit.textSecond,
    fontSize:   11,
    fontWeight: "600",
  },

  // ── Skills ────────────────────────────────────────────────────────────────────
  skillsRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           8,
  },
  skillTag: {
    backgroundColor: orbit.accentSoftSolid,
    borderWidth:     1,
    borderColor:     orbit.accentSoft,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:    20,
  },
  skillTagText: {
    color:      orbit.accent,
    fontSize:   12,
    fontWeight: "500",
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginTop:      20,
    gap:            10,
  },
  footerCompact: {
    marginTop: 14,
  },
  linkRow: {
    flex:          1,
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
    overflow:      "hidden",
  },
  linkText: {
    flex:       1,
    color:      orbit.textTertiary,
    fontSize:   11,
    fontWeight: "500",
  },
  shareBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderRadius:    10,
    minWidth:        110,
    justifyContent:  "center",
    ...Platform.select({
      ios: {
        shadowColor:   orbit.black,
        shadowOpacity: 0.22,
        shadowRadius:  6,
        shadowOffset:  { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  shareBtnText: {
    color:      orbit.white,
    fontSize:   13,
    fontWeight: "700",
  },
});

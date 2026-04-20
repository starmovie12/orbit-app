/**
 * ORBIT — User Profile Screen v2
 *
 * Route: /user/[id]  where id = target user's uid
 *
 * v2 changes over v1:
 *   • Subscribes to the real Firestore user document (subscribeUser) instead
 *     of a one-shot getUser() call — profile updates appear in real-time.
 *   • Karma Tier computed from karma value per blueprint §08 multiplier tiers:
 *       0-100   → RISING  (1.0x)
 *       101-500 → PRO     (1.25x)
 *       501-2K  → MASTER  (1.5x)
 *       2K+     → LEGEND  (2.0x)
 *   • ORBIT Card — shareable digital identity card (name, handle, karma, tier,
 *     trust score, top interests, bio snippet). Tapping "Share Card" is stubbed
 *     — wire to Share API or QR modal in Phase 2.
 *   • Functional DM button: calls ensureThread() and navigates to /dm/{threadId}.
 *   • isMe guard: profile of current user shows an "Edit Profile" link instead.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  ActivityIndicator,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Avatar, TierPill } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeUser, type UserDoc } from "@/lib/firestore-users";
import { ensureThread } from "@/lib/firestore-dms";

/* ─────────────────────────────────────────────────────────────────────
   Karma tier — blueprint §08
───────────────────────────────────────────────────────────────────── */

type KarmaTier = "LEGEND" | "MASTER" | "PRO" | "RISING";

function karmaToTier(karma: number): KarmaTier {
  if (karma >= 2000) return "LEGEND";
  if (karma >= 501)  return "MASTER";
  if (karma >= 101)  return "PRO";
  return "RISING";
}

function tierMultiplier(tier: KarmaTier): string {
  switch (tier) {
    case "LEGEND": return "2.0×";
    case "MASTER": return "1.5×";
    case "PRO":    return "1.25×";
    default:       return "1.0×";
  }
}

function tierPrivilege(tier: KarmaTier): string {
  switch (tier) {
    case "LEGEND": return "All privileges · Verified badge";
    case "MASTER": return "Priority support · All features";
    case "PRO":    return "Spotlight eligible · Blue dot";
    default:       return "Rising member of Orbit";
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Small presentational helpers
───────────────────────────────────────────────────────────────────── */

function StatBox({ val, lbl }: { val: string | number; lbl: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>
        {typeof val === "number" ? val.toLocaleString("en-IN") : val}
      </Text>
      <Text style={styles.statLbl}>{lbl}</Text>
    </View>
  );
}

function InterestChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function TrustBar({ score }: { score: number }) {
  const color =
    score >= 90 ? orbit.success :
    score >= 70 ? orbit.warning :
    orbit.danger;
  return (
    <View style={styles.trustCard}>
      <View style={styles.trustHeader}>
        <View style={styles.trustHeaderLeft}>
          <Feather name="shield" size={14} color={orbit.textSecond} />
          <Text style={styles.trustLabel}>TRUST SCORE</Text>
        </View>
        <Text style={[styles.trustVal, { color }]}>{score}</Text>
      </View>
      <View style={styles.trustTrack}>
        <View
          style={[
            styles.trustFill,
            {
              width: `${Math.min(100, Math.max(0, score))}%` as any,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Karma Tier Card
───────────────────────────────────────────────────────────────────── */

function KarmaTierCard({ karma }: { karma: number }) {
  const tier = karmaToTier(karma);
  const mult = tierMultiplier(tier);
  const priv = tierPrivilege(tier);

  const dotColor =
    tier === "LEGEND" ? orbit.warning :
    tier === "MASTER" ? orbit.accent :
    tier === "PRO"    ? orbit.success :
    orbit.danger;

  const nextThreshold =
    tier === "RISING" ? 101 :
    tier === "PRO"    ? 501 :
    tier === "MASTER" ? 2001 :
    null;

  const progress = nextThreshold
    ? Math.min(1, karma / nextThreshold)
    : 1;

  return (
    <View style={styles.tierCard}>
      <View style={styles.tierCardHeader}>
        <View style={styles.tierCardLeft}>
          <View style={[styles.tierDot, { backgroundColor: dotColor }]} />
          <Text style={styles.tierCardTitle}>KARMA TIER</Text>
        </View>
        <View style={styles.tierBadgeRow}>
          <TierPill tier={tier} />
          <Text style={styles.tierMult}>{mult} earnings</Text>
        </View>
      </View>

      <View style={styles.tierTrack}>
        <View style={[styles.tierFill, { width: `${progress * 100}%` as any, backgroundColor: dotColor }]} />
      </View>

      <View style={styles.tierCardFooter}>
        <Text style={styles.tierPriv}>{priv}</Text>
        {nextThreshold && (
          <Text style={styles.tierNext}>
            {(nextThreshold - karma).toLocaleString("en-IN")} to next tier
          </Text>
        )}
      </View>

      <View style={styles.karmaStatRow}>
        <Text style={[styles.karmaValue, { color: dotColor }]}>
          {karma.toLocaleString("en-IN")}
        </Text>
        <Text style={styles.karmaLbl}> karma points</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   ORBIT Card — digital identity card (shareable)
───────────────────────────────────────────────────────────────────── */

function OrbitCard({ target }: { target: UserDoc }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const tier = karmaToTier(target.karma ?? 0);
  const dotColor =
    tier === "LEGEND" ? orbit.warning :
    tier === "MASTER" ? orbit.accent :
    tier === "PRO"    ? orbit.success :
    orbit.danger;

  const displayName = target.displayName || target.username || "User";
  const handle = target.username ? `@${target.username}` : "";
  const topInterests = (target.interests ?? []).slice(0, 3);

  const handleShare = async () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    try {
      await Share.share({
        message: `Check out ${displayName}'s ORBIT profile: https://orbitapp.in/u/${target.username ?? target.uid}`,
        title: `${displayName} on ORBIT`,
      });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <Animated.View style={[styles.orbitCard, { transform: [{ scale: scaleAnim }] }]}>
      {/* Card header strip */}
      <View style={[styles.orbitCardStrip, { backgroundColor: dotColor }]} />

      <View style={styles.orbitCardBody}>
        {/* Identity */}
        <View style={styles.orbitCardIdentity}>
          <Avatar name={displayName} size={52} ringed />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.orbitCardName} numberOfLines={1}>{displayName}</Text>
            {handle ? <Text style={styles.orbitCardHandle}>{handle}</Text> : null}
            <View style={styles.orbitCardTierRow}>
              <View style={[styles.orbitCardTierDot, { backgroundColor: dotColor }]} />
              <Text style={styles.orbitCardTierLabel}>{tier}</Text>
              <Text style={styles.orbitCardSep}>·</Text>
              <Text style={styles.orbitCardKarma}>{(target.karma ?? 0).toLocaleString("en-IN")} karma</Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        {target.bio ? (
          <Text style={styles.orbitCardBio} numberOfLines={2}>{target.bio}</Text>
        ) : null}

        {/* Interests row */}
        {topInterests.length > 0 && (
          <View style={styles.orbitCardInterests}>
            {topInterests.map((it, i) => (
              <View key={i} style={styles.orbitCardChip}>
                <Text style={styles.orbitCardChipText}>{it}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Stats strip */}
        <View style={styles.orbitCardStats}>
          <View style={styles.orbitCardStat}>
            <Text style={styles.orbitCardStatVal}>{(target.trustScore ?? 50)}</Text>
            <Text style={styles.orbitCardStatLbl}>Trust</Text>
          </View>
          <View style={styles.orbitCardStatDivider} />
          <View style={styles.orbitCardStat}>
            <Text style={styles.orbitCardStatVal}>{(target.posts ?? 0).toLocaleString("en-IN")}</Text>
            <Text style={styles.orbitCardStatLbl}>Posts</Text>
          </View>
          <View style={styles.orbitCardStatDivider} />
          <View style={styles.orbitCardStat}>
            <Text style={styles.orbitCardStatVal}>{(target.streak ?? 0)}</Text>
            <Text style={styles.orbitCardStatLbl}>Streak</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.orbitCardFooter}>
          <View style={styles.orbitCardBrand}>
            <Feather name="zap" size={11} color={orbit.accent} />
            <Text style={styles.orbitCardBrandText}>ORBIT</Text>
          </View>
          <TouchableOpacity
            style={styles.orbitCardShareBtn}
            onPress={handleShare}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Share ORBIT Card"
            hitSlop={8}
          >
            <Feather name="share-2" size={13} color={orbit.accent} />
            <Text style={styles.orbitCardShareText}>Share Card</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Screen
───────────────────────────────────────────────────────────────────── */

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, user: me } = useAuth();

  const [target, setTarget] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingDM, setOpeningDM] = useState(false);

  /* ── Live Firestore subscription ───────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeUser(id, doc => {
      setTarget(doc);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const isMe = firebaseUser?.uid === id;

  /* ── DM handler ────────────────────────────────────────────────── */
  const openDM = async () => {
    if (!me || !target || !firebaseUser || openingDM || isMe) return;
    setOpeningDM(true);
    try {
      const threadId = await ensureThread({
        me: {
          uid: firebaseUser.uid,
          username: me.username ?? "you",
          emoji: me.emoji ?? "👤",
          color: me.color ?? orbit.accent,
        },
        other: {
          uid: target.uid,
          username: target.username ?? "user",
          emoji: target.emoji ?? "👤",
          color: target.color ?? orbit.accent,
        },
      });
      router.push(`/dm/${threadId}` as never);
    } catch {
      /* swallow — user can tap again */
    } finally {
      setOpeningDM(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);

  /* ── Loading ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  /* ── Not found ─────────────────────────────────────────────────── */
  if (!target) {
    return (
      <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
            <Feather name="x" size={24} color={orbit.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.center}>
          <Feather name="user-x" size={48} color={orbit.textTertiary} />
          <Text style={styles.emptyTitle}>User not found</Text>
          <Text style={styles.emptySub}>This profile may have been deleted.</Text>
        </View>
      </View>
    );
  }

  const displayName = target.displayName || target.username || "user";
  const handle = target.username ? `@${target.username}` : "";
  const tier = karmaToTier(target.karma ?? 0);

  return (
    <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
      {/* ── HEADER ───────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Feather name="x" size={24} color={orbit.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.moreBtn} hitSlop={8}>
          <Feather name="more-vertical" size={20} color={orbit.textSecond} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── IDENTITY BLOCK ─────────────────────────────────────── */}
        <View style={styles.identity}>
          <Avatar name={displayName} size={96} />
          <Text style={styles.name}>{displayName}</Text>
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}

          <View style={styles.tierRow}>
            <TierPill tier={tier} />
            {target.rank != null && (
              <View style={styles.rankPill}>
                <Feather name="award" size={11} color={orbit.warning} />
                <Text style={styles.rankText}>Rank #{target.rank.toLocaleString("en-IN")}</Text>
              </View>
            )}
          </View>

          {target.bio ? (
            <Text style={styles.bio} numberOfLines={4}>{target.bio}</Text>
          ) : null}

          {/* ── ACTION BUTTONS ──────────────────────────────────── */}
          {isMe ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 20, width: "100%" }]}
              onPress={() => router.push("/edit-profile" as never)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Edit your profile"
            >
              <Feather name="edit-2" size={16} color={orbit.white} />
              <Text style={styles.primaryBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, openingDM && { opacity: 0.6 }]}
                onPress={openDM}
                disabled={openingDM}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Message ${displayName}`}
              >
                {openingDM ? (
                  <ActivityIndicator size="small" color={orbit.white} />
                ) : (
                  <>
                    <Feather name="message-circle" size={16} color={orbit.white} />
                    <Text style={styles.primaryBtnText}>Message</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Follow ${displayName}`}
              >
                <Feather name="user-plus" size={16} color={orbit.textPrimary} />
                <Text style={styles.secondaryBtnText}>Follow</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── STATS ──────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatBox val={target.karma ?? 0} lbl="Karma" />
          <View style={styles.statDivider} />
          <StatBox val={target.credits ?? 0} lbl="Credits" />
          <View style={styles.statDivider} />
          <StatBox val={target.streak ?? 0} lbl="Streak" />
          <View style={styles.statDivider} />
          <StatBox val={target.posts ?? 0} lbl="Posts" />
        </View>

        {/* ── KARMA TIER ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>KARMA TIER</Text>
          <KarmaTierCard karma={target.karma ?? 0} />
        </View>

        {/* ── ORBIT CARD ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ORBIT CARD</Text>
          <OrbitCard target={target} />
        </View>

        {/* ── TRUST SCORE ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRUST SCORE</Text>
          <TrustBar score={target.trustScore ?? 50} />
        </View>

        {/* ── INTERESTS ──────────────────────────────────────────── */}
        {target.interests && target.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INTERESTS</Text>
            <View style={styles.chipRow}>
              {target.interests.map((it, i) => (
                <InterestChip key={i} label={it} />
              ))}
            </View>
          </View>
        )}

        {/* ── TROPHIES ───────────────────────────────────────────── */}
        {target.trophies && target.trophies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TROPHIES</Text>
            <View style={styles.chipRow}>
              {target.trophies.map((t, i) => (
                <View key={i} style={styles.trophy}>
                  <Feather name="award" size={12} color={orbit.warning} />
                  <Text style={styles.trophyText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── REGION ─────────────────────────────────────────────── */}
        {target.region ? (
          <View style={styles.section}>
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={14} color={orbit.textTertiary} />
              <Text style={styles.metaText}>{target.region}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: orbit.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  moreBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Identity */
  identity: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  name: {
    marginTop: 16,
    color: orbit.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  handle: {
    marginTop: 3,
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: "500",
  },
  tierRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: orbit.warningSoft,
  },
  rankText: { color: orbit.warning, fontSize: 12, fontWeight: "600" },
  bio: {
    marginTop: 14,
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  /* Actions */
  actions: { flexDirection: "row", gap: 10, marginTop: 20, width: "100%" },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: orbit.accent,
  },
  primaryBtnText: { color: orbit.white, fontSize: 14, fontWeight: "600" },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  secondaryBtnText: { color: orbit.textPrimary, fontSize: 14, fontWeight: "600" },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  statBox: { flex: 1, alignItems: "center" },
  statVal: { color: orbit.textPrimary, fontSize: 18, fontWeight: "700" },
  statLbl: { marginTop: 2, color: orbit.textTertiary, fontSize: 11, fontWeight: "500", letterSpacing: 0.3 },
  statDivider: { width: 1, height: 28, backgroundColor: orbit.borderSubtle },

  /* Section */
  section: { paddingHorizontal: 20, paddingVertical: 16 },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 12,
  },

  /* Karma tier card */
  tierCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    gap: 12,
  },
  tierCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierCardLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierCardTitle: { color: orbit.textSecond, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  tierBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierMult: { color: orbit.textTertiary, fontSize: 11, fontWeight: "500" },
  tierTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: orbit.surface3,
    overflow: "hidden",
  },
  tierFill: { height: "100%", borderRadius: 3 },
  tierCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierPriv: { color: orbit.textSecond, fontSize: 12, fontWeight: "500", flex: 1 },
  tierNext: { color: orbit.textTertiary, fontSize: 11, fontWeight: "500" },
  karmaStatRow: { flexDirection: "row", alignItems: "baseline" },
  karmaValue: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  karmaLbl: { color: orbit.textTertiary, fontSize: 14, fontWeight: "500" },

  /* ORBIT Card */
  orbitCard: {
    borderRadius: 16,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: "hidden",
  },
  orbitCardStrip: { height: 4, width: "100%" },
  orbitCardBody: { padding: 16, gap: 12 },
  orbitCardIdentity: { flexDirection: "row", alignItems: "center" },
  orbitCardName: {
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  orbitCardHandle: { color: orbit.textSecond, fontSize: 13, fontWeight: "500", marginTop: 2 },
  orbitCardTierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  orbitCardTierDot: { width: 6, height: 6, borderRadius: 3 },
  orbitCardTierLabel: { color: orbit.textSecond, fontSize: 11, fontWeight: "600" },
  orbitCardSep: { color: orbit.textTertiary, fontSize: 11 },
  orbitCardKarma: { color: orbit.textTertiary, fontSize: 11, fontWeight: "500" },
  orbitCardBio: { color: orbit.textSecond, fontSize: 13, lineHeight: 19 },
  orbitCardInterests: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  orbitCardChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: orbit.accentSoft,
  },
  orbitCardChipText: { color: orbit.accent, fontSize: 11, fontWeight: "600" },
  orbitCardStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    paddingTop: 12,
  },
  orbitCardStat: { flex: 1, alignItems: "center" },
  orbitCardStatVal: { color: orbit.textPrimary, fontSize: 15, fontWeight: "700" },
  orbitCardStatLbl: { color: orbit.textTertiary, fontSize: 10, fontWeight: "500", marginTop: 2 },
  orbitCardStatDivider: { width: 1, backgroundColor: orbit.borderSubtle, marginHorizontal: 8 },
  orbitCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: orbit.borderSubtle,
    paddingTop: 12,
  },
  orbitCardBrand: { flexDirection: "row", alignItems: "center", gap: 5 },
  orbitCardBrandText: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  orbitCardShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: orbit.accentSoft,
  },
  orbitCardShareText: { color: orbit.accent, fontSize: 12, fontWeight: "600" },

  /* Trust card */
  trustCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  trustHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trustHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  trustLabel: { color: orbit.textSecond, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  trustVal: { fontSize: 20, fontWeight: "700" },
  trustTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.surface3,
    marginTop: 10,
    overflow: "hidden",
  },
  trustFill: { height: "100%", borderRadius: 3 },

  /* Chips */
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  chipText: { color: orbit.textPrimary, fontSize: 12, fontWeight: "500" },
  trophy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: orbit.warningSoft,
  },
  trophyText: { color: orbit.warning, fontSize: 12, fontWeight: "600" },

  /* Meta */
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: orbit.textSecond, fontSize: 13, fontWeight: "500" },

  /* Empty */
  emptyTitle: { marginTop: 16, color: orbit.textPrimary, fontSize: 16, fontWeight: "600" },
  emptySub: { marginTop: 6, color: orbit.textSecond, fontSize: 14 },
});

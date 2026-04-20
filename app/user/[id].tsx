/**
 * ORBIT — User Profile Screen
 *
 * Route: /user/[id]  where id = target user's uid
 *
 * Shows someone else's public profile card — username, emoji, trust score,
 * karma, streak, interests, bio — and offers two actions:
 *
 *   • "Message" → ensures a DM thread exists + navigates to /dm/{threadId}
 *   • "Back"    → closes the vertical modal
 *
 * Phase 1 scope: read-only view. Follow / Block / Report flows land later.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Avatar, TierPill } from "@/components/shared";
import { orbit } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getUser, type UserDoc } from "@/lib/firestore-users";
import { ensureThread } from "@/lib/firestore-dms";

/* ─────────────────────────────────────────────────────────────────────
   Small presentational helpers
───────────────────────────────────────────────────────────────────── */

function StatBox({ val, lbl }: { val: string | number; lbl: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{typeof val === "number" ? val.toLocaleString("en-IN") : val}</Text>
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
        <View style={[styles.trustFill, { width: `${Math.min(100, Math.max(0, score))}%` as any, backgroundColor: color }]} />
      </View>
    </View>
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      try {
        const doc = await getUser(id);
        if (!cancelled) setTarget(doc);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const isMe = firebaseUser?.uid === id;

  const openDM = async () => {
    if (!me || !target || !firebaseUser || openingDM) return;
    if (isMe) return;
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

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  if (!target) {
    return (
      <View style={[styles.screen, { backgroundColor: orbit.bg }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
            <Feather name="x" size={24} color={orbit.textPrimary} />
          </TouchableOpacity>
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
  const tier: "LEGEND" | "MASTER" | "PRO" | "RISING" =
    target.badge === "LEGEND" ? "LEGEND" :
    target.badge === "MASTER" || target.badge === "CHAMPION" ? "MASTER" :
    target.badge === "PRO" ? "PRO" :
    "RISING";

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
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
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
          {!isMe && (
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

              <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
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
          <StatBox val={target.streak ?? 0} lbl="Day Streak" />
          <View style={styles.statDivider} />
          <StatBox val={target.posts ?? 0} lbl="Posts" />
        </View>

        {/* ── TRUST SCORE ────────────────────────────────────────── */}
        <View style={styles.section}>
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

  /* Header */
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

  /* Identity block */
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
  tierRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: orbit.warningSoft,
  },
  rankText: {
    color: orbit.warning,
    fontSize: 12,
    fontWeight: "600",
  },
  bio: {
    marginTop: 14,
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  /* Actions */
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
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
  primaryBtnText: {
    color: orbit.white,
    fontSize: 14,
    fontWeight: "600",
  },
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
  secondaryBtnText: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },

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
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  statLbl: {
    marginTop: 2,
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: orbit.borderSubtle,
  },

  /* Section */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 12,
  },

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
  trustHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustLabel: {
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  trustVal: {
    fontSize: 20,
    fontWeight: "700",
  },
  trustTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.surface3,
    marginTop: 10,
    overflow: "hidden",
  },
  trustFill: {
    height: "100%",
    borderRadius: 3,
  },

  /* Chips */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  chipText: {
    color: orbit.textPrimary,
    fontSize: 12,
    fontWeight: "500",
  },
  trophy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: orbit.warningSoft,
  },
  trophyText: {
    color: orbit.warning,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Meta row */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: "500",
  },

  /* Empty state */
  emptyTitle: {
    marginTop: 16,
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  emptySub: {
    marginTop: 6,
    color: orbit.textSecond,
    fontSize: 14,
  },
});

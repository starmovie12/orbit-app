/**
 * ORBIT — Admin Dashboard (app/admin/index.tsx)
 *
 * Features:
 *   • Strict admin role check via Firebase custom claim `role: "admin"`
 *   • Stats cards: total users, pending reports, banned users, credits in circulation
 *   • Reports queue preview — latest 5 pending reports
 *   • Banned users list — latest 10 bans
 *   • Credit audit section — top users by credits balance
 *
 * Firestore collections consumed:
 *   /users          — user count + banned flag + credits
 *   /reports        — pending user-submitted reports
 *   /adminQueue     — auto-flagged content (badge count only)
 *   /bannedUsers    — permanent ban log
 *
 * Access: Firebase Auth custom claim  { role: "admin" }
 *   Set via:  admin.auth().setCustomUserClaims(uid, { role: "admin" })
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Avatar, Divider, ScreenHeader } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import type { UserDoc } from '@/lib/firestore-users';

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type AdminStats = {
  totalUsers:    number;
  pendingReports: number;
  bannedUsers:   number;
  queueItems:    number;
  creditsTotal:  number;
};

type ReportItem = {
  id:          string;
  reason:      string;
  reportedUid: string;
  reporterUid: string;
  status:      string;
  createdAt:   any;
  context:     { type: string; id: string };
};

type BannedUser = {
  id:           string;
  uid:          string;
  username:     string | null;
  phone:        string;
  reason:       string;
  bannedAt:     any;
  bannedBy:     string;
};

type CreditAuditEntry = {
  uid:         string;
  username:    string | null;
  displayName: string | null;
  credits:     number;
  karma:       number;
  trustScore:  number;
};

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */

function snapExists(s: any): boolean {
  return typeof s.exists === 'function' ? s.exists() : !!s.exists;
}

function fmtTs(ts: any): string {
  if (!ts) return '—';
  const d: Date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return `${dy}d ago`;
}

const REASON_LABEL: Record<string, string> = {
  spam:          'Spam',
  abuse:         'Abuse / Harassment',
  csam:          'CSAM',
  impersonation: 'Impersonation',
  violence:      'Violence / Threats',
  doxxing:       'Doxxing',
};

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function AdminDashboard() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { firebaseUser, user } = useAuth();

  /* ── Admin gate ────────────────────────────────────────────── */
  const [isAdmin,      setIsAdmin]      = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    if (!firebaseUser) { setIsAdmin(false); setAuthChecking(false); return; }
    firebaseUser.getIdTokenResult(true)
      .then((result) => {
        setIsAdmin(result.claims.role === 'admin');
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setAuthChecking(false));
  }, [firebaseUser]);

  /* ── Data state ────────────────────────────────────────────── */
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [stats,        setStats]        = useState<AdminStats>({
    totalUsers: 0, pendingReports: 0, bannedUsers: 0, queueItems: 0, creditsTotal: 0,
  });
  const [reports,      setReports]      = useState<ReportItem[]>([]);
  const [bannedList,   setBannedList]   = useState<BannedUser[]>([]);
  const [creditAudit,  setCreditAudit]  = useState<CreditAuditEntry[]>([]);

  /* ── Load data ──────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const db = firestore();

      // Parallel fetch
      const [
        usersSnap,
        reportsSnap,
        queueSnap,
        bannedSnap,
        creditSnap,
      ] = await Promise.all([
        db.collection('users').get(),
        db.collection('reports').where('status', '==', 'pending')
          .orderBy('createdAt', 'desc').limit(5).get(),
        db.collection('adminQueue').where('status', '==', 'pending').get(),
        db.collection('bannedUsers').orderBy('bannedAt', 'desc').limit(10).get(),
        db.collection('users').orderBy('credits', 'desc').limit(10).get(),
      ]);

      // Stats
      let totalCredits = 0;
      let bannedCount  = 0;
      usersSnap.docs.forEach((d) => {
        const u = d.data() as UserDoc;
        totalCredits += u.credits ?? 0;
        if ((u as any).banned) bannedCount++;
      });

      setStats({
        totalUsers:     usersSnap.size,
        pendingReports: reportsSnap.size,
        bannedUsers:    bannedSnap.size > 0 ? bannedSnap.size : bannedCount,
        queueItems:     queueSnap.size,
        creditsTotal:   totalCredits,
      });

      // Reports
      setReports(
        reportsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      );

      // Banned users
      if (bannedSnap.size > 0) {
        setBannedList(
          bannedSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        );
      } else {
        // Fallback: read from users where banned === true
        const bannedUsersSnap = await db.collection('users')
          .where('banned', '==', true).limit(10).get();
        setBannedList(
          bannedUsersSnap.docs.map((d) => {
            const u = d.data() as any;
            return {
              id:       d.id,
              uid:      u.uid ?? d.id,
              username: u.username ?? null,
              phone:    u.phone ?? '',
              reason:   u.banReason ?? 'Policy violation',
              bannedAt: u.bannedAt ?? u.updatedAt,
              bannedBy: u.bannedBy ?? 'system',
            };
          })
        );
      }

      // Credit audit
      setCreditAudit(
        creditSnap.docs.map((d) => {
          const u = d.data() as UserDoc;
          return {
            uid:         u.uid,
            username:    u.username,
            displayName: u.displayName,
            credits:     u.credits,
            karma:       u.karma,
            trustScore:  u.trustScore,
          };
        })
      );
    } catch (err: any) {
      console.error('[Admin] loadData error:', err);
      Alert.alert('Error', err?.message ?? 'Failed to load admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  /* ── Unban action ───────────────────────────────────────────── */
  const handleUnban = useCallback((item: BannedUser) => {
    Alert.alert(
      'Unban User',
      `Unban @${item.username ?? item.uid}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unban',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = firestore();
              await db.collection('users').doc(item.uid)
                .update({ banned: false, bannedAt: null, banReason: null });
              if (item.id !== item.uid) {
                await db.collection('bannedUsers').doc(item.id).delete();
              }
              loadData();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Unban failed.');
            }
          },
        },
      ]
    );
  }, [loadData]);

  /* ── Render guards ──────────────────────────────────────────── */
  if (authChecking) {
    return (
      <View style={[styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  if (!firebaseUser) {
    return (
      <View style={[styles.center, { backgroundColor: orbit.bg }]}>
        <Feather name="lock" size={40} color={orbit.textTertiary} />
        <Text style={styles.gateTitle}>Not signed in</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/welcome' as never)}
          style={styles.gateBtn}>
          <Text style={styles.gateBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isAdmin === false) {
    return (
      <View style={[styles.center, { backgroundColor: orbit.bg }]}>
        <Feather name="shield-off" size={40} color={orbit.danger} />
        <Text style={styles.gateTitle}>Access Denied</Text>
        <Text style={styles.gateSub}>Admin privileges required.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.gateBtn}>
          <Text style={styles.gateBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
        <Text style={[styles.gateSub, { marginTop: 12 }]}>Loading dashboard…</Text>
      </View>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title="Admin"
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={() => router.push('/admin/queue' as never)}
            style={styles.queueBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Moderation queue"
          >
            <Feather name="list" size={20} color={orbit.textPrimary} />
            {stats.queueItems > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {stats.queueItems > 99 ? '99+' : stats.queueItems}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={orbit.accent}
          />
        }
      >
        {/* ── Stats Grid ── */}
        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="users"        label="Total Users"   value={stats.totalUsers.toLocaleString()} tint={orbit.accent} />
          <StatCard icon="flag"         label="Reports"       value={stats.pendingReports.toString()}    tint={orbit.warning} />
          <StatCard icon="slash"        label="Banned"        value={stats.bannedUsers.toString()}       tint={orbit.danger} />
          <StatCard icon="inbox"        label="Queue Items"   value={stats.queueItems.toString()}        tint={orbit.textSecond} />
          <StatCard icon="zap"          label="Credits Out"   value={stats.creditsTotal.toLocaleString()} tint={orbit.success} />
          <StatCard icon="activity"     label="Mod Queue"     value={stats.queueItems.toString()}
            tint={orbit.accent}
            onPress={() => router.push('/admin/queue' as never)}
          />
        </View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <ActionBtn icon="list"       label="Mod Queue"    onPress={() => router.push('/admin/queue' as never)}    tint={orbit.accent} />
          <ActionBtn icon="search"     label="User Lookup"  onPress={() => Alert.alert('Coming soon', 'User search screen')} tint={orbit.textSecond} />
          <ActionBtn icon="alert-triangle" label="Alerts"  onPress={() => Alert.alert('Coming soon', 'System alerts')} tint={orbit.warning} />
        </View>

        {/* ── Reports Queue Preview ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>PENDING REPORTS</Text>
          <TouchableOpacity onPress={() => router.push('/admin/queue' as never)} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="check-circle" size={28} color={orbit.success} />
            <Text style={styles.emptyText}>No pending reports</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {reports.map((item, idx) => (
              <React.Fragment key={item.id}>
                <ReportRow item={item} />
                {idx < reports.length - 1 && <Divider inset={56} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Banned Users ── */}
        <Text style={styles.sectionLabel}>BANNED USERS</Text>
        {bannedList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="user-check" size={28} color={orbit.success} />
            <Text style={styles.emptyText}>No banned users</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {bannedList.map((item, idx) => (
              <React.Fragment key={item.id}>
                <BannedRow item={item} onUnban={handleUnban} />
                {idx < bannedList.length - 1 && <Divider inset={56} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Credit Audit ── */}
        <Text style={styles.sectionLabel}>CREDIT AUDIT — TOP HOLDERS</Text>
        <View style={styles.card}>
          <View style={styles.auditHeader}>
            <Text style={[styles.auditCol, { flex: 2 }]}>USER</Text>
            <Text style={styles.auditCol}>CREDITS</Text>
            <Text style={styles.auditCol}>KARMA</Text>
            <Text style={styles.auditCol}>TRUST</Text>
          </View>
          <Divider />
          {creditAudit.map((entry, idx) => (
            <React.Fragment key={entry.uid}>
              <CreditAuditRow entry={entry} rank={idx + 1} />
              {idx < creditAudit.length - 1 && <Divider inset={48} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footer}>
          Orbit Admin · {user?.displayName ?? user?.username ?? '—'}
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────── */

function StatCard({
  icon, label, value, tint, onPress,
}: {
  icon: any; label: string; value: string; tint: string; onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.statIcon, { backgroundColor: tint + '1A' }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Wrapper>
  );
}

function ActionBtn({
  icon, label, onPress, tint,
}: {
  icon: any; label: string; onPress: () => void; tint: string;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, { backgroundColor: tint + '1A' }]}>
        <Feather name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReportRow({ item }: { item: ReportItem }) {
  const reasonLabel = REASON_LABEL[item.reason] ?? item.reason;
  return (
    <View style={styles.rowWrap}>
      <View style={[styles.rowIcon, { backgroundColor: orbit.warningSoft }]}>
        <Feather name="flag" size={16} color={orbit.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {reasonLabel}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          Reported uid: {item.reportedUid?.slice(0, 8)}…  ·  {fmtTs(item.createdAt)}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: orbit.warningSoft }]}>
        <Text style={[styles.statusText, { color: orbit.warning }]}>PENDING</Text>
      </View>
    </View>
  );
}

function BannedRow({
  item, onUnban,
}: {
  item: BannedUser; onUnban: (i: BannedUser) => void;
}) {
  const name = item.username ? `@${item.username}` : item.uid.slice(0, 10);
  return (
    <View style={styles.rowWrap}>
      <Avatar name={item.username ?? item.uid} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.reason ?? '—'}  ·  {fmtTs(item.bannedAt)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.unbanBtn}
        onPress={() => onUnban(item)}
        hitSlop={8}
      >
        <Text style={styles.unbanText}>Unban</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreditAuditRow({ entry, rank }: { entry: CreditAuditEntry; rank: number }) {
  const name = entry.username ? `@${entry.username}` : entry.uid.slice(0, 8);
  const trustColor =
    entry.trustScore >= 70 ? orbit.success :
    entry.trustScore >= 40 ? orbit.warning : orbit.danger;

  return (
    <View style={[styles.rowWrap, { paddingVertical: 10 }]}>
      <Text style={styles.auditRank}>{rank}</Text>
      <View style={{ flex: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        {entry.displayName && (
          <Text style={styles.rowSub} numberOfLines={1}>{entry.displayName}</Text>
        )}
      </View>
      <Text style={[styles.auditVal, { color: orbit.accent }]}>
        {entry.credits.toLocaleString()}
      </Text>
      <Text style={[styles.auditVal, { color: orbit.warning }]}>
        {entry.karma.toLocaleString()}
      </Text>
      <Text style={[styles.auditVal, { color: trustColor }]}>
        {entry.trustScore}
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: orbit.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: orbit.bg,
    gap: 12,
  },
  gateTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  gateSub: {
    color: orbit.textSecond,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  gateBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: orbit.accent,
  },
  gateBtnText: {
    color: orbit.white,
    fontWeight: '600',
    fontSize: 15,
  },
  /* header */
  queueBtn: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: orbit.danger,
    borderRadius: 99,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  badgeText: {
    color: orbit.white,
    fontSize: 10,
    fontWeight: '700',
  },
  /* section */
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  seeAll: {
    color: orbit.accent,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  /* stats */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: '31%',
    backgroundColor: orbit.surface1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    gap: 8,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  /* actions */
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: orbit.surface1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    gap: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  /* card */
  card: {
    marginHorizontal: 16,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: orbit.textTertiary,
    fontSize: 14,
  },
  /* rows */
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSub: {
    color: orbit.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  unbanBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: orbit.successSoft,
  },
  unbanText: {
    color: orbit.success,
    fontSize: 12,
    fontWeight: '600',
  },
  /* audit table */
  auditHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  auditCol: {
    flex: 1,
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  auditRank: {
    width: 28,
    color: orbit.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  auditVal: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  /* footer */
  footer: {
    color: orbit.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});

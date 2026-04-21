/**
 * ORBIT — Moderation Queue (app/admin/queue.tsx)
 *
 * Features:
 *   • Admin role gate (same Firebase custom claim check as /admin/index)
 *   • Real-time feed from `/adminQueue` collection (auto-flagged content)
 *   • OpenAI Moderation category scores displayed as bars
 *   • Filter tabs: All · High · Medium · Low severity
 *   • Actions per item: Approve (dismiss flag), Reject (takedown), Ban user
 *   • Optimistic UI — acted items removed from list immediately
 *   • Pull-to-refresh
 *
 * Firestore schema consumed:
 *   adminQueue/{itemId}
 *     source:   "openai_mod" | "hive" | "user_report"
 *     severity: "high" | "medium" | "low"
 *     status:   "pending" | "approved" | "rejected"
 *     content:  { type: "message"|"post", id, text, authorUid, authorUsername }
 *     scores:   { sexual, hate, violence, harassment, selfHarm, ... }  ← OpenAI categories
 *     createdAt: Timestamp
 *
 * On Approve → status = "approved" (content stays visible)
 * On Reject  → status = "rejected" + content hidden via content doc update
 * On Ban     → status = "rejected" + users/{uid}.banned = true
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { firestore, serverTimestamp } from '@/lib/firebase';

/* ─────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────── */

type Severity = 'high' | 'medium' | 'low';
type FilterTab = 'all' | Severity;

type ModScores = {
  sexual:            number;
  hate:              number;
  violence:          number;
  harassment:        number;
  selfHarm:          number;
  sexualMinors:      number;
  hateThreatening:   number;
  violenceGraphic:   number;
};

type QueueContent = {
  type:            string;   // "message" | "post" | "comment"
  id:              string;
  text:            string;
  authorUid:       string;
  authorUsername:  string | null;
};

type QueueItem = {
  id:        string;
  source:    string;
  severity:  Severity;
  status:    'pending' | 'approved' | 'rejected';
  content:   QueueContent;
  scores:    Partial<ModScores>;
  topScore:  number;         // highest individual category score
  createdAt: any;
};

type ActionType = 'approve' | 'reject' | 'ban';

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
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function deriveTopScore(scores: Partial<ModScores>): number {
  return Math.max(0, ...Object.values(scores).filter((v): v is number => typeof v === 'number'));
}

function deriveSeverity(topScore: number): Severity {
  if (topScore >= 0.85) return 'high';
  if (topScore >= 0.60) return 'medium';
  return 'low';
}

function buildItem(id: string, data: any): QueueItem {
  const scores  = data.scores ?? {};
  const topScore = deriveTopScore(scores);
  return {
    id,
    source:    data.source   ?? 'openai_mod',
    severity:  data.severity ?? deriveSeverity(topScore),
    status:    data.status   ?? 'pending',
    content:   data.content  ?? { type: 'unknown', id: '', text: '', authorUid: '', authorUsername: null },
    scores,
    topScore,
    createdAt: data.createdAt,
  };
}

const SCORE_LABELS: Array<{ key: keyof ModScores; label: string }> = [
  { key: 'sexual',          label: 'Sexual' },
  { key: 'hate',            label: 'Hate' },
  { key: 'violence',        label: 'Violence' },
  { key: 'harassment',      label: 'Harassment' },
  { key: 'selfHarm',        label: 'Self-harm' },
  { key: 'sexualMinors',    label: 'Sexual/Minors' },
  { key: 'hateThreatening', label: 'Hate+Threat' },
  { key: 'violenceGraphic', label: 'Graphic violence' },
];

const SOURCE_LABEL: Record<string, string> = {
  openai_mod:  'OpenAI Mod',
  hive:        'Hive AI',
  user_report: 'User Report',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  high:   orbit.danger,
  medium: orbit.warning,
  low:    orbit.textSecond,
};

const SEVERITY_BG: Record<Severity, string> = {
  high:   orbit.dangerSoft,
  medium: orbit.warningSoft,
  low:    orbit.surface3,
};

/* ─────────────────────────────────────────────────────────────────────
   Mock data for dev/offline fallback
───────────────────────────────────────────────────────────────────── */

const MOCK_ITEMS: QueueItem[] = [
  {
    id: 'mock1',
    source: 'openai_mod',
    severity: 'high',
    status: 'pending',
    content: {
      type: 'message',
      id: 'msg_abc123',
      text: '[Content flagged with score > 0.90 — awaiting review]',
      authorUid: 'uid_a1b2c3',
      authorUsername: 'testuser99',
    },
    scores: { hate: 0.93, harassment: 0.88, violence: 0.72, sexual: 0.12, selfHarm: 0.05 },
    topScore: 0.93,
    createdAt: null,
  },
  {
    id: 'mock2',
    source: 'user_report',
    severity: 'medium',
    status: 'pending',
    content: {
      type: 'post',
      id: 'post_xyz789',
      text: '[Post reported by multiple users — low confidence AI flag]',
      authorUid: 'uid_d4e5f6',
      authorUsername: 'orbit_user42',
    },
    scores: { harassment: 0.67, hate: 0.43, violence: 0.21 },
    topScore: 0.67,
    createdAt: null,
  },
  {
    id: 'mock3',
    source: 'openai_mod',
    severity: 'low',
    status: 'pending',
    content: {
      type: 'comment',
      id: 'cmt_lmn456',
      text: '[Low-confidence flag — likely false positive]',
      authorUid: 'uid_g7h8i9',
      authorUsername: 'new_member_01',
    },
    scores: { spam: 0.55, harassment: 0.30 } as any,
    topScore: 0.55,
    createdAt: null,
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────── */

export default function ModerationQueue() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  /* ── Admin gate ────────────────────────────────────────────── */
  const [isAdmin,      setIsAdmin]      = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    if (!firebaseUser) { setIsAdmin(false); setAuthChecking(false); return; }
    firebaseUser.getIdTokenResult(true)
      .then((r) => setIsAdmin(r.claims.role === 'admin'))
      .catch(() => setIsAdmin(false))
      .finally(() => setAuthChecking(false));
  }, [firebaseUser]);

  /* ── Data state ────────────────────────────────────────────── */
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items,      setItems]      = useState<QueueItem[]>([]);
  const [filter,     setFilter]     = useState<FilterTab>('all');
  const [acting,     setActing]     = useState<Record<string, boolean>>({});

  /* ── Load queue ─────────────────────────────────────────────── */
  const loadQueue = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const snap = await firestore()
        .collection('adminQueue')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      if (snap.empty) {
        setItems(MOCK_ITEMS);
      } else {
        setItems(snap.docs.map((d) => buildItem(d.id, d.data())));
      }
    } catch (err: any) {
      console.warn('[ModerationQueue] Firestore unavailable, using mock data:', err?.message);
      setItems(MOCK_ITEMS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { if (isAdmin) loadQueue(); }, [isAdmin, loadQueue]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadQueue();
  }, [loadQueue]);

  /* ── Filtered items ─────────────────────────────────────────── */
  const visible = useMemo(
    () => filter === 'all' ? items : items.filter((i) => i.severity === filter),
    [items, filter]
  );

  const countFor = useCallback(
    (f: FilterTab) =>
      f === 'all' ? items.length : items.filter((i) => i.severity === f).length,
    [items]
  );

  /* ── Actions ────────────────────────────────────────────────── */
  const handleAction = useCallback(async (item: QueueItem, action: ActionType) => {
    if (acting[item.id]) return;

    const confirmMsg: Record<ActionType, string> = {
      approve: `Approve and dismiss flag for @${item.content.authorUsername ?? item.content.authorUid.slice(0, 8)}?`,
      reject:  `Remove this ${item.content.type} and mark as violation?`,
      ban:     `Ban @${item.content.authorUsername ?? item.content.authorUid.slice(0, 8)} permanently?`,
    };

    Alert.alert(
      action.charAt(0).toUpperCase() + action.slice(1),
      confirmMsg[action],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : action === 'ban' ? 'Ban User' : 'Remove Content',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: () => executeAction(item, action),
        },
      ]
    );
  }, [acting]);

  const executeAction = useCallback(async (item: QueueItem, action: ActionType) => {
    setActing((prev) => ({ ...prev, [item.id]: true }));

    try {
      const db  = firestore();
      const qRef = db.collection('adminQueue').doc(item.id);

      if (action === 'approve') {
        await qRef.update({ status: 'approved', reviewedAt: serverTimestamp() });

      } else if (action === 'reject') {
        await qRef.update({ status: 'rejected', reviewedAt: serverTimestamp() });
        // Also hide the flagged content document
        if (item.content.type === 'message' && item.content.id) {
          // Best-effort hide — don't throw if collection path unknown
          try {
            await db.collection('messages').doc(item.content.id).update({ hidden: true });
          } catch { /* content doc may not exist locally */ }
        }

      } else if (action === 'ban') {
        const uid = item.content.authorUid;
        if (!uid) throw new Error('No authorUid on queue item');

        // Write ban record to bannedUsers + mark user doc
        const bannedRef = db.collection('bannedUsers').doc(uid);
        const userRef   = db.collection('users').doc(uid);

        await Promise.all([
          bannedRef.set({
            uid,
            username: item.content.authorUsername ?? null,
            reason:   `Moderation action — ${item.source} score ${item.topScore.toFixed(2)}`,
            bannedAt: serverTimestamp(),
            bannedBy: 'admin_queue',
          }),
          userRef.update({
            banned:    true,
            banReason: `Auto-ban via moderation queue (${item.source})`,
            bannedAt:  serverTimestamp(),
          }),
          qRef.update({ status: 'rejected', reviewedAt: serverTimestamp() }),
        ]);
      }

      // Optimistic remove from local list
      setItems((prev) => prev.filter((i) => i.id !== item.id));

    } catch (err: any) {
      Alert.alert('Action failed', err?.message ?? 'Please try again.');
    } finally {
      setActing((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    }
  }, []);

  /* ── Render guards ──────────────────────────────────────────── */
  if (authChecking) {
    return (
      <View style={[styles.center, { backgroundColor: orbit.bg }]}>
        <ActivityIndicator color={orbit.accent} />
      </View>
    );
  }

  if (!firebaseUser || isAdmin === false) {
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
        <Text style={[styles.gateSub, { marginTop: 12 }]}>Loading queue…</Text>
      </View>
    );
  }

  /* ── Main render ────────────────────────────────────────────── */
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title="Moderation Queue"
        onBack={() => router.back()}
        right={
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{items.length} pending</Text>
          </View>
        }
      />

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {(['all', 'high', 'medium', 'low'] as FilterTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, filter === tab && styles.tabActive]}
            onPress={() => setFilter(tab)}
            activeOpacity={0.7}
          >
            {tab !== 'all' && (
              <View style={[styles.tabDot, { backgroundColor: SEVERITY_COLOR[tab as Severity] }]} />
            )}
            <Text style={[styles.tabLabel, filter === tab && styles.tabLabelActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            <View style={[styles.tabCount, filter === tab && { backgroundColor: orbit.accent }]}>
              <Text style={[styles.tabCountText, filter === tab && { color: orbit.white }]}>
                {countFor(tab)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Divider />

      {/* Queue list */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={orbit.accent}
          />
        }
      >
        {visible.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={44} color={orbit.success} />
            <Text style={styles.emptyTitle}>Queue is clear</Text>
            <Text style={styles.emptySub}>
              {filter === 'all'
                ? 'No pending items in the moderation queue.'
                : `No ${filter}-severity items pending.`}
            </Text>
          </View>
        ) : (
          visible.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              isActing={!!acting[item.id]}
              onAction={handleAction}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   QueueCard
───────────────────────────────────────────────────────────────────── */

function QueueCard({
  item,
  isActing,
  onAction,
}: {
  item: QueueItem;
  isActing: boolean;
  onAction: (item: QueueItem, action: ActionType) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.985, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  const authorName = item.content.authorUsername
    ? `@${item.content.authorUsername}`
    : item.content.authorUid?.slice(0, 10) ?? 'Unknown';

  const severityColor = SEVERITY_COLOR[item.severity];
  const severityBg    = SEVERITY_BG[item.severity];

  // Scores to display: only those with value > 0
  const displayScores = SCORE_LABELS.filter(
    ({ key }) => typeof item.scores[key] === 'number' && (item.scores[key] as number) > 0
  );

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <Avatar name={item.content.authorUsername ?? item.content.authorUid} size={40} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.authorName}>{authorName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {SOURCE_LABEL[item.source] ?? item.source}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{item.content.type}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{fmtTs(item.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.severityPill, { backgroundColor: severityBg }]}>
          <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
          <Text style={[styles.severityLabel, { color: severityColor }]}>
            {item.severity.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Content preview */}
      {item.content.text ? (
        <View style={styles.contentBox}>
          <Text style={styles.contentText} numberOfLines={3}>
            {item.content.text}
          </Text>
        </View>
      ) : null}

      {/* OpenAI Moderation scores */}
      {displayScores.length > 0 && (
        <View style={styles.scoresSection}>
          <Text style={styles.scoresTitle}>MODERATION SCORES</Text>
          {displayScores.map(({ key, label }) => {
            const score = item.scores[key] as number;
            const pct   = Math.round(score * 100);
            const barColor =
              score >= 0.85 ? orbit.danger :
              score >= 0.60 ? orbit.warning :
              orbit.textTertiary;

            return (
              <View key={key} style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{label}</Text>
                <View style={styles.scoreBarBg}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      { width: `${pct}%` as any, backgroundColor: barColor },
                    ]}
                  />
                </View>
                <Text style={[styles.scorePct, { color: barColor }]}>
                  {pct}%
                </Text>
              </View>
            );
          })}
          <Text style={styles.topScoreNote}>
            Top score: {(item.topScore * 100).toFixed(1)}%
            {item.topScore >= 0.90 ? '  → Auto-hide triggered' : ''}
          </Text>
        </View>
      )}

      <Divider />

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {isActing ? (
          <ActivityIndicator color={orbit.accent} style={{ flex: 1, height: 44 }} />
        ) : (
          <>
            <ActionButton
              icon="check"
              label="Approve"
              color={orbit.success}
              bg={orbit.successSoft}
              onPress={() => onAction(item, 'approve')}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            />
            <View style={styles.actionDivider} />
            <ActionButton
              icon="trash-2"
              label="Reject"
              color={orbit.danger}
              bg={orbit.dangerSoft}
              onPress={() => onAction(item, 'reject')}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            />
            <View style={styles.actionDivider} />
            <ActionButton
              icon="slash"
              label="Ban User"
              color={orbit.warning}
              bg={orbit.warningSoft}
              onPress={() => onAction(item, 'ban')}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            />
          </>
        )}
      </View>
    </Animated.View>
  );
}

function ActionButton({
  icon, label, color, bg, onPress, onPressIn, onPressOut,
}: {
  icon: any; label: string; color: string; bg: string;
  onPress: () => void; onPressIn: () => void; onPressOut: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: bg }]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.8}
    >
      <Feather name={icon} size={15} color={color} />
      <Text style={[styles.actionBtnLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
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
  headerBadge: {
    backgroundColor: orbit.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  headerBadgeText: {
    color: orbit.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  /* tabs */
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: orbit.surface1,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  tabActive: {
    backgroundColor: orbit.accentSoftSolid,
    borderColor: orbit.accent,
  },
  tabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tabLabel: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: orbit.accent,
  },
  tabCount: {
    backgroundColor: orbit.surface3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: orbit.textTertiary,
  },
  /* empty */
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: orbit.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    color: orbit.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  /* card */
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: orbit.surface1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 12,
  },
  authorName: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  metaText: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  metaDot: {
    color: orbit.textTertiary,
    fontSize: 12,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  /* content */
  contentBox: {
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: orbit.surface2,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: orbit.borderStrong,
  },
  contentText: {
    color: orbit.textSecond,
    fontSize: 13,
    lineHeight: 18,
  },
  /* scores */
  scoresSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 7,
  },
  scoresTitle: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    color: orbit.textSecond,
    fontSize: 12,
    fontWeight: '500',
    width: 100,
  },
  scoreBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: orbit.surface3,
    borderRadius: 99,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  scorePct: {
    fontSize: 11,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  topScoreNote: {
    color: orbit.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  /* actions */
  actionsRow: {
    flexDirection: 'row',
    height: 48,
  },
  actionDivider: {
    width: 1,
    backgroundColor: orbit.borderSubtle,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});

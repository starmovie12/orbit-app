/**
 * ORBIT — Challenge Detail + Entry Screen (app/challenges/[id].tsx)
 *
 * Route: /challenges/[id]  where id = Firestore document id in /challenges/{id}
 *
 * Features:
 *   • Fetches challenge doc from Firestore /challenges/{id}
 *   • Media upload via expo-image-picker (photo or video) + caption field
 *   • Submit entry → writes to /challenges/{id}/entries/{uid}
 *   • Displays all entries in a FlatList sorted by votes DESC
 *   • Vote on any entry → Firestore increment on /challenges/{id}/entries/{entryId}
 *   • Live vote count — real-time subscription keeps votes updated
 *   • Own-entry guard — user can't vote on their own entry
 *   • One vote per entry per user (stored in votedBy array on entry doc)
 *   • Already-submitted guard — if user has entry, shows it pinned at top
 *
 * Firestore schema:
 *   /challenges/{id}
 *     title, category, prompt, prizeCredits, icon, endsAt
 *   /challenges/{id}/entries/{entryId}  (entryId = submitting uid)
 *     author: { uid, username }, mediaUri, caption, votes, votedBy[], createdAt
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Avatar, Divider, IconBox, ScreenHeader, TierPill } from '@/components/shared';
import { orbit } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore, serverTimestamp } from '@/lib/firebase';
import { WEEKLY_CHALLENGES } from '@/constants/data';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const CHALLENGES_COL = 'challenges';
const ENTRIES_COL    = 'entries';
const ENTRIES_LIMIT  = 50;

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ChallengeDoc = {
  id:           string;
  title:        string;
  category:     string;
  prompt:       string;
  icon:         string;
  prizeCredits: number;
  endsAt:       number; // epoch ms
};

type EntryDoc = {
  id:       string;
  authorUid:      string;
  authorUsername: string;
  mediaUri:   string | null;
  mediaType:  'image' | 'video' | null;
  caption:    string;
  votes:      number;
  votedBy:    string[];
  createdAt:  unknown;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function snapExists(s: any): boolean {
  return typeof s.exists === 'function' ? s.exists() : !!s.exists;
}

function msUntilNextSunday(): number {
  const istOffset = 330 * 60 * 1000;
  const nowIST    = new Date(Date.now() + istOffset);
  const dayIST    = nowIST.getUTCDay();
  const daysLeft  = dayIST === 0 ? 7 : 7 - dayIST;
  const nextSun   = new Date(nowIST);
  nextSun.setUTCDate(nowIST.getUTCDate() + daysLeft);
  nextSun.setUTCHours(0, 0, 0, 0);
  return nextSun.getTime() - nowIST.getTime();
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Ended';
  const total = Math.floor(ms / 1000);
  const d     = Math.floor(total / 86400);
  const h     = Math.floor((total % 86400) / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function fmtTimeLeft(endsAt: number): string {
  return fmtCountdown(Math.max(0, endsAt - Date.now()));
}

function buildMockChallenge(id: string): ChallengeDoc {
  const found = WEEKLY_CHALLENGES.find((c) => c.id === id);
  if (found) {
    return {
      id:           found.id,
      title:        found.title,
      category:     found.category,
      prompt:       `Submit your best ${found.title.toLowerCase()} entry!`,
      icon:         found.icon,
      prizeCredits: found.prize,
      endsAt:       Date.now() + 2 * 86_400_000,
    };
  }
  return {
    id,
    title:        'Weekly Challenge',
    category:     'General',
    prompt:       'Submit your best entry for a chance to win!',
    icon:         'target',
    prizeCredits: 500,
    endsAt:       Date.now() + 2 * 86_400_000,
  };
}

function buildMockEntries(): EntryDoc[] {
  return [
    { id: 'e1', authorUid: 'u1', authorUsername: 'ghost_player',  mediaUri: null, mediaType: null, caption: 'My entry — came from nowhere!',   votes: 84,  votedBy: [], createdAt: null },
    { id: 'e2', authorUid: 'u2', authorUsername: 'sk_promo99',    mediaUri: null, mediaType: null, caption: 'Check out what I made this week',  votes: 62,  votedBy: [], createdAt: null },
    { id: 'e3', authorUid: 'u3', authorUsername: 'new_artist99',  mediaUri: null, mediaType: null, caption: 'Worked 3 days on this 🔥',         votes: 48,  votedBy: [], createdAt: null },
    { id: 'e4', authorUid: 'u4', authorUsername: 'lens_wala',     mediaUri: null, mediaType: null, caption: 'Shot at sunrise in CP, Delhi',     votes: 35,  votedBy: [], createdAt: null },
    { id: 'e5', authorUid: 'u5', authorUsername: 'aimgod_47',     mediaUri: null, mediaType: null, caption: 'Clutch plays don\'t lie',           votes: 21,  votedBy: [], createdAt: null },
  ];
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function ChallengeHeader({
  challenge,
  timeLeft,
}: {
  challenge: ChallengeDoc;
  timeLeft: string;
}) {
  return (
    <View style={styles.challengeHeader}>
      <View style={styles.challengeHeaderTop}>
        <IconBox icon={challenge.icon as any} size={48} tint={orbit.accent} variant="circle" />
        <View style={styles.challengeHeaderBody}>
          <View style={styles.categoryRow}>
            <Text style={styles.categoryTag}>{challenge.category}</Text>
          </View>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
        </View>
      </View>

      <Text style={styles.challengePrompt}>{challenge.prompt}</Text>

      <View style={styles.challengeMetaRow}>
        <View style={styles.metaChip}>
          <Feather name="zap" size={12} color={orbit.accent} />
          <Text style={styles.metaChipText}>+{challenge.prizeCredits} credits prize</Text>
        </View>
        <View style={styles.metaChip}>
          <Feather name="clock" size={12} color={orbit.warning} />
          <Text style={[styles.metaChipText, { color: orbit.warning }]}>{timeLeft} left</Text>
        </View>
      </View>
    </View>
  );
}

function SubmitEntryPanel({
  hasEntry,
  myEntry,
  onSubmit,
  submitting,
}: {
  hasEntry:   boolean;
  myEntry:    EntryDoc | null;
  onSubmit:   (mediaUri: string | null, mediaType: 'image' | 'video' | null, caption: string) => Promise<void>;
  submitting: boolean;
}) {
  const [caption,   setCaption]   = useState(myEntry?.caption ?? '');
  const [mediaUri,  setMediaUri]  = useState<string | null>(myEntry?.mediaUri ?? null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(myEntry?.mediaType ?? null);
  const [picking,   setPicking]   = useState(false);
  const [expanded,  setExpanded]  = useState(!hasEntry);

  const handlePickMedia = useCallback(async (type: 'image' | 'video') => {
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media access to upload your entry.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image'
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
        quality: 0.85,
        allowsEditing: true,
        aspect: type === 'image' ? [4, 3] : undefined,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets.length > 0) {
        setMediaUri(result.assets[0].uri);
        setMediaType(type);
      }
    } catch {
      Alert.alert('Error', 'Media pick failed. Try again.');
    } finally {
      setPicking(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!caption.trim() && !mediaUri) {
      Alert.alert('Empty entry', 'Add a caption or media before submitting.');
      return;
    }
    await onSubmit(mediaUri, mediaType, caption.trim());
  }, [caption, mediaUri, mediaType, onSubmit]);

  if (hasEntry && !expanded) {
    return (
      <TouchableOpacity
        style={styles.entrySubmittedBanner}
        onPress={() => setExpanded(true)}
        activeOpacity={0.75}
      >
        <Feather name="check-circle" size={16} color={orbit.success} />
        <Text style={styles.entrySubmittedText}>Entry submitted</Text>
        <Text style={styles.entrySubmittedEdit}>Edit</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.submitPanel}>
      <Text style={styles.submitPanelTitle}>
        {hasEntry ? 'Update Your Entry' : 'Submit Your Entry'}
      </Text>

      {/* Media preview */}
      {mediaUri && mediaType === 'image' ? (
        <View style={styles.mediaPreviewWrap}>
          <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
          <TouchableOpacity
            style={styles.mediaRemoveBtn}
            onPress={() => { setMediaUri(null); setMediaType(null); }}
          >
            <Feather name="x" size={14} color={orbit.white} />
          </TouchableOpacity>
        </View>
      ) : mediaUri && mediaType === 'video' ? (
        <View style={styles.mediaPreviewWrap}>
          <View style={styles.videoPreviewPlaceholder}>
            <Feather name="film" size={28} color={orbit.textTertiary} />
            <Text style={styles.videoPreviewText}>Video selected</Text>
          </View>
          <TouchableOpacity
            style={styles.mediaRemoveBtn}
            onPress={() => { setMediaUri(null); setMediaType(null); }}
          >
            <Feather name="x" size={14} color={orbit.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mediaPickRow}>
          <TouchableOpacity
            style={styles.mediaPickBtn}
            onPress={() => handlePickMedia('image')}
            disabled={picking}
            activeOpacity={0.7}
          >
            <Feather name="image" size={18} color={orbit.accent} />
            <Text style={styles.mediaPickText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mediaPickBtn}
            onPress={() => handlePickMedia('video')}
            disabled={picking}
            activeOpacity={0.7}
          >
            <Feather name="video" size={18} color={orbit.accent} />
            <Text style={styles.mediaPickText}>Video</Text>
          </TouchableOpacity>
          <View style={styles.mediaPickOptional}>
            <Text style={styles.mediaPickOptionalText}>optional</Text>
          </View>
        </View>
      )}

      {/* Caption */}
      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCaption}
        placeholder="Add a caption for your entry…"
        placeholderTextColor={orbit.textTertiary}
        multiline
        maxLength={280}
        textAlignVertical="top"
      />
      <Text style={styles.captionCount}>{caption.length}/280</Text>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={orbit.textInverse} />
        ) : (
          <>
            <Feather name="send" size={15} color={orbit.textInverse} />
            <Text style={styles.submitBtnText}>
              {hasEntry ? 'Update Entry' : 'Submit Entry'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function EntryCard({
  entry,
  myUid,
  onVote,
  votingId,
}: {
  entry:    EntryDoc;
  myUid:    string | null;
  onVote:   (entryId: string) => void;
  votingId: string | null;
}) {
  const isOwn     = myUid === entry.authorUid;
  const hasVoted  = myUid ? entry.votedBy.includes(myUid) : false;
  const isVoting  = votingId === entry.id;

  return (
    <View style={[styles.entryCard, isOwn && styles.entryCardOwn]}>
      {/* Header */}
      <View style={styles.entryCardHeader}>
        <Avatar name={entry.authorUsername} size={36} />
        <View style={styles.entryCardMeta}>
          <Text style={styles.entryCardUsername}>{entry.authorUsername}</Text>
          {isOwn && (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>YOU</Text>
            </View>
          )}
        </View>
      </View>

      {/* Media */}
      {entry.mediaUri && entry.mediaType === 'image' && (
        <Image
          source={{ uri: entry.mediaUri }}
          style={styles.entryImage}
          resizeMode="cover"
        />
      )}
      {entry.mediaUri && entry.mediaType === 'video' && (
        <View style={styles.entryVideoPlaceholder}>
          <Feather name="play-circle" size={36} color={orbit.textTertiary} />
          <Text style={styles.entryVideoText}>Video entry</Text>
        </View>
      )}

      {/* Caption */}
      {!!entry.caption && (
        <Text style={styles.entryCaption}>{entry.caption}</Text>
      )}

      {/* Vote row */}
      <View style={styles.entryVoteRow}>
        <TouchableOpacity
          style={[
            styles.voteBtn,
            hasVoted && styles.voteBtnActive,
            (isOwn || isVoting) && styles.voteBtnDisabled,
          ]}
          onPress={() => !isOwn && !hasVoted && onVote(entry.id)}
          disabled={isOwn || hasVoted || isVoting}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={hasVoted ? 'Already voted' : 'Vote for this entry'}
        >
          {isVoting ? (
            <ActivityIndicator size="small" color={hasVoted ? orbit.accent : orbit.textTertiary} />
          ) : (
            <Feather
              name="thumbs-up"
              size={14}
              color={hasVoted ? orbit.accent : orbit.textTertiary}
            />
          )}
          <Text style={[styles.voteBtnText, hasVoted && styles.voteBtnTextActive]}>
            {entry.votes}
          </Text>
          {hasVoted && <Text style={styles.votedLabel}>Voted</Text>}
        </TouchableOpacity>

        {isOwn && (
          <Text style={styles.ownEntryNote}>Your entry — keep sharing to get votes!</Text>
        )}
      </View>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */

export default function ChallengeDetailScreen() {
  const { id }       = useLocalSearchParams<{ id: string }>();
  const insets       = useSafeAreaInsets();
  const router       = useRouter();
  const { firebaseUser, user } = useAuth();

  const myUid      = firebaseUser?.uid ?? null;
  const myUsername = user?.username ?? firebaseUser?.displayName ?? 'user';

  const [challenge,  setChallenge]  = useState<ChallengeDoc | null>(null);
  const [entries,    setEntries]    = useState<EntryDoc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [votingId,   setVotingId]   = useState<string | null>(null);
  const [timeLeft,   setTimeLeft]   = useState('');

  const challengeId = Array.isArray(id) ? id[0] : id;

  /* ── Countdown tick ── */
  useEffect(() => {
    if (!challenge) return;
    const update = () => setTimeLeft(fmtTimeLeft(challenge.endsAt));
    update();
    const tid = setInterval(update, 1000);
    return () => clearInterval(tid);
  }, [challenge?.endsAt]);

  /* ── Subscribe challenge doc ── */
  useEffect(() => {
    if (!challengeId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = firestore()
        .collection(CHALLENGES_COL)
        .doc(challengeId)
        .onSnapshot(
          (snap) => {
            if (!snapExists(snap)) {
              setChallenge(buildMockChallenge(challengeId));
            } else {
              const d = snap.data()!;
              setChallenge({
                id:           snap.id,
                title:        d.title ?? d.prompt ?? 'Challenge',
                category:     d.category ?? 'General',
                prompt:       d.prompt ?? 'Submit your best entry!',
                icon:         d.icon ?? 'target',
                prizeCredits: d.prizeCredits ?? d.prizeKarma ?? 500,
                endsAt:       typeof d.endsAt?.toMillis === 'function'
                                ? d.endsAt.toMillis()
                                : (d.endsAt ?? Date.now() + 86_400_000 * 2),
              });
            }
            setLoading(false);
          },
          () => {
            setChallenge(buildMockChallenge(challengeId));
            setLoading(false);
          },
        );
    } catch {
      setChallenge(buildMockChallenge(challengeId));
      setLoading(false);
    }
    return () => unsub?.();
  }, [challengeId]);

  /* ── Subscribe entries ── */
  useEffect(() => {
    if (!challengeId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = firestore()
        .collection(CHALLENGES_COL)
        .doc(challengeId)
        .collection(ENTRIES_COL)
        .orderBy('votes', 'desc')
        .limit(ENTRIES_LIMIT)
        .onSnapshot(
          (qs) => {
            if (qs.empty) {
              setEntries(buildMockEntries());
              return;
            }
            const list: EntryDoc[] = [];
            qs.forEach((doc) => {
              const d = doc.data();
              list.push({
                id:             doc.id,
                authorUid:      d.author?.uid ?? d.authorUid ?? '',
                authorUsername: d.author?.username ?? d.authorUsername ?? 'user',
                mediaUri:       d.mediaUri ?? null,
                mediaType:      d.mediaType ?? null,
                caption:        d.caption ?? '',
                votes:          d.votes ?? 0,
                votedBy:        d.votedBy ?? [],
                createdAt:      d.createdAt,
              });
            });
            setEntries(list);
          },
          () => setEntries(buildMockEntries()),
        );
    } catch {
      setEntries(buildMockEntries());
    }
    return () => unsub?.();
  }, [challengeId]);

  /* ── Submit entry ── */
  const handleSubmit = useCallback(async (
    mediaUri: string | null,
    mediaType: 'image' | 'video' | null,
    caption: string,
  ) => {
    if (!myUid || !challengeId) {
      Alert.alert('Not signed in', 'Sign in to submit an entry.');
      return;
    }
    setSubmitting(true);
    try {
      const entryRef = firestore()
        .collection(CHALLENGES_COL)
        .doc(challengeId)
        .collection(ENTRIES_COL)
        .doc(myUid); // one entry per user

      const isUpdate = entries.some((e) => e.authorUid === myUid);

      if (isUpdate) {
        await entryRef.update({
          caption,
          mediaUri:  mediaUri ?? null,
          mediaType: mediaType ?? null,
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Updated', 'Your entry has been updated.');
      } else {
        await entryRef.set({
          author:    { uid: myUid, username: myUsername },
          authorUid: myUid,
          authorUsername: myUsername,
          caption,
          mediaUri:  mediaUri ?? null,
          mediaType: mediaType ?? null,
          votes:     0,
          votedBy:   [],
          createdAt: serverTimestamp(),
        });
        // Increment challenge entry count
        await firestore()
          .collection(CHALLENGES_COL)
          .doc(challengeId)
          .update({ entryCount: (firestore() as any).FieldValue?.increment(1) ?? 1 })
          .catch(() => {}); // non-critical
        Alert.alert('Submitted', 'Entry submitted! Share it to get more votes.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [myUid, challengeId, myUsername, entries]);

  /* ── Vote on entry ── */
  const handleVote = useCallback(async (entryId: string) => {
    if (!myUid) {
      Alert.alert('Not signed in', 'Sign in to vote.');
      return;
    }
    setVotingId(entryId);
    try {
      const entryRef = firestore()
        .collection(CHALLENGES_COL)
        .doc(challengeId)
        .collection(ENTRIES_COL)
        .doc(entryId);

      await firestore().runTransaction(async (tx: any) => {
        const snap = await tx.get(entryRef);
        if (!snapExists(snap)) throw new Error('Entry not found');
        const data     = snap.data();
        const votedBy: string[] = data.votedBy ?? [];
        if (votedBy.includes(myUid)) return; // already voted
        tx.update(entryRef, {
          votes:   (data.votes ?? 0) + 1,
          votedBy: [...votedBy, myUid],
        });
      });
    } catch (e: any) {
      if (e?.message !== 'Entry not found') {
        Alert.alert('Error', 'Vote failed. Try again.');
      }
    } finally {
      setVotingId(null);
    }
  }, [myUid, challengeId]);

  /* ── Derived ── */
  const myEntry  = myUid ? (entries.find((e) => e.authorUid === myUid) ?? null) : null;
  const hasEntry = !!myEntry;

  /* ── Loading ── */
  if (loading || !challenge) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="Challenge" onBack={() => router.back()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={orbit.accent} />
          <Text style={styles.loadingText}>Loading challenge…</Text>
        </View>
      </View>
    );
  }

  const bottomPad = insets.bottom + 24;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title={challenge.category}
          onBack={() => router.back()}
        />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        ListHeaderComponent={
          <>
            {/* Challenge info */}
            <ChallengeHeader challenge={challenge} timeLeft={timeLeft} />

            <Divider />

            {/* Submit / update entry panel */}
            <SubmitEntryPanel
              hasEntry={hasEntry}
              myEntry={myEntry}
              onSubmit={handleSubmit}
              submitting={submitting}
            />

            <Divider />

            {/* Entries header */}
            <View style={styles.entriesHeader}>
              <Text style={styles.sectionLabel}>ALL ENTRIES</Text>
              <Text style={styles.entryCount}>{entries.length}</Text>
            </View>
          </>
        }
        ItemSeparatorComponent={() => <Divider inset={20} />}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            myUid={myUid}
            onVote={handleVote}
            votingId={votingId}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyEntries}>
            <Feather name="inbox" size={36} color={orbit.textTertiary} />
            <Text style={styles.emptyEntriesText}>No entries yet — be the first!</Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: orbit.bg,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: orbit.textTertiary,
    fontSize: 13,
  },

  /* Challenge header */
  challengeHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  challengeHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  challengeHeaderBody: {
    flex: 1,
    paddingTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  categoryTag: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    backgroundColor: orbit.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  challengeTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  challengePrompt: {
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: orbit.surface2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  metaChipText: {
    color: orbit.accent,
    fontSize: 12,
    fontWeight: '600',
  },

  /* Submit panel */
  submitPanel: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  submitPanelTitle: {
    color: orbit.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* Media pick */
  mediaPickRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  mediaPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  mediaPickText: {
    color: orbit.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  mediaPickOptional: {
    paddingHorizontal: 10,
  },
  mediaPickOptionalText: {
    color: orbit.textTertiary,
    fontSize: 11,
  },

  /* Media preview */
  mediaPreviewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  mediaRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewPlaceholder: {
    height: 120,
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPreviewText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '500',
  },

  /* Caption */
  captionInput: {
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
    color: orbit.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 80,
    lineHeight: 20,
  },
  captionCount: {
    color: orbit.textTertiary,
    fontSize: 11,
    textAlign: 'right',
    marginTop: -6,
  },

  /* Submit button */
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: orbit.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: orbit.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },

  /* Already submitted banner */
  entrySubmittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: orbit.successSoft,
  },
  entrySubmittedText: {
    flex: 1,
    color: orbit.success,
    fontSize: 14,
    fontWeight: '600',
  },
  entrySubmittedEdit: {
    color: orbit.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Entries header */
  entriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    color: orbit.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  entryCount: {
    color: orbit.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Entry card */
  entryCard: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  entryCardOwn: {
    backgroundColor: 'rgba(91, 127, 255, 0.05)',
    borderLeftWidth: 2,
    borderLeftColor: orbit.accent,
    paddingLeft: 18,
  },
  entryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  entryCardUsername: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  youPill: {
    backgroundColor: orbit.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youPillText: {
    color: orbit.white,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Entry media */
  entryImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  entryVideoPlaceholder: {
    height: 110,
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  entryVideoText: {
    color: orbit.textTertiary,
    fontSize: 12,
  },

  /* Caption */
  entryCaption: {
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 21,
  },

  /* Vote */
  entryVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  voteBtnActive: {
    backgroundColor: orbit.accentSoft,
    borderColor: orbit.accent,
  },
  voteBtnDisabled: {
    opacity: 0.5,
  },
  voteBtnText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  voteBtnTextActive: {
    color: orbit.accent,
  },
  votedLabel: {
    color: orbit.accent,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  ownEntryNote: {
    flex: 1,
    color: orbit.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
  },

  /* Empty */
  emptyEntries: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyEntriesText: {
    color: orbit.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
});

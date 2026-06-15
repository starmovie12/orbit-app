/**
 * components/organisms/MessageActionSheet.tsx
 *
 * CROWN — Message Action Sheet
 * Blueprint v5.0 BAAP EDITION · § 18 · Production Ready
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * 40%-height bottom sheet triggered by long-pressing any message bubble in the
 * Home sector chat. Renders one of four variants based on message ownership and
 * type, with fully dynamic action rows and confirm modals for destructive ops.
 *
 * Key features:
 *   • 4 variants: own · other_user · ai_companion · mayor_announcement
 *   • Quick-react emoji row (6 emojis · 32×32 · tap → react + dismiss)
 *   • Full emoji sub-picker (expanded grid · "React karo" action)
 *   • Haptic feedback on every action
 *   • Confirm modal for Delete + Report (with reason selector)
 *   • WhatsApp share via system Share sheet (deeplink pre-filled)
 *   • Save, Copy (clipboard), Pin/Unpin (mayor-gated)
 *   • Reply row shown (disabled · "Coming v1.1" tooltip) for non-AI messages
 *   • Loading state per-action (icon → spinner → ✓)
 *   • Accessibility: role="dialog" · destructive annotation · v1.1 disabled announce
 *
 * ── DESIGN SPEC (Blueprint § 18) ─────────────────────────────────────────────
 *
 *   Sheet height    : 40% screen · drag-down / scrim-tap → dismiss
 *   Preview         : 80px H · cream-50 bg · avatar 36×36 · 2-line text
 *   Quick emoji row : 32×32 each · 8px gap · scale 1.0 → 1.2 → 1.0 on tap
 *   Action row      : 56px H · 16px L/R pad · icon 24×24 + label 15/500/ink-950
 *   Divider         : 1px cream-400 between rows
 *   Cancel row      : 56px H · "Cancel karo" · 15/600/ink-950 · 8px top margin
 *   Confirm modals  : centered · 320px W · white card · radius 16px
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   components/BottomSheet.tsx
 *   lib/firestore-messages.ts
 *   hooks/useHaptics.ts
 */

import React, {
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard                      from 'expo-clipboard';

import { BottomSheet }              from '@/components/BottomSheet';
import {
  addReaction,
  deleteMessage,
  pinMessage,
  reportMessage,
  saveMessage,
  unpinMessage,
} from '@/lib/firestore-messages';
import { useHaptics }               from '@/hooks/useHaptics';
import { colors, palette }          from '@/constants/colors';
import { FONT_BODY }                from '@/constants/typography';
import type {
  Message,
  MayorAnnouncement,
  UserMessage,
} from '@/lib/firestore-rooms';   // re-exported from rooms; adjust path if split

// ─── Screen geometry ──────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;

// ─── Layout constants ─────────────────────────────────────────────────────────
const L = {
  sheetMaxH:         SCREEN_H * 0.40,  // 40% · blueprint exact
  previewH:          80,               // Message preview block
  previewPadH:       16,
  previewPadV:       12,
  avatarSize:        36,               // Avatar circle in preview
  actionRowH:        56,               // Each action row height · blueprint exact
  actionPadH:        16,               // Action row horizontal pad · blueprint exact
  actionIconSize:    24,               // Action icon size · blueprint exact
  actionFontSz:      15,               // Action label font size · blueprint exact
  emojiSize:         32,               // Quick-react emoji touchable · blueprint exact
  emojiGap:          8,                // Gap between emojis · blueprint exact
  emojiGridCols:     8,                // Extended picker grid columns
  cancelRowH:        56,               // Cancel row height · blueprint exact
  cancelMarginTop:   8,                // Cancel separation from actions
  confirmW:          320,              // Confirm modal width
  confirmPad:        24,
  confirmRadius:     16,
  scrimColor:        'rgba(28, 24, 20, 0.55)',
  pressDuration:     80,
  pressScale:        0.97,
  emojiScalePeak:    1.2,
  emojiAnimMs:       200,
} as const;

// ─── Design token alias ──────────────────────────────────────────────────────
const T = {
  ink950:    palette.ink[950],
  ink700:    palette.ink[700],
  ink600:    palette.ink[600],
  ink500:    palette.ink[500],
  cream50:   palette.cream[50],
  cream100:  palette.cream[100],
  cream200:  palette.cream[200],
  cream400:  palette.cream[400],
  gold600:   palette.gold[600],
  gold700:   palette.gold[700],
  crimson600: palette.crimson[600],
  white:     palette.white,
  sheetBg:   colors.bg.surface,
} as const;

// ─── Quick-react emojis (§ E.3.4) ────────────────────────────────────────────
const QUICK_EMOJIS = ['❤️', '🔥', '😂', '👍', '😮', '🙏'] as const;

// ─── Extended emoji picker grid ───────────────────────────────────────────────
const EXTENDED_EMOJIS = [
  '❤️', '🔥', '😂', '👍', '😮', '🙏', '😍', '🎉',
  '💯', '👀', '🤔', '😢', '🤣', '✅', '💪', '🙌',
  '😎', '🥳', '🤯', '😤', '🫡', '🤝', '👏', '💀',
] as const;

// ─── Report reason options ────────────────────────────────────────────────────
const REPORT_REASONS = [
  'Spam ya advertisement',
  'Gaali-galoch ya hate speech',
  'Harassment ya bullying',
  'Galat information',
  'Sexual ya inappropriate content',
  'Kuch aur',
] as const;
type ReportReason = typeof REPORT_REASONS[number];

// ─── Action descriptor ───────────────────────────────────────────────────────
type ActionId =
  | 'react'
  | 'reply'
  | 'copy'
  | 'share'
  | 'save'
  | 'report'
  | 'delete'
  | 'pin'
  | 'unpin';

interface ActionItem {
  id:          ActionId;
  label:       string;
  icon:        React.ReactNode;
  destructive?: boolean;
  disabled?:   boolean;
  disabledHint?: string;
  chevron?:    boolean;
}

// ─── Helper: relative time ────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60)  return `${diffSec} sec pehle`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min pehle`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ghante pehle`;
  return `${Math.floor(diffSec / 86400)} din pehle`;
}

// ─── Helper: initials from display name ──────────────────────────────────────
function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface MessageActionSheetProps {
  /** Controls sheet visibility */
  visible:    boolean;
  /** Dismiss callback */
  onClose:    () => void;
  /** The message being acted upon */
  message:    Message;
  /** UID of the currently authenticated user */
  currentUid: string;
  /** Whether the current user is the sector Mayor */
  isMayor:    boolean;
  /** Called after Reply is tapped (v1.1 — currently disabled in UI) */
  onReply?:   (message: Message) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const MessageActionSheet = memo(function MessageActionSheet({
  visible,
  onClose,
  message,
  currentUid,
  isMayor,
  onReply,
}: MessageActionSheetProps) {
  const haptics = useHaptics();

  // ── Sub-view state ──────────────────────────────────────────────────────────
  const [view, setView]                       = useState<'main' | 'emoji'>('main');
  const [loadingAction, setLoadingAction]     = useState<ActionId | null>(null);
  const [doneAction, setDoneAction]           = useState<ActionId | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reportReason, setReportReason]       = useState<ReportReason | null>(null);
  const [reportLoading, setReportLoading]     = useState(false);

  // Emoji tap scale animations (one per quick-emoji slot)
  const emojiScales = useRef(
    QUICK_EMOJIS.map(() => new Animated.Value(1)),
  ).current;

  // ── Derived fields ──────────────────────────────────────────────────────────
  const isUserMessage = (
    message.variant === 'own' ||
    message.variant === 'other_user' ||
    message.variant === 'ai_companion'
  );
  const isOwn       = isUserMessage && (message as UserMessage).sender_id === currentUid;
  const isAI        = message.variant === 'ai_companion';
  const isMayorAnn  = message.variant === 'mayor_announcement';
  const isMayorOwnAnn = isMayorAnn && isMayor &&
    (message as MayorAnnouncement).mayor_id === currentUid;

  const senderName: string = (() => {
    if (isOwn)     return 'Aap';
    if (isAI)      return 'AI';
    if (isMayorAnn) return (message as MayorAnnouncement).mayor_name;
    if (isUserMessage) return (message as UserMessage).sender_name;
    return '';
  })();

  const messageText: string = (() => {
    if ('text' in message) return (message as { text: string }).text;
    return '';
  })();

  const messageTs: number = message.timestamp;
  const isPinned = isUserMessage && (message as UserMessage).is_pinned;

  // ── Reset on open/close ─────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setView('main');
    setLoadingAction(null);
    setDoneAction(null);
    setShowDeleteConfirm(false);
    setShowReportConfirm(false);
    setReportReason(null);
    onClose();
  }, [onClose]);

  // ── Finish-action helper (spinner → checkmark → dismiss) ───────────────────
  const finishAction = useCallback((id: ActionId, ms = 600) => {
    setLoadingAction(null);
    setDoneAction(id);
    setTimeout(() => {
      setDoneAction(null);
      handleClose();
    }, ms);
  }, [handleClose]);

  // ── Emoji quick-react ───────────────────────────────────────────────────────
  const handleEmojiTap = useCallback(async (
    emoji: string,
    animIdx?: number,
  ) => {
    haptics.impactMedium();

    // Animate the tapped emoji (scale 1.0 → 1.2 → 1.0, 200ms)
    if (animIdx !== undefined) {
      Animated.sequence([
        Animated.timing(emojiScales[animIdx], {
          toValue:         L.emojiScalePeak,
          duration:        L.emojiAnimMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(emojiScales[animIdx], {
          toValue:         1,
          duration:        L.emojiAnimMs / 2,
          useNativeDriver: true,
        }),
      ]).start();
    }

    try {
      await addReaction(message.id, emoji, currentUid, message.sector_id);
    } catch {
      // silently fail (toast from caller if needed)
    } finally {
      // Auto-dismiss after scale animation completes
      setTimeout(handleClose, L.emojiAnimMs + 80);
    }
  }, [message, currentUid, emojiScales, haptics, handleClose]);

  // ── Action handlers ─────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    haptics.impactLight();
    setLoadingAction('copy');
    await Clipboard.setStringAsync(messageText); // 👈 async · expo-clipboard API
    AccessibilityInfo.announceForAccessibility('Copy ho gaya');
    finishAction('copy', 400);
  }, [messageText, haptics, finishAction]);

  const handleShare = useCallback(async () => {
    haptics.impactLight();
    const shareText =
      `Yeh dekh ${message.sector_id} ke chat mein kya scene hai 👇\n\n` +
      `'${messageText.slice(0, 100)}${messageText.length > 100 ? '…' : ''}'\n` +
      `— ${senderName}\n\nCROWN pe full chat dekho:\n` +
      `https://crownapp.in/sector/${message.city_id}-${message.sector_id}`;
    try {
      await Share.share({ message: shareText });
    } catch {
      // user cancelled — no error needed
    }
    handleClose();
  }, [message, messageText, senderName, haptics, handleClose]);

  const handleSave = useCallback(async () => {
    haptics.impactMedium();
    setLoadingAction('save');
    try {
      await saveMessage(message.id, currentUid);
      finishAction('save');
    } catch {
      setLoadingAction(null);
    }
  }, [message.id, currentUid, haptics, finishAction]);

  const handleDeleteConfirmed = useCallback(async () => {
    haptics.notificationError();
    setLoadingAction('delete');
    setShowDeleteConfirm(false);
    try {
      await deleteMessage(message.id, message.sector_id, currentUid);
      finishAction('delete');
    } catch {
      setLoadingAction(null);
    }
  }, [message, currentUid, haptics, finishAction]);

  const handlePin = useCallback(async () => {
    haptics.impactMedium();
    setLoadingAction('pin');
    try {
      await pinMessage(message.id, message.sector_id);
      finishAction('pin');
    } catch {
      setLoadingAction(null);
    }
  }, [message, haptics, finishAction]);

  const handleUnpin = useCallback(async () => {
    haptics.impactMedium();
    setLoadingAction('unpin');
    try {
      await unpinMessage(message.id, message.sector_id);
      finishAction('unpin');
    } catch {
      setLoadingAction(null);
    }
  }, [message, haptics, finishAction]);

  const handleReportConfirmed = useCallback(async () => {
    if (!reportReason) return;
    haptics.notificationError();
    setReportLoading(true);
    try {
      await reportMessage(message.id, reportReason, currentUid, message.sector_id);
    } catch {
      // server error — still dismiss (report queued locally)
    } finally {
      setReportLoading(false);
      setShowReportConfirm(false);
      finishAction('report');
    }
  }, [reportReason, message, currentUid, haptics, finishAction]);

  // ── Action dispatcher ───────────────────────────────────────────────────────
  const handleAction = useCallback((id: ActionId) => {
    switch (id) {
      case 'react':  haptics.impactLight(); setView('emoji');           break;
      case 'reply':  /* v1.1 disabled — shown but inert */                break;
      case 'copy':   handleCopy();                                        break;
      case 'share':  handleShare();                                       break;
      case 'save':   handleSave();                                        break;
      case 'report': haptics.impactMedium(); setShowReportConfirm(true); break;
      case 'delete': haptics.impactMedium(); setShowDeleteConfirm(true); break;
      case 'pin':    handlePin();                                         break;
      case 'unpin':  handleUnpin();                                       break;
    }
  }, [haptics, handleCopy, handleShare, handleSave, handlePin, handleUnpin]);

  // ── Build action list based on variant ─────────────────────────────────────
  const actions: ActionItem[] = (() => {
    const list: ActionItem[] = [];

    // React — all variants except system/separator
    if (message.variant !== 'system' && message.variant !== 'date_separator') {
      list.push({
        id:      'react',
        label:   'React karo',
        icon:    <Feather name="smile" size={L.actionIconSize} color={T.ink700} />,
        chevron: true,
      });
    }

    // Reply — disabled v1.1 (not for AI or system)
    if (!isAI && message.variant !== 'system' && message.variant !== 'date_separator') {
      list.push({
        id:          'reply',
        label:       'Reply karo',
        icon:        <Feather name="corner-up-left" size={L.actionIconSize} color={T.ink700} />,
        disabled:    true,
        disabledHint: 'Coming v1.1',
      });
    }

    // Copy — all text-bearing variants
    if (messageText) {
      list.push({
        id:    'copy',
        label: 'Copy karo',
        icon:  <Feather name="copy" size={L.actionIconSize} color={T.ink700} />,
      });
    }

    // WhatsApp Share — all text-bearing variants
    if (messageText) {
      list.push({
        id:    'share',
        label: 'WhatsApp pe Share',
        icon:  <MaterialCommunityIcons name="whatsapp" size={L.actionIconSize} color="#25D366" />,
      });
    }

    // Save — all message types (§ E.19)
    if (message.variant !== 'date_separator') {
      list.push({
        id:    'save',
        label: 'Save karo',
        icon:  <Feather name="bookmark" size={L.actionIconSize} color={T.ink700} />,
      });
    }

    // Report — not for own messages, not for AI
    if (!isOwn && !isAI) {
      list.push({
        id:          'report',
        label:       isMayorAnn ? 'Mayor pe report karo' : 'Report karo',
        icon:        <Feather name="alert-triangle" size={L.actionIconSize} color={T.crimson600} />,
        destructive: true,
      });
    }

    // Delete — own messages only
    if (isOwn) {
      list.push({
        id:          'delete',
        label:       'Delete karo',
        icon:        <Feather name="trash-2" size={L.actionIconSize} color={T.crimson600} />,
        destructive: true,
      });
    }

    // Pin — mayor can pin any message; Unpin — mayor on already-pinned
    if (isMayor && !isAI && message.variant !== 'system' && message.variant !== 'date_separator') {
      if (isPinned || isMayorOwnAnn) {
        list.push({
          id:    'unpin',
          label: 'Pin remove karo',
          icon:  <MaterialCommunityIcons name="pin-off" size={L.actionIconSize} color={T.gold700} />,
        });
      } else {
        list.push({
          id:    'pin',
          label: 'Mayor announcement pin karo',
          icon:  <MaterialCommunityIcons name="pin" size={L.actionIconSize} color={T.gold700} />,
        });
      }
    }

    return list;
  })();

  // ── Row action icon state (idle · loading · done) ──────────────────────────
  const actionIcon = useCallback((item: ActionItem) => {
    if (loadingAction === item.id) {
      return <Feather name="loader" size={L.actionIconSize} color={T.gold600} />;
    }
    if (doneAction === item.id) {
      return <Feather name="check" size={L.actionIconSize} color={T.gold600} />;
    }
    return item.icon;
  }, [loadingAction, doneAction]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main Bottom Sheet ────────────────────────────────────────────────── */}
      <BottomSheet
        visible={visible}
        onClose={handleClose}
        maxHeight={L.sheetMaxH}
        accessibilityRole="dialog"
        accessibilityLabel={
          isOwn
            ? 'Action sheet for your message'
            : `Action sheet for ${senderName}'s message`
        }
      >
        {view === 'main' ? (
          <View style={S.container}>
            {/* [2] Message preview ───────────────────────────────────────────── */}
            <View style={S.preview}>
              {/* Avatar */}
              <View style={S.previewAvatar} accessibilityElementsHidden>
                <Text style={S.previewAvatarText}>
                  {isOwn ? 'A' : initials(senderName)}
                </Text>
              </View>

              {/* Text block */}
              <View style={S.previewBody}>
                <Text
                  style={S.previewSender}
                  accessibilityRole="text"
                  numberOfLines={1}
                >
                  {senderName}
                </Text>
                <Text
                  style={S.previewText}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  accessibilityRole="text"
                  accessibilityLabel={`Message: ${messageText}`}
                >
                  {messageText || '(System message)'}
                </Text>
                <Text style={S.previewTime} accessibilityElementsHidden>
                  {relativeTime(messageTs)}
                </Text>
              </View>
            </View>

            {/* [3A] Quick emoji row (§ E.3.4) ────────────────────────────────── */}
            {message.variant !== 'system' && message.variant !== 'date_separator' && (
              <View style={S.emojiRow} accessibilityLabel="Quick reactions">
                {QUICK_EMOJIS.map((emoji, idx) => (
                  <Animated.View
                    key={emoji}
                    style={{ transform: [{ scale: emojiScales[idx] }] }}
                  >
                    <TouchableOpacity
                      style={S.emojiBtn}
                      onPress={() => handleEmojiTap(emoji, idx)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${emoji}`}
                    >
                      <Text style={S.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Divider below emoji row */}
            <View style={S.divider} />

            {/* [3] Action rows ────────────────────────────────────────────────── */}
            <ScrollView
              style={S.actionsScroll}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            >
              {actions.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <ActionRow
                    item={item}
                    icon={actionIcon(item)}
                    onPress={() => handleAction(item.id)}
                    isLoading={loadingAction === item.id}
                    isDone={doneAction === item.id}
                  />
                  {idx < actions.length - 1 && <View style={S.rowDivider} />}
                </React.Fragment>
              ))}
            </ScrollView>

            {/* [4] Cancel row ─────────────────────────────────────────────────── */}
            <View style={S.cancelSeparator} />
            <TouchableOpacity
              style={S.cancelRow}
              onPress={() => { haptics.impactLight(); handleClose(); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel · close action sheet"
            >
              <Text style={S.cancelText}>Cancel karo</Text>
            </TouchableOpacity>
          </View>

        ) : (
          /* ── Emoji sub-picker view ────────────────────────────────────────── */
          <View style={S.container}>
            <View style={S.emojiPickerHeader}>
              <TouchableOpacity
                onPress={() => setView('main')}
                style={S.emojiPickerBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Feather name="arrow-left" size={20} color={T.ink700} />
              </TouchableOpacity>
              <Text style={S.emojiPickerTitle}>React karo</Text>
            </View>
            <View style={S.divider} />
            <View style={S.emojiGrid}>
              {EXTENDED_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={S.emojiGridBtn}
                  onPress={() => handleEmojiTap(emoji)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${emoji}`}
                >
                  <Text style={S.emojiGridText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={S.cancelSeparator} />
            <TouchableOpacity
              style={S.cancelRow}
              onPress={() => { haptics.impactLight(); handleClose(); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={S.cancelText}>Cancel karo</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Message delete karein?"
        body="Yeh message hamesha ke liye delete ho jayega. Undo nahi hoga."
        confirmLabel="Delete karo"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* ── Report Confirm Modal ─────────────────────────────────────────────── */}
      <ReportModal
        visible={showReportConfirm}
        selectedReason={reportReason}
        onSelectReason={setReportReason}
        onConfirm={handleReportConfirmed}
        onCancel={() => { setShowReportConfirm(false); setReportReason(null); }}
        loading={reportLoading}
      />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: ActionRow
// ─────────────────────────────────────────────────────────────────────────────
interface ActionRowProps {
  item:      ActionItem;
  icon:      React.ReactNode;
  onPress:   () => void;
  isLoading: boolean;
  isDone:    boolean;
}

const ActionRow = memo(function ActionRow({
  item,
  icon,
  onPress,
  isLoading,
  isDone,
}: ActionRowProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (item.disabled) return;
    Animated.timing(scale, {
      toValue:         L.pressScale,
      duration:        L.pressDuration,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue:         1,
      duration:        L.pressDuration,
      useNativeDriver: true,
    }).start();
  };

  const labelColor = item.destructive
    ? T.crimson600
    : item.disabled
    ? T.ink500
    : T.ink950;

  const a11yHint = item.disabled
    ? (item.disabledHint ?? 'Not available')
    : item.destructive
    ? 'Destructive action'
    : undefined;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[S.actionRow, item.disabled && S.actionRowDisabled]}
        onPress={item.disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityHint={a11yHint}
        accessibilityState={{ disabled: item.disabled ?? false, busy: isLoading }}
        android_ripple={{ color: T.cream200, borderless: false }}
      >
        {/* Icon */}
        <View style={S.actionIcon}>{icon}</View>

        {/* Label + optional hint */}
        <View style={S.actionLabelBlock}>
          <Text style={[S.actionLabel, { color: labelColor }]}>
            {item.label}
          </Text>
          {item.disabled && item.disabledHint && (
            <Text style={S.actionHint}>{item.disabledHint}</Text>
          )}
        </View>

        {/* Right: chevron or done check */}
        {item.chevron && !isDone && (
          <Feather name="chevron-right" size={18} color={T.ink500} />
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: ConfirmModal (Delete / generic destructive)
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  visible:      boolean;
  title:        string;
  body:         string;
  confirmLabel: string;
  destructive:  boolean;
  onConfirm:    () => void;
  onCancel:     () => void;
}

const ConfirmModal = memo(function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue:         1,
          useNativeDriver: true,
          tension:         80,
          friction:        8,
        }),
        Animated.timing(opacAnim, {
          toValue:         1,
          duration:        200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={S.modalScrim}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                S.modalCard,
                { opacity: opacAnim, transform: [{ scale: scaleAnim }] },
              ]}
              accessibilityRole="dialog"
              accessibilityLabel={title}
            >
              {/* Warning icon */}
              <View style={S.modalIconWrap}>
                <Feather name="trash-2" size={28} color={T.crimson600} />
              </View>

              <Text style={S.modalTitle}>{title}</Text>
              <Text style={S.modalBody}>{body}</Text>

              {/* CTAs */}
              <TouchableOpacity
                style={[S.modalBtn, S.modalBtnDestructive]}
                onPress={onConfirm}
                accessibilityRole="button"
                accessibilityLabel={`${confirmLabel} · destructive`}
                activeOpacity={0.85}
              >
                <Text style={S.modalBtnDestructiveText}>{confirmLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[S.modalBtn, S.modalBtnCancel]}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                activeOpacity={0.7}
              >
                <Text style={S.modalBtnCancelText}>Cancel karo</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: ReportModal
// ─────────────────────────────────────────────────────────────────────────────
interface ReportModalProps {
  visible:        boolean;
  selectedReason: ReportReason | null;
  onSelectReason: (r: ReportReason) => void;
  onConfirm:      () => void;
  onCancel:       () => void;
  loading:        boolean;
}

const ReportModal = memo(function ReportModal({
  visible,
  selectedReason,
  onSelectReason,
  onConfirm,
  onCancel,
  loading,
}: ReportModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue:         1,
          useNativeDriver: true,
          tension:         80,
          friction:        8,
        }),
        Animated.timing(opacAnim, {
          toValue:         1,
          duration:        200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={S.modalScrim}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                S.modalCard,
                { opacity: opacAnim, transform: [{ scale: scaleAnim }] },
              ]}
              accessibilityRole="dialog"
              accessibilityLabel="Report message"
            >
              {/* Warning icon */}
              <View style={S.modalIconWrap}>
                <Feather name="alert-triangle" size={28} color={T.crimson600} />
              </View>

              <Text style={S.modalTitle}>Report karo</Text>
              <Text style={S.modalBody}>Kya problem hai is message mein?</Text>

              {/* Reason selector */}
              <View style={S.reportReasons}>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      S.reportReasonRow,
                      selectedReason === reason && S.reportReasonSelected,
                    ]}
                    onPress={() => onSelectReason(reason)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedReason === reason }}
                    accessibilityLabel={reason}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      S.reportRadio,
                      selectedReason === reason && S.reportRadioSelected,
                    ]}>
                      {selectedReason === reason && (
                        <View style={S.reportRadioDot} />
                      )}
                    </View>
                    <Text style={[
                      S.reportReasonText,
                      selectedReason === reason && S.reportReasonTextSelected,
                    ]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* CTAs */}
              <TouchableOpacity
                style={[
                  S.modalBtn,
                  S.modalBtnDestructive,
                  (!selectedReason || loading) && S.modalBtnDisabled,
                ]}
                onPress={selectedReason && !loading ? onConfirm : undefined}
                accessibilityRole="button"
                accessibilityLabel="Report · destructive"
                accessibilityState={{ disabled: !selectedReason || loading }}
                activeOpacity={0.85}
              >
                <Text style={S.modalBtnDestructiveText}>
                  {loading ? 'Report ho raha hai…' : 'Report bhejo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[S.modalBtn, S.modalBtnCancel]}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                activeOpacity={0.7}
              >
                <Text style={S.modalBtnCancelText}>Cancel karo</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // ── Sheet container ───────────────────────────────────────────────────────
  container: {
    backgroundColor: T.sheetBg,
    paddingBottom:   Platform.OS === 'ios' ? 8 : 4,
  },

  // ── Message preview ───────────────────────────────────────────────────────
  preview: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.previewPadH,
    paddingVertical:   L.previewPadV,
    minHeight:         L.previewH,
    backgroundColor:   T.cream50,
    gap:               12,
  },
  previewAvatar: {
    width:           L.avatarSize,
    height:          L.avatarSize,
    borderRadius:    L.avatarSize / 2,
    backgroundColor: T.cream200,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  previewAvatarText: {
    fontFamily: FONT_BODY.bold,
    fontSize:   14,
    fontWeight: '700',
    color:      T.gold700,
  },
  previewBody: {
    flex: 1,
  },
  previewSender: {
    fontFamily: FONT_BODY.bold,
    fontSize:   12,
    fontWeight: '700',
    color:      T.ink950,
    marginBottom: 2,
  },
  previewText: {
    fontFamily: FONT_BODY.regular,
    fontSize:   13,
    fontWeight: '400',
    color:      T.ink600,
    fontStyle:  'italic',
    lineHeight: 18,
  },
  previewTime: {
    fontFamily: FONT_BODY.regular,
    fontSize:   11,
    fontWeight: '400',
    color:      T.ink500,
    marginTop:  4,
  },

  // ── Quick emoji row ───────────────────────────────────────────────────────
  emojiRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: L.previewPadH,
    paddingVertical:   12,
    gap:               L.emojiGap,
    backgroundColor:   T.sheetBg,
  },
  emojiBtn: {
    width:          L.emojiSize,
    height:         L.emojiSize,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
    lineHeight: 32,
  },

  // ── Extended emoji picker ─────────────────────────────────────────────────
  emojiPickerHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   12,
    gap:               8,
  },
  emojiPickerBack: {
    padding: 4,
  },
  emojiPickerTitle: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   16,
    fontWeight: '600',
    color:      T.ink950,
  },
  emojiGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: 8,
    paddingVertical:   8,
    gap:               4,
  },
  emojiGridBtn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   8,
  },
  emojiGridText: {
    fontSize:   26,
    lineHeight: 34,
  },

  // ── Dividers ──────────────────────────────────────────────────────────────
  divider: {
    height:          1,
    backgroundColor: T.cream400,
    marginHorizontal: 0,
  },
  rowDivider: {
    height:          1,
    backgroundColor: T.cream400,
    marginLeft:      L.actionPadH + L.actionIconSize + 12, // indented under icon
  },

  // ── Actions scroll ────────────────────────────────────────────────────────
  actionsScroll: {
    flexGrow: 0,
  },

  // ── Action row ────────────────────────────────────────────────────────────
  actionRow: {
    height:            L.actionRowH,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.actionPadH,
    backgroundColor:   T.sheetBg,
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  actionIcon: {
    width:          L.actionIconSize,
    height:         L.actionIconSize,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    12,
    flexShrink:     0,
  },
  actionLabelBlock: {
    flex:        1,
    flexDirection: 'row',
    alignItems:   'center',
    gap:           8,
  },
  actionLabel: {
    fontFamily: FONT_BODY.medium,
    fontSize:   L.actionFontSz,
    fontWeight: '500',
  },
  actionHint: {
    fontFamily: FONT_BODY.regular,
    fontSize:   12,
    fontWeight: '400',
    color:      T.ink500,
  },

  // ── Cancel row ────────────────────────────────────────────────────────────
  cancelSeparator: {
    height:          L.cancelMarginTop,
    backgroundColor: T.cream100,
    borderTopWidth:  1,
    borderTopColor:  T.cream400,
  },
  cancelRow: {
    height:         L.cancelRowH,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: T.sheetBg,
  },
  cancelText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   15,
    fontWeight: '600',
    color:      T.ink950,
  },

  // ── Confirm modal ─────────────────────────────────────────────────────────
  modalScrim: {
    flex:            1,
    backgroundColor: L.scrimColor,
    alignItems:      'center',
    justifyContent:  'center',
  },
  modalCard: {
    width:         L.confirmW,
    backgroundColor: T.white,
    borderRadius:  L.confirmRadius,
    padding:       L.confirmPad,
    alignItems:    'center',
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(26,18,8,0.18)',
        shadowOffset:  { width: 0, height: 8 },
        shadowRadius:  24,
        shadowOpacity: 1,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  modalIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: T.cream100,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  modalTitle: {
    fontFamily: FONT_BODY.bold,
    fontSize:   18,
    fontWeight: '700',
    color:      T.ink950,
    textAlign:  'center',
    marginBottom: 8,
  },
  modalBody: {
    fontFamily: FONT_BODY.regular,
    fontSize:   14,
    fontWeight: '400',
    color:      T.ink600,
    textAlign:  'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    width:         '100%',
    height:        48,
    borderRadius:  12,
    alignItems:    'center',
    justifyContent: 'center',
    marginBottom:  10,
  },
  modalBtnDestructive: {
    backgroundColor: T.crimson600,
  },
  modalBtnDestructiveText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   15,
    fontWeight: '600',
    color:      T.white,
  },
  modalBtnCancel: {
    backgroundColor: T.cream200,
    marginBottom:    0,
  },
  modalBtnCancelText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   15,
    fontWeight: '500',
    color:      T.ink950,
  },
  modalBtnDisabled: {
    opacity: 0.45,
  },

  // ── Report reason selector ────────────────────────────────────────────────
  reportReasons: {
    width:        '100%',
    marginBottom: 20,
    gap:           4,
  },
  reportReasonRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    10,
    paddingHorizontal: 12,
    borderRadius:       8,
    gap:                10,
    backgroundColor:   T.cream50,
  },
  reportReasonSelected: {
    backgroundColor: T.cream200,
  },
  reportRadio: {
    width:           18,
    height:          18,
    borderRadius:     9,
    borderWidth:      2,
    borderColor:     T.cream400,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  reportRadioSelected: {
    borderColor: T.gold600,
  },
  reportRadioDot: {
    width:           8,
    height:          8,
    borderRadius:     4,
    backgroundColor: T.gold600,
  },
  reportReasonText: {
    fontFamily: FONT_BODY.regular,
    fontSize:   14,
    fontWeight: '400',
    color:      T.ink700,
    flex:       1,
  },
  reportReasonTextSelected: {
    fontFamily: FONT_BODY.semiBold,
    fontWeight: '600',
    color:      T.ink950,
  },
});

export default MessageActionSheet;

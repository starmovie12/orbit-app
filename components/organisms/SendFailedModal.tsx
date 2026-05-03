/**
 * components/organisms/SendFailedModal.tsx
 *
 * CROWD WORLD — Send-Failed Recovery Modal
 * Blueprint v5.0 BAAP EDITION · § 19 · Production Ready
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * Centered modal shown when a message fails to send after 3 silent retries.
 * Forces an explicit user decision (retry / save / discard). Cannot be
 * dismissed by tapping the backdrop — prevents accidental data loss.
 *
 * Key features:
 *   • Centered modal · 320px W · auto H (NOT a bottom sheet — § 19 exact)
 *   • Spring scale-in on mount (0.9 → 1.0 · opacity fade · § [1])
 *   • Scrim fade 0 → 0.55 (200ms · rgba(28,24,20,0.55) · z-index 955)
 *   • NO auto-dismiss — forces user decision · prevents data loss (§ 19)
 *   • Shake animation on mount (translateX oscillation · 380ms)
 *   • Icon pop: 0 → 1.1 → 1.0 spring + medium haptic (§ [2])
 *   • Message Preview Card — italic first 100 chars of failed message (§ [5])
 *   • Three CTAs: Retry (primary) · Save Draft (ghost) · Discard (link)
 *   • Discard requires inline sub-confirmation (§ [6.C])
 *   • Press scale 0.97 spring on each CTA (§ Micro-interactions)
 *   • Full a11y: role="dialog" · assertive live region · viewIsModal
 *
 * ── DESIGN SPEC (Blueprint § 19 exact) ──────────────────────────────────────
 *
 *   Modal type    : Centered · NOT bottom sheet
 *   Card          : 320px W · auto H · white bg · 16px radius · Tier-4 shadow
 *   Padding       : 24px all sides
 *   Scrim         : rgba(28,24,20,0.55) · z-index 955
 *   Card z-index  : 970
 *   Icon          : ⚠ Feather alert-triangle 56×56 amber-600 · 88×88 circle cream-100
 *   Headline      : "Message bheja nahi gaya" · 18px/700/ink-950 · centered
 *   Body          : "Connection problem…" · 14px/400/ink-600 · centered · max 3 lines
 *   Preview       : italic first 100 chars · 13px/400/ink-600 · cream-50 · 1px cream-400
 *   Retry CTA     : 48px H · gold-600 bg · white text · 12px radius (Primary)
 *   Save CTA      : 44px H · gold-700 text · 1px gold-600 border · 12px radius (Ghost)
 *   Discard CTA   : inline link · 14px/600/crimson-600 · underlined
 *   Spacing       : icon→headline 16px · headline→body 8px · body→preview 16px
 *                   preview→CTAs 24px · between CTAs 12px · discard 8px below border
 *
 * ── PROPS ────────────────────────────────────────────────────────────────────
 *   visible        : controls modal visibility
 *   failedMessage  : raw message text — first 100 chars shown in preview (§ [5])
 *   onClose        : called ONLY after a user action (NEVER on backdrop tap · § 19)
 *   onRetry        : queues re-send attempt
 *   onSaveDraft    : saves to AsyncStorage queue · auto-retries on network restore
 *   onDiscard      : removes from queue after sub-confirmation
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   @expo/vector-icons (Feather)
 *   expo-haptics
 *   @/constants/colors  (palette · colors)
 *   @/constants/typography (FONT_BODY)
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { palette } from '@/constants/colors';
import { FONT_BODY } from '@/constants/typography';

// ─── Shake sequence (translateX keyframes · px) ───────────────────────────────
const SHAKE_SEQUENCE = [-10, 10, -8, 8, -5, 5, -2, 2, 0] as const;
const SHAKE_STEP_MS  = 42; // 8 × 42 ≈ 380ms total

// ─── Design tokens — zero hardcoded fallbacks (BAAP Protocol § 3) ─────────────
const T = {
  // Colors
  ink950:     palette.ink[950],
  ink700:     palette.ink[700],
  ink600:     palette.ink[600],
  cream50:    palette.cream[50],
  cream100:   palette.cream[100],
  cream200:   palette.cream[200],
  cream400:   palette.cream[400],
  gold600:    palette.gold[600],
  gold700:    palette.gold[700],
  amber600:   palette.amber[600],    // § [2] exact · no hardcoded fallbacks
  crimson600: palette.crimson[600],  // § [6.C] exact · no hardcoded fallbacks
  white:      palette.white,
  // Dimensions (§ 19 exact)
  cardWidth:      320,               // § 19: 320px W
  cardRadius:     16,                // § [1]: 16px radius
  cardPadding:    24,                // § [1]: 24px all sides
  iconCircleSize: 88,                // § [2]: 88×88 circle
  iconSize:       56,                // § [2]: 56×56 icon
  retryH:         48,                // § [6.A]: 48px H
  saveH:          44,                // § [6.B]: 44px H
  ctaRadius:      12,                // § [6.A/B]: 12px radius
  previewRadius:  12,                // § [5]: 12px radius
  previewMinH:    64,                // § [5]: 64px H
  previewPad:     12,                // § [5]: 12px padding
  pressDuration:  80,
  pressScale:     0.97,              // § Micro-interactions
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────
export interface SendFailedModalProps {
  /** Controls modal visibility */
  visible:       boolean;
  /**
   * Raw failed message text.
   * First 100 chars shown in preview card (§ [5]).
   */
  failedMessage: string;
  /**
   * Called ONLY after explicit user action (retry / save / discard).
   * NEVER called on backdrop tap — forced decision prevents data loss (§ 19).
   */
  onClose:       () => void;
  /** Re-attempts send · caller shows "Phir try kar rahe..." toast */
  onRetry:       () => void;
  /** Saves to AsyncStorage queue · auto-retries when network restores (§ [6.B]) */
  onSaveDraft:   () => void;
  /** Removes from queue after sub-confirmation (§ [6.C]) */
  onDiscard:     () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const SendFailedModal = memo(function SendFailedModal({
  visible,
  failedMessage,
  onClose,
  onRetry,
  onSaveDraft,
  onDiscard,
}: SendFailedModalProps) {

  // ── Animation values ──────────────────────────────────────────────────────
  const shakeX       = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(0.9)).current;  // § [1]: 0.9 → 1.0 spring
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const iconScale    = useRef(new Animated.Value(0)).current;    // § [2]: 0 → 1.1 → 1.0

  // ── Local state ───────────────────────────────────────────────────────────
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // ── Mount / unmount animations ────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      // Reset all animated values for next open
      cardScale.setValue(0.9);
      cardOpacity.setValue(0);
      scrimOpacity.setValue(0);
      iconScale.setValue(0);
      shakeX.setValue(0);
      setShowDiscardConfirm(false);
      return;
    }

    // 1) Medium haptic on appear (§ [2])
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 2) Scrim fade 0 → 0.55 in 200ms (§ [1])
    Animated.timing(scrimOpacity, {
      toValue:         1,
      duration:        200,
      useNativeDriver: true,
    }).start();

    // 3) Card scale 0.9 → 1.0 spring + opacity (§ [1]: gentle spring)
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue:         1,
        useNativeDriver: true,
        tension:         80,
        friction:        8,
      }),
      Animated.timing(cardOpacity, {
        toValue:         1,
        duration:        240,
        useNativeDriver: true,
      }),
    ]).start();

    // 4) Icon pop: 0 → 1.1 → 1.0 spring (§ [2]: gentle 400ms)
    Animated.spring(iconScale, {
      toValue:         1,
      useNativeDriver: true,
      tension:         100,
      friction:        5,
    }).start();

    // 5) Shake plays 100ms after mount so card is visible first
    const shakeTimeout = setTimeout(() => {
      const steps = SHAKE_SEQUENCE.map((toValue) =>
        Animated.timing(shakeX, {
          toValue,
          duration:        SHAKE_STEP_MS,
          easing:          Easing.linear,
          useNativeDriver: true,
        }),
      );
      Animated.sequence(steps).start();
    }, 100);

    // Announce to screen readers (assertive · § Accessibility)
    AccessibilityInfo.announceForAccessibility(
      'Message bheja nahi gaya. Retry karein, save karein, ya discard karein.',
    );

    return () => clearTimeout(shakeTimeout);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CTA press-scale animations ────────────────────────────────────────────
  const retryScale = useRef(new Animated.Value(1)).current;
  const saveScale  = useRef(new Animated.Value(1)).current;

  const pressIn  = (val: Animated.Value) => () =>
    Animated.timing(val, {
      toValue:         T.pressScale,
      duration:        T.pressDuration,
      useNativeDriver: true,
    }).start();

  const pressOut = (val: Animated.Value) => () =>
    Animated.timing(val, {
      toValue:         1,
      duration:        T.pressDuration,
      useNativeDriver: true,
    }).start();

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
    onClose();
  }, [onRetry, onClose]);

  const handleSaveDraft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSaveDraft();
    onClose();
  }, [onSaveDraft, onClose]);

  const handleDiscardTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDiscardConfirm(true);
  }, []);

  const handleDiscardConfirmed = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDiscard();
    onClose();
  }, [onDiscard, onClose]);

  const handleDiscardCancelled = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  // Preview: first 100 chars (§ [5])
  const previewText = failedMessage.trim().slice(0, 100);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {
        /* Android hardware back = no-op · forces explicit decision (§ 19) */
      }}
      accessibilityViewIsModal
    >
      {/* ── Scrim (rgba(28,24,20,0.55) · z-index 955 · § 19) ───────────────── */}
      <Animated.View
        style={[S.scrim, { opacity: scrimOpacity }]}
        accessibilityElementsHidden
      />

      {/* ── Centered overlay (non-tappable backdrop · § 19) ────────────────── */}
      <View style={S.overlay} pointerEvents="box-none">

        {/* ── Error card (white · 320px · 16px radius · z-index 970 · § [1]) ─ */}
        <Animated.View
          style={[
            S.card,
            {
              opacity:   cardOpacity,
              transform: [
                { scale:      cardScale },
                { translateX: shakeX   },
              ],
            },
          ]}
          accessibilityRole="dialog"
          accessibilityLabel="Message send ho nahi paya"
          accessibilityLiveRegion="assertive"
          accessibilityViewIsModal
        >

          {/* [2] Warning icon: 88×88 circle · 56×56 amber-600 icon (§ [2]) */}
          <Animated.View
            style={[S.iconCircle, { transform: [{ scale: iconScale }] }]}
            accessibilityElementsHidden
          >
            <Feather
              name="alert-triangle"
              size={T.iconSize}
              color={T.amber600}
            />
          </Animated.View>

          {/* [3] Headline — 18px/700/ink-950 centered (§ [3]) */}
          <Text
            style={S.headline}
            accessibilityRole="header"
            numberOfLines={1}
          >
            Message bheja nahi gaya
          </Text>

          {/* [4] Body — 14px/400/ink-600 centered max 3 lines (§ [4]) */}
          <Text
            style={S.body}
            accessibilityRole="text"
            numberOfLines={3}
          >
            Connection problem aa rahi hai. 3 baar try kiya hai · ab kya karein?
          </Text>

          {/* [5] Message Preview Card (§ [5]: cream-50 · 1px cream-400 · italic) */}
          {previewText.length > 0 && (
            <View
              style={S.previewCard}
              accessibilityRole="text"
              accessibilityLabel={`Failed message preview: ${previewText}`}
            >
              <Text
                style={S.previewText}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {previewText}
              </Text>
            </View>
          )}

          {/* [6] CTA stack */}
          {!showDiscardConfirm ? (
            <View style={S.ctaStack}>

              {/* [6.A] Primary: Retry (48px · gold-600 · § [6.A]) */}
              <Animated.View style={{ transform: [{ scale: retryScale }] }}>
                <Pressable
                  style={S.retryBtn}
                  onPress={handleRetry}
                  onPressIn={pressIn(retryScale)}
                  onPressOut={pressOut(retryScale)}
                  android_ripple={{ color: T.gold700, borderless: false }}
                  accessibilityRole="button"
                  accessibilityLabel="Phir Try Karo"
                >
                  <Feather name="refresh-cw" size={16} color={T.white} />
                  <Text style={S.retryText}>Phir Try Karo</Text>
                </Pressable>
              </Animated.View>

              {/* [6.B] Ghost: Save Draft (44px · gold-700 border · § [6.B]) */}
              <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                <Pressable
                  style={S.saveBtn}
                  onPress={handleSaveDraft}
                  onPressIn={pressIn(saveScale)}
                  onPressOut={pressOut(saveScale)}
                  android_ripple={{ color: T.gold600, borderless: false }}
                  accessibilityRole="button"
                  accessibilityLabel="Save kar lo · baad mein bhejo"
                >
                  <Feather name="bookmark" size={15} color={T.gold700} />
                  <Text style={S.saveText}>Save kar lo · baad mein bhejo</Text>
                </Pressable>
              </Animated.View>

              {/* [6.C] Destructive link — crimson-600 underlined (§ [6.C]) */}
              <TouchableOpacity
                style={S.discardLink}
                onPress={handleDiscardTap}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Discard kar do · destructive"
              >
                <Text style={S.discardText}>
                  Discard kar do · phir nahi bhejunga
                </Text>
              </TouchableOpacity>

            </View>
          ) : (
            /* Inline sub-confirmation (§ [6.C]: slides down inside card) */
            <DiscardConfirmRow
              onConfirm={handleDiscardConfirmed}
              onCancel={handleDiscardCancelled}
            />
          )}

        </Animated.View>
      </View>
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: DiscardConfirmRow
// Inline · no extra modal · slides down inside the card (§ [6.C])
// ─────────────────────────────────────────────────────────────────────────────
interface DiscardConfirmRowProps {
  onConfirm: () => void;
  onCancel:  () => void;
}

const DiscardConfirmRow = memo(function DiscardConfirmRow({
  onConfirm,
  onCancel,
}: DiscardConfirmRowProps) {
  const slideY  = useRef(new Animated.Value(-12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue:         0,
        useNativeDriver: true,
        tension:         120,
        friction:        10,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideY, opacity]);

  return (
    <Animated.View
      style={[S.confirmRow, { opacity, transform: [{ translateY: slideY }] }]}
      accessibilityRole="alert"
      accessibilityLabel="Kya aap message discard karna chahte hain?"
    >
      <Text style={S.confirmText}>
        Message discard karein? Yeh wapas nahi aayega.
      </Text>

      <View style={S.confirmBtns}>
        {/* Cancel */}
        <TouchableOpacity
          style={[S.confirmBtn, S.confirmBtnCancel]}
          onPress={onCancel}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Nahi · wapas jao"
        >
          <Text style={S.confirmBtnCancelText}>Nahi</Text>
        </TouchableOpacity>

        {/* Confirm discard — destructive */}
        <TouchableOpacity
          style={[S.confirmBtn, S.confirmBtnDestructive]}
          onPress={onConfirm}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Haan · discard karo · destructive"
        >
          <Text style={S.confirmBtnDestructiveText}>Haan, discard karo</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // ── Scrim (z-index 955 · § 19) ────────────────────────────────────────────
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,24,20,0.55)', // § 19 exact
    zIndex:          955,
  },

  // ── Centered overlay (z-index 970 · § 19) ────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         970,
  },

  // ── Modal card (white · 320px W · 16px radius · Tier-4 shadow · § [1]) ───
  card: {
    width:           T.cardWidth,
    backgroundColor: palette.white,
    borderRadius:    T.cardRadius,
    padding:         T.cardPadding,
    alignItems:      'center',
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(28,24,20,0.22)',
        shadowOffset:  { width: 0, height: 8 },
        shadowRadius:  24,
        shadowOpacity: 1,
      },
      android: { elevation: 12 },
    }),
  },

  // ── [2] Icon circle (88×88 · cream-100 · centered · § [2]) ───────────────
  iconCircle: {
    width:           T.iconCircleSize,
    height:          T.iconCircleSize,
    borderRadius:    T.iconCircleSize / 2,
    backgroundColor: T.cream100,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,           // § Spacing: icon → headline 16px
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(217,119,6,0.18)',
        shadowOffset:  { width: 0, height: 2 },
        shadowRadius:  8,
        shadowOpacity: 1,
      },
      android: { elevation: 3 },
    }),
  },

  // ── [3] Headline (18px/700/ink-950 · centered · § [3]) ───────────────────
  headline: {
    fontFamily:   FONT_BODY.bold,
    fontSize:     18,
    fontWeight:   '700',
    color:        T.ink950,
    textAlign:    'center',
    lineHeight:   24,
    marginBottom: 8,               // § Spacing: headline → body 8px
  },

  // ── [4] Body (14px/400/ink-600 · centered · max 3 lines · § [4]) ─────────
  body: {
    fontFamily:   FONT_BODY.regular,
    fontSize:     14,
    fontWeight:   '400',
    color:        T.ink600,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: 16,              // § Spacing: body → preview 16px
  },

  // ── [5] Preview Card (cream-50 · 1px cream-400 · 12px radius · § [5]) ────
  previewCard: {
    width:           '100%',
    minHeight:       T.previewMinH,
    backgroundColor: T.cream50,
    borderWidth:     1,
    borderColor:     T.cream400,
    borderRadius:    T.previewRadius,
    padding:         T.previewPad,
    justifyContent:  'center',
    marginBottom:    24,           // § Spacing: preview → CTAs 24px
  },
  previewText: {
    fontFamily: FONT_BODY.regular,
    fontSize:   13,
    fontWeight: '400',
    color:      T.ink600,
    fontStyle:  'italic',          // § [5]: italic preview
    lineHeight: 19,
  },

  // ── [6] CTA stack (12px gaps · § [6]) ────────────────────────────────────
  ctaStack: {
    width: '100%',
    gap:    12,                    // § Spacing: between CTAs 12px
  },

  // [6.A] Primary retry (48px · gold-600 · § [6.A])
  retryBtn: {
    height:          T.retryH,
    borderRadius:    T.ctaRadius,
    backgroundColor: T.gold600,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:              8,
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(201,162,39,0.35)',
        shadowOffset:  { width: 0, height: 4 },
        shadowRadius:  12,
        shadowOpacity: 1,
      },
      android: { elevation: 4 },
    }),
  },
  retryText: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      15,
    fontWeight:    '600',
    color:         T.white,
    letterSpacing: 0.2,
  },

  // [6.B] Ghost save (44px · 1px gold-600 border · gold-700 text · § [6.B])
  saveBtn: {
    height:          T.saveH,
    borderRadius:    T.ctaRadius,
    borderWidth:     1,
    borderColor:     T.gold600,
    backgroundColor: 'transparent',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:              7,
  },
  saveText: {
    fontFamily:    FONT_BODY.semiBold,
    fontSize:      14,
    fontWeight:    '600',
    color:         T.gold700,
    letterSpacing: 0.1,
  },

  // [6.C] Discard link (14px/600/crimson-600 underlined · § [6.C])
  discardLink: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical:  6,
    marginTop:       -4,           // § Spacing: 8px below save btn border
  },
  discardText: {
    fontFamily:         FONT_BODY.semiBold,
    fontSize:           14,
    fontWeight:         '600',
    color:              T.crimson600,
    textDecorationLine: 'underline',
  },

  // ── Discard inline confirm row (§ [6.C]) ──────────────────────────────────
  confirmRow: {
    width:      '100%',
    gap:         10,
    paddingTop:   4,
  },
  confirmText: {
    fontFamily: FONT_BODY.regular,
    fontSize:   13,
    fontWeight: '400',
    color:      T.ink700,
    textAlign:  'center',
    lineHeight: 18,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap:           10,
  },
  confirmBtn: {
    flex:           1,
    height:         40,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: T.cream200,
    borderWidth:     1,
    borderColor:     T.cream400,
  },
  confirmBtnCancelText: {
    fontFamily: FONT_BODY.medium,
    fontSize:   14,
    fontWeight: '500',
    color:      T.ink950,
  },
  confirmBtnDestructive: {
    backgroundColor: T.crimson600,
  },
  confirmBtnDestructiveText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   14,
    fontWeight: '600',
    color:      T.white,
  },
});

export default SendFailedModal;

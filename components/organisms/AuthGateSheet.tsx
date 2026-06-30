/**
 * components/organisms/AuthGateSheet.tsx
 *
 * CROWN — Auth Gate Bottom Sheet
 * Blueprint v5.0 BAAP EDITION · § 20 · Production Ready
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * Half-height (50%) bottom sheet shown when an unauthenticated user attempts
 * their first write action (tap chat input, send message, react, gift, etc.).
 * Implements LAW 4 — Peek-Before-Join: the sheet is DISMISSIBLE (tap scrim or
 * drag down) so users can continue browsing read-only without forced signup.
 *
 * Key features:
 *   • Half screen height (50%) · slide-up spring via BottomSheet
 *   • Dismissible by scrim tap or drag-down (LAW 4 honored explicitly)
 *   • Hero illustration + "Bas ek step aur..." subtitle (scale spring on mount)
 *   • Headline + Subhead ("1 Lakh+ users" trust anchor · social proof)
 *   • Feature Strip — 3 benefits with ✓ emerald-600 icons · stagger fade-in
 *   • Phone input (+91 prefix · 10-digit · phone-pad · autoFocus)
 *   • Continue CTA (54px · disabled until 10 digits · fires OTP send)
 *   • Terms + Privacy disclosure (DPDP Act 2023 mandate)
 *   • "Pehle dekho · sign up baad mein" peek link (LAW 4 explicit call-out)
 *   • Full analytics: auth_gate_shown · auth_gate_continue_tap · etc.
 *   • Full a11y: role="dialog" · assertive live region · focus order honored
 *
 * ── DESIGN SPEC (Blueprint § 20 exact) ──────────────────────────────────────
 *
 *   Sheet height   : 50% screen H · z-index 960 · Scrim z-index 955
 *   [1] Drag handle: in BottomSheet (36×4px · cream-400)
 *   [2] Hero zone  : 80×80 illustration centered · "Bas ek step aur..." 12px/600/gold-700
 *                    Animation: scale 0.9 → 1.0 spring 400ms + opacity fade
 *   [3] Headline   : "Sector mein join hone ke liye sign in karo" · 22px/700/ink-950 centered
 *       Subhead    : "1 Lakh+ users already typing · aap bhi pehle ho!" · 15px/400/ink-600
 *   [4] Feature    : cream-100 bg · 16px radius · 3 rows · ✓ emerald-600 · stagger 100ms
 *   [5] Phone input: 52px H · +91 box 60px · 1px cream-400 idle · 2px gold-600 focus
 *                    keyboardType phone-pad · maxLength 10 · autoFocus true
 *   [6] Continue   : 54px H · gold-600 bg · disabled until 10 digits valid
 *       Privacy    : 11px/400/ink-500 + gold-700 underlined Terms/Privacy links (DPDP)
 *   [7] Peek link  : "Pehle dekho · sign up baad mein" · 13px/500/ink-500 underlined
 *
 * ── SPACING (§ 20 exact) ─────────────────────────────────────────────────────
 *   Drag 12px V · hero zone 16px top · hero → headline 16px · headline → subhead 12px
 *   subhead → feature strip 16px · feature strip → phone 24px
 *   phone → CTA: flex-spacer · CTA → privacy 12px · privacy → peek 4px
 *
 * ── ANALYTICS EVENTS ─────────────────────────────────────────────────────────
 *   auth_gate_shown         (trigger_action)
 *   auth_gate_phone_typed   (length only · no PII)
 *   auth_gate_continue_tap
 *   auth_gate_otp_send_success
 *   auth_gate_otp_send_fail  (error_code)
 *   auth_gate_peek_link_tap
 *   auth_gate_dismissed
 *
 * ── DEPS ─────────────────────────────────────────────────────────────────────
 *   components/BottomSheet.tsx
 *   @/lib/auth (normalizeIndianPhone · isValidE164)
 *   @/constants/colors  (palette)
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
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter }    from 'expo-router';
import { Feather }      from '@expo/vector-icons';
import * as Haptics     from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet }  from '@/components/BottomSheet';
import { palette }      from '@/constants/colors';
import { FONT_BODY }    from '@/constants/typography';
import {
  normalizeIndianPhone,
  isValidE164,
} from '@/lib/auth';

// ─── Screen metrics ───────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;

// ─── OTP send helpers (mirrors phone.tsx pattern) ────────────────────────────
async function sendOtpNative(phoneE164: string): Promise<unknown> {
  const rnAuth = (await import('@react-native-firebase/auth')).default;
  return rnAuth().signInWithPhoneNumber(phoneE164);
}

async function sendOtpWeb(phoneE164: string): Promise<unknown> {
  const { initializeApp, getApps, getApp } = await import('firebase/app');
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
  const FIREBASE_WEB_CONFIG = {
    apiKey:            'AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w',
    authDomain:        'orbit-app-5b4b3.firebaseapp.com',
    projectId:         'orbit-app-5b4b3',
    storageBucket:     'orbit-app-5b4b3.firebasestorage.app',
    messagingSenderId: '250454225022',
    appId:             '1:250454225022:android:44b3e0a7ac0268cfe6a82f',
  };
  const app     = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  const webAuth = getAuth(app);
  let container = document.getElementById('recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'recaptcha-container';
    document.body.appendChild(container);
  }
  const verifier = new RecaptchaVerifier(webAuth, 'recaptcha-container', { size: 'invisible' });
  await verifier.render();
  return signInWithPhoneNumber(webAuth, phoneE164, verifier);
}

// ─── Analytics helper (fire-and-forget · no crash on failure) ────────────────
async function logEvent(name: string, params?: Record<string, string | number>): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      const analytics = (await import('@react-native-firebase/analytics')).default;
      await analytics().logEvent(name, params);
    }
  } catch {
    // analytics must never crash the app
  }
}

// ─── Feature strip rows (§ [4]) ───────────────────────────────────────────────
const FEATURES = [
  'Apne sector ke saath baat karo',
  'Spark Gifts kamao · Credits kamao',
  'Mayor ban sakte ho · awaaz pao',
] as const;

// ─── Design tokens — zero hardcoded fallbacks (BAAP Protocol § 3) ─────────────
const T = {
  // Colors
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
  emerald600: palette.emerald[600],  // § [4]: ✓ benefit icons
  white:     palette.white,
  // Dimensions (§ 20 exact)
  heroSize:      80,                 // § [2]: 80×80 hero illustration
  heroCircle:    112,                // outer glow circle
  inputH:        52,                 // § [5]: 52px H
  prefixW:       60,                 // § [5]: 60px prefix box
  ctaH:          54,                 // § [6]: 54px CTA
  ctaRadius:     14,
  inputRadius:   12,
  featureRadius: 16,                 // § [4]: 16px radius
  featurePad:    16,                 // § [4]: 16px padding
  sheetPadH:     24,                 // § [3]: 24px L/R
  pressDuration: 80,
  pressScale:    0.97,
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────
export type AuthGateTriggerAction =
  | 'input_tap'
  | 'send_message'
  | 'spark_gift'
  | 'react'
  | 'edit_profile';

export interface AuthGateSheetProps {
  /** Controls sheet visibility */
  visible:  boolean;
  /** Dismisses sheet — LAW 4 (peek-before-join · not forced signup) */
  onClose:  () => void;
  /**
   * Called after OTP is sent successfully.
   * Caller navigates to OTP verification screen.
   * Sheet also calls router.push('/(auth)/otp') internally.
   */
  onSignIn: () => void;
  /**
   * What triggered this gate — used for analytics only (§ Analytics).
   * Defaults to 'input_tap' (most common trigger — chat input tap).
   */
  triggerAction?: AuthGateTriggerAction;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const AuthGateSheet = memo(function AuthGateSheet({
  visible,
  onClose,
  onSignIn,
  triggerAction = 'input_tap',
}: AuthGateSheetProps) {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // ── Animation values ──────────────────────────────────────────────────────
  const heroScale   = useRef(new Animated.Value(0.9)).current; // § [2]: 0.9 → 1.0
  const heroOpacity = useRef(new Animated.Value(0)).current;

  // Feature strip stagger (§ Micro-interactions: 100ms between each row)
  const featureOpacities = useRef(
    FEATURES.map(() => new Animated.Value(0))
  ).current;
  const featureTranslates = useRef(
    FEATURES.map(() => new Animated.Value(6))
  ).current;

  // CTA validation scale spring
  const ctaScale = useRef(new Animated.Value(1)).current;

  // ── Local state ───────────────────────────────────────────────────────────
  const [phone, setPhone]           = useState('');
  const [focused, setFocused]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const inputRef                    = useRef<TextInput>(null);

  const phoneValid = phone.length === 10;
  const e164       = normalizeIndianPhone(phone);

  // ── Mount animations ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      // Reset for next open
      heroScale.setValue(0.9);
      heroOpacity.setValue(0);
      featureOpacities.forEach((v) => v.setValue(0));
      featureTranslates.forEach((v) => v.setValue(6));
      setPhone('');
      setError(null);
      setLoading(false);
      return;
    }

    // Analytics: auth_gate_shown
    logEvent('auth_gate_shown', { trigger_action: triggerAction });

    // Haptic on open
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 1) Hero scale spring (§ [2]: gentle 400ms)
    Animated.parallel([
      Animated.spring(heroScale, {
        toValue:         1,
        useNativeDriver: true,
        tension:         80,
        friction:        8,
      }),
      Animated.timing(heroOpacity, {
        toValue:         1,
        duration:        300,
        useNativeDriver: true,
      }),
    ]).start();

    // 2) Feature strip stagger fade-in (§ Micro-interactions: 100ms between each)
    const staggerDelay = 180; // start after hero
    FEATURES.forEach((_, i) => {
      const delay = staggerDelay + i * 100;
      Animated.parallel([
        Animated.timing(featureOpacities[i], {
          toValue:         1,
          duration:        200,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(featureTranslates[i], {
          toValue:         0,
          duration:        200,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Announce to screen readers
    AccessibilityInfo.announceForAccessibility(
      'Sign in screen. Enter your phone number to join the conversation.',
    );
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phone change handler ──────────────────────────────────────────────────
  const handlePhoneChange = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    setError(null);
    // Analytics: length only (no PII)
    logEvent('auth_gate_phone_typed', { length: digits.length });

    // CTA activation spring when exactly 10 digits
    if (digits.length === 10) {
      Animated.spring(ctaScale, {
        toValue:         1.02,
        useNativeDriver: true,
        tension:         200,
        friction:        8,
      }).start(() =>
        Animated.spring(ctaScale, {
          toValue:         1,
          useNativeDriver: true,
          bounciness:      0,
        }).start()
      );
    }
  }, [ctaScale]);

  // ── Continue handler (OTP send) ───────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    if (loading) return;

    // Full 10-digit + E.164 guard. The button is no longer hard-disabled when
    // the number is incomplete, so a press here gives clear feedback instead of
    // doing nothing silently.
    if (!phoneValid || !isValidE164(e164)) {
      setError('Pura 10-digit number daalo (jaise 9876755692).');
      return;
    }

    logEvent('auth_gate_continue_tap');
    setLoading(true);
    setError(null);
    // Haptics must never block / abort the flow.
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { /* noop */ }

    try {
      // Race the send against a timeout so a stuck native phone-verification
      // (e.g. a number Firebase doesn't recognise as a test number, or missing
      // SHA-256 / Play Integrity setup) surfaces a message instead of an
      // infinite silent spinner.
      const sendPromise: Promise<unknown> =
        Platform.OS === 'web' ? sendOtpWeb(e164) : sendOtpNative(e164);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              Object.assign(
                new Error(
                  'Firebase ne 20 second mein jawab nahi diya. Check: number console mein +91 ke saath test number ke roop mein add hai, aur Android SHA-256 key Firebase mein add hai.',
                ),
                { code: 'timeout' },
              ),
            ),
          20000,
        ),
      );

      const handle = await Promise.race([sendPromise, timeout]);

      // Store OTP handle globally (same pattern as phone.tsx)
      global.__orbitOtp = { handle, phone: e164 };

      logEvent('auth_gate_otp_send_success');
      onSignIn();          // caller notified first
      onClose();           // dismiss sheet
      router.push('/(auth)/otp');
    } catch (err: unknown) {
      const code    = (err as { code?: string })?.code ?? 'unknown';
      const message = (err as { message?: string })?.message ?? String(err);
      logEvent('auth_gate_otp_send_fail', { error_code: code });
      console.error('AuthGate OTP send failed:', code, message, err);
      // Surface the REAL error (code + message). Previously this was swallowed
      // into a generic line, so config / test-number problems looked like
      // "nothing happened". Now it's diagnosable.
      setError(`OTP nahi bheja ja saka [${code}]. ${message}`);
      Alert.alert('OTP nahi bheja ja saka', `[${code}]\n${message}`);
    } finally {
      setLoading(false);
    }
  }, [phoneValid, loading, e164, onSignIn, onClose, router]);

  // ── Peek mode handler ─────────────────────────────────────────────────────
  const handlePeek = useCallback(() => {
    logEvent('auth_gate_peek_link_tap');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // ── Dismiss handler ───────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    logEvent('auth_gate_dismissed');
    onClose();
  }, [onClose]);

  // ── CTA press scale ───────────────────────────────────────────────────────
  const ctaPressIn  = () =>
    Animated.timing(ctaScale, { toValue: T.pressScale, duration: T.pressDuration, useNativeDriver: true }).start();
  const ctaPressOut = () =>
    Animated.timing(ctaScale, { toValue: 1, duration: T.pressDuration, useNativeDriver: true }).start();

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      maxHeight={SCREEN_H * 0.5}   // § 20: Half sheet (50%)
      preventBackdropDismiss={false} // LAW 4: dismissible (peek-before-join)
    >
      <KeyboardAvoidingView
        style={S.kvFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={16}
      >
        {/* ── Scrollable body: [2] [3] [4] [5] ────────────────────────── */}
        <ScrollView
          style={S.scroll}
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          accessibilityRole="scrollview"
        >

          {/* [2] HERO ZONE (§ [2]: 80×80 · scale spring · gold-toned) */}
          <Animated.View
            style={[
              S.heroZone,
              { opacity: heroOpacity, transform: [{ scale: heroScale }] },
            ]}
            accessibilityElementsHidden
          >
            {/* Outer glow ring */}
            <View style={S.heroGlow}>
              {/* Inner circle */}
              <View style={S.heroCircle}>
                {/* Lock icon (security) */}
                <View style={S.heroLockWrap}>
                  <Feather name="lock" size={32} color={T.gold600} />
                </View>
                {/* Heart badge (warmth) */}
                <View style={S.heroHeartBadge}>
                  <Feather name="heart" size={14} color={T.gold700} />
                </View>
              </View>
            </View>
          </Animated.View>

          {/* [2] Subtitle context (§ [2]: 12px/600/gold-700) */}
          <Text style={S.heroSubtitle}>Bas ek step aur...</Text>

          {/* [3] HEADLINE (§ [3]: 22px/700/ink-950 centered · 16px below hero) */}
          <Text
            style={S.headline}
            accessibilityRole="header"
            numberOfLines={2}
          >
            Sector mein join hone ke liye sign in karo
          </Text>

          {/* [3] SUBHEAD (§ [3]: 15px/400/ink-600 · 12px below headline) */}
          <Text
            style={S.subhead}
            accessibilityRole="text"
            numberOfLines={2}
          >
            1 Lakh+ users already typing · aap bhi pehle ho!
          </Text>

          {/* [4] FEATURE STRIP (§ [4]: cream-100 · 16px radius · stagger) */}
          <View style={S.featureStrip}>
            {FEATURES.map((benefit, i) => (
              <Animated.View
                key={benefit}
                style={[
                  S.featureRow,
                  {
                    opacity:   featureOpacities[i],
                    transform: [{ translateY: featureTranslates[i] }],
                  },
                ]}
                accessibilityRole="text"
              >
                <View style={S.featureCheck}>
                  <Feather name="check" size={14} color={T.emerald600} />
                </View>
                <Text style={S.featureText}>{benefit}</Text>
              </Animated.View>
            ))}
          </View>

          {/* [5] PHONE INPUT (§ [5]: 52px H · +91 prefix · phone-pad) */}
          <View style={S.inputSection}>
            <Text style={S.inputLabel}>Phone number</Text>
            <View
              style={[
                S.inputRow,
                focused && S.inputRowFocused,
              ]}
            >
              {/* +91 prefix */}
              <View style={S.prefixBox}>
                <Text style={S.prefixText}>+91</Text>
              </View>
              <View style={S.prefixDivider} />

              {/* 10-digit number input */}
              <TextInput
                ref={inputRef}
                style={S.textInput}
                value={phone}
                onChangeText={handlePhoneChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="98765 43210"
                placeholderTextColor={T.ink500}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                autoFocus
                accessibilityRole="none"
                accessibilityLabel="Phone number · 10 digits required"
                accessibilityRequired
                textContentType="telephoneNumber"
                importantForAutofill="yes"
              />
            </View>

            {/* Inline error (§ [6]: "On fail: inline error in helper area below input") */}
            {error != null && (
              <Text style={S.errorText} accessibilityRole="alert">
                {error}
              </Text>
            )}
          </View>

        </ScrollView>

        {/* ── Sticky footer: [6] CTA + Terms · [7] Peek link ─────────── */}
        <View
          style={[S.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          {/* Top hairline (§ [6]: 1px cream-400 above CTA) */}
          <View style={S.footerDivider} />

          {/* [6.A] Primary Continue CTA */}
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <Pressable
              style={[S.cta, !phoneValid && S.ctaDisabled]}
              onPress={handleContinue}
              onPressIn={ctaPressIn}
              onPressOut={ctaPressOut}
              // Only block taps while a send is in flight. When the number is
              // incomplete the button stays dimmed but tappable, so a press
              // gives feedback instead of silently doing nothing.
              disabled={loading}
              android_ripple={{ color: T.gold700, borderless: false }}
              accessibilityRole="button"
              accessibilityLabel="Continue · OTP bhejenge"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                /* Inline loading state */
                <View style={S.ctaLoadingRow}>
                  <Feather name="loader" size={18} color={T.white} />
                  <Text style={S.ctaText}>OTP bhej rahe hain...</Text>
                </View>
              ) : (
                <Text style={S.ctaText}>Continue · OTP bhejenge</Text>
              )}
            </Pressable>
          </Animated.View>

          {/* [6.B] Privacy disclosure — DPDP Act 2023 mandate (§ [6]) */}
          <View style={S.privacyRow}>
            <Text style={S.privacyText}>
              Continue karne ka matlab{' '}
              <Text
                style={S.privacyLink}
                onPress={() => Linking.openURL('https://crowdworld.in/terms')}
                accessibilityRole="link"
                accessibilityLabel="Terms of Service"
              >
                Terms
              </Text>
              {' & '}
              <Text
                style={S.privacyLink}
                onPress={() => Linking.openURL('https://crowdworld.in/privacy')}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
              >
                Privacy
              </Text>
              {' se agree'}
            </Text>
          </View>

          {/* [7] PEEK MODE LINK — LAW 4 explicit (§ [7]) */}
          <TouchableOpacity
            style={S.peekLink}
            onPress={handlePeek}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Continue without signing up · browse read-only"
          >
            <Text style={S.peekText}>
              Pehle dekho · sign up baad mein
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </BottomSheet>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // ── Keyboard-avoiding wrapper ─────────────────────────────────────────────
  kvFlex: {
    flex: 1,
  },

  // ── Scrollable body ───────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: T.sheetPadH,
    paddingTop:        16,           // § Spacing: hero zone 16px top
    paddingBottom:     8,
  },

  // ── [2] Hero zone ─────────────────────────────────────────────────────────
  heroZone: {
    alignItems:    'center',
    marginBottom:  8,                // gap before subtitle
  },
  heroGlow: {
    width:           T.heroCircle,
    height:          T.heroCircle,
    borderRadius:    T.heroCircle / 2,
    backgroundColor: palette.gold[50],
    alignItems:      'center',
    justifyContent:  'center',
  },
  heroCircle: {
    width:           T.heroSize,
    height:          T.heroSize,
    borderRadius:    T.heroSize / 2,
    backgroundColor: palette.cream[100],
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(201,162,39,0.30)',
        shadowOffset:  { width: 0, height: 4 },
        shadowRadius:  12,
        shadowOpacity: 1,
      },
      android: { elevation: 4 },
    }),
  },
  heroLockWrap: {
    marginTop: 4,                    // slight upward offset for lock icon
  },
  heroHeartBadge: {
    position:        'absolute',
    bottom:           8,
    right:            8,
    width:            22,
    height:           22,
    borderRadius:     11,
    backgroundColor:  palette.white,
    alignItems:       'center',
    justifyContent:   'center',
    borderWidth:      1,
    borderColor:      palette.gold[300],
  },
  heroSubtitle: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   12,
    fontWeight: '600',
    color:      T.gold700,           // § [2]: gold-700
    textAlign:  'center',
    marginBottom: 16,                // § Spacing: hero → headline 16px
  },

  // ── [3] Headline + Subhead ────────────────────────────────────────────────
  headline: {
    fontFamily:   FONT_BODY.bold,
    fontSize:     22,                // § [3]: 22px
    fontWeight:   '700',
    color:        T.ink950,
    textAlign:    'center',
    lineHeight:   30,
    marginBottom: 12,                // § Spacing: headline → subhead 12px
  },
  subhead: {
    fontFamily:   FONT_BODY.regular,
    fontSize:     15,                // § [3]: 15px
    fontWeight:   '400',
    color:        T.ink600,
    textAlign:    'center',
    lineHeight:   22,
    marginBottom: 16,                // § Spacing: subhead → feature strip 16px
  },

  // ── [4] Feature strip ─────────────────────────────────────────────────────
  featureStrip: {
    backgroundColor: T.cream100,     // § [4]: cream-100 bg
    borderRadius:    T.featureRadius,
    padding:         T.featurePad,
    gap:              8,             // § [4]: 8px gaps
    marginBottom:    24,             // § Spacing: feature strip → phone input 24px
  },
  featureRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             10,
    minHeight:       24,             // § [4]: 24px H per row
  },
  featureCheck: {
    width:           20,
    height:          20,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:       0,
  },
  featureText: {
    fontFamily: FONT_BODY.regular,
    fontSize:   13,                  // § [4]: 13px
    fontWeight: '400',
    color:      T.ink700,
    lineHeight: 18,
    flex:       1,
  },

  // ── [5] Phone input ───────────────────────────────────────────────────────
  inputSection: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   13,                  // § [5]: 13px/600/ink-600
    fontWeight: '600',
    color:      T.ink600,
  },
  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          T.inputH,       // § [5]: 52px H
    backgroundColor: T.white,
    borderRadius:    T.inputRadius,  // § [5]: 12px radius
    borderWidth:     1,
    borderColor:     T.cream400,     // § [5]: 1px cream-400 idle
    overflow:        'hidden',
  },
  inputRowFocused: {
    borderWidth:  2,
    borderColor:  T.gold600,         // § [5]: 2px gold-600 focus
  },
  prefixBox: {
    width:           T.prefixW,      // § [5]: 60px W
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 12,
  },
  prefixText: {
    fontFamily: FONT_BODY.semiBold,
    fontSize:   16,
    fontWeight: '600',
    color:      T.ink950,
  },
  prefixDivider: {
    width:           1,
    height:          28,
    backgroundColor: T.cream400,     // § [5]: 1px right divider
  },
  textInput: {
    flex:        1,
    paddingHorizontal: 16,           // § [5]: 16px L padding
    fontSize:    16,                 // § [5]: 16px/600/ink-950
    fontFamily:  FONT_BODY.semiBold,
    fontWeight:  '600',
    color:       T.ink950,
    height:      '100%',
  },
  errorText: {
    fontFamily: FONT_BODY.regular,
    fontSize:   12,
    fontWeight: '400',
    color:      palette.crimson[600],
    lineHeight: 16,
    marginTop:  2,
  },

  // ── [6][7] Sticky footer ──────────────────────────────────────────────────
  footer: {
    paddingHorizontal: T.sheetPadH,
    paddingTop:        16,
    gap:                0,
    backgroundColor:   T.white,
  },
  footerDivider: {
    height:          1,
    backgroundColor: T.cream400,     // § [6]: top hairline 1px cream-400
    marginBottom:    16,
  },

  // [6.A] Continue CTA (54px · gold-600 · § [6])
  cta: {
    height:          T.ctaH,         // § [6]: 54px H
    borderRadius:    T.ctaRadius,
    backgroundColor: T.gold600,
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      ios: {
        shadowColor:   'rgba(201,162,39,0.40)',
        shadowOffset:  { width: 0, height: 4 },
        shadowRadius:  12,
        shadowOpacity: 1,
      },
      android: { elevation: 4 },
    }),
  },
  ctaDisabled: {
    backgroundColor: palette.gold[300],  // § [6]: disabled until 10 digits
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  ctaText: {
    fontFamily:    FONT_BODY.bold,
    fontSize:      16,
    fontWeight:    '700',
    color:         T.white,
    letterSpacing: 0.2,
  },
  ctaLoadingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             8,
  },

  // [6.B] Privacy disclosure (§ [6]: DPDP mandate)
  privacyRow: {
    marginTop:      12,              // § Spacing: CTA → privacy 12px
    alignItems:     'center',
  },
  privacyText: {
    fontFamily:  FONT_BODY.regular,
    fontSize:    11,                 // § [6]: 11px/400/ink-500
    fontWeight:  '400',
    color:       T.ink500,
    textAlign:   'center',
    lineHeight:  16,
  },
  privacyLink: {
    fontFamily:         FONT_BODY.semiBold,
    fontWeight:         '600',
    color:              T.gold700,   // § [6]: gold-700 underlined
    textDecorationLine: 'underline',
  },

  // [7] Peek link (§ [7]: 13px/500/ink-500 underlined · LAW 4)
  peekLink: {
    alignItems:      'center',
    paddingVertical:  8,
    marginTop:        4,             // § Spacing: privacy → peek 4px
  },
  peekText: {
    fontFamily:         FONT_BODY.medium,
    fontSize:           13,          // § [7]: 13px/500/ink-500
    fontWeight:         '500',
    color:              T.ink500,
    textDecorationLine: 'underline',
    textAlign:          'center',
  },
});

export default AuthGateSheet;

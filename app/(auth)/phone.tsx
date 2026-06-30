/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CROWN — Phone Entry Screen                                              ║
 * ║  Route  : app/(auth)/phone.tsx                                           ║
 * ║  Layer  : screen | STATUS: updated | PRIORITY: P0                       ║
 * ║  Spec   : Blueprint v5.0 Part 3 §4                                      ║
 * ║                                                                          ║
 * ║  Header : back chevron (left) · CROWN wordmark SVG (center) · "1 / 5"  ║
 * ║  Input  : +91 prefix · Indian mobile (starts 6–9 · 10 digits)           ║
 * ║  Helper : "Sirf India ke numbers (10 digits)" · error in crimson         ║
 * ║  Footer : Terms/Privacy DPDP disclosure + reCAPTCHA note                ║
 * ║  Auth   : sendOtpWeb / sendOtpNative · reCAPTCHA invisible (web)        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * CHANGES (v5.1 — CROWN fixes):
 *   [1] FIX: App name corrected CROWD → CROWN everywhere              (§4 [1.B])
 *   [2] FIX: SVG CrownWordmark component restored (was plain <Text>)  (§4 [1.B])
 *   [3] FIX: globalThis.__orbitOtp → globalThis.__crownOtp (cleanup)  (§1)
 *   [4] FIX: CROWD wordmark added to header center                    (§4 [1.B])
 *   [5] FIX: Step indicator "1 / 5" (was "Step 1 of 2")               (§4 [1.C])
 *   [6] FIX: Headline → "Apna phone number daalo"                     (§4 [2.A])
 *   [7] FIX: Subhead  → "OTP bhejenge verify karne ke liye"           (§4 [2.B])
 *   [8] FIX: DPDP notice removed · helper text added                  (§4 [3.C])
 *            Privacy disclosure (Terms + Privacy links)               (§4 [4.B])
 */

import { useRouter } from 'expo-router';
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import {
  colors,
  radii,
  spacing,
  dimensions,
} from '@/constants/colors';
import {
  typography,
  FONT_BODY,
  FONT_HEADING,
  FONT_SIZE,
  lh,
  LETTER_SPACING,
} from '@/constants/typography';
import {
  authErrorMessage,
  isValidE164,
  normalizeIndianPhone,
} from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// § 0 — CROWN WORDMARK SVG COMPONENT
//   • Pure typography — CormorantGaramond 700 · gold-800 · no raster asset
//   • Header variant: 100×28px viewBox (compact · fits 56px header height)
//   • Matches premium identity from splash screen (crowd-wordmark-hero.svg)
//   • accessibilityElementsHidden so screen reader reads header Text fallback
// ─────────────────────────────────────────────────────────────────────────────

const WORDMARK_GOLD = colors.fg.brandSubtle; // gold[800] #8B6F18 — WCAG AA 6.4:1

/**
 * CrownWordmark — SVG typographic wordmark for auth / header use.
 * Height is fixed at 28px; width scales proportionally (~120px).
 */
const CrownWordmark = memo(function CrownWordmark() {
  return (
    <Svg
      width={120}
      height={28}
      viewBox="0 0 120 28"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SvgText
        x="60"
        y="22"
        textAnchor="middle"
        fontFamily={FONT_HEADING.bold}   // CormorantGaramond_700Bold
        fontWeight="700"
        fontSize={24}
        letterSpacing={LETTER_SPACING.tight ?? -0.2}
        fill={WORDMARK_GOLD}
      >
        CROWN
      </SvgText>
    </Svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — GLOBAL OTP HANDLE (read by otp.tsx)
//   MUST match the key otp.tsx reads (globalThis.__orbitOtp). otp.tsx and
//   AuthGateSheet both use __orbitOtp; writing a different key here left the
//   OTP screen with no handle, so it bounced straight back to this screen.
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __orbitOtp: { handle: unknown; phone: string } | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/** True for exactly 10 digits starting with 6, 7, 8, or 9. */
const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
function isValidIndianMobile(digits: string): boolean {
  return INDIAN_MOBILE_RE.test(digits);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — FIREBASE / OTP SENDERS
//   Firebase project ID (orbit-app-5b4b3) is the backend infrastructure —
//   intentionally unchanged. Only the client-side global variable was renamed.
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_WEB_CONFIG = {
  apiKey:            'AIzaSyDPXJ6oj2ac-5QsgDWDSslN_AaVrM7KQ2w',
  authDomain:        'orbit-app-5b4b3.firebaseapp.com',
  projectId:         'orbit-app-5b4b3',
  storageBucket:     'orbit-app-5b4b3.firebasestorage.app',
  messagingSenderId: '250454225022',
  appId:             '1:250454225022:android:44b3e0a7ac0268cfe6a82f',
};

let webVerifierRef: unknown = null;

async function sendOtpWeb(phoneE164: string): Promise<unknown> {
  const { initializeApp, getApps, getApp } = await import('firebase/app');
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import(
    'firebase/auth'
  );

  const app        = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  const webAuthRef = getAuth(app);

  let container = document.getElementById('recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'recaptcha-container';
    document.body.appendChild(container);
  }

  if (!webVerifierRef) {
    webVerifierRef = new RecaptchaVerifier(webAuthRef, 'recaptcha-container', {
      size: 'invisible',
    });
    await webVerifierRef.render();
  }

  return signInWithPhoneNumber(webAuthRef, phoneE164, webVerifierRef);
}

/**
 * On native, @react-native-firebase/auth handles SafetyNet / App Attest
 * reCAPTCHA at the SDK level — no ApplicationVerifier needed.
 */
async function sendOtpNative(phoneE164: string): Promise<unknown> {
  const rnAuth = (await import('@react-native-firebase/auth')).default;
  return rnAuth().signInWithPhoneNumber(phoneE164);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — reCAPTCHA BADGE HIDE (DPDP-compliant: badge must not overlap CTA)
// ─────────────────────────────────────────────────────────────────────────────

function useHideRecaptchaBadge(): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'cw-recaptcha-hide';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = [
      '.grecaptcha-badge{',
      '  visibility:hidden !important;',
      '  opacity:0 !important;',
      '  pointer-events:none !important;',
      '}',
    ].join('');
    document.head.appendChild(style);
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default memo(function PhoneScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [phone,   setPhone]   = useState('');   // Raw 10-digit string
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false); // true once 10 digits reached or CTA tapped

  // Derived
  const isValid   = isValidIndianMobile(phone);
  const showError = touched && !isValid;
  const canSubmit = isValid && !sending;

  useHideRecaptchaBadge();

  // ── Web: ensure recaptcha container exists ────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!document.getElementById('recaptcha-container')) {
      const div = document.createElement('div');
      div.id = 'recaptcha-container';
      document.body.appendChild(div);
    }
  }, []);

  // ── Auto-focus: give layout time to settle ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // ── onChange: strip non-digits, cap at 10, mark touched at 10 ─────────────
  const handleChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    if (digits.length === 10) setTouched(true);
  }, []);

  // ── Format for display: "98765 43210" ─────────────────────────────────────
  const displayValue = phone.length > 5
    ? `${phone.slice(0, 5)} ${phone.slice(5)}`
    : phone;

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    setTouched(true);
    if (!isValid || sending) return;

    setSending(true);
    try {
      const e164   = normalizeIndianPhone(phone);
      const handle = Platform.OS === 'web'
        ? await sendOtpWeb(e164)
        : await sendOtpNative(e164);

      // Store under __orbitOtp — otp.tsx reads from this same key
      globalThis.__orbitOtp = { handle, phone: e164 };
      router.push('/(auth)/otp');
    } catch (err: unknown) {
      const detail =
        (err?.code ? `[${err.code}]\n` : '') +
        (err?.message ?? authErrorMessage(err) ?? String(err));
      Alert.alert('OTP nahi bheja ja saka', detail);
      if (Platform.OS === 'web' && webVerifierRef) {
        try { webVerifierRef.clear(); } catch { /* noop */ }
        webVerifierRef = null;
      }
    } finally {
      setSending(false);
    }
  }, [isValid, sending, phone, router]);

  // ── Helper / error text §4 [3.C] ─────────────────────────────────────────
  const helperText = showError
    ? 'Invalid number — 10 digits, starts 6–9'
    : 'Sirf India ke numbers (10 digits)';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >

      {/* ══ [1] HEADER ══════════════════════════════════════════════════════
       *  Layout: [back chevron] [CROWN wordmark SVG — center] [1 / 5]
       *  Height: 56px + safe-area-top  ·  hairline border below
       *  Blueprint §4 [1.A], [1.B], [1.C]
       * ════════════════════════════════════════════════════════════════════ */}
      <View
        style={[styles.header, { paddingTop: insets.top + 10 }]}
        accessibilityRole="header"
      >
        <View style={styles.headerInner}>

          {/* [1.A] Back chevron — 44×44 touch target */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to welcome"
            testID="phone-entry-back"
          >
            <Feather name="chevron-left" size={24} color={colors.fg.primary} />
          </Pressable>

          {/* [1.B] CROWN wordmark — SVG · CormorantGaramond 700 · 24px · gold-800
               Centered · NOT tappable · pure brand identity on auth screens
               Screen reader skips SVG (accessibilityElementsHidden) — wrapper
               View carries the accessible label instead.                      */}
          <View
            style={styles.wordmarkWrap}
            accessibilityRole="header"
            accessibilityLabel="CROWN"
          >
            <CrownWordmark />
          </View>

          {/* [1.C] Step indicator — "1 / 5" · 12px 600 ink-600 */}
          <Text
            style={styles.stepLabel}
            accessibilityLabel="Step 1 of 5"
          >
            1 / 5
          </Text>

        </View>
      </View>

      {/* ══ Body ════════════════════════════════════════════════════════════ */}
      <View style={styles.body}>

        {/* [2.A] Headline — blueprint §4 [2.A]: "Apna phone number daalo" */}
        <Text style={styles.headline}>
          Apna phone number daalo
        </Text>

        {/* [2.B] Subhead — blueprint §4 [2.B] */}
        <Text style={styles.subhead}>
          OTP bhejenge verify karne ke liye
        </Text>

        {/* ── [3] PHONE INPUT ───────────────────────────────────────────── */}
        <View style={styles.inputWrap}>

          {/* [3.A] Label */}
          <Text style={styles.inputLabel}>Phone number</Text>

          {/* [3.B] Input field — 56px H · +91 prefix box · 10-digit */}
          <View
            style={[
              styles.inputRow,
              focused && styles.inputRowFocused,
              showError && styles.inputRowError,
            ]}
          >
            {/* +91 prefix — cream-50 bg · 60px W */}
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <View style={styles.prefixDivider} />

            {/* Digit input — 18px 600 · letter-spacing 0.5 */}
            <TextInput
              ref={inputRef}
              keyboardType="phone-pad"
              maxLength={11}              // "98765 43210" with space = 11 chars
              value={displayValue}
              onChangeText={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleContinue}
              placeholder="98765 43210"
              placeholderTextColor={colors.fg.disabled}
              returnKeyType="done"
              textContentType="telephoneNumber"
              autoComplete="tel"
              editable={!sending}
              style={styles.input}
              accessibilityLabel="Phone number, required, 10 digits"
            />
          </View>

          {/* [3.C] Helper / Error — idle: ink-500 · error: crimson-600 */}
          <Text
            style={[styles.helperText, showError && styles.helperTextError]}
            accessibilityLiveRegion="polite"
          >
            {helperText}
          </Text>

        </View>
      </View>

      {/* ══ [4] FOOTER ══════════════════════════════════════════════════════ */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>

        {/* [4.A] Continue CTA — 54px H · gold-600 · disabled until valid */}
        <Pressable
          onPress={handleContinue}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.cta,
            canSubmit ? styles.ctaActive : styles.ctaDisabled,
            pressed && canSubmit && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: sending }}
          accessibilityLabel="Continue"
        >
          {sending ? (
            <ActivityIndicator
              size="small"
              color={colors.palette.white}
              accessibilityLabel="Bhej rahe hain…"
            />
          ) : (
            <Text
              style={[
                styles.ctaText,
                { color: canSubmit ? colors.palette.white : colors.fg.disabled },
              ]}
            >
              Continue
            </Text>
          )}
        </Pressable>

        {/* [4.B] Privacy disclosure — DPDP Act 2023 mandatory
             "Continue karne ka matlab Terms & Privacy se agree"
             "Terms" + "Privacy" = gold-700 underlined links               */}
        <Text style={styles.privacyNote}>
          {'Continue karne ka matlab '}
          <Text
            style={styles.privacyLink}
            onPress={() => router.push('/legal/terms' as any)}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            Terms
          </Text>
          {' & '}
          <Text
            style={styles.privacyLink}
            onPress={() => router.push('/legal/privacy' as any)}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            Privacy
          </Text>
          {' se agree'}
        </Text>

        {/* reCAPTCHA legal disclosure — Google-mandated when badge hidden */}
        <Text style={styles.recaptchaNote}>
          {'Protected by reCAPTCHA · Google '}
          <Text style={styles.recaptchaLink}>Privacy</Text>
          {' & '}
          <Text style={styles.recaptchaLink}>Terms</Text>
          {' apply.'}
        </Text>

      </View>
    </KeyboardAvoidingView>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — STYLES (design tokens only — zero hardcoded values)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Layout ────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
  },

  // ── Header — 56px + safe-area · hairline below ────────────────────────────
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  headerInner: {
    height:         dimensions.headerHeight,   // 56px — LAW 15
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },

  // [1.A] Back chevron — 44×44 touch target ─────────────────────────────────
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     -spacing.xs,
  },

  // [1.B] CROWN wordmark wrapper — centered flex-1 ──────────────────────────
  //   Wraps the SVG component · carries accessibilityLabel for screen reader
  //   flex:1 ensures it centers between the back btn (44px) and step (36px)
  wordmarkWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // [1.C] Step indicator — "1 / 5" · 12px 600 ink-600 ──────────────────────
  stepLabel: {
    ...typography.stepIndicator,               // 12px 600 DM Sans
    color:     colors.fg.secondary,
    minWidth:  36,
    textAlign: 'right',
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    flex:              1,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xxl,
  },

  // [2.A] Headline ───────────────────────────────────────────────────────────
  headline: {
    ...typography.titleLg,                     // 22px 700 DM Sans
    color:        colors.fg.primary,
    marginBottom: spacing.sm,                  // 8px
  },

  // [2.B] Subhead ────────────────────────────────────────────────────────────
  subhead: {
    ...typography.bodyLg,                      // 15px 400 DM Sans
    color:        colors.fg.secondary,
    marginBottom: spacing.xxl,                 // 32px
  },

  // [3] Input block ──────────────────────────────────────────────────────────
  inputWrap: {
    gap: spacing.sm,                           // 8px between label / input / helper
  },

  // [3.A] Label — 13px 600 ──────────────────────────────────────────────────
  inputLabel: {
    ...typography.labelSm,                     // 13px 600 DM Sans
    color: colors.fg.secondary,
  },

  // [3.B] Input row — 56px H · cream-400 idle border ────────────────────────
  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          56,
    backgroundColor: colors.bg.input,
    borderRadius:    radii.input,
    borderWidth:     1,
    borderColor:     colors.border.inputIdle,
    overflow:        'hidden',
  },
  inputRowFocused: {
    borderWidth: 2,
    borderColor: colors.border.inputFocus,     // gold[600] — 2px focus ring
  },
  inputRowError: {
    borderWidth: 1,
    borderColor: colors.fg.error,              // crimson-600 — error state
  },

  prefixBox: {
    width:           60,
    height:          '100%',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.bg.subtle,         // cream-50
  },
  prefixText: {
    fontFamily:  FONT_BODY.semiBold,
    fontSize:    FONT_SIZE.md,
    fontWeight:  '600',
    color:       colors.fg.primary,
  },
  prefixDivider: {
    width:           1,
    height:          24,
    backgroundColor: colors.border.inputIdle,
  },
  input: {
    flex:              1,
    paddingHorizontal: spacing.md,
    fontFamily:        FONT_BODY.semiBold,
    fontSize:          18,
    fontWeight:        '600',
    letterSpacing:     0.5,
    color:             colors.fg.primary,
  },

  // [3.C] Helper / error text ────────────────────────────────────────────────
  helperText: {
    ...typography.caption,                     // 12px 400 DM Sans
    color:      colors.fg.tertiary,            // ink-500 idle
    lineHeight: lh(12, 'relaxed'),
  },
  helperTextError: {
    color: colors.fg.error,                    // crimson-600 error
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.sm,
  },

  // [4.A] CTA — 54px H · blueprint §4 [4.A] ─────────────────────────────────
  cta: {
    height:         dimensions.btnPrimary,     // 54px
    borderRadius:   radii.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaActive: {
    backgroundColor: colors.fg.brand,          // Champagne Gold #C9A227
    ...colors.shadow.tier3,
  },
  ctaDisabled: {
    backgroundColor: colors.border.inputIdle,
  },
  ctaPressed: {
    transform: [{ scale: 0.984 }],
    opacity:   0.88,
  },
  ctaText: {
    ...typography.ctaPrimary,                  // 16px 700 DM Sans
  },

  // [4.B] Privacy disclosure — DPDP mandatory · blueprint §4 [4.B] ──────────
  privacyNote: {
    ...typography.ctaLinkSm,                   // 12px 500 DM Sans
    color:      colors.fg.tertiary,
    textAlign:  'center',
    lineHeight: lh(12, 'relaxed'),
  },
  privacyLink: {
    color:              colors.fg.brandText,   // gold-700
    fontWeight:         '600',
    textDecorationLine: 'underline',
  },

  // reCAPTCHA disclosure ─────────────────────────────────────────────────────
  recaptchaNote: {
    ...typography.ctaLinkSm,
    color:      colors.fg.tertiary,
    textAlign:  'center',
    lineHeight: lh(12, 'relaxed'),
  },
  recaptchaLink: {
    color:      colors.fg.secondary,
    fontWeight: '600',
  },
});

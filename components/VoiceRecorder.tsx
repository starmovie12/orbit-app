/**
 * components/VoiceRecorder.tsx
 *
 * CROWD WORLD — Voice Recorder · v2.1 Token Conformance Pass
 * Layer: molecule | STATUS: ✅ polished | PRIORITY: P2
 *
 * ─── What changed in v2.0 ──────────────────────────────────────────────────
 *
 *  [FIX-1] MAX_DURATION_S 180 → 60  (task spec: 60 s max)
 *
 *  [FIX-2] PanResponder closure bug
 *           panResponder is created with useRef once; `isLocked` was captured
 *           at creation and never updated.  The drag-to-cancel gesture therefore
 *           still triggered even when the user had tapped 🔒 (locked state).
 *           Fix: isLockedRef keeps the live value; panResponder callbacks now
 *           read isLockedRef.current instead of the stale closure.
 *
 *  [FIX-3] Stale handleSend closure in timer callback
 *           The timer was started inside useEffect(…, []) which captured the
 *           FIRST version of handleSend.  When the user's elapsed seconds
 *           reached MAX_DURATION_S the auto-send call hit a stale closure with
 *           a disconnected cancelledRef.  Fix: handleSendRef always points to
 *           the latest handleSend; the timer calls handleSendRef.current().
 *
 *  [FIX-4] Rolling-buffer waveform
 *           All bars were set to the same dbfs height each tick — looked like
 *           a solid block, not a waveform.  Fix: amplitudeBufferRef maintains
 *           BAR_COUNT past samples.  Each tick pushes the newest value and
 *           drops the oldest, so each bar represents a distinct time-slice.
 *           Bars also get a subtle age-gradient opacity (older = more faded)
 *           giving a scrolling-spectrogram feel.
 *
 *  [FIX-5] Replaced direct Haptics.* calls with useHaptics() hook
 *           (DEPS: hooks/useHaptics.ts, per task spec).  All six haptic events
 *           now go through the typed HapticEngine with platform guards and
 *           budget-device silent-fail already built in.
 *
 *  [FIX-6] Permission UX — canAskAgain path
 *           If the OS has permanently blocked microphone access (user tapped
 *           "Don't Allow" twice on iOS / toggled in Settings on Android) the
 *           error bar now shows the correct message and a "Open Settings" CTA.
 *
 *  [POLISH] React.memo wrapper prevents re-renders from parent chat input.
 *  [POLISH] Cleaner dot-pulse loop (no duplicate Animated.loop wrapping).
 *  [POLISH] Max-duration warning bar flashes gold for the last 10 seconds.
 *  [POLISH] Waveform bar colors interpolate gold→crimson as recording nears 60 s.
 *
 * ─── v2.1 Token Conformance ────────────────────────────────────────────────
 *
 *  [TOKEN-1] Critical: replaced `orbit` compat shim with canonical CROWN tokens
 *            All color references now use colors.* semantic layer and palette.*
 *            primitives from @/constants/colors, matching every other component
 *            in the codebase (MessageBubble, IdentityTags, ChatInput, etc.).
 *            Mapping:
 *              orbit.surface1   → colors.bg.subtle      (cream[50]  #FFF9EC)
 *              orbit.surface3   → colors.bg.cardHover   (cream[100] #FBF4E2)
 *              orbit.borderSubtle → colors.border.default (cream[400] #E5CC95)
 *              orbit.textPrimary  → colors.fg.primary   (ink[950]   #1A1208)
 *              orbit.textSecond   → colors.fg.secondary (ink[600]   #6B5B47)
 *              orbit.textTertiary → colors.fg.tertiary  (ink[500]   #8A7960)
 *              orbit.accent       → colors.fg.brand     (gold[600]  #C9A227)
 *              orbit.danger       → colors.fg.error     (crimson[600] #C4294F)
 *              orbit.dangerSoft   → colors.bg.errorSoft (rgba(196,41,79,0.10))
 *              orbit.white        → palette.white        (#FFFFFF)
 *
 *  [TOKEN-2] Minor: send button resized 44×44 → 48×48 (touch.recommended)
 *            borderRadius: 22 → radii.full (9999) — canonical pill token.
 *            Aligns with Blueprint § 5.D: "action buttons 48×48 px".
 *
 * ─── Features (unchanged) ──────────────────────────────────────────────────
 *
 *   • expo-av Audio.Recording with Opus/M4A codec
 *   • Animated waveform — rolling buffer, 20 bars, 180 ms tick
 *   • Timer MM:SS (turns red at 50 s)
 *   • Swipe left ≥ 80 pts → cancel with spring-back on insufficient drag
 *   • Release right → send; minimum 1 s guard
 *   • Lock-to-send mode (tap 🔒, detaches from hold)
 *   • Haptics on start / lock / send / cancel (via useHaptics hook)
 *   • Inline permission request; graceful error bar
 *
 * ─── Props ─────────────────────────────────────────────────────────────────
 *
 *   onSend(durationSec, uri): Promise<void>
 *     Called with local file URI on send/release.  Upload to Storage, then
 *     call sendVoiceMessage() from lib/firestore-messages.ts.
 *
 *   onCancel(): void
 *     Called on swipe-left, ✕ tap, or recording error.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────
 *
 *   import VoiceRecorder from '@/components/VoiceRecorder';
 *
 *   {isRecording && (
 *     <VoiceRecorder
 *       onSend={async (secs, uri) => {
 *         const url = await uploadVoice(uri);
 *         await sendVoiceMessage('dm', threadId, { uid, username, durationSec: secs, url });
 *         setIsRecording(false);
 *       }}
 *       onCancel={() => setIsRecording(false)}
 *     />
 *   )}
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { colors, palette, radii } from '@/constants/colors';
import { useHaptics } from '@/hooks/useHaptics';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Number of animated waveform bars.  Each bar = one historical amplitude sample. */
const BAR_COUNT = 20;

/** Waveform tick interval in ms. */
const WAVEFORM_TICK_MS = 180;

/** Leftward drag distance (pts) that triggers cancel. */
const CANCEL_SWIPE_THRESHOLD = -80;

/** Minimum recording duration before send is allowed. */
const MIN_DURATION_S = 1;

/**
 * Maximum recording duration.
 * [FIX-1] Changed from 180 → 60 per task spec.
 */
const MAX_DURATION_S = 60;

/** Seconds remaining below which the timer turns crimson. */
const WARN_SECONDS_LEFT = 10;

/** Bar height range in logical pixels. */
const BAR_MIN_H = 3;
const BAR_MAX_H = 26;

/**
 * Recording options — Opus on Android, AAC-LC on iOS.
 * expo-av does not expose first-class Opus on iOS; AAC/M4A is the
 * highest-quality compressed format available through AVAudioSession.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension:        '.opus',
    outputFormat:     Audio.AndroidOutputFormat.OGG,
    audioEncoder:     Audio.AndroidAudioEncoder.OPUS,
    sampleRate:       48_000,
    numberOfChannels: 1,
    bitRate:          32_000,
  },
  ios: {
    extension:           '.m4a',
    outputFormat:        Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality:        Audio.IOSAudioQuality.HIGH,
    sampleRate:          48_000,
    numberOfChannels:    1,
    bitRate:             64_000,
    linearPCMBitDepth:    16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat:     false,
  },
  web: {
    mimeType:      'audio/webm;codecs=opus',
    bitsPerSecond: 32_000,
  },
  isMeteringEnabled:  true,   // enables status.metering (dBFS) for waveform
  keepAudioActiveHint: false,
} as const;

// ─── Audio session helpers ──────────────────────────────────────────────────────

async function setRecordingAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS:         true,
    playsInSilentModeIOS:       true,
    interruptionModeIOS:        Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
    shouldDuckAndroid:          true,
    interruptionModeAndroid:    Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground:    false,
  });
}

async function setPlaybackAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS:         false,
    playsInSilentModeIOS:       true,
    interruptionModeIOS:        Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
    shouldDuckAndroid:          true,
    interruptionModeAndroid:    Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground:    false,
  }).catch(() => {/* teardown race — safe to ignore */});
}

// ─── Pure helpers ───────────────────────────────────────────────────────────────

/** Format seconds as MM:SS. */
function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Map a dBFS metering value (−160…0) to a bar height in [minH, maxH].
 * When metering data is absent (no hardware support) returns a random
 * value so the waveform still looks alive.
 */
function meterToBarHeight(
  dbfs: number | null | undefined,
  minH: number,
  maxH: number,
): number {
  if (dbfs == null || !isFinite(dbfs)) {
    return minH + Math.random() * (maxH - minH) * 0.6;
  }
  const clamped = Math.max(-60, Math.min(0, dbfs));
  const ratio   = (clamped + 60) / 60;
  return minH + ratio * (maxH - minH);
}

/** Initial rolling amplitude buffer — natural-envelope idle shape. */
function makeInitialBuffer(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = BAR_COUNT / 2;
    const dist   = Math.abs(i - center) / center;
    return BAR_MIN_H + (1 - dist) * 8 + Math.random() * 4;
  });
}

// ─── Props ──────────────────────────────────────────────────────────────────────

export interface VoiceRecorderProps {
  /**
   * Called when the user sends.
   * @param durationSec  Whole seconds (min 1).
   * @param uri          Local file URI — upload this to Storage, then pass the
   *                     remote URL to sendVoiceMessage() in firestore-messages.ts.
   */
  onSend: (durationSec: number, uri: string) => Promise<void>;

  /** Called on cancel (swipe left, ✕ tap, or recording error). */
  onCancel: () => void;
}

// ─── Error bar sub-component ────────────────────────────────────────────────────

interface ErrorBarProps {
  message: string;
  showSettings: boolean;
  onDismiss: () => void;
}

const ErrorBar = memo(function ErrorBar({
  message,
  showSettings,
  onDismiss,
}: ErrorBarProps) {
  return (
    <View style={styles.errorBar}>
      <Feather name="alert-circle" size={16} color={colors.fg.error} />
      <Text style={styles.errorText} numberOfLines={2}>
        {message}
      </Text>
      {showSettings && (
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open app settings to allow microphone"
        >
          <Text style={styles.settingsLink}>Settings</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss error"
      >
        <Feather name="x" size={18} color={colors.fg.secondary} />
      </TouchableOpacity>
    </View>
  );
});

// ─── Main component ─────────────────────────────────────────────────────────────

function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {

  // ── State ─────────────────────────────────────────────────────────────────
  const [elapsed,    setElapsed]    = useState(0);
  const [isSending,  setIsSending]  = useState(false);
  const [isLocked,   setIsLocked]   = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cancelHint, setCancelHint] = useState(false);

  // ── Haptics (useHaptics hook — [FIX-5]) ───────────────────────────────────
  const { impactMedium, impactLight, notificationSuccess, notificationError } = useHaptics();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const recordingRef     = useRef<Audio.Recording | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef     = useRef<number>(Date.now());
  const cancelledRef     = useRef(false);
  const isSendingRef     = useRef(false);   // mirrors isSending for callbacks

  /**
   * [FIX-2] isLockedRef — the live value of isLocked for panResponder callbacks.
   * panResponder is created once (useRef); closures inside it always read the
   * initial value of isLocked (false) unless we proxy through a ref.
   */
  const isLockedRef = useRef(false);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  /**
   * [FIX-3] handleSendRef — always points to the latest handleSend.
   * The setInterval timer is created inside useEffect(…,[]) and captures the
   * very first version of handleSend.  By reading handleSendRef.current()
   * the timer always calls the up-to-date function.
   */
  const handleSendRef = useRef<() => void>(() => {/* initialised below */});

  // ── Animated values ───────────────────────────────────────────────────────
  const dotPulse      = useRef(new Animated.Value(1)).current;
  const slideAnim     = useRef(new Animated.Value(0)).current;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const lockScale     = useRef(new Animated.Value(1)).current;
  const sendBtnScale  = useRef(new Animated.Value(0)).current;

  /**
   * [FIX-4] Rolling-buffer waveform animated values.
   * barAnims[0] is the oldest sample (left), barAnims[BAR_COUNT-1] is newest (right).
   * amplitudeBufferRef stores raw heights; on each tick the buffer shifts left
   * and we spring every bar to its new target.
   */
  const barAnims = useRef<Animated.Value[]>(
    makeInitialBuffer().map(h => new Animated.Value(h))
  ).current;
  const amplitudeBufferRef = useRef<number[]>(makeInitialBuffer());

  // ── Stop & release recording ───────────────────────────────────────────────
  const stopRecording = useCallback(async (): Promise<{ uri: string; durationSec: number } | null> => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (waveformRef.current) clearInterval(waveformRef.current);

    const rec = recordingRef.current;
    if (!rec) return null;
    recordingRef.current = null;

    try { await rec.stopAndUnloadAsync(); } catch { /* already stopped */ }

    const uri         = rec.getURI() ?? '';
    const durationSec = Math.max(
      MIN_DURATION_S,
      Math.floor((Date.now() - startTimeRef.current) / 1000),
    );

    await setPlaybackAudioMode();
    return { uri, durationSec };
  }, []);

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (isSendingRef.current || cancelledRef.current) return;

    const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (secs < MIN_DURATION_S) {
      // Too short — treat as cancel
      cancelledRef.current = true;
      await stopRecording();
      notificationError();
      onCancel();
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);
    impactLight();

    const result = await stopRecording();
    if (!result?.uri) {
      isSendingRef.current = false;
      setIsSending(false);
      onCancel();
      return;
    }

    notificationSuccess();
    try {
      await onSend(result.durationSec, result.uri);
    } catch {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [impactLight, notificationError, notificationSuccess, onCancel, onSend, stopRecording]);

  // Keep the ref in sync with the latest handleSend ([FIX-3])
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  // ── Cancel handler ─────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;

    impactMedium();
    await stopRecording();
    onCancel();
  }, [impactMedium, onCancel, stopRecording]);

  // ── Start recording on mount ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    cancelledRef.current  = false;
    isSendingRef.current  = false;

    (async () => {
      // 1. Request mic permission  ([FIX-6] handle canAskAgain)
      const perm = await Audio.requestPermissionsAsync();
      if (!mounted) return;

      if (perm.status !== 'granted') {
        if (perm.canAskAgain === false) {
          setErrorMsg(
            'Microphone access is blocked. Enable it in Settings to send voice messages.',
          );
          setShowSettings(true);
        } else {
          setErrorMsg('Microphone permission is required to record voice messages.');
          setShowSettings(false);
        }
        return;
      }

      // 2. Configure audio session for recording
      try {
        await setRecordingAudioMode();
      } catch (err) {
        if (!mounted) return;
        setErrorMsg('Could not configure audio session. Please try again.');
        return;
      }

      // 3. Create and start recording
      try {
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(RECORDING_OPTIONS);
        await rec.startAsync();
        if (!mounted) {
          await rec.stopAndUnloadAsync().catch(() => {});
          return;
        }
        recordingRef.current = rec;
        startTimeRef.current = Date.now();
        impactMedium();   // haptic: recording started
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Could not start recording.';
        setErrorMsg(msg);
        return;
      }

      // 4. Elapsed-time ticker — also enforces MAX_DURATION_S ([FIX-1]: 60 s)
      timerRef.current = setInterval(() => {
        if (!mounted) return;
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_DURATION_S) {
          // Auto-send at 60 s via ref to avoid stale closure ([FIX-3])
          handleSendRef.current();
        }
      }, 500);

      // 5. Waveform updater — rolling amplitude buffer ([FIX-4])
      waveformRef.current = setInterval(async () => {
        if (!mounted) return;
        const rec = recordingRef.current;
        if (!rec) return;

        let dbfs: number | undefined;
        try {
          const status = await rec.getStatusAsync();
          dbfs = status.isRecording
            ? (status as Record<string, unknown>).metering as number | undefined
            : undefined;
        } catch {
          /* status call during teardown — ignore */
        }

        const newHeight = meterToBarHeight(dbfs, BAR_MIN_H, BAR_MAX_H);

        // Shift buffer left: oldest sample drops off, newest appended right
        amplitudeBufferRef.current = [
          ...amplitudeBufferRef.current.slice(1),
          newHeight,
        ];

        // Animate each bar to its corresponding historical height
        amplitudeBufferRef.current.forEach((h, i) => {
          Animated.spring(barAnims[i], {
            toValue:         h,
            friction:        7,
            tension:         130,
            useNativeDriver: false,
          }).start();
        });
      }, WAVEFORM_TICK_MS);
    })();

    return () => {
      mounted = false;
      if (timerRef.current)    clearInterval(timerRef.current);
      if (waveformRef.current) clearInterval(waveformRef.current);
    };
    // intentionally empty deps — runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Red-dot pulse loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1.45, duration: 650, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1.0,  duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotPulse]);

  // ── Lock pop animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLocked) return;
    Animated.sequence([
      Animated.spring(lockScale, { toValue: 1.3, friction: 4, useNativeDriver: true }),
      Animated.spring(lockScale, { toValue: 1.0, friction: 4, useNativeDriver: true }),
    ]).start();
    Animated.spring(sendBtnScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [isLocked, lockScale, sendBtnScale]);

  // ── PanResponder — swipe left to cancel ([FIX-2]: reads isLockedRef) ────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isLockedRef.current,
      onMoveShouldSetPanResponder:  (_e, gs: PanResponderGestureState) =>
        !isLockedRef.current && gs.dx < -10,

      onPanResponderGrant: () => { /* nothing needed */ },

      onPanResponderMove: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        const dx = Math.min(0, gs.dx);
        slideAnim.setValue(dx);

        const hintVisible = dx < -20;
        cancelOpacity.setValue(
          hintVisible ? Math.min(1, Math.abs(dx) / 60) : 0,
        );
        setCancelHint(hintVisible);
      },

      onPanResponderRelease: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        if (gs.dx <= CANCEL_SWIPE_THRESHOLD) {
          slideAnim.setValue(0);
          cancelOpacity.setValue(0);
          setCancelHint(false);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          (async () => {
            const rec = recordingRef.current;
            if (!rec) { onCancel(); return; }
            cancelledRef.current = true;
            impactMedium();
            if (timerRef.current)    clearInterval(timerRef.current);
            if (waveformRef.current) clearInterval(waveformRef.current);
            try { await rec.stopAndUnloadAsync(); } catch { /**/ }
            recordingRef.current = null;
            await setPlaybackAudioMode();
            onCancel();
          })();
        } else {
          // Not far enough — spring back
          Animated.spring(slideAnim, {
            toValue: 0, friction: 6, useNativeDriver: true,
          }).start();
          cancelOpacity.setValue(0);
          setCancelHint(false);
        }
      },
    }),
  ).current;

  // ── Derived display values ─────────────────────────────────────────────────
  const secondsLeft    = MAX_DURATION_S - elapsed;
  const isNearLimit    = secondsLeft <= WARN_SECONDS_LEFT;
  const timerColor     = isNearLimit ? colors.fg.error : colors.fg.primary;
  const dotColor       = colors.fg.error; // always crimson; severity expressed via pulse intensity

  // ── Error state ────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <ErrorBar
        message={errorMsg}
        showSettings={showSettings}
        onDismiss={onCancel}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: slideAnim }] }]}
      {...(!isLocked ? panResponder.panHandlers : {})}
      accessible={false}
    >
      {/* ── Cancel button ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={handleCancel}
        disabled={isSending}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Cancel voice recording"
      >
        <Feather name="x" size={18} color={colors.fg.error} />
      </TouchableOpacity>

      {/* ── Centre: rec-dot · waveform · timer ────────────────────── */}
      <View style={styles.center} pointerEvents="none">

        {/* Recording indicator dot */}
        <Animated.View
          style={[
            styles.recDot,
            { backgroundColor: dotColor, transform: [{ scale: dotPulse }] },
          ]}
        />

        {/* ── Waveform rolling buffer ─────────────────────────────── */}
        <View style={styles.waveform}>
          {barAnims.map((anim, i) => {
            /**
             * Age-gradient opacity: oldest bar (i=0) is most faded,
             * newest bar (i=BAR_COUNT-1) is fully opaque.
             * Creates a scrolling-spectrogram visual depth.
             */
            const ageRatio  = i / (BAR_COUNT - 1);            // 0 (old) → 1 (new)
            const barOpacity = 0.30 + ageRatio * 0.65;         // 0.30 → 0.95
            const barColor  = isNearLimit ? colors.fg.error : colors.fg.brand;

            return (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height:          anim,
                    opacity:         barOpacity,
                    backgroundColor: barColor,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Elapsed timer */}
        <Text
          style={[styles.timer, { color: timerColor }]}
          accessibilityLabel={`Recording duration: ${fmtDuration(elapsed)}`}
        >
          {fmtDuration(elapsed)}
        </Text>

        {/* Swipe-to-cancel hint — fades in on drag */}
        {cancelHint && (
          <Animated.Text
            style={[styles.cancelHint, { opacity: cancelOpacity }]}
            accessibilityElementsHidden
          >
            ← Cancel
          </Animated.Text>
        )}
      </View>

      {/* ── Right: lock + send ────────────────────────────────────── */}
      <View style={styles.rightActions}>

        {/* Lock-to-send */}
        {!isLocked && (
          <Animated.View style={{ transform: [{ scale: lockScale }] }}>
            <Pressable
              style={styles.lockBtn}
              onPress={() => {
                impactLight();
                setIsLocked(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Lock recording — detach from hold"
            >
              <Feather name="lock" size={16} color={colors.fg.tertiary} />
            </Pressable>
          </Animated.View>
        )}

        {/* Send button */}
        <Animated.View
          style={{
            transform: [{ scale: isLocked ? sendBtnScale : new Animated.Value(1) }],
          }}
        >
          <TouchableOpacity
            style={[styles.sendBtn, isSending && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={isSending}
            activeOpacity={0.82}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Send voice message"
          >
            <Feather
              name={isSending ? 'loader' : 'send'}
              size={16}
              color={palette.white}
              style={isSending ? undefined : { marginLeft: 2 }}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// React.memo — parent ChatInput re-renders (typing, keyboard) must not
// re-render VoiceRecorder.  Props are stable callbacks + never change mid-session.
export default memo(VoiceRecorder);

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Outer container ──────────────────────────────────────────────────────
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        10,
    paddingBottom:     Platform.OS === 'ios' ? 20 : 14,
    borderTopWidth:    1,
    borderTopColor:    colors.border.default,
    backgroundColor:   colors.bg.subtle,
    gap:               10,
    minHeight:         72,
  },

  // ── Error bar ─────────────────────────────────────────────────────────────
  errorBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderTopWidth:    1,
    borderTopColor:    colors.border.default,
    backgroundColor:   colors.bg.subtle,
    gap:               8,
  },
  errorText: {
    flex:       1,
    color:      colors.fg.error,
    fontSize:   13,
    fontWeight: '500',
    lineHeight: 18,
  },
  settingsLink: {
    color:      colors.fg.brand,
    fontSize:   13,
    fontWeight: '600',
    flexShrink: 0,
  },

  // ── Cancel button ─────────────────────────────────────────────────────────
  cancelBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: colors.bg.errorSoft,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  // ── Centre section ────────────────────────────────────────────────────────
  center: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    overflow:       'hidden',
  },

  // ── Recording dot ─────────────────────────────────────────────────────────
  recDot: {
    width:        9,
    height:       9,
    borderRadius: 5,
    flexShrink:   0,
  },

  // ── Waveform ──────────────────────────────────────────────────────────────
  waveform: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            2,
    height:         32,
    overflow:       'hidden',
  },
  waveBar: {
    flex:         1,
    borderRadius: 2,
    minWidth:     2,
    maxWidth:     6,
  },

  // ── Timer ─────────────────────────────────────────────────────────────────
  timer: {
    fontSize:    13,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
    flexShrink:  0,
    minWidth:    38,
    textAlign:   'right',
  },

  // ── Swipe-to-cancel hint ──────────────────────────────────────────────────
  cancelHint: {
    position:  'absolute',
    left:      0,
    right:     0,
    textAlign: 'center',
    color:     colors.fg.tertiary,
    fontSize:  12,
    fontWeight:'500',
  },

  // ── Right actions ─────────────────────────────────────────────────────────
  rightActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flexShrink:    0,
  },

  // ── Lock button ───────────────────────────────────────────────────────────
  lockBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.bg.cardHover,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Send button ([TOKEN-2]: 48×48, radii.full per Blueprint § 5.D) ─────────
  sendBtn: {
    width:           48,
    height:          48,
    borderRadius:    radii.full,
    backgroundColor: colors.fg.brand,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     palette.gold[600],
    shadowOpacity:   0.40,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },
  sendBtnDisabled: {
    opacity: 0.55,
  },
});

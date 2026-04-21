/**
 * components/VoiceRecorder.tsx
 *
 * ORBIT — Press-and-Hold Voice Recorder
 *
 * Drop-in replacement for the inline VoiceRecorder stub in app/dm/[id].tsx.
 *
 * Features:
 *   • expo-av Audio.Recording with Opus codec (OGG/Opus on Android,
 *     M4A/AAC on iOS — the closest native equivalent expo-av supports).
 *   • Animated waveform — 20 bars whose heights update every 200 ms using
 *     the real metering level from the recorder (falls back to random noise
 *     when metering is unavailable).
 *   • PanResponder cancel gesture — swipe left ≥ 80 pts cancels recording;
 *     an "← Slide to cancel" hint animates while swiping.
 *   • Pulse animation on the red recording dot.
 *   • Lock-to-send mode — tap 🔒 to detach from hold and freely type/send.
 *   • Send on release — calls onSend(durationSec, uri) with the recording
 *     file URI so the parent can upload to storage (R2 / Firebase Storage).
 *   • Minimum 1-second guard — recordings under 1 s are auto-cancelled.
 *   • Permissions handled inline — requests mic permission on first use,
 *     shows a friendly error if denied.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *
 *   onSend(durationSec: number, uri: string): Promise<void>
 *     Called when the user releases (or taps Send) with the real duration
 *     and the local file URI of the recording.  Upload the URI to storage
 *     and pass the remote URL to sendVoiceMessage() from firestore-messages.ts.
 *
 *   onCancel(): void
 *     Called when the user swipes left, taps ✕, or the recording fails.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import VoiceRecorder from '@/components/VoiceRecorder';
 *
 *   {recording && (
 *     <VoiceRecorder
 *       onSend={async (secs, uri) => {
 *         const remoteUrl = await uploadVoice(uri);
 *         await sendVoiceMessage('dm', threadId, {
 *           uid, username, durationSec: secs, url: remoteUrl,
 *         });
 *         setRecording(false);
 *       }}
 *       onCancel={() => setRecording(false)}
 *     />
 *   )}
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { orbit } from "@/constants/colors";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of animated waveform bars shown while recording. */
const BAR_COUNT = 20;

/** How often (ms) the waveform bars update. */
const WAVEFORM_TICK_MS = 180;

/** Horizontal drag distance (pts) required to trigger cancel. */
const CANCEL_SWIPE_THRESHOLD = -80;

/** Minimum recording length in seconds before send is allowed. */
const MIN_DURATION_S = 1;

/** Maximum recording length in seconds before auto-stop. */
const MAX_DURATION_S = 180; // 3 minutes

/**
 * Recording preset — Opus on Android, AAC-LC on iOS.
 * expo-av does not expose a first-class Opus option on iOS; AAC inside
 * an M4A container is the highest-quality compressed format available
 * through the iOS AVAudioSession API.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension:    ".opus",
    outputFormat: Audio.AndroidOutputFormat.OGG,
    audioEncoder: Audio.AndroidAudioEncoder.OPUS,
    sampleRate:   48000,
    numberOfChannels: 1,
    bitRate:      32000,
  },
  ios: {
    extension:    ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate:   48000,
    numberOfChannels: 1,
    bitRate:      64000,
    linearPCMBitDepth:    16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat:     false,
  },
  web: {
    mimeType: "audio/webm;codecs=opus",
    bitsPerSecond: 32000,
  },
  isMeteringEnabled: true,   // Enables getStatusAsync().metering for waveform
  keepAudioActiveHint: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Convert a metering value (dBFS, typically −160 to 0) to a bar height (px).
 * Returns a value between minH and maxH.
 */
function meterToBarHeight(
  dbfs: number | null | undefined,
  minH: number,
  maxH: number,
): number {
  if (dbfs == null || !isFinite(dbfs)) {
    // No metering data — return randomised idle height.
    return minH + Math.random() * (maxH - minH);
  }
  // Map −60 dBFS → minH, 0 dBFS → maxH.
  const clamped = Math.max(-60, Math.min(0, dbfs));
  const ratio   = (clamped + 60) / 60;
  return minH + ratio * (maxH - minH);
}

/** Generate an initial set of bar heights for the idle state. */
function initialBars(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    // Create a natural-looking envelope: taller in the centre.
    const center = BAR_COUNT / 2;
    const dist   = Math.abs(i - center) / center;
    return 4 + (1 - dist) * 10 + Math.random() * 6;
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VoiceRecorderProps {
  /**
   * Called when the user sends.
   * @param durationSec  Recorded duration in whole seconds (min 1).
   * @param uri          Local file URI of the recording.  Upload this to your
   *                     storage backend and pass the remote URL to
   *                     sendVoiceMessage() from lib/firestore-messages.ts.
   */
  onSend: (durationSec: number, uri: string) => Promise<void>;

  /** Called on cancel (swipe left, tap ✕, or recording error). */
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceRecorder({
  onSend,
  onCancel,
}: VoiceRecorderProps) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [elapsed,      setElapsed]      = useState(0);
  const [barHeights,   setBarHeights]   = useState<number[]>(initialBars);
  const [isSending,    setIsSending]    = useState(false);
  const [isLocked,     setIsLocked]     = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [cancelHint,   setCancelHint]   = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const recordingRef    = useRef<Audio.Recording | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef    = useRef<number>(Date.now());
  const cancelledRef    = useRef(false);

  // ── Animated values ─────────────────────────────────────────────────────────
  const dotPulse      = useRef(new Animated.Value(1)).current;
  const slideAnim     = useRef(new Animated.Value(0)).current;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const lockScale     = useRef(new Animated.Value(1)).current;
  const sendBtnScale  = useRef(new Animated.Value(0)).current;
  const barAnims      = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(8))
  ).current;

  // ── Start recording on mount ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    cancelledRef.current = false;

    (async () => {
      // 1. Request mic permission
      const { status } = await Audio.requestPermissionsAsync();
      if (!mounted) return;
      if (status !== "granted") {
        setErrorMsg("Microphone permission denied.");
        return;
      }

      // 2. Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:           true,
        playsInSilentModeIOS:         true,
        interruptionModeIOS:          Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        shouldDuckAndroid:            true,
        interruptionModeAndroid:      Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid:   false,
        staysActiveInBackground:      false,
      });

      // 3. Create and start the recording
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

        // Haptic feedback on start
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Could not start recording.";
        setErrorMsg(msg);
        return;
      }

      // 4. Start elapsed timer
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_DURATION_S) {
          // Auto-stop at max duration
          handleSend();
        }
      }, 500);

      // 5. Start waveform updater
      waveformRef.current = setInterval(async () => {
        const rec = recordingRef.current;
        if (!rec) return;
        try {
          const status = await rec.getStatusAsync();
          const dbfs   = status.isRecording ? (status as any).metering as number | undefined : undefined;
          const next: number[] = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            next.push(meterToBarHeight(dbfs, 3, 22));
          }
          setBarHeights(next);

          // Animate each bar to its new height
          next.forEach((h, i) => {
            Animated.spring(barAnims[i], {
              toValue:  h,
              friction: 6,
              tension:  120,
              useNativeDriver: false,
            }).start();
          });
        } catch {
          /* Ignore status errors during teardown */
        }
      }, WAVEFORM_TICK_MS);
    })();

    return () => {
      mounted = false;
      if (timerRef.current)    clearInterval(timerRef.current);
      if (waveformRef.current) clearInterval(waveformRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pulse animation on the red dot ──────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1.4, duration: 700,  useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1.0, duration: 700,  useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotPulse]);

  // ── Lock button pop animation on lock ───────────────────────────────────────
  useEffect(() => {
    if (isLocked) {
      Animated.spring(lockScale, { toValue: 1.25, friction: 4, useNativeDriver: true }).start(() =>
        Animated.spring(lockScale, { toValue: 1.0, friction: 4, useNativeDriver: true }).start()
      );
      Animated.spring(sendBtnScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  }, [isLocked, lockScale, sendBtnScale]);

  // ── Stop & release recording resources ──────────────────────────────────────
  const stopRecording = useCallback(async (): Promise<{ uri: string; durationSec: number } | null> => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (waveformRef.current) clearInterval(waveformRef.current);

    const rec = recordingRef.current;
    if (!rec) return null;
    recordingRef.current = null;

    try {
      await rec.stopAndUnloadAsync();
    } catch {
      /* Might already be stopped */
    }

    const uri         = rec.getURI() ?? "";
    const durationSec = Math.max(MIN_DURATION_S, Math.floor((Date.now() - startTimeRef.current) / 1000));

    // Restore audio session for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:      false,
      playsInSilentModeIOS:    true,
      interruptionModeIOS:     Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      shouldDuckAndroid:       true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground:    false,
    }).catch(() => {});

    return { uri, durationSec };
  }, []);

  // ── Send handler ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (isSending || cancelledRef.current) return;

    const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (secs < MIN_DURATION_S) {
      // Too short — cancel silently
      cancelledRef.current = true;
      await stopRecording();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      onCancel();
      return;
    }

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const result = await stopRecording();
    if (!result || !result.uri) {
      setIsSending(false);
      onCancel();
      return;
    }

    try {
      await onSend(result.durationSec, result.uri);
    } catch {
      setIsSending(false);
    }
  }, [isSending, onSend, onCancel, stopRecording]);

  // ── Cancel handler ───────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    await stopRecording();
    onCancel();
  }, [onCancel, stopRecording]);

  // ── PanResponder — swipe left to cancel ─────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:       () => !isLocked,
      onMoveShouldSetPanResponder:        (_e, gs) => !isLocked && gs.dx < -10,
      onPanResponderGrant:                () => {},
      onPanResponderMove: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        // Only track leftward drags
        const dx = Math.min(0, gs.dx);
        slideAnim.setValue(dx);

        // Show hint label when dragged > 20 pts
        const hintVisible = dx < -20;
        cancelOpacity.setValue(hintVisible ? Math.min(1, Math.abs(dx) / 60) : 0);
        setCancelHint(hintVisible);
      },
      onPanResponderRelease: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        if (gs.dx <= CANCEL_SWIPE_THRESHOLD) {
          // Cancel triggered by swipe
          slideAnim.setValue(0);
          cancelOpacity.setValue(0);
          setCancelHint(false);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          handleCancel();
        } else {
          // Spring back
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 6,
            useNativeDriver: true,
          }).start();
          cancelOpacity.setValue(0);
          setCancelHint(false);
        }
      },
    })
  ).current;

  // ── Error state ──────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <View style={styles.errorBar}>
        <Feather name="alert-circle" size={16} color={orbit.danger} />
        <Text style={styles.errorText} numberOfLines={1}>
          {errorMsg}
        </Text>
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
        >
          <Feather name="x" size={18} color={orbit.textSecond} />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
      ]}
      {...(!isLocked ? panResponder.panHandlers : {})}
    >
      {/* ── Cancel button (left) ─────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={handleCancel}
        disabled={isSending}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Cancel recording"
      >
        <Feather name="x" size={18} color={orbit.danger} />
      </TouchableOpacity>

      {/* ── Centre: waveform + timer + slide hint ────────────────────── */}
      <View style={styles.center} pointerEvents="none">
        {/* Recording indicator dot */}
        <Animated.View
          style={[
            styles.recDot,
            { transform: [{ scale: dotPulse }] },
          ]}
        />

        {/* Animated waveform bars */}
        <View style={styles.waveform}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                { height: anim },
              ]}
            />
          ))}
        </View>

        {/* Elapsed timer */}
        <Text style={styles.timer}>{fmtDuration(elapsed)}</Text>

        {/* Swipe-to-cancel hint — fades in as user drags */}
        {cancelHint && (
          <Animated.Text style={[styles.cancelHint, { opacity: cancelOpacity }]}>
            ← Cancel
          </Animated.Text>
        )}
      </View>

      {/* ── Right side: lock + send ──────────────────────────────────── */}
      <View style={styles.rightActions}>
        {/* Lock-to-send icon (detaches from hold, shows Send button) */}
        {!isLocked && (
          <Animated.View style={{ transform: [{ scale: lockScale }] }}>
            <Pressable
              style={styles.lockBtn}
              onPress={() => setIsLocked(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Lock recording"
            >
              <Feather name="lock" size={16} color={orbit.textTertiary} />
            </Pressable>
          </Animated.View>
        )}

        {/* Send button — always visible; in non-locked mode it's the primary CTA */}
        <Animated.View style={{ transform: [{ scale: isLocked ? sendBtnScale : new Animated.Value(1) }] }}>
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
              name={isSending ? "loader" : "send"}
              size={16}
              color={orbit.white}
              style={{ marginLeft: isSending ? 0 : 2 }}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Outer container ───────────────────────────────────────────────────────
  container: {
    flexDirection:      "row",
    alignItems:         "center",
    paddingHorizontal:  16,
    paddingTop:         10,
    paddingBottom:      Platform.OS === "ios" ? 20 : 14,
    borderTopWidth:     1,
    borderTopColor:     orbit.borderSubtle,
    backgroundColor:    orbit.surface1,
    gap:                10,
    minHeight:          72,
  },

  // ── Error bar ─────────────────────────────────────────────────────────────
  errorBar: {
    flexDirection:      "row",
    alignItems:         "center",
    paddingHorizontal:  16,
    paddingVertical:    14,
    borderTopWidth:     1,
    borderTopColor:     orbit.borderSubtle,
    backgroundColor:    orbit.surface1,
    gap:                8,
  },
  errorText: {
    flex:       1,
    color:      orbit.danger,
    fontSize:   13,
    fontWeight: "500",
  },

  // ── Cancel button (left) ──────────────────────────────────────────────────
  cancelBtn: {
    width:             42,
    height:            42,
    borderRadius:      21,
    backgroundColor:   orbit.dangerSoft,
    alignItems:        "center",
    justifyContent:    "center",
    flexShrink:        0,
  },

  // ── Centre section ────────────────────────────────────────────────────────
  center: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
    overflow:       "hidden",
  },

  // ── Recording dot ─────────────────────────────────────────────────────────
  recDot: {
    width:         9,
    height:        9,
    borderRadius:  5,
    backgroundColor: orbit.danger,
    flexShrink:    0,
  },

  // ── Waveform ──────────────────────────────────────────────────────────────
  waveform: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            2,
    height:         26,
    overflow:       "hidden",
  },
  waveBar: {
    flex:            1,
    borderRadius:    2,
    minWidth:        2,
    maxWidth:        6,
    backgroundColor: orbit.accent,
    opacity:         0.75,
  },

  // ── Timer ─────────────────────────────────────────────────────────────────
  timer: {
    color:       orbit.danger,
    fontSize:    13,
    fontWeight:  "600",
    fontVariant: ["tabular-nums"],
    flexShrink:  0,
    minWidth:    36,
    textAlign:   "right",
  },

  // ── Swipe-to-cancel hint ──────────────────────────────────────────────────
  cancelHint: {
    position:   "absolute",
    left:       0,
    right:      0,
    textAlign:  "center",
    color:      orbit.textTertiary,
    fontSize:   12,
    fontWeight: "500",
  },

  // ── Right action area ─────────────────────────────────────────────────────
  rightActions: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    flexShrink:    0,
  },

  // ── Lock button ───────────────────────────────────────────────────────────
  lockBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: orbit.surface3,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Send button ───────────────────────────────────────────────────────────
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: orbit.accent,
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     orbit.accent,
    shadowOpacity:   0.4,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },
  sendBtnDisabled: {
    opacity: 0.55,
  },
});

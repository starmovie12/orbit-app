/**
 * components/VoicePlayer.tsx
 *
 * ORBIT — Voice Message Player
 *
 * Drop-in replacement for the inline VoiceNote stub in app/dm/[id].tsx and
 * app/room/[id].tsx.  Loads audio from a Cloudflare R2 (or any remote) URL
 * using expo-av's Audio.Sound, rendering a full-featured playback UI.
 *
 * Features:
 *   • Play / Pause — tapping the button toggles playback.
 *   • Waveform — 20 bars derived from the static WAVE_HEIGHTS envelope;
 *     bars to the left of the playhead are highlighted in the active colour
 *     so the listener can see progress at a glance.
 *   • Accurate progress — driven by expo-av's onPlaybackStatusUpdate callback
 *     (positionMillis / durationMillis), so it stays in sync even after
 *     seeking or speed changes.
 *   • 1× / 1.5× / 2× speed chip — cycles through rates without restarting
 *     playback; the chip is hidden until audio has loaded to avoid a flash.
 *   • Duration display — shows elapsed time while playing, total duration
 *     while paused / stopped.  Falls back to the `duration` prop when the
 *     server-reported duration is not yet available.
 *   • R2 URL loading — calls Audio.Sound.createAsync(uri) on mount.  The
 *     sound is unloaded on unmount via the returned cleanup function.
 *   • Loading / error states — spinner icon while buffering, alert-circle on
 *     load failure.
 *   • isMe theming — white tints inside outgoing accent bubbles; standard
 *     orbit tokens inside incoming surface bubbles.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *
 *   url        Remote audio URL (Cloudflare R2 signed URL, Firebase Storage
 *              URL, or any HTTPS source). Required.
 *   duration   Fallback duration in seconds from the Firestore MessageDoc
 *              (field: `duration`). Shown before the sound loads.
 *   isMe       When true, applies outgoing-bubble theming (white on accent).
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import VoicePlayer from '@/components/VoicePlayer';
 *
 *   // Inside a Bubble component (replaces the inline VoiceNote):
 *   {msg.type === 'voice' && msg.duration != null && msg.imageUrl ? (
 *     <VoicePlayer
 *       url={msg.imageUrl}       // imageUrl holds the R2 URL (firestore-messages.ts)
 *       duration={msg.duration}
 *       isMe={isMe}
 *     />
 *   ) : null}
 *
 * ── Note on firestore-messages.ts field names ────────────────────────────────
 *   The audio URL is stored in the `imageUrl` field of MessageDoc (confirmed
 *   from sendVoiceMessage() in lib/firestore-messages.ts), and the recorded
 *   duration in seconds is stored in the `duration` field.  Pass both through
 *   from the MessageDoc without renaming.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather }  from "@expo/vector-icons";
import { Audio, type AVPlaybackStatus } from "expo-av";

import { orbit } from "@/constants/colors";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Static waveform envelope — same values used in the inline VoiceNote in
 * app/dm/[id].tsx so the UI looks consistent across both the old and new
 * implementations.
 */
const WAVE_HEIGHTS: readonly number[] = [
  5, 10, 7, 14, 9, 17, 7, 13, 9, 15,
  7, 11, 5, 13, 9, 17, 7, 11, 5, 9,
];

/** Available playback speed steps, cycled in order. */
const SPEEDS: readonly number[] = [1.0, 1.5, 2.0];

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState = "loading" | "ready" | "error";

export interface VoicePlayerProps {
  /** Remote audio URL (Cloudflare R2, Firebase Storage, or any HTTPS source). */
  url:      string;
  /** Fallback duration in seconds from the Firestore MessageDoc `duration` field. */
  duration: number;
  /**
   * When true the component renders with outgoing-bubble colours:
   * white icon, white-translucent bars, white-translucent timer.
   * When false (default) it uses incoming-bubble colours.
   */
  isMe?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoicePlayer({ url, duration, isMe = false }: VoicePlayerProps) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [loadState,   setLoadState]   = useState<LoadState>("loading");
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [speedIndex,  setSpeedIndex]  = useState(0);         // index into SPEEDS
  const [positionMs,  setPositionMs]  = useState(0);
  const [durationMs,  setDurationMs]  = useState(duration * 1000);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const soundRef      = useRef<Audio.Sound | null>(null);
  const speedIndexRef = useRef(0);   // mirror of speedIndex for stable callback

  // ── Derived values ──────────────────────────────────────────────────────────
  const currentSpeed   = SPEEDS[speedIndex];
  const totalSecs      = Math.max(1, Math.round(durationMs / 1000));
  const elapsedSecs    = Math.round(positionMs / 1000);
  const progressRatio  = durationMs > 0 ? positionMs / durationMs : 0;

  // ── Animated progress value (0 → 1) ────────────────────────────────────────
  // We use a plain state-driven approach (not Animated.Value) so the waveform
  // bar colours update synchronously with the AVPlaybackStatusUpdate — this
  // avoids the 1-frame flicker that a separate Animated.timing loop produces.

  // ── Colour tokens ───────────────────────────────────────────────────────────
  const iconColour    = isMe ? "rgba(255,255,255,0.92)" : orbit.textPrimary;
  const barInactive   = isMe ? "rgba(255,255,255,0.30)" : orbit.textTertiary;
  const barActive     = isMe ? "rgba(255,255,255,0.88)" : orbit.accent;
  const timerColour   = isMe ? "rgba(255,255,255,0.65)" : orbit.textTertiary;
  const chipBg        = isMe ? "rgba(255,255,255,0.18)" : orbit.surface3;
  const chipText      = isMe ? "rgba(255,255,255,0.85)" : orbit.textSecond;
  const playBg        = isMe ? "rgba(255,255,255,0.18)" : orbit.surface3;

  // ── Spin animation for the loading state ───────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loadState === "loading") {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue:         1,
          duration:        900,
          useNativeDriver: true,
        })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
  }, [loadState, spinAnim]);

  const spinDeg = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // ── Load sound on mount / url change ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let sound: Audio.Sound | null = null;

    (async () => {
      // Ensure playback audio mode (not recording mode)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:         false,
        playsInSilentModeIOS:       true,
        interruptionModeIOS:        Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        shouldDuckAndroid:          true,
        interruptionModeAndroid:    Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground:    false,
      }).catch(() => {});

      try {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: url },
          {
            shouldPlay:      false,
            progressUpdateIntervalMillis: 100,
            volume: 1.0,
            rate:   SPEEDS[speedIndexRef.current],
            shouldCorrectPitch: true,
          },
          (status: AVPlaybackStatus) => {
            if (cancelled) return;
            if (!status.isLoaded) {
              if (status.error) {
                setLoadState("error");
              }
              return;
            }
            // Update position
            setPositionMs(status.positionMillis ?? 0);
            // Update total duration from actual file metadata when available
            if (status.durationMillis && status.durationMillis > 0) {
              setDurationMs(status.durationMillis);
            }
            // Sync playing state
            setIsPlaying(status.isPlaying);
            // Auto-reset on natural finish
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPositionMs(0);
            }
          }
        );

        if (cancelled) {
          await s.unloadAsync().catch(() => {});
          return;
        }

        sound = s;
        soundRef.current = s;
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
      // Unload on unmount or url change
      const s = soundRef.current ?? sound;
      if (s) {
        s.stopAsync().catch(() => {});
        s.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
    // url is the only real dependency — duration and isMe don't affect loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ── Play / Pause ─────────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    const s = soundRef.current;
    if (!s || loadState !== "ready") return;

    try {
      const status = await s.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await s.pauseAsync();
      } else {
        // If we're at the end, seek back to start before playing
        if (status.positionMillis >= (status.durationMillis ?? 0) - 200) {
          await s.setPositionAsync(0);
        }
        await s.playAsync();
      }
    } catch {
      /* Ignore playback errors — sound may be temporarily unavailable */
    }
  }, [loadState]);

  // ── Speed cycle ───────────────────────────────────────────────────────────────
  const handleSpeedCycle = useCallback(async () => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    const nextRate  = SPEEDS[nextIndex];
    setSpeedIndex(nextIndex);
    speedIndexRef.current = nextIndex;

    const s = soundRef.current;
    if (!s || loadState !== "ready") return;
    try {
      await s.setRateAsync(nextRate, /* shouldCorrectPitch */ true);
    } catch {
      /* Best-effort */
    }
  }, [speedIndex, loadState]);

  // ── Waveform bar colour logic ─────────────────────────────────────────────────
  //
  // A bar at index `i` is "active" (highlighted) when the playhead has passed
  // the fraction of total duration that bar represents.  This gives a simple
  // left-to-right fill effect that stays in sync with positionMs.

  function barIsActive(i: number): boolean {
    if (!isPlaying && positionMs === 0) return false;
    const threshold = i / WAVE_HEIGHTS.length;
    return progressRatio >= threshold;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container} accessibilityRole="none">

      {/* ── Play / Pause button ─────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: playBg }]}
        onPress={handlePlayPause}
        disabled={loadState !== "ready"}
        activeOpacity={0.78}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause voice message" : "Play voice message"}
        accessibilityState={{ disabled: loadState !== "ready" }}
      >
        {loadState === "loading" && (
          <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
            <Feather name="loader" size={13} color={iconColour} />
          </Animated.View>
        )}
        {loadState === "error" && (
          <Feather name="alert-circle" size={13} color={orbit.danger} />
        )}
        {loadState === "ready" && (
          <Feather
            name={isPlaying ? "pause" : "play"}
            size={13}
            color={iconColour}
            style={isPlaying ? undefined : styles.playIconOffset}
          />
        )}
      </TouchableOpacity>

      {/* ── Waveform bars ──────────────────────────────────────────── */}
      <View style={styles.waveform} accessibilityElementsHidden>
        {WAVE_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              {
                height:          h,
                backgroundColor: barIsActive(i) ? barActive : barInactive,
              },
            ]}
          />
        ))}
      </View>

      {/* ── Right side: timer + speed chip ────────────────────────── */}
      <View style={styles.rightCol}>
        {/* Duration / elapsed */}
        <Text
          style={[styles.timer, { color: timerColour }]}
          accessibilityLabel={
            isPlaying
              ? `${elapsedSecs} seconds elapsed`
              : `${totalSecs} seconds total`
          }
        >
          {fmtDuration(isPlaying || positionMs > 0 ? elapsedSecs : totalSecs)}
        </Text>

        {/* Speed chip — only shown once audio has loaded */}
        {loadState === "ready" && (
          <TouchableOpacity
            style={[styles.speedChip, { backgroundColor: chipBg }]}
            onPress={handleSpeedCycle}
            activeOpacity={0.78}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${currentSpeed}x. Tap to change.`}
          >
            <Text style={[styles.speedText, { color: chipText }]}>
              {currentSpeed === 1.0 ? "1×" : `${currentSpeed}×`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           9,
    minWidth:      200,
    paddingVertical: 2,
  },

  // ── Play button ─────────────────────────────────────────────────────────────
  playBtn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  // nudge play icon slightly right for optical centring
  playIconOffset: {
    marginLeft: Platform.OS === "ios" ? 1 : 2,
  },

  // ── Waveform ────────────────────────────────────────────────────────────────
  waveform: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            2,
    height:         22,
    overflow:       "hidden",
  },
  waveBar: {
    flex:        1,
    borderRadius: 2,
    minWidth:    2,
  },

  // ── Right column ────────────────────────────────────────────────────────────
  rightCol: {
    alignItems:     "flex-end",
    gap:            4,
    flexShrink:     0,
    minWidth:       44,
  },

  // ── Timer ───────────────────────────────────────────────────────────────────
  timer: {
    fontSize:    12,
    fontWeight:  "500",
    fontVariant: ["tabular-nums"],
    lineHeight:  14,
  },

  // ── Speed chip ──────────────────────────────────────────────────────────────
  speedChip: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
    alignItems:        "center",
    justifyContent:    "center",
  },
  speedText: {
    fontSize:   10,
    fontWeight: "700",
    lineHeight: 13,
  },
});

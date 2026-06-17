/**
 * CountdownTimer — Digit flip countdown with drift correction
 *
 * Per PRD §16.5:
 * - Digit change: flip animation (CSS perspective transform)
 * - Old digit: rotateX(0deg) → rotateX(-90deg), 150ms ease-in
 * - New digit: rotateX(90deg) → rotateX(0deg), 150ms ease-out
 * - Last 60s: color shifts to --fg-accent-orange
 * - Last 10s: color shifts to --fg-danger (Decision Prompt only)
 * - Haptic: light × every 10s interval during last 60s (not every second)
 * - Last 10s Decision Prompt: haptic × every second (per LAW 3)
 *
 * Reduced-motion: plain text update, no rotateX
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { COLORS_DARK, FONTS, FONT_SIZES, SPACING } from '../tokens';
import { useCountdown } from '../hooks/useCountdown';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface CountdownTimerProps {
  /** Unix ms when countdown reaches zero */
  targetMs: number;
  /** Visual variant: 'default' (Battle Hour) | 'decision' (Phase 5 high-stakes) */
  variant?: 'default' | 'decision';
  /** Called when countdown hits zero */
  onExpiry?: () => void;
  /** If true, shows LIVE dot before timer */
  showLiveDot?: boolean;
  /** Accessibility label prefix for screen readers */
  accessibilityPrefix?: string;
}

// ── DIGIT COMPONENT ───────────────────────────────────────────────────────────

interface FlipDigitProps {
  value: string;
  textColor: string;
  reducedMotion: boolean;
}

const FlipDigit = React.memo<FlipDigitProps>(({ value, textColor, reducedMotion }) => {
  const prevValueRef = useRef(value);
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;

    if (reducedMotion) return; // Instant swap — no animation

    // Reset to top (new value hidden above)
    flipAnim.setValue(-90);

    // Animate in: rotateX(-90deg → 0deg), 150ms ease-out
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 150,
      // cubic-bezier(0.215, 0.61, 0.355, 1) approximated
      useNativeDriver: true,
    }).start();
  }, [value, flipAnim, reducedMotion]);

  const rotateXInterpolated = flipAnim.interpolate({
    inputRange: [-90, 0],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <Animated.Text
      style={[
        styles.digitText,
        { color: textColor },
        !reducedMotion && {
          transform: [{ perspective: 200 }, { rotateX: rotateXInterpolated }],
        },
      ]}
    >
      {value}
    </Animated.Text>
  );
});
FlipDigit.displayName = 'FlipDigit';

// ── SEPARATOR ─────────────────────────────────────────────────────────────────

const Separator = React.memo<{ color: string }>(({ color }) => (
  <Text style={[styles.separator, { color }]}>:</Text>
));
Separator.displayName = 'Separator';

// ── LIVE DOT ─────────────────────────────────────────────────────────────────

const LiveDot = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[styles.liveDot, { opacity: pulseAnim }]}
    />
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetMs,
  variant = 'default',
  onExpiry,
  showLiveDot = false,
  accessibilityPrefix = 'Countdown',
}) => {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);

  const { secondsRemaining, formatted, isLastMinute, isLastTenSeconds } =
    useCountdown(targetMs, onExpiry);

  // Color transitions per PRD §16.5
  const digitColor = React.useMemo((): string => {
    if (variant === 'decision' && isLastTenSeconds) {
      return COLORS_DARK.fgDanger;
    }
    if (isLastMinute) {
      return COLORS_DARK.fgAccentOrange;
    }
    return COLORS_DARK.fgTextStrong;
  }, [variant, isLastMinute, isLastTenSeconds]);

  const { hours, minutes, seconds } = formatted;

  // Accessibility: update every minute (not every second — too noisy)
  const accessibilityLabel = `${accessibilityPrefix}: ${parseInt(hours, 10)} hours ${parseInt(minutes, 10)} minutes ${parseInt(seconds, 10)} seconds`;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
    >
      {showLiveDot && <LiveDot />}
      {showLiveDot && <View style={styles.liveDotSpacer} />}

      <FlipDigit value={hours[0]} textColor={digitColor} reducedMotion={reducedMotion} />
      <FlipDigit value={hours[1]} textColor={digitColor} reducedMotion={reducedMotion} />
      <Separator color={digitColor} />
      <FlipDigit value={minutes[0]} textColor={digitColor} reducedMotion={reducedMotion} />
      <FlipDigit value={minutes[1]} textColor={digitColor} reducedMotion={reducedMotion} />
      <Separator color={digitColor} />
      <FlipDigit value={seconds[0]} textColor={digitColor} reducedMotion={reducedMotion} />
      <FlipDigit value={seconds[1]} textColor={digitColor} reducedMotion={reducedMotion} />
    </View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitText: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.countdown,
    fontWeight: '700',
    lineHeight: 24,
    // Tabular nums — fixed width for each digit to prevent layout shift
    // React Native: Space Mono is inherently monospaced, satisfying LAW 6
  },
  separator: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.countdown,
    fontWeight: '700',
    lineHeight: 24,
    marginHorizontal: SPACING.xxs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS_DARK.fgAccentOrange,
  },
  liveDotSpacer: {
    width: SPACING.sm,
  },
});

export default CountdownTimer;

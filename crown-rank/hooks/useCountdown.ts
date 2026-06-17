/**
 * useCountdown — Drift-corrected countdown timer
 *
 * Per PRD LAW 9: "No simple setInterval — it drifts."
 * Uses self-correcting setTimeout pattern to stay accurate within 100ms over 1h.
 *
 * @param targetMs - Unix ms of when countdown reaches zero
 * @param onExpiry - Optional callback when timer expires
 * @returns { secondsRemaining, formatted: { hours, minutes, seconds, display } }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatCountdown } from '../core/cycle';

const TICK_INTERVAL_MS = 1000;

interface CountdownResult {
  secondsRemaining: number;
  formatted: {
    hours: string;
    minutes: string;
    seconds: string;
    display: string;
  };
  isExpired: boolean;
  isLastMinute: boolean;
  isLastTenSeconds: boolean;
}

export function useCountdown(
  targetMs: number | null,
  onExpiry?: () => void,
): CountdownResult {
  const getSecondsRemaining = useCallback((): number => {
    if (targetMs === null) return 0;
    return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  }, [targetMs]);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    getSecondsRemaining,
  );

  const onExpiryRef = useRef(onExpiry);
  onExpiryRef.current = onExpiry;

  const expectedRef = useRef<number>(Date.now() + TICK_INTERVAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (targetMs === null) {
      setSecondsRemaining(0);
      return;
    }

    // Reset on new target
    setSecondsRemaining(getSecondsRemaining());
    expectedRef.current = Date.now() + TICK_INTERVAL_MS;

    function tick() {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((targetMs! - now) / 1000));

      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        onExpiryRef.current?.();
        return; // Stop ticking
      }

      // Drift correction: next tick fires to hit next whole second boundary
      const drift = now - expectedRef.current;
      expectedRef.current += TICK_INTERVAL_MS;
      timerRef.current = setTimeout(tick, Math.max(0, TICK_INTERVAL_MS - drift));
    }

    timerRef.current = setTimeout(tick, TICK_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [targetMs, getSecondsRemaining]);

  const formatted = formatCountdown(secondsRemaining);

  return {
    secondsRemaining,
    formatted,
    isExpired: secondsRemaining <= 0,
    isLastMinute: secondsRemaining > 0 && secondsRemaining <= 60,
    isLastTenSeconds: secondsRemaining > 0 && secondsRemaining <= 10,
  };
}

/**
 * hooks/useHaptics.ts
 * CROWD WORLD — Haptic Feedback Engine
 *
 * Provides memoized haptic feedback functions covering every trigger point
 * defined in Blueprint v5.0 (Q13 · 16 triggers · Section 7 micro-interactions).
 *
 * ─── PRD trigger → function mapping (callsite reference) ─────────────────────
 *
 *  impactLight()
 *    · Tap city / sector pill             (Q13)
 *    · Tap input field to focus           (Q13)
 *    · Tap send button                    (Q13)
 *    · Glass Island tab tap               (§ Glass Island · LAW 13)
 *    · Double-tap message — Spark Gift    (Q13)
 *    · New message arrives off-screen     (Q13)
 *    · Heat Score crosses 50 / 75 / 90   (Q13 · Interaction [6])
 *    · Connection lost / Connection restored (Q13)
 *    · New messages chip — first appear  (Interaction [12])
 *    · Banner appearance (offline/error)  (§ B.1 State 6)
 *    · Rate-limit hit (one bump)          (§ B.1 State 9)
 *
 *  impactMedium()
 *    · Long-press city / sector pill      (Q13)
 *    · Long-press own or other's message  (Q13 · Interaction [10])
 *    · Mayor announcement (+ notificationSuccess) (Q13)
 *    · City switch confirmed  (+ notificationSuccess) (Q13)
 *    · WhatsApp Share tap     (§ Mandatory Delight Moments)
 *    · Send button error — recoverable    (§ B.2 State 5)
 *    · Send button error — fatal modal    (§ B.2 State 6 · once at open)
 *    · City / sector switch error         (§ B.1 State 5)
 *    · Cashout success (+ notificationSuccess) (§ D wallet flow)
 *
 *  impactHeavy()
 *    · Mayor Crown Arrival  (Interaction [11] — rare · status moment)
 *
 *  notificationSuccess()
 *    · Mayor announcement           (paired with impactMedium)
 *    · City switch confirmed        (paired with impactMedium)
 *    · Cashout / earning success    (paired with impactMedium)
 *
 *  notificationError()
 *    · Send failed (all retry paths) (§ B.2 State 5 / 6)
 *    · OTP incorrect                 (§ Auth screens · Notification(error))
 *    · Auth / network hard failure   (§ Error severity 5–6)
 *
 *  selectionFeedback()
 *    · City / sector picker list scroll  (bottom sheet row highlight)
 *    · Fine navigation selection changes
 *
 * ─── Guards ──────────────────────────────────────────────────────────────────
 *   Platform.OS === 'web' → every function is a no-op (expo-haptics is
 *   native-only; the web bundle does not include the module).
 *
 *   try / catch on every native call → fail silently on Android devices
 *   that lack a vibration motor or whose haptic API is unavailable at
 *   runtime (common on budget-segment Android in India — Realme, Redmi).
 *
 * ─── Memoization ─────────────────────────────────────────────────────────────
 *   All six functions are stabilised with useCallback(fn, []).
 *   The returned HapticEngine object is wrapped in useMemo() so its reference
 *   is truly stable for the component's lifetime — not just its values.
 *   This lets Button, ChatInput, and GlassIsland (all React.memo) receive the
 *   haptics prop without triggering unnecessary re-renders on parent updates.
 *
 * Layer : hook  |  STATUS: ✅ new  |  PRIORITY: P0
 * Deps  : expo-haptics ~15.0.8  (confirmed in package.json · no extra install)
 */

import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ─────────────────────────────────────────────────────────────────────────────
// Internal fire-and-forget helper
//
// Centralises the two cross-cutting concerns so each useCallback body stays
// a single expression:
//   1. Platform guard  — skip entirely on web (no native module available)
//   2. Error swallow   — Android hardware gaps must never crash the UI thread
//
// NOT exported — callers use the typed HapticEngine surface only.
// ─────────────────────────────────────────────────────────────────────────────

function fireHaptic(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;

  // Intentional fire-and-forget: haptic outcome is never user-visible.
  // The .catch swallow is the runtime equivalent of wrapping in try/catch
  // inside an async IIFE — cleaner for void async calls.
  fn().catch(() => {
    // Haptic hardware unavailable on this device — degrade silently.
    // Expected on: low-end Android without actuator, simulator/emulator,
    // first cold boot before haptic service initialises.
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported type
//
// Declare the engine shape independently of the hook so consumers can type
// prop-drilled haptics without importing the hook itself:
//
//   type Props = { haptics: HapticEngine };
// ─────────────────────────────────────────────────────────────────────────────

export type HapticEngine = {
  /**
   * Light transient impact.
   * Use for: pill tap · input focus · send button · Glass Island tab ·
   * Spark Gift double-tap · off-screen message arrival · Heat Score threshold ·
   * connection events · new messages chip · banner / rate-limit bump.
   */
  readonly impactLight: () => void;

  /**
   * Medium transient impact.
   * Use for: long-press (pill / message) · Mayor announcement · city switch
   * confirmed · WhatsApp share · send error · cashout success.
   */
  readonly impactMedium: () => void;

  /**
   * Heavy transient impact.
   * Use for: Mayor Crown Arrival ONLY (rare · once-per-session status moment).
   */
  readonly impactHeavy: () => void;

  /**
   * Notification — success pattern (three ascending taps on iOS).
   * Use for: Mayor announcement · city switch confirmed · cashout / earning.
   * Pair with impactMedium() at the same callsite per Q13.
   */
  readonly notificationSuccess: () => void;

  /**
   * Notification — error pattern (two descending taps on iOS).
   * Use for: send failed · OTP incorrect · auth / hard network failure.
   */
  readonly notificationError: () => void;

  /**
   * Selection changed feedback (single soft tick).
   * Use for: city / sector picker list scroll · fine navigation changes.
   */
  readonly selectionFeedback: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a stable HapticEngine object whose functions are memoized for the
 * component's lifetime.
 *
 * All functions are safe to call unconditionally — platform guards and error
 * swallowing are handled internally.
 *
 * @example Button press
 *   const { impactLight } = useHaptics();
 *   <Pressable onPressIn={impactLight} … />
 *
 * @example Mayor announcement (Q13 — paired haptics)
 *   const { impactMedium, notificationSuccess } = useHaptics();
 *   impactMedium();
 *   notificationSuccess();
 *
 * @example Passing engine to a memoized child
 *   const haptics = useHaptics();          // stable ref for lifetime of parent
 *   <GlassIsland haptics={haptics} />      // GlassIsland wrapped in React.memo ✓
 */
export function useHaptics(): HapticEngine {
  const impactLight = useCallback((): void => {
    fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, []);

  const impactMedium = useCallback((): void => {
    fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, []);

  const impactHeavy = useCallback((): void => {
    fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  }, []);

  const notificationSuccess = useCallback((): void => {
    fireHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
  }, []);

  const notificationError = useCallback((): void => {
    fireHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
  }, []);

  const selectionFeedback = useCallback((): void => {
    fireHaptic(() => Haptics.selectionAsync());
  }, []);

  // Wrap the returned object in useMemo for true referential stability.
  //
  // Without this, a plain `return { impactLight, ... }` creates a NEW object
  // reference on every parent re-render — even though all values are identical.
  // React.memo does a shallow prop comparison: newRef !== oldRef → re-render.
  // useMemo prevents that by holding the same object identity across renders.
  //
  // Why list all deps instead of []?
  //   useCallback(fn, []) guarantees these refs never change, so useMemo will
  //   also only run once in practice. But listing them satisfies the
  //   react-hooks/exhaustive-deps ESLint rule and makes the dependency chain
  //   explicit — correct even if deps ever gain values in a future revision.
  return useMemo<HapticEngine>(
    () => ({
      impactLight,
      impactMedium,
      impactHeavy,
      notificationSuccess,
      notificationError,
      selectionFeedback,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all are useCallback(fn,[]) — stable for lifetime
    [impactLight, impactMedium, impactHeavy, notificationSuccess, notificationError, selectionFeedback],
  );
}

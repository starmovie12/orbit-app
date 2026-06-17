/**
 * useDecision — Phase 5 Decision Window Lifecycle Hook
 *
 * Manages the complete Decision Window for Merit Winners:
 * - Detects Phase 5 start
 * - Fires Decision Prompt (full-screen, non-dismissible per LAW 3)
 * - Tracks 10-minute timer with drift correction
 * - Auto-executes KEEP TITLE on expiry
 * - Handles ACCEPT MONEY + confirmation flow
 * - Fires haptics (heavy × 3 on entry per §13.1)
 *
 * This hook is the single authority for Phase 5 state.
 * It never reads from UI; it only drives it.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import { DecisionPromptData, AsyncState } from '../types';
import { useCountdown } from './useCountdown';

// ── DECISION RESULT ───────────────────────────────────────────────────────────

export type DecisionOutcome = 'accepted' | 'kept';

export interface DecisionResult {
  outcome: DecisionOutcome;
  creditsReceived: number | null;
  toastMessage: string;
}

// ── HOOK STATE ────────────────────────────────────────────────────────────────

export type DecisionPhase =
  | 'idle'                // Not Phase 5 / not Merit Winner
  | 'active'             // Decision Prompt visible, timer ticking
  | 'confirming_accept'  // User tapped ACCEPT MONEY — showing confirmation sheet
  | 'submitting'         // Firestore write in flight
  | 'complete';          // Decision made / timer expired

export interface UseDecisionReturn {
  phase: DecisionPhase;
  data: DecisionPromptData | null;
  countdown: {
    secondsRemaining: number;
    formatted: { hours: string; minutes: string; seconds: string; display: string };
    isLastTenSeconds: boolean;
  };
  /** User tapped ACCEPT MONEY — show confirmation sheet */
  onAcceptTap: () => void;
  /** User confirmed ACCEPT MONEY in the confirmation sheet */
  onAcceptConfirm: () => Promise<void>;
  /** User cancelled from confirmation sheet */
  onAcceptCancel: () => void;
  /** User tapped KEEP TITLE — immediate, no confirmation needed */
  onKeepTitle: () => Promise<void>;
  submitState: AsyncState<DecisionResult>;
}

// ── HAPTIC ────────────────────────────────────────────────────────────────────

async function fireHapticHeavy(count: number, intervalMs: number): Promise<void> {
  // react-native-haptic-feedback or expo-haptics in production
  // Stub here — real implementation imports from native module
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
    // HapticFeedback.trigger('impactHeavy', { enableVibrateFallback: true });
  }
}

// ── HOOK ──────────────────────────────────────────────────────────────────────

export function useDecision(
  /** The Decision Prompt data from Firestore — null if not Merit Winner in Phase 5 */
  decisionData: DecisionPromptData | null,
  /** Callback to execute ACCEPT in Firestore (server-side via API) */
  executeAccept: (geographyId: string, tier: string) => Promise<{ creditsReceived: number }>,
  /** Callback to execute KEEP TITLE in Firestore */
  executeKeep: (geographyId: string, tier: string) => Promise<void>,
): UseDecisionReturn {
  const [phase, setPhase] = useState<DecisionPhase>('idle');
  const [submitState, setSubmitState] = useState<AsyncState<DecisionResult>>({
    status: 'idle',
  });

  const hasEnteredRef = useRef(false);

  // Derive target timestamp for countdown
  const targetMs = decisionData?.decisionEndsIn != null
    ? Date.now() + decisionData.decisionEndsIn * 1000
    : null;

  const { secondsRemaining, formatted, isLastTenSeconds } = useCountdown(
    targetMs,
    // On expiry → auto-execute KEEP TITLE
    useCallback(async () => {
      if (phase !== 'active') return;
      await executeAutoKeep();
    }, [phase]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── ENTRY: Fire when decisionData appears (Phase 5 starts) ──────────────
  useEffect(() => {
    if (decisionData && !hasEnteredRef.current) {
      hasEnteredRef.current = true;
      setPhase('active');
      // Fire signature haptic: heavy × 3, 200ms apart
      fireHapticHeavy(3, 200);
    }

    if (!decisionData && phase !== 'complete') {
      hasEnteredRef.current = false;
      setPhase('idle');
    }
  }, [decisionData, phase]);

  // ── AUTO-KEEP on timer expiry ──────────────────────────────────────────
  const executeAutoKeep = useCallback(async () => {
    if (!decisionData || phase === 'complete' || phase === 'submitting') return;

    setPhase('submitting');
    try {
      await executeKeep(decisionData.geographyId, decisionData.tier);
      setSubmitState({
        status: 'success',
        data: {
          outcome: 'kept',
          creditsReceived: null,
          toastMessage: `Auto-chose KEEP TITLE — title is yours! 👑`,
        },
        cachedAt: Date.now(),
      });
      setPhase('complete');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setSubmitState({ status: 'error', error: message, retryable: false });
      setPhase('active'); // Allow retry
    }
  }, [decisionData, executeKeep, phase]);

  // ── ACCEPT MONEY flow ─────────────────────────────────────────────────
  const onAcceptTap = useCallback(() => {
    if (phase !== 'active') return;
    setPhase('confirming_accept');
    // HapticFeedback.trigger('impactMedium');
  }, [phase]);

  const onAcceptCancel = useCallback(() => {
    if (phase !== 'confirming_accept') return;
    setPhase('active');
  }, [phase]);

  const onAcceptConfirm = useCallback(async () => {
    if (!decisionData || phase !== 'confirming_accept') return;

    setPhase('submitting');
    setSubmitState({ status: 'loading' });

    try {
      const result = await executeAccept(decisionData.geographyId, decisionData.tier);
      setSubmitState({
        status: 'success',
        data: {
          outcome: 'accepted',
          creditsReceived: result.creditsReceived,
          toastMessage: `${result.creditsReceived.toLocaleString('en-US')} Credits earned! Wallet updated. 🏆`,
        },
        cachedAt: Date.now(),
      });
      setPhase('complete');
      // HapticFeedback.trigger('impactHeavy');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setSubmitState({ status: 'error', error: message, retryable: true });
      setPhase('confirming_accept');
    }
  }, [decisionData, executeAccept, phase]);

  // ── KEEP TITLE (manual, no confirmation) ──────────────────────────────
  const onKeepTitle = useCallback(async () => {
    if (!decisionData || phase !== 'active') return;

    setPhase('submitting');
    setSubmitState({ status: 'loading' });

    try {
      await executeKeep(decisionData.geographyId, decisionData.tier);
      setSubmitState({
        status: 'success',
        data: {
          outcome: 'kept',
          creditsReceived: null,
          toastMessage: `Title kept! You're still ${decisionData.titleString}. 👑`,
        },
        cachedAt: Date.now(),
      });
      setPhase('complete');
      // HapticFeedback.trigger('impactMedium');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setSubmitState({ status: 'error', error: message, retryable: true });
      setPhase('active');
    }
  }, [decisionData, executeKeep, phase]);

  return {
    phase,
    data: decisionData,
    countdown: {
      secondsRemaining,
      formatted,
      isLastTenSeconds,
    },
    onAcceptTap,
    onAcceptConfirm,
    onAcceptCancel,
    onKeepTitle,
    submitState,
  };
}

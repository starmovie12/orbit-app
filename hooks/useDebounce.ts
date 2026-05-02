/**
 * hooks/useDebounce.ts
 * CROWD WORLD — Generic Debounce Hook
 *
 * Delays propagating a rapidly-changing value until it has been stable for
 * `delay` milliseconds. Every time `value` changes the timer resets; only
 * when the user stops changing it does the debounced copy update.
 *
 * ─── Consumers & recommended delays (Blueprint v5.0) ────────────────────────
 *
 *  SearchBar (Discover feed)          → 300ms  (PRD § 9621 · "results ≤300ms")
 *  City / Sector picker search        → 300ms  (PRD § 16208 · "server search 300ms debounce")
 *  DM list filter input               → 300ms  (PRD § 16143 · "300ms debounce on every keystroke")
 *  Live suggestions dropdown          → 300ms  (PRD § 16172 · "300ms debounce · 3+ chars")
 *  Saved Messages search              → 300ms  (local filter — no server call)
 *  Wallet transaction search          → 300ms  (local filter — no server call)
 *  Username uniqueness check          → 500ms  (PRD § 12015 · "server uniqueness check debounced 500ms")
 *  Analytics name-field typing        → 500ms  (PRD § 10964 · "name typing debounced 500ms")
 *
 * ─── Behaviour ───────────────────────────────────────────────────────────────
 *  • On mount            : debouncedValue === value  (no initial delay)
 *  • While value changes : timer resets each time → debouncedValue unchanged
 *  • After `delay` ms of stability : debouncedValue updates to current value
 *  • On unmount          : pending timer is cleared (no setState after unmount)
 *
 * Layer : hook  |  STATUS: ✅ new  |  PRIORITY: P1
 * Deps  : none  (React only)
 */

import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay`
 * milliseconds have elapsed since the last change.
 *
 * @param value - The rapidly-changing source value (any type).
 * @param delay - Debounce window in milliseconds.
 *                Use 300 for search inputs, 500 for uniqueness checks.
 * @returns     The stable, debounced value.
 *
 * @example Discover SearchBar (300ms)
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery    = useDebounce(query, 300);
 *
 *   useEffect(() => {
 *     if (debouncedQuery.trim()) searchFirestore(debouncedQuery);
 *   }, [debouncedQuery]);
 *
 * @example Username uniqueness check (500ms)
 *   const [username, setUsername] = useState('');
 *   const debouncedUsername       = useDebounce(username, 500);
 *
 *   useEffect(() => {
 *     if (debouncedUsername.length >= 3) checkUsernameAvailable(debouncedUsername);
 *   }, [debouncedUsername]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: cancel the pending timer if value changes before delay elapses,
    // or if the component unmounts. Prevents stale setState calls.
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

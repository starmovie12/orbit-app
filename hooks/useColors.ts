/**
 * hooks/useColors.ts
 * CROWD WORLD — Primary Color-Token Hook
 *
 * Reads the device appearance setting via useColorScheme() and returns the
 * memoized color token set for the active theme (light · dark).
 *
 * ─── Architecture constraints honoured ───────────────────────────────────────
 *
 * PRD § D.3.1 (§ 5.V Dark Mode Policy):
 *   "CROWD WORLD v1.0 ships LIGHT MODE ONLY · no dark mode toggle."
 *   iOS     → UIUserInterfaceStyle = "Light" (Info.plist)
 *   Android → android:forceDarkAllowed="false" (styles.xml)
 *   Fallback when useColorScheme() returns null → lightTheme  ← NOT darkTheme
 *   Dark tokens in constants/colors.ts are v2.0 placeholders · NOT active.
 *
 * Separation of concerns:
 *   This hook is COLOR ONLY (bg · fg · border · shadow · focus · status …).
 *   Static, scheme-independent tokens — spacing, typography, radii, zIndex,
 *   animation, dimensions — do NOT belong in a reactive hook. Import them
 *   directly from @/constants/colors where needed:
 *
 *     import { spacing, typography, radii } from '@/constants/colors';
 *
 * ─── Deps ────────────────────────────────────────────────────────────────────
 *   constants/colors.ts  (lightTheme · darkTheme · ColorPalette type)
 *   No hardcoded values in this file — tokens only.
 *
 * Layer : hook  |  STATUS: ✅ polished  |  PRIORITY: P2
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { lightTheme, darkTheme } from '@/constants/colors';
import type { ColorPalette } from '@/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// Exported type
//
// Built from ColorPalette (= ReturnType<typeof makePalette>) so it accurately
// describes BOTH lightTheme and darkTheme — not biased toward one baseline.
// isDark is readonly because the hook owns this value; consumers must not
// mutate it to fake a theme switch.
// ─────────────────────────────────────────────────────────────────────────────

/** Complete color token bundle returned by useColors(). */
export type ColorTokens = ColorPalette & { readonly isDark: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the CROWD WORLD color token set for the active color scheme.
 *
 * The return value is memoized — referential identity is stable until the
 * user's system appearance changes, preventing cascading re-renders in any
 * component wrapped in React.memo or using a stable selector.
 *
 * ⚠️  FALLBACK POLICY (PRD § D.3.1):
 *   null    → lightTheme  (v1.0 is light-mode only · forced at app root)
 *   'light' → lightTheme
 *   'dark'  → darkTheme  (wired for v2.0 — activates automatically once the
 *                          OS-level force is lifted in Info.plist / styles.xml)
 *
 * ⚠️  STATIC TOKENS:
 *   Do NOT reach for spacing / typography / radii through this hook.
 *   They are scheme-independent and never change with appearance.
 *   Import them directly at the component level:
 *     import { spacing, typography, radii, animation } from '@/constants/colors';
 *
 * @example Basic usage
 *   import { useColors } from '@/hooks/useColors';
 *   import { spacing, typography } from '@/constants/colors';
 *
 *   const { bg, fg, border, isDark } = useColors();
 *
 *   <View style={{ backgroundColor: bg.card, padding: spacing.base }}>
 *     <Text style={{ ...typography.body, color: fg.primary }}>
 *       Sector 17 pe kya scene hai?
 *     </Text>
 *   </View>
 *
 * @example Passing tokens as a stable prop (React.memo safe)
 *   const colors = useColors();      // stable ref until scheme toggles
 *   <MessageBubble colors={colors} />
 *
 * @example Dark-mode branch (v2.0 ready · no-op in v1.0)
 *   const { isDark, bg } = useColors();
 *   const overlayColor = isDark ? bg.inverse : bg.scrim;
 */
export function useColors(): ColorTokens {
  const scheme = useColorScheme(); // 'light' | 'dark' | null

  // PRD § D.3.1: null (first-frame / web / SSR) → light.
  // 'dark' branch is fully wired for v2.0 — remove the OS-level force
  // in Info.plist + styles.xml to activate without touching this file.
  const isDark = scheme === 'dark';

  return useMemo<ColorTokens>(
    () => ({
      ...(isDark ? darkTheme : lightTheme),
      isDark,
    }),
    [isDark],
  );
}

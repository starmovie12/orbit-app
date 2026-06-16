/**
 * components/atoms/Avatar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWN avatar — emoji-on-color circle.
 *
 * CROWN does NOT use photo uploads. Every user picks an emoji + a color at
 * onboarding (UserDoc.emoji / UserDoc.color). THAT is their avatar. This atom
 * renders that identity as a WhatsApp/Telegram-style circle to the left of a
 * chat bubble (PRD §10.2 — "Other User Message: Avatar + display name + tags").
 *
 * Render priority:
 *   1. emoji on the user's color            (normal case)
 *   2. initials from displayName on color   (fallback — emoji missing, e.g. old
 *                                             messages written before sender
 *                                             identity was denormalized)
 *   3. a single "?" on a neutral cream       (last resort — no name, no emoji)
 *
 * AI variant: pass `ai` → a 🤖 glyph on a muted surface with a dashed gold ring,
 * matching the AI bubble treatment (Non-Negotiable #9).
 *
 * Pure presentational atom. No hardcoded hex — palette tokens only, except the
 * per-user `color` which is dynamic user data (a valid exception).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, palette } from '@/constants/colors';

export interface AvatarProps {
  /** Display name — used for the initials fallback when no emoji is present. */
  name?:  string | null;
  /** Chosen avatar emoji (UserDoc.emoji). Preferred glyph. */
  emoji?: string | null;
  /** Chosen avatar color (UserDoc.color) — the circle background. */
  color?: string | null;
  /** Diameter in px. Default 36 (standard chat avatar). */
  size?:  number;
  /** AI companion treatment — 🤖 glyph + dashed gold ring. */
  ai?:    boolean;
  style?: ViewStyle;
}

/** First letters of up to two words, uppercased. "Aman Jeet" → "AJ". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function AvatarComponent({
  name,
  emoji,
  color,
  size = 36,
  ai = false,
  style,
}: AvatarProps) {
  const dimension: ViewStyle = {
    width:        size,
    height:       size,
    borderRadius: size / 2,
  };

  // ── AI companion ────────────────────────────────────────────────────────────
  if (ai) {
    return (
      <View
        style={[styles.base, styles.aiBase, dimension, style]}
        accessibilityLabel="AI companion"
      >
        <Text style={[styles.glyph, { fontSize: size * 0.5 }]} allowFontScaling={false}>
          🤖
        </Text>
      </View>
    );
  }

  const bg = color || palette.cream[300];
  const trimmedName = (name ?? '').trim();

  // ── Emoji (preferred) ───────────────────────────────────────────────────────
  if (emoji) {
    return (
      <View
        style={[styles.base, dimension, { backgroundColor: bg }, style]}
        accessibilityLabel={trimmedName ? `${trimmedName}'s avatar` : 'Avatar'}
      >
        <Text style={[styles.glyph, { fontSize: size * 0.5 }]} allowFontScaling={false}>
          {emoji}
        </Text>
      </View>
    );
  }

  // ── Initials fallback ───────────────────────────────────────────────────────
  return (
    <View
      style={[styles.base, dimension, { backgroundColor: bg }, style]}
      accessibilityLabel={trimmedName ? `${trimmedName}'s avatar` : 'Avatar'}
    >
      <Text
        style={[styles.initials, { fontSize: size * 0.4 }]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {initials(trimmedName)}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarComponent);
Avatar.displayName = 'Avatar';

export default Avatar;

const styles = StyleSheet.create({
  base: {
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  aiBase: {
    backgroundColor: palette.gold[50],
    borderWidth:     1,
    borderColor:     palette.gold[300],
    borderStyle:     'dashed',
  },
  glyph: {
    textAlign:        'center',
    includeFontPadding: false,
  },
  initials: {
    color:        palette.white,
    fontWeight:   '800',
    letterSpacing: 0.3,
    textAlign:    'center',
  },
});

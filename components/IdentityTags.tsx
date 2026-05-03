/**
 * components/IdentityTags.tsx — molecule
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD identity tag row.
 *
 * Renders an ordered list of Tag atoms in a single horizontal scroll strip.
 * All variant config, colors, and sizing live exclusively in
 * components/atoms/Tag.tsx — zero inline variant definitions here.
 *
 * Primary export
 * ──────────────
 *   <IdentityTags tags={['mayor', 'local', 'verified']} />
 *   <IdentityTags tags={['ai', 'colony']} max={2} size="sm" />
 *
 * Convenience named exports (thin Tag wrappers — backward-compatible)
 * ───────────────────────────────────────────────────────────────────
 *   <ColonyTag   name="Sector 22" />
 *   <VerifiedTag />
 *   <CreditsTag  amount="1.2k" />
 *   <LocalTag />
 *   <VisitorTag />
 *   <AITag />       <- LAW 14 + W-002: always visible, never conditionally hidden,
 *                      size is LOCKED -- no size prop exposed.
 *   <MoonTag />
 *   <MayorTag />
 *   <FounderTag  id="001" />
 *
 * Laws honored
 * ────────────
 *   - React.memo on every component -- safe inside FlatList / message rows.
 *   - Tokens only (spacing from @/constants/spacing) -- no hardcoded px.
 *   - Zero inline variant definitions -- 100% delegated to Tag atom.
 *   - Horizontal ScrollView for overflow -- tag row never wraps or clips.
 *   - AITag: size is non-configurable per LAW 14 (ai_tag token: 10px 600).
 *   - AITag: testID="ai-tag" required by blueprint test (section 9.2 line 9312).
 *   - AITag: always renders when mounted -- parent controls mount/unmount only.
 *
 * DEPS: components/atoms/Tag.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { Tag, type TagVariant, type TagSize } from '@/components/atoms/Tag';
import { spacing }                             from '@/constants/spacing';

// ─── IdentityTags — primary molecule export ───────────────────────────────────

export interface IdentityTagsProps {
  /**
   * Ordered list of TagVariant strings to render.
   * Rendered left to right in the supplied order.
   * When 'ai' is present it is always forced to size='sm' regardless
   * of the molecule-level `size` prop -- LAW 14 compliance.
   */
  tags: TagVariant[];
  /**
   * Maximum number of tags to display.
   * Tags beyond `max` are silently dropped.
   * @default 3
   */
  max?: number;
  /**
   * Size tier forwarded to every non-AI Tag atom.
   * The 'ai' variant ignores this and is always rendered at 'sm'
   * (blueprint ai_tag token: 10px 600 -- fixed, non-scalable).
   * @default 'sm'
   */
  size?: TagSize;
  /**
   * Optional wrapper style applied to the outer ScrollView.
   * Use to control margin / alignment at the call-site.
   */
  style?: ViewStyle;
}

/**
 * IdentityTags
 *
 * Horizontal scrollable row of Tag atoms.
 * Slices `tags` to `max` (default 3) then maps each variant to a Tag atom,
 * delegating all visual logic downstream.
 *
 * Overflow: ScrollView horizontal -- the row never wraps or clips.
 * showsHorizontalScrollIndicator is hidden to keep the UI clean on both platforms.
 *
 * AI size lock: when the 'ai' variant is encountered, size is overridden to 'sm'
 * regardless of the molecule-level size prop. Blueprint ai_tag token fixes this
 * at fontSize 10 / fontWeight 600 -- it must not scale.
 *
 * React.memo: array reference should be stable (useMemo / top-level const at
 * call-site) to avoid unnecessary re-renders inside FlatList rows.
 */
export const IdentityTags = memo<IdentityTagsProps>(function IdentityTags({
  tags,
  max = 3,
  size = 'sm',
  style,
}) {
  // Slice to max. Use spread so we never mutate the caller's array.
  let visible: TagVariant[] = max > 0 ? tags.slice(0, max) : [...tags];

  // W-002 AI SAFETY NET — LAW 14 compliance override.
  //
  // Problem: tags={['mayor', 'colony', 'verified', 'ai']} with max={3}
  // produces visible=['mayor', 'colony', 'verified'] -- 'ai' is silently
  // dropped. This is an AI Deception violation: if the data layer says
  // an AI is present, the UI must label it, no matter what.
  //
  // Fix: if 'ai' existed in the original array but was cut by the slice,
  // force-append it. Compliance always overrides visual max constraints.
  if (tags.includes('ai') && !visible.includes('ai')) {
    visible = [...visible, 'ai'];
  }

  if (visible.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      bounces={false}
      style={[styles.scroll, style]}
      contentContainerStyle={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel="Identity tags"
    >
      {visible.map((variant, index) => {
        // LAW 14 -- AI tag size is locked at 'sm' (10px 600).
        // Wrap in testID View because Tag atom has no testID passthrough.
        // Blueprint test assertion: expect(getByTestId('ai-tag')).toBeTruthy()
        if (variant === 'ai') {
          return (
            <View key={`ai-${index}`} testID="ai-tag" style={styles.aiWrapper}>
              <Tag variant="ai" size="sm" />
            </View>
          );
        }

        return (
          <Tag
            key={`${variant}-${index}`}
            variant={variant}
            size={size}
          />
        );
      })}
    </ScrollView>
  );
});

IdentityTags.displayName = 'IdentityTags';

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /**
   * Outer ScrollView.
   * alignSelf: 'flex-start' shrinks the strip to content width and prevents
   * it from stretching full-width inside flex parents.
   */
  scroll: {
    alignSelf: 'flex-start',
  },

  /**
   * Inner content row.
   * gap: spacing.xs (4px) -- blueprint inter-badge gap.
   * alignItems: 'center' -- vertically centers mixed-height tags
   * (verified circle vs pill differ by ~2px).
   */
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },

  /**
   * Zero-layout wrapper for AITag and the 'ai' slot in IdentityTags.
   * Carries testID="ai-tag" for the blueprint integration test.
   * alignSelf: 'flex-start' matches Tag atom's own alignSelf --
   * no unintended stretching in a flex row.
   * No padding, margin, or border -- purely a testID carrier.
   */
  aiWrapper: {
    alignSelf: 'flex-start',
  },
});

// ─── Convenience named exports ────────────────────────────────────────────────
//
// Thin Tag wrappers -- zero variant logic lives here.
// All visual behavior is owned exclusively by the Tag atom.
// Every component is React.memo'd with a named function for DevTools clarity.

// ── ColonyTag ─────────────────────────────────────────────────────────────────

export interface ColonyTagProps {
  /**
   * Colony / sector name passed as the Tag label.
   * Brackets are optional -- Tag atom renders the label as-is.
   */
  name:  string;
  size?: TagSize;
}

export const ColonyTag = memo<ColonyTagProps>(function ColonyTag({ name, size = 'sm' }) {
  return <Tag variant="colony" label={name} size={size} />;
});
ColonyTag.displayName = 'ColonyTag';

// ── VerifiedTag ───────────────────────────────────────────────────────────────

export interface VerifiedTagProps {
  size?: TagSize;
}

export const VerifiedTag = memo<VerifiedTagProps>(function VerifiedTag({ size = 'sm' }) {
  return <Tag variant="verified" size={size} />;
});
VerifiedTag.displayName = 'VerifiedTag';

// ── CreditsTag ────────────────────────────────────────────────────────────────

export interface CreditsTagProps {
  /** Formatted balance string: "1.2k", "420", "3.4k" */
  amount: string | number;
  size?:  TagSize;
}

export const CreditsTag = memo<CreditsTagProps>(function CreditsTag({ amount, size = 'sm' }) {
  return <Tag variant="credits" label={String(amount)} size={size} />;
});
CreditsTag.displayName = 'CreditsTag';

// ── LocalTag ──────────────────────────────────────────────────────────────────

export interface LocalTagProps {
  size?: TagSize;
}

export const LocalTag = memo<LocalTagProps>(function LocalTag({ size = 'sm' }) {
  return <Tag variant="local" size={size} />;
});
LocalTag.displayName = 'LocalTag';

// ── VisitorTag ────────────────────────────────────────────────────────────────

export interface VisitorTagProps {
  size?: TagSize;
}

export const VisitorTag = memo<VisitorTagProps>(function VisitorTag({ size = 'sm' }) {
  return <Tag variant="visitor" size={size} />;
});
VisitorTag.displayName = 'VisitorTag';

// ── AITag — LAW 14 + W-002 COMPLIANCE ────────────────────────────────────────
//
// LOCKED BEHAVIOR (non-negotiable):
//
//   SIZE LOCK
//   Blueprint ai_tag token: { fontSize: 10, fontWeight: '600', lineHeight: 14 }
//   This maps to Tag size='sm'. The size prop is NOT exposed on this component.
//   Any future attempt to accept and pass a size prop is a LAW 14 violation --
//   "AI identity must be visually impenetrable. It cannot be styled differently
//   per component. No transparency or custom sizes that reduce legibility."
//
//   testID REQUIREMENT
//   Blueprint integration test (section 9.2):
//     expect(getByTestId('ai-tag')).toBeTruthy()
//   Tag atom does not accept testID. This component adds a zero-layout wrapper
//   View with testID="ai-tag" so the test can locate the badge.
//
//   ALWAYS VISIBLE
//   This component must always render when mounted. The parent decides mount /
//   unmount -- this component never returns null, applies opacity, or hides
//   itself. Conditional rendering at this level is a W-002 violation.

export interface AITagProps {
  // Intentionally empty.
  // size is locked -- not exposed.
  // No other visual props -- all styling owned by Tag atom.
}

export const AITag = memo<AITagProps>(function AITag() {
  return (
    <View testID="ai-tag" style={styles.aiWrapper}>
      <Tag variant="ai" size="sm" />
    </View>
  );
});
AITag.displayName = 'AITag';

// ── MoonTag ───────────────────────────────────────────────────────────────────

export interface MoonTagProps {
  size?: TagSize;
}

export const MoonTag = memo<MoonTagProps>(function MoonTag({ size = 'sm' }) {
  return <Tag variant="moon" size={size} />;
});
MoonTag.displayName = 'MoonTag';

// ── MayorTag ──────────────────────────────────────────────────────────────────

export interface MayorTagProps {
  /** Sector name or mayor label -- falls back to "Mayor" when omitted. */
  label?: string;
  size?:  TagSize;
}

export const MayorTag = memo<MayorTagProps>(function MayorTag({ label, size = 'sm' }) {
  return <Tag variant="mayor" label={label} size={size} />;
});
MayorTag.displayName = 'MayorTag';

// ── FounderTag ────────────────────────────────────────────────────────────────

export interface FounderTagProps {
  /**
   * Sequential founder ID.
   * Pass "001" or "#001" -- the "#" prefix is auto-added by Tag atom if absent.
   */
  id?:   string;
  size?: TagSize;
}

export const FounderTag = memo<FounderTagProps>(function FounderTag({ id, size = 'sm' }) {
  return <Tag variant="founder" label={id} size={size} />;
});
FounderTag.displayName = 'FounderTag';

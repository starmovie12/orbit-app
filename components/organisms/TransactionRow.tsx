/**
 * TransactionRow — components/organisms/TransactionRow.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * CROWD WORLD · Blueprint v5.0 BAAP EDITION · Layer: organism
 * Status: v2 (blueprint-compliant) · Priority: P1
 *
 * Source-of-truth spec: MD file § 10 — Wallet Tab Blueprint · Section [5]
 * "TRANSACTION LIST (~10 rows · scrollable)"
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Per Row: 100% W · 72px H · 16px L/R · 12px V padding                  │
 * │  Bg: white · 1px cream-400 bottom border                                │
 * │                                                                          │
 * │  [44×44 circle icon] [title (14/600/ink-950) flex-1] [amount right]     │
 * │                       [date  (12/400/ink-500)]        [status badge]    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Icon / bg / color mapping (§10 Section [5] · verbatim):
 * ─────────────────────────────────────────────────────────
 *   credit  (Earned)   : ArrowDownLeft · cream-200 bg · gold-700 icon
 *   cashout            : ArrowUpRight  · cream-200 bg · amber-600 icon
 *   debit   (Spent)    : Zap           · cream-200 bg · gold-600 icon
 *   pass    (Purchased): Crown         · gold-100  bg · gold-700 icon
 *
 * Amount colors (§10 Section [5] · verbatim):
 * ─────────────────────────────────────────────
 *   credit  : "+250 Credits"   → gold-600
 *   cashout : "₹50"            → amber-600   (LAW 1 — ₹ only at cashout surface)
 *   debit   : "-1 Credit"      → ink-500
 *   pass    : "-200 Credits"   → gold-600
 *
 * Status badge (§10 Section [5] · 11px 500):
 * ────────────────────────────────────────────
 *   completed → emerald-600   pending → amber-600   failed → crimson-600
 *
 * Date: Hinglish relative time — validated as UX-superior by blueprint review.
 *
 * Deps: components/atoms/IconBox.tsx · constants/colors.ts · types/cw.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import IconBox from '@/components/atoms/IconBox';
import {
  colors,
  palette,
  typography,
  spacing,
  radii,
} from '@/constants/colors';
import type { CWTransaction, CWTransactionType, CWTransactionStatus } from '@/types/cw';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — CONSTANTS  (blueprint §10 Section [5] exact dimensions)
// ─────────────────────────────────────────────────────────────────────────────

/** Total row height per blueprint: 72px. */
const ROW_H = 72 as const;

/**
 * 44×44 circle icon: size(20) + padding(12) × 2 = 44px.
 * padding=12 is on the 8pt grid (spacing.md). size=20 keeps glyph proportional.
 */
const ICON_SIZE    = 20 as const;
const ICON_PADDING = 12 as const;  // spacing.md — 8pt grid ✓

/** Credits → INR conversion (10 credits = ₹1). LAW 1 — ₹ only at cashout. */
const CREDITS_PER_RUPEE = 10 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hinglish relative-time string from a Unix-ms timestamp.
 *
 * @example relativeTime(Date.now() - 7_200_000) // "2 ghante pehle"
 * @example relativeTime(Date.now() - 90_000)    // "1 minute pehle"
 */
function relativeTime(ms: number): string {
  const diffMs = Date.now() - ms;
  const secs   = Math.floor(diffMs / 1_000);
  const mins   = Math.floor(secs  / 60);
  const hours  = Math.floor(mins  / 60);
  const days   = Math.floor(hours / 24);

  if (secs  <  60)  return 'Abhi';
  if (mins  <  60)  return `${mins} minute pehle`;
  if (hours <  24)  return `${hours} ghante pehle`;
  if (days  ===  1) return 'Kal';
  if (days  <    7) return `${days} din pehle`;

  // Older dates → static "dd MMM" (blueprint fallback pattern)
  return new Date(ms).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
  });
}

/** "Credit" vs "Credits" — grammatical pluralisation. */
function creditsLabel(amount: number): string {
  return `${amount} ${Math.abs(amount) === 1 ? 'Credit' : 'Credits'}`;
}

// ── Icon config  (§10 Section [5] verbatim) ───────────────────────────────────

interface IconConfig {
  name:  string;  // Lucide PascalCase
  bg:    string;
  color: string;
}

const ICON_MAP: Record<CWTransactionType, IconConfig> = {
  credit:  {
    name:  'ArrowDownLeft',           // ⬇️ blueprint semantic
    bg:    palette.cream[200],        // cream-200 bg ✓
    color: palette.gold[700],         // gold-700 icon ✓
  },
  cashout: {
    name:  'ArrowUpRight',            // ⬆️ blueprint semantic
    bg:    palette.cream[200],        // cream-200 bg ✓
    color: palette.amber[600],        // amber-600 icon ✓
  },
  debit:   {
    name:  'Zap',                     // 💛 blueprint semantic (credits/spark)
    bg:    palette.cream[200],        // cream-200 bg ✓
    color: palette.gold[600],         // gold-600 icon ✓
  },
  pass:    {
    name:  'Crown',                   // 👑 blueprint semantic
    bg:    palette.gold[100],         // gold-100 bg ✓
    color: palette.gold[700],         // gold-700 icon ✓
  },
} as const;

// ── Amount display  (§10 Section [5] verbatim) ────────────────────────────────

interface AmountDisplay {
  text:  string;
  color: string;
}

function resolveAmount(tx: CWTransaction): AmountDisplay {
  switch (tx.type) {
    case 'credit':
      // blueprint: "+250 Credits" (gold-600)
      return {
        text:  `+${creditsLabel(tx.amount)}`,
        color: palette.gold[600],
      };
    case 'cashout':
      // LAW 1: ₹ symbol allowed only at cashout surface. credits → INR.
      return {
        text:  `₹${Math.floor(tx.amount / CREDITS_PER_RUPEE)}`,
        color: palette.amber[600],            // amber-600 ✓
      };
    case 'debit':
      // blueprint: "-1 Credit" (ink-500)
      return {
        text:  `-${creditsLabel(tx.amount)}`,
        color: palette.ink[500],              // ink-500 ✓
      };
    case 'pass':
      // Pass purchased — blueprint closest match to Spent but premium gold
      return {
        text:  `-${creditsLabel(tx.amount)}`,
        color: palette.gold[600],             // gold-600 (premium)
      };
  }
}

// ── Status badge  (§10 Section [5] verbatim) ──────────────────────────────────

interface StatusDisplay {
  label: string;
  color: string;
}

const STATUS_MAP: Record<CWTransactionStatus, StatusDisplay> = {
  completed: { label: 'Completed', color: palette.emerald[600] },  // emerald-600 ✓
  pending:   { label: 'Pending',   color: palette.amber[600]   },  // amber-600 ✓
  failed:    { label: 'Failed',    color: palette.crimson[600]  },  // crimson-600 ✓
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionRowProps {
  /** Fully-typed CROWN transaction — deserialized from Firestore. */
  tx: CWTransaction;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TransactionRow
 *
 * Single wallet history row matching blueprint §10 Section [5] exactly:
 *   · 44×44 circle icon with type-specific bg / color
 *   · flex-1 center column: title (14/600/ink-950) + Hinglish date (12/400/ink-500)
 *   · right column: formatted amount (14/700) + status badge (11/500)
 *   · 1px cream-400 full-width bottom border
 *
 * @example
 * // Inside wallet FlatList renderItem
 * <TransactionRow tx={item} />
 */
const TransactionRow: React.FC<TransactionRowProps> = ({ tx }) => {
  const iconCfg = ICON_MAP[tx.type];
  const amount  = resolveAmount(tx);
  const status  = STATUS_MAP[tx.status];
  const dateStr = relativeTime(tx.createdAtMs);

  return (
    <View style={styles.row}>

      {/* ── [1] 44×44 circle type icon ──────────────────────── */}
      <IconBox
        name={iconCfg.name}
        size={ICON_SIZE}
        padding={ICON_PADDING}
        bg={iconCfg.bg}
        color={iconCfg.color}
        radius={radii.full}            // circle — blueprint: "44×44 circle"
        strokeWidth={1.5}
      />

      {/* ── [2] Title + date — flex-1 ───────────────────────── */}
      <View style={styles.meta}>
        <Text
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {tx.description}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {dateStr}
        </Text>
      </View>

      {/* ── [3] Amount + status badge — right-aligned ────────── */}
      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: amount.color }]}>
          {amount.text}
        </Text>
        <Text style={[styles.statusBadge, { color: status.color }]}>
          {status.label}
        </Text>
      </View>

    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — STYLES
// All values sourced from blueprint §10 Section [5] + 8pt grid.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:          ROW_H,               // 72px
    paddingHorizontal:  spacing.base,        // 16px — blueprint: "16px L/R"
    paddingVertical:    spacing.md,          // 12px — blueprint: "12px V padding"
    gap:                spacing.md,          // 12px — blueprint: "12px gap"
    backgroundColor:    colors.bg.surface,   // white
    // blueprint: "1px cream-400 bottom border"
    borderBottomWidth:  1,
    borderBottomColor:  colors.border.default,  // palette.cream[400]
  },

  meta: {
    flex:     1,
    gap:      spacing.xs,                    // 4px — tight stack
    minWidth: 0,                             // allows numberOfLines ellipsis
  },

  title: {
    // blueprint: "14px 600 ink-950"
    ...typography.txTitle,                   // fontSize:14 · fontWeight:'600' · lineHeight:20
    color: colors.fg.primary,               // ink-950
  },

  date: {
    // blueprint: "12px 400 ink-500"
    ...typography.txSubtitle,               // fontSize:12 · fontWeight:'400' · lineHeight:16
    color: colors.fg.tertiary,             // ink-500
  },

  amountCol: {
    alignItems:  'flex-end',
    gap:          spacing.xs,               // 4px between amount and status badge
    flexShrink:   0,
  },

  amount: {
    // blueprint: "14px 700"
    ...typography.txAmount,                 // fontSize:14 · fontWeight:'700' · lineHeight:20
    letterSpacing: -0.3,
  },

  statusBadge: {
    // blueprint: "11px 500 · Completed/Pending/Failed"
    ...typography.txStatus,                 // fontSize:11 · fontWeight:'500' · lineHeight:14
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — EXPORT
// React.memo — CWTransaction has only primitive fields; shallow compare works.
// ─────────────────────────────────────────────────────────────────────────────

export default memo(TransactionRow);

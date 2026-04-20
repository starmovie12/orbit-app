/**
 * ORBIT — Shared UI Components (v2)
 *
 * Premium component library. No emojis in chrome. Lucide-style Feather icons only.
 * Quiet luxury — restraint, hierarchy by space and weight, ONE accent color.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { orbit } from '@/constants/colors';

/* ============================================================================
   Avatar — deterministic initials in a colored circle. NO emoji avatars.
   ============================================================================ */

const AVATAR_PALETTE = [
  '#5B7FFF', // Orbit blue
  '#8B5CF6', // violet
  '#2BB673', // green
  '#E8A33D', // amber
  '#E5484D', // red
  '#3B82F6', // blue
  '#EC4899', // pink
  '#06B6D4', // cyan
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().replace(/[@_]/g, ' ').split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AvatarProps = {
  name: string;
  size?: number;
  online?: boolean;
  ringed?: boolean; // For "this is you" treatment
};

export const Avatar = ({ name, size = 44, online, ringed }: AvatarProps) => {
  const colors = useColors();
  const bg = pickColor(name);
  const initials = initialsOf(name);
  const fontSize = Math.round(size * 0.38);
  const dotSize = Math.max(8, Math.round(size * 0.22));

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: ringed ? 2 : 0,
          borderColor: orbit.accent,
        }}
      >
        <Text
          style={{
            color: orbit.white,
            fontSize,
            fontWeight: '700',
            letterSpacing: -0.3,
          }}
        >
          {initials}
        </Text>
      </View>
      {online && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: orbit.success,
            borderWidth: 2,
            borderColor: orbit.bg,
          }}
        />
      )}
    </View>
  );
};

/* ============================================================================
   IconBox — replaces emoji-in-square. Subtle surface with monochrome icon.
   ============================================================================ */

export type IconBoxProps = {
  icon: any; // Feather icon name
  size?: number; // outer box size
  iconSize?: number;
  tint?: string; // optional accent — used SPARINGLY (icon color only, never as fill)
  variant?: 'square' | 'circle';
};

export const IconBox = ({
  icon,
  size = 40,
  iconSize,
  tint,
  variant = 'square',
}: IconBoxProps) => {
  const colors = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: variant === 'circle' ? size / 2 : 10,
        backgroundColor: orbit.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather
        name={icon}
        size={iconSize ?? Math.round(size * 0.5)}
        color={tint ?? orbit.textSecond}
      />
    </View>
  );
};

/* ============================================================================
   TierPill — subtle, never neon. 6px dot + label.
   ============================================================================ */

const TIER_DOT: Record<string, string> = {
  LEGEND:   '#E8A33D',
  CHAMPION: '#8B5CF6',
  MASTER:   '#5B7FFF',
  PRO:      '#2BB673',
  RISING:   '#A1A1AA',
  ACTIVE:   '#6B6B73',
};

export const TierPill = ({ tier }: { tier: string }) => {
  const dot = TIER_DOT[tier] ?? orbit.textTertiary;
  return (
    <View style={styles.tierPill}>
      <View style={[styles.tierDot, { backgroundColor: dot }]} />
      <Text style={styles.tierText}>{tier}</Text>
    </View>
  );
};

/* Backward-compat alias */
export const KarmaBadge = ({ badge }: { badge: string }) => <TierPill tier={badge} />;

/* ============================================================================
   ReadStatus — replaces double blue ticks. Single sleek glyph convention.
   ============================================================================ */

export type ReadStatusProps = { state: 'none' | 'sent' | 'delivered' | 'read' };

export const ReadStatus = ({ state }: ReadStatusProps) => {
  if (state === 'none') return null;
  if (state === 'sent') {
    return <Feather name="check" size={13} color={orbit.textTertiary} style={{ marginRight: 4 }} />;
  }
  if (state === 'delivered') {
    return <Feather name="check-circle" size={13} color={orbit.textTertiary} style={{ marginRight: 4 }} />;
  }
  // read
  return <Feather name="check-circle" size={13} color={orbit.accent} style={{ marginRight: 4 }} />;
};

/* Backward-compat alias for old code */
export const Ticks = ({ state }: { state: string }) => (
  <ReadStatus state={state as ReadStatusProps['state']} />
);

/* ============================================================================
   CreditPill — small inline pill, no coin emoji.
   ============================================================================ */

export const CreditPill = ({
  credits,
  onPress,
}: {
  credits: number;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.creditPill}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Feather name="circle" size={12} color={orbit.accent} style={{ marginRight: 5 }} />
    <Text style={styles.creditPillText}>{credits.toLocaleString()}</Text>
  </TouchableOpacity>
);

/* ============================================================================
   ScreenHeader — clean top bar, h1 title, optional right slot.
   ============================================================================ */

export const ScreenHeader = ({
  title,
  right,
  showBack,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 16 : insets.top;

  return (
    <View
      style={[
        styles.header,
        { paddingTop: topPad + 12 },
      ]}
    >
      {showBack && (
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
        </TouchableOpacity>
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
};

/* ============================================================================
   SearchBar — subtle, no emoji, focus ring on accent.
   ============================================================================ */

export const SearchBar = ({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <View
      style={[
        styles.searchContainer,
        {
          borderColor: focused ? orbit.accent : orbit.borderStrong,
          backgroundColor: orbit.surface2,
        },
      ]}
    >
      <Feather name="search" size={16} color={orbit.textTertiary} style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={orbit.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

/* ============================================================================
   Divider — 1px hairline, optional inset to align with list-item content.
   ============================================================================ */

export const Divider = ({ indent = true }: { indent?: boolean }) => (
  <View style={[styles.divider, { marginLeft: indent ? 76 : 0 }]} />
);

/* ============================================================================
   WalletDrawer — bottom sheet for credits. No emojis in chrome.
   ============================================================================ */

export const WalletDrawer = ({
  visible,
  onClose,
  credits,
}: {
  visible: boolean;
  onClose: () => void;
  credits: number;
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View
          style={[
            styles.walletDrawer,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={styles.walletHandle} />

          <View style={styles.walletTitleRow}>
            <Feather name="credit-card" size={20} color={orbit.textPrimary} />
            <Text style={styles.walletTitle}>Credits Wallet</Text>
          </View>

          <View style={styles.walletBalanceRow}>
            <Text style={styles.walletBalanceLabel}>Available balance</Text>
            <Text style={styles.walletBalance}>{credits.toLocaleString()}</Text>
          </View>

          <View style={styles.walletInfoCard}>
            <Feather
              name="info"
              size={14}
              color={orbit.textTertiary}
              style={{ marginRight: 8, marginTop: 2 }}
            />
            <Text style={styles.walletInfoText}>
              Watch a 15s promo to earn +1 credit. Daily limit: 20 credits/day.
            </Text>
          </View>

          <View style={styles.walletStatsRow}>
            {[
              { val: '20', lbl: 'Daily Cap' },
              { val: '8',  lbl: 'Used Today' },
              { val: '12', lbl: 'Remaining' },
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.walletStatDivider} />}
                <View style={styles.walletStat}>
                  <Text style={styles.walletStatVal}>{s.val}</Text>
                  <Text style={styles.walletStatLbl}>{s.lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          <TouchableOpacity style={styles.walletTopUpBtn} activeOpacity={0.85}>
            <Text style={styles.walletTopUpText}>Top up — ₹49 for 50 Credits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.walletCloseBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.walletCloseTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ============================================================================
   Styles — built from Orbit tokens. No magic numbers, all on 4px grid.
   ============================================================================ */

const styles = StyleSheet.create({
  /* Tier pill */
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.surface2,
    paddingLeft: 7,
    paddingRight: 9,
    height: 22,
    borderRadius: 11,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tierText: {
    color: orbit.textSecond,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  /* Credit pill */
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
    borderRadius: 16,
    height: 32,
    paddingHorizontal: 12,
  },
  creditPillText: {
    color: orbit.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: orbit.bg,
  },
  headerTitle: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginRight: 4,
  },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 14,
    padding: 0,
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: orbit.borderSubtle,
  },

  /* Wallet drawer */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  walletDrawer: {
    backgroundColor: orbit.surface3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  walletHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
    alignSelf: 'center',
    marginBottom: 20,
  },
  walletTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  walletTitle: {
    color: orbit.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  walletBalanceRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
    marginBottom: 16,
  },
  walletBalanceLabel: {
    color: orbit.textTertiary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  walletBalance: {
    color: orbit.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  walletInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  walletInfoText: {
    flex: 1,
    color: orbit.textSecond,
    fontSize: 14,
    lineHeight: 19,
  },
  walletStatsRow: {
    flexDirection: 'row',
    backgroundColor: orbit.surface2,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  walletStat: {
    flex: 1,
    alignItems: 'center',
  },
  walletStatVal: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  walletStatLbl: {
    color: orbit.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  walletStatDivider: {
    width: 1,
    backgroundColor: orbit.borderSubtle,
    marginVertical: 4,
  },
  walletTopUpBtn: {
    backgroundColor: orbit.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  walletTopUpText: {
    color: orbit.white,
    fontSize: 15,
    fontWeight: '600',
  },
  walletCloseBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  walletCloseTxt: {
    color: orbit.textSecond,
    fontSize: 14,
    fontWeight: '500',
  },
});

/**
 * ORBIT — Shared UI Components (v2)
 *
 * Premium component library. No emojis in chrome. Feather icons only.
 * Quiet luxury — restraint, hierarchy by space and weight, ONE accent color.
 * All colors via orbit.* tokens — zero hardcoded hex.
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
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { orbit } from '@/constants/colors';

export type FeatherIconName = ComponentProps<typeof Feather>['name'];

/* ============================================================================
   Avatar — deterministic initials in a colored circle. NO emoji avatars.
   All palette colors mapped to orbit.* tokens — zero hardcoded hex.
   ============================================================================ */

/**
 * Palette uses only orbit tokens so every color stays inside the design system.
 * We derive variety by mixing the semantic + accent tokens.
 */
const AVATAR_PALETTE: string[] = [
  orbit.accent,       // #5B7FFF — Orbit blue
  orbit.success,      // #2BB673 — green
  orbit.warning,      // #E8A33D — amber
  orbit.danger,       // #E5484D — red
  orbit.accentHover,  // #4A6FF0 — slightly deeper blue
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
  ringed?: boolean;
};

/**
 * Usage:
 *   <Avatar name="Arjun Singh" size={44} />
 *   <Avatar name="ghost_player" size={56} online ringed />
 */
export const Avatar = ({ name, size = 44, online, ringed }: AvatarProps) => {
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
  icon: FeatherIconName;
  size?: number;
  iconSize?: number;
  tint?: string;
  variant?: 'square' | 'circle';
};

/**
 * Usage:
 *   <IconBox icon="message-square" size={40} />
 *   <IconBox icon="award" size={44} tint={orbit.accent} variant="circle" />
 */
export const IconBox = ({
  icon,
  size = 40,
  iconSize,
  tint,
  variant = 'square',
}: IconBoxProps) => {
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
   TierPill — subtle badge for LEGEND / MASTER / PRO / RISING.
   No neon colors, no gradients. Tiny 6px dot + label. All orbit tokens.
   ============================================================================ */

export type TierLevel = 'LEGEND' | 'MASTER' | 'PRO' | 'RISING' | string;

const TIER_DOT: Record<string, string> = {
  LEGEND:  orbit.warning,
  MASTER:  orbit.accent,
  PRO:     orbit.success,
  RISING:  orbit.danger,
};

/**
 * Usage:
 *   <TierPill tier="LEGEND" />
 *   <TierPill tier="PRO" solid />
 */
export const TierPill = ({ tier, solid }: { tier: TierLevel; solid?: boolean }) => {
  const dot = TIER_DOT[tier] ?? orbit.textTertiary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 99,
        backgroundColor: solid ? orbit.accent : orbit.surface2,
        alignSelf: 'flex-start',
      }}
    >
      {!solid && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: dot,
          }}
        />
      )}
      <Text
        style={{
          color: solid ? orbit.textInverse : orbit.textSecond,
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        }}
      >
        {tier}
      </Text>
    </View>
  );
};

/* ============================================================================
   CreditPill — inline credits indicator. No coin emoji.
   ============================================================================ */

/**
 * Usage:
 *   <CreditPill count={1240} onPress={() => setDrawerOpen(true)} />
 */
export const CreditPill = ({
  count,
  onPress,
}: {
  count: number;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={sharedStyles.creditPill}
    activeOpacity={0.75}
    hitSlop={8}
    accessibilityRole="button"
    accessibilityLabel={`${count} credits`}
  >
    <Feather name="zap" size={13} color={orbit.accent} />
    <Text style={sharedStyles.creditText}>
      {count.toLocaleString()}
    </Text>
  </TouchableOpacity>
);

/* ============================================================================
   ReadStatus — single/double Feather Check icons. No blue double-tick clone.
   ============================================================================ */

export type ReadState = 'sent' | 'delivered' | 'read';

/**
 * Usage:
 *   <ReadStatus state="read" />
 */
export const ReadStatus = ({ state }: { state: ReadState }) => {
  const color = state === 'read' ? orbit.accent : orbit.textTertiary;
  if (state === 'sent') {
    return <Feather name="check" size={12} color={color} />;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: -4 }}>
      <Feather name="check" size={12} color={color} />
      <View style={{ marginLeft: -6 }}>
        <Feather name="check" size={12} color={color} />
      </View>
    </View>
  );
};

/* ============================================================================
   Divider — 1px hairline, inset from left.
   ============================================================================ */

/**
 * Usage:
 *   <Divider inset={76} />
 */
export const Divider = ({ inset = 0 }: { inset?: number }) => (
  <View
    style={{
      height: 1,
      backgroundColor: orbit.borderSubtle,
      marginLeft: inset,
    }}
  />
);

/* ============================================================================
   ScreenHeader — Top App Bar §4.6.
   56px, title left-aligned, action icons right.
   ============================================================================ */

export type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  borderOnScroll?: boolean;
  scrolled?: boolean;
};

/**
 * Usage:
 *   <ScreenHeader title="Rooms" right={<Feather name="search" ... />} />
 *   <ScreenHeader title="Settings" onBack={() => router.back()} scrolled={scrolled} />
 */
export const ScreenHeader = ({
  title,
  onBack,
  right,
  scrolled = false,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        sharedStyles.headerWrap,
        {
          paddingTop: insets.top,
          borderBottomWidth: scrolled ? 1 : 0,
          borderBottomColor: orbit.borderSubtle,
        },
      ]}
    >
      <View style={sharedStyles.headerInner}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={sharedStyles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color={orbit.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 4 }} />
        )}
        <Text style={sharedStyles.headerTitle}>{title}</Text>
        <View style={sharedStyles.headerRight}>{right ?? null}</View>
      </View>
    </View>
  );
};

/* ============================================================================
   SearchBar — subtle, Feather search icon, focus ring on accent.
   ============================================================================ */

export type SearchBarProps = {
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
};

/**
 * Usage:
 *   <SearchBar placeholder="Search rooms..." value={q} onChangeText={setQ} />
 */
export const SearchBar = ({
  placeholder = 'Search…',
  value,
  onChangeText,
}: SearchBarProps) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <View
      style={[
        sharedStyles.searchWrap,
        focused && { borderColor: orbit.accent },
      ]}
    >
      <Feather name="search" size={16} color={orbit.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={orbit.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={sharedStyles.searchInput}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityRole="search"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Feather name="x" size={15} color={orbit.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

/* ============================================================================
   WalletDrawer — bottom sheet for credits balance. No emojis in chrome.
   ============================================================================ */

export type WalletDrawerProps = {
  visible: boolean;
  onClose: () => void;
  credits: number;
};

/**
 * Usage:
 *   <WalletDrawer visible={open} onClose={() => setOpen(false)} credits={1240} />
 */
export const WalletDrawer = ({ visible, onClose, credits }: WalletDrawerProps) => {
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={sharedStyles.drawerBackdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close wallet"
      >
        <Animated.View
          style={[
            sharedStyles.drawerSheet,
            {
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={sharedStyles.drawerHandle} />
          <Text style={sharedStyles.drawerTitle}>Your Wallet</Text>

          <View style={sharedStyles.balanceRow}>
            <Feather name="zap" size={28} color={orbit.accent} />
            <Text style={sharedStyles.balanceNum}>
              {credits.toLocaleString()}
            </Text>
            <Text style={sharedStyles.balanceLbl}>credits</Text>
          </View>

          <View style={sharedStyles.drawerActions}>
            <TouchableOpacity
              style={sharedStyles.drawerActionBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Top up credits"
            >
              <Feather name="plus-circle" size={18} color={orbit.accent} />
              <Text style={sharedStyles.drawerActionText}>Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sharedStyles.drawerActionBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Transaction history"
            >
              <Feather name="list" size={18} color={orbit.textSecond} />
              <Text style={sharedStyles.drawerActionText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sharedStyles.drawerActionBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Send credits"
            >
              <Feather name="send" size={18} color={orbit.textSecond} />
              <Text style={sharedStyles.drawerActionText}>Send</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ============================================================================
   NotificationBadge — circular unread count. Caps at 99+.
   ============================================================================ */

/**
 * Usage:
 *   <NotificationBadge count={5} />
 *   <NotificationBadge count={120} />  → shows "99+"
 */
export const NotificationBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  const minW = label.length > 2 ? 26 : 18;
  return (
    <View
      style={{
        minWidth: minW,
        height: 18,
        borderRadius: 9,
        backgroundColor: orbit.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text
        style={{
          color: orbit.textInverse,
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 14,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

/* ============================================================================
   EmptyState — §4.10. Centered, max 320px, Feather icon.
   ============================================================================ */

export type EmptyStateProps = {
  icon: FeatherIconName;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
};

/**
 * Usage:
 *   <EmptyState
 *     icon="message-square"
 *     title="No rooms yet"
 *     description="Join a room or create your own to get started."
 *     ctaLabel="Browse Rooms"
 *     onCta={() => router.push('/(tabs)/discover')}
 *   />
 */
export const EmptyState = ({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) => (
  <View style={sharedStyles.emptyWrap}>
    <Feather name={icon} size={64} color={orbit.textTertiary} />
    <Text style={sharedStyles.emptyTitle}>{title}</Text>
    <Text style={sharedStyles.emptyDesc}>{description}</Text>
    {ctaLabel && onCta && (
      <TouchableOpacity
        onPress={onCta}
        style={sharedStyles.emptyCta}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <Text style={sharedStyles.emptyCtaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

/* ============================================================================
   Shared StyleSheet
   ============================================================================ */

const sharedStyles = StyleSheet.create({
  /* CreditPill */
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: orbit.surface2,
  },
  creditText: {
    color: orbit.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  /* ScreenHeader */
  headerWrap: {
    backgroundColor: orbit.bg,
  },
  headerInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginRight: 4,
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
    gap: 16,
  },

  /* SearchBar */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderStrong,
  },
  searchInput: {
    flex: 1,
    color: orbit.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },

  /* WalletDrawer */
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: orbit.surface3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
    alignSelf: 'center',
    marginBottom: 20,
  },
  drawerTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 28,
  },
  balanceNum: {
    color: orbit.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  balanceLbl: {
    color: orbit.textSecond,
    fontSize: 17,
    fontWeight: '400',
  },
  drawerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  drawerActionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: orbit.surface2,
    borderWidth: 1,
    borderColor: orbit.borderSubtle,
  },
  drawerActionText: {
    color: orbit.textSecond,
    fontSize: 13,
    fontWeight: '500',
  },

  /* EmptyState */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: 320,
    alignSelf: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: orbit.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyDesc: {
    color: orbit.textSecond,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: orbit.accent,
  },
  emptyCtaText: {
    color: orbit.textInverse,
    fontSize: 15,
    fontWeight: '600',
  },
});

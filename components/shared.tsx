import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CreditPill = ({ credits, onPress }: { credits: number; onPress: () => void }) => {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.creditPill, { backgroundColor: colors.green + '20', borderColor: colors.green + '55' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.creditPillText, { color: colors.green }]}>🪙 {credits}</Text>
    </TouchableOpacity>
  );
};

export const Ticks = ({ state }: { state: string }) => {
  const colors = useColors();
  if (state === 'none') return null;
  if (state === 'sent') return <Text style={[styles.tick, { color: colors.mutedForeground }]}>✓</Text>;
  if (state === 'delivered') return <Text style={[styles.tick, { color: colors.mutedForeground }]}>✓✓</Text>;
  if (state === 'read') return <Text style={[styles.tick, { color: colors.blueLight }]}>✓✓</Text>;
  return null;
};

export const KarmaBadge = ({ badge }: { badge: string }) => {
  const colors = useColors();
  const badgeColor: Record<string, string> = {
    LEGEND:   colors.gold,
    CHAMPION: colors.purple,
    MASTER:   colors.blueLight,
    PRO:      colors.green,
    RISING:   colors.primary,
    ACTIVE:   colors.mutedForeground,
  };
  const bc = badgeColor[badge] || colors.mutedForeground;
  return (
    <View style={[styles.karmaBadge, { borderColor: bc + '55', backgroundColor: bc + '20' }]}>
      <Text style={[styles.karmaBadgeText, { color: bc }]}>{badge}</Text>
    </View>
  );
};

export const ScreenHeader = ({ title, right }: { title: string; right?: React.ReactNode }) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <View style={[
      styles.header,
      {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        paddingTop: topPad + 8,
      }
    ]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      {right && <View style={styles.headerRight}>{right}</View>}
    </View>
  );
};

export const SearchBar = ({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) => {
  const colors = useColors();
  return (
    <View style={[
      styles.searchContainer,
      { backgroundColor: colors.surface2, borderColor: colors.border }
    ]}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
};

export const Divider = ({ indent = true }: { indent?: boolean }) => {
  const colors = useColors();
  return (
    <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: indent ? 72 : 0 }]} />
  );
};

export const WalletDrawer = ({
  visible,
  onClose,
  credits,
}: {
  visible: boolean;
  onClose: () => void;
  credits: number;
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.modalOverlay]}
        onPress={onClose}
        activeOpacity={1}
      >
        <View
          style={[
            styles.walletDrawer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={[styles.walletHandle, { backgroundColor: colors.mutedForeground }]} />
          <Text style={[styles.walletTitle, { color: colors.text }]}>🪙 Credit Wallet</Text>
          <Divider indent={false} />

          <View style={styles.walletBalanceRow}>
            <Text style={[styles.walletBalanceLabel, { color: colors.sub }]}>Available Credits</Text>
            <Text style={[styles.walletBalance, { color: colors.green }]}>{credits}</Text>
          </View>

          <View style={[styles.walletInfoCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.walletInfoText, { color: colors.sub }]}>
              💡 Watch a 15s promo to earn +1 credit. Daily limit: 20 credits/day.
            </Text>
          </View>

          <View style={[styles.walletStatsRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            {[
              { val: '20', lbl: 'Daily Cap' },
              { val: '8',  lbl: 'Used Today' },
              { val: '12', lbl: 'Remaining' },
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={[styles.walletStatDivider, { backgroundColor: colors.border }]} />}
                <View style={styles.walletStat}>
                  <Text style={[styles.walletStatVal, { color: colors.text }]}>{s.val}</Text>
                  <Text style={[styles.walletStatLbl, { color: colors.mutedForeground }]}>{s.lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          <TouchableOpacity style={[styles.walletTopUpBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={[styles.walletTopUpText, { color: '#fff' }]}>⚡ Top Up — ₹49 for 50 Credits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.walletCloseBtn, { borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={[styles.walletCloseTxt, { color: colors.sub }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  creditPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tick: {
    fontSize: 13,
    marginRight: 2,
  },
  karmaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  karmaBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  divider: {
    height: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  walletDrawer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  walletHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  walletBalanceLabel: {
    fontSize: 14,
  },
  walletBalance: {
    fontSize: 28,
    fontWeight: '800',
  },
  walletInfoCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  walletInfoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  walletStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 16,
  },
  walletStat: {
    alignItems: 'center',
    flex: 1,
  },
  walletStatVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  walletStatLbl: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  walletStatDivider: {
    width: 1,
    height: 36,
  },
  walletTopUpBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  walletTopUpText: {
    fontSize: 15,
    fontWeight: '700',
  },
  walletCloseBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  walletCloseTxt: {
    fontSize: 14,
    fontWeight: '600',
  },
});

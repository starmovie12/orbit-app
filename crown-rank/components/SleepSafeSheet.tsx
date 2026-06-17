/**
 * SleepSafeSheet — Sleep-Safe Auction Settings Bottom Sheet
 *
 * Per PRD §14 (Section 14 + §8.8 Layer 3):
 * - Per-tier Auto-Accept threshold configuration
 * - Baron / Viceroy / Sovereign / Imperator — each with its own threshold
 * - "Wake me for ANY bid" toggle (overrides Quiet Hours)
 * - "Critical Decision Bypass" threshold for max-volume wake-up
 * - Persisted to Firestore /users/{userId}.sleep_safe
 *
 * Three-layer Sleep-Safe system (§8.8):
 *   Layer 1: Push notification (existing)
 *   Layer 2: Vibration burst at max volume (existing)
 *   Layer 3: THIS SCREEN — Pre-configured Auto-Accept per tier
 *
 * Zero raw hex values. All from tokens.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  TextInput,
  Platform,
} from 'react-native';
import { SleepSafeSettings, Tier } from '../types';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TOUCH_TARGET,
  TIER_META as TierMetaMap,
} from '../tokens';
import { TIER_TO_TITLE as TitleMap } from '../constants/titles';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface SleepSafeSheetProps {
  visible: boolean;
  initialSettings: SleepSafeSettings;
  onSave: (settings: SleepSafeSettings) => Promise<void>;
  onClose: () => void;
}

// ── TIER FIELD NAMES ──────────────────────────────────────────────────────────

const TIER_SETTING_KEYS: Array<{
  tier: Tier;
  fieldKey: keyof SleepSafeSettings;
}> = [
  { tier: 'baron', fieldKey: 'baronThreshold' },
  { tier: 'viceroy', fieldKey: 'viceroyThreshold' },
  { tier: 'sovereign', fieldKey: 'sovereignThreshold' },
  { tier: 'imperator', fieldKey: 'imperatorThreshold' },
];

// ── TIER THRESHOLD ROW ────────────────────────────────────────────────────────

interface TierThresholdRowProps {
  tier: Tier;
  threshold: number | null;
  onThresholdChange: (value: number | null) => void;
}

const TierThresholdRow: React.FC<TierThresholdRowProps> = ({
  tier,
  threshold,
  onThresholdChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    threshold != null ? threshold.toString() : '',
  );

  const isEnabled = threshold != null;
  const meta = TierMetaMap[tier];
  const titleLabel = TitleMap[tier];

  const handleToggle = useCallback(
    (val: boolean) => {
      if (val) {
        onThresholdChange(500); // Sensible default
      } else {
        onThresholdChange(null);
      }
    },
    [onThresholdChange],
  );

  const handleEdit = useCallback(() => {
    setEditing(true);
    setInputValue(threshold?.toString() ?? '');
  }, [threshold]);

  const handleSave = useCallback(() => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onThresholdChange(parsed);
    }
    setEditing(false);
  }, [inputValue, onThresholdChange]);

  const tierLabel = `${meta.emoji} ${titleLabel} tier (${meta.scope})`;

  return (
    <View style={styles.tierRow}>
      <Text style={styles.tierRowTitle}>{tierLabel}</Text>
      <View style={styles.tierRowControls}>
        {/* Enable/disable toggle */}
        <Text style={styles.tierToggleLabel}>
          Auto-accept bids above:
        </Text>
        <View style={styles.tierControlRight}>
          {isEnabled && !editing && (
            <>
              <Text style={styles.thresholdValue}>
                {new Intl.NumberFormat('en-US').format(threshold!)} Credits
              </Text>
              <TouchableOpacity
                onPress={handleEdit}
                style={styles.editBtn}
                accessibilityLabel={`Edit auto-accept threshold for ${titleLabel}`}
                accessibilityRole="button"
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </>
          )}
          {isEnabled && editing && (
            <View style={styles.editRow}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                style={styles.thresholdInput}
                placeholder="e.g. 5000"
                placeholderTextColor={COLORS_DARK.fgTextDisabled}
                accessibilityLabel={`Enter threshold amount for ${titleLabel}`}
                autoFocus
              />
              <TouchableOpacity
                onPress={handleSave}
                style={styles.saveInlineBtn}
                accessibilityLabel="Save threshold"
                accessibilityRole="button"
              >
                <Text style={styles.saveInlineBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isEnabled && (
            <Text style={styles.offLabel}>OFF</Text>
          )}
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{
              false: COLORS_DARK.borderSubtle,
              true: COLORS_DARK.fgBrand,
            }}
            thumbColor={isEnabled ? COLORS_DARK.fgBrandLight : COLORS_DARK.fgTextDisabled}
            ios_backgroundColor={COLORS_DARK.borderSubtle}
            accessibilityLabel={`Toggle auto-accept for ${titleLabel}`}
          />
        </View>
      </View>
    </View>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const SleepSafeSheet: React.FC<SleepSafeSheetProps> = ({
  visible,
  initialSettings,
  onSave,
  onClose,
}) => {
  const [settings, setSettings] = useState<SleepSafeSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wakeThresholdEditing, setWakeThresholdEditing] = useState(false);
  const [wakeThresholdInput, setWakeThresholdInput] = useState(
    settings.minWakeAmount?.toString() ?? '',
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(settings);
      onClose();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [settings, onSave, onClose]);

  const updateThreshold = useCallback(
    (key: keyof SleepSafeSettings, value: number | null) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sleep-Safe Auction Settings</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close Sleep-Safe settings"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Per-tier thresholds */}
          {TIER_SETTING_KEYS.map(({ tier, fieldKey }) => (
            <React.Fragment key={tier}>
              <TierThresholdRow
                tier={tier}
                threshold={settings[fieldKey] as number | null}
                onThresholdChange={(value) => updateThreshold(fieldKey, value)}
              />
              <View style={styles.sectionDivider} />
            </React.Fragment>
          ))}

          {/* Critical Decision Bypass */}
          <View style={styles.criticalSection}>
            <Text style={styles.criticalTitle}>CRITICAL DECISION BYPASS</Text>
            <View style={styles.criticalRow}>
              <Text style={styles.criticalLabel}>
                Wake me up for bids above:
              </Text>
              <View style={styles.criticalRight}>
                {!wakeThresholdEditing ? (
                  <>
                    <Text style={styles.thresholdValue}>
                      {new Intl.NumberFormat('en-US').format(settings.minWakeAmount ?? 10000)}{' '}
                      Credits
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setWakeThresholdEditing(true);
                        setWakeThresholdInput(settings.minWakeAmount?.toString() ?? '');
                      }}
                      style={styles.editBtn}
                      accessibilityLabel="Edit critical wake amount"
                      accessibilityRole="button"
                    >
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.editRow}>
                    <TextInput
                      value={wakeThresholdInput}
                      onChangeText={setWakeThresholdInput}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        const parsed = parseInt(wakeThresholdInput, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                          setSettings((prev) => ({ ...prev, minWakeAmount: parsed }));
                        }
                        setWakeThresholdEditing(false);
                      }}
                      style={styles.thresholdInput}
                      placeholder="e.g. 10000"
                      placeholderTextColor={COLORS_DARK.fgTextDisabled}
                      accessibilityLabel="Enter critical wake threshold amount"
                      autoFocus
                    />
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.criticalNote}>
              Overrides Quiet Hours. Fires at max volume.
            </Text>

            <View style={styles.wakeAnyRow}>
              <Text style={styles.wakeAnyLabel}>"Wake me for ANY bid"</Text>
              <Switch
                value={settings.wakeForAny}
                onValueChange={(val) =>
                  setSettings((prev) => ({ ...prev, wakeForAny: val }))
                }
                trackColor={{
                  false: COLORS_DARK.borderSubtle,
                  true: COLORS_DARK.fgAccentOrange,
                }}
                thumbColor={settings.wakeForAny ? COLORS_DARK.fgAccentOrange : COLORS_DARK.fgTextDisabled}
                accessibilityLabel="Toggle wake me for any bid"
              />
            </View>
          </View>

          {/* Info note */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon} aria-hidden>ℹ︎</Text>
            <Text style={styles.infoText}>
              Default: KEEP TITLE if you don't respond in 10 min.{'\n'}
              Auto-Accept triggers ONLY if a bid exceeds your threshold.{'\n'}
              Below threshold, manual Decision fires.
            </Text>
          </View>

          {/* Error */}
          {saveError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {saveError}</Text>
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            accessibilityLabel="Save Sleep-Safe settings"
            accessibilityRole="button"
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: COLORS_DARK.bgElevated,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    maxHeight: '85%',
    paddingBottom: Platform.select({ ios: 34, android: 24, default: 24 }),
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.pill,
    alignSelf: 'center',
    marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS_DARK.borderSubtle,
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextStrong,
  },
  closeBtn: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: 0,
  },

  // Tier rows
  tierRow: {
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  tierRowTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
  },
  tierRowControls: {
    gap: SPACING.xs,
  },
  tierToggleLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  tierControlRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  thresholdValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgBrand,
    fontWeight: '700',
  },
  offLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextDisabled,
  },
  editBtn: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  editBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgBrand,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  thresholdInput: {
    flex: 1,
    backgroundColor: COLORS_DARK.bgCard,
    borderWidth: 1,
    borderColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    minHeight: TOUCH_TARGET,
  },
  saveInlineBtn: {
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.sm,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInlineBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.bgSurface,
  },

  sectionDivider: {
    height: 1,
    backgroundColor: COLORS_DARK.borderSubtle,
  },

  // Critical section
  criticalSection: {
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  criticalTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgAccentOrange,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  criticalRow: {
    gap: SPACING.xs,
  },
  criticalLabel: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  criticalRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  criticalNote: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
  },
  wakeAnyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH_TARGET,
  },
  wakeAnyLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.card,
    padding: SPACING.base,
    marginTop: SPACING.md,
  },
  infoIcon: {
    fontSize: 16,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 20,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
    lineHeight: 18,
  },

  // Error box
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgDanger,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS_DARK.borderSubtle,
  },
  saveBtn: {
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },
});

export default React.memo(SleepSafeSheet);

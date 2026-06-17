/**
 * CrownJourneyTimeline — Horizontal scrollable crown journey
 *
 * Per PRD §11 (Section 7):
 * - Horizontal ScrollView, rightmost = present
 * - Node types:
 *     ● small gray dot = badge (Heard Today / Rising / Top 10)
 *     ◆ medium gold diamond = title won
 *     ★ star = first-ever title in that tier
 *     ◉ large pulsing gold = current active title (rightmost, animated)
 * - Each node tappable → opens bottom sheet with detail
 * - Empty state: "Start your journey here"
 *
 * Per PRD §11.2:
 * - Empty state shows a single faded dot with "Start your journey" copy
 *
 * Per LAW 6: no layout shift on scroll; FlatList horizontal for virtualization.
 * Zero raw hex values. All from tokens.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  Modal,
  TouchableOpacity,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { TimelineNode, TimelineNodeType, Tier } from '../types';
import {
  COLORS_DARK,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  TIER_META,
  TOUCH_TARGET,
  MOTION,
} from '../tokens';
import { TIER_TO_TITLE, formatCredits } from '../constants/titles';

// ── PROPS ─────────────────────────────────────────────────────────────────────

interface CrownJourneyTimelineProps {
  nodes: TimelineNode[];
}

// ── NODE DOT VISUAL CONFIG ────────────────────────────────────────────────────

interface NodeVisual {
  size: number;
  symbol: string;
  color: string;
  isAnimated: boolean;
}

function getNodeVisual(type: TimelineNodeType, tier: Tier | null): NodeVisual {
  switch (type) {
    case 'current':
      return { size: 20, symbol: '◉', color: COLORS_DARK.fgBrand, isAnimated: true };
    case 'first_title':
      return { size: 16, symbol: '★', color: COLORS_DARK.fgBrandLight, isAnimated: false };
    case 'title':
      return { size: 14, symbol: '◆', color: COLORS_DARK.fgBrand, isAnimated: false };
    case 'badge':
    default:
      return { size: 10, symbol: '●', color: COLORS_DARK.fgTextDisabled, isAnimated: false };
  }
}

// ── NODE DETAIL SHEET ─────────────────────────────────────────────────────────

interface NodeDetailSheetProps {
  node: TimelineNode | null;
  onClose: () => void;
}

const NodeDetailSheet: React.FC<NodeDetailSheetProps> = ({ node, onClose }) => {
  if (!node) return null;

  const visual = getNodeVisual(node.type, node.tier);
  const earnedDate = new Date(node.earnedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {node.tier ? (
              <>
                {TIER_META[node.tier].emoji}{' '}
                {TIER_TO_TITLE[node.tier]}
                {node.geographyLabel ? ` of ${node.geographyLabel}` : ''}
              </>
            ) : (
              node.label
            )}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close detail sheet"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text style={styles.sheetDate}>
          📅 {earnedDate} · Cycle #{node.detail.cycleNumber}
        </Text>

        {/* Rank score */}
        {node.detail.rankScore > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rank Score</Text>
            <Text style={styles.detailValue}>{node.detail.rankScore} pts</Text>
          </View>
        )}

        {/* Bid received */}
        {node.detail.bidReceived != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bid received</Text>
            <Text style={styles.detailValue}>
              {new Intl.NumberFormat('en-US').format(node.detail.bidReceived)} Cr
            </Text>
          </View>
        )}

        {/* Decision */}
        {node.detail.userDecision != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Your decision</Text>
            <Text style={[
              styles.detailValue,
              {
                color: node.detail.userDecision === 'kept'
                  ? COLORS_DARK.fgBrand
                  : COLORS_DARK.fgSuccess,
              },
            ]}>
              {node.detail.userDecision === 'kept' ? '👑 Kept Title' : '💰 Accepted Money'}
            </Text>
          </View>
        )}

        {/* Duration held */}
        {node.detail.cycleDurationHeld != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Held for</Text>
            <Text style={styles.detailValue}>
              {Math.floor(node.detail.cycleDurationHeld / 60)}h{' '}
              {node.detail.cycleDurationHeld % 60}m
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={onClose}
          style={styles.doneBtn}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ── SINGLE TIMELINE NODE ──────────────────────────────────────────────────────

interface TimelineNodeItemProps {
  node: TimelineNode;
  isLast: boolean;
  onTap: (node: TimelineNode) => void;
  reducedMotion: boolean;
}

const TimelineNodeItem: React.FC<TimelineNodeItemProps> = ({
  node,
  isLast,
  onTap,
  reducedMotion,
}) => {
  const visual = getNodeVisual(node.type, node.tier);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visual.isAnimated || reducedMotion) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: MOTION.shimmer / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: MOTION.shimmer / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visual.isAnimated, pulseAnim, reducedMotion]);

  const dateStr = new Date(node.earnedAt).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });

  const accessibilityLabel =
    `${node.label}` +
    (node.geographyLabel ? ` in ${node.geographyLabel}` : '') +
    `. ${dateStr}.` +
    (node.type === 'current' ? ' Current active title.' : '');

  return (
    <Pressable
      onPress={() => onTap(node)}
      style={styles.nodeWrapper}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap for details"
    >
      {/* Dot */}
      <View style={styles.dotContainer}>
        <Animated.Text
          style={[
            styles.nodeDot,
            {
              fontSize: visual.size,
              color: visual.color,
            },
            visual.isAnimated && !reducedMotion && { opacity: pulseAnim },
          ]}
        >
          {visual.symbol}
        </Animated.Text>
      </View>

      {/* Connector line (not on last node) */}
      {!isLast && <View style={styles.connector} />}

      {/* Label below dot */}
      <View style={styles.nodeLabelWrapper}>
        <Text
          style={[
            styles.nodeLabel,
            { color: node.type === 'current' ? COLORS_DARK.fgBrand : COLORS_DARK.fgTextMuted },
          ]}
          numberOfLines={2}
        >
          {node.label}
        </Text>
        {node.geographyLabel && (
          <Text style={styles.nodeGeo} numberOfLines={1}>
            {node.geographyLabel}
          </Text>
        )}
        <Text style={styles.nodeDate}>{dateStr}</Text>
      </View>
    </Pressable>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const CrownJourneyTimeline: React.FC<CrownJourneyTimelineProps> = ({ nodes }) => {
  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  // Auto-scroll to end (present) on mount
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: !reducedMotion });
      }, 300);
    }
  }, [nodes.length, reducedMotion]);

  const onTap = useCallback((node: TimelineNode) => {
    setSelectedNode(node);
  }, []);

  // Empty state
  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        {/* Single dot representing start */}
        <View style={styles.emptyTimeline}>
          <Text style={styles.emptyDot}>●</Text>
          <View style={styles.emptyLine} />
          <Text style={styles.emptyArrow}>→</Text>
        </View>
        <View style={styles.emptyText}>
          <Text style={styles.emptyTitle}>Start your journey here</Text>
          <Text style={styles.emptyBody}>
            Win a cycle in any city, sector, or country
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={nodes}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.nodeId}
        renderItem={({ item, index }) => (
          <TimelineNodeItem
            node={item}
            isLast={index === nodes.length - 1}
            onTap={onTap}
            reducedMotion={reducedMotion}
          />
        )}
        accessibilityLabel="Crown Journey Timeline"
        accessible={false} // Individual nodes are accessible
      />

      {/* Detail sheet */}
      {selectedNode && (
        <NodeDetailSheet
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 120,
  },
  listContent: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 0,
  },

  // Node item
  nodeWrapper: {
    width: 80,
    alignItems: 'flex-start',
    flexDirection: 'column',
    minHeight: TOUCH_TARGET,
    position: 'relative',
  },
  dotContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    position: 'relative',
  },
  nodeDot: {
    lineHeight: 24,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
  connector: {
    position: 'absolute',
    top: 12,
    left: '50%',
    width: 80,
    height: 1,
    backgroundColor: COLORS_DARK.fgTextDisabled,
    opacity: 0.4,
  },
  nodeLabelWrapper: {
    width: 76,
    gap: 1,
    paddingTop: SPACING.xs,
  },
  nodeLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  nodeGeo: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS_DARK.fgTextDisabled,
    textAlign: 'center',
    lineHeight: 12,
  },
  nodeDate: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS_DARK.fgTextDisabled,
    textAlign: 'center',
    lineHeight: 12,
  },

  // Empty state
  emptyContainer: {
    height: 100,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  emptyTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  emptyDot: {
    fontSize: 12,
    color: COLORS_DARK.fgTextDisabled,
  },
  emptyLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS_DARK.fgTextDisabled,
    opacity: 0.3,
  },
  emptyArrow: {
    fontSize: 14,
    color: COLORS_DARK.fgTextDisabled,
  },
  emptyText: {
    gap: 2,
  },
  emptyTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextDisabled,
  },

  // Detail sheet
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS_DARK.bgElevated,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
    minHeight: 280,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS_DARK.borderSubtle,
    borderRadius: RADIUS.pill,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sheetTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS_DARK.fgTextStrong,
    flex: 1,
    lineHeight: 26,
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
  sheetDate: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sub,
    color: COLORS_DARK.fgTextMuted,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS_DARK.borderSubtle,
  },
  detailLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextMuted,
  },
  detailValue: {
    fontFamily: FONTS.numeric,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.fgTextStrong,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: COLORS_DARK.fgBrand,
    borderRadius: RADIUS.base,
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  doneBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS_DARK.bgSurface,
  },
});

export default React.memo(CrownJourneyTimeline);

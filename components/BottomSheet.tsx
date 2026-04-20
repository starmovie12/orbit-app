/**
 * ORBIT — BottomSheet
 *
 * Generic, reusable bottom sheet with:
 *  - 36×4px drag handle in --bg-surface-3 / borderStrong
 *  - Slide-up + fade animation (240ms, cubic ease-out)
 *  - Semi-transparent backdrop (rgba(0,0,0,0.5))
 *  - 24px top-corner radius
 *  - Safe-area aware bottom padding
 *
 * Usage:
 *   <BottomSheet visible={open} onClose={() => setOpen(false)} title="Filter">
 *     <YourContent />
 *   </BottomSheet>
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { orbit } from "@/constants/colors";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const SCREEN_HEIGHT = Dimensions.get("window").height;
const DRAG_THRESHOLD = 80; // px — dismiss if dragged this far down

/* ─── Types ─────────────────────────────────────────────────────────────── */
export interface BottomSheetProps {
  /** Controls sheet visibility */
  visible: boolean;
  /** Called when the user dismisses the sheet (backdrop tap or drag) */
  onClose: () => void;
  /** Optional title rendered in the sheet header (h3 weight) */
  title?: string;
  /** Sheet content */
  children?: React.ReactNode;
  /** Override the max height of the sheet (default: 90% of screen) */
  maxHeight?: number;
  /** Extra style for the sheet container */
  style?: ViewStyle;
  /**
   * If true, tapping the backdrop does NOT dismiss the sheet.
   * Useful for multi-step flows where accidental dismissal is bad.
   */
  preventBackdropDismiss?: boolean;
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = SCREEN_HEIGHT * 0.9,
  style,
  preventBackdropDismiss = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  /* Animation values */
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  /* Slide-up on show, slide-down on hide */
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, translateY]);

  /* Drag-to-dismiss via PanResponder */
  const dragStart = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = 0;
      },
      onPanResponderMove: (_, gestureState) => {
        const dy = Math.max(0, gestureState.dy); // only downward
        translateY.setValue(dy);
        dragStart.current = dy;
      },
      onPanResponderRelease: () => {
        if (dragStart.current > DRAG_THRESHOLD) {
          onClose();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      <TouchableWithoutFeedback
        onPress={preventBackdropDismiss ? undefined : onClose}
        accessible={false}
      >
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
      </TouchableWithoutFeedback>

      {/* ── Sheet ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY }] },
          style,
        ]}
        accessibilityViewIsModal
        accessibilityRole="dialog"
      >
        {/* Drag handle — always rendered, acts as the pan target */}
        <View
          {...panResponder.panHandlers}
          style={styles.handleArea}
          accessibilityRole="none"
          importantForAccessibility="no"
        >
          <View style={styles.handle} />
        </View>

        {/* Optional title */}
        {title != null && title.length > 0 && (
          <View style={styles.titleRow}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

/* ─── Close button helper (optional, import + use inside sheet content) ── */
export function SheetCloseButton({
  onPress,
  label = "Done",
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.closeBtn,
        pressed && styles.closeBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.closeBtnText}>{label}</Text>
    </Pressable>
  );
}

/* ─── Easing helper (approximates cubic-bezier(0.16, 1, 0.3, 1)) ────────── */
function EASE_OUT(t: number): number {
  // Approximation of the design system ease-out curve
  return 1 - Math.pow(1 - t, 3);
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: orbit.surface3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Elevation for Android floating surface
    ...Platform.select({
      android: { elevation: 24 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
    }),
  },

  handleArea: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: "center",
    // Generous tap area even though the visual handle is small
    minHeight: 32,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: orbit.borderStrong,
  },

  titleRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: orbit.borderSubtle,
  },

  titleText: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    color: orbit.textPrimary,
    letterSpacing: 0,
  },

  content: {
    flex: 1,
  },

  closeBtn: {
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 4,
    borderRadius: 12,
    backgroundColor: orbit.accent,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  closeBtnPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: orbit.accentHover,
  },

  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: orbit.textInverse,
  },
});

/* ─── Storybook-style usage examples (for reference only) ───────────────────
 *
 * // Basic usage
 * const [open, setOpen] = useState(false);
 *
 * <Button onPress={() => setOpen(true)} title="Open Sheet" />
 *
 * <BottomSheet visible={open} onClose={() => setOpen(false)} title="Filter Rooms">
 *   <ScrollView style={{ padding: 20 }}>
 *     <Text>Content here</Text>
 *   </ScrollView>
 *   <SheetCloseButton onPress={() => setOpen(false)} />
 * </BottomSheet>
 *
 * // No title, custom max height
 * <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight={400}>
 *   <View style={{ padding: 20 }}>
 *     <Text>Compact sheet</Text>
 *   </View>
 * </BottomSheet>
 *
 * // Prevent accidental dismiss (OTP flow)
 * <BottomSheet
 *   visible={open}
 *   onClose={() => setOpen(false)}
 *   preventBackdropDismiss
 *   title="Verify your number"
 * >
 *   <OTPForm />
 * </BottomSheet>
 *
 ─────────────────────────────────────────────────────────────────────────── */

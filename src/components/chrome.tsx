/** App chrome: neo-brutalist header, floating tab dock, bottom sheet, toasts, confirm. */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, border, radii, space, type, layout, elevation } from '../theme/tokens';
import { Icon, glyphs, type IconName } from './Icon';
import { haptic, useUIStore } from '../state/ui';
import { useSettingsStore } from '../state/settings';

export function useSafeTopInset(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

/* --------------------------------- Sub header ------------------------------ */

export function SubHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return (
    <View style={{ paddingTop: insets.top + space.xs, paddingHorizontal: space.screenEdge, paddingBottom: space.md, backgroundColor: colors.surface, ...elevation.header }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 }}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => {
                haptic('light');
                onBack();
              }}
              style={styles.backBtn}
            >
              <Icon name={glyphs.back} size={22} color={colors.charcoal} />
            </Pressable>
          ) : null}
          <Text numberOfLines={1} style={{ ...type.headlineLg, color: colors.charcoal, flex: 1 }}>{title}</Text>
        </View>
        {right}
      </View>
    </View>
  );
}

/* ------------------------------- Tab dock ---------------------------------- */

export interface TabDef {
  name: string;
  label: string;
  icon: IconName;
}

export function FloatingTabDock({
  tabs,
  activeName,
  onSelect,
}: {
  tabs: TabDef[];
  activeName: string;
  onSelect: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion);
  const [trackW, setTrackW] = useState(0);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.name === activeName));
  const itemW = trackW > 0 ? trackW / tabs.length : 0;
  const slide = useRef(new Animated.Value(0)).current;

  // Capsule slides to the active tab on the UI thread; snaps under Reduce Motion.
  useEffect(() => {
    const to = activeIndex * itemW;
    if (reducedMotion || itemW === 0) {
      slide.setValue(to);
      return;
    }
    Animated.spring(slide, {
      toValue: to,
      useNativeDriver: true,
      stiffness: 220,
      damping: 26,
      mass: 0.9,
    }).start();
  }, [activeIndex, itemW, reducedMotion, slide]);

  return (
    <View style={[styles.dockWrap, { bottom: insets.bottom + space.sm }]} pointerEvents="box-none">
      <View style={styles.dock}>
        <View style={styles.dockTrack} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
          {itemW > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.dockCapsule, { width: itemW, transform: [{ translateX: slide }] }]}
            />
          ) : null}
          {tabs.map((tab) => {
            const active = tab.name === activeName;
            return (
              <Pressable
                key={tab.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
                onPress={() => {
                  if (!active) haptic('light');
                  onSelect(tab.name);
                }}
                style={styles.dockItem}
              >
                <Icon name={tab.icon} size={20} color={active ? colors.charcoal : colors.inkVariant} />
                <Text numberOfLines={1} style={[styles.dockLabel, active && styles.dockLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------- Bottom sheet ------------------------------ */

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(600)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion);

  useEffect(() => {
    const slideDuration = reducedMotion ? 0 : 220;
    const fadeDuration = reducedMotion ? 120 : 200;
    if (visible) {
      if (reducedMotion) {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(backdrop, { toValue: 1, duration: fadeDuration, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...{ stiffness: 100, damping: 20 } }),
          Animated.timing(backdrop, { toValue: 1, duration: fadeDuration, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]).start();
      }
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 600, duration: slideDuration, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(backdrop, { toValue: 0, duration: fadeDuration, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdrop, reducedMotion]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.sheetBackdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.sheetGrabber} />
        {title ? <Text style={{ ...type.headlineMd, color: colors.charcoal, marginBottom: space.md }}>{title}</Text> : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

/* ---------------------------------- Toasts --------------------------------- */

export function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const confirm = useUIStore((s) => s.confirm);
  const clearConfirm = useUIStore((s) => s.clearConfirm);
  return (
    <>
      <View pointerEvents="none" style={styles.toastHost}>
        {toasts.map((t) => {
          const tone =
            t.tone === 'error'
              ? { bg: colors.errorContainer, fg: colors.onErrorContainer }
              : t.tone === 'success'
                ? { bg: colors.primaryContainer, fg: colors.charcoal }
                : { bg: colors.inverseSurface, fg: colors.inverseOnSurface };
          return (
            <View key={t.id} style={[styles.toast, { backgroundColor: tone.bg }]}>
              <Text style={{ ...type.labelLg, color: tone.fg }} numberOfLines={2}>
                {t.message}
              </Text>
            </View>
          );
        })}
      </View>
      <Modal transparent visible={!!confirm} onRequestClose={clearConfirm} statusBarTranslucent>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={{ ...type.headlineSm, color: colors.charcoal }}>{confirm?.title}</Text>
            <Text style={{ ...type.bodyMd, color: colors.inkVariant, marginTop: space.xs }}>{confirm?.message}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.lg }}>
              <Pressable onPress={clearConfirm} style={styles.confirmGhost} accessibilityRole="button">
                <Text style={{ ...type.labelLg, color: colors.charcoal }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const action = confirm?.onConfirm;
                  clearConfirm();
                  action?.();
                }}
                style={[styles.confirmAction, confirm?.destructive && { backgroundColor: colors.error }]}
              >
                <Text style={{ ...type.labelLg, color: confirm?.destructive ? '#FFFFFF' : colors.charcoal }}>{confirm?.confirmLabel ?? 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* --------------------------------- Section --------------------------------- */

export function SectionCapsule({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs }}>
      <Text style={{ ...type.labelCaps, color: colors.charcoal, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {children}
      </Text>
      <View style={{ height: border.width, backgroundColor: colors.charcoal, flex: 1, opacity: 0.15 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radii.md,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: space.screenEdge,
  },
  dock: {
    width: '100%',
    maxWidth: layout.maxWidth - space.screenEdge * 2,
    height: space.dockHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.dock,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: space['2xs'],
  },
  dockTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  dockCapsule: {
    position: 'absolute',
    left: 0,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  dockItem: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 2,
  },
  dockLabel: {
    ...type.labelCaps,
    fontSize: 10,
    color: colors.inkVariant,
    letterSpacing: 0.1,
    textTransform: 'none',
  },
  dockLabelActive: {
    color: colors.charcoal,
  },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderWidth: border.width,
    borderBottomWidth: 0,
    borderColor: border.color,
    padding: space.cardPadding,
    paddingBottom: space['3xl'],
    maxHeight: '88%',
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.charcoal,
    opacity: 0.2,
    marginBottom: space.md,
  },
  toastHost: {
    position: 'absolute',
    bottom: space.dockHeight + 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    gap: space.xs,
  },
  toast: {
    borderRadius: radii.pill,
    borderWidth: border.width,
    borderColor: border.color,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    maxWidth: '86%',
    ...elevation.card,
  },
  confirmBackdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  confirmCard: {
    width: '100%',
    maxWidth: layout.maxWidth,
    backgroundColor: colors.card,
    borderRadius: radii['2xl'],
    borderWidth: border.width,
    borderColor: border.color,
    padding: space.cardPadding,
    ...elevation.modal,
  },
  confirmGhost: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  confirmAction: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.badge,
  },
});

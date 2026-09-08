/**
 * Loomi's own on/off toggle: a knob that slides between ends while the track
 * cross-fades colour. Uses the same RN `Animated` approach as FadeSlideIn
 * (no extra animation library) so timing stays consistent with the rest of
 * the app. Colour interpolation forces the JS driver, which is fine for a
 * one-shot ~150ms transition with no gesture attached.
 *
 * - fixed dimensions => no layout jump when it flips
 * - respects the "Reduce motion" setting (snaps instead of animating)
 * - selection haptic on change when haptics are enabled
 * - accessibilityRole="switch" so it reads correctly to screen readers
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { border, colors, motion } from '../theme/tokens';
import { useSettingsStore } from '../state/settings';

const TRACK_W = 48;
const TRACK_H = 28;
const PAD = 3;
const KNOB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - PAD * 2 - KNOB;

export function AnimatedToggle({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion);
  const hapticsEnabled = useSettingsStore((s) => s.settings.hapticsEnabled);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: motion.fast,
      useNativeDriver: false,
    }).start();
  }, [value, reducedMotion, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outlineVariant, colors.primary],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        if (hapticsEnabled) void Haptics.selectionAsync().catch(() => undefined);
        onValueChange(!value);
      }}
    >
      <Animated.View style={[styles.track, { backgroundColor, opacity: disabled ? 0.45 : 1 }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    borderWidth: border.widthThin,
    borderColor: border.color,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
});

/**
 * Full-screen image viewer. Opened from anywhere an image is shown small
 * (chat, memories, journal, profile). The whole point is that nothing is
 * cropped here: `contentFit="contain"` shows the entire frame at its real
 * aspect ratio. Double-tap or pinch to zoom, drag to pan while zoomed, tap
 * the backdrop or the ✕ to close.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Icon } from './Icon';
import { colors } from '../theme/tokens';

const MAX_SCALE = 4;

export function ImageViewer({
  uri,
  visible,
  onClose,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1) runOnJS(onClose)();
    });

  const composed = Gesture.Exclusive(
    doubleTap,
    Gesture.Simultaneous(pinch, pan),
    singleTap
  );

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image"
          style={[styles.closeBtn, { top: insets.top + 8 }]}
        >
          <Icon name="close" size={22} color="#fff" />
        </Pressable>

        {loading && !failed ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" /> : null}
        {failed ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Couldn&apos;t load this image.</Text>
            <Pressable
              onPress={() => {
                setFailed(false);
                setLoading(true);
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {uri && !failed ? (
          <GestureDetector gesture={composed}>
            <Animated.View style={styles.imgWrap}>
              <Animated.View style={[styles.imgWrap, imgStyle]}>
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setFailed(true);
                  }}
                  transition={120}
                />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  imgWrap: { flex: 1, width: '100%' },
  closeBtn: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: '#fff', fontSize: 15 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.primary },
  retryText: { color: colors.charcoal, fontWeight: '700' },
});

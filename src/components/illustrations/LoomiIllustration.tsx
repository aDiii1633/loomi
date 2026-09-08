/**
 * LoomiIllustration — the one place screens render Pao & Ly artwork.
 *
 * STATIC ONLY for this phase (no Lottie/Reanimated/GIF/video/frame
 * animation). The `variant` prop exists so a later pass can swap the
 * internal rendering (e.g. an animated Lottie/Reanimated version) without
 * touching a single call site — every screen just keeps passing `asset`.
 */
import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { ILLUSTRATIONS, type IllustrationKey } from './registry';
import { border, radii } from '../../theme/tokens';

export interface LoomiIllustrationProps {
  asset: IllustrationKey;
  /** Rendered width in dp; height is derived from the asset's own aspect
   * ratio unless `height` is also given. */
  size?: number;
  width?: number;
  height?: number;
  /** 'static' (default) is the only implemented variant today. */
  variant?: 'static';
  accessibilityLabel?: string;
  resizeMode?: 'cover' | 'contain';
  /** Adds the neo-brutalist card treatment (border + radius). Off by
   * default — most placements sit directly on the screen background per
   * "don't put every illustration inside a giant white card". */
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LoomiIllustration({
  asset,
  size,
  width,
  height,
  accessibilityLabel,
  resizeMode = 'contain',
  framed = false,
  style,
}: LoomiIllustrationProps) {
  const entry = ILLUSTRATIONS[asset];
  const resolvedWidth = width ?? size ?? 160;
  const resolvedHeight = height ?? size ?? Math.round(resolvedWidth / entry.aspectRatio);

  return (
    <View
      style={[
        { width: resolvedWidth, height: resolvedHeight, overflow: 'hidden' },
        framed && {
          borderRadius: radii.xl,
          borderWidth: border.width,
          borderColor: border.color,
        },
        style,
      ]}
    >
      <Image
        source={entry.source}
        accessibilityLabel={accessibilityLabel ?? entry.defaultLabel}
        accessible
        resizeMode={resizeMode}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

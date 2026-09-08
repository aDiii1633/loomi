/**
 * One place that turns a stored `avatar` value into the right visual:
 *   - "loomi://illustration/<key>"  -> a Pao & Ly illustration in a circle
 *   - "http(s)://..."               -> the uploaded photo
 *   - anything else / empty          -> the name's initial (existing Avatar)
 *
 * Used for both the signed-in user and their partner, so whatever one person
 * picks is exactly what the other sees.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar } from './primitives';
import { LoomiIllustration } from './illustrations/LoomiIllustration';
import type { IllustrationKey } from './illustrations/registry';
import { border, colors } from '../theme/tokens';

export const ILLUSTRATION_AVATAR_PREFIX = 'loomi://illustration/';

export function makeIllustrationAvatar(key: IllustrationKey): string {
  return `${ILLUSTRATION_AVATAR_PREFIX}${key}`;
}

export function AvatarView({
  name,
  avatar,
  size = 40,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  if (avatar && avatar.startsWith(ILLUSTRATION_AVATAR_PREFIX)) {
    const key = avatar.slice(ILLUSTRATION_AVATAR_PREFIX.length) as IllustrationKey;
    return (
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <LoomiIllustration asset={key} size={size} />
      </View>
    );
  }
  if (avatar && /^https?:\/\//.test(avatar)) {
    return (
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image source={{ uri: avatar }} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  }
  return <Avatar name={name} size={size} />;
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
});

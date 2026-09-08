/**
 * Shown in place of a feature screen while the user has no partner linked.
 * They can still navigate here and see what's coming — it's just locked.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from './primitives';
import { LoomiIllustration } from './illustrations/LoomiIllustration';
import { Icon } from './Icon';
import { border, colors, space, type } from '../theme/tokens';
import { useSafeTopInset } from './chrome';

export function LockedScreen({ feature }: { feature: string }) {
  const router = useRouter();
  const topInset = useSafeTopInset(space.lg);
  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.badge}>
        <Icon name="lock" size={20} color={colors.charcoal} />
      </View>
      <LoomiIllustration asset="welcome-holding-hands" size={150} />
      <Text style={styles.title}>{feature} is locked</Text>
      <Text style={styles.body}>
        Connect with your partner to unlock {feature.toLowerCase()} — and everything else in Loomi.
      </Text>
      <Button
        label="Connect with your partner"
        icon="heart"
        onPress={() => router.navigate('/(tabs)')}
        style={{ marginTop: space.xl, alignSelf: 'stretch' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.screenEdge,
    gap: space.xs,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tertiaryFixed,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  title: { ...type.headlineMd, color: colors.charcoal, marginTop: space.md, textAlign: 'center' },
  body: {
    ...type.bodyMd,
    color: colors.inkVariant,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
});

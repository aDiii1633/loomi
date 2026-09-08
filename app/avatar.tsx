/**
 * AVATAR — full page (not a popup). Pick a Pao & Ly illustration, or upload a
 * photo. Whichever is chosen is written to public.users.avatar_url so the
 * partner's app renders the same thing, and it survives an app restart
 * because it lives on the server, not just in local state.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { SubHeader } from '../src/components/chrome';
import { Button, Card } from '../src/components/primitives';
import { AvatarView, makeIllustrationAvatar } from '../src/components/AvatarView';
import { LoomiIllustration } from '../src/components/illustrations/LoomiIllustration';
import type { IllustrationKey } from '../src/components/illustrations/registry';
import { Icon } from '../src/components/Icon';
import { toast } from '../src/components/toast';
import { setMyAvatar } from '../src/data/backend/profile';
import { useSessionStore } from '../src/state/session';
import { border, colors, radii, space, type } from '../src/theme/tokens';

const AVATAR_ILLUSTRATIONS: IllustrationKey[] = [
  'welcome-holding-hands',
  'streak-fist-bump',
  'chat-sitting-together',
  'mood-thinking-together',
  'celebrate-jumping',
  'games-video-game',
  'location-walking',
  'anniversary-celebrate',
];

export default function AvatarScreen() {
  const router = useRouter();
  const { user } = useUser();
  const self = useSessionStore((s) => s.self);
  const refreshCouple = useSessionStore((s) => s.refreshCouple);
  const [busy, setBusy] = useState<null | 'photo' | 'illustration' | 'clear'>(null);

  const current = self?.avatar ?? null;

  const persist = async (value: string | null) => {
    if (!self?.id) {
      toast('Sign in to change your avatar.', 'error');
      return;
    }
    await setMyAvatar(self.id, value);
    await refreshCouple().catch(() => undefined);
  };

  const chooseIllustration = async (key: IllustrationKey) => {
    setBusy('illustration');
    try {
      await persist(makeIllustrationAvatar(key));
      toast('Avatar updated', 'success');
    } catch {
      toast('Could not save that. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const choosePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Photo permission is needed to pick a picture.', 'error');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setBusy('photo');
    try {
      // Clerk hosts the image; we mirror the resulting URL into users.avatar_url.
      const file = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      const updated = await user?.setProfileImage({ file });
      const url = updated?.publicUrl ?? user?.imageUrl ?? null;
      if (!url) throw new Error('no url');
      await persist(url);
      toast('Photo updated', 'success');
    } catch {
      toast('Photo upload failed. Check your connection and try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    setBusy('clear');
    try {
      await persist(null);
      toast('Back to your initials', 'success');
    } catch {
      toast('Could not update. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Your avatar" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padding="default" style={{ alignItems: 'center' }}>
          <AvatarView name={self?.name ?? 'You'} avatar={current} size={96} />
          <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: space.sm }}>
            {current ? 'This is what your partner sees.' : 'Right now your partner sees your initial.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button
              label={busy === 'photo' ? 'Uploading…' : 'Use a photo'}
              variant="secondary"
              icon="camera"
              onPress={choosePhoto}
              loading={busy === 'photo'}
            />
            {current ? (
              <Button label="Remove" variant="ghost" onPress={clear} loading={busy === 'clear'} />
            ) : null}
          </View>
        </Card>

        <Text style={styles.sectionLabel}>Pao &amp; Ly</Text>
        <View style={styles.grid}>
          {AVATAR_ILLUSTRATIONS.map((key) => {
            const value = makeIllustrationAvatar(key);
            const selected = current === value;
            return (
              <Pressable
                key={key}
                onPress={() => chooseIllustration(key)}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.cell, selected && styles.cellOn]}
              >
                <LoomiIllustration asset={key} size={72} />
                {selected ? (
                  <View style={styles.check}>
                    <Icon name="check" size={14} color={colors.charcoal} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {busy === 'illustration' ? <ActivityIndicator style={{ marginTop: space.md }} /> : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  sectionLabel: { ...type.labelCaps, color: colors.inkVariant, marginTop: space.lg, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellOn: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** PRIVATE VAULT — PIN/biometric gate + protected content. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { SubHeader, BottomSheet } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, Input } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { border, colors, elevation, radii, space, type } from '../src/theme/tokens';
import { useVaultStore } from '../src/state/life';
import { getMediaMany } from '../src/data/media';
import { pickMedia, type PickedMedia } from '../src/components/mediaPicker';
import { validateText, validatePin } from '../src/domain/validation';
import * as vaultRepo from '../src/data/repositories/vault';
import { toast } from '../src/components/toast';
import { haptic, useUIStore } from '../src/state/ui';
import { formatFriendlyLong } from '../src/domain/datetime';
import { Mascot } from '../src/components/illustrations/Mascot';

type Gate = 'checking' | 'locked' | 'setup' | 'unlocked';

export default function VaultScreen() {
  const router = useRouter();
  const { items, refresh, addItem, remove } = useVaultStore();
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [gate, setGate] = useState<Gate>('checking');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const configured = await vaultRepo.isVaultConfigured();
      const bio = await vaultRepo.biometricsAvailable();
      setBiometricAvailable(bio);
      setGate(configured ? 'locked' : 'setup');
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (gate === 'unlocked') refresh();
    }, [gate, refresh])
  );

  const setupVault = async () => {
    const v = validatePin(pin);
    if (!v.ok) return setPinError(v.message);
    if (pin !== confirmPin) return setPinError('The two PINs do not match.');
    await vaultRepo.configureVault(pin);
    setPin('');
    setConfirmPin('');
    setPinError(null);
    setGate('unlocked');
    haptic('success');
    toast('Vault ready. Only your PIN opens it.', 'success');
  };

  const unlockWithPin = async () => {
    const ok = await vaultRepo.verifyPin(pin);
    if (!ok) {
      setAttempts((a) => a + 1);
      setPinError(attempts >= 2 ? 'Hint: it is written nowhere. Think.' : 'That PIN is not it.');
      setPin('');
      haptic('warning');
      return;
    }
    setPin('');
    setPinError(null);
    setAttempts(0);
    setGate('unlocked');
    haptic('success');
  };

  const unlockWithBiometrics = async () => {
    const ok = await vaultRepo.unlockWithBiometrics();
    if (ok) {
      setGate('unlocked');
      haptic('success');
    } else {
      toast('Biometric unlock failed.', 'error');
    }
  };

  const addToVault = async () => {
    const v = validateText(title, 'memoryTitle', { fieldName: 'Title' });
    if (!v.ok) return setTitleError(v.message);
    if (media.length === 0) return toast('Add at least one photo or video.', 'error');
    await addItem({ title, note, mediaUris: media });
    setTitle('');
    setNote('');
    setMedia([]);
    setTitleError(null);
    setSheetOpen(false);
    toast('Locked in the vault', 'success');
  };

  /* --------------------------------- gates --------------------------------- */

  if (gate === 'checking') {
    return (
      <View style={styles.root}>
        <SubHeader title="Private Vault" onBack={() => router.back()} />
        <Card padding="default"><Text style={{ ...type.bodyMd, color: colors.inkVariant }}>Checking the locks…</Text></Card>
      </View>
    );
  }

  if (gate === 'setup' || gate === 'locked') {
    const isSetup = gate === 'setup';
    return (
      <View style={styles.root}>
        <SubHeader title="Private Vault" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.lockHero}>
            <View style={styles.lockIconWrap}>
              <Mascot variant="ly" mood="sleepy" size={76} />
              <View style={styles.lockBadge}>
                <Icon name={isSetup ? 'key' : 'lock'} size={16} color={colors.card} />
              </View>
            </View>
            <Text style={{ ...type.headlineMd, color: colors.card, marginTop: space.md }}>
              {isSetup ? 'Create your vault' : 'A private space, kept private'}
            </Text>
            <Text style={{ ...type.bodySm, color: colors.card, opacity: 0.9, textAlign: 'center', marginTop: space.xs }}>
              {isSetup
                ? 'Choose a PIN only you know. It guards everything inside.'
                : 'Photos and notes here stay behind your PIN — on this device.'}
            </Text>
          </View>

          <Card padding="default" style={{ marginTop: space.xl }}>
            <Input
              label={isSetup ? 'New PIN (4–8 digits)' : 'Your PIN'}
              value={pin}
              onChangeText={(t) => {
                setPin(t.replace(/[^0-9]/g, '').slice(0, 8));
                setPinError(null);
              }}
              placeholder="••••"
              secureTextEntry
              keyboardType="number-pad"
              error={pinError ?? undefined}
            />
            {isSetup ? (
              <Input
                label="Confirm PIN"
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="••••"
                secureTextEntry
                keyboardType="number-pad"
              />
            ) : null}
            <Button label={isSetup ? 'Create vault' : 'Unlock'} onPress={isSetup ? setupVault : unlockWithPin} />
            {!isSetup && biometricAvailable ? (
              <View style={{ marginTop: space.md }}>
                <Button label="Unlock with biometrics" variant="secondary" icon="fingerprint" onPress={unlockWithBiometrics} />
              </View>
            ) : null}
            {!isSetup && attempts >= 3 ? (
              <Text style={{ ...type.bodySm, color: colors.error, textAlign: 'center', marginTop: space.md }}>
                Too many tries. The vault does not hint — by design.
              </Text>
            ) : null}
          </Card>
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    );
  }

  /* -------------------------------- unlocked -------------------------------- */

  return (
    <View style={styles.root}>
      <SubHeader
        title="Private Vault"
        onBack={() => router.back()}
        right={
          <View style={styles.unlockedBadge}>
            <Icon name="unlock" size={14} color={colors.primary} />
            <Text style={{ ...type.labelMd, color: colors.primary }}>Unlocked</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>For your eyes only</Text>
            <Text style={styles.sub}>{items.length} protected {items.length === 1 ? 'item' : 'items'}</Text>
          </View>
        </View>

        <View style={{ marginTop: space.lg, gap: space.md }}>
          {items.length === 0 ? (
            <Card>
              <EmptyState
                icon="lock"
                illustration="vault-glowing"
                title="Nothing inside yet"
                message="Add photos or notes you want behind the PIN."
                actionLabel="Add to vault"
                onAction={() => setSheetOpen(true)}
              />
            </Card>
          ) : (
            items.map((item) => (
              <Card key={item.id} padding="compact">
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.labelLg, color: colors.charcoal }}>{item.title}</Text>
                    <Text style={{ ...type.labelCaps, color: colors.tertiary }}>
                      {formatFriendlyLong(item.createdAt)}
                    </Text>
                    {item.note ? <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: 2 }}>{item.note}</Text> : null}
                  </View>
                  <Icon name="lock" size={16} color={colors.primary} />
                  <Button
                    label=""
                    variant="ghost"
                    onPress={() =>
                      askConfirm({
                        title: 'Remove from vault?',
                        message: `“${item.title}” and its media will be deleted.`,
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: () => remove(item.id),
                      })
                    }
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  {item.mediaIds.slice(0, 4).map((id) => (
                    <VaultThumb key={id} mediaId={id} />
                  ))}
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={{ marginTop: space.lg }}>
          <Button label="Add to vault" icon="plus" onPress={() => setSheetOpen(true)} />
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add to vault">
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Just ours" error={titleError ?? undefined} />
        <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="Why this matters…" multiline />
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Chip
            label={media.length ? `${media.length} selected` : 'Pick photos'}
            icon="image"
            active={media.length > 0}
            onPress={async () => setMedia(await pickMedia({ allowsMultiple: true }))}
          />
        </View>
        <Button label="Lock it in" onPress={addToVault} />
      </BottomSheet>
    </View>
  );
}

function VaultThumb({ mediaId }: { mediaId: string }) {
  const [uri, setUri] = useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    getMediaMany([mediaId]).then((m) => {
      if (!cancelled && m[0]) setUri(m[0].uri);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);
  if (!uri) return <View style={styles.thumb} />;
  return <Image source={{ uri }} style={styles.thumb} contentFit="cover" transition={150} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  lockHero: {
    alignItems: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    backgroundColor: colors.tertiaryContainer,
    borderRadius: radii.xl,
    marginTop: space.md,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  lockIconWrap: { alignItems: 'center', justifyContent: 'center' },
  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  h1: { ...type.headlineLg, color: colors.charcoal },
  sub: { ...type.bodySm, color: colors.inkVariant, marginTop: 2 },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.lightMint },
});

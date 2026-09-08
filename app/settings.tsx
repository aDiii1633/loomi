/** SETTINGS — notifications, haptics, privacy, vault security, data, about. */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SubHeader, BottomSheet } from '../src/components/chrome';
import { Button, Card, Input } from '../src/components/primitives';
import { AnimatedToggle } from '../src/components/AnimatedToggle';
import { Icon } from '../src/components/Icon';
import { border, colors, elevation, space, type } from '../src/theme/tokens';
import { useSettingsStore } from '../src/state/settings';
import { useUIStore } from '../src/state/ui';
import * as vaultRepo from '../src/data/repositories/vault';
import { resetDemoData } from '../src/dev/bootstrap';
import { listNotifications, markAllRead } from '../src/data/repositories/notifications';
import { formatFriendlyDateTime } from '../src/domain/datetime';
import { validatePin } from '../src/domain/validation';
import type { AppNotification } from '../src/domain/types';
import { deviceName } from '../src/dev/devIdentity';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, update } = useSettingsStore();
  const toast = useUIStore((s) => s.toast);
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [pinSheet, setPinSheet] = useState<'none' | 'change'>('none');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setVaultConfigured(await vaultRepo.isVaultConfigured());
      setBioEnabled(await vaultRepo.biometricsAvailable());
      setNotifications(await listNotifications(20));
    })();
  }, []);

  const Row = ({
    icon,
    label,
    hint,
    value,
    onToggle,
  }: {
    icon: string;
    label: string;
    hint?: string;
    value?: boolean;
    onToggle?: (v: boolean) => void;
  }) => (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon as never} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.labelLg, color: colors.charcoal }}>{label}</Text>
        {hint ? <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{hint}</Text> : null}
      </View>
      {onToggle ? <AnimatedToggle value={!!value} onValueChange={onToggle} /> : null}
    </View>
  );

  const changePin = async () => {
    const v = validatePin(newPin);
    if (!v.ok) return setPinError(v.message);
    const ok = await vaultRepo.changePin(currentPin, newPin);
    if (!ok) {
      setPinError('Current PIN is not right.');
      return;
    }
    setPinSheet('none');
    setCurrentPin('');
    setNewPin('');
    setPinError(null);
    toast('PIN updated', 'success');
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>NOTIFICATIONS</Text>
        <Card padding="compact">
          <Row icon="bell" label="In-app notifications" value={settings.notificationsEnabled} onToggle={(v) => update('notificationsEnabled', v)} />
          <Row icon="sun" label="Daily question reminder" hint="A gentle nudge each morning" value={settings.dailyQuestionReminder} onToggle={(v) => update('dailyQuestionReminder', v)} />
        </Card>

        <Text style={styles.section}>FEEL</Text>
        <Card padding="compact">
          <Row icon="zap" label="Haptics" hint="Subtle taps on actions" value={settings.hapticsEnabled} onToggle={(v) => update('hapticsEnabled', v)} />
          <Row icon="moon" label="Reduce motion" hint="Calmer transitions" value={settings.reducedMotion} onToggle={(v) => update('reducedMotion', v)} />
        </Card>

        <Text style={styles.section}>PRIVACY & SECURITY</Text>
        <Card padding="compact">
          <Row icon="map-pin" label="Location sharing" hint="Opt-in, foreground only" value={settings.locationSharing} onToggle={(v) => update('locationSharing', v)} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="lock" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Vault PIN</Text>
              <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                {vaultConfigured ? 'Configured on this device' : 'Not set up yet'}
              </Text>
            </View>
            {vaultConfigured ? (
              <Button label="Change" variant="secondary" onPress={() => setPinSheet('change')} />
            ) : (
              <Button label="Set up" variant="secondary" onPress={() => router.push('/vault')} />
            )}
          </View>
          {vaultConfigured && bioEnabled ? (
            <Row
              icon="fingerprint"
              label="Biometric unlock"
              hint="Face or fingerprint for the vault"
              value={bioEnabled}
              onToggle={async (v) => {
                await vaultRepo.setBiometricEnabled(v);
                setBioEnabled(v);
              }}
            />
          ) : null}
        </Card>

        <Text style={styles.section}>ACTIVITY</Text>
        <Card padding="compact">
          {notifications.length === 0 ? (
            <Text style={{ ...type.bodySm, color: colors.inkVariant, paddingVertical: space.sm }}>
              Nothing yet — activity lands here.
            </Text>
          ) : (
            notifications.slice(0, 6).map((n, i) => (
              <View key={n.id} style={[styles.row, i > 0 && { borderTopWidth: border.widthThin, borderTopColor: border.color }]}>
                <View style={[styles.rowIcon, !n.read && { backgroundColor: colors.primaryContainer }]}>
                  <Icon name="bell" size={14} color={n.read ? colors.primary : colors.charcoal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.labelMd, color: colors.charcoal }}>{n.title}</Text>
                  <Text numberOfLines={1} style={{ ...type.bodySm, color: colors.inkVariant }}>{n.body}</Text>
                  <Text style={{ ...type.labelCaps, color: colors.tertiary, marginTop: 2 }}>
                    {formatFriendlyDateTime(n.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
          {notifications.length > 0 ? (
            <View style={{ marginTop: space.sm }}>
              <Button label="Mark all as read" variant="ghost" onPress={() => markAllRead().then(() => listNotifications(20).then(setNotifications))} />
            </View>
          ) : null}
        </Card>

        <Text style={styles.section}>DATA (DEVELOPMENT)</Text>
        <Card padding="compact">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="info" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Device</Text>
              <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{deviceName()}</Text>
            </View>
          </View>
          <View style={{ marginTop: space.sm }}>
            <Button
              label="Reset demo data"
              variant="ghost"
              icon="refresh-cw"
              onPress={() =>
                askConfirm({
                  title: 'Reset demo data?',
                  message: 'Everything you added will be wiped and the demo story re-seeded.',
                  confirmLabel: 'Reset',
                  destructive: true,
                  onConfirm: () => {
                    resetDemoData()
                      .then(() => toast('Demo data reset', 'success'))
                      .catch(() => toast('Reset failed', 'error'));
                  },
                })
              }
            />
          </View>
        </Card>

        <Text style={styles.section}>ABOUT</Text>
        <Card padding="compact">
          <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
            Loomi v0.1.0 — a private digital world for two. Sign-in is real; couple linking and cloud sync are
            still rolling out. Local development data stays clearly marked and isolated.
          </Text>
        </Card>
        <View style={{ height: 80 }} />
      </ScrollView>

      <BottomSheet visible={pinSheet === 'change'} onClose={() => setPinSheet('none')} title="Change vault PIN">
        <Input label="Current PIN" value={currentPin} onChangeText={(t) => { setCurrentPin(t.replace(/[^0-9]/g, '').slice(0, 8)); setPinError(null); }} secureTextEntry keyboardType="number-pad" error={pinError ?? undefined} />
        <Input label="New PIN" value={newPin} onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, '').slice(0, 8))} secureTextEntry keyboardType="number-pad" />
        <Button label="Update PIN" onPress={changePin} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 80 },
  section: { ...type.labelCaps, color: colors.inkVariant, letterSpacing: 1.2, marginTop: space.lg, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightMint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
});

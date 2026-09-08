/** LOCATION — explicit opt-in sharing with permission states + partner snapshot. */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SubHeader } from '../src/components/chrome';
import { Button, Card } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { LoomiIllustration } from '../src/components/illustrations/LoomiIllustration';
import { border, colors, elevation, radii, space, type } from '../src/theme/tokens';
import { useLocationStore } from '../src/state/settings';
import { useSessionStore } from '../src/state/session';

export default function LocationScreen() {
  const router = useRouter();
  const partner = useSessionStore((s) => s.partner);
  const { state, permission, loading, refresh, requestPermission, setSharing, updateOwnLocation } = useLocationStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.root}>
      <SubHeader title="Location" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Consent explainer */}
        <Card padding="default">
          <LoomiIllustration asset="location-walking" size={132} style={{ alignSelf: 'center' }} />
          <Text style={{ ...type.headlineSm, color: colors.charcoal, textAlign: 'center', marginTop: space.md }}>
            Sharing is always opt-in
          </Text>
          <Text style={{ ...type.bodySm, color: colors.inkVariant, textAlign: 'center', marginTop: space.xs }}>
            Loomi never tracks in the background. When sharing is on, you choose when your last known spot is
            refreshed — and you can turn it off in one tap.
          </Text>
        </Card>

        {/* Permission state */}
        <Card padding="compact" style={{ marginTop: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name={permission === 'granted' ? 'check' : permission === 'denied' ? 'x' : 'info'} size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Device permission: {permission.replace('_', ' ')}</Text>
              <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                {permission === 'granted'
                  ? 'Location can be used when sharing is on.'
                  : permission === 'denied'
                    ? 'Denied — enable it from system Settings if you change your mind.'
                    : 'We will ask only when you turn sharing on.'}
              </Text>
            </View>
            {permission !== 'granted' ? (
              <Button label="Allow" variant="secondary" onPress={requestPermission} />
            ) : null}
          </View>
        </Card>

        {/* Sharing toggle */}
        <Card padding="compact" style={{ marginTop: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Share with {partner?.name ?? 'partner'}</Text>
              <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                {state.sharingEnabled ? 'On — showing your last refreshed spot.' : 'Off — nobody can see where you are.'}
              </Text>
            </View>
            <Button
              label={state.sharingEnabled ? 'Turn off' : 'Turn on'}
              variant={state.sharingEnabled ? 'ghost' : 'primary'}
              onPress={() => {
                const next = !state.sharingEnabled;
                setSharing(next);
                if (next && permission !== 'granted') requestPermission();
              }}
            />
          </View>
        </Card>

        {/* Status */}
        {state.sharingEnabled && permission === 'granted' ? (
          <>
            <View style={styles.distanceCard}>
              {state.partner ? (
                <>
                  <Text style={{ ...type.labelCaps, color: colors.card, opacity: 0.9, letterSpacing: 1.5 }}>DISTANCE APART</Text>
                  <Text style={{ ...type.displayLgMobile, color: colors.card, marginTop: 4 }}>{state.partner.distanceKm} km</Text>
                  <Text style={{ ...type.bodyMd, color: colors.card, opacity: 0.92 }}>
                    between you and {partner?.name ?? 'your partner'} · {state.partner.label}
                  </Text>
                </>
              ) : (
                <Text style={{ ...type.bodyMd, color: colors.card, opacity: 0.92 }}>
                  Waiting for {partner?.name ?? 'your partner'} to share their location too.
                </Text>
              )}
              <Text style={{ ...type.labelCaps, color: colors.card, opacity: 0.8, marginTop: space.xs }}>
                {state.self ? `You: ${state.self.label} · refreshed ${state.self.atISO}` : 'Refreshing your spot…'}
              </Text>
            </View>
            <View style={{ marginTop: space.md }}>
              <Button
                label={loading ? 'Refreshing…' : 'Refresh my spot now'}
                icon="refresh-cw"
                variant="secondary"
                onPress={updateOwnLocation}
                loading={loading}
              />
            </View>
          </>
        ) : null}

        {/* Privacy promise */}
        <Card padding="compact" style={{ marginTop: space.lg }}>
          {[
            'Only used in the foreground, when you ask.',
            'Never stored anywhere but this device (for now).',
            'One tap to stop sharing completely.',
          ].map((line, i) => (
            <View key={line} style={[styles.promiseRow, i > 0 && { borderTopWidth: border.widthThin, borderTopColor: border.color }]}>
              <Icon name="shield" size={14} color={colors.primary} />
              <Text style={{ ...type.bodySm, color: colors.charcoal, flex: 1, marginLeft: space.sm }}>{line}</Text>
            </View>
          ))}
        </Card>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  distanceCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.xl,
    padding: space.cardPadding,
    marginTop: space.md,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  promiseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
});

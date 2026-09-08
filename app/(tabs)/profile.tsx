/** PROFILE — color-blocked couple identity hero + entry points to settings. */
import React, { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useClerk } from '@clerk/expo';
import { format, parseISO } from 'date-fns';
import { useSafeTopInset } from '../../src/components/chrome';
import { Card } from '../../src/components/primitives';
import { AvatarView } from '../../src/components/AvatarView';
import { Icon } from '../../src/components/Icon';
import { colors, border, elevation, radii, space, type } from '../../src/theme/tokens';
import { useSessionStore } from '../../src/state/session';
import { useConnectionStore } from '../../src/state/connection';
import { useRewardsStore } from '../../src/state/rewards';
import { daysTogether } from '../../src/domain/datetime';

/** "Together since June 14, 2022" from the couple's real anniversary date.
 * parseISO keeps a date-only string at local midnight (no UTC shift). */
function formatSince(anniversaryISO: string): string {
  try {
    return `Together since ${format(parseISO(anniversaryISO), 'MMMM d, yyyy')}`;
  } catch {
    return 'Together';
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const self = useSessionStore((s) => s.self);
  const partner = useSessionStore((s) => s.partner);
  const couple = useSessionStore((s) => s.couple);
  const streak = useConnectionStore((s) => s.streak);
  const refresh = useConnectionStore((s) => s.refresh);
  const points = useRewardsStore((s) => s.points);
  const refreshRewards = useRewardsStore((s) => s.refresh);
  const awardStreak = useRewardsStore((s) => s.awardStreak);
  const { signOut } = useClerk();

  const confirmSignOut = useCallback(() => {
    Alert.alert('Log out?', "You'll need to sign in again to get back to your shared space.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        // Clerk clears the session; the root layout's signed-in -> signed-out
        // effect wipes local SQLite/media/stores and the (tabs) guard sends
        // the user to the auth screen. Nothing else to do here.
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }, [signOut]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshRewards();
      // Server-idempotent: pays +10 to each partner once per qualifying
      // streak day, no-ops otherwise.
      if (couple?.id && streak?.qualifiesToday) awardStreak(couple.id);
    }, [refresh, refreshRewards, awardStreak, couple?.id, streak?.qualifiesToday])
  );

  const topInset = useSafeTopInset(space.md);

  if (!self || !partner || !couple) return null;

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Color-blocked identity hero */}
        <View style={[styles.hero, { paddingTop: topInset + space.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AvatarView name={self.name} avatar={self.avatar} size={64} />
            <View style={{ marginHorizontal: -12, zIndex: 2 }}>
              <AvatarView name={partner.name} avatar={partner.avatar} size={64} />
            </View>
          </View>
          <Text style={styles.names}>
            {self.name} &amp; {partner.name}
          </Text>
          <Text style={styles.since}>{formatSince(couple.anniversaryISO)}</Text>
          <View style={styles.metaRow}>
            <MetaPill label={`${daysTogether(couple.anniversaryISO)} days`} icon="heart" />
            <MetaPill label={`Lv. ${couple.level}`} icon="sun" />
            <MetaPill label={`${streak?.current ?? 0}-day streak`} icon="zap" />
            <MetaPill label={`${points} pts`} icon="star" />
          </View>
        </View>

        <View style={styles.content}>
          <View style={{ gap: space.sm }}>
            <LinkRow icon="user" label="Personal profile" hint="Names, birthdays, avatars" onPress={() => router.push('/settings')} />
            <LinkRow icon="smile" label="Your avatar" hint="A photo or a Pao & Ly illustration" onPress={() => router.push('/avatar')} />
            <LinkRow icon="star" label="Points & shop" hint={`${points} pts · unlock illustrations`} onPress={() => router.push('/shop')} />
            <LinkRow icon="map" label="Location sharing" hint="Opt-in, always in your control" onPress={() => router.push('/location')} />
            <LinkRow icon="lock" label="Private vault" hint="PIN & biometric protected" onPress={() => router.push('/vault')} />
            <LinkRow icon="calendar" label="Important dates" hint="Birthdays & anniversaries" onPress={() => router.push('/dates')} />
            <LinkRow icon="book" label="Journal" hint="Letters between the two of us" onPress={() => router.push('/journal')} />
            <LinkRow icon="settings" label="Settings" hint="Notifications, privacy, data" onPress={() => router.push('/settings')} />
            <LinkRow icon="log-out" label="Log out" hint="Sign out of this device" onPress={confirmSignOut} destructive />
          </View>
          <View style={{ height: 140 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function MetaPill({ label, icon }: { label: string; icon: 'heart' | 'sun' | 'zap' | 'star' }) {
  return (
    <View style={styles.metaPill}>
      <Icon name={icon} size={14} color={colors.charcoal} />
      <Text style={{ ...type.labelMd, color: colors.charcoal }}>{label}</Text>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  onPress,
  destructive = false,
}: {
  icon: string;
  label: string;
  hint: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Card onPress={onPress} padding="compact">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={[styles.linkIcon, destructive && styles.linkIconDestructive]}>
          <Icon name={icon as never} size={20} color={destructive ? colors.error : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.labelLg, color: destructive ? colors.error : colors.charcoal }}>{label}</Text>
          <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{hint}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.outlineVariant} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    paddingBottom: space.xl,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  names: { ...type.headlineLg, color: colors.charcoal, marginTop: space.md },
  since: { ...type.bodyMd, color: colors.charcoal, opacity: 0.9, marginTop: 2 },
  content: { paddingHorizontal: space.screenEdge, paddingTop: space.lg },
  metaRow: { flexDirection: 'row', gap: space.xs, marginTop: space.md, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    ...elevation.badge,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconDestructive: { backgroundColor: colors.errorContainer },
});

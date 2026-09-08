/**
 * TOGETHER hub — progressive disclosure per the approved design:
 * four expandable hubs (Play & Rituals, Connect & Intimacy, Plan & Grow,
 * Remember) + location capsule + nightly prompt banner.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeTopInset } from '../../src/components/chrome';
import { Card } from '../../src/components/primitives';
import { Icon, glyphs, type IconName } from '../../src/components/Icon';
import { colors, border, elevation, space, type, radii } from '../../src/theme/tokens';
import { useConnectionStore } from '../../src/state/connection';
import { useSessionStore } from '../../src/state/session';
import { LockedScreen } from '../../src/components/LockedScreen';
import { useGamesStore, useChallengesStore } from '../../src/state/activities';
import { useGoalsStore, useBucketStore, useMemoriesStore } from '../../src/state/life';
import { useLocationStore, useSettingsStore } from '../../src/state/settings';
import { GAMES } from '../../src/domain/games';

export default function TogetherScreen() {
  const router = useRouter();
  const refreshConnection = useConnectionStore((s) => s.refresh);
  const streak = useConnectionStore((s) => s.streak);
  const today = useConnectionStore((s) => s.today);
  const refreshGames = useGamesStore((s) => s.refresh);
  const refreshChallenges = useChallengesStore((s) => s.refresh);
  const refreshGoals = useGoalsStore((s) => s.refresh);
  const refreshBucket = useBucketStore((s) => s.refresh);
  const memories = useMemoriesStore((s) => s.memories);
  const refreshMemories = useMemoriesStore((s) => s.refresh);
  const goals = useGoalsStore((s) => s.goals);
  const challengeProgress = useChallengesStore((s) => s.progress);
  const bucketItems = useBucketStore((s) => s.items);
  const locationState = useLocationStore((s) => s.state);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const settings = useSettingsStore((s) => s.settings);
  const partner = useSessionStore((s) => s.partner);
  const hasCouple = useSessionStore((s) => s.hasCouple);

  useFocusEffect(
    useCallback(() => {
      refreshConnection();
      refreshGames();
      refreshChallenges();
      refreshGoals();
      refreshBucket();
      refreshMemories();
      refreshLocation();
    }, [refreshConnection, refreshGames, refreshChallenges, refreshGoals, refreshBucket, refreshMemories, refreshLocation])
  );

  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const topInset = useSafeTopInset(space.lg);

  const bucketDone = bucketItems.filter((i) => i.done).length;
  const ongoingPlans =
    goals.filter((g) => !g.done).length + challengeProgress.filter((p) => p.status === 'active').length;
  const moodDoneToday = useConnectionStore.getState().selfMoodToday != null;

  if (!hasCouple) return <LockedScreen feature="Together" />;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset }]} showsVerticalScrollIndicator={false}>
        {/* Screen intro */}
        <View style={styles.intro}>
          <View>
            <Text style={styles.h1}>Together</Text>
            <Text style={styles.sub}>Our shared rituals, play, and growth.</Text>
          </View>
          <View style={styles.syncChip}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>IN SYNC</Text>
          </View>
        </View>

        {/* Location capsule */}
        {settings.locationSharing ? (
          <Card style={styles.locationCard} onPress={() => router.push('/location')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={styles.locationIcon}>
                <Icon name={glyphs.orbit} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ ...type.labelLg, color: colors.charcoal }}>
                  {locationState.partner
                    ? `${partner?.name ?? 'Partner'} is ${locationState.partner.distanceKm} km away`
                    : 'Turn on sharing to see the distance'}
                </Text>
                <Text style={{ ...type.labelMd, color: colors.inkVariant }}>
                  {locationState.self
                    ? `Sharing from ${locationState.self.label}`
                    : locationState.partner
                      ? `Synced · ${locationState.partner.label}`
                      : 'Sync on'}
                </Text>
              </View>
            </View>
            <View style={styles.orbitBtn}>
              <Icon name={glyphs.orbit} size={14} color={colors.primary} />
              <Text style={styles.orbitText}>Orbit</Text>
            </View>
          </Card>
        ) : null}

        {/* Hub 1 — Play & Rituals */}
        <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
          <HubCard
            id="play"
            open={open === 'play'}
            onToggle={() => toggle('play')}
            icon={glyphs.grid}
            tag="PLAY & RITUALS"
            badge={`${GAMES.length} games`}
            title="Games & Daily Quizzes"
            tint={colors.primaryFixed}
          >
            <View style={styles.previewGrid}>
              {GAMES.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push({ pathname: '/games/[gameId]', params: { gameId: g.id } })}
                  style={styles.previewItem}
                  accessibilityRole="button"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Icon name={g.icon === 'grid' ? glyphs.grid : glyphs.quiz} size={18} color={colors.primary} />
                    <Text numberOfLines={1} style={{ ...type.labelMd, color: colors.charcoal, flex: 1 }}>{g.title}</Text>
                  </View>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                </Pressable>
              ))}
            </View>
            {today ? (
              <View style={styles.hubDetail}>
                <View style={styles.detailIcon}>
                  <Icon name={glyphs.spark} size={18} color={colors.charcoal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.labelLg, color: colors.charcoal }}>Tonight&apos;s check-in is ready</Text>
                  <Text style={{ ...type.bodySm, color: colors.inkVariant }}>Five gentle questions over tea.</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/question')}
                  style={styles.playBtn}
                  accessibilityRole="button"
                >
                  <Text style={{ ...type.labelMd, color: '#FFFFFF' }}>Play</Text>
                </Pressable>
              </View>
            ) : null}
          </HubCard>
        </Animated.View>

        {/* Hub 2 — Connect & Intimacy */}
        <HubCard
          id="connect"
          open={open === 'connect'}
          onToggle={() => toggle('connect')}
          icon={glyphs.heart}
          tag="CONNECT & INTIMACY"
          badge={moodDoneToday && streak?.qualifiesToday ? 'Done today' : 'Check in'}
          title="Daily Mood & Streaks"
          tint={colors.tertiaryFixed}
        >
          <View style={styles.stack}>
            {streak ? (
              <Pressable onPress={() => router.push('/streak')} style={styles.rowItem} accessibilityRole="button">
                <View style={styles.detailIcon}>
                  <Icon name={glyphs.fire} size={16} color={colors.charcoal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.labelLg, color: colors.charcoal }}>
                    {streak.current}-Day Mutual Streak
                  </Text>
                  <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                    {streak.nextMilestone ? `Next milestone: ${streak.nextMilestone.atDay} days (${streak.nextMilestone.label})` : 'Top tier reached'}
                  </Text>
                </View>
                <Text style={{ ...type.labelCaps, color: colors.primary }}>ON FIRE</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/mood')} style={styles.rowItem} accessibilityRole="button">
              <View style={[styles.detailIcon, { backgroundColor: colors.tertiaryFixed }]}>
                <Icon name={glyphs.smile} size={16} color={colors.charcoal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.labelLg, color: colors.charcoal }}>Today&apos;s mood</Text>
                <Text style={{ ...type.bodySm, color: colors.inkVariant }}>Set how today feels.</Text>
              </View>
              <Pressable onPress={() => router.push('/mood')} style={styles.playBtn} accessibilityRole="button">
                <Text style={{ ...type.labelMd, color: '#FFFFFF' }}>Open</Text>
              </Pressable>
            </Pressable>
          </View>
        </HubCard>

        {/* Hub 3 — Plan & Grow */}
        <HubCard
          id="plan"
          open={open === 'plan'}
          onToggle={() => toggle('plan')}
          icon={glyphs.flag}
          tag="PLAN & GROW"
          badge={`${ongoingPlans} ongoing`}
          title="Shared Goals & Bucket List"
          tint={colors.primaryFixed}
        >
          <View style={styles.stack}>
            <Pressable onPress={() => router.push('/goals')} style={styles.rowItem} accessibilityRole="button">
              <Icon name={glyphs.target} size={18} color={colors.primary} />
              <Text style={{ ...type.labelLg, color: colors.charcoal, flex: 1 }}>Shared goals</Text>
              <Icon name={glyphs.forward} size={18} color={colors.outlineVariant} />
            </Pressable>
            <Pressable onPress={() => router.push('/bucket')} style={styles.rowItem} accessibilityRole="button">
              <Icon name={glyphs.list} size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.labelLg, color: colors.charcoal }}>Bucket list</Text>
                <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                  {bucketDone} completed so far
                </Text>
              </View>
              <Icon name={glyphs.forward} size={18} color={colors.outlineVariant} />
            </Pressable>
            <Pressable onPress={() => router.push('/reminders')} style={styles.rowItem} accessibilityRole="button">
              <Icon name={glyphs.bell} size={18} color={colors.primary} />
              <Text style={{ ...type.labelLg, color: colors.charcoal, flex: 1 }}>Reminders</Text>
              <Icon name={glyphs.forward} size={18} color={colors.outlineVariant} />
            </Pressable>
            <Pressable onPress={() => router.push('/challenges')} style={styles.rowItem} accessibilityRole="button">
              <Icon name={glyphs.flag} size={18} color={colors.primary} />
              <Text style={{ ...type.labelLg, color: colors.charcoal, flex: 1 }}>Challenges</Text>
              <Icon name={glyphs.forward} size={18} color={colors.outlineVariant} />
            </Pressable>
          </View>
        </HubCard>

        {/* Hub 4 — Remember */}
        <HubCard
          id="remember"
          open={open === 'remember'}
          onToggle={() => toggle('remember')}
          icon={glyphs.book}
          tag="REMEMBER"
          badge="PIN-locked"
          title="Timeline & Vault"
          tint={colors.tertiaryFixed}
        >
          <View style={styles.previewGrid}>
            <Pressable onPress={() => router.push('/timeline')} style={styles.previewItem} accessibilityRole="button">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Icon name={glyphs.image} size={18} color={colors.primary} />
                <Text style={{ ...type.labelMd, color: colors.charcoal, flex: 1 }}>
                  {memories.length} Moments
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={() => router.push('/vault')} style={styles.previewItem} accessibilityRole="button">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Icon name={glyphs.lock} size={18} color={colors.primary} />
                <Text style={{ ...type.labelMd, color: colors.charcoal, flex: 1 }}>Private Vault</Text>
              </View>
            </Pressable>
          </View>
        </HubCard>

        {/* Prompt banner */}
        <Card style={{ marginTop: space.lg, marginBottom: space.dockHeight + space['3xl'] }} padding="default">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Ready for tonight&apos;s check-in?</Text>
              <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: 2 }}>
                {today?.revealed ? 'Both answered — take a look together.' : 'Five gentle questions over tea'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/question')}
              style={styles.beginBtn}
              accessibilityRole="button"
            >
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>
                {today?.revealed ? 'Read' : 'Begin'}
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function HubCard({
  id,
  open,
  onToggle,
  icon,
  tag,
  badge,
  title,
  tint,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: IconName;
  tag: string;
  badge: string;
  title: string;
  tint: string;
  children: React.ReactNode;
}) {
  void id;
  return (
    <Card style={{ marginBottom: space.md, backgroundColor: tint }} padding="compact">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
            <View style={[styles.hubIcon, { backgroundColor: colors.cardWhite }]}>
              <Icon name={icon} size={24} color={colors.charcoal} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ ...type.labelCaps, color: colors.primary, letterSpacing: 1.2 }}>{tag}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              </View>
              <Text style={{ ...type.headlineSm, color: colors.charcoal, marginTop: 2 }}>{title}</Text>
            </View>
          </View>
          <View style={[styles.chevron, { backgroundColor: colors.cardWhite }, open && { transform: [{ rotate: '180deg' }] }]}>
            <Icon name="chevron-down" size={20} color={colors.charcoal} />
          </View>
        </View>
      </Pressable>
      {open ? <View style={{ marginTop: space.md }}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingTop: 64 + space.lg, paddingHorizontal: space.screenEdge, paddingBottom: space.dockHeight + space['3xl'] },
  intro: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: space.lg },
  h1: { ...type.headlineLg, color: colors.charcoal },
  sub: { ...type.bodySm, color: colors.inkVariant, marginTop: 2 },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { ...type.labelCaps, color: colors.charcoal },
  locationCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightMint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  orbitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  orbitText: { ...type.labelMd, color: colors.charcoal },
  hubIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightMint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  badge: {
    backgroundColor: colors.cardWhite,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  badgeText: { ...type.labelCaps, color: colors.charcoal, fontSize: 10 },
  chevron: {
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
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  previewItem: {
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    padding: 10,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  hubDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    padding: space.cardPaddingCompact,
    marginTop: space.sm,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  playBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  stack: { gap: space.sm },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    padding: space.cardPaddingCompact,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  beginBtn: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
});

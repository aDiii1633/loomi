/** CHALLENGES — active challenges, daily check-ins, catalog, history. */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, ProgressBar } from '../src/components/primitives';
import { Icon, type FeatherName } from '../src/components/Icon';
import { Mascot } from '../src/components/illustrations/Mascot';
import { border, colors, elevation, radii, space, type } from '../src/theme/tokens';
import { useChallengesStore } from '../src/state/activities';
import { CHALLENGES } from '../src/domain/challenges';
import { dayISO, formatDayLabel } from '../src/domain/datetime';
import { toast } from '../src/components/toast';
import { haptic } from '../src/state/ui';
import type { Challenge, ChallengeProgress } from '../src/domain/types';

const CATEGORY_META: Record<Challenge['category'], { label: string; icon: FeatherName; tint: string }> = {
  connection: { label: 'Connection', icon: 'message-circle', tint: colors.tertiaryFixed },
  growth: { label: 'Growth', icon: 'trending-up', tint: colors.primaryFixed },
  care: { label: 'Care', icon: 'heart', tint: colors.tertiaryFixed },
  fun: { label: 'Fun', icon: 'zap', tint: colors.primaryFixed },
};

export default function ChallengesScreen() {
  const router = useRouter();
  const { progress, refresh, start, checkInToday, abandon } = useChallengesStore();
  const [catalogOpen, setCatalogOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const active = progress.filter((p) => p.status === 'active');
  const completed = progress.filter((p) => p.status === 'completed');
  const activeIds = new Set(active.map((p) => p.challengeId));

  return (
    <View style={styles.root}>
      <SubHeader title="Challenges" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Mascot variant="pao" mood={active.length > 0 ? 'happy' : 'celebrating'} size={72} />
          <Text style={styles.heroTitle}>
            {active.length === 0 ? 'Small, kind, repeatable' : `${active.length} in motion`}
          </Text>
          <Text style={styles.heroSub}>
            {active.length === 0
              ? 'Pick one together and start today.'
              : `${completed.length} completed together so far`}
          </Text>
          <View style={styles.heroBtn}>
            <Button label="Browse challenges" icon="plus" onPress={() => setCatalogOpen(true)} />
          </View>
        </View>

        {active.length === 0 && completed.length === 0 ? (
          <View style={{ marginTop: space.lg }}>
            <Card>
              <EmptyState
                icon="flag"
                illustration="challenges-checklist"
                title="No challenges yet"
                message="Small, kind, repeatable. Pick one and start today."
                actionLabel="Browse challenges"
                onAction={() => setCatalogOpen(true)}
              />
            </Card>
          </View>
        ) : (
          <>
            {active.length > 0 ? (
              <View style={{ marginTop: space.xl }}>
                <Text style={styles.section}>IN PROGRESS</Text>
                <View style={{ gap: space.md }}>
                  {active.map((p) => (
                    <ChallengeCard
                      key={p.id}
                      progress={p}
                      onCheckIn={() => {
                        checkInToday(p.id);
                        haptic('success');
                        toast('Checked in — see you tomorrow', 'success');
                      }}
                      onQuit={() => abandon(p.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {completed.length > 0 ? (
              <View style={{ marginTop: space.xl }}>
                <Text style={styles.section}>COMPLETED</Text>
                <View style={{ gap: space.md }}>
                  {completed.map((p) => (
                    <ChallengeCard key={p.id} progress={p} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
        <View style={{ height: 140 }} />
      </ScrollView>

      <BottomSheet visible={catalogOpen} onClose={() => setCatalogOpen(false)} title="Start a challenge">
        <View style={{ gap: space.sm }}>
          {CHALLENGES.filter((c) => !activeIds.has(c.id)).map((c) => {
            const meta = CATEGORY_META[c.category];
            return (
              <Card key={c.id} padding="compact">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={[styles.badge, { backgroundColor: meta.tint }]}>
                    <Icon name={meta.icon} size={20} color={colors.charcoal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.labelLg, color: colors.charcoal }}>{c.title}</Text>
                    <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{c.description}</Text>
                    <Text style={{ ...type.labelCaps, color: colors.primary, marginTop: 2 }}>
                      {meta.label.toUpperCase()} · {c.durationDays} DAYS
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: space.sm }}>
                  <Button
                    label="Start together"
                    onPress={() => {
                      start(c.id);
                      setCatalogOpen(false);
                      haptic('success');
                      toast('Challenge started', 'success');
                    }}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

function ChallengeCard({
  progress: p,
  onCheckIn = () => {},
  onQuit = () => {},
}: {
  progress: ChallengeProgress;
  onCheckIn?: () => void;
  onQuit?: () => void;
}) {
  const def = CHALLENGES.find((c) => c.id === p.challengeId);
  if (!def) return null;
  const meta = CATEGORY_META[def.category];
  const ratio = Math.min(1, p.completedOnISOs.length / def.durationDays);
  const checkedToday = p.completedOnISOs.includes(dayISO());

  return (
    <Card padding="compact">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={[styles.badge, { backgroundColor: meta.tint }, p.status === 'completed' && { opacity: 0.6 }]}>
          <Icon name={meta.icon} size={20} color={colors.charcoal} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Text style={{ ...type.labelLg, color: colors.charcoal, flex: 1 }}>{def.title}</Text>
            {p.status === 'completed' ? (
              <Chip label="Completed" icon="check" active />
            ) : (
              <Text style={{ ...type.labelCaps, color: colors.primary }}>
                DAY {p.completedOnISOs.length}/{def.durationDays}
              </Text>
            )}
          </View>
          <View style={{ marginTop: space.xs }}>
            <ProgressBar ratio={ratio} height={6} />
          </View>
          <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: space.xs }}>
            Started {formatDayLabel(p.startedOnISO)}
            {p.completedOnISOs.length > 0 ? ` · last check-in ${formatDayLabel(p.completedOnISOs[p.completedOnISOs.length - 1])}` : ''}
          </Text>
        </View>
      </View>
      {p.status === 'active' ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <View style={{ flex: 1 }}>
            <Button
              label={checkedToday ? 'Done today ✓' : 'Check in'}
              variant={checkedToday ? 'secondary' : 'primary'}
              disabled={checkedToday}
              onPress={onCheckIn}
            />
          </View>
          <Button label="Quit" variant="ghost" onPress={onQuit} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 140 },
  hero: {
    alignItems: 'center',
    marginTop: space.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    backgroundColor: colors.tertiaryContainer,
    borderRadius: radii.xl,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  heroTitle: { ...type.headlineMd, color: colors.card, marginTop: space.md, textAlign: 'center' },
  heroSub: { ...type.bodySm, color: colors.card, opacity: 0.9, textAlign: 'center', marginTop: space.xs },
  heroBtn: { marginTop: space.lg, alignSelf: 'stretch' },
  section: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.2, marginBottom: space.sm },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
});

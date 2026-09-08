/** HOME — color-blocked hero + one primary action + small supporting modules. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeTopInset } from '../../src/components/chrome';
import { Button, Card } from '../../src/components/primitives';
import { PaoAndLy } from '../../src/components/illustrations/Mascot';
import { FadeSlideIn } from '../../src/components/motion/FadeSlideIn';
import { Icon, glyphs, type IconName } from '../../src/components/Icon';
import { colors, border, space, type, radii, elevation } from '../../src/theme/tokens';
import { useSessionStore } from '../../src/state/session';
import { useConnectionStore } from '../../src/state/connection';
import { useMemoriesStore, useDatesStore, useGoalsStore } from '../../src/state/life';
import { useDraftsStore } from '../../src/state/drafts';
import { getMediaMany } from '../../src/data/media';
import { daysTogether, daysUntil, formatDayLabel } from '../../src/domain/datetime';
import { getHomePriority, type HomePriority } from '../../src/domain/homePriority';

export default function HomeScreen() {
  const router = useRouter();
  const self = useSessionStore((s) => s.self);
  const partner = useSessionStore((s) => s.partner);
  const couple = useSessionStore((s) => s.couple);
  const { today, streak, refresh } = useConnectionStore();
  const memories = useMemoriesStore((s) => s.memories);
  const refreshMemories = useMemoriesStore((s) => s.refresh);
  const dates = useDatesStore((s) => s.dates);
  const refreshDates = useDatesStore((s) => s.refresh);
  const likeMemory = useMemoriesStore((s) => s.like);
  const goals = useGoalsStore((s) => s.goals);
  const refreshGoals = useGoalsStore((s) => s.refresh);
  const drafts = useDraftsStore((s) => s.drafts);

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const heroMemory = memories[0];

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshMemories();
      refreshDates();
      refreshGoals();
    }, [refresh, refreshMemories, refreshDates, refreshGoals])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!heroMemory || heroMemory.mediaIds.length === 0) {
        setCoverUri(null);
        return;
      }
      const media = await getMediaMany(heroMemory.mediaIds);
      if (!cancelled && media[0]) setCoverUri(media[0].uri);
    })();
    return () => {
      cancelled = true;
    };
  }, [heroMemory]);

  const nextDate = dates
    .map((d) => ({ ...d, days: daysUntil(d.dateISO, d.yearly) }))
    .filter((d) => Number.isFinite(d.days) && d.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  const goalNeedingAttention = goals
    .filter((g) => !g.done && g.dueISO)
    .map((g) => ({ title: g.title, daysLeft: daysUntil(g.dueISO as string, false) }))
    .filter((g) => Number.isFinite(g.daysLeft) && g.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;

  const firstDraftKey = Object.keys(drafts)[0];
  const draft = firstDraftKey ? drafts[firstDraftKey] : null;

  const priority = getHomePriority({
    draft,
    questionState: today?.state ?? null,
    nextDate: nextDate ? { title: nextDate.title, days: nextDate.days } : null,
    goalNeedingAttention,
  });

  const topInset = useSafeTopInset(space.md);

  if (!self || !partner || !couple) return null;

  const showUpcomingModule = !!nextDate && priority.kind !== 'date';

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.dockHeight + space['3xl'] }}>
        {/* Color-blocked hero */}
        <View style={[styles.hero, { paddingTop: topInset + space.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <PulsingDot />
            <Text style={styles.eyebrow}>IN HARMONY</Text>
          </View>
          <Text style={styles.display}>
            {greeting},{'\n'}
            {self.name} &amp; {partner.name}
          </Text>
          <View style={styles.daysChip}>
            <Icon name="sun" size={14} color={colors.charcoal} />
            <Text style={styles.daysChipText}>
              {daysTogether(couple.anniversaryISO)} days together · Lv. {couple.level}
            </Text>
          </View>

          {/* Streak is the headline reason to open Loomi — give it weight, in
              the hero, above the mascot. */}
          <FadeSlideIn delay={40}>
            <StreakBanner
              current={streak?.current ?? 0}
              done={!!streak?.qualifiesToday}
              onPress={() => router.push('/streak')}
            />
          </FadeSlideIn>

          <FadeSlideIn>
            <View style={styles.heroMascotRow}>
              <PaoAndLy size={116} />
            </View>
          </FadeSlideIn>
        </View>

        <View style={styles.content}>
          {heroMemory ? (
            <FadeSlideIn>
              <View style={styles.photoWrap}>
                <Image source={coverUri ? { uri: coverUri } : undefined} style={styles.photoImage} contentFit="cover" transition={300} />
                <View style={styles.likeBtn}>
                  <PressableLike
                    liked={heroMemory.likedBySelf}
                    count={heroMemory.likeCount}
                    onToggle={() => likeMemory(heroMemory.id)}
                  />
                </View>
                <View style={styles.photoChip}>
                  <Icon name={glyphs.location} size={13} color={colors.primary} />
                  <Text style={styles.photoChipText} numberOfLines={1}>
                    {heroMemory.title}
                    {heroMemory.place ? ` · ${heroMemory.place}` : ''} · {formatDayLabel(heroMemory.takenAtISO)}
                  </Text>
                </View>
              </View>
            </FadeSlideIn>
          ) : null}

          <FadeSlideIn delay={60} style={{ marginTop: heroMemory ? space.lg : 0 }}>
            <PrimaryActionCard
              priority={priority}
              today={today}
              self={self}
              partnerName={partner.name}
              onPress={() => router.push(priorityRoute(priority))}
            />
          </FadeSlideIn>

          {showUpcomingModule ? (
            <View style={{ marginTop: space.lg }}>
              <SmallModule
                icon={glyphs.gift}
                label={nextDate!.title}
                sub={nextDate!.days === 0 ? 'Today' : `in ${nextDate!.days}d`}
                onPress={() => router.push('/dates')}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function PrimaryActionCard({
  priority,
  today,
  self,
  partnerName,
  onPress,
}: {
  priority: HomePriority;
  today: ReturnType<typeof useConnectionStore.getState>['today'];
  self: { name: string };
  partnerName: string;
  onPress: () => void;
}) {
  if (priority.kind === 'question' && today) {
    return (
      <Card padding="default" onPress={onPress}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={glyphs.spark} size={18} color={colors.primary} />
          <Text style={styles.capsule}>TODAY&apos;S CONNECTION</Text>
        </View>
        <Text style={{ ...type.headlineMd, color: colors.charcoal, marginTop: space.xs }} numberOfLines={3}>
          {today.question.text}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <AnswerPreview
            name={self.name}
            dotColor={colors.primary}
            text={today.revealed ? today.selfAnswer?.text : today.selfAnswer ? `Answered — sealed until ${partnerName} replies` : 'Not answered yet'}
          />
          <AnswerPreview
            name={partnerName}
            dotColor={colors.tertiaryContainer}
            text={today.revealed ? today.partnerAnswer?.text : today.partnerAnswer ? 'Answered — sealed until you reply' : 'Not answered yet'}
          />
        </View>
        <View style={{ marginTop: space.lg }}>
          <Button
            label={today.state === 'unlocked' ? 'Read together' : 'Answer together'}
            icon={glyphs.forward}
            onPress={onPress}
          />
        </View>
      </Card>
    );
  }

  if (priority.kind === 'none') {
    return null;
  }

  return (
    <Card padding="default" onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={styles.iconBubble}>
          <Icon name={priorityIcon(priority)} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.capsule2}>RIGHT NOW</Text>
          <Text style={{ ...type.labelLg, color: colors.charcoal }} numberOfLines={2}>
            {priorityMessage(priority, partnerName)}
          </Text>
        </View>
        <Icon name={glyphs.forward} size={18} color={colors.charcoal} />
      </View>
    </Card>
  );
}

function priorityRoute(priority: HomePriority): string {
  switch (priority.kind) {
    case 'draft':
      return priority.route;
    case 'date':
      return '/dates';
    case 'question':
      return '/question';
    case 'goal':
      return '/goals';
    default:
      return '/';
  }
}

function priorityIcon(priority: HomePriority): 'edit-3' | 'gift' | 'help-circle' | 'target' {
  switch (priority.kind) {
    case 'draft':
      return 'edit-3';
    case 'date':
      return 'gift';
    case 'goal':
      return 'target';
    default:
      return 'help-circle';
  }
}

function priorityMessage(priority: HomePriority, partnerName: string): string {
  switch (priority.kind) {
    case 'draft':
      return `Finish "${priority.label}"`;
    case 'date':
      return priority.days === 0
        ? `${priority.title} is today`
        : priority.days === 1
          ? `${priority.title} is tomorrow`
          : `${priority.title} in ${priority.days} days`;
    case 'question':
      return priority.urgent ? `${partnerName} answered — seal yours to reveal` : "Answer today's question together";
    case 'goal':
      return `One more step on "${priority.title}"`;
    default:
      return '';
  }
}

function PulsingDot() {
  const [phase, setPhase] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => !p), 1200);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cardWhite, opacity: phase ? 1 : 0.55 }} />
  );
}

function PressableLike({ liked, count, onToggle }: { liked: boolean; count: number; onToggle: () => void }) {
  const [pop, setPop] = useState(false);
  return (
    <View style={styles.likeChip}>
      <Text
        role="button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          setPop(true);
          setTimeout(() => setPop(false), 180);
          onToggle();
        }}
        style={{
          fontSize: 16,
          color: liked ? colors.accent : colors.outline,
          transform: [{ scale: pop ? 1.35 : 1 }],
        }}
      >
        {liked ? '♥' : '♡'}
      </Text>
      <Text style={{ ...type.labelMd, color: colors.charcoal }}>{count}</Text>
    </View>
  );
}

function AnswerPreview({ name, dotColor, text }: { name: string; dotColor: string; text?: string }) {
  return (
    <View style={styles.answerBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
        <Text style={{ ...type.labelMd, color: colors.charcoal }}>{name}</Text>
      </View>
      <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: 4 }} numberOfLines={2}>
        {text ? `"${text}"` : '—'}
      </Text>
    </View>
  );
}

function StreakBanner({ current, done, onPress }: { current: number; done: boolean; onPress: () => void }) {
  return (
    <Card padding="compact" onPress={onPress} style={styles.streakBanner}>
      <View style={styles.streakFlame}>
        <Icon name={glyphs.fire} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={styles.streakNumber}>{current}</Text>
          <Text style={styles.streakUnit}>day{current === 1 ? '' : 's'}</Text>
        </View>
        <Text style={styles.streakCaption}>Your streak together</Text>
      </View>
      <View style={[styles.streakStatus, done && styles.streakStatusDone]}>
        <Icon name={done ? 'check' : 'zap'} size={13} color={colors.charcoal} />
        <Text style={styles.streakStatusText}>{done ? 'Today done' : '1 ritual left'}</Text>
      </View>
    </Card>
  );
}

function SmallModule({
  icon,
  label,
  sub,
  onPress,
  style,
}: {
  icon: IconName;
  label: string;
  sub: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Card style={style} padding="compact" onPress={onPress}>
      <View style={styles.iconBubble}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={{ ...type.labelMd, color: colors.charcoal, marginTop: space.xs }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ ...type.bodySm, color: colors.inkVariant }} numberOfLines={1}>
        {sub}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    backgroundColor: colors.tertiaryFixed,
    borderBottomLeftRadius: radii['2xl'],
    borderBottomRightRadius: radii['2xl'],
    borderWidth: border.width,
    borderTopWidth: 0,
    borderColor: border.color,
    paddingHorizontal: space.screenEdge,
    paddingBottom: space.xl,
    ...elevation.card,
  },
  content: { paddingHorizontal: space.screenEdge, paddingTop: space.lg },
  eyebrow: { ...type.labelCaps, color: colors.charcoal, letterSpacing: 2, opacity: 0.85 },
  display: { ...type.displayLgMobile, color: colors.charcoal, marginTop: 6 },
  daysChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignSelf: 'flex-start',
    ...elevation.badge,
  },
  daysChipText: { ...type.labelMd, color: colors.charcoal },
  heroMascotRow: { alignItems: 'center', marginTop: space.lg },
  photoWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.lightMint,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  photoImage: { ...StyleSheet.absoluteFillObject },
  likeBtn: { position: 'absolute', top: space.md, right: space.md },
  likeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardWhite,
    borderRadius: radii.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  photoChip: {
    position: 'absolute',
    bottom: space.md,
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.cardWhite,
    borderRadius: radii.pill,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    ...elevation.badge,
  },
  photoChipText: { ...type.labelMd, color: colors.charcoal, flexShrink: 1 },
  capsule: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.5 },
  capsule2: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.2 },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  answerBox: {
    flex: 1,
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    borderWidth: border.widthThin,
    borderColor: border.color,
    padding: space.sm,
  },
  streakBanner: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.cardWhite,
  },
  streakFlame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tertiaryFixed,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNumber: { ...type.displayLgMobile, color: colors.charcoal },
  streakUnit: { ...type.labelLg, color: colors.charcoal },
  streakCaption: { ...type.bodySm, color: colors.inkVariant },
  streakStatus: {
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
  streakStatusDone: { backgroundColor: colors.primaryContainer },
  streakStatusText: { ...type.labelMd, color: colors.charcoal },
});

/** STREAK — derived stats, qualifying activities, milestones, rules. */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Svg, Circle } from 'react-native-svg';
import { SubHeader } from '../src/components/chrome';
import { Card, Chip } from '../src/components/primitives';
import { Mascot } from '../src/components/illustrations/Mascot';
import { LoomiIllustration } from '../src/components/illustrations/LoomiIllustration';
import { Icon } from '../src/components/Icon';
import { colors, border, elevation, radii, space, type } from '../src/theme/tokens';
import { useConnectionStore } from '../src/state/connection';

const R = 110;
const C = 2 * Math.PI * R;

export default function StreakScreen() {
  const router = useRouter();
  const { streak, moodsHistory, streakActivityDays } = useConnectionStore();

  const last14 = useMemo(() => {
    if (!streak) return [];
    const activeSet = new Set(streakActivityDays);
    const days: { iso: string; active: boolean }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // "active" = any qualifying activity that day (question, ritual, mood, game,
      // challenge, chat, memory) — the same set the streak engine counts.
      days.push({ iso, active: activeSet.has(iso) });
    }
    return days;
  }, [streak, streakActivityDays]);

  const moodsThisWeek = useMemo(() => {
    const t = new Date();
    const cutoff = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6);
    const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const seen = new Map<string, { emoji: string; label: string }>();
    for (const m of moodsHistory) {
      if (m.dayISO >= cutoffISO && !seen.has(m.emoji)) seen.set(m.emoji, { emoji: m.emoji, label: m.label });
    }
    return [...seen.values()];
  }, [moodsHistory]);

  if (!streak) {
    return (
      <View style={styles.root}>
        <SubHeader title="Streak" onBack={() => router.back()} />
        <Card padding="default"><Text style={{ ...type.bodyMd, color: colors.inkVariant }}>Loading your streak…</Text></Card>
      </View>
    );
  }

  const progress = Math.min(1, streak.current / (streak.nextMilestone?.atDay ?? Math.max(1, streak.current)));

  return (
    <View style={styles.root}>
      <SubHeader title="Our Streak" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ring */}
        <View style={styles.ringWrap}>
          <View style={styles.ringPlate} />
          <Svg width={256} height={256} style={StyleSheet.absoluteFill} transform={[{ rotate: '-90deg' }]}>
            <Circle cx={128} cy={128} r={R} stroke={colors.surfaceContainerHigh} strokeWidth={8} fill="none" />
            <Circle
              cx={128}
              cy={128}
              r={R}
              stroke={colors.primaryContainer}
              strokeWidth={8}
              fill="none"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.ringInner}>
            <Mascot variant="pao" mood={streak.qualifiesToday ? 'celebrating' : 'happy'} size={44} style={{ marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ ...type.displayLgMobile, color: colors.charcoal }}>{streak.current}</Text>
              <Text style={{ ...type.headlineSm, color: colors.tertiary }}>Days</Text>
            </View>
            <Text style={styles.ringCaption}>CONNECTED IN RHYTHM</Text>
            <View style={styles.ringTag}>
              <Text style={{ ...type.labelMd, color: colors.charcoal }}>
                {streak.qualifiesToday ? "Today's ritual done ✓" : '1 ritual remaining today'}
              </Text>
            </View>
          </View>
        </View>

        {streak.qualifiesToday ? (
          <View style={{ alignItems: 'center', marginTop: space.sm }}>
            <LoomiIllustration asset="streak-fist-bump" size={96} accessibilityLabel="Pao and Ly celebrating today's completed ritual" />
          </View>
        ) : null}

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <StatCard label="Longest" value={`${streak.longest} days`} icon="trophy" />
          <StatCard
            label="Next milestone"
            value={streak.nextMilestone ? `${streak.nextMilestone.atDay - streak.current} days` : 'Top tier'}
            sub={streak.nextMilestone?.label}
            icon="star"
          />
        </View>

        {/* Last 14 days */}
        <Text style={styles.section}>LAST 14 DAYS</Text>
        <Card padding="compact">
          <View style={styles.weekRow}>
            {last14.map((d, i) => (
              <View key={d.iso} style={styles.dayCell}>
                <View style={[styles.dayDot, { backgroundColor: d.active ? colors.primaryContainer : colors.cardWhite }, !d.active && { borderWidth: border.widthThin, borderColor: border.color }]}>
                  {d.active ? <Text style={{ fontSize: 10 }}>🌿</Text> : null}
                </View>
                <Text style={styles.dayLabel}>{i === 13 ? 'Today' : String(i + 1)}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Rules */}
        <Text style={styles.section}>WHAT KEEPS IT ALIVE</Text>
        <Card padding="compact">
          {[
            ['help-circle', 'Answering the daily question'],
            ['smile', 'Checking in with a mood'],
            ['zap', 'Playing a game together'],
            ['heart', 'A chat message or memory'],
          ].map(([icon, label], i) => (
            <View key={label} style={[styles.ruleRow, i > 0 && { borderTopWidth: border.widthThin, borderTopColor: border.color }]}>
              <Icon name={icon as never} size={16} color={colors.primary} />
              <Text style={{ ...type.bodyMd, color: colors.charcoal, flex: 1, marginLeft: space.sm }}>{label}</Text>
            </View>
          ))}
        </Card>

        {/* Moods actually logged this week */}
        <Text style={styles.section}>MOODS SHAPED THIS WEEK</Text>
        {moodsThisWeek.length === 0 ? (
          <Text style={{ ...type.bodySm, color: colors.inkVariant, alignSelf: 'flex-start' }}>
            No moods logged in the last 7 days.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {moodsThisWeek.map((m) => (
              <Chip key={m.emoji} label={`${m.emoji} ${m.label}`} />
            ))}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <Card style={{ flex: 1 }} padding="compact">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={styles.statIcon}>
          <Icon name={icon as never} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.labelCaps, color: colors.tertiary }}>{label.toUpperCase()}</Text>
          <Text style={{ ...type.labelLg, color: colors.charcoal }}>{value}</Text>
          {sub ? <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{sub}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  ringWrap: { width: 256, height: 256, alignItems: 'center', justifyContent: 'center', marginTop: space.md, alignSelf: 'center' },
  ringPlate: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  ringInner: {
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...elevation.raised,
  },
  ringCaption: { ...type.labelCaps, color: colors.inkVariant, letterSpacing: 1.5, marginTop: 2 },
  ringTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: space.sm,
  },
  section: { ...type.labelCaps, color: colors.inkVariant, letterSpacing: 1.2, alignSelf: 'flex-start', marginTop: space.xl, marginBottom: space.sm },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: 4, flex: 1 },
  dayDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { ...type.labelCaps, color: colors.outlineVariant, fontSize: 9 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

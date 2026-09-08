/** MOOD — illustration-led, animated round mood picker, compact partner pill. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Input } from '../src/components/primitives';
import { SubHeader } from '../src/components/chrome';
import { Mascot } from '../src/components/illustrations/Mascot';
import { colors, border, elevation, radii, space, type } from '../src/theme/tokens';
import { useConnectionStore } from '../src/state/connection';
import { useSessionStore } from '../src/state/session';
import { useSettingsStore } from '../src/state/settings';
import { MOODS } from '../src/domain/moods';
import { formatDayLabel } from '../src/domain/datetime';
import { validateText } from '../src/domain/validation';
import { toast } from '../src/components/toast';
import { haptic } from '../src/state/ui';
import { track } from '../src/services/analytics';

export default function MoodScreen() {
  const router = useRouter();
  const self = useSessionStore((s) => s.self);
  const partner = useSessionStore((s) => s.partner);
  const { selfMoodToday, partnerMoodToday, moodsHistory, setMood } = useConnectionStore();
  const [selected, setSelected] = useState<string | null>(selfMoodToday?.emoji ?? null);
  const [label, setLabel] = useState<string | null>(selfMoodToday?.label ?? null);
  const [note, setNote] = useState(selfMoodToday?.note ?? '');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const history = useMemo(
    () =>
      moodsHistory
        .filter((m) => m.authorId === self?.id)
        .slice(0, 14),
    [moodsHistory, self]
  );

  useEffect(() => {
    track('mood_opened');
  }, []);

  if (!self || !partner) return null;

  const save = async () => {
    if (!selected || !label) {
      toast('Pick a mood first.', 'error');
      return;
    }
    const v = validateText(note, 'moodNote', { required: false });
    if (!v.ok) {
      setNoteError(v.message);
      return;
    }
    setSaving(true);
    try {
      await setMood(selected, label, note.trim() || undefined);
      haptic('success');
      toast('Mood shared with ' + partner.name, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your mood.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Today's Mood" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.illustrationWrap}>
          <Mascot variant="ly" mood={selected ? 'celebrating' : 'happy'} size={80} />
        </View>

        {/* Partner state — compact pill, not a full card */}
        <View style={styles.partnerPill}>
          <Text style={{ fontSize: 18 }}>{partnerMoodToday?.emoji ?? '🫥'}</Text>
          <Text style={{ ...type.labelMd, color: colors.charcoal, flex: 1 }} numberOfLines={1}>
            {partner.name}: {partnerMoodToday ? partnerMoodToday.label : 'Not set yet'}
          </Text>
        </View>

        <Text style={styles.question}>How does today feel, {self.name}?</Text>

        <View style={styles.grid}>
          {MOODS.map((m) => (
            <MoodBubble
              key={m.emoji}
              emoji={m.emoji}
              label={m.label}
              active={m.emoji === selected}
              onPress={() => {
                setSelected(m.emoji);
                setLabel(m.label);
              }}
            />
          ))}
        </View>

        <View style={{ marginTop: space.lg }}>
          <Input label="Add a note (optional)" value={note} onChangeText={(t) => { setNote(t); setNoteError(null); }} placeholder="One line for your person…" multiline error={noteError ?? undefined} />
          <Button label={saving ? 'Saving…' : selfMoodToday ? 'Update mood' : 'Share mood'} onPress={save} loading={saving} />
        </View>

        {/* History — a visual strip, not a text list */}
        <Text style={[styles.section, { marginTop: space.xl }]}>YOUR LAST TWO WEEKS</Text>
        {history.length === 0 ? (
          <Card>
            <EmptyState icon="smile" illustration="mood-thinking-together" title="No mood history yet" message="Check in daily and watch the pattern appear." />
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
            {history.map((m) => (
              <View key={m.id} style={styles.historyChip}>
                <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                <Text style={styles.historyDay}>{formatDayLabel(m.dayISO)}</Text>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function MoodBubble({
  emoji,
  label,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion);

  const press = () => {
    haptic('light');
    onPress();
    if (!reducedMotion) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.14, useNativeDriver: true, speed: 30, bounciness: 10 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mood ${label}`}
      accessibilityState={{ selected: active }}
      onPress={press}
      style={styles.moodItem}
    >
      <Animated.View style={[styles.moodBubble, active && styles.moodBubbleActive, { transform: [{ scale }] }]}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
      </Animated.View>
      <Text style={[styles.moodLabel, active && { color: colors.charcoal }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  illustrationWrap: { alignItems: 'center', paddingVertical: space.xs },
  partnerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    borderRadius: radii.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignSelf: 'center',
    ...elevation.badge,
  },
  question: { ...type.headlineSm, color: colors.charcoal, textAlign: 'center', marginTop: space.lg, marginBottom: space.md },
  section: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.2, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  moodItem: { alignItems: 'center', width: 76 },
  moodBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  moodBubbleActive: { backgroundColor: colors.primaryContainer },
  moodLabel: { ...type.labelMd, color: colors.inkVariant, marginTop: 6, textAlign: 'center' },
  historyChip: {
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    borderRadius: radii.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  historyDay: { ...type.labelCaps, color: colors.tertiary, marginTop: 4 },
});

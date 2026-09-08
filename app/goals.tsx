/** GOALS — shared goals with progress, milestones, due dates. */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, Input, ProgressBar } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { border, colors, elevation, radii, space, type } from '../src/theme/tokens';
import { useGoalsStore } from '../src/state/life';
import { validateNumberInRange, validateText, isDuplicateTitle } from '../src/domain/validation';
import {
  validateMilestoneTitle,
  addMilestone as pushMilestone,
  removeMilestone as dropMilestone,
  toggleMilestoneDone,
} from '../src/domain/goals';
import { formatDayLabel } from '../src/domain/datetime';
import { newId } from '../src/data/media';
import { toast } from '../src/components/toast';
import { confirmDiscard, haptic, useUIStore } from '../src/state/ui';
import { track } from '../src/services/analytics';
import type { GoalMilestone } from '../src/domain/types';

/** "45000₹" for symbol-style units, "7 weeks" for word units. */
function withUnit(value: number, unit: string): string {
  if (!unit) return String(value);
  const isSymbol = /^[^a-zA-Z0-9\s]+$/.test(unit);
  return isSymbol ? `${value}${unit}` : `${value} ${unit}`;
}

export default function GoalsScreen() {
  const router = useRouter();
  const { goals, refresh, save, setCurrent, remove } = useGoalsStore();
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('100');
  const [current, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState('');
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [msDraft, setMsDraft] = useState('');
  const [errors, setErrors] = useState<{ title?: string; target?: string }>({});
  const [snapshot, setSnapshot] = useState('');

  const isDirty = JSON.stringify({ title, target, current, unit, milestones }) !== snapshot;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openSheet = (id?: string) => {
    const g = id ? goals.find((x) => x.id === id) : undefined;
    if (!id) track('goal_create_started');
    setEditingId(id);
    setTitle(g?.title ?? '');
    setTarget(g ? String(g.target) : '100');
    setCurrentValue(g ? String(g.current) : '0');
    setUnit(g?.unit ?? '');
    setMilestones(g?.milestones ?? []);
    setMsDraft('');
    setErrors({});
    setSnapshot(
      JSON.stringify({
        title: g?.title ?? '',
        target: g ? String(g.target) : '100',
        current: g ? String(g.current) : '0',
        unit: g?.unit ?? '',
        milestones: g?.milestones ?? [],
      })
    );
    setSheetOpen(true);
  };

  const addMilestone = () => {
    if (!msDraft.trim()) return;
    const check = validateMilestoneTitle(msDraft, milestones);
    if (!check.ok) {
      toast(check.message, 'error');
      return;
    }
    setMilestones((list) => pushMilestone(list, { id: newId('gm'), title: check.title, done: false }));
    setMsDraft('');
    haptic('light');
  };

  const submit = async () => {
    const t = validateText(title, 'goalTitle');
    if (!t.ok) return setErrors({ title: t.message });
    const targetNum = Number(target);
    const currentNum = Number(current);
    const tv = validateNumberInRange(targetNum, 1, 10_000_000, 'Target');
    if (!tv.ok) return setErrors({ target: tv.message });
    const cv = validateNumberInRange(currentNum, 0, targetNum, 'Progress');
    if (!cv.ok) return setErrors({ target: cv.message });
    if (isDuplicateTitle(goals, (g) => g.title, title, editingId, (g) => g.id)) {
      return setErrors({ title: 'A goal with this name already exists.' });
    }
    await save({ id: editingId, title, target: targetNum, current: currentNum, unit: unit.trim(), milestones });
    setSheetOpen(false);
    haptic('success');
    toast(editingId ? 'Goal updated' : 'Goal created', 'success');
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Goals" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>Shared goals</Text>
            <Text style={styles.sub}>Dream with a deadline.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openSheet()} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <View style={{ marginTop: space.lg, gap: space.md }}>
          {goals.length === 0 ? (
            <Card>
              <EmptyState
                icon="target"
                illustration="goals-progress-steps"
                title="No goals yet"
                message="A trip, a habit, a number — pick something and chase it together."
                actionLabel="Create your first goal"
                onAction={() => openSheet()}
              />
            </Card>
          ) : (
            goals.map((g) => {
              const ratio = g.target === 0 ? 0 : g.current / g.target;
              return (
                <Card key={g.id} padding="compact">
                  <Pressable onLongPress={() => openSheet(g.id)} delayLongPress={300}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ ...type.labelLg, color: colors.charcoal, flex: 1 }}>{g.title}</Text>
                      <Text style={{ ...type.labelCaps, color: colors.primary }}>
                        {g.done ? 'DONE' : `${Math.round(ratio * 100)}%`}
                      </Text>
                    </View>
                    <View style={{ marginTop: space.sm }}>
                      <ProgressBar ratio={ratio} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: space.sm }}>
                      <Text style={{ ...type.labelLg, color: colors.charcoal }}>
                        {withUnit(g.current, g.unit)}
                      </Text>
                      <Text style={{ ...type.bodySm, color: colors.inkVariant }}>of {withUnit(g.target, g.unit)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                        {g.dueISO ? `Due ${formatDayLabel(g.dueISO)}` : 'No due date'}
                        {g.milestones.length > 0
                          ? ` · ${g.milestones.filter((m) => m.done).length}/${g.milestones.length} steps`
                          : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: space.xs }}>
                        {!g.done ? (
                          <Chip label="+" onPress={() => setCurrent(g.id, g.current + Math.max(1, Math.round(g.target * 0.05)))} />
                        ) : null}
                        <Chip label="Edit" onPress={() => openSheet(g.id)} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete goal"
                          onPress={() =>
                            askConfirm({
                              title: 'Delete goal?',
                              message: `“${g.title}” and its progress will be removed.`,
                              confirmLabel: 'Delete',
                              destructive: true,
                              onConfirm: () => remove(g.id),
                            })
                          }
                          style={styles.trashBtn}
                        >
                          <Icon name="trash-2" size={16} color={colors.error} />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                </Card>
              );
            })
          )}
        </View>
        <View style={{ height: 140 }} />
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onClose={() =>
          confirmDiscard({
            isDirty,
            onDiscard: () => setSheetOpen(false),
            title: 'Discard this goal?',
            message: 'Your progress is waiting — nothing is saved yet.',
          })
        }
        title={editingId ? 'Edit goal' : 'New goal'}
      >
        <Input label="Goal" value={title} onChangeText={(t) => setTitle(t)} placeholder="Goa Trip Fund" error={errors.title} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input label="Target" value={target} onChangeText={setTarget} keyboardType="numeric" error={errors.target} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Progress so far" value={current} onChangeText={setCurrentValue} keyboardType="numeric" />
          </View>
        </View>
        <Input label="Unit (optional)" value={unit} onChangeText={setUnit} placeholder="₹, days, books…" />

        <Text style={{ ...type.labelMd, color: colors.inkVariant, marginBottom: space.xs }}>
          Milestones (optional)
        </Text>
        {milestones.length > 0 ? (
          <View style={{ marginBottom: space.sm, gap: 6 }}>
            {milestones.map((m) => (
              <View key={m.id} style={styles.msEditRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: m.done }}
                  accessibilityLabel={`Toggle milestone ${m.title}`}
                  onPress={() => setMilestones((list) => toggleMilestoneDone(list, m.id))}
                  style={[styles.msCheck, m.done && styles.msCheckDone]}
                >
                  {m.done ? <Icon name="check" size={11} color="#FFFFFF" /> : null}
                </Pressable>
                <Text
                  style={[
                    { ...type.bodySm, color: colors.charcoal, flex: 1 },
                    m.done && { textDecorationLine: 'line-through', color: colors.inkVariant },
                  ]}
                >
                  {m.title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove milestone ${m.title}`}
                  onPress={() => setMilestones((list) => dropMilestone(list, m.id))}
                  style={styles.msRemove}
                >
                  <Icon name="close" size={13} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.msAddRow}>
          <TextInput
            value={msDraft}
            onChangeText={setMsDraft}
            placeholder="Add a step…"
            placeholderTextColor="rgba(13,56,30,0.5)"
            style={styles.msInput}
            returnKeyType="done"
            onSubmitEditing={addMilestone}
            maxLength={80}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add milestone"
            onPress={addMilestone}
            style={styles.msAddBtn}
          >
            <Icon name="plus" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <Button label="Save goal" onPress={submit} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 140 },
  h1: { ...type.headlineLg, color: colors.charcoal },
  sub: { ...type.bodySm, color: colors.inkVariant, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  msEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  msCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryContainer,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msCheckDone: { backgroundColor: colors.primaryContainer, borderColor: 'transparent' },
  msRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msAddRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  msInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: space.md,
    color: colors.charcoal,
    ...type.bodyMd,
  },
  msAddBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.lightMint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
});

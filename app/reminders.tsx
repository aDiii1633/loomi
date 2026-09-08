/** REMINDERS — create/edit/delete with validated dates + repeat rules. */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, Input } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { colors, radii, space, type, border, elevation } from '../src/theme/tokens';
import { useRemindersStore } from '../src/state/life';
import { validateReminderDue, validateText } from '../src/domain/validation';
import { formatFriendlyDateTime } from '../src/domain/datetime';
import { toast } from '../src/components/toast';
import { confirmDiscard, haptic, useUIStore } from '../src/state/ui';
import type { Reminder } from '../src/domain/types';

const REPEATS: { id: Reminder['repeat']; label: string }[] = [
  { id: 'none', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export default function RemindersScreen() {
  const router = useRouter();
  const { reminders, refresh, save, toggleDone, remove } = useRemindersStore();
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState(() => {
    const d = new Date(Date.now() + 3600_000);
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [repeat, setRepeat] = useState<Reminder['repeat']>('none');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState('');

  const isDirty = JSON.stringify({ title, notes, due: due.getTime(), repeat }) !== snapshot;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openSheet = (id?: string) => {
    const r = id ? reminders.find((x) => x.id === id) : undefined;
    const initialDue = r ? new Date(r.dueAt) : new Date(Date.now() + 3600_000);
    const initialRepeat = r?.repeat ?? 'none';
    setEditingId(id);
    setTitle(r?.title ?? '');
    setNotes(r?.notes ?? '');
    setDue(initialDue);
    setRepeat(initialRepeat);
    setTitleError(null);
    setSnapshot(JSON.stringify({ title: r?.title ?? '', notes: r?.notes ?? '', due: initialDue.getTime(), repeat: initialRepeat }));
    setSheetOpen(true);
  };

  const submit = async () => {
    const v = validateText(title, 'reminderTitle');
    if (!v.ok) return setTitleError(v.message);
    const dueCheck = validateReminderDue(due.getTime());
    if (!dueCheck.ok) return toast(dueCheck.message, 'error');
    await save({ id: editingId, title, notes, dueAt: due.getTime(), repeat });
    setSheetOpen(false);
    haptic('success');
    toast('Reminder saved', 'success');
  };

  const onDateChange = (_: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (d) setDue(d);
  };

  const todayCutoff = (() => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  })();
  const active = reminders.filter((r) => !r.done);
  const dueToday = active.filter((r) => r.dueAt < todayCutoff);
  const upcoming = active.filter((r) => r.dueAt >= todayCutoff);
  const done = reminders.filter((r) => r.done);

  const renderRow = (r: Reminder) => (
    <Card key={r.id} padding="compact">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: r.done }}
          onPress={() => toggleDone(r.id)}
          style={[styles.checkbox, r.done && styles.checkboxDone]}
        >
          {r.done ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
        </Pressable>
        <Pressable style={{ flex: 1 }} onLongPress={() => openSheet(r.id)} delayLongPress={300}>
          <Text style={[{ ...type.labelLg, color: colors.charcoal }, r.done && { textDecorationLine: 'line-through', color: colors.inkVariant }]}>
            {r.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Icon name="clock" size={12} color={r.dueAt < Date.now() && !r.done ? colors.error : colors.inkVariant} />
            <Text style={{ ...type.bodySm, color: r.dueAt < Date.now() && !r.done ? colors.error : colors.inkVariant }}>
              {formatFriendlyDateTime(r.dueAt)}
              {r.repeat !== 'none' ? ` · ${r.repeat}` : ''}
            </Text>
          </View>
          {r.notes ? <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{r.notes}</Text> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete reminder"
          onPress={() =>
            askConfirm({
              title: 'Delete reminder?',
              message: `“${r.title}” will be removed.`,
              confirmLabel: 'Delete',
              destructive: true,
              onConfirm: () => remove(r.id),
            })
          }
          style={styles.trashBtn}
        >
          <Icon name="trash-2" size={16} color={colors.error} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <View style={styles.root}>
      <SubHeader title="Reminders" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>Reminders</Text>
            <Text style={styles.sub}>
              {dueToday.length} today · {upcoming.length} upcoming
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openSheet()} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {reminders.length === 0 ? (
            <Card>
              <EmptyState
                icon="bell"
                illustration="reminders-share-calendar"
                title="Nothing scheduled"
                message="Plant pickups, ticket drops, calls home — we remember for you."
                actionLabel="Add a reminder"
                onAction={() => openSheet()}
              />
            </Card>
          ) : (
            <>
              {dueToday.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>TODAY · {dueToday.length}</Text>
                  {dueToday.map(renderRow)}
                </>
              ) : null}
              {upcoming.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, dueToday.length > 0 && { marginTop: space.sm }]}>
                    UPCOMING · {upcoming.length}
                  </Text>
                  {upcoming.map(renderRow)}
                </>
              ) : null}
              {done.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, active.length > 0 && { marginTop: space.sm }]}>DONE · {done.length}</Text>
                  {done.map(renderRow)}
                </>
              ) : null}
            </>
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
            title: 'Discard this reminder?',
            message: "It hasn't been saved yet.",
          })
        }
        title={editingId ? 'Edit reminder' : 'New reminder'}
      >
        <Input label="What should we remember?" value={title} onChangeText={setTitle} placeholder="Call the travel agent" error={titleError ?? undefined} />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Any details…" />
        <Text style={{ ...type.labelMd, color: colors.inkVariant, marginBottom: space.xs }}>When</Text>
        <Pressable onPress={() => setShowPicker(true)} style={styles.dateBtn}>
          <Icon name="calendar" size={16} color={colors.primary} />
          <Text style={{ ...type.bodyMd, color: colors.charcoal, flex: 1 }}>{formatFriendlyDateTime(due.getTime())}</Text>
          <Text style={{ ...type.labelMd, color: colors.primary }}>Change</Text>
        </Pressable>
        {showPicker ? (
          <DateTimePicker value={due} mode="datetime" onChange={onDateChange} minimumDate={new Date()} />
        ) : null}
        <Text style={{ ...type.labelMd, color: colors.inkVariant, marginTop: space.md, marginBottom: space.xs }}>Repeat</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.lg }}>
          {REPEATS.map((r) => (
            <Chip key={r.id} label={r.label} active={repeat === r.id} onPress={() => setRepeat(r.id)} />
          ))}
        </View>
        <Button label="Save reminder" onPress={submit} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 140 },
  h1: { ...type.headlineLg, color: colors.charcoal },
  sub: { ...type.bodySm, color: colors.inkVariant, marginTop: 2 },
  sectionLabel: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.2, marginBottom: 4 },
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...elevation.badge,
  },
  checkboxDone: { backgroundColor: colors.primaryContainer },
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
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
});

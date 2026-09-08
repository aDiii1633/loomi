/** IMPORTANT DATES — birthdays, anniversaries, milestones with countdowns. */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, Input } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { border, colors, elevation, radii, space, type } from '../src/theme/tokens';
import { useDatesStore } from '../src/state/life';
import { validateDayISO, validateText } from '../src/domain/validation';
import { daysUntil, formatFriendlyLong } from '../src/domain/datetime';
import { toast } from '../src/components/toast';
import { haptic, useUIStore } from '../src/state/ui';

export default function DatesScreen() {
  const router = useRouter();
  const { dates, refresh, save, remove } = useDatesStore();
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [yearly, setYearly] = useState(true);
  const [date, setDate] = useState(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const sorted = [...dates]
    .map((d) => ({ ...d, days: daysUntil(d.dateISO, d.yearly) }))
    .sort((a, b) => a.days - b.days);

  const openSheet = (id?: string) => {
    const d = id ? dates.find((x) => x.id === id) : undefined;
    setEditingId(id);
    setTitle(d?.title ?? '');
    setYearly(d?.yearly ?? true);
    setDate(d ? new Date(`${d.dateISO}T09:00:00`) : new Date());
    setTitleError(null);
    setDateError(null);
    setSheetOpen(true);
  };

  const submit = async () => {
    const t = validateText(title, 'dateTitle');
    if (!t.ok) return setTitleError(t.message);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dv = validateDayISO(iso, { allowFuture: true, fieldName: 'Date' });
    if (!dv.ok) return setDateError(dv.message);
    await save({ id: editingId, title, dateISO: iso, yearly });
    setSheetOpen(false);
    haptic('success');
    toast('Date saved', 'success');
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Dates" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>Important dates</Text>
            <Text style={styles.sub}>The days that made us.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openSheet()} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {sorted.length > 0 ? (
          <Pressable style={styles.featured} onPress={() => openSheet(sorted[0].id)}>
            <Text style={styles.featuredTag}>NEXT UP</Text>
            <Text style={styles.featuredCountdown}>{sorted[0].days === 0 ? 'Today!' : `${sorted[0].days} days to go`}</Text>
            <Text style={styles.featuredTitle}>{sorted[0].title}</Text>
            <Text style={styles.featuredDate}>{formatFriendlyLong(new Date(`${sorted[0].dateISO}T09:00:00`).getTime())}</Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {sorted.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar"
                illustration="dates-looking-calendar"
                title="No dates yet"
                message="Birthdays, anniversaries, first-meeting day — keep them safe here."
                actionLabel="Add a date"
                onAction={() => openSheet()}
              />
            </Card>
          ) : (
            sorted.slice(1).map((d) => (
              <Card key={d.id} padding="compact" onPress={() => openSheet(d.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={styles.iconWrap}>
                    <Icon name="gift" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.labelLg, color: colors.charcoal }}>{d.title}</Text>
                    <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                      {formatFriendlyLong(new Date(`${d.dateISO}T09:00:00`).getTime())} · {d.yearly ? 'yearly' : 'one time'}
                    </Text>
                  </View>
                  <View style={styles.countdown}>
                    <Text style={{ ...type.labelMd, color: colors.charcoal }}>
                      {d.days === 0 ? 'Today!' : `${d.days} days`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete date"
                    onPress={() =>
                      askConfirm({
                        title: 'Delete date?',
                        message: `“${d.title}” will be removed.`,
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: () => remove(d.id),
                      })
                    }
                  >
                    <Icon name="trash-2" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </View>
        <View style={{ height: 140 }} />
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={editingId ? 'Edit date' : 'New date'}>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Anniversary" error={titleError ?? undefined} />
        <Pressable onPress={() => setShowPicker(true)} style={styles.dateBtn}>
          <Icon name="calendar" size={16} color={colors.primary} />
          <Text style={{ ...type.bodyMd, color: colors.charcoal, flex: 1 }}>
            {formatFriendlyLong(date.getTime())}
          </Text>
          <Text style={{ ...type.labelMd, color: colors.primary }}>Change</Text>
        </Pressable>
        {dateError ? <Text style={{ ...type.bodySm, color: colors.error, marginTop: 4 }}>{dateError}</Text> : null}
        {showPicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={(_: DateTimePickerEvent, d?: Date) => {
              if (Platform.OS === 'android') setShowPicker(false);
              if (d) setDate(d);
            }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.md, marginBottom: space.lg }}>
          <Chip label="Repeats yearly" active={yearly} onPress={() => setYearly(true)} />
          <Chip label="One-time" active={!yearly} onPress={() => setYearly(false)} />
        </View>
        <Button label="Save date" onPress={submit} />
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
  featured: {
    marginTop: space.lg,
    backgroundColor: colors.tertiaryContainer,
    borderRadius: radii.xl,
    padding: space.xl,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  featuredTag: { ...type.labelCaps, color: colors.card, letterSpacing: 1.5, opacity: 0.9 },
  featuredCountdown: { ...type.displayLgMobile, color: colors.card, marginTop: 6 },
  featuredTitle: { ...type.headlineSm, color: colors.card, marginTop: space.sm },
  featuredDate: { ...type.bodyMd, color: colors.card, opacity: 0.9, marginTop: 2 },
  iconWrap: {
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
  countdown: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderWidth: border.widthThin,
    borderColor: border.color,
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

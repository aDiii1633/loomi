/** BUCKET LIST — add/edit/delete, categories, completion, search/filter. */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, Input } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { colors, radii, space, type, border, elevation } from '../src/theme/tokens';
import { useBucketStore } from '../src/state/life';
import { validateText, isDuplicateTitle } from '../src/domain/validation';
import { formatDayLabel } from '../src/domain/datetime';
import { toast } from '../src/components/toast';
import { confirmDiscard, haptic, useUIStore } from '../src/state/ui';
import { track } from '../src/services/analytics';
import type { BucketCategory } from '../src/domain/types';

const CATEGORIES: { id: BucketCategory; label: string; icon: 'map-pin' | 'star' | 'coffee' | 'flag' | 'zap'; tint: string }[] = [
  { id: 'travel', label: 'Travel', icon: 'map-pin', tint: colors.primaryFixed },
  { id: 'experience', label: 'Experience', icon: 'star', tint: colors.tertiaryFixed },
  { id: 'food', label: 'Food', icon: 'coffee', tint: colors.primaryFixed },
  { id: 'milestone', label: 'Milestone', icon: 'flag', tint: colors.tertiaryFixed },
  { id: 'wild', label: 'Wild', icon: 'zap', tint: colors.primaryFixed },
];

export default function BucketScreen() {
  const router = useRouter();
  const { items, refresh, save, toggleDone, remove } = useBucketStore();
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | BucketCategory>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BucketCategory>('experience');
  const [notes, setNotes] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState('');

  const isDirty = JSON.stringify({ title, category, notes }) !== snapshot;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const matchesQ = !q || i.title.toLowerCase().includes(q) || (i.notes?.toLowerCase().includes(q) ?? false);
      const matchesC = filter === 'all' || i.category === filter;
      return matchesQ && matchesC;
    });
  }, [items, query, filter]);

  const openSheet = (id?: string) => {
    const item = id ? items.find((x) => x.id === id) : undefined;
    if (!id) track('bucket_item_create_started');
    setEditingId(id);
    setTitle(item?.title ?? '');
    setCategory(item?.category ?? 'experience');
    setNotes(item?.notes ?? '');
    setTitleError(null);
    setSnapshot(JSON.stringify({ title: item?.title ?? '', category: item?.category ?? 'experience', notes: item?.notes ?? '' }));
    setSheetOpen(true);
  };

  const submit = async () => {
    const v = validateText(title, 'bucketTitle');
    if (!v.ok) return setTitleError(v.message);
    if (isDuplicateTitle(items, (i) => i.title, title, editingId, (i) => i.id)) {
      return setTitleError('Already on the list.');
    }
    await save({ id: editingId, title, category, notes });
    setSheetOpen(false);
    haptic('success');
    toast(editingId ? 'Saved' : 'Added to the bucket', 'success');
  };

  const doneCount = items.filter((i) => i.done).length;

  return (
    <View style={styles.root}>
      <SubHeader title="Bucket List" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>Bucket list</Text>
            <Text style={styles.sub}>
              {items.length} dreams · {doneCount} done
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openSheet()} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search our dreams…"
          placeholderTextColor="rgba(13,56,30,0.5)"
          style={styles.search}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md }}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} icon={c.icon} active={filter === c.id} onPress={() => setFilter(c.id)} />
          ))}
        </View>

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon="list"
                illustration={items.length === 0 ? 'bucket-adventure-basket' : undefined}
                title={items.length === 0 ? 'What should we do together?' : 'Nothing matches'}
                message={items.length === 0 ? 'Add the first dream you want to chase together.' : 'Try a different word or category.'}
                actionLabel={items.length === 0 ? 'Add a dream' : undefined}
                onAction={items.length === 0 ? () => openSheet() : undefined}
              />
            </Card>
          ) : (
            visible.map((item) => {
              const cat = CATEGORIES.find((c) => c.id === item.category);
              return (
                <Card key={item.id} padding="compact">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View style={[styles.adventureBadge, { backgroundColor: cat?.tint ?? colors.lightMint }, item.done && { opacity: 0.5 }]}>
                      {cat ? <Icon name={cat.icon} size={22} color={colors.charcoal} /> : null}
                    </View>
                    <Pressable style={{ flex: 1 }} onLongPress={() => openSheet(item.id)} delayLongPress={300}>
                      <Text
                        style={[
                          { ...type.labelLg, color: colors.charcoal },
                          item.done && { textDecorationLine: 'line-through', color: colors.inkVariant },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={{ ...type.bodySm, color: colors.inkVariant }} numberOfLines={1}>
                        {item.done && item.doneAtISO ? `Done ${formatDayLabel(item.doneAtISO)}` : cat?.label}
                        {item.notes ? ` · ${item.notes}` : ''}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.done }}
                      onPress={() => toggleDone(item.id)}
                      style={[styles.checkbox, item.done && styles.checkboxDone]}
                    >
                      {item.done ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete item"
                      onPress={() =>
                        askConfirm({
                          title: 'Remove from bucket?',
                          message: `“${item.title}” will be deleted.`,
                          confirmLabel: 'Delete',
                          destructive: true,
                          onConfirm: () => remove(item.id),
                        })
                      }
                      style={styles.trashBtn}
                    >
                      <Icon name="trash-2" size={16} color={colors.error} />
                    </Pressable>
                  </View>
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
            title: 'Discard this dream?',
            message: 'You have an unfinished adventure — it hasn’t been added yet.',
          })
        }
        title={editingId ? 'Edit dream' : 'New dream'}
      >
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Watch the northern lights" error={titleError ?? undefined} />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Details, wishes, plans…" multiline />
        <Text style={{ ...type.labelMd, color: colors.inkVariant, marginBottom: space.xs }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.lg }}>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} icon={c.icon} active={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </View>
        <Button label={editingId ? 'Save changes' : 'Add to our bucket list'} onPress={submit} />
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
  search: {
    marginTop: space.md,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: space.lg,
    height: 44,
    color: colors.charcoal,
    ...type.bodyMd,
  },
  adventureBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.lightMint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: border.widthThin,
    borderColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
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
});

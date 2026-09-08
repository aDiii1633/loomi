/** JOURNAL — editorial story archive: large visual entries, minimal metadata. */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, ErrorText, Input } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { Mascot } from '../src/components/illustrations/Mascot';
import { colors, radii, space, type, elevation, border } from '../src/theme/tokens';
import { useJournalStore, useMemoriesStore } from '../src/state/life';
import { resolveMediaMany as getMediaMany } from '../src/data/backend/mediaStorage';
import { pickMedia, captureMedia, type PickedMedia } from '../src/components/mediaPicker';
import { validateText } from '../src/domain/validation';
import { formatFriendlyLong } from '../src/domain/datetime';
import { toast } from '../src/components/toast';
import { confirmDiscard, haptic, useUIStore } from '../src/state/ui';
import { track } from '../src/services/analytics';
import { useDraftsStore } from '../src/state/drafts';
import { MOODS } from '../src/domain/moods';
import type { JournalEntry } from '../src/domain/types';

/** Alternating tints for entries without a photo — keeps the archive from feeling like flat text. */
const ENTRY_TINTS = [colors.primaryFixed, colors.tertiaryFixed];

export default function JournalScreen() {
  const router = useRouter();
  const { entries, loading, error, refresh, saveEntry, remove } = useJournalStore();
  const refreshMemories = useMemoriesStore((s) => s.refresh);
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [mood, setMood] = useState<string | undefined>();
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [errors, setErrors] = useState<{ title?: string; text?: string }>({});
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState('');

  const isDirty = JSON.stringify({ title, text, mood }) !== snapshot || media.length > 0;

  useEffect(() => {
    const { setDraft, clearDraft } = useDraftsStore.getState();
    if (sheetOpen && isDirty) {
      setDraft('journal', { label: title.trim() || 'Untitled entry', route: '/journal' });
    } else {
      clearDraft('journal');
    }
  }, [sheetOpen, isDirty, title]);

  useEffect(() => () => useDraftsStore.getState().clearDraft('journal'), []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshMemories();
    }, [refresh, refreshMemories])
  );

  const openSheet = (id?: string) => {
    const e = id ? entries.find((x) => x.id === id) : undefined;
    if (!id) track('journal_create_started');
    setEditingId(id);
    setTitle(e?.title ?? '');
    setText(e?.text ?? '');
    setMood(e?.moodEmoji);
    setMedia([]);
    setErrors({});
    setSnapshot(JSON.stringify({ title: e?.title ?? '', text: e?.text ?? '', mood: e?.moodEmoji }));
    setSheetOpen(true);
  };

  const submit = async () => {
    const t = validateText(title, 'journalTitle');
    if (!t.ok) return setErrors({ title: t.message });
    const b = validateText(text, 'journalText');
    if (!b.ok) return setErrors({ text: b.message });
    setSaving(true);
    try {
      await saveEntry({ id: editingId, title, text, moodEmoji: mood, mediaUris: media });
      setSheetOpen(false);
      haptic('success');
      toast('Entry saved', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the entry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Journal" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>Journal</Text>
            <Text style={styles.sub}>
              {entries.length === 0
                ? 'Letters between the two of us'
                : entries.length === 1
                  ? 'Your story has begun'
                  : `${entries.length} letters written together`}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openSheet()} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}

        <View style={{ marginTop: space.lg, gap: space.lg }}>
          {entries.length === 0 && !loading ? (
            <Card>
              <EmptyState
                icon="book"
                illustration="journal-writing-together"
                title="Write your first page"
                message="Write about today before it becomes a blurry yesterday."
                actionLabel="Write the first entry"
                onAction={() => openSheet()}
              />
            </Card>
          ) : (
            entries.map((e, i) => (
              <JournalEntryCard
                key={e.id}
                entry={e}
                tint={ENTRY_TINTS[i % ENTRY_TINTS.length]}
                onOpen={() => openSheet(e.id)}
                onDelete={() =>
                  askConfirm({
                    title: 'Delete entry?',
                    message: `"${e.title}" will be gone for good.`,
                    confirmLabel: 'Delete',
                    destructive: true,
                    onConfirm: () => remove(e.id),
                  })
                }
              />
            ))
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
            title: 'Discard this entry?',
            message: "Your journal entry hasn't been saved yet.",
          })
        }
        title={editingId ? 'Edit entry' : 'New entry'}
      >
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="The balcony morning" error={errors.title} />
        <Input label="Your words" value={text} onChangeText={setText} placeholder="Write softly…" multiline error={errors.text} />
        <Text style={{ ...type.labelMd, color: colors.inkVariant, marginBottom: space.xs }}>Mood</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md }}>
          <Chip label="None" active={!mood} onPress={() => setMood(undefined)} />
          {MOODS.slice(0, 8).map((m) => (
            <Chip key={m.emoji} label={`${m.emoji}`} active={mood === m.emoji} onPress={() => setMood(m.emoji)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Chip
            label={media.length ? `${media.length} attached` : 'Add photos'}
            icon="image"
            active={media.length > 0}
            onPress={async () => setMedia(await pickMedia({ allowsMultiple: true }))}
          />
          <Chip
            label="Camera"
            icon="camera"
            onPress={async () => {
              const one = await captureMedia();
              if (one) setMedia((m) => [...m, one]);
            }}
          />
        </View>
        <Button label={saving ? 'Saving…' : 'Save entry'} onPress={submit} loading={saving} />
      </BottomSheet>
    </View>
  );
}

/** One large editorial entry: photo (or a mood-tinted panel) up top, minimal text below. */
function JournalEntryCard({
  entry,
  tint,
  onOpen,
  onDelete,
}: {
  entry: JournalEntry;
  tint: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (entry.mediaIds.length > 0) {
      getMediaMany([entry.mediaIds[0]]).then((m) => {
        if (!cancelled && m[0]) setUri(m[0].uri);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [entry.mediaIds]);

  return (
    <Pressable onPress={onOpen} onLongPress={onOpen} delayLongPress={300} style={styles.entryCard}>
      <View style={[styles.entryVisual, !uri && { backgroundColor: tint }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Mascot variant={tint === ENTRY_TINTS[0] ? 'pao' : 'ly'} size={56} />
            {entry.moodEmoji ? <Text style={{ fontSize: 22, marginTop: 4 }}>{entry.moodEmoji}</Text> : null}
          </View>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Delete entry" onPress={onDelete} style={styles.entryDelete}>
          <Icon name="trash-2" size={15} color={colors.error} />
        </Pressable>
      </View>
      <View style={styles.entryBody}>
        <Text style={styles.entryDate}>{formatFriendlyLong(entry.createdAt)}</Text>
        <Text style={styles.entryTitle}>{entry.title}</Text>
        <Text numberOfLines={2} style={styles.entryPreview}>
          {entry.text}
        </Text>
      </View>
    </Pressable>
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
  entryCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    overflow: 'hidden',
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  entryVisual: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDelete: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.widthThin,
    borderColor: border.color,
    ...elevation.badge,
  },
  entryBody: { padding: space.lg },
  entryDate: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1 },
  entryTitle: { ...type.headlineSm, color: colors.charcoal, marginTop: 4 },
  entryPreview: { ...type.bodyMd, color: colors.inkVariant, marginTop: space.xs },
});

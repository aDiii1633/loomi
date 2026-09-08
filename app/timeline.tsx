/** TIMELINE — relationship moments in chronological order with media. */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BottomSheet, SubHeader } from '../src/components/chrome';
import { Button, Card, Chip, EmptyState, Input } from '../src/components/primitives';
import { Icon } from '../src/components/Icon';
import { colors, radii, space, type, border, elevation } from '../src/theme/tokens';
import { useTimelineStore } from '../src/state/life';
import { resolveMediaMany as getMediaMany } from '../src/data/backend/mediaStorage';
import { pickMedia, type PickedMedia } from '../src/components/mediaPicker';
import { validateDayISO, validateText } from '../src/domain/validation';
import { formatDayLabel } from '../src/domain/datetime';
import { toast } from '../src/components/toast';
import { haptic, useUIStore } from '../src/state/ui';

export default function TimelineScreen() {
  const router = useRouter();
  const { moments, refresh, saveMoment, remove } = useTimelineStore();
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateISOStr, setDateISOStr] = useState(new Date().toISOString().slice(0, 10));
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openSheet = (id?: string) => {
    const m = id ? moments.find((x) => x.id === id) : undefined;
    setEditingId(id);
    setTitle(m?.title ?? '');
    setDescription(m?.description ?? '');
    setDateISOStr(m?.dateISO ?? new Date().toISOString().slice(0, 10));
    setMedia([]);
    setErrors({});
    setSheetOpen(true);
  };

  const submit = async () => {
    const t = validateText(title, 'timelineTitle');
    if (!t.ok) return setErrors({ title: t.message });
    const d = validateDayISO(dateISOStr, { allowFuture: false, fieldName: 'Date' });
    if (!d.ok) return setErrors({ date: d.message });
    await saveMoment({ id: editingId, title, description, dateISO: dateISOStr, mediaUris: media });
    setSheetOpen(false);
    haptic('success');
    toast('Moment saved', 'success');
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Timeline" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.h1}>Our timeline</Text>
            <Text style={styles.sub}>{moments.length} moments, in order of the heart</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openSheet()} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {moments.length === 0 ? (
          <Card style={{ marginTop: space.lg }}>
            <EmptyState
              icon="book"
              title="Every story starts somewhere"
              message="Add the moment you first met — the timeline grows from there."
              actionLabel="Add a moment"
              onAction={() => openSheet()}
            />
          </Card>
        ) : (
          <View style={{ marginTop: space.lg, paddingLeft: space.md }}>
            <View style={styles.spine} />
            {moments.map((m) => (
              <View key={m.id} style={styles.momentRow}>
                <View style={styles.spineDot} />
                <Pressable
                  style={{ flex: 1 }}
                  onLongPress={() => openSheet(m.id)}
                  delayLongPress={300}
                >
                  <Card padding="compact">
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ ...type.labelLg, color: colors.charcoal, flex: 1 }}>{m.title}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete moment"
                        onPress={() =>
                          askConfirm({
                            title: 'Delete moment?',
                            message: `“${m.title}” will be removed from the timeline.`,
                            confirmLabel: 'Delete',
                            destructive: true,
                            onConfirm: () => remove(m.id),
                          })
                        }
                      >
                        <Icon name="trash-2" size={15} color={colors.error} />
                      </Pressable>
                    </View>
                    <Text style={{ ...type.labelCaps, color: colors.tertiary, marginTop: 2 }}>{formatDayLabel(m.dateISO)}</Text>
                    {m.description ? (
                      <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: space.xs }}>{m.description}</Text>
                    ) : null}
                    {m.mediaIds.length > 0 ? (
                      <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.sm }}>
                        {m.mediaIds.slice(0, 3).map((id) => (
                          <MomentThumb key={id} mediaId={id} />
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 140 }} />
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={editingId ? 'Edit moment' : 'New moment'}>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="First hello" error={errors.title} />
        <Input label="What happened (optional)" value={description} onChangeText={setDescription} placeholder="The story, briefly…" multiline />
        <Input
          label="When (YYYY-MM-DD)"
          value={dateISOStr}
          onChangeText={setDateISOStr}
          placeholder="2022-06-14"
          error={errors.date}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Chip label={media.length ? `${media.length} attached` : 'Attach photos'} icon="image" active={media.length > 0} onPress={async () => setMedia(await pickMedia({ allowsMultiple: true }))} />
        </View>
        <Button label="Save moment" onPress={submit} />
      </BottomSheet>
    </View>
  );
}

function MomentThumb({ mediaId }: { mediaId: string }) {
  const [uri, setUri] = useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    getMediaMany([mediaId]).then((m) => {
      if (!cancelled && m[0]) setUri(m[0].uri);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);
  if (!uri) return <View style={styles.thumb} />;
  return <Image source={{ uri }} style={styles.thumb} contentFit="cover" transition={150} />;
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
  spine: { position: 'absolute', left: 6, top: 8, bottom: 8, width: 2, borderRadius: 1, backgroundColor: colors.surfaceContainerHighest },
  spineDot: {
    position: 'absolute',
    left: -space.md + 2,
    top: 18,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primaryContainer,
  },
  momentRow: { paddingLeft: space.md, marginBottom: space.md },
  thumb: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.lightMint, borderWidth: border.widthThin, borderColor: border.color },
});

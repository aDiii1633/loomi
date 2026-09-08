/** MEMORIES — gallery of saved moments with favorite + detail. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { BottomSheet, useSafeTopInset } from '../../src/components/chrome';
import { Button, Card, Chip, EmptyState, ErrorText, Input, SkeletonCard } from '../../src/components/primitives';
import { Icon } from '../../src/components/Icon';
import { border, colors, elevation, fontWeightFamily, radii, space, type } from '../../src/theme/tokens';
import { useMemoriesStore } from '../../src/state/life';
import { getMediaMany } from '../../src/data/media';
import { pickMedia, captureMedia, type PickedMedia } from '../../src/components/mediaPicker';
import { validateText } from '../../src/domain/validation';
import { dayISO, formatDayLabel } from '../../src/domain/datetime';
import { toast } from '../../src/components/toast';
import { confirmDiscard, haptic } from '../../src/state/ui';
import { track } from '../../src/services/analytics';
import { useDraftsStore } from '../../src/state/drafts';

type MemoryFilter = 'all' | 'month' | 'favorites';

export default function MemoriesScreen() {
  const router = useRouter();
  const { memories, loading, error, refresh, addMemory } = useMemoriesStore();
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [picked, setPicked] = useState<PickedMedia[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openSheet = () => {
    track('memory_create_started');
    setTitle('');
    setCaption('');
    setPlace('');
    setPicked([]);
    setTitleError(null);
    setSheetOpen(true);
  };

  const save = async () => {
    const v = validateText(title, 'memoryTitle');
    if (!v.ok) {
      setTitleError(v.message);
      return;
    }
    if (picked.length === 0) {
      toast('Add at least one photo or video.', 'error');
      return;
    }
    setSaving(true);
    try {
      await addMemory({ title, caption, place, takenAtISO: dayISO(), mediaUris: picked });
      setSheetOpen(false);
      toast('Memory saved', 'success');
      haptic('success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the memory.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const topInset = useSafeTopInset(space.lg);

  const isDirty = title.trim().length > 0 || caption.trim().length > 0 || place.trim().length > 0 || picked.length > 0;

  useEffect(() => {
    const { setDraft, clearDraft } = useDraftsStore.getState();
    if (sheetOpen && isDirty) {
      setDraft('memory', { label: title.trim() || 'Untitled memory', route: '/memories' });
    } else {
      clearDraft('memory');
    }
  }, [sheetOpen, isDirty, title]);

  useEffect(() => () => useDraftsStore.getState().clearDraft('memory'), []);

  const thisMonth = dayISO().slice(0, 7);
  const monthCount = memories.filter((m) => m.takenAtISO.slice(0, 7) === thisMonth).length;
  const favoriteCount = memories.filter((m) => m.favorite).length;
  const featured = filter === 'all' ? memories[0] : undefined;
  const visible = useMemo(() => {
    if (filter === 'month') return memories.filter((m) => m.takenAtISO.slice(0, 7) === thisMonth);
    if (filter === 'favorites') return memories.filter((m) => m.favorite);
    return memories.slice(1);
  }, [memories, filter, thisMonth]);

  return (
    <View style={styles.root}>
      <FlatList
        data={visible}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.sm, paddingHorizontal: space.screenEdge }}
        ListHeaderComponent={
          <View style={{ paddingTop: topInset, paddingHorizontal: space.screenEdge, paddingBottom: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={styles.h1}>Memories</Text>
                <Text style={styles.sub}>{memories.length} moments kept for us</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Add memory" onPress={openSheet} style={styles.addBtn}>
                <Icon name="plus" size={22} color={colors.primary} />
              </Pressable>
            </View>
            {memories.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md }}>
                <Chip label={`All · ${memories.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
                <Chip label={`This month · ${monthCount}`} active={filter === 'month'} onPress={() => setFilter('month')} />
                <Chip label={`Favorites · ${favoriteCount}`} active={filter === 'favorites'} onPress={() => setFilter('favorites')} />
              </View>
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            {featured ? (
              <Pressable
                style={styles.featured}
                onPress={() => router.push({ pathname: '/memory/[memoryId]', params: { memoryId: featured.id } })}
              >
                <FeaturedCover memoryId={featured.id} />
                <View style={styles.featuredChip}>
                  <Text style={styles.featuredChipText} numberOfLines={1}>
                    {featured.title}
                    {featured.place ? ` · ${featured.place}` : ''} · {formatDayLabel(featured.takenAtISO)}
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {visible.length > 0 ? <Text style={styles.section}>{featured ? 'RECENT' : 'ALL'}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: space.screenEdge }}>
              <SkeletonCard height={160} />
              <SkeletonCard height={160} />
            </View>
          ) : (
            <View style={{ paddingHorizontal: space.screenEdge }}>
              <Card>
                {memories.length === 0 ? (
                  <EmptyState
                    icon="image"
                    illustration="memories-viewing-photos"
                    title="Your story starts here"
                    message="Save a photo, a place, and the story. It all starts with one."
                    actionLabel="Add your first memory"
                    onAction={openSheet}
                  />
                ) : (
                  <EmptyState
                    icon="image"
                    title="Nothing here yet"
                    message={filter === 'favorites' ? 'Star a memory to see it here.' : 'No memories saved this month yet.'}
                  />
                )}
              </Card>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/memory/[memoryId]', params: { memoryId: item.id } })}
            style={styles.tile}
          >
            <MemoryTileCover memoryId={item.id} favorite={item.favorite} likeCount={item.likeCount} />
            <Text numberOfLines={1} style={styles.tileTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.tileMeta}>
              {formatDayLabel(item.takenAtISO)}
              {item.place ? ` · ${item.place}` : ''}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 140 }}
      />

      <BottomSheet
        visible={sheetOpen}
        onClose={() =>
          confirmDiscard({
            isDirty,
            onDiscard: () => setSheetOpen(false),
            title: 'Discard this memory?',
            message: "This memory hasn't been saved yet.",
          })
        }
        title="New memory"
      >
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Morning balcony in Colaba" error={titleError ?? undefined} />
        <Input label="Caption (optional)" value={caption} onChangeText={setCaption} placeholder="What made it special?" multiline />
        <Input label="Place (optional)" value={place} onChangeText={setPlace} placeholder="Where was this?" />
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Chip
            label={picked.length ? `${picked.length} selected` : 'Pick from library'}
            icon="image"
            active={picked.length > 0}
            onPress={async () => setPicked(await pickMedia({ allowsMultiple: true }))}
          />
          <Chip
            label="Camera"
            icon="camera"
            onPress={async () => {
              const one = await captureMedia();
              if (one) setPicked((p) => [...p, one]);
            }}
          />
        </View>
        {picked.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md }}>
            {picked.map((m, i) => (
              <Image key={i} source={{ uri: m.uri }} style={{ width: 64, height: 64, borderRadius: radii.md }} contentFit="cover" transition={150} />
            ))}
          </View>
        ) : null}
        <Button label={saving ? 'Saving…' : 'Save memory'} onPress={save} disabled={saving} loading={saving} />
      </BottomSheet>
    </View>
  );
}

function FeaturedCover({ memoryId }: { memoryId: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const memory = useMemoriesStore.getState().memories.find((m) => m.id === memoryId);
      if (!memory || memory.mediaIds.length === 0) return;
      const media = await getMediaMany(memory.mediaIds);
      if (!cancelled && media[0]) setUri(media[0].uri);
    })();
    return () => {
      cancelled = true;
    };
  }, [memoryId]);
  return (
    <View style={styles.featuredCover}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={250} /> : null}
    </View>
  );
}

function MemoryTileCover({ memoryId, favorite, likeCount }: { memoryId: string; favorite: boolean; likeCount: number }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const memory = useMemoriesStore.getState().memories.find((m) => m.id === memoryId);
      if (!memory || memory.mediaIds.length === 0) return;
      const media = await getMediaMany(memory.mediaIds);
      if (!cancelled && media[0]) setUri(media[0].uri);
    })();
    return () => {
      cancelled = true;
    };
  }, [memoryId]);

  return (
    <View style={styles.tileCover}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill as never} contentFit="cover" transition={250} />
      ) : null}
      {favorite ? (
        <View style={styles.favBadge}>
          <Icon name="star" size={12} color={colors.primary} />
        </View>
      ) : (
        <View style={[styles.favBadge, { backgroundColor: 'rgba(255,255,255,0.85)' }]}>
          <Icon name="heart" size={12} color={colors.primary} />
          <Text style={{ color: colors.charcoal, fontSize: 9, marginLeft: 2, fontFamily: fontWeightFamily['700'] }}>{likeCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  h1: { ...type.headlineLg, color: colors.charcoal },
  sub: { ...type.bodySm, color: colors.inkVariant, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.badge,
  },
  featured: {
    marginTop: space.lg,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
  },
  featuredCover: { width: '100%', aspectRatio: 16 / 10 },
  featuredChip: {
    position: 'absolute',
    bottom: space.md,
    left: space.md,
    right: space.md,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    borderRadius: radii.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    ...elevation.badge,
  },
  featuredChipText: { ...type.labelMd, color: colors.charcoal },
  section: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.2, marginTop: space.lg },
  tile: { flex: 1, marginBottom: space.md },
  tileCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: border.width,
    borderColor: border.color,
    marginBottom: space.xs,
    ...elevation.badge,
  },
  favBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  tileTitle: { ...type.labelLg, color: colors.charcoal, paddingHorizontal: 2 },
  tileMeta: { ...type.bodySm, color: colors.inkVariant, paddingHorizontal: 2 },
});

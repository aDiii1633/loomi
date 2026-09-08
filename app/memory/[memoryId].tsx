/** MEMORY DETAIL — hero media, caption, place, favorite, delete. */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SubHeader } from '../../src/components/chrome';
import { Button, Card, EmptyState, SkeletonCard } from '../../src/components/primitives';
import { Icon } from '../../src/components/Icon';
import { colors, radii, space, type, border, elevation } from '../../src/theme/tokens';
import { useMemoriesStore } from '../../src/state/life';
import { getMediaMany, type MediaRecord } from '../../src/data/media';
import { formatFriendlyLong } from '../../src/domain/datetime';
import { useUIStore } from '../../src/state/ui';

export default function MemoryDetailScreen() {
  const router = useRouter();
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  const memories = useMemoriesStore((s) => s.memories);
  const refresh = useMemoriesStore((s) => s.refresh);
  const like = useMemoriesStore((s) => s.like);
  const toggleFavorite = useMemoriesStore((s) => s.toggleFavorite);
  const askConfirm = useUIStore((s) => s.askConfirm);
  const [media, setMedia] = useState<MediaRecord[] | null>(null);

  const memory = memories.find((m) => m.id === memoryId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!memory) {
        await refresh();
        return;
      }
      const m = await getMediaMany(memory.mediaIds);
      if (!cancelled) setMedia(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, refresh]);

  if (!memory) {
    return (
      <View style={styles.root}>
        <SubHeader title="Memory" onBack={() => router.back()} />
        <Card padding="default">
          <EmptyState icon="image" title="Memory not found" message="It may have been deleted." />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader title={memory.title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {media === null ? (
          <SkeletonCard height={300} />
        ) : media.length === 0 ? (
          <Card padding="default" style={{ alignItems: 'center', paddingVertical: space['2xl'] }}>
            <Icon name="image" size={36} color={colors.primary} />
            <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: space.sm }}>No media attached</Text>
          </Card>
        ) : (
          <View style={{ gap: space.sm }}>
            {media.map((m) =>
              m.kind === 'video' ? (
                <Card key={m.id} padding="compact">
                  <Text style={{ ...type.bodySm, color: colors.inkVariant }}>Video saved in app storage.</Text>
                </Card>
              ) : (
                <Image
                  key={m.id}
                  source={{ uri: m.uri }}
                  style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radii.xl, backgroundColor: colors.lightMint, borderWidth: border.width, borderColor: border.color, ...elevation.card }}
                  contentFit="cover"
                  transition={250}
                  recyclingKey={m.id}
                />
              )
            )}
          </View>
        )}

        <Card padding="default" style={{ marginTop: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.labelCaps, color: colors.tertiary }}>
                {formatFriendlyLong(new Date(`${memory.takenAtISO}T09:00:00`).getTime()).toUpperCase()}
              </Text>
              <Text style={{ ...type.headlineMd, color: colors.charcoal, marginTop: 2 }}>{memory.title}</Text>
              {memory.place ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Icon name="map-pin" size={13} color={colors.primary} />
                  <Text style={{ ...type.bodySm, color: colors.inkVariant }}>{memory.place}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <Icon name="heart" size={18} color={memory.likedBySelf ? colors.accent : colors.outlineVariant} />
              <Text style={{ ...type.labelMd, color: colors.charcoal }}>{memory.likeCount}</Text>
            </View>
          </View>
          {memory.caption ? (
            <Text style={{ ...type.bodyMd, color: colors.charcoal, marginTop: space.md }}>{memory.caption}</Text>
          ) : null}
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <Button
              label={memory.likedBySelf ? 'Liked' : 'Like this memory'}
              variant="secondary"
              icon="heart"
              onPress={() => like(memory.id)}
            />
            <Button
              label={memory.favorite ? 'Remove favorite' : 'Mark favorite'}
              variant="ghost"
              icon="star"
              onPress={() => toggleFavorite(memory.id)}
            />
            <Button
              label="Delete memory"
              variant="ghost"
              icon="trash-2"
              onPress={() =>
                askConfirm({
                  title: 'Delete memory?',
                  message: `“${memory.title}” and its media will be removed.`,
                  confirmLabel: 'Delete',
                  destructive: true,
                  onConfirm: () => {
                    useMemoriesStore.getState().remove(memory.id).then(() => router.back());
                  },
                })
              }
            />
          </View>
        </Card>
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
});

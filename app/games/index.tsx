/** GAMES catalog — one large featured game + a compact library below. */
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SubHeader } from '../../src/components/chrome';
import { EmptyState } from '../../src/components/primitives';
import { Icon, resolveIcon } from '../../src/components/Icon';
import { colors, radii, space, type, border, elevation } from '../../src/theme/tokens';
import { GAMES } from '../../src/domain/games';
import { useGamesStore } from '../../src/state/activities';
import { useSessionStore } from '../../src/state/session';

export default function GamesScreen() {
  const router = useRouter();
  const { sessions, refresh } = useGamesStore();
  const partnerName = useSessionStore((s) => s.partner?.name) ?? 'your partner';

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const [featured, ...rest] = GAMES;
  const featuredHistory = sessions.filter((s) => s.gameId === featured.id && s.status === 'complete')[0];

  return (
    <View style={styles.root}>
      <SubHeader title="Games" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Play together</Text>
        <Text style={styles.sub}>Pick a game — you play, {partnerName} plays along.</Text>

        {/* Featured — one large color-blocked hero */}
        <Pressable
          style={styles.featured}
          onPress={() => router.push({ pathname: '/games/[gameId]', params: { gameId: featured.id } })}
        >
          <View style={styles.featuredIcon}>
            <Icon name={resolveIcon(featured.icon)} size={44} color={colors.charcoal} />
          </View>
          <Text style={styles.featuredTag}>RECOMMENDED TONIGHT</Text>
          <Text style={styles.featuredTitle}>{featured.title}</Text>
          <Text style={styles.featuredTagline}>{featured.tagline}</Text>
          {featuredHistory?.result ? (
            <Text style={styles.featuredLast}>Last: {featuredHistory.result.summary}</Text>
          ) : null}
          <View style={styles.featuredBtn}>
            <Text style={{ ...type.labelLg, color: colors.charcoal }}>Play now</Text>
          </View>
        </Pressable>

        {/* The rest — compact library rows */}
        <Text style={styles.section}>MORE GAMES</Text>
        <View style={{ gap: space.sm }}>
          {rest.map((g) => {
            const last = sessions.filter((s) => s.gameId === g.id && s.status === 'complete')[0];
            return (
              <Pressable
                key={g.id}
                style={styles.row}
                onPress={() => router.push({ pathname: '/games/[gameId]', params: { gameId: g.id } })}
              >
                <View style={styles.rowIcon}>
                  <Icon name={resolveIcon(g.icon)} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.labelLg, color: colors.charcoal }}>{g.title}</Text>
                  <Text style={{ ...type.bodySm, color: colors.inkVariant }} numberOfLines={1}>
                    {last?.result ? `Last: ${last.result.summary}` : g.tagline}
                  </Text>
                </View>
                <View style={styles.playChip}>
                  <Text style={{ ...type.labelMd, color: colors.charcoal }}>Play</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {sessions.filter((s) => s.status === 'complete').length === 0 ? (
          <View style={{ marginTop: space.lg }}>
            <EmptyState icon="trophy" illustration="games-video-game" title="Ready to play?" message="Finish your first round and it lands in your history." />
          </View>
        ) : null}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 120 },
  h1: { ...type.headlineLg, color: colors.charcoal },
  sub: { ...type.bodySm, color: colors.inkVariant, marginTop: 2 },
  featured: {
    marginTop: space.lg,
    backgroundColor: colors.tertiaryContainer,
    borderRadius: radii.xl,
    padding: space.xl,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.raised,
  },
  featuredIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  featuredTag: { ...type.labelCaps, color: colors.charcoal, letterSpacing: 1.5, opacity: 0.75 },
  featuredTitle: { ...type.displayLgMobile, color: colors.charcoal, marginTop: 4 },
  featuredTagline: { ...type.bodyMd, color: colors.charcoal, opacity: 0.85, marginTop: space.xs },
  featuredLast: { ...type.labelMd, color: colors.charcoal, marginTop: space.sm },
  featuredBtn: {
    marginTop: space.lg,
    alignSelf: 'flex-start',
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radii.pill,
    ...elevation.badge,
  },
  section: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.2, marginTop: space.xl, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: border.width,
    borderColor: border.color,
    padding: space.cardPaddingCompact,
    ...elevation.card,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playChip: {
    backgroundColor: colors.primaryFixed,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radii.pill,
  },
});

/**
 * SHOP — spend streak points on Pao & Ly illustrations. Full page (not a
 * modal). The server decides every purchase (migration 0006): this screen
 * just shows state and forwards taps.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SubHeader } from '../src/components/chrome';
import { Card } from '../src/components/primitives';
import { LoomiIllustration } from '../src/components/illustrations/LoomiIllustration';
import type { IllustrationKey } from '../src/components/illustrations/registry';
import { Icon } from '../src/components/Icon';
import { toast } from '../src/components/toast';
import { useRewardsStore } from '../src/state/rewards';
import { border, colors, radii, space, type } from '../src/theme/tokens';

export default function ShopScreen() {
  const router = useRouter();
  const { points, catalog, owned, equipped, refresh, purchase, equip } = useRewardsStore();
  const [pending, setPending] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onBuy = async (id: string, price: number) => {
    if (points < price) {
      toast("You don't have enough points yet.", 'error');
      return;
    }
    setPending(id);
    const res = await purchase(id);
    setPending(null);
    toast(res.ok ? 'Unlocked!' : res.reason ?? 'Could not buy that.', res.ok ? 'success' : 'error');
  };

  const onEquip = async (id: string) => {
    setPending(id);
    const ok = await equip(id);
    setPending(null);
    if (ok) toast('Equipped', 'success');
    else toast('Could not equip that.', 'error');
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Illustration shop" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padding="compact" style={styles.balanceCard}>
          <Icon name="star" size={18} color={colors.primary} />
          <Text style={{ ...type.labelLg, color: colors.charcoal }}>{points} points</Text>
          <Text style={{ ...type.bodySm, color: colors.inkVariant, marginLeft: 'auto' }}>
            +10 each per streak day
          </Text>
        </Card>

        <View style={styles.grid}>
          {catalog.map((item) => {
            const isOwned = item.price === 0 || owned.includes(item.id);
            const isEquipped = equipped === item.id;
            const canAfford = points >= item.price;
            const label = isEquipped
              ? 'Equipped'
              : isOwned
                ? 'Equip'
                : item.price === 0
                  ? 'Free'
                  : `${item.price} pts`;
            const onPress = () => {
              if (pending) return;
              if (isEquipped) return;
              if (isOwned) return onEquip(item.id);
              return onBuy(item.id, item.price);
            };
            return (
              <View key={item.id} style={styles.cell}>
                <View style={[styles.art, !isOwned && !canAfford && styles.artLocked]}>
                  <LoomiIllustration asset={item.id as IllustrationKey} size={92} />
                  {!isOwned ? (
                    <View style={styles.lockBadge}>
                      <Icon name="lock" size={12} color={colors.charcoal} />
                    </View>
                  ) : null}
                </View>
                <Text style={{ ...type.labelMd, color: colors.charcoal }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Pressable
                  onPress={onPress}
                  disabled={isEquipped || pending === item.id}
                  style={[
                    styles.action,
                    isEquipped && styles.actionEquipped,
                    !isOwned && !canAfford && styles.actionDisabled,
                  ]}
                >
                  <Text style={{ ...type.labelMd, color: colors.charcoal }}>
                    {pending === item.id ? '…' : label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  balanceCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  cell: { width: '47%', gap: 6 },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artLocked: { opacity: 0.55 },
  lockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    paddingVertical: 8,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  actionEquipped: { backgroundColor: colors.lightMint },
  actionDisabled: { opacity: 0.5 },
});

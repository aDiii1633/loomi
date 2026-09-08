import React, { useCallback } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { colors } from '../../src/theme/tokens';
import { isDevBypass } from '../../src/auth/devBypass';
import { glyphs, Icon, type IconName } from '../../src/components/Icon';
import { FloatingTabDock } from '../../src/components/chrome';
import { useSessionStore } from '../../src/state/session';
import { useCoupleRealtime, type SyncTable } from '../../src/data/backend/realtime';
import { pullSince } from '../../src/data/backend/sync';
import { useChatStore } from '../../src/state/chat';
import { useConnectionStore } from '../../src/state/connection';
import {
  useMemoriesStore, useJournalStore, useTimelineStore, useVaultStore,
  useBucketStore, useGoalsStore, useRemindersStore, useDatesStore,
} from '../../src/state/life';
import { useChallengesStore } from '../../src/state/activities';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: glyphs.home },
  { name: 'together', label: 'Together', icon: glyphs.together },
  { name: 'chat', label: 'Chat', icon: glyphs.chat },
  { name: 'memories', label: 'Memories', icon: glyphs.memories },
  { name: 'profile', label: 'Profile', icon: glyphs.profile },
];

function DockTabBar({ state, navigation }: BottomTabBarProps) {
  const active = state.routes[state.index]?.name ?? 'index';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <FloatingTabDock tabs={TABS} activeName={active} onSelect={(name) => navigation.navigate(name as never)} />
    </View>
  );
}

export default function TabsLayout() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const coupleId = useSessionStore((s) => s.couple?.id ?? null);
  const bypass = isDevBypass();

  // Realtime: partner writes land in Supabase → postgres_changes fires → the
  // changed table is pulled into the local cache and its store refreshes.
  // One channel per tab surface lifetime; removed on unmount.
  const handleTableChange = useCallback(
    (table: SyncTable) => {
      if (!coupleId) return;
      const pullThenRefresh = (refresh: () => Promise<void>) => {
        void pullSince(table, coupleId).then(() => refresh());
      };
      switch (table) {
        case 'messages':
          pullThenRefresh(() => useChatStore.getState().refresh());
          break;
        case 'moods':
        case 'question_answers':
          pullThenRefresh(() => useConnectionStore.getState().refresh());
          break;
        case 'bucket_items':
          pullThenRefresh(() => useBucketStore.getState().refresh());
          break;
        case 'goals':
          pullThenRefresh(() => useGoalsStore.getState().refresh());
          break;
        case 'reminders':
          pullThenRefresh(() => useRemindersStore.getState().refresh());
          break;
        case 'important_dates':
          pullThenRefresh(() => useDatesStore.getState().refresh());
          break;
        case 'journal_entries':
          pullThenRefresh(() => useJournalStore.getState().refresh());
          break;
        case 'memories':
          pullThenRefresh(() => useMemoriesStore.getState().refresh());
          break;
        case 'timeline_moments':
          pullThenRefresh(() => useTimelineStore.getState().refresh());
          break;
        case 'vault_items':
          pullThenRefresh(() => useVaultStore.getState().refresh());
          break;
        case 'challenge_progress':
          pullThenRefresh(() => useChallengesStore.getState().refresh());
          break;
      }
    },
    [coupleId]
  );

  useCoupleRealtime(coupleId, handleTableChange);

  // App-group guard. Runs only while the tabs are actually mounted, so it
  // never interferes with the sign-in / sign-up flow (which happens in the
  // (auth) group). `bypass` keeps local dev on the seeded demo couple.
  if (!bypass && authLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  // A signed-in user with no couple is NOT gated out — they enter the app and
  // see Home's "connect with your partner" flow, with every other feature
  // shown locked until they link. See app/(tabs)/index.tsx + LockedScreen.

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }}
      tabBar={(props: BottomTabBarProps) => <DockTabBar {...props} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarIcon: ({ color }: { color: string }) => <Icon name={t.icon} size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}

/**
 * Bootstrap: prepare the local database. Called exactly once from the root
 * layout.
 *
 * The demo seed (Aditya & Maya) exists ONLY for the __DEV__ bypass that lets
 * development run without signing in on every reload. A production build
 * must never contain seeded rows: a fresh real user gets real empty states.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../data/db';
import { seedDemoData } from '../data/seed';

const BOOT_KEY = 'twofold.boot.v1';

// Guards against a genuine, observed race: the root layout's boot effect can
// fire twice in quick succession (Clerk's isSignedIn/user settling a render
// after isLoaded flips true). Without this, two concurrent bootstrapApp()
// calls both see "not yet seeded" and both run seedDemoData() — two large
// SQLite write transactions serialize on the same connection, and the
// second one blocks long enough to trip the caller's boot timeout. Mirrors
// the same in-flight-promise pattern getDb() already uses.
let bootstrapPromise: Promise<void> | null = null;

export function bootstrapApp(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const db = await getDb();
      if (!__DEV__) return; // production: local cache starts empty, always
      const alreadySeeded = await AsyncStorage.getItem(BOOT_KEY);
      const meta = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM messages');
      if ((meta?.c ?? 0) === 0 && !alreadySeeded) {
        await seedDemoData();
        await AsyncStorage.setItem(BOOT_KEY, '1');
      }
    })();
  }
  return bootstrapPromise;
}

/** DEV ONLY: wipe everything and re-seed. */
export async function resetDemoData(): Promise<void> {
  if (!__DEV__) return;
  const { wipeDatabase } = await import('../data/db');
  await wipeDatabase();
  await AsyncStorage.removeItem(BOOT_KEY);
  await seedDemoData();
  await AsyncStorage.setItem(BOOT_KEY, '1');
}

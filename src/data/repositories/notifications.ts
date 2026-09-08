/**
 * Centralized notification abstraction.
 *
 * Today: in-app notification center backed by SQLite, plus (when the platform
 * allows it in the current environment) local scheduled notifications for
 * reminders and the daily question.
 *
 * A future backend replaces the `schedule*` internals with push — screens and
 * stores never call platform APIs directly, only this module.
 */
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AppNotification } from '../../domain/types';
import { getDb } from '../db';
import { newId } from '../media';
import { loadSettings } from './couple';

const MAX_NOTIFICATIONS = 100;

/* ----------------------------- in-app center ------------------------------ */

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; kind: AppNotification['kind']; title: string; body: string; created_at: number; read: number; route: string | null }>(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    read: !!r.read,
    route: r.route ?? undefined,
  }));
}

export async function pushLocal(n: Omit<AppNotification, 'read'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO notifications (id, kind, title, body, created_at, read, route) VALUES (?,?,?,?,?,?,?)',
    [n.id, n.kind, n.title, n.body, n.createdAt, 0, n.route ?? null]
  );
  await db.runAsync(
    `DELETE FROM notifications WHERE id NOT IN (
       SELECT id FROM notifications ORDER BY created_at DESC LIMIT ?
     )`,
    [MAX_NOTIFICATIONS]
  );
}

export async function markAllRead(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notifications SET read = 1 WHERE read = 0');
}

export async function unreadCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM notifications WHERE read = 0');
  return row?.c ?? 0;
}

/* ------------------------ platform scheduling layer ----------------------- */

export async function platformSupportsScheduling(): Promise<boolean> {
  // Expo Go on Android no longer supports expo-notifications scheduling.
  return Platform.OS === 'ios';
}

export async function scheduleReminderNotification(params: {
  id: string;
  title: string;
  body: string;
  atMs: number;
}): Promise<boolean> {
  if (!(await platformSupportsScheduling())) return false;
  if (!(await ensurePermission())) return false;
  // Pass our own id as the identifier so cancelReminderNotification(id) can match.
  await ExpoNotifications.scheduleNotificationAsync({
    identifier: params.id,
    content: { title: params.title, body: params.body, sound: true },
    trigger: { type: ExpoNotifications.SchedulableTriggerInputTypes.DATE, date: params.atMs } as ExpoNotifications.DateTriggerInput,
  });
  return true;
}

export async function cancelReminderNotification(id: string): Promise<void> {
  await ExpoNotifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

export async function ensurePermission(): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings.notificationsEnabled) return false;
  const current = await ExpoNotifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await ExpoNotifications.requestPermissionsAsync();
  return asked.granted;
}

export function makeNotificationId(): string {
  return newId('notif');
}

export { ExpoNotifications };

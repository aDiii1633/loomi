/**
 * Planning domain: bucket list, goals, reminders and important dates.
 */
import type {
  BucketCategory, BucketItem, Goal, GoalMilestone, ImportantDate, Reminder,
} from '../../domain/types';
import { getDb, safeJsonParse } from '../db';

/* ------------------------------ bucket list ------------------------------- */

interface BucketRow {
  id: string; couple_id: string; title: string; category: BucketCategory; notes: string | null;
  done: number; done_at_iso: string | null; created_at: number; sync: BucketItem['sync']; updated_at: number;
}

const bucketRow = (r: BucketRow): BucketItem => ({
  id: r.id, coupleId: r.couple_id, title: r.title, category: r.category, notes: r.notes ?? undefined,
  done: !!r.done, doneAtISO: r.done_at_iso ?? undefined, createdAt: r.created_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listBucket(coupleId: string): Promise<BucketItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BucketRow>(
    'SELECT * FROM bucket_items WHERE couple_id = ? ORDER BY done ASC, created_at DESC',
    [coupleId]
  );
  return rows.map(bucketRow);
}

export async function upsertBucket(item: Omit<BucketItem, 'sync' | 'updatedAt'>): Promise<BucketItem> {
  const db = await getDb();
  const full: BucketItem = { ...item, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO bucket_items (id, couple_id, title, category, notes, done, done_at_iso, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, full.category, full.notes ?? null, full.done ? 1 : 0, full.doneAtISO ?? null, full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteBucket(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bucket_items WHERE id = ?', [id]);
}

/* --------------------------------- goals ---------------------------------- */

interface GoalRow {
  id: string; couple_id: string; title: string; target: number; current: number; unit: string;
  due_iso: string | null; milestones: string; done: number; created_at: number;
  sync: Goal['sync']; updated_at: number;
}

const goalRow = (r: GoalRow): Goal => ({
  id: r.id, coupleId: r.couple_id, title: r.title, target: r.target, current: r.current,
  unit: r.unit, dueISO: r.due_iso ?? undefined,
  milestones: safeJsonParse<GoalMilestone[]>(r.milestones, []),
  done: !!r.done, createdAt: r.created_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listGoals(coupleId: string): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GoalRow>(
    'SELECT * FROM goals WHERE couple_id = ? ORDER BY done ASC, created_at DESC',
    [coupleId]
  );
  return rows.map(goalRow);
}

export async function upsertGoal(g: Omit<Goal, 'sync' | 'updatedAt'>): Promise<Goal> {
  const db = await getDb();
  const full: Goal = { ...g, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO goals (id, couple_id, title, target, current, unit, due_iso, milestones, done, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, full.target, full.current, full.unit, full.dueISO ?? null,
     JSON.stringify(full.milestones), full.done ? 1 : 0, full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

/* ------------------------------- reminders -------------------------------- */

interface ReminderRow {
  id: string; couple_id: string; title: string; notes: string | null; due_at: number;
  repeat: Reminder['repeat']; done: number; created_at: number; sync: Reminder['sync']; updated_at: number;
}

const reminderRow = (r: ReminderRow): Reminder => ({
  id: r.id, coupleId: r.couple_id, title: r.title, notes: r.notes ?? undefined, dueAt: r.due_at,
  repeat: r.repeat, done: !!r.done, createdAt: r.created_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listReminders(coupleId: string): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow>(
    'SELECT * FROM reminders WHERE couple_id = ? ORDER BY done ASC, due_at ASC',
    [coupleId]
  );
  return rows.map(reminderRow);
}

export async function upsertReminder(r: Omit<Reminder, 'sync' | 'updatedAt'>): Promise<Reminder> {
  const db = await getDb();
  const full: Reminder = { ...r, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders (id, couple_id, title, notes, due_at, repeat, done, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, full.notes ?? null, full.dueAt, full.repeat, full.done ? 1 : 0, full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
}

/* ----------------------------- important dates ---------------------------- */

interface DateRow {
  id: string; couple_id: string; title: string; date_iso: string; yearly: number;
  icon: string; sync: ImportantDate['sync']; updated_at: number;
}

export async function listDates(coupleId: string): Promise<ImportantDate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DateRow>(
    'SELECT * FROM important_dates WHERE couple_id = ? ORDER BY date_iso ASC',
    [coupleId]
  );
  return rows.map((r) => ({
    id: r.id, coupleId: r.couple_id, title: r.title, dateISO: r.date_iso,
    yearly: !!r.yearly, icon: r.icon, sync: r.sync, updatedAt: r.updated_at,
  }));
}

export async function upsertDate(d: Omit<ImportantDate, 'sync' | 'updatedAt'>): Promise<ImportantDate> {
  const db = await getDb();
  const full: ImportantDate = { ...d, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO important_dates (id, couple_id, title, date_iso, yearly, icon, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, full.dateISO, full.yearly ? 1 : 0, full.icon, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteDate(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM important_dates WHERE id = ?', [id]);
}

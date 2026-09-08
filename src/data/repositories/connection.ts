/**
 * Connection domain: daily questions, moods and the nightly ritual —
 * the qualifying activities that drive the streak engine.
 */
import type { CoupleId, MoodEntry, QuestionAnswer, UserId } from '../../domain/types';
import { getDb } from '../db';
import { dayISO } from '../../domain/datetime';

/* ------------------------------- questions -------------------------------- */

interface QARow {
  id: string; couple_id: string; question_id: string; day_iso: string;
  author_id: string; text: string; submitted_at: number; sync: QuestionAnswer['sync']; updated_at: number;
}

const qaRow = (r: QARow): QuestionAnswer => ({
  id: r.id, coupleId: r.couple_id, questionId: r.question_id, dayISO: r.day_iso,
  authorId: r.author_id, text: r.text, submittedAt: r.submitted_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listAnswersForDay(coupleId: string, day: string): Promise<QuestionAnswer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<QARow>(
    'SELECT * FROM question_answers WHERE couple_id = ? AND day_iso = ? ORDER BY submitted_at',
    [coupleId, day]
  );
  return rows.map(qaRow);
}

export async function listAnswersForDays(coupleId: string, days: string[]): Promise<QuestionAnswer[]> {
  if (days.length === 0) return [];
  const db = await getDb();
  const placeholders = days.map(() => '?').join(',');
  const rows = await db.getAllAsync<QARow>(
    `SELECT * FROM question_answers WHERE couple_id = ? AND day_iso IN (${placeholders}) ORDER BY submitted_at DESC`,
    [coupleId, ...days]
  );
  return rows.map(qaRow);
}

/** Question history for the "history" surface: latest N days that have answers. */
export async function listRecentAnswerDays(coupleId: string, limitDays = 30): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day_iso: string }>(
    `SELECT DISTINCT day_iso FROM question_answers WHERE couple_id = ? ORDER BY day_iso DESC LIMIT ?`,
    [coupleId, limitDays]
  );
  return rows.map((r) => r.day_iso);
}

export async function upsertAnswer(a: Omit<QuestionAnswer, 'sync' | 'updatedAt'>): Promise<QuestionAnswer> {
  const db = await getDb();
  // One answer per (couple, question, day, author) — the same invariant the
  // backend enforces with a UNIQUE constraint. Keying on that tuple instead
  // of the id keeps repeat submissions an update even though ids are uuids.
  const existing = await db.getFirstAsync<QARow>(
    'SELECT * FROM question_answers WHERE couple_id = ? AND question_id = ? AND day_iso = ? AND author_id = ?',
    [a.coupleId, a.questionId, a.dayISO, a.authorId]
  );
  const full: QuestionAnswer = {
    id: existing?.id ?? a.id,
    coupleId: a.coupleId, questionId: a.questionId, dayISO: a.dayISO,
    authorId: a.authorId, text: a.text, submittedAt: a.submittedAt, sync: 'synced', updatedAt: Date.now(),
  };
  await db.runAsync(
    `INSERT OR REPLACE INTO question_answers (id, couple_id, question_id, day_iso, author_id, text, submitted_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.questionId, full.dayISO, full.authorId, full.text, full.submittedAt, full.sync, full.updatedAt]
  );
  return full;
}

/* --------------------------------- moods ---------------------------------- */

interface MoodRow {
  id: string; couple_id: string; author_id: string; day_iso: string; emoji: string;
  label: string; note: string | null; created_at: number; sync: MoodEntry['sync']; updated_at: number;
}

const moodRow = (r: MoodRow): MoodEntry => ({
  id: r.id, coupleId: r.couple_id, authorId: r.author_id, dayISO: r.day_iso,
  emoji: r.emoji, label: r.label, note: r.note ?? undefined, createdAt: r.created_at,
  sync: r.sync, updatedAt: r.updated_at,
});

export async function listMoodsForDays(coupleId: string, days: string[]): Promise<MoodEntry[]> {
  if (days.length === 0) return [];
  const db = await getDb();
  const placeholders = days.map(() => '?').join(',');
  const rows = await db.getAllAsync<MoodRow>(
    `SELECT * FROM moods WHERE couple_id = ? AND day_iso IN (${placeholders}) ORDER BY created_at DESC`,
    [coupleId, ...days]
  );
  return rows.map(moodRow);
}

export async function listRecentMoodDays(coupleId: string, limitDays = 30): Promise<MoodEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MoodRow>(
    `SELECT * FROM moods WHERE couple_id = ? ORDER BY day_iso DESC LIMIT ?`,
    [coupleId, limitDays * 2]
  );
  return rows.map(moodRow);
}

export async function upsertMood(m: Omit<MoodEntry, 'sync' | 'updatedAt'>): Promise<MoodEntry> {
  const db = await getDb();
  const existing = await db.getFirstAsync<MoodRow>(
    'SELECT * FROM moods WHERE couple_id = ? AND author_id = ? AND day_iso = ?',
    [m.coupleId, m.authorId, m.dayISO]
  );
  const full: MoodEntry = {
    id: existing?.id ?? m.id,
    coupleId: m.coupleId, authorId: m.authorId, dayISO: m.dayISO,
    emoji: m.emoji, label: m.label, note: m.note,
    createdAt: m.createdAt, sync: 'synced', updatedAt: Date.now(),
  };
  await db.runAsync(
    `INSERT OR REPLACE INTO moods (id, couple_id, author_id, day_iso, emoji, label, note, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.authorId, full.dayISO, full.emoji, full.label, full.note ?? null, full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

/* --------------------------------- rituals -------------------------------- */

export interface RitualCompletion {
  id: string;
  authorId: UserId;
  dayISO: string;
  kind: 'voice_note' | 'text' | 'checkin';
  mediaId?: string;
  createdAt: number;
}

export async function listRitualDays(coupleId: string, limit = 60): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day_iso: string }>(
    `SELECT DISTINCT day_iso FROM ritual_completions WHERE couple_id = ? ORDER BY day_iso DESC LIMIT ?`,
    [coupleId, limit]
  );
  return rows.map((r) => r.day_iso);
}

export async function completeRitual(c: {
  coupleId: CoupleId;
  authorId: UserId;
  dayISO?: string;
  kind: RitualCompletion['kind'];
  mediaId?: string;
}): Promise<void> {
  const db = await getDb();
  const day = c.dayISO ?? dayISO();
  await db.runAsync(
    `INSERT INTO ritual_completions (id, couple_id, author_id, day_iso, kind, media_id, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [`ritual-${day}-${c.authorId}-${Date.now().toString(36)}`, c.coupleId, c.authorId, day, c.kind, c.mediaId ?? null, Date.now(), 'synced', Date.now()]
  );
}

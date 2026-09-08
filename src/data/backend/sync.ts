/**
 * Cloud sync: SQLite stays the local cache / optimistic layer, Supabase is
 * the source of truth. Two operations per table:
 *
 *  - pullSince: fetch rows changed since the last successful pull watermark
 *    (RLS scopes every read to the caller's couple) and merge them into
 *    SQLite with last-write-wins on updated_at.
 *  - pushDirty: upsert local rows touched since the last successful push
 *    watermark. Upserts are idempotent, so over-pushing after a crash is
 *    harmless; the watermark only advances over rows the server accepted.
 *
 * Deliberate v1 boundaries (honest, not hidden):
 *  - Media BYTES stay device-local (Supabase Storage policies aren't
 *    deployed yet). Rows referencing non-uuid local media ids are not
 *    pushed — text/voice/metadata syncs, photos don't yet.
 *  - Game sessions don't sync (complex per-player mapping, low traffic).
 * Every error is swallowed but counted — sync must never break a screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../db';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

type Remote = Record<string, unknown>;

export type SyncTable =
  | 'messages'
  | 'moods'
  | 'question_answers'
  | 'bucket_items'
  | 'goals'
  | 'reminders'
  | 'important_dates'
  | 'journal_entries'
  | 'memories'
  | 'timeline_moments'
  | 'vault_items'
  | 'challenge_progress'
  | 'ritual_completions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | null | undefined): boolean => !!v && UUID_RE.test(v);

const wmKey = (t: SyncTable) => `sync.wm.${t}`;
const asNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};
const ms = (iso: unknown, fallback = Date.now()): number => {
  const t = typeof iso === 'string' ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(t) ? t : fallback;
};

async function getWatermark(table: SyncTable): Promise<string> {
  const raw = await AsyncStorage.getItem(wmKey(table));
  return raw ?? '1970-01-01T00:00:00.000Z';
}

async function setWatermark(table: SyncTable, value: string): Promise<void> {
  await AsyncStorage.setItem(wmKey(table), value);
}

/* ------------------------------------------------------------------ */
/* Local readers (rows newer than a watermark)                        */
/* ------------------------------------------------------------------ */

interface DirtyRow {
  id: string;
  updatedAt: number;
  remote: Remote | null;
}

async function readDirtyMessages(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; author_id: string; kind: string; text: string | null;
    media_id: string | null; duration_ms: number | null; waveform: string | null;
    reply_to_id: string | null; reactions: string; sent_at: number; deleted_at: number | null;
    updated_at: number;
  }>(
    'SELECT * FROM messages WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id,
      couple_id: r.couple_id,
      author_id: r.author_id,
      kind: r.kind,
      body: r.text,
      media_id: isUuid(r.media_id) ? r.media_id : null,
      duration_ms: r.duration_ms,
      waveform: r.waveform ? JSON.parse(r.waveform) : null,
      reply_to_id: null,
      reactions: JSON.parse(r.reactions || '{}'),
      sent_at: new Date(r.sent_at).toISOString(),
      deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyMoods(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; author_id: string; day_iso: string; emoji: string;
    label: string; note: string | null; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM moods WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id, couple_id: r.couple_id, author_id: r.author_id,
      day_date: r.day_iso, emoji: r.emoji, label: r.label, note: r.note,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyAnswers(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; question_id: string; day_iso: string;
    author_id: string; text: string; submitted_at: number;
  }>(
    'SELECT * FROM question_answers WHERE couple_id = ? AND submitted_at > ? ORDER BY submitted_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.submitted_at,
    remote: {
      id: r.id, couple_id: r.couple_id, question_id: r.question_id,
      day_date: r.day_iso, author_id: r.author_id, body: r.text,
      submitted_at: new Date(r.submitted_at).toISOString(),
    },
  }));
}

async function readDirtyBucket(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; category: string; notes: string | null;
    done: number; done_at_iso: string | null; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM bucket_items WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id, couple_id: r.couple_id, title: r.title, category: r.category, notes: r.notes,
      done: !!r.done, done_at: r.done_at_iso,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyGoals(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; target: number; current: number; unit: string;
    due_iso: string | null; milestones: string; done: number; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM goals WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id, couple_id: r.couple_id, title: r.title,
      target: r.target, current: r.current, unit: r.unit,
      due_date: r.due_iso, done: !!r.done,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
    // milestones ride along via the adapter's post-push hook below
  }));
}

async function readDirtyReminders(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; notes: string | null; due_at: number;
    repeat: string; done: number; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM reminders WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id, couple_id: r.couple_id, title: r.title, notes: r.notes,
      due_at: new Date(r.due_at).toISOString(), repeat: r.repeat, done: !!r.done,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyDates(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; date_iso: string; yearly: number;
    icon: string; updated_at: number;
  }>(
    'SELECT * FROM important_dates WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id, couple_id: r.couple_id, title: r.title,
      date_value: r.date_iso, yearly: !!r.yearly, icon: r.icon,
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

function mapMediaIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    // Only uuid media ids are meaningful remotely (they would map to
    // backend media rows once Storage sync exists); local-only ids stay
    // local. Keep uuid ones so the association survives for the future.
    return (Array.isArray(parsed) ? parsed : []).filter(isUuid);
  } catch {
    return [];
  }
}

function hasNonUuidMedia(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as string[];
    return (Array.isArray(parsed) ? parsed : []).some((id) => !isUuid(id));
  } catch {
    return true;
  }
}

async function readDirtyJournal(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; author_id: string; title: string; text: string;
    mood_emoji: string | null; media_ids: string; created_at: number; edited_at: number | null;
    updated_at: number;
  }>(
    'SELECT * FROM journal_entries WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: hasNonUuidMedia(r.media_ids) ? null : {
      id: r.id, couple_id: r.couple_id, author_id: r.author_id, title: r.title, body: r.text,
      mood_emoji: r.mood_emoji, media_ids: mapMediaIds(r.media_ids),
      created_at: new Date(r.created_at).toISOString(),
      edited_at: r.edited_at ? new Date(r.edited_at).toISOString() : null,
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyMemories(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; caption: string | null; place: string | null;
    taken_at_iso: string; media_ids: string; favorite: number; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM memories WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: hasNonUuidMedia(r.media_ids) ? null : {
      id: r.id, couple_id: r.couple_id, title: r.title, caption: r.caption, place: r.place,
      taken_at: r.taken_at_iso, media_ids: mapMediaIds(r.media_ids), favorite: !!r.favorite,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyMoments(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; description: string | null; date_iso: string;
    media_ids: string; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM timeline_moments WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: hasNonUuidMedia(r.media_ids) ? null : {
      id: r.id, couple_id: r.couple_id, title: r.title, description: r.description,
      date_value: r.date_iso, media_ids: mapMediaIds(r.media_ids),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyVault(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; title: string; media_ids: string; note: string | null;
    created_at: number; updated_at: number;
  }>(
    'SELECT * FROM vault_items WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: hasNonUuidMedia(r.media_ids) ? null : {
      id: r.id, couple_id: r.couple_id, title: r.title, media_ids: mapMediaIds(r.media_ids),
      note: r.note,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

async function readDirtyChallenges(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; challenge_id: string; couple_id: string; started_on_iso: string;
    completed_on_isos: string; status: string; updated_at: number;
  }>(
    'SELECT * FROM challenge_progress WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => {
    let completed: string[] = [];
    try { completed = JSON.parse(r.completed_on_isos) as string[]; } catch { /* keep [] */ }
    return {
      id: r.id,
      updatedAt: r.updated_at,
      remote: {
        id: r.id, couple_id: r.couple_id, challenge_id: r.challenge_id,
        started_on: r.started_on_iso, completed_on: completed, status: r.status,
        updated_at: new Date(r.updated_at).toISOString(),
      },
    };
  });
}

async function readDirtyRituals(coupleId: string, sinceMs: number): Promise<DirtyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; couple_id: string; author_id: string; day_iso: string; kind: string;
    media_id: string | null; created_at: number; updated_at: number;
  }>(
    'SELECT * FROM ritual_completions WHERE couple_id = ? AND updated_at > ? ORDER BY updated_at LIMIT 500',
    [coupleId, sinceMs]
  );
  return rows.map((r) => ({
    id: r.id,
    updatedAt: r.updated_at,
    remote: {
      id: r.id, couple_id: r.couple_id, author_id: r.author_id,
      day_date: r.day_iso, kind: r.kind, media_id: isUuid(r.media_id) ? r.media_id : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  }));
}

/* ------------------------------------------------------------------ */
/* Remote appliers (last-write-wins into SQLite)                       */
/* ------------------------------------------------------------------ */

async function applyRemoteMessage(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM messages WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO messages
     (id, couple_id, author_id, kind, text, media_id, duration_ms, waveform, reply_to_id, reactions, sent_at, deleted_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.author_id as string, row.kind as string,
      (row.body as string | null) ?? null,
      isUuid(row.media_id as string) ? (row.media_id as string) : null,
      (row.duration_ms as number | null) ?? null,
      row.waveform ? JSON.stringify(row.waveform) : null,
      (row.reply_to_id as string | null) ?? null,
      JSON.stringify(row.reactions ?? {}),
      ms(row.sent_at),
      row.deleted_at ? ms(row.deleted_at) : null,
      'synced', updatedAt,
    ]
  );
}

async function applyRemoteMood(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM moods WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO moods (id, couple_id, author_id, day_iso, emoji, label, note, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.author_id as string,
      row.day_date as string, row.emoji as string, row.label as string,
      (row.note as string | null) ?? null, ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteAnswer(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const submittedAt = ms(row.submitted_at);
  const local = await db.getFirstAsync<{ submitted_at: number }>('SELECT submitted_at FROM question_answers WHERE id = ?', [id]);
  if (local && local.submitted_at >= submittedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO question_answers (id, couple_id, question_id, day_iso, author_id, text, submitted_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.question_id as string, row.day_date as string,
      row.author_id as string, row.body as string, submittedAt, 'synced', submittedAt,
    ]
  );
}

async function applyRemoteBucket(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM bucket_items WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO bucket_items (id, couple_id, title, category, notes, done, done_at_iso, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string, row.category as string,
      (row.notes as string | null) ?? null, row.done ? 1 : 0,
      (row.done_at as string | null) ?? null, ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteGoal(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM goals WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  // Milestones live in a child table remotely; fetch them now.
  let milestones: { id: string; title: string; done: boolean }[] = [];
  try {
    const { data } = await getSupabase().from('goal_milestones').select('id, title, done').eq('goal_id', id);
    milestones = (data ?? []) as { id: string; title: string; done: boolean }[];
  } catch { /* milestones are optional metadata */ }
  await db.runAsync(
    `INSERT OR REPLACE INTO goals (id, couple_id, title, target, current, unit, due_iso, milestones, done, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string,
      asNumber(row.target), asNumber(row.current), (row.unit as string) ?? '',
      (row.due_date as string | null) ?? null, JSON.stringify(milestones),
      row.done ? 1 : 0, ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteReminder(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM reminders WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders (id, couple_id, title, notes, due_at, repeat, done, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string, (row.notes as string | null) ?? null,
      ms(row.due_at), (row.repeat as string) ?? 'none', row.done ? 1 : 0,
      ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteDate(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM important_dates WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO important_dates (id, couple_id, title, date_iso, yearly, icon, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string, row.date_value as string,
      row.yearly ? 1 : 0, (row.icon as string) ?? 'heart', 'synced', updatedAt,
    ]
  );
}

async function applyRemoteJournal(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM journal_entries WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO journal_entries (id, couple_id, author_id, title, text, mood_emoji, media_ids, created_at, edited_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.author_id as string, row.title as string, row.body as string,
      (row.mood_emoji as string | null) ?? null, JSON.stringify(row.media_ids ?? []),
      ms(row.created_at), row.edited_at ? ms(row.edited_at) : null, 'synced', updatedAt,
    ]
  );
}

async function applyRemoteMemory(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM memories WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  // Likes: remote child table → local like_count / liked_by_self.
  let likeCount = 0;
  let likedBySelf = false;
  try {
    const { data: likes } = await getSupabase().from('memory_likes').select('user_id').eq('memory_id', id);
    likeCount = (likes ?? []).length;
    const { useSessionStore } = await import('../../state/session');
    const me = useSessionStore.getState().self?.id;
    likedBySelf = !!me && (likes ?? []).some((l: { user_id: string }) => l.user_id === me);
  } catch { /* likes are cosmetic */ }
  await db.runAsync(
    `INSERT OR REPLACE INTO memories (id, couple_id, title, caption, place, taken_at_iso, media_ids, favorite, like_count, liked_by_self, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string, (row.caption as string | null) ?? null,
      (row.place as string | null) ?? null, row.taken_at as string, JSON.stringify(row.media_ids ?? []),
      row.favorite ? 1 : 0, likeCount, likedBySelf ? 1 : 0, ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteMoment(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM timeline_moments WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO timeline_moments (id, couple_id, title, description, date_iso, media_ids, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string, (row.description as string | null) ?? null,
      row.date_value as string, JSON.stringify(row.media_ids ?? []), ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteVault(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM vault_items WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO vault_items (id, couple_id, title, media_ids, note, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.title as string, JSON.stringify(row.media_ids ?? []),
      (row.note as string | null) ?? null, ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

async function applyRemoteChallenge(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM challenge_progress WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_progress (id, challenge_id, couple_id, started_on_iso, completed_on_isos, status, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id, row.challenge_id as string, row.couple_id as string, row.started_on as string,
      JSON.stringify(row.completed_on ?? []), (row.status as string) ?? 'active', 'synced', updatedAt,
    ]
  );
}

async function applyRemoteRitual(row: Remote): Promise<void> {
  const db = await getDb();
  const id = row.id as string;
  const updatedAt = ms(row.updated_at);
  const local = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM ritual_completions WHERE id = ?', [id]);
  if (local && local.updated_at >= updatedAt) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO ritual_completions (id, couple_id, author_id, day_iso, kind, media_id, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id, row.couple_id as string, row.author_id as string, row.day_date as string,
      row.kind as string, (row.media_id as string | null) ?? null, ms(row.created_at), 'synced', updatedAt,
    ]
  );
}

/* ------------------------------------------------------------------ */
/* Engine                                                             */
/* ------------------------------------------------------------------ */

const ADAPTERS: Record<
  SyncTable,
  {
    readDirty: (coupleId: string, sinceMs: number) => Promise<DirtyRow[]>;
    apply: (row: Remote) => Promise<void>;
    /** column used as the change watermark remotely */
    watermarkColumn: string;
    /** optional child-table writes after the parent rows are upserted */
    afterPush?: (rows: DirtyRow[]) => Promise<void>;
  }
> = {
  messages: { readDirty: readDirtyMessages, apply: applyRemoteMessage, watermarkColumn: 'updated_at' },
  moods: { readDirty: readDirtyMoods, apply: applyRemoteMood, watermarkColumn: 'updated_at' },
  question_answers: { readDirty: readDirtyAnswers, apply: applyRemoteAnswer, watermarkColumn: 'submitted_at' },
  bucket_items: { readDirty: readDirtyBucket, apply: applyRemoteBucket, watermarkColumn: 'updated_at' },
  goals: { readDirty: readDirtyGoals, apply: applyRemoteGoal, watermarkColumn: 'updated_at', afterPush: pushGoalMilestones },
  reminders: { readDirty: readDirtyReminders, apply: applyRemoteReminder, watermarkColumn: 'updated_at' },
  important_dates: { readDirty: readDirtyDates, apply: applyRemoteDate, watermarkColumn: 'updated_at' },
  journal_entries: { readDirty: readDirtyJournal, apply: applyRemoteJournal, watermarkColumn: 'updated_at' },
  memories: { readDirty: readDirtyMemories, apply: applyRemoteMemory, watermarkColumn: 'updated_at', afterPush: pushMemoryLikes },
  timeline_moments: { readDirty: readDirtyMoments, apply: applyRemoteMoment, watermarkColumn: 'updated_at' },
  vault_items: { readDirty: readDirtyVault, apply: applyRemoteVault, watermarkColumn: 'updated_at' },
  challenge_progress: { readDirty: readDirtyChallenges, apply: applyRemoteChallenge, watermarkColumn: 'updated_at' },
  ritual_completions: { readDirty: readDirtyRituals, apply: applyRemoteRitual, watermarkColumn: 'updated_at' },
};

/** Goals keep milestones in a child table remotely — replace them wholesale
 * for every pushed goal (small rows, simple + idempotent). */
async function pushGoalMilestones(rows: DirtyRow[]): Promise<void> {
  const db = await getDb();
  for (const row of rows) {
    const goalId = row.id;
    const local = await db.getFirstAsync<{ milestones: string }>('SELECT milestones FROM goals WHERE id = ?', [goalId]);
    let items: { id: string; title: string; done: boolean }[] = [];
    try { items = JSON.parse(local?.milestones ?? '[]') as typeof items; } catch { /* keep [] */ }
    if (!Array.isArray(items)) items = [];
    if (items.length > 0 && items.some((m) => !isUuid(m.id))) continue; // legacy local ids — skip
    await getSupabase().from('goal_milestones').delete().eq('goal_id', goalId);
    if (items.length > 0) {
      await getSupabase().from('goal_milestones').upsert(
        items.map((m) => ({ id: m.id, goal_id: goalId, title: m.title, done: !!m.done }))
      );
    }
  }
}

/** Memory likes: mirror the local liked_by_self flag into memory_likes. */
async function pushMemoryLikes(rows: DirtyRow[]): Promise<void> {
  const db = await getDb();
  const { useSessionStore } = await import('../../state/session');
  const me = useSessionStore.getState().self?.id;
  if (!me || !isUuid(me)) return;
  for (const row of rows) {
    const local = await db.getFirstAsync<{ liked_by_self: number }>('SELECT liked_by_self FROM memories WHERE id = ?', [row.id]);
    if (!local) continue;
    if (local.liked_by_self) {
      await getSupabase().from('memory_likes').upsert({ memory_id: row.id, user_id: me });
    } else {
      await getSupabase().from('memory_likes').delete().eq('memory_id', row.id).eq('user_id', me);
    }
  }
}

/** Merge remote changes for one table into the local cache. Never throws. */
export async function pullSince(table: SyncTable, coupleId: string): Promise<void> {
  if (!coupleId || !isSupabaseConfigured()) return;
  try {
    const adapter = ADAPTERS[table];
    const wm = await getWatermark(table);
    const { data, error } = await getSupabase()
      .from(table)
      .select('*')
      .gt(adapter.watermarkColumn, wm)
      .limit(500);
    if (error) {
      // Unknown-table (0003 not deployed yet) or transient errors: skip quietly.
      return;
    }
    const rows = (data ?? []) as Remote[];
    let newest = wm;
    for (const row of rows) {
      await adapter.apply(row);
      const stamp = row[adapter.watermarkColumn];
      const t = typeof stamp === 'string' ? stamp : null;
      if (t && t > newest) newest = t;
    }
    if (newest !== wm) await setWatermark(table, newest);
  } catch {
    // Sync is best-effort; local data remains usable.
  }
}

/** Push locally-changed rows for one table. Never throws. */
export async function pushDirty(table: SyncTable, coupleId: string): Promise<void> {
  if (!coupleId || !isSupabaseConfigured()) return;
  try {
    const adapter = ADAPTERS[table];
    const wmRaw = await AsyncStorage.getItem(wmKey(table));
    const sinceMs = wmRaw ? Date.parse(wmRaw) : 0;
    const dirty = (await adapter.readDirty(coupleId, sinceMs)).filter((r) => r.remote);
    if (dirty.length === 0) return;
    const payload = dirty.map((r) => r.remote as Remote);
    const { error } = await getSupabase().from(table).upsert(payload, { onConflict: 'id' });
    if (error) return;
    try {
      await adapter.afterPush?.(dirty);
    } catch { /* child-table best effort */ }
    // The server accepted these rows — settle their local sync state.
    try {
      const maxPushed = Math.max(...dirty.map((r) => r.updatedAt));
      const db = await getDb();
      await db.runAsync(
        `UPDATE ${table} SET sync = 'synced' WHERE couple_id = ? AND updated_at <= ?`,
        [coupleId, maxPushed]
      );
    } catch { /* cosmetic */ }
    // Advance the push watermark to the newest successfully accepted row.
    const maxPushed = Math.max(...dirty.map((r) => r.updatedAt));
    const currentWm = await AsyncStorage.getItem(wmKey(table));
    const currentMs = currentWm ? Date.parse(currentWm) : 0;
    if (maxPushed > currentMs) {
      await setWatermark(table, new Date(maxPushed).toISOString());
    }
  } catch {
    // Network failure: watermark untouched, rows retry on the next push.
  }
}

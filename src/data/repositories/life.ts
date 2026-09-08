/**
 * Life domain: relationship timeline, journal, memories, private vault.
 */
import type { JournalEntry, Memory, TimelineMoment, VaultItem } from '../../domain/types';
import { getDb, safeJsonParse } from '../db';
import { deleteMedia } from '../media';

/* --------------------------------- timeline -------------------------------- */

interface MomentRow {
  id: string; couple_id: string; title: string; description: string | null; date_iso: string;
  media_ids: string; created_at: number; sync: TimelineMoment['sync']; updated_at: number;
}

const momentRow = (r: MomentRow): TimelineMoment => ({
  id: r.id, coupleId: r.couple_id, title: r.title, description: r.description ?? undefined,
  dateISO: r.date_iso, mediaIds: safeJsonParse<string[]>(r.media_ids, []),
  createdAt: r.created_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listMoments(coupleId: string): Promise<TimelineMoment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MomentRow>(
    'SELECT * FROM timeline_moments WHERE couple_id = ? ORDER BY date_iso DESC',
    [coupleId]
  );
  return rows.map(momentRow);
}

export async function upsertMoment(m: Omit<TimelineMoment, 'sync' | 'updatedAt'>): Promise<TimelineMoment> {
  const db = await getDb();
  const full: TimelineMoment = { ...m, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO timeline_moments (id, couple_id, title, description, date_iso, media_ids, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, full.description ?? null, full.dateISO, JSON.stringify(full.mediaIds), full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteMoment(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<MomentRow>('SELECT * FROM timeline_moments WHERE id = ?', [id]);
  if (row) {
    for (const mediaId of safeJsonParse<string[]>(row.media_ids, [])) await deleteMedia(mediaId);
  }
  await db.runAsync('DELETE FROM timeline_moments WHERE id = ?', [id]);
}

/* ---------------------------------- journal -------------------------------- */

interface JournalRow {
  id: string; couple_id: string; author_id: string; title: string; text: string;
  mood_emoji: string | null; media_ids: string; created_at: number; edited_at: number | null;
  sync: JournalEntry['sync']; updated_at: number;
}

const journalRow = (r: JournalRow): JournalEntry => ({
  id: r.id, coupleId: r.couple_id, authorId: r.author_id, title: r.title, text: r.text,
  moodEmoji: r.mood_emoji ?? undefined, mediaIds: safeJsonParse<string[]>(r.media_ids, []),
  createdAt: r.created_at, editedAt: r.edited_at ?? undefined, sync: r.sync, updatedAt: r.updated_at,
});

export async function listJournal(coupleId: string, limit = 100): Promise<JournalEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<JournalRow>(
    'SELECT * FROM journal_entries WHERE couple_id = ? ORDER BY created_at DESC LIMIT ?',
    [coupleId, limit]
  );
  return rows.map(journalRow);
}

export async function upsertJournalEntry(e: Omit<JournalEntry, 'sync' | 'updatedAt'>): Promise<JournalEntry> {
  const db = await getDb();
  const full: JournalEntry = { ...e, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO journal_entries (id, couple_id, author_id, title, text, mood_emoji, media_ids, created_at, edited_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.authorId, full.title, full.text, full.moodEmoji ?? null,
     JSON.stringify(full.mediaIds), full.createdAt, full.editedAt ?? null, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<JournalRow>('SELECT * FROM journal_entries WHERE id = ?', [id]);
  if (row) {
    for (const mediaId of safeJsonParse<string[]>(row.media_ids, [])) await deleteMedia(mediaId);
  }
  await db.runAsync('DELETE FROM journal_entries WHERE id = ?', [id]);
}

/* --------------------------------- memories -------------------------------- */

interface MemoryRow {
  id: string; couple_id: string; title: string; caption: string | null; place: string | null;
  taken_at_iso: string; media_ids: string; favorite: number; like_count: number;
  liked_by_self: number; created_at: number; sync: Memory['sync']; updated_at: number;
}

const memoryRow = (r: MemoryRow): Memory => ({
  id: r.id, coupleId: r.couple_id, title: r.title, caption: r.caption ?? undefined,
  place: r.place ?? undefined, takenAtISO: r.taken_at_iso, mediaIds: safeJsonParse<string[]>(r.media_ids, []),
  favorite: !!r.favorite, likeCount: r.like_count, likedBySelf: !!r.liked_by_self,
  createdAt: r.created_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listMemories(coupleId: string, limit = 200): Promise<Memory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    'SELECT * FROM memories WHERE couple_id = ? ORDER BY taken_at_iso DESC LIMIT ?',
    [coupleId, limit]
  );
  return rows.map(memoryRow);
}

export async function upsertMemory(m: Omit<Memory, 'sync' | 'updatedAt'>): Promise<Memory> {
  const db = await getDb();
  const full: Memory = { ...m, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO memories (id, couple_id, title, caption, place, taken_at_iso, media_ids, favorite, like_count, liked_by_self, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, full.caption ?? null, full.place ?? null, full.takenAtISO,
     JSON.stringify(full.mediaIds), full.favorite ? 1 : 0, full.likeCount, full.likedBySelf ? 1 : 0,
     full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<MemoryRow>('SELECT * FROM memories WHERE id = ?', [id]);
  if (row) {
    for (const mediaId of safeJsonParse<string[]>(row.media_ids, [])) await deleteMedia(mediaId);
  }
  await db.runAsync('DELETE FROM memories WHERE id = ?', [id]);
}

/* ----------------------------------- vault --------------------------------- */

interface VaultRow {
  id: string; couple_id: string; title: string; media_ids: string; note: string | null;
  created_at: number; sync: VaultItem['sync']; updated_at: number;
}

const vaultRow = (r: VaultRow): VaultItem => ({
  id: r.id, coupleId: r.couple_id, title: r.title, mediaIds: safeJsonParse<string[]>(r.media_ids, []),
  note: r.note ?? undefined, createdAt: r.created_at, sync: r.sync, updatedAt: r.updated_at,
});

export async function listVaultItems(coupleId: string): Promise<VaultItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<VaultRow>(
    'SELECT * FROM vault_items WHERE couple_id = ? ORDER BY created_at DESC',
    [coupleId]
  );
  return rows.map(vaultRow);
}

export async function upsertVaultItem(v: Omit<VaultItem, 'sync' | 'updatedAt'>): Promise<VaultItem> {
  const db = await getDb();
  const full: VaultItem = { ...v, sync: 'synced', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO vault_items (id, couple_id, title, media_ids, note, created_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [full.id, full.coupleId, full.title, JSON.stringify(full.mediaIds), full.note ?? null, full.createdAt, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteVaultItem(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<VaultRow>('SELECT * FROM vault_items WHERE id = ?', [id]);
  if (row) {
    for (const mediaId of safeJsonParse<string[]>(row.media_ids, [])) await deleteMedia(mediaId);
  }
  await db.runAsync('DELETE FROM vault_items WHERE id = ?', [id]);
}

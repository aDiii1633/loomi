import type { CoupleId, Message, UserId } from '../../domain/types';
import { getDb, safeJsonParse } from '../db';
import { deleteMedia } from '../media';

interface MessageRow {
  id: string; couple_id: string; author_id: string; kind: Message['kind'];
  text: string | null; media_id: string | null; duration_ms: number | null;
  waveform: string | null; reply_to_id: string | null; reactions: string;
  sent_at: number; deleted_at: number | null; sync: Message['sync']; updated_at: number;
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    coupleId: r.couple_id,
    authorId: r.author_id,
    kind: r.kind,
    text: r.text ?? undefined,
    mediaId: r.media_id ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    waveform: r.waveform ? safeJsonParse<number[]>(r.waveform, []) : undefined,
    replyToId: r.reply_to_id ?? undefined,
    reactions: safeJsonParse(r.reactions, {}),
    sentAt: r.sent_at,
    deletedAt: r.deleted_at ?? undefined,
    sync: r.sync,
    updatedAt: r.updated_at,
  };
}

export async function listMessages(coupleId: string | null, limit = 200): Promise<Message[]> {
  if (!coupleId) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT * FROM messages WHERE couple_id = ? AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT ?`,
    [coupleId, limit]
  );
  return rows.map(rowToMessage).reverse();
}

export async function insertMessage(
  m: Omit<Message, 'sync' | 'updatedAt'>
): Promise<Message> {
  const db = await getDb();
  const full: Message = { ...m, sync: 'pending', updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO messages
     (id, couple_id, author_id, kind, text, media_id, duration_ms, waveform, reply_to_id, reactions, sent_at, deleted_at, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      full.id, full.coupleId, full.authorId, full.kind, full.text ?? null, full.mediaId ?? null,
      full.durationMs ?? null, full.waveform ? JSON.stringify(full.waveform) : null,
      full.replyToId ?? null, JSON.stringify(full.reactions ?? {}), full.sentAt, null,
      full.sync, full.updatedAt,
    ]
  );
  // Rows stay 'pending' until pushDirty() reports the server accepted them.
  return full;
}

export async function toggleReaction(
  messageId: string,
  emoji: string,
  userId: UserId
): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [messageId]);
  if (!row) return;
  const reactions = safeJsonParse<Record<string, string[]>>(row.reactions, {});
  const users = reactions[emoji] ?? [];
  const exists = users.includes(userId);
  const next = { ...reactions, [emoji]: exists ? users.filter((u) => u !== userId) : [...users, userId] };
  if (next[emoji].length === 0) delete next[emoji];
  await db.runAsync('UPDATE messages SET reactions = ?, sync = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(next), 'synced', Date.now(), messageId,
  ]);
}

export async function softDeleteMessage(messageId: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', [messageId]);
  if (!row) return;
  await db.runAsync('UPDATE messages SET deleted_at = ?, sync = ?, updated_at = ? WHERE id = ?', [
    Date.now(), 'synced', Date.now(), messageId,
  ]);
  if (row.media_id) await deleteMedia(row.media_id);
}

export async function activeChatDays(coupleId: CoupleId): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT date(sent_at / 1000, 'unixepoch', 'localtime') AS d
     FROM messages WHERE couple_id = ? AND deleted_at IS NULL`,
    [coupleId]
  );
  return rows.map((r) => r.d);
}

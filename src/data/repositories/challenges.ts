import type { ChallengeProgress, CoupleId } from '../../domain/types';
import { getDb, safeJsonParse } from '../db';

interface Row {
  id: string; challenge_id: string; couple_id: string; started_on_iso: string;
  completed_on_isos: string; status: ChallengeProgress['status'];
  sync: ChallengeProgress['sync']; updated_at: number;
}

const rowToProgress = (r: Row): ChallengeProgress => ({
  id: r.id, challengeId: r.challenge_id, coupleId: r.couple_id,
  startedOnISO: r.started_on_iso, completedOnISOs: safeJsonParse<string[]>(r.completed_on_isos, []),
  status: r.status, sync: r.sync, updatedAt: r.updated_at,
});

export async function listProgress(coupleId: string): Promise<ChallengeProgress[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM challenge_progress WHERE couple_id = ? ORDER BY updated_at DESC',
    [coupleId]
  );
  return rows.map(rowToProgress);
}

export async function saveProgress(p: ChallengeProgress): Promise<ChallengeProgress> {
  const db = await getDb();
  const full = { ...p, sync: 'synced' as const, updatedAt: Date.now() };
  await db.runAsync(
    `INSERT OR REPLACE INTO challenge_progress (id, challenge_id, couple_id, started_on_iso, completed_on_isos, status, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [full.id, full.challengeId, full.coupleId, full.startedOnISO, JSON.stringify(full.completedOnISOs), full.status, full.sync, full.updatedAt]
  );
  return full;
}

export async function deleteProgress(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM challenge_progress WHERE id = ?', [id]);
}

export async function challengeDays(coupleId: CoupleId): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ completed_on_isos: string }>(
    'SELECT completed_on_isos FROM challenge_progress WHERE couple_id = ?',
    [coupleId]
  );
  return rows.flatMap((r) => safeJsonParse<string[]>(r.completed_on_isos, []));
}

import type { CoupleId, GameSession, GameResult, GameId, GamePlayerState, UserId } from '../../domain/types';
import { getDb, safeJsonParse } from '../db';

interface Row {
  id: string; couple_id: string; game_id: GameId; day_iso: string; players: string;
  status: GameSession['status']; started_at: number; completed_at: number | null;
  result: string | null; sync: GameSession['sync']; updated_at: number;
}

const rowToSession = (r: Row): GameSession => ({
  id: r.id, coupleId: r.couple_id, gameId: r.game_id, dayISO: r.day_iso,
  players: safeJsonParse<Record<string, GamePlayerState>>(r.players, {}),
  status: r.status, startedAt: r.started_at, completedAt: r.completed_at ?? undefined,
  result: r.result ? safeJsonParse<GameResult>(r.result, { summary: '' }) : undefined,
  sync: r.sync, updatedAt: r.updated_at,
});

export async function listSessions(coupleId: string, limit = 50): Promise<GameSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM game_sessions WHERE couple_id = ? ORDER BY started_at DESC LIMIT ?',
    [coupleId, limit]
  );
  return rows.map(rowToSession);
}

export async function getSession(id: string): Promise<GameSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM game_sessions WHERE id = ?', [id]);
  return row ? rowToSession(row) : null;
}

/** Active session for a game on a given day (one per game per day per couple). */
export async function findActiveSession(
  coupleId: string,
  gameId: GameId,
  day: string
): Promise<GameSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT * FROM game_sessions WHERE couple_id = ? AND game_id = ? AND day_iso = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
    [coupleId, gameId, day]
  );
  return row ? rowToSession(row) : null;
}

export async function saveSession(s: GameSession): Promise<GameSession> {
  const db = await getDb();
  const updatedAt = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO game_sessions (id, couple_id, game_id, day_iso, players, status, started_at, completed_at, result, sync, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      s.id, s.coupleId, s.gameId, s.dayISO, JSON.stringify(s.players), s.status, s.startedAt,
      s.completedAt ?? null, s.result ? JSON.stringify(s.result) : null, 'synced', updatedAt,
    ]
  );
  return { ...s, sync: 'synced', updatedAt };
}

export async function gameDays(coupleId: CoupleId): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day_iso: string }>(
    'SELECT DISTINCT day_iso FROM game_sessions WHERE couple_id = ?',
    [coupleId]
  );
  return rows.map((r) => r.day_iso);
}

/** Partner's simulated participation for the current dev session. */
export function partnerPayloadFor(gameId: GameId, selfPayload: Record<string, unknown> | undefined, partnerId: UserId): GamePlayerState {
  // In dev, Maya plays alongside you with plausible answers derived from yours.
  if (gameId === 'this-or-that' && Array.isArray(selfPayload?.picks)) {
    const picks = (selfPayload?.picks as string[]).map((p, i) => (i % 3 === 1 ? (p === 'a' ? 'b' : 'a') : p));
    return { finished: true, payload: { picks } };
  }
  if (gameId === 'know-me-quiz') {
    return { finished: true, score: 3 };
  }
  if (gameId === 'truth-or-dare') {
    return { finished: true, score: (selfPayload?.rounds as number) ?? 0 };
  }
  void partnerId;
  return { finished: false };
}

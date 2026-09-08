/**
 * Local database (expo-sqlite) with a versioned migration table.
 * All reads/writes go through repositories — screens never touch SQL.
 */
import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: { version: number; up: string[] }[] = [
  {
    version: 1,
    up: [
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT,
        media_id TEXT,
        duration_ms INTEGER,
        waveform TEXT,
        reply_to_id TEXT,
        reactions TEXT NOT NULL DEFAULT '{}',
        sent_at INTEGER NOT NULL,
        deleted_at INTEGER,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages (sent_at DESC);`,
      `CREATE TABLE IF NOT EXISTS question_answers (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        day_iso TEXT NOT NULL,
        author_id TEXT NOT NULL,
        text TEXT NOT NULL,
        submitted_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_qa_day ON question_answers (day_iso);`,
      `CREATE TABLE IF NOT EXISTS moods (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        day_iso TEXT NOT NULL,
        emoji TEXT NOT NULL,
        label TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        day_iso TEXT NOT NULL,
        players TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        result TEXT,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS challenge_progress (
        id TEXT PRIMARY KEY NOT NULL,
        challenge_id TEXT NOT NULL,
        couple_id TEXT NOT NULL,
        started_on_iso TEXT NOT NULL,
        completed_on_isos TEXT NOT NULL,
        status TEXT NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS bucket_items (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        notes TEXT,
        done INTEGER NOT NULL DEFAULT 0,
        done_at_iso TEXT,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        target REAL NOT NULL,
        current REAL NOT NULL,
        unit TEXT NOT NULL,
        due_iso TEXT,
        milestones TEXT NOT NULL DEFAULT '[]',
        done INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        due_at INTEGER NOT NULL,
        repeat TEXT NOT NULL DEFAULT 'none',
        done INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS important_dates (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        date_iso TEXT NOT NULL,
        yearly INTEGER NOT NULL DEFAULT 1,
        icon TEXT NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS timeline_moments (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        date_iso TEXT NOT NULL,
        media_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        mood_emoji TEXT,
        media_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        edited_at INTEGER,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        caption TEXT,
        place TEXT,
        taken_at_iso TEXT NOT NULL,
        media_ids TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        like_count INTEGER NOT NULL DEFAULT 0,
        liked_by_self INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS vault_items (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        title TEXT NOT NULL,
        media_ids TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        route TEXT
      );`,
    ],
  },
  {
    version: 2,
    up: [
      `CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY NOT NULL,
        uri TEXT NOT NULL,
        kind TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        duration_ms INTEGER,
        file_size INTEGER,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS ritual_completions (
        id TEXT PRIMARY KEY NOT NULL,
        couple_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        day_iso TEXT NOT NULL,
        kind TEXT NOT NULL,
        media_id TEXT,
        created_at INTEGER NOT NULL,
        sync TEXT NOT NULL DEFAULT 'synced',
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_ritual_day ON ritual_completions (day_iso);`,
    ],
  },
];

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('twofold.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      let version = current?.user_version ?? 0;
      for (const migration of MIGRATIONS) {
        if (migration.version > version) {
          await db.withTransactionAsync(async () => {
            for (const stmt of migration.up) await db.execAsync(stmt);
          });
          version = migration.version;
          await db.execAsync(`PRAGMA user_version = ${migration.version};`);
        }
      }
      return db;
    })();
  }
  return dbPromise;
}

/** Destructive reset used by the dev "reset demo data" action AND by
 * sign-out: after a user logs out, none of their couple-scoped data may
 * survive on the device for the next account. */
export async function wipeDatabase(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const tables = [
      'messages', 'question_answers', 'moods', 'game_sessions', 'challenge_progress',
      'bucket_items', 'goals', 'reminders', 'important_dates', 'timeline_moments',
      'journal_entries', 'memories', 'vault_items', 'notifications',
      'ritual_completions', 'media',
    ];
    for (const t of tables) await db.execAsync(`DELETE FROM ${t};`);
  });
}

/* ------------------------------ row helpers ------------------------------ */

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

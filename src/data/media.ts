/**
 * Media store: imported media is copied into the app's own storage and
 * registered in the `media` table. Entities reference media by id, so the
 * same photo can appear in memories, journal, timeline and chat without
 * duplicating bytes.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { getDb } from './db';
import { validateMediaSize } from '../domain/validation';

export type MediaKind = 'image' | 'video' | 'audio';

export interface MediaRecord {
  id: string;
  uri: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationMs?: number;
  fileSize?: number;
  createdAt: number;
}

const MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}media/`;

export async function ensureMediaDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
}

/** UUID v4 ids: every locally-created row must be a valid uuid so the same
 * id can be pushed to Supabase (all backend PKs are uuid) without mapping. */
export function newId(_prefix?: string): string {
  void _prefix;
  return Crypto.randomUUID();
}

/** Import a picked asset into app storage. Throws on validation failure. */
export async function importMedia(params: {
  sourceUri: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationMs?: number;
  fileSize?: number;
}): Promise<MediaRecord> {
  const { sourceUri, kind } = params;
  if (params.fileSize) {
    const v = validateMediaSize(params.fileSize, kind);
    if (!v.ok) throw new Error(v.message);
  }
  await ensureMediaDir();
  const id = newId('media');
  const ext = extensionFor(sourceUri, kind);
  const dest = `${MEDIA_DIR}${id}${ext}`;

  //file:// URIs are copied; remote/http URIs are downloaded.
  if (sourceUri.startsWith('file:')) {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  } else if (sourceUri.startsWith('http')) {
    await FileSystem.downloadAsync(sourceUri, dest);
  } else {
    // content:// URIs from pickers on Android
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  }

  const record: MediaRecord = {
    id,
    uri: dest,
    kind,
    width: params.width,
    height: params.height,
    durationMs: params.durationMs,
    fileSize: params.fileSize,
    createdAt: Date.now(),
  };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO media (id, uri, kind, width, height, duration_ms, file_size, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [record.id, record.uri, record.kind, record.width ?? null, record.height ?? null, record.durationMs ?? null, record.fileSize ?? null, record.createdAt]
  );
  return record;
}

export async function importAudioRecording(params: {
  sourceUri: string;
  durationMs: number;
  fileSize?: number;
  waveform?: number[];
}): Promise<MediaRecord> {
  const rec = await importMedia({
    sourceUri: params.sourceUri,
    kind: 'audio',
    durationMs: params.durationMs,
    fileSize: params.fileSize,
  });
  if (params.waveform) await storeWaveform(rec.id, params.waveform);
  return rec;
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string; uri: string; kind: MediaKind; width: number | null; height: number | null;
    duration_ms: number | null; file_size: number | null; created_at: number;
  }>('SELECT * FROM media WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id, uri: row.uri, kind: row.kind, width: row.width ?? undefined,
    height: row.height ?? undefined, durationMs: row.duration_ms ?? undefined,
    fileSize: row.file_size ?? undefined, createdAt: row.created_at,
  };
}

export async function getMediaMany(ids: readonly string[]): Promise<MediaRecord[]> {
  const out: MediaRecord[] = [];
  for (const id of ids) {
    const m = await getMedia(id);
    if (m) out.push(m);
  }
  return out;
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await getDb();
  const rec = await getMedia(id);
  if (rec?.uri) {
    await FileSystem.deleteAsync(rec.uri, { idempotent: true });
  }
  await db.runAsync('DELETE FROM media WHERE id = ?', [id]);
}

/** Deletes every stored media file (and its waveform). Used by sign-out so
 * one account's photos/voice notes never survive for the next one. */
export async function clearMediaFiles(): Promise<void> {
  for (const dir of [MEDIA_DIR, WAVEFORM_DIR]) {
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
  }
}

/* ------------------------------ waveforms -------------------------------- */

const WAVEFORM_DIR = `${FileSystem.documentDirectory ?? ''}waveforms/`;

export async function storeWaveform(mediaId: string, waveform: number[]): Promise<void> {
  const info = await FileSystem.getInfoAsync(WAVEFORM_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(WAVEFORM_DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(`${WAVEFORM_DIR}${mediaId}.json`, JSON.stringify(waveform));
}

export async function loadWaveform(mediaId: string): Promise<number[] | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(`${WAVEFORM_DIR}${mediaId}.json`);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extensionFor(uri: string, kind: MediaKind): string {
  const match = /\.([a-zA-Z0-9]{2,5})$/.exec(uri);
  if (match) return match[0];
  return kind === 'image' ? '.jpg' : kind === 'video' ? '.mp4' : '.m4a';
}

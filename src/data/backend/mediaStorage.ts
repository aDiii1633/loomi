/**
 * Couple media bytes <-> Supabase Storage (private bucket `couple-media`,
 * migration 0008). Path convention: `<couple_id>/<media_id><ext>`. The
 * `public.media` row is the metadata index; Storage holds the bytes.
 *
 * - upload: after importMedia() copies a picked file locally, push the bytes
 *   and upsert the `media` row so the partner can fetch it.
 * - ensureLocalMedia: if the file isn't on this device yet, resolve it from
 *   the `media` row + a short-lived signed URL and cache it locally.
 *
 * Auth is the Clerk session token on the anon/authenticated client — never a
 * service-role key. Storage RLS (couple_media_* policies) is the gate.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from '../db';
import { getMedia, type MediaKind, type MediaRecord } from '../media';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET = 'couple-media';
const MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}media/`;

const CONTENT_TYPE: Record<MediaKind, string> = {
  image: 'image/jpeg',
  video: 'video/mp4',
  audio: 'audio/m4a',
};
const EXT: Record<MediaKind, string> = { image: '.jpg', video: '.mp4', audio: '.m4a' };

function storagePath(coupleId: string, mediaId: string, kind: MediaKind): string {
  return `${coupleId}/${mediaId}${EXT[kind]}`;
}

/** Push local bytes for one media id to Storage + upsert its `media` row.
 * Safe to call repeatedly (upsert + `upsert:true` on the object). */
export async function uploadCoupleMedia(params: {
  coupleId: string;
  uploadedBy: string;
  mediaId: string;
  localUri: string;
  kind: MediaKind;
  byteSize: number;
  width?: number;
  height?: number;
  durationMs?: number;
}): Promise<boolean> {
  const { coupleId, uploadedBy, mediaId, localUri, kind } = params;
  if (!isSupabaseConfigured() || !coupleId || !uploadedBy) return false;
  try {
    const supabase = getSupabase();
    const path = storagePath(coupleId, mediaId, kind);
    // RN fetch resolves file:// URIs to a Blob with no extra dependency.
    const blob = await (await fetch(localUri)).blob();
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: CONTENT_TYPE[kind], upsert: true });
    if (upErr && !/exists/i.test(upErr.message)) return false;

    const { error: rowErr } = await supabase.from('media').upsert(
      {
        id: mediaId,
        couple_id: coupleId,
        uploaded_by: uploadedBy,
        storage_path: path,
        kind,
        content_type: CONTENT_TYPE[kind],
        byte_size: params.byteSize,
        width: params.width ?? null,
        height: params.height ?? null,
        duration_ms: params.durationMs ?? null,
      },
      { onConflict: 'id' }
    );
    return !rowErr;
  } catch {
    return false;
  }
}

/** Return a local file uri for `mediaId`, downloading it from Storage on
 * first use. null when the bytes genuinely aren't available anywhere. */
export async function ensureLocalMedia(mediaId: string): Promise<string | null> {
  const local = await getMedia(mediaId);
  if (local?.uri) {
    const info = await FileSystem.getInfoAsync(local.uri);
    if (info.exists) return local.uri;
  }
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from('media')
      .select('storage_path, kind, content_type, byte_size, width, height, duration_ms')
      .eq('id', mediaId)
      .maybeSingle();
    if (error || !row) return null;

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path as string, 60 * 60);
    if (signErr || !signed?.signedUrl) return null;

    const kind = row.kind as MediaKind;
    const dest = `${MEDIA_DIR}${mediaId}${EXT[kind]}`;
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
    const res = await FileSystem.downloadAsync(signed.signedUrl, dest);
    if (res.status !== 200) return null;

    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO media (id, uri, kind, width, height, duration_ms, file_size, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        mediaId,
        dest,
        kind,
        (row.width as number | null) ?? null,
        (row.height as number | null) ?? null,
        (row.duration_ms as number | null) ?? null,
        (row.byte_size as number | null) ?? null,
        Date.now(),
      ]
    );
    return dest;
  } catch {
    return null;
  }
}

/** Drop-in for getMediaMany that first downloads any bytes missing on this
 * device (e.g. media the partner uploaded). Skips ids that resolve nowhere. */
export async function resolveMediaMany(ids: readonly string[]): Promise<MediaRecord[]> {
  const out: MediaRecord[] = [];
  for (const id of ids) {
    const uri = await ensureLocalMedia(id);
    if (!uri) continue;
    const rec = await getMedia(id);
    if (rec) out.push({ ...rec, uri });
  }
  return out;
}

export async function deleteCoupleMedia(coupleId: string, mediaId: string, kind: MediaKind): Promise<void> {
  if (!isSupabaseConfigured() || !coupleId) return;
  try {
    const supabase = getSupabase();
    await supabase.storage.from(BUCKET).remove([storagePath(coupleId, mediaId, kind)]);
    await supabase.from('media').delete().eq('id', mediaId);
  } catch {
    /* best effort */
  }
}

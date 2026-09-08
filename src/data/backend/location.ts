/**
 * Couple location sync. SQLite is not involved here — a location fix is
 * ephemeral, so it goes straight to Supabase (`couple_locations`, migration
 * 0007) and comes back via Realtime / an explicit fetch.
 *
 * Every call is best-effort: if the table isn't deployed yet, or the network
 * is down, these resolve quietly (like src/data/backend/sync.ts) so the
 * location screen keeps working with just the device's own fix.
 */
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface RemoteLocation {
  user_id: string;
  lat: number;
  lon: number;
  label: string | null;
  updated_at: string;
}

export async function upsertMyLocation(params: {
  coupleId: string;
  userId: string;
  lat: number;
  lon: number;
  label: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured() || !params.coupleId || !params.userId) return;
  try {
    await getSupabase()
      .from('couple_locations')
      .upsert(
        {
          couple_id: params.coupleId,
          user_id: params.userId,
          lat: params.lat,
          lon: params.lon,
          label: params.label,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,user_id' }
      );
  } catch {
    /* table missing / offline — the local fix still renders */
  }
}

/** "Stop sharing" — remove the row entirely so the partner sees nothing. */
export async function deleteMyLocation(coupleId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !coupleId || !userId) return;
  try {
    await getSupabase()
      .from('couple_locations')
      .delete()
      .eq('couple_id', coupleId)
      .eq('user_id', userId);
  } catch {
    /* best effort */
  }
}

/** The partner's latest fix, or null if they aren't sharing. RLS guarantees
 * only the caller's own couple is ever returned. */
export async function fetchPartnerLocation(
  coupleId: string,
  myUserId: string
): Promise<RemoteLocation | null> {
  if (!isSupabaseConfigured() || !coupleId || !myUserId) return null;
  try {
    const { data, error } = await getSupabase()
      .from('couple_locations')
      .select('user_id, lat, lon, label, updated_at')
      .eq('couple_id', coupleId)
      .neq('user_id', myUserId)
      .maybeSingle();
    if (error) return null;
    return (data as RemoteLocation | null) ?? null;
  } catch {
    return null;
  }
}

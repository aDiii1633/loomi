/**
 * Points RPC wrappers. Balances are ALWAYS read from the server
 * (sum over the append-only point_events ledger, migration 0005) — the
 * client never asserts a balance. Best-effort: returns 0/null until the
 * migration is applied.
 */
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export async function getMyPoints(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const { data, error } = await getSupabase().rpc('get_my_points');
    if (error) return 0;
    return typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
}

/**
 * Award +10 to BOTH partners for a qualifying streak day. Idempotent
 * server-side (unique dedupe_key per couple/user/day), so calling it again
 * after a reload or from the other device is a no-op. Returns the caller's
 * new balance, or null when the backend isn't ready.
 */
export async function awardDailyStreak(coupleId: string, dayISO: string): Promise<number | null> {
  if (!isSupabaseConfigured() || !coupleId) return null;
  try {
    const { data, error } = await getSupabase().rpc('award_daily_streak', {
      p_couple_id: coupleId,
      p_day: dayISO,
    });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Profile-row writes the client is allowed to make directly. `public.users`
 * has a `users_update_own` RLS policy (migration 0001), so a member can
 * update their OWN row and nothing else. Used for the chosen avatar, which
 * lives in `avatar_url` so the partner's client reads exactly the same value
 * via fetchMyCoupleSnapshot().
 *
 * Values stored in avatar_url:
 *   - "loomi://illustration/<key>"  chosen Pao & Ly illustration
 *   - "https://..."                 uploaded photo URL (Clerk-hosted)
 *   - null                          cleared -> initials fallback
 */
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export async function setMyAvatar(userId: string, avatarUrl: string | null): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;
  const { error } = await getSupabase()
    .from('users')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

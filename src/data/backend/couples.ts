/**
 * Thin wrappers around the server-side RPC functions defined in
 * pairly-backend/supabase/migrations/0002_privileged_functions.sql.
 * Every couple-membership mutation goes through one of these — never a
 * direct table insert — because only the server can atomically enforce
 * "invite not expired/not used/couple not full" (see that file's comments).
 */
import { getSupabase } from './supabaseClient';

export interface RemoteCouple {
  id: string;
  status: 'pending' | 'active' | 'dissolved';
  anniversary_date: string | null;
  level: number;
}

export interface RemoteUser {
  id: string;
  clerk_user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface RemoteCoupleSnapshot {
  me: RemoteUser;
  couple: RemoteCouple;
  partner: RemoteUser | null;
}

export async function bootstrapCurrentUser(displayName: string) {
  const { data, error } = await getSupabase().rpc('bootstrap_current_user', { p_display_name: displayName });
  if (error) throw error;
  return data as RemoteUser;
}

export async function createCouple(): Promise<RemoteCouple> {
  const { data, error } = await getSupabase().rpc('create_couple');
  if (error) throw error;
  return data as RemoteCouple;
}

export async function createCoupleInvite(coupleId: string): Promise<{ code: string; expires_at: string }> {
  const { data, error } = await getSupabase().rpc('create_couple_invite', { p_couple_id: coupleId });
  if (error) throw error;
  return data as { code: string; expires_at: string };
}

export async function acceptCoupleInvite(code: string): Promise<RemoteCouple> {
  const { data, error } = await getSupabase().rpc('accept_couple_invite', { p_code: code });
  if (error) throw error;
  return data as RemoteCouple;
}

/** Persist the day the relationship started. Backed by the
 * set_couple_anniversary security-definer RPC (migration 0003) — couples has
 * no client UPDATE policy by design, so a direct table write would be
 * rejected by RLS. */
export async function setCoupleAnniversary(coupleId: string, dateISO: string): Promise<void> {
  const { error } = await getSupabase().rpc('set_couple_anniversary', {
    p_couple_id: coupleId,
    p_date: dateISO,
  });
  if (error) throw error;
}

/**
 * Look up the caller's real couple: profile bootstrap (idempotent upsert of
 * the public.users row keyed by the Clerk subject in the verified JWT), then
 * the active couple_members row, the couple itself, and — when the couple is
 * active — the partner's profile (RLS "users_select_partner" makes it
 * readable exactly then, never before).
 *
 * Returns null when the user simply has no couple yet — that is a normal
 * state, not an error. Everything else throws.
 */
export async function fetchMyCoupleSnapshot(displayName: string): Promise<RemoteCoupleSnapshot | null> {
  const supabase = getSupabase();

  const me = await bootstrapCurrentUser(displayName);

  const { data: memberships, error: memberError } = await supabase
    .from('couple_members')
    .select('couple_id, user_id, status')
    .eq('status', 'active');
  if (memberError) throw memberError;

  type Membership = { couple_id: string; user_id: string; status: string };
  const all = (memberships ?? []) as Membership[];
  const mine = all.find((m) => m.user_id === me.id);
  if (!mine) return null;

  const { data: couple, error: coupleError } = await supabase
    .from('couples')
    .select('id, status, anniversary_date, level, updated_at')
    .eq('id', mine.couple_id)
    .maybeSingle();
  if (coupleError) throw coupleError;
  if (!couple) return null;

  let partner: RemoteUser | null = null;
  if (couple.status === 'active') {
    const partnerRow = all.find((m) => m.user_id !== me.id && m.couple_id === mine.couple_id);
    if (partnerRow) {
      const { data: partnerProfile, error: partnerError } = await supabase
        .from('users')
        .select('id, clerk_user_id, display_name, avatar_url')
        .eq('id', partnerRow.user_id)
        .maybeSingle();
      if (partnerError) throw partnerError;
      partner = partnerProfile as RemoteUser | null;
    }
  }

  return { me, couple: couple as RemoteCouple, partner };
}

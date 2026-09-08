/**
 * Illustration shop wrappers (migration 0006). Every mutation goes through a
 * security-definer RPC that re-derives the caller's balance from the ledger
 * server-side — the client cannot talk its way into a purchase it can't
 * afford. Reads fall back to the static catalog / empty ownership until the
 * migration is applied.
 */
import type { IllustrationKey } from '../../components/illustrations/registry';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface CatalogItem {
  id: IllustrationKey;
  name: string;
  price: number;
  sort: number;
}

/** Mirror of the 0006 seed so the shop screen renders before the migration
 * lands. The server catalog is authoritative once it exists. */
export const SHOP_CATALOG: CatalogItem[] = [
  { id: 'welcome-holding-hands', name: 'Holding Hands', price: 0, sort: 10 },
  { id: 'streak-fist-bump', name: 'Fist Bump', price: 0, sort: 20 },
  { id: 'chat-sitting-together', name: 'Sitting Together', price: 50, sort: 30 },
  { id: 'mood-thinking-together', name: 'Thinking Together', price: 50, sort: 40 },
  { id: 'memories-viewing-photos', name: 'Photo Wall', price: 80, sort: 50 },
  { id: 'journal-writing-together', name: 'Writing Together', price: 80, sort: 60 },
  { id: 'games-video-game', name: 'Game Night', price: 100, sort: 70 },
  { id: 'location-walking', name: 'Walk Together', price: 100, sort: 80 },
  { id: 'celebrate-jumping', name: 'Jump for Joy', price: 150, sort: 90 },
  { id: 'anniversary-celebrate', name: 'Anniversary Cake', price: 200, sort: 100 },
  { id: 'vault-glowing', name: 'Glowing Keepsake', price: 200, sort: 110 },
  { id: 'streak-celebrate', name: 'Streak Party', price: 250, sort: 120 },
];

export async function fetchCatalog(): Promise<CatalogItem[]> {
  if (!isSupabaseConfigured()) return SHOP_CATALOG;
  try {
    const { data, error } = await getSupabase()
      .from('illustration_catalog')
      .select('id, name, price, sort')
      .eq('active', true)
      .order('sort');
    if (error || !data || data.length === 0) return SHOP_CATALOG;
    return data as CatalogItem[];
  } catch {
    return SHOP_CATALOG;
  }
}

export async function fetchMyOwnership(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await getSupabase().from('illustration_ownership').select('illustration_id');
    if (error || !data) return [];
    return data.map((r: { illustration_id: string }) => r.illustration_id);
  } catch {
    return [];
  }
}

export async function fetchEquipped(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabase()
      .from('equipped_illustration')
      .select('illustration_id')
      .maybeSingle();
    if (error || !data) return null;
    return (data as { illustration_id: string }).illustration_id;
  } catch {
    return null;
  }
}

export type PurchaseResult = { ok: true; balance: number } | { ok: false; reason: string };

export async function purchaseIllustration(id: string): Promise<PurchaseResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'Shop is not available yet.' };
  try {
    const { data, error } = await getSupabase().rpc('purchase_illustration', { p_illustration_id: id });
    if (error) return { ok: false, reason: humanisePurchaseError(error.message) };
    const balance = (data as { balance?: number } | null)?.balance ?? 0;
    return { ok: true, balance };
  } catch {
    return { ok: false, reason: 'Something went wrong. Please try again.' };
  }
}

export async function equipIllustration(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await getSupabase().rpc('equip_illustration', { p_illustration_id: id });
    return !error;
  } catch {
    return false;
  }
}

function humanisePurchaseError(message: string): string {
  if (/insufficient points/i.test(message)) return "You don't have enough points yet.";
  if (/already owned/i.test(message)) return 'You already own this one.';
  if (/no active couple/i.test(message)) return 'Connect with your partner first.';
  return 'Could not complete the purchase.';
}

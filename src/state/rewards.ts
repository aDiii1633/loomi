/**
 * Rewards store: points balance, owned illustrations, equipped illustration.
 * All authority is server-side (migrations 0005/0006) — this store only
 * caches what the server returns and forwards purchase/equip through RPCs.
 * Until those migrations are applied every call is a safe no-op and the
 * balance stays 0.
 */
import { create } from 'zustand';
import { dayISO } from '../domain/datetime';
import { getMyPoints, awardDailyStreak } from '../data/backend/points';
import {
  fetchCatalog,
  fetchEquipped,
  fetchMyOwnership,
  purchaseIllustration,
  equipIllustration,
  type CatalogItem,
} from '../data/backend/shop';

interface RewardsState {
  loaded: boolean;
  points: number;
  catalog: CatalogItem[];
  owned: string[];
  equipped: string | null;
  /** guards a redundant award RPC within one app run (server is idempotent
   * regardless, this just avoids the round-trip). */
  lastAwardedDay: string | null;

  refresh: () => Promise<void>;
  awardStreak: (coupleId: string, day?: string) => Promise<void>;
  purchase: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  equip: (id: string) => Promise<boolean>;
}

export const useRewardsStore = create<RewardsState>((set, get) => ({
  loaded: false,
  points: 0,
  catalog: [],
  owned: [],
  equipped: null,
  lastAwardedDay: null,

  refresh: async () => {
    const [points, catalog, owned, equipped] = await Promise.all([
      getMyPoints(),
      fetchCatalog(),
      fetchMyOwnership(),
      fetchEquipped(),
    ]);
    set({ points, catalog, owned, equipped, loaded: true });
  },

  awardStreak: async (coupleId, day = dayISO()) => {
    if (!coupleId || get().lastAwardedDay === day) return;
    const balance = await awardDailyStreak(coupleId, day);
    set({ lastAwardedDay: day, ...(balance != null ? { points: balance } : {}) });
  },

  purchase: async (id) => {
    const res = await purchaseIllustration(id);
    if (res.ok) {
      set((s) => ({ points: res.balance, owned: s.owned.includes(id) ? s.owned : [...s.owned, id] }));
      return { ok: true };
    }
    return { ok: false, reason: res.reason };
  },

  equip: async (id) => {
    const ok = await equipIllustration(id);
    if (ok) set({ equipped: id });
    return ok;
  },
}));

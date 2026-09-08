/**
 * Session store: who the signed-in user is, who their partner is, and which
 * couple they belong to. Three entry paths:
 *
 * 1. Dev bypass (__DEV__ only, never in release builds): the seeded demo
 *    couple, exactly as before.
 * 2. Real Clerk session: `setSelfFromClerk` records the authenticated
 *    identity, then `refreshCouple` hydrates self/partner/couple from
 *    Supabase (public.users + couple_members + couples, all RLS-gated).
 *    Nothing is fabricated: until the backend confirms an active couple,
 *    partner/couple stay null and the router keeps the user on the
 *    connection screen.
 */
import { create } from 'zustand';
import type { Couple, User } from '../domain/types';
import { getCouple, getPartner, getSelf } from '../data/repositories/couple';
import { fetchMyCoupleSnapshot } from '../data/backend/couples';
import { isSupabaseConfigured } from '../data/backend/supabaseClient';

interface SessionState {
  ready: boolean;
  self: User | null;
  partner: User | null;
  couple: Couple | null;
  /** True once this Clerk-authenticated user has an ACTIVE couple confirmed
   * by the backend. False for every real user until then — never assumed
   * true just because someone is signed in. */
  hasCouple: boolean;
  /** null = no blocker; otherwise a screen name to show instead of the app */
  authGate: null | 'signin_required';
  /** Local dev-identity path (Aditya/Maya seed data) — __DEV__ convenience
   * only, never reachable from a production build. See app/_layout.tsx. */
  hydrate: () => void;
  /** Records the authenticated Clerk identity without claiming any couple.
   * `clerkUserId` is kept for the profile bootstrap; the session's `self.id`
   * becomes the backend's internal users.id once `refreshCouple` succeeds
   * (author ids in local rows then match Supabase users.id exactly). */
  setSelfFromClerk: (user: { clerkUserId: string; name: string }) => void;
  /** Queries the backend for the caller's profile + active couple. Safe to
   * call repeatedly (idempotent bootstrap RPC). Returns true when an active
   * couple exists. When Supabase is unconfigured this is a no-op. */
  refreshCouple: () => Promise<boolean>;
  /** True while a backend couple lookup is in flight (drives waiting UI). */
  coupleLookupPending: boolean;
  signOutLocal: () => void;
}

/** The connected day is an honest anniversary fallback: until the couple
 * sets their real start date (profile → relationship date), Loomi counts
 * from the day the couple actually became active on the backend. */
function anniversaryFromCouple(c: { anniversary_date: string | null; updated_at?: string }): string {
  if (c.anniversary_date) return c.anniversary_date;
  if (c.updated_at) return c.updated_at.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ready: false,
  self: null,
  partner: null,
  couple: null,
  hasCouple: false,
  authGate: null,
  coupleLookupPending: false,
  hydrate: () => {
    // Dev identity path. A production build must go through real auth before
    // reaching here; see src/dev/devIdentity.ts.
    set({
      self: getSelf(),
      partner: getPartner(),
      couple: getCouple(),
      hasCouple: true,
      ready: true,
      authGate: null,
    });
  },
  setSelfFromClerk: (user) => {
    set({
      self: { id: user.clerkUserId, name: user.name, isSelf: true },
      partner: null,
      couple: null,
      hasCouple: false,
      ready: true,
      authGate: null,
    });
  },
  refreshCouple: async () => {
    if (!isSupabaseConfigured()) return false;
    const self = get().self;
    if (!self) return false;
    set({ coupleLookupPending: true });
    try {
      const snapshot = await fetchMyCoupleSnapshot(self.name || 'You');
      if (!snapshot) {
        // Authenticated, profile bootstrapped, but no couple yet.
        set({ coupleLookupPending: false, hasCouple: false, partner: null, couple: null });
        return false;
      }
      const { me, couple, partner } = snapshot;
      const nextSelf: User = { id: me.id, name: me.display_name || self.name, isSelf: true };
      const nextCouple: Couple = {
        id: couple.id,
        partnerAId: me.id,
        partnerBId: partner?.id ?? '',
        anniversaryISO: anniversaryFromCouple(couple),
        level: couple.level ?? 1,
        isLinked: couple.status === 'active',
      };
      if (couple.status !== 'active' || !partner) {
        // Couple exists but the partner hasn't accepted yet.
        set({
          self: nextSelf,
          couple: nextCouple,
          partner: null,
          hasCouple: false,
          coupleLookupPending: false,
        });
        return false;
      }
      set({
        self: nextSelf,
        partner: { id: partner.id, name: partner.display_name || 'Your person', isSelf: false },
        couple: nextCouple,
        hasCouple: true,
        coupleLookupPending: false,
      });
      return true;
    } catch (e) {
      set({ coupleLookupPending: false });
      throw e;
    }
  },
  signOutLocal: () => {
    set({ self: null, partner: null, couple: null, hasCouple: false, ready: false });
    // Fire-and-forget: none of this account's couple data may survive on the
    // device for the next account — wipe SQLite rows, media files and every
    // in-memory store. Lazy imports keep the session store free of cycles.
    void (async () => {
      try {
        const [{ wipeDatabase }, { clearMediaFiles }] = await Promise.all([
          import('../data/db'),
          import('../data/media'),
        ]);
        await wipeDatabase();
        await clearMediaFiles();
      } catch {
        // A failed wipe must not crash sign-out; the local cache is
        // key-scoped per couple so stale rows are inert for other accounts.
      }
      const { useChatStore } = await import('./chat');
      const { useConnectionStore } = await import('./connection');
      const {
        useMemoriesStore, useJournalStore, useTimelineStore, useVaultStore,
        useBucketStore, useGoalsStore, useRemindersStore, useDatesStore,
      } = await import('./life');
      const { useGamesStore, useChallengesStore } = await import('./activities');
      useChatStore.setState({ messages: [], loaded: false, loading: false, error: null, sending: false });
      useConnectionStore.setState({
        loaded: false, today: null, selfMoodToday: undefined, partnerMoodToday: undefined,
        moodsHistory: [], answersHistory: [], historyDays: [], streak: null,
        streakActivityDays: [], ritualDoneToday: false, loading: false, error: null,
      });
      for (const store of [
        useMemoriesStore, useJournalStore, useTimelineStore, useVaultStore,
        useBucketStore, useGoalsStore, useRemindersStore, useDatesStore,
        useGamesStore, useChallengesStore,
      ]) {
        // Different store shapes share this reset need; narrow to the setState
        // partial each of them accepts.
        (store as unknown as { setState: (partial: { loaded: boolean }) => void }).setState({ loaded: false });
      }
    })();
  },
}));

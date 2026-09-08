/**
 * Runtime identity resolution for all data stores.
 *
 * Feature data must never be keyed off the hard-coded dev identity: the
 * couple/self/partner ids come from the session store, which is populated
 * either by the dev bypass (__DEV__ only) or by the real backend lookup
 * (refreshCouple). When no couple is linked — every brand-new real user —
 * `currentIds()` returns null and stores must show honest empty states
 * instead of writing rows under a fake couple id.
 */
import { useSessionStore } from './session';
import { DEV_IDS } from '../dev/devIdentity';

export interface Identity {
  selfId: string;
  partnerId: string;
  coupleId: string;
}

export function currentIdentity(): Identity | null {
  const { self, partner, couple, hasCouple } = useSessionStore.getState();
  if (!self || !couple) return null;
  if (hasCouple && partner) {
    return { selfId: self.id, partnerId: partner.id, coupleId: couple.id };
  }
  // Dev bypass couples have a partner object too; a real pending couple
  // (partner null) must NOT get a fake partner id — fall back to the dev
  // ids only inside __DEV__ so local tooling keeps working.
  if (__DEV__) {
    return { selfId: self.id, partnerId: partner?.id ?? DEV_IDS.partnerId, coupleId: couple.id };
  }
  return null;
}

/** Thrown by store mutations attempted before a couple exists. The router
 * normally prevents this (unlinked users live on /link-couple), so this is
 * a safety net rather than a primary UX path. */
export class NoCoupleError extends Error {
  constructor() {
    super('Connect with your partner first.');
    this.name = 'NoCoupleError';
  }
}

export function requireIdentity(): Identity {
  const ids = currentIdentity();
  if (!ids) throw new NoCoupleError();
  return ids;
}

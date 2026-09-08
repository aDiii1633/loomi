/**
 * Games + challenges store. Identity comes from the session at call time.
 * In __DEV__ the partner plays along with a simulated payload so the whole
 * flow is exercisable solo; a production build never fabricates partner
 * participation — the session simply waits until the partner's real state
 * arrives via sync.
 */
import { create } from 'zustand';
import type { ChallengeProgress, GameSession, GameId, GamePlayerState, GameResult } from '../domain/types';
import * as gamesRepo from '../data/repositories/games';
import * as challengesRepo from '../data/repositories/challenges';
import { CHALLENGES } from '../domain/challenges';
import { buildResult } from '../domain/games';
import { dayISO } from '../domain/datetime';
import { newId } from '../data/media';
import { currentIdentity, requireIdentity } from './identity';
import { pullSince, pushDirty } from '../data/backend/sync';
import { pushLocal, makeNotificationId } from '../data/repositories/notifications';
import { track } from '../services/analytics';

interface GamesState {
  loaded: boolean;
  sessions: GameSession[];
  refresh: () => Promise<void>;
  ensureSession: (gameId: GameId) => Promise<GameSession>;
  saveProgress: (sessionId: string, selfState: GamePlayerState, opts?: { complete?: boolean; result?: GameResult }) => Promise<GameSession>;
  finishSession: (sessionId: string, selfState: GamePlayerState) => Promise<GameSession>;
}

export const useGamesStore = create<GamesState>((set, get) => ({
  loaded: false,
  sessions: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ sessions: [], loaded: true });
      return;
    }
    const sessions = await gamesRepo.listSessions(ids.coupleId);
    set({ sessions, loaded: true });
  },
  ensureSession: async (gameId) => {
    const { selfId, partnerId, coupleId } = requireIdentity();
    const day = dayISO();
    const existing = await gamesRepo.findActiveSession(coupleId, gameId, day);
    if (existing) return existing;
    const session: GameSession = {
      id: newId('game'),
      coupleId,
      gameId,
      dayISO: day,
      players: { [selfId]: { finished: false }, [partnerId]: { finished: false } },
      status: 'active',
      startedAt: Date.now(),
      sync: 'synced',
      updatedAt: Date.now(),
    };
    await gamesRepo.saveSession(session);
    track('game_started', { gameId });
    await get().refresh();
    return session;
  },
  saveProgress: async (sessionId, selfState, opts) => {
    const { selfId } = requireIdentity();
    const session = await gamesRepo.getSession(sessionId);
    if (!session) throw new Error('Game session not found.');
    const next: GameSession = {
      ...session,
      players: { ...session.players, [selfId]: selfState },
      status: opts?.complete ? 'complete' : session.status,
      completedAt: opts?.complete ? Date.now() : session.completedAt,
      result: opts?.result ?? session.result,
    };
    const saved = await gamesRepo.saveSession(next);
    await get().refresh();
    return saved;
  },
  finishSession: async (sessionId, selfState) => {
    const ids = requireIdentity();
    const { selfId, partnerId } = ids;
    const session = await gamesRepo.getSession(sessionId);
    if (!session) throw new Error('Game session not found.');

    const players: GameSession['players'] = { ...session.players, [selfId]: selfState };

    if (__DEV__) {
      // Dev realtime simulation: the partner plays along and finishes with
      // you so the whole result flow is exercisable solo. Never reachable in
      // a production build.
      players[partnerId] = gamesRepo.partnerPayloadFor(session.gameId, selfState.payload, partnerId);
    }

    const partnerFinished = players[partnerId]?.finished ?? false;
    const both: GameSession = {
      ...session,
      players,
      status: partnerFinished ? 'complete' : session.status,
      completedAt: partnerFinished ? Date.now() : session.completedAt,
    };
    // A result only exists once BOTH partners have a real (or, dev-only,
    // simulated) finished state — never from one side alone.
    const result = partnerFinished ? buildResult(session.gameId, selfState, players[partnerId]) : undefined;
    const finished: GameSession = { ...both, result: result ?? session.result };
    const saved = await gamesRepo.saveSession(finished);
    if (partnerFinished && result) {
      await pushLocal({
        id: makeNotificationId(),
        kind: 'game',
        title: 'Game finished',
        body: result.summary,
        createdAt: Date.now(),
        route: '/together',
      });
      track('game_completed', { gameId: session.gameId });
    }
    await get().refresh();
    return saved;
  },
}));

/* -------------------------------- challenges ------------------------------- */

interface ChallengesState {
  loaded: boolean;
  progress: ChallengeProgress[];
  refresh: () => Promise<void>;
  start: (challengeId: string) => Promise<void>;
  checkInToday: (progressId: string) => Promise<void>;
  abandon: (progressId: string) => Promise<void>;
}

export const useChallengesStore = create<ChallengesState>((set, get) => ({
  loaded: false,
  progress: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ progress: [], loaded: true });
      return;
    }
    await pullSince('challenge_progress', ids.coupleId);
    const progress = await challengesRepo.listProgress(ids.coupleId);
    set({ progress, loaded: true });
  },
  start: async (challengeId) => {
    const { coupleId } = requireIdentity();
    const def = CHALLENGES.find((c) => c.id === challengeId);
    if (!def) return;
    await challengesRepo.saveProgress({
      id: newId('challenge'),
      challengeId,
      coupleId,
      startedOnISO: dayISO(),
      completedOnISOs: [],
      status: 'active',
      sync: 'synced',
      updatedAt: Date.now(),
    });
    void pushDirty('challenge_progress', coupleId);
    await get().refresh();
  },
  checkInToday: async (progressId) => {
    const { coupleId } = requireIdentity();
    const p = get().progress.find((x) => x.id === progressId);
    if (!p) return;
    const def = CHALLENGES.find((c) => c.id === p.challengeId);
    const today = dayISO();
    if (p.completedOnISOs.includes(today)) return;
    const completed = [...p.completedOnISOs, today];
    const status: ChallengeProgress['status'] =
      def && completed.length >= def.durationDays ? 'completed' : 'active';
    await challengesRepo.saveProgress({ ...p, completedOnISOs: completed, status });
    void pushDirty('challenge_progress', coupleId);
    await get().refresh();
  },
  abandon: async (progressId) => {
    const { coupleId } = requireIdentity();
    const p = get().progress.find((x) => x.id === progressId);
    if (!p) return;
    await challengesRepo.saveProgress({ ...p, status: 'abandoned' });
    void pushDirty('challenge_progress', coupleId);
    await get().refresh();
  },
}));

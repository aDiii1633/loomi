/**
 * Connection store: daily question flow, mood, ritual, and the derived
 * streak. All mutations go through repositories, streaks are recomputed
 * from real activities — nothing here is decorative. Identity comes from
 * the session at call time — never from hard-coded ids.
 */
import { create } from 'zustand';
import type { MoodEntry, QuestionAnswer, QuestionState, StreakActivity, StreakSnapshot } from '../domain/types';
import { questionOfDay, questionState } from '../domain/questionEngine';
import { computeStreak, foldActivities } from '../domain/streakEngine';
import { dayISO } from '../domain/datetime';
import { listRitualDays, listAnswersForDay, listRecentAnswerDays, upsertAnswer, upsertMood, listRecentMoodDays, completeRitual } from '../data/repositories/connection';
import { newId } from '../data/media';
import { activeChatDays } from '../data/repositories/chat';
import { gameDays } from '../data/repositories/games';
import { challengeDays } from '../data/repositories/challenges';
import { listMemories } from '../data/repositories/life';
import { currentIdentity, requireIdentity, type Identity } from './identity';
import { pullSince, pushDirty } from '../data/backend/sync';
import { track } from '../services/analytics';

export interface TodayConnection {
  dayISO: string;
  question: { id: string; text: string; category: string };
  selfAnswer?: QuestionAnswer;
  partnerAnswer?: QuestionAnswer;
  state: QuestionState;
  revealed: boolean;
}

interface ConnectionState {
  loaded: boolean;
  today: TodayConnection | null;
  selfMoodToday?: MoodEntry;
  partnerMoodToday?: MoodEntry;
  moodsHistory: MoodEntry[];
  answersHistory: QuestionAnswer[];
  historyDays: string[];
  streak: StreakSnapshot | null;
  /** Every day (YYYY-MM-DD) that had at least one qualifying activity — drives the streak calendar. */
  streakActivityDays: string[];
  ritualDoneToday: boolean;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  submitAnswer: (text: string) => Promise<void>;
  setMood: (emoji: string, label: string, note?: string) => Promise<void>;
  completeRitualToday: (kind: 'voice_note' | 'checkin', mediaId?: string) => Promise<void>;
}

async function buildStreak(ids: Identity): Promise<{ snapshot: StreakSnapshot; activityDays: string[] }> {
  const { coupleId } = ids;
  const [questionDays, ritualDays, moodDays, chatDays, gDays, cDays] = await Promise.all([
    listRecentAnswerDays(coupleId, 400),
    listRitualDays(coupleId, 400),
    listRecentMoodDays(coupleId, 800).then((rows) => [...new Set(rows.map((r) => r.dayISO))]),
    activeChatDays(coupleId),
    gameDays(coupleId),
    challengeDays(coupleId),
  ]);
  const memoryDays = await listMemories(coupleId, 400).then((rows) =>
    rows.map((m) => m.takenAtISO)
  );
  const activities: StreakActivity[] = foldActivities({
    questionDays, ritualDays, moodDays, gameDays: gDays, challengeDays: cDays, chatDays, memoryDays,
  });
  return { snapshot: computeStreak(activities), activityDays: activities.map((a) => a.dayISO) };
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  loaded: false,
  today: null,
  moodsHistory: [],
  answersHistory: [],
  historyDays: [],
  streak: null,
  streakActivityDays: [],
  ritualDoneToday: false,
  loading: false,
  error: null,

  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      // No linked couple yet — an honest blank slate, not fake history.
      set({
        loaded: true,
        loading: false,
        error: null,
        today: null,
        selfMoodToday: undefined,
        partnerMoodToday: undefined,
        moodsHistory: [],
        answersHistory: [],
        historyDays: [],
        streak: null,
        streakActivityDays: [],
        ritualDoneToday: false,
      });
      return;
    }
    const { selfId, partnerId, coupleId } = ids;
    const wasRevealed = get().today?.revealed ?? false;
    set({ loading: true, error: null });
    try {
      const today = dayISO();
      // Cloud-first merge so partner activity (moods, answers, rituals)
      // recorded on their device shows up here.
      await Promise.all([
        pullSince('moods', coupleId),
        pullSince('question_answers', coupleId),
        pullSince('ritual_completions', coupleId),
      ]);
      const [answers, ritualDays, streakResult, moods, answerHistoryDays] = await Promise.all([
        listAnswersForDay(coupleId, today),
        listRitualDays(coupleId, 30),
        buildStreak(ids),
        listRecentMoodDays(coupleId, 60),
        listRecentAnswerDays(coupleId, 30),
      ]);
      const q = questionOfDay(today);
      const selfAnswer = answers.find((a) => a.authorId === selfId);
      const partnerAnswer = answers.find((a) => a.authorId === partnerId);
      const state = questionState(answers, selfId, partnerId);
      set({
        loaded: true,
        loading: false,
        today: {
          dayISO: today,
          question: q,
          selfAnswer,
          partnerAnswer,
          state,
          revealed: state === 'unlocked',
        },
        selfMoodToday: moods.find((m) => m.dayISO === today && m.authorId === selfId),
        partnerMoodToday: moods.find((m) => m.dayISO === today && m.authorId === partnerId),
        moodsHistory: moods,
        historyDays: answerHistoryDays,
        streak: streakResult.snapshot,
        streakActivityDays: streakResult.activityDays,
        ritualDoneToday: ritualDays.includes(today),
      });
      if (!wasRevealed && state === 'unlocked') track('daily_question_revealed');
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load your connection data.' });
    }
  },

  submitAnswer: async (text) => {
    const { selfId, coupleId } = requireIdentity();
    const t = get().today;
    if (!t || !text.trim()) return;
    await upsertAnswer({
      id: newId('qa'),
      coupleId,
      questionId: t.question.id,
      dayISO: t.dayISO,
      authorId: selfId,
      text: text.trim(),
      submittedAt: Date.now(),
    });
    void pushDirty('question_answers', coupleId);
    track('daily_question_answered');
    await get().refresh();
  },

  setMood: async (emoji, label, note) => {
    const { selfId, coupleId } = requireIdentity();
    await upsertMood({
      id: newId('mood'),
      coupleId,
      authorId: selfId,
      dayISO: dayISO(),
      emoji,
      label,
      note,
      createdAt: Date.now(),
    });
    void pushDirty('moods', coupleId);
    track('mood_submitted', { hasNote: !!note });
    await get().refresh();
  },

  completeRitualToday: async (kind, mediaId) => {
    const { selfId, coupleId } = requireIdentity();
    await completeRitual({ coupleId, authorId: selfId, kind, mediaId });
    void pushDirty('ritual_completions', coupleId);
    await get().refresh();
  },
}));

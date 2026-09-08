/**
 * Streak engine.
 *
 * The streak is DERIVED from qualifying activities — never stored as a
 * decorative number. A day qualifies when either partner completed at least
 * one qualifying activity (daily question answered, a ritual, mood set,
 * game played, challenge check-in, chat message, or memory saved).
 *
 * Consecutive-day semantics use real calendar days (DST-safe via date-fns).
 */
import type { StreakActivity, StreakSnapshot, StreakActivityKind } from './types';
import { addDaysISO, dayISO, daysBetweenISO } from './datetime';

export const STREAK_MILESTONES: { label: string; atDay: number }[] = [
  { label: 'Bronze Sprout', atDay: 7 },
  { label: 'Silver Bloom', atDay: 30 },
  { label: 'Golden Bough', atDay: 100 },
  { label: 'Evergreen', atDay: 365 },
];

/** The range of days we look back when computing from raw activities. */
const LOOKBACK_DAYS = 400;

export function computeStreak(
  activities: readonly StreakActivity[],
  todayISO: string = dayISO()
): StreakSnapshot {
  const byDay = new Map<string, Set<StreakActivityKind>>();
  for (const a of activities) {
    const set = byDay.get(a.dayISO) ?? new Set<StreakActivityKind>();
    a.kinds.forEach((k) => set.add(k));
    byDay.set(a.dayISO, set);
  }

  // Walk backwards from today (or yesterday if today hasn't qualified yet —
  // the streak is still alive until the day ENDS without activity).
  let cursor = byDay.has(todayISO) ? todayISO : addDaysISO(todayISO, -1);
  let current = 0;
  let guard = 0;
  while (byDay.has(cursor) && guard < LOOKBACK_DAYS) {
    current += 1;
    cursor = addDaysISO(cursor, -1);
    guard += 1;
  }

  // Longest streak within the lookback window.
  let longest = 0;
  let run = 0;
  let probe = addDaysISO(todayISO, -LOOKBACK_DAYS);
  for (let i = 0; i <= LOOKBACK_DAYS; i++) {
    if (byDay.has(probe)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
    probe = addDaysISO(probe, 1);
  }
  longest = Math.max(longest, current);

  const lastActiveDayISO = activities.length
    ? activities
        .map((a) => a.dayISO)
        .reduce((acc, d) => (daysBetweenISO(acc, d) >= 0 ? d : acc))
    : null;

  const nextMilestone =
    STREAK_MILESTONES.find((m) => m.atDay > current) ?? null;

  return {
    current,
    longest,
    lastActiveDayISO,
    qualifiesToday: byDay.has(todayISO),
    nextMilestone,
  };
}

/** Fold raw daily-question answers / moods / games etc. into streak activities. */
export function foldActivities(
  input: {
    questionDays: string[];
    ritualDays: string[];
    moodDays: string[];
    gameDays: string[];
    challengeDays: string[];
    chatDays: string[];
    memoryDays: string[];
  }
): StreakActivity[] {
  const map = new Map<string, StreakActivityKind[]>();
  const push = (days: string[], kind: StreakActivityKind) => {
    for (const d of days) {
      const list = map.get(d) ?? [];
      if (!list.includes(kind)) list.push(kind);
      map.set(d, list);
    }
  };
  push(input.questionDays, 'daily_question');
  push(input.ritualDays, 'ritual');
  push(input.moodDays, 'mood');
  push(input.gameDays, 'game');
  push(input.challengeDays, 'challenge');
  push(input.chatDays, 'chat');
  push(input.memoryDays, 'memory');
  return [...map.entries()]
    .map(([dayISO, kinds]) => ({ dayISO: dayISO, kinds }))
    .sort((a, b) => a.dayISO.localeCompare(b.dayISO));
}

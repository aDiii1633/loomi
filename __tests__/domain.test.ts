import { computeStreak, foldActivities, STREAK_MILESTONES } from '../src/domain/streakEngine';
import { questionOfDay, questionState, isRevealed } from '../src/domain/questionEngine';
import { scoreQuiz, scoreThisOrThat, scoreMemoryMatch, pickQuizQuestions } from '../src/domain/games';
import {
  validateDayISO,
  validatePin,
  validateReminderDue,
  validateText,
  isDuplicateTitle,
  validatePassword,
  MIN_PASSWORD_LENGTH,
} from '../src/domain/validation';
import {
  toggleMilestoneDone,
  removeMilestone,
  addMilestone,
  milestoneStats,
  validateMilestoneTitle,
} from '../src/domain/goals';
import { daysTogether, daysUntil, addDaysISO, dayISO, isValidDayISO } from '../src/domain/datetime';
import { haversineKm, formatDistance } from '../src/domain/geo';
import { getHomePriority } from '../src/domain/homePriority';
import type { QuizQuestion } from '../src/domain/games';
import type { GoalMilestone } from '../src/domain/types';

describe('streak engine', () => {
  const today = dayISO();

  it('counts consecutive days from real activities', () => {
    const days = Array.from({ length: 5 }, (_, i) => addDaysISO(today, -(4 - i)));
    const activities = foldActivities({ questionDays: days, ritualDays: [], moodDays: [], gameDays: [], challengeDays: [], chatDays: [], memoryDays: [] });
    const snap = computeStreak(activities, today);
    expect(snap.current).toBe(5);
    expect(snap.qualifiesToday).toBe(true);
  });

  it('keeps the streak alive when today has no activity yet (yesterday qualified)', () => {
    const yesterday = addDaysISO(today, -1);
    const activities = foldActivities({ questionDays: [yesterday], ritualDays: [], moodDays: [], gameDays: [], challengeDays: [], chatDays: [], memoryDays: [] });
    const snap = computeStreak(activities, today);
    expect(snap.current).toBe(1);
    expect(snap.qualifiesToday).toBe(false);
  });

  it('breaks the streak after a fully missed day', () => {
    const threeDaysAgo = addDaysISO(today, -3);
    const activities = foldActivities({ questionDays: [threeDaysAgo], ritualDays: [], moodDays: [], gameDays: [], challengeDays: [], chatDays: [], memoryDays: [] });
    const snap = computeStreak(activities, today);
    expect(snap.current).toBe(0);
  });

  it('reports the next milestone correctly', () => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, -(6 - i)));
    const activities = foldActivities({ moodDays: days, ritualDays: [], questionDays: [], gameDays: [], challengeDays: [], chatDays: [], memoryDays: [] });
    const snap = computeStreak(activities, today);
    expect(snap.nextMilestone?.atDay).toBe(30);
    expect(STREAK_MILESTONES[0].atDay).toBe(7);
  });
});

describe('question engine', () => {
  it('is deterministic for a given day', () => {
    const a = questionOfDay('2026-09-04');
    const b = questionOfDay('2026-09-04');
    const c = questionOfDay('2026-09-05');
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it('moves through open -> waiting -> unlocked', () => {
    const selfId = 'self';
    const partnerId = 'partner';
    expect(questionState([], selfId, partnerId)).toBe('open');
    expect(questionState([{ authorId: selfId, text: 'x' }], selfId, partnerId)).toBe('waiting_partner');
    expect(questionState([{ authorId: partnerId, text: 'y' }], selfId, partnerId)).toBe('waiting_self');
    const both = questionState(
      [
        { authorId: selfId, text: 'x' },
        { authorId: partnerId, text: 'y' },
      ],
      selfId,
      partnerId
    );
    expect(both).toBe('unlocked');
    expect(isRevealed(both)).toBe(true);
  });

  it('treats a whitespace-only answer as not answered', () => {
    // The engine filters blank submissions — the day stays "open" until real
    // text is sealed, so an empty answer can never trigger an unlock.
    expect(questionState([{ authorId: 'self', text: '  ' }], 'self', 'partner')).toBe('open');
  });
});

describe('game scoring', () => {
  it('scores the quiz from real answers', () => {
    const questions = pickQuizQuestions(3, 'seed');
    const answers = questions.map((q: QuizQuestion) => q.correctIndex);
    expect(scoreQuiz(answers, questions)).toBe(3);
    expect(scoreQuiz(answers.map(() => null), questions)).toBe(0);
  });

  it('computes this-or-that match percentage', () => {
    expect(scoreThisOrThat(['a', 'b', 'a'], ['a', 'b', 'a'])).toBe(100);
    expect(scoreThisOrThat(['a', 'a', 'a'], ['b', 'b', 'b'])).toBe(0);
    expect(scoreThisOrThat(['a', 'b'], ['a', 'a'])).toBe(50);
  });

  it('penalizes memory-match moves and slow time but stays positive', () => {
    expect(scoreMemoryMatch(8, 10, 8)).toBe(100);
    expect(scoreMemoryMatch(20, 120, 8)).toBeLessThan(100);
    expect(scoreMemoryMatch(60, 900, 8)).toBeGreaterThanOrEqual(10);
  });
});

describe('validation', () => {
  it('validates day ISO strictly', () => {
    expect(validateDayISO('2022-06-14').ok).toBe(true);
    expect(validateDayISO('2022-13-01').ok).toBe(false);
    expect(validateDayISO('2022-02-30').ok).toBe(false);
    expect(validateDayISO('not-a-date').ok).toBe(false);
  });

  it('accepts a 6-character password and rejects shorter ones', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(validatePassword('abcde').ok).toBe(false); // 5 chars
    expect(validatePassword('abcdef').ok).toBe(true); // exactly 6
    expect(validatePassword('a longer passphrase').ok).toBe(true);
    expect(validatePassword('x'.repeat(129)).ok).toBe(false);
  });

  it('rejects weak PINs but accepts reasonable ones', () => {
    expect(validatePin('1234').ok).toBe(false);
    expect(validatePin('1111').ok).toBe(false);
    expect(validatePin('12').ok).toBe(false);
    expect(validatePin('3159').ok).toBe(true);
    expect(validatePin('315942').ok).toBe(true);
  });

  it('rejects reminders in the past', () => {
    expect(validateReminderDue(Date.now() - 60_000 * 10).ok).toBe(false);
    expect(validateReminderDue(Date.now() + 60_000 * 10).ok).toBe(true);
  });

  it('trims and bounds text', () => {
    expect(validateText('  hello  ', 'chat').ok).toBe(true);
    expect(validateText('    ', 'chat').ok).toBe(false);
    expect(validateText('x'.repeat(3000), 'chat').ok).toBe(false);
  });

  it('detects duplicates case-insensitively with exclusions', () => {
    const items = [{ id: '1', title: 'Goa Trip' }, { id: '2', title: 'Marathon' }];
    expect(isDuplicateTitle(items, (i) => i.title, '  goa trip ')).toBe(true);
    expect(isDuplicateTitle(items, (i) => i.title, 'Goa Trip', '1', (i) => i.id)).toBe(false);
  });
});

describe('goal milestones', () => {
  const base: GoalMilestone[] = [
    { id: 'm1', title: 'Book stays', done: true },
    { id: 'm2', title: 'Pack bags', done: false },
    { id: 'm3', title: 'Leave', done: false },
  ];

  it('toggles a single milestone without touching the others', () => {
    const next = toggleMilestoneDone(base, 'm2');
    expect(next.find((m) => m.id === 'm2')?.done).toBe(true);
    expect(next.find((m) => m.id === 'm1')?.done).toBe(true);
    expect(next).not.toBe(base); // immutable
    expect(toggleMilestoneDone(next, 'm2').find((m) => m.id === 'm2')?.done).toBe(false);
  });

  it('adds and removes milestones immutably', () => {
    const added = addMilestone(base, { id: 'm4', title: 'Return', done: false });
    expect(added).toHaveLength(4);
    expect(removeMilestone(added, 'm4')).toHaveLength(3);
    expect(removeMilestone(base, 'nope')).toHaveLength(3);
  });

  it('derives stats from real milestone state', () => {
    expect(milestoneStats([])).toEqual({ total: 0, done: 0, ratio: 0, allDone: false });
    const s = milestoneStats(base);
    expect(s).toMatchObject({ total: 3, done: 1, allDone: false });
    expect(s.ratio).toBeCloseTo(1 / 3);
    expect(milestoneStats(base.map((m) => ({ ...m, done: true }))).allDone).toBe(true);
  });

  it('validates new milestone titles (empty, long, duplicate, cap)', () => {
    expect(validateMilestoneTitle('   ', base).ok).toBe(false);
    expect(validateMilestoneTitle('x'.repeat(81), base).ok).toBe(false);
    expect(validateMilestoneTitle('  book stays ', base).ok).toBe(false); // case-insensitive dupe
    const okRes = validateMilestoneTitle('  Confirm dates  ', base);
    expect(okRes.ok).toBe(true);
    if (okRes.ok) expect(okRes.title).toBe('Confirm dates');
    const full: GoalMilestone[] = Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, title: `s${i}`, done: false }));
    expect(validateMilestoneTitle('one more', full).ok).toBe(false);
  });
});

describe('geo', () => {
  it('measures great-circle distance within ~1%', () => {
    // Mumbai (Bandra) -> Pune, ~120 km straight line.
    const d = haversineKm({ lat: 19.06, lon: 72.84 }, { lat: 18.52, lon: 73.86 });
    expect(d).toBeGreaterThan(115);
    expect(d).toBeLessThan(125);
    expect(haversineKm({ lat: 19.06, lon: 72.84 }, { lat: 19.06, lon: 72.84 })).toBe(0);
  });

  it('formats distance by magnitude', () => {
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(2.345)).toBe('2.3 km');
    expect(formatDistance(42.7)).toBe('43 km');
    expect(formatDistance(NaN)).toBe('—');
  });
});

describe('datetime helpers', () => {
  it('round-trips day ISO', () => {
    const iso = '2026-09-04';
    expect(isValidDayISO(iso)).toBe(true);
    expect(addDaysISO(iso, 1)).toBe('2026-09-05');
    expect(addDaysISO(iso, -1)).toBe('2026-09-03');
  });

  it('counts days together inclusively', () => {
    expect(daysTogether('2026-09-01', new Date('2026-09-04T12:00:00').getTime())).toBe(4);
  });

  it('computes the next yearly occurrence', () => {
    const days = daysUntil('2022-06-14', true);
    expect(Number.isFinite(days)).toBe(true);
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(366);
  });
});

describe('home priority strategy', () => {
  const empty = { draft: null, questionState: null, nextDate: null, goalNeedingAttention: null } as const;

  it('puts an unsaved draft above everything else', () => {
    const result = getHomePriority({
      ...empty,
      draft: { label: 'The balcony morning', route: '/journal' },
      questionState: 'open',
      nextDate: { title: 'Anniversary', days: 0 },
    });
    expect(result).toEqual({ kind: 'draft', label: 'The balcony morning', route: '/journal' });
  });

  it('surfaces an imminent date over the daily question', () => {
    const result = getHomePriority({ ...empty, nextDate: { title: 'Anniversary', days: 1 }, questionState: 'open' });
    expect(result).toEqual({ kind: 'date', title: 'Anniversary', days: 1 });
  });

  it('ignores a date that is not imminent yet', () => {
    const result = getHomePriority({ ...empty, nextDate: { title: 'Anniversary', days: 10 }, questionState: 'open' });
    expect(result.kind).toBe('question');
  });

  it('flags the question as urgent only when the partner is waiting', () => {
    expect(getHomePriority({ ...empty, questionState: 'waiting_self' })).toEqual({ kind: 'question', urgent: true });
    expect(getHomePriority({ ...empty, questionState: 'open' })).toEqual({ kind: 'question', urgent: false });
  });

  it('does not prioritize the question once answered or revealed', () => {
    expect(getHomePriority({ ...empty, questionState: 'waiting_partner' }).kind).not.toBe('question');
    expect(getHomePriority({ ...empty, questionState: 'unlocked' }).kind).not.toBe('question');
  });

  it('surfaces a goal needing attention only within its window and when nothing more urgent exists', () => {
    const soon = getHomePriority({ ...empty, questionState: 'unlocked', goalNeedingAttention: { title: 'Goa Trip', daysLeft: 3 } });
    expect(soon).toEqual({ kind: 'goal', title: 'Goa Trip', daysLeft: 3 });
    const far = getHomePriority({ ...empty, questionState: 'unlocked', goalNeedingAttention: { title: 'Goa Trip', daysLeft: 30 } });
    expect(far.kind).toBe('none');
  });

  it('falls through to none when nothing is meaningfully urgent', () => {
    expect(getHomePriority({ ...empty, questionState: 'unlocked' })).toEqual({ kind: 'none' });
  });
});

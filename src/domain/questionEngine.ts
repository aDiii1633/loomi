/**
 * Daily question engine: deterministic question-of-the-day, private answers,
 * and mutual unlock. The question for a given day is derived from a stable
 * hash of the date, so both partners (and a future server) always agree on
 * the same question without any coordination.
 */
import type { DailyQuestion, QuestionAnswer, QuestionState } from './types';

export const QUESTION_BANK: DailyQuestion[] = [
  { id: 'q-connect-1', text: 'What is one thing you want us to experience together this month?', category: 'connection' },
  { id: 'q-connect-2', text: 'What gentle habit of ours brought you peace this week?', category: 'connection' },
  { id: 'q-connect-3', text: 'What is one tiny sound or smell that immediately takes you back to our early days?', category: 'connection' },
  { id: 'q-connect-4', text: 'What does a perfect slow Sunday look like for you?', category: 'connection' },
  { id: 'q-connect-5', text: 'When did you last feel most supported by me?', category: 'connection' },
  { id: 'q-mem-1', text: 'Which of our trips would you relive first, and why?', category: 'memories' },
  { id: 'q-mem-2', text: 'What is the funniest thing that happened on our first date?', category: 'memories' },
  { id: 'q-mem-3', text: 'Which meal of ours would you eat again tomorrow?', category: 'memories' },
  { id: 'q-dream-1', text: 'If we could move anywhere for one year, where would you choose?', category: 'dreams' },
  { id: 'q-dream-2', text: 'What is one dream you have not told many people about?', category: 'dreams' },
  { id: 'q-dream-3', text: 'What kind of home do you imagine us growing old in?', category: 'dreams' },
  { id: 'q-fun-1', text: 'Which fictional couple are we most like, honestly?', category: 'fun' },
  { id: 'q-fun-2', text: 'If we had a theme song, what would it be?', category: 'fun' },
  { id: 'q-fun-3', text: 'What is the weirdest snack combo you secretly enjoy?', category: 'fun' },
  { id: 'q-int-1', text: 'What is something new you would like us to try together?', category: 'intimacy' },
  { id: 'q-int-2', text: 'What makes you feel most loved in quiet, everyday moments?', category: 'intimacy' },
  { id: 'q-int-3', text: 'What is one thing you appreciate about us that others might not see?', category: 'intimacy' },
];

/** Stable string hash (FNV-1a) — identical on both devices and a server. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function questionOfDay(dayISOStr: string): DailyQuestion {
  const index = hashString(`twofold-qod::${dayISOStr}`) % QUESTION_BANK.length;
  return QUESTION_BANK[index];
}

export function questionState(
  answers: readonly Pick<QuestionAnswer, 'authorId' | 'text'>[],
  selfId: string,
  partnerId: string
): QuestionState {
  const self = answers.find((a) => a.authorId === selfId && !!a.text.trim());
  const partner = answers.find((a) => a.authorId === partnerId && !!a.text.trim());
  if (self && partner) return 'unlocked';
  if (self) return 'waiting_partner';
  if (partner) return 'waiting_self';
  return 'open';
}

/** Answers stay private until BOTH partners have submitted. */
export function isRevealed(state: QuestionState): boolean {
  return state === 'unlocked';
}

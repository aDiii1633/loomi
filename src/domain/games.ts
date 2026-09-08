/**
 * Game catalog and scoring. Each game is genuinely playable — scoring is
 * derived from real player state, never decorative.
 */
import type { GameDef, GameId, GamePlayerState, GameResult } from './types';

export const GAMES: GameDef[] = [
  {
    id: 'know-me-quiz',
    title: 'Know Me Quiz',
    tagline: 'Guess your partner’s answers and earn the Duo Spark.',
    icon: 'quiz',
    minPlayers: 2,
  },
  {
    id: 'this-or-that',
    title: 'This or That',
    tagline: 'Two choices, one heartbeat. See how you match.',
    icon: 'compare',
    minPlayers: 2,
  },
  {
    id: 'truth-or-dare',
    title: 'Truth or Dare',
    tagline: 'Gentle truths and sweet dares, made for two.',
    icon: 'fire',
    minPlayers: 2,
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    tagline: 'Flip and pair our favorite icons. Fewer moves, better score.',
    icon: 'grid',
    minPlayers: 1,
  },
];

/* ------------------------------- Know Me Quiz ----------------------------- */

/** Partner's seeded answers (dev state): partnerId -> dayISO -> questionId -> optionIndex */
export type QuizOption = { text: string };
export type QuizQuestion = { id: string; question: string; options: string[]; correctIndex: number };

export const QUIZ_POOL: QuizQuestion[] = [
  { id: 'kz-1', question: 'How does your partner take their morning drink?', options: ['Coffee, strong', 'Tea, milky', 'Juice', 'Just water'], correctIndex: 1 },
  { id: 'kz-2', question: 'What is their ideal evening?', options: ['Loud party', 'Movie marathon', 'Quiet walk', 'Cooking together'], correctIndex: 3 },
  { id: 'kz-3', question: 'Which season do they love most?', options: ['Monsoon', 'Winter', 'Summer', 'Spring'], correctIndex: 0 },
  { id: 'kz-4', question: 'What would they grab first in an emergency?', options: ['Phone', 'Wallet', 'You', 'Snacks'], correctIndex: 2 },
  { id: 'kz-5', question: 'Their most-used emoji?', options: ['🌿', '✨', '😂', '🥲'], correctIndex: 1 },
];

export function pickQuizQuestions(count: number, seedStr: string): QuizQuestion[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pool = [...QUIZ_POOL];
  const picked: QuizQuestion[] = [];
  while (picked.length < Math.min(count, pool.length)) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const idx = h % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function scoreQuiz(answers: (number | null)[], questions: QuizQuestion[]): number {
  return questions.reduce((score, q, i) => (answers[i] === q.correctIndex ? score + 1 : score), 0);
}

/* ------------------------------ This or That ------------------------------ */

export type ThisOrThatPair = { id: string; a: string; b: string };

export const THIS_OR_THAT: ThisOrThatPair[] = [
  { id: 'tot-1', a: 'Mountains', b: 'Beach' },
  { id: 'tot-2', a: 'Coffee dates', b: 'Late-night drives' },
  { id: 'tot-3', a: 'Home-cooked meal', b: 'Street food crawl' },
  { id: 'tot-4', a: 'Early sunrise', b: 'Midnight stars' },
  { id: 'tot-5', a: 'Window seat', b: 'Aisle seat' },
  { id: 'tot-6', a: 'Cats', b: 'Dogs' },
  { id: 'tot-7', a: 'Board games', b: 'Video games' },
  { id: 'tot-8', a: 'Surprise trips', b: 'Planned trips' },
  { id: 'tot-9', a: 'Sweet', b: 'Savory' },
  { id: 'tot-10', a: 'Rainy window', b: 'Sunny sky' },
];

export function scoreThisOrThat(selfPicks: ('a' | 'b')[], partnerPicks: ('a' | 'b')[]): number {
  const n = Math.min(selfPicks.length, partnerPicks.length);
  let matches = 0;
  for (let i = 0; i < n; i++) if (selfPicks[i] === partnerPicks[i]) matches += 1;
  return n === 0 ? 0 : Math.round((matches / n) * 100);
}

/* ------------------------------ Truth or Dare ----------------------------- */

export const TRUTHS: string[] = [
  'What was your very first impression of me?',
  'Which of my quirks did you find strange at first but now love?',
  'What is a small thing I do that instantly makes your day?',
  'When did you know this was something real?',
  'What is a compliment you have wanted to give me but felt shy about?',
];

export const DARES: string[] = [
  'Send your partner a voice note singing their favorite song line.',
  'Write a two-line poem about today, right now.',
  'Give a sincere compliment using exactly five words.',
  'Describe your dream date for this weekend — details matter.',
  'Say three things you are grateful for about us.',
];

/* ------------------------------ Memory Match ------------------------------ */

export const MEMORY_MATCH_ICONS = ['🌿', '✨', '🍵', '🌙', '🎧', '📚', '🌊', '🧡'];

/** Score: start at 100, lose 4 per move beyond the perfect minimum, 1 per second over 45s. */
export function scoreMemoryMatch(moves: number, seconds: number, pairs: number): number {
  const perfectMoves = pairs;
  const movePenalty = Math.max(0, moves - perfectMoves) * 4;
  const timePenalty = Math.max(0, Math.floor(seconds - 45));
  return Math.max(10, 100 - movePenalty - timePenalty);
}

/* --------------------------- Session result helper ------------------------ */

export function buildResult(gameId: GameId, self: GamePlayerState, partner: GamePlayerState): GameResult {
  const selfScore = self.score ?? 0;
  const partnerScore = partner.finished ? partner.score ?? 0 : 0;
  switch (gameId) {
    case 'know-me-quiz': {
      const tie = selfScore === partnerScore;
      return {
        tie,
        winnerId: tie ? undefined : selfScore > partnerScore ? 'self' : 'partner',
        summary: tie
          ? `Perfectly in sync — you both scored ${selfScore}.`
          : selfScore > partnerScore
            ? `You know them better: ${selfScore} vs ${partnerScore}.`
            : `They read you well: ${selfScore} vs ${partnerScore}.`,
        scoreSelf: selfScore,
        scorePartner: partnerScore,
      };
    }
    case 'this-or-that': {
      const tie = selfScore === partnerScore;
      return {
        tie,
        winnerId: undefined,
        summary: `You matched on ${selfScore}% of choices.`,
        scoreSelf: selfScore,
        scorePartner: partnerScore,
      };
    }
    case 'memory-match': {
      return {
        tie: false,
        winnerId: 'self',
        summary: `Cleared with a score of ${selfScore}.`,
        scoreSelf: selfScore,
      };
    }
    case 'truth-or-dare': {
      return {
        tie: true,
        summary: `${selfScore} rounds completed together.`,
        scoreSelf: selfScore,
      };
    }
    default:
      return { summary: 'Game complete.' };
  }
}

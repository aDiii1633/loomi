import type { Challenge } from './types';

export const CHALLENGES: Challenge[] = [
  {
    id: 'ch-no-phone-dinner',
    title: 'Phone-free dinner',
    description: 'Share one meal a day with phones in another room. Check in after each dinner.',
    icon: '🍽️',
    category: 'connection',
    durationDays: 7,
  },
  {
    id: 'ch-daily-walk',
    title: '20-minute walk together',
    description: 'A short walk, once a day, just the two of you. Rain counts if you share an umbrella.',
    icon: '🚶',
    category: 'growth',
    durationDays: 14,
  },
  {
    id: 'ch-compliment',
    title: 'One sincere compliment a day',
    description: 'Say it out loud or send it in chat. Specific beats generic.',
    icon: '💬',
    category: 'care',
    durationDays: 7,
  },
  {
    id: 'ch-photo-a-day',
    title: 'A photo a day, for us',
    description: 'One photo each day that says “this was us today”. Build a month of tiny memories.',
    icon: '📷',
    category: 'fun',
    durationDays: 30,
  },
  {
    id: 'ch-question-night',
    title: 'Question night over tea',
    description: 'Five gentle questions, one pot of tea, zero distractions.',
    icon: '🍵',
    category: 'connection',
    durationDays: 5,
  },
  {
    id: 'ch-new-recipe',
    title: 'Cook one new recipe together',
    description: 'Something neither of you has made before. Splash damage is part of the fun.',
    icon: '🧑‍🍳',
    category: 'fun',
    durationDays: 3,
  },
];

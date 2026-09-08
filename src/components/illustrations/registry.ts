/**
 * Static illustration registry — Pao & Ly artwork, static for now (see
 * LoomiIllustration.tsx). React Native requires string-literal `require()`
 * calls, so every asset must be listed explicitly here; this is also the
 * single place that documents what each illustration is for.
 */

export type IllustrationKey =
  | 'memories-viewing-photos'
  | 'chat-sitting-together'
  | 'journal-writing-together'
  | 'goals-progress-steps'
  | 'bucket-adventure-basket'
  | 'dates-looking-calendar'
  | 'reminders-share-calendar'
  | 'challenges-checklist'
  | 'mood-thinking-together'
  | 'games-video-game'
  | 'streak-fist-bump'
  | 'question-holding-card'
  | 'invite-pao-invites-ly'
  | 'welcome-holding-hands'
  | 'celebrate-jumping'
  | 'empty-questions'
  | 'error-comfort'
  | 'vault-glowing'
  | 'streak-celebrate'
  | 'location-walking'
  | 'anniversary-celebrate'
  | 'games-handheld';

interface IllustrationEntry {
  source: number;
  /** Default accessibility label; screens may override for context. */
  defaultLabel: string;
  /** Natural aspect ratio (width / height) of the source art, so layouts
   * can reserve space without a layout jump before the image decodes. */
  aspectRatio: number;
}

export const ILLUSTRATIONS: Record<IllustrationKey, IllustrationEntry> = {
  'memories-viewing-photos': {
    source: require('../../../assets/illustrations/memories-viewing-photos.jpg'),
    defaultLabel: 'Pao and Ly looking at floating photos together',
    aspectRatio: 672 / 900,
  },
  'chat-sitting-together': {
    source: require('../../../assets/illustrations/chat-sitting-together.jpg'),
    defaultLabel: 'Pao and Ly sitting together with a heart between them',
    aspectRatio: 672 / 900,
  },
  'journal-writing-together': {
    source: require('../../../assets/illustrations/journal-writing-together.jpg'),
    defaultLabel: 'Pao and Ly writing together in a shared journal',
    aspectRatio: 672 / 900,
  },
  'goals-progress-steps': {
    source: require('../../../assets/illustrations/goals-progress-steps.jpg'),
    defaultLabel: 'Pao and Ly climbing steps together toward a goal',
    aspectRatio: 672 / 900,
  },
  'bucket-adventure-basket': {
    source: require('../../../assets/illustrations/bucket-adventure-basket.jpg'),
    defaultLabel: 'Pao and Ly holding a basket of adventure items',
    aspectRatio: 672 / 900,
  },
  'dates-looking-calendar': {
    source: require('../../../assets/illustrations/dates-looking-calendar.jpg'),
    defaultLabel: 'Pao and Ly looking at a calendar with a heart marked',
    aspectRatio: 672 / 900,
  },
  'reminders-share-calendar': {
    source: require('../../../assets/illustrations/reminders-share-calendar.jpg'),
    defaultLabel: 'Pao and Ly sharing a calendar together',
    aspectRatio: 672 / 900,
  },
  'challenges-checklist': {
    source: require('../../../assets/illustrations/challenges-checklist.jpg'),
    defaultLabel: 'Pao and Ly completing a shared checklist',
    aspectRatio: 672 / 900,
  },
  'mood-thinking-together': {
    source: require('../../../assets/illustrations/mood-thinking-together.jpg'),
    defaultLabel: 'Pao and Ly thinking together under a shared thought bubble',
    aspectRatio: 672 / 900,
  },
  'games-video-game': {
    source: require('../../../assets/illustrations/games-video-game.jpg'),
    defaultLabel: 'Pao and Ly playing a video game together',
    aspectRatio: 672 / 900,
  },
  'streak-fist-bump': {
    source: require('../../../assets/illustrations/streak-fist-bump.jpg'),
    defaultLabel: 'Pao and Ly fist-bumping in celebration',
    aspectRatio: 672 / 900,
  },
  'question-holding-card': {
    source: require('../../../assets/illustrations/question-holding-card.jpg'),
    defaultLabel: 'Pao holding a question mark card beside Ly',
    aspectRatio: 672 / 900,
  },
  'invite-pao-invites-ly': {
    source: require('../../../assets/illustrations/invite-pao-invites-ly.jpg'),
    defaultLabel: 'Pao handing an invitation card to Ly',
    aspectRatio: 672 / 900,
  },
  'welcome-holding-hands': {
    source: require('../../../assets/illustrations/welcome-holding-hands.jpg'),
    defaultLabel: 'Pao and Ly walking hand in hand, hearts floating around them',
    aspectRatio: 1792 / 2400,
  },
  'celebrate-jumping': {
    source: require('../../../assets/illustrations/celebrate-jumping.jpg'),
    defaultLabel: 'Pao and Ly jumping excitedly in celebration',
    aspectRatio: 1792 / 2400,
  },
  'empty-questions': {
    source: require('../../../assets/illustrations/empty-questions.jpg'),
    defaultLabel: 'Pao and Ly asking each other questions',
    aspectRatio: 1792 / 2400,
  },
  'error-comfort': {
    source: require('../../../assets/illustrations/error-comfort.jpg'),
    defaultLabel: 'Pao comforting Ly with a gentle hug',
    aspectRatio: 1792 / 2400,
  },
  'vault-glowing': {
    source: require('../../../assets/illustrations/vault-glowing.jpg'),
    defaultLabel: 'Pao and Ly opening a glowing keepsake box together',
    aspectRatio: 1792 / 2400,
  },
  'streak-celebrate': {
    source: require('../../../assets/illustrations/streak-celebrate.jpg'),
    defaultLabel: 'Pao and Ly celebrating a streak together',
    aspectRatio: 1792 / 2400,
  },
  'location-walking': {
    source: require('../../../assets/illustrations/location-walking.jpg'),
    defaultLabel: 'Pao and Ly walking together down a path',
    aspectRatio: 1792 / 2400,
  },
  'anniversary-celebrate': {
    source: require('../../../assets/illustrations/anniversary-celebrate.jpg'),
    defaultLabel: 'Pao and Ly celebrating an anniversary with a cake',
    aspectRatio: 1792 / 2400,
  },
  'games-handheld': {
    source: require('../../../assets/illustrations/games-handheld.jpg'),
    defaultLabel: 'Pao and Ly playing a handheld game together',
    aspectRatio: 1792 / 2400,
  },
};

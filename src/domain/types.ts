/**
 * Loomi domain models.
 *
 * These models are designed so a future backend can map onto them cleanly:
 * every persisted entity carries a `sync` state describing its relationship
 * with the (future) server, and ids are client-generated strings so a real
 * backend can issue its own ids later without breaking local references.
 */

export type SyncState = 'synced' | 'syncing' | 'pending' | 'failed' | 'offline' | 'conflict';

export interface SyncMeta {
  sync: SyncState;
  updatedAt: number;
}

export type UserId = string;
export type CoupleId = string;

export interface User {
  id: UserId;
  name: string;
  avatar?: string; // local media id or remote url
  birthdayISO?: string; // date-only, e.g. 1999-11-03
  isSelf: boolean;
}

export interface Couple {
  id: CoupleId;
  partnerAId: UserId;
  partnerBId: UserId;
  anniversaryISO: string; // the day the relationship started (date-only)
  level: number; // "Sanctuary" level, derived from days together
  isLinked: boolean;
}

/* ---------------------------------- Chat --------------------------------- */

export type MessageKind = 'text' | 'image' | 'video' | 'voice' | 'system';

export interface Message extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  authorId: UserId;
  kind: MessageKind;
  text?: string;
  mediaId?: string; // reference into media store
  durationMs?: number; // voice notes
  waveform?: number[]; // 24 normalized amplitudes for voice notes
  replyToId?: string;
  reactions: Record<string, UserId[]>; // emoji -> userIds
  sentAt: number;
  /** client-side deletion tombstone (server copy may persist) */
  deletedAt?: number;
}

/* ----------------------------- Daily questions ---------------------------- */

export type QuestionState = 'open' | 'waiting_partner' | 'waiting_self' | 'unlocked';

export interface DailyQuestion {
  id: string; // stable per question text
  text: string;
  category: 'connection' | 'memories' | 'dreams' | 'fun' | 'intimacy';
}

export interface QuestionAnswer extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  questionId: string;
  /** local device date (YYYY-MM-DD) this question belongs to */
  dayISO: string;
  authorId: UserId;
  text: string;
  submittedAt: number;
}

/* ---------------------------------- Mood ---------------------------------- */

export interface MoodEntry extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  authorId: UserId;
  dayISO: string;
  emoji: string;
  label: string;
  note?: string;
  createdAt: number;
}

/* ---------------------------------- Games --------------------------------- */

export type GameId = 'know-me-quiz' | 'this-or-that' | 'truth-or-dare' | 'memory-match';

export interface GameDef {
  id: GameId;
  title: string;
  tagline: string;
  icon: string; // icon key in our icon set
  minPlayers: number;
}

export interface GameSession extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  gameId: GameId;
  dayISO: string;
  /** per-player state, shape depends on the game */
  players: Record<UserId, GamePlayerState>;
  status: 'active' | 'complete';
  startedAt: number;
  completedAt?: number;
  result?: GameResult;
}

export interface GamePlayerState {
  finished: boolean;
  score?: number;
  /** generic payload: quiz picks, this-or-that picks, dare index, match stats */
  payload?: Record<string, unknown>;
}

export interface GameResult {
  winnerId?: UserId;
  tie?: boolean;
  summary: string;
  scoreSelf?: number;
  scorePartner?: number;
}

/* -------------------------------- Challenges ------------------------------ */

export interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'connection' | 'fun' | 'care' | 'growth';
  durationDays: number;
}

export interface ChallengeProgress extends SyncMeta {
  id: string;
  challengeId: string;
  coupleId: CoupleId;
  startedOnISO: string;
  completedOnISOs: string[]; // days checked in
  status: 'active' | 'completed' | 'abandoned';
}

/* --------------------------------- Streak --------------------------------- */

export type StreakActivityKind =
  | 'daily_question'
  | 'ritual'
  | 'mood'
  | 'game'
  | 'challenge'
  | 'chat'
  | 'memory';

export interface StreakActivity {
  dayISO: string;
  kinds: StreakActivityKind[];
}

export interface StreakSnapshot {
  current: number;
  longest: number;
  lastActiveDayISO: string | null;
  qualifiesToday: boolean;
  /** days until next milestone; null when inside none */
  nextMilestone: { label: string; atDay: number } | null;
}

/* ------------------------------- Bucket list ------------------------------ */

export type BucketCategory = 'travel' | 'experience' | 'food' | 'milestone' | 'wild';

export interface BucketItem extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  category: BucketCategory;
  notes?: string;
  done: boolean;
  doneAtISO?: string;
  createdAt: number;
}

/* ---------------------------------- Goals --------------------------------- */

export interface GoalMilestone {
  id: string;
  title: string;
  done: boolean;
}

export interface Goal extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  target: number; // e.g. 60000 rupees, 12 sessions
  current: number;
  unit: string; // '₹', 'days', '', ...
  dueISO?: string;
  milestones: GoalMilestone[];
  done: boolean;
  createdAt: number;
}

/* -------------------------------- Reminders ------------------------------- */

export interface Reminder extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  notes?: string;
  dueAt: number; // epoch ms, validated
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  done: boolean;
  createdAt: number;
}

/* ------------------------------ Important dates --------------------------- */

export interface ImportantDate extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  dateISO: string; // date-only; year repeats when yearly
  yearly: boolean;
  icon: string;
}

/* --------------------------------- Timeline ------------------------------- */

export interface TimelineMoment extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  description?: string;
  dateISO: string;
  mediaIds: string[];
  createdAt: number;
}

/* --------------------------------- Journal -------------------------------- */

export type JournalAttachment = { mediaId: string };

export interface JournalEntry extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  authorId: UserId;
  title: string;
  text: string;
  moodEmoji?: string;
  mediaIds: string[];
  createdAt: number;
  editedAt?: number;
}

/* --------------------------------- Memories ------------------------------- */

export interface Memory extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  caption?: string;
  place?: string;
  takenAtISO: string;
  mediaIds: string[]; // first = cover
  favorite: boolean;
  likeCount: number;
  likedBySelf: boolean;
  createdAt: number;
}

/* ---------------------------------- Vault --------------------------------- */

export interface VaultItem extends SyncMeta {
  id: string;
  coupleId: CoupleId;
  title: string;
  mediaIds: string[];
  note?: string;
  createdAt: number;
}

/** Vault credential material lives ONLY in expo-secure-store. */
export interface VaultConfig {
  pinHash: string; // PBKDF2-ish via expo-crypto SHA-256(salt+pin)
  salt: string;
  biometricEnabled: boolean;
  createdAt: number;
}

/* --------------------------------- Location ------------------------------- */

export type LocationPermissionState =
  | 'not_requested'
  | 'requested'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unavailable';

export interface LocationState {
  permission: LocationPermissionState;
  sharingEnabled: boolean;
  self: {
    lat: number;
    lon: number;
    label: string;
    atISO: string;
  } | null;
  partner: {
    distanceKm: number;
    label: string;
    syncedAtISO: string;
  } | null;
}

/* ------------------------------ Notifications ----------------------------- */

export type AppNotificationKind =
  | 'daily_question'
  | 'reminder'
  | 'partner_activity'
  | 'streak'
  | 'game'
  | 'important_date';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  route?: string;
}

/* -------------------------------- Settings -------------------------------- */

export interface AppSettings {
  appearance: 'light'; // the approved design is light-only for now
  notificationsEnabled: boolean;
  dailyQuestionReminder: boolean;
  hapticsEnabled: boolean;
  locationSharing: boolean;
  reducedMotion: boolean;
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  platform: string;
  lastActiveAt: number;
}

/**
 * Privacy-safe UX funnel analytics.
 *
 * Params are restricted to safe primitives (counts, booleans, category
 * enums) by the type system — never pass message/journal/vault text, photo
 * or voice content, or exact location through `track()`.
 *
 * No backend is wired yet (Firebase Analytics wiring is deferred with the
 * rest of the backend work). `emit()` is the single place a real sink will
 * plug in later — every call site below stays unchanged when that happens.
 */

export type AnalyticsEvent =
  | 'app_opened'
  | 'daily_question_opened'
  | 'daily_question_answered'
  | 'daily_question_revealed'
  | 'mood_opened'
  | 'mood_submitted'
  | 'memory_create_started'
  | 'memory_created'
  | 'journal_create_started'
  | 'journal_created'
  | 'goal_create_started'
  | 'goal_created'
  | 'goal_completed'
  | 'bucket_item_create_started'
  | 'bucket_item_created'
  | 'bucket_item_completed'
  | 'game_started'
  | 'game_completed';

type SafeParams = Record<string, string | number | boolean | undefined>;

interface AnalyticsEventRecord {
  event: AnalyticsEvent;
  params?: SafeParams;
  atMs: number;
}

const BUFFER_LIMIT = 200;
const buffer: AnalyticsEventRecord[] = [];

function emit(record: AnalyticsEventRecord): void {
  if (__DEV__) {
    console.log(`[analytics] ${record.event}`, record.params ?? {});
  }
}

export function track(event: AnalyticsEvent, params?: SafeParams): void {
  const record: AnalyticsEventRecord = { event, params, atMs: Date.now() };
  buffer.push(record);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  emit(record);
}

/** Debug/test hook only — never read for product logic. */
export function getRecentAnalyticsEvents(): AnalyticsEventRecord[] {
  return [...buffer];
}

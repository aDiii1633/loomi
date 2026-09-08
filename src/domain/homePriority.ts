import type { QuestionState } from './types';

/**
 * Deterministic priority strategy for Home's single "right now" banner.
 * Order (highest first):
 *   1. An unsaved draft the user already started — protects real work
 *      (loss aversion tie-in), and it's the most actionable thing right now.
 *   2. An important date within 2 days — high relationship relevance and
 *      genuinely time-sensitive.
 *   3. The daily question, only when it still needs the user's own action
 *      (never answered yet, or the partner is waiting on them).
 *   4. A shared goal with a due date within 7 days that isn't done yet.
 * Anything not matching one of these falls through to `none` — Home then
 * shows its normal content with no banner, keeping the screen minimal
 * rather than surfacing several competing prompts at once.
 */

export interface HomePriorityInput {
  draft: { label: string; route: string } | null;
  questionState: QuestionState | null;
  nextDate: { title: string; days: number } | null;
  goalNeedingAttention: { title: string; daysLeft: number } | null;
}

export type HomePriority =
  | { kind: 'draft'; label: string; route: string }
  | { kind: 'date'; title: string; days: number }
  | { kind: 'question'; urgent: boolean }
  | { kind: 'goal'; title: string; daysLeft: number }
  | { kind: 'none' };

const URGENT_DATE_WINDOW_DAYS = 2;
const GOAL_ATTENTION_WINDOW_DAYS = 7;

export function getHomePriority(input: HomePriorityInput): HomePriority {
  if (input.draft) {
    return { kind: 'draft', label: input.draft.label, route: input.draft.route };
  }
  if (input.nextDate && input.nextDate.days >= 0 && input.nextDate.days <= URGENT_DATE_WINDOW_DAYS) {
    return { kind: 'date', title: input.nextDate.title, days: input.nextDate.days };
  }
  if (input.questionState === 'open' || input.questionState === 'waiting_self') {
    return { kind: 'question', urgent: input.questionState === 'waiting_self' };
  }
  if (input.goalNeedingAttention && input.goalNeedingAttention.daysLeft <= GOAL_ATTENTION_WINDOW_DAYS) {
    return { kind: 'goal', title: input.goalNeedingAttention.title, daysLeft: input.goalNeedingAttention.daysLeft };
  }
  return { kind: 'none' };
}

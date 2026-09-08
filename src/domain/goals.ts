/**
 * Goal milestone helpers — small, pure, and testable. Milestones are optional
 * sub-steps on a Goal; the goal's own numeric current/target stays the source
 * of truth for its progress bar. These helpers keep milestone edits consistent
 * between the goals screen and the store.
 */
import type { GoalMilestone } from './types';

export function toggleMilestoneDone(
  milestones: readonly GoalMilestone[],
  id: string
): GoalMilestone[] {
  return milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m));
}

export function removeMilestone(
  milestones: readonly GoalMilestone[],
  id: string
): GoalMilestone[] {
  return milestones.filter((m) => m.id !== id);
}

export function addMilestone(
  milestones: readonly GoalMilestone[],
  milestone: GoalMilestone
): GoalMilestone[] {
  return [...milestones, milestone];
}

export interface MilestoneStats {
  total: number;
  done: number;
  /** 0..1; 0 when there are no milestones */
  ratio: number;
  allDone: boolean;
}

export function milestoneStats(milestones: readonly GoalMilestone[]): MilestoneStats {
  const total = milestones.length;
  const done = milestones.reduce((n, m) => (m.done ? n + 1 : n), 0);
  return {
    total,
    done,
    ratio: total === 0 ? 0 : done / total,
    allDone: total > 0 && done === total,
  };
}

/** Guards a new milestone title: trimmed, bounded, non-duplicate. */
export function validateMilestoneTitle(
  raw: string,
  existing: readonly GoalMilestone[]
): { ok: true; title: string } | { ok: false; message: string } {
  const title = raw.trim();
  if (!title) return { ok: false, message: 'Milestone can’t be empty.' };
  if (title.length > 80) return { ok: false, message: 'Keep milestones under 80 characters.' };
  if (existing.some((m) => m.title.trim().toLowerCase() === title.toLowerCase())) {
    return { ok: false, message: 'That step is already on the list.' };
  }
  if (existing.length >= 12) return { ok: false, message: '12 milestones is plenty for one goal.' };
  return { ok: true, title };
}

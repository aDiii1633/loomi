/**
 * Life store: memories, journal, timeline, bucket, goals, reminders, dates.
 * One store per screen-group keeps rerenders local and predictable.
 * Identity comes from the session at call time — never from hard-coded ids.
 */
import { create } from 'zustand';
import type {
  BucketItem, Goal, GoalMilestone, ImportantDate, JournalEntry, Memory, Reminder, TimelineMoment, VaultItem,
} from '../domain/types';
import * as lifeRepo from '../data/repositories/life';
import * as plansRepo from '../data/repositories/plans';
import { toggleMilestoneDone } from '../domain/goals';
import { importMedia, newId } from '../data/media';
import { currentIdentity, requireIdentity } from './identity';
import { pullSince, pushDirty } from '../data/backend/sync';
import { track } from '../services/analytics';

/* -------------------------------- memories -------------------------------- */

type PickedMediaInput = { uri: string; kind: 'image' | 'video'; width?: number; height?: number; fileSize?: number };

interface MemoriesState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  memories: Memory[];
  refresh: () => Promise<void>;
  addMemory: (input: { title: string; caption?: string; place?: string; takenAtISO: string; mediaUris: PickedMediaInput[] }) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  like: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useMemoriesStore = create<MemoriesState>((set, get) => ({
  loaded: false, loading: false, error: null, memories: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ memories: [], loaded: true, loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      await pullSince('memories', ids.coupleId);
      const memories = await lifeRepo.listMemories(ids.coupleId);
      set({ memories, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load memories.' });
    }
  },
  addMemory: async (input) => {
    const { coupleId } = requireIdentity();
    const mediaIds: string[] = [];
    for (const m of input.mediaUris) {
      const rec = await importMedia({ sourceUri: m.uri, kind: m.kind, width: m.width, height: m.height, fileSize: m.fileSize });
      mediaIds.push(rec.id);
    }
    await lifeRepo.upsertMemory({
      id: newId('memory'), coupleId, title: input.title.trim(), caption: input.caption?.trim() || undefined,
      place: input.place?.trim() || undefined, takenAtISO: input.takenAtISO, mediaIds,
      favorite: false, likeCount: 0, likedBySelf: false, createdAt: Date.now(),
    });
    void pushDirty('memories', coupleId);
    track('memory_created', { mediaCount: mediaIds.length });
    await get().refresh();
  },
  toggleFavorite: async (id) => {
    const { coupleId } = requireIdentity();
    const m = get().memories.find((x) => x.id === id);
    if (!m) return;
    await lifeRepo.upsertMemory({ ...m, favorite: !m.favorite });
    void pushDirty('memories', coupleId);
    await get().refresh();
  },
  like: async (id) => {
    const { coupleId } = requireIdentity();
    const m = get().memories.find((x) => x.id === id);
    if (!m) return;
    await lifeRepo.upsertMemory({
      ...m,
      likedBySelf: !m.likedBySelf,
      likeCount: m.likeCount + (m.likedBySelf ? -1 : 1),
    });
    void pushDirty('memories', coupleId);
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await lifeRepo.deleteMemory(id);
    void pushDirty('memories', coupleId);
    await get().refresh();
  },
}));

/* --------------------------------- journal -------------------------------- */

interface JournalState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  entries: JournalEntry[];
  refresh: () => Promise<void>;
  saveEntry: (input: { id?: string; title: string; text: string; moodEmoji?: string; mediaUris: PickedMediaInput[] }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  loaded: false, loading: false, error: null, entries: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ entries: [], loaded: true, loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      await pullSince('journal_entries', ids.coupleId);
      const entries = await lifeRepo.listJournal(ids.coupleId);
      set({ entries, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load your journal.' });
    }
  },
  saveEntry: async (input) => {
    const { coupleId, selfId } = requireIdentity();
    const existing = input.id ? get().entries.find((e) => e.id === input.id) : undefined;
    const mediaIds: string[] = existing?.mediaIds ?? [];
    for (const m of input.mediaUris) {
      const rec = await importMedia({ sourceUri: m.uri, kind: m.kind, width: m.width, height: m.height, fileSize: m.fileSize });
      mediaIds.push(rec.id);
    }
    await lifeRepo.upsertJournalEntry({
      id: existing?.id ?? newId('journal'),
      coupleId, authorId: existing?.authorId ?? selfId,
      title: input.title.trim(), text: input.text.trim(),
      moodEmoji: input.moodEmoji ?? existing?.moodEmoji,
      mediaIds,
      createdAt: existing?.createdAt ?? Date.now(),
      editedAt: existing ? Date.now() : undefined,
    });
    void pushDirty('journal_entries', coupleId);
    if (!existing) track('journal_created', { hasMedia: mediaIds.length > 0, hasMood: !!input.moodEmoji });
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await lifeRepo.deleteJournalEntry(id);
    void pushDirty('journal_entries', coupleId);
    await get().refresh();
  },
}));

/* --------------------------------- timeline ------------------------------- */

interface TimelineState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  moments: TimelineMoment[];
  refresh: () => Promise<void>;
  saveMoment: (input: { id?: string; title: string; description?: string; dateISO: string; mediaUris: PickedMediaInput[] }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  loaded: false, loading: false, error: null, moments: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ moments: [], loaded: true, loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      await pullSince('timeline_moments', ids.coupleId);
      const moments = await lifeRepo.listMoments(ids.coupleId);
      set({ moments, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load the timeline.' });
    }
  },
  saveMoment: async (input) => {
    const { coupleId } = requireIdentity();
    const existing = input.id ? get().moments.find((m) => m.id === input.id) : undefined;
    const mediaIds: string[] = existing?.mediaIds ?? [];
    for (const m of input.mediaUris) {
      const rec = await importMedia({ sourceUri: m.uri, kind: m.kind, width: m.width, height: m.height, fileSize: m.fileSize });
      mediaIds.push(rec.id);
    }
    await lifeRepo.upsertMoment({
      id: existing?.id ?? newId('moment'),
      coupleId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      dateISO: input.dateISO,
      mediaIds,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    void pushDirty('timeline_moments', coupleId);
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await lifeRepo.deleteMoment(id);
    void pushDirty('timeline_moments', coupleId);
    await get().refresh();
  },
}));

/* ---------------------------------- vault --------------------------------- */

interface VaultState {
  loaded: boolean;
  items: VaultItem[];
  refresh: () => Promise<void>;
  addItem: (input: { title: string; note?: string; mediaUris: PickedMediaInput[] }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  loaded: false, items: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ items: [], loaded: true });
      return;
    }
    await pullSince('vault_items', ids.coupleId);
    const items = await lifeRepo.listVaultItems(ids.coupleId);
    set({ items, loaded: true });
  },
  addItem: async (input) => {
    const { coupleId } = requireIdentity();
    const mediaIds: string[] = [];
    for (const m of input.mediaUris) {
      const rec = await importMedia({ sourceUri: m.uri, kind: m.kind, width: m.width, height: m.height, fileSize: m.fileSize });
      mediaIds.push(rec.id);
    }
    await lifeRepo.upsertVaultItem({
      id: newId('vault'), coupleId, title: input.title.trim(),
      note: input.note?.trim() || undefined, mediaIds, createdAt: Date.now(),
    });
    void pushDirty('vault_items', coupleId);
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await lifeRepo.deleteVaultItem(id);
    void pushDirty('vault_items', coupleId);
    await get().refresh();
  },
}));

/* -------------------------------- bucket list ------------------------------ */

interface BucketState {
  loaded: boolean;
  items: BucketItem[];
  refresh: () => Promise<void>;
  save: (input: { id?: string; title: string; category: BucketItem['category']; notes?: string }) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBucketStore = create<BucketState>((set, get) => ({
  loaded: false, items: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ items: [], loaded: true });
      return;
    }
    await pullSince('bucket_items', ids.coupleId);
    const items = await plansRepo.listBucket(ids.coupleId);
    set({ items, loaded: true });
  },
  save: async (input) => {
    const { coupleId } = requireIdentity();
    const existing = input.id ? get().items.find((i) => i.id === input.id) : undefined;
    await plansRepo.upsertBucket({
      id: existing?.id ?? newId('bucket'),
      coupleId,
      title: input.title.trim(),
      category: input.category,
      notes: input.notes?.trim() || undefined,
      done: existing?.done ?? false,
      doneAtISO: existing?.doneAtISO,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    void pushDirty('bucket_items', coupleId);
    if (!existing) track('bucket_item_created', { category: input.category });
    await get().refresh();
  },
  toggleDone: async (id) => {
    const { coupleId } = requireIdentity();
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const done = !item.done;
    await plansRepo.upsertBucket({
      ...item,
      done,
      doneAtISO: done ? new Date().toISOString().slice(0, 10) : undefined,
    });
    void pushDirty('bucket_items', coupleId);
    if (done) track('bucket_item_completed', { category: item.category });
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await plansRepo.deleteBucket(id);
    void pushDirty('bucket_items', coupleId);
    await get().refresh();
  },
}));

/* ----------------------------------- goals --------------------------------- */

interface GoalsState {
  loaded: boolean;
  goals: Goal[];
  refresh: () => Promise<void>;
  save: (input: {
    id?: string;
    title: string;
    target: number;
    current: number;
    unit: string;
    dueISO?: string;
    milestones?: GoalMilestone[];
  }) => Promise<void>;
  setCurrent: (id: string, current: number) => Promise<void>;
  toggleMilestone: (goalId: string, milestoneId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  loaded: false, goals: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ goals: [], loaded: true });
      return;
    }
    await pullSince('goals', ids.coupleId);
    const goals = await plansRepo.listGoals(ids.coupleId);
    set({ goals, loaded: true });
  },
  save: async (input) => {
    const { coupleId } = requireIdentity();
    const existing = input.id ? get().goals.find((g) => g.id === input.id) : undefined;
    const done = input.current >= input.target;
    await plansRepo.upsertGoal({
      id: existing?.id ?? newId('goal'),
      coupleId,
      title: input.title.trim(),
      target: input.target,
      current: input.current,
      unit: input.unit,
      dueISO: input.dueISO || undefined,
      milestones: input.milestones ?? existing?.milestones ?? [],
      done,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    void pushDirty('goals', coupleId);
    if (!existing) track('goal_created', { hasMilestones: (input.milestones?.length ?? 0) > 0 });
    else if (!existing.done && done) track('goal_completed');
    await get().refresh();
  },
  setCurrent: async (id, current) => {
    const { coupleId } = requireIdentity();
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    const clamped = Math.max(0, Math.min(goal.target, current));
    const nowDone = clamped >= goal.target;
    await plansRepo.upsertGoal({ ...goal, current: clamped, done: nowDone });
    void pushDirty('goals', coupleId);
    if (!goal.done && nowDone) track('goal_completed');
    await get().refresh();
  },
  toggleMilestone: async (goalId, milestoneId) => {
    const { coupleId } = requireIdentity();
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    await plansRepo.upsertGoal({ ...goal, milestones: toggleMilestoneDone(goal.milestones, milestoneId) });
    void pushDirty('goals', coupleId);
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await plansRepo.deleteGoal(id);
    void pushDirty('goals', coupleId);
    await get().refresh();
  },
}));

/* --------------------------------- reminders ------------------------------- */

interface RemindersState {
  loaded: boolean;
  reminders: Reminder[];
  refresh: () => Promise<void>;
  save: (input: { id?: string; title: string; notes?: string; dueAt: number; repeat: Reminder['repeat'] }) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  loaded: false, reminders: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ reminders: [], loaded: true });
      return;
    }
    await pullSince('reminders', ids.coupleId);
    const reminders = await plansRepo.listReminders(ids.coupleId);
    set({ reminders, loaded: true });
  },
  save: async (input) => {
    const { coupleId } = requireIdentity();
    const existing = input.id ? get().reminders.find((r) => r.id === input.id) : undefined;
    const saved = await plansRepo.upsertReminder({
      id: existing?.id ?? newId('reminder'),
      coupleId,
      title: input.title.trim(),
      notes: input.notes?.trim() || undefined,
      dueAt: input.dueAt,
      repeat: input.repeat,
      done: existing?.done ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    void pushDirty('reminders', coupleId);
    const { pushLocal, scheduleReminderNotification, makeNotificationId } = await import('../data/repositories/notifications');
    await pushLocal({
      id: makeNotificationId(),
      kind: 'reminder',
      title: 'Reminder set',
      body: saved.title,
      createdAt: Date.now(),
      route: '/reminders',
    });
    await scheduleReminderNotification({ id: saved.id, title: 'Loomi reminder', body: saved.title, atMs: saved.dueAt });
    await get().refresh();
  },
  toggleDone: async (id) => {
    const { coupleId } = requireIdentity();
    const r = get().reminders.find((x) => x.id === id);
    if (!r) return;
    await plansRepo.upsertReminder({ ...r, done: !r.done });
    void pushDirty('reminders', coupleId);
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await plansRepo.deleteReminder(id);
    void pushDirty('reminders', coupleId);
    const { cancelReminderNotification } = await import('../data/repositories/notifications');
    await cancelReminderNotification(id);
    await get().refresh();
  },
}));

/* ------------------------------- important dates --------------------------- */

interface DatesState {
  loaded: boolean;
  dates: ImportantDate[];
  refresh: () => Promise<void>;
  save: (input: { id?: string; title: string; dateISO: string; yearly: boolean; icon?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useDatesStore = create<DatesState>((set, get) => ({
  loaded: false, dates: [],
  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      set({ dates: [], loaded: true });
      return;
    }
    await pullSince('important_dates', ids.coupleId);
    const dates = await plansRepo.listDates(ids.coupleId);
    set({ dates, loaded: true });
  },
  save: async (input) => {
    const { coupleId } = requireIdentity();
    const existing = input.id ? get().dates.find((d) => d.id === input.id) : undefined;
    await plansRepo.upsertDate({
      id: existing?.id ?? newId('date'),
      coupleId,
      title: input.title.trim(),
      dateISO: input.dateISO,
      yearly: input.yearly,
      icon: input.icon ?? 'heart',
    });
    void pushDirty('important_dates', coupleId);
    await get().refresh();
  },
  remove: async (id) => {
    const { coupleId } = requireIdentity();
    await plansRepo.deleteDate(id);
    void pushDirty('important_dates', coupleId);
    await get().refresh();
  },
}));

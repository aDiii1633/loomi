/**
 * Lightweight registry of in-progress, unsaved drafts across screens. Lets
 * Home surface "finish what you started" as its top-priority action without
 * any screen needing to persist real draft content anywhere — the registry
 * only ever holds a label + route, never the draft's actual text/media.
 */
import { create } from 'zustand';

export interface DraftInfo {
  label: string;
  route: string;
}

interface DraftsState {
  drafts: Record<string, DraftInfo>;
  setDraft: (screenId: string, info: DraftInfo) => void;
  clearDraft: (screenId: string) => void;
}

export const useDraftsStore = create<DraftsState>((set) => ({
  drafts: {},
  setDraft: (screenId, info) =>
    set((s) => ({ drafts: { ...s.drafts, [screenId]: info } })),
  clearDraft: (screenId) =>
    set((s) => {
      if (!(screenId in s.drafts)) return s;
      const next = { ...s.drafts };
      delete next[screenId];
      return { drafts: next };
    }),
}));

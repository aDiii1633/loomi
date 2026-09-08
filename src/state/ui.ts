/**
 * UI utility store: toasts + confirm dialogs.
 * Keeps transient UI state out of persistent domain stores.
 */
import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { loadSettings } from '../data/repositories/couple';

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

interface UIState {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  hapticsEnabled: boolean;
  setHapticsEnabled: (v: boolean) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  askConfirm: (req: ConfirmRequest) => void;
  clearConfirm: () => void;
}

let hapticsEnabled = true;
loadSettings().then((s) => {
  hapticsEnabled = s.hapticsEnabled;
}).catch(() => undefined);

export function haptic(kind: 'light' | 'success' | 'warning' = 'light'): void {
  if (!hapticsEnabled) return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // haptics unavailable on this device — silently ignore
  }
}

/**
 * Ethical loss-aversion guard: protects a user's own unsaved input (never
 * used for fear/urgency about relationship state). Closes immediately when
 * there is nothing to lose; otherwise asks before discarding.
 */
export function confirmDiscard(opts: {
  isDirty: boolean;
  onDiscard: () => void;
  title?: string;
  message?: string;
}): void {
  const { isDirty, onDiscard, title = 'Discard this?', message = 'What you entered will be lost.' } = opts;
  if (!isDirty) {
    onDiscard();
    return;
  }
  haptic('light');
  useUIStore.getState().askConfirm({
    title,
    message,
    confirmLabel: 'Discard',
    destructive: true,
    onConfirm: onDiscard,
  });
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  confirm: null,
  hapticsEnabled: true,
  setHapticsEnabled: (v) => {
    hapticsEnabled = v;
    set({ hapticsEnabled: v });
  },
  toast: (message, tone = 'info') => {
    const id = `toast-${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  askConfirm: (req) => set({ confirm: req }),
  clearConfirm: () => set({ confirm: null }),
}));

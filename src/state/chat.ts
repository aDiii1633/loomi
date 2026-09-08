/**
 * Chat store: one-to-one conversation with text, media and voice notes.
 * Identity comes from the session at call time — never from hard-coded ids.
 */
import { create } from 'zustand';
import type { Message } from '../domain/types';
import { listMessages, insertMessage, toggleReaction, softDeleteMessage } from '../data/repositories/chat';
import { importMedia, importAudioRecording, newId } from '../data/media';
import { uploadCoupleMedia } from '../data/backend/mediaStorage';
import { currentIdentity, requireIdentity, NoCoupleError } from './identity';
import { pullSince, pushDirty } from '../data/backend/sync';

interface ChatState {
  loaded: boolean;
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  error: string | null;
  messages: Message[];
  sending: boolean;

  refresh: () => Promise<void>;
  /** Append the next older page (chat is newest-first). No-op when hasMore is false. */
  loadOlder: () => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendMedia: (params: { uri: string; kind: 'image' | 'video'; width?: number; height?: number; fileSize?: number }) => Promise<void>;
  sendVoice: (params: { uri: string; durationMs: number; fileSize?: number; waveform: number[] }) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  loaded: false,
  loading: false,
  loadingOlder: false,
  hasMore: false,
  error: null,
  messages: [],
  sending: false,

  refresh: async () => {
    const ids = currentIdentity();
    if (!ids) {
      // No linked couple yet — an honest empty conversation, not fake data.
      set({ messages: [], loaded: true, loading: false, hasMore: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      // Cloud-first merge, local read: partner changes that arrived while we
      // were away are pulled into SQLite before rendering. Only the most
      // recent page is loaded; older messages page in on scroll.
      await pullSince('messages', ids.coupleId);
      const { rows, hasMore } = await listMessages(ids.coupleId);
      set({ messages: rows, hasMore, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load the conversation.' });
    }
  },

  loadOlder: async () => {
    const { messages, hasMore, loadingOlder, loading } = get();
    if (!hasMore || loadingOlder || loading || messages.length === 0) return;
    const ids = currentIdentity();
    if (!ids) return;
    set({ loadingOlder: true });
    try {
      const oldest = messages[messages.length - 1];
      const { rows, hasMore: more } = await listMessages(ids.coupleId, { beforeSentAt: oldest.sentAt });
      // De-dupe on id in case a boundary message repeats.
      const seen = new Set(messages.map((m) => m.id));
      const merged = [...messages, ...rows.filter((r) => !seen.has(r.id))];
      set({ messages: merged, hasMore: more, loadingOlder: false });
    } catch {
      set({ loadingOlder: false });
    }
  },

  sendText: async (text) => {
    if (!text.trim()) return;
    const { selfId, coupleId } = requireIdentity();
    const message: Omit<Message, 'sync' | 'updatedAt'> = {
      id: newId('msg'),
      coupleId,
      authorId: selfId,
      kind: 'text',
      text: text.trim(),
      reactions: {},
      sentAt: Date.now(),
    };
    await insertMessage(message);
    void pushDirty('messages', coupleId);
    await get().refresh();
  },

  sendMedia: async ({ uri, kind, width, height, fileSize }) => {
    set({ sending: true });
    try {
      const { selfId, coupleId } = requireIdentity();
      const media = await importMedia({ sourceUri: uri, kind, width, height, fileSize });
      await insertMessage({
        id: newId('msg'),
        coupleId,
        authorId: selfId,
        kind,
        mediaId: media.id,
        reactions: {},
        sentAt: Date.now(),
      });
      // Push the bytes so the partner can actually see the image/video, then
      // the message row (which carries media_id).
      void uploadCoupleMedia({
        coupleId,
        uploadedBy: selfId,
        mediaId: media.id,
        localUri: media.uri,
        kind,
        byteSize: media.fileSize ?? 0,
        width: media.width,
        height: media.height,
      }).then(() => pushDirty('messages', coupleId));
      void pushDirty('messages', coupleId);
      await get().refresh();
    } finally {
      set({ sending: false });
    }
  },

  sendVoice: async ({ uri, durationMs, fileSize, waveform }) => {
    set({ sending: true });
    try {
      const { selfId, coupleId } = requireIdentity();
      const media = await importAudioRecording({ sourceUri: uri, durationMs, fileSize, waveform });
      await insertMessage({
        id: newId('msg'),
        coupleId,
        authorId: selfId,
        kind: 'voice',
        mediaId: media.id,
        durationMs,
        waveform,
        reactions: {},
        sentAt: Date.now(),
      });
      void uploadCoupleMedia({
        coupleId,
        uploadedBy: selfId,
        mediaId: media.id,
        localUri: media.uri,
        kind: 'audio',
        byteSize: media.fileSize ?? 0,
        durationMs,
      }).then(() => pushDirty('messages', coupleId));
      void pushDirty('messages', coupleId);
      await get().refresh();
    } finally {
      set({ sending: false });
    }
  },

  react: async (messageId, emoji) => {
    const { selfId, coupleId } = requireIdentity();
    await toggleReaction(messageId, emoji, selfId);
    void pushDirty('messages', coupleId);
    await get().refresh();
  },

  remove: async (messageId) => {
    const { coupleId } = requireIdentity();
    await softDeleteMessage(messageId);
    void pushDirty('messages', coupleId);
    await get().refresh();
  },
}));

export { NoCoupleError };

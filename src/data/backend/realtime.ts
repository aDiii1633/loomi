/**
 * Realtime: one couple-scoped channel per mounted surface. Supabase
 * postgres_changes events are filtered by couple_id (and RLS still applies
 * server-side — a channel cannot observe rows the caller cannot read), so
 * no cross-couple data can arrive. Handlers are debounced per table so a
 * burst of writes collapses into one refresh.
 */
import { useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type { SyncTable } from './sync';

export type { SyncTable } from './sync';

export const REALTIME_TABLES: SyncTable[] = [
  'messages',
  'moods',
  'question_answers',
  'bucket_items',
  'goals',
  'reminders',
  'important_dates',
  'journal_entries',
  'memories',
  'timeline_moments',
  'vault_items',
  'challenge_progress',
];

export function useCoupleRealtime(
  coupleId: string | null,
  onTableChange: (table: SyncTable) => void
): void {
  const handlerRef = useRef(onTableChange);
  handlerRef.current = onTableChange;

  useEffect(() => {
    if (!coupleId || !isSupabaseConfigured()) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`couple-sync:${coupleId}`);
    const timers: Partial<Record<SyncTable, ReturnType<typeof setTimeout>>> = {};

    const debounce = (table: SyncTable) => {
      const existing = timers[table];
      if (existing) clearTimeout(existing);
      timers[table] = setTimeout(() => {
        delete timers[table];
        handlerRef.current(table);
      }, 250);
    };

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `couple_id=eq.${coupleId}`,
        },
        () => debounce(table)
      );
    }

    channel.subscribe();

    return () => {
      for (const t of Object.keys(timers) as SyncTable[]) clearTimeout(timers[t]);
      void supabase.removeChannel(channel);
    };
  }, [coupleId]);
}

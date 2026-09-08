/**
 * Supabase client, authenticated via the Clerk session token (Supabase
 * "Third-Party Auth" for Clerk — see pairly-backend/README.md). This file
 * intentionally does NOT crash at import time when unconfigured: most of
 * the app (local SQLite screens) must keep working even before a Supabase
 * project exists. Callers that actually need the backend should call
 * `getSupabase()` and handle `SupabaseNotConfiguredError` explicitly rather
 * than assume a client always exists.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured yet (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing).');
    this.name = 'SupabaseNotConfiguredError';
  }
}

let client: SupabaseClient | null = null;
let getClerkTokenFn: (() => Promise<string | null>) | null = null;

/** Called once from the root layout once Clerk is ready, so the Supabase
 * client can attach the live Clerk session token to every request. */
export function registerClerkTokenGetter(fn: () => Promise<string | null>): void {
  getClerkTokenFn = fn;
}

export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: async () => (getClerkTokenFn ? await getClerkTokenFn() : null),
    });
  }
  return client;
}

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client for Auth session only.
 * Domain reads/writes go through the Nest API (`lib/api.ts`), not PostgREST.
 */
export function createBrowserAuthClient(): Pick<SupabaseClient, 'auth'> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
  }
  const client = createBrowserClient(url, anon);
  return { auth: client.auth };
}

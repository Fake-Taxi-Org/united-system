import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client connected to the Libre Sakay Supabase project.
 * Uses separate env vars from the eService system's own Supabase.
 *
 * Required env vars:
 *   LIBRE_SAKAY_SUPABASE_URL
 *   LIBRE_SAKAY_SUPABASE_SERVICE_ROLE_KEY
 */
export function getLibreSakaySupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.LIBRE_SAKAY_SUPABASE_URL;
    const key = process.env.LIBRE_SAKAY_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing LIBRE_SAKAY_SUPABASE_URL or LIBRE_SAKAY_SUPABASE_SERVICE_ROLE_KEY env vars'
      );
    }
    _client = createClient(url, key, {
      transport: ws,
      realtime: { transport: ws },
    } as any);
  }
  return _client;
}

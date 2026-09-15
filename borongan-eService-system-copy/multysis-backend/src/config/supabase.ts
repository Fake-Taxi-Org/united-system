import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

export const ESERVICE_BUCKET = 'eservice-uploads';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    }
    _supabase = createClient(url, key, {
      transport: ws,
      realtime: { transport: ws },
    } as any);
  }
  return _supabase;
}

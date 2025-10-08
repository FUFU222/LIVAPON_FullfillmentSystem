'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;

function ensureBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    client = createBrowserClient<Database>(url, key);
  }

  return client;
}

export function getBrowserClient(): SupabaseClient<Database> {
  return ensureBrowserClient();
}

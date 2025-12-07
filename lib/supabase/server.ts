import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

function ensureEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to create a Supabase server client`);
  }
  return value;
}

type CookieWriteMode = 'allow-write' | 'read-only';

async function createServerSupabaseClient(mode: CookieWriteMode): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  type CookieSetterOptions = Parameters<(typeof cookieStore)['set']>[2];
  const url = ensureEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = ensureEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const cookieAdapter = {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options?: CookieSetterOptions) {
      if (mode === 'allow-write') {
        cookieStore.set(name, value, options);
      }
      // When mode is read-only, do nothing. Supabase may attempt to rotate
      // session cookies during getSession(), but Next.js forbids writes in
      // Server Components; suppressing the write prevents runtime crashes.
    },
    remove(name: string) {
      if (mode === 'allow-write') {
        cookieStore.delete(name);
      }
    }
  } as const;

  return createServerClient<Database>(url, anonKey, {
    cookies: cookieAdapter
  });
}

export function getServerComponentClient(): Promise<SupabaseClient<Database>> {
  return createServerSupabaseClient('read-only');
}

export function getServerActionClient(): Promise<SupabaseClient<Database>> {
  return createServerSupabaseClient('allow-write');
}

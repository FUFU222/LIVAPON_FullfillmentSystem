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

function createServerSupabaseClient(): SupabaseClient<Database> {
  const cookieStore = cookies();
  const url = ensureEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = ensureEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set(name, value, options);
      },
      remove(name) {
        cookieStore.delete(name);
      }
    }
  });
}

export function getServerComponentClient(): SupabaseClient<Database> {
  return createServerSupabaseClient();
}

export function getServerActionClient(): SupabaseClient<Database> {
  return createServerSupabaseClient();
}

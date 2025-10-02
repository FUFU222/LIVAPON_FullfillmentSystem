import { cookies } from 'next/headers';
import { createServerComponentClient, createServerActionClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types';

export function getServerComponentClient() {
  return createServerComponentClient<Database>({ cookies });
}

export function getServerActionClient() {
  return createServerActionClient<Database>({ cookies });
}

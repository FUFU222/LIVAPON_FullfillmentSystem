import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types';

export function getServerClient() {
  return createServerComponentClient<Database>({
    cookies
  });
}

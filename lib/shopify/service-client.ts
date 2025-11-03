import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let serviceClient: SupabaseClient<Database> | null = null;

function initClient(): SupabaseClient<Database> {
  if (!serviceUrl || !serviceKey) {
    throw new Error('Supabase service client is not configured');
  }

  if (!serviceClient) {
    serviceClient = createClient<Database>(serviceUrl, serviceKey, {
      auth: { persistSession: false }
    });
  }

  return serviceClient;
}

export function getShopifyServiceClient(): SupabaseClient<Database> {
  return initClient();
}

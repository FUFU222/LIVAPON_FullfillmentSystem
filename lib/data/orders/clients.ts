import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';

export function getOptionalServiceClient(): SupabaseClient<Database> | null {
  try {
    return getShopifyServiceClient();
  } catch {
    return null;
  }
}

export function assertServiceClient(): SupabaseClient<Database> {
  const client = getOptionalServiceClient();
  if (!client) {
    throw new Error('Supabase service client is not configured');
  }
  return client;
}

export function normalizeShopDomainValue(domain: string | null | undefined): string | null {
  if (!domain) {
    return null;
  }
  return domain.replace(/^https?:\/\//i, '').trim().toLowerCase() || null;
}

import { getShopifyServiceClient } from '@/lib/shopify/service-client';

export function normalizeShopDomain(shopDomain: string | null | undefined): string | null {
  if (!shopDomain) {
    return null;
  }
  return shopDomain.replace(/^https?:\/\//i, '').trim().toLowerCase() || null;
}

export async function isRegisteredShopDomain(shopDomain: string): Promise<boolean> {
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) {
    return false;
  }

  const client = getShopifyServiceClient();
  console.log('🏪 Checking shop domain in Supabase:', normalized);

  const { data, error } = await client
    .from('shopify_connections')
    .select('id')
    .eq('shop', normalized)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase domain check error:', error);
    throw error;
  }

  console.log('🔍 Supabase domain check result:', { shop: normalized, found: !!data });
  return Boolean(data);
}

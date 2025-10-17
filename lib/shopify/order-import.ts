import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// ==========================
// Supabase Client Setup
// ==========================
const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient: SupabaseClient<Database> | null = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: { persistSession: false }
    })
  : null;

function assertServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) throw new Error('Supabase service client is not configured');
  return serviceClient;
}

export function getShopifyServiceClient(): SupabaseClient<Database> {
  return assertServiceClient();
}

// ==========================
// Shop Domain Verification
// ==========================
export async function isRegisteredShopDomain(shopDomain: string): Promise<boolean> {
  const normalized = shopDomain.trim().toLowerCase();
  if (!normalized) return false;

  const client = assertServiceClient();
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

// ==========================
// Shopify Order Payload Types
// ==========================
type ShopifyOrderPayload = {
  id: number;
  order_number: string;
  name: string;
  created_at: string;
  updated_at: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string;
  total_price: string;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  line_items: Array<{
    id: number;
    variant_id: number | null;
    sku: string | null;
    title: string;
    quantity: number;
    fulfillable_quantity?: number;
    vendor?: string | null;
  }>;
  fulfillments?: Array<{
    id: number;
    tracking_number?: string | null;
    tracking_numbers?: string[];
    tracking_company?: string | null;
    status?: string | null;
    created_at?: string | null;
    line_items?: Array<{ id: number; line_item_id: number; quantity: number }>;
  }>;
};

type VendorResolution = {
  vendorId: number | null;
  vendorSkuId: number | null;
};

// ==========================
// Vendor Resolver
// ==========================
async function resolveVendorForSku(
  client: SupabaseClient<Database>,
  sku: string | null,
  shopifyProductVendor?: string | null
): Promise<VendorResolution> {
  if (!sku) return { vendorId: null, vendorSkuId: null };
  const normalizedSku = sku.trim();
  if (normalizedSku.length === 0) return { vendorId: null, vendorSkuId: null };

  console.log('🧩 Resolving vendor for SKU:', normalizedSku);

  // 1️⃣ vendor_skusから検索
  const { data: vendorSku, error: vendorSkuError } = await client
    .from('vendor_skus')
    .select('id, vendor_id')
    .eq('sku', normalizedSku)
    .maybeSingle();

  if (vendorSkuError) throw vendorSkuError;
  if (vendorSku) {
    console.log('✅ Found vendor_sku record:', vendorSku);
    return { vendorId: vendorSku.vendor_id, vendorSkuId: vendorSku.id };
  }

  // 2️⃣ SKU先頭4桁からvendorsを検索
  const prefix = normalizedSku.slice(0, 4);
  if (prefix.length === 4) {
    const { data: vendorByCode, error: vendorByCodeError } = await client
      .from('vendors')
      .select('id')
      .eq('code', prefix)
      .maybeSingle();

    if (vendorByCodeError) throw vendorByCodeError;
    if (vendorByCode) {
      console.log(`🔢 Matched vendor by code [${prefix}]:`, vendorByCode.id);
      return { vendorId: vendorByCode.id, vendorSkuId: null };
    }
  }

  // 3️⃣ Shopify上のvendor名から検索
  if (shopifyProductVendor) {
    const { data: vendorByName, error: vendorByNameError } = await client
      .from('vendors')
      .select('id')
      .ilike('name', shopifyProductVendor.trim())
      .maybeSingle();

    if (vendorByNameError) throw vendorByNameError;
    if (vendorByName) {
      console.log(`🧾 Matched vendor by name "${shopifyProductVendor}":`, vendorByName.id);
      return { vendorId: vendorByName.id, vendorSkuId: null };
    }
  }

  console.warn('⚠️ Vendor not resolved for SKU:', normalizedSku);
  return { vendorId: null, vendorSkuId: null };
}

// ==========================
// Helpers
// ==========================
function buildCustomerName(payload: ShopifyOrderPayload): string | null {
  const first = payload.customer?.first_name ?? '';
  const last = payload.customer?.last_name ?? '';
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : null;
}

// ==========================
// Orders Table Upsert
// ==========================
async function upsertOrderRecord(
  client: SupabaseClient<Database>,
  payload: ShopifyOrderPayload,
  lineItemVendors: VendorResolution[],
  normalizedShopDomain: string | null
): Promise<number> {
  const uniqueVendorIds = Array.from(
    new Set(lineItemVendors.map(r => r.vendorId).filter((v): v is number => Number.isInteger(v)))
  );
  const orderVendorId = uniqueVendorIds.length === 1 ? uniqueVendorIds[0] : null;

  const orderInsert: Database['public']['Tables']['orders']['Insert'] = {
    shopify_order_id: payload.id,
    vendor_id: orderVendorId,
    order_number: payload.name || payload.order_number,
    customer_name: buildCustomerName(payload),
    status: payload.fulfillment_status ?? 'unfulfilled',
    shop_domain: normalizedShopDomain,
    created_at: payload.created_at,
    updated_at: payload.updated_at
  };

  console.log('🪶 Upserting order record:', orderInsert);

  const { data, error } = await client
    .from('orders')
    .upsert(orderInsert, { onConflict: 'shopify_order_id' })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('❌ Error upserting order:', error);
    throw error;
  }

  console.log('✅ Order upsert successful, ID:', data?.id);
  if (!data) throw new Error('Failed to upsert order record');
  return data.id;
}

// ==========================
// Line Items Replace
// ==========================
async function replaceLineItems(
  client: SupabaseClient<Database>,
  orderId: number,
  payload: ShopifyOrderPayload,
  lineItemVendors: VendorResolution[]
) {
  console.log('🧹 Removing existing line_items for order:', orderId);
  await client.from('line_items').delete().eq('order_id', orderId);

  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    console.log('⚠️ No line_items to insert.');
    return;
  }

  const inserts: Database['public']['Tables']['line_items']['Insert'][] = payload.line_items.map(
    (item, index) => ({
      order_id: orderId,
      vendor_id: lineItemVendors[index].vendorId,
      vendor_sku_id: lineItemVendors[index].vendorSkuId,
      shopify_line_item_id: item.id,
      sku: item.sku ?? null,
      product_name: item.title,
      quantity: item.quantity,
      fulfilled_quantity: 0,
      fulfillable_quantity: item.fulfillable_quantity ?? item.quantity
    })
  );

  console.log('📦 Inserting line_items:', inserts.length);
  const { error } = await client.from('line_items').insert(inserts);

  if (error) {
    console.error('❌ Error inserting line_items:', error);
    throw error;
  }

  console.log('✅ Line items inserted successfully for order:', orderId);
}

// ==========================
// Main Entry: upsertShopifyOrder
// ==========================
function normalizeShopDomain(shopDomain: string | null | undefined): string | null {
  if (!shopDomain) return null;
  return shopDomain.replace(/^https?:\/\//i, '').trim().toLowerCase() || null;
}

export async function upsertShopifyOrder(payload: unknown, shopDomain: string) {
  const order = payload as ShopifyOrderPayload;
  const client = assertServiceClient();

  const normalizedShopDomain = normalizeShopDomain(shopDomain);

  console.log('🚀 upsertShopifyOrder START:', {
    orderId: order?.id,
    lineItems: order?.line_items?.length,
    shopDomain: normalizedShopDomain
  });

  if (!order?.id || !Array.isArray(order.line_items)) {
    console.error('❌ Invalid Shopify order payload:', payload);
    throw new Error('Invalid Shopify order payload');
  }

  try {
    const lineItemVendors: VendorResolution[] = [];
    for (const item of order.line_items) {
      const resolution = await resolveVendorForSku(client, item.sku, item.vendor ?? undefined);
      lineItemVendors.push(resolution);
    }

    const orderId = await upsertOrderRecord(client, order, lineItemVendors, normalizedShopDomain);
    await replaceLineItems(client, orderId, order, lineItemVendors);

    console.log('✅ upsertShopifyOrder COMPLETE:', { orderId, lineItemCount: order.line_items.length });
  } catch (err) {
    console.error('🔥 upsertShopifyOrder FAILED:', err);
    throw err;
  }
}

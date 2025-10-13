import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient: SupabaseClient<Database> | null = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })
  : null;

function assertServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }
  return serviceClient;
}

export function getShopifyServiceClient(): SupabaseClient<Database> {
  return assertServiceClient();
}

export async function isRegisteredShopDomain(shopDomain: string): Promise<boolean> {
  const normalized = shopDomain.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const client = assertServiceClient();
  const { data, error } = await client
    .from('shopify_connections')
    .select('id')
    .eq('shop', normalized)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

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
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  line_items: Array<{
    id: number;
    variant_id: number | null;
    sku: string | null;
    title: string;
    quantity: number;
    vendor?: string | null;
  }>;
  fulfillments?: Array<{
    id: number;
    tracking_number?: string | null;
    tracking_numbers?: string[];
    tracking_company?: string | null;
    status?: string | null;
    created_at?: string | null;
    line_items?: Array<{
      id: number;
      line_item_id: number;
      quantity: number;
    }>;
  }>;
};

type VendorResolution = {
  vendorId: number | null;
  vendorSkuId: number | null;
};

async function resolveVendorForSku(
  client: SupabaseClient<Database>,
  sku: string | null,
  shopifyProductVendor?: string | null
): Promise<VendorResolution> {
  if (!sku) {
    return { vendorId: null, vendorSkuId: null };
  }

  const normalizedSku = sku.trim();
  if (normalizedSku.length === 0) {
    return { vendorId: null, vendorSkuId: null };
  }

  const { data: vendorSku, error: vendorSkuError } = await client
    .from('vendor_skus')
    .select('id, vendor_id')
    .eq('sku', normalizedSku)
    .maybeSingle();

  if (vendorSkuError) {
    throw vendorSkuError;
  }

  if (vendorSku) {
    return { vendorId: vendorSku.vendor_id, vendorSkuId: vendorSku.id };
  }

  const prefix = normalizedSku.slice(0, 4);

  if (prefix.length === 4) {
    const { data: vendorByCode, error: vendorByCodeError } = await client
      .from('vendors')
      .select('id')
      .eq('code', prefix)
      .maybeSingle();

    if (vendorByCodeError) {
      throw vendorByCodeError;
    }

    if (vendorByCode) {
      return { vendorId: vendorByCode.id, vendorSkuId: null };
    }
  }

  if (shopifyProductVendor) {
    const { data: vendorByName, error: vendorByNameError } = await client
      .from('vendors')
      .select('id')
      .ilike('name', shopifyProductVendor.trim())
      .maybeSingle();

    if (vendorByNameError) {
      throw vendorByNameError;
    }

    if (vendorByName) {
      return { vendorId: vendorByName.id, vendorSkuId: null };
    }
  }

  return { vendorId: null, vendorSkuId: null };
}

function buildCustomerName(payload: ShopifyOrderPayload): string | null {
  const first = payload.customer?.first_name ?? '';
  const last = payload.customer?.last_name ?? '';
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : null;
}

async function upsertOrderRecord(
  client: SupabaseClient<Database>,
  payload: ShopifyOrderPayload,
  lineItemVendors: VendorResolution[]
): Promise<number> {
  const uniqueVendorIds = Array.from(
    new Set(
      lineItemVendors
        .map((resolution) => resolution.vendorId)
        .filter((vendorId): vendorId is number => Number.isInteger(vendorId))
    )
  );

  const orderVendorId = uniqueVendorIds.length === 1 ? uniqueVendorIds[0] : null;

  const orderInsert: Database['public']['Tables']['orders']['Insert'] = {
    shopify_order_id: payload.id,
    vendor_id: orderVendorId,
    order_number: payload.name || payload.order_number,
    customer_name: buildCustomerName(payload),
    status: payload.fulfillment_status ?? 'unfulfilled',
    created_at: payload.created_at,
    updated_at: payload.updated_at
  };

  const { data, error } = await client
    .from('orders')
    .upsert(orderInsert, { onConflict: 'shopify_order_id' })
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to upsert order record');
  }

  return data.id;
}

async function replaceLineItems(
  client: SupabaseClient<Database>,
  orderId: number,
  payload: ShopifyOrderPayload,
  lineItemVendors: VendorResolution[]
) {
  await client
    .from('line_items')
    .delete()
    .eq('order_id', orderId);

  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    return;
  }

  const inserts: Database['public']['Tables']['line_items']['Insert'][] = payload.line_items.map((item, index) => ({
    order_id: orderId,
    vendor_id: lineItemVendors[index].vendorId,
    vendor_sku_id: lineItemVendors[index].vendorSkuId,
    shopify_line_item_id: item.id,
    sku: item.sku ?? null,
    product_name: item.title,
    quantity: item.quantity,
    fulfilled_quantity: 0
  }));

  const { error } = await client
    .from('line_items')
    .insert(inserts);

  if (error) {
    throw error;
  }
}


export async function upsertShopifyOrder(payload: unknown) {
  const order = payload as ShopifyOrderPayload;
  const client = assertServiceClient();

  if (!order?.id || !Array.isArray(order.line_items)) {
    throw new Error('Invalid Shopify order payload');
  }

  const lineItemVendors = [] as VendorResolution[];

  for (const item of order.line_items) {
    const resolution = await resolveVendorForSku(client, item.sku, item.vendor ?? undefined);
    lineItemVendors.push(resolution);
  }

  const orderId = await upsertOrderRecord(client, order, lineItemVendors);

  await replaceLineItems(client, orderId, order, lineItemVendors);

  // TODO: optionally process fulfillments into shipments when schema supports order association.
}

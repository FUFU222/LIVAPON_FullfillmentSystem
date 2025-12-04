import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';
import { sendVendorNewOrderEmail, type VendorNewOrderEmailLineItem } from '@/lib/notifications/vendor-new-order';

// ==========================
// Shop Domain Verification
// ==========================
export async function isRegisteredShopDomain(shopDomain: string): Promise<boolean> {
  const normalized = shopDomain.trim().toLowerCase();
  if (!normalized) return false;

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
  cancelled_at?: string | null;
  archived_at?: string | null;
  currency: string;
  total_price: string;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  shipping_address?: {
    zip?: string | null;
    postal_code?: string | null;
    province?: string | null;
    province_code?: string | null;
    city?: string | null;
    address1?: string | null;
    address2?: string | null;
  } | null;
  line_items: Array<{
    id: number;
    variant_id: number | null;
    sku: string | null;
    title: string;
    variant_title?: string | null;
    quantity: number;
    fulfillable_quantity?: number;
    fulfilled_quantity?: number;
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
  const first = (payload.customer?.first_name ?? '').trim();
  const last = (payload.customer?.last_name ?? '').trim();
  const parts = [last, first].filter((value) => value.length > 0);
  const full = parts.join(' ').trim();
  return full.length > 0 ? full : null;
}

function buildShippingAddress(payload: ShopifyOrderPayload) {
  const shipping = payload.shipping_address;
  if (!shipping) {
    return {
      postal: null,
      prefecture: null,
      city: null,
      address1: null,
      address2: null
    };
  }

  return {
    postal: shipping.zip ?? shipping.postal_code ?? null,
    prefecture: shipping.province ?? shipping.province_code ?? null,
    city: shipping.city ?? null,
    address1: shipping.address1 ?? null,
    address2: shipping.address2 ?? null
  };
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
  const orderStatus = deriveOrderStatus(payload);
  const uniqueVendorIds = Array.from(
    new Set(lineItemVendors.map(r => r.vendorId).filter((v): v is number => Number.isInteger(v)))
  );
  const orderVendorId = uniqueVendorIds.length === 1 ? uniqueVendorIds[0] : null;
  const shippingAddress = buildShippingAddress(payload);

  const orderInsert: Database['public']['Tables']['orders']['Insert'] = {
    shopify_order_id: payload.id,
    vendor_id: orderVendorId,
    order_number: payload.name || payload.order_number,
    customer_name: buildCustomerName(payload),
    shipping_postal: shippingAddress.postal,
    shipping_prefecture: shippingAddress.prefecture,
    shipping_city: shippingAddress.city,
    shipping_address1: shippingAddress.address1,
    shipping_address2: shippingAddress.address2,
    status: orderStatus,
    archived_at: payload.archived_at ?? null,
    shop_domain: normalizedShopDomain,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    last_updated_source: 'webhook',
    last_updated_by: null
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
  console.info('[realtime-debug] orders upserted', {
    orderId: data?.id ?? null,
    vendorId: orderVendorId,
    shopDomain: normalizedShopDomain,
    lineItemCount: payload.line_items.length
  });
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
  const items = Array.isArray(payload.line_items)
    ? payload.line_items.map((item, index) => {
        const vendorMeta = lineItemVendors[index] ?? { vendorId: null, vendorSkuId: null };
        return {
          shopify_line_item_id: item.id,
          vendor_id: vendorMeta.vendorId,
          vendor_sku_id: vendorMeta.vendorSkuId,
          sku: item.sku ?? null,
          product_name: item.title,
          variant_title: item.variant_title ?? null,
          quantity: item.quantity,
          fulfillable_quantity: item.fulfillable_quantity ?? item.quantity,
          fulfilled_quantity: item.fulfilled_quantity ?? 0,
          last_updated_source: 'webhook',
          last_updated_by: null
        } satisfies Record<string, unknown>;
      })
    : [];

  console.log('📦 Syncing line_items via RPC:', items.length);
  const { error } = await client.rpc('sync_order_line_items', {
    p_order_id: orderId,
    p_items: items
  });

  if (error) {
    console.error('❌ Failed to sync line_items via RPC', error);
    throw error;
  }

  console.info('[realtime-debug] line_items synced', {
    orderId,
    syncedLineItems: items.length
  });
}

async function upsertVendorNotificationRecord(
  client: SupabaseClient<Database>,
  orderId: number,
  vendorId: number,
  status: string,
  errorMessage?: string | null,
  sentAt?: string | null
) {
  const { error } = await client
    .from('vendor_order_notifications')
    .upsert(
      {
        order_id: orderId,
        vendor_id: vendorId,
        notification_type: 'new_order',
        status,
        error_message: errorMessage ?? null,
        sent_at: sentAt ?? null
      },
      { onConflict: 'order_id,vendor_id,notification_type' }
    );

  if (error) {
    console.error('Failed to upsert vendor_order_notifications', { orderId, vendorId, status, error });
  }
}

async function notifyVendorsOfNewOrder(
  client: SupabaseClient<Database>,
  orderId: number,
  payload: ShopifyOrderPayload,
  lineItemVendors: VendorResolution[]
) {
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    return;
  }

  const vendorItems = new Map<number, VendorNewOrderEmailLineItem[]>();
  payload.line_items.forEach((item, index) => {
    const vendorId = lineItemVendors[index]?.vendorId;
    if (!vendorId) {
      return;
    }
    const list = vendorItems.get(vendorId) ?? [];
    list.push({
      productName: item.title,
      quantity: item.quantity,
      sku: item.sku ?? null,
      variantTitle: item.variant_title ?? null
    });
    vendorItems.set(vendorId, list);
  });

  if (vendorItems.size === 0) {
    return;
  }

  const vendorIds = Array.from(vendorItems.keys());
  const { data: vendorRows, error: vendorError } = await client
    .from('vendors')
    .select('id, name, contact_email, notify_new_orders')
    .in('id', vendorIds);
  if (vendorError) {
    throw vendorError;
  }
  const vendorMap = new Map((vendorRows ?? []).map((row) => [row.id, row]));

  const { data: existingNotifications, error: existingNotificationsError } = await client
    .from('vendor_order_notifications')
    .select('vendor_id, status')
    .eq('order_id', orderId)
    .eq('notification_type', 'new_order');
  if (existingNotificationsError) {
    throw existingNotificationsError;
  }
  const notificationMap = new Map(
    (existingNotifications ?? [])
      .filter((row) => typeof row.vendor_id === 'number')
      .map((row) => [row.vendor_id as number, row])
  );

  const shippingAddress = buildShippingAddress(payload);
  const customerName = buildCustomerName(payload);

  for (const [vendorId, items] of vendorItems.entries()) {
    const vendor = vendorMap.get(vendorId);
    if (!vendor) {
      continue;
    }

    if (notificationMap.get(vendorId)?.status === 'sent') {
      continue;
    }

    if (vendor.notify_new_orders === false) {
      await upsertVendorNotificationRecord(client, orderId, vendorId, 'skipped', 'notifications_disabled');
      continue;
    }

    if (!vendor.contact_email) {
      await upsertVendorNotificationRecord(client, orderId, vendorId, 'skipped', 'missing_contact_email');
      continue;
    }

    try {
      await sendVendorNewOrderEmail({
        to: vendor.contact_email,
        vendorName: vendor.name ?? 'ベンダー各位',
        orderNumber: payload.name || payload.order_number,
        orderCreatedAt: payload.created_at,
        customerName,
        shipping: {
          postalCode: shippingAddress.postal,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          city: shippingAddress.city,
          state: shippingAddress.prefecture
        },
        lineItems: items
      });

      await upsertVendorNotificationRecord(
        client,
        orderId,
        vendorId,
        'sent',
        null,
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Failed to send vendor new order email', { vendorId, orderId, error });
      await upsertVendorNotificationRecord(
        client,
        orderId,
        vendorId,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

// ==========================
// Main Entry: upsertShopifyOrder
// ==========================
function normalizeShopDomain(shopDomain: string | null | undefined): string | null {
  if (!shopDomain) return null;
  return shopDomain.replace(/^https?:\/\//i, '').trim().toLowerCase() || null;
}

function deriveOrderStatus(payload: ShopifyOrderPayload): string {
  if (payload.cancelled_at) {
    return 'cancelled';
  }
  if (payload.fulfillment_status) {
    return payload.fulfillment_status;
  }
  if (
    payload.line_items?.every(
      (item) => (item.fulfilled_quantity ?? 0) >= item.quantity
    )
  ) {
    return 'fulfilled';
  }
  if (payload.line_items?.some((item) => (item.fulfilled_quantity ?? 0) > 0)) {
    return 'partially_fulfilled';
  }
  return 'unfulfilled';
}

export async function upsertShopifyOrder(payload: unknown, shopDomain: string) {
  const order = payload as ShopifyOrderPayload;
  const client = getShopifyServiceClient();

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
    try {
      await notifyVendorsOfNewOrder(client, orderId, order, lineItemVendors);
    } catch (notificationError) {
      console.error('Failed to prepare vendor notifications', {
        orderId,
        error: notificationError
      });
    }

    try {
      const { syncFulfillmentOrderMetadata, markShipmentsCancelledForOrder } = await import(
        '@/lib/data/orders'
      );
      const syncResult = await syncFulfillmentOrderMetadata(normalizedShopDomain, order.id);
      if (syncResult.status === 'error') {
        console.warn('Fulfillment order metadata sync failed after order upsert', {
          shopDomain: normalizedShopDomain,
          orderId: order.id,
          error: syncResult.error
        });
      }

      if (deriveOrderStatus(order) === 'cancelled') {
        await markShipmentsCancelledForOrder(orderId);
      }
    } catch (error) {
      console.warn('Deferred fulfillment order sync after order upsert due to error', {
        error,
        shopDomain: normalizedShopDomain,
        orderId: order.id
      });
    }

    console.log('✅ upsertShopifyOrder COMPLETE:', { orderId, lineItemCount: order.line_items.length });
  } catch (err) {
    console.error('🔥 upsertShopifyOrder FAILED:', err);
    throw err;
  }
}

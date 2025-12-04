import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';
import {
  applyFulfillmentOrderSnapshot,
  loadShopifyAccessToken
} from '@/lib/shopify/fulfillment';
import { upsertShopifyOrder } from '@/lib/shopify/order-import';

const SHOPIFY_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? '2025-10';

export class FulfillmentCallbackError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'FulfillmentCallbackError';
  }
}

type Supabase = SupabaseClient<Database>;

type NormalizedLineItem = {
  fulfillmentOrderLineItemId: number;
  shopifyLineItemId: number;
  requestedQuantity: number | null;
  remainingQuantity: number | null;
};

export type FulfillmentServiceHandlerResult =
  | {
      status: 'accepted';
      fulfillmentOrderId: number;
      orderId: number | null;
      vendorId: number | null;
      requestId: number;
      message?: string;
    }
  | {
      status: 'pending';
      fulfillmentOrderId: number;
      orderId: number | null;
      vendorId: number | null;
      requestId: number;
      message?: string;
    }
  | {
      status: 'rejected';
      fulfillmentOrderId: number;
      orderId: number | null;
      vendorId: number | null;
      requestId: number;
      message?: string;
    };

function normalizeShopDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, '').trim().toLowerCase();
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeLineItems(lineItems: unknown[]): NormalizedLineItem[] {
  return lineItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const fulfillmentOrderLineItemId = normalizeNumber(
        record.id ?? record.fulfillment_order_line_item_id
      );
      const shopifyLineItemId = normalizeNumber(
        record.line_item_id ??
          record.shopify_line_item_id ??
          (record.line_item && (record.line_item as Record<string, unknown>).id)
      );
      const requestedQuantity =
        normalizeNumber(record.requested_quantity) ??
        normalizeNumber(record.quantity) ??
        normalizeNumber(
          record.line_item && (record.line_item as Record<string, unknown>).quantity
        );
      const remainingQuantity =
        normalizeNumber(record.remaining_quantity) ??
        normalizeNumber(record.fulfillable_quantity) ??
        requestedQuantity ??
        null;

      if (!fulfillmentOrderLineItemId || !shopifyLineItemId) {
        return null;
      }

      return {
        fulfillmentOrderLineItemId,
        shopifyLineItemId,
        requestedQuantity: requestedQuantity ?? null,
        remainingQuantity
      } satisfies NormalizedLineItem;
    })
    .filter((value): value is NormalizedLineItem => value !== null);
}

async function fetchShopifyOrderPayload(shopDomain: string, orderId: number) {
  const client = getShopifyServiceClient();
  const accessToken = await loadShopifyAccessToken(client, shopDomain);
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) {
    throw new Error('Invalid shop domain');
  }

  const url = new URL(
    `/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`,
    `https://${normalized}`
  );
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Shopify-Access-Token': accessToken
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Shopify order ${orderId}: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { order?: unknown };
  if (!data.order) {
    throw new Error('Shopify order response missing order payload');
  }

  return data.order;
}

async function ensureOrderRecord(shopDomain: string, shopifyOrderId: number): Promise<void> {
  try {
    const orderPayload = await fetchShopifyOrderPayload(shopDomain, shopifyOrderId);
    await upsertShopifyOrder(orderPayload, shopDomain, { sendVendorNotifications: false });
  } catch (error) {
    console.warn('Failed to auto-upsert Shopify order for fulfillment request', {
      error,
      shopDomain,
      shopifyOrderId
    });
  }
}

type PersistOptions = {
  client: Supabase;
  shopDomain: string;
  shopifyOrderId: number;
  fulfillmentOrderId: number;
  orderId: number | null;
  vendorId: number | null;
  status: string;
  message: string | null;
  payload: unknown;
  lineItems: NormalizedLineItem[];
  lineItemMap: Map<number, { id: number; vendor_id: number | null }>;
};

async function persistFulfillmentRequest(options: PersistOptions): Promise<number> {
  const {
    client,
    shopDomain,
    shopifyOrderId,
    fulfillmentOrderId,
    orderId,
    vendorId,
    status,
    message,
    payload,
    lineItems,
    lineItemMap
  } = options;
  const nowIso = new Date().toISOString();

  const requestInsert: Database['public']['Tables']['fulfillment_requests']['Insert'] = {
    shop_domain: normalizeShopDomain(shopDomain),
    shopify_order_id: shopifyOrderId,
    shopify_fulfillment_order_id: fulfillmentOrderId,
    order_id: orderId,
    vendor_id: vendorId,
    status,
    message,
    raw_payload: payload as Json,
    requested_at: nowIso,
    processed_at: status === 'accepted' ? nowIso : null,
    updated_at: nowIso
  };

  const { data: requestRow, error: upsertError } = await client
    .from('fulfillment_requests')
    .upsert(requestInsert, { onConflict: 'shopify_fulfillment_order_id' })
    .select('id')
    .single();

  if (upsertError) {
    throw new FulfillmentCallbackError('Failed to upsert fulfillment request', 500, upsertError);
  }

  const requestId = requestRow.id;

  const { error: deleteError } = await client
    .from('fulfillment_request_line_items')
    .delete()
    .eq('fulfillment_request_id', requestId);

  if (deleteError) {
    throw new FulfillmentCallbackError(
      'Failed to update fulfillment request line items',
      500,
      deleteError
    );
  }

  if (lineItems.length > 0) {
    const lineItemInserts: Database['public']['Tables']['fulfillment_request_line_items']['Insert'][] =
      lineItems.map((item) => ({
        fulfillment_request_id: requestId,
        line_item_id: lineItemMap.get(item.shopifyLineItemId)?.id ?? null,
        shopify_line_item_id: item.shopifyLineItemId,
        fulfillment_order_line_item_id: item.fulfillmentOrderLineItemId,
        requested_quantity: item.requestedQuantity,
        remaining_quantity: item.remainingQuantity,
        created_at: nowIso,
        updated_at: nowIso
      }));

    if (lineItemInserts.length > 0) {
      const { error: insertError } = await client
        .from('fulfillment_request_line_items')
        .insert(lineItemInserts);

      if (insertError) {
        throw new FulfillmentCallbackError(
          'Failed to store fulfillment request line items',
          500,
          insertError
        );
      }
    }
  }

  return requestId;
}

type LoadedOrderRecord = { id: number; shop_domain: string | null; status: string | null };

async function loadOrderRecord(
  client: Supabase,
  shopifyOrderId: number
): Promise<LoadedOrderRecord | null> {
  const { data, error } = await client
    .from('orders')
    .select('id, shop_domain, status')
    .eq('shopify_order_id', shopifyOrderId)
    .maybeSingle();

  if (error) {
    throw new FulfillmentCallbackError('Failed to load order for fulfillment request', 500, error);
  }

  return data ?? null;
}

async function loadMatchingLineItems(
  client: Supabase,
  orderId: number,
  shopifyLineItemIds: number[]
): Promise<Map<number, { id: number; vendor_id: number | null }>> {
  if (shopifyLineItemIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from('line_items')
    .select('id, vendor_id, shopify_line_item_id')
    .eq('order_id', orderId)
    .in('shopify_line_item_id', shopifyLineItemIds);

  if (error) {
    throw new FulfillmentCallbackError('Failed to load line items for fulfillment request', 500, error);
  }

  const map = new Map<number, { id: number; vendor_id: number | null }>();
  (data ?? []).forEach((item) => {
    map.set(item.shopify_line_item_id, {
      id: item.id,
      vendor_id: item.vendor_id
    });
  });

  return map;
}

function deriveVendorId(lineItemMap: Map<number, { id: number; vendor_id: number | null }>): number | null {
  const vendorIds = new Set<number>();
  for (const item of lineItemMap.values()) {
    if (typeof item.vendor_id === 'number') {
      vendorIds.add(item.vendor_id);
    }
  }

  if (vendorIds.size === 1) {
    return vendorIds.values().next().value ?? null;
  }

  return null;
}

export async function handleFulfillmentServiceRequest(
  shopDomain: string,
  payload: unknown
): Promise<FulfillmentServiceHandlerResult> {
  if (typeof shopDomain !== 'string' || shopDomain.trim().length === 0) {
    throw new FulfillmentCallbackError('Invalid shop domain', 400);
  }

  if (!payload || typeof payload !== 'object') {
    throw new FulfillmentCallbackError('Invalid payload', 422);
  }

  const body = payload as Record<string, unknown>;
  const fulfillmentOrder = body.fulfillment_order ?? body.fulfillmentOrder;

  if (!fulfillmentOrder || typeof fulfillmentOrder !== 'object') {
    throw new FulfillmentCallbackError('Missing fulfillment_order in payload', 422);
  }

  const foRecord = fulfillmentOrder as Record<string, unknown>;
  const fulfillmentOrderId = normalizeNumber(foRecord.id ?? foRecord.fulfillment_order_id);
  if (!fulfillmentOrderId) {
    throw new FulfillmentCallbackError('fulfillment_order.id is required', 422);
  }

  const shopifyOrderId = normalizeNumber(
    foRecord.order_id ??
      body.order_id ??
      (foRecord.order && (foRecord.order as Record<string, unknown>).id)
  );

  if (!shopifyOrderId) {
    throw new FulfillmentCallbackError('fulfillment_order.order_id is required', 422);
  }

  const rawLineItems = Array.isArray(foRecord.line_items) ? foRecord.line_items : [];
  const normalizedLineItems = normalizeLineItems(rawLineItems);

  const client = getShopifyServiceClient();

  let orderRecord = await loadOrderRecord(client, shopifyOrderId);

  if (!orderRecord) {
    await ensureOrderRecord(shopDomain, shopifyOrderId);
    orderRecord = await loadOrderRecord(client, shopifyOrderId);
  }

  const lineItemMap = orderRecord
    ? await loadMatchingLineItems(
        client,
        orderRecord.id,
        normalizedLineItems.map((item) => item.shopifyLineItemId)
      )
    : new Map<number, { id: number; vendor_id: number | null }>();

  const vendorId = deriveVendorId(lineItemMap);
  const status = orderRecord ? 'accepted' : 'pending';
  const message = orderRecord
    ? 'Fulfillment request accepted'
    : 'Shopify order is not yet synchronized. Request queued.';

  const requestId = await persistFulfillmentRequest({
    client,
    shopDomain,
    shopifyOrderId,
    fulfillmentOrderId,
    orderId: orderRecord?.id ?? null,
    vendorId,
    status,
    message,
    payload,
    lineItems: normalizedLineItems,
    lineItemMap
  });

  if (orderRecord) {
    const snapshotItems = normalizedLineItems.map((item) => ({
      id: item.fulfillmentOrderLineItemId,
      line_item_id: item.shopifyLineItemId,
      remaining_quantity: item.remainingQuantity ?? item.requestedQuantity ?? 0
    }));
    const foStatus = typeof foRecord.status === 'string' ? foRecord.status : null;

    try {
      await applyFulfillmentOrderSnapshot({
        client,
        orderRecordId: orderRecord.id,
        shopifyOrderId,
        fulfillmentOrderId,
        lineItems: snapshotItems,
        foStatus,
        currentOrderStatus: orderRecord.status ?? null
      });
    } catch (error) {
      console.warn('Failed to apply fulfillment order snapshot during callback', {
        error,
        shopDomain,
        shopifyOrderId,
        fulfillmentOrderId
      });
    }
  }

  if (status === 'pending') {
    return {
      status: 'pending',
      fulfillmentOrderId,
      orderId: orderRecord?.id ?? null,
      vendorId,
      requestId,
      message
    };
  }

  return {
    status: 'accepted',
    fulfillmentOrderId,
    orderId: orderRecord?.id ?? null,
    vendorId,
    requestId,
    message
  };
}

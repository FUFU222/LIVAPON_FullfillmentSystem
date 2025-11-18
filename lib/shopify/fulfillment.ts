import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';

const SHOPIFY_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? '2025-10';
const DEFAULT_SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? '';

function normalizeShopDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain.replace(/^https?:\/\//i, '').trim().toLowerCase() || null;
}

function mapCarrierToShopifyCompany(carrier: string | null): string | undefined {
  switch (carrier) {
    case 'yamato':
      return 'Yamato (JA)';
    case 'sagawa':
      return 'Sagawa (JA)';
    case 'japanpost':
      return 'Japan Post (JA)';
    case 'dhl':
      return 'DHL Express';
    case 'fedex':
      return 'FedEx';
    default:
      return carrier ?? undefined;
  }
}

export async function loadShopifyAccessToken(
  client: SupabaseClient<Database>,
  domain: string
): Promise<string> {
  const normalized = normalizeShopDomain(domain) ?? normalizeShopDomain(DEFAULT_SHOP_DOMAIN);
  if (!normalized) {
    throw new Error('Shopify shop domain is not configured');
  }

  const { data, error } = await client
    .from('shopify_connections')
    .select('access_token')
    .eq('shop', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Shopify access token: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Shopify shop ${normalized} is not authorized`);
  }

  return data.access_token;
}

type ShopifyApiError = Error & { status?: number };

async function shopifyRequest<T>(
  shop: string,
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const normalized = normalizeShopDomain(shop);
  if (!normalized) {
    throw new Error('Invalid Shopify shop domain');
  }

  const url = new URL(`/admin/api/${SHOPIFY_API_VERSION}/${path}`, `https://${normalized}`);
  const response = await fetch(url, {
    method: 'GET',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      Accept: 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    const error: ShopifyApiError = new Error(`Shopify API ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  const json = (await response.json()) as T;
  return json;
}

function extractNumericIdFromGid(value: string | number, resourceName: string): number {
  if (typeof value === 'number') {
    return value;
  }

  const match = value.match(/\/(\d+)(?:\?.*)?$/);
  if (!match) {
    throw new Error(`Invalid Shopify GID for ${resourceName}: ${value}`);
  }
  return Number(match[1]);
}

type FulfillmentOrderLineItem = {
  id: number;
  line_item_id: number;
  remaining_quantity: number;
};

type FulfillmentOrderInfo = {
  fulfillmentOrderId: number;
  lineItems: Map<number, FulfillmentOrderLineItem>;
};

const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_FO_ATTEMPTS = 5;

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type FulfillmentOrderLineItemSnapshot = {
  id: number;
  line_item_id: number;
  remaining_quantity: number;
};

export type FulfillmentOrderSnapshot = {
  id: number;
  status?: string | null;
  line_items: FulfillmentOrderLineItemSnapshot[];
};

async function fetchFulfillmentOrdersWithRetry(
  shop: string,
  accessToken: string,
  orderId: number
): Promise<FulfillmentOrderSnapshot[]> {
  type Response = {
    fulfillment_orders: Array<{
      id: number;
      status?: string;
      line_items: Array<{
        id: number;
        line_item_id: number;
        remaining_quantity: number;
      }>;
    }>;
  };

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < MAX_FO_ATTEMPTS) {
    attempt += 1;
    try {
      const data = await shopifyRequest<Response>(
        shop,
        accessToken,
        `orders/${orderId}/fulfillment_orders.json`
      );

      return (data.fulfillment_orders ?? []).map((order) => ({
        id: order.id,
        status: order.status ?? null,
        line_items: (order.line_items ?? []).map((item) => ({
          id: item.id,
          line_item_id: item.line_item_id,
          remaining_quantity: item.remaining_quantity
        }))
      }));
    } catch (error) {
      lastError = error;
      const status = (error as ShopifyApiError)?.status;
      const retriable = typeof status === 'number' && RETRIABLE_STATUS.has(status);

      if (!retriable || attempt >= MAX_FO_ATTEMPTS) {
        throw error;
      }

      const backoffMs = Math.min(16000, Math.pow(2, attempt - 1) * 1000);
      console.warn('Retrying Shopify FO fetch', {
        shop,
        orderId,
        attempt,
        backoffMs,
        status
      });
      await delay(backoffMs);
    }
  }

  throw lastError ?? new Error('Failed to fetch fulfillment orders');
}

async function fetchFulfillmentOrderInfo(
  shop: string,
  accessToken: string,
  orderId: number
): Promise<FulfillmentOrderInfo> {
  const snapshots = await fetchFulfillmentOrdersWithRetry(shop, accessToken, orderId);
  const fulfillmentOrder = snapshots[0];

  if (!fulfillmentOrder) {
    throw new Error('No fulfillment order found for Shopify order');
  }

  const lineItems = new Map<number, FulfillmentOrderLineItem>();
  for (const item of fulfillmentOrder.line_items ?? []) {
    lineItems.set(item.line_item_id, {
      id: item.id,
      line_item_id: item.line_item_id,
      remaining_quantity: item.remaining_quantity
    });
  }

  return {
    fulfillmentOrderId: fulfillmentOrder.id,
    lineItems
  };
}

async function createShopifyFulfillment(
  shop: string,
  accessToken: string,
  payload: unknown
): Promise<number> {
  type Response = {
    fulfillment?: {
      id: number;
    };
  };

  const data = await shopifyRequest<Response>(shop, accessToken, 'fulfillments.json', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  const id = data.fulfillment?.id;
  if (!id) {
    throw new Error('Shopify fulfillment creation response missing id');
  }
  return id;
}

async function updateShopifyFulfillmentTracking(
  shop: string,
  accessToken: string,
  fulfillmentId: number,
  trackingInfo: {
    number: string;
    company?: string;
    url?: string | null;
  }
) {
  await shopifyRequest(shop, accessToken, `fulfillments/${fulfillmentId}/update_tracking.json`, {
    method: 'POST',
    body: JSON.stringify({
      tracking_info: {
        number: trackingInfo.number,
        company: trackingInfo.company,
        url: trackingInfo.url ?? undefined
      }
    })
  });
}

type ShipmentRecord = {
  id: number;
  tracking_number: string | null;
  tracking_company: string | null;
  tracking_url: string | null;
  carrier: string | null;
  status: string | null;
  shopify_fulfillment_id: number | null;
  order_id: number | null;
  order: {
    id: number;
    shopify_order_id: number;
    shop_domain: string | null;
    shopify_fulfillment_order_id: number | null;
  } | null;
  line_items: Array<{
    line_item_id: number;
    quantity: number | null;
    fulfillment_order_line_item_id: number | null;
    line_item: {
      id: number;
      shopify_line_item_id: number;
      fulfillable_quantity: number | null;
      fulfillment_order_line_item_id: number | null;
      quantity: number;
    } | null;
  }>;
};

function calculateQuantity(
  pivotQuantity: number | null,
  lineItemRecord: ShipmentRecord['line_items'][number]['line_item'],
  foItem: FulfillmentOrderLineItem
): number {
  if (pivotQuantity && pivotQuantity > 0) {
    return Math.min(pivotQuantity, foItem.remaining_quantity || pivotQuantity);
  }

  const fulfillmentRemaining = foItem.remaining_quantity;
  if (fulfillmentRemaining && fulfillmentRemaining > 0) {
    return fulfillmentRemaining;
  }

  if (lineItemRecord?.fulfillable_quantity && lineItemRecord.fulfillable_quantity > 0) {
    return lineItemRecord.fulfillable_quantity;
  }

  return lineItemRecord?.quantity ?? 1;
}

export async function syncShipmentWithShopify(shipmentId: number) {
  const client = getShopifyServiceClient();

  const { data, error } = await client
    .from('shipments')
    .select(
      `id, tracking_number, tracking_company, tracking_url, carrier, status, shopify_fulfillment_id, order_id,
       order:orders(id, shopify_order_id, shop_domain, shopify_fulfillment_order_id),
       line_items:shipment_line_items(
         line_item_id, quantity, fulfillment_order_line_item_id,
         line_item:line_items(id, shopify_line_item_id, fulfillable_quantity, fulfillment_order_line_item_id, quantity)
       )
      `
    )
    .eq('id', shipmentId)
    .maybeSingle<ShipmentRecord>();

  if (error) {
    throw new Error(`Failed to load shipment ${shipmentId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }

  const order = data.order;
  if (!order) {
    throw new Error('Shipment missing related order');
  }

  const shopDomain = order.shop_domain ?? DEFAULT_SHOP_DOMAIN;
  const accessToken = await loadShopifyAccessToken(client, shopDomain);

  const trackingNumber = data.tracking_number;
  if (!trackingNumber) {
    throw new Error('Shipment missing tracking number');
  }

  await client
    .from('shipments')
    .update({
      sync_status: 'processing',
      sync_error: null,
      sync_pending_until: null,
      last_retry_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', shipmentId);

  const { fulfillmentOrderId, lineItems: foLineItems } = await fetchFulfillmentOrderInfo(
    shopDomain,
    accessToken,
    order.shopify_order_id
  );

  const shipmentLineItems = data.line_items ?? [];
  if (shipmentLineItems.length === 0) {
    throw new Error('Shipment has no associated line items');
  }

  const lineItemsByFulfillmentOrder = shipmentLineItems.map((pivot) => {
    const lineItemRecord = pivot.line_item;
    if (!lineItemRecord) {
      throw new Error('Shipment line item missing line item record');
    }

    const foItem = foLineItems.get(lineItemRecord.shopify_line_item_id);
    if (!foItem) {
      throw new Error(`Fulfillment order item not found for line item ${lineItemRecord.shopify_line_item_id}`);
    }

    const quantity = calculateQuantity(pivot.quantity ?? null, lineItemRecord, foItem);

    return {
      pivot,
      lineItemRecord,
      foItem,
      quantity
    };
  });

  const trackingCompany = mapCarrierToShopifyCompany(data.tracking_company ?? data.carrier);

  const lineItemQuantities = new Map<number, number | null>();
  const lineItemInternalIds = new Map<number, number>();
  lineItemsByFulfillmentOrder.forEach(({ pivot, quantity, lineItemRecord }) => {
    lineItemQuantities.set(pivot.line_item_id, quantity);
    const shopifyLineItemId = lineItemRecord.shopify_line_item_id;
    if (typeof shopifyLineItemId === 'number') {
      lineItemInternalIds.set(shopifyLineItemId, pivot.line_item_id);
    }
  });

  if (data.shopify_fulfillment_id) {
    await updateShopifyFulfillmentTracking(shopDomain, accessToken, data.shopify_fulfillment_id, {
      number: trackingNumber,
      company: trackingCompany,
      url: data.tracking_url ?? undefined
    });

    await client
      .from('shipments')
      .update({
        sync_status: 'synced',
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_error: null,
        tracking_company: trackingCompany ?? data.tracking_company ?? null,
        sync_retry_count: 0,
        sync_pending_until: null,
        last_retry_at: new Date().toISOString()
      })
      .eq('id', shipmentId);

    return;
  }

  const fulfillmentPayload = {
    fulfillment: {
      notify_customer: false,
      tracking_info: {
        number: trackingNumber,
        company: trackingCompany,
        url: data.tracking_url ?? undefined
      },
      line_items_by_fulfillment_order: [
        {
          fulfillment_order_id: fulfillmentOrderId,
          fulfillment_order_line_items: lineItemsByFulfillmentOrder.map(({ foItem, quantity }) => ({
            id: foItem.id,
            quantity
          }))
        }
      ]
    }
  };

  const fulfillmentId = await createShopifyFulfillment(shopDomain, accessToken, fulfillmentPayload);

  await client
    .from('shipments')
    .update({
      shopify_fulfillment_id: fulfillmentId,
      sync_status: 'synced',
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_error: null,
      tracking_company: trackingCompany ?? data.tracking_company ?? null,
      sync_retry_count: 0,
      sync_pending_until: null,
      last_retry_at: new Date().toISOString()
    })
    .eq('id', shipmentId);

  await applyFulfillmentOrderSnapshot({
    client,
    orderRecordId: order.id,
    shopifyOrderId: order.shopify_order_id,
    shipmentId,
    fulfillmentOrderId,
    lineItems: Array.from(foLineItems.values()),
    lineItemQuantities,
    lineItemInternalIds
  });
}

export async function resolveShopifyOrderIdFromFulfillmentOrder(
  shop: string,
  fulfillmentOrderId: string | number
): Promise<number | null> {
  const client = getShopifyServiceClient();
  const accessToken = await loadShopifyAccessToken(client, shop);
  const numericId = extractNumericIdFromGid(fulfillmentOrderId, 'FulfillmentOrder');

  type Response = {
    fulfillment_order?: {
      id: number;
      order_id: number;
    };
  };

  try {
    const data = await shopifyRequest<Response>(
      shop,
      accessToken,
      `fulfillment_orders/${numericId}.json`
    );

    const resolvedOrderId = data.fulfillment_order?.order_id;
    if (typeof resolvedOrderId !== 'number') {
      throw new Error(`Fulfillment order ${numericId} response missing order_id`);
    }

    return resolvedOrderId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('404')) {
      console.warn('Fulfillment order not yet available when resolving order id', {
        shop,
        fulfillmentOrderId,
        numericId,
        message
      });
      return null;
    }

    throw error;
  }
}

export async function cancelShopifyFulfillment(
  shop: string,
  accessToken: string,
  fulfillmentId: number
) {
  await shopifyRequest(shop, accessToken, `fulfillments/${fulfillmentId}/cancel.json`, {
    method: 'POST'
  });
}

export async function upsertShopifyOrderNoteAttribute(
  shop: string,
  accessToken: string,
  orderId: number,
  attribute: { name: string; value: string }
) {
  const existing = await fetchOrderNoteAttributes(shop, accessToken, orderId);
  const attrs = [...existing.filter((entry) => entry.name !== attribute.name), attribute];

  await shopifyRequest(shop, accessToken, `orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: {
        id: orderId,
        note_attributes: attrs
      }
    })
  });
}

type ShopifyNoteAttribute = {
  name: string;
  value: string;
};

async function fetchOrderNoteAttributes(shop: string, accessToken: string, orderId: number) {
  type Response = {
    order?: {
      id: number;
      note_attributes?: ShopifyNoteAttribute[];
    };
  };

  try {
    const data = await shopifyRequest<Response>(
      shop,
      accessToken,
      `orders/${orderId}.json?fields=id,note_attributes`
    );

    return data.order?.note_attributes ?? [];
  } catch (error) {
    console.warn('Failed to fetch order note attributes', { shop, orderId, error });
    return [];
  }
}

type ApplySnapshotOptions = {
  client: SupabaseClient<Database>;
  orderRecordId: number;
  shopifyOrderId: number;
  fulfillmentOrderId: number;
  lineItems: FulfillmentOrderLineItemSnapshot[];
  foStatus?: string | null;
  shipmentId?: number | null;
  lineItemQuantities?: Map<number, number | null>;
  lineItemInternalIds?: Map<number, number>;
};

export async function applyFulfillmentOrderSnapshot(options: ApplySnapshotOptions) {
  const {
    client,
    orderRecordId,
    shopifyOrderId,
    fulfillmentOrderId,
    lineItems,
    shipmentId,
    lineItemQuantities,
    lineItemInternalIds
  } = options;

  await client
    .from('orders')
    .update({
      shopify_fulfillment_order_id: fulfillmentOrderId,
      shopify_fo_status: (options.foStatus ?? null)?.toLowerCase() ?? null,
      updated_at: new Date().toISOString(),
      last_updated_source: 'worker:fo-sync',
      last_updated_by: null
    })
    .eq('id', orderRecordId);

  if (lineItems.length > 0) {
    await Promise.all(
      lineItems.map((item) =>
        client
          .from('line_items')
          .update({
            fulfillment_order_line_item_id: item.id,
            fulfillable_quantity: item.remaining_quantity
          })
          .eq('shopify_line_item_id', item.line_item_id)
          .eq('order_id', orderRecordId)
      )
    );
  }

  if (shipmentId && lineItems.length > 0 && lineItemInternalIds) {
    const pivotUpdates = lineItems
      .map((item) => {
        const internalId = lineItemInternalIds.get(item.line_item_id);
        if (typeof internalId !== 'number') {
          return null;
        }
        return {
          shipment_id: shipmentId,
          line_item_id: internalId,
          fulfillment_order_line_item_id: item.id,
          quantity: lineItemQuantities?.get(internalId) ?? null
        };
      })
      .filter((value): value is {
        shipment_id: number;
        line_item_id: number;
        fulfillment_order_line_item_id: number;
        quantity: number | null;
      } => value !== null);

    if (pivotUpdates.length > 0) {
      await client
        .from('shipment_line_items')
        .upsert(pivotUpdates, { onConflict: 'shipment_id,line_item_id' });
    }
  }

  console.info('Fulfillment order metadata applied', {
    shopifyOrderId,
    fulfillmentOrderId,
    lineItemCount: lineItems.length
  });
}

export async function fetchFulfillmentOrderSnapshots(
  shop: string,
  accessToken: string,
  orderId: number
): Promise<FulfillmentOrderSnapshot[]> {
  return fetchFulfillmentOrdersWithRetry(shop, accessToken, orderId);
}

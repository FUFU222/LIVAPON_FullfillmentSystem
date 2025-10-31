import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/order-import';

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
    throw new Error(`Shopify API ${response.status}: ${text}`);
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

async function fetchFulfillmentOrderInfo(
  shop: string,
  accessToken: string,
  orderId: number
): Promise<FulfillmentOrderInfo> {
  type Response = {
    fulfillment_orders: Array<{
      id: number;
      line_items: Array<{
        id: number;
        line_item_id: number;
        remaining_quantity: number;
      }>;
    }>;
  };

  const data = await shopifyRequest<Response>(shop, accessToken, `orders/${orderId}/fulfillment_orders.json`);
  const fulfillmentOrder = data.fulfillment_orders?.[0];
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

  await client
    .from('orders')
    .update({
      shopify_fulfillment_order_id: fulfillmentOrderId
    })
    .eq('id', order.id);

  const updates = lineItemsByFulfillmentOrder.map(({ lineItemRecord, foItem }) => ({
    id: lineItemRecord.id,
    fulfillment_order_line_item_id: foItem.id,
    fulfillable_quantity: foItem.remaining_quantity
  }));

  if (updates.length > 0) {
    await Promise.all(
      updates.map((row) =>
        client
          .from('line_items')
          .update({
            fulfillment_order_line_item_id: row.fulfillment_order_line_item_id,
            fulfillable_quantity: row.fulfillable_quantity
          })
          .eq('id', row.id)
      )
    );

    const pivotUpdates = lineItemsByFulfillmentOrder.map(({ pivot, foItem, quantity }) => ({
      shipment_id: shipmentId,
      line_item_id: pivot.line_item_id,
      fulfillment_order_line_item_id: foItem.id,
      quantity: quantity
    }));

    await client
      .from('shipment_line_items')
      .upsert(pivotUpdates, { onConflict: 'shipment_id,line_item_id' });
  }
}

export async function resolveShopifyOrderIdFromFulfillmentOrder(
  shop: string,
  fulfillmentOrderId: string | number
): Promise<number> {
  const client = getShopifyServiceClient();
  const accessToken = await loadShopifyAccessToken(client, shop);
  const numericId = extractNumericIdFromGid(fulfillmentOrderId, 'FulfillmentOrder');

  type Response = {
    fulfillment_order?: {
      id: number;
      order_id: number;
    };
  };

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

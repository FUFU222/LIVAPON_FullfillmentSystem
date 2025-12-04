import { upsertShopifyOrder } from '@/lib/shopify/order-import';
import { isRegisteredShopDomain } from '@/lib/shopify/shop-domains';
import {
  triggerShipmentResyncForShopifyOrder,
  syncFulfillmentOrderMetadata
} from '@/lib/data/orders';
import { resolveShopifyOrderIdFromFulfillmentOrder } from '@/lib/shopify/fulfillment';
import type { WebhookJobRecord } from '@/lib/data/webhook-jobs';

export const SUPPORTED_TOPICS = new Set([
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'orders/fulfilled',
  'fulfillment_orders/order_routing_complete',
  'fulfillment_orders/hold_released'
]);

export const FULFILLMENT_ORDER_TOPICS = new Set([
  'fulfillment_orders/order_routing_complete',
  'fulfillment_orders/hold_released'
]);

export async function processShopifyWebhook(job: WebhookJobRecord) {
  const logContext = {
    shop: job.shop_domain,
    topic: job.topic,
    webhookId: job.webhook_id ?? undefined
  };

  if (!SUPPORTED_TOPICS.has(job.topic)) {
    console.warn('Ignoring unsupported webhook topic', logContext);
    return;
  }

  const payload = job.payload;

  const isKnownShop = await isRegisteredShopDomain(job.shop_domain);
  if (!isKnownShop) {
    throw new Error(`Shop ${job.shop_domain} is not registered`);
  }

  if (FULFILLMENT_ORDER_TOPICS.has(job.topic)) {
    await handleFulfillmentOrderWebhook(job.shop_domain, payload, logContext);
    return;
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as { id?: unknown }).id !== 'number' ||
    !Array.isArray((payload as { line_items?: unknown }).line_items)
  ) {
    throw new Error('Invalid order payload');
  }

  const shouldSendVendorNotifications = job.topic === 'orders/create';
  await upsertShopifyOrder(payload, job.shop_domain, {
    sendVendorNotifications: shouldSendVendorNotifications
  });
  const orderId = (payload as { id: number }).id;

  if (typeof orderId === 'number') {
    const foSync = await syncFulfillmentOrderMetadata(job.shop_domain, orderId);
    if (foSync.status !== 'synced') {
      console.info('Fulfillment order metadata not yet available after order webhook', {
        shop: job.shop_domain,
        orderId,
        result: foSync
      });
    } else {
      console.info('Fulfillment order metadata synced after order webhook', {
        shop: job.shop_domain,
        orderId
      });
    }
  }

  console.info('Shopify webhook processed successfully', logContext);
}

async function handleFulfillmentOrderWebhook(
  shopDomain: string,
  payload: any,
  logContext: Record<string, unknown>
) {
  const fulfillmentOrder = (payload?.fulfillment_order ?? null) as { order_id?: unknown; id?: unknown } | null;
  let orderId = typeof fulfillmentOrder?.order_id === 'number'
    ? fulfillmentOrder.order_id
    : payload?.order_id;

  if (typeof orderId !== 'number') {
    const fulfillmentOrderId = fulfillmentOrder?.id ?? payload?.fulfillment_order_id;
    if (typeof fulfillmentOrderId === 'string' || typeof fulfillmentOrderId === 'number') {
      orderId = await resolveShopifyOrderIdFromFulfillmentOrder(shopDomain, fulfillmentOrderId);
    }
  }

  if (typeof orderId !== 'number') {
    console.warn('Fulfillment order webhook missing resolvable order_id', {
      ...logContext,
      payload
    });
    return;
  }

  await triggerShipmentResyncForShopifyOrder(orderId);
  console.info('Triggered shipment resync after fulfillment order webhook', {
    ...logContext,
    orderId
  });
}

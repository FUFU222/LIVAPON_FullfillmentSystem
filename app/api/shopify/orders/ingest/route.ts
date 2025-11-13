import { NextResponse } from 'next/server';
import {
  upsertShopifyOrder,
  isRegisteredShopDomain
} from '@/lib/shopify/order-import';
import {
  triggerShipmentResyncForShopifyOrder,
  syncFulfillmentOrderMetadata
} from '@/lib/data/orders';
import { resolveShopifyOrderIdFromFulfillmentOrder } from '@/lib/shopify/fulfillment';
import { verifyShopifyWebhook } from '@/lib/shopify/hmac';

export const runtime = 'edge';

const SUPPORTED_TOPICS = new Set([
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'fulfillment_orders/order_routing_complete',
  'fulfillment_orders/hold_released'
]);

const FULFILLMENT_ORDER_TOPICS = new Set([
  'fulfillment_orders/order_routing_complete',
  'fulfillment_orders/hold_released'
]);

export async function POST(request: Request) {
  const secretLength = process.env.SHOPIFY_WEBHOOK_SECRET?.length ?? 0;
  const secretFingerprint = await createSecretFingerprint(process.env.SHOPIFY_WEBHOOK_SECRET ?? '');
  console.info('[shopify-ingest] webhook secret fingerprint', {
    secretLength,
    secretFingerprint,
    env: process.env.NODE_ENV
  });

  const bodyArrayBuffer = await request.arrayBuffer();
  const isValid = await verifyShopifyWebhook(bodyArrayBuffer, request.headers);

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const shopDomainHeader = request.headers.get('x-shopify-shop-domain');
  if (!shopDomainHeader) {
    return new NextResponse('Missing shop domain', { status: 400 });
  }

  const apiVersion = request.headers.get('x-shopify-api-version');
  if (apiVersion && apiVersion !== '2025-10') {
    console.warn('Unexpected Shopify API version', {
      shop: shopDomainHeader,
      received: apiVersion,
      expected: '2025-10'
    });
    return new NextResponse('Unsupported API version', { status: 400 });
  }

  const topicHeader = request.headers.get('x-shopify-topic');
  const topic = topicHeader?.toLowerCase() ?? null;
  if (!topic) {
    return new NextResponse('Missing topic', { status: 400 });
  }

  const webhookId = request.headers.get('x-shopify-webhook-id') ?? undefined;
  const logContext = {
    shop: shopDomainHeader,
    topic,
    webhookId
  };

  if (!webhookId) {
    console.warn('Shopify webhook missing id header', logContext);
  }

  if (!SUPPORTED_TOPICS.has(topic)) {
    console.warn('Unsupported Shopify webhook topic received', logContext);
    return new NextResponse(null, { status: 202 });
  }

  let isKnownShop = false;
  try {
    isKnownShop = await isRegisteredShopDomain(shopDomainHeader);
  } catch (error) {
    console.error('Failed to verify shop domain against Supabase', {
      error,
      ...logContext
    });
    return new NextResponse('Failed to verify shop domain', { status: 500 });
  }

  if (!isKnownShop) {
    console.warn('Shopify webhook from unregistered shop domain rejected', logContext);
    return new NextResponse('Unknown shop domain', { status: 403 });
  }

  const payloadText = new TextDecoder().decode(bodyArrayBuffer);
  let payload: unknown;

  try {
    payload = JSON.parse(payloadText);
  } catch (error) {
    console.warn('Failed to parse Shopify webhook payload', {
      error,
      ...logContext
    });
    return new NextResponse('Invalid JSON payload', { status: 400 });
  }

  if (FULFILLMENT_ORDER_TOPICS.has(topic)) {
    const fulfillmentOrder = (payload as { fulfillment_order?: { order_id?: unknown; id?: unknown } })?.fulfillment_order;
    let orderId = typeof fulfillmentOrder?.order_id === 'number'
      ? fulfillmentOrder.order_id
      : (payload as { order_id?: unknown })?.order_id;

    if (typeof orderId !== 'number') {
      const fulfillmentOrderId = fulfillmentOrder?.id ?? (payload as { fulfillment_order_id?: unknown })?.fulfillment_order_id;

      if (typeof fulfillmentOrderId === 'string' || typeof fulfillmentOrderId === 'number') {
        try {
          orderId = await resolveShopifyOrderIdFromFulfillmentOrder(shopDomainHeader, fulfillmentOrderId);
        } catch (error) {
          console.error('Failed to resolve order_id from fulfillment_order payload', {
            error,
            ...logContext,
            fulfillmentOrderId
          });
          return new NextResponse('Failed to resolve fulfillment order', { status: 500 });
        }
      }
    }

    if (typeof orderId !== 'number') {
      console.warn('Fulfillment order webhook missing resolvable order_id (likely not yet created)', {
        ...logContext,
        payload
      });
      return new NextResponse(null, { status: 202 });
    }

    try {
      await triggerShipmentResyncForShopifyOrder(orderId);
      console.info('Triggered shipment resync after fulfillment order webhook', {
        ...logContext,
        orderId
      });
    } catch (error) {
      console.error('Failed to trigger shipment resync', {
        error,
        ...logContext,
        orderId
      });
      return new NextResponse('Failed to trigger shipment resync', { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as { id?: unknown }).id !== 'number' ||
    !Array.isArray((payload as { line_items?: unknown }).line_items)
  ) {
    console.warn('Shopify webhook payload failed validation', logContext);
    return new NextResponse('Invalid payload', { status: 422 });
  }

  try {
    await upsertShopifyOrder(payload, shopDomainHeader);
    const orderId = (payload as { id: number }).id;
    if (typeof orderId === 'number') {
      const foSync = await syncFulfillmentOrderMetadata(shopDomainHeader, orderId);
      if (foSync.status !== 'synced') {
        console.info('Fulfillment order metadata not yet available after order webhook', {
          shop: shopDomainHeader,
          orderId,
          result: foSync
        });
      }
    }
    console.info('Shopify webhook processed successfully', logContext);
  } catch (error) {
    console.error('Failed to upsert Shopify order', {
      error,
      ...logContext
    });
    return new NextResponse('Failed to process order', { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

async function createSecretFingerprint(secret: string) {
  if (!secret) {
    return null;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes
    .slice(0, 4)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

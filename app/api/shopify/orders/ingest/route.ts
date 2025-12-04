import { NextResponse } from 'next/server';
import { isRegisteredShopDomain } from '@/lib/shopify/shop-domains';
import { getWebhookSecretMetadata, verifyShopifyWebhook } from '@/lib/shopify/hmac';
import { enqueueWebhookJob } from '@/lib/data/webhook-jobs';
import { processWebhookJobs } from '@/lib/jobs/webhook-runner';
import { SUPPORTED_TOPICS, FULFILLMENT_ORDER_TOPICS } from '@/lib/shopify/webhook-processor';
import { syncFulfillmentOrderMetadata } from '@/lib/data/orders';
import { resolveShopifyOrderIdFromFulfillmentOrder } from '@/lib/shopify/fulfillment';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'edge';

const INLINE_PROCESSING_ENABLED = process.env.ENABLE_INLINE_WEBHOOK_PROCESSING !== 'false';
const INLINE_BATCH_LIMIT = Math.max(1, Math.min(Number(process.env.INLINE_WEBHOOK_BATCH ?? '1'), 10));
const ORDER_STATUS_TOPICS = new Set(['orders/create', 'orders/updated', 'orders/cancelled', 'orders/fulfilled']);

export async function POST(request: Request) {
  const secretMetadata = await getWebhookSecretMetadata();
  console.info('[shopify-ingest] webhook secret metadata', {
    env: process.env.NODE_ENV,
    secrets: secretMetadata
  });

  const bodyArrayBuffer = await request.arrayBuffer();
  const isValid = await verifyShopifyWebhook(bodyArrayBuffer, request.headers);

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }
  console.info('[shopify-ingest] signature verified');

  const shopDomainHeader = request.headers.get('x-shopify-shop-domain');
  if (!shopDomainHeader) {
    return new NextResponse('Missing shop domain', { status: 400 });
  }
  console.info('[shopify-ingest] shop domain header accepted', { shop: shopDomainHeader });

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
  console.info('[shopify-ingest] topic header accepted', { topic });

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
  let payload: Json;

  try {
    payload = JSON.parse(payloadText) as Json;
  } catch (error) {
    console.warn('Failed to parse Shopify webhook payload', {
      error,
      ...logContext
    });
    return new NextResponse('Invalid JSON payload', { status: 400 });
  }
  console.info('[shopify-ingest] payload parsed successfully', logContext);

  if (typeof payload !== 'object' || payload === null) {
    return new NextResponse('Invalid payload', { status: 422 });
  }

  if (!FULFILLMENT_ORDER_TOPICS.has(topic) && !isOrderPayload(payload)) {
    console.warn('Shopify webhook payload failed validation', logContext);
    return new NextResponse('Invalid payload', { status: 422 });
  }

  try {
    await enqueueWebhookJob({
      shopDomain: shopDomainHeader,
      topic,
      apiVersion,
      webhookId,
      payload
    });
    console.info('Enqueued webhook job', logContext);
  } catch (error) {
    console.error('Failed to enqueue webhook job', { error, ...logContext });
    return new NextResponse('Failed to enqueue webhook', { status: 500 });
  }

  await triggerFulfillmentMetadataSync(topic, payload, shopDomainHeader, logContext);

  if (INLINE_PROCESSING_ENABLED) {
    try {
      await processWebhookJobs({ limit: INLINE_BATCH_LIMIT });
    } catch (error) {
      console.error('Inline webhook processing failed; job will be retried asynchronously', {
        error,
        ...logContext
      });
    }
  }

  return new NextResponse(null, { status: 202 });
}

function isOrderPayload(payload: unknown): payload is { id: number; line_items: unknown[] } {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as { id?: unknown; line_items?: unknown };
  return typeof candidate.id === 'number' && Array.isArray(candidate.line_items);
}

async function triggerFulfillmentMetadataSync(
  topic: string,
  payload: Json,
  shopDomain: string,
  logContext: Record<string, unknown>
) {
  try {
    const orderId = await resolveOrderIdForTopic(topic, payload, shopDomain);
    if (typeof orderId !== 'number') {
      return;
    }
    const result = await syncFulfillmentOrderMetadata(shopDomain, orderId);
    console.info('[shopify-ingest] fulfillment metadata sync result', {
      ...logContext,
      orderId,
      result
    });
  } catch (error) {
    console.warn('[shopify-ingest] failed to sync fulfillment metadata immediately', {
      ...logContext,
      error
    });
  }
}

async function resolveOrderIdForTopic(
  topic: string,
  payload: Json,
  shopDomain: string
): Promise<number | null> {
  if (ORDER_STATUS_TOPICS.has(topic)) {
    const candidate = (payload as { id?: unknown })?.id;
    if (typeof candidate === 'number') {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  if (FULFILLMENT_ORDER_TOPICS.has(topic)) {
    const foRecord =
      (payload as Record<string, any>)?.fulfillment_order ?? (payload as Record<string, any>) ?? null;
    const inlineOrderId = foRecord?.order_id ?? (payload as Record<string, any>)?.order_id;
    const orderId = normalizeNumericId(inlineOrderId);
    if (orderId !== null) {
      return orderId;
    }
    const fulfillmentOrderId = normalizeNumericId(
      foRecord?.id ?? (payload as Record<string, any>)?.fulfillment_order_id
    );
    if (fulfillmentOrderId === null) {
      return null;
    }
    return await resolveShopifyOrderIdFromFulfillmentOrder(shopDomain, fulfillmentOrderId);
  }

  return null;
}

function normalizeNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

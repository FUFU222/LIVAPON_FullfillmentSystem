import { NextResponse } from 'next/server';
import { upsertShopifyOrder, isRegisteredShopDomain } from '@/lib/shopify/order-import';
import { verifyShopifyWebhook } from '@/lib/shopify/hmac';

export const runtime = 'edge';

const SUPPORTED_TOPICS = new Set(['orders/create', 'orders/updated']);

export async function POST(request: Request) {
  const bodyArrayBuffer = await request.arrayBuffer();
  const isValid = await verifyShopifyWebhook(bodyArrayBuffer, request.headers);

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const shopDomainHeader = request.headers.get('x-shopify-shop-domain');
  if (!shopDomainHeader) {
    return new NextResponse('Missing shop domain', { status: 400 });
  }

  const topic = request.headers.get('x-shopify-topic');
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
  const payload = JSON.parse(payloadText);

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
    await upsertShopifyOrder(payload);
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

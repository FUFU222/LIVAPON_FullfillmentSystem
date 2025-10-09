import { NextResponse } from 'next/server';
import { upsertShopifyOrder } from '@/lib/shopify/order-import';
import { verifyShopifyWebhook } from '@/lib/shopify/hmac';

export const runtime = 'edge';

export async function POST(request: Request) {
  const bodyArrayBuffer = await request.arrayBuffer();
  const isValid = await verifyShopifyWebhook(bodyArrayBuffer, request.headers);

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const payloadText = new TextDecoder().decode(bodyArrayBuffer);
  const payload = JSON.parse(payloadText);

  try {
    await upsertShopifyOrder(payload);
  } catch (error) {
    console.error('Failed to upsert Shopify order', error);
    return new NextResponse('Failed to process order', { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

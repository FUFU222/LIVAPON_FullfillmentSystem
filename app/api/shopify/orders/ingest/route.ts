import { NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify/hmac';

export const runtime = 'edge';

export async function POST(request: Request) {
  const bodyArrayBuffer = await request.arrayBuffer();
  const bodyBuffer = Buffer.from(bodyArrayBuffer);

  const isValid = verifyShopifyWebhook(bodyBuffer, request.headers);

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(bodyBuffer.toString('utf-8'));

  console.log('Received Shopify order webhook', JSON.stringify(payload, null, 2));

  return new NextResponse(null, { status: 204 });
}

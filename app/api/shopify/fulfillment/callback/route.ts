import { NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify/hmac';
import { isRegisteredShopDomain } from '@/lib/shopify/shop-domains';
import {
  FulfillmentCallbackError,
  handleFulfillmentServiceRequest
} from '@/lib/data/fulfillment-requests';

export const runtime = 'edge';

const textDecoder = new TextDecoder();

function normalizeShopHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.trim();
}

export async function POST(request: Request) {
  const rawBody = await request.arrayBuffer();
  const isValid = await verifyShopifyWebhook(rawBody, request.headers);

  if (!isValid) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const shopHeader = normalizeShopHeaderValue(request.headers.get('x-shopify-shop-domain'));
  if (!shopHeader) {
    return new NextResponse('Missing shop domain', { status: 400 });
  }

  try {
    const isKnownShop = await isRegisteredShopDomain(shopHeader);
    if (!isKnownShop) {
      return new NextResponse('Unknown shop domain', { status: 403 });
    }
  } catch (error) {
    console.error('Failed to verify shop domain for fulfillment callback', {
      error,
      shop: shopHeader
    });
    return new NextResponse('Failed to verify shop domain', { status: 500 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(textDecoder.decode(rawBody));
  } catch (error) {
    console.warn('Failed to parse fulfillment callback payload', {
      error,
      shop: shopHeader
    });
    return new NextResponse('Invalid JSON payload', { status: 400 });
  }

  try {
    const result = await handleFulfillmentServiceRequest(shopHeader, payload);

    if (result.status === 'accepted') {
      return NextResponse.json(
        {
          fulfillment_order: {
            id: result.fulfillmentOrderId,
            status: 'accepted'
          },
          fulfillment_request: {
            message: result.message ?? 'Fulfillment request accepted'
          }
        },
        { status: 200 }
      );
    }

    if (result.status === 'pending') {
      return NextResponse.json(
        {
          fulfillment_order: {
            id: result.fulfillmentOrderId,
            status: 'pending'
          },
          fulfillment_request: {
            message: result.message ?? 'Order not yet synced; request queued'
          }
        },
        { status: 202 }
      );
    }

    return NextResponse.json(
      {
        fulfillment_order: {
          id: result.fulfillmentOrderId,
          status: 'rejected'
        },
        fulfillment_request: {
          message: result.message ?? 'Fulfillment request rejected'
        }
      },
      { status: 409 }
    );
  } catch (error) {
    if (error instanceof FulfillmentCallbackError) {
      console.warn('Fulfillment callback rejected', {
        message: error.message,
        status: error.status,
        details: error.details,
        shop: shopHeader
      });
      return new NextResponse(error.message, { status: error.status });
    }

    console.error('Unexpected fulfillment callback error', {
      error,
      shop: shopHeader
    });
    return new NextResponse('Failed to process fulfillment request', { status: 500 });
  }
}

import { POST } from '@/app/api/shopify/orders/ingest/route';

jest.mock('@/lib/shopify/order-import', () => ({
  upsertShopifyOrder: jest.fn(),
  isRegisteredShopDomain: jest.fn()
}));

jest.mock('@/lib/shopify/hmac', () => ({
  verifyShopifyWebhook: jest.fn()
}));

import { TextDecoder } from 'util';

if (typeof (globalThis as Record<string, unknown>).TextDecoder === 'undefined') {
  (globalThis as Record<string, unknown>).TextDecoder = TextDecoder;
}

const { upsertShopifyOrder, isRegisteredShopDomain } = jest.requireMock<{
  upsertShopifyOrder: jest.Mock;
  isRegisteredShopDomain: jest.Mock;
}>('@/lib/shopify/order-import');

const { verifyShopifyWebhook } = jest.requireMock<{
  verifyShopifyWebhook: jest.Mock;
}>('@/lib/shopify/hmac');

function buildRequest(
  body: unknown,
  headerOverrides: Record<string, string | undefined> = {}
) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-shopify-hmac-sha256': 'signature',
    'x-shopify-shop-domain': 'example.myshopify.com',
    'x-shopify-topic': 'orders/create'
  });

  for (const [key, value] of Object.entries(headerOverrides)) {
    if (typeof value === 'undefined') {
      headers.delete(key);
    } else {
      headers.set(key, value);
    }
  }

  const buffer = Buffer.from(JSON.stringify(body), 'utf8');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return {
    headers,
    async arrayBuffer() {
      return arrayBuffer;
    }
  } as unknown as Request;
}

describe('POST /api/shopify/orders/ingest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    verifyShopifyWebhook.mockResolvedValue(true);
    isRegisteredShopDomain.mockResolvedValue(true);
    upsertShopifyOrder.mockResolvedValue(undefined);
  });

  it('returns 401 when signature verification fails', async () => {
    verifyShopifyWebhook.mockResolvedValue(false);
    const response = await POST(buildRequest({ id: 1, line_items: [] }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when shop domain header is missing', async () => {
    const response = await POST(
      buildRequest({ id: 1, line_items: [] }, { 'x-shopify-shop-domain': undefined })
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when topic header is missing', async () => {
    const response = await POST(
      buildRequest({ id: 1, line_items: [] }, { 'x-shopify-topic': undefined })
    );
    expect(response.status).toBe(400);
  });

  it('returns 202 and skips processing for unsupported topics', async () => {
    const response = await POST(
      buildRequest({ id: 1, line_items: [] }, { 'x-shopify-topic': 'orders/delete' })
    );
    expect(response.status).toBe(202);
    expect(upsertShopifyOrder).not.toHaveBeenCalled();
  });

  it('returns 403 for unregistered shop domains', async () => {
    isRegisteredShopDomain.mockResolvedValue(false);
    const response = await POST(buildRequest({ id: 1, line_items: [] }));
    expect(response.status).toBe(403);
  });

  it('processes payload when headers and signature are valid', async () => {
    const payload = { id: 99, line_items: [] };
    const response = await POST(buildRequest(payload));

    expect(response.status).toBe(204);
    expect(upsertShopifyOrder).toHaveBeenCalledWith(payload);
  });
});
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    body: any;

    constructor(body?: any, init?: ResponseInit) {
      this.body = body ?? null;
      this.status = init?.status ?? 200;
    }

    static json(body?: any, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }

    static redirect(_url: string | URL, init?: number | ResponseInit) {
      if (typeof init === 'number') {
        return new MockNextResponse(null, { status: init });
      }
      return new MockNextResponse(null, init);
    }
  }

  return { NextResponse: MockNextResponse };
});

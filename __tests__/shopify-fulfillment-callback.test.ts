jest.mock('@/lib/shopify/hmac', () => ({
  verifyShopifyWebhook: jest.fn()
}));

jest.mock('@/lib/shopify/shop-domains', () => ({
  isRegisteredShopDomain: jest.fn()
}));

jest.mock('@/lib/data/fulfillment-requests', () => ({
  handleFulfillmentServiceRequest: jest.fn(),
  FulfillmentCallbackError: class MockError extends Error {
    status: number;
    details?: unknown;
    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
}));

let POST: typeof import('@/app/api/shopify/fulfillment/callback/route').POST;

beforeAll(async () => {
  if (typeof (globalThis as Record<string, unknown>).TextDecoder === 'undefined') {
    const { TextDecoder } = await import('util');
    (globalThis as Record<string, unknown>).TextDecoder = TextDecoder;
  }

  ({ POST } = await import('@/app/api/shopify/fulfillment/callback/route'));
});

const { verifyShopifyWebhook } = jest.requireMock<{ verifyShopifyWebhook: jest.Mock }>(
  '@/lib/shopify/hmac'
);

const { isRegisteredShopDomain } = jest.requireMock<{ isRegisteredShopDomain: jest.Mock }>(
  '@/lib/shopify/shop-domains'
);

const { handleFulfillmentServiceRequest, FulfillmentCallbackError } = jest.requireMock<{
  handleFulfillmentServiceRequest: jest.Mock;
  FulfillmentCallbackError: new (message: string, status: number) => Error & { status: number };
}>('@/lib/data/fulfillment-requests');

type HeaderOverrides = Record<string, string | undefined>;

function buildRequest(body: unknown, overrides: HeaderOverrides = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-shopify-hmac-sha256': 'signature',
    'x-shopify-shop-domain': 'example.myshopify.com'
  });

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      headers.delete(key);
    } else {
      headers.set(key, value);
    }
  }

  const json = JSON.stringify(body);
  const buffer = Buffer.from(json, 'utf8');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return {
    headers,
    async arrayBuffer() {
      return arrayBuffer;
    }
  } as unknown as Request;
}

describe('POST /api/shopify/fulfillment/callback', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    verifyShopifyWebhook.mockResolvedValue(true);
    isRegisteredShopDomain.mockResolvedValue(true);
    handleFulfillmentServiceRequest.mockResolvedValue({
      status: 'accepted',
      fulfillmentOrderId: 123,
      orderId: 456,
      vendorId: 10,
      requestId: 99,
      message: 'ok'
    });
  });

  it('returns 401 when signature verification fails', async () => {
    verifyShopifyWebhook.mockResolvedValue(false);
    const response = await POST(buildRequest({ fulfillment_order: {} }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when shop domain header is missing', async () => {
    const response = await POST(
      buildRequest({ fulfillment_order: {} }, { 'x-shopify-shop-domain': undefined })
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when JSON parsing fails', async () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': 'signature',
      'x-shopify-shop-domain': 'example.myshopify.com'
    });
    const badRequest = {
      headers,
      async arrayBuffer() {
        return Buffer.from('not-json', 'utf8');
      }
    } as unknown as Request;

    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });

  it('returns 403 when shop domain is not registered', async () => {
    isRegisteredShopDomain.mockResolvedValue(false);
    const response = await POST(buildRequest({ fulfillment_order: {} }));
    expect(response.status).toBe(403);
  });

  it('returns 200 when handler accepts the request', async () => {
    const payload = { fulfillment_order: { id: 1, order_id: 2 } };
    const response = await POST(buildRequest(payload));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fulfillment_order.status).toBe('accepted');
    expect(handleFulfillmentServiceRequest).toHaveBeenCalledWith(
      'example.myshopify.com',
      payload
    );
  });

  it('returns 202 when handler reports pending state', async () => {
    handleFulfillmentServiceRequest.mockResolvedValueOnce({
      status: 'pending',
      fulfillmentOrderId: 100,
      orderId: null,
      vendorId: null,
      requestId: 1,
      message: 'queued'
    });

    const response = await POST(
      buildRequest({ fulfillment_order: { id: 100, order_id: 200 } })
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.fulfillment_order.status).toBe('pending');
  });

  it('propagates FulfillmentCallbackError with custom status', async () => {
    handleFulfillmentServiceRequest.mockRejectedValueOnce(
      new FulfillmentCallbackError('bad payload', 422)
    );

    const response = await POST(buildRequest({ fulfillment_order: {} }));
    expect(response.status).toBe(422);
    expect(await response.text()).toBe('bad payload');
  });

  it('returns 500 for unexpected errors', async () => {
    handleFulfillmentServiceRequest.mockRejectedValueOnce(new Error('boom'));
    const response = await POST(buildRequest({ fulfillment_order: {} }));
    expect(response.status).toBe(500);
  });
});

jest.mock('next/server', () => {
  class MockNextResponse {
    body: any;
    status: number;

    constructor(body?: any, init?: ResponseInit) {
      this.body = body ?? null;
      this.status = init?.status ?? 200;
    }

    async json() {
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body ?? null);
    }

    static json(body?: any, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }
  }

  return { NextResponse: MockNextResponse };
});

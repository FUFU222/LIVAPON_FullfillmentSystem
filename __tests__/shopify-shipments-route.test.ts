jest.mock('next/server', () => ({
  NextResponse: {
    json(body?: any, init?: ResponseInit) {
      return {
        status: init?.status ?? 200,
        body,
        async json() {
          return body;
        }
      };
    }
  }
}));

import { POST } from '@/app/api/shopify/orders/shipments/route';

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn(),
  assertAuthorizedVendor: jest.fn()
}));

jest.mock('@/lib/data/shipment-import-jobs', () => ({
  validateShipmentSelectionsForVendor: jest.fn()
}));

jest.mock('@/lib/data/orders', () => ({
  registerShipmentsFromSelections: jest.fn(),
  resyncPendingShipments: jest.fn()
}));

const { requireAuthContext, assertAuthorizedVendor } = jest.requireMock<{
  requireAuthContext: jest.Mock;
  assertAuthorizedVendor: jest.Mock;
}>('@/lib/auth');

const { validateShipmentSelectionsForVendor } = jest.requireMock<{
  validateShipmentSelectionsForVendor: jest.Mock;
}>('@/lib/data/shipment-import-jobs');

const { registerShipmentsFromSelections, resyncPendingShipments } = jest.requireMock<{
  registerShipmentsFromSelections: jest.Mock;
  resyncPendingShipments: jest.Mock;
}>('@/lib/data/orders');

function buildRequest(
  body: unknown,
  options?: { origin?: string | null; requestUrl?: string }
) {
  const requestUrl = options?.requestUrl ?? 'https://app.example.com/api/shopify/orders/shipments';
  const headers = new Headers();
  const origin = options?.origin === undefined ? 'https://app.example.com' : options.origin;

  if (origin !== null) {
    headers.set('origin', origin);
  }

  return {
    url: requestUrl,
    headers,
    async json() {
      return body;
    }
  } as unknown as Request;
}

describe('POST /api/shopify/orders/shipments', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requireAuthContext.mockResolvedValue({ vendorId: 10 });
    assertAuthorizedVendor.mockImplementation(() => undefined);
    validateShipmentSelectionsForVendor.mockResolvedValue(true);
    registerShipmentsFromSelections.mockResolvedValue({
      shipmentIds: [7001, 7002],
      orderIds: [1, 2],
      itemCount: 2
    });
    resyncPendingShipments.mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      errors: []
    });
  });

  it('returns 403 when same-origin validation fails', async () => {
    const response = await POST(
      buildRequest(
        {
          trackingNumber: 'TRK-123',
          carrier: 'yamato',
          requestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
          items: [{ orderId: 1, lineItemId: 11, quantity: 1 }]
        },
        { origin: null }
      )
    );

    expect(response.status).toBe(403);
    expect(requireAuthContext).not.toHaveBeenCalled();
    expect(registerShipmentsFromSelections).not.toHaveBeenCalled();
  });

  it('registers local shipments immediately and starts best-effort Shopify resync', async () => {
    resyncPendingShipments.mockImplementation(() => new Promise(() => undefined));

    const winner = await Promise.race([
      POST(
        buildRequest({
          trackingNumber: 'TRK-123',
          carrier: 'yamato',
          requestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
          items: [
            { orderId: 1, lineItemId: 11, quantity: 1 },
            { orderId: 2, lineItemId: 22, quantity: 1 }
          ]
        })
      ),
      new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), 100);
      })
    ]);

    expect(winner).not.toBe('timeout');

    const response = winner as Response;
    expect(response.status).toBe(202);
    expect(validateShipmentSelectionsForVendor).toHaveBeenCalledWith(
      10,
      expect.arrayContaining([
        expect.objectContaining({ orderId: 1, lineItemId: 11 }),
        expect.objectContaining({ orderId: 2, lineItemId: 22 })
      ])
    );
    expect(registerShipmentsFromSelections).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ orderId: 1, lineItemId: 11, quantity: 1 }),
        expect.objectContaining({ orderId: 2, lineItemId: 22, quantity: 1 })
      ]),
      10,
      expect.objectContaining({
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        requestId: '7f34b856-574c-49fd-92bc-d21a60ce1083'
      })
    );
    expect(resyncPendingShipments).toHaveBeenCalledWith({ limit: 1 });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      shipmentIds: [7001, 7002],
      orderIds: [1, 2],
      itemCount: 2
    });
  });

  it('returns 403 when selected items are not authorized for vendor', async () => {
    validateShipmentSelectionsForVendor.mockResolvedValue(false);

    const response = await POST(
      buildRequest({
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        requestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
        items: [{ orderId: 999, lineItemId: 111, quantity: 1 }]
      })
    );

    expect(response.status).toBe(403);
    expect(registerShipmentsFromSelections).not.toHaveBeenCalled();
    expect(resyncPendingShipments).not.toHaveBeenCalled();
  });

  it('returns 400 when requestId is present but not a UUID', async () => {
    const response = await POST(
      buildRequest({
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        requestId: 'not-a-uuid',
        items: [{ orderId: 1, lineItemId: 11, quantity: 1 }]
      })
    );

    expect(response.status).toBe(400);
    expect(registerShipmentsFromSelections).not.toHaveBeenCalled();
  });

  it('returns 409 when requestId is reused for a different payload', async () => {
    registerShipmentsFromSelections.mockRejectedValue(
      new Error('Shipment request payload conflicts with a previous registration')
    );

    const response = await POST(
      buildRequest({
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        requestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
        items: [{ orderId: 1, lineItemId: 11, quantity: 1 }]
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Shipment request payload conflicts with a previous registration'
    });
  });
});

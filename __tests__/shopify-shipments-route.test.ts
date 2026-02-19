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
  createShipmentImportJob: jest.fn()
}));

jest.mock('@/lib/jobs/shipment-import-runner', () => ({
  processShipmentImportJobById: jest.fn()
}));

const { requireAuthContext, assertAuthorizedVendor } = jest.requireMock<{
  requireAuthContext: jest.Mock;
  assertAuthorizedVendor: jest.Mock;
}>('@/lib/auth');

const { createShipmentImportJob } = jest.requireMock<{
  createShipmentImportJob: jest.Mock;
}>('@/lib/data/shipment-import-jobs');

const { processShipmentImportJobById } = jest.requireMock<{
  processShipmentImportJobById: jest.Mock;
}>('@/lib/jobs/shipment-import-runner');

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
    createShipmentImportJob.mockResolvedValue({ jobId: 55, totalCount: 2 });
  });

  it('returns 403 when same-origin validation fails', async () => {
    const response = await POST(
      buildRequest(
        {
          trackingNumber: 'TRK-123',
          carrier: 'yamato',
          items: [{ orderId: 1, lineItemId: 11, quantity: 1 }]
        },
        { origin: null }
      )
    );

    expect(response.status).toBe(403);
    expect(requireAuthContext).not.toHaveBeenCalled();
    expect(createShipmentImportJob).not.toHaveBeenCalled();
  });

  it('returns accepted response without waiting for job processing completion', async () => {
    processShipmentImportJobById.mockImplementation(() => new Promise(() => undefined));

    const winner = await Promise.race([
      POST(
        buildRequest({
          trackingNumber: 'TRK-123',
          carrier: 'yamato',
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
    expect(createShipmentImportJob).toHaveBeenCalledTimes(1);
    expect(processShipmentImportJobById).toHaveBeenCalledWith(
      55,
      expect.objectContaining({ orderLimit: 1 })
    );
  });
});

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

import { GET, POST } from '@/app/api/shipment-jobs/[id]/route';

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn(),
  isAdmin: jest.fn()
}));

jest.mock('@/lib/data/shipment-import-jobs', () => ({
  getShipmentImportJobSummary: jest.fn()
}));

jest.mock('@/lib/jobs/shipment-import-runner', () => ({
  processShipmentImportJobById: jest.fn()
}));

const { requireAuthContext, isAdmin } = jest.requireMock<{
  requireAuthContext: jest.Mock;
  isAdmin: jest.Mock;
}>('@/lib/auth');

const { getShipmentImportJobSummary } = jest.requireMock<{
  getShipmentImportJobSummary: jest.Mock;
}>('@/lib/data/shipment-import-jobs');

const { processShipmentImportJobById } = jest.requireMock<{
  processShipmentImportJobById: jest.Mock;
}>('@/lib/jobs/shipment-import-runner');

function createSummary(status: string) {
  return {
    id: 12,
    status,
    totalCount: 3,
    processedCount: status === 'succeeded' ? 3 : 1,
    errorCount: 0,
    trackingNumber: 'TRK-001',
    carrier: 'yamato',
    lastError: null,
    createdAt: '2026-02-12T00:00:00.000Z',
    updatedAt: '2026-02-12T00:00:00.000Z',
    recentFailures: []
  };
}

function buildRequest(options?: { origin?: string | null; requestUrl?: string }) {
  const requestUrl = options?.requestUrl ?? 'https://app.example.com/api/shipment-jobs/12';
  const headers = new Headers();
  const origin = options?.origin === undefined ? 'https://app.example.com' : options.origin;

  if (origin !== null) {
    headers.set('origin', origin);
  }

  return {
    url: requestUrl,
    headers
  } as unknown as Request;
}

describe('/api/shipment-jobs/[id]', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requireAuthContext.mockResolvedValue({ vendorId: 10, role: 'vendor' });
    isAdmin.mockReturnValue(false);
    processShipmentImportJobById.mockResolvedValue(undefined);
  });

  it('GET returns current summary without advancing non-terminal jobs', async () => {
    getShipmentImportJobSummary.mockResolvedValueOnce(createSummary('pending'));

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ id: '12' })
    });

    expect(response.status).toBe(200);
    expect(processShipmentImportJobById).not.toHaveBeenCalled();
    expect(getShipmentImportJobSummary).toHaveBeenCalledTimes(1);

    const body = await response.json();
    expect(body.job.status).toBe('pending');
  });

  it('POST returns 403 when same-origin validation fails', async () => {
    const response = await POST(buildRequest({ origin: null }), {
      params: Promise.resolve({ id: '12' })
    });

    expect(response.status).toBe(403);
    expect(requireAuthContext).not.toHaveBeenCalled();
    expect(processShipmentImportJobById).not.toHaveBeenCalled();
  });

  it('POST advances non-terminal job state before returning summary', async () => {
    getShipmentImportJobSummary
      .mockResolvedValueOnce(createSummary('pending'))
      .mockResolvedValueOnce(createSummary('running'));

    const response = await POST(buildRequest(), {
      params: Promise.resolve({ id: '12' })
    });

    expect(response.status).toBe(200);
    expect(processShipmentImportJobById).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ orderLimit: 1, itemLimit: expect.any(Number) })
    );

    const body = await response.json();
    expect(body.job.status).toBe('running');
  });

  it('POST does not attempt processing for terminal jobs', async () => {
    getShipmentImportJobSummary.mockResolvedValueOnce(createSummary('succeeded'));

    const response = await POST(buildRequest(), {
      params: Promise.resolve({ id: '12' })
    });

    expect(response.status).toBe(200);
    expect(processShipmentImportJobById).not.toHaveBeenCalled();
    expect(getShipmentImportJobSummary).toHaveBeenCalledTimes(1);
  });
});

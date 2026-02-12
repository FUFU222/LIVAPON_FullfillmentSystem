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

import { GET } from '@/app/api/shipment-jobs/[id]/route';

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

describe('GET /api/shipment-jobs/[id]', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requireAuthContext.mockResolvedValue({ vendorId: 10, role: 'vendor' });
    isAdmin.mockReturnValue(false);
    processShipmentImportJobById.mockResolvedValue(undefined);
  });

  it('advances non-terminal job state before returning summary', async () => {
    getShipmentImportJobSummary
      .mockResolvedValueOnce(createSummary('pending'))
      .mockResolvedValueOnce(createSummary('running'));

    const response = await GET({} as Request, {
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

  it('does not attempt processing for terminal jobs', async () => {
    getShipmentImportJobSummary.mockResolvedValueOnce(createSummary('succeeded'));

    const response = await GET({} as Request, {
      params: Promise.resolve({ id: '12' })
    });

    expect(response.status).toBe(200);
    expect(processShipmentImportJobById).not.toHaveBeenCalled();
    expect(getShipmentImportJobSummary).toHaveBeenCalledTimes(1);
  });
});

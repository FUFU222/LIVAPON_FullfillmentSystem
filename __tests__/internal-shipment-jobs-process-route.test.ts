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

function buildRequest(url: string, token?: string) {
  const headers = new Headers();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return { url, headers } as unknown as Request;
}

describe('/api/internal/shipment-jobs/process', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
    delete process.env.JOB_WORKER_SECRET;
    delete process.env.SHIPMENT_JOB_LIMIT;
    delete process.env.SHIPMENT_JOB_ITEM_LIMIT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts limit alias and forwards clamped limits to runner', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const processShipmentImportJobs = jest.fn().mockResolvedValue({
      claimed: 1,
      succeeded: 1,
      failed: 0,
      requeued: 0,
      jobs: []
    });

    jest.doMock('@/lib/jobs/shipment-import-runner', () => ({
      processShipmentImportJobs
    }));

    const { POST } = await import('@/app/api/internal/shipment-jobs/process/route');
    const response = await POST(
      buildRequest(
        'https://app.example.com/api/internal/shipment-jobs/process?limit=9&items=200',
        'test-secret'
      )
    );

    expect(response.status).toBe(200);
    expect(processShipmentImportJobs).toHaveBeenCalledWith({ jobLimit: 5, itemLimit: 100 });
  });

  it('returns 401 when authorization token is missing or invalid', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const processShipmentImportJobs = jest.fn();

    jest.doMock('@/lib/jobs/shipment-import-runner', () => ({
      processShipmentImportJobs
    }));

    const { POST } = await import('@/app/api/internal/shipment-jobs/process/route');
    const response = await POST(buildRequest('https://app.example.com/api/internal/shipment-jobs/process'));

    expect(response.status).toBe(401);
    expect(processShipmentImportJobs).not.toHaveBeenCalled();
  });
});

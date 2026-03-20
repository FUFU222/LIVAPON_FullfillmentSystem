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

describe('/api/internal/shipments/resync', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts authorized requests and forwards a numeric limit', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const resyncPendingShipments = jest.fn().mockResolvedValue({
      total: 3,
      succeeded: 3,
      failed: 0,
      errors: []
    });

    jest.doMock('@/lib/data/orders', () => ({
      resyncPendingShipments
    }));

    const { POST } = await import('@/app/api/internal/shipments/resync/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/shipments/resync?limit=12', 'cron-secret')
    );

    expect(response.status).toBe(200);
    expect(resyncPendingShipments).toHaveBeenCalledWith({ limit: 12 });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      summary: {
        total: 3,
        succeeded: 3,
        failed: 0,
        errors: []
      }
    });
  });

  it('returns 401 when the token is missing or invalid', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const resyncPendingShipments = jest.fn();

    jest.doMock('@/lib/data/orders', () => ({
      resyncPendingShipments
    }));

    const { GET } = await import('@/app/api/internal/shipments/resync/route');
    const response = await GET(
      buildRequest('https://app.example.com/api/internal/shipments/resync', 'wrong-secret')
    );

    expect(response.status).toBe(401);
    expect(resyncPendingShipments).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('allows requests without a secret outside production', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resyncPendingShipments = jest.fn().mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      errors: []
    });

    jest.doMock('@/lib/data/orders', () => ({
      resyncPendingShipments
    }));

    const { GET } = await import('@/app/api/internal/shipments/resync/route');
    const response = await GET(
      buildRequest('https://app.example.com/api/internal/shipments/resync?limit=not-a-number')
    );

    expect(response.status).toBe(200);
    expect(resyncPendingShipments).toHaveBeenCalledWith({ limit: undefined });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'CRON_SECRET is not configured; allowing request in non-production environment.'
    );

    consoleWarnSpy.mockRestore();
  });

  it('rejects requests without a secret in production', async () => {
    process.env.NODE_ENV = 'production';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const resyncPendingShipments = jest.fn();

    jest.doMock('@/lib/data/orders', () => ({
      resyncPendingShipments
    }));

    const { GET } = await import('@/app/api/internal/shipments/resync/route');
    const response = await GET(buildRequest('https://app.example.com/api/internal/shipments/resync'));

    expect(response.status).toBe(401);
    expect(resyncPendingShipments).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'CRON_SECRET is not configured; refusing request.'
    );

    consoleErrorSpy.mockRestore();
  });

  it('returns 500 when resync throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.CRON_SECRET = 'cron-secret';
    const resyncPendingShipments = jest.fn().mockRejectedValue(new Error('resync failed'));

    jest.doMock('@/lib/data/orders', () => ({
      resyncPendingShipments
    }));

    const { POST } = await import('@/app/api/internal/shipments/resync/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/shipments/resync', 'cron-secret')
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to resync pending shipments',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

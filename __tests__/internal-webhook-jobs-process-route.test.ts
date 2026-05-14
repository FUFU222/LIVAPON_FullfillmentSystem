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

describe('/api/internal/webhook-jobs/process', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.JOB_WORKER_SECRET;
    delete process.env.ALLOW_INSECURE_INTERNAL_ROUTES;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts authorized requests and forwards a numeric limit', async () => {
    process.env.JOB_WORKER_SECRET = 'worker-secret';
    const processWebhookJobs = jest.fn().mockResolvedValue({
      claimed: 2,
      succeeded: 2,
      failed: 0
    });

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { POST } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/webhook-jobs/process?limit=9', 'worker-secret')
    );

    expect(response.status).toBe(200);
    expect(processWebhookJobs).toHaveBeenCalledWith({ limit: 9 });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      summary: { claimed: 2, succeeded: 2, failed: 0 }
    });
  });

  it('returns 401 when the authorization token is missing or invalid', async () => {
    process.env.JOB_WORKER_SECRET = 'worker-secret';
    const processWebhookJobs = jest.fn();

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { POST } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/webhook-jobs/process', 'wrong-secret')
    );

    expect(response.status).toBe(401);
    expect(processWebhookJobs).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('rejects requests without a configured secret by default outside production', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const processWebhookJobs = jest.fn();

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { POST } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/webhook-jobs/process?limit=abc')
    );

    expect(response.status).toBe(401);
    expect(processWebhookJobs).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[webhook-jobs] JOB_WORKER_SECRET is not configured; refusing request.'
    );

    consoleErrorSpy.mockRestore();
  });

  it('allows requests without a secret only when the explicit local bypass is enabled', async () => {
    process.env.ALLOW_INSECURE_INTERNAL_ROUTES = 'true';
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const processWebhookJobs = jest.fn().mockResolvedValue({
      claimed: 1,
      succeeded: 1,
      failed: 0
    });

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { POST } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/webhook-jobs/process?limit=abc')
    );

    expect(response.status).toBe(200);
    expect(processWebhookJobs).toHaveBeenCalledWith({ limit: undefined });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[webhook-jobs] JOB_WORKER_SECRET not set; allowing request because ALLOW_INSECURE_INTERNAL_ROUTES=true outside production.'
    );

    consoleWarnSpy.mockRestore();
  });

  it('rejects requests without a secret in production', async () => {
    process.env.NODE_ENV = 'production';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const processWebhookJobs = jest.fn();

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { POST } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await POST(buildRequest('https://app.example.com/api/internal/webhook-jobs/process'));

    expect(response.status).toBe(401);
    expect(processWebhookJobs).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[webhook-jobs] JOB_WORKER_SECRET is not configured; refusing request.'
    );

    consoleErrorSpy.mockRestore();
  });

  it('returns 405 for GET requests', async () => {
    process.env.JOB_WORKER_SECRET = 'worker-secret';
    const processWebhookJobs = jest.fn();

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { GET } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await GET();

    expect(response.status).toBe(405);
    expect(processWebhookJobs).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: 'Method Not Allowed' });
  });

  it('returns 500 when processing throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.JOB_WORKER_SECRET = 'worker-secret';
    const processWebhookJobs = jest.fn().mockRejectedValue(new Error('runner failed'));

    jest.doMock('@/lib/jobs/webhook-runner', () => ({
      processWebhookJobs
    }));

    const { POST } = await import('@/app/api/internal/webhook-jobs/process/route');
    const response = await POST(
      buildRequest('https://app.example.com/api/internal/webhook-jobs/process', 'worker-secret')
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to process webhook jobs',
      expect.objectContaining({ error: expect.any(Error) })
    );

    consoleErrorSpy.mockRestore();
  });
});

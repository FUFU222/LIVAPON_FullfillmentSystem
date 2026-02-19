jest.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Headers;

    constructor(body?: unknown, init?: ResponseInit) {
      this.body = body ?? null;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }
  }

  return { NextResponse: MockNextResponse };
});

import { middleware } from '@/middleware';

function buildRequest(pathname: string) {
  return {
    nextUrl: { pathname }
  } as unknown as import('next/server').NextRequest;
}

describe('middleware security headers', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('adds CSP header for normal requests', () => {
    const response = middleware(buildRequest('/orders'));

    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('returns 404 on /dev paths in production and keeps security headers', () => {
    process.env.NODE_ENV = 'production';

    const response = middleware(buildRequest('/dev/tools'));

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });
});

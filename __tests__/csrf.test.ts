import { isSameOriginRequest } from '@/lib/security/csrf';

function buildRequest(url: string, headers?: Record<string, string>) {
  return {
    url,
    headers: new Headers(headers)
  } as Request;
}

describe('isSameOriginRequest', () => {
  it('accepts requests with a matching origin header', () => {
    const request = buildRequest('https://app.example.com/orders', {
      origin: 'https://app.example.com'
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it('falls back to referer origin when origin is absent', () => {
    const request = buildRequest('https://app.example.com/orders', {
      referer: 'https://app.example.com/admin/vendors'
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it('rejects mismatched origin or referer origins', () => {
    const byOrigin = buildRequest('https://app.example.com/orders', {
      origin: 'https://evil.example.com'
    });
    const byReferer = buildRequest('https://app.example.com/orders', {
      referer: 'https://evil.example.com/phish'
    });

    expect(isSameOriginRequest(byOrigin)).toBe(false);
    expect(isSameOriginRequest(byReferer)).toBe(false);
  });

  it('rejects malformed request urls or referers', () => {
    const malformedUrl = buildRequest('not-a-url', {
      origin: 'https://app.example.com'
    });
    const malformedReferer = buildRequest('https://app.example.com/orders', {
      referer: 'not-a-url'
    });

    expect(isSameOriginRequest(malformedUrl)).toBe(false);
    expect(isSameOriginRequest(malformedReferer)).toBe(false);
  });
});

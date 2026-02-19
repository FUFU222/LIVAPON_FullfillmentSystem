import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "connect-src 'self' https: http: wss: ws:"
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY
};

export function middleware(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && _request.nextUrl.pathname.startsWith('/dev')) {
    const response = new NextResponse('Not Found', { status: 404 });
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};

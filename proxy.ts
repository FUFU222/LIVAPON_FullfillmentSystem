import type { NextProxy, ProxyConfig } from 'next/server';
import { NextResponse } from 'next/server';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const proxy: NextProxy = async () => {
  const response = NextResponse.next();
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
};

export const config: ProxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};

export default proxy;

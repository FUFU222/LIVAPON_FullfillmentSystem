import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/api/shopify/orders/ingest']
};

export function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/shopify/orders/ingest') {
    console.log('Middleware intercepted Shopify webhook', {
      method: (request as any).method,
      headers: Object.fromEntries((request as any).headers)
    });
  }
  return NextResponse.next();
}

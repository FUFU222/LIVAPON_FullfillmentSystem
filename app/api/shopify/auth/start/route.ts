import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { buildShopifyAuthUrl } from '@/lib/shopify/oauth';

export const runtime = 'nodejs';

const STATE_COOKIE = 'shopify_oauth_state';

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString('hex');
  const origin = request.nextUrl.origin;
  const authUrl = buildShopifyAuthUrl(origin, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300
  });

  return response;
}

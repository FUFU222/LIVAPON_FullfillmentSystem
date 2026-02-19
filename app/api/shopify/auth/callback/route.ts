import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, isAdmin } from '@/lib/auth';
import {
  assertPinnedShopDomain,
  exchangeAccessToken,
  storeShopifyConnection,
  verifyCallbackHmac
} from '@/lib/shopify/oauth';

export const runtime = 'nodejs';
const STATE_COOKIE = 'shopify_oauth_state';

function redirectWithError(origin: string, message: string) {
  const url = new URL('/admin?shopify_error=' + encodeURIComponent(message), origin);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { nextUrl, cookies } = request;
  const searchParams = nextUrl.searchParams;
  const auth = await getAuthContext();

  if (!isAdmin(auth)) {
    return redirectWithError(nextUrl.origin, 'Administrator privileges required');
  }

  const stateParam = searchParams.get('state');
  const stateCookie = cookies.get(STATE_COOKIE)?.value;

  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return redirectWithError(nextUrl.origin, 'State validation failed');
  }

  const shop = searchParams.get('shop');
  const code = searchParams.get('code');

  if (!shop || !code) {
    return redirectWithError(nextUrl.origin, 'Missing shop or code');
  }

  let pinnedShop: string;
  try {
    pinnedShop = assertPinnedShopDomain(shop);
  } catch {
    return redirectWithError(nextUrl.origin, 'Unexpected shop domain');
  }

  const hmacValid = await verifyCallbackHmac(searchParams);
  if (!hmacValid) {
    return redirectWithError(nextUrl.origin, 'Invalid callback signature');
  }

  try {
    const token = await exchangeAccessToken(pinnedShop, code);
    await storeShopifyConnection(pinnedShop, token);
  } catch (error) {
    console.error('Failed to complete Shopify OAuth', error);
    return redirectWithError(nextUrl.origin, 'Token exchange failed');
  }

  const response = NextResponse.redirect(new URL('/admin', nextUrl.origin));
  response.cookies.delete(STATE_COOKIE);
  return response;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY ?? '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? '';
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES ?? 'read_orders,write_orders,read_products,read_customers';
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? '';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient: SupabaseClient<Database> | null = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: { persistSession: false }
    })
  : null;

function assertEnv(value: string, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function assertServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }
  return serviceClient;
}

export function buildShopifyAuthUrl(origin: string, state: string): URL {
  const shop = assertEnv(SHOPIFY_STORE_DOMAIN, 'SHOPIFY_STORE_DOMAIN');
  const apiKey = assertEnv(SHOPIFY_API_KEY, 'SHOPIFY_API_KEY');
  const scopes = SHOPIFY_SCOPES;
  const redirect = new URL('/api/shopify/auth/callback', origin);

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', apiKey);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', redirect.toString());
  authUrl.searchParams.set('state', state);

  return authUrl;
}

export async function exchangeAccessToken(shop: string, code: string) {
  const apiKey = assertEnv(SHOPIFY_API_KEY, 'SHOPIFY_API_KEY');
  const apiSecret = assertEnv(SHOPIFY_API_SECRET, 'SHOPIFY_API_SECRET');

  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-store',
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange access token: ${response.status} ${text}`);
  }

  return response.json() as Promise<{ access_token: string; scope: string }>;
}

export async function storeShopifyConnection(
  shop: string,
  token: { access_token: string; scope: string }
) {
  const client = assertServiceClient();
  const normalizedShop = shop.trim().toLowerCase();

  const payload: Database['public']['Tables']['shopify_connections']['Insert'] = {
    shop: normalizedShop,
    access_token: token.access_token,
    scopes: token.scope,
    updated_at: new Date().toISOString()
  };

  const { error } = await client
    .from('shopify_connections')
    .upsert(payload, { onConflict: 'shop' });

  if (error) {
    throw error;
  }
}

export async function verifyCallbackHmac(params: URLSearchParams): Promise<boolean> {
  const apiSecret = assertEnv(SHOPIFY_API_SECRET, 'SHOPIFY_API_SECRET');
  const hmac = params.get('hmac');
  if (!hmac) {
    return false;
  }

  const sorted = Array.from(params.entries())
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const encoder = new TextEncoder();
  const secretKey = encoder.encode(apiSecret);
  const message = encoder.encode(sorted);

  try {
    const key = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, message);
    const digest = arrayBufferToHex(signature);
    return timingSafeEqualString(digest, hmac);
  } catch (error) {
    console.error('Failed to verify Shopify callback signature', error);
    return false;
  }
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  bytes.forEach((byte) => {
    hex.push(byte.toString(16).padStart(2, '0'));
  });
  return hex.join('');
}

function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

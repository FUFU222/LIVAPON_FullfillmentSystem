import crypto from 'crypto';

const SHOPIFY_HMAC_HEADER = 'x-shopify-hmac-sha256';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? '';

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function verifyShopifyWebhook(body: Buffer, headers: Headers): boolean {
  if (!SHOPIFY_API_SECRET) {
    console.warn('SHOPIFY_API_SECRET is not set');
    return false;
  }

  const hmacHeader = headers.get(SHOPIFY_HMAC_HEADER);

  if (!hmacHeader) {
    return false;
  }

  const digest = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64');

  try {
    return timingSafeEqual(Buffer.from(digest, 'utf-8'), Buffer.from(hmacHeader, 'utf-8'));
  } catch (error) {
    console.error('Failed to verify Shopify webhook signature', error);
    return false;
  }
}

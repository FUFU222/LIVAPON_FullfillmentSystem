const SHOPIFY_HMAC_HEADER = 'x-shopify-hmac-sha256';
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';
const SHOPIFY_WEBHOOK_TEST_MODE = process.env.SHOPIFY_WEBHOOK_TEST_MODE === 'true';

const textEncoder = new TextEncoder();

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

export async function verifyShopifyWebhook(body: ArrayBuffer, headers: Headers): Promise<boolean> {
  if (!SHOPIFY_WEBHOOK_SECRET) {
    if (SHOPIFY_WEBHOOK_TEST_MODE && process.env.NODE_ENV !== 'production') {
      console.warn('SHOPIFY_WEBHOOK_SECRET is not set; allowing webhook due to test mode');
      return true;
    }

    console.warn('SHOPIFY_WEBHOOK_SECRET is not set');
    return false;
  }

  const hmacHeader = headers.get(SHOPIFY_HMAC_HEADER);

  if (!hmacHeader) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(SHOPIFY_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, body);
    const digest = arrayBufferToBase64(signature);

    return timingSafeEqualString(digest, hmacHeader);
  } catch (error) {
    console.error('Failed to verify Shopify webhook signature', error);
    return false;
  }
}

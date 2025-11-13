const SHOPIFY_HMAC_HEADER = 'x-shopify-hmac-sha256';
const SHOPIFY_WEBHOOK_TEST_MODE = process.env.SHOPIFY_WEBHOOK_TEST_MODE === 'true';

const PRIMARY_SECRET_KEYS = [
  'SHOPIFY_WEBHOOK_SECRET',
  'SHOPIFY_WEBHOOK_SECRET_APP',
  'SHOPIFY_WEBHOOK_SECRET_STORE'
];

const FALLBACK_SECRET_KEYS = ['SHOPIFY_API_SECRET'];

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
  const secrets = getWebhookSecrets();

  if (secrets.length === 0) {
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

  const attempted: Array<{ fingerprint: string | null; length: number; source: string }> = [];

  for (const secret of secrets) {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret.value),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', key, body);
      const digest = arrayBufferToBase64(signature);

      if (timingSafeEqualString(digest, hmacHeader)) {
        return true;
      }

      attempted.push({
        fingerprint: await createSecretFingerprint(secret.value),
        length: secret.value.length,
        source: secret.source
      });
    } catch (error) {
      console.error('Failed to verify Shopify webhook signature', error);
      return false;
    }
  }

  console.warn('HMAC mismatch for all configured webhook secrets', {
    header: hmacHeader,
    attempted
  });

  return false;
}

type SecretEntry = {
  value: string;
  source: string;
};

function getWebhookSecrets(): SecretEntry[] {
  const values: SecretEntry[] = [];

  for (const key of [...PRIMARY_SECRET_KEYS, ...FALLBACK_SECRET_KEYS]) {
    const raw = process.env[key];
    if (!raw) {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    if (values.some((entry) => entry.value === trimmed)) {
      continue;
    }
    values.push({ value: trimmed, source: key });
  }

  return values;
}

export async function getWebhookSecretMetadata() {
  const secrets = getWebhookSecrets();
  if (secrets.length === 0) {
    return [];
  }

  return Promise.all(
    secrets.map(async (secret) => ({
      source: secret.source,
      length: secret.value.length,
      fingerprint: await createSecretFingerprint(secret.value)
    }))
  );
}

export async function createSecretFingerprint(secret: string) {
  if (!secret) {
    return null;
  }
  const data = textEncoder.encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes
    .slice(0, 4)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

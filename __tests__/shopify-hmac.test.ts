import { TextEncoder } from 'util';
import { createHash, createHmac } from 'crypto';

const SHOPIFY_HEADER = 'x-shopify-hmac-sha256';

const globalObject = globalThis as Record<string, unknown>;

if (typeof globalObject.TextEncoder === 'undefined') {
  globalObject.TextEncoder = TextEncoder;
}

let importedSecret = Buffer.alloc(0);

const subtleMock = {
  importKey: jest.fn(async (_format: string, keyData: ArrayBuffer) => {
    importedSecret = Buffer.from(keyData);
    return Symbol('hmac-key');
  }),
  sign: jest.fn(async (_algorithm: string, _key: symbol, data: ArrayBuffer) => {
    const digest = createHmac('sha256', importedSecret).update(Buffer.from(data)).digest();
    return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
  }),
  digest: jest.fn(async (_algorithm: string, data: ArrayBuffer) => {
    const digest = createHash('sha256').update(Buffer.from(data)).digest();
    return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
  })
};

globalObject.crypto = { subtle: subtleMock } as unknown as Crypto;

function encodePayload(payload: unknown): ArrayBuffer {
  const buffer = Buffer.from(JSON.stringify(payload), 'utf8');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('verifyShopifyWebhook', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    globalObject.TextEncoder = TextEncoder;
    const existingCrypto = globalObject.crypto as Crypto | undefined;
    if (existingCrypto) {
      (existingCrypto as unknown as Record<string, unknown>).subtle = subtleMock as unknown;
    } else {
      globalObject.crypto = { subtle: subtleMock } as unknown as Crypto;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    importedSecret = Buffer.alloc(0);
    subtleMock.importKey.mockClear();
    subtleMock.sign.mockClear();
    subtleMock.digest.mockClear();
  });

  it('returns true when signature matches using primary secret', async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET_APP = 'secret-key';

    const bodyBuffer = encodePayload({ foo: 'bar' });
    const signature = createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET_APP as string)
      .update(Buffer.from(bodyBuffer))
      .digest('base64');

    const { verifyShopifyWebhook } = await import('@/lib/shopify/hmac');

    const headers = new Headers([[SHOPIFY_HEADER, signature]]);
    await expect(verifyShopifyWebhook(bodyBuffer, headers)).resolves.toBe(true);
  });

  it('returns true when fallback secret matches', async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = 'not-used';
    process.env.SHOPIFY_API_SECRET = 'fallback-secret';

    const bodyBuffer = encodePayload({ foo: 'bar' });
    const signature = createHmac('sha256', process.env.SHOPIFY_API_SECRET as string)
      .update(Buffer.from(bodyBuffer))
      .digest('base64');

    const { verifyShopifyWebhook } = await import('@/lib/shopify/hmac');

    const headers = new Headers([[SHOPIFY_HEADER, signature]]);
    await expect(verifyShopifyWebhook(bodyBuffer, headers)).resolves.toBe(true);
  });

  it('returns false when signature header is missing', async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET_STORE = 'secret-key';

    const bodyBuffer = encodePayload({ foo: 'bar' });
    const { verifyShopifyWebhook } = await import('@/lib/shopify/hmac');
    const headers = new Headers();

    await expect(verifyShopifyWebhook(bodyBuffer, headers)).resolves.toBe(false);
  });

  it('allows requests when test mode is enabled and secret is absent', async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    delete process.env.SHOPIFY_WEBHOOK_SECRET_APP;
    delete process.env.SHOPIFY_WEBHOOK_SECRET_STORE;
    delete process.env.SHOPIFY_API_SECRET;
    process.env.SHOPIFY_WEBHOOK_TEST_MODE = 'true';

    const bodyBuffer = encodePayload({ foo: 'bar' });
    const { verifyShopifyWebhook } = await import('@/lib/shopify/hmac');
    const headers = new Headers();

    await expect(verifyShopifyWebhook(bodyBuffer, headers)).resolves.toBe(true);
  });
});

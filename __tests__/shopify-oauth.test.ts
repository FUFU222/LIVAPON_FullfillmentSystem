describe('shopify oauth domain pinning', () => {
  const previousStoreDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const previousApiKey = process.env.SHOPIFY_API_KEY;
  const previousApiSecret = process.env.SHOPIFY_API_SECRET;
  const previousFetch = (globalThis as { fetch?: unknown }).fetch;

  let oauthModule: typeof import('@/lib/shopify/oauth');

  beforeAll(async () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'Allowed-Shop.myshopify.com';
    process.env.SHOPIFY_API_KEY = 'test-api-key';
    process.env.SHOPIFY_API_SECRET = 'test-api-secret';

    jest.resetModules();
    oauthModule = await import('@/lib/shopify/oauth');
  });

  afterAll(() => {
    if (typeof previousStoreDomain === 'undefined') {
      delete process.env.SHOPIFY_STORE_DOMAIN;
    } else {
      process.env.SHOPIFY_STORE_DOMAIN = previousStoreDomain;
    }

    if (typeof previousApiKey === 'undefined') {
      delete process.env.SHOPIFY_API_KEY;
    } else {
      process.env.SHOPIFY_API_KEY = previousApiKey;
    }

    if (typeof previousApiSecret === 'undefined') {
      delete process.env.SHOPIFY_API_SECRET;
    } else {
      process.env.SHOPIFY_API_SECRET = previousApiSecret;
    }

    if (typeof previousFetch === 'undefined') {
      delete (globalThis as { fetch?: unknown }).fetch;
    } else {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }

    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts and normalizes the pinned shop domain', () => {
    const result = oauthModule.assertPinnedShopDomain('https://ALLOWED-shop.myshopify.com');
    expect(result).toBe('allowed-shop.myshopify.com');
  });

  it('rejects a non-pinned shop domain', () => {
    expect(() => oauthModule.assertPinnedShopDomain('other-shop.myshopify.com')).toThrow(
      'Unexpected shop domain'
    );
  });

  it('builds auth URL using the pinned shop domain', () => {
    const url = oauthModule.buildShopifyAuthUrl('https://app.example.com', 'state-123');

    expect(url.toString().startsWith('https://allowed-shop.myshopify.com/admin/oauth/authorize?')).toBe(true);
    expect(url.searchParams.get('client_id')).toBe('test-api-key');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/api/shopify/auth/callback'
    );
  });

  it('blocks token exchange when callback shop does not match the pinned domain', async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    await expect(
      oauthModule.exchangeAccessToken('other-shop.myshopify.com', 'oauth-code')
    ).rejects.toThrow('Unexpected shop domain');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges token against the pinned shop domain', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-1', scope: 'read_orders,write_orders' }),
      text: async () => ''
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const token = await oauthModule.exchangeAccessToken(
      'Allowed-Shop.myshopify.com',
      'oauth-code'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://allowed-shop.myshopify.com/admin/oauth/access_token'
    );
    expect(token.access_token).toBe('token-1');
  });
});

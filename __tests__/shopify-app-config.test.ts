/** @jest-environment node */

describe('shopify app config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  it('normalizes and deduplicates scope strings', async () => {
    const configModule = await import('@/lib/shopify/app-config');

    expect(
      configModule.normalizeShopifyScopes(
        ' write_orders,read_orders,write_orders, read_merchant_managed_fulfillment_orders '
      )
    ).toEqual([
      'read_merchant_managed_fulfillment_orders',
      'read_orders',
      'write_orders'
    ]);
  });

  it('reports missing runtime-required scopes from granted scopes', async () => {
    process.env.SHOPIFY_SCOPES =
      'read_merchant_managed_fulfillment_orders,read_orders,write_merchant_managed_fulfillment_orders,write_orders';

    const configModule = await import('@/lib/shopify/app-config');
    const audit = configModule.auditShopifyScopes(
      'read_merchant_managed_fulfillment_orders,read_orders'
    );

    expect(audit.missingRequired).toEqual([
      'write_merchant_managed_fulfillment_orders',
      'write_orders'
    ]);
    expect(audit.grantedSupportsRuntime).toBe(false);
  });

  it('rejects OAuth requests when configured scopes are missing runtime-required permissions', async () => {
    process.env.SHOPIFY_SCOPES = 'read_orders';

    const configModule = await import('@/lib/shopify/app-config');

    expect(() => configModule.assertRequestedShopifyScopesCoverRuntimeNeeds()).toThrow(
      'SHOPIFY_SCOPES is missing runtime-required scopes'
    );
  });
});

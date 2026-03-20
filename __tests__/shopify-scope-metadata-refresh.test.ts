/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

function createShopifyConnectionsClient(options?: {
  storedScopes?: string | null;
  updateError?: { message: string } | null;
}) {
  const storedScopes = options?.storedScopes ?? null;
  const updateCalls: Array<{ payload: Record<string, unknown>; eqArgs: [string, string][] }> = [];

  const selectMaybeSingle = jest.fn().mockResolvedValue({
    data: {
      access_token: 'test-access-token',
      scopes: storedScopes
    },
    error: null
  });
  const selectEq = jest.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
  const select = jest.fn().mockReturnValue({ eq: selectEq });

  const update = jest.fn((payload: Record<string, unknown>) => {
    const eqArgs: [string, string][] = [];
    updateCalls.push({ payload, eqArgs });
    return {
      eq: jest.fn(async (column: string, value: string) => {
        eqArgs.push([column, value]);
        return { data: null, error: options?.updateError ?? null };
      })
    };
  });

  const client = {
    from(table: keyof Database['public']['Tables']) {
      if (table !== 'shopify_connections') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select,
        update
      } as any;
    }
  } as unknown as SupabaseClient<Database>;

  return {
    client,
    updateCalls,
    spies: {
      select,
      selectEq,
      selectMaybeSingle,
      update
    }
  };
}

describe('loadShopifyAccessToken scope metadata refresh', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SHOPIFY_ADMIN_API_VERSION: '2025-10',
      SHOPIFY_SCOPES:
        'read_merchant_managed_fulfillment_orders,read_orders,write_merchant_managed_fulfillment_orders,write_orders'
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    Reflect.deleteProperty(global, 'fetch');
  });

  it('refreshes stale stored scope metadata from currentAppInstallation and persists it', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { client, updateCalls } = createShopifyConnectionsClient({
      storedScopes: 'read_orders,write_orders'
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          currentAppInstallation: {
            accessScopes: [
              { handle: 'write_orders' },
              { handle: 'read_orders' },
              { handle: 'write_merchant_managed_fulfillment_orders' },
              { handle: 'read_merchant_managed_fulfillment_orders' }
            ]
          }
        }
      }),
      text: async () => ''
    }) as any;

    const { loadShopifyAccessToken } = await import('@/lib/shopify/fulfillment');
    const token = await loadShopifyAccessToken(client, 'example.myshopify.com');

    expect(token).toBe('test-access-token');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.payload).toMatchObject({
      scopes:
        'read_merchant_managed_fulfillment_orders,read_orders,write_merchant_managed_fulfillment_orders,write_orders'
    });
    expect(updateCalls[0]?.eqArgs).toEqual([['shop', 'example.myshopify.com']]);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('uses a short-lived in-process cache to avoid repeated scope refresh calls', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const { client, updateCalls } = createShopifyConnectionsClient({
      storedScopes: 'read_orders,write_orders'
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          currentAppInstallation: {
            accessScopes: [
              { handle: 'read_orders' },
              { handle: 'write_orders' },
              { handle: 'read_merchant_managed_fulfillment_orders' },
              { handle: 'write_merchant_managed_fulfillment_orders' }
            ]
          }
        }
      }),
      text: async () => ''
    }) as any;

    const { loadShopifyAccessToken } = await import('@/lib/shopify/fulfillment');

    await loadShopifyAccessToken(client, 'example.myshopify.com');
    await loadShopifyAccessToken(client, 'example.myshopify.com');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(updateCalls).toHaveLength(1);
  });

  it('falls back to stored scope metadata when Shopify scope refresh fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const { client, updateCalls } = createShopifyConnectionsClient({
      storedScopes:
        'read_merchant_managed_fulfillment_orders,read_orders,write_merchant_managed_fulfillment_orders,write_orders'
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'boom'
    }) as any;

    const { loadShopifyAccessToken } = await import('@/lib/shopify/fulfillment');
    const token = await loadShopifyAccessToken(client, 'example.myshopify.com');

    expect(token).toBe('test-access-token');
    expect(updateCalls).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to fetch current Shopify granted scopes; using stored metadata',
      expect.objectContaining({
        shop: 'example.myshopify.com',
        error: expect.any(Error)
      })
    );
  });
});

/** @jest-environment node */

jest.mock('@/lib/shopify/fulfillment', () => {
  const actual = jest.requireActual('@/lib/shopify/fulfillment');
  return {
    ...actual,
    loadShopifyAccessToken: jest.fn(),
    fetchFulfillmentOrderSnapshots: jest.fn(),
    applyFulfillmentOrderSnapshot: jest.fn(actual.applyFulfillmentOrderSnapshot)
  };
});

import { cancelShopifyFulfillment, syncShipmentWithShopify } from '@/lib/shopify/fulfillment';
const fulfillmentModule = jest.requireMock<typeof import('@/lib/shopify/fulfillment')>(
  '@/lib/shopify/fulfillment'
);
const actualFulfillmentModule = jest.requireActual('@/lib/shopify/fulfillment');
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

jest.mock('@/lib/shopify/service-client', () => ({
  getShopifyServiceClient: jest.fn()
}));

const { getShopifyServiceClient } = jest.requireMock<{
  getShopifyServiceClient: jest.Mock
}>('@/lib/shopify/service-client');

function createShipmentRecord() {
  return {
    id: 1,
    tracking_number: 'YT123456789JP',
    tracking_company: null,
    tracking_url: null,
    carrier: 'yamato',
    status: 'in_transit',
    shopify_fulfillment_id: null,
    order_id: 10,
    order: {
      id: 10,
      shopify_order_id: 1234567890,
      shop_domain: 'example.myshopify.com',
      shopify_fulfillment_order_id: null
    },
    line_items: [
      {
        line_item_id: 100,
        quantity: null,
        fulfillment_order_line_item_id: null,
        line_item: {
          id: 200,
          shopify_line_item_id: 555,
          fulfillable_quantity: 2,
          fulfillment_order_line_item_id: null,
          quantity: 2
        }
      }
    ]
  } as const;
}

function createSupabaseMock() {
  const shipmentRecord = createShipmentRecord();

  const shipmentsSelectMaybeSingle = jest.fn().mockResolvedValue({ data: shipmentRecord, error: null });
  const shipmentsSelectEq = jest.fn().mockReturnValue({ maybeSingle: shipmentsSelectMaybeSingle });
  const shipmentsSelect = jest.fn().mockReturnValue({ eq: shipmentsSelectEq });

  const shipmentUpdates: Array<{ payload: any; eqArgs: [string, number][] }> = [];
  const shipmentsUpdate = jest.fn((payload: unknown) => {
    const eqCalls: [string, number][] = [];
    shipmentUpdates.push({ payload, eqArgs: eqCalls });
    return {
      eq: jest.fn(async (column: string, value: number) => {
        eqCalls.push([column, value]);
        return { data: null, error: null };
      })
    };
  });

  const shopifyConnectionsSelectMaybeSingle = jest
    .fn()
    .mockResolvedValue({ data: { access_token: 'test-access-token' }, error: null });
  const shopifyConnectionsSelectEq = jest
    .fn()
    .mockReturnValue({ maybeSingle: shopifyConnectionsSelectMaybeSingle });
  const shopifyConnectionsSelect = jest.fn().mockReturnValue({ eq: shopifyConnectionsSelectEq });

  const orderUpdates: any[] = [];
  const ordersUpdate = jest.fn((payload: unknown) => {
    orderUpdates.push(payload);
    return {
      eq: jest.fn(async () => ({ data: null, error: null }))
    };
  });

  const ordersSelectResult = {
    id: shipmentRecord.order.id,
    shop_domain: shipmentRecord.order.shop_domain
  };

  const ordersSelectState: Array<[string, unknown]> = [];

  const ordersSelectBuilder: any = {};
  ordersSelectBuilder.eq = jest.fn((column: string, value: unknown) => {
    ordersSelectState.push([column, value]);
    return ordersSelectBuilder;
  });
  ordersSelectBuilder.limit = jest.fn(() => ordersSelectBuilder);
  ordersSelectBuilder.order = jest.fn(() => ordersSelectBuilder);
  ordersSelectBuilder.gt = jest.fn(() => ordersSelectBuilder);
  ordersSelectBuilder.maybeSingle = jest.fn(async () => ({
    data: ordersSelectResult,
    error: null
  }));

  const ordersSelect = jest.fn(() => ordersSelectBuilder);

  const ordersTable = {
    update: ordersUpdate,
    select: ordersSelect
  } as any;

  const lineItemUpdates: Array<{ payload: any; eqArgs: [string, number][] }> = [];
  const lineItemsUpdate = jest.fn((payload: unknown) => {
    const eqCalls: [string, number][] = [];
    lineItemUpdates.push({ payload, eqArgs: eqCalls });

    const builder: any = {};
    builder.eq = jest.fn((column: string, value: number) => {
      eqCalls.push([column, value]);
      return builder;
    });

    return builder;
  });

  const shipmentLineItemsUpserts: any[] = [];
  const shipmentLineItemsUpsert = jest.fn(async (rows: unknown) => {
    shipmentLineItemsUpserts.push(rows);
    return { data: null, error: null };
  });

  const supabaseClient = {
    from(table: keyof Database['public']['Tables']) {
      switch (table) {
        case 'shipments':
          return {
            select: shipmentsSelect,
            update: shipmentsUpdate
          } as any;
        case 'shopify_connections':
          return {
            select: shopifyConnectionsSelect
          } as any;
        case 'orders':
          return ordersTable;
        case 'line_items':
          return {
            update: lineItemsUpdate
          } as any;
        case 'shipment_line_items':
          return {
            upsert: shipmentLineItemsUpsert
          } as any;
        default:
          throw new Error(`Unexpected table access: ${table}`);
      }
    }
  } as unknown as SupabaseClient<Database>;

  return {
    supabaseClient,
    shipmentRecord,
    shipmentUpdates,
    orderUpdates,
    lineItemUpdates,
    shipmentLineItemsUpserts,
    spies: {
      shipmentsSelect,
      shipmentsSelectEq,
      shipmentsSelectMaybeSingle,
      shipmentsUpdate,
      shopifyConnectionsSelect,
      shopifyConnectionsSelectEq,
      shopifyConnectionsSelectMaybeSingle,
      ordersUpdate,
      lineItemsUpdate,
      shipmentLineItemsUpsert
    }
  };
}

describe('syncShipmentWithShopify', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
    process.env.SHOPIFY_ADMIN_API_VERSION = '2025-10';
    (fulfillmentModule.loadShopifyAccessToken as jest.Mock).mockResolvedValue('test-access-token');
    (fulfillmentModule.fetchFulfillmentOrderSnapshots as jest.Mock).mockReset();
    (fulfillmentModule.applyFulfillmentOrderSnapshot as jest.Mock).mockImplementation(
      actualFulfillmentModule.applyFulfillmentOrderSnapshot
    );
  });

  it('Shopifyへ新規Fulfillmentを作成し、Supabaseレコードを同期する', async () => {
    const {
      supabaseClient,
      shipmentRecord,
      shipmentUpdates,
      orderUpdates,
      lineItemUpdates,
      shipmentLineItemsUpserts
    } = createSupabaseMock();

    getShopifyServiceClient.mockReturnValue(supabaseClient);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          fulfillment_orders: [
            {
              id: 999,
              line_items: [
                {
                  id: 777,
                  line_item_id: shipmentRecord.line_items[0].line_item!.shopify_line_item_id,
                  remaining_quantity: 2
                }
              ]
            }
          ]
        }),
        text: async () => ''
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ fulfillment: { id: 321 } }),
        text: async () => ''
      });

    global.fetch = fetchMock as any;

    await syncShipmentWithShopify(shipmentRecord.id);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe(
      'https://example.myshopify.com/admin/api/2025-10/orders/1234567890/fulfillment_orders.json'
    );
    expect(fetchMock.mock.calls[1]?.[0]?.toString()).toBe(
      'https://example.myshopify.com/admin/api/2025-10/fulfillments.json'
    );

    const fulfillmentBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(fulfillmentBody.fulfillment.line_items_by_fulfillment_order[0]).toMatchObject({
      fulfillment_order_id: 999,
      fulfillment_order_line_items: [{ id: 777, quantity: 2 }]
    });

    expect(shipmentUpdates.length).toBe(2);
    expect(shipmentUpdates[0].payload).toMatchObject({
      sync_status: 'processing',
      sync_error: null
    });
    expect(shipmentUpdates[1].payload).toMatchObject({
      sync_status: 'synced',
      shopify_fulfillment_id: 321,
      tracking_company: 'Yamato (JA)'
    });

    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0]).toMatchObject({ shopify_fulfillment_order_id: 999 });

    expect(lineItemUpdates).toHaveLength(1);
    expect(lineItemUpdates[0].payload).toMatchObject({
      fulfillment_order_line_item_id: 777,
      fulfillable_quantity: 2
    });
    expect(lineItemUpdates[0].eqArgs).toEqual([
      ['shopify_line_item_id', shipmentRecord.line_items[0].line_item!.shopify_line_item_id],
      ['order_id', shipmentRecord.order!.id]
    ]);

    expect(shipmentLineItemsUpserts).toHaveLength(1);
    expect(shipmentLineItemsUpserts[0]).toEqual([
      {
        shipment_id: shipmentRecord.id,
        line_item_id: shipmentRecord.line_items[0].line_item_id,
        fulfillment_order_line_item_id: 777,
        quantity: 2
      }
    ]);
  });
});

describe('syncFulfillmentOrderMetadata', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    getShopifyServiceClient.mockReset();
    (fulfillmentModule.loadShopifyAccessToken as jest.Mock).mockReset();
    (fulfillmentModule.fetchFulfillmentOrderSnapshots as jest.Mock).mockReset();
    (fulfillmentModule.applyFulfillmentOrderSnapshot as jest.Mock).mockReset();
    process.env.SHOPIFY_ADMIN_API_VERSION = '2025-10';
    process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  function createOrdersSelectMock(orderId: number, shopDomain: string) {
    const builder: any = {};
    builder.eq = jest.fn(() => builder);
    builder.limit = jest.fn(() => builder);
    builder.order = jest.fn(() => builder);
    builder.gt = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => ({
      data: { id: orderId, shop_domain: shopDomain, status: 'unfulfilled' },
      error: null
    }));

    const select = jest.fn(() => builder);

    return { builder, select };
  }

  it('returns synced result when fulfillment order exists', async () => {
    const orderId = 42;
    const shopDomain = 'example.myshopify.com';
    const { select } = createOrdersSelectMock(orderId, shopDomain);

    const supabaseClient = {
      from(table: keyof Database['public']['Tables']) {
        if (table === 'orders') {
          return {
            select
          } as any;
        }
        throw new Error(`Unexpected table ${table}`);
      }
    } as unknown as SupabaseClient<Database>;

    getShopifyServiceClient.mockReturnValue(supabaseClient);

    (fulfillmentModule.loadShopifyAccessToken as jest.Mock).mockResolvedValue('test-token');
    (fulfillmentModule.fetchFulfillmentOrderSnapshots as jest.Mock).mockResolvedValue([
      {
        id: 999,
        line_items: [{ id: 777, line_item_id: 555, remaining_quantity: 2 }]
      }
    ]);
    (fulfillmentModule.applyFulfillmentOrderSnapshot as jest.Mock).mockResolvedValue(undefined);

    const { syncFulfillmentOrderMetadata } = await import('@/lib/data/orders');
    const result = await syncFulfillmentOrderMetadata(shopDomain, 1234567890);

    expect(result).toEqual({ status: 'synced', fulfillmentOrderId: 999, lineItemCount: 1 });
    expect(fulfillmentModule.fetchFulfillmentOrderSnapshots).toHaveBeenCalledWith(
      shopDomain,
      'test-token',
      1234567890
    );
    expect(fulfillmentModule.applyFulfillmentOrderSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        orderRecordId: orderId,
        fulfillmentOrderId: 999,
        lineItems: [{ id: 777, line_item_id: 555, remaining_quantity: 2 }]
      })
    );
  });

  it('returns pending when fulfillment orders are not yet available', async () => {
    const { select } = createOrdersSelectMock(101, 'example.myshopify.com');

    const supabaseClient = {
      from(table: keyof Database['public']['Tables']) {
        if (table === 'orders') {
          return {
            select
          } as any;
        }
        throw new Error(`Unexpected table ${table}`);
      }
    } as unknown as SupabaseClient<Database>;

    getShopifyServiceClient.mockReturnValue(supabaseClient);

    (fulfillmentModule.loadShopifyAccessToken as jest.Mock).mockResolvedValue('token');
    (fulfillmentModule.fetchFulfillmentOrderSnapshots as jest.Mock).mockResolvedValue([]);
    (fulfillmentModule.applyFulfillmentOrderSnapshot as jest.Mock).mockResolvedValue(undefined);

    const { syncFulfillmentOrderMetadata } = await import('@/lib/data/orders');
    const result = await syncFulfillmentOrderMetadata('example.myshopify.com', 222);

    expect(result.status).toBe('pending');
    expect(fulfillmentModule.applyFulfillmentOrderSnapshot).not.toHaveBeenCalled();
  });
});

describe('cancelShopifyFulfillment', () => {
  it('ShopifyのFulfillment取消エンドポイントを呼び出す', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => ''
    });

    global.fetch = fetchMock as any;

    await cancelShopifyFulfillment('example.myshopify.com', 'token', 123);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      'https://example.myshopify.com/admin/api/2025-10/fulfillments/123/cancel.json'
    );
    expect(init).toMatchObject({ method: 'POST' });
  });
});

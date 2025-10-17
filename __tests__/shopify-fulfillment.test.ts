/** @jest-environment node */

import { syncShipmentWithShopify } from '@/lib/shopify/fulfillment';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

jest.mock('@/lib/shopify/order-import', () => ({
  getShopifyServiceClient: jest.fn()
}));

const { getShopifyServiceClient } = jest.requireMock<{
  getShopifyServiceClient: jest.Mock
}>('@/lib/shopify/order-import');

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

  const lineItemUpdates: Array<{ payload: any; eqArgs: [string, number][] }> = [];
  const lineItemsUpdate = jest.fn((payload: unknown) => {
    const eqCalls: [string, number][] = [];
    lineItemUpdates.push({ payload, eqArgs: eqCalls });
    return {
      eq: jest.fn(async (column: string, value: number) => {
        eqCalls.push([column, value]);
        return { data: null, error: null };
      })
    };
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
          return {
            update: ordersUpdate
          } as any;
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
    expect(lineItemUpdates[0].eqArgs[0]).toEqual(['id', shipmentRecord.line_items[0].line_item!.id]);

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

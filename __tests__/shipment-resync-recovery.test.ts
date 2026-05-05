jest.mock('@/lib/shopify/fulfillment', () => ({
  syncShipmentWithShopify: jest.fn(),
  cancelShopifyFulfillment: jest.fn(),
  loadShopifyAccessToken: jest.fn(),
  upsertShopifyOrderNoteAttribute: jest.fn()
}));

jest.mock('@/lib/data/orders/fulfillment', () => ({
  syncFulfillmentOrderMetadata: jest.fn()
}));

jest.mock('@/lib/data/orders/clients', () => ({
  assertServiceClient: jest.fn(),
  getOptionalServiceClient: jest.fn()
}));

import { resyncPendingShipments } from '@/lib/data/orders/shipments';

const { syncShipmentWithShopify } = jest.requireMock<{
  syncShipmentWithShopify: jest.Mock;
}>('@/lib/shopify/fulfillment');

const { assertServiceClient } = jest.requireMock<{
  assertServiceClient: jest.Mock;
}>('@/lib/data/orders/clients');

function createResyncClient() {
  const shipmentUpdate = jest.fn(() => ({
    eq: jest.fn().mockResolvedValue({ error: null })
  }));
  const eventInsert = jest.fn().mockResolvedValue({ error: null });

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'shipments') {
        const listBuilder: any = {
          select: jest.fn((columns: string) => {
            if (columns === 'id') {
              return listBuilder;
            }
            return detailBuilder;
          }),
          in: jest.fn(() => listBuilder),
          or: jest.fn(() => listBuilder),
          order: jest.fn(() => listBuilder),
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 7001 }],
            error: null
          }),
          update: shipmentUpdate
        };

        const detailBuilder: any = {
          eq: jest.fn(() => detailBuilder),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 7001,
              vendor_id: 25,
              order_id: 501,
              sync_status: 'processing',
              sync_retry_count: 2
            },
            error: null
          })
        };

        return listBuilder;
      }

      if (table === 'shipment_sync_events') {
        return { insert: eventInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };

  return { client, shipmentUpdate, eventInsert };
}

describe('resyncPendingShipments recovery', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('marks failed Shopify sync attempts as error instead of leaving processing', async () => {
    const { client, shipmentUpdate, eventInsert } = createResyncClient();
    assertServiceClient.mockReturnValue(client);
    syncShipmentWithShopify.mockRejectedValue(new Error('Shopify API 403: missing scope'));

    const summary = await resyncPendingShipments({ limit: 1 });

    expect(summary).toEqual({
      total: 1,
      succeeded: 0,
      failed: 1,
      errors: [{ shipmentId: 7001, message: 'Shopify API 403: missing scope' }]
    });
    expect(shipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'error',
        sync_error: 'Shopify API 403: missing scope',
        sync_pending_until: null,
        sync_retry_count: 3
      })
    );
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shipment_id: 7001,
        event_type: 'sync_failed',
        status_from: 'processing',
        status_to: 'error',
        actor_type: 'worker',
        error_message: 'Shopify API 403: missing scope'
      })
    );
  });
});

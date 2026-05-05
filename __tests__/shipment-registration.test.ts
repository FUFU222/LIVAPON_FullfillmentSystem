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

import { upsertShipment } from '@/lib/data/orders/shipments';

const { syncShipmentWithShopify } = jest.requireMock<{
  syncShipmentWithShopify: jest.Mock;
}>('@/lib/shopify/fulfillment');

const { assertServiceClient } = jest.requireMock<{
  assertServiceClient: jest.Mock;
}>('@/lib/data/orders/clients');

const lineItems = [
  {
    id: 3001,
    vendor_id: 25,
    order_id: 501,
    fulfillable_quantity: 2,
    fulfilled_quantity: 0,
    fulfillment_order_line_item_id: 9001,
    shopify_line_item_id: 8001,
    quantity: 2
  }
];

function createDeferredClient(existingShipment?: {
  id: number;
  sync_status: string | null;
  sync_error: string | null;
  registration_payload_hash: string | null;
}) {
  const shipmentInsert = jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn().mockResolvedValue({ data: { id: 7001 }, error: null })
    }))
  }));
  const shipmentUpdate = jest.fn(() => ({
    eq: jest.fn().mockResolvedValue({ error: null })
  }));
  const pivotInsert = jest.fn().mockResolvedValue({ error: null });
  const eventInsert = jest.fn().mockResolvedValue({ error: null });

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'line_items') {
        const builder: any = {
          select: jest.fn(() => builder),
          in: jest.fn().mockResolvedValue({ data: lineItems, error: null })
        };
        return builder;
      }

      if (table === 'shipments') {
        const idempotencyBuilder: any = {
          select: jest.fn(() => idempotencyBuilder),
          eq: jest.fn(() => idempotencyBuilder),
          maybeSingle: jest.fn().mockResolvedValue({
            data: existingShipment ?? null,
            error: null
          }),
          insert: shipmentInsert,
          update: shipmentUpdate
        };
        return idempotencyBuilder;
      }

      if (table === 'shipment_line_items') {
        return {
          insert: pivotInsert,
          delete: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null })
          }))
        };
      }

      if (table === 'shipment_sync_events') {
        return {
          insert: eventInsert
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };

  return {
    client,
    shipmentInsert,
    shipmentUpdate,
    pivotInsert,
    eventInsert
  };
}

describe('shipment registration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('defers Shopify sync after creating the local shipment', async () => {
    const { client, shipmentInsert, pivotInsert, eventInsert } = createDeferredClient();
    assertServiceClient.mockReturnValue(client);

    const result = await upsertShipment(
      {
        lineItemIds: [3001],
        lineItemQuantities: { 3001: 1 },
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        status: 'shipped'
      },
      25,
      {
        skipFulfillmentOrderSync: true,
        deferShopifySync: true,
        registrationRequestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
        registrationPayloadHash: 'same-hash',
        actorUserId: '1e4f7569-d03b-47f9-a85f-d0d20f558071'
      }
    );

    expect(result).toEqual({
      shipmentId: 7001,
      syncStatus: 'pending',
      syncError: null
    });
    expect(syncShipmentWithShopify).not.toHaveBeenCalled();
    expect(shipmentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'pending',
        registration_request_id: '7f34b856-574c-49fd-92bc-d21a60ce1083',
        registration_payload_hash: 'same-hash'
      })
    );
    expect(pivotInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        shipment_id: 7001,
        line_item_id: 3001,
        quantity: 1
      })
    ]);
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shipment_id: 7001,
        event_type: 'registered',
        actor_type: 'vendor',
        actor_user_id: '1e4f7569-d03b-47f9-a85f-d0d20f558071'
      })
    );
  });

  it('returns the existing shipment on an idempotent replay', async () => {
    const { client, shipmentInsert, pivotInsert } = createDeferredClient({
      id: 7000,
      sync_status: 'pending',
      sync_error: null,
      registration_payload_hash: 'same-hash'
    });
    assertServiceClient.mockReturnValue(client);

    const result = await upsertShipment(
      {
        lineItemIds: [3001],
        lineItemQuantities: { 3001: 1 },
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        status: 'shipped'
      },
      25,
      {
        skipFulfillmentOrderSync: true,
        deferShopifySync: true,
        registrationRequestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
        registrationPayloadHash: 'same-hash'
      }
    );

    expect(result).toEqual({
      shipmentId: 7000,
      syncStatus: 'pending',
      syncError: null
    });
    expect(shipmentInsert).not.toHaveBeenCalled();
    expect(pivotInsert).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused with a different payload', async () => {
    const { client, shipmentInsert, pivotInsert } = createDeferredClient({
      id: 7000,
      sync_status: 'pending',
      sync_error: null,
      registration_payload_hash: 'different-hash'
    });
    assertServiceClient.mockReturnValue(client);

    await expect(
      upsertShipment(
        {
          lineItemIds: [3001],
          lineItemQuantities: { 3001: 1 },
          trackingNumber: 'TRK-123',
          carrier: 'yamato',
          status: 'shipped'
        },
        25,
        {
          skipFulfillmentOrderSync: true,
          deferShopifySync: true,
          registrationRequestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
          registrationPayloadHash: 'same-hash'
        }
      )
    ).rejects.toThrow('Shipment request payload conflicts with a previous registration');

    expect(shipmentInsert).not.toHaveBeenCalled();
    expect(pivotInsert).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent duplicate insert by returning the existing shipment', async () => {
    const maybeSingle = jest.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 7002,
          sync_status: 'pending',
          sync_error: null,
          registration_payload_hash: 'same-hash'
        },
        error: null
      });
    const shipmentInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' }
        })
      }))
    }));
    const pivotInsert = jest.fn();

    const client = {
      from: jest.fn((table: string) => {
        if (table === 'line_items') {
          const builder: any = {
            select: jest.fn(() => builder),
            in: jest.fn().mockResolvedValue({ data: lineItems, error: null })
          };
          return builder;
        }

        if (table === 'shipments') {
          const builder: any = {
            select: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            maybeSingle,
            insert: shipmentInsert
          };
          return builder;
        }

        if (table === 'shipment_line_items') {
          return { insert: pivotInsert };
        }

        if (table === 'shipment_sync_events') {
          return { insert: jest.fn().mockResolvedValue({ error: null }) };
        }

        throw new Error(`Unexpected table ${table}`);
      })
    };
    assertServiceClient.mockReturnValue(client);

    const result = await upsertShipment(
      {
        lineItemIds: [3001],
        lineItemQuantities: { 3001: 1 },
        trackingNumber: 'TRK-123',
        carrier: 'yamato',
        status: 'shipped'
      },
      25,
      {
        skipFulfillmentOrderSync: true,
        deferShopifySync: true,
        registrationRequestId: '7f34b856-574c-49fd-92bc-d21a60ce1083',
        registrationPayloadHash: 'same-hash'
      }
    );

    expect(result).toEqual({
      shipmentId: 7002,
      syncStatus: 'pending',
      syncError: null
    });
    expect(pivotInsert).not.toHaveBeenCalled();
  });
});

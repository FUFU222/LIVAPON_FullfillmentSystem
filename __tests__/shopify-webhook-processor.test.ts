/** @jest-environment node */

jest.mock('@/lib/shopify/order-import', () => ({
  upsertShopifyOrder: jest.fn()
}));

jest.mock('@/lib/shopify/shop-domains', () => ({
  isRegisteredShopDomain: jest.fn()
}));

jest.mock('@/lib/data/orders', () => ({
  triggerShipmentResyncForShopifyOrder: jest.fn(),
  syncFulfillmentOrderMetadata: jest.fn()
}));

jest.mock('@/lib/shopify/fulfillment', () => ({
  resolveShopifyOrderIdFromFulfillmentOrder: jest.fn()
}));

import { processShopifyWebhook, SUPPORTED_TOPICS, FULFILLMENT_ORDER_TOPICS } from '@/lib/shopify/webhook-processor';

const { isRegisteredShopDomain } = jest.requireMock<{
  isRegisteredShopDomain: jest.Mock;
}>('@/lib/shopify/shop-domains');

const { triggerShipmentResyncForShopifyOrder } = jest.requireMock<{
  triggerShipmentResyncForShopifyOrder: jest.Mock;
}>('@/lib/data/orders');

const { resolveShopifyOrderIdFromFulfillmentOrder } = jest.requireMock<{
  resolveShopifyOrderIdFromFulfillmentOrder: jest.Mock;
}>('@/lib/shopify/fulfillment');

describe('processShopifyWebhook', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    isRegisteredShopDomain.mockResolvedValue(true);
    resolveShopifyOrderIdFromFulfillmentOrder.mockResolvedValue(24680);
    triggerShipmentResyncForShopifyOrder.mockResolvedValue(undefined);
  });

  it('treats cancellation_request_accepted as a supported fulfillment-order webhook topic', () => {
    expect(SUPPORTED_TOPICS.has('fulfillment_orders/cancellation_request_accepted')).toBe(true);
    expect(FULFILLMENT_ORDER_TOPICS.has('fulfillment_orders/cancellation_request_accepted')).toBe(
      true
    );
  });

  it('resolves Shopify order id from fulfillment order id and triggers shipment resync', async () => {
    await processShopifyWebhook({
      id: 1,
      shop_domain: 'example.myshopify.com',
      topic: 'fulfillment_orders/cancellation_request_accepted',
      api_version: '2025-10',
      webhook_id: 'wh_1',
      payload: {
        fulfillment_order: {
          id: 'gid://shopify/FulfillmentOrder/13579'
        }
      },
      status: 'pending',
      attempts: 0,
      locked_at: null,
      last_error: null,
      created_at: '2026-03-15T00:00:00.000Z',
      updated_at: '2026-03-15T00:00:00.000Z'
    });

    expect(resolveShopifyOrderIdFromFulfillmentOrder).toHaveBeenCalledWith(
      'example.myshopify.com',
      'gid://shopify/FulfillmentOrder/13579'
    );
    expect(triggerShipmentResyncForShopifyOrder).toHaveBeenCalledWith(24680);
  });
});

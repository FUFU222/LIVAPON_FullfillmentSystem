import { render, screen } from '@testing-library/react';
import { AdminOrderDetail } from '@/components/admin/admin-order-detail';
import type { OrderDetail } from '@/lib/data/orders';

jest.mock('@/app/admin/orders/actions', () => ({
  linkShopifyFulfillmentAction: jest.fn(),
  markShipmentManualResolvedAction: jest.fn(),
  resyncShipmentByAdminAction: jest.fn()
}));

function buildOrder(overrides?: Partial<OrderDetail>): OrderDetail {
  return {
    id: 2312,
    orderNumber: '#1083',
    customerName: 'テスト顧客',
    status: 'fulfilled',
    updatedAt: '2026-05-05T07:20:53.681+00:00',
    createdAt: '2026-03-18T08:00:00.000+00:00',
    archivedAt: null,
    shippingPostal: null,
    shippingPrefecture: null,
    shippingCity: null,
    shippingAddress1: null,
    shippingAddress2: null,
    osNumber: null,
    lineItems: [
      {
        id: 3276,
        sku: '0017-01',
        variantTitle: null,
        vendorId: 28,
        vendorCode: '0017',
        vendorName: '株式会社HolyTech',
        productName: 'Nagaruru',
        quantity: 1,
        fulfilledQuantity: 0,
        fulfillableQuantity: 0,
        shippedQuantity: 1,
        remainingQuantity: 0,
        shipments: []
      }
    ],
    shipments: [],
    ...overrides
  };
}

describe('AdminOrderDetail shipment history', () => {
  it('summarizes Shopify quantity errors instead of rendering raw API JSON', () => {
    render(
      <AdminOrderDetail
        order={buildOrder({
          shipments: [
            {
              id: 82,
              trackingNumber: '12345678907154',
              carrier: 'japanpost',
              status: 'shipped',
              shippedAt: '2026-03-18T08:40:41.348+00:00',
              syncStatus: 'error',
              syncError: 'Shopify API 422: {"errors":["Invalid fulfillment order line item quantity requested."]}',
              shopifyFulfillmentId: null,
              lineItemIds: [3276],
              syncEvents: []
            }
          ]
        })}
      />
    );

    expect(screen.getByText('Shopify側の配送可能数量が不足しています。')).toBeInTheDocument();
    expect(screen.queryByText(/"errors"/)).not.toBeInTheDocument();
  });

  it('does not show fulfillment-link controls for manually resolved shipments', () => {
    render(
      <AdminOrderDetail
        order={buildOrder({
          shipments: [
            {
              id: 82,
              trackingNumber: '12345678907154',
              carrier: 'japanpost',
              status: 'shipped',
              shippedAt: '2026-03-18T08:40:41.348+00:00',
              syncStatus: 'manual_resolved',
              syncError: null,
              shopifyFulfillmentId: null,
              lineItemIds: [3276],
              syncEvents: []
            }
          ]
        })}
      />
    );

    expect(screen.getByText('手動対応済み')).toBeInTheDocument();
    expect(screen.queryByText('管理操作')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Fulfillment ID')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '紐付け' })).not.toBeInTheDocument();
  });
});

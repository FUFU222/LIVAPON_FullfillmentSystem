import { mapDetailToSummary, toOrderDetailFromRecord } from '@/lib/data/orders/transformers';
import type { RawOrderRecord } from '@/lib/data/orders/types';

const baseRecord: RawOrderRecord = {
  id: 1,
  order_number: '1002',
  customer_name: '佐藤花子',
  status: 'open',
  updated_at: '2025-11-10T00:00:00Z',
  created_at: '2025-11-09T03:00:00Z',
  shipping_postal: '1350001',
  shipping_prefecture: '東京都',
  shipping_city: '江東区',
  shipping_address1: '青海1-1-1',
  shipping_address2: 'テストビル5F',
  line_items: [
    {
      id: 10,
      vendor_id: 200,
      sku: 'LIVA-0001',
      product_name: 'OMモデル用ジャケット',
      variant_title: 'L サイズ',
      quantity: 5,
      fulfilled_quantity: 2,
      fulfillable_quantity: 3,
      shipments: [
        {
          quantity: 2,
          shipment: {
            id: 700,
            tracking_number: 'TRK123',
            carrier: 'yamato',
            status: 'in_transit',
            shipped_at: '2025-11-09T06:00:00Z'
          }
        }
      ]
    },
    {
      id: 11,
      vendor_id: 201,
      sku: 'LIVA-0002',
      product_name: '別ベンダー商品',
      variant_title: null,
      quantity: 1,
      fulfilled_quantity: 0,
      fulfillable_quantity: 1,
      shipments: []
    }
  ]
};

describe('orders transformers', () => {
  it('filters line items by vendor and keeps shipment progress', () => {
    const detail = toOrderDetailFromRecord(baseRecord, 200);
    expect(detail).not.toBeNull();

    const lineItem = detail!.lineItems[0];
    expect(lineItem.id).toBe(10);
    expect(lineItem.shipments).toHaveLength(1);
    expect(lineItem.shippedQuantity).toBe(2);
    expect(lineItem.remainingQuantity).toBe(3);

    const summary = mapDetailToSummary(detail!);
    expect(summary.status).toBe('partially_fulfilled');
    expect(summary.lineItems).toHaveLength(1);
    expect(summary.osNumber).toBeNull();
    expect(summary.shippingAddressLines).toEqual([
      '〒1350001',
      '東京都 江東区 青海1-1-1',
      'テストビル5F'
    ]);
  });

  it('returns null when vendor filter removes all line items', () => {
    const detail = toOrderDetailFromRecord(baseRecord, 999);
    expect(detail).toBeNull();
  });

  it('extracts OS number from shipping address', () => {
    const detail = toOrderDetailFromRecord(
      {
        ...baseRecord,
        shipping_address2: 'テストビル5F (OS-01115463)'
      },
      200
    );

    expect(detail).not.toBeNull();
    expect(detail?.osNumber).toBe('OS-01115463');

    const summary = mapDetailToSummary(detail!);
    expect(summary.osNumber).toBe('OS-01115463');
  });

  it('normalizes OS number even when hyphen is missing', () => {
    const detail = toOrderDetailFromRecord(
      {
        ...baseRecord,
        shipping_address2: 'テストビル5F OS01115463'
      },
      200
    );

    expect(detail).not.toBeNull();
    expect(detail?.osNumber).toBe('OS-01115463');
  });
});

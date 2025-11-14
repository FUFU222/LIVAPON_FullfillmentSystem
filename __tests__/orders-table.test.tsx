import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrderTable } from '@/components/orders/order-table';
import { OrdersDispatchTable } from '@/components/orders/orders-dispatch-table';
import type { OrderLineItemSummary, OrderSummary } from '@/lib/data/orders';

jest.mock('@/components/orders/orders-dispatch-panel', () => ({
  OrdersDispatchPanel: () => <div data-testid="orders-dispatch-panel" />
}));

function buildLineItem(partial?: Partial<OrderLineItemSummary>): OrderLineItemSummary {
  return {
    id: partial?.id ?? 10,
    orderId: partial?.orderId ?? 1,
    productName: partial?.productName ?? 'テスト商品',
    sku: partial?.sku ?? 'SKU-001',
    variantTitle: partial?.variantTitle ?? '通常',
    quantity: partial?.quantity ?? 2,
    fulfilledQuantity: partial?.fulfilledQuantity ?? 0,
    fulfillableQuantity: partial?.fulfillableQuantity ?? 2,
    shippedQuantity: partial?.shippedQuantity ?? 0,
    remainingQuantity: partial?.remainingQuantity ?? 2,
    vendorId: partial?.vendorId ?? 99,
    shipments: partial?.shipments ?? []
  };
}

function buildOrder(partial?: Partial<OrderSummary>): OrderSummary {
  return {
    id: partial?.id ?? 1,
    orderNumber: partial?.orderNumber ?? '1001',
    customerName: partial?.customerName ?? '山田太郎',
    lineItemCount: partial?.lineItemCount ?? 2,
    status: partial?.status ?? 'unfulfilled',
    shopifyStatus: partial?.shopifyStatus ?? 'unfulfilled',
    localStatus: partial?.localStatus ?? partial?.status ?? 'unfulfilled',
    isArchived: partial?.isArchived ?? false,
    shippingAddress: partial?.shippingAddress ?? '〒123-4567 東京都千代田区1-1-1',
    shippingAddressLines: partial?.shippingAddressLines ?? ['〒123-4567', '東京都千代田区1-1-1'],
    trackingNumbers: partial?.trackingNumbers ?? [],
    updatedAt: partial?.updatedAt ?? '2025-11-11T10:00:00Z',
    createdAt: partial?.createdAt ?? '2025-11-11T09:00:00Z',
    lineItems: partial?.lineItems ?? [buildLineItem(), buildLineItem({ id: 11 })]
  };
}

describe('OrderTable / OrdersDispatchTable', () => {
  it('OrderTable renders without the 商品数 column while keeping other headers', () => {
    render(<OrderTable orders={[buildOrder()]} />);

    expect(screen.getByRole('columnheader', { name: '注文番号' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '顧客名' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ステータス' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '商品数' })).not.toBeInTheDocument();
  });

  it('OrdersDispatchTable shows 商品 × 数量 表記 inside detail rows', () => {
    const order = buildOrder({
      lineItems: [
        buildLineItem({ id: 20, productName: '出荷商品A', quantity: 3, vendorId: 55 })
      ]
    });

    render(<OrdersDispatchTable orders={[order]} vendorId={55} />);

    const orderRow = screen.getByText(order.orderNumber).closest('tr');
    expect(orderRow).not.toBeNull();
    fireEvent.click(orderRow!);

    const detailHeader = screen.getByRole('columnheader', { name: '商品 × 数量' });
    expect(detailHeader).toBeInTheDocument();

    const detailCell = screen.getByText(/出荷商品A/).closest('td');
    expect(detailCell).not.toBeNull();
    expect(within(detailCell!).getByText('× 3')).toBeInTheDocument();
  });
});

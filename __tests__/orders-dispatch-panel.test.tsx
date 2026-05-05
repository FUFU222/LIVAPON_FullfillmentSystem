import { render, screen } from '@testing-library/react';
import { OrdersDispatchPanel } from '@/components/orders/orders-dispatch-panel';
import { OrdersRealtimeProvider } from '@/components/orders/orders-realtime-context';
import { ToastProvider } from '@/components/ui/toast-provider';
import type { OrderSummary } from '@/lib/data/orders';
import type { SelectedLineItem } from '@/components/orders/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
    push: jest.fn()
  })
}));

const selectedLineItems: SelectedLineItem[] = [
  {
    lineItemId: 4001,
    orderId: 1002,
    orderNumber: '#1002',
    productName: 'テスト商品',
    sku: 'SKU-1',
    variantTitle: null,
    totalOrdered: 1,
    shippedQuantity: 0,
    availableQuantity: 1,
    quantity: 1
  }
];

const orders: OrderSummary[] = [
  {
    id: 1002,
    orderNumber: '#1002',
    customerName: 'テスト顧客',
    lineItemCount: 1,
    status: 'unfulfilled',
    shopifyStatus: 'unfulfilled',
    localStatus: 'unfulfilled',
    isArchived: false,
    shippingAddress: '東京都渋谷区',
    shippingAddressLines: ['東京都渋谷区'],
    osNumber: null,
    trackingNumbers: [],
    updatedAt: '2026-05-05T08:00:00Z',
    createdAt: '2026-05-05T07:30:00Z',
    lineItems: []
  }
];

describe('OrdersDispatchPanel', () => {
  it('positions the selected-items panel above the mobile bottom nav', () => {
    render(
      <ToastProvider>
        <OrdersRealtimeProvider>
          <OrdersDispatchPanel
            orders={orders}
            selectedLineItems={selectedLineItems}
            onClearSelection={jest.fn()}
            onRemoveLineItem={jest.fn()}
            onUpdateQuantity={jest.fn()}
            onRemoveOrder={jest.fn()}
          />
        </OrdersRealtimeProvider>
      </ToastProvider>
    );

    expect(screen.getByTestId('orders-dispatch-panel-bar')).toHaveClass(
      'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
    );
    expect(screen.getByTestId('orders-dispatch-panel-bar')).toHaveClass('md:bottom-4');
  });

  it('wraps selected item chips on mobile instead of requiring horizontal scrolling', () => {
    render(
      <ToastProvider>
        <OrdersRealtimeProvider>
          <OrdersDispatchPanel
            orders={orders}
            selectedLineItems={selectedLineItems}
            onClearSelection={jest.fn()}
            onRemoveLineItem={jest.fn()}
            onUpdateQuantity={jest.fn()}
            onRemoveOrder={jest.fn()}
          />
        </OrdersRealtimeProvider>
      </ToastProvider>
    );

    expect(screen.getByTestId('orders-dispatch-preview-list')).toHaveClass('flex-wrap');
    expect(screen.getByTestId('orders-dispatch-preview-list')).not.toHaveClass('overflow-x-auto');
    expect(screen.getByTestId('orders-dispatch-preview-list')).toHaveClass('md:overflow-x-auto');
  });
});

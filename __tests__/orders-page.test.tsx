import { render, screen } from '@testing-library/react';
import OrdersPage from '@/app/orders/page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
  useRouter: () => ({
    replace: jest.fn(),
    refresh: jest.fn()
  }),
  useSearchParams: () => new URLSearchParams()
}));

jest.mock('@/lib/auth', () => ({
  getAuthContext: jest.fn(),
  isAdmin: jest.fn()
}));

jest.mock('@/lib/data/orders', () => ({
  getOrders: jest.fn()
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerComponentClient: jest.fn()
}));

jest.mock('@/lib/packing-slip', () => ({
  getIssuanceFlagsByOrderIds: jest.fn()
}));

jest.mock('@/components/orders/orders-dispatch-table', () => ({
  OrdersDispatchTable: () => <div data-testid="orders-dispatch-table" />
}));

jest.mock('@/components/orders/orders-realtime-listener', () => ({
  OrdersRealtimeListener: () => null
}));

jest.mock('@/components/orders/orders-realtime-resetter', () => ({
  OrdersRealtimeResetter: () => null
}));

jest.mock('@/components/orders/orders-refresh-button', () => ({
  OrdersRefreshButton: () => <button type="button">更新</button>
}));

const { getAuthContext } = jest.requireMock<{
  getAuthContext: jest.Mock;
}>('@/lib/auth');
const { getOrders } = jest.requireMock<{
  getOrders: jest.Mock;
}>('@/lib/data/orders');
const { getServerComponentClient } = jest.requireMock<{
  getServerComponentClient: jest.Mock;
}>('@/lib/supabase/server');
const { getIssuanceFlagsByOrderIds } = jest.requireMock<{
  getIssuanceFlagsByOrderIds: jest.Mock;
}>('@/lib/packing-slip');

function buildFulfilledOrder(id: number) {
  return {
    id,
    orderNumber: `#100${id}`,
    customerName: `顧客${id}`,
    status: 'fulfilled',
    lineItems: [
      {
        id: id * 10,
        remainingQuantity: 0,
        shippedQuantity: 1
      }
    ]
  };
}

describe('OrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAuthContext.mockResolvedValue({
      user: { id: 'user-1', email: 'seller@example.com' },
      role: 'vendor',
      vendorId: 10
    });
    getServerComponentClient.mockResolvedValue({});
    getIssuanceFlagsByOrderIds.mockResolvedValue(new Map());
  });

  it('keeps the vendor order header compact without status summary badges', async () => {
    getOrders.mockResolvedValue([
      buildFulfilledOrder(1),
      buildFulfilledOrder(2),
      buildFulfilledOrder(3),
      buildFulfilledOrder(4)
    ]);

    render(await OrdersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: '注文処理' })).toBeInTheDocument();
    expect(
      screen.getByText('発送対象の商品を選択し、追跡番号を入力して発送登録します。')
    ).toBeInTheDocument();
    expect(screen.queryByText(/スキャンまたは/)).not.toBeInTheDocument();
    expect(screen.queryByText('全 4 件')).not.toBeInTheDocument();
    expect(screen.queryByText('未発送 0 件')).not.toBeInTheDocument();
    expect(screen.queryByText('一部発送 0 件')).not.toBeInTheDocument();
    expect(screen.queryByText('発送済 4 件')).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('注文番号・顧客名で検索');
    expect(searchInput.closest('header')).toContainElement(searchInput);
  });
});

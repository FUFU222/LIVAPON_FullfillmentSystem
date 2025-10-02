import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderFilters } from '@/components/orders/order-filters';
import { OrderTable } from '@/components/orders/order-table';
import { getOrders } from '@/lib/data/orders';

type SearchParams = { [key: string]: string | string[] | undefined };

function filterOrders(
  orders: Awaited<ReturnType<typeof getOrders>>,
  searchParams: { q?: string; status?: string }
) {
  const query = searchParams.q?.toLowerCase().trim();
  const status = searchParams.status?.toLowerCase().trim();

  return orders.filter((order) => {
    const matchQuery = query
      ? order.orderNumber.toLowerCase().includes(query) ||
        (order.customerName?.toLowerCase().includes(query) ?? false)
      : true;
    const matchStatus = status ? order.status?.toLowerCase() === status : true;
    return matchQuery && matchStatus;
  });
}

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = {
    q: Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q,
    status: Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status
  };

  const orders = await getOrders();
  const filtered = filterOrders(orders, params);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-2xl font-semibold">注文一覧</CardTitle>
          <p className="text-sm text-slate-500">最新のShopify注文を確認し、発送状況を更新できます。</p>
        </div>
        <Link href="/import" className={buttonClasses()}>
          CSVインポート
        </Link>
      </CardHeader>
      <CardContent className="gap-6">
        <OrderFilters />
        <OrderTable orders={filtered} />
      </CardContent>
    </Card>
  );
}

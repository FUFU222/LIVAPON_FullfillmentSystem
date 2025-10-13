import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderFilters } from '@/components/orders/order-filters';
import { OrderTable } from '@/components/orders/order-table';
import { OrdersRefreshButton } from '@/components/orders/orders-refresh-button';
import { getOrders } from '@/lib/data/orders';
import { getAuthContext } from '@/lib/auth';

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

function buildRedirectTarget(searchParams: SearchParams) {
  const nextParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          nextParams.append(key, entry);
        }
      });
    } else if (typeof value === 'string') {
      nextParams.set(key, value);
    }
  });

  const query = nextParams.toString();
  return query ? `/orders?${query}` : '/orders';
}

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const redirectTarget = buildRedirectTarget(searchParams);
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  if (auth.role === 'pending_vendor') {
    redirect('/pending');
  }

  if (auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  const params = {
    q: Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q,
    status: Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status
  };

  const orders = await getOrders(auth.vendorId);
  const filtered = filterOrders(orders, params);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl font-semibold">注文一覧</CardTitle>
            <OrdersRefreshButton />
          </div>
          <p className="text-sm text-slate-500">最新の注文を確認し、発送状況を更新できます。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className={buttonClasses()}>
            CSVインポート
          </Link>
        </div>
      </CardHeader>
      <CardContent className="gap-6">
        <OrderFilters />
        <OrderTable orders={filtered} />
      </CardContent>
    </Card>
  );
}

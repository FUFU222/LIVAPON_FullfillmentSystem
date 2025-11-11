import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderFilters } from '@/components/orders/order-filters';
import { OrdersDispatchTable } from '@/components/orders/orders-dispatch-table';
import { OrdersRealtimeListener } from '@/components/orders/orders-realtime-listener';
import { OrdersRefreshButton } from '@/components/orders/orders-refresh-button';
import { getOrders } from '@/lib/data/orders';
import { getAuthContext } from '@/lib/auth';
import { cn } from '@/lib/utils';

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
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const requestedPage = Number(pageParam ?? '1');
  const PAGE_SIZE = 20;

  const orders = await getOrders(auth.vendorId);
  const filtered = filterOrders(orders, params);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <Card>
      <OrdersRealtimeListener vendorId={auth.vendorId} orderIds={paginated.map((order) => order.id)} />
      <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl font-semibold">注文一覧</CardTitle>
            <OrdersRefreshButton />
          </div>
          <p className="text-sm text-slate-500">
            全 {filtered.length} 件中 {filtered.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filtered.length)} 件を表示
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/orders/shipments" className={buttonClasses('outline')}>
            発送履歴一覧
          </Link>
        </div>
      </CardHeader>
      <CardContent className="gap-6">
        <OrderFilters />
        <OrdersDispatchTable orders={paginated} vendorId={auth.vendorId} />
        <PaginationControls currentPage={currentPage} totalPages={totalPages} params={params} />
      </CardContent>
    </Card>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  params
}: {
  currentPage: number;
  totalPages: number;
  params: { q?: string; status?: string };
}) {
  if (totalPages <= 1) {
    return null;
  }

  const buildUrl = (page: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.status) search.set('status', params.status);
    if (page > 1) search.set('page', String(page));
    return search.toString() ? `/orders?${search.toString()}` : '/orders';
  };

  const displayedPages = new Set<number>();
  displayedPages.add(1);
  displayedPages.add(totalPages);
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) {
      displayedPages.add(page);
    }
  }
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      displayedPages.add(page);
    }
  }
  const pageNumbers = Array.from(displayedPages).sort((a, b) => a - b);
  const renderedPages: ReactNode[] = [];
  let lastPage = 0;
  pageNumbers.forEach((page) => {
    if (page - lastPage > 1) {
      renderedPages.push(
        <span key={`ellipsis-${page}`} className="px-1 text-slate-400">
          …
        </span>
      );
    }
    renderedPages.push(
      <Link
        key={`page-${page}`}
        href={buildUrl(page)}
        className={cn(
          'rounded-md border px-3 py-1 transition',
          page === currentPage
            ? 'border-foreground bg-foreground text-white'
            : 'border-slate-200 text-slate-600 hover:bg-muted'
        )}
      >
        {page}
      </Link>
    );
    lastPage = page;
  });

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
      <span>
        ページ {currentPage} / {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={buildUrl(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage === 1}
          className={cn(
            'rounded-md border border-slate-200 px-3 py-1 transition',
            currentPage === 1 ? 'pointer-events-none opacity-40' : 'hover:bg-muted'
          )}
        >
          前へ
        </Link>
        {renderedPages}
        <Link
          href={buildUrl(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage === totalPages}
          className={cn(
            'rounded-md border border-slate-200 px-3 py-1 transition',
            currentPage === totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-muted'
          )}
        >
          次へ
        </Link>
      </div>
    </div>
  );
}

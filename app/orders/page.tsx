import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { PageHeader, Surface } from '@/components/ui/page-shell';
import { OrdersDispatchTable } from '@/components/orders/orders-dispatch-table';
import { OrdersRealtimeListener } from '@/components/orders/orders-realtime-listener';
import { OrdersRealtimeResetter } from '@/components/orders/orders-realtime-resetter';
import { OrderFilters } from '@/components/orders/order-filters';
import { OrdersRefreshButton } from '@/components/orders/orders-refresh-button';
import { getOrders } from '@/lib/data/orders';
import { getAuthContext } from '@/lib/auth';
import { getServerComponentClient } from '@/lib/supabase/server';
import { getIssuanceFlagsByOrderIds } from '@/lib/packing-slip';
import { cn } from '@/lib/utils';

type SearchParams = { [key: string]: string | string[] | undefined };
type SearchParamsInput = Promise<SearchParams> | undefined;

export default async function OrdersPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectTarget = buildRedirectTarget(resolvedSearchParams);
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  if (auth.role === 'pending_vendor' && auth.vendorId === null) {
    redirect('/pending');
  }

  if (auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  const params = {
    q: Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q,
    status: Array.isArray(resolvedSearchParams.status) ? resolvedSearchParams.status[0] : resolvedSearchParams.status
  };
  const pageParam = Array.isArray(resolvedSearchParams.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams.page;
  const requestedPage = Number(pageParam ?? '1');
  const PAGE_SIZE = 20;

  const orders = await getOrders(auth.vendorId);
  const filtered = filterOrders(orders, params);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  // 納品書出力済みフラグ(自分の vendor_id 分のみ、RLS で自動制限)
  const supabase = await getServerComponentClient();
  const issuanceFlags = await getIssuanceFlagsByOrderIds(
    supabase,
    paginated.map((o) => o.id),
    { role: 'vendor', userId: auth.user.id, vendorId: auth.vendorId }
  );
  const issuedOrderIds = Array.from(issuanceFlags.entries())
    .filter(([, issued]) => issued)
    .map(([id]) => id);

  return (
    <div className="grid gap-5">
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <OrdersRealtimeResetter />
      <PageHeader
        className="sm:flex-col sm:items-stretch xl:flex-row xl:items-start"
        actionsClassName="w-full xl:w-[36rem]"
        eyebrow="Dispatch"
        title="注文処理"
        description="発送対象の商品を選択し、追跡番号を入力して発送登録します。"
        actions={
          <div className="grid w-full gap-2">
            <OrderFilters className="w-full bg-white/90 lg:w-full" />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <OrdersRefreshButton />
              <Link href="/orders/shipments" className={buttonClasses('outline')}>
                発送履歴一覧
              </Link>
            </div>
          </div>
        }
      />

      <Surface className="overflow-hidden p-2 sm:p-4">
        <div className="mb-3 px-1 text-sm text-slate-600">
          <span className="font-medium text-slate-900">
            {filtered.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filtered.length)}
          </span>
          <span className="text-slate-400"> / </span>
          <span>{filtered.length} 件を表示</span>
        </div>
        <OrdersDispatchTable
          orders={paginated}
          vendorId={auth.vendorId}
          issuedOrderIds={issuedOrderIds}
        />
        <PaginationControls currentPage={currentPage} totalPages={totalPages} params={params} />
      </Surface>
    </div>
  );
}

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
    const matchStatus = status ? (order.status ?? '').toLowerCase() === status : true;
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

import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { PageHeader, Surface } from '@/components/ui/page-shell';
import { AdminOrdersTable } from '@/components/admin/admin-orders-table';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getRecentOrdersForAdmin } from '@/lib/data/orders';
import { getServerComponentClient } from '@/lib/supabase/server';
import { getIssuanceFlagsByOrderIds } from '@/lib/packing-slip';

export default async function AdminOrdersPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/admin/orders');
  }

  if (!isAdmin(auth)) {
    redirect('/orders');
  }

  const orders = await getRecentOrdersForAdmin(50);

  // 納品書出力済みフラグを 1 クエリでまとめて取得(admin は全件可視)
  const supabase = await getServerComponentClient();
  const issuanceFlags = await getIssuanceFlagsByOrderIds(
    supabase,
    orders.map((o) => o.id),
    { role: 'admin', userId: auth.user.id }
  );
  const issuedOrderIds = Array.from(issuanceFlags.entries())
    .filter(([, issued]) => issued)
    .map(([id]) => id);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Admin"
        title="注文"
        description="最近更新された注文を確認し、必要に応じて納品書・発送連携状態を確認できます。"
      />
      <Surface className="p-3 sm:p-4">
        {orders.length === 0 ? (
          <Alert variant="success">表示できる注文がありません。</Alert>
        ) : (
          <AdminOrdersTable orders={orders} issuedOrderIds={issuedOrderIds} />
        )}
      </Surface>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">全注文一覧</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <Alert variant="success">表示できる注文がありません。</Alert>
        ) : (
          <AdminOrdersTable orders={orders} issuedOrderIds={issuedOrderIds} />
        )}
      </CardContent>
    </Card>
  );
}

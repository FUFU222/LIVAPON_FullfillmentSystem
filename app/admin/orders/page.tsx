import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminOrdersTable } from '@/components/admin/admin-orders-table';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getRecentOrdersForAdmin } from '@/lib/data/orders';

export default async function AdminOrdersPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/admin/orders');
  }

  if (!isAdmin(auth)) {
    redirect('/orders');
  }

  const orders = await getRecentOrdersForAdmin(50);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">全注文一覧</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <Alert variant="success">表示できる注文がありません。</Alert>
        ) : (
          <AdminOrdersTable orders={orders} />
        )}
      </CardContent>
    </Card>
  );
}

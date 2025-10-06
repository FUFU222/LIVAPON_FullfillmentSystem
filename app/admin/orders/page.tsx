import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getRecentOrdersForAdmin } from '@/lib/data/orders';

function toDisplayDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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
        <p className="text-sm text-slate-500">最新 50 件の注文を表示しています。全件は Supabase Studio から確認できます。</p>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <Alert variant="success">表示できる注文がありません。</Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">注文番号</th>
                  <th className="px-3 py-2">ステータス</th>
                  <th className="px-3 py-2">顧客名</th>
                  <th className="px-3 py-2">ベンダー</th>
                  <th className="px-3 py-2">最終更新</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 text-slate-600">
                    <td className="px-3 py-2 font-medium text-foreground">{order.orderNumber}</td>
                    <td className="px-3 py-2">
                      <Badge intent={order.status}>{order.status ?? '未設定'}</Badge>
                    </td>
                    <td className="px-3 py-2">{order.customerName ?? '-'}</td>
                    <td className="px-3 py-2">
                      {order.vendorName ? (
                        <span className="flex flex-col">
                          <span>{order.vendorName}</span>
                          <span className="text-xs text-slate-500">{order.vendorCode ?? '----'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">未割当</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{toDisplayDate(order.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

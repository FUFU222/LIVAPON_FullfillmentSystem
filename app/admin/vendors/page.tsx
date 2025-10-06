import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getVendors, type VendorListEntry } from '@/lib/data/vendors';

function toDisplayDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export default async function AdminVendorsPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/admin/vendors');
  }

  if (!isAdmin(auth)) {
    redirect('/orders');
  }

  let vendors: VendorListEntry[] = [];
  let hasError = false;

  try {
    vendors = await getVendors(100);
  } catch (error) {
    console.error('Failed to load vendors for admin dashboard', error);
    hasError = true;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">ベンダー一覧</CardTitle>
        <p className="text-sm text-slate-500">最新 100 件のベンダーを表示しています。</p>
      </CardHeader>
      <CardContent>
        {hasError ? (
          <Alert variant="destructive">ベンダー情報の取得に失敗しました。</Alert>
        ) : vendors.length === 0 ? (
          <Alert variant="success">表示できるベンダーがありません。</Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">ベンダー名</th>
                  <th className="px-3 py-2">コード</th>
                  <th className="px-3 py-2">メール</th>
                  <th className="px-3 py-2">登録日</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-slate-100 text-slate-600">
                    <td className="px-3 py-2 font-medium text-foreground">{vendor.name}</td>
                    <td className="px-3 py-2">{vendor.code ?? '----'}</td>
                    <td className="px-3 py-2">{vendor.contactEmail ?? '-'}</td>
                    <td className="px-3 py-2 text-xs">{toDisplayDate(vendor.createdAt)}</td>
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

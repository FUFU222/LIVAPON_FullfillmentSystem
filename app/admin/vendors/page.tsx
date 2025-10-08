import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getVendors, type VendorListEntry } from '@/lib/data/vendors';
import { VendorBulkDeleteForm } from '@/components/admin/vendor-bulk-delete-form';

export default async function AdminVendorsPage({
  searchParams
}: {
  searchParams?: { status?: string; error?: string };
}) {
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

  const statusMessage = searchParams?.status === 'deleted' ? 'ベンダーを削除しました。' : null;
  const errorMessage = typeof searchParams?.error === 'string' ? searchParams.error : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-2xl font-semibold">ベンダー一覧</CardTitle>
          <p className="text-sm text-slate-500">最新 100 件のベンダーを表示しています。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/vendors/export" className={buttonClasses('outline')}>
            CSVダウンロード
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {statusMessage ? <Alert variant="success">{statusMessage}</Alert> : null}
        {errorMessage ? <Alert variant="destructive">{errorMessage}</Alert> : null}

        {hasError ? (
          <Alert variant="destructive">ベンダー情報の取得に失敗しました。</Alert>
        ) : vendors.length === 0 ? (
          <Alert variant="success">表示できるベンダーがありません。</Alert>
        ) : (
          <VendorBulkDeleteForm vendors={vendors} />
        )}
      </CardContent>
    </Card>
  );
}

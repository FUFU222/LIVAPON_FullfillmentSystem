import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getVendors, type VendorListEntry } from '@/lib/data/vendors';
import { VendorBulkDeleteForm } from '@/components/admin/vendor-bulk-delete-form';

type AdminVendorsSearchParams = { status?: string; error?: string };

export default async function AdminVendorsPage({
  searchParams
}: {
  searchParams?: Promise<AdminVendorsSearchParams>;
}) {
  const resolvedParams = (await searchParams) ?? {};
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

  const statusMessage = resolvedParams.status === 'deleted' ? 'セラーを削除しました。' : null;
  const errorMessage = typeof resolvedParams.error === 'string' ? resolvedParams.error : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-2xl font-semibold">セラー一覧</CardTitle>
        <p className="text-sm text-slate-500">最新 100 件のセラーを表示しています。</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {statusMessage ? <Alert variant="success">{statusMessage}</Alert> : null}
        {errorMessage ? <Alert variant="destructive">{errorMessage}</Alert> : null}

        {hasError ? (
          <Alert variant="destructive">セラー情報の取得に失敗しました。</Alert>
        ) : vendors.length === 0 ? (
          <Alert variant="success">表示できるセラーがありません。</Alert>
        ) : (
          <VendorBulkDeleteForm vendors={vendors} />
        )}
      </CardContent>
    </Card>
  );
}

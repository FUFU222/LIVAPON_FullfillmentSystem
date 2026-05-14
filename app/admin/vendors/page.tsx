import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { PageHeader, Surface } from '@/components/ui/page-shell';
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
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Admin"
        title="セラー"
        description="登録済みセラーの連絡先・状態を確認できます。最新 100 件を表示しています。"
      />
      <Surface className="grid gap-4 p-3 sm:p-4">
        {statusMessage ? <Alert variant="success">{statusMessage}</Alert> : null}
        {errorMessage ? <Alert variant="destructive">{errorMessage}</Alert> : null}

        {hasError ? (
          <Alert variant="destructive">セラー情報の取得に失敗しました。</Alert>
        ) : vendors.length === 0 ? (
          <Alert variant="success">表示できるセラーがありません。</Alert>
        ) : (
          <VendorBulkDeleteForm vendors={vendors} />
        )}
      </Surface>
    </div>
  );
}

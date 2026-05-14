import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { PageHeader, Surface } from '@/components/ui/page-shell';
import { UploadForm } from './upload-form';
import { getAuthContext } from '@/lib/auth';

export default async function ImportPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/import');
  }

  if (auth.role === 'pending_vendor' && auth.vendorId === null) {
    redirect('/pending');
  }

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  if (auth.vendorId === null) {
    redirect('/sign-in?redirectTo=/import');
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Import"
        title="CSVインポート"
        description="サンプルフォーマットに従って追跡番号を一括登録できます。インポート前に内容をプレビューして確認してください。"
        actions={
          <Link href="/orders" className={buttonClasses('ghost', 'text-sm')}>
            注文一覧に戻る
          </Link>
        }
      />
      <Surface className="p-4 sm:p-6">
        <UploadForm />
      </Surface>
    </div>
  );
}

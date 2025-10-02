import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UploadForm } from './upload-form';
import { getAuthContext } from '@/lib/auth';

export default async function ImportPage() {
  const auth = await getAuthContext();

  if (!auth || auth.vendorId === null) {
    redirect('/sign-in?redirectTo=/import');
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/orders" className="text-sm text-slate-500 hover:text-foreground">
        ← 注文一覧に戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">CSVインポート</CardTitle>
          <CardDescription>
            サンプルフォーマットに従って追跡番号を一括登録できます。インポート前に内容をプレビューして確認してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
    </div>
  );
}

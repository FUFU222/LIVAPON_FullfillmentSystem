import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth';
import { PageHeader, Surface } from '@/components/ui/page-shell';
import { PendingAccessStatus } from '@/components/pending/pending-access-status';

export default async function PendingStatusPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/pending');
  }

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  if (auth.vendorId) {
    redirect('/orders');
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader
        eyebrow="Application"
        title="審査状況"
        description="利用開始依頼の確認が完了するまで、現在のステータスを表示します。"
      />
      <Surface className="space-y-4 p-4 text-sm text-slate-600 sm:p-6">
        <PendingAccessStatus />
        <p>
          緊急のご要望や追加のご連絡が必要な場合は
          {' '}
          <a href="mailto:a.tanaka@chairman.jp" className="text-foreground underline">
            a.tanaka@chairman.jp
          </a>
          {' '}までお問い合わせください。
        </p>
      </Surface>
    </div>
  );
}

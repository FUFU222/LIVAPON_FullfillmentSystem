import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">審査状況</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-600">
        <PendingAccessStatus />
        <p>
          緊急のご要望や追加のご連絡が必要な場合は
          {' '}
          <a href="mailto:a.tanaka@chairman.jp" className="text-foreground underline">
            a.tanaka@chairman.jp
          </a>
          {' '}までお問い合わせください。
        </p>
      </CardContent>
    </Card>
  );
}

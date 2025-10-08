import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PendingStatusPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/pending');
  }

  if (auth.role === 'vendor' && auth.vendorId) {
    redirect('/orders');
  }

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">審査状況</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-600">
        <Alert>
          お申し込みありがとうございます。現在、運営チームが内容を確認しています。承認が完了するとベンダー向け機能が利用可能になります。利用開始まで今しばらくお待ちください。
        </Alert>
        <p>
          緊急のご要望や追加のご連絡が必要な場合は
          {' '}
          <a href="mailto:support@example.com" className="text-foreground underline">
            support@example.com
          </a>
          {' '}までお問い合わせください。
        </p>
      </CardContent>
    </Card>
  );
}

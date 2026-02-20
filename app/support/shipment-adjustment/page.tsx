import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getAuthContext, assertAuthorizedVendor } from '@/lib/auth';
import { getVendorProfile } from '@/lib/data/vendors';
import { ShipmentAdjustmentForm } from '@/components/support/shipment-adjustment-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { getServerComponentClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '発送修正申請 | LIVAPON 配送管理コンソール',
  description: '発送済みの内容を修正する際の管理者申請フォーム'
};

export default async function ShipmentAdjustmentPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent('/support/shipment-adjustment')}`);
  }

  if (auth.role === 'pending_vendor' && auth.vendorId === null) {
    redirect('/pending');
  }

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  if (auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent('/support/shipment-adjustment')}`);
  }

  assertAuthorizedVendor(auth.vendorId);

  const vendorProfile = await getVendorProfile(auth.vendorId).catch((error) => {
    console.error('Failed to fetch vendor profile for shipment adjustment page', error);
    return null;
  });

  const supabase = await getServerComponentClient();
  const { data: historyRows } = await supabase
    .from('shipment_adjustment_requests')
    .select(
      `id, status, issue_summary, desired_change, order_number, resolution_summary, created_at, updated_at,
       shipment_adjustment_comments:shipment_adjustment_comments(id, body, author_role, visibility, created_at)`
    )
    .eq('vendor_id', auth.vendorId)
    .order('created_at', { ascending: false });

  const history = (historyRows ?? []).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status ?? 'pending',
    issueSummary: row.issue_summary,
    desiredChange: row.desired_change,
    resolutionSummary: row.resolution_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: (row.shipment_adjustment_comments ?? []).filter(
      (comment) => (comment.visibility ?? 'vendor').toLowerCase() !== 'internal'
    )
  }));

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    try {
      return format(new Date(value), 'yyyy/MM/dd HH:mm', { locale: ja });
    } catch (error) {
      console.warn('Failed to format date', error);
      return value ?? '-';
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <div className="space-y-2">
        <p className="text-base font-semibold text-foreground sm:text-lg">発送修正申請</p>
        <p className="text-sm text-slate-500">
          発送済みの注文内容を変更する際は下記フォームから管理者に依頼してください。Console 上での直接取消はできません。
        </p>
      </div>
      <ShipmentAdjustmentForm
        defaultContactName={vendorProfile?.contactName ?? auth.user.user_metadata?.contact_name ?? ''}
        defaultContactEmail={vendorProfile?.contactEmail ?? auth.user.email}
        defaultContactPhone={vendorProfile?.contactPhone ?? null}
        vendorName={vendorProfile?.name ?? undefined}
      />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">申請履歴</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {history.length === 0 ? (
            <Alert variant="default">まだ申請履歴はありません。</Alert>
          ) : (
            <div className="grid gap-4">
              {history.map((request) => (
                <div key={request.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                    <span className="font-medium text-foreground">
                      注文 {request.orderNumber}
                    </span>
                    <span>最終更新: {formatDate(request.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500">ステータス: {request.status}</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div>
                      <p className="font-medium">申請内容</p>
                      <p className="whitespace-pre-wrap text-slate-600">{request.issueSummary}</p>
                    </div>
                    <div>
                      <p className="font-medium">希望する対応</p>
                      <p className="whitespace-pre-wrap text-slate-600">{request.desiredChange}</p>
                    </div>
                    {request.resolutionSummary ? (
                      <div className="text-emerald-700">
                        <p className="font-medium">処置内容</p>
                        <p className="whitespace-pre-wrap">{request.resolutionSummary}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-sm font-semibold text-foreground">管理者からのコメント</p>
                    {request.comments.length === 0 ? (
                      <p className="text-sm text-slate-500">コメントはまだありません。</p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        {request.comments.map((comment) => (
                          <div key={comment.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>{comment.author_role ?? 'admin'}</span>
                              <span>{formatDate(comment.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-slate-700">{comment.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

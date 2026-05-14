import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-shell';
import { StatusBadge } from '@/components/orders/status-badge';
import { ShipmentAdjustmentStatusBadge } from '@/components/support/shipment-adjustment-status-badge';
import { getAdminOperationalStatus, type AdminOperationalStatus } from '@/lib/data/admin-operational-status';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getRecentOrdersForAdmin } from '@/lib/data/orders';
import { formatDateTimeInJst } from '@/lib/date-time';
import {
  listShipmentAdjustmentRequestsForAdmin,
  type AdminShipmentAdjustmentRequest,
  type ShipmentAdjustmentStatus
} from '@/lib/data/shipment-adjustments';
import {
  getPendingVendorApplications,
  getRecentVendors,
  type VendorListEntry,
  type VendorApplication
} from '@/lib/data/vendors';

const ACTIVE_SHIPMENT_REQUEST_STATUSES: ShipmentAdjustmentStatus[] = [
  'pending',
  'in_review',
  'needs_info'
];
const RESOLVED_SHIPMENT_REQUEST_STATUSES: ShipmentAdjustmentStatus[] = ['resolved'];

function toDisplayDate(value: string | null): string {
  return formatDateTimeInJst(value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export default async function AdminDashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/admin');
  }

  if (!isAdmin(auth)) {
    redirect('/orders');
  }

  const [pendingResult, ordersResult, vendorsResult] = await Promise.allSettled([
    getPendingVendorApplications(),
    getRecentOrdersForAdmin(5),
    getRecentVendors(5)
  ]);
  const [shipmentRequestsResult, resolvedShipmentRequestsResult, operationalStatusResult] = await Promise.allSettled([
    listShipmentAdjustmentRequestsForAdmin({
      statuses: ACTIVE_SHIPMENT_REQUEST_STATUSES,
      limit: 3
    }),
    listShipmentAdjustmentRequestsForAdmin({
      statuses: RESOLVED_SHIPMENT_REQUEST_STATUSES,
      limit: 3
    }),
    getAdminOperationalStatus()
  ]);

  const pendingApplications: VendorApplication[] =
    pendingResult.status === 'fulfilled' ? pendingResult.value : [];
  const recentOrders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
  const recentVendors: VendorListEntry[] =
    vendorsResult.status === 'fulfilled' ? vendorsResult.value : [];
  const activeShipmentRequests: AdminShipmentAdjustmentRequest[] =
    shipmentRequestsResult.status === 'fulfilled' ? shipmentRequestsResult.value : [];
  const recentResolvedShipmentRequests: AdminShipmentAdjustmentRequest[] =
    resolvedShipmentRequestsResult.status === 'fulfilled' ? resolvedShipmentRequestsResult.value : [];
  const operationalStatus: AdminOperationalStatus | null =
    operationalStatusResult.status === 'fulfilled' ? operationalStatusResult.value : null;

  const pendingError = pendingResult.status === 'rejected';
  const ordersError = ordersResult.status === 'rejected';
  const vendorsError = vendorsResult.status === 'rejected';
  const shipmentRequestsError =
    shipmentRequestsResult.status === 'rejected' ||
    resolvedShipmentRequestsResult.status === 'rejected';
  const operationalStatusError = operationalStatusResult.status === 'rejected';

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Admin"
        title="管理ダッシュボード"
        description="対応が必要な申請・発送修正・連携状態を確認できます。通常時は静かに、異常時だけ目立つように整理しています。"
        actions={
          <>
            <Link href="/admin/orders" className={buttonClasses('outline', 'text-sm')}>
              注文を確認
            </Link>
            <Link href="/admin/applications" className={buttonClasses('default', 'text-sm')}>
              利用開始依頼
            </Link>
          </>
        }
      />
      <OperationalStatusPanel status={operationalStatus} hasError={operationalStatusError} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">利用開始依頼</CardTitle>
              <p className="text-sm text-slate-500">利用開始依頼の最新状況</p>
            </div>
            <Badge className="border-slate-200 text-slate-600">{pendingApplications.length} 件</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pendingError ? (
              <Alert variant="destructive">対応待ちの依頼を取得できませんでした。</Alert>
            ) : pendingApplications.length === 0 ? (
              <Alert variant="success">現在、対応待ちの依頼はありません。</Alert>
            ) : (
              <ul className="grid gap-2">
                {pendingApplications.slice(0, 3).map((application) => (
                  <li key={application.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{application.companyName}</span>
                    <p className="text-xs text-slate-500">{application.contactEmail}</p>
                    <p className="text-xs text-slate-400">依頼日時: {toDisplayDate(application.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/admin/applications" className={buttonClasses('outline', 'text-sm')}>
              依頼一覧へ
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">最近の注文</CardTitle>
              <p className="text-sm text-slate-500">最新 5 件の注文状況</p>
            </div>
            <Badge className="border-slate-200 text-slate-600">{recentOrders.length} 件</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ordersError ? (
              <Alert variant="destructive">注文情報を取得できませんでした。</Alert>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-slate-500">表示できる注文がありません。</p>
            ) : (
              <ul className="grid gap-2">
                {recentOrders.map((order) => (
                  <li key={order.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm font-medium text-foreground">
                        <span>{order.orderNumber}</span>
                        <StatusBadge status={order.status ?? 'unfulfilled'} />
                      </div>
                      <p className="text-xs text-slate-500">セラー: {order.vendorName ?? '未割当'}</p>
                      <p className="text-xs text-slate-400">更新日時: {toDisplayDate(order.updatedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/admin/orders" className={buttonClasses('outline', 'text-sm')}>
              注文一覧へ
            </Link>
          </CardFooter>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">最近登録されたセラー</CardTitle>
            </div>
            <Badge className="border-slate-200 text-slate-600">{recentVendors.length} 件</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {vendorsError ? (
              <Alert variant="destructive">セラー情報を取得できませんでした。</Alert>
            ) : recentVendors.length === 0 ? (
              <p className="text-sm text-slate-500">表示できるセラーがありません。</p>
            ) : (
              <ul className="grid gap-2">
                {recentVendors.map((vendor) => (
                  <li key={vendor.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>{vendor.name}</span>
                      <span className="text-xs text-slate-500">{vendor.code ?? '----'}</span>
                    </div>
                    <p className="text-xs text-slate-500">{vendor.contactEmail ?? 'メール未登録'}</p>
                    <p className="text-xs text-slate-400">登録日時: {toDisplayDate(vendor.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/admin/vendors" className={buttonClasses('outline', 'text-sm')}>
              セラー一覧へ
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">発送修正依頼</CardTitle>
              <p className="text-sm text-slate-500">対応中と最近完了した依頼</p>
            </div>
            <Badge className="border-slate-200 text-slate-600">履歴</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            {shipmentRequestsError ? (
              <Alert variant="destructive">発送修正依頼を取得できませんでした。</Alert>
            ) : (
              <>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">対応中</p>
                  </div>
                  {activeShipmentRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">対応中の申請はありません。</p>
                  ) : (
                    <ul className="grid gap-2">
                      {activeShipmentRequests.map((request) => (
                        <li key={request.id} className="rounded-md border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{request.orderNumber}</span>
                            <ShipmentAdjustmentStatusBadge status={request.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {request.vendorName ?? `セラー #${request.vendorId}`}
                          </p>
                          <p className="text-xs text-slate-400">更新日時: {toDisplayDate(request.updatedAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">最近完了</p>
                  {recentResolvedShipmentRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">完了済みの履歴はまだありません。</p>
                  ) : (
                    <ul className="grid gap-2">
                      {recentResolvedShipmentRequests.map((request) => (
                        <li key={request.id} className="rounded-md border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{request.orderNumber}</span>
                            <ShipmentAdjustmentStatusBadge status={request.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {request.vendorName ?? `セラー #${request.vendorId}`}
                          </p>
                          <p className="text-xs text-slate-400">更新日時: {toDisplayDate(request.updatedAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/admin/shipment-requests" className={buttonClasses('outline', 'text-sm')}>
              依頼一覧へ
            </Link>
          </CardFooter>
        </Card>
        </div>
      </div>
    </div>
  );
}

function OperationalStatusPanel({
  status,
  hasError
}: {
  status: AdminOperationalStatus | null;
  hasError: boolean;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">運用ステータス</h2>
          <p className="mt-1 text-sm text-slate-500">
            注文・発送データの取り込みと Shopify 連携の状態です。
          </p>
        </div>
        <Badge className="w-fit border-slate-200 bg-slate-50 text-slate-600">自動連携</Badge>
      </div>

      {hasError || !status ? (
        <Alert variant="destructive">運用ステータスを取得できませんでした。</Alert>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <OperationalStatusItem
            label="未反映のデータ"
            value={`${status.pendingDataCount} 件`}
            description={
              status.pendingDataCount > 0
                ? '注文・発送の更新がまだ処理待ちです。通常は数分以内に反映されます。'
                : '現在、処理待ちの注文・発送データはありません。'
            }
            tone={status.pendingDataCount > 0 ? 'warning' : 'ok'}
          />
          <OperationalStatusItem
            label="確認が必要な連携エラー"
            value={`${status.failedSyncCount} 件`}
            description={
              status.failedSyncCount > 0
                ? '自動反映に失敗した処理があります。発送情報や Shopify 連携を確認してください。'
                : '確認が必要な連携エラーはありません。'
            }
            tone={status.failedSyncCount > 0 ? 'danger' : 'ok'}
          />
          <OperationalStatusItem
            label="Shopify反映の遅れ"
            value={status.delayedShopifyUpdateCount > 0 ? `${status.delayedShopifyUpdateCount} 件` : 'なし'}
            description={
              status.delayedShopifyUpdateCount > 0
                ? `Shopify からの更新が通常より遅れています。最長 ${formatDelay(status.oldestShopifyUpdateAgeMinutes)} 経過しています。`
                : 'Shopify からの更新は通常の範囲で反映されています。'
            }
            tone={status.delayedShopifyUpdateCount > 0 ? 'warning' : 'ok'}
          />
        </div>
      )}
    </section>
  );
}

function OperationalStatusItem({
  label,
  value,
  description,
  tone
}: {
  label: string;
  value: string;
  description: string;
  tone: 'ok' | 'warning' | 'danger';
}) {
  const styles = {
    ok: {
      border: 'border-emerald-200',
      background: 'bg-emerald-50/60',
      dot: 'bg-emerald-500',
      value: 'text-emerald-700'
    },
    warning: {
      border: 'border-amber-200',
      background: 'bg-amber-50/70',
      dot: 'bg-amber-500',
      value: 'text-amber-700'
    },
    danger: {
      border: 'border-rose-200',
      background: 'bg-rose-50/70',
      dot: 'bg-rose-600',
      value: 'text-rose-700'
    }
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${styles.border} ${styles.background}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      </div>
      <p className={`mt-3 text-2xl font-semibold tracking-normal ${styles.value}`}>{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
    </div>
  );
}

function formatDelay(minutes: number | null): string {
  if (minutes === null) {
    return '15分以上';
  }

  if (minutes < 60) {
    return `${minutes}分`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes === 0 ? `${hours}時間` : `${hours}時間${restMinutes}分`;
}

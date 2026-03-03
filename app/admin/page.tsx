import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/orders/status-badge';
import { ShipmentAdjustmentStatusBadge } from '@/components/support/shipment-adjustment-status-badge';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getRecentOrdersForAdmin } from '@/lib/data/orders';
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
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
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
  const [shipmentRequestsResult, resolvedShipmentRequestsResult] = await Promise.allSettled([
    listShipmentAdjustmentRequestsForAdmin({
      statuses: ACTIVE_SHIPMENT_REQUEST_STATUSES,
      limit: 3
    }),
    listShipmentAdjustmentRequestsForAdmin({
      statuses: RESOLVED_SHIPMENT_REQUEST_STATUSES,
      limit: 3
    })
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

  const pendingError = pendingResult.status === 'rejected';
  const ordersError = ordersResult.status === 'rejected';
  const vendorsError = vendorsResult.status === 'rejected';
  const shipmentRequestsError =
    shipmentRequestsResult.status === 'rejected' ||
    resolvedShipmentRequestsResult.status === 'rejected';

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">審査待ち申請</CardTitle>
              <p className="text-sm text-slate-500">セラー申請の最新状況</p>
            </div>
            <Badge className="border-slate-200 text-slate-600">{pendingApplications.length} 件</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pendingError ? (
              <Alert variant="destructive">審査待ちの申請を取得できませんでした。</Alert>
            ) : pendingApplications.length === 0 ? (
              <Alert variant="success">現在、審査待ちの申請はありません。</Alert>
            ) : (
              <ul className="grid gap-2">
                {pendingApplications.slice(0, 3).map((application) => (
                  <li key={application.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{application.companyName}</span>
                    <p className="text-xs text-slate-500">{application.contactEmail}</p>
                    <p className="text-xs text-slate-400">申請日時: {toDisplayDate(application.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/admin/applications" className={buttonClasses('outline', 'text-sm')}>
              申請一覧へ
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
              <CardTitle className="text-xl">発送修正申請</CardTitle>
              <p className="text-sm text-slate-500">対応中と最近完了した申請</p>
            </div>
            <Badge className="border-slate-200 text-slate-600">履歴</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            {shipmentRequestsError ? (
              <Alert variant="destructive">発送修正申請を取得できませんでした。</Alert>
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
              申請履歴と更新へ
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

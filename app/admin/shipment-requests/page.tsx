import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { getAuthContext, isAdmin } from '@/lib/auth';
import {
  listShipmentAdjustmentRequestsForAdmin,
  SHIPMENT_ADJUSTMENT_STATUSES
} from '@/lib/data/shipment-adjustments';
import { ShipmentAdjustmentRequestCard } from '@/components/admin/shipment-adjustment-request-card';

const ACTIVE_STATUSES = ['pending', 'in_review', 'needs_info'] as const;
const RESOLVED_STATUS = ['resolved'] as const;

export default async function AdminShipmentRequestsPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/admin/shipment-requests');
  }

  if (!isAdmin(auth)) {
    redirect('/orders');
  }

  const [activeRequests, resolvedRequests] = await Promise.all([
    listShipmentAdjustmentRequestsForAdmin({ statuses: ACTIVE_STATUSES, limit: 50 }),
    listShipmentAdjustmentRequestsForAdmin({ statuses: RESOLVED_STATUS, limit: 10 })
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">発送修正申請 — 対応中</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {activeRequests.length === 0 ? (
            <Alert variant="success">未対応の申請はありません。</Alert>
          ) : (
            activeRequests.map((request) => (
              <ShipmentAdjustmentRequestCard key={request.id} request={request} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">最近完了した申請</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {resolvedRequests.length === 0 ? (
            <p className="text-sm text-slate-500">完了済みの申請はまだありません。</p>
          ) : (
            resolvedRequests.map((request) => (
              <ShipmentAdjustmentRequestCard key={request.id} request={request} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { PageHeader, Surface } from '@/components/ui/page-shell';
import { getAuthContext, isAdmin } from '@/lib/auth';
import {
  listShipmentAdjustmentRequestsForAdmin,
  type ShipmentAdjustmentStatus
} from '@/lib/data/shipment-adjustments';
import { ShipmentAdjustmentRequestCard } from '@/components/admin/shipment-adjustment-request-card';

const ACTIVE_STATUSES: ShipmentAdjustmentStatus[] = ['pending', 'in_review', 'needs_info'];
const RESOLVED_STATUS: ShipmentAdjustmentStatus[] = ['resolved'];

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
      <PageHeader
        eyebrow="Admin"
        title="発送修正依頼"
        description="発送済みデータの修正依頼を確認し、必要な対応内容とセラーへの返信を管理します。"
      />
      <Surface className="grid gap-4 p-3 sm:p-4">
        <SectionTitle title="対応中" description="確認・返信・反映が必要な修正依頼です。" />
        <div className="grid gap-4">
          {activeRequests.length === 0 ? (
            <Alert variant="success">未対応の依頼はありません。</Alert>
          ) : (
            activeRequests.map((request) => (
              <ShipmentAdjustmentRequestCard key={request.id} request={request} />
            ))
          )}
        </div>
      </Surface>

      <Surface className="grid gap-4 p-3 sm:p-4">
        <SectionTitle title="最近完了した依頼" description="直近で解決済みにした修正依頼です。" />
        <div className="grid gap-4">
          {resolvedRequests.length === 0 ? (
            <p className="text-sm text-slate-500">完了済みの依頼はまだありません。</p>
          ) : (
            resolvedRequests.map((request) => (
              <ShipmentAdjustmentRequestCard key={request.id} request={request} />
            ))
          )}
        </div>
      </Surface>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

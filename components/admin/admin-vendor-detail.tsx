import { Badge } from '@/components/ui/badge';
import type { VendorDetail } from '@/lib/data/vendors';

const statusLabelMap: Record<VendorDetail['applications'][number]['status'], string> = {
  approved: '承認済み',
  pending: '審査中',
  rejected: '却下'
};

const statusBadgeClasses: Record<VendorDetail['applications'][number]['status'], string> = {
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
  rejected: 'border-red-300 bg-red-50 text-red-600'
};

function formatDateTime(value: string | null) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

type Props = {
  vendor: VendorDetail;
};

export function AdminVendorDetail({ vendor }: Props) {
  const applications = vendor.applications ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-foreground">{vendor.name}</span>
            <span className="text-sm text-slate-500">コード: {vendor.code ?? '----'}</span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-slate-600 sm:items-end">
            {vendor.contactEmail ? <span>{vendor.contactEmail}</span> : null}
            {vendor.contactPhone ? <span>{vendor.contactPhone}</span> : null}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-y-3">
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">登録日</dt>
            <dd className="text-slate-700">{formatDateTime(vendor.createdAt)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">関連注文</dt>
            <dd className="text-slate-700">{vendor.summary.orderCount.toLocaleString('ja-JP')}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">発送件数</dt>
            <dd className="text-slate-700">{vendor.summary.shipmentCount.toLocaleString('ja-JP')}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">SKU 登録数</dt>
            <dd className="text-slate-700">{vendor.summary.skuCount.toLocaleString('ja-JP')}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-foreground">申請履歴</h3>
        {applications.length === 0 ? (
          <p className="text-sm text-slate-500">紐づく申請履歴はありません。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {applications.map((application) => (
              <div
                key={application.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">
                      {application.companyName}
                    </span>
                    <span className="text-xs text-slate-500">
                      申請ID: {application.id} / 申請日: {formatDate(application.createdAt)}
                    </span>
                  </div>
                  <Badge className={statusBadgeClasses[application.status]}>
                    {statusLabelMap[application.status]}
                  </Badge>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-y-3">
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">担当者</dt>
                    <dd className="text-slate-700">{application.contactName ?? '-'}</dd>
                  </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">メール</dt>
            <dd className="text-slate-700">{application.contactEmail}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">電話</dt>
            <dd className="text-slate-700">{application.contactPhone ?? '-'}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">審査担当</dt>
            <dd className="text-slate-700">{application.reviewerEmail ?? '-'}</dd>
          </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">審査日時</dt>
                    <dd className="text-slate-700">{formatDateTime(application.reviewedAt)}</dd>
                  </div>
                </dl>

                {application.message ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">メッセージ</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {application.message}
                    </p>
                  </div>
                ) : null}

                {application.notes ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">審査メモ</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {application.notes}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

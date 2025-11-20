'use client';

import { useFormState } from 'react-dom';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import type { AdminShipmentAdjustmentRequest, ShipmentAdjustmentComment } from '@/lib/data/shipment-adjustments';
import { SHIPMENT_ADJUSTMENT_STATUSES } from '@/lib/data/shipment-adjustments';
import {
  handleShipmentAdjustmentAdminAction,
  INITIAL_SHIPMENT_ADJUSTMENT_ADMIN_STATE
} from '@/app/admin/shipment-requests/actions';

function formatDate(value: string | null) {
  if (!value) return '-';
  try {
    return format(new Date(value), 'yyyy/MM/dd HH:mm', { locale: ja });
  } catch (error) {
    console.warn('Failed to format date', error);
    return value ?? '-';
  }
}

const statusLabels: Record<string, string> = {
  pending: '未対応',
  in_review: '対応中',
  needs_info: '要追加情報',
  resolved: '完了'
};

const statusBadgeClasses: Record<string, string> = {
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
  in_review: 'border-amber-200 bg-amber-50 text-amber-700',
  needs_info: 'border-red-200 bg-red-50 text-red-600',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700'
};

function CommentsTimeline({ comments }: { comments: ShipmentAdjustmentComment[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-slate-500">コメントはまだありません。</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{comment.authorName ?? comment.authorRole ?? 'Admin'}</span>
            <span>{formatDate(comment.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
          {comment.visibility === 'internal' ? (
            <span className="mt-1 inline-flex text-xs text-amber-700">※内部メモ</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ShipmentAdjustmentRequestCard({
  request
}: {
  request: AdminShipmentAdjustmentRequest;
}) {
  const [state, formAction] = useFormState(
    handleShipmentAdjustmentAdminAction,
    INITIAL_SHIPMENT_ADJUSTMENT_ADMIN_STATE
  );

  const currentStatus = request.status ?? 'pending';

  return (
    <Card className="grid gap-4 border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-foreground">
              {request.vendorName ?? `ベンダー #${request.vendorId}`}
            </span>
            <span className="text-sm text-slate-500">
              コード: {request.vendorCode ?? '----'} / 注文: {request.orderNumber}
            </span>
          </div>
          <Badge className={statusBadgeClasses[currentStatus] ?? statusBadgeClasses.pending}>
            {statusLabels[currentStatus] ?? currentStatus}
          </Badge>
        </div>
        <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
          <span>連絡先: {request.contactName ?? '-'} / {request.contactEmail ?? '-'}</span>
          <span>電話: {request.contactPhone ?? request.vendorPhone ?? '-'}</span>
          <span>トラッキング: {request.trackingNumber ?? '-'}</span>
          <span>申請日時: {formatDate(request.createdAt)}</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
        <h4 className="text-sm font-semibold text-foreground">内容</h4>
        <dl className="text-sm text-slate-700">
          <dt className="font-medium">発生状況</dt>
          <dd className="mb-2 whitespace-pre-wrap text-slate-600">{request.issueSummary}</dd>
          <dt className="font-medium">希望する対応</dt>
          <dd className="mb-2 whitespace-pre-wrap text-slate-600">{request.desiredChange}</dd>
          <dt className="font-medium">対象ラインアイテム</dt>
          <dd className="whitespace-pre-wrap text-slate-600">{request.lineItemContext ?? '-'}</dd>
          {request.resolutionSummary ? (
            <>
              <dt className="mt-2 font-medium text-emerald-700">処置内容</dt>
              <dd className="whitespace-pre-wrap text-slate-700">{request.resolutionSummary}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="grid gap-3">
        <h4 className="text-sm font-semibold text-foreground">コメント</h4>
        <CommentsTimeline comments={request.comments} />
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h4 className="text-sm font-semibold text-foreground">更新 / 返信</h4>
        {state.status === 'error' && state.message ? (
          <Alert variant="destructive">{state.message}</Alert>
        ) : null}
        {state.status === 'success' && state.message ? (
          <Alert variant="success">{state.message}</Alert>
        ) : null}
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="requestId" value={request.id} />
          <Textarea
            name="commentBody"
            placeholder="ベンダーへの返信内容や処置メモを入力"
            rows={3}
          />
          <div className="grid gap-2 text-sm text-slate-600">
            <label className="font-medium">コメント表示範囲</label>
            <select name="visibility" className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="vendor">ベンダーに共有</option>
              <option value="internal">内部メモ</option>
            </select>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <label className="font-medium">ステータス</label>
            <select
              name="nextStatus"
              defaultValue={currentStatus}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {SHIPMENT_ADJUSTMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <label className="font-medium">処置内容 (完了時)</label>
            <Textarea
              name="resolutionSummary"
              rows={2}
              placeholder="完了時の処置や連絡事項を記載"
              defaultValue={request.resolutionSummary ?? ''}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">更新する</Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

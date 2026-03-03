import { Badge } from '@/components/ui/badge';

const statusLabels: Record<string, string> = {
  pending: '受付済み',
  in_review: '確認中',
  needs_info: '追加情報が必要',
  resolved: '対応完了'
};

const statusBadgeClasses: Record<string, string> = {
  pending: 'border-sky-200 bg-sky-50 text-sky-700',
  in_review: 'border-amber-200 bg-amber-50 text-amber-700',
  needs_info: 'border-rose-200 bg-rose-50 text-rose-700',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700'
};

export function ShipmentAdjustmentStatusBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase().trim() ?? 'pending';
  return (
    <Badge className={statusBadgeClasses[normalized] ?? statusBadgeClasses.pending}>
      {statusLabels[normalized] ?? statusLabels.pending}
    </Badge>
  );
}

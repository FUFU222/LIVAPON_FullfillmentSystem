import { Badge } from '@/components/ui/badge';

export const statusLabel: Record<string, string> = {
  unfulfilled: '未発送',
  partially_fulfilled: '一部発送済',
  fulfilled: '発送済',
  cancelled: 'キャンセル済',
  restocked: '在庫戻し済み',
  on_hold: '保留中'
};

const statusAliasMap: Record<string, string> = {
  partial: 'partially_fulfilled',
  partially: 'partially_fulfilled',
  partially_fulfilled: 'partially_fulfilled',
  partiallyfulfilled: 'partially_fulfilled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  open: 'unfulfilled'
};

function normalizeStatus(status: string | null): string {
  if (!status) {
    return 'unfulfilled';
  }

  const normalized = status.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return statusAliasMap[normalized] ?? normalized;
}

export function StatusBadge({ status }: { status: string | null }) {
  const normalized = normalizeStatus(status);
  return <Badge intent={normalized}>{statusLabel[normalized] ?? (status ?? '未設定')}</Badge>;
}

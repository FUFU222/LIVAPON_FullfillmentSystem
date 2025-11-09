import { Badge } from '@/components/ui/badge';

const statusLabel: Record<string, string> = {
  unfulfilled: '未発送',
  partially_fulfilled: '一部発送済',
  fulfilled: '発送済',
  cancelled: 'キャンセル済',
  restocked: '再入荷済'
};

export function StatusBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase() ?? 'unfulfilled';
  return <Badge intent={normalized}>{statusLabel[normalized] ?? normalized}</Badge>;
}

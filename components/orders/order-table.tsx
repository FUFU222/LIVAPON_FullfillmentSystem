import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { buttonClasses } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/orders/status-badge';
import type { OrderSummary } from '@/lib/data/orders';

function formatDate(date: string | null) {
  if (!date) {
    return '-';
  }
  try {
    return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja });
  } catch (error) {
    console.warn('Failed to format date', error);
    return date;
  }
}

export function OrderTable({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        表示する注文がありません。
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>注文番号</TableHead>
          <TableHead>顧客名</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>追跡番号</TableHead>
          <TableHead>注文日時</TableHead>
          <TableHead>アクション</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.orderNumber}</TableCell>
            <TableCell>{order.customerName ?? '-'}</TableCell>
            <TableCell>
              <StatusBadge status={order.status} />
            </TableCell>
            <TableCell>
              {order.trackingNumbers.length > 0
                ? order.trackingNumbers.join(', ')
                : '-'}
            </TableCell>
            <TableCell>{formatDate(order.createdAt)}</TableCell>
            <TableCell>
              <Link href={`/orders/${order.id}`} className={buttonClasses('outline')}>
                詳細
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

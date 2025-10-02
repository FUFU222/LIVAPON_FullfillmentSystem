import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/orders/status-badge';
import { OrderStatusController } from '@/components/orders/order-status-controller';
import { ShipmentManager } from '@/components/orders/shipment-manager';
import { getOrderDetail } from '@/lib/data/orders';
import { getAuthContext } from '@/lib/auth';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const orderId = Number(params.id);

  if (Number.isNaN(orderId)) {
    notFound();
  }

  const redirectTarget = `/orders/${params.id}`;
  const auth = await getAuthContext();

  if (!auth || auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  const order = await getOrderDetail(auth.vendorId, orderId);

  if (!order) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/orders" className="hover:text-foreground">
          ← 注文一覧に戻る
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-semibold">{order.orderNumber}</CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span>顧客: {order.customerName ?? '-'}</span>
            <StatusBadge status={order.status} />
            <OrderStatusController orderId={order.id} currentStatus={order.status ?? 'unfulfilled'} />
          </div>
        </CardHeader>
        <CardContent className="gap-6">
          <ShipmentManager orderId={order.id} lineItems={order.lineItems} shipments={order.shipments} />
        </CardContent>
      </Card>
    </div>
  );
}

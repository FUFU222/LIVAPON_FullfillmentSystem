import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/orders/status-badge';
import { ShipmentEditor } from '@/components/orders/shipment-editor';
import { OrderStatusController } from '@/components/orders/order-status-controller';
import { getOrderDetail } from '@/lib/data/orders';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const orderId = Number(params.id);

  if (Number.isNaN(orderId)) {
    notFound();
  }

  const order = await getOrderDetail(orderId);

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
          <div className="flex flex-col gap-6">
            {order.lineItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-medium text-foreground">{item.productName}</p>
                    <p className="text-sm text-slate-500">
                      数量: {item.quantity} / 発送済: {item.fulfilledQuantity ?? 0}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <ShipmentEditor orderId={order.id} lineItem={item} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

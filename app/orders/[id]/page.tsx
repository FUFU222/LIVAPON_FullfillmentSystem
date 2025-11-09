import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  if (!auth) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  if (auth.role === 'pending_vendor') {
    redirect('/pending');
  }

  if (auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(redirectTarget)}`);
  }

  const order = await getOrderDetail(auth.vendorId, orderId);

  if (!order) {
    notFound();
  }

  const shippingParts = [
    order.shippingPostal ? `〒${order.shippingPostal}` : null,
    order.shippingPrefecture,
    order.shippingCity,
    order.shippingAddress1,
    order.shippingAddress2
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  const shippingAddress = shippingParts.length > 0 ? shippingParts.join(' ') : '住所情報が未登録です';

  const isArchived = Boolean(order.archivedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/orders" className="hover:text-foreground">
          ← 注文一覧に戻る
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl font-semibold">{order.orderNumber}</CardTitle>
            {isArchived ? (
              <Badge className="bg-slate-200 text-slate-700">アーカイブ済み</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span>顧客: {order.customerName ?? '-'}</span>
            <span>配送先: {shippingAddress}</span>
          </div>
        </CardHeader>
        <CardContent className="gap-6">
          <ShipmentManager orderId={order.id} lineItems={order.lineItems} isArchived={isArchived} />
        </CardContent>
      </Card>
    </div>
  );
}

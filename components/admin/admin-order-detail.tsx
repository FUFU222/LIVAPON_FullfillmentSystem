import { Badge } from '@/components/ui/badge';
import type { OrderDetail } from '@/lib/data/orders';

type Props = {
  order: OrderDetail;
};

function formatDate(value: string | null) {
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

export function AdminOrderDetail({ order }: Props) {
  const uniqueShipments = order.shipments;
  const lineItemLookup = new Map<number, { name: string; sku: string | null }>();

  order.lineItems.forEach((item) => {
    lineItemLookup.set(item.id, { name: item.productName, sku: item.sku });
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-foreground">{order.orderNumber}</span>
          <Badge intent={order.status}>{order.status ?? '未設定'}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-y-3">
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">顧客名</dt>
            <dd className="text-slate-700">{order.customerName ?? '-'}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">最終更新</dt>
            <dd className="text-slate-700">{formatDate(order.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-foreground">商品ライン</h3>
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">商品名</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">ベンダー</th>
                <th className="px-3 py-2">数量</th>
                <th className="px-3 py-2">発送</th>
              </tr>
            </thead>
            <tbody>
              {order.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                  <td className="px-3 py-2 font-medium text-foreground">{item.productName}</td>
                  <td className="px-3 py-2">{item.sku ?? '未設定'}</td>
                  <td className="px-3 py-2">
                    {item.vendorName ? (
                      <div className="flex flex-col">
                        <span>{item.vendorName}</span>
                        <span className="text-xs text-slate-500">{item.vendorCode ?? '----'}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">未割当</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col text-sm">
                      <span>注文: {item.quantity}</span>
                      <span>発送済: {item.shippedQuantity}</span>
                      <span>残数: {item.remainingQuantity}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {item.shipments.length === 0 ? (
                      <span className="text-slate-400">未発送</span>
                    ) : (
                      <ul className="flex flex-col gap-1 text-xs text-slate-600">
                        {item.shipments.map((shipment) => (
                          <li key={`${shipment.id}-${shipment.trackingNumber ?? 'pending'}`}>
                            {shipment.trackingNumber ?? '追跡未登録'}
                            <span className="ml-2">({shipment.quantity ?? item.quantity}個)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {uniqueShipments.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold text-foreground">発送履歴</h3>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">追跡番号</th>
                  <th className="px-3 py-2">配送業者</th>
                  <th className="px-3 py-2">発送日時</th>
                  <th className="px-3 py-2">対象ライン</th>
                </tr>
              </thead>
              <tbody>
                {uniqueShipments.map((shipment) => (
                  <tr key={shipment.id} className="border-b border-slate-100 text-slate-700">
                    <td className="px-3 py-2">{shipment.trackingNumber ?? '追跡未登録'}</td>
                    <td className="px-3 py-2">{shipment.carrier ?? '-'}</td>
                    <td className="px-3 py-2">{formatDate(shipment.shippedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {shipment.lineItemIds.map((lineItemId) => {
                          const info = lineItemLookup.get(lineItemId);
                          return (
                            <span
                              key={lineItemId}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                            >
                              <span>#{lineItemId}</span>
                              {info ? (
                                <span className="text-slate-500">
                                  {info.name}
                                  {info.sku ? ` (${info.sku})` : ''}
                                </span>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

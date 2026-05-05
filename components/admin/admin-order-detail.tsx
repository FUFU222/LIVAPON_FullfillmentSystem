'use client';

import { useState, useTransition } from 'react';
import { StatusBadge } from '@/components/orders/status-badge';
import { formatOrderDateTime } from '@/lib/orders/date-time';
import type { OrderDetail } from '@/lib/data/orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  linkShopifyFulfillmentAction,
  markShipmentManualResolvedAction,
  resyncShipmentByAdminAction,
  type AdminShipmentSyncActionResult
} from '@/app/admin/orders/actions';

type Props = {
  order: OrderDetail;
  onOrderUpdated?: () => void;
};

function formatShippingAddress(order: OrderDetail): string {
  const lines: string[] = [];
  if (order.shippingPostal) {
    lines.push(`〒${order.shippingPostal}`);
  }

  const baseLine = [order.shippingPrefecture, order.shippingCity, order.shippingAddress1]
    .filter((part) => (part ?? '').trim().length > 0)
    .join(' ')
    .trim();

  if (baseLine.length > 0) {
    lines.push(baseLine);
  }

  if (order.shippingAddress2 && order.shippingAddress2.trim().length > 0) {
    lines.push(order.shippingAddress2.trim());
  }

  return lines.length > 0 ? lines.join(' ') : '-';
}

export function AdminOrderDetail({ order, onOrderUpdated }: Props) {
  const [isPending, startTransition] = useTransition();
  const [pendingShipmentId, setPendingShipmentId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<AdminShipmentSyncActionResult | null>(null);
  const [fulfillmentInputs, setFulfillmentInputs] = useState<Record<number, string>>({});
  const uniqueShipments = order.shipments;
  const lineItemLookup = new Map<number, { name: string; sku: string | null }>();

  order.lineItems.forEach((item) => {
    lineItemLookup.set(item.id, { name: item.productName, sku: item.sku });
  });

  const runShipmentAction = (
    shipmentId: number,
    action: () => Promise<AdminShipmentSyncActionResult>
  ) => {
    setPendingShipmentId(shipmentId);
    setActionMessage(null);
    startTransition(() => {
      void action()
        .then((result) => {
          setActionMessage(result);
          if (result.status === 'success') {
            onOrderUpdated?.();
          }
        })
        .catch((error) => {
          console.error('Failed to run shipment admin action', error);
          setActionMessage({
            status: 'error',
            message: error instanceof Error ? error.message : '操作に失敗しました。'
          });
        })
        .finally(() => {
          setPendingShipmentId(null);
        });
    });
  };

  const handleFulfillmentInputChange = (shipmentId: number, value: string) => {
    setFulfillmentInputs((prev) => ({
      ...prev,
      [shipmentId]: value
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
        </div>
        <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-y-3">
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">顧客名</dt>
            <dd className="text-slate-700">{order.customerName ?? '-'}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-wide text-slate-500">最終更新</dt>
            <dd className="text-slate-700">{formatOrderDateTime(order.updatedAt)}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">配送先住所</dt>
            <dd className="text-slate-700">{formatShippingAddress(order)}</dd>
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
                <th className="px-3 py-2">セラー</th>
                <th className="px-3 py-2">数量</th>
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
                  <td className="px-3 py-2">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {uniqueShipments.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold text-foreground">発送履歴</h3>
          {actionMessage ? (
            <Alert variant={actionMessage.status === 'success' ? 'success' : 'destructive'}>
              {actionMessage.message}
            </Alert>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">追跡番号</th>
                  <th className="px-3 py-2">配送業者</th>
                  <th className="px-3 py-2">発送日時</th>
                  <th className="px-3 py-2">対象ライン</th>
                  <th className="px-3 py-2">Shopify同期</th>
                  <th className="px-3 py-2">管理操作</th>
                </tr>
              </thead>
              <tbody>
                {uniqueShipments.map((shipment) => {
                  const latestEvent = shipment.syncEvents[0] ?? null;
                  const canOperate = shipment.syncStatus === 'pending' || shipment.syncStatus === 'error';
                  const isThisPending = isPending && pendingShipmentId === shipment.id;
                  return (
                    <tr key={shipment.id} className="border-b border-slate-100 align-top text-slate-700">
                      <td className="px-3 py-2">{shipment.trackingNumber ?? '追跡未登録'}</td>
                      <td className="px-3 py-2">{shipment.carrier ?? '-'}</td>
                      <td className="px-3 py-2">{formatOrderDateTime(shipment.shippedAt)}</td>
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
                      <td className="px-3 py-2">
                        <div className="grid gap-1">
                          <SyncStatusBadge status={shipment.syncStatus} />
                          {shipment.shopifyFulfillmentId ? (
                            <span className="font-mono text-xs text-slate-500">
                              Fulfillment ID: {shipment.shopifyFulfillmentId}
                            </span>
                          ) : null}
                          {shipment.syncError ? (
                            <span className="max-w-xs text-xs text-red-600">{shipment.syncError}</span>
                          ) : null}
                          {latestEvent ? (
                            <span className="text-xs text-slate-500">
                              最新: {shipmentEventLabel(latestEvent.eventType)} / {formatOrderDateTime(latestEvent.createdAt)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="grid min-w-[12rem] gap-2">
                          {canOperate ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="px-3 py-1 text-xs"
                                disabled={isThisPending}
                                onClick={() => runShipmentAction(
                                  shipment.id,
                                  () => resyncShipmentByAdminAction(shipment.id)
                                )}
                              >
                                再同期
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="px-3 py-1 text-xs"
                                disabled={isThisPending}
                                onClick={() => runShipmentAction(
                                  shipment.id,
                                  () => markShipmentManualResolvedAction(shipment.id)
                                )}
                              >
                                手動対応済み
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">追加操作なし</span>
                          )}
                          {!shipment.shopifyFulfillmentId ? (
                            <div className="flex min-w-[14rem] gap-2">
                              <Input
                                value={fulfillmentInputs[shipment.id] ?? ''}
                                onChange={(event) => handleFulfillmentInputChange(shipment.id, event.target.value)}
                                placeholder="Fulfillment ID"
                                className="h-8 text-xs"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="px-3 py-1 text-xs"
                                disabled={isThisPending || !(fulfillmentInputs[shipment.id] ?? '').trim()}
                                onClick={() => runShipmentAction(
                                  shipment.id,
                                  () => linkShopifyFulfillmentAction(
                                    shipment.id,
                                    (fulfillmentInputs[shipment.id] ?? '').trim()
                                  )
                                )}
                              >
                                紐付け
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string | null }) {
  const normalized = status ?? 'pending';
  const className = (() => {
    switch (normalized) {
      case 'synced':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'processing':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'manual_resolved':
        return 'border-slate-300 bg-slate-100 text-slate-700';
      default:
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }
  })();

  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-medium ${className}`}>
      {syncStatusLabel(normalized)}
    </span>
  );
}

function syncStatusLabel(status: string) {
  switch (status) {
    case 'synced':
      return '同期済み';
    case 'error':
      return '要確認';
    case 'processing':
      return '同期中';
    case 'manual_resolved':
      return '手動対応済み';
    default:
      return '同期待ち';
  }
}

function shipmentEventLabel(eventType: string) {
  switch (eventType) {
    case 'registered':
      return '登録';
    case 'sync_started':
      return '同期開始';
    case 'sync_succeeded':
      return '同期成功';
    case 'sync_failed':
      return '同期失敗';
    case 'resync_requested':
      return '再同期依頼';
    case 'manual_resolved':
      return '手動対応済み';
    case 'shopify_fulfillment_linked':
      return 'ID紐付け';
    default:
      return eventType;
  }
}

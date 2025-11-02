"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OrderLineItemSummary, OrderSummary } from "@/lib/data/orders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/orders/status-badge";
import { cn } from "@/lib/utils";
import { OrdersDispatchPanel } from "@/components/orders/orders-dispatch-panel";

function formatUpdatedAt(date: string | null) {
  if (!date) {
    return "-";
  }
  try {
    return format(new Date(date), "yyyy/MM/dd HH:mm", { locale: ja });
  } catch (error) {
    console.warn("Failed to format date", error);
    return date;
  }
}

function computeRemainingQuantity(lineItem: OrderLineItemSummary): number {
  const shippedQuantity = lineItem.shipments.reduce((total, shipment) => {
    return total + (shipment.quantity ?? 0);
  }, 0);

  if (typeof lineItem.fulfillableQuantity === "number") {
    return Math.max(lineItem.fulfillableQuantity, 0);
  }

  return Math.max(lineItem.quantity - shippedQuantity, 0);
}

type SelectedLineItem = {
  lineItemId: number;
  orderId: number;
  orderNumber: string;
  productName: string;
  sku: string | null;
  availableQuantity: number;
  quantity: number;
};

export function OrdersDispatchTable({ orders }: { orders: OrderSummary[] }) {
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [selectedLineItems, setSelectedLineItems] = useState<Map<number, SelectedLineItem>>(new Map());

  useEffect(() => {
    setSelectedLineItems((prev) => {
      const next = new Map<number, SelectedLineItem>();
      prev.forEach((value, key) => {
        const order = orders.find((o) => o.id === value.orderId);
        const lineItem = order?.lineItems.find((item) => item.id === key);
        if (!order || !lineItem) {
          return;
        }
        const remaining = computeRemainingQuantity(lineItem);
        if (remaining <= 0) {
          return;
        }
        next.set(key, {
          ...value,
          availableQuantity: remaining,
          quantity: Math.min(value.quantity, remaining)
        });
      });
      return next;
    });
  }, [orders]);

  const toggleExpanded = useCallback((orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLineItems(new Map());
  }, []);

  const removeLineItemSelection = useCallback((lineItemId: number) => {
    setSelectedLineItems((prev) => {
      if (!prev.has(lineItemId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(lineItemId);
      return next;
    });
  }, []);

  const upsertLineItemSelection = useCallback(
    (order: OrderSummary, lineItem: OrderLineItemSummary) => {
      const remaining = computeRemainingQuantity(lineItem);
      if (remaining <= 0) {
        return;
      }
      setSelectedLineItems((prev) => {
        const next = new Map(prev);
        next.set(lineItem.id, {
          lineItemId: lineItem.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          productName: lineItem.productName,
          sku: lineItem.sku,
          availableQuantity: remaining,
          quantity: Math.min(remaining, next.get(lineItem.id)?.quantity ?? remaining)
        });
        return next;
      });
    },
    []
  );

  const toggleLineItemSelection = useCallback(
    (order: OrderSummary, lineItem: OrderLineItemSummary) => {
      setSelectedLineItems((prev) => {
        const next = new Map(prev);
        if (next.has(lineItem.id)) {
          next.delete(lineItem.id);
          return next;
        }

        const remaining = computeRemainingQuantity(lineItem);
        if (remaining <= 0) {
          return prev;
        }

        next.set(lineItem.id, {
          lineItemId: lineItem.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          productName: lineItem.productName,
          sku: lineItem.sku,
          availableQuantity: remaining,
          quantity: remaining
        });
        return next;
      });
    },
    []
  );

  const toggleOrderSelection = useCallback(
    (order: OrderSummary, checked: boolean) => {
      setSelectedLineItems((prev) => {
        const next = new Map(prev);
        const selectableItems = order.lineItems.filter((item) => computeRemainingQuantity(item) > 0);

        if (checked) {
          selectableItems.forEach((item) => {
            const remaining = computeRemainingQuantity(item);
            next.set(item.id, {
              lineItemId: item.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              productName: item.productName,
              sku: item.sku,
              availableQuantity: remaining,
              quantity: remaining
            });
          });
        } else {
          selectableItems.forEach((item) => {
            next.delete(item.id);
          });
        }

        return next;
      });
    },
    []
  );

  const handleQuantityUpdate = useCallback((lineItemId: number, quantity: number) => {
    setSelectedLineItems((prev) => {
      const existing = prev.get(lineItemId);
      if (!existing) {
        return prev;
      }
      const safeQuantity = Math.max(1, Math.min(existing.availableQuantity, quantity));
      if (safeQuantity === existing.quantity) {
        return prev;
      }
      const next = new Map(prev);
      next.set(lineItemId, {
        ...existing,
        quantity: safeQuantity
      });
      return next;
    });
  }, []);

  const selectedItems = useMemo(() => Array.from(selectedLineItems.values()), [selectedLineItems]);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">選択</TableHead>
            <TableHead>注文番号</TableHead>
            <TableHead>顧客名</TableHead>
            <TableHead>配送先住所</TableHead>
            <TableHead>商品数</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>更新日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const selectableItems = order.lineItems.filter((item) => computeRemainingQuantity(item) > 0);
            const selectedCount = selectableItems.filter((item) => selectedLineItems.has(item.id)).length;
            const allSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;

            return (
              <>
                <TableRow key={`order-${order.id}`} className="align-top">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-200 p-1 text-slate-600 transition hover:bg-slate-100"
                        onClick={() => toggleExpanded(order.id)}
                        aria-label={isExpanded ? '明細を閉じる' : '明細を開く'}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <input
                        type="checkbox"
                        aria-label={`${order.orderNumber} を選択`}
                        checked={allSelected}
                        onChange={(event) => toggleOrderSelection(order, event.target.checked)}
                        disabled={selectableItems.length === 0}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName ?? '-'} </TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-pre-line">
                    {order.shippingAddressLines.length > 0 ? order.shippingAddressLines.join('\n') : '住所情報が未登録です'}
                  </TableCell>
                  <TableCell>{order.lineItemCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>{formatUpdatedAt(order.updatedAt)}</TableCell>
                </TableRow>

                {isExpanded ? (
                  <TableRow key={`order-${order.id}-items`} className="bg-slate-50">
                    <td colSpan={7} className="bg-slate-50 p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wide text-slate-500">
                            <th className="w-16 px-4 py-2 text-left">選択</th>
                            <th className="px-4 py-2 text-left">商品名</th>
                            <th className="px-4 py-2 text-left">SKU</th>
                            <th className="px-4 py-2 text-left">注文数</th>
                            <th className="px-4 py-2 text-left">発送済み</th>
                            <th className="px-4 py-2 text-left">残数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.lineItems.map((lineItem) => {
                            const remaining = computeRemainingQuantity(lineItem);
                            const isSelected = selectedLineItems.has(lineItem.id);
                            return (
                              <tr key={lineItem.id} className="border-t border-slate-200">
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`${lineItem.productName} を選択`}
                                    checked={isSelected}
                                    disabled={remaining <= 0}
                                    onChange={() => toggleLineItemSelection(order, lineItem)}
                                  />
                                </td>
                                <td className="px-4 py-2 text-slate-700">{lineItem.productName}</td>
                                <td className="px-4 py-2 text-xs text-slate-500">{lineItem.sku ?? '-'}</td>
                                <td className="px-4 py-2">{lineItem.quantity}</td>
                                <td className="px-4 py-2">{lineItem.fulfilledQuantity ?? 0}</td>
                                <td className="px-4 py-2 text-slate-600">
                                  {remaining > 0 ? remaining : '0 (発送済み)'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </TableRow>
                ) : null}
              </>
            );
          })}
        </TableBody>
      </Table>

      <OrdersDispatchPanel
        orders={orders}
        selectedLineItems={selectedItems}
        onClearSelection={clearSelection}
        onRemoveLineItem={removeLineItemSelection}
        onUpdateQuantity={handleQuantityUpdate}
      />
    </>
  );
}

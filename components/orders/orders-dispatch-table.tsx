"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { OrderLineItemSummary, OrderSummary } from "@/lib/data/orders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/orders/status-badge";
import { cn } from "@/lib/utils";
import { OrdersDispatchPanel } from "@/components/orders/orders-dispatch-panel";
import { Badge } from "@/components/ui/badge";
import { SelectedLineItem } from "@/components/orders/types";
import { formatDateTimeInJst } from "@/lib/date-time";

const ORDER_ROW_HEAD = "px-2 py-2 text-[11px] tracking-normal sm:px-3";
const ORDER_ROW_CELL = "px-2 py-2 align-middle sm:px-3";
const ORDER_ROW_CELL_MUTED =
  "px-2 py-2 align-middle text-xs leading-snug text-slate-600 whitespace-pre-line break-words sm:px-3 sm:text-sm";
const LINE_ITEM_HEAD = "px-3 py-1.5 text-xs font-medium text-slate-500";
const LINE_ITEM_CELL = "px-3 py-1.5 text-xs";
const LINE_ITEM_PRODUCT = "px-3 py-1.5 text-xs text-slate-700";

function getShippedQuantity(lineItem: OrderLineItemSummary): number {
  if (typeof lineItem.shippedQuantity === "number") {
    return Math.max(0, lineItem.shippedQuantity);
  }
  return Math.max(0, lineItem.shipments.reduce((total, shipment) => total + (shipment.quantity ?? 0), 0));
}

function getRemainingQuantity(lineItem: OrderLineItemSummary): number {
  if (typeof lineItem.remainingQuantity === "number") {
    return Math.max(lineItem.remainingQuantity, 0);
  }
  if (typeof lineItem.fulfillableQuantity === "number") {
    return Math.max(lineItem.fulfillableQuantity, 0);
  }
  return Math.max(lineItem.quantity - getShippedQuantity(lineItem), 0);
}

function getLineItemStatus(
  lineItem: OrderLineItemSummary,
  orderStatus: string | null
): 'fulfilled' | 'partially_fulfilled' | 'unfulfilled' | 'cancelled' | 'on_hold' {
  const orderNormalized = (orderStatus ?? '').toLowerCase();
  if (orderNormalized === 'cancelled') {
    return 'cancelled';
  }

  const remaining = getRemainingQuantity(lineItem);
  const shipped = getShippedQuantity(lineItem);
  const fulfilled = lineItem.fulfilledQuantity ?? shipped;

  if (remaining <= 0) {
    return 'fulfilled';
  }

  const shopifyFulfillable =
    typeof lineItem.fulfillableQuantity === 'number' ? lineItem.fulfillableQuantity : null;
  const shopifyFulfilled = typeof lineItem.fulfilledQuantity === 'number' ? lineItem.fulfilledQuantity : null;

  const isOnHold =
    remaining > 0 && shopifyFulfillable === 0 && (shopifyFulfilled ?? 0) === 0 && orderNormalized !== 'fulfilled';

  if (isOnHold) {
    return 'on_hold';
  }

  if (fulfilled > 0 || shipped > 0) {
    return 'partially_fulfilled';
  }

  return 'unfulfilled';
}

function getOrderDisplayStatus(order: OrderSummary): string {
  const normalized = (order.status ?? order.localStatus ?? 'unfulfilled').toLowerCase();

  if (normalized === 'cancelled' || normalized === 'restocked') {
    return normalized;
  }

  const relevantLineItems = order.lineItems;
  if (relevantLineItems.length === 0) {
    return normalized || 'unfulfilled';
  }

  const lineStatuses = relevantLineItems.map((lineItem) => {
    const remaining = getRemainingQuantity(lineItem);
    const shipped = getShippedQuantity(lineItem);
    return { remaining, shipped };
  });

  const fullyShipped = lineStatuses.every((status) => status.remaining <= 0);
  if (fullyShipped) {
    return 'fulfilled';
  }

  const partiallyShipped = lineStatuses.some((status) => status.shipped > 0);
  if (partiallyShipped) {
    return 'partially_fulfilled';
  }

  if (normalized === 'on_hold') {
    return 'on_hold';
  }

  return 'unfulfilled';
}

export function OrdersDispatchTable({ orders, vendorId }: { orders: OrderSummary[]; vendorId: number }) {
  const filteredOrders = useMemo(() =>
    orders.map((order) => ({
      ...order,
      lineItems: order.lineItems.filter((item) => item.vendorId === vendorId)
    })),
  [orders, vendorId]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [selectedLineItems, setSelectedLineItems] = useState<Map<number, SelectedLineItem>>(new Map());

  useEffect(() => {
    setSelectedLineItems((prev) => {
      const next = new Map<number, SelectedLineItem>();
      prev.forEach((value, key) => {
        const order = filteredOrders.find((o) => o.id === value.orderId);
        const lineItem = order?.lineItems.find((item) => item.id === key);
        if (!order || order.isArchived || !lineItem) {
          return;
        }
        const remaining = getRemainingQuantity(lineItem);
        if (remaining <= 0) {
          return;
        }
        const shipped = getShippedQuantity(lineItem);
        next.set(key, {
          ...value,
          sku: lineItem.sku,
          variantTitle: lineItem.variantTitle,
          totalOrdered: lineItem.quantity,
          shippedQuantity: shipped,
          availableQuantity: remaining,
          quantity: Math.min(value.quantity, remaining)
        });
      });
      return next;
    });
  }, [filteredOrders]);

  const toggleExpanded = useCallback((orderId: number) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
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
      const remaining = getRemainingQuantity(lineItem);
      if (remaining <= 0) {
        return;
      }
      const shipped = getShippedQuantity(lineItem);
      setSelectedLineItems((prev) => {
        const next = new Map(prev);
        next.set(lineItem.id, {
          lineItemId: lineItem.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          productName: lineItem.productName,
          sku: lineItem.sku,
          variantTitle: lineItem.variantTitle,
          totalOrdered: lineItem.quantity,
          shippedQuantity: shipped,
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
      if (order.isArchived) {
        return;
      }
      setSelectedLineItems((prev) => {
        const next = new Map(prev);
        if (next.has(lineItem.id)) {
          next.delete(lineItem.id);
          return next;
        }

        const remaining = getRemainingQuantity(lineItem);
        if (remaining <= 0) {
          return prev;
        }
        const shipped = getShippedQuantity(lineItem);

        next.set(lineItem.id, {
          lineItemId: lineItem.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          productName: lineItem.productName,
          sku: lineItem.sku,
          variantTitle: lineItem.variantTitle,
          totalOrdered: lineItem.quantity,
          shippedQuantity: shipped,
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
      if (order.isArchived) {
        return;
      }
      setSelectedLineItems((prev) => {
        const next = new Map(prev);
        const selectableItems = order.lineItems.filter((item) => getRemainingQuantity(item) > 0);

        if (checked) {
          selectableItems.forEach((item) => {
            const remaining = getRemainingQuantity(item);
            next.set(item.id, {
              lineItemId: item.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              productName: item.productName,
              sku: item.sku,
              variantTitle: item.variantTitle,
              totalOrdered: item.quantity,
              shippedQuantity: getShippedQuantity(item),
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
  const removeOrderSelection = useCallback((orderId: number) => {
    setSelectedLineItems((prev) => {
      const next = new Map(prev);
      prev.forEach((value, key) => {
        if (value.orderId === orderId) {
          next.delete(key);
        }
      });
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <div aria-label="モバイル注文一覧" className="grid gap-3 md:hidden">
        {filteredOrders.map((order) => {
          const displayOrderStatus = getOrderDisplayStatus(order);
          const isExpanded = expandedOrderId === order.id;
          const selectableItems = order.isArchived
            ? []
            : order.lineItems.filter((item) => getRemainingQuantity(item) > 0);
          const selectedCount = selectableItems.filter((item) => selectedLineItems.has(item.id)).length;
          const allSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;
          const orderDisabled = order.isArchived;
          const address = order.shippingAddressLines.length > 0
            ? order.shippingAddressLines.join(' ')
            : '住所情報が未登録です';

          return (
            <article
              key={order.id}
              className={cn(
                "rounded-md border border-slate-200 bg-white p-3 shadow-sm",
                isExpanded && "border-slate-300",
                orderDisabled && "bg-slate-50"
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`${order.orderNumber} を選択`}
                  checked={allSelected}
                  onChange={(event) => toggleOrderSelection(order, event.target.checked)}
                  disabled={selectableItems.length === 0 || orderDisabled}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <button
                  type="button"
                  className="grid min-w-0 flex-1 gap-2 text-left"
                  onClick={() => toggleExpanded(order.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="flex min-w-0 items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block break-words text-base font-semibold text-slate-900">
                        {order.orderNumber}
                      </span>
                      <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        発送可能 {selectableItems.length}件
                      </span>
                    </span>
                    <StatusBadge status={displayOrderStatus} />
                  </span>
                  <span className="break-words text-sm leading-relaxed text-slate-600">
                    {address}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isExpanded ? '商品を閉じる' : 'タップして商品を確認'}
                  </span>
                </button>
              </div>

              {orderDisabled ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  この注文は Shopify でアーカイブ済みのため、新しい発送登録はできません。
                </div>
              ) : null}

              {isExpanded ? (
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
                  {order.lineItems.map((lineItem) => {
                    const remaining = getRemainingQuantity(lineItem);
                    const status = getLineItemStatus(lineItem, displayOrderStatus);
                    const isSelected = selectedLineItems.has(lineItem.id);

                    return (
                      <div
                        key={lineItem.id}
                        className={cn(
                          "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-slate-200 p-3",
                          isSelected && "border-slate-900 bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          aria-label={`${lineItem.productName} を選択`}
                          checked={isSelected}
                          disabled={remaining <= 0 || orderDisabled}
                          onChange={() => toggleLineItemSelection(order, lineItem)}
                          className="mt-1 h-5 w-5"
                        />
                        <div className="grid min-w-0 gap-2">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900">
                                {lineItem.productName}
                              </p>
                              {lineItem.variantTitle ? (
                                <p className="mt-0.5 break-words text-xs text-slate-500">
                                  {lineItem.variantTitle}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-sm text-slate-600">× {lineItem.quantity}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={status} />
                            <span className="text-xs text-slate-500">残り {remaining}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div data-testid="orders-dispatch-desktop" className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <Table className="min-w-[620px] md:min-w-[700px] xl:min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead className={cn("w-14", ORDER_ROW_HEAD)}>選択</TableHead>
            <TableHead className={cn("w-28", ORDER_ROW_HEAD)}>注文番号</TableHead>
            <TableHead className={cn(ORDER_ROW_HEAD, "hidden xl:table-cell")}>顧客名</TableHead>
            <TableHead className={cn("w-[18rem] md:w-[20rem]", ORDER_ROW_HEAD)}>配送先住所</TableHead>
            <TableHead className={cn("w-28", ORDER_ROW_HEAD)}>ステータス</TableHead>
            <TableHead className={cn(ORDER_ROW_HEAD, "hidden xl:table-cell")}>注文日時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => {
            const displayOrderStatus = getOrderDisplayStatus(order);
            const isExpanded = expandedOrderId === order.id;
            const selectableItems = order.isArchived
              ? []
              : order.lineItems.filter((item) => getRemainingQuantity(item) > 0);
            const selectedCount = selectableItems.filter((item) => selectedLineItems.has(item.id)).length;
            const allSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;
            const orderDisabled = order.isArchived;

            return (
              <Fragment key={order.id}>
              <TableRow
                className={cn(
                  "relative align-top cursor-pointer transition-colors duration-200",
                  isExpanded && "bg-slate-50/60",
                  orderDisabled && "bg-slate-50/70"
                )}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('input,button,select,a')) {
                    return;
                  }
                  toggleExpanded(order.id);
                }}
              >
                <TableCell className={ORDER_ROW_CELL}>
                  <input
                    type="checkbox"
                    aria-label={`${order.orderNumber} を選択`}
                    checked={allSelected}
                    onChange={(event) => toggleOrderSelection(order, event.target.checked)}
                    disabled={selectableItems.length === 0 || orderDisabled}
                    onClick={(event) => event.stopPropagation()}
                    className="h-4 w-4 sm:h-5 sm:w-5"
                  />
                </TableCell>
                <TableCell className={cn("font-semibold text-slate-900", ORDER_ROW_CELL)}>
                  {order.orderNumber}
                  {orderDisabled ? (
                    <Badge className="ml-2 bg-slate-200 text-slate-700">アーカイブ済み</Badge>
                  ) : null}
                </TableCell>
                <TableCell className={cn(ORDER_ROW_CELL, "hidden text-sm font-medium text-slate-900 xl:table-cell")}>
                  {order.customerName ?? '-'}
                </TableCell>
                <TableCell className={ORDER_ROW_CELL_MUTED}>
                  {order.shippingAddressLines.length > 0 ? (
                    <span className="whitespace-pre-line text-slate-700">{order.shippingAddressLines.join('\n')}</span>
                  ) : (
                    '住所情報が未登録です'
                  )}
                </TableCell>
                <TableCell className={ORDER_ROW_CELL}>
                  <StatusBadge status={displayOrderStatus} />
                </TableCell>
                <TableCell className={cn(ORDER_ROW_CELL, "hidden xl:table-cell")}>{formatDateTimeInJst(order.createdAt)}</TableCell>
              </TableRow>

                <TableRow className="bg-slate-50">
                  <td colSpan={6} className="bg-slate-50 p-0">
                    <div
                      className={cn(
                        "overflow-hidden border-t border-slate-200 transition-[max-height] duration-300 ease-in-out",
                        isExpanded ? "max-h-[600px]" : "max-h-0"
                      )}
                    >
                      <div
                        className={cn(
                          "mx-3 mt-2 rounded-md border border-slate-200 bg-white/95 shadow-sm transition-opacity duration-200",
                          isExpanded ? "opacity-100" : "opacity-0"
                        )}
                      >
                        {order.isArchived ? (
                          <div className="border-b border-slate-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                            この注文は Shopify でアーカイブ済みのため、新しい発送登録はできません。
                          </div>
                        ) : null}
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                              <th className={cn("w-16 text-left", LINE_ITEM_HEAD)}>選択</th>
                              <th className={cn("text-left", LINE_ITEM_HEAD)}>商品 × 数量</th>
                              <th className={cn("text-left", LINE_ITEM_HEAD)}>状態</th>
                            </tr>
                          </thead>
                          <tbody>
                          {order.lineItems.map((lineItem) => {
                            const remaining = getRemainingQuantity(lineItem);
                            const status = getLineItemStatus(lineItem, displayOrderStatus);
                            const isSelected = selectedLineItems.has(lineItem.id);
                            return (
                              <tr
                                key={lineItem.id}
                                className={cn(
                                  "border-t border-slate-200 transition-colors duration-200",
                                  isSelected && "bg-white"
                                )}
                              >
                                <td className={LINE_ITEM_CELL}>
                                  <input
                                    type="checkbox"
                                    aria-label={`${lineItem.productName} を選択`}
                                    checked={isSelected}
                                    disabled={remaining <= 0 || orderDisabled}
                                    onChange={(event) => {
                                      event.stopPropagation();
                                      toggleLineItemSelection(order, lineItem);
                                    }}
                                    className="h-4 w-4 sm:h-5 sm:w-5"
                                  />
                                </td>
                                <td className={LINE_ITEM_PRODUCT}>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-slate-800">
                                      {lineItem.productName}
                                      <span className="ml-2 text-sm font-normal text-slate-600">
                                        × {lineItem.quantity}
                                      </span>
                                    </span>
                                    {lineItem.variantTitle ? (
                                      <span className="text-[11px] text-slate-600">{lineItem.variantTitle}</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className={LINE_ITEM_CELL}>
                                  <StatusBadge status={status} />
                                </td>
                              </tr>
                            );
                          })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
        </Table>
      </div>

      <OrdersDispatchPanel
        orders={filteredOrders}
        selectedLineItems={selectedItems}
        onClearSelection={clearSelection}
        onRemoveLineItem={removeLineItemSelection}
        onUpdateQuantity={handleQuantityUpdate}
        onRemoveOrder={removeOrderSelection}
      />
    </div>
  );
}

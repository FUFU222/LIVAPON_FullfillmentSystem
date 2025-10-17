"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { OrderSummary } from "@/lib/data/orders";
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

export function OrdersDispatchTable({ orders }: { orders: OrderSummary[] }) {
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedOrders(new Set());
  }, [orders]);

  const toggleSelection = (orderId: number) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedOrders(new Set());
      return;
    }
    const next = new Set<number>();
    orders.forEach((order) => {
      next.add(order.id);
    });
    setSelectedOrders(next);
  };

  const allSelected = selectedOrders.size === orders.length && orders.length > 0;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                aria-label="全て選択"
                checked={allSelected}
                onChange={(event) => handleSelectAll(event.target.checked)}
              />
            </TableHead>
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
            const isSelected = selectedOrders.has(order.id);

            return (
              <TableRow
                key={order.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-slate-50",
                  isSelected && "bg-slate-50"
                )}
                onClick={() => toggleSelection(order.id)}
              >
                <TableCell className="align-middle">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(order.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`${order.orderNumber} を選択`}
                  />
                </TableCell>
                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                <TableCell>{order.customerName ?? "-"}</TableCell>
                <TableCell className="text-xs text-slate-500">
                  {order.shippingAddress ?? "住所情報は現在未連携です"}
                </TableCell>
                <TableCell>{order.lineItemCount}</TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>{formatUpdatedAt(order.updatedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <OrdersDispatchPanel
        orders={orders}
        selectedOrderIds={selectedOrders}
        onClearSelection={() => setSelectedOrders(new Set())}
        onRemoveOrder={(orderId) =>
          setSelectedOrders((prev) => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
          })
        }
      />
    </>
  );
}

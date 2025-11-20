"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ShipmentHistoryEntry } from "@/lib/data/orders";

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return format(new Date(value), "yyyy/MM/dd HH:mm", { locale: ja });
  } catch (error) {
    console.warn("Failed to format date", error);
    return value;
  }
}

export function ShipmentHistoryTable({
  shipments,
}: {
  shipments: ShipmentHistoryEntry[];
}) {
  if (shipments.length === 0) {
    return (
      <Alert variant="default" className="grid gap-2 text-sm">
        <span>登録済みの発送はまだありません。</span>
        <span>
          発送内容の修正や取り消しが必要な場合は管理者への申請が必要です。
          <Link
            href="/support/shipment-adjustment"
            className="ml-2 inline-flex items-center text-sky-600 underline-offset-2 hover:underline"
          >
            申請フォームを開く
          </Link>
        </span>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <table className="w-full table-auto text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">発送日時</th>
            <th className="px-3 py-2">注文番号</th>
            <th className="px-3 py-2">顧客</th>
            <th className="px-3 py-2">配送先</th>
            <th className="px-3 py-2">追跡番号</th>
            <th className="px-3 py-2">配送業者</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id} className="border-b border-slate-100 align-top">
              <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                {formatDate(shipment.shippedAt)}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-1">
                  {shipment.orderId ? (
                    <Link
                      href={`/orders/${shipment.orderId}`}
                      className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {shipment.orderNumber}
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-500">
                      {shipment.orderNumber}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-sm leading-relaxed">
                {shipment.customerName ?? <span className="text-slate-400">-</span>}
              </td>
              <td className="px-3 py-3 text-xs text-slate-600">
                {shipment.shippingAddress ? (
                  <span className="block whitespace-pre-line leading-relaxed">
                    {shipment.shippingAddress}
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-3 text-sm">
                {shipment.trackingNumber ?? "-"}
              </td>
              <td className="px-3 py-3 text-sm capitalize">
                {shipment.carrier ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

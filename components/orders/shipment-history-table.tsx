"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { cancelShipmentAction } from "@/app/orders/actions";
import type { ShipmentActionState } from "@/app/orders/actions";
import type { ShipmentHistoryEntry } from "@/lib/data/orders";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/orders/status-badge";

const INITIAL_STATE: ShipmentActionState = {
  status: "idle",
  message: null,
};

const CANCELLATION_REASONS = [
  { value: "customer_request", label: "顧客都合（再配送・キャンセル）" },
  { value: "address_issue", label: "住所不備・受取不可" },
  { value: "inventory_issue", label: "在庫調整・誤出荷" },
  { value: "label_error", label: "ラベル/伝票の不備" },
  { value: "other", label: "その他" },
];

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return format(new Date(value), "yyyy/MM/dd HH:mm", { locale: ja });
  } catch (error) {
    console.warn("Failed to format date", error);
    return value;
  }
}

function CancelShipmentForm({
  shipmentId,
  orderId,
}: {
  shipmentId: number;
  orderId: number | null;
}) {
  const [state, formAction] = useFormState(
    cancelShipmentAction,
    INITIAL_STATE,
  );
  const [reasonType, setReasonType] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      {orderId ? (
        <input type="hidden" name="orderId" value={orderId} />
      ) : null}
      <input type="hidden" name="redirectTo" value="/orders/shipments" />
      <label className="text-xs font-medium text-slate-500" htmlFor={`reason-${shipmentId}`}>
        取消理由
      </label>
      <select
        id={`reason-${shipmentId}`}
        name="reasonType"
        required
        value={reasonType}
        onChange={(event) => {
          setReasonType(event.target.value);
          if (event.target.value !== "other") {
            setOtherReason("");
          }
        }}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      >
        <option value="" disabled>
          選択してください
        </option>
        {CANCELLATION_REASONS.map((reason) => (
          <option key={reason.value} value={reason.value}>
            {reason.label}
          </option>
        ))}
      </select>
      {reasonType === "other" ? (
        <textarea
          name="reasonDetail"
          value={otherReason}
          onChange={(event) => setOtherReason(event.target.value)}
          required
          placeholder="理由を入力してください"
          className="min-h-[72px] rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
      ) : (
        <input type="hidden" name="reasonDetail" value="" />
      )}
      <CancelButton />
      {state.status === "error" && state.message ? (
        <span className="text-xs text-red-600">{state.message}</span>
      ) : null}
    </form>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="gap-2 text-xs"
    >
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>取消中…</span>
        </>
      ) : (
        "未発送に戻す"
      )}
    </Button>
  );
}

export function ShipmentHistoryTable({
  shipments,
}: {
  shipments: ShipmentHistoryEntry[];
}) {
  if (shipments.length === 0) {
    return (
      <Alert variant="default" className="text-sm">
        登録済みの発送はまだありません。
      </Alert>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">発送日時</th>
            <th className="px-3 py-2">注文番号</th>
            <th className="px-3 py-2">追跡番号</th>
            <th className="px-3 py-2">配送業者</th>
            <th className="px-3 py-2">同期状態</th>
            <th className="px-3 py-2">アクション</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id} className="border-b border-slate-100">
              <td className="px-3 py-3 text-xs text-slate-500">
                {formatDate(shipment.shippedAt)}
              </td>
              <td className="px-3 py-3">
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
                <div className="mt-1 text-xs text-slate-500">
                  <StatusBadge status={shipment.orderStatus} />
                </div>
              </td>
              <td className="px-3 py-3 text-sm">
                {shipment.trackingNumber ?? "-"}
              </td>
              <td className="px-3 py-3 text-sm">
                {shipment.carrier ?? "-"}
              </td>
              <td className="px-3 py-3 text-xs text-slate-500">
                {shipment.syncStatus ?? "-"}
              </td>
              <td className="px-3 py-3">
                {shipment.orderId ? (
                  <CancelShipmentForm
                    shipmentId={shipment.id}
                    orderId={shipment.orderId}
                  />
                ) : (
                  <span className="text-xs text-slate-400">
                    取消対象の注文が見つかりません
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

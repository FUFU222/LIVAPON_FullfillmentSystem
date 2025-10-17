"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveShipment,
  initialShipmentActionState,
  cancelShipmentAction,
} from "@/app/orders/actions";
import type {
  LineItemShipment,
  OrderDetail,
  OrderShipment,
} from "@/lib/data/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

const carrierOptions = [
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "japanpost", label: "日本郵便" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
];

const statusLabelMap: Record<string, string> = {
  shipped: "発送済み",
  in_transit: "輸送中",
  delivered: "配達済み",
  returned: "返品",
};

type ButtonProps = ComponentProps<typeof Button>;

function FormSubmitButton({
  pendingLabel = "処理中…",
  children,
  className,
  disabled,
  ...buttonProps
}: {
  pendingLabel?: string;
  children: ReactNode;
} & ButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled ?? pending;

  return (
    <Button
      {...buttonProps}
      type="submit"
      disabled={isDisabled}
      className={cn("gap-2", className)}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

type Props = {
  orderId: number;
  lineItems: OrderDetail["lineItems"];
  shipments: OrderDetail["shipments"];
};

type ShipmentUpdateProps = {
  orderId: number;
  shipment: OrderShipment;
  lineItems: Map<number, { productName: string; sku: string | null }>;
};

export function ShipmentManager({ orderId, lineItems, shipments }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [state, formAction] = useFormState(
    saveShipment,
    initialShipmentActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      setSelectedIds([]);
    }
  }, [state.status]);

  const lineItemMap = useMemo(
    () =>
      new Map(
        lineItems.map((item) => [
          item.id,
          {
            productName: item.productName,
            sku: item.sku,
          },
        ]),
      ),
    [lineItems],
  );

  const toggleSelection = (lineItemId: number) => {
    setSelectedIds((prev) =>
      prev.includes(lineItemId)
        ? prev.filter((id) => id !== lineItemId)
        : [...prev, lineItemId],
    );
  };

  const allSelected =
    selectedIds.length === lineItems.length && lineItems.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(lineItems.map((item) => item.id));
    }
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="全て選択"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2">商品名</th>
                <th className="px-3 py-2">数量</th>
                <th className="px-3 py-2">お届け先</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`${item.productName}を選択`}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {item.productName}
                      </span>
                      <span className="text-xs text-slate-500">#{item.id}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">{item.quantity}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    <AddressSummary shipments={item.shipments} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            配送を新規作成
          </h3>
          {state.status === "error" && state.message ? (
            <Alert variant="destructive" className="mb-4">
              {state.message}
            </Alert>
          ) : null}
          {state.status === "success" && state.message ? (
            <Alert variant="success" className="mb-4">
              {state.message}
            </Alert>
          ) : null}
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/orders/${orderId}`}
            />
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="lineItemIds" value={id} />
            ))}

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                追跡番号
              </label>
              <Input
                name="trackingNumber"
                placeholder="YT123456789JP"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                配送業者
              </label>
              <Select
                name="carrier"
                defaultValue={carrierOptions[0]?.value ?? ""}
                required
              >
                {carrierOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>選択中: {selectedIds.length}件</span>
              <FormSubmitButton
                pendingLabel="登録中…"
                disabled={selectedIds.length === 0}
              >
                選択した明細をまとめて発送登録
              </FormSubmitButton>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-4">
        <h3 className="text-sm font-semibold text-foreground">
          登録済みの発送
        </h3>
        {shipments.length === 0 ? (
          <p className="text-sm text-slate-500">
            登録済みの発送はありません。発送登録を行うとこちらに表示されます。
          </p>
        ) : (
          shipments.map((shipment) => (
            <ShipmentUpdateCard
              key={shipment.id}
              orderId={orderId}
              shipment={shipment}
              lineItems={lineItemMap}
            />
          ))
        )}
      </section>
    </div>
  );
}

function AddressSummary({ shipments }: { shipments: LineItemShipment[] }) {
  if (!shipments || shipments.length === 0) {
    return <span className="text-xs text-slate-400">住所情報なし</span>;
  }

  return (
    <span className="text-xs text-slate-400">住所情報は現在未連携です</span>
  );
}

function ShipmentUpdateCard({
  orderId,
  shipment,
  lineItems,
}: ShipmentUpdateProps) {
  const [state, formAction] = useFormState(
    saveShipment,
    initialShipmentActionState,
  );
  const [cancelState, cancelFormAction] = useFormState(
    cancelShipmentAction,
    initialShipmentActionState,
  );

  const linkedLineItems = shipment.lineItemIds
    .map((id) => ({ id, meta: lineItems.get(id) }))
    .filter((item) => item.meta !== undefined);

  const statusLabel =
    statusLabelMap[shipment.status ?? ""] ?? shipment.status ?? "-";

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            追跡番号: {shipment.trackingNumber ?? "-"}
          </span>
          <span className="text-xs text-slate-500">ID: {shipment.id}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span>配送業者: {shipment.carrier ?? "-"}</span>
          <span>ステータス: {statusLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-slate-500">
        <span className="font-medium text-foreground">対象の注文明細</span>
        {linkedLineItems.length === 0 ? (
          <span>該当なし</span>
        ) : (
          linkedLineItems.map(({ id, meta }) => (
            <span key={id}>
              #{id} {meta?.productName} ({meta?.sku ?? "SKUなし"})
            </span>
          ))
        )}
      </div>

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert variant="success">{state.message}</Alert>
      ) : null}
      {cancelState.status === "error" && cancelState.message ? (
        <Alert variant="destructive">{cancelState.message}</Alert>
      ) : null}
      {cancelState.status === "success" && cancelState.message ? (
        <Alert variant="success">{cancelState.message}</Alert>
      ) : null}

      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="shipmentId" value={shipment.id} />
        <input type="hidden" name="redirectTo" value={`/orders/${orderId}`} />
        {shipment.lineItemIds.map((id) => (
          <input key={id} type="hidden" name="lineItemIds" value={id} />
        ))}

        <div className="grid gap-2">
          <label className="text-xs font-medium text-foreground">
            追跡番号
          </label>
          <Input
            name="trackingNumber"
            defaultValue={shipment.trackingNumber ?? ""}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-foreground">
            配送業者
          </label>
          <Select
            name="carrier"
            defaultValue={shipment.carrier ?? carrierOptions[0]?.value ?? ""}
            required
          >
            {carrierOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <FormSubmitButton className="sm:order-2" pendingLabel="更新中…">
            更新
          </FormSubmitButton>
          <form action={cancelFormAction} className="sm:order-1">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/orders/${orderId}`}
            />
            <FormSubmitButton
              variant="outline"
              className="text-xs"
              pendingLabel="取消中…"
            >
              発送状態を未発送に戻す
            </FormSubmitButton>
          </form>
        </div>
      </form>
    </div>
  );
}

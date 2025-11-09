"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveShipment } from "@/app/orders/actions";
import type { ShipmentActionState } from "@/app/orders/actions";
import type { OrderDetail } from "@/lib/data/orders";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const carrierOptions = [
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "japanpost", label: "日本郵便" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
];

type ButtonProps = React.ComponentProps<typeof Button>;

const INITIAL_SHIPMENT_ACTION_STATE: ShipmentActionState = {
  status: "idle",
  message: null,
};

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
};

export function ShipmentManager({ orderId, lineItems }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [state, formAction] = useFormState(
    saveShipment,
    INITIAL_SHIPMENT_ACTION_STATE,
  );

  const selectableItems = useMemo(
    () =>
      lineItems.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        sku: item.sku,
      })),
    [lineItems],
  );

  useEffect(() => {
    if (state.status === "success") {
      setSelectedIds([]);
    }
  }, [state.status]);

  const toggleSelection = (lineItemId: number) => {
    setSelectedIds((prev) =>
      prev.includes(lineItemId)
        ? prev.filter((id) => id !== lineItemId)
        : [...prev, lineItemId],
    );
  };

  const allSelected =
    selectedIds.length === selectableItems.length && selectableItems.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableItems.map((item) => item.id));
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
              </tr>
            </thead>
            <tbody>
              {selectableItems.map((item) => (
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
                      <span className="text-xs text-slate-500">
                        SKU: {item.sku ?? "未設定"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          発送登録フロー
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

        <form action={formAction} className="grid gap-6">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="redirectTo" value={`/orders/${orderId}`} />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="lineItemIds" value={id} />
          ))}

          <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] text-slate-700">
                STEP 1
              </span>
              発送情報の入力
            </div>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">追跡番号</label>
                <Input name="trackingNumber" placeholder="YT123456789JP" required />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">配送業者</label>
                <Select name="carrier" defaultValue={carrierOptions[0]?.value ?? ''} required>
                  {carrierOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] text-slate-700">
                STEP 2
              </span>
              発送詳細の確認
            </div>
            {selectedIds.length === 0 ? (
              <p className="text-sm text-slate-500">発送対象の明細を上部から選択してください。</p>
            ) : (
              <div className="rounded-md border border-slate-200 bg-white">
                <table className="w-full table-auto text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">商品名</th>
                      <th className="px-3 py-2">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems
                      .filter((item) => selectedIds.includes(item.id))
                      .map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{item.productName}</span>
                              <span className="text-xs text-slate-500">SKU: {item.sku ?? '未設定'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">{item.quantity}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>発送対象: {selectedIds.length} 件</span>
              <FormSubmitButton pendingLabel="登録中…" disabled={selectedIds.length === 0}>
                この内容で発送登録する
              </FormSubmitButton>
            </div>
          </div>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          過去の発送履歴は「
          <Link href="/orders/shipments" className="text-foreground underline-offset-2 hover:underline">
            発送履歴一覧
          </Link>
          」から確認・取消できます。
        </p>
      </section>
    </div>
  );
}

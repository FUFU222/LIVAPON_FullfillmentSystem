"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import type { OrderSummary } from "@/lib/data/orders";
import { cn } from "@/lib/utils";

const carrierOptions = [
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "japanpost", label: "日本郵便" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
];

type Props = {
  orders: OrderSummary[];
  selectedOrderIds: Set<number>;
  onClearSelection: () => void;
  onRemoveOrder: (orderId: number) => void;
};

export function OrdersDispatchPanel({
  orders,
  selectedOrderIds,
  onClearSelection,
  onRemoveOrder,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.has(order.id)),
    [orders, selectedOrderIds],
  );

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState(carrierOptions[0]?.value ?? "");
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedOrders.length === 0) {
      setTrackingNumber("");
      setCarrier(carrierOptions[0]?.value ?? "");
      setSubmitting(false);
    }
  }, [selectedOrders.length]);

  if (selectedOrders.length === 0) {
    return null;
  }

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) {
      showToast({
        variant: "warning",
        title: "追跡番号を入力してください",
        description: "発送登録には追跡番号が必要です。",
        duration: 2500,
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/shopify/orders/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrders.map((order) => order.id),
          trackingNumber: trackingNumber.trim(),
          carrier,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json().catch(() => ({ error: "failed" }));
        throw new Error(
          error === "failed" ? "発送登録に失敗しました" : String(error ?? "不明なエラー")
        );
      }

      showToast({
        variant: "success",
        title: "発送を登録しました",
        description: `${selectedOrders.length}件の発送情報を Shopify と同期しました。`,
        duration: 2500,
      });

      onClearSelection();
      setTrackingNumber("");
      setCarrier(carrierOptions[0]?.value ?? "");
      router.refresh();
    } catch (error) {
      console.error("Failed to submit shipment", error);
      showToast({
        variant: "error",
        title: "発送登録に失敗しました",
        description:
          error instanceof Error ? error.message : "サーバーエラーが発生しました。",
        duration: 3000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="text-xs uppercase text-slate-400">選択中</span>
            <div className="flex flex-wrap gap-2">
              {selectedOrders.map((order) => (
                <span
                  key={order.id}
                  className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                >
                  {order.orderNumber}
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveOrder(order.id);
                    }}
                    aria-label={`${order.orderNumber} を選択から外す`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            onClick={onClearSelection}
          >
            <X className="h-3 w-3" aria-hidden="true" />
            選択をクリア
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div className="flex basis-full flex-col gap-1 sm:basis-2/3">
            <label className="text-xs font-medium text-foreground">追跡番号</label>
            <Input
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="YT123456789JP"
            />
          </div>
          <div className="flex flex-col gap-1 sm:basis-1/3">
            <label className="text-xs font-medium text-foreground">配送業者</label>
            <Select value={carrier} onChange={(event) => setCarrier(event.target.value)}>
              {carrierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              disabled={isSubmitting}
              className="gap-2"
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>送信中…</span>
                </>
              ) : (
                `${selectedOrders.length}件を発送登録`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

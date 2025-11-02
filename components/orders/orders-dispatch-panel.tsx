"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { OrderSummary } from "@/lib/data/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";

const carrierOptions = [
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "japanpost", label: "日本郵便" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" }
];

type SelectedLineItem = {
  lineItemId: number;
  orderId: number;
  orderNumber: string;
  productName: string;
  sku: string | null;
  variantTitle: string | null;
  orderedQuantity: number;
  fulfilledQuantity: number;
  availableQuantity: number;
  quantity: number;
};

type Props = {
  orders: OrderSummary[];
  selectedLineItems: SelectedLineItem[];
  onClearSelection: () => void;
  onRemoveLineItem: (lineItemId: number) => void;
  onUpdateQuantity: (lineItemId: number, quantity: number) => void;
  onRemoveOrder: (orderId: number) => void;
};

export function OrdersDispatchPanel({
  orders,
  selectedLineItems,
  onClearSelection,
  onRemoveLineItem,
  onUpdateQuantity,
  onRemoveOrder
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState(carrierOptions[0]?.value ?? "");
  const [isSubmitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const selectedByOrder = useMemo(() => {
    const map = new Map<number, { order: OrderSummary; items: SelectedLineItem[] }>();
    selectedLineItems.forEach((item) => {
      const order = orders.find((o) => o.id === item.orderId);
      if (!order) {
        return;
      }
      const entry = map.get(order.id) ?? { order, items: [] };
      entry.items.push(item);
      map.set(order.id, entry);
    });
    return Array.from(map.values());
  }, [orders, selectedLineItems]);

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) {
      showToast({
        variant: "warning",
        title: "追跡番号を入力してください",
        description: "発送登録には追跡番号が必要です。",
        duration: 2500
      });
      return;
    }

    const invalidItem = selectedLineItems.find(
      (item) => item.quantity <= 0 || item.quantity > item.availableQuantity
    );
    if (invalidItem) {
      showToast({
        variant: "warning",
        title: "出荷数量を確認してください",
        description: `${invalidItem.productName} の数量が不正です。1〜${invalidItem.availableQuantity}の範囲にしてください。`,
        duration: 3000
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/shopify/orders/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim(),
          carrier,
          items: selectedLineItems.map((item) => ({
            orderId: item.orderId,
            lineItemId: item.lineItemId,
            quantity: item.quantity
          }))
        })
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
        description: `${selectedLineItems.length}件の明細を Shopify と同期しました。`,
        duration: 2500
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
        description: error instanceof Error ? error.message : "サーバーエラーが発生しました。",
        duration: 3000
      });
    } finally {
      setSubmitting(false);
    }
  };

  const previewItems = selectedLineItems.slice(0, 2);
  const overflowCount = Math.max(0, selectedLineItems.length - previewItems.length);

  useEffect(() => {
    if (selectedLineItems.length === 0) {
      setDetailOpen(false);
    }
  }, [selectedLineItems.length]);

  if (selectedLineItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 text-sm text-slate-500">
            <span className="text-xs uppercase text-slate-400">選択中</span>
            <div className="flex items-center gap-2">
              <div className="flex max-w-[60vw] items-center gap-2 overflow-x-auto">
                {previewItems.map((item) => (
                  <span
                    key={item.lineItemId}
                    className="flex items-center gap-2 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                  >
                    {item.orderNumber}: {item.productName}
                    {item.variantTitle ? `（${item.variantTitle}）` : ""}
                    <button
                      type="button"
                      className="text-slate-400 transition hover:text-slate-600"
                      onClick={() => onRemoveLineItem(item.lineItemId)}
                      aria-label={`${item.productName} を選択から外す`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {overflowCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => setDetailOpen(true)}
                  >
                    +{overflowCount}件
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setDetailOpen(true)}
            >
              詳細を表示
            </Button>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              onClick={onClearSelection}
            >
              <X className="h-3 w-3" aria-hidden="true" />
              選択をクリア
            </button>
          </div>
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
            <Button type="button" variant="default" disabled={isSubmitting} className="gap-2" onClick={handleSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>送信中…</span>
                </>
              ) : (
                `${selectedLineItems.length}件を発送登録`
              )}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="発送対象の明細を確認"
        showCloseButton
      >
        <div className="space-y-4">
          {selectedByOrder.map(({ order, items }) => (
            <div key={order.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">{order.orderNumber}</span>
                  <span className="text-xs text-slate-500">{order.customerName ?? '-'}</span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded border border-transparent px-2 py-1 text-xs text-slate-400 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => onRemoveOrder(order.id)}
                >
                  <X className="h-3 w-3" aria-hidden="true" /> 注文を除外
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div key={item.lineItemId} className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">{item.productName}</span>
                      {item.variantTitle ? (
                        <span>オプション: {item.variantTitle}</span>
                      ) : null}
                      <span>注文数: {item.orderedQuantity}</span>
                      <span>発送済み: {item.fulfilledQuantity}</span>
                      <span>未発送: {Math.max(item.availableQuantity, 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500" htmlFor={`modal-qty-${item.lineItemId}`}>
                        出荷数
                      </label>
                      <Input
                        id={`modal-qty-${item.lineItemId}`}
                        type="number"
                        min={1}
                        max={item.availableQuantity}
                        value={item.quantity}
                        onChange={(event) =>
                          onUpdateQuantity(item.lineItemId, Number(event.target.value) || 1)
                        }
                        className="w-24"
                      />
                      <button
                        type="button"
                        className="text-xs text-slate-400 transition hover:text-slate-600"
                        onClick={() => onRemoveLineItem(item.lineItemId)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { OrderSummary } from "@/lib/data/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { useOrdersRealtimeContext } from "@/components/orders/orders-realtime-context";
import { SelectedLineItem } from "@/components/orders/types";

const carrierOptions = [
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "japanpost", label: "日本郵便" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" }
];

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
  const { markOrdersAsRefreshed } = useOrdersRealtimeContext();
  const [, startRefresh] = useTransition();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState(carrierOptions[0]?.value ?? "");
  const [isSubmitting, setSubmitting] = useState(false);
  const trackingInputRef = useRef<HTMLInputElement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [pendingShipment, setPendingShipment] = useState<{
    requestId: string;
    trackingNumber: string;
    carrier: string;
    items: Array<{ orderId: number; lineItemId: number; quantity: number }>;
  } | null>(null);
  const refreshRetryTimersRef = useRef<number[]>([]);

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

  const orderLookup = useMemo(() => {
    return new Map<number, OrderSummary>(orders.map((order) => [order.id, order]));
  }, [orders]);

  const handleSubmit = () => {
    if (!trackingNumber.trim()) {
      showToast({
        variant: "warning",
        title: "追跡番号が入力されていません",
        description: "入力のうえで登録してください。",
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
        title: "数量をご確認ください",
        description: `${invalidItem.productName} は 1〜${invalidItem.availableQuantity} の範囲で入力できます。`,
        duration: 3000
      });
      return;
    }

    setPendingShipment({
      requestId: createUuid(),
      trackingNumber: trackingNumber.trim(),
      carrier,
      items: selectedLineItems.map((item) => ({
        orderId: item.orderId,
        lineItemId: item.lineItemId,
        quantity: item.quantity
      }))
    });
    setSubmitErrorMessage(null);
    setConfirmOpen(true);
  };

  const submitShipment = async () => {
    if (!pendingShipment) {
      return;
    }

    setSubmitting(true);
    setSubmitErrorMessage(null);

    try {
      const response = await fetch("/api/shopify/orders/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pendingShipment)
      });

      if (!response.ok) {
        const { error } = await response.json().catch(() => ({ error: "failed" }));
        throw new Error(
          error === "failed" ? "発送登録に失敗しました" : String(error ?? "不明なエラー")
        );
      }

      await response.json().catch(() => null);

      setConfirmOpen(false);
      setPendingShipment(null);
      setSubmitErrorMessage(null);

      onClearSelection();
      setTrackingNumber("");
      setCarrier(carrierOptions[0]?.value ?? "");
      markOrdersAsRefreshed();
      startRefresh(() => {
        router.refresh();
      });
      refreshRetryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      refreshRetryTimersRef.current = [1200, 3000].map((delayMs) =>
        window.setTimeout(() => {
          router.refresh();
        }, delayMs)
      );

      window.requestAnimationFrame(() => {
        showToast({
          variant: "success",
          title: "配送登録しました",
          duration: 3000
        });
      });
    } catch (error) {
      console.error("Failed to submit shipment", error);
      setSubmitErrorMessage(
        error instanceof Error ? error.message : "サーバーエラーが発生しました。時間を置いて再度お試しください。"
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      refreshRetryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      refreshRetryTimersRef.current = [];
    };
  }, []);

  const previewItems = selectedLineItems.slice(0, 2);
  const overflowCount = Math.max(0, selectedLineItems.length - previewItems.length);

  useEffect(() => {
    if (selectedLineItems.length === 0) {
      setDetailOpen(false);
      setConfirmOpen(false);
      setPendingShipment(null);
      return;
    }

    if (!isSubmitting) {
      trackingInputRef.current?.focus();
    }
  }, [selectedLineItems.length, isSubmitting]);

  if (selectedLineItems.length === 0) {
    return null;
  }

  return (
    <>
      <div
        data-testid="orders-dispatch-panel-bar"
        className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 flex justify-center px-3 md:bottom-4 md:px-4"
      >
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 text-sm text-slate-500">
              <span className="text-xs uppercase text-slate-400">選択中</span>
              <div className="flex items-center gap-2">
                <div
                  data-testid="orders-dispatch-preview-list"
                  className="flex max-w-full flex-wrap items-center gap-2 md:max-w-[60vw] md:flex-nowrap md:overflow-x-auto"
                >
                  {previewItems.map((item) => (
                    <span
                      key={item.lineItemId}
                      className="flex max-w-full items-start gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600 md:items-center md:whitespace-nowrap"
                    >
                      <span className="min-w-0 break-words">
                        {item.orderNumber}: {item.productName}
                        {item.variantTitle ? `（${item.variantTitle}）` : ""}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-slate-400 transition hover:text-slate-600"
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
                ref={trackingInputRef}
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
                  '内容を確認'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!isSubmitting) {
            setConfirmOpen(false);
            setPendingShipment(null);
            setSubmitErrorMessage(null);
          }
        }}
        title="発送登録の最終確認"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setConfirmOpen(false);
                setPendingShipment(null);
                setSubmitErrorMessage(null);
              }}
            >
              戻る
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={submitShipment} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>登録中…</span>
                </>
              ) : (
                'この内容で発送登録'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          <div>
            <p className="text-xs uppercase text-slate-400">追跡番号</p>
            <p className="font-mono text-base text-foreground">
              {pendingShipment?.trackingNumber ?? (trackingNumber || '未入力')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">配送業者</p>
            <p className="font-semibold text-foreground">
              {carrierOptions.find((option) => option.value === (pendingShipment?.carrier ?? carrier))?.label ?? carrier}
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            数量と追跡番号をご確認のうえ、登録をお願いします。
          </div>
          {isSubmitting ? (
            <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              受付処理中です。画面を閉じずにお待ちください。
            </div>
          ) : null}
          {submitErrorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {submitErrorMessage}
            </div>
          ) : null}
          <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">注文番号</th>
                  <th className="px-3 py-2 text-left">OS番号</th>
                  <th className="px-3 py-2 text-left">商品</th>
                  <th className="px-3 py-2 text-right">出荷数</th>
                </tr>
              </thead>
              <tbody>
                {selectedLineItems.map((item) => (
                  <tr key={`confirm-${item.lineItemId}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{item.orderNumber}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {orderLookup.get(item.orderId)?.osNumber ?? '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span>{item.productName}</span>
                        {item.variantTitle ? (
                          <span className="text-[11px] text-slate-500">{item.variantTitle}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="発送対象の明細を確認"
        showCloseButton
      >
        <div className="space-y-4 text-base text-slate-700">
          {selectedByOrder.map(({ order, items }) => (
            <div key={order.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold text-slate-900">{order.orderNumber}</span>
                  <span className="text-lg text-slate-800">{order.customerName ?? '-'}</span>
                  {order.osNumber ? (
                    <span className="text-sm font-semibold text-slate-700">OS番号: {order.osNumber}</span>
                  ) : null}
                  {order.shippingAddressLines.length > 0 ? (
                    <span className="text-sm text-slate-600">
                      {order.shippingAddressLines.join(' / ')}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded border border-transparent px-2 py-1 text-xs text-slate-400 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => onRemoveOrder(order.id)}
                >
                  <X className="h-3 w-3" aria-hidden="true" /> 注文を除外
                </button>
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.lineItemId}
                    className="flex flex-col gap-3 rounded border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-col gap-1 text-slate-800">
                      <span className="text-lg font-semibold text-slate-900">{item.productName}</span>
                      {item.variantTitle ? (
                        <span className="text-base font-semibold text-slate-700">{item.variantTitle}</span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-slate-700">
                        出荷数: {item.quantity}
                      </span>
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
    </>
  );
}

function createUuid() {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  if (!webCrypto) {
    throw new Error('Secure random source is unavailable');
  }

  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

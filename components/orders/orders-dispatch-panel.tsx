"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type ShipmentJobState = {
  id: number;
  status: string;
  totalCount: number;
  processedCount: number;
  errorCount: number;
  lastError: string | null;
  recentFailures: Array<{ id: number; order_id: number | null; line_item_id: number | null; error_message: string | null }>;
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
  const { showToast, dismissToast } = useToast();
  const { markOrdersAsRefreshed } = useOrdersRealtimeContext();
  const [, startRefresh] = useTransition();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState(carrierOptions[0]?.value ?? "");
  const [isSubmitting, setSubmitting] = useState(false);
  const trackingInputRef = useRef<HTMLInputElement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingShipment, setPendingShipment] = useState<{
    trackingNumber: string;
    carrier: string;
    items: Array<{ orderId: number; lineItemId: number; quantity: number }>;
  } | null>(null);
  const [activeJob, setActiveJob] = useState<ShipmentJobState | null>(null);
  const jobPollTimer = useRef<NodeJS.Timeout | null>(null);

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
      trackingNumber: trackingNumber.trim(),
      carrier,
      items: selectedLineItems.map((item) => ({
        orderId: item.orderId,
        lineItemId: item.lineItemId,
        quantity: item.quantity
      }))
    });
    setConfirmOpen(true);
  };

  const sendingToastRef = useRef<string | null>(null);

  const submitShipment = async () => {
    if (!pendingShipment) {
      return;
    }

    setSubmitting(true);
    const infoToastId = showToast({
      variant: "info",
      title: "発送情報を登録しています",
      description: "完了までお待ちください。",
      duration: Infinity
    });
    sendingToastRef.current = infoToastId;

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

      if (sendingToastRef.current) {
        dismissToast(sendingToastRef.current);
        sendingToastRef.current = null;
      }

      const result = (await response.json().catch(() => null)) as
        | { jobId?: number; totalCount?: number }
        | null;

      showToast({
        variant: "info",
        title: "発送情報を受け付けました",
        duration: 4000
      });

      onClearSelection();
      setTrackingNumber("");
      setCarrier(carrierOptions[0]?.value ?? "");
      setPendingShipment(null);
      setConfirmOpen(false);
      markOrdersAsRefreshed();

      if (result?.jobId) {
        beginJobTracking(result.jobId, result.totalCount ?? pendingShipment.items.length);
      }
    } catch (error) {
      console.error("Failed to submit shipment", error);
      if (sendingToastRef.current) {
        dismissToast(sendingToastRef.current);
        sendingToastRef.current = null;
      }
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

  const handleJobCompletion = useCallback(
    (job: ShipmentJobState) => {
      if (job.status === 'succeeded') {
        showToast({
          variant: "success",
          title: "発送登録が完了しました",
          description: `${job.totalCount}件の発送が反映されました。`,
          duration: 3000
        });
        startRefresh(() => {
          router.refresh();
        });
      } else if (job.status === 'failed') {
        showToast({
          variant: "error",
          title: "一部の発送が登録できませんでした",
          description: job.lastError ?? "画面下の詳細をご確認ください。",
          duration: 4000
        });
      }
    },
    [router, showToast, startRefresh]
  );

  const refreshJobStatus = useCallback(async (jobId: number) => {
    const response = await fetch(`/api/shipment-jobs/${jobId}`, {
      method: "POST",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error('ジョブ状態の取得に失敗しました');
    }

    const payload = (await response.json()) as { job?: ShipmentJobState };
    if (!payload.job) {
      throw new Error('ジョブ情報が見つかりません');
    }
    setActiveJob(payload.job);
    if (isTerminalStatus(payload.job.status)) {
      handleJobCompletion(payload.job);
    }
  }, [handleJobCompletion]);

  const beginJobTracking = (jobId: number, totalCount: number) => {
    setActiveJob({
      id: jobId,
      status: "pending",
      totalCount,
      processedCount: 0,
      errorCount: 0,
      lastError: null,
      recentFailures: []
    });
    refreshJobStatus(jobId).catch((error) => {
      console.error("Failed to refresh shipment job", error);
    });
  };

  useEffect(() => {
    if (!activeJob || isTerminalStatus(activeJob.status)) {
      return () => undefined;
    }

    if (jobPollTimer.current) {
      clearTimeout(jobPollTimer.current);
    }

    jobPollTimer.current = setTimeout(() => {
      refreshJobStatus(activeJob.id).catch((error) => {
        console.error("Failed to refresh shipment job", error);
        showToast({
          variant: "error",
          title: "処理状況を取得できませんでした",
          description: error instanceof Error ? error.message : "時間を置いて再度お試しください。",
          duration: 3000
        });
        setActiveJob(null);
      });
    }, 5000);

    return () => {
      if (jobPollTimer.current) {
        clearTimeout(jobPollTimer.current);
      }
    };
  }, [activeJob, refreshJobStatus, showToast]);

  const dismissJobStatus = () => {
    if (jobPollTimer.current) {
      clearTimeout(jobPollTimer.current);
    }
    setActiveJob(null);
  };

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
      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
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

          {activeJob && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">発送ジョブ #{activeJob.id}</div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  状態: {jobStatusLabel(activeJob.status)}
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={dismissJobStatus}
                  >
                    閉じる
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-base">
                <span>
                  進捗: {activeJob.processedCount} / {activeJob.totalCount} 件
                </span>
                <span className={activeJob.errorCount > 0 ? "text-red-600" : "text-slate-500"}>
                  失敗: {activeJob.errorCount} 件
                </span>
              </div>
              {activeJob.recentFailures.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  最新の失敗:
                  <ul className="list-disc pl-4">
                    {activeJob.recentFailures.map((failure) => (
                      <li key={failure.id}>
                        注文#{failure.order_id ?? '-'} / ライン {failure.line_item_id ?? '-'}: {failure.error_message ?? '理由不明'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!isSubmitting) {
            setConfirmOpen(false);
          }
        }}
        title="発送登録の最終確認"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setConfirmOpen(false)}>
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

function isTerminalStatus(status: string) {
  return status === 'succeeded' || status === 'failed';
}

function jobStatusLabel(status: string) {
  switch (status) {
    case 'succeeded':
      return '完了';
    case 'failed':
      return '失敗';
    case 'running':
      return '処理中';
    default:
      return '待機中';
  }
}

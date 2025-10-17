"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { OrderSummary } from "@/lib/data/orders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/orders/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const carrierOptions = [
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "japanpost", label: "日本郵便" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
];

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

type OrderFormState = {
  trackingNumber: string;
  carrier: string;
  loading: boolean;
};

export function OrdersDispatchTable({ orders }: { orders: OrderSummary[] }) {
  const router = useRouter();
  const { showToast } = useToast();

  const initialForms = useMemo(() => {
    const carrierDefault = carrierOptions[0]?.value ?? "";
    const map = new Map<number, OrderFormState>();
    orders.forEach((order) => {
      map.set(order.id, {
        trackingNumber: "",
        carrier: carrierDefault,
        loading: false,
      });
    });
    return map;
  }, [orders]);

  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [forms, setForms] = useState(initialForms);

  useEffect(() => {
    setForms(initialForms);
    setSelectedOrders(new Set());
  }, [initialForms]);

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

  const updateForm = (orderId: number, input: Partial<OrderFormState>) => {
    setForms((prev) => {
      const next = new Map(prev);
      const current = next.get(orderId) ?? {
        trackingNumber: "",
        carrier: carrierOptions[0]?.value ?? "",
        loading: false,
      };
      next.set(orderId, {
        ...current,
        ...input,
      });
      return next;
    });
  };

  const handleSubmit = async (orderId: number) => {
    const formState = forms.get(orderId);
    if (!formState) return;

    if (!formState.trackingNumber.trim()) {
      showToast({
        variant: "warning",
        title: "追跡番号を入力してください",
        description: "発送登録には追跡番号が必要です。",
        duration: 2500,
      });
      return;
    }

    updateForm(orderId, { loading: true });

    try {
      const response = await fetch("/api/shopify/orders/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          trackingNumber: formState.trackingNumber.trim(),
          carrier: formState.carrier,
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
        description: `注文 ${orderId} の発送情報を Shopify と同期しました。`,
        duration: 2500,
      });

      setSelectedOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      updateForm(orderId, { trackingNumber: "", loading: false });
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
      updateForm(orderId, { loading: false });
    }
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        表示する注文がありません。
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">選択</TableHead>
          <TableHead>注文番号</TableHead>
          <TableHead>顧客名</TableHead>
          <TableHead>商品数</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>追跡番号</TableHead>
          <TableHead>更新日</TableHead>
          <TableHead>アクション</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const isSelected = selectedOrders.has(order.id);
          const formState = forms.get(order.id) ?? {
            trackingNumber: "",
            carrier: carrierOptions[0]?.value ?? "",
            loading: false,
          };

          return (
            <>
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
                <TableCell>{order.lineItemCount}</TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  {order.trackingNumbers.length > 0
                    ? order.trackingNumbers.join(", ")
                    : "-"}
                </TableCell>
                <TableCell>{formatUpdatedAt(order.updatedAt)}</TableCell>
                <TableCell>
                  <Link
                    href={`/orders/${order.id}`}
                    className={"text-sm text-foreground underline-offset-2 hover:underline"}
                    onClick={(event) => event.stopPropagation()}
                  >
                    詳細
                  </Link>
                </TableCell>
              </TableRow>
              {isSelected ? (
                <TableRow key={`${order.id}-form`} className="bg-slate-50">
                  <td className="px-6 py-4" colSpan={8}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex flex-1 flex-col gap-1">
                        <label className="text-xs font-medium text-foreground">
                          追跡番号
                        </label>
                        <Input
                          placeholder="YT123456789JP"
                          value={formState.trackingNumber}
                          onChange={(event) =>
                            updateForm(order.id, { trackingNumber: event.target.value })
                          }
                          onClick={(event) => event.stopPropagation()}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-foreground">
                          配送業者
                        </label>
                        <Select
                          value={formState.carrier}
                          onChange={(event) =>
                            updateForm(order.id, { carrier: event.target.value })
                          }
                          onClick={(event) => event.stopPropagation()}
                        >
                          {carrierOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="default"
                          disabled={formState.loading}
                          className="gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleSubmit(order.id);
                          }}
                        >
                          {formState.loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>送信中…</span>
                            </>
                          ) : (
                            "発送登録"
                          )}
                        </Button>
                      </div>
                    </div>
                  </td>
                </TableRow>
              ) : null}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
 
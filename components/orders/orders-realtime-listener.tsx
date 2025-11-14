"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type OrdersRealtimeListenerProps = {
  vendorId: number;
  orderIds: number[];
};

type UpdateState = {
  hasUpdates: boolean;
  newOrders: Set<number>;
  touchedOrders: Set<number>;
};

const initialUpdateState: UpdateState = {
  hasUpdates: false,
  newOrders: new Set(),
  touchedOrders: new Set()
};

export function OrdersRealtimeListener({ vendorId, orderIds }: OrdersRealtimeListenerProps) {
  const router = useRouter();
  const [updates, setUpdates] = useState<UpdateState>(initialUpdateState);

  const registerOrderChange = useCallback((orderId: number | null, isNew: boolean) => {
    setUpdates((prev) => {
      const nextNewOrders = new Set(prev.newOrders);
      const nextTouched = new Set(prev.touchedOrders);

      if (orderId) {
        nextTouched.add(orderId);
        if (isNew) {
          nextNewOrders.add(orderId);
        }
      }

      return {
        hasUpdates: true,
        newOrders: nextNewOrders,
        touchedOrders: nextTouched
      } satisfies UpdateState;
    });
  }, []);

  const resetUpdates = useCallback(() => {
    setUpdates({
      hasUpdates: false,
      newOrders: new Set(),
      touchedOrders: new Set()
    });
  }, []);

  useEffect(() => {
    const supabase = getBrowserClient();
    const orderFilter = orderIds.length > 0 ? `id=in.(${orderIds.join(",")})` : null;

    const extractOrderId = (payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null }) => {
      const candidateNew = payload.new;
      const candidateOld = payload.old;
      const orderFromNew = typeof candidateNew?.order_id === 'number' ? candidateNew.order_id : typeof candidateNew?.id === 'number' ? candidateNew.id : null;
      if (typeof orderFromNew === 'number') {
        return orderFromNew;
      }
      const orderFromOld = typeof candidateOld?.order_id === 'number' ? candidateOld.order_id : typeof candidateOld?.id === 'number' ? candidateOld.id : null;
      return typeof orderFromOld === 'number' ? orderFromOld : null;
    };

    const channel = supabase
      .channel(`orders-live-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shipments",
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          const orderId = extractOrderId(payload as any);
          registerOrderChange(orderId, false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "line_items",
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          const orderId = extractOrderId(payload as any);
          const isInsert = (payload as any)?.eventType === 'INSERT';
          registerOrderChange(orderId, Boolean(isInsert));
        }
      );

    if (orderFilter) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: orderFilter
        },
        (payload) => {
          const orderId = extractOrderId(payload as any);
          registerOrderChange(orderId, false);
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderIds, registerOrderChange, vendorId]);

  const { message, showBanner } = useMemo(() => {
    if (!updates.hasUpdates) {
      return { showBanner: false, message: '' };
    }
    const newOrderCount = updates.newOrders.size;
    const totalTouched = updates.touchedOrders.size;
    const updatedCount = Math.max(0, totalTouched - newOrderCount);

    if (newOrderCount === 0 && updatedCount === 0) {
      return { showBanner: true, message: 'Shopify 側で更新がありました。最新の状態を表示してください。' };
    }

    const parts: string[] = [];
    if (newOrderCount > 0) {
      parts.push(`${newOrderCount}件の新しい注文`);
    }
    if (updatedCount > 0) {
      parts.push(`${updatedCount}件の既存注文`);
    }

    return {
      showBanner: true,
      message: `${parts.join(' / ')} が更新されました。`
    };
  }, [updates]);

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow">
        <span>{message}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-amber-400 text-amber-900 hover:bg-amber-100"
            onClick={() => resetUpdates()}
          >
            後で
          </Button>
          <Button
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={() => {
              router.refresh();
              resetUpdates();
            }}
          >
            更新する
          </Button>
        </div>
      </div>
    </div>
  );
}

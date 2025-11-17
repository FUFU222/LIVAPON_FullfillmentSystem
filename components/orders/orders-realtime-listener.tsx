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
  const [debugEvents, setDebugEvents] = useState<
    Array<{ source: string; eventType: string | null; orderId: number | null }>
  >([]);
  const debugRealtime = process.env.NEXT_PUBLIC_DEBUG_REALTIME === 'true';

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

  const pushDebugEvent = useCallback(
    (source: string, eventType: string | null, orderId: number | null) => {
      if (!debugRealtime) {
        return;
      }
      setDebugEvents((prev) => {
        const next = [{ source, eventType, orderId }, ...prev];
        return next.slice(0, 6);
      });
    },
    [debugRealtime]
  );

  useEffect(() => {
    if (debugRealtime) {
      console.info('RealtimeListener mount', { vendorId, orderCount: orderIds.length });
    }
    const supabase = getBrowserClient();


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
          table: "shipments"
        },
        (payload) => {
          const orderId = extractOrderId(payload as any);
          if (debugRealtime) {
            console.info('[realtime] shipments event', {
              table: 'shipments',
              event: (payload as any)?.eventType,
              orderId
            });
          }
          pushDebugEvent('shipments', (payload as any)?.eventType ?? null, orderId);
          registerOrderChange(orderId, false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "line_items"
        },
        (payload) => {
          const orderId = extractOrderId(payload as any);
          const isInsert = (payload as any)?.eventType === 'INSERT';
          if (debugRealtime) {
            console.info('[realtime] line_items event', {
              table: 'line_items',
              event: (payload as any)?.eventType,
              orderId,
              isInsert
            });
          }
          pushDebugEvent('line_items', (payload as any)?.eventType ?? null, orderId);
          registerOrderChange(orderId, Boolean(isInsert));
        }
      );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders"
      },
      (payload) => {
        const orderId = extractOrderId(payload as any);
        const isInsert = (payload as any)?.eventType === 'INSERT';
        if (debugRealtime) {
          console.info('[realtime] orders event', {
            table: 'orders',
            event: (payload as any)?.eventType,
            orderId,
            isInsert
          });
        }
        pushDebugEvent('orders', (payload as any)?.eventType ?? null, orderId);
        registerOrderChange(orderId, Boolean(isInsert));
      }
    );

    channel.subscribe((status) => {
      if (debugRealtime) {
        console.info('RealtimeListener status', status);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debugRealtime, orderIds, pushDebugEvent, registerOrderChange, vendorId]);

  const { message, showBanner, newOrderCount, updatedCount } = useMemo(() => {
    if (!updates.hasUpdates) {
      return { showBanner: false, message: '', newOrderCount: 0, updatedCount: 0 };
    }
    const newOrderCount = updates.newOrders.size;
    const totalTouched = updates.touchedOrders.size;
    const updatedCount = Math.max(0, totalTouched - newOrderCount);

    if (newOrderCount === 0 && updatedCount === 0) {
      return {
        showBanner: true,
        message: 'Shopify 側で更新がありました。最新の状態を表示してください。',
        newOrderCount,
        updatedCount
      };
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
      message: `${parts.join(' / ')} が更新されました。` ,
      newOrderCount,
      updatedCount
    };
  }, [updates]);

  if (!showBanner) {
    return debugRealtime ? (
      <div className="pointer-events-none fixed bottom-2 left-2 z-40 w-72 text-xs text-slate-500">
        <div className="rounded-lg border border-slate-300 bg-white/95 shadow">
          <div className="border-b px-3 py-2 font-semibold text-slate-700">Realtime Debug</div>
          <div className="max-h-44 space-y-1 overflow-y-auto p-3">
            {debugEvents.length === 0 ? (
              <p className="text-slate-400">イベントなし</p>
            ) : (
              debugEvents.map((event, index) => (
                <div key={`${event.source}-${event.orderId}-${index}`} className="rounded bg-slate-100 px-2 py-1">
                  <div className="font-medium text-slate-700">{event.source}</div>
                  <div className="text-slate-600">
                    type: {event.eventType ?? 'unknown'} / order: {event.orderId ?? 'n/a'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm">
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white/95 px-4 py-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">更新があります</span>
          <div className="flex items-center gap-2 text-xs text-amber-700">
            {newOrderCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5">新規 {newOrderCount}</span> : null}
            {updatedCount > 0 ? <span className="rounded-full bg-amber-50 px-2 py-0.5">更新 {updatedCount}</span> : null}
          </div>
        </div>
        <p className="text-sm text-slate-800">{message}</p>
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="ghost"
            className="px-3 py-1 text-slate-500 hover:text-slate-700"
            onClick={() => resetUpdates()}
          >
            後で
          </Button>
          <Button
            className="px-3 py-1 bg-amber-600 text-white hover:bg-amber-700"
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

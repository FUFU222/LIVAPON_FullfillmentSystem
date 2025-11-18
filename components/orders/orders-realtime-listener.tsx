"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";

type OrdersRealtimeListenerProps = {
  vendorId: number;
};

export function OrdersRealtimeListener({ vendorId }: OrdersRealtimeListenerProps) {
  const [debugEvents, setDebugEvents] = useState<
    Array<{ source: string; eventType: string | null; orderId: number | null }>
  >([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const pushDebugEvent = useCallback((source: string, eventType: string | null, orderId: number | null) => {
    setDebugEvents((prev) => {
      const next = [{ source, eventType, orderId }, ...prev];
      return next.slice(0, 6);
    });
  }, []);

  useEffect(() => {
    console.info('RealtimeListener mount', { vendorId });
    const supabase = getBrowserClient();
    let isMounted = true;

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

    async function subscribeWithSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to hydrate Supabase session for realtime listener', error);
        return;
      }

      if (!data.session) {
        console.warn('Realtime listener requires an authenticated session');
        return;
      }

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
            console.info('[realtime] shipments event', {
              table: 'shipments',
              event: (payload as any)?.eventType,
              orderId
            });
            if (orderId === null) {
              console.debug('[realtime] shipments payload (missing order id)', payload);
            }
            pushDebugEvent('shipments', (payload as any)?.eventType ?? null, orderId);
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
            console.info('[realtime] line_items event', {
              table: 'line_items',
              event: (payload as any)?.eventType,
              orderId,
              isInsert
            });
            if (orderId === null) {
              console.debug('[realtime] line_items payload (missing order id)', payload);
            }
            pushDebugEvent('line_items', (payload as any)?.eventType ?? null, orderId);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_vendor_segments",
            filter: `vendor_id=eq.${vendorId}`
          },
          (payload) => {
            const orderId = extractOrderId(payload as any);
            console.info('[realtime] order_vendor_segments event', {
              table: 'order_vendor_segments',
              event: (payload as any)?.eventType,
              orderId
            });
            pushDebugEvent('order_vendor_segments', (payload as any)?.eventType ?? null, orderId);
          }
        );

      channelRef.current = channel;

      channel.subscribe((status) => {
        console.info('RealtimeListener status', status);
      });
    }

    void subscribeWithSession();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [pushDebugEvent, vendorId]);

  return (
    <div className="pointer-events-none fixed top-16 left-1/2 z-40 w-80 -translate-x-1/2 text-xs text-slate-500">
      <div className="rounded-lg border border-slate-300 bg-white/95 shadow">
        <div className="border-b px-3 py-2 text-sm font-semibold text-slate-700">
          Realtime Debug
        </div>
        <div className="max-h-60 space-y-1 overflow-y-auto p-3">
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
  );
}

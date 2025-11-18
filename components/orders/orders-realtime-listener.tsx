"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast-provider";

type OrdersRealtimeListenerProps = {
  vendorId: number;
};

type PendingEventCounts = {
  orders: number;
  lineItems: number;
  shipments: number;
};

export function OrdersRealtimeListener({ vendorId }: OrdersRealtimeListenerProps) {
  const router = useRouter();
  const { showToast, dismissToast } = useToast();
  const [isRefreshing, startTransition] = useTransition();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingEventsRef = useRef<PendingEventCounts>({ orders: 0, lineItems: 0, shipments: 0 });
  const toastIdRef = useRef<string | null>(null);
  const refreshPendingRef = useRef(false);

  const resetPendingEvents = useCallback(() => {
    pendingEventsRef.current = { orders: 0, lineItems: 0, shipments: 0 };
  }, []);

  const handleManualRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }
    refreshPendingRef.current = true;
    if (toastIdRef.current) {
      dismissToast(toastIdRef.current);
      toastIdRef.current = null;
    }
    resetPendingEvents();
    startTransition(() => {
      router.refresh();
    });
  }, [dismissToast, isRefreshing, resetPendingEvents, router, startTransition]);

  const notifyPendingUpdates = useCallback(() => {
    const counts = pendingEventsRef.current;
    const total = counts.orders + counts.lineItems + counts.shipments;
    if (total <= 0) {
      return;
    }

    const summaryParts: string[] = [];
    if (counts.orders > 0) {
      summaryParts.push(`注文 ${counts.orders}件`);
    }
    if (counts.lineItems > 0) {
      summaryParts.push(`ラインアイテム ${counts.lineItems}件`);
    }
    if (counts.shipments > 0) {
      summaryParts.push(`発送 ${counts.shipments}件`);
    }

    toastIdRef.current = showToast({
      id: "orders-realtime-pending",
      title: "新しい更新があります",
      description: summaryParts.join(" / ") || "最新の更新があります",
      duration: Infinity,
      variant: "info",
      action: {
        label: isRefreshing ? "更新中…" : "最新に更新",
        icon: RefreshCw,
        onClick: handleManualRefresh,
        disabled: isRefreshing
      }
    });
  }, [handleManualRefresh, isRefreshing, showToast]);

  useEffect(() => {
    if (toastIdRef.current) {
      notifyPendingUpdates();
    }
  }, [isRefreshing, notifyPendingUpdates]);

  useEffect(() => {
    if (!isRefreshing && refreshPendingRef.current) {
      refreshPendingRef.current = false;
      showToast({
        title: "注文一覧を更新しました",
        variant: "success",
        duration: 2000
      });
    }
  }, [isRefreshing, showToast]);

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

    const registerEvent = (type: keyof PendingEventCounts) => {
      pendingEventsRef.current = {
        ...pendingEventsRef.current,
        [type]: pendingEventsRef.current[type] + 1
      };
      notifyPendingUpdates();
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
            registerEvent('shipments');
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
            registerEvent('lineItems');
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders"
          },
          (payload) => {
            const orderId = extractOrderId(payload as any);
            const nextVendor = (payload as any)?.new?.vendor_id;
            const prevVendor = (payload as any)?.old?.vendor_id;
            const vendorMatches =
              typeof nextVendor === 'number'
                ? nextVendor === vendorId
                : typeof prevVendor === 'number'
                  ? prevVendor === vendorId
                  : true;
            console.info('[realtime] orders event', {
              table: 'orders',
              event: (payload as any)?.eventType,
              orderId,
              vendorMatches
            });
            if (!vendorMatches) {
              return;
            }
            registerEvent('orders');
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
            registerEvent('orders');
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
  }, [notifyPendingUpdates, vendorId]);

  return null;
}

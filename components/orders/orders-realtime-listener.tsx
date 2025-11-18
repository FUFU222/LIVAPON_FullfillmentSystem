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

export function OrdersRealtimeListener({ vendorId }: OrdersRealtimeListenerProps) {
  const router = useRouter();
  const { showToast, dismissToast } = useToast();
  const [isRefreshing, startTransition] = useTransition();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingOrderIdsRef = useRef<Set<number>>(new Set());
  const vendorOrderMapRef = useRef<Set<number>>(new Set());
  const toastIdRef = useRef<string | null>(null);
  const refreshPendingRef = useRef(false);

  const resetPendingEvents = useCallback(() => {
    pendingOrderIdsRef.current = new Set();
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
    const total = pendingOrderIdsRef.current.size;
    if (total <= 0) {
      return;
    }

    const summaryText = `注文 ${total}件`;

    toastIdRef.current = showToast({
      id: "orders-realtime-pending",
      title: "新しい更新があります",
      description: summaryText,
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

    const shouldNotify = (payload: any) => {
      const source = (payload?.new as any)?.last_updated_source ?? null;
      const updatedBy = (payload?.new as any)?.last_updated_by ?? null;
      const currentUser = userIdRef.current;

      if (currentUser && typeof updatedBy === 'string' && updatedBy === currentUser) {
        return false;
      }

      if (typeof source === 'string' && source.length > 0) {
        return source.startsWith('webhook');
      }

      return false;
    };

    const registerEvent = (payload: any) => {
      if (!shouldNotify(payload)) {
        return;
      }
      const orderId = extractOrderId(payload as any);
      if (typeof orderId !== 'number') {
        return;
      }
      pendingOrderIdsRef.current.add(orderId);
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

      if (!userIdRef.current) {
        userIdRef.current = data.session.user?.id ?? null;
      }

      const channel = supabase
        .channel(`orders-live-${vendorId}`)
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
                  : vendorOrderMapRef.current.has(orderId ?? -1);
            console.info('[realtime] orders event', {
              table: 'orders',
              event: (payload as any)?.eventType,
              orderId,
              vendorMatches
            });
            if (!vendorMatches) {
              return;
            }
            registerEvent(payload);
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
            if (typeof orderId !== 'number') {
              return;
            }
            const eventType = (payload as any)?.eventType;
            if (eventType === 'DELETE') {
              vendorOrderMapRef.current.delete(orderId);
            } else {
              vendorOrderMapRef.current.add(orderId);
            }
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

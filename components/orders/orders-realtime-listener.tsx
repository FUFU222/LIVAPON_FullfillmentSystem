"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast-provider";
import { useOrdersRealtimeContext } from "./orders-realtime-context";

type OrdersRealtimeListenerProps = {
  vendorId: number;
};

export function OrdersRealtimeListener({ vendorId }: OrdersRealtimeListenerProps) {
  const router = useRouter();
  const { showToast, dismissToast } = useToast();
  const { pendingCount, registerPendingOrder, markOrdersAsRefreshed } = useOrdersRealtimeContext();
  const [isRefreshing, startTransition] = useTransition();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const registerPendingOrderRef = useRef(registerPendingOrder);
  const toastIdRef = useRef<string | null>(null);
  const refreshPendingRef = useRef(false);
  const pendingToastTimerRef = useRef<number | null>(null);

  const handleManualRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }
    refreshPendingRef.current = true;
    if (toastIdRef.current) {
      dismissToast(toastIdRef.current);
      toastIdRef.current = null;
    }
    markOrdersAsRefreshed();
    startTransition(() => {
      router.refresh();
    });
  }, [dismissToast, isRefreshing, markOrdersAsRefreshed, router, startTransition]);

  const showPendingToast = useCallback(() => {
    if (toastIdRef.current) {
      dismissToast(toastIdRef.current);
      toastIdRef.current = null;
    }
    toastIdRef.current = showToast({
      id: "orders-realtime-pending",
      title: "新しい更新があります",
      description: `注文 ${pendingCount}件`,
      duration: Infinity,
      variant: "info",
      action: {
        label: isRefreshing ? "更新中…" : "最新に更新",
        icon: RefreshCw,
        onClick: handleManualRefresh,
        disabled: isRefreshing
      }
    });
  }, [dismissToast, handleManualRefresh, isRefreshing, pendingCount, showToast]);

  useEffect(() => {
    const MIN_PENDING_DELAY_MS = 400;
    if (pendingCount > 0) {
      if (pendingToastTimerRef.current === null) {
        pendingToastTimerRef.current = window.setTimeout(() => {
          pendingToastTimerRef.current = null;
          showPendingToast();
        }, MIN_PENDING_DELAY_MS);
      }
    } else {
      if (pendingToastTimerRef.current !== null) {
        window.clearTimeout(pendingToastTimerRef.current);
        pendingToastTimerRef.current = null;
      }
      if (toastIdRef.current) {
        dismissToast(toastIdRef.current);
        toastIdRef.current = null;
      }
    }

    return () => {
      if (pendingToastTimerRef.current !== null) {
        window.clearTimeout(pendingToastTimerRef.current);
        pendingToastTimerRef.current = null;
      }
    };
  }, [pendingCount, showPendingToast, dismissToast]);

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
    registerPendingOrderRef.current = registerPendingOrder;
  }, [registerPendingOrder]);

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
        if (source.startsWith('worker:')) {
          const nextStatus = payload?.new?.status ?? payload?.new?.shopify_status ?? null;
          const prevStatus = payload?.old?.status ?? payload?.old?.shopify_status ?? null;
          if (nextStatus === prevStatus) {
            return false;
          }
        }
        return true;
      }

      return false;
    };

    const handleOrdersEvent = (payload: any) => {
      if (!shouldNotify(payload)) {
        return;
      }
      const orderId = extractOrderId(payload as any);
      if (typeof orderId !== 'number') {
        return;
      }
      registerPendingOrderRef.current(orderId);
    };

    const handleLineItemEvent = (payload: any) => {
      const orderId = extractOrderId(payload as any);
      if (typeof orderId !== 'number') {
        return;
      }
      registerPendingOrderRef.current(orderId);
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

      const accessToken = data.session.access_token;
      try {
        await supabase.realtime.setAuth(accessToken);
      } catch (setAuthError) {
        console.error('Failed to hydrate Supabase realtime auth', setAuthError);
      }

      const channel = supabase
        .channel(`orders-live-${vendorId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `vendor_id=eq.${vendorId}`
          },
          (payload) => {
            handleOrdersEvent(payload);
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
            handleLineItemEvent(payload);
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
  }, [vendorId]);

  return null;
}

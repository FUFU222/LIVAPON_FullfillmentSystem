"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

type OrdersRealtimeListenerProps = {
  vendorId: number;
  orderIds: number[];
};

export function OrdersRealtimeListener({ vendorId, orderIds }: OrdersRealtimeListenerProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserClient();
    const orderFilter = orderIds.length > 0 ? `id=in.(${orderIds.join(",")})` : null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        router.refresh();
        refreshTimer = null;
      }, 200);
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
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "line_items",
          filter: `vendor_id=eq.${vendorId}`
        },
        scheduleRefresh
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
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [vendorId, orderIds, router]);

  return null;
}


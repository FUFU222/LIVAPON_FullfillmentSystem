"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type OrdersRealtimeListenerProps = {
  vendorId: number;
  orderIds: number[];
};

export function OrdersRealtimeListener({ vendorId, orderIds }: OrdersRealtimeListenerProps) {
  const router = useRouter();
  const [hasUpdates, setHasUpdates] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    const orderFilter = orderIds.length > 0 ? `id=in.(${orderIds.join(",")})` : null;

    const notifyUpdate = () => {
      setHasUpdates(true);
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
        notifyUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "line_items",
          filter: `vendor_id=eq.${vendorId}`
        },
        notifyUpdate
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
        notifyUpdate
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, orderIds]);

  useEffect(() => {
    if (!hasUpdates) {
      return;
    }
    const timer = setTimeout(() => {
      setHasUpdates(false);
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasUpdates, router]);

  if (!hasUpdates) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow">
        <span>Shopify 側で更新がありました。最新の状態を表示してください。</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-amber-400 text-amber-900 hover:bg-amber-100"
            onClick={() => setHasUpdates(false)}
          >
            後で
          </Button>
          <Button
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={() => {
              setHasUpdates(false);
              router.refresh();
            }}
          >
            更新する
          </Button>
        </div>
      </div>
    </div>
  );
}

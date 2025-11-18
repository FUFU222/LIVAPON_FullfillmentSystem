"use client";

import { useEffect } from "react";
import { useOrdersRealtimeContext } from "./orders-realtime-context";

export function OrdersRealtimeResetter() {
  const { markOrdersAsRefreshed } = useOrdersRealtimeContext();

  useEffect(() => {
    markOrdersAsRefreshed();
  }, [markOrdersAsRefreshed]);

  useEffect(() => {
    const handleFocus = () => markOrdersAsRefreshed();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [markOrdersAsRefreshed]);

  return null;
}

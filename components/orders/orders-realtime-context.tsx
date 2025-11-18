"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type RealtimeContextValue = {
  pendingCount: number;
  registerPendingOrder: (orderId: number) => void;
  markOrdersAsRefreshed: () => void;
  toastClosedAtRef: React.MutableRefObject<number>;
};

const OrdersRealtimeContext = createContext<RealtimeContextValue | null>(null);

export function OrdersRealtimeProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const pendingOrderIdsRef = useRef<Set<number>>(new Set());
  const toastClosedAtRef = useRef(0);

  const registerPendingOrder = (orderId: number) => {
    if (!pendingOrderIdsRef.current.has(orderId)) {
      pendingOrderIdsRef.current.add(orderId);
      setPendingCount(pendingOrderIdsRef.current.size);
    }
  };

  const markOrdersAsRefreshed = () => {
    pendingOrderIdsRef.current.clear();
    setPendingCount(0);
    toastClosedAtRef.current = Date.now();
  };

  const value = useMemo<RealtimeContextValue>(
    () => ({ pendingCount, registerPendingOrder, markOrdersAsRefreshed, toastClosedAtRef }),
    [pendingCount]
  );

  return <OrdersRealtimeContext.Provider value={value}>{children}</OrdersRealtimeContext.Provider>;
}

export function useOrdersRealtimeContext() {
  const context = useContext(OrdersRealtimeContext);
  if (!context) {
    throw new Error('useOrdersRealtimeContext must be used within OrdersRealtimeProvider');
  }
  return context;
}

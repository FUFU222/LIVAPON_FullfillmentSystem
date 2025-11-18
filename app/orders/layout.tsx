import type { ReactNode } from 'react';
import { OrdersRealtimeProvider } from '@/components/orders/orders-realtime-context';

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <OrdersRealtimeProvider>{children}</OrdersRealtimeProvider>;
}

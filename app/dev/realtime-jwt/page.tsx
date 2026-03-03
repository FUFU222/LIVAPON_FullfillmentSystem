"use client";

import { useEffect, useState } from "react";
import { resolveVendorIdFromAuthUser } from "@/lib/auth-metadata";
import { getBrowserClient } from "@/lib/supabase/client";
import { OrdersRealtimeListener } from "@/components/orders/orders-realtime-listener";
import { OrdersRealtimeProvider } from "@/components/orders/orders-realtime-context";

export default function RealtimeJwtProbePage() {
  const [sessionInfo, setSessionInfo] = useState<{ vendorId: number | null; rawVendor: unknown } | null>(null);
  const [status, setStatus] = useState<string>('INITIALIZING');
  const debug = process.env.NEXT_PUBLIC_DEBUG_REALTIME === 'true';

  useEffect(() => {
    const supabase = getBrowserClient();

    supabase.auth.getSession().then((result) => {
      const sessionUser = result.data.session?.user ?? null;
      const rawVendor =
        sessionUser?.app_metadata?.vendor_id ??
        sessionUser?.app_metadata?.vendorId ??
        sessionUser?.user_metadata?.vendor_id ??
        null;
      const normalizedVendorId = resolveVendorIdFromAuthUser(sessionUser);

      setSessionInfo({
        vendorId: normalizedVendorId,
        rawVendor
      });

      const channel = supabase
        .channel('probe-jwt-orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            console.log('🔥 orders change (jwt probe)', payload);
          }
        )
        .subscribe((state) => {
          setStatus(state);
          if (debug) {
            console.info('[realtime-jwt] status', state);
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, [debug]);

  return (
    <OrdersRealtimeProvider>
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10 text-sm text-slate-600">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">Realtime JWT Probe</h1>
        <p className="mt-2 text-slate-500">
          ログイン済みユーザーの Supabase セッション（JWT）を使って orders テーブルを購読します。
          <br />
          このページで `orders` のイベントが見えれば、セッション + RLS を満たした状態でも Postgres Changes が届いていることになります。
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Subscription status: {status}</p>
        <p className="mt-2 text-sm text-slate-500">
          vendor_id (session): {sessionInfo?.vendorId ?? 'N/A'}
        </p>
      </div>

        {sessionInfo?.vendorId ? (
          <OrdersRealtimeListener vendorId={sessionInfo.vendorId} />
        ) : null}
      </main>
    </OrdersRealtimeProvider>
  );
}

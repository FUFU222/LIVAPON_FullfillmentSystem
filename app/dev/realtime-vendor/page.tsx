"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { OrdersRealtimeListener } from "@/components/orders/orders-realtime-listener";

export default function RealtimeVendorProbePage() {
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [guardChecked, setGuardChecked] = useState(false);
  const debug = process.env.NEXT_PUBLIC_DEBUG_REALTIME === 'true';

  useEffect(() => {
    const supabase = getBrowserClient();

    supabase.auth.getSession().then((result) => {
      const rawVendor = result.data.session?.user?.user_metadata?.vendor_id;
      const normalizedVendorId = typeof rawVendor === 'number' ? rawVendor : Number(rawVendor);
      if (Number.isFinite(normalizedVendorId)) {
        setVendorId(normalizedVendorId);
      } else {
        setVendorId(null);
      }

      if (debug) {
        console.info('[realtime-vendor] session vendor', { vendorId: normalizedVendorId, rawVendor });
      }

      setGuardChecked(true);
    });
  }, [debug]);

  if (!guardChecked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-slate-500">
        <p>Loading session...</p>
      </main>
    );
  }

  if (vendorId === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-slate-500">
        <p>ログイン中のアカウントに vendor_id が設定されていません。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10 text-sm text-slate-600">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Vendor Realtime Probe</h1>
        <p className="mt-2 text-slate-500">
          このページはクライアントサイドのみで Supabase Realtime を購読し、Orders ページと同じ条件でイベントが届くかを検証するためのものです。
          <br />
          ブラウザの Console で `NEXT_PUBLIC_DEBUG_REALTIME=true` のログを確認しながら操作してください。
        </p>
      </div>

      <OrdersRealtimeListener vendorId={vendorId} />
    </main>
  );
}

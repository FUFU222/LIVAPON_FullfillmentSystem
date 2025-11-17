import { redirect } from "next/navigation";
import { OrdersRealtimeListener } from "@/components/orders/orders-realtime-listener";
import { getAuthContext } from "@/lib/auth";

export default async function RealtimeVendorProbePage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/dev/realtime-vendor');
  }

  if (auth.vendorId === null) {
    redirect('/');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10 text-sm text-slate-600">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Vendor Realtime Probe</h1>
        <p className="mt-2 text-slate-500">
          このページでは /orders と同じロジックで Supabase Realtime を購読しています。
          <br />
          ブラウザの Console を開き、`NEXT_PUBLIC_DEBUG_REALTIME=true` を設定した状態で Shopify 側の操作を行うと、
          Orders ページと同一条件でイベントが流れるかを確認できます。
        </p>
      </div>

      <OrdersRealtimeListener vendorId={auth.vendorId} />
    </main>
  );
}

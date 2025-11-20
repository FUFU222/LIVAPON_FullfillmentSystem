import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrdersRefreshButton } from "@/components/orders/orders-refresh-button";
import { OrdersRealtimeListener } from "@/components/orders/orders-realtime-listener";
import { ShipmentHistoryTable } from "@/components/orders/shipment-history-table";
import { getShipmentHistory } from "@/lib/data/orders";
import { getAuthContext } from "@/lib/auth";

export default async function ShipmentsPage() {
  const auth = await getAuthContext();

  if (!auth || auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/orders/shipments")}`);
  }

  if (auth.role === "pending_vendor") {
    redirect("/pending");
  }

  const shipments = await getShipmentHistory(auth.vendorId);

  return (
    <Card>
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <CardHeader className="flex flex-col gap-4">
        <div>
          <Link
            href="/orders"
            className="inline-flex text-sm text-slate-500 transition hover:text-foreground"
          >
            ← 注文一覧に戻る
          </Link>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl font-semibold">
              発送履歴一覧
            </CardTitle>
            <OrdersRefreshButton />
          </div>
          <div className="text-sm text-slate-500 max-w-md sm:ml-auto sm:text-right">
            <span className="block">発送済みの内容を修正する場合は管理者への申請が必要です。</span>
            <Link
              href="/support/shipment-adjustment"
              className="mt-1 inline-flex items-center text-sky-600 underline-offset-2 hover:underline"
            >
              申請フォームを開く
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="gap-6">
        <ShipmentHistoryTable shipments={shipments} />
      </CardContent>
    </Card>
  );
}

import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrdersRefreshButton } from "@/components/orders/orders-refresh-button";
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
      <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl font-semibold">
              発送履歴一覧
            </CardTitle>
            <OrdersRefreshButton />
          </div>
          <p className="text-sm text-slate-500">
            登録済みの発送履歴を確認し、必要に応じて未発送へ戻せます。
          </p>
        </div>
      </CardHeader>
      <CardContent className="gap-6">
        <ShipmentHistoryTable shipments={shipments} />
      </CardContent>
    </Card>
  );
}

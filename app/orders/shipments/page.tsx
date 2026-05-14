import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader, Surface } from "@/components/ui/page-shell";
import { OrdersRefreshButton } from "@/components/orders/orders-refresh-button";
import { OrdersRealtimeListener } from "@/components/orders/orders-realtime-listener";
import { ShipmentHistoryTable } from "@/components/orders/shipment-history-table";
import { getShipmentHistory } from "@/lib/data/orders";
import { getAuthContext } from "@/lib/auth";

export default async function ShipmentsPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/orders/shipments")}`);
  }

  if (auth.role === "admin") {
    redirect("/admin");
  }

  if (auth.role === "pending_vendor" && auth.vendorId === null) {
    redirect("/pending");
  }

  if (auth.vendorId === null) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/orders/shipments")}`);
  }

  const shipments = await getShipmentHistory(auth.vendorId);

  return (
    <div className="grid gap-5">
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <PageHeader
        eyebrow="History"
        title="発送履歴"
        description="発送済みの追跡番号、配送業者、Shopify 反映状態を確認できます。修正が必要な場合は依頼フォームから管理者へ連絡してください。"
        actions={
          <>
          <Link
            href="/orders"
            className={buttonClasses('ghost', 'text-sm')}
          >
            注文一覧に戻る
          </Link>
            <OrdersRefreshButton />
            <Link
              href="/support/shipment-adjustment"
              className={buttonClasses('outline', 'text-sm')}
            >
              修正を依頼
            </Link>
          </>
        }
      />
      <Surface className="p-3 sm:p-4">
        <ShipmentHistoryTable shipments={shipments} />
      </Surface>
    </div>
  );
}

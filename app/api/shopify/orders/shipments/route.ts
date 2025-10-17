import { NextResponse } from "next/server";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import { upsertShipment } from "@/lib/data/orders";
import { getServerActionClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const body = await request.json();

  const { orderIds, trackingNumber, carrier } = body ?? {};
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds is required" }, { status: 400 });
  }

  if (typeof trackingNumber !== "string" || trackingNumber.trim().length === 0) {
    return NextResponse.json({ error: "trackingNumber is required" }, { status: 400 });
  }

  if (typeof carrier !== "string" || carrier.trim().length === 0) {
    return NextResponse.json({ error: "carrier is required" }, { status: 400 });
  }

  try {
    const supabase = getServerActionClient();

    const processedOrders: number[] = [];

    for (const orderId of orderIds) {
      if (typeof orderId !== "number") {
        continue;
      }

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("line_items")
        .select("id, vendor_id")
        .eq("order_id", orderId)
        .eq("vendor_id", auth.vendorId);

      if (lineItemsError) {
        console.error("Failed to load line items", lineItemsError);
        return NextResponse.json({ error: "failed" }, { status: 500 });
      }

      if (!lineItems || lineItems.length === 0) {
        continue;
      }

      const lineItemIds = lineItems.map((item) => Number(item.id));

      await upsertShipment(
        {
          lineItemIds,
          trackingNumber,
          carrier,
          status: "shipped",
        },
        auth.vendorId,
      );

      processedOrders.push(orderId);
    }

    if (processedOrders.length === 0) {
      return NextResponse.json(
        { error: "発送できる注文が見つかりませんでした" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, processedOrders }, { status: 200 });
  } catch (error) {
    console.error("Failed to create bulk shipment", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

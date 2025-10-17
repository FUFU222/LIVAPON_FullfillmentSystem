import { NextResponse } from "next/server";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import { upsertShipment } from "@/lib/data/orders";
import { getServerActionClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const body = await request.json();

  const { orderId, trackingNumber, carrier } = body ?? {};

  if (typeof orderId !== "number") {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  if (typeof trackingNumber !== "string" || trackingNumber.trim().length === 0) {
    return NextResponse.json({ error: "trackingNumber is required" }, { status: 400 });
  }

  if (typeof carrier !== "string" || carrier.trim().length === 0) {
    return NextResponse.json({ error: "carrier is required" }, { status: 400 });
  }

  try {
    const supabase = getServerActionClient();

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
      return NextResponse.json(
        { error: "対象の注文に発送可能な明細がありません" },
        { status: 400 },
      );
    }

    const lineItemIds = lineItems.map((item) => item.id as number);

    await upsertShipment(
      {
        lineItemIds,
        trackingNumber,
        carrier,
        status: "shipped",
      },
      auth.vendorId,
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to create bulk shipment", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import { upsertShipment } from "@/lib/data/orders";
import { getServerActionClient } from "@/lib/supabase/server";

type ShipmentRequestItem = {
  orderId: number;
  lineItemId: number;
  quantity?: number | null;
};

function isValidItem(value: unknown): value is ShipmentRequestItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { orderId, lineItemId } = value as ShipmentRequestItem;
  return Number.isInteger(orderId) && Number.isInteger(lineItemId);
}

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const body = await request.json();
  const { items, trackingNumber, carrier } = body ?? {};

  if (!Array.isArray(items) || items.length === 0 || !items.every(isValidItem)) {
    return NextResponse.json({ error: "line item selections are required" }, { status: 400 });
  }

  if (typeof trackingNumber !== "string" || trackingNumber.trim().length === 0) {
    return NextResponse.json({ error: "trackingNumber is required" }, { status: 400 });
  }

  if (typeof carrier !== "string" || carrier.trim().length === 0) {
    return NextResponse.json({ error: "carrier is required" }, { status: 400 });
  }

  try {
    const supabase = getServerActionClient();
    const grouped = new Map<number, ShipmentRequestItem[]>();

    for (const item of items) {
      const normalizedQuantity = typeof item.quantity === "number" && item.quantity > 0 ? Math.floor(item.quantity) : null;
      const normalized: ShipmentRequestItem = {
        orderId: item.orderId,
        lineItemId: item.lineItemId,
        quantity: normalizedQuantity
      };
      const entry = grouped.get(item.orderId) ?? [];
      entry.push(normalized);
      grouped.set(item.orderId, entry);
    }

    const processedOrders: number[] = [];

    for (const [orderId, orderItems] of grouped.entries()) {
      const lineItemIds = orderItems.map((item) => item.lineItemId);

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("line_items")
        .select(
          "id, vendor_id, order_id, quantity, fulfilled_quantity, fulfillable_quantity"
        )
        .eq("order_id", orderId)
        .eq("vendor_id", auth.vendorId)
        .in("id", lineItemIds);

      if (lineItemsError) {
        console.error("Failed to load line items", lineItemsError);
        return NextResponse.json({ error: "failed" }, { status: 500 });
      }

      if (!lineItems || lineItems.length === 0) {
        continue;
      }

      const validLineItems = new Map<number, { quantity: number; fulfilled_quantity: number | null; fulfillable_quantity: number | null }>();
      lineItems.forEach((item) => {
        validLineItems.set(Number(item.id), {
          quantity: item.quantity ?? 0,
          fulfilled_quantity: item.fulfilled_quantity ?? null,
          fulfillable_quantity: item.fulfillable_quantity ?? null
        });
      });

      const quantityMap: Record<number, number> = {};

      orderItems.forEach((item) => {
        const record = validLineItems.get(item.lineItemId);
        if (!record) {
          return;
        }
        const fulfilled = record.fulfilled_quantity ?? 0;
        const available = typeof record.fulfillable_quantity === "number"
          ? Math.max(record.fulfillable_quantity, 0)
          : Math.max(record.quantity - fulfilled, 0);

        if (available <= 0) {
          return;
        }

        const requested = item.quantity ?? available;
        quantityMap[item.lineItemId] = Math.max(1, Math.min(available, requested));
      });

      const selectedLineItemIds = Object.keys(quantityMap).map((id) => Number(id));
      if (selectedLineItemIds.length === 0) {
        continue;
      }

      await upsertShipment(
        {
          lineItemIds: selectedLineItemIds,
          lineItemQuantities: quantityMap,
          trackingNumber,
          carrier,
          status: "shipped"
        },
        auth.vendorId
      );

      processedOrders.push(orderId);
    }

    if (processedOrders.length === 0) {
      return NextResponse.json(
        { error: "発送できる明細が見つかりませんでした" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, processedOrders }, { status: 200 });
  } catch (error) {
    console.error("Failed to create bulk shipment", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

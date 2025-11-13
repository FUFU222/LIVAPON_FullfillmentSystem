import { NextResponse } from "next/server";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import { registerShipmentsFromSelections, type ShipmentSelection } from "@/lib/data/orders";

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

  const normalizedItems: ShipmentSelection[] = items.map((item) => ({
    orderId: item.orderId,
    lineItemId: item.lineItemId,
    quantity:
      typeof item.quantity === "number" && item.quantity > 0
        ? Math.floor(item.quantity)
        : null
  }));

  try {
    const processedOrders = await registerShipmentsFromSelections(normalizedItems, auth.vendorId, {
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim()
    });

    return NextResponse.json({ ok: true, processedOrders }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';
    const isClientError =
      message === 'line item selections are required' ||
      message === '発送できる明細が見つかりませんでした';

    if (!isClientError) {
      console.error("Failed to create bulk shipment", error);
    }

    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 });
  }
}

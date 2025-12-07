import { NextResponse } from "next/server";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import { type ShipmentSelection } from "@/lib/data/orders";
import { createShipmentImportJob } from "@/lib/data/shipment-import-jobs";

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
    const job = await createShipmentImportJob({
      vendorId: auth.vendorId,
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim(),
      selections: normalizedItems
    });

    return NextResponse.json({ ok: true, jobId: job.jobId, totalCount: job.totalCount }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';
    const isClientError = clientErrorMessages.has(message);

    if (!isClientError) {
      console.error("Failed to enqueue shipment import job", error);
    }

    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 });
  }
}

const clientErrorMessages = new Set([
  'line item selections are required',
  '発送できる明細が見つかりませんでした',
  'A valid vendorId is required to create shipment jobs'
]);

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import {
  registerShipmentsFromSelections,
  resyncPendingShipments,
  type ShipmentSelection
} from "@/lib/data/orders";
import {
  validateShipmentSelectionsForVendor
} from "@/lib/data/shipment-import-jobs";
import { isSameOriginRequest } from "@/lib/security/csrf";

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
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const body = await request.json();
  const { items, trackingNumber, carrier, requestId: rawRequestId } = body ?? {};

  if (!Array.isArray(items) || items.length === 0 || !items.every(isValidItem)) {
    return NextResponse.json({ error: "line item selections are required" }, { status: 400 });
  }

  if (typeof trackingNumber !== "string" || trackingNumber.trim().length === 0) {
    return NextResponse.json({ error: "trackingNumber is required" }, { status: 400 });
  }

  if (typeof carrier !== "string" || carrier.trim().length === 0) {
    return NextResponse.json({ error: "carrier is required" }, { status: 400 });
  }

  if (rawRequestId !== undefined && (typeof rawRequestId !== "string" || !isUuid(rawRequestId))) {
    return NextResponse.json({ error: "requestId must be a UUID" }, { status: 400 });
  }

  const requestId = typeof rawRequestId === "string" ? rawRequestId : randomUUID();

  const normalizedItems: ShipmentSelection[] = items.map((item) => ({
    orderId: item.orderId,
    lineItemId: item.lineItemId,
    quantity:
      typeof item.quantity === "number" && item.quantity > 0
        ? Math.floor(item.quantity)
        : null
  }));

  const selectionsAuthorized = await validateShipmentSelectionsForVendor(auth.vendorId, normalizedItems);
  if (!selectionsAuthorized) {
    return NextResponse.json({ error: "Unauthorized line item selections" }, { status: 403 });
  }

  try {
    const result = await registerShipmentsFromSelections(normalizedItems, auth.vendorId, {
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim(),
      requestId,
      actorUserId: auth.user?.id ?? null
    });

    void resyncPendingShipments({ limit: 1 }).catch((processError) => {
      console.error('Failed to resync shipment asynchronously', processError);
    });

    return NextResponse.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';
    const isClientError = clientErrorMessages.has(message);
    const status = message === conflictErrorMessage ? 409 : isClientError ? 400 : 500;

    if (!isClientError) {
      console.error("Failed to register shipments", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const conflictErrorMessage = 'Shipment request payload conflicts with a previous registration';

const clientErrorMessages = new Set([
  'line item selections are required',
  'Unauthorized line item selections',
  '発送できる明細が見つかりませんでした',
  'A valid vendorId is required to register shipments',
  conflictErrorMessage
]);

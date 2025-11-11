import type {
  LineItemShipment,
  OrderDetail,
  OrderSummary,
  OrderShipment,
  RawOrderRecord,
  RawShipmentPivot
} from './types';

function deriveVendorCode(sku: string | null): string | null {
  if (!sku || sku.length < 4) {
    return null;
  }
  return sku.slice(0, 4);
}

function calculateShipmentProgress(
  lineItem: {
    quantity: number;
    fulfilledQuantity: number | null;
    fulfillableQuantity: number | null;
    shipments: LineItemShipment[];
  }
) {
  const shippedFromShipments = lineItem.shipments.reduce((total, shipment) => {
    return total + Math.max(0, shipment.quantity ?? 0);
  }, 0);

  const shippedQuantity = Math.min(
    lineItem.quantity,
    Math.max(lineItem.fulfilledQuantity ?? 0, shippedFromShipments)
  );

  const fallbackRemaining = Math.max(lineItem.quantity - shippedQuantity, 0);
  const remainingQuantity =
    typeof lineItem.fulfillableQuantity === 'number'
      ? Math.max(0, Math.min(lineItem.fulfillableQuantity, fallbackRemaining))
      : fallbackRemaining;

  return {
    shippedQuantity,
    remainingQuantity
  };
}

export function mapDetailToSummary(order: OrderDetail): OrderSummary {
  const trackingNumbers = new Set<string>();
  order.shipments.forEach((shipment) => {
    if (shipment.trackingNumber) {
      trackingNumbers.add(shipment.trackingNumber);
    }
  });

  const lineItemProgress = order.lineItems.map((lineItem) => ({
    shippedQuantity: lineItem.shippedQuantity,
    remainingQuantity: lineItem.remainingQuantity
  }));

  const hasLineItems = lineItemProgress.length > 0;
  const fullyShipped = hasLineItems && lineItemProgress.every((item) => item.remainingQuantity <= 0);
  const partiallyShipped =
    hasLineItems && !fullyShipped && lineItemProgress.some((item) => item.shippedQuantity > 0);

  let derivedStatus: string | null = null;
  if (order.status === 'cancelled') {
    // キャンセルされた注文は発送状況に関係なくキャンセル扱い
    derivedStatus = 'cancelled';
  } else if (fullyShipped) {
    derivedStatus = 'fulfilled';
  } else if (partiallyShipped) {
    derivedStatus = 'partially_fulfilled';
  } else {
    derivedStatus = 'unfulfilled';
  }

  const isArchived = Boolean(order.archivedAt);

  const shippingLines: string[] = [];
  if (order.shippingPostal) {
    shippingLines.push(`〒${order.shippingPostal}`);
  }
  const baseLine = [order.shippingPrefecture, order.shippingCity, order.shippingAddress1]
    .filter((part) => Boolean(part && part.trim().length > 0))
    .join(' ')
    .trim();
  if (baseLine.length > 0) {
    shippingLines.push(baseLine);
  }
  if (order.shippingAddress2 && order.shippingAddress2.trim().length > 0) {
    shippingLines.push(order.shippingAddress2);
  }

  const shippingAddress = shippingLines.length > 0 ? shippingLines.join(' ') : null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    lineItemCount: order.lineItems.length,
    status: derivedStatus,
    shopifyStatus: order.status,
    isArchived,
    shippingAddress,
    shippingAddressLines: shippingLines,
    trackingNumbers: Array.from(trackingNumbers),
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
    lineItems: order.lineItems.map((lineItem) => ({
      id: lineItem.id,
      orderId: order.id,
      productName: lineItem.productName,
      sku: lineItem.sku,
      variantTitle: lineItem.variantTitle,
      quantity: lineItem.quantity,
      fulfilledQuantity: lineItem.fulfilledQuantity,
      fulfillableQuantity: lineItem.fulfillableQuantity,
      shippedQuantity: lineItem.shippedQuantity,
      remainingQuantity: lineItem.remainingQuantity,
      shipments: lineItem.shipments
    }))
  };
}

export function toOrderDetailFromRecord(
  record: RawOrderRecord,
  vendorId?: number | null
): OrderDetail | null {
  const shouldFilterByVendor = typeof vendorId === 'number' && Number.isInteger(vendorId);

  const rawLineItems = Array.isArray(record.line_items)
    ? shouldFilterByVendor
      ? record.line_items.filter((item) => item.vendor_id === vendorId)
      : record.line_items
    : [];

  if (shouldFilterByVendor && rawLineItems.length === 0) {
    return null;
  }

  const shipmentMap = new Map<number, OrderShipment>();
  const lineItemShipmentIds = new Map<number, Array<{ shipmentId: number; quantity: number | null }>>();
  const uniqueLineItems = new Map<number, (typeof rawLineItems)[number]>();

  rawLineItems.forEach((item) => {
    const pivots = Array.isArray(item.shipments) ? item.shipments : [];
    if (!uniqueLineItems.has(item.id)) {
      uniqueLineItems.set(item.id, item);
    }
    pivots.forEach((pivot) => {
      const shipmentRecord = pivot.shipment;
      if (!shipmentRecord) {
        return;
      }
      const existing = shipmentMap.get(shipmentRecord.id);
      if (!existing) {
        shipmentMap.set(shipmentRecord.id, {
          id: shipmentRecord.id,
          trackingNumber: shipmentRecord.tracking_number ?? null,
          carrier: shipmentRecord.carrier ?? null,
          status: shipmentRecord.status ?? null,
          shippedAt: shipmentRecord.shipped_at ?? null,
          lineItemIds: [item.id]
        });
      } else if (!existing.lineItemIds.includes(item.id)) {
        existing.lineItemIds.push(item.id);
      }

      const list = lineItemShipmentIds.get(item.id) ?? [];
      list.push({ shipmentId: shipmentRecord.id, quantity: pivot.quantity ?? null });
      lineItemShipmentIds.set(item.id, list);
    });
  });

  const shipments = Array.from(shipmentMap.values());
  const shipmentLookup = new Map(shipments.map((shipment) => [shipment.id, shipment] as const));

  const lineItems = Array.from(uniqueLineItems.values()).map((item) => {
    const shipmentRefs = lineItemShipmentIds.get(item.id) ?? [];
    const shipmentsForLineItem: LineItemShipment[] = shipmentRefs
      .map(({ shipmentId, quantity }) => {
        const shipment = shipmentLookup.get(shipmentId);
        if (!shipment) {
          return null;
        }
        return {
          ...shipment,
          quantity
        } satisfies LineItemShipment;
      })
      .filter((value): value is LineItemShipment => value !== null);

    const { shippedQuantity, remainingQuantity } = calculateShipmentProgress({
      quantity: item.quantity,
      fulfilledQuantity: item.fulfilled_quantity ?? null,
      fulfillableQuantity: item.fulfillable_quantity ?? null,
      shipments: shipmentsForLineItem
    });

    return {
      id: item.id,
      sku: item.sku ?? null,
      variantTitle: item.variant_title ?? null,
      vendorId: item.vendor_id ?? null,
      vendorCode: item.vendor?.code ?? deriveVendorCode(item.sku ?? null),
      vendorName: item.vendor?.name ?? null,
      productName: item.product_name,
      quantity: item.quantity,
      fulfilledQuantity: item.fulfilled_quantity ?? null,
      fulfillableQuantity: item.fulfillable_quantity ?? null,
      shippedQuantity,
      remainingQuantity,
      shipments: shipmentsForLineItem
    };
  });

  return {
    id: record.id,
    orderNumber: record.order_number,
    customerName: record.customer_name ?? null,
    status: record.status ?? null,
    updatedAt: record.updated_at ?? null,
    createdAt: (record as { created_at?: string | null }).created_at ?? null,
    archivedAt: record.archived_at ?? null,
    shippingPostal: record.shipping_postal ?? null,
    shippingPrefecture: record.shipping_prefecture ?? null,
    shippingCity: record.shipping_city ?? null,
    shippingAddress1: record.shipping_address1 ?? null,
    shippingAddress2: record.shipping_address2 ?? null,
    shipments,
    lineItems
  };
}

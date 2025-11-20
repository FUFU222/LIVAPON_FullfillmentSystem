import type {
  LineItemShipment,
  OrderDetail,
  OrderSummary,
  OrderShipment,
  RawOrderRecord,
  RawShipmentPivot
} from './types';

const KNOWN_ORDER_STATUSES = new Set([
  'unfulfilled',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
  'restocked'
]);

function normalizeOrderStatus(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().trim();
  return KNOWN_ORDER_STATUSES.has(normalized) ? normalized : null;
}

function deriveVendorCode(sku: string | null): string | null {
  if (!sku || sku.length < 4) {
    return null;
  }
  return sku.slice(0, 4);
}

function dedupeOrderLineItems(lineItems: OrderDetail['lineItems']): OrderDetail['lineItems'] {
  const map = new Map<number, OrderDetail['lineItems'][number]>();

  lineItems.forEach((item) => {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, { ...item, shipments: [...item.shipments] });
      return;
    }

    const seen = new Set(existing.shipments.map((shipment) => shipment.id));
    const mergedShipments = [...existing.shipments];
    item.shipments.forEach((shipment) => {
      if (!seen.has(shipment.id)) {
        seen.add(shipment.id);
        mergedShipments.push(shipment);
      }
    });

    map.set(item.id, { ...existing, shipments: mergedShipments });
  });

  return Array.from(map.values());
}

function calculateShipmentProgress(
  lineItem: {
    quantity: number;
    fulfilledQuantity: number | null;
    fulfillableQuantity: number | null;
    shipments: LineItemShipment[];
  }
) {
  const activeShipments = lineItem.shipments.filter((shipment) => {
    const status = shipment.status?.toLowerCase();
    return status !== 'cancelled' && status !== 'canceled';
  });

  const shippedFromShipments = activeShipments.reduce((total, shipment) => {
    return total + Math.max(0, shipment.quantity ?? 0);
  }, 0);

  const shopifyRemaining =
    typeof lineItem.fulfillableQuantity === 'number'
      ? Math.max(0, lineItem.fulfillableQuantity)
      : null;

  const shopifyFulfilled = (() => {
    if (shopifyRemaining !== null) {
      return Math.max(0, lineItem.quantity - shopifyRemaining);
    }
    if (typeof lineItem.fulfilledQuantity === 'number') {
      return Math.max(0, lineItem.fulfilledQuantity);
    }
    return null;
  })();

  const shippedQuantity = (() => {
    if (shopifyFulfilled !== null) {
      return Math.min(lineItem.quantity, shopifyFulfilled);
    }
    if (activeShipments.length > 0) {
      return Math.min(lineItem.quantity, shippedFromShipments);
    }
    return 0;
  })();

  const fallbackRemaining = Math.max(lineItem.quantity - shippedQuantity, 0);
  const remainingQuantity = shopifyRemaining !== null ? shopifyRemaining : fallbackRemaining;

  return {
    shippedQuantity,
    remainingQuantity
  };
}

export function mapDetailToSummary(order: OrderDetail): OrderSummary {
  const lineItems = dedupeOrderLineItems(order.lineItems);
  console.info('[orders-line-items]', {
    orderNumber: order.orderNumber,
    items: lineItems.map((item) => ({
      id: item.id,
      vendorId: item.vendorId,
      quantity: item.quantity,
      shippedQuantity: item.shippedQuantity,
      remainingQuantity: item.remainingQuantity,
      shipments: item.shipments.map((shipment) => ({
        id: shipment.id,
        quantity: shipment.quantity,
        carrier: shipment.carrier
      })),
      rawShipments: JSON.stringify(item.shipments)
    }))
  });
  const trackingNumbers = new Set<string>();
  order.shipments.forEach((shipment) => {
    if (shipment.trackingNumber) {
      trackingNumbers.add(shipment.trackingNumber);
    }
  });

  const lineItemProgress = lineItems.map((lineItem) => ({
    shippedQuantity: lineItem.shippedQuantity,
    remainingQuantity: lineItem.remainingQuantity
  }));

  const hasLineItems = lineItemProgress.length > 0;
  const fullyShipped = hasLineItems && lineItemProgress.every((item) => item.remainingQuantity <= 0);
  const partiallyShipped =
    hasLineItems && !fullyShipped && lineItemProgress.some((item) => item.shippedQuantity > 0);

  const localStatus: string | null = (() => {
    if (order.status === 'cancelled') {
      return 'cancelled';
    }
    if (fullyShipped) {
      return 'fulfilled';
    }
    if (partiallyShipped) {
      return 'partially_fulfilled';
    }
    return 'unfulfilled';
  })();

  const shopifyStatus = normalizeOrderStatus(order.status);
  const resolvedStatus: string = (() => {
    if (shopifyStatus === 'cancelled') {
      return 'cancelled';
    }
    if (localStatus === 'fulfilled' || localStatus === 'partially_fulfilled') {
      return localStatus;
    }
    if (shopifyStatus) {
      return shopifyStatus;
    }
    return localStatus ?? 'unfulfilled';
  })();

  console.info('[orders-status]', {
    orderNumber: order.orderNumber,
    resolvedStatus,
    shopifyStatus,
    localStatus
  });

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
    status: resolvedStatus,
    shopifyStatus,
    localStatus,
    isArchived,
    shippingAddress,
    shippingAddressLines: shippingLines,
    trackingNumbers: Array.from(trackingNumbers),
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
    lineItems: lineItems.map((lineItem) => ({
      id: lineItem.id,
      orderId: order.id,
      productName: lineItem.productName,
      sku: lineItem.sku,
      variantTitle: lineItem.variantTitle,
      vendorId: lineItem.vendorId,
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
      const shipmentRecord = (pivot as any)?.shipment ?? pivot;
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
      const pivotQuantity = typeof pivot.quantity === 'number'
        ? pivot.quantity
        : typeof (pivot as any)?.quantity === 'number'
          ? (pivot as any)?.quantity
          : null;
      list.push({ shipmentId: shipmentRecord.id, quantity: pivotQuantity });
      lineItemShipmentIds.set(item.id, list);
    });
  });

  const shipments = Array.from(shipmentMap.values());
  const shipmentLookup = new Map(shipments.map((shipment) => [shipment.id, shipment] as const));

  const detailLineItems = Array.from(uniqueLineItems.values()).map((item) => {
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

  const detailProgress = detailLineItems.map((item) => ({
    shippedQuantity: item.shippedQuantity,
    remainingQuantity: item.remainingQuantity
  }));
  const detailHasItems = detailProgress.length > 0;
  const detailFullyShipped = detailHasItems && detailProgress.every((p) => p.remainingQuantity <= 0);
  const detailPartiallyShipped =
    detailHasItems && !detailFullyShipped && detailProgress.some((p) => p.shippedQuantity > 0);

  const detailLocalStatus: string | null = (() => {
    if ((record.status ?? '').toLowerCase() === 'cancelled') {
      return 'cancelled';
    }
    if (detailFullyShipped) {
      return 'fulfilled';
    }
    if (detailPartiallyShipped) {
      return 'partially_fulfilled';
    }
    return 'unfulfilled';
  })();

  const detailShopifyStatus = normalizeOrderStatus(record.status);
  const detailResolvedStatus: string = (() => {
    if (detailShopifyStatus === 'cancelled') {
      return 'cancelled';
    }
    if (detailLocalStatus === 'fulfilled' || detailLocalStatus === 'partially_fulfilled') {
      return detailLocalStatus;
    }
    if (detailShopifyStatus) {
      return detailShopifyStatus;
    }
    return detailLocalStatus ?? 'unfulfilled';
  })();

  return {
    id: record.id,
    orderNumber: record.order_number,
    customerName: record.customer_name ?? null,
    status: detailResolvedStatus,
    shopifyStatus: detailShopifyStatus ?? null,
    localStatus: detailLocalStatus,
    updatedAt: record.updated_at ?? null,
    createdAt: (record as { created_at?: string | null }).created_at ?? null,
    archivedAt: record.archived_at ?? null,
    shippingPostal: record.shipping_postal ?? null,
    shippingPrefecture: record.shipping_prefecture ?? null,
    shippingCity: record.shipping_city ?? null,
    shippingAddress1: record.shipping_address1 ?? null,
    shippingAddress2: record.shipping_address2 ?? null,
    shipments,
    lineItems: detailLineItems
  };
}

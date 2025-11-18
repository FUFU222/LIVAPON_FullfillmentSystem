import type { AdminOrderPreview, OrderDetail, OrderSummary, RawOrderRecord, ShipmentHistoryEntry } from './types';
import { getOptionalServiceClient } from './clients';
import { mapDetailToSummary, toOrderDetailFromRecord } from './transformers';
import {
  getDemoOrderDetail,
  getDemoOrderDetailForAdmin,
  getDemoShipmentHistory,
  getDemoSummaries
} from './demo';

export async function getRecentOrdersForAdmin(limit = 5): Promise<AdminOrderPreview[]> {
  const client = getOptionalServiceClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at, created_at,
       vendor:vendor_id ( id, code, name )`
    )
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to load recent orders for admin', error);
    return [];
  }

  return (data ?? []).map((order: any) => {
    const vendor = order.vendor ?? null;

    return {
      id: order.id as number,
      orderNumber: order.order_number as string,
      vendorId: vendor?.id ?? null,
      vendorCode: vendor?.code ?? null,
      vendorName: vendor?.name ?? null,
      customerName: (order.customer_name ?? null) as string | null,
      status: (order.status ?? null) as string | null,
      updatedAt: (order.updated_at ?? null) as string | null
    } satisfies AdminOrderPreview;
  });
}

export async function getOrders(vendorId: number): Promise<OrderSummary[]> {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to load orders');
  }

  const client = getOptionalServiceClient();

  if (!client) {
    return getDemoSummaries(vendorId);
  }

  const { data, error } = await client
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at, created_at, archived_at,
       shipping_postal, shipping_prefecture, shipping_city, shipping_address1, shipping_address2,
       line_items:line_items!inner(
         id, vendor_id, sku, product_name, variant_title, quantity, fulfilled_quantity, fulfillable_quantity,
         vendor:vendor_id(id, code, name),
         shipments:shipment_line_items(
           quantity,
           shipment:shipments(id, vendor_id, tracking_number, carrier, status, shipped_at)
         )
       )`
    )
    .eq('line_items.vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Failed to load orders', error);
    return [];
  }

  return (data as RawOrderRecord[])
    .map((record) => toOrderDetailFromRecord(record, vendorId))
    .filter((order): order is OrderDetail => order !== null)
    .map(mapDetailToSummary);
}

export async function getOrderDetail(vendorId: number, id: number): Promise<OrderDetail | null> {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to load order detail');
  }

  const client = getOptionalServiceClient();

  if (!client) {
    return getDemoOrderDetail(vendorId, id);
  }

  const { data, error } = await client
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at, created_at, archived_at,
       shipping_postal, shipping_prefecture, shipping_city, shipping_address1, shipping_address2,
       line_items:line_items(
         id, vendor_id, sku, product_name, variant_title, quantity, fulfilled_quantity, fulfillable_quantity,
         vendor:vendor_id(id, code, name),
         shipments:shipment_line_items(
           quantity,
           shipment:shipments(id, vendor_id, tracking_number, carrier, status, shipped_at)
         )
       )`
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load order detail', error);
    return null;
  }

  return toOrderDetailFromRecord(data as RawOrderRecord, vendorId);
}

export async function getOrderDetailForAdmin(id: number): Promise<OrderDetail | null> {
  const client = getOptionalServiceClient();

  if (!client) {
    return getDemoOrderDetailForAdmin(id);
  }

  const { data, error } = await client
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at, archived_at,
       shipping_postal, shipping_prefecture, shipping_city, shipping_address1, shipping_address2,
       line_items:line_items(
         id, vendor_id, sku, product_name, variant_title, quantity, fulfilled_quantity, fulfillable_quantity,
         vendor:vendor_id(id, code, name),
         shipments:shipment_line_items(
           quantity,
           shipment:shipments(id, vendor_id, tracking_number, carrier, status, shipped_at)
         )
       )`
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load admin order detail', error);
    return null;
  }

  return toOrderDetailFromRecord(data as RawOrderRecord);
}

export async function getShipmentHistory(vendorId: number): Promise<ShipmentHistoryEntry[]> {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to load shipments');
  }

  const client = getOptionalServiceClient();

  if (!client) {
    return getDemoShipmentHistory(vendorId);
  }

  const { data, error } = await client
    .from('shipments')
    .select(
      `id, tracking_number, carrier, shipped_at, sync_status, status, order_id,
       order:orders(id, order_number, status, customer_name,
                    shipping_postal, shipping_prefecture, shipping_city, shipping_address1, shipping_address2)`
    )
    .eq('vendor_id', vendorId)
    .order('shipped_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load shipment history', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as number,
    orderId: row.order_id ?? row.order?.id ?? null,
    orderNumber:
      (row.order?.order_number as string | undefined) ??
      (row.order_id ? `#${row.order_id}` : '注文未取得'),
    orderStatus: (row.order?.status ?? null) as string | null,
    shipmentStatus: (row.status ?? null) as string | null,
    customerName: (row.order?.customer_name ?? null) as string | null,
    shippingAddress: buildShippingAddress(row.order),
    trackingNumber: (row.tracking_number ?? null) as string | null,
    carrier: (row.carrier ?? null) as string | null,
    shippedAt: (row.shipped_at ?? null) as string | null,
    syncStatus: (row.sync_status ?? null) as string | null
  }));
}

function buildShippingAddress(
  order:
    | {
        shipping_postal?: string | null;
        shipping_prefecture?: string | null;
        shipping_city?: string | null;
        shipping_address1?: string | null;
        shipping_address2?: string | null;
      }
    | null
) {
  if (!order) {
    return null;
  }

  const lines: string[] = [];
  if (order.shipping_postal) {
    lines.push(`〒${order.shipping_postal}`);
  }
  const baseLine = [order.shipping_prefecture, order.shipping_city, order.shipping_address1]
    .filter((part) => (part ?? '').trim().length > 0)
    .join(' ');
  if (baseLine.length > 0) {
    lines.push(baseLine);
  }
  if (order.shipping_address2 && order.shipping_address2.trim().length > 0) {
    lines.push(order.shipping_address2.trim());
  }
  return lines.length > 0 ? lines.join(' ') : null;
}

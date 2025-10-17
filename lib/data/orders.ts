import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import type { Database } from '@/lib/supabase/types';
import {
  cancelShopifyFulfillment,
  loadShopifyAccessToken,
  syncShipmentWithShopify
} from '@/lib/shopify/fulfillment';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient: SupabaseClient<Database> | null = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })
  : null;

export type OrderShipment = {
  id: number;
  trackingNumber: string | null;
  carrier: string | null;
  status: string | null;
  shippedAt: string | null;
  lineItemIds: number[];
};

export type LineItemShipment = OrderShipment & {
  quantity: number | null;
};

export type OrderDetail = {
  id: number;
  orderNumber: string;
  customerName: string | null;
  status: string | null;
  updatedAt: string | null;
  shipments: OrderShipment[];
  lineItems: Array<{
    id: number;
    sku: string | null;
    vendorId: number | null;
    vendorCode: string | null;
    productName: string;
    quantity: number;
    fulfilledQuantity: number | null;
    shipments: LineItemShipment[];
  }>;
};

export type OrderSummary = {
  id: number;
  orderNumber: string;
  customerName: string | null;
  lineItemCount: number;
  status: string | null;
  trackingNumbers: string[];
  updatedAt: string | null;
};

export type AdminOrderPreview = {
  id: number;
  orderNumber: string;
  vendorId: number | null;
  vendorCode: string | null;
  vendorName: string | null;
  customerName: string | null;
  status: string | null;
  updatedAt: string | null;
};

export type ShipmentHistoryEntry = {
  id: number;
  orderId: number | null;
  orderNumber: string;
  orderStatus: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  syncStatus: string | null;
};

const demoOrders: OrderDetail[] = [
  {
    id: 1,
    orderNumber: '#1001',
    customerName: '佐藤 花子',
    status: 'unfulfilled',
    updatedAt: new Date().toISOString(),
    shipments: [
      {
        id: 5001,
        trackingNumber: 'YT123456789JP',
        carrier: 'yamato',
        status: 'in_transit',
        shippedAt: new Date().toISOString(),
        lineItemIds: [101, 102]
      }
    ],
    lineItems: [
      {
        id: 101,
        sku: '0001-001-01',
        vendorId: 1,
        vendorCode: '0001',
        productName: 'プレミアムチェア',
        quantity: 2,
        fulfilledQuantity: 1,
        shipments: [
          {
            id: 5001,
            trackingNumber: 'YT123456789JP',
            carrier: 'yamato',
            status: 'in_transit',
            shippedAt: new Date().toISOString(),
            lineItemIds: [101, 102],
            quantity: 2
          }
        ]
      },
      {
        id: 102,
        sku: '0001-002-01',
        vendorId: 1,
        vendorCode: '0001',
        productName: '交換用クッション',
        quantity: 1,
        fulfilledQuantity: 0,
        shipments: [
          {
            id: 5001,
            trackingNumber: 'YT123456789JP',
            carrier: 'yamato',
            status: 'in_transit',
            shippedAt: new Date().toISOString(),
            lineItemIds: [101, 102],
            quantity: 1
          }
        ]
      }
    ]
  },
  {
    id: 2,
    orderNumber: '#1002',
    customerName: 'John Doe',
    status: 'partially_fulfilled',
    updatedAt: new Date().toISOString(),
    shipments: [],
    lineItems: [
      {
        id: 201,
        sku: '0002-001-01',
        vendorId: 2,
        vendorCode: '0002',
        productName: 'デスクライト',
        quantity: 1,
        fulfilledQuantity: 0,
        shipments: []
      }
    ]
  }
];

function deriveVendorCode(sku: string | null): string | null {
  if (!sku || sku.length < 4) {
    return null;
  }
  return sku.slice(0, 4);
}

function mapDetailToSummary(order: OrderDetail): OrderSummary {
  const trackingNumbers = new Set<string>();
  order.shipments.forEach((shipment) => {
    if (shipment.trackingNumber) {
      trackingNumbers.add(shipment.trackingNumber);
    }
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    lineItemCount: order.lineItems.length,
    status: order.status,
    trackingNumbers: Array.from(trackingNumbers),
    updatedAt: order.updatedAt
  };
}

type RawShipmentPivot = {
  quantity: number | null;
  shipment: {
    id: number;
    tracking_number: string | null;
    carrier: string | null;
    status: string | null;
    shipped_at: string | null;
    line_item_ids?: number[]; // not provided by supabase, for memo only
  } | null;
};

type RawOrderRecord = {
  id: number;
  order_number: string;
  customer_name: string | null;
  status: string | null;
  updated_at: string | null;
  line_items?: Array<{
    id: number;
    vendor_id: number | null;
    sku: string | null;
    product_name: string;
    quantity: number;
    fulfilled_quantity: number | null;
    shipments?: RawShipmentPivot[];
  }>;
};

function toOrderDetailFromRecord(record: RawOrderRecord, vendorId: number): OrderDetail | null {
  const rawLineItems = Array.isArray(record.line_items)
    ? record.line_items.filter((item) => item.vendor_id === vendorId)
    : [];

  if (rawLineItems.length === 0) {
    return null;
  }

  const shipmentMap = new Map<number, OrderShipment>();
  const lineItemShipmentIds = new Map<number, Array<{ shipmentId: number; quantity: number | null }>>();

  rawLineItems.forEach((item) => {
    const pivots = Array.isArray(item.shipments) ? item.shipments : [];
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

  const lineItems = rawLineItems.map((item) => {
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

    return {
      id: item.id,
      sku: item.sku ?? null,
      vendorId: item.vendor_id ?? null,
      vendorCode: deriveVendorCode(item.sku ?? null),
      productName: item.product_name,
      quantity: item.quantity,
      fulfilledQuantity: item.fulfilled_quantity ?? null,
      shipments: shipmentsForLineItem
    };
  });

  return {
    id: record.id,
    orderNumber: record.order_number,
    customerName: record.customer_name ?? null,
    status: record.status ?? null,
    updatedAt: record.updated_at ?? null,
    shipments,
    lineItems
  };
}

export async function getRecentOrdersForAdmin(limit = 5): Promise<AdminOrderPreview[]> {
  if (!serviceClient) {
    return [];
  }

  const { data, error } = await serviceClient
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at,
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

function toOrderDetailFromDemo(order: OrderDetail, vendorId: number): OrderDetail | null {
  const lineItems = order.lineItems.filter((item) => item.vendorId === vendorId);

  if (lineItems.length === 0) {
    return null;
  }

  const shipmentIds = new Set<number>();
  lineItems.forEach((item) => {
    item.shipments.forEach((shipment) => shipmentIds.add(shipment.id));
  });

  const shipments = order.shipments.filter((shipment) => shipment.lineItemIds.some((id) => shipmentIds.has(id)));

  return {
    ...order,
    lineItems,
    shipments
  };
}

export const getOrders = cache(async (vendorId: number): Promise<OrderSummary[]> => {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to load orders');
  }

  if (!serviceClient) {
    return demoOrders
      .map((order) => toOrderDetailFromDemo(order, vendorId))
      .filter((order): order is OrderDetail => order !== null)
      .map(mapDetailToSummary);
  }

  const { data, error } = await serviceClient
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at,
       line_items:line_items!inner(
         id, vendor_id, sku, product_name, quantity, fulfilled_quantity,
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
});

export const getOrderDetail = cache(async (vendorId: number, id: number): Promise<OrderDetail | null> => {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to load order detail');
  }

  if (!serviceClient) {
    const order = demoOrders
      .map((demo) => toOrderDetailFromDemo(demo, vendorId))
      .find((demo) => demo?.id === id);
    return order ?? null;
  }

  const { data, error } = await serviceClient
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at,
       line_items:line_items(
         id, vendor_id, sku, product_name, quantity, fulfilled_quantity,
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
});

export async function upsertShipment(
  shipment: {
    id?: number;
    lineItemIds: number[];
    trackingNumber: string;
    carrier: string;
    status: string;
    shippedAt?: string | null;
  },
  vendorId: number
) {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }

  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to update shipments');
  }

  const client: SupabaseClient<Database> = serviceClient;

  if (!Array.isArray(shipment.lineItemIds) || shipment.lineItemIds.length === 0) {
    throw new Error('lineItemIds must contain at least one item');
  }

  const { data: lineItems, error: lineItemsError } = await client
    .from('line_items')
    .select('id, vendor_id, order_id, fulfillable_quantity, fulfillment_order_line_item_id, shopify_line_item_id, quantity')
    .in('id', shipment.lineItemIds);

  if (lineItemsError) {
    throw lineItemsError;
  }

  if (!lineItems || lineItems.length !== shipment.lineItemIds.length) {
    throw new Error('Line items not found');
  }

  const unauthorized = lineItems.some((item) => item.vendor_id !== vendorId);
  if (unauthorized) {
    throw new Error('Unauthorized line items included in shipment');
  }

  const orderId = lineItems[0]?.order_id ?? null;
  if (!orderId || lineItems.some((item) => item.order_id !== orderId)) {
    throw new Error('Line items must belong to the same order');
  }

  const nowIso = new Date().toISOString();

  const payload: Database['public']['Tables']['shipments']['Insert'] = {
    tracking_number: shipment.trackingNumber,
    carrier: shipment.carrier,
    status: shipment.status,
    shipped_at: shipment.shippedAt ?? nowIso,
    vendor_id: vendorId,
    order_id: orderId,
    tracking_company: shipment.carrier,
    sync_status: 'pending',
    synced_at: null,
    sync_error: null,
    updated_at: nowIso
  } satisfies Database['public']['Tables']['shipments']['Insert'];

  let shipmentId = shipment.id ?? null;

  if (shipmentId) {
    const { error: updateError } = await client
      .from('shipments')
      .update(payload)
      .eq('id', shipmentId);

    if (updateError) {
      throw updateError;
    }

    const { error: deletePivotError } = await client
      .from('shipment_line_items')
      .delete()
      .eq('shipment_id', shipmentId);

    if (deletePivotError) {
      throw deletePivotError;
    }
  } else {
    const { data: insertData, error: insertError } = await client
      .from('shipments')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    shipmentId = insertData.id;
  }

  const pivotInserts: Database['public']['Tables']['shipment_line_items']['Insert'][] = shipment.lineItemIds.map((lineItemId) => {
    const matching = lineItems.find((item) => item.id === lineItemId);
    return {
      shipment_id: shipmentId as number,
      line_item_id: lineItemId,
      quantity: matching?.fulfillable_quantity ?? matching?.quantity ?? null,
      fulfillment_order_line_item_id: matching?.fulfillment_order_line_item_id ?? null
    };
  });

  const { error: pivotError } = await client
    .from('shipment_line_items')
    .insert(pivotInserts);

  if (pivotError) {
    throw pivotError;
  }

  try {
    await syncShipmentWithShopify(shipmentId as number);
  } catch (error) {
    await client
      .from('shipments')
      .update({
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Shopify 連携で不明なエラーが発生しました',
        updated_at: new Date().toISOString()
      })
      .eq('id', shipmentId as number);

    throw error;
  }
}

export async function updateOrderStatus(orderId: number, status: string, vendorId: number) {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }

  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to update order status');
  }

  const client = serviceClient;

  const { data: permittedLineItem, error: lineItemError } = await client
    .from('line_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('vendor_id', vendorId)
    .limit(1)
    .maybeSingle();

  if (lineItemError) {
    throw lineItemError;
  }

  if (!permittedLineItem) {
    throw new Error('Unauthorized to update this order');
  }

  const { error } = await client
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    throw error;
  }
}

export async function cancelShipment(shipmentId: number, vendorId: number) {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }

  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to cancel shipments');
  }

  const client: SupabaseClient<Database> = serviceClient;

  const { data: shipment, error: shipmentError } = await client
    .from('shipments')
    .select(
      `id, vendor_id, order_id, shopify_fulfillment_id,
       order:orders(id, shop_domain, shopify_order_id),
       line_items:shipment_line_items(line_item_id)`
    )
    .eq('id', shipmentId)
    .maybeSingle();

  if (shipmentError) {
    throw shipmentError;
  }

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  if (shipment.vendor_id !== vendorId) {
    throw new Error('Unauthorized to cancel this shipment');
  }

  const order = shipment.order;
  if (!order) {
    throw new Error('Shipment missing related order');
  }

  if (shipment.shopify_fulfillment_id) {
    const accessToken = await loadShopifyAccessToken(client, order.shop_domain ?? '');
    await cancelShopifyFulfillment(
      order.shop_domain ?? '',
      accessToken,
      shipment.shopify_fulfillment_id
    );
  }

  const { error: deleteError } = await client
    .from('shipments')
    .delete()
    .eq('id', shipment.id);

  if (deleteError) {
    throw deleteError;
  }

  const { count } = await client
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id);

  if (!count) {
    const { error: updateOrderError } = await client
      .from('orders')
      .update({ status: 'unfulfilled', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    if (updateOrderError) {
      throw updateOrderError;
    }
  }
}

export async function getShipmentHistory(vendorId: number): Promise<ShipmentHistoryEntry[]> {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to load shipments');
  }

  if (!serviceClient) {
    return demoOrders
      .flatMap((order) =>
        order.shipments.map((shipment) => ({
          id: shipment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          trackingNumber: shipment.trackingNumber ?? null,
          carrier: shipment.carrier ?? null,
          shippedAt: shipment.shippedAt ?? null,
          syncStatus: shipment.status ?? null
        }))
      )
      .filter((entry) => {
        const matchingOrder = demoOrders.find((order) => order.id === entry.orderId);
        return matchingOrder?.lineItems.some((item) => item.vendorId === vendorId) ?? false;
      })
      .sort((a, b) => (b.shippedAt ?? '').localeCompare(a.shippedAt ?? ''));
  }

  const { data, error } = await serviceClient
    .from('shipments')
    .select(
      `id, tracking_number, carrier, shipped_at, sync_status, status, order_id,
       order:orders(id, order_number, status)`
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
    trackingNumber: (row.tracking_number ?? null) as string | null,
    carrier: (row.carrier ?? null) as string | null,
    shippedAt: (row.shipped_at ?? null) as string | null,
    syncStatus: (row.sync_status ?? row.status ?? null) as string | null
  }));
}

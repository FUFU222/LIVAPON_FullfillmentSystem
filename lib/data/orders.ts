import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';
import type { Database } from '@/lib/supabase/types';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })
  : null;

export type OrderSummary = {
  id: number;
  orderNumber: string;
  customerName: string | null;
  lineItemCount: number;
  status: string | null;
  trackingNumbers: string[];
  updatedAt: string | null;
};

export type OrderDetail = {
  id: number;
  orderNumber: string;
  customerName: string | null;
  status: string | null;
  lineItems: Array<{
    id: number;
    productName: string;
    quantity: number;
    fulfilledQuantity: number | null;
    shipments: Array<{
      id: number;
      trackingNumber: string | null;
      carrier: string | null;
      status: string | null;
      shippedAt: string | null;
    }>;
  }>;
};

const demoOrders: OrderDetail[] = [
  {
    id: 1,
    orderNumber: '#1001',
    customerName: '佐藤 花子',
    status: 'unfulfilled',
    lineItems: [
      {
        id: 101,
        productName: 'プレミアムチェア',
        quantity: 2,
        fulfilledQuantity: 1,
        shipments: [
          {
            id: 10001,
            trackingNumber: 'YT123456789JP',
            carrier: 'yamato',
            status: 'in_transit',
            shippedAt: new Date().toISOString()
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
    lineItems: [
      {
        id: 201,
        productName: 'デスクライト',
        quantity: 1,
        fulfilledQuantity: 0,
        shipments: []
      }
    ]
  }
];

function mapDetailToSummary(order: OrderDetail): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    lineItemCount: order.lineItems.length,
    status: order.status,
    trackingNumbers: order.lineItems
      .flatMap((item) => item.shipments.map((shipment) => shipment.trackingNumber ?? ''))
      .filter(Boolean),
    updatedAt: null
  };
}

export const getOrders = cache(async (): Promise<OrderSummary[]> => {
  if (!serviceClient) {
    return demoOrders.map(mapDetailToSummary);
  }

  const { data: orders, error } = await serviceClient
    .from('orders')
    .select(
      `id, order_number, customer_name, status, updated_at,
       line_items:line_items(id, product_name, quantity,
         shipments(id, tracking_number)
       )`
    )
    .order('created_at', { ascending: false });

  if (error || !orders) {
    console.error('Failed to load orders', error);
    return [];
  }

  return (orders as any[]).map((order) => ({
    id: order.id as number,
    orderNumber: order.order_number as string,
    customerName: (order.customer_name ?? null) as string | null,
    lineItemCount: Array.isArray(order.line_items) ? order.line_items.length : 0,
    status: (order.status ?? null) as string | null,
    trackingNumbers: Array.isArray(order.line_items)
      ? order.line_items.flatMap((item: any) =>
          Array.isArray(item.shipments)
            ? item.shipments.map((shipment: any) => shipment.tracking_number).filter(Boolean)
            : []
        )
      : [],
    updatedAt: (order.updated_at ?? null) as string | null
  }));
});

export const getOrderDetail = cache(async (id: number): Promise<OrderDetail | null> => {
  if (!serviceClient) {
    return demoOrders.find((order) => order.id === id) ?? null;
  }

  const { data, error } = await serviceClient
    .from('orders')
    .select(
      `id, order_number, customer_name, status,
       line_items(id, product_name, quantity, fulfilled_quantity,
         shipments(id, tracking_number, carrier, status, shipped_at)
       )`
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load order detail', error);
    return null;
  }

  const record = data as any;

  return {
    id: record.id as number,
    orderNumber: record.order_number as string,
    customerName: (record.customer_name ?? null) as string | null,
    status: (record.status ?? null) as string | null,
    lineItems: Array.isArray(record.line_items)
      ? record.line_items.map((item: any) => ({
          id: item.id as number,
          productName: item.product_name as string,
          quantity: item.quantity as number,
          fulfilledQuantity: (item.fulfilled_quantity ?? null) as number | null,
          shipments: Array.isArray(item.shipments)
            ? item.shipments.map((shipment: any) => ({
                id: shipment.id as number,
                trackingNumber: (shipment.tracking_number ?? null) as string | null,
                carrier: (shipment.carrier ?? null) as string | null,
                status: (shipment.status ?? null) as string | null,
                shippedAt: (shipment.shipped_at ?? null) as string | null
              }))
            : []
        }))
      : []
  };
});

export async function upsertShipment(
  shipment: {
    id?: number;
    lineItemId: number;
    trackingNumber: string;
    carrier: string;
    status: string;
    shippedAt?: string | null;
  }
) {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }

  const { error } = await (serviceClient as any)
    .from('shipments')
    .upsert({
      id: shipment.id,
      line_item_id: shipment.lineItemId,
      tracking_number: shipment.trackingNumber,
      carrier: shipment.carrier,
      status: shipment.status,
      shipped_at: shipment.shippedAt ?? new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

export async function updateOrderStatus(orderId: number, status: string) {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }

  const { error } = await (serviceClient as any)
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    throw error;
  }
}

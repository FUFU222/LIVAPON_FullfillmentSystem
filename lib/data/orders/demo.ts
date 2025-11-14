import type { LineItemShipment, OrderDetail, OrderSummary } from './types';
import { mapDetailToSummary } from './transformers';

const demoOrders: OrderDetail[] = [
  {
    id: 1,
    orderNumber: '#1001',
    customerName: '佐藤 花子',
    status: 'unfulfilled',
    updatedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    archivedAt: null,
    shippingPostal: '1500001',
    shippingPrefecture: '東京都',
    shippingCity: '渋谷区神宮前',
    shippingAddress1: '1-2-3 LIVAPONビル',
    shippingAddress2: null,
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
        variantTitle: 'レッド',
        vendorId: 1,
        vendorCode: '0001',
        vendorName: 'デモベンダーA',
        productName: 'プレミアムチェア',
        quantity: 2,
        fulfilledQuantity: 1,
        fulfillableQuantity: 1,
        shippedQuantity: 1,
        remainingQuantity: 1,
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
        variantTitle: '交換用クッション',
        vendorId: 1,
        vendorCode: '0001',
        vendorName: 'デモベンダーA',
        productName: '交換用クッション',
        quantity: 1,
        fulfilledQuantity: 1,
        fulfillableQuantity: 0,
        shippedQuantity: 1,
        remainingQuantity: 0,
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
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    archivedAt: null,
    shippingPostal: '2200012',
    shippingPrefecture: '神奈川県',
    shippingCity: '横浜市西区みなとみらい',
    shippingAddress1: '2-3-4 テストタワー 10F',
    shippingAddress2: null,
    shipments: [],
    lineItems: [
      {
        id: 201,
        sku: '0002-001-01',
        variantTitle: 'ホワイト',
        vendorId: 2,
        vendorCode: '0002',
        vendorName: 'デモベンダーB',
        productName: 'デスクライト',
        quantity: 1,
        fulfilledQuantity: 0,
        fulfillableQuantity: 1,
        shippedQuantity: 0,
        remainingQuantity: 1,
        shipments: []
      }
    ]
  }
];

export function getDemoSummaries(vendorId: number): OrderSummary[] {
  return demoOrders
    .map((order) => toOrderDetailFromDemo(order, vendorId))
    .filter((order): order is OrderDetail => order !== null)
    .map(mapDetailToSummary);
}

export function getDemoOrderDetail(vendorId: number, id: number): OrderDetail | null {
  const order = demoOrders
    .map((demo) => toOrderDetailFromDemo(demo, vendorId))
    .find((demo) => demo?.id === id);
  return order ?? null;
}

export function getDemoOrderDetailForAdmin(id: number): OrderDetail | null {
  return demoOrders.find((demo) => demo.id === id) ?? null;
}

export function getDemoShipmentHistory(vendorId: number) {
  return demoOrders
    .flatMap((order) =>
      order.shipments.map((shipment) => ({
        id: shipment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        shipmentStatus: shipment.status ?? null,
        customerName: order.customerName ?? null,
        shippingAddress: formatDemoShippingAddress(order),
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

function formatDemoShippingAddress(order: OrderDetail) {
  const lines: string[] = [];
  if (order.shippingPostal) {
    lines.push(`〒${order.shippingPostal}`);
  }
  const primary = [order.shippingPrefecture, order.shippingCity, order.shippingAddress1]
    .filter((part) => (part ?? '').trim().length > 0)
    .join(' ')
    .trim();
  if (primary.length > 0) {
    lines.push(primary);
  }
  if (order.shippingAddress2 && order.shippingAddress2.trim().length > 0) {
    lines.push(order.shippingAddress2.trim());
  }
  return lines.length > 0 ? lines.join(' ') : null;
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

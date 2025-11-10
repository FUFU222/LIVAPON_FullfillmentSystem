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
  createdAt: string | null;
  archivedAt: string | null;
  shippingPostal: string | null;
  shippingPrefecture: string | null;
  shippingCity: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shipments: OrderShipment[];
  lineItems: Array<{
    id: number;
    sku: string | null;
    variantTitle: string | null;
    vendorId: number | null;
    vendorCode: string | null;
    vendorName: string | null;
    productName: string;
    quantity: number;
    fulfilledQuantity: number | null;
    fulfillableQuantity: number | null;
    shipments: LineItemShipment[];
  }>;
};

export type OrderLineItemSummary = {
  id: number;
  orderId: number;
  productName: string;
  sku: string | null;
  variantTitle: string | null;
  quantity: number;
  fulfilledQuantity: number | null;
  fulfillableQuantity: number | null;
  shipments: LineItemShipment[];
};

export type OrderSummary = {
  id: number;
  orderNumber: string;
  customerName: string | null;
  lineItemCount: number;
  status: string | null;
  shopifyStatus: string | null;
  isArchived: boolean;
  shippingAddress: string | null;
  shippingAddressLines: string[];
  trackingNumbers: string[];
  updatedAt: string | null;
  createdAt: string | null;
  lineItems: OrderLineItemSummary[];
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

export type FulfillmentOrderSyncResult =
  | { status: 'synced'; fulfillmentOrderId: number; lineItemCount: number }
  | { status: 'pending'; reason: 'not_found'; attempts: number }
  | { status: 'error'; error: string };

export type RawShipmentPivot = {
  quantity: number | null;
  shipment: {
    id: number;
    tracking_number: string | null;
    carrier: string | null;
    status: string | null;
    shipped_at: string | null;
    line_item_ids?: number[];
  } | null;
};

export type RawOrderRecord = {
  id: number;
  order_number: string;
  customer_name: string | null;
  status: string | null;
  updated_at: string | null;
  created_at?: string | null;
  archived_at?: string | null;
  shipping_postal: string | null;
  shipping_prefecture: string | null;
  shipping_city: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  line_items?: Array<{
    id: number;
    vendor_id: number | null;
    sku: string | null;
    product_name: string;
    variant_title: string | null;
    quantity: number;
    fulfilled_quantity: number | null;
    fulfillable_quantity: number | null;
    shipments?: RawShipmentPivot[];
    vendor?: {
      id: number | null;
      code: string | null;
      name: string | null;
    } | null;
  }>;
};

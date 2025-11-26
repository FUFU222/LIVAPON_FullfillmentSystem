export type SelectedLineItem = {
  lineItemId: number;
  orderId: number;
  orderNumber: string;
  productName: string;
  sku: string | null;
  variantTitle: string | null;
  totalOrdered: number;
  shippedQuantity: number;
  availableQuantity: number;
  quantity: number;
};

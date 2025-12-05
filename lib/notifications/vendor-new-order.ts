import { sendEmail, isRetryableEmailError } from './email';

export type VendorNewOrderEmailLineItem = {
  productName: string;
  quantity: number;
  sku?: string | null;
  variantTitle?: string | null;
};

export type VendorNewOrderEmailPayload = {
  to: string;
  vendorName: string;
  orderNumber: string;
  orderCreatedAt: string;
  customerName: string | null;
  shipping: {
    postalCode?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
  };
  lineItems: VendorNewOrderEmailLineItem[];
};

function formatOrderDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('Failed to format order timestamp for email', error);
    return timestamp;
  }
}

function formatShippingBlock(shipping: VendorNewOrderEmailPayload['shipping']): string {
  const lines = [
    shipping.postalCode?.trim(),
    shipping.address1?.trim(),
    shipping.address2?.trim(),
    [shipping.city, shipping.state].filter(Boolean).join(' ').trim()
  ].filter((line) => Boolean(line && line.length > 0));

  return lines.length > 0 ? lines.join('\n') : '住所情報なし';
}

function formatLineItem(item: VendorNewOrderEmailLineItem): string {
  const info: string[] = [item.productName];
  if (item.variantTitle) {
    info.push(`(${item.variantTitle})`);
  }
  return `・${info.join(' ')} × ${item.quantity}`;
}

function buildEmailBody(payload: VendorNewOrderEmailPayload): string {
  const lineItemsBlock = payload.lineItems.length > 0
    ? payload.lineItems.map(formatLineItem).join('\n')
    : '・対象商品が特定できませんでした';

  return `${payload.vendorName} 様\n`
    + '━━━━━━━━━━━━━━━━━━━━━━\n'
    + '🆕 新しい注文が届きました\n'
    + '━━━━━━━━━━━━━━━━━━━━━━\n'
    + `ご対応をお願いいたします（注文日時: ${formatOrderDate(payload.orderCreatedAt)}）\n\n`
    + '📍 配送先\n'
    + `${formatShippingBlock(payload.shipping)}\n\n`
    + '🛒 注文内容\n'
    + `${lineItemsBlock}\n\n`
    + '🚪 ベンダーコンソール\n'
    + 'https://livapon-fullfillment-system.vercel.app/orders\n\n'
    + '※本メールは送信専用です。\n'
    + '設定から通知のオン／オフを切り替えられます。\n';
}

export async function sendVendorNewOrderEmail(payload: VendorNewOrderEmailPayload) {
  const text = buildEmailBody(payload);
  await sendEmail({
    to: payload.to,
    subject: '【LIVAPON】新しい注文のご案内',
    text
  });
}

export function isVendorEmailRetryableError(error: unknown): boolean {
  return isRetryableEmailError(error);
}

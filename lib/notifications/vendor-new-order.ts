import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

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
  if (item.sku) {
    info.push(`(SKU: ${item.sku})`);
  } else if (item.variantTitle) {
    info.push(`(${item.variantTitle})`);
  }
  return `・${info.join(' ')} × ${item.quantity}`;
}

function buildEmailBody(payload: VendorNewOrderEmailPayload): string {
  const lineItemsBlock = payload.lineItems.length > 0
    ? payload.lineItems.map(formatLineItem).join('\n')
    : '・対象商品が特定できませんでした';

  return `${payload.vendorName} 様\n\n`
    + 'LIVAPONをご利用いただきありがとうございます。\n'
    + '以下の内容で新規注文が登録されましたので、ご確認をお願いいたします。\n\n'
    + '────────────────────\n'
    + '■ 注文情報\n'
    + `・注文番号：${payload.orderNumber}\n`
    + `・注文日時：${formatOrderDate(payload.orderCreatedAt)}\n`
    + `・購入者名：${payload.customerName ?? '-'}\n\n`
    + '■ 配送先\n'
    + `${formatShippingBlock(payload.shipping)}\n\n`
    + '■ 注文内容\n'
    + `${lineItemsBlock}\n`
    + '────────────────────\n\n'
    + '発送準備につきましては、ベンダー様用コンソールよりご対応をお願いいたします。\n'
    + '▼管理画面はこちら\n'
    + 'https://livapon-fullfillment-system.vercel.app/orders\n\n'
    + 'お心当たりのない場合やご不明点がございましたら、\n'
    + '運用担当またはLIVAPON事務局までご連絡ください。\n'
    + '本メールは送信専用です。\n\n'
    + '※本メールの受信有無は、ベンダープロフィール画面の通知設定からいつでもオン／オフを切り替えていただけます。\n\n'
    + 'よろしくお願いいたします。\n'
    + 'LIVAPON 事務局';
}

export async function sendVendorNewOrderEmail(payload: VendorNewOrderEmailPayload) {
  if (!resendClient) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const text = buildEmailBody(payload);
  await resendClient.emails.send({
    from: 'LIVAPON 通知 <notifications@livapon.jp>',
    to: payload.to,
    subject: `【LIVAPON】新規注文のご連絡（注文番号：${payload.orderNumber}）`,
    text
  });
}

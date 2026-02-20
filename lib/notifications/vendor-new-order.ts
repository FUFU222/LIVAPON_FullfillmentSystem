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

function buildPlainTextBody(payload: VendorNewOrderEmailPayload): string {
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
    + '🚪 注文を確認する\n'
    + 'https://livapon-fullfillment-system.vercel.app/orders\n\n'
    + '※本メールは送信専用です。\n'
    + '設定から通知のオン／オフを切り替えられます。\n';
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlEmailBody(payload: VendorNewOrderEmailPayload): string {
  const shippingParts = [
    payload.shipping.postalCode,
    payload.shipping.address1,
    payload.shipping.address2,
    [payload.shipping.city, payload.shipping.state].filter(Boolean).join(' ')
  ]
    .map((line) => escapeHtml(line?.trim()))
    .filter((line) => Boolean(line?.length));
  const shippingBlock = shippingParts.length > 0 ? shippingParts.join('<br />') : '住所情報なし';

  const lineItemsHtml = payload.lineItems.length > 0
    ? payload.lineItems
        .map((item) => {
          const variant = item.variantTitle ? `<p style="margin:4px 0 0; font-size:13px; color:#667085;">${escapeHtml(item.variantTitle)}</p>` : '';
          return `
            <tr>
              <td style="padding:12px 0; border-top:1px solid #E4E7EC;">
                <p style="margin:0; font-size:15px; color:#0F172A; font-weight:600;">${escapeHtml(item.productName)}</p>
                ${variant}
              </td>
              <td align="right" style="padding:12px 0; border-top:1px solid #E4E7EC; font-size:15px; color:#0F172A;">× ${item.quantity}</td>
            </tr>`;
        })
        .join('')
    : `<tr><td style="padding:12px 0; border-top:1px solid #E4E7EC; font-size:14px; color:#667085;">対象商品が特定できませんでした</td></tr>`;

  const orderDate = escapeHtml(formatOrderDate(payload.orderCreatedAt));
  const customerName = escapeHtml(payload.customerName ?? '-');
  const vendorName = escapeHtml(payload.vendorName);
  const portalUrl = 'https://livapon-fullfillment-system.vercel.app/orders';

  return `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>LIVAPON 注文通知</title>
    </head>
    <body style="margin:0; padding:0; background-color:#F4F4F5; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F5; padding:24px 0;">
        <tr>
          <td align="center" style="padding:0 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:8px; box-shadow:0 10px 30px rgba(15,23,42,0.08); padding:40px;">
              <tr>
                <td style="text-align:center; padding-bottom:24px; border-bottom:1px solid #E4E7EC;">
                  <span style="font-size:20px; font-weight:700; letter-spacing:0.04em; color:#0F172A;">LIVAPON</span>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 0 24px;">
                  <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#0F172A;">${vendorName} 様</p>
                  <p style="margin:0; font-size:14px; color:#475467; line-height:1.6;">
                    新しい注文が登録されました。以下の内容をご確認のうえ、発送準備をお願いいたします。
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <div style="margin-bottom:20px;">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:600; letter-spacing:0.03em; color:#98A2B3; text-transform:uppercase;">注文日時</p>
                    <p style="margin:0; font-size:16px; color:#0F172A;">${orderDate}</p>
                  </div>
                  <div style="margin-bottom:20px;">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:600; letter-spacing:0.03em; color:#98A2B3; text-transform:uppercase;">購入者</p>
                    <p style="margin:0; font-size:16px; color:#0F172A;">${customerName}</p>
                  </div>
                  <div>
                    <p style="margin:0 0 6px; font-size:13px; font-weight:600; letter-spacing:0.03em; color:#98A2B3; text-transform:uppercase;">配送先</p>
                    <p style="margin:0; font-size:15px; color:#0F172A; line-height:1.6;">${shippingBlock}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#0F172A;">注文内容</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lineItemsHtml}</table>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <a href="${portalUrl}" style="display:inline-block; padding:14px 28px; background-color:#0F172A; color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:600; border-radius:999px;">注文を確認する</a>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #E4E7EC; padding-top:24px;">
                  <p style="margin:0; font-size:12px; color:#98A2B3; line-height:1.6;">
                    本メールは送信専用です。通知設定はセラープロフィールから変更できます。<br />
                    ご不明点がございましたら LIVAPON 事務局までお問い合わせください。
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export async function sendVendorNewOrderEmail(payload: VendorNewOrderEmailPayload) {
  const text = buildPlainTextBody(payload);
  const html = buildHtmlEmailBody(payload);
  await sendEmail({
    to: payload.to,
    subject: '【LIVAPON】新しい注文のご案内',
    text,
    html
  });
}

export function isVendorEmailRetryableError(error: unknown): boolean {
  return isRetryableEmailError(error);
}

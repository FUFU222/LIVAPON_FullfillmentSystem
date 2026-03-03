import { isRetryableEmailError, sendEmail } from './email';

export type ShipmentAdjustmentUpdateEmailPayload = {
  to: string;
  contactName?: string | null;
  portalUrl?: string;
};

function getPortalUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit;
  }
  return 'https://livapon-fullfillment-system.vercel.app';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTextBody(payload: ShipmentAdjustmentUpdateEmailPayload): string {
  const recipient = (payload.contactName?.trim() || 'ご担当者') + ' 様';
  const portalUrl = payload.portalUrl ?? getPortalUrl();
  const shipmentAdjustmentUrl = `${portalUrl.replace(/\/$/, '')}/support/shipment-adjustment`;

  return `${recipient}\n\n`
    + 'LIVAPON運営事務局です。\n'
    + '発送修正申請について、運営により対応しました。\n'
    + '配送管理システムにログインし、申請履歴より内容をご確認ください。\n\n'
    + `${shipmentAdjustmentUrl}\n\n`
    + 'ご不明点がある場合は、本メールにご返信ください。\n';
}

function buildHtmlBody(payload: ShipmentAdjustmentUpdateEmailPayload): string {
  const recipient = escapeHtml((payload.contactName?.trim() || 'ご担当者') + ' 様');
  const portalUrl = payload.portalUrl ?? getPortalUrl();
  const shipmentAdjustmentUrl = `${portalUrl.replace(/\/$/, '')}/support/shipment-adjustment`;
  const escapedUrl = escapeHtml(shipmentAdjustmentUrl);

  return `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>発送修正申請について</title>
    </head>
    <body style="margin:0; padding:0; background:#F8FAFC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#0F172A;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:28px;">
              <tr>
                <td style="font-size:16px; line-height:1.8;">
                  <p style="margin:0 0 12px;">${recipient}</p>
                  <p style="margin:0 0 12px;">LIVAPON運営事務局です。</p>
                  <p style="margin:0 0 12px;">
                    発送修正申請について、運営により対応しました。<br />
                    配送管理システムにログインし、申請履歴より内容をご確認ください。
                  </p>
                  <p style="margin:0 0 16px;">
                    <a href="${escapedUrl}" style="color:#2563EB; text-decoration:underline;">${escapedUrl}</a>
                  </p>
                  <p style="margin:0;">ご不明点がある場合は、本メールにご返信ください。</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export async function sendShipmentAdjustmentUpdateEmail(
  payload: ShipmentAdjustmentUpdateEmailPayload
): Promise<void> {
  const text = buildTextBody(payload);
  const html = buildHtmlBody(payload);
  await sendEmail({
    to: payload.to,
    subject: '【LIVAPON】発送修正申請について',
    text,
    html
  });
}

export function isShipmentAdjustmentUpdateEmailRetryableError(error: unknown): boolean {
  return isRetryableEmailError(error);
}

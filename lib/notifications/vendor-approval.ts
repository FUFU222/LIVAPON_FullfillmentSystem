import { isRetryableEmailError, sendEmail } from './email';

export type VendorApprovalEmailPayload = {
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

function buildTextBody(payload: VendorApprovalEmailPayload): string {
  const recipient = (payload.contactName?.trim() || 'ご担当者') + ' 様';
  const portalUrl = payload.portalUrl ?? getPortalUrl();

  return `${recipient}\n\n`
    + 'LIVAPON運営事務局です。\n'
    + 'このたびはご申請ありがとうございました。\n\n'
    + 'ご利用準備が整いましたので、本日より管理画面をご利用いただけます。\n'
    + '以下のURLからログインしてご確認ください。\n\n'
    + `${portalUrl}\n\n`
    + 'ご不明点があれば、本メールにご返信ください。\n'
    + '今後ともよろしくお願いいたします。\n';
}

function buildHtmlBody(payload: VendorApprovalEmailPayload): string {
  const recipient = escapeHtml((payload.contactName?.trim() || 'ご担当者') + ' 様');
  const portalUrl = payload.portalUrl ?? getPortalUrl();
  const escapedPortalUrl = escapeHtml(portalUrl);

  return `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ご利用開始のご案内</title>
    </head>
    <body style="margin:0; padding:0; background:#F8FAFC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#0F172A;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:28px;">
              <tr>
                <td style="font-size:16px; line-height:1.8;">
                  <p style="margin:0 0 12px;">${recipient}</p>
                  <p style="margin:0 0 12px;">LIVAPON運営事務局です。<br />このたびはご申請ありがとうございました。</p>
                  <p style="margin:0 0 12px;">
                    ご利用準備が整いましたので、本日より管理画面をご利用いただけます。<br />
                    以下のURLからログインしてご確認ください。
                  </p>
                  <p style="margin:0 0 16px;">
                    <a href="${escapedPortalUrl}" style="color:#2563EB; text-decoration:underline;">${escapedPortalUrl}</a>
                  </p>
                  <p style="margin:0 0 8px;">ご不明点があれば、本メールにご返信ください。</p>
                  <p style="margin:0;">今後ともよろしくお願いいたします。</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export async function sendVendorApprovalEmail(payload: VendorApprovalEmailPayload): Promise<void> {
  const text = buildTextBody(payload);
  const html = buildHtmlBody(payload);
  await sendEmail({
    to: payload.to,
    subject: '【LIVAPON】ご利用開始のご案内',
    text,
    html
  });
}

export function isVendorApprovalEmailRetryableError(error: unknown): boolean {
  return isRetryableEmailError(error);
}


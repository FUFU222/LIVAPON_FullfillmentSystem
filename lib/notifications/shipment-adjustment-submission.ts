import { isRetryableEmailError, sendEmail } from './email';

export type ShipmentAdjustmentSubmissionAdminEmailPayload = {
  to?: string;
  requestId: number;
  vendorId: number;
  vendorUserEmail?: string | null;
  orderNumber: string;
  issueTypeLabel: string;
  issueSummary: string;
  desiredChange: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  adminUrl?: string;
};

function getAdminRecipient(): string {
  const candidates = [
    process.env.SHIPMENT_ADJUSTMENT_ADMIN_EMAIL,
    process.env.GMAIL_IMPERSONATED_USER,
    process.env.GMAIL_SENDER,
    'information@chairman.jp'
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim()
    ?? 'information@chairman.jp';
}

function getAdminUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl = explicit || 'https://livapon-fullfillment-system.vercel.app';
  return `${baseUrl.replace(/\/$/, '')}/admin/shipment-requests`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTextBody(payload: ShipmentAdjustmentSubmissionAdminEmailPayload): string {
  const adminUrl = payload.adminUrl ?? getAdminUrl();
  const phoneLine = payload.contactPhone ? `連絡先電話: ${payload.contactPhone}\n` : '';
  const submitterLine = payload.vendorUserEmail ? `依頼者アカウント: ${payload.vendorUserEmail}\n` : '';

  return 'LIVAPON運営事務局 各位\n\n'
    + 'セラーから発送修正依頼を受け付けました。管理画面で内容をご確認ください。\n\n'
    + `依頼ID: ${payload.requestId}\n`
    + `セラーID: ${payload.vendorId}\n`
    + submitterLine
    + `注文番号: ${payload.orderNumber}\n`
    + `依頼区分: ${payload.issueTypeLabel}\n`
    + `状況: ${payload.issueSummary}\n`
    + `希望対応: ${payload.desiredChange}\n`
    + `連絡先担当者: ${payload.contactName}\n`
    + `連絡先メール: ${payload.contactEmail}\n`
    + phoneLine
    + `確認URL: ${adminUrl}\n`;
}

function buildHtmlBody(payload: ShipmentAdjustmentSubmissionAdminEmailPayload): string {
  const adminUrl = escapeHtml(payload.adminUrl ?? getAdminUrl());
  const submitterLine = payload.vendorUserEmail
    ? `<tr><td style="padding:0 0 8px; color:#475569;">依頼者アカウント</td><td style="padding:0 0 8px;">${escapeHtml(payload.vendorUserEmail)}</td></tr>`
    : '';
  const phoneLine = payload.contactPhone
    ? `<tr><td style="padding:0 0 8px; color:#475569;">連絡先電話</td><td style="padding:0 0 8px;">${escapeHtml(payload.contactPhone)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>発送修正依頼を受け付けました</title>
    </head>
    <body style="margin:0; padding:0; background:#F8FAFC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#0F172A;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:28px;">
              <tr>
                <td style="font-size:16px; line-height:1.8;">
                  <p style="margin:0 0 12px;">LIVAPON運営事務局 各位</p>
                  <p style="margin:0 0 16px;">セラーから発送修正依頼を受け付けました。管理画面で内容をご確認ください。</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; line-height:1.7; margin:0 0 16px;">
                    <tr><td style="padding:0 0 8px; color:#475569;">依頼ID</td><td style="padding:0 0 8px;">${payload.requestId}</td></tr>
                    <tr><td style="padding:0 0 8px; color:#475569;">セラーID</td><td style="padding:0 0 8px;">${payload.vendorId}</td></tr>
                    ${submitterLine}
                    <tr><td style="padding:0 0 8px; color:#475569;">注文番号</td><td style="padding:0 0 8px;">${escapeHtml(payload.orderNumber)}</td></tr>
                    <tr><td style="padding:0 0 8px; color:#475569;">依頼区分</td><td style="padding:0 0 8px;">${escapeHtml(payload.issueTypeLabel)}</td></tr>
                    <tr><td style="padding:0 0 8px; color:#475569;">状況</td><td style="padding:0 0 8px;">${escapeHtml(payload.issueSummary)}</td></tr>
                    <tr><td style="padding:0 0 8px; color:#475569;">希望対応</td><td style="padding:0 0 8px;">${escapeHtml(payload.desiredChange)}</td></tr>
                    <tr><td style="padding:0 0 8px; color:#475569;">連絡先担当者</td><td style="padding:0 0 8px;">${escapeHtml(payload.contactName)}</td></tr>
                    <tr><td style="padding:0 0 8px; color:#475569;">連絡先メール</td><td style="padding:0 0 8px;">${escapeHtml(payload.contactEmail)}</td></tr>
                    ${phoneLine}
                  </table>
                  <p style="margin:0;">
                    <a href="${adminUrl}" style="color:#2563EB; text-decoration:underline;">${adminUrl}</a>
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

export async function sendShipmentAdjustmentSubmissionAdminEmail(
  payload: ShipmentAdjustmentSubmissionAdminEmailPayload
): Promise<void> {
  const to = payload.to ?? getAdminRecipient();
  const subject = `【LIVAPON】発送修正依頼を受け付けました（${payload.orderNumber}）`;

  await sendEmail({
    to,
    subject,
    text: buildTextBody(payload),
    html: buildHtmlBody(payload)
  });
}

export function isShipmentAdjustmentSubmissionAdminEmailRetryableError(error: unknown): boolean {
  return isRetryableEmailError(error);
}

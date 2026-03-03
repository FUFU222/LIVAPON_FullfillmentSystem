import { sendShipmentAdjustmentSubmissionAdminEmail } from '@/lib/notifications/shipment-adjustment-submission';

jest.mock('@/lib/notifications/email', () => ({
  sendEmail: jest.fn(),
  isRetryableEmailError: jest.fn(() => false)
}));

const { sendEmail } = jest.requireMock<{ sendEmail: jest.Mock }>(
  '@/lib/notifications/email'
);

describe('shipment adjustment submission admin notification', () => {
  const originalEnv = {
    SHIPMENT_ADJUSTMENT_ADMIN_EMAIL: process.env.SHIPMENT_ADJUSTMENT_ADMIN_EMAIL,
    GMAIL_IMPERSONATED_USER: process.env.GMAIL_IMPERSONATED_USER,
    GMAIL_SENDER: process.env.GMAIL_SENDER,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SHIPMENT_ADJUSTMENT_ADMIN_EMAIL = 'ops@example.com';
    process.env.GMAIL_IMPERSONATED_USER = 'impersonated@example.com';
    process.env.GMAIL_SENDER = 'sender@example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/console';
  });

  afterAll(() => {
    process.env.SHIPMENT_ADJUSTMENT_ADMIN_EMAIL = originalEnv.SHIPMENT_ADJUSTMENT_ADMIN_EMAIL;
    process.env.GMAIL_IMPERSONATED_USER = originalEnv.GMAIL_IMPERSONATED_USER;
    process.env.GMAIL_SENDER = originalEnv.GMAIL_SENDER;
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  });

  it('sends the submission details to the configured admin inbox', async () => {
    await sendShipmentAdjustmentSubmissionAdminEmail({
      requestId: 42,
      vendorId: 15,
      vendorUserEmail: 'seller@example.com',
      orderNumber: '#1234',
      issueTypeLabel: '追跡番号・配送会社の修正',
      issueSummary: '配送会社をヤマトへ修正したいです。',
      desiredChange: '追跡番号を差し替えて再連携してください。',
      contactName: '山田花子',
      contactEmail: 'ops-vendor@example.com',
      contactPhone: '03-1234-5678'
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);

    const payload = sendEmail.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };

    expect(payload.to).toBe('ops@example.com');
    expect(payload.subject).toBe('【LIVAPON】発送修正申請を受け付けました（#1234）');
    expect(payload.text).toContain('申請ID: 42');
    expect(payload.text).toContain('申請者アカウント: seller@example.com');
    expect(payload.text).toContain('確認URL: https://example.com/console/admin/shipment-requests');
    expect(payload.html).toContain('ops-vendor@example.com');
  });

  it('falls back to the information address when a dedicated recipient is not configured', async () => {
    delete process.env.SHIPMENT_ADJUSTMENT_ADMIN_EMAIL;
    delete process.env.GMAIL_IMPERSONATED_USER;
    delete process.env.GMAIL_SENDER;

    await sendShipmentAdjustmentSubmissionAdminEmail({
      requestId: 77,
      vendorId: 20,
      orderNumber: '#4321',
      issueTypeLabel: 'その他（自由入力）',
      issueSummary: '状況 <確認>',
      desiredChange: '希望 "変更"',
      contactName: '佐藤',
      contactEmail: 'contact@example.com'
    });

    const payload = sendEmail.mock.calls[0]?.[0] as {
      to: string;
      html: string;
    };

    expect(payload.to).toBe('information@chairman.jp');
    expect(payload.html).toContain('状況 &lt;確認&gt;');
    expect(payload.html).toContain('希望 &quot;変更&quot;');
  });
});

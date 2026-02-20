import { sendVendorApprovalEmail } from '@/lib/notifications/vendor-approval';

jest.mock('@/lib/notifications/email', () => ({
  sendEmail: jest.fn(),
  isRetryableEmailError: jest.fn(() => false)
}));

const { sendEmail } = jest.requireMock<{ sendEmail: jest.Mock }>(
  '@/lib/notifications/email'
);

describe('vendor approval notification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends start-guide email without internal terms', async () => {
    await sendVendorApprovalEmail({
      to: 'vendor@example.com',
      contactName: '山田',
      portalUrl: 'https://example.com/orders'
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0]?.[0] as {
      subject: string;
      text: string;
      html: string;
    };

    expect(payload.subject).toBe('【LIVAPON】ご利用開始のご案内');
    expect(payload.text).toContain('本日より管理画面をご利用いただけます。');
    expect(payload.text).toContain('https://example.com/orders');
    expect(payload.text).not.toContain('セラーコード');
    expect(payload.text).not.toContain('セラー名');
  });
});


import { sendShipmentAdjustmentUpdateEmail } from '@/lib/notifications/shipment-adjustment-update';

jest.mock('@/lib/notifications/email', () => ({
  sendEmail: jest.fn(),
  isRetryableEmailError: jest.fn(() => false)
}));

const { sendEmail } = jest.requireMock<{ sendEmail: jest.Mock }>(
  '@/lib/notifications/email'
);

describe('shipment adjustment update notification', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('sends the resolved notification with a vendor portal link', async () => {
    await sendShipmentAdjustmentUpdateEmail({
      to: 'vendor@example.com',
      contactName: '山田花子',
      portalUrl: 'https://example.com/console/'
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };

    expect(payload.to).toBe('vendor@example.com');
    expect(payload.subject).toBe('【LIVAPON】発送修正依頼について');
    expect(payload.text).toContain('山田花子 様');
    expect(payload.text).toContain('https://example.com/console/support/shipment-adjustment');
    expect(payload.html).toContain('発送修正依頼について、運営により対応しました。');
    expect(payload.html).toContain('https://example.com/console/support/shipment-adjustment');
  });

  it('falls back to the default portal url and escapes html characters', async () => {
    await sendShipmentAdjustmentUpdateEmail({
      to: 'vendor@example.com',
      contactName: '<担当者>'
    });

    const payload = sendEmail.mock.calls[0]?.[0] as {
      text: string;
      html: string;
    };

    expect(payload.text).toContain('https://livapon-fullfillment-system.vercel.app/support/shipment-adjustment');
    expect(payload.html).toContain('&lt;担当者&gt; 様');
  });
});

import { sendVendorNewOrderEmail } from '@/lib/notifications/vendor-new-order';

jest.mock('@/lib/notifications/email', () => ({
  sendEmail: jest.fn(),
  isRetryableEmailError: jest.fn(() => false)
}));

const { sendEmail } = jest.requireMock<{ sendEmail: jest.Mock }>(
  '@/lib/notifications/email'
);

describe('vendor new order notification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders line items and shipping details into the outgoing payload', async () => {
    await sendVendorNewOrderEmail({
      to: 'vendor@example.com',
      vendorName: 'テストセラー',
      orderNumber: '#1001',
      orderCreatedAt: '2026-03-15T03:00:00Z',
      customerName: '山田太郎',
      shipping: {
        postalCode: '100-0001',
        address1: '千代田1-1-1',
        address2: 'ビル 2F',
        city: '千代田区',
        state: '東京都'
      },
      lineItems: [
        { productName: '商品A', quantity: 2, variantTitle: '通常' },
        { productName: '商品B', quantity: 1 }
      ]
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0]?.[0] as {
      subject: string;
      text: string;
      html: string;
    };

    expect(payload.subject).toBe('【LIVAPON】新しい注文のご案内');
    expect(payload.text).toContain('テストセラー 様');
    expect(payload.text).toContain('100-0001');
    expect(payload.text).toContain('・商品A (通常) × 2');
    expect(payload.text).toContain('・商品B × 1');
    expect(payload.text).toContain('https://livapon-fullfillment-system.vercel.app/orders');
    expect(payload.html).toContain('商品A');
    expect(payload.html).toContain('通常');
    expect(payload.html).toContain('千代田1-1-1');
  });

  it('falls back when address or line items are missing and escapes html content', async () => {
    await sendVendorNewOrderEmail({
      to: ['vendor@example.com', 'warehouse@example.com'],
      vendorName: '<セラー>',
      orderNumber: '#1002',
      orderCreatedAt: 'not-a-date',
      customerName: null,
      shipping: {},
      lineItems: []
    });

    const payload = sendEmail.mock.calls[0]?.[0] as {
      to: string[];
      text: string;
      html: string;
    };

    expect(payload.to).toEqual(['vendor@example.com', 'warehouse@example.com']);
    expect(payload.text).toContain('住所情報なし');
    expect(payload.text).toContain('・対象商品が特定できませんでした');
    expect(payload.html).toContain('&lt;セラー&gt; 様');
    expect(payload.html).toContain('住所情報なし');
    expect(payload.html).toContain('対象商品が特定できませんでした');
  });
});

import { resolveVendorNotificationRecipients } from '@/lib/shopify/order-import';

describe('resolveVendorNotificationRecipients', () => {
  it('includes the primary contact first, then unique additional recipients, up to three total', () => {
    expect(resolveVendorNotificationRecipients({
      contact_email: 'primary@example.com',
      notification_emails: [' ops@example.com ', 'primary@example.com', 'warehouse@example.com', 'extra@example.com']
    })).toEqual(['primary@example.com', 'ops@example.com', 'warehouse@example.com']);
  });

  it('returns just the primary contact when no additional recipients are configured', () => {
    expect(resolveVendorNotificationRecipients({
      contact_email: 'primary@example.com',
      notification_emails: []
    })).toEqual(['primary@example.com']);
  });

  it('still returns additional recipients when the primary contact is missing', () => {
    expect(resolveVendorNotificationRecipients({
      contact_email: null,
      notification_emails: ['ops@example.com', 'warehouse@example.com']
    })).toEqual(['ops@example.com', 'warehouse@example.com']);
  });
});

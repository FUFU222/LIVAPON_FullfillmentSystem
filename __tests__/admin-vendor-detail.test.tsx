import { render, screen } from '@testing-library/react';
import { AdminVendorDetail } from '@/components/admin/admin-vendor-detail';
import type { VendorDetail } from '@/lib/data/vendors';

function buildVendor(overrides?: Partial<VendorDetail>): VendorDetail {
  return {
    id: 28,
    code: '0028',
    name: '株式会社HolyTech',
    contactName: '担当者',
    contactEmail: 'vendor@example.com',
    notificationEmails: [],
    contactPhone: null,
    notifyNewOrders: true,
    postal: null,
    prefecture: null,
    city: null,
    address1: null,
    address2: null,
    createdAt: '2026-03-18T08:00:00.000+00:00',
    summary: {
      orderCount: 0,
      shipmentCount: 0,
      skuCount: 0
    },
    applications: [],
    ...overrides
  };
}

describe('AdminVendorDetail', () => {
  it('does not show backfill language for vendors without a shipping origin address', () => {
    render(<AdminVendorDetail vendor={buildVendor()} />);

    expect(screen.getByText(/発送元住所/)).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('未登録です。納品書の出荷元欄は住所なしで印字されます。')
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/backfill/i)).not.toBeInTheDocument();
  });
});

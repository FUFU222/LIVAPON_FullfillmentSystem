import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AppShell, type AppShellInitialAuth } from '@/components/layout/app-shell';

let mockPathname = '/orders';
const mockPush = jest.fn();
const mockPrefetch = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    prefetch: mockPrefetch
  })
}));

jest.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({
    auth: {
      getSession: jest.fn(() => new Promise(() => undefined)),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: {
          subscription: {
            unsubscribe: jest.fn()
          }
        }
      }))
    },
    from: jest.fn((table: string) => {
      const query = {
        select: jest.fn(() => query),
        in: jest.fn(() => new Promise(() => undefined)),
        eq: jest.fn(() => (
          table === 'vendor_applications'
            ? new Promise(() => undefined)
            : query
        )),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
      };
      return query;
    })
  })
}));

function buildAuth(overrides?: Partial<AppShellInitialAuth>): AppShellInitialAuth {
  return {
    status: 'signed-in',
    email: 'seller@example.com',
    vendorId: 10,
    role: 'vendor',
    companyName: 'テストセラー',
    adminActiveShipmentRequestCount: 0,
    adminPendingVendorApplicationCount: 0,
    adminOperationalAttentionCount: 0,
    ...overrides
  };
}

describe('AppShell mobile navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/orders';
  });

  it('uses the true horizontal logo asset to keep the header compact', () => {
    render(
      <AppShell initialAuth={buildAuth()}>
        <div>content</div>
      </AppShell>
    );

    const logo = screen.getByAltText('LIVAPON');
    expect(logo).toHaveAttribute('src', '/brand/livapon-header-logo.svg');
    expect(logo).toHaveAttribute('width', '266');
    expect(logo).toHaveAttribute('height', '50');
    expect(logo).toHaveClass('w-28');
    expect(logo).toHaveClass('md:w-40');
  });

  it('shows compact role-specific bottom tabs for vendors', () => {
    render(
      <AppShell initialAuth={buildAuth()}>
        <div>content</div>
      </AppShell>
    );

    const mobileNav = screen.getByLabelText('モバイル主要ナビ');
    expect(screen.getByLabelText('主要ナビゲーション')).toHaveClass('hidden');
    expect(screen.getByRole('main')).toHaveClass('pb-[calc(5.75rem+env(safe-area-inset-bottom))]');
    expect(within(mobileNav).getByRole('link', { name: /注文/ })).toHaveAttribute('href', '/orders');
    expect(within(mobileNav).getByRole('link', { name: /履歴/ })).toHaveAttribute('href', '/orders/shipments');
    expect(within(mobileNav).getByRole('link', { name: /修正/ })).toHaveAttribute('href', '/support/shipment-adjustment');
    expect(within(mobileNav).getByRole('link', { name: /会社/ })).toHaveAttribute('href', '/vendor/profile');
    expect(within(mobileNav).queryByRole('link', { name: /利用開始依頼/ })).not.toBeInTheDocument();
  });

  it('does not block prefetched navigation with a global loading overlay', () => {
    jest.useFakeTimers();

    try {
      render(
        <AppShell initialAuth={buildAuth()}>
          <div>content</div>
        </AppShell>
      );

      const mobileNav = screen.getByLabelText('モバイル主要ナビ');
      fireEvent.click(within(mobileNav).getByRole('link', { name: /履歴/ }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(screen.queryByLabelText('読み込み中')).not.toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows admin bottom tabs with notification badges', () => {
    mockPathname = '/admin/shipment-requests';

    render(
      <AppShell
        initialAuth={buildAuth({
          role: 'admin',
          vendorId: null,
          email: 'admin@example.com',
          companyName: null,
          adminActiveShipmentRequestCount: 7,
          adminPendingVendorApplicationCount: 2
        })}
      >
        <div>content</div>
      </AppShell>
    );

    const mobileNav = screen.getByLabelText('モバイル主要ナビ');
    expect(screen.getByLabelText('主要ナビゲーション')).toHaveClass('hidden');
    expect(within(mobileNav).getByRole('link', { name: /管理/ })).toHaveAttribute('href', '/admin');
    expect(within(mobileNav).getByRole('link', { name: /注文/ })).toHaveAttribute('href', '/admin/orders');
    expect(within(mobileNav).getByRole('link', { name: /申請/ })).toHaveAttribute('href', '/admin/applications');
    expect(within(mobileNav).getByRole('link', { name: /修正/ })).toHaveAttribute('href', '/admin/shipment-requests');
    expect(within(mobileNav).getByRole('link', { name: /セラー/ })).toHaveAttribute('href', '/admin/vendors');
    expect(within(mobileNav).getByText('2')).toBeInTheDocument();
    expect(within(mobileNav).getByText('7')).toBeInTheDocument();
  });

  it('keeps signed-out users on the simple header without bottom tabs', () => {
    render(
      <AppShell
        initialAuth={buildAuth({
          status: 'signed-out',
          email: null,
          vendorId: null,
          role: null,
          companyName: null
        })}
      >
        <div>content</div>
      </AppShell>
    );

    expect(screen.queryByLabelText('モバイル主要ナビ')).not.toBeInTheDocument();
    expect(screen.getByLabelText('主要ナビゲーション')).not.toHaveClass('hidden');
    expect(screen.getByRole('link', { name: '利用申請' })).toHaveAttribute('href', '/apply');
    expect(screen.getByRole('link', { name: 'サインイン' })).toHaveAttribute('href', '/sign-in');
  });
});

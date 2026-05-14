'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Package,
  PenLine,
  UserRound,
  UsersRound,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACTIVE_SHIPMENT_ADJUSTMENT_STATUSES,
  SHIPMENT_ADJUSTMENT_NAV_SYNC_EVENT
} from '@/lib/shipment-adjustment/constants';
import { VENDOR_APPLICATION_NAV_SYNC_EVENT } from '@/lib/vendor-application/constants';
import { getBrowserClient } from '@/lib/supabase/client';
import { resolveRoleFromAuthUser, resolveVendorIdFromAuthUser } from '@/lib/auth-metadata';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { GradientAvatar } from '@/components/ui/avatar';
import { AdminTabAttentionIndicator } from '@/components/layout/admin-tab-attention-indicator';

export type AppShellInitialAuth = {
  status: 'signed-in' | 'signed-out';
  email: string | null;
  vendorId: number | null;
  role: string | null;
  companyName: string | null;
  adminActiveShipmentRequestCount: number;
  adminPendingVendorApplicationCount: number;
  adminOperationalAttentionCount: number;
};

const navItems = [
  { href: '/orders', label: '注文一覧' },
  { href: '/import', label: 'CSVインポート' }
];

const adminNavItems = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/applications', label: '利用開始依頼' },
  { href: '/admin/shipment-requests', label: '発送修正依頼' },
  { href: '/admin/orders', label: '注文' },
  { href: '/admin/vendors', label: 'セラー' }
];

const publicNavItems = [{ href: '/apply', label: '利用申請' }];
const pendingNavItems = [{ href: '/pending', label: '審査状況' }];

type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

function getMobileNavItems({
  status,
  role,
  vendorId,
  adminActiveShipmentRequestCount,
  adminPendingVendorApplicationCount
}: {
  status: 'loading' | 'signed-in' | 'signed-out';
  role: string | null;
  vendorId: number | null;
  adminActiveShipmentRequestCount: number;
  adminPendingVendorApplicationCount: number;
}): MobileNavItem[] {
  if (status !== 'signed-in') {
    return [];
  }

  if (role === 'admin') {
    return [
      { href: '/admin', label: '管理', icon: LayoutDashboard },
      { href: '/admin/orders', label: '注文', icon: ClipboardList },
      {
        href: '/admin/applications',
        label: '申請',
        icon: FileText,
        badge: adminPendingVendorApplicationCount
      },
      {
        href: '/admin/shipment-requests',
        label: '修正',
        icon: PenLine,
        badge: adminActiveShipmentRequestCount
      },
      { href: '/admin/vendors', label: 'セラー', icon: UsersRound }
    ];
  }

  if (vendorId) {
    return [
      { href: '/orders', label: '注文', icon: Package },
      { href: '/orders/shipments', label: '履歴', icon: History },
      { href: '/support/shipment-adjustment', label: '修正', icon: PenLine },
      { href: '/vendor/profile', label: '会社', icon: UserRound }
    ];
  }

  if (role === 'pending_vendor') {
    return [{ href: '/pending', label: '審査', icon: FileText }];
  }

  return [];
}

function isNavActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === '/') {
    return pathname === '/';
  }

  if (href === '/admin') {
    return pathname === '/admin';
  }

  if (pathname === href) {
    return true;
  }

  return pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  initialAuth
}: {
  children: ReactNode;
  initialAuth: AppShellInitialAuth;
}) {
  return <AppShellContent initialAuth={initialAuth}>{children}</AppShellContent>;
}

function AppShellContent({
  children,
  initialAuth
}: {
  children: ReactNode;
  initialAuth: AppShellInitialAuth;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'signed-in' | 'signed-out'>(
    initialAuth.status
  );
  const [email, setEmail] = useState<string | null>(initialAuth.email);
  const [vendorId, setVendorId] = useState<number | null>(initialAuth.vendorId);
  const [role, setRole] = useState<string | null>(initialAuth.role);
  const [companyName, setCompanyName] = useState<string | null>(initialAuth.companyName);
  const [adminActiveShipmentRequestCount, setAdminActiveShipmentRequestCount] = useState(
    initialAuth.adminActiveShipmentRequestCount
  );
  const [adminPendingVendorApplicationCount, setAdminPendingVendorApplicationCount] = useState(
    initialAuth.adminPendingVendorApplicationCount
  );
  const [adminOperationalAttentionCount, setAdminOperationalAttentionCount] = useState(
    initialAuth.adminOperationalAttentionCount
  );

  useEffect(() => {
    const supabase = getBrowserClient();
    let isMounted = true;

    async function loadCompanyName(vendorIdToLoad: number | null) {
      if (typeof vendorIdToLoad !== 'number') {
        if (isMounted) {
          setCompanyName(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from('vendors')
        .select('name')
        .eq('id', vendorIdToLoad)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.warn('Failed to load vendor name', error);
        return;
      }

      setCompanyName(data?.name ?? null);
    }

    function syncSignedOutState() {
      if (!isMounted) {
        return;
      }

      setEmail(null);
      setVendorId(null);
      setRole(null);
      setStatus('signed-out');
      setCompanyName(null);
      setAdminActiveShipmentRequestCount(0);
      setAdminPendingVendorApplicationCount(0);
      setAdminOperationalAttentionCount(0);
    }

    async function syncSession(session: Session | null) {
      if (!isMounted) {
        return;
      }

      if (!session?.user) {
        syncSignedOutState();
        return;
      }

      let resolvedUser: User = session.user;
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.warn('Failed to refresh auth user metadata in app shell', userError);
        } else if (userData.user) {
          resolvedUser = userData.user;
        }
      } catch (error) {
        console.warn('Unexpected error while refreshing auth user metadata in app shell', error);
      }

      if (!isMounted) {
        return;
      }

      setEmail(resolvedUser.email ?? null);
      const nextVendorId = resolveVendorIdFromAuthUser(resolvedUser);
      setVendorId(nextVendorId);
      setRole(resolveRoleFromAuthUser(resolvedUser));
      setStatus('signed-in');
      void loadCompanyName(nextVendorId);
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to hydrate Supabase session', error);
        return;
      }

      void syncSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setStatus(initialAuth.status);
    setEmail(initialAuth.email);
    setVendorId(initialAuth.vendorId);
    setRole(initialAuth.role);
    setCompanyName(initialAuth.companyName);
    setAdminActiveShipmentRequestCount(initialAuth.adminActiveShipmentRequestCount);
    setAdminPendingVendorApplicationCount(initialAuth.adminPendingVendorApplicationCount);
    setAdminOperationalAttentionCount(initialAuth.adminOperationalAttentionCount);
  }, [
    initialAuth.adminActiveShipmentRequestCount,
    initialAuth.adminOperationalAttentionCount,
    initialAuth.adminPendingVendorApplicationCount,
    initialAuth.companyName,
    initialAuth.email,
    initialAuth.role,
    initialAuth.status,
    initialAuth.vendorId
  ]);

  useEffect(() => {
    if (status !== 'signed-in') {
      return;
    }

    if (typeof vendorId !== 'number') {
      setCompanyName(null);
      return;
    }

    if (companyName && companyName.length > 0) {
      return;
    }

    let isCancelled = false;
    const supabase = getBrowserClient();

    supabase
      .from('vendors')
      .select('name')
      .eq('id', vendorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (isCancelled || error) {
          if (error) {
            console.warn('Failed to refresh vendor name', error);
          }
          return;
        }
        setCompanyName(data?.name ?? null);
      });

    return () => {
      isCancelled = true;
    };
  }, [companyName, status, vendorId]);

  useEffect(() => {
    if (status !== 'signed-in' || role !== 'admin') {
      setAdminActiveShipmentRequestCount(0);
      return;
    }

    let isCancelled = false;
    const supabase = getBrowserClient();

    async function refreshAdminShipmentRequestCount() {
      const { count, error } = await supabase
        .from('shipment_adjustment_requests')
        .select('id', { head: true, count: 'exact' })
        .in('status', [...ACTIVE_SHIPMENT_ADJUSTMENT_STATUSES]);

      if (isCancelled) {
        return;
      }

      if (error) {
        console.warn('Failed to refresh active shipment adjustment request count', error);
        return;
      }

      setAdminActiveShipmentRequestCount(count ?? 0);
    }

    void refreshAdminShipmentRequestCount();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshAdminShipmentRequestCount();
      }
    }, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshAdminShipmentRequestCount();
      }
    }

    function handleShipmentAdjustmentUpdate() {
      void refreshAdminShipmentRequestCount();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(SHIPMENT_ADJUSTMENT_NAV_SYNC_EVENT, handleShipmentAdjustmentUpdate);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(SHIPMENT_ADJUSTMENT_NAV_SYNC_EVENT, handleShipmentAdjustmentUpdate);
    };
  }, [pathname, role, status]);

  useEffect(() => {
    if (status !== 'signed-in' || role !== 'admin') {
      setAdminPendingVendorApplicationCount(0);
      return;
    }

    let isCancelled = false;
    const supabase = getBrowserClient();

    async function refreshPendingVendorApplicationCount() {
      const { count, error } = await supabase
        .from('vendor_applications')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'pending');

      if (isCancelled) {
        return;
      }

      if (error) {
        console.warn('Failed to refresh pending vendor application count', error);
        return;
      }

      setAdminPendingVendorApplicationCount(count ?? 0);
    }

    void refreshPendingVendorApplicationCount();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshPendingVendorApplicationCount();
      }
    }, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshPendingVendorApplicationCount();
      }
    }

    function handleVendorApplicationUpdate() {
      void refreshPendingVendorApplicationCount();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(VENDOR_APPLICATION_NAV_SYNC_EVENT, handleVendorApplicationUpdate);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(VENDOR_APPLICATION_NAV_SYNC_EVENT, handleVendorApplicationUpdate);
    };
  }, [pathname, role, status]);

  const links = (() => {
    if (status !== 'signed-in') {
      return publicNavItems;
    }

    if (role === 'admin') {
      return adminNavItems;
    }

    if (vendorId) {
      return navItems;
    }

    if (role === 'pending_vendor') {
      return pendingNavItems;
    }

    return publicNavItems;
  })();
  const mobileNavItems = getMobileNavItems({
    status,
    role,
    vendorId,
    adminActiveShipmentRequestCount,
    adminPendingVendorApplicationCount
  });
  const hasMobileBottomNav = mobileNavItems.length > 0;
  const adminTabAttentionCount = role === 'admin'
    ? adminActiveShipmentRequestCount +
      adminPendingVendorApplicationCount +
      adminOperationalAttentionCount
    : 0;

  const brandHref = (() => {
    if (status !== 'signed-in') {
      return '/';
    }
    if (role === 'admin') {
      return '/admin';
    }
    if (vendorId) {
      return '/orders';
    }
    if (role === 'pending_vendor') {
      return '/pending';
    }
    return '/';
  })();

  useEffect(() => {
    const prefetchTargets = Array.from(
      new Set<string>([
        brandHref,
        ...links.map((item) => item.href)
      ])
    );

    prefetchTargets.forEach((href) => {
      try {
        router.prefetch(href);
      } catch {
        // Ignore prefetch failures and keep navigation functional.
      }
    });
  }, [brandHref, links, router]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminTabAttentionIndicator active={adminTabAttentionCount > 0} />
      <header className="relative z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-4 md:gap-6 md:px-6 md:py-4">
          <Link
            href={brandHref}
            className="flex min-w-0 shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-foreground sm:gap-3"
          >
            <Image
              src="/brand/livapon-header-logo.svg"
              alt="LIVAPON"
              width={266}
              height={50}
              priority
              className="h-auto w-28 sm:w-32 md:w-40"
              style={{ height: 'auto' }}
            />
            <span className="hidden text-base font-semibold text-slate-500 md:inline">配送管理システム</span>
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-2 text-sm md:w-auto md:gap-4">
            <nav
              aria-label="主要ナビゲーション"
              className={cn(
                'min-w-0 items-center gap-1 md:flex-none md:overflow-visible md:pb-0',
                hasMobileBottomNav ? 'hidden md:flex' : 'flex'
              )}
            >
              {links
                .filter((item) => item.href !== '/import')
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isNavActive(pathname ?? null, item.href) ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 active:scale-[0.98] sm:px-3 sm:py-2 sm:text-sm',
                      isNavActive(pathname ?? null, item.href)
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span>{item.label}</span>
                    {role === 'admin' &&
                    item.href === '/admin/applications' &&
                    adminPendingVendorApplicationCount > 0 ? (
                      <span
                        aria-hidden="true"
                        className="ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rose-600"
                      />
                    ) : null}
                    {role === 'admin' &&
                    item.href === '/admin/shipment-requests' &&
                    adminActiveShipmentRequestCount > 0 ? (
                      <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                        {adminActiveShipmentRequestCount > 99
                          ? '99+'
                          : adminActiveShipmentRequestCount}
                      </span>
                    ) : null}
                  </Link>
                ))}
            </nav>
            <AuthControls
              status={status}
              email={email}
              role={role}
              companyName={companyName}
              vendorId={vendorId}
            />
          </div>
        </div>
      </header>
      <div className="relative mx-auto flex w-full max-w-6xl flex-1">
        <main
          className={cn(
            'flex w-full flex-1 flex-col gap-6 px-3 pb-4 pt-4 sm:px-4 sm:pb-5 sm:pt-5 md:gap-8 md:px-6 md:py-6',
            hasMobileBottomNav && 'pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-6'
          )}
        >
          {children}
        </main>
      </div>
      <footer
        className={cn(
          'border-t border-slate-200 bg-white',
          hasMobileBottomNav && 'pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0'
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-4 md:px-6">
          <span>© {new Date().getFullYear()} LIVAPON Logistics</span>
          <nav className="flex gap-4">
            <Link href="/terms" className="transition hover:text-foreground">
              利用規約
            </Link>
            <Link href="/privacy" className="transition hover:text-foreground">
              プライバシーポリシー
            </Link>
          </nav>
        </div>
      </footer>
      {hasMobileBottomNav ? (
        <MobileBottomNav
          items={mobileNavItems}
          pathname={pathname ?? null}
        />
      ) : null}
    </div>
  );
}

function MobileBottomNav({
  items,
  pathname
}: {
  items: MobileNavItem[];
  pathname: string | null;
}) {
  return (
    <nav
      aria-label="モバイル主要ナビ"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
    >
      <div
        className={cn(
          'mx-auto grid max-w-6xl gap-1 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2',
          items.length === 5 ? 'grid-cols-5' : items.length === 4 ? 'grid-cols-4' : 'grid-cols-1'
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          const badge = typeof item.badge === 'number' && item.badge > 0
            ? item.badge > 99
              ? '99+'
              : String(item.badge)
            : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40',
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <span className="relative inline-flex">
                <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={2.1} />
                {badge ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
                    {badge}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AuthControls({
  status,
  email,
  role,
  companyName,
  vendorId
}: {
  status: 'loading' | 'signed-in' | 'signed-out';
  email: string | null;
  role: string | null;
  companyName: string | null;
  vendorId: number | null;
}) {
  if (status === 'loading') {
    return null;
  }

  if (status === 'signed-out') {
    return (
      <Link href="/sign-in" className="text-foreground/70 transition-colors hover:text-foreground">
        サインイン
      </Link>
    );
  }

  return (
    <UserMenu
      email={email}
      role={role}
      companyName={companyName}
      vendorId={vendorId}
    />
  );
}

function UserMenu({
  email,
  role,
  companyName,
  vendorId
}: {
  email: string | null;
  role: string | null;
  companyName: string | null;
  vendorId: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointer(event: PointerEvent) {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const displayName = companyName ?? email ?? 'アカウント';
  const subLabel =
    companyName
      ? email
      : role === 'admin'
        ? '管理者'
        : role === 'pending_vendor' && !vendorId
          ? '審査中'
          : email;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-full border border-transparent px-2 py-1 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <GradientAvatar seed={companyName ?? email} label={companyName ?? email} size="sm" />
        <span className="hidden flex-col text-left text-xs text-slate-600 sm:flex">
          <span className="font-medium text-foreground">{displayName}</span>
          {subLabel ? <span className="text-[11px] text-slate-500">{subLabel}</span> : null}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 shadow-lg">
          <div className="px-4 py-2">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            {subLabel ? <p className="text-xs text-slate-500">{subLabel}</p> : null}
          </div>
          <div className="mt-2 border-t border-slate-100 py-1 text-sm">
            {typeof vendorId === 'number' ? (
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-slate-600 transition hover:bg-slate-50 hover:text-foreground"
                onClick={() => {
                  setOpen(false);
                  router.push('/vendor/profile');
                }}
              >
                プロフィール編集
              </button>
            ) : null}
            <SignOutButton
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-left text-slate-600 hover:bg-slate-50 hover:text-foreground"
              onSignedOut={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

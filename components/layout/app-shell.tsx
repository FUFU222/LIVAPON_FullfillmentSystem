'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { getBrowserClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { GradientAvatar } from '@/components/ui/avatar';

export type AppShellInitialAuth = {
  status: 'signed-in' | 'signed-out';
  email: string | null;
  vendorId: number | null;
  role: string | null;
  companyName: string | null;
};

const navItems = [
  { href: '/orders', label: '注文一覧' },
  { href: '/import', label: 'CSVインポート' }
];

const adminNavItems = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/applications', label: '申請審査' },
  { href: '/admin/orders', label: '注文' },
  { href: '/admin/vendors', label: 'ベンダー' }
];

const publicNavItems = [{ href: '/apply', label: '利用申請' }];
const pendingNavItems = [{ href: '/pending', label: '審査状況' }];

function parseVendorId(meta: Record<string, unknown> | undefined): number | null {
  if (!meta) {
    return null;
  }

  const value = meta.vendor_id ?? meta.vendorId;

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseRole(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) {
    return null;
  }

  const value = meta.role ?? meta.user_role ?? meta.app_role;

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }

  return null;
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
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'signed-in' | 'signed-out'>(
    initialAuth.status
  );
  const [email, setEmail] = useState<string | null>(initialAuth.email);
  const [vendorId, setVendorId] = useState<number | null>(initialAuth.vendorId);
  const [role, setRole] = useState<string | null>(initialAuth.role);
  const [companyName, setCompanyName] = useState<string | null>(initialAuth.companyName);

  useEffect(() => {
    const supabase = getBrowserClient();

    async function loadCompanyName(vendorIdToLoad: number | null) {
      if (typeof vendorIdToLoad !== 'number') {
        setCompanyName(null);
        return;
      }

      const { data, error } = await supabase
        .from('vendors')
        .select('name')
        .eq('id', vendorIdToLoad)
        .maybeSingle();

      if (error) {
        console.warn('Failed to load vendor name', error);
        return;
      }

      setCompanyName(data?.name ?? null);
    }

    function syncSession(session: Session | null) {
      if (session?.user) {
        setEmail(session.user.email ?? null);
        const nextVendorId = parseVendorId({
          ...session.user.user_metadata,
          ...session.user.app_metadata
        });
        setVendorId(nextVendorId);
        setRole(parseRole({ ...session.user.user_metadata, ...session.user.app_metadata }));
        setStatus('signed-in');
        void loadCompanyName(nextVendorId);
      } else {
        setEmail(null);
        setVendorId(null);
        setRole(null);
        setStatus('signed-out');
        setCompanyName(null);
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setStatus(initialAuth.status);
    setEmail(initialAuth.email);
    setVendorId(initialAuth.vendorId);
    setRole(initialAuth.role);
    setCompanyName(initialAuth.companyName);
  }, [
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

  const links = (() => {
    if (status !== 'signed-in') {
      return publicNavItems;
    }

    if (role === 'admin') {
      return adminNavItems;
    }

    if (role === 'pending_vendor') {
      return pendingNavItems;
    }

    if (vendorId) {
      return navItems;
    }

    return publicNavItems;
  })();

  const brandHref = '/';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href={brandHref} className="flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
            <Image
              src="/LIVAPON_logo_horizontal.svg"
              alt="LIVAPON"
              width={192}
              height={40}
              priority
              className="h-[4.5rem] w-auto"
            />
            <span className="hidden text-base font-semibold text-slate-500 sm:inline">配送管理コンソール</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex items-center gap-2">
              {links
                .filter((item) => item.href !== '/import')
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 active:scale-[0.98]',
                      isNavActive(pathname ?? null, item.href)
                        ? 'bg-foreground text-white shadow-sm'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {item.label}
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-6">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
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
    </div>
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
  const subLabel = companyName ? email : role === 'admin' ? '管理者' : role === 'pending_vendor' ? '審査中' : email;

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
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 shadow-lg">
          <div className="px-4 py-2">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            {subLabel ? <p className="text-xs text-slate-500">{subLabel}</p> : null}
          </div>
          <div className="mt-2 border-t border-slate-100 py-1 text-sm">
            {typeof vendorId === 'number' ? (
              <Link
                href="/vendor/profile"
                className="block px-4 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                プロフィール編集
              </Link>
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

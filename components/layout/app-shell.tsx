'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { getBrowserClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';

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
            <span className="hidden text-sm font-semibold text-slate-500 sm:inline">Fulfillment Console</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex items-center gap-2">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 transition-colors',
                    isNavActive(pathname ?? null, item.href)
                      ? 'bg-foreground text-white'
                      : 'text-foreground/70 hover:bg-muted'
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
            />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-6">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} LIVAPON Logistics
      </footer>
    </div>
  );
}

function AuthControls({
  status,
  email,
  role,
  companyName
}: {
  status: 'loading' | 'signed-in' | 'signed-out';
  email: string | null;
  role: string | null;
  companyName: string | null;
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

  const displayLabel = companyName ?? email;
  const suffix = !companyName
    ? role === 'admin'
      ? '（管理者）'
      : role === 'pending_vendor'
        ? '（審査中）'
        : null
    : null;

  return (
    <div className="flex items-center gap-2">
      {displayLabel ? (
        <span className="hidden text-xs text-slate-500 sm:inline">
          {displayLabel}
          {suffix}
        </span>
      ) : null}
      <SignOutButton />
    </div>
  );
}

'use client';

import Link from 'next/link';
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

  useEffect(() => {
    const supabase = getBrowserClient();

    function syncSession(session: Session | null) {
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setVendorId(parseVendorId({ ...session.user.user_metadata, ...session.user.app_metadata }));
        setRole(parseRole({ ...session.user.user_metadata, ...session.user.app_metadata }));
        setStatus('signed-in');
      } else {
        setEmail(null);
        setVendorId(null);
        setRole(null);
        setStatus('signed-out');
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
  }, [initialAuth.email, initialAuth.role, initialAuth.status, initialAuth.vendorId]);

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
          <Link href={brandHref} className="text-lg font-semibold tracking-tight text-foreground">
            LIVAPON Fulfillment
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
            <AuthControls status={status} email={email} role={role} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
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
  role
}: {
  status: 'loading' | 'signed-in' | 'signed-out';
  email: string | null;
  role: string | null;
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
    <div className="flex items-center gap-2">
      {email ? (
        <span className="hidden text-xs text-slate-500 sm:inline">
          {email}
          {role === 'admin' ? '（管理者）' : null}
          {role === 'pending_vendor' ? '（審査中）' : null}
        </span>
      ) : null}
      <SignOutButton />
    </div>
  );
}

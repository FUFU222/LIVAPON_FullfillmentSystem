import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppShell, type AppShellInitialAuth } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/ui/toast-provider';
import { getAuthContext } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'LIVAPON Fulfillment Console',
  description: 'Shopify注文の配送管理を行う管理アプリ'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext().catch(() => null);

  const initialAuth: AppShellInitialAuth = auth
    ? {
        status: 'signed-in',
        email: auth.user.email ?? null,
        vendorId: auth.vendorId,
        role: auth.role
      }
    : {
        status: 'signed-out',
        email: null,
        vendorId: null,
        role: null
      };

  return (
    <html lang="ja" className="bg-background text-foreground">
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <ToastProvider>
          <AppShell initialAuth={initialAuth}>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}

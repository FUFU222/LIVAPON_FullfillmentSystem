import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppShell, type AppShellInitialAuth } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/ui/toast-provider';
import { getAuthContext } from '@/lib/auth';
import { countActiveShipmentAdjustmentRequestsForAdmin } from '@/lib/data/shipment-adjustments';
import {
  countPendingVendorApplicationsForAdmin,
  getVendorProfile
} from '@/lib/data/vendors';

export const metadata: Metadata = {
  title: 'LIVAPON 配送管理システム',
  description: 'Shopify注文の配送管理を行う管理アプリ'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext().catch(() => null);

  let companyName: string | null = null;
  let adminActiveShipmentRequestCount = 0;
  let adminPendingVendorApplicationCount = 0;

  if (auth && typeof auth.vendorId === 'number') {
    try {
      const profile = await getVendorProfile(auth.vendorId);
      companyName = profile?.name ?? null;
    } catch (error) {
      console.error('Failed to load vendor profile for layout', error);
    }
  }

  if (auth?.role === 'admin') {
    try {
      [adminActiveShipmentRequestCount, adminPendingVendorApplicationCount] = await Promise.all([
        countActiveShipmentAdjustmentRequestsForAdmin(),
        countPendingVendorApplicationsForAdmin()
      ]);
    } catch (error) {
      console.error('Failed to load admin navigation counts for layout', error);
    }
  }

  const initialAuth: AppShellInitialAuth = auth
    ? {
        status: 'signed-in',
        email: auth.user.email ?? null,
        vendorId: auth.vendorId,
        role: auth.role,
        companyName,
        adminActiveShipmentRequestCount,
        adminPendingVendorApplicationCount
      }
    : {
        status: 'signed-out',
        email: null,
        vendorId: null,
        role: null,
        companyName: null,
        adminActiveShipmentRequestCount: 0,
        adminPendingVendorApplicationCount: 0
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

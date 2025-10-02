import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'LIVAPON Fulfillment Console',
  description: 'Shopify注文の配送管理を行う管理アプリ'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className="bg-background text-foreground">
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

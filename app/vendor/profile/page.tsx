import { redirect } from 'next/navigation';
import { Bell, Building2, ShieldCheck, type LucideIcon } from 'lucide-react';
import { GradientAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VendorProfileForm } from '@/components/vendor/profile-form';
import { OrdersRealtimeProvider } from '@/components/orders/orders-realtime-context';
import { OrdersRealtimeListener } from '@/components/orders/orders-realtime-listener';
import { getAuthContext, assertAuthorizedVendor } from '@/lib/auth';
import { getVendorProfile } from '@/lib/data/vendors';

export default async function VendorProfilePage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/vendor/profile');
  }

  if (auth.role === 'pending_vendor' && auth.vendorId === null) {
    redirect('/pending');
  }

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  if (auth.vendorId === null) {
    redirect('/sign-in?redirectTo=/vendor/profile');
  }

  assertAuthorizedVendor(auth.vendorId);

  const vendor = await getVendorProfile(auth.vendorId).catch((error) => {
    console.error('Failed to load vendor profile', error);
    return null;
  });

  if (!vendor) {
    redirect('/orders');
  }

  const contactName = (vendor.contactName ?? (auth.session.user.user_metadata?.contact_name ?? null)) as string | null;
  const contactEmail = vendor.contactEmail ?? auth.session.user.email ?? '';
  const contactPhone = (vendor.contactPhone ?? (auth.session.user.user_metadata?.contact_phone ?? null)) as string | null;
  const notifyNewOrders = vendor.notifyNewOrders ?? true;
  const notificationRecipientCount = (contactEmail ? 1 : 0) + vendor.notificationEmails.length;

  return (
    <OrdersRealtimeProvider>
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-10">
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="gap-6 border-b border-slate-100 pb-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <GradientAvatar seed={vendor.name ?? contactEmail} label={vendor.name ?? contactEmail} size="lg" />
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600 normal-case tracking-normal">
                      プロフィール設定
                    </Badge>
                    {vendor.code ? (
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600 normal-case tracking-normal">
                        セラーコード {vendor.code}
                      </Badge>
                    ) : null}
                    <Badge
                      className={notifyNewOrders
                        ? 'border-amber-200 bg-amber-50 text-amber-700 normal-case tracking-normal'
                        : 'border-slate-200 bg-slate-50 text-slate-600 normal-case tracking-normal'}
                    >
                      {notifyNewOrders ? '注文通知 ON' : '注文通知 OFF'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-semibold text-foreground">
                      {vendor.name}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-6">
                      連絡先、注文通知、ログイン情報をこの画面でまとめて管理できます。上から順に見れば必要な設定だけをすぐ把握できます。
                    </CardDescription>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ProfileSnapshotCard
                icon={Building2}
                label="基本情報"
                value="会社名と連絡先"
                detail={contactName ? `${contactName} / ${contactPhone ?? '電話番号未設定'}` : '担当者情報を更新できます'}
                tone="slate"
              />
              <ProfileSnapshotCard
                icon={Bell}
                label="通知設定"
                value={notifyNewOrders ? '注文通知を送信中' : '注文通知を停止中'}
                detail={notifyNewOrders ? `送信先 ${notificationRecipientCount} 件` : '必要なときだけ再開できます'}
                tone="amber"
              />
              <ProfileSnapshotCard
                icon={ShieldCheck}
                label="ログイン・セキュリティ"
                value="パスワード変更"
                detail="変更時のみ入力。ログイン用メールは別管理です。"
                tone="emerald"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <VendorProfileForm
              initial={{
                companyName: vendor.name,
                contactName,
                contactEmail,
                notificationEmails: vendor.notificationEmails,
                vendorCode: vendor.code,
                contactPhone,
                notifyNewOrders
              }}
            />
          </CardContent>
        </Card>
      </div>
    </OrdersRealtimeProvider>
  );
}

function ProfileSnapshotCard({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: 'slate' | 'amber' | 'emerald';
}) {
  const toneClasses = {
    slate: {
      panel: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white',
      icon: 'bg-white text-slate-700 ring-slate-200'
    },
    amber: {
      panel: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
      icon: 'bg-white text-amber-700 ring-amber-200'
    },
    emerald: {
      panel: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
      icon: 'bg-white text-emerald-700 ring-emerald-200'
    }
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone].panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="text-base font-semibold text-foreground">
            {value}
          </p>
          <p className="text-sm leading-5 text-slate-500">
            {detail}
          </p>
        </div>
        <div className={`rounded-xl p-2 ring-1 ${toneClasses[tone].icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

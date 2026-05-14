import { redirect } from 'next/navigation';
import { GradientAvatar } from '@/components/ui/avatar';
import { PageHeader, Surface } from '@/components/ui/page-shell';
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
  const notifyNewOrders = vendor.notifyNewOrders ?? true;

  return (
    <OrdersRealtimeProvider>
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <div className="mx-auto grid w-full max-w-4xl gap-5">
        <PageHeader
          eyebrow="Settings"
          title="セラー設定"
          description="連絡先、通知先、発送元住所、ログイン情報を管理します。"
          meta={
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <GradientAvatar seed={vendor.name ?? contactEmail} label={vendor.name ?? contactEmail} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">{vendor.name}</p>
                <p className="truncate text-xs text-slate-500">{contactEmail}</p>
              </div>
            </div>
          }
        />
        <Surface className="p-4 sm:p-6">
          <VendorProfileForm
            initial={{
              companyName: vendor.name,
              contactName,
              contactEmail,
              notificationEmails: vendor.notificationEmails,
              vendorCode: vendor.code,
              contactPhone: vendor.contactPhone ?? null,
              notifyNewOrders,
              postal: vendor.postal ?? null,
              prefecture: vendor.prefecture ?? null,
              city: vendor.city ?? null,
              address1: vendor.address1 ?? null,
              address2: vendor.address2 ?? null
            }}
          />
        </Surface>
      </div>
    </OrdersRealtimeProvider>
  );
}

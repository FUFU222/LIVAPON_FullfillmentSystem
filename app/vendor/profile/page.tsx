import { redirect } from 'next/navigation';
import { GradientAvatar } from '@/components/ui/avatar';
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
  const notifyNewOrders = vendor.notifyNewOrders ?? true;

  return (
    <OrdersRealtimeProvider>
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-10">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-6 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <GradientAvatar seed={vendor.name ?? contactEmail} label={vendor.name ?? contactEmail} size="lg" />
              <div className="space-y-2">
                <CardTitle className="text-2xl font-semibold text-foreground">
                  {vendor.name}
                </CardTitle>
                <CardDescription>
                  連絡先、通知先、パスワードをここで更新できます。
                </CardDescription>
              </div>
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
                contactPhone: vendor.contactPhone ?? null,
                notifyNewOrders
              }}
            />
          </CardContent>
        </Card>
      </div>
    </OrdersRealtimeProvider>
  );
}
